from __future__ import annotations

from collections.abc import Callable

from sqlalchemy.orm import Session

from backend.shared.persistence import SqlUnitOfWork

from ..application.errors import ServiceUnavailable
from ..domain.errors import Conflict
from .repository import SqlBookRepository, SqlReadingRepository


class SqlLibraryUnitOfWork(SqlUnitOfWork):
    def __init__(self, sessions: Callable[[], Session], *, borrowed: bool = False):
        super().__init__(sessions, Conflict, ServiceUnavailable, borrowed=borrowed)

    def configure(self) -> None:
        self.books = SqlBookRepository(self.db)
        self.readings = SqlReadingRepository(self.db)
