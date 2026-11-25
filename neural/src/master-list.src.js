// MASTER THE GAME'S LIST (L1, v1.290.0). The owner's U197 b (17 Nov 2026, the design round MASTER-R1): Master the game is
// "Positions you have been to", with a call to action ("When we click that button, we should go for the first item on the
// list and then reveal the navigation buttons. I don't want to have the section which reads 'Places you have been.'"),
// U199 a (gold marks and the number, never a total) and the orchestrator's five rulings on Part A2 (reports/mapasks.md):
//   - the rows the plan visits today come first, in THE PLAN'S OWN ORDER (S0's law, practice-queue.src.js), so the button
//     and the order agree by construction; a place the plan visits that you never stood on joins where the plan puts it,
//     marked "new" (ruling 3);
//   - then every other place in `explored` (the synced record of the seats you landed on, app `_exploredKeys`), nothing
//     due there; no new stored key (ruling 5);
//   - a row's sub line says what is due and, where the record already knows it, when you last ANSWERED or PLAYED there:
//     the newest of that seat's `srs`, `moves` and `flow` days. Never the word "visited": nothing stores a visit (ruling 5);
//   - an `explored` key that no longer resolves (a renamed position: the record is keyed by name) is COUNTED and the count
//     is said; it is never dropped silently (CLAUDE.md §6.6, ruling 5).
// Pure: no DOM, no app. The app hands in what it already holds (`resolve`, `lastDay`, `gold`) and paints what this returns.
// It rides the deferred gameplan bundle (re-exported by gameplan.src.js), so the eager core carries none of its words.
// Pinned by tests/master_list.test.mjs.

import { ngGameplanReviewed } from "./gameplan-debt.src.js";
import { ngPracticeItems } from "./practice-queue.src.js";
import { ngClozeLeft, ngClozePaint } from "./master-cloze.src.js";

const NG_MASTER_MARKS = 8;   // marks drawn at most; the number says the rest (U199 a: the number, never a total)

// "answered yesterday", "played 3 days ago": the day a row last saw an answer or a move, in words
export function ngMasterWhen(seen, day) {
  if (!seen || !Number.isFinite(seen.day) || !Number.isFinite(day)) return "";
  const n = Math.max(0, Math.floor(day - seen.day));
  const ago = n === 0 ? "today" : n === 1 ? "yesterday" : n < 14 ? n + " days ago" : n < 60 ? Math.round(n / 7) + " weeks ago" : Math.round(n / 30) + " months ago";
  return (seen.kind === "played" ? "played " : "answered ") + ago;
}

/**
 * The list. `plan`: the plan's visits in its order, [{seat, due, fresh}] (`due` the owed cards still to answer there today,
 * `fresh` its new ones; `seat` "Mount|Bottom", or null for cards no position holds). `explored`: the record's keys.
 * `resolve(key)`: {name, side, pos} for a node this ruleset draws (`pos` true for a position), false for one it does not
 * draw, null for a key that no longer resolves. `lastDay(key)`: {day, kind} or null. `gold(key)`: the shapes of the moves
 * the map paints gold there. `owed(key)`: the cards owed at a place, counted as the plan counts them (null: not known).
 * Returns {rows, owing, rest, unresolved, been}: `rows` the plan's; `owing` the other places that still owe cards, with
 * their count, above the rule (most owed first); `rest` the places with nothing due (newest answer first, then by name);
 * `unresolved` the keys counted and never shown; `been` how many positions the record holds in this ruleset (0: new).
 * A PLACE THAT OWES CARDS IS NEVER CALLED "nothing due" (L1-R1, the reader of PR #434, its finding 1: 3 cards 53 days
 * overdue sat under the rule as "nothing due" because the plan, at its day's 20, did not reach them).
 * EVERY PLACE THAT OWES CARDS HAS A ROW (L1-R2, the second reader's "unlisted owing place", 2 of 2; the orchestrator's
 * ruling): the list's set is today's plan ∪ the places in `explored` ∪ the places that owe a card (`owing`, the keys the
 * plan's own count holds). A place that owes and is in neither the record nor the plan had no row at all, and that is
 * every record from before `explored` was stored. Derived here, each time the list is drawn: nothing is stored for it, and
 * it does not count as a place you have been to (`been`).
 * `today(key)`: the cards answered at a place today; a row carries it (`today`) so the open place's figure can agree with
 * its count (the painter, `ngMasterSync`).
 */
