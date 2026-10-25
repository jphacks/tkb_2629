from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    name: str = Field(max_length=100)
    email: str = Field(max_length=255)


class UserUpdate(BaseModel):
    name: str = Field(max_length=100)
    email: str = Field(max_length=255)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str


class BookCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    book_id: int | None = Field(default=None, gt=0)
    title: str = Field(min_length=1, max_length=255)
    author: str | None = Field(default=None, max_length=255)
    total_pages: int = Field(ge=1, le=1_000_000)


class BookResponse(BaseModel):
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


class BookListResponse(BaseModel):
    items: list[BookResponse]
    limit: int
    offset: int


class GoogleBookResponse(BaseModel):
    google_books_id: str
    title: str
    author: str | None
    total_pages: int
    isbn_13: str | None
    thumbnail_url: str | None


class GoogleBookSearchResponse(BaseModel):
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


class PagePopularityPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    page_number: int
    user_count: int


class PagePopularityResponse(BaseModel):
    items: list[PagePopularityPoint]


class ReviewSave(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    review_text: str = Field(min_length=1, max_length=140)


class BookEmotionResponse(BaseModel):
    review_count: int
    emotion_scores: dict[str, float]
    color_code: str


class PageReviewResponse(BaseModel):
    id: int
    book_id: int
    page_number: int
    review_text: str
    color_code: str
    created_at: datetime
    updated_at: datetime
    iteration_number: int
    analysis_status: str
    source: str | None
