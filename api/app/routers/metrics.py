import psycopg
from fastapi import APIRouter, Depends, HTTPException

from app.auth.deps import require_user
from app.auth.store import UserAccount
from app.schemas.metrics import OperationalMetrics
from app.services.metrics import get_metrics

router = APIRouter(tags=["metrics"])


@router.get("/metrics", response_model=OperationalMetrics)
def read_metrics(user: UserAccount = Depends(require_user)) -> OperationalMetrics:
    try:
        return get_metrics(user.organization_id)
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
