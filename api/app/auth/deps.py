"""The dependency an orchestrator uses to require a signed-in user."""
import psycopg
from fastapi import Depends, Header, HTTPException

from app.auth.service import current_user
from app.auth.store import AuthStore, UserAccount, get_auth_store
from app.orbit.service import OrbitRequestError


def require_user(
    store: AuthStore = Depends(get_auth_store),
    authorization: str | None = Header(default=None),
) -> UserAccount:
    try:
        return current_user(store, authorization)
    except OrbitRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
