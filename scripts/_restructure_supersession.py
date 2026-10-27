"""Check the later owner-approved tables before bypassing historical calibration.

Historical ballots remain immutable. A superseded table is accepted only when the
live source still equals the complete replacement recorded in the approval ledger.
"""

import json
from pathlib import Path


class RestructureSupersession:
    def __init__(self, root: Path):
        self.root = root
        path = root / "calibration/graph_restructure_phase2.json"
        self.ledger = json.loads(path.read_text()) if path.exists() else {}
        self.hands = {
            (row["path"], hand.rsplit("/", 1)[1].lower()): row
            for hand, row in self.ledger.get("hands", {}).items()
        }
        self.techniques = {
            row["name"]: (path, row)
            for path, row in self.ledger.get("techniques", {}).items()
        }
        archive = root / "calibration/node_identity_retirements.json"
        self.retirements = {
            row["old_path"]: row["replacement_path"]
            for row in (json.loads(archive.read_text()).get("records", []) if archive.exists() else [])
        }
        self.checked = set()

    def hand(self, path: str, role: str, data=None) -> bool:
        if path in self.retirements:
            replacement = self.root / self.retirements[path]
            if (self.root / path).exists() or not replacement.is_file():
                raise SystemExit(f"[restructure] retirement drift: {path}")
            self.checked.add((path, "retired"))
            return True
        row = self.hands.get((path, role))
        if row is None:
            return False
        if data is None:
            data = json.loads((self.root / path).read_text())
        if data.get(role, {}).get("transitions") != row["after"]:
            raise SystemExit(f"[restructure] approved hand drift: {path} [{role}]")
        self.checked.add((path, role))
        return True

    def technique(self, name: str, votes=None) -> bool:
        match = self.techniques.get(name)
        if match is None:
            return False
        path, row = match
        data = json.loads((self.root / path).read_text())
        if any(data.get(key) != value for key, value in row["after"].items()):
            raise SystemExit(f"[restructure] approved technique drift: {path}")
        if votes is not None and "prior_after" in row:
            if votes.get(name, {}).get("prior") != row["prior_after"]:
                raise SystemExit(f"[restructure] approved prior drift: {name}")
        self.checked.add((path, "technique"))
        return True

    def report(self):
        print(f"[restructure] {len(self.checked)} superseding approval tables verified")
