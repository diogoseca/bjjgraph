# BJJGraph — AI development guide

BJJ knowledge graph and state machine as a static site, plus one canvas game app built on it.
**Site:** https://bjjgraph.org · **Repo:** https://github.com/diogoseca/bjjgraph

---

## 0. What this file is, and what it is not

This is the **canon**: the rules you can break something by not knowing, and the traps that have
already cost this project a long debugging loop at least once.

It is deliberately **not**:

| not | where that lives |
|---|---|
| a changelog or post-mortem archive | `docs/Changelog-Archive.md` — grep it, never read it whole |
| the app's behaviour spec | `docs/Neural.md` |
| the data pipeline in depth | `docs/Architecture.md` |
| the full content standards | `docs/Content.md` |
| schema markup, keywords, analytics | `docs/SEO.md` |
| what the map MEANS: the Markov kernel, territories, committors, names | `docs/GraphSemantics.md` |
| an API reference for `neural/src/app.src.jsx` | the code, which carries ~400k chars of comments |
| the app's seam index, and the traps for app code, specs and CI | `.claude/rules/` — each file loads with the folders it guards; §6's index names them |

**The admission test.** A line belongs here if *a reader could break something by not knowing it,
and it will still be true after the next ten commits*. If it explains **why** the current state is
what it is, it belongs in the archive. Mechanically: a heading whose subject is a version number →
archive · a measured number about a past run → archive · an owner quote → archive, unless the quote
*is* the rule · a mutation-kill table → archive · a trap with no greppable trigger token → rewrite
it until it has one.

**Pointer direction.** This file points **out** to the implementation and its gates. Nothing
points in.

**Before you touch app code or write a spec, read §6.** It is the reason this file is loaded at all,
and its index names the scoped file each trap group loads from.

---

## 1. Non-negotiables, and how work ships

### Never do these

| action | why | do instead |
|---|---|---|
| Edit generated `.md` in `content/` | Overwritten on the next regeneration. **These files carry no do-not-edit banner** — that is exactly why this rule is first | Edit the `.json` beside it (data) or `templates/` (structure), then regenerate |
| Commit a secret or API key | Public repo | `.env`; deploy-time values are stamped by CI (§7) |
| Guess a wikilink target | Broken link, silently | Verify the file exists first |
| Skip validation before a content commit | Breaks the build | `npm run regenerate:build` |
| Add a doc without indexing it | Orphaned | Link it from §0's table |
| Put emojis in content files | Inconsistent styling | Docs only, sparingly |

**This repo is PUBLIC, and so is this file.** No secrets, no partner terms, no commercial
strategy in any committed file — `docs/` and CLAUDE.md included. Anything of that kind belongs in
the untracked `CLAUDE.local.md`, which is ignored and cannot reach a commit; do not move it back.
It is why `affiliate_url` never reaches `graph.json` and why deploy-time values are secrets.

**There is no maximum file size.** `neural/src/app.src.jsx` is deliberately ONE imperative
component of ~13,000 lines and must not be split; several tracked files exceed 1,000 lines by
design. Prefer small modules when the seam is real, never to satisfy a line count.

### Shipping

**Version** `1.MAJOR.MINOR` in `package.json`. Feature or structural change → MAJOR
(`1.5.4 → 1.6.0`). Fix, dependency bump, cleanup → MINOR (`1.5.4 → 1.5.5`). Bump on every commit.
Message: `v1.X.Y - Description`.

**Pre-commit depends on what you changed** — one ritual for both was ignored, and it fires a
paid Claude content rewrite for a one-line app fix:

```bash
# content / templates / schema
npm run regenerate:build

# neural app  (npm run build does NOT rebuild the bundle — a stale one makes
#              journeys time out at 240s and look like contention. See §6.4)
npm run dev:neural:app && npm run test:curated

# anything touching source/quartz
cd source && npm run check
```

**Before `gh pr create`, run `npm run ci:validate`**: it replays `ci-validate.yml`'s own steps in order
(installers become presence checks), so CI's red shows on your seat first.

**Push is the owner's call.** Commit locally as much as you like; `git push origin dev` waits for
their go-ahead — they test locally first, especially anything touching the app.

**End a delivery with the literal command to run it**, and say plainly what is blocked on them.

**Plans end with a TL;DR** — one self-contained paragraph carrying intent, scope and the key
decisions, so the plan can be approved or redirected without reading the rest.

---

## 2. Repo map

