from __future__ import annotations

from dataclasses import dataclass

from .errors import InvalidInput


@dataclass(init=False)
class ReviewText:
    _value: str

    def __init__(self, value: str) -> None:
        normalized_value = value.strip()
        if len(normalized_value) < 1 or len(normalized_value) > 140:
            raise InvalidInput("review_text must contain between 1 and 140 characters")
        self._value = normalized_value

    @property
    def value(self) -> str:
        return self._value


@dataclass(frozen=True)
class ReviewPage:
    value: int
    total_pages: int

    def __post_init__(self) -> None:
        if not 1 <= self.value <= self.total_pages:
            raise InvalidInput("page_number must be between 1 and total_pages")
