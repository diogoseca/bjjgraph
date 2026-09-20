# BJJGraph Content Standards

These standards cover authored content, its generated pages, and the estimates used by the graph.
Schema requirements and automated checks are identified separately from editorial guidance.
A valid file is not necessarily an accurate account of Brazilian Jiu-Jitsu.

## States, Roles, and Review

**State** is the umbrella term:

- **Position:** a relatively stable configuration of the players. Stable does not mean motionless,
  effortless, or free of opposing forces. Maintaining a position requires active adjustments.
- **Transition:** a transient state involving motion, forces, and players actively attempting to
  change the state. It is not merely an edge between two positions.
- **Submission:** a transient attacking state with a possible terminal finish. A defended or failed
  attempt can continue into another state; entering a submission does not guarantee `game-over`.

Author the configuration, actions, roles, and possible outcomes explicitly. The conceptual model
is not a promise that the UI pauses at every transient state.

The graph's navigable role nodes are distinct from its edgeless reference hubs and from the visual
projection used by the app. Top/Bottom describe position roles; Attacker/Defender describe roles in
an attempted technique. A position family can have its own role states as well as a reference hub.
A submission family hub summarizes variants rather than representing an attempt from one origin.
Systems, Principles, and Learning entries are reference material, not additional places in a roll.
See [Architecture](Architecture.md) for the data representations and [Neural](Neural.md) for UI behavior.

### Practitioner Review

Probabilities are authored and calibrated **modeled estimates**, checked for specific structural
and arithmetic properties by validators. They are not match statistics or expert-validated truth,
and remain open to correction.

A panel of black-belt BJJ practitioners should review:

- State boundaries, including whether an entry describes a position, transition, or submission.
- Which player can perform an action, its canonical origin, and the roles at each outcome target.
- Gi/no-gi equipment requirements and competition-rule, age, and skill restrictions.
- Attempt and outcome estimates, their assumptions, and plausible failures and counters.
- Body mechanics, instructional clarity, training progressions, and safety guidance.

This is needed review, not a claim that such a panel has validated the corpus. Schema gates,
graph checks, community votes, and AI-assisted enrichment or calibration cannot substitute for it.
Record the evidence and scope of any actual review rather than inferring approval from a passing gate.

## Content Workflow

### Edit JSON First

1. Edit the source JSON under `content/`, including nested variants, using the applicable schema.
2. Run the focused checks below and read their warnings as well as their exit status.
3. Regenerate the affected outputs, inspect the resulting pages, and build before shipping content.

Do not edit a generated `.md` that has a JSON source. Edit its JSON for data or its Jinja template
for layout. Some standalone Markdown pages, such as `content/Game Over.md`, are not JSON-generated.

### Checks and Generation Are Different

```bash
# Local checks; these do not invoke the AI content rewrite.
npm run validate:json
python3 scripts/validate_json.py --all --strict --strict-ruleset
npm run validate:graph

# Render authored JSON into Markdown without AI enrichment.
npm run regenerate:md

# Full content pipeline and site build; may invoke paid AI and change source JSON.
npm run regenerate:build

# Build and serve, or serve an existing build.
npm run dev
npm run serve
```

`validate:graph` reads authored content **and the existing generated `graph.json` and vote store**.
It does not regenerate a stale graph. `regenerate:md` only updates Markdown, not graph or app data.
Use `npm run regenerate:graph` for the graph pipeline, including layout, ordinals, and strength;
`npm run regenerate:neural` rebuilds the app bundle and its payload. These are generation commands,
not read-only checks. The broader dependency order is documented in [Architecture](Architecture.md).

`npm run regenerate` includes issue discovery, `regenerate:json`, connection expansion, ruleset
migration, graph validation, Markdown and category hubs, votes, graph generation, explorer, and
Neural output. `regenerate:json` can call Claude; `npm run regenerate:json -- --interval 0` removes its inter-file
wait and is **not** an AI-free validation shortcut. `regenerate:build` runs that chain and then
builds the site. `npm run dev` builds and serves but does not run the content regeneration chain.

## Probabilities and Published Rates

### Source Contract

