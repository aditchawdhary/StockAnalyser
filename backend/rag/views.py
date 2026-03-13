from django.db.models import Count
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import SECFiling


@api_view(['GET'])
def list_filings(request):
    """List all filings with optional filtering by type."""
    filing_type = request.query_params.get('type')
    symbol = request.query_params.get('symbol')

    queryset = SECFiling.objects.all()
    if filing_type:
        queryset = queryset.filter(filing_type=filing_type)
    if symbol:
        queryset = queryset.filter(symbol=symbol.upper())

    filings = queryset.values(
        'symbol', 'company_name', 'filing_type', 'filing_date',
        'accession_number', 'filing_url', 'file_size'
    )[:100]

    return Response({'filings': list(filings), 'count': queryset.count()})


@api_view(['GET'])
def filings_for_symbol(request, symbol):
    """Get all filings for a specific stock symbol."""
    filings = SECFiling.objects.filter(symbol=symbol.upper()).values(
        'filing_type', 'filing_date', 'report_date', 'accession_number',
        'filing_url', 'document_url', 'file_size', 'created_at'
    )

    # Get section names for each filing (without full text)
    result = []
    for filing in filings:
        obj = SECFiling.objects.get(accession_number=filing['accession_number'])
        filing['sections'] = list(obj.sections.keys()) if obj.sections else []
        result.append(filing)

    return Response({'symbol': symbol.upper(), 'filings': result})


@api_view(['GET'])
def filing_stats(request):
    """Get overall filing ingestion statistics."""
    stats = SECFiling.objects.aggregate(total=Count('id'))

    by_type = (
        SECFiling.objects.values('filing_type')
        .annotate(count=Count('id'))
        .order_by('filing_type')
    )

    by_symbol = (
        SECFiling.objects.values('symbol')
        .annotate(count=Count('id'))
        .order_by('-count')[:20]
    )

    return Response({
        'total_filings': stats['total'],
        'by_type': list(by_type),
        'top_symbols': list(by_symbol),
    })
