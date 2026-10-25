from typing import Annotated

from fastapi import Depends, Request

from ..application.security import (
    AuthenticationGateway,
    AuthenticationRequired,
    AuthenticationUnavailable,
)


def get_authentication_gateway() -> AuthenticationGateway:
    """Provider slot populated by composition; never imports another context's HTTP layer."""
    raise AuthenticationUnavailable("Authentication gateway is not configured")


def get_current_user_id(
    request: Request,
    gateway: Annotated[AuthenticationGateway, Depends(get_authentication_gateway)],
) -> int:
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise AuthenticationRequired("ログインしてください")
    return gateway.user_id_from_access_token(token)
