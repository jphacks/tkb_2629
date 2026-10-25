from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AnalysisPreview:
    color_code: str
    source: str


@dataclass(frozen=True)
class EmotionSummary:
    review_count: int
    emotion_scores: dict[str, float]
    color_code: str
