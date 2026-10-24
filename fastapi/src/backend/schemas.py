from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    name: str
    email: str


class UserUpdate(BaseModel):
    name: str
    email: str


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


class ProgressUpdate(BaseModel):
    current_page: int = Field(ge=0)


class ReadingSummary(BaseModel):
    user_book_id: int
    current_page: int
    status: Literal["reading", "completed"]
    started_at: datetime
    completed_at: datetime | None


class BookResponse(BaseModel):
    id: int
    title: str
    author: str | None
    total_pages: int
    created_at: datetime
    reading: ReadingSummary


class BookListResponse(BaseModel):
    items: list[BookResponse]
    limit: int
    offset: int


class ReviewSave(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    review_text: str = Field(min_length=1, max_length=10_000)


class EmotionAnalysisResponse(BaseModel):
    emotion_label: str | None
    color_code: str
    confidence: float | None
    model_version: str | None
    source: Literal["mock", "jev"]
    valence: float | None
    arousal: float | None
    palette_version: str | None
    emotion_vector: dict[str, float] | None = None
    emotion_projection: dict[str, float] | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PageReviewResponse(BaseModel):
    id: int
    book_id: int
    page_number: int
    review_text: str
    analysis_status: Literal["pending", "completed", "failed"]
    analysis: EmotionAnalysisResponse | None
    created_at: datetime
    updated_at: datetime