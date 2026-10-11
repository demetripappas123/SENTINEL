import pytest

from app.auth.service import CreateOrganizationRequest, JoinOrganizationRequest, create_organization, join_organization
from app.auth.store import MemoryAuthStore
from app.orbit.service import OrbitRequestError


def test_a_new_user_joins_an_existing_organization():
    store = MemoryAuthStore()
    created = create_organization(
        store,
        CreateOrganizationRequest(
            organization_name="South Yard",
            name="Owner",
            email="owner@south.test",
            password="sentinel1",
        ),
    )
    session = join_organization(
        store,
        JoinOrganizationRequest(
            organization_name="south yard",
            name="New Operator",
            email="new@south.test",
            password="sentinel1",
        ),
    )
    assert session.organization.id == created.organization.id
    assert session.organization.name == "South Yard"
    assert session.user.email == "new@south.test"
    assert store.user_by_email("new@south.test").organization_id == created.organization.id


def test_join_rejects_an_unknown_organization():
    store = MemoryAuthStore()
    with pytest.raises(OrbitRequestError) as caught:
        join_organization(
            store,
            JoinOrganizationRequest(
                organization_name="Missing Yard",
                name="New Operator",
                email="new@missing.test",
                password="sentinel1",
            ),
        )
    assert caught.value.status_code == 404
