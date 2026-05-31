# Alias / sameAs Audit — Slice: submissions-locks

Scope: JOINT-LOCK and LEG-LOCK submissions in `content/Submissions/*.json` (top-level only).
Read-only audit. All in-scope files currently have **empty** `aliases`, `family`, and `disambiguations`
(every field returned `None`), so this is a greenfield pass — every proposal below is a GAP, not a duplicate.

Denylist consulted: `tests/artifacts/do_not_merge.json`. Pairs I must NEVER alias:
Kimura↔Americana, Toe Hold↔Heel Hook, Ankle Lock↔Achilles Lock, Straight Ankle Lock↔Achilles Lock,
Ankle Lock↔Straight Ankle Lock, Inside Heel Hook↔Outside Heel Hook. None of my alias proposals cross these.

Confidence legend: high = textbook strict synonym / canonical Wikipedia article; medium = widely used
but regionally varied or spelling hedge; low = plausible but verify.

---

## Joint locks — upper body

| Technique | File | Proposed aliases (synonyms) | sameAs | Notes / excluded |
|---|---|---|---|---|
| Armbar | `Submissions/Armbar.json` | Juji Gatame, Arm Bar, Straight Armbar, Cross Armbar | WP: Armbar; WD: Q4789968 | "Armbar from Mount" etc. are position-specific transitions — inherit identity, NOT aliases. Flying/Spinning/Belly Down/Far Side armbars are VARIANTS (own files), not aliases. |
| Kimura | `Submissions/Kimura.json` | Gyaku Ude Garami, Double Wristlock, Reverse Key Lock, Chicken Wing | WP: Kimura lock; WD: Q3197406 | Double Wristlock = catch-wrestling name for the exact same lock → strict synonym. NEVER alias Americana (denylist). Reverse Kimura / Mir Lock are VARIANTS. |
| Americana | `Submissions/Americana.json` | Ude Garami, Key Lock, Keylock, V-Lock, Figure-Four Armlock, Bent Armlock | WP: Americana (submission) → redirect to Keylock; WD: Q4742447 | Task brief lists Americana = Ude Garami = Key Lock = V-Lock = Figure-Four Armlock. NEVER alias Kimura (denylist). |
| Omoplata | `Submissions/Omoplata.json` | Omo Plata, Coil Lock, Ashi-sankaku-garami | WP: Omoplata; WD: Q4337516 | Shoulder lock applied with the legs. "Coil lock" is the older English name. Baratoplata/Monoplata/Tarikoplata/Gogoplata are VARIANTS (own files), not aliases. |
| Reverse Kimura | `Submissions/Reverse Kimura.json` | — | — | VARIANT of Kimura (opposite-direction shoulder rotation). Could declare `family: "Kimura"` but that's a family action, not an alias. No strict synonym. |
| Mir Lock | `Submissions/Mir Lock.json` | — | — | Kimura-from-guard variant popularized by Frank Mir. VARIANT of Kimura, NOT an alias. Leave aliases empty. |
| Arm Crush | `Submissions/Arm Crush.json` | — | — | Shoulder/arm compression from side control. Generic descriptor, no established strict synonym. Leave empty. |
| Kesa Gatame Arm Crush | `Submissions/Kesa Gatame Arm Crush.json` | — | — | Position-specific arm-crush from kesa gatame. Inherits Arm Crush identity; no per-position alias. |
| Williams Shoulder Lock | `Submissions/Williams Shoulder Lock.json` | Williams Guard Shoulder Lock | — | Niche; "Williams Shoulder Lock" already the common name. Single low-confidence spelling hedge only. |
| Baratoplata | `Submissions/Baratoplata.json` | Baraplata | — | Inverted/baseball-grip omoplata variant (Rafael Barata). Spelling hedge "Baraplata" seen in instructionals. VARIANT of Omoplata, not an alias of it. |
| Monoplata | `Submissions/Monoplata.json` | Mono Plata | — | Omoplata variant. Only a spelling hedge. |
| Tarikoplata | `Submissions/Tarikoplata.json` | Tarik-o-plata | — | Omoplata/baratoplata variant (Tarik Hopstock). Spelling hedge only. |
| Gogoplata | `Submissions/Gogoplata.json` | Gokor Lock | WP: Gogoplata; WD: Q5578166 | NOTE: mechanically a CHOKE (shin across throat), borderline out of locks slice. "Kagato-jime" is the judo term. Low confidence — verify before applying. |

