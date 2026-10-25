from datetime import UTC, datetime
from importlib import import_module
from types import SimpleNamespace
from unittest.mock import create_autospec

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.composition import schema as schema_registry  # noqa: F401
from backend.identity.infrastructure.models import User
from backend.integration.reviews_library import LibraryReadingGateway
from backend.library.application.ports import BookCatalog
from backend.library.application.service import LibraryService
from backend.library.infrastructure.models import Book, UserBook
from backend.library.infrastructure.unit_of_work import SqlLibraryUnitOfWork
from backend.main import create_app
from backend.reviews.application.ports import AnalysisGateway
from backend.reviews.application.service import ReviewService
from backend.reviews.domain.values import ReviewText
from backend.reviews.infrastructure.models import PageReview
from backend.reviews.infrastructure.repository import SqlReviewRepository
from backend.reviews.infrastructure.unit_of_work import SqlReviewUnitOfWork
from backend.reviews.presentation.dependencies import get_review_service
from backend.shared.application.security import AuthenticationRequired
from backend.shared.database import Base
from backend.shared.presentation.auth import get_current_user_id

NOW = datetime(2026, 1, 1, tzinfo=UTC)
LATER = datetime(2026, 1, 2, tzinfo=UTC)
PATH = "/books/10/pages/3/review"


@pytest.fixture
def context():
    engine = sa.create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(engine, expire_on_commit=False)
    with sessions() as db:
        db.add_all(
            [
                User(id=1, name="First", email="one@example.test"),
                User(id=2, name="Second", email="two@example.test"),
                Book(id=10, title="Example", total_pages=100),
            ]
        )
        db.flush()
        db.add_all(
            [
                UserBook(
                    id=1,
                    user_id=1,
                    book_id=10,
                    iteration_number=1,
                    status="completed",
                    current_page=100,
                    started_at=NOW,
                    completed_at=NOW,
                ),
                UserBook(
                    id=2,
                    user_id=1,
                    book_id=10,
                    iteration_number=2,
                    status="reading",
                    current_page=3,
                    started_at=NOW,
                ),
                UserBook(
                    id=3,
                    user_id=2,
                    book_id=10,
                    iteration_number=1,
                    status="reading",
                    current_page=0,
                    started_at=NOW,
                ),
            ]
        )
        db.flush()
        db.add_all(
            [
                PageReview(
                    id=number,
                    user_book_id=number,
                    page_number=3,
                    review_text="Original",
                    analysis_revision=1,
                    analysis_status="completed",
                    created_at=NOW,
                    updated_at=NOW,
                )
                for number in (1, 2)
            ]
        )
        db.commit()
    clock = SimpleNamespace(now=lambda: LATER)
    catalog = create_autospec(BookCatalog, instance=True)
    analyses = create_autospec(AnalysisGateway, instance=True)
    analyses.previews.return_value = {}
    library = LibraryService(lambda: SqlLibraryUnitOfWork(sessions), catalog, clock)

    def transactional_readings(db: Session):
        return LibraryReadingGateway(
            LibraryService(lambda: SqlLibraryUnitOfWork(lambda: db, borrowed=True), catalog, clock)
        )

    service = ReviewService(
        lambda: SqlReviewUnitOfWork(sessions, transactional_readings),
        LibraryReadingGateway(library),
        analyses,
        clock,
    )
    app = create_app()
    app.dependency_overrides[get_review_service] = lambda: service
    app.dependency_overrides[get_current_user_id] = lambda: 1
    with TestClient(app) as client:
        yield SimpleNamespace(
            client=client, app=app, sessions=sessions, service=service, analyses=analyses
        )
    engine.dispose()


def test_existing_and_new_reviews_start_private(context):
    assert context.client.get(PATH).json()["visibility"] == "private"
    assert context.client.get(PATH).json()["contains_spoilers"] is True
    response = context.client.put("/books/10/pages/4/review", json={"review_text": "New review"})
    assert response.status_code == 201
    assert response.json()["visibility"] == "private"
    assert response.json()["contains_spoilers"] is True
    listed = context.client.get("/books/10/reviews").json()
    assert [item["visibility"] for item in listed] == ["private", "private"]
    assert all(item["contains_spoilers"] is True for item in listed)


