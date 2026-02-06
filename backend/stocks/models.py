from django.db import models
from django.utils import timezone


class Stock(models.Model):
    """Model for storing stock information"""
    symbol = models.CharField(max_length=10, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    industry = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    sector = models.CharField(max_length=100, blank=True, null=True)
    is_sp500 = models.BooleanField(default=False, db_index=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['symbol']

    def __str__(self):
        return f"{self.symbol} - {self.name}"


class StockPrice(models.Model):
    """Model for storing raw stock prices (OHLCV data)"""
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='prices')
    date = models.DateField(db_index=True)
    open_price = models.DecimalField(max_digits=10, decimal_places=2)
    high_price = models.DecimalField(max_digits=10, decimal_places=2)
    low_price = models.DecimalField(max_digits=10, decimal_places=2)
    close_price = models.DecimalField(max_digits=10, decimal_places=2)
    volume = models.BigIntegerField()

    class Meta:
        ordering = ['-date']
        unique_together = ['stock', 'date']
        indexes = [
            models.Index(fields=['stock', '-date']),
        ]

    def __str__(self):
        return f"{self.stock.symbol} - {self.date}"


class StockSplit(models.Model):
    """Model for storing stock split information"""
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='splits')
    split_date = models.DateField(db_index=True)
    split_ratio = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        help_text="Split ratio (e.g., 2.0 for 2-for-1 split, 0.5 for 1-for-2 reverse split)"
    )
    description = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-split_date']
        unique_together = ['stock', 'split_date']
        indexes = [
            models.Index(fields=['stock', '-split_date']),
        ]

    def __str__(self):
        return f"{self.stock.symbol} - {self.split_date} ({self.split_ratio}:1)"


class AdjustedStockPrice(models.Model):
    """Model for storing stock prices adjusted for splits"""
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='adjusted_prices')
    date = models.DateField(db_index=True)
    adjusted_open = models.DecimalField(max_digits=10, decimal_places=4)
    adjusted_high = models.DecimalField(max_digits=10, decimal_places=4)
    adjusted_low = models.DecimalField(max_digits=10, decimal_places=4)
    adjusted_close = models.DecimalField(max_digits=10, decimal_places=4)
    adjusted_volume = models.BigIntegerField()
    split_coefficient = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        default=1.0,
        help_text="Cumulative split adjustment coefficient"
    )

    class Meta:
        ordering = ['-date']
        unique_together = ['stock', 'date']
        indexes = [
            models.Index(fields=['stock', '-date']),
        ]

    def __str__(self):
        return f"{self.stock.symbol} - {self.date} (Adjusted)"


class APICallLog(models.Model):
    """Model for logging API calls"""
    symbol = models.CharField(max_length=10, db_index=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.symbol} - {self.timestamp}"


