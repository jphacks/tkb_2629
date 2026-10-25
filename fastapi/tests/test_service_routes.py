import pytest

from backend.application.results import ReviewSaveResult
from backend.domain.entities import PagePopularity, ReadingIteration
from backend.domain.errors import Conflict, InvalidInput, NotFound
from backend.presentation.auth import get_current_user_id


def test_create_user(client, user_service_mock, user):
    user_service_mock.create.return_value = user
    response = client.post("/users", json={"name": user.name, "email": user.email})
    assert response.status_code == 200
    assert response.json() == {"id": 1, "name": user.name, "email": user.email}
    user_service_mock.create.assert_called_once_with(user.name, user.email)


def test_list_users(client, user_service_mock, user):
    user_service_mock.list.return_value = [user]
    response = client.get("/users")
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [1]
    user_service_mock.list.assert_called_once_with()


def test_get_user(client, user_service_mock, user):
    user_service_mock.get.return_value = user
    response = client.get("/users/1")
    assert response.status_code == 200
    assert response.json()["email"] == user.email
    user_service_mock.get.assert_called_once_with(1)


def test_update_user(client, user_service_mock, user):
    user_service_mock.update.return_value = user
    response = client.put("/users/1", json={"name": user.name, "email": user.email})
    assert response.status_code == 200
    assert response.json()["name"] == user.name
    user_service_mock.update.assert_called_once_with(1, user.name, user.email)


def test_delete_user(client, user_service_mock):
    response = client.delete("/users/1")
    assert response.status_code == 204
    assert response.content == b""
    user_service_mock.delete.assert_called_once_with(1)


@pytest.mark.parametrize("book_id", [None, 10])
def test_register_book(client, reading_service_mock, book, book_id):
    reading_service_mock.register.return_value = book
    response = client.post(
        "/books",
        json={
            "book_id": book_id,
            "title": book.title,
            "author": book.author,
            "total_pages": book.total_pages,
        },
    )
    assert response.status_code == 201
    assert response.json()["id"] == book.id
    reading_service_mock.register.assert_called_once_with(
        1,
        book.title,
        book.author,
        book.total_pages,
        book_id,
    )


def test_import_google_book(client, reading_service_mock, book):
    reading_service_mock.import_catalog_book.return_value = book
    response = client.post("/books/import", json={"google_books_id": "google-volume-1"})
    assert response.status_code == 201
    assert response.json()["id"] == book.id
    reading_service_mock.import_catalog_book.assert_called_once_with(1, "google-volume-1")


def test_list_books(client, reading_service_mock, book):
    reading_service_mock.list.return_value = [book]
    response = client.get("/books?limit=5&offset=2")
    assert response.status_code == 200
    assert response.json()["limit"] == 5
    assert response.json()["offset"] == 2
    assert [item["id"] for item in response.json()["items"]] == [10]
    reading_service_mock.list.assert_called_once_with(1, 5, 2)


def test_get_book(client, reading_service_mock, book):
    reading_service_mock.get.return_value = book
    response = client.get("/books/10")
    assert response.status_code == 200
    assert response.json()["title"] == book.title
    reading_service_mock.get.assert_called_once_with(1, 10)


def test_list_reading_iterations(client, reading_service_mock):
    reading_service_mock.list_iterations.return_value = [
        ReadingIteration(
            iteration_number=1,
            status="completed",
            current_page=20,
            started_at="2026-01-01T00:00:00Z",
            completed_at="2026-01-02T00:00:00Z",
        )
    ]
    response = client.get("/books/10/iterations")
    assert response.status_code == 200
    assert response.json()[0]["iteration_number"] == 1
    reading_service_mock.list_iterations.assert_called_once_with(1, 10)


def test_start_reading_iteration(client, reading_service_mock):
    reading_service_mock.start_iteration.return_value = ReadingIteration(
        iteration_number=2,
        status="reading",
        current_page=0,
        started_at="2026-01-03T00:00:00Z",
        completed_at=None,
    )
    response = client.post("/books/10/iterations")
    assert response.status_code == 201
    assert response.json()["iteration_number"] == 2
    reading_service_mock.start_iteration.assert_called_once_with(1, 10)


