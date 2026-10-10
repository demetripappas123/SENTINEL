from fastapi import APIRouter

from app.schemas.queue import QueueItem
from app.services.queue import get_queue

router = APIRouter(tags=["queue"])


@router.get("/queue", response_model=list[QueueItem])
def read_queue() -> list[QueueItem]:
    return get_queue()
