from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PagePopularityPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    page_number: int
    user_count: int


class PagePopularityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[PagePopularityPoint]


class ReviewSave(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    review_text: str = Field(min_length=1, max_length=140)


class BookEmotionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    review_count: int
    emotion_scores: dict[str, float]
    color_code: str


class PageReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
