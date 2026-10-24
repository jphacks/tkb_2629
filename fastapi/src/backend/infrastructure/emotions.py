from __future__ import annotations

import math
from collections.abc import Callable, Mapping
from typing import Protocol

from typesafe_sdk import Score, TypeSafeClient

from ..domain.emotions import (
    BASIC_EMOTION_NAMES, EMOTION_INTENSITY_LEVELS, EMOTION_VECTOR_COLOR_VERSION,
    EmotionAnalyzer, EmotionResult, EmotionVector,
    emotion_vector_to_color_code, project_emotion_vector,
)

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


class JevEmotionAnalyzer(EmotionAnalyzer):
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
        projection = project_emotion_vector(vector)
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
            emotion_projection=projection,
        )

    @staticmethod
    def _normalize_score(score: float, levels: tuple[str, ...]) -> float:
        maximum = len(levels) - 1
        if not math.isfinite(score) or not 0 <= score <= maximum:
            raise ValueError(f"Jev score must be between 0 and {maximum}")
        return score / maximum


class MockEmotionAnalyzer(EmotionAnalyzer):
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
        projection = project_emotion_vector(vector)
        return EmotionResult(
            emotion_label="mock_neutral",
            color_code=emotion_vector_to_color_code(vector),
            confidence=None,
            model_version="mock-v1",
            source="mock",
            palette_version=EMOTION_VECTOR_COLOR_VERSION,
            emotion_vector=vector,
            emotion_projection=projection,
        )
