"""Users, sessions, and organizations.

MemoryAuthStore is the default and forgets writes when the process stops.
PostgresAuthStore is used when ORBIT_CATALOG is postgres.
"""
import os
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel

from app.auth.passwords import DEMO_PASSWORD_HASH


class UserAccount(BaseModel):
    id: str
    email: str
    name: str
    organization_id: str
    organization_name: str
    password_hash: str


class AuthStore(ABC):
    @abstractmethod
    def user_by_email(self, email: str) -> UserAccount | None:
        raise NotImplementedError

    @abstractmethod
    def organization_name(self, organization_id: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def organization_by_name(self, name: str) -> tuple[str, str] | None:
        raise NotImplementedError

    @abstractmethod
    def create_organization_user(self, user: UserAccount) -> None:
        raise NotImplementedError

    @abstractmethod
    def create_user(self, user: UserAccount) -> None:
        raise NotImplementedError

    @abstractmethod
    def save_session(self, token_hash: str, user_id: str, expires_at: datetime) -> None:
        raise NotImplementedError

    @abstractmethod
    def user_for_session(self, token_hash: str) -> UserAccount | None:
        raise NotImplementedError

    @abstractmethod
    def delete_session(self, token_hash: str) -> None:
        raise NotImplementedError


class MemoryAuthStore(AuthStore):
    def __init__(self) -> None:
        self.users: dict[str, UserAccount] = {}
        self.sessions: dict[str, tuple[str, datetime]] = {}

    def user_by_email(self, email: str) -> UserAccount | None:
        return next((user for user in self.users.values() if user.email == email), None)

    def organization_name(self, organization_id: str) -> str | None:
        user = next((item for item in self.users.values() if item.organization_id == organization_id), None)
        return user.organization_name if user else None

    def organization_by_name(self, name: str) -> tuple[str, str] | None:
        folded = name.casefold()
        found = {
            user.organization_id: user.organization_name
            for user in self.users.values()
            if user.organization_name.casefold() == folded
        }
        if len(found) > 1:
            raise ValueError("ambiguous")
        if not found:
            return None
        organization_id, organization_name = next(iter(found.items()))
        return organization_id, organization_name

    def create_organization_user(self, user: UserAccount) -> None:
        if self.user_by_email(user.email) is not None:
            raise ValueError("email")
        self.users[user.id] = user

    def create_user(self, user: UserAccount) -> None:
        if self.user_by_email(user.email) is not None:
            raise ValueError("email")
        if self.organization_name(user.organization_id) is None:
            raise ValueError("organization")
        self.users[user.id] = user

    def save_session(self, token_hash: str, user_id: str, expires_at: datetime) -> None:
        self.sessions[token_hash] = (user_id, expires_at)

    def user_for_session(self, token_hash: str) -> UserAccount | None:
        found = self.sessions.get(token_hash)
        if found is None:
            return None
        user_id, expires_at = found
        if expires_at <= datetime.now(timezone.utc):
            self.sessions.pop(token_hash, None)
            return None
        return self.users.get(user_id)

    def delete_session(self, token_hash: str) -> None:
        self.sessions.pop(token_hash, None)


class PostgresAuthStore(AuthStore):
    def user_by_email(self, email: str) -> UserAccount | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT users.id, users.email, users.name, users.organization_id,
                       users.password_hash, organizations.name AS organization_name
                FROM sentinel.users AS users
                JOIN sentinel.organizations AS organizations ON organizations.id = users.organization_id
                WHERE users.email = %s
                """,
                (email,),
            ).fetchone()
        return UserAccount.model_validate(row) if row else None

    def organization_name(self, organization_id: str) -> str | None:
        with self._connect() as conn:
            row = conn.execute("SELECT name FROM sentinel.organizations WHERE id = %s", (organization_id,)).fetchone()
        return row["name"] if row else None

    def organization_by_name(self, name: str) -> tuple[str, str] | None:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id, name FROM sentinel.organizations WHERE lower(name) = lower(%s)",
                (name,),
            ).fetchall()
        if len(rows) > 1:
            raise ValueError("ambiguous")
        if not rows:
            return None
        return rows[0]["id"], rows[0]["name"]

    def create_organization_user(self, user: UserAccount) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO sentinel.organizations (id, name) VALUES (%s, %s)",
                (user.organization_id, user.organization_name),
            )
            conn.execute(
                """
                INSERT INTO sentinel.users (id, organization_id, email, name, password_hash)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (user.id, user.organization_id, user.email, user.name, user.password_hash),
            )
            conn.commit()

    def create_user(self, user: UserAccount) -> None:
        from psycopg.errors import ForeignKeyViolation, UniqueViolation

        try:
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO sentinel.users (id, organization_id, email, name, password_hash)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (user.id, user.organization_id, user.email, user.name, user.password_hash),
                )
                conn.commit()
        except UniqueViolation as exc:
            raise ValueError("email") from exc
        except ForeignKeyViolation as exc:
            raise ValueError("organization") from exc

    def save_session(self, token_hash: str, user_id: str, expires_at: datetime) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO sentinel.sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
                (token_hash, user_id, expires_at),
            )
            conn.commit()

    def user_for_session(self, token_hash: str) -> UserAccount | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT users.id, users.email, users.name, users.organization_id,
                       users.password_hash, organizations.name AS organization_name
                FROM sentinel.sessions AS sessions
                JOIN sentinel.users AS users ON users.id = sessions.user_id
                JOIN sentinel.organizations AS organizations ON organizations.id = users.organization_id
                WHERE sessions.token_hash = %s AND sessions.expires_at > now()
                """,
                (token_hash,),
            ).fetchone()
        return UserAccount.model_validate(row) if row else None

    def delete_session(self, token_hash: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM sentinel.sessions WHERE token_hash = %s", (token_hash,))
            conn.commit()

    def _connect(self):
        from app.db import connect

        return connect()


def _seed(store: MemoryAuthStore) -> MemoryAuthStore:
    store.create_organization_user(
        UserAccount(
            id="usr_north",
            email="operator.north@sentinel.local",
            name="North Operator",
            organization_id="org_north",
            organization_name="North Yard",
            password_hash=DEMO_PASSWORD_HASH,
        )
    )
    store.create_organization_user(
        UserAccount(
            id="usr_south",
            email="operator.south@sentinel.local",
            name="South Operator",
            organization_id="org_south",
            organization_name="South Yard",
            password_hash=DEMO_PASSWORD_HASH,
        )
    )
    return store


_memory = _seed(MemoryAuthStore())


def get_auth_store() -> AuthStore:
    if os.environ.get("ORBIT_CATALOG") == "postgres":
        return PostgresAuthStore()
    return _memory


SESSION_TTL = timedelta(hours=12)
