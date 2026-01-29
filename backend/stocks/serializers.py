from rest_framework import serializers
from .models import Stock, StockPrice

class StockPriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockPrice
        fields = ['date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume']

class StockSerializer(serializers.ModelSerializer):
    prices = StockPriceSerializer(many=True, read_only=True)
    
    class Meta:
        model = Stock
        fields = ['symbol', 'name', 'last_updated', 'prices']
# stocks/management/commands/fetch_stocks.py