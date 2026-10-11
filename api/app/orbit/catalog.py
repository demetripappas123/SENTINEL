"""Store of Orbit integrations, webhook subscriptions, and deliveries.

MemoryCatalog is the default. PostgresCatalog is used when ORBIT_CATALOG is postgres.
An organization has one integration, and that integration has one subscription.
"""
import os
from abc import ABC, abstractmethod

from app.orbit.models import (
    ConnectionView,
    Facility,
    InspectionRecord,
    OrbitIntegration,
    Organization,
    WebhookSubscription,
)


class OrbitCatalog(ABC):
    @abstractmethod
    def create_connection(
        self,
        organization: Organization,
        facility: Facility,
        integration: OrbitIntegration,
        subscription: WebhookSubscription,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_subscription(self, subscription_id: str) -> WebhookSubscription | None:
        raise NotImplementedError

    @abstractmethod
    def disable_subscription(self, subscription_id: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def record_delivery(self, inspection: InspectionRecord) -> bool:
        """Store the first delivery. Return False when this event was already accepted."""
        raise NotImplementedError

    @abstractmethod
    def inspections(self, organization_id: str) -> list[InspectionRecord]:
        raise NotImplementedError

    @abstractmethod
    def connections(self) -> list[ConnectionView]:
        raise NotImplementedError


class MemoryCatalog(OrbitCatalog):
    def __init__(self) -> None:
        self._subscriptions: dict[str, WebhookSubscription] = {}
        self._organizations: dict[str, Organization] = {}
        self._facilities: dict[str, Facility] = {}
        self._integrations: dict[str, OrbitIntegration] = {}
        self._deliveries: dict[tuple[str, str, str, str], InspectionRecord] = {}

    def create_connection(
        self,
        organization: Organization,
        facility: Facility,
        integration: OrbitIntegration,
        subscription: WebhookSubscription,
    ) -> None:
        self._organizations[organization.id] = organization
        self._facilities[facility.id] = facility
        self._integrations[integration.id] = integration
        self._subscriptions[subscription.id] = subscription

    def get_subscription(self, subscription_id: str) -> WebhookSubscription | None:
        return self._subscriptions.get(subscription_id)

    def disable_subscription(self, subscription_id: str) -> None:
        current = self._subscriptions.get(subscription_id)
        if current is None:
            return
        self._subscriptions[subscription_id] = current.model_copy(update={"status": "disabled"})

    def record_delivery(self, inspection: InspectionRecord) -> bool:
        key = (
            inspection.subscription_id,
            inspection.event_type,
            inspection.provider_mission_id,
            inspection.provider_action_id,
        )
        if key in self._deliveries:
            return False
        self._deliveries[key] = inspection
        return True

    def inspections(self, organization_id: str) -> list[InspectionRecord]:
        return [row for row in self._deliveries.values() if row.organization_id == organization_id]

    def connections(self) -> list[ConnectionView]:
        views = []
        for subscription in self._subscriptions.values():
            views.append(
                ConnectionView(
                    organization=self._organizations[subscription.organization_id],
                    facility=self._facilities[subscription.facility_id],
                    integration=self._integrations[subscription.integration_id],
                    subscription_id=subscription.id,
                    event_type=subscription.event_type,
                    status=subscription.status,
                    callback_path=subscription.callback_path,
                )
            )
        return views


class PostgresCatalog(OrbitCatalog):
    """Same records as MemoryCatalog, stored in the tables from 004_orbit_connections.sql."""

    def create_connection(
        self,
        organization: Organization,
        facility: Facility,
        integration: OrbitIntegration,
        subscription: WebhookSubscription,
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO sentinel.organizations (id, name) VALUES (%s, %s) ON CONFLICT (id) DO NOTHING",
                (organization.id, organization.name),
            )
            conn.execute(
                "INSERT INTO sentinel.facilities (id, organization_id, name) VALUES (%s, %s, %s)",
                (facility.id, facility.organization_id, facility.name),
            )
            conn.execute(
                """
                INSERT INTO sentinel.orbit_integrations
                    (id, organization_id, facility_id, instance_url, mode)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (integration.id, integration.organization_id, integration.facility_id, integration.instance_url, integration.mode),
            )
            conn.execute(
                """
                INSERT INTO sentinel.orbit_webhook_subscriptions
                    (id, integration_id, event_type, status, provider_subscription_id, secret_hash, callback_path)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    subscription.id,
                    subscription.integration_id,
                    subscription.event_type,
                    subscription.status,
                    subscription.provider_subscription_id,
                    subscription.secret_hash,
                    subscription.callback_path,
                ),
            )
            conn.commit()

    def get_subscription(self, subscription_id: str) -> WebhookSubscription | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT subscription.id, subscription.integration_id, subscription.event_type,
                       subscription.status, subscription.provider_subscription_id,
                       subscription.secret_hash, subscription.callback_path,
                       integration.organization_id, integration.facility_id,
                       integration.instance_url, integration.mode
                FROM sentinel.orbit_webhook_subscriptions AS subscription
                JOIN sentinel.orbit_integrations AS integration
                  ON integration.id = subscription.integration_id
                WHERE subscription.id = %s
                """,
                (subscription_id,),
            ).fetchone()
        if row is None:
            return None
        return WebhookSubscription.model_validate(row)

    def disable_subscription(self, subscription_id: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE sentinel.orbit_webhook_subscriptions SET status = 'disabled' WHERE id = %s",
                (subscription_id,),
            )
            conn.commit()

    def record_delivery(self, inspection: InspectionRecord) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                """
                INSERT INTO sentinel.orbit_webhook_deliveries (
                    subscription_id, event_type, provider_mission_id, provider_action_id,
                    robot_id, ingestion_mission_id, ingestion_action_id, status, organization_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                RETURNING subscription_id
                """,
                (
                    inspection.subscription_id,
                    inspection.event_type,
                    inspection.provider_mission_id,
                    inspection.provider_action_id,
                    inspection.robot_id,
                    inspection.ingestion_mission_id,
                    inspection.ingestion_action_id,
                    inspection.status,
                    inspection.organization_id,
                ),
            ).fetchone()
            conn.commit()
        return row is not None

    def inspections(self, organization_id: str) -> list[InspectionRecord]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT organization_id, integration.facility_id, integration.id AS integration_id,
                       subscription_id, event_type, provider_mission_id, provider_action_id,
                       robot_id, ingestion_mission_id, ingestion_action_id, status
                FROM sentinel.orbit_webhook_deliveries AS delivery
                JOIN sentinel.orbit_webhook_subscriptions AS subscription
                  ON subscription.id = delivery.subscription_id
                JOIN sentinel.orbit_integrations AS integration
                  ON integration.id = subscription.integration_id
                WHERE delivery.organization_id = %s
                ORDER BY ingestion_action_id
                """,
                (organization_id,),
            ).fetchall()
        return [InspectionRecord.model_validate(row) for row in rows]

    def connections(self) -> list[ConnectionView]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT organization.id AS organization_id, organization.name AS organization_name,
                       facility.id AS facility_id, facility.name AS facility_name,
                       integration.id AS integration_id, integration.instance_url, integration.mode,
                       subscription.id AS subscription_id, subscription.event_type,
                       subscription.status, subscription.callback_path
                FROM sentinel.orbit_webhook_subscriptions AS subscription
                JOIN sentinel.orbit_integrations AS integration
                  ON integration.id = subscription.integration_id
                JOIN sentinel.facilities AS facility ON facility.id = integration.facility_id
                JOIN sentinel.organizations AS organization ON organization.id = integration.organization_id
                ORDER BY organization.id, subscription.id
                """
            ).fetchall()
        return [
            ConnectionView(
                organization=Organization(id=row["organization_id"], name=row["organization_name"]),
                facility=Facility(id=row["facility_id"], organization_id=row["organization_id"], name=row["facility_name"]),
                integration=OrbitIntegration(
                    id=row["integration_id"],
                    organization_id=row["organization_id"],
                    facility_id=row["facility_id"],
                    instance_url=row["instance_url"],
                    mode=row["mode"],
                ),
                subscription_id=row["subscription_id"],
                event_type=row["event_type"],
                status=row["status"],
                callback_path=row["callback_path"],
            )
            for row in rows
        ]

    def _connect(self):
        from app.db import connect

        return connect()


_memory = MemoryCatalog()


def get_catalog() -> OrbitCatalog:
    if os.environ.get("ORBIT_CATALOG") == "postgres":
        return PostgresCatalog()
    return _memory
