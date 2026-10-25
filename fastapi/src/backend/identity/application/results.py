from dataclasses import dataclass, field

from ..domain.values import ACCESS_TOKEN_LIFETIME, ChallengePurpose


@dataclass(frozen=True)
class UserSummary:
    id: int
    name: str
    email: str


@dataclass(frozen=True)
class PublicProfile:
    public_display_name: str | None


@dataclass(frozen=True)
class SessionTokens:
    access_token: str = field(repr=False)
    refresh_token: str = field(repr=False)
    user: UserSummary
    expires_in: int = ACCESS_TOKEN_LIFETIME
    token_type: str = "bearer"


@dataclass(frozen=True)
class AccessClaims:
    user_id: int
    session_id: str
    issued_at: int
    expires_at: int


@dataclass(frozen=True)
class ChallengeMail:
    email: str
    purpose: ChallengePurpose
    token: str = field(repr=False)
    expires_in: int
