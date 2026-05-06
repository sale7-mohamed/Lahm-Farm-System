# management/management/commands/setup_permissions.py
from django.core.management.base import BaseCommand
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from management.models import EmployeeRole

class Command(BaseCommand):
    help = 'Assigns a comprehensive set of permissions to the default employee roles.'

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("Starting to assign permissions to roles...")

        #    'management.view_dashboard'      
        OTHER_ROLE_PERMISSIONS = {
            'مسؤول مبيعات': [
                'management.view_dashboard',
                'orders.view_order', 'orders.change_order', 'orders.add_order',
                'livestock.view_animal', 'accounts.view_user', 'accounts.change_user',
                'orders.view_specialrequest', 'orders.add_specialrequest',
            ],
            'أمين مخزن': [
                'management.view_dashboard',
                'management.view_inventoryitem', 'management.add_stockmovement',
                'management.view_stockmovement', 'management.view_supplier'
            ],
            'طبيب بيطري': [
                'livestock.view_animal', 'management.add_healthlog',
                'management.view_healthlog', 'management.change_healthlog'
            ],
            'عامل رعاية': [
                'livestock.view_animal', 'management.add_feedinglog',
                'management.view_feedinglog', 'management.add_weightlog', 'management.view_weightlog'
            ],
        }

        for role_name, perms_list in OTHER_ROLE_PERMISSIONS.items():
            try:
                role = EmployeeRole.objects.get(name=role_name)
                permissions_to_add = []
                for perm_str in perms_list:
                    try:
                        app_label, codename = perm_str.split('.')
                        permission = Permission.objects.get(content_type__app_label=app_label, codename=codename)
                        permissions_to_add.append(permission)
                    except Permission.DoesNotExist:
                        self.stdout.write(self.style.WARNING(f'Permission "{perm_str}" for role "{role_name}" not found. Skipping.'))

                #  set        (    )

                role.permissions.add(*permissions_to_add)

                self.stdout.write(self.style.SUCCESS(f'Successfully assigned/updated permissions for role: {role_name}'))

            except EmployeeRole.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'Role "{role_name}" not found. Skipping.'))

        # ---    " "   ---
        try:
            manager_role = EmployeeRole.objects.get(name='مدير المزرعة')

            #   Django      
            excluded_apps = ['admin', 'auth', 'contenttypes', 'sessions']
            content_types = ContentType.objects.exclude(app_label__in=excluded_apps)

            all_permissions = Permission.objects.filter(content_type__in=content_types)

            manager_role.permissions.set(all_permissions)

            self.stdout.write(self.style.SUCCESS(f'Successfully assigned all {all_permissions.count()} permissions to "مدير المزرعة".'))

        except EmployeeRole.DoesNotExist:
            self.stdout.write(self.style.ERROR('The "مدير المزرعة" role was not found. Please run `setup_management` first.'))

        self.stdout.write(self.style.SUCCESS('Permission setup is complete.'))
