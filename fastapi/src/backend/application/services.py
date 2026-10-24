import logging

from ..domain.emotions import EmotionAnalyzer
from ..domain.entities import Book, Review, User
from ..domain.values import BookDetails, ReviewText
from .ports import ReadingRepository, ReviewRepository, UserRepository
from .results import ReviewSaveResult

logger = logging.getLogger(__name__)

class UserService:
    def __init__(self, users: UserRepository) -> None:
        self.users = users

    def create(self, name: str, email: str) -> User:
        return self.users.create(name, email)

    def list(self) -> list[User]:
        return self.users.list()

    def get(self, user_id: int) -> User:
        return self.users.get(user_id)

    def update(self, user_id: int, name: str, email: str) -> User:
        user = self.users.get(user_id)
        user.name = name
        user.email = email
        return self.users.update(user)

    def delete(self, user_id: int) -> None:
        self.users.delete(user_id)

class ReadingService:
    def __init__(self, books: ReadingRepository) -> None:
        self.books = books

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

    def get(self, user_id: int, book_id: int, page: int) -> Review:
        book = self.books.get(user_id, book_id)
        book.check_page(page)
        return self.reviews.get(user_id, book_id, page)

    def save(self, user_id: int, book_id: int, page: int, text: str) -> ReviewSaveResult:
        book = self.books.get(user_id, book_id)
        book.check_page(page)
        review_text = ReviewText(text)
        normalized_text = review_text.value
        saved_text = self.reviews.save_text(user_id, book_id, page, normalized_text)
        try:
            analysis_result = self.analyzer.analyze(normalized_text)
            self.reviews.complete(saved_text.review_id, saved_text.revision, analysis_result)
        except Exception:
            logger.exception(
                "Emotion analysis failed for review %s revision %s",
                saved_text.review_id,
                saved_text.revision,
            )
            self.reviews.fail(saved_text.review_id, saved_text.revision)
        review = self.reviews.get(user_id, book_id, page)
        return ReviewSaveResult(review=review, created=saved_text.created)