Author technique `success_rate`, outcome `probability`, and position-choice `attempt_probability`
as two-key `{gi, nogi}` maps. Each non-null cell is an integer from 0 to 100.
The schemas retain legacy scalar alternatives; `--strict-ruleset` adds stricter migration checks.
Do not use the obsolete Beginner/Intermediate/Advanced success-rate format.

- `null` means the edge or rate does not exist in that ruleset.
- `0` means it exists but has zero modeled probability. It is not an equipment-exclusion marker.
- For each position role, non-null attempt cells sum to 100 in each present ruleset frame.
- For each transition or submission attempt, non-null outcome cells sum to 100 in each present frame.
- If every cell of a frame is null, that frame is absent and its sum check is explicitly skipped.
  An entire nonempty distribution absent in both frames is an error, as is a success rate absent
  in both frames. A bare `null` is not a replacement for a map.
- Keep an authored success rate coherent with the total of its `success` outcomes. Do not describe
  this editorial requirement as a source-level equality gate: the graph coherence check compares
  the **emitted scalar** headline with emitted success outcomes, with a tolerance of one point.

Position metrics have their own schema, often `{value, description}` objects. Do not convert every
numeric field to a ruleset map indiscriminately. Point values, duration, and vote counts are not odds.

This is a **partial excerpt**, not a complete schema-valid document, from
`content/Transitions/100% Sweep.json`. The name is not a claim of guaranteed success:

```json
{
  "from_position": "Closed Guard/Bottom",
  "success_rate": { "gi": 50, "nogi": 50 },
  "outcomes": [
    { "to": "Mount/Top", "probability": { "gi": 50, "nogi": 50 }, "result": "success" },
    { "to": "Closed Guard/Bottom", "probability": { "gi": 35, "nogi": 35 }, "result": "failure" },
    { "to": "Side Control/Bottom", "probability": { "gi": 15, "nogi": 15 }, "result": "counter" }
  ]
}
```

### Authored Values Are Not Always Published Values

`scripts/apply_calibration.py` writes eligible success-rate **priors** to `templates/votes.json`.
It does not write content outcome distributions, attempt probabilities, or community vote totals.
Proposals not flagged for human review can apply automatically; flagged proposals need a review
entry or override. These flags and provenance fields do not establish black-belt panel approval.

Calibration inputs live in [`calibration/`](../calibration/): `external_anchors.json`
supplies reference estimates, `overrides.json` holds explicit corrections, and `reviewed.json`
lists reviewed techniques. `occurrence_calibration.json` records move-attempt distributions and
their provenance; the occurrence application and validation scripts read it. Keep these four
files tracked. Cases, results, partial results, proposals and `occurrence_preview.md` are local,
ignored outputs in the same directory; moving them does not change published rates.
Use `python3 scripts/apply_calibration.py --dry-run` to inspect an existing proposal run without
changing `templates/votes.json`. Eliciting a new run can invoke paid model calls.

For each ruleset, `folded_rate` in `scripts/_votes.py` blends a usable prior with the community rate,
weighted by the prior's pseudo-count and `max(0, vote_count - 30)`. Thirty is the seed count, not
thirty observed votes. With no votes above the seed, a usable prior determines the rate. Without a
usable prior, the community rate is returned. Do not call every seeded rate real community evidence.

The graph emitter overrides matched technique role-node headlines with those folded rates.
`successRate` is the rounded no-gi scalar; matched entries also carry `successRateByRuleset`.
Defender rates complement attacker rates. Scalar outcome distributions are rescaled to the new
headline, preserving proportions within success and non-success groups before integer rounding;
absent rates or outcome cells cause that rescale to be skipped and counted.

The Markdown renderer also uses folded no-gi rates for technique headlines, falling back to authored
rates when no usable vote entry is found. It preserves a source-marked absent frame instead of
printing a percentage for it. Its outcome table still comes from the authored distribution, not
the graph's rescaled one. Therefore do not promise that source JSON, every page table, and game odds
are identical. Inspect both the source and emitted representation when investigating a discrepancy.

## Wikilinks and References

Use category-prefixed paths in authored wikilinks:

```markdown
[[Positions/Mount]]
[[Transitions/Knee Slice Pass]]
[[Submissions/Rear Naked Choke]]
```

