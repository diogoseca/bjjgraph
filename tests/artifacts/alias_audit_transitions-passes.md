# Alias / sameAs Audit — Slice: transitions-passes

Scope: canonical GUARD PASS techniques in `content/Transitions/*.json`. Per-position "from X"
entries (e.g. `Knee Slice from Z-Guard`, `Toreando from Headquarters`, `Leg Drag to Mount`)
inherit the parent technique identity and are intentionally NOT given per-position aliases.

Read-only audit. Denylist consulted: `tests/artifacts/do_not_merge.json` (no guard-pass pairs
are listed there, so nothing here is blocked — but Double Under vs Double Underhook and
Over-Under vs Double Under are kept distinct below on technical grounds).

Date: 2026-05-31

---

## Canonical passes reviewed

| Canonical file | name | aliases (current) | family | disambig | sameAs |
|---|---|---|---|---|---|
| `Toreando Pass.json` | Toreando Pass | none | none | none | none |
| `Bullfighter Pass.json` | Bullfighter Pass | none | none | none | none |
| `Knee Cut Pass.json` | Knee Cut Pass | none | none | none | none |
| `Knee Slice Pass.json` | Knee Slice Pass | none | none | none | none |
| `Stack Pass.json` | Stack Pass | none | none | none | none |
| `Over-Under Pass.json` | Over-Under Pass | none | none | none | none |
| `Double Under Pass.json` | Double Under Pass | none | none | none | none |
| `Double Underhook Pass.json` | Double Underhook Pass | none | none | none | none |
| `Leg Drag Pass.json` | Leg Drag Pass | none | none | none | none |
| `Long Step Pass.json` | Long Step Pass | none | none | none | none |
| `X Pass.json` | X Pass | none | none | none | none |
| `Smash Pass.json` | Smash Pass | none | none | none | none |
| `Back Step Pass.json` | Back Step Pass | none | none | none | none |
| `Body Lock Pass.json` | Body Lock Pass | none | none | none | none |
| `Float Passing.json` | Float Passing | none | none | none | none |
| `Pressure Pass.json` | Pressure Pass | none | none | none | none |
| `Old School Pass.json` | Old School Pass | none | none | none | none |
| `Leg Weave Pass.json` | Leg Weave Pass | none | none | none | none |
| `Underhook Pass.json` | Underhook Pass | none | none | none | none |
| `Crossface Pass.json` | Crossface Pass | none | none | none | none |
| `Cartwheel Pass.json` | Cartwheel Pass | none | none | none | none |

Every canonical pass file currently has EMPTY alias/family/disambig/sameAs — so every entry
below is a genuine GAP, not a duplicate.

---

## 1. Toreando Pass  (`Toreando Pass.json`)

Both `Toreando Pass.json` and `Bullfighter Pass.json` exist and each overview says it is
"also known as" the other — they are the SAME technique modeled as two files. Per
`docs/Synonyms.md` §8, the canonical is **Toreando Pass**; Bullfighter Pass is an alias and
its file should be collapsed/merged.

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| variant-mismatch | Bullfighter Pass | high | Two true-synonym files; merge `Bullfighter Pass.json` into `Toreando Pass.json` per Synonyms.md §8 worked example. |
| alias | Bullfighter Pass; Matador Pass; Toreada Pass; Toreador Pass; Toreana Pass | high | Bullfighter = direct English translation. Matador Pass is common gym slang for the same lateral-control pass. Toreada/Toreador/Toreana are well-attested spelling hedges (Synonyms.md §8 names Toreada/Toreador explicitly). |
| sameAs | https://en.wikipedia.org/wiki/Guard_passing | low | No dedicated Wikipedia article for the Toreando pass; only the general "Guard (grappling)" / guard-passing context exists. Mark low; likely drop on URL verify. |

## 2. Bullfighter Pass  (`Bullfighter Pass.json`)

Synonym of Toreando Pass (see §1). Modeled as a separate page.

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| variant-mismatch | Toreando Pass | high | This file is the synonym duplicate; should be folded into `Toreando Pass.json` as the alias `Bullfighter Pass`. |

