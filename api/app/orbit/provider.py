"""The stand-in for Orbit's subscription API.

MockOrbitProvider stores the subscription in the catalog and keeps the signing
secret in this process. RealOrbitProvider refuses the call because no Orbit
instance is connected.
"""
import hashlib
import hmac
import secrets
from typing import Protocol

from app.orbit.catalog import OrbitCatalog
from app.orbit.models import (
    Facility,
    OrbitIntegration,
    Organization,
    SubscriptionResult,
    WebhookSubscription,
)


class OrbitUnavailable(Exception):
    """Raised when code tries to call a real Orbit instance. None is connected."""


class OrbitProvider(Protocol):
    def create_subscription(
        self,
        integration_id: str,
        event_types: list[str],
        callback_url: str,
    ) -> list[SubscriptionResult]:
        raise NotImplementedError

    def delete_subscription(self, subscription_id: str) -> None:
        raise NotImplementedError


class RealOrbitProvider:
    """Placeholder for Orbit's subscription API. There is no instance to call."""

    def create_subscription(self, integration_id: str, event_types: list[str], callback_url: str) -> list[SubscriptionResult]:
        raise OrbitUnavailable("No Orbit instance is connected")

    def delete_subscription(self, subscription_id: str) -> None:
        raise OrbitUnavailable("No Orbit instance is connected")


class MockOrbitProvider:
    """Simulated Orbit. Subscriptions are stored in Sentinel. Events are posted to the webhook route."""

    def __init__(self, catalog: OrbitCatalog) -> None:
        self.catalog = catalog
        self._secrets: dict[str, str] = {}

    def create_subscription(
        self,
        integration_id: str,
        event_types: list[str],
        callback_url: str,
    ) -> list[SubscriptionResult]:
        raise OrbitUnavailable("Use connect_organization so the facility and integration exist before the subscription")

    def open_subscription(
        self,
        organization: Organization,
        facility: Facility,
        integration: OrbitIntegration,
        event_type: str,
    ) -> tuple[WebhookSubscription, str]:
        subscription_id = _new_id("wh")
        secret = secrets.token_urlsafe(32)
        subscription = WebhookSubscription(
            id=subscription_id,
            integration_id=integration.id,
            event_type=event_type,
            status="active",
            provider_subscription_id=None,
            secret_hash=hash_secret(secret),
            callback_path=f"/api/webhooks/orbit/{subscription_id}",
            organization_id=organization.id,
            facility_id=facility.id,
            instance_url=integration.instance_url,
            mode=integration.mode,
        )
        self.catalog.create_connection(organization, facility, integration, subscription)
        self._secrets[subscription_id] = secret
        return subscription, secret

    def delete_subscription(self, subscription_id: str) -> None:
        self.catalog.disable_subscription(subscription_id)
        self._secrets.pop(subscription_id, None)

    def signing_secret(self, subscription_id: str) -> str | None:
        return self._secrets.get(subscription_id)

    def publish(self, subscription_id: str, event: dict, poster) -> tuple[int, dict]:
        """Post the event to Sentinel's webhook receiver. This does not write the inspection itself."""
        secret = self._secrets.get(subscription_id)
        subscription = self.catalog.get_subscription(subscription_id)
        if secret is None or subscription is None:
            raise OrbitUnavailable("This process does not have the simulated signing secret for that subscription")
        response = poster(subscription.callback_path, event, secret)
        return response


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def secret_matches(presented: str | None, secret_hash: str) -> bool:
    if not presented:
        return False
    return hmac.compare_digest(hash_secret(presented), secret_hash)


def _new_id(prefix: str) -> str:
    return prefix + "_" + secrets.token_hex(4)
