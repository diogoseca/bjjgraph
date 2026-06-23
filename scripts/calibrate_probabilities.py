#!/usr/bin/env python3
"""calibrate_probabilities.py — calibrated BJJ probability elicitation (Phase 1 / Thread B).

Estimate, per technique, three quantities that the graph cares about:

  occurrence%   — of all attempts the position-player makes from a role, what
                  fraction is THIS technique (maps to position.role.transitions[].attempt_probability)
  success%      — if attempted in a live, fully-resisting roll, how often it reaches
                  a `success` outcome (maps to the vote-overridden success_rate)
  outcome_dist  — the % split across the technique's EXISTING outcomes[] edges
                  ({to,result}; result ∈ success|failure|counter)

METHODOLOGY (a *prior*, not a crowd — one LLM role-playing N experts produces
CORRELATED errors, so we never treat the panel as independent voters):

  * Expert PANEL of personas (Danaher, Gordon Ryan, Craig Jones, Roger Gracie, a
    BJJ-Fanatics generalist), each elicited in a SEPARATE call, decorrelated by
    distinct voice + reference-class framing + a rotated anchor subset + shuffled
    candidate order.
  * MECHANISM-FIRST (the user's causal model: "transition success = you leverage
    principles AND your opponent fails to leverage their applicable principles;
    everything else is trivia"). Each candidate must name the attacker's leveraged
    principles and the defender's failed-to-leverage principles (from the 59-name
    content/Principles vocabulary) BEFORE emitting any number.
  * HYBRID comparative + anchored: rank candidates best→worst (humans and models
    rank more reliably than they estimate raw %), THEN pin absolutes against
    reference techniques with known success rates.
  * Aggregate IN CODE (transparent): relevance-weighted × inverse-variance mean,
    bootstrap "bagging" for the CI/spread, spread→pseudo-count.

INTEGRATION (decided): success% folds into the existing community-vote loop as the
PRIOR (templates/votes.json), with a confidence-derived pseudo-count, and ONLY for
entries that still sit at the pure seed prior (never clobber real votes). occurrence%
and outcome_dist go to a human-gated proposal file (they have no self-correcting loop).

DRY-RUN by default: elicit → aggregate → self-check → write calibration_results.json
+ calibration_proposals.json. `--apply-votes` folds Sink A into templates/votes.json.

Reuses: scripts/claude_infer.call_claude (model/effort + usage-limit backoff),
scripts/_prob_norm.largest_remainder_round, scripts/_atomic_io.atomic_write_json,
and the regenerate_votes.py Bayesian fold (PRIOR_VOTE_COUNT=30).

Usage:
    # build an input case file from the live graph
    python scripts/calibrate_probabilities.py --build-cases --max-cases 100

    # dry-run elicitation (writes results + proposals, applies nothing)
    python scripts/calibrate_probabilities.py --cases calibration_cases.json

    # fold the calibrated success-rate prior into votes.json (gated on anchor-recovery)
    python scripts/calibrate_probabilities.py --cases calibration_cases.json --apply-votes
"""

from __future__ import annotations

import argparse
import glob
import json
import math
import os
import random
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from claude_infer import call_claude  # shared CLI inference + usage-limit backoff
from _prob_norm import largest_remainder_round  # int distribution summing to 100
from _atomic_io import atomic_write_json  # crash-safe writes

# --------------------------------------------------------------------------- #
# Paths & constants
# --------------------------------------------------------------------------- #
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT_DIR = os.path.join(_REPO_ROOT, "content")
PRINCIPLES_DIR = os.path.join(CONTENT_DIR, "Principles")
VOTES_JSON = os.path.join(_REPO_ROOT, "templates", "votes.json")

DEFAULT_CASES = os.path.join(_REPO_ROOT, "calibration_cases.json")
DEFAULT_RESULTS = os.path.join(_REPO_ROOT, "calibration_results.json")
DEFAULT_PROPOSALS = os.path.join(_REPO_ROOT, "calibration_proposals.json")
DEFAULT_PARTIAL = os.path.join(_REPO_ROOT, "calibration_results.partial.json")

CLAUDE_MODEL = "claude-opus-4-8[1m]"  # matches regenerate_content_json.py:69
CLAUDE_EFFORT = "xhigh"               # matches regenerate_content_json.py:72

PRIOR_VOTE_COUNT = 30  # mirror regenerate_votes.py:27 — the pure-seed sentinel

# spread (pct points of inter-persona disagreement) → pseudo-count (prior strength).
# Tight consensus ⇒ stronger prior; wide split ⇒ weaker. HARD-CAPPED LOW because the 5 personas
# are one correlated LLM (measured r≈0.75 ⇒ ~1.25 effective estimators), so inter-persona spread is
# intra-model jitter, NOT epistemic uncertainty — a tight spread must not buy high Bayesian
# confidence. Cap at 8 (< the 30-vote human seed) so ~8 real votes overturn the model prior, and
# stratify SUBMISSIONS / EXTRAPOLATED / wide-CI entries down to the floor (least-trustworthy).
PC_MAX, PC_MIN = 8, 3
PC_CI_WIDTH_FLOOR = 20.0  # CI wider than this → force PC_MIN (low confidence)
SPREAD_FLOOR, SPREAD_CAP = 3.0, 25.0

BOOTSTRAP_B = 2000
ANCHOR_MAE_GATE = 6.0  # refuse --apply-votes if blind anchor-recovery MAE exceeds this

# Compression de-bias tuning (anchors span [22,70]; the linear inverse extrapolates outside it).
# Adversarial review found the raw inverse overshoots both tails, so we clip tighter and DAMP the
# high side toward the panel's raw estimate, and FLAG out-of-band entries for human review.
DEBIAS_CLIP = (10.0, 82.0)   # was the naive [5,90]; tighter bounds kill the worst tail pins
DEBIAS_BAND = (22.0, 70.0)   # the fitted anchor range; outside it the correction is extrapolation
HIGH_DAMP = 0.5              # for a linear-inverse value > DEBIAS_BAND high, blend toward raw
TRUSTED_OUTPUT = (15.0, 77.0)  # corrected values inside this band auto-apply; outside → human review

# Default reference anchors (well-established consensus success% at ~purple-brown,
# live resistance). Used both as in-prompt absolute pins AND as blind recovery probes.
DEFAULT_ANCHORS = [
    {"technique": "Rear Naked Choke",          "from_position": "Back Control/Top",    "kind": "submission", "success_pct": 70, "note": "highest-percentage finish in the sport"},
    {"technique": "Armbar from Mount",         "from_position": "Mount/Top",           "kind": "transition", "success_pct": 35, "note": "heavily defended at higher belts"},
    {"technique": "Triangle from Closed Guard","from_position": "Closed Guard/Bottom", "kind": "transition", "success_pct": 30, "note": "telegraphed once known"},
    {"technique": "Scissor Sweep",             "from_position": "Closed Guard/Bottom", "kind": "transition", "success_pct": 28, "note": "low completion at higher belts"},
    {"technique": "Berimbolo",                 "from_position": "De La Riva/Bottom",   "kind": "transition", "success_pct": 22, "note": "athletic, low completion under resistance"},
    {"technique": "Straight Ankle Lock",       "from_position": "Ashi Garami/Top",     "kind": "submission", "success_pct": 25, "note": "common entry, often escaped at higher belts"},
]

