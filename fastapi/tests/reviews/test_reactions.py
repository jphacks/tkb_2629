from importlib import import_module
from unittest.mock import create_autospec

import pytest
import sqlalchemy as sa
import test_public_reviews
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session

from backend.analysis.infrastructure.models import EmotionAnalysis
from backend.identity.infrastructure.models import User
from backend.library.infrastructure.models import UserBook
from backend.reviews.application.ports import (
    AnalysisGateway,
    PublicAuthorGateway,
    PublicReadingGateway,
)
from backend.reviews.application.public_reviews import PublicReviewService
from backend.reviews.domain.errors import InvalidInput
from backend.reviews.infrastructure.models import PageReview, ReviewReaction
from backend.reviews.infrastructure.reactions import SqlReactionRepository
from backend.reviews.infrastructure.repository import SqlReviewRepository
from backend.shared.application.security import AuthenticationRequired
from backend.shared.presentation.auth import get_current_user_id

context = test_public_reviews.context
BASE = "/catalog/books/volume-1/reviews"
TARGET = f"{BASE}/1"
ZERO = {"empathy": 0, "insight": 0, "curious": 0}


def test_add_replace_remove_are_idempotent_and_only_one_kind_per_user(context):
    client = context.client
    assert client.get(TARGET + "/reactions").json() == {
        "review_id": 1,
        "counts": ZERO,
        "my_reaction": None,
    }
    for kind in ("empathy", "insight", "curious"):
        for _ in range(2):
            response = client.put(TARGET + "/reaction", json={"kind": kind})
            assert response.status_code == 200
            assert response.headers["cache-control"] == "no-store"
            assert response.json() == {
                "review_id": 1,
                "counts": {**ZERO, kind: 1},
                "my_reaction": kind,
            }
            assert client.get(TARGET + "/reactions").json() == response.json()
            with context.sessions() as db:
                assert db.scalar(sa.select(sa.func.count()).select_from(ReviewReaction)) == 1
    for _ in range(2):
        response = client.delete(TARGET + "/reaction")
        assert response.status_code == 200
        assert response.json() == {"review_id": 1, "counts": ZERO, "my_reaction": None}
    with context.sessions() as db:
        assert db.scalar(sa.select(sa.func.count()).select_from(ReviewReaction)) == 0


def test_different_users_own_reviews_and_unnamed_reactors_are_supported(context):
    client = context.client
    # User 5 has neither a shelf entry nor a public display name.
    assert client.put(TARGET + "/reaction", json={"kind": "empathy"}).status_code == 200
    context.app.dependency_overrides[get_current_user_id] = lambda: 1
    response = client.put(TARGET + "/reaction", json={"kind": "empathy"})
    assert response.json() == {
        "review_id": 1,
        "counts": {**ZERO, "empathy": 2},
        "my_reaction": "empathy",
    }
    context.app.dependency_overrides[get_current_user_id] = lambda: 3
    response = client.put(TARGET + "/reaction", json={"kind": "insight"})
    assert response.json()["counts"] == {**ZERO, "empathy": 2, "insight": 1}
    assert response.json()["my_reaction"] == "insight"
    client.delete(TARGET + "/reaction")
    context.app.dependency_overrides[get_current_user_id] = lambda: 5
    payload = client.get(TARGET + "/reactions").json()
    assert payload["my_reaction"] == "empathy"
    assert payload["counts"] == {**ZERO, "empathy": 2}
    # Another review on the same page and a different iteration remains independent.
    assert client.get(f"{BASE}/2/reactions").json()["counts"] == ZERO
    assert "user_id" not in payload
    assert set(payload) == {"review_id", "counts", "my_reaction"}
    assert "Reader" not in str(payload)
    assert "@example.test" not in str(payload)


@pytest.mark.parametrize("review_id", [3, 4, 6, 7, 8, 9999])
def test_ineligible_review_returns_same_404_for_all_operations(context, review_id):
    target = f"{BASE}/{review_id}"
    for response in (
        context.client.get(target + "/reactions"),
        context.client.put(target + "/reaction", json={"kind": "curious"}),
        context.client.delete(target + "/reaction"),
    ):
        assert response.status_code == 404
        assert response.json() == {"detail": "Public review not found"}
    with context.sessions() as db:
        assert db.scalar(sa.select(sa.func.count()).select_from(ReviewReaction)) == 0


def test_unknown_or_wrong_volume_cannot_access_existing_reaction(context):
    context.client.put(TARGET + "/reaction", json={"kind": "curious"})
    for volume in ("unknown", "volume-2"):
        target = f"/catalog/books/{volume}/reviews/1"
        assert context.client.get(target + "/reactions").status_code == 404
        assert context.client.put(target + "/reaction", json={"kind": "empathy"}).status_code == 404
        assert context.client.delete(target + "/reaction").status_code == 404
    assert context.client.get(TARGET + "/reactions").json()["my_reaction"] == "curious"


