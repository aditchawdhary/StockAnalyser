from django.contrib import admin
from .models import Stock, StockPrice, APICallLog


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ['symbol', 'name', 'last_updated']
    search_fields = ['symbol', 'name']


@admin.register(StockPrice)
class StockPriceAdmin(admin.ModelAdmin):
    list_display = ['stock', 'date', 'close_price', 'volume']
    list_filter = ['stock', 'date']
    search_fields = ['stock__symbol']
    date_hierarchy = 'date'


@admin.register(APICallLog)
class APICallLogAdmin(admin.ModelAdmin):
    list_display = ['symbol', 'timestamp', 'success', 'error_message']
    list_filter = ['success', 'timestamp']
    search_fields = ['symbol']