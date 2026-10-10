# The action names an asset and a waypoint that have never been stored.
# The Orbit mapper copies those ids onto the action and does not create
# asset or location rows. The actions table foreign keys then reject the insert.
#
# Expected: HTTP 503 with detail "Database is unavailable".
# That text is wrong for this case. The database is up. The write was rejected
# because HX-DOES-NOT-EXIST and WP-DOES-NOT-EXIST are not in the orbit source.
# Nothing from this post is committed.

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/orbit" -Title "Action pointing at an unknown asset and waypoint" -Json @'
{
  "uuid": "sim-fk-run",
  "missionName": "Should not persist",
  "status": "COMPLETED",
  "startTime": "2026-10-10T17:30:00Z",
  "runEvents": [
    {
      "uuid": "sim-fk-action",
      "time": "2026-10-10T17:31:00Z",
      "actionName": "GAUGE_READING",
      "actionStatus": "FAILED",
      "failureType": "TARGET_NOT_DETECTED",
      "assetId": "HX-DOES-NOT-EXIST",
      "waypointId": "WP-DOES-NOT-EXIST"
    }
  ]
}
'@
