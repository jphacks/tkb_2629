from __future__ import annotations

import json
import logging
import os
from collections.abc import Mapping
from typing import Any

import httpx
from redis import Redis
from redis.exceptions import RedisError

from ..application.ports import BookCatalog
from ..domain.catalog import CatalogBook
from ..domain.errors import ExternalServiceError, NotFound

GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"
CACHE_TTL_SECONDS = 30 * 24 * 60 * 60
logger = logging.getLogger(__name__)


class GoogleBooksCatalog(BookCatalog):
    def __init__(
        self,
        client: httpx.Client | None = None,
        api_key: str | None = None,
        cache: Redis | None = None,
    ) -> None:
        self._client = client
        self._api_key = api_key if api_key is not None else os.getenv("BOOKS_API")
        self._cache = cache

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
                self._store(book.google_books_id, item)
                books.append(book)
        return books

    def get(self, google_books_id: str) -> CatalogBook:
        if self._cache is not None:
            try:
                cached = self._cache.get(self._cache_key(google_books_id))
                if cached is not None:
                    book = self._parse_book(json.loads(cached))
                    if book is not None and book.google_books_id == google_books_id:
                        return book
            except (RedisError, ValueError, TypeError):
                logger.warning("Google Books cache read failed; fetching from API")
        payload = self._request(f"{GOOGLE_BOOKS_URL}/{google_books_id}")
        book = self._parse_book(payload)
        if book is None:
            raise NotFound("Google Books volume is missing required book information")
        self._store(google_books_id, payload)
        return book

    @staticmethod
    def _cache_key(google_books_id: str) -> str:
        return f"google_books:v1:{google_books_id}"

    def _store(self, google_books_id: str, payload: object) -> None:
        if self._cache is None:
            return
        try:
            # Set value and expiry atomically. Reads never extend the retention period.
            self._cache.set(
                self._cache_key(google_books_id), json.dumps(payload), ex=CACHE_TTL_SECONDS
            )
        except RedisError:
            logger.warning("Google Books cache write failed")

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
