-- The loaded kit belongs to one organization for the demo.
-- Run this in the Lakebase SQL editor after 004_orbit_connections.sql.
-- Existing canonical rows are assigned to North Yard. Sign in as
-- operator.north@sentinel.local to see them.

INSERT INTO sentinel.organizations (id, name)
VALUES ('org_north', 'North Yard')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE sentinel.locations
    ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES sentinel.organizations (id);
ALTER TABLE sentinel.assets
    ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES sentinel.organizations (id);
ALTER TABLE sentinel.missions
    ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES sentinel.organizations (id);
ALTER TABLE sentinel.actions
    ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES sentinel.organizations (id);
ALTER TABLE sentinel.readings
    ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES sentinel.organizations (id);
ALTER TABLE sentinel.anomaly_claims
    ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES sentinel.organizations (id);
ALTER TABLE sentinel.queue_items
    ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES sentinel.organizations (id);

UPDATE sentinel.locations SET organization_id = 'org_north' WHERE organization_id IS NULL;
UPDATE sentinel.assets SET organization_id = 'org_north' WHERE organization_id IS NULL;
UPDATE sentinel.missions SET organization_id = 'org_north' WHERE organization_id IS NULL;
UPDATE sentinel.actions SET organization_id = 'org_north' WHERE organization_id IS NULL;
UPDATE sentinel.readings SET organization_id = 'org_north' WHERE organization_id IS NULL;
UPDATE sentinel.anomaly_claims SET organization_id = 'org_north' WHERE organization_id IS NULL;
UPDATE sentinel.queue_items SET organization_id = 'org_north' WHERE organization_id IS NULL;

ALTER TABLE sentinel.locations ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE sentinel.assets ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE sentinel.missions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE sentinel.actions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE sentinel.readings ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE sentinel.anomaly_claims ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE sentinel.queue_items ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS locations_org_idx ON sentinel.locations (organization_id);
CREATE INDEX IF NOT EXISTS assets_org_idx ON sentinel.assets (organization_id);
CREATE INDEX IF NOT EXISTS missions_org_idx ON sentinel.missions (organization_id);
CREATE INDEX IF NOT EXISTS actions_org_idx ON sentinel.actions (organization_id);
CREATE INDEX IF NOT EXISTS readings_org_idx ON sentinel.readings (organization_id);
CREATE INDEX IF NOT EXISTS anomaly_claims_org_idx ON sentinel.anomaly_claims (organization_id);
CREATE INDEX IF NOT EXISTS queue_items_org_idx ON sentinel.queue_items (organization_id);
