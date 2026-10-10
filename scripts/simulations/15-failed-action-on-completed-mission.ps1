# One run, three actions: a success, a failed action that also includes a
# capture, and a failed action with a reason. The mission status is COMPLETED.
# The capture on the failed action is stored and does not cancel the failure.
# Its quality is UNSPECIFIED, not GOOD, so it cannot be read as proof the
# equipment is fine or broken.
#
# Expected: HTTP 200. Two inspection_failure rows. The success is absent from
# the queue. Mission detail shows 1/3 successful while the mission tag says
# Completed. The thermal failure has a reading and still sits in Review.

. "$PSScriptRoot/_lib.ps1"

Send-Sentinel -Route "/ingest/orbit" -Title "Completed mission containing failed actions and a reading" -Json @'
{
  "uuid": "sim-mixed-run",
  "missionName": "Completed run with failed actions",
  "status": "COMPLETED",
  "startTime": "2026-10-10T21:00:00Z",
  "endTime": "2026-10-10T21:20:00Z",
  "runEvents": [
    {
      "uuid": "sim-mixed-ok",
      "time": "2026-10-10T21:02:00Z",
      "actionName": "VISUAL_INSPECTION",
      "actionStatus": "SUCCESS"
    },
    {
      "uuid": "sim-mixed-fail-reading",
      "time": "2026-10-10T21:08:00Z",
      "actionName": "THERMAL_INSPECTION",
      "actionStatus": "FAILED",
      "failureType": "READING_UNRELIABLE",
      "dataCaptures": [
        {
          "uuid": "sim-mixed-capture",
          "time": "2026-10-10T21:08:10Z",
          "keyResults": [
            { "name": "temperature", "value": 12, "units": "C" }
          ]
        }
      ]
    },
    {
      "uuid": "sim-mixed-fail-blind",
      "time": "2026-10-10T21:14:00Z",
      "actionName": "GAUGE_READING",
      "actionStatus": "FAILED",
      "failureType": "SENSOR_TIMEOUT"
    }
  ]
}
'@
