// THE RATING (v1.269.0, owner 13 Nov 2026: "a, What you can recall right now"; "a, Even belts"; black = the top of
// our own scale) — pure, stateless and shared like belt.src.js: concatenated into the bundle by
// neural/build/build.mjs (exports stripped), imported as a module by the unit suite, importable by the digest Worker.
// STAGE 1: computed and tested, shown nowhere. Nothing here writes storage, and nothing in the app paints it yet.
//
// THE NUMBER is the share of the game you can recall NOW, put on a points scale:
//
//     points = 1000 + 1000 × share            (NG_RATING_FLOOR, NG_RATING_TOP: 2000 = everything, recalled)
//
// "The game" is every flashcard question and every dealt move, each WEIGHTED BY HOW OFTEN IT COMES UP IN A ROLL in
// this ruleset — the arithmetic Game Knowledge already uses (`gameScore`), with the moves added:
//   · a question is worth Σ over the decks that carry it of (deck weight / the deck's card count). A question the
//     manifest's `shared` index lists in several decks is ONE question, read once and paid for every deck it is in
//     (that is how its schedule is written: `ngKnowledgeApplyGrade` files one row per shared deck).
//   · a move is worth (its seat's weight) × (its attempt share in that seat's dealt hand) / 100. Seat weight and deck
//     weight are the same `scoreWeights(frame)` entry, so a position's traffic pays for its cards AND its moves; that
//     is the weighting the seat's simulation measured (moves ≈ a quarter of the game) and the owner kept.
//   The denominator is everything there is: Σ every weighted deck + Σ every dealt move. It never shrinks to what you
//   have studied, which is why a farmer of the 50 easiest cards reads ~1.0% of the game and not 100%.
//
// WHAT ONE STORED ROW SAYS (`ngRatingRecall`), from the fields the app already keeps and nothing else:
//   · a row whose last answer was right fades 10% per interval since it was answered: 0.9 ^ (days since / interval),
//     so a card is read at 0.9 on its due day and keeps falling while it is overdue. Never below 0, never above 1.
//   · an interval of 1 is AMBIGUOUS in storage (a first right answer, or a miss that reset the ladder). A question
//     with any stage, or a move whose last answer was a Yes, is read as right at 0.9 (NG_RATING_UNSURE); with no
//     stage (or a No) it is a miss.
//   · a miss is worth 0. Not a half: the schedule already brings it back tomorrow.
//   · a question with a stage but no schedule (a blob from before v1.105.0, which wrote no `srs`) is worth 0 here
//     and COUNTED (`stageOnly`), so a later stage can decide what an old player's unscheduled learning is worth. A
//     record made ONLY of such stages reads status "unscheduled" (the points as the definition gives them, 1000), never
//     "ok", so no surface paints it by accident (READ402 F5).
//   · A DECK NEVER COUNTS FOR MORE THAN ITS OWN FULL WORTH: the questions priced in a deck add up to at most its card
//     count (READ402 F2), and a deck holding more priced questions than cards is COUNTED (`decksOver`, and the rows
//     beyond its card count, `rowsOver`).
//   Nothing credits a card you have never answered: this is C0 of the seat's simulation (ELO1, kept outside the repo):
//   no credit yet for what you knew before the app — that needs a first-answer record, a later stage.
//
// NOT COVERED — A RETIRED QUESTION READS AS A LIVE ONE. The manifest carries a card COUNT per deck, not its questions,
// so this module cannot tell a row for a question the deck still holds from a row for one that was rewritten or removed
// (and stored rows are never pruned). A deck with retired rows can therefore read as fully known when it is not; the cap
// above stops it reading as MORE than known, and `decksOver` / `rowsOver` show it happened, but they cannot see a deck
// whose live and retired rows together stay under its count. This must be settled before any surface shows the number.
//
// NOTHING IS GUESSED, AND NOTHING SILENT (CLAUDE.md §6.6, traps-wire.md "a CHECK THAT NEVER RAN"):
//   · a weight or a share that is `null` means "this does not exist in this ruleset" (CLAUDE.md §3) — it is dropped
//     and counted (`absent`), never read as 0 and never as a value;
//   · a zero weight is a real "exists, never attempted": it weighs nothing and is counted (`zeroWeight`);
//   · a row for a deck the manifest does not know, a move this ruleset does not deal at that seat, an escape (no
//     share in any hand) or a malformed row is counted by reason and skipped;
//   · NEVER LOOKED IS NOT A NUMBER. No manifest, no weights, no dealt hands, a record with no answer in it, or one
//     whose every row is malformed, in a deck the manifest does not have or at a seat this ruleset does not deal
//     ("unmatched", READ402 F1) returns
//     `points: null` and a `status` naming why — never 1000, never 0. Only "ok" and "unscheduled" carry a number.
//   · The app's loader turns a null attempt cell on the wire into 0 before this module sees it (`ingest`'s `cal.ev` /
//     `cal.evGi` expansion, `att[k] || 0`); the wire carries none today, so the `absent` path is exercised by the
//     units, not by the shipped data (READ402 F8).
//
// THE BELT LINES are table a (owner U160 a, "Even belts"): white from 1000, its stripes counted from 1160 one every
// 32 (1192, 1224, 1256, 1288); blue from 1320 and purple from 1480, a stripe every 32; brown from 1640, every 40;
// black from 1840, no stripes. A LEVEL is 5 × belt + stripes: 0 (white, none) … 19 (brown, 4) … 20 (black).
// The NUMBER may fall; the belt never does — holding it is the caller's (`belts.held`), so `ngRatingNext` takes the
// held level and measures the goal from max(held, the number's own level).
//
// research: docs/Changelog-Archive.md (v1.269.0); the simulation this module was matched to is the seat's, kept outside
// the repo (the parity statement and its limits are in tests/rating.test.mjs's header).

