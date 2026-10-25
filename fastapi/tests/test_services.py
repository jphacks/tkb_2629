from unittest.mock import Mock, call, create_autospec

import pytest

from backend.application.ports import (
    BookCatalog,
    ReadingRepository,
    ReviewRepository,
    UserRepository,
)
from backend.application.results import ReviewTextSaveResult
from backend.application.services import CatalogService, ReadingService, ReviewService, UserService
from backend.domain.emotions import EmotionAnalyzer, EmotionResult
from backend.domain.entities import PagePopularity, ReadingIteration
from backend.domain.errors import InvalidInput, NotFound


@pytest.fixture
def users_repo():
    return create_autospec(UserRepository, instance=True, spec_set=True)


@pytest.fixture
def books_repo(book):
    repository = create_autospec(ReadingRepository, instance=True, spec_set=True)
    repository.get.return_value = book
    return repository


@pytest.fixture
def reviews_repo(review):
    repository = create_autospec(ReviewRepository, instance=True, spec_set=True)
    repository.get.return_value = review
    repository.save_text.return_value = ReviewTextSaveResult(100, 2, False)
    return repository


@pytest.fixture
def analyzer():
    mock = create_autospec(EmotionAnalyzer, instance=True, spec_set=True)
    mock.analyze.return_value = EmotionResult(
        emotion_label="hope",
        color_code="#FFCC00",
        confidence=0.8,
        model_version="test-model",
        source="jev",
    )
    return mock


@pytest.fixture
def catalog():
    return create_autospec(BookCatalog, instance=True, spec_set=True)


def test_list_reviews_checks_ownership_and_passes_pagination(
    books_repo, reviews_repo, analyzer, review
):
    service = ReviewService(books_repo, reviews_repo, analyzer)
    reviews_repo.list.return_value = [review]
    assert service.list(1, 10, 2, 5, 3) == [review]
    books_repo.get.assert_called_once_with(1, 10)
    reviews_repo.list.assert_called_once_with(1, 10, 2, 5, 3)
    books_repo.get.side_effect = NotFound("Book not found")
    reviews_repo.list.reset_mock()
    with pytest.raises(NotFound):
        service.list(2, 10)
    reviews_repo.list.assert_not_called()


def test_user_create_and_list(users_repo, user):
    service = UserService(users_repo)
    users_repo.create.return_value = user
    users_repo.list.return_value = [user]
    assert service.create(user.name, user.email) == user
    assert service.list() == [user]
    users_repo.create.assert_called_once_with(user.name, user.email)
    users_repo.list.assert_called_once_with()


def test_user_get_update_and_delete(users_repo, user):
    service = UserService(users_repo)
    users_repo.get.return_value = user
    users_repo.update.return_value = user
    assert service.get(1) == user
    updated = service.update(1, "Updated", "updated@example.test")
    assert updated.name == "Updated"
    assert updated.email == "updated@example.test"
    users_repo.update.assert_called_once_with(user)
    assert users_repo.get.call_args_list == [call(1), call(1)]
    service.delete(1)
    users_repo.delete.assert_called_once_with(1)


@pytest.mark.parametrize("method", ["create", "update"])
@pytest.mark.parametrize(
    ("name", "email"),
    [
        ("x" * 101, "valid@example.test"),
        ("Valid", "x" * 256),
    ],
)
def test_invalid_user_is_rejected_before_repository(users_repo, method, name, email):
    service = UserService(users_repo)
    with pytest.raises(InvalidInput):
        if method == "create":
            service.create(name, email)
        else:
            service.update(1, name, email)
    assert users_repo.mock_calls == []


def test_missing_user_is_not_updated(users_repo):
    users_repo.get.side_effect = NotFound("missing")
    with pytest.raises(NotFound):
        UserService(users_repo).update(1, "Updated", "updated@example.test")
    users_repo.update.assert_not_called()


@pytest.mark.parametrize("book_id", [None, 10])
def test_reading_register_normalizes_details(books_repo, book, book_id):
    books_repo.add.return_value = book
    result = ReadingService(books_repo).register(1, " Example ", " Writer ", 20, book_id)
    assert result == book
    books_repo.add.assert_called_once_with(1, "Example", "Writer", 20, book_id)


@pytest.mark.parametrize(("title", "pages"), [("  ", 20), ("Example", 0)])
def test_invalid_book_is_not_registered(books_repo, title, pages):
    with pytest.raises(InvalidInput):
        ReadingService(books_repo).register(1, title, None, pages)
    books_repo.add.assert_not_called()


def test_reading_list_and_get_preserve_owner_and_pagination(books_repo, book):
    service = ReadingService(books_repo)
    books_repo.list.return_value = [book]
    assert service.list(7, 5, 2) == [book]
    assert service.get(7, 10) == book
    books_repo.list.assert_called_once_with(7, 5, 2)
    books_repo.get.assert_called_once_with(7, 10)


def test_catalog_search_normalizes_query(books_repo, catalog, catalog_book):
    catalog.search.return_value = [catalog_book]
    service = CatalogService(catalog)
    assert service.search("  銀河鉄道の夜  ", 10) == [catalog_book]
    catalog.search.assert_called_once_with("銀河鉄道の夜", 10)


