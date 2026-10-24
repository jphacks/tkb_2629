import logging
import os
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path, Query, Response, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .analysis import EmotionAnalyzer, JevEmotionAnalyzer, MockEmotionAnalyzer
from .auth import get_current_user_id
from .database import get_db
from .models import Book, EmotionAnalysis, PageReview, User, UserBook
from .schemas import (
    BookCreate,
    BookListResponse,
    BookResponse,
    EmotionAnalysisResponse,
    PageReviewResponse,
    ProgressUpdate,
    ReadingSummary,
    ReviewSave,
    UserCreate,
    UserResponse,
    UserUpdate,
)

logger = logging.getLogger(__name__)

app = FastAPI()
reading_api = APIRouter(prefix="/api/v1")

DbSession = Annotated[Session, Depends(get_db)]

@app.post("/users", response_model=UserResponse)
def create_user(
    request: UserCreate,
    db: DbSession,
):
    user = User(
        name=request.name,
        email=request.email,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user

@app.get("/users", response_model=list[UserResponse])
def get_users(db: DbSession):
    statement = select(User)

    users = db.scalars(statement).all()

    return users

@app.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: DbSession,
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return user

@app.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    request: UserUpdate,
    db: DbSession,
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    user.name = request.name
    user.email = request.email

    db.commit()
    db.refresh(user)

    return user

@app.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: DbSession,
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    db.delete(user)
    db.commit()


def get_emotion_analyzer() -> EmotionAnalyzer:
    if os.getenv("TYPESAFE_API_KEY"):
        return JevEmotionAnalyzer()
    return MockEmotionAnalyzer()


ReadingDb = Annotated[Session, Depends(get_db)]
CurrentUserId = Annotated[int, Depends(get_current_user_id)]
EmotionAnalyzerDep = Annotated[EmotionAnalyzer, Depends(get_emotion_analyzer)]


def _book_response(book: Book, reading: UserBook) -> BookResponse:
    return BookResponse(
        id=book.id,
        title=book.title,
        author=book.author,
        total_pages=book.total_pages,
        created_at=book.created_at,
        reading=ReadingSummary(
            user_book_id=reading.id,
            current_page=reading.current_page,
            status=reading.status,
            started_at=reading.started_at,
            completed_at=reading.completed_at,
        ),
    )


def _get_user_book(db: Session, user_id: int, book_id: int) -> tuple[Book, UserBook]:
    row = db.execute(
        select(Book, UserBook)
        .join(UserBook, UserBook.book_id == Book.id)
        .where(Book.id == book_id, UserBook.user_id == user_id)
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return row


def _get_user_page(
    db: Session, user_id: int, book_id: int, page_number: int
) -> tuple[Book, UserBook]:
    book, reading = _get_user_book(db, user_id, book_id)
    if page_number > book.total_pages:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="page_number must not exceed total_pages",
        )
    return book, reading


def _page_review_response(db: Session, review: PageReview, book_id: int) -> PageReviewResponse:
    analysis = None
    if review.analysis_status == "completed":
        analysis_row = db.scalar(
            select(EmotionAnalysis)
            .where(
                EmotionAnalysis.review_id == review.id,
                EmotionAnalysis.review_revision == review.analysis_revision,
            )
            .limit(1)
        )
        if analysis_row is not None:
            analysis = EmotionAnalysisResponse.model_validate(analysis_row)
            vector = {
                emotion: getattr(analysis_row, emotion)
                for emotion in (
                    "joy",
                    "trust",
                    "fear",
                    "surprise",
                    "sadness",
                    "disgust",
                    "anger",
                    "anticipation",
                )
            }
            if any(value is not None for value in vector.values()):
                analysis = analysis.model_copy(update={"emotion_vector": vector})
    return PageReviewResponse(
        id=review.id,
        book_id=book_id,
        page_number=review.page_number,
        review_text=review.review_text,
        analysis_status=review.analysis_status,
        analysis=analysis,
        created_at=review.created_at,
        updated_at=review.updated_at,
    )


def _revise_page_review(db: Session, review_id: int, review_text: str) -> int:
    revision = db.scalar(
        update(PageReview)
        .where(PageReview.id == review_id)
        .values(
            review_text=review_text,
            analysis_revision=PageReview.analysis_revision + 1,
            analysis_status="pending",
        )
        .returning(PageReview.analysis_revision)
    )
    if revision is None:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    db.commit()
    return revision


@reading_api.post("/books", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
def create_book(
    request: BookCreate,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[int, Depends(get_current_user_id)],
) -> BookResponse:
    if request.book_id is None:
        book = Book(title=request.title, author=request.author, total_pages=request.total_pages)
        db.add(book)
        db.flush()
    else:
        book = db.get(Book, request.book_id)
        if book is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
        if (book.title, book.author, book.total_pages) != (
            request.title,
            request.author,
            request.total_pages,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Book metadata does not match the existing book",
            )

    reading = UserBook(user_id=user_id, book_id=book.id)
    db.add(reading)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This book is already in the user's library",
        ) from error
    db.refresh(book)
    db.refresh(reading)
    return _book_response(book, reading)


@reading_api.get("/books", response_model=BookListResponse)
def list_books(
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[int, Depends(get_current_user_id)],
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> BookListResponse:
    rows = db.execute(
        select(Book, UserBook)
        .join(UserBook, UserBook.book_id == Book.id)
        .where(UserBook.user_id == user_id)
        .order_by(Book.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return BookListResponse(
        items=[_book_response(book, reading) for book, reading in rows],
        limit=limit,
        offset=offset,
    )


@reading_api.get("/books/{book_id}", response_model=BookResponse)
def get_book(
    book_id: int,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[int, Depends(get_current_user_id)],
) -> BookResponse:
    return _book_response(*_get_user_book(db, user_id, book_id))


@reading_api.patch("/books/{book_id}/progress", response_model=BookResponse)
def update_progress(
    book_id: int,
    request: ProgressUpdate,
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[int, Depends(get_current_user_id)],
) -> BookResponse:
    book, reading = _get_user_book(db, user_id, book_id)
    if request.current_page > book.total_pages:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="current_page must not exceed total_pages",
        )
    reading.current_page = request.current_page
    if request.current_page == book.total_pages:
        reading.status = "completed"
        reading.completed_at = reading.completed_at or datetime.now(UTC)
    else:
        reading.status = "reading"
        reading.completed_at = None
    db.commit()
    db.refresh(reading)
    return _book_response(book, reading)


@reading_api.get(
    "/books/{book_id}/pages/{page_number}/review", response_model=PageReviewResponse
)
def get_page_review(
    book_id: int,
    page_number: Annotated[int, Path(ge=1)],
    db: ReadingDb,
    user_id: CurrentUserId,
) -> PageReviewResponse:
    _, reading = _get_user_page(db, user_id, book_id, page_number)
    review = db.scalar(
        select(PageReview).where(
            PageReview.user_book_id == reading.id,
            PageReview.page_number == page_number,
        )
    )
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    return _page_review_response(db, review, book_id)


@reading_api.put(
    "/books/{book_id}/pages/{page_number}/review", response_model=PageReviewResponse
)
def save_page_review(
    book_id: int,
    request: ReviewSave,
    response: Response,
    page_number: Annotated[int, Path(ge=1)],
    db: ReadingDb,
    user_id: CurrentUserId,
    analyzer: EmotionAnalyzerDep,
) -> PageReviewResponse:
    _, reading = _get_user_page(db, user_id, book_id, page_number)
    review = db.scalar(
        select(PageReview).where(
            PageReview.user_book_id == reading.id,
            PageReview.page_number == page_number,
        )
    )
    created = review is None
    if created:
        review = PageReview(
            user_book_id=reading.id,
            page_number=page_number,
            review_text=request.review_text,
            analysis_status="pending",
        )
        db.add(review)
        try:
            db.commit()
        except IntegrityError as error:
            db.rollback()
            review = db.scalar(
                select(PageReview).where(
                    PageReview.user_book_id == reading.id,
                    PageReview.page_number == page_number,
                )
            )
            if review is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Could not save review",
                ) from error
            created = False
            review_id = review.id
            revision = _revise_page_review(db, review_id, request.review_text)
        else:
            db.refresh(review)
            review_id = review.id
            revision = review.analysis_revision
    else:
        review_id = review.id
        revision = _revise_page_review(db, review_id, request.review_text)
    try:
        result = analyzer.analyze(request.review_text)
        completed = db.execute(
            update(PageReview)
            .where(PageReview.id == review_id, PageReview.analysis_revision == revision)
            .values(analysis_status="completed")
        )
        if completed.rowcount == 1:
            db.add(
                EmotionAnalysis(
                    review_id=review_id,
                    review_revision=revision,
                    emotion_label=result.emotion_label,
                    color_code=result.color_code,
                    confidence=result.confidence,
                    model_version=result.model_version,
                    source=result.source,
                    valence=result.valence,
                    arousal=result.arousal,
                    palette_version=result.palette_version,
                    **(result.emotion_vector.as_dict() if result.emotion_vector else {}),
                )
            )
            db.commit()
        else:
            db.rollback()
    except Exception:
        db.rollback()
        logger.exception("Emotion analysis failed for review %s revision %s", review_id, revision)
        db.execute(
            update(PageReview)
            .where(PageReview.id == review_id, PageReview.analysis_revision == revision)
            .values(analysis_status="failed")
        )
        db.commit()

    review = db.get(PageReview, review_id, populate_existing=True)
    if review is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Review could not be loaded after analysis",
        )
    if created:
        response.status_code = status.HTTP_201_CREATED
    return _page_review_response(db, review, book_id)


app.include_router(reading_api)