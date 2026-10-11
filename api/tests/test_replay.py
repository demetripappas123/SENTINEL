"""Replay is rebuilt from the kit CSVs, not from a stored event file."""

import json
from pathlib import Path

from datetime import datetime

from app.mappers.kit import map_kit
from app.dtos.canonical import Action, CanonicalBatch, Mission, Source
from app.services.dataset import replay_events, to_dataset

DATA = Path(__file__).resolve().parents[2] / "SPOT_KnightHacks_Challenge_Kit Part One" / "02_DATA"


def _same(left, right) -> bool:
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return float(left) == float(right)
    return left == right


def test_kit_csvs_rebuild_the_recorded_replay():
    dataset = to_dataset(map_kit(DATA))
    recorded = [
        json.loads(line)
        for line in (DATA / "replay.ndjson").read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert len(dataset.events) > len(recorded)
    for derived, event in zip(dataset.events, recorded, strict=False):
        assert derived.mission_id == event["mission_id"]
        assert derived.timestamp == event["timestamp"]
        assert derived.event_type == event["event_type"]
        assert derived.details.keys() == event["details"].keys()
        for key, value in event["details"].items():
            assert _same(derived.details[key], value)


def test_a_mission_without_an_end_time_stays_open():
    batch = CanonicalBatch(
        missions=[
            Mission(
                source=Source.orbit,
                mission_id="open-run",
                mission_name="Open run",
                start_time=datetime.fromisoformat("2026-10-10T12:00:00"),
                mission_status="COMPLETED",
            )
        ],
        actions=[
            Action(
                source=Source.orbit,
                action_id="step-1",
                mission_id="open-run",
                timestamp=datetime.fromisoformat("2026-10-10T12:05:00"),
                action_type="NAVIGATION",
                status="SUCCESS",
            )
        ],
    )
    assert [event.event_type for event in replay_events(batch)] == [
        "MISSION_STARTED",
        "ACTION_STARTED",
        "ACTION_COMPLETED",
    ]
