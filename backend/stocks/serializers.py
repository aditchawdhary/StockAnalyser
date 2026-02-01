from rest_framework import serializers
from .models import Stock, StockPrice, StockSplit, AdjustedStockPrice


class StockPriceSerializer(serializers.ModelSerializer):
    """Serializer for raw stock prices"""
    class Meta:
        model = StockPrice
        fields = ['date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume']


class AdjustedStockPriceSerializer(serializers.ModelSerializer):
    """Serializer for split-adjusted stock prices"""
    class Meta:
        model = AdjustedStockPrice
        fields = [
            'date',
            'adjusted_open',
            'adjusted_high',
            'adjusted_low',
            'adjusted_close',
            'adjusted_volume',
            'split_coefficient'
        ]


class StockSplitSerializer(serializers.ModelSerializer):
    """Serializer for stock split information"""
    class Meta:
        model = StockSplit
        fields = ['split_date', 'split_ratio', 'description', 'created_at']


class StockSerializer(serializers.ModelSerializer):
    """Serializer for stock information"""
    prices = StockPriceSerializer(many=True, read_only=True)
    adjusted_prices = AdjustedStockPriceSerializer(many=True, read_only=True)
    splits = StockSplitSerializer(many=True, read_only=True)

    class Meta:
        model = Stock
        fields = [
            'symbol',
            'name',
            'industry',
            'sector',
            'is_sp500',
            'last_updated',
            'prices',
            'adjusted_prices',
            'splits'
        ]


class StockListSerializer(serializers.ModelSerializer):
    """Simplified serializer for stock lists (without price data)"""
    class Meta:
        model = Stock
        fields = ['symbol', 'name', 'industry', 'sector', 'is_sp500', 'last_updated']