import os
from collections.abc import AsyncGenerator, Callable
from typing import Any

from databricks.sdk import WorkspaceClient
from databricks_langchain import ChatDatabricks
from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware

from agent.mcps import build_mcp_servers

# Importing the tools package auto-registers every tool module.
from agent.tools import all_tools
from databricks_agentkit import workspace_client, workspace_headers
from databricks_agentkit.langgraph import (
    checkpointer,
    configure_tracing,
    genie_tools,
    mcp_tools,
    memory_tools,
    start_trace,
    thread_config,
)
from databricks_agentkit.langgraph.session_store import (
    invocation_id_from_metadata,
    invocation_metadata,
)
from databricks_agentkit.runtime.auth import AuthError

# A Unity Catalog AI Gateway model service, served from the `system.ai` schema and queried through
# the gateway (see `use_ai_gateway=True` below). Swap for any `system.ai.*` model service your
# workspace exposes — the demo chat app's picker lists what's available.
MODEL = os.environ.get("SENTINEL_AGENT_MODEL", "system.ai.llama-4-maverick")

# Inspection tools only read stored data, so a turn does not pause for approval.
REQUIRE_APPROVAL: dict[str, bool] = {}

SYSTEM_PROMPT = """You are the SENTINEL inspection assistant for the signed-in organization.
Answer from the inspection tools. Do not invent measurements, asset ids, causes, or relationships.
If a tool returns insufficient_data, say what is missing in one sentence and stop that line of inquiry.
Overlap and correlation are not causation. Assets have no subsystem field, and no machine-learning score is stored.

What needs attention is the inspection queue, not the raw Spot list.
A Spot label (detection_method spot_label) is a claim. It includes unbacked labels.
A Spot anomaly id and a rule verdict are different records. A verdict on the same action is not the verdict of that anomaly id.

Verdicts:
- inspection_failure: the action failed, or a reading was questionable. This is a failed check. It is not an anomaly, and it does not mean a Spot label is accurate.
- equipment_finding: a good reading is outside this asset's other good readings. This is a confirmed finding.
- potential_anomaly: a good reading is above the limit for that equipment type and is not confirmed.
- unsupported_claim: a Spot label the readings do not support.

Never say an inspection failure confirms an anomaly.
When the user asks whether a Spot label is accurate, answer from equipment_finding, potential_anomaly, or unsupported_claim. If the only verdict is inspection_failure, say the check failed and the label is not confirmed.

Read-only movement:
Every tool is read-only. Call any of them, in any order, as many times as the question needs.
An id in a result is a join. Before you answer about a queue item or a claim, load that action, that asset, its recent history, and equipment that shares its waypoint.
Use the inspection id for the action and its rule firings. Use the asset id for the asset, its history, and its neighbors. Use the location id for the waypoint.
Do not stop after the first list. Do not ask the operator to request the next lookup.
Say only facts you loaded. Battery, check duration, waypoint, and neighbors belong in the reply when those calls returned them.

Reply format:
- Plain speech. Lead with the conclusion in one sentence.
- Then at most five bullets. Each bullet is the equipment name, the id in parentheses, what happened, and the time.
- Keep the spoken reply short. The lookups behind it are not limited by that length.
- Do not name tools, request ids, or JSON fields.
- Do not tell the user how to investigate next.
- Do not restate the question.
- Times, statuses, check names, and measurement names in tool results are already operator language. Repeat them as written."""


class _RoutedChatDatabricks(ChatDatabricks):
    """Forward account-host workspace routing to the underlying OpenAI clients."""

    def _get_client_kwargs(self) -> dict[str, Any]:
        kwargs = super()._get_client_kwargs()
        if headers := workspace_headers():
            kwargs["default_headers"] = headers
        return kwargs


def configure() -> None:
    """Wire up global state; call once at server startup (not at import)."""
    _check_databricks_auth()
    configure_tracing()


def _check_databricks_auth() -> None:
    """Fail fast at startup with a clear message if Databricks auth isn't configured.

    Without this, a missing/invalid profile only surfaces on the first model call — as a generic SDK
    error buried in a request traceback. Resolving a WorkspaceClient here validates the same config
    the model client uses, so the failure is immediate and actionable.
    """
    try:
        workspace_client()
    except Exception as e:
        profile = os.getenv("DATABRICKS_CONFIG_PROFILE")
        target = (
            f"profile {profile!r}" if profile else "the DEFAULT profile / DATABRICKS_HOST+TOKEN"
        )
        raise RuntimeError(
            f"Databricks auth is not configured — the agent can't call the model. Tried {target}.\n"
            "Fix one of:\n"
            "  • set DATABRICKS_CONFIG_PROFILE in .env to a profile from `databricks auth profiles`, or\n"
            "  • run `databricks auth login --profile <name>` to create one, or\n"
            "  • set DATABRICKS_HOST and DATABRICKS_TOKEN in .env.\n"
            f"(underlying error: {e})"
        ) from e


