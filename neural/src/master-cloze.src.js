// THE CLOZE (L2, v1.292.0): a position's moves, asked in Master the game's list. The owner, 17 Nov 2026:
//   U198 "You know the cloze flashcards in Anki? … the important field or fields are hidden, and the user must guess them …
//        There should be a reveal button or a show button. And after clicking it, there can be a hide button, similar to the
//        front/back flashcards."
//   U200 "…if there are six techniques in cloze, then we should be rewarded 6 points."
//   U201 "b, Bars … b is beautiful please do b. also can we show "where it takes you" subtly elegantly somewhere near the
//        move but only once the card is revealed?"
//   U204 "a, A quiet second line / … instead of the dot, say something like ↳ … and also mention the role, like top bottom
//        … unless it's a submission (a successful submission always reuslts in game over so no need to make it explicit, but
//        careful with aesthetics and spacing between rows in that case as i don't want a single line row to look weird in
//        the middle of two lines rows"
// The drawings are the spec: Bars (design/master-r2, cloze v1) and the second line (design/master-r4/spec.md, followed to
// the pixel: the figures below are its figures).
//
// WHAT IT ASKS (the orchestrator's ruling 1; Part A2 §2): the moves S0's law asks at that position today
// (practice-queue.src.js: the due ones by worth, at most six a visit, or up to two new ones when nothing is due), each one a
// blank bar. A move you remember that is not due stays in sight, in gold ("solid"). A move this ruleset does not deal there
// is never hidden and never listed (the builder counts it, `movesOutside`).
// HOW IT IS ANSWERED: Show turns the bars into names, each with where it takes you under it; "Had it?" on each row; Hide
// puts the bars back and is a VIEW, never a grade (ruling 3); Done writes every hidden move ONCE, through the app's one
// writer (`_gradeMoves`: Had it climbs the ladder, not tapped stores what a hidden move's No stores, ruling 5), and each is
// one of the day's 20 (U200). Nothing is marked for the player. After Done, ONE quiet Undo takes that confirm back, exactly
// (ruling 4), until the next confirm or until the place is left.
// THE MAP: while a cloze is open and not shown, `c.down` (its hidden moves' orbs) is what the map must not name
// (app.src.jsx, `_czDown`, ruling 7). `ngClozeLeadsOf` is the one function that says where a row leads (ruling 8: the
// second line reads it now; the map will, in L2b).
// NOT HERE: a player on "Multiple choice" gets no cloze (the app hands the plan no moves, `_asksMoves`) until L4.
//
// Pure where it can be (`ngClozeLeads`, `ngClozeBack`, `ngClozeSay`: tests/master_cloze.test.mjs); the rest paints through
// the app's own readers, as master-list.src.js does. Pinned by e2e/journeys/master-cloze.spec.ts.

const NG_CLOZE_CAP = 6;   // a visit's moves at most (the law's own cap, NG_PQ_CAP)
const NG_CLOZE_NUM = ["No", "One", "Two", "Three", "Four", "Five", "Six"];
const NG_CLOZE_DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * WHERE A MOVE TAKES YOU (spec.md, "What it says"). `outcomes`: the move's own table, [{to, probability, result}].
 * The place: the success outcome with the highest probability; a null cell is an outcome that does not exist in this frame;
 * ties keep the authored order; failure and counter outcomes are never shown. A second place only when a second success
 * outcome has probability 25 or more. Returns the one or two outcome rows, or none.
 */
