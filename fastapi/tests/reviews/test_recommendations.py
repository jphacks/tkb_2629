from unittest.mock import create_autospec

import pytest
import sqlalchemy as sa
import test_visibility

from backend.analysis.application.ports import EmotionAnalyzer
from backend.analysis.application.service import AnalysisService
from backend.analysis.domain.emotions import BASIC_EMOTION_NAMES
from backend.analysis.infrastructure.models import EmotionAnalysis
from backend.analysis.infrastructure.unit_of_work import SqlAnalysisUnitOfWork
from backend.integration.reviews_analysis import JevAnalysisGateway
from backend.integration.reviews_library import LibraryReadingGateway
from backend.library.application.errors import ExternalServiceError
from backend.library.application.ports import BookCatalog
from backend.library.application.service import LibraryService
from backend.library.domain.catalog import CatalogBook
from backend.library.infrastructure.models import Book, UserBook
from backend.library.infrastructure.unit_of_work import SqlLibraryUnitOfWork
from backend.reviews.domain.errors import InvalidInput
from backend.reviews.infrastructure.models import PageReview
from backend.reviews.infrastructure.repository import SqlReviewRepository
from backend.shared.application.security import AuthenticationRequired
from backend.shared.presentation.auth import get_current_user_id

context = test_visibility.context
PATH = "/catalog/books/recommendations"


def analysis(review_id, joy, revision=1, source="jev", **overrides):
    scores = {name: 0 for name in BASIC_EMOTION_NAMES}
    scores.update(joy=joy, **overrides)
    return EmotionAnalysis(
        review_id=review_id,
        review_revision=revision,
        source=source,
        color_code="#808080",
        **scores,
    )


@pytest.fixture
def recommendations(context):
    catalog = create_autospec(BookCatalog, instance=True)
    catalog.get.side_effect = lambda key: CatalogBook(key, f"Title {key}", None, 100, None, None)
    library = LibraryService(
        lambda: SqlLibraryUnitOfWork(context.sessions), catalog, context.service.clock
    )
    context.service.readings = LibraryReadingGateway(library)
    context.service.analyses = JevAnalysisGateway(
        AnalysisService(
            lambda: SqlAnalysisUnitOfWork(context.sessions),
            create_autospec(EmotionAnalyzer, instance=True),
        )
    )
    context.catalog = catalog
    return context


def seed(context):
    with context.sessions() as db:
        # Both own reading iterations count, even though both reviews are private.
        db.add_all([analysis(1, 20), analysis(2, 80)])
        for number, joy in [(20, 50), (21, 60), (22, 80), (23, 50), (24, 90), (25, 0)]:
            db.add(Book(id=number, google_books_id=f"volume-{number}"))
            db.flush()
            db.add(UserBook(id=number, user_id=2, book_id=number, iteration_number=1))
            db.flush()
            db.add(
                PageReview(
                    id=number,
                    user_book_id=number,
                    page_number=1,
                    review_text="Public note",
                    visibility="public",
                    analysis_revision=1,
                    analysis_status="completed",
                )
            )
            db.flush()
            db.add(analysis(number, joy))
        db.commit()


def ids(response):
    assert response.status_code == 200
    return [item["google_books_id"] for item in response.json()["items"]]


def test_no_real_own_reviews_returns_guidance_without_catalog_calls(recommendations):
    response = recommendations.client.get(PATH)
    assert response.status_code == 200
    assert response.json() == {"items": [], "status": "needs_reviews", "limit": 5}
    assert response.headers["cache-control"] == "no-store"
    recommendations.catalog.get.assert_not_called()


def test_real_mean_across_private_past_and_current_reviews_and_exact_distance_order(
    recommendations,
):
    seed(recommendations)
    response = recommendations.client.get(PATH)
    assert ids(response) == ["volume-20", "volume-23", "volume-21", "volume-22", "volume-24"]
    assert response.json()["status"] == "ready"
    assert recommendations.catalog.get.call_count == 5
    assert set(response.json()) == {"items", "status", "limit"}
    assert set(response.json()["items"][0]) == {
        "google_books_id",
        "title",
        "author",
        "total_pages",
        "isbn_13",
        "thumbnail_url",
    }
    assert ids(recommendations.client.get(PATH + "?limit=1")) == ["volume-20"]


