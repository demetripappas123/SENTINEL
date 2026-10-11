import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.mappers.kit import map_kit
from app.dtos.canonical import Action, CanonicalBatch, Mission, Source
from app.services.dataset import format_timestamp, to_dataset

ROOT = Path(__file__).resolve().parents[2]
KIT_DATA = ROOT / "SPOT_KnightHacks_Challenge_Kit Part One" / "02_DATA"
FIXTURE = ROOT / "packages" / "core" / "src" / "data" / "challenge.json"


def _project(fixture: list[dict], records: list[dict]) -> list[dict]:
    """The fixture records limited to the fields the API declares, in ID order."""
    keys = list(records[0].keys())
    projected = [{key: record[key] for key in keys} for record in fixture]
    return sorted(projected, key=lambda record: record[keys[0]])


@pytest.mark.parametrize("key", ["missions", "actions", "assets", "locations", "readings", "findings"])
def test_kit_dataset_matches_the_bundled_frontend_fixture(key):
    fixture = json.loads(FIXTURE.read_text())
    dataset = to_dataset(map_kit(KIT_DATA)).model_dump(mode="json")
    assert len(dataset[key]) == len(fixture[key])
    assert dataset[key] == _project(fixture[key], dataset[key])


def test_kit_replay_includes_all_recorded_mission_and_action_outcomes():
    # The API now derives the full timeline; the bundled fixture is a partial stream.
    events = to_dataset(map_kit(KIT_DATA)).model_dump(mode="json")["events"]
    assert len(events) == 594
    assert [event["timestamp"] for event in events] == sorted(event["timestamp"] for event in events)
    assert len([event for event in events if event["event_type"] == "ACTION_STARTED"]) == 270
    assert len([event for event in events if event["event_type"] in {"ACTION_COMPLETED", "ACTION_FAILED"}]) == 270
    assert events[-1]["mission_id"] == "M027"
    assert events[-1]["event_type"] == "MISSION_COMPLETED"


def test_every_kit_replay_event_belongs_to_a_kit_mission():
    batch = map_kit(KIT_DATA)
    missions = {mission.mission_id for mission in batch.missions}
    assert {event.mission_id for event in batch.events} <= missions


def test_kit_folder_without_replay_maps_no_events(tmp_path):
    for name in ["locations", "assets", "missions", "actions", "readings", "anomalies"]:
        (tmp_path / f"{name}.csv").write_text((KIT_DATA / f"{name}.csv").read_text())
    assert map_kit(tmp_path).events == []


def test_timestamps_are_utc_without_offset():
    naive = datetime(2026, 9, 1, 18, 0, 0)
    eastern = datetime(2026, 9, 1, 14, 0, 0, tzinfo=timezone(timedelta(hours=-4)))
    assert format_timestamp(naive) == "2026-09-01T18:00:00"
    assert format_timestamp(eastern) == "2026-09-01T18:00:00"


def _action(action_id: str, failure_type: str | None = None) -> Action:
    return Action(
        source=Source.kit,
        action_id=action_id,
        mission_id="M001",
        sequence=1,
        timestamp=datetime(2026, 9, 1, 18, 0, 0, tzinfo=timezone.utc),
        location_id="WP01",
        asset_id="HX-201",
        action_type="NAVIGATION",
        battery_pct=75,
        status="SUCCESS",
        failure_type=failure_type,
        duration_sec=10,
        scenario="BASELINE",
    )


def test_partial_orbit_mission_keeps_missing_fields_null():
    dataset = to_dataset(
        CanonicalBatch(
            missions=[
                Mission(
                    source=Source.orbit,
                    mission_id="orbit-run-demo-001",
                    mission_name="Pipe gallery walk",
                    start_time=datetime(2026, 10, 10, 17, 0, tzinfo=timezone.utc),
                    mission_status="COMPLETED",
                )
            ]
        )
    )
    mission = dataset.missions[0]
    assert mission.start_time == "2026-10-10T17:00:00"
    assert mission.end_time is None
    assert mission.duration_min is None
    assert mission.start_battery_pct is None
    assert mission.scenario is None
    assert mission.configuration_version is None


def test_missing_failure_type_becomes_empty_string():
    dataset = to_dataset(CanonicalBatch(actions=[_action("A0001")]))
    assert dataset.actions[0].failure_type == ""


def test_records_are_sorted_by_id_regardless_of_row_order():
    dataset = to_dataset(CanonicalBatch(actions=[_action("A0002"), _action("A0001")]))
    assert [action.action_id for action in dataset.actions] == ["A0001", "A0002"]