## Joint locks — wrist / bicep / spine / neck

| Technique | File | Proposed aliases (synonyms) | sameAs | Notes / excluded |
|---|---|---|---|---|
| Bicep Slicer | `Submissions/Bicep Slicer.json` | Biceps Slicer, Bicep Crusher, Biceps Crush, Arm Crusher, Ude Hishigi | WP: Biceps slicer; WD: Q4904210 | "Biceps Slicer" is the Wikipedia spelling; "Bicep Crusher" widely used. Strict synonyms. |
| Spine Lock | `Submissions/Spine Lock.json` | Spinal Lock, Spine Crank | WP: Spinal lock; WD: Q7575164 | "Spinal lock" is the textbook English term. Twister is a VARIANT/separate technique, not an alias. |
| Twister | `Submissions/Twister.json` | Korean Twister, Guillotine (wrestling) | WP: Twister (grappling); WD: Q7860262 | Catch-wrestling name is "guillotine" / "Korean twister." Twister = spinal/trunk crank; do NOT alias the Guillotine *choke*. Mark "Guillotine (wrestling)" low confidence (collision risk with choke). |
| Neck Crank | `Submissions/Neck Crank.json` | Neck Crank, Cervical Lock, Spinal Crank | WP: Neck crank; WD: Q12059464 | "Cervical lock" / "neck crank" are interchangeable English terms. Distinct from chokes (mechanical, not blood/air). |
| Can Opener | `Submissions/Can Opener.json` | Kataha Jime (no), Neck Crank from Guard | — | Low confidence. "Can opener" is the standard name; possible alias "Helmet Crank." Verify before applying — leave conservative. |

## Leg locks — knee / ankle / foot

