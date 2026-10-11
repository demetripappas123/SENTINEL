import json
import urllib.request

import pytest
from agent.sentinel_session import bind_authorization
from agent.tools.sentinel import search_assets


class Response:
    def __init__(self, body: bytes) -> None:
        self._body = body

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


@pytest.mark.asyncio
async def test_search_posts_the_forwarded_session(monkeypatch):
    captured = {}

    def urlopen(request, timeout=0):
        captured["url"] = request.full_url
        captured["header"] = request.get_header("Authorization")
        captured["body"] = json.loads(request.data.decode())
        return Response(b'{"status":"success","data":{"assets":[]}}')

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    with bind_authorization("Bearer operator-token"):
        result = await search_assets.ainvoke({"query": "pump", "limit": 5})

    assert captured["url"].endswith("/internal/agent/tools/search-assets")
    assert captured["header"] == "Bearer operator-token"
    assert captured["body"] == {"query": "pump", "limit": 5}
    assert "success" in result


@pytest.mark.asyncio
async def test_a_missing_session_does_not_call_the_api(monkeypatch):
    def urlopen(request, timeout=0):
        raise AssertionError("the tool called the API without a session")

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    with bind_authorization(None):
        result = await search_assets.ainvoke({"query": "pump"})
    assert "not forwarded" in result
