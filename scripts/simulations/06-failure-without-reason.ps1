# Same shape as a real failure, but Orbit sent no failureType.
# The rules still queue it. The cause becomes the status word FAILED,
# because there is nothing more specific to say.
#
# Expected: HTTP 200. inspection_failure, cause FAILED, rank 100.
# The review row title is "Failed", which is easy to miss next to a named reason.

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/orbit" -Title "Failed action with no failure reason" -Json @'
{
  "uuid": "sim-noreason-run",
  "missionName": "Failure with no reason",
  "status": "COMPLETED",
  "startTime": "2026-10-10T15:20:00Z",
  "endTime": "2026-10-10T15:28:00Z",
  "runEvents": [
    {
      "uuid": "sim-noreason-action",
      "time": "2026-10-10T15:22:00Z",
      "actionName": "THERMAL_INSPECTION",
      "actionStatus": "FAILED"
    }
  ]
}
'@
