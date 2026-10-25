from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from ..domain.reactions import ReactionKind
from ..domain.values import ReviewVisibility


@dataclass(frozen=True)
class RecommendationBook:
    google_books_id: str
    title: str
    author: str | None
    total_pages: int
    isbn_13: str | None
    thumbnail_url: str | None


@dataclass(frozen=True)
class Recommendations:
    items: list[RecommendationBook]
    status: Literal["ready", "needs_reviews", "no_candidates"]
    limit: int


@dataclass(frozen=True)
class ReactionSummary:
    review_id: int
    counts: dict[ReactionKind, int]
    my_reaction: ReactionKind | None


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
