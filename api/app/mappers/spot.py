from app.schemas.canonical import CanonicalBatch


def map_spot(payload: dict) -> CanonicalBatch:
    """Map a Spot-shaped state or mission payload into canonical records."""
    raise NotImplementedError
