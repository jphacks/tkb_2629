from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import create_autospec

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.analysis.infrastructure.models import EmotionAnalysis
from backend.analysis.infrastructure.repository import SqlAnalysisRepository
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
from backend.reviews.application.ports import (
    AnalysisGateway,
    PublicAuthorGateway,
    PublicReadingGateway,
)
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
        "color_code",
        "analysis_status",
        "source",
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
    service = PublicReviewService(
        lambda: None, readings, authors, create_autospec(AnalysisGateway, instance=True)
    )
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


def test_distribution_counts_all_named_public_reviews_without_text_or_colors(context):
    response = context.client.get(PATH + "/distribution")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {
        "items": [
            {"page_number": 3, "review_count": 2},
            {"page_number": 5, "review_count": 1},
        ],
        "total_count": 3,
    }
    assert "Review " not in response.text
    assert "Reader" not in response.text
    assert "color" not in response.text
    context.catalog.get.assert_not_called()
    context.catalog.search.assert_not_called()


def test_distribution_is_not_limited_to_first_twenty_reviews(context):
    with context.sessions() as db:
        db.add_all(
            PageReview(
                user_book_id=4,
                page_number=page,
                review_text="Public",
                visibility="public",
                contains_spoilers=True,
                created_at=NOW,
                updated_at=NOW,
            )
            for page in range(10, 40)
        )
        db.commit()
    assert len(context.client.get(PATH).json()["items"]) == 20
    distribution = context.client.get(PATH + "/distribution").json()
    assert distribution["total_count"] == 33
    assert sum(item["review_count"] for item in distribution["items"]) == 33
    assert distribution["items"][-1] == {"page_number": 39, "review_count": 1}


def test_distribution_reflects_visibility_and_name_changes(context):
    with context.sessions() as db:
        db.execute(sa.update(PageReview).where(PageReview.id == 2).values(visibility="private"))
        db.execute(sa.update(User).where(User.id == 3).values(public_display_name=None))
        db.commit()
    assert context.client.get(PATH + "/distribution").json() == {
        "items": [{"page_number": 3, "review_count": 1}],
        "total_count": 1,
    }
    with context.sessions() as db:
        db.execute(sa.update(PageReview).where(PageReview.id == 1).values(visibility="private"))
        db.commit()
    assert context.client.get(PATH + "/distribution").json() == {"items": [], "total_count": 0}


def test_unknown_distribution_is_empty_and_authentication_is_required(context):
    response = context.client.get("/catalog/books/unknown/reviews/distribution")
    assert response.status_code == 200
    assert response.json() == {"items": [], "total_count": 0}
    context.catalog.get.assert_not_called()

    def unauthenticated():
        raise AuthenticationRequired("Authentication required")

    context.app.dependency_overrides[get_current_user_id] = unauthenticated
    for path in (PATH + "/distribution", "/catalog/books/unknown/reviews/distribution"):
        assert context.client.get(path).status_code == 401


@pytest.mark.parametrize("volume", ["%20", "bad%20id", "x" * 257])
def test_distribution_validates_volume(context, volume):
    assert context.client.get(f"/catalog/books/{volume}/reviews/distribution").status_code == 422


def test_distribution_aggregates_chunks_and_deduplicates_readings(context):
    with context.sessions() as db:
        ids = [2, *range(100, 1100), 4, 1, 2]
        counts = SqlReviewRepository(db).public_distribution(ids)
        assert [(point.page_number, point.review_count) for point in counts] == [(3, 2), (5, 1)]
        assert SqlReviewRepository(db).public_distribution([]) == []


def test_inclusive_range_and_pagination_do_not_include_private_reviews(context):
    for start, end, expected in [(3, 3, [2, 1]), (3, 5, [5, 2, 1]), (4, 5, [5]), (6, 9, [])]:
        response = context.client.get(f"{PATH}?page_start={start}&page_end={end}")
        assert response.status_code == 200
        assert [row["id"] for row in response.json()["items"]] == expected
    payload = context.client.get(f"{PATH}?page_start=3&page_end=5&limit=1&offset=1").json()
    assert [row["id"] for row in payload["items"]] == [2]
    assert payload["offset"] == 1
    with context.sessions() as db:
        ids = [2, *range(100, 1100), 4, 1]
        rows = SqlReviewRepository(db).list_public(ids, None, 1, 1, page_start=3, page_end=5)
        assert [row.id for row in rows] == [2]


@pytest.mark.parametrize(
    "query",
    [
        "page_start=0&page_end=5",
        "page_start=1&page_end=0",
        "page_start=5&page_end=3",
        "page_start=3",
        "page_end=5",
        "page=3&page_start=3&page_end=5",
        "page_start=x&page_end=5",
    ],
)
def test_invalid_range_rejected_even_for_unknown_books(context, query):
    for path in (PATH, "/catalog/books/unknown/reviews"):
        assert context.client.get(f"{path}?{query}").status_code == 422