export function ngMasterRows({ plan = [], explored = [], resolve, lastDay, gold, day, owed, owing: owes = [], today } = {}) {
  const been = new Set(explored), inPlan = new Set();
  const row = (seat, p, extra) => {
    const shapes = (seat && gold && gold(seat)) || [], seen = seat && lastDay ? lastDay(seat) : null;
    return { seat, name: p ? p.name : "Other cards", side: p ? p.side : "", marks: shapes.slice(0, NG_MASTER_MARKS), n: shapes.length,
      when: ngMasterWhen(seen, day), last: seen && Number.isFinite(seen.day) ? seen.day : -Infinity, today: (seat && today && today(seat)) || 0, ...extra };
  };
  const rows = [];
  for (const [visit, v] of plan.entries()) {
    const p = v.seat && resolve ? resolve(v.seat) : null;
    if (v.seat) inPlan.add(v.seat);
    const o = v.seat && owed ? owed(v.seat) : null;
    const r = row(v.seat, p || null, { visit, due: o != null ? o : v.due || 0, fresh: v.fresh || 0, isNew: !!v.seat && !been.has(v.seat) });
    // L2: a place's new things can be moves (`newMoves`, the cloze's): said as what they are
    const fresh = !v.newMoves ? "new cards" : v.newMoves >= r.fresh ? "new moves" : "new moves and cards";
    r.sub = [r.due ? r.due + " due" : r.fresh ? fresh : "done for today", r.when].filter(Boolean).join(" \u00b7 ");
    rows.push(r);
  }
  const rest = [], owing = [];
  let unresolved = 0, seats = 0;
  // the record's places, then the places that owe a card and are in neither the record nor the plan (L1-R2)
  for (const key of new Set([...been, ...owes])) {
    const mine = been.has(key), p = resolve ? resolve(key) : null;
    if (p === null) { if (mine) unresolved++; continue; }
    if (!p || !p.pos) continue;   // a node this ruleset does not draw, or not a position (a submission's side): not a place
    if (mine) seats++;
    if (inPlan.has(key)) continue;
    const o = owed ? owed(key) : null, r = row(key, p, { due: o || 0, fresh: 0, isNew: false });
    // what is owed there, always: "N due" above the rule; "nothing due" only when the plan's own count says nothing is owed
    r.sub = [o ? o + " due" : o === 0 ? "nothing due" : "", r.when].filter(Boolean).join(" \u00b7 ");
    (o ? owing : rest).push(r);
  }
  const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.side < b.side ? -1 : a.side > b.side ? 1 : 0);
  owing.sort((a, b) => b.due - a.due || byName(a, b));
  rest.sort((a, b) => b.last - a.last || byName(a, b));
  return { rows, owing, rest, unresolved, been: seats };
}

/**
 * The button's words (the orchestrator's L1 brief): "Start today's session" before the day's first answer, "Continue
 * today's session" after, the first position named under it with what is left of the goal ("Mount, bottom first · 13 to
 * go"); a new player's "Your first position: Mount, bottom"; the day's goal met, "Today's 20 are done" (`met`), with
 * "Keep practising" under it, which the app draws. `first`: the row the button opens, or null while nothing is ready.
 */
export function ngMasterStart({ done = 0, goal = 20, first = null, newPlayer = false, ready = true, more = false } = {}) {
  if (done >= goal) return { met: true, title: "Today's " + goal + " are done", sub: done + " answered · keep going if you like" };
  const title = done ? "Continue today's session" : "Start today's session";
  // nothing left in today's plan before the goal (fewer cards owed than the goal): the button deals the next round, and
  // says so; it never opens a place that has nothing left to ask (L1-R1)
  if (!first && ready && more) return { met: false, keep: true, title: "Keep practising", sub: done + " answered · the next round, worth most first" };
  if (!first) return { met: false, title, sub: ready ? "Nothing to practise here right now." : "Loading your positions…" };
  const at = first.side ? first.name + ", " + first.side.toLowerCase() : first.name;
  return { met: false, title, sub: newPlayer && !done ? "Your first position: " + at : at + " first · " + (goal - done) + " to go" };
}

