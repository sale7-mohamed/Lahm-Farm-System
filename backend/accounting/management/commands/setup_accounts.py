from django.core.management.base import BaseCommand
from accounting.models import Account

class Command(BaseCommand):
    help = 'Creates or updates the chart of accounts for the farm management system.'

    def handle(self, *args, **options):
        accounts = [
            # Assets (1xxx)
            {'account_number': '1010', 'name': 'Cash and Bank', 'account_type': 'ASSET'},
            {'account_number': '1200', 'name': 'Livestock Inventory', 'account_type': 'ASSET'},
            {'account_number': '1210', 'name': 'Feed Inventory', 'account_type': 'ASSET'},
            {'account_number': '1220', 'name': 'Medicine Inventory', 'account_type': 'ASSET'},

            # Liabilities (2xxx)
            {'account_number': '2000', 'name': 'Accounts Payable', 'account_type': 'LIABILITY'},

            # Equity (3xxx)
            {'account_number': '3000', 'name': 'Owner\'s Equity', 'account_type': 'EQUITY'},

            # Revenue (4xxx)
            {'account_number': '4000', 'name': 'Sales Revenue', 'account_type': 'REVENUE'},
            {'account_number': '4100', 'name': 'Internal Livestock Production', 'account_type': 'REVENUE'},

            # Cost of Goods Sold & Expenses (5xxx, 6xxx)
            {'account_number': '5000', 'name': 'Cost of Goods Sold (COGS)', 'account_type': 'COGS'},
            {'account_number': '5100', 'name': 'Feed Expense/Consumption', 'account_type': 'COGS'},
            {'account_number': '5200', 'name': 'Livestock Losses', 'account_type': 'EXPENSE'},
            {'account_number': '6000', 'name': 'Salaries and Wages Expense', 'account_type': 'EXPENSE'},
            {'account_number': '6100', 'name': 'Rent Expense', 'account_type': 'EXPENSE'},
            {'account_number': '6200', 'name': 'Utilities Expense (Water, Electricity)', 'account_type': 'EXPENSE'},
            {'account_number': '6300', 'name': 'Veterinary Services Expense', 'account_type': 'EXPENSE'},
        ]

        for acc_data in accounts:
            account, created = Account.objects.get_or_create(
                account_number=acc_data['account_number'],
                defaults=acc_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Successfully created account: {account.name}'))
            else:
                self.stdout.write(f'Account already exists: {account.name}')

        self.stdout.write(self.style.SUCCESS('Chart of accounts setup is complete.'))