def test_catalog_import_uses_canonical_metadata(books_repo, catalog, catalog_book, book):
    catalog.get.return_value = catalog_book
    books_repo.add_catalog_book.return_value = book
    service = ReadingService(books_repo, catalog)
    assert service.import_catalog_book(7, catalog_book.google_books_id) == book
    catalog.get.assert_called_once_with(catalog_book.google_books_id)
    books_repo.add_catalog_book.assert_called_once_with(7, catalog_book)


def test_reading_iteration_lifecycle(books_repo, book):
    completed = ReadingIteration(1, "completed", 20, book.created_at, book.created_at)
    started = ReadingIteration(2, "reading", 0, book.created_at, None)
    books_repo.list_iterations.return_value = [completed]
    books_repo.start_iteration.return_value = started
    books_repo.complete_iteration.return_value = completed
    service = ReadingService(books_repo)

    assert service.list_iterations(7, 10) == [completed]
    assert service.start_iteration(7, 10) == started
    assert service.complete_iteration(7, 10, 1) == completed
    assert books_repo.get.call_args_list == [call(7, 10), call(7, 10), call(7, 10)]
    books_repo.complete_iteration.assert_called_once_with(7, 10, 1, book.total_pages)


def test_page_popularity_requires_owned_book(books_repo):
    points = [PagePopularity(page_number=12, user_count=3)]
    books_repo.page_popularity.return_value = points
    assert ReadingService(books_repo).page_popularity(7, 10) == points
    books_repo.page_popularity.assert_called_once_with(7, 10)


def test_review_get_checks_ownership(books_repo, reviews_repo, analyzer, review):
    service = ReviewService(books_repo, reviews_repo, analyzer)
    assert service.get(7, 10, 3) == review
    books_repo.get.assert_called_once_with(7, 10)
    reviews_repo.get.assert_called_once_with(7, 10, 3, None)


@pytest.mark.parametrize("method", ["get", "save"])
def test_review_rejects_access_to_missing_book(books_repo, reviews_repo, analyzer, method):
    books_repo.get.side_effect = NotFound("missing")
    service = ReviewService(books_repo, reviews_repo, analyzer)
    with pytest.raises(NotFound):
        if method == "get":
            service.get(1, 10, 3)
        else:
            service.save(1, 10, 3, "text")
    assert reviews_repo.mock_calls == []
    analyzer.analyze.assert_not_called()


@pytest.mark.parametrize("method", ["get", "save"])
@pytest.mark.parametrize("page", [0, 21])
def test_review_rejects_out_of_range_page(books_repo, reviews_repo, analyzer, method, page):
    service = ReviewService(books_repo, reviews_repo, analyzer)
    with pytest.raises(InvalidInput):
        if method == "get":
            service.get(1, 10, page)
        else:
            service.save(1, 10, page, "text")
    assert reviews_repo.mock_calls == []
    analyzer.analyze.assert_not_called()


@pytest.mark.parametrize("text", ["  ", "x" * 141])
def test_invalid_review_is_not_saved(books_repo, reviews_repo, analyzer, text):
    with pytest.raises(InvalidInput):
        ReviewService(books_repo, reviews_repo, analyzer).save(1, 10, 3, text)
    assert reviews_repo.mock_calls == []
    analyzer.analyze.assert_not_called()


@pytest.mark.parametrize("created", [True, False])
def test_review_saves_text_before_analysis_and_passes_revision(
    books_repo,
    reviews_repo,
    analyzer,
    review,
    created,
):
    reviews_repo.save_text.return_value = ReviewTextSaveResult(100, 2, created)
    timeline = Mock()
    timeline.attach_mock(reviews_repo, "reviews")
    timeline.attach_mock(analyzer, "analyzer")
    result = ReviewService(books_repo, reviews_repo, analyzer).save(1, 10, 3, "  text  ")
    assert result.review == review
    assert result.created is created
    assert timeline.mock_calls == [
        call.reviews.save_text(1, 10, 3, "text", None),
        call.analyzer.analyze("text"),
        call.reviews.complete(100, 2, analyzer.analyze.return_value),
        call.reviews.get(1, 10, 3, None),
    ]


@pytest.mark.parametrize("failure", ["analyze", "complete"])
def test_analysis_failure_preserves_saved_text_and_returns_latest_review(
    books_repo,
    reviews_repo,
    analyzer,
    review,
    failure,
):
    if failure == "analyze":
        analyzer.analyze.side_effect = RuntimeError("unavailable")
    else:
        reviews_repo.complete.side_effect = RuntimeError("could not store analysis")
    result = ReviewService(books_repo, reviews_repo, analyzer).save(1, 10, 3, "text")
    assert result.review == review
    reviews_repo.save_text.assert_called_once_with(1, 10, 3, "text", None)
    reviews_repo.fail.assert_called_once_with(100, 2)
    reviews_repo.get.assert_called_once_with(1, 10, 3, None)
    if failure == "analyze":
        reviews_repo.complete.assert_not_called()


def test_text_save_failure_does_not_analyze_or_mark_failed(books_repo, reviews_repo, analyzer):
    reviews_repo.save_text.side_effect = RuntimeError("database unavailable")
    with pytest.raises(RuntimeError, match="database unavailable"):
        ReviewService(books_repo, reviews_repo, analyzer).save(1, 10, 3, "text")
    analyzer.analyze.assert_not_called()
    reviews_repo.fail.assert_not_called()
