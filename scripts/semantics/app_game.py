#!/usr/bin/env python3
"""
THE APP'S OPPONENT IN THE CORPUS'S GAME — how far P(I finish) moves when the kernel's THEIR-turn
rows are replaced by the shipped app's opponent, one mechanism at a time.

`_kernel.py` is the CORPUS's game (its docstring, "WHICH GAME THIS IS"): both seats sample authored
attempt shares, nobody resists. The shipped app plays a different opponent. This file PORTS that
opponent, line for line, from `neural/src/app.src.jsx` over the emitted wire
(`source/quartz/static/neural/graph-data.json`) and the deferred escape payload
(`source/quartz/static/neural/submission-details/*.json`), and splices it into the kernel's chain:

  _deriveDualPairs  members (rep 2i, partner 2i+1), link re-keying, the kind-2 one-way site links,
                    the pair tie, the cal split (ev on both members)
  ingest            outcome expansion, member fields, adjacency, the `_ev` EDGE table, `pi`,
                    the slug indices `_posSlugIndex` / `_techSlugIndex` (L1616-1651)
  _rulesetMask      giAllows(frame) && !stateAlias
  optionsFor        role + origin filter, title dedupe, the origin-relaxed fallback (_cmpRelaxed,
                    6 cards), and the deal ORDER (_cmpDealt over moveEdge / moveChance / att / name)
  opponentDefend    pFinish = clamp(0.34 + 0.55*oppAdv, .18, .85) (0.9 with no transition), a finish
                    uniform over the dealt submissions, else uniform over the first min(3, n) of the
                    transitions STABLE-sorted by the landing's oppVal — ties keep the _cmpDealt order
  enterDefense      the escape cards: loadSubmissionChoices (the file is qhash(title), L11346/L12443),
                    submissionDefenses (resolveOutcomeTo -> canonicalState -> rsAllowsIdx, L12475)
  escapeChance      e = clamp(1 - p_sub + (myVal(res) - myVal(sub))*0.15 + dmod - aiSkill + momentum,
                    .08, .92) with playerRole = the ESCAPING seat (set at L17428, before any card is
                    priced); an escape lands me on its destination, MY turn, my own member (L17485)
  moveChance        my odds = clamp(p + playerMod - aiMod + qMod + momentum, .05, .95),
                    aiMod = 0.4 * max(0, oppVal(currentPos)) + aiSkill — and a submission from a
                    position hand is rolled from the submission STATE (enterAttempt L16970-16981),
                    where oppVal = s[1] < 0 on every wire submission, so its aiMod is aiSkill alone
  moveCount         the round clock, see THE CLOCK below

Every ported rule cites its app.src.jsx line in a comment beside it. The line numbers are the
tree this file was written against; re-grep the function names before trusting one. They were
last retargeted to origin/dev 532481ccc (v1.205.2) by an exact line alignment of the old and new
app source: all 221 cited lines sat in unchanged regions and carry identical text. The ported
functions are re-diffed on every rebase:
  - onto v1.198.3 the only change in them was a UI-only `clearExecution()` call at the top of
    `opponentDefend` and `enterDefense`;
  - onto v1.204.4 none changed;
  - onto v1.205.2 none changed (its `endRound` edit decides belt-test point wins, which A8
    excludes, and a clock-out is still a draw).
Every line touching moveCount, maxMoves, aiSkill, escapeChance, successRate or rng() was unchanged
across all three, so the port stands.

LAYERS (each adds ONE mechanism; all from standing, me first; H = inf and the H = 9..12 clock)
  (a) kernel          the corpus game, `load_kernel(frame)` unchanged.
  (b) + choice rule   THEIR turn at every app-playable state is `opponentDefend`'s policy. A
                      positional card resolves as the app resolves it (`drawOutcome` over the WHOLE
                      authored table); a finish resolves at the submission's own rate over its own
                      table, exactly as the kernel resolves a submission card — no escape model.
  (c) + escape        the finish resolves by MY escape, over the escape cards enterDefense deals:
                      P(they finish) = 1 - e, and an escape lands on the card's authored destination.
                      Two rows, because the app lets ME pick the card: `uniform` over the dealt cards,
                      and `max-e` (the first card of the highest printed odds).
  (d) + aiMod         every card I play is priced clamp(p - aiMod, .05, .95); my submissions with the
                      submission state's aiMod (see moveChance above). Same two escape rows.
  The deal order (_cmpDealt) reads moveChance, which subtracts aiMod, so the choice rule itself
  depends on aiSkill whenever the top-3 cut falls inside an oppVal tie. aiSkill is drawn once per
  roll, so every layer that reads it is the MEAN of its per-aiSkill chains' absorption figures.

THE CLOCK (the H 9..12 columns) is a PORT of moveCount, not the kernel's ply rule. maxMoves =
9 + (rng*4 | 0) (L16354) and moveCount = 0 at startRoll; the recursion runs over (state, moveCount):
  my success travel               +1, CHECKED   (enterSuccessCal L17387-17388: >= maxMoves resets)
  their positional move           +1, CHECKED   (L17628-17629)
  my miss travel                  +1, unchecked (enterFailCal L17407 goes straight to opponentDefend)
  my stay-put miss                 0            (L17401)
  an escape landing               +1, unchecked (L17485 goes straight to enterLand)
  my MISSED submission            +2, unchecked (the entry travel into the submission state, L16977,
                                                  then the miss travel out of it: never a stay-put)
  their finish attempt             0            (the travel to it at L17594 counts nothing)
and one member rule: their positional move leaves currentPos on THEIR landing member (L17607), so
my next stay-put miss there is a travel (+1, unchecked). A roll opens on my own member (startRoll
re-seats Standing onto the drawn seat, L16430), so the start carries no such state. Past maxMoves
the roll goes on through unchecked moves only, until a checked move resets it. The printed rule
ladder (kernel ply rule -> + checks -> + submission entry -> + member) decomposes the difference,
and "kernel ply rule" is kept as its own column: at level 0 the port reproduces
`Kernel.finite_horizon` exactly (a selfcheck identity).

APPROXIMATIONS — every one is printed with its measured exposure, none is silent. Figures are
nogi / gi, as measured when this was written; the run prints the current ones.
  A2  aiSkill ~ U[0.06, 0.20) per roll (L16356) is integrated on 7 equally spaced points of
      [0.06, 0.20]. A 13-point grid moves (d) uniform by -0.0005 / -0.0005 (H = inf).
  A4  control-alias hubs (the 12 `stateAlias` positions, 24 role-nodes; `canonicalState` L12409
      re-routes them to submission STATES) keep the kernel's THEIR-turn rows, and an escape card whose
      destination canonicalises into such a state (59 of 1058 cards) lands on the alias hub's own
      role-node, MY turn — the app would put me in that submission state (re-caught, or attacking).
      THEIR-turn visits there 0.074 / 0.061 per roll; escapes onto an alias 0.0010 / 0.0010 per roll.
      (The escape TERM at those cards is read exactly as the app reads it — off the canonical
      submission node — which is why 42 of the 59 carry a small negative term.)
  A5  cards RESOLVE at the kernel's folded no-gi successRate (rates="shipped"): my cards, the
      escape base (1 - p_sub), the kept kernel rows. The app's `calSuccess` (L17001) reads
      `successRateByRuleset[_giMode]`: exact in no-gi (0 forks), and in gi 146 techniques fork.
      Every rate at calSuccess (kernel rates="frame") moves (d) uniform by +0.0000 / +0.0023. The
      deal ORDER already uses the wire's calSuccess, as the app does.
  A6  chained hub cells drawn by the opponent's positional card are flattened by the kernel's
      `_expand` (the chained submission's own table, labelled performer). The app stands the roll
      in that submission's STATE (`resolveOutcomeTo` -> `submissionNode`, L17605-L17624) and plays
      it out. THEIR-turn mass on them 0.0006 / 0.0005 per roll.
  A7  MY turn is the kernel's: its hands, its attempt-share policy (the app lets me choose), its
      flattening of my chained cells, its rows at alias states — and my escape pick is one of two
      named policies (uniform, max-e), which differ by +0.020 / +0.025 in (c).
  A8  a fresh profile: zero drilling (stateBonus 0, so dmod 0), no user odds overrides, no wrong-
      landing-question penalty (_qMod), zero momentum (momentumMod, momentumSkew), difficulty
      "normal", no belt test (`_beltPoolAllows` L7106 returns true). A definition, not a gap.
  A9  states outside S_app (kernel-non-live, alias, or app-masked in this frame) keep the kernel's
      THEIR rows; their THEIR-turn visit mass from standing is printed (0 means "unreachable"):
      0.0000 outside the aliases (A4) in both frames.
  A11 the clock labels rows this file does not port by the nearest app rule: a kept kernel THEIR
      row (A4/A9) is clocked as a positional move (+1 checked, lands on their member), a flattened
      chained cell (A6/A7) takes its branch's label. Clocking the kept rows as opponentDefend's
      submission-state response instead (L17556: +1 unchecked, my member) moves (d) uniform
      +0.0007 / +0.0006 on the clock, 0 at H = inf.
  (A1 — escapes landing on the submission's miss cells —, A3 — the escape term omitted — and A10 —
  the kernel's ply rule standing in for moveCount — are ELIMINATED: see enterDefense, escapeChance
  and THE CLOCK above.)

WHICH MEMBER IS `currentPos` ON THEIR TURN (not an approximation — derived). `opponentDefend` is
reached ONLY from my failure: `enterFail` (L17368) and `enterFailCal` (L17401, L17408). enterFailCal
sets `playerRole = r.role` and `currentPos = canonicalState(r.idx)` with r.idx the member OF THAT
ROLE (L17398-17407); a stay-put (L17401) requires currentPos to already be that member. So on their
turn currentPos is the member of the player's own role — `mem(hub, playerRole)` below. It matters:
the two members' adjacency differs in ORDER, and resultPos skips exactly `currentPos`.

WHERE THIS DIFFERS FROM THE SCRATCH AUDIT PORT (fidelity-audit d_/f_/f2_ scripts), both measured:
  * THE DEAL ORDER. The scratch kept `adj` order inside optionsFor; the app sorts the main pass by
    `_cmpDealt` (L12667) before `opponentDefend` stable-sorts transitions by oppVal (L17599), so
    every oppVal tie at the top-3 cut is broken by EDGE / odds / attempt / name. Ties are common
    (resultPos often returns the SAME hub's other member), so the top-3 SET differs in ~50 states
    per frame; a subs-only positional pick takes the first 3 subs in that order too. The adj
    reading survives only as the printed sensitivity row, which reproduces the scratch numbers.
  * S_app excludes states the app masks in the frame (the 16 no-gi cloth-guard role-nodes). The
    scratch evaluated them with a fabricated origin-relaxed hand; they are unreachable from
    standing, so no P(I finish) moves, but uniform policy averages do.

    python3 scripts/semantics/app_game.py                  # the table
    python3 scripts/semantics/app_game.py --selfcheck      # the gate; non-zero exit on failure
    python3 scripts/semantics/app_game.py --json out.json

Deterministic: states in sorted order, keys iterated sorted, no randomness anywhere.
"""
from __future__ import annotations

import argparse
import functools
import json
import os
import re
import sys
from collections import Counter

import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)
REPO = os.path.dirname(SCRIPTS)
sys.path.insert(0, HERE)
sys.path.insert(0, SCRIPTS)

from _kernel import ID, IL, IW, _expand, load_kernel  # noqa: E402
from solve_edge_values import L, W, flip, load_graph  # noqa: E402

WIRE = os.path.join(REPO, "source", "quartz", "static", "neural", "graph-data.json")
DETAILS = os.path.join(REPO, "source", "quartz", "static", "neural", "submission-details")
EMIT_CMD = "npm run regenerate:neural   (or: python3 scripts/regenerate_neural_data.py)"
FRAMES = ("nogi", "gi")
AISKILL = np.linspace(0.06, 0.20, 7)          # A2: 0.06 + rng("ai-skill") * 0.14   L15726 / L16356
HORIZONS = (9, 10, 11, 12)                    # maxMoves = 9 + ((rng("max-moves") * 4) | 0)   L15725
NG_EDGE_LAM = 2                               # L89; `lossAversion` defaults to it (L17090)
POS = "positions"
RESULT_WORD = {"s": "success", "f": "failure", "c": "counter"}   # L1348

