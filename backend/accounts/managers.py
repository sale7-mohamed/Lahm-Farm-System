# accounts/managers.py
from django.contrib.auth.models import UserManager as DjangoUserManager
from django.utils.text import slugify
import uuid

class UserManager(DjangoUserManager):
    def _create_user(self, phone, password, **extra_fields):
        if not phone:
            raise ValueError('The given phone must be set')

        email = extra_fields.get('email')
        if email:
            email = self.normalize_email(email)
            extra_fields['email'] = email

        # Ensure a unique username, even if it's not used for login
        username = extra_fields.get('username')
        if not username:
            full_name = extra_fields.get('full_name', '')
            base = slugify(full_name) if full_name else phone.replace('+', '')
            username = base
            i = 1
            while self.model.objects.filter(username=username).exists():
                username = f"{base}{i}"
                i += 1
            extra_fields['username'] = username

        user = self.model(phone=phone, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, phone, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(phone, password, **extra_fields)

    def create_superuser(self, phone, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_phone_verified', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self._create_user(phone, password, **extra_fields)
