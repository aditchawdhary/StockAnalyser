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
            {'error': f'Stock {symbol} not found in database. Please run: python manage.py fetch_weekly_stocks'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
def get_multiple_stocks(request):
    """Get daily or weekly stock data for multiple symbols from database, auto-fetch if missing"""
    from django.core.management import call_command
    from io import StringIO
    from .models import DailyStock, DailyStockPrice

    symbols = request.GET.get('symbols', '').split(',')
    symbols = [s.strip().upper() for s in symbols if s.strip()]

    # Check if daily data is requested
    data_type = request.GET.get('type', 'weekly').lower()  # 'daily' or 'weekly'
    use_daily = data_type == 'daily'

    if not symbols:
        return Response(
            {'error': 'No symbols provided'},
            status=status.HTTP_400_BAD_REQUEST
        )

    results = {}
    errors = []
    missing_symbols = []

    # Determine lookback period based on data type
    if use_daily:
        # For daily data, get last 2 years (enough for 1Y range)
        lookback = datetime.now().date() - timedelta(days=730)
    else:
        # For weekly data, get all available data (for MAX) or at least 6 years (for 5Y range)
        # We don't set a lookback for weekly to get all data
        lookback = None

    # First pass: check which stocks exist
    for symbol in symbols:
        try:
            if use_daily:
                # Fetch from daily database
                stock = DailyStock.objects.using('daily').prefetch_related('daily_prices').get(symbol=symbol)
                prices = DailyStockPrice.objects.using('daily').filter(
                    stock=stock,
                    date__gte=lookback
                ).order_by('date')

                time_series = {}
                for price in prices:
                    time_series[str(price.date)] = {
                        '1. open': str(price.open_price),
                        '2. high': str(price.high_price),
                        '3. low': str(price.low_price),
                        '4. close': str(price.close_price),
                        '5. volume': str(price.volume)
                    }

                results[symbol] = {
                    'Meta Data': {
                        '1. Information': 'Daily Prices (from database)',
                        '2. Symbol': stock.symbol,
                        '3. Last Refreshed': str(stock.last_updated),
                    },
                    'Time Series (Daily)': time_series
                }
            else:
                # Fetch from weekly database
                stock = Stock.objects.prefetch_related('prices').get(symbol=symbol)
                # Get all available weekly data (no date filter)
                prices = stock.prices.all()

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

        except (Stock.DoesNotExist, DailyStock.DoesNotExist):
            missing_symbols.append(symbol)

    # Second pass: fetch missing stocks from Alpha Vantage
    if missing_symbols:
        out = StringIO()
        try:
            # Fetch missing stocks (this will populate both weekly and daily databases)
            if use_daily:
                call_command('fetch_daily_stocks', symbols=','.join(missing_symbols), force=True, stdout=out)

                # Try to retrieve the newly fetched stocks from daily database
                for symbol in missing_symbols:
                    try:
                        stock = DailyStock.objects.using('daily').prefetch_related('daily_prices').get(symbol=symbol)
                        prices = DailyStockPrice.objects.using('daily').filter(
                            stock=stock,
                            date__gte=lookback
                        ).order_by('date')

                        time_series = {}
                        for price in prices:
                            time_series[str(price.date)] = {
                                '1. open': str(price.open_price),
                                '2. high': str(price.high_price),
                                '3. low': str(price.low_price),
                                '4. close': str(price.close_price),
                                '5. volume': str(price.volume)
                            }

                        results[symbol] = {
                            'Meta Data': {
                                '1. Information': 'Daily Prices (fetched from Alpha Vantage)',
                                '2. Symbol': stock.symbol,
                                '3. Last Refreshed': str(stock.last_updated),
                            },
                            'Time Series (Daily)': time_series
                        }

                    except DailyStock.DoesNotExist:
                        errors.append(f'{symbol}: Failed to fetch from Alpha Vantage')
            else:
                call_command('fetch_weekly_stocks', symbols=','.join(missing_symbols), force=True, stdout=out)

                # Try to retrieve the newly fetched stocks from weekly database
                for symbol in missing_symbols:
                    try:
                        stock = Stock.objects.prefetch_related('prices').get(symbol=symbol)
                        # Get all available weekly data (no date filter)
                        prices = stock.prices.all()

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
                                '1. Information': 'Weekly Prices (fetched from Alpha Vantage)',
                                '2. Symbol': stock.symbol,
                                '3. Last Refreshed': str(stock.last_updated),
                            },
                            'Weekly Time Series': weekly_data
                        }

                    except Stock.DoesNotExist:
                        errors.append(f'{symbol}: Failed to fetch from Alpha Vantage')

        except Exception as e:
            for symbol in missing_symbols:
                if symbol not in results:
                    errors.append(f'{symbol}: {str(e)}')

    return Response({
        'data': results,
        'errors': errors
    })


