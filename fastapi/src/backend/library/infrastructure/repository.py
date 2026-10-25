from __future__ import annotations

from sqlalchemy import and_, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..domain.entities import Reading, StoredBook
from ..domain.errors import InvalidInput, NotFound
from ..domain.values import BookDetails, CoverStyle
from .models import Book, BookCoverStyle, BookMemo, UserBook


def stored_book(row: Book) -> StoredBook:
    return StoredBook(
        row.id, row.title, row.author, row.total_pages, row.google_books_id, row.created_at
    )


def reading_entity(row: UserBook) -> Reading:
    return Reading(
        row.id,
        row.user_id,
        row.book_id,
        row.iteration_number,
        row.status,
        row.current_page,
        row.started_at,
        row.completed_at,
        row.last_read_at,
    )


class SqlBookRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_cover(self, user_id: int, book_id: int) -> CoverStyle:
        row = self.db.get(BookCoverStyle, (user_id, book_id))
        if row is None:
            return CoverStyle()
        if row.color_mode not in ("auto", "palette", "mine", "others"):
            raise InvalidInput("Invalid stored cover color mode")
        return CoverStyle(row.color_mode, row.palette, row.pattern)

    def save_cover(self, user_id: int, book_id: int, style: CoverStyle) -> None:
        row = self.db.get(BookCoverStyle, (user_id, book_id))
        if style == CoverStyle():
            if row is not None:
                self.db.delete(row)
            return
        if row is None:
            row = BookCoverStyle(user_id=user_id, book_id=book_id)
            self.db.add(row)
        row.color_mode, row.palette, row.pattern = style.color_mode, style.palette, style.pattern

    def get_memo(self, user_id: int, book_id: int) -> str:
        row = self.db.get(BookMemo, (user_id, book_id))
        return row.content if row is not None else ""

    def save_memo(self, user_id: int, book_id: int, content: str) -> None:
        row = self.db.get(BookMemo, (user_id, book_id))
        if not content:
            if row is not None:
                self.db.delete(row)
        elif row is None:
            self.db.add(BookMemo(user_id=user_id, book_id=book_id, content=content))
        else:
            row.content = content

    def find_catalog(self, google_books_id: str) -> StoredBook | None:
        row = self.db.scalar(select(Book).where(Book.google_books_id == google_books_id))
        return stored_book(row) if row is not None else None

    def list_popular(self, limit: int) -> list[tuple[str, int]]:
        readers = func.count(func.distinct(UserBook.user_id))
        rows = self.db.execute(
            select(Book.google_books_id, readers)
            .join(UserBook, UserBook.book_id == Book.id)
            .where(Book.google_books_id.is_not(None))
            .group_by(Book.id, Book.google_books_id)
            .order_by(readers.desc(), Book.id.asc())
            .limit(limit)
        )
        return [(catalog_id, count) for catalog_id, count in rows]

    def get(self, book_id: int, *, lock: bool = False) -> StoredBook:
        statement = select(Book).where(Book.id == book_id)
        if lock:
            statement = statement.with_for_update()
        row = self.db.scalar(statement)
        if row is None:
            raise NotFound("Book not found")
        return stored_book(row)

    def add_manual(self, details: BookDetails) -> StoredBook:
        row = Book(title=details.title, author=details.author, total_pages=details.total_pages)
        self.db.add(row)
        self.db.flush()
        return stored_book(row)

    def get_or_add_catalog(self, google_books_id: str) -> StoredBook:
        self.db.execute(
            insert(Book)
            .values(google_books_id=google_books_id)
            .on_conflict_do_nothing(index_elements=[Book.google_books_id])
        )
        row = self.db.scalar(
            select(Book).where(Book.google_books_id == google_books_id).with_for_update()
        )
        if row is None:
            raise NotFound("Book not found")
        return stored_book(row)

    def list_owned(self, user_id: int, limit: int, offset: int) -> list[tuple[StoredBook, Reading]]:
        latest = (
            select(func.max(UserBook.iteration_number))
            .where(UserBook.user_id == user_id, UserBook.book_id == Book.id)
            .correlate(Book)
            .scalar_subquery()
        )
        rows = self.db.execute(
            select(Book, UserBook)
            .join(UserBook, UserBook.book_id == Book.id)
            .where(UserBook.user_id == user_id, UserBook.iteration_number == latest)
            .order_by(Book.id)
            .limit(limit)
            .offset(offset)
        ).all()
        return [(stored_book(book), reading_entity(reading)) for book, reading in rows]

    def list_recent_reading(self, user_id: int, limit: int) -> list[tuple[StoredBook, Reading]]:
        latest = (
            select(func.max(UserBook.iteration_number))
            .where(UserBook.user_id == user_id, UserBook.book_id == Book.id)
            .correlate(Book)
            .scalar_subquery()
        )
        rows = self.db.execute(
            select(Book, UserBook)
            .join(UserBook, UserBook.book_id == Book.id)
            .where(
                UserBook.user_id == user_id,
                UserBook.iteration_number == latest,
                UserBook.status == "reading",
            )
            .order_by(
                UserBook.last_read_at.desc().nulls_last(),
                UserBook.started_at.desc(),
                UserBook.id.desc(),
            )
            .limit(limit)
        )
        return [(stored_book(book), reading_entity(reading)) for book, reading in rows]


