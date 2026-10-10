# The mapper decides what a payload is by which keys are present, in this order:
# anomaly (runEventUuid), run event (runUuid), site walk (siteElements/elements),
# run (runEvents or missionName). A real Orbit object that carries an extra key
# can be classified as the wrong thing.
#
# 1. A full run that also has runUuid. That key is checked first, so the body
#    is stored as one run event. The nested failed gauge action is ignored.
#    The mission id becomes sim-misread-parent, not sim-misread-run. The run's
#    status COMPLETED is stored as the action status. Nothing is queued.
# 2. A run that also has siteElements. Classified as a site walk. The runEvents
#    are ignored and the nested elements become DEFINED actions.
# 3. An anomaly that is missing runUuid. Rejected with HTTP 500. The title
#    never becomes a claim.

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/orbit" -Title "Run that also has runUuid is stored as one event" -Json @'
{
  "uuid": "sim-misread-run",
  "runUuid": "sim-misread-parent",
  "missionName": "This run will be misread",
  "status": "COMPLETED",
  "startTime": "2026-10-10T22:00:00Z",
  "runEvents": [
    {
      "uuid": "sim-misread-child",
      "actionName": "GAUGE_READING",
      "actionStatus": "FAILED",
      "failureType": "TARGET_NOT_DETECTED"
    }
  ]
}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "Run that also has siteElements is stored as a definition" -Json @'
{
  "uuid": "sim-misread-walk",
  "missionName": "Run hidden under a site walk",
  "status": "COMPLETED",
  "siteElements": [
    { "uuid": "sim-misread-element", "name": "VISUAL_INSPECTION" }
  ],
  "runEvents": [
    {
      "uuid": "sim-misread-lost-action",
      "actionName": "GAUGE_READING",
      "actionStatus": "FAILED",
      "failureType": "PATH_BLOCKED"
    }
  ]
}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "Anomaly with no run uuid" -Json @'
{
  "uuid": "sim-claim-without-run",
  "runEventUuid": "sim-claim-without-run-action",
  "title": "This claim has no mission",
  "severity": "HIGH",
  "status": "open"
}
'@
