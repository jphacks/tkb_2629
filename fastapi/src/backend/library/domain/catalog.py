from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CatalogBook:
    google_books_id: str
    title: str
    author: str | None
    total_pages: int
    isbn_13: str | None
    thumbnail_url: str | None
