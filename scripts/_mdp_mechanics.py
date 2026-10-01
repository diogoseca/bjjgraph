"""Immutable projection of the shipped game, not a second ruleset or probability law.

Only wire-local indexes are read here. Every exported identity is an authored node
ID or a content-derived defensive response ID. Outcome weights remain scalar raw
weights: the runtime conditions/normalizes them, and selects success rates by frame.
The independent JS differential executes the actual app's ingest/options helpers.
"""
from __future__ import annotations

import copy
import hashlib
import json
import math
import re
from collections import Counter

VERSION = 1
PRODUCER_VERSION = "mdp-metadata-1"
ROLES = ("top", "bottom")
CAL_FIELDS = ("successRate", "successRateByRuleset", "outcomes", "stateMoves", "stateAlias")
JS_SAFE_INTEGER = 2 ** 53 - 1


def stable(value):
    """ngMdpStable-compatible JSON for the admitted finite JS number domain.

    Python spells 1.0 / 1e-07 differently from JSON.stringify. These bytes also
    define defensive-response hashes on the main thread, so number spelling and
    UTF-16 object-key order are part of the cross-language contract.
    """
    if isinstance(value, dict):
        keys = sorted(value, key=lambda k: k.encode("utf-16-be"))
        return "{" + ",".join(stable(k) + ":" + stable(value[k]) for k in keys) + "}"
    if isinstance(value, list):
        return "[" + ",".join(stable(v) for v in value) + "]"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if not number(value):
            raise ValueError("unsupported-js-number")
        if value == 0:
            return "0"
        if isinstance(value, int) or value.is_integer():
            return str(int(value))
        spelling = repr(value)
        if "e" not in spelling:
            return spelling
        mantissa, exponent = spelling.split("e")
        exponent = int(exponent)
        if abs(value) >= 1e-6:
            sign = "-" if mantissa.startswith("-") else ""
            digits = mantissa.lstrip("-").replace(".", "")
            point = 1 + exponent
            if point <= 0:
                return sign + "0." + "0" * (-point) + digits
            if point >= len(digits):
                return sign + digits + "0" * (point - len(digits))
            return sign + digits[:point] + "." + digits[point:]
        return mantissa + "e" + ("+" if exponent >= 0 else "-") + str(abs(exponent))
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def digest(value):
    return hashlib.sha256(value if isinstance(value, bytes) else stable(value).encode()).hexdigest()


def number(value):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    if isinstance(value, int):
        return abs(value) <= JS_SAFE_INTEGER
    return math.isfinite(value) and (not value.is_integer() or abs(value) <= JS_SAFE_INTEGER)


def response_identity(submission_id, choice, body):
    """Resolve the source's detail pointer before hashing; never use its array index.

    Details are never exported. Two same-label/same-target choices remain distinct
    when they refer to different authored responses. Indistinguishable duplicates
    are diagnosed, rather than assigned unstable positional identifiers.
    """
    if not isinstance(choice, dict) or not isinstance(choice.get("to"), str):
        raise ValueError("malformed-defense")
    authored = {k: v for k, v in choice.items() if k not in ("contentHash", "defenseId")}
    authored["detail"] = None
    if "detail" in choice:
        index = choice["detail"]
        details = body.get("details", [])
        if not isinstance(index, int) or isinstance(index, bool) or index < 0 or index >= len(details):
            raise ValueError("missing-defense-detail")
        authored["detail"] = details[index] or None
    # Shared host ngMdpDefenseId hashes exactly this payload; state/technique
    # identity is already supplied separately to ngMdpActionId.
    content_hash = digest(authored)
    return {"id": choice.get("id", "defense:" + content_hash), "contentHash": content_hash,
            "to": choice["to"], **({"detail": choice["detail"]} if "detail" in choice else {})}


def performer_role(title, ty):
    if ty == "submissions":
        return None
    title = title.lower()
    if re.search(r"sweep|reversal|come ?up|wrestle ?up|back ?take|take.*back|to mount|to side|to back|to top|pass|stand ?up|get ?up|to knees|kimura trap to", title):
        return "top"
    if re.search(r"escape|recover|replace guard|retain|guard pull|pull guard|to closed guard|to half guard|to guard|to bottom|shrimp|hip ?escape|underhook recovery|technical stand", title):
        return "bottom"
    return None


