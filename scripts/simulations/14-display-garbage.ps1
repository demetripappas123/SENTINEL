# Posts that succeed and then look wrong on screen.
#
# 1. End time before start time. Both are stored. Duration stays null, so the
#    page shows Pending instead of a negative duration. The clock still reads
#    backwards if you look at the two timestamps.
# 2. Mission name with a newline, quotes, and a long tail. The heading wraps
#    or overflows.
# 3. The same action id is posted again under a different run. Upsert moves
#    the action to the second mission. The first mission keeps its row and
#    loses the action. The queue mission id follows the action.
# 4. runEvents is a string, not a list. The mapper drops it and stores only
#    the mission. No error. The failed action inside the string is gone.
# 5. A key result with no value is skipped. The action remains, with no reading.
#    A second key result on that capture is a real number and is stored.

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/orbit" -Title "End time before start time" -Json @'
{
  "uuid": "sim-backwards-run",
  "missionName": "Clock runs backwards",
  "status": "COMPLETED",
  "startTime": "2026-10-10T19:00:00Z",
  "endTime": "2026-10-09T19:00:00Z",
  "runEvents": [
    {
      "uuid": "sim-backwards-action",
      "time": "2026-10-10T19:01:00Z",
      "actionName": "NAVIGATION",
      "actionStatus": "SUCCESS"
    }
  ]
}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "Mission name with a newline and a long tail" -Json @'
{
  "uuid": "sim-ugly-name",
  "missionName": "Line one\n\"quoted\" <b>not html</b> and then a very long name that keeps going so the heading and the table cell have to deal with a string that was never meant to be a label in the operator console and still has not stopped",
  "status": "UNKNOWN",
  "startTime": "2026-10-10T19:10:00Z"
}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "Action that will be moved" -Json @'
{
  "uuid": "sim-mover-action",
  "runUuid": "sim-mover-run-a",
  "time": "2026-10-10T19:20:00Z",
  "actionName": "GAUGE_READING",
  "actionStatus": "FAILED",
  "failureType": "SENSOR_TIMEOUT"
}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "Same action id reposted onto a different run" -Json @'
{
  "uuid": "sim-mover-action",
  "runUuid": "sim-mover-run-b",
  "time": "2026-10-10T19:40:00Z",
  "actionName": "GAUGE_READING",
  "actionStatus": "FAILED",
  "failureType": "SENSOR_TIMEOUT"
}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "runEvents sent as a string is dropped" -Json @'
{
  "uuid": "sim-string-events",
  "missionName": "Events were a string",
  "status": "COMPLETED",
  "startTime": "2026-10-10T19:50:00Z",
  "runEvents": "this is not a list and the failed action inside it is lost"
}
'@

Send-Sentinel -Route "/ingest/orbit" -Title "Missing capture value is skipped, numeric sibling is kept" -Json @'
{
  "uuid": "sim-partial-capture-action",
  "runUuid": "sim-partial-capture-run",
  "time": "2026-10-10T20:00:00Z",
  "actionName": "THERMAL_INSPECTION",
  "actionStatus": "SUCCESS",
  "dataCaptures": [
    {
      "uuid": "sim-partial-capture",
      "keyResults": [
        { "name": "temperature", "units": "C" },
        { "name": "temperature_peak", "value": 80, "units": "C" }
      ]
    }
  ]
}
'@
