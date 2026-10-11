import psycopg
from fastapi import APIRouter, HTTPException

from app.schemas.queue import QueueItem
from app.services.queue import get_queue

router = APIRouter(tags=["queue"])


@router.get("/queue", response_model=list[QueueItem])
def read_queue() -> list[QueueItem]:
    try:
        return get_queue()
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
