from datetime import UTC, datetime, timedelta
from importlib import import_module
from unittest.mock import create_autospec

import pytest
import sqlalchemy as sa
import test_visibility
from alembic.migration import MigrationContext
from alembic.operations import Operations

from backend.library.application.errors import ExternalServiceError
from backend.library.application.ports import BookCatalog
from backend.library.application.service import LibraryService
from backend.library.domain.errors import InvalidInput
from backend.library.infrastructure.models import Book, UserBook
from backend.library.infrastructure.repository import SqlBookRepository
from backend.library.infrastructure.unit_of_work import SqlLibraryUnitOfWork
from backend.library.presentation.dependencies import get_library_service
from backend.reviews.application.errors import AnalysisUnavailable
from backend.reviews.infrastructure.repository import SqlReviewRepository
from backend.shared.application.security import AuthenticationRequired
from backend.shared.presentation.auth import get_current_user_id

context = test_visibility.context
NOW = datetime(2026, 1, 1, tzinfo=UTC)
PATH = "/books/continue-reading"
REVIEW = "/books/10/pages/3/review"


@pytest.fixture
def recent(context):
    catalog = create_autospec(BookCatalog, instance=True)
    library = LibraryService(
        lambda: SqlLibraryUnitOfWork(context.sessions), catalog, context.service.clock
    )
    context.app.dependency_overrides[get_library_service] = lambda: library
    context.library = library
    context.catalog = catalog
    return context


def test_current_reading_only_and_null_history_is_not_guessed(recent):
    response = recent.client.get(PATH)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    payload = response.json()
    assert payload["limit"] == 3
    assert payload["offset"] == 0
    assert len(payload["items"]) == 1
    item = payload["items"][0]
    assert item["id"] == 10
    assert item["latest_iteration"] == 2
    assert item["reading_status"] == "reading"
    assert item["last_read_at"] is None
    assert recent.client.get("/books/10").json()["last_read_at"] is None
    assert recent.client.get("/books/10/iterations").json()[1]["last_read_at"] is None
    recent.catalog.get.assert_not_called()


def test_new_registration_has_unknown_activity_and_shelf_keeps_id_order(recent):
    response = recent.client.post(
        "/books", json={"title": "New book", "author": "Author", "total_pages": 100}
    )
    assert response.status_code == 201
    created = response.json()
    assert created["last_read_at"] is None
    assert recent.client.put(REVIEW, json={"review_text": "Saved"}).status_code == 200
    response = recent.client.put(
        f"/books/{created['id']}/pages/1/review", json={"review_text": "New note"}
    )
    assert response.status_code == 201
    assert [item["id"] for item in recent.client.get(PATH).json()["items"]] == [
        created["id"],
        10,
    ]
    shelf = recent.client.get("/books").json()["items"]
    assert [item["id"] for item in shelf] == [10, created["id"]]
    assert all(item["last_read_at"] is not None for item in shelf)


def test_recent_order_precedes_new_starts_and_limit_is_applied_to_all_books(recent):
    with recent.sessions() as db:
        for number in range(20, 130):
            db.add(Book(id=number, title=f"Book {number}", total_pages=100))
        db.flush()
        db.get(Book, 22).google_books_id = "unselected-volume"
        for number in range(20, 130):
            db.add(
                UserBook(
                    id=number,
                    user_id=1,
                    book_id=number,
                    iteration_number=1,
                    started_at=NOW + timedelta(days=number),
                    last_read_at=NOW + timedelta(hours=1) if number in (20, 21) else None,
                )
            )
        db.get(UserBook, 2).last_read_at = NOW + timedelta(hours=2)
        db.get(UserBook, 3).last_read_at = NOW + timedelta(days=999)
        db.commit()
    assert [item["id"] for item in recent.client.get(PATH).json()["items"]] == [10, 21, 20]
    recent.catalog.get.assert_not_called()
    assert [item["id"] for item in recent.client.get(PATH + "?limit=5").json()["items"]] == [
        10,
        21,
        20,
        129,
        128,
    ]
    with recent.sessions() as db:
        db.get(UserBook, 21).started_at = db.get(UserBook, 20).started_at
        db.commit()
    # Same saved timestamp and start date: descending reading ID is deterministic.
    assert [item["id"] for item in recent.client.get(PATH).json()["items"]] == [10, 21, 20]


