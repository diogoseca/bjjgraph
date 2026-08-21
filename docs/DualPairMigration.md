# Dual Close-Pair Graph — Migration Plan

Owner decision (2026-08-10, memory `feedback-graph-dual-close-pairs`): the VISUAL graph should
show every dual state as **two separate nodes placed as close together as healthy** — position
Top/Bottom, technique Attacker/Defender — replacing hub-collapse. Explicitly rejected: half-lit
single nodes, and any win/lose recoloring ("blue/red is only WHICH PLAYER you are").

> ## STATUS: SHIPPED (v1.125.0), AND THE CUTOVER PLAN BELOW IS SUPERSEDED
>
> The pair is the DEFAULT graph. Read this document as the engineering record of the design
> questions — it is still the only place several of them are argued — but **not** as the plan that
> ran. Three of its load-bearing premises turned out to be false, and the shipped change is
> smaller than any step it proposes:
>
> - **No ordinals were minted and no hub ordinal was retired.** §5's "2340 new + 1170 retired
>   behind a successors map" was written on the assumption that splitting a hub RETIRES it. It does
>   not: the rep member **is** the hub node — same id, same `o`, same URL — so every `/l/<code>`
>   already posted resolves with no migration at all. Only the partner mints an id
>   (`<hub>/Bottom`, `<hub>/Defender`), and ids are not ordinals.
> - **No payload was added.** §8/Q8's "+47KB gzip boot cost accepted" and the "compact pair wire"
>   step are both moot: `_deriveDualPairs` computes the split from the shipped wire at ingest.
>   `graph-data.json` is byte-for-byte unchanged. The cost that *is* real is CPU, not bytes —
>   see CLAUDE.md.
> - **`scripts/prototype_dual_pair_layout.py`, its payloads and `?dual=fixed|force|iso` are gone**
>   (v1.126.0). The tables below name them in the present tense; they are history. `?dual=legacy`
>   is the one surviving flag and it is the way OUT.
>
> - **Both `e2e/prototype/` specs are gone too** (v1.126.0). §1's table still names the shoot
>   driver in the present tense; it is history. Its three BEHAVIOURAL journeys — the pair label
>   group, the hit-test reading the drawn position, the camera on a half-swap — came back in
>   **v1.127.0** as `e2e/journeys/dual-pair.spec.ts`, in the core suite on the default build. The
>   screenshot shoot itself did not, and CLAUDE.md → "THE PAIR JOURNEYS COME HOME" says why.
>
> What ACTUALLY shipped, with its measurements, is CLAUDE.md → "THE PAIR IS THE DEFAULT, AND IT IS
> DERIVED AT INGEST". The committed screenshots referenced here stay, because they are the evidence
> the owner judged.

This document is the cutover plan as it stood before the split turned out to be derivable.

## 1. The prototype (what exists now)

| piece | where |
|---|---|
| Layout variants | `scripts/prototype_dual_pair_layout.py` → `tests/artifacts/dualpair/payloads/graph-data-dual-{fixed,force}.json` (gitignored; regenerable) |
| App render path | `?dual=fixed` / `?dual=force` in `neural/src/app.src.jsx` (`_dualVariant()`); no flag = byte-identical default fetch |
| Screenshots | `tests/artifacts/dualpair/{fixed,force}-{1-overview,2-mid,3-rollzoom}.png` (committed) |
| Shoot driver | `e2e/prototype/dual-pair-shoot.spec.ts` (chrome config, port 8147, own lock `/tmp/bjj-pw-dual.lock`, serve root `.privserve/public` + the two payloads) |

Numbers (both strategies): **1467 hub nodes → 2637 dual nodes** = 1170 pairs (2340 members) +
297 singles (neutral positions, non-role-split techniques, `game-over`). Links 5371 → **5984**,
including 1170 `pair:true` ties. Pair distance: `fixed` = constant 8.0 layout units on one 25°
axis (top/attacker up-right); `force` = local relaxation, 6.1–11.7u (median 7.6), each pair finds
its own axis. Edges are role-correct from `graph.json` (position-role → technique attacker →
landing role member); defender members carry only the pair tie (mirror edges deliberately not
drawn — Q2 below).

