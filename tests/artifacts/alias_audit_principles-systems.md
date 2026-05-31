# Alias / sameAs Audit — Slice: principles-systems

Scope: `content/Principles/*.json` (60 files) + `content/Systems/*.json` (47 files).
Date: 2026-05-31. Read-only audit per plan §B.

## Method

- Enumerated all 107 files; extracted `name`, `aliases`, `family`, `disambiguations`, `sameAs`.
- **None** of the 107 files currently has any of those four fields populated — so every proposal below is a pure GAP, not a duplicate.
- Cross-checked every candidate against `tests/artifacts/do_not_merge.json` (none of the proposals collide with a denylisted false-synonym pair).
- Conservative bias: Systems that are instructor-branded frameworks (e.g. "Bernardo Faria Pressure System") or generic strategy docs (e.g. "Competition Strategy", "No-Gi Tactical Framework") are NOT techniques and have no real synonyms — they are deliberately excluded. Principles that are descriptive English coinages ("Control Point Hierarchy", "Dominant Angles", "Making Smaller Circles") likewise have no synonyms.

## Why most files yield nothing

Two categories dominate this slice and neither carries technique synonyms:

1. **Branded systems / frameworks** — proper nouns tied to an instructor or team (Danaher*, Marcelo Garcia*, Gordon Ryan*, 10th Planet*, B-Team Dilemma, Craig Jones, Roger Gracie, Caio Terra, Keenan Cornelius, Andrew Wiltse, Bernardo Faria, Garry Tonon, Lachlan Giles, Mikey Musumeci, Ryan Hall). These are not interchangeable with another name. ("DDS" = the *team* Danaher Death Squad, not any file here, so no alias applies.)
2. **Generic strategy / pedagogy docs** — Competition Strategy, Competition Preparation System, IBJJF Strategy Guide, Gi-Specific Strategy, No-Gi Competition Approach, Mental Game Framework, Teaching Methodology Framework, Self-Defense Application Framework, Blue to Purple Progression, etc. Descriptive titles, no alternate names.

## Proposals

