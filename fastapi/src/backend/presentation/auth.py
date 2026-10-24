import os

from fastapi import HTTPException, Request, status


def get_current_user_id(request: Request) -> int:
    """Resolve an authenticated user, or an explicitly enabled development user."""
    if os.getenv("AUTH_DISABLED", "false").strip().lower() == "true":
        if os.getenv("APP_ENV", "production").strip().lower() != "development":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication bypass requires APP_ENV=development",
            )
        try:
            dev_user_id = int(os.getenv("DEV_USER_ID", ""))
        except ValueError:
            dev_user_id = 0
        if dev_user_id < 1:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="DEV_USER_ID must be a positive integer",
            )
        return dev_user_id

    user_id = getattr(request.state, "user_id", None)
    try:
        parsed_user_id = int(user_id)
    except (TypeError, ValueError):
        parsed_user_id = 0
    if parsed_user_id < 1:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required",
        )
    return parsed_user_id
