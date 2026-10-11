"""Sign-in, join an organization, and create the first user of a new organization.

A session lasts twelve hours. The token stored in the database is the sha256
of the bearer token the client holds.
"""
import hashlib
import secrets
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.auth.passwords import hash_password, password_matches
from app.auth.store import SESSION_TTL, AuthStore, UserAccount
from app.orbit.models import Organization
from app.orbit.service import OrbitRequestError


class LoginRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class CreateOrganizationRequest(BaseModel):
    organization_name: str = Field(min_length=1)
    name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=8)


class JoinOrganizationRequest(BaseModel):
    organization_name: str = Field(min_length=1)
    name: str = Field(min_length=1)
    email: str = Field(min_length=3)
    password: str = Field(min_length=8)


class PublicUser(BaseModel):
    id: str
    email: str
    name: str
    organization_id: str


class AuthSession(BaseModel):
    token: str
    user: PublicUser
    organization: Organization


def login(store: AuthStore, body: LoginRequest) -> AuthSession:
    user = store.user_by_email(body.email.strip().lower())
    if user is None or not password_matches(body.password, user.password_hash):
        raise OrbitRequestError(401, "Email or password is wrong")
    return _open_session(store, user)


def create_organization(store: AuthStore, body: CreateOrganizationRequest) -> AuthSession:
    email = body.email.strip().lower()
    if store.user_by_email(email) is not None:
        raise OrbitRequestError(409, "An account with that email already exists")
    user = UserAccount(
        id="usr_" + secrets.token_hex(4),
        email=email,
        name=body.name.strip(),
        organization_id="org_" + secrets.token_hex(4),
        organization_name=body.organization_name.strip(),
        password_hash=hash_password(body.password),
    )
    try:
        store.create_organization_user(user)
    except ValueError as exc:
        raise OrbitRequestError(409, "An account with that email already exists") from exc
    return _open_session(store, user)


def join_organization(store: AuthStore, body: JoinOrganizationRequest) -> AuthSession:
    """Add a new person to an organization that already exists, then sign them in."""
    email = body.email.strip().lower()
    if store.user_by_email(email) is not None:
        raise OrbitRequestError(409, "An account with that email already exists")
    try:
        found = store.organization_by_name(body.organization_name.strip())
    except ValueError as exc:
        raise OrbitRequestError(409, "More than one organization has that name") from exc
    if found is None:
        raise OrbitRequestError(404, "No organization has that name")
    organization_id, organization_name = found
    user = UserAccount(
        id="usr_" + secrets.token_hex(4),
        email=email,
        name=body.name.strip(),
        organization_id=organization_id,
        organization_name=organization_name,
        password_hash=hash_password(body.password),
    )
    try:
        store.create_user(user)
    except ValueError as exc:
        if str(exc) == "organization":
            raise OrbitRequestError(404, "No organization has that name") from exc
        raise OrbitRequestError(409, "An account with that email already exists") from exc
    return _open_session(store, user)


def current_user(store: AuthStore, authorization: str | None) -> UserAccount:
    token = _bearer(authorization)
    if token is None:
        raise OrbitRequestError(401, "Sign in required")
    user = store.user_for_session(hashlib.sha256(token.encode()).hexdigest())
    if user is None:
        raise OrbitRequestError(401, "Sign in required")
    return user


def logout(store: AuthStore, authorization: str | None) -> None:
    token = _bearer(authorization)
    if token is None:
        return
    store.delete_session(hashlib.sha256(token.encode()).hexdigest())


def _open_session(store: AuthStore, user: UserAccount) -> AuthSession:
    token = secrets.token_urlsafe(32)
    store.save_session(hashlib.sha256(token.encode()).hexdigest(), user.id, datetime.now(timezone.utc) + SESSION_TTL)
    return AuthSession(
        token=token,
        user=PublicUser(id=user.id, email=user.email, name=user.name, organization_id=user.organization_id),
        organization=Organization(id=user.organization_id, name=user.organization_name),
    )


def _bearer(authorization: str | None) -> str | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    return token or None
