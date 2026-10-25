from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from ..domain.values import ReviewVisibility


@dataclass(frozen=True)
class PublicReading:
    id: int
    user_id: int
    iteration_number: int


@dataclass(frozen=True)
class PublicReviewView:
    id: int
    public_display_name: str
    page_number: int
    iteration_number: int
    review_text: str
    contains_spoilers: bool
    created_at: datetime
    updated_at: datetime
    color_code: str
    analysis_status: str
    source: str | None


@dataclass(frozen=True)
class PublicReviewCount:
    page_number: int
    review_count: int


@dataclass(frozen=True)
class ReviewView:
    id: int
    book_id: int
    page_number: int
    review_text: str
    color_code: str
    created_at: datetime
    updated_at: datetime
    iteration_number: int = 1
    analysis_status: str = "pending"
    source: str | None = None
    visibility: ReviewVisibility = "private"
    contains_spoilers: bool = True


@dataclass(frozen=True)
class ReadingScope:
    id: int
    user_id: int
    book_id: int
    iteration_number: int
    status: str
    current_page: int
    total_pages: int


@dataclass(frozen=True)
class AnalysisPreview:
    color_code: str
    source: str


@dataclass(frozen=True)
class EmotionSummary:
    review_count: int
    emotion_scores: dict[str, float]
    color_code: str


@dataclass(frozen=True)
class PagePopularity:
    page_number: int
    user_count: int


@dataclass(frozen=True)
class ReviewSaveResult:
    review: ReviewView
    created: bool
