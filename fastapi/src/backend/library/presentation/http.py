from __future__ import annotations

from fastapi import FastAPI

from backend.shared.presentation.errors import install_error_mapping

from ..application.errors import ExternalServiceError, ServiceUnavailable
from ..domain.errors import Conflict, DomainError, InvalidInput, NotFound


def install_http(app: FastAPI) -> None:
    install_error_mapping(app, DomainError, ((NotFound, 404), (Conflict, 409), (InvalidInput, 422)))
    install_error_mapping(app, ExternalServiceError, ((ExternalServiceError, 502),))
    install_error_mapping(app, ServiceUnavailable, ((ServiceUnavailable, 503),))
