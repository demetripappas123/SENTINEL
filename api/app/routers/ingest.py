from fastapi import APIRouter, HTTPException

from app.schemas.canonical import CanonicalBatch
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
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail="Ingest is not implemented yet") from exc
