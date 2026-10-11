-- Simulated Orbit connections. Sentinel does not have an Orbit instance.
-- An administrator connects an organization here. Orbit never sends organization_id.
-- The webhook id identifies the subscription. The secret hash authenticates the sender.
-- Run this in the Lakebase SQL editor after 001_canonical.sql, then set ORBIT_CATALOG=postgres.

CREATE SCHEMA IF NOT EXISTS sentinel;

CREATE TABLE IF NOT EXISTS sentinel.organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sentinel.facilities (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES sentinel.organizations (id),
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sentinel.orbit_integrations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES sentinel.organizations (id),
    facility_id TEXT NOT NULL REFERENCES sentinel.facilities (id),
    instance_url TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('simulated', 'live'))
);

CREATE TABLE IF NOT EXISTS sentinel.orbit_webhook_subscriptions (
    id TEXT PRIMARY KEY,
    integration_id TEXT NOT NULL REFERENCES sentinel.orbit_integrations (id),
    event_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
    provider_subscription_id TEXT,
    secret_hash TEXT NOT NULL,
    callback_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sentinel.orbit_webhook_deliveries (
    subscription_id TEXT NOT NULL REFERENCES sentinel.orbit_webhook_subscriptions (id),
    event_type TEXT NOT NULL,
    provider_mission_id TEXT NOT NULL,
    provider_action_id TEXT NOT NULL,
    robot_id TEXT,
    ingestion_mission_id TEXT NOT NULL,
    ingestion_action_id TEXT NOT NULL,
    status TEXT NOT NULL,
    organization_id TEXT NOT NULL REFERENCES sentinel.organizations (id),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (subscription_id, event_type, provider_mission_id, provider_action_id)
);

CREATE INDEX IF NOT EXISTS orbit_deliveries_org_idx
    ON sentinel.orbit_webhook_deliveries (organization_id);
