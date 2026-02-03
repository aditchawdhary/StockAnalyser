#!/usr/bin/env python
"""
Deployment script for Railway.
Ensures database tables are properly created.
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'stock_backend.settings')
django.setup()

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
        print(f"Cleared migration records for {app_label}")

def main():
    print("=" * 50)
    print("Starting deployment script...")
    print("=" * 50)

    # Check if stocks_stock table exists
    stocks_table_exists = check_table_exists('stocks_stock')
    print(f"stocks_stock table exists: {stocks_table_exists}")

    if not stocks_table_exists:
        print("stocks_stock table not found. Clearing migration records and re-running...")

        # Clear stocks app migration records
        try:
            clear_migration_records('stocks')
        except Exception as e:
            print(f"Could not clear migration records: {e}")

        # Run migrations
        print("Running migrations...")
        call_command('migrate', '--run-syncdb', verbosity=2)

        # Verify table was created
        if check_table_exists('stocks_stock'):
            print("SUCCESS: stocks_stock table created!")
        else:
            print("ERROR: stocks_stock table still not found!")
            sys.exit(1)
    else:
        print("Table already exists, running normal migrations...")
        call_command('migrate', '--run-syncdb', verbosity=2)

    # Collect static files
    print("Collecting static files...")
    call_command('collectstatic', '--noinput')

    print("=" * 50)
    print("Deployment script completed!")
    print("=" * 50)

if __name__ == '__main__':
    main()
