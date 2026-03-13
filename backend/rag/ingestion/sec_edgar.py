import re
import time
import logging
import threading
import requests
from urllib.parse import urljoin
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# SEC EDGAR requires a User-Agent with company name and email
SEC_HEADERS = {
    'User-Agent': 'VectorAnalysis research@vectoranalysis.app',
    'Accept-Encoding': 'gzip, deflate',
}

# Conservative rate limiting: SEC allows 10 req/sec but throttles aggressively
SEC_REQUEST_DELAY = 1.0  # 1 second between every request
MAX_RETRIES = 5
RETRY_BACKOFF = [10, 20, 40, 60, 90]

# Reusable session for connection pooling
_session = requests.Session()
_session.headers.update(SEC_HEADERS)

# Cached CIK lookup (downloaded once, used for all symbols)
_cik_cache = {}
_cik_cache_lock = threading.Lock()


def _request_with_retry(url, timeout=60):
    """Make an HTTP GET with retry on 503/429/403 errors."""
    for attempt in range(MAX_RETRIES):
        time.sleep(SEC_REQUEST_DELAY)
        try:
            response = _session.get(url, timeout=timeout)
            if response.status_code in (503, 429, 403):
                wait = RETRY_BACKOFF[attempt] if attempt < len(RETRY_BACKOFF) else 30
                logger.warning(f"  {response.status_code} on {url[:80]}... retrying in {wait}s (attempt {attempt + 1}/{MAX_RETRIES})")
                time.sleep(wait)
                continue
            response.raise_for_status()
            return response
        except requests.ConnectionError as e:
            wait = RETRY_BACKOFF[attempt] if attempt < len(RETRY_BACKOFF) else 30
            logger.warning(f"  Connection error: {e} - retrying in {wait}s")
            time.sleep(wait)
            continue
    logger.warning(f"  Failed after {MAX_RETRIES} retries: {url[:80]}...")
    return None


# 10-K section patterns for extraction
SECTION_PATTERNS_10K = {
    'Item 1': r'(?:item\s*1[.\s]*[-–—]?\s*business)',
    'Item 1A': r'(?:item\s*1a[.\s]*[-–—]?\s*risk\s*factors)',
    'Item 1B': r'(?:item\s*1b[.\s]*[-–—]?\s*unresolved\s*staff\s*comments)',
    'Item 2': r'(?:item\s*2[.\s]*[-–—]?\s*properties)',
    'Item 3': r'(?:item\s*3[.\s]*[-–—]?\s*legal\s*proceedings)',
    'Item 5': r'(?:item\s*5[.\s]*[-–—]?\s*market)',
    'Item 6': r'(?:item\s*6[.\s]*[-–—]?\s*(?:selected|reserved))',
    'Item 7': r'(?:item\s*7[.\s]*[-–—]?\s*management)',
    'Item 7A': r'(?:item\s*7a[.\s]*[-–—]?\s*quantitative)',
    'Item 8': r'(?:item\s*8[.\s]*[-–—]?\s*financial\s*statements)',
}

# 10-Q section patterns
SECTION_PATTERNS_10Q = {
    'Part I Item 1': r'(?:item\s*1[.\s]*[-–—]?\s*financial\s*statements)',
    'Part I Item 2': r'(?:item\s*2[.\s]*[-–—]?\s*management.*discussion)',
    'Part I Item 3': r'(?:item\s*3[.\s]*[-–—]?\s*quantitative)',
    'Part I Item 4': r'(?:item\s*4[.\s]*[-–—]?\s*controls)',
    'Part II Item 1': r'(?:item\s*1[.\s]*[-–—]?\s*legal)',
    'Part II Item 1A': r'(?:item\s*1a[.\s]*[-–—]?\s*risk)',
    'Part II Item 5': r'(?:item\s*5[.\s]*[-–—]?\s*other)',
    'Part II Item 6': r'(?:item\s*6[.\s]*[-–—]?\s*exhibits)',
}


def _load_cik_cache():
    """Download company_tickers.json once and cache the symbol->CIK mapping."""
    with _cik_cache_lock:
        if _cik_cache:
            return
        logger.info("Downloading SEC company tickers (one-time)...")
        url = 'https://www.sec.gov/files/company_tickers.json'
        response = _request_with_retry(url)
        if not response:
            logger.error("Failed to download company tickers JSON")
            return
        tickers = response.json()
        for entry in tickers.values():
            symbol = entry.get('ticker', '').upper()
            cik = str(entry.get('cik_str', ''))
            if symbol and cik:
                _cik_cache[symbol] = cik.zfill(10)
        logger.info(f"Cached CIKs for {len(_cik_cache)} companies")


