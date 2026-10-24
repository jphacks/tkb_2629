from dataclasses import dataclass

from ..domain.entities import Review


@dataclass(frozen=True)

class ReviewTextSaveResult:
    review_id: int
    revision: int
    created: bool


@dataclass(frozen=True)

class ReviewSaveResult:
    review: Review
    created: bool
