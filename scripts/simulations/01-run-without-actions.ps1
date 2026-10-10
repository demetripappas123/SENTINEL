# Orbit can send a Run before any RunEvent exists.
# This post is only a mission header: id, name, COMPLETED, start and end.
# There is no runEvents array.
#
# Expected: HTTP 200. One mission, zero actions, zero readings, nothing queued.
# The missions list shows "Empty corridor walk" with 0/0 passed.
# Review stays unchanged. A completed mission with no actions is not a failure.

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/orbit" -Title "Run with no actions" -Json @'
{
  "uuid": "sim-empty-run",
  "missionName": "Empty corridor walk",
  "status": "COMPLETED",
  "startTime": "2026-10-10T12:00:00Z",
  "endTime": "2026-10-10T12:10:00Z"
}
'@
