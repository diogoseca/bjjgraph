# BJJGraph Architecture

## State glossary

**State** is the umbrella term for the configurations and exchanges represented by the model.

- **Position:** a relatively stable configuration. Stable does not mean motionless or free of
  force; players can maintain pressure, adjust grips and contest control within a position.
- **Transition:** a transient state involving motion, forces and players actively trying to
  change the state. It is a first-class technique node, not merely an edge between positions.
- **Submission:** a transient attacking state with a possible terminal finish. Entering one
  does not guarantee a tap. Defense, failure and changes of attack can continue the exchange.
- **Role node:** one participant's perspective on a state. Positions use Top/Bottom;
  transitions and submissions use Attacker/Defender. These are not interchangeable axes:
  an attacker can be physically on the bottom.
- **Reference hub:** an edgeless entry that groups content or flashcards. It is not an extra
  playable state. A hub's identity can also name a site in the visual projection.

These definitions describe the conceptual model, not a promise that the interface pauses at
every transient state. The source records, generated graph, visual projection and game loop
have different responsibilities, described below.

Probabilities are authored or calibrated **model estimates**, not match statistics or
expert-validated predictions. Validators check structure and selected consistency rules; bots
can suggest corrections. Neither establishes that a technique, state boundary or probability
is sound BJJ. A panel of black-belt BJJ practitioners should review state boundaries,
role/origin/target validity, rule and equipment applicability, probabilities, mechanics and
safety. That review is needed, not claimed to have happened. All estimates remain open to
correction. The site is a study companion, not a substitute for supervised instruction.

## Architecture at a glance

```text
Authored content JSON + schemas/templates
  |-- Markdown generator --> content Markdown --> Quartz --> static articles
  |-- graph emitter ------> graph.json
                              |-- layout + strength + ordinals
                              |-- Neural data emitter --> compact graph + lazy content chunks

Neural source + HTML/CSS --> bundle builder --> browser game overlay
Static articles + emitted assets -----------> source/public --> Cloudflare Pages
Forward fixtures + renderers ---------------> source/public/dev
```

The layers must not be conflated:

| Layer | Owner | Responsibility |
| --- | --- | --- |
| Authored content | `content/**/*.json`, `templates/` | Technique identities, role-specific prose, probabilities, safety and relationships |
| Generated data model | [regenerate_graph.py](../scripts/regenerate_graph.py) | Role nodes, technique outcomes, origin metadata, reference hubs and published rates |
| Layout projection | [regenerate_graph_layout.py](../scripts/regenerate_graph_layout.py) | Site-level coordinates and links in `source/quartz/static/globalGraphLayout.json` |
| Browser payload | [regenerate_neural_data.py](../scripts/regenerate_neural_data.py) | Join graph, layout, content and ordinals into compact runtime data |
| Game runtime | [app.src.jsx](../neural/src/app.src.jsx) | Player seats, legal choices, outcome resolution, learning surfaces and drawing |
| Static site | [quartz.config.ts](../source/quartz.config.ts), [quartz.layout.ts](../source/quartz.layout.ts) | Crawlable articles, metadata, navigation and the app loader |

## Authored content and generated pages

JSON is the authored source for the content pipeline. Edit the JSON or the relevant template,
not its generated Markdown sibling. Hand-maintained utility pages, such as
[Game Over](../content/Game%20Over.md), are separate from those generated articles.

The corpus is organized under `content/Positions/`, `Transitions/`, `Submissions/`, `Systems/`,
`Principles/` and `Learning/`. Technique occurrences can live in nested family directories.
For example:

```text
content/Positions/Mount.json
content/Positions/Mount.md
content/Positions/Mount/Top.md
content/Positions/Mount/Bottom.md

content/Submissions/Americana/from Mount.json
content/Submissions/Americana/from Mount.md
content/Submissions/Americana/from Mount/Attacker.md
content/Submissions/Americana/from Mount/Defender.md
```

Schemas live in `templates/Positions/TEMPLATE-*.json`,
`templates/Transitions/TEMPLATE-DUAL.json` and `templates/Submissions/TEMPLATE-*.json`.
The matching Jinja2 templates render hub and role pages. Top-level category templates and
catalogs also live under `templates/`. [regenerate_md_from_json.py](../scripts/regenerate_md_from_json.py)
selects the rendering path.

