import os
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from ..application.results import SessionTokens, UserSummary
from ..application.service import AuthenticationService
from .dependencies import get_authentication_service
from .schemas import (
    EmailInput,
    LoginInput,
    RefreshInput,
    RegisterInput,
    ResetInput,
    TokenInput,
    TokenOutput,
    UserOutput,
)

router = APIRouter(prefix="/auth", tags=["authentication"])
Auth = Annotated[AuthenticationService, Depends(get_authentication_service)]


def client_address(request: Request) -> str:
    # Only the ASGI server may restore a trusted proxy's client address.
    return request.client.host if request.client else "unknown"


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        "shiori_refresh",
        token,
        httponly=True,
        secure=os.getenv("APP_ENV") != "development",
        samesite="lax",
        path="/auth",
        max_age=30 * 86400,
    )


def refresh_value(body: RefreshInput, request: Request) -> str:
    if body.refresh_token:
        return body.refresh_token
    origin = request.headers.get("Origin")
    allowed = os.getenv("CORS_ORIGINS", "http://localhost:8081,http://localhost:19006").split(",")
    if not origin or origin not in [item.strip() for item in allowed]:
        raise HTTPException(status_code=403, detail="許可されていないリクエストです")
    token = request.cookies.get("shiori_refresh")
    if not token:
        raise HTTPException(
            status_code=401, detail="ログインしてください", headers={"WWW-Authenticate": "Bearer"}
        )
    return token


@router.post("/register", status_code=201)
def register(body: RegisterInput, request: Request, service: Auth) -> dict[str, str]:
    service.register(
        body.name,
        str(body.email),
        body.password,
        client=client_address(request),
        name_is_public=body.name_is_public,
    )
    return {"message": "確認メールを送信しました"}


@router.post("/login", response_model=TokenOutput)
def login(body: LoginInput, request: Request, response: Response, service: Auth) -> SessionTokens:
    result = service.login(str(body.email), body.password, client=client_address(request))
    set_refresh_cookie(response, result.refresh_token)
    return result


@router.post("/refresh", response_model=TokenOutput)
def refresh(
    body: RefreshInput, request: Request, response: Response, service: Auth
) -> SessionTokens:
    result = service.refresh(refresh_value(body, request), client=client_address(request))
    set_refresh_cookie(response, result.refresh_token)
    return result


@router.post("/logout", status_code=204)
def logout(body: RefreshInput, request: Request, service: Auth) -> Response:
    service.logout(refresh_value(body, request), client=client_address(request))
    response = Response(status_code=204)
    response.delete_cookie("shiori_refresh", path="/auth")
    return response


@router.post("/verify-email")
def verify_email(body: TokenInput, request: Request, service: Auth) -> dict[str, str]:
    service.verify_email(body.token, client=client_address(request))
    return {"message": "メール確認が完了しました。ログインしてください"}


@router.post("/resend-verification")
def resend(body: EmailInput, request: Request, service: Auth) -> dict[str, str]:
    service.send_verification(str(body.email), client=client_address(request))
    return {"message": "対象のアカウントがあれば確認メールを送信しました"}


@router.post("/forgot-password")
def forgot(body: EmailInput, request: Request, service: Auth) -> dict[str, str]:
    service.request_password_reset(str(body.email), client=client_address(request))
    return {"message": "対象のアカウントがあれば再設定メールを送信しました"}


@router.post("/reset-password")
def reset(body: ResetInput, request: Request, service: Auth) -> dict[str, str]:
    service.reset_password(body.token, body.password, client=client_address(request))
    return {"message": "パスワードを更新しました。ログインし直してください"}


@router.get("/me", response_model=UserOutput)
def me(request: Request, service: Auth) -> UserSummary:
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=401, detail="ログインしてください", headers={"WWW-Authenticate": "Bearer"}
        )
    return service.authenticate(token)
