"""Composition root: environment configuration and concrete adapter wiring."""

import os
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI

from backend.identity.application.errors import IdentityConfigurationError
from backend.identity.application.profiles import ProfileService
from backend.identity.application.rate_limiter import AuthenticationRateLimiter
from backend.identity.application.service import AuthenticationService
from backend.identity.infrastructure.security import (
    ArgonPasswords,
    JwtAccessTokens,
    JwtSettings,
    RandomSecrets,
    SmtpMailer,
    SmtpSettings,
    SystemClock,
)
from backend.identity.infrastructure.unit_of_work import SqlIdentityUnitOfWork
from backend.identity.presentation.dependencies import (
    get_authentication_service,
    get_profile_service,
)
from backend.integration.identity import IdentityAuthenticationGateway
from backend.shared import database
from backend.shared.application.security import AuthenticationGateway
from backend.shared.presentation.auth import get_authentication_gateway


@lru_cache
def password_adapter() -> ArgonPasswords:
    return ArgonPasswords()


@lru_cache
def dummy_hash() -> str:
    return password_adapter().hash(RandomSecrets().create())


def build_authentication_service() -> AuthenticationService:
    try:
        smtp_port = int(os.getenv("SMTP_PORT", "").strip() or "587")
        if not 1 <= smtp_port <= 65535:
            raise ValueError("port out of range")
    except ValueError:
        raise IdentityConfigurationError("SMTP_PORTを正しく設定してください") from None
    jwt_settings = JwtSettings(
        secret=os.getenv("AUTH_JWT_SECRET", ""),
        issuer=os.getenv("AUTH_JWT_ISSUER", "re-read-api"),
    )
    mail_settings = SmtpSettings(
        host=os.getenv("SMTP_HOST", ""),
        sender=os.getenv("SMTP_FROM", ""),
        port=smtp_port,
        security=os.getenv("SMTP_SECURITY", "starttls"),
        username=os.getenv("SMTP_USERNAME", ""),
        password=os.getenv("SMTP_PASSWORD", ""),
        allow_plain=os.getenv("APP_ENV") == "development",
    )

    def units() -> SqlIdentityUnitOfWork:
        return SqlIdentityUnitOfWork(database.SessionLocal)

    clock = SystemClock()
    return AuthenticationService(
        units=units,
        passwords=password_adapter(),
        secrets=RandomSecrets(),
        access_tokens=JwtAccessTokens(jwt_settings),
        mailer=SmtpMailer(mail_settings),
        clock=clock,
        limiter=AuthenticationRateLimiter(units, clock),
        dummy_hash=dummy_hash(),
    )


def build_authentication_gateway(
    service: Annotated[AuthenticationService, Depends(get_authentication_service)],
) -> AuthenticationGateway:
    return IdentityAuthenticationGateway(service)


def build_profile_service() -> ProfileService:
    return ProfileService(lambda: SqlIdentityUnitOfWork(database.SessionLocal))


def configure_identity(app: FastAPI) -> None:
    app.dependency_overrides[get_profile_service] = build_profile_service
    app.dependency_overrides[get_authentication_service] = build_authentication_service
    app.dependency_overrides[get_authentication_gateway] = build_authentication_gateway
