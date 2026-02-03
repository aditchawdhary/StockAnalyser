"""
Fast concurrent stock data fetcher with rate limiting.
Optimized for Alpha Vantage 75 QPM / 5 QPS plan.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from stocks.models import Stock, StockPrice, DailyStock, DailyStockPrice, IntradayStock, IntradayStockPrice, APICallLog
import requests
import os
from datetime import datetime, timedelta
from .fortune500 import all_fortune_500
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque


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

    def handle(self, *args, **options):
        api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
        if not api_key:
            self.stdout.write(self.style.ERROR('ALPHA_VANTAGE_API_KEY not found'))
            return

        # Get symbols
        if options['all']:
            symbols = list(all_fortune_500.keys())
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

        estimated_time = total_tasks / qpm
        self.stdout.write(f'Estimated time: {estimated_time:.1f} minutes\n')

        # Track progress
        completed = {'count': 0, 'success': 0, 'failed': 0}
        lock = threading.Lock()
        start_time = time.time()

        def fetch_task(task):
            data_type, symbol = task
            try:
                rate_limiter.acquire()

                if data_type == 'weekly':
                    success = self.fetch_weekly(symbol, api_key, force)
                elif data_type == 'daily':
                    success = self.fetch_daily(symbol, api_key, force)
                else:  # intraday
                    success = self.fetch_intraday(symbol, api_key, force)

                with lock:
                    completed['count'] += 1
                    if success:
                        completed['success'] += 1
                    else:
                        completed['failed'] += 1

                    # Progress update every 10 tasks
                    if completed['count'] % 10 == 0 or completed['count'] == total_tasks:
                        elapsed = time.time() - start_time
                        rate = completed['count'] / (elapsed / 60) if elapsed > 0 else 0
                        remaining = (total_tasks - completed['count']) / rate if rate > 0 else 0
                        self.stdout.write(
                            f"Progress: {completed['count']}/{total_tasks} "
                            f"({completed['success']} ok, {completed['failed']} failed) "
                            f"Rate: {rate:.1f}/min, ETA: {remaining:.1f}min"
                        )

                return (data_type, symbol, success, None)
            except Exception as e:
                with lock:
                    completed['count'] += 1
                    completed['failed'] += 1
                return (data_type, symbol, False, str(e))

        # Execute with thread pool
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = [executor.submit(fetch_task, task) for task in tasks]

            for future in as_completed(futures):
                result = future.result()
                if result[3]:  # Has error
                    self.stdout.write(
                        self.style.ERROR(f'{result[0]} {result[1]}: {result[3]}')
                    )

        # Summary
        elapsed = time.time() - start_time
        self.stdout.write(self.style.SUCCESS(
            f'\n=== COMPLETE ===\n'
            f'Total time: {elapsed / 60:.1f} minutes\n'
            f'Success: {completed["success"]}/{total_tasks}\n'
            f'Failed: {completed["failed"]}/{total_tasks}\n'
            f'Actual rate: {total_tasks / (elapsed / 60):.1f} requests/min'
        ))

    def fetch_weekly(self, symbol, api_key, force):
        """Fetch weekly data for a symbol."""
        try:
            stock, created = Stock.objects.get_or_create(
                symbol=symbol,
                defaults={'name': all_fortune_500.get(symbol, symbol)}
            )

            if not force and not created:
                time_diff = timezone.now() - stock.last_updated
                if time_diff < timedelta(hours=1):
                    return True  # Skip, already recent

            url = f'https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol={symbol}&apikey={api_key}'
            response = requests.get(url, timeout=15)
            data = response.json()

            if 'Error Message' in data or 'Note' in data:
                raise Exception(data.get('Error Message') or data.get('Note'))

            time_series_key = 'Weekly Adjusted Time Series' if 'Weekly Adjusted Time Series' in data else 'Weekly Time Series'
            if time_series_key not in data:
                raise Exception('Unexpected response format')

            time_series = data[time_series_key]

            with transaction.atomic():
                for date_str, values in time_series.items():
                    date = datetime.strptime(date_str, '%Y-%m-%d').date()
                    volume = values.get('6. volume') or values.get('5. volume')
                    close_price = values.get('5. adjusted close') or values.get('4. close')

                    StockPrice.objects.update_or_create(
                        stock=stock,
                        date=date,
                        defaults={
                            'open_price': values['1. open'],
                            'high_price': values['2. high'],
                            'low_price': values['3. low'],
                            'close_price': close_price,
                            'volume': volume
                        }
                    )
                stock.save()

            APICallLog.objects.create(symbol=symbol, success=True)
            return True

        except Exception as e:
            APICallLog.objects.create(symbol=symbol, success=False, error_message=str(e))
            return False

    def fetch_daily(self, symbol, api_key, force):
        """Fetch daily data for a symbol."""
        try:
            stock, created = DailyStock.objects.using('daily').get_or_create(
                symbol=symbol,
                defaults={'name': all_fortune_500.get(symbol, symbol)}
            )

            if not force and not created:
                time_diff = timezone.now() - stock.last_updated
                if time_diff < timedelta(hours=1):
                    return True

            url = f'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol={symbol}&outputsize=full&apikey={api_key}'
            response = requests.get(url, timeout=15)
            data = response.json()

            if 'Error Message' in data or 'Note' in data:
                raise Exception(data.get('Error Message') or data.get('Note'))

            time_series_key = 'Time Series (Daily)'
            if time_series_key not in data:
                raise Exception('Unexpected response format')

            time_series = data[time_series_key]

            with transaction.atomic():
                for date_str, values in time_series.items():
                    date = datetime.strptime(date_str, '%Y-%m-%d').date()

                    DailyStockPrice.objects.using('daily').update_or_create(
                        stock=stock,
                        date=date,
                        defaults={
                            'open_price': values['1. open'],
                            'high_price': values['2. high'],
                            'low_price': values['3. low'],
                            'close_price': values.get('5. adjusted close', values['4. close']),
                            'volume': values.get('6. volume', values.get('5. volume'))
                        }
                    )
                stock.save(using='daily')

            return True

        except Exception as e:
            return False

    def fetch_intraday(self, symbol, api_key, force):
        """Fetch intraday data for a symbol."""
        try:
            stock, created = IntradayStock.objects.using('intraday').get_or_create(
                symbol=symbol,
                defaults={'name': all_fortune_500.get(symbol, symbol)}
            )

            if not force and not created:
                time_diff = timezone.now() - stock.last_updated
                if time_diff < timedelta(minutes=30):
                    return True

            url = f'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol={symbol}&interval=5min&apikey={api_key}'
            response = requests.get(url, timeout=15)
            data = response.json()

            if 'Error Message' in data or 'Note' in data:
                raise Exception(data.get('Error Message') or data.get('Note'))

            time_series_key = 'Time Series (5min)'
            if time_series_key not in data:
                raise Exception('Unexpected response format')

            time_series = data[time_series_key]

            with transaction.atomic():
                for timestamp_str, values in time_series.items():
                    timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')

                    IntradayStockPrice.objects.using('intraday').update_or_create(
                        stock=stock,
                        timestamp=timestamp,
                        defaults={
                            'open_price': values['1. open'],
                            'high_price': values['2. high'],
                            'low_price': values['3. low'],
                            'close_price': values['4. close'],
                            'volume': values['5. volume']
                        }
                    )
                stock.save(using='intraday')

            return True

        except Exception as e:
            return False
