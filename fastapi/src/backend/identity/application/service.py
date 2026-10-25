from ..domain.entities import Identity, LoginSession, VerificationChallenge
from ..domain.errors import InvalidChallenge, InvalidCredentials, InvalidSession, RevokedSession
from ..domain.policies import AuthenticationAction, UserAccessPolicy
from ..domain.values import (
    ACCESS_TOKEN_LIFETIME,
    CHALLENGE_LIFETIME,
    ChallengePurpose,
    DisplayName,
    EmailAddress,
    validate_password,
)
from .ports import AccessTokens, Clock, Mailer, Passwords, SecretTokens, UnitOfWorkFactory
from .rate_limiter import AuthenticationRateLimiter
from .results import AccessClaims, ChallengeMail, SessionTokens, UserSummary


class AuthenticationService:
    """Coordinates use cases, ports and transactions without HTTP or ORM dependencies."""

    def __init__(
        self,
        units: UnitOfWorkFactory,
        passwords: Passwords,
        secrets: SecretTokens,
        access_tokens: AccessTokens,
        mailer: Mailer,
        clock: Clock,
        limiter: AuthenticationRateLimiter,
        dummy_hash: str,
    ):
        self.units = units
        self.passwords = passwords
        self.secrets = secrets
        self.access_tokens = access_tokens
        self.mailer = mailer
        self.clock = clock
        self.limiter = limiter
        self.dummy_hash = dummy_hash

    def register(
        self, name: str, email: str, password: str, *, client: str, name_is_public: bool = False
    ) -> None:
        address = EmailAddress(email)
        display_name = DisplayName(name)
        self.limiter.check(AuthenticationAction.REGISTER, client, address.value)
        validate_password(password)
        password_hash = self.passwords.hash(password)
        with self.units() as unit:
            # The identity context owns both the profile and its credentials.
            profile = unit.profiles.create(display_name.value, address.value)
            if name_is_public:
                unit.profiles.update_public_display_name(profile.id, display_name.value)
            identity = Identity(profile.id, address, password_hash)
            unit.identities.add(identity)
            unit.commit()
        self._send_challenge(address, ChallengePurpose.VERIFY_EMAIL)

    def send_verification(self, email: str, *, client: str) -> None:
        address = EmailAddress(email)
        self.limiter.check(AuthenticationAction.VERIFICATION_MAIL, client, address.value)
        self._send_challenge(address, ChallengePurpose.VERIFY_EMAIL)

    def request_password_reset(self, email: str, *, client: str) -> None:
        address = EmailAddress(email)
        self.limiter.check(AuthenticationAction.RESET_MAIL, client, address.value)
        self._send_challenge(address, ChallengePurpose.RESET_PASSWORD)

    def _send_challenge(self, email: EmailAddress, purpose: ChallengePurpose) -> None:
        token = self.secrets.create()
        now = self.clock.now()
        with self.units() as unit:
            identity = unit.identities.find_by_email(email.value, lock=True)
            if identity is None or (purpose == ChallengePurpose.VERIFY_EMAIL and identity.verified):
                return
            challenge = VerificationChallenge(
                self.secrets.digest(token), identity.user_id, purpose, now + CHALLENGE_LIFETIME
            )
            unit.challenges.add(challenge)
            unit.commit()
        # External I/O occurs after commit, outside DB locks. Delivery can be retried.
        self.mailer.send(ChallengeMail(email.value, purpose, token, CHALLENGE_LIFETIME))

    def verify_email(self, token: str, *, client: str) -> None:
        self.limiter.check(AuthenticationAction.VERIFY, client)
        self._consume_challenge(token, ChallengePurpose.VERIFY_EMAIL)

    def reset_password(self, token: str, password: str, *, client: str) -> None:
        self.limiter.check(AuthenticationAction.RESET_PASSWORD, client)
        validate_password(password)
        password_hash = self.passwords.hash(password)
        self._consume_challenge(token, ChallengePurpose.RESET_PASSWORD, password_hash)

    def _consume_challenge(
        self, token: str, purpose: ChallengePurpose, password_hash: str | None = None
    ) -> None:
        digest = self.secrets.digest(token)
        with self.units() as unit:
            challenge = unit.challenges.get(digest)
            if challenge is None:
                raise InvalidChallenge("確認トークンが無効か、有効期限が切れています")
            # Always lock credentials first, then grants, across all mutation use cases.
            identity = unit.identities.get(challenge.user_id, lock=True)
            challenge = unit.challenges.get(digest, lock=True)
            if identity is None or challenge is None:
                raise InvalidChallenge("確認トークンが無効か、有効期限が切れています")
            now = self.clock.now()
            if purpose == ChallengePurpose.VERIFY_EMAIL:
                identity.verify_email(challenge, now)
            else:
                if password_hash is None:
                    raise ValueError("Password reset requires a password hash")
                identity.reset_password(challenge, password_hash, now)
                unit.sessions.revoke_user(identity.user_id)
            unit.identities.save(identity)
            unit.challenges.remove_for_user(identity.user_id, purpose)
            unit.commit()

    def _tokens(self, user: UserSummary, session: LoginSession, refresh: str) -> SessionTokens:
        now = self.clock.now()
        claims = AccessClaims(
            user.id, session.id, now, min(now + ACCESS_TOKEN_LIFETIME, session.expires)
        )
        return SessionTokens(
            self.access_tokens.issue(claims),
            refresh,
            user,
            expires_in=claims.expires_at - claims.issued_at,
        )

    def login(self, email: str, password: str, *, client: str) -> SessionTokens:
        address = EmailAddress(email)
        self.limiter.check(AuthenticationAction.LOGIN, client, address.value)
        with self.units() as unit:
            identity = unit.identities.find_by_email(address.value, lock=True)
            valid = self.passwords.verify(
                identity.password_hash if identity else self.dummy_hash, password
            )
            if identity is None or not valid:
                raise InvalidCredentials("メールアドレスまたはパスワードが違います")
            identity.require_verified()
            user = unit.profiles.get(identity.user_id)
            if user is None:
                raise InvalidCredentials("メールアドレスまたはパスワードが違います")
            refresh = self.secrets.create()
            session = LoginSession.start(
                self.secrets.create(),
                identity.user_id,
                self.secrets.digest(refresh),
                self.clock.now(),
            )
            unit.sessions.add(session)
            result = self._tokens(user, session, refresh)
            unit.commit()
            return result

    def refresh(self, token: str, *, client: str) -> SessionTokens:
        self.limiter.check(AuthenticationAction.REFRESH, client)
        digest = self.secrets.digest(token)
        with self.units() as unit:
            session = unit.sessions.find_by_refresh(digest)
            if session is None:
                raise InvalidSession("ログインし直してください")
            identity = unit.identities.get(session.user_id, lock=True)
            session = unit.sessions.find_by_refresh(digest, lock=True)
            if identity is None or session is None:
                raise InvalidSession("ログインし直してください")
            refresh = self.secrets.create()
            try:
                replacement = session.rotate(
                    self.secrets.create(), self.secrets.digest(refresh), self.clock.now()
                )
            except RevokedSession:
                unit.sessions.revoke_family(session.family_id)
                # This security response must survive the subsequent error response.
                unit.commit()
                raise InvalidSession("ログインし直してください") from None
            identity.require_verified()
            user = unit.profiles.get(identity.user_id)
            if user is None:
                raise InvalidSession("ログインし直してください")
            unit.sessions.save(session)
            unit.sessions.add(replacement)
            result = self._tokens(user, replacement, refresh)
            unit.commit()
            return result

    def logout(self, token: str, *, client: str) -> None:
        self.limiter.check(AuthenticationAction.LOGOUT, client)
        digest = self.secrets.digest(token)
        with self.units() as unit:
            session = unit.sessions.find_by_refresh(digest)
            if session is not None:
                unit.identities.get(session.user_id, lock=True)
                unit.sessions.revoke_family(session.family_id)
            unit.commit()

    def authenticate(self, token: str) -> UserSummary:
        claims = self.access_tokens.decode(token)
        with self.units() as unit:
            identity = unit.identities.get(claims.user_id)
            session = unit.sessions.get(claims.session_id)
            if identity is None or session is None:
                raise InvalidSession("ログインし直してください")
            identity.require_verified()
            session.require_active(identity.user_id, self.clock.now())
            user = unit.profiles.get(identity.user_id)
            if user is None:
                raise InvalidSession("ログインし直してください")
            return user

    def authorize_user(self, actor_id: int, user_id: int) -> None:
        UserAccessPolicy.require_owner(actor_id, user_id)

    def authorize_profile_update(self, actor_id: int, user_id: int, email: str) -> None:
        UserAccessPolicy.require_owner(actor_id, user_id)
        with self.units() as unit:
            identity = unit.identities.get(user_id)
            if identity is None:
                raise InvalidSession("ログインし直してください")
            UserAccessPolicy.require_unchanged_email(identity.email, EmailAddress(email))