```
bjjgraph/
├── CLAUDE.md              # this file — canon + the traps every session needs
├── .claude/rules/         # path-scoped canon: §5 and the app, test and CI traps (§6 index)
├── docs/                  # Neural, Architecture, Content, SEO, Changelog-Archive, …
├── calibration/      # tracked anchors, overrides, review entries; ignored run outputs
├── content/               # *.json = SOURCE (authored) · *.md = GENERATED (never edit)
│   ├── Positions/ Transitions/ Submissions/ Systems/ Learning/ Principles/
│   └── Game Over.md       # the terminal state; its alias is what makes [[game-over]] resolve
├── templates/             # JSON schemas + Jinja2 templates
├── scripts/               # validators, regenerators, calibration, gates
├── neural/                # THE front-end: src/ (app.src.jsx + challenge-*, sound, lists) → build/ → dist/
├── source/                # Quartz SSG (MIT). source/public/ is the BUILT site (gitignored)
├── e2e/                   # journeys/ (core) · gen/ (generated + ledger.json) · quarantine/ · dsl.ts
├── functions/             # Cloudflare Pages Functions (the /l/<code> share preview)
├── forward/               # the /dev component catalog and sound lab
├── workers/ · supabase/   # edge worker, DB schema + RLS
├── tests/artifacts/       # baselines, budgets, probes, mutant scripts
├── node_ordinals.json     # COMMITTED, append-only — share links encode these (§6.6)
└── graph.json             # generated graph data
```

**The one structural rule:** `content/*.json` is source, `content/*.md` is generated output,
`templates/` holds the schemas and the Jinja2 that turns one into the other.

No corpus counts are given here on purpose — the ones this file used to carry were wrong by up to
2.4x and disagreed with its own figures elsewhere. `find content/Positions -name '*.json' | wc -l`
is always right.

---

## 3. Data model and graph invariants

Only what you can violate. Depth in `docs/Architecture.md`.

### Two representations — do not conflate them

- **`graph.json` — the data model.** Role-based. Each position emits **role-nodes**
  (`Mount/Top`, `Mount/Bottom`) which carry the edges, plus a bare `Mount` **hub** that only
  aggregates flashcards and has **no edges**. The state machine runs on role-nodes: you are in
  `Mount/Top` *or* `Mount/Bottom`, and they are different states. Neutral positions
  (`standing-position`, `clinch`, `open-guard`) still split. `game-over` is the terminal.
- **`globalGraphLayout.json` — the visual projection.** Collapses each position to a single hub
  node. This is the *only* sense in which "graph nodes are hubs" is true. It is an **input** to
  `scripts/regenerate_neural_data.py`, not a payload any page fetches.

Techniques split the same way, with **Attacker/Defender** instead of Top/Bottom: an edgeless
`<slug>` hub, `<slug>/attacker` (carries the edges, `outcomes` as authored) and `<slug>/defender`
(the same exchange role-flipped, `successRate = 100 − attacker`).

### Node and edge types

- **Position role-nodes** carry edges. Bare hubs and `is_family: true` submission hubs are
  flashcard aggregators — **not navigable data nodes**.
- **Edges.** `Position/Role —attempt_probability→ Technique` (weights sum to 100 per role, per
  ruleset frame) · `Technique —probability, result→ Position/Role | Submission | game-over` (sum to
  100 per frame; `result ∈ success | failure | counter`) · `Submission —success→ game-over`.
- `from_position` is **origin metadata, not a second edge**.
- **`opponentTransitions` does not exist anywhere.** Do not reintroduce a per-page mirror; derive
  in the consumer.

### Invariants (checked by `scripts/validate_graph_integrity.py`)

- A technique has **one** canonical origin and **3–5** outcomes.
- **`game-over` is the only sink**, and **only submissions reach it.** A transition pointing
  straight at `game-over` is a misfiled finish.
- Every `outcome.to` resolves to a **role-node**, a **real (non-family) submission**, or
  **`game-over`** — never a bare hub, never a family hub, never a self-loop.
- A position lists only moves whose `fromRole` matches its own role. A wrong-role reference is a
  teleport bug.

### Schemas — the shapes, as actually authored

**Every probability is a per-ruleset `{gi, nogi}` map**, and each frame sums to 100 independently.
`graph.json` carries the folded no-gi scalar **plus** the `*ByRuleset` pair.

**A cell may be `null`, and it is not zero.** `scripts/_ruleset.py` has always defined `null` as
"this edge does not exist in that ruleset", against `0` = "exists, ~never attempted". The corpus used
it **0 times until v1.167.0** and now carries **62** — no-gi only, minted from the Q3 calibration's
own unavailability verdict by `apply_occurrence_calibration.py --write-nulls`. A frame whose cells
are all null vanishes from `present_rulesets`, so no sum check runs on it; that is the mechanism, not
a loophole. Never write `or 0` on one of these cells — it re-animates an edge the corpus says is not
there. Drop it, and COUNT what you dropped.

