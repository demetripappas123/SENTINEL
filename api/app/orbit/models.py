"""An Orbit connection: the organization link, its current subscription, and one delivery."""
from pydantic import BaseModel, ConfigDict, Field


class OrbitWebhookEvent(BaseModel):
    """Event Orbit would post. Organization is not part of the payload."""

    model_config = ConfigDict(extra="ignore")

    event_type: str
    mission_id: str
    action_id: str
    robot_id: str | None = None
    status: str | None = None


class Organization(BaseModel):
    id: str
    name: str


class Facility(BaseModel):
    id: str
    organization_id: str
    name: str


class OrbitIntegration(BaseModel):
    id: str
    organization_id: str
    facility_id: str
    instance_url: str
    mode: str


class WebhookSubscription(BaseModel):
    id: str
    integration_id: str
    event_type: str
    status: str
    provider_subscription_id: str | None = None
    secret_hash: str
    callback_path: str
    organization_id: str
    facility_id: str
    instance_url: str
    mode: str


class SubscriptionResult(BaseModel):
    subscription_id: str
    provider_subscription_id: str | None = None
    secret: str
    callback_path: str


class InspectionRecord(BaseModel):
    organization_id: str
    facility_id: str
    integration_id: str
    subscription_id: str
    event_type: str
    provider_mission_id: str
    provider_action_id: str
    robot_id: str | None = None
    ingestion_mission_id: str
    ingestion_action_id: str
    status: str


class ConnectionView(BaseModel):
    organization: Organization
    facility: Facility
    integration: OrbitIntegration
    subscription_id: str
    event_type: str
    status: str
    callback_path: str
    secret: str | None = None


class ConnectRequest(BaseModel):
    facility_name: str = Field(min_length=1)
    instance_url: str = Field(min_length=1)
    event_types: list[str] = Field(default_factory=lambda: ["ACTION_COMPLETED"])
