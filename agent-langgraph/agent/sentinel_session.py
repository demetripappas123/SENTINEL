"""The Sentinel session for the current agent turn.

The token arrives on the invocation request header. It is not part of the
stored invocation body, and tool arguments cannot supply it.
"""
import contextvars
from contextlib import contextmanager

_authorization: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "sentinel_authorization",
    default=None,
)


def authorization() -> str | None:
    value = _authorization.get()
    return value or None


@contextmanager
def bind_authorization(value: str | None):
    token = _authorization.set(value.strip() if value and value.strip() else None)
    try:
        yield
    finally:
        _authorization.reset(token)