def get_cik_for_symbol(symbol):
    """Look up CIK number for a stock symbol (uses cached data)."""
    if not _cik_cache:
        _load_cik_cache()
    return _cik_cache.get(symbol.upper())


def get_company_filings(cik, filing_types=None, count=40):
    """
    Fetch filing metadata from SEC EDGAR for a given CIK.
    Returns a list of filing dicts with accession numbers, dates, and URLs.
    """
    if filing_types is None:
        filing_types = ['10-K', '10-Q', '8-K']

    cik_padded = str(cik).zfill(10)
    url = f'https://data.sec.gov/submissions/CIK{cik_padded}.json'

    response = _request_with_retry(url)
    if not response:
        return [], ''

    data = response.json()
    company_name = data.get('name', '')
    # Use the unpadded CIK for Archive URLs (SEC requires this)
    cik_number = str(int(cik_padded))
    recent = data.get('filings', {}).get('recent', {})

    if not recent:
        return [], company_name

    forms = recent.get('form', [])
    accession_numbers = recent.get('accessionNumber', [])
    filing_dates = recent.get('filingDate', [])
    report_dates = recent.get('reportDate', [])
    primary_docs = recent.get('primaryDocument', [])

    filings = []
    for i in range(len(forms)):
        form = forms[i]
        if form not in filing_types:
            continue

        accession = accession_numbers[i]
        accession_no_dashes = accession.replace('-', '')
        primary_doc = primary_docs[i] if i < len(primary_docs) else ''

        filing_url = f'https://www.sec.gov/Archives/edgar/data/{cik_number}/{accession_no_dashes}/{accession}-index.htm'
        document_url = f'https://www.sec.gov/Archives/edgar/data/{cik_number}/{accession_no_dashes}/{primary_doc}' if primary_doc else ''

        filings.append({
            'filing_type': form,
            'accession_number': accession,
            'filing_date': filing_dates[i] if i < len(filing_dates) else None,
            'report_date': report_dates[i] if i < len(report_dates) else None,
            'filing_url': filing_url,
            'document_url': document_url,
            'primary_document': primary_doc,
        })

        if len(filings) >= count:
            break

    return filings, company_name


def download_filing_document(document_url):
    """Download the actual filing document (HTML) from SEC EDGAR."""
    if not document_url:
        return None

    response = _request_with_retry(document_url, timeout=90)
    if not response:
        return None
    return response.text


def extract_text_from_html(html_content):
    """Strip HTML tags and extract clean text from a filing document."""
    if not html_content:
        return ''

    soup = BeautifulSoup(html_content, 'html.parser')

    # Remove script, style, and hidden elements
    for element in soup(['script', 'style', 'meta', 'link']):
        element.decompose()

    # Get text with some structure preserved
    text = soup.get_text(separator='\n')

    # Clean up whitespace
    lines = []
    for line in text.splitlines():
        cleaned = line.strip()
        if cleaned:
            lines.append(cleaned)

    return '\n'.join(lines)


def extract_tables(html_content):
    """
    Extract tables from HTML, preserving structure as both HTML and readable text.
    Returns a list of dicts: [{"title": "...", "html": "<table>...</table>", "text": "..."}]
    """
    if not html_content:
        return []

    soup = BeautifulSoup(html_content, 'html.parser')
    tables = []

    for table in soup.find_all('table'):
        title = ''
        caption = table.find('caption')
        if caption:
            title = caption.get_text(strip=True)
        else:
            prev = table.find_previous_sibling()
            if prev and prev.name in ('p', 'div', 'span', 'b', 'strong'):
                candidate = prev.get_text(strip=True)
                if len(candidate) < 200:
                    title = candidate

        rows = []
        for tr in table.find_all('tr'):
            cells = []
            for td in tr.find_all(['td', 'th']):
                cell_text = td.get_text(strip=True)
                cells.append(cell_text)
            if any(cells):
                rows.append('\t'.join(cells))

        text = '\n'.join(rows)

        if len(text) < 50:
            continue

        table_html = str(table)[:100000]

        tables.append({
            'title': title[:200],
            'html': table_html,
            'text': text[:50000],
        })

    return tables


def extract_image_urls(html_content, document_url):
    """
    Extract all image URLs from the filing HTML.
    Resolves relative URLs to absolute SEC EDGAR URLs.
    """
    if not html_content:
        return []

    soup = BeautifulSoup(html_content, 'html.parser')
    image_urls = []

    for img in soup.find_all('img'):
        src = img.get('src', '')
        if not src:
            continue

        width = img.get('width', '')
        height = img.get('height', '')
        try:
            if width and int(width) < 20 and height and int(height) < 20:
                continue
        except (ValueError, TypeError):
            pass

        if src.startswith(('http://', 'https://')):
            abs_url = src
        elif document_url:
            base_url = document_url.rsplit('/', 1)[0] + '/'
            abs_url = urljoin(base_url, src)
        else:
            continue

        alt = img.get('alt', '').strip()

        image_urls.append({
            'url': abs_url,
            'alt': alt[:200],
        })

    return image_urls


