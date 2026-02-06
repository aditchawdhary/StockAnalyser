"""
Management command to manually compute stock performance metrics.
Useful for debugging or if metrics need to be refreshed independently.
"""
from django.core.management.base import BaseCommand
from stocks.services.performance_calculator import PerformanceCalculator


class Command(BaseCommand):
    help = 'Compute and cache stock performance metrics for all time periods'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Computing performance metrics...'))

        calculator = PerformanceCalculator(stdout=self.stdout)
        results = calculator.compute_all()

        self.stdout.write(self.style.SUCCESS(
            f'\nComplete! Computed {results["computed"]} performance records.'
        ))