# COVERAGE FLOORS (CLAUDE.md §6.6: a measurement that looked at nothing must not print a number).
MIN_REPLACED_STATES = 200     # app-playable states whose THEIR row the app opponent replaces
MIN_CANDIDATES = 1000         # opponent cards the port dealt, summed over those states
MIN_EFFECT = 0.005            # (b) must move P(I finish) at least this far, or the splice is dead
IDENTITY_TOL = 1e-12          # kernel-opponent mutant vs the kernel
MIN_ESCAPE_CHOICES = 1000     # escape cards read from the submission-details payload
MIN_TERM_EFFECT = 0.02        # dropping escapeChance's dominance term must move (c) and (d) this far
MIN_SUBPRICE_EFFECT = 0.001   # pricing my Finish at the position must move (d) this far
MIN_CLOCK_STEP = 1e-4         # every moveCount rule must move the H 9..12 figures this far
MIN_CHAINS = 120              # chains built per frame by the selfcheck run

APPROXIMATIONS = (
    ("A2", "aiSkill ~ U[0.06,0.20) per roll is integrated on 7 equally spaced points of [0.06,0.20] "
           "(exposure: the 13-point grid line)"),
    ("A4", "the 12 control-alias hubs (24 role-nodes, canonicalState L12409) keep kernel THEIR rows, and an "
           "escape into one lands on the alias role-node, MY turn, not in the submission state"),
    ("A5", "cards RESOLVE at the kernel's folded no-gi successRate (rates=shipped), escape base included; "
           "the app's calSuccess reads the gi rate in gi; the deal ORDER uses the wire"),
    ("A6", "chained hub cells on the opponent's positional draw are flattened by the kernel's _expand; the "
           "app stands the roll in that submission's STATE (L17605-L17624)"),
    ("A7", "MY turn is the kernel's hands and attempt-share policy (the app lets me choose); my escape pick "
           "is uniform or max-e, both printed"),
    ("A8", "fresh profile: no drilling (dmod 0), no odds overrides, no _qMod, zero momentum, difficulty "
           "normal, no belt test"),
    ("A9", "states outside S_app (kernel-non-live, alias, app-masked) keep kernel THEIR rows"),
    ("A11", "the clock labels unported rows by the nearest app rule: a kept kernel THEIR row is a positional "
            "move (+1 checked), a flattened chained cell takes its branch's label"),
)


def _num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _clamp(lo, hi, x):
    """Math.max(lo, Math.min(hi, x))."""
    return max(lo, min(hi, x))


def load_wire_text():
    if not os.path.exists(WIRE):
        raise SystemExit("[app_game] the emitted wire is missing: %s\n  emit it first with: %s"
                         % (os.path.relpath(WIRE, REPO), EMIT_CMD))
    with open(WIRE, "r", encoding="utf-8") as fh:
        return fh.read()


