# The action webhook arrives first. It has a run uuid but the Run object
# has not been sent, so the mapper creates a thin mission named after that uuid
# with status UNKNOWN. The second post is the run header for the same id,
# still with no nested events.
#
# Expected:
#   1. HTTP 200. Mission sim-early-run, status UNKNOWN, one failed action queued.
#   2. HTTP 200. The same mission is upserted to COMPLETED with a real name
#      and an end time. The action remains. The queue row is not rewritten by
#      this second post, because the batch has no actions, so the explanation
#      can still describe the mission as UNKNOWN until something re-ranks it.

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/orbit" -Title "Run event before the run exists" -Json @'
{
  "uuid": "sim-early-action",
  "runUuid": "sim-early-run",
  "time": "2026-10-10T16:30:00Z",
  "actionName": "NAVIGATION",
  "actionStatus": "FAILED",
  "failureType": "PATH_BLOCKED"
}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "Run header arrives later and does not repeat the action" -Json @'
{
  "uuid": "sim-early-run",
  "missionName": "Late run header",
  "status": "COMPLETED",
  "startTime": "2026-10-10T16:30:00Z",
  "endTime": "2026-10-10T16:48:00Z"
}
'@
