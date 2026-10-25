"""Published contracts and failures at bounded-context boundaries."""

from typing import Protocol

from .application.errors import IdentityServiceUnavailable
from .application.results import UserSummary
from .domain.errors import AccessDenied, IdentityError, InvalidRegistration, RegistrationConflict

__all__ = [
    "AccessDenied",
    "IdentityAccess",
    "IdentityError",
    "IdentityServiceUnavailable",
    "InvalidRegistration",
    "RegistrationConflict",
    "UserSummary",
]


class IdentityAccess(Protocol):
    def authenticate(self, token: str) -> UserSummary: ...
    def authorize_user(self, actor_id: int, user_id: int) -> None: ...
    def authorize_profile_update(self, actor_id: int, user_id: int, email: str) -> None: ...
