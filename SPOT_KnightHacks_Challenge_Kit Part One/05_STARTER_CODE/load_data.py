"""
Minimal example for loading the SPOT challenge CSV files.

Uses only the Python standard library.
"""

from pathlib import Path
import csv

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "02_DATA"


def load_csv(filename):

    path = DATA / filename

    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


missions = load_csv("missions.csv")
actions = load_csv("actions.csv")
readings = load_csv("readings.csv")
anomalies = load_csv("anomalies.csv")
locations = load_csv("locations.csv")
assets = load_csv("assets.csv")

print("Loaded:")
print(" Missions:", len(missions))
print(" Actions:", len(actions))
print(" Readings:", len(readings))
print(" Anomalies:", len(anomalies))
print(" Locations:", len(locations))
print(" Assets:", len(assets))

print()
print("Example mission:")
print(missions[0])
