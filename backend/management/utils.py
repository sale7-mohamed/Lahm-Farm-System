import phonenumbers
from datetime import date

def normalize_phone(phone_number_str):
    """
    Normalize Egyptian phone numbers to E.164 format (+20...).
    Handles formats like '012...', '2012...', '+2012...'.
    Returns the normalized number if valid, otherwise returns the input as is.
    """
    if not phone_number_str or not isinstance(phone_number_str, str):
        return None

    phone_number_str = phone_number_str.strip()

    # Preprocess Egyptian numbers to help phonenumbers library
    if phone_number_str.startswith('20') and len(phone_number_str) > 10:
        phone_number_str = '+' + phone_number_str
    elif phone_number_str.startswith('01') and len(phone_number_str) == 11:
        phone_number_str = '+20' + phone_number_str[1:]

    try:
        parsed = phonenumbers.parse(phone_number_str, "EG")
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except phonenumbers.NumberParseException:
        pass

    # Return the processed string if parsing fails, to avoid data loss
    return phone_number_str

def extract_birth_date_from_nid(nid: str):
    """
    Extracts birth date from a 14-digit Egyptian National ID.
    Returns a date object or None if invalid.
    """
    if not isinstance(nid, str) or len(nid) != 14 or not nid.isdigit():
        return None

    try:
        century_digit = int(nid[0])
        year_prefix = '19' if century_digit == 2 else '20'
        year = int(year_prefix + nid[1:3])
        month = int(nid[3:5])
        day = int(nid[5:7])
        return date(year, month, day)
    except (ValueError, TypeError):
        return None

