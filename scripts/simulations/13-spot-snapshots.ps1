# Spot snapshots are robot state, not an inspection route.
# No waypoint and no asset id here: those foreign keys would 503, same as 11.
#
# 1. No mission id and no nickname. Stored as mission spot-state-spot,
#    action status UNKNOWN. Not queued. Battery is missing, so the page
#    shows Pending. There is no robot id to display anywhere else.
# 2. Faults on a completed mission with a low battery. The action is forced
#    to FAILED even though mission_status is COMPLETED. Both faults become
#    claims. The failure reason is only the first fault name. Battery 9
#    adds the low-battery rank bumps on top of inspection_failure.
# 3. A waypoint id that was never stored. Expected HTTP 503, same misleading
#    "Database is unavailable" detail as an unknown Orbit asset.

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/spot" -Title "Spot snapshot with no mission and no robot id" -Json @'
{
  "timestamp": "2026-10-10T18:00:00Z"
}
'@

Send-Sentinel -Route "/ingest/spot" -Title "Spot faults on a completed mission at 9 percent battery" -Json @'
{
  "nickname": "sim-spot",
  "mission_id": "sim-spot-mission",
  "mission_name": "Spot with faults",
  "mission_status": "COMPLETED",
  "timestamp": "2026-10-10T18:05:00Z",
  "battery_pct": 9,
  "faults": [
    { "name": "COMMUNICATION_LOSS", "severity": "HIGH" },
    { "name": "SENSOR_TIMEOUT", "severity": "LOW" }
  ]
}
'@

Send-Sentinel -Route "/ingest/spot" -Title "Spot waypoint that does not exist" -Json @'
{
  "nickname": "sim-spot-lost",
  "mission_id": "sim-spot-lost-mission",
  "timestamp": "2026-10-10T18:06:00Z",
  "waypoint_id": "WP-NOT-IN-ORBIT"
}
'@
