import time
from unittest.mock import Mock, patch

import fakeredis
import httpx
import pytest
from redis.exceptions import ConnectionError as RedisConnectionError

from backend.domain.errors import ExternalServiceError, NotFound
from backend.infrastructure.google_books import GoogleBooksCatalog

VOLUME = {"id": "volume-1", "volumeInfo": {"title": "Book", "pageCount": 180}}
TTL = 24 * 60 * 60


def test_cache_is_shared_across_catalogs_and_expires_after_24_hours():
    cache = fakeredis.FakeRedis()
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json=VOLUME)

    with _client(handler) as client:
        first = GoogleBooksCatalog(client=client, cache=cache).get("volume-1")
        assert len(requests) == 1
        key = "google_books:v1:volume-1"
        assert TTL - 1 <= cache.ttl(key) <= TTL
        now = time.time()
        with patch("time.time", return_value=now + TTL - 10):
            assert GoogleBooksCatalog(client=client, cache=cache).get("volume-1") == first
            assert len(requests) == 1
            assert 0 < cache.ttl(key) <= 10  # Reading must not reset the TTL.
        with patch("time.time", return_value=now + TTL + 1):
            assert cache.get(key) is None
            assert GoogleBooksCatalog(client=client, cache=cache).get("volume-1") == first
            assert len(requests) == 2
            assert TTL - 1 <= cache.ttl(key) <= TTL


def test_search_seeds_id_cache():
    cache = fakeredis.FakeRedis()
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json={"items": [VOLUME]})

    with _client(handler) as client:
        catalog = GoogleBooksCatalog(client=client, cache=cache)
        books = catalog.search("Book", 5)
        assert catalog.get("volume-1") == books[0]
    assert len(requests) == 1
    assert TTL - 1 <= cache.ttl("google_books:v1:volume-1") <= TTL


@pytest.mark.parametrize("cached", [b"not-json", b"null", b'{"id":"wrong"}'])
def test_invalid_cache_is_replaced(cached):
    cache = fakeredis.FakeRedis()
    cache.set("google_books:v1:volume-1", cached, ex=TTL)
    with _client(lambda request: httpx.Response(200, json=VOLUME)) as client:
        assert GoogleBooksCatalog(client=client, cache=cache).get("volume-1").title == "Book"
    assert cache.get("google_books:v1:volume-1") != cached


def test_redis_failure_falls_back_to_api():
    cache = Mock()
    cache.get.side_effect = RedisConnectionError()
    cache.set.side_effect = RedisConnectionError()
    with _client(lambda request: httpx.Response(200, json=VOLUME)) as client:
        assert GoogleBooksCatalog(client=client, cache=cache).get("volume-1").title == "Book"


def test_api_error_is_not_cached():
    cache = fakeredis.FakeRedis()
    with _client(lambda request: httpx.Response(404)) as client:
        with pytest.raises(NotFound):
            GoogleBooksCatalog(client=client, cache=cache).get("missing")
    assert cache.dbsize() == 0


def _client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_search_maps_google_volume_metadata():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["q"] == "銀河鉄道の夜"
        assert request.url.params["maxResults"] == "5"
        return httpx.Response(
            200,
            json={
                "items": [
                    {
                        "id": "volume-1",
                        "volumeInfo": {
                            "title": "銀河鉄道の夜",
                            "authors": ["宮沢賢治"],
                            "pageCount": 180,
                            "industryIdentifiers": [
                                {"type": "ISBN_13", "identifier": "9781234567890"}
                            ],
                            "imageLinks": {"thumbnail": "http://example.test/cover.jpg"},
                        },
                    },
                    {
                        "id": "missing-pages",
                        "volumeInfo": {"title": "ページ数不明"},
                    },
                ]
            },
        )

    with _client(handler) as client:
        books = GoogleBooksCatalog(client=client, api_key="test-key").search("銀河鉄道の夜", 5)

    assert len(books) == 1
    assert books[0].google_books_id == "volume-1"
    assert books[0].author == "宮沢賢治"
    assert books[0].thumbnail_url == "https://example.test/cover.jpg"


def test_get_translates_missing_volume():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": "missing"})

    with _client(handler) as client:
        with pytest.raises(NotFound):
            GoogleBooksCatalog(client=client).get("missing")


def test_search_translates_invalid_response():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"not-json")

    with _client(handler) as client:
        with pytest.raises(ExternalServiceError):
            GoogleBooksCatalog(client=client).search("book", 10)
