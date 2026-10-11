import psycopg
from fastapi import APIRouter, Depends, HTTPException

from app.auth.deps import require_user
from app.auth.store import UserAccount
from app.schemas.queue import QueueItem
from app.services.queue import get_queue

router = APIRouter(tags=["queue"])


@router.get("/queue", response_model=list[QueueItem])
def read_queue(user: UserAccount = Depends(require_user)) -> list[QueueItem]:
    try:
        return get_queue(user.organization_id)
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
