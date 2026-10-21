"""The historical listing review, migrated only by exact approved replacements."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from _restructure_supersession import RestructureSupersession
from _slug import slugify

# Owner-approved stale-spec migration: the listing-table claim is unchanged.
# Orchestrator reports/graph-restructure-plan.md:241,242,342 explicitly remove
# these listings INCLUDING their own tables; the generic techniques survive.
REMOVED = (
    ("Dead Orchard Control/Top", "Anaconda Choke"),
    ("Dead Orchard Control/Top", "Darce from Turtle"),
    ("Dead Orchard Control/Bottom", "Arm Extraction"),
    ("Leg Weave/Top", "Leg Weave Pass"),
)
# reports/restructure-inverted-panel.md:52,54,100-102,186-188 (I4 G02/G06):
# retain the inverted listings and their approved tables on the named survivors.
ADDED = (
    ("Inverted Guard/Bottom", "Technical Stand-up"),
    ("Inverted Guard/Top", "Toreando Pass"),
)


def expectations(root=ROOT):
    prov = json.loads((root / "calibration/listing_tables.json").read_text())
    dropped = {r["key"] for r in prov.get("dropped", [])}
    historical = {t["key"]: t for t in prov["tables"] if t["key"] not in dropped}
    assert len(historical) == 95, "the historical review receipt is unchanged"
    current = dict(historical)
    approval = RestructureSupersession(root)
    retired = []
    for hand, move in REMOVED + ADDED:
        row = approval.ledger["hands"][hand]
        role = hand.rsplit("/", 1)[1].lower()
        assert approval.hand(row["path"], role), f"no approved replacement: {hand}"
        listing = "/".join(slugify(s) for s in hand.split("/"))
        key = f"{move}@{listing}"
        if (hand, move) in REMOVED:
            assert any(e["transition"] == move and e.get("outcomes") for e in row["before"]), key
            assert all(e["transition"] != move for e in row["after"]), key
            retired.append(current.pop(key))  # missing historical rows fail, never silently skip
        else:
            assert key not in historical, f"the approved addition already existed: {key}"
            matches = [e for e in row["after"] if e["transition"] == move]
            assert len(matches) == 1 and matches[0].get("deal_here"), key
            e = matches[0]
            current[key] = {
                "key": key, "move": move, "listing": listing, "share_here": e["attempt_probability"],
                "result": {"success_rate": e["success_rate"], "outcomes": [
                    {"to": "/".join(slugify(s) for s in o["to"].split("/")),
                     "gi": o["probability"]["gi"], "nogi": o["probability"]["nogi"], "result": o["result"]}
                    for o in e["outcomes"]]},
            }
    surviving = len(historical) - len(retired)
    assert surviving == 91 and surviving > 0, "every surviving historical table is exercised"
    assert len(retired) == 4 and len(current) == 93, "only the six approved listing changes"
    return {"tables": list(current.values()), "retired": retired,
            "surviving": surviving, "added": len(ADDED)}


if __name__ == "__main__":
    print(json.dumps(expectations()))
