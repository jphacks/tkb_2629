from unittest.mock import create_autospec

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from backend.application.ports import BookCatalog
from backend.domain.catalog import CatalogBook
from backend.domain.emotions import EmotionResult
from backend.domain.errors import Conflict, NotFound
from backend.infrastructure.database import Base
from backend.infrastructure.models import Book, User, UserBook
from backend.infrastructure.repositories import SqlReadingRepository, SqlReviewRepository


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


def test_review_list_is_scoped_ordered_paginated_and_uses_current_analysis(db):
    readings = SqlReadingRepository(db)
    reviews = SqlReviewRepository(db)
    first = readings.add(1, "First", None, 180, None)
    second = readings.add(1, "Second", None, 180, None)
    readings.add(2, "First", None, 180, first.id)
    later = reviews.save_text(1, first.id, 42, "Joy", 1)
    result = EmotionResult(
        emotion_label="joy",
        color_code="#F0CC20",
        confidence=0.8,
        model_version="test",
        source="jev",
    )
    reviews.complete(later.review_id, later.revision, result)
    reviews.save_text(1, first.id, 3, "Pending", 1)
    reviews.save_text(2, first.id, 7, "Other user", 1)
    reviews.save_text(1, second.id, 5, "Other book", 1)
    listed = reviews.list(1, first.id, None, 100, 0)
    assert [item.page_number for item in listed] == [3, 42]
    assert listed[0].analysis_status == "pending"
    assert listed[0].source is None
    assert listed[1].color_code == "#F0CC20"
    assert listed[1].source == "jev"
    assert reviews.get(1, first.id, 42, 1) == listed[1]
    assert [item.page_number for item in reviews.list(1, first.id, 1, 1, 1)] == [42]
    revised = reviews.save_text(1, first.id, 42, "Changed", 1)
    pending = reviews.list(1, first.id, 1, 100, 0)[1]
    assert pending.color_code == "#808080"
    assert pending.source is None
    reviews.fail(revised.review_id, revised.revision)
    assert reviews.list(1, first.id, 1, 100, 0)[1].analysis_status == "failed"
    readings.complete_iteration(1, first.id, 1, 180)
    readings.start_iteration(1, first.id)
    assert reviews.list(1, first.id, None, 100, 0) == []
    assert len(reviews.list(1, first.id, 1, 100, 0)) == 2
    with pytest.raises(NotFound):
        reviews.list(2, second.id, None, 100, 0)


def test_catalog_book_cannot_be_added_twice_to_same_bookshelf(db, catalog_book):
    repository = SqlReadingRepository(db)
    repository.add_catalog_book(1, catalog_book)

    with pytest.raises(Conflict, match="already in the bookshelf"):
        repository.add_catalog_book(1, catalog_book)


def test_completed_book_can_start_next_iteration(db, catalog_book):
    repository = SqlReadingRepository(db)
    imported = repository.add_catalog_book(1, catalog_book)

    with pytest.raises(Conflict, match="Complete the current reading"):
        repository.start_iteration(1, imported.id)

    completed = repository.complete_iteration(1, imported.id, 1, catalog_book.total_pages)
    second = repository.start_iteration(1, imported.id)

    assert completed.status == "completed"
    assert completed.current_page == catalog_book.total_pages
    assert second.iteration_number == 2
    assert second.status == "reading"
    assert [item.iteration_number for item in repository.list_iterations(1, imported.id)] == [1, 2]


def test_page_popularity_uses_each_users_latest_iteration(db, catalog_book):
    readings = SqlReadingRepository(db)
    reviews = SqlReviewRepository(db)
    first_user_book = readings.add_catalog_book(1, catalog_book)
    second_user_book = readings.add_catalog_book(2, catalog_book)

    reviews.save_text(1, first_user_book.id, 10, "first reading", 1)
    reviews.save_text(1, first_user_book.id, 20, "first reading", 1)
    readings.complete_iteration(1, first_user_book.id, 1, catalog_book.total_pages)
    readings.start_iteration(1, first_user_book.id)
    reviews.save_text(1, first_user_book.id, 20, "second reading", 2)
    reviews.save_text(1, first_user_book.id, 30, "second reading", 2)

    reviews.save_text(2, second_user_book.id, 10, "other reader", 1)
    reviews.save_text(2, second_user_book.id, 20, "other reader", 1)

    points = readings.page_popularity(1, first_user_book.id)

    assert [(point.page_number, point.user_count) for point in points] == [
        (10, 1),
        (20, 2),
        (30, 1),
    ]


def test_completed_iteration_reviews_are_read_only(db, catalog_book):
    readings = SqlReadingRepository(db)
    reviews = SqlReviewRepository(db)
    imported = readings.add_catalog_book(1, catalog_book)
    reviews.save_text(1, imported.id, 10, "finished", 1)
    readings.complete_iteration(1, imported.id, 1, catalog_book.total_pages)

    with pytest.raises(Conflict, match="completed"):
        reviews.save_text(1, imported.id, 10, "changed", 1)


def test_review_can_be_read_from_a_selected_iteration(db, catalog_book):
    readings = SqlReadingRepository(db)
    reviews = SqlReviewRepository(db)
    imported = readings.add_catalog_book(1, catalog_book)
    reviews.save_text(1, imported.id, 10, "first reading", 1)
    readings.complete_iteration(1, imported.id, 1, catalog_book.total_pages)
    readings.start_iteration(1, imported.id)
    reviews.save_text(1, imported.id, 10, "second reading", 2)

    first = reviews.get(1, imported.id, 10, 1)
    latest = reviews.get(1, imported.id, 10, None)

    assert (first.iteration_number, first.review_text) == (1, "first reading")
    assert (latest.iteration_number, latest.review_text) == (2, "second reading")


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
