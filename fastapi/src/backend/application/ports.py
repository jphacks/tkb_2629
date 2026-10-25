from __future__ import annotations

from abc import ABC, abstractmethod

from ..domain.catalog import CatalogBook
from ..domain.emotions import EmotionResult
from ..domain.entities import Book, PagePopularity, ReadingIteration, Review, User
from .results import ReviewTextSaveResult


class UserRepository(ABC):
    @abstractmethod
    def create(self, name: str, email: str) -> User:
        raise NotImplementedError

    @abstractmethod
    def list(self) -> list[User]:
        raise NotImplementedError

    @abstractmethod
    def get(self, user_id: int) -> User:
        raise NotImplementedError

    @abstractmethod
    def update(self, user: User) -> User:
        raise NotImplementedError

    @abstractmethod
    def delete(self, user_id: int) -> None:
        raise NotImplementedError


class ReadingRepository(ABC):
    @abstractmethod
    def add(
        self,
        user_id: int,
        title: str,
        author: str | None,
        total_pages: int,
        book_id: int | None,
    ) -> Book:
        raise NotImplementedError

    @abstractmethod
    def add_catalog_book(self, user_id: int, book: CatalogBook) -> Book:
        raise NotImplementedError

    @abstractmethod
    def list(self, user_id: int, limit: int, offset: int) -> list[Book]:
        raise NotImplementedError

    @abstractmethod
    def get(self, user_id: int, book_id: int) -> Book:
        raise NotImplementedError

    @abstractmethod
    def list_iterations(self, user_id: int, book_id: int) -> list[ReadingIteration]:
        raise NotImplementedError

    @abstractmethod
    def start_iteration(self, user_id: int, book_id: int) -> ReadingIteration:
        raise NotImplementedError

    @abstractmethod
    def complete_iteration(
        self,
        user_id: int,
        book_id: int,
        iteration_number: int,
        total_pages: int,
    ) -> ReadingIteration:
        raise NotImplementedError

    @abstractmethod
    def page_popularity(self, user_id: int, book_id: int) -> list[PagePopularity]:
        raise NotImplementedError


class BookCatalog(ABC):
    @abstractmethod
    def search(self, query: str, limit: int) -> list[CatalogBook]:
        raise NotImplementedError

    @abstractmethod
    def get(self, google_books_id: str) -> CatalogBook:
        raise NotImplementedError


class ReviewRepository(ABC):
    @abstractmethod
    def list(
        self, user_id: int, book_id: int, iteration_number: int | None, limit: int, offset: int
    ) -> list[Review]:
        raise NotImplementedError

    @abstractmethod
    def get(
        self,
        user_id: int,
        book_id: int,
        page: int,
        iteration_number: int | None,
    ) -> Review:
        raise NotImplementedError

    @abstractmethod
    def save_text(
        self,
        user_id: int,
        book_id: int,
        page: int,
        text: str,
        iteration_number: int | None,
    ) -> ReviewTextSaveResult:
        raise NotImplementedError

    @abstractmethod
    def complete(self, review_id: int, revision: int, result: EmotionResult) -> None:
        raise NotImplementedError

    @abstractmethod
    def fail(self, review_id: int, revision: int) -> None:
        raise NotImplementedError
