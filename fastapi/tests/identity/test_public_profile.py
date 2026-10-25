from importlib import import_module
from types import SimpleNamespace

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.composition import schema as schema_registry  # noqa: F401
from backend.identity.application.profiles import ProfileService
from backend.identity.domain.errors import AccessDenied
from backend.identity.infrastructure.models import User
from backend.identity.infrastructure.repository import SqlProfileRepository
from backend.identity.infrastructure.unit_of_work import SqlIdentityUnitOfWork
from backend.identity.presentation.dependencies import get_profile_service
from backend.main import create_app
from backend.shared.application.security import AuthenticationRequired
from backend.shared.database import Base
from backend.shared.presentation.auth import get_current_user_id

PATH = "/users/me/public-profile"


@pytest.fixture
def context():
    engine = sa.create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(engine, expire_on_commit=False)
    with sessions() as db:
        db.add_all(
            [
                User(id=1, name="Private registration name", email="one@example.test"),
                User(id=2, name="Second private name", email="two@example.test"),
            ]
        )
        db.commit()
    service = ProfileService(lambda: SqlIdentityUnitOfWork(sessions))
    app = create_app()
    app.dependency_overrides[get_profile_service] = lambda: service
    app.dependency_overrides[get_current_user_id] = lambda: 1
    with TestClient(app) as client:
        yield SimpleNamespace(client=client, app=app, sessions=sessions, service=service)
    engine.dispose()


def test_existing_and_new_users_have_no_automatic_public_name(context):
    response = context.client.get(PATH)
    assert response.status_code == 200
    assert response.json() == {"public_display_name": None}
    with context.sessions() as db:
        profile = SqlProfileRepository(db).create("Another private name", "new@example.test")
        db.commit()
        assert SqlProfileRepository(db).get_public_profile(profile.id).public_display_name is None


@pytest.mark.parametrize("name", ["Reader", "  Reader  ", "読書好き😀", "x" * 100])
def test_set_and_read_public_name_without_exposing_private_fields(context, name):
    for _ in range(2):
        response = context.client.put(PATH, json={"public_display_name": name})
        assert response.status_code == 200
        assert response.json() == {"public_display_name": name.strip()}
        assert context.client.get(PATH).json() == response.json()
    with context.sessions() as db:
        owner = db.get(User, 1)
        assert owner.name == "Private registration name"
        assert owner.email == "one@example.test"
        assert db.get(User, 2).public_display_name is None
    # Existing private profile response remains backward-compatible.
    assert context.client.get("/users/1").json() == {
        "id": 1,
        "name": "Private registration name",
        "email": "one@example.test",
    }


def test_public_name_can_change_and_need_not_be_unique(context):
    context.client.put(PATH, json={"public_display_name": "Reader"})
    context.app.dependency_overrides[get_current_user_id] = lambda: 2
    assert context.client.put(PATH, json={"public_display_name": "Reader"}).status_code == 200
    context.client.put(PATH, json={"public_display_name": "New reader"})
    with context.sessions() as db:
        assert db.get(User, 1).public_display_name == "Reader"
        assert db.get(User, 2).public_display_name == "New reader"


def test_private_name_update_does_not_overwrite_public_name(context):
    context.service.update_public_display_name(1, 1, "Reader")
    with context.sessions() as db:
        SqlProfileRepository(db).update_name(1, "New private name")
        db.commit()
        assert SqlProfileRepository(db).get_public_profile(1).public_display_name == "Reader"


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"public_display_name": None},
        {"public_display_name": ""},
        {"public_display_name": "   "},
        {"public_display_name": "x" * 101},
        {"public_display_name": 1},
        {"public_display_name": True},
        {"public_display_name": "Reader", "user_id": 2},
        {"public_display_name": "Reader", "name": "Changed"},
        {"public_display_name": "Reader", "email": "changed@example.test"},
    ],
)
def test_invalid_or_extra_fields_do_not_modify_profile(context, payload):
    assert context.client.put(PATH, json=payload).status_code == 422
    assert context.client.get(PATH).json() == {"public_display_name": None}


def test_other_users_cannot_access_profile_via_service_or_route(context):
    for operation in (
        lambda: context.service.get_public_profile(2, 1),
        lambda: context.service.update_public_display_name(2, 1, "Changed"),
    ):
        with pytest.raises(AccessDenied):
            operation()
    assert context.client.get("/users/2/public-profile").status_code == 404
    assert (
        context.client.put(
            "/users/2/public-profile", json={"public_display_name": "Changed"}
        ).status_code
        == 404
    )


@pytest.mark.parametrize("method", ["get", "put"])
def test_public_profile_requires_authentication(context, method):
    def unauthenticated():
        raise AuthenticationRequired("Authentication required")

    context.app.dependency_overrides[get_current_user_id] = unauthenticated
    kwargs = {"json": {"public_display_name": "Reader"}} if method == "put" else {}
    assert getattr(context.client, method)(PATH, **kwargs).status_code == 401


def test_missing_profile_is_not_created(context):
    context.app.dependency_overrides[get_current_user_id] = lambda: 999
    assert context.client.get(PATH).status_code == 404
    assert context.client.put(PATH, json={"public_display_name": "Reader"}).status_code == 404
    with context.sessions() as db:
        assert db.scalar(sa.select(sa.func.count()).select_from(User)) == 2


def test_public_name_migration_never_copies_private_names():
    migration = import_module("backend.infrastructure.migrations.versions.0012_public_display_name")
    engine = sa.create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR(100) NOT NULL,"
            " email VARCHAR(255) NOT NULL)"
        )
        connection.exec_driver_sql(
            "INSERT INTO users (id, name, email) VALUES (1, 'Private name', 'one@example.test')"
        )
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert connection.exec_driver_sql(
                "SELECT name, email, public_display_name FROM users"
            ).one() == ("Private name", "one@example.test", None)
            connection.exec_driver_sql(
                "INSERT INTO users (id, name, email) VALUES (2, 'New', 'two@example.test')"
            )
            assert (
                connection.exec_driver_sql(
                    "SELECT public_display_name FROM users WHERE id = 2"
                ).scalar_one()
                is None
            )
            migration.downgrade()
            assert connection.exec_driver_sql(
                "SELECT name, email FROM users ORDER BY id"
            ).all() == [("Private name", "one@example.test"), ("New", "two@example.test")]
            migration.upgrade()
    engine.dispose()
