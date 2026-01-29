from django.urls import path
from . import views

urlpatterns = [
    path('stock/<str:symbol>/', views.get_stock_data, name='get_stock_data'),
    path('stocks/', views.get_multiple_stocks, name='get_multiple_stocks'),
    path('stocks/list/', views.get_all_stocks_list, name='get_all_stocks_list'),
    path('stocks/summary/', views.get_stock_summary, name='get_stock_summary'),
    path('stocks/performance/', views.get_stock_performance, name='get_stock_performance'),  # NEW
    path('refresh/', views.refresh_stocks, name='refresh_stocks'),
    path('stats/', views.stock_stats, name='stock_stats'),
]