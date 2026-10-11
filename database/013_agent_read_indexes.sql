-- Indexes for the read-only agent tools.
-- Run this in the Lakebase SQL editor after 006_kit_organization.sql.
-- The tools filter by organization, asset, and time.

CREATE INDEX IF NOT EXISTS readings_org_asset_time_idx
    ON sentinel.readings (organization_id, asset_id, timestamp);

CREATE INDEX IF NOT EXISTS actions_org_asset_time_idx
    ON sentinel.actions (organization_id, asset_id, timestamp);

CREATE INDEX IF NOT EXISTS anomaly_claims_org_asset_time_idx
    ON sentinel.anomaly_claims (organization_id, asset_id, timestamp);

CREATE INDEX IF NOT EXISTS queue_items_org_rank_idx
    ON sentinel.queue_items (organization_id, rank DESC);