```jsonc
// content/Positions/Mount.json  → top.transitions[]
{ "transition": "Mount to Armbar",          // key is `transition`, NOT `name`
  "attempt_probability": { "gi": 6, "nogi": 7 } }

// content/Transitions/100% Sweep.json
{ "name": "100% Sweep",
  "from_position": "Closed Guard/Bottom",   // "Position/Role"
  "success_rate": { "gi": 50, "nogi": 50 },
  "outcomes": [
    { "to": "Mount/Top", "probability": { "gi": 50, "nogi": 50 }, "result": "success" }
  ],
  "attacker": { /* ~12 authored subkeys: overview, key_principles, execution_steps,
                   common_counters, common_errors, flashcards, clips, … */ },
  "defender": { /* the same, from the other side */ } }
```

**Attacker and Defender content IS authored in the source JSON.** The templates render its
*layout*, they do not generate its *content*. Fixing a defender's copy means editing that
technique's `.json` — editing the shared template instead would rewrite all ~1,000 transitions.

---

## 4. Pipeline and commands

```
content/*.json  →  templates/*.md.jinja2  →  content/*.md  →  Quartz build  →  static site
   (SOURCE)           (TEMPLATES)             (GENERATED)        (BUILD)         (OUTPUT)
```

The Neural app is an overlay on that output: `neural/src/*` is bundled by `neural/build/build.mjs`
into `source/quartz/static/neural/app/`, and its data comes from `scripts/regenerate_neural_data.py`.

### Every npm script

Long explanations belong in each script's own docstring, where they cannot drift from the code —
`scripts/check_affiliate_surface.py` is the model.

**Validate** — `validate:json` schemas (hard) · `validate:graph` integrity (ratchets on
`tests/artifacts/graph_validation_baseline.json`, `max_errors` 0) · `validate:ordinals` share-link
lockfile (hard) · `validate:payload` byte ratchets PLUS the soft gzip bands (§8) PLUS the **tier-0 count
floors** (pages · JSON-LD blocks · in-article links · static files — every other figure there is
a MAX, so until v1.192.4 a build emitting a tenth of the site passed it, `validate:seo` and the
byte ratchet at once; `--set-floors --reason` moves one, `--update` never touches them) ·
`validate:build-shape` the committed build census + bundle hashes + the distinct-value collapse
detector (PR only, via `e2e-full.yml`: a content edit legitimately moves it, so re-seed in the same
PR with `validate:build-shape:update`) · `validate:seo`
crawlable-surface ratchet ·
`validate:headers` cache/security headers · `validate:affiliate` the product-link surface (neutral
source, verified links) · `validate:analytics` the BUILT PostHog injection against the key its
build ran with, plus
`validate:analytics:nokey`, which builds its own keyless one-file fixture because no deploy can
exercise that direction (they all carry a key, and the mutant that shipped `posthog.init("")`
changes nothing when one is present). Neither runs in `ci-validate.yml`, which never builds; the
keyless half runs on PRs via `e2e-full.yml` and both halves run on both deploys ·
`validate:mc` MC viability · `validate:curriculum` · `validate:forward` /dev catalog ·
`validate:availability` the per-ruleset exclusion layer — wire parity against the reachability
walk, zero attempt-mass loss, no dead-end state — and it writes
`tests/artifacts/ruleset_availability.json` ·
`validate:surfaces` the DERIVED half: every node enumeration in `neural/src` either consults the
ruleset mask or is named in `tests/artifacts/ruleset_surfaces.json` with a reason ·
`validate:flow` the FLOW selfcheck (adjoint vs finite differences) plus the content ratchet on
`tests/artifacts/flow_validation_baseline.json` ·
**`validate:claudemd`** this file's own char ratchet and reference integrity.

**The corpus census.** Corpus sizes are hard-coded across specs as tripwires, on purpose. `tests/corpus_census.test.mjs` computes every one of them from the wire (~0.5s, no browser) and fails naming EVERY stale literal at once with `file:line` and `old -> new`; `npm run census:update` rewrites them. Mark a new literal with a trailing `// census:<key>` comment — the line must carry exactly one number outside strings, or the scan refuses it rather than guessing. **This runs in `test:units`, so it fires on a push to dev** — which is the whole point: a push to dev runs no Playwright, so before the census a content change met its stale e2e literals one at a time, a deploy later. That happened twice (v1.155.2, v1.158.1).