@pytest.mark.parametrize("iteration", [1, 2])
def test_visibility_only_changes_setting_and_timestamp(context, iteration):
    url = f"{PATH}/visibility?iteration={iteration}"
    for visibility in ("public", "public", "private"):
        response = context.client.patch(url, json={"visibility": visibility})
        assert response.status_code == 200
        assert response.json() == {"visibility": visibility}
        result = context.client.get(f"{PATH}?iteration={iteration}").json()
        assert result["visibility"] == visibility
        with context.sessions() as db:
            row = db.get(PageReview, iteration)
            assert row.review_text == "Original"
            assert row.analysis_revision == 1
            assert row.analysis_status == "completed"
            assert row.created_at == NOW.replace(tzinfo=None)
            assert row.updated_at == LATER.replace(tzinfo=None)
            other = db.get(PageReview, 3 - iteration)
            assert other.visibility == "private"
            reading = db.get(UserBook, iteration)
            assert reading.current_page == (100 if iteration == 1 else 3)
            assert reading.status == ("completed" if iteration == 1 else "reading")
    context.analyses.analyze.assert_not_called()


def test_legacy_text_updates_preserve_visibility(context):
    assert (
        context.client.patch(f"{PATH}/visibility", json={"visibility": "public"}).status_code == 200
    )
    response = context.client.put(PATH, json={"review_text": "Edited"})
    assert response.status_code == 200
    assert response.json()["visibility"] == "public"
    assert response.json()["review_text"] == "Edited"
    with context.sessions() as db:
        assert db.get(PageReview, 2).analysis_revision == 2


def test_body_save_cannot_publish_reviews(context):
    response = context.client.put(PATH, json={"review_text": "Edited", "visibility": "public"})
    assert response.status_code == 200
    assert response.json()["visibility"] == "private"


def test_independent_updates_do_not_overwrite_other_fields(context):
    with context.sessions() as db:
        stale_text = SqlReviewRepository(db).get(2)
        stale_visibility = SqlReviewRepository(db).get(2)
    context.service.set_visibility(1, 10, 3, "public")
    stale_text.revise(ReviewText("Updated text"), LATER)
    with context.sessions() as db:
        SqlReviewRepository(db).save(stale_text)
        db.commit()
        assert db.get(PageReview, 2).visibility == "public"
    stale_visibility.set_visibility("private", LATER)
    with context.sessions() as db:
        SqlReviewRepository(db).save_visibility(stale_visibility)
        db.commit()
        row = db.get(PageReview, 2)
        assert row.visibility == "private"
        assert row.review_text == "Updated text"
        assert row.analysis_revision == 2
        assert row.analysis_status == "pending"


@pytest.mark.parametrize("visibility", ["private", "public"])
def test_other_user_cannot_read_or_change_review_even_if_public(context, visibility):
    context.service.set_visibility(1, 10, 3, visibility)
    context.app.dependency_overrides[get_current_user_id] = lambda: 2
    assert context.client.get(PATH).status_code == 404
    assert context.client.get("/books/10/reviews").json() == []
    assert (
        context.client.patch(f"{PATH}/visibility", json={"visibility": "public"}).status_code == 404
    )
    with context.sessions() as db:
        assert db.get(PageReview, 2).visibility == visibility


def test_missing_book_or_review_does_not_create_data(context):
    for path in ("/books/999/pages/3/review", "/books/10/pages/99/review"):
        response = context.client.patch(f"{path}/visibility", json={"visibility": "public"})
        assert response.status_code == 404
    with context.sessions() as db:
        assert db.scalar(sa.select(sa.func.count()).select_from(PageReview)) == 2


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"visibility": None},
        {"visibility": "friends"},
        {"visibility": True},
        {"visibility": "public", "review_text": "Unexpected"},
    ],
)
def test_invalid_settings_rejected(context, payload):
    response = context.client.patch(f"{PATH}/visibility", json=payload)
    assert response.status_code == 422
    with context.sessions() as db:
        assert db.get(PageReview, 2).visibility == "private"


@pytest.mark.parametrize(
    "suffix",
    [
        "/books/10/pages/0/review/visibility",
        f"{PATH}/visibility?iteration=0",
    ],
)
def test_invalid_page_and_iteration_rejected(context, suffix):
    assert context.client.patch(suffix, json={"visibility": "public"}).status_code == 422


