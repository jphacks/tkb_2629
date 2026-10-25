from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .values import ReviewText


@dataclass
class PageReview:
    id: int
    reading_id: int
    page_number: int
    text: ReviewText
    revision: int
    analysis_status: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def create(cls, reading_id: int, page: int, text: ReviewText, now: datetime) -> PageReview:
        return cls(0, reading_id, page, text, 1, "pending", now, now)

    def revise(self, text: ReviewText, now: datetime) -> None:
        self.text = text
        self.revision += 1
        self.analysis_status = "pending"
        self.updated_at = now

    def finish_analysis(self, revision: int, *, succeeded: bool, now: datetime) -> bool:
        if revision != self.revision:
            return False
        self.analysis_status = "completed" if succeeded else "failed"
        self.updated_at = now
        return True
