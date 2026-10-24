from dataclasses import dataclass
from datetime import datetime

from .errors import InvalidInput


@dataclass
class User:
    id: int
    name: str
    email: str


@dataclass
class Book:
    id: int
    title: str
    author: str | None
    total_pages: int
    created_at: datetime
    google_books_id: str | None = None
    isbn_13: str | None = None
    thumbnail_url: str | None = None

    def check_page(self, page: int) -> None:
        if page < 1 or page > self.total_pages:
            raise InvalidInput("page_number must be between 1 and total_pages")


@dataclass(frozen=True)
class Review:
    id: int
    book_id: int
    page_number: int
    review_text: str
    color_code: str
    created_at: datetime
    updated_at: datetime