export function ngClozeLeads(outcomes) {
  const ok = (Array.isArray(outcomes) ? outcomes : []).map((o, i) => ({ o, i }))
    .filter((e) => e.o && e.o.result === "success" && typeof e.o.probability === "number" && Number.isFinite(e.o.probability));
  ok.sort((a, b) => b.o.probability - a.o.probability || a.i - b.i);
  return ok.length ? [ok[0].o].concat(ok[1] && ok[1].o.probability >= 25 ? [ok[1].o] : []) : [];
}
// the day's words after Done, from the row the answer wrote: "back in 7 days", "again on Thursday" (a weekday inside a week)
export function ngClozeBack(row, day, had) {
  const n = Math.max(1, Math.round(row[0] - day));
  return (had ? "back " : "again ") + (n < 7 ? "on " + NG_CLOZE_DAY[(((Math.round(day) + n + 4) % 7) + 7) % 7] : "in " + n + " days");
}
// the words over the rows. `hide`: the hidden moves; `solid`: the remembered ones in sight; `had`: tapped so far
export function ngClozeSay({ hide, solid = 0, shown = false, had = 0, goal = 20 }) {
  const num = (n) => NG_CLOZE_NUM[n] || String(n);
  if (shown) return [had ? "Tap the ones you had. " + had + " so far." : "Tap the ones you had.", had ? "Nothing tapped = not yet." : "Nothing tapped = not yet. Hide puts the blanks back if you want another go."];
  const one = hide === 1;
  if (solid) return [num(hide) + (one ? " move" : " moves") + " to say. The " + (solid === 1 ? "one you have stays" : num(solid).toLowerCase() + " you have stay") + " in sight.", ""];
  return [num(hide) + (one ? " move starts here. Say it" : " moves start here. Say each one") + " to yourself, then Show.", "Each blank is one move; each counts one toward today's " + goal + "."];
}

// the open cloze, or none
const ngCzNow = (s) => (s.czOpen != null && s.cz ? s.cz.get(s.czOpen) : null) || null;
const ngCzEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ngCzToday = (app, m) => { const r = app.moves && app.moves[m.key] && app.moves[m.key][m.move]; return Array.isArray(r) && r[2] === app._epochDay(); };

// the moves a place's cloze asks now: the plan's own there, else (a place outside today's plan) what it owes, the same
// builder's count (`s.owedMoves`, master-list.src.js); never one answered today; at most six
function ngClozeAsks(app, s, seat) {
  const plan = s.plan && s.plan.order === "worth" && s.plan.moves ? s.plan.moves.filter((m) => m.seat === seat) : [];
  const from = plan.length ? plan : (s.owedMoves && s.owedMoves.get(seat)) || [];
  return from.filter((m) => !ngCzToday(app, m)).slice(0, NG_CLOZE_CAP);
}
/**
 * WHERE A ROW LEADS, resolved on the map (ruling 8's seam: the second line reads it, the map will). `opt`: the dealt move.
 * Each: {idx, name, role ("top" | "bottom"), sub}. A submission (or the control position a submission is held from, the
 * map's stateAlias) is its finish: `sub`, its name, no role; a move that IS the finish names itself. An outcome that does
 * not resolve is counted (`s.czLost`) and left out, never guessed.
 */
