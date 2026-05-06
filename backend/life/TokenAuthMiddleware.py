# life/TokenAuthMiddleware.py
import logging
from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from management.models import Employee
from accounts.models import User as CustomerUser

logger = logging.getLogger(__name__)

@database_sync_to_async
def get_user_from_database(user_id, user_type):
    try:
        if user_type == 'employee':
            return Employee.objects.select_related('department', 'role').get(pk=user_id)
        elif user_type == 'customer':
            return CustomerUser.objects.get(pk=user_id)
        return AnonymousUser()
    except (Employee.DoesNotExist, CustomerUser.DoesNotExist):
        logger.warning(f"User {user_id} ({user_type}) not found")
        return AnonymousUser()
    except Exception as e:
        logger.error(f"Database error: {str(e)}")
        return AnonymousUser()

class TokenAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode("utf-8")
        query_params = parse_qs(query_string)
        tokens = query_params.get("token", [])
        token = tokens[0] if tokens else None

        scope['user'] = AnonymousUser()
        scope['auth_error'] = None

        if not token:
            logger.debug("No token provided")
            return await self.app(scope, receive, send)

        if len(token) > 2048:
            scope['auth_error'] = 'Token too long'
            logger.warning("Token length exceeds limit")
            return await self.app(scope, receive, send)

        try:
            access_token = AccessToken(token)
            payload = access_token.payload

            user_id = payload.get('user_id') or payload.get('sub')
            user_type = payload.get('user_type')

            if not user_id or not user_type:
                scope['auth_error'] = 'Invalid token payload'
                logger.warning("Missing user_id or user_type")
                return await self.app(scope, receive, send)

            if not isinstance(user_id, (int, str)) or not isinstance(user_type, str):
                scope['auth_error'] = 'Invalid token data types'
                return await self.app(scope, receive, send)

            try:
                user_id = int(user_id) if str(user_id).isdigit() else user_id
            except (ValueError, TypeError):
                scope['auth_error'] = 'Invalid user_id format'
                return await self.app(scope, receive, send)

            if user_type not in['employee', 'customer']:
                scope['auth_error'] = 'Invalid user type'
                return await self.app(scope, receive, send)

            user = await get_user_from_database(user_id, user_type)

            if isinstance(user, AnonymousUser) or getattr(user, 'is_suspended', False) or not getattr(user, 'is_active', True):
                scope['auth_error'] = 'User not found or suspended'
                return await self.app(scope, receive, send)

            scope['user'] = user
            scope['user_type'] = user_type
            logger.info(f"Auth successful: {user_id} ({user_type})")

        except (InvalidToken, TokenError):
            scope['auth_error'] = 'Invalid token'
        except Exception as e:
            scope['auth_error'] = 'Authentication error'
            logger.error(f"Unexpected error: {str(e)}")

        return await self.app(scope, receive, send)
