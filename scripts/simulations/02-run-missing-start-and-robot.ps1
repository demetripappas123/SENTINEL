# A run that arrived with almost no identity.
# No start time, no end time, no usable mission name, no status, no robot id.
# An object with only uuid is not recognized as a run, so this post includes
# an empty missionName and an empty runEvents list to show it is a run header.
# The mapper does not read a robot id from Orbit at all, so leaving it out
# changes nothing. The blank name falls back to the uuid. Status falls back
# to UNKNOWN. Times stay null.
#
# Expected: HTTP 200. Mission name is the uuid. Duration and battery stay null,
# so the mission page shows Pending for those. Review does not gain a row:
# there is still no action to rank.

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/orbit" -Title "Run with no start, name, status, or robot" -Json @'
{
  "uuid": "sim-bare-run",
  "missionName": "",
  "runEvents": []
}
'@
