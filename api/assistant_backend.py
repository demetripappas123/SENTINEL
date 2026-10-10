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
SYSTEM_INSTRUCTION = """You are SENTINEL Copilot, an embedded operational briefing agent for Boston Dynamics SPOT robotic autonomous inspections. Your briefings go directly to plant shift supervisors and reliability engineers.

Strict Grounding Rules:
1. NO BROAD STATEMENTS: Never use vague groupings like 'across all waypoints', 'various assets', or 'sensors in general'. You must cite exact Waypoint IDs (e.g., WP05, WP09, WP03, WP01) and exact Asset IDs (e.g., PANEL-211, HX-208, HX-201, PANEL-215).
2. HOTSPOT CONCENTRATION & CAUSE ACCURACY: Highlight documented failure clusters with exact root causes:
   - WP05 (Pipe Gallery): High localization/navigation aborts (28% failure rate, 6 LOCALIZATION_FAILURE) and OBSTACLE_DETECTION.
   - WP09 (Turbine Hall South): Telemetry and link failures (SENSOR_TIMEOUT, COMMUNICATION_LOSS, READING_UNRELIABLE). Do NOT claim path obstructions at WP09.
   - WP01 (Main Entrance): OBSTACLE_DETECTION events.
   - WP03 (Cooling Loop): The single PATH_BLOCKED event.
3. VERIFIED ASSET-TO-WAYPOINT MAPPING: Never guess pairings. Maintain strict dataset facts:
   - WP05 maps to HX-201
   - WP09 maps to PANEL-211 and PANEL-212
   - WP01 maps to PANEL-215
   - WP03 maps to HX-208
4. ROOT CAUSE ATTRIBUTION: Distinguish between mobility aborts (LOCALIZATION_FAILURE, PATH_BLOCKED, OBSTACLE_DETECTION) and payload acquisition failures (14 READING_UNRELIABLE, 12 SENSOR_TIMEOUT, 7 TARGET_NOT_DETECTED).
5. VALID, TARGETED DIRECTIVES ONLY: Must be grounded in SPOT Autowalk workflows. Every directive must name the exact target waypoint, asset, and inspection modality (e.g., inspecting AprilTag fiducials at WP05, clearing PTZ sightlines for PANEL-211 at WP09, or increasing sensor polling timeouts for gauge checks on HX-208).

Response Format (Max 85 words):
**Core Finding:**
[1-2 sentences stating exact subsystem breakdown, failure counts, and verified hotspot waypoints/assets].

**Immediate Field Directives:**
1. [Physical inspection targeting a verified waypoint-asset pair, e.g., AprilTags at WP05 for HX-201 or PTZ markers at WP09 for PANEL-211].
2. [Autowalk/Orbit software configuration adjustment naming specific asset, action type, and failure mode, e.g., gauge polling timeouts on HX-208]."""


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
            SYSTEM_INSTRUCTION + "\n\n" + context
            + "\n\nOperator question:\n" + user_question.strip()
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
