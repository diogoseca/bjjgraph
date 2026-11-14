// THE ORDER PRACTICE ASKS IN (v1.278.0, owner U171 a and his Anki rule, 13 Nov 2026) — pure and stateless: no clock, no
// DOM, no storage, no rng. Bundled into the deferred planner (gameplan.js, fetched when the drawer opens: U170 a) through
// gameplan.src.js, and imported as a module by the unit suite (tests/practice_queue.test.mjs).
//
// THE OWNER'S RULE. The order (U171 a): what comes up most in rolls and what you are closest to forgetting, position by
// position, at most 6 per position, every answer counting 1 toward 20. The day (his words, ANKI1): "we only add new cards if
// there's no due cards left to be reviewed according to the space repetition algo." So the 20 are the cards that are due,
// the ones worth most first; a new card comes only when nothing due is left. No place in the 20 is kept for new cards (the
// floor of 4 new the first push had, and the "16 due and 4 new" asked of him, are gone).
//
// THE LAW (`ngPracticeVisits`), step by step; the Practice simulation (qsim.mjs, policy A, kept outside the repo as the
// rating's is) plays the same day, and the unit suite replays its frozen records:
//   · every askable thing has a WORTH: its share of the game (the rating's own weight, how often it comes up in a roll) ×
//     what an answer would bring back. Owed (its schedule says it is due and it was not answered today): 1 − the recall its
//     stored row still promises (`ngRatingRecall`, the rating's own reading of a row). New (no row at all): 0.75.
//     That product is exactly what a right answer adds to "what you can recall right now", so the order spends the day's
//     answers where the number the belt reads rises most.
//   · THE GUARD: the 3 owed things due longest (by due day, then the input's order) are asked in every session whatever
//     their worth, so a light card cannot wait forever behind heavy ones. Only a thing KNOWN to be answerable is guarded
//     (`sure`: its deck is loaded and holds it, or the rating's live set says its deck still has it): a retired question
//     in a deck not loaded yet is exactly what has waited longest, and it would take a guard place every first session of
//     the day (ANKI1-R1, the reader's finding 2). Those the guard could not take for want of that knowledge are counted
//     (`counts.short`, R409): a plan built before the live set landed then does not hold "the three due longest", says so
//     (gameplan's explanation drops the sentence), and the app plans an untouched session again when the set lands
//     (`_practiceGuard`). The reader measured the first push: with worth
//     alone, 144 of 267 cards owed on day 1 were never asked in a year; with the two longest-due, none. Under this rule,
//     re-measured (the archive, v1.278.0): two still ask every one for a player with 300 cards stored, but leave 93 to 128
//     of 1,288 never asked in a year for one with 1,500; three is the smallest guard that leaves none for both, at no
//     measurable cost to the level (within 5 points of two's either way); four costs 6 to 11.
//   · WHAT IS DUE FIRST. A POSITION (a seat: a position and a role) is scored by the sum of its six best owed worths;
//     every position that owes anything is visited, best first. At a position: its guarded things, its owed moves by
//     worth, then its owed cards by worth, at most 6 a visit. The last places of the goal are kept for guarded things not
//     yet asked. When every position has had its visit and the goal is not reached, the positions with owed things left
//     are visited again, in the same order, until nothing is due or the goal is reached. Things with no position
//     ("loose") are one more position.
//   · NEW ONLY WHEN NOTHING DUE IN THIS RULESET'S GAME IS LEFT. With every owed thing asked and the goal not reached,
//     positions are scored by their
//     next new move's and next new card's worth and visited best first: up to 2 new moves, then new cards up to 4 new
//     things in all (a position with no new move to ask gives its slots to cards), never taking a position past 6 in the
//     day.
//   · every answer counts 1 toward the goal; the day stops there.
//   · ties are broken by the input's own order (the caller hands things in traffic order, a strict total order whose last
//     key is content), never by an index the content can renumber (CLAUDE.md §6.6, traps-wire.md).
//
// NOTHING IS GUESSED, NOTHING IS SILENT (traps-wire.md, "a CHECK THAT NEVER RAN"):
//   · a weight that is not a number means "this does not exist in this ruleset" (CLAUDE.md §3: null is not zero): the thing is
//     DROPPED and COUNTED (`outside`), never priced. A weight of 0 is a real "exists, never attempted": priced at 0, kept,
//     and still asked when due (it is due; it comes last). So a card due in a deck this ruleset hides (gi's twelve
//     "…-Control" positions, no-gi's 154 decks) or does not price never stops new cards, as Practice never asks what the
//     ruleset hides (every surface's rule): the page counts them (`outsideDue`) and sends the player to "Everything owed,
//     oldest first", where they are (ANKI1-R1, the reader's finding 1; the orchestrator's ruling: keep it, and say it).
//   · NEVER LOOKED IS NOT A SESSION. With no game (no manifest, no weights, no dealt hands), no seat map, or a record with no
//     answer in it, `ngPracticeOrder` returns a `status` naming why and no rows; the planner then builds today's order
//     (oldest first, new decks by the comparison or the weak spots) and says so (`plan.order`, `plan.orderStatus`).
//   · one question is ONE thing, however many decks share it: asked once, worth the sum of its decks' weights (the rating's
//     arithmetic), filed under one deck (its home) for the page.
//
// STAGE 3 ASKS CARDS ONLY. Today's Practice page has no way to ask a hidden move (that is Stage 4, the map asks), so the app
// hands no moves in: a visit is at most 6 question cards. The law takes moves (`kind: "move"`) for the parity and for Stage 4.
//
// research: docs/Changelog-Archive.md (v1.278.0).
import { ngRatingRecall, ngRatingQ16 } from "./rating.src.js";

