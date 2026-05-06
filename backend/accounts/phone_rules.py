# accounts/phone_rules.py
PHONE_RULES = {
    "EG": {"dial": "+20", "min": 10, "max": 10}, # Mobile numbers are 10 digits after 0
    "SA": {"dial": "+966", "min": 9, "max": 9},
    "AE": {"dial": "+971", "min": 9, "max": 9},
    "US": {"dial": "+1", "min": 10, "max": 10},
    "GB": {"dial": "+44", "min": 10, "max": 10},
}
DEFAULT_COUNTRY = "EG"
ARAB_COUNTRIES = {"EG", "SA", "AE", "KW", "BH", "QA", "OM", "JO", "DZ", "MA", "TN", "LY", "SD", "IQ", "SY", "LB", "YE", "PS"}




