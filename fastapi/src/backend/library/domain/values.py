from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .errors import InvalidInput


@dataclass(frozen=True)
class CoverStyle:
    color_mode: Literal["auto", "palette", "mine", "others"] = "auto"
    palette: int | None = None
    pattern: int | None = None

    def __post_init__(self) -> None:
        if self.color_mode not in ("auto", "palette", "mine", "others"):
            raise InvalidInput("Invalid cover color mode")
        if self.color_mode == "palette":
            if type(self.palette) is not int or not 0 <= self.palette <= 7:
                raise InvalidInput("Cover palette must be between 0 and 7")
        elif self.palette is not None:
            raise InvalidInput("Only palette mode accepts a palette")
        if self.pattern is not None and (
            type(self.pattern) is not int or not 0 <= self.pattern <= 3
        ):
            raise InvalidInput("Cover pattern must be between 0 and 3")


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
