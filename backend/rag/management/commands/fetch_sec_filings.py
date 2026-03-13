import time
import threading
import logging
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from stocks.models import Stock, StockOverview
from stocks.management.commands.fortune500 import all_fortune_500
from rag.models import SECFiling
from rag.ingestion.sec_edgar import fetch_filings_for_symbol, get_cik_for_symbol, cleanup_browser

logger = logging.getLogger(__name__)


class RateLimiter:
    """Token bucket rate limiter for SEC EDGAR (10 req/sec limit)."""

    def __init__(self, qps=5):
        self.qps = qps
        self.lock = threading.Lock()
        self.request_times = deque()

    def acquire(self):
        while True:
            with self.lock:
                now = time.time()
                while self.request_times and self.request_times[0] < now - 1:
                    self.request_times.popleft()
                if len(self.request_times) < self.qps:
                    self.request_times.append(now)
                    return
            time.sleep(0.05)


class Command(BaseCommand):
    help = 'Fetch SEC EDGAR filings (10-K, 10-Q, 8-K) for stocks in the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--symbols',
            type=str,
            help='Comma-separated list of stock symbols (default: all S&P 500)',
        )
        parser.add_argument(
            '--filing-types',
            type=str,
            default='10-K,10-Q,8-K',
            help='Comma-separated filing types to fetch (default: 10-K,10-Q,8-K)',
        )
        parser.add_argument(
            '--count',
            type=int,
            default=5,
            help='Number of most recent filings per type per company (default: 5)',
        )
        parser.add_argument(
            '--workers',
            type=int,
            default=2,
            help='Number of concurrent workers (default: 2, keep low for SEC rate limits)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            default=False,
            help='Re-download and overwrite existing filings (default: False)',
        )
        parser.add_argument(
            '--sp500-only',
            action='store_true',
            default=False,
            help='Only fetch for S&P 500 companies',
        )
        parser.add_argument(
            '--qps',
            type=int,
            default=5,
            help='Queries per second limit (default: 5, SEC allows 10)',
        )

    def handle(self, *args, **options):
        symbols = options['symbols']
        filing_types = [ft.strip() for ft in options['filing_types'].split(',')]
        count = options['count']
        workers = options['workers']
        force = options['force']
        sp500_only = options['sp500_only']
        qps = options['qps']

        # Determine which symbols to fetch
        if symbols:
            symbol_list = [s.strip().upper() for s in symbols.split(',')]
        elif sp500_only:
            # Use fortune500.py list since is_sp500 flag may not be set
            symbol_list = sorted(all_fortune_500.keys())
        else:
            symbol_list = list(
                Stock.objects.all()
                .values_list('symbol', flat=True)
                .order_by('symbol')
            )

        self.stdout.write(f"Fetching SEC filings for {len(symbol_list)} companies")
        self.stdout.write(f"Filing types: {filing_types}")
        self.stdout.write(f"Count per type: {count}")
        self.stdout.write(f"Workers: {workers}, QPS limit: {qps}")
        self.stdout.write("-" * 60)

        # Build CIK lookup from StockOverview where available
        cik_map = {}
        overviews = StockOverview.objects.filter(
            stock__symbol__in=symbol_list,
            cik__isnull=False,
        ).exclude(cik='').select_related('stock')

        for ov in overviews:
            cik_map[ov.stock.symbol] = ov.cik.zfill(10)

        self.stdout.write(f"Found CIKs for {len(cik_map)}/{len(symbol_list)} companies from StockOverview")

        rate_limiter = RateLimiter(qps=qps)
        stats = {
            'processed': 0,
            'filings_created': 0,
            'filings_updated': 0,
            'filings_skipped': 0,
            'filings_rejected': 0,
            'errors': 0,
            'lock': threading.Lock(),
        }

        def is_quality_filing(html_content, raw_text, sections, meta):
            """Validate that we have useful data before writing to DB."""
            # Must have HTML content of reasonable size
            if not html_content or len(html_content) < 500:
                logger.warning(f"  {meta['accession_number']}: HTML too short ({len(html_content or '')} chars)")
                return False

            # Must have extractable text
            if not raw_text or len(raw_text) < 200:
                logger.warning(f"  {meta['accession_number']}: Extracted text too short ({len(raw_text or '')} chars)")
                return False

            # Check for SEC error/maintenance pages
            error_markers = [
                'request could not be fulfilled',
                'system is currently under maintenance',
                'page not found',
                'access denied',
                'error 404',
                'error 503',
            ]
            text_lower = raw_text[:2000].lower()
            for marker in error_markers:
                if marker in text_lower:
                    logger.warning(f"  {meta['accession_number']}: Looks like an error page ('{marker}')")
                    return False

            # For 10-K/10-Q, we should extract at least some sections
            if meta['filing_type'] in ('10-K', '10-Q', '10-K/A', '10-Q/A'):
                if not sections or len(sections) < 1:
                    logger.warning(f"  {meta['accession_number']}: No sections extracted for {meta['filing_type']}")
                    return False

            return True

        def fetch_task(symbol):
            try:
                cik = cik_map.get(symbol)

                # If no CIK in DB, look it up from SEC
                if not cik:
                    rate_limiter.acquire()
                    cik = get_cik_for_symbol(symbol)
                    if not cik:
                        with stats['lock']:
                            stats['errors'] += 1
                        return

                # Check which filings already exist
                existing_accessions = set()
                if not force:
                    existing_accessions = set(
                        SECFiling.objects.filter(symbol=symbol)
                        .values_list('accession_number', flat=True)
                    )

                # Fetch filing metadata
                rate_limiter.acquire()
                from rag.ingestion.sec_edgar import get_company_filings
                filings_meta, company_name = get_company_filings(cik, filing_types, count)

                created = 0
                updated = 0
                skipped = 0
                rejected = 0

                for meta in filings_meta:
                    is_existing = meta['accession_number'] in existing_accessions
                    if is_existing and not force:
                        skipped += 1
                        continue

                    # Download and parse the filing
                    rate_limiter.acquire()
                    from rag.ingestion.sec_edgar import (
                        download_filing_document,
                        extract_text_from_html,
                        extract_sections,
                        extract_tables,
                        extract_image_urls,
                        extract_exhibits,
                    )
                    html_content = download_filing_document(meta['document_url'])
                    if not html_content:
                        rejected += 1
                        continue

                    raw_text = extract_text_from_html(html_content)
                    sections = extract_sections(raw_text, meta['filing_type'])
                    tables = extract_tables(html_content)
                    image_urls = extract_image_urls(html_content, meta['document_url'])

                    # Quality check before writing
                    if not is_quality_filing(html_content, raw_text, sections, meta):
                        rejected += 1
                        continue

                    rate_limiter.acquire()
                    exhibits = extract_exhibits(cik, meta['accession_number'])

                    filing_data = {
                        'symbol': symbol,
                        'company_name': company_name,
                        'cik': cik,
                        'filing_type': meta['filing_type'],
                        'filing_date': meta['filing_date'],
                        'report_date': meta.get('report_date') or None,
                        'filing_url': meta['filing_url'],
                        'document_url': meta['document_url'],
                        'raw_html': html_content[:2000000],
                        'sections': sections,
                        'raw_text': raw_text[:1000000],
                        'tables': tables[:500],
                        'image_urls': image_urls[:200],
                        'exhibits': exhibits,
                        'file_size': len(html_content),
                    }

                    if force and is_existing:
                        # Overwrite existing filing
                        SECFiling.objects.filter(
                            accession_number=meta['accession_number']
                        ).update(**filing_data)
                        updated += 1
                    else:
                        SECFiling.objects.create(
                            accession_number=meta['accession_number'],
                            **filing_data,
                        )
                        created += 1

                with stats['lock']:
                    stats['processed'] += 1
                    stats['filings_created'] += created
                    stats['filings_updated'] += updated
                    stats['filings_skipped'] += skipped
                    stats['filings_rejected'] += rejected
                    progress = stats['processed']

                parts = []
                if created:
                    parts.append(f"{created} created")
                if updated:
                    parts.append(f"{updated} updated")
                if skipped:
                    parts.append(f"{skipped} skipped")
                if rejected:
                    parts.append(f"{rejected} rejected")
                self.stdout.write(
                    f"[{progress}/{len(symbol_list)}] {symbol}: {', '.join(parts) or 'no filings found'}"
                )

            except Exception as e:
                with stats['lock']:
                    stats['processed'] += 1
                    stats['errors'] += 1
                self.stdout.write(self.style.ERROR(
                    f"[{stats['processed']}/{len(symbol_list)}] {symbol}: ERROR - {e}"
                ))
            finally:
                close_old_connections()

        # Run with ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = [executor.submit(fetch_task, symbol) for symbol in symbol_list]
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Unhandled error: {e}"))

        # Clean up Playwright browsers
        cleanup_browser()

        # Summary
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS(f"Completed!"))
        self.stdout.write(f"  Companies processed: {stats['processed']}")
        self.stdout.write(f"  Filings created: {stats['filings_created']}")
        if stats['filings_updated']:
            self.stdout.write(f"  Filings updated (force): {stats['filings_updated']}")
        self.stdout.write(f"  Filings skipped (existing): {stats['filings_skipped']}")
        if stats['filings_rejected']:
            self.stdout.write(self.style.WARNING(f"  Filings rejected (bad data): {stats['filings_rejected']}"))
        self.stdout.write(f"  Errors: {stats['errors']}")

        total_filings = SECFiling.objects.count()
        self.stdout.write(f"  Total filings in database: {total_filings}")
