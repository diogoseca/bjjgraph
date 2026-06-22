# Alias / sameAs Audit — Chunk: `transitions-other`

Slice: remaining canonical **Transitions** (escapes, reversals, entries, controls) NOT covered by the
passes / sweeps / takedowns slices. Read-only audit (plan §B). Canonical technique only — position-specific
`X from Y` / `X to Z` duplicate transition nodes are skipped because they inherit the parent technique
identity.

## Method

1. Globbed all 1037 `content/Transitions/*.json`.
2. Confirmed **none** of the Transitions files currently carry `aliases` / `family` / `disambiguations`
   (so every real synonym here is a GAP, not a duplicate).
3. Filtered out:
   - position-specific duplicates (name contains ` from ` / ` to `),
   - other slices (`Pass`, `Sweep`, `Takedown`, `Throw`, `Guard Pull`, and the named Japanese throws
     `Osoto Gari`, `Uchi Mata`, `Tomoe Nage`, etc.),
   - names that DUPLICATE a canonical `Submissions/` page (Anaconda Choke, Darce Choke, Guillotine Choke,
     Gogoplata, Heel Hook, Kneebar, North-South Choke, Clock Choke, Arm Triangle, Estima Lock, Aoki Lock,
     Inverted Triangle, Outside Heel Hook) — the **Submissions** slice owns canonical alias modeling for
     those; the Transitions copies inherit identity,
   - names that DUPLICATE a canonical `Positions/` page (Dogfight Position, Gift Wrap, Knee on Belly).
4. Left **207** transitions-only candidates. Text-mined every overview for `also known as / also called /
   referred to as / aka`. Only **3** files surface documented synonyms; the remaining ~204 are descriptive
   process names (e.g. "Frame and Turn", "Consolidate Mount", "Complete Triangle Escape") with no real
   synonym.
5. Cross-checked every proposal against `tests/artifacts/do_not_merge.json` so no denylisted false-synonym
   is proposed as an alias.

## Headline findings

- **`Bridge and Roll` and `Upa Escape` are two files for the exact same technique.** Both are
  `from_position: Mount/Bottom`, both overviews say "also known as the Upa Escape / Bridge and Roll / Trap
  and Roll". This is a **variant-mismatch** (true synonym left as a separate page → should merge) plus an
  alias gap. `Trap and Roll`, `Hip Escape`, `Elbow Escape` exist only as scattered position-specific
  transition files (`Trap and Roll from Mount.json`, `Hip Escape Mechanics.json`, `Elbow Escape from
  Mount.json`, …) — there is no canonical home page for those terms; they hang off these two files.
- **`Shrimp Escape`** overview: "also known as the hip escape". Alias gap (`Hip Escape`, `Shrimping`;
  `Elbow Escape` at medium confidence — Elbow Escape is the mount-specific shrimping escape).
- **`Straight Footlock`** is the *finish* of the straight ankle lock. Its naming cluster (Ankle Lock /
  Straight Ankle Lock / Achilles Lock) is on the do-not-merge denylist, so it is deliberately NOT aliased.
  Flagged below for human review rather than asserting any relationship.
- **sameAs:** transitions-only sub-techniques in this slice (Arm Drag, Berimbolo Entry, Whizzer, etc.) do
  **not** have dedicated English Wikipedia articles (spot-checked Arm Drag → only Fandom/pro-wrestling;
  Berimbolo → BJJ-Heroes/blogs, no Wikipedia technique page). The well-known techniques that DO have
  Wikipedia/Wikidata entries (Heel Hook, Triangle, etc.) are owned by the Submissions/Positions slices. No
  high-confidence sameAs proposals from this slice; one low-confidence note recorded for Berimbolo.

---

## Per-technique table

