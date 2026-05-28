# Synonyms, Variants & False Synonyms

How BJJGraph models the three relationships between technique names. This is the source of truth — when in doubt, follow the flowchart in §4.

---

## 1. The three relationships

BJJ terminology is fragmented across English, Portuguese, Japanese, modern instructional brands, and regional slang. Three distinct relationships matter:

| Relationship | Meaning | Example | Schema field |
|---|---|---|---|
| **Synonym** | Same exact technique, different names | Rear Naked Choke = Mata Leão = Hadaka Jime | `aliases: [...]` |
| **Variant** | Mechanically distinct member of a family | Inside Heel Hook ≠ Outside Heel Hook | `family: "..."` |
| **False synonym** | Often confused, actually distinct | Mount ≠ Reverse Mount; Ankle Lock ≠ Achilles Lock | `disambiguations: [...]` |

Each relationship gets a different surfacing strategy. **Conflating them is the most common mistake** — see §5 for what goes wrong.

---

## 2. The five-question decision flowchart

When you encounter two technique names X and Y, walk this in order:

1. **Would a fluent BJJ practitioner say "those are the same exact technique"?**
   → Yes → **SYNONYM**. Pick one canonical (see §3), make the other an `aliases[]` entry on the canonical file, delete the loser file, regenerate.
2. **Would they say "those are related but mechanically different"?**
   → Yes → **VARIANT**. Keep both as standalone files. Declare a shared `family: "Heel Hook"` on each. Create or update the family hub at `content/Families/Heel Hook.json`.
3. **Would they say "people mix these up but they're different"?**
   → Yes → **FALSE SYNONYM**. Keep both as standalone files. Add reciprocal `disambiguations[]` entries on each. Add the pair to `tests/artifacts/do_not_merge.json`.
4. **Is one a sub-technique that's only ever applied from a specific position?**
   → Yes → it's a separate technique node, not a synonym. Example: `Armbar from Mount` (Transition) is distinct from `Armbar` (Submission) — preserve both.
5. **None of the above?**
   → Log to `tests/artifacts/escalations.md` with the names, brief evidence, and your best guess. Continue working — don't block.

---

## 3. Canonical-name selection (when collapsing a synonym pair)

If both names are valid English, pick by this priority:

1. **Higher Google search volume** — confirmed via Search Console or external SEO tools.
2. **More common in current top-3 instructional brands** (BJJ Fanatics, Submeta, Grapplearts) — recent usage trumps historical.
3. **More common in IBJJF rule-book and competition commentary**.
4. **Shorter / more memorable** as the tiebreaker.

If one name is English and the other is Japanese/Portuguese:

- **Default to English as canonical** for SEO breadth. Add the non-English name as a top-priority alias so it still ranks for native-language searches via redirect + `alternateName` schema + bold mention in the first sentence.
- **Exception**: when the non-English name has equal or greater search volume (e.g. `Berimbolo` outranks any English approximation), keep the non-English name as canonical.

The display title (`name` field in the JSON) is what shows on the page — it can differ from the filename. Filenames stay stable to preserve URLs (e.g. `Darce Choke.json` keeps its filename even when the `name` field changes to `"D'Arce Choke"`).

---

## 4. Mutual obligations

- **`disambiguations[]` entries are reciprocal.** If A declares "Often confused with B", B must declare "Often confused with A". The validator will warn if asymmetric.
- **`family:` membership is reciprocal.** If a position declares `family: "Heel Hook"`, the file `content/Families/Heel Hook.json` must exist and list this position among its members (auto-populated by the family-hub generator).
- **`aliases[]` entries are NOT reciprocal.** Aliases are one-way — they redirect to the canonical. Only the canonical lists them.

---

## 5. The do-not-merge denylist

