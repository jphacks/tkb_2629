"""Bind library, reviews and AI through public-contract adapters at the application boundary."""

import os
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI
from redis import Redis
from sqlalchemy.orm import Session

from backend.analysis.application.service import AnalysisService
from backend.analysis.infrastructure.jev import JevEmotionAnalyzer, MockEmotionAnalyzer
from backend.analysis.infrastructure.unit_of_work import SqlAnalysisUnitOfWork
from backend.integration.reviews_analysis import JevAnalysisGateway
from backend.integration.reviews_library import LibraryReadingGateway
from backend.library.application.service import LibraryService
from backend.library.infrastructure.google_books import GoogleBooksCatalog
from backend.library.infrastructure.unit_of_work import SqlLibraryUnitOfWork
from backend.library.presentation.dependencies import get_library_service
from backend.reviews.application.service import ReviewService
from backend.reviews.infrastructure.unit_of_work import SqlReviewUnitOfWork
from backend.reviews.presentation.dependencies import get_review_service
from backend.shared import database
from backend.shared.clock import UtcClock


@lru_cache
def get_books_cache() -> Redis:
    return Redis.from_url(
        os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        socket_connect_timeout=1,
        socket_timeout=1,
        decode_responses=True,
    )


def build_book_catalog() -> GoogleBooksCatalog:
    return GoogleBooksCatalog(api_key=os.getenv("BOOKS_API"), cache=get_books_cache())


def build_library_service() -> LibraryService:
    return LibraryService(
        lambda: SqlLibraryUnitOfWork(database.SessionLocal), build_book_catalog(), UtcClock()
    )


def build_analysis_service() -> AnalysisService:
    analyzer = JevEmotionAnalyzer() if os.getenv("TYPESAFE_API_KEY") else MockEmotionAnalyzer()
    return AnalysisService(lambda: SqlAnalysisUnitOfWork(database.SessionLocal), analyzer)


def build_review_service(
    library: Annotated[LibraryService, Depends(get_library_service)],
    analysis: Annotated[AnalysisService, Depends(build_analysis_service)],
) -> ReviewService:
    def transactional_readings(db: Session) -> LibraryReadingGateway:
        # No context imports a sibling's ORM. Only this root composes a shared SQL transaction.
        borrowed_library = LibraryService(
            lambda: SqlLibraryUnitOfWork(lambda: db, borrowed=True), library.catalog, UtcClock()
        )
        return LibraryReadingGateway(borrowed_library)

    return ReviewService(
        lambda: SqlReviewUnitOfWork(database.SessionLocal, transactional_readings),
        LibraryReadingGateway(library),
        JevAnalysisGateway(analysis),
        UtcClock(),
    )


def configure_reading_contexts(app: FastAPI) -> None:
    app.dependency_overrides[get_library_service] = build_library_service
    app.dependency_overrides[get_review_service] = build_review_service
