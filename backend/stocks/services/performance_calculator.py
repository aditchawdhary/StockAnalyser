"""
Service module for computing and caching stock performance metrics.
Designed to be called after data insertion in fetch_stocks_fast.py.
"""
from datetime import datetime, timedelta
from django.db import transaction
from stocks.models import (
    Stock, StockPrice,
    DailyStock, DailyStockPrice,
    StockPerformance
)
from stocks.management.commands.fortune500 import all_fortune_500


class PerformanceCalculator:
    """
    Computes performance metrics for all stocks and stores in StockPerformance table.
    Thread-safe and designed to be called after bulk data insertion.
    """

    TIME_PERIODS = {
        '1D': {'days': 1, 'source': 'daily'},
        '1W': {'days': 7, 'source': 'daily'},
        '1M': {'days': 30, 'source': 'weekly'},
        'YTD': {'ytd': True, 'source': 'weekly'},
        '6M': {'days': 180, 'source': 'weekly'},
        '1Y': {'days': 365, 'source': 'weekly'},
        '5Y': {'days': 1825, 'source': 'weekly'},
    }

    def __init__(self, stdout=None):
        self.stdout = stdout  # For logging from management command

    def log(self, message):
        if self.stdout:
            self.stdout.write(message)

    def compute_all(self):
        """Compute performance for all periods and all stocks."""
        now = datetime.now().date()
        performances_to_create = []

        for period_name, config in self.TIME_PERIODS.items():
            start_date = self._get_start_date(now, config)
            source = config['source']

            if source == 'daily':
                performances = self._compute_daily_performance(period_name, start_date)
            else:
                performances = self._compute_weekly_performance(period_name, start_date)

            performances_to_create.extend(performances)
            self.log(f"  {period_name}: {len(performances)} stocks computed")

        # Bulk replace all performance records
        with transaction.atomic():
            StockPerformance.objects.all().delete()
            StockPerformance.objects.bulk_create(
                performances_to_create,
                batch_size=1000
            )

        return {'computed': len(performances_to_create)}

    def _get_start_date(self, now, config):
        if config.get('ytd'):
            return datetime(now.year, 1, 1).date()
        return now - timedelta(days=config['days'])

    def _compute_daily_performance(self, period_name, start_date):
        """Compute performance using daily database for Fortune 500 stocks only."""
        performances = []
        fortune_500_symbols = set(all_fortune_500.keys())

        try:
            daily_available = DailyStock.objects.using('daily').exists()
            if not daily_available:
                return performances
            # Filter to only Fortune 500 stocks
            stocks = DailyStock.objects.using('daily').filter(symbol__in=fortune_500_symbols)
        except Exception:
            return performances

        for stock in stocks:
            perf = self._calculate_stock_performance_daily(
                stock, period_name, start_date
            )
            if perf:
                performances.append(perf)

        return performances

    def _compute_weekly_performance(self, period_name, start_date):
        """Compute performance using weekly database for Fortune 500 stocks only."""
        performances = []
        fortune_500_symbols = set(all_fortune_500.keys())
        # Filter to only Fortune 500 stocks
        stocks = Stock.objects.filter(symbol__in=fortune_500_symbols)

        for stock in stocks:
            perf = self._calculate_stock_performance_weekly(
                stock, period_name, start_date
            )
            if perf:
                performances.append(perf)

        return performances

    def _calculate_stock_performance_daily(self, stock, period_name, start_date):
        """Calculate performance for a single stock using daily data."""
        if period_name == '1D':
            # Get last 2 trading days
            recent_prices = DailyStockPrice.objects.using('daily').filter(
                stock=stock
            ).order_by('-date')[:2]

            if len(recent_prices) < 2:
                return None

            end_price_obj = recent_prices[0]
            start_price_obj = recent_prices[1]
        else:
            # Get data from start_date onwards
            start_price_obj = DailyStockPrice.objects.using('daily').filter(
                stock=stock,
                date__gte=start_date
            ).order_by('date').first()

            end_price_obj = DailyStockPrice.objects.using('daily').filter(
                stock=stock
            ).order_by('-date').first()

            if not start_price_obj or not end_price_obj or start_price_obj == end_price_obj:
                return None

        return self._create_performance_record(
            stock, period_name, start_price_obj, end_price_obj, 'daily'
        )

    def _calculate_stock_performance_weekly(self, stock, period_name, start_date):
        """Calculate performance for a single stock using weekly data."""
        start_price_obj = stock.prices.filter(
            date__gte=start_date
        ).order_by('date').first()

        end_price_obj = stock.prices.order_by('-date').first()

        if not start_price_obj or not end_price_obj or start_price_obj == end_price_obj:
            return None

        return self._create_performance_record(
            stock, period_name, start_price_obj, end_price_obj, 'weekly'
        )

    def _create_performance_record(self, stock, period_name, start_price_obj, end_price_obj, source):
        """Create a StockPerformance instance from price data."""
        start_val = float(start_price_obj.close_price)
        end_val = float(end_price_obj.close_price)

        # Skip stocks with zero price (bad data)
        if start_val == 0:
            return None

        price_change = end_val - start_val
        percent_change = (price_change / start_val) * 100

        return StockPerformance(
            symbol=stock.symbol,
            name=stock.name,
            period=period_name,
            start_price=round(start_val, 2),
            end_price=round(end_val, 2),
            price_change=round(price_change, 2),
            percent_change=round(percent_change, 2),
            start_date=start_price_obj.date,
            end_date=end_price_obj.date,
            data_source=source
        )
