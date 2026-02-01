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