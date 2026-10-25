from __future__ import annotations

from ..application.errors import ServiceUnavailable
from ..application.public_reviews import PublicReviewService
from ..application.service import ReviewService


def get_review_service() -> ReviewService:
    raise ServiceUnavailable("reviews service is not configured")


def get_public_review_service() -> PublicReviewService:
    raise ServiceUnavailable("public reviews service is not configured")
