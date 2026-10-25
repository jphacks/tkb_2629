from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import create_autospec

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.composition import schema as schema_registry  # noqa: F401
from backend.identity.application.errors import PersistenceUnavailable
from backend.identity.application.profiles import ProfileService
from backend.identity.infrastructure.models import User
from backend.identity.infrastructure.repository import SqlProfileRepository
from backend.identity.infrastructure.unit_of_work import SqlIdentityUnitOfWork
from backend.identity.presentation.dependencies import get_profile_service
from backend.library.application.ports import BookCatalog
from backend.library.application.service import LibraryService
from backend.library.infrastructure.models import Book, UserBook
from backend.library.infrastructure.repository import SqlBookRepository
from backend.library.infrastructure.unit_of_work import SqlLibraryUnitOfWork
from backend.library.presentation.dependencies import get_library_service
from backend.main import create_app
from backend.reviews.application.ports import PublicAuthorGateway, PublicReadingGateway
from backend.reviews.application.public_reviews import PublicReviewService
from backend.reviews.domain.errors import InvalidInput
from backend.reviews.infrastructure.models import PageReview
from backend.reviews.infrastructure.repository import SqlReviewRepository
from backend.shared import database
from backend.shared.application.security import AuthenticationRequired
from backend.shared.presentation.auth import get_current_user_id

NOW = datetime(2026, 1, 1, tzinfo=UTC)
PATH = "/catalog/books/volume-1/reviews"


@pytest.fixture
def context(monkeypatch):
    engine = sa.create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    database.Base.metadata.create_all(engine)
    sessions = sessionmaker(engine, expire_on_commit=False)
    with sessions() as db:
        db.add_all(
            [
                User(
                    id=i,
                    name=f"Private name {i}",
                    email=f"{i}@example.test",
                    public_display_name={1: "Reader A", 3: "Reader B", 4: "  "}.get(i),
                )
                for i in range(1, 6)
            ]
        )
        db.add_all(
            [
                Book(id=10, google_books_id="volume-1"),
                Book(id=11, title="Manual", total_pages=100),
                Book(id=12, google_books_id="volume-2"),
            ]
        )
        db.flush()
        for reading_id, user_id, book_id, iteration in [
            (1, 1, 10, 1),
            (2, 1, 10, 2),
            (3, 2, 10, 1),
            (4, 3, 10, 1),
            (5, 4, 10, 1),
            (6, 1, 12, 1),
            (7, 1, 11, 1),
        ]:
            db.add(
                UserBook(
                    id=reading_id,
                    user_id=user_id,
                    book_id=book_id,
                    iteration_number=iteration,
                    status="completed" if reading_id == 1 else "reading",
                    current_page=100 if reading_id == 1 else 5,
                    started_at=NOW,
                    completed_at=NOW if reading_id == 1 else None,
                )
            )
        db.flush()
        for review_id, reading_id, page, visibility, days in [
            (1, 1, 3, "public", 0),
            (2, 2, 3, "public", 1),
            (3, 3, 3, "public", 3),
            (4, 4, 4, "private", 4),
            (5, 4, 5, "public", 1),
            (6, 5, 3, "public", 5),
            (7, 6, 3, "public", 6),
            (8, 7, 3, "public", 7),
        ]:
            db.add(
                PageReview(
                    id=review_id,
                    user_book_id=reading_id,
                    page_number=page,
                    review_text=f"Review {review_id}",
                    visibility=visibility,
                    contains_spoilers=review_id != 5,
                    created_at=NOW,
                    updated_at=NOW + timedelta(days=days),
                )
            )
        db.commit()
    catalog = create_autospec(BookCatalog, instance=True)
    library = LibraryService(lambda: SqlLibraryUnitOfWork(sessions), catalog, SimpleNamespace())
    profiles = ProfileService(lambda: SqlIdentityUnitOfWork(sessions))
    monkeypatch.setattr(database, "SessionLocal", sessions)
    app = create_app()
    # Keep the production public-review factory and adapters, replacing only external resources.
    app.dependency_overrides[get_library_service] = lambda: library
    app.dependency_overrides[get_profile_service] = lambda: profiles
    app.dependency_overrides[get_current_user_id] = lambda: 5
    with TestClient(app) as client:
        yield SimpleNamespace(
            client=client, app=app, sessions=sessions, catalog=catalog, profiles=profiles
        )
    engine.dispose()


def test_unowned_book_lists_only_named_public_reviews_across_all_iterations(context):
    response = context.client.get(PATH)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    payload = response.json()
    assert payload["limit"] == 20
    assert payload["offset"] == 0
    assert [item["id"] for item in payload["items"]] == [5, 2, 1]
    assert [item["iteration_number"] for item in payload["items"]] == [1, 2, 1]
    assert [item["public_display_name"] for item in payload["items"]] == [
        "Reader B",
        "Reader A",
        "Reader A",
    ]
    assert payload["items"][0]["contains_spoilers"] is False
    assert payload["items"][1]["contains_spoilers"] is True
    assert payload["items"][0]["review_text"] == "Review 5"
    assert set(payload["items"][0]) == {
        "id",
        "public_display_name",
        "page_number",
        "iteration_number",
        "review_text",
        "contains_spoilers",
        "created_at",
        "updated_at",
    }
    assert "Private name" not in response.text
    assert "@example.test" not in response.text
    context.catalog.get.assert_not_called()
    context.catalog.search.assert_not_called()
    with context.sessions() as db:
        assert db.scalar(sa.select(sa.func.count()).select_from(Book)) == 3
        assert db.scalar(sa.select(sa.func.count()).select_from(UserBook)) == 7
        assert db.scalar(sa.select(UserBook.id).where(UserBook.user_id == 5)) is None


