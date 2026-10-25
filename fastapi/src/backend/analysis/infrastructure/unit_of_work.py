from __future__ import annotations

from collections.abc import Callable

from sqlalchemy.orm import Session

from backend.shared.persistence import SqlUnitOfWork

from ..application.errors import ServiceUnavailable
from ..domain.errors import Conflict
from .repository import SqlAnalysisRepository


class SqlAnalysisUnitOfWork(SqlUnitOfWork):
    def __init__(self, sessions: Callable[[], Session]):
        super().__init__(sessions, Conflict, ServiceUnavailable)

    def configure(self) -> None:
        self.analyses = SqlAnalysisRepository(self.db)
