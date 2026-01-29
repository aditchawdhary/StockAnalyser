from django.core.management.base import BaseCommand
from stocks.models import Stock
from .fortune500 import all_fortune_500

class Command(BaseCommand):
    help = 'Update stock names from fortune500 dictionary'

    def handle(self, *args, **options):
        updated = 0
        
        for symbol, name in all_fortune_500.items():
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