# --------------------------------------------------------------------------- #
# the port
# --------------------------------------------------------------------------- #
class AppPort:
    """
    The app's graph and its opponent, for ONE ruleset (the app's `_giMode`). Built from a fresh
    parse of the wire, because ingest MUTATES its input (L1351, L1321) exactly as the app's does.
    """

    def __init__(self, wire_text, frame):
        if frame not in FRAMES:
            raise ValueError(frame)
        self.frame = frame                         # `this._giMode`
        self.counters = Counter()                  # every fallback the port takes, by name
        data = json.loads(wire_text)
        self.evLam = list(data["evLam"]) if isinstance(data.get("evLam"), list) else []   # L1385
        self.evFrame = data.get("evFrame") or None                                         # L1386

        # ---- ingest: WIRE EXPANSION, L1345-1352 --------------------------------------------
        tab = data.get("toTab") if isinstance(data.get("toTab"), list) else None

        def _to(v):
            if tab is not None and _num(v):
                return tab[v] if 0 <= v < len(tab) and tab[v] else None     # TO_TAB[v] || null
            return v
        for n in data["nodes"]:
            c = n.get("cal")
            if c and isinstance(c.get("outcomes"), list):
                c["outcomes"] = [
                    {"to": _to(o[0]), "probability": o[1], "result": RESULT_WORD.get(o[2], o[2])}
                    if isinstance(o, list) else o for o in c["outcomes"]]
        self.hub_src = data["nodes"]              # the hub-level wire, after expansion
        if any(n.get("pairId") for n in self.hub_src):
            raise SystemExit("[app_game] wire already carries pairId — _deriveDualPairs would no-op "
                             "(L1154); this port expects the hub wire")
        self._derive_dual_pairs(data)             # L1366
        self._ingest(data)

    # ---- _deriveDualPairs, L1149-1324 -------------------------------------------------------
    def _derive_dual_pairs(self, data):
        src = data["nodes"]
        N = len(src)
        rep = lambda i: 2 * i                                                   # noqa: E731  L1159
        low = lambda i: 2 * i + 1                                               # noqa: E731
        mem = lambda i, role: low(i) if role in ("bottom", "defender") else rep(i)   # noqa: E731
        self.N, self.rep, self.low, self.mem = N, rep, low, mem

        pos_by_slug, tech_by_slug = {}, {}                                      # L1164-1178
        for i, h in enumerate(src):
            if h["ty"] == POS:
                pid = str(h.get("posId") or "").lower()
                if not pid:
                    continue
                pos_by_slug.setdefault(pid, i)
                pos_by_slug.setdefault(pid[pid.rfind("/") + 1:], i)
            else:
                hid = h["id"]
                tail = (hid[hid.index("/") + 1:] if "/" in hid else hid).lower()
                for k in (tail, tail.replace("/", "-")):
                    if k and (k not in tech_by_slug or h["ty"] == "submissions"):
                        tech_by_slug[k] = i

        lands, tech_edge = {}, []                                               # L1181-1198
        for i, h in enumerate(src):
            if h["ty"] == POS:
                continue
            for o in ((h.get("cal") or {}).get("outcomes") or []):
                to = str((o or {}).get("to") or "").strip().lower()
                if not to or to == "game-over":
                    continue
                if to.endswith("/top") or to.endswith("/bottom"):            # /^(.*)\/(top|bottom)$/
                    base, role = to.rsplit("/", 1)
                    p = pos_by_slug.get(base)
                    if p is not None and (p * N + i) not in lands:
                        lands[p * N + i] = role
                    continue
                t = tech_by_slug.get(to)
                if t is not None:
                    tech_edge.append((i, t))
                    continue
                p = pos_by_slug.get(to)
                if p is not None and (p * N + i) not in lands:
                    lands[p * N + i] = "top"

        out = [None] * (2 * N)                                                  # L1202-1221
        for i, h in enumerate(src):
            roles = ("top", "bottom") if h["ty"] == POS else ("attacker", "defender")
            for si, role in enumerate(roles):
                m = {"id": h["id"] if si == 0 else h["id"] + "/" + role.capitalize(),
                     "t": h["t"], "ty": h["ty"], "s": h.get("s"), "role": role,
                     "pairId": h["id"] + "/" + roles[1].capitalize() if si == 0 else h["id"],
                     "posId": h.get("posId") or None, "fromPositionId": h.get("fromPositionId") or None,
                     "fromRole": h.get("fromRole") or None, "cal": None}
                s = h.get("s")
                if isinstance(s, list) and len(s) > si and _num(s[si]):
                    m["sv"] = s[si]
                out[rep(i) if si == 0 else low(i)] = m

        links, seen = [], set()                                                 # L1224-1256

        def add(a, b):
            if a == b:
                return
            k = (a, b) if a < b else (b, a)
            if k in seen:
                return
            seen.add(k)
            links.append((a, b))
        for l in data["links"]:
            a = l[0] if isinstance(l, list) else None
            b = l[1] if isinstance(l, list) else None
            if a is None or b is None or not (0 <= a < N) or not (0 <= b < N):
                continue
            pa, pb = src[a]["ty"] == POS, src[b]["ty"] == POS
            if pa == pb:
                add(rep(a), rep(b))                     # tech<->tech rides the attacker layer
                continue
            p, t = (a, b) if pa else (b, a)
            ht = src[t]
            fr = ht.get("fromRole")
            at_origin = bool(fr) and (str(ht.get("fromPositionId") or "").lower()
                                      == str(src[p].get("posId") or "").lower())     # L1238
            role = fr if at_origin else (lands.get(p * N + t) or fr or "top")
            add(mem(p, role), rep(t))
            links.append((mem(p, "bottom" if role == "top" else "top"), rep(t), 2))  # L1253 kind 2
        for a, b in tech_edge:
            add(rep(a), rep(b))                                                 # L1255
        for i in range(N):
            links.append((rep(i), low(i)))                                      # L1256 the tie

        for i, h in enumerate(src):                                             # L1258-1299 cal split
            cal = h.get("cal")
            if not cal:
                continue
            if h["ty"] != POS:
                out[rep(i)]["cal"] = cal                                        # L1267
                if cal.get("avail"):
                    out[low(i)]["cal"] = {"avail": cal["avail"]}
                continue
            A = {"avail": cal.get("avail"), "stateAlias": cal.get("stateAlias")}   # L1272
            B = {"avail": cal.get("avail"), "stateAlias": cal.get("stateAlias")}
            if cal.get("ev"):                                                   # L1280-1289
                ev = {}
                for role, blk in cal["ev"].items():
                    if not isinstance(blk, list) or not blk or not isinstance(blk[0], list):
                        continue
                    cp = list(blk)
                    cp[0] = [rep(x) for x in blk[0]]            # idxs name techniques -> attackers
                    ev[role] = cp
                A["ev"] = ev
                B["ev"] = ev
            # `ew` (L1292-1299) is display-only (`_edgeW`'s sole reader is draw()); not ported.
            out[rep(i)]["cal"], out[low(i)]["cal"] = A, B
        # the isometric projection (L1303-1317) is geometry only; not ported.
        data["nodes"], data["links"] = out, links

    # ---- ingest after the split: _ev, member fields, adjacency, pi ---------------------------
    def _ingest(self, data):
        self._ev = {}                                                           # L1387-1401
        for i, n in enumerate(data["nodes"]):
            tab = n["cal"] and n["cal"].get("ev")
            if not tab:
                continue
            for role, blk in tab.items():
                if not isinstance(blk, list) or len(blk) < 3 or not isinstance(blk[0], list):
                    continue
                idxs, att, m = blk[0], blk[1] or [], {}
                for k in range(len(idxs)):
                    lams = [[blk[Lx][2 * k] if 2 * k < len(blk[Lx]) else None,
                             blk[Lx][2 * k + 1] if 2 * k + 1 < len(blk[Lx]) else None]
                            for Lx in range(2, len(blk))]
                    m[idxs[k]] = {"att": (att[k] if k < len(att) else 0) or 0, "lam": lams}
                self._ev["%d/%s" % (i, role)] = m
        nodes = []
        for i, n in enumerate(data["nodes"]):                                   # L1404-1414
            s = n.get("s")
            if _num(n.get("sv")):
                dom = n["sv"]
            elif isinstance(s, list) and s and _num(s[0]):
                dom = s[0]
            else:
                dom = dominance(n["ty"], n["t"])
                self.counters["node dom from dominance() (no s on the wire; ingest L1408)"] += 1
            nodes.append({"idx": i, "id": n["id"], "t": n["t"], "ty": n["ty"], "s": s, "dom": dom,
                          "posId": n.get("posId") or n.get("fromPositionId") or None,   # L1413
                          "fromPositionId": n.get("fromPositionId") or None,
                          "fromRole": n.get("fromRole") or None, "cal": n.get("cal") or None,
                          "role": n.get("role") or None, "pairId": n.get("pairId") or None})
        id_index = {}
        for i, n in enumerate(nodes):
            id_index[n["id"]] = i
        adj = [[] for _ in nodes]                                               # L1434-1448
        for l in data["links"]:
            a, b = l[0], l[1]
            if a is None or b is None or a == b or not (0 <= a < len(nodes)) or not (0 <= b < len(nodes)):
                continue
            if len(l) > 2 and l[2] == 2:
                adj[a].append(b)                        # site adjacency: one-way, never drawn
                continue
            adj[a].append(b)
            adj[b].append(a)
        for n in nodes:                                                         # L1551
            n["pi"] = id_index.get(n["pairId"], -1) if n["pairId"] else -1
        self.nodes, self.adj = nodes, adj
        # _rebuildRulesetMask L7339-7355: giAllows(n) && !(n.cal && n.cal.stateAlias)
        self.mask = [self.gi_allows(n) and not (n["cal"] and n["cal"].get("stateAlias"))
                     for n in nodes]
        self.pos_hub = {h["posId"]: i for i, h in enumerate(self.hub_src) if h["ty"] == POS}
        self.alias_hubs = frozenset(h["posId"] for h in self.hub_src if h["ty"] == POS
                                    and (h.get("cal") or {}).get("stateAlias"))
        self._shift_memo = {}
        self._slug_indices()

    # ---- the slug indices, L1616-1651 (resolveOutcomeTo and canonicalState read them) ---------
    def _slug_indices(self):
        pos, tech = {}, {}

        def set_tech(k, i, ty):                                                 # L1617
            if k and (k not in tech or ty == "submissions"):
                tech[k] = i
        for n in self.nodes:                                                    # L1618-1640
            if n["ty"] == POS:
                if n["posId"]:
                    pid = str(n["posId"]).lower()
                    if n["role"] and n["pairId"]:
                        pos[pid + "/" + n["role"]] = n["idx"]
                        if n["role"] == "top" or pid not in pos:
                            pos[pid] = n["idx"]
                    else:
                        pos[pid] = n["idx"]
                continue
            tail = (n["id"][n["id"].index("/") + 1:] if "/" in n["id"] else n["id"]).lower()
            if n["role"] and n["pairId"] and n["role"] != "attacker":
                set_tech(tail, n["idx"], n["ty"])
                continue
            set_tech(tail, n["idx"], n["ty"])
            if "/" in tail:
                set_tech(tail.replace("/", "-"), n["idx"], n["ty"])
        for n in self.nodes:                                                    # L1643-1651
            if n["ty"] == POS and n["posId"]:
                pid = str(n["posId"]).lower()
                if "/" in pid:
                    bare = pid[pid.rfind("/") + 1:]
                    if n["role"] and n["pairId"] and (bare + "/" + n["role"]) not in pos:
                        pos[bare + "/" + n["role"]] = n["idx"]
                    if bare not in pos:
                        pos[bare] = n["idx"]
        self.pos_slug, self.tech_slug = pos, tech

    def resolve_outcome_to(self, to):                                           # L17232-17247
        if not to or not isinstance(to, str):
            return {"idx": -1, "terminal": False, "role": None}
        t = to.strip().lower()
        if t == "game-over":
            return {"idx": -1, "terminal": True, "role": None}
        m = re.match(r"^(.*)/(top|bottom)$", t)
        if m:
            i = self.pos_slug.get(m.group(1) + "/" + m.group(2))
            if i is None:
                i = self.pos_slug.get(m.group(1))
            return {"idx": -1 if i is None else i, "terminal": False, "role": m.group(2)}
        i = self.tech_slug.get(t)
        if i is not None:
            return {"idx": i, "terminal": False, "role": None}
        i = self.pos_slug.get(t)
        return {"idx": -1 if i is None else i, "terminal": False, "role": None}

    def submission_node(self, i):                                               # L12405-12408
        n = self.nodes[i] if (i is not None and 0 <= i < len(self.nodes)) else None
        if not n or n["ty"] != "submissions":
            return None
        return self.nodes[n["pi"]] if (n["role"] == "defender" and n["pi"] >= 0) else n

    def canonical_state(self, idx, role):                                       # L12409-12418
        n = self.nodes[idx] if 0 <= idx < len(self.nodes) else None
        if not n:
            return idx
        alias = n["cal"] and n["cal"].get("stateAlias")
        if not alias:
            return idx
        sub = self.submission_node(self.tech_slug.get(alias))
        if not sub or not self.mask[sub["idx"]]:                                # rsAllows(sub)
            return idx
        return sub["idx"] if (role or n["role"]) == sub["fromRole"] else (sub["pi"] if sub["pi"] >= 0 else sub["idx"])

    def submission_defenses(self, sub_idx, choices):                            # L12475-12487
        """The escape cards `enterDefense` deals (L17444), in authored order, plus why any were dropped."""
        out, dropped = [], Counter()
        for d in choices or []:
            r = self.resolve_outcome_to(d.get("to"))
            dest = self.canonical_state(r["idx"], r["role"])
            if dest < 0:
                dropped["unresolved"] += 1
                continue
            if r["terminal"]:
                dropped["terminal"] += 1
                continue
            if not self.mask[dest]:                                             # rsAllowsIdx(dest)
                dropped["masked in this ruleset"] += 1
                continue
            out.append({"res": dest, "at": r["idx"], "label": d.get("label"),
                        "role": r["role"] or self.nodes[dest]["role"]})        # destinationRole
        return out, dropped

    def escape_term(self, sub_idx, res):                                        # L15208
        """escapeChance's dominance term (myVal(res) - myVal(sub)) * 0.15, read with playerRole = the
        ESCAPING seat: enterDefense sets it at L17428, before any escape card is priced."""
        sub = self.nodes[sub_idx]                                   # _defendSub, L17427/L17453
        pr = "bottom" if sub["fromRole"] == "top" else "top"
        return (self.my_val(self.nodes[res], pr) - self.my_val(sub, pr)) * 0.15

    # ---- predicates and values ----------------------------------------------------------
    def gi_allows(self, n):                                                     # L7309-7327
        av = n["cal"] and n["cal"].get("avail")
        frame = self.frame or "gi"
        if av and isinstance(av.get(frame), bool):
            return av[frame]
        return True

    @staticmethod
    def val_idx(node, pr):                                                      # L1809-1813
        if node and node["ty"] != POS and node["fromRole"]:
            return 0 if node["fromRole"] == pr else 1       # performer / opponent
        return 1 if pr == "bottom" else 0                    # roleIdx(): top / bottom

    def my_val(self, node, pr):                                                 # L1814-1819
        s, i = node["s"], self.val_idx(node, pr)
        if isinstance(s, list) and len(s) >= 2 and _num(s[i]):
            return s[i]
        self.counters["myVal dominance fallback"] += 1
        return -(node["dom"] or 0) if pr == "bottom" else (node["dom"] or 0)

    def opp_val(self, node, pr):                                                # L17535-17539
        s = node["s"]
        if isinstance(s, list) and len(s) >= 2:
            return s[1 if self.val_idx(node, pr) == 0 else 0]
        self.counters["oppVal dominance fallback"] += 1
        return -(node["dom"] or 0)

    def cal_success(self, act):                                                 # L17001-17007
        c = act and act["cal"]
        if not c:
            return None
        br = c.get("successRateByRuleset")
        v = br[self.frame] if (br and self.frame and br.get(self.frame) is not None) else c.get("successRate")
        return _clamp(0, 1, v / 100) if _num(v) else None

    def move_chance(self, act, ctx):                                            # L17010-17020
        # successOverride: no user mods (A8). playerMod = stateBonus(_posKey) + stateBonus(deck) +
        # film = 0 on a fresh profile; _qMod = 0; momentumMod() = 0 (L15085, combo <= 1).
        cal = self.cal_success(act)
        if cal is not None:
            base = cal
        else:
            self.counters["moveChance uncalibrated base"] += 1
            base = (0.36 if act["ty"] == "submissions" else 0.56) + act["dom"] * 0.1
        player_mod = 0 + 0 + 0
        ai_mod = max(0, self.opp_val(self.nodes[ctx["cur"]], ctx["pr"])) * 0.4 + ctx["ai"]   # L17016
        return _clamp(0.05, 0.95, base + player_mod - ai_mod + 0 + 0)          # L17019

    def ev_p0(self, n):                                                         # L17077-17082
        c = n and n["cal"]
        if not c:
            return None
        br = c.get("successRateByRuleset")
        v = br[self.evFrame] if (br and self.evFrame and br.get(self.evFrame) is not None) else c.get("successRate")
        return _clamp(0, 1, v / 100) if _num(v) else None

    def ev_lam_idx(self):                                                       # L17088-17093
        if not self.evLam:
            return -1
        k = self.evLam.index(NG_EDGE_LAM) if NG_EDGE_LAM in self.evLam else -1
        return 0 if k < 0 else k

    def ev_rows_for(self, pos_idx, role):                                       # L17097-17106
        key = "%d/%s" % (pos_idx, role)
        m = self._ev.get(key)
        k = self.ev_lam_idx() if m else -1
        if not m or k < 0:
            return None

        def of(tech_idx):
            r = m.get(tech_idx)
            c = r["lam"][k] if (r and k < len(r["lam"])) else None
            return {"e0": c[0], "c1": c[1], "att": r["att"], "key": key, "k": k} if c else None
        return of

    def ev_shift(self, key, k, ctx):                                            # L17127-17137
        memo = (key, k, ctx["cur"], ctx["pr"], ctx["ai"])
        if memo in self._shift_memo:
            return self._shift_memo[memo]
        m = self._ev.get(key)
        if not m:
            return 0
        wsum = acc = 0
        for j, r in m.items():
            c = r["lam"][k] if k < len(r["lam"]) else None
            nd = self.nodes[j] if 0 <= j < len(self.nodes) else None
            if not c or not nd:
                continue
            p0 = self.ev_p0(nd)
            if p0 is None:
                continue
            wsum += r["att"]
            acc += r["att"] * (self.move_chance(nd, ctx) - p0) * c[1]
        out = acc / wsum if wsum > 0 else 0
        self._shift_memo[memo] = out
        return out

    def move_edge(self, opt, ctx):                                              # L17141-17146
        r = opt["ev"]
        if not r:
            return None
        p0 = self.ev_p0(opt["node"])
        if p0 is None:
            return r["e0"]
        return r["e0"] + (self.move_chance(opt["node"], ctx) - p0) * r["c1"] - self.ev_shift(r["key"], r["k"], ctx)

    @staticmethod
    def _name_cmp(a, b):
        return -1 if a["node"]["t"] < b["node"]["t"] else 1 if a["node"]["t"] > b["node"]["t"] else 0

    def cmp_relaxed(self, a, b, pr):                                            # L17210-17219
        d = self.my_val(b["node"], pr) - self.my_val(a["node"], pr)
        if d and d == d:                                    # JS `||`: 0 and NaN fall through
            return d
        return self._name_cmp(a, b)

    def cmp_dealt(self, a, b):                                                  # L17220-17228
        av, bv = a["ord"], b["ord"]
        if (av is None) != (bv is None):
            return 1 if av is None else -1
        if av is not None and av != bv:
            return bv - av
        if a["ordOdds"] != b["ordOdds"]:
            return b["ordOdds"] - a["ordOdds"]
        aa = (a["ev"] and a["ev"]["att"]) or 0
        ba = (b["ev"] and b["ev"]["att"]) or 0
        if aa != ba:
            return ba - aa
        return self._name_cmp(a, b)

    def result_pos(self, act_idx, from_idx):                                    # L12690-12697
        for k in self.adj[act_idx]:
            if self.nodes[k]["ty"] == POS and k != from_idx and self.mask[k]:
                return k
        for k in self.adj[act_idx]:
            if self.nodes[k]["ty"] == POS:
                return k
        return -1

    # ---- optionsFor, L12599-12670 --------------------------------------------------------
    def options_for(self, pos_idx, role, ctx, order="app"):
        """Returns (opts, relaxed). `order="adj"` skips the _cmpDealt sort — the scratch audit's
        reading, kept ONLY as a sensitivity/mutant; the app always sorts (L12667)."""
        here = self.nodes[pos_idx]
        # canonicalState (L12601, L12409): identity off the 12 alias hubs, which never reach here.
        if here["cal"] and here["cal"].get("stateAlias"):
            raise AssertionError("options_for called on a control alias: %s" % here["id"])
        seen, out = set(), []
        here_id = here["posId"] or None                                         # L12604
        ev_of = self.ev_rows_for(pos_idx, role)                                 # L12608
        for k in self.adj[pos_idx]:
            n = self.nodes[k]
            if n["ty"] == POS:
                continue
            if not self.mask[k]:                                                # L12616 ruleset
                continue
            if n["t"] in seen:                                                  # L12617 title dedupe
                continue
            seen.add(n["t"])
            if n["fromRole"] and n["fromRole"] != role:                         # L12626 role, READ
                continue
            if n["fromPositionId"] and here_id and n["fromPositionId"] != here_id:   # L12628 origin
                continue
            out.append({"idx": k, "node": n, "ev": ev_of(k) if ev_of else None})
        if not out:                                                             # L12633 fallback
            for k in self.adj[pos_idx]:
                n = self.nodes[k]
                if n["ty"] == POS or not self.mask[k] or (n["t"] + "_fb") in seen:
                    continue
                seen.add(n["t"] + "_fb")
                if n["fromRole"] and n["fromRole"] != role:                     # L12639 never ROLE
                    continue
                out.append({"idx": k, "node": n, "ev": ev_of(k) if ev_of else None, "relaxed": True})
            out.sort(key=functools.cmp_to_key(lambda a, b: self.cmp_relaxed(a, b, ctx["pr"])))  # L12653
            return out[:6], True                                                # L12661
        for o in out:                                                           # L12666 FREEZE
            o["ord"] = self.move_edge(o, ctx)
            o["ordOdds"] = self.move_chance(o["node"], ctx)
            if o["ord"] is not None and not np.isfinite(o["ord"]):
                self.counters["non-finite EDGE in the deal order"] += 1
        if order == "app":
            out.sort(key=functools.cmp_to_key(self.cmp_dealt))                  # L12667
        elif order != "adj":
            raise ValueError(order)
        return out, False

    # ---- opponentDefend, L17540-17631 ----------------------------------------------------
    def opponent(self, hub_i, pr, ai, order="app", pfin_override=None):
        """
        The app opponent at (hub, playerRole = pr) for one aiSkill. Returns plays as
        [(member idx, share, mode)] with mode "finish" (enterDefense) or "table" (drawOutcome).
        """
        cur = self.mem(hub_i, pr)             # currentPos on THEIR turn: see the module docstring
        ctx = {"cur": cur, "pr": pr, "ai": float(ai)}
        opp = "bottom" if pr == "top" else "top"                                # L17564
        opts, relaxed = self.options_for(cur, opp, ctx, order)
        subs, trans, seen = [], [], set()
        for o in opts:                                                          # L17564-17573
            k = o["idx"]
            n = self.nodes[k]
            if n["ty"] == POS or n["t"] in seen:
                continue
            seen.add(n["t"])
            if not self.mask[k]:
                continue
            (subs if n["ty"] == "submissions" else trans).append(k)   # _beltPoolAllows: true (A8)
        info = {"cur": cur, "subs": subs, "trans": trans, "relaxed": relaxed, "plays": [],
                "draw": False, "pfin": 0.0, "top": []}
        if not subs and not trans:                                              # L17580
            info["draw"] = True                                                 # endRound("reset")
            return info
        opp_adv = self.opp_val(self.nodes[cur], pr)                             # L17582
        pfin = _clamp(0.18, 0.85, 0.34 + opp_adv * 0.55) if subs else 0         # L17583
        if not trans and subs:
            pfin = 0.9                                                          # L17584
        if pfin_override is not None:
            pfin = pfin_override if subs else 0                                 # MUTANT only
        info["pfin"] = pfin
        if subs and pfin > 0:                                                   # L17585-17586
            info["plays"] += [(k, pfin / len(subs), "finish") for k in subs]

        def land_val(b):                                                        # L17599
            r = self.result_pos(b, cur)
            return self.opp_val(self.nodes[r] if r >= 0 else self.nodes[b], pr)
        trans_sorted = sorted(trans, key=lambda b: -land_val(b))   # stable, descending
        pool = trans_sorted if trans else subs                                  # L17600
        top = pool[:min(3, len(pool))]
        info["top"] = top
        if 1 - pfin > 0:
            info["plays"] += [(k, (1 - pfin) / len(top), "table") for k in top]
        return info


