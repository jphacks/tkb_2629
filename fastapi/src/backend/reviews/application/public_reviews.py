from ..domain.errors import InvalidInput
from .ports import PublicAuthorGateway, PublicReadingGateway, UnitOfWorkFactory
from .results import PublicReviewView


class PublicReviewService:
    def __init__(
        self,
        units: UnitOfWorkFactory,
        readings: PublicReadingGateway,
        authors: PublicAuthorGateway,
    ):
        self.units = units
        self.readings = readings
        self.authors = authors

    def list(
        self, google_books_id: str, page: int | None = None, limit: int = 20, offset: int = 0
    ) -> list[PublicReviewView]:
        if (
            not google_books_id
            or len(google_books_id) > 256
            or any(character.isspace() for character in google_books_id)
            or (page is not None and page < 1)
            or not 1 <= limit <= 100
            or offset < 0
        ):
            raise InvalidInput("Invalid public review query")
        readings = self.readings.catalog_readings(google_books_id)
        if not readings:
            return []
        names = self.authors.display_names(list({reading.user_id for reading in readings}))
        eligible = {reading.id: reading for reading in readings if reading.user_id in names}
        if not eligible:
            return []
        with self.units() as unit:
            rows = unit.reviews.list_public(list(eligible), page, limit, offset)
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
            )
            for row in rows
        ]
