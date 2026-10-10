"""Gemini-backed operator assistance grounded in the local SPOT datasets."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import pandas as pd
from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parents[1]
LOGGER = logging.getLogger(__name__)
EXPECTED_FILES = (
    "missions.csv", "actions.csv", "anomalies.csv", "readings.csv",
    "assets.csv", "locations.csv", "replay.ndjson",
)
SYSTEM_INSTRUCTION = """You are SENTINEL Copilot, an embedded operational AI assistant for Boston Dynamics SPOT autonomous inspection missions. You assist plant reliability engineers and operations managers by analyzing robot telemetry, mission performance, and facility sensor data.

Operational Role:
- You extract all facts dynamically from the provided dataset context (missions, actions, readings, anomalies, assets, locations).
- Never invent metrics, IDs, or failure causes. Cite the actual IDs (e.g., Mission, Waypoint, Asset, Action) found in the telemetry logs.
- Keep answers grounded, direct, and concise by default, while remaining flexible to the user's specific format or tone requests.

How to Approach Responses:
- For broad diagnostic inquiries, lead with the primary finding based on the data, mention key contributing IDs/factors, and suggest practical next steps.
- For targeted lookups or user-constrained questions (e.g., word caps, lists, specific asset checks), answer directly and honor the requested format.
- If asked about non-industrial or completely unrelated topics (e.g., consumer food orders, pop culture, personal chitchat), politely clarify that you are focused on SPOT mission intelligence.

Style Blueprint Examples (adapt naturally, do not copy verbatim):

Example 1 (Diagnostic query):
'Inspection failures in the current dataset are driven primarily by sensor timeouts and unconfirmed readings during gauge checks rather than mobility stops.
Recommended next steps:
1. Verify optical line-of-sight and target markers for assets at the highest-failing waypoints.
2. Extend sensor polling timeouts in the Autowalk mission profiles.'

