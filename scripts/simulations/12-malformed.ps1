# Payloads the mapper refuses or cannot parse.
# ValueError is not turned into a clean 4xx. FastAPI returns HTTP 500.
# None of these posts commit a row.
#
# 1. Event with no run uuid. An inspection action must name its run.
# 2. Empty object. Not a run, event, anomaly, or site walk.
# 3. Run whose only event has no uuid. The whole batch is rejected.
# 4. Timestamp that is not a time. fromisoformat throws.
# 5. Capture value that is not a number. float() throws before the row is skipped.
#    A non-numeric value is supposed to be ignored, but the parser raises instead.

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/orbit" -Title "Event with no run uuid" -Json @'
{
  "uuid": "sim-orphan-action",
  "actionName": "GAUGE_READING",
  "actionStatus": "FAILED"
}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "Empty object" -Json @'
{}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "Run with an event that has no id" -Json @'
{
  "uuid": "sim-bad-event-run",
  "missionName": "Broken event",
  "status": "COMPLETED",
  "runEvents": [ {} ]
}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "Timestamp that is not a timestamp" -Json @'
{
  "uuid": "sim-bad-time",
  "missionName": "Bad clock",
  "status": "COMPLETED",
  "startTime": "yesterday"
}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "Capture value that is not numeric" -Json @'
{
  "uuid": "sim-bad-number-action",
  "runUuid": "sim-bad-number-run",
  "actionName": "GAUGE_READING",
  "actionStatus": "SUCCESS",
  "dataCaptures": [
    {
      "uuid": "sim-bad-number-capture",
      "keyResults": [ { "name": "pressure", "value": "hot", "units": "psi" } ]
    }
  ]
}
'@