def test_authentication_required(context):
    def unauthenticated():
        raise AuthenticationRequired("Authentication required")

    context.app.dependency_overrides[get_current_user_id] = unauthenticated
    assert (
        context.client.patch(f"{PATH}/visibility", json={"visibility": "public"}).status_code == 401
    )


def test_visibility_migration_preserves_data_and_defaults():
    migration = import_module("backend.infrastructure.migrations.versions.0010_review_visibility")
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE page_reviews (id INTEGER PRIMARY KEY, review_text TEXT NOT NULL)"
        )
        connection.exec_driver_sql(
            "INSERT INTO page_reviews (id, review_text) VALUES (1, 'Existing')"
        )
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert connection.exec_driver_sql(
                "SELECT review_text, visibility FROM page_reviews WHERE id = 1"
            ).one() == ("Existing", "private")
            connection.exec_driver_sql(
                "INSERT INTO page_reviews (id, review_text) VALUES (2, 'New')"
            )
            assert (
                connection.exec_driver_sql(
                    "SELECT visibility FROM page_reviews WHERE id = 2"
                ).scalar_one()
                == "private"
            )
            with pytest.raises(sa.exc.IntegrityError), connection.begin_nested():
                connection.exec_driver_sql(
                    "UPDATE page_reviews SET visibility = 'friends' WHERE id = 1"
                )
            migration.downgrade()
            assert connection.exec_driver_sql(
                "SELECT review_text FROM page_reviews ORDER BY id"
            ).scalars().all() == ["Existing", "New"]
            migration.upgrade()
    engine.dispose()


@pytest.mark.parametrize("iteration", [None, 1, 2])
@pytest.mark.parametrize("visibility", ["private", "public"])
def test_spoiler_setting_is_independent_and_does_not_analyze(context, iteration, visibility):
    context.service.set_visibility(1, 10, 3, visibility, iteration)
    suffix = "" if iteration is None else f"?iteration={iteration}"
    for contains_spoilers in (False, False, True):
        response = context.client.patch(
            f"{PATH}/spoilers{suffix}", json={"contains_spoilers": contains_spoilers}
        )
        assert response.status_code == 200
        assert response.json() == {"contains_spoilers": contains_spoilers}
        result = context.client.get(f"{PATH}{suffix}").json()
        assert result["contains_spoilers"] is contains_spoilers
        assert result["visibility"] == visibility
        with context.sessions() as db:
            row = db.get(PageReview, iteration or 2)
            assert row.contains_spoilers is contains_spoilers
            assert row.visibility == visibility
            assert row.review_text == "Original"
            assert row.analysis_revision == 1
            assert row.analysis_status == "completed"
            assert row.created_at == NOW.replace(tzinfo=None)
            assert row.updated_at == LATER.replace(tzinfo=None)
            assert db.get(PageReview, 3 - (iteration or 2)).contains_spoilers is True
            reading = db.get(UserBook, iteration or 2)
            assert reading.current_page == (100 if iteration == 1 else 3)
            assert reading.status == ("completed" if iteration == 1 else "reading")
    context.analyses.analyze.assert_not_called()


def test_text_and_visibility_updates_preserve_spoiler_setting(context):
    context.service.set_spoilers(1, 10, 3, False)
    for payload in (
        {"review_text": "Edited"},
        {"review_text": "Edited again", "contains_spoilers": True},
    ):
        response = context.client.put(PATH, json=payload)
        assert response.status_code == 200
        assert response.json()["contains_spoilers"] is False
        assert response.json()["review_text"] == payload["review_text"]
    assert (
        context.client.patch(f"{PATH}/visibility", json={"visibility": "public"}).status_code == 200
    )
    assert context.client.get(PATH).json()["contains_spoilers"] is False
    assert context.client.get("/books/10/reviews").json()[0]["contains_spoilers"] is False