def dominance(ty, title):
    """The source fallback for absent strength, not a calibrated rate."""
    t = title.lower()
    if ty == "submissions":
        return -.85 if re.search(r"escape|defen[sc]|survive|prevent|counter|defend", t) else .9
    if ty == "positions":
        m = .5
        for pattern, value in ((r"mount|back|crucifix|truck|rodeo|mounted", .8),
                               (r"side control|north.?south|kesa|knee on belly|knee.?ride", .65),
                               (r"control|headlock|ashi|saddle|honey", .6),
                               (r"guard|half|butterfly|spider|lasso|de la riva|dlr|x.?guard|worm|z.?guard", .3),
                               (r"standing|clinch|scramble|neutral|50.?50|double", 0)):
            if re.search(pattern, t):
                m = value
                break
        if re.search(r"\bbottom\b", t):
            return -m
        if re.search(r"\btop\b", t):
            return m
        return -m * .6 if "guard" in t else m * .7
    if re.search(r"escape|recover|defen[sc]|survive|extract|prevent|posture up|replace guard", t):
        return -.3
    return .35 if re.search(r"pass|sweep|take|to back|to mount|to side|to crucifix|to truck|entry|elevator|berimbolo|finish", t) else 0


class Projection:
    def __init__(self, wire, details, ruleset, loss_aversion=2):
        if ruleset not in ("gi", "nogi"):
            raise ValueError("invalid-ruleset")
        self.wire = copy.deepcopy(wire)
        self.details = details
        self.ruleset = ruleset
        self.issues = []
        self.src = self.wire.get("nodes", [])
        self.by_id = {}
        self.nodes = []
        self.adj = {}
        self.ev = {}
        self.pos = {}
        self.tech = {}
        self.stats = Counter()
        self.mask_unknown = []
        self.mask_null = []
        # THE LISTING-LEVEL DEALING RULE (v1.211.0): technique id -> the posIds where a listing
        # flagged `deal_here` deals it although its origin is elsewhere (the wire's `alsoFrom`).
        # Private to the projection on purpose: the rule changes which hands exist, not the
        # node record, so nodeColumns and the adapter stay as they are.
        self.also_from = {}
        lambdas = self.wire.get("evLam", [])
        if lambdas and (len(set(lambdas)) != len(lambdas) or any(not number(x) for x in lambdas)):
            raise ValueError("malformed-ev-lambdas")
        self.lam_index = (lambdas.index(loss_aversion) if loss_aversion in lambdas else
                          lambdas.index(2) if 2 in lambdas else 0) if lambdas else -1
        self.loss_aversion = lambdas[self.lam_index] if lambdas else None
        self._expand()

    def issue(self, kind, **fields):
        self.issues.append({"kind": kind, **fields})

    def _expand(self):
        if not self.src:
            raise ValueError("empty-graph")
        ids = [n.get("id") for n in self.src]
        if any(not isinstance(i, str) or not i for i in ids) or len(set(ids)) != len(ids):
            raise ValueError("missing-or-duplicate-node-id")
        if any(n.get("pairId") for n in self.src):
            raise ValueError("expected-original-unsplit-wire")
        to_tab = self.wire.get("toTab")
        pos, tech = {}, {}
        for n in self.src:
            if n.get("ty") not in ("positions", "submissions", "transitions") or not isinstance(n.get("t"), str):
                raise ValueError("invalid-node-type-or-title")
            cal = n.get("cal") or {}
            outcomes = []
            for o in cal.get("outcomes", []):
                if isinstance(o, list):
                    if len(o) != 3:
                        raise ValueError("malformed-outcome-tuple")
                    target = o[0]
                    if isinstance(target, int) and not isinstance(target, bool):
                        if not isinstance(to_tab, list) or target < 0 or target >= len(to_tab):
                            raise ValueError("invalid-outcome-string-index")
                        target = to_tab[target]
                    o = {"to": target, "probability": o[1], "result": {"s": "success", "f": "failure", "c": "counter"}.get(o[2], o[2])}
                if not isinstance(o, dict):
                    raise ValueError("malformed-outcome")
                outcomes.append({k: o[k] for k in ("to", "probability", "result") if k in o})
            if "outcomes" in cal:
                cal["outcomes"] = outcomes
            n["cal"] = cal
            if n["ty"] != "positions" and n.get("alsoFrom") is not None:
                af = n["alsoFrom"]
                if not isinstance(af, list) or any(not isinstance(x, str) or not x for x in af):
                    raise ValueError("malformed-also-from")
                self.also_from[n["id"]] = frozenset(af)
            if n["ty"] == "positions":
                pid = (n.get("posId") or "").lower()
                if pid:
                    pos.setdefault(pid, n["id"])
                    pos.setdefault(pid.rsplit("/", 1)[-1], n["id"])
            else:
                tail = n["id"].split("/", 1)[-1].lower()
                for k in (tail, tail.replace("/", "-")):
                    if k and (k not in tech or n["ty"] == "submissions"):
                        tech[k] = n["id"]
        lands, tech_edges = {}, []
        for n in self.src:
            if n["ty"] == "positions":
                continue
            for o in n["cal"].get("outcomes", []):
                t = str(o.get("to") or "").strip().lower()
                if not t or t == "game-over":
                    continue
                m = re.fullmatch(r"(.*)/(top|bottom)", t)
                if m:
                    if m[1] in pos:
                        lands.setdefault((pos[m[1]], n["id"]), m[2])
                elif t in tech:
                    tech_edges.append((n["id"], tech[t]))
                elif t in pos:
                    lands.setdefault((pos[t], n["id"]), "top")
        for hub in self.src:
            is_pos = hub["ty"] == "positions"
            pair = hub["id"] + ("/Bottom" if is_pos else "/Defender")
            for slot, role in enumerate(ROLES if is_pos else ("attacker", "defender")):
                raw_cal = hub["cal"]
                cal = ({k: copy.deepcopy(raw_cal[k]) for k in ("stateAlias",) if k in raw_cal} if is_pos else
                       {k: copy.deepcopy(raw_cal[k]) for k in CAL_FIELDS if k in raw_cal} if slot == 0 else {})
                av = raw_cal.get("avail") or {}
                verdict = av.get(self.ruleset)
                self.stats["rulesetExplicit" if isinstance(verdict, bool) else "rulesetUnknown"] += 1
                if not isinstance(verdict, bool):
                    identity = hub["id"] if slot == 0 else pair
                    (self.mask_null if self.ruleset in av and verdict is None else self.mask_unknown).append(identity)
                    if self.ruleset in av and verdict is not None:
                        self.issue("malformed-ruleset-verdict", nodeId=identity)
                strength = hub.get("s") or None
                if strength is not None and (not isinstance(strength, list) or len(strength) != 2 or any(not number(s) for s in strength)):
                    self.issue("malformed-strength", nodeId=hub["id"])
                dom = (strength[slot] if isinstance(strength, list) and len(strength) > slot and number(strength[slot]) else
                       strength[0] if isinstance(strength, list) and strength and number(strength[0]) else dominance(hub["ty"], hub["t"]))
                n = {"id": hub["id"] if slot == 0 else pair, "t": hub["t"], "ty": hub["ty"], "role": role,
                     "fromRole": hub.get("fromRole") or None, "pairId": pair if slot == 0 else hub["id"],
                     "submissionId": hub["id"] if hub["ty"] == "submissions" else None,
                     "posId": hub.get("posId") or hub.get("fromPositionId") or None,
                     "fromPositionId": hub.get("fromPositionId") or None, "s": strength, "dom": dom,
                     "allowed": (verdict if isinstance(verdict, bool) else True) and not bool(cal.get("stateAlias")),
                     "cal": cal if cal or is_pos or raw_cal.get("avail") else None,
                     "deckKey": (re.sub(r"\s+(Top|Bottom)\s*$", "", hub["t"], flags=re.I).strip() if is_pos else hub["t"]) + "|" + role.capitalize(),
                     "fallbackRole": performer_role(hub["t"], hub["ty"]),
                     "poolName": (re.match(r"^(.*?)\s+[Ff]rom\s+(.+)$", hub["t"])[1].strip()
                                  if re.match(r"^(.*?)\s+[Ff]rom\s+(.+)$", hub["t"]) else hub["t"]).lower()}
                if n["id"] in self.by_id:
                    raise ValueError("derived-node-id-collision")
                self.nodes.append(n)
                self.by_id[n["id"]] = n
                self.adj[n["id"]] = []
                if is_pos:
                    self._ev_rows(n, raw_cal)
                if n["ty"] == "submissions" and slot == 0:
                    self._defenses(n)
        self._indexes()
        # Preserve source link order: resultPos intentionally picks the first matching
        # neighbor. Permuting node storage with remapped links is safe; permuting
        # adjacency itself can change live behavior and must change mechanics identity.
        seen = set()

        def add(a, b, one_way=False):
            if a == b:
                return
            key = tuple(sorted((a, b)))
            if not one_way and key in seen:
                return
            if not one_way:
                seen.add(key)
            self.adj[a].append(b)
            if not one_way:
                self.adj[b].append(a)

        for link in self.wire.get("links", []):
            if not isinstance(link, list) or len(link) < 2 or any(not isinstance(i, int) or isinstance(i, bool) or not 0 <= i < len(self.src) for i in link[:2]):
                raise ValueError("invalid-wire-link")
            a, b = (self.src[i] for i in link[:2])
            if (a["ty"] == "positions") == (b["ty"] == "positions"):
                add(a["id"], b["id"])
                continue
            p, t = (a, b) if a["ty"] == "positions" else (b, a)
            fr = t.get("fromRole")
            here = (p.get("posId") or "").lower()
            origin = fr and ((t.get("fromPositionId") or "").lower() == here
                             or here in {x.lower() for x in self.also_from.get(t["id"], ())})
            role = fr if origin else lands.get((p["id"], t["id"])) or fr or "top"
            member = p["id"] + ("/Bottom" if role == "bottom" else "")
            other = p["id"] + ("/Bottom" if role != "bottom" else "")
            add(member, t["id"])
            add(other, t["id"], True)
        for a, b in tech_edges:
            add(a, b)
        for hub in self.src:
            add(hub["id"], self.by_id[hub["id"]]["pairId"])

    def _defenses(self, n):
        body = self.details.get(n["t"])
        if not isinstance(body, dict) or not isinstance(body.get("choices"), list) or not body["choices"]:
            self.issue("missing-defense-state", nodeId=n["id"])
            return
        out, seen = [], set()
        for choice in body["choices"]:
            try:
                row = response_identity(n["id"], choice, body)
            except (ValueError, TypeError) as exc:
                self.issue(str(exc), nodeId=n["id"])
                continue
            if row["id"] in seen:
                self.issue("ambiguous-defense-identity", nodeId=n["id"], defenseId=row["id"])
            seen.add(row["id"])
            out.append(row)
        # Order is source semantics for a deterministic RNG interval, not identity.
        if n["cal"] is None:
            n["cal"] = {}
        n["cal"]["defenses"] = out

    def _ev_rows(self, n, cal):
        for role, block in cal.get("ev", {}).items():
            if role not in ROLES or not isinstance(block, list) or len(block) < 3 or not isinstance(block[0], list):
                self.issue("malformed-ev-hand", nodeId=n["id"], role=role)
                continue
            if self.lam_index < 0:
                continue
            if len(block) != len(self.wire["evLam"]) + 2 or len(block[1]) != len(block[0]) or any(len(v) != 2 * len(block[0]) for v in block[2:]):
                self.issue("malformed-ev-hand", nodeId=n["id"], role=role)
                continue
            rows = {}
            for i, idx in enumerate(block[0]):
                if not isinstance(idx, int) or isinstance(idx, bool) or not 0 <= idx < len(self.src):
                    self.issue("missing-ev-node", nodeId=n["id"])
                    continue
                tid = self.src[idx]["id"]
                selected = block[2 + self.lam_index]
                r = {"att": block[1][i], "e0": selected[2 * i], "c1": selected[2 * i + 1]}
                if tid in rows or any(not number(v) for v in r.values()) or r["att"] < 0:
                    self.issue("malformed-ev-row", nodeId=n["id"], techniqueId=tid)
                    continue
                rows[tid] = r
            self.ev[stable([n["id"], role])] = rows

    def _indexes(self):
        for n in self.nodes:
            if n["ty"] == "positions":
                pid = (n["posId"] or "").lower()
                if pid:
                    self.pos[pid + "/" + n["role"]] = n["id"]
                    if n["role"] == "top" or pid not in self.pos:
                        self.pos[pid] = n["id"]
            else:
                tail = n["id"].split("/", 1)[-1].lower()
                keys = (tail,) if n["role"] != "attacker" else (tail, tail.replace("/", "-"))
                for key in keys:
                    if key and (key not in self.tech or n["ty"] == "submissions"):
                        self.tech[key] = n["id"]
        for n in self.nodes:
            pid = (n["posId"] or "").lower()
            if n["ty"] == "positions" and "/" in pid:
                bare = pid.rsplit("/", 1)[-1]
                self.pos.setdefault(bare + "/" + n["role"], n["id"])
                self.pos.setdefault(bare, n["id"])

    def resolve(self, to):
        r = {"nodeId": None, "role": None, "terminal": False}
        if not isinstance(to, str) or not to:
            return r
        t = to.strip().lower()
        if t == "game-over":
            return {**r, "terminal": True}
        m = re.fullmatch(r"(.*)/(top|bottom)", t)
        if m:
            return {**r, "nodeId": self.pos.get(m[1] + "/" + m[2], self.pos.get(m[1])), "role": m[2]}
        return {**r, "nodeId": self.tech.get(t, self.pos.get(t))}

    def canonical(self, nid, role):
        n = self.by_id.get(nid)
        alias = n and (n["cal"] or {}).get("stateAlias")
        target = self.by_id.get(self.tech.get(alias)) if alias else None
        if not target or target["ty"] != "submissions":
            return nid
        sub = self.by_id[target["submissionId"]]
        return (sub["id"] if (role or n["role"]) == sub["fromRole"] else sub["pairId"]) if sub["allowed"] else nid

    def result_pos(self, action, origin):
        for nid in self.adj[action]:
            n = self.by_id[nid]
            if n["ty"] == "positions" and nid != origin and n["allowed"]:
                return nid
        return next((i for i in self.adj[action] if self.by_id[i]["ty"] == "positions"), None)

    def option(self, n, destination=None, role=None, kind=None, defense=None, relaxed=False, ev=None):
        return {"techniqueId": n["id"], "destinationId": destination, "destinationRole": role,
                "kind": kind or ("entry" if n["ty"] == "submissions" else "transition"),
                "defense": defense, "relaxed": relaxed, "ev": ev,
                **({"defenseId": "defense:" + defense["contentHash"]} if defense else {})}

    def options(self, nid, role):
        nid = self.canonical(nid, role)
        n = self.by_id[nid]
        if n["ty"] == "submissions":
            sub = self.by_id[n["submissionId"]]
            if not sub["allowed"]:
                return []
            if role != sub["fromRole"]:
                out = []
                for d in (sub["cal"] or {}).get("defenses", []):
                    r = self.resolve(d["to"])
                    dest = self.canonical(r["nodeId"], r["role"])
                    if dest is not None and not r["terminal"] and self.by_id[dest]["allowed"]:
                        out.append(self.option(self.by_id[sub["pairId"]], dest, r["role"] or self.by_id[dest]["role"], "escape", d))
                return out
            out = [self.option(sub, kind="finish")]
            seen = {sub["id"]}
            for key in (sub["cal"] or {}).get("stateMoves", []):
                move = self.by_id.get(self.tech.get(key))
                if move and move["submissionId"]:
                    move = self.by_id[move["submissionId"]]
                if not move or not move["allowed"] or move["id"] in seen:
                    continue
                seen.add(move["id"])
                success = next((o for o in (move["cal"] or {}).get("outcomes", []) if o.get("result") == "success" and o.get("to") != "game-over"), None)
                r = self.resolve(success.get("to")) if success else None
                dest = self.canonical(r["nodeId"], r["role"]) if r and r["nodeId"] else self.result_pos(move["id"], sub["id"])
                out.append(self.option(move, dest))
            return out
        out, seen = [], set()
        ev = self.ev.get(stable([nid, role]), {})
        for relaxed in (False, True):
            if out:
                break
            for k in self.adj[nid]:
                move = self.by_id[k]
                name = move["t"] + ("_fb" if relaxed else "")
                if move["ty"] == "positions" or not move["allowed"] or name in seen:
                    continue
                seen.add(name)
                if move["fromRole"] and move["fromRole"] != role:
                    continue
                if (not relaxed and move["fromPositionId"] and n["posId"] and move["fromPositionId"] != n["posId"]
                        and n["posId"] not in self.also_from.get(move["id"], ())):
                    continue
                out.append(self.option(move, self.result_pos(k, nid), relaxed=relaxed, ev=ev.get(k)))
            if relaxed:
                def order(o):
                    m = self.by_id[o["techniqueId"]]
                    slot = (0 if m["fromRole"] == role else 1) if m["fromRole"] else (1 if role == "bottom" else 0)
                    v = m["s"][slot] if isinstance(m["s"], list) and len(m["s"]) >= 2 and number(m["s"][slot]) else m["dom"] * (-1 if role == "bottom" else 1)
                    return (-v, m["t"])
                out.sort(key=order)
                return out[:6]
        # Profile-dependent ordering belongs to the adapter. Preserve the full set.
        return sorted(out, key=lambda o: o["techniqueId"])

    def build(self):
        canonical, hands, destinations, ev_hands = {}, {}, {}, {}
        categories = Counter(n["ty"] + "/" + n["role"] for n in self.nodes)
        counts = Counter()
        for n in self.nodes:
            for role in ROLES:
                key = stable([n["id"], role])
                canonical[key] = self.canonical(n["id"], role)
                if n["ty"] not in ("positions", "submissions"):
                    continue
                hands[key] = self.options(n["id"], role)
                counts["actions"] += len(hands[key])
                counts["relaxedHands"] += any(o["relaxed"] for o in hands[key])
                counts["emptyAllowedHands"] += not hands[key] and n["allowed"]
                if n["allowed"] and n["ty"] == "submissions" and role != n["fromRole"] and not hands[key]:
                    self.issue("no-legal-submission-defense", nodeId=n["id"], role=role)
                if key in self.ev:
                    ev_hands[key] = [{"techniqueId": tid, "att": row["att"], "c1": row["c1"]} for tid, row in sorted(self.ev[key].items())]
            cal = n["cal"] or {}
            if n["role"] == "attacker":
                counts["techniques"] += 1
                if n["fromRole"] not in ROLES:
                    self.issue("missing-performer-role", nodeId=n["id"])
                for field in ("successRate",):
                    if field in cal and cal[field] is not None and (not number(cal[field]) or not 0 <= cal[field] <= 100):
                        self.issue("malformed-success-rate", nodeId=n["id"])
                for fr, v in (cal.get("successRateByRuleset") or {}).items():
                    if fr not in ("gi", "nogi") or (v is not None and (not number(v) or not 0 <= v <= 100)):
                        self.issue("malformed-frame-rate", nodeId=n["id"])
                br = cal.get("successRateByRuleset") or {}
                counts["explicitNullFrameRates"] += self.ruleset in br and br[self.ruleset] is None
                counts["frameRateOverrides"] += self.ruleset in br and br[self.ruleset] is not None
                selected = br.get(self.ruleset) if br.get(self.ruleset) is not None else cal.get("successRate")
                counts["unknownSuccessRates"] += selected is None
                outcomes = cal.get("outcomes", [])
                if not outcomes:
                    self.issue("missing-outcomes", nodeId=n["id"])
                for branch in (True, False):
                    rows = [o for o in outcomes if (o.get("result") == "success") == branch]
                    if not rows:
                        counts["wholeTableBranchFallbacks"] += 1
                        rows = outcomes
                    if rows and not any(number(o.get("probability")) and o["probability"] > 0 for o in rows):
                        self.issue("zero-branch-mass", nodeId=n["id"], branch=branch)
            if cal.get("stateAlias"):
                t = self.by_id.get(self.tech.get(cal["stateAlias"]))
                if not t or not t["submissionId"]:
                    self.issue("missing-canonical-state", nodeId=n["id"], target=cal["stateAlias"])
            for target in cal.get("stateMoves", []):
                if target not in self.tech:
                    self.issue("missing-continuation", nodeId=n["id"], target=target)
                else:
                    counts["continuationRows"] += 1
            for field in ("outcomes", "defenses"):
                for row in cal.get(field, []):
                    counts["outcomeRows" if field == "outcomes" else "defenseRows"] += 1
                    target = row.get("to")
                    if not isinstance(target, str) or not target:
                        self.issue("missing-destination-string", nodeId=n["id"])
                        continue
                    r = self.resolve(target)
                    destinations[target] = r
                    p = row.get("probability") if field == "outcomes" else 1
                    malformed = field == "outcomes" and (not number(p) or p < 0 or row.get("result") not in ("success", "failure", "counter"))
                    if malformed:
                        self.issue("malformed-outcome-weight", nodeId=n["id"], target=target)
                    positive = malformed or p > 0
                    counts["positiveOutcomeRows" if field == "outcomes" else "positiveDefenseRows"] += positive
                    if not r["nodeId"] and not r["terminal"]:
                        counts["unresolvedDestinations"] += 1
                        if positive:
                            self.issue("unresolved-positive-destination", nodeId=n["id"], target=target)
                    if field == "defenses" and r["terminal"]:
                        self.issue("terminal-defense-destination", nodeId=n["id"], target=target)
                    if field == "defenses" and r["nodeId"]:
                        dest = self.canonical(r["nodeId"], r["role"])
                        counts["defenseRowsExcludedByFrame"] += not self.by_id[dest]["allowed"]
        for key in ("positions/top", "positions/bottom", "submissions/attacker", "submissions/defender", "transitions/attacker", "transitions/defender"):
            if not categories[key]:
                self.issue("empty-coverage-denominator", category=key)
        if not counts["actions"] or not counts["outcomeRows"] or not counts["defenseRows"]:
            self.issue("empty-mechanics-coverage")
        for key in ("actions", "techniques", "outcomeRows", "defenseRows", "positiveOutcomeRows", "positiveDefenseRows", "unresolvedDestinations", "relaxedHands", "emptyAllowedHands", "continuationRows", "defenseRowsExcludedByFrame", "unknownSuccessRates", "explicitNullFrameRates", "frameRateOverrides", "wholeTableBranchFallbacks"):
            counts.setdefault(key, 0)
        used = {o["techniqueId"] for rows in hands.values() for o in rows}
        issues = sorted({stable(i): i for i in self.issues}.values(), key=stable)
        coverage = {"status": "UNAVAILABLE" if issues else "COMPLETE", "nodes": len(self.nodes), "hands": len(hands),
                    "seats": dict(sorted(categories.items())), **dict(counts),
                    "transitionActions": len([i for i in used if self.by_id[i]["ty"] == "transitions"]),
                    "missingDefenseStateIds": sorted({i["nodeId"] for i in issues if i["kind"] == "missing-defense-state"}),
                    "rulesetMask": {"source": "cal.avail[frame] boolean else true; exclude stateAlias", **dict(self.stats),
                                    "unknownNodeIds": sorted(self.mask_unknown), "nullNodeIds": sorted(self.mask_null)},
                    "outcomeLaw": "source-scalar-conditional-raw-weights", "issues": issues}
        return {"version": VERSION, "ruleset": self.ruleset, "evFrame": self.wire.get("evFrame") or None,
                "lossAversion": self.loss_aversion, "nodes": sorted(self.nodes, key=lambda n: n["id"]),
                "hands": hands, "canonical": canonical, "destinations": destinations, "evHands": ev_hands, "coverage": coverage}


def produce_metadata(wire, details, ruleset, loss_aversion=2):
    """Pure and non-mutating. Invalid structure raises; incomplete support is explicit."""
    return Projection(wire, details, ruleset, loss_aversion).build()
