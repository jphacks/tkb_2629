from ..domain.emotions import EmotionAnalyzer, EmotionResult


class MockEmotionAnalyzer(EmotionAnalyzer):
    def analyze(self, review_text: str) -> EmotionResult:
        return EmotionResult(
            emotion_label="mock_neutral",
            color_code="#808080",
            confidence=None,
            model_version="mock-v1",
            source="mock",
        )
