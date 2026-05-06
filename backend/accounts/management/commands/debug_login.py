from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from management.utils import normalize_phone

User = get_user_model()

class Command(BaseCommand):
    help = 'Test user login manually to debug issues'

    def add_arguments(self, parser):
        parser.add_argument('identifier', type=str, help='Phone or Email')
        parser.add_argument('password', type=str, help='Password')

    def handle(self, *args, **options):
        identifier = options['identifier']
        password = options['password']

        self.stdout.write(f"--- Debugging Login for: {identifier} ---")

        # 1.  
        user = None
        if '@' in identifier:
            user = User.objects.filter(email__iexact=identifier).first()
            self.stdout.write(f"Searching by Email...")
        else:
            self.stdout.write(f"Searching by Phone (Raw): {identifier}")
            user = User.objects.filter(phone=identifier).first()

            if not user:

                normalized = normalize_phone(identifier)
                if normalized:
                     self.stdout.write(f"Searching by Normalized Phone: {normalized}")
                     user = User.objects.filter(phone=normalized).first()

                #       View
                if not user:
                    clean_phone = identifier.strip()
                    if clean_phone.startswith('01'):
                        clean_phone = '+20' + clean_phone[1:]
                    self.stdout.write(f"Searching by View Logic: {clean_phone}")
                    user = User.objects.filter(phone=clean_phone).first()

        if not user:
            self.stdout.write(self.style.ERROR(f"❌ User NOT FOUND with identifier: {identifier}"))
            self.stdout.write("Did you store the phone with country code? (e.g., +20)")
            return

        self.stdout.write(self.style.SUCCESS(f"✅ User Found: {user.phone} (ID: {user.id})"))

        # 2.   
        self.stdout.write(f"Is Active: {user.is_active}")
        self.stdout.write(f"Is Phone Verified: {user.is_phone_verified}")

        # 3.   
        is_password_correct = user.check_password(password)
        if is_password_correct:
            self.stdout.write(self.style.SUCCESS("✅ Password is CORRECT."))
        else:
            self.stdout.write(self.style.ERROR("❌ Password is INCORRECT."))
            self.stdout.write(f"Stored Hash: {user.password[:20]}...")

            self.stdout.write("\nTo fix password manually, run:")
            self.stdout.write(f"python manage.py shell")
            self.stdout.write(f"> from accounts.models import User")
            self.stdout.write(f"> u = User.objects.get(id={user.id})")
            self.stdout.write(f"> u.set_password('{password}')")
            self.stdout.write(f"> u.save()")
