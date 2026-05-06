# life/serializers.py
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer
)
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from accounts.models import User as CustomerUser
from management.models import Employee

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        if isinstance(user, Employee):
            token['user_type'] = 'employee'
        elif isinstance(user, CustomerUser):
            token['user_type'] = 'customer'
        else:
            token['user_type'] = 'unknown'

        token['user_id'] = user.id
        return token

class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        try:
            refresh = RefreshToken(attrs["refresh"])

            user_id = refresh.get('user_id')
            user_type = refresh.get('user_type')

            if not user_id or not user_type:
                raise ValueError("Missing required claims in refresh token")

            data = super().validate(attrs)

            new_access_token = AccessToken(data['access'])
            new_access_token['user_id'] = user_id
            new_access_token['user_type'] = user_type

            data['access'] = str(new_access_token)

            return data

        except (KeyError, ValueError, TypeError) as e:
            from rest_framework_simplejwt.exceptions import InvalidToken
            raise InvalidToken(f"Invalid token: {str(e)}")
        except Exception as e:
            from rest_framework_simplejwt.exceptions import TokenError
            raise TokenError(f"Token processing failed: {str(e)}")