def test_successful_body_save_sets_activity_and_same_page_save_updates_it(recent):
    assert recent.client.put(REVIEW, json={"review_text": "Saved"}).status_code == 200
    first = recent.client.get(PATH).json()["items"][0]["last_read_at"]
    assert datetime.fromisoformat(first).replace(tzinfo=UTC) == test_visibility.LATER
    later = test_visibility.LATER + timedelta(days=1)
    recent.service.clock.now = lambda: later
    assert recent.client.put(REVIEW, json={"review_text": "Saved again"}).status_code == 200
    result = recent.client.get(PATH).json()["items"][0]
    assert datetime.fromisoformat(result["last_read_at"]).replace(tzinfo=UTC) == later
    assert result["current_page"] == 3
    with recent.sessions() as db:
        assert db.get(UserBook, 1).last_read_at is None
        assert db.get(UserBook, 3).last_read_at is None


def test_earlier_page_save_records_activity_without_rewinding_progress(recent):
    recent.client.put("/books/10/pages/8/review", json={"review_text": "Page 8"})
    later = test_visibility.LATER + timedelta(days=1)
    recent.service.clock.now = lambda: later
    assert recent.client.put(REVIEW, json={"review_text": "Earlier note"}).status_code == 200
    result = recent.client.get(PATH).json()["items"][0]
    assert result["current_page"] == 8
    assert datetime.fromisoformat(result["last_read_at"]).replace(tzinfo=UTC) == later


def test_read_and_settings_operations_do_not_count_as_reading(recent):
    recent.client.put(REVIEW, json={"review_text": "Saved"})
    before = recent.client.get(PATH).json()
    recent.service.clock.now = lambda: test_visibility.LATER + timedelta(days=1)
    assert recent.client.get("/books/10").status_code == 200
    assert recent.client.get(REVIEW).status_code == 200
    assert (
        recent.client.patch(REVIEW + "/visibility", json={"visibility": "public"}).status_code
        == 200
    )
    assert (
        recent.client.patch(REVIEW + "/spoilers", json={"contains_spoilers": False}).status_code
        == 200
    )
    assert recent.client.get(PATH).json() == before


def test_completion_removes_candidate_and_reread_starts_without_old_activity(recent):
    recent.client.put(REVIEW, json={"review_text": "Saved"})
    assert recent.client.post("/books/10/iterations/2/complete").status_code == 200
    assert recent.client.get(PATH).json()["items"] == []
    response = recent.client.post("/books/10/iterations")
    assert response.status_code == 201
    assert response.json()["last_read_at"] is None
    item = recent.client.get(PATH).json()["items"][0]
    assert item["latest_iteration"] == 3
    assert item["current_page"] == 0
    assert item["last_read_at"] is None
    assert recent.client.get("/books/10/iterations").json()[1]["last_read_at"] is not None


@pytest.mark.parametrize("body", [{"review_text": ""}, {"review_text": "x" * 141}])
def test_invalid_body_does_not_record_activity(recent, body):
    assert recent.client.put(REVIEW, json=body).status_code == 422
    assert recent.client.get(PATH).json()["items"][0]["last_read_at"] is None


def test_failed_review_write_rolls_back_activity_together_with_text(recent, monkeypatch):
    def unavailable(*args, **kwargs):
        raise sa.exc.OperationalError("test", {}, RuntimeError("outage"))

    monkeypatch.setattr(SqlReviewRepository, "save", unavailable)
    assert recent.client.put(REVIEW, json={"review_text": "Not saved"}).status_code == 503
    assert recent.client.get(PATH).json()["items"][0]["last_read_at"] is None
    assert recent.client.get(REVIEW).json()["review_text"] == "Original"


def test_failed_commit_rolls_back_activity(recent, monkeypatch):
    def unavailable(self):
        raise sa.exc.OperationalError("commit", {}, RuntimeError("outage"))

    monkeypatch.setattr(recent.sessions.class_, "commit", unavailable)
    assert recent.client.put(REVIEW, json={"review_text": "Not committed"}).status_code == 503
    assert recent.client.get(PATH).json()["items"][0]["last_read_at"] is None