**Regenerate** — `regenerate` runs the full chain: `issues → json → explode → migrate:ruleset →
validate:graph (gate) → md → hubs → votes → graph → explorer → neural`. Each runs alone too; `regenerate:json` is the costly
Claude pass (600s interval; `-- --interval 0` for 0). The site build also generates redirects, cache headers and `llms.txt`.

**`regenerate:graph` is an UMBRELLA, not a graph.json emitter** — it runs `graph-base` (graph.json)
→ `graph-layout` (node2vec + UMAP) → **`ordinals`** (mints the append-only share lockfile) →
`graph-strength`. Running only `graph-base` strips `strength` from every node; see §6.7.

**Build and serve** — `build` (Quartz, ~10 min, then share-shell + payload budget) · `serve` (:8080,
with the `<snapshot />` receiver).

**Bootstrap a fresh worktree** — `npm run bootstrap` (npm install + chromium + the neural payload, ~1 min) is everything the unit suites, the census and the validators need. The e2e journeys additionally need a BUILT site: `npm run build` (~10 min) then `npm run dev:neural:app`. That gap is why work has shipped unverified — a fresh worktree has no `node_modules` and no `source/public`, so `npm test` cannot run at all until you pay it.

**Neural bundle** — `dev:neural:app` rebuilds the bundle and copies it into `source/public`
(**the one you want after editing `neural/src/*`**) · `dev:neural` also regenerates the payload ·
`regenerate:neural` the full payload emit.

**Test** — `test` full core suite · `test:curated` the `@curated` deployment gate (30-min ceiling) ·
`test:units` pure node --test · `e2e:gen` generated suite · `npm run e2e -- --headed` for a visible
browser (ports: §8). `pree2e` and both `test*` scripts run
`scripts/check_no_raw_random.sh` first.

**Inside `source/`** (its own `package.json`): `npm run check` is tsc + prettier, and `contentPage.tsx`
and `path.ts` carry two long-standing prettier warnings that are not yours.

Two runbooks live **outside** the repo and cannot be rediscovered from the tree:
`~/calibration-engine.md` (calibration launch) and the gitignored `occurrence_elicitation/
_orchestration/` (the Q3 occurrence Delphi resume procedure).

### Dev snapshots

`npm run serve` also runs a localhost-only snapshot receiver. A camera button captures the tab as
PNG plus a JSON dump of client state into `tests/artifacts/snapshots/` (gitignored) and copies a
one-liner:

```
<snapshot slug="Positions/Mount/Top" variant="neural" t="…" json="…json" png="…png" />
```

**When the owner pastes a `<snapshot />` line, read both files.** The PNG is exactly what they were
looking at and the JSON is the client state and console errors at that instant; both beat any
assumption about what the app "should" be showing. `?snapshot=canvas` forces the no-prompt path,
which is what automation needs — a headless browser leaves `getDisplayMedia` pending forever
rather than rejecting it.

---

## 5. The Neural app — current state, and the seam index

**Moved, and loaded with its folder:** the orientation and the seam index are in
`.claude/rules/neural-app.md`, which loads when a session touches `neural/**`. Behaviour in full:
**`docs/Neural.md`**. What stays here is what the static site shares.

**There is ONE front-end.** The legacy Quartz page UI was deleted; `?variant=legacy` is
accepted-and-ignored. Do not restore the deleted modules or write prose implying they exist.
Quartz survives as the SSG and SEO shell — the emitted `<article>`, `<head>` and JSON-LD are the
fallback for crawlers, no-JS visitors and a failed bundle fetch.

Two survivors look deletable and are not: **`AuthUI.tsx` + `authUI.inline.ts`** render nothing but
are the only static importer of `supabase.ts`, which installs the `window.__bjjAuth` façade and is
the only code that completes a Google OAuth redirect-back; **`CategoryNav.tsx`** is the site's only
persistent nav on the static surface and **no gate guards it** (`check_seo_parity.py` scopes to the
`<article>`, and the nav is outside it).

---
## 6. THOUGHT TRAPS

Things that cost this project a long loop to find, and that will cost the next one the same
loop if they are not read first. Each entry is a **class**, not an incident: it opens with the
symbol or API you would `grep` for, then why it happens, then **what it looks like from inside**
the bug — which is the part that lets you recognise it — then the fix, then whether anything
actually guards it.

Instance counts were verified against the tree at **v1.129.8**. A count is a claim: re-derive it
before quoting it. Where an entry says UNGUARDED or PARTIALLY PINNED, believe it — those are the
ones that will bite again.

The full post-mortem for every entry is in `docs/Changelog-Archive.md`; Index B there maps each
symbol to every version that touched it.

### About to…

