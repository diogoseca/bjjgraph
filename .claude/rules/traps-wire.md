---
paths:
  - "scripts/**"
  - "neural/**"
  - "node_ordinals.json"
  - "tests/**"
---

## 6. THOUGHT TRAPS — the build-side wire: 6.6 joins, keys and ordinals

Split out of `CLAUDE.md` at v1.224.3: it loads with the `paths:` above, and CLAUDE.md §6's index
names it. CLAUDE.md §0 and §9 decide what belongs here; `npm run validate:claudemd` gates its size
and references.

### 6.6 Before you change a join, an id, a slug, an order or a persisted key — the build side

The app side (silent fallbacks, the `s` pairs, `siteIdOf`, `adj`, settings keys, `startPosTraffic`,
`_ev`, whole-category constants) is in `.claude/rules/traps-neural.md`.

- **A CHECK THAT NEVER RAN REPORTS CLEAN — absence produces a plausible answer.** A bare `except Exception: return issues`, a matcher that matches nothing, a zero-length comparison loop and `git diff --quiet` on an UNTRACKED file all emit exactly what success emits. `check_position_type_vs_score` reported "0 disagreements" for months because a missing `import os` raised `NameError` into a bare except (real figure 95); a headers gate passed a Function that had stopped setting `Cache-Control` because "the comparison loop had nothing to iterate"; `keepalive.yml` had never committed anything, ever.
  **Do: every matcher, join, gate and rewrite emits a POSITIVE coverage count and hard-fails below a floor, and a skip path PRINTS.** The repo invented this fix five separate times without naming it — `regenerate_neural_data.py` and `:575` (refuse a wire below 95% join coverage, printed every run), `build.mjs` (throw per dead rewrite rule), `check_headers_cache.py` check 6a (OMISSION, not only drift), and the `mc_pool_cold` / `land_warm_stalled` beats.
  <br>_(17)_

- **`cal.avail` · `frame_reachable` — RULESET AVAILABILITY IS A REACHABILITY PROPERTY, NOT AN EDGE PROPERTY.** "Is this move attempted anywhere in frame F" is a question about one edge and cannot see the case that matters: a technique whose only origin is a state F never produces. `Worm Guard/Bottom` deals a full, honest no-gi hand (X-Guard Sweep 33, Omoplata 21) — conditional on standing in a guard entered by threading the opponent's lapel through their own legs, which no no-gi edge does. Measured: the edge question calls 52 techniques gi-only; the walk from `standing-position` calls **124 techniques and 22 position role-nodes** absent in no-gi.
  **THE WALK REPORTS BOTH FRAMES; THE LAYER ACTS ON ONE.** `EXCLUDING_FRAMES` is `("nogi",)`. The gi column the walk finds — 21 techniques, all heel-hook family — is IBJJF LEGALITY, not equipment, and acting on it is not safe today: `backside-50-50/bottom` has exactly ONE gi move surviving `optionsFor`'s role AND origin filters, so removing it empties the main pass into the ORIGIN-RELAXED fallback — cards from other origins carrying no `ord` and no `ordOdds`. **`graph.json` cannot see that coming**: its per-frame sums apply neither role nor origin, so it reports the state healthy. An empty-hand check cannot see it either, because the fallback returns cards — test for `ord === undefined`.
  **Do:** derive availability with `frame_reachable` (`scripts/regenerate_neural_data.py`), filter at the READER via `rsAllows` — never inside `adj`, which is per-SITE and role-blind by design — and never from a NAME (ruling P3a: a name sweep kills `Rear Naked Choke from Invisible Collar`, the canonical no-gi choke, because the POSITION is named "Collar"). Two numbers now both mean "availability" and are different sets: `cal.avail` is the walk; `docs/Neural.md`'s score-weight 52/16 is `_frame_positive`, the edge question, and is correct for what it measures.
  **AND THE SURFACE LIST WAS HAND-MAINTAINED FOR EXACTLY ONE VERSION.** v1.153.0 filtered the surfaces its author could enumerate; a four-lens sweep then found **38 more** a player could reach — the ESCAPE TRAY you pick from while caught, the drill queue built from a shared class, a URL arrival straight onto a gi-only technique's page, and all four node walks in `neural/src/flow.src.js`, the weak-spots engine, in a file the target-file sweep never opened. That is §6.7's hand-maintained-enumeration defect, and it landed within one commit. The list is now DERIVED by `validate:surfaces`; the guard belongs at the READER, never inside `adj`.
  **The recurring line: material the app DEALS obeys the ruleset; the player's own RECORD does not.** A class a coach posted stays what they posted — filtering `listIdxs` would silently shrink a received class and re-encode a SHORTER share code.
  **Pinned by `validate:availability` (wire parity, zero mass loss, no dead ends) + `validate:surfaces` (every enumeration filtered or justified) + `tests/ruleset_availability.test.mjs` (the surfaces, the fallback detector, and the standing anti-name-matcher fixture).**
  <br>_(1, and the whole no-gi graph was 104 techniques and 18 states too large)_

