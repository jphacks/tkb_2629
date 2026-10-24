from __future__ import annotations

import colorsys
import math
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Literal, Protocol

from typesafe_sdk import Score, TypeSafeClient

AFFECT_COLOR_VERSION = "va-hsl-v1"
EMOTION_VECTOR_COLOR_VERSION = "emotion-wheel-mix-v1"
BASIC_EMOTION_NAMES = {
    "joy": "喜び",
    "trust": "信頼",
    "fear": "恐れ",
    "surprise": "驚き",
    "sadness": "悲しみ",
    "disgust": "嫌悪",
    "anger": "怒り",
    "anticipation": "期待",
}
BASIC_EMOTION_HUES = {
    "anger": 0.0,
    "anticipation": 30.0,
    "joy": 60.0,
    "trust": 120.0,
    "fear": 180.0,
    "surprise": 240.0,
    "sadness": 270.0,
    "disgust": 300.0,
}
EMOTION_INTENSITY_LEVELS = (
    "Not expressed",
    "Very mildly expressed",
    "Mildly expressed",
    "Moderately expressed",
    "Strongly expressed",
)


@dataclass(frozen=True)
class AffectScores:
    valence: float
    arousal: float

    def __post_init__(self) -> None:
        for name, value in (("valence", self.valence), ("arousal", self.arousal)):
            if not math.isfinite(value) or not -1.0 <= value <= 1.0:
                raise ValueError(f"{name} must be a finite number between -1 and 1")


class ScoreAnswer(Protocol):
    score: float
    confidence: float


class JevResponse(Protocol):
    model: str
    scores: Mapping[str, ScoreAnswer]


class JevClient(Protocol):
    def __enter__(self) -> JevClient: ...

    def __exit__(self, *args: object) -> None: ...

    def system_one(
        self, *, state: str, questions: Mapping[str, Score]
    ) -> JevResponse: ...


ClientFactory = Callable[..., JevClient]


@dataclass(frozen=True)
class EmotionVector:
    joy: float
    trust: float
    fear: float
    surprise: float
    sadness: float
    disgust: float
    anger: float
    anticipation: float

    def __post_init__(self) -> None:
        for emotion, value in self.as_dict().items():
            if not math.isfinite(value) or not 0.0 <= value <= 1.0:
                raise ValueError(f"{emotion} must be a finite number between 0 and 1")

    def as_dict(self) -> dict[str, float]:
        return {
            "joy": self.joy,
            "trust": self.trust,
            "fear": self.fear,
            "surprise": self.surprise,
            "sadness": self.sadness,
            "disgust": self.disgust,
            "anger": self.anger,
            "anticipation": self.anticipation,
        }


def emotion_vector_to_color_code(vector: EmotionVector) -> str:
    """Blend eight emotion hues by intensity; opposing hues reduce saturation."""
    scores = vector.as_dict()
    red_axis = sum(
        scores[emotion] * math.cos(math.radians(hue))
        for emotion, hue in BASIC_EMOTION_HUES.items()
    )
    green_axis = sum(
        scores[emotion] * math.sin(math.radians(hue))
        for emotion, hue in BASIC_EMOTION_HUES.items()
    )
    magnitude = math.hypot(red_axis, green_axis)
    if magnitude < 1e-12:
        return "#8C8C8C"

    hue = (math.degrees(math.atan2(green_axis, red_axis)) % 360) / 360
    saturation = min(magnitude, 1.0)
    red, green, blue = colorsys.hls_to_rgb(hue, 0.55, saturation)
    channels = (round(red * 255), round(green * 255), round(blue * 255))
    return "#" + "".join(f"{channel:02X}" for channel in channels)


def affect_to_color_code(scores: AffectScores) -> str:
    """Map continuous valence/arousal coordinates to a deterministic HSL wheel color."""
    magnitude = math.hypot(scores.valence, scores.arousal) / math.sqrt(2)
    if magnitude == 0:
        return "#8C8C8C"

    angle = math.degrees(math.atan2(scores.arousal, scores.valence))
    hue = ((120 - angle) % 360) / 360
    saturation = min(magnitude, 1.0)
    red, green, blue = colorsys.hls_to_rgb(hue, 0.55, saturation)
    channels = (round(red * 255), round(green * 255), round(blue * 255))
    return "#" + "".join(f"{channel:02X}" for channel in channels)


@dataclass(frozen=True)
class EmotionResult:
    emotion_label: str | None
    color_code: str
    confidence: float | None
    model_version: str | None
    source: Literal["mock", "jev"]
    valence: float | None = None
    arousal: float | None = None
    palette_version: str | None = None
    emotion_vector: EmotionVector | None = None


class EmotionAnalyzer(Protocol):
    def analyze(self, review_text: str) -> EmotionResult: ...


class JevEmotionAnalyzer:
    def __init__(self, client_factory: ClientFactory = TypeSafeClient) -> None:
        self._client_factory = client_factory

    def analyze(self, review_text: str) -> EmotionResult:
        questions = {
            emotion: Score(
                instructions=f"感想文から「{emotion_name}」の感情がどのくらい強く表れていますか？他の感情とは独立して評価してください。",
                criteria=EMOTION_INTENSITY_LEVELS,
            )
            for emotion, emotion_name in BASIC_EMOTION_NAMES.items()
        }
        with self._client_factory(model="jev-latest") as client:
            response = client.system_one(state=review_text, questions=questions)

        values = {
            emotion: self._normalize_score(
                response.scores[emotion].score, EMOTION_INTENSITY_LEVELS
            )
            for emotion in BASIC_EMOTION_NAMES
        }
        vector = EmotionVector(**values)
        confidence = min(
            response.scores[emotion].confidence for emotion in BASIC_EMOTION_NAMES
        )
        return EmotionResult(
            emotion_label=None,
            color_code=emotion_vector_to_color_code(vector),
            confidence=confidence,
            model_version=response.model,
            source="jev",
            palette_version=EMOTION_VECTOR_COLOR_VERSION,
            emotion_vector=vector,
        )

    @staticmethod
    def _normalize_score(score: float, levels: tuple[str, ...]) -> float:
        maximum = len(levels) - 1
        if not math.isfinite(score) or not 0 <= score <= maximum:
            raise ValueError(f"Jev score must be between 0 and {maximum}")
        return score / maximum


class MockEmotionAnalyzer:
    def analyze(self, review_text: str) -> EmotionResult:
        vector = EmotionVector(
            joy=0,
            trust=0,
            fear=0,
            surprise=0,
            sadness=0,
            disgust=0,
            anger=0,
            anticipation=0,
        )
        return EmotionResult(
            emotion_label="mock_neutral",
            color_code=emotion_vector_to_color_code(vector),
            confidence=None,
            model_version="mock-v1",
            source="mock",
            palette_version=EMOTION_VECTOR_COLOR_VERSION,
            emotion_vector=vector,
        )