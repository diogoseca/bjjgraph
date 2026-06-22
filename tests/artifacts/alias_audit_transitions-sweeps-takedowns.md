# Alias / sameAs Audit — Slice: transitions-sweeps-takedowns

Scope: canonical SWEEPS, TAKEDOWNS, BACK-TAKES in `content/Transitions/*.json`.
Read-only audit per plan §B. Position-specific entries (e.g. "Sweep from X-Guard",
"Back Take from 50-50", "Leg Drag to Mount") are treated as inheriting parent
identity — NOT proposed for per-position aliases. Only canonical named techniques
below.

Denylist consulted: `tests/artifacts/do_not_merge.json`. No denylisted false-synonym
was proposed as an alias. (None of this slice's pairs appear on the denylist.)

Legend — confidence: H/M/L. All `sameAs` URLs/Q-ids verified live during this audit
via Wikipedia/Wikidata fetch, but flagged per the apply step's re-verification rule.

Every canonical file in this slice currently has `aliases: null`, `family: null`,
`disambiguations: null` — so all proposals below are pure GAPS (no duplicates).

---

## Japanese throws / takedowns (judo lineage — strong Wikidata coverage)

| Canonical | File | Proposed aliases | sameAs (verified) | Conf | Notes |
|---|---|---|---|---|---|
| Osoto Gari | `Osoto Gari.json` | Major Outer Reap; Large Outer Reap; O Soto Gari | WP `O_soto_gari`; WD **Q10264837** | H | One of original 40 judo throws. "O Soto Gari" is a spelling variant. |
| Ouchi Gari | `Ouchi Gari.json` | Major Inner Reap; Large Inner Reap; O Uchi Gari | WP `O_uchi_gari`; WD **Q1456901** | H | English = "major inner reap". |
| Kouchi Gari | `Kouchi Gari.json` | Minor Inner Reap; Small Inner Reap; Ko Uchi Gari | WP `Ko_uchi_gari`; WD **Q3198097** | H | Distinct from Ouchi Gari (denylist not needed — different file, different Q-id). |
| Kosoto Gari | `Kosoto Gari.json` | Minor Outer Reap; Small Outer Reap; Ko Soto Gari | WP `Ko_soto_gari`; WD **Q3198091** | H | English = "small/minor outer reap". |
| Kosoto Gake | `Kosoto Gake.json` | Minor Outer Hook; Small Outer Hook; Ko Soto Gake | WP `Kosoto_gake`; WD **Q3198092** | H | "gake" = hook (vs "gari" = reap). True distinct technique from Kosoto Gari; do NOT merge the two. |
| Uchi Mata | `Uchi Mata.json` | Inner Thigh Throw; Inner Thigh Reap | WP `Uchi_mata`; WD **Q2205320** | H | One of highest-scoring competition throws. |
| Tomoe Nage | `Tomoe Nage.json` | Circle Throw; Wheel Throw | WP `Tomoe_nage`; WD **Q1773778** | H | WP lists English names "Circle throw / Wheel throw". |
| Sumi Gaeshi | `Sumi Gaeshi.json` | Corner Reversal; Corner Throw | WP `Sumi_gaeshi`; WD **Q959063** | H | WP English: "Corner throw / Corner reversal". |
| Tani Otoshi | `Tani Otoshi.json` | Valley Drop | WP `Tani_otoshi`; WD **Q3515162** | H | English = "valley drop". |
| Ippon Seoi Nage | `Ippon Seoi Nage.json` | One-Arm Shoulder Throw; One-Handed Shoulder Throw | WP `Ippon_seoi_nage`; WD **Q3069903** | H | Has its own WP article + Q-id (variant of Seoi nage). |
| Morote Seoi Nage | `Morote Seoi Nage.json` | Two-Handed Shoulder Throw; Two-Arm Shoulder Throw | WP `Seoi_nage` (redirect target); WD **Q392478** (parent) | M | No standalone item — Morote redirects to Seoi nage. sameAs points to parent; lower confidence. |
| Fireman's Carry | `Fireman's Carry.json` | Kata Guruma; Shoulder Wheel | WP `Kata_guruma`; WD **Q128059** | M | Judo equivalent = Kata Guruma (shoulder wheel). WP "See also" treats fireman's carry as related; widely synonymous in grappling. Medium because some sources distinguish the wrestling vs judo entries. |

---

## English-named sweeps with established synonyms

| Canonical | File | Proposed aliases | sameAs | Conf | Notes |
|---|---|---|---|---|---|
| Hip Bump Sweep | `Hip Bump Sweep.json` | Sit-up Sweep; Sitting Up Sweep | — | H | "Sit-up Sweep" is the single most common alternate English name for this closed-guard sweep. Strict synonym. |
| Flower Sweep | `Flower Sweep.json` | — (see variant-mismatch) | — | — | See variant-mismatch row below — overlaps Pendulum Sweep. |

No reliable Wikipedia/Wikidata entries exist for BJJ-specific sweeps (Scissor,
Pendulum, Butterfly, Elevator, Sickle, Tripod, Spider, Lasso, Deep Half, Old School,
Waiter, Kiss of the Dragon, Bolo, Williams Guard, John Wayne, Homer Simpson, Tomahawk,
Grasshopper, Muscle, Balloon, Lumberjack), so no `sameAs` proposed for them. Most of
these are descriptive single-name techniques with no widely-searched second name.

---

## Techniques deliberately given NO proposals (no real gap)

- **Single Leg Takedown / Double Leg Entry/Finish/Setup** — wrestling staples but no
  standalone Wikipedia article (single-/double-leg redirect into `Takedown (grappling)`,
  a generic page); not a clean 1:1 `sameAs`. "Single" / "Double" / "Shot" are not
  page-worthy aliases. No proposal.
- **Arm Drag** — no Wikipedia/Wikidata article (covered only as a generic move). Portuguese
  "puxada de braço" is not an English-market search term. No alias proposed.
- **Berimbolo Entry** — Berimbolo has NO Wikipedia/Wikidata article (BJJ-only neologism,
  coined by Andre Galvao). No `sameAs`. The file is "Berimbolo Entry" (a position-specific
  entry framing), so per slice rules no per-position alias either.
- **Ankle Pick, Duck Under, Collar Drag, Snap Down, Body Lock Takedown, Level Change
  Takedown, Guard Pull, Technical Stand-up** — descriptive English names, no distinct
  synonym or encyclopedia entry warranting an alias/sameAs.

---

## variant-mismatch findings

| Canonical | File | Issue | Conf | Recommendation |
|---|---|---|---|---|
| Hip Bump Sweep | `Hip Bump Sweep V2.json` | `Hip Bump Sweep V2.json` is a duplicate page of `Hip Bump Sweep.json` (same display `name: "Hip Bump Sweep"`, same `from_position: Closed Guard/Bottom`, same description framing). Synonyms.md §8 explicitly flags "Hip Bump Sweep V2" as a legacy artifact to DELETE (no alias needed — "V2" is not a search term). | H | Delete `Hip Bump Sweep V2.json`; fold any unique content into `Hip Bump Sweep.json`; regenerate. No alias entry. |
| Flower Sweep / Pendulum Sweep | `Flower Sweep.json` + `Pendulum Sweep.json` | Two separate full pages for what mainstream BJJ treats as the SAME technique — both are closed-guard→mount sweeps, and the Flower Sweep overview itself describes "creating a pendulum-like momentum." Classic synonym pair (Flower = Pendulum = Balão). Currently neither aliases the other. | M | Merge into one canonical (recommend keep `Pendulum Sweep` as canonical for SEO breadth; alias `Flower Sweep`, `Balão Sweep`). Medium confidence because a minority of instructors distinguish them by exact leg path — escalate before collapsing rather than auto-merge. |

---

## false-synonym-missing findings

None within this slice. The denylist pairs (Mount/Reverse Mount, Ankle Lock/Achilles,
Toe Hold/Heel Hook, etc.) belong to other slices (positions / leg-locks). No
sweep/takedown pair in this slice is a commonly-confused false-synonym requiring
reciprocal disambiguations. (Kosoto Gari vs Kosoto Gake and Ouchi vs Kouchi Gari are
genuinely distinct, well-separated by name, and not commonly confused enough to warrant
a hatnote — left as-is.)

---

## Summary counts

- alias proposals: 13 files
- sameAs proposals: 12 files (10 H, 2 M)
- variant-mismatch: 2 (Hip Bump V2 duplicate [H]; Flower/Pendulum merge [M])
- false-synonym-missing: 0
