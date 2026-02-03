from django.core.management.base import BaseCommand
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Fetch ALL S&P 500 stock data: weekly, daily, and intraday'

    def add_arguments(self, parser):
        parser.add_argument(
            '--delay',
            type=int,
            help='Delay in seconds between API calls (default: 1 for premium)',
            default=1
        )
        parser.add_argument(
            '--weekly-only',
            action='store_true',
            help='Fetch only weekly data'
        )
        parser.add_argument(
            '--daily-only',
            action='store_true',
            help='Fetch only daily data'
        )
        parser.add_argument(
            '--intraday-only',
            action='store_true',
            help='Fetch only intraday data'
        )

    def handle(self, *args, **options):
        delay = options['delay']
        weekly_only = options['weekly_only']
        daily_only = options['daily_only']
        intraday_only = options['intraday_only']

        # If no specific option, fetch all
        fetch_all = not (weekly_only or daily_only or intraday_only)

        self.stdout.write(self.style.WARNING(f'Using {delay}s delay between API calls'))
        self.stdout.write('')

        if fetch_all or weekly_only:
            self.stdout.write(self.style.WARNING('=' * 50))
            self.stdout.write(self.style.WARNING('FETCHING WEEKLY DATA FOR ALL S&P 500 STOCKS'))
            self.stdout.write(self.style.WARNING('=' * 50))
            call_command('fetch_weekly_stocks', all=True, force=True, delay=delay)

        if fetch_all or daily_only:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING('=' * 50))
            self.stdout.write(self.style.WARNING('FETCHING DAILY DATA FOR ALL S&P 500 STOCKS'))
            self.stdout.write(self.style.WARNING('=' * 50))
            call_command('fetch_daily_stocks', all=True, force=True, delay=delay)

        if fetch_all or intraday_only:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING('=' * 50))
            self.stdout.write(self.style.WARNING('FETCHING INTRADAY DATA FOR ALL S&P 500 STOCKS'))
            self.stdout.write(self.style.WARNING('=' * 50))
            call_command('fetch_intraday_stocks', all=True, force=True, delay=delay)

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write(self.style.SUCCESS('ALL DONE!'))
        self.stdout.write(self.style.SUCCESS('=' * 50))
