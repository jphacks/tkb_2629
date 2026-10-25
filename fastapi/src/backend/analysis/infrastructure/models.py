from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from backend.shared.database import Base


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
        CheckConstraint("joy IS NULL OR (joy >= 0 AND joy <= 100)", name="ck_emotion_analyses_joy"),
        CheckConstraint(
            "trust IS NULL OR (trust >= 0 AND trust <= 100)", name="ck_emotion_analyses_trust"
        ),
        CheckConstraint(
            "fear IS NULL OR (fear >= 0 AND fear <= 100)", name="ck_emotion_analyses_fear"
        ),
        CheckConstraint(
            "surprise IS NULL OR (surprise >= 0 AND surprise <= 100)",
            name="ck_emotion_analyses_surprise",
        ),
        CheckConstraint(
            "sadness IS NULL OR (sadness >= 0 AND sadness <= 100)",
            name="ck_emotion_analyses_sadness",
        ),
        CheckConstraint(
            "disgust IS NULL OR (disgust >= 0 AND disgust <= 100)",
            name="ck_emotion_analyses_disgust",
        ),
        CheckConstraint(
            "anger IS NULL OR (anger >= 0 AND anger <= 100)", name="ck_emotion_analyses_anger"
        ),
        CheckConstraint(
            "anticipation IS NULL OR (anticipation >= 0 AND anticipation <= 100)",
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
    joy: Mapped[int | None] = mapped_column(Integer)
    trust: Mapped[int | None] = mapped_column(Integer)
    fear: Mapped[int | None] = mapped_column(Integer)
    surprise: Mapped[int | None] = mapped_column(Integer)
    sadness: Mapped[int | None] = mapped_column(Integer)
    disgust: Mapped[int | None] = mapped_column(Integer)
    anger: Mapped[int | None] = mapped_column(Integer)
    anticipation: Mapped[int | None] = mapped_column(Integer)
    projection_x: Mapped[float | None] = mapped_column(Float)
    projection_y: Mapped[float | None] = mapped_column(Float)
    coherence: Mapped[float | None] = mapped_column(Float)
    intensity: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
