"""Deterministic summaries for the investigation tools.

Correlation describes whether two aligned series move together.
It does not establish a shared cause.
"""
from datetime import datetime, timezone
from statistics import median, pstdev


MIN_CORRELATION_PAIRS = 8


def utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def bucket(value: datetime, interval: str) -> datetime:
    value = utc(value)
    if interval == "day":
        return value.replace(hour=0, minute=0, second=0, microsecond=0)
    if interval == "hour":
        return value.replace(minute=0, second=0, microsecond=0)
    return value.replace(second=0, microsecond=0)


def summarize(values: list[float]) -> dict:
    if not values:
        return {"count": 0, "mean": None, "median": None, "standard_deviation": None, "minimum": None, "maximum": None}
    return {
        "count": len(values),
        "mean": sum(values) / len(values),
        "median": median(values),
        "standard_deviation": pstdev(values) if len(values) > 1 else 0.0,
        "minimum": min(values),
        "maximum": max(values),
    }


def change(points: list[tuple[datetime, float]]) -> float | None:
    ordered = sorted(points, key=lambda item: item[0])
    if len(ordered) < 2:
        return None
    return ordered[-1][1] - ordered[0][1]


def align(left: list[tuple[datetime, float]], right: list[tuple[datetime, float]], interval: str) -> tuple[list[float], list[float], int]:
    """Pair bucket means. A bucket with only one asset is missing, not interpolated."""
    left_buckets = _means(left, interval)
    right_buckets = _means(right, interval)
    shared = sorted(set(left_buckets) & set(right_buckets))
    union = set(left_buckets) | set(right_buckets)
    missing = len(union) - len(shared)
    return (
        [left_buckets[key] for key in shared],
        [right_buckets[key] for key in shared],
        missing,
    )


def correlate(left: list[float], right: list[float], method: str) -> float | None:
    if len(left) != len(right) or len(left) < 2:
        return None
    if method == "spearman":
        left = _ranks(left)
        right = _ranks(right)
    return _pearson(left, right)


def _means(points: list[tuple[datetime, float]], interval: str) -> dict[datetime, float]:
    grouped: dict[datetime, list[float]] = {}
    for stamp, value in points:
        grouped.setdefault(bucket(stamp, interval), []).append(value)
    return {key: sum(values) / len(values) for key, values in grouped.items()}


def _pearson(left: list[float], right: list[float]) -> float | None:
    count = len(left)
    mean_left = sum(left) / count
    mean_right = sum(right) / count
    numerator = sum((x - mean_left) * (y - mean_right) for x, y in zip(left, right))
    scale_left = sum((x - mean_left) ** 2 for x in left) ** 0.5
    scale_right = sum((y - mean_right) ** 2 for y in right) ** 0.5
    if scale_left == 0 or scale_right == 0:
        return None
    return numerator / (scale_left * scale_right)


def _ranks(values: list[float]) -> list[float]:
    order = sorted(range(len(values)), key=lambda index: values[index])
    ranks = [0.0] * len(values)
    index = 0
    while index < len(values):
        end = index
        while end + 1 < len(values) and values[order[end + 1]] == values[order[index]]:
            end += 1
        average = (index + end) / 2 + 1
        for cursor in range(index, end + 1):
            ranks[order[cursor]] = average
        index = end + 1
    return ranks
