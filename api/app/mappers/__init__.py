"""Turn an outside payload into canonical records. No database access."""
from app.mappers.kit import map_kit
from app.mappers.orbit import map_orbit
from app.mappers.spot import map_spot

__all__ = ["map_kit", "map_orbit", "map_spot"]