def extract_exhibits(cik, accession_number):
    """
    Fetch the filing index page and extract exhibit information.
    Returns a list of dicts: [{"type": "EX-21", "url": "...", "description": "..."}]
    """
    cik_number = str(int(cik))
    accession_no_dashes = accession_number.replace('-', '')
    index_url = f'https://www.sec.gov/Archives/edgar/data/{cik_number}/{accession_no_dashes}/{accession_number}-index.htm'

    response = _request_with_retry(index_url, timeout=60)
    if not response:
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    exhibits = []

    for row in soup.find_all('tr'):
        cells = row.find_all('td')
        if len(cells) < 3:
            continue

        doc_type = cells[3].get_text(strip=True) if len(cells) > 3 else ''
        description = cells[1].get_text(strip=True) if len(cells) > 1 else ''

        if doc_type.upper().startswith('EX-') or 'exhibit' in description.lower():
            link = cells[2].find('a') if len(cells) > 2 else None
            if not link:
                link = row.find('a')

            doc_url = ''
            if link and link.get('href'):
                href = link['href']
                if href.startswith('/'):
                    doc_url = f'https://www.sec.gov{href}'
                elif href.startswith('http'):
                    doc_url = href

            exhibits.append({
                'type': doc_type[:50],
                'url': doc_url,
                'description': description[:300],
            })

    return exhibits


def extract_sections(text, filing_type='10-K'):
    """
    Extract named sections from a filing's text.
    Returns a dict of section_name -> section_text.
    """
    if filing_type in ('10-K', '10-K/A'):
        patterns = SECTION_PATTERNS_10K
    elif filing_type in ('10-Q', '10-Q/A'):
        patterns = SECTION_PATTERNS_10Q
    else:
        return {'Full Text': text[:500000]}

    sections = {}
    text_lower = text.lower()

    section_positions = []
    for section_name, pattern in patterns.items():
        matches = list(re.finditer(pattern, text_lower))
        if matches:
            match = matches[-1]
            section_positions.append((match.start(), section_name))

    section_positions.sort(key=lambda x: x[0])

    for i, (start_pos, section_name) in enumerate(section_positions):
        if i + 1 < len(section_positions):
            end_pos = section_positions[i + 1][0]
        else:
            end_pos = min(start_pos + 200000, len(text))

        section_text = text[start_pos:end_pos].strip()

        if len(section_text) > 200:
            sections[section_name] = section_text

    return sections


def fetch_filings_for_symbol(symbol, cik=None, filing_types=None, count=10):
    """
    Full pipeline: look up CIK, get filing metadata, download documents,
    extract text and sections. Returns a list of filing dicts ready for DB storage.
    """
    if filing_types is None:
        filing_types = ['10-K', '10-Q', '8-K']

    if not cik:
        logger.info(f"Looking up CIK for {symbol}...")
        cik = get_cik_for_symbol(symbol)
        if not cik:
            logger.error(f"Could not find CIK for {symbol}")
            return []

    logger.info(f"Fetching filings for {symbol} (CIK: {cik})...")
    filings_meta, company_name = get_company_filings(cik, filing_types, count)

    results = []
    for meta in filings_meta:
        logger.info(f"  Downloading {meta['filing_type']} filed {meta['filing_date']}...")

        html_content = download_filing_document(meta['document_url'])
        if not html_content:
            logger.warning(f"  Skipping - could not download document")
            continue

        raw_text = extract_text_from_html(html_content)
        sections = extract_sections(raw_text, meta['filing_type'])
        tables = extract_tables(html_content)
        image_urls = extract_image_urls(html_content, meta['document_url'])
        exhibits = extract_exhibits(cik, meta['accession_number'])

        logger.info(
            f"    Extracted: {len(sections)} sections, "
            f"{len(tables)} tables, {len(image_urls)} images, "
            f"{len(exhibits)} exhibits"
        )

        results.append({
            'symbol': symbol.upper(),
            'company_name': company_name,
            'cik': cik,
            'accession_number': meta['accession_number'],
            'filing_type': meta['filing_type'],
            'filing_date': meta['filing_date'],
            'report_date': meta['report_date'] or None,
            'filing_url': meta['filing_url'],
            'document_url': meta['document_url'],
            'raw_html': html_content[:2000000],
            'sections': sections,
            'raw_text': raw_text[:1000000],
            'tables': tables[:500],
            'image_urls': image_urls[:200],
            'exhibits': exhibits,
            'file_size': len(html_content),
        })

    return results


# No-op for backwards compatibility with management command import
def cleanup_browser():
    pass
