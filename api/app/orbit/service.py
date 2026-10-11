import secrets

from app.orbit.catalog import OrbitCatalog
from app.orbit.models import (
    ConnectRequest,
    ConnectionView,
    Facility,
    InspectionRecord,
    OrbitIntegration,
    OrbitWebhookEvent,
    Organization,
)
from app.orbit.provider import MockOrbitProvider, secret_matches
from app.schemas.canonical import Action, CanonicalBatch, Mission, Source


class OrbitRequestError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def connect_organization(
    catalog: OrbitCatalog,
    provider: MockOrbitProvider,
    body: ConnectRequest,
    organization: Organization,
) -> ConnectionView:
    """Attach a simulated Orbit webhook to an organization that already exists."""
    if not body.event_types:
        raise OrbitRequestError(422, "Choose at least one event type")
    if any(event_type != "ACTION_COMPLETED" for event_type in body.event_types):
        raise OrbitRequestError(422, "Simulated Orbit currently accepts ACTION_COMPLETED")
    if any(row.organization.id == organization.id for row in catalog.connections()):
        raise OrbitRequestError(409, "This organization already has a webhook subscription")
    facility = Facility(id=_new_id("fac"), organization_id=organization.id, name=body.facility_name.strip())
    integration = OrbitIntegration(
        id=_new_id("int"),
        organization_id=organization.id,
        facility_id=facility.id,
        instance_url=body.instance_url.strip(),
        mode="simulated",
    )
    subscription, secret = provider.open_subscription(organization, facility, integration, body.event_types[0])
    return ConnectionView(
        organization=organization,
        facility=facility,
        integration=integration,
        subscription_id=subscription.id,
        event_type=subscription.event_type,
        status=subscription.status,
        callback_path=subscription.callback_path,
        secret=secret,
    )


def receive_webhook(
    catalog: OrbitCatalog,
    webhook_id: str,
    presented_secret: str | None,
    payload: OrbitWebhookEvent,
) -> tuple[str, InspectionRecord]:
    """Authenticate the sender, resolve the organization from the subscription, and record one delivery."""
    subscription = catalog.get_subscription(webhook_id)
    if subscription is None:
        raise OrbitRequestError(404, "Unknown webhook subscription")
    if not secret_matches(presented_secret, subscription.secret_hash):
        raise OrbitRequestError(401, "Webhook authentication failed")
    if subscription.status != "active":
        raise OrbitRequestError(403, "Webhook subscription is disabled")
    if payload.event_type != subscription.event_type:
        raise OrbitRequestError(422, "This subscription does not accept that event type")
    inspection = InspectionRecord(
        organization_id=subscription.organization_id,
        facility_id=subscription.facility_id,
        integration_id=subscription.integration_id,
        subscription_id=subscription.id,
        event_type=payload.event_type,
        provider_mission_id=payload.mission_id,
        provider_action_id=payload.action_id,
        robot_id=payload.robot_id,
        ingestion_mission_id=f"{subscription.organization_id}:{payload.mission_id}",
        ingestion_action_id=f"{subscription.organization_id}:{payload.action_id}",
        status=payload.status or "RECORDED",
    )
    if not catalog.record_delivery(inspection):
        return "duplicate", inspection
    return "accepted", inspection


def inspection_batch(inspection: InspectionRecord) -> CanonicalBatch:
    """Canonical records for this organization. The provider ids are namespaced so two orgs can replay the same event."""
    return CanonicalBatch(
        missions=[
            Mission(
                source=Source.orbit,
                mission_id=inspection.ingestion_mission_id,
                mission_name=inspection.provider_mission_id,
                mission_status="RECORDED",
            )
        ],
        actions=[
            Action(
                source=Source.orbit,
                action_id=inspection.ingestion_action_id,
                mission_id=inspection.ingestion_mission_id,
                action_type=inspection.event_type,
                status=inspection.status,
            )
        ],
    )


def _new_id(prefix: str) -> str:
    return prefix + "_" + secrets.token_hex(4)