# --------------------------------------------------------------------------- #
# Expert panel — structured diversity, NOT independent estimators
# --------------------------------------------------------------------------- #
PERSONAS = [
    {
        "id": "danaher",
        "voice": "John Danaher — meticulous systems coach who reasons from mechanism and biomechanics before percentages.",
        "reference_class": "elite no-gi / ADCC-level sample",
        "domains": ["leglock", "back", "strangle"],
    },
    {
        "id": "gordon_ryan",
        "voice": "Gordon Ryan — what actually wins at the absolute top: back control, relentless pressure passing, leg entanglements.",
        "reference_class": "championship no-gi finals",
        "domains": ["back", "pass", "leglock", "pressure"],
    },
    {
        "id": "craig_jones",
        "voice": "Craig Jones — pragmatic modern leg-game; honest that flashy low-percentage moves rarely finish high-level opponents.",
        "reference_class": "competitive no-gi, ADCC-trials level",
        "domains": ["leglock", "guard", "scramble"],
    },
    {
        "id": "roger_gracie",
        "voice": "Roger Gracie — fundamentals and gi pressure: mount, the cross-collar choke, closed guard, methodical passing.",
        "reference_class": "high-level gi / IBJJF black belt",
        "domains": ["mount", "choke", "gi", "pass", "guard"],
    },
    {
        "id": "fanatics_generalist",
        "voice": "A seasoned BJJ-Fanatics instructor giving the broad instructional median — regression-to-the-mean ballast across all areas.",
        "reference_class": "serious hobbyist training 4-5x/week",
        "domains": [],  # uniform; never relevance-boosted
    },
]
PERSONA_BY_ID = {p["id"]: p for p in PERSONAS}

# keyword → technique-family tag, used for relevance weighting.
_FAMILY_KEYWORDS = {
    "leglock": ["heel hook", "ankle", "kneebar", "toe hold", "leg lock", "ashi", "estima", "aoki", "calf", "leg drag"],
    "back": ["back control", "back take", "rear naked", "rnc", "bow and arrow", "back mount"],
    "strangle": ["choke", "strangle", "guillotine", "ezekiel", "arm triangle", "darce", "d'arce", "anaconda", "clock"],
    "choke": ["choke", "strangle", "collar", "ezekiel", "guillotine"],
    "mount": ["mount", "americana", "cross collar"],
    "pass": ["pass", "guard pass", "knee cut", "knee slice", "torreando", "leg drag", "stack pass", "smash pass"],
    "guard": ["guard", "sweep", "retention", "berimbolo", "de la riva", "spider", "lasso", "x guard"],
    "pressure": ["pressure", "smash", "knee on belly", "crossface"],
    "scramble": ["scramble", "wrestle", "single leg", "double leg", "takedown"],
    "gi": ["collar", "sleeve", "lapel", "spider", "worm guard", "ezekiel"],
}

# relevance multipliers per persona-domain match (base 1.0; generalist pinned).
_RELEVANCE_BOOST = 1.4
_GENERALIST_WEIGHT = 0.8


def _families_for(name: str, tags) -> set:
    """Family tags a technique belongs to, from its name + tags (lowercased keyword match)."""
    hay = (name or "").lower()
    if tags:
        hay += " " + " ".join(str(t).lower() for t in tags)
    fams = set()
    for fam, kws in _FAMILY_KEYWORDS.items():
        if any(kw in hay for kw in kws):
            fams.add(fam)
    return fams


def relevance_weight(persona_id: str, cand_meta: dict) -> float:
    """Persona's domain-relevance multiplier for a candidate technique."""
    if persona_id == "fanatics_generalist":
        return _GENERALIST_WEIGHT
    persona = PERSONA_BY_ID[persona_id]
    fams = _families_for(cand_meta.get("technique", ""), cand_meta.get("tags"))
    return _RELEVANCE_BOOST if (fams & set(persona["domains"])) else 1.0


# --------------------------------------------------------------------------- #
# Reuse: JSON extraction (copied from regenerate_content_json.py:1271-1302)
# --------------------------------------------------------------------------- #
def extract_json_from_response(response: str):
    """Extract a JSON object from Claude's response (direct → fenced → first{..last})."""
    try:
        return json.loads(response), None
    except Exception:
        pass
    for pattern in (r"```json\s*([\s\S]*?)\s*```", r"```\s*([\s\S]*?)\s*```"):
        for match in re.findall(pattern, response):
            try:
                return json.loads(match), None
            except Exception:
                continue
    try:
        start = response.find("{")
        end = response.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(response[start:end]), None
    except Exception:
        pass
    return None, "Could not extract valid JSON from response"


# --------------------------------------------------------------------------- #
# Content indexing & input-case construction
# --------------------------------------------------------------------------- #
def load_principles() -> list:
    """The 59-name controlled principle vocabulary (single source of truth)."""
    names = []
    for path in sorted(glob.glob(os.path.join(PRINCIPLES_DIR, "*.json"))):
        try:
            with open(path, encoding="utf-8") as fh:
                d = json.load(fh)
            n = d.get("name") or os.path.basename(path)[:-5]
            names.append(n)
        except (json.JSONDecodeError, OSError):
            names.append(os.path.basename(path)[:-5])
    return names


def build_technique_index() -> dict:
    """name → {kind, from_position, outcomes, success_rate, tags, path}. Skips family hubs
    and schema files; non-family techniques only (those with real outcomes[])."""
    index = {}
    for kind, sub in (("transition", "Transitions"), ("submission", "Submissions")):
        for path in glob.glob(os.path.join(CONTENT_DIR, sub, "**", "*.json"), recursive=True):
            if "TEMPLATE" in os.path.basename(path).upper():
                continue
            try:
                with open(path, encoding="utf-8") as fh:
                    d = json.load(fh)
            except (json.JSONDecodeError, OSError):
                continue
            if not isinstance(d, dict) or "name" not in d or d.get("is_family"):
                continue
            if "$schema" in d and "properties" in d:
                continue
            index[d["name"]] = {
                "kind": kind,
                "from_position": d.get("from_position"),
                "outcomes": d.get("outcomes") or [],
                "success_rate": d.get("success_rate"),
                "tags": d.get("tags") or [],
                "path": path,
            }
    return index


def _skeleton(outcomes: list) -> list:
    """The fixed {to,result} edge skeleton the model must distribute over (no probabilities)."""
    return [{"to": o["to"], "result": o.get("result", "success")} for o in outcomes if o.get("to")]


