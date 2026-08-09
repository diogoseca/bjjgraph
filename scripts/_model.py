#!/usr/bin/env python3
"""_model.py — resolve which Claude model an automation script should use.

There is exactly one list of model IDs in this repo: `models.env` at the root.
Every script that calls Claude asks this seam for a TIER (`default` / `deep` /
`fast`) and gets back whatever `models.env` currently maps that tier to. Before
this existed the same ID was pinned in eight scripts and four workflows, so a
model upgrade meant twelve edits and any one of them could be missed — which is
exactly what happened: five scripts sat on `claude-opus-4-8[1m]` long after the
upgrade was "done".

Resolution order (first hit wins):
  1. environment  — BJJ_CLAUDE_MODEL / _DEEP / _FAST / BJJ_CLAUDE_EFFORT
  2. models.env   — the committed default
  3. FALLBACK     — hardcoded here so a deleted models.env degrades instead of crashing

That order is what makes a one-off free: `BJJ_CLAUDE_MODEL=claude-fable-5 npm
run regenerate:json` overrides for one run without touching a tracked file, and
CI can override per-job the same way.

Usage (Python) — same repo-root import style as the other `_`-prefixed seams
(`_votes`, `_slug`, `_ruleset`, `_neural_content`):
    from scripts._model import model as _model_tier, effort as _model_effort
    CLAUDE_MODEL = _model_tier()          # default tier
    CLAUDE_MODEL = _model_tier("deep")    # hardest-reasoning tier
    CLAUDE_EFFORT = _model_effort()

Usage (shell / GitHub Actions):
    --model "$(python3 scripts/_model.py --print default)"
    set -a; . ./models.env; set +a   # then use "$BJJ_CLAUDE_MODEL"

Usage (gate):
    python3 scripts/_model.py --audit   # malformed IDs, or a script that re-pinned one

Stdlib only.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS_ENV = ROOT / "models.env"

# Tier -> (env var, fallback). Fallbacks apply ONLY if models.env is missing or
# missing that key; they are not a second source of truth to keep in sync, they
# are the "don't crash the nightly bot" floor.
TIERS: dict[str, tuple[str, str]] = {
    "default": ("BJJ_CLAUDE_MODEL", "claude-opus-5"),
    "deep": ("BJJ_CLAUDE_MODEL_DEEP", "claude-fable-5"),
    "fast": ("BJJ_CLAUDE_MODEL_FAST", "claude-sonnet-5"),
}
EFFORT_ENV, EFFORT_FALLBACK = "BJJ_CLAUDE_EFFORT", "xhigh"
VALID_EFFORTS = ("low", "medium", "high", "xhigh", "max")

# A well-formed current model ID: family + version, no date suffix. Anthropic's
# IDs are complete as published; appending a date (`claude-opus-5-20260101`) 404s,
# and that is a silent-at-author-time mistake worth failing the audit over.
_ID_RE = re.compile(r"^claude-(opus|sonnet|haiku|fable|mythos)-[0-9]+(-[0-9]+)?(\[1m\])?$")
_DATE_SUFFIX_RE = re.compile(r"-20[0-9]{6}")

_cache: dict[str, str] | None = None


def _load() -> dict[str, str]:
    """Parse models.env once. Tolerant of comments, blanks, quotes, and `export`."""
    global _cache
    if _cache is not None:
        return _cache
    values: dict[str, str] = {}
    if MODELS_ENV.exists():
        for raw in MODELS_ENV.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            if line.startswith("export "):
                line = line[len("export "):]
            key, _, val = line.partition("=")
            values[key.strip()] = val.split("#", 1)[0].strip().strip("'\"")
    _cache = values
    return values


def model(tier: str = "default") -> str:
    """The model ID for `tier`. Unknown tiers fall back to the default tier."""
    env_var, fallback = TIERS.get(tier, TIERS["default"])
    return os.environ.get(env_var) or _load().get(env_var) or fallback


def effort() -> str:
    """Reasoning effort for Claude calls."""
    return os.environ.get(EFFORT_ENV) or _load().get(EFFORT_ENV) or EFFORT_FALLBACK


# =============================================================================
# AUDIT — keeps the single source of truth actually single
# =============================================================================

# Files allowed to contain a literal model ID: this seam (fallbacks), the config
# itself, and docs/provenance that record which model produced a past artifact.
_AUDIT_SKIP_NAMES = {"_model.py", "models.env"}
_AUDIT_SKIP_DIRS = {"node_modules", ".git", "public", "dist", "logs"}


def _audit() -> int:
    problems: list[str] = []
    cfg = _load()

    if not MODELS_ENV.exists():
        problems.append(f"{MODELS_ENV.name} is missing — every caller is silently on its fallback")

    for tier, (env_var, _) in TIERS.items():
        mid = model(tier)
        if not _ID_RE.match(mid):
            problems.append(f"tier '{tier}' ({env_var}) = {mid!r} is not a well-formed model ID")
        elif _DATE_SUFFIX_RE.search(mid):
            problems.append(f"tier '{tier}' ({env_var}) = {mid!r} carries a date suffix — IDs are complete as published")
        if env_var not in cfg and MODELS_ENV.exists():
            problems.append(f"{MODELS_ENV.name} does not define {env_var} — tier '{tier}' is on its fallback")

    eff = effort()
    if eff not in VALID_EFFORTS:
        problems.append(f"{EFFORT_ENV} = {eff!r} is not one of {'|'.join(VALID_EFFORTS)}")

    # Any *other* tracked script pinning an ID means the next upgrade misses it.
    pins: list[str] = []
    for path in sorted(ROOT.glob("scripts/**/*.py")) + sorted(ROOT.glob(".github/workflows/*.y*ml")):
        if path.name in _AUDIT_SKIP_NAMES or set(path.parts) & _AUDIT_SKIP_DIRS:
            continue
        for n, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            if line.lstrip().startswith("#"):
                continue  # a comment naming a model is documentation, not a pin
            for m in re.finditer(r"claude-(?:opus|sonnet|haiku|fable|mythos)-[0-9][^\"'\s,)]*", line):
                pins.append(f"{path.relative_to(ROOT)}:{n}: {m.group(0)}")
    if pins:
        problems.append(
            f"{len(pins)} hardcoded model ID(s) outside {MODELS_ENV.name} — resolve via _model.model() "
            f"or $BJJ_CLAUDE_MODEL instead:\n      " + "\n      ".join(pins[:12])
        )

    if problems:
        print("✗ MODEL CONFIG:")
        for p in problems:
            print("  -", p)
        return 1
    print(
        f"✓ model config single-sourced from {MODELS_ENV.name} — "
        + ", ".join(f"{t}={model(t)}" for t in TIERS)
        + f", effort={eff}"
    )
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description="Resolve the Claude model for automation scripts.")
    ap.add_argument("--print", dest="tier", nargs="?", const="default", metavar="TIER",
                    help="print the model ID for TIER (default|deep|fast)")
    ap.add_argument("--effort", action="store_true", help="print the reasoning effort")
    ap.add_argument("--audit", action="store_true", help="fail if the config is malformed or bypassed")
    args = ap.parse_args()

    if args.audit:
        sys.exit(_audit())
    if args.effort:
        print(effort())
        return
    if args.tier:
        print(model(args.tier))
        return
    for tier in TIERS:
        print(f"{tier}\t{model(tier)}")
    print(f"effort\t{effort()}")


if __name__ == "__main__":
    main()
