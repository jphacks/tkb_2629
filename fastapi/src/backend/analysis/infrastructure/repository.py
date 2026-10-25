from __future__ import annotations

from collections.abc import Sequence
from typing import Literal, cast

from sqlalchemy import func, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..application.ports import AnalysisKey
from ..domain.emotions import (
    BASIC_EMOTION_NAMES,
    EmotionProjection,
    EmotionResult,
    EmotionVector,
    project_emotion_vector,
)
from ..domain.entities import AnalysisRecord
from .models import EmotionAnalysis


class SqlAnalysisRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_many(self, references: Sequence[AnalysisKey]) -> list[AnalysisRecord]:
        if not references:
            return []
        keys = list(dict.fromkeys(references))
        rows = []
        for offset in range(0, len(keys), 1000):
            rows.extend(
                self.db.scalars(
                    select(EmotionAnalysis).where(
                        tuple_(EmotionAnalysis.review_id, EmotionAnalysis.review_revision).in_(
                            keys[offset : offset + 1000]
                        )
                    )
                )
            )
        records = []
        for row in rows:
            vector = None
            if all(getattr(row, name) is not None for name in BASIC_EMOTION_NAMES):
                vector = EmotionVector(
                    **{name: getattr(row, name) / 100 for name in BASIC_EMOTION_NAMES}
                )
            projection = None
            if (
                row.projection_x is not None
                and row.projection_y is not None
                and row.coherence is not None
                and row.intensity is not None
            ):
                projection = EmotionProjection(
                    row.projection_x,
                    row.projection_y,
                    row.coherence,
                    row.intensity,
                    project_emotion_vector(vector).direction_degrees if vector else None,
                )
            result = EmotionResult(
                row.emotion_label,
                row.color_code,
                row.confidence,
                row.model_version,
                cast(Literal["mock", "jev"], row.source),
                row.valence,
                row.arousal,
                row.palette_version,
                vector,
                projection,
            )
            records.append(AnalysisRecord(row.review_id, row.review_revision, result))
        return records

    def add(self, analysis: AnalysisRecord) -> None:
        result = analysis.result
        values: dict[str, object] = dict(
            review_id=analysis.review_id,
            review_revision=analysis.revision,
            emotion_label=result.emotion_label,
            color_code=result.color_code,
            confidence=result.confidence,
            model_version=result.model_version,
            source=result.source,
            valence=result.valence,
            arousal=result.arousal,
            palette_version=result.palette_version,
        )
        if result.emotion_vector:
            values.update(result.emotion_vector.as_percentages())
        if result.emotion_projection:
            projection = result.emotion_projection
            values.update(
                projection_x=projection.x,
                projection_y=projection.y,
                coherence=projection.coherence,
                intensity=projection.intensity,
            )
        self.db.execute(
            insert(EmotionAnalysis)
            .values(**values)
            .on_conflict_do_nothing(
                index_elements=[EmotionAnalysis.review_id, EmotionAnalysis.review_revision]
            )
        )

    def average(self, references: Sequence[AnalysisKey]) -> tuple[EmotionVector | None, int]:
        if not references:
            return None, 0
        columns = [getattr(EmotionAnalysis, name) for name in BASIC_EMOTION_NAMES]
        keys = list(dict.fromkeys(references))
        count = 0
        totals = {name: 0.0 for name in BASIC_EMOTION_NAMES}
        for offset in range(0, len(keys), 1000):
            row = self.db.execute(
                select(
                    func.count(EmotionAnalysis.id), *(func.sum(column) for column in columns)
                ).where(
                    tuple_(EmotionAnalysis.review_id, EmotionAnalysis.review_revision).in_(
                        keys[offset : offset + 1000]
                    ),
                    EmotionAnalysis.source == "jev",
                    *(column.is_not(None) for column in columns),
                )
            ).one()
            count += row[0]
            for name, value in zip(BASIC_EMOTION_NAMES, row[1:], strict=True):
                totals[name] += float(value or 0)
        if not count:
            return None, 0
        return EmotionVector(**{name: value / count / 100 for name, value in totals.items()}), count