def test_page_filter_and_pagination_apply_after_privacy_filter(context):
    assert [row["id"] for row in context.client.get(f"{PATH}?page=3").json()["items"]] == [2, 1]
    assert context.client.get(f"{PATH}?page=4").json()["items"] == []
    assert context.client.get(f"{PATH}?page=9999").json()["items"] == []
    for offset, expected in [(0, [5]), (1, [2]), (2, [1]), (3, [])]:
        payload = context.client.get(f"{PATH}?limit=1&offset={offset}").json()
        assert payload["limit"] == 1
        assert payload["offset"] == offset
        assert [row["id"] for row in payload["items"]] == expected
    assert [
        row["id"] for row in context.client.get(f"{PATH}?page=3&limit=1&offset=1").json()["items"]
    ] == [1]


def test_includes_own_public_reviews_and_unknown_volume_is_empty_without_external_io(context):
    context.app.dependency_overrides[get_current_user_id] = lambda: 1
    assert [row["id"] for row in context.client.get(PATH).json()["items"]] == [5, 2, 1]
    response = context.client.get("/catalog/books/not-registered/reviews")
    assert response.status_code == 200
    assert response.json() == {"items": [], "limit": 20, "offset": 0}
    context.catalog.get.assert_not_called()


def test_changing_privacy_or_name_affects_subsequent_reads(context):
    with context.sessions() as db:
        db.execute(sa.update(PageReview).where(PageReview.id == 2).values(visibility="private"))
        db.commit()
    assert [row["id"] for row in context.client.get(PATH).json()["items"]] == [5, 1]
    context.profiles.update_public_display_name(1, 1, "New public name")
    items = context.client.get(PATH).json()["items"]
    assert items[1]["public_display_name"] == "New public name"
    context.profiles.update_public_display_name(2, 2, "New reader")
    assert [row["id"] for row in context.client.get(PATH).json()["items"]] == [3, 5, 1]


def test_no_eligible_authors_returns_empty_and_private_apis_remain_private(context):
    assert context.client.get("/books/10/pages/3/review?iteration=1").status_code == 404
    assert context.client.get("/users/1").status_code == 403
    with context.sessions() as db:
        db.execute(sa.update(User).values(public_display_name=None))
        db.commit()
    assert context.client.get(PATH).json()["items"] == []


@pytest.mark.parametrize(
    "repository,method",
    [
        (SqlBookRepository, "find_catalog"),
        (SqlReviewRepository, "list_public"),
    ],
)
def test_database_failures_are_explicit_not_empty_results(context, monkeypatch, repository, method):
    def unavailable(*args, **kwargs):
        raise sa.exc.OperationalError("test query", {}, RuntimeError("test outage"))

    monkeypatch.setattr(repository, method, unavailable)
    response = context.client.get(PATH)
    assert response.status_code == 503
    assert response.json() == {"detail": "Database operation failed"}


@pytest.mark.parametrize(
    "query",
    [
        "?page=0",
        "?page=-1",
        "?page=x",
        "?limit=0",
        "?limit=101",
        "?offset=-1",
    ],
)
def test_invalid_query_rejected(context, query):
    assert context.client.get(PATH + query).status_code == 422


@pytest.mark.parametrize("volume", ["%20", "bad%20id", "x" * 257])
def test_invalid_volume_rejected(context, volume):
    assert context.client.get(f"/catalog/books/{volume}/reviews").status_code == 422


def test_authentication_required_even_for_empty_results(context):
    def unauthenticated():
        raise AuthenticationRequired("Authentication required")

    context.app.dependency_overrides[get_current_user_id] = unauthenticated
    for path in (PATH, "/catalog/books/unknown/reviews"):
        assert context.client.get(path).status_code == 401


def test_profile_failure_is_not_an_empty_success(context):
    def unavailable(user_ids):
        raise PersistenceUnavailable("Profile storage unavailable")

    context.profiles.public_display_names = unavailable
    response = context.client.get(PATH)
    assert response.status_code == 503
    assert response.json() == {"detail": "Profile storage unavailable"}


def test_public_repository_chunks_ids_with_global_order_and_pagination(context):
    with context.sessions() as db:
        # Split existing readings across parameter batches with identical timestamps.
        reading_ids = [2, *range(100, 1100), 4, 1, 2]
        rows = SqlReviewRepository(db).list_public(reading_ids, None, 2, 1)
        assert [row.id for row in rows] == [2, 1]
        assert [row.id for row in SqlReviewRepository(db).list_public(reading_ids, 3, 1, 1)] == [1]
        assert SqlReviewRepository(db).list_public([], None, 20, 0) == []


def test_profile_name_batching_does_not_fallback_to_registration_names(context):
    with context.sessions() as db:
        result = SqlProfileRepository(db).public_display_names([*range(1, 1100), 1])
        assert result == {1: "Reader A", 3: "Reader B"}


def test_service_validates_direct_calls_before_io():
    readings = create_autospec(PublicReadingGateway, instance=True)
    authors = create_autospec(PublicAuthorGateway, instance=True)
    service = PublicReviewService(lambda: None, readings, authors)
    for args in [
        ("",),
        ("bad id",),
        ("volume", 0),
        ("volume", None, 101),
        ("volume", None, 20, -1),
    ]:
        with pytest.raises(InvalidInput):
            service.list(*args)
    readings.catalog_readings.assert_not_called()
    authors.display_names.assert_not_called()
