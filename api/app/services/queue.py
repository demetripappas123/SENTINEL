from app.db import connect
from app.rules.evidence import build_queue
from app.schemas.canonical import CanonicalBatch
from app.schemas.queue import QueueItem, QueueUpdate
from app.services.store import load_queue


def get_queue() -> list[QueueItem]:
    with connect() as conn:
        return load_queue(conn)


def queue_updates(existing: CanonicalBatch, incoming: CanonicalBatch) -> QueueUpdate:
    """Queue rows to write after new records arrive.

    Rules score the merged history. The rows written are the incoming
    actions, every other action on those assets, and actions that share a
    measurement, because a new failure or a new good reading can change
    their rank or verdict.
    """
    merged = _merge(existing, incoming)
    queued = {item.id: item for item in build_queue(merged)}
    affected = _affected_ids(merged, incoming)
    return QueueUpdate(
        upsert=[queued[item_id] for item_id in sorted(affected) if item_id in queued],
        remove_ids=sorted(item_id for item_id in affected if item_id not in queued),
    )


def _merge(existing: CanonicalBatch, incoming: CanonicalBatch) -> CanonicalBatch:
    return CanonicalBatch(
        missions=_replace(existing.missions, incoming.missions, "mission_id"),
        actions=_replace(existing.actions, incoming.actions, "action_id"),
        readings=_replace(existing.readings, incoming.readings, "reading_id"),
        anomaly_claims=_replace(existing.anomaly_claims, incoming.anomaly_claims, "anomaly_id"),
        assets=_replace(existing.assets, incoming.assets, "asset_id"),
        locations=_replace(existing.locations, incoming.locations, "location_id"),
    )


def _replace(current: list, incoming: list, key: str) -> list:
    merged = {(record.source, getattr(record, key)): record for record in current}
    merged.update({(record.source, getattr(record, key)): record for record in incoming})
    return list(merged.values())


def _affected_ids(merged: CanonicalBatch, incoming: CanonicalBatch) -> set[str]:
    asset_ids = {action.asset_id for action in incoming.actions if action.asset_id}
    measurements = {reading.measurement_type for reading in incoming.readings}
    peer_actions = {
        (reading.source, reading.action_id)
        for reading in merged.readings
        if reading.measurement_type in measurements
    }
    affected = {
        f"{action.source.value}:{action.action_id}"
        for action in merged.actions
        if action.asset_id in asset_ids or (action.source, action.action_id) in peer_actions
    }
    affected.update(f"{action.source.value}:{action.action_id}" for action in incoming.actions)
    return affected
