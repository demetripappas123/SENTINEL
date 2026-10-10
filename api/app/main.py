from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

from app.routers import ingest, queue

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")

app = FastAPI(title="SENTINEL", version="0.1.0")
app.include_router(ingest.router)
app.include_router(queue.router)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