**Attacker and Defender bodies are authored in JSON.** Templates lay out their overviews,
execution steps, defensive options, counters and flashcards; they do not invent those bodies.
Submission records additionally carry shared `safety_considerations` and defender
`escape_paths`. Submission family records marked `is_family: true` aggregate variants and
are not executable submissions.

Generated pages include frontmatter, path-prefixed wikilinks and schema markup. A source
reference such as `Mount/Top` is not itself a browser URL. Generated page paths preserve the
content directory structure and case; graph keys are normalized slugs. Use the existing slug
and path helpers rather than guessing how to translate between them. Content conventions are
in [Content.md](Content.md); crawlable output is covered in [SEO.md](SEO.md).

### Probability shapes

Author `attempt_probability`, `success_rate` and outcome `probability` using `{gi, nogi}` maps.
Each present ruleset frame sums independently: attempt weights per position role, outcome
weights per technique. A `null` cell means the edge does not exist in that frame; `0` means
it exists with zero modeled weight. An all-null frame is absent, not a numeric distribution.
An edge absent in both frames is a defect, not a way to delete it silently.

The schemas still accept legacy scalar values, and [_ruleset.py](../scripts/_ruleset.py)
can mirror them into both frames. That compatibility is not the recommended authoring shape.
The schemas also permit two or more outcomes; do not describe them as enforcing a universal
three-to-five-outcome limit.

This is one actual entry from `Mount.json`'s `top.transitions` array, not a complete hand:

```json
{
  "transition": "Mount to Armbar",
  "attempt_probability": { "gi": 6, "nogi": 7 }
}
```

The reference key is **`transition`**, not `name`. It can resolve to a transition or an
executable submission. The full role's array, not this excerpt, supplies the distribution.

This excerpt from [100% Sweep](../content/Transitions/100%25%20Sweep.json) includes its complete
outcome distribution but omits the instructional fields required for a complete source record:

```json
{
  "name": "100% Sweep",
  "from_position": "Closed Guard/Bottom",
  "success_rate": { "gi": 50, "nogi": 50 },
  "outcomes": [
    { "to": "Mount/Top", "probability": { "gi": 50, "nogi": 50 }, "result": "success" },
    { "to": "Closed Guard/Bottom", "probability": { "gi": 35, "nogi": 35 }, "result": "failure" },
    { "to": "Side Control/Bottom", "probability": { "gi": 15, "nogi": 15 }, "result": "counter" }
  ]
}
```

`success`, `failure` and `counter` describe the outcome from the authored attacker's
perspective. Returning to the origin position after a failed technique is legitimate:
position -> technique -> original position is not a technique self-loop.

## Generated graph model

[regenerate_graph.py](../scripts/regenerate_graph.py) emits `graph.json`.

- Position role nodes such as `mount/top` and `mount/bottom` carry outgoing attempts.
  The bare `mount` hub holds reference content without outgoing attempts. Standing Position,
  Clinch and Open Guard also have Top/Bottom nodes; being conceptually neutral does not remove
  their role split.
- Each executable technique has an edgeless `<slug>` hub and `<slug>/attacker` and
  `<slug>/defender` nodes. Outcome distributions live on the role nodes. The defender view
  flips position-role targets and reinterprets results; its success rate complements the
  attacker's rate. This derived exchange is separate from the authored defender prose.
- A position attempt's emitted `target` names the technique's base slug. Consumers select its
  attacker role node to read the exchange; the base reference does not give the hub edges.
- `from_position` becomes structured origin metadata such as `fromPositionId` and `fromRole`.
  It is not an additional outcome edge.
- Submission family hubs are reference aggregators, not playable technique occurrences.

The intended topology is:

```text
Position/Role --attempt weight--> Transition/Attacker --outcome weight--> Position/Role or Submission
Position/Role --attempt weight--> Submission/Attacker --outcome weight--> Position/Role, Submission or game-over
```

