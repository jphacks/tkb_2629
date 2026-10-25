"""Business failures: deliberately independent of HTTP and persistence."""


class IdentityError(Exception):
    pass


class InvalidRegistration(IdentityError):
    pass


class RegistrationConflict(IdentityError):
    pass


class InvalidCredentials(IdentityError):
    pass


class EmailNotVerified(IdentityError):
    pass


class InvalidSession(IdentityError):
    pass


class RevokedSession(InvalidSession):
    pass


class InvalidChallenge(IdentityError):
    pass


class AttemptLimitExceeded(IdentityError):
    pass


class AccessDenied(IdentityError):
    pass


class UserNotFound(IdentityError):
    pass