export function ngClozeLeadsOf(app, opt, s) {
  const act = app._actOf(opt), out = [];
  for (const o of ngClozeLeads(act && act.cal && act.cal.outcomes)) {
    const r = app.resolveOutcomeTo(o.to);
    if (r.terminal) { out.push({ idx: opt.idx, sub: true, role: null, name: app.graphName(app.nodes[opt.idx]) }); continue; }
    const n = r.idx >= 0 ? app.nodes[r.idx] : null;
    if (!n) { if (s) s.czLost = (s.czLost || 0) + 1; continue; }
    const sub = n.ty === "submissions" || !!(n.cal && n.cal.stateAlias);
    out.push({ idx: r.idx, sub, role: sub ? null : r.role || n.role || null, name: app.graphName(n) });
  }
  return out;
}
// a place's cloze: its rows in a fixed order (how often each comes up here, then content), the asked ones hidden
function ngClozeBuild(app, s, seat) {
  const asks = ngClozeAsks(app, s, seat);
  if (!asks.length) return null;
  const game = app._ratingGame(app._giMode === "nogi" ? "nogi" : "gi"), ms = (app._practiceSeatsAt && app._practiceSeatsAt.mseats) || {};
  const day = app._epochDay(), hide = new Set(asks.map((m) => m.id)), rows = [];
  for (const [st, hand] of (game && game.seats) || []) {
    if (ms[st] !== seat) continue;
    const at = app._seatOf(st), rec = (app.moves && app.moves[st]) || {};
    if (!at) continue;
    const dealt = new Map((app._dealtOpts(at.i, at.role) || []).map((o) => [String(app._ordById.get(app.siteIdOf(app.nodes[o.idx].id))), o]));
    for (const [mv, w] of hand) {
      if (!(typeof w === "number" && Number.isFinite(w))) continue;   // a null cell: not dealt here in this ruleset, never hidden, never listed
      const id = "m:" + st + ":" + mv, o = dealt.get(mv), r = rec[mv], ask = hide.has(id);
      const solid = !ask && Array.isArray(r) && r[3] === 1 && !(r[0] <= day && r[2] < day);
      if (!ask && !solid) continue;
      if (!o) { if (ask) s.czLost = (s.czLost || 0) + 1; continue; }   // an asked move the hand no longer deals cannot be named: counted, never asked blind
      // THE NAME: the move's own, without its "from <position>" tail (the row sits under that position already); a move
      // named after where it leads keeps its full title, so its two lines never say the same thing twice (as drawn:
      // "Buggy Choke from Bottom Side Control", then its finish "Buggy Choke")
      const n = app.nodes[o.idx], leads = ngClozeLeadsOf(app, o, s), main = app.graphName(n);
      rows.push({ id, st, mv, w, ask, idx: o.idx, name: leads[0] && leads[0].name === main ? n.t : main, tri: n.ty === "submissions", leads });
    }
  }
  if (s.czLost && s.czLostBeat !== s.czLost) { s.czLostBeat = s.czLost; app.fx("cloze_unresolved", { n: s.czLost }); }
  if (!rows.some((r) => r.ask)) return null;
  rows.sort((a, b) => b.w - a.w || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const down = new Set();
  for (const r of rows) if (r.ask) { down.add(r.idx); const p = app.nodes[r.idx].pi; if (p >= 0) down.add(p); }
  return { seat, rows, down, shown: false, had: new Set(), done: null, side: seat.endsWith("|Bottom") ? "bottom" : "top" };
}
const ngCzCards = (app, s, seat) => s.keys.some((k) => app._masterSeatOf(s, k) === seat) || !!(s.owedAt && s.owedAt.get(seat) && s.owedAt.get(seat).size);
const ngCzHas = (app, s, seat) => !!(s.cz && s.cz.has(seat)) || ngClozeAsks(app, s, seat).length > 0;

// ── the asks in order: a position's cloze, then its cards, position after position (the plan's own order), then the rows
// the player added. ‹ › walk them.
function ngClozeStops(app, s) {
  const stops = [], seen = new Set(), placed = new Set(), rows = s.plan ? s.plan.due.concat(s.plan.fresh) : [];
  const cz = (seat) => { if (seat != null && seat !== "" && !seen.has(seat) && ngCzHas(app, s, seat)) { seen.add(seat); stops.push({ cz: seat }); } };
  const worth = s.plan && s.plan.order === "worth";
  for (const [vi, v] of (worth ? s.plan.visits : []).entries()) {
    cz(v.seat);
    s.keys.forEach((k, i) => { const r = rows.find((x) => x.key === k); if (r && r.visit === vi && !placed.has(i)) { placed.add(i); stops.push({ i }); } });
  }
  if (worth) for (const m of s.plan.moves || []) cz(m.seat);   // a round's place the page did not number
  s.keys.forEach((k, i) => { if (!placed.has(i)) { cz(app._masterSeatOf(s, k)); stops.push({ i }); } });
  return stops;
}
const ngCzAt = (s, stops) => stops.findIndex((x) => (s.czOpen != null ? x.cz === s.czOpen : x.i === s.idx));
// what › leads to from the open cloze: the next ask, or (a place outside today's plan) its own owed cards
function ngClozeNext(app, s) {
  const stops = ngClozeStops(app, s), at = ngCzAt(s, stops);
  if (at >= 0) return { at, stop: stops[at + 1] || null, prev: stops[at - 1] || null };
  return { at, stop: null, prev: null, own: s.czOpen != null && s.owedAt && s.owedAt.get(s.czOpen) && s.owedAt.get(s.czOpen).size ? s.czOpen : null };
}
function ngClozeTo(app, s, stop, dir) {
  if (stop.cz != null) { ngClozeShow(app, s, stop.cz, true); return; }
  const k = s.keys[stop.i];
  (app._deckState = app._deckState || {})[k] = { idx: dir > 0 ? 0 : -1, revealed: false };
  s.moved = true; app._sessionOpeners[stop.i]?.(); app._masterShow(s);
}
// ‹ › : true when the step was onto or off a cloze (the cards' own step does the rest)
export function ngClozeStep(app, s, dir) {
  if (!app._asksMoves()) return false;
  const n = ngClozeNext(app, s), to = dir > 0 ? n.stop : n.prev;
  if (s.czOpen == null && (!to || to.cz == null)) return false;
  if (to) ngClozeTo(app, s, to, dir);
  else if (dir > 0 && n.own) app._masterGo(s, n.own, true);   // answered: `ngClozeGo` lets its cards open (`_masterFree`)
  return true;
}
// the button, a row, `openMasterAt`: a place opens on its cloze while it has one to ask; answered, on its cards
export function ngClozeGo(app, s, seat, chose) {
  if (!seat || !app._asksMoves()) return false;
  const c = ngClozeFor(app, s, seat);
  if (!c || (c.done && ngCzCards(app, s, seat))) return false;
  if (chose) s.moved = true;
  ngClozeShow(app, s, seat, true);
  return true;
}
function ngClozeFor(app, s, seat) {
  const C = s.cz || (s.cz = new Map());
  let c = C.get(seat);
  if (!c || c.done) { const n = ngClozeBuild(app, s, seat); if (n) { if (s.czOpen === seat) ngClozeLeave(app, s); C.set(seat, (c = n)); } }
  return c || null;
}
// a session drawn again (a plan that landed): the open cloze is drawn again; an untouched player's first place opens on its
// cloze, as the button opens it
export function ngClozeResume(app, s, seat) {
  if (!app._asksMoves()) return false;
  if (s.czOpen != null && s.cz && s.cz.has(s.czOpen)) { ngClozeShow(app, s, s.czOpen, false); return true; }
  return seat != null && ngClozeGo(app, s, seat, false);
}
// the Undo is over, and the push it held goes (app.src.jsx, `_undoHold`'s lifters)
function ngClozeLeave(app, s) {
  const c = ngCzNow(s);
  if (c && c.done) c.done.u = null;
  app._undoRelease();
}
export function ngClozeClose(app, s) {
  if (s.czOpen == null) return;
  ngClozeLeave(app, s);
  s.czOpen = null; s.czReg = null;
  if (s.czHost) s.czHost.hidden = true;
  s.ask.removeAttribute("data-cz");
  if (s.dock) { s.dock.lastChild.replaceChildren(); s.dock.lastChild._from = null; }
  app._czSync();
}

// ── drawing ──
const NG_CZ_ARROW = '<svg class="ar" width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.6v5.1a1.7 1.7 0 0 0 1.7 1.7H9.8"/><path d="M7.7 6.2 9.9 8.4 7.7 10.6"/></svg>';
const NG_CZ_TRI = '<svg class="tri" width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.1 9.1 8.6H.9z"/></svg>';
const ngCzShape = (r, gold, side) => '<svg class="sh" width="11" height="11" viewBox="-1 -1 11 11" aria-hidden="true"' + (gold ? ' data-gold="' + side + '"' : "") + '><path d="' + (r.tri ? "M4.5 .5 8.6 8.2H.4z" : "M4.5 .3 8.7 4.5 4.5 8.7.3 4.5z") + '"/></svg>';
const ngCzLead = (l) => (l.sub ? NG_CZ_TRI + '<span class="pl sb">' + ngCzEsc(l.name) + "</span>" : '<span class="pl">' + ngCzEsc(l.name) + "</span>" + (l.role ? '<span class="rt" data-role="' + l.role + '">' + l.role + "</span>" : ""));
// the second line (spec.md): the arrow, the place, its role; " · or " and a second place
const ngCzD2 = (r) => (r.leads.length ? '<span class="d2">' + NG_CZ_ARROW + ngCzLead(r.leads[0]) + (r.leads[1] ? '<span class="or">&nbsp;· or&nbsp;' + ngCzLead(r.leads[1]) + "</span>" : "") + "</span>" : "");
const ngCzLeadsTo = (r) => (!r.leads.length ? "" : ", leads to " + (r.leads[0].sub ? "the " + r.leads[0].name + " finish" : r.leads[0].name + (r.leads[0].role ? ", " + r.leads[0].role : "")));
const ngCzBarW = (name) => Math.min(210, Math.round(30 + name.length * 6.2));

function ngClozeHTML(app, c) {
  const asked = c.rows.filter((r) => r.ask), solid = c.rows.length - asked.length, t = app.practiceToday();
  let head;
  if (c.done) {
    const gold = c.rows.filter((r) => !r.ask || c.had.has(r.id)).length;
    head = '<div class="gl"><span class="gn">' + gold + '</span><span class="gt">' + (gold === 1 ? "move you remember from here" : "moves you remember from here") +
      '<small><span data-cz-plus="1">+' + asked.length + " toward today’s " + t.goal + "</span>" + (c.done.u ? ' <button type="button" class="un">Undo</button>' : c.done.late ? " This can no longer be undone." : "") + "</small></span></div>";
  } else {
    const say = ngClozeSay({ hide: asked.length, solid, shown: c.shown, had: c.had.size, goal: t.goal });
    head = '<div class="in">' + ngCzEsc(say[0]) + (say[1] ? "<small>" + ngCzEsc(say[1]) + "</small>" : "") + "</div>";
  }
  const open = c.shown || !!c.done;
  return head + c.rows.map((r, i) => {
    const had = !r.ask || c.had.has(r.id), bar = r.ask && !open;
    const cls = "cz" + (bar ? "" : open ? " two" : "") + (c.done ? " dn" : "") + (c.done && r.ask && !had ? " ms" : "");
    const right = bar ? "" : !r.ask ? '<span class="tl">solid</span>' : c.done ? '<span class="tl">' + ngCzEsc(ngClozeBack(c.done.rows.get(r.id), app._epochDay(), had)) + "</span>"
      : '<button type="button" class="tg" data-cz-had="' + ngCzEsc(r.id) + '" aria-pressed="' + had + '"><span>' + (had ? "Had it" : "Had it?") + "</span></button>";
    return '<div class="' + cls + '" data-cz-row="' + (r.ask ? "ask" : "solid") + '"' + (had && !bar ? ' data-had="1"' : "") + ' role="group" aria-label="' +
      ngCzEsc(bar ? "Hidden move " + (asked.indexOf(r) + 1) + " of " + asked.length : r.name + (open ? ngCzLeadsTo(r) : "")) + '">' + ngCzShape(r, had && !bar, c.side) +
      (bar ? '<span class="br" style="width:' + ngCzBarW(r.name) + 'px"></span>' : '<span class="tw"><span class="nm">' + ngCzEsc(r.name) + "</span>" + (open ? ngCzD2(r) : "") + "</span>") + right + "</div>";
  }).join("");
}
// WHAT GIVES WAY (spec.md), measured after layout: the second place's role, then the second place; only then may the first
// place's name end in an ellipsis. The arrow and the first role never go.
function ngClozeFit(c) {
  const host = c.host;
  if (!host || !host.isConnected) return;
  for (const [i, el] of [...host.querySelectorAll("[data-cz-row]")].entries()) {
    const r = c.rows[i], line = el.querySelector(".d2"), when = c.done && el.querySelector(".tl"), nm = el.querySelector(".nm");
    if (when && nm) nm.style.paddingRight = Math.max(92, Math.ceil(when.getBoundingClientRect().width) + 10) + "px";
    if (!line || !r) continue;
    line.outerHTML = ngCzD2(r);
    const l = el.querySelector(".d2"), over = () => l.scrollWidth > l.clientWidth + 0.5;
    if (over()) { const t = l.querySelector(".or .rt"); if (t) t.remove(); }
    if (over()) { const o = l.querySelector(".or"); if (o) o.remove(); }
    if (over()) l.querySelector(".pl").classList.add("cut");
  }
}
const NG_CLOZE_CSS = "[data-master-ask][data-cz]>:not([data-cloze]){display:none !important}" +
  ".ngz{padding:0 0 6px 20px;outline:none}" +
  ".ngz .in{margin:6px 0 8px;font-size:12px;line-height:1.45;color:#c2cce0}.ngz .in small{display:block;color:#7e8aa3;font-size:10.5px;margin-top:2px}" +
  ".ngz .gl{display:flex;align-items:center;gap:9px;margin:4px 0 8px}.ngz .gn{font-size:22px;line-height:1;font-weight:800;color:#f0c05a}" +
  ".ngz .gt{font-size:12.5px;line-height:1.35;color:#dbe2f0;font-weight:600}.ngz .gt small{display:block;font-size:10.5px;color:#7ee0a8;font-weight:700;margin-top:1px}" +
  ".ngz .un{min-height:0;border:0;background:none;padding:0 2px;margin-left:8px;font:inherit;font-weight:600;color:#8b97b0;text-decoration:underline;text-underline-offset:2px;cursor:pointer;position:relative}.ngz .un::after{content:'';position:absolute;inset:-16px -12px}" +
  ".ngz .cz{position:relative;display:flex;align-items:center;gap:10px;min-height:36px;padding:0 8px;margin:0 -8px;border-radius:8px}.ngz .cz.two{height:44px;min-height:0}" +
  ".ngz .sh{flex:none}.ngz .sh path{fill:none;stroke:rgba(150,170,210,.45);stroke-width:1.2;stroke-linejoin:round}.ngz .sh[data-gold] path{stroke:#f0c05a;stroke-width:1.5;fill:rgba(91,140,255,.55)}.ngz .sh[data-gold=bottom] path{fill:rgba(216,96,122,.55)}" +
  ".ngz .br{flex:none;max-width:100%;height:10px;border-radius:5px;background:linear-gradient(90deg,rgba(150,170,210,.2),rgba(150,170,210,.13));box-shadow:inset 0 0 0 1px rgba(150,170,210,.12)}" +
  ".ngz .tw{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:2px}" +
  ".ngz .nm{font-size:12.5px;font-weight:600;line-height:16px;color:#dbe2f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ngz .cz[data-had] .nm{color:#f6e2b4}.ngz .cz.ms .nm{color:#8b97b0;font-weight:500}" +
  ".ngz .d2{display:flex;align-items:center;min-width:0;height:14px;line-height:14px;font-size:10.5px;font-weight:500;letter-spacing:.01em;color:#7e8aa3;white-space:nowrap;overflow:hidden}.ngz .cz.ms .d2{opacity:.75}" +
  ".ngz[data-fade] .d2{animation:ngCzIn .18s ease-out .12s both}@keyframes ngCzIn{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.ngz[data-fade] .d2{animation:none}}" +
  ".ngz .ar{flex:none;display:block;margin-right:4px;position:relative;top:-1px;fill:none;stroke:#6b7691;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}" +
  ".ngz .tri{flex:none;display:block;margin:0 5px 0 1px;position:relative;top:-.5px}.ngz .tri path{fill:rgba(216,96,122,.35);stroke:#c2cce0;stroke-width:1.1;stroke-linejoin:round}" +
  ".ngz .pl{flex:none}.ngz .pl.sb{color:#aab4c8}.ngz .pl.cut{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}" +
  ".ngz .or{flex:none;display:flex;align-items:center;white-space:nowrap;color:#5d6883}" +
  ".ngz .rt{flex:none;font-size:8.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-left:5px;position:relative;top:.5px;color:#8fb0ff}.ngz .rt[data-role=bottom]{color:#d8889e}" +
  ".ngz .tl{flex:none;font-size:10.5px;font-weight:600;color:#7e8aa3}.ngz .cz.dn .tl{position:absolute;right:8px;top:6px;line-height:16px}.ngz .cz.dn .nm{padding-right:92px}" +
  ".ngz .tg{flex:none;align-self:stretch;display:flex;align-items:center;margin:0 -8px 0 0;padding:0 8px 0 6px;border:0;background:none;font:inherit;cursor:pointer}" +
  ".ngz .tg span{display:flex;align-items:center;height:26px;padding:0 10px;border-radius:8px;border:1px solid rgba(150,170,210,.25);background:rgba(255,255,255,.03);font-size:10.5px;font-weight:700;color:#8b97b0}" +
  ".ngz .tg[aria-pressed=true] span{border-color:rgba(240,192,90,.75);background:rgba(240,192,90,.1);color:#f6e2b4}" +
  ".ng-mbar>button.cz-b{border-radius:11px;border:1px solid rgba(120,150,255,.5);background:rgba(74,108,255,.2);color:#e3eaff;font:inherit;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:4px;padding:0 2px;cursor:pointer;white-space:nowrap;overflow:hidden}" +
  ".ng-mbar>button.cz-b small{font-size:10.5px;font-weight:600;opacity:.75;overflow:hidden;text-overflow:ellipsis}.ng-mbar>button.cz-b kbd{font:inherit;font-size:9px;opacity:.55;border:1px solid;border-radius:4px;padding:1px 6px;margin-left:5px}" +
  ".ng-mbar>button.cz-g,.ng-mbar>button.cz-n{border-color:rgba(150,170,210,.22);background:rgba(255,255,255,.035);color:#aab4c8}.ng-mbar>button.cz-n{font-size:15px}" +
  ".ng-mbar>button.cz-g:not(.mp):not(.mn){flex:none !important;width:54px !important}";

function ngClozeBar(app, s, c) {
  const bar = s.dock && s.dock.lastChild;
  if (!bar) return;
  const N = ngClozeNext(app, s), at = N.at, next = N.stop, b = (cls, html, attr, on, off) => {
    const e = document.createElement("button"); e.type = "button"; e.className = cls; e.innerHTML = html; e.setAttribute(attr, "1"); e.onclick = on; e.disabled = !!off; return e;
  };
  const sig = [c.seat, c.shown, !!c.done, c.had.size, at, next ? (next.cz != null ? next.cz : next.i) : N.own, !!N.prev].join("|");
  if (bar._cz === sig && bar.firstChild && bar.firstChild.hasAttribute("data-cz-prev")) return;
  bar._cz = sig; bar._from = null;
  const hold = c.shown && !c.done;   // revealed and not confirmed: Hide or Done first (as drawn)
  const nextName = !next ? (N.own ? "its cards" : "") : next.cz != null ? next.cz.split("|")[0] : app._masterSeatOf(s, s.keys[next.i]) === c.seat ? "its cards" : (app._masterSeatOf(s, s.keys[next.i]) || s.keys[next.i]).split("|")[0];
  const mid = c.done ? [b("cz-b", "Next" + (nextName ? " <small>" + ngCzEsc(nextName) + "</small>" : " <small>the list</small>"), "data-cz-next", () => (next || N.own ? app._masterStep(s, 1) : app._masterList(s)))]
    : c.shown ? [b("cz-b cz-g", "Hide", "data-cz-hide", () => ngClozeFlip(app, s, false)), b("cz-b", "Done <small>" + c.had.size + " had</small>", "data-cz-done", () => ngClozeDone(app, s))]
      : [b("cz-b", "Show <kbd>space</kbd>", "data-cz-show", () => ngClozeFlip(app, s, true))];
  bar.replaceChildren(b("mp cz-b cz-n", "‹", "data-cz-prev", () => app._masterStep(s, -1), hold || !N.prev), ...mid, b("mn cz-b cz-n", "›", "data-cz-step", () => app._masterStep(s, 1), hold || !(next || N.own)));
  bar.firstChild.setAttribute("aria-label", "Previous"); bar.lastChild.setAttribute("aria-label", "Next");
}
const ngCzSig = (c) => [c.shown, !!c.done, c.done && !!c.done.u, ...c.had].join("|");
function ngClozeDraw(app, s, c, fade) {
  const host = c.host = s.czHost;
  host.toggleAttribute("data-fade", !!fade);
  host.setAttribute("data-cloze", c.seat);
  host.innerHTML = ngClozeHTML(app, c);
  c.sig = ngCzSig(c);
  if (c.shown || c.done) ngClozeFit(c);
  ngClozeBar(app, s, c);
  ngClozeHead(s, c);
}
// the open place's heading: its name and where it stands in today's plan (the slim line is the open ask's)
function ngClozeHead(s, c) {
  const vi = s.plan && s.plan.order === "worth" ? s.plan.visits.findIndex((v) => v.seat === c.seat) : -1;
  const h = c.seat.replace("|", " · ") + (vi >= 0 ? " · position " + (vi + 1) + " of " + s.plan.visits.length : "");
  if (s.heading && s.heading.textContent !== h) s.heading.textContent = h;
}
function ngClozeFlip(app, s, on) {
  const c = ngCzNow(s);
  if (!c || c.done || c.shown === on) return;
  c.shown = on;   // a view, never a grade: nothing is written, and the taps are kept across Hide
  ngClozeDraw(app, s, c, on);
  app._czSync();
}
function ngClozeTap(app, s, id) {
  const c = ngCzNow(s);
  if (!c || !c.shown || c.done || !c.rows.some((r) => r.ask && r.id === id)) return;
  if (c.had.has(id)) c.had.delete(id); else c.had.add(id);
  const kept = s.czHost.contains(document.activeElement);
  ngClozeDraw(app, s, c, false);
  if (kept) { const b = [...s.czHost.querySelectorAll("[data-cz-had]")].find((e) => e.getAttribute("data-cz-had") === id); if (b) b.focus({ preventScroll: true }); }
}
// DONE: every hidden move written once, through the app's one writer; each is one of the day's 20
function ngClozeDone(app, s) {
  const c = ngCzNow(s), asked = c ? c.rows.filter((r) => r.ask) : [];
  if (!c || !c.shown || c.done) return;
  app._undoRelease();   // the confirm before this one can no longer be undone: its push goes
  app._undoHold = s;    // BEFORE the write: the save it asks for must already find the push waiting
  const u = app._gradeMoves(asked.map((r) => [r.st, r.mv, c.had.has(r.id)]));
  c.done = { u, rows: new Map(asked.map((r, i) => [r.id, u.wrote[i][2]])) };
  app.track("neural_cloze_done", { position: c.seat, asked: asked.length, had: c.had.size });
  ngClozeDraw(app, s, c, false);
  app._paintPractice(s);
}
// UNDO: the last confirm taken back exactly (the rows, the journal), the taps kept, the cloze shown again
function ngClozeUndo(app, s) {
  const c = ngCzNow(s);
  if (!c || !c.done || !c.done.u) return;
  if (app._ungradeMoves(c.done.u)) { c.done = null; c.shown = true; }
  else { c.done.u = null; c.done.late = true; app._undoRelease(); }   // a merge rebuilt a row: it is no longer this copy's to take back
  ngClozeDraw(app, s, c, false);
  app._paintPractice(s);
}
function ngClozeShow(app, s, seat, mine) {
  const c = ngClozeFor(app, s, seat);
  if (!c) return;
  if (!document.getElementById("ng-cloze-css")) { const st = document.createElement("style"); st.id = "ng-cloze-css"; st.textContent = NG_CLOZE_CSS; document.head.appendChild(st); }
  if (s.czOpen != null && s.czOpen !== seat) ngClozeLeave(app, s);
  clearTimeout(app._sessionAdvance);   // a walk to the next deck still pending from a card's last answer must not open a card over the cloze (L1-R2's fault, its third lifter)
  if (app._openMini) app._openMini.close();
  if (app._mc && app._mc.surface === "practice") { app._mc.spent = true; app._mc = null; }
  app._openRow = app._focusRow = null;
  if (!s.czHost || !s.czHost.isConnected) {
    const host = s.czHost = document.createElement("div"); host.className = "ngz"; host.tabIndex = -1;
    host.onclick = (e) => {
      const t = e.target.closest && e.target.closest("[data-cz-had],.un");
      if (t && t.className === "un") ngClozeUndo(app, s); else if (t) ngClozeTap(app, s, t.getAttribute("data-cz-had"));
    };
    s.ask.prepend(host);
    if (!app._czFit) { app._czFit = () => { const x = app._session, o = x && ngCzNow(x); if (o && (o.shown || o.done)) ngClozeFit(o); }; window.addEventListener("resize", app._czFit); if (document.fonts && document.fonts.ready) document.fonts.ready.then(app._czFit); }
  }
  s.czOpen = seat; s.czHost.hidden = false; s.ask.setAttribute("data-cz", "");
  s.czReg = { reveal: () => ngClozeFlip(app, s, !ngCzNow(s).shown), enter: () => { const o = ngCzNow(s); if (o.done) app._masterStep(s, 1); else if (o.shown) ngClozeDone(app, s); else ngClozeFlip(app, s, true); },
    prev: () => app._masterStep(s, -1), next: () => app._masterStep(s, 1), at: () => [0, 1] };
  if (s.list) { s.list = false; app._masterMode(s); }
  ngClozeDraw(app, s, c, false);
  app._masterPlace(s);
  if (mine) { app._masterShow(s); s.czHost.focus({ preventScroll: true }); }
  app._czSync();
  app._paintPractice(s);
}
// a repaint of the page (a plan that landed, a grade elsewhere): the open cloze is drawn again only when what it shows changed
export function ngClozePaint(app, s) {
  const c = ngCzNow(s);
  if (!c || !s.czHost || !s.czHost.isConnected) return;
  if (c.sig !== ngCzSig(c)) ngClozeDraw(app, s, c, false); else { ngClozeBar(app, s, c); ngClozeHead(s, c); }
}
// what the list's row counts at a place: the moves its cloze still has to ask
export function ngClozeLeft(app, s, seat) { return app._asksMoves() ? ngClozeAsks(app, s, seat) : []; }