def test_complete_reading_iteration(client, reading_service_mock):
    reading_service_mock.complete_iteration.return_value = ReadingIteration(
        iteration_number=2,
        status="completed",
        current_page=20,
        started_at="2026-01-03T00:00:00Z",
        completed_at="2026-01-04T00:00:00Z",
    )
    response = client.post("/books/10/iterations/2/complete")
    assert response.status_code == 200
    assert response.json()["status"] == "completed"
    reading_service_mock.complete_iteration.assert_called_once_with(1, 10, 2)


def test_page_popularity(client, reading_service_mock):
    reading_service_mock.page_popularity.return_value = [
        PagePopularity(page_number=12, user_count=3)
    ]
    response = client.get("/books/10/page-popularity")
    assert response.status_code == 200
    assert response.json() == {"items": [{"page_number": 12, "user_count": 3}]}
    reading_service_mock.page_popularity.assert_called_once_with(1, 10)


def test_get_review(client, review_service_mock, review):
    review_service_mock.get.return_value = review
    response = client.get("/books/10/pages/3/review")
    assert response.status_code == 200
    assert response.json()["color_code"] == review.color_code
    assert response.json()["iteration_number"] == 1
    review_service_mock.get.assert_called_once_with(1, 10, 3, None)


@pytest.mark.parametrize(("created", "status_code"), [(True, 201), (False, 200)])
def test_save_review(client, review_service_mock, review, created, status_code):
    review_service_mock.save.return_value = ReviewSaveResult(review, created)
    response = client.put(
        "/books/10/pages/3/review",
        json={"review_text": "  A hopeful passage  "},
    )
    assert response.status_code == status_code
    assert response.json()["review_text"] == review.review_text
    assert response.json()["color_code"] == review.color_code
    review_service_mock.save.assert_called_once_with(1, 10, 3, "A hopeful passage", None)


def test_save_review_for_selected_iteration(client, review_service_mock, review):
    review_service_mock.save.return_value = ReviewSaveResult(review, False)
    response = client.put(
        "/books/10/pages/3/review?iteration=2",
        json={"review_text": "Second reading"},
    )
    assert response.status_code == 200
    review_service_mock.save.assert_called_once_with(1, 10, 3, "Second reading", 2)


@pytest.mark.parametrize(
    ("error", "status_code"),
    [
        (NotFound("missing"), 404),
        (Conflict("duplicate"), 409),
        (InvalidInput("invalid"), 422),
    ],
)
def test_domain_errors_are_translated(client, user_service_mock, error, status_code):
    user_service_mock.get.side_effect = error
    response = client.get("/users/1")
    assert response.status_code == status_code
    assert response.json() == {"detail": str(error)}


@pytest.mark.parametrize("text", ["", "   ", "x" * 141])
def test_invalid_review_does_not_call_service(client, review_service_mock, text):
    response = client.put("/books/10/pages/3/review", json={"review_text": text})
    assert response.status_code == 422
    review_service_mock.save.assert_not_called()


def test_invalid_page_does_not_call_service(client, review_service_mock):
    assert client.get("/books/10/pages/0/review").status_code == 422
    review_service_mock.get.assert_not_called()


def test_missing_auth_does_not_call_service(client, reading_service_mock):
    client.app.dependency_overrides.pop(get_current_user_id)
    assert client.get("/books").status_code == 401
    reading_service_mock.list.assert_not_called()


def test_fetch_searches_google_books(client, catalog_service_mock, catalog_book):
    catalog_service_mock.search.return_value = [catalog_book]
    response = client.get("/fetch?query=%E9%8A%80%E6%B2%B3%E9%89%84%E9%81%93&limit=5")
    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "google_books_id": catalog_book.google_books_id,
                "title": catalog_book.title,
                "author": catalog_book.author,
                "total_pages": catalog_book.total_pages,
                "isbn_13": catalog_book.isbn_13,
                "thumbnail_url": catalog_book.thumbnail_url,
            }
        ]
    }
    catalog_service_mock.search.assert_called_once_with("銀河鉄道", 5)
