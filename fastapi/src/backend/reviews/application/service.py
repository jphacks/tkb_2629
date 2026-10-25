from __future__ import annotations

import logging

from ..domain.entities import PageReview
from ..domain.errors import NotFound
from ..domain.values import ReviewPage, ReviewText, ReviewVisibility
from .errors import AnalysisUnavailable
from .ports import AnalysisGateway, Clock, ReadingGateway, UnitOfWorkFactory
from .results import EmotionSummary, PagePopularity, ReadingScope, ReviewSaveResult, ReviewView

logger = logging.getLogger(__name__)


class ReviewService:
    def __init__(
        self,
        units: UnitOfWorkFactory,
        readings: ReadingGateway,
        analyses: AnalysisGateway,
        clock: Clock,
    ):
        self.units = units
        self.readings = readings
        self.analyses = analyses
        self.clock = clock

    def _views(self, scope: ReadingScope, rows: list[PageReview]) -> list[ReviewView]:
        keys = [(row.id, row.revision) for row in rows if row.analysis_status == "completed"]
        previews = self.analyses.previews(keys) if keys else {}
        return [
            ReviewView(
                id=row.id,
                book_id=scope.book_id,
                page_number=row.page_number,
                review_text=row.text.value,
                created_at=row.created_at,
                updated_at=row.updated_at,
                iteration_number=scope.iteration_number,
                analysis_status=row.analysis_status,
                visibility=row.visibility,
                contains_spoilers=row.contains_spoilers,
                color_code=previews[(row.id, row.revision)].color_code
                if (row.id, row.revision) in previews
                else "#808080",
                source=previews[(row.id, row.revision)].source
                if (row.id, row.revision) in previews
                else None,
            )
            for row in rows
        ]

    def list(
        self,
        user_id: int,
        book_id: int,
        iteration: int | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ReviewView]:
        scope = self.readings.resolve(user_id, book_id, iteration)
        with self.units() as unit:
            rows = unit.reviews.list(scope.id, limit, offset)
        return self._views(scope, rows)

    def _get(self, scope: ReadingScope, page: int) -> ReviewView:
        with self.units() as unit:
            row = unit.reviews.find(scope.id, page)
            if row is None:
                raise NotFound("Review not found")
        return self._views(scope, [row])[0]

    def get(
        self, user_id: int, book_id: int, page: int, iteration: int | None = None
    ) -> ReviewView:
        scope = self.readings.resolve(user_id, book_id, iteration)
        ReviewPage(page, scope.total_pages)
        return self._get(scope, page)

    def save(
        self, user_id: int, book_id: int, page: int, text: str, iteration: int | None = None
    ) -> ReviewSaveResult:
        scope = self.readings.resolve(user_id, book_id, iteration)
        ReviewPage(page, scope.total_pages)
        normalized = ReviewText(text)
        with self.units() as unit:
            # The library adapter participates in this transaction without committing it.
            scope = unit.readings.record_progress(scope, page)
            row = unit.reviews.find(scope.id, page, lock=True)
            created = row is None
            if row is None:
                row = unit.reviews.add(
                    PageReview.create(scope.id, page, normalized, self.clock.now())
                )
            else:
                row.revise(normalized, self.clock.now())
                unit.reviews.save(row)
            review_id, revision = row.id, row.revision
            unit.commit()
        succeeded = True
        try:
            self.analyses.analyze(review_id, revision, normalized.value)
        except AnalysisUnavailable:
            succeeded = False
            logger.exception("Analysis failed for review %s revision %s", review_id, revision)
        with self.units() as unit:
            current = unit.reviews.get(review_id, lock=True)
            if current is not None and current.finish_analysis(
                revision, succeeded=succeeded, now=self.clock.now()
            ):
                unit.reviews.save(current)
            unit.commit()
        return ReviewSaveResult(self._get(scope, page), created)

    def average_emotions(self, user_id: int, book_id: int) -> EmotionSummary:
        self.readings.resolve(user_id, book_id, None)
        reading_ids = self.readings.reading_ids(book_id, latest_only=False)
        with self.units() as unit:
            references = unit.reviews.analysis_references(reading_ids)
        return self.analyses.summarize(references)

    def set_visibility(
        self,
        user_id: int,
        book_id: int,
        page: int,
        visibility: ReviewVisibility,
        iteration: int | None = None,
    ) -> None:
        scope = self.readings.resolve(user_id, book_id, iteration)
        with self.units() as unit:
            row = unit.reviews.find(scope.id, page, lock=True)
            if row is None:
                raise NotFound("Review not found")
            row.set_visibility(visibility, self.clock.now())
            unit.reviews.save_visibility(row)
            unit.commit()

    def page_popularity(self, user_id: int, book_id: int) -> list[PagePopularity]:
        self.readings.resolve(user_id, book_id, None)
        reading_ids = self.readings.reading_ids(book_id, latest_only=True)
        with self.units() as unit:
            return unit.reviews.page_popularity(reading_ids)

    def set_spoilers(
        self,
        user_id: int,
        book_id: int,
        page: int,
        contains_spoilers: bool,
        iteration: int | None = None,
    ) -> None:
        scope = self.readings.resolve(user_id, book_id, iteration)
        with self.units() as unit:
            row = unit.reviews.find(scope.id, page, lock=True)
            if row is None:
                raise NotFound("Review not found")
            row.set_spoilers(contains_spoilers, self.clock.now())
            unit.reviews.save_spoilers(row)
            unit.commit()
