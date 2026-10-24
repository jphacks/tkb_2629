class DomainError(Exception):
    """A business rule or resource lookup failed."""

class NotFound(DomainError):
    pass

class Conflict(DomainError):
    pass

class InvalidInput(DomainError):
    pass
