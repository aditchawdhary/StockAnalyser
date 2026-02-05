"""
Fast concurrent stock data fetcher with rate limiting.
Optimized for Alpha Vantage 75 QPM / 5 QPS plan.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction, close_old_connections
from stocks.models import Stock, StockPrice, DailyStock, DailyStockPrice, IntradayStock, IntradayStockPrice, APICallLog
import requests
import os
from datetime import datetime, timedelta
from .top5kcompanies import all_5k_stocks
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque
import pytz


class RateLimiter:
    """
    Token bucket rate limiter for API calls.
    Supports both QPM (queries per minute) and QPS (queries per second) limits.
    """

    def __init__(self, qpm=75, qps=5):
        self.qpm = qpm
        self.qps = qps
        self.lock = threading.Lock()
        self.request_times = deque()  # For QPM tracking
        self.second_requests = deque()  # For QPS tracking

    def acquire(self):
        """Wait until we can make a request within rate limits."""
        while True:
            with self.lock:
                now = time.time()

                # Clean old entries (older than 60 seconds for QPM)
                while self.request_times and self.request_times[0] < now - 60:
                    self.request_times.popleft()

                # Clean old entries (older than 1 second for QPS)
                while self.second_requests and self.second_requests[0] < now - 1:
                    self.second_requests.popleft()

                # Check if we can make a request
                if len(self.request_times) < self.qpm and len(self.second_requests) < self.qps:
                    self.request_times.append(now)
                    self.second_requests.append(now)
                    return

            # Wait a bit before checking again
            time.sleep(0.1)


class Command(BaseCommand):
    help = 'Fast concurrent stock data fetcher with rate limiting (75 QPM / 5 QPS)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--symbols',
            type=str,
            help='Comma-separated list of stock symbols',
            default='META,AAPL,AMZN,NFLX,NVDA,MSFT'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force refresh even if recently updated'
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Fetch all S&P 500 stocks',
            default=False
        )
        parser.add_argument(
            '--weekly',
            action='store_true',
            help='Fetch weekly data',
            default=False
        )
        parser.add_argument(
            '--daily',
            action='store_true',
            help='Fetch daily data',
            default=False
        )
        parser.add_argument(
            '--intraday',
            action='store_true',
            help='Fetch intraday data',
            default=False
        )
        parser.add_argument(
            '--workers',
            type=int,
            help='Number of concurrent workers (default: 5)',
            default=5
        )
        parser.add_argument(
            '--qpm',
            type=int,
            help='Queries per minute limit (default: 70, leaving buffer)',
            default=70
        )
        parser.add_argument(
            '--qps',
            type=int,
            help='Queries per second limit (default: 4, leaving buffer)',
            default=4
        )
        parser.add_argument(
            '--retries',
            type=int,
            help='Number of retry rounds for failed tasks (default: 2)',
            default=2
        )
        parser.add_argument(
            '--retry-delay',
            type=int,
            help='Seconds to wait between retry rounds (default: 60)',
            default=60
        )

    # Errors that should be retried (transient failures)
    RETRIABLE_ERRORS = [
        'rate limit',
        'Rate limit',
        'Information',
        'timed out',
        'timeout',
        'ConnectionError',
        'ConnectionPool',
    ]

    def is_retriable_error(self, error):
        """Check if an error is transient and should be retried."""
        if not error:
            return False
        return any(err in str(error) for err in self.RETRIABLE_ERRORS)

    def handle(self, *args, **options):
        api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
        if not api_key:
            self.stdout.write(self.style.ERROR('ALPHA_VANTAGE_API_KEY not found'))
            return

        # Get symbols
        if options['all']:
            symbols = list(all_5k_stocks.keys())
        else:
            symbols = [s.strip().upper() for s in options['symbols'].split(',')]

        # Determine which data types to fetch
        fetch_weekly = options['weekly']
        fetch_daily = options['daily']
        fetch_intraday = options['intraday']

        # If none specified, fetch all
        if not any([fetch_weekly, fetch_daily, fetch_intraday]):
            fetch_weekly = fetch_daily = fetch_intraday = True

        force = options['force']
        workers = options['workers']
        qpm = options['qpm']
        qps = options['qps']
        max_retries = options['retries']
        retry_delay = options['retry_delay']

        # Create rate limiter
        rate_limiter = RateLimiter(qpm=qpm, qps=qps)

        # Build task queue
        tasks = []
        for symbol in symbols:
            if fetch_weekly:
                tasks.append(('weekly', symbol))
            if fetch_daily:
                tasks.append(('daily', symbol))
            if fetch_intraday:
                tasks.append(('intraday', symbol))

        total_tasks = len(tasks)
        self.stdout.write(self.style.WARNING(
            f'\nFetching {total_tasks} data points ({len(symbols)} stocks)'
        ))
        self.stdout.write(f'Rate limits: {qpm} QPM, {qps} QPS')
        self.stdout.write(f'Workers: {workers}')
        self.stdout.write(f'Retries: {max_retries} rounds (delay: {retry_delay}s)')

        estimated_time = total_tasks / qpm
        self.stdout.write(f'Estimated time: {estimated_time:.1f} minutes\n')

        # Track progress
        completed = {'count': 0, 'success': 0, 'failed': 0}
        failed_tasks = []  # Collect failed tasks for retry
        lock = threading.Lock()
        start_time = time.time()

        def fetch_task(task, current_total):
            data_type, symbol = task
            task_start = time.time()
            try:
                rate_limiter.acquire()

                if data_type == 'weekly':
                    success, records, error = self.fetch_weekly(symbol, api_key, force)
                elif data_type == 'daily':
                    success, records, error = self.fetch_daily(symbol, api_key, force)
                else:  # intraday
                    success, records, error = self.fetch_intraday(symbol, api_key, force)

                task_time = time.time() - task_start

                with lock:
                    completed['count'] += 1
                    if success:
                        completed['success'] += 1
                        self.stdout.write(
                            f"✓ {symbol} ({data_type}) - {records} records in {task_time:.1f}s"
                        )
                    else:
                        completed['failed'] += 1
                        self.stdout.write(
                            self.style.ERROR(f"✗ {symbol} ({data_type}) - {error}")
                        )
                        # Track retriable failures
                        if self.is_retriable_error(error):
                            failed_tasks.append((data_type, symbol, error))

                    # Progress summary every 20 tasks
                    if completed['count'] % 20 == 0 or completed['count'] == current_total:
                        elapsed = time.time() - start_time
                        rate = completed['count'] / (elapsed / 60) if elapsed > 0 else 0
                        remaining = (current_total - completed['count']) / rate if rate > 0 else 0
                        self.stdout.write(self.style.WARNING(
                            f"\n--- Progress: {completed['count']}/{current_total} "
                            f"({completed['success']} ok, {completed['failed']} failed) "
                            f"Rate: {rate:.1f}/min, ETA: {remaining:.1f}min ---\n"
                        ))

                return (data_type, symbol, success, error)
            except Exception as e:
                error_str = str(e)
                with lock:
                    completed['count'] += 1
                    completed['failed'] += 1
                    self.stdout.write(
                        self.style.ERROR(f"✗ {symbol} ({data_type}) - Exception: {error_str}")
                    )
                    # Track retriable failures
                    if self.is_retriable_error(error_str):
                        failed_tasks.append((data_type, symbol, error_str))
                return (data_type, symbol, False, error_str)
            finally:
                # Release database connections back to the pool
                # Critical for threaded Django to prevent connection exhaustion
                close_old_connections()

        def run_tasks(task_list, run_label=""):
            """Execute a batch of tasks and return results."""
            current_total = len(task_list)
            if run_label:
                self.stdout.write(self.style.WARNING(f"\n{run_label}"))

            with ThreadPoolExecutor(max_workers=workers) as executor:
                futures = [executor.submit(fetch_task, task, current_total) for task in task_list]
                for future in as_completed(futures):
                    future.result()

        # Main execution
        run_tasks(tasks)

        # Retry failed tasks
        retry_round = 0
        while failed_tasks and retry_round < max_retries:
            retry_round += 1
            retriable_count = len(failed_tasks)

            self.stdout.write(self.style.WARNING(
                f'\n=== RETRY ROUND {retry_round}/{max_retries} ===\n'
                f'Retriable failures: {retriable_count}\n'
                f'Waiting {retry_delay}s before retry...'
            ))
            time.sleep(retry_delay)

            # Reset counters for this retry round
            retry_tasks = [(dt, sym) for dt, sym, _ in failed_tasks]
            failed_tasks.clear()
            completed['count'] = 0
            completed['failed'] = 0
            retry_start_success = completed['success']

            run_tasks(retry_tasks, f"Retrying {len(retry_tasks)} tasks...")

            retry_success = completed['success'] - retry_start_success
            self.stdout.write(self.style.WARNING(
                f'\nRetry round {retry_round} complete: '
                f'{retry_success}/{retriable_count} recovered'
            ))

        # Summary
        elapsed = time.time() - start_time
        final_failed = total_tasks - completed['success']
        self.stdout.write(self.style.SUCCESS(
            f'\n=== COMPLETE ===\n'
            f'Total time: {elapsed / 60:.1f} minutes\n'
            f'Success: {completed["success"]}/{total_tasks}\n'
            f'Failed: {final_failed}/{total_tasks}\n'
            f'Actual rate: {total_tasks / (elapsed / 60):.1f} requests/min'
        ))

        # Report any remaining failures
        if failed_tasks:
            self.stdout.write(self.style.WARNING(
                f'\nPermanent failures ({len(failed_tasks)}):'
            ))
            for data_type, symbol, error in failed_tasks[:10]:  # Show first 10
                self.stdout.write(f'  - {symbol} ({data_type}): {error}')

    def fetch_weekly(self, symbol, api_key, force):
        """Fetch weekly data for a symbol using bulk operations.
        Returns: (success, records_count, error_message)
        """
        try:
            stock, created = Stock.objects.get_or_create(
                symbol=symbol,
                defaults={'name': all_5k_stocks.get(symbol, symbol)}
            )

            if not force and not created:
                time_diff = timezone.now() - stock.last_updated
                if time_diff < timedelta(hours=1):
                    return (True, 0, 'skipped (recent)')

            url = f'https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol={symbol}&apikey={api_key}'
            response = requests.get(url, timeout=30)
            data = response.json()

            if 'Error Message' in data:
                error = data.get('Error Message', 'Unknown error')
                APICallLog.objects.create(symbol=symbol, success=False, error_message=error)
                return (False, 0, error)

            if 'Note' in data:
                error = data.get('Note', 'Rate limited')
                APICallLog.objects.create(symbol=symbol, success=False, error_message=error)
                return (False, 0, 'API rate limit hit')

            time_series_key = 'Weekly Adjusted Time Series' if 'Weekly Adjusted Time Series' in data else 'Weekly Time Series'
            if time_series_key not in data:
                APICallLog.objects.create(symbol=symbol, success=False, error_message='Unexpected format')
                return (False, 0, f'Unexpected response: {list(data.keys())}')

            time_series = data[time_series_key]

            # Delete existing prices and bulk insert new ones (much faster than update_or_create)
            with transaction.atomic():
                StockPrice.objects.filter(stock=stock).delete()

                prices_to_create = []
                for date_str, values in time_series.items():
                    date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    volume = values.get('6. volume') or values.get('5. volume')

                    # Calculate adjustment ratio for stock splits/dividends
                    # Alpha Vantage only provides adjusted close, so we derive the ratio
                    # and apply it to open/high/low for consistency
                    raw_close = float(values['4. close'])
                    adjusted_close = float(values.get('5. adjusted close', raw_close))
                    adj_ratio = adjusted_close / raw_close if raw_close != 0 else 1

                    prices_to_create.append(StockPrice(
                        stock=stock,
                        date=date,
                        open_price=float(values['1. open']) * adj_ratio,
                        high_price=float(values['2. high']) * adj_ratio,
                        low_price=float(values['3. low']) * adj_ratio,
                        close_price=adjusted_close,
                        volume=volume
                    ))

                StockPrice.objects.bulk_create(prices_to_create, batch_size=500)
                stock.save()

            APICallLog.objects.create(symbol=symbol, success=True)
            return (True, len(prices_to_create), None)

        except Exception as e:
            APICallLog.objects.create(symbol=symbol, success=False, error_message=str(e))
            return (False, 0, str(e))

    def fetch_daily(self, symbol, api_key, force):
        """Fetch daily data for a symbol using bulk operations.
        Returns: (success, records_count, error_message)
        """
        try:
            stock, created = DailyStock.objects.using('daily').get_or_create(
                symbol=symbol,
                defaults={'name': all_5k_stocks.get(symbol, symbol)}
            )

            if not force and not created:
                time_diff = timezone.now() - stock.last_updated
                if time_diff < timedelta(hours=1):
                    return (True, 0, 'skipped (recent)')

            url = f'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol={symbol}&outputsize=full&apikey={api_key}'
            response = requests.get(url, timeout=30)
            data = response.json()

            if 'Error Message' in data:
                return (False, 0, data.get('Error Message', 'Unknown error'))

            if 'Note' in data:
                return (False, 0, 'API rate limit hit')

            time_series_key = 'Time Series (Daily)'
            if time_series_key not in data:
                return (False, 0, f'Unexpected response: {list(data.keys())}')

            time_series = data[time_series_key]

            # Delete existing and bulk insert (much faster)
            with transaction.atomic():
                DailyStockPrice.objects.using('daily').filter(stock=stock).delete()

                prices_to_create = []
                for date_str, values in time_series.items():
                    date = datetime.strptime(date_str, '%Y-%m-%d').date()

                    # Calculate adjustment ratio for stock splits/dividends
                    raw_close = float(values['4. close'])
                    adjusted_close = float(values.get('5. adjusted close', raw_close))
                    adj_ratio = adjusted_close / raw_close if raw_close != 0 else 1

                    prices_to_create.append(DailyStockPrice(
                        stock=stock,
                        date=date,
                        open_price=float(values['1. open']) * adj_ratio,
                        high_price=float(values['2. high']) * adj_ratio,
                        low_price=float(values['3. low']) * adj_ratio,
                        close_price=adjusted_close,
                        volume=values.get('6. volume', values.get('5. volume'))
                    ))

                DailyStockPrice.objects.using('daily').bulk_create(prices_to_create, batch_size=500)
                stock.save(using='daily')

            return (True, len(prices_to_create), None)

        except Exception as e:
            return (False, 0, str(e))

    def fetch_intraday(self, symbol, api_key, force):
        """Fetch intraday data for a symbol using bulk operations.
        Returns: (success, records_count, error_message)
        """
        try:
            stock, created = IntradayStock.objects.using('intraday').get_or_create(
                symbol=symbol,
                defaults={'name': all_5k_stocks.get(symbol, symbol)}
            )

            if not force and not created:
                time_diff = timezone.now() - stock.last_updated
                if time_diff < timedelta(minutes=30):
                    return (True, 0, 'skipped (recent)')

            url = f'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol={symbol}&interval=5min&apikey={api_key}'
            response = requests.get(url, timeout=30)
            data = response.json()

            if 'Error Message' in data:
                return (False, 0, data.get('Error Message', 'Unknown error'))

            if 'Note' in data:
                return (False, 0, 'API rate limit hit')

            # Find the time series key dynamically (handles 1min, 5min, 15min, 30min, 60min)
            time_series_key = next((k for k in data.keys() if k.startswith('Time Series')), None)
            if time_series_key is None:
                return (False, 0, f'No time series in response: {list(data.keys())}')

            time_series = data[time_series_key]

            # Delete existing and bulk insert (much faster)
            # Alpha Vantage returns timestamps in US Eastern time
            eastern = pytz.timezone('US/Eastern')

            with transaction.atomic():
                IntradayStockPrice.objects.using('intraday').filter(stock=stock).delete()

                prices_to_create = []
                for timestamp_str, values in time_series.items():
                    naive_timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                    # Make timezone-aware (US Eastern) then convert to UTC
                    aware_timestamp = eastern.localize(naive_timestamp)
                    prices_to_create.append(IntradayStockPrice(
                        stock=stock,
                        timestamp=aware_timestamp,
                        open_price=values['1. open'],
                        high_price=values['2. high'],
                        low_price=values['3. low'],
                        close_price=values['4. close'],
                        volume=values['5. volume']
                    ))

                IntradayStockPrice.objects.using('intraday').bulk_create(prices_to_create, batch_size=500)
                stock.save(using='intraday')

            return (True, len(prices_to_create), None)

        except Exception as e:
            return (False, 0, str(e))
