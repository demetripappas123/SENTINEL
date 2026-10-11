-- The two stored Orbit walks belong to North Yard's demo webhook.
-- The kit rows stay on the organization and are not a subscription.
-- Run this in the Lakebase SQL editor after 006_kit_organization.sql.
-- Demo signing secret: sentinel-orbit-demo

INSERT INTO sentinel.organizations (id, name)
VALUES ('org_north', 'North Yard')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sentinel.facilities (id, organization_id, name)
VALUES ('fac_north_demo', 'org_north', 'North Yard')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sentinel.orbit_integrations (id, organization_id, facility_id, instance_url, mode)
VALUES ('int_north_demo', 'org_north', 'fac_north_demo', 'https://orbit.example', 'simulated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sentinel.orbit_webhook_subscriptions (
    id, integration_id, event_type, status, provider_subscription_id, secret_hash, callback_path
) VALUES (
    'wh_north_demo',
    'int_north_demo',
    'ACTION_COMPLETED',
    'active',
    NULL,
    '0af48da29656df1ef91a9f9339f6649b32cf8d63872fe47b573c107741f7f9aa',
    '/api/webhooks/orbit/wh_north_demo'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE sentinel.missions ADD COLUMN IF NOT EXISTS subscription_id TEXT;
ALTER TABLE sentinel.actions ADD COLUMN IF NOT EXISTS subscription_id TEXT;
ALTER TABLE sentinel.readings ADD COLUMN IF NOT EXISTS subscription_id TEXT;

UPDATE sentinel.missions
SET subscription_id = 'wh_north_demo'
WHERE source = 'orbit';

UPDATE sentinel.actions
SET subscription_id = 'wh_north_demo'
WHERE source = 'orbit';

UPDATE sentinel.readings
SET subscription_id = 'wh_north_demo'
WHERE source = 'orbit';

INSERT INTO sentinel.orbit_webhook_deliveries (
    subscription_id, event_type, provider_mission_id, provider_action_id,
    robot_id, ingestion_mission_id, ingestion_action_id, status, organization_id
)
SELECT
    'wh_north_demo',
    'ACTION_COMPLETED',
    actions.mission_id,
    actions.action_id,
    NULL,
    'org_north:' || actions.mission_id,
    'org_north:' || actions.action_id,
    actions.status,
    'org_north'
FROM sentinel.actions AS actions
WHERE actions.source = 'orbit'
ON CONFLICT DO NOTHING;
