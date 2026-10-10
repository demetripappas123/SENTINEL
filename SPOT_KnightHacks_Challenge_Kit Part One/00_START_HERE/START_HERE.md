# Knight Hacks 2026 - SPOT Data Challenge

Welcome to the SPOT Knight Hacks Challenge Kit.

Your objective is to transform synthetic robotic inspection data into
something that helps an operator understand what is happening, identify
important problems quickly, and make better operational decisions.

## The challenge

SPOT can execute missions containing multiple actions such as:

- Navigation
- Visual inspection
- Thermal inspection
- Acoustic inspection
- Gauge readings

A high-level mission status does not always tell the whole story.

Your solution should help users explore mission performance, action-level
outcomes, inspection readings, anomalies, locations, and operating context.

## Suggested questions

You are not limited to these questions:

- Can a mission be completed even when actions inside it fail?
- Which inspection types appear least reliable?
- Are failures concentrated at particular locations?
- Does battery state appear related to reliability?
- Are anomalies hidden inside otherwise successful missions?
- Does performance differ between configuration versions?
- Can an operator identify the most important issue quickly?
- What additional insights can you derive from the replay event stream?

## Data

Start in:

    02_DATA/

Core datasets:

- missions.csv
- actions.csv
- readings.csv
- anomalies.csv
- locations.csv
- assets.csv
- replay.ndjson

Field definitions are available in:

    03_DATA_DICTIONARY/data_dictionary.csv

## Starter code

Optional Python examples are in:

    05_STARTER_CODE/

They are provided only as examples. You may use any supported technology.

## Important

All operational data, assets, facility names, locations, events, and
measurements in this challenge kit are synthetic and fictional.

Do not assume that a field is important simply because it is included.
Investigate the data and support your conclusions with evidence.

Good luck.
