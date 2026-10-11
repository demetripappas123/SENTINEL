"""Shared parsing for timestamps, numbers, and optional strings used by every mapper."""
from datetime import datetime


def text(value: object) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def required_text(value: object, field_name: str) -> str:
    cleaned = text(value)
    if cleaned is None:
        raise ValueError(f"Missing {field_name}")
    return cleaned


def number(value: object) -> float | None:
    cleaned = text(value)
    if cleaned is None:
        return None
    return float(cleaned)


def whole_number(value: object) -> int | None:
    cleaned = text(value)
    if cleaned is None:
        return None
    return int(float(cleaned))


def flag(value: object) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"true", "1", "yes", "open"}


def timestamp(value: object) -> datetime | None:
    cleaned = text(value)
    if cleaned is None:
        return None
    return datetime.fromisoformat(cleaned.replace("Z", "+00:00"))


def first(record: dict, *keys: str) -> object:
    for key in keys:
        if key in record and record[key] not in (None, ""):
            return record[key]
    return None
