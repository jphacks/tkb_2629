from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any

import httpx

from ..application.ports import BookCatalog
from ..domain.catalog import CatalogBook
from ..domain.errors import ExternalServiceError, NotFound

GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"


class GoogleBooksCatalog(BookCatalog):
    def __init__(
        self,
        client: httpx.Client | None = None,
        api_key: str | None = None,
    ) -> None:
        self._client = client
        self._api_key = api_key if api_key is not None else os.getenv("BOOKS_API")

    def search(self, query: str, limit: int) -> list[CatalogBook]:
        payload = self._request(
            GOOGLE_BOOKS_URL,
            params={
                "q": query,
                "maxResults": limit,
                "printType": "books",
            },
        )
        items = payload.get("items", [])
        if not isinstance(items, list):
            return []
        books: list[CatalogBook] = []
        for item in items:
            book = self._parse_book(item)
            if book is not None:
                books.append(book)
        return books

    def get(self, google_books_id: str) -> CatalogBook:
        payload = self._request(f"{GOOGLE_BOOKS_URL}/{google_books_id}")
        book = self._parse_book(payload)
        if book is None:
            raise NotFound("Google Books volume is missing required book information")
        return book

    def _request(
        self,
        url: str,
        params: dict[str, object] | None = None,
    ) -> Mapping[str, Any]:
        request_params = dict(params or {})
        if self._api_key:
            request_params["key"] = self._api_key
        try:
            if self._client is None:
                with httpx.Client(timeout=10) as client:
                    response = client.get(url, params=request_params)
            else:
                response = self._client.get(url, params=request_params)
            if response.status_code == 404:
                raise NotFound("Google Books volume not found")
            response.raise_for_status()
            payload = response.json()
        except NotFound:
            raise
        except (httpx.HTTPError, ValueError) as error:
            raise ExternalServiceError("Google Books API request failed") from error
        if not isinstance(payload, Mapping):
            raise ExternalServiceError("Google Books API returned an invalid response")
        return payload

    @staticmethod
    def _parse_book(payload: object) -> CatalogBook | None:
        if not isinstance(payload, Mapping):
            return None
        google_books_id = payload.get("id")
        volume_info = payload.get("volumeInfo")
        if not isinstance(google_books_id, str) or not isinstance(volume_info, Mapping):
            return None

        title = volume_info.get("title")
        total_pages = volume_info.get("pageCount")
        if not isinstance(title, str) or not title.strip():
            return None
        normalized_title = title.strip()
        if len(normalized_title) > 255:
            return None
        if not isinstance(total_pages, int) or total_pages < 1:
            return None

        authors = volume_info.get("authors")
        author = None
        if isinstance(authors, list):
            normalized_authors = [value.strip() for value in authors if isinstance(value, str)]
            if normalized_authors:
                author = ", ".join(normalized_authors)
                if len(author) > 255:
                    return None

        isbn_13 = None
        identifiers = volume_info.get("industryIdentifiers")
        if isinstance(identifiers, list):
            for identifier in identifiers:
                if (
                    isinstance(identifier, Mapping)
                    and identifier.get("type") == "ISBN_13"
                    and isinstance(identifier.get("identifier"), str)
                ):
                    isbn_13 = identifier["identifier"]
                    break

        thumbnail_url = None
        image_links = volume_info.get("imageLinks")
        if isinstance(image_links, Mapping):
            thumbnail = image_links.get("thumbnail")
            if isinstance(thumbnail, str):
                thumbnail_url = thumbnail.replace("http://", "https://", 1)

        return CatalogBook(
            google_books_id=google_books_id,
            title=normalized_title,
            author=author,
            total_pages=total_pages,
            isbn_13=isbn_13,
            thumbnail_url=thumbnail_url,
        )
