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


@api_view(['GET'])
def sp500_top_performers(request):
    """Get top 20 best and worst performing S&P 500 stocks"""
    from datetime import datetime, timedelta

    # Get time period from request (default to 1 year)
    period = request.GET.get('period', '1Y')

    now = datetime.now().date()
    period_map = {
        '1D': timedelta(days=1),
        '1W': timedelta(weeks=1),
        '1M': timedelta(days=30),
        'YTD': None,  # Calculated separately
        '6M': timedelta(days=180),
        '1Y': timedelta(days=365),
    }

    start_date = now - period_map.get(period, timedelta(days=365)) if period != 'YTD' else datetime(now.year, 1, 1).date()

    # Get only S&P 500 stocks
    sp500_stocks = Stock.objects.filter(is_sp500=True).prefetch_related('prices')

    stocks_performance = []

    for stock in sp500_stocks:
        # Get adjusted prices if available, otherwise raw prices
        prices_qs = stock.adjusted_prices if hasattr(stock, 'adjusted_prices') and stock.adjusted_prices.exists() else stock.prices

        start_price = prices_qs.filter(date__gte=start_date).order_by('date').first()
        end_price = prices_qs.order_by('-date').first()

        if start_price and end_price and start_price != end_price:
            # Use adjusted prices if available
            if hasattr(start_price, 'adjusted_close'):
                start_value = float(start_price.adjusted_close)
                end_value = float(end_price.adjusted_close)
            else:
                start_value = float(start_price.close_price)
                end_value = float(end_price.close_price)

            price_change = end_value - start_value
            percent_change = (price_change / start_value) * 100

            stocks_performance.append({
                'symbol': stock.symbol,
                'name': stock.name,
                'industry': stock.industry,
                'sector': stock.sector,
                'start_price': round(start_value, 2),
                'current_price': round(end_value, 2),
                'price_change': round(price_change, 2),
                'percent_change': round(percent_change, 2),
                'start_date': str(start_price.date),
                'end_date': str(end_price.date)
            })

    # Sort by percent change
    stocks_performance.sort(key=lambda x: x['percent_change'], reverse=True)

    return Response({
        'period': period,
        'start_date': str(start_date),
        'end_date': str(now),
        'total_stocks': len(stocks_performance),
        'top_20_gainers': stocks_performance[:20],
        'top_20_losers': stocks_performance[-20:][::-1]
    })


@api_view(['GET'])
def search_stocks(request):
    """Search for stocks by symbol or name"""
    query = request.GET.get('q', '').strip()

    if not query:
        return Response(
            {'error': 'Search query is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Search by symbol or name (case-insensitive)
    stocks = Stock.objects.filter(
        models.Q(symbol__icontains=query) |
        models.Q(name__icontains=query)
    ).values('symbol', 'name', 'industry', 'sector', 'is_sp500', 'last_updated')[:50]

    return Response({
        'query': query,
        'count': len(stocks),
        'results': list(stocks)
    })


@api_view(['GET'])
def stocks_by_industry(request):
    """Get stocks grouped by industry"""
    from django.db.models import Count

    # Get industry parameter for filtering
    industry = request.GET.get('industry', None)

    if industry:
        # Get stocks in a specific industry
        stocks = Stock.objects.filter(industry=industry).prefetch_related('prices').order_by('symbol')

        stocks_data = []
        for stock in stocks:
            latest_price = stock.prices.order_by('-date').first()

            stock_info = {
                'symbol': stock.symbol,
                'name': stock.name,
                'industry': stock.industry,
                'sector': stock.sector,
                'is_sp500': stock.is_sp500,
            }

            if latest_price:
                stock_info['latest_price'] = str(latest_price.close_price)
                stock_info['latest_date'] = str(latest_price.date)

            stocks_data.append(stock_info)

        return Response({
            'industry': industry,
            'count': len(stocks_data),
            'stocks': stocks_data
        })
    else:
        # Get all industries with stock counts
        industries = Stock.objects.values('industry').annotate(
            stock_count=Count('id')
        ).exclude(industry__isnull=True).exclude(industry='').order_by('-stock_count')

        return Response({
            'total_industries': len(industries),
            'industries': list(industries)
        })


@api_view(['GET'])
def get_adjusted_stock_data(request, symbol):
    """Get adjusted stock data (accounting for splits) for a single symbol"""
    try:
        stock = Stock.objects.prefetch_related('adjusted_prices', 'splits').get(symbol=symbol.upper())

        # Get time period
        weeks = int(request.GET.get('weeks', 52))
        start_date = datetime.now().date() - timedelta(weeks=weeks)

        # Get adjusted prices
        adjusted_prices = stock.adjusted_prices.filter(date__gte=start_date)

        # Get stock splits in the period
        splits = stock.splits.filter(split_date__gte=start_date).values(
            'split_date', 'split_ratio', 'description'
        )

        # Format data
        price_data = {}
        for price in adjusted_prices:
            price_data[str(price.date)] = {
                '1. open': str(price.adjusted_open),
                '2. high': str(price.adjusted_high),
                '3. low': str(price.adjusted_low),
                '4. close': str(price.adjusted_close),
                '5. volume': str(price.adjusted_volume),
                '6. split_coefficient': str(price.split_coefficient)
            }

        response_data = {
            'meta_data': {
                'symbol': stock.symbol,
                'name': stock.name,
                'industry': stock.industry,
                'sector': stock.sector,
                'is_sp500': stock.is_sp500,
                'last_updated': str(stock.last_updated),
            },
            'adjusted_prices': price_data,
            'splits': list(splits),
            'period_weeks': weeks
        }

        return Response(response_data)

    except Stock.DoesNotExist:
        return Response(
            {'error': f'Stock {symbol} not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
def weekly_chart_data(request, symbol):
    """Get weekly aggregated data for charting (optimized for graphs)"""
    try:
        stock = Stock.objects.prefetch_related('prices').get(symbol=symbol.upper())

        weeks = int(request.GET.get('weeks', 52))
        start_date = datetime.now().date() - timedelta(weeks=weeks)

        prices = stock.prices.filter(date__gte=start_date).order_by('date')

        # Group by week and aggregate
        from datetime import date
        weekly_data = []
        current_week_data = []
        last_week_start = None

        for price in prices:
            # Get week start (Monday)
            week_start = price.date - timedelta(days=price.date.weekday())

            if last_week_start is None:
                last_week_start = week_start

            if week_start != last_week_start:
                # Process previous week
                if current_week_data:
                    weekly_data.append({
                        'week_start': str(last_week_start),
                        'open': str(current_week_data[0].open_price),
                        'close': str(current_week_data[-1].close_price),
                        'high': str(max(p.high_price for p in current_week_data)),
                        'low': str(min(p.low_price for p in current_week_data)),
                        'volume': str(sum(p.volume for p in current_week_data)),
                    })
                current_week_data = []
                last_week_start = week_start

            current_week_data.append(price)

        # Process last week
        if current_week_data:
            weekly_data.append({
                'week_start': str(last_week_start),
                'open': str(current_week_data[0].open_price),
                'close': str(current_week_data[-1].close_price),
                'high': str(max(p.high_price for p in current_week_data)),
                'low': str(min(p.low_price for p in current_week_data)),
                'volume': str(sum(p.volume for p in current_week_data)),
            })

        return Response({
            'symbol': stock.symbol,
            'name': stock.name,
            'weeks': weeks,
            'data_points': len(weekly_data),
            'weekly_data': weekly_data
        })

    except Stock.DoesNotExist:
        return Response(
            {'error': f'Stock {symbol} not found'},
            status=status.HTTP_404_NOT_FOUND
        )