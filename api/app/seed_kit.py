"""Load the challenge kit CSVs into Lakebase.

Run from api/: python -m app.seed_kit [data_dir]
Safe to re-run; rows are upserted.
"""
import sys
from pathlib import Path

from app.services.ingest import ingest_kit

DEFAULT_DATA = Path(__file__).resolve().parents[2] / "SPOT_KnightHacks_Challenge_Kit Part One" / "02_DATA"


def main() -> None:
    data_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DATA
    batch = ingest_kit(data_dir)
    counts = {field: len(rows) for field, rows in batch}
    print("Seeded kit data: " + ", ".join(f"{count} {field}" for field, count in counts.items()))


if __name__ == "__main__":
    main()
