"""Forward one operator message to the LangGraph app and return its answer.

The Sentinel bearer token travels in a request header. It is not written into
the invocation body, which the agent runtime stores.
"""
import json
import os
import urllib.error
import urllib.request
from uuid import uuid4


class AgentUnavailable(Exception):
    pass


class AgentFailed(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail


def operator_context(user) -> dict:
    """Who is signed in, and which facilities that organization owns."""
    facilities = []
    try:
        from app.db import connect
        from app.services.agent.read import facilities as facility_rows

        with connect() as conn:
            facilities = facility_rows(conn, user.organization_id)
    except Exception:
        facilities = []
    return {
        "user_id": user.id,
        "user_name": user.name,
        "organization_id": user.organization_id,
        "organization_name": user.organization_name,
        "facilities": [{"id": row["id"], "name": row["name"]} for row in facilities],
    }


def ask(message: str, session_id: str, actor: str, authorization: str, operator: dict) -> str:
    origin = os.environ.get("SENTINEL_AGENT_URL", "http://127.0.0.1:8010").rstrip("/")
    body = {
        "id": str(uuid4()),
        "session_id": session_id,
        "input": {
            "actor": actor,
            "operator": operator,
            "messages": [{"role": "user", "content": message}],
        },
    }
    request = urllib.request.Request(
        origin + "/api/invocations",
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "X-Sentinel-Authorization": authorization,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            payload = json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        raise AgentFailed(_error_detail(exc)) from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise AgentUnavailable() from exc
    return reply_text(payload)


def reply_text(payload: dict) -> str:
    output = payload.get("output")
    status = payload.get("status")
    if isinstance(output, dict):
        status = output.get("status") or status
        output = output.get("output")
    texts = [_content_text(item.get("content")) for item in _messages(output) if _is_assistant(item)]
    texts = [text for text in texts if text]
    if texts:
        return texts[-1]
    if status == "interrupted":
        return "The assistant paused before it finished."
    return "The assistant returned no answer."


def _messages(value) -> list[dict]:
    if isinstance(value, dict) and isinstance(value.get("content"), (str, list)):
        return [value]
    if not isinstance(value, list):
        return []
    found = []
    for item in value:
        if isinstance(item, dict) and isinstance(item.get("message"), dict):
            found.append(item["message"])
        elif isinstance(item, dict):
            found.append(item)
    return found


def _is_assistant(message: dict) -> bool:
    kind = message.get("type") or message.get("role")
    return kind in {"ai", "assistant"}


def _content_text(content) -> str:
    if isinstance(content, str):
        return content.strip()
    if not isinstance(content, list):
        return ""
    parts = []
    for block in content:
        if isinstance(block, str):
            parts.append(block)
        elif isinstance(block, dict):
            text = block.get("text") or block.get("content")
            if isinstance(text, str):
                parts.append(text)
    return "\n".join(part.strip() for part in parts if part and part.strip())


def _error_detail(exc: urllib.error.HTTPError) -> str:
    try:
        payload = json.loads(exc.read().decode())
    except (json.JSONDecodeError, UnicodeError):
        return "The inspection assistant failed."
    detail = payload.get("detail") or payload.get("error")
    if isinstance(detail, str) and detail.strip():
        return detail.strip()[:300]
    return "The inspection assistant failed."
