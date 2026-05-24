from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import UntypedToken


class JWTAuthMiddleware:
    """
    Authenticate websocket users via JWT passed as:
    - query param: ?token=<jwt>
    - header: Authorization: Bearer <jwt>
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        token = self._extract_token(scope)
        scope["user"] = AnonymousUser()
        if token:
            scope["user"] = await self._get_user_from_token(token)
        return await self.inner(scope, receive, send)

    def _extract_token(self, scope):
        query_string = (scope.get("query_string") or b"").decode()
        query_params = parse_qs(query_string)
        query_token = query_params.get("token", [None])[0]
        if query_token:
            return query_token

        headers = dict(scope.get("headers") or [])
        auth_header = (headers.get(b"authorization") or b"").decode()
        if auth_header.lower().startswith("bearer "):
            return auth_header.split(" ", 1)[1].strip()
        return None

    @database_sync_to_async
    def _get_user_from_token(self, token):
        try:
            validated_token = UntypedToken(token)
        except (InvalidToken, TokenError):
            return AnonymousUser()

        jwt_auth = JWTAuthentication()
        try:
            return jwt_auth.get_user(validated_token)
        except Exception:
            return AnonymousUser()


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)