Match the actual path and filename case, including nested variant directories. Omit `.md`.
Verify the target exists before adding a link. `[[game-over]]` is the special bare alias defined
by `content/Game Over.md`.

Structured JSON references are a different contract. Fields such as `transition`, `from_position`,
and `outcomes[].to` use technique names or role-qualified names as their schema requires; do not
wrap them all in wikilink syntax. Generated templates resolve these references into page links.

`validate:json` checks configured structured reference fields, with alias and name-normalization
fallbacks. It is **not a scan of every wikilink in arbitrary prose or generated Markdown**. Many
reference findings are non-blocking by default; `--strict` treats those findings as failures.
A clean schema check does not prove that all published links resolve.

### Attribution and External Sources

Use sources that support the specific mechanic or claim, and distinguish an instructor's approach
from a universal rule. Do not invent citations, video IDs, product links, or claimed endorsements.
Summarize in your own words and retain attribution.

Use the fields the selected schema supports. Learning has optional `references` entries with
required `title` and `author`. `sameAs`, where supported, identifies the **same entity** on an
authoritative external site; it is not a general bibliography. Film-study provenance belongs in
`clips`. An external URL or a source's reputation alone does not validate probabilities or safety.

## Required Authored Content

The JSON schema selected for the file is authoritative for field types, required keys, and array
bounds. A schema's descriptive prose can be more aspirational than its actual constraints.
Do not copy a different content type's section list as if it were interchangeable.

### Answer-First Summary

All schema-backed content types require a root `summary`, with a schema length of 30–300 characters
(Principles cap it at 260).
Editorially, write one self-contained definition sentence, roughly 15–40 words. Avoid promotional
claims and keep it distinct from `overview`, which should supply context rather than repeat it.
Templates render summaries as bold leads and emit `DefinedTerm` JSON-LD on canonical hub/single pages.
There is no guarantee that a search or answer engine will quote them.

### Positions

DUAL and FAMILY positions author separate `top` and `bottom` objects. SINGLE positions put their
instructional fields at the root. A SINGLE authoring shape does not mean that every neutral
configuration in the current corpus uses it.

| Content | Required fields or guidance |
|---|---|
| Identity and overview | Root summary and overview; DUAL/FAMILY role names, descriptions, tags, and overviews are authored, not generated prose |
| State properties | `point_value`, `position_type`, `risk_level`, `energy_cost`, `time_sustainability` |
| Configuration and entry | `state_invariants` with anatomical detail, plus `prerequisites` |
| Instruction | `key_principles`, `decision_tree`, `common_errors`, `training_drills` |
| Choices | `transitions[]` entries with `transition` and `attempt_probability` |
| Related material and metrics | Role `related_content` and `position_metrics`; root related fields vary by template |
| Variants | FAMILY adds `variations`; use the real variant names and slugs |

There is no universal schema requirement for a separate “Visual Description” section or four
transitions per role. Describe body configuration in the overview and invariants. DUAL/SINGLE
schemas specify 5–7 key principles, at least three decision-tree entries, five common errors, and
three drills. FAMILY has its own root and role requirements; consult it rather than imposing one
uniform count across all positions.

A position's choice list can reference a transition or a submission attempt. Match the technique's
canonical origin and performing role. Do not add a technically invalid move to satisfy a list size.

### Transitions and Submission Attempts

DUAL techniques generate a hub page and Attacker/Defender pages from **authored** role content.
Templates arrange that content; they do not invent the defender's explanation.

| Authored role field | Attacker | Defender |
|---|---|---|
| Identity | `name`, `description`, `overview` | `name`, `description`, `overview` |
| Key principles | 5–7 | 5–7 |
| Entry or recognition | At least 4 `setup_requirements` | At least 3 `recognition_cues` |
| Execution or response | At least 6 `execution_steps`, each with step number, action, description | At least 3 `defensive_options` |
| Counters and outcomes | At least 3 `common_counters` | At least 1 `favorable_outcomes` entry |
| Errors | At least 5, with consequence and correction | At least 3, with consequence and correction |
| Training | At least 4 `training_progressions` | At least 3 `training_progressions` |
| Assessment | At least 5 `flashcards` | At least 3 `flashcards` |