def build_cases_from_content(max_cases: int, max_candidates: int) -> dict:
    """Derive calibration cases from the live graph: one case per position role, candidates =
    that role's transitions[] resolved to technique files (so the {to,result} skeleton matches
    existing edges and we never invent/drop graph edges)."""
    index = build_technique_index()
    cases = []
    pos_paths = sorted(glob.glob(os.path.join(CONTENT_DIR, "Positions", "*.json")))
    for path in pos_paths:
        try:
            with open(path, encoding="utf-8") as fh:
                d = json.load(fh)
        except (json.JSONDecodeError, OSError):
            continue
        pos_name = d.get("name") or os.path.basename(path)[:-5]
        for role in ("top", "bottom", "single"):
            rd = d.get(role)
            if not isinstance(rd, dict):
                continue
            trans = rd.get("transitions") or []
            if not trans:
                continue
            universe = [t.get("transition") for t in trans if t.get("transition")]
            # candidates we can resolve to a real outcomes skeleton, richest attempt first
            ranked = sorted(trans, key=lambda t: t.get("attempt_probability", 0), reverse=True)
            candidates = []
            for t in ranked:
                tname = t.get("transition")
                meta = index.get(tname)
                if not meta or not meta["outcomes"]:
                    continue  # position→position transitions without a file/outcomes: skip
                candidates.append({
                    "technique": tname,
                    "kind": meta["kind"],
                    "tags": meta["tags"],
                    "current_attempt_probability": t.get("attempt_probability"),
                    "current_success_rate": meta["success_rate"],
                    "candidate_outcomes": _skeleton(meta["outcomes"]),
                })
                if len(candidates) >= max_candidates:
                    break
            if len(candidates) < 2:
                continue  # need a comparative set
            role_label = role.capitalize() if role != "single" else "Single"
            cases.append({
                "case_id": f"{pos_name}/{role_label}".lower().replace(" ", "-"),
                "from_position": f"{pos_name}/{role_label}",
                "role": role,
                "skill_level": "purple-brown",
                "candidates": candidates,
                "occurrence_universe": universe,
            })
            if len(cases) >= max_cases:
                break
        if len(cases) >= max_cases:
            break
    return {
        "schema_version": 1,
        "skill_level": "purple-brown",
        "reference_anchors": DEFAULT_ANCHORS,
        "cases": cases,
    }


# --------------------------------------------------------------------------- #
# Anchor-probe cases (blind recovery test)
# --------------------------------------------------------------------------- #
def make_anchor_probe_cases(anchors: list) -> list:
    """One probe case per anchor (the anchor as a lone candidate). Tagged is_anchor_probe so
    aggregation can compare elicited success% to the known value. Skeleton is synthetic — these
    are never written to the graph, only used to measure calibration."""
    probes = []
    for a in anchors:
        kind = a.get("kind", "transition")
        frm = a.get("from_position", "Unknown/Top")
        skel = a.get("candidate_outcomes")
        if not skel:
            if kind == "submission":
                skel = [{"to": "game-over", "result": "success"},
                        {"to": frm, "result": "failure"},
                        {"to": "Open Guard/Bottom", "result": "counter"}]
            else:
                skel = [{"to": "Better Position", "result": "success"},
                        {"to": frm, "result": "failure"},
                        {"to": "Worse Position", "result": "counter"}]
        probes.append({
            "case_id": f"anchor-probe::{a['technique']}",
            "from_position": frm,
            "role": "top",
            "skill_level": "purple-brown",
            "is_anchor_probe": True,
            "probe_technique": a["technique"],
            "candidates": [{
                "technique": a["technique"],
                "kind": kind,
                "tags": [],
                "candidate_outcomes": skel,
            }],
            "occurrence_universe": [a["technique"]],
        })
    return probes


# --------------------------------------------------------------------------- #
# Prompt + response schema (one call per persona per chunk)
# --------------------------------------------------------------------------- #
def persona_response_schema() -> dict:
    """Wrapped in `fixed_content` so the appended _OUTPUT_CONTRACT (which names `fixed_content`)
    stays consistent with our schema rather than fighting it."""
    candidate = {
        "type": "object",
        "required": ["technique", "mechanism", "attacker_principles", "defender_principles",
                     "occurrence_pct", "success_pct", "outcome_dist", "confidence"],
        "properties": {
            "technique": {"type": "string"},
            "mechanism": {"type": "string"},
            "attacker_principles": {"type": "array", "items": {"type": "string"}},
            "defender_principles": {"type": "array", "items": {"type": "string"}},
            "occurrence_pct": {"type": "integer", "minimum": 0, "maximum": 100},
            "success_pct": {"type": "integer", "minimum": 0, "maximum": 100},
            "outcome_dist": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["to", "result", "probability"],
                    "properties": {
                        "to": {"type": "string"},
                        "result": {"type": "string", "enum": ["success", "failure", "counter"]},
                        "probability": {"type": "integer", "minimum": 0, "maximum": 100},
                    },
                },
            },
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        },
    }
    return {
        "type": "object",
        "required": ["fixed_content"],
        "properties": {
            "fixed_content": {
                "type": "object",
                "required": ["persona", "case_estimates"],
                "properties": {
                    "persona": {"type": "string"},
                    "case_estimates": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": ["case_id", "ranking", "candidates"],
                            "properties": {
                                "case_id": {"type": "string"},
                                "ranking": {"type": "array", "items": {"type": "string"}},
                                "candidates": {"type": "array", "items": candidate},
                            },
                        },
                    },
                },
            }
        },
    }


_FEWSHOT = (
    "Few-shot outcome shapes (state-machine modeling, from the content standard §2b):\n"
    "- Type A direct submission: \"Americana from Mount\" → game-over 55, Mount 30, Half Guard 15\n"
    "- Type B submission setup:  \"Armbar from Mount\" → Armbar Control 55, Mount 30, Closed Guard 15\n"
    "- Type C positional tool:   \"Kimura Trap from Bottom\" → Kimura Trap 60, Mount/Bottom 25, Half Guard 15\n"
)


