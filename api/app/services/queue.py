"""Decide which stored actions must be scored again when a batch arrives.

The affected set is the incoming actions plus other actions on those same
assets. get_queue only reads the rows already stored.
"""
from app.db import connect
from app.services.rules.evidence import score_batch
from app.dtos.canonical import CanonicalBatch
from app.dtos.queue import QueueItem, QueueUpdate
from app.services.store import load_queue


def get_queue(organization_id: str) -> list[QueueItem]:
    with connect() as conn:
        return load_queue(conn, organization_id)


def queue_updates(existing: CanonicalBatch, incoming: CanonicalBatch) -> QueueUpdate:
    """Queue rows to write after new records arrive.

    Rules score the merged history. The rows written are the incoming
    actions and every other action on those assets, because a new failure
    or a new good reading can change their rank or verdict.
    """
    merged = _merge(existing, incoming)
    scored = {
        f"{decision.source}:{decision.action_id}": (item, decision)
        for item, decision in score_batch(merged)
    }
    affected = _affected_ids(merged, incoming)
    ordered = sorted(affected)
    return QueueUpdate(
        upsert=[scored[item_id][0] for item_id in ordered if item_id in scored and scored[item_id][0] is not None],
        remove_ids=sorted(item_id for item_id in affected if item_id not in scored or scored[item_id][0] is None),
        decisions=[scored[item_id][1] for item_id in ordered if item_id in scored],
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
    asset_ids.update(reading.asset_id for reading in incoming.readings if reading.asset_id)
    affected = {
        f"{action.source.value}:{action.action_id}"
        for action in merged.actions
        if action.asset_id in asset_ids
    }
    affected.update(f"{action.source.value}:{action.action_id}" for action in incoming.actions)
    return affected