Transition attackers additionally require a `safety_considerations` string. Submission attempts
instead require the shared root safety object, and their defender requires at least two
`escape_paths`. Submission execution steps may include `timing`; submission flashcards may carry
`safety_critical: true`. “Knowledge Assessment” is a rendered section label, not a replacement
for the technique schema's `flashcards` key.

Technique roots require summary, overview, description, tags, success rate, outcomes, related
content, and both role objects. Transition roots require `from_position`. Submission DUAL also
requires classification, target anatomy, `starting_position`, `from_positions`, and related
submissions. Its schema does not require `from_position`, but a navigable attempt should still
have one unambiguous role-qualified canonical origin. Broader reading lists are not extra origins.

Submission FAMILY records require `is_family` and variant/reference metadata with shared safety
content. They generate one family page, not Attacker/Defender pages. They do not require `outcomes`
and must not be treated as navigable submission attempts.

### Outcomes and Instructional Targets

For an attempt, author a useful distribution of success, failure, and counter possibilities.
Prefer 3–5 meaningful outcomes when the technique supports them; the DUAL schemas enforce a
minimum of **two**, not a universal 3–5 range.

- `success`: the attempt achieves its intended result, which need not be a terminal finish.
- `failure`: the attempt fails, possibly retaining or losing the starting configuration.
- `counter`: the opponent successfully counters the attempt.

Use a role-qualified position target, a real non-family submission attempt, or `game-over` as
appropriate to the model. Do not target bare position hubs or submission family hubs. Only
submission finishes should reach `game-over`; a transition that directly finishes is misclassified.
Returning to the origin position after an unsuccessful technique is legitimate; targeting the
technique's own node is not. These are modeling requirements, not a claim that every one is
exhaustively checked by the JSON validator.

| Instructional reference | Contract |
|---|---|
| `attacker.common_counters[].targets_outcome` | Optional in the schema; when present, use an authored outcome target |
| `defender.defensive_options[].targets_outcome` | Required by the DUAL schemas |
| `defender.favorable_outcomes[].outcome` | Required by the DUAL schemas |

These fields must match a value in `outcomes[].to` exactly. The semantic check tests set membership,
not whether precisely one row has that target, and it does not verify that the described defense
can actually produce it. `validate:json` reports mismatches as non-blocking unless `--strict` is
used; `validate:graph` also checks them. Some placeholder values are skipped by the implementation.
That is not permission to publish placeholders.

### Systems, Principles, and Learning

- **Systems:** follow `templates/Systems.json`. Keep identity and graph membership stable.
  `guide.display_title` is editorial; write one substantive overview of advertised instruction,
  fit and scope from inspected primary evidence. Listings do not establish technical mechanics.
  No invented exercises, study tasks, mastery claims or `guide.start_here`; do not move retired
  tasks into prose. No length quotas or repetitive legacy scaffolding. Summary stays useful for
  search and is not repeated above the overview. Never invent review credentials or endorsement.
  Optional `guide.alternatives` entries are `{system,reason}`: exact existing System name and a
  specific reason, including same-course/topic comparisons when useful. Emission resolves real
  internal `{system,reason,url,title}` entries in rich dossiers only; unknown names fail.
  `audience.consider_alternative_if` may be empty; named comparisons belong in alternatives.
  Source-free topic guides require root review; never fabricate evidence to fill them.
  Preserve source IDs, URLs and verification dates unless actually rechecked; report corrections.
  Optional previews use exact allowlisted official YouTube/Bunny URLs and mount inline with muted
  autoplay and visible player controls. Compact preview metadata in the Systems index allows immediate
  mounting while the full guide loads. `playback_verified_on` records actual playback checks; it does
  not gate playback by the visitor's origin. Browser-blocked autoplay leaves normal player controls.
  A page 200 never proves playback or instruction review. Unreviewed notes belong quietly in Sources.
  Static/app order: title and distinct pills/count, official preview, actual course/instructor CTA,
  overview, audience, coverage, final CTA, related guides/cards, compact Sources.
  Top/end CTAs share one primary product, with or without a preview. Related guide labels use the target editorial title; emitted `source_name` keeps stable
  identity and the URL stays unchanged. Related references
  include positions and are not proficiency evidence; render a shared qualifier, not one per node.
  Products use verified canonical `course_url` without tracking/query placeholders; only live
  links render. Every Systems BJJFanatics outbound source/blog/preview/course link is attributed at build
  time with valid `AFFILIATE_REF`; other hosts remain ordinary sources. Evidence URLs may retain
  nontracking query semantics. Rich BJJFanatics sources emit `canonical_url`, resolved `url` and
  boolean `affiliate`. Source Markdown stays neutral with course/source markers; built links get
  sponsored attributes without inline commission notices. Missing ref is neutral, invalid ref
  fails; rotation/removal recomputes canonical links and refreshes gzip/discovery copies. Never
  expose root `.env` values. Source and emitted gates run separately after the final resolver.
