from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from ..application.results import PagePopularity
from ..domain.entities import PageReview as ReviewEntity
from ..domain.values import ReviewText
from .models import PageReview


def review_entity(row: PageReview) -> ReviewEntity:
    return ReviewEntity(
        row.id,
        row.user_book_id,
        row.page_number,
        ReviewText(row.review_text),
        row.analysis_revision,
        row.analysis_status,
        row.created_at,
        row.updated_at,
        row.visibility,
    )


class SqlReviewRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, review_id: int, *, lock: bool = False) -> ReviewEntity | None:
        statement = select(PageReview).where(PageReview.id == review_id)
        if lock:
            statement = statement.with_for_update()
        row = self.db.scalar(statement.execution_options(populate_existing=True))
        return review_entity(row) if row else None

    def find(self, reading_id: int, page: int, *, lock: bool = False) -> ReviewEntity | None:
        statement = select(PageReview).where(
            PageReview.user_book_id == reading_id, PageReview.page_number == page
        )
        if lock:
            statement = statement.with_for_update()
        row = self.db.scalar(statement.execution_options(populate_existing=True))
        return review_entity(row) if row else None

    def list(self, reading_id: int, limit: int, offset: int) -> list[ReviewEntity]:
        rows = self.db.scalars(
            select(PageReview)
            .where(PageReview.user_book_id == reading_id)
            .order_by(PageReview.page_number)
            .limit(limit)
            .offset(offset)
        )
        return [review_entity(row) for row in rows]

    def add(self, review: ReviewEntity) -> ReviewEntity:
        row = PageReview(
            user_book_id=review.reading_id,
            page_number=review.page_number,
            review_text=review.text.value,
            visibility=review.visibility,
            analysis_revision=review.revision,
            analysis_status=review.analysis_status,
            created_at=review.created_at,
            updated_at=review.updated_at,
        )
        self.db.add(row)
        self.db.flush()
        return review_entity(row)

    def save(self, review: ReviewEntity) -> None:
        self.db.execute(
            update(PageReview)
            .where(PageReview.id == review.id)
            .values(
                review_text=review.text.value,
                analysis_revision=review.revision,
                analysis_status=review.analysis_status,
                updated_at=review.updated_at,
            )
        )

    def analysis_references(self, reading_ids: Sequence[int]) -> list[tuple[int, int]]:
        if not reading_ids:
            return []
        ids = list(dict.fromkeys(reading_ids))
        references = []
        for offset in range(0, len(ids), 1000):
            references.extend(
                (row.id, row.analysis_revision)
                for row in self.db.execute(
                    select(PageReview.id, PageReview.analysis_revision).where(
                        PageReview.user_book_id.in_(ids[offset : offset + 1000]),
                        PageReview.analysis_status == "completed",
                    )
                )
            )
        return references

    def save_visibility(self, review: ReviewEntity) -> None:
        self.db.execute(
            update(PageReview)
            .where(PageReview.id == review.id)
            .values(visibility=review.visibility, updated_at=review.updated_at)
        )

    def page_popularity(self, reading_ids: Sequence[int]) -> list[PagePopularity]:
        if not reading_ids:
            return []
        ids = list(dict.fromkeys(reading_ids))
        counts: dict[int, int] = {}
        for offset in range(0, len(ids), 1000):
            rows = self.db.execute(
                select(PageReview.page_number, func.count(PageReview.id))
                .where(PageReview.user_book_id.in_(ids[offset : offset + 1000]))
                .group_by(PageReview.page_number)
            )
            for page, count in rows:
                counts[page] = counts.get(page, 0) + count
        return [PagePopularity(page, count) for page, count in sorted(counts.items())]
