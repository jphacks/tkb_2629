from ..domain.entities import Identity
from ..domain.errors import RegistrationConflict
from ..domain.values import ChallengePurpose, DisplayName, EmailAddress, validate_password
from .errors import IdentityConfigurationError
from .ports import Passwords, UnitOfWorkFactory
from .results import UserSummary


class DevelopmentUserProvisioner:
    """Persist a verified local account without SMTP or a public registration endpoint."""

    def __init__(self, units: UnitOfWorkFactory, passwords: Passwords, *, enabled: bool):
        self.units = units
        self.passwords = passwords
        self.enabled = enabled

    def provision(self, email: str, password: str, name: str | None = None) -> UserSummary:
        if not self.enabled:
            raise IdentityConfigurationError(
                "開発用ユーザー作成はAPP_ENV=developmentでのみ実行できます"
            )
        address = EmailAddress(email)
        display_name = DisplayName(name) if name is not None else None
        validate_password(password)
        password_hash = self.passwords.hash(password)
        with self.units() as unit:
            # Match the mutation lock order used by login, password reset and profile editing.
            identity = unit.identities.find_by_email(address.value, lock=True)
            if identity is not None:
                profile = unit.profiles.get(identity.user_id)
                if profile is None or EmailAddress(profile.email) != address:
                    raise RegistrationConflict(
                        "プロフィールと認証情報のメールアドレスが一致しません"
                    )
            else:
                profile = unit.profiles.find_by_email(address.value)
                if profile is None:
                    profile = unit.profiles.create(
                        display_name.value if display_name else "開発ユーザー", address.value
                    )
                identity = unit.identities.get(profile.id, lock=True)
                if identity is not None and identity.email != address:
                    raise RegistrationConflict(
                        "このユーザーには別のメールアドレスの認証情報があります"
                    )
            if display_name is not None:
                profile = unit.profiles.update_name(profile.id, display_name.value)
            if identity is None:
                identity = Identity(profile.id, address, password_hash)
                identity.provision_verified_credentials(password_hash)
                unit.identities.add(identity)
            else:
                identity.provision_verified_credentials(password_hash)
                unit.identities.save(identity)
            unit.sessions.revoke_user(profile.id)
            for purpose in ChallengePurpose:
                unit.challenges.remove_for_user(profile.id, purpose)
            unit.commit()
            return profile
