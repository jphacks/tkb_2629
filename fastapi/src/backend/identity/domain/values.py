from dataclasses import dataclass
from enum import StrEnum

from .errors import InvalidRegistration

ACCESS_TOKEN_LIFETIME = 15 * 60
SESSION_LIFETIME = 30 * 86400
CHALLENGE_LIFETIME = 30 * 60


class ChallengePurpose(StrEnum):
    VERIFY_EMAIL = "verify"
    RESET_PASSWORD = "reset"


@dataclass(frozen=True)
class EmailAddress:
    value: str

    def __post_init__(self) -> None:
        normalized = self.value.strip().lower()
        parts = normalized.split("@")
        if len(normalized) > 255 or len(parts) != 2 or not all(parts):
            raise InvalidRegistration("メールアドレスを確認してください")
        object.__setattr__(self, "value", normalized)


@dataclass(frozen=True)
class DisplayName:
    value: str

    def __post_init__(self) -> None:
        normalized = self.value.strip()
        if not 1 <= len(normalized) <= 100:
            raise InvalidRegistration("ユーザー名は1〜100文字で入力してください")
        object.__setattr__(self, "value", normalized)


def validate_password(password: str) -> None:
    if not 12 <= len(password) <= 128:
        raise InvalidRegistration("パスワードは12〜128文字で入力してください")
