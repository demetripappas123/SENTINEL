from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

from app.routers import ingest, metrics, queue

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")

app = FastAPI(title="SENTINEL", version="0.1.0")
app.include_router(ingest.router)
app.include_router(queue.router)
app.include_router(metrics.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
