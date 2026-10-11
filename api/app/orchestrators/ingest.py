"""POST /ingest/orbit and POST /ingest/spot. The body is the raw source payload.

Kit files are loaded through the ingest service, not through an HTTP route.
"""
import psycopg
from fastapi import APIRouter, HTTPException

from app.dtos.canonical import CanonicalBatch
from app.services.ingest import ingest_orbit, ingest_spot

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("/orbit", response_model=CanonicalBatch)
def post_orbit(payload: dict) -> CanonicalBatch:
    return _ingest(lambda: ingest_orbit(payload))


@router.post("/spot", response_model=CanonicalBatch)
def post_spot(payload: dict) -> CanonicalBatch:
    return _ingest(lambda: ingest_spot(payload))


def _ingest(call):
    try:
        return call()
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
