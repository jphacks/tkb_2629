from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from .application.errors import ExternalServiceError, ServiceUnavailable
from .application.results import AnalysisPreview, EmotionSummary

__all__ = [
    "AnalysisAccess",
    "AnalysisPreview",
    "EmotionSummary",
    "ExternalServiceError",
    "ServiceUnavailable",
]


class AnalysisAccess(Protocol):
    def analyze(self, review_id: int, revision: int, text: str) -> AnalysisPreview: ...
    def previews(
        self, references: Sequence[tuple[int, int]]
    ) -> dict[tuple[int, int], AnalysisPreview]: ...
    def summarize(self, references: Sequence[tuple[int, int]]) -> EmotionSummary: ...