def build_persona_prompt(persona: dict, cases_chunk: list, anchor_refs: list,
                         principle_vocab: list, skill_level: str) -> str:
    """Comparative + anchored + mechanism-first prompt for one persona over a chunk of cases."""
    refs = "\n".join(
        f"  - {a['technique']} (from {a.get('from_position','?')}): success ≈ {a['success_pct']}%"
        + (f"  [{a['note']}]" if a.get("note") else "")
        for a in anchor_refs
    ) or "  (none this round — estimate on absolute terms)"

    # compact case payload: only what the model needs (technique + fixed {to,result} skeleton)
    payload = []
    for c in cases_chunk:
        payload.append({
            "case_id": c["case_id"],
            "from_position": c["from_position"],
            "role": c["role"],
            "candidates": [
                {"technique": cand["technique"], "kind": cand.get("kind", "transition"),
                 "candidate_outcomes": cand["candidate_outcomes"]}
                for cand in c["candidates"]
            ],
            "occurrence_universe": c.get("occurrence_universe", []),
        })

    return f"""You are {persona['voice']}

You are estimating how Brazilian Jiu-Jitsu techniques perform for {skill_level} practitioners in LIVE, fully-resisting rolling and competition. Reference class: {persona['reference_class']}.

## The causal model you MUST reason from (this is the whole game; everything else is trivia)
A transition or submission SUCCEEDS when the ATTACKER leverages the right principles AND the DEFENDER fails to leverage their applicable principles. So for every candidate, decide success on the basis of WHICH principles each side must apply, then how often the defender actually applies theirs at this level.

Use ONLY these principle names (verbatim) for attacker_principles / defender_principles:
{", ".join(principle_vocab)}

## How to reason — MANDATORY ORDER, per case
1. MECHANISM FIRST. For each candidate fill `mechanism` (one or two sentences), `attacker_principles` (what the attacker leverages to win), and `defender_principles` (the defender's applicable principles whose ABSENCE/failure is what lets it land). Do this BEFORE any number.
2. RANK the candidates in the case best→worst by success (`ranking`, a list of technique names). Commit to the order first — you rank more reliably than you estimate raw %.
3. ANCHOR to absolutes. These reference techniques have approximately-known success rates at this level — make every estimate consistent with them:
{refs}
   (A technique you ranked above an anchor must exceed that anchor's %; below it, must be under.)
4. EMIT, per candidate:
   - occurrence_pct: of all attempts the {{role}} player makes from this position, the share that is THIS technique (candidates compete; they need not sum to 100 because the full attempt universe is larger).
   - success_pct: if attempted, how often it reaches a `success` outcome. Must respect your ranking AND the anchors.
   - outcome_dist: distribute 100 across EXACTLY the provided (to,result) pairs — do NOT add, drop, rename, or reorder any pair. The `success`-result probabilities should sum to your success_pct.
   - confidence ∈ [0,1]: your certainty for THIS technique (lower for thin evidence / high-variance moves).

{_FEWSHOT}
## Cases
{json.dumps(payload, indent=2, ensure_ascii=False)}

## OUTPUT
Return JSON only, shape:
{{"fixed_content": {{"persona": "{persona['id']}", "case_estimates": [ {{"case_id": "...", "ranking": ["..."], "candidates": [ {{"technique": "...", "mechanism": "...", "attacker_principles": ["..."], "defender_principles": ["..."], "occurrence_pct": 0, "success_pct": 0, "outcome_dist": [{{"to":"...","result":"success","probability":0}}], "confidence": 0.0}} ]}} ]}}}}"""


# --------------------------------------------------------------------------- #
# Response validation / coercion
# --------------------------------------------------------------------------- #
def coerce_outcome_dist(returned: list, skeleton: list):
    """Force the model's outcome_dist onto the fixed skeleton: drop invented edges, fill
    missing with 0, renormalize to sum 100 (largest-remainder). Returns (dist, derived_success)."""
    by_key = {}
    for o in returned or []:
        if isinstance(o, dict) and o.get("to") is not None:
            by_key[(o["to"], o.get("result", "success"))] = max(0.0, float(o.get("probability", 0) or 0))
    raw = [by_key.get((s["to"], s["result"]), 0.0) for s in skeleton]
    ints = largest_remainder_round(raw, 100)
    dist = [{"to": s["to"], "result": s["result"], "probability": ints[i]} for i, s in enumerate(skeleton)]
    derived_success = sum(d["probability"] for d in dist if d["result"] == "success")
    return dist, derived_success


def validate_principles(names: list, vocab: set) -> list:
    """Keep only in-vocabulary principle names (drop hallucinations silently; warned in summary)."""
    return [n for n in (names or []) if n in vocab]


# --------------------------------------------------------------------------- #
# Elicitation (chunked, resumable)
# --------------------------------------------------------------------------- #
def _chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def anchor_refs_for_chunk(chunk: list, anchors: list) -> list:
    """References to show this chunk: all anchors EXCEPT any technique being estimated in it
    (prevents leakage — a technique must never see its own anchor value as a reference, whether
    it is a blind anchor-probe or just happens to be a candidate that is also an anchor)."""
    exclude = {c.get("probe_technique") for c in chunk if c.get("is_anchor_probe")}
    exclude |= {cand.get("technique") for c in chunk for cand in c.get("candidates", [])}
    return [a for a in anchors if a["technique"] not in exclude]


def elicit_persona(persona, cases, anchors, principle_vocab, skill_level,
                   chunk_size, model, effort, partial, log, dry_run_label=""):
    """Elicit one persona across all cases. Returns {case_id: {technique: estimate}}.
    Resumable via `partial` (already-done case_ids for this persona are skipped)."""
    vocab = set(principle_vocab)
    pid = persona["id"]
    done = partial.setdefault(pid, {})
    # decorrelate: per-persona deterministic shuffle of case order + candidate order
    rng = random.Random(hash(pid) & 0xFFFFFFFF)
    ordered = list(cases)
    rng.shuffle(ordered)
    pending = [c for c in ordered if c["case_id"] not in done]
    if not pending:
        log(f"  [{pid}] all {len(cases)} cases already elicited (resumed)")
        return done

    # Build chunks. Anchor probes are chunked SEPARATELY and split into two halves so each
    # probe is pinned against the complementary anchors (never a chunk where every anchor is
    # probed → empty references). Regular cases chunk normally and always see all anchors.
    regular = [c for c in pending if not c.get("is_anchor_probe")]
    probes = [c for c in pending if c.get("is_anchor_probe")]
    build_chunks = list(_chunks(regular, chunk_size))
    if len(probes) <= 1:
        build_chunks += [probes] if probes else []
    else:
        mid = (len(probes) + 1) // 2
        build_chunks += [probes[:mid], probes[mid:]]

    for chunk in build_chunks:
        # shuffle candidate order within each case for this persona
        chunk_shuf = []
        for c in chunk:
            cc = dict(c)
            cands = list(c["candidates"])
            rng.shuffle(cands)
            cc["candidates"] = cands
            chunk_shuf.append(cc)
        refs = anchor_refs_for_chunk(chunk_shuf, anchors)
        prompt = build_persona_prompt(persona, chunk_shuf, refs, principle_vocab, skill_level)
        ids = [c["case_id"] for c in chunk_shuf]
        log(f"  [{pid}] eliciting {len(ids)} case(s){dry_run_label}: {', '.join(ids)[:120]}")

        raw, err = call_claude(prompt, persona_response_schema(), model, effort, log=log)
        if err or not raw:
            log(f"  [{pid}] ERROR: {err or 'empty response'} — skipping this chunk")
            continue
        parsed, perr = extract_json_from_response(raw)
        if perr or not isinstance(parsed, dict):
            log(f"  [{pid}] parse error: {perr} — skipping this chunk")
            continue
        fc = parsed.get("fixed_content", parsed)
        estimates = fc.get("case_estimates", []) if isinstance(fc, dict) else []

        skel_by = {(c["case_id"], cand["technique"]): cand["candidate_outcomes"]
                   for c in chunk_shuf for cand in c["candidates"]}
        got = set()
        for est in estimates:
            cid = est.get("case_id")
            if cid not in ids:
                continue
            case_out = {}
            for cand in est.get("candidates", []):
                tech = cand.get("technique")
                skel = skel_by.get((cid, tech))
                if not skel:
                    continue  # invented technique → ignore
                dist, derived = coerce_outcome_dist(cand.get("outcome_dist"), skel)
                case_out[tech] = {
                    "occurrence_pct": int(max(0, min(100, cand.get("occurrence_pct", 0) or 0))),
                    "success_pct": int(max(0, min(100, cand.get("success_pct", 0) or 0))),
                    "outcome_dist": dist,
                    "derived_success_pct": derived,
                    "confidence": float(max(0.0, min(1.0, cand.get("confidence", 0.5) or 0.5))),
                    "attacker_principles": validate_principles(cand.get("attacker_principles"), vocab),
                    "defender_principles": validate_principles(cand.get("defender_principles"), vocab),
                    "mechanism": (cand.get("mechanism") or "").strip(),
                    "ranking": est.get("ranking", []),
                }
            if case_out:
                done[cid] = case_out
                got.add(cid)
        missing = set(ids) - got
        if missing:
            log(f"  [{pid}] WARNING: {len(missing)} case(s) missing from response: {', '.join(sorted(missing))[:120]}")
        atomic_write_json(DEFAULT_PARTIAL, partial)  # persist after each chunk (resume-safe)
    return done


