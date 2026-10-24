import httpx
import pytest

from backend.domain.errors import ExternalServiceError, NotFound
from backend.infrastructure.google_books import GoogleBooksCatalog


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
