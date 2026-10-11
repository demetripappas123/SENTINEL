-- One Orbit connection per organization.
-- Run this in the Lakebase SQL editor after 004_orbit_connections.sql.
-- An organization gets one integration. That integration currently has one
-- subscription. Drop the subscription index when a connection can carry
-- more than one webhook subscription. A disabled subscription still occupies
-- the slot.

CREATE UNIQUE INDEX IF NOT EXISTS orbit_integrations_one_per_org
    ON sentinel.orbit_integrations (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS orbit_subscriptions_one_per_integration
    ON sentinel.orbit_webhook_subscriptions (integration_id);
