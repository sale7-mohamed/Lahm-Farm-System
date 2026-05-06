# life/settings.py
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-fallback-key-change-in-production')

DEBUG = os.getenv('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
    'django_filters',
    'channels',
    'accounts.apps.AccountsConfig',
    'cart.apps.CartConfig',
    'livestock.apps.LivestockConfig',
    'notifications.apps.NotificationsConfig',
    'orders.apps.OrdersConfig',
    'core.apps.CoreConfig',
    'payments.apps.PaymentsConfig',
    'reservation.apps.ReservationConfig',
    'management.apps.ManagementConfig',
    'accounting.apps.AccountingConfig',
    'partnerships',
    'messaging',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_extensions',
    "drf_spectacular",
    "drf_spectacular_sidecar",
    'django.contrib.sitemaps',
    'webpush'
]

AUTH_USER_MODEL = 'management.Employee'

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

CORS_ALLOW_CREDENTIALS = True

ROOT_URLCONF = 'life.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'life' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'life.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT'),
    },
}

AUTH_PASSWORD_VALIDATORS =[
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
]

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {'format': '{levelname} {asctime} {module} [Line:{lineno:d}] {message}', 'style': '{'},
        'simple': {'format': '[{levelname}] {message}', 'style': '{'},
    },
    'handlers': {'console': {'class': 'logging.StreamHandler', 'formatter': 'simple'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
}

LANGUAGE_CODE = 'ar'
TIME_ZONE = 'Africa/Cairo'
USE_I18N = True
USE_L10N = True
USE_TZ = True

LANGUAGES = [('ar', 'Arabic'), ('en', 'English')]

LOCALE_PATHS = [BASE_DIR / 'locale']

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.resend.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'resend'
EMAIL_HOST_PASSWORD = os.getenv('RESEND_API_KEY', 'your-email-api-key-here')
DEFAULT_FROM_EMAIL = 'متجر لَحِم <info@lahmfarm.com>'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('life.authentication.CustomJWTAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.AllowAny',),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PAGINATION_CLASS': 'livestock.pagination.CustomPagination',
    'PAGE_SIZE': 10,
    'DATETIME_FORMAT': '%Y-%m-%dT%H:%M:%S%z',
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '1000/min',
        'user': '10000/min',
        'otp_limit': '3/minute',
        'otp_phone': '3/minute',
        'otp_verify': '5/minute',
    },
    'EXCEPTION_HANDLER': 'life.exception_handler.custom_exception_handler',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_CLAIM': 'user_id',
}

SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'False') == 'True'
SESSION_COOKIE_HTTPONLY = True
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_SAVE_EVERY_REQUEST = True
SESSION_COOKIE_AGE = 8 * 60 * 60
SESSION_EXPIRE_AT_BROWSER_CLOSE = False

DEFAULT_PHONE_COUNTRY = 'EG'
DEFAULT_SITE_LANGUAGE = 'ar'

AUTHENTICATION_BACKENDS = [
    'management.backends.EmployeeBackend',
    'accounts.backends.EmailOrPhoneBackend',
    'django.contrib.auth.backends.ModelBackend',
]

ASGI_APPLICATION = "life.asgi.application"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}

ADMIN_SITE_URL = 'http://localhost:5174'
SITE_ID = 1

PAYMOB_PUBLIC_KEY = os.getenv("PAYMOB_PUBLIC_KEY", "")
PAYMOB_SECRET_KEY = os.getenv("PAYMOB_SECRET_KEY", "")
PAYMOB_API_KEY = os.getenv("PAYMOB_API_KEY", "")
PAYMOB_HMAC_SECRET = os.getenv("PAYMOB_HMAC_SECRET", "")
PAYMOB_INTEGRATION_ID = os.getenv("PAYMOB_INTEGRATION_ID", "")
PAYMOB_IS_LIVE = os.getenv("PAYMOB_IS_LIVE", "False") == "True"

OTP_PROVIDER = os.getenv("OTP_PROVIDER", "mock")
OTP_API_KEY = os.getenv("OTP_API_KEY", "")
OTP_SENDER_ID = os.getenv("OTP_SENDER_ID", "")
OTP_BASE_URL = os.getenv("OTP_BASE_URL", "")

OTP_EXPIRY_MINUTES = int(os.getenv("OTP_EXPIRY_MINUTES", "5"))
OTP_MAX_RETRIES = int(os.getenv("OTP_MAX_RETRIES", "3"))
# SMS_PROVIDER=
# WHYSMS_API_TOKEN=
# WHYSMS_SENDER_ID=

WEBPUSH_SETTINGS = {
    "VAPID_PUBLIC_KEY": os.getenv("VAPID_PUBLIC_KEY", "your-public-key-here"),
    "VAPID_PRIVATE_KEY": os.getenv("VAPID_PRIVATE_KEY", "your-private-key-here"),
    "VAPID_ADMIN_EMAIL": os.getenv("VAPID_ADMIN_EMAIL", "info@lahmfarm.com")
}

PASSWORD_RESET_TIMEOUT = 600

# --- Fix for HTTPS & Media URLs ---
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

