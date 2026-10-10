# A failed gauge reading that names why: the target was not in frame.
# There is no reading, so we do not know the gauge value. The mission is
# COMPLETED anyway. That matches the kit assumption that mission status and
# action status are separate.
#
# Expected: HTTP 200. Queue verdict inspection_failure, cause TARGET_NOT_DETECTED,
# rank 100. Explanation says the action failed and the mission is still completed.
# Asset and waypoint stay Pending.

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/orbit" -Title "Failed action with a failure reason" -Json @'
{
  "uuid": "sim-reason-run",
  "missionName": "Gauge that was not seen",
  "status": "COMPLETED",
  "startTime": "2026-10-10T15:00:00Z",
  "endTime": "2026-10-10T15:08:00Z",
  "runEvents": [
    {
      "uuid": "sim-reason-action",
      "time": "2026-10-10T15:03:00Z",
      "actionName": "GAUGE_READING",
      "actionStatus": "FAILED",
      "failureType": "TARGET_NOT_DETECTED"
    }
  ]
}
'@
