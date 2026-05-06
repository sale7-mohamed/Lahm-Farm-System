# accounts/throttling.py
from rest_framework.throttling import SimpleRateThrottle

class OTPPhoneThrottle(SimpleRateThrottle):
    scope = 'otp_phone'

    def get_cache_key(self, request, view):

        ident = request.data.get('phone') or request.data.get('identifier')

        if not ident:
            return None  #         (  Validator)

        return self.cache_format % {
            'scope': self.scope,
            'ident': ident.replace(' ', '').replace('+', '')
        }
