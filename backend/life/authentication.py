# life/authentication.py
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings
from accounts.models import User as CustomerUser
from management.models import Employee

class CustomJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        from rest_framework.exceptions import AuthenticationFailed
        try:
            user_id = validated_token.get(settings.SIMPLE_JWT['USER_ID_CLAIM'])
            user_type = validated_token.get('user_type')

            if user_id is None:
                return None

            user = None
            if user_type == 'employee':
                user = Employee.objects.get(pk=user_id)
            elif user_type == 'customer':
                user = CustomerUser.objects.get(pk=user_id)
            else:
                try:
                    user = Employee.objects.get(pk=user_id)
                except Employee.DoesNotExist:
                    try:
                        user = CustomerUser.objects.get(pk=user_id)
                    except CustomerUser.DoesNotExist:
                        return None

            if user:
                if isinstance(user, CustomerUser) and getattr(user, 'is_suspended', False):
                    reason = user.custom_notification or user.suspension_reason or "تم إيقاف حسابك من قبل الإدارة."
                    raise AuthenticationFailed(reason, code='account_suspended')
                if not getattr(user, 'is_active', True):
                    raise AuthenticationFailed("تم إيقاف أو إلغاء تفعيل حسابك.", code='account_inactive')

            return user

        except (Employee.DoesNotExist, CustomerUser.DoesNotExist):
            return None
        except AuthenticationFailed as e:
            raise e
        except Exception:
            return None
