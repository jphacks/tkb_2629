import pytest
import test_visibility

from backend.reviews.application.errors import ServiceUnavailable
from backend.reviews.application.results import EmotionSummary
from backend.reviews.infrastructure.models import PageReview
from backend.shared.application.security import AuthenticationRequired
from backend.shared.presentation.auth import get_current_user_id

context = test_visibility.context
PATH = "/books/10/emotions/comparison"


def summary(references):
    return EmotionSummary(len(references), {"joy": 0.5} if references else {}, "#7950A5")


def test_comparison_uses_current_own_iteration_and_only_public_other_reviews(context):
    with context.sessions() as db:
        db.add(
            PageReview(
                id=3,
                user_book_id=3,
                page_number=5,
                review_text="Other reader",
                visibility="public",
                analysis_revision=2,
                analysis_status="completed",
            )
        )
        db.add(
            PageReview(
                id=4,
                user_book_id=3,
                page_number=6,
                review_text="Private",
                visibility="private",
                analysis_revision=1,
                analysis_status="completed",
            )
        )
        db.add(
            PageReview(
                id=5,
                user_book_id=3,
                page_number=7,
                review_text="Pending",
                visibility="public",
                analysis_revision=1,
                analysis_status="pending",
            )
        )
        db.commit()
    context.analyses.summarize.side_effect = summary
    response = context.client.get(PATH)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    calls = context.analyses.summarize.call_args_list
    assert calls[0].args == ([(2, 1)],)
    assert calls[1].args == ([(3, 2)],)
    assert response.json()["mine"]["review_count"] == 1
    assert response.json()["others"]["review_count"] == 1


def test_comparison_empty_is_not_an_error(context):
    context.analyses.summarize.side_effect = summary
    response = context.client.get(PATH)
    assert response.status_code == 200
    assert response.json()["others"]["review_count"] == 0
    assert response.json()["others"]["emotion_scores"] == {}


@pytest.mark.parametrize("actor", [2, 999])
def test_comparison_checks_ownership_before_analysis(context, actor):
    context.app.dependency_overrides[get_current_user_id] = lambda: actor
    response = context.client.get("/books/999/emotions/comparison")
    assert response.status_code == 404
    context.analyses.summarize.assert_not_called()


def test_comparison_requires_authentication(context):
    def unauthenticated():
        raise AuthenticationRequired("Authentication required")

    context.app.dependency_overrides[get_current_user_id] = unauthenticated
    assert context.client.get(PATH).status_code == 401
    context.analyses.summarize.assert_not_called()


def test_comparison_analysis_failure_is_not_disguised_as_empty(context):
    context.analyses.summarize.side_effect = ServiceUnavailable("Analysis unavailable")
    assert context.client.get(PATH).status_code == 503
