// THE ORDER PRACTICE ASKS IN (v1.274.0, owner U171 a, 13 Nov 2026: "What is worth most") — pure and stateless: no clock,
// no DOM, no storage, no rng. Bundled into the deferred planner (gameplan.js, fetched when the drawer opens: U170 a) through
// gameplan.src.js, and imported as a module by the unit suite (tests/practice_queue.test.mjs).
//
// THE OWNER'S RULE, as the option he picked put it: what comes up most in rolls and what you are closest to forgetting,
// position by position; about 4 positions a session, at each about 2 hidden moves and then about 3 question cards, at most 6
// per position; every answer counts 1 toward 20; at least 4 new things a day, so the 80/20 blend stays.
//
// THE LAW (`ngPracticeVisits`), step by step the simulation's policy V that the plan measured (the Practice simulation,
// qsim.mjs, kept outside the repo as the rating's is; its frozen records and the parity statement are in the unit suite):
//   · every askable thing has a WORTH: its share of the game (the rating's own weight, how often it comes up in a roll) ×
//     what an answer would bring back. Owed (its schedule says it is due and it was not answered today): 1 − the recall its
//     stored row still promises (`ngRatingRecall`, the rating's own reading of a row). New (no row at all): 0.75.
//     That product is exactly what a right answer adds to "what you can recall right now", so the order spends the day's
//     answers where the number the belt reads rises most.
//   · a POSITION (a seat: a position and a role) is scored by the sum of its six best owed worths, plus its next new move's
//     and its next new card's. Positions are visited best first; a position scoring nothing is not visited.
//   · AT A POSITION: its owed moves (by worth), up to 2 new moves, its owed cards (by worth), then new cards up to 4 new
//     things in all (a position that has no new move to ask gives its slots to cards: in Stage 3 a new player's 20 is 5
//     positions, not 10) — at most 6 things. Things with no position ("loose") are one more visit, scored by their owed
//     worth alone.
//   · every answer counts 1 toward the goal; the visits stop when the goal is reached.
//   · AT LEAST `floor` NEW THINGS (a fifth of the goal: 4 of 20): if the visits asked fewer, the first new thing of each
//     position, positions in traffic order, tops the day up, never taking a position past 6 (both are the owner's numbers,
//     so neither may break the other; the simulation's floor could make a full position 7, now the same rule there too).
//     Loose things never fill the floor.
//   · ties are broken by the input's own order (the caller hands things in traffic order, a strict total order whose last
//     key is content), never by an index the content can renumber (CLAUDE.md §6.6, traps-wire.md).
//
// NOTHING IS GUESSED, NOTHING IS SILENT (traps-wire.md, "a CHECK THAT NEVER RAN"):
//   · a weight that is not a number means "this does not exist in this ruleset" (CLAUDE.md §3: null is not zero): the thing is
//     DROPPED and COUNTED (`outside`), never priced. A weight of 0 is a real "exists, never attempted": priced at 0, kept.
//   · NEVER LOOKED IS NOT A SESSION. With no game (no manifest, no weights, no dealt hands), no seat map, or a record with no
//     answer in it, `ngPracticeOrder` returns a `status` naming why and no rows; the planner then builds today's order
//     (oldest first, new decks by the comparison or the weak spots) and says so (`plan.order`, `plan.orderStatus`).
//   · one question is ONE thing, however many decks share it: asked once, worth the sum of its decks' weights (the rating's
//     arithmetic), filed under one deck (its home) for the page.
//
// STAGE 3 ASKS CARDS ONLY. Today's Practice page has no way to ask a hidden move (that is Stage 4, the map asks), so the app
// hands no moves in: a visit is at most 6 question cards. The law takes moves (`kind: "move"`) for the parity and for Stage 4.
//
// research: docs/Changelog-Archive.md (v1.274.0).
import { ngRatingRecall } from "./rating.src.js";

const NG_PQ_CAP = 6;          // things asked at one position, at most (U171 a)
const NG_PQ_EACH = 2;         // a visit's new moves at most; its new things, moves and cards, at most twice that
const NG_PQ_BEST = 6;         // a position's owed worth is its six best
const NG_PQ_NEW = 0.75;       // what an answer to a never-answered thing brings back
const NG_PQ_SLOTS = 5;        // new cards a deck can give in one day: 4 in its visit, 1 to the floor

function ngPqNum(v) { return typeof v === "number" && Number.isFinite(v); }
function ngPqRow(r) { return Array.isArray(r) && r.length >= 3 && ngPqNum(r[0]) && ngPqNum(r[1]) && ngPqNum(r[2]) && r[1] > 0; }

/**
 * THE LAW. `items` in traffic order (heaviest first), each {id, kind: "move" | "card", seat: string | null, w, row, stage}:
 *   w      the thing's share of the game; not a number = not in this ruleset (dropped, counted)
 *   row    its stored schedule row [due, interval, last day, (a move's answer)], or null for never answered
 *   stage  a card's highest stage (a row of interval 1 with a stage is read as right, the rating's rule)
 * Returns {visits: [{seat, ids}], floor: [ids], asked: [ids in order], counts}. `goal` is what is left of the day's goal.
 */
