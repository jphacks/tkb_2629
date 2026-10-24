from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..application.ports import BookCatalog, ReadingRepository, ReviewRepository, UserRepository
from ..application.results import ReviewTextSaveResult
from ..domain.catalog import CatalogBook
from ..domain.emotions import EmotionResult
from ..domain.entities import Book as BookEntity
from ..domain.entities import Review
from ..domain.entities import User as UserEntity
from ..domain.errors import Conflict, NotFound
from .models import Book, EmotionAnalysis, PageReview, User, UserBook


def _book(book: Book, catalog: BookCatalog | None) -> BookEntity:
    if book.google_books_id is not None:
        if catalog is None:
            raise RuntimeError("Book catalog is required to resolve Google Books metadata")
        catalog_book = catalog.get(book.google_books_id)
        return BookEntity(
            id=book.id,
            title=catalog_book.title,
            author=catalog_book.author,
            total_pages=catalog_book.total_pages,
            created_at=book.created_at,
            google_books_id=book.google_books_id,
            isbn_13=catalog_book.isbn_13,
            thumbnail_url=catalog_book.thumbnail_url,
        )
    if book.title is None or book.total_pages is None:
        raise RuntimeError("Manual book metadata is incomplete")
    return BookEntity(
        id=book.id,
        title=book.title,
        author=book.author,
        total_pages=book.total_pages,
        created_at=book.created_at,
    )


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise Conflict("The operation conflicts with existing data") from error


class SqlUserRepository(UserRepository):
    def __init__(self, db: Session) -> None:
        self.db = db

    def _row(self, user_id: int) -> User:
        user = self.db.get(User, user_id)
        if user is None:
            raise NotFound("User not found")
        return user

    def create(self, name: str, email: str) -> UserEntity:
        row = User(name=name, email=email)
        self.db.add(row)
        _commit(self.db)
        self.db.refresh(row)
        return UserEntity(id=row.id, name=row.name, email=row.email)

    def list(self) -> list[UserEntity]:
        rows = self.db.scalars(select(User)).all()
        users: list[UserEntity] = []
        for row in rows:
            user = UserEntity(id=row.id, name=row.name, email=row.email)
            users.append(user)
        return users

    def get(self, user_id: int) -> UserEntity:
        row = self._row(user_id)
        return UserEntity(id=row.id, name=row.name, email=row.email)

    def update(self, user: UserEntity) -> UserEntity:
        row = self._row(user.id)
        row.name = user.name
        row.email = user.email
        _commit(self.db)
        return self.get(user.id)

    def delete(self, user_id: int) -> None:
        self.db.delete(self._row(user_id))
        _commit(self.db)


class SqlReadingRepository(ReadingRepository):
    def __init__(self, db: Session, catalog: BookCatalog | None = None) -> None:
        self.db = db
        self.catalog = catalog

    def add(
        self,
        user_id: int,
        title: str,
        author: str | None,
        total_pages: int,
        book_id: int | None,
    ) -> BookEntity:
        if book_id is None:
            book = Book(title=title, author=author, total_pages=total_pages)
            self.db.add(book)
            try:
                self.db.flush()
            except IntegrityError as error:
                self.db.rollback()
                raise Conflict("Could not create book") from error
        else:
            book = self.db.get(Book, book_id)
            if book is None:
                raise NotFound("Book not found")
            if book.title != title or book.author != author or book.total_pages != total_pages:
                raise Conflict("Book metadata does not match the existing book")
        reading = UserBook(user_id=user_id, book_id=book.id)
        self.db.add(reading)
        _commit(self.db)
        self.db.refresh(book)
        self.db.refresh(reading)
        return _book(book, self.catalog)

    def add_catalog_book(self, user_id: int, catalog_book: CatalogBook) -> BookEntity:
        book = self.db.scalar(
            select(Book).where(Book.google_books_id == catalog_book.google_books_id)
        )

        if book is None:
            book = Book(google_books_id=catalog_book.google_books_id)
            self.db.add(book)
            try:
                self.db.flush()
            except IntegrityError as error:
                self.db.rollback()
                book = self.db.scalar(
                    select(Book).where(Book.google_books_id == catalog_book.google_books_id)
                )
                if book is None:
                    raise Conflict("Could not create catalog book") from error

        existing_reading_id = self.db.scalar(
            select(UserBook.id).where(
                UserBook.user_id == user_id,
                UserBook.book_id == book.id,
            )
        )
        if existing_reading_id is not None:
            raise Conflict("Book is already in the bookshelf")

        reading = UserBook(user_id=user_id, book_id=book.id)
        self.db.add(reading)
        _commit(self.db)
        self.db.refresh(book)
        return BookEntity(
            id=book.id,
            title=catalog_book.title,
            author=catalog_book.author,
            total_pages=catalog_book.total_pages,
            created_at=book.created_at,
            google_books_id=catalog_book.google_books_id,
            isbn_13=catalog_book.isbn_13,
            thumbnail_url=catalog_book.thumbnail_url,
        )

    def list(self, user_id: int, limit: int, offset: int) -> list[BookEntity]:
        statement = (
            select(Book)
            .join(UserBook, UserBook.book_id == Book.id)
            .where(UserBook.user_id == user_id)
            .order_by(Book.id)
            .limit(limit)
            .offset(offset)
        )
        rows = self.db.scalars(statement).all()
        books: list[BookEntity] = []
        for row in rows:
            books.append(_book(row, self.catalog))
        return books

    def get(self, user_id: int, book_id: int) -> BookEntity:
        statement = (
            select(Book)
            .join(UserBook, UserBook.book_id == Book.id)
            .where(Book.id == book_id, UserBook.user_id == user_id)
        )
        row = self.db.scalars(statement).one_or_none()
        if row is None:
            raise NotFound("Book not found")
        return _book(row, self.catalog)