def test_private_or_unnamed_review_hides_counts_and_preserves_reactions_for_republication(context):
    client = context.client
    client.put(TARGET + "/reaction", json={"kind": "insight"})
    for values, model in [
        ({"visibility": "private"}, PageReview),
        ({"public_display_name": None}, User),
    ]:
        with context.sessions() as db:
            db.execute(sa.update(model).where(model.id == 1).values(**values))
            db.commit()
        assert client.get(TARGET + "/reactions").status_code == 404
        assert client.put(TARGET + "/reaction", json={"kind": "curious"}).status_code == 404
        assert client.delete(TARGET + "/reaction").status_code == 404
        with context.sessions() as db:
            assert db.get(ReviewReaction, (1, 5)).kind == "insight"
            db.execute(
                sa.update(model)
                .where(model.id == 1)
                .values(
                    **(
                        {"visibility": "public"}
                        if model is PageReview
                        else {"public_display_name": "Reader A"}
                    )
                )
            )
            db.commit()
        assert client.get(TARGET + "/reactions").json()["my_reaction"] == "insight"


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"kind": None},
        {"kind": ""},
        {"kind": "like"},
        {"kind": True},
        {"kind": 1},
        {"kind": ["empathy"]},
        {"kind": "empathy", "user_id": 1},
        {"kind": "empathy", "review_id": 2},
    ],
)
def test_reaction_input_is_strict_and_rejects_impersonation(context, body):
    assert context.client.put(TARGET + "/reaction", json=body).status_code == 422
    assert context.client.get(TARGET + "/reactions").json()["counts"] == ZERO


@pytest.mark.parametrize(
    "target",
    [
        "/catalog/books/bad%20id/reviews/1",
        "/catalog/books/volume-1/reviews/0",
        "/catalog/books/volume-1/reviews/-1",
    ],
)
def test_reaction_paths_are_validated(context, target):
    assert context.client.get(target + "/reactions").status_code == 422
    assert context.client.put(target + "/reaction", json={"kind": "empathy"}).status_code == 422
    assert context.client.delete(target + "/reaction").status_code == 422


def test_reactions_require_authentication_for_reads_writes_and_deletes(context):
    def unauthenticated():
        raise AuthenticationRequired("Authentication required")

    context.app.dependency_overrides[get_current_user_id] = unauthenticated
    assert context.client.get(TARGET + "/reactions").status_code == 401
    assert context.client.put(TARGET + "/reaction", json={"kind": "empathy"}).status_code == 401
    assert context.client.delete(TARGET + "/reaction").status_code == 401


def test_reactions_do_not_touch_text_analysis_progress_or_distribution(context):
    client = context.client
    before_list = client.get(BASE).json()
    before_distribution = client.get(BASE + "/distribution").json()
    with context.sessions() as db:
        before = dict(
            db.execute(sa.select(PageReview.__table__).where(PageReview.id == 1)).mappings().one()
        )
        before_progress = db.execute(sa.select(UserBook.__table__)).all()
        before_analysis = db.execute(sa.select(EmotionAnalysis.__table__)).all()
    client.put(TARGET + "/reaction", json={"kind": "empathy"})
    client.put(TARGET + "/reaction", json={"kind": "curious"})
    client.delete(TARGET + "/reaction")
    with context.sessions() as db:
        after = dict(
            db.execute(sa.select(PageReview.__table__).where(PageReview.id == 1)).mappings().one()
        )
        assert db.execute(sa.select(UserBook.__table__)).all() == before_progress
        assert db.execute(sa.select(EmotionAnalysis.__table__)).all() == before_analysis
    assert before == after
    assert client.get(BASE).json() == before_list
    assert client.get(BASE + "/distribution").json() == before_distribution
    context.catalog.get.assert_not_called()
    context.catalog.search.assert_not_called()


def test_text_edits_preserve_existing_reaction(context):
    context.client.put(TARGET + "/reaction", json={"kind": "curious"})
    with context.sessions() as db:
        db.execute(
            sa.update(PageReview)
            .where(PageReview.id == 1)
            .values(review_text="Edited", analysis_revision=2, analysis_status="pending")
        )
        db.commit()
    assert context.client.get(TARGET + "/reactions").json()["my_reaction"] == "curious"


@pytest.mark.parametrize("method", ["set", "summary"])
def test_reaction_failures_are_503_and_writes_are_rolled_back(context, monkeypatch, method):
    context.client.put(TARGET + "/reaction", json={"kind": "empathy"})

    def unavailable(*args, **kwargs):
        raise sa.exc.OperationalError("test query", {}, RuntimeError("test outage"))

    monkeypatch.setattr(SqlReactionRepository, method, unavailable)
    response = context.client.put(TARGET + "/reaction", json={"kind": "curious"})
    assert response.status_code == 503
    assert response.json() == {"detail": "Database operation failed"}
    with context.sessions() as db:
        assert db.get(ReviewReaction, (1, 5)).kind == "empathy"
    assert context.client.delete(TARGET + "/reaction").status_code == 503
    if method == "summary":
        assert context.client.get(TARGET + "/reactions").status_code == 503


