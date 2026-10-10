import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.mappers.kit import map_kit
from app.schemas.canonical import Action, CanonicalBatch, Mission, Source
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


def test_events_are_empty_until_replay_is_stored():
    assert to_dataset(map_kit(KIT_DATA)).events == []


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
