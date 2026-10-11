"""POST /api/auth/login, /api/auth/join, /api/auth/logout, and GET /api/auth/session.

Also POST /api/organizations, which creates an organization and its first user.
"""
import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException

from app.auth.service import (
    AuthSession,
    CreateOrganizationRequest,
    JoinOrganizationRequest,
    LoginRequest,
    create_organization,
    current_user,
    join_organization,
    login,
    logout,
)
from app.auth.store import AuthStore, get_auth_store
from app.orbit.service import OrbitRequestError

router = APIRouter(tags=["auth"])


def _auth_error(exc: OrbitRequestError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.post("/api/auth/login", response_model=AuthSession)
def post_login(body: LoginRequest, store: AuthStore = Depends(get_auth_store)) -> AuthSession:
    try:
        return login(store, body)
    except OrbitRequestError as exc:
        raise _auth_error(exc) from exc
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc


@router.post("/api/organizations", response_model=AuthSession)
def post_organization(body: CreateOrganizationRequest, store: AuthStore = Depends(get_auth_store)) -> AuthSession:
    """Create an organization and its first user, then sign that user in."""
    try:
        return create_organization(store, body)
    except OrbitRequestError as exc:
        raise _auth_error(exc) from exc
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc


@router.post("/api/auth/join", response_model=AuthSession)
def post_join(body: JoinOrganizationRequest, store: AuthStore = Depends(get_auth_store)) -> AuthSession:
    """Create a user on an existing organization and sign that user in."""
    try:
        return join_organization(store, body)
    except OrbitRequestError as exc:
        raise _auth_error(exc) from exc
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc


@router.get("/api/auth/session", response_model=AuthSession)
def read_session(
    store: AuthStore = Depends(get_auth_store),
    authorization: str | None = Header(default=None),
) -> AuthSession:
    try:
        user = current_user(store, authorization)
    except OrbitRequestError as exc:
        raise _auth_error(exc) from exc
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
    from app.auth.service import PublicUser
    from app.orbit.models import Organization

    return AuthSession(
        token="",
        user=PublicUser(id=user.id, email=user.email, name=user.name, organization_id=user.organization_id),
        organization=Organization(id=user.organization_id, name=user.organization_name),
    )


@router.post("/api/auth/logout", status_code=204)
def post_logout(
    store: AuthStore = Depends(get_auth_store),
    authorization: str | None = Header(default=None),
) -> None:
    try:
        logout(store, authorization)
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