- **Principles:** author application and complexity levels, development timeline, component skills,
  relationships, application contexts, decision framework, errors, training approaches,
  developmental metrics, related content, root flashcards, and `graph_applicability`.
  Keep the reading sections concise: one definition sentence in `summary` (at most 260 characters),
  then 1–2 practical sentences in `overview` (40–320 characters). Skip origin stories, generic
  praise, and repeated definitions. Use 3–5 actionable key points, 3–5 distinct examples,
  3–4 mistakes with brief consequences and corrections, and 2–3 focused drills. Put the most
  useful entries first: the sidebar previews 3 points, 2 examples, 2 mistakes, and 1 drill,
  with independent disclosures for the rest. A drill needs setup, action, and a reset or stop
  condition; submission drills emphasize cooperative recognition and control without resisted
  joint or neck finishing pressure. The schema enforces section and entry length limits.
- **Learning:** author the category, key takeaways, BJJ applications, common mistakes, training
  exercises, `knowledge_assessment`, and related content. This type uses `knowledge_assessment`,
  unlike technique role decks. External `references` are optional.

## Flashcards

For Positions, Transitions, and Submissions, question strings are limited by schema to 100
characters, including spaces and punctuation. Ask one clear question in plain BJJ language.
Preserve the mechanic, player perspective, and safety conditions; put explanation in the answer.

```bash
# Corpus question-length audit
python3 scripts/rewrite_questions.py --check

# Resumable question-only AI rewrite; changes source and may incur costs
python3 scripts/rewrite_questions.py --apply
```

There is no universal 5–20-card bound. DUAL/SINGLE position role decks use 6–8 cards, technique roles
have the minima listed above, and Principles use 6–20; Systems have no minimum. FAMILY position role decks are not
required in the same way as DUAL role decks. Follow the selected schema and author useful questions,
not filler to reach a preferred count.

### Authored Tiers and Aggregation

- Author role-specific cards in `top`/`bottom` or `attacker`/`defender`.
- Position `flashcards_position` holds role-independent configuration knowledge.
- Position-family `flashcards_family` holds family-wide concepts and is inherited by variants.
  These are authored shared tiers, not a prohibition on all hub-level authoring.
- Standalone dual-position hubs aggregate role cards; position-family hubs use their authored
  family tier. Submission family hubs aggregate variant cards rather than authoring a separate deck.
- Principles and Systems author root flashcards.

The graph emitter deduplicates cards and carries position tiers separately. Preserve optional
curated `answer_line` and `distractors` fields when editing an existing card; the full answer is
still the explanatory detail.

The current Neural deck exporter reads Positions, Transitions and Submissions. Root flashcards
in Principles and Systems remain authored graph content but do not reach those playable decks;
`build_flashcards` in `scripts/regenerate_neural_data.py` reports the unaccounted cards. Their
schema requirement does not establish that the app delivers them.

### Question Focus by State Type

**Positions:** maintenance and escape, depending on role. Cover weight distribution, base, frames,
grips, pressure, common retention errors, opponent movement, and energy use. For example:
“How do you shut down the elbow escape from Mount?”

**Transitions:** timing and execution within a transient state. Cover entry conditions, force
direction, coordination, common failures, opponent responses, and follow-ups when blocked.
For example: “What is the most critical body movement in Scissor Sweep?”

