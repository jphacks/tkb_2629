from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .errors import Conflict, InvalidInput
from .values import BookDetails


@dataclass
class StoredBook:
    id: int
    title: str | None
    author: str | None
    total_pages: int | None
    google_books_id: str | None
    created_at: datetime

    def require_metadata(self, details: BookDetails) -> None:
        if (self.title, self.author, self.total_pages) != (
            details.title,
            details.author,
            details.total_pages,
        ):
            raise Conflict("Book metadata does not match the existing book")


@dataclass
class Reading:
    id: int
    user_id: int
    book_id: int
    iteration_number: int
    status: str
    current_page: int
    started_at: datetime
    completed_at: datetime | None = None
    last_read_at: datetime | None = None

    @classmethod
    def start(cls, user_id: int, book_id: int, now: datetime) -> Reading:
        return cls(0, user_id, book_id, 1, "reading", 0, now)

    def start_next(self, now: datetime) -> Reading:
        if self.status != "completed":
            raise Conflict("Complete the current reading before starting another")
        return Reading(0, self.user_id, self.book_id, self.iteration_number + 1, "reading", 0, now)

    def check_page(self, page: int, total_pages: int) -> None:
        if not 1 <= page <= total_pages:
            raise InvalidInput("page_number must be between 1 and total_pages")

    def record_progress(self, page: int, total_pages: int) -> None:
        self.check_page(page, total_pages)
        if self.status != "reading":
            raise Conflict("Cannot edit a completed reading iteration")
        self.current_page = max(self.current_page, page)

    def complete(self, total_pages: int, now: datetime) -> None:
        if self.status == "completed":
            raise Conflict("Reading iteration is already completed")
        self.status = "completed"
        self.current_page = total_pages
        self.completed_at = now


class BookshelfPolicy:
    @staticmethod
    def require_new(has_reading: bool) -> None:
        if has_reading:
            raise Conflict("Book is already in the bookshelf")
