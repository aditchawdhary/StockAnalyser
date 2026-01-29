from django.db import models
from django.utils import timezone

class Stock(models.Model):
    symbol = models.CharField(max_length=10, unique=True, db_index=True)
    name = models.CharField(max_length=100)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['symbol']
    
    def __str__(self):
        return f"{self.symbol} - {self.name}"


class StockPrice(models.Model):
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


class APICallLog(models.Model):
    symbol = models.CharField(max_length=10, db_index=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True, null=True)
    
    class Meta:
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.symbol} - {self.timestamp}"