**Submissions:** control, finishing mechanics, defensive recognition, and safe release. Cover target
anatomy, limits of control, failed attempts, escape opportunities, and injury risks. Do not teach a
universal “point of no escape” or encourage waiting for visible pain before releasing. For example:
“What must the attacker do when a partner taps during an Armbar?”

## Safety

All content should address material risks. Submission DUAL and FAMILY schemas require a shared
`safety_considerations` object with:

- At least two `injury_risks`, each with `injury`, `severity`, and `recovery_time`.
- `application_speed` guidance.
- At least three `tap_signals` and three `release_protocol` entries.
- At least two `training_restrictions`.

The fields' presence and counts are machine-checkable; medical accuracy and safe instruction are
not. Do not invent recovery guarantees to fill `recovery_time`. Explain uncertainty and avoid
presenting the field as individualized medical advice.

Keep warnings prominent and before execution instructions. Current submission templates place an
early safety callout after the summary and metadata, with full safety guidance later; “first visible
content” is not an accurate description of their output. Inspect the rendered page when changing
safety copy or templates.

Teach early tapping, recognition of verbal and physical stop signals, and immediate release when
a partner taps or calls stop. Stop on suspected injury or impaired responsiveness rather than
waiting for a formal tap. Training restrictions and progressions should fit the technique,
partners, ruleset, and qualified supervision. Do not prescribe a universal week-by-week escalation
schedule or imply that elapsed time makes a dangerous technique safe.

## Curation-Safe Regeneration

`scripts/regenerate_content_json.py` checks that enrichment has not dropped existing position
transition names, changed a technique's canonical `from_position`, or dropped existing outcome
targets. This protects selected structural fields, not every possible editorial invariant.

Curated Systems `products` (including canonical course URLs), root/role `clips`, and flashcard `answer_line`/`distractors` are excluded
from the AI response contract and restored on save. Position attempt probabilities are restored
from the original by transition name before normalization. Do not describe the current save path
as freely retuning those authored occurrence estimates. Probability groups are normalized per
present ruleset frame; normalization does not establish empirical accuracy.

Review the source changes even after these checks pass. A structurally preserved edge can still
have an incorrect explanation, inappropriate role, or unsafe instruction.

## Film-Study Clips

Curate clips for the exact technique and player role, prioritizing clear, attributable instruction.
The schema allows up to four clips per holder. Positions support root overview clips and role
clips; techniques support root fallback clips and Attacker/Defender clips; Principles and submission
family pages can carry root clips. Availability in a schema does not mean every category has an
automated sourcing slot.

Only `id` and `title` are schema-required. Optional fields are `by`, `start`, `end`, `vertical`,
`channel`, `duration`, `verified`, and `upload_date`. IDs must match the 11-character YouTube shape;
that regex does not establish that a video exists. Start/end are seconds. Provenance dates and
uploader metadata are not practitioner endorsements.

```bash
# AI-assisted planning/curation of real search results, verification, and application
npm run clips:source

# Network re-verification; refreshes verification metadata in source JSON
npm run clips:verify

# Also remove confirmed dead or embedding-disabled clips; transient errors are kept
npm run clips:verify -- --prune

# Generate the local review report
npm run clips:report
```

Sourcing uses yt-dlp search results, AI-assisted selection from those results, and machine video
checks. “Never AI-authored” here means never invent IDs or let general content enrichment replace
curated clips; it does not mean the sourcing pipeline has no AI step. The generated
`clips_sourcing/review.html` report supports human inspection. Delete unsuitable selections from
the content JSON and regenerate the report. Its principle coverage table includes empty pages,
missing Shorts, and sourcing review notes so gaps remain visible alongside the selected videos.

