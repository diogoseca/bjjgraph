# What the map means — the BJJ graph as a Markov game

Research, not behaviour: nothing here changes the app, a
probability, the content or an emitter. Every number carries its set definition and the command
that recomputes it; where the maths admits more than one defensible choice, both are computed and
the difference is the result.

**TL;DR.** Read as the corpus describes it, `graph.json` is an absorbing Markov chain of a
two-player exchange: 532 states. With no clock every roll ends in a finish; a 9–12-ply clock (the
app's clock length) leaves 29–31% of rolls from standing undecided. This document writes the chain down once
(`scripts/semantics/_kernel.py`) and proves it equal to the model EDGE and FLOW already price; an
independent Monte Carlo confirms it. Unless stated otherwise, figures are no-gi, under the
player-neutral initiative rule, with no clock. On that chain, what the map *means* comes out of the
mathematics:

- **No region traps a roll.**
  - A certified bound: no region holding at most half of a long fight's time can keep the walk
    longer than 7.7–8.5 steps.
  - Measured: real spells last 2.4–4.4 steps on either side of the named splits, against a roll of
    9.6 steps.
  - The dynamics carry only weak slow splits: top vs bottom; guard/standing vs passed/pinned (in a
    near-tie with a back/turtle split); and, at small mass, the leg-entanglement cluster, the most
    coherent split of all.
- **So a place means where it leads**: its distribution over the finishes that end rolls from
  there. The total-variation distance between two such distributions is provably the largest
  disagreement two places can have on any yes/no question about how a roll ends.
- **"Leg-lock territory" falls out with its number.** It is 22 positions. Averaged over those
  positions, **38.0% of the rolls that end, end in a leg lock, against 6.6% from standing**.
  Weighted by where long fights actually spend their time (inside the territory, and across the
  game for the baseline), the figures are 26.2% against 7.2%.
  - It holds within 36–40% across 200 perturbations of the authored numbers.
  - Three methods find it up to its edges: which endings are over-represented, how rolls end, and
    where a long fight stays. The ending-defined territory and the dynamics' leg set differ by four
    positions, and their union is exactly the sharper enrichment region.
  - Most of the map is honestly unnamed. By how rolls end, that is 95 positions holding 96% of a
    long fight's time; once the finisher's seat is allowed in a name, 76 positions holding 78.5%.
- **There is no interior choke point.** A theorem plus one measured fact shows that no set of
  passes, sweeps or takedowns carries the winning current one way only. Passage answers the question
  instead: side control on top appears in 60% of the rolls you win and 29% of those you lose.
- **FLOW and EDGE are placed exactly.**
  - FLOW is exactly a clocked, λ-weighted instance of the success-rate gradient, from a uniform
    start. The start alone is what separates it from the standing-start gradient (ρ 0.69).
  - EDGE departs from the corpus's own advantage almost entirely through its "you play perfectly
    afterwards" continuation, which dominates 1,204 of 1,223 cards.
- **The shipped map already carries this meaning, and could carry far more.**
  - Its places sit at Spearman 0.45 against the meaning metric, with nearest-neighbour territory
    purity 0.90.
  - A 9% median move would raise Spearman to 0.86 (purity 0.93) for at most ±115 wire bytes.
  - The cost is visual: returning players would see positions move, backside-50-50 by 16–51% of the
    map.

Along the way the cell measured four things the owner should know:
- **The app's game is much harder than the corpus's.** From standing, no-gi, under the app's own
  initiative rule, P(I finish) is 0.35 against 0.72.
- **The belt weights a different chain** from the one EDGE and FLOW price.
- **gi players are shown no-gi EDGE and FLOW.** The EDGE line is the no-gi one re-evaluated at gi
  rates, and 70 gi cards get none.
- **98.9% of the origin filter's dropped listings would teleport if restored as they stand.**

Nothing in the app, content or probabilities changed. §10 lists the owner's decisions, each with its
measured consequence.

> **Status since v1.210.0: items 4 and 6 ruled and shipped.** Everything below this box, and every
> artifact under `tests/artifacts/semantics/`, still describes the v1.206.2 graph (each artifact
> records that graph's sha256, so it now reads STALE). The re-measured headline, on v1.210.0:
> - **Item 4.** Each origin-orphaned technique is listed at its canonical origin. The attempt
>   shares come from an LLM persona panel, one independent round, which is not expert data
>   (`calibration/origin_coherence.json`, `scripts/apply_origin_coherence.py`). Orphans: 41 → 2 in
>   no-gi, 40 → 0 in gi. The two left, Tripod Sweep and Leg Extraction from Lapel Wrap, are listed
>   only inside guards no-gi does not have. The 13 coherent away-from-origin listings are NOT yet
>   restored: the panel would restore 8, and doing so needs a listing-level dealing rule that the
>   full game's projection must mirror.
> - **Item 6.** `frame_reachable` now walks the hands `build_hand` deals, so the no-gi walk reaches
>   the game's 244 role-nodes (it reached 248). Spider Guard and Double Sleeve Guard are hidden in
>   no-gi, both seats, with 20 techniques: 124 techniques and 22 role-nodes excluded, up from 104
>   and 18. The content change closes that door too (Tripod Sweep's no-gi cells are now null), so
>   on today's content the old and new walks agree. The walk guards future listings, and a synthetic
>   fixture in `validate:availability` pins it.
> - **What moved.** From standing, no-gi, P(I finish) 0.5529 → 0.5533 under the player-neutral
>   rule, 0.7225 → 0.7237 under the shipped rule, and 0.3489 → 0.3440 in the app's game. The
>   finisher law moved by TV 0.035 (player-neutral) and 0.037 (shipped). Leg locks end 8.1% of
>   rolls from standing (was 6.6%); leg-lock territory is 21 positions (aoki-lock control drops
>   out), and its share is 39.0% (was 38.0%). The origin filter drops 47.8% of role-matching
>   no-gi attempt points (was 48.4%). Flow compression still finds 40 modules.
> - Recompute: `python3 -B scripts/semantics/_kernel.py --structure`,
>   `python3 -B scripts/semantics/flux.py --origin --out <dir>/flux_origin.json`,
>   `python3 -B scripts/semantics/app_game.py`.

---

## 1. The object

### 1.1 What `graph.json` is, mathematically

Read as the corpus describes it, the graph is an **absorbing Markov chain of a two-player
exchange**:

- **States** are the 266 position role-nodes (133 positions × top/bottom) × whose turn it is:
  532 transient states, every one written from *my* side. Bare hubs and family hubs are flashcard
  aggregators with no edges; they are not states.
- **A step** is one card: the player to move draws a technique from their seat's authored attempt
  shares, it succeeds with its success rate, and one authored outcome cell of the chosen branch
  decides where the pair lands.
- **Absorbing states**: **W** (I finish them), **L** (they finish me) and **D** (an optionless
  hand). `game-over` is the only sink in the corpus and only submissions reach it. Every state is
  absorbed with probability 1 (`I − Q` is invertible, gated). That is why committors, absorption
  probabilities and first-passage times are well posed here, not metaphors.
- **Two chains, not one.** Every probability is a `{gi, nogi}` pair. The two chains differ only
  in:
  - attempt shares;
  - success rates (133 dealt techniques fork);
  - the 62 no-gi `null` cells.

  Outcome distributions never fork: 0 of 4,110 authored outcome cells differ.

### 1.2 The kernel — written down once, gated, independently verified

`scripts/semantics/_kernel.py` writes the chain down as `(Q, R, R_fin)`: transient→transient,
transient→{W, L, D}, and the W/L mass split by the finishing technique. It is built as a thin layer
over `solve_edge_values.Model`, the model EDGE and FLOW already price. Every corpus-game number in
this document is computed on this one matrix. §1.3 and §7 build other chains on purpose, to compare
against it.

- **Gate** (`python3 -B scripts/semantics/_kernel.py --selfcheck`, 59 checks). The finite-horizon
  recursion reproduces `solve_edge_values.solve(policy="sample")` to <1e-15 on 17,024 state
  values: gi/no-gi × shipped/symmetric initiative × H ∈ {1, 2, 5, 11}. Its H → ∞ limit equals the
  absorption solve to 1e-9. The player-swap symmetry of the symmetric rule holds exactly.
- **Independent verification** (`python3 -B scripts/semantics/independent_sim.py`, which writes
  `tests/artifacts/semantics/independent_sim.json`). A Monte Carlo written from the rules, reading
  `graph.json` directly with no repo imports (gated at import), 300,000 rolls × 4 configurations,
  agrees with the kernel on:
  - P(I finish);
  - expected roll length;
  - the finish mix by submission type and performer.

  The largest |z| over 63 comparisons per configuration was 3.16, and it replicates away: four
  further seeds pooled give +0.72, the opposite sign. Its exact solve matches the kernel on all
  532 states: every absorption probability to ≤ 2e-15 and every expected roll length to ≤ 2e-14.
- **What the Monte Carlo cannot see.** The rules do not say whose turn follows a landing reached
  through a chained hub cell. From standing, the Monte Carlo cannot tell the three plausible
  readings apart. The exact solve and a Monte Carlo started at the affected states can: they
  identify the kernel's rule, with every other reading off by up to 0.018 in an absorption
  probability. That identifies the rule; whether it is the right game rule is a content question
  (§10.11).

### 1.3 Which game — the corpus's, not the app's

The kernel is **the corpus's game**: both seats sample the authored shares, there is no resistance
and no clock (H = ∞), and control positions stay positions. It is not the app's game, and the gap
is measured, not assumed.

Since v1.176.0 the app's `opponentDefend` routes through `optionsFor` (`app.src.jsx:17564`).
- So the candidate set is role- and origin-filtered, drawn from layout adjacency.
- The app therefore deals every technique at its canonical origin, including the 41 the corpus
  lists only elsewhere (§1.4).
- CLAUDE.md §5's "no role or origin filter, ~12%" is stale.

The app then chooses by its own rule:
- a finish with probability clamp(0.34 + 0.55·adv, 0.18, 0.85);
- otherwise uniformly among the top 3 transitions by landing value.

It never reads attempt shares. It also resists the player's odds (aiMod), re-routes 12 control
hubs to submission states, and clocks the roll at 9–12 moves.

From standing, me first, no-gi, **shipped initiative**. That is the rule the app uses; the
player-neutral headline elsewhere in this document is 0.5529. "Clock" is the app's own move clock
(maxMoves 9–12, with its `moveCount` rules ported).

| layer | P(I finish), H = ∞ | P(I finish), app clock | P(no finish), app clock |
|---|---:|---:|---:|
| (a) the corpus's game — this kernel | **0.7225** | 0.4719 | 0.354 |
| (b) + the app's opponent choice rule | 0.5872 | 0.4354 | 0.252 |
| (c) + the app's escape resolution (uniform / best escape) | 0.5859 / 0.6057 | 0.4352 / 0.4445 | 0.250 / 0.258 |
| (d) + the app's resistance to my odds (aiMod) (uniform / best escape) | **0.3489 / 0.3770** | 0.2559 / 0.2667 | 0.261 / 0.284 |

How the app's rules work, one layer at a time:
- **(b) the opponent's choice.** `optionsFor` → `_cmpDealt` → the top 3 by landing value, with a
  finish w.p. clamp(0.34 + 0.55·adv).
- **(c) escape resolution.** `escapeChance`, including its `(myVal(res) − myVal(sub))·0.15` term,
  with the escape choices read from the emitted `submission-details`.
- **(d) the resistance to my odds.** aiMod = 0.4·max(0, opponent's side value) + aiSkill, averaged
  over aiSkill ∈ [0.06, 0.20]. My finishes are priced in the submission state.

**What each layer costs the player:**
- The app's opponent choice costs about 13.5 points, and the resistance about 24 more.
- The escape resolution is roughly neutral.
- The app's game is a markedly harder game for the player than the corpus describes.

Numbers shown in the app should therefore say which game they are about. The app's opponent is
**not** described by CLAUDE.md §5's "no role or origin filter, ~12%" anymore. Since v1.176.0 it
draws from role- and origin-filtered candidates (adjacency-drawn, so a superset at origins: it
includes the 41 orphans), but chooses among them by its own rule.
Its choice policy is at total variation 0.57 from the corpus's, weighted by where it plays.

Recompute: `python3 -B scripts/semantics/app_game.py`. It is a line-by-line port of the app's
opponent, escape and clock rules; every rule cites its `app.src.jsx` line.
- **Gate** (`--selfcheck`, 46 checks), including:
  - a mutant that swaps the kernel's opponent back in and reproduces the kernel exactly;
  - mutants proving the escape term, the escape pick, the submission pricing and every clock rule
    each move the result.
- **Independent review.** It was reviewed twice against the app source. A Monte Carlo written
  independently from the source agrees with its clock recursion to within one standard error.
- **Named approximations.** The script prints each one with its exposure:
  - the aiSkill integration grid moves no-gi P(I finish) by under 0.0005, and the clock's labelling
    of unported rows by under 0.0008;
  - gi resolves cards at the folded rates; reading gi's own rates instead moves the gi figure by
    +0.002 at H = ∞ and +0.004 under the clock;
  - the 12 control-alias hubs keep kernel rows. A no-gi roll spends 0.07 opponent turns there; the
    effect of that on P(I finish) is not measured.

The meaning of the MAP is a statement about the corpus. That is the object here; the app's game
is a product mechanic layered on it.

### 1.4 The one transformation that matters: the origin filter

`build_hand` (and the app's `optionsFor`) deal a listed card only at its canonical origin
(`fromPositionId`), relaxing that only when it would empty the hand.
- **What it drops:** 12,827 of 26,500 authored, role-matching attempt points in no-gi (48.4%) and
  12,544 of 26,600 in gi (47.2%). Weighted by how often each hand is played per roll from standing,
  the share is 22.8% (no-gi, player-neutral) or 24.9% (no-gi, shipped rule).
- **What it orphans:** 41 techniques (no-gi) / 40 (gi). These are listed only away from their
  origin, so the corpus's game deals them nowhere: Shrimp Escape, Elbow Escape to Guard, Knee Slice
  from Half, Half Guard Pass, Body-Lock Pass, Granby, ….
- **The app still deals all 41**, at their canonical origin, through layout adjacency. There the
  corpus gives them no attempt share.

So the corpus answers "where is this move played?" in two places that disagree on half its mass.
Every headline below is also computed with the filter off (`origin=False`).
- **How rolls end:** turning the filter off moves it by total variation 0.09–0.12.
- **Roll length:** 9.6 → 10.9 steps under the player-neutral rule; 11.3 → 13.2 under the shipped
  rule.
- **Who wins cannot move under the player-neutral rule.** From a fair start P(I finish) stays
  exactly ½ (the proposition below). Under the shipped rule it moves by +0.0075.

Recompute: `python3 -B scripts/semantics/_kernel.py --structure`.

**Which reading is right? The corpus's own outcome tables answer it.**
- A card's outcome table is authored at its canonical origin.
- For **1,196 of the 1,209** dropped listings (98.9%), at least half of the miss branch (the
  authored failure and counter cells) lands on the *origin's* position (the hub, either seat). None
  puts half on the listing's own position; 16 put some there, the most 43.3% (Turn In and Face at
  back-control/bottom).
- So dealing a listing where it is listed would **teleport** a failed move. A Hip Escape to Guard
  failing at side control would put the pair in a gift wrap they were never in.

The filter is therefore right *given the data*. The real issue is a schema limit: a generic move
(Hip Escape to Guard is listed at 33 positions, Knee Slice Pass at 41) carries one outcome table
authored at one origin.
- The coherent fix is a per-listing outcome table: content work, not a filter flip.
- 13 listings are coherent and could be restored as they are.
- The 41 orphans are a **listing gap**, not a wrong `fromPositionId`. Their canonical origin does
  not list the move at all, yet their outcome tables belong there, and the app already deals them
  there. The missing piece is an attempt share at the origin.

**Why who-wins barely moves is a theorem, not a finding about importance.** Under the player-neutral
rule, restoring any listing changes the same hand for both seats, so the player-swap symmetry is
preserved. From a fair start P(I finish) is pinned at exactly ½ (Proposition O3). Under the shipped
rule nothing pins it, and the whole filter moves it by only +0.0075 (0.6949 → 0.7023).
- Asked only which *kind* of finish ends the roll (performer × type), the filter's effect shrinks
  from TV 0.106 to 0.022. Most of what it changes is which named variant finishes
  (Kimura-from-X against Kimura-from-Y), not what kind.
- Single-listing effects do not add: interaction is 83% of the joint change.

Recompute: `python3 -B scripts/semantics/flux.py --origin`, which writes
`tests/artifacts/semantics/flux_origin.json`.

---

## 2. Three structural facts

**2.1 Every roll ends, and a finish decides it.** P(draw) = 0 at H = ∞ in both frames: no
optionless hand is reachable. `I − Q` is invertible, so every absorption quantity exists.
- A roll lasts 11.3 steps from standing (no-gi, shipped initiative), or 9.0 plies. A step is one
  card; stay-put misses cost 0 plies.
- Only a clock produces draws. A 9–12-ply clock on the corpus's game ends 29–31% of rolls from
  standing undecided.

**2.2 No part of the map traps a roll; the dynamics carry two weak splits.**
Proofs are in the lane record; recompute with `python3 -B scripts/semantics/territories.py`.
- **The certified bound.** Take the chain conditioned never to finish (the Q-process) and its
  additive reversibilisation R. For any region S:
  - its "slowness" λ*(S) is the Rayleigh quotient of its centred indicator;
  - λ*(S) is at most λ₂(R);
  - so its residence is at most 1/((1 − λ₂)(1 − μ(S))).

  That gives a certificate: no region holding at most half the mass keeps the walk longer than
  7.7–8.5 steps. It holds in every configuration and in 200 of 200 perturbations. The best region
  any search found holds 4.4–5.9 steps, against a roll of 9.6–11.6.
- **How much the first reading of this overstated it.** A split's relaxation time
  τ_lin = 1/(1 − λ*) is exactly half the harmonic mean of its two residences: 2.7–2.9 steps for the
  balanced named splits, and 2.9–3.1 for the leg set. The usual log form τ = −1/ln λ* is shorter
  still (2.1–2.4, and 2.4–2.6 for the leg set; origin filter on, all four configurations;
  `territories.json` → `configs.*.splits.*.levels.*.tau_lin_steps` / `tau_log_steps`). A region's
  residence is κ·τ, with κ = 2.5 for the balanced seat split (player-neutral rule; 2.8 under the
  shipped rule), so comparing τ with the roll overstates the margin by about 2.5×. The honest
  margin is about 2×, and it is still "no trap".
- **The two splits.** The slow modes are nameable:
  - the **seat** split: everyone on top vs everyone on bottom;
  - the **phase** split: the guard/standing game (64 positions: open guard, closed guard, standing,
    combat base, X-guard …) vs the passed/pinned game (half guard, side control, mount, back,
    turtle).

  Under the player-neutral rule these are **exactly orthogonal** modes of the player-swap symmetry:
  seat is odd, every union of positions is even. Neither is a trap. A real spell on either side of
  either split lasts 2.4–5 steps.
  - The passed/pinned side is where rolls end: 65% of its spells end the roll.
  - "The" phase split is a near-tie among three balanced splits: guard vs pinned, back/turtle vs
    rest, and a standing core vs rest. Guard vs pinned wins on the authored numbers, and in 77.5% of
    perturbations.
  - Under origin=False the balanced split becomes back/turtle vs rest.
  - These are the *balanced* splits. The most coherent *localized* split is the leg set (§4.3).

**2.3 Therefore a place means where it leads.** Residence cannot define "leg lock territory" as a
trap: no region keeps the walk (§2.2). A spell in the leg set lasts 2.4 steps, and only 2.8% of
rolls from standing ever enter it (`territories.json` →
`configs["nogi/symmetric/origin-on"].real_roll_sojourn.localized.coin`). The dynamics do single the leg set out as their most coherent localized split (§4.3). What
the region *means*, though, is how its rolls end.

What *can* define it is the **harmonic measure**: for each state, the distribution over the
finishes a roll from there ends in. It is `K.exit_law()`, one linear solve:
`Bf = (I − Q)⁻¹ R_fin`. This is the classical harmonic measure of an absorbing chain (the Dirichlet
problem), applied to a sport.

Every question about how a roll from here **ends** is a linear functional of that measure. Every
question about its expected **duration** is a linear functional of the fundamental matrix:
- "is this good for me?" is the mass on my finishes (the committor);
- "what do I get caught in here?" is the mass on their leg locks;
- "how soon does it end?" is the expected time.

Two other questions need their own solves:
- "will my winning roll pass through side control?" (passage, §5.2) needs a killed-chain solve;
- "does it end within the clock?" needs the ply recursion.

Two positions **mean the same thing** when their harmonic measures agree, whether or not they are
neighbours on the graph.

---

## 3. What a place means — exact scalars per state

Everything here is in the corpus's game. The headline configuration is no-gi, symmetric
initiative, H = ∞. Recompute with `python3 -B scripts/semantics/scalars.py --json`, or one state's
full card with `--state <role-node>`. Proofs of Propositions A–F are in the lane record; the
`--selfcheck` run (421 checks) verifies each one numerically on the real kernel.

### 3.1 Four numbers per place

- **The committor**: whose position this is. `q(s) = P(I finish them before they finish me)`,
  from state s.
- **Tempo**: how fast it ends, as the expected plies to a finish.
  - The hottest places are body-triangle/top (3.2 plies), backside-50-50 and invisible-collar/top.
  - The coldest are vaporizer/bottom, feet-on-hips guard and seated guard (about 10.5).
  - Better seats end sooner (Spearman −0.49), because you finish.
- **The exit profile**: what ends rolls here. It is the harmonic measure grouped by body region
  and performer (§2.3, §6.1).
- **The clocked committor**: what a 9–12-ply clock (the app's clock length, applied to the corpus's
  game) does to the committor.

### 3.2 Theorems about places

- **The clock takes finishes, never gives them.** Proposition B: `0 ≤ q(s) − V_H(s) ≤ P_s(T > H)`.
- **A roll that outlasts the clock is a coin toss.** Proposition F (a Yaglom limit): under the
  player-neutral rule, P(I finish | the roll outlasts the clock) tends to **exactly ½** as the clock
  lengthens, at every state reachable from standing. At the 9–12-ply length it is already within
  0.005 of ½. Under the shipped initiative rule the limit is 0.697: long rolls favour the side with
  the initiative.
- **So the clock sharpens verdicts rather than reordering them.** Rank correlation between the
  clocked and infinite committors is 0.993. Under the shipped rule, all 40 favourite flips go
  *against* the player.
- **Territories have a core and a halo.** Proposition C, the maximum principle: the probability
  that a roll ends in class C is harmonic off the states that deal a C finish directly. It
  therefore peaks on that **core**; every other state (the **halo**) inherits at most
  P(reach the core) × the best core value.

  The core is structural. It cannot change under the robustness perturbations, which preserve the
  zero pattern, nor between the two initiative rules. Only the frame and the origin filter can move
  it. Measured cores (no-gi, performer = me):

  | raw type | core states | peak |
  |---|---:|---|
  | blood choke | 44 | 0.79 at invisible-collar/top |
  | leg lock | 26 | 0.57 at honey-hole/top |
  | shoulder lock | 43 | 0.46 at modified-mount/top |

- **The two seats are complements.** Proposition D: under the symmetric rule
  q̄(top) + q̄(bottom) = 1 − P(draw). A position whose authored label gives **both** seats the same
  direction therefore cannot agree with the player-neutral committor on both. 13 positions are labelled that way,
  including x-guard, de-la-riva guard, spider guard and guillotine control. That is an inconsistency
  in the labels, exposed by symmetry alone.

### 3.3 Does the corpus's own vocabulary agree with the maths?

**On average, yes, strikingly.** The mean turn-neutral committor is **monotone in the authored
`positionType`**, in every frame and rule:

| positionType | n | mean q̄ |
|---|---:|---:|
| Defensive | 84 | 0.386 |
| Defensive with offensive options | 34 | 0.475 |
| Neutral | 14 | 0.501 |
| Offensive | 60 | 0.531 |
| Offensive/Controlling | 72 | 0.619 |

The rank correlation between q̄ and label direction is 0.71. `strength` is *not* independent
evidence: its sign is forced by positionType.

**Where they disagree, it is guards.** Of the 46 role-nodes where the label and the committor
point opposite ways:
- 23 are **bottom seats labelled Offensive whose committor is below ½**: lasso, matrix,
  New York, butterfly-half, deep-half, reverse de la Riva, single-leg X, rubber, worm, squid,
  lockdown …;
- 16 are the matching top seats;
- 22 hold under all four robustness tests.

The strongest are guillotine-control/bottom (labelled Offensive/Controlling, q̄ 0.32, 200/200
perturbation seeds) and williams-guard/bottom (labelled Defensive with options, q̄ 0.60).
Read plainly: the corpus's words call the guard player the attacker, and the corpus's numbers give
the top a small edge over the whole roll. Those can both be true. Whether a label should mean "you
attack here" or "you are winning here" is the content question for the owner.

### 3.4 Where wins and losses pass through

From standing (no-gi), rolls I win take 8.9 steps and rolls I lose take 10.5. Share of the roll's
*time* spent there, winning minus losing rolls:
- **side-control/top +0.064 and side-control/bottom −0.061.** The meaning is in the seat, not the
  hub: side control's hub difference is +0.004.
- §5.2 asks a different question, "did the roll ever pass through", and there the hub does not
  cancel.

### 3.5 gi vs no-gi, and the folded-rate issue

- **gi vs no-gi changes HOW rolls end far more than WHETHER** (§8). The finisher law moves by total
  variation 0.20. Who wins cannot move from a fair start under the player-neutral rule, by symmetry.
  Under the shipped rule it moves by +0.003.
- For backside-50-50/bottom, the exact card attribution (Proposition A1, one of two valid
  attributions) puts its −0.17 of committor on *Heel Hook from Backside 50-50*: −0.60, because it is
  not attempted in gi. Two cards dealt only in gi partly offset it (+0.23).
- **EDGE and FLOW price gi-only techniques at their no-gi rate.** The shipped model reads the
  folded no-gi `successRate` in both frames, but the app's `calSuccess` reads the frame's rate.
  The worst case is *Bow and Arrow Choke from Harness*: gi rate 45, priced at the no-gi 10.
  The exact consequence for EDGE integers and FLOW rankings is in §8.

## 4. Territories and their names

A territory is a claim about a set of places. Here it is defined by **where rolls end** (§2.3),
named in the corpus's own vocabulary, and published with its fit. Recompute with
`python3 -B scripts/semantics/naming.py --territories` and `python3 -B scripts/semantics/geometry.py`
(runtimes and memory in §11).

### 4.1 Leg-lock territory — the owner's example, with its number

In the corpus's game (no-gi, player-neutral rule, H = ∞), **leg-lock territory** is the 22
positions from which a leg lock is at least twice as likely an ending as from standing:

> 50-50 guard, aoki-lock control, ashi garami, backside 50-50, carni, cross ashi, estima-lock
> control, grasshopper guard, honey hole, inside ashi, inside sankaku, kneebar control, leg
> entanglement, leg knot, outside ashi, saddle, single-leg X, straight-ankle-lock control,
> toe-hold control, truck, ushiro ashi, X-guard.

- **Starting uniformly anywhere in these 22 positions, 38.0% of the rolls that end, end in a leg
  lock, against 6.6% from standing.**
  - The player who started on top finishes 25.0 points of that; the bottom starter finishes 13.0.
  - Under a 9–12-ply clock (the app's clock length, applied to the corpus's game) the figures are
    48.4% vs 6.4%: leg locks end rolls fast, so the clock concentrates them.
  - Weighting the start by where time is actually spent changes 4 of the 46 names of gs-1's regions
    (`naming_gs1.json`), so the start law is part of the definition. This holds for every name in
    §4.2–§4.5.
- **It has a core and a halo** (Proposition C).
  - 21 of the 22 positions deal a leg lock themselves: the core.
  - Leg knot deals none. Its 21% leg-lock share is inherited from the core it reaches: the halo.
- **It is robust.** The share stays within 36.1–39.5% across 200 perturbations of the authored
  numbers.
  - The same 22 positions come out under the shipped initiative rule.
  - 21 positions under origin=False.
  - Under gi, 23 against its own baseline, but only 17 against the no-gi baseline. The gi version
    is §8.
- **A second method on the same exit law agrees on where it is.**
  - Clustering places by the metric of meaning (§6.1) selects a 16-position leg territory.
  - That set is the sharper R_LEG(3) minus leg knot: Jaccard 0.94.
  - Neither was drawn by hand.
- **The name fits the corpus's own vocabulary.**
  - Against Danaher's leg-lock System: F1 0.65.
  - Against the ashi-garami position family: F1 0.58.
  - Against the positions that deal a leg-lock submission, precision is 0.955 (21 of 22). That is
    Proposition C at work, not independent evidence.
  - All are exploratory hypergeometric tests with BH correction, q < 1e-5.
- **The traffic-weighted fit is the subtle part.** Weighted by where a long fight spends its time,
  recall falls to 0.054. The busy positions that *list* a leg-lock entry (half guard, side control,
  closed guard) are not places where leg locks *end* rolls there.

### 4.2 The whole map

Per-position names use the rule: the body region whose share of rolls that end is at least 2× the
standing baseline, and at least 5 points above it.

Pooled names (either player's finishes; §4.4 adds seat-aware names):

| name | positions | what it means |
|---|---:|---|
| leg-lock territory | 21 | as above |
| "twister" (spine) territory | 3 | twister control, twister side control, russian cowboy: 6.3% spinal finishes against 0.7% |
| hip/groin | 2 | electric chair, truck: small shares (6–9%) |
| arm-lock | 1 | armbar control: 40% arm locks against 18% |
| **unnamed: the middle game** | **95** | holds **95.9% of a long fight's time** and ends the way rolls end everywhere (76 positions, 78.5%, once seat-aware names are added) |

- **Chokes and shoulder locks form no territory at 2×.** They are the default endings: 46% and 28%
  of rolls from standing.
  - A territory would need a place ending ≥ 93% of its rolls in a choke, or ≥ 56% in a shoulder
    lock. No place does; that is measured.
  - At 3× a choke territory is impossible by arithmetic alone (3 × 46% > 100%).
- **Where chokes do concentrate, the defining feature is *who* chokes.** Clustering by the metric
  of meaning finds a back / front-headlock / choke-control territory of 30 positions:
  - As a set, it is the corpus's choke vocabulary: F1 0.70 against the choke-dealing positions.
  - The player who started on top finishes 42% of rolls there by choke; the bottom starter 15%.
  - Even with seats, the region *as a whole* stays middle game: top-player chokes reach only 1.82×
    the per-player baseline. Its choke character is carried by 9 of its positions that are each
    "choke territory for the top player" (§4.4).
- **Per-position robustness.** 115 of 122 names (or "unnamed") hold in ≥ 95% of 200 perturbations
  *and* under origin=False, the shipped rule, and gi. The seven that do not are listed with their
  fractions in the lane record. Aoki-lock control and twister side control are the fragile ones.

### 4.3 The dynamics agree: where the walk stays names the same regions as where it ends

Three methods were run: two on the same exit law, and a third on the conditioned dynamics. Their
agreement is agreement across methods on one kernel, not independent confirmation from outside the
corpus. It is the strongest evidence here that these regions are not artefacts of one method:

| lens | leg-lock region it finds |
|---|---|
| exit-law share enrichment (§4.1) | R_LEG(2), 22 positions; R_LEG(3), 17 |
| clustering by the metric of meaning (§6.1) | 16 leg-entanglement positions = R_LEG(3) minus leg knot |
| the **slowest two-block split of the dynamics** (λ*-maximal, §2.2) | the 14 leg-entanglement positions: the most coherent two-block description of the whole map |

The first two lenses read how rolls **end**. The third reads where the conditioned walk **stays**.
Starting from the ending-defined leg territory, 4 single-position flips reach the dynamical
optimum. The back/choke-control territory is 9 flips from a local optimum of the same objective.

**The exact set algebra**, from the atlas that joins every lane (§11):

    leg map module (9) ⊂ dynamical leg set (14) ⊂ R_LEG(3) (17) ⊂ R_LEG(2) (22),
    ending-metric leg territory (16) ⊂ R_LEG(3), and
    R_LEG(3) = ending-metric territory ∪ dynamical set, exactly.

The five leg sets differ only at their edges. Four of them form a strict chain. The ending-metric
territory and the dynamical set are *not* nested: they differ by four positions (carni,
estima-lock control and kneebar control on one side, leg knot on the other), and their union is
exactly R_LEG(3).
- The eight positions common to all five are the ashi family: 50-50, backside 50-50, cross ashi,
  honey hole, inside ashi, outside ashi, saddle, ushiro ashi.
- The edge at θ = 2 is the leg-lock *entries*: aoki-lock control, grasshopper guard, single-leg X,
  truck, X-guard.

The leg region is still not a trap. It is rarely entered (2.8% of rolls from standing), and a spell
there lasts 2.4 steps. But **48% of its spells end the roll**: its meaning is how it ends.

**Flow compression** (the map equation of Rosvall & Bergstrom, on the walk conditioned to go on)
finds 40 modules:
- It compresses the walk's description by 14.5%.
- It is stable across 20 perturbations (NMI ≥ 0.958).
- It refines both the phase split (purity 0.993) and the ending territories (0.988).
- Its most coherent modules are the leg-entanglement module, the butterfly family and the
  front-headlock family.
- The techniques that cross module borders are the map's **roads**. They are passes (open/closed
  guard → the half-guard/side-control module), pin-to-pin transitions (side control → mount,
  north-south, knee on belly, kesa), escapes and back takes.

A k-way metastable decomposition (G-PCCA+) finds no crisp structure beyond the leg set. At k = 2
its second block is a leg-entanglement cluster of 11 positions, with fuzzy memberships
(self-overlap 0.15; the decomposition's crispness is 0.54), while the rest of the map forms one
block of 111 positions holding 92% of the mass crisply. That cluster is not the 14-position
dynamical leg set: it adds estima-lock control and lacks backside 50-50, leg entanglement, leg knot
and straight-ankle-lock control. At every computable k from 3 to 8 (k = 7
would split a conjugate Schur pair), at most 0.7% of the mass has a membership of at least 0.9
(no-gi, player-neutral rule, hub level; `territories.json` →
`configs["nogi/symmetric/origin-on"].gpcca_k2_blocks` and `.gpcca.hub`). That is consistent with
the certificate.

### 4.4 Naming by who finishes — seat-aware names, and why they are fragile

Pooled names ask how rolls end. **Seat-aware** names ask how the player who *started on a given
seat* finishes. The per-player baseline is half the pooled standing share, and the two gates are
unchanged.
- **The seat rule can only refine a pooled name, never contradict it** (proved).
- **Pooled finish classes cannot see the seat split** (proved). Under the player-neutral rule, top
  and bottom starts give identical pooled class shares. The seat split therefore has no name by
  *how* rolls end, only by *who* ends them. Measured, it reads "the top player finishes more of
  everything" and passes no gate.

With seats, 19 more positions get names, and the unnamed middle shrinks from 95 positions (95.9% of
a long fight's time) to 76 (78.5%):

| seat-aware name | positions |
|---|---|
| **choke territory for the top player** | back control, body triangle, darce control, dead-orchard control, guillotine control, harness, invisible collar, rear triangle, seat-belt control. Back control: 61% of rolls end in a choke, 48.3% by the top starter against 12.9% by the bottom starter. |
| **arm-lock territory for the top player** | mount, high mount, knee on belly, mounted crucifix, S-mount, technical mount |
| **shoulder-lock territory** | kuzure-kesa, modified mount and ushiro-kesa for the top player; the kimura trap for the bottom player |

**The seat qualifier is fragile, and that is reported, not tuned away.**
- Only 2 of the 19 new seat names hold on all four robustness facts: invisible collar (choke, top)
  and S-mount (arm, top).
- Most sit just above the 2× seat gate. Back control is at 2.08×, holding in 162 of 200
  perturbations; mount is at 2.09×, holding in 146 of 200.
- Restoring the origin-filtered listings dilutes them.

**The class part of a name is robust; the seat part is where the fragility is.**

### 4.5 Name cards — every sentence generated from data

`tests/artifacts/semantics/naming_cards.json` holds 154 template-generated sentences: one per
position, one per territory, and the refusals. Every one of their 1,051 numbers is fetched from the
artifact by path. The build refuses a sentence containing any other digit, and it lints every
sentence against the copy rules (§12.1). Rebuild with
`python3 -B scripts/semantics/naming.py --cards`. Three examples, verbatim:

> *50-50 Guard*: In the corpus's game (no-gi), 50-50 Guard is leg-lock territory for both players:
> 47.2% of the rolls that end from here end in a leg lock, vs 6.6% from standing — 28.4% by the
> player who started on top, 18.8% by the one who started underneath; it deals leg locks itself
> (core); the name holds in 200/200 perturbations and with the origin filter off, under the shipped
> initiative rule and in gi; it holds 0.096% of a long fight's time.

> *Half Guard*: In the corpus's game (no-gi), Half Guard is middle game: its rolls end much as rolls
> from standing do; its most over-represented ending, the leg lock, is 9.4% of the rolls that end,
> vs 6.6% from standing; being unnamed holds in 200/200 perturbations and with the origin filter
> off, under the shipped initiative rule and in gi; it holds 20.8% of a long fight's time.

> *Choke territory at 3×*: In the corpus's game (no-gi), choke territory at 3x cannot exist: chokes
> are already 46.4% of all endings from standing, and 3 times that is 139.3%, more than every roll.

## 5. How rolls are won — flux, choke points, sensitivity, and the bridge to EDGE and FLOW

Recompute with `python3 -B scripts/semantics/flux.py`, which writes
`tests/artifacts/semantics/flux.json`. Proofs are in the lane record; `--selfcheck` runs 28 checks
plus `_tpt.py --selfcheck`'s 11 synthetic cases. The setting is the corpus's game, no-gi, the
player-neutral rule, from standing with me first, H = ∞.

### 5.1 There is no interior choke point — a theorem

Transition-path theory gives the **reactive current**: how much of the probability of "I finish"
flows along each edge, net of back-flow. Its max-flow equals its min-cut, which equals P(I finish),
so a min-cut is a set of edges that carries all of the winning current one way.

**Theorem.** In a network saturated by its flow, a cut is minimum iff no edge crosses it backwards.
Here, measured, the net winning current's support is **one strongly connected component**. It
covers all reachable states (486 in the headline configuration; 487–530 elsewhere), both standing
seeds included, in every configuration, and in 100 of 100 perturbations of the headline. So the
only minimum cut is the **finishing layer** itself.

In a grappler's words: short of the finish, no set of passes, sweeps or takedowns carries the
winning current one way only; some of it always flows back. The opening exchange from standing is
crossed by every roll, and re-crossed. **The corpus's game narrows only at the finish.**
- The finishing layer is led by Rear Naked Choke from Back Control, 9.3% of my wins.
- It then runs through Arm Triangle, Kimura, Americana and Armbar from side control. The top five
  hold ~29%.

### 5.2 Passage — the question "choke point" was really asking

The trajectory statement is **passage**: the share of won or lost rolls that ever visit a place.

| place (my seat) | in rolls I win | in rolls I lose |
|---|---:|---:|
| side control, **on top** | **59.6%** | 28.7% |
| side control, **underneath** | 19.2% | **60.9%** |
| mount, on top | 21.8% | 11.3% |
| half guard, underneath | 23.6% | 35.2% |

The hub alone says little: side control appears in 65.5% of won and 70.9% of lost rolls. **The
meaning is the seat.**
- **Won rolls are made of consolidation.** My Side Control to Kesa ×1.8, Consolidate Mount ×1.6
  and Back Control Maintenance ×1.6 are over-represented in wins.
- **Lost rolls are made of framing from underneath.** Frame from Side Control ×0.41 and Hip Escape
  ×0.49.

Passage figures are exact trajectory probabilities. The flux routes of §9 are flow-decomposition
shares, not the probability that a roll follows that route.

### 5.3 Which authored numbers matter most — sensitivity

`dP(I finish)/dp_t`, the derivative with respect to technique t's success rate, is exactly
**traffic × leverage**: expected plays of t per roll × the mean value of turning one of its misses
into a success. One adjoint solve gives every technique; it is checked against finite differences
on 25 techniques per configuration.

**Units.** The gradient is per unit of success *probability* (1.0 = 100 points). For my own hand,
raising a technique's success rate by 1 percentage point raises P(I finish) by 0.01 × its gradient.

The top five for my hand are:
- Takedown from Bottom: +0.032 per unit, i.e. +0.0003 per point;
- Level Change Takedown: +0.030;
- Rear Naked Choke from Back Control;
- Arm Triangle from Side Control;
- Kimura from Side Control.

Raising a rate for *both* players is exactly neutral from a fair start under the player-neutral rule
(proved). From standing with me first it only moves my first-move advantage (+0.021 for Takedown
from Bottom). So the meaningful sensitivity is one seat's.

A ranking is silent about 101 techniques by construction: the 41 origin-orphaned techniques are
never dealt, and 60 are dealt only where no roll from standing arrives. Their zero gradient, traffic
and passage are not evidence that they do not matter.

### 5.4 The bridge to FLOW and EDGE — exact, not analogy

- **FLOW is the clocked instance of this gradient.** It uses an 11-ply horizon, a
  λ-weighted payoff and the drill parameter. The kernel's cells reproduce FLOW's whole gradient
  vector to machine precision (≤ 3e-16): 1,464/1,464 no-gi decks and 1,520/1,520 gi.
  - Changing one ingredient at a time shows where FLOW's ranking and the committor gradient part.
  - It is almost entirely **the start distribution**. FLOW averages over every live position,
    close to the app's default "Anywhere" start. A match starts standing, and at that step
    ρ = 0.69. Clock, λ and clamp barely matter (ρ 0.95–1.00).
  - Which start FLOW should assume, the app's default or a match's, is an owner decision (§10).
    **Taken in v1.209.0:** the player's own start setting (§10 item 8).
- **EDGE is a centred advantage.** Its continuation assumes you play perfectly afterwards (argmax).
  - The corpus's own advantage `A∞(s,a) = q_after(s,a) − q(s)` is exactly the policy gradient
    (proved). It sums to zero over every hand, like EDGE (the §6.6 trap, re-derived).
  - Within hands, under the shipped rule (EDGE's own), it matches EDGE's order at median ρ 0.87;
    0.80 under the player-neutral rule.
  - Swapping EDGE's argmax continuation for the authored one makes them agree almost exactly:
    median ρ 1.00, same top card in 97.6% of hands.
  - The largest disagreements are mostly **bottom-seat submission attempts**, which EDGE prices far
    lower. Examples: Kneebar from Half Guard, EDGE +19 against the policy gradient's +57; Triangle
    from Spider Guard, −3 against +26. Under the argmax continuation "you would win anyway", so the
    attempt looks ordinary.
  - Which question the card should answer, "if you play perfectly afterwards" or "if you play like
    the corpus", is an owner decision (§10).

## 6. Does the picture respect the meaning? — geometry

### 6.1 The metric of meaning (proved)

Write `E_x` for the exit law of state x: the harmonic measure over the finisher columns and the
draw, `E = (I − Q)⁻¹ [R_fin | R_D]`, whose rows are probability laws. A *question about how the
roll ends* is any function g of the exit column. Its answer at every state is the harmonic
function `h_g = E g`: the committor is one such g, "P(the roll ends in a leg lock)" another.

**Proposition 1** (`scripts/semantics/geometry.py`, proved in the lane record and checked on the
kernel). For any two states x, y:

- over all questions with |g| ≤ 1, the largest possible gap |h_g(x) − h_g(y)| is exactly
  2·TV(E_x, E_y), attained at g* = sign(E_x − E_y);
- over all ending *events* A, the largest possible gap |P_x(A) − P_y(A)| is exactly TV(E_x, E_y).

Below, a *question* about the ending means one with a yes/no answer: an ending event, i.e. g
taking values in [0, 1], whose answers at two places differ by at most TV. Exit-law TV is therefore
the smallest distance in which every such question is 1-Lipschitz. The committor and every
finish-family risk are among those questions. Two positions are close in it exactly when *no*
question about the ending can tell them apart. Hellinger and Jensen–Shannon distances inherit that meaning through proved two-sided
bounds:
- H² ≤ TV ≤ H√(2 − H²);
- J² ≤ TV ≤ √(2 ln 2)·J.

Checked on the kernel: the bound is attained by a direct solve, by an LU-free iteration, and by a
Monte Carlo over the cell table. It is never exceeded in 11.2 M pair × question comparisons.

**Who wins is not the main thing a place means.** For the median pair of reachable states, the gap
in who wins is only 39% of the largest gap on any ending event. A map that
showed only "good for me / bad for me" would miss most of what separates places.

The largest semantic contrast in the whole reachable game (no-gi) is **backside-50-50/bottom vs
body-triangle/top**: a heel-hook entanglement against a back-control choke. At hub level it is
backside-50-50 vs body-triangle, which differ mainly in (top player, blood choke) −0.42,
(top player, leg lock) +0.35 and (bottom player, heel hook) +0.32.

### 6.2 The shipped map, measured

The layout is node2vec + UMAP on an **unweighted, undirected** graph of positions and techniques,
with coordinates preserved across regenerations. It never saw a probability. Measured on the 122
no-gi hubs with Q-process mass, each against 200 coordinate permutations:

| what "close" means | Spearman ρ with shipped distance (null 95%) | 5-NN trustworthiness (null) |
|---|---:|---:|
| **exit-law TV** (how the roll ends) | **0.453** [−0.07, 0.06] | **0.831** [0.48, 0.53] |
| exit TV under a 9–12-ply clock (the corpus's game) | 0.465 | 0.834 |
| unweighted hops (the layout's own input graph) | 0.394 [−0.04, 0.04] | 0.766 |
| diffusion distance t = 4 (how the fight moves) | 0.140 [−0.08, 0.07] | 0.664 |
| commute time | 0.106 | 0.533 |

**The shipped map already puts together places that end the same way.** It carries exit-law TV
better than it carries the very graph it was drawn from. It hardly carries how the fight *moves*.

**The origin filter is why.** With the filter off, the same map carries the diffusion geometry at
ρ 0.396 instead of 0.140. The layout was drawn from the listing graph, and the filter decouples the
dealt dynamics from those listings.

The ending metric is also the stable object. Its rank correlation across modelling choices is:
- 0.99 vs the other initiative rule;
- 0.93–0.96 vs gi;
- 0.91 vs origin=False.

Diffusion falls to 0.55 under origin=False.

**The screen projection** (`_deriveDualPairs`) is proved to distort ground distances by at most a
factor √3. Measured, a hub's 10 nearest neighbours on screen and on the ground have mean Jaccard
similarity 0.75, so about one in seven of them changes.

**Technique placement.** For 65.6% of techniques, the nearest position hub is the canonical origin
(null 0.8%). 23 transitions sit farther from their origin than an average position does. Most
originate at half guard, and one of them is the origin-orphaned Body-Lock Pass.

Recompute everything in this section with `python3 -B scripts/semantics/geometry.py`. That runs
the synthetic gate, then the real run (runtime and memory in §11). Results are stored in
`tests/artifacts/semantics/geometry.json`.

### 6.3 What a meaning-carrying map would cost

The options were measured by `python3 -B scripts/semantics/_geometry_choices.py`, which writes
`tests/artifacts/semantics/geometry_choices.json`.

**Move the map (anchored relayout).** An anchored stress layout minimises

    stress against exit-law TV + λ · ‖X − shipped‖²

The optimiser provably never increases this objective, and each point on the frontier was checked.
Moves below are the median position's move, as a share of the map's diameter:

| candidate | median move | ρ vs exit TV | 5-NN trust | ρ vs hops (own topology) | territory purity |
|---|---:|---:|---:|---:|---:|
| shipped | 0 | 0.453 | 0.831 | 0.394 | 0.902 |
| A: light touch | 2.5% | 0.587 | 0.854 | 0.412 | 0.877 |
| B | 5% | 0.707 | 0.865 | 0.420 | 0.885 |
| **C: the knee** | **9.2%** | **0.860** | **0.888** | 0.416 | 0.934 |
| unanchored | 18% | 0.964 | 0.949 | 0.373 | 0.975 |

- **The layout's own topology never collapses.** ρ against hops is higher than shipped at every
  candidate.
- **Techniques stay attached.** They are translated rigidly with their origin, so their origin
  distance is unchanged, provably.
- **On the wire a relayout is free.** Every candidate's gzip delta is within ±115 B, because
  coordinates are incompressible either way.
- **The real cost is visual and procedural.** Layouts are preserved across regenerations on purpose.
  One position dominates the movement: backside-50-50 moves 16–51% of the map's diameter, because
  the shipped map sets it apart from the rest of the leg territory.

**Colour the map instead (no node moves).**
- A per-position territory id costs +66 B (a leg flag only) up to +210 B (territory id plus
  robustness flag).
- Concave alpha shapes separate the three territories on the shipped points almost cleanly. Convex
  hulls do not: the middle game's hull covers most of the map.
- A single-colour map colours each place by its dominant territory. It paints 9 of 122 positions
  outside their own territory, and five of those (chill-dog, leg-knot, matrix, north-south and
  ushiro-kesa-gatame) are already fragile per-hub claims: each fails at least one of the four
  robustness facts.
- Leg-vs-rest mis-colours only 1: leg knot, which sits among the leg positions but ends like the
  middle game.

**Would using the probabilities in the layout's random walks help?** No: it makes the map mean
*less*, in both forms tried (two seeds each, ordering stable):

| walk weights | exit-TV ρ |
|---|---:|
| unweighted | 0.40–0.41 |
| authored shares | 0.34–0.37 |
| kernel flow | 0.10–0.17 |

The reason is measured, not proved:
- A place's ending is decided by which finishers lie within a few steps. Two-step neighbourhood
  overlap correlates 0.659 with exit-law TV.
- node2vec approximates exactly that multi-step overlap.
- Weights concentrate the walk onto card-to-origin attachment instead.

**The probabilities help through the metric** (the frontier above), **not through the walk.**

## 7. The chains already in the tree

Three pieces of the tree walk the same graph with different rules. Two answer "how often does a
roll pass through X?"; the third answers "can a roll reach X at all?". Nothing compared them. CLAUDE.md §6.5 says that when one question is
answered in two places, one of them is already wrong. Recompute with
`python3 -B scripts/semantics/chains.py`, which writes `tests/artifacts/semantics/chains.json`.

| chain | where | what it is |
|---|---|---|
| **the game** | `solve_edge_values.Model` → EDGE, FLOW, this kernel | two seats; the opponent samples the paired role-node's hand; role and origin filters; chained cells |
| **the score walk** | `regenerate_neural_data.build_technique_weights` → `gameScore` (the belt) and curriculum weights | ONE actor who keeps acting wherever they land; no opponent seat; no origin filter; PageRank damping 0.85 toward uniform; finishes and chained cells restart uniformly |
| **the reachability walk** | `regenerate_neural_data.frame_reachable` → which states the app hides per ruleset | not a chain but a support: a role- and origin-blind search from the two standing seats |

**The belt weights a different game from the one EDGE and FLOW price.** Weights compared against
the game's expected plays per roll, from standing:

| | Spearman | total variation |
|---|---:|---:|
| techniques | 0.53–0.58 | 0.36–0.39 (about 38% of the weight sits on different techniques) |
| position decks | 0.55–0.65 | 0.32–0.37 |

- Started from "anywhere", closer to the walk's uniform damping, technique Spearman is still only
  0.61–0.64.
- The disagreement is structural: no opponent, no origin filter, damping onto states the game
  cannot reach.
- Defensive responses such as escapes from knee on belly are underweighted by the score walk by
  factors of 100–400.

**The reachability walk over-reports in no-gi.** The game reaches 244 role-nodes from standing; the
walk reaches 248. The four extra are Spider Guard and Double Sleeve Guard, both sleeve-grip guards:
- The walk's only way in is Tripod Sweep, listed at open-guard/bottom (and six other guards)
  although its origin is Spider Guard.
- Like 1,196 of the 1,209 listings the filter drops, its miss lands back at its origin. Here that is
  a guard no no-gi edge reaches.
- `optionsFor`'s origin filter never deals it there.

Whether the belt should weight by the game, and whether the walk should respect origin, are owner
decisions (§10).

## 8. gi and no-gi as two chains

The two rulesets are two chains on the same states. The corpus forks them in:
- attempt shares;
- the 62 no-gi `null` cells;
- success rates (133 dealt techniques).

Not one of the 4,110 outcome cells forks. The kernel used here reads the folded no-gi rate in both
frames, so the measured gi chain differs only in attempt shares and nulls. Frame-correct gi rates
move the gi finisher law by a further TV 0.032.

- **They change HOW rolls end far more than WHETHER.**
  - The finisher law moves by TV 0.20 from standing.
  - Under the player-neutral rule, whether cannot move at all from a fair start: it is exactly ½ in
    both frames, by the player-swap symmetry.
  - Under the shipped rule, where nothing pins it, the fair-start P(I finish) moves by +0.003.
- **The largest mover is backside-50-50/bottom**, −0.17 of committor in gi. The exact card
  attribution (Proposition A1, one of two valid attributions) puts it on *Heel Hook from Backside
  50-50*: −0.60, because it is not attempted in gi. Two gi-only cards partly offset it (+0.23).
- **Leg-lock territory shrinks in gi.**
  - The leg-lock baseline from standing halves: 3.5% in gi against 6.6% in no-gi.
  - Against its own gi baseline the territory looks stable (23 positions).
  - Against the fixed no-gi baseline it is 17. Aoki-lock control, grasshopper guard, single-leg X,
    truck and X-guard drop out.
  - The mean leg-lock share falls from 38.0% to 28.0%.
  - The lost share moves to chokes and shoulder locks. At backside-50-50 the leg-lock share falls
    by 37 points and the choke share rises by 18.5.
- **The gi-only lapel and sleeve guards do not form a named region.** In the corpus's game in gi, no
  class's share of the rolls that end from any of the 11 gi-only guards exceeds 1.34× its share from
  standing. The largest is Russian Leg Lasso, shoulder locks 36.7% against 27.3%.
- **The shipped EDGE table exists in no-gi only.** The consequences:
  - In gi the app prints the no-gi EDGE line re-evaluated at the gi rate.
  - **70 dealt gi cards get no EDGE at all.**
  - The top card differs from a gi-correct solve in 22 of 261 hands.
  - Until v1.209.0 the browser's FLOW for a gi player *was* the no-gi FLOW, so 74 gi-only decks
    (gi's 1,520 against the unmasked no-gi 1,464) could never be recommended. v1.209.0 ships the gi
    hands and ranks each player in their own ruleset (§10 item 7).
- **The kernel and EDGE/FLOW read the folded no-gi success rate even in gi.** A gi-correct solve
  moves 485 of 1,259 gi EDGE integers. Most of that (253) is baseline shift: repricing a card's
  neighbours moves a relative score.
- Shipping a gi table would cost +12,727 B gzip, over the per-change cap. Gi hands alone would cost
  +2,924 B (§9).

Recompute: `python3 -B scripts/semantics/scalars.py --json` and `--consequences`, and
`python3 -B scripts/semantics/naming.py --territories`.

## 9. What the app could show, and what it costs

Nothing here is proposed as a change; each is a candidate with its measured price. Rules for any
candidate:
- Every sentence must say **which game** it is about (§1.3); the app's own game is much harder for
  the player than the corpus's.
- It must say **whether the clock is on** (§10.2).
- The copy must follow §12.1, which `lint_copy` in `naming.py` checks mechanically for 20 of 23
  rules.

**How bytes are priced.** The eager gate gzips each eager file separately at level 9 and caps any
one change at +5,000 B. `graph-data.json` is eager: 107,447 B gzip as emitted in this worktree.
Every byte figure below is that one file's gzip delta; the "measured in" column names the artifact
that holds it. Candidates are priced alone, not added. Lazy (on-demand) chunks are outside the eager
gate but still ratcheted by `validate:payload`; none was measured.

**The zero-byte route (no-gi only).** The browser already rebuilds the game from the shipped wire
(`cal.ev` + `cal.outcomes`) for FLOW. That this reproduces the kernel was proved on the real wire
through the app's own `ingest`:
- the hands are identical;
- the only difference is attempt shares rounded to whole percents;
- the committor comes out within 0.004 of the authored value under the player-neutral rule, or
  0.007 under the shipped rule, in 116–137 Gauss–Seidel sweeps. That took about 0.3 s in Node after a
  0.45 s ingest; phones are unmeasured.

Permille shares (+835 B) would cut the gap to 0.0005. `cal.ev` holds no-gi hands only, so gi has no
zero-byte route.

| candidate | what the player would read (corpus's game) | route | price | measured in |
|---|---|---|---:|---|
| **territory tint, no node moved** | positions tinted by how rolls end (gs-3's three territories) | per-position territory id (+ robustness flag) | +66 to +210 B | `geometry_choices.json` → `overlay.wire_encodings` |
| **territory names on the map** | the pooled regions labelled with their number: leg-lock 21, twister 3, hip/groin 2, arm-lock 1 | per-position label + names table | +146 B | `payload.json` row 3 |
| seat-aware names ("choke for the top player") | the 19 seat-aware names of §4.4 | — | **unpriced**; only 2 of 19 survive the four robustness facts | — |
| **name card on a position** | the §4.5 sentence | on-demand dossier chunk | 0 eager B; lazy bytes unmeasured | — |
| **"whose position is this"** | "from Honey Hole on top you finish 69% of the rolls that end" | in-browser (no-gi) / precomputed both frames | 0 B / +1,318 B (measured for the my-turn committor; the turn-neutral value has the same shape) | `payload.json` row 1 |
| **"what ends rolls here"** | "61% of rolls from Honey Hole (top, your turn) end in your leg lock" | one injective char per submission, then in-browser | +356 B | `payload.json` row 2; `scalars_consequences.json` → `part3_payload` |
| **"how fast this ends"** | "about 5 plies" (a rank, never a promise: the SD is as large as the mean) | in-browser / precomputed | 0 B / +415 B | `scalars_consequences.json` → `part3_payload` |
| **"won rolls go through here"** | "side control on top: in 60% of the rolls you win, 29% of those you lose" | in-browser (no-gi; compute estimated, not run) / precomputed | 0 B / the seat pair is **unmeasured** (≈ 2 × +601 B; the +601 B hub pair loses the seat) | `flux.json` → `payload_costs` |
| **"the widest route from here"** | "Standing → Side Control (top) → finish carries 15% of the winning current" (give the share; never "most" or "you will") | in-browser | 0 B | `flux.json` → `configs.headline.flux.W.routes` |
| **the clock's effect** | "a roll that went on past the clock would be a coin toss" (player-neutral) / "~70% the side with initiative" (shipped) | two constants | +14 B | `scalars_consequences.json` |
| choke-move badge on a card | "Rear Naked Choke from Back Control: landed in 9.3% of the rolls you win" | in-browser (no-gi) / top-30 / all 1,146 | 0 B / +284 B / +7,036 B (over cap) | `flux.json` → `payload_costs` |
| drill leverage, standing start | FLOW from standing: still clocked and λ-weighted (ρ 0.95–0.96 to the infinite-horizon gradient) | change FLOW's start (a behaviour change) | 0 B | `flux.json` |
| drill leverage, infinite horizon (committor gradient) | the success-rate gradient of §5.3 | in-browser (committor + one adjoint solve, no-gi) / ship the vector | 0 B / +7,364 B (over cap) | `flux.json` → `payload_costs` |
| the corpus's advantage A∞ beside EDGE | "if you play like the corpus afterwards" vs EDGE's "if you play perfectly" | in-browser from the committor | 0 B | — |
| **relayout toward meaning** (§6.3) | places that end alike drawn closer (Spearman 0.45 → 0.71 at a 5% median move, 0.86 at 9%) | rewrite hub ground points (a deliberate one-off; layouts are preserved) | ≈ 0 B (±115 B) | `geometry_choices.json` → `candidates.*.wire_price_*` |
| any of the above **in gi** | — | gi hands on the wire / a gi EDGE table | +2,924 B / +12,727 B (over cap) | `scalars_consequences.json` → `part3_payload` |
| full precomputed exit profile | — | precomputed | +5,180 B (over cap) | `payload.json` row 4 |

**Candidate seams.** These follow the seam index in CLAUDE.md §5. Placement was not checked
against the app's code.
- The territory tint belongs to the canvas draw path, as a ground-plane layer beneath the pair orbs.
  It must respect `_deriveDualPairs`: only hub ground points are used, and nothing is added to the
  pair.
- The name card and the per-position scalars belong in the pane's Explore dossier for that position.
- The route and the "won rolls go through here" figures belong on the landing card.
- The A∞ and choke-move badges belong on the dealt cards, beside EDGE.

Each is an owner decision (§10); none was built. A private explainer page of the territories, name
cards and relayout options was built from the artifacts for the owner. It is not part of the repo.

## 10. Decisions for the owner

Each decision is listed with its options and the measured consequence. The maths does not pick; it
prices.

1. **Which game should numbers shown in the app describe?**
   - Options: the corpus's game (what the map *means*), the app's own game (what the player
     *faces*), or both, labelled.
   - Consequence, from standing, no-gi, under the app's own shipped initiative rule:

     | | corpus's game | app's game | gap |
     |---|---:|---:|---:|
     | H = ∞ | 0.72 | 0.35 | 37 points |
     | under the app's own move clock (9–12 moves, its `moveCount` rules) | 0.47 | 0.26 | 22 points |

     Unlabelled corpus numbers would overstate the player's chances by 22–37 points (§1.3).
2. **Which horizon?** Should shown numbers use no clock (what the map means) or the app's 9–12-move
   clock (what a roll can reach)?
   - The clock takes finishes, never gives them. From standing, under the player-neutral rule and a
     9–12-ply clock on the corpus's game, P(I finish) goes 0.553 → 0.396, with 31% of rolls timing
     out. The app's own move clock leaves 35% undecided under the shipped rule (§1.3).
   - It concentrates fast endings: the leg-lock territory's share goes 38.0% → 48.4%.
   - It sharpens verdicts without reordering them (§3.2).
3. **Which region should the map draw?** The lanes derived five leg sets, of 9, 14, 16, 17 and 22
   positions, in an exact algebra (§4.3), and two families of territory:
   - how rolls end (gs-3's three territories, k = 3);
   - over-represented endings (R_C at θ = 2 or 3, pooled or seat-aware).

   §9 prices the tint (+66 to +210 B) and the pooled names (+146 B). Seat-aware names are unpriced,
   and only 2 of 19 are robust.
4. **The origin filter and the generic-move schema** (§1.4, `flux.py --origin`).
   - Options:
     - keep the filter as is;
     - restore the 13 coherent listings;
     - add the missing listing (an attempt share) at the canonical origin for the 41 orphans, which
       the app already deals there;
     - author per-listing outcome tables for generic moves (the coherent fix).
   - Consequence: flipping the filter outright imports teleports in 98.9% of listings, so it is not
     a fix. The whole filter:
     - moves how rolls end by TV 0.106 (player-neutral rule), but only by 0.022 if asked only
       which kind of finish (performer × type) ends the roll;
     - moves who wins by at most 0.005 from standing, and by exactly 0 from a fair start under the
       player-neutral rule (a theorem);
     - re-draws the map's structure. The balanced slow split becomes back/turtle vs rest, flow
       compression finds 20 modules instead of 40, and the shipped layout would carry the dynamics
       at ρ 0.40 instead of 0.14.
5. **The belt's weights** (§7). `gameScore` weights a one-player damped walk that ranks techniques
   at Spearman 0.53–0.58 against the game EDGE and FLOW price. Re-weighting by the game's occupancy
   would change every player's belt, by an amount not measured here.
6. **The reachability walk** (§7). Respecting origin would hide Spider Guard and Double Sleeve Guard
   in no-gi, matching what the game can reach. Today the walk admits them through a teleporting
   Tripod Sweep listing.
7. **gi pricing** (§8).
   - Today gi players see the no-gi EDGE line re-evaluated at gi rates: 70 gi cards have no EDGE,
     and 22 of 261 hands show a different top card from a gi-correct solve. FLOW shows gi players
     the no-gi ranking.
   - Options:
     - read the frame rate in `tech_rate`. That moves 485 gi solver integers and 0 in no-gi, but the
       app's gi EDGE is unchanged unless a gi table also ships;
     - ship gi hands (+2,924 B, enabling the in-browser gi committor and gi FLOW);
     - ship a gi EDGE table (+12,727 B, over the cap).
   - **Taken in v1.209.0 (owner, 2026-09-30): ship gi hands.** `cal.evGi`, +2,598 B gzip on
     `graph-data.json` (the eager gate's gzip on v1.208's one-EDGE-block wire; +2,924 on the wire
     priced above). A gi player's FLOW reads the gi hands at the gi rate (`calSuccess`); the
     browser matches `solve_flow.py --reference`'s gi row (top-10 order exact, V0 within 0.7%).
     119 decks the no-gi game cannot deal now score in gi, two inside the top 40 (Cross Collar
     Choke from Mount, Bow and Arrow Choke from Back Control). Cards still print the no-gi EDGE.
8. **FLOW's start distribution** (§5.4). FLOW integrates over a uniform start, which approximates
   the app's default "Anywhere" roll (`startFrom()` → "random"). A roll from standing (a match start,
   and the start every "vs standing" figure here uses) ranks drills differently (ρ 0.69). Which start
   FLOW should assume is a one-line behaviour change.
   - **Taken in v1.209.0 (owner, 2026-09-30): the player's own start setting.** Anywhere is the
     uniform start; Standing is half on each seat of standing-position (ρ 0.68 no-gi, 0.67 gi
     against uniform, measured on the browser kernel). My weak spots stays uniform, because it opens
     on the spots this ranking names. From standing in no-gi, Spider Guard and Double Sleeve Guard
     decks score exactly 0: no roll that opens standing reaches them (item 6).
9. **What EDGE should price** (§5.4). EDGE assumes you play perfectly afterwards; A∞ assumes you
   play like the corpus.
   - They agree within hands at median ρ 0.87 (shipped rule).
   - EDGE prices bottom-seat submission attempts far lower. Kneebar from Half Guard scores +19
     against +57. Triangle from Spider Guard scores −3 against +26 (that one is gi; Spider Guard is
     unreachable in no-gi).
10. **The map** (§6).
    - Keep the layout, which already carries meaning at ρ 0.45 with nearest-neighbour territory
      purity 0.90, and tint territories on it (+66 B for a leg flag, +210 B for a territory id with
      its robustness flag).
    - Or re-shape it along the anchored frontier. A 2.5% median move gives ρ 0.59, a 5% move 0.71,
      the knee at 9.2% 0.86 (purity 0.93), and 15–18% gives 0.95–0.96.
    - Wire cost is within ±115 B in every case; the cost is what a returning player sees move. Layouts are
      preserved across regenerations on purpose, so any re-shape is a deliberate one-off.
11. **Content review** (not code).
    - **positionType disagreements** (§3.3). 46 role-nodes disagree with the committor, 22 of them
      robustly, mostly guard-bottom seats labelled Offensive. 13 positions carry the same label
      direction on both seats, which the player-neutral committor cannot satisfy.
    - **aoki-lock-control/top** deals Aoki Lock twice.
    - **3 of the 21 chained cells** seat the finisher against the chained submission's `fromRole`.
    - **The `counter` result label** has no dynamic meaning outside chains. Relabelling all 1,334
      non-chained counter cells as failures changes the chain by exactly 0.
    - **60 no-gi techniques** are dealt only at states unreachable from standing.
    - **gi territory sizes depend on the baseline.** Against its own gi baseline leg-lock territory
      has 23 positions; against the fixed no-gi baseline, 17.
12. **Naming thresholds** (§4). θ = 2× and a 5-point materiality gate give 21 leg-lock positions and
    95 unnamed (76 with seats). Nine measured rule variants agree with it on 108–122 of 122 positions
    (`naming.json` → `names.variants`). Seat
    qualifiers should be shown only where they survive the four robustness facts.
13. **Two stale statements in the tree.**
    - CLAUDE.md §5's "the shipped `opponentDefend` picks from hub adjacency with no role or origin
      filter, so only ~12% …" has been stale since v1.176.0. The opponent now draws from role- and
      origin-filtered candidates (including the 41 orphans at their origins) and differs by its
      choice *policy* (TV 0.57, weighted by where it plays).
      The same stale claim is in `docs/Neural.md` §4 and in `tests/artifacts/_opponent_gap_measure.py`.
    - `tests/flow.test.mjs` attributes its 2.4% V0 tolerance to a Kimura Trap move-set difference.
      The measured cause is attempt-share rounding (and permille shares, +835 B, would cut it to
      0.14%).

    CLAUDE.md §5, `docs/Neural.md` §4 and the test's comment were corrected in v1.206.1.
    `_opponent_gap_measure.py` was left as it is; it no longer runs on this graph (a null attempt
    cell). CLAUDE.md §6.6 still says `opponentDefend` walks `adj` with no role filter, which is
    stale by the same evidence and is not yet corrected.
14. **The initiative rule** (§1.3, §3.2). The shipped asymmetric initiative is worth about 17 points
    of P(I finish) to the player from standing (0.72 against 0.55). Under it, a roll that outlasts
    the clock would have gone ~70% to the side with initiative.

## 11. Reproduce

Everything below runs from the repo on `graph.json`. Paths to artifacts are under
`tests/artifacts/semantics/`, each under 1 MB. Run the scripts in this order; each depends on the
rows above it.

| # | what | command | writes | cost |
|---|---|---|---|---|
| 1 | the kernel gate (59 checks) | `python3 -B scripts/semantics/_kernel.py --selfcheck` | — | seconds |
| 2 | structural numbers (§1–2) | `python3 -B scripts/semantics/_kernel.py --structure` | — (prints) | seconds |
| 2a | independent verification (§1.2) | `python3 -B scripts/semantics/independent_sim.py` | `independent_sim.json` | 259–358 s, peak 219 MiB |
| 3 | the emitted wire (gitignored), needed by rows 5, 6, 8 and 12 | `python3 scripts/regenerate_neural_data.py` | `source/quartz/static/neural/` | not timed here |
| 4 | the three chains (§7) | `python3 -B scripts/semantics/chains.py --json tests/artifacts/semantics/chains.json` | `chains.json` | seconds |
| 5 | payload prices (§9) | `python3 -B scripts/semantics/payload_probe.py --json tests/artifacts/semantics/payload.json` | `payload.json` | seconds |
| 6 | the app's game (§1.3) | `python3 -B scripts/semantics/app_game.py [--selfcheck]` | — (prints) | not timed here |
| 7 | state scalars (§3) | `python3 -B scripts/semantics/scalars.py --json` | `scalars.json` | not timed here |
| 8 | consequences (§8, §9); needs `node`, rows 3 and 14 (it hashes `vocabulary.json`) | `python3 -B scripts/semantics/scalars.py --consequences` | `scalars_consequences.json` | not timed here |
| 9 | territories, dynamics (§2.2, §4.3) | `python3 -B scripts/semantics/territories.py` | `territories.json` | 342 s, peak 302 MiB |
| 10 | geometry (§6.1–6.2) | `python3 -B scripts/semantics/geometry.py` | `geometry.json` | 212–244 s, peak 423 MiB |
| 11 | relayout embeds for §6.3 (optional) | `python3 -B scripts/semantics/_geometry_relayout.py --out <dir>/relayout --variant <v> --seed <s>` × 6 | `<dir>` | ~10 min and 695 MiB each |
| 12 | layout choices (§6.3, §9, §10.10) | `python3 -B scripts/semantics/_geometry_choices.py --scratch <dir>` | `geometry_choices.json` | 22.5 s, peak 389 MiB |
| 13 | flux, choke points, sensitivity (§5) | `python3 -B scripts/semantics/flux.py` and `--origin` | `flux.json`, `flux_origin.json` | 4–6 min and peak 320 MiB (100 robustness seeds); `--origin` 11–18 s, peak 490 MiB |
| 14 | vocabulary and lexicon | `python3 -B scripts/semantics/vocabulary.py --selfcheck` | `vocabulary.json` | seconds |
| 15 | names, territories by ending (§4); after row 14 | `python3 -B scripts/semantics/naming.py --territories` | `naming.json`, `naming_cards.json` | ~5 min, peak 310 MiB |
| 16 | the flow lens named (§4.3); after rows 9 and 15 | `python3 -B scripts/semantics/naming.py --gs1` | `naming_gs1.json` | not timed here |
| 17 | glossary and copy rules (§12) | `python3 -B scripts/semantics/naming.py --glossary` | `naming_glossary.json` | seconds |
| 18 | **the atlas: LAST**, it reads every artifact above | `python3 -B scripts/semantics/atlas.py` | `atlas.json` | 7 s; 40 s and peak 437 MiB with `--selfcheck` |

Every method module also carries its own synthetic `--selfcheck`: `_absorbing.py`,
`_territory_methods.py` (writes `territories-t1.json` with `--output`), `_territory_audit.py`,
`_geometry_methods.py`, `_geometry_analysis.py`, `_tpt.py` (writes `flux-selfcheck.json` with
`--json`) and `naming.py` (toy input `naming_toy_input.json` → `naming_selfcheck.json`).

**Staleness.** Every artifact computed on `graph.json` records the sha256 of the copy it was computed
on, so any content change marks it stale. The synthetic receipts (`territories-t1.json`,
`flux-selfcheck.json`, `naming_selfcheck.json` and its toy input) read no graph and say so. The naming
writers also refuse an input artifact whose recorded graph hash differs from the current one, so a
derived artifact cannot mix two graphs.
For the rest, compare the artifact's date with graph.json's. The selfcheck receipts and the toy input
are synthetic and depend on no graph.

**Paths.** Every command runs from a clean clone. Scratch directories (`<dir>`, `--full-out`) are the
caller's choice, never inside `tests/artifacts/`. Any default that points at a local orchestration
directory is overridable and is not needed by a row above.

**The atlas** (row 18) joins every position's and role-node's facts across all lanes by id, with set
equality asserted. It runs **43 cross-lane differentials, 22,502 comparisons, 0 failures**. Every
place two lanes computed the same quantity by different code agrees to the lanes' own rounding: the
committor by two routes, exit-class shares by three, passage by two independent solvers, and the
standing roll by five sources. It refuses to write on any disagreement.

<!-- verify_all.py (gs-2 S4) row -->

## 12. Glossary for grapplers

The glossary and the copy rules below are rendered from data in `scripts/semantics/naming.py`
(`GLOSSARY`, `COPY_RULES`), not typed. Recompute with
`python3 -B scripts/semantics/naming.py --glossary --render-out <file>`, which writes
`tests/artifacts/semantics/naming_glossary.json`.
- **The glossary is checked mechanically.** The build refuses a definition that uses a term defined
  later. It also checks that every cited script, symbol and artifact key exists.
- **The copy rules lint every card sentence.** 20 of the 23 rules are machine-checkable
  (`lint_copy`), and every card sentence passes them.

Terms are in dependency order. Each gives one sentence for a black belt, the precise definition
with its set, and where it is computed. All numbers are in the corpus's game, no-gi, player-neutral
rule, with no clock, unless the entry says otherwise.

1. **position and seat**
   - *For a grappler:* A position is a place like mount; it has two seats, top and bottom, and the maths always tracks which seat you are in.
   - *Precisely:* A position is a hub h (133 authored); a seat is one of its two role-nodes h/top, h/bottom (266). Only role-nodes carry techniques; hubs aggregate them.
   - *Computed:* `scripts/semantics/_kernel.py`; `vocabulary.json` -> ["position_hubs"]["back-control"]; `vocabulary.json` -> ["position_role_nodes"]["back-control/top"]

2. **state (whose move it is)**
   - *For a grappler:* Mount-your-move and mount-their-move are different situations, so each is its own state.
   - *Precisely:* A transient state is (my seat, my move | their move), always written from MY side: 532 states (266 seats x 2).
   - *Computed:* `scripts/semantics/_kernel.py`; `scalars.json` -> ["states"]["nogi/symmetric/shipped/origin=on"]["set_definition"]

3. **step**
   - *For a grappler:* One step is one technique attempt by whoever's move it is.
   - *Precisely:* One card: the mover draws a technique by its authored attempt share, it succeeds with its success rate, and one authored outcome cell of that branch decides where the pair lands (the kernel's cell table).
   - *Computed:* `scripts/semantics/_kernel.py`; `territories.json` -> ["meta"]["units"]["step"]

4. **initiative rule (shipped vs player-neutral)**
   - *For a grappler:* After a technique works, who moves next? In the app's version the player keeps the move after a success and the opponent never does; the player-neutral version lets whoever succeeded keep it.
   - *Precisely:* shipped: my success keeps my move, their card always hands the move back; symmetric (player-neutral, the headline): whoever's card succeeds keeps the move, which makes the game exactly symmetric under swapping the players.
   - *Computed:* `scripts/semantics/_kernel.py`; `naming.json` -> ["configurations"]["primary"]["initiative"]

5. **ply**
   - *For a grappler:* A ply is one technique attempt as the kernel counts time, except that a missed attempt which leaves you exactly where you were costs nothing. The app's own move counter counts differently, so a ply is not one of its moves.
   - *Precisely:* A step that costs 1 on the kernel's horizon (K.Q1); the kernel's stay-put miss cells (K.Q0) cost 0 plies, so steps >= plies, with equality under the player-neutral initiative rule, which has no stay-put cells. The app's move count (moveCount) is a different count: it charges 2 for my missed submission and 0 for their finish attempt, for example (app_game.py).
   - *Computed:* `scripts/semantics/_kernel.py`, `scripts/semantics/app_game.py`; `territories.json` -> ["meta"]["units"]["ply"]

6. **roll, decided roll, draw**
   - *For a grappler:* A roll is one round from the start until somebody taps; 'rolls that end' means rolls that end in a submission.
   - *Precisely:* A run of the absorbing chain until W (I finish them), L (they finish me) or D (a draw: an optionless hand, which no roll started on the feet ever meets when rolls are left to run); a decided roll ends in W or L.
   - *Computed:* `scripts/semantics/_kernel.py`, `scripts/semantics/scalars.py`; `scalars.json` -> ["states"]["nogi/symmetric/shipped/origin=on"]["columns"]

7. **frame (gi / no-gi)**
   - *For a grappler:* Gi and no-gi are two different games on the same positions, each with its own attempt shares and success rates.
   - *Precisely:* Two chains on the same 532 states that differ only in attempt shares, success rates (133 dealt techniques fork) and the 62 no-gi null cells; the headline is no-gi. rates='shipped' prices both at the folded no-gi rate, rates='frame' uses the gi rate in gi.
   - *Computed:* `scripts/semantics/_kernel.py`; `naming.json` -> ["gi_vs_nogi"]["baselines"]

8. **origin filter**
   - *For a grappler:* A technique is dealt only from the position it is written for, even where other positions also list it; that throws away about half of the listed attempt entries.
   - *Precisely:* build_hand / optionsFor deal a listed card only at its canonical origin (fromPositionId): 48.4% of authored role-matching attempt points dropped and 41 techniques orphaned in no-gi; origin=False deals every listing (the comparison run).
   - *Computed:* `scripts/semantics/_kernel.py`, `scripts/semantics/flux.py`; `flux_origin.json` -> ["restore"]

9. **the corpus's game vs the app's game**
   - *For a grappler:* The corpus's game is the sport as the written content describes it, both players choosing the way the curriculum says; the app's game is the harder product version the player actually faces.
   - *Precisely:* corpus's game = the kernel: both seats sample the authored attempt shares with the origin filter on, no resistance, no horizon unless stated; app's game = the app's opponent rule, escape resolution, aiMod resistance and move limit on top (P(I finish) for a roll started on the feet 0.7225 -> 0.3489, no-gi, shipped initiative).
   - *Computed:* `scripts/semantics/_kernel.py`, `scripts/semantics/app_game.py`; `naming.json` -> ["which_game"]. app_game.py prints its layer table (optional --json <path>); it writes no committed artifact. Doc section 1.3.

10. **the clock (H = inf vs clocked)**
   - *For a grappler:* Most numbers let a roll run until someone taps; clocked numbers stop it after 9 to 12 plies, the app's clock length. The app's own move clock is a different count.
   - *Precisely:* H = inf is absorption with no horizon; 'clocked' is the uniform mixture over H in {9, 10, 11, 12} plies (the app's clock length, maxMoves) of P(ends within H plies), computed by the kernel's finite-horizon recursion (gated against the repo's existing value solver). It is not the app's own move clock, which counts the app's move count (moveCount) and ends a roll only on some moves (app_game.py).
   - *Computed:* `scripts/semantics/_kernel.py`, `scripts/semantics/scalars.py`, `scripts/semantics/app_game.py`; `naming.json` -> ["territories"]["LEG"]["standing_me|ratio|2.0"]["headline"]["x_clocked"]

11. **finish class (body region)**
   - *For a grappler:* Every submission is sorted by what it attacks: leg, arm, shoulder, neck (choke), spine, hip/groin.
   - *Precisely:* The lexicon maps each of the 290 submission attackers to exactly one class by its structured type + targetArea, never its name: LEG 74, ARM 36, SHOULDER 63, CHOKE 105, SPINE/COMPRESSION 9, HIP/GROIN 3.
   - *Computed:* `scripts/semantics/vocabulary.py`; `vocabulary.json` -> ["techniques"]["armbar-from-mount/attacker"]["body_region"]["class"]; `vocabulary.json` -> ["class_counts"]

12. **start law and the standing baseline**
   - *For a grappler:* Every number starts somewhere; 'from standing' means on the feet with me to move, and that is the average every place is compared with.
   - *Precisely:* A distribution over states where rolls begin: standing = K.start('standing', 'me'); a position's own start is uniform over its 4 states (2 seats x 2 moves); the baseline b_C is the class-C share of decided rolls from standing.
   - *Computed:* `scripts/semantics/_kernel.py`, `scripts/semantics/naming.py`; `naming.json` -> ["baselines"]["primary"]["standing_me"]

13. **reachable universe**
   - *For a grappler:* Positions a roll that starts on the feet can never get to are left out and said to be unreachable, never scored as zero.
   - *Precisely:* Seats reachable from the standing seeds in the configuration's kernel (244 no-gi, 266 gi); naming's universe is the 122 no-gi positions with both seats reachable, and the other 11 are 'not reachable from standing'.
   - *Computed:* `scripts/semantics/_kernel.py`, `scripts/semantics/naming.py`; `naming.json` -> ["not_evaluable"]["lapel-guard"]

14. **perturbation robustness and the four facts**
   - *For a grappler:* The authored numbers are estimates, so every claim about one place is re-tested on 200 slightly different versions of them and under three alternative model choices.
   - *Precisely:* A claim's robustness is the fraction of K.perturbed(0.2, 0.2, seed), seeds 0..199 (log attempt shares and logit success rates jittered, landing cells fixed) in which it still holds, plus whether it holds with origin=False, under the other initiative rule and in the other frame: four facts, never a probability of being right.
   - *Computed:* `scripts/semantics/_kernel.py`, `scripts/semantics/naming.py`; `naming.json` -> ["hubs"]["back-control"]["robustness_n3"]; `scalars.json` -> ["definitions"]["robustness"]

15. **committor**
   - *For a grappler:* From here, what are the chances that I am the one who finishes?
   - *Precisely:* q(s) = P(I finish them before they finish me | the roll starts at state s), no horizon; q-bar is the average of a seat's two states (my move, their move).
   - *Computed:* `scripts/semantics/scalars.py`; `scalars.json` -> ["definitions"]["q_W"]; `scalars.json` -> ["definitions"]["q_bar"]

16. **tempo**
   - *For a grappler:* How fast rolls from here end.
   - *Precisely:* Expected plies (and steps) to the end of the roll from a state.
   - *Computed:* `scripts/semantics/scalars.py`; `scalars.json` -> ["tempo"]["nogi/symmetric/shipped/origin=on"]; `scalars.json` -> ["definitions"]["E_plies"]

17. **exit law (harmonic measure) and class share**
   - *For a grappler:* The full list of ways rolls from here end (which submission, by which player, how often); 'of the rolls that end, 38% end in a leg lock' is one line of it.
   - *Precisely:* E_s(c) = P(the roll from state s ends by finisher column c = (finishing technique, who)), the rows of (I - Q)^-1 R_fin; the class share s_C(nu) = nu.h_C / nu.d is the class-C share of decided rolls from start law nu.
   - *Computed:* `scripts/semantics/_kernel.py`, `scripts/semantics/naming.py`; `naming.json` -> ["hubs"]["back-control"]["share"]; `geometry.json` -> ["definitions"]["exit_law"]

18. **exit-law TV**
   - *For a grappler:* How differently two places end: 0 means no question about the ending can tell them apart, 1 means they never end the same way.
   - *Precisely:* TV(E_x, E_y) = half the sum of |E_x - E_y| over (seat x raw submission type) plus draw; it is exactly the largest difference the two places give to any event about the ending (gs-3 Proposition 1).
   - *Computed:* `scripts/semantics/geometry.py`; `geometry.json` -> ["definitions"]["exit_tv"]; `geometry.json` -> ["cases"]["nogi/symmetric/shipped"]["clusterings"]["exit_tv"]

19. **enrichment**
   - *For a grappler:* How many times more likely this ending is here than from standing.
   - *Precisely:* E_C(h) = s_C(h) / b_C; it can never exceed 1/b_C, so chokes (b = 46.4% in no-gi) cannot pass 2.15x; the odds ratio is reported as an alternative.
   - *Computed:* `scripts/semantics/naming.py`; `naming.json` -> ["hubs"]["back-control"]["enrichment"]

20. **territory R_C(theta)**
   - *For a grappler:* Leg-lock territory is the set of places from which leg locks end rolls at least twice as often as from standing.
   - *Precisely:* R_C(theta) = the reachable positions with E_C >= theta, theta in {1.5, 2, 3}; IMPOSSIBLE when theta.b_C > 1, EMPTY when attainable but not attained.
   - *Computed:* `scripts/semantics/naming.py`; `naming.json` -> ["territories"]["LEG"]["standing_me|ratio|2.0"]["members"]; `naming.json` -> ["territories"]["CHOKE"]["standing_me|ratio|3.0"]["status"]

21. **core and halo**
   - *For a grappler:* The core of leg-lock territory is where a leg lock is actually on the menu; the halo is nearby places that only inherit a leg-lock share by leading into the core.
   - *Precisely:* core_C = the states whose own hand finishes in class C within one card (directly or via a chained submission); by the maximum principle (gs-5 N2R Propositions 1-3, gs-2 Proposition C) a class share peaks on the core and a halo state gets at most P(reach core) x the best core value.
   - *Computed:* `scripts/semantics/naming.py`, `scripts/semantics/scalars.py`; `naming.json` -> ["max_principle"]["primary"]["LEG"]; `naming.json` -> ["territories"]["LEG"]["standing_me|ratio|2.0"]["halo"]

22. **seat share vs pooled share**
   - *For a grappler:* 'Pooled' counts a finish whoever does it; the seat share asks whether it was the player who started on top or the one who started underneath.
   - *Precisely:* S^sigma_C = P(class-C finish by the player who STARTED on seat sigma at this position | decided); S^TOP + S^BOTTOM = the pooled share; the per-player baseline is b_C / 2.
   - *Computed:* `scripts/semantics/naming.py`; `naming.json` -> ["hubs"]["back-control"]["seat_share"]; `naming.json` -> ["seat_names"]["baseline_per_player"]

23. **name and middle game**
   - *For a grappler:* A place gets a name only when one ending is both twice as common as from standing and at least five points more common; everywhere else is middle game, where rolls end the way they end everywhere.
   - *Precisely:* Pooled name = the class with the largest enrichment among those with E_C >= 2 and s_C - b_C >= 0.05; the seat rule refines it (BOTH / TOP / BOTTOM / SHARED) or gives an unnamed position 'C for the sigma player' when one seat passes the same gates against b_C / 2; no passing class = middle game (76 of the 122 reachable positions).
   - *Computed:* `scripts/semantics/naming.py`; `naming.json` -> ["hubs"]["back-control"]["name_n3"]; `naming_cards.json` -> ["hubs"]["half-guard"]["sentence"]

24. **set fit (precision, recall, F1, q)**
   - *For a grappler:* How well a derived region matches a set the corpus already names, such as the positions that list a leg lock.
   - *Precisely:* For region R and label set S inside the universe: precision |R and S|/|R|, recall |R and S|/|S|, F1, lift, and a hypergeometric upper-tail p with Benjamini-Hochberg q over the whole family: exploratory, because graph-derived sets are dependent.
   - *Computed:* `scripts/semantics/naming.py`; `naming.json` -> ["fit"]["primary"]["summary"]["R:LEG:2.0"]

25. **the Yaglom limit**
   - *For a grappler:* The clock only ever takes finishes away, and a roll that outlasts it is a coin toss.
   - *Precisely:* 0 <= q(s) - V_H(s) <= P_s(roll longer than H) (gs-2 Proposition B); under the player-neutral rule P(I finish | the roll outlasts H) -> exactly 1/2 at every state as H grows (Proposition F; 0.697 under the shipped rule).
   - *Computed:* `scripts/semantics/scalars.py`; `scalars.json` -> ["clock"]["nogi/symmetric/shipped/origin=on"]["yaglom_prop_F"]

26. **Q-process and a long fight's time**
   - *For a grappler:* Imagine a fight that never ends: the Q-process is where such a fight spends its time.
   - *Precisely:* The chain conditioned never to finish, on the states reachable from standing (Perron vectors of Q); mu = its stationary law, and 'a long fight's time' in a set = its mu mass.
   - *Computed:* `scripts/semantics/_kernel.py`; `naming.json` -> ["hubs"]["half-guard"]["mu_time"]; `territories.json` -> ["configs"]["nogi/symmetric/origin-on"]["spectrum"]["hub"]["lambda2_R"]

27. **residence**
   - *For a grappler:* Once the fight is in a region, how many steps it stays before leaving.
   - *Precisely:* For a set S of the Q-process: holding h(S) = P(still in S next step | in S), exit rate e(S) = 1 - h(S), residence r(S) = 1/e(S) steps; the real-roll sojourn is measured on the actual (killable) roll from standing.
   - *Computed:* `scripts/semantics/territories.py`; `territories.json` -> ["configs"]["nogi/symmetric/origin-on"]["splits"]["phase"]["levels"]["hub"]["residence_steps"]; `territories.json` -> ["configs"]["nogi/symmetric/origin-on"]["real_roll_sojourn"]["localized"]

28. **relaxation time and lambda***
   - *For a grappler:* How quickly the fight forgets which side of a divide it started on.
   - *Precisely:* For a split S | S-complement of the Q-process, lambda*(S) = h(S) + h(S-complement) - 1 is the two-block chain's non-unit eigenvalue; tau_lin = 1/(1 - lambda*) is exactly half the harmonic mean of the two residences (gs-1 P2').
   - *Computed:* `scripts/semantics/territories.py`; `territories.json` -> ["configs"]["nogi/symmetric/origin-on"]["splits"]["phase"]["levels"]["hub"]["two_block_eigenvalue"]; `territories.json` -> ["configs"]["nogi/symmetric/origin-on"]["splits"]["phase"]["levels"]["hub"]["tau_lin_steps"]

29. **no trap (the certificate)**
   - *For a grappler:* No part of the map gets a roll stuck: no region holding at most half the fight keeps it much longer than eight steps.
   - *Precisely:* lambda*(S) <= lambda_2 of the additive reversibilisation (P + P*)/2 of the Q-process, so no set of its states with mu(S) <= 1/2 has residence above 1/((1 - lambda_2)(1 - mu(S))): 7.7-8.5 steps across the five configurations.
   - *Computed:* `scripts/semantics/territories.py`; `territories.json` -> ["configs"]["gi/shipped/origin-on"]["spectrum"]["state"]["cheeger_ceiling_residence"]; `territories.json` -> ["configs"]["nogi/symmetric/origin-on"]["spectrum"]["state"]["cheeger_ceiling_residence"]

30. **seat split and phase split**
   - *For a grappler:* The two slowest divides in the map are 'who is on top' and 'are we still in the guard or standing game, or already passed and pinned'.
   - *Precisely:* Seat split = every /bottom seat vs every /top seat; phase split = the union of positions maximising lambda* with both sides holding mu >= 0.1 (guard/standing 64 positions vs passed/pinned 58); under the player-neutral rule the two are exactly orthogonal slow modes.
   - *Computed:* `scripts/semantics/territories.py`, `scripts/semantics/naming.py`; `territories.json` -> ["configs"]["nogi/symmetric/origin-on"]["splits"]["phase"]["guard_side_hubs"]; `naming_gs1.json` -> ["seat_split"]["proposition_6_max_pooled_diff"]

31. **the localized leg set**
   - *For a grappler:* The most self-contained region of the map is a 14-position leg-entanglement cluster: rarely entered, but half the spells in it end the roll there.
   - *Precisely:* The lighter side of the unconstrained lambda* optimum: 14 positions, lambda* 0.6768, entered by 2.8% of rolls from standing, 48% of its spells ending the roll.
   - *Computed:* `scripts/semantics/territories.py`; `territories.json` -> ["configs"]["nogi/symmetric/origin-on"]["splits"]["localized"]["hubs"]; `naming_gs1.json` -> ["regions"]["localized:localized"]["name_n3"]

32. **metastable decomposition (G-PCCA+)**
   - *For a grappler:* An attempt to carve the map into a few regions that each hold the fight: it finds only one soft region, the leg entanglements, and the rest of the map is one piece.
   - *Precisely:* G-PCCA+ fuzzy k-block decomposition of the position-lumped Q-process from its real Schur vectors, blocks by argmax membership. At k = 2 the lighter block is an 11-position leg-entanglement cluster (a different set from the localized leg set) with fuzzy memberships, self-overlap 0.15, while the rest of the map is one block of 111 positions holding 92% of the mass crisply (membership >= 0.9); the decomposition's crispness, 0.54, is the mean of the two self-overlaps. At every computable k from 3 to 8 (k = 7 would split a complex-conjugate Schur pair), at most 0.7% of the mass is held crisply.
   - *Computed:* `scripts/semantics/territories.py`; `territories.json` -> ["configs"]["nogi/symmetric/origin-on"]["gpcca_k2_blocks"]; `territories.json` -> ["configs"]["nogi/symmetric/origin-on"]["gpcca"]["hub"]

33. **map-equation module**
   - *For a grappler:* Grouping positions so that describing where the fight goes takes the fewest words: a module is a set the fight moves around inside before leaving it.
   - *Precisely:* The two-level map equation (Rosvall-Bergstrom) minimised on the position-lumped Q-process: 40 modules, 3.73 against 4.36 bits per step for one module (a 14.5% saving).
   - *Computed:* `scripts/semantics/territories.py`; `territories.json` -> ["map_equation"]["nogi/symmetric/origin-on"]["module_table"]; `naming_gs1.json` -> ["regions"]["module:M17 inside-ashi-garami"]["name_n3"]

34. **road (border-crossing technique)**
   - *For a grappler:* The techniques that carry the fight from one module to another: passes, pin-to-pin transitions, escapes, back takes.
   - *Precisely:* A technique whose success lands in a different module from its origin position's, weighted by its Q-process stationary flow (2.65 expected crossings per roll from standing).
   - *Computed:* `scripts/semantics/territories.py`; `territories.json` -> ["technique_territories"]["nogi/symmetric/origin-on"]["top"]

35. **diffusion distance and commute time**
   - *For a grappler:* How far apart two places are by how the fight moves between them, rather than by how it ends.
   - *Precisely:* Diffusion distance D_t on the mu-weighted position lump of the Q-process after t in {1, 2, 4} steps; commute time m(x,y) + m(y,x) in steps.
   - *Computed:* `scripts/semantics/geometry.py`; `geometry.json` -> ["definitions"]["diffusion"]; `geometry.json` -> ["definitions"]["commute"]

36. **NMI and purity**
   - *For a grappler:* How much two ways of carving the map agree.
   - *Precisely:* Normalised mutual information (arithmetic normalisation) between two labelings of the same positions; mu-purity of A in B = the sum over A's blocks of the largest mu overlap with one B block.
   - *Computed:* `scripts/semantics/naming.py`; `naming_gs1.json` -> ["nmi_purity"]["map_modules ~ tv_regions"]

37. **passage**
   - *For a grappler:* The share of the rolls I win, or lose, that ever pass through a place: side control on top is in 59.6% of the rolls I win and 28.7% of those I lose.
   - *Precisely:* P(I finish AND the roll ever visits set C) / P(I finish), from standing (me first), no horizon; exact by redirecting C's mass to a marked exit (Woodbury on one fundamental matrix).
   - *Computed:* `scripts/semantics/flux.py`, `scripts/semantics/_tpt.py`; `flux.json` -> ["configs"]["headline"]["passage_roles"]

38. **reactive current**
   - *For a grappler:* The net flow of winning rolls along each technique: how much of 'I finish' moves across it after cancelling rolls that come back.
   - *Precisely:* f_ij = g_i Q_ij h_j with g the expected visits from the start and h the committor; the net current is max(f_ij - f_ji, 0), and its throughput equals P(I finish) (gs-4 Proposition c).
   - *Computed:* `scripts/semantics/_tpt.py`, `scripts/semantics/flux.py`; `flux.json` -> ["configs"]["headline"]["flux"]["W"]["probability"]

39. **choke point (minimum cut) and the finishing layer**
   - *For a grappler:* A choke point would be a set of moves every winning roll must cross; in the corpus's game the only one is the finish itself.
   - *Precisely:* A minimum cut of the net winning current; its support is one strongly connected component holding both standing seeds, so the only admissible minimum cut is the finishing layer (gs-4 Theorem d): no interior choke point exists.
   - *Computed:* `scripts/semantics/flux.py`; `flux.json` -> ["configs"]["headline"]["flux"]["W"]["cut_capacity_equals_probability"]; `flux.json` -> ["configs"]["headline"]["flux"]["W"]["scc"]

40. **sensitivity (traffic x leverage)**
   - *For a grappler:* Which written success rate matters most: how often the technique is played times how much a hit is worth over a miss.
   - *Precisely:* dP(I finish)/dp_t = E[plays of t per roll] x the play-weighted mean of (A - B), A and B the committors after success and after a miss; exact by one adjoint solve.
   - *Computed:* `scripts/semantics/flux.py`; `flux.json` -> ["configs"]["headline"]["grad_me_top30"]

41. **advantage A-inf (the policy gradient) vs EDGE**
   - *For a grappler:* How much better one move is than your usual choice here: A-inf assumes you keep playing like the corpus, EDGE assumes you play perfectly afterwards.
   - *Precisely:* A-inf(s,a) = q_after(s,a) - q(s) is exactly the policy gradient at s (gs-4 Proposition b2); EDGE = 100 (Q(s,a) - sum_b pi_b Q(s,b)) on an 11-ply, lambda = 2, argmax-continuation Q; both average to zero over a hand, so only the order within one hand means anything.
   - *Computed:* `scripts/semantics/flux.py`, `scripts/solve_edge_values.py`; `flux.json` -> ["edge_bridge"]["within_hand"]

42. **FLOW**
   - *For a grappler:* The FLOW ranking is the app's what-to-drill-next list: which deck, if you got better at it, would raise your finish rate most.
   - *Precisely:* solve_flow's adjoint gradient of P(W) - 2 P(L) over 11 plies, from a uniform start over live seats, in my deck-mastery parameters: exactly the clocked, lambda-weighted, drill-parameterised instance of the sensitivity (the whole vector reproduced to machine precision, <= 3e-16).
   - *Computed:* `scripts/solve_flow.py`, `neural/src/flow.src.js`, `scripts/semantics/flux.py`; `flux.json` -> ["flow_bridge"]["nogi"]["reproduction_max_abs_diff"]


<!-- COPY RULES -->

### 12.1 Copy rules for any in-app sentence built on this research

Each rule gives its reason, a sentence that breaks it, a compliant rewrite, and how it is checked.

**R01-which-game.** Every sentence says which game it describes: 'in the corpus's game', or 'in the app's game' for numbers computed with app_game.py.
   - *Why:* The two games differ a lot: P(I finish) from standing is 0.7225 in the corpus's game and 0.3489 in the app's game (no-gi, shipped initiative; doc 1.3, app_game.py).
   - *Breaks it:* "From standing you finish 72% of your rolls."
   - *Complies:* "In the corpus's game (no-gi, shipped initiative), 72.3% of the rolls that end from standing end with my finish, with no clock."
   - *Check:* checked by `lint_copy` (regex).

**R02-no-promises.** Describe how rolls end among the rolls the corpus describes; never promise the reader an outcome ('you will', 'you should', 'guaranteed').
   - *Why:* Every figure is a probability over the corpus's population of rolls, and the app's opponent plays differently (R01); a share is not a forecast for one player.
   - *Breaks it:* "Get to side control and you will win."
   - *Complies:* "In the corpus's game (no-gi), side control on top is in 59.6% of the rolls I win and 28.7% of the rolls I lose."
   - *Check:* checked by `lint_copy` (regex).

**R03-share-of-what.** Every percentage names its population: of the rolls that end, of the rolls I win or lose, of all endings, or of a long fight's time.
   - *Why:* A bare percentage is ambiguous between decided rolls, all rolls, clocked rolls and time share, and these differ (38.0% of decided rolls vs 2.9% of a long fight's time for leg-lock territory; naming.json territories).
   - *Breaks it:* "Leg locks here: 38%."
   - *Complies:* "In the corpus's game (no-gi), 38.0% of the rolls that end from these positions end in a leg lock, vs 6.6% from standing."
   - *Check:* checked by `lint_copy` (regex).

**R04-territory-carries-its-number.** A territory or place name always carries its number: the class share here against the share from standing.
   - *Why:* A name is a claim about a set, with a measured fit (N2R); without the number 'leg-lock territory' could mean 10% or 70%.
   - *Breaks it:* "In the corpus's game (no-gi), Saddle is leg-lock territory."
   - *Complies:* "In the corpus's game (no-gi), Saddle is leg-lock territory for the top player: 47.4% of the rolls that end from here end in a leg lock, vs 6.6% from standing; the name holds in 200/200 perturbations and with the origin filter off, under the shipped initiative rule and in gi."
   - *Check:* checked by `lint_copy` (regex).

**R05-robustness-in-words.** State robustness in words (holds in k of 200 perturbations, and under which alternatives); never a 'confidence %', 'certain', 'significant', 'proven' or a p/q value.
   - *Why:* Exit shares are exact functionals of the authored numbers; there is no sample, so a confidence percentage would be invented (ruling 1). Set-fit q values are exploratory (ruling 2).
   - *Breaks it:* "In the corpus's game (no-gi), Back Control is choke territory (97% confidence)."
   - *Complies:* "In the corpus's game (no-gi), Back Control is choke territory for the top player: 61.2% of the rolls that end from here end in a choke, vs 46.4% from standing; the name holds in 162/200 perturbations; with the origin filter off it is middle game; under the shipped initiative rule it is middle game; in gi it is middle game."
   - *Check:* checked by `lint_copy` (regex).

**R06-seat-names-need-their-facts.** A seat qualifier ('for the top player') is shown only with its robustness clause; where it fails one of the four facts, the sentence says so. Short copy without the clause may carry a seat only when it holds on all four facts.
   - *Why:* Seat names are finer claims than pooled names: 78 of 122 names hold on all four facts against 115 for pooled names; most new seat names sit at the 2x seat gate (back-control 2.08x, 162/200, fails all three alternatives; naming.json seat_names).
   - *Breaks it:* "In the corpus's game (no-gi), Back Control is choke territory for the top player: 61.2% of the rolls that end from here end in a choke, vs 46.4% from standing."
   - *Complies:* "In the corpus's game (no-gi), Armbar Control is arm-lock territory for the top player: 40.1% of the rolls that end from here end in an arm lock, vs 18.1% from standing; the name holds in 200/200 perturbations and with the origin filter off, under the shipped initiative rule and in gi."
   - *Check:* checked by `lint_copy` with the sentence's configuration / robustness record.

**R07-middle-game-not-no-data.** An unnamed place is 'middle game' (its rolls end the way rolls from standing do), never 'no data', 'unknown' or 'N/A'.
   - *Why:* Unnamed is a measured result, not an absence: 76 of 122 positions, and their exit laws are computed like every other (naming.json unnamed_ground, seat_names.unnamed).
   - *Breaks it:* "In the corpus's game (no-gi), Half Guard: no territory data."
   - *Complies:* "In the corpus's game (no-gi), Half Guard is middle game: its most over-represented ending, the leg lock, is 9.4% of the rolls that end, vs 6.6% from standing."
   - *Check:* checked by `lint_copy` (regex).

**R08-no-printed-zero.** Never print a share as 0% or 0.0%: small shares get two significant figures, exact zeros are 'never', and unreachable positions are 'not reachable from standing'.
   - *Why:* A rounded zero reads as 'never happens' when the value may be 0.0036% (twister-control's time share), and an unreachable position has no exit law at all (naming.json not_evaluable).
   - *Breaks it:* "In the corpus's game (no-gi), Lapel Guard: 0.0% of the rolls that end, end in a leg lock."
   - *Complies:* "In the corpus's game (no-gi), Lapel Guard is not reachable from standing, so it has no exit law to name."
   - *Check:* checked by `lint_copy` (regex).

**R09-gi-figures-from-gi-kernels.** A figure labelled gi comes from a gi kernel (and says so); a no-gi figure is never shown to a gi player as if it were theirs.
   - *Why:* The frames differ in how rolls end: the leg-lock baseline halves in gi (3.5% vs 6.6%) and the finisher law moves by total variation 0.20; the shipped EDGE table exists in no-gi only (naming.json gi_vs_nogi; doc 8).
   - *Breaks it:* "In the corpus's game (gi), 38.0% of the rolls that end from these positions end in a leg lock, vs 6.6% from standing."
   - *Complies:* "In the corpus's game (gi), 28.0% of the rolls that end from these positions end in a leg lock, vs 3.5% from standing."
   - *Check:* checked by `lint_copy` with the sentence's configuration / robustness record.

**R10-gi-comparisons-name-the-baseline.** A gi-vs-no-gi comparison of a territory's size names the baseline it holds fixed.
   - *Why:* Against its own gi baseline leg-lock territory looks stable (23 positions); against the fixed no-gi baseline it shrinks to 17 (naming.json gi_vs_nogi.territories).
   - *Breaks it:* "In the corpus's game, leg-lock territory is just as big in gi (23 positions)."
   - *Complies:* "In the corpus's game, leg-lock territory shrinks from 22 positions in no-gi to 17 in gi when both are measured against the no-gi baseline."
   - *Check:* checked by `lint_copy` (regex).

**R11-default-endings.** Never call a place 'not a choke position' or 'not a shoulder-lock position' because it has no choke or shoulder-lock territory; say that chokes (or shoulder locks) are the default ending there.
   - *Why:* The ratio rule cannot name a class that is already the default ending: chokes are 46.4% of all endings from standing, so no place can double them (enrichment <= 1/b; naming.json territories.CHOKE).
   - *Breaks it:* "In the corpus's game (no-gi), Back Control is not a choke position."
   - *Complies:* "In the corpus's game (no-gi), chokes are the default ending everywhere (46.4% of all endings from standing); from Back Control they are 61.2% of the rolls that end."
   - *Check:* checked by `lint_copy` (regex).

**R12-no-edge-sums.** Never total, average or rank EDGE (or any advantage) across a hand or a position; only the order of cards within one hand means anything.
   - *Why:* Both EDGE and the policy-gradient advantage average to zero over every hand by construction, so a sum is identically zero and ranking it ranks rounding noise (CLAUDE.md 6.6; gs-4 Proposition b1).
   - *Breaks it:* "In the corpus's game (no-gi), Mount's total EDGE is +3."
   - *Complies:* "In the corpus's game (no-gi), EDGE orders the cards within this one hand; the order is all it says."
   - *Check:* checked by `lint_copy` (regex).

**R13-no-interior-choke-points.** Never call a position a 'choke point' or 'bottleneck' of the map; describe it by passage (the share of won and lost rolls that pass through it).
   - *Why:* The net winning current's support is one strongly connected component, so the only minimum cut is the finishing layer: no interior choke point exists (gs-4 Theorem d; flux.json configs.headline.flux).
   - *Breaks it:* "In the corpus's game (no-gi), side control is the choke point of the map."
   - *Complies:* "In the corpus's game (no-gi), side control on top is in 59.6% of the rolls I win and 28.7% of the rolls I lose."
   - *Check:* checked by `lint_copy` (regex).

**R14-current-is-not-passage.** Shares of the winning current or of the finisher law are not shares of rolls passing through: say 'end with' for finishes and 'are in' for passage; never '% of rolls go through'.
   - *Why:* Current counts expected traversals (a roll can cross an edge more than once) and the finisher law counts endings; passage is the only trajectory statement (gs-4 (c), (g)).
   - *Breaks it:* "In the corpus's game (no-gi), 9.3% of wins pass through Back Control."
   - *Complies:* "In the corpus's game (no-gi), 9.3% of the rolls I win end with Rear Naked Choke from Back Control."
   - *Check:* checked by `lint_copy` (regex).

**R15-time-has-units.** Durations are in steps (cards) or plies (one card, 0 for a stay-put miss: the kernel's time unit), never bare 'moves' or 'turns', and say whether a clock is on. The one exception is the app's own move clock, whose unit is the app's move count, named as such.
   - *Why:* Steps overcount plies by 25% under the shipped rule (11.32 vs 9.04 from standing; kernel --structure), and the app's move count is neither: it charges some moves differently from a ply (app_game.py).
   - *Breaks it:* "In the corpus's game (no-gi), rolls from standing last 11 moves."
   - *Complies:* "In the corpus's game (no-gi, shipped initiative), rolls from standing last 11.3 steps (9.0 plies) on average when no clock stops them."
   - *Check:* checked by `lint_copy` (regex).

**R16-seat-means-starting-seat.** Top and bottom name the seat the finisher STARTED in at this position ('the player who started on top'), not where they are at the moment of the finish.
   - *Why:* Seat shares are computed from the starting seat (hub start law); rolls move through sweeps and reversals before they end (naming.json definitions.seat_share).
   - *Breaks it:* "In the corpus's game (no-gi), from Back Control the player on top finishes 48.3% of the rolls that end by choke."
   - *Complies:* "In the corpus's game (no-gi), from Back Control 48.3% of the rolls that end are finished by a choke from the player who started on top."
   - *Check:* checked by `lint_copy` (regex).

**R17-descriptive-not-advice.** Names describe how rolls end; they are not instructions. No 'go to', 'hunt', 'aim for' built on a territory name.
   - *Why:* A territory is a property of the corpus's rolls, not an optimal policy; advice belongs to EDGE / FLOW, which answer different questions (doc 5.4).
   - *Breaks it:* "Go to 50-50 Guard to hit heel hooks."
   - *Complies:* "In the corpus's game (no-gi), 47.2% of the rolls that end from 50-50 Guard end in a leg lock, vs 6.6% from standing."
   - *Check:* checked by `lint_copy` (regex).

**R18-numbers-from-the-artifact.** Every number in a generated sentence is fetched by path from the artifact and verified; nothing is hand-typed.
   - *Why:* Canon numbers in this repo drifted because they were typed (CLAUDE.md 6.9); the N2R lane itself wrote 36.2% where the stored value prints as 36.1%.
   - *Breaks it:* "In the corpus's game (no-gi), leg-lock territory at 2x: 40% of the rolls that end, end in a leg lock."
   - *Complies:* "(generated by CardText: every number listed in the card's `numbers` as [path, value, text])"
   - *Check:* enforced by `CardText.verify` when a sentence is generated.

**R19-small-classes-carry-their-share.** Hip/groin and spine names always carry their percentage; their classes rest on 3 and 9 submissions.
   - *Why:* Tiny baselines make huge enrichments from small shares: the literal naming rule would call Turtle hip/groin territory on 0.31% (naming.json names.variants.literal_delta0).
   - *Breaks it:* "In the corpus's game (no-gi), Truck is hip/groin-lock territory."
   - *Complies:* "In the corpus's game (no-gi), Truck is hip/groin-lock territory for the top player: 6.3% of the rolls that end from here end in a hip or groin lock, vs 0.093% from standing; the name holds in 160/200 perturbations; with the origin filter off it is leg-lock territory for the top player; in gi it is leg-lock territory for the top player."
   - *Check:* checked by `lint_copy` (regex).

**R20-regions-say-how-positions-are-weighted.** A name for a large region says how its positions were weighted, or uses the time-weighted share when the two readings differ.
   - *Why:* Counting every position equally, the guard/standing half of the map reads as leg-lock territory (16.1%); weighted by where fights spend time it is middle game (8.0%) (naming_gs1.json regions.phase:guard/standing).
   - *Breaks it:* "In the corpus's game (no-gi), the guard/standing game is leg-lock territory."
   - *Complies:* "In the corpus's game (no-gi), counting every guard/standing position equally, 16.1% of the rolls that end end in a leg lock; weighted by where fights spend their time, 8.0%."
   - *Check:* human review (no mechanical check).

**R21-no-stale-canon.** Never describe the app's opponent with CLAUDE.md 5's 'no role or origin filter, ~12%'.
   - *Why:* Stale since v1.176.0: the opponent draws from the role- and origin-filtered candidates and picks by its own rule (doc 1.3; gs-shared ruling 3).
   - *Breaks it:* "The app's opponent uses no role or origin filter, so only 12% of its moves match the corpus."
   - *Complies:* "In the app's game, the opponent draws from the same role- and origin-filtered candidates and chooses among them by its own rule."
   - *Check:* checked by `lint_copy` (regex).

**R22-say-whether-the-clock-is-on.** A finish probability says whether a clock is on and which one, a 9-12-ply clock (the app's clock length) or the app's own move clock; with a clock, say how many rolls run out of time.
   - *Why:* A clock takes finishes and never gives them (gs-2 Proposition B): from standing (no-gi, player-neutral) P(I finish) is 0.553 with no clock but 0.396 under a 9-12-ply clock, with 0.314 running out of time (kernel --structure); the two clocks leave different shares of rolls undecided (doc 1.3).
   - *Breaks it:* "In the corpus's game (no-gi), I finish 55.3% of rolls from standing."
   - *Complies:* "In the corpus's game (no-gi, player-neutral initiative), I finish 55.3% of rolls from standing with no clock; under a 9-12-ply clock (the app's clock length) I finish 39.6% and 31.4% run out of time."
   - *Check:* human review (no mechanical check).

**R23-two-clocks.** Name a clock by what it counts: 'a 9-12-ply clock (the app's clock length)' for the kernel's horizon in plies, 'the app's own move clock' for the app's move count (moveCount); never give the app's clock a ply unit or the ply an app unit.
   - *Why:* The two clocks count different things: the app's move count charges my missed submission 2 and their finish attempt 0 and ends a roll only on some moves (app_game.py, THE CLOCK), and they leave different shares of rolls undecided (doc 1.3).
   - *Breaks it:* "In the corpus's game (no-gi), under the app's 9-12-ply clock I finish 39.6% of rolls from standing and 31.4% run out of time."
   - *Complies:* "In the corpus's game (no-gi, player-neutral initiative), under a 9-12-ply clock (the app's clock length) I finish 39.6% of rolls from standing and 31.4% run out of time."
   - *Check:* checked by `lint_copy` (regex).
