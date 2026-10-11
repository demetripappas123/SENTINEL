-- scenario duplicated configuration_version (BASELINE was always V1, IMPROVED always V2).
-- Run this in the Lakebase SQL editor after 001_canonical.sql has already been applied.

ALTER TABLE sentinel.missions DROP COLUMN IF EXISTS scenario;
ALTER TABLE sentinel.actions DROP COLUMN IF EXISTS scenario;
