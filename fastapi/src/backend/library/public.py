"""Published library contracts. Consumers translate these into their own ports."""

from __future__ import annotations

from typing import Protocol

from .application.errors import ExternalServiceError, ServiceUnavailable
from .application.results import ReadingKey, ReadingReference
from .domain.errors import Conflict, InvalidInput, NotFound

__all__ = [
    "LibraryAccess",
    "ReadingKey",
    "ReadingReference",
    "Conflict",
    "InvalidInput",
    "NotFound",
    "ExternalServiceError",
    "ServiceUnavailable",
]


class LibraryAccess(Protocol):
    def catalog_reading_keys(self, google_books_id: str) -> list[ReadingKey]: ...
    def resolve_reading(
        self, user_id: int, book_id: int, iteration: int | None
    ) -> ReadingReference: ...
    def record_review_progress(
        self, user_id: int, book_id: int, iteration: int, page: int, total_pages: int
    ) -> ReadingReference: ...
    def reading_keys(self, book_id: int, *, latest_only: bool) -> list[ReadingKey]: ...
