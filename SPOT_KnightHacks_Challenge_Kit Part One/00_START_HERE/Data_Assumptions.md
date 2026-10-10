# Data Assumptions

## Synthetic-data notice

All operational data supplied in this challenge is synthetic and fictional.

The dataset does not represent an actual NextEra Energy facility,
production SPOT robot, employee, inspection route, equipment population,
or operating event.

## Dataset design

The dataset simulates a robotic inspection workflow consisting of:

MISSION
  -> ACTION
      -> READING
      -> ANOMALY

Actions also reference:

- LOCATION
- ASSET

A separate replay.ndjson file represents a simplified chronological
event stream.

## Mission behavior

A mission may be marked COMPLETED even if one or more actions inside the
mission failed.

Mission status and action status should therefore be evaluated separately.

## Configuration scenarios

The field `scenario` contains:

- BASELINE
- IMPROVED

The field `configuration_version` contains:

- V1
- V2

These represent fictional configurations for comparison.

The challenge does not specify what changed between versions.

Teams should determine whether observed performance changed and support
their conclusions using the supplied data.

## Battery

`battery_pct` is a synthetic estimate of battery state at the time an
action occurred.

It may be useful when examining mission progression and action reliability.

## Locations

WP01 through WP15 are fictional waypoints / operating areas.

Coordinates are intended only for challenge visualization and do not
represent any real facility.

## Measurements

Depending on action type, readings may include:

- Temperature in degrees C
- Acoustic level in dB
- Pressure in psi
- Visual inspection score
- Localization confidence percentage

These values are synthetic.

## Anomalies

Anomalies represent events or findings that may require operator attention.

An anomaly does not necessarily mean the overall mission failed.

## Replay stream

replay.ndjson contains one JSON object per line.

It represents mission and action events in chronological form and can be
used for:

- live-style dashboards
- event playback
- alerting demonstrations
- timeline visualizations
- state reconstruction

## Expected use

Teams are encouraged to:

- join datasets
- calculate additional metrics
- create dashboards
- build alerts
- develop APIs
- build operator interfaces
- develop AI-assisted summaries
- create replay or monitoring experiences

Teams should clearly explain assumptions introduced by their solution.