def test_stale_updates_preserve_spoiler_text_and_visibility_fields(context):
    with context.sessions() as db:
        repository = SqlReviewRepository(db)
        stale_text = repository.get(2)
        stale_visibility = repository.get(2)
        stale_spoilers = repository.get(2)
    context.service.set_spoilers(1, 10, 3, False)
    stale_text.revise(ReviewText("Edited"), LATER)
    stale_visibility.set_visibility("public", LATER)
    with context.sessions() as db:
        repository = SqlReviewRepository(db)
        repository.save(stale_text)
        repository.save_visibility(stale_visibility)
        db.commit()
        assert db.get(PageReview, 2).contains_spoilers is False
    stale_spoilers.set_spoilers(True, LATER)
    with context.sessions() as db:
        SqlReviewRepository(db).save_spoilers(stale_spoilers)
        db.commit()
        row = db.get(PageReview, 2)
        assert row.contains_spoilers is True
        assert row.visibility == "public"
        assert row.review_text == "Edited"
        assert row.analysis_revision == 2
        assert row.analysis_status == "pending"


@pytest.mark.parametrize("visibility", ["private", "public"])
def test_other_users_cannot_change_spoiler_setting(context, visibility):
    context.service.set_visibility(1, 10, 3, visibility)
    context.app.dependency_overrides[get_current_user_id] = lambda: 2
    assert (
        context.client.patch(f"{PATH}/spoilers", json={"contains_spoilers": False}).status_code
        == 404
    )
    with context.sessions() as db:
        assert db.get(PageReview, 2).contains_spoilers is True


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"contains_spoilers": None},
        {"contains_spoilers": "false"},
        {"contains_spoilers": 0},
        {"contains_spoilers": 1},
        {"contains_spoilers": False, "visibility": "public"},
    ],
)
def test_invalid_spoiler_settings_rejected(context, payload):
    assert context.client.patch(f"{PATH}/spoilers", json=payload).status_code == 422
    with context.sessions() as db:
        assert db.get(PageReview, 2).contains_spoilers is True


@pytest.mark.parametrize(
    ("path", "status"),
    [
        ("/books/999/pages/3/review/spoilers", 404),
        ("/books/10/pages/99/review/spoilers", 404),
        (f"{PATH}/spoilers?iteration=99", 404),
        ("/books/10/pages/0/review/spoilers", 422),
        (f"{PATH}/spoilers?iteration=0", 422),
    ],
)
def test_missing_or_invalid_spoiler_target(context, path, status):
    assert context.client.patch(path, json={"contains_spoilers": False}).status_code == status
    with context.sessions() as db:
        assert db.scalar(sa.select(sa.func.count()).select_from(PageReview)) == 2


def test_spoiler_setting_requires_authentication(context):
    def unauthenticated():
        raise AuthenticationRequired("Authentication required")

    context.app.dependency_overrides[get_current_user_id] = unauthenticated
    assert (
        context.client.patch(f"{PATH}/spoilers", json={"contains_spoilers": False}).status_code
        == 401
    )


def test_spoiler_migration_preserves_data_and_defaults():
    migration = import_module("backend.infrastructure.migrations.versions.0011_review_spoilers")
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE page_reviews (id INTEGER PRIMARY KEY, review_text TEXT NOT NULL,"
            " visibility VARCHAR(7) NOT NULL DEFAULT 'private')"
        )
        connection.exec_driver_sql(
            "INSERT INTO page_reviews (id, review_text, visibility) "
            "VALUES (1, 'Existing', 'public')"
        )
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert connection.exec_driver_sql(
                "SELECT review_text, visibility, contains_spoilers FROM page_reviews"
            ).one() == ("Existing", "public", 1)
            connection.exec_driver_sql(
                "INSERT INTO page_reviews (id, review_text) VALUES (2, 'New')"
            )
            assert (
                connection.exec_driver_sql(
                    "SELECT contains_spoilers FROM page_reviews WHERE id = 2"
                ).scalar_one()
                == 1
            )
            with pytest.raises(sa.exc.IntegrityError), connection.begin_nested():
                connection.exec_driver_sql(
                    "UPDATE page_reviews SET contains_spoilers = NULL WHERE id = 1"
                )
            migration.downgrade()
            assert connection.exec_driver_sql(
                "SELECT review_text, visibility FROM page_reviews ORDER BY id"
            ).all() == [("Existing", "public"), ("New", "private")]
            migration.upgrade()
    engine.dispose()
