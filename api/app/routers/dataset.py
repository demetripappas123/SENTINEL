import psycopg
from fastapi import APIRouter, Depends, HTTPException

from app.auth.deps import require_user
from app.auth.store import UserAccount
from app.schemas.canonical import Source
from app.schemas.dataset import InspectionDataset
from app.services.dataset import get_dataset, get_live_dataset

router = APIRouter(tags=["dataset"])


@router.get("/dataset", response_model=InspectionDataset)
def read_dataset(
    source: Source = Source.kit,
    detail: int = 1,
    user: UserAccount = Depends(require_user),
) -> InspectionDataset:
    try:
        return get_dataset(source, user.organization_id, detail=detail != 0)
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc


@router.get("/dataset/live", response_model=InspectionDataset)
def read_live_dataset(detail: int = 1, user: UserAccount = Depends(require_user)) -> InspectionDataset:
    try:
        return get_live_dataset(user.organization_id, detail=detail != 0)
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
