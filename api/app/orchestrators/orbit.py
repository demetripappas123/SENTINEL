"""Orbit connection routes and the public webhook receiver.

The webhook is public because Orbit calls it. Every other route here requires
a signed-in user and uses that user's organization.
"""
from fastapi import APIRouter, Depends, Header, HTTPException

import psycopg

from app.auth.service import current_user
from app.auth.store import AuthStore, get_auth_store
from app.demo_org import DEMO_SUBSCRIPTION_ID, DEMO_WEBHOOK_SECRET
from app.orbit.catalog import OrbitCatalog, get_catalog
from app.orbit.models import ConnectRequest, ConnectionView, InspectionRecord, OrbitWebhookEvent, Organization
from app.orbit.provider import MockOrbitProvider
from app.orbit.service import (
    OrbitRequestError,
    connect_organization,
    inspection_batch,
    receive_webhook,
)

router = APIRouter(tags=["orbit"])
_providers: dict[int, MockOrbitProvider] = {}


def get_provider(catalog: OrbitCatalog = Depends(get_catalog)) -> MockOrbitProvider:
    provider = _providers.get(id(catalog))
    if provider is None:
        provider = MockOrbitProvider(catalog)
        if catalog.get_subscription(DEMO_SUBSCRIPTION_ID) is not None:
            provider._secrets[DEMO_SUBSCRIPTION_ID] = DEMO_WEBHOOK_SECRET
        _providers[id(catalog)] = provider
    return provider


def _signed_in(store: AuthStore, authorization: str | None):
    try:
        return current_user(store, authorization)
    except OrbitRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/api/orbit/connections", response_model=ConnectionView)
def create_connection(
    body: ConnectRequest,
    catalog: OrbitCatalog = Depends(get_catalog),
    provider: MockOrbitProvider = Depends(get_provider),
    store: AuthStore = Depends(get_auth_store),
    authorization: str | None = Header(default=None),
) -> ConnectionView:
    """Open the one simulated Orbit connection for the signed-in user's organization."""
    user = _signed_in(store, authorization)
    try:
        return connect_organization(
            catalog,
            provider,
            body,
            Organization(id=user.organization_id, name=user.organization_name),
        )
    except OrbitRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc


@router.get("/api/orbit/connections", response_model=list[ConnectionView])
def list_connections(
    catalog: OrbitCatalog = Depends(get_catalog),
    store: AuthStore = Depends(get_auth_store),
    authorization: str | None = Header(default=None),
) -> list[ConnectionView]:
    user = _signed_in(store, authorization)
    try:
        return [row for row in catalog.connections() if row.organization.id == user.organization_id]
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc


@router.delete("/api/orbit/subscriptions/{subscription_id}", status_code=204)
def delete_subscription(
    subscription_id: str,
    catalog: OrbitCatalog = Depends(get_catalog),
    provider: MockOrbitProvider = Depends(get_provider),
    store: AuthStore = Depends(get_auth_store),
    authorization: str | None = Header(default=None),
) -> None:
    user = _signed_in(store, authorization)
    subscription = catalog.get_subscription(subscription_id)
    if subscription is None or subscription.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Unknown webhook subscription")
    provider.delete_subscription(subscription_id)


@router.get("/api/orbit/organizations/{organization_id}/inspections", response_model=list[InspectionRecord])
def list_inspections(
    organization_id: str,
    catalog: OrbitCatalog = Depends(get_catalog),
    store: AuthStore = Depends(get_auth_store),
    authorization: str | None = Header(default=None),
) -> list[InspectionRecord]:
    user = _signed_in(store, authorization)
    if organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Unknown organization")
    try:
        return catalog.inspections(organization_id)
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc


@router.post("/api/webhooks/orbit/{webhook_id}")
def orbit_webhook(
    webhook_id: str,
    payload: OrbitWebhookEvent,
    catalog: OrbitCatalog = Depends(get_catalog),
    x_sentinel_webhook_secret: str | None = Header(default=None),
) -> dict:
    """Orbit calls this. The webhook id selects the subscription. The secret proves the sender."""
    try:
        status, inspection = receive_webhook(catalog, webhook_id, x_sentinel_webhook_secret, payload)
    except OrbitRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
    batch = inspection_batch(inspection)
    return {
        "status": status,
        "organization_id": inspection.organization_id,
        "ingestion_mission_id": inspection.ingestion_mission_id,
        "ingestion_action_id": inspection.ingestion_action_id,
        "mission_count": len(batch.missions),
        "action_count": len(batch.actions),
    }