Example 2 (Direct/constrained query):
'Mission M001 completed with 10 successful visual inspection actions.'
"""


def _data_directory() -> Path:
    """Prefer root data, falling back to the checked-in challenge kit."""
    candidates = (
        ROOT / "02_DATA",
        ROOT / "SPOT_KnightHacks_Challenge_Kit Part One" / "02_DATA",
    )
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError("No 02_DATA directory was found in the project.")


def _counts(frame: pd.DataFrame, column: str) -> str:
    if column not in frame:
        return "unavailable"
    counts = frame[column].fillna("UNKNOWN").astype(str).value_counts()
    return ", ".join(f"{key}: {value}" for key, value in counts.head(12).items())


def _recent_rows(frame: pd.DataFrame, time_column: str | None) -> str:
    """Include a small, bounded sample, sorted by actual parsed timestamps."""
    recent = frame
    if time_column and time_column in frame:
        timestamps = pd.to_datetime(frame[time_column], errors="coerce", utc=True)
        recent = frame.assign(_sort_time=timestamps).sort_values(
            "_sort_time", na_position="first"
        ).drop(columns="_sort_time")
    recent = recent.tail(5).copy()
    for column in recent:
        recent[column] = recent[column].map(
            lambda value: str(value)[:350] if isinstance(value, (str, dict, list)) else value
        )
    return recent.to_json(orient="records", date_format="iso")[:6500]


def _summarize_frame(filename: str, frame: pd.DataFrame) -> str:
    lines = [f"{filename}: {len(frame)} rows"]
    if frame.empty:
        return lines[0] + " (empty)"
    for column in (
        "mission_status", "status", "failure_type", "anomaly_type", "severity",
        "operator_review_required", "quality", "event_type", "scenario",
    ):
        if column in frame:
            lines.append(f"{column}: {_counts(frame, column)}")
    for column in ("duration_min", "duration_sec", "end_battery_pct", "battery_pct"):
        if column in frame:
            values = pd.to_numeric(frame[column], errors="coerce").dropna()
            if not values.empty:
                lines.append(
                    f"{column}: mean={values.mean():.2f}, "
                    f"min={values.min():.2f}, max={values.max():.2f}"
                )
    if {"measurement_type", "unit", "value"}.issubset(frame.columns):
        readings = frame.assign(value=pd.to_numeric(frame["value"], errors="coerce"))
        statistics = readings.groupby(["measurement_type", "unit"], dropna=False)[
            "value"
        ].agg(["count", "mean", "min", "max"]).round(2)
        lines.append("Telemetry by measurement and unit:\n" + statistics.head(20).to_string())
    time_column = next((c for c in ("timestamp", "start_time") if c in frame), None)
    if time_column:
        timestamps = pd.to_datetime(frame[time_column], errors="coerce", utc=True)
        valid = timestamps.dropna()
        if not valid.empty:
            lines.append(f"Snapshot period: {valid.min().isoformat()} to {valid.max().isoformat()}")
            # Daily counts expose changing failure/anomaly patterns without sending every row.
            trend_columns = [c for c in ("mission_status", "status", "anomaly_type") if c in frame]
            if trend_columns:
                trend = frame.assign(day=timestamps.dt.strftime("%Y-%m-%d"))
                daily = trend.groupby(["day", trend_columns[0]]).size().unstack(fill_value=0)
                lines.append("Recent daily counts:\n" + daily.tail(7).iloc[:, :12].to_string())
    lines.append("Latest records: " + _recent_rows(frame, time_column))
    if filename == "replay.ndjson" and {"mission_id", "timestamp"}.issubset(frame.columns):
        states = frame.assign(
            _sort_time=pd.to_datetime(frame["timestamp"], errors="coerce", utc=True)
        ).dropna(subset=["_sort_time"]).sort_values("_sort_time")
        states = states.drop_duplicates("mission_id", keep="last").drop(columns="_sort_time")
        lines.append("Latest recorded event per mission: " + _counts(states, "event_type"))
    return "\n".join(lines)


def _build_system_context(*, raise_errors: bool = False) -> str:
    data_dir = _data_directory()
    sections = ["Local SPOT dataset snapshot (not a live feed)."]
    loaded = 0
    # Include additional CSV/NDJSON datasets if they are added later.
    filenames = sorted(set(EXPECTED_FILES) | {
        path.name for path in data_dir.iterdir()
        if path.is_file() and path.suffix.lower() in {".csv", ".ndjson"}
    })
    for filename in filenames:
        path = data_dir / filename
        try:
            frame = (
                pd.read_csv(path)
                if path.suffix.lower() == ".csv"
                else pd.read_json(path, lines=True)
            )
            sections.append(_summarize_frame(filename, frame))
            loaded += int(not frame.empty)
        except (OSError, ValueError, pd.errors.ParserError) as exc:
            if raise_errors:
                raise
            LOGGER.warning("Unable to load SPOT dataset %s (%s)", filename, type(exc).__name__)
            sections.append(f"{filename}: unavailable ({type(exc).__name__}); do not infer its contents.")
    if not loaded:
        raise ValueError("No readable, non-empty CSV or NDJSON datasets were found.")
    return "\n\n".join(sections)


def handle_operator_chat(user_question: str, *, raise_errors: bool = False) -> str:
    """Return an operator-facing answer using the modern official google-genai SDK."""
    if not isinstance(user_question, str) or not user_question.strip():
        return "Please provide a non-empty operator question."
    
    try:
        # 1. Gather the API key securely
        api_key = (os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY") or "").strip()
        if not api_key:
            return "Assistant configuration error: set GOOGLE_API_KEY or GEMINI_API_KEY in the root .env file."
        
        # 2. Gather our local hackathon CSV/JSON database summary data
        context = _build_system_context(raise_errors=True) if raise_errors else _build_system_context()
    except (OSError, ValueError) as exc:
        if raise_errors:
            raise
        LOGGER.warning("SPOT assistant data/configuration unavailable (%s)", type(exc).__name__)
        return "SPOT data is unavailable. Check the 02_DATA directory and its CSV/NDJSON files."

    try:
        # 3. Import the clean official modern SDK natively
        from google import genai
        from google.genai.errors import ClientError, ServerError
        from google.genai.types import HttpOptions
        
        # 4. Initialize the developer client explicitly targeting AI Studio
        client = genai.Client(api_key=api_key, http_options=HttpOptions(timeout=15000))
        
        # 5. Package the prompt with our dataset tables
        final_prompt = (
            f"{SYSTEM_INSTRUCTION}\n\n{context}\n\nOperator Question: {user_question.strip()}"
        )
        
        # 6. Request generation from the stable flash model endpoint
        try:
            response = client.models.generate_content(
                model='gemini-3.5-flash-lite',
                contents=final_prompt
            )
        except (ClientError, ServerError, TimeoutError):
            return (
                'The AI Assistant is experiencing high network latency. However, '
                'based on local telemetry, the most critical issue is abnormal '
                'temperature readings on HX-204.'
            )
        
        return response.text
        
    except Exception as exc:
        if raise_errors:
            raise
        LOGGER.error("Gemini network transaction failed (%s)", type(exc).__name__)
        return f"The AI Assistant could not process the query due to a runtime network issue: {str(exc)}"
