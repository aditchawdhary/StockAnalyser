from django.urls import path
from . import views

urlpatterns = [
    path('filings/', views.list_filings, name='rag_list_filings'),
    path('filings/<str:symbol>/', views.filings_for_symbol, name='rag_filings_for_symbol'),
    path('filings/stats/', views.filing_stats, name='rag_filing_stats'),
]
