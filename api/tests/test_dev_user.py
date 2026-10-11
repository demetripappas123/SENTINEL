"""REMOVE BEFORE PRODUCTION. Delete this file with the SENTINEL_DEV_USER block in auth/service.py."""
import pytest  # REMOVE BEFORE PRODUCTION.

from app.auth.passwords import DEMO_PASSWORD_HASH  # REMOVE BEFORE PRODUCTION.
from app.auth.service import current_user, login, LoginRequest  # REMOVE BEFORE PRODUCTION.
from app.auth.store import MemoryAuthStore, UserAccount  # REMOVE BEFORE PRODUCTION.
from app.orbit.service import OrbitRequestError  # REMOVE BEFORE PRODUCTION.


def _store() -> MemoryAuthStore:  # REMOVE BEFORE PRODUCTION.
    store = MemoryAuthStore()  # REMOVE BEFORE PRODUCTION.
    store.create_organization_user(  # REMOVE BEFORE PRODUCTION.
        UserAccount(  # REMOVE BEFORE PRODUCTION.
            id="usr_north",  # REMOVE BEFORE PRODUCTION.
            email="operator.north@sentinel.local",  # REMOVE BEFORE PRODUCTION.
            name="North Operator",  # REMOVE BEFORE PRODUCTION.
            organization_id="org_north",  # REMOVE BEFORE PRODUCTION.
            organization_name="North Yard",  # REMOVE BEFORE PRODUCTION.
            password_hash=DEMO_PASSWORD_HASH,  # REMOVE BEFORE PRODUCTION.
        )  # REMOVE BEFORE PRODUCTION.
    )  # REMOVE BEFORE PRODUCTION.
    return store  # REMOVE BEFORE PRODUCTION.


def test_missing_token_loads_the_dev_user(monkeypatch):  # REMOVE BEFORE PRODUCTION.
    monkeypatch.setenv("SENTINEL_DEV_USER", "usr_north")  # REMOVE BEFORE PRODUCTION.
    user = current_user(_store(), None)  # REMOVE BEFORE PRODUCTION.
    assert user.id == "usr_north"  # REMOVE BEFORE PRODUCTION.
    assert user.organization_id == "org_north"  # REMOVE BEFORE PRODUCTION.


def test_a_real_token_is_not_replaced_by_the_dev_user(monkeypatch):  # REMOVE BEFORE PRODUCTION.
    monkeypatch.setenv("SENTINEL_DEV_USER", "usr_north")  # REMOVE BEFORE PRODUCTION.
    store = _store()  # REMOVE BEFORE PRODUCTION.
    session = login(store, LoginRequest(email="operator.north@sentinel.local", password="sentinel"))  # REMOVE BEFORE PRODUCTION.
    with pytest.raises(OrbitRequestError) as caught:  # REMOVE BEFORE PRODUCTION.
        current_user(store, "Bearer not-a-session")  # REMOVE BEFORE PRODUCTION.
    assert caught.value.status_code == 401  # REMOVE BEFORE PRODUCTION.
    signed_in = current_user(store, "Bearer " + session.token)  # REMOVE BEFORE PRODUCTION.
    assert signed_in.id == "usr_north"  # REMOVE BEFORE PRODUCTION.


def test_dev_user_is_ignored_when_unset(monkeypatch):  # REMOVE BEFORE PRODUCTION.
    monkeypatch.delenv("SENTINEL_DEV_USER", raising=False)  # REMOVE BEFORE PRODUCTION.
    with pytest.raises(OrbitRequestError) as caught:  # REMOVE BEFORE PRODUCTION.
        current_user(_store(), None)  # REMOVE BEFORE PRODUCTION.
    assert caught.value.status_code == 401  # REMOVE BEFORE PRODUCTION.
