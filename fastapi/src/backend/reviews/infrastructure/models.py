from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from backend.shared.database import Base

from ..domain.reactions import ReactionKind
from ..domain.values import ReviewVisibility


class ReviewReaction(Base):
    __tablename__ = "review_reactions"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('empathy', 'insight', 'curious')", name="ck_review_reactions_kind"
        ),
    )

    review_id: Mapped[int] = mapped_column(
        ForeignKey("page_reviews.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    kind: Mapped[ReactionKind] = mapped_column(String(7), nullable=False)


class PageReview(Base):
    __tablename__ = "page_reviews"
    __table_args__ = (
        UniqueConstraint("user_book_id", "page_number", name="uq_page_reviews_user_book_page"),
        CheckConstraint("page_number > 0", name="ck_page_reviews_page_number_positive"),
        CheckConstraint("length(trim(review_text)) > 0", name="ck_page_reviews_text_nonempty"),
        CheckConstraint(
            "analysis_status IN ('pending', 'completed', 'failed')",
            name="ck_page_reviews_analysis_status",
        ),
        CheckConstraint(
            "visibility IN ('private', 'public')",
            name="ck_page_reviews_visibility",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_book_id: Mapped[int] = mapped_column(
        ForeignKey("user_books.id", ondelete="CASCADE"), nullable=False, index=True
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    review_text: Mapped[str] = mapped_column(Text, nullable=False)
    visibility: Mapped[ReviewVisibility] = mapped_column(
        String(7), nullable=False, default="private", server_default="private"
    )
    contains_spoilers: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    analysis_revision: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    analysis_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending", server_default="pending"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