| Canonical | File | Kind | Items | Confidence | Rationale |
|---|---|---|---|---|---|
| Maximum Efficiency Principle | Principles/Maximum Efficiency Principle.json | alias | Seiryoku Zenyo; Maximum Efficiency Minimum Effort; Maximum Efficiency, Minimum Effort | high | The file's own overview states it is "borrowed from Judo's core philosophy of 'Seiryoku Zenyo' (maximum efficiency with minimum effort)". Seiryoku Zenyo is the exact Japanese term for this same principle; the "minimum effort" phrasing is the standard English rendering. Strict synonyms. |
| Maximum Efficiency Principle | Principles/Maximum Efficiency Principle.json | sameAs | https://en.wikipedia.org/wiki/Jita-kyoei | medium | Seiryoku Zen'yō / Jita Kyoei are the two Kodokan Judo guiding maxims; an English Wikipedia article exists. Needs URL verification (the canonical article may be titled "Kodokan" or "Seiryoku Zen'yō"). |
| Kuzushi | Principles/Kuzushi.json | alias | Off-balancing; Breaking Balance | high | Kuzushi is the Japanese judo term whose literal meaning IS "off-balancing / breaking of balance". These are exact English renderings of the same concept. |
| Kuzushi | Principles/Kuzushi.json | sameAs | https://en.wikipedia.org/wiki/Kuzushi | high | Well-known judo/BJJ term with a dedicated English Wikipedia article and Wikidata item. |
| Kuzushi | Principles/Kuzushi.json | variant-mismatch | content describes Sweeps, not Kuzushi | medium | The file `name` is "Kuzushi" but its overview is about sweep mechanics ("sweeping is the art of disrupting an opponent's base..."). Kuzushi (off-balancing) is a prerequisite *principle* for sweeps, not a synonym for "sweep". Either the page should be retitled/refocused on off-balancing, or a separate "Sweeps" concept page is warranted. Flag for editorial review — do NOT auto-alias "Sweep" onto Kuzushi. |
| Hip Escape Mechanics | Principles/Hip Escape Mechanics.json | alias | Shrimping; Shrimp; Hip Escape; Fuga de Quadril | high | The hip escape is universally called "shrimping" / "the shrimp" in BJJ; "Fuga de Quadril" is the standard Portuguese name. Same exact movement. (Note: a separate "Bridge and Shrimp.json" exists as a combined-movement principle — distinct scope, not a merge target.) |
| Cross Face Control | Principles/Cross Face Control.json | alias | Crossface; Cross-Face | high | "Crossface" (one word) is the standard wrestling/BJJ spelling of the identical control. Pure spelling/spacing synonym. |
| Blood Chokes | Principles/Blood Chokes.json | alias | Strangle; Vascular Strangle; Carotid Choke; Blood Choke | medium | "Strangle / vascular strangle / carotid choke" all denote the same carotid-compression finishing category the file describes; "Blood Choke" singular is the same term. Category-level alias rather than a single named technique, so medium confidence. |
| Blood Chokes | Principles/Blood Chokes.json | sameAs | https://en.wikipedia.org/wiki/Chokehold | low | The "Chokehold" / "Strangling" Wikipedia article covers blood vs air chokes; not a dedicated article, so confidence is low and it may be better surfaced as a reference than a sameAs. Verify. |
| Air Chokes | Principles/Air Chokes.json | alias | Windpipe Choke; Tracheal Choke; Air Choke | medium | "Windpipe / tracheal choke" denote the same trachea-compression category the file describes. Category-level alias, medium confidence. |
| Air Chokes ↔ Blood Chokes | Principles/Air Chokes.json + Principles/Blood Chokes.json | false-synonym-missing | Blood Chokes ↔ Air Chokes | medium | Each file explicitly contrasts itself with the other ("Unlike blood chokes...", "Unlike air chokes..."). They are routinely confused by beginners but are mechanically distinct (carotid vs trachea). Good candidate for reciprocal `disambiguations[]`. NOT on the do_not_merge denylist yet; if accepted, add the pair. Do NOT alias them together. |
| Berimbolo | Systems/Berimbolo.json | sameAs | https://en.wikipedia.org/wiki/Berimbolo | medium | Berimbolo is a well-known named technique with broad coverage; an English Wikipedia article / Wikidata item plausibly exists. Verify URL. The file is modeled as a "System" but the underlying entity is the Berimbolo technique. |

## Candidates considered and REJECTED (for the record)

| Name | Why rejected |
|---|---|
| Whizzer Control → "Overhook" | Overhook is the broader grip; the defensive whizzer is a specific *use* of it. Variant/relation, not a strict synonym. Skip. |
| Twister System → wrestling "Guillotine" | The Twister *submission* equals the wrestling guillotine, but this file is Eddie Bravo's branded *system* (lockdown → truck → twister), not the bare submission. No system-level synonym. |
| Kimura Trap System → "Kimura" | The system is built around the kimura grip but is not interchangeable with the Kimura submission. Branded framework. Skip. |
| Danaher Straight Jacket System → "DDS" / "Death Squad" | DDS = Danaher Death Squad (a team), not this back-control system. False match. |
| Bridge and Shrimp → "Shrimping" | "Shrimping" maps specifically to the hip escape (proposed on Hip Escape Mechanics). This file is the *combined* bridge+shrimp movement pair, broader scope. Do not double-claim the alias here. |
| Pressure / Hip Pressure / Shoulder Pressure / Forward Pressure | Descriptive English principle coinages; no alternate names. |
| Frames / Posts / Hooks / Grips / Wedges / Clamps | Generic mechanic-category coinages; no strict synonyms. |
| All instructor-branded & generic-strategy systems | Proper-noun frameworks / descriptive titles; no synonyms (see "Why most files yield nothing"). |

## Summary

- 12 proposals across 7 files (5 alias, 4 sameAs, 1 variant-mismatch, 1 false-synonym-missing — counting the reciprocal pair once).
- All four schema fields are empty corpus-wide in this slice, so there are zero existing-duplicate conflicts.
- The richest finds are the two Japanese-rooted principles (Kuzushi, Maximum Efficiency / Seiryoku Zenyo) and the two choke categories (Blood vs Air) which want reciprocal disambiguations rather than aliasing.
- All sameAs URLs are marked for verification before apply.
