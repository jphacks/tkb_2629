from importlib import import_module
from unittest.mock import create_autospec

import pytest
import sqlalchemy as sa
import test_visibility
from alembic.migration import MigrationContext
from alembic.operations import Operations

from backend.library.application.ports import BookCatalog
from backend.library.application.service import LibraryService
from backend.library.domain.errors import InvalidInput
from backend.library.infrastructure.models import Book, BookMemo, UserBook
from backend.library.infrastructure.unit_of_work import SqlLibraryUnitOfWork
from backend.library.presentation.dependencies import get_library_service
from backend.shared.application.security import AuthenticationRequired
from backend.shared.presentation.auth import get_current_user_id

context = test_visibility.context
PATH = "/books/10/memo"


@pytest.fixture
def memo(context):
    context.catalog = create_autospec(BookCatalog, instance=True)
    context.library = LibraryService(
        lambda: SqlLibraryUnitOfWork(context.sessions), context.catalog, context.service.clock
    )
    context.app.dependency_overrides[get_library_service] = lambda: context.library
    return context


def test_empty_create_update_delete_and_reload(memo):
    response = memo.client.get(PATH)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"book_id": 10, "content": ""}
    for content in (" 気になること。\n二行目、😀 ", "書き直したメモ", ""):
        saved = memo.client.put(PATH, json={"content": content})
        assert saved.status_code == 200
        assert saved.headers["cache-control"] == "no-store"
        assert saved.json() == {"book_id": 10, "content": content}
        assert memo.client.get(PATH).json() == saved.json()
        with memo.sessions() as db:
            row = db.get(BookMemo, (1, 10))
            assert (row.content if row else "") == content
    with memo.sessions() as db:
        assert db.get(BookMemo, (1, 10)) is None
    memo.catalog.get.assert_not_called()
    memo.analyses.analyze.assert_not_called()


def test_isolated_by_user_and_book_and_not_in_public_or_shelf_data(memo):
    memo.client.put(PATH, json={"content": "private one"})
    memo.app.dependency_overrides[get_current_user_id] = lambda: 2
    assert memo.client.get(PATH).json()["content"] == ""
    memo.client.put(PATH, json={"content": "private two"})
    with memo.sessions() as db:
        db.add(Book(id=20, title="Another", total_pages=50))
        db.flush()
        db.add(UserBook(user_id=2, book_id=20))
        db.commit()
    assert memo.client.get("/books/20/memo").json()["content"] == ""
    assert memo.client.get(PATH).json()["content"] == "private two"
    memo.app.dependency_overrides[get_current_user_id] = lambda: 1
    assert memo.client.get(PATH).json()["content"] == "private one"
    assert "private one" not in memo.client.get("/books").text
    assert "memo" not in memo.client.get("/books/10").json()
    with memo.sessions() as db:
        assert db.get(UserBook, 2).current_page == 3
    assert "private one" not in memo.client.get("/books/10/reviews").text


@pytest.mark.parametrize("book_id", [20, 999])
def test_unowned_or_missing_book_is_not_accessible(memo, book_id):
    with memo.sessions() as db:
        db.add(Book(id=20, title="Unowned", total_pages=50))
        db.commit()
    assert memo.client.get(f"/books/{book_id}/memo").status_code == 404
    assert memo.client.put(f"/books/{book_id}/memo", json={"content": "no"}).status_code == 404
    with memo.sessions() as db:
        assert db.get(BookMemo, (1, book_id)) is None


def test_completed_and_new_iterations_share_the_same_memo(memo):
    memo.client.put(PATH, json={"content": "keep across rereads"})
    memo.library.complete_iteration(1, 10, 2)
    assert memo.client.put(PATH, json={"content": "after completion"}).status_code == 200
    memo.library.start_iteration(1, 10)
    assert memo.client.get(PATH).json()["content"] == "after completion"


def test_unicode_limit_and_validation_keep_saved_content(memo):
    content = "😀" * 10_000
    assert memo.client.put(PATH, json={"content": content}).status_code == 200
    for payload in ({}, {"content": None}, {"content": 1}, {"content": content + "a"}):
        assert memo.client.put(PATH, json=payload).status_code == 422
    assert memo.client.get(PATH).json()["content"] == content
    with pytest.raises(InvalidInput):
        memo.library.save_memo(1, 10, content + "a")


def test_authentication_required_for_both_endpoints(memo):
    def unauthenticated():
        raise AuthenticationRequired("Authentication required")

    memo.app.dependency_overrides[get_current_user_id] = unauthenticated
    assert memo.client.get(PATH).status_code == 401
    assert memo.client.put(PATH, json={"content": "no"}).status_code == 401


def test_migration_round_trip_and_constraints():
    migration = import_module("backend.infrastructure.migrations.versions.0015_book_memos")
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys=ON")
        connection.exec_driver_sql("CREATE TABLE users (id INTEGER PRIMARY KEY)")
        connection.exec_driver_sql("CREATE TABLE books (id INTEGER PRIMARY KEY)")
        connection.exec_driver_sql("INSERT INTO users VALUES (1)")
        connection.exec_driver_sql("INSERT INTO books VALUES (10)")
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            connection.exec_driver_sql("INSERT INTO book_memos VALUES (1, 10, 'original')")
            with pytest.raises(sa.exc.IntegrityError), connection.begin_nested():
                connection.exec_driver_sql("INSERT INTO book_memos VALUES (1, 10, 'duplicate')")
            with pytest.raises(sa.exc.IntegrityError), connection.begin_nested():
                connection.exec_driver_sql("UPDATE book_memos SET content = ?", ("a" * 10001,))
            connection.exec_driver_sql("DELETE FROM users WHERE id = 1")
            assert connection.exec_driver_sql("SELECT count(*) FROM book_memos").scalar() == 0
            migration.downgrade()
            assert "book_memos" not in sa.inspect(connection).get_table_names()
            migration.upgrade()
    engine.dispose()