def dominance(ty, title):                                                       # L581-602
    """The app's name heuristic, used ONLY where a wire node has no `s` (counted)."""
    import re
    t = (title or "").lower()
    top, bot = bool(re.search(r"\btop\b", t)), bool(re.search(r"\bbottom\b", t))
    if ty == "submissions":
        return -0.85 if re.search(r"escape|defen[sc]|survive|prevent|counter|defend", t) else 0.9
    if ty == POS:
        m = 0.5
        if re.search(r"mount|back|crucifix|truck|rodeo|mounted", t):
            m = 0.8
        elif re.search(r"side control|north.?south|kesa|knee on belly|knee.?ride", t):
            m = 0.65
        elif re.search(r"control|headlock|ashi|saddle|honey", t):
            m = 0.6
        elif re.search(r"guard|half|butterfly|spider|lasso|de la riva|dlr|x.?guard|worm|z.?guard", t):
            m = 0.3
        elif re.search(r"standing|clinch|scramble|neutral|50.?50|double", t):
            return 0
        if bot:
            return -m
        if top:
            return m
        return -m * 0.6 if re.search(r"guard", t) else m * 0.7
    if re.search(r"escape|recover|defen[sc]|survive|extract|prevent|posture up|replace guard", t):
        return -0.3
    if re.search(r"pass|sweep|take|to back|to mount|to side|to crucifix|to truck|entry|elevator|berimbolo|finish", t):
        return 0.35
    return 0


# --------------------------------------------------------------------------- #
# joins
# --------------------------------------------------------------------------- #
def name_join(g):
    """graph.json (section, name) -> (section, hub) over /attacker nodes; refuses a non-injective key."""
    out, dup = {}, []
    for cat in ("transitions", "submissions"):
        for k, n in g[cat].items():
            if k.endswith("/attacker"):
                key = (cat, n["name"])
                if key in out:
                    dup.append(key)
                out[key] = (cat, n["hub"])
    return out, dup


def tech_of(g, key):
    cat, hub = key
    return g[cat][hub + "/attacker"]


def table_success(tech):
    """drawOutcome over the WHOLE table (L17262-17287, momentumSkew 0): P(success cell)."""
    w = [max(0.0, float(o["probability"] or 0)) for o in tech["outcomes"]]
    tot = sum(w)
    return sum(x for x, o in zip(w, tech["outcomes"]) if o["result"] == "success") / tot


def chained_share(tech):
    """Share of a card's whole table on hub-target (chained) cells — A6's exposure."""
    tot = sum(float(o["probability"]) for o in tech["outcomes"])
    return sum(float(o["probability"]) for o in tech["outcomes"]
               if o["to"] != "game-over" and not (o["to"].endswith("/top") or o["to"].endswith("/bottom"))) / tot


# --------------------------------------------------------------------------- #
# the escape payload
# --------------------------------------------------------------------------- #
def qhash(q):
    """The app's FNV-1a over UTF-16 code units (L11346): the submission-details file name."""
    h = 0x811C9DC5
    b = str(q or "").encode("utf-16-le")
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF                      # Math.imul(h, 0x01000193) >>> 0
    return "%08x" % h


def load_submission_choices(titles):
    """
    loadSubmissionChoices (L12438-12451): submission-details/<qhash(title)>.json, payload[title].choices.
    Returns ({title: choices}, [titles the app could not load], number of .json files in the directory).
    """
    if not os.path.isdir(DETAILS):
        raise SystemExit("[app_game] the submission-details payload is missing: %s\n  emit it first with: %s"
                         % (os.path.relpath(DETAILS, REPO), EMIT_CMD))
    out, missing = {}, []
    for t in sorted(titles):
        path = os.path.join(DETAILS, qhash(t) + ".json")
        body = None
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as fh:
                body = json.load(fh).get(t)
        if not body or not isinstance(body.get("choices"), list) or not body["choices"]:
            missing.append(t)                  # the app throws: "Submission has no defensive responses"
            continue
        out[t] = body["choices"]
    files = sum(1 for f in os.listdir(DETAILS) if f.endswith(".json"))
    return out, missing, files


# --------------------------------------------------------------------------- #
# the chain
# --------------------------------------------------------------------------- #
# The app's moveCount, as one label per transient cell (the H 9..12 columns):
Z, U1, U2, C = 0, 1, 2, 3
#   Z   0 moves        my stay-put miss: enterFailCal early-returns into opponentDefend (L17401)
#   U1  +1, UNCHECKED  my miss travel (enterFailCal L17407: no maxMoves test), an escape landing
#                      (L17485), and layer (b)'s finish-miss landing (it stands where the escape would)
#   U2  +2, UNCHECKED  my MISSED submission: the entry travel into the submission state (enterAttempt
#                      L16977) and the miss travel out of it (L17407). Never a stay-put: currentPos is
#                      the submission state, so dest !== currentPos at L17401
#   C   +1, CHECKED    my success travel (enterSuccessCal L17387-17388) and their positional move
#                      (L17628-17629): moveCount >= maxMoves -> endRound("reset"), a draw
# plus one flag, PRIME: the landing leaves currentPos on the OPPONENT's member. opponentDefend's
# positional move sets currentPos = rr.idx, the member of the role in THEIR frame (L17607, L17628),
# and nothing canonicalises it to mine (canonicalState is the identity off the alias hubs), so my
# next stay-put miss is a TRAVEL (+1, unchecked). Every other writer of currentPos lands on MY member:
# my success (L17387) and my miss (L17407) resolve the outcome's own role, an escape canonicalises to
# its destinationRole (L17485), L17556 picks my member explicitly, and startRoll re-seats a Standing
# start onto the drawn seat's member (L16430) — so a roll OPENS on MY, never PRIME.
CLOCK_LEVELS = ("kernel ply rule",
                "+ round-limit checks",
                "+ submission entry",
                "+ currentPos member")


def build_chain(K, their, my_p=None, kept_lab=(C, True)):
    """
    The kernel's cells with THEIR rows at `their` replaced, my odds optionally re-priced, and every
    transient cell labelled for the app clock.

    their     {role-node r: "draw" | [(dst, mass, label, prime)]}: explicit THEIR rows in MY frame;
              dst is a transient index, or -1-k for absorbing column k.
    my_p      None, or an array over K.actions: the success probability each of MY cards resolves at
              (only my actions are read).
    kept_lab  (label, prime) of a KEPT kernel THEIR row (A4/A9 states; A11 measures the choice).
    Returns the cell arrays and the worst row-sum deviation.
    """
    c = K.cells
    n_r, n_t = K.n_r, K.n_t
    replaced = np.zeros(n_t, dtype=bool)
    for r in their:
        replaced[n_r + r] = True
    keep = ~replaced[c["src"]]
    src, dst, kply = c["src"][keep], c["dst"][keep], c["plies"][keep]
    br, act = c["branch"][keep], c["act"][keep]
    mass = c["mass"][keep].copy()
    mine = (src < n_r) & (act >= 0)
    if my_p is not None:
        p2 = np.asarray(my_p, dtype=float)[act[mine]]
        mass[mine] = c["wcw"][keep][mine] * np.where(br[mine] == 0, p2, 1.0 - p2)
    is_sub = np.array([a["cat"] == "submissions" for a in K.actions] + [False])   # act = -1 -> False
    my = src < n_r
    lab = np.full(len(src), C, dtype=np.int8)       # my success (keeps my turn) and a success-branch
    lab[my & (kply != 0) & (br == 1)] = U1          #   chained landing stay CHECKED; a miss travels
    lab[my & (kply == 0)] = Z                       # the stay-put rule
    sub_miss = mine & is_sub[act] & (br == 1) & (dst >= 0)
    kept_their = ~my & (dst >= 0)
    lab[kept_their] = kept_lab[0]
    prime = kept_their & (dst < n_r) & bool(kept_lab[1])
    rs, rd, rm, rl, rp = [], [], [], [], []
    for r in sorted(their):
        cells = their[r]
        if cells == "draw":
            cells = [(-1 - ID, 1.0, C, False)]      # endRound("reset")
        for d, m, lb, pr in cells:
            rs.append(n_r + r); rd.append(d); rm.append(m); rl.append(lb); rp.append(pr)
    n = len(rs)
    ch = {"src": np.concatenate([src, np.array(rs, dtype=src.dtype)]),
          "dst": np.concatenate([dst, np.array(rd, dtype=dst.dtype)]),
          "mass": np.concatenate([mass, np.array(rm, dtype=float)]),
          "kply": np.concatenate([kply, np.ones(n, dtype=kply.dtype)]),
          "lab": np.concatenate([lab, np.array(rl, dtype=np.int8)]),
          "prime": np.concatenate([prime, np.array(rp, dtype=bool)]),
          "sub_miss": np.concatenate([sub_miss, np.zeros(n, dtype=bool)])}
    rows = np.bincount(ch["src"], weights=ch["mass"], minlength=n_t)
    ch["row_dev"] = float(np.abs(rows - 1).max())
    return ch


