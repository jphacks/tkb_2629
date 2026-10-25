from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response

from backend.shared.presentation.auth import get_current_user_id

from ..application.results import ReviewView
from ..application.service import ReviewService
from .dependencies import get_review_service
from .schemas import (
    BookEmotionResponse,
    PagePopularityPoint,
    PagePopularityResponse,
    PageReviewResponse,
    ReviewSave,
)

router = APIRouter(tags=["reviews"])
ReviewServiceDependency = Annotated[ReviewService, Depends(get_review_service)]
CurrentUserId = Annotated[int, Depends(get_current_user_id)]
PageNumber = Annotated[int, Path(ge=1)]


@router.get(
    "/books/{book_id}/page-popularity",
    response_model=PagePopularityResponse,
)
def get_page_popularity(
    book_id: int,
    service: ReviewServiceDependency,
    user_id: CurrentUserId,
) -> PagePopularityResponse:
    items = service.page_popularity(user_id, book_id)
    return PagePopularityResponse(
        items=[PagePopularityPoint.model_validate(item) for item in items]
    )


@router.get("/books/{book_id}/reviews", response_model=list[PageReviewResponse])
def list_reviews(
    book_id: int,
    service: ReviewServiceDependency,
    user_id: CurrentUserId,
    iteration: int | None = Query(default=None, ge=1),
    limit: int = Query(default=100, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[ReviewView]:
    return service.list(user_id, book_id, iteration, limit, offset)


@router.get("/books/{book_id}/emotions", response_model=BookEmotionResponse)
def get_book_emotions(
    book_id: int,
    service: ReviewServiceDependency,
    user_id: CurrentUserId,
) -> BookEmotionResponse:
    return BookEmotionResponse.model_validate(service.average_emotions(user_id, book_id))


@router.get("/books/{book_id}/pages/{page_number}/review", response_model=PageReviewResponse)
def get_review(
    book_id: int,
    page_number: PageNumber,
    service: ReviewServiceDependency,
    user_id: CurrentUserId,
    iteration: int | None = Query(default=None, ge=1),
) -> ReviewView:
    return service.get(user_id, book_id, page_number, iteration)


@router.put("/books/{book_id}/pages/{page_number}/review", response_model=PageReviewResponse)
def save_review(
    book_id: int,
    page_number: PageNumber,
    request: ReviewSave,
    response: Response,
    service: ReviewServiceDependency,
    user_id: CurrentUserId,
    iteration: int | None = Query(default=None, ge=1),
) -> ReviewView:
    result = service.save(user_id, book_id, page_number, request.review_text, iteration)
    if result.created:
        response.status_code = 201
    else:
        response.status_code = 200
    return result.review
