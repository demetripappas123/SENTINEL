from app.schemas.canonical import CanonicalBatch
from app.schemas.queue import QueueItem


def build_queue(batch: CanonicalBatch) -> list[QueueItem]:
    """Turn stored canonical records into ranked operator queue items."""
    return []
