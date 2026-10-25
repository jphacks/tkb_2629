from dataclasses import dataclass, field

from .errors import EmailNotVerified, InvalidChallenge, InvalidSession, RevokedSession
from .values import SESSION_LIFETIME, ChallengePurpose, EmailAddress


@dataclass(frozen=True)
class VerificationChallenge:
    digest: str
    user_id: int
    purpose: ChallengePurpose
    expires: int

    def require_usable(self, user_id: int, purpose: ChallengePurpose, now: int) -> None:
        if self.user_id != user_id or self.purpose != purpose or self.expires <= now:
            raise InvalidChallenge("確認トークンが無効か、有効期限が切れています")


@dataclass
class Identity:
    """Credential aggregate. Its ID is the existing application's user_id."""

    user_id: int
    email: EmailAddress
    password_hash: str = field(repr=False)
    verified: bool = False

    def require_verified(self) -> None:
        if not self.verified:
            raise EmailNotVerified("メール確認を完了してください。確認画面から再送できます")

    def provision_verified_credentials(self, password_hash: str) -> None:
        """Install credentials supplied through a trusted provisioning use case."""
        self.password_hash = password_hash
        self.verified = True

    def verify_email(self, challenge: VerificationChallenge, now: int) -> None:
        challenge.require_usable(self.user_id, ChallengePurpose.VERIFY_EMAIL, now)
        self.verified = True

    def reset_password(
        self, challenge: VerificationChallenge, password_hash: str, now: int
    ) -> None:
        challenge.require_usable(self.user_id, ChallengePurpose.RESET_PASSWORD, now)
        self.password_hash = password_hash


@dataclass
class LoginSession:
    """A refresh grant; rotation retains the family's original expiry."""

    id: str
    user_id: int
    family_id: str
    refresh_hash: str = field(repr=False)
    expires: int
    revoked: bool = False

    @classmethod
    def start(cls, session_id: str, user_id: int, refresh_hash: str, now: int) -> "LoginSession":
        return cls(session_id, user_id, session_id, refresh_hash, now + SESSION_LIFETIME)

    def require_active(self, user_id: int, now: int) -> None:
        if self.user_id != user_id or self.expires <= now:
            raise InvalidSession("ログインし直してください")
        if self.revoked:
            raise RevokedSession("ログインし直してください")

    def rotate(self, session_id: str, refresh_hash: str, now: int) -> "LoginSession":
        self.require_active(self.user_id, now)
        self.revoked = True
        return LoginSession(session_id, self.user_id, self.family_id, refresh_hash, self.expires)
