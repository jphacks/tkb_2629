from __future__ import annotations

import logging

from ..domain.catalog import CatalogBook
from ..domain.emotions import EmotionAnalyzer, EmotionResult
from ..domain.entities import Book, PagePopularity, ReadingIteration, Review, User
from ..domain.errors import InvalidInput
from ..domain.values import BookDetails, ReviewText, UserDetails
from .ports import BookCatalog, ReadingRepository, ReviewRepository, UserRepository
from .results import ReviewSaveResult

logger = logging.getLogger(__name__)


class CatalogService:
    def __init__(self, catalog: BookCatalog) -> None:
        self.catalog = catalog

    def search(self, query: str, limit: int) -> list[CatalogBook]:
        normalized_query = query.strip()
        if not normalized_query:
            raise InvalidInput("query must not be empty")
        return self.catalog.search(normalized_query, limit)


class UserService:
    def __init__(self, users: UserRepository) -> None:
        self.users = users

    def create(self, name: str, email: str) -> User:
        details = UserDetails(name, email)
        return self.users.create(details.name, details.email)

    def list(self) -> list[User]:
        return self.users.list()

    def get(self, user_id: int) -> User:
        return self.users.get(user_id)

    def update(self, user_id: int, name: str, email: str) -> User:
        details = UserDetails(name, email)
        user = self.users.get(user_id)
        user.name = details.name
        user.email = details.email
        return self.users.update(user)

    def delete(self, user_id: int) -> None:
        self.users.delete(user_id)


class ReadingService:
    def __init__(
        self,
        books: ReadingRepository,
        catalog: BookCatalog | None = None,
    ) -> None:
        self.books = books
        self.catalog = catalog

    def register(
        self,
        user_id: int,
        title: str,
        author: str | None,
        total_pages: int,
        book_id: int | None = None,
    ) -> Book:
        details = BookDetails(title, author, total_pages)
        return self.books.add(user_id, details.title, details.author, details.total_pages, book_id)

    def list(self, user_id: int, limit: int, offset: int) -> list[Book]:
        return self.books.list(user_id, limit, offset)

    def get(self, user_id: int, book_id: int) -> Book:
        return self.books.get(user_id, book_id)

    def import_catalog_book(self, user_id: int, google_books_id: str) -> Book:
        if self.catalog is None:
            raise RuntimeError("Book catalog is not configured")
        catalog_book = self.catalog.get(google_books_id)
        return self.books.add_catalog_book(user_id, catalog_book)

    def list_iterations(self, user_id: int, book_id: int) -> list[ReadingIteration]:
        self.books.get(user_id, book_id)
        return self.books.list_iterations(user_id, book_id)

    def start_iteration(self, user_id: int, book_id: int) -> ReadingIteration:
        self.books.get(user_id, book_id)
        return self.books.start_iteration(user_id, book_id)

    def complete_iteration(
        self,
        user_id: int,
        book_id: int,
        iteration_number: int,
    ) -> ReadingIteration:
        book = self.books.get(user_id, book_id)
        return self.books.complete_iteration(
            user_id,
            book_id,
            iteration_number,
            book.total_pages,
        )

    def page_popularity(self, user_id: int, book_id: int) -> list[PagePopularity]:
        return self.books.page_popularity(user_id, book_id)


class ReviewService:
    def __init__(
        self,
        books: ReadingRepository,
        reviews: ReviewRepository,
        analyzer: EmotionAnalyzer,
    ) -> None:
        self.books = books
        self.reviews = reviews
        self.analyzer = analyzer

    def list(
        self,
        user_id: int,
        book_id: int,
        iteration_number: int | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Review]:
        self.books.get(user_id, book_id)
        return self.reviews.list(user_id, book_id, iteration_number, limit, offset)

    def get(
        self,
        user_id: int,
        book_id: int,
        page: int,
        iteration_number: int | None = None,
    ) -> Review:
        book = self.books.get(user_id, book_id)
        book.check_page(page)
        return self.reviews.get(user_id, book_id, page, iteration_number)

    def save(
        self,
        user_id: int,
        book_id: int,
        page: int,
        text: str,
        iteration_number: int | None = None,
    ) -> ReviewSaveResult:
        book = self.books.get(user_id, book_id)
        book.check_page(page)
        review_text = ReviewText(text)
        normalized_text = review_text.value
        saved_text = self.reviews.save_text(
            user_id,
            book_id,
            page,
            normalized_text,
            iteration_number,
        )
        try:
            analysis_result: EmotionResult = self.analyzer.analyze(normalized_text)
            self.reviews.complete(saved_text.review_id, saved_text.revision, analysis_result)
        except Exception:
            logger.exception(
                "Emotion analysis failed for review %s revision %s",
                saved_text.review_id,
                saved_text.revision,
            )
            self.reviews.fail(saved_text.review_id, saved_text.revision)
        review = self.reviews.get(user_id, book_id, page, iteration_number)
        return ReviewSaveResult(review=review, created=saved_text.created)
