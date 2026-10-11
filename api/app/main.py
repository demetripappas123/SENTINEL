"""Process entry. Load environment, then mount one orchestrator per route group."""
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.orchestrators import agent, auth, dataset, ingest, metrics, orbit, queue

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")

app = FastAPI(title="SENTINEL", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:8081").split(","),
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)
app.include_router(dataset.router)
app.include_router(ingest.router)
app.include_router(queue.router)
app.include_router(metrics.router)
app.include_router(auth.router)
app.include_router(orbit.router)
app.include_router(agent.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
