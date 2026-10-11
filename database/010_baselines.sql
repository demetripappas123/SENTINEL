-- Reference data and stored baselines for equipment findings.
-- Run this in the Lakebase SQL editor after 006_kit_organization.sql.
-- Readings stay the observations. These tables say what a reading is
-- and which comparison is defensible.
--
-- A finding tries three comparisons, in order:
--   asset        this asset's own good readings of this measurement
--   cohort       this organization's assets of the same type
--   engineering  a specified low and high for that type and measurement
-- No matching row means that stored baseline is insufficient.
-- A good reading above the in-memory common-sense ceiling can still
-- queue as a potential anomaly. That ceiling does not read these rows.
-- The API still computes the asset fence in memory. These rows are the
-- stored form of that ladder.

CREATE TABLE IF NOT EXISTS sentinel.asset_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sentinel.measurement_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    canonical_unit TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sentinel.anomaly_baselines (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES sentinel.organizations (id),
    baseline_level TEXT NOT NULL CHECK (baseline_level IN ('asset', 'cohort', 'engineering')),
    method TEXT NOT NULL CHECK (method IN ('iqr', 'specification')),
    asset_type_id TEXT NOT NULL REFERENCES sentinel.asset_types (id),
    measurement_definition_id TEXT NOT NULL REFERENCES sentinel.measurement_definitions (id),
    source TEXT,
    asset_id TEXT,
    sample_count INTEGER,
    low DOUBLE PRECISION,
    high DOUBLE PRECISION,
    mean DOUBLE PRECISION,
    standard_deviation DOUBLE PRECISION,
    baseline_version TEXT NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (source, asset_id) REFERENCES sentinel.assets (source, asset_id),
    CHECK (
        (
            baseline_level = 'asset'
            AND method = 'iqr'
            AND source IS NOT NULL
            AND asset_id IS NOT NULL
            AND sample_count IS NOT NULL
            AND low IS NOT NULL
            AND high IS NOT NULL
        )
        OR (
            baseline_level = 'cohort'
            AND method = 'iqr'
            AND source IS NULL
            AND asset_id IS NULL
            AND sample_count IS NOT NULL
            AND low IS NOT NULL
            AND high IS NOT NULL
        )
        OR (
            baseline_level = 'engineering'
            AND method = 'specification'
            AND source IS NULL
            AND asset_id IS NULL
            AND sample_count IS NULL
            AND low IS NOT NULL
            AND high IS NOT NULL
        )
    )
);

CREATE INDEX IF NOT EXISTS anomaly_baselines_org_idx
    ON sentinel.anomaly_baselines (organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS anomaly_baselines_asset_idx
    ON sentinel.anomaly_baselines (organization_id, source, asset_id, measurement_definition_id, baseline_version)
    WHERE baseline_level = 'asset';

CREATE UNIQUE INDEX IF NOT EXISTS anomaly_baselines_cohort_idx
    ON sentinel.anomaly_baselines (organization_id, asset_type_id, measurement_definition_id, baseline_version)
    WHERE baseline_level = 'cohort';

CREATE UNIQUE INDEX IF NOT EXISTS anomaly_baselines_engineering_idx
    ON sentinel.anomaly_baselines (organization_id, asset_type_id, measurement_definition_id, baseline_version)
    WHERE baseline_level = 'engineering';

INSERT INTO sentinel.asset_types (id, name) VALUES
    ('compressor', 'Compressor'),
    ('electrical_panel', 'Electrical Panel'),
    ('heat_exchanger', 'Heat Exchanger'),
    ('motor', 'Motor'),
    ('pressure_gauge', 'Pressure Gauge'),
    ('pump', 'Pump'),
    ('valve', 'Valve')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sentinel.measurement_definitions (id, name, canonical_unit) VALUES
    ('TEMPERATURE_C', 'Temperature', 'C'),
    ('PRESSURE_PSI', 'Pressure', 'psi'),
    ('SOUND_DB', 'Sound', 'dB'),
    ('VISUAL_SCORE', 'Visual score', 'score'),
    ('LOCALIZATION_CONFIDENCE_PCT', 'Localization confidence', 'pct')
ON CONFLICT (id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON
    sentinel.asset_types,
    sentinel.measurement_definitions,
    sentinel.anomaly_baselines
TO "ad65c919-7b3e-4b8c-9184-e9dabbc56625";

CREATE POLICY anomaly_baselines_org ON sentinel.anomaly_baselines
    FOR ALL
    USING (organization_id = current_setting('sentinel.organization_id', true))
    WITH CHECK (organization_id = current_setting('sentinel.organization_id', true));
