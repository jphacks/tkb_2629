from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BookCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    book_id: int | None = Field(default=None, gt=0)
    title: str = Field(min_length=1, max_length=255)
    author: str | None = Field(default=None, max_length=255)
    total_pages: int = Field(ge=1, le=1_000_000)


class BookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    author: str | None
    total_pages: int
    created_at: datetime
    google_books_id: str | None = None
    isbn_13: str | None = None
    thumbnail_url: str | None = None
    latest_iteration: int
    reading_status: str
    current_page: int
    started_at: datetime | None
    completed_at: datetime | None
    last_read_at: datetime | None = None


class BookListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[BookResponse]
    limit: int
    offset: int


class GoogleBookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    google_books_id: str
    title: str
    author: str | None
    total_pages: int
    isbn_13: str | None
    thumbnail_url: str | None


class GoogleBookSearchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[GoogleBookResponse]


class GoogleBookImport(BaseModel):
    google_books_id: str = Field(min_length=1, max_length=128)


class ReadingIterationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    iteration_number: int
    status: str
    current_page: int
    started_at: datetime
    completed_at: datetime | None
    last_read_at: datetime | None = None
