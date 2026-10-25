from __future__ import annotations

from ..domain.catalog import CatalogBook
from ..domain.entities import BookshelfPolicy, Reading, StoredBook
from ..domain.errors import InvalidInput
from ..domain.values import BookDetails
from .ports import BookCatalog, Clock, UnitOfWorkFactory
from .results import BookView, ReadingKey, ReadingReference


class LibraryService:
    def __init__(self, units: UnitOfWorkFactory, catalog: BookCatalog, clock: Clock):
        self.units = units
        self.catalog = catalog
        self.clock = clock

    def search(self, query: str, limit: int) -> list[CatalogBook]:
        query = query.strip()
        if not query:
            raise InvalidInput("query must not be empty")
        return self.catalog.search(query, limit)

    def _view(
        self, book: StoredBook, reading: Reading, metadata: CatalogBook | None = None
    ) -> BookView:
        if book.google_books_id is not None:
            metadata = metadata or self.catalog.get(book.google_books_id)
            title, author, pages = metadata.title, metadata.author, metadata.total_pages
        else:
            if book.title is None or book.total_pages is None:
                raise InvalidInput("Manual book metadata is incomplete")
            title, author, pages = book.title, book.author, book.total_pages
        return BookView(
            id=book.id,
            title=title,
            author=author,
            total_pages=pages,
            created_at=book.created_at,
            google_books_id=book.google_books_id,
            isbn_13=metadata.isbn_13 if metadata else None,
            thumbnail_url=metadata.thumbnail_url if metadata else None,
            latest_iteration=reading.iteration_number,
            reading_status=reading.status,
            current_page=reading.current_page,
            started_at=reading.started_at,
            completed_at=reading.completed_at,
        )

    def register(
        self,
        user_id: int,
        title: str,
        author: str | None,
        total_pages: int,
        book_id: int | None = None,
    ) -> BookView:
        details = BookDetails(title, author, total_pages)
        with self.units() as unit:
            if book_id is None:
                book = unit.books.add_manual(details)
            else:
                book = unit.books.get(book_id, lock=True)
                book.require_metadata(details)
            BookshelfPolicy.require_new(unit.readings.exists(user_id, book.id))
            reading = unit.readings.add(Reading.start(user_id, book.id, self.clock.now()))
            unit.commit()
        return self._view(book, reading)

    def import_catalog_book(self, user_id: int, google_books_id: str) -> BookView:
        metadata = self.catalog.get(google_books_id)
        with self.units() as unit:
            book = unit.books.get_or_add_catalog(metadata.google_books_id)
            BookshelfPolicy.require_new(unit.readings.exists(user_id, book.id))
            reading = unit.readings.add(Reading.start(user_id, book.id, self.clock.now()))
            unit.commit()
        return self._view(book, reading, metadata)

    def list(self, user_id: int, limit: int, offset: int) -> list[BookView]:
        with self.units() as unit:
            rows = unit.books.list_owned(user_id, limit, offset)
        return [self._view(book, reading) for book, reading in rows]

    def get(self, user_id: int, book_id: int) -> BookView:
        with self.units() as unit:
            reading = unit.readings.get(user_id, book_id)
            book = unit.books.get(book_id)
        return self._view(book, reading)

    def list_iterations(self, user_id: int, book_id: int) -> list[Reading]:
        with self.units() as unit:
            unit.readings.get(user_id, book_id)
            return unit.readings.list(user_id, book_id)

    def start_iteration(self, user_id: int, book_id: int) -> Reading:
        with self.units() as unit:
            unit.books.get(book_id, lock=True)
            latest = unit.readings.get(user_id, book_id, lock=True)
            reading = unit.readings.add(latest.start_next(self.clock.now()))
            unit.commit()
            return reading

    def complete_iteration(self, user_id: int, book_id: int, iteration: int) -> Reading:
        metadata = self.get(user_id, book_id)
        with self.units() as unit:
            reading = unit.readings.get(user_id, book_id, iteration, lock=True)
            reading.complete(metadata.total_pages, self.clock.now())
            unit.readings.save(reading)
            unit.commit()
            return reading

    def resolve_reading(
        self, user_id: int, book_id: int, iteration: int | None
    ) -> ReadingReference:
        with self.units() as unit:
            reading = unit.readings.get(user_id, book_id, iteration)
            book = unit.books.get(book_id)
        view = self._view(book, reading)
        return ReadingReference(
            reading.id,
            user_id,
            book_id,
            reading.iteration_number,
            reading.status,
            reading.current_page,
            view.total_pages,
        )

    def record_review_progress(
        self, user_id: int, book_id: int, iteration: int, page: int, total_pages: int
    ) -> ReadingReference:
        # When called through the transaction adapter this participates in the review UoW.
        with self.units() as unit:
            reading = unit.readings.get(user_id, book_id, iteration, lock=True)
            reading.record_progress(page, total_pages)
            unit.readings.save(reading)
            unit.commit()
            return ReadingReference(
                reading.id,
                user_id,
                book_id,
                reading.iteration_number,
                reading.status,
                reading.current_page,
                total_pages,
            )

    def reading_keys(self, book_id: int, *, latest_only: bool) -> list[ReadingKey]:
        with self.units() as unit:
            return [
                ReadingKey(item.id, item.user_id, item.iteration_number)
                for item in unit.readings.for_book(book_id, latest_only=latest_only)
            ]

    def catalog_reading_keys(self, google_books_id: str) -> list[ReadingKey]:
        with self.units() as unit:
            book = unit.books.find_catalog(google_books_id)
            if book is None:
                return []
            return [
                ReadingKey(item.id, item.user_id, item.iteration_number)
                for item in unit.readings.for_book(book.id, latest_only=False)
            ]
