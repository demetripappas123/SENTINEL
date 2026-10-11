# A clean SUCCESS action, then a later anomaly for that same action id.
# The anomaly payload does not include the original action. The mapper
# invents a stub action with status UNKNOWN so the claim has somewhere to hang.
# Persist upserts by action id, so that stub replaces the SUCCESS row.
#
# Expected:
#   1. HTTP 200. Visual inspection SUCCESS. Not queued.
#   2. HTTP 200. The same action is now UNKNOWN. A claim "Fire" is stored.
#      The queue shows unsupported_claim, not the original success.
#      This is the sharp edge: a late claim rewrites the action.

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/orbit" -Title "Clean success that a later claim will overwrite" -Json @'
{
  "uuid": "sim-clobber-action",
  "runUuid": "sim-clobber-run",
  "time": "2026-10-10T17:00:00Z",
  "actionName": "VISUAL_INSPECTION",
  "actionStatus": "SUCCESS"
}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "Late anomaly replaces that action with UNKNOWN" -Json @'
{
  "uuid": "sim-clobber-claim",
  "runEventUuid": "sim-clobber-action",
  "runUuid": "sim-clobber-run",
  "title": "Fire",
  "severity": "CRITICAL",
  "status": "open",
  "time": "2026-10-10T17:02:00Z"
}
'@
