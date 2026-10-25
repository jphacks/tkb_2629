from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, StrictStr

from backend.shared.presentation.auth import get_current_user_id

from ..application.profiles import ProfileService
from ..application.results import PublicProfile, UserSummary
from .dependencies import get_profile_service
from .schemas import UserOutput

router = APIRouter(prefix="/users", tags=["users"])
Profiles = Annotated[ProfileService, Depends(get_profile_service)]
CurrentUserId = Annotated[int, Depends(get_current_user_id)]


class UserUpdate(BaseModel):
    name: str = Field(max_length=100)
    email: str = Field(max_length=255)


class PublicProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    public_display_name: StrictStr


class PublicProfileOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_display_name: str | None


@router.get("/me/public-profile", response_model=PublicProfileOutput)
def get_public_profile(service: Profiles, current_user_id: CurrentUserId) -> PublicProfile:
    return service.get_public_profile(current_user_id, current_user_id)


@router.put("/me/public-profile", response_model=PublicProfileOutput)
def update_public_profile(
    body: PublicProfileUpdate, service: Profiles, current_user_id: CurrentUserId
) -> PublicProfile:
    return service.update_public_display_name(
        current_user_id, current_user_id, body.public_display_name
    )


@router.get("", response_model=list[UserOutput])
def list_users(service: Profiles, current_user_id: CurrentUserId) -> list[UserSummary]:
    return [service.get(current_user_id, current_user_id)]


@router.get("/{user_id}", response_model=UserOutput)
def get_user(user_id: int, service: Profiles, current_user_id: CurrentUserId) -> UserSummary:
    return service.get(current_user_id, user_id)


@router.put("/{user_id}", response_model=UserOutput)
def update_user(
    user_id: int, body: UserUpdate, service: Profiles, current_user_id: CurrentUserId
) -> UserSummary:
    return service.update(current_user_id, user_id, body.name, body.email)


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, service: Profiles, current_user_id: CurrentUserId) -> None:
    service.delete(current_user_id, user_id)
