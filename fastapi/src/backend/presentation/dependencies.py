import os
from collections.abc import Generator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, HTTPException
from redis import Redis
from sqlalchemy.orm import Session

from ..application.services import CatalogService, ReadingService, ReviewService, UserService
from ..domain.emotions import EmotionAnalyzer
from ..infrastructure import database
from ..infrastructure.emotions import JevEmotionAnalyzer, MockEmotionAnalyzer
from ..infrastructure.google_books import GoogleBooksCatalog
from ..infrastructure.repositories import (
    SqlReadingRepository,
    SqlReviewRepository,
    SqlUserRepository,
)


def get_db() -> Generator[Session, None, None]:
    if database.engine is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    session = database.SessionLocal()
    try:
        # FastAPI keeps the session alive until the request has finished.
        yield session
    finally:
        session.close()


DbSession = Annotated[Session, Depends(get_db)]


def get_emotion_analyzer() -> EmotionAnalyzer:
    if os.getenv("TYPESAFE_API_KEY"):
        return JevEmotionAnalyzer()
    return MockEmotionAnalyzer()


def get_users(db: DbSession) -> UserService:
    repository = SqlUserRepository(db)
    return UserService(users=repository)


@lru_cache
def get_books_cache() -> Redis:
    return Redis.from_url(
        os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        socket_connect_timeout=1,
        socket_timeout=1,
        decode_responses=True,
    )


def get_book_catalog() -> GoogleBooksCatalog:
    return GoogleBooksCatalog(cache=get_books_cache())


def get_catalog_service(
    catalog: Annotated[GoogleBooksCatalog, Depends(get_book_catalog)],
) -> CatalogService:
    return CatalogService(catalog)


def get_reading(
    db: DbSession,
    catalog: Annotated[GoogleBooksCatalog, Depends(get_book_catalog)],
) -> ReadingService:
    repository = SqlReadingRepository(db, catalog)
    return ReadingService(books=repository, catalog=catalog)


def get_reviews(
    db: DbSession,
    analyzer: Annotated[EmotionAnalyzer, Depends(get_emotion_analyzer)],
    catalog: Annotated[GoogleBooksCatalog, Depends(get_book_catalog)],
) -> ReviewService:
    books = SqlReadingRepository(db, catalog)
    reviews = SqlReviewRepository(db)
    return ReviewService(books=books, reviews=reviews, analyzer=analyzer)
