from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import and_, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..application.ports import BookCatalog, ReadingRepository, ReviewRepository, UserRepository
from ..application.results import ReviewTextSaveResult
from ..domain.catalog import CatalogBook
from ..domain.emotions import EmotionResult
from ..domain.entities import (
    Book as BookEntity,
)
from ..domain.entities import (
    PagePopularity,
    ReadingIteration,
    Review,
)
from ..domain.entities import (
    User as UserEntity,
)
from ..domain.errors import Conflict, NotFound
from .models import Book, EmotionAnalysis, PageReview, User, UserBook


def _book(book: Book, catalog: BookCatalog | None, reading: UserBook) -> BookEntity:
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
            latest_iteration=reading.iteration_number,
            reading_status=reading.status,
            current_page=reading.current_page,
            started_at=reading.started_at,
            completed_at=reading.completed_at,
        )
    if book.title is None or book.total_pages is None:
        raise RuntimeError("Manual book metadata is incomplete")
    return BookEntity(
        id=book.id,
        title=book.title,
        author=book.author,
        total_pages=book.total_pages,
        created_at=book.created_at,
        latest_iteration=reading.iteration_number,
        reading_status=reading.status,
        current_page=reading.current_page,
        started_at=reading.started_at,
        completed_at=reading.completed_at,
    )


