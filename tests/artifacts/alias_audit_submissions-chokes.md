# Alias / sameAs Audit — Slice: submissions-chokes

Scope: CHOKE submissions under `content/Submissions/*.json` (top-level files only).
Method: read each file's `name`, `aliases`, `family`, `disambiguations`, `sameAs` plus `overview` text.
Constraints honored: `docs/Synonyms.md` (synonym vs variant vs false-synonym) and `tests/artifacts/do_not_merge.json`.

State of the slice: **every choke file currently has `aliases: null`, `family: null`, `disambiguations: null`, no `sameAs`.** So all alias work here is GAP-filling (no duplicate aliases to worry about). The schema (`templates/Submissions/TEMPLATE-DUAL.json`) supports `aliases`, `family`, `disambiguations` but NOT yet `sameAs` (sameAs field is pending task #44 — proposals below are collected for later application).

Denylist pairs relevant to this slice (NEVER aliased):
- D'Arce / Darce ↔ Anaconda Choke (false synonym)
- North-South ↔ North-South Choke (false synonym — position vs choke)
- Bow and Arrow Choke ↔ Loop Choke (false synonym)

---

## Per-technique findings

### Rear Naked Choke
| Field | Current | Proposed |
|---|---|---|
| aliases | null | Mata Leão, Mata Leao, Hadaka Jime, RNC, Sleeper Hold |
| sameAs | — | https://en.wikipedia.org/wiki/Rear_naked_choke ; Wikidata Q2143960 |
Rationale: textbook 3-language synonym set (Portuguese "Mata Leão" = lion killer, Japanese judo "Hadaka Jime"). Overview already uses "(RNC)". "Sleeper Hold" is the common English/MMA synonym (per `docs/Synonyms.md` §102). "Mata Leao" added as accent-free spelling hedge.

### Guillotine Choke
| Field | Current | Proposed |
|---|---|---|
| aliases | null | Mae Hadaka Jime, Guillotine |
| sameAs | — | https://en.wikipedia.org/wiki/Guillotine_choke ; Wikidata Q5614342 |
Rationale: Japanese judo name "Mae Hadaka Jime" (front naked strangle) per task brief. "Guillotine" bare form is a common short reference. NOTE: arm-in / high-elbow / ten-finger / chin-strap are VARIANTS (separate files) — not aliased here; candidate `family: "Guillotine"` flagged below.

### Triangle Choke
| Field | Current | Proposed |
|---|---|---|
| aliases | null | Sankaku Jime, Sankaku, Triangle |
| sameAs | — | https://en.wikipedia.org/wiki/Triangle_choke ; Wikidata Q1473270 |
Rationale: Japanese judo "Sankaku Jime" (triangle strangle) per task brief. "Sankaku" and "Triangle" are common short forms. NOTE: Inverted Triangle, Rear Triangle, Side Triangle are VARIANTS — not aliased; candidate `family: "Triangle Choke"` flagged below.

### Darce Choke
| Field | Current | Proposed |
|---|---|---|
| aliases | null | D'Arce Choke, D'Arce, Brabo Choke |
| sameAs | — | https://en.wikipedia.org/wiki/D%27Arce_choke ; Wikidata Q5203258 |
Rationale: filename `Darce Choke.json` is preserved; per `docs/Synonyms.md` §52/§100 the display name should be `"D'Arce Choke"` and `Brabo Choke` is the Portuguese-pronunciation synonym to be merged in. Because a separate `Brabo Choke.json` file currently exists, this is recorded as a **variant-mismatch** (merge action) below rather than a pure alias add — flagged so the apply step deletes the loser file and 301-redirects. NOT to be confused with Anaconda (denylisted).

### Brabo Choke  (variant-mismatch → merge into Darce)
| Field | Current | Proposed |
|---|---|---|
| status | standalone file | merge into `Darce Choke.json` as alias `Brabo Choke`; delete file + 301 |
Rationale: `docs/Synonyms.md` §8/§100 explicitly lists "D'Arce ↔ Brabo = Synonym → collapse into Darce Choke.json, alias Brabo Choke." The Brabo overview hedges ("some practitioners distinguish… subtle grip and angle differences") but the canonical project decision is SYNONYM. Confidence medium because the page hedges; apply step should confirm before deleting.

### Anaconda Choke
| Field | Current | Proposed |
|---|---|---|
| aliases | null | (none — no strict synonym) |
| sameAs | — | https://en.wikipedia.org/wiki/Anaconda_choke ; Wikidata Q4751850 |
| disambiguations | null | "Often confused with the Darce/Brabo Choke — Anaconda rolls toward the trapped arm and threads under the neck-side; Darce threads under the near arm." |
Rationale: NO alias (Darce/Brabo are denylisted false synonyms, already in do_not_merge.json). Reciprocal disambiguation gap flagged: Darce↔Anaconda is in `do_not_merge.json` but NEITHER file declares a `disambiguations[]` entry. See false-synonym-missing entries below.

### Ezekiel Choke
| Field | Current | Proposed |
|---|---|---|
| aliases | null | Sode Guruma Jime, Ezequiel Choke, Estrangulamento Ezequiel |
| sameAs | — | https://en.wikipedia.org/wiki/Ezekiel_choke ; Wikidata Q5421162 |
Rationale: Japanese judo name "Sode Guruma Jime" (sleeve wheel strangle) per task brief. "Ezequiel" is the original Portuguese spelling of the popularizer's name and a real search variant. Estrangulamento Ezequiel = Portuguese full name (lower confidence).

### Arm Triangle
| Field | Current | Proposed |
|---|---|---|
| aliases | null | Kata Gatame, Head and Arm Choke, Side Choke, Arm Triangle Choke |
| sameAs | — | https://en.wikipedia.org/wiki/Arm_triangle_choke ; Wikidata Q4792824 |
Rationale: overview literally opens "The Arm Triangle (Kata Gatame)…". "Head and Arm Choke" and "Arm Triangle Choke" are the dominant English synonyms. "Side Choke" is a common gym synonym (medium confidence). NOTE: `Triangle Choke Side` overview also claims "Kata Gatame Triangle" — that page is a VARIANT of Triangle, not the Arm Triangle; do NOT cross-alias (see possible-confusion note below).

### North-South Choke
| Field | Current | Proposed |
|---|---|---|
| aliases | null | (none strict) |
| sameAs | — | https://en.wikipedia.org/wiki/North-south_choke ; Wikidata Q17052772 (verify) |
Rationale: No clean second name. Do NOT alias "North-South" (that's the POSITION — denylisted pair North-South ↔ North-South Choke). "Marcelotine" is sometimes used for Marcelo Garcia's version but is niche/not a strict synonym. Disambiguation gap with North-South position flagged below.

### Bow and Arrow Choke
| Field | Current | Proposed |
|---|---|---|
| aliases | null | Bow and Arrow Lapel Choke |
| sameAs | — | (none likely) |
Rationale: weak. "Bow and Arrow Lapel Choke" / "Bow-and-Arrow Choke" punctuation hedge only. Do NOT alias Loop Choke (denylisted). Low confidence; may be dropped.

### Cross Collar Choke
| Field | Current | Proposed |
|---|---|---|
| aliases | null | Cross Choke, Juji Jime, X-Choke, Cross Lapel Choke |
| sameAs | — | https://en.wikipedia.org/wiki/Cross_choke ; Wikidata Q5188450 (verify) |
Rationale: Japanese judo "Juji Jime" (cross strangle) is the standard synonym. "Cross Choke" / "X-Choke" are common English short forms. High confidence on Cross Choke / Juji Jime.

### Clock Choke
| Field | Current | Proposed |
|---|---|---|
| aliases | null | Relogio Choke |
| sameAs | — | (none likely) |
Rationale: "Relógio" is Portuguese for clock; "Relogio Choke" appears in some material but is niche. Low confidence — may be dropped.

### Loop Choke
| Field | Current | Proposed |
|---|---|---|
| aliases | null | (none strict) |
Rationale: No strict synonym. Do NOT alias Bow and Arrow (denylisted). No action.

### Baseball Bat Choke
| Field | Current | Proposed |
|---|---|---|
| aliases | null | Baseball Choke, Baseball Bat Grip Choke |
Rationale: "Baseball Choke" is the common short form. Medium confidence.

### Japanese Necktie
| Field | Current | Proposed |
|---|---|---|
| aliases | null | (none) |
Rationale: No strict synonym. It is itself a distinct front-headlock choke; necktie family relation is a VARIANT relationship (see family note), not alias.

### Peruvian Necktie
| Field | Current | Proposed |
|---|---|---|
| aliases | null | (none) |
Rationale: No strict synonym. Variant within the "necktie" group (Japanese/Peruvian neckties are mechanically distinct) — not aliases.

### Other chokes (no alias action)
| Technique | Finding |
|---|---|
| Von Flue Choke | Eponymous; no synonym. sameAs candidate possible but not well-known enough for confident Wikidata. No action. |
| Breadcutter Choke | aka "Lapel Choke" too generic; no clean strict synonym. No action. |
| Paper Cutter Choke | Sometimes used interchangeably with Breadcutter by some gyms, but they are mechanically distinct (different lapel routing) → VARIANT/false-synonym territory, NOT alias. No alias proposed. |
| Buggy Choke | Modern eponymous technique; no synonym. No action. |
| Gogoplata | aka "Kakato Jime" in some judo references; niche, low confidence. Flagged low. |
| Baratoplata | 10th Planet eponym (shoulder lock, not strictly a choke); no synonym. No action. |
| Arm in Guillotine | VARIANT of Guillotine — not an alias. family candidate. |
| High Elbow Guillotine | VARIANT of Guillotine ("Marcelotine" sometimes) — not an alias. family candidate. |
| Chin Strap Guillotine | VARIANT of Guillotine — not an alias. family candidate. |
| Ten Finger Guillotine | VARIANT of Guillotine — not an alias. family candidate. |
| Hindulotine | 10th Planet guillotine VARIANT — not an alias. family candidate. |
| Marce Choke | Loop+cross-collar hybrid; eponymous-ish; no strict synonym. No action. |
| Short Choke | No strict synonym. No action. |
| Choke from Crucifix | Positional descriptor, not an alias target. No action. |
| Rear Triangle Choke | VARIANT of Triangle — family candidate, not alias. |
| Inverted Triangle | VARIANT of Triangle — family candidate, not alias. |
| Triangle Choke Side | VARIANT of Triangle ("Side Triangle", "Kata Gatame Triangle" per its own overview) — family candidate, not alias. Do NOT alias to Arm Triangle despite the shared "Kata Gatame" wording. |

---

## Family candidates (flagged, NOT alias proposals)
These are VARIANT relationships and should use `family:`, not `aliases:`. Out of strict scope for this audit but noted for the family-hub pass:
- `family: "Guillotine"` — Guillotine Choke, Arm in Guillotine, High Elbow Guillotine, Chin Strap Guillotine, Ten Finger Guillotine, Hindulotine.
- `family: "Triangle Choke"` — Triangle Choke, Inverted Triangle, Rear Triangle Choke, Triangle Choke Side.
- `family: "Necktie"` (optional) — Japanese Necktie, Peruvian Necktie.

---

## False-synonym disambiguation gaps (reciprocal `disambiguations[]` missing)
The do_not_merge.json denylist requires reciprocal disambiguations, but these files have none:
1. **Darce Choke ↔ Anaconda Choke** — both null. Should declare each other.
2. **North-South Choke ↔ North-South (position)** — choke file has no disambiguation pointing at the position. (Position file is out of this slice; flagged.)
3. **Bow and Arrow Choke ↔ Loop Choke** — both null. Should declare each other.

---

## Summary
- High-confidence alias adds: Rear Naked Choke, Triangle Choke, Guillotine Choke, Ezekiel Choke, Arm Triangle, Cross Collar Choke.
- Medium: Darce display-name + Brabo merge (variant-mismatch), Baseball Bat Choke.
- Low / drop candidates: Bow and Arrow, Clock, Gogoplata.
- sameAs (Wikipedia/Wikidata) proposed for the 6-8 well-known chokes; all to be URL-verified before apply.
- 3 false-synonym disambiguation gaps to backfill reciprocally.
- No denylisted pair proposed as an alias.
