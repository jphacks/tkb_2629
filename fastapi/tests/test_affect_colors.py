from __future__ import annotations

import pytest

from backend.analysis import (
    BASIC_EMOTION_NAMES,
    EMOTION_INTENSITY_LEVELS,
    AffectScores,
    EmotionVector,
    JevEmotionAnalyzer,
    affect_to_color_code,
    emotion_vector_to_color_code,
)


def test_neutral_affect_maps_to_neutral_gray() -> None:
    assert affect_to_color_code(AffectScores(valence=0, arousal=0)) == "#8C8C8C"


def test_continuous_affect_maps_to_multiple_color_wheel_hues() -> None:
    colors = {
        affect_to_color_code(AffectScores(valence=valence, arousal=arousal))
        for valence, arousal in ((1, 0), (0, 1), (-1, 1), (-1, -1), (1, -1))
    }

    assert len(colors) == 5
    assert all(len(color) == 7 and color.startswith("#") for color in colors)


def test_emotion_vector_maps_to_weighted_color() -> None:
    anger = EmotionVector(
        joy=0,
        trust=0,
        fear=0,
        surprise=0,
        sadness=0,
        disgust=0,
        anger=1,
        anticipation=0,
    )
    joy_and_anger = EmotionVector(
        joy=1, trust=0, fear=0, surprise=0, sadness=0, disgust=0, anger=1, anticipation=0
    )

    assert emotion_vector_to_color_code(anger) == "#FF1A1A"
    assert emotion_vector_to_color_code(joy_and_anger) == "#FF8C1A"


def test_opposing_emotions_blend_to_neutral_gray() -> None:
    mixed = EmotionVector(
        joy=0, trust=0, fear=1, surprise=0, sadness=0, disgust=0, anger=1, anticipation=0
    )

    assert emotion_vector_to_color_code(mixed) == "#8C8C8C"


def test_emotion_vector_rejects_scores_outside_zero_to_one() -> None:
    with pytest.raises(ValueError, match="anger.*between 0 and 1"):
        EmotionVector(
            joy=0,
            trust=0,
            fear=0,
            surprise=0,
            sadness=0,
            disgust=0,
            anger=1.1,
            anticipation=0,
        )


@pytest.mark.parametrize(
    ("valence", "arousal"),
    ((-1.01, 0), (1.01, 0), (0, -1.01), (0, 1.01), (float("nan"), 0), (0, float("inf"))),
)
def test_affect_scores_reject_non_finite_or_out_of_range_values(
    valence: float, arousal: float
) -> None:
    with pytest.raises(ValueError):
        AffectScores(valence=valence, arousal=arousal)


class FakeScoreAnswer:
    def __init__(self, score: float, confidence: float) -> None:
        self.score = score
        self.confidence = confidence


class FakeJevResponse:
    model = "jev-test-model"

    def __init__(self, scores: dict[str, float]) -> None:
        self.scores = {
            emotion: FakeScoreAnswer(score, 0.7 if emotion == "anger" else 0.9)
            for emotion, score in scores.items()
        }


class FakeJevClient:
    def __init__(self, model: str, response: FakeJevResponse) -> None:
        self.model = model
        self.response = response
        self.closed = False

    def __enter__(self) -> FakeJevClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.closed = True

    def system_one(self, *, state: str, questions: dict) -> FakeJevResponse:
        self.state = state
        self.questions = questions
        return self.response


def test_jev_adapter_normalizes_scores_and_maps_color() -> None:
    scores = {emotion: 0 for emotion in BASIC_EMOTION_NAMES}
    scores.update(joy=4, anger=2)
    client = FakeJevClient("jev-latest", FakeJevResponse(scores))
    analyzer = JevEmotionAnalyzer(client_factory=lambda **kwargs: client)

    result = analyzer.analyze("I loved this passage.")

    assert client.model == "jev-latest"
    assert client.state == "I loved this passage."
    assert set(client.questions) == set(BASIC_EMOTION_NAMES)
    assert all(
        question.criteria == EMOTION_INTENSITY_LEVELS for question in client.questions.values()
    )
    assert result.emotion_vector == EmotionVector(
        joy=1, trust=0, fear=0, surprise=0, sadness=0, disgust=0, anger=0.5, anticipation=0
    )
    assert result.confidence == 0.7
    assert result.model_version == "jev-test-model"
    assert result.source == "jev"
    assert result.emotion_label is None
    assert result.color_code == emotion_vector_to_color_code(result.emotion_vector)
    assert client.closed


def test_jev_adapter_rejects_scores_outside_its_rubric() -> None:
    scores = {emotion: 2 for emotion in BASIC_EMOTION_NAMES}
    scores["joy"] = 4.1
    analyzer = JevEmotionAnalyzer(
        client_factory=lambda **kwargs: FakeJevClient(
            "jev-latest", FakeJevResponse(scores)
        )
    )

    with pytest.raises(ValueError, match="between 0 and 4"):
        analyzer.analyze("A test review.")