- **`_tech_keys` — a spelling-sensitive join must try every spelling and then COUNT itself.** `graph.json` keys a technique by `slugify(<display name>)`, one flat kebab token; a layout id keeps the authored PATH, so `Submissions/Kimura/from-Front-Headlock` arrives with a `/` where the key has a `-`. **0 of 297 submission keys contain an inner slash, so 294 of 297 submissions shipped no odds at all** and nothing went red, because the fallback in §6.6's app side (`.claude/rules/traps-neural.md`) printed a plausible number. The ladder is three rungs, cheapest first, and the last is the key's OWN CONSTRUCTOR rather than another guess: `as-is` → `slash→hyphen` → `slugify(title)`. Together 1331 of 1331. The emitter now refuses to write a wire below 95% coverage per type and prints the figure every run.
  <br>_(1, hidden for months, across 2 joins (`cal` and `tech_avail`))_

- **An index-keyed or positional join fails by printing the WRONG right-looking answer.** `cal.ev` is keyed `<position node index>/<role>` with `blk[0]` a list of TECHNIQUE node indexes: nothing is self-describing, so a wrong remap still finds rows, still prints an integer on every card, and prints a different technique's number on each — no exception, no warning, no blank. **Do: gate it with a whole-structure DIFFERENTIAL against a known-good graph (one build, booted twice) PLUS a non-triviality floor** — `dual-consumers.spec.ts` asserts >1200 cards carry a real mark, so it cannot pass on a build where `_ev` came back empty on BOTH sides and every comparison was trivially equal. Never a non-null count: a wrong-but-complete remap satisfies it perfectly. An index is safe only when it never leaves the file that defines it.
  <br>_(6 (cal.ev, the `s` pair, `posId`-vs-`fromPositionId`, `deg`/`siteDeg`, the cal key, links-as-pairs))_

- **A node's ARRAY INDEX can never go in a URL, and any user-visible order needs a strict total order whose final tiebreak is stable CONTENT.** `regenerate_graph.py` walks an unsorted `rglob('*.json')` and the layout derives its node list from `adjacency` DICT INSERTION order seeded by that — so adding ONE content file renumbers pre-existing entries and an index-encoded share link would silently open a DIFFERENT set of techniques, with no error anywhere. Hence `node_ordinals.json`: permanent, append-only, never renumbered, never reused, retired-not-removed, minted in sorted-id order, hard-gated by `validate:ordinals`.
  **Corollaries:** `Array#sort` is STABLE, so a comparator that can return 0 hands the decision to the node index — 21 dealt option pairs tie on EDGE, odds AND attempt%, and only the name separates them. And **a cap applied over an unordered list is a random sample**: a constant sort key made the 10-cap deal submissions ALPHABETICALLY and truncate the state's most-attempted move.
  <br>_(5)_
