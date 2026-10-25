from __future__ import annotations

from collections.abc import Sequence

from ..domain.emotions import emotion_vector_to_color_code
from ..domain.entities import AnalysisRecord, AnalysisRequest
from .ports import AnalysisKey, EmotionAnalyzer, UnitOfWorkFactory
from .results import AnalysisPreview, EmotionSummary


class AnalysisService:
    def __init__(self, units: UnitOfWorkFactory, analyzer: EmotionAnalyzer):
        self.units = units
        self.analyzer = analyzer

    def analyze(self, review_id: int, revision: int, text: str) -> AnalysisPreview:
        request = AnalysisRequest(review_id, revision, text)
        with self.units() as unit:
            existing = unit.analyses.get_many([(review_id, revision)])
        if not existing:
            # No database transaction or row lock is kept during the remote Jev call.
            result = self.analyzer.analyze(request.text)
            with self.units() as unit:
                unit.analyses.add(AnalysisRecord(request.review_id, request.revision, result))
                existing = unit.analyses.get_many([(review_id, revision)])
                unit.commit()
        result = existing[0].result
        return AnalysisPreview(result.color_code, result.source)

    def previews(self, references: Sequence[AnalysisKey]) -> dict[AnalysisKey, AnalysisPreview]:
        with self.units() as unit:
            records = unit.analyses.get_many(references)
        return {
            (item.review_id, item.revision): AnalysisPreview(
                item.result.color_code, item.result.source
            )
            for item in records
        }

    def summarize(self, references: Sequence[AnalysisKey]) -> EmotionSummary:
        with self.units() as unit:
            vector, count = unit.analyses.average(references)
        return EmotionSummary(
            count,
            vector.as_dict() if vector else {},
            emotion_vector_to_color_code(vector) if vector else "#8C8C8C",
        )
