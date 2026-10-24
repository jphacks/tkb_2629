from dataclasses import dataclass
from typing import Literal, Protocol


@dataclass(frozen=True)
class EmotionResult:
    emotion_label: str
    color_code: str
    confidence: float | None
    model_version: str | None
    source: Literal["mock", "jev"]


class EmotionAnalyzer(Protocol):
    def analyze(self, review_text: str) -> EmotionResult: ...


class MockEmotionAnalyzer:
    def analyze(self, review_text: str) -> EmotionResult:
        return EmotionResult(
            emotion_label="mock_neutral",
            color_code="#808080",
            confidence=None,
            model_version="mock-v1",
            source="mock",
        )