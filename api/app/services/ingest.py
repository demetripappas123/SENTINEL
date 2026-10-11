from pathlib import Path

from app.db import connect
from app.mappers.kit import map_kit
from app.mappers.orbit import map_orbit
from app.mappers.spot import map_spot
from app.schemas.canonical import CanonicalBatch
from app.services.queue import queue_updates
from app.demo_org import DEMO_ORGANIZATION_ID
from app.services.store import load_history, persist


def ingest_kit(data_dir: Path, organization_id: str = DEMO_ORGANIZATION_ID) -> CanonicalBatch:
    return _ingest(map_kit(data_dir), organization_id)


def ingest_orbit(payload: dict, organization_id: str = DEMO_ORGANIZATION_ID) -> CanonicalBatch:
    return _ingest(map_orbit(payload), organization_id)


def ingest_spot(payload: dict, organization_id: str = DEMO_ORGANIZATION_ID) -> CanonicalBatch:
    return _ingest(map_spot(payload), organization_id)


def _ingest(incoming: CanonicalBatch, organization_id: str) -> CanonicalBatch:
    with connect() as conn:
        existing = load_history(conn, incoming, organization_id)
        update = queue_updates(existing, incoming)
        persist(conn, incoming, update, organization_id)
        conn.commit()
    return incoming