# Daily Stock Data Models (stored in 'daily' database)
class DailyStock(models.Model):
    """Model for storing stock information for daily data"""
    symbol = models.CharField(max_length=10, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    industry = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    sector = models.CharField(max_length=100, blank=True, null=True)
    is_sp500 = models.BooleanField(default=False, db_index=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['symbol']

    def __str__(self):
        return f"{self.symbol} - {self.name}"


class DailyStockPrice(models.Model):
    """Model for storing daily stock prices (OHLCV data)"""
    stock = models.ForeignKey(DailyStock, on_delete=models.CASCADE, related_name='daily_prices')
    date = models.DateField(db_index=True)
    open_price = models.DecimalField(max_digits=10, decimal_places=2)
    high_price = models.DecimalField(max_digits=10, decimal_places=2)
    low_price = models.DecimalField(max_digits=10, decimal_places=2)
    close_price = models.DecimalField(max_digits=10, decimal_places=2)
    volume = models.BigIntegerField()

    class Meta:
        ordering = ['-date']
        unique_together = ['stock', 'date']
        indexes = [
            models.Index(fields=['stock', '-date']),
        ]

    def __str__(self):
        return f"{self.stock.symbol} - {self.date}"


class StockOverview(models.Model):
    """Model for storing company overview data from Alpha Vantage"""
    stock = models.OneToOneField(Stock, on_delete=models.CASCADE, related_name='overview')

    # Company Info
    asset_type = models.CharField(max_length=50, blank=True)
    exchange = models.CharField(max_length=50, blank=True)
    currency = models.CharField(max_length=10, blank=True)
    country = models.CharField(max_length=50, blank=True)
    sector = models.CharField(max_length=100, blank=True)
    industry = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    address = models.CharField(max_length=200, blank=True)
    official_site = models.URLField(max_length=200, blank=True)
    cik = models.CharField(max_length=20, blank=True)  # SEC Central Index Key
    fiscal_year_end = models.CharField(max_length=20, blank=True)
    latest_quarter = models.DateField(null=True, blank=True)

    # Key Metrics (all nullable for missing data)
    market_capitalization = models.BigIntegerField(null=True, blank=True)
    ebitda = models.BigIntegerField(null=True, blank=True)
    pe_ratio = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    peg_ratio = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    book_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    dividend_per_share = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    dividend_yield = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    eps = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    diluted_eps_ttm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # Financial Metrics
    revenue_per_share_ttm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    profit_margin = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    operating_margin_ttm = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    return_on_assets_ttm = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    return_on_equity_ttm = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    revenue_ttm = models.BigIntegerField(null=True, blank=True)
    gross_profit_ttm = models.BigIntegerField(null=True, blank=True)

    # Growth & Analyst Data
    quarterly_earnings_growth_yoy = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    quarterly_revenue_growth_yoy = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    analyst_target_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    analyst_rating_strong_buy = models.IntegerField(null=True, blank=True)
    analyst_rating_buy = models.IntegerField(null=True, blank=True)
    analyst_rating_hold = models.IntegerField(null=True, blank=True)
    analyst_rating_sell = models.IntegerField(null=True, blank=True)
    analyst_rating_strong_sell = models.IntegerField(null=True, blank=True)
    trailing_pe = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    forward_pe = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # Trading Metrics
    price_to_sales_ratio_ttm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    price_to_book_ratio = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    ev_to_revenue = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    ev_to_ebitda = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    beta = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    week_52_high = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    week_52_low = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    day_50_moving_average = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    day_200_moving_average = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # Share Data
    shares_outstanding = models.BigIntegerField(null=True, blank=True)
    shares_float = models.BigIntegerField(null=True, blank=True)
    percent_insiders = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    percent_institutions = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)

    # Dividend Dates
    dividend_date = models.DateField(null=True, blank=True)
    ex_dividend_date = models.DateField(null=True, blank=True)

    # Metadata
    last_updated = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-last_updated']

    def __str__(self):
        return f"{self.stock.symbol} - Overview"


# Intraday Stock Data Models (stored in 'intraday' database)
class IntradayStock(models.Model):
    """Model for storing stock information for intraday data"""
    symbol = models.CharField(max_length=10, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    industry = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    sector = models.CharField(max_length=100, blank=True, null=True)
    is_sp500 = models.BooleanField(default=False, db_index=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['symbol']

    def __str__(self):
        return f"{self.symbol} - {self.name}"


class IntradayStockPrice(models.Model):
    """Model for storing intraday stock prices (OHLCV data with timestamps)"""
    stock = models.ForeignKey(IntradayStock, on_delete=models.CASCADE, related_name='intraday_prices')
    timestamp = models.DateTimeField(db_index=True)  # Full datetime for intraday data
    open_price = models.DecimalField(max_digits=10, decimal_places=4)
    high_price = models.DecimalField(max_digits=10, decimal_places=4)
    low_price = models.DecimalField(max_digits=10, decimal_places=4)
    close_price = models.DecimalField(max_digits=10, decimal_places=4)
    volume = models.BigIntegerField()

    class Meta:
        ordering = ['-timestamp']
        unique_together = ['stock', 'timestamp']
        indexes = [
            models.Index(fields=['stock', '-timestamp']),
            models.Index(fields=['timestamp']),  # For filtering by date range
        ]

    def __str__(self):
        return f"{self.stock.symbol} - {self.timestamp}"


class StockPerformance(models.Model):
    """Precomputed stock performance metrics for each time period"""
    PERIOD_CHOICES = [
        ('1D', '1 Day'),
        ('1W', '1 Week'),
        ('1M', '1 Month'),
        ('YTD', 'Year to Date'),
        ('6M', '6 Months'),
        ('1Y', '1 Year'),
        ('5Y', '5 Years'),
    ]

    symbol = models.CharField(max_length=10, db_index=True)
    name = models.CharField(max_length=100)
    period = models.CharField(max_length=5, choices=PERIOD_CHOICES)
    start_price = models.DecimalField(max_digits=12, decimal_places=2)
    end_price = models.DecimalField(max_digits=12, decimal_places=2)
    price_change = models.DecimalField(max_digits=12, decimal_places=2)
    percent_change = models.DecimalField(max_digits=10, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField()
    data_source = models.CharField(max_length=10, default='weekly')  # 'daily' or 'weekly'
    computed_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['symbol', 'period']
        indexes = [
            models.Index(fields=['period', '-percent_change']),  # For top gainers
            models.Index(fields=['period', 'percent_change']),   # For top losers
        ]

    def __str__(self):
        return f"{self.symbol} {self.period}: {self.percent_change}%"