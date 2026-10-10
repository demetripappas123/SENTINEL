from pathlib import Path

from app.mappers.kit import map_kit
from app.mappers.orbit import map_orbit
from app.mappers.spot import map_spot
from app.schemas.canonical import CanonicalBatch


def ingest_kit(data_dir: Path) -> CanonicalBatch:
    batch = map_kit(data_dir)
    _persist(batch)
    return batch


def ingest_orbit(payload: dict) -> CanonicalBatch:
    batch = map_orbit(payload)
    _persist(batch)
    return batch


def ingest_spot(payload: dict) -> CanonicalBatch:
    batch = map_spot(payload)
    _persist(batch)
    return batch


def _persist(batch: CanonicalBatch) -> None:
    """Write canonical records to Lakebase."""
    raise NotImplementedError