// ── THE PAGE'S PAINTER (L1): the rows, the note and the button's words, painted through the app's own readers. It lives in
// this deferred bundle, not in the eager core (the eager gzip figure's per-change cap, tests/artifacts/payload_policy.json):
// the rows need the plan, so they never paint before this bundle is in anyway. The app keeps the skeleton, the press, the
// navigation and `openMasterAt` (app.src.jsx, `_masterSkeleton` and below), and calls this from `_masterPaint`.

// the plan's visits as the list shows them: one row a place, in the order the session holds them (the plan's own), with what
// is still to answer there today (an answer given today, here or anywhere, is no longer due)
function ngMasterPlanOf(app, s) {
  const seen = new Set(ngGameplanReviewed(app.srs, app._epochDay())), out = new Map();
  const rows = s.plan ? s.plan.due.concat(s.plan.fresh) : s.review ? s.review.rows : [];
  const put = (seat) => out.get(seat) || out.set(seat, { seat, due: 0, fresh: 0, newMoves: 0 }).get(seat);
  // L2: THE MOVES JOIN THE DAY. A place the plan visits for its moves alone has no deck in the session, and is a row all the
  // same, where the plan puts it (its visits' own order); what its cloze still has to ask counts with its cards: an owed
  // move is due, a new one is new
  if (s.plan && s.plan.order === "worth" && s.plan.moves) {
    const asked = new Set(s.plan.moves.map((m) => m.seat));
    for (const v of s.plan.visits) if (v.seat && asked.has(v.seat)) put(v.seat);
    for (const seat of asked) {
      const v = put(seat);
      for (const m of ngClozeLeft(app, s, seat)) { if (m.owed) v.due++; else { v.fresh++; v.newMoves++; } }
    }
  }
  for (const k of s.keys) {
    const r = rows.find((x) => x.key === k), seat = app._masterSeatOf(s, k);
    if (seat == null || (r && r.source === "place")) continue;
    const v = put(seat);
    if (!r) continue;
    const owed = r.owed || (s.review || r.kind === "due" ? r.questions : []);
    v.due += owed.filter((q) => !seen.has(q)).length;
    v.fresh += r.questions.filter((q) => !owed.includes(q) && !seen.has(q)).length + (r.pending || 0);
  }
  return [...out.values()].map((v) => ({ ...v, seat: v.seat || null }));
}
function ngMasterResolveIn(app, k) {
  const i = app.nodeForKey(k); if (i < 0) return null;
  if (!app.rsAllowsIdx(i)) return false;   // this ruleset does not draw it: not a row, and not lost either
  const bar = k.lastIndexOf("|");
  return { name: k.slice(0, bar), side: k.slice(bar + 1), pos: app.nodes[i].ty === "positions" };
}
// when you last ANSWERED or PLAYED at a place (ruling 5 of Part A2): the newest day of its cards (its own deck and the decks
// the plan files under it, `_practiceSeats`), its hidden moves' answers and the moves you played from it (`flow`)
function ngMasterSeenIn(app, k, decksOf) {
  let best = null;
  const up = (d, kind) => { if (Number.isFinite(d) && (!best || d > best.day)) best = { day: d, kind }; };
  for (const dk of [k].concat(decksOf.get(k) || [])) { const D = app.srs && app.srs[dk]; if (D) for (const q in D) up(D[q] && D[q][2], "answered"); }
  const i = app.nodeForKey(k), o = i >= 0 && app._ordById ? app._ordById.get(app.siteIdOf(app.nodes[i].id)) : null;
  const M = o != null && app.moves ? app.moves[o + "/" + (k.endsWith("|Bottom") ? "bottom" : "top")] : null;
  if (M) for (const mv in M) up(M[mv] && M[mv][2], "answered");
  for (const dev in app.flow || {}) { const P = app.flow[dev] && app.flow[dev][k]; if (P) for (const mo in P) up(P[mo] && P[mo][2], "played"); }
  return best;
}
// THE ROW'S GOLD IS THE MAP'S (U199 a), AND IT IS THE EAGER CORE'S SINCE L3 (v1.293.0): `app._placeGold(k)`, the shapes of the
// moves the map paints gold at a place, and `app._goldMark(shapes, n)`, the mark a row draws from them (app.src.jsx). They lived
// here as `ngMasterGoldIn` and in `ngMasterRowHTML`; a Last rolls row now says the same thing about the same place, Last rolls is
// eager, and one question answered in two places is already wrong in one of them (CLAUDE.md §6.5): so there is ONE function,
// where both lists can reach it, and this bundle only calls it. The mark's CSS (`.ng-mgold`) moved to challenge-ui.css with it.
// WHAT IS OWED AT EACH PLACE, COUNTED AS THE PLAN COUNTS IT (L1-R1, the reader's finding 1): the plan's own builder
// (`ngPracticeItems`, with the inputs `planSummary` hands it: the decks, the seat map `_practiceSeats` makes, the stage, the
// live set) and the law's own test for owed (a row due, not answered today, priced), each card at the place it is asked.
// `s.owedAt`: place → deck → its owed questions, so a press on a place outside today's plan asks exactly these (`_masterFree`).
// Null when the plan's game is not in (no count is known, and none is claimed).
function ngMasterOwedIn(app, s, game, map) {
  const day = app._epochDay();
  // L2: with the moves, as the plan is handed them (`_asksMoves`: never on "Multiple choice"). `s.owedMoves`: place → its
  // owed moves, heaviest first (the builder's own order), which a place outside today's plan asks as its cloze
  const moves = app._asksMoves() ? { moves: app.moves || {}, moveSeats: (app._practiceSeatsAt && app._practiceSeatsAt.mseats) || {} } : {};
  const built = game && game.status === "ok" ? ngPracticeItems({ day, srs: app.srs, stage: app.stage, decks: app._gameplanDecks(true), game, seats: map, live: app._ratingLiveNow(), ...moves }) : null;
  s.owedMoves = new Map();
  if (!built || built.status !== "ok") return (s.owedAt = null);
  const at = new Map();
  for (const it of built.items) {
    const r = it.row;
    if (!r || !it.seat || !(it.w >= 0) || !(r[0] <= day) || !(r[2] < day)) continue;
    if (it.kind === "move") {
      // the law's own test for an owed move: a whole row with its answer (a shorter one is a bad row, never asked)
      if (Array.isArray(r) && r.length >= 4 && r[1] > 0) (s.owedMoves.get(it.seat) || s.owedMoves.set(it.seat, []).get(it.seat)).push({ id: it.id, key: it.key, move: it.move, seat: it.seat, owed: true });
      continue;
    }
    if (it.kind !== "card") continue;
    const d = at.get(it.seat) || at.set(it.seat, new Map()).get(it.seat);
    (d.get(it.deck) || d.set(it.deck, []).get(it.deck)).push(it.id);
  }
  return (s.owedAt = at);
}
function ngMasterViewIn(app, s) {
  if (!app.nodes || !app.nodes.length) return null;
  const game = app._ratingGame(app._giMode === "nogi" ? "nogi" : "gi"), map = game && game.seats ? app._practiceSeats(game) : {}, decksOf = new Map();
  for (const dk in map) if (map[dk] !== dk) (decksOf.get(map[dk]) || decksOf.set(map[dk], []).get(map[dk])).push(dk);
  const at = ngMasterOwedIn(app, s, game, map), n = (k) => { let c = (s.owedMoves.get(k) || []).length; for (const q of (at.get(k) || new Map()).values()) c += q.length; return c; };
  // the cards answered at a place today: its own deck's and the decks the plan files under it, a question counted once;
  // and the moves answered there today (L2: a move answered is one, as a card is, so the open place's figure still agrees)
  const day = app._epochDay(), ms = (app._practiceSeatsAt && app._practiceSeatsAt.mseats) || {}, movesAt = new Map();
  if (app._asksMoves()) for (const st in app.moves || {}) {
    const seat = ms[st], rows = app.moves[st];
    if (seat && rows) for (const mv in rows) if (Array.isArray(rows[mv]) && rows[mv][2] === day) movesAt.set(seat, (movesAt.get(seat) || 0) + 1);
  }
  const today = (k) => {
    const seen = new Set();
    for (const dk of [k].concat(decksOf.get(k) || [])) { const D = app.srs && app.srs[dk]; if (D) for (const q in D) if (D[q] && D[q][2] === day) seen.add(q); }
    return seen.size + (movesAt.get(k) || 0);
  };
  // (the places that owe: a card, or a move the cloze asks)
  const v = ngMasterRows({ plan: ngMasterPlanOf(app, s), explored: [...(app._exploredKeys || [])], day,
    resolve: (k) => ngMasterResolveIn(app, k), lastDay: (k) => ngMasterSeenIn(app, k, decksOf), gold: (k) => app._placeGold(k), owed: at ? n : null,
    owing: at ? [...new Set([...at.keys(), ...s.owedMoves.keys()])] : [], today });
  v.unresolved += app._exploredBad || 0;   // damaged entries the loader skipped are counted with the places that no longer resolve (L1-R1)
  return v;
}
function ngMasterRowHTML(app, r, prog) {
  const e = (x) => app.escHTML(x);
  return '<i class="ng-mdot" data-side="' + e((r.side || "").toLowerCase()) + '"></i><span class="ng-mbody"><span class="ng-mname">' + e(r.name) + (r.side ? " <em>" + e(r.side) + "</em>" : "") +
    "</span><small>" + e(r.sub) + "</small></span>" + (prog ? '<span class="ng-mprog" data-master-prog="1">' + e(prog) + "</span>" : "") + (r.isNew ? '<span class="ng-mnew">new</span>' : app._goldMark(r.marks, r.n)) + '<span class="ng-mchev">›</span>';
}
// the rows: rebuilt when the set of places changes (the open card taken out first and put back under its row), else each
// repainted in place only when its words changed (a rewrite under a pointer swallows the press, FGD13's class)
function ngMasterSync(app, s, v) {
  const owing = v.owing || [], sig = v.rows.concat(owing).map((r) => r.seat).join("\n") + "\n|\n" + v.rest.map((r) => r.seat).join("\n");
  if (sig !== s.rowSig) {
    s.rowSig = sig; s.rowEls = new Map();
    // THE OPEN CARD IS NEVER TAKEN DOWN WITH THE ROWS: the rows around it are swapped and it stays connected, so a press held
    // on it lands (P1-D, practice-page.spec.ts) and its focus stays (‹ Back from a checkpoint, corridor-reach.spec.ts); it
    // goes under its own row through `_masterPlace`, which waits for a held press and keeps the focus
    const inside = s.ask.parentNode === s.rowsEl;
    const els = [], row = (r, group) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "ng-mrow";
      b.setAttribute("data-master-row", r.seat || ""); b.setAttribute("data-master-group", group);
      s.rowEls.set(r.seat || "", b); els.push(b);
    };
    v.rows.forEach((r) => row(r, "plan"));
    owing.forEach((r) => row(r, "due"));   // owing, outside today's plan: after the plan's places, above the rule
    if ((v.rows.length || owing.length) && v.rest.length) { const hr = document.createElement("hr"); hr.className = "ng-mrule"; els.push(hr); }
    v.rest.forEach((r) => row(r, "rest"));
    if (inside) { for (const c of [...s.rowsEl.children]) if (c !== s.ask) c.remove(); s.ask.after(...els); }
    else s.rowsEl.replaceChildren(...els);
    if (!s.list) app._masterPlace(s, true);
    s.rowsNew = true;   // the core paints the deck rows again: a deck row that only repeats its place reads the rows (L1-R0)
  }
  // the open place's own deck: its row is not drawn (app.src.jsx, `_sessionRow`, L1-R0), so its count ("0/3") is the place's
  const k = !s.list && s.keys[s.idx], lr = k && s.live && app._masterSeatOf(s, k) === k ? s.live.rows.find((x) => x.key === k) : null;
  // THE OPEN PLACE'S FIGURE NEVER CONTRADICTS ITS COUNT (L1-R2, the second reader: "3 due" beside "0/2", the plan's share
  // of a place the day's goal cut). While a place that owes (or answered) cards is open, the figure is the PLACE's: the
  // cards answered here today over those plus what is still due here, so "x/y" and "N due" always say y − x = N. A place
  // with nothing due and nothing answered (new cards only) keeps its own deck's figure, as before.
  const open = s.czOpen != null ? s.czOpen : k ? app._masterSeatOf(s, k) : null;   // an open cloze is its place's open ask (L2)
  // ...a place asked for cards that were due (a free review of a place that owes nothing keeps its deck's figure too)
  const asked = open != null && (s.plan ? s.plan.due.concat(s.plan.fresh).some((x) => (x.owed ? x.owed.length : x.kind === "due") && app._masterSeatOf(s, x.key) === open) : !!s.review) || (s.czOpen != null && !!(s.cz && s.cz.get(open)));   // …or for its moves, in a cloze (L2)
  for (const r of v.rows.concat(owing, v.rest)) {
    const mine = open != null && (r.seat || "") === open, place = mine && r.seat && (r.due || (asked && r.today)) ? r.today + "/" + (r.today + r.due) : "";
    const el = s.rowEls.get(r.seat || ""), h = ngMasterRowHTML(app, r, place || (lr && r.seat === k ? lr.completed + "/" + lr.count : ""));
    if (el && el._ngHtml !== h) { el._ngHtml = h; el.innerHTML = h; }
  }
}
// the places' rows' own rules (the button, the slim line, the navigation and "Belt lessons" are challenge-ui.css's, eager:
// they show before this bundle is in), added once to the page (the CSP allows inline styles; app.src.jsx does the same)
const NG_MASTER_CSS = ".ng-mrow[data-on]{background:rgba(255,255,255,.035)}@media (hover:hover){.ng-mrow:hover{background:rgba(255,255,255,.035)}}.ng-mdot{flex:none;width:10px;height:10px;border-radius:50%;background:#5b8cff}.ng-mdot[data-side=bottom]{background:#d8607a}.ng-mdot[data-side=attacker],.ng-mdot[data-side=defender],.ng-mdot[data-side='']{border-radius:2px;background:#9fb0d8}.ng-mrow[data-on] .ng-mname{color:#eef1f6;font-weight:700}.ng-mrow[data-on] .ng-mchev{transform:rotate(90deg)}.ng-mprog{flex:none;font-size:10.5px;font-weight:600;color:#9ab0e0}.ng-mname em{font-style:normal;font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8fb0ff;margin-left:3px}.ng-mdot[data-side=bottom] + .ng-mbody em{color:#d8889e}.ng-mnew{flex:none;font-size:10.5px;font-weight:600;color:#7e8aa3}.ng-mrule{border:0;height:1px;background:rgba(150,170,210,.1);margin:8px 0}.ng-mnote{font-size:11.5px;line-height:1.5;color:#7e8aa3;margin:10px 0 0}";
export function ngMasterPaint(app, s) {
  if (!document.getElementById("ng-master-css")) { const st = document.createElement("style"); st.id = "ng-master-css"; st.textContent = NG_MASTER_CSS; document.head.appendChild(st); }
  const t = app.practiceToday(), v = (s.view = ngMasterViewIn(app, s));
  if (v) ngMasterSync(app, s, v);
  // AN EXPLORED KEY THAT NO LONGER RESOLVES IS COUNTED AND SAID (ruling 5; CLAUDE.md §6.6): a renamed position, never dropped in silence
  const txt = !v ? "" : [v.unresolved ? v.unresolved + (v.unresolved === 1 ? " place you reached is" : " places you reached are") + " no longer on the map." : "",
    !v.been ? "Play a roll and every position you reach joins this list, with the moves you remember there." : ""].filter(Boolean).join(" ");
  if (s.note.textContent !== txt) s.note.textContent = txt;
  s.note.hidden = !txt;
  if (v && v.unresolved && s.unresolvedBeat !== v.unresolved) { s.unresolvedBeat = v.unresolved; app.fx("master_unresolved", { n: v.unresolved }); }
  // the row the button opens: the plan's first place with something left to ask, never a finished one (L1-R1, the
  // orchestrator's ruling on the reader's finding 3); nothing left before the goal is "Keep practising", the next round
  ngClozePaint(app, s);
  const first = (s.first = (v && v.rows.find((r) => r.due || r.fresh)) || null), more = !!s.plan && s.plan.order === "worth";
  const w = ngMasterStart({ done: t.done, goal: t.goal, first, newPlayer: !!v && !v.been, ready: !!v && !!s.plan, more });
  return { w, open: !!first || !!w.keep || (!v && s.keys.length > 0) };
}
