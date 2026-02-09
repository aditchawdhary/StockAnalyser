import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

from django.core.management.base import BaseCommand
from stocks.models import Stock


class Command(BaseCommand):
    help = 'Download stock logos from Parqet and store them in the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--symbols', type=str, default='',
            help='Comma-separated list of symbols (default: all stocks)'
        )
        parser.add_argument(
            '--force', action='store_true',
            help='Re-download logos even if they already exist'
        )
        parser.add_argument(
            '--workers', type=int, default=10,
            help='Number of concurrent download threads (default: 10)'
        )

    def download_logo(self, stock, force):
        """Download a single logo. Returns (symbol, success, message)."""
        if stock.logo and not force:
            return (stock.symbol, True, 'skipped')

        url = f'https://assets.parqet.com/logos/symbol/{stock.symbol}'
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                content_type = response.headers.get('content-type', 'image/png')
                stock.logo = response.content
                stock.logo_content_type = content_type
                stock.save(update_fields=['logo', 'logo_content_type'])
                return (stock.symbol, True, f'downloaded ({len(response.content)} bytes)')
            else:
                return (stock.symbol, False, f'HTTP {response.status_code}')
        except Exception as e:
            return (stock.symbol, False, str(e))

    def handle(self, *args, **options):
        symbols_arg = options['symbols']
        force = options['force']
        workers = options['workers']

        if symbols_arg:
            symbols = [s.strip().upper() for s in symbols_arg.split(',')]
            stocks = list(Stock.objects.filter(symbol__in=symbols))
        else:
            if force:
                stocks = list(Stock.objects.all())
            else:
                stocks = list(Stock.objects.filter(logo__isnull=True))

        total = len(stocks)
        if total == 0:
            self.stdout.write(self.style.SUCCESS('All stocks already have logos.'))
            return

        self.stdout.write(f'Downloading logos for {total} stocks with {workers} workers...')

        success_count = 0
        fail_count = 0
        skip_count = 0

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(self.download_logo, stock, force): stock
                for stock in stocks
            }
            for i, future in enumerate(as_completed(futures), 1):
                symbol, success, message = future.result()
                if message == 'skipped':
                    skip_count += 1
                elif success:
                    success_count += 1
                else:
                    fail_count += 1
                    self.stdout.write(self.style.ERROR(f'[{i}/{total}] {symbol}: {message}'))

                if i % 100 == 0:
                    self.stdout.write(f'  Progress: {i}/{total}...')

        self.stdout.write(self.style.SUCCESS(
            f'Done! Downloaded: {success_count}, Skipped: {skip_count}, Failed: {fail_count}'
        ))
