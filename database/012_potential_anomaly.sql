-- Allow the potential_anomaly verdict on queue rows and rule decisions.
-- Run this in the Lakebase SQL editor after 002_queue.sql and 009_rule_decisions.sql.
-- A good reading above the common-sense ceiling uses this verdict.
-- It is not an equipment finding and it is not an unbacked label.

DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'sentinel'
          AND rel.relname = 'queue_items'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%unsupported_claim%'
    LOOP
        EXECUTE format('ALTER TABLE sentinel.queue_items DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE sentinel.queue_items
    ADD CONSTRAINT queue_items_verdict_check
    CHECK (verdict IN ('inspection_failure', 'equipment_finding', 'potential_anomaly', 'unsupported_claim'));

DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'sentinel'
          AND rel.relname = 'rule_decisions'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%unsupported_claim%'
    LOOP
        EXECUTE format('ALTER TABLE sentinel.rule_decisions DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE sentinel.rule_decisions
    ADD CONSTRAINT rule_decisions_verdict_check
    CHECK (
        verdict IS NULL
        OR verdict IN ('inspection_failure', 'equipment_finding', 'potential_anomaly', 'unsupported_claim')
    );
