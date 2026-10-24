from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)


class Book(Base):
    __tablename__ = "books"
    __table_args__ = (
        CheckConstraint("length(trim(title)) > 0", name="ck_books_title_nonempty"),
        CheckConstraint("total_pages >= 1", name="ck_books_total_pages_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    author: Mapped[str | None] = mapped_column(String(255))
    total_pages: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class UserBook(Base):
    __tablename__ = "user_books"
    __table_args__ = (
        UniqueConstraint("user_id", "book_id", name="uq_user_books_user_book"),
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


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
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_book_id: Mapped[int] = mapped_column(
        ForeignKey("user_books.id", ondelete="CASCADE"), nullable=False, index=True
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    review_text: Mapped[str] = mapped_column(Text, nullable=False)
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


class EmotionAnalysis(Base):
    __tablename__ = "emotion_analyses"
    __table_args__ = (
        UniqueConstraint(
            "review_id", "review_revision", name="uq_emotion_analyses_review_revision"
        ),
        CheckConstraint("source IN ('mock', 'jev')", name="ck_emotion_analyses_source"),
        CheckConstraint(
            "length(color_code) = 7 AND substr(color_code, 1, 1) = '#'",
            name="ck_emotion_analyses_color_code",
        ),
        CheckConstraint(
            "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
            name="ck_emotion_analyses_confidence",
        ),
        CheckConstraint(
            "valence IS NULL OR (valence >= -1 AND valence <= 1)",
            name="ck_emotion_analyses_valence",
        ),
        CheckConstraint(
            "arousal IS NULL OR (arousal >= -1 AND arousal <= 1)",
            name="ck_emotion_analyses_arousal",
        ),
        CheckConstraint(
            "joy IS NULL OR (joy >= 0 AND joy <= 1)", name="ck_emotion_analyses_joy"
        ),
        CheckConstraint(
            "trust IS NULL OR (trust >= 0 AND trust <= 1)", name="ck_emotion_analyses_trust"
        ),
        CheckConstraint(
            "fear IS NULL OR (fear >= 0 AND fear <= 1)", name="ck_emotion_analyses_fear"
        ),
        CheckConstraint(
            "surprise IS NULL OR (surprise >= 0 AND surprise <= 1)",
            name="ck_emotion_analyses_surprise",
        ),
        CheckConstraint(
            "sadness IS NULL OR (sadness >= 0 AND sadness <= 1)",
            name="ck_emotion_analyses_sadness",
        ),
        CheckConstraint(
            "disgust IS NULL OR (disgust >= 0 AND disgust <= 1)",
            name="ck_emotion_analyses_disgust",
        ),
        CheckConstraint(
            "anger IS NULL OR (anger >= 0 AND anger <= 1)", name="ck_emotion_analyses_anger"
        ),
        CheckConstraint(
            "anticipation IS NULL OR (anticipation >= 0 AND anticipation <= 1)",
            name="ck_emotion_analyses_anticipation",
        ),
        CheckConstraint(
            "projection_x IS NULL OR (projection_x >= -1 AND projection_x <= 1)",
            name="ck_emotion_analyses_projection_x",
        ),
        CheckConstraint(
            "projection_y IS NULL OR (projection_y >= -1 AND projection_y <= 1)",
            name="ck_emotion_analyses_projection_y",
        ),
        CheckConstraint(
            "coherence IS NULL OR (coherence >= 0 AND coherence <= 1)",
            name="ck_emotion_analyses_coherence",
        ),
        CheckConstraint(
            "intensity IS NULL OR (intensity >= 0 AND intensity <= 1)",
            name="ck_emotion_analyses_intensity",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    review_id: Mapped[int] = mapped_column(
        ForeignKey("page_reviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    review_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    emotion_label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    color_code: Mapped[str] = mapped_column(String(7), nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float)
    model_version: Mapped[str | None] = mapped_column(String(128))
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    valence: Mapped[float | None] = mapped_column(Float)
    arousal: Mapped[float | None] = mapped_column(Float)
    palette_version: Mapped[str | None] = mapped_column(String(32))
    joy: Mapped[float | None] = mapped_column(Float)
    trust: Mapped[float | None] = mapped_column(Float)
    fear: Mapped[float | None] = mapped_column(Float)
    surprise: Mapped[float | None] = mapped_column(Float)
    sadness: Mapped[float | None] = mapped_column(Float)
    disgust: Mapped[float | None] = mapped_column(Float)
    anger: Mapped[float | None] = mapped_column(Float)
    anticipation: Mapped[float | None] = mapped_column(Float)
    projection_x: Mapped[float | None] = mapped_column(Float)
    projection_y: Mapped[float | None] = mapped_column(Float)
    coherence: Mapped[float | None] = mapped_column(Float)
    intensity: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )