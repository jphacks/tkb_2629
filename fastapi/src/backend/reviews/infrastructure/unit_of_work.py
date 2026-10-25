from __future__ import annotations

from collections.abc import Callable

from sqlalchemy.orm import Session

from backend.shared.persistence import SqlUnitOfWork

from ..application.errors import ServiceUnavailable
from ..application.ports import ReadingGateway
from ..domain.errors import Conflict
from .reactions import SqlReactionRepository
from .repository import SqlReviewRepository


class SqlReviewUnitOfWork(SqlUnitOfWork):
    def __init__(
        self, sessions: Callable[[], Session], readings: Callable[[Session], ReadingGateway]
    ):
        super().__init__(sessions, Conflict, ServiceUnavailable)
        self._readings = readings

    def configure(self) -> None:
        self.reviews = SqlReviewRepository(self.db)
        self.reactions = SqlReactionRepository(self.db)
        self.readings = self._readings(self.db)
