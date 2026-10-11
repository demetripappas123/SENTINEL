-- Queue rows written by the ingest service. Run after 001_canonical.sql.

CREATE SCHEMA IF NOT EXISTS sentinel;

CREATE TABLE IF NOT EXISTS sentinel.queue_items (
    source TEXT NOT NULL CHECK (source IN ('kit', 'orbit', 'spot')),
    action_id TEXT NOT NULL,
    verdict TEXT NOT NULL CHECK (verdict IN ('inspection_failure', 'equipment_finding', 'unsupported_claim')),
    cause TEXT NOT NULL,
    explanation TEXT NOT NULL,
    mission_id TEXT NOT NULL,
    asset_id TEXT,
    location_id TEXT,
    rank INTEGER NOT NULL,
    evidence JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (source, action_id),
    FOREIGN KEY (source, action_id)
        REFERENCES sentinel.actions (source, action_id)
);

CREATE INDEX IF NOT EXISTS queue_items_rank_idx
    ON sentinel.queue_items (rank DESC);

CREATE INDEX IF NOT EXISTS actions_asset_time_idx
    ON sentinel.actions (asset_id, timestamp);

CREATE INDEX IF NOT EXISTS readings_measurement_time_idx
    ON sentinel.readings (measurement_type, quality, timestamp);