def _revise_page_review(db: Session, review_id: int, review_text: str) -> int:
    revision = db.scalar(
        update(PageReview)
        .where(PageReview.id == review_id)
        .values(
            review_text=review_text,
            analysis_revision=PageReview.analysis_revision + 1,
            analysis_status="pending",
        )
        .returning(PageReview.analysis_revision)
    )
    if revision is None:
        db.rollback()
        raise NotFound("Review not found")
    db.commit()
    return revision


class SqlReviewRepository(ReviewRepository):
    def __init__(self, db: Session) -> None:
        self.db = db

    def _row(self, reading_id: int, page: int) -> PageReview | None:
        return self.db.scalar(
            select(PageReview)
            .where(PageReview.user_book_id == reading_id, PageReview.page_number == page)
            .execution_options(populate_existing=True)
        )

    def _reading_id(self, user_id: int, book_id: int) -> int:
        reading_id = self.db.scalar(
            select(UserBook.id).where(UserBook.user_id == user_id, UserBook.book_id == book_id)
        )
        if reading_id is None:
            raise NotFound("Book not found")
        return reading_id

    def get(self, user_id: int, book_id: int, page: int) -> Review:
        row = self._row(self._reading_id(user_id, book_id), page)
        if row is None:
            raise NotFound("Review not found")
        color_code = "#808080"
        if row.analysis_status == "completed":
            result = self.db.scalar(
                select(EmotionAnalysis).where(
                    EmotionAnalysis.review_id == row.id,
                    EmotionAnalysis.review_revision == row.analysis_revision,
                )
            )
            if result is not None:
                color_code = result.color_code
        return Review(
            id=row.id,
            book_id=book_id,
            page_number=page,
            review_text=row.review_text,
            color_code=color_code,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def save_text(self, user_id: int, book_id: int, page: int, text: str) -> ReviewTextSaveResult:
        reading_id = self._reading_id(user_id, book_id)
        row = self._row(reading_id, page)
        if row is not None:
            revision = _revise_page_review(self.db, row.id, text)
            return ReviewTextSaveResult(review_id=row.id, revision=revision, created=False)
        row = PageReview(
            user_book_id=reading_id,
            page_number=page,
            review_text=text,
            analysis_status="pending",
            analysis_revision=1,
        )
        self.db.add(row)
        try:
            self.db.flush()
            review_id = row.id
            revision = row.analysis_revision
            self.db.commit()
        except IntegrityError as error:
            self.db.rollback()
            row = self._row(reading_id, page)
            if row is None:
                raise Conflict("Could not save review") from error
            revision = _revise_page_review(self.db, row.id, text)
            return ReviewTextSaveResult(review_id=row.id, revision=revision, created=False)
        return ReviewTextSaveResult(review_id=review_id, revision=revision, created=True)

    def complete(self, review_id: int, revision: int, result: EmotionResult) -> None:
        statement = (
            update(PageReview)
            .where(PageReview.id == review_id, PageReview.analysis_revision == revision)
            .values(analysis_status="completed")
        )
        completed = self.db.execute(statement)
        if completed.rowcount != 1:
            self.db.rollback()
            return

        analysis = EmotionAnalysis(
            review_id=review_id,
            review_revision=revision,
            emotion_label=result.emotion_label,
            color_code=result.color_code,
            confidence=result.confidence,
            model_version=result.model_version,
            source=result.source,
            valence=result.valence,
            arousal=result.arousal,
            palette_version=result.palette_version,
            **(result.emotion_vector.as_dict() if result.emotion_vector else {}),
            **(
                {
                    "projection_x": result.emotion_projection.x,
                    "projection_y": result.emotion_projection.y,
                    "coherence": result.emotion_projection.coherence,
                    "intensity": result.emotion_projection.intensity,
                }
                if result.emotion_projection
                else {}
            ),
        )
        self.db.add(analysis)
        self.db.commit()

    def fail(self, review_id: int, revision: int) -> None:
        self.db.rollback()
        statement = (
            update(PageReview)
            .where(PageReview.id == review_id, PageReview.analysis_revision == revision)
            .values(analysis_status="failed")
        )
        self.db.execute(statement)
        self.db.commit()
