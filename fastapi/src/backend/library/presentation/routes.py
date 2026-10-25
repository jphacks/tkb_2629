from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from backend.shared.presentation.auth import get_current_user_id

from ..application.results import BookView
from ..application.service import LibraryService
from ..domain.catalog import CatalogBook
from ..domain.entities import Reading
from .dependencies import get_library_service
from .schemas import (
    BookCreate,
    BookListResponse,
    BookResponse,
    GoogleBookImport,
    GoogleBookResponse,
    GoogleBookSearchResponse,
    ReadingIterationResponse,
)

router = APIRouter(tags=["library"])
LibraryServiceDependency = Annotated[LibraryService, Depends(get_library_service)]
CurrentUserId = Annotated[int, Depends(get_current_user_id)]


@router.post("/books", response_model=BookResponse, status_code=201)
def create_book(
    request: BookCreate,
    service: LibraryServiceDependency,
    user_id: CurrentUserId,
) -> BookView:
    return service.register(
        user_id, request.title, request.author, request.total_pages, request.book_id
    )


@router.post("/books/import", response_model=BookResponse, status_code=201)
def import_book(
    request: GoogleBookImport,
    service: LibraryServiceDependency,
    user_id: CurrentUserId,
) -> BookView:
    return service.import_catalog_book(user_id, request.google_books_id)


@router.get("/books", response_model=BookListResponse)
def list_books(
    service: LibraryServiceDependency,
    user_id: CurrentUserId,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> BookListResponse:
    books = service.list(user_id, limit, offset)
    items: list[BookResponse] = []
    for book in books:
        items.append(BookResponse.model_validate(book, from_attributes=True))
    return BookListResponse(items=items, limit=limit, offset=offset)


@router.get("/books/continue-reading", response_model=BookListResponse)
def continue_reading(
    service: LibraryServiceDependency,
    user_id: CurrentUserId,
    response: Response,
    limit: int = Query(default=3, ge=1, le=20),
) -> BookListResponse:
    response.headers["Cache-Control"] = "no-store"
    books = service.continue_reading(user_id, limit)
    return BookListResponse(
        items=[BookResponse.model_validate(book) for book in books], limit=limit, offset=0
    )


@router.get("/books/{book_id}", response_model=BookResponse)
def get_book(book_id: int, service: LibraryServiceDependency, user_id: CurrentUserId) -> BookView:
    return service.get(user_id, book_id)


@router.get(
    "/books/{book_id}/iterations",
    response_model=list[ReadingIterationResponse],
)
def list_reading_iterations(
    book_id: int,
    service: LibraryServiceDependency,
    user_id: CurrentUserId,
) -> list[Reading]:
    return service.list_iterations(user_id, book_id)


@router.post(
    "/books/{book_id}/iterations",
    response_model=ReadingIterationResponse,
    status_code=201,
)
def start_reading_iteration(
    book_id: int,
    service: LibraryServiceDependency,
    user_id: CurrentUserId,
) -> Reading:
    return service.start_iteration(user_id, book_id)


@router.post(
    "/books/{book_id}/iterations/{iteration_number}/complete",
    response_model=ReadingIterationResponse,
)
def complete_reading_iteration(
    book_id: int,
    iteration_number: int,
    service: LibraryServiceDependency,
    user_id: CurrentUserId,
) -> Reading:
    return service.complete_iteration(user_id, book_id, iteration_number)


@router.get("/fetch", response_model=GoogleBookSearchResponse)
def fetch_books(
    service: LibraryServiceDependency,
    query: str = Query(min_length=1, max_length=200),
    limit: int = Query(default=10, ge=1, le=20),
) -> GoogleBookSearchResponse:
    books: list[CatalogBook] = service.search(query, limit)
    return GoogleBookSearchResponse(
        items=[GoogleBookResponse.model_validate(book, from_attributes=True) for book in books]
    )
