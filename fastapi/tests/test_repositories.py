from unittest.mock import create_autospec

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from backend.application.ports import BookCatalog
from backend.domain.catalog import CatalogBook
from backend.domain.errors import Conflict
from backend.infrastructure.database import Base
from backend.infrastructure.models import Book, User, UserBook
from backend.infrastructure.repositories import SqlReadingRepository


@pytest.fixture
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as session:
        session.add_all(
            [
                User(id=1, name="Reader One", email="one@example.test"),
                User(id=2, name="Reader Two", email="two@example.test"),
            ]
        )
        session.commit()
        yield session


@pytest.fixture
def catalog_book():
    return CatalogBook(
        google_books_id="volume-1",
        title="銀河鉄道の夜",
        author="宮沢賢治",
        total_pages=180,
        isbn_13="9781234567890",
        thumbnail_url="https://example.test/cover.jpg",
    )


def test_catalog_book_is_shared_between_users(db, catalog_book):
    repository = SqlReadingRepository(db)
    first = repository.add_catalog_book(1, catalog_book)
    second = repository.add_catalog_book(2, catalog_book)

    assert first.id == second.id
    assert db.scalar(select(func.count()).select_from(Book)) == 1
    assert db.scalar(select(func.count()).select_from(UserBook)) == 2
    stored_book = db.scalar(select(Book))
    assert stored_book is not None
    assert stored_book.google_books_id == catalog_book.google_books_id
    assert stored_book.title is None
    assert stored_book.author is None
    assert stored_book.total_pages is None


def test_catalog_book_cannot_be_added_twice_to_same_bookshelf(db, catalog_book):
    repository = SqlReadingRepository(db)
    repository.add_catalog_book(1, catalog_book)

    with pytest.raises(Conflict, match="already in the bookshelf"):
        repository.add_catalog_book(1, catalog_book)


def test_catalog_book_metadata_is_resolved_from_google_books(db, catalog_book):
    catalog = create_autospec(BookCatalog, instance=True, spec_set=True)
    catalog.get.return_value = catalog_book
    repository = SqlReadingRepository(db, catalog)
    imported = repository.add_catalog_book(1, catalog_book)

    resolved = repository.get(1, imported.id)

    assert resolved.title == catalog_book.title
    assert resolved.total_pages == catalog_book.total_pages
    assert resolved.isbn_13 == catalog_book.isbn_13
    catalog.get.assert_called_once_with(catalog_book.google_books_id)