def test_range_service_validation_happens_before_io():
    readings = create_autospec(PublicReadingGateway, instance=True)
    authors = create_autospec(PublicAuthorGateway, instance=True)
    analyses = create_autospec(AnalysisGateway, instance=True)
    service = PublicReviewService(lambda: None, readings, authors, analyses)
    for kwargs in [
        {"page_start": 1},
        {"page_end": 2},
        {"page_start": 3, "page_end": 2},
        {"page_start": 0, "page_end": 2},
        {"page": 1, "page_start": 1, "page_end": 2},
    ]:
        with pytest.raises(InvalidInput):
            service.list("volume", **kwargs)
    with pytest.raises(InvalidInput):
        service.distribution("bad id")
    readings.catalog_readings.assert_not_called()
    analyses.previews.assert_not_called()


def test_public_colors_use_only_current_completed_analysis_and_never_analyze(context, monkeypatch):
    with context.sessions() as db:
        db.execute(
            sa.update(PageReview)
            .where(PageReview.id.in_([1, 2, 5]))
            .values(analysis_status="completed", analysis_revision=2)
        )
        db.add_all(
            [
                EmotionAnalysis(review_id=1, review_revision=2, color_code="#123456", source="jev"),
                EmotionAnalysis(
                    review_id=2, review_revision=2, color_code="#ABCDEF", source="mock"
                ),
                EmotionAnalysis(review_id=5, review_revision=1, color_code="#FF0000", source="jev"),
            ]
        )
        db.commit()

    from backend.analysis.infrastructure.jev import JevEmotionAnalyzer, MockEmotionAnalyzer

    def must_not_analyze(*args, **kwargs):
        pytest.fail("Public reads must not call the analyzer")

    monkeypatch.setattr(JevEmotionAnalyzer, "analyze", must_not_analyze)
    monkeypatch.setattr(MockEmotionAnalyzer, "analyze", must_not_analyze)
    rows = {row["id"]: row for row in context.client.get(PATH).json()["items"]}
    assert (rows[1]["color_code"], rows[1]["source"], rows[1]["analysis_status"]) == (
        "#123456",
        "jev",
        "completed",
    )
    assert (rows[2]["color_code"], rows[2]["source"]) == ("#ABCDEF", "mock")
    assert (rows[5]["color_code"], rows[5]["source"]) == ("#808080", None)
    assert "emotion_scores" not in rows[1]
    with context.sessions() as db:
        db.execute(
            sa.update(PageReview).where(PageReview.id == 1).values(analysis_status="pending")
        )
        db.execute(sa.update(PageReview).where(PageReview.id == 2).values(analysis_status="failed"))
        db.commit()
    rows = {row["id"]: row for row in context.client.get(PATH).json()["items"]}
    for review_id, status in [(1, "pending"), (2, "failed")]:
        assert rows[review_id]["analysis_status"] == status
        assert rows[review_id]["color_code"] == "#808080"
        assert rows[review_id]["source"] is None


def test_only_eligible_page_analysis_is_loaded_and_distribution_never_loads_colors(
    context, monkeypatch
):
    with context.sessions() as db:
        db.execute(sa.update(PageReview).values(analysis_status="completed"))
        db.commit()
    calls = []
    original = SqlAnalysisRepository.get_many

    def record(self, references):
        calls.append(list(references))
        return original(self, references)

    monkeypatch.setattr(SqlAnalysisRepository, "get_many", record)
    assert context.client.get(f"{PATH}?page_start=3&page_end=3&limit=1").status_code == 200
    assert calls == [[(2, 1)]]
    calls.clear()
    assert context.client.get(PATH + "/distribution").status_code == 200
    assert calls == []


def test_analysis_failure_is_503_but_does_not_break_counts(context, monkeypatch):
    with context.sessions() as db:
        db.execute(
            sa.update(PageReview).where(PageReview.id == 1).values(analysis_status="completed")
        )
        db.commit()

    def unavailable(*args, **kwargs):
        raise sa.exc.OperationalError("test query", {}, RuntimeError("test outage"))

    monkeypatch.setattr(SqlAnalysisRepository, "get_many", unavailable)
    response = context.client.get(PATH)
    assert response.status_code == 503
    assert response.json()["detail"] == "Analysis results are unavailable"
    assert context.client.get(PATH + "/distribution").json()["total_count"] == 3


@pytest.mark.parametrize(
    "repository,method",
    [
        (SqlBookRepository, "find_catalog"),
        (SqlProfileRepository, "public_display_names"),
        (SqlReviewRepository, "public_distribution"),
    ],
)
def test_distribution_database_failure_is_not_empty_success(
    context, monkeypatch, repository, method
):
    def unavailable(*args, **kwargs):
        raise sa.exc.OperationalError("test query", {}, RuntimeError("test outage"))

    monkeypatch.setattr(repository, method, unavailable)
    assert context.client.get(PATH + "/distribution").status_code == 503