# --------------------------------------------------------------------------- #
# Aggregation (in code)
# --------------------------------------------------------------------------- #
def _weighted_mean_std(values, weights):
    tot = sum(weights)
    if tot <= 0:
        return (sum(values) / len(values) if values else 0.0), 0.0
    mean = sum(v * w for v, w in zip(values, weights)) / tot
    var = sum(w * (v - mean) ** 2 for v, w in zip(values, weights)) / tot
    return mean, math.sqrt(max(0.0, var))


def _bootstrap_ci(values, weights, b, rng):
    """Weighted bootstrap of the mean → (lo, hi, se). Resample personas ∝ weight."""
    n = len(values)
    if n == 0:
        return 0.0, 0.0, 0.0
    if n == 1:
        return values[0], values[0], 0.0
    tot = sum(weights) or 1.0
    cum, acc = [], 0.0
    for w in weights:
        acc += w / tot
        cum.append(acc)
    means = []
    for _ in range(b):
        s = 0.0
        for _ in range(n):
            r = rng.random()
            idx = next((i for i, c in enumerate(cum) if r <= c), n - 1)
            s += values[idx]
        means.append(s / n)
    means.sort()
    lo = means[int(0.025 * (b - 1))]
    hi = means[int(0.975 * (b - 1))]
    mu = sum(means) / len(means)
    se = math.sqrt(sum((m - mu) ** 2 for m in means) / len(means))
    return round(lo, 1), round(hi, 1), round(se, 2)


def spread_to_pseudo_count(spread: float) -> int:
    t = (spread - SPREAD_FLOOR) / (SPREAD_CAP - SPREAD_FLOOR)
    t = max(0.0, min(1.0, t))
    return int(round(PC_MAX - t * (PC_MAX - PC_MIN)))


def aggregate_candidate(per_persona: dict, cand_meta: dict, skeleton: list, rng):
    """Combine personas for one (case, candidate) → calibrated estimate.
    per_persona: {persona_id: estimate-dict}."""
    pids = list(per_persona.keys())
    succ = [per_persona[p]["success_pct"] for p in pids]
    occ = [per_persona[p]["occurrence_pct"] for p in pids]
    conf = [per_persona[p]["confidence"] for p in pids]
    relw = [relevance_weight(p, cand_meta) for p in pids]
    # inverse-variance via confidence (clamped), times relevance
    weights = []
    for c, r in zip(conf, relw):
        cc = max(0.05, min(0.95, c))
        weights.append(r * (cc / (1.0 - cc)))

    succ_mean, succ_std = _weighted_mean_std(succ, weights)
    occ_mean, _ = _weighted_mean_std(occ, weights)
    lo, hi, se = _bootstrap_ci(succ, weights, BOOTSTRAP_B, rng)

    # weighted-mean each outcome cell, then renormalize to 100
    cell_means = []
    for i in range(len(skeleton)):
        cell_vals = [per_persona[p]["outcome_dist"][i]["probability"] for p in pids]
        m, _ = _weighted_mean_std(cell_vals, weights)
        cell_means.append(m)
    ints = largest_remainder_round(cell_means, 100)
    outcome_dist = [{"to": s["to"], "result": s["result"], "probability": ints[i]}
                    for i, s in enumerate(skeleton)]
    agg_success = sum(d["probability"] for d in outcome_dist if d["result"] == "success")

    return {
        "success_pct": int(round(succ_mean)),
        "success_from_outcomes": agg_success,
        "occurrence_pct": int(round(occ_mean)),
        "success_spread": round(succ_std, 2),
        "success_ci": [lo, hi],
        "bootstrap_se": se,
        "pseudo_count": spread_to_pseudo_count(succ_std),
        "outcome_dist": outcome_dist,
        "n_personas": len(pids),
        "relevance_weights": {p: round(w, 3) for p, w in zip(pids, weights)},
    }


def aggregate_all(cases, per_persona_results, rng):
    """Build the full results structure: per case, per candidate → personas + aggregated."""
    # index candidate metadata + skeleton by (case_id, technique)
    meta_by, skel_by = {}, {}
    for c in cases:
        for cand in c["candidates"]:
            meta_by[(c["case_id"], cand["technique"])] = cand
            skel_by[(c["case_id"], cand["technique"])] = cand["candidate_outcomes"]

    out_cases = []
    for c in cases:
        cands_out = []
        for cand in c["candidates"]:
            cid, tech = c["case_id"], cand["technique"]
            personas = {}
            for pid, pres in per_persona_results.items():
                est = pres.get(cid, {}).get(tech)
                if est:
                    personas[pid] = est
            if not personas:
                continue
            agg = aggregate_candidate(personas, cand, skel_by[(cid, tech)], rng)
            cands_out.append({
                "technique": tech,
                "kind": cand.get("kind", "transition"),
                "personas": personas,
                "aggregated": agg,
            })
        if cands_out:
            out_cases.append({
                "case_id": c["case_id"],
                "from_position": c.get("from_position"),
                "role": c.get("role"),
                "is_anchor_probe": c.get("is_anchor_probe", False),
                "probe_technique": c.get("probe_technique"),
                "candidates": cands_out,
            })
    return out_cases


