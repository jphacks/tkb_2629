from datetime import UTC, datetime
from unittest.mock import create_autospec

import pytest
from fastapi.testclient import TestClient

from backend.application.services import CatalogService, ReadingService, ReviewService, UserService
from backend.domain.catalog import CatalogBook
from backend.domain.entities import Book, Review, User
from backend.main import create_app
from backend.presentation.auth import get_current_user_id
from backend.presentation.dependencies import (
    get_catalog_service,
    get_reading,
    get_reviews,
    get_users,
)


@pytest.fixture
def user():
    return User(id=1, name="Reader", email="reader@example.test")


@pytest.fixture
def book():
    return Book(
        id=10,
        title="Example",
        author="Writer",
        total_pages=20,
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


@pytest.fixture
def catalog_book():
    return CatalogBook(
        google_books_id="google-volume-1",
        title="Canonical Example",
        author="Catalog Writer",
        total_pages=240,
        isbn_13="9781234567890",
        thumbnail_url="https://example.test/cover.jpg",
    )


@pytest.fixture
def review():
    timestamp = datetime(2026, 1, 1, tzinfo=UTC)
    return Review(
        id=100,
        book_id=10,
        page_number=3,
        review_text="A hopeful passage",
        color_code="#FFCC00",
        created_at=timestamp,
        updated_at=timestamp,
    )


@pytest.fixture
def user_service_mock():
    return create_autospec(UserService, instance=True, spec_set=True)


@pytest.fixture
def reading_service_mock():
    return create_autospec(ReadingService, instance=True, spec_set=True)


@pytest.fixture
def catalog_service_mock():
    return create_autospec(CatalogService, instance=True, spec_set=True)


@pytest.fixture
def review_service_mock():
    return create_autospec(ReviewService, instance=True, spec_set=True)


@pytest.fixture
def client(user_service_mock, catalog_service_mock, reading_service_mock, review_service_mock):
    # A fresh app prevents dependency overrides from leaking between tests.
    app = create_app()
    app.dependency_overrides[get_users] = lambda: user_service_mock
    app.dependency_overrides[get_catalog_service] = lambda: catalog_service_mock
    app.dependency_overrides[get_reading] = lambda: reading_service_mock
    app.dependency_overrides[get_reviews] = lambda: review_service_mock
    app.dependency_overrides[get_current_user_id] = lambda: 1
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