@api_view(['GET'])
def get_all_stocks_list(request):
    """Get list of all available stocks"""
    try:
        stocks = Stock.objects.all().values('symbol', 'name', 'last_updated').order_by('symbol')
        return Response({
            'count': len(stocks),
            'stocks': list(stocks)
        })
    except Exception as e:
        return Response({
            'count': 0,
            'stocks': [],
            'error': str(e)
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
            call_command('fetch_weekly_stocks', all=True, force=force, stdout=out)
        elif symbols:
            call_command('fetch_weekly_stocks', symbols=symbols, force=force, stdout=out)
        else:
            call_command('fetch_weekly_stocks', force=force, stdout=out)

        return Response({
            'message': 'Stock data refresh initiated',
            'output': out.getvalue()
        })
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET', 'POST'])
def seed_all_stocks(request):
    """
    Trigger full database population (weekly, daily, intraday) for all S&P 500 stocks.
    Uses fast concurrent fetcher optimized for 75 QPM / 5 QPS plan.
    Runs in background thread to avoid request timeout.

    Query params:
    - key: Secret key for authorization (set SEED_SECRET_KEY env var)
    - weekly: true/false (default: true)
    - daily: true/false (default: true)
    - intraday: true/false (default: true)
    - overview: true/false (default: false) - Fetch company overview data
    - workers: concurrent workers (default: 15)
    - qpm: queries per minute limit (default: 70)
    - qps: queries per second limit (default: 4)
    - interval: intraday interval - 1min, 5min, 15min, 30min, 60min (default: 1min)
    """
    import os
    import threading
    from django.core.management import call_command

    # Simple auth check
    secret_key = os.getenv('SEED_SECRET_KEY', 'stockseed2024')
    provided_key = request.GET.get('key') or request.data.get('key')

    if provided_key != secret_key:
        return Response(
            {'error': 'Invalid or missing key'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Get options
    fetch_weekly = request.GET.get('weekly', 'true').lower() == 'true'
    fetch_daily = request.GET.get('daily', 'true').lower() == 'true'
    fetch_intraday = request.GET.get('intraday', 'true').lower() == 'true'
    fetch_overview = request.GET.get('overview', 'false').lower() == 'true'
    interval = request.GET.get('interval', '1min')
    workers = int(request.GET.get('workers', 15))
    qpm = int(request.GET.get('qpm', 70))
    qps = int(request.GET.get('qps', 4))

    def run_seed():
        """Background task to fetch all stock data using fast concurrent fetcher"""
        try:
            print("=== STARTING FAST CONCURRENT SEED ===", flush=True)
            print(f"Options: weekly={fetch_weekly}, daily={fetch_daily}, intraday={fetch_intraday}, overview={fetch_overview}, interval={interval}", flush=True)
            print(f"Rate limits: {qpm} QPM, {qps} QPS, {workers} workers", flush=True)

            call_command(
                'fetch_stocks_fast',
                all=True,
                force=True,
                weekly=fetch_weekly,
                daily=fetch_daily,
                intraday=fetch_intraday,
                overview=fetch_overview,
                interval=interval,
                workers=workers,
                qpm=qpm,
                qps=qps
            )

            print("=== ALL SEEDING COMPLETE ===", flush=True)
        except Exception as e:
            print(f"Seeding error: {e}", flush=True)
            import traceback
            traceback.print_exc()

    # Start background thread
    thread = threading.Thread(target=run_seed, daemon=True)
    thread.start()

    # Calculate estimated time
    from stocks.management.commands.top5kcompanies import all_5k_stocks
    num_stocks = len(all_5k_stocks)
    data_types = sum([fetch_weekly, fetch_daily, fetch_intraday, fetch_overview])
    total_requests = num_stocks * data_types
    estimated_minutes = total_requests / qpm

    return Response({
        'message': 'Database seeding started in background (FAST MODE)',
        'options': {
            'weekly': fetch_weekly,
            'daily': fetch_daily,
            'intraday': fetch_intraday,
            'overview': fetch_overview,
            'interval': interval,
            'workers': workers,
            'qpm': qpm,
            'qps': qps
        },
        'estimate': {
            'total_requests': total_requests,
            'estimated_minutes': round(estimated_minutes, 1)
        },
        'note': 'Check Railway logs for progress. Using concurrent fetcher for faster execution.'
    })


@api_view(['GET', 'POST'])
def compute_performance_metrics(request):
    """
    Trigger computation of stock performance metrics.
    Call this after seeding data to update the performance cache.

    Query params:
    - key: Secret key for authorization (set SEED_SECRET_KEY env var)
    """
    import os
    from .services.performance_calculator import PerformanceCalculator

    # Simple auth check
    secret_key = os.getenv('SEED_SECRET_KEY', 'stockseed2024')
    provided_key = request.GET.get('key') or request.data.get('key')

    if provided_key != secret_key:
        return Response(
            {'error': 'Invalid or missing key'},
            status=status.HTTP_403_FORBIDDEN
        )

    calculator = PerformanceCalculator()
    results = calculator.compute_all()

    return Response({
        'message': 'Performance metrics computed successfully',
        'records_created': results['computed']
    })


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
def get_data_freshness(request):
    """
    Get data freshness info for all databases (weekly, daily, intraday).

    Query params:
    - symbol: Optional stock symbol to get freshness for a specific stock
    - all: If 'true', returns freshness for all stocks (daily database)
    - db: Which database to query for all stocks ('daily', 'weekly', 'intraday'). Default: 'daily'
    """
    from .models import DailyStock, DailyStockPrice, IntradayStock, IntradayStockPrice
    from django.utils import timezone
    from django.db.models import OuterRef, Subquery

    symbol = request.GET.get('symbol', '').upper()
    list_all = request.GET.get('all', '').lower() == 'true'
    db_type = request.GET.get('db', 'daily').lower()
    result = {}

    # List all stocks with their latest dates
    if list_all:
        stocks_data = []

        if db_type == 'daily':
            stocks = DailyStock.objects.using('daily').annotate(
                latest_date=Max('daily_prices__date'),
                oldest_date=Min('daily_prices__date'),
                price_count=Count('daily_prices')
            ).values('symbol', 'name', 'latest_date', 'oldest_date', 'price_count', 'last_updated').order_by('-latest_date')

            for stock in stocks:
                stocks_data.append({
                    'symbol': stock['symbol'],
                    'name': stock['name'],
                    'latest_date': str(stock['latest_date']) if stock['latest_date'] else None,
                    'oldest_date': str(stock['oldest_date']) if stock['oldest_date'] else None,
                    'price_count': stock['price_count'],
                    'last_updated': stock['last_updated'].isoformat() if stock['last_updated'] else None,
                })

        elif db_type == 'weekly':
            stocks = Stock.objects.annotate(
                latest_date=Max('prices__date'),
                oldest_date=Min('prices__date'),
                price_count=Count('prices')
            ).values('symbol', 'name', 'latest_date', 'oldest_date', 'price_count', 'last_updated').order_by('-latest_date')

            for stock in stocks:
                stocks_data.append({
                    'symbol': stock['symbol'],
                    'name': stock['name'],
                    'latest_date': str(stock['latest_date']) if stock['latest_date'] else None,
                    'oldest_date': str(stock['oldest_date']) if stock['oldest_date'] else None,
                    'price_count': stock['price_count'],
                    'last_updated': stock['last_updated'].isoformat() if stock['last_updated'] else None,
                })

        elif db_type == 'intraday':
            stocks = IntradayStock.objects.using('intraday').annotate(
                latest_timestamp=Max('intraday_prices__timestamp'),
                oldest_timestamp=Min('intraday_prices__timestamp'),
                price_count=Count('intraday_prices')
            ).values('symbol', 'name', 'latest_timestamp', 'oldest_timestamp', 'price_count', 'last_updated').order_by('-latest_timestamp')

            for stock in stocks:
                stocks_data.append({
                    'symbol': stock['symbol'],
                    'name': stock['name'],
                    'latest_timestamp': stock['latest_timestamp'].isoformat() if stock['latest_timestamp'] else None,
                    'oldest_timestamp': stock['oldest_timestamp'].isoformat() if stock['oldest_timestamp'] else None,
                    'price_count': stock['price_count'],
                    'last_updated': stock['last_updated'].isoformat() if stock['last_updated'] else None,
                })

        return Response({
            'database': db_type,
            'stock_count': len(stocks_data),
            'stocks': stocks_data,
            'server_time': timezone.now().isoformat()
        })

    # If symbol provided, get data for that specific stock
    if symbol:
        result['symbol'] = symbol

        # Weekly data for symbol
        try:
            stock = Stock.objects.get(symbol=symbol)
            prices = stock.prices.aggregate(
                latest_date=Max('date'),
                oldest_date=Min('date'),
                price_count=Count('id')
            )
            result['weekly'] = {
                'available': True,
                'name': stock.name,
                'price_count': prices['price_count'],
                'latest_date': str(prices['latest_date']) if prices['latest_date'] else None,
                'oldest_date': str(prices['oldest_date']) if prices['oldest_date'] else None,
                'last_updated': stock.last_updated.isoformat() if stock.last_updated else None,
            }
        except Stock.DoesNotExist:
            result['weekly'] = {'available': False, 'error': 'Stock not found'}
        except Exception as e:
            result['weekly'] = {'available': False, 'error': str(e)}

        # Daily data for symbol
        try:
            stock = DailyStock.objects.using('daily').get(symbol=symbol)
            prices = DailyStockPrice.objects.using('daily').filter(stock=stock).aggregate(
                latest_date=Max('date'),
                oldest_date=Min('date'),
                price_count=Count('id')
            )
            result['daily'] = {
                'available': True,
                'name': stock.name,
                'price_count': prices['price_count'],
                'latest_date': str(prices['latest_date']) if prices['latest_date'] else None,
                'oldest_date': str(prices['oldest_date']) if prices['oldest_date'] else None,
                'last_updated': stock.last_updated.isoformat() if stock.last_updated else None,
            }
        except DailyStock.DoesNotExist:
            result['daily'] = {'available': False, 'error': 'Stock not found in daily database'}
        except Exception as e:
            result['daily'] = {'available': False, 'error': str(e)}

        # Intraday data for symbol
        try:
            stock = IntradayStock.objects.using('intraday').get(symbol=symbol)
            prices = IntradayStockPrice.objects.using('intraday').filter(stock=stock).aggregate(
                latest_timestamp=Max('timestamp'),
                oldest_timestamp=Min('timestamp'),
                price_count=Count('id')
            )
            result['intraday'] = {
                'available': True,
                'name': stock.name,
                'price_count': prices['price_count'],
                'latest_timestamp': prices['latest_timestamp'].isoformat() if prices['latest_timestamp'] else None,
                'oldest_timestamp': prices['oldest_timestamp'].isoformat() if prices['oldest_timestamp'] else None,
                'last_updated': stock.last_updated.isoformat() if stock.last_updated else None,
            }
        except IntradayStock.DoesNotExist:
            result['intraday'] = {'available': False, 'error': 'Stock not found in intraday database'}
        except Exception as e:
            result['intraday'] = {'available': False, 'error': str(e)}

        result['server_time'] = timezone.now().isoformat()
        return Response(result)

    # No symbol - return aggregate stats
    # Weekly data (default database)
    try:
        weekly_latest = StockPrice.objects.aggregate(
            latest_date=Max('date'),
            oldest_date=Min('date')
        )
        weekly_stock_count = Stock.objects.count()
        weekly_price_count = StockPrice.objects.count()
        weekly_last_updated = Stock.objects.aggregate(latest=Max('last_updated'))['latest']

        result['weekly'] = {
            'available': True,
            'stock_count': weekly_stock_count,
            'price_count': weekly_price_count,
            'latest_date': str(weekly_latest['latest_date']) if weekly_latest['latest_date'] else None,
            'oldest_date': str(weekly_latest['oldest_date']) if weekly_latest['oldest_date'] else None,
            'last_updated': weekly_last_updated.isoformat() if weekly_last_updated else None,
        }
    except Exception as e:
        result['weekly'] = {'available': False, 'error': str(e)}

    # Daily data
    try:
        daily_latest = DailyStockPrice.objects.using('daily').aggregate(
            latest_date=Max('date'),
            oldest_date=Min('date')
        )
        daily_stock_count = DailyStock.objects.using('daily').count()
        daily_price_count = DailyStockPrice.objects.using('daily').count()
        daily_last_updated = DailyStock.objects.using('daily').aggregate(latest=Max('last_updated'))['latest']

        result['daily'] = {
            'available': True,
            'stock_count': daily_stock_count,
            'price_count': daily_price_count,
            'latest_date': str(daily_latest['latest_date']) if daily_latest['latest_date'] else None,
            'oldest_date': str(daily_latest['oldest_date']) if daily_latest['oldest_date'] else None,
            'last_updated': daily_last_updated.isoformat() if daily_last_updated else None,
        }
    except Exception as e:
        result['daily'] = {'available': False, 'error': str(e)}

    # Intraday data
    try:
        intraday_latest = IntradayStockPrice.objects.using('intraday').aggregate(
            latest_timestamp=Max('timestamp'),
            oldest_timestamp=Min('timestamp')
        )
        intraday_stock_count = IntradayStock.objects.using('intraday').count()
        intraday_price_count = IntradayStockPrice.objects.using('intraday').count()
        intraday_last_updated = IntradayStock.objects.using('intraday').aggregate(latest=Max('last_updated'))['latest']

        result['intraday'] = {
            'available': True,
            'stock_count': intraday_stock_count,
            'price_count': intraday_price_count,
            'latest_timestamp': intraday_latest['latest_timestamp'].isoformat() if intraday_latest['latest_timestamp'] else None,
            'oldest_timestamp': intraday_latest['oldest_timestamp'].isoformat() if intraday_latest['oldest_timestamp'] else None,
            'last_updated': intraday_last_updated.isoformat() if intraday_last_updated else None,
        }
    except Exception as e:
        result['intraday'] = {'available': False, 'error': str(e)}

    # Add server time for reference
    result['server_time'] = timezone.now().isoformat()

    return Response(result)


@api_view(['GET'])
def get_stock_performance(request):
    """
    Get top winners and losers for different time periods.
    Uses precomputed metrics from StockPerformance table for fast response.

    Query params:
    - sector: Filter by sector (e.g., "TECHNOLOGY")
    - industry: Filter by industry (e.g., "SOFTWARE - APPLICATION")
    """
    from .models import StockPerformance, StockOverview

    # Check if precomputed data exists
    if not StockPerformance.objects.exists():
        # Fallback: compute on-the-fly if metrics haven't been computed yet
        from .services.performance_calculator import PerformanceCalculator
        calculator = PerformanceCalculator()
        calculator.compute_all()

    # Get filter params
    sector_filter = request.GET.get('sector', '').strip()
    industry_filter = request.GET.get('industry', '').strip()

    # Build lookup dict for sector/industry from StockOverview
    overview_data = {}
    for overview in StockOverview.objects.select_related('stock').all():
        overview_data[overview.stock.symbol] = {
            'sector': overview.sector or '',
            'industry': overview.industry or ''
        }

    # Get list of symbols that match the filter
    filtered_symbols = None
    if sector_filter or industry_filter:
        filtered_symbols = set()
        for symbol, data in overview_data.items():
            sector_match = not sector_filter or data['sector'].upper() == sector_filter.upper()
            industry_match = not industry_filter or data['industry'].upper() == industry_filter.upper()
            if sector_match and industry_match:
                filtered_symbols.add(symbol)

    periods = ['1D', '1W', '1M', 'YTD', '6M', '1Y', '5Y']
    results = {}

    for period in periods:
        # Build base queryset
        base_qs = StockPerformance.objects.filter(period=period)

        # Apply symbol filter if sector/industry filter is active
        if filtered_symbols is not None:
            base_qs = base_qs.filter(symbol__in=filtered_symbols)

        # Get top 10 gainers (highest percent_change)
        top_gainers = list(base_qs.order_by('-percent_change')[:10].values(
            'symbol', 'name', 'start_price', 'end_price',
            'price_change', 'percent_change', 'start_date', 'end_date'
        ))

        # Get top 10 losers (lowest percent_change)
        top_losers = list(base_qs.order_by('percent_change')[:10].values(
            'symbol', 'name', 'start_price', 'end_price',
            'price_change', 'percent_change', 'start_date', 'end_date'
        ))

        # Convert Decimal to float, dates to strings, and add sector/industry
        for item in top_gainers + top_losers:
            item['start_price'] = float(item['start_price'])
            item['end_price'] = float(item['end_price'])
            item['price_change'] = float(item['price_change'])
            item['percent_change'] = float(item['percent_change'])
            item['start_date'] = str(item['start_date'])
            item['end_date'] = str(item['end_date'])
            # Add sector/industry from overview data
            symbol_data = overview_data.get(item['symbol'], {})
            item['sector'] = symbol_data.get('sector', '')
            item['industry'] = symbol_data.get('industry', '')

        results[period] = {
            'top_gainers': top_gainers,
            'top_losers': top_losers
        }

    # Get available sectors and industries for filters
    sectors = sorted(set(d['sector'] for d in overview_data.values() if d['sector']))
    industries = sorted(set(d['industry'] for d in overview_data.values() if d['industry']))

    # Build sector -> industries mapping
    sector_industries = {}
    for data in overview_data.values():
        sector = data.get('sector', '')
        industry = data.get('industry', '')
        if sector and industry:
            if sector not in sector_industries:
                sector_industries[sector] = set()
            sector_industries[sector].add(industry)
    # Convert sets to sorted lists
    sector_industries = {k: sorted(v) for k, v in sector_industries.items()}

    results['filters'] = {
        'available_sectors': sectors,
        'available_industries': industries,
        'sector_industries': sector_industries,
        'applied': {
            'sector': sector_filter if sector_filter else None,
            'industry': industry_filter if industry_filter else None
        }
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
    """
    Search for stocks using Alpha Vantage SYMBOL_SEARCH API.
    This proxies the request so the API key isn't exposed in the frontend.

    Query params:
    - q: Search query (required)
    """
    import requests
    import os

    query = request.GET.get('q', '').strip()

    if not query:
        return Response(
            {'error': 'Search query is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
    if not api_key:
        return Response(
            {'error': 'API key not configured'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    try:
        url = f'https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords={query}&apikey={api_key}'
        response = requests.get(url, timeout=10)
        data = response.json()

        if 'bestMatches' in data:
            return Response({
                'query': query,
                'bestMatches': data['bestMatches']
            })
        else:
            return Response({
                'query': query,
                'bestMatches': [],
                'note': data.get('Note', 'No results found')
            })
    except Exception as e:
        return Response(
            {'error': f'Search failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


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


@api_view(['GET'])
def get_stock_overview(request, symbol):
    """
    Get company overview data for a stock.
    Caches data for 48 hours, fetches from Alpha Vantage if stale/missing.
    """
    from django.utils import timezone
    from datetime import timedelta
    import requests
    import os
    from .models import StockOverview

    try:
        # Try to get stock from database
        stock = Stock.objects.get(symbol=symbol.upper())

        # Check if we have recent cached overview data
        try:
            overview = stock.overview
            # Cache is valid for 48 hours
            if timezone.now() - overview.last_updated < timedelta(hours=48):
                return Response({
                    'symbol': stock.symbol,
                    'name': stock.name,
                    'overview': {
                        'Symbol': stock.symbol,
                        'AssetType': overview.asset_type,
                        'Name': stock.name,
                        'Exchange': overview.exchange,
                        'Currency': overview.currency,
                        'Country': overview.country,
                        'Sector': overview.sector,
                        'Industry': overview.industry,
                        'Description': overview.description,
                        'Address': overview.address,
                        'FiscalYearEnd': overview.fiscal_year_end,
                        'MarketCapitalization': str(overview.market_capitalization) if overview.market_capitalization else 'None',
                        'EBITDA': str(overview.ebitda) if overview.ebitda else 'None',
                        'PERatio': str(overview.pe_ratio) if overview.pe_ratio else 'None',
                        'PEGRatio': str(overview.peg_ratio) if overview.peg_ratio else 'None',
                        'BookValue': str(overview.book_value) if overview.book_value else 'None',
                        'DividendPerShare': str(overview.dividend_per_share) if overview.dividend_per_share else 'None',
                        'DividendYield': str(overview.dividend_yield) if overview.dividend_yield else 'None',
                        'EPS': str(overview.eps) if overview.eps else 'None',
                        'RevenuePerShareTTM': str(overview.revenue_per_share_ttm) if overview.revenue_per_share_ttm else 'None',
                        'ProfitMargin': str(overview.profit_margin) if overview.profit_margin else 'None',
                        'OperatingMarginTTM': str(overview.operating_margin_ttm) if overview.operating_margin_ttm else 'None',
                        'ReturnOnAssetsTTM': str(overview.return_on_assets_ttm) if overview.return_on_assets_ttm else 'None',
                        'ReturnOnEquityTTM': str(overview.return_on_equity_ttm) if overview.return_on_equity_ttm else 'None',
                        'RevenueTTM': str(overview.revenue_ttm) if overview.revenue_ttm else 'None',
                        'GrossProfitTTM': str(overview.gross_profit_ttm) if overview.gross_profit_ttm else 'None',
                        'QuarterlyEarningsGrowthYOY': str(overview.quarterly_earnings_growth_yoy) if overview.quarterly_earnings_growth_yoy else 'None',
                        'QuarterlyRevenueGrowthYOY': str(overview.quarterly_revenue_growth_yoy) if overview.quarterly_revenue_growth_yoy else 'None',
                        'AnalystTargetPrice': str(overview.analyst_target_price) if overview.analyst_target_price else 'None',
                        'TrailingPE': str(overview.trailing_pe) if overview.trailing_pe else 'None',
                        'ForwardPE': str(overview.forward_pe) if overview.forward_pe else 'None',
                        'PriceToSalesRatioTTM': str(overview.price_to_sales_ratio_ttm) if overview.price_to_sales_ratio_ttm else 'None',
                        'PriceToBookRatio': str(overview.price_to_book_ratio) if overview.price_to_book_ratio else 'None',
                        'Beta': str(overview.beta) if overview.beta else 'None',
                        '52WeekHigh': str(overview.week_52_high) if overview.week_52_high else 'None',
                        '52WeekLow': str(overview.week_52_low) if overview.week_52_low else 'None',
                        '50DayMovingAverage': str(overview.day_50_moving_average) if overview.day_50_moving_average else 'None',
                        '200DayMovingAverage': str(overview.day_200_moving_average) if overview.day_200_moving_average else 'None',
                        'SharesOutstanding': str(overview.shares_outstanding) if overview.shares_outstanding else 'None',
                        'SharesFloat': str(overview.shares_float) if overview.shares_float else 'None',
                        'PercentInsiders': str(overview.percent_insiders) if overview.percent_insiders else 'None',
                        'PercentInstitutions': str(overview.percent_institutions) if overview.percent_institutions else 'None',
                    },
                    'cached': True
                })
        except StockOverview.DoesNotExist:
            pass

        # Fetch fresh data from Alpha Vantage
        api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
        if not api_key:
            return Response(
                {'error': 'Alpha Vantage API key not configured'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        url = f'https://www.alphavantage.co/query?function=OVERVIEW&symbol={symbol}&apikey={api_key}'

        response = requests.get(url, timeout=30)
        data = response.json()

        # Check for API errors
        if 'Error Message' in data or not data or not data.get('Symbol'):
            return Response(
                {'error': f'Could not fetch overview for {symbol}'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Helper to safely parse values
        def parse_value(value, parser=str):
            if value in ['None', 'N/A', '', '-', None]:
                return None
            try:
                return parser(value)
            except (ValueError, TypeError):
                return None

        # Create or update StockOverview
        overview, created = StockOverview.objects.update_or_create(
            stock=stock,
            defaults={
                'asset_type': data.get('AssetType', ''),
                'exchange': data.get('Exchange', ''),
                'currency': data.get('Currency', ''),
                'country': data.get('Country', ''),
                'sector': data.get('Sector', ''),
                'industry': data.get('Industry', ''),
                'description': data.get('Description', ''),
                'address': data.get('Address', ''),
                'fiscal_year_end': data.get('FiscalYearEnd', ''),
                'market_capitalization': parse_value(data.get('MarketCapitalization'), int),
                'ebitda': parse_value(data.get('EBITDA'), int),
                'pe_ratio': parse_value(data.get('PERatio'), float),
                'peg_ratio': parse_value(data.get('PEGRatio'), float),
                'book_value': parse_value(data.get('BookValue'), float),
                'dividend_per_share': parse_value(data.get('DividendPerShare'), float),
                'dividend_yield': parse_value(data.get('DividendYield'), float),
                'eps': parse_value(data.get('EPS'), float),
                'revenue_per_share_ttm': parse_value(data.get('RevenuePerShareTTM'), float),
                'profit_margin': parse_value(data.get('ProfitMargin'), float),
                'operating_margin_ttm': parse_value(data.get('OperatingMarginTTM'), float),
                'return_on_assets_ttm': parse_value(data.get('ReturnOnAssetsTTM'), float),
                'return_on_equity_ttm': parse_value(data.get('ReturnOnEquityTTM'), float),
                'revenue_ttm': parse_value(data.get('RevenueTTM'), int),
                'gross_profit_ttm': parse_value(data.get('GrossProfitTTM'), int),
                'quarterly_earnings_growth_yoy': parse_value(data.get('QuarterlyEarningsGrowthYOY'), float),
                'quarterly_revenue_growth_yoy': parse_value(data.get('QuarterlyRevenueGrowthYOY'), float),
                'analyst_target_price': parse_value(data.get('AnalystTargetPrice'), float),
                'trailing_pe': parse_value(data.get('TrailingPE'), float),
                'forward_pe': parse_value(data.get('ForwardPE'), float),
                'price_to_sales_ratio_ttm': parse_value(data.get('PriceToSalesRatioTTM'), float),
                'price_to_book_ratio': parse_value(data.get('PriceToBookRatio'), float),
                'beta': parse_value(data.get('Beta'), float),
                'week_52_high': parse_value(data.get('52WeekHigh'), float),
                'week_52_low': parse_value(data.get('52WeekLow'), float),
                'day_50_moving_average': parse_value(data.get('50DayMovingAverage'), float),
                'day_200_moving_average': parse_value(data.get('200DayMovingAverage'), float),
                'shares_outstanding': parse_value(data.get('SharesOutstanding'), int),
                'shares_float': parse_value(data.get('SharesFloat'), int),
                'percent_insiders': parse_value(data.get('PercentInsiders'), float),
                'percent_institutions': parse_value(data.get('PercentInstitutions'), float),
            }
        )

        return Response({
            'symbol': stock.symbol,
            'name': stock.name,
            'overview': data,  # Return raw Alpha Vantage format for frontend
            'cached': False
        })

    except Stock.DoesNotExist:
        return Response(
            {'error': f'Stock {symbol} not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': f'Error fetching overview: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_news_sentiment(request, symbol):
    """
    Get news sentiment data for a stock from Alpha Vantage.
    Query params: limit (default 20), time_from, time_to
    """
    import requests
    import os

    api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
    if not api_key:
        return Response(
            {'error': 'Alpha Vantage API key not configured'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    limit = request.GET.get('limit', '20')

    # Build URL with optional time filters
    url = f'https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers={symbol}&limit={limit}&apikey={api_key}'

    time_from = request.GET.get('time_from')
    time_to = request.GET.get('time_to')
    if time_from:
        url += f'&time_from={time_from}'
    if time_to:
        url += f'&time_to={time_to}'

    try:
        response = requests.get(url, timeout=30)
        data = response.json()

        if 'Error Message' in data:
            return Response(
                {'error': 'Failed to fetch news sentiment'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(data)

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_intraday_stock_data(request, symbol):
    """
    Get intraday stock data for a single symbol.
    Auto-fetches from Alpha Vantage if data is missing or stale.

    Query params:
    - interval: 1min, 5min, 15min, 30min, 60min (default: 5min)
    - days: Number of days of data to return (default: 7)
    - force: Force refresh from API (default: false)
    """
    from django.utils import timezone
    from django.core.management import call_command
    from io import StringIO
    from .models import IntradayStock, IntradayStockPrice
    import pytz

    symbol = symbol.upper()
    interval = request.GET.get('interval', '5min')
    days = int(request.GET.get('days', 7))
    force = request.GET.get('force', 'false').lower() == 'true'

    # Validate interval
    valid_intervals = ['1min', '5min', '15min', '30min', '60min']
    if interval not in valid_intervals:
        return Response(
            {'error': f'Invalid interval. Must be one of: {valid_intervals}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Try to get intraday stock from database
        stock = IntradayStock.objects.using('intraday').get(symbol=symbol)

        # Check if data is stale (older than 15 minutes during market hours)
        eastern = pytz.timezone('US/Eastern')
        now_eastern = timezone.now().astimezone(eastern)
        market_open = now_eastern.hour >= 9 and now_eastern.hour < 16
        time_since_update = timezone.now() - stock.last_updated

        # Refresh if forced, or if data is stale during market hours
        should_refresh = force or (market_open and time_since_update > timedelta(minutes=15))

        if should_refresh:
            out = StringIO()
            try:
                call_command(
                    'fetch_intraday_stocks',
                    symbols=symbol,
                    interval=interval,
                    force=True,
                    stdout=out
                )
                # Refresh stock object
                stock = IntradayStock.objects.using('intraday').get(symbol=symbol)
            except Exception as e:
                # Continue with existing data if refresh fails
                pass

    except IntradayStock.DoesNotExist:
        # Fetch from Alpha Vantage
        out = StringIO()
        try:
            call_command(
                'fetch_intraday_stocks',
                symbols=symbol,
                interval=interval,
                force=True,
                stdout=out
            )
            stock = IntradayStock.objects.using('intraday').get(symbol=symbol)
        except Exception as e:
            return Response(
                {'error': f'Failed to fetch intraday data for {symbol}: {str(e)}'},
                status=status.HTTP_404_NOT_FOUND
            )

    # Get intraday prices for the requested time period
    start_date = timezone.now() - timedelta(days=days)
    prices = IntradayStockPrice.objects.using('intraday').filter(
        stock=stock,
        timestamp__gte=start_date
    ).order_by('timestamp')

    # Format response similar to Alpha Vantage API format
    time_series = {}
    eastern = pytz.timezone('US/Eastern')
    for price in prices:
        # Convert UTC timestamp to Eastern time for display
        eastern_time = price.timestamp.astimezone(eastern)
        timestamp_str = eastern_time.strftime('%Y-%m-%d %H:%M:%S')

        time_series[timestamp_str] = {
            '1. open': str(price.open_price),
            '2. high': str(price.high_price),
            '3. low': str(price.low_price),
            '4. close': str(price.close_price),
            '5. volume': str(price.volume)
        }

    response_data = {
        'Meta Data': {
            '1. Information': f'Intraday ({interval}) Prices (from database)',
            '2. Symbol': stock.symbol,
            '3. Last Refreshed': str(stock.last_updated),
            '4. Interval': interval,
            '5. Output Size': 'Full',
            '6. Time Zone': 'US/Eastern'
        },
        f'Time Series ({interval})': time_series
    }

    return Response(response_data)


@api_view(['GET'])
def get_multiple_intraday_stocks(request):
    """
    Get intraday stock data for multiple symbols.

    Query params:
    - symbols: Comma-separated list of symbols
    - interval: 1min, 5min, 15min, 30min, 60min (default: 5min)
    - days: Number of days of data to return (default: 7)
    """
    from django.utils import timezone
    from django.core.management import call_command
    from io import StringIO
    from .models import IntradayStock, IntradayStockPrice
    import pytz

    symbols = request.GET.get('symbols', '').split(',')
    symbols = [s.strip().upper() for s in symbols if s.strip()]
    interval = request.GET.get('interval', '5min')
    days = int(request.GET.get('days', 7))

    if not symbols:
        return Response(
            {'error': 'No symbols provided'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validate interval
    valid_intervals = ['1min', '5min', '15min', '30min', '60min']
    if interval not in valid_intervals:
        return Response(
            {'error': f'Invalid interval. Must be one of: {valid_intervals}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    results = {}
    errors = []
    missing_symbols = []
    eastern = pytz.timezone('US/Eastern')

    # First pass: check which stocks exist
    for symbol in symbols:
        try:
            stock = IntradayStock.objects.using('intraday').get(symbol=symbol)

            # Get intraday prices
            start_date = timezone.now() - timedelta(days=days)
            prices = IntradayStockPrice.objects.using('intraday').filter(
                stock=stock,
                timestamp__gte=start_date
            ).order_by('timestamp')

            time_series = {}
            for price in prices:
                eastern_time = price.timestamp.astimezone(eastern)
                timestamp_str = eastern_time.strftime('%Y-%m-%d %H:%M:%S')

                time_series[timestamp_str] = {
                    '1. open': str(price.open_price),
                    '2. high': str(price.high_price),
                    '3. low': str(price.low_price),
                    '4. close': str(price.close_price),
                    '5. volume': str(price.volume)
                }

            results[symbol] = {
                'Meta Data': {
                    '1. Information': f'Intraday ({interval}) Prices (from database)',
                    '2. Symbol': stock.symbol,
                    '3. Last Refreshed': str(stock.last_updated),
                    '4. Interval': interval,
                },
                f'Time Series ({interval})': time_series
            }

        except IntradayStock.DoesNotExist:
            missing_symbols.append(symbol)

    # Second pass: fetch missing stocks
    if missing_symbols:
        out = StringIO()
        try:
            call_command(
                'fetch_intraday_stocks',
                symbols=','.join(missing_symbols),
                interval=interval,
                force=True,
                stdout=out
            )

            # Retrieve newly fetched stocks
            for symbol in missing_symbols:
                try:
                    stock = IntradayStock.objects.using('intraday').get(symbol=symbol)

                    start_date = timezone.now() - timedelta(days=days)
                    prices = IntradayStockPrice.objects.using('intraday').filter(
                        stock=stock,
                        timestamp__gte=start_date
                    ).order_by('timestamp')

                    time_series = {}
                    for price in prices:
                        eastern_time = price.timestamp.astimezone(eastern)
                        timestamp_str = eastern_time.strftime('%Y-%m-%d %H:%M:%S')

                        time_series[timestamp_str] = {
                            '1. open': str(price.open_price),
                            '2. high': str(price.high_price),
                            '3. low': str(price.low_price),
                            '4. close': str(price.close_price),
                            '5. volume': str(price.volume)
                        }

                    results[symbol] = {
                        'Meta Data': {
                            '1. Information': f'Intraday ({interval}) Prices (fetched from Alpha Vantage)',
                            '2. Symbol': stock.symbol,
                            '3. Last Refreshed': str(stock.last_updated),
                            '4. Interval': interval,
                        },
                        f'Time Series ({interval})': time_series
                    }

                except IntradayStock.DoesNotExist:
                    errors.append(f'{symbol}: Failed to fetch from Alpha Vantage')

        except Exception as e:
            for symbol in missing_symbols:
                if symbol not in results:
                    errors.append(f'{symbol}: {str(e)}')

    return Response({
        'data': results,
        'errors': errors
    })