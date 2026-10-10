"""Regenerate shared synthetic fixtures and illustrative assets from the supplied kit."""
import csv
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / "SPOT_KnightHacks_Challenge_Kit Part One"
NUMBERS = {
    "sequence", "duration_min", "duration_sec", "start_battery_pct", "end_battery_pct",
    "battery_pct", "floor", "x_coord", "y_coord", "value",
}
BOOLEANS = {"synthetic", "operator_review_required"}


def records(name):
    with (KIT / "02_DATA" / f"{name}.csv").open(encoding="utf-8", newline="") as source:
        rows = list(csv.DictReader(source))
    for row in rows:
        for key, value in row.items():
            if key in NUMBERS:
                row[key] = float(value) if "." in value else int(value)
            elif key in BOOLEANS:
                row[key] = value == "True"
    return rows


def main():
    dataset = {name: records(name) for name in ["missions", "actions", "assets", "locations", "readings"]}
    dataset["findings"] = records("anomalies")
    dataset["events"] = [
        json.loads(line) for line in (KIT / "02_DATA" / "replay.ndjson").read_text().splitlines()
        if line.strip()
    ]
    target = ROOT / "packages/core/src/data/challenge.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(dataset, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    for destination in [ROOT / "SENTINEL-web-frontend/public/demo", ROOT / "SENTINEL-mobile-frontend/assets/demo"]:
        destination.mkdir(parents=True, exist_ok=True)
        shutil.copy2(KIT / "04_ASSETS/fictional_floor_plan.png", destination / "facility.png")
        for name in ["thermal_pump_bearing_01.jpg", "acoustic_valve_01.jpg", "gauge_pressure_01.jpg", "visual_pump_motor_01.jpg", "pipe_gallery_01.jpg"]:
            shutil.copy2(KIT / "04_ASSETS/sample_inspection_images" / name, destination / name)
    print(f"Imported {len(dataset['missions'])} missions, {len(dataset['actions'])} actions, {len(dataset['findings'])} findings.")


if __name__ == "__main__":
    main()
