from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, StrictBool

from ..domain.reactions import ReactionKind
from ..domain.values import ReviewVisibility


class ReactionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: ReactionKind


class ReactionCounts(BaseModel):
    empathy: int
    insight: int
    curious: int


class ReactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    review_id: int
    counts: ReactionCounts
    my_reaction: ReactionKind | None


class ReviewVisibilityUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    visibility: ReviewVisibility


class ReviewSpoilersUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contains_spoilers: StrictBool


class PublicReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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


class PublicReviewDistributionPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    page_number: int
    review_count: int


class PublicReviewDistributionResponse(BaseModel):
    items: list[PublicReviewDistributionPoint]
    total_count: int


class PublicReviewsResponse(BaseModel):
    items: list[PublicReviewResponse]
    limit: int
    offset: int


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
    visibility: ReviewVisibility = "private"
    contains_spoilers: bool = True
