from unittest.mock import create_autospec

import pytest
import sqlalchemy as sa
import test_visibility

from backend.library.application.errors import ExternalServiceError
from backend.library.application.ports import BookCatalog
from backend.library.application.service import LibraryService
from backend.library.domain.catalog import CatalogBook
from backend.library.domain.errors import InvalidInput
from backend.library.infrastructure.models import Book, UserBook
from backend.library.infrastructure.repository import SqlBookRepository
from backend.library.infrastructure.unit_of_work import SqlLibraryUnitOfWork
from backend.library.presentation.dependencies import get_library_service
from backend.shared.application.security import AuthenticationRequired
from backend.shared.presentation.auth import get_current_user_id

context = test_visibility.context
PATH = "/catalog/books/popular"


@pytest.fixture
def popular(context):
    catalog = create_autospec(BookCatalog, instance=True)
    catalog.get.side_effect = lambda key: CatalogBook(key, f"Title {key}", None, 100, None, None)
    library = LibraryService(
        lambda: SqlLibraryUnitOfWork(context.sessions), catalog, context.service.clock
    )
    context.app.dependency_overrides[get_library_service] = lambda: library
    context.library = library
    context.catalog = catalog
    return context


def seed(popular):
    with popular.sessions() as db:
        db.get(Book, 10).google_books_id = "volume-10"
        for number in range(20, 27):
            db.add(Book(id=number, google_books_id=f"volume-{number}"))
        db.add(Book(id=30, google_books_id="no-readers"))
        db.flush()
        for number in range(20, 27):
            db.add(
                UserBook(
                    user_id=1,
                    book_id=number,
                    iteration_number=1,
                    status="completed" if number == 21 else "reading",
                    completed_at=test_visibility.NOW if number == 21 else None,
                )
            )
        db.commit()


def test_empty_does_not_expose_manual_books_or_request_catalog(popular):
    response = popular.client.get(PATH)
    assert response.status_code == 200
    assert response.json() == {"items": [], "limit": 5}
    assert response.headers["cache-control"] == "no-store"
    popular.catalog.get.assert_not_called()


def test_counts_distinct_readers_including_rereads_and_completed_and_limits_metadata(popular):
    seed(popular)
    response = popular.client.get(PATH)
    assert response.status_code == 200
    payload = response.json()
    assert payload["limit"] == 5
    assert [item["book"]["google_books_id"] for item in payload["items"]] == [
        "volume-10",
        "volume-20",
        "volume-21",
        "volume-22",
        "volume-23",
    ]
    assert [item["reader_count"] for item in payload["items"]] == [2, 1, 1, 1, 1]
    assert popular.catalog.get.call_count == 5
    assert set(payload["items"][0]) == {"book", "reader_count"}
    assert set(payload["items"][0]["book"]) == {
        "google_books_id",
        "title",
        "author",
        "total_pages",
        "isbn_13",
        "thumbnail_url",
    }
    # The same aggregate is returned regardless of the requesting reader.
    popular.app.dependency_overrides[get_current_user_id] = lambda: 2
    assert popular.client.get(PATH).json() == payload
    assert len(popular.client.get(PATH + "?limit=20").json()["items"]) == 8


def test_deterministic_ties_and_rank_changes_with_new_readers(popular):
    seed(popular)
    with popular.sessions() as db:
        db.add(UserBook(user_id=2, book_id=26, iteration_number=1))
        db.commit()
    items = popular.client.get(PATH + "?limit=2").json()["items"]
    assert [item["book"]["google_books_id"] for item in items] == ["volume-10", "volume-26"]
    assert [item["reader_count"] for item in items] == [2, 2]


@pytest.mark.parametrize("limit", ["0", "-1", "21", "abc", "1.5"])
def test_limits(popular, limit):
    assert popular.client.get(PATH + f"?limit={limit}").status_code == 422
    popular.catalog.get.assert_not_called()


def test_authentication(popular):
    def unauthenticated():
        raise AuthenticationRequired("Authentication required")

    popular.app.dependency_overrides[get_current_user_id] = unauthenticated
    assert popular.client.get(PATH).status_code == 401
    popular.catalog.get.assert_not_called()


def test_service_validates_limit_before_query(popular):
    for limit in (0, 21):
        with pytest.raises(InvalidInput):
            popular.library.popular(limit)


def test_catalog_failure_is_explicit_not_a_fake_or_partial_ranking(popular):
    seed(popular)
    popular.catalog.get.side_effect = ExternalServiceError("catalog unavailable")
    assert popular.client.get(PATH).status_code == 502


def test_database_failure_is_explicit(popular, monkeypatch):
    def unavailable(*args):
        raise sa.exc.OperationalError("read", {}, RuntimeError("outage"))

    monkeypatch.setattr(SqlBookRepository, "list_popular", unavailable)
    assert popular.client.get(PATH).status_code == 503