def _augment(K, ch, level):
    """The clock's state space MY | THEIR | MY' (N = 3 n_r; MY' = MY turn with currentPos on the OPPONENT's
    member, see PRIME) under the first `level` rules. MY' rows
    are MY's cells with the stay-put (Z) turned into a travel (U1). Returns (Zm, U1m, U2m, Cm, R, s0)."""
    n_r, n_t = K.n_r, K.n_t
    N = n_t + n_r
    src, dst, mass = ch["src"], ch["dst"], ch["mass"]
    if level == 0:
        lab = np.where(ch["kply"] == 0, Z, C).astype(np.int8)       # every ply counts, and is checked
    else:
        lab = ch["lab"].copy()
        if level >= 2:
            lab[ch["sub_miss"]] = U2
    prime = ch["prime"] if level >= 3 else np.zeros(len(src), dtype=bool)
    my = src < n_r
    s2 = np.concatenate([src, src[my] + n_t])
    d2 = np.concatenate([dst, dst[my]])
    m2 = np.concatenate([mass, mass[my]])
    l2 = np.concatenate([lab, np.where(lab[my] == Z, U1, lab[my]).astype(np.int8)])
    p2 = np.concatenate([prime, prime[my]])
    col = np.where(p2 & (d2 >= 0) & (d2 < n_r), d2 + n_t, d2)
    tr = col >= 0

    def M(sel):
        return sp.csr_matrix((m2[sel], (s2[sel], col[sel])), shape=(N, N))
    mats = tuple(M(tr & (l2 == x)) for x in (Z, U1, U2, C))
    R = sp.csr_matrix((m2[~tr], (s2[~tr], -1 - col[~tr])), shape=(N, 3)).toarray()
    s0 = np.zeros(N)
    s0[:n_t] = K.start("standing", "me")               # MY: startRoll L16430 (see PRIME above)
    return mats + (R, s0)


def app_clock(K, ch, level):
    """
    P(I finish), P(they finish) before the round clock resets the roll, mean over maxMoves = 9..12
    (L16354), from standing, under the first `level` rules of CLOCK_LEVELS (level 0 = the kernel's
    ply rule, which reproduces `Kernel.finite_horizon`). State (transient t, moveCount c); backward in c:
        f[c] = R + Z f[c] + U1 f[c+1] + U2 f[c+2] + C (f[c+1] if c+1 < maxMoves else reset)
    and f[c >= maxMoves] = `over`: past maxMoves the roll goes on through UNCHECKED moves only, and
    the next checked move resets it.
    """
    Zm, U1m, U2m, Cm, R, s0 = _augment(K, ch, level)
    R = R[:, :2]
    I = sp.identity(len(s0), format="csc")
    lu0 = spla.splu((I - Zm).tocsc())
    over = spla.splu((I - Zm - U1m - U2m).tocsc()).solve(R)
    vals = []
    for H in HORIZONS:
        f = {H: over, H + 1: over}
        for cnt in range(H - 1, -1, -1):
            rhs = R + U1m @ f[cnt + 1] + U2m @ f[min(cnt + 2, H + 1)]
            if cnt + 1 < H:
                rhs = rhs + Cm @ f[cnt + 1]
            f[cnt] = lu0.solve(rhs)
        vals.append(s0 @ f[0])
    m = np.mean(vals, axis=0)
    return float(m[0]), float(m[1])


def augmented_absorption(K, ch, level):
    """H = inf on the clock's own state space (a control: MY' must absorb exactly as MY)."""
    Zm, U1m, U2m, Cm, R, s0 = _augment(K, ch, level)
    A = sp.identity(len(s0), format="csc") - (Zm + U1m + U2m + Cm).tocsc()
    return s0 @ spla.splu(A).solve(R)


def measures(K, ch, clock=True):
    """From standing, me first: H = inf absorption, and the H = 9..12 clock at every CLOCK_LEVEL."""
    n_t = K.n_t
    src, dst, mass = ch["src"], ch["dst"], ch["mass"]
    tr = dst >= 0
    Q = sp.csr_matrix((mass[tr], (src[tr], dst[tr])), shape=(n_t, n_t))
    Rd = sp.csr_matrix((mass[~tr], (src[~tr], -1 - dst[~tr])), shape=(n_t, 3)).toarray()
    A = sp.identity(n_t, format="csc") - Q.tocsc()
    B = spla.splu(A).solve(Rd)
    pw, pl, pd = (float(x) for x in K.start("standing", "me") @ B)
    out = {"pW": pw, "pL": pl, "pD": pd, "lu_residual": float(np.abs(A @ B - Rd).max())}
    if clock:
        lv = [app_clock(K, ch, level) for level in range(len(CLOCK_LEVELS))]
        out["clock_levels"] = [list(x) for x in lv]
        out["hW"], out["hL"] = lv[-1]
        out["hW_kply"], out["hL_kply"] = lv[0]
    return out


def _mean(ms):
    out = {k: float(np.mean([m[k] for m in ms])) for k in ("pW", "pL", "pD")}
    if "clock_levels" in ms[0]:
        cl = np.mean([m["clock_levels"] for m in ms], axis=0)
        out["clock_levels"] = [[float(a), float(b)] for a, b in cl]
        out["hW"], out["hL"] = out["clock_levels"][-1]
        out["hW_kply"], out["hL_kply"] = out["clock_levels"][0]
    return out


# --------------------------------------------------------------------------- #
# one frame
# --------------------------------------------------------------------------- #
LAYER_NAMES = (("a", "(a) kernel (corpus game)"),
               ("b", "(b) + app opponent choice rule"),
               ("c_uniform", "(c) + app escape, uniform escape pick"),
               ("c_best", "(c) + app escape, max-e escape pick"),
               ("d_uniform", "(d) + aiMod on my cards, uniform escape"),
               ("d_best", "(d) + aiMod on my cards, max-e escape"))
LAYER_SPEC = {"b": (None, False), "c_uniform": ("uniform", False), "c_best": ("best", False),
              "d_uniform": ("uniform", True), "d_best": ("best", True)}


