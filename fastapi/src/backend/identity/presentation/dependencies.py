from ..application.errors import IdentityConfigurationError
from ..application.profiles import ProfileService
from ..application.service import AuthenticationService


def get_authentication_service() -> AuthenticationService:
    """Provider slot populated by the application composition root."""
    raise IdentityConfigurationError("Authentication service is not configured")


def get_profile_service() -> ProfileService:
    raise IdentityConfigurationError("Profile service is not configured")
