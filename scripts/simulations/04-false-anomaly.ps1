# A successful visual inspection bundled with a CRITICAL anomaly.
# The action did not fail and the capture is not a trusted GOOD reading.
# The claim is unsupported: severity does not promote it to an equipment finding.
#
# Posted as one bundle so the success action is in the same batch as the claim.
# A later anomaly-only post is a different case; see 09.
#
# Expected: HTTP 200. Queue row verdict unsupported_claim, cause "Critical leak",
# rank 20. That is below a real inspection failure (rank 100). The mission page
# still shows the action as Success, with the claim beside it.

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/orbit" -Title "Successful action plus a critical claim" -Json @'
{
  "runs": [
    {
      "uuid": "sim-false-alarm-run",
      "missionName": "False alarm walk",
      "status": "COMPLETED",
      "startTime": "2026-10-10T14:00:00Z",
      "endTime": "2026-10-10T14:12:00Z",
      "runEvents": [
        {
          "uuid": "sim-false-alarm-action",
          "time": "2026-10-10T14:04:00Z",
          "actionName": "VISUAL_INSPECTION",
          "actionStatus": "SUCCESS"
        }
      ]
    }
  ],
  "anomalies": [
    {
      "uuid": "sim-false-alarm-claim",
      "runEventUuid": "sim-false-alarm-action",
      "runUuid": "sim-false-alarm-run",
      "title": "Critical leak",
      "severity": "CRITICAL",
      "status": "open",
      "time": "2026-10-10T14:04:00Z"
    }
  ]
}
'@