export function ngPracticeVisits({ items = [], day, goal = 20, floor = 4, cap = NG_PQ_CAP } = {}) {
  const counts = { items: 0, owed: 0, fresh: 0, outside: 0, today: 0, later: 0, badRow: 0, twice: 0 };
  const seatIx = new Map(), seatList = [], seatItems = [], worth = new Map(), owed = new Map(), isNew = new Set(), seen = new Set();
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
    counts.owed++;
    (owed.get(k) || owed.set(k, []).get(k)).push(it);
  }
  const W = (it) => worth.get(it.id), byWorth = (a, b) => W(b) - W(a);
  const firstNew = (k, kind, asked) => seatItems[k].find((it) => isNew.has(it.id) && !asked.has(it.id) && (kind == null || it.kind === kind));
  const none = new Set(), score = new Map();
  for (const [k, L] of owed) score.set(k, L.map(W).sort((a, b) => b - a).slice(0, NG_PQ_BEST).reduce((x, y) => x + y, 0));
  for (let k = 0; k < seatList.length; k++) {
    if (seatList[k] === "") continue;
    const m = firstNew(k, "move", none), c = firstNew(k, "card", none);
    score.set(k, (score.get(k) || 0) + ((m ? W(m) : 0) + (c ? W(c) : 0)));
  }
  const order = [...score.entries()].filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1] || a[0] - b[0]).map((e) => e[0]);
  const visits = [], asked = new Set(), out = [], at = new Map();
  let n = 0, fresh = 0;
  const ask = (it, k) => { asked.add(it.id); out.push(it.id); n++; at.set(k, (at.get(k) || 0) + 1); if (isNew.has(it.id)) fresh++; };
  for (const k of order) {
    if (n >= goal) break;
    const L = owed.get(k) || [];
    const mv = L.filter((it) => it.kind === "move").sort(byWorth), cd = L.filter((it) => it.kind !== "move").sort(byWorth);
    const newM = [], newC = [];
    for (const it of seatItems[k]) {
      if (!isNew.has(it.id)) continue;
      if (it.kind === "move") { if (newM.length < NG_PQ_EACH) newM.push(it); } else if (newC.length < 2 * NG_PQ_EACH) newC.push(it);
      if (newM.length >= NG_PQ_EACH && newC.length >= 2 * NG_PQ_EACH) break;
    }
    newC.splice(2 * NG_PQ_EACH - newM.length);
    const plan = [...mv, ...newM, ...cd, ...newC].slice(0, cap);
    if (!plan.length) continue;
    const ids = [];
    for (const it of plan) { if (n >= goal) break; ask(it, k); ids.push(it.id); }
    visits.push({ seat: seatList[k] || null, ids });
  }
  const extra = [];
  for (let k = 0; k < seatList.length && fresh < floor; k++) {
    if (seatList[k] === "" || (at.get(k) || 0) >= cap) continue;
    const it = firstNew(k, null, asked);
    if (it) { ask(it, k); extra.push(it.id); }
  }
  return { visits, floor: extra, asked: out, counts, n, fresh };
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
 * to the deck's first unanswered cards when they land. Returns {status, items, counts}; status "ok" or why not.
 */
export function ngPracticeItems({ day, srs, stage, decks, game, seats } = {}) {
  const counts = { questions: 0, outside: 0, unknownDeck: 0, blocked: 0, slots: 0 };
  const fail = (status) => ({ status, items: [], counts });
  if (!game || game.status !== "ok" || !(game.deckUnit instanceof Map)) return fail((game && game.status !== "ok" && game.status) || "no-game");
  if (!seats || !Object.keys(seats).length) return fail("no-seats");
  if (!decks || !Object.keys(decks).length) return fail("no-manifest");
  const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
  const unit = (dk) => (own(decks, dk) && decks[dk].allowed !== false ? game.deckUnit.get(dk) : undefined);
  const holds = (dk, qh) => own(decks, dk) && (!decks[dk].exact || (decks[dk].questions || []).includes(qh));
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
    if (!p) { counts.outside++; continue; }
    if (!p.deck) { counts.blocked++; continue; }      // a removed copy everywhere: it stays owed, never asked from nowhere
    items.push({ id: qh, kind: "card", seat: p.seat, w: p.w, row: q.row, stage: st(qh, list), deck: p.deck });
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
 * [{seat, keys}], `counts` {built: the builder's, law: the law's, asked, askedNew}.
 */
export function ngPracticeOrder({ day, goal, floor, newToday = 0, srs, stage, decks, game, seats } = {}) {
  const built = ngPracticeItems({ day, srs, stage, decks, game, seats });
  if (built.status !== "ok") return { status: built.status, rows: [], visits: [], counts: { built: built.counts } };
  // the floor is a DAY's (STAGE3-R1, the reader's finding 6): new cards first answered earlier today count toward it, so a
  // player who opens Practice three times is not handed 4 new each time
  const fl = Math.max(0, floor - (newToday > 0 ? newToday : 0));
  const law = ngPracticeVisits({ items: built.items, day, goal: Math.max(0, goal), floor: goal > 0 ? Math.min(fl, goal) : 0 });
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
    const at = visits.push({ seat: v.seat, keys: [] }) - 1;
    seatVisit.set(v.seat, at);
    for (const id of v.ids) put(id, at);
  }
  for (const id of law.floor) {
    const seat = byId.get(id).seat;
    if (!seatVisit.has(seat)) seatVisit.set(seat, visits.push({ seat, keys: [] }) - 1);
    put(id, seatVisit.get(seat));
  }
  const list = [...rows.values()].sort((a, b) => a.visit - b.visit || a.at - b.at)
    .map(({ at, ...r }) => ({ ...r, count: r.questions.length + r.pending }));
  return { status: "ok", rows: list, visits, counts: { built: built.counts, law: law.counts, asked: law.n, askedNew: law.fresh }, law };
}
