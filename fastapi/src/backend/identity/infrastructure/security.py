"""Cryptographic, clock and mail adapters. Configuration is injected by composition."""

import hashlib
import secrets
import smtplib
import ssl
import time
from dataclasses import dataclass, field
from email.message import EmailMessage

import jwt
from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError

from ..application.errors import EmailDeliveryFailed, IdentityConfigurationError
from ..application.results import AccessClaims, ChallengeMail
from ..domain.errors import InvalidSession
from ..domain.values import ChallengePurpose


class ArgonPasswords:
    def __init__(self):
        self.hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=1, type=Type.ID)

    def hash(self, password: str) -> str:
        return self.hasher.hash(password)

    def verify(self, digest: str, password: str) -> bool:
        try:
            return self.hasher.verify(digest, password)
        except (VerificationError, InvalidHashError):
            return False


class RandomSecrets:
    def create(self) -> str:
        return secrets.token_urlsafe(32)

    def digest(self, token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()


class SystemClock:
    def now(self) -> int:
        return int(time.time())


@dataclass(frozen=True)
class JwtSettings:
    secret: str = field(repr=False)
    issuer: str = "re-read-api"
    audience: str = "shiori-app"

    def __post_init__(self) -> None:
        if len(self.secret.encode()) < 32:
            raise IdentityConfigurationError(
                "AUTH_JWT_SECRETに32バイト以上の秘密鍵を設定してください"
            )


class JwtAccessTokens:
    def __init__(self, settings: JwtSettings):
        self.settings = settings

    def issue(self, claims: AccessClaims) -> str:
        return jwt.encode(
            {
                "sub": str(claims.user_id),
                "sid": claims.session_id,
                "iat": claims.issued_at,
                "exp": claims.expires_at,
                "iss": self.settings.issuer,
                "aud": self.settings.audience,
                "type": "access",
            },
            self.settings.secret,
            algorithm="HS256",
        )

    def decode(self, token: str) -> AccessClaims:
        try:
            data = jwt.decode(
                token,
                self.settings.secret,
                algorithms=["HS256"],
                issuer=self.settings.issuer,
                audience=self.settings.audience,
                options={"require": ["sub", "sid", "exp", "iat", "type"]},
            )
            if (
                data["type"] != "access"
                or int(data["sub"]) < 1
                or not isinstance(data["sid"], str)
                or not data["sid"]
                or type(data["iat"]) is not int
                or type(data["exp"]) is not int
                or data["exp"] <= data["iat"]
            ):
                raise ValueError("Invalid access claims")
            return AccessClaims(int(data["sub"]), data["sid"], data["iat"], data["exp"])
        except (jwt.InvalidTokenError, ValueError, TypeError, KeyError):
            raise InvalidSession("ログインし直してください") from None


@dataclass(frozen=True)
class SmtpSettings:
    host: str
    sender: str
    port: int = 587
    security: str = "starttls"
    username: str = ""
    password: str = field(default="", repr=False)
    allow_plain: bool = False


class SmtpMailer:
    def __init__(self, settings: SmtpSettings):
        self.settings = settings

    def send(self, mail: ChallengeMail) -> None:
        settings = self.settings
        if not settings.host or not settings.sender:
            raise IdentityConfigurationError("メール送信設定が未完了です")
        if settings.security not in ("ssl", "starttls") and not (
            settings.security == "plain" and settings.allow_plain
        ):
            raise IdentityConfigurationError("SMTP_SECURITYの設定が不正です")
        message = EmailMessage()
        message["From"] = settings.sender
        message["To"] = mail.email
        subject = (
            "メールアドレスの確認"
            if mail.purpose == ChallengePurpose.VERIFY_EMAIL
            else "パスワードの再設定"
        )
        message["Subject"] = f"Re:Read：{subject}"
        message.set_content(
            "アプリの画面に以下の確認トークンを入力してください。\n\n"
            f"{mail.token}\n\n有効期限は{mail.expires_in // 60}分です。"
            "心当たりがなければ無視してください。"
        )
        try:
            if settings.security == "ssl":
                connection = smtplib.SMTP_SSL(
                    settings.host, settings.port, timeout=10, context=ssl.create_default_context()
                )
            else:
                connection = smtplib.SMTP(settings.host, settings.port, timeout=10)
            with connection:
                if settings.security == "starttls":
                    connection.starttls(context=ssl.create_default_context())
                if settings.username:
                    connection.login(settings.username, settings.password)
                connection.send_message(message)
        except (OSError, smtplib.SMTPException):
            raise EmailDeliveryFailed(
                "メールの送信に失敗しました。時間をおいて再送してください"
            ) from None
