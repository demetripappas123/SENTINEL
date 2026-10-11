"""Read-only queries for the agent tools.

Every statement selects from the signed-in organization. Asset ids from
another organization return no rows.
"""
import json
from datetime import datetime

SELECT_ONLY = "agent tools only run SELECT"


def fetch(conn, sql: str, params: tuple) -> list[dict]:
    if not sql.lstrip().upper().startswith("SELECT"):
        raise RuntimeError(SELECT_ONLY)
    rows = conn.execute(sql, params).fetchall()
    return [dict(row) for row in rows]


def facility(conn, organization_id: str, facility_id: str) -> dict | None:
    rows = fetch(
        conn,
        """
        SELECT id, name
        FROM sentinel.facilities
        WHERE organization_id = %s AND id = %s
        """,
        (organization_id, facility_id),
    )
    return rows[0] if rows else None


def search_assets(conn, organization_id: str, query: str | None, asset_type: str | None, limit: int) -> list[dict]:
    clauses = ["organization_id = %s"]
    params: list = [organization_id]
    if asset_type:
        clauses.append("asset_type ILIKE %s")
        params.append(asset_type)
    if query:
        clauses.append("(asset_name ILIKE %s OR asset_id ILIKE %s OR location_id ILIKE %s)")
        pattern = "%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        params.extend([pattern, pattern, pattern])
    params.append(limit)
    return fetch(
        conn,
        f"""
        SELECT source, asset_id, asset_name, asset_type, location_id, criticality
        FROM sentinel.assets
        WHERE {' AND '.join(clauses)}
        ORDER BY asset_name, asset_id
        LIMIT %s
        """,
        tuple(params),
    )


def asset(conn, organization_id: str, asset_id: str) -> dict | None:
    rows = fetch(
        conn,
        """
        SELECT source, asset_id, asset_name, asset_type, location_id, criticality
        FROM sentinel.assets
        WHERE organization_id = %s AND asset_id = %s
        """,
        (organization_id, asset_id),
    )
    return rows[0] if rows else None


def assets_by_ids(conn, organization_id: str, asset_ids: list[str]) -> list[dict]:
    if not asset_ids:
        return []
    return fetch(
        conn,
        """
        SELECT source, asset_id, asset_name, asset_type, location_id, criticality
        FROM sentinel.assets
        WHERE organization_id = %s AND asset_id = ANY(%s)
        """,
        (organization_id, asset_ids),
    )


def locations_by_ids(conn, organization_id: str, location_ids: list[str]) -> list[dict]:
    if not location_ids:
        return []
    return fetch(
        conn,
        """
        SELECT source, location_id, location_name, zone_type, environment
        FROM sentinel.locations
        WHERE organization_id = %s AND location_id = ANY(%s)
        """,
        (organization_id, location_ids),
    )


def measurement_types(conn, organization_id: str, asset_ids: list[str]) -> list[dict]:
    if not asset_ids:
        return []
    return fetch(
        conn,
        """
        SELECT asset_id, measurement_type, unit, count(*) AS reading_count,
               min(timestamp) AS first_timestamp, max(timestamp) AS last_timestamp
        FROM sentinel.readings
        WHERE organization_id = %s AND asset_id = ANY(%s)
        GROUP BY asset_id, measurement_type, unit
        ORDER BY asset_id, measurement_type, unit
        """,
        (organization_id, asset_ids),
    )


def action_counts(conn, organization_id: str, asset_ids: list[str]) -> list[dict]:
    if not asset_ids:
        return []
    return fetch(
        conn,
        """
        SELECT asset_id, count(*) AS action_count
        FROM sentinel.actions
        WHERE organization_id = %s AND asset_id = ANY(%s)
        GROUP BY asset_id
        """,
        (organization_id, asset_ids),
    )


def readings(
    conn,
    organization_id: str,
    asset_ids: list[str],
    start: datetime | None,
    end: datetime | None,
    measurement_types: list[str] | None,
    limit: int,
    cursor_time: datetime | None = None,
    cursor_id: str | None = None,
) -> list[dict]:
    if not asset_ids:
        return []
    clauses = ["organization_id = %s", "asset_id = ANY(%s)"]
    params: list = [organization_id, asset_ids]
    if start is not None:
        clauses.append("timestamp >= %s")
        params.append(start)
    if end is not None:
        clauses.append("timestamp < %s")
        params.append(end)
    if measurement_types:
        clauses.append("measurement_type = ANY(%s)")
        params.append(measurement_types)
    if cursor_time is not None and cursor_id is not None:
        clauses.append("(timestamp > %s OR (timestamp = %s AND reading_id > %s))")
        params.extend([cursor_time, cursor_time, cursor_id])
    params.append(limit)
    return fetch(
        conn,
        f"""
        SELECT source, reading_id, action_id, mission_id, asset_id, location_id,
               timestamp, measurement_type, value, unit, quality
        FROM sentinel.readings
        WHERE {' AND '.join(clauses)}
        ORDER BY timestamp, reading_id
        LIMIT %s
        """,
        tuple(params),
    )


