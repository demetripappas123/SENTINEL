"""Ceilings for a good reading that is already too high for the equipment.

The asset fence needs eight other good readings. These limits do not.
A value above the ceiling is a potential anomaly: worth a look, and not
an unbacked label. The numbers sit above every good reading in the kit.

Temperature is a walk-up reading. A panel alarms before a heat exchanger
or a compressor discharge does. Pressure ceilings are about double the
kit's highest good reading, and lower on a motor because a motor is not
a pressure vessel. A compressor, pump, or motor can be louder than a
panel, valve, exchanger, or gauge. Visual score and localization
confidence only run to 100.
"""

def _kind(asset_type: str | None) -> str:
    if not asset_type:
        return ""
    return " ".join(asset_type.casefold().replace("_", " ").replace("-", " ").split())


# A reading has to be greater than the limit. Temperature is Celsius,
# pressure is psi, and sound is dB.
_CEILING: dict[tuple[str, str], float] = {
    ("heat exchanger", "TEMPERATURE_C"): 150,
    ("electrical panel", "TEMPERATURE_C"): 90,
    ("pump", "TEMPERATURE_C"): 110,
    ("motor", "TEMPERATURE_C"): 120,
    ("valve", "TEMPERATURE_C"): 150,
    ("pressure gauge", "TEMPERATURE_C"): 100,
    ("compressor", "TEMPERATURE_C"): 160,
    ("heat exchanger", "PRESSURE_PSI"): 300,
    ("electrical panel", "PRESSURE_PSI"): 250,
    ("pump", "PRESSURE_PSI"): 300,
    ("motor", "PRESSURE_PSI"): 200,
    ("valve", "PRESSURE_PSI"): 300,
    ("pressure gauge", "PRESSURE_PSI"): 300,
    ("compressor", "PRESSURE_PSI"): 250,
    ("heat exchanger", "SOUND_DB"): 100,
    ("electrical panel", "SOUND_DB"): 100,
    ("valve", "SOUND_DB"): 100,
    ("pressure gauge", "SOUND_DB"): 100,
    ("compressor", "SOUND_DB"): 110,
    ("pump", "SOUND_DB"): 110,
    ("motor", "SOUND_DB"): 110,
}

_GENERIC: dict[str, float] = {
    "TEMPERATURE_C": 150,
    "PRESSURE_PSI": 300,
    "SOUND_DB": 110,
    "VISUAL_SCORE": 100,
    "LOCALIZATION_CONFIDENCE_PCT": 100,
}


def sanity_limit(asset_type: str | None, measurement_type: str) -> float | None:
    """Return the high ceiling for this equipment and measurement."""
    specific = _CEILING.get((_kind(asset_type), measurement_type))
    if specific is not None:
        return specific
    return _GENERIC.get(measurement_type)


def exceeds_sanity(
    value: float,
    asset_type: str | None,
    measurement_type: str,
) -> tuple[bool, float | None]:
    """True when a good value is already above the ceiling."""
    limit = sanity_limit(asset_type, measurement_type)
    if limit is None:
        return False, None
    return value > limit, limit