class FrameRun:
    """Everything for one ruleset: kernel, port, S_app, escapes, per-aiSkill app policies, chains."""

    def __init__(self, frame, wire_text, g, choices, rates="shipped"):
        self.frame = frame
        self.K = K = load_kernel(frame, rates=rates, graph=g)    # rates="frame": A5's exposure only
        self.g = g
        self.A = AppPort(wire_text, frame)
        self.n2k, self.dup = name_join(g)
        self.chains_built = 0
        self.worst_row = 0.0
        A = self.A
        # S_app: kernel-live, not a control alias, and the app draws the state in this frame
        self.S_app, self.kept = [], {"alias": [], "not_live": [], "app_masked": [], "no_wire_position": []}
        for r, s in enumerate(K.role_nodes):
            hub, pr = s.rsplit("/", 1)
            if hub not in A.pos_hub:
                self.kept["no_wire_position"].append(r)
            elif hub in A.alias_hubs:
                self.kept["alias"].append(r)
            elif s not in K.live:
                self.kept["not_live"].append(r)
            elif not A.mask[A.mem(A.pos_hub[hub], pr)]:
                self.kept["app_masked"].append(r)
            else:
                self.S_app.append(r)
        lu = K.fundamental()
        self.visits = lu.solve(K.start("standing", "me"), "T")
        self._opp = {}
        self._my_cards()
        self._escapes(choices)

    def key_of(self, k):
        n = self.A.nodes[k]
        return self.n2k.get((n["ty"], n["t"]))

    # ---- my cards' prices -------------------------------------------------------------
    def _my_cards(self):
        """kernel action -> its wire node, for moveChance under aiMod (L17010-17020)."""
        K, A = self.K, self.A
        k2w = {}
        for i, h in enumerate(A.hub_src):
            if h["ty"] != POS:
                key = self.n2k.get((h["ty"], h["t"]))
                if key is not None:
                    k2w[key] = i
        acts = K.actions
        self.act_p = np.array([a["p"] for a in acts])
        self.act_mine = np.array([a["performer"] == "me" for a in acts])
        self.act_r = np.array([a["t"] if a["performer"] == "me" else 0 for a in acts])
        self.act_sub = np.array([a["performer"] == "me" and a["cat"] == "submissions" for a in acts])
        mod = np.zeros(len(acts))
        self.sub_state_oppval = []
        for i, a in enumerate(acts):
            if not self.act_sub[i]:
                continue
            wi = k2w.get((a["cat"], a["target"]))
            if wi is None:
                raise SystemExit("[app_game] %s: my submission card %r has no wire node" % (self.frame, a["target"]))
            node = A.nodes[A.rep(wi)]              # enterAttempt L16977: currentPos = sub.idx, the attacker
            ov = A.opp_val(node, node["fromRole"])  # ... and playerRole = sub.fromRole
            self.sub_state_oppval.append(ov)
            mod[i] = 0.4 * max(0, ov)
        self.act_sub_mod = mod

    def aimod(self, ai):
        """aiMod per role-node (L17016): 0.4 * max(0, oppVal(currentPos)) + aiSkill. oppVal reads the
        hub's `s` through playerRole, so it is the same on both members (MY and MY')."""
        A, K = self.A, self.K
        out = np.zeros(K.n_r)
        for r, s in enumerate(K.role_nodes):
            hub, pr = s.rsplit("/", 1)
            node = A.nodes[A.mem(A.pos_hub[hub], pr)]
            out[r] = max(0, A.opp_val(node, pr)) * 0.4 + float(ai)
        return out

    def my_prices(self, ai, sub_pricing="state"):
        """
        MY cards' success probability under aiMod (L17019: clamp(p - aiMod, .05, .95)). A positional
        card is rolled where I stand. A SUBMISSION picked from a position hand is not: enterAttempt
        (L16970-16981) travels into the submission STATE, and its Finish is rolled there with
        currentPos = the submission, whose oppVal is s[1] (< 0 on every wire submission), so aiMod is
        0.4 * max(0, s[1]) + aiSkill. sub_pricing="position" is the pre-fix pricing (a MUTANT).
        """
        pos = self.aimod(ai)[self.act_r]
        if sub_pricing == "state":
            mod = np.where(self.act_sub, self.act_sub_mod + float(ai), pos)
        elif sub_pricing == "position":
            mod = pos
        else:
            raise ValueError(sub_pricing)
        return np.where(self.act_mine, np.clip(self.act_p - mod, 0.05, 0.95), self.act_p)

    # ---- the escape cards ------------------------------------------------------------
    def _escapes(self, choices):
        """Per submission (attacker member): the escape cards enterDefense deals in this frame, as
        (kernel landing state, escape term, lands-on-alias)."""
        K, A = self.K, self.A
        self.esc, st, terms = {}, Counter(), []
        for i, h in enumerate(A.hub_src):
            if h["ty"] != "submissions":
                continue
            k = A.rep(i)
            st["submissions"] += 1
            ch = choices.get(h["t"])
            if ch is None:
                st["submissions without a loadable payload"] += 1
                self.esc[k] = []
                continue
            opts, dropped = A.submission_defenses(k, ch)
            st["choices"] += len(ch)
            for why, n in sorted(dropped.items()):
                st["choices dropped: " + why] += n
            rows = []
            for o in opts:
                dest = A.nodes[o["res"]]
                alias = dest["ty"] != POS           # canonicalState re-routed an alias hub (A4)
                at = A.nodes[o["at"]] if alias else dest
                kidx = K.index.get("%s/%s" % (at["posId"], o["role"]))
                if kidx is None:
                    raise SystemExit("[app_game] %s: escape %r of %s lands outside the kernel (%s/%s)"
                                     % (self.frame, o["label"], h["t"], at["posId"], o["role"]))
                term = A.escape_term(k, o["res"])
                terms.append(term)
                st["choices dealt"] += 1
                st["choices landing on a control alias (A4)"] += alias
                st["choices landing on a kernel-non-live state"] += K.role_nodes[kidx] not in K.live
                rows.append((kidx, term, alias))
            if not rows:
                st["submissions dealing no escape in this ruleset"] += 1
            self.esc[k] = rows
        t = np.array(terms)
        self.esc_stats = dict(sorted(st.items()))
        self.esc_terms = {"n": int(len(t)), "positive": int((t > 0).sum()), "min": float(t.min()),
                          "max": float(t.max()), "mean": float(t.mean())}

    def _escape_es(self, k, tech, ai, delta=True, base="folded"):
        """escapeChance (L15201-15209) of every escape card of submission k:
        e = clamp(.08, .92, (1 - p_sub) + term + dmod - aiSkill + momentum), dmod = momentum = 0 (A8)."""
        if base == "folded":
            p_sub = tech["successRate"] / 100.0                                 # A5
        elif base == "frame":
            p_sub = self.A.cal_success(self.A.nodes[k])                         # calSuccess(sub)
        else:
            raise ValueError(base)
        return [_clamp(0.08, 0.92, (1 - p_sub) + (term if delta else 0.0) + 0 - float(ai) + 0)
                for _kidx, term, _al in self.esc[k]]

    def _escape_cells(self, k, tech, share, ai, choice, delta=True, base="folded"):
        """enterDefense (L17413-17495) as cells: I pick one escape card; with probability e it lands me
        on its destination, MY turn, my own member, +1 unchecked (L17478-17486); else the tap (L17489)."""
        rows = self.esc[k]
        if not rows:
            raise SystemExit("[app_game] %s: the opponent finishes with %s, which deals no escape card "
                             "(the app throws, L17445)" % (self.frame, self.A.nodes[k]["t"]))
        es = self._escape_es(k, tech, ai, delta, base)
        if choice == "uniform":
            w = [1.0 / len(rows)] * len(rows)
        elif choice == "best":
            j = es.index(max(es))                  # the first card of the highest printed escape odds
            w = [1.0 if i == j else 0.0 for i in range(len(rows))]
        else:
            raise ValueError(choice)
        cells = []
        for (kidx, _term, _al), e, wi in zip(rows, es, w):
            if wi > 0:
                cells.append((-1 - IL, share * wi * (1.0 - e), U1, False))
                cells.append((kidx, share * wi * e, U1, False))
        return cells

    # ---- THEIR rows ------------------------------------------------------------------
    def app_opp(self, r, ai, order="app", pfin_override=None):
        memo = (r, float(ai), order, pfin_override)
        if memo not in self._opp:
            hub, pr = self.K.role_nodes[r].rsplit("/", 1)
            self._opp[memo] = self.A.opponent(self.A.pos_hub[hub], pr, ai, order, pfin_override)
        return self._opp[memo]

    def _table_cells(self, r, tech, share, p, stay, lab, prime):
        """One card of THEIRS resolved at success probability p through `_expand` (branch weights
        exactly as the kernel's), outcomes in THEIR frame flipped into mine. `stay` turns a game-over
        cell into MY turn at r: the positional submission (L17607: intendDest = currentPos), +1 checked."""
        cells = []
        for bi, cw, oc, _fin in _expand(self.g, tech, p):
            m = share * cw * (p if bi == 0 else 1.0 - p)
            kind = oc[0]
            if kind is W:                              # THEY finish -> I lose (or stay-put)
                cells.append((r, m, C, False) if stay else (-1 - IL, m, lab, False))
            elif kind is L:                            # their chained miss finishes them
                cells.append((-1 - IW, m, lab, False))
            else:
                cells.append((self.K.index[flip(oc[1])], m, lab, prime))
        return cells

    def their_app(self, ai, escape=None, order="app", pfin_override=None, delta=True, base="folded"):
        """
        THEIR rows for every S_app state. escape=None is layer (b): a finish resolves at the
        submission's own rate over its own table. escape="uniform"|"best" is (c)/(d): it resolves by
        MY escape. delta=False / base="frame" are the mutant / the A5 sensitivity.
        """
        g, out = self.g, {}
        for r in self.S_app:
            info = self.app_opp(r, ai, order, pfin_override)
            if info["draw"]:
                out[r] = "draw"
                continue
            cells = []
            for k, share, mode in info["plays"]:
                key = self.key_of(k)
                tech = tech_of(g, key)
                if mode != "finish":                                    # drawOutcome, L17605-17629
                    cells += self._table_cells(r, tech, share, table_success(tech),
                                               key[0] == "submissions", C, True)
                elif escape is None:
                    cells += self._table_cells(r, tech, share, tech["successRate"] / 100.0, False, U1, False)
                else:
                    cells += self._escape_cells(k, tech, share, ai, escape, delta, base)
            out[r] = cells
        return out

    def their_kernel(self):
        """THE MUTANT: the kernel's own opponent at every S_app state, through the same builder and
        with the label a kept kernel row carries, so it must reproduce the unreplaced chain."""
        out = {}
        for r in self.S_app:
            hand = self.K.model.opp_hands[r]
            tot = sum(a.weight for a in hand)
            if not hand or tot <= 0:
                out[r] = "draw"
                continue
            cells = []
            for a in hand:
                cells += self._table_cells(r, tech_of(self.g, (a.cat, a.target)), a.weight / tot, a.p,
                                           False, C, True)
            out[r] = cells
        return out

    def chain(self, their, my_p=None, clock=True, kept_lab=(C, True), raw=False):
        ch = build_chain(self.K, their, my_p, kept_lab)
        self.chains_built += 1
        self.worst_row = max(self.worst_row, ch["row_dev"])
        if ch["row_dev"] > 1e-12:
            raise SystemExit("[app_game] %s: a built chain's rows do not sum to 1 (max |row-1| %.3g)"
                             % (self.frame, ch["row_dev"]))
        return ch if raw else measures(self.K, ch, clock)

    def layer(self, tag, order="app", clock=True, delta=True, base="folded", sub_pricing="state",
              kept_lab=(C, True), grid=AISKILL, pfin_override=None):
        if tag == "a":
            return self.chain({}, None, clock, kept_lab)
        escape, me = LAYER_SPEC[tag]
        return _mean([self.chain(self.their_app(ai, escape, order, pfin_override, delta, base),
                                 self.my_prices(ai, sub_pricing) if me else None, clock, kept_lab)
                      for ai in grid])

    def layers(self, order="app", clock=True):
        return {tag: self.layer(tag, order, clock) for tag, _name in LAYER_NAMES}

    # ---- the policy comparison --------------------------------------------------------
    def policy(self):
        K = self.K
        vT = {r: float(self.visits[K.n_r + r]) for r in self.S_app}
        rows = []
        stats = Counter()
        for r in self.S_app:
            infos = [self.app_opp(r, ai) for ai in AISKILL]
            cands = [tuple(sorted(self.key_of(k) for k in i["subs"] + i["trans"])) for i in infos]
            if len(set(cands)) != 1:
                raise SystemExit("[app_game] candidate set depends on aiSkill at %s — it must not"
                                 % K.role_nodes[r])
            cand = set(cands[0])
            pi_a = Counter()
            for i in infos:
                for k, share, _mode in i["plays"]:
                    pi_a[self.key_of(k)] += share / len(infos)
            hand = K.model.opp_hands[r]
            tot = sum(a.weight for a in hand) or 1.0
            pi_k = Counter()
            for a in hand:
                pi_k[(a.cat, a.target)] += a.weight / tot
            keys = sorted(set(pi_a) | set(pi_k))
            tv = 0.5 * sum(abs(pi_a.get(k, 0.0) - pi_k.get(k, 0.0)) for k in keys)
            never = sum(1 for k in sorted(cand) if k not in pi_k) / len(cand) if cand else 0.0
            lost = sum(pi_k[k] for k in sorted(pi_k) if pi_a.get(k, 0.0) <= 0)
            sub_a = sum(v for k, v in sorted(pi_a.items()) if k[0] == "submissions")
            sub_k = sum(v for k, v in sorted(pi_k.items()) if k[0] == "submissions")
            rows.append((vT[r], tv, never, lost, sub_a, sub_k))
            stats["cards dealt to the app opponent"] += len(cand)
            stats["origin-relaxed fallback hands"] += infos[0]["relaxed"]
            stats["no move (endRound reset)"] += infos[0]["draw"]
            stats["subs only (positional pick is a submission)"] += (not infos[0]["draw"]
                                                                     and not infos[0]["trans"])
            tops = {frozenset(i["top"]) for i in infos}
            stats["top-3 set depends on aiSkill"] += len(tops) > 1
            adj_tops = {frozenset(self.app_opp(r, ai, "adj")["top"]) for ai in AISKILL}
            stats["top-3 set differs under adj-order tie-break"] += adj_tops != tops
            stats["dealt opponent cards with a chained cell"] += sum(
                1 for k in sorted(cand) if chained_share(tech_of(self.g, k)) > 0)
        w = np.array([x[0] for x in rows])
        arr = np.array([x[1:] for x in rows])
        uni = arr.mean(axis=0)
        wtd = (arr * w[:, None]).sum(axis=0) / w.sum()
        names = ("tv", "cand_never_in_kernel", "kernel_mass_app_never_plays", "p_sub_app", "p_sub_kernel")
        return {"states": len(self.S_app),
                "uniform": dict(zip(names, (float(x) for x in uni))),
                "weighted": dict(zip(names, (float(x) for x in wtd))),
                "their_turn_visits_in_S_app": float(w.sum()),
                "counts": dict(sorted(stats.items()))}

    def chained_mass(self):
        """A6's exposure: THEIR-turn probability mass, per roll from standing, on chained cells the
        app opponent's positional draws flatten (mean over the aiSkill grid)."""
        acc = 0.0
        for ai in AISKILL:
            for r in self.S_app:
                for k, share, mode in self.app_opp(r, ai)["plays"]:
                    if mode == "table":
                        acc += self.visits[self.K.n_r + r] * share * chained_share(tech_of(self.g, self.key_of(k)))
        return acc / len(AISKILL)

    def escape_exposure(self):
        """The opponent's finish attempts per roll and the escape odds they meet, weighted like the
        policy table (kernel THEIR-turn visits from standing), mean over the aiSkill grid."""
        acc = Counter()
        for ai in AISKILL:
            for r in self.S_app:
                v = float(self.visits[self.K.n_r + r]) / len(AISKILL)
                for k, share, mode in self.app_opp(r, ai)["plays"]:
                    if mode != "finish":
                        continue
                    tech = tech_of(self.g, self.key_of(k))
                    es = self._escape_es(k, tech, ai)
                    e0 = self._escape_es(k, tech, ai, delta=False)
                    wgt = v * share
                    acc["attempts"] += wgt
                    acc["e_uniform"] += wgt * float(np.mean(es))
                    acc["e_best"] += wgt * max(es)
                    acc["e_no_term"] += wgt * float(np.mean(e0))
                    acc["alias"] += wgt * sum(e for e, row in zip(es, self.esc[k]) if row[2]) / len(es)
        a = acc["attempts"]
        return {"finish_attempts_per_roll": a,
                "mean_escape_odds_uniform": acc["e_uniform"] / a,
                "mean_escape_odds_best": acc["e_best"] / a,
                "mean_escape_odds_without_the_term": acc["e_no_term"] / a,
                "escaped_onto_a_control_alias_per_roll_uniform": acc["alias"]}

    def coverage(self):
        K, A = self.K, self.A
        techs = [n for n in A.nodes if n["ty"] != POS and n["role"] == "attacker"]
        joined = sum(1 for n in techs if (n["ty"], n["t"]) in self.n2k)
        kcards = [(a.cat, a.target) for h in K.model.opp_hands for a in h]
        wire_keys = {self.n2k.get((n["ty"], n["t"])) for n in techs}
        kept_visits = {k: float(sum(self.visits[K.n_r + r] for r in v)) for k, v in self.kept.items()}
        rate_fork = sum(1 for n in techs if n["cal"] and A.cal_success(n) is not None
                        and abs(A.cal_success(n) - n["cal"]["successRate"] / 100) > 1e-12)
        ov = np.array(self.sub_state_oppval)
        return {"wire_techniques": len(techs), "wire_techniques_joined": joined,
                "join_duplicates": len(self.dup),
                "kernel_opponent_cards": len(kcards),
                "kernel_opponent_cards_on_wire": sum(1 for k in kcards if k in wire_keys),
                "kernel_hubs": len({s.rsplit("/", 1)[0] for s in K.role_nodes}),
                "kernel_hubs_on_wire": len({s.rsplit("/", 1)[0] for s in K.role_nodes} & set(A.pos_hub)),
                "S_app_states": len(self.S_app),
                "kept_kernel_rows": {k: len(v) for k, v in self.kept.items()},
                "kept_kernel_their_turn_visits": kept_visits,
                "their_turn_visits_total": float(self.visits[K.n_r:].sum()),
                "techniques_whose_app_calSuccess_differs_from_folded_rate": rate_fork,
                "my_submission_cards": int(len(ov)),
                "my_submission_cards_in_state_oppval_positive": int((ov > 0).sum()),
                "my_submission_state_oppval_range": [float(ov.min()), float(ov.max())],
                "escapes": self.esc_stats,
                "escape_term": self.esc_terms,
                "chains_built": self.chains_built, "worst_row_deviation": self.worst_row,
                "port_fallbacks": dict(sorted(A.counters.items()))}


