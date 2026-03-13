from django.db import models


class SECFiling(models.Model):
    """SEC filing metadata and raw text content"""
    FILING_TYPES = [
        ('10-K', 'Annual Report'),
        ('10-Q', 'Quarterly Report'),
        ('8-K', 'Current Report'),
        ('20-F', 'Annual Report (Foreign)'),
        ('6-K', 'Current Report (Foreign)'),
    ]

    symbol = models.CharField(max_length=10, db_index=True)
    company_name = models.CharField(max_length=200)
    cik = models.CharField(max_length=20, db_index=True)
    accession_number = models.CharField(max_length=30, unique=True)
    filing_type = models.CharField(max_length=10, choices=FILING_TYPES, db_index=True)
    filing_date = models.DateField(db_index=True)
    report_date = models.DateField(null=True, blank=True)
    filing_url = models.URLField(max_length=500)
    document_url = models.URLField(max_length=500, blank=True)

    # Raw HTML preserved for full fidelity (images, tables, formatting)
    raw_html = models.TextField(blank=True)

    # Extracted sections stored as JSON: {"Item 1": "...", "Item 1A": "...", etc.}
    sections = models.JSONField(default=dict, blank=True)
    raw_text = models.TextField(blank=True)

    # Tables extracted as list of dicts: [{"title": "...", "html": "...", "text": "..."}]
    tables = models.JSONField(default=list, blank=True)

    # Image URLs found in the filing
    image_urls = models.JSONField(default=list, blank=True)

    # Exhibits linked in the filing: [{"type": "EX-21", "url": "...", "description": "..."}]
    exhibits = models.JSONField(default=list, blank=True)

    file_size = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-filing_date']
        indexes = [
            models.Index(fields=['symbol', '-filing_date']),
            models.Index(fields=['filing_type', '-filing_date']),
            models.Index(fields=['symbol', 'filing_type', '-filing_date']),
        ]

    def __str__(self):
        return f"{self.symbol} {self.filing_type} ({self.filing_date})"
