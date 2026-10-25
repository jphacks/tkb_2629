from __future__ import annotations

from collections.abc import Callable, Sequence
from types import TracebackType
from typing import Protocol, Self

from ..domain.emotions import EmotionResult, EmotionVector
from ..domain.entities import AnalysisRecord

AnalysisKey = tuple[int, int]


class EmotionAnalyzer(Protocol):
    def analyze(self, review_text: str) -> EmotionResult: ...


class AnalysisRepository(Protocol):
    def get_many(self, references: Sequence[AnalysisKey]) -> list[AnalysisRecord]: ...
    def add(self, analysis: AnalysisRecord) -> None: ...
    def average(self, references: Sequence[AnalysisKey]) -> tuple[EmotionVector | None, int]: ...


class AnalysisUnitOfWork(Protocol):
    @property
    def analyses(self) -> AnalysisRepository: ...
    def __enter__(self) -> Self: ...
    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None: ...
    def commit(self) -> None: ...


UnitOfWorkFactory = Callable[[], AnalysisUnitOfWork]
