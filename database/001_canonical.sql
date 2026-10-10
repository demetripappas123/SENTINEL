-- SENTINEL canonical tables for Databricks Lakebase (Postgres).
-- Run this in the Lakebase SQL editor, not a Databricks SQL warehouse.
-- Queue rows are stored separately. Run 002_queue.sql after this file.
-- Load order: locations, assets, missions, actions, readings, anomaly_claims.

CREATE SCHEMA IF NOT EXISTS sentinel;

CREATE TABLE IF NOT EXISTS sentinel.locations (
    source TEXT NOT NULL CHECK (source IN ('kit', 'orbit', 'spot')),
    location_id TEXT NOT NULL,
    location_name TEXT NOT NULL,
    zone_type TEXT NOT NULL,
    floor INTEGER NOT NULL,
    x_coord DOUBLE PRECISION NOT NULL,
    y_coord DOUBLE PRECISION NOT NULL,
    environment TEXT NOT NULL,
    PRIMARY KEY (source, location_id)
);

CREATE TABLE IF NOT EXISTS sentinel.assets (
    source TEXT NOT NULL CHECK (source IN ('kit', 'orbit', 'spot')),
    asset_id TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    location_id TEXT NOT NULL,
    criticality TEXT NOT NULL,
    PRIMARY KEY (source, asset_id),
    FOREIGN KEY (source, location_id)
        REFERENCES sentinel.locations (source, location_id)
);

CREATE TABLE IF NOT EXISTS sentinel.missions (
    source TEXT NOT NULL CHECK (source IN ('kit', 'orbit', 'spot')),
    mission_id TEXT NOT NULL,
    mission_name TEXT NOT NULL,
    scenario TEXT,
    configuration_version TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_min DOUBLE PRECISION,
    start_battery_pct DOUBLE PRECISION,
    end_battery_pct DOUBLE PRECISION,
    mission_status TEXT NOT NULL,
    operator_mode TEXT,
    PRIMARY KEY (source, mission_id)
);

CREATE TABLE IF NOT EXISTS sentinel.actions (
    source TEXT NOT NULL CHECK (source IN ('kit', 'orbit', 'spot')),
    action_id TEXT NOT NULL,
    mission_id TEXT NOT NULL,
    sequence INTEGER,
    timestamp TIMESTAMPTZ,
    location_id TEXT,
    asset_id TEXT,
    action_type TEXT NOT NULL,
    battery_pct DOUBLE PRECISION,
    status TEXT NOT NULL,
    failure_type TEXT,
    duration_sec DOUBLE PRECISION,
    scenario TEXT,
    configuration_version TEXT,
    PRIMARY KEY (source, action_id),
    FOREIGN KEY (source, mission_id)
        REFERENCES sentinel.missions (source, mission_id),
    FOREIGN KEY (source, location_id)
        REFERENCES sentinel.locations (source, location_id),
    FOREIGN KEY (source, asset_id)
        REFERENCES sentinel.assets (source, asset_id)
);

CREATE TABLE IF NOT EXISTS sentinel.readings (
    source TEXT NOT NULL CHECK (source IN ('kit', 'orbit', 'spot')),
    reading_id TEXT NOT NULL,
    action_id TEXT NOT NULL,
    mission_id TEXT NOT NULL,
    asset_id TEXT,
    location_id TEXT,
    timestamp TIMESTAMPTZ,
    measurement_type TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL,
    quality TEXT NOT NULL,
    PRIMARY KEY (source, reading_id),
    FOREIGN KEY (source, action_id)
        REFERENCES sentinel.actions (source, action_id),
    FOREIGN KEY (source, mission_id)
        REFERENCES sentinel.missions (source, mission_id),
    FOREIGN KEY (source, asset_id)
        REFERENCES sentinel.assets (source, asset_id),
    FOREIGN KEY (source, location_id)
        REFERENCES sentinel.locations (source, location_id)
);

CREATE TABLE IF NOT EXISTS sentinel.anomaly_claims (
    source TEXT NOT NULL CHECK (source IN ('kit', 'orbit', 'spot')),
    anomaly_id TEXT NOT NULL,
    action_id TEXT NOT NULL,
    mission_id TEXT NOT NULL,
    location_id TEXT,
    asset_id TEXT,
    timestamp TIMESTAMPTZ,
    anomaly_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    operator_review_required BOOLEAN NOT NULL,
    description TEXT NOT NULL,
    PRIMARY KEY (source, anomaly_id),
    FOREIGN KEY (source, action_id)
        REFERENCES sentinel.actions (source, action_id),
    FOREIGN KEY (source, mission_id)
        REFERENCES sentinel.missions (source, mission_id),
    FOREIGN KEY (source, asset_id)
        REFERENCES sentinel.assets (source, asset_id),
    FOREIGN KEY (source, location_id)
        REFERENCES sentinel.locations (source, location_id)
);

CREATE INDEX IF NOT EXISTS actions_mission_idx
    ON sentinel.actions (source, mission_id);

CREATE INDEX IF NOT EXISTS actions_asset_idx
    ON sentinel.actions (source, asset_id);

CREATE INDEX IF NOT EXISTS actions_location_idx
    ON sentinel.actions (source, location_id);

CREATE INDEX IF NOT EXISTS actions_status_idx
    ON sentinel.actions (source, status);

CREATE INDEX IF NOT EXISTS readings_action_idx
    ON sentinel.readings (source, action_id);

CREATE INDEX IF NOT EXISTS readings_quality_idx
    ON sentinel.readings (source, quality);

CREATE INDEX IF NOT EXISTS anomaly_claims_action_idx
    ON sentinel.anomaly_claims (source, action_id);
