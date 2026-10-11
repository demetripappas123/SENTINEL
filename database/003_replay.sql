-- Replay events written by the ingest service. Run after 002_queue.sql.

CREATE SCHEMA IF NOT EXISTS sentinel;

CREATE TABLE IF NOT EXISTS sentinel.replay_events (
    source TEXT NOT NULL CHECK (source IN ('kit', 'orbit', 'spot')),
    event_id TEXT NOT NULL,
    mission_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ,
    event_type TEXT NOT NULL,
    details JSONB NOT NULL,
    PRIMARY KEY (source, event_id),
    FOREIGN KEY (source, mission_id)
        REFERENCES sentinel.missions (source, mission_id)
);

CREATE INDEX IF NOT EXISTS replay_events_mission_time_idx
    ON sentinel.replay_events (source, mission_id, timestamp);
