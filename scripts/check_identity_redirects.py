#!/usr/bin/env python3
"""Keep every redirect source published by the identity archive's frozen base.

The checked-in source inventory was reconstructed with the frozen base's OWN emitter,
slug rules, content and authored redirects. CI's shallow checkout reads that inventory;
--verify-baseline reproduces it from Git when the base is available. Compare the source
set to today's emission (or an actual --public tree).
A vanished exact source is allowed only when an explicit archived retirement's
wildcard is emitted with its recorded replacement. Merely archiving a record does
not excuse a URL that now returns 404.

The unit wrapper runs the complete source comparison in ci:validate; --public also
checks an own build. This catches aliases that never had an HTML file and therefore
cannot be covered by an added/removed HTML inventory.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile

from regenerate_identity_redirects import retirement_rules

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE_PATH = "calibration/node_identity_retirements.json"
BASELINE_PATH = "tests/artifacts/identity_redirect_sources.json"
SNAPSHOT_PATHS = (
    "content", "scripts/regenerate_redirects.py", "scripts/_slug.py",
    "source/quartz/static/_redirects",
)


def parse_rules(text: str) -> dict[str, tuple[str, ...]]:
    rules = {}
    for number, raw in enumerate(text.splitlines(), 1):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        fields = raw.split()
        if len(fields) < 3:
            raise ValueError(f"Malformed redirect at line {number}: {raw}")
        source, value = fields[0], tuple(fields[1:])
        if source in rules and rules[source] != value:
            raise ValueError(f"Conflicting published source: {source}")
        rules[source] = value
    return rules


def compare_sources(
    before: dict[str, tuple[str, ...]],
    after: dict[str, tuple[str, ...]],
    retirements: dict[str, tuple[str, ...]],
) -> tuple[list[str], dict[str, int]]:
    if not before or not after:
        raise ValueError("A redirect comparison must inspect nonempty base and current source sets")
    missing = []
    exact = covered = 0
    for source in before:
        if source in after:
            exact += 1
            continue
        # An explicit retirement can replace specific descendants with its wildcard.
        # Require the actual emitted rule and replacement, not just an archive entry.
        if any(pattern.endswith("/*") and source.startswith(pattern[:-1])
               and after.get(pattern) == target
               for pattern, target in retirements.items()):
            covered += 1
        else:
            missing.append(source)
    return sorted(missing), {
        "base_sources": len(before), "current_sources": len(after),
        "exact_preserved": exact, "explicit_retirement_coverage": covered,
        "missing_sources": len(missing),
    }


def emit_rules(repo: Path, output: Path) -> dict[str, tuple[str, ...]]:
    # Separate processes bind _slug and the emitter to this checkout, even if a caller
    # already imported the current version. Never write the checkout's own public tree.
    code = (
        "import sys; from pathlib import Path; "
        "sys.path.insert(0,str(Path(sys.argv[1])/'scripts')); "
        "import regenerate_redirects as r; "
        "r.PUBLIC_DIR=Path(sys.argv[2]); r.OUTPUT=r.PUBLIC_DIR/'_redirects'; r.main()"
    )
    result = subprocess.run([sys.executable, "-B", "-c", code, str(repo), str(output)],
                            cwd=repo, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return parse_rules((output / "_redirects").read_text())


def base_rules(repo: Path, baseline_ref: str) -> dict[str, tuple[str, ...]]:
    ref = subprocess.check_output(
        ["git", "-C", str(repo), "rev-parse", "--verify", baseline_ref + "^{commit}"],
        text=True,
    ).strip()
    with tempfile.TemporaryDirectory(prefix="identity-redirect-base-") as directory:
        snapshot = Path(directory)
        archive = snapshot / "base.tar"
        with archive.open("wb") as handle:
            subprocess.run(["git", "-C", str(repo), "archive", "--format=tar", ref, *SNAPSHOT_PATHS],
                           stdout=handle, check=True)
        with tarfile.open(archive) as handle:
            # These are tracked Git files, not a downloaded archive. Reject links and
            # escaping names explicitly, including on Python versions without filters.
            members = handle.getmembers()
            if any(not (m.isfile() or m.isdir()) or Path(m.name).is_absolute()
                   or ".." in Path(m.name).parts for m in members):
                raise ValueError("Frozen redirect inputs contain an unsafe archive entry")
            handle.extractall(snapshot, members=members)
        return emit_rules(snapshot, snapshot / "emitted")


def source_digest(sources: list[str]) -> str:
    return hashlib.sha256(("\n".join(sources) + "\n").encode()).hexdigest()


def load_baseline(repo: Path) -> tuple[str, dict[str, tuple[str, ...]]]:
    baseline = json.loads((repo / BASELINE_PATH).read_text())
    archive = json.loads((repo / ARCHIVE_PATH).read_text())
    sources = baseline["sources"]
    if baseline["format"] != 1 or baseline["base_commit"] != archive["base_commit"]:
        raise ValueError("Published redirect inventory must name the identity archive's frozen base")
    if not sources or any(not isinstance(s, str) or not s.startswith("/") for s in sources):
        raise ValueError("Published redirect inventory must contain nonempty URL sources")
    if sources != sorted(set(sources)) or baseline["source_count"] != len(sources):
        raise ValueError("Published redirect inventory must be sorted, unique and counted")
    if baseline["sources_sha256"] != source_digest(sources):
        raise ValueError("Published redirect inventory checksum mismatch")
    return baseline["base_commit"], {source: () for source in sources}


def audit(repo: Path, public: Path | None = None, verify_baseline: bool = False):
    archive = json.loads((repo / ARCHIVE_PATH).read_text())
    baseline_ref, before = load_baseline(repo)
    if verify_baseline and set(before) != set(base_rules(repo, baseline_ref)):
        raise ValueError("Recorded redirect sources differ from the frozen base's own emission")
    if public is None:
        with tempfile.TemporaryDirectory(prefix="identity-redirect-current-") as directory:
            after = emit_rules(repo, Path(directory))
    else:
        after = parse_rules((public / "_redirects").read_text())
    explicit = parse_rules("\n".join(retirement_rules(archive["records"], repo)))
    missing, counts = compare_sources(before, after, explicit)
    return {"baseline_ref": baseline_ref, "baseline_reproduced": verify_baseline,
            "mode": "built" if public else "source",
            "counts": counts, "missing": missing}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public", type=Path, help="Check this actual built _redirects instead of source emission")
    parser.add_argument("--verify-baseline", action="store_true",
                        help="Reproduce the tracked source inventory using the frozen base's own emitter")
    args = parser.parse_args()
    result = audit(ROOT, args.public, args.verify_baseline)
    print(json.dumps(result, indent=2))
    for source in result["missing"]:
        print(f"FAIL published redirect source vanished without an emitted retirement: {source}", file=sys.stderr)
    print(f"Published redirect sources: {result['counts']['base_sources']} inspected; "
          f"{result['counts']['missing_sources']} missing.")
    return 1 if result["missing"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
