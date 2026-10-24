from fastapi import HTTPException, Request, status


def get_current_user_id(request: Request) -> int:
    """Read the authenticated user ID set by trusted auth middleware."""
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