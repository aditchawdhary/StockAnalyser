from django.contrib import admin
from .models import Stock, StockPrice, StockSplit, AdjustedStockPrice, APICallLog


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ['symbol', 'name', 'industry', 'sector', 'is_sp500', 'last_updated']
    list_filter = ['is_sp500', 'industry', 'sector']
    search_fields = ['symbol', 'name', 'industry']
    list_editable = ['is_sp500']


@admin.register(StockPrice)
class StockPriceAdmin(admin.ModelAdmin):
    list_display = ['stock', 'date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume']
    list_filter = ['stock', 'date']
    search_fields = ['stock__symbol']
    date_hierarchy = 'date'
    ordering = ['-date']


@admin.register(StockSplit)
class StockSplitAdmin(admin.ModelAdmin):
    list_display = ['stock', 'split_date', 'split_ratio', 'description', 'created_at']
    list_filter = ['split_date', 'stock']
    search_fields = ['stock__symbol', 'description']
    date_hierarchy = 'split_date'
    ordering = ['-split_date']


@admin.register(AdjustedStockPrice)
class AdjustedStockPriceAdmin(admin.ModelAdmin):
    list_display = ['stock', 'date', 'adjusted_close', 'adjusted_volume', 'split_coefficient']
    list_filter = ['stock', 'date']
    search_fields = ['stock__symbol']
    date_hierarchy = 'date'
    ordering = ['-date']


@admin.register(APICallLog)
class APICallLogAdmin(admin.ModelAdmin):
    list_display = ['symbol', 'timestamp', 'success', 'error_message']
    list_filter = ['success', 'timestamp']
    search_fields = ['symbol']
    date_hierarchy = 'timestamp'