from collections.abc import Sequence

from ..domain.errors import InvalidSession, UserNotFound
from ..domain.policies import UserAccessPolicy
from ..domain.values import DisplayName, EmailAddress
from .ports import UnitOfWorkFactory
from .results import PublicProfile, UserSummary


class ProfileService:
    def __init__(self, units: UnitOfWorkFactory):
        self.units = units

    def public_display_names(self, user_ids: Sequence[int]) -> dict[int, str]:
        with self.units() as unit:
            return unit.profiles.public_display_names(user_ids)

    def get(self, actor_id: int, user_id: int) -> UserSummary:
        UserAccessPolicy.require_owner(actor_id, user_id)
        with self.units() as unit:
            profile = unit.profiles.get(user_id)
            if profile is None:
                raise UserNotFound("User not found")
            return profile

    def get_public_profile(self, actor_id: int, user_id: int) -> PublicProfile:
        UserAccessPolicy.require_owner(actor_id, user_id)
        with self.units() as unit:
            return unit.profiles.get_public_profile(user_id)

    def update_public_display_name(self, actor_id: int, user_id: int, name: str) -> PublicProfile:
        UserAccessPolicy.require_owner(actor_id, user_id)
        name_value = DisplayName(name)
        with self.units() as unit:
            profile = unit.profiles.update_public_display_name(user_id, name_value.value)
            unit.commit()
            return profile

    def update(self, actor_id: int, user_id: int, name: str, email: str) -> UserSummary:
        UserAccessPolicy.require_owner(actor_id, user_id)
        name_value = DisplayName(name)
        with self.units() as unit:
            identity = unit.identities.get(user_id, lock=True)
            if identity is None:
                raise InvalidSession("ログインし直してください")
            UserAccessPolicy.require_unchanged_email(identity.email, EmailAddress(email))
            profile = unit.profiles.update_name(user_id, name_value.value)
            unit.commit()
            return profile

    def delete(self, actor_id: int, user_id: int) -> None:
        UserAccessPolicy.require_owner(actor_id, user_id)
        with self.units() as unit:
            unit.identities.get(user_id, lock=True)
            unit.profiles.delete(user_id)
            unit.commit()
