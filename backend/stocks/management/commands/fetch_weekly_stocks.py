from django.core.management.base import BaseCommand
from django.utils import timezone
from stocks.models import Stock, StockPrice, APICallLog
import requests
import os
from datetime import datetime, timedelta
from .fortune500 import all_fortune_500
import time

class Command(BaseCommand):
    help = 'Fetch stock data from Alpha Vantage API and store in database'

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
            symbols = list(all_fortune_500.keys())
            self.stdout.write(self.style.WARNING(f'Fetching {len(symbols)} stocks with {delay}s delay between calls...'))

        for index, symbol in enumerate(symbols, 1):
            symbol = symbol.strip().upper()
            
            try:
                # Check if we need to update
                stock, created = Stock.objects.get_or_create(
                    symbol=symbol,
                    defaults={'name': all_fortune_500.get(symbol, symbol)}  # Use all_fortune_500 here!
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
                
                self.stdout.write(f'[{index}/{len(symbols)}] Fetching {symbol}...')
                
                # Fetch from API
                url = f'https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol={symbol}&apikey={api_key}'
                response = requests.get(url, timeout=10)
                data = response.json()
                
                # Check for errors
                if 'Error Message' in data:
                    raise Exception(f'Invalid symbol: {symbol}')
                
                if 'Note' in data:
                    raise Exception('API rate limit reached')
                
                # Check for both possible key names (adjusted and non-adjusted)
                time_series_key = None
                if 'Weekly Adjusted Time Series' in data:
                    time_series_key = 'Weekly Adjusted Time Series'
                elif 'Weekly Time Series' in data:
                    time_series_key = 'Weekly Time Series'
                else:
                    raise Exception('Unexpected API response format')

                # Parse and store data
                time_series = data[time_series_key]
                prices_created = 0
                prices_updated = 0
                
                for date_str, values in time_series.items():
                    date = datetime.strptime(date_str, '%Y-%m-%d').date()

                    # Handle both regular and adjusted time series formats
                    volume = values.get('6. volume') or values.get('5. volume')
                    close_price = values.get('5. adjusted close') or values.get('4. close')

                    price, created = StockPrice.objects.update_or_create(
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
                    
                    if created:
                        prices_created += 1
                    else:
                        prices_updated += 1
                
                # Update last_updated timestamp
                stock.save()
                
                # Log success
                APICallLog.objects.create(
                    symbol=symbol,
                    success=True
                )
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'[{index}/{len(symbols)}] {symbol}: ✓ Created {prices_created}, Updated {prices_updated} price records'
                    )
                )
                
                # Add delay between calls
                if index < len(symbols):
                    self.stdout.write(f'Waiting {delay}s before next call...')
                    time.sleep(delay)
                
            except Exception as e:
                # Log error
                APICallLog.objects.create(
                    symbol=symbol,
                    success=False,
                    error_message=str(e)
                )
                
                self.stdout.write(
                    self.style.ERROR(f'[{index}/{len(symbols)}] {symbol}: ✗ {str(e)}')
                )
                
                # Add delay even on error
                if index < len(symbols):
                    time.sleep(delay)
        
        self.stdout.write(self.style.SUCCESS('\nDone!'))