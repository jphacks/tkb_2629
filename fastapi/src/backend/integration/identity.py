"""Translate the identity context's public authentication into the API gateway port."""

from backend.identity.public import IdentityAccess, IdentityError, IdentityServiceUnavailable
from backend.shared.application.security import AuthenticationRequired, AuthenticationUnavailable


class IdentityAuthenticationGateway:
    def __init__(self, authenticator: IdentityAccess):
        self.authenticator = authenticator

    def user_id_from_access_token(self, token: str) -> int:
        try:
            return self.authenticator.authenticate(token).id
        except IdentityError:
            raise AuthenticationRequired("ログインし直してください") from None
        except IdentityServiceUnavailable:
            raise AuthenticationUnavailable("認証サービスを利用できません") from None
