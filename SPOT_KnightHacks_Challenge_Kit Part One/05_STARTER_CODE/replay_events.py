"""
Simple example for reading replay.ndjson sequentially.

One JSON object exists per line.
"""

from pathlib import Path
import json
import time

ROOT = Path(__file__).resolve().parents[1]
REPLAY_FILE = ROOT / "02_DATA" / "replay.ndjson"

REPLAY_DELAY_SECONDS = 0.10

with open(REPLAY_FILE, encoding="utf-8") as f:

    for line in f:

        event = json.loads(line)

        print(
            event["timestamp"],
            event["mission_id"],
            event["event_type"],
            event.get("details", {})
        )

        time.sleep(REPLAY_DELAY_SECONDS)
