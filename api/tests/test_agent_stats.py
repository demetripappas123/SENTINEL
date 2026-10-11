from datetime import datetime, timedelta, timezone

from app.services.agent.stats import align, correlate, summarize


START = datetime(2026, 9, 1, tzinfo=timezone.utc)


def _series(values: list[float], hours: int = 1):
    return [(START + timedelta(hours=index * hours), value) for index, value in enumerate(values)]


def test_identical_series_have_correlation_one():
    values = [1, 2, 3, 4, 5, 6, 7, 8]
    left, right, missing = align(_series(values), _series(values), "hour")
    assert missing == 0
    assert correlate(left, right, "pearson") == 1


def test_a_constant_series_has_no_correlation():
    left, right, _ = align(_series([5] * 8), _series([1, 2, 3, 4, 5, 6, 7, 8]), "hour")
    assert correlate(left, right, "pearson") is None
    assert correlate(left, right, "spearman") is None


def test_missing_buckets_are_not_interpolated():
    left = _series([1, 2, 3, 4, 5, 6, 7, 8])
    right = _series([1, 2, 3, 4, 5, 6, 7, 8])
    right.pop(3)
    aligned_left, aligned_right, missing = align(left, right, "hour")
    assert missing == 1
    assert len(aligned_left) == 7
    assert 4 not in aligned_right


def test_spearman_tracks_rank_order():
    left, right, _ = align(_series([1, 2, 3, 4, 5, 6, 7, 8]), _series([2, 4, 6, 8, 10, 12, 14, 16]), "hour")
    assert correlate(left, right, "spearman") == 1


def test_summary_reports_the_spread():
    summary = summarize([1, 2, 3, 4])
    assert summary["count"] == 4
    assert summary["minimum"] == 1
    assert summary["maximum"] == 4
    assert summary["median"] == 2.5
