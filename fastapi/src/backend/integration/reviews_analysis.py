from collections.abc import Sequence

from backend.analysis import public as analysis
from backend.reviews import public as reviews


class JevAnalysisGateway:
    """Translate the AI context's public DTOs into the review context's vocabulary."""

    def __init__(self, service: analysis.AnalysisAccess):
        self.service = service

    def analyze(self, review_id: int, revision: int, text: str) -> reviews.AnalysisPreview:
        try:
            result = self.service.analyze(review_id, revision, text)
        except Exception as error:
            # Text is already committed. Review use cases handle this port failure explicitly.
            raise reviews.AnalysisUnavailable("AI analysis failed") from error
        return reviews.AnalysisPreview(result.color_code, result.source)

    def previews(
        self, references: Sequence[tuple[int, int]]
    ) -> dict[tuple[int, int], reviews.AnalysisPreview]:
        try:
            results = self.service.previews(references)
        except Exception as error:
            raise reviews.ServiceUnavailable("Analysis results are unavailable") from error
        return {
            key: reviews.AnalysisPreview(value.color_code, value.source)
            for key, value in results.items()
        }

    def summarize(self, references: Sequence[tuple[int, int]]) -> reviews.EmotionSummary:
        try:
            result = self.service.summarize(references)
        except Exception as error:
            raise reviews.ServiceUnavailable("Analysis summary is unavailable") from error
        return reviews.EmotionSummary(
            result.review_count, dict(result.emotion_scores), result.color_code
        )
