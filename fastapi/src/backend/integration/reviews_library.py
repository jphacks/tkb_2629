from collections.abc import Iterator
from contextlib import contextmanager

from backend.library import public as library
from backend.reviews import public as reviews


@contextmanager
def translate_library_errors() -> Iterator[None]:
    try:
        yield
    except library.NotFound as error:
        raise reviews.NotFound(str(error)) from None
    except library.Conflict as error:
        raise reviews.Conflict(str(error)) from None
    except library.InvalidInput as error:
        raise reviews.InvalidInput(str(error)) from None
    except library.ExternalServiceError as error:
        raise reviews.ExternalServiceError(str(error)) from None
    except library.ServiceUnavailable as error:
        raise reviews.ServiceUnavailable(str(error)) from None


class LibraryReadingGateway:
    def __init__(self, service: library.LibraryAccess):
        self.service = service

    def catalog_readings(self, google_books_id: str) -> list[reviews.PublicReading]:
        with translate_library_errors():
            return [
                reviews.PublicReading(key.id, key.user_id, key.iteration_number)
                for key in self.service.catalog_reading_keys(google_books_id)
            ]

    @staticmethod
    def _scope(reference: library.ReadingReference) -> reviews.ReadingScope:
        return reviews.ReadingScope(
            reference.id,
            reference.user_id,
            reference.book_id,
            reference.iteration_number,
            reference.status,
            reference.current_page,
            reference.total_pages,
        )

    def resolve(self, user_id: int, book_id: int, iteration: int | None) -> reviews.ReadingScope:
        with translate_library_errors():
            return self._scope(self.service.resolve_reading(user_id, book_id, iteration))

    def record_progress(self, scope: reviews.ReadingScope, page: int) -> reviews.ReadingScope:
        with translate_library_errors():
            return self._scope(
                self.service.record_review_progress(
                    scope.user_id, scope.book_id, scope.iteration_number, page, scope.total_pages
                )
            )

    def reading_ids(self, book_id: int, *, latest_only: bool) -> list[int]:
        with translate_library_errors():
            return [key.id for key in self.service.reading_keys(book_id, latest_only=latest_only)]

    def other_reading_ids(self, book_id: int, user_id: int) -> list[int]:
        with translate_library_errors():
            return [
                key.id
                for key in self.service.reading_keys(book_id, latest_only=False)
                if key.user_id != user_id
            ]
