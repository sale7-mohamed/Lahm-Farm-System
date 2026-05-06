# management/management/commands/backfill_password_logs.py

from django.core.management.base import BaseCommand
from django.utils import timezone
from management.models import Employee, PasswordChangeLog

class Command(BaseCommand):
    help = 'إضافة سجلات تاريخية لتغييرات كلمة المرور للموظفين الحاليين'

    def handle(self, *args, **options):
        employees = Employee.objects.all()

        for employee in employees:

            existing_logs = PasswordChangeLog.objects.filter(employee=employee).count()

            #  FIX: Changed from 'date_joined' to 'hire_date'
            if existing_logs == 0 and employee.hire_date:

                PasswordChangeLog.objects.create(
                    employee=employee,
                    changed_by=None,
                    timestamp=employee.hire_date,
                    notes="كلمة المرور الأولية (تمت إضافتها تلقائياً)"
                )

                employee.last_password_change = employee.hire_date
                employee.save(update_fields=['last_password_change'])

                self.stdout.write(
                    self.style.SUCCESS(f'تمت إضافة سجل لكلمة مرور الموظف: {employee.full_name}')
                )

        self.stdout.write(
            self.style.SUCCESS(f'تمت إضافة السجلات التاريخية لـ {len(employees)} موظف')
        )
