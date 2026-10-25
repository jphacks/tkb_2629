from __future__ import annotations

from ..application.errors import ServiceUnavailable
from ..application.service import LibraryService


def get_library_service() -> LibraryService:
    raise ServiceUnavailable("library service is not configured")
