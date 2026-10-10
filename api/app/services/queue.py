from app.rules.evidence import build_queue
from app.schemas.canonical import CanonicalBatch
from app.schemas.queue import QueueItem


def get_queue() -> list[QueueItem]:
    batch = _load()
    return build_queue(batch)


def _load() -> CanonicalBatch:
    """Read canonical records from Lakebase."""
    return CanonicalBatch()
