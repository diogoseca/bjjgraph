# Alias / sameAs Audit — Positions slice

Scope: all 84 position hub files in `content/Positions/*.json` (top-level only; Role subfolders skipped).
Method: extracted `name` / `aliases` / `family` / `disambiguations` / `sameAs` from every file (all currently empty), then proposed gaps.
Denylist consulted: `tests/artifacts/do_not_merge.json` — none of the proposed aliases collapse a denylisted false-synonym pair.

Convention reminders (from `docs/Synonyms.md`):
- **alias** = same exact technique, different name (Japanese/Portuguese/English-variant/abbrev). One-way, lives on canonical.
- **variant** = mechanically distinct family member — NOT an alias.
- **false-synonym** = often-confused-but-distinct — reciprocal `disambiguations[]`, never an alias.
- `sameAs` = external authority URL (Wikipedia / Wikidata); URL-verified before apply.

Legend for confidence: **high** = unambiguous, widely documented; **medium** = common usage, minor regional/spelling variance; **low** = plausible but verify before applying.

---

## Summary of proposals

| # | Canonical | Kind | Items | Conf |
|---|-----------|------|-------|------|
| 1 | Mount | alias | Full Mount, Tate Shiho Gatame, Mato Gatame | high |
| 1 | Mount | sameAs | Wikipedia Mount (grappling), Wikidata | medium |
| 2 | Side Control | alias | Side Mount, Yoko Shiho Gatame, 100 Kilos, Cem Quilos | high |
| 2 | Side Control | sameAs | Wikipedia Side control | medium |
| 3 | North-South | alias | Kami Shiho Gatame, North South Position, 69 Position | high |
| 4 | Knee on Belly | alias | Knee Mount, Knee on Stomach, KOB, Uki Gatame, Joelho na Barriga | high |
| 5 | Back Control | alias | Back Mount, Rear Mount, Back Take Control | medium |
| 5 | Back Control | sameAs | Wikipedia Back mount | medium |
| 6 | Turtle | alias | Turtle Position, Turtle Guard, Referee's Position | medium |
| 7 | Harness | alias | Seatbelt, Seat Belt, Seatbelt Control | high |
| 8 | Inside Sankaku | alias | Honey Hole, 411, Inside Senkaku, Inside Triangle (legs) | high |
| 9 | Ashi Garami | sameAs / variant note | family-term flag vs Leg Entanglement | low |
| 10 | Overhook Control | alias | Whizzer | high |
| 11 | De La Riva Guard | alias | DLR Guard, DLR | high |
| 12 | X-Guard | alias | X Guard | medium |
| 13 | Z-Guard | alias | Z Guard | medium |
| 14 | K-Guard | alias | K Guard | medium |
| 15 | Rubber Guard | sameAs | Wikipedia / 10th Planet | low |
| 16 | Headquarters Position | alias | HQ, Headquarters | medium |
| 17 | Closed Guard | alias | Full Guard, Guard (closed) | medium |
| 17 | Closed Guard | sameAs | Wikipedia Guard (BJJ) | medium |
| 18 | Reverse Mount ↔ Mount | false-synonym-missing | reciprocal disambiguations | high |
| 19 | Shoulder of Justice ↔ Side Control | false-synonym-missing | reciprocal disambiguations | high |
| 20 | Half Guard ↔ Half Mount | false-synonym-missing | reciprocal disambiguations | medium |
| 21 | Standing Position | alias | Standing, Neutral Standing, Feet | low |
| 22 | Body Lock | alias | Bear Hug (standing) | low |

---

## Per-technique detail

### 1. Mount  (`content/Positions/Mount.json`)
- Current aliases: none. Denylist: Mount ↔ Reverse Mount (false-synonym).
- **alias (high):** `Full Mount` (universal English synonym distinguishing from technical/S-mount), `Tate Shiho Gatame` (縦四方固, judo/Japanese canonical), `Mato Gatame` is NOT mount — drop. Keep `Tate Shiho Gatame` + `Full Mount`.
- **sameAs (medium):** Wikipedia `Mount (grappling)` https://en.wikipedia.org/wiki/Mount_(grappling) ; Wikidata Q-id to verify.
- Note: "Mato Gatame" struck — that is a triangle/head-arm term, not mount. Final alias items: Full Mount, Tate Shiho Gatame.