# --------------------------------------------------------------------------- #
# Anchor-recovery self-check
# --------------------------------------------------------------------------- #
def anchor_recovery(out_cases, anchors):
    """Compare blind-elicited anchor success% to known values → per-anchor + pooled + per-band MAE.

    The pooled MAE can hide a central-tendency compression bias: a single LLM backbone pulls
    high-% techniques DOWN and low-% UP, so opposite-signed tail errors cancel to a small pooled
    mean. We therefore also report low/mid/high band MAEs and the signed errors + (expected,
    elicited) points used to fit the de-bias transform."""
    known = {a["technique"]: a["success_pct"] for a in anchors}
    rows, errs, pts = {}, [], []
    bands = {"low": [], "mid": [], "high": []}
    for c in out_cases:
        if not c.get("is_anchor_probe"):
            continue
        tech = c.get("probe_technique")
        if tech not in known or not c["candidates"]:
            continue
        exp = known[tech]
        elicited = c["candidates"][0]["aggregated"]["success_pct"]
        err = abs(elicited - exp)
        rows[tech] = {"expected": exp, "elicited_mean": elicited, "abs_err": err, "signed_err": elicited - exp}
        errs.append(err)
        pts.append((exp, elicited))
        band = "low" if exp < 30 else ("high" if exp > 50 else "mid")
        bands[band].append(err)
    mae = round(sum(errs) / len(errs), 2) if errs else None
    band_mae = {k: (round(sum(v) / len(v), 2) if v else None) for k, v in bands.items()}
    return {"per_anchor": rows, "mae": mae, "band_mae": band_mae, "n": len(errs), "points": pts,
            "pass": (mae is not None and mae <= ANCHOR_MAE_GATE)}


# --------------------------------------------------------------------------- #
# Compression de-bias (single-LLM central-tendency correction)
# --------------------------------------------------------------------------- #
def fit_compression(points: list):
    """Least-squares fit elicited = a*expected + b over the anchor points. Returns the fit
    (a,b,r,n,fixed_point) or None if too few points / degenerate. a<1 ⇒ compression toward a
    central value (the fixed point b/(1-a)); the inverse true=(elicited-b)/a de-compresses it."""
    n = len(points)
    if n < 4:
        return None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    syy = sum((y - my) ** 2 for y in ys)
    if sxx <= 0:
        return None
    a = sxy / sxx
    b = my - a * mx
    r = (sxy / math.sqrt(sxx * syy)) if syy > 0 else 0.0
    fixed = (b / (1 - a)) if abs(1 - a) > 1e-6 else None
    return {"a": round(a, 4), "b": round(b, 4), "r": round(r, 4), "n": n,
            "fixed_point": round(fixed, 2) if fixed is not None else None}


def loao_mae(points: list):
    """Leave-One-Anchor-Out MAE: for each anchor, refit the de-bias on the OTHER anchors and
    measure how well it recovers the held-out one. This is the NON-circular gate (the in-sample
    MAE is near-tautological because the fit is validated on the same points it was fit on).
    LOAO on the lone high anchor (RNC) deliberately exposes the unconstrained high-tail slope."""
    n = len(points)
    if n < 5:  # need ≥4 to refit after holding one out
        return None
    errs = []
    for i in range(n):
        rest = [points[j] for j in range(n) if j != i]
        f = fit_compression(rest)
        if not f:
            continue
        exp_i, elic_i = points[i]
        errs.append(abs(debias_value(elic_i, f) - exp_i))
    return round(sum(errs) / len(errs), 2) if errs else None


def debias_value(s: float, fit: dict) -> float:
    """Invert the compression: true = (elicited - b)/a. Outside the fitted band this extrapolates,
    so DAMP the high side toward the raw estimate (review found the linear inverse inflates already-
    high values past the data), then clip to DEBIAS_CLIP. The low tail is left to the clip + the
    out-of-band human-review flag (a blanket low damp would wrongly lift genuine-low techniques)."""
    a = fit["a"]
    if a <= 0:
        return s
    d = (s - fit["b"]) / a
    if d > DEBIAS_BAND[1]:
        d = s + HIGH_DAMP * (d - s)  # blend toward raw for out-of-band-high extrapolation
    return max(DEBIAS_CLIP[0], min(DEBIAS_CLIP[1], d))


def is_extrapolated(corrected_success: float) -> bool:
    """True when the CORRECTED success lands outside the trusted output band [15,77] — i.e. the
    de-bias extrapolated past where the 6 anchors constrain the slope (review found these tails
    unreliable: high-side overshoot + band-floor/genuine lows). Such entries are held for human
    review before auto-applying to votes.json (the confident mid-band auto-applies)."""
    return not (TRUSTED_OUTPUT[0] <= corrected_success <= TRUSTED_OUTPUT[1])


def rescale_dist_to_success(dist: list, new_succ: int) -> list:
    """Rebuild an outcome distribution so its success-result cells sum to new_succ and the rest
    to 100-new_succ, preserving relative proportions within each group; renormalize to 100."""
    succ = [d for d in dist if d["result"] == "success"]
    other = [d for d in dist if d["result"] != "success"]
    old_s = sum(d["probability"] for d in succ)
    old_o = sum(d["probability"] for d in other)
    tgt_o = 100 - new_succ
    vals = []
    for d in dist:
        if d["result"] == "success":
            share = (d["probability"] / old_s) if old_s > 0 else (1.0 / len(succ) if succ else 0.0)
            vals.append(new_succ * share)
        else:
            share = (d["probability"] / old_o) if old_o > 0 else (1.0 / len(other) if other else 0.0)
            vals.append(tgt_o * share)
    ints = largest_remainder_round(vals, 100)
    return [{**d, "probability": ints[i]} for i, d in enumerate(dist)]


def apply_debias(out_cases, fit, log):
    """De-compress every NON-anchor candidate's success% using the anchor-derived fit. Stashes the
    raw values under aggregated['pre_debias']. Anchors are left untouched (they DEFINE the fit).
    Spread is widened by 1/a (decompression) → weaker, more honest pseudo-count."""
    a = fit["a"]
    n = 0
    for c in out_cases:
        if c.get("is_anchor_probe"):
            continue
        for cand in c["candidates"]:
            agg = cand["aggregated"]
            raw_s = agg["success_pct"]
            has_succ = any(d["result"] == "success" for d in agg["outcome_dist"])
            new_s = 0 if (not has_succ or raw_s <= 0) else int(round(debias_value(raw_s, fit)))
            new_spread = round(agg["success_spread"] / a, 2) if a > 0 else agg["success_spread"]
            agg["pre_debias"] = {
                "success_pct": raw_s, "success_spread": agg["success_spread"],
                "success_ci": agg["success_ci"], "pseudo_count": agg["pseudo_count"],
                "outcome_dist": agg["outcome_dist"],
            }
            agg["outcome_dist"] = rescale_dist_to_success(agg["outcome_dist"], new_s)
            agg["success_pct"] = new_s
            agg["success_from_outcomes"] = sum(d["probability"] for d in agg["outcome_dist"] if d["result"] == "success")
            ci = agg["pre_debias"]["success_ci"]
            agg["success_ci"] = ([round(debias_value(ci[0], fit), 1), round(debias_value(ci[1], fit), 1)]
                                 if has_succ else [0, 0])
            agg["success_spread"] = new_spread
            agg["pseudo_count"] = spread_to_pseudo_count(new_spread)
            agg["extrapolated"] = is_extrapolated(new_s)  # out-of-band output → human review before apply
            n += 1
    n_ext = sum(1 for c in out_cases if not c.get("is_anchor_probe")
                for cand in c["candidates"] if cand["aggregated"].get("extrapolated"))
    log(f"  de-bias applied to {n} non-anchor candidate(s): true=(elicited-{fit['b']})/{fit['a']} "
        f"(fixed point {fit['fixed_point']}, r={fit['r']}, n={fit['n']}); {n_ext} out-of-band flagged for review")
    return n


