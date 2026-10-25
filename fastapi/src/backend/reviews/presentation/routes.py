from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response

from backend.shared.presentation.auth import get_current_user_id

from ..application.public_reviews import PublicReviewService
from ..application.results import ReviewView
from ..application.service import ReviewService
from .dependencies import get_public_review_service, get_review_service
from .schemas import (
    BookEmotionResponse,
    EmotionComparisonResponse,
    PagePopularityPoint,
    PagePopularityResponse,
    PageReviewResponse,
    PublicReviewDistributionPoint,
    PublicReviewDistributionResponse,
    PublicReviewResponse,
    PublicReviewsResponse,
    ReactionResponse,
    ReactionUpdate,
    RecommendationsResponse,
    ReviewSave,
    ReviewSpoilersUpdate,
    ReviewVisibilityUpdate,
)

router = APIRouter(tags=["reviews"])
ReviewServiceDependency = Annotated[ReviewService, Depends(get_review_service)]
CurrentUserId = Annotated[int, Depends(get_current_user_id)]
PageNumber = Annotated[int, Path(ge=1)]
GoogleBooksId = Annotated[str, Path(min_length=1, max_length=256, pattern=r"^\S+$")]
ReviewId = Annotated[int, Path(ge=1)]
PublicService = Annotated[PublicReviewService, Depends(get_public_review_service)]


@router.get("/catalog/books/recommendations", response_model=RecommendationsResponse)
def recommend_books(
    service: ReviewServiceDependency,
    user_id: CurrentUserId,
    response: Response,
    limit: int = Query(default=5, ge=1, le=20),
) -> RecommendationsResponse:
    response.headers["Cache-Control"] = "no-store"
    return RecommendationsResponse.model_validate(service.recommendations(user_id, limit))


@router.get(
    "/catalog/books/{google_books_id}/reviews/{review_id}/reactions",
    response_model=ReactionResponse,
)
def get_reactions(
    google_books_id: GoogleBooksId,
    review_id: ReviewId,
    service: PublicService,
    user_id: CurrentUserId,
    response: Response,
) -> ReactionResponse:
    response.headers["Cache-Control"] = "no-store"
    return ReactionResponse.model_validate(
        service.reaction_summary(google_books_id, review_id, user_id)
    )


@router.put(
    "/catalog/books/{google_books_id}/reviews/{review_id}/reaction",
    response_model=ReactionResponse,
)
def put_reaction(
    google_books_id: GoogleBooksId,
    review_id: ReviewId,
    request: ReactionUpdate,
    service: PublicService,
    user_id: CurrentUserId,
    response: Response,
) -> ReactionResponse:
    response.headers["Cache-Control"] = "no-store"
    return ReactionResponse.model_validate(
        service.react(google_books_id, review_id, user_id, request.kind)
    )


@router.delete(
    "/catalog/books/{google_books_id}/reviews/{review_id}/reaction",
    response_model=ReactionResponse,
)
def delete_reaction(
    google_books_id: GoogleBooksId,
    review_id: ReviewId,
    service: PublicService,
    user_id: CurrentUserId,
    response: Response,
) -> ReactionResponse:
    response.headers["Cache-Control"] = "no-store"
    return ReactionResponse.model_validate(service.react(google_books_id, review_id, user_id, None))


@router.get(
    "/catalog/books/{google_books_id}/reviews",
    response_model=PublicReviewsResponse,
)
def list_public_reviews(
    google_books_id: Annotated[str, Path(min_length=1, max_length=256, pattern=r"^\S+$")],
    service: Annotated[PublicReviewService, Depends(get_public_review_service)],
    user_id: CurrentUserId,
    response: Response,
    exclude_mine: bool = Query(default=False),
    page: int | None = Query(default=None, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    page_start: int | None = Query(default=None, ge=1),
    page_end: int | None = Query(default=None, ge=1),
) -> PublicReviewsResponse:
    response.headers["Cache-Control"] = "no-store"
    items = service.list(
        google_books_id,
        page,
        limit,
        offset,
        page_start=page_start,
        page_end=page_end,
        exclude_user_id=user_id if exclude_mine else None,
    )
    return PublicReviewsResponse(
        items=[PublicReviewResponse.model_validate(item) for item in items],
        limit=limit,
        offset=offset,
    )


@router.get(
    "/catalog/books/{google_books_id}/reviews/distribution",
    response_model=PublicReviewDistributionResponse,
)
def public_review_distribution(
    google_books_id: Annotated[str, Path(min_length=1, max_length=256, pattern=r"^\S+$")],
    service: Annotated[PublicReviewService, Depends(get_public_review_service)],
    user_id: CurrentUserId,
    response: Response,
    exclude_mine: bool = Query(default=False),
) -> PublicReviewDistributionResponse:
    response.headers["Cache-Control"] = "no-store"
    items = service.distribution(google_books_id, exclude_user_id=user_id if exclude_mine else None)
    return PublicReviewDistributionResponse(
        items=[PublicReviewDistributionPoint.model_validate(item) for item in items],
        total_count=sum(item.review_count for item in items),
    )


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


@router.get("/books/{book_id}/emotions/comparison", response_model=EmotionComparisonResponse)
def compare_book_emotions(
    book_id: int,
    service: ReviewServiceDependency,
    user_id: CurrentUserId,
    response: Response,
) -> EmotionComparisonResponse:
    response.headers["Cache-Control"] = "no-store"
    return EmotionComparisonResponse.model_validate(service.compare_emotions(user_id, book_id))


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


@router.patch(
    "/books/{book_id}/pages/{page_number}/review/visibility",
    response_model=ReviewVisibilityUpdate,
)
def update_review_visibility(
    book_id: int,
    page_number: PageNumber,
    request: ReviewVisibilityUpdate,
    service: ReviewServiceDependency,
    user_id: CurrentUserId,
    iteration: int | None = Query(default=None, ge=1),
) -> ReviewVisibilityUpdate:
    service.set_visibility(user_id, book_id, page_number, request.visibility, iteration)
    return request


@router.patch(
    "/books/{book_id}/pages/{page_number}/review/spoilers",
    response_model=ReviewSpoilersUpdate,
)
def update_review_spoilers(
    book_id: int,
    page_number: PageNumber,
    request: ReviewSpoilersUpdate,
    service: ReviewServiceDependency,
    user_id: CurrentUserId,
    iteration: int | None = Query(default=None, ge=1),
) -> ReviewSpoilersUpdate:
    service.set_spoilers(user_id, book_id, page_number, request.contains_spoilers, iteration)
    return request
