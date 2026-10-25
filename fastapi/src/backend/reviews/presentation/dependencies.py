from __future__ import annotations

from ..application.errors import ServiceUnavailable
from ..application.service import ReviewService


def get_review_service() -> ReviewService:
    raise ServiceUnavailable("reviews service is not configured")