def stratify_pseudo_counts(out_cases, log):
    """Force the LEAST-trustworthy classes to the pseudo-count floor: SUBMISSIONS (their high tail
    is extrapolated from the single RNC anchor), EXTRAPOLATED entries (out-of-band), and any entry
    whose success CI is wider than PC_CI_WIDTH_FLOOR. De-correlates prior STRENGTH from inter-persona
    CONSENSUS (the failure the raw spread→pc path commits: tight consensus around a maybe-wrong mean
    must not buy high confidence)."""
    n = 0
    for c in out_cases:
        if c.get("is_anchor_probe"):
            continue
        for cand in c["candidates"]:
            agg = cand["aggregated"]
            ci = agg.get("success_ci") or [0, 0]
            ci_w = (ci[1] - ci[0]) if len(ci) == 2 else 0
            if (cand.get("kind") == "submission" or agg.get("extrapolated") or ci_w > PC_CI_WIDTH_FLOOR) \
                    and agg.get("pseudo_count", PC_MIN) > PC_MIN:
                agg["pseudo_count"] = PC_MIN
                n += 1
    log(f"  stratified {n} entry(ies) to pseudo-count floor (submission / extrapolated / wide-CI)")
    return n


# --------------------------------------------------------------------------- #
# Sinks
# --------------------------------------------------------------------------- #
def apply_calibrated_priors(votes_data: dict, out_cases, only_seed=True, skip_extrapolated=True):
    """Sink A: fold success% into votes.json as the PRIOR. For entries still at the pure
    seed (vote_count == PRIOR_VOTE_COUNT), set success_rate = calibrated success%, vote_count
    = pseudo_count. Never clobber entries with real votes. By default also HOLDS out-of-band
    (extrapolated) entries for human review. Returns (votes_data, applied, skipped)."""
    votes = votes_data.setdefault("votes", {})
    applied, skipped = 0, []
    # best (tightest) estimate per technique name across cases
    best = {}
    for c in out_cases:
        if c.get("is_anchor_probe"):
            continue
        for cand in c["candidates"]:
            agg = cand["aggregated"]
            cur = best.get(cand["technique"])
            if cur is None or agg["success_spread"] < cur["success_spread"]:
                best[cand["technique"]] = agg
    for tech, agg in best.items():
        entry = votes.get(tech)
        if entry is None:
            skipped.append((tech, "not-in-votes"))
            continue
        if only_seed and entry.get("vote_count") != PRIOR_VOTE_COUNT:
            skipped.append((tech, "has-real-votes"))
            continue
        if skip_extrapolated and agg.get("extrapolated"):
            skipped.append((tech, "extrapolated-needs-review"))
            continue
        entry["success_rate"] = round(float(agg["success_pct"]), 2)
        entry["vote_count"] = int(agg["pseudo_count"])
        applied += 1
    return votes_data, applied, skipped


def emit_content_proposals(out_cases, index):
    """Sink B: occurrence% + outcome_dist as a HUMAN-GATED proposal (never auto-written)."""
    proposals = {}
    for c in out_cases:
        if c.get("is_anchor_probe"):
            continue
        for cand in c["candidates"]:
            tech = cand["technique"]
            agg = cand["aggregated"]
            meta = index.get(tech, {})
            proposals.setdefault(tech, {
                "kind": cand.get("kind"),
                "from_position": meta.get("from_position"),
                "current": {"outcomes": meta.get("outcomes"), "success_rate": meta.get("success_rate")},
                "proposed": {
                    "success_rate": agg["success_pct"],
                    "outcome_dist": agg["outcome_dist"],
                },
                "raw_panel_success_rate": agg.get("pre_debias", {}).get("success_pct"),
                "occurrence_by_position": {},
                "spread": agg["success_spread"],
                "success_ci": agg["success_ci"],
                "pseudo_count": agg["pseudo_count"],
                "needs_human_review": bool(agg.get("extrapolated")),
            })
            proposals[tech]["occurrence_by_position"][c["from_position"]] = agg["occurrence_pct"]
    return proposals


# --------------------------------------------------------------------------- #
# Re-aggregation input (rebuild cases + per-persona results from a results file)
# --------------------------------------------------------------------------- #
def load_results_as_inputs(results: dict):
    """Reconstruct (cases, per_persona_results) from a calibration_results.json so aggregation can
    be re-run (e.g. with de-bias) WITHOUT re-eliciting. Skeleton + per-persona estimates come
    straight from the stored personas; technique tags are re-read from content for relevance."""
    from collections import defaultdict
    index = build_technique_index()
    per = defaultdict(dict)
    cases = []
    for c in results.get("cases", []):
        case = {"case_id": c["case_id"], "from_position": c.get("from_position"), "role": c.get("role"),
                "is_anchor_probe": c.get("is_anchor_probe", False),
                "probe_technique": c.get("probe_technique"), "candidates": []}
        for cand in c["candidates"]:
            tech = cand["technique"]
            skel = None
            for pid, est in cand.get("personas", {}).items():
                if skel is None:
                    skel = [{"to": d["to"], "result": d["result"]} for d in est["outcome_dist"]]
                per[pid].setdefault(c["case_id"], {})[tech] = est
            case["candidates"].append({"technique": tech, "kind": cand.get("kind", "transition"),
                                       "tags": index.get(tech, {}).get("tags", []),
                                       "candidate_outcomes": skel or []})
        cases.append(case)
    return cases, dict(per)