## 3. Knee Cut Pass  (`Knee Cut Pass.json`)

`Knee Cut Pass.json` (Open Guard/Top) overview states "also known as Knee Slice Pass".
`Knee Slice Pass.json` (Half Guard/Top) describes the identical mechanic. These are the same
technique split across two canonical files → merge. Standalone files `Knee Through.json`
(Shin-to-Shin) and `Knee Slide from Combat Base.json` are position-specific entries that
INHERIT this identity (not merge targets) but they confirm "Knee Through" and "Knee Slide"
are live synonyms of the pass.

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| variant-mismatch | Knee Slice Pass | high | Same exact pass; `Knee Cut Pass.json` self-declares "also known as Knee Slice Pass". Merge into one canonical. |
| alias | Knee Slice Pass; Knee Slide Pass; Knee Through Pass; Knee Cut; Knee Slice; Knee Cut Through | high | All standard English names for the same diagonal knee-across-thigh pass. "Knee Slide"/"Knee Through" confirmed by inheriting position files. |
| sameAs | https://en.wikipedia.org/wiki/Guard_passing | low | No dedicated article; general guard-passing only. Likely drop on verify. |

## 4. Knee Slice Pass  (`Knee Slice Pass.json`)

Synonym duplicate of Knee Cut Pass (see §3).

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| variant-mismatch | Knee Cut Pass | high | Same exact pass; fold into the chosen canonical, keep `Knee Slice Pass` as an alias. |

## 5. Stack Pass  (`Stack Pass.json`)

Closed-guard stacking pass. Common name hedges exist; "Double Under Stack" is a frequent
gym name when the stack is set up with double-under grips, but it overlaps the Double Under
pass family — propose only the clearly-strict synonyms.

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | Stacking Pass; Stack Guard Pass | medium | "Stacking Pass" is a direct gerund variant of the same technique. "Stack Guard Pass" is a descriptive variant. |

NOTE: "Double Under Stack Pass" deliberately NOT proposed — it conflates with Double Under
Pass mechanics; keep separate to avoid a false merge.

## 6. Over-Under Pass  (`Over-Under Pass.json`)

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | Over Under Pass; Over/Under Pass | medium | Pure punctuation/hyphenation hedges of the same canonical name. |

NOT proposed: Double Under Pass / Single Under — those are distinct passes (different grip
configuration), kept as separate technique nodes.

## 7. Double Under Pass  (`Double Under Pass.json`)

Open-guard pass with both arms threaded UNDER the legs.

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | Double Unders Pass; Double Under Stack Pass | medium | "Double Unders" is the ubiquitous shorthand; "Double Under Stack Pass" is the same pass named for its stacking finish. |

DISTINCT from Double Underhook Pass — see §8. NOT proposed as alias of each other.

## 8. Double Underhook Pass  (`Double Underhook Pass.json`)

From Crackhead Control / turtle; both arms UNDERHOOK the armpits (upper body), not the legs.
Mechanically different from the Double Under Pass (legs). They are NOT synonyms.

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| (none) | — | — | Distinct technique (turtle/Crackhead underhook flatten-pass). No strict synonym found. NOT an alias of Double Under Pass. |

## 9. Leg Drag Pass  (`Leg Drag Pass.json`)

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | Leg Drag; Legdrag Pass; Leg-Drag Pass | medium | "Leg Drag" is the bare canonical; the others are spacing/hyphenation hedges. The many `Leg Drag from X` / `Leg Drag to X` files are position-specific entries that inherit identity (not aliased). |

## 10. Long Step Pass  (`Long Step Pass.json`)

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | Long Step; Longstep Pass; Long-Step Pass | medium | Bare and spacing/hyphenation hedges of the same pass. |

NOT proposed: Back Step Pass — distinct retrograde-movement pass (see §13), often confused
with Long Step but mechanically different (forward long-step vs backward extraction).

