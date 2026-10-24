from collections.abc import Generator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend import database
from backend.analysis import (
    EMOTION_VECTOR_COLOR_VERSION,
    EmotionResult,
    EmotionVector,
    JevEmotionAnalyzer,
    MockEmotionAnalyzer,
    emotion_vector_to_color_code,
)
from backend.auth import get_current_user_id
from backend.database import get_db
from backend.main import app, get_emotion_analyzer
from backend.models import EmotionAnalysis, PageReview, User


@pytest.fixture
def client() -> Generator[tuple[TestClient, sessionmaker[Session]], None, None]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    migration_config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    with engine.connect() as connection:
        migration_config.attributes["connection"] = connection
        command.upgrade(migration_config, "head")
    sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with sessions() as session:
        session.add_all(
            [
                User(name="Reader One", email="reader-one@example.test"),
                User(name="Reader Two", email="reader-two@example.test"),
            ]
        )
        session.commit()

    def override_db() -> Generator[Session, None, None]:
        with sessions() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user_id] = lambda: 1
    app.dependency_overrides[get_emotion_analyzer] = lambda: MockEmotionAnalyzer()
    configured_engine = database.engine
    database.engine = None
    with TestClient(app) as test_client:
        yield test_client, sessions
    database.engine = configured_engine
    app.dependency_overrides.clear()
    engine.dispose()


def create_book(test_client: TestClient, total_pages: int = 20) -> dict:
    response = test_client.post(
        "/api/v1/books",
        json={"title": "Example Book", "author": "A. Writer", "total_pages": total_pages},
    )
    assert response.status_code == 201
    return response.json()


def test_initial_migration_refuses_existing_schema_without_history() -> None:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))

    migration_config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    with engine.connect() as connection:
        migration_config.attributes["connection"] = connection
        with pytest.raises(RuntimeError, match="Refusing to baseline existing tables"):
            command.upgrade(migration_config, "head")

    with engine.connect() as connection:
        assert connection.scalar(text("SELECT COUNT(*) FROM users")) == 0
        book_table_count = connection.scalar(
            text("SELECT COUNT(*) FROM sqlite_master WHERE name = 'books'")
        )
        assert book_table_count == 0
    engine.dispose()


def test_book_registration_listing_sharing_and_detail(
    client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    test_client, _ = client
    created = create_book(test_client)
    book_id = created["id"]

    listed = test_client.get("/api/v1/books")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()["items"]] == [book_id]
    assert test_client.get(f"/api/v1/books/{book_id}").status_code == 200

    test_client.app.dependency_overrides[get_current_user_id] = lambda: 2
    shared = test_client.post(
        "/api/v1/books",
        json={
            "book_id": book_id,
            "title": created["title"],
            "author": created["author"],
            "total_pages": created["total_pages"],
        },
    )
    assert shared.status_code == 201
    assert test_client.get("/api/v1/books").json()["items"][0]["id"] == book_id
    assert test_client.post(
        "/api/v1/books",
        json={
            "book_id": book_id,
            "title": created["title"],
            "author": created["author"],
            "total_pages": created["total_pages"],
        },
    ).status_code == 409