def _iteration(reading: UserBook) -> ReadingIteration:
    return ReadingIteration(
        iteration_number=reading.iteration_number,
        status=reading.status,
        current_page=reading.current_page,
        started_at=reading.started_at,
        completed_at=reading.completed_at,
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
        reading = UserBook(user_id=user_id, book_id=book.id, iteration_number=1)
        self.db.add(reading)
        _commit(self.db)
        self.db.refresh(book)
        self.db.refresh(reading)
        return _book(book, self.catalog, reading)

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

        reading = UserBook(user_id=user_id, book_id=book.id, iteration_number=1)
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
            latest_iteration=reading.iteration_number,
            reading_status=reading.status,
            current_page=reading.current_page,
            started_at=reading.started_at,
            completed_at=reading.completed_at,
        )

    def list(self, user_id: int, limit: int, offset: int) -> list[BookEntity]:
        latest_iteration = (
            select(func.max(UserBook.iteration_number))
            .where(
                UserBook.user_id == user_id,
                UserBook.book_id == Book.id,
            )
            .correlate(Book)
            .scalar_subquery()
        )
        statement = (
            select(Book, UserBook)
            .join(UserBook, UserBook.book_id == Book.id)
            .where(
                UserBook.user_id == user_id,
                UserBook.iteration_number == latest_iteration,
            )
            .order_by(Book.id)
            .limit(limit)
            .offset(offset)
        )
        rows = self.db.execute(statement).all()
        books: list[BookEntity] = []
        for book, reading in rows:
            books.append(_book(book, self.catalog, reading))
        return books

    def get(self, user_id: int, book_id: int) -> BookEntity:
        statement = (
            select(Book, UserBook)
            .join(UserBook, UserBook.book_id == Book.id)
            .where(Book.id == book_id, UserBook.user_id == user_id)
            .order_by(UserBook.iteration_number.desc())
            .limit(1)
        )
        row = self.db.execute(statement).one_or_none()
        if row is None:
            raise NotFound("Book not found")
        book, reading = row
        return _book(book, self.catalog, reading)

    def list_iterations(self, user_id: int, book_id: int) -> list[ReadingIteration]:
        rows = self.db.scalars(
            select(UserBook)
            .where(UserBook.user_id == user_id, UserBook.book_id == book_id)
            .order_by(UserBook.iteration_number)
        ).all()
        if not rows:
            raise NotFound("Book not found")
        return [_iteration(row) for row in rows]

    def start_iteration(self, user_id: int, book_id: int) -> ReadingIteration:
        latest = self.db.scalar(
            select(UserBook)
            .where(UserBook.user_id == user_id, UserBook.book_id == book_id)
            .order_by(UserBook.iteration_number.desc())
            .limit(1)
        )
        if latest is None:
            raise NotFound("Book not found")
        if latest.status != "completed":
            raise Conflict("Complete the current reading before starting another")
        reading = UserBook(
            user_id=user_id,
            book_id=book_id,
            iteration_number=latest.iteration_number + 1,
        )
        self.db.add(reading)
        _commit(self.db)
        self.db.refresh(reading)
        return _iteration(reading)

    def complete_iteration(
        self,
        user_id: int,
        book_id: int,
        iteration_number: int,
        total_pages: int,
    ) -> ReadingIteration:
        reading = self.db.scalar(
            select(UserBook).where(
                UserBook.user_id == user_id,
                UserBook.book_id == book_id,
                UserBook.iteration_number == iteration_number,
            )
        )
        if reading is None:
            raise NotFound("Reading iteration not found")
        if reading.status == "completed":
            raise Conflict("Reading iteration is already completed")
        reading.status = "completed"
        reading.current_page = total_pages
        reading.completed_at = datetime.now(UTC)
        _commit(self.db)
        self.db.refresh(reading)
        return _iteration(reading)

    def page_popularity(self, user_id: int, book_id: int) -> list[PagePopularity]:
        owned_reading_id = self.db.scalar(
            select(UserBook.id)
            .where(UserBook.user_id == user_id, UserBook.book_id == book_id)
            .limit(1)
        )
        if owned_reading_id is None:
            raise NotFound("Book not found")
        latest_iterations = (
            select(
                UserBook.user_id.label("user_id"),
                func.max(UserBook.iteration_number).label("iteration_number"),
            )
            .where(UserBook.book_id == book_id)
            .group_by(UserBook.user_id)
            .subquery()
        )
        rows = self.db.execute(
            select(
                PageReview.page_number,
                func.count(UserBook.user_id).label("user_count"),
            )
            .join(UserBook, UserBook.id == PageReview.user_book_id)
            .join(
                latest_iterations,
                and_(
                    latest_iterations.c.user_id == UserBook.user_id,
                    latest_iterations.c.iteration_number == UserBook.iteration_number,
                ),
            )
            .where(UserBook.book_id == book_id)
            .group_by(PageReview.page_number)
            .order_by(PageReview.page_number)
        ).all()
        return [
            PagePopularity(page_number=page_number, user_count=user_count)
            for page_number, user_count in rows
        ]


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

    def _reading(
        self,
        user_id: int,
        book_id: int,
        iteration_number: int | None,
    ) -> UserBook:
        statement = select(UserBook).where(
            UserBook.user_id == user_id,
            UserBook.book_id == book_id,
        )
        if iteration_number is not None:
            statement = statement.where(UserBook.iteration_number == iteration_number)
        else:
            statement = statement.order_by(UserBook.iteration_number.desc()).limit(1)
        reading = self.db.scalar(statement)
        if reading is None:
            raise NotFound("Book not found")
        return reading

    def get(
        self,
        user_id: int,
        book_id: int,
        page: int,
        iteration_number: int | None,
    ) -> Review:
        reading = self._reading(user_id, book_id, iteration_number)
        row = self._row(reading.id, page)
        if row is None:
            raise NotFound("Review not found")
        result = None
        if row.analysis_status == "completed":
            result = self.db.scalar(
                select(EmotionAnalysis).where(
                    EmotionAnalysis.review_id == row.id,
                    EmotionAnalysis.review_revision == row.analysis_revision,
                )
            )
        return self._review(row, reading, book_id, result)

    def _review(
        self, row: PageReview, reading: UserBook, book_id: int, result: EmotionAnalysis | None
    ) -> Review:
        return Review(
            id=row.id,
            book_id=book_id,
            page_number=row.page_number,
            review_text=row.review_text,
            color_code=result.color_code if result else "#808080",
            created_at=row.created_at,
            updated_at=row.updated_at,
            iteration_number=reading.iteration_number,
            analysis_status=row.analysis_status,
            source=result.source if result else None,
        )

    def list(
        self, user_id: int, book_id: int, iteration_number: int | None, limit: int, offset: int
    ) -> list[Review]:
        reading = self._reading(user_id, book_id, iteration_number)
        rows = self.db.execute(
            select(PageReview, EmotionAnalysis)
            .outerjoin(
                EmotionAnalysis,
                and_(
                    EmotionAnalysis.review_id == PageReview.id,
                    EmotionAnalysis.review_revision == PageReview.analysis_revision,
                    PageReview.analysis_status == "completed",
                ),
            )
            .where(PageReview.user_book_id == reading.id)
            .order_by(PageReview.page_number)
            .limit(limit)
            .offset(offset)
            .execution_options(populate_existing=True)
        ).all()
        return [self._review(row, reading, book_id, result) for row, result in rows]

    def save_text(
        self,
        user_id: int,
        book_id: int,
        page: int,
        text: str,
        iteration_number: int | None,
    ) -> ReviewTextSaveResult:
        reading = self._reading(user_id, book_id, iteration_number)
        if reading.status != "reading":
            raise Conflict("Cannot edit a completed reading iteration")
        reading.current_page = max(reading.current_page, page)
        row = self._row(reading.id, page)
        if row is not None:
            revision = _revise_page_review(self.db, row.id, text)
            return ReviewTextSaveResult(review_id=row.id, revision=revision, created=False)
        row = PageReview(
            user_book_id=reading.id,
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
            reading = self._reading(user_id, book_id, iteration_number)
            row = self._row(reading.id, page)
            if row is None:
                raise Conflict("Could not save review") from error
            reading.current_page = max(reading.current_page, page)
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
            **(result.emotion_vector.as_percentages() if result.emotion_vector else {}),
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
