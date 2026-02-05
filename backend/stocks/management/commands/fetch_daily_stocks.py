from django.core.management.base import BaseCommand
from django.utils import timezone
from stocks.models import DailyStock, DailyStockPrice
import requests
import os
from datetime import datetime, timedelta
from stocks.management.commands.top5kcompanies import all_5k_stocks
import time

class Command(BaseCommand):
    help = 'Fetch daily stock data from Alpha Vantage API and store in daily database'

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
            help='Delay in seconds between API calls (default: 12)',
            default=12
        )

    def handle(self, *args, **options):
        symbols = options['symbols'].split(',')
        force = options['force']
        fetch_all = options['all']
        delay = options['delay']
        api_key = os.getenv('ALPHA_VANTAGE_API_KEY')

        if not api_key:
            self.stdout.write(self.style.ERROR('ALPHA_VANTAGE_API_KEY not found in environment'))
            return

        if fetch_all:
            symbols = list(all_5k_stocks.keys())
            self.stdout.write(self.style.WARNING(f'Fetching {len(symbols)} stocks with {delay}s delay between calls...'))

        for index, symbol in enumerate(symbols, 1):
            symbol = symbol.strip().upper()

            try:
                # Check if we need to update
                stock, created = DailyStock.objects.using('daily').get_or_create(
                    symbol=symbol,
                    defaults={'name': all_5k_stocks.get(symbol, symbol)}
                )

                # Skip if updated in last hour and not forced
                if not force and not created:
                    time_diff = timezone.now() - stock.last_updated
                    if time_diff < timedelta(hours=1):
                        self.stdout.write(
                            self.style.WARNING(
                                f'[{index}/{len(symbols)}] {symbol}: Skipping (updated {time_diff.seconds // 60} minutes ago)'
                            )
                        )
                        continue

                self.stdout.write(f'[{index}/{len(symbols)}] Fetching daily data for {symbol}...')

                # Fetch daily data from API
                url = f'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol={symbol}&outputsize=full&apikey={api_key}'
                response = requests.get(url, timeout=30)
                data = response.json()

                # Check for errors
                if 'Error Message' in data:
                    raise Exception(f'Invalid symbol: {symbol}')

                if 'Note' in data:
                    raise Exception('API rate limit reached')

                # Check for the time series key
                time_series_key = 'Time Series (Daily)'
                if time_series_key not in data:
                    raise Exception('Unexpected API response format')

                # Parse and store data
                time_series = data[time_series_key]
                prices_created = 0
                prices_updated = 0

                # Only store last 90 days of data to save space
                ninety_days_ago = datetime.now().date() - timedelta(days=90)

                for date_str, values in time_series.items():
                    date = datetime.strptime(date_str, '%Y-%m-%d').date()

                    # Calculate adjustment ratio for stock splits/dividends
                    # Alpha Vantage only provides adjusted close, so we derive the ratio
                    # and apply it to open/high/low for consistency
                    raw_close = float(values['4. close'])
                    adjusted_close = float(values.get('5. adjusted close', raw_close))
                    adj_ratio = adjusted_close / raw_close if raw_close != 0 else 1

                    price, created = DailyStockPrice.objects.using('daily').update_or_create(
                        stock=stock,
                        date=date,
                        defaults={
                            'open_price': float(values['1. open']) * adj_ratio,
                            'high_price': float(values['2. high']) * adj_ratio,
                            'low_price': float(values['3. low']) * adj_ratio,
                            'close_price': adjusted_close,
                            'volume': values['6. volume']
                        }
                    )

                    if created:
                        prices_created += 1
                    else:
                        prices_updated += 1

                # Update last_updated timestamp
                stock.save(using='daily')

                self.stdout.write(
                    self.style.SUCCESS(
                        f'[{index}/{len(symbols)}] {symbol}: ✓ Created {prices_created}, Updated {prices_updated} daily price records'
                    )
                )

                # Add delay between calls
                if index < len(symbols):
                    self.stdout.write(f'Waiting {delay}s before next call...')
                    time.sleep(delay)

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'[{index}/{len(symbols)}] {symbol}: ✗ {str(e)}')
                )

                # Add delay even on error
                if index < len(symbols):
                    time.sleep(delay)

        self.stdout.write(self.style.SUCCESS('\nDone!'))