const NG_PQ_CAP = 6;          // things asked at one position in a visit, at most (U171 a)
const NG_PQ_EACH = 2;         // a visit's new moves at most; its new things, moves and cards, at most twice that
const NG_PQ_BEST = 6;         // a position's owed worth is its six best
const NG_PQ_NEW = 0.75;       // what an answer to a never-answered thing brings back
const NG_PQ_GUARD = 3;        // the owed things due longest, asked every session whatever their worth
const NG_PQ_SLOTS = 4;        // new cards a deck can give in one day: its visit's 4

function ngPqNum(v) { return typeof v === "number" && Number.isFinite(v); }
function ngPqRow(r) { return Array.isArray(r) && r.length >= 3 && ngPqNum(r[0]) && ngPqNum(r[1]) && ngPqNum(r[2]) && r[1] > 0; }

/**
 * THE LAW. `items` in traffic order (heaviest first), each {id, kind: "move" | "card", seat: string | null, w, row, stage}:
 *   w      the thing's share of the game; not a number = not in this ruleset (dropped, counted)
 *   row    its stored schedule row [due, interval, last day, (a move's answer)], or null for never answered
 *   stage  a card's highest stage (a row of interval 1 with a stage is read as right, the rating's rule)
 *   sure   false when the thing is not known to be answerable yet (never guarded, and counted in `counts.short` when it
 *          is one of the due longest); absent or true otherwise
 * Returns {visits: [{seat, ids}], guard: [ids], asked: [ids in order], counts, n, fresh}. `goal` is what is left of the
 * day's goal. A position can have more than one visit (what is due, asked again past its 6; its new things).
 */