Principle sourcing prefers focused YouTube Shorts and supplements existing instructionals.
`python3 scripts/source_clips.py --category Principles --redo-principles` refreshes the searches;
new selections are deduplicated by video ID, ordered with Shorts first, and capped at four.
Keep at least one existing longer instructional when Shorts would otherwise fill all four slots.
An empty search or unsuccessful verification never removes existing selections. A short runtime
alone is not evidence of the portrait format. Principle sourcing also reads instructor Shorts
tabs because yt-dlp's ordinary search applies a Videos-only filter; `--shorts-channel HANDLE`
can override the default instructor handles (repeat the flag for multiple channels). Picks still
require relevance curation and oEmbed verification. Format comes from portrait-thumbnail checks
or official Shorts-tab URLs with portrait thumbnail dimensions. Re-verification retains the
known format when portrait thumbnails are missing or temporarily unavailable.

`validate:json` rejects inverted loop bounds but only warns about duplicate IDs and end times past
the recorded duration. Network availability checks belong to `verify_clips.py`; neither tool checks
whether the clip teaches the right mechanic safely. Watch the selected segment and confirm its
role, attribution, and safety before relying on it.

The app's dossier payload keeps player fields (`id`, `start`, `end`, `vertical`, `title`, `by`), not
provenance metadata. Position root clips supplement both role dossiers. Generated Markdown also
renders film-study embeds and video structured data. Prefer focused technique demonstrations;
longer concept instruction can be appropriate for Principles. Duration preferences are editorial
sourcing choices, not a universal schema-enforced policy.

## Generated Frontmatter and Validation Scope

Do not paste frontmatter boilerplate into generated pages. Jinja templates own page titles,
descriptions, role-specific presentation, and JSON-LD. For example, the DUAL position, transition,
and submission hub templates emit `title` and authored `description`; they do not emit the old
three-item `tags` frontmatter example. Required JSON tags and generated YAML fields are not the
same contract. Inspect the selected template when changing metadata.

| Check | What it establishes | What it does not establish |
|---|---|---|
| `validate:json` | JSON Schema requirements, probability sums and null handling, selected references and semantic checks | All prose wikilinks, safe mechanics, or expert agreement; default severity permits some findings |
| `validate:graph` | Content connectivity/reference audits, probability checks, emitted headline coherence and defender complements, vote/prior checks | A fresh graph, universal per-source rate equality, or complete BJJ correctness |
| `regenerate:md` | Schema-backed rendering and explicit render failures | Correct graph payloads or a built site |
| `clips:verify` | Current machine video checks and refreshed metadata | Instructional relevance, copyright permission, or safety review |

Read the named errors and warnings, fix the source or template responsible, then regenerate the
relevant outputs. Passing automation is evidence only for the conditions actually checked.

## Schema Reference

| Type | Schema |
|---|---|
| Position family | `templates/Positions/TEMPLATE-FAMILY.json` |
| Position dual role | `templates/Positions/TEMPLATE-DUAL.json` |
| Position single | `templates/Positions/TEMPLATE-SINGLE.json` |
| Transition | `templates/Transitions/TEMPLATE-DUAL.json` |
| Submission attempt | `templates/Submissions/TEMPLATE-DUAL.json` |
| Submission family reference hub | `templates/Submissions/TEMPLATE-FAMILY.json` |
| System | `templates/Systems.json` |
| Principle | `templates/Principles.json` |
| Learning | `templates/Learning.json` |

## Principle Graph Applicability

Principles describe both performing a mechanic and denying it. Author `graph_applicability`
separately from the short `related_content` reading list:

- `scope: "all"` covers every graph site, including future additions. Use it for a principle that
  can guide either participant across positions, transitions, and submissions.
- `scope: "specific"` combines reading-list links, exact submission `families`, reverse principle
  references, and reviewed `terms` in selected instructional fields. Terms match whole words or
  phrases without case sensitivity; flashcards, clips, and related-link fields are excluded.
  Choose mechanical phrases carefully rather than matching a broad anatomical word indiscriminately.
- Matching techniques also include their starting positions. Applicability does not spread to every
  neighboring technique. Family selectors include variants and fail generation when unresolved.
- `rationale` explains the scope. Dossiers carry term evidence for specific matches. These are
  editorial membership rules, not proof that a term must appear whenever a principle applies.
  Use explicit family or reading-list references for implicit examples.

The emitter stores universal membership as a flag and specific membership as a hexadecimal bitset
of permanent share ordinals, not graph array indexes. Inspect the resulting membership as well as
the prose: a successful term match can still be a poor technical match.