class SqlReadingRepository:
    def __init__(self, db: Session):
        self.db = db

    def owned_ids(self, user_id: int) -> list[int]:
        return list(self.db.scalars(select(UserBook.id).where(UserBook.user_id == user_id)))

    def discovery_candidates(self, user_id: int) -> dict[str, list[int]]:
        owned = select(UserBook.book_id).where(UserBook.user_id == user_id)
        rows = self.db.execute(
            select(Book.google_books_id, UserBook.id)
            .join(UserBook, UserBook.book_id == Book.id)
            .where(Book.google_books_id.is_not(None), Book.id.not_in(owned))
            .order_by(Book.google_books_id, UserBook.id)
        )
        candidates: dict[str, list[int]] = {}
        for catalog_id, reading_id in rows:
            candidates.setdefault(catalog_id, []).append(reading_id)
        return candidates

    def get(
        self, user_id: int, book_id: int, iteration: int | None = None, *, lock: bool = False
    ) -> Reading:
        statement = select(UserBook).where(UserBook.user_id == user_id, UserBook.book_id == book_id)
        if iteration is None:
            statement = statement.order_by(UserBook.iteration_number.desc()).limit(1)
        else:
            statement = statement.where(UserBook.iteration_number == iteration)
        if lock:
            statement = statement.with_for_update()
        row = self.db.scalar(statement.execution_options(populate_existing=True))
        if row is None:
            raise NotFound("Book or reading iteration not found")
        return reading_entity(row)

    def exists(self, user_id: int, book_id: int) -> bool:
        return (
            self.db.scalar(
                select(UserBook.id)
                .where(UserBook.user_id == user_id, UserBook.book_id == book_id)
                .limit(1)
            )
            is not None
        )

    def list(self, user_id: int, book_id: int) -> list[Reading]:
        return [
            reading_entity(row)
            for row in self.db.scalars(
                select(UserBook)
                .where(UserBook.user_id == user_id, UserBook.book_id == book_id)
                .order_by(UserBook.iteration_number)
            )
        ]

    def for_book(self, book_id: int, *, latest_only: bool) -> list[Reading]:
        statement = select(UserBook).where(UserBook.book_id == book_id)
        if latest_only:
            latest = (
                select(
                    UserBook.user_id.label("user_id"),
                    func.max(UserBook.iteration_number).label("iteration"),
                )
                .where(UserBook.book_id == book_id)
                .group_by(UserBook.user_id)
                .subquery()
            )
            statement = statement.join(
                latest,
                and_(
                    latest.c.user_id == UserBook.user_id,
                    latest.c.iteration == UserBook.iteration_number,
                ),
            )
        return [reading_entity(row) for row in self.db.scalars(statement)]

    def add(self, reading: Reading) -> Reading:
        row = UserBook(
            user_id=reading.user_id,
            book_id=reading.book_id,
            iteration_number=reading.iteration_number,
            status=reading.status,
            current_page=reading.current_page,
            started_at=reading.started_at,
            completed_at=reading.completed_at,
            last_read_at=reading.last_read_at,
        )
        self.db.add(row)
        self.db.flush()
        return reading_entity(row)

    def save(self, reading: Reading) -> None:
        self.db.execute(
            update(UserBook)
            .where(UserBook.id == reading.id)
            .values(
                status=reading.status,
                current_page=reading.current_page,
                completed_at=reading.completed_at,
                last_read_at=reading.last_read_at,
            )
        )