def test_analysis_failure_keeps_already_committed_activity(recent):
    recent.analyses.analyze.side_effect = AnalysisUnavailable("analysis unavailable")
    response = recent.client.put(REVIEW, json={"review_text": "Saved"})
    assert response.status_code == 200
    assert response.json()["analysis_status"] == "failed"
    assert recent.client.get(PATH).json()["items"][0]["last_read_at"] is not None


@pytest.mark.parametrize("suffix, status", [("?iteration=1", 409), ("?iteration=99", 404)])
def test_unavailable_iteration_does_not_record_activity(recent, suffix, status):
    assert (
        recent.client.put(REVIEW + suffix, json={"review_text": "Not saved"}).status_code == status
    )
    assert recent.client.get(PATH).json()["items"][0]["last_read_at"] is None


def test_invalid_page_does_not_record_activity(recent):
    assert (
        recent.client.put("/books/10/pages/101/review", json={"review_text": "Invalid"}).status_code
        == 422
    )
    assert recent.client.get(PATH).json()["items"][0]["last_read_at"] is None


def test_empty_result_and_authentication(recent):
    recent.app.dependency_overrides[get_current_user_id] = lambda: 999
    assert recent.client.get(PATH).json()["items"] == []

    def unauthenticated():
        raise AuthenticationRequired("Authentication required")

    recent.app.dependency_overrides[get_current_user_id] = unauthenticated
    assert recent.client.get(PATH).status_code == 401


@pytest.mark.parametrize("limit", ["0", "-1", "21", "1.5", "abc"])
def test_limits_are_validated(recent, limit):
    assert recent.client.get(f"{PATH}?limit={limit}").status_code == 422


def test_service_rejects_invalid_limit_before_database(recent):
    with pytest.raises(InvalidInput):
        recent.library.continue_reading(1, 0)


def test_database_failures_are_not_disguised_as_no_suggestions(recent, monkeypatch):
    def unavailable(*args):
        raise sa.exc.OperationalError("read", {}, RuntimeError("outage"))

    monkeypatch.setattr(SqlBookRepository, "list_recent_reading", unavailable)
    assert recent.client.get(PATH).status_code == 503


def test_metadata_is_resolved_only_for_selected_candidates_and_errors_remain_explicit(recent):
    with recent.sessions() as db:
        row = db.get(Book, 10)
        row.google_books_id = "volume"
        db.commit()
    recent.catalog.get.side_effect = ExternalServiceError("catalog unavailable")
    assert recent.client.get(PATH).status_code == 502
    recent.catalog.get.assert_called_once_with("volume")


def test_last_read_migration_preserves_unknown_history_and_round_trips():
    migration = import_module("backend.infrastructure.migrations.versions.0014_last_read_at")
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE user_books (id INTEGER PRIMARY KEY, user_id INTEGER,"
            " status VARCHAR(16), current_page INTEGER, updated_at DATETIME)"
        )
        connection.exec_driver_sql(
            "INSERT INTO user_books VALUES (1, 1, 'reading', 3, '2026-01-01')"
        )
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert connection.exec_driver_sql("SELECT * FROM user_books").one() == (
                1,
                1,
                "reading",
                3,
                "2026-01-01",
                None,
            )
            assert sa.inspect(connection).get_indexes("user_books")[0]["column_names"] == [
                "user_id",
                "status",
                "last_read_at",
            ]
            connection.exec_driver_sql(
                "INSERT INTO user_books (id,user_id,status,current_page) VALUES (2,1,'reading',0)"
            )
            assert (
                connection.exec_driver_sql(
                    "SELECT last_read_at FROM user_books WHERE id=2"
                ).scalar()
                is None
            )
            migration.downgrade()
            assert connection.exec_driver_sql("SELECT count(*) FROM user_books").scalar() == 2
            migration.upgrade()
            assert (
                connection.exec_driver_sql(
                    "SELECT count(*) FROM user_books WHERE last_read_at IS NOT NULL"
                ).scalar()
                == 0
            )
    engine.dispose()
