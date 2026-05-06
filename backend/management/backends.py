# management/backends.py
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q
from django.utils import timezone
from .models import Employee
from .utils import normalize_phone

from rest_framework.exceptions import AuthenticationFailed
from django.utils.translation import gettext_lazy as _

class EmployeeBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        try:
            identifier = str(username).strip()
            normalized_phone = normalize_phone(identifier)

            query = Q(employee_id__iexact=identifier) | Q(username__iexact=identifier)
            if normalized_phone:
                query |= Q(phone=normalized_phone)

            user = Employee.objects.get(query, is_staff=True)

            if not user.is_active:
                raise AuthenticationFailed(
                    _('تم إلغاء تفعيل هذا الحساب، يرجى مراجعة الإدارة.')
                )

            if user.check_password(password) and self.user_can_authenticate(user):

                if user.is_superuser:
                    return user

                if not self.is_login_allowed_now(user):
                    return None

                return user
        except Employee.DoesNotExist:
            return None
        return None

    def is_login_allowed_now(self, user):
        """
             :
         () ->  ->
        """
        # 1.  ()
        if user.shift_start and user.shift_end:
            return self._check_time(user.shift_start, user.shift_end)

        # 2. 
        if user.role and user.role.shift_start and user.role.shift_end:
            return self._check_time(user.role.shift_start, user.role.shift_end)

        # 3. 
        if user.department and user.department.shift_start and user.department.shift_end:
            return self._check_time(user.department.shift_start, user.department.shift_end)

        return True

    def _check_time(self, start, end):
        now = timezone.localtime().time()
        if start <= end:
            return start <= now <= end
        else: #      (  22:00  06:00)
            return start <= now or now <= end

    def get_user(self, user_id):
        try:
            return Employee.objects.get(pk=user_id, is_active=True, is_staff=True)
        except Employee.DoesNotExist:
            return None
