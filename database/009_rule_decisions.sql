-- Append-only record of each rules run. queue_items stays the current task.
-- Run this in the Lakebase SQL editor after 006_kit_organization.sql.
-- Policies are created and left disabled, same as the kit tables.
-- The API login needs the same privileges as the kit tables.

CREATE TABLE IF NOT EXISTS sentinel.rule_decisions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES sentinel.organizations (id),
    source TEXT NOT NULL CHECK (source IN ('kit', 'orbit', 'spot')),
    action_id TEXT NOT NULL,
    rule_set_version TEXT NOT NULL,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    queued BOOLEAN NOT NULL,
    verdict TEXT,
    rank INTEGER,
    FOREIGN KEY (source, action_id)
        REFERENCES sentinel.actions (source, action_id),
    CHECK (
        verdict IS NULL
        OR verdict IN ('inspection_failure', 'equipment_finding', 'potential_anomaly', 'unsupported_claim')
    ),
    CHECK (
        (queued AND verdict IS NOT NULL AND rank IS NOT NULL)
        OR (NOT queued AND verdict IS NULL AND rank IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS rule_decisions_org_idx
    ON sentinel.rule_decisions (organization_id);

CREATE INDEX IF NOT EXISTS rule_decisions_action_idx
    ON sentinel.rule_decisions (organization_id, source, action_id, decided_at DESC);

CREATE TABLE IF NOT EXISTS sentinel.rule_firings (
    decision_id TEXT NOT NULL REFERENCES sentinel.rule_decisions (id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL,
    matched BOOLEAN NOT NULL,
    observed_value TEXT,
    threshold TEXT,
    rank_delta INTEGER NOT NULL,
    PRIMARY KEY (decision_id, rule_id)
);

CREATE INDEX IF NOT EXISTS rule_firings_rule_idx
    ON sentinel.rule_firings (rule_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON
    sentinel.rule_decisions,
    sentinel.rule_firings
TO "ad65c919-7b3e-4b8c-9184-e9dabbc56625";

CREATE POLICY rule_decisions_org ON sentinel.rule_decisions
    FOR ALL
    USING (organization_id = current_setting('sentinel.organization_id', true))
    WITH CHECK (organization_id = current_setting('sentinel.organization_id', true));

CREATE POLICY rule_firings_org ON sentinel.rule_firings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM sentinel.rule_decisions AS decision
            WHERE decision.id = rule_firings.decision_id
              AND decision.organization_id = current_setting('sentinel.organization_id', true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM sentinel.rule_decisions AS decision
            WHERE decision.id = rule_firings.decision_id
              AND decision.organization_id = current_setting('sentinel.organization_id', true)
        )
    );
