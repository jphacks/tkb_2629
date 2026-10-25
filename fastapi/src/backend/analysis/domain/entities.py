from __future__ import annotations

from dataclasses import dataclass

from .emotions import EmotionResult
from .errors import InvalidInput


@dataclass(frozen=True)
class AnalysisRequest:
    review_id: int
    revision: int
    text: str

    def __post_init__(self) -> None:
        if self.review_id < 1 or self.revision < 1 or not self.text.strip():
            raise InvalidInput("Analysis requires a saved text and a positive revision")


@dataclass(frozen=True)
class AnalysisRecord:
    review_id: int
    revision: int
    result: EmotionResult
