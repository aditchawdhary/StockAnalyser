#!/usr/bin/env python
"""
Deployment script for Railway.
Ensures database tables are properly created.
"""
import os
import sys

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

print("=" * 50, flush=True)
print("DEPLOY.PY STARTING...", flush=True)
print("=" * 50, flush=True)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'stock_backend.settings')

print("Setting up Django...", flush=True)
import django
django.setup()
print("Django setup complete.", flush=True)

from django.core.management import call_command
from django.db import connection

def check_table_exists(table_name):
    """Check if a table exists in the database."""
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = %s
            );
        """, [table_name])
        return cursor.fetchone()[0]

def clear_migration_records(app_label):
    """Clear migration records for an app to allow re-running migrations."""
    with connection.cursor() as cursor:
        cursor.execute(
            "DELETE FROM django_migrations WHERE app = %s;",
            [app_label]
        )
        print(f"Cleared migration records for {app_label}", flush=True)

def main():
    print("Checking database tables...", flush=True)

    # Check if stocks_stock table exists
    stocks_table_exists = check_table_exists('stocks_stock')
    print(f"stocks_stock table exists: {stocks_table_exists}", flush=True)

    if not stocks_table_exists:
        print("stocks_stock table NOT FOUND!", flush=True)
        print("Clearing migration records for stocks app...", flush=True)

        # Clear stocks app migration records
        try:
            clear_migration_records('stocks')
        except Exception as e:
            print(f"Could not clear migration records: {e}", flush=True)

        # Run migrations
        print("Running migrations with verbosity=2...", flush=True)
        call_command('migrate', '--run-syncdb', verbosity=2)

        # Verify table was created
        if check_table_exists('stocks_stock'):
            print("SUCCESS: stocks_stock table created!", flush=True)
        else:
            print("ERROR: stocks_stock table still not found after migration!", flush=True)
            # Don't exit, let gunicorn start anyway for debugging
    else:
        print("Table already exists, running normal migrations...", flush=True)
        call_command('migrate', '--run-syncdb', verbosity=2)

    # Collect static files
    print("Collecting static files...", flush=True)
    call_command('collectstatic', '--noinput')

    # Seed initial stock data if database is empty
    seed_initial_stocks()

    # Download logos for stocks that don't have one yet
    seed_logos()

    print("=" * 50, flush=True)
    print("DEPLOY.PY COMPLETED!", flush=True)
    print("=" * 50, flush=True)


def seed_initial_stocks():
    """Fetch all S&P 500 stock data (weekly, daily, intraday) if the database is empty."""
    from stocks.models import Stock
    import os

    api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
    if not api_key:
        print("WARNING: ALPHA_VANTAGE_API_KEY not set, skipping stock seed", flush=True)
        return

    stock_count = Stock.objects.count()
    print(f"Current stock count: {stock_count}", flush=True)

    if stock_count == 0:
        print("Database is empty, seeding ALL S&P 500 stocks...", flush=True)
        print("Using FAST concurrent fetcher (70 QPM, 4 QPS, 5 workers)", flush=True)
        print("Estimated time: ~20-25 minutes for all data types", flush=True)

        try:
            # Use the fast concurrent fetcher for all data types
            call_command(
                'fetch_stocks_fast',
                all=True,
                force=True,
                weekly=True,
                daily=True,
                intraday=True,
                workers=5,
                qpm=70,
                qps=4
            )

            new_count = Stock.objects.count()
            print(f"\nSuccessfully seeded {new_count} stocks with weekly, daily, and intraday data!", flush=True)
        except Exception as e:
            print(f"Warning: Error seeding stocks: {e}", flush=True)
            import traceback
            traceback.print_exc()
    else:
        print(f"Database already has {stock_count} stocks, skipping seed.", flush=True)


def seed_logos():
    """Download logos for stocks that don't have one yet."""
    from stocks.models import Stock

    missing_count = Stock.objects.filter(logo__isnull=True).count()

    if missing_count > 0:
        print(f"Downloading logos for {missing_count} stocks...", flush=True)
        try:
            call_command('fetch_logos', workers=10)
        except Exception as e:
            print(f"Warning: Error downloading logos: {e}", flush=True)
            import traceback
            traceback.print_exc()
    else:
        print("All stocks already have logos.", flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"DEPLOY.PY ERROR: {e}", flush=True)
        import traceback
        traceback.print_exc()
        # Don't exit with error, let gunicorn try to start
        print("Continuing despite error...", flush=True)
