# Readings are not their own webhook. They arrive nested on a run event.
# Post 1 is the action with no captures. Post 2 is the same action id with a
# capture. Post 3 upserts that same capture to a wild value and adds nothing
# the rules can treat as a confirmed equipment problem.
#
# Expected:
#   1. HTTP 200. Action SUCCESS, no reading, no queue row.
#   2. HTTP 200. Reading temperature 41.2 C appears. Quality is forced to
#      UNSPECIFIED, so this is not a GOOD reading and cannot become an
#      equipment finding.
#   3. HTTP 200. The same reading id is overwritten to 9999 C. Still
#      UNSPECIFIED, still not queued. The screen shows an absurd value with
#      no verdict.

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/orbit" -Title "Action before its reading" -Json @'
{
  "uuid": "sim-gauge-action",
  "runUuid": "sim-gauge-run",
  "time": "2026-10-10T13:00:00Z",
  "actionName": "GAUGE_READING",
  "actionStatus": "SUCCESS"
}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "Reading arrives later on the same action" -Json @'
{
  "uuid": "sim-gauge-action",
  "runUuid": "sim-gauge-run",
  "time": "2026-10-10T13:00:00Z",
  "actionName": "GAUGE_READING",
  "actionStatus": "SUCCESS",
  "dataCaptures": [
    {
      "uuid": "sim-gauge-capture",
      "time": "2026-10-10T13:00:30Z",
      "keyResults": [
        { "name": "pressure", "value": 41.2, "units": "psi" }
      ]
    }
  ]
}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "Same reading overwritten with a nonsense value" -Json @'
{
  "uuid": "sim-gauge-action",
  "runUuid": "sim-gauge-run",
  "time": "2026-10-10T13:00:00Z",
  "actionName": "GAUGE_READING",
  "actionStatus": "SUCCESS",
  "dataCaptures": [
    {
      "uuid": "sim-gauge-capture",
      "time": "2026-10-10T13:05:00Z",
      "keyResults": [
        { "name": "pressure", "value": 9999, "units": "psi" }
      ]
    }
  ]
}
'@
