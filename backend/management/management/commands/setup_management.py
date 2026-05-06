# management/management/commands/setup_management.py

from django.core.management.base import BaseCommand
from django.db import transaction

class Command(BaseCommand):
    help = 'تهيئة بيانات الإدارة الأولية من أقسام وأدوار وظيفية.'

    @transaction.atomic
    def handle(self, *args, **options):

        from management.models import FarmDepartment, EmployeeRole

        self.stdout.write("Starting to set up initial management data...")

        departments_data = [
            {'name': 'الإدارة', 'description': 'القسم الإداري العام للمزرعة'},
            {'name': 'المبيعات والتسويق', 'description': 'قسم المبيعات والتسويق وخدمة العملاء'},
            {'name': 'إدارة المخزون', 'description': 'قسم إدارة المخزون والمشتريات'},
            {'name': 'الرعاية والإنتاج', 'description': 'قسم رعاية الحيوانات والإنتاج'},
        ]

        departments = {}
        for dept_data in departments_data:
            department, created = FarmDepartment.objects.get_or_create(
                name=dept_data['name'],
                defaults={'description': dept_data['description']}
            )
            departments[dept_data['name']] = department
            if created:
                self.stdout.write(self.style.SUCCESS(f'Successfully created department: {department.name}'))
            else:
                self.stdout.write(f'Department already exists: {department.name}')

        roles_data = [
            {'name': 'مدير المزرعة', 'department': departments['الإدارة']},
            {'name': 'مسؤول مبيعات', 'department': departments['المبيعات والتسويق']},
            {'name': 'أمين مخزن', 'department': departments['إدارة المخزون']},
            {'name': 'طبيب بيطري', 'department': departments['الرعاية والإنتاج']},
            {'name': 'عامل رعاية', 'department': departments['الرعاية والإنتاج']},
        ]

        for role_data in roles_data:
            role, created = EmployeeRole.objects.get_or_create(
                name=role_data['name'],
                department=role_data['department']
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Successfully created role: {role.name}'))
            else:
                self.stdout.write(f'Role already exists: {role.name}')

        self.stdout.write(self.style.SUCCESS('Management data setup is complete.'))
