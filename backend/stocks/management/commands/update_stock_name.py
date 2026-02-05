from django.core.management.base import BaseCommand
from stocks.models import Stock
from .top5kcompanies import all_5k_stocks

class Command(BaseCommand):
    help = 'Update stock names from fortune500 dictionary'

    def handle(self, *args, **options):
        updated = 0
        
        for symbol, name in all_5k_stocks.items():
            try:
                stock = Stock.objects.get(symbol=symbol)
                if stock.name != name:
                    stock.name = name
                    stock.save()
                    self.stdout.write(self.style.SUCCESS(f'{symbol}: Updated name to "{name}"'))
                    updated += 1
            except Stock.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'{symbol}: Not found in database'))
        
        self.stdout.write(self.style.SUCCESS(f'\nUpdated {updated} stock names'))