# --------------------------------------------------------------------------- #
# run, print
# --------------------------------------------------------------------------- #
AISKILL_FINE = np.linspace(0.06, 0.20, 13)     # A2's exposure: the same interval, twice as fine


def run(wire_text=None, g=None):
    wire_text = wire_text if wire_text is not None else load_wire_text()
    g = g if g is not None else load_graph()
    titles = sorted({n["t"] for n in json.loads(wire_text)["nodes"] if n["ty"] == "submissions"})
    choices, missing, files = load_submission_choices(titles)
    out, runs = {}, {}
    for frame in FRAMES:
        F = FrameRun(frame, wire_text, g, choices)
        runs[frame] = F
        lay = F.layers("app")
        adj = F.layers("adj", clock=False)
        pol = F.policy()
        d = lay["d_uniform"]
        mech = {
            "c_uniform_without_escape_term": F.layer("c_uniform", delta=False),
            "d_uniform_without_escape_term": F.layer("d_uniform", delta=False),
            "d_uniform_submission_priced_at_the_position": F.layer("d_uniform", sub_pricing="position"),
        }
        expo = {
            "A2_d_uniform_13_point_grid": F.layer("d_uniform", grid=AISKILL_FINE),
            "A5_d_uniform_escape_base_at_calSuccess_frame": F.layer("d_uniform", base="frame"),
            "A11_d_uniform_kept_rows_as_state_responses": F.layer("d_uniform", kept_lab=(U1, False)),
            "A5_d_uniform_every_rate_at_calSuccess_frame":
                FrameRun(frame, wire_text, g, choices, rates="frame").layer("d_uniform", base="frame"),
        }
        out[frame] = {
            "layers": lay,
            "sensitivity_adj_order_tiebreak": {k: adj[k] for k in LAYER_SPEC},
            "mechanisms": mech,
            "exposures": {k: {"pW": v["pW"], "hW": v["hW"], "dpW_vs_d_uniform": v["pW"] - d["pW"],
                              "dhW_vs_d_uniform": v["hW"] - d["hW"]} for k, v in expo.items()},
            "policy": pol,
            "escape_exposure": F.escape_exposure(),
            "their_turn_mass_on_flattened_chained_cells": F.chained_mass(),
            "coverage": F.coverage(),
        }
    out["submission_details"] = {"wire_submissions": len(titles), "loaded_by_qhash": len(choices),
                                 "missing": missing, "files_in_directory": files,
                                 "choices": sum(len(v) for v in choices.values())}
    out["approximations"] = dict(APPROXIMATIONS)
    out["aiskill_grid"] = [float(x) for x in AISKILL]
    out["horizons"] = list(HORIZONS)
    out["clock_levels"] = list(CLOCK_LEVELS)
    return out, runs


def report(out):
    sd = out["submission_details"]
    print("escape payload: %d/%d wire submissions loaded by qhash from %d files, %d escape choices, missing %s"
          % (sd["loaded_by_qhash"], sd["wire_submissions"], sd["files_in_directory"], sd["choices"],
             sd["missing"] or "none"))
    for frame in FRAMES:
        r = out[frame]
        lay, cov, pol = r["layers"], r["coverage"], r["policy"]
        print("== %s   from standing, me first; aiSkill integrated on %d points of [%.2f, %.2f]"
              % (frame, len(AISKILL), AISKILL[0], AISKILL[-1]))
        print("   %-42s %9s %8s %8s | %-26s | %s" % ("", "H = inf", "", "", "app clock, H 9..12",
                                                     "kernel ply rule"))
        print("   %-42s %9s %8s %8s | %8s %8s %8s | %s" % ("layer", "P(I fin)", "P(they)", "P(draw)",
                                                        "P(I fin)", "P(they)", "P(no)", "P(I fin)  P(they)"))
        for tag, name in LAYER_NAMES:
            m = lay[tag]
            print("   %-42s %9.4f %8.4f %8.4f | %8.4f %8.4f %8.4f | %8.4f %8.4f"
                  % (name, m["pW"], m["pL"], m["pD"], m["hW"], m["hL"], 1 - m["hW"] - m["hL"],
                     m["hW_kply"], m["hL_kply"]))
        print("   H 9..12 P(I finish) / P(they finish), each column adds one moveCount rule to the one before:")
        print("     %-10s %s" % ("", "  ".join("%-17s" % x for x in CLOCK_LEVELS)))
        for tag, _name in LAYER_NAMES:
            print("     %-10s %s" % (tag, "  ".join("%-17s" % ("%.4f / %.4f" % tuple(x))
                                                      for x in lay[tag]["clock_levels"])))
        mech = r["mechanisms"]
        print("   mechanisms, P(I finish) H=inf | app clock:")
        for label, tag, key in (("escape term (L15208), (c) uniform", "c_uniform", "c_uniform_without_escape_term"),
                                ("escape term (L15208), (d) uniform", "d_uniform", "d_uniform_without_escape_term"),
                                ("my Finish priced in the submission state, (d) uniform", "d_uniform",
                                 "d_uniform_submission_priced_at_the_position")):
            a, b = lay[tag], mech[key]
            print("     %-56s with %.4f | %.4f   without %.4f | %.4f   delta %+.4f | %+.4f"
                  % (label, a["pW"], a["hW"], b["pW"], b["hW"], a["pW"] - b["pW"], a["hW"] - b["hW"]))
        sa = r["sensitivity_adj_order_tiebreak"]
        print("   sensitivity — scratch audit's adj-order tie-break instead of _cmpDealt: P(I finish) H=inf %s"
              % "  ".join("%s %.4f" % (k, sa[k]["pW"]) for k in LAYER_SPEC))
        u, w = pol["uniform"], pol["weighted"]
        print("   opponent policy over S_app = %d states (kernel-live, non-alias, app-playable); "
              "weights = kernel THEIR-turn visits from standing (%.4f/roll)"
              % (pol["states"], pol["their_turn_visits_in_S_app"]))
        print("     %-58s uniform %.4f   weighted %.4f" % ("TV(pi_app, pi_kernel)", u["tv"], w["tv"]))
        print("     %-58s uniform %.4f   weighted %.4f" % ("share of the app's candidates the kernel never plays",
                                                          u["cand_never_in_kernel"], w["cand_never_in_kernel"]))
        print("     %-58s uniform %.4f   weighted %.4f" % ("share of the kernel's attempt mass the app never plays",
                                                          u["kernel_mass_app_never_plays"], w["kernel_mass_app_never_plays"]))
        print("     %-58s uniform %.4f   weighted %.4f" % ("P(opponent goes for a submission) — app",
                                                          u["p_sub_app"], w["p_sub_app"]))
        print("     %-58s uniform %.4f   weighted %.4f" % ("P(opponent goes for a submission) — kernel",
                                                          u["p_sub_kernel"], w["p_sub_kernel"]))
        print("     counts: %s" % "; ".join("%s %d" % kv for kv in pol["counts"].items()))
        es, et, ex = cov["escapes"], cov["escape_term"], r["escape_exposure"]
        print("   escapes (enterDefense's cards in %s): %s" % (frame, "; ".join("%s %d" % kv for kv in es.items())))
        print("     escape term on %d dealt escape cards: %d positive, range %+.4f..%+.4f, mean %+.4f; "
              "weighted by kernel THEIR-turn visits, %.4f finish attempts/roll meet mean escape odds %.4f "
              "uniform / %.4f max-e (%.4f without the term)"
              % (et["n"], et["positive"], et["min"], et["max"], et["mean"], ex["finish_attempts_per_roll"],
                 ex["mean_escape_odds_uniform"], ex["mean_escape_odds_best"],
                 ex["mean_escape_odds_without_the_term"]))
        print("     my submission cards %d: their state's oppVal in [%.3f, %.3f], %d positive (so aiMod = aiSkill "
              "on the rest)" % (cov["my_submission_cards"], cov["my_submission_state_oppval_range"][0],
                                cov["my_submission_state_oppval_range"][1],
                                cov["my_submission_cards_in_state_oppval_positive"]))
        kv = cov["kept_kernel_their_turn_visits"]
        print("   exposures (d uniform, P(I finish) H=inf | app clock):")
        print("     A2  13-point aiSkill grid moves it %+.5f | %+.5f"
              % (r["exposures"]["A2_d_uniform_13_point_grid"]["dpW_vs_d_uniform"],
                 r["exposures"]["A2_d_uniform_13_point_grid"]["dhW_vs_d_uniform"]))
        print("     A4  THEIR-turn visits/roll at alias states %.4f; escapes onto an alias %.5f/roll"
              % (kv["alias"], ex["escaped_onto_a_control_alias_per_roll_uniform"]))
        x5, y5 = (r["exposures"]["A5_d_uniform_escape_base_at_calSuccess_frame"],
                  r["exposures"]["A5_d_uniform_every_rate_at_calSuccess_frame"])
        print("     A5  %d wire techniques whose calSuccess differs from the folded rate in %s; the escape base "
              "at calSuccess moves it %+.5f | %+.5f, every rate at calSuccess (kernel rates=frame) %+.5f | %+.5f"
              % (cov["techniques_whose_app_calSuccess_differs_from_folded_rate"], frame,
                 x5["dpW_vs_d_uniform"], x5["dhW_vs_d_uniform"], y5["dpW_vs_d_uniform"], y5["dhW_vs_d_uniform"]))
        print("     A6  THEIR-turn mass/roll on flattened chained cells %.4f"
              % r["their_turn_mass_on_flattened_chained_cells"])
        print("     A9  kept kernel THEIR rows %s; their THEIR-turn visits/roll %s of %.4f"
              % (", ".join("%s %d" % x for x in cov["kept_kernel_rows"].items()),
                 ", ".join("%s %.4f" % x for x in kv.items()), cov["their_turn_visits_total"]))
        print("     A11 kept rows clocked as L17556's state response instead of a positional move: %+.5f | %+.5f"
              % (r["exposures"]["A11_d_uniform_kept_rows_as_state_responses"]["dpW_vs_d_uniform"],
                 r["exposures"]["A11_d_uniform_kept_rows_as_state_responses"]["dhW_vs_d_uniform"]))
        print("   coverage: wire techniques joined %d/%d; kernel opponent cards on the wire %d/%d; "
              "kernel hubs on the wire %d/%d; chains built %d (max |row-1| %.1e); port fallbacks %s"
              % (cov["wire_techniques_joined"], cov["wire_techniques"], cov["kernel_opponent_cards_on_wire"],
                 cov["kernel_opponent_cards"], cov["kernel_hubs_on_wire"], cov["kernel_hubs"],
                 cov["chains_built"], cov["worst_row_deviation"], cov["port_fallbacks"] or "none"))
    print("approximations (see the module docstring):")
    for k, v in APPROXIMATIONS:
        print("  %-4s %s" % (k, v))


