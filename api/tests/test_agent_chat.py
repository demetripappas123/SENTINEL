import json
import urllib.error
import urllib.request

from fastapi.testclient import TestClient

from app.auth.deps import require_user
from app.auth.store import UserAccount
from app.main import app
from app.services.agent import chat as chat_service
from app.services.agent.chat import reply_text

client = TestClient(app)
USER = UserAccount(
    id="usr_north",
    email="operator.north@sentinel.local",
    name="North Operator",
    organization_id="org_north",
    organization_name="North Yard",
    password_hash="x",
)


class Response:
    def __init__(self, body: bytes, status: int = 200) -> None:
        self._body = body
        self.status = status

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def test_reply_text_uses_the_last_assistant_message():
    text = reply_text(
        {
            "status": "completed",
            "output": {
                "status": "completed",
                "output": [
                    {"type": "human", "content": "Which pump?"},
                    {"type": "ai", "content": [{"type": "text", "text": "Pump 1 is on the queue."}]},
                ],
            },
        }
    )
    assert text == "Pump 1 is on the queue."


def test_chat_forwards_the_session_without_storing_the_token(monkeypatch):
    captured = {}

    def urlopen(request, timeout=0):
        captured["url"] = request.full_url
        captured["header"] = request.get_header("X-sentinel-authorization")
        captured["body"] = json.loads(request.data.decode())
        captured["timeout"] = timeout
        return Response(
            json.dumps(
                {"status": "completed", "output": {"output": [{"type": "ai", "content": "Pump 1."}]}}
            ).encode()
        )

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    monkeypatch.setattr(chat_service.urllib.request, "urlopen", urlopen)
    app.dependency_overrides[require_user] = lambda: USER
    try:
        response = client.post(
            "/api/agent/chat",
            json={"message": "Which pump is failing?", "session_id": "session-123"},
            headers={"Authorization": "Bearer operator-token"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["reply"] == "Pump 1."
    assert captured["url"].endswith("/api/invocations")
    assert captured["header"] == "Bearer operator-token"
    assert captured["body"]["input"]["actor"] == "usr_north"
    assert "operator-token" not in json.dumps(captured["body"])
    assert captured["body"]["input"]["messages"] == [
        {"role": "user", "content": "Which pump is failing?"}
    ]


def test_chat_reports_when_the_assistant_is_down(monkeypatch):
    def urlopen(request, timeout=0):
        raise urllib.error.URLError("connection refused")

    monkeypatch.setattr(chat_service.urllib.request, "urlopen", urlopen)
    app.dependency_overrides[require_user] = lambda: USER
    try:
        response = client.post(
            "/api/agent/chat",
            json={"message": "Which pump is failing?", "session_id": "session-123"},
            headers={"Authorization": "Bearer operator-token"},
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 503


def test_chat_rejects_a_body_that_names_an_organization():
    app.dependency_overrides[require_user] = lambda: USER
    try:
        response = client.post(
            "/api/agent/chat",
            json={
                "message": "Which pump is failing?",
                "session_id": "session-123",
                "organization_id": "org_south",
            },
            headers={"Authorization": "Bearer operator-token"},
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 422
