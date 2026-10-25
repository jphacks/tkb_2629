from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from backend.shared.presentation.auth import get_current_user_id

from ..application.profiles import ProfileService
from ..application.results import UserSummary
from .dependencies import get_profile_service
from .schemas import UserOutput

router = APIRouter(prefix="/users", tags=["users"])
Profiles = Annotated[ProfileService, Depends(get_profile_service)]
CurrentUserId = Annotated[int, Depends(get_current_user_id)]


class UserUpdate(BaseModel):
    name: str = Field(max_length=100)
    email: str = Field(max_length=255)


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
