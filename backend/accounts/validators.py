# accounts/validators.py
from .utils import validate_phone_with_country as normalize_phone

def validate_phone_with_country(country_code: str, raw_phone: str) -> str:
    return normalize_phone(country_code, raw_phone)