| Technique | File | Proposed aliases (synonyms) | sameAs | Notes / excluded |
|---|---|---|---|---|
| Heel Hook | `Submissions/Heel Hook.json` | — | WP: Heel hook; WD: Q5699759 | NO strict synonym. Inside Heel Hook / Outside Heel Hook are VARIANTS + a denylisted false-synonym pair. Toe Hold is denylisted. Only a sameAs proposal. |
| Inside Heel Hook | `Submissions/Inside Heel Hook.json` | — | — | VARIANT (family: Heel Hook) + false-synonym vs Outside Heel Hook (already on denylist). No alias. Should carry reciprocal `disambiguations` with Outside Heel Hook (see false-synonym section). |
| Outside Heel Hook | `Submissions/Outside Heel Hook.json` | — | — | Same as above. No alias. |
| Toe Hold | `Submissions/Toe Hold.json` | Ashi Dori Garami, American Toe Hold | WP: Toe hold; WD: Q7813916 | Task brief: Toe Hold = Ashi Dori Garami. NEVER alias Heel Hook (denylist). |
| Kneebar | `Submissions/Kneebar.json` | Knee Bar, Hiza Juji Gatame, Leg Bar | WP: Kneebar; WD: Q6422083 | Task brief: Knee Bar = Hiza Juji Gatame. "Knee Bar" two-word spelling is a search hedge. Flying Kneebar is a VARIANT (own file). |
| Achilles Lock | `Submissions/Achilles Lock.json` | — | — | DENYLISTED vs Ankle Lock and Straight Ankle Lock. NO aliases proposed. Needs reciprocal disambiguations (see false-synonym section). |
| Straight Ankle Lock | `Submissions/Straight Ankle Lock.json` | Straight Footlock, Achilles Hold (verify) | WP: Ankle lock; WD: Q4754306 | DENYLISTED vs Achilles Lock & "Ankle Lock". "Straight Footlock" is a safe strict synonym for the straight version. Do NOT add "Achilles Lock" — denylist. "Achilles Hold" low conf, verify it isn't the denylisted Achilles Lock. |
| Calf Slicer | `Submissions/Calf Slicer.json` | Calf Crusher, Calf Cutter, Calf Crush, Leg Slicer | WP: Calf slicer; WD: Q24034552 | "Calf crusher" / "calf cutter" are interchangeable. Strict synonyms. |
| Boston Crab | `Submissions/Boston Crab.json` | — | WP: Boston crab; WD: Q4946156 | Pro-wrestling/catch term; "Boston Crab" is canonical. No BJJ-side strict synonym. sameAs only. |
| Banana Split | `Submissions/Banana Split.json` | — | — | Groin/hip compression from truck. Sometimes confused with Electric Chair (different) — candidate false-synonym, not alias. No strict synonym. |
| Electric Chair | `Submissions/Electric Chair.json` | — | — | Groin stretch from lockdown/half guard. VARIANT-adjacent to Banana Split but distinct. No strict synonym. |
| Crotch Ripper | `Submissions/Crotch Ripper.json` | — | — | Groin compression from lockdown. Slangy; no established alias. Leave empty. |
| Suloev Stretch | `Submissions/Suloev Stretch.json` | — | — | Knee/leg compression (Amar Suloev). "Suloev Stretch" is the only common name. No alias. |
| Aoki Lock | `Submissions/Aoki Lock.json` | — | — | Calf/knee compression (Shinya Aoki). No established strict synonym; "Aoki Lock" canonical. Leave empty. |
| Estima Lock | `Submissions/Estima Lock.json` | Estima Foot Lock | — | Foot lock from 50/50 (Estima brothers). VARIANT-style foot lock; "Estima Foot Lock" is a descriptive hedge. Not a strict alias of Toe Hold/Ankle Lock. Low confidence. |

---

## false-synonym-missing (reciprocal disambiguations that should exist)

These pairs are already on the denylist (`do_not_merge.json`) but the in-scope files have EMPTY
`disambiguations`. Per docs/Synonyms.md §4, denylisted pairs MUST carry reciprocal `disambiguations[]`.
Flagging the gaps in this slice:

| Pair | Files | Why distinct |
|---|---|---|
| Kimura ↔ Americana | `Kimura.json`, `Americana.json` | Opposite shoulder-rotation direction; constantly confused. Both files have empty disambiguations. |
| Toe Hold ↔ Heel Hook | `Toe Hold.json`, `Heel Hook.json` | Different joint (ankle/foot vs knee via heel). Denylisted, no disambiguations present. |
| Inside Heel Hook ↔ Outside Heel Hook | `Inside Heel Hook.json`, `Outside Heel Hook.json` | Opposite leg configuration / different knee-ligament emphasis. Denylisted, no disambiguations present. |
| Straight Ankle Lock ↔ Achilles Lock | `Straight Ankle Lock.json`, `Achilles Lock.json` | Three-way denylist (with "Ankle Lock"). Both files have empty disambiguations. |

---

## Excluded from this slice (chokes/strangles — other slice)
Anaconda, Arm in Guillotine, Arm Triangle, Baseball Bat, Bow and Arrow, Brabo, Breadcutter, Buggy,
Chin Strap Guillotine, Choke from Crucifix, Clock, Cross Collar, Darce, Ezekiel, Guillotine, High Elbow
Guillotine, Hindulotine, Inverted Triangle, Japanese Necktie, Loop, Marce, North-South Choke, Paper
Cutter, Peruvian Necktie, Rear Naked, Rear Triangle, Short Choke, Ten Finger Guillotine, Triangle,
Triangle Choke Side, Von Flue, Baratoplata-adjacent chokes — all are choke/strangle techniques.
(Hindulotine/Gogoplata are choke-mechanism despite "-plata"; Gogoplata kept above only as a borderline note.)
