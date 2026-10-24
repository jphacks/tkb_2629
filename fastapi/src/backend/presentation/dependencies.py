import os
from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from ..application.services import ReadingService, ReviewService, UserService
from ..domain.emotions import EmotionAnalyzer
from ..infrastructure import database
from ..infrastructure.emotions import JevEmotionAnalyzer, MockEmotionAnalyzer
from ..infrastructure.repositories import SqlReadingRepository, SqlReviewRepository, SqlUserRepository


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


def get_reading(db: DbSession) -> ReadingService:
    repository = SqlReadingRepository(db)
    return ReadingService(books=repository)


def get_reviews(
    db: DbSession,
    analyzer: Annotated[EmotionAnalyzer, Depends(get_emotion_analyzer)],
) -> ReviewService:
    books = SqlReadingRepository(db)
    reviews = SqlReviewRepository(db)
    return ReviewService(books=books, reviews=reviews, analyzer=analyzer)
