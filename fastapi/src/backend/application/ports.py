from abc import ABC, abstractmethod

from ..domain.entities import Book, Review, User
from ..domain.emotions import EmotionResult
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
    def list(self, user_id: int, limit: int, offset: int) -> list[Book]:
        raise NotImplementedError

    @abstractmethod
    def get(self, user_id: int, book_id: int) -> Book:
        raise NotImplementedError


class ReviewRepository(ABC):
    @abstractmethod
    def get(self, user_id: int, book_id: int, page: int) -> Review:
        raise NotImplementedError

    @abstractmethod
    def save_text(self, user_id: int, book_id: int, page: int, text: str) -> ReviewTextSaveResult:
        raise NotImplementedError

    @abstractmethod
    def complete(self, review_id: int, revision: int, result: EmotionResult) -> None:
        raise NotImplementedError

    @abstractmethod
    def fail(self, review_id: int, revision: int) -> None:
        raise NotImplementedError
