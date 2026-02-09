from django.urls import path
from . import views

urlpatterns = [
    # Single stock data
    path('stock/<str:symbol>/', views.get_stock_data, name='get_stock_data'),
    path('stock/<str:symbol>/adjusted/', views.get_adjusted_stock_data, name='get_adjusted_stock_data'),
    path('stock/<str:symbol>/weekly/', views.weekly_chart_data, name='weekly_chart_data'),
    path('stock/<str:symbol>/overview/', views.get_stock_overview, name='get_stock_overview'),
    path('stock/<str:symbol>/news/', views.get_news_sentiment, name='get_news_sentiment'),
    path('stock/<str:symbol>/intraday/', views.get_intraday_stock_data, name='get_intraday_stock_data'),
    path('stock/<str:symbol>/logo/', views.get_stock_logo, name='get_stock_logo'),

    # Multiple stocks
    path('stocks/', views.get_multiple_stocks, name='get_multiple_stocks'),
    path('stocks/intraday/', views.get_multiple_intraday_stocks, name='get_multiple_intraday_stocks'),
    path('stocks/list/', views.get_all_stocks_list, name='get_all_stocks_list'),
    path('stocks/summary/', views.get_stock_summary, name='get_stock_summary'),
    path('stocks/performance/', views.get_stock_performance, name='get_stock_performance'),

    # S&P 500 specific
    path('sp500/top-performers/', views.sp500_top_performers, name='sp500_top_performers'),

    # Search and filter
    path('search/', views.search_stocks, name='search_stocks'),
    path('industry/', views.stocks_by_industry, name='stocks_by_industry'),

    # Admin functions
    path('refresh/', views.refresh_stocks, name='refresh_stocks'),
    path('stats/', views.stock_stats, name='stock_stats'),
    path('seed/', views.seed_all_stocks, name='seed_all_stocks'),
    path('freshness/', views.get_data_freshness, name='get_data_freshness'),
    path('compute-performance/', views.compute_performance_metrics, name='compute_performance_metrics'),
]