def test_progress_updates_completion_and_rejects_invalid_page(
    client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    test_client, _ = client
    book_id = create_book(test_client, total_pages=20)["id"]

    response = test_client.patch(
        f"/api/v1/books/{book_id}/progress", json={"current_page": 20}
    )

    assert response.status_code == 200
    assert response.json()["reading"]["status"] == "completed"
    assert response.json()["reading"]["completed_at"] is not None
    assert test_client.patch(
        f"/api/v1/books/{book_id}/progress", json={"current_page": 21}
    ).status_code == 422


def test_review_put_updates_without_duplicates(
    client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    test_client, sessions = client
    book_id = create_book(test_client)["id"]
    url = f"/api/v1/books/{book_id}/pages/3/review"

    first = test_client.put(url, json={"review_text": "First thought"})
    second = test_client.put(url, json={"review_text": "Updated thought"})

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["review_text"] == "Updated thought"
    assert second.json()["analysis"]["source"] == "mock"
    assert test_client.get(url).json()["review_text"] == "Updated thought"
    with sessions() as session:
        assert session.scalar(select(func.count()).select_from(PageReview)) == 1
        assert session.scalar(select(func.count()).select_from(EmotionAnalysis)) == 2


def test_jev_affect_and_color_are_persisted_and_returned(
    client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    test_client, sessions = client
    book_id = create_book(test_client)["id"]
    vector = EmotionVector(
        joy=0.75,
        trust=0.1,
        fear=0.2,
        surprise=0.0,
        sadness=0.1,
        disgust=0.0,
        anger=0.25,
        anticipation=0.5,
    )

    class FixedJevAnalyzer:
        def analyze(self, review_text: str) -> EmotionResult:
            return EmotionResult(
                emotion_label=None,
                color_code=emotion_vector_to_color_code(vector),
                confidence=0.7,
                model_version="jev-test-model",
                source="jev",
                palette_version=EMOTION_VECTOR_COLOR_VERSION,
                emotion_vector=vector,
            )

    test_client.app.dependency_overrides[get_emotion_analyzer] = lambda: FixedJevAnalyzer()
    response = test_client.put(
        f"/api/v1/books/{book_id}/pages/4/review",
        json={"review_text": "A hopeful passage."},
    )

    assert response.status_code == 201
    analysis = response.json()["analysis"]
    assert analysis["source"] == "jev"
    assert analysis["emotion_label"] is None
    assert analysis["emotion_vector"] == vector.as_dict()
    assert analysis["color_code"] == emotion_vector_to_color_code(vector)
    assert analysis["palette_version"] == EMOTION_VECTOR_COLOR_VERSION
    with sessions() as session:
        saved = session.scalar(select(EmotionAnalysis))
        assert saved is not None
        assert saved.joy == 0.75 and saved.anticipation == 0.5
        assert saved.palette_version == EMOTION_VECTOR_COLOR_VERSION


def test_analyzer_selection_depends_on_api_key_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("TYPESAFE_API_KEY", raising=False)
    assert isinstance(get_emotion_analyzer(), MockEmotionAnalyzer)

    monkeypatch.setenv("TYPESAFE_API_KEY", "test-only-placeholder")
    assert isinstance(get_emotion_analyzer(), JevEmotionAnalyzer)


def test_invalid_book_review_and_page_inputs_are_rejected(
    client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    test_client, _ = client
    assert test_client.post(
        "/api/v1/books", json={"title": " ", "total_pages": 0}
    ).status_code == 422
    book_id = create_book(test_client, total_pages=5)["id"]
    assert test_client.put(
        f"/api/v1/books/{book_id}/pages/0/review", json={"review_text": "text"}
    ).status_code == 422
    assert test_client.put(
        f"/api/v1/books/{book_id}/pages/6/review", json={"review_text": "text"}
    ).status_code == 422
    assert test_client.put(
        f"/api/v1/books/{book_id}/pages/1/review", json={"review_text": "  "}
    ).status_code == 422


def test_analysis_failure_preserves_text_and_hides_previous_result(
    client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    test_client, sessions = client
    book_id = create_book(test_client)["id"]
    url = f"/api/v1/books/{book_id}/pages/2/review"
    test_client.put(url, json={"review_text": "First saved thought"})

    class FailingAnalyzer:
        def analyze(self, review_text: str) -> EmotionResult:
            raise RuntimeError("analysis unavailable")

    test_client.app.dependency_overrides[get_emotion_analyzer] = lambda: FailingAnalyzer()
    response = test_client.put(url, json={"review_text": "Saved despite failure"})

    assert response.status_code == 200
    assert response.json()["review_text"] == "Saved despite failure"
    assert response.json()["analysis_status"] == "failed"
    assert response.json()["analysis"] is None
    with sessions() as session:
        review = session.scalar(select(PageReview))
        assert review is not None and review.review_text == "Saved despite failure"
        assert session.scalar(select(func.count()).select_from(EmotionAnalysis)) == 1


def test_missing_auth_and_cross_user_access_are_rejected(
    client: tuple[TestClient, sessionmaker[Session]],
) -> None:
    test_client, _ = client
    test_client.app.dependency_overrides.pop(get_current_user_id)
    assert test_client.get("/api/v1/books").status_code == 401

    test_client.app.dependency_overrides[get_current_user_id] = lambda: 1
    book_id = create_book(test_client)["id"]
    test_client.app.dependency_overrides[get_current_user_id] = lambda: 2
    assert test_client.get(f"/api/v1/books/{book_id}").status_code == 404


def test_database_configuration_error_returns_service_unavailable(
    client: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    test_client, _ = client
    monkeypatch.setattr(database, "engine", None)
    test_client.app.dependency_overrides.pop(get_db)

    assert test_client.get("/api/v1/books").status_code == 503