| Canonical | File | Existing aliases | Proposal | Items | Confidence | Notes |
|---|---|---|---|---|---|---|
| Bridge and Roll | `content/Transitions/Bridge and Roll.json` | — | alias | Upa Escape; Upa; Trap and Roll | high | Overview self-documents the synonyms. Same `from_position: Mount/Bottom` as Upa Escape. |
| Bridge and Roll ↔ Upa Escape | `content/Transitions/Upa Escape.json` | — | variant-mismatch | Bridge and Roll | high | Duplicate pages for one technique → merge (keep one canonical, alias the other). Canonical pick: see below. |
| Shrimp Escape | `content/Transitions/Shrimp Escape.json` | — | alias | Hip Escape; Shrimping; Elbow Escape | medium | "also known as the hip escape" stated. `Elbow Escape` = mount-specific shrimp escape → medium. |
| Technical Stand-up | `content/Transitions/Technical Stand-up.json` | — | alias | Technical Get-up; Technical Standup; Tactical Standup | medium | Common spelling/term variants; domain knowledge (not in overview). |
| Kiss of the Dragon | `content/Transitions/Kiss of the Dragon.json` | — | alias | KOD | low | Abbreviation only; jargon. Skip if aliases are reserved for true name variants. |
| Straight Footlock | `content/Transitions/Straight Footlock.json` | — | variant-mismatch | Straight Ankle Lock | low | Likely the same finish as Straight Ankle Lock, BUT that naming cluster is denylisted (Ankle Lock / Straight Ankle Lock / Achilles Lock). Do NOT auto-alias — escalate for human review. |
| Berimbolo Entry | `content/Transitions/Berimbolo Entry.json` | — | sameAs | — (no dedicated Wikipedia article found) | low | Berimbolo is notable but has no standalone EN Wikipedia page (BJJ-Heroes/blogs only). No reliable sameAs. Listed for completeness; recommend NOT applying. |

### Candidate pool that yielded NO proposal (descriptive / no real synonym)

The other ~200 transitions-only candidates are descriptive process names with no documented or
domain-known synonym, e.g.: Frame and Turn, Frame and Distance Creation, Consolidate Mount, Mount Control,
Back Control Maintenance, Complete Triangle Escape, Posture Recovery, Half Guard Recovery, Inside Position
Recovery, Standing Escape, Standing up in Base, Stand Up in Closed Guard, Float Passing, Knee Through,
Crucifix Transition/Maintenance, Truck Entry/Maintenance, Twister Entry, Gift Wrap Control/Maintenance,
Baratoplata/Tarikoplata/Peruvian Necktie/Japanese Necktie Setup, etc. No action.

### Denylist guard (verified — none proposed as aliases)

`Mount/Reverse Mount`, `Ankle Lock/Achilles Lock`, `Straight Ankle Lock/Achilles Lock`,
`Ankle Lock/Straight Ankle Lock`, `Half Guard/Half Mount`, `Turtle/Crackhead Control`,
`D'Arce/Anaconda`, `Toe Hold/Heel Hook`, `Kimura/Americana`, `North-South/North-South Choke`,
`Inside/Outside Heel Hook`, `Side Control/Shoulder of Justice`, `Bow and Arrow/Loop Choke`.

---

## Canonical-name recommendation for the Bridge and Roll / Upa merge

Per `docs/Synonyms.md` §3: when one name is English and the other is Portuguese, default to English as
canonical for SEO breadth and keep the non-English name as a top-priority alias — UNLESS the non-English
name has higher search volume. "Bridge and Roll" (and the equivalent "Trap and Roll") is the higher-volume
English term taught in virtually every fundamentals curriculum; "Upa" is the Portuguese gym term. Therefore
recommend **`Bridge and Roll` as canonical**, with `Upa Escape`, `Upa`, `Trap and Roll` as aliases, and
the `Upa Escape.json` file collapsed (filename preserved → noindex alias page + 301). Final volume call to
be confirmed with GSC in §0.6 before the merge is executed in §B-apply.

## sameAs summary

No high/medium-confidence sameAs from this slice. The dedicated-Wikipedia techniques (Heel Hook, Triangle,
etc.) live in the Submissions/Positions slices, not here. Recorded one low-confidence non-proposal
(Berimbolo Entry) to document that it was checked and rejected.