def test_writers_lock_parent_review_before_adding_or_removing_reactions(context, monkeypatch):
    calls = []
    original = SqlReviewRepository.get

    def record(self, review_id, *, lock=False):
        calls.append(lock)
        return original(self, review_id, lock=lock)

    monkeypatch.setattr(SqlReviewRepository, "get", record)
    context.client.put(TARGET + "/reaction", json={"kind": "empathy"})
    context.client.delete(TARGET + "/reaction")
    context.client.get(TARGET + "/reactions")
    assert calls == [True, True, False]
    db = create_autospec(Session, instance=True)
    db.scalar.return_value = None
    repository = SqlReviewRepository(db)
    repository.get(1, lock=True)
    statement = db.scalar.call_args.args[0]
    assert "FOR UPDATE" in str(statement.compile(dialect=postgresql.dialect()))
    repository.get(1)
    statement = db.scalar.call_args.args[0]
    assert "FOR UPDATE" not in str(statement.compile(dialect=postgresql.dialect()))


def test_failed_commit_does_not_report_success_or_leave_changes(context, monkeypatch):
    context.client.put(TARGET + "/reaction", json={"kind": "empathy"})

    def unavailable(self):
        raise sa.exc.OperationalError("test commit", {}, RuntimeError("test outage"))

    monkeypatch.setattr(context.sessions.class_, "commit", unavailable)
    assert context.client.put(TARGET + "/reaction", json={"kind": "curious"}).status_code == 503
    assert context.client.delete(TARGET + "/reaction").status_code == 503
    assert context.client.get(TARGET + "/reactions").json() == {
        "review_id": 1,
        "counts": {**ZERO, "empathy": 1},
        "my_reaction": "empathy",
    }


def test_service_rejects_invalid_direct_calls_before_io():
    readings = create_autospec(PublicReadingGateway, instance=True)
    service = PublicReviewService(
        lambda: None,
        readings,
        create_autospec(PublicAuthorGateway, instance=True),
        create_autospec(AnalysisGateway, instance=True),
    )
    with pytest.raises(InvalidInput):
        service.react("volume", 1, 1, "invalid")
    with pytest.raises(InvalidInput):
        service.reaction_summary("volume", 0, 1)
    readings.catalog_readings.assert_not_called()


def test_reaction_migration_constraints_cascades_and_round_trip():
    migration = import_module("backend.infrastructure.migrations.versions.0013_review_reactions")
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        connection.exec_driver_sql("CREATE TABLE users (id INTEGER PRIMARY KEY)")
        connection.exec_driver_sql("CREATE TABLE page_reviews (id INTEGER PRIMARY KEY)")
        connection.exec_driver_sql("INSERT INTO users VALUES (1), (2)")
        connection.exec_driver_sql("INSERT INTO page_reviews VALUES (1), (2)")
        connection.commit()
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert sa.inspect(connection).get_indexes("review_reactions") == [
                {
                    "name": "ix_review_reactions_user_id",
                    "column_names": ["user_id"],
                    "unique": 0,
                    "dialect_options": {},
                }
            ]
            assert connection.exec_driver_sql("SELECT count(*) FROM review_reactions").scalar() == 0
            connection.exec_driver_sql("INSERT INTO review_reactions VALUES (1, 1, 'empathy')")
            connection.commit()
            for sql in [
                "INSERT INTO review_reactions VALUES (1, 1, 'insight')",
                "INSERT INTO review_reactions VALUES (2, 2, 'invalid')",
                "INSERT INTO review_reactions VALUES (2, 2, NULL)",
                "INSERT INTO review_reactions VALUES (99, 2, 'curious')",
                "INSERT INTO review_reactions VALUES (2, 99, 'curious')",
            ]:
                with pytest.raises(sa.exc.IntegrityError):
                    with connection.begin_nested():
                        connection.exec_driver_sql(sql)
            connection.exec_driver_sql("DELETE FROM page_reviews WHERE id=1")
            assert connection.exec_driver_sql("SELECT count(*) FROM review_reactions").scalar() == 0
            connection.exec_driver_sql("INSERT INTO review_reactions VALUES (2, 2, 'insight')")
            connection.exec_driver_sql("DELETE FROM users WHERE id=2")
            assert connection.exec_driver_sql("SELECT count(*) FROM review_reactions").scalar() == 0
            migration.downgrade()
            assert not sa.inspect(connection).has_table("review_reactions")
            assert connection.exec_driver_sql("SELECT count(*) FROM page_reviews").scalar() == 1
            migration.upgrade()
            assert connection.exec_driver_sql("SELECT count(*) FROM review_reactions").scalar() == 0
    engine.dispose()
