from django.core.management.base import BaseCommand
from django.utils import timezone
from stocks.models import IntradayStock, IntradayStockPrice
import requests
import os
from datetime import datetime, timedelta
from stocks.management.commands.fortune500 import all_5k_stocks
import time
import pytz
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading


class Command(BaseCommand):
    help = 'Fetch intraday stock data from Alpha Vantage API and store in intraday database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--symbols',
            type=str,
            help='Comma-separated list of stock symbols',
            default='META,AAPL,AMZN,NFLX,NVDA,MSFT,INTU,AMD'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force refresh even if recently updated'
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Fetch all stock prices',
            default=False
        )
        parser.add_argument(
            '--delay',
            type=int,
            help='Delay in seconds between batches (default: 15)',
            default=15
        )
        parser.add_argument(
            '--workers',
            type=int,
            help='Number of parallel workers (default: 4)',
            default=4
        )
        parser.add_argument(
            '--interval',
            type=str,
            help='Time interval: 1min, 5min, 15min, 30min, 60min (default: 5min)',
            default='5min'
        )
        parser.add_argument(
            '--outputsize',
            type=str,
            help='Output size: compact (100 points) or full (30 days). Default: full',
            default='full'
        )
        parser.add_argument(
            '--month',
            type=str,
            help='Specific month to fetch (YYYY-MM format). If not set, fetches recent 30 days',
            default=None
        )
        parser.add_argument(
            '--extended-hours',
            action='store_true',
            help='Include extended trading hours (pre-market and post-market)',
            default=True
        )

    def fetch_symbol(self, symbol, interval, outputsize, month, extended_hours, api_key, force, eastern):
        """Fetch intraday data for a single symbol. Thread-safe."""
        symbol = symbol.strip().upper()
        result = {'symbol': symbol, 'success': False, 'created': 0, 'updated': 0, 'error': None}

        try:
            # Check if we need to update
            stock, created = IntradayStock.objects.using('intraday').get_or_create(
                symbol=symbol,
                defaults={'name': all_5k_stocks.get(symbol, symbol)}
            )

            # Skip if updated in last 15 minutes and not forced
            if not force and not created:
                time_diff = timezone.now() - stock.last_updated
                if time_diff < timedelta(minutes=15):
                    result['error'] = f'Skipped (updated {time_diff.seconds // 60} minutes ago)'
                    result['skipped'] = True
                    return result

            # Build API URL
            url = f'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol={symbol}&interval={interval}&outputsize={outputsize}&adjusted=true&extended_hours={str(extended_hours).lower()}&apikey={api_key}'

            if month:
                url += f'&month={month}'

            response = requests.get(url, timeout=60)
            data = response.json()

            # Check for errors
            if 'Error Message' in data:
                raise Exception(f'Invalid symbol')

            if 'Note' in data:
                raise Exception('API rate limit reached')

            if 'Information' in data:
                raise Exception(f'API Info: {data["Information"]}')

            # Check for the time series key
            time_series_key = f'Time Series ({interval})'
            if time_series_key not in data:
                raise Exception('Unexpected API response format')

            # Parse and store data
            time_series = data[time_series_key]
            prices_created = 0
            prices_updated = 0

            for timestamp_str, values in time_series.items():
                try:
                    naive_dt = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                    aware_dt = eastern.localize(naive_dt)
                    utc_dt = aware_dt.astimezone(pytz.UTC)
                except ValueError:
                    continue

                price, was_created = IntradayStockPrice.objects.using('intraday').update_or_create(
                    stock=stock,
                    timestamp=utc_dt,
                    defaults={
                        'open_price': values['1. open'],
                        'high_price': values['2. high'],
                        'low_price': values['3. low'],
                        'close_price': values['4. close'],
                        'volume': values['5. volume']
                    }
                )

                if was_created:
                    prices_created += 1
                else:
                    prices_updated += 1

            # Update last_updated timestamp
            stock.save(using='intraday')

            result['success'] = True
            result['created'] = prices_created
            result['updated'] = prices_updated

        except Exception as e:
            result['error'] = str(e)

        return result

    def handle(self, *args, **options):
        symbols = options['symbols'].split(',')
        force = options['force']
        fetch_all = options['all']
        delay = options['delay']
        workers = options['workers']
        interval = options['interval']
        outputsize = options['outputsize']
        month = options['month']
        extended_hours = options['extended_hours']
        api_key = os.getenv('ALPHA_VANTAGE_API_KEY')

        if not api_key:
            self.stdout.write(self.style.ERROR('ALPHA_VANTAGE_API_KEY not found in environment'))
            return

        # Validate interval
        valid_intervals = ['1min', '5min', '15min', '30min', '60min']
        if interval not in valid_intervals:
            self.stdout.write(self.style.ERROR(f'Invalid interval. Must be one of: {valid_intervals}'))
            return

        if fetch_all:
            symbols = list(all_5k_stocks.keys())

        total = len(symbols)
        self.stdout.write(self.style.WARNING(
            f'Fetching {total} stocks with {workers} parallel workers, {delay}s delay between batches...'
        ))

        # US Eastern timezone for parsing timestamps
        eastern = pytz.timezone('US/Eastern')

        # Process in batches
        completed = 0
        success_count = 0
        error_count = 0
        skip_count = 0

        for batch_start in range(0, total, workers):
            batch_end = min(batch_start + workers, total)
            batch_symbols = symbols[batch_start:batch_end]
            batch_num = (batch_start // workers) + 1
            total_batches = (total + workers - 1) // workers

            self.stdout.write(f'\n[Batch {batch_num}/{total_batches}] Processing {", ".join(batch_symbols)}...')

            # Process batch in parallel
            with ThreadPoolExecutor(max_workers=workers) as executor:
                futures = {
                    executor.submit(
                        self.fetch_symbol,
                        sym, interval, outputsize, month, extended_hours, api_key, force, eastern
                    ): sym for sym in batch_symbols
                }

                for future in as_completed(futures):
                    result = future.result()
                    completed += 1
                    symbol = result['symbol']

                    if result.get('skipped'):
                        skip_count += 1
                        self.stdout.write(
                            self.style.WARNING(f'  [{completed}/{total}] {symbol}: {result["error"]}')
                        )
                    elif result['success']:
                        success_count += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'  [{completed}/{total}] {symbol}: ✓ Created {result["created"]}, Updated {result["updated"]}'
                            )
                        )
                    else:
                        error_count += 1
                        self.stdout.write(
                            self.style.ERROR(f'  [{completed}/{total}] {symbol}: ✗ {result["error"]}')
                        )

            # Delay between batches (not after the last one)
            if batch_end < total:
                self.stdout.write(f'Waiting {delay}s before next batch...')
                time.sleep(delay)

        self.stdout.write(self.style.SUCCESS(
            f'\nDone! Success: {success_count}, Errors: {error_count}, Skipped: {skip_count}'
        ))
