from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from backend.shared.database import Base


class Book(Base):
    __tablename__ = "books"
    __table_args__ = (
        UniqueConstraint("google_books_id", name="uq_books_google_books_id"),
        CheckConstraint(
            "google_books_id IS NOT NULL OR (title IS NOT NULL AND length(trim(title)) > 0)",
            name="ck_books_title_nonempty",
        ),
        CheckConstraint(
            "google_books_id IS NOT NULL OR (total_pages IS NOT NULL AND total_pages >= 1)",
            name="ck_books_total_pages_positive",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str | None] = mapped_column(String(255))
    author: Mapped[str | None] = mapped_column(String(255))
    total_pages: Mapped[int | None] = mapped_column(Integer)
    google_books_id: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class UserBook(Base):
    __tablename__ = "user_books"
    __table_args__ = (
        Index("ix_user_books_recent_reading", "user_id", "status", "last_read_at"),
        UniqueConstraint(
            "user_id",
            "book_id",
            "iteration_number",
            name="uq_user_books_user_book_iteration",
        ),
        Index(
            "uq_user_books_active_reading",
            "user_id",
            "book_id",
            unique=True,
            postgresql_where=text("status = 'reading'"),
            sqlite_where=text("status = 'reading'"),
        ),
        CheckConstraint("iteration_number > 0", name="ck_user_books_iteration_positive"),
        CheckConstraint("current_page >= 0", name="ck_user_books_current_page_nonnegative"),
        CheckConstraint("status IN ('reading', 'completed')", name="ck_user_books_status"),
        CheckConstraint(
            "status != 'completed' OR completed_at IS NOT NULL",
            name="ck_user_books_completed_at",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    book_id: Mapped[int] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True
    )
    iteration_number: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    current_page: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="reading", server_default="reading"
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class BookMemo(Base):
    __tablename__ = "book_memos"
    __table_args__ = (
        CheckConstraint("length(content) <= 10000", name="ck_book_memos_content_length"),
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    book_id: Mapped[int] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"), primary_key=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)


class BookCoverStyle(Base):
    __tablename__ = "book_cover_styles"
    __table_args__ = (
        CheckConstraint(
            "color_mode IN ('auto', 'palette', 'mine', 'others')",
            name="ck_book_cover_styles_mode",
        ),
        CheckConstraint(
            "(color_mode = 'palette' AND palette IS NOT NULL AND palette BETWEEN 0 AND 7) "
            "OR (color_mode != 'palette' AND palette IS NULL)",
            name="ck_book_cover_styles_palette",
        ),
        CheckConstraint(
            "pattern IS NULL OR pattern BETWEEN 0 AND 3", name="ck_book_cover_styles_pattern"
        ),
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    book_id: Mapped[int] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"), primary_key=True
    )
    color_mode: Mapped[str] = mapped_column(String(16), nullable=False)
    palette: Mapped[int | None] = mapped_column(Integer)
    pattern: Mapped[int | None] = mapped_column(Integer)
