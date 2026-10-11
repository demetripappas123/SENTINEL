"""Turn tool JSON into the words and clock times an operator should read.

The model copies tool fields into the reply. Dates and status codes are
rewritten here so the reply does not depend on the model to reformat them.
"""
import json
import re
from datetime import datetime, timezone

_ISO = re.compile(
    r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?"
)
_ENUM = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")

PHRASES = {
    "inspection_failure": "failed check",
    "equipment_finding": "confirmed finding",
    "potential_anomaly": "potential anomaly",
    "unsupported_claim": "unbacked label",
    "spot_label": "Spot label",
    "asset_fence": "outside this asset's usual range",
    "sanity_ceiling": "above the equipment limit",
    "unbacked_label": "unbacked label",
    "FAILED": "failed",
    "SUCCESS": "succeeded",
    "DEFINED": "not run",
    "QUESTIONABLE": "questionable",
    "GOOD": "good",
    "CRITICAL": "critical",
    "HIGH": "high",
    "MEDIUM": "medium",
    "LOW": "low",
    "READING_UNRELIABLE": "reading unreliable",
    "TARGET_NOT_DETECTED": "target not detected",
    "SENSOR_TIMEOUT": "sensor timeout",
    "QUESTIONABLE_READING": "questionable reading",
    "COMMUNICATION_LOSS": "communication loss",
    "LOCALIZATION_FAILURE": "localization failure",
    "OBSTACLE_DETECTION": "obstacle detection",
    "PATH_BLOCKED": "path blocked",
    "SIGNAL_NOISE": "signal noise",
    "ACOUSTIC_INSPECTION": "acoustic inspection",
    "GAUGE_READING": "gauge reading",
    "NAVIGATION": "navigation",
    "THERMAL_INSPECTION": "thermal inspection",
    "VISUAL_INSPECTION": "visual inspection",
    "LOCALIZATION_CONFIDENCE_PCT": "localization confidence",
    "PRESSURE_PSI": "pressure",
    "SOUND_DB": "sound",
    "TEMPERATURE_C": "temperature",
    "VISUAL_SCORE": "visual score",
}


def present(payload: str) -> str:
    try:
        parsed = json.loads(payload)
    except json.JSONDecodeError:
        return _text(payload)
    return json.dumps(_value(parsed))


def _value(value):
    if isinstance(value, dict):
        return {key: _field(key, item) for key, item in value.items()}
    if isinstance(value, list):
        return [_value(item) for item in value]
    if isinstance(value, str):
        return _text(value)
    return value


def _field(key: str, value):
    if isinstance(value, str) and _ENUM.fullmatch(value) and (key in _STATUS_KEYS or value in PHRASES):
        return _phrase(value)
    return _value(value)


_STATUS_KEYS = {
    "verdict",
    "status",
    "severity",
    "failure_type",
    "cause",
    "detection_method",
    "quality",
    "action_status",
    "mission_status",
    "anomaly_type",
    "measurement_type",
    "action_type",
}


def _text(value: str) -> str:
    if _ENUM.fullmatch(value) and value in PHRASES:
        return _phrase(value)
    return _ISO.sub(lambda match: _clock(match.group(0)) or match.group(0), _tokens(value))


def _tokens(value: str) -> str:
    for token, phrase in PHRASES.items():
        value = re.sub(rf"\b{re.escape(token)}\b", phrase, value)
    return value


def _phrase(value: str) -> str:
    if value in PHRASES:
        return PHRASES[value]
    if value.isupper() and "_" in value:
        return value.replace("_", " ").lower()
    return value


def _clock(value: str) -> str | None:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    parsed = parsed.astimezone(timezone.utc)
    hour = parsed.hour % 12 or 12
    suffix = "am" if parsed.hour < 12 else "pm"
    return f"{hour}:{parsed.minute:02d}{suffix} {parsed.month:02d}/{parsed.day:02d}"