# --------------------------------------------------------------------------- #
# Finalize: aggregate → de-bias → self-check → write → (optional) apply
# --------------------------------------------------------------------------- #
def finalize(cases, per_persona_results, anchors, skill, args, log):
    rng = random.Random(1729)  # reproducible bootstrap
    out_cases = aggregate_all(cases, per_persona_results, rng)
    recovery = anchor_recovery(out_cases, anchors)  # RAW (pre-debias) — diagnoses compression
    points = recovery.get("points") or []
    recovery["loao_mae"] = loao_mae(points)  # NON-circular generalization check (the real gate)

    # Fit + correct the single-LLM central-tendency compression, unless disabled.
    fit = fit_compression(points)
    debias = {"applied": False}
    if not args.no_debias and fit is not None:
        compression = fit["a"] < 0.9
        sound = abs(fit["r"]) >= 0.7 and fit["n"] >= 4 and 0.3 < fit["a"] < 1.05
        if compression and sound:
            apply_debias(out_cases, fit, log)
            debias = {"applied": True, "fit": fit}
        else:
            debias = {"applied": False, "fit": fit,
                      "note": "no compression detected" if not compression else "fit not sound; not de-biasing"}
    stratify_pseudo_counts(out_cases, log)

    # GATE on the de-circularized LOAO MAE (falls back to in-sample only if LOAO unavailable).
    if recovery["loao_mae"] is not None:
        gate_pass = recovery["loao_mae"] <= ANCHOR_MAE_GATE
    else:
        gate_pass = recovery["pass"]
    recovery["gate_pass"] = gate_pass

    results = {
        "schema_version": 1, "model": CLAUDE_MODEL, "effort": CLAUDE_EFFORT,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "skill_level": skill, "anchor_recovery": recovery, "debias": debias, "cases": out_cases,
    }
    atomic_write_json(args.out, results)
    log(f"\nWrote results → {args.out}")
    log(f"Anchor-recovery: in-sample MAE={recovery['mae']} band={recovery['band_mae']} | "
        f"LOAO MAE={recovery['loao_mae']} (the non-circular gate) → gate_pass={gate_pass}")
    if debias["applied"]:
        log(f"De-bias APPLIED: {debias['fit']}")
    else:
        log(f"De-bias NOT applied ({debias.get('note', 'disabled')})")

    index = build_technique_index()
    proposals = emit_content_proposals(out_cases, index)
    atomic_write_json(args.proposals, proposals)
    log(f"Wrote {len(proposals)} content proposal(s) → {args.proposals}")

    if args.apply_votes:
        if not gate_pass and not args.force:
            log("REFUSING --apply-votes: calibration gate failed (use --force to override).")
            return 2
        if not os.path.exists(VOTES_JSON):
            log(f"ERROR: {VOTES_JSON} not found — run `npm run regenerate:votes` first.")
            return 1
        with open(VOTES_JSON, encoding="utf-8") as fh:
            votes_data = json.load(fh)
        votes_data, applied, skipped = apply_calibrated_priors(
            votes_data, out_cases, only_seed=True, skip_extrapolated=not args.apply_out_of_band)
        atomic_write_json(VOTES_JSON, votes_data)
        from collections import Counter
        reasons = Counter(r for _, r in skipped)
        log(f"Applied calibrated prior to {applied} technique(s) in votes.json "
            f"({len(skipped)} skipped: {dict(reasons)}).")
    else:
        log("Dry-run: no votes.json changes. Re-run with --apply-votes to fold the success-rate prior.")
    return 0


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main():
    ap = argparse.ArgumentParser(description="Calibrated BJJ probability elicitation (Phase 1 / Thread B)")
    ap.add_argument("--cases", default=DEFAULT_CASES, help="input cases JSON")
    ap.add_argument("--out", default=DEFAULT_RESULTS, help="results output JSON")
    ap.add_argument("--proposals", default=DEFAULT_PROPOSALS, help="content proposals output JSON")
    ap.add_argument("--build-cases", action="store_true", help="derive cases from content and write --cases, then exit")
    ap.add_argument("--reaggregate", action="store_true",
                    help="re-aggregate an existing --out results file (applies de-bias) with NO Claude calls")
    ap.add_argument("--max-cases", type=int, default=100)
    ap.add_argument("--max-candidates", type=int, default=6, help="candidates per case when building")
    ap.add_argument("--chunk-size", type=int, default=4, help="cases per Claude call")
    ap.add_argument("--personas", default="", help="comma-separated persona ids (default: all)")
    ap.add_argument("--skill-level", default="purple-brown")
    ap.add_argument("--no-anchor-probes", action="store_true", help="skip blind anchor-recovery cases")
    ap.add_argument("--no-debias", action="store_true", help="skip the compression de-bias correction")
    ap.add_argument("--apply-votes", action="store_true", help="fold success-rate prior into templates/votes.json")
    ap.add_argument("--apply-out-of-band", action="store_true",
                    help="also auto-apply out-of-band (extrapolated) entries (default: hold them for human review)")
    ap.add_argument("--force", action="store_true", help="apply even if the calibration gate fails")
    ap.add_argument("--fresh", action="store_true", help="ignore the partial-resume file")
    args = ap.parse_args()

    def log(msg):
        print(msg, flush=True)

    if args.build_cases:
        data = build_cases_from_content(args.max_cases, args.max_candidates)
        atomic_write_json(args.cases, data)
        log(f"Wrote {len(data['cases'])} case(s) → {args.cases}")
        return 0

    # anchors: from the cases file if present, else defaults (needed for recovery in both modes)
    anchors, skill = DEFAULT_ANCHORS, args.skill_level
    if os.path.exists(args.cases):
        with open(args.cases, encoding="utf-8") as fh:
            cases_data = json.load(fh)
        anchors = cases_data.get("reference_anchors", DEFAULT_ANCHORS)
        skill = cases_data.get("skill_level", args.skill_level)

    if args.reaggregate:
        if not os.path.exists(args.out):
            log(f"ERROR: --reaggregate needs an existing results file: {args.out}")
            return 1
        with open(args.out, encoding="utf-8") as fh:
            prev = json.load(fh)
        cases, per_persona_results = load_results_as_inputs(prev)
        skill = prev.get("skill_level", skill)
        log(f"Re-aggregating {len(cases)} case(s) from {args.out} (no Claude calls)")
        return finalize(cases, per_persona_results, anchors, skill, args, log)

    if not os.path.exists(args.cases):
        log(f"ERROR: cases file not found: {args.cases}  (run with --build-cases first)")
        return 1
    cases = cases_data.get("cases", [])
    if not args.no_anchor_probes:
        cases = cases + make_anchor_probe_cases(anchors)

    principle_vocab = load_principles()
    log(f"Loaded {len(principle_vocab)} principles, {len(cases)} case(s) "
        f"({sum(1 for c in cases if c.get('is_anchor_probe'))} anchor probes)")

    persona_ids = [p.strip() for p in args.personas.split(",") if p.strip()] or [p["id"] for p in PERSONAS]
    selected = [PERSONA_BY_ID[p] for p in persona_ids if p in PERSONA_BY_ID]

    partial = {}
    if not args.fresh and os.path.exists(DEFAULT_PARTIAL):
        try:
            with open(DEFAULT_PARTIAL, encoding="utf-8") as fh:
                partial = json.load(fh)
            log(f"Resuming from {DEFAULT_PARTIAL}")
        except (json.JSONDecodeError, OSError):
            partial = {}

    per_persona_results = {}
    for persona in selected:
        log(f"\n=== Persona: {persona['id']} ===")
        per_persona_results[persona["id"]] = elicit_persona(
            persona, cases, anchors, principle_vocab, skill,
            args.chunk_size, CLAUDE_MODEL, CLAUDE_EFFORT, partial, log)

    return finalize(cases, per_persona_results, anchors, skill, args, log)


if __name__ == "__main__":
    raise SystemExit(main())
