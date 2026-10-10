# Two posts that look like failures and are not ranked as failures.
#
# Post 1: actionStatus is "failed" in lowercase. The rule compares to "FAILED"
# exactly, so this is stored and then ignored by the queue.
# Post 2: actionStatus is SUCCESS but failureType is set. A reason on a
# successful action does not create a verdict. Nothing is queued.
#
# Expected: both HTTP 200. Missions appear. Review does not list either action.
# The mission detail still shows the lowercase status and the stray reason.

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/orbit" -Title "Lowercase failed is not a queue failure" -Json @'
{
  "uuid": "sim-lowercase-run",
  "missionName": "Lowercase failure",
  "status": "COMPLETED",
  "startTime": "2026-10-10T16:00:00Z",
  "runEvents": [
    {
      "uuid": "sim-lowercase-action",
      "time": "2026-10-10T16:02:00Z",
      "actionName": "ACOUSTIC_INSPECTION",
      "actionStatus": "failed",
      "failureType": "SIGNAL_NOISE"
    }
  ]
}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "Success that also carries a failure reason" -Json @'
{
  "uuid": "sim-success-reason-run",
  "missionName": "Success with a leftover reason",
  "status": "COMPLETED",
  "startTime": "2026-10-10T16:10:00Z",
  "runEvents": [
    {
      "uuid": "sim-success-reason-action",
      "time": "2026-10-10T16:12:00Z",
      "actionName": "GAUGE_READING",
      "actionStatus": "SUCCESS",
      "failureType": "READING_UNRELIABLE"
    }
  ]
}
'@
