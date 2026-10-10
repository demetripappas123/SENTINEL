"""
Very small example of grouping action results.

This intentionally does NOT reveal the expected challenge findings.
"""

from pathlib import Path
from collections import defaultdict
import csv

ROOT = Path(__file__).resolve().parents[1]
ACTIONS_FILE = ROOT / "02_DATA" / "actions.csv"

with open(
    ACTIONS_FILE,
    newline="",
    encoding="utf-8"
) as f:

    actions = list(csv.DictReader(f))

results = defaultdict(
    lambda: {
        "total": 0,
        "success": 0
    }
)

for action in actions:

    action_type = action["action_type"]

    results[action_type]["total"] += 1

    if action["status"] == "SUCCESS":
        results[action_type]["success"] += 1

print("Action results by type")
print("----------------------")

for action_type, values in sorted(results.items()):

    rate = (
        values["success"]
        / values["total"]
        * 100
    )

    print(
        f"{action_type:25s} "
        f"{rate:5.1f}% success "
        f"({values['success']}/{values['total']})"
    )