/** The points scale's ends: nothing recalled, everything recalled. */
export const NG_RATING_FLOOR = 1000;
export const NG_RATING_TOP = 2000;
/** A right answer's recall at the end of its interval, and per interval after it (a 10% fade per interval). */
export const NG_RATING_FADE = 0.9;
/** An interval-1 row that may be a first right answer or a reset: read as right, at this. */
export const NG_RATING_UNSURE = 0.9;

/**
 * TABLE A, the owner's (U160 a). Each belt's `from` is where its own count starts and `step` the width of one stripe;
 * white's `from` (1160) is the line its first stripe is counted from, and white itself starts at the floor. Four
 * stripes then the next belt: from + 5 × step is the next belt's `from` on every row (pinned by the unit suite).
 */
export const NG_RATING_TABLE = Object.freeze([
  Object.freeze({ belt: 0, from: 1160, step: 32 }),
  Object.freeze({ belt: 1, from: 1320, step: 32 }),
  Object.freeze({ belt: 2, from: 1480, step: 32 }),
  Object.freeze({ belt: 3, from: 1640, step: 40 }),
  Object.freeze({ belt: 4, from: 1840, step: 0 }),
]);
/** Level 20 is black; black has no stripes. */
export const NG_RATING_BLACK = 20;

function ngRatingOwn(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
function ngRatingNum(v) { return typeof v === "number" && Number.isFinite(v); }

/** points for a share in [0, 1] (clamped). */
export function ngRatingPoints(share) {
  const s = ngRatingNum(share) ? Math.max(0, Math.min(1, share)) : 0;
  return NG_RATING_FLOOR + (NG_RATING_TOP - NG_RATING_FLOOR) * s;
}

/** The level a number reaches: 0..20 (5 × belt rank + stripes; 20 = black). null for anything that is not a number. */
export function ngRatingLevel(points) {
  if (!ngRatingNum(points)) return null;
  const T = NG_RATING_TABLE;
  if (points >= T[4].from) return NG_RATING_BLACK;
  for (let k = 3; k >= 0; k--) {
    if (points >= T[k].from) return 5 * k + Math.min(4, Math.floor((points - T[k].from) / T[k].step));
  }
  return 0;
}

/** The lowest number that reaches level L (0..20). Level 0 is the floor. null for anything that is not a number. */
export function ngRatingLevelFloor(L) {
  if (!ngRatingNum(L)) return null;
  const T = NG_RATING_TABLE;
  const l = Math.max(0, Math.min(NG_RATING_BLACK, Math.floor(L)));
  if (l >= NG_RATING_BLACK) return T[4].from;
  if (l === 0) return NG_RATING_FLOOR;
  const k = Math.floor(l / 5), s = l % 5;
  return T[k].from + s * T[k].step;
}

/** {belt: 0..4, stripes: 0..4} of a level (black: stripes 0). null for anything that is not a number. */
export function ngRatingBeltOf(L) {
  if (!ngRatingNum(L)) return null;
  const l = Math.max(0, Math.min(NG_RATING_BLACK, Math.floor(L)));
  return l >= NG_RATING_BLACK ? { belt: 4, stripes: 0 } : { belt: Math.floor(l / 5), stripes: l % 5 };
}

/**
 * THE NEXT GOAL, for a number and the level already held (a stripe high-water mark; null/absent = none).
 *   level   the number's own level
 *   held    max(level, heldLevel): the belt and stripes the player wears — never below what they hold
 *   next    held + 1, or null at black
 *   at      the number where `next` starts; at black, the top of the scale (2000)
 *   toNext  points from the number to `at` (0 if past it)
 *   toHeld  points from the number up to the floor of `held` (0 unless the number sits below what they hold)
 * The wording of the bar when the number sits below the held level is the owner's (Stage 2); both distances are here.
 */
export function ngRatingNext(points, heldLevel) {
  const level = ngRatingLevel(points);
  if (level == null) return null;
  const h = ngRatingNum(heldLevel) ? Math.max(0, Math.min(NG_RATING_BLACK, Math.floor(heldLevel))) : 0;
  const held = Math.max(level, h);
  const next = held >= NG_RATING_BLACK ? null : held + 1;
  const at = next == null ? NG_RATING_TOP : ngRatingLevelFloor(next);
  return { level, held, next, at, toNext: Math.max(0, at - points), toHeld: Math.max(0, ngRatingLevelFloor(held) - points) };
}

/**
 * What one stored row is worth now, 0..1.
 *   row   [due, interval, last day, …] as `ngKnowledgeScheduleRow` writes it (a moves row adds the answer at [3])
 *   right whether the last answer stands as right (see the header for the interval-1 reading)
 *   day   today's epoch day
 * null for a malformed row (the caller counts it).
 */
export function ngRatingRecall(row, right, day) {
  if (!Array.isArray(row) || row.length < 3 || !ngRatingNum(row[1]) || !ngRatingNum(row[2]) || row[1] <= 0 || !ngRatingNum(day)) return null;
  if (!right) return 0;
  const ivl = row[1], since = Math.max(0, day - row[2]);
  return Math.pow(NG_RATING_FADE, since / ivl) * (ivl > 1 ? 1 : NG_RATING_UNSURE);
}

/**
 * THE GAME, for one ruleset: what every question and dealt move weighs, and the total. Built once per ruleset and
 * manifest by the caller, then read by `ngRatingShare` on every record.
 *   decks    {deckKey: {n}}  the manifest's decoded decks (`n` = its card count; 0 or missing = no deck)
 *   weights  {deckKey: w}    `scoreWeights(frame)`: a position seat "<Family>|Top|Bottom", a technique
 *                            "<Name>|Attacker|Defender"; missing = not attemptable in this ruleset; null = absent
 *   shared   Map | {qh: [deckKey, …]}  the manifest's shared-question index, already decoded to deck keys
 *   seats    {"<posOrd>/<role>": {w: seat weight | null, hand: {"<techOrd>": attempt % | null}}}  every seat this
 *            ruleset deals, each with its DEALT hand and each move's share of it (the frame's own table)
 * Returns {status, total, factTotal, moveTotal, decks, deckUnit, seats, shared, counts}. status is "ok", or names
 * what is missing ("no-manifest", "no-weights", "no-hands") — then nothing built from it carries a number.
 * counts (positive, so a join that matched nothing cannot pass for a light game): decks and seats weighed, moves
 * dealt, cells `absent` (null), cells of `zeroWeight`.
 */
export function ngRatingUniverse(input) {
  const inp = input || {};
  const counts = { decks: 0, seats: 0, dealt: 0, absent: 0, zeroWeight: 0 };
  const out = { status: "ok", total: 0, factTotal: 0, moveTotal: 0, decks: new Set(), deckUnit: new Map(),
    deckN: new Map(), seats: new Map(), shared: new Map(), counts };
  const decks = inp.decks, weights = inp.weights, seats = inp.seats;
  if (!decks || typeof decks !== "object" || !Object.keys(decks).length) { out.status = "no-manifest"; return out; }
  if (!weights || typeof weights !== "object" || !Object.keys(weights).length) { out.status = "no-weights"; return out; }
  if (!seats || typeof seats !== "object" || !Object.keys(seats).length) { out.status = "no-hands"; return out; }
  for (const dk of Object.keys(decks)) {
    const d = decks[dk], n = d && ngRatingNum(d.n) ? d.n : 0;
    if (!(n > 0)) continue;
    out.decks.add(dk);
    if (!ngRatingOwn(weights, dk)) continue;           // not attemptable in this ruleset (the expansion skips it)
    const w = weights[dk];
    if (!ngRatingNum(w) || w < 0) { counts.absent++; continue; }   // §3: null is "does not exist here", never zero
    if (w === 0) counts.zeroWeight++; else counts.decks++;
    out.deckUnit.set(dk, w / n);
    out.deckN.set(dk, n);
    out.factTotal += w;
  }
  for (const st of Object.keys(seats)) {
    const s = seats[st] || {}, hand = s.hand || {};
    const shares = new Map();
    for (const mv of Object.keys(hand)) {
      const att = hand[mv];
      counts.dealt++;
      if (!ngRatingNum(s.w) || s.w < 0 || !ngRatingNum(att) || att < 0) { counts.absent++; shares.set(mv, null); continue; }
      const v = s.w * att / 100;
      if (v === 0) counts.zeroWeight++;
      shares.set(mv, v);
      out.moveTotal += v;
    }
    counts.seats++;
    out.seats.set(st, shares);
  }
  const sh = inp.shared;
  const put = (qh, list) => { if (Array.isArray(list) && list.length > 1) out.shared.set(qh, [...new Set(list)]); };
  if (sh instanceof Map) { for (const [qh, list] of sh) put(qh, list); }
  else if (sh && typeof sh === "object") { for (const qh of Object.keys(sh)) put(qh, sh[qh]); }
  out.total = out.factTotal + out.moveTotal;
  if (!(out.total > 0)) out.status = "no-weights";
  return out;
}

/**
 * THE SHARE OF THE GAME RECALLED NOW, and its number.
 *   universe  an `ngRatingUniverse` result
 *   record    {srs: {deckKey: {qh: row}}, stage: {deckKey: {qh: 0..4}}, moves: {"<posOrd>/<role>": {mv: row}}}
 *   day       today's epoch day
 * Returns {status, share, points, level, counts}. "ok" carries a number when at least one row met the game (priced,
 * or known to be outside this ruleset's game). "unscheduled" carries the number the definition gives (1000) for a
 * record made only of stages with no schedule, so a caller must choose to show it. Every other status carries
 * `share`, `points` and `level` null: the game's own ("no-manifest", "no-weights", "no-hands"), "no-day", "empty"
 * (not one answer stored, and no stage either) or "unmatched" (rows, but every one malformed or in an unknown deck).
 * counts (the game's, plus): `rows` read, `questions` and `moves` they make, `weighted` (each one priced, possibly at
 * 0), and every row left out, by reason — `outside` (its deck or move is not in this ruleset's game: no weight, a
 * null cell, a move this seat does not deal, an escape), `unknownDeck` (a deck the manifest does not have),
 * `unknownSeat` (a seat this ruleset does not deal), `badRow` (malformed), `stageOnly` (a stage with no schedule); and `decksOver` / `rowsOver`, decks priced for more
 * questions than they have cards and the questions beyond (their worth is capped at the deck's own).
 */
export function ngRatingShare(universe, record, day) {
  const U = universe || {};
  const counts = Object.assign({ rows: 0, questions: 0, moves: 0, weighted: 0, outside: 0, unknownDeck: 0, badRow: 0, stageOnly: 0,
    unknownSeat: 0, decksOver: 0, rowsOver: 0 }, U.counts || {});
  const none = (status) => ({ status, share: null, points: null, level: null, counts });
  if (U.status !== "ok" || !(U.total > 0)) return none(U.status && U.status !== "ok" ? U.status : "no-weights");
  if (!ngRatingNum(day)) return none("no-day");
  const rec = record || {}, srs = rec.srs || {}, stage = rec.stage || {}, moves = rec.moves || {};
  // QUESTIONS: one per question hash, whichever decks its rows sit in. Its decks are the shared index's list when the
  // question is shared, else the decks holding a row for it. Its row is the latest (`last`), the same-day tie going to
  // the smaller interval (the cloud merge's own rule); its stage is the highest any of its decks holds.
  const byQ = new Map();
  for (const dk of Object.keys(srs)) {
    const rows = srs[dk];
    if (!rows || typeof rows !== "object") continue;
    for (const qh of Object.keys(rows)) {
      counts.rows++;
      const r = rows[qh];
      if (!Array.isArray(r) || r.length < 3 || !ngRatingNum(r[1]) || !ngRatingNum(r[2]) || r[1] <= 0) { counts.badRow++; continue; }
      let q = byQ.get(qh);
      if (!q) byQ.set(qh, (q = { row: r, decks: new Set() }));
      else if (r[2] > q.row[2] || (r[2] === q.row[2] && r[1] < q.row[1])) q.row = r;
      q.decks.add(dk);
    }
  }
  for (const dk of Object.keys(stage)) {
    const rows = stage[dk];
    if (!rows || typeof rows !== "object") continue;
    for (const qh of Object.keys(rows)) if (!byQ.has(qh) && ngRatingNum(rows[qh]) && rows[qh] > 0) counts.stageOnly++;
  }
  // each question's worth is booked to the decks it is priced in, and a deck is capped at its own full worth (F2)
  const perDeck = new Map();
  for (const [qh, q] of byQ) {
    const decks = U.shared.get(qh) || [...q.decks];
    let priced = false, inManifest = false, st = 0;
    for (const dk of decks) {
      if (U.deckUnit.has(dk)) priced = true;
      if (U.decks.has(dk)) inManifest = true;
      const s = stage[dk] && stage[dk][qh];
      if (ngRatingNum(s) && s > st) st = s;
    }
    counts.questions++;
    if (!priced) { if (inManifest) counts.outside++; else counts.unknownDeck++; continue; }
    counts.weighted++;
    const k = ngRatingRecall(q.row, q.row[1] > 1 || st > 0, day);
    for (const dk of decks) {
      if (!U.deckUnit.has(dk)) continue;
      const d = perDeck.get(dk) || perDeck.set(dk, { k: 0, rows: 0 }).get(dk);
      d.k += k; d.rows++;
    }
  }
  let got = 0;
  for (const [dk, d] of perDeck) {
    const n = U.deckN.get(dk);
    if (d.rows > n) { counts.decksOver++; counts.rowsOver += d.rows - n; }
    got += U.deckUnit.get(dk) * Math.min(d.k, n);
  }
  // MOVES: one per seat and move, priced by its share of that seat's dealt hand in this ruleset.
  for (const st of Object.keys(moves)) {
    const rows = moves[st];
    if (!rows || typeof rows !== "object") continue;
    const hand = U.seats.get(st);
    for (const mv of Object.keys(rows)) {
      counts.rows++;
      const r = rows[mv];
      if (!Array.isArray(r) || r.length < 4 || !ngRatingNum(r[1]) || !ngRatingNum(r[2]) || r[1] <= 0) { counts.badRow++; continue; }
      counts.moves++;
      if (!hand) { counts.unknownSeat++; continue; }    // a seat this ruleset does not deal: the row met nothing here
      const v = hand.get(mv);
      if (v == null) { counts.outside++; continue; }   // not dealt at this seat here, an escape, or a null cell
      counts.weighted++;
      got += v * ngRatingRecall(r, r[3] === 1, day);
    }
  }
  // a number only when a row MET the game (READ402 F1): rows that are all malformed or all in unknown decks are not
  // "nothing known", they are "nothing read", and a record of stages alone is its own case (F5)
  if (!counts.weighted && !counts.outside) {
    if (counts.stageOnly) return { status: "unscheduled", share: 0, points: NG_RATING_FLOOR, level: 0, counts };
    return none(counts.rows ? "unmatched" : "empty");
  }
  const share = Math.max(0, Math.min(1, got / U.total));
  const points = ngRatingPoints(share);
  return { status: "ok", share, points, level: ngRatingLevel(points), counts };
}
