from collections.abc import Callable

from sqlalchemy.orm import Session

from backend.shared.persistence import SqlUnitOfWork

from ..application.errors import PersistenceUnavailable
from ..domain.errors import RegistrationConflict
from .repository import (
    SqlAttemptRepository,
    SqlChallengeRepository,
    SqlIdentityRepository,
    SqlProfileRepository,
    SqlSessionRepository,
)


class SqlIdentityUnitOfWork(SqlUnitOfWork):
    def __init__(self, sessions: Callable[[], Session]):
        super().__init__(sessions, RegistrationConflict, PersistenceUnavailable)

    def configure(self) -> None:
        self.identities = SqlIdentityRepository(self.db)
        self.sessions = SqlSessionRepository(self.db)
        self.challenges = SqlChallengeRepository(self.db)
        self.attempts = SqlAttemptRepository(self.db)
        self.profiles = SqlProfileRepository(self.db)
