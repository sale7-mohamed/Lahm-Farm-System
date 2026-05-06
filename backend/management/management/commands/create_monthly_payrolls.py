# management/management/commands/create_monthly_payrolls.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from management.models import Employee, Payroll, PayrollEntry
from decimal import Decimal

class Command(BaseCommand):
    help = 'Creates payroll records for all active employees for the current month if not already created.'

    @transaction.atomic
    def handle(self, *args, **options):
        now = timezone.now()
        current_month = now.month
        current_year = now.year

        self.stdout.write(f"Starting payroll creation for {current_month}/{current_year}...")

        active_employees = Employee.objects.filter(is_active=True)

        created_count = 0

        for employee in active_employees:
            payroll, created = Payroll.objects.get_or_create(
                employee=employee,
                month=current_month,
                year=current_year
            )

            if created:
                if employee.base_salary and employee.base_salary > 0:
                    PayrollEntry.objects.create(
                        payroll=payroll,
                        entry_type='base_salary',
                        description='الراتب الأساسي',
                        amount=employee.base_salary
                    )
                    payroll.net_salary = employee.base_salary
                    payroll.save(update_fields=['net_salary'])

                self.stdout.write(self.style.SUCCESS(f'Successfully created payroll for {employee.full_name}.'))
                created_count += 1
            else:
                self.stdout.write(f'Payroll for {employee.full_name} for this month already exists. Skipping.')

        self.stdout.write(self.style.SUCCESS(f'Payroll creation complete. {created_count} new records created.'))
