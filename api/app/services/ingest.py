from pathlib import Path

from app.db import connect
from app.mappers.kit import map_kit
from app.mappers.orbit import map_orbit
from app.mappers.spot import map_spot
from app.schemas.canonical import CanonicalBatch
from app.services.queue import queue_updates
from app.services.store import load_history, persist


def ingest_kit(data_dir: Path) -> CanonicalBatch:
    return _ingest(map_kit(data_dir))


def ingest_orbit(payload: dict) -> CanonicalBatch:
    return _ingest(map_orbit(payload))


def ingest_spot(payload: dict) -> CanonicalBatch:
    return _ingest(map_spot(payload))


def _ingest(incoming: CanonicalBatch) -> CanonicalBatch:
    with connect() as conn:
        existing = load_history(conn, incoming)
        update = queue_updates(existing, incoming)
        persist(conn, incoming, update)
        conn.commit()
    return incoming