`tests/artifacts/do_not_merge.json` is consulted by both the validator and the content bot. Pairs listed there are **false synonyms** the system refuses to collapse even if some web page (or some agent's best guess) suggests otherwise. The list is authoritative — additions should come from this document and the per-pair table in the plan.

Format: `[["A", "B"], ["A", "C"], ...]` — order within each pair doesn't matter; the check is symmetric.

When the bot encounters a synonym candidate that's on the denylist, it logs the case to `tests/artifacts/escalations.md` and continues with the next file.

---

## 6. What goes wrong when relationships are conflated

- **Synonym treated as variant** → Two pages compete for the same SEO query, split link equity, fragment user navigation, double the maintenance cost. Wikipedia ate its breakfast for ~15 years before Wikidata sorted this out.
- **Variant treated as synonym** → Distinct technique gets erased into a parent that doesn't fully describe it. Users searching for the variant land on a page that doesn't answer their question and bounce.
- **False synonym treated as synonym** → Worst case: 301 redirect from `Ankle Lock` to `Achilles Lock` teaches users a category error. They internalize the wrong mental model and pass it on.
- **False synonym ignored** → Users repeatedly land on the wrong page, miss the distinction, and don't know to look elsewhere.

The three-field schema is what prevents these. Don't collapse the categories.

---

## 7. SEO consequences

Documented in `docs/SEO.md` and referenced briefly here:

- Synonyms get `alternateName: [...]` in the page's JSON-LD, a visible "Also known as: …" subtitle below the H1, bolded aliases on first occurrence in the overview, frontmatter `aliases:` (powers Quartz's noindex HTML alias pages with `<link rel="canonical">`), and Cloudflare `_redirects` 301s (preferred over meta-refresh per Google guidance).
- Variants get `isPartOf` JSON-LD pointing to the family `CollectionPage`, a visible "Part of the X family" link, and reciprocal `hasPart` listing on the hub.
- False synonyms get `disambiguatingDescription` in the page's JSON-LD and a visible "Often confused with X — reason" hatnote below the H1.

---

## 8. Examples (real, current)

| Case | Type | Action |
|---|---|---|
| Toreando Pass ↔ Bullfighter Pass | Synonym | Collapse into `Toreando Pass.json`; alias `Bullfighter Pass`, plus spelling hedges `Toreada Pass`, `Toreador Pass`. |
| D'Arce Choke ↔ Brabo Choke | Synonym | Collapse into `Darce Choke.json` (filename preserved); display name `D'Arce Choke`; alias `Brabo Choke`. |
| Hip Bump Sweep ↔ Hip Bump Sweep V2 | Synonym (legacy artifact) | Delete V2 file entirely; no alias needed since "V2" is not a search term. |
| Rear Naked Choke / Mata Leão / Hadaka Jime | Synonym | Single page `Rear Naked Choke.json`; aliases `Mata Leão`, `Hadaka Jime`, `Sleeper Hold`, `RNC`. |
| Kesa Gatame, Reverse Kesa-Gatame, Kuzure Kesa-Gatame | Variant | Separate files, all declare `family: "Side Control"`. Family hub at `content/Families/Side Control.json`. |
| Inside Heel Hook ↔ Outside Heel Hook | Variant (and a False Synonym!) | Both declare `family: "Heel Hook"`. Both also declare each other in `disambiguations[]` to flag the opposite-leg-configuration gotcha. |
| Mount ↔ Reverse Mount | False Synonym | Separate files; reciprocal disambiguations; pair in `do_not_merge.json`. |
| Ankle Lock / Straight Ankle Lock / Achilles Lock | False Synonym (3-way) | Separate files; three-way reciprocal disambiguations; all three pairs in `do_not_merge.json`. |
| Kimura ↔ Americana | False Synonym | Separate files; reciprocal disambiguations (opposite rotation direction); pair in `do_not_merge.json`. |

---

## 9. Where each piece of data lives

| Data | File | Used by |
|---|---|---|
| `aliases: [...]` | content/*.json | Validator alias map, frontmatter generator, JSON-LD `alternateName`, visible subtitle, redirect generator, search index |
| `family: "..."` | content/*.json | Family hub auto-population, JSON-LD `isPartOf`, visible "Part of X family" link |
| `disambiguations: [...]` | content/*.json | Validator reciprocity check, JSON-LD `disambiguatingDescription`, visible "Often confused with" hatnote |
| do-not-merge denylist | tests/artifacts/do_not_merge.json | Validator (hard fail if violated), content bot (refuses suggestion) |
| Family hub pages | content/Families/*.json | `CollectionPage` JSON-LD, visible family hub page (not a graph node) |
| Escalation log | tests/artifacts/escalations.md | Agent self-reporting; user reviews periodically |
| Epic progress | tests/artifacts/epic_progress.md | Agent state persistence across sessions for the autonomous epic |
