"""Run the LangGraph agent with the optional Agent Bricks chat app."""

import os
from pathlib import Path

import uvicorn
from agent.agent import configure
from agent.sentinel_session import bind_authorization
from dotenv import load_dotenv
from runtime.adapter import invoke, recover
from runtime.ui import install_ui

from databricks_agentkit import DurableAgentServer

# override=False so injected DATABRICKS_* (from `agentbricks dev -p` or the deploy platform) win over a
# checked-in .env.
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=False)
configure()

app = DurableAgentServer()
app.invoke(invoke)
app.recover(recover)
install_ui(app)


class SentinelSessionMiddleware:
    """Keep the operator session on the request that runs the tools.

    The invocation body is stored by the agent runtime, so the bearer token
    stays in this request context instead of that body.
    """

    def __init__(self, asgi_app):
        self.asgi_app = asgi_app

    async def __call__(self, scope, receive, send):
        header = None
        if scope.get("type") == "http":
            for key, value in scope.get("headers", []):
                if key == b"x-sentinel-authorization":
                    header = value.decode()
                    break
        with bind_authorization(header):
            await self.asgi_app(scope, receive, send)


app.add_middleware(SentinelSessionMiddleware)


def main() -> None:
    uvicorn.run("runtime.main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
