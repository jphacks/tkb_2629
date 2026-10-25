from collections.abc import Sequence

from backend.identity import public as identity
from backend.reviews import public as reviews


class IdentityPublicAuthorGateway:
    def __init__(self, service: identity.PublicProfileAccess):
        self.service = service

    def display_names(self, user_ids: Sequence[int]) -> dict[int, str]:
        try:
            return self.service.public_display_names(user_ids)
        except identity.IdentityServiceUnavailable as error:
            raise reviews.ServiceUnavailable(str(error)) from error
