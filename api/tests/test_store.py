from datetime import datetime, timezone

from app.demo_org import DEMO_ORGANIZATION_ID
from app.dtos.canonical import CanonicalBatch, Mission, ReplayEvent, Source
from app.dtos.queue import QueueUpdate
from app.services import dataset as dataset_service
from app.services.store import persist

STARTED = datetime(2026, 9, 1, 18, 0, tzinfo=timezone.utc)


class FakeConnection:
    """Records statements and serves canned rows per sentinel table."""

    def __init__(self, rows: dict[str, list[dict]] | None = None):
        self.rows = rows or {}
        self.writes: list[tuple[str, list[tuple]]] = []
        self.reads: list[tuple[str, tuple]] = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def cursor(self):
        return self

    def executemany(self, statement: str, rows):
        self.writes.append((statement, list(rows)))

    def execute(self, statement: str, params: tuple = ()):
        self.reads.append((statement, params))
        table = statement.split("sentinel.")[1].split()[0]
        rows = self.rows.get(table, [])
        return type("Result", (), {"fetchall": lambda _: rows})()


def _event() -> ReplayEvent:
    return ReplayEvent(
        source=Source.kit,
        event_id="E00001",
        mission_id="M001",
        timestamp=STARTED,
        event_type="MISSION_STARTED",
        details={"scenario": "BASELINE", "battery_pct": 82},
    )


def _mission() -> Mission:
    return Mission(source=Source.kit, mission_id="M001", mission_name="Route 01", mission_status="COMPLETED")


def test_persist_stores_missions_and_leaves_replay_derived():
    conn = FakeConnection()
    persist(conn, CanonicalBatch(missions=[_mission()], events=[_event()]), QueueUpdate(), DEMO_ORGANIZATION_ID)
    tables = [statement.split("sentinel.")[1].split()[0] for statement, _ in conn.writes]
    assert "missions" in tables
    assert "replay_events" not in tables


def test_get_dataset_derives_replay_from_source_missions(monkeypatch):
    mission = _mission().model_copy(update={"start_time": STARTED})
    conn = FakeConnection({"missions": [mission.model_dump() | {"source": "kit"}]})
    monkeypatch.setattr(dataset_service, "connect", lambda: conn)
    dataset = dataset_service.get_dataset(Source.kit, DEMO_ORGANIZATION_ID)
    assert all(params == (DEMO_ORGANIZATION_ID, "kit") for _, params in conn.reads)
    assert dataset.model_dump()["events"] == [
        {
            "event_id": "M001:started",
            "mission_id": "M001",
            "timestamp": "2026-09-01T18:00:00",
            "event_type": "MISSION_STARTED",
            "details": {"scenario": None, "configuration_version": None, "battery_pct": None},
        }
    ]
