# accounts/backends.py
from django.contrib.auth.backends import ModelBackend
from .models import User
from management.models import Employee
from management.utils import normalize_phone

class EmailOrPhoneBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        """
        This backend is ONLY for the customer-facing frontend.
        It authenticates pure customers and superusers, but blocks regular employees.
        """
        identifier = str(username).strip()
        is_email_login = '@' in identifier

        customer_user = self._get_customer_user(identifier)

        if customer_user and is_email_login and not customer_user.is_email_verified:
            return None

        if customer_user and customer_user.check_password(password) and self.user_can_authenticate(customer_user):
            if customer_user.employee_profile is None:
                return customer_user

            if customer_user.employee_profile and customer_user.employee_profile.is_superuser:
                return customer_user

            return None

        try:
            employee = None
            if is_email_login:
                employee = Employee.objects.filter(email__iexact=identifier).first()
            else:
                normalized_phone = normalize_phone(identifier)
                if normalized_phone:
                    employee = Employee.objects.filter(phone=normalized_phone).first()

            if employee and employee.is_superuser and employee.check_password(password):
                customer_profile, created = User.objects.get_or_create(
                    phone=employee.phone,
                    defaults={
                        'full_name': employee.full_name,
                        'email': employee.email,
                        'employee_profile': employee,
                        'is_active': True,
                        'is_phone_verified': True,
                        'is_email_verified': bool(employee.email),
                        'is_staff': False,
                        'is_superuser': False,
                    }
                )
                if not created:
                    customer_profile.employee_profile = employee
                    customer_profile.is_staff = False
                    customer_profile.is_superuser = False
                    customer_profile.save()

                return customer_profile
        except Employee.DoesNotExist:
            return None

        return None

    def _get_customer_user(self, identifier):
        if '@' in identifier:
            return User.objects.filter(email__iexact=identifier).first()

        normalized_phone = normalize_phone(identifier)
        if normalized_phone:
            return User.objects.filter(phone=normalized_phone).first()

        return None

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