### 2. Side Control  (`content/Positions/Side Control.json`)
- Denylist: Side Control ↔ Shoulder of Justice (false-synonym, see #19).
- **alias (high):** `Side Mount`, `Yoko Shiho Gatame` (横四方固, judo canonical), `100 Kilos`, `Cem Quilos` (Portuguese "100 kilos"). Kesa Gatame is a VARIANT (family Side Control), not an alias — excluded.
- **sameAs (medium):** Wikipedia `Side control` https://en.wikipedia.org/wiki/Side_control .

### 3. North-South  (`content/Positions/North-South.json`)
- Denylist: North-South ↔ North-South Choke (false-synonym; that is the submission, distinct).
- **alias (high):** `Kami Shiho Gatame` (上四方固, judo canonical), `North South Position`, `69 Position` (common no-gi slang). Spelling variant `North-South Position`.

### 4. Knee on Belly  (`content/Positions/Knee on Belly.json`)
- **alias (high):** `Knee Mount`, `Knee on Stomach`, `Knee on Chest`, `KOB` (abbrev), `Uki Gatame` (浮固, judo), `Joelho na Barriga` (Portuguese).

### 5. Back Control  (`content/Positions/Back Control.json`)
- **alias (medium):** `Back Mount`, `Rear Mount`. Note: "Harness/Seatbelt" is a SEPARATE position (control grip) — not aliased here. "Hooks in" is descriptive, not a name. Avoid `Back Take` (transition).
- **sameAs (medium):** Wikipedia `Back mount` https://en.wikipedia.org/wiki/Back_mount .

### 6. Turtle  (`content/Positions/Turtle.json`)
- Denylist: Turtle ↔ Crackhead Control (false-synonym; Crackhead Control is a 10P turtle SYSTEM, kept distinct).
- **alias (medium):** `Turtle Position`, `Referee's Position` (wrestling). Avoid `Turtle Guard` — sometimes used for the bottom-player offensive turtle; arguably a variant, mark low. Final: Turtle Position, Referee's Position.

### 7. Harness  (`content/Positions/Harness.json`)
- Overview itself states "also known as the Seat Belt or Seatbelt Control."
- **alias (high):** `Seatbelt`, `Seat Belt`, `Seatbelt Control`, `Seat Belt Control`.

### 8. Inside Sankaku  (`content/Positions/Inside Sankaku.json`)
- Overview states "also known as the 'Honey Hole' or '411'."
- **alias (high):** `Honey Hole`, `411`, `Inside Senkaku` (common misspelling), `Inside Triangle` (leg config). Note: "Saddle" is the most common modern name — STRONG alias candidate (high). Final items: Honey Hole, 411, Saddle, Inside Senkaku.
- Caution: "Saddle" sometimes used loosely; but in leg-lock canon Saddle = Inside Sankaku = Honey Hole = 411 (Danaher/Ryan terminology). High confidence.

### 9. Ashi Garami vs Leg Entanglement  (`content/Positions/Ashi Garami.json`, `content/Positions/Leg Entanglement.json`)
- **variant-mismatch (low):** Both files describe the same broad leg-control FAMILY ("Ashi Garami" literally = "leg entanglement"). They are near-synonyms modeled as two hub pages. This may warrant a merge (canonical English `Leg Entanglement`, alias `Ashi Garami`) OR a shared `family: "Leg Entanglement"`. Flagged for human review — do not auto-merge; both currently host distinct transition graphs. Low confidence on the action, high confidence the overlap is real.

### 10. Overhook Control  (`content/Positions/Overhook Control.json`)
- Overview states "also known as the whizzer in wrestling terminology."
- **alias (high):** `Whizzer`.

### 11. De La Riva Guard  (`content/Positions/De La Riva Guard.json`)
- Overview uses "(DLR)".
- **alias (high):** `DLR Guard`, `DLR`, `De La Riva`.

### 12. X-Guard  (`content/Positions/X-Guard.json`)
- **alias (medium):** `X Guard` (space variant), `XG`.

### 13. Z-Guard  (`content/Positions/Z-Guard.json`)
- Overview: "an advanced evolution of knee shield half guard." Z-Guard is arguably a VARIANT of Half Guard / Knee Shield — but the established standalone name has a clear space-variant.
- **alias (medium):** `Z Guard`, `Z-Guard Half Guard`. The relationship to Knee Shield Half Guard is variant, not alias — not proposed as alias.

### 14. K-Guard  (`content/Positions/K-Guard.json`)
- **alias (medium):** `K Guard`.

### 15. Rubber Guard  (`content/Positions/Rubber Guard.json`)
- 10th Planet branded position.
- **sameAs (low):** Wikipedia `Rubber guard` https://en.wikipedia.org/wiki/Rubber_guard (verify exists). No clean alias.

### 16. Headquarters Position  (`content/Positions/Headquarters Position.json`)
- **alias (medium):** `HQ`, `Headquarters`. (Mendes-brothers passing-hub term.)

### 17. Closed Guard  (`content/Positions/Closed Guard.json`)
- **alias (medium):** `Full Guard`, `Guarda Fechada` (Portuguese). "Guard" alone is ambiguous — excluded.
- **sameAs (medium):** Wikipedia `Guard (Brazilian jiu-jitsu)` https://en.wikipedia.org/wiki/Guard_(grappling) — page covers guard broadly; verify mapping.

### 18 / Reverse Mount  (`content/Positions/Reverse Mount.json`)
- **false-synonym-missing (high):** Mount ↔ Reverse Mount are on the denylist but neither file has the reciprocal `disambiguations[]`. Add to both: "Often confused with Mount/Reverse Mount — opposite facing direction."

### 19. Shoulder of Justice  (`content/Positions/Shoulder of Justice.json`)
- **false-synonym-missing (high):** Side Control ↔ Shoulder of Justice on denylist; neither file carries reciprocal disambiguations. Shoulder of Justice is a heavy cross-face/shoulder-pressure VARIANT often conflated with plain Side Control. Add reciprocal disambiguations.

### 20. Half Guard / Half Mount  (`content/Positions/Half Guard.json`)
- **false-synonym-missing (medium):** Half Guard ↔ Half Mount on denylist. `Half Mount.json` not present in slice (no file); Half Guard lacks the disambiguation. Flag: if a Half Mount page exists elsewhere, add reciprocal disambiguations; at minimum add a one-way "Often confused with Half Mount" note on Half Guard. Medium because the counterpart file's existence is unconfirmed in this slice.

### 21. Standing Position  (`content/Positions/Standing Position.json`)
- **alias (low):** `Standing`, `Neutral Standing`, `Feet` (slang). Low — these are descriptive, may not be worth alias pages.

### 22. Body Lock  (`content/Positions/Body Lock.json`)
- **alias (low):** `Bear Hug` (standing, over/under). Risk: "Bear Hug" can mean an over-both-arms variant — borderline variant. Low confidence; verify before apply.

---

## Positions with NO proposal (correctly bare or no strict synonym)

Modern/branded/descriptive names with no classic Japanese/Portuguese synonym and no obvious Wikipedia article — left as-is:

Anaconda Control, Aoki Lock Control, Armbar Control, Buggy Choke, Butterfly Guard*, Clamp Guard, Clinch, Collar Sleeve Guard, Combat Base, Crab Ride, Crackhead Control, Cross Body Ride, Crucifix*, Darce Control, Dead Orchard Control, Dogfight Position, Double Jump, Double Sleeve Guard, Double Unders, Estima Lock Control, Feet on Hips Guard, Front Headlock, Gift Wrap, Gogoplata Control, Grasshopper Guard, Guillotine Control, Hindulotine, Inverted Guard, Jailbreak, Kimura Trap, Kneebar Control, Lapel Guard, Lasso Guard, Leg Drag Control, Leg Hook, Leg Knot, Leg Weave, Matrix, Omoplata Control, Open Guard, Piranha Guard, Quarter Guard, Ringworm Guard, Rodeo Ride, Russian Cowboy, Seated Guard, Shin-to-Shin Guard, Spider Guard, Squid Guard, Standing Guard, Standing Rear Clinch, Straight Ankle Lock Control, Toe Hold Control, Triangle Control, Triangle Escape Position, Twister Control, Vaporizer, Williams Guard, Worm Guard.

\* Notes:
- **Butterfly Guard** — sometimes called "Hooks Guard" / "Sit-Up Guard"; weak/regional, not proposed.
- **Crucifix** — judo "Hadaka Jime"-adjacent? No. Crucifix has no clean single synonym; skipped.
- **Seated Guard** — "Sit-Up Guard" overlaps but is arguably a variant; skipped.
- Most "X Control" files (Toe Hold Control, Kneebar Control, etc.) INHERIT their parent submission's identity per the brief — no per-position aliases proposed.