export function ngPracticeVisits({ items = [], day, goal = 20, guard = NG_PQ_GUARD, cap = NG_PQ_CAP } = {}) {
  const counts = { items: 0, owed: 0, fresh: 0, outside: 0, today: 0, later: 0, badRow: 0, twice: 0, short: 0 };
  const seatIx = new Map(), seatList = [], seatItems = [], worth = new Map(), owed = new Map(), isNew = new Set(), seen = new Set();
  const owedList = [];
  for (const it of items) {
    if (!it) continue;
    if (seen.has(it.id)) { counts.twice++; continue; }   // one thing, asked once
    seen.add(it.id); counts.items++;
    if (!ngPqNum(it.w) || it.w < 0) { counts.outside++; continue; }
    const s = it.seat == null ? "" : String(it.seat);
    let k = seatIx.get(s);
    if (k == null) { seatIx.set(s, (k = seatList.length)); seatList.push(s); seatItems.push([]); }
    seatItems[k].push(it);
    const r = it.row;
    if (r == null) { isNew.add(it.id); worth.set(it.id, it.w * NG_PQ_NEW); counts.fresh++; continue; }
    if (!ngPqRow(r)) { counts.badRow++; continue; }
    if (r[2] >= day) { counts.today++; continue; }    // answered today: it already counted
    if (r[0] > day) { counts.later++; continue; }     // not due yet
    const right = it.kind === "move" ? r[3] === 1 : r[1] > 1 || (ngPqNum(it.stage) && it.stage > 0);
    worth.set(it.id, it.w * (1 - ngRatingRecall(r, right, day)));
    counts.owed++; owedList.push(it);
    (owed.get(k) || owed.set(k, []).get(k)).push(it);
  }
  const W = (it) => worth.get(it.id), byWorth = (a, b) => W(b) - W(a);
  // THE GUARD: the owed things due longest, by due day, then the input's order; `short`, those of the due longest it could
  // not take because they are not known to be answerable yet
  const byDue = owedList.map((it, i) => [it, i]).sort((a, b) => a[0].row[0] - b[0].row[0] || a[1] - b[1]), places = Math.max(0, Math.min(guard, goal));
  const kept = new Map(byDue.filter((e) => e[0].sure !== false).slice(0, places).map((e, i) => [e[0].id, i]));
  counts.short = byDue.slice(0, places).filter((e) => e[0].sure === false).length;
  const visits = [], out = [], at = new Map();
  let n = 0, fresh = 0, left = kept.size;
  const ask = (it, k) => { out.push(it.id); n++; at.set(k, (at.get(k) || 0) + 1); if (isNew.has(it.id)) fresh++; };
  // 1. WHAT IS DUE: every position that owes anything, best first, at most `cap` a visit, again until nothing is due
  const score = new Map();
  for (const [k, L] of owed) score.set(k, L.map(W).sort((a, b) => b - a).slice(0, NG_PQ_BEST).reduce((x, y) => x + y, 0));
  const order = [...score.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map((e) => e[0]);
  const plans = new Map(order.map((k) => {
    const L = owed.get(k), g = L.filter((it) => kept.has(it.id)).sort((a, b) => kept.get(a.id) - kept.get(b.id));
    const rest = L.filter((it) => !kept.has(it.id));
    return [k, [...g, ...rest.filter((it) => it.kind === "move").sort(byWorth), ...rest.filter((it) => it.kind !== "move").sort(byWorth)]];
  }));
  for (let more = true; more && n < goal;) {
    more = false;
    for (const k of order) {
      if (n >= goal) break;
      const L = plans.get(k), ids = [];
      while (L.length && ids.length < cap && n < goal) {
        const it = L.shift(), g = kept.has(it.id);
        if (!g && n + left >= goal) continue;           // the last places are the guard's
        ask(it, k); ids.push(it.id); if (g) left--;
      }
      if (ids.length) { visits.push({ seat: seatList[k] || null, ids }); more = true; }
    }
  }
  // 2. NEW, ONLY WHEN NOTHING IS DUE: positions by their next new move's and next new card's worth
  if (n < goal) {
    const firstNew = (k, kind) => seatItems[k].find((it) => isNew.has(it.id) && it.kind === kind);
    const fresh0 = [];
    for (let k = 0; k < seatList.length; k++) {
      const m = firstNew(k, "move"), c = firstNew(k, "card"), v = (m ? W(m) : 0) + (c ? W(c) : 0);
      if (v > 0) fresh0.push([k, v]);
    }
    fresh0.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    for (const [k] of fresh0) {
      if (n >= goal) break;
      const newM = [], newC = [];
      for (const it of seatItems[k]) {
        if (!isNew.has(it.id)) continue;
        if (it.kind === "move") { if (newM.length < NG_PQ_EACH) newM.push(it); } else if (newC.length < 2 * NG_PQ_EACH) newC.push(it);
        if (newM.length >= NG_PQ_EACH && newC.length >= 2 * NG_PQ_EACH) break;
      }
      newC.splice(2 * NG_PQ_EACH - newM.length);
      const plan = [...newM, ...newC].slice(0, Math.max(0, cap - (at.get(k) || 0))), ids = [];
      for (const it of plan) { if (n >= goal) break; ask(it, k); ids.push(it.id); }
      if (ids.length) visits.push({ seat: seatList[k] || null, ids });
    }
  }
  return { visits, guard: [...kept.keys()], asked: out, counts, n, fresh };
}

/**
 * THE APP'S RECORD AS THE LAW'S THINGS, question cards only (Stage 3). Pure.
 *   srs    {deckKey: {qh: row}}   stage {deckKey: {qh: 0..4}}   day: today's epoch day
 *   decks  the planner's deck descriptors {deckKey: {count, questions, exact, allowed}} (`_gameplanDecks`)
 *   game   the rating's game for this ruleset (`ngRatingUniverse`): {status, deckUnit, shared}
 *   seats  {deckKey: seat}: the position (Family|Top or Family|Bottom) each deck is asked at (the app's `_practiceSeats`)
 * One thing per question: its weight is the sum of its priced decks' unit weights (deck weight / card count), its row the
 * latest of its rows (the same-day tie to the smaller interval, the cloud merge's rule), its stage the highest; it is filed
 * under its HOME deck, the first of its decks that is priced, has a seat and (once loaded) still holds it. A deck's new
 * cards: the known questions with no row, and, while its cards are not loaded, up to 3 placeholders (`slot`) the page binds
 * to the deck's first unanswered cards when they land. `live` is the rating's live set when the app already holds it
 * (`_ratingLiveNow`, PR #405; never fetched here): a stored question its deck no longer has is dropped and counted
 * (`blocked`), and only a question known to be answerable is `sure` (the guard's own test). Returns {status, items,
 * counts}; status "ok" or why not. `counts.outsideDue`: due questions no deck of this ruleset's game prices.
 */
export function ngPracticeItems({ day, srs, stage, decks, game, seats, live } = {}) {
  const counts = { questions: 0, outside: 0, outsideDue: 0, unknownDeck: 0, blocked: 0, slots: 0 };
  const fail = (status) => ({ status, items: [], counts });
  if (!game || game.status !== "ok" || !(game.deckUnit instanceof Map)) return fail((game && game.status !== "ok" && game.status) || "no-game");
  if (!seats || !Object.keys(seats).length) return fail("no-seats");
  if (!decks || !Object.keys(decks).length) return fail("no-manifest");
  const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
  const unit = (dk) => (own(decks, dk) && decks[dk].allowed !== false ? game.deckUnit.get(dk) : undefined);
  // a question is live in a deck (true), gone from it (false) or not known yet (null): the rating's own reading
  // (`ngRatingShare`'s `isLive`, PR #405): a shared question's decks are the boot manifest's index, any other is looked up
  // in its deck's live set. A loaded deck's own cards say it outright.
  const L = live && live.status === "ok" && live.decks instanceof Map ? live : null;
  const liveIn = (dk, qh) => {
    const S = game.shared && game.shared.get(qh);
    if (S) return S.includes(dk);
    if (!L) return null;
    const set = L.decks.get(dk);
    return set ? set.has(ngRatingQ16(qh)) : null;
  };
  const holds = (dk, qh) => own(decks, dk) && (!decks[dk].exact || (decks[dk].questions || []).includes(qh)) && liveIn(dk, qh) !== false;
  const sure = (dk, qh) => own(decks, dk) && ((decks[dk].exact && (decks[dk].questions || []).includes(qh)) || liveIn(dk, qh) === true);
  const byQ = new Map();
  for (const dk of Object.keys(srs || {})) {
    const rows = srs[dk];
    if (!rows || typeof rows !== "object") continue;
    for (const qh of Object.keys(rows)) {
      const r = rows[qh];
      if (!ngPqRow(r)) continue;
      let q = byQ.get(qh);
      if (!q) byQ.set(qh, (q = { row: r, decks: [] }));
      else if (r[2] > q.row[2] || (r[2] === q.row[2] && r[1] < q.row[1])) q.row = r;
      q.decks.push(dk);
    }
  }
  if (!byQ.size) return fail("empty");
  const st = (qh, list) => list.reduce((m, dk) => Math.max(m, (stage && stage[dk] && ngPqNum(stage[dk][qh]) && stage[dk][qh]) || 0), 0);
  // the decks a question is in, its weight and its home; null when no deck of this ruleset's game prices it
  const place = (qh, list) => {
    let w = 0, priced = false, home = null, loose = null;
    for (const dk of list) {
      const u = unit(dk);
      if (!ngPqNum(u)) continue;
      priced = true; w += u;
      if (holds(dk, qh)) { if (!home && seats[dk]) home = dk; if (!loose) loose = dk; }
    }
    return priced ? { w, deck: home || loose, seat: home ? seats[home] : null } : null;
  };
  const items = [];
  for (const [qh, q] of byQ) {
    counts.questions++;
    const list = (game.shared && game.shared.get(qh)) || q.decks;
    if (!list.some((dk) => own(decks, dk))) { counts.unknownDeck++; continue; }
    const p = place(qh, list);
    if (!p) { counts.outside++; if (q.row[0] <= day && q.row[2] < day) counts.outsideDue++; continue; }
    if (!p.deck) { counts.blocked++; continue; }      // a removed copy everywhere: it stays owed, never asked from nowhere
    items.push({ id: qh, kind: "card", seat: p.seat, w: p.w, row: q.row, stage: st(qh, list), deck: p.deck, sure: sure(p.deck, qh) });
  }
  const taken = new Set(byQ.keys());
  for (const dk of Object.keys(decks)) {
    const d = decks[dk], u = unit(dk);
    if (!ngPqNum(u) || !(d.count > 0)) continue;
    const known = [...new Set(d.questions || [])], fresh = known.filter((qh) => !taken.has(qh));
    let left = NG_PQ_SLOTS;
    for (const qh of fresh) {
      if (!left) break;
      taken.add(qh);
      const p = place(qh, (game.shared && game.shared.get(qh)) || [dk]);
      if (!p || !p.deck) continue;
      items.push({ id: qh, kind: "card", seat: p.seat, w: p.w, row: null, deck: p.deck });
      if (p.deck === dk) left--;
    }
    const pending = d.exact ? 0 : Math.min(left, Math.max(0, d.count - known.length));
    for (let i = 0; i < pending; i++) { items.push({ id: dk + "#" + i, kind: "card", seat: seats[dk] || null, w: u, row: null, deck: dk, slot: true }); counts.slots++; }
  }
  // TRAFFIC ORDER, a strict total order: heaviest first, then the id (content)
  items.sort((a, b) => b.w - a.w || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { status: "ok", items, counts };
}

/**
 * THE DAY'S ROWS, in the shape today's Practice page already plays (one row per deck, in visit order). Pure.
 * Returns {status, rows, visits, counts, law}: `rows` [{key, seat, visit, questions, owed, pending, count}], `visits`
 * [{seat, keys}], one a position (a position the law visited twice is one position on the page, its rows together),
 * `counts` {built: the builder's, law: the law's, asked, askedNew}.
 */
export function ngPracticeOrder({ day, goal, srs, stage, decks, game, seats, live } = {}) {
  const built = ngPracticeItems({ day, srs, stage, decks, game, seats, live });
  if (built.status !== "ok") return { status: built.status, rows: [], visits: [], counts: { built: built.counts } };
  const law = ngPracticeVisits({ items: built.items, day, goal: Math.max(0, goal) });
  const byId = new Map(built.items.map((it) => [it.id, it]));
  const visits = [], seatVisit = new Map(), rows = new Map();
  const put = (id, v) => {
    const it = byId.get(id);
    let r = rows.get(it.deck);
    if (!r) rows.set(it.deck, (r = { key: it.deck, seat: it.seat, visit: v, questions: [], owed: [], pending: 0, at: rows.size }));
    if (it.slot) r.pending++; else r.questions.push(id);
    if (it.row) r.owed.push(id);
    if (!visits[r.visit].keys.includes(r.key)) visits[r.visit].keys.push(r.key);
  };
  for (const v of law.visits) {
    if (!seatVisit.has(v.seat)) seatVisit.set(v.seat, visits.push({ seat: v.seat, keys: [] }) - 1);
    for (const id of v.ids) put(id, seatVisit.get(v.seat));
  }
  const list = [...rows.values()].sort((a, b) => a.visit - b.visit || a.at - b.at)
    .map(({ at, ...r }) => ({ ...r, count: r.questions.length + r.pending }));
  // `lawVisits`: each visit the law made, its position and its size (at most 6), before the page folds a second visit of a
  // position into its first (ANKI1-R1, the reader's finding 4: the page then shows them all, in order)
  return { status: "ok", rows: list, visits, counts: { built: built.counts, law: law.counts, asked: law.n, askedNew: law.fresh,
    lawVisits: law.visits.map((v) => [v.seat, v.ids.length]) }, law };
}