## 11. X Pass  (`X Pass.json`)

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | X-Pass; X-Guard Pass; Cross Pass | medium | "X-Pass" is the standard hyphenated form. "Cross Pass" / "Crossing Pass" is a common English name for the X (leg-cross) pass. Low-confidence on "X-Guard Pass" since that reads as passing X-guard, not the X pass — DROP if ambiguous on review. |

CAUTION: "X-Guard Pass" could be misread as "a pass against X-Guard." Mark medium, verify.

## 12. Smash Pass  (`Smash Pass.json`)

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | Smash Passing; Smashing Pass | low | Gerund variants. Low confidence — "Smash Pass" is more a passing STYLE/family than a single named technique; aliasing may be over-reach. Verify before apply. |

## 13. Back Step Pass  (`Back Step Pass.json`)

Filename `Back Step Pass.json` (display "Back Step Pass") vs the standalone prefix
`Backstep ...` files. Common spelling is one word "Backstep".

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | Backstep Pass; Back-Step Pass; Backstep | medium | Spacing/hyphenation hedges; "Backstep" is the dominant single-word spelling used elsewhere in the corpus (`Backstep from ...` files). |

DISTINCT from Long Step Pass (§10) — do not cross-alias.

## 14. Body Lock Pass  (`Body Lock Pass.json`)

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | Bodylock Pass; Body-Lock Pass | medium | Spacing/hyphenation hedge; the corpus also has `Bodylock Pass from Seated.json` (one-word spelling), confirming "Bodylock" is in use. |

## 15. Float Passing  (`Float Passing.json`)

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | Float Pass; Floating Pass; Floating Guard Pass | medium | Same technique; "Float Pass"/"Floating Pass" are the more common noun forms vs the gerund "Float Passing". |

## 16. Pressure Pass  (`Pressure Pass.json`)

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | Pressure Passing | low | "Pressure Pass" is a passing STYLE/category more than one technique (compare Stack/Smash). Gerund alias only; low confidence, verify before apply. |

## 17. Old School Pass  (`Old School Pass.json`)

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | Old School Sweep Pass; Old-School Pass | low | Hyphenation hedge. "Old School" is primarily a sweep name; the pass naming is niche. Low confidence. |

## 18. Leg Weave Pass  (`Leg Weave Pass.json`)

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | Leg Weave; Legweave Pass; Leg-Weave Pass | medium | Bare and spacing/hyphenation hedges. Position-specific `Leg Weave ...` files inherit identity. |

## 19. Underhook Pass  (`Underhook Pass.json`)

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | Underhook Half Guard Pass | low | Descriptive variant. Low confidence — "Underhook Pass" is generic; could collide with Double Underhook / Over-Under. Verify before apply. |

## 20. Crossface Pass  (`Crossface Pass.json`)

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | Cross Face Pass; Cross-Face Pass | medium | Spacing/hyphenation hedges; corpus has `Cross Face Pass from Flattened Half.json` (two-word), confirming the variant spelling is in use. |

## 21. Cartwheel Pass  (`Cartwheel Pass.json`)

| Kind | Items | Confidence | Rationale |
|---|---|---|---|
| alias | Cartwheel Guard Pass; Cartwheel Pass to Side Control | low | Descriptive variants. Low confidence — verify. |

---

## Summary of proposed changes

- 2 confirmed synonym MERGES (variant-mismatch): Toreando↔Bullfighter, Knee Cut↔Knee Slice.
- Alias gaps on ~18 canonical passes (mostly spelling/hyphenation/gerund hedges + a few
  strict English synonyms — Bullfighter, Matador, Knee Slice/Slide/Through, Cross Pass).
- sameAs: only low-confidence general guard-passing Wikipedia links — none of these passes
  has a dedicated, verifiable Wikipedia/Wikidata article. Recommend dropping sameAs for this
  slice unless a dedicated source is found on verify.
- Explicitly NOT merged / NOT aliased (kept distinct): Double Under Pass vs Double Underhook
  Pass; Over-Under vs Double Under; Long Step vs Back Step. None are on the denylist but all
  are mechanically distinct.