def queue_items(conn, organization_id: str) -> list[dict]:
    rows = fetch(
        conn,
        """
        SELECT source, action_id, verdict, cause, explanation, mission_id,
               asset_id, location_id, rank, evidence, updated_at
        FROM sentinel.queue_items
        WHERE organization_id = %s
        ORDER BY rank DESC, mission_id, action_id
        """,
        (organization_id,),
    )
    for row in rows:
        row["evidence"] = _object(row.get("evidence"))
    return rows


def claims(
    conn,
    organization_id: str,
    asset_id: str | None,
    start: datetime | None,
    end: datetime | None,
) -> list[dict]:
    clauses = ["organization_id = %s"]
    params: list = [organization_id]
    if asset_id:
        clauses.append("asset_id = %s")
        params.append(asset_id)
    if start is not None:
        clauses.append("timestamp >= %s")
        params.append(start)
    if end is not None:
        clauses.append("timestamp < %s")
        params.append(end)
    return fetch(
        conn,
        f"""
        SELECT source, anomaly_id, action_id, mission_id, asset_id, location_id,
               timestamp, anomaly_type, severity, description
        FROM sentinel.anomaly_claims
        WHERE {' AND '.join(clauses)}
        ORDER BY timestamp, anomaly_id
        """,
        tuple(params),
    )


def decisions_for_action(conn, organization_id: str, action_id: str) -> list[dict]:
    return fetch(
        conn,
        """
        SELECT id, source, action_id, rule_set_version, decided_at, queued, verdict, rank
        FROM sentinel.rule_decisions
        WHERE organization_id = %s AND action_id = %s
        ORDER BY decided_at DESC
        """,
        (organization_id, action_id),
    )


def decisions_between(conn, organization_id: str, start: datetime, end: datetime, asset_id: str | None) -> list[dict]:
    clauses = ["decision.organization_id = %s", "decision.decided_at >= %s", "decision.decided_at < %s"]
    params: list = [organization_id, start, end]
    if asset_id:
        clauses.append("action.asset_id = %s")
        params.append(asset_id)
    return fetch(
        conn,
        f"""
        SELECT decision.id, decision.source, decision.action_id, decision.rule_set_version,
               decision.decided_at, decision.queued, decision.verdict, decision.rank,
               action.asset_id
        FROM sentinel.rule_decisions AS decision
        JOIN sentinel.actions AS action
          ON action.organization_id = decision.organization_id
         AND action.source = decision.source
         AND action.action_id = decision.action_id
        WHERE {' AND '.join(clauses)}
        ORDER BY decision.decided_at, decision.id
        """,
        tuple(params),
    )


def firings(conn, organization_id: str, decision_ids: list[str]) -> list[dict]:
    if not decision_ids:
        return []
    return fetch(
        conn,
        """
        SELECT firing.decision_id, firing.rule_id, firing.matched, firing.observed_value,
               firing.threshold, firing.rank_delta
        FROM sentinel.rule_firings AS firing
        JOIN sentinel.rule_decisions AS decision ON decision.id = firing.decision_id
        WHERE decision.organization_id = %s AND firing.decision_id = ANY(%s)
        ORDER BY firing.decision_id, firing.rule_id
        """,
        (organization_id, decision_ids),
    )


def asset_type_counts(conn, organization_id: str) -> list[dict]:
    return fetch(
        conn,
        """
        SELECT asset_type, count(*) AS asset_count
        FROM sentinel.assets
        WHERE organization_id = %s
        GROUP BY asset_type
        ORDER BY asset_type
        """,
        (organization_id,),
    )


def queue_verdict_counts(conn, organization_id: str) -> list[dict]:
    return fetch(
        conn,
        """
        SELECT verdict, count(*) AS item_count
        FROM sentinel.queue_items
        WHERE organization_id = %s
        GROUP BY verdict
        ORDER BY verdict
        """,
        (organization_id,),
    )


def claim_type_counts(conn, organization_id: str, start: datetime | None, end: datetime | None) -> list[dict]:
    clauses = ["organization_id = %s"]
    params: list = [organization_id]
    if start is not None:
        clauses.append("timestamp >= %s")
        params.append(start)
    if end is not None:
        clauses.append("timestamp < %s")
        params.append(end)
    return fetch(
        conn,
        f"""
        SELECT anomaly_type, count(*) AS claim_count
        FROM sentinel.anomaly_claims
        WHERE {' AND '.join(clauses)}
        GROUP BY anomaly_type
        ORDER BY anomaly_type
        """,
        tuple(params),
    )


