import pytest
from fastapi import HTTPException
from starlette.requests import Request

from backend.presentation.auth import get_current_user_id


@pytest.fixture(autouse=True)
def clear_auth_settings(monkeypatch):
    for name in ("AUTH_DISABLED", "APP_ENV", "DEV_USER_ID"):
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def request_scope():
    return Request({"type": "http", "state": {}})


def test_default_requires_authentication(request_scope):
    with pytest.raises(HTTPException) as error:
        get_current_user_id(request_scope)
    assert error.value.status_code == 401


def test_default_uses_authenticated_user(request_scope):
    request_scope.state.user_id = 7
    assert get_current_user_id(request_scope) == 7


def test_development_bypass_uses_configured_user(monkeypatch, request_scope):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setenv("DEV_USER_ID", "12")
    assert get_current_user_id(request_scope) == 12


@pytest.mark.parametrize("environment", ["production", "staging", ""])
def test_bypass_rejected_outside_development(monkeypatch, request_scope, environment):
    monkeypatch.setenv("APP_ENV", environment)
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setenv("DEV_USER_ID", "12")
    with pytest.raises(HTTPException) as error:
        get_current_user_id(request_scope)
    assert error.value.status_code == 503


@pytest.mark.parametrize("user_id", ["", "0", "-1", "abc", "1.5"])
def test_invalid_development_user_is_rejected(monkeypatch, request_scope, user_id):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setenv("DEV_USER_ID", user_id)
    with pytest.raises(HTTPException) as error:
        get_current_user_id(request_scope)
    assert error.value.status_code == 503


def test_disabled_bypass_still_requires_authentication(monkeypatch, request_scope):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("AUTH_DISABLED", "false")
    monkeypatch.setenv("DEV_USER_ID", "12")
    with pytest.raises(HTTPException) as error:
        get_current_user_id(request_scope)
    assert error.value.status_code == 401
