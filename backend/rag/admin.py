from django.contrib import admin
from .models import SECFiling


@admin.register(SECFiling)
class SECFilingAdmin(admin.ModelAdmin):
    list_display = ['symbol', 'filing_type', 'filing_date', 'company_name', 'accession_number']
    list_filter = ['filing_type', 'filing_date']
    search_fields = ['symbol', 'company_name', 'cik']
    readonly_fields = ['created_at', 'updated_at']
