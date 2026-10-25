from importlib import import_module

import pytest
import sqlalchemy as sa
import test_book_memos
from alembic.migration import MigrationContext
from alembic.operations import Operations

from backend.library.domain.errors import InvalidInput
from backend.library.domain.values import CoverStyle
from backend.library.infrastructure.models import BookCoverStyle
from backend.shared.application.security import AuthenticationRequired
from backend.shared.presentation.auth import get_current_user_id

context = test_book_memos.context
memo = test_book_memos.memo
PATH = "/books/10/cover"
AUTO = {"color_mode": "auto", "palette": None, "pattern": None}


def test_default_and_every_palette_and_pattern_persist_and_appear_in_all_book_views(memo):
    assert memo.client.get("/books/10").json()["cover_style"] == AUTO
    for palette in range(8):
        for pattern in range(4):
            style = {"color_mode": "palette", "palette": palette, "pattern": pattern}
            response = memo.client.put(PATH, json=style)
            assert response.status_code == 200
            assert response.headers["cache-control"] == "no-store"
            assert response.json() == style
            assert memo.client.get("/books/10").json()["cover_style"] == style
            assert memo.client.get("/books").json()["items"][0]["cover_style"] == style
            assert (
                memo.client.get("/books/continue-reading").json()["items"][0]["cover_style"]
                == style
            )


def test_isolation_rereads_memo_independence_and_auto_reset(memo):
    style = {"color_mode": "palette", "palette": 7, "pattern": 3}
    memo.client.put("/books/10/memo", json={"content": "private note"})
    memo.client.put(PATH, json=style)
    memo.app.dependency_overrides[get_current_user_id] = lambda: 2
    assert memo.client.get("/books/10").json()["cover_style"] == AUTO
    memo.client.put(PATH, json={"color_mode": "others", "pattern": 0})
    memo.app.dependency_overrides[get_current_user_id] = lambda: 1
    assert memo.client.get("/books/10").json()["cover_style"] == style
    memo.library.complete_iteration(1, 10, 2)
    memo.library.start_iteration(1, 10)
    assert memo.client.get("/books/10").json()["cover_style"] == style
    assert memo.client.get("/books/10/memo").json()["content"] == "private note"
    assert memo.client.put(PATH, json=AUTO).json() == AUTO
    with memo.sessions() as db:
        assert db.get(BookCoverStyle, (1, 10)) is None
        assert db.get(BookCoverStyle, (2, 10)).color_mode == "others"


@pytest.mark.parametrize("mode", ["mine", "others"])
def test_emotion_preference_stores_source_not_a_stale_color_snapshot(memo, mode):
    response = memo.client.put(PATH, json={"color_mode": mode, "pattern": 1})
    assert response.status_code == 200
    assert response.json() == {"color_mode": mode, "palette": None, "pattern": 1}
    assert memo.client.get("/books/10").json()["cover_style"]["color_mode"] == mode
    memo.analyses.analyze.assert_not_called()


@pytest.mark.parametrize(
    "style",
    [
        {"color_mode": "unknown"},
        {"color_mode": "palette"},
        {"color_mode": "palette", "palette": -1},
        {"color_mode": "palette", "palette": 8},
        {"color_mode": "palette", "palette": True},
        {"color_mode": "palette", "palette": "1"},
        {"color_mode": "mine", "palette": 1},
        {"color_mode": "auto", "pattern": 4},
        {"color_mode": "auto", "pattern": -1},
        {"color_mode": "auto", "pattern": True},
    ],
)
def test_invalid_settings_never_overwrite_saved_preference(memo, style):
    memo.client.put(PATH, json={"color_mode": "palette", "palette": 2})
    assert memo.client.put(PATH, json=style).status_code in (400, 422)
    assert memo.client.get("/books/10").json()["cover_style"]["palette"] == 2


def test_owner_and_auth_required(memo):
    assert memo.client.put("/books/999/cover", json=AUTO).status_code == 404
    memo.app.dependency_overrides[get_current_user_id] = lambda: 99
    assert memo.client.put(PATH, json=AUTO).status_code == 404

    def unauthenticated():
        raise AuthenticationRequired("Authentication required")

    memo.app.dependency_overrides[get_current_user_id] = unauthenticated
    assert memo.client.put(PATH, json=AUTO).status_code == 401


def test_domain_validates_cross_field_constraints():
    for args in [("palette", None, None), ("mine", 1, None), ("auto", None, 4)]:
        with pytest.raises(InvalidInput):
            CoverStyle(*args)


def test_migration_and_constraints_round_trip():
    migration = import_module("backend.infrastructure.migrations.versions.0016_book_cover_styles")
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        connection.exec_driver_sql("CREATE TABLE users (id INTEGER PRIMARY KEY)")
        connection.exec_driver_sql("CREATE TABLE books (id INTEGER PRIMARY KEY)")
        connection.exec_driver_sql("INSERT INTO users VALUES (1)")
        connection.exec_driver_sql("INSERT INTO books VALUES (10)")
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            connection.exec_driver_sql(
                "INSERT INTO book_cover_styles VALUES (1, 10, 'palette', 7, 3)"
            )
            for update in [
                "color_mode='bad'",
                "palette=8",
                "palette=NULL",
                "pattern=4",
                "color_mode='mine', palette=1",
            ]:
                with pytest.raises(sa.exc.IntegrityError), connection.begin_nested():
                    connection.exec_driver_sql(f"UPDATE book_cover_styles SET {update}")
            connection.exec_driver_sql("DELETE FROM books WHERE id=10")
            assert (
                connection.exec_driver_sql("SELECT count(*) FROM book_cover_styles").scalar() == 0
            )
            migration.downgrade()
            assert "book_cover_styles" not in sa.inspect(connection).get_table_names()
            migration.upgrade()
    engine.dispose()
