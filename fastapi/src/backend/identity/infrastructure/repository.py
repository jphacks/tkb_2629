"""Data mapping and SQL only. Transaction and authentication policy live in application/domain."""

import hashlib
from collections.abc import Sequence

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..application.results import PublicProfile, UserSummary
from ..domain.entities import Identity, LoginSession, VerificationChallenge
from ..domain.errors import RegistrationConflict, UserNotFound
from ..domain.values import ChallengePurpose, EmailAddress
from .models import AuthSession, Challenge, Credential, RateLimit, User


class SqlIdentityRepository:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _entity(row: Credential | None) -> Identity | None:
        if row is None:
            return None
        return Identity(row.user_id, EmailAddress(row.email), row.password_hash, row.verified)

    def find_by_email(self, email: str, *, lock: bool = False) -> Identity | None:
        statement = select(Credential).where(Credential.email == email)
        if lock:
            statement = statement.with_for_update()
        return self._entity(self.db.scalar(statement.execution_options(populate_existing=True)))

    def get(self, user_id: int, *, lock: bool = False) -> Identity | None:
        statement = select(Credential).where(Credential.user_id == user_id)
        if lock:
            statement = statement.with_for_update()
        return self._entity(self.db.scalar(statement.execution_options(populate_existing=True)))

    def add(self, identity: Identity) -> None:
        self.db.add(
            Credential(
                user_id=identity.user_id,
                email=identity.email.value,
                password_hash=identity.password_hash,
                verified=identity.verified,
            )
        )
        try:
            self.db.flush()
        except IntegrityError:
            raise RegistrationConflict(
                "登録できませんでした。ログインまたはメール確認の再送をお試しください"
            ) from None

    def save(self, identity: Identity) -> None:
        self.db.execute(
            update(Credential)
            .where(Credential.user_id == identity.user_id)
            .values(
                email=identity.email.value,
                password_hash=identity.password_hash,
                verified=identity.verified,
            )
        )


class SqlSessionRepository:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _entity(row: AuthSession | None) -> LoginSession | None:
        if row is None:
            return None
        return LoginSession(
            row.id, row.user_id, row.family_id, row.refresh_hash, row.expires, row.revoked
        )

    def get(self, session_id: str) -> LoginSession | None:
        return self._entity(self.db.get(AuthSession, session_id))

    def find_by_refresh(self, digest: str, *, lock: bool = False) -> LoginSession | None:
        statement = select(AuthSession).where(AuthSession.refresh_hash == digest)
        if lock:
            statement = statement.with_for_update()
        return self._entity(self.db.scalar(statement.execution_options(populate_existing=True)))

    def add(self, session: LoginSession) -> None:
        self.db.add(
            AuthSession(
                id=session.id,
                user_id=session.user_id,
                family_id=session.family_id,
                refresh_hash=session.refresh_hash,
                expires=session.expires,
                revoked=session.revoked,
            )
        )

    def save(self, session: LoginSession) -> None:
        self.db.execute(
            update(AuthSession)
            .where(AuthSession.id == session.id)
            .values(
                revoked=session.revoked,
            )
        )

    def revoke_family(self, family_id: str) -> None:
        self.db.execute(
            update(AuthSession)
            .where(AuthSession.family_id == family_id)
            .values(
                revoked=True,
            )
        )

    def revoke_user(self, user_id: int) -> None:
        self.db.execute(
            update(AuthSession).where(AuthSession.user_id == user_id).values(revoked=True)
        )


class SqlChallengeRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, digest: str, *, lock: bool = False) -> VerificationChallenge | None:
        statement = select(Challenge).where(Challenge.digest == digest)
        if lock:
            statement = statement.with_for_update()
        row = self.db.scalar(statement.execution_options(populate_existing=True))
        if row is None:
            return None
        return VerificationChallenge(
            row.digest, row.user_id, ChallengePurpose(row.purpose), row.expires
        )

    def add(self, challenge: VerificationChallenge) -> None:
        self.db.add(
            Challenge(
                digest=challenge.digest,
                user_id=challenge.user_id,
                purpose=challenge.purpose.value,
                expires=challenge.expires,
            )
        )

    def remove_for_user(self, user_id: int, purpose: ChallengePurpose) -> None:
        self.db.execute(
            delete(Challenge).where(
                Challenge.user_id == user_id,
                Challenge.purpose == purpose.value,
            )
        )


class SqlAttemptRepository:
    def __init__(self, db: Session):
        self.db = db

    def increment(self, key: str, expires: int) -> int:
        digest = hashlib.sha256(key.encode()).hexdigest()
        statement = insert(RateLimit).values(key=digest, count=1, expires=expires)
        count = self.db.scalar(
            statement.on_conflict_do_update(
                index_elements=[RateLimit.key],
                set_={"count": RateLimit.count + 1},
            ).returning(RateLimit.count)
        )
        if count is None:
            raise RuntimeError("Rate-limit increment returned no counter")
        return count

    def remove_expired(self, now: int) -> None:
        self.db.execute(delete(RateLimit).where(RateLimit.expires <= now))


class SqlProfileRepository:
    def __init__(self, db: Session):
        self.db = db

    def public_display_names(self, user_ids: Sequence[int]) -> dict[int, str]:
        ids = list(dict.fromkeys(user_ids))
        names: dict[int, str] = {}
        for offset in range(0, len(ids), 1000):
            rows = self.db.execute(
                select(User.id, User.public_display_name).where(
                    User.id.in_(ids[offset : offset + 1000]),
                    User.public_display_name.is_not(None),
                )
            )
            for user_id, name in rows:
                if name is not None and name.strip():
                    names[user_id] = name
        return names

    def create(self, name: str, email: str) -> UserSummary:
        row = User(name=name, email=email)
        self.db.add(row)
        try:
            self.db.flush()
        except IntegrityError:
            raise RegistrationConflict(
                "登録できませんでした。ログインまたはメール確認の再送をお試しください"
            ) from None
        return UserSummary(row.id, row.name, row.email)

    def get(self, user_id: int) -> UserSummary | None:
        row = self.db.get(User, user_id)
        return UserSummary(row.id, row.name, row.email) if row else None

    def find_by_email(self, email: str) -> UserSummary | None:
        rows = self.db.scalars(select(User).where(func.lower(func.trim(User.email)) == email)).all()
        if len(rows) > 1:
            raise RegistrationConflict("同じメールアドレスに対応するユーザーが複数存在します")
        row = rows[0] if rows else None
        return UserSummary(row.id, row.name, row.email) if row else None

    def update_name(self, user_id: int, name: str) -> UserSummary:
        row = self.db.get(User, user_id)
        if row is None:
            raise UserNotFound("User not found")
        row.name = name
        self.db.flush()
        return UserSummary(row.id, row.name, row.email)

    def get_public_profile(self, user_id: int) -> PublicProfile:
        row = self.db.get(User, user_id)
        if row is None:
            raise UserNotFound("User not found")
        return PublicProfile(row.public_display_name)

    def update_public_display_name(self, user_id: int, name: str) -> PublicProfile:
        row = self.db.get(User, user_id)
        if row is None:
            raise UserNotFound("User not found")
        row.public_display_name = name
        self.db.flush()
        return PublicProfile(row.public_display_name)

    def delete(self, user_id: int) -> None:
        row = self.db.get(User, user_id)
        if row is None:
            raise UserNotFound("User not found")
        self.db.delete(row)