def test_owned_books_excluded_and_candidates_use_only_public_completed_latest_real_vectors(
    recommendations,
):
    seed(recommendations)
    with recommendations.sessions() as db:
        db.add(UserBook(user_id=1, book_id=20, iteration_number=1))
        db.get(PageReview, 21).visibility = "private"
        db.get(PageReview, 22).analysis_status = "pending"
        db.get(PageReview, 23).analysis_revision = 2
        db.get(
            EmotionAnalysis,
            db.scalar(sa.select(EmotionAnalysis.id).where(EmotionAnalysis.review_id == 24)),
        ).source = "mock"
        db.get(
            EmotionAnalysis,
            db.scalar(sa.select(EmotionAnalysis.id).where(EmotionAnalysis.review_id == 25)),
        ).trust = None
        db.commit()
    response = recommendations.client.get(PATH)
    assert response.json() == {"items": [], "status": "no_candidates", "limit": 5}
    recommendations.catalog.get.assert_not_called()


def test_private_candidate_review_cannot_influence_rank_and_public_change_is_immediate(
    recommendations,
):
    seed(recommendations)
    with recommendations.sessions() as db:
        db.add(
            PageReview(
                id=99,
                user_book_id=20,
                page_number=2,
                review_text="Private note",
                visibility="private",
                analysis_revision=1,
                analysis_status="completed",
            )
        )
        db.flush()
        db.add(analysis(99, 100))
        db.commit()
    assert ids(recommendations.client.get(PATH))[0] == "volume-20"
    with recommendations.sessions() as db:
        db.get(PageReview, 99).visibility = "public"
        db.commit()
    assert ids(recommendations.client.get(PATH))[0] == "volume-23"


@pytest.mark.parametrize("emotion", list(BASIC_EMOTION_NAMES))
def test_every_emotion_axis_affects_distance(recommendations, emotion):
    seed(recommendations)
    with recommendations.sessions() as db:
        row = db.scalar(sa.select(EmotionAnalysis).where(EmotionAnalysis.review_id == 20))
        setattr(row, emotion, 100)
        db.commit()
    assert ids(recommendations.client.get(PATH))[0] == "volume-23"


@pytest.mark.parametrize("invalid", ["pending", "failed", "old_revision", "incomplete"])
def test_invalid_own_analyses_are_not_a_profile(recommendations, invalid):
    seed(recommendations)
    with recommendations.sessions() as db:
        for review_id in (1, 2):
            if invalid in ("pending", "failed"):
                db.get(PageReview, review_id).analysis_status = invalid
            elif invalid == "old_revision":
                db.get(PageReview, review_id).analysis_revision = 2
            else:
                row = db.scalar(
                    sa.select(EmotionAnalysis).where(EmotionAnalysis.review_id == review_id)
                )
                row.joy = None
        db.commit()
    assert recommendations.client.get(PATH).json()["status"] == "needs_reviews"
    recommendations.catalog.get.assert_not_called()


def test_account_profiles_are_isolated_and_mock_own_data_is_not_a_profile(recommendations):
    seed(recommendations)
    recommendations.app.dependency_overrides[get_current_user_id] = lambda: 999
    assert recommendations.client.get(PATH).json()["status"] == "needs_reviews"
    with recommendations.sessions() as db:
        for row in db.scalars(
            sa.select(EmotionAnalysis).where(EmotionAnalysis.review_id.in_([1, 2]))
        ):
            row.source = "mock"
        db.commit()
    recommendations.app.dependency_overrides[get_current_user_id] = lambda: 1
    assert recommendations.client.get(PATH).json()["status"] == "needs_reviews"


@pytest.mark.parametrize("limit", ["0", "-1", "21", "abc", "1.5"])
def test_invalid_limits(recommendations, limit):
    assert recommendations.client.get(PATH + f"?limit={limit}").status_code == 422
    with pytest.raises(InvalidInput):
        recommendations.service.recommendations(1, 0)


def test_authentication(recommendations):
    def unauthenticated():
        raise AuthenticationRequired("Authentication required")

    recommendations.app.dependency_overrides[get_current_user_id] = unauthenticated
    assert recommendations.client.get(PATH).status_code == 401


def test_metadata_failure_is_explicit_and_does_not_return_partial_recommendations(recommendations):
    seed(recommendations)
    recommendations.catalog.get.side_effect = ExternalServiceError("catalog unavailable")
    assert recommendations.client.get(PATH).status_code == 502


def test_database_failure_is_not_disguised_as_cold_start(recommendations, monkeypatch):
    def unavailable(*args, **kwargs):
        raise sa.exc.OperationalError("read", {}, RuntimeError("outage"))

    monkeypatch.setattr(SqlReviewRepository, "analysis_references", unavailable)
    assert recommendations.client.get(PATH).status_code == 503
