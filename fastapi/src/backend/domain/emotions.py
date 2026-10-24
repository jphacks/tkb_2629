from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)

class EmotionResult:
    emotion_label: str
    color_code: str
    confidence: float | None
    model_version: str | None
    source: Literal["mock", "jev"]


class EmotionAnalyzer(ABC):
    @abstractmethod
    def analyze(self, review_text: str) -> EmotionResult:
        raise NotImplementedError