Groups 6.1–6.6 and most of 6.7 live in `.claude/rules/`, one file per area they guard, and Claude
Code loads a file when the session reads or writes a path its `paths:` globs match. Measured on
2.1.293: `Read`, `Write` and a read-like Bash `cat` load it; `Grep` and `Glob` do not, so **a
grep-only survey or a review read from a diff means opening the file by hand.** Section numbers
are unchanged, so a code comment citing `CLAUDE.md §6.4` resolves through this index. Each line
carries its traps' trigger tokens.

- …add, move or hide a fixed overlay, or touch `attachInput` → **§6.1** in
  `.claude/rules/traps-neural.md`: `setPointerCapture` · `opacity:0` · `_dockLandCard` ·
  `_dockLandFilm` · `_dockLandMore` · `_landDatum` · `_bandBot` · `position:fixed` · `z-index` ·
  `style.color = ""`
- …change the canvas draw path, a node coordinate, or the camera → **§6.2**, same file: `n.y` vs
  `LY(n)` / `pairMid(n)` · `camTarget` · `this.now` · `halfW(n)` vs `n.r * scale`
- …write — or trust — a Playwright assertion → **§6.3** in `.claude/rules/traps-playwright.md`:
  `locator.click()` · a render re-implemented in a spec · a probe is not a gate · an unrigged
  `rng()` tag · a green gate's blind spot · an assertion stricter than its claim · `nth()` ·
  `all()[i]` · `data-tech`
- …rely on the harness: the DSL, a port, a payload, which build is under test → **§6.4**, same
  file: a payload pattern is a URL SUBSTRING · what the harness does NOT serve · `testDir` · a
  result from a shared port · a WebGL context left on the old page · `ERR_INSUFFICIENT_RESOURCES`
  · `Target crashed` · `df -h /`
- …write app runtime logic → **§6.5** in `.claude/rules/traps-neural.md`: a single-slot resource
  with many writers · a suppression flag's LIFTERS · one question answered in two places · if the
  data states it, READ it
- …change a join, an id, a slug, an ordering or a persisted key → **§6.6**, split by side. App
  side, `.claude/rules/traps-neural.md`: a fallback that never says it fired · `s` ·
  `[top, bottom]` · `[attacker, defender]` · `siteIdOf` · `adj` · a settings key can NEVER be
  deleted · `startPosTraffic` · `_posSlugIndex` · `_ev` · `_deriveDualPairs` · `cal.ev` · a value
  identical across a whole category. Build side, `.claude/rules/traps-wire.md`: a CHECK THAT
  NEVER RAN · `cal.avail` · `frame_reachable` · `_tech_keys` · an index-keyed join · an ARRAY
  INDEX in a URL
- …edit CI or a build emitter, or delete a component → **§6.7** in `.claude/rules/traps-ci.md`:
  CI running a subset of the chain · a tolerance baseline · deleting an emitter deletes its
  telemetry · a new file under `neural/src/` · scope every selector to a marker you OWN
- …rename or delete a symbol → **§6.7** below: never pipe the survey through `head`
- …delete something that looks dead, or debug something that looks alive → **§6.8**
- …quote a number, cite a gate, or claim something is covered → **§6.9**
- …look up the app's seams, its pane law or its z ladder → **§5** in `.claude/rules/neural-app.md`

> **The single most repeated class in this repo, and it cuts across every group below:**
> **absence produces a plausible answer.** A check that never ran reads as a pass; a rule that
> matched nothing reads as clean; a join that silently fell back prints a believable number.
> 17 recorded instances in 5 vocabularies. The fix, independently reinvented here five separate
> times: **emit a positive coverage count and fail on zero.** Never let "found no problems" and
> "never looked" produce the same output.

### 6.7 Before you rename or delete a symbol

The CI, emitter and deletion traps of this group are in `.claude/rules/traps-ci.md`; this one stays
here because a rename can start anywhere.

- **Never pipe the survey that decides a rename or a deletion through `head`.** The `auto_pick` retirement was scoped from a truncated grep showing the sound catalog, the app and ONE gen spec, so it looked cheap. The real list is **7 gen specs + 2 core journeys** (`announcer-coherence`, `jit-loop`), and the core one only surfaced when the full suite went red. **Do: `| wc -l` first, then read all of it.** Second form of the same trap: where the enumeration is HAND-MAINTAINED rather than derived, a new member is missing by default — `attachInput`'s overlay early-return list has no gate deriving it, and `.ng-seemore` was absent from it for its entire existence.
  <br>_(2)_


### 6.8 Before you delete something that looks dead (or debug something that looks alive)

