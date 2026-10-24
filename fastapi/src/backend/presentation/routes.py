from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response

from ..application.services import ReadingService, ReviewService, UserService
from ..domain.entities import Book, Review, User
from .auth import get_current_user_id
from .dependencies import get_reading, get_reviews, get_users
from .schemas import (
    BookCreate, BookListResponse, BookResponse, PageReviewResponse,
    ReviewSave, UserCreate, UserResponse, UserUpdate,
)

catalog = APIRouter(tags=["catalog"])
users = APIRouter(prefix="/users", tags=["users"])
reading = APIRouter(tags=["reading"])

# Annotated attaches FastAPI injection or validation metadata to a type.
UserServiceDependency = Annotated[UserService, Depends(get_users)]
ReadingServiceDependency = Annotated[ReadingService, Depends(get_reading)]
ReviewServiceDependency = Annotated[ReviewService, Depends(get_reviews)]
CurrentUserId = Annotated[int, Depends(get_current_user_id)]
PageNumber = Annotated[int, Path(ge=1)]


@users.post("", response_model=UserResponse)
def create_user(request: UserCreate, service: UserServiceDependency) -> User:
    return service.create(request.name, request.email)


@users.get("", response_model=list[UserResponse])
def list_users(service: UserServiceDependency) -> list[User]:
    return service.list()


@users.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, service: UserServiceDependency) -> User:
    return service.get(user_id)


@users.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, request: UserUpdate, service: UserServiceDependency) -> User:
    return service.update(user_id, request.name, request.email)


@users.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, service: UserServiceDependency) -> None:
    service.delete(user_id)


@reading.post("/books", response_model=BookResponse, status_code=201)
def create_book(
    request: BookCreate,
    service: ReadingServiceDependency,
    user_id: CurrentUserId,
) -> Book:
    return service.register(user_id, request.title, request.author,
                            request.total_pages, request.book_id)


@reading.get("/books", response_model=BookListResponse)
def list_books(
    service: ReadingServiceDependency,
    user_id: CurrentUserId,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> BookListResponse:
    books = service.list(user_id, limit, offset)
    items: list[BookResponse] = []
    for book in books:
        items.append(BookResponse.model_validate(book, from_attributes=True))
    return BookListResponse(items=items, limit=limit, offset=offset)


@reading.get("/books/{book_id}", response_model=BookResponse)
def get_book(book_id: int, service: ReadingServiceDependency, user_id: CurrentUserId) -> Book:
    return service.get(user_id, book_id)


@reading.get("/books/{book_id}/pages/{page_number}/review", response_model=PageReviewResponse)
def get_review(
    book_id: int,
    page_number: PageNumber,
    service: ReviewServiceDependency,
    user_id: CurrentUserId,
) -> Review:
    return service.get(user_id, book_id, page_number)


@reading.put("/books/{book_id}/pages/{page_number}/review", response_model=PageReviewResponse)
def save_review(
    book_id: int,
    page_number: PageNumber,
    request: ReviewSave,
    response: Response,
    service: ReviewServiceDependency,
    user_id: CurrentUserId,
) -> Review:
    result = service.save(user_id, book_id, page_number, request.review_text)
    if result.created:
        response.status_code = 201
    else:
        response.status_code = 200
    return result.review


@catalog.get(
    "/fetch",
    status_code=501,
    summary="Fetch book information from Google Books (not implemented)",
)
def fetch_books() -> None:
    """Placeholder for Google Books integration; no external request is made."""
    raise HTTPException(status_code=501, detail="Google Books integration is not implemented")
