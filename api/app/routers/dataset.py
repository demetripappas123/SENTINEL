import psycopg
from fastapi import APIRouter, HTTPException

from app.schemas.canonical import Source
from app.schemas.dataset import InspectionDataset
from app.services.dataset import get_dataset

router = APIRouter(tags=["dataset"])


@router.get("/dataset", response_model=InspectionDataset)
def read_dataset(source: Source = Source.kit) -> InspectionDataset:
    try:
        return get_dataset(source)
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
