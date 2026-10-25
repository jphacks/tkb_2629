from ..domain.errors import InvalidInput, NotFound
from ..domain.reactions import REACTION_KINDS, ReactionKind
from .ports import AnalysisGateway, PublicAuthorGateway, PublicReadingGateway, UnitOfWorkFactory
from .results import PublicReading, PublicReviewCount, PublicReviewView, ReactionSummary


class PublicReviewService:
    def __init__(
        self,
        units: UnitOfWorkFactory,
        readings: PublicReadingGateway,
        authors: PublicAuthorGateway,
        analyses: AnalysisGateway,
    ):
        self.units = units
        self.readings = readings
        self.authors = authors
        self.analyses = analyses

    def reaction_summary(
        self, google_books_id: str, review_id: int, user_id: int
    ) -> ReactionSummary:
        return self._reaction(google_books_id, review_id, user_id, change=False)

    def react(
        self, google_books_id: str, review_id: int, user_id: int, kind: ReactionKind | None
    ) -> ReactionSummary:
        return self._reaction(google_books_id, review_id, user_id, change=True, kind=kind)

    def _reaction(
        self,
        google_books_id: str,
        review_id: int,
        user_id: int,
        *,
        change: bool,
        kind: ReactionKind | None = None,
    ) -> ReactionSummary:
        if review_id < 1 or user_id < 1 or (kind is not None and kind not in REACTION_KINDS):
            raise InvalidInput("Invalid reaction")
        eligible, _ = self._eligible(google_books_id)
        if not eligible:
            raise NotFound("Public review not found")
        with self.units() as unit:
            # Serialize writers on the parent even before a user's first reaction exists.
            row = unit.reviews.get(review_id, lock=change)
            if row is None or row.visibility != "public" or row.reading_id not in eligible:
                raise NotFound("Public review not found")
            if change:
                unit.reactions.set(review_id, user_id, kind)
            summary = unit.reactions.summary(review_id, user_id)
            if change:
                unit.commit()
            return summary

    def _eligible(self, google_books_id: str) -> tuple[dict[int, PublicReading], dict[int, str]]:
        if (
            not google_books_id
            or len(google_books_id) > 256
            or any(character.isspace() for character in google_books_id)
        ):
            raise InvalidInput("Invalid public review query")
        readings = self.readings.catalog_readings(google_books_id)
        if not readings:
            return {}, {}
        names = self.authors.display_names(list({reading.user_id for reading in readings}))
        eligible = {reading.id: reading for reading in readings if reading.user_id in names}
        return eligible, names

    def distribution(self, google_books_id: str) -> list[PublicReviewCount]:
        eligible, _ = self._eligible(google_books_id)
        if not eligible:
            return []
        with self.units() as unit:
            return unit.reviews.public_distribution(list(eligible))

    def list(
        self,
        google_books_id: str,
        page: int | None = None,
        limit: int = 20,
        offset: int = 0,
        *,
        page_start: int | None = None,
        page_end: int | None = None,
    ) -> list[PublicReviewView]:
        if (
            (page is not None and page < 1)
            or not 1 <= limit <= 100
            or offset < 0
            or ((page_start is None) != (page_end is None))
            or (page is not None and page_start is not None)
            or (page_start is not None and page_start < 1)
            or (page_end is not None and page_end < 1)
            or (page_start is not None and page_end is not None and page_start > page_end)
        ):
            raise InvalidInput("Invalid public review query")
        eligible, names = self._eligible(google_books_id)
        if not eligible:
            return []
        with self.units() as unit:
            rows = unit.reviews.list_public(
                list(eligible), page, limit, offset, page_start=page_start, page_end=page_end
            )
        references = [(row.id, row.revision) for row in rows if row.analysis_status == "completed"]
        previews = self.analyses.previews(references) if references else {}
        return [
            PublicReviewView(
                id=row.id,
                public_display_name=names[eligible[row.reading_id].user_id],
                page_number=row.page_number,
                iteration_number=eligible[row.reading_id].iteration_number,
                review_text=row.text.value,
                contains_spoilers=row.contains_spoilers,
                created_at=row.created_at,
                updated_at=row.updated_at,
                color_code=previews[(row.id, row.revision)].color_code
                if (row.id, row.revision) in previews
                else "#808080",
                analysis_status=row.analysis_status,
                source=previews[(row.id, row.revision)].source
                if (row.id, row.revision) in previews
                else None,
            )
            for row in rows
        ]
