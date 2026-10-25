from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class BookView:
    id: int
    title: str
    author: str | None
    total_pages: int
    created_at: datetime
    google_books_id: str | None = None
    isbn_13: str | None = None
    thumbnail_url: str | None = None
    latest_iteration: int = 1
    reading_status: str = "reading"
    current_page: int = 0
    started_at: datetime | None = None
    completed_at: datetime | None = None
    last_read_at: datetime | None = None


@dataclass(frozen=True)
class ReadingReference:
    id: int
    user_id: int
    book_id: int
    iteration_number: int
    status: str
    current_page: int
    total_pages: int


@dataclass(frozen=True)
class ReadingKey:
    id: int
    user_id: int
    iteration_number: int
