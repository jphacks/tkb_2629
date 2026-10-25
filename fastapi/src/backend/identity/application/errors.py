"""Operational failures of ports, with no transport status codes."""


class IdentityServiceUnavailable(Exception):
    pass


class IdentityConfigurationError(IdentityServiceUnavailable):
    pass


class PersistenceUnavailable(IdentityServiceUnavailable):
    pass


class EmailDeliveryFailed(IdentityServiceUnavailable):
    pass
