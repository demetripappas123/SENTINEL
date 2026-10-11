import psycopg
from fastapi import APIRouter, HTTPException

from app.schemas.metrics import OperationalMetrics
from app.services.metrics import get_metrics

router = APIRouter(tags=["metrics"])


@router.get("/metrics", response_model=OperationalMetrics)
def read_metrics() -> OperationalMetrics:
    try:
        return get_metrics()
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
