from typing import Protocol


class AuthenticationRequired(Exception):
    pass


class AuthenticationUnavailable(Exception):
    pass


class AuthenticationGateway(Protocol):
    def user_id_from_access_token(self, token: str) -> int: ...