def _operator_clause(operator: dict | None) -> str:
    if not operator:
        return ""
    facilities = operator.get("facilities") or []
    if len(facilities) == 1:
        place = f"Their facility is {facilities[0]['name']} ({facilities[0]['id']})."
    elif facilities:
        listed = ", ".join(f"{item['name']} ({item['id']})" for item in facilities)
        place = f"Their facilities are {listed}."
    else:
        place = "No facility id is on file."
    return (
        "\n\nSigned-in operator: "
        f"{operator.get('user_name')} ({operator.get('user_id')}), "
        f"organization {operator.get('organization_name')} ({operator.get('organization_id')}). "
        f"{place} Do not ask for a user id, organization id, or facility id. "
        "When they ask about the facility, call get_facility_summary and omit facility_id."
    )


async def create_agent_graph(
    actor: str,
    model: str | None = None,
    *,
    workspace_client_for: Callable[[str], WorkspaceClient] | None = None,
    operator: dict | None = None,
):
    """Build the LangGraph agent: local tools + long-term-memory tools + any MCP tools.

    ``actor`` is the identity whose long-term memory the agent reads/writes; it's captured in the
    memory tools' closures (never exposed to the model).

    ``model`` selects the gateway model for this run; the chat UI passes the picker's choice and
    everything else falls back to ``MODEL``. The agent is rebuilt per turn, so the model can vary
    request to request.
    """
    mcp = await mcp_tools(build_mcp_servers(), workspace_client_for=workspace_client_for)
    tools = [
        *all_tools(),
        *memory_tools(actor),
        *genie_tools(workspace_client_for=workspace_client_for),
        *mcp,
    ]
    middleware = (
        [HumanInTheLoopMiddleware(interrupt_on=REQUIRE_APPROVAL)] if REQUIRE_APPROVAL else []
    )
    endpoint = model or os.environ.get("SENTINEL_AGENT_MODEL", MODEL)
    return create_agent(
        # use_ai_gateway routes to the Unity Catalog AI Gateway (`<host>/ai-gateway/mlflow/v1`), so
        # `endpoint` is a `system.ai.*` model name rather than a serving-endpoint name.
        model=_RoutedChatDatabricks(
            endpoint=endpoint, workspace_client=workspace_client(), use_ai_gateway=True
        ),
        tools=tools,
        system_prompt=SYSTEM_PROMPT + _operator_clause(operator),
        middleware=middleware,
        checkpointer=checkpointer(),
    )


async def recovery_input(
    agent_input: Any,
    *,
    session_id: str,
    actor: str,
    invocation_id: str,
) -> Any:
    """Return the input that should be passed to ``run_agent`` after worker loss.

    A checkpoint tagged with this invocation means LangGraph can continue by receiving ``None``.
    Otherwise recovery replays the original application input.
    """
    checkpoint = await checkpointer().aget_tuple(thread_config(session_id, actor))
    current_invocation_checkpointed = bool(
        checkpoint and invocation_id_from_metadata(checkpoint.metadata) == invocation_id
    )
    return None if current_invocation_checkpointed else agent_input


async def run_agent(
    agent_input: Any,
    *,
    session_id: str,
    actor: str | None = None,
    model: str | None = None,
    invocation_id: str | None = None,
    workspace_client_for: Callable[[str], WorkspaceClient] | None = None,
    operator: dict | None = None,
    graph: Any = None,
) -> AsyncGenerator[Any, None]:
    """Run the agent and yield native LangGraph stream events.

    This is the framework-native entrypoint. It has no dependency on Agent Bricks request or context types,
    so it can be called from another server, a notebook, or a test harness.
    """
    actor = actor or session_id
    if graph is None:
        graph = await create_agent_graph(
            actor, model, workspace_client_for=workspace_client_for, operator=operator
        )
    config = thread_config(session_id, actor)
    if invocation_id:
        config["metadata"] = invocation_metadata(invocation_id)

    last_update: Any = None
    with start_trace(name="invoke", inputs=agent_input, session_id=session_id) as span:
        async for event in graph.astream(
            input=agent_input,
            config=config,
            stream_mode=["updates", "messages"],
            durability="sync",
        ):
            if event[0] == "updates":
                last_update = event[1]
                if workspace_client_for is not None and last_update.get("__interrupt__"):
                    raise AuthError(
                        "MCP_USER_AUTH_HITL_UNSUPPORTED",
                        "Request-user invocations do not support paused approvals.",
                        400,
                    )
            yield event
        if span is not None and last_update is not None:
            span.set_outputs(last_update)