def recent_actions(conn, organization_id: str, start: datetime | None, end: datetime | None, limit: int) -> list[dict]:
    clauses = ["organization_id = %s"]
    params: list = [organization_id]
    if start is not None:
        clauses.append("timestamp >= %s")
        params.append(start)
    if end is not None:
        clauses.append("timestamp < %s")
        params.append(end)
    params.append(limit)
    return fetch(
        conn,
        f"""
        SELECT source, action_id, mission_id, asset_id, location_id, timestamp, action_type, status
        FROM sentinel.actions
        WHERE {' AND '.join(clauses)}
        ORDER BY timestamp DESC NULLS LAST, action_id
        LIMIT %s
        """,
        tuple(params),
    )


def freshness(conn, organization_id: str) -> dict:
    rows = fetch(
        conn,
        """
        SELECT max(timestamp) AS latest_reading,
               (SELECT max(timestamp) FROM sentinel.actions WHERE organization_id = %s) AS latest_action
        FROM sentinel.readings
        WHERE organization_id = %s
        """,
        (organization_id, organization_id),
    )
    return rows[0] if rows else {}


def reading_coverage(conn, organization_id: str, asset_ids: list[str], start: datetime, end: datetime) -> list[dict]:
    if not asset_ids:
        return []
    return fetch(
        conn,
        """
        SELECT asset_id, count(*) AS reading_count, min(timestamp) AS first_timestamp, max(timestamp) AS last_timestamp
        FROM sentinel.readings
        WHERE organization_id = %s AND asset_id = ANY(%s) AND timestamp >= %s AND timestamp < %s
        GROUP BY asset_id
        """,
        (organization_id, asset_ids, start, end),
    )


def evidence_rows(conn, organization_id: str, evidence_type: str, ids: list[str]) -> list[dict]:
    if evidence_type == "asset":
        return fetch(
            conn,
            """
            SELECT source, asset_id AS id, asset_id, asset_name, asset_type, location_id, criticality
            FROM sentinel.assets
            WHERE organization_id = %s AND asset_id = ANY(%s)
            """,
            (organization_id, ids),
        )
    if evidence_type == "action":
        return fetch(
            conn,
            """
            SELECT source, action_id AS id, action_id, mission_id, asset_id, location_id, timestamp,
                   action_type, status, failure_type, battery_pct
            FROM sentinel.actions
            WHERE organization_id = %s AND action_id = ANY(%s)
            """,
            (organization_id, ids),
        )
    if evidence_type == "reading":
        return fetch(
            conn,
            """
            SELECT source, reading_id AS id, reading_id, action_id, asset_id, timestamp,
                   measurement_type, value, unit, quality
            FROM sentinel.readings
            WHERE organization_id = %s AND reading_id = ANY(%s)
            """,
            (organization_id, ids),
        )
    if evidence_type == "anomaly_claim":
        return fetch(
            conn,
            """
            SELECT source, anomaly_id AS id, anomaly_id, action_id, asset_id, timestamp,
                   anomaly_type, severity, description
            FROM sentinel.anomaly_claims
            WHERE organization_id = %s AND anomaly_id = ANY(%s)
            """,
            (organization_id, ids),
        )
    if evidence_type == "queue_item":
        rows = fetch(
            conn,
            """
            SELECT source, action_id, verdict, cause, explanation, mission_id, asset_id, rank, evidence, updated_at
            FROM sentinel.queue_items
            WHERE organization_id = %s AND (source || ':' || action_id) = ANY(%s)
            """,
            (organization_id, ids),
        )
        for row in rows:
            row["id"] = f"{row['source']}:{row['action_id']}"
            row["evidence"] = _object(row.get("evidence"))
        return rows
    if evidence_type == "rule_decision":
        decisions = fetch(
            conn,
            """
            SELECT id, source, action_id, rule_set_version, decided_at, queued, verdict, rank
            FROM sentinel.rule_decisions
            WHERE organization_id = %s AND id = ANY(%s)
            """,
            (organization_id, ids),
        )
        firing_rows = firings(conn, organization_id, [row["id"] for row in decisions])
        grouped: dict[str, list[dict]] = {}
        for firing in firing_rows:
            grouped.setdefault(firing["decision_id"], []).append(firing)
        for row in decisions:
            row["firings"] = grouped.get(row["id"], [])
        return decisions
    raise RuntimeError(SELECT_ONLY)


def _object(value):
    if isinstance(value, str):
        return json.loads(value)
    return value or {}