- **LOOKS DELETABLE, IS NOT.** `AuthUI.tsx` + `source/quartz/components/scripts/authUI.inline.ts` render NOTHING but are the only static importer of `supabase.ts` (which installs the `window.__bjjAuth` façade at module top-level) and the only code that completes a Google OAuth redirect-back — delete either and signed-in users break while every headless test stays green. `CategoryNav.tsx` is the site's only persistent static nav and **NO gate guards it**: `check_seo_parity.py` extracts from the `<article>` only, and `#sidebar-overlay` is a sibling of `#quartz-root`. `openListSession` has exactly ONE caller left (`[data-shared-drill]`, `app.src.jsx`) and it is the received-class study path.
  <br>_(3)_

- **LOOKS ALIVE, IS DEAD — do not debug through it.** `renderDossier` and its subtree (`dossierSheetRef`, `_renderNodeQuestion`, `nodeQuestionFor`, `askFormat`, `jumpToState`) are unreachable from the app: `_dossierIdx` is assigned `null` at four sites and a node index at NONE, so the guarded call at `app.src.jsx` can never fire and only `first-impression.spec.ts` reaches `renderDossier` directly. The Forward catalog (`forward/shared/*`) is a DESIGN MOCK with no parity gate — `check_forward_catalog.mjs` only checks frames render, so retired rows survive there by default.
  **And `neural/src/` contains untracked design dumps that grep exactly like the app:** `Neural Graph.dc.html` (288KB, touched as recently as HEAD) still defines `movePopularity`, `_hash01`, `_freqMap` and the retired `orderScore` fork, and `neural/src/graph-data.json` is a stale 1899-node copy of a 1467-node wire. **Scope every "is this gone?" grep to the build inputs, and read the shipped wire from `source/quartz/static/neural/`.**
  <br>_(4)_


### 6.9 Before you quote a number, cite a gate, or claim something is covered

- **A canon number nobody can reproduce is worse than no number — carry its SET DEFINITION and its recompute command in the same sentence.** The failure is rarely a bad measurement; it is a measurement of the wrong SET. Measured base rate in this repo: of the figures checkable from text alone, **four have already drifted** — "0 disagreements" (a check that never executed; real 95, later 49, and now filtered through `tests/artifacts/position_type_reviewed.json`), "85 of 136" opposite-sign positions (**115**, and it was 84 the day it was written — no magnitude threshold reproduces 85), the opponent gap "9.1 / 23.2%" (measured a set the model never holds, understating by half), and "89 ambiguous main names" (**110**). `tests/artifacts/_opponent_gap_measure.py` is the pattern: the number ships with the script that recomputes it.
  <br>_(8)_

- **Every coverage claim ends in one of three forms, and the third is the dangerous one: `Pinned by <spec>` / `Partially pinned: <spec> covers <case>, not <case>` / `UNGUARDED — <what you must check by hand>`.** A spec name attached to a CLASS-level rule invites the reader to infer coverage the spec does not have. Currently unguarded and still true: `CategoryNav.tsx`, the Forward catalog mock, and `attachInput`'s early-return list. A trap whose whole class reads `Pinned by` is a demotion candidate at the next review — that is what lets this section shrink as the suite grows.
  <br>_(3 currently unguarded)_

- **Comments are stripped by the build, so documentation above a constant is FREE — put the reasoning where the change will be made, not here.** Only the copy and the code are on the payload bill. Corollary for this section: a fact with a code site belongs in a comment at that site, and only its TRIGGER TOKEN belongs in CLAUDE.md. What stays here is what has no code site — how the work is measured, surveyed and claimed.
  <br>_(n/a — the admission rule for this section)_



## 7. Content standards and product links

Full rules in `docs/Content.md`. The parts you can break:

- **Wikilinks are path-prefixed**: `[[Positions/Mount]]`, `[[Transitions/Knee Slice Pass]]`,
  `[[Submissions/Rear Naked Choke]]`. Case-sensitive, must match the filename, no `.md`.
  **One exception:** `[[game-over]]`, which resolves via the frontmatter alias on
  `content/Game Over.md`. Measured 2026-09-21: 668 files carry the bare form (821 occurrences)
  and 0 use `[[Game Over]]` — recompute with
  `grep -rl '\[\[game-over\]\]' content --include='*.md' | wc -l` (files; `-ro` for occurrences).
- **Success rates are `{gi, nogi}` maps in source** and render as a single folded no-gi percent
  (`**Success Rate**: N%`). There is no Beginner/Intermediate/Advanced tri-level format — nothing
  authors it and no validator checks it.
- **Submissions must carry a safety section**: the notice first, injury risks with severity, tap
  signals, release protocol, and safety-critical questions in the assessment.
- **Attempt probabilities sum to 100 per role, per ruleset frame.**

