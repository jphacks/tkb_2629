from dataclasses import dataclass

from .errors import InvalidInput


@dataclass(frozen=True)
class UserDetails:
    name: str
    email: str

    def __post_init__(self) -> None:
        if len(self.name) > 100:
            raise InvalidInput("name must not exceed 100 characters")
        if len(self.email) > 255:
            raise InvalidInput("email must not exceed 255 characters")


@dataclass(init=False)

class BookDetails:
    _title: str
    _author: str | None
    _total_pages: int

    def __init__(self, title: str, author: str | None, total_pages: int) -> None:
        normalized_title = title.strip()
        normalized_author = None
        if author is not None:
            normalized_author = author.strip()

        if len(normalized_title) < 1 or len(normalized_title) > 255:
            raise InvalidInput("title must contain between 1 and 255 characters")
        if normalized_author is not None and len(normalized_author) > 255:
            raise InvalidInput("author must not exceed 255 characters")
        if total_pages < 1 or total_pages > 1_000_000:
            raise InvalidInput("total_pages must be between 1 and 1000000")

        self._title = normalized_title
        self._author = normalized_author
        self._total_pages = total_pages

    @property
    def title(self) -> str:
        return self._title

    @property
    def author(self) -> str | None:
        return self._author

    @property
    def total_pages(self) -> int:
        return self._total_pages


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
