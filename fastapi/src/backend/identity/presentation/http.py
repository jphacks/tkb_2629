"""HTTP error mapping and browser-specific controls stay at the transport boundary."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from ..application.errors import IdentityServiceUnavailable
from ..domain.errors import (
    AccessDenied,
    AttemptLimitExceeded,
    EmailNotVerified,
    IdentityError,
    InvalidChallenge,
    InvalidCredentials,
    InvalidRegistration,
    InvalidSession,
    RegistrationConflict,
    UserNotFound,
)
from ..domain.policies import AttemptPolicy


async def identity_error_handler(request: Request, error: Exception) -> JSONResponse:
    statuses = (
        (InvalidRegistration, 422),
        (UserNotFound, 404),
        (RegistrationConflict, 409),
        (InvalidCredentials, 401),
        (AccessDenied, 403),
        (EmailNotVerified, 403),
        (InvalidSession, 401),
        (InvalidChallenge, 400),
        (AttemptLimitExceeded, 429),
    )
    status_code = next((status for kind, status in statuses if isinstance(error, kind)), 400)
    headers = {"Cache-Control": "no-store"}
    if status_code == 401:
        headers["WWW-Authenticate"] = "Bearer"
    if status_code == 429:
        headers["Retry-After"] = str(AttemptPolicy.window_seconds)
    return JSONResponse(status_code=status_code, content={"detail": str(error)}, headers=headers)


async def unavailable_handler(request: Request, error: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=503, content={"detail": str(error)}, headers={"Cache-Control": "no-store"}
    )


def install_identity_http(app: FastAPI, origins: list[str]) -> None:
    app.add_exception_handler(IdentityError, identity_error_handler)
    app.add_exception_handler(IdentityServiceUnavailable, unavailable_handler)

    @app.middleware("http")
    async def private_responses(request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path.startswith("/auth") and request.method == "POST":
            origin = request.headers.get("Origin")
            if origin is not None and origin not in origins:
                return JSONResponse(
                    status_code=403,
                    content={"detail": "許可されていないOriginです"},
                    headers={"Cache-Control": "no-store"},
                )
        response = await call_next(request)
        if request.url.path.startswith("/auth") or request.headers.get("Authorization"):
            response.headers["Cache-Control"] = "no-store"
        return response