### Systems: guides and product links

Follow `templates/Systems.json` and `docs/Content.md`: independent source-grounded guides,
no filler quotas, unsupported mechanics, mastery timelines or invented review credentials.
Preserve graph membership; related cards are references, not a proficiency test. No reader
homework or `start_here`. Course-first layout renders overview once and Sources last; verified
previews mount immediately without autoplay. Alternatives resolve exact System names to local pages.

- Products use verified canonical `course_url`; never commit tracking queries or placeholders.
  Only `link_status: live` renders; `link_checked` records actual listing verification.
- Committed graph products omit URLs. The index adds `course_url` and `affiliate` to existing
  app product fields; rich `guide` evidence and non-graph `references` stay in deferred dossiers.
- **Source Markdown stays neutral.** An outbound link carries no query of its own and is marked
  with `data-course-url` / `data-source-url`; evidence emits `canonical_url`, the resolved `url`
  and boolean `affiliate`, and a non-tracking query is preserved. Which hosts resolve and which
  stay neutral is decided in code (`scripts/_system_guides.py`), never by the author.
- **The resolved form is stamped at deploy time** by `scripts/apply_affiliate_ref.py`, from an
  environment variable CI supplies. Absent, every link ships neutral; malformed, the build fails.
  A root `.env` is ignored, the CI environment wins, and the value is never printed. Resolution is
  idempotent and runs a second time after the agent-discovery export — a new build step must not
  land between the two.
- **No inline notice is rendered** — not in a guide body, not in Sources, not in the discovery
  export — and `validate:affiliate` fails if one comes back. The site's standing disclosure is
  `content/terms.md`. `scripts/check_affiliate_surface.py --built` checks source neutrality and
  emitted output; `tests/system_affiliates.py` covers fixture resolution. Browser behavior has its
  own suite.

---

## 8. Gates, baselines, and what a gate is worth

Numbers live where they are enforced, never in prose here — prose copies drift, baselines do not.

| baseline | gate | rule |
|---|---|---|
| `tests/artifacts/budget_site.json` | `validate:payload` | byte ratchet; `--update` reseeds it but can only ever TIGHTEN a `neural.*` ceiling |
| `tests/artifacts/budget_neural.json` | `e2e/journeys/payload-first-hand.spec.ts` | the same weight from a real browser: raw bytes, and the boot's chunk-request COUNT |
| `tests/artifacts/payload_policy.json` | both of those | **the two gzip figures are SOFT** — over `target` warns and passes, over `action` fails, and any one change growing more than `delta_cap` fails whatever the absolute figure. Bands are hand-set; a baseline moves ONLY via `--accept-baseline <metric> --reason "…"`, never by itself (a self-advancing baseline is a delta check that never runs) |
| `tests/artifacts/build_fingerprint.json` | `validate:build-shape` | the build's CENSUS, not its bytes: counts, markers, `@type` histogram, bundle hashes. Re-seed with `--update` and say what moved. A version bump moves nothing (neural.js's baked version is normalised and asserted); a bundle-only change re-seeds with `validate:build-shape:app`, no capture |
| `tests/artifacts/budget_docs.json` | `check_claudemd_budget.py` | this file's own char ceiling, and one per `.claude/rules/` file |
| `tests/artifacts/graph_validation_baseline.json` | `validate:graph` | `max_errors` is 0 |
| `node_ordinals.json` | `validate:ordinals` | append-only; never renumber, never reuse, retire don't delete |
| `e2e/gen/ledger.json` | `scripts/check_gen_specs.sh`, `e2e/gen-ledger-reporter.ts` | one row per spec; `known-red` = tolerated |
| `tests/artifacts/ruleset_availability.json` | `validate:availability` | DERIVED, never authored — regenerate, never hand-edit |
| `tests/artifacts/ruleset_surfaces.json` | `validate:surfaces` | one row per enumeration that deliberately skips the mask, each with a REASON; a row matching nothing fails |
| `tests/artifacts/wikilink_ambiguity_baseline.json` | `regenerate:md` | bare names no family decides; a new one fails, a cleared one fails `--all`; move with `--accept-ambiguity --reason` |

**Suites own dedicated ports** (core :8133, gen :8127, share :8129, replay :8151), all with
`reuseExistingServer:false`. A config that reuses another worktree's server tests *that worktree's*
`source/public`, which makes any result from it unreportable.

**The suite is expected green.** `e2e:gen` tolerates only reds its ledger names `known-red`; its
reporter fails any other red, and a named one that passes. Do not transcribe a red count from
prose — re-derive it from a run.

