"""Operational metrics for one organization: versions, inspections, locations, battery, and missions."""
from app.db import connect
from app.dtos.metrics import (
    BatteryMetric,
    InspectionMetric,
    LocationMetric,
    MissionMetric,
    OperationalMetrics,
    VersionMetric,
)

BATTERY_BINS = ((0, 20), (20, 40), (40, 60), (60, 80), (80, 100))


def get_metrics(organization_id: str) -> OperationalMetrics:
    with connect() as conn:
        versions = _versions(conn, organization_id)
        inspections = _inspections(conn, organization_id)
        locations = _locations(conn, organization_id)
        battery = _battery(conn, organization_id)
        missions = _missions(conn, organization_id)
    return OperationalMetrics(
        versions=versions,
        inspections=inspections,
        locations=locations,
        battery=battery,
        missions=missions,
    )


def _versions(conn, organization_id: str) -> list[VersionMetric]:
    mission_rows = conn.execute(
        """
        SELECT source, configuration_version, scenario,
               count(*) AS mission_count,
               count(*) FILTER (WHERE mission_status = 'COMPLETED') AS completed_missions,
               avg(duration_min) AS avg_duration_min,
               avg(start_battery_pct) AS avg_start_battery_pct,
               avg(end_battery_pct) AS avg_end_battery_pct
        FROM sentinel.missions
        WHERE organization_id = %s
        GROUP BY source, configuration_version, scenario
        """,
        (organization_id,),
    ).fetchall()
    action_rows = conn.execute(
        """
        SELECT source, configuration_version, scenario,
               count(*) AS action_count,
               count(*) FILTER (WHERE status = 'SUCCESS') AS successful_actions
        FROM sentinel.actions
        WHERE organization_id = %s
        GROUP BY source, configuration_version, scenario
        """,
        (organization_id,),
    ).fetchall()
    actions = {
        (row["source"], row["configuration_version"], row["scenario"]): row
        for row in action_rows
    }
    keys = {(row["source"], row["configuration_version"], row["scenario"]) for row in mission_rows}
    keys.update(actions)
    metrics: list[VersionMetric] = []
    for source, version, scenario in sorted(keys, key=lambda key: (key[0], key[1] or "", key[2] or "")):
        mission = next(
            (
                row
                for row in mission_rows
                if (row["source"], row["configuration_version"], row["scenario"]) == (source, version, scenario)
            ),
            None,
        )
        action = actions.get((source, version, scenario))
        mission_count = 0 if mission is None else mission["mission_count"]
        completed = 0 if mission is None else mission["completed_missions"]
        action_count = 0 if action is None else action["action_count"]
        successful = 0 if action is None else action["successful_actions"]
        metrics.append(
            VersionMetric(
                source=source,
                configuration_version=version,
                scenario=scenario,
                mission_count=mission_count,
                completed_missions=completed,
                mission_completion_pct=_pct(completed, mission_count),
                action_count=action_count,
                successful_actions=successful,
                action_success_pct=_pct(successful, action_count),
                avg_duration_min=None if mission is None else _round(mission["avg_duration_min"]),
                avg_start_battery_pct=None if mission is None else _round(mission["avg_start_battery_pct"]),
                avg_end_battery_pct=None if mission is None else _round(mission["avg_end_battery_pct"]),
            )
        )
    return metrics


def _inspections(conn, organization_id: str) -> list[InspectionMetric]:
    rows = conn.execute(
        """
        SELECT source, action_type, configuration_version,
               count(*) AS action_count,
               count(*) FILTER (WHERE status = 'SUCCESS') AS successful_actions
        FROM sentinel.actions
        WHERE organization_id = %s
        GROUP BY source, action_type, configuration_version
        ORDER BY action_type, configuration_version, source
        """,
        (organization_id,),
    ).fetchall()
    return [
        InspectionMetric(
            source=row["source"],
            action_type=row["action_type"],
            configuration_version=row["configuration_version"],
            action_count=row["action_count"],
            successful_actions=row["successful_actions"],
            success_pct=_pct(row["successful_actions"], row["action_count"]),
        )
        for row in rows
    ]


