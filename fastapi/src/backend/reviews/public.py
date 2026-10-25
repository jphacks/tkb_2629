"""Types used by boundary adapters; no producer's domain types leak into review use cases."""

from __future__ import annotations

from .application.errors import AnalysisUnavailable, ExternalServiceError, ServiceUnavailable
from .application.results import (
    AnalysisPreview,
    EmotionSummary,
    PublicReading,
    ReadingScope,
    RecommendationBook,
)
from .domain.errors import Conflict, InvalidInput, NotFound

__all__ = [
    "AnalysisUnavailable",
    "AnalysisPreview",
    "EmotionSummary",
    "ReadingScope",
    "PublicReading",
    "ExternalServiceError",
    "ServiceUnavailable",
    "Conflict",
    "InvalidInput",
    "NotFound",
    "RecommendationBook",
]