**Mutation testing is the practice here.** A claim is not gated until a mutant of it turns a
**named** spec red. A surviving mutant is a missing spec, not a passing build — record the non-kill
in the spec's own header so nobody later mistakes it for coverage. See §6.9.

### Automation

Sixteen workflows. **Five of them load this file into a Claude action** — so its size and its
content are inputs to what the bots write, and a change here changes their output.

| workflow | trigger | what it does |
|---|---|---|
| `ci-validate.yml` | PR, push to dev | schemas, units, ordinals, MC viability, graph ratchet, **this file's budget + refs** |
| `e2e-full.yml` | PR, weekly, manual | the core suite in four shards, plus `e2e:gen` vs its ledger |
| `e2e-gen.yml` | weekly, manual | `e2e:gen` on **dev**, judged by its ledger |
| `deploy.yaml` / `deploy-dev.yaml` | push | build, stamp deploy-time values, all gates, Cloudflare Pages, Lighthouse, IndexNow |
| `content-improvement-bot.yml` † | Sat 18:00 UTC | improves 2 content files: select by git age → validate → Claude fills TODOs → revalidate (3 tries) → regenerate → PR |
| `analytics-content-improvement.yml` † | Sun 06:00 UTC | PostHog-driven content work |
| `proofread-bot.yml` | Sun 18:00 UTC | LLM audit of graph edges and probabilities |
| `validation-fixer.yml` | Sat 12:00 UTC | fixes validation failures |
| `votes-refresh.yml` | Sat 02:00 UTC | refreshes votes and regenerates the graph (see §6.7 — it runs a *partial* chain, deliberately) |
| `clips-verify.yml` | monthly | re-verifies YouTube clips against rot |
| `seo-monitor.yml` † | Sat 06:00 UTC | SEO monitoring |
| `claude.yml` † / `claude-code-review.yml` † | mention / PR | the assistant in issues and PR review |
| `keepalive.yml`, `supabase-keepalive.yml` | weekly / 5-daily | stop GitHub Actions and Supabase auto-disabling |

† loads `CLAUDE.md`. The action's default `settingSources` (`user,project,local`) loads `.claude/rules/`
too, when a bot reads or writes a matching path; on a PR event it first restores `.claude/` and
`CLAUDE.md` from the base branch, so a PR's own edits to them never steer its own review.

**Hosting** is Cloudflare Pages. Deploys never run root `npm run build` — they re-list the build
steps inline, so a new emitted artifact or a new gate must be added to **both** deploy workflows
explicitly.

---

## 9. Where to write what

The instruction that produced a 350,000-char file was "update the docs with new learnings". This
replaces it.

**A shipped change writes its post-mortem AT THE CODE** — the constant, the function header, the
spec header, the config comment, the `.gitignore` line, a baseline's `note` field. That is where it
cannot drift from what it describes, and where the next reader is already looking. The repo already
carries ~1.1M chars of exactly this, and it costs a session nothing.

**Then append the narrative to `docs/Changelog-Archive.md`** — measurements, mutant tables, the
owner's words, the byte deltas.

**It earns a line in CLAUDE.md only when the fact has no code home.** Generated files that carry no
banner; a build step that does not do what its name says; a known-red baseline that lives in no
config; a rule about the repo rather than about a file.

**§6 grows only by adding a TRAP** — trigger token, mechanism, symptom, fix, guarded status — never
a story. At budget, admission requires eviction in the same commit; the default demotion criterion
is *the trap now has a gate that fails loudly and names it*. A trap whose code lives under one
area goes into that area's file in `.claude/rules/`, never into this file; a new file there needs
`paths:` globs, a ceiling and a line in §6's index, and the budget gate fails without each.

`scripts/check_claudemd_budget.py` enforces the ceilings, the absence of `@`-imports and the
presence of the catalogue, here and in every `.claude/rules/` file. `scripts/check_claudemd_refs.py`
checks every path, `npm run` script and symbol citation resolves, in the same files. Both run in
`ci-validate.yml`.

---

## 10. Resources

| | |
|---|---|
| Live site | https://bjjgraph.org |
| Repo | https://github.com/diogoseca/bjjgraph |
| Quartz docs | https://quartz.jzhao.xyz/ |
| Rich Results Test | https://search.google.com/test/rich-results |
| Schema.org validator | https://validator.schema.org/ |

Analytics dashboards, schema markup and keyword strategy: `docs/SEO.md`.
Hosting is Cloudflare Pages; deploys run Lighthouse CI and IndexNow submission
(`.github/workflows/deploy.yaml`, `deploy-dev.yaml`).

---

*Validate → edit the JSON → regenerate → build. And read §6 before you touch the app.*
