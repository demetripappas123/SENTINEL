# A site walk is a mission definition, not a robot result.
# Its elements are stored with status DEFINED. The rules skip DEFINED
# and do not queue them, even if the element name sounds like a failure.
#
# Expected: HTTP 200. Mission status DEFINED. Two actions, both DEFINED.
# Review does not list them. The mission page shows the status word "Defined".

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/orbit" -Title "Site walk elements are not results" -Json @'
{
  "uuid": "sim-walk",
  "name": "Planned walk, not a run",
  "siteElements": [
    { "uuid": "sim-walk-step-1", "name": "GAUGE_READING" },
    { "uuid": "sim-walk-step-2", "name": "FAILED_LOOKING_STEP" }
  ]
}
'@
