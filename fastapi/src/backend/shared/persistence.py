from collections.abc import Callable
from types import TracebackType
from typing import Self

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session


class SqlUnitOfWork:
    """Technical transaction mechanics; contexts choose commits and translate failures."""

    def __init__(
        self,
        sessions: Callable[[], Session],
        conflict: type[Exception],
        unavailable: type[Exception],
        *,
        borrowed: bool = False,
    ):
        self._sessions = sessions
        self._conflict = conflict
        self._unavailable = unavailable
        self._borrowed = borrowed

    def __enter__(self) -> Self:
        self.db = self._sessions()
        if self.db.bind is None:
            if not self._borrowed:
                self.db.close()
            raise self._unavailable("Database is not configured")
        try:
            self.configure()
        except BaseException:
            if not self._borrowed:
                self.db.close()
            raise
        return self

    def configure(self) -> None:
        raise NotImplementedError

    def commit(self) -> None:
        if not self._borrowed:
            self.db.commit()
        else:
            self.db.flush()

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if not self._borrowed:
            try:
                self.db.rollback()
            finally:
                self.db.close()
        if isinstance(exc, IntegrityError):
            raise self._conflict("The operation conflicts with existing data") from exc
        if isinstance(exc, SQLAlchemyError):
            raise self._unavailable("Database operation failed") from exc