def _locations(conn, organization_id: str) -> list[LocationMetric]:
    rows = conn.execute(
        """
        SELECT l.source, l.location_id, l.location_name,
               count(a.action_id) AS action_count,
               count(a.action_id) FILTER (WHERE a.status = 'SUCCESS') AS successful_actions,
               count(a.action_id) FILTER (WHERE a.action_type = 'NAVIGATION') AS navigation_count,
               count(a.action_id) FILTER (
                   WHERE a.action_type = 'NAVIGATION' AND a.status = 'FAILED'
               ) AS navigation_failures
        FROM sentinel.locations l
        LEFT JOIN sentinel.actions a
          ON a.organization_id = l.organization_id
         AND a.source = l.source
         AND a.location_id = l.location_id
        WHERE l.organization_id = %s
        GROUP BY l.source, l.location_id, l.location_name
        ORDER BY l.location_id
        """,
        (organization_id,),
    ).fetchall()
    return [
        LocationMetric(
            source=row["source"],
            location_id=row["location_id"],
            location_name=row["location_name"],
            action_count=row["action_count"],
            successful_actions=row["successful_actions"],
            success_pct=_pct(row["successful_actions"], row["action_count"]),
            navigation_count=row["navigation_count"],
            navigation_failures=row["navigation_failures"],
            navigation_failure_pct=_pct(row["navigation_failures"], row["navigation_count"]),
        )
        for row in rows
    ]


def _battery(conn, organization_id: str) -> list[BatteryMetric]:
    rows = conn.execute(
        """
        SELECT
            CASE
                WHEN battery_pct < 20 THEN 0
                WHEN battery_pct < 40 THEN 20
                WHEN battery_pct < 60 THEN 40
                WHEN battery_pct < 80 THEN 60
                ELSE 80
            END AS low_pct,
            count(*) AS action_count,
            count(*) FILTER (WHERE status = 'SUCCESS') AS successful_actions
        FROM sentinel.actions
        WHERE organization_id = %s
          AND battery_pct IS NOT NULL
        GROUP BY 1
        """,
        (organization_id,),
    ).fetchall()
    found = {row["low_pct"]: row for row in rows}
    return [
        BatteryMetric(
            low_pct=low,
            high_pct=high,
            action_count=0 if found.get(low) is None else found[low]["action_count"],
            successful_actions=0 if found.get(low) is None else found[low]["successful_actions"],
            success_pct=None
            if found.get(low) is None
            else _pct(found[low]["successful_actions"], found[low]["action_count"]),
        )
        for low, high in BATTERY_BINS
    ]


def _missions(conn, organization_id: str) -> MissionMetric:
    summary = conn.execute(
        """
        SELECT
            count(*) AS mission_count,
            count(*) FILTER (WHERE mission_status = 'COMPLETED') AS completed_count
        FROM sentinel.missions
        WHERE organization_id = %s
        """,
        (organization_id,),
    ).fetchone()
    failed = conn.execute(
        """
        SELECT mission_id
        FROM sentinel.missions
        WHERE organization_id = %s AND mission_status = 'FAILED'
        ORDER BY mission_id
        """,
        (organization_id,),
    ).fetchall()
    with_failures = conn.execute(
        """
        SELECT count(DISTINCT m.mission_id) AS n
        FROM sentinel.missions m
        JOIN sentinel.actions a
          ON a.organization_id = m.organization_id
         AND a.source = m.source
         AND a.mission_id = m.mission_id
        WHERE m.organization_id = %s
          AND m.mission_status = 'COMPLETED'
          AND a.status = 'FAILED'
        """,
        (organization_id,),
    ).fetchone()
    return MissionMetric(
        mission_count=summary["mission_count"],
        completed_count=summary["completed_count"],
        completed_with_failures=with_failures["n"],
        failed_mission_ids=[row["mission_id"] for row in failed],
    )


def _pct(part: int, whole: int) -> float | None:
    if not whole:
        return None
    return round(100 * part / whole, 1)


def _round(value) -> float | None:
    if value is None:
        return None
    return round(float(value), 1)