# --------------------------------------------------------------------------- #
# the gate
# --------------------------------------------------------------------------- #
def selfcheck():
    checks = []

    def ok(name, cond, detail):
        checks.append((name, bool(cond), detail))

    wire_text = load_wire_text()
    g = load_graph()
    out, runs = run(wire_text, g)
    sd = out["submission_details"]
    ok("escape payload: every wire submission loads by qhash (loadSubmissionChoices)",
       sd["loaded_by_qhash"] == sd["wire_submissions"] == sd["files_in_directory"] > 200 and not sd["missing"]
       and sd["choices"] >= MIN_ESCAPE_CHOICES,
       "%d/%d loaded, %d files, %d choices (floor %d), missing %s"
       % (sd["loaded_by_qhash"], sd["wire_submissions"], sd["files_in_directory"], sd["choices"],
          MIN_ESCAPE_CHOICES, sd["missing"] or "none"))
    for frame in FRAMES:
        F, r = runs[frame], out[frame]
        K, A, cov = F.K, F.A, r["coverage"]
        lay = r["layers"]
        ok("[%s] wire technique join (section, name) -> graph.json" % frame,
           cov["wire_techniques_joined"] == cov["wire_techniques"] > 1000 and cov["join_duplicates"] == 0,
           "%d/%d joined, %d duplicate keys" % (cov["wire_techniques_joined"], cov["wire_techniques"],
                                               cov["join_duplicates"]))
        ok("[%s] every kernel opponent card and hub is on the wire" % frame,
           cov["kernel_opponent_cards_on_wire"] == cov["kernel_opponent_cards"] > 1000
           and cov["kernel_hubs_on_wire"] == cov["kernel_hubs"],
           "cards %d/%d, hubs %d/%d" % (cov["kernel_opponent_cards_on_wire"], cov["kernel_opponent_cards"],
                                        cov["kernel_hubs_on_wire"], cov["kernel_hubs"]))
        # the app draws on the wire's tables; this file resolves on graph.json's via _expand
        same = total = 0
        for h in A.hub_src:
            if h["ty"] == POS:
                continue
            total += 1
            tech = tech_of(g, F.n2k[(h["ty"], h["t"])])
            wo = [(str(o["to"]).lower(), float(o["probability"]), o["result"]) for o in h["cal"]["outcomes"]]
            go = [(str(o["to"]).lower(), float(o["probability"]), o["result"]) for o in tech["outcomes"]]
            same += wo == go
        ok("[%s] wire outcome tables == graph.json tables" % frame, same == total > 1000,
           "%d/%d identical" % (same, total))
        subs = [n for k, n in g["submissions"].items() if k.endswith("/attacker")]
        bad = [n["name"] for n in subs if chained_share(n) > 0
               or any(o["result"] == "success" and o["to"] != "game-over" for o in n["outcomes"])]
        ok("[%s] submissions: no chained cells, every success cell is game-over" % frame, not bad and subs,
           "%d submissions, %d violate (the finish, stay-put and U2 rules rest on it)" % (len(subs), len(bad)))
        # the site-adjacency claim of _deriveDualPairs (L1240-1253): both members see one technique set
        n_pos = sum(1 for h in A.hub_src if h["ty"] == POS)
        agree = 0
        for i, h in enumerate(A.hub_src):
            if h["ty"] != POS:
                continue
            ta = {k for k in A.adj[A.rep(i)] if A.nodes[k]["ty"] != POS}
            tb = {k for k in A.adj[A.low(i)] if A.nodes[k]["ty"] != POS}
            agree += ta == tb
        ok("[%s] port: both pair members carry the same technique set" % frame, agree == n_pos > 100,
           "%d/%d positions" % (agree, n_pos))
        # the port cross-check: scripts/regenerate_neural_data.py:170 states that in gi
        # backside-50-50/bottom has exactly ONE move surviving optionsFor, Heel Hook from Backside 50-50
        if frame == "gi":
            hi = A.pos_hub["backside-50-50"]
            ctx = {"cur": A.mem(hi, "bottom"), "pr": "bottom", "ai": float(AISKILL[0])}
            opts, relaxed = A.options_for(A.mem(hi, "bottom"), "bottom", ctx)
            names = [o["node"]["t"] for o in opts]
            ok("[gi] optionsFor(backside-50-50, bottom) == [Heel Hook from Backside 50-50]",
               names == ["Heel Hook from Backside 50-50"] and not relaxed,
               "main pass %s, relaxed=%s" % (names, relaxed))
        # the escape cards: every dealt finish deals at least one, and the term is read everywhere
        et, es = cov["escape_term"], cov["escapes"]
        ok("[%s] escape cards: resolved in the frame, term computed on each" % frame,
           et["n"] == es.get("choices dealt", 0) >= MIN_ESCAPE_CHOICES * 0.9
           and not es.get("submissions without a loadable payload") and not es.get("choices dropped: unresolved")
           and not A.counters.get("myVal dominance fallback"),
           "%d of %d choices dealt (%s), term > 0 on %d, range %+.4f..%+.4f; myVal fallbacks %d"
           % (et["n"], es.get("choices", 0), ", ".join("%s %d" % kv for kv in es.items() if "dropped" in kv[0]) or
              "none dropped", et["positive"], et["min"], et["max"], A.counters.get("myVal dominance fallback", 0)))
        ok("[%s] my submission cards joined to their wire state" % frame,
           cov["my_submission_cards"] >= 200,
           "%d cards; state oppVal in [%.3f, %.3f], %d positive"
           % (cov["my_submission_cards"], cov["my_submission_state_oppval_range"][0],
              cov["my_submission_state_oppval_range"][1], cov["my_submission_cards_in_state_oppval_positive"]))
        # MUTANT 1 — identity: the kernel's own opponent through this builder IS the kernel, at H = inf
        # and at EVERY clock level (it must equal the unreplaced chain), and level 0 IS the kernel's recursion
        m = F.chain(F.their_kernel())
        m0 = F.chain({})
        B, _res = K.absorption()
        s0 = K.start("standing", "me")
        ref = s0 @ B
        hw = np.mean([s0 @ K.finite_horizon(H)[0] for H in HORIZONS])
        hl = np.mean([s0 @ K.finite_horizon(H)[1] for H in HORIZONS])
        d = max(abs(m["pW"] - ref[IW]), abs(m["pL"] - ref[IL]), abs(m["hW_kply"] - hw), abs(m["hL_kply"] - hl),
                max(abs(a - b) for x, y in zip(m["clock_levels"], m0["clock_levels"]) for a, b in zip(x, y)))
        ok("[%s] MUTANT kernel opponent via the builder == kernel (H=inf, kernel recursion, all clock levels)"
           % frame, d < IDENTITY_TOL and len(F.S_app) >= MIN_REPLACED_STATES,
           "max |diff| %.2e over %d replaced THEIR rows (floor %d); P(I finish) %.12f"
           % (d, len(F.S_app), MIN_REPLACED_STATES, m["pW"]))
        # the clock's own state space absorbs exactly as the chain (MY' is MY with a different clock)
        chd = F.chain(F.their_app(float(AISKILL[3]), "uniform"), F.my_prices(float(AISKILL[3])), raw=True)
        md = measures(K, chd, clock=False)
        ab = augmented_absorption(K, chd, len(CLOCK_LEVELS) - 1)
        da = max(abs(ab[IW] - md["pW"]), abs(ab[IL] - md["pL"]), abs(ab[ID] - md["pD"]))
        ok("[%s] CONTROL the clock's augmented chain (MY | THEIR | MY') == the chain at H=inf" % frame,
           da < IDENTITY_TOL, "max |diff| %.2e on (d) uniform at aiSkill %.2f" % (da, AISKILL[3]))
        # a clock only truncates: never more finishes than H = inf, at any level, in any layer
        worst = max(max(x[0] - lay[t]["pW"], x[1] - lay[t]["pL"]) for t in lay for x in lay[t]["clock_levels"])
        ok("[%s] every clock level <= H=inf, for both finishes, in every layer" % frame, worst < 1e-12,
           "max excess %.2e" % worst)
        # MUTANT — every moveCount rule is live: each level moves (b) and (d) somewhere
        steps = []
        for t in ("b", "d_uniform"):
            cl = lay[t]["clock_levels"]
            steps += [max(abs(cl[i][0] - cl[i - 1][0]), abs(cl[i][1] - cl[i - 1][1])) for i in range(1, len(cl))]
        ok("[%s] MUTANT every moveCount rule moves the H 9..12 figures" % frame, min(steps) > MIN_CLOCK_STEP,
           "smallest step %.5f (floor %.5f); (b) P(I finish) kernel ply rule %.4f -> app clock %.4f"
           % (min(steps), MIN_CLOCK_STEP, lay["b"]["hW_kply"], lay["b"]["hW"]))
        # MUTANT 2 — the splice is live: the app opponent must move P(I finish)
        moved = abs(lay["b"]["pW"] - lay["a"]["pW"])
        ok("[%s] MUTANT the app opponent moves P(I finish) (b vs a)" % frame, moved > MIN_EFFECT,
           "|%.4f - %.4f| = %.4f (floor %.3f)" % (lay["b"]["pW"], lay["a"]["pW"], moved, MIN_EFFECT))
        # MUTANT 3 — the finish branch is wired to MY loss: pFinish = 0 must raise P(I finish)
        nofin = F.layer("b", clock=False, pfin_override=0)
        ok("[%s] MUTANT pFinish = 0 raises P(I finish) above (b)" % frame, nofin["pW"] > lay["b"]["pW"] + MIN_EFFECT,
           "%.4f -> %.4f" % (lay["b"]["pW"], nofin["pW"]))
        # MUTANT 4 — the ported deal order is load-bearing (the scratch port used adj order)
        n_order = r["policy"]["counts"]["top-3 set differs under adj-order tie-break"]
        ok("[%s] MUTANT adj-order tie-break changes the top-3 set somewhere" % frame, n_order > 0,
           "%d states; (b) P(I finish) app-order %.4f vs adj-order %.4f"
           % (n_order, lay["b"]["pW"], r["sensitivity_adj_order_tiebreak"]["b"]["pW"]))
        # MUTANT 5 — the escape formula: dropping the dominance term must move (c) and (d)
        mech = r["mechanisms"]
        for t in ("c_uniform", "d_uniform"):
            dt = lay[t]["pW"] - mech[t + "_without_escape_term"]["pW"]
            ok("[%s] MUTANT dropping escapeChance's term (L15208) lowers %s by > %.2f" % (frame, t, MIN_TERM_EFFECT),
               dt > MIN_TERM_EFFECT,
               "%.4f -> %.4f (%+.4f)" % (lay[t]["pW"], mech[t + "_without_escape_term"]["pW"], -dt))
        # MUTANT 6 — the escape pick is wired: the max-e pick must beat the uniform one
        for x in ("c", "d"):
            gap = lay[x + "_best"]["pW"] - lay[x + "_uniform"]["pW"]
            ok("[%s] MUTANT max-e escape pick beats uniform in (%s)" % (frame, x), gap > MIN_EFFECT,
               "%.4f vs %.4f (%+.4f)" % (lay[x + "_best"]["pW"], lay[x + "_uniform"]["pW"], gap))
        # MUTANT 7 — submission pricing: my Finish priced at the POSITION (pre-fix) must lower (d)
        dsp = lay["d_uniform"]["pW"] - mech["d_uniform_submission_priced_at_the_position"]["pW"]
        ok("[%s] MUTANT my Finish priced with the position's aiMod lowers (d) by > %.3f" % (frame, MIN_SUBPRICE_EFFECT),
           dsp > MIN_SUBPRICE_EFFECT, "%.4f -> %.4f (%+.4f)"
           % (lay["d_uniform"]["pW"], mech["d_uniform_submission_priced_at_the_position"]["pW"], -dsp))
        # layers are distinct measurements, each with positive coverage
        ok("[%s] coverage floors" % frame,
           r["policy"]["counts"]["cards dealt to the app opponent"] >= MIN_CANDIDATES
           and len(AISKILL) == 7 and r["policy"]["their_turn_visits_in_S_app"] > 0
           and r["escape_exposure"]["finish_attempts_per_roll"] > 0,
           "%d opponent cards dealt (floor %d) over %d states; %d aiSkill points; THEIR visits in S_app %.4f; "
           "finish attempts/roll %.4f"
           % (r["policy"]["counts"]["cards dealt to the app opponent"], MIN_CANDIDATES, len(F.S_app),
              len(AISKILL), r["policy"]["their_turn_visits_in_S_app"],
              r["escape_exposure"]["finish_attempts_per_roll"]))
        ok("[%s] no fallback hand, no non-finite EDGE inside S_app" % frame,
           r["policy"]["counts"]["origin-relaxed fallback hands"] == 0
           and not A.counters.get("non-finite EDGE in the deal order"),
           "fallback hands %d (app L12654 claims 0); port fallbacks %s"
           % (r["policy"]["counts"]["origin-relaxed fallback hands"], dict(sorted(A.counters.items())) or "none"))
        ok("[%s] row sums = 1 on every built chain" % frame, F.chains_built >= MIN_CHAINS and F.worst_row < 1e-12,
           "%d chains (floor %d), max |row-1| %.2e" % (F.chains_built, MIN_CHAINS, F.worst_row))
    for name, good, detail in checks:
        print("  [%s] %-92s %s" % ("OK" if good else "FAIL", name, detail))
    failed = sum(1 for c in checks if not c[1])
    print("  %d checks, %d failed" % (len(checks), failed))
    return checks, out


def main(argv=None):
    ap = argparse.ArgumentParser(description="the app's opponent in the corpus game (see the docstring)")
    ap.add_argument("--selfcheck", action="store_true")
    ap.add_argument("--json", help="write the table and metrics to this path")
    a = ap.parse_args(argv)
    if a.selfcheck:
        checks, out = selfcheck()
        rc = 1 if (len(checks) < 40 or any(not c[1] for c in checks)) else 0
    else:
        out, _runs = run()
        report(out)
        rc = 0
    if a.json:
        with open(a.json, "w", encoding="utf-8") as fh:
            json.dump(out, fh, indent=1, sort_keys=True)
    return rc


if __name__ == "__main__":
    sys.exit(main())