Member node contract added to ingest: `role` (`top|bottom|attacker|defender|null`), `pairId`
(partner's id), `sv` (this member's OWN side's strength — see §6). `s` stays the full pair so
`myVal()`/`valIdx()` role-indexing is untouched. De-overlap skips partners. The bare position
slug and bare technique slug resolve to the **primary member** (top/attacker), and each retired
hub id is aliased into `_idIndex` → primary member, which is what keeps systems lighting,
curriculum fog, **stored lists** (they hold hub ids today) and `_seedFromUrl` resolving.

Proven on the default path (no `?dual`): `golden-path` (incl. frame-exact replay) and
`replay-digest` green against the dual-capable bundle — the flag is inert when off. Proven on
the flag path: staging a roll at `Mount/Top` member sets `playerRole = "top"` from the member,
and the real `rollCamTarget` composition frames it.

## 2. Ordinal strategy (share links) — the exact rule

`node_ordinals.json` is APPEND-ONLY: ordinals are permanent, never renumbered, never reused,
retired-not-deleted. Share links encode ordinals over the visual node set, so the visual split
is an ordinal event. The rule:

1. **Every member id mints a NEW ordinal.** 2340 members enter the layout as new ids →
   `regenerate:ordinals` appends them in sorted-id order at `next_ordinal` (1467 → 3807).
   Members never inherit the hub's ordinal: `validate:ordinals` correctly rejects an ordinal
   re-keyed to a different id, and inheritance would silently decide Q1 (one side) without the
   owner choosing it.
2. **Every split hub id retires** (≈1170 entries in the `retired` map, date-stamped). Retire ≠
   delete: the ordinal stays bound to the hub id forever and can never be handed to another node.
   Singles (297) keep their ids and ordinals untouched.
3. **Old links must still resolve.** A committed successors artifact —
   `node_ordinal_successors.json`, `{retired hub id: [member ids]}` — is minted in the same
   cutover commit. `validate:ordinals` gains: every id retired by this diff has a successors
   entry; every successor is a live minted id. The lockfile schema itself stays untouched (the
   append-only differ keeps working unmodified).
4. **Delivery to the browser:** `regenerate_neural_data.py` stamps each member with its own `o`
   plus `oAlias` = the retired hub's ordinal. The app's ordinal→node resolution adds alias
   entries; **encode never uses `oAlias`** (a new code always spells member ordinals). An old
   hub ordinal in an incoming `/l/<code>` therefore resolves — to the pair or to the primary
   member, per Q1.
5. **Old app × new link:** member ordinals ≥1467 are unknown to a stale build → the existing
   `[data-shared-stale]` sentence ("your app is older — reload") already covers it. Nothing new
   to build; do not special-case.
6. **Analytics join:** the same class re-shared after cutover encodes different ordinals →
   different `share_id`. Per the wire-version precedent (documented on `ngListShareId`): count
   pre-cutover codes as their own ids, never re-key to synthetic post-cutover ids.

URL length: ordinal space grows 1467 → 3807; varint deltas gain ≤1 byte each only where a delta
crosses 127 — measured share URLs stay well inside one WhatsApp line.

## 3. Payload size impact (measured)

| payload | raw | gzip |
|---|---|---|
| `graph-data.json` today | 1,545,389 B | 144,363 B |
| dual variant (either strategy) | 2,206,260 B | 191,149 B |
| **delta** | **+660,871 B (+43%)** | **+46,786 B (+32%)** |

The neural eager set today is 2,301,714 B raw / 324,715 B gzip against ceilings 2,500,000 /
400,000 (`check_payload_budget.py`). Cutover as-emitted breaches the RAW ceiling by ~460KB
(gzip still fits). Options, in preference order:

1. **Compact pair emission.** A defender/bottom member duplicates `t`, `s`, `fromPosition*`,
   coordinates near its partner. Emitting the partner as a delta record (id suffix + role + dx/dy
   + `sv`) and reconstituting in `ingest` should reclaim most of the +43% raw (gzip already
   removes much of the redundancy — the +32% gzip is the honest floor).
2. **Accept + raise ceilings** with `--update` in its own justified commit (+47KB gzip on the
   boot path is the real user cost; the budget commit must say so).

Also grows: `l-manifest.json` (ordinal→name, Function-only) roughly doubles; ordinals lockfile
+~2340 lines once. `oAlias` costs ~7 bytes/member pre-gzip.

## 4. Camera / focus implications

- **`rollCamTarget` / follow-cam / `locateNode` need no changes** — members are ordinary nodes
  (proven by the roll-zoom shots). At `ROLL_ZOOM` (0.085·graphW) the partner sits ~88px from the
  focus node, inside the frame.
- **The focus halo can swallow the partner.** At mid zooms the halo radius exceeds the 8u pair
  split (measured at vw = 0.18·graphW: split ≈ 41px, halo wider) — the partner needs a defined
  treatment while its twin is the current state (Q5), or the halo/pair-distance needs tuning.
- **Focus sets light one member per pair.** Systems, lists and the shared-class path resolve
  id→node through the hub alias → primary member only. Whether a lit set should co-light
  partners is Q1/Q7. `frameNodes` itself is unaffected (it fits whatever set it is given).
- **Roles become real camera states.** Staging on a bottom/defender member plays that side
  (`rollFromPosition` reads `node.role`; explicit `roleOverride` still wins). The first-impression
  weighted draw resolves bare slugs → top member, preserving today's "every start is top"
  behaviour exactly — making the draw side-aware is Q9, not an accident of the migration.
- **URL sync improves for free:** member ids ARE built page paths (`Positions/Mount/Top`), so
  `_syncUrl`/`_seedFromUrl` get more precise, not less.

## 5. Determinism

- Flag off = default path byte-identical (proven, §1). The flag ships dark until cutover.
- At cutover, node COUNT and array order change → any journey pinning node indices, hand
  contents or camera positions gets a re-point pass; the rigged RNG rails themselves are
  untouched (same tags, same draw counts — `optionsFor` filters by `fromRole`/origin exactly as
  today, and member `cal` payloads carry per-role moves only).
- `validate_graph_integrity.py` gains pair invariants: every pair has exactly 2 members with
  opposite roles + mutual `pairId`; primary member owns the bare slug; every retired hub id
  aliases to a live member.

## 6. No win/lose recoloring — and what `sv` is

`sv` is the member's OWN side's authored strength, baked at build time: `Mount/Top` wears
dom(+0.629), `Mount/Bottom` wears dom(−0.693), forever, for every viewer, in every game. Nothing
recolors at runtime — this satisfies the owner's rejection of outcome coloring while making the
pair truthful. Side effect worth naming: it structurally resolves the OPEN v1.104.3 item ("the
canvas paints positions top-relative while you play bottom") — after the split each visual node
has exactly one side, so `dom = own side` is simply correct, with no per-frame `myColor` cost.

## 7. Cutover checklist (ordered)

1. Owner judges the screenshots: strategy (Q4) + the design questions below.
2. Promote pair emission out of the prototype script into the real pipeline (a pass between
   `regenerate_graph_layout.py` and `regenerate_neural_data.py`, preserve-coords), with the
   compact pair encoding decision (§3) made first.
3. `regenerate:ordinals`: mint members, retire hubs, emit `node_ordinal_successors.json`;
   extend `validate:ordinals` (§2.3).
4. `regenerate_neural_data.py`: emit members + `o` + `oAlias`; `build_share_shell.mjs` manifest
   follows automatically.
5. App: default the pair layout, remove/keep `_dualVariant` per owner; implement Q1/Q5 answers;
   partner label treatment at read zooms.
6. Payload budget commit (`--update` or compaction proof).
7. Test pass: re-point index/hand-pinned journeys; add the pair-invariants spec; `npm test`,
   `e2e:gen`, `e2e:share` green; `triple_replay.sh` identical.
8. Static site untouched (visual layer only — no content, template or SEO surface changes).

## 8. Design questions for the owner (surfaced, not decided)

- **Q1 — Old share links:** a retired hub ordinal arrives in a code. Light BOTH members (the
  pair as "the technique/position") or only the primary (top/attacker)? Same question for a
  stored list holding hub ids.
- **Q2 — Defender edges:** defender/bottom members currently carry only the pair tie (drawing
  the role-flipped mirror edges would double every edge on screen). Keep them edge-light, or
  draw a subset (e.g. escape outcomes)?
- **Q3 — Pair tie styling:** the tie is drawn as an ordinary link line today. Distinct rendering
  (shorter/heavier/no line at all and rely on proximity)?
- **Q4 — Strategy:** `fixed` (uniform 25° grain, perfectly regular 8.0u) vs `force` (organic
  6.1–11.7u, pairs find their own axis). The six PNGs are the evidence.
- **Q5 — Partner under focus:** while you stand on one member, how does its twin render? The
  focus halo currently swallows it at mid zooms; options: co-lit dimmer, side kicker label
  ("BOTTOM"), or excluded from the halo.
- **Q6 — Symmetric techniques:** 297 singles include techniques with no role split in
  `graph.json` (e.g. both players can attempt a standing wrist lock). Is single-node the right
  visual for those, or should symmetric techniques also pair?
- **Q7 — Focus sets:** should lighting a System/list co-light partners, or exactly the captured
  side?
- **Q8 — Payload:** compact pair encoding (engineering time) vs +47KB gzip boot cost accepted.
- **Q9 — First impression:** should the weighted start draw a SIDE (member) instead of always
  landing top?
- **Q10 — Capture semantics:** after cutover a coach's `+` captures a member (a side). Is a
  class list of SIDES the intended product, or should capture normalize to the pair?

TL;DR: the visual layer splits every dual state into two adjacent nodes (prototype behind
`?dual=fixed|force`, screenshots committed); cutover = mint 2340 new ordinals + retire 1170 hub
ordinals with a committed successors map so every old share link still resolves; graph payload
grows +43% raw/+32% gzip unless pairs are emitted compactly; cameras need no rework but focus
halo/partner treatment and set-lighting semantics are owner calls; coloring stays static
per-member (`sv` = own side's strength — no win/lose recolor). Ten design questions above are
the owner's to answer before any cutover step runs.

## 9. The 2.5D paradigm (owner directive, 2026-08-17) — the questions, re-answered

The owner's call, and it reframes everything above: the dual graph is **2.5D** in the lineage of
Civ / AoE2 / StarCraft / Dungeon Keeper — one map, **two layers, equidistant**. Every pair sits at
the same global VERTICAL offset (upper = slot 0 = top/attacker, the side with initiative; lower =
bottom/defender, "a few pixels below"); neutral and symmetric singles sit on the midline. The
projection is uniform so the eye learns it once — that uniformity is the entire trick, and it is
why the current feel (planets, neurons, glow) carries over unchanged.

Verdicts (presented with full reasoning at /dev/experiments/):

| Q | Verdict | Ruling |
|---|---|---|
| Q4 layout | **DISSOLVED** | `fixed`, rotated to vertical. `force` dies by uniformity. |
| Q3 pair tie | **DISSOLVED** | No line ever — verticality is the tie; a shared elliptical site-glow holds the pair. |
| Q6 symmetric | **DISSOLVED** | Singles stay single, ON THE MIDLINE. Never fabricate mirror pairs. |
| Q1 old links/lists | Recommended | A hub ordinal lights the WHOLE site (both members), camera anchored on the upper; successors map ships hub → {upper, lower}. |
| Q2 defender edges | Recommended | Static web = upper layer only; a lower node lights its real options only while focused/played. |
| Q5 partner under focus | Recommended | Halo encloses the SITE; partner co-lit dimmer with a side kicker (TOP/BOTTOM), never a repeated name. |
| Q7 focus sets | Recommended | Systems/lists light EXACTLY the captured sides; the site-glow supplies geography. |
| Q8 payload | Recommended | Compact pair wire: lower members DERIVED at ingest (twin + global offset + sv role-flip), v1.108.0 pattern; target ≤ 15KB gzip added. |
| Q9 first impression | Recommended | Draw math untouched (replay safety); the camera lands on the drawn FLOOR. |
| Q10 capture | Recommended | Capture the SIDE, never normalize to the pair; legacy pair ids resolve per Q1. |
| N1 depth cue (new) | Recommended | Lower layer ~0.95 scale, one shade dimmer — a whisper, never a ranking. |
| N2 partner click (new) | Recommended | Side switch via the existing confirmed roll-from-here seam, seeded on the twin. |

Build sequence if approved: (1) re-emit the layout vertical + midline and re-shoot the evidence,
(2) compact pair wire, (3) site rendering (glow, depth cue, kickers, partner click), (4) ordinal
cutover with the successors map, (5) everything behind `?dual` until the owner plays it and calls
it.

## 10. Projection C chosen (owner, 2026-08-17: "i want C") — true isometric

§9's "vertical offset on the flat map" reading is SUPERSEDED. The graph's (x, y) is the GROUND
PLANE; z is the PLAYER AXIS; the world is viewed in TRUE ISOMETRIC — all three axes at 120° on
screen (x toward the lower-right corner, y toward the lower-left, z up). Orthographic, so
world→screen is one fixed affine map, baked at emit time:

    sx = (x − y) · cos30°
    sy = (x + y) · sin30° − z·H        (canvas y grows downward; H = PAIR_DIST/2 = 4.0)

z ∈ {+1 sky side (slot 0 — top/attacker), −1 underworld, 0 singles ON the ground}. Because the
camera never rotates, projecting at emit means the renderer, camera, hit-testing and de-overlap
all run unchanged on projected coordinates — no 3D anywhere downstream.

Implemented: `scripts/prototype_dual_pair_layout.py` emits `graph-data-dual-iso.json` (2,637
nodes) and `?dual=iso` is allow-listed; renders committed as tests/artifacts/dualpair/iso-*.png
and shown at /dev/experiments/. Verdict deltas vs §9: Q3's tie is the GROUND SHADOW at z=0 (+ a
focus shaft), not a glow band; Rule 3's midline becomes the ground plane; N1's depth cue is
UNDERWORLD TONE (one shade darker/cooler below z=0, never smaller). A/B projections rejected for
the record: A (tilt-only) kept the learned geography but reads as squashed-today, not a new
world; B (2:1) is C's rotation family with a harder squash and less symmetry. Known cost,
accepted: the learned map rotates 45° and compresses — the price of the new world.

Build sequence: geometry DONE → site rendering (shadows, iso grid, underworld tone, kickers,
halo-holds-site, partner-click side switch, background-only starfield parallax) → compact pair
wire (≤15KB gzip target) → ordinal cutover with successors → sign-off behind `?dual`.

## 11. Running the prototype (the delivery seam that was missing)

The payloads are emitted to `tests/artifacts/dualpair/payloads/` and are **never** copied into
`source/public` — putting 2.2MB × 3 under the served tree would score against
`check_payload_budget` and could ride a manual deploy. Nothing bridged that gap, so `?dual=iso`
fetched a 404: five retries, then `_fallbackToLegacy()`, which since v1.80.0 falls back to a
front-end that no longer exists. The app looked broken. Two fixes, both permanent:

1. **`scripts/dev-serve.mjs` maps the URL** — `GET /static/neural/graph-data-dual-<v>.json` is
   streamed straight from the prototype directory. Nothing to copy, nothing to clean up, the
   deployed artifact stays byte-identical by construction. A missing file answers 404 with the
   command that makes it.
2. **A prototype flag never breaks the app** — a dual payload that will not load now degrades to
   the standard graph with a named console warning (`app.src.jsx`, the graph fetch). NB the bare
   `fetch("graph-data.json"` literal there is rewritten by `build.mjs` to prefix
   `__NEURAL_DATA_BASE` and must survive verbatim, or the build throws by design.

Run it: `npm run prototype:dual`, then **restart** the dev server (`npm run serve` — a running
server predates the new route), then `/?dual=iso`. Verified end-to-end in a real browser:
payload present → 2,637 nodes / 2,340 pair members / 0 page errors; payload absent → 1,467-node
standard graph, canvas alive, 0 page errors, one honest warning.