Only a submission finish should reach `game-over`. The terminal page is `content/Game Over.md`,
whose `game-over` alias resolves `[[game-over]]`. A transition that establishes a grip or
changes position is not a finish merely because its name mentions a submission. Keep each
executable occurrence's identity and origin unambiguous; do not author the same executable
name in both Transitions and Submissions as competing records.

Outcome targets should resolve to position role nodes, real submission occurrences or
`game-over`, not reference hubs. Graph validation is described under [Checks and their limits](#checks-and-their-limits);
these modeling rules are not all equivalent to hard schema constraints.

### Published rates and rulesets

The emitter reads source content and published rates from `templates/votes.json` through
[_votes.py](../scripts/_votes.py). Where a published rate matches a technique, it overrides the
headline and the scalar outcome distribution is rescaled to that headline. Source
`success_rate` and source success-outcome mass therefore must not be assumed identical to the
published graph without inspecting this step.

`graph.json` is not a verbatim copy of the source's probability maps. Position edges carry
`attemptProbability` folded to no-gi and `attemptProbabilityByRuleset`. Technique outcomes are
folded scalars; published rate overrides carry `successRateByRuleset` alongside `successRate`.
The compact browser payload can omit a per-frame rate equal to the scalar. Do not infer that
every generated probability field retains a complete pair just because source uses maps.

Runtime availability is a separate reachability calculation. `frame_reachable` in the Neural
emitter walks from the standing role nodes. `EXCLUDING_FRAMES` currently applies exclusion to
no-gi; the gi findings are reported rather than used as a blanket legality filter. In the app,
`rsAllows` and `_rulesetMask` filter consumers. This is not a complete competition-rules engine,
and a technique's name is not a reliable equipment test.

## Visual projection and runtime interpretation

`regenerate_graph_layout.py` projects the role-based graph onto sites, using node2vec and UMAP
for coordinates. `globalGraphLayout.json` is an input to the Neural emitter, not the graph file
the app fetches. Strength enrichment is owned by
[enrich_graph_strength.py](../scripts/enrich_graph_strength.py) and
[score_graph_nodes.py](../scripts/score_graph_nodes.py).

The emitted `graph-data.json` remains site-based. At ingest, `_deriveDualPairs` derives the
Top/Bottom or Attacker/Defender pair for the canvas. The representative member retains the
site's id, URL and share ordinal; its partner is a derived member. `?dual=legacy` is no longer
a rendering switch. The unsplit control path is test-only (`__NEURAL_NO_PAIRS__`).

Site adjacency and playable hands are different things. Shared site adjacency supports graph
and reference consumers. `optionsFor` applies role, origin and ruleset restrictions when dealing
a positional hand; it has an origin-relaxed fallback and must not relax the performer role.
The positional branch of `opponentDefend` now calls `optionsFor` for the opposite physical role,
rather than treating every adjacent technique as an opponent move.

The `s` strength pair means `[top, bottom]` on positions and `[attacker, defender]` on techniques.
Use `valIdx(node)` for player-relative technique values instead of applying `roleIdx()` to both
shapes. Lists and sharing use site identity through `siteIdOf`; browser array indexes are not
persistent identifiers. [node_ordinals.json](../node_ordinals.json) is an append-only mapping
maintained by [regenerate_node_ordinals.py](../scripts/regenerate_node_ordinals.py). Existing
ordinals must not be renumbered or reused.

The game interprets the model rather than replaying a physical match. `resolve` uses a
player-modified success check and `drawOutcome` samples the corresponding outcome branch.
`moveChance` combines the published estimate with practice, question, opponent and gameplay
modifiers. `solve_edge_values.py` supplies model-relative move values, and
`neural/src/flow.src.js` supplies learning-priority calculations. Those values are estimates
under their own modeled policies, not measured coaching effectiveness.

### Playable submission states

A submission occurrence has its own attacker and defender choices. Americana from Mount and
Americana from Side Control remain distinct occurrences with separate origin metadata, role
decks and outcomes. Entering an attack opens its state; it does not immediately resolve a tap.

[submission-states.json](../neural/submission-states.json) explicitly lists control aliases,
continuations, short labels and defense overrides.
[submission_choices.py](../scripts/submission_choices.py) compiles it with the source records.
Shared family membership or adjacency alone does not establish a valid continuation.

- The attacker receives exactly one **Finish** action, plus any cataloged continuations allowed
  in the current frame. Finish resolves the submission's outcome distribution; it is not a
  guaranteed terminal result. Switching to another submission enters that attack first.
- The defender receives named responses compiled from authored `defensive_options`, with
  attacker-relative position roles flipped once. Primary triangle and armbar responses have
  explicit destination overrides. A successful response can leave the threat active, so the
  interface distinguishes continued defense from an actual escape.
- The choices row separates **Your options** from **Opponent threats**. Threats are previews,
  not executable player actions. Their signed value follows the player's resulting seat;
  opponent ownership alone does not make a destination unfavorable. Their base odds use the
  published success rate, or its complement for a response, without player practice bonuses.
- Responses and explanations load together from `submission-details/`. The hand waits for the
  complete payload and offers retry on failure. A request token and state/role check prevent a
  late response from replacing a later landing.
- Aliases apply only to listed control records that represent the same established lock.
  `canonicalState` redirects those seats and hides duplicate control orbs without deleting
  stored identities or ordinals. Back Control, Front Headlock, Ashi Garami and Kimura Trap are
  not collapsed by this catalog. FLOW retains authored control vertices internally so this
  display projection does not discard their probability mass.
- Kimura, Americana and Armbar from Triangle Control have separate source records and explicit
  continuations. Their numeric estimates do not establish that the distinctions or mechanics
  have received practitioner review.

The runtime entry points are `submissionOptions`, `submissionDefenses`, `enterAttempt`,
`enterDefense` and `canonicalState` in `app.src.jsx`. Related regression cases live in
[submission_states.test.mjs](../tests/submission_states.test.mjs) and
[submission-choices.spec.ts](../e2e/journeys/submission-choices.spec.ts); they exercise choice
ownership, alias seats, selected triangle branches, entry versus finish, and delayed payloads.
They do not validate the underlying BJJ mechanics.

## Neural bundle and data delivery

[neural/build/build.mjs](../neural/build/build.mjs) composes the imperative app class, its HTML
skeleton and supporting modules into `neural/dist/neural.js` and `neural.css`. The `.jsx` filename
does not mean the production game uses React rendering: the builder supplies the small ref and
template runtime used by `xdc-template.html`. `helmet.html` supplies the base styles and
`props.json` supplies build defaults.

The data emitter writes `source/quartz/static/neural/`. Quartz copies these generated assets
into `source/public/static/neural/`; the loader uses `/static/neural/` as the data base.

| Payload, relative to the data base | Purpose | Loaded |
| --- | --- | --- |
| `app/neural.js`, `app/neural.css` | Browser runtime and styles | Boot |
| `graph-data.json` | Compact nodes, links, rates, outcomes, availability and value tables | Boot |
| `flashcards/_index.json` | Deck inventory, card counts and shared-question credit index | Boot |
| `curriculum.json` | Lessons, checkpoints, content tracks and modeled score weights | Boot |
| `flashcards/<hash>.json` | Cards for a requested deck | On demand |
| `content/<hash>.json` | Technique/position dossier or reference-page body | On demand |
| `submission-details/<hash>.json` | Submission responses and explanations | On submission entry |
| `systems.json`, `concepts.json` | Reference indexes and graph memberships | On first use |

Chunk addressing uses `fnv1a32` in [_neural_content.py](../scripts/_neural_content.py), matching
the app's `qhash` over UTF-16 code units. Files contain key-to-value maps, so hash collisions can
share a file without replacing distinct keys. Deck keys use `<Name>|<Role>`; reference bodies
use `<Name>|Principle`, `<Name>|Learning` or `<Name>|System` in the shared dossier chunk space.

Lazy loading has behavioral consequences:

- `_cardsOf(d)` is the card accessor. A manifest stub is truthy but has no cards.
- The manifest's `n` supplies counts and the denominator for `deckMastery` before hydration.
  Persisted grades must not disappear from the displayed score because a deck is cold.
- `_onDeckHydrated` refreshes study entries that took a snapshot of the cards.
- `hydrateDeck` leaves a failed request retryable rather than caching it as an empty deck.
- `_warmMcPool` discovers and hydrates required distractor decks in an RNG transaction before
  the real question draw. Network timing must not choose the random branch.
- `_docBody` loads reference bodies through the shared content cache. Principles, Learning and
  Systems are pages, not places: opening one displays its body and highlights referenced
  techniques without starting or seating a roll.

## Static shell, authentication and navigation

There is one game front-end: Neural. Quartz remains the static-site generator and provides
articles, `<head>` metadata, JSON-LD, search and navigation. The retired legacy game UI is not
an alternate mode; `?variant=legacy` is accepted but ignored.

The shared layout registers `AuthUI`, `Search`, `NeuralMount` and `SnapshotButton` after the
body. Article title and metadata appear before content, optional breadcrumbs depend on
`SHOW_BREADCRUMBS`, and the side columns register `CategoryNav` and `TableOfContents`.
Component registration controls which component resources are bundled.

`NeuralMount` registers [variant.inline.ts](../source/quartz/components/scripts/variant.inline.ts).
It loads the bundle once, mounts on full and SPA navigation, and registers teardown before the
next body replacement. The static article is hidden by a client-side attribute while the app
owns the screen. No-JS visitors can read the article; a missing bundle or synchronous mount
failure removes that hiding rule. This is not a guarantee that every later runtime failure
recovers automatically.

`AuthUI` renders no interface, but its
[authUI.inline.ts](../source/quartz/components/scripts/authUI.inline.ts) imports the Supabase
module that installs `window.__bjjAuth` and completes OAuth redirect handling. Neural uses that
facade for its own sign-in interface and cloud progress. Removing the apparently empty
component breaks those responsibilities. `CategoryNav` remains the persistent navigation on
the static surface; article-only SEO checks do not prove its usability.

Analytics and auth configuration are environment-backed in `quartz.config.ts`. Keep private
account links and credentials out of public documentation. Built analytics injection has a
separate configured-key check and a keyless fixture check; see [SEO.md](SEO.md).

## Learning, challenges and persistence

The pane is manually controlled with **Explore**, **Challenges** and **Last rolls** tabs.
`history` remains the internal id for Last rolls. Opening the pane pauses play; closing it only
releases the pause the pane itself took. The roll loop does not automatically open it.
Game Knowledge is a modeled, weighted recall score. Challenge tracks organize learning
objectives and content difficulty; neither is a real-world rank credential or a lock on other
tracks. Rewards appear inside Challenges, not in a separate Collection tab.

| Source module | Responsibility |
| --- | --- |
| `neural/src/challenge-definitions.src.js` | Declarative objectives, tracks, badges and coins |
| `neural/src/challenge-engine.src.js` | Event matching, progress, rewards, migration and merging |
| `neural/src/challenge-ui.src.js` | Pane composition and track/lesson navigation |
| `neural/src/challenge-feedback.src.js` | Challenge feedback and reward presentation |
| `templates/curriculum.json`, `scripts/_curriculum.py` | Authored curriculum and build-side validation/resolution |
| `neural/src/lists.src.js`, `lists-codec.src.js` | List storage, site membership and share encoding |
| `neural/src/flow.src.js` | Role-sensitive learning-priority model |

Gameplay `fx()` beats feed challenge matching; snapshot reconciliation credits persisted
lesson, checkpoint and recall evidence without replaying old celebrations. Tracks remain
selectable, while checkpoints and optional capstones have their own evidence prerequisites.
Patches and Mat Coins record achievements; coins are collectibles, not a spendable currency.

The v2 progress blob includes settings, study/recall evidence, schedules, challenge progress,
collectibles, lists and FLOW counters. `_progressBlob`, `_saveProgress`, `_pullAndMerge` and
`_pushCloud` in `app.src.jsx` own persistence. Guest progress is local; authenticated progress
can reconcile with Supabase. A device pulls before its first cloud push. Failed sync retains
local state, with later saves/auth activity providing another opportunity to sync.

Merge rules differ by field:

| Data | Merge rule |
| --- | --- |
| Challenge progress/completion | Maximum progress and logical OR completion |
| Badges, coins and explored-state evidence | Union |
| Recall/stage evidence | Per-key maximum |
| Settings | Per-key timestamp last-write-wins; no deletion tombstone |
| Lists | Add-wins union, including items; a stale device can restore a deletion |
| FLOW counts | Per-device counters merged by maximum, summed when read |
| SRS schedules | Later review date wins; same-day ties prefer the smaller interval, with a successful winner retaining a larger prior interval where applicable |

A retired settings key should stop being read rather than be repeatedly deleted and restored
by sync. Legacy tutorial evidence is migrated by `ngMigrateWhiteChallenges`; its compatibility
fields do not imply that the old Tutorial or content-lock UI still exists. Detailed behavior is
in [Neural.md](Neural.md).

## Gameplay audio

[sound.src.js](../neural/src/sound.src.js) owns both `NGSound` and `NG_SOUND_CATALOG`.
It synthesizes cues with Web Audio rather than downloading sound files. Gameplay beats select
contextual patches; unmapped beats remain silent. Settings `sound` and `soundVolume` are part
of normal progress persistence.

The audio context is created on a pointer or keyboard gesture and stopped during teardown.
A compressor, beat deduplication and rate/concurrency limits control output. Major cues are
exempt from the ordinary active-patch cap and spacing rule, so these are not absolute voice
limits or a hearing-safety guarantee. Missing Web Audio does not block gameplay.

Test mode creates no `AudioContext` and records selected cues in `soundLog`. Production
variation uses the app's `rng("sfx")`. There is no second legacy Quartz audio engine.

## Forward development catalog

Forward is a standalone, no-auth design catalog under `forward/`. It does **not** boot the
production game. Its screens are fixtures and renderers, not proof that every depicted surface
still exists or behaves identically in Neural.

- `/dev/` indexes the catalog.
- `/dev/components/` lists primitives and composed components with variants.
- `/dev/screens/` assembles deterministic screen states.
- `/dev/use-cases/` presents timestamped interaction and motion frames.
- `/dev/user-journeys/` composes those frames into chapters.
- `/dev/sounds/` previews the production audio engine and cue catalog separately.

`forward/shared/component-registry.js`, `screen-registry.js` and `sequence-registry.js` own
catalog definitions. Shared renderers, fixtures, design tokens and hash-based controls provide
entity/role, viewport and timeline selection. The build derives the entity inventory from
`graph.json` and copies base styles from `helmet.html`; these shared inputs do not make the
renderers a second implementation of the game contract.

[build_forward_components.mjs](../scripts/build_forward_components.mjs) checks IDs, required
provenance metadata and referenced source files, writes `shared/entities.json`, and copies the
production audio source/catalog. `runtime` and `output-only` provenance labels distinguish
intended runtime surfaces from article projections, but do not enforce behavioral parity.
`validate:forward` checks fixture rendering and frame contracts, not equivalence with Neural.

`npm run build:forward` replaces `source/public/dev/`. It runs after Quartz because Quartz
clears the output directory. Both deploy workflows invoke it explicitly.

## Build and deployment commands

[package.json](../package.json) is the command source of truth. From the repository root:

```bash
# Install Node dependencies, Chromium and generate the Neural bundle/data.
# Python and its required packages must already be available.
npm run bootstrap

# Build the static site from current Markdown and generated static assets, then serve it.
npm run build
npm run serve

# After editing only Neural source, refresh the bundle served by the existing site.
npm run dev:neural:app

# Refresh both the Neural bundle and data in the existing served site.
npm run dev:neural
```

`npm run build` does **not** rebuild the Neural bundle or regenerate authored content.
It builds Quartz, generates redirects/headers and crawler text, builds Forward and the share
shell, checks the payload budget, stamps configured affiliate references and publishes agent
discovery/Markdown exports. `npm run dev` is build followed by serve.

The full content chain is:

```text
regenerate:issues -> regenerate:json -> regenerate:explode -> migrate:ruleset
  -> validate:graph -> regenerate:md -> regenerate:hubs -> regenerate:votes
  -> regenerate:graph -> regenerate:explorer -> regenerate:neural
```

`npm run regenerate:build` runs that chain and then the site build. The `regenerate:json` step
can invoke a paid model to rewrite content; it is not a harmless validation command.
`regenerate:json:fast` removes its inter-request interval, not the model work.

`npm run regenerate:graph` is an umbrella:

```text
graph-base -> graph-layout -> ordinals -> graph-strength
```

Running only `regenerate:graph-base` does not preserve strength enrichment. Layout generation
needs its Python/ML dependencies. A partial chain must include every step that mutates the
artifact it intends to publish.

### Delivery boundaries

- [deploy.yaml](../.github/workflows/deploy.yaml) publishes `main` to production;
  [deploy-dev.yaml](../.github/workflows/deploy-dev.yaml) publishes `dev` to the preview.
  Both regenerate Neural assets, build Quartz, run their listed content/surface gates and the
  curated journey suite, then deploy `source/public` to Cloudflare Pages.
- Deploy workflows invoke build steps explicitly rather than calling root `npm run build`.
  Add a new emitted artifact to both workflows as well as the local command.
- [e2e-full.yml](../.github/workflows/e2e-full.yml) builds one site and runs the complete core
  suite in four shards on PRs targeting `main` or `dev`, on its weekly schedule, and manually.
- [ci-validate.yml](../.github/workflows/ci-validate.yml) provides path-filtered PR checks and
  checks on pushes to `dev`. It regenerates Neural data for data-dependent checks but does not
  build the complete Quartz site. Its checks are not interchangeable with deployment checks.
- [votes-refresh.yml](../.github/workflows/votes-refresh.yml) deliberately runs graph-base and
  graph-strength without layout/ordinal regeneration. Its dependency setup and staged artifacts
  support that narrower update, not the whole graph umbrella.
- [build_share_shell.mjs](../scripts/build_share_shell.mjs) emits the `/l` shell and manifest;
  Cloudflare Pages Functions under `functions/` provide share previews.
- [regenerate_agent_discovery.py](../scripts/regenerate_agent_discovery.py) runs after the build
  and affiliate stamping. It exports discovery files and Markdown from sitemap-listed,
  indexable built articles, not private account data or the raw source corpus.

No fixed page counts, bundle sizes or build timings are promised here. The emitted artifacts,
budget files and actual command output provide the current measurements.

## Checks and their limits

These are available commands, not a claim that every workflow runs every check:

| Command | Scope |
| --- | --- |
| `npm run validate:json` | Authored JSON against schemas |
| `npm run validate:graph` | Content references, probability sums, graph/rate coherence and other named integrity findings |
| `npm run validate:ordinals` | Persistent share identity mapping |
| `npm run validate:seats` | Role-appropriate authored deck content |
| `npm run validate:availability` / `validate:surfaces` | Derived ruleset availability and consumers of that mask |
| `npm run validate:score-coverage:gate` | Score coverage of attemptable techniques in a frame |
| `npm run validate:flow` | FLOW numerical self-check and content ratchet |
| `npm run validate:curriculum` / `validate:mc` | Curriculum integrity and multiple-choice viability |
| `npm run validate:schema` / `validate:seo` | Schema-markup parsing and built crawlable-surface checks |
| `npm run validate:headers` / `validate:payload` | Emitted headers and payload budgets |
| `npm run validate:affiliate` | Disclosure and verified-link surface rules |
| `npm run validate:analytics` / `validate:analytics:nokey` | Built analytics injection and the independent keyless fixture |
| `npm run validate:forward` | Catalog fixture rendering |
| `npm run test:units` | Root Node unit suites |
| `npm test` / `npm run test:curated` | Core browser journeys / deployment subset |

Read a check's severity and inputs before claiming enforcement. For example, the graph audit's
`from_position_role_mismatch` is a warning, and the JSON schemas accept shapes broader than the
recommended authoring contract. The Neural emitter's `_join_report` reports certain content
join findings without failing unless `BJJ_JOIN_STRICT=1` is set. A successful command therefore
does not imply that every reference, join or BJJ assertion has been validated.

The static article, live game and Forward mocks need separate review. Schema and graph gates
cannot validate practitioner mechanics or safety, and browser journeys cannot establish that
the model's probabilities predict a real roll.

Further reading: [Content.md](Content.md), [Neural.md](Neural.md), [SEO.md](SEO.md),
[Quartz documentation](https://quartz.jzhao.xyz/), [live site](https://bjjgraph.org).
