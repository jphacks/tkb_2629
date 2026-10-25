from __future__ import annotations

import colorsys
import math
from dataclasses import dataclass
from typing import Literal

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
    "fear": 180.0,
    "trust": 90.0,
    "joy": 60.0,
    "anticipation": 30.0,
    "anger": 0.0,
    "disgust": 300.0,
    "sadness": 270.0,
    "surprise": 210.0,
}
EMOTION_VECTOR_ANGLES = {
    "fear": 0.0,
    "trust": 45.0,
    "joy": 90.0,
    "anticipation": 135.0,
    "anger": 180.0,
    "disgust": 225.0,
    "sadness": 270.0,
    "surprise": 315.0,
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

    def as_percentages(self) -> dict[str, int]:
        """Return independent 0–100 scores, rounding halves upward."""
        return {name: math.floor(value * 100 + 0.5) for name, value in self.as_dict().items()}


def emotion_vector_to_color_code(vector: EmotionVector) -> str:
    """Project an emotion vector to 2D, then map its direction and intensity to HSV."""
    projection = project_emotion_vector(vector)
    if projection.intensity == 0:
        return "#8C8C8C"

    hue = (
        emotion_direction_to_hue(projection.direction_degrees)
        if projection.direction_degrees is not None
        else 0.0
    )
    saturation = projection.coherence
    value = 0.55 + 0.35 * projection.intensity
    red, green, blue = colorsys.hsv_to_rgb(hue / 360, saturation, value)
    channels = (round(red * 255), round(green * 255), round(blue * 255))
    return "#" + "".join(f"{channel:02X}" for channel in channels)


@dataclass(frozen=True)
class EmotionProjection:
    x: float
    y: float
    coherence: float
    intensity: float
    direction_degrees: float | None

    def as_dict(self) -> dict[str, float]:
        return {
            "x": self.x,
            "y": self.y,
            "coherence": self.coherence,
            "intensity": self.intensity,
        }


def project_emotion_vector(vector: EmotionVector) -> EmotionProjection:
    scores = vector.as_dict()
    total = sum(scores.values())
    intensity = max(scores.values())
    if total == 0:
        return EmotionProjection(x=0, y=0, coherence=0, intensity=0, direction_degrees=None)

    x = (
        sum(
            scores[emotion] * math.cos(math.radians(angle))
            for emotion, angle in EMOTION_VECTOR_ANGLES.items()
        )
        / total
    )
    y = (
        sum(
            scores[emotion] * math.sin(math.radians(angle))
            for emotion, angle in EMOTION_VECTOR_ANGLES.items()
        )
        / total
    )
    magnitude = math.hypot(x, y)
    coherence = 0.0 if magnitude <= 1e-12 else min(magnitude, 1.0)
    direction = math.degrees(math.atan2(y, x)) % 360 if coherence > 1e-12 else None
    return EmotionProjection(
        x=x,
        y=y,
        coherence=coherence,
        intensity=intensity,
        direction_degrees=direction,
    )


def emotion_direction_to_hue(direction_degrees: float) -> float:
    if not math.isfinite(direction_degrees):
        raise ValueError("direction_degrees must be finite")
    direction = direction_degrees % 360
    anchors = sorted(EMOTION_VECTOR_ANGLES.items(), key=lambda item: item[1])
    for index, (emotion, start_angle) in enumerate(anchors):
        next_emotion, next_angle = anchors[(index + 1) % len(anchors)]
        end_angle = next_angle if index + 1 < len(anchors) else 360.0
        if start_angle <= direction <= end_angle:
            fraction = (direction - start_angle) / (end_angle - start_angle)
            start_hue = BASIC_EMOTION_HUES[emotion]
            end_hue = BASIC_EMOTION_HUES[next_emotion]
            hue_delta = (end_hue - start_hue + 180) % 360 - 180
            return (start_hue + fraction * hue_delta) % 360
    raise ValueError("Unable to map direction to a hue")


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
    emotion_projection: EmotionProjection | None = None

    @classmethod
    def from_vector(
        cls,
        vector: EmotionVector,
        *,
        source: Literal["mock", "jev"],
        confidence: float | None,
        model_version: str | None,
        emotion_label: str | None = None,
    ) -> EmotionResult:
        """Build a consistent analysis result from the eight emotion scores."""
        return cls(
            emotion_label=emotion_label,
            color_code=emotion_vector_to_color_code(vector),
            confidence=confidence,
            model_version=model_version,
            source=source,
            palette_version=EMOTION_VECTOR_COLOR_VERSION,
            emotion_vector=vector,
            emotion_projection=project_emotion_vector(vector),
        )
