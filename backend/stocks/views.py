from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Stock, StockPrice
from datetime import datetime, timedelta
from django.db.models import Count, Max, Min

@api_view(['GET'])
def get_stock_data(request, symbol):
    """Get weekly stock data for a single symbol from database"""
    
    try:
        stock = Stock.objects.prefetch_related('prices').get(symbol=symbol.upper())
        
        # Get last 52 weeks of data
        one_year_ago = datetime.now().date() - timedelta(weeks=52)
        prices = stock.prices.filter(date__gte=one_year_ago)
        
        # Format response similar to Alpha Vantage API
        weekly_data = {}
        for price in prices:
            weekly_data[str(price.date)] = {
                '1. open': str(price.open_price),
                '2. high': str(price.high_price),
                '3. low': str(price.low_price),
                '4. close': str(price.close_price),
                '5. volume': str(price.volume)
            }
        
        response_data = {
            'Meta Data': {
                '1. Information': 'Weekly Prices (from database)',
                '2. Symbol': stock.symbol,
                '3. Last Refreshed': str(stock.last_updated),
            },
            'Weekly Time Series': weekly_data
        }
        
        return Response(response_data)
        
    except Stock.DoesNotExist:
        return Response(
            {'error': f'Stock {symbol} not found in database. Please run: python manage.py fetch_stocks'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
def get_multiple_stocks(request):
    """Get weekly stock data for multiple symbols from database"""
    
    symbols = request.GET.get('symbols', '').split(',')
    symbols = [s.strip().upper() for s in symbols if s.strip()]
    
    if not symbols:
        return Response(
            {'error': 'No symbols provided'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    results = {}
    errors = []
    
    one_year_ago = datetime.now().date() - timedelta(weeks=52)
    
    for symbol in symbols:
        try:
            stock = Stock.objects.prefetch_related('prices').get(symbol=symbol)
            prices = stock.prices.filter(date__gte=one_year_ago)
            
            weekly_data = {}
            for price in prices:
                weekly_data[str(price.date)] = {
                    '1. open': str(price.open_price),
                    '2. high': str(price.high_price),
                    '3. low': str(price.low_price),
                    '4. close': str(price.close_price),
                    '5. volume': str(price.volume)
                }
            
            results[symbol] = {
                'Meta Data': {
                    '1. Information': 'Weekly Prices (from database)',
                    '2. Symbol': stock.symbol,
                    '3. Last Refreshed': str(stock.last_updated),
                },
                'Weekly Time Series': weekly_data
            }
            
        except Stock.DoesNotExist:
            errors.append(f'{symbol}: Not found in database')
    
    return Response({
        'data': results,
        'errors': errors
    })


@api_view(['GET'])
def get_all_stocks_list(request):
    """Get list of all available stocks (NEW)"""
    
    stocks = Stock.objects.all().values('symbol', 'name', 'last_updated').order_by('symbol')
    
    return Response({
        'count': len(stocks),
        'stocks': list(stocks)
    })


@api_view(['GET'])
def get_stock_summary(request):
    """Get summary data for all stocks with latest price and change (NEW)"""
    
    stocks = Stock.objects.prefetch_related('prices').all()
    summary = []
    
    for stock in stocks:
        # Get last two prices to calculate change
        recent_prices = stock.prices.order_by('-date')[:2]
        
        if recent_prices:
            latest = recent_prices[0]
            
            # Calculate change
            change = None
            change_percent = None
            if len(recent_prices) > 1:
                previous = recent_prices[1]
                change = float(latest.close_price) - float(previous.close_price)
                change_percent = (change / float(previous.close_price)) * 100
            
            summary.append({
                'symbol': stock.symbol,
                'name': stock.name,
                'latest_date': str(latest.date),
                'close_price': str(latest.close_price),
                'change': round(change, 2) if change else None,
                'change_percent': round(change_percent, 2) if change_percent else None,
                'last_updated': str(stock.last_updated)
            })
    
    return Response({
        'count': len(summary),
        'stocks': summary
    })


@api_view(['GET'])
def refresh_stocks(request):
    """Trigger a manual refresh of stock data"""
    from django.core.management import call_command
    from io import StringIO
    
    symbols = request.GET.get('symbols', '')
    force = request.GET.get('force', 'false').lower() == 'true'
    fetch_all = request.GET.get('all', 'false').lower() == 'true'
    
    # Capture command output
    out = StringIO()
    
    try:
        if fetch_all:
            call_command('fetch_stocks', all=True, force=force, stdout=out)
        elif symbols:
            call_command('fetch_stocks', symbols=symbols, force=force, stdout=out)
        else:
            call_command('fetch_stocks', force=force, stdout=out)
            
        return Response({
            'message': 'Stock data refresh initiated',
            'output': out.getvalue()
        })
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def stock_stats(request):
    """Get statistics about stored stock data"""
    
    stocks = Stock.objects.annotate(
        price_count=Count('prices'),
        latest_date=Max('prices__date'),
        oldest_date=Min('prices__date')
    ).values('symbol', 'name', 'last_updated', 'price_count', 'latest_date', 'oldest_date')
    
    return Response({
        'total_stocks': Stock.objects.count(),
        'total_prices': StockPrice.objects.count(),
        'stocks': list(stocks)
    })


@api_view(['GET'])
def get_stock_performance(request):
    """Get top winners and losers for different time periods"""
    from django.db.models import Q
    from datetime import datetime, timedelta
    
    # Define time periods
    now = datetime.now().date()
    one_month_ago = now - timedelta(days=30)
    six_months_ago = now - timedelta(days=180)
    one_year_ago = now - timedelta(days=365)
    start_of_year = datetime(now.year, 1, 1).date()
    
    time_periods = {
        '1M': one_month_ago,
        'YTD': start_of_year,
        '6M': six_months_ago,
        '1Y': one_year_ago
    }
    
    results = {}
    
    for period_name, start_date in time_periods.items():
        stocks_performance = []
        
        stocks = Stock.objects.all()
        
        for stock in stocks:
            # Get prices at start and end of period
            start_price = stock.prices.filter(date__gte=start_date).order_by('date').first()
            end_price = stock.prices.order_by('-date').first()
            
            if start_price and end_price and start_price != end_price:
                price_change = float(end_price.close_price) - float(start_price.close_price)
                percent_change = (price_change / float(start_price.close_price)) * 100
                
                stocks_performance.append({
                    'symbol': stock.symbol,
                    'name': stock.name,
                    'start_price': float(start_price.close_price),
                    'end_price': float(end_price.close_price),
                    'price_change': round(price_change, 2),
                    'percent_change': round(percent_change, 2),
                    'start_date': str(start_price.date),
                    'end_date': str(end_price.date)
                })
        
        # Sort by percent change
        stocks_performance.sort(key=lambda x: x['percent_change'], reverse=True)
        
        results[period_name] = {
            'top_gainers': stocks_performance[:10],
            'top_losers': stocks_performance[-10:][::-1]  # Reverse to show worst first
        }
    
    return Response(results)