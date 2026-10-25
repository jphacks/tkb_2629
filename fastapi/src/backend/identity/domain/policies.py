from dataclasses import dataclass
from enum import StrEnum

from .errors import AccessDenied, AttemptLimitExceeded, InvalidRegistration
from .values import EmailAddress


class AuthenticationAction(StrEnum):
    REGISTER = "register"
    LOGIN = "login"
    REFRESH = "refresh"
    LOGOUT = "logout"
    VERIFY = "verify"
    VERIFICATION_MAIL = "verification-mail"
    RESET_MAIL = "reset-mail"
    RESET_PASSWORD = "reset"


@dataclass(frozen=True)
class AttemptWindow:
    key: str
    maximum: int
    expires: int

    def require_admitted(self, count: int) -> None:
        if count > self.maximum:
            raise AttemptLimitExceeded("試行回数の上限です。15分ほど待ってからお試しください")


class AttemptPolicy:
    window_seconds = 900

    @classmethod
    def windows(
        cls, action: AuthenticationAction, client: str, email: str | None, now: int
    ) -> tuple[AttemptWindow, ...]:
        bucket = now // cls.window_seconds
        expires = (bucket + 1) * cls.window_seconds
        maximum = 300 if action == AuthenticationAction.REFRESH else 30
        windows = [AttemptWindow(f"{action}:ip:{client}:{bucket}", maximum, expires)]
        if email is not None:
            windows.append(AttemptWindow(f"{action}:email:{email}:{bucket}", 5, expires))
        return tuple(windows)


class UserAccessPolicy:
    @staticmethod
    def require_owner(actor_id: int, user_id: int) -> None:
        if actor_id != user_id:
            raise AccessDenied("このユーザーにはアクセスできません")

    @staticmethod
    def require_unchanged_email(registered: EmailAddress, requested: EmailAddress) -> None:
        if registered != requested:
            raise InvalidRegistration(
                "メールアドレスの変更には再確認が必要です。現在は対応していません"
            )
