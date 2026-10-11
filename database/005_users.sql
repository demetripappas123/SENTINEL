-- People who sign in. The organization owns the Orbit webhook, not the user.
-- Run this in the Lakebase SQL editor after 004_orbit_connections.sql.
-- Seeded operators use the password sentinel. Replace these rows before any shared deployment.

CREATE TABLE IF NOT EXISTS sentinel.users (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES sentinel.organizations (id),
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sentinel.sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES sentinel.users (id),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS users_organization_idx
    ON sentinel.users (organization_id);

INSERT INTO sentinel.organizations (id, name) VALUES
    ('org_north', 'North Yard'),
    ('org_south', 'South Yard')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sentinel.users (id, organization_id, email, name, password_hash) VALUES
    (
        'usr_north',
        'org_north',
        'operator.north@sentinel.local',
        'North Operator',
        'pbkdf2_sha256$200000$5f8c2a1b9e0d4c7744aa91c0d3e6b812$b0b50b5ae982bd64b90429e91e035c4d44cf3d703092ecd489ee52a2b4228da0'
    ),
    (
        'usr_south',
        'org_south',
        'operator.south@sentinel.local',
        'South Operator',
        'pbkdf2_sha256$200000$5f8c2a1b9e0d4c7744aa91c0d3e6b812$b0b50b5ae982bd64b90429e91e035c4d44cf3d703092ecd489ee52a2b4228da0'
    )
ON CONFLICT (email) DO NOTHING;
