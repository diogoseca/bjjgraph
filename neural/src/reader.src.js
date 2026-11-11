// The complete published article is the source of truth. This module is deferred:
// content arrivals prepare dormant controls; game articles load after the real hand.
// Film has dedicated normal-home and section preferences; legacy keys remain in storage.
// D-338 retired Focus on reading: `readingFocus` and its reading* overrides are never read
// again (a settings key can never be deleted, §6.6), so a saved Focus cannot strand anyone.
// v1.253.0 (owner, U114 a, 2026-11-09: "retire those 2 components"): the article's ✕ and the shelf were the only writers of readerBook,
// landMap and landFeedback, so those three are never read again either: a saved "off" can strand nobody. The article-away map view,
// hiding the map and hiding the game's feedback went with them (his call).
const GAME_KEYS = { film: "landFilm", card: "landCard", hand: "landHand" };
const CONTENT = /^\/(Positions|Transitions|Submissions|Principles|Learning|Systems)(?:\/|$)/i;
const ROLES = /\/(Top|Bottom|Attacker|Defender)$/i;
const REFERENCE = /^\/(Principles|Learning|Systems)\//;
const cleanPath = (path) => decodeURI(new URL(path, location.href).pathname).replace(/\.html$/, "").replace(/\/$/, "") || "/";
const pathRole = path => (path.split("/").pop() || "Guide") + " perspective";

// Shared with the deferred Settings UI. Persist semantic types, never a route,
// translated heading or ordinal. Additions do not delete old settings (§6.6).
export const SECTION_TYPES = [
  ["videos", "Video"], ["aka", "Also known as"], ["confused", "Often confused with"], ["definition", "Position definition"],
  ["overview", "How it works"], ["principles", "Essential principles"],
  ["recognition", "Recognition"], ["setup", "Setup"], ["prerequisites", "Prerequisites"],
  ["options", "Options and applications"], ["safety", "Safety guides"], ["mistakes", "Common mistakes"],
  ["escapes", "Escape paths"], ["favorable-outcomes", "Favorable outcomes"], ["outcomes", "Outcomes"],
  ["training", "Training"], ["statistics", "Statistics"], ["variations", "Variations"],
  ["role-comparison", "Role comparison"], ["top-summary", "From the top"], ["bottom-summary", "From the bottom"],
  ["attacker-summary", "As the attacker"], ["defender-summary", "As the defender"],
  ["assessment", "Self-assessment"], ["progress", "Progress markers"], ["integration", "Position integration"],
  ["sources", "Sources"], ["course", "Course"], ["related", "Related"], ["additional", "Additional reading"],
];
export function sectionShown(app, type) {
  return app.get("readerSection." + type, true) !== false;
}
// Group aliases by their semantic type; identity aliases below ship each name only once.
const SECTION_IDS = Object.fromEntries(Object.entries({
  "videos": "film-study official-preview",
  "overview": "overview definition",
  "definition": "state-invariants",
  "aka": "also-known-as",
  "confused": "often-confused-with",
  "principles": "key-principles building-blocks key-takeaways",
  "recognition": "recognition-cues",
  "setup": "setup-requirements conditions",
  "prerequisites": "prerequisites fit",
  "options": "defensive-options execution-steps common-counters opponent-defense-patterns decision-tree applications where-to-apply how-to-apply coverage",
  "safety": "safety-considerations",
  "mistakes": "common-mistakes mistakes-to-avoid mistakes",
  "escapes": "escape-paths",
  "outcomes": "possible-outcomes outcomes terminal-state",
  "training": "exercises training-drills training-progressions practice how-to-practice training",
  "variations": "variations-and-setups variants-and-adaptations variations variants",
  "assessment": "knowledge-assessment self-assessment test-your-knowledge",
  "statistics": "position-metrics",
  "progress": "progress-markers",
  "integration": "position-integration",
  "related": "related related-content related-positions related-submissions related-techniques techniques from-positions",
}).flatMap(([type, ids]) => ids.split(" ").map(id => [id, type])));
for (const type of "favorable-outcomes role-comparison top-summary bottom-summary attacker-summary defender-summary sources".split(" ")) SECTION_IDS[type] = type;
const SECTION_ORDER = ["videos", "overview", "principles", "recognition", "setup", "prerequisites", "options", "safety", "mistakes"];
// Owner (2026-11-01, Side Control Bottom): "what people will probably care most about is 'What is side control
// bottom?'", then the principles; decisions and mistakes are "very nice", statistics go up, the overview "looks very
// boring", and prerequisites and training go down. Sections he did not name keep their place at rank 50, and a position's
// safety keeps its seat between options and mistakes (S1 a moved only a submission's guide). Position pages only: the reader
// sorts the article, so this is the live order; the templates' order is what a no-JS page shows.
const POSITION_ORDER = "videos aka confused definition principles options safety mistakes statistics overview prerequisites training".split(" ");
// D-338 (owner): one close icon, the same on every width, and a closed section becomes a
// light label (its glyph above its name, no box). Both faces live in the one toggle and CSS
// shows the face that matches [data-collapsed]: replacing a child between pointerdown and
// click would detach the mouse target and lose its first activation.
// U11 (owner, 2026-10-21): sections no longer have icons. A closed one reads as its greyed name followed by
// an eye with a slash, so people understand it is hidden.
const EYE_OFF = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zm7 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0M3 3l18 18"/></svg>';
function eyeOff() { const icon = element("span", { class: "ng-section-eye", "aria-hidden": "true" }); icon.innerHTML = EYE_OFF; return icon; }
// HIDESEC2 (owner, U131, 2026-11-11: "b2, Settings own it, with the message in place"; his note: "This is also valid for other sections
// that are closed ... and the name of the section should be bold or some other style to differentiate it from the other text in the
// sentence"). A part's ✕ (Moves, Questions, the video, any article section) hides it and leaves nothing behind: no label, no "Hidden
// sections" fold. Settings > Rolling owns the way back (Bottom of the screen; Article sections), and where the index shows (1440), its row
// still reopens a part. In the part's own place a message says so for five seconds: the part's name in bold, "Settings" a press that opens
// Settings at that part's switch, and Undo. A part a map tap took away for this landing keeps its label (paintPart): no switch can bring
// a one-landing hide back.
// THE PRESS RULE. HIDESEC1 measured b2's first build: when the message left, what stood under it moved up a line, and a press aimed at
// Undo landed on the moved neighbour (a film button at 1440, prose at 390). The claim now is that a press aimed at a message never lands
// on something else: (1) a message never leaves while a mouse is over it, a pointer is down on it, or it holds focus; (2) leaving, it
// fades and its controls stop taking presses, but its place stays and takes a press itself, which brings the message back; (3) the places
// close only once every message has left and gone quiet, so no message moves while one stands; (4) for SHIELD_MS after they close, a
// press that starts inside a closed place is swallowed whole (shield). Several closed in a row: one message per part, each in its place.
// Pinned by e2e/journeys/hidden-sections.spec.ts.
const NOTICE_MS = 5000, AGAIN_MS = 2000, FADE_MS = 400, QUIET_MS = 400, SHIELD_MS = 400;
// A message moves focus to its Undo only after a key press, so a mouse or a finger never sees a ring.
let byKey = false;
function faces(type, title) {
  const close = element("span", { class: "ng-section-x", "aria-hidden": "true" }, "✕");
  const label = element("span", { class: "ng-section-closed" });
  label.append(element("span", {}, title), eyeOff());
  return [close, label];
}

// Thirty and eleven call sites; the bundle shortens locals but keeps a property name whole, and the deferred cap is exact.
const rect = el => el?.getBoundingClientRect();
const listen = (el, ...args) => el.addEventListener(...args);
function element(tag, attrs = {}, text = "") {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.textContent = text;
  return node;
}
// v1.254.0, the ghost press: a background tap closes the card and its "Show Questions" label takes the card's place at once, so on
// touch the click that ends the same tap (hit-tested after the layout moved) landed on the label and reopened the card (768x1024,
// 1 landing in 8 at "/"). A pointer's click counts only if its own pointerdown was on the button; a key's (detail 0) always does.
// A mouse cannot tell: its click goes to the common ancestor of where it went down and up.
let downOn = null;
const down = (event) => { downOn = event.target; };
function button(label, action, attrs = {}) {
  const node = element("button", { type: "button", ...attrs }, label);
  node.style.pointerEvents = "auto";
  document.addEventListener("pointerdown", down, true);
  listen(node, "click", (event) => { event.stopPropagation(); if (!event.detail || node.contains(downOn)) action(event); });
  return node;
}

export async function installReader(app) {
  // Measure only styled chrome. A bare nav initially lays out at the top of the
  // wrap; reserving that rectangle would move the hand above the viewport and
  // poison the camera's tighten-only band cache before the CSS arrives.
  if (!await app._ensureReadCSS()) throw new Error("Reading styles could not be loaded.");
  if (app._reader || app.__ngDestroyed) return;
  const reader = app._reader = new Reader(app);
  app._readerFailed = false;
  // Game intent is explicit. Restoring a layer, closing Browse or leaving Focus is
  // deliberately absent from these lifters: none of those actions starts a roll.
  for (const name of ["rollFromPosition", "stageRollAt", "startRoll", "resetRoll"]) {
    const original = app[name];
    app[name] = function (...args) {
      // D-318 U6a: the other half replaces the reading role switch, including
      // its history and dormant intent. Other map navigation keeps its owner.
      const node = name === "stageRollAt" && this.nodes[args[0]];
      if (reader.intent && node?.pi === this.focusIdx) {
        let path = this._nodeUrlPath(node.idx);
        if (!ROLES.test(path)) path += "/" + (node.ty === "positions" ? "Top" : "Attacker");
        return this._readArticle(path);
      }
      if (!reader.seating) reader.leaveReading();
      return original.apply(this, args);
    };
  }
  const activate = app.activateOption;
  app.activateOption = function (opt, pick, card, inspect) {
    if (opt && !opt.threat && !inspect && !this._execution && !this._checkpoint && (!this._rollHand || this._rollHand.mounted)) reader.beginPlay();
    return activate.call(this, opt, pick, card, inspect);
  };
  const execution = app.executionCard;
  app.executionCard = function (opt) {
    const card = execution.call(this, opt), row = this.optionsRef.current;
    if (card && row?.parentElement === reader.game) {
      const shown = this._optionCards.find(c => c.opt === opt).card;
      // Escape owns the reservation's lifetime (arrival, resize or deliberate
      // reading). Native flow carries measured row/height instead of a fixed
      // preview push, including the selected card's group-label clearance.
      const box = rect(row), game = rect(reader.game);
      card.style.marginTop = rect(shown).top - box.top - parseFloat(getComputedStyle(row).paddingTop) + "px";
      card._ngDock.bottom = window.innerHeight - box.bottom;
      card._ngDock.reader = { rowTop: box.top - game.top, height: game.height, rowHeight: box.height };
    }
    return card;
  };
  // An answer starts play on the SAME question and hand; rebuilding would lose
  // its grade or pay it twice. Inspecting an opponent's option is still reading.
  const answered = app._landAnswered;
  app._landAnswered = function (...args) {
    const result = answered.apply(this, args);
    reader.beginPlay();
    return result;
  };
  const attempt = app.enterAttempt;
  app.enterAttempt = function (...args) { reader.beginPlay(); return attempt.apply(this, args); };
  const apply = app._applyLayers;
  app._applyLayers = function (...args) { const result = apply.apply(this, args); reader.sync(); return result; };
  const deck = app.setDeckOpen;
  app.setDeckOpen = function (...args) {
    const result = deck.apply(this, args);
    if (!args[0] && reader.intent) reader.lightReference();
    return result;
  };
  for (const name of ["expandClip", "collapseClip"]) {
    const original = app[name];
    app[name] = function (...args) {
      // D-353: a play is the player's own input and settles a pinned landing, as grading does. A
      // current technique's player now opens in the theater and only a reference clip opens in place,
      // but the landing still settles. No sync here: moving a film that just started could pause it.
      if (name === "expandClip") this._readerPin = null;
      const result = original.apply(this, args); reader.layout(); return result;
    };
  }
  const scroll = app._readApply;
  app._readApply = function (...args) { const result = scroll.apply(this, args); reader.layout(); return result; };
  const pageDeck = app._updateLandDeck;
  app._updateLandDeck = function (...args) {
    const result = pageDeck.apply(this, args);
    // A new page starts at the deck's top. Since D-338 put Videos and Moves above Questions
    // that is the card's own top edge, never the flow's (which would scroll the deck away).
    if (reader.gamePage != null && this._landPage != null && reader.gamePage !== this._landPage) {
      const root = reader.root, top = this._landEl ? rect(this._landEl).top - rect(root).top + root.scrollTop - 6 : 0;
      root.scrollTop = Math.min(root.scrollTop, Math.max(0, top));
    }
    reader.gamePage = this._landPage;
    return result;
  };
  const readKey = app._readKey;
  app._readKey = function (event) { return reader.gameKey(event) || readKey.call(this, event); };
  // The reader's parts reopen from their own labels; a dock the app built before this module arrived goes.
  app._layerDockEl?.remove(); app._layerDockEl = null;
  // HIDESEC1 b: a part's own ✕ is the one handle that asks for the message (src "x"); Settings and Undo do not.
  const layer = app.setLayer;
  app.setLayer = function (name, on, src) {
    const result = layer.apply(this, arguments);
    // D-351's own rule: closing the card settles a pinned landing. _readerHold's release asks for the card to still exist, which the ✕
    // removes first, so the pin outlived the close and kept the closed card's old top: the message, then the film, stood 4px into
    // Moves' band (card-close-gap.spec.ts's 1440 control, on a landing the hold had pinned). Measured: dev's run was simply unpinned.
    if (result && name === "card" && on === false) this._readerPin = null;
    if (result && src === "x" && on === false) reader.notice(name === "film" ? "videos" : name);
    return result;
  };
  // HIDESEC2 with free roam (#370, v1.256.5): `_putReaderAway` hides the reader by visibility alone, so a message standing in it kept its
  // timers, and when its place then closed, the press window (shield) would have swallowed a press on the map, visible again under it.
  // Putting the article away takes every message with it, at once and with no window: nothing visible moves under a hidden reader.
  const putAway = app._putReaderAway;
  if (putAway) app._putReaderAway = function (away) { if (away) reader.dropNotices(); return putAway.apply(this, arguments); };
  document.addEventListener("keydown", () => { byKey = true; }, true);
  document.addEventListener("pointerdown", () => { byKey = false; }, true);
  for (const type of ["pointerdown", "mousedown", "touchstart", "pointerup", "mouseup", "touchend", "click"]) {
    window.addEventListener(type, event => reader.shield(event), { capture: true, passive: false });
  }
  reader.hooked = true; reader.publishCard(app._landEl);
}

class Reader {
  constructor(app) {
    this.app = app;
    this.cache = new Map();
    this.noticeMap = new Map(); this.shields = [];
    this.renderSerial = 0;
    this.gamePage = app._landPage;
    this.interacting = false;
    this.trayBottom = 84;
    // _pushUrl changes the address without replacing Quartz's DOM. Only data-slug
    // identifies this cached article; location.pathname would reuse the wrong page.
    const slug = document.body.dataset.slug;
    if (slug && document.querySelector("article")) this.cache.set(cleanPath("/" + slug), this.extract(document));
    this.root = app._readerEl = element("section", { class: "ng-reader", "aria-label": "Reading", "data-reader": "", tabindex: "-1" });
    this.root.style.pointerEvents = "none";
    // Clicking question text gives subsequent keys to the game, rather than
    // the reading root's native document-key path.
    this.game = element("div", { class: "ng-reader-game", tabindex: "-1" });
    this.mediaHome = element("div", { class: "ng-reader-media-home", "data-land-media-slot": "" });
    this.articleEl = element("div", { class: "ng-reader-article" });
    this.root.append(this.game, this.articleEl);
    // These controls exist before any article fetch finishes. A late title or
    // prose response must not insert a new toolbar above a live answer.
    // D-338 removed Focus on reading and Browse (the logo opens the same Explore pane).
    // The head keeps the page's h1 and, on reference pages, Study tools; bare, it has no box.
    this.head = element("header", { class: "ng-reader-head", "data-bare": "" });
    this.heading = element("h1", { tabindex: "-1" });
    this.tools = element("div", { class: "ng-reader-tools" });
    this.head.append(this.heading, this.tools); this.game.append(this.head);
    // D-338: no header names Moves or Questions. Each closes with its own ✕ (the hand's
    // and the card's); a closed one leaves this label in its place, which reopens it.
    this.gameSections = [["hand", "Moves"], ["card", "Questions"]].map(([part, title]) => {
      const id = "reader-" + part, card = element("div", { class: "ng-reader-closed-part", id, "data-collapsed": "false", hidden: "" });
      const toggle = button("", () => this.toggle(part), { "data-game-open": part, "aria-controls": id + "-body" });
      toggle.append(faces(part, title)[1]); card.append(toggle); this.game.append(card);
      return { part, type: part, title, id, card, toggle };
    });
    // Last, so Tab goes Moves, question, film: the left cell, then the right. It never moves after this (D-501: that reloads a player).
    this.game.append(this.mediaHome);
    this.gameHomes = new Map();
    this.sections = [];
    app.wrapRef.current.append(this.root);
    for (const type of ["wheel", "touchstart", "pointerdown", "focusin"]) {
      listen(this.root, type, (event) => {
        // Paging can replace the target before this event bubbles. Its original
        // path still identifies game input, even after that target is detached.
        // The Videos section lives in the game flow (D-338) but is reading, not play.
        if (this.gameInput(event)) return;
        // Toolbar activation has its own intent. Native text selection and prose
        // focus count as reading before the question clock gets another frame.
        if (type === "wheel" || type === "touchstart" || !event.target.closest(".ng-reader-tools")) this.readingInteraction(type, event);
        event.stopPropagation();
      }, { passive: true });
    }
    listen(this.root, "keydown", (event) => {
      if (event.key !== "Escape" && !this.gameInput(event)) { this.readingInteraction(); event.stopPropagation(); }
    });
    listen(this.root, "click", (event) => this.link(event));
    // The reader's place survives the browser's clamp. When the scrollport grows for a moment (the
    // pane opening moves the bottom reservation) the shorter maximum clamps scrollTop to the new end;
    // that scroll is not the reader's, so the place is kept and layoutNow restores it once the
    // document allows. Any other scroll, the reader's own or a deliberate write, is the new place.
    // A clamp is the END moving under the place, so the place must lie past the end. v1.250.1: this asked only "at the
    // end and below the place", which is also the first tick of a smooth Ctrl+Home from the end, when that tick moves
    // 1px. layoutNow then wrote the place back, the running animation kept the +1 as an offset, and it stopped at 1
    // for good (reading-navigation.spec.ts on CI run 42152251420; 2 of 72 under load on two cores, 0 of 40 without).
    listen(this.root, "scroll", () => {
      const r = this.root, end = r.scrollHeight - r.clientHeight;
      if (!(r.scrollTop >= end - 1 && this.placeTop > end + 1)) this.placeTop = r.scrollTop;
      this.layout();
    }, { passive: true });
    this.resize = new ResizeObserver(() => this.layout());
    // A tile's height decides where the next one goes: a font swap or a late player changes it with no other layout.
    this.tileSizer = new ResizeObserver(() => this.layout());
    this.resize.observe(this.root);
    this.resize.observe(this.head);
  }
  gameInput(event) { return event.composedPath().includes(this.game); }
  extract(doc) {
    const article = doc.querySelector("article");
    if (!article) throw new Error("This page has no article.");
    return {
      title: doc.querySelector("h1.article-title, .article-title, h1")?.textContent?.trim() || doc.title.split(" | ")[0],
      tab: doc.title,
      html: article.innerHTML,
    };
  }
  async page(path, signal) {
    if (this.cache.has(path)) return this.cache.get(path);
    const response = await fetch(path, { signal, credentials: "same-origin" });
    if (!response.ok) throw new Error("The article could not be loaded (" + response.status + ").");
    const record = this.extract(new DOMParser().parseFromString(await response.text(), "text/html"));
    this.cache.set(path, record);
    // A small session cache, not a second copy of the corpus.
    if (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value);
    return record;
  }
  async open({ path, intent, push }) {
    const url = new URL(path, location.href);
    path = cleanPath(url.href);
    if (!intent && this.path === path) return;
    if (this.path !== path) {
      if (this.app._landFilmEl?.dataset.referenceFilm) this.app._clearLandFilm();
      this.place(this.mediaHome); this.media = null; this.root.scrollTop = this.placeTop = 0;
    }
    this.path = path;
    this.intent = intent;
    const hit = this.app._nodeAndRoleForPath(path);
    this.interacting = !!intent && hit.idx < 0;
    if (intent && hit.idx >= 0) {
      // Reuse the real seat, question and choices without a deal, rush or clock.
      // The selected technique owns focus/URL; its origin remains the engine seat.
      this.seating = true;
      // A cached direct article can finish before the first animation frame.
      // Seat timestamps must use the frame clock's origin, never undefined.
      if (!Number.isFinite(this.app.now)) this.app.now = this.app.lastT || 0;
      try { this.app.rollFromPosition(hit.idx, true, hit.role); }
      finally { this.seating = false; }
      this.app._staged = this.app.currentPos;
      this.app._urlSeeded = true;
      this.app._refPage = false;
      this.app.introDone = true;
    }
    this.abort?.abort();
    const controller = this.abort = new AbortController(), serial = ++this.renderSerial;
    this.reference = null;
    if (intent && /^\/(Principles|Learning|Systems)\//i.test(path)) {
      this.app.clearFocus();
      this.app._exQ = "";
      if (this.app.explorerSearchRef.current) this.app.explorerSearchRef.current.value = "";
      this.highlightReference(path, serial);
    }
    push = push && !this.app._writeUrl(url, { ngReading: true });
    this.root.dataset.readerPath = path;
    this.root.dataset.readerReady = "false";
    if (this.contents) this.contents.hidden = true;
    this.place(this.mediaHome);
    this.sections = []; this.mediaSlot = null; this.leadCells = 0;
    this.articleEl.replaceChildren(...(this.head.parentElement === this.articleEl ? [this.head] : []), element("p", { role: "status" }, "Loading the complete article…"));
    this.sync();
    try {
      const record = await this.page(path, controller.signal);
      // A hub includes its context and the full default perspective below it. A
      // role arrival also carries the hub, including submission safety. Links to
      // the other perspective retain their own canonical URL and authored text.
      const hub = path.replace(ROLES, "");
      const pair = /^\/(Positions|Transitions|Submissions)\//i.test(path);
      let guidePath = path, context = null, guide = record;
      if (pair && ROLES.test(path)) context = await this.page(hub, controller.signal);
      else if (pair) {
        const roleLink = this.roleLinks(record.html, path)[0];
        if (roleLink) { context = record; guidePath = roleLink.pathname; guide = await this.page(guidePath, controller.signal); }
      }
      if (serial !== this.renderSerial || this.app.__ngDestroyed) return;
      this.app._writeUrl(push ? url : undefined, push && { ngReading: true });
      this.render(record.title, guide, guidePath, context, hub);
      this.root.dataset.readerReady = "true";
      this.sync();
      // D-352: ready means laid out. A reference arrival's first layout moves the head (Study tools)
      // out of the game's header row; a frame later, a click aimed at "ready" hit the map instead.
      this.layoutNow();
      if (url.hash) this.anchor(url.hash);
      else if (this.interacting) this.heading.focus({ preventScroll: true });
    } catch (error) {
      if (serial !== this.renderSerial || error.name === "AbortError" || this.app.__ngDestroyed) return;
      // #331's review (R1): Retry reopens the address as asked, its #section included; `path` is normalised and has none.
      this.articleEl.replaceChildren(element("p", { role: "alert" }, error.message),
        button("Retry article", () => this.open({ path: url.href, intent, push }), { "data-reader-retry": "" }),
        element("a", { href: path, target: "_blank", rel: "noopener" }, "Open the original page in a new tab"));
    }
  }
  async highlightReference(path, serial) {
    const a = this.app, id = path.slice(1), system = path.startsWith("/Systems/");
    let record;
    if (system) record = await a._ensureSystemRecord(id);
    else { await a._ensureConcepts(); record = a._conceptsById?.[id]; }
    if (!record || serial !== this.renderSerial || a.__ngDestroyed || !this.intent) return;
    this.reference = { record, system };
    if (system) { a._systemId = id; a._systemRecordStatus = "ready"; }
    else a._conceptId = id;
    this.lightReference();
  }
  lightReference() {
    if (!this.reference) return;
    const { record, system } = this.reference, a = this.app;
    if (system) { a._systemId = record.id; a.setFocusIdxSet(a.systemNodeIdxs(record)); }
    else { a._conceptId = record.id; a.focusConcept(record); }
  }
  roleLinks(html, path) {
    const box = document.createElement("div"); box.innerHTML = html;
    const base = new URL(path, location.origin), links = new Map();
    for (const a of box.querySelectorAll("a[href]")) {
      const url = new URL(a.getAttribute("href"), base);
      if (url.origin === location.origin && ROLES.test(url.pathname) && url.pathname.replace(ROLES, "") === path.replace(ROLES, "")) links.set(url.pathname, url);
    }
    return [...links.values()].sort((a, b) => Number(/Bottom|Defender/i.test(a.pathname)) - Number(/Bottom|Defender/i.test(b.pathname)));
  }
  pageArticle(record, path, kind) {
    const article = element("article", { "data-reader-article": kind, "data-source-path": path });
    article.innerHTML = record.html;
    article.querySelectorAll("script,style").forEach((node) => node.remove());
    // v1.251.4: no heading is injected into section#overview any more. The tile names it, and on a hub the injected one showed once per
    // text section, so the tile read "How it works" three times. The section keeps id="overview", which anchor() finds first anyway.
    const base = new URL(path, location.origin);
    // Source pages sometimes repeat a section's id on its heading. Each clone id
    // is unique, and heading links resolve within this article, never the hidden DOM.
    article.querySelectorAll("[id]").forEach((node, index) => {
      const id = node.id, mapped = "reader-" + this.renderSerial + "-" + kind + "-" + index;
      node.dataset.sourceId = id; node.id = mapped;
    });
    for (const node of article.querySelectorAll("[href],[src],[poster]")) {
      for (const attr of ["href", "src", "poster"]) {
        const value = node.getAttribute(attr); if (!value) continue;
        const url = new URL(value, base);
        // S1 a: a seat's safety line names its hub's guide, so that link also works without the app. The
        // reader shows that guide on the seat's own page, so a link to the page's own hub stays in place.
        if (attr === "href" && url.origin === base.origin && [path, path.replace(ROLES, "")].includes(cleanPath(url.href)) && url.hash) {
          node.dataset.readerAnchor = decodeURIComponent(url.hash.slice(1));
          node.setAttribute(attr, path + url.hash);
        } else node.setAttribute(attr, url.href);
        if (attr === "href" && url.origin === location.origin && ROLES.test(url.pathname) && /^Play as /i.test(node.textContent.trim())) node.textContent = node.textContent.replace(/Play as /i, "Read as ");
      }
      for (const attr of [...node.attributes]) if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
    }
    // The media owner supplies one live host; article extraction never creates
    // another player. Retain all authored prose, credits and source destinations.
    article.querySelectorAll("iframe").forEach((frame) => {
      const source = frame.getAttribute("src"), parent = frame.parentElement;
      // Seatless pages have no landing dossier. Adapt their published embeds to
      // the SAME media owner before retiring the source player, including clips
      // in Learning/System pages. No game seat or second playback path is made.
      if (REFERENCE.test(path) && source) {
        const url = new URL(source), id = url.pathname.match(/^\/embed\/([^/]+)/)?.[1];
        if (id && /(^|\.)youtube(-nocookie)?\.com$/.test(url.hostname)) {
          const clip = frame.closest(".film-clip");
          this.referenceClips.push({ id, title: clip?.querySelector("strong")?.textContent || frame.title || "Instructional video",
            start: Number(url.searchParams.get("start")) || 0, end: Number(url.searchParams.get("end")) || undefined,
            vertical: clip?.classList.contains("film-clip--vertical") });
        }
      }
      if (source && !parent?.parentElement?.querySelector('a[href*="youtu"]')) {
        const link = element("a", { href: source, target: "_blank", rel: "noopener" }, "Watch video");
        frame.replaceWith(link);
      } else frame.remove();
    });
    return article;
  }
  render(title, record, path, context, hub) {
    this.place(this.mediaHome);
    this.referenceClips = [];
    this.articleEl.replaceChildren(...(this.head.parentElement === this.articleEl ? [this.head] : []));
    const tools = this.tools;
    this.heading.textContent = title;
    tools.querySelector("[data-reader-study]")?.remove();
    if (REFERENCE.test(this.path)) {
      tools.append(button("Study tools", async () => {
        const id = this.path.slice(1);
        if (id.startsWith("Systems/")) this.app.openSystem(id);
        else { await this.app._ensureConcepts(); if (this.path.slice(1) === id) this.app.openConcept(id); }
      }, { "data-reader-study": "" }));
    }
    this.head.toggleAttribute("data-bare", !tools.children.length);
    const body = this.body = element("div", { "data-reader-body": "", tabindex: "0" });
    if (context) {
      const shared = this.pageArticle(context, hub, "hub");
      // A perspective page is already complete. Its hub contains BOTH players'
      // summaries, execution steps and outcomes, which must never leak across a
      // seat or stand in for an unauthored defender. Only shared safety is added.
      if (ROLES.test(this.path)) {
        shared.replaceChildren(...shared.querySelectorAll('[data-source-id="safety-considerations"]'));
      }
      body.append(shared);

    }
    body.append(this.pageArticle(record, path, "guide"));
    this.splitSections(body);
    this.contents?.remove();
    const contents = this.contents = this.app._readerTocEl = element("nav", { class: "ng-reader-toc", "aria-label": "Table of contents", id: "reader-contents", hidden: "" });
    // Ambient state (z:6), outside the native scrollport. Its inline hit surface
    // is named separately in attachInput: pointerdown must not capture the wrap.
    contents.style.pointerEvents = "auto";
    listen(contents, "click", event => this.link(event));
    for (const type of ["wheel", "touchstart", "focusin"]) listen(contents, type, event => {
      this.readingInteraction(); event.stopPropagation();
    }, { passive: true });
    listen(contents, "keydown", event => { if (event.key !== "Escape") event.stopPropagation(); });
    const hit = this.app._nodeAndRoleForPath(path), node = this.app.nodes[hit.idx];
    const indexTitle = element("h2", {}, title);
    if (node) {
      const role = node.ty === "positions" ? /\/Bottom$/.test(path) ? "Bottom" : "Top"
        : /\/Defender$/.test(path) ? node.ty === "submissions" ? "Escaping" : "Defending" : "Attacking";
      // D-338 (owner, reversing D-331 N1): one phrase, role first, the qualifier in line:
      // "Escaping Loop Choke from Half Guard", never "Loop Choke · Escaping / from Half Guard".
      const qual = this.app.nodeQual(node);
      indexTitle.textContent = role + " " + this.app.graphName(node);
      if (qual) indexTitle.append(" ", element("small", {}, qual));
    }
    contents.append(indexTitle);
    // D-338: the index navigates and shows what is closed; it no longer opens or closes a
    // section (the section's own ✕ and label do), and "Section settings" is gone from it.
    for (const section of this.readingOrder(!!node)) {
      if (section.more) continue;
      const row = element("div", { class: "ng-reader-toc-row", "data-toc-section": section.id, "data-toc-type": section.type });
      const link = element("a", { href: "#" + section.id, "data-section-link": section.id, "aria-label": "Go to " + section.title }, section.title);
      link.style.pointerEvents = "auto";
      row.append(link, eyeOff()); contents.append(row); section.row = row;
    }
    // U131 b2 retired U25 a's "Hidden sections" disclosure: a closed section stays where it is, hidden (syncSections).
    this.articleEl.append(body);
    this.app.wrapRef.current.append(contents);
    this.syncSections();
  }
  splitSections(body) {
    const path = this.path, parts = [], position = /^\/Positions\//.test(path);
    for (const article of [...body.children]) {
      if (!article.matches("article")) continue;
      const flat = [];
      const walk = (node) => {
        if (node.nodeType === 1 && node.matches("main.content-wrapper,main.system-guide,.learning-reader" + (position ? ",.entity-relations" : ""))) [...node.childNodes].forEach(walk);
        else if (node.nodeType === 1 || node.nodeType === 3 && node.textContent.trim()) flat.push(node);
      };
      [...article.childNodes].forEach(walk);
      let range;
      for (const node of flat) {
        if (node.nodeType === 1 && node.matches("h2")) {
          range = element("section", { "data-source-id": node.dataset.sourceId || "" });
          parts.push({ node: range, source: article }); range.append(node);
        } else if (range && !(node.nodeType === 1 && node.matches("section"))) range.append(node);
        else { range = null; parts.push({ node, source: article }); }
      }
    }
    const buckets = new Map(), transition = /^\/Transitions\//.test(path), submission = /^\/Submissions\//.test(path);
    const defender = /\/Defender$/.test(path), bottom = /\/Bottom$/.test(path), reference = /^\/(Learning|Systems)\//.test(path);
    const labels = Object.fromEntries(SECTION_TYPES);
    labels.recognition = transition ? "Recognize the transition" : "Recognize the attack";
    labels.setup = transition ? "Set up the transition" : "Set up the attack";
    if (/^\/Systems\//.test(path)) labels.prerequisites = "Is this for you?";
    // U113 b (owner, 2026-11-09): since U111 a submission's guide holds only its injury risks, so its tile and index row say so.
    if (submission) labels.safety = "Injury risks";
    labels.options = /^\/Systems\//.test(path) ? "Coverage and limits" : position ? "Decisions from " + (bottom ? "bottom" : "top") : defender ? "Defensive options" : transition ? "Execution and counters" : submission ? "Attacking options" : /^\/Learning\//.test(path) ? "In practice" : "Applications";
    let ordinal = 0;
    for (const part of parts) {
      const n = part.node, heading = n.nodeType === 1 && n.querySelector("h2,h3,summary"), id = n.dataset?.sourceId || "";
      // A position's relations are two paragraphs, not sections: their class names them (owner: "sections of their own").
      let type = SECTION_IDS[id] || SECTION_IDS[n.className], title;
      // Template IDs are preferred. Irregular Markdown retains each complete h2
      // range; unknown sections never fall into a content-dropping allow-list.
      if (!type && heading) {
        const text = heading.textContent.trim().toLowerCase();
        if (/^(sources|references)$/.test(text)) type = "sources";
        else if (/^related|^explore techniques|^from which positions/.test(text)) type = "related";
        else if (/^film study|^official preview/.test(text)) type = "videos";
        else if (/^top vs bottom|^attacker vs defender/.test(text)) type = "role-comparison";
        else if (/^what (is|are)\b/.test(text)) type = "overview";
      }
      if (!type && n.nodeType === 1 && n.matches("[data-course-container]")) type = n.dataset.coursePlacement === "top" ? "overview" : "course";
      if (!type) type = heading ? "additional" : "overview";
      if (type === "prerequisites" && !position && /^\/(Submissions|Transitions)\//.test(path)) type = "setup";
      // The template leaves a wikilink inside raw HTML, which Quartz never resolves: 36 published pages print the
      // brackets. The name is what the tile needs until a content pass emits a real link.
      if (type === "confused") n.innerHTML = n.innerHTML.replace(/\[\[.*?\|(.*?)]]/, "$1");
      const key = type === "additional" ? type + "-" + ordinal++ : type;
      title = type === "additional" ? heading.textContent.trim() : labels[type];
      if (!buckets.has(key)) buckets.set(key, { type, title, parts: [] });
      buckets.get(key).parts.push(part);
    }
    if (this.referenceClips.length && !buckets.has("videos")) buckets.set("videos", { type: "videos", title: "Video", parts: [] });
    // U101 b, U102 a (owner, 2026-11-06, replacing the split into tiles): "there should only be one overview, and it shouldn't be
    // called 'overview.'" A position's section opens with its first sentences and "Read more" opens the rest in place, one way, so
    // the label goes with the opening. Every word stays in the DOM. The class, because Learning, Systems and Submission family
    // pages publish their own <details>, and a rule that hid their summaries would hide a question once it opened.
    // U103 a (owner, 2026-11-06): a bare hub too, on both of its text sections, the shared one and its seat's. Named by source id,
    // because a hub's role links come first in the bucket and hold a <p> of their own.
    for (const { node: wall } of position && buckets.get("overview")?.parts || []) if (wall.dataset?.sourceId == "overview") {
      const paragraphs = [...wall.querySelectorAll(":scope>p")];
      if (paragraphs[0]) {
        // The first sentence end at 240 characters or past it. No lookbehind: Safari below 16.4 cannot parse one, and a literal fails
        // the whole module, on every article. tests/neural_bundle_regex.test.mjs pins that.
        const html = paragraphs[0].innerHTML, lead = /^[^]{239,}?[.!?](?=\s+[A-Z])/.exec(html)?.[0] || html, more = element("details", { class: "ng-rm" });
        paragraphs[0].innerHTML = lead;
        more.append(element("summary", {}, "Read more"));
        if (lead != html) { const rest = element("p"); rest.innerHTML = html.slice(lead.length); more.append(rest); }
        more.append(...paragraphs.slice(1));
        if (more.children[1]) wall.append(more);
      }
    }
    // U111, U112 a (owner, 2026-11-09): a submission's guide is cut in its template, so the reader shows the page's own Safety section
    // whole: the injury risks and the closing "Go slow." line (templates/Submissions/TEMPLATE-DUAL.md.jinja2). No reader code, 0 B.
    const order = position ? POSITION_ORDER : SECTION_ORDER;
    const ordered = [...buckets.values()].sort((a, b) => {
      // S1 a (owner, 2026-11-06): on a submission the full guide is the last teaching section, before Related,
      // and one line above the steps carries the rule. Transitions share the section id and keep their place.
      const rank = x => submission && x.type === "safety" ? 99 : order.includes(x.type) ? order.indexOf(x.type) : x.type === "related" ? 100 : x.type === "sources" && reference ? 101 : 50;
      return rank(a) - rank(b);
    }).flatMap(group => (transition || submission) && group.type == "training"
      // U100 a (owner, 2026-11-06): each bold-led phase of Training is its own tile. Not a word changes, and no heading is invented:
      // "Training 2" is the "1, 2, or 3 overviews" he rejected, and a phase opens with its own bold name. It is still one section: one
      // index row, one ✕ on the first tile, one saved setting by type, one closed label. Measured on every seat, end gap at 1440x900:
      // on a Transition, where Training is last, the median falls from 752px to 124px, better on 2,003 of 2,022. On a Submission it
      // rises, 916px to 1,592px, worse on 572 of 576: S1 a puts Safety last, and it lands beside one tall Training tile, but the phases
      // level the columns and leave it alone. A position stays whole, measured worse in round 2. A Submission keeps it (U111).
      // UNGUARDED: every paragraph after the first phase moves, and only paragraphs. A phase with no bold lead would be a tile with no
      // name, and a list inside a phase would stay in the first tile, out of order. Neither exists (2,598 seats swept at v1.251.1).
      ? [group, ...[...group.parts[0].node.querySelectorAll(":scope>p:not([class])~p")].map(node => ({ ...group, more: 1, parts: [{ ...group.parts[0], node }] }))]
      : group);
    this.sections = []; this.mediaSlot = null;
    this.tileSizer.disconnect();
    body.replaceChildren();
    ordered.forEach((group, index) => {
      // U65 note (owner, 2026-10-29): game pages already show the film in the stage. Retire their
      // duplicate credits tile; retain only its closed-section control and index preference. Reference
      // pages keep the full Videos tile because it is their player's home.
      const control = group.type === "videos" && !REFERENCE.test(path);
      const id = "reader-section-" + this.renderSerial + "-" + index;
      const card = element("section", { class: "ng-section-card", "data-section-type": group.type, id });
      card.toggleAttribute("data-media-control", control);
      const heading = element("h2", { id: id + "-title" });
      const toggle = button("", () => {
        const opening = !sectionShown(this.app, group.type);
        this.toggleSection(group.type);
        if (!opening) this.notice(group.type);
        // A close too, in this task: the columns are layoutNow's, and until it runs the tiles after this one keep the old sides.
        this.layoutNow();
        if (opening) this.scrollTo(card, toggle);
      }, { "data-section-toggle": group.type, "aria-controls": id + "-body" });
      toggle.append(...faces(group.type, group.title)); heading.append(element("span", { class: "ng-section-title" }, group.title), toggle);
      const content = element("div", { class: "ng-section-body", id: id + "-body" });
      if (group.type === "videos") { this.mediaSlot = element("div", { "data-reader-media-slot": "" }); content.append(this.mediaSlot); }
      for (const part of control ? [] : group.parts) {
        const fragment = element("article", { "data-reader-article": part.source.dataset.readerArticle, "data-source-path": part.source.dataset.sourcePath });
        if (!ROLES.test(path) && group.parts.some(p => p.source.dataset.readerArticle !== part.source.dataset.readerArticle)) {
          // v1.251.4: once for a run of parts from one page, not once a part: a hub's How it works said "For both sides" twice in a row.
          const said = part.source.dataset.readerArticle === "hub" ? "For both sides" : pathRole(part.source.dataset.sourcePath);
          if (said != group.said) fragment.append(element("p", { class: "ng-section-provenance" }, group.said = said));
        }
        // Keep authored headings, anchors and complete safety text in the source
        // fragment. The new heading supplies the visible semantic group title.
        const sourceHeading = part.node.nodeType === 1 && part.node.querySelector("h2");
        if (sourceHeading && group.parts.length === 1) sourceHeading.classList.add("ng-section-source-title");
        fragment.append(part.node); content.append(fragment);
      }
      if (!group.more) { card.setAttribute("aria-labelledby", heading.id); card.append(heading); }
      card.append(content); body.append(card);
      this.sections.push({ ...group, id, card, body: content, toggle, control });
      this.tileSizer.observe(card);
    });
  }
  // D-338 (owner): Video, Moves, Questions, then the article in its own order.
  readingOrder(game) {
    const video = this.sections.filter(s => s.type === "videos");
    return [...(game ? this.gameSections : []), ...video, ...this.sections.filter(s => s.type !== "videos")];
  }
  partEl(part) { return part === "card" ? this.app._landEl : part === "hand" ? this.app.optionsRef.current : null; }
  toggleSection(type, shown = !sectionShown(this.app, type)) {
    // D-354 N2: reopening Videos is the player's own input, so it settles a pinned landing as a grade
    // does; while pinned, the home the close hid stayed hidden (D-352's sticky rule) until the parts settled.
    if (shown && type === "videos") this.app._readerGraded();
    this.readingInteraction();
    this.app.set("readerSection." + type, shown);
    this.sync();
  }
  syncSections() {
    let focus;
    for (const s of [...this.gameSections, ...this.sections]) {
      const body = s.part ? this.partEl(s.part) : s.body;
      const shown = s.part ? this.on(s.part) : sectionShown(this.app, s.type), focused = !shown && (body?.contains(document.activeElement) || !s.part && s.card.dataset.collapsed !== "true" && s.card.contains(document.activeElement));
      if (s.type === "videos" && !shown && !body.hidden) this.app.pauseLandFilm();
      // A game part's label, row and aria, and the Video row, read paintPart's one answer (an open part shows itself and its own ✕;
      // only a closed one, or one taken away with its landing, leaves its label). A tile's own look keeps its preference.
      if (s.part || s.type === "videos") this.paintPart(s);
      if (!s.part) {
        s.card.dataset.collapsed = String(!shown);
        // U131 b2: a closed tile stays where it is, hidden, unless its message stands in it; nothing moves, so no player reloads (D-501)
        // and both of the old paths (moveBefore, and its absence in Safari and Firefox) are one. A phase goes with Training's first tile.
        const held = this.noticeMap.get(s.type)?.home === s.card;
        s.card.toggleAttribute("data-notice", held);
        body.hidden = !shown; body.inert = !shown; s.card.hidden = !shown && !held;
        if (s.type !== "videos") s.row?.setAttribute("data-collapsed", String(!shown));
        if (s.toggle.getAttribute("aria-expanded") !== String(shown)) {
          s.toggle.setAttribute("aria-expanded", String(shown)); s.toggle.setAttribute("aria-label", (shown ? "Hide " : "Show ") + s.title);
        }
      }
      // U11: where the index shows, a closed section has no control in the content, so focus goes to its index row.
      // Variant b: nothing is left where it was, so focus goes to its index row, else the message's Undo, else the reader.
      if (focused) focus = this.root.hasAttribute("data-indexed") && s.row?.querySelector("a") || this.root;
    }
    focus?.focus({ preventScroll: true });
  }

  link(event) {
    const link = event.target.closest("a[href]");
    // Quartz's global handler ignores defaultPrevented. Stop propagation even for
    // modified clicks, while leaving the browser's new-tab behavior untouched.
    event.stopPropagation();
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === "_blank" || link.hasAttribute("download")) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (link.dataset.readerAnchor) {
      event.preventDefault(); this.readingInteraction();
      this.anchor(url.hash, link.closest("article") || this.root); return;
    }
    if (link.dataset.sectionLink) {
      event.preventDefault(); this.readingInteraction();
      const section = [...this.gameSections, ...this.sections].find(s => s.id === link.dataset.sectionLink);
      // U11 (owner): where the index shows, a closed section leaves no placeholder in the content, so its
      // index row reopens it before going there. #354's review (finding 1): so does a card or film the background tap took away.
      if (section && (section.part === "card" || section.type === "videos") && this.app.restoreLanding?.()) {
        // Round 7's review (finding 3): the restore is the player's own input, as the label's is, so reading stops holding the
        // question's clock (left interacting, the clock never armed). And the pressed part opens too, if its own preference had it
        // closed, so one press is enough (nit 5).
        this.interacting = false;
        if (section.part && !this.on(section.part)) this.app.setLayer(section.part, true, "reader");
        else if (section.type === "videos" && !sectionShown(this.app, "videos")) this.toggleSection("videos", true);
        this.layoutNow();
      }
      else if (section && this.root.hasAttribute("data-indexed") && !(section.part ? this.on(section.part) : sectionShown(this.app, section.type))) {
        if (section.part) this.toggle(section.part); else this.toggleSection(section.type, true);
        this.layoutNow();
      }
      // An open game part is its own landmark; a closed one is its label. A section's
      // top edge leads, and focus goes to its one control.
      if (section?.part) this.scrollTo(this.on(section.part) && this.partEl(section.part) || section.toggle);
      else if (section) this.scrollTo(section.card, section.toggle);
      return;
    }
    if (CONTENT.test(url.pathname) || !/\.[a-z0-9]+$/i.test(url.pathname)) {
      // Both reader stages normalize URLs; keep the parsed query/hash without rebuilding them.
      event.preventDefault(); this.app._readArticle(url, true, true, "article_link");
    }
  }
  anchor(hash, scope = this.root) {
    const id = decodeURIComponent(hash.replace(/^#/, ""));
    const fragments = scope.dataset?.sourcePath ? [...this.root.querySelectorAll("article[data-source-path]")].filter(a => a.dataset.sourcePath === scope.dataset.sourcePath) : [scope];
    // The link's own source page answers first: ids repeat across pages. S1 a: a seat's guide lives in its hub's fragment.
    const node = [...fragments, this.root].map(f => f.querySelector('[data-source-id="' + CSS.escape(id) + '"]')).find(Boolean);
    if (!node) return;
    node.tabIndex = -1;
    const section = node.closest(".ng-section-card");
    // D-482: a closed target is hidden (U131 b2; inside U25 a's disclosure before). Reveal it before measuring/focusing, just as an
    // index link reveals its section.
    if (section?.dataset.collapsed === "true") {
      this.toggleSection(section.dataset.sectionType, true); this.layoutNow();
    }
    this.scrollTo(node.classList.contains("ng-section-source-title") ? section.querySelector("[data-section-toggle]") : node);
    this.app._writeUrl(this.path + hash, { ngReading: !!this.intent }, true);
  }
  scrollTo(node, focus = node) {
    // U65 leaves no painted game Videos card. Both its disclosure and index navigate to
    // the surviving film, whose close control can retain focus after the old label disappears.
    if ("mediaControl" in node.dataset) {
      node = this.mediaHome;
      focus = node.querySelector("[data-film-close]");
    }
    this.root.scrollTop += rect(node).top - rect(this.root).top - 6;
    if (focus) focus.focus({ preventScroll: true });
  }
  readingInteraction(type, event) {
    // U47 d / APTS-R4: a scroll does not decline a question still asking. Chromium sends a touch or pen press's
    // pointerdown BEFORE touchstart, so that press counts as a scroll too; a link still declines on its click
    // (sections and anchors below come back here with no type, articles through _readArticle).
    const scroll = type === "wheel" || type === "touchstart" || type === "pointerdown" && event.pointerType !== "mouse";
    // Reading stops the game every time it is running: since D-338 a Videos clip is reading too, so
    // a pane that paused first can resume the game on close while the reader is still reading.
    if (this.interacting && this.app.paused) { if (!scroll && !this.intent) this.app._declineLandQ("reading"); return; }
    this.interacting = true;
    if (!this.intent) this.app._declineLandQ("reading", scroll);
    this.app.setPaused(true);
    // Do not move text during a drag selection. The clock is already declined;
    // expanding after pointerup keeps the browser's native selection intact.
    if (type === "pointerdown") {
      this.selecting = true;
      this.selectionEnd = () => { this.selecting = false; if (!this.app.__ngDestroyed) this.sync(); };
      listen(document, "pointerup", this.selectionEnd, { once: true });
    }
    this.sync();
  }
  leaveReading() {
    document.removeEventListener("pointerup", this.selectionEnd);
    this.selecting = false;
    this.app._readerIntent = false;
    this.intent = false; this.interacting = false;
    this.sync();
  }
  beginPlay() {
    if (!this.intent && !this.interacting) return;
    const a = this.app;
    this.leaveReading();
    // A finish can clear the hand before the next tick. Record the deliberate
    // start here so that a one-action roll is still eligible for its history.
    a._played = true;
    a._applyLayers();
    a._engage();
    a.setPaused(false);
  }
  on(part) {
    if (part === "film") return sectionShown(this.app, "videos");
    return !GAME_KEYS[part] || this.app.get(GAME_KEYS[part], true) !== false;
  }
  // The only callers are a closed part's label and its index row, so this only ever OPENS: it never turns a part off, even when the
  // look it was pressed in is a frame stale (#354's review, round 7 finding 1, where a stale "closed" label saved landCard off). A part
  // the background tap took away comes back with its landing; a part off by its preference opens. One press does both (nit 5).
  toggle(part) {
    const a = this.app;
    if (part === "film") { this.toggleSection("videos", true); return; }
    const back = a.restoreLanding?.();
    if (!this.on(part)) a.setLayer(part, true, "reader");
    else if (!back) { this.sync(); return; }
    this.interacting = false;
    this.sync();
    // The label just pressed is hidden once its part reopens: focus that part's own ✕.
    const reopened = part === "card" ? a._landEl?.querySelector("[data-land-close]") : a._handCloseEl;
    (reopened || this.gameSections.find(s => s.part === part)?.toggle)?.focus({ preventScroll: true });
  }
  // HIDESEC2: where a part's message stands. A game part's is its label slot; a game page's video is the film's home in the stage (it
  // takes the film's width and column there, layoutNow); a section's, and a reference page's Video, is the section's own tile.
  noticeHome(key) {
    const part = this.gameSections.find(s => s.part === key);
    if (part) return part.card;
    if (key === "videos" && !this.ownsMedia()) return this.mediaHome;
    return this.sections.find(s => s.type === key)?.card;
  }
  notice(key) {
    const a = this.app, home = this.noticeHome(key), part = this.gameSections.find(s => s.part === key);
    const title = part ? part.title : key === "videos" ? "Video" : this.sections.find(s => s.type === key)?.title;
    this.dropNotice(key);
    if (!home || !title) return;
    // A screen reader hears the plain sentence once, from one live region that is always in the tree; the painted copy is not live.
    const said = title + " hidden. You can show it again in Settings.";
    if (!this.live) { this.live = element("div", { role: "status", class: "ng-sr-only" }); a.wrapRef.current.append(this.live); }
    this.live.textContent = "";
    requestAnimationFrame(() => { if (this.live) this.live.textContent = said; });
    const box = element("div", { class: "ng-hidesec-notice", "data-hidesec-notice": key, "data-phase": "on" });
    const line = element("span", { class: "ng-hidesec-line" });
    line.append(element("b", {}, title), " hidden. You can show it again in ",
      button("Settings", () => { a._settingsAim = key; a.openSettings("rolling"); }, { "data-hidesec-settings": key, "aria-label": "Open Settings at " + title }), ".");
    const undo = button("Undo", () => this.undoNotice(key), { "data-hidesec-undo": key, "aria-label": "Undo: show " + title + " again" });
    box.append(line, undo);
    const n = { key, home, box, hold: {} };
    this.noticeMap.set(key, n);
    const up = () => this.holdNotice(n, "down", false);
    listen(box, "pointerenter", e => { if (e.pointerType === "mouse") this.holdNotice(n, "over", true); });
    listen(box, "pointerleave", e => { if (e.pointerType === "mouse") this.holdNotice(n, "over", false); });
    listen(box, "pointerdown", () => {
      this.holdNotice(n, "down", true);
      for (const type of ["pointerup", "pointercancel"]) listen(document, type, up, { once: true });
    });
    // Focus holds it only when a key put it there: a tap's click focuses the button it lands on (measured: a tap on the leaving place
    // focused Undo) and a finger never takes focus back, so that hold never lifted.
    listen(box, "focusin", () => { if (byKey) this.holdNotice(n, "focus", true); });
    listen(box, "focusout", e => { if (!box.contains(e.relatedTarget)) this.holdNotice(n, "focus", false); });
    home.append(box);
    this.sync(); this.layoutNow();
    if (byKey) undo.focus({ preventScroll: true });
    this.armNotice(n, NOTICE_MS);
  }
  armNotice(n, ms) { clearTimeout(n.timer); n.timer = setTimeout(() => this.leaveNotice(n), ms); }
  noticeHeld(n) { return Object.values(n.hold).some(Boolean); }
  holdNotice(n, why, on) {
    n.hold[why] = on;
    if (this.noticeMap.get(n.key) !== n) return;
    if (this.noticeHeld(n)) {
      clearTimeout(n.timer);
      // A press on (or a mouse over) a leaving message's place is aimed at it: it comes back.
      if (n.box.dataset.phase !== "on") { n.box.dataset.phase = "on"; for (const c of n.box.children) c.inert = false; }
    } else this.armNotice(n, AGAIN_MS);
  }
  leaveNotice(n) {
    if (this.noticeHeld(n) || this.noticeMap.get(n.key) !== n) return;
    // Its controls stop taking presses at once; its place keeps its height and takes them (holdNotice) until the places close.
    n.box.dataset.phase = "leaving";
    for (const c of n.box.children) c.inert = true;
    const fade = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : FADE_MS;
    clearTimeout(n.timer); n.timer = setTimeout(() => this.closeNotices(), fade + QUIET_MS);
  }
  // The last message to go quiet closes every place at once, and a press starting inside one in the next SHIELD_MS is swallowed.
  closeNotices() {
    const all = [...this.noticeMap.values()];
    if (all.some(n => n.box.dataset.phase !== "leaving" || this.noticeHeld(n))) return;
    const until = performance.now() + SHIELD_MS;
    this.shields = all.map(n => ({ r: rect(n.box), until }));
    for (const n of all) { clearTimeout(n.timer); n.box.remove(); }
    this.noticeMap.clear();
    this.sync(); this.layoutNow();
  }
  dropNotice(key) {
    const n = this.noticeMap.get(key);
    if (!n) return;
    clearTimeout(n.timer); n.box.remove(); this.noticeMap.delete(key);
  }
  dropNotices() {
    if (!this.noticeMap.size && !this.shields.length) return;
    for (const key of [...this.noticeMap.keys()]) this.dropNotice(key);
    this.shields = [];
    this.sync(); this.layoutNow();
  }
  undoNotice(key) {
    this.dropNotice(key);
    if (this.gameSections.some(s => s.part === key)) { this.toggle(key); this.layoutNow(); return; }
    this.toggleSection(key, true); this.layoutNow();
    // The part comes back where its message stood, in view, so nothing scrolls; focus goes to its own close, as a reopen from that
    // close's twin did (U65: a game page's video focuses the film's ✕).
    const s = this.sections.find(s => s.type === key);
    (s?.control ? this.app._landFilmEl?.querySelector("[data-film-close]") : s?.toggle)?.focus({ preventScroll: true });
  }
  // Window capture, ahead of every handler: a press that starts in a just-closed place is swallowed whole (down, up, the touch's own
  // events and the click), so it cannot land on what moved there. A new press elsewhere starts clean.
  shield(event) {
    if (event.type === "pointerdown") {
      const now = performance.now(), x = event.clientX, y = event.clientY;
      this.shields = (this.shields || []).filter(s => now < s.until);
      this.swallowing = this.shields.some(({ r }) => x >= r.left && x < r.right && y >= r.top && y < r.bottom);
    }
    if (!this.swallowing) return;
    event.stopImmediatePropagation();
    if (event.cancelable) event.preventDefault();
    if (event.type === "click") this.swallowing = false;
  }
  // ONE answer for a game part's look and the Video row's (#354's review, round 7 findings 1 and 6): closed by its preference, or taken
  // away with this landing by a background tap. The label, the index row, aria-expanded and the Hide/Show text all read it, and every
  // layout pass paints it, so none can go stale when the landing's state moves without a sync (roam, a commit). The Video tile itself
  // keeps its own preference; only its row reads the landing.
  partClosed(s) {
    const pref = s.part ? this.on(s.part) : sectionShown(this.app, s.type);
    return !pref || (s.part === "card" || s.type === "videos") && !!this.app._landAway?.();
  }
  paintPart(s) {
    const closed = this.partClosed(s);
    s.row?.setAttribute("data-collapsed", String(closed));
    if (!s.part) return;
    s.card.dataset.collapsed = String(closed);
    const held = this.noticeMap.has(s.part);
    s.card.toggleAttribute("data-notice", held);
    s.card.hidden = !(held || closed && this.on(s.part)) || REFERENCE.test(this.path);
    if (s.toggle.getAttribute("aria-expanded") !== String(!closed)) {
      s.toggle.setAttribute("aria-expanded", String(!closed)); s.toggle.setAttribute("aria-label", (closed ? "Show " : "Hide ") + s.title);
    }
  }
  sync() {
    const a = this.app, wrap = a.wrapRef.current;
    // HIDESEC2: a message goes at once, with no gap left, when its part comes back by any road (Undo, Settings, the index row, another
    // device) or its place goes (a new article replaces the tiles). The part itself takes the place, so nothing moves under a press.
    for (const n of [...this.noticeMap.values()]) {
      if (!n.home.isConnected || (this.gameSections.some(s => s.part === n.key) ? this.on(n.key) : sectionShown(a, n.key))) this.dropNotice(n.key);
    }
    const expanded = !!(this.interacting && !this.selecting);
    this.root.toggleAttribute("data-reading-expanded", expanded);
    wrap.classList.toggle("ng-reader-dormant", !!this.intent);
    this.syncMedia();
    this.syncSections();
    this.publishCard(a._landEl);
  }
  // D-338: the film's one home is its Videos section, first in the flow, under the section's one preference.
  // v1.253.0: the article can no longer be put away, so that is always so; the app still asks.
  wantsMedia() { return true; }
  ownsMedia(host = this.app._landFilmEl) { return !!host && host.parentElement === this.mediaSlot; }
  placesMedia(host = this.app._landFilmEl) { return !!host && (host.parentElement === this.mediaSlot || host.parentElement === this.mediaHome); }
  // A suspended player needs an explicit way to resume. Keep this presentation deferred; pauseLandFilm
  // remains the owner's API. v1.230.0 (feat/video-cards): the player opens on its own controls and never
  // autoplays, so the fresh player a fallback move rebinds starts only on this Resume (expandClip's flag).
  resumeFilm(card) {
    if (card.querySelector("[data-film-resume]")) return;
    const a = this.app;
    const play = button("Play", () => {
      if (card._mediaStale) { const clip = card._mediaClip; a.collapseClip(card); a.expandClip(card, clip, true); }
      else { card._mediaPaused = false; try { card._player?.playVideo(); } catch (error) {} play.remove(); }
    }, { class: "ng-film-resume", "data-film-resume": "", "aria-label": "Resume video" });
    card.append(play);
  }
  // The ONLY placement writer. Both parents remain connected. Native moveBefore
  // keeps an active iframe alive; the LibreWolf-compatible fallback pauses first.
  place(target) {
    const host = this.media;
    if (!host || !target?.isConnected || !host.isConnected || host.parentElement === target) return;
    if (typeof target.moveBefore === "function") target.moveBefore(host, target === this.mediaOrigin && this.mediaNext?.parentElement === target ? this.mediaNext : null);
    else { this.app.pauseLandFilm(); target.appendChild(host); this.app._landFilmMoved(); }
    host.toggleAttribute("data-reader-media", target === this.mediaSlot);
    host.toggleAttribute("data-reader-game-media", target === this.mediaHome);
    this.app._dockLandFilm();
  }
  syncMedia() {
    const a = this.app, hit = this.path && a._nodeAndRoleForPath(this.path);
    // hit.role is the origin's top/bottom game seat. A technique's media role
    // is its authored attacker/defender perspective, a different coordinate.
    const node = hit && a.nodes[hit.idx];
    const mediaRole = node?.ty === "positions" ? hit.role || a.playerRole : /\/Defender$/.test(this.path || "") || node?.role === "defender" ? "defender" : "attacker";
    const wants = this.wantsMedia() && !!this.mediaSlot;
    const referencePath = hit?.idx < 0 ? this.path : undefined;
    if (wants && referencePath && this.referenceClips?.length && a._landFilmEl?.dataset.referenceFilm !== referencePath) a._renderLandFilm(this.referenceClips, referencePath);
    // Clip supply belongs to the existing owner. A late/mismatched role never
    // becomes an alternative resolver in the reader (escape owns that feed).
    if (wants && !a._landFilmEl && hit?.idx >= 0 && a._landIdx === hit.idx) {
      const n = a.nodes[hit.idx], role = a._landPerspSide(n) || a.playerRole;
      if (mediaRole === role) {
        const clips = a._landFilmClips(n);
        if (clips?.length) a._renderLandFilm(clips);
      }
    }
    const host = a._landFilmEl;
    if (host && host !== this.media) {
      this.place(this.mediaHome);
      this.media = host; this.mediaOrigin = host.parentElement; this.mediaNext = host.nextSibling;
    }
    const correct = host && hit && (referencePath ? host.dataset.referenceFilm === referencePath : host._ngMediaIdx === hit.idx && host._ngMediaRole === mediaRole);
    if (referencePath && !wants) a.pauseLandFilm();
    // D-368 (layout C, the video cards' approved A geometry): a game node's current card keeps the game's
    // media home, beside the question on a desktop and above it on a phone, under the Videos section's own
    // toggle. A reference page's film is reading and keeps its Videos slot.
    if (wants && correct && !a._readerPin && referencePath) this.place(this.mediaSlot);
    else this.place(this.mediaHome);
    // Without a Videos section the film keeps the game home, still under that one preference.
    if (host) host.hidden = wants ? !correct || !referencePath && !sectionShown(a, "videos") : this.wantsMedia() ? !sectionShown(a, "videos") : !a.get("landFilm", true);
    if (this.ownsMedia()) {
      host.hidden = false;
      if (!sectionShown(a, "videos")) a.pauseLandFilm();
    }
  }
  restoreGame() {
    for (const [el, home] of this.gameHomes) {
      this.resize.unobserve(el);
      if (el.isConnected && home.parent?.isConnected) {
        home.parent.insertBefore(el, home.next?.parentElement === home.parent ? home.next : null);
        for (const [key, value, priority] of home.styles) { if (value) el.style.setProperty(key, value, priority); else el.style.removeProperty(key); }
        el.removeAttribute("data-reader-game-part");
      }
    }
    this.gameHomes.clear(); this.game.style.height = "0px";
  }
  gameKey(event) {
    // Game keys still read the whole question; End must not jump past it to the
    // article's final source. Article focus retains the browser's native keys.
    const a = this.app, card = a._landEl, target = event.target;
    if (!card || this.interacting || a.deckShown || a._landHidden() || event.metaKey || event.ctrlKey || event.altKey ||
        target !== document.body && !this.game.contains(target) || target?.closest("input,textarea,select,[contenteditable]") ||
        !/^(Home|End|PageUp|PageDown)$/.test(event.key)) return false;
    // The question's own span: since D-338 Videos and Moves sit above it, so Home is its top edge.
    // Home and PageUp never move the view down (D5-S2: at arrival the reader sits above the card).
    const top = this.root.scrollTop, start = Math.max(0, card.offsetTop - 6), end = Math.max(start, card.offsetTop + card.offsetHeight + 12 - this.root.clientHeight);
    const to = event.key === "Home" ? start : event.key === "End" ? end : Math.max(start, Math.min(end, top + this.root.clientHeight * .85 * (event.key === "PageUp" ? -1 : 1)));
    this.root.scrollTop = /Home|Up/.test(event.key) ? Math.min(top, to) : to;
    event.preventDefault();
    return true;
  }
  // U9 b (owner): the old site's table of contents. Each row's opacity follows how much of its part is in
  // view (0.35 to 0.85), and the index scrolls to keep the most visible row in its middle when that changes.
  syncIndex() {
    const c = this.contents;
    if (!c || c.hidden) return;
    const view = rect(this.root), span = view.height || 1;
    let best = null, most = 0;
    for (const s of [...this.gameSections, ...this.sections]) {
      if (!s.row) continue;
      const parts = s.part ? [this.partEl(s.part), s.card] : [...this.sections.filter(x => x.title == s.title).map(x => x.card), s.type === "videos" && this.media?.parentElement === this.mediaHome ? this.mediaHome : null];
      let seen = 0;
      for (const el of parts) {
        const r = el?.isConnected && !el.hidden && rect(el);
        if (r?.height) seen = Math.max(seen, Math.max(0, Math.min(r.bottom, view.bottom) - Math.max(r.top, view.top)) / Math.min(r.height, span));
      }
      s.row.style.opacity = (.35 + .5 * seen).toFixed(2);
      if (seen > most) { most = seen; best = s.row; }
    }
    if (best && best !== this.indexBest) { this.indexBest = best; c.scrollTop = best.offsetTop - c.clientHeight / 2 + best.clientHeight / 2; }
  }
  layout() {
    if (this.layoutFrame || this.app.__ngDestroyed) return;
    this.layoutFrame = requestAnimationFrame(() => { this.layoutFrame = 0; this.layoutNow(); });
  }
  frameExecution(target, node) {
    // D-322: a scrolled-to-top choice must keep its clicked rectangle. Fit the
    // whole pair/name around occupied surfaces, not above an impossible band.
    // This target still flies through the app's integrator; arrival, manual
    // input and leases never call this execution-only seam.
    const a = this.app, W = a.W, H = a.H, scale = W / target.vw;
    // Both fallbacks COUNT (traps §6.6): journeys assert noFit is 0 where a slot must exist.
    const said = a._execFrame || (a._execFrame = { noFrame: 0, noFit: 0 });
    // updateCamera runs before draw: until the first frame publishes _LY there is no
    // painted pair to clear (the pumped clock reached this and threw from the loop).
    if (!a._LY) { said.noFrame++; return target; }
    const k = Math.max(.4, Math.min(1, target.vw / (a.graphW * .5)));
    const point = q => ({ x: W / 2 + (q.x - target.cx) * scale, y: H / 2 + (a._LY(q) - target.cy) * scale });
    const pair = [node, node.pi >= 0 ? a.nodes[node.pi] : null].filter(Boolean);
    const orbs = pair.map(q => { const p = point(q), r = a._nodeHalfW(q, scale, k, a._lodK ?? 1); return { left: p.x - r, right: p.x + r, top: p.y - r, bottom: p.y + r }; });
    const p = point(node), midY = H / 2 + (a.pairMid(node).y - target.cy) * scale;
    // The shared full-size name width also bounds the smaller travelling name.
    // Reserve the role and qualifier rows at either naming anchor (seat/pair).
    const box = { left: Math.min(...orbs.map(r => r.left)), right: Math.max(...orbs.map(r => r.right)) + 11 + Math.max(80, a._labelWidthPx(node)),
      top: Math.min(...orbs.map(r => r.top), p.y - 36, midY - 36), bottom: Math.max(...orbs.map(r => r.bottom), p.y + 40, midY + 40) };
    const root = rect(this.root), occupied = [];
    const visible = el => {
      if (!el?.isConnected) return null;
      const cs = getComputedStyle(el), r = rect(el);
      if (!r.width || !r.height || cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return null;
      const clip = this.root.contains(el) ? root : { top: 0, bottom: H };
      return { left: r.left, right: r.right, top: Math.max(0, r.top, clip.top), bottom: Math.min(H, r.bottom, clip.bottom) };
    };
    for (const el of [a._execution.card, a.evRef.current, this.articleEl, this.body, this.contents, this.head, this.tools,
      ...this.gameSections.map(s => s.card), a._landEl, a._landFilmEl, a._handCloseEl,
      a.accountRef.current, a.shareCueRef.current, a._challengeRewardEl, ...a.wrapRef.current.querySelectorAll(".ng-logo,.ng-search,.ng-winbar")]) {
      const r = visible(el); if (r && r.bottom > r.top) occupied.push(r);
    }
    const card = visible(a._execution.card), toast = visible(a.evRef.current);
    // D-326: the above-card band exists only if it can hold the box with its 12px
    // clearances. A thinner one (11px on a scrolled phone) used to reject every
    // candidate and return the unfitted target; it is free 2-D space instead.
    const band = card && toast && card.top - toast.bottom >= box.bottom - box.top + 24;
    const left = a._paneLayout().left + 12, right = W - 12;
    // D-326: a phone's centred reduced-motion stand-in leaves 96px a side, which
    // fits the reserved box only at a 4px clearance. Painted pixels still never touch.
    const search = (within, reserved) => {
      const taken = reserved ? [...occupied, reserved] : occupied;
      for (const gap of [12, 4]) {
        const xs = [0, left - box.left, right - box.right], ys = [0, 12 - box.top, H - 12 - box.bottom];
        for (const r of taken) { xs.push(r.left - gap - box.right, r.right + gap - box.left); ys.push(r.top - gap - box.bottom, r.bottom + gap - box.top); }
        if (band) ys.push(toast.bottom + 1 - p.y, card.top - 1 - p.y);
        if (within) ys.push(within.top - box.top, within.bottom - box.bottom);
        let best, distance = Infinity;
        for (const x of new Set(xs)) for (const y of new Set(ys)) {
          const cost = x * x + y * y;
          if (cost >= distance || box.left + x < left || box.right + x > right || box.top + y < 12 || box.bottom + y > H - 12 ||
            band && (p.y + y <= toast.bottom || p.y + y >= card.top) || within && (box.top + y < within.top || box.bottom + y > within.bottom)) continue;
          if (taken.some(r => box.left + x < r.right + gap && box.right + x > r.left - gap && box.top + y < r.bottom + gap && box.bottom + y > r.top - gap)) continue;
          best = { ...target, cx: target.cx - x / scale, cy: target.cy - y / scale }; distance = cost;
        }
        if (best) return best;
      }
      return null;
    };
    // D-329: the landing's rows mount below the reader's node band, so a pair framed inside it is
    // never covered when the move lands. Prefer the band wherever the box fits beside the card;
    // otherwise search free space with the landing rows' column below the band occupied.
    // D-370 (orchestrator, D9-N3 (i)): a phone pick with the reader scrolled about 170-290px has no slot in
    // the band (the Moves row and the stage have scrolled into it) and none beside the column (a phone's
    // column is the screen), and the unfitted target painted the pair over 3 occupied surfaces at 230-290px.
    // In that case only, D-329's reservation yields: free space the landing rows will take later is free
    // now. With no free spot anywhere the pair falls back to the band (D9-N3 (iii), the floor), counted.
    // The painted pair never intersects an occupied rectangle (roll-execution's phone sweep, reader scroll
    // 0-290px at 390x844 and 390x631).
    const nodeBand = this.nodeBand || null, col = rect(this.articleEl);
    const free = nodeBand && (search(nodeBand) || col.width && search(null, { left: col.left, right: col.right, top: nodeBand.bottom, bottom: H })) || search(null);
    if (free) return free;
    // U52 b: D-370's free space was the landing card's slot, emptied for the execution. An asking question is a
    // quiet line, so on a phone with the reader scrolled 170-200px over the band the slot left under the executing
    // row (65px at 390x844) is shorter than the pair's box, and the pair fell back under the card just pressed
    // (roll-execution's phone sweep). Open the missing height under the row for this execution only: the
    // handoff's height grows, so the article moves down and the clicked row never does. Once per execution,
    // counted (traps §6.6); the reservation leaves with the execution's card.
    const handoff = a._executionDock()?.reader;
    if (handoff && card && !handoff.slot && nodeBand) {
      const need = Math.ceil(box.bottom - box.top + 24 - (col.top - card.bottom));
      if (need > 0 && need < H / 3) {
        handoff.slot = need; said.slot = (said.slot || 0) + 1;
        this.layoutNow();
        return this.frameExecution(target, node);
      }
    }
    said.noFit++;
    return nodeBand ? { ...target, cy: target.cy - Math.min(Math.max(0, nodeBand.top - box.top), nodeBand.bottom - box.bottom) / scale } : target;
  }
  publishCard(card) {
    // Complete new controls adopt before their first paint; observer updates to
    // already-published controls stay coalesced, and a press still defers both.
    if (card?.hasAttribute("data-reader-pending")) this.layoutNow(); else this.layout();
  }
  layoutNow() {
    if (!this.hooked || this.app.__ngDestroyed || this.app._readerPress || this.laying) return;
    this.laying = true;
    // DASH-R4: locals for repeated element reads pay for the review fixes because the bundle shortens
    // locals but keeps property names whole. These elements are set once, in the constructor.
    const root = this.root, art = this.articleEl, game = this.game, home = this.mediaHome, toc = this.contents, tools = this.tools;
    let keep, was;
    const style = (el, key, value, priority = "") => {
      // One numeric-to-px boundary keeps all geometry writes and their equality
      // guard identical, without repeating the unit conversion at every call.
      if (typeof value === "number") value += "px";
      const old = el.style.getPropertyValue(key);
      const same = old === value || old.endsWith("px") && value.endsWith("px") && Math.abs(parseFloat(old) - parseFloat(value)) < 1 / 64;
      if (!same || el.style.getPropertyPriority(key) !== priority) el.style.setProperty(key, value, priority);
    };
    try {
      const a = this.app, H = window.innerHeight, W = window.innerWidth, free = a._paneLayout();
      const width = Math.max(240, Math.min(680, free.width - 24));
      const head = this.head;
      const reference = REFERENCE.test(this.path);
      const ownTop = Math.max(68, (rect(a.wrapRef.current.querySelector(".ng-logo"))?.bottom || 0) + 12);
      // Without chrome (including a null return on reference pages), the entire
      // head belongs before the article, never over the map. Chrome positions
      // the SAME head in its header row; phone tools remain in the article.
      // headBottom replaces ownTop only. Keep the node band/gameTop and add
      // offset before the fit clamp: there is no map-band head reservation.
      // Optional bottomReserve already includes the 8px flow gap; do not subtract it a second time.
      let chrome = typeof a.readerChromeFrame === "function" ? a.readerChromeFrame(head) : null;
      if (head) {
        const flow = reference ? art : game;
        const parent = chrome ? root : flow, toolsParent = chrome && W <= 640 ? flow : head;
        let moved = false;
        if (head.parentElement !== parent) { if (!chrome) head.removeAttribute("style"); parent.prepend(head); moved = true; }
        if (tools.parentElement !== toolsParent) { tools.removeAttribute("style"); toolsParent.prepend(tools); moved = true; }
        // Re-measure once after changing homes, not on every observer callback.
        if (chrome && moved) chrome = a.readerChromeFrame(head);
        if (!chrome) {
          head.removeAttribute("data-chrome-head");
          if (this.chromeActive) head.removeAttribute("style");
        }
      }
      this.chromeActive = !!chrome;
      // D-433 adapts D-370 to U35: the live phone catch question must be reachable
      // before and after Answer for Points (U47 d) without scrolling. Account and native Moves retain their space.
      const phoneCatch = !reference && a._phoneCatch();
      a.wrapRef.current.toggleAttribute("data-phone-catch", phoneCatch);
      const top = chrome ? chrome.headBottom : ownTop;
      // U9 b (owner, 2026-10-21): the index sits on the LEFT, 24px inside the free area (the inset it had on the right).
      const lead = free.left + 24;
      const tocWidth = toc ? parseFloat(getComputedStyle(toc).width) : 200;
      // U97 b (owner, 2026-11-06): the index shows only from about 1,350px of free width. With it the grid is 472px narrower,
      // and a line stops reading well: 45 characters is the floor, measured at 1,346 on five real pages (32 at 1,152). Below
      // this the grid is 902px, so the seam is 24px, not the 222 it was at 1,152.
      const fits = H > 500 && free.width >= 1350;
      // Where the index fits, the Moves tray (which sits beside its rows, D-338) starts 12px past it
      // and stays centred on the column. Decided by the fit, not by readiness, so a loading article
      // never re-centres the hand.
      const indexEdge = fits ? lead + tocWidth + 12 : null;
      // Grow only the article's inner grid, leaving the native column, hand and index homes alone.
      // The left index still has its 12px clearance; phone gutters leave the glow visible.
      // Owner (2026-11-01, replacing U55 b's run to the right edge): the choices row "should always have the same
      // size as the grid", and "I kind of like it that it's centered". So on a desktop the grid and the row share one
      // box, centred on the free area: it starts at the index's 12px clearance and mirrors that margin on the right.
      // Only the phone keeps a full-width row.
      // U110 a (owner, 2026-11-09): "the landcard width isn't harmonized ... not long ass horizontal lines of text". Under 1,024px every
      // stacked container, the question, the film and the tiles, is capped at one width and centred, so they share both edges. 496px:
      // a tile's text is 468px, 70 characters of the body text at its measured 6.68px each (Plus Jakarta Sans, 16px), and at 600px the
      // deck's outside arrows have exactly their 52px. Each keeps its own phone width under the cap, so a phone is unchanged. The cap
      // also keeps the grid under 660px, so the article is one column and the stage stacks until 1,024px, where nothing changes.
      const cap = free.width < 1024 && 496;
      const grid = indexEdge ? free.width + 2 * (free.left - indexEdge) : Math.max(240, Math.min(cap || 902, free.width - 64));
      // U59 c: the share cue in the corner reserves
      // the bottom too: the reader ends above it and the cue never covers text or a link.
      // v1.253.0 (owner, 2026-11-09: "cuts off its content 10 to 20 px before the fold"): where the win bar falls under the grid
      // (no index: to 1,349px free, and a phone), the legend docks 8px off the bottom and the reader ends one 8px gap above the bar, so
      // it reserves the bar's own height. It stood 30px up and the gap was counted twice: 64 to 72px of article lost. Elsewhere it goes
      // back to the template's inline 30px: writing "" would delete that declaration, not restore it (§6.1), and send it to the top.
      const legend = a.wrapRef.current.querySelector(".ng-legend"), bar = rect(legend?.querySelector(".ng-winbar")), lane = { left: free.center - grid / 2, right: W };
      if (bar) { const under = bar.left < lane.right && bar.right > lane.left; legend.style.setProperty("bottom", under ? "8px" : "30px", under ? "important" : ""); }
      // With the shelf retired (U114 a) nothing else reserves the bottom: the article runs to the fold (owner, 2026-11-09).
      const end = H - (chrome?.bottomReserve ?? a._readerReserve(lane));
      for (const [key, value] of Object.entries({ left: 0, top, width: W, height: Math.max(80, end - top) })) style(root, key, value);
      // Contents never participates in the column's width or centre calculation.
      style(art, "width", Math.min(680, free.width - 24));
      style(art, "margin-left", Math.max(12, free.center - parseFloat(art.style.width) / 2));
      // U59 c: when the grid's width changes (the pane opening, a resize), the first text block starting
      // within the reader keeps its place on screen; the finally puts it back after every other write.
      // DASH-R4: only once the article itself has scrolled above the reader's top. At the arrival the
      // stage (node band, Moves, question) owns the top and holds still, as on dev, when the pane opens,
      // the window narrows or a phone turns.
      // v1.249.2: one line, at one height, for a whole pane slide, until the reader's place moves (placeTop survives the
      // browser's clamp and any real scroll overwrites it). A slide is many passes, and a lane change does two things to a
      // re-picked line: it reorders which line comes first, and it can shorten the document so scrollTop clamps. A pass
      // then took the clamped height as the new place and the close landed elsewhere: 179-333px at the end of Transitions
      // and Submissions at 768, 971px at a landed Mount Top.
      // v1.251.3: heldAt is the read-back, not the sum written. At a fractional scale the browser snaps a write to its device pixels
      // (3122.39990234375 for 3122.4), so the place, which is the read-back, never equalled the sum, the hold let go, and a line re-picked
      // mid-slide drifted: 100.81px on Armbar from Mount at 1.25 and 1152, and 71.88px at 1.5 on fecd354a3, the carry there or not. A 1px
      // tolerance fixed 1 to 2 but not 0.5 (browser zoom under 100%), where a device pixel is 2 CSS px: 127.63px. The read-back holds
      // at every scale measured, 0.5 to 2, and === still lets any real scroll go.
      // v1.251.1: offsetWidth, not isConnected. A closed tile stays connected, so the hold kept a line with no box, read its top as 0,
      // and threw the reader up by heldY on every pass of the slide (4,345 -> 745 on Knee Slice Pass). It is 0 detached or unrendered.
      // v1.253.0: a line within half a pixel of the reader's top is the line at its top. Strictly below it, a line at 73.86 against a
      // 74px top was skipped for the next one, and opening Explore at 1152 then threw the skipped line 353px (article-dashboard, 30%).
      // v1.251.0: the columns reflow on the same width change, so the source order no longer runs down the page. The
      // line is the block nearest the reader's top in either column, and a tie stays with the earlier block.
      // v1.251.0 (U97 b): the free width, not the grid's. The grid now stands at 902px through most of a pane slide, while the
      // film still flips from beside the question to under it and grows the stage: 143-168px with no anchor to hold the line.
      keep = this.gridW - (this.gridW = free.width) && rect(art).top < top && (this.placeTop === this.heldAt && this.held?.offsetWidth
        ? (was = this.heldY, this.held) : (was = 1 / 0, [...art.querySelectorAll("p,li")].reduce((line, e) => { const y = rect(e).top; return y >= top - 0.5 && y < was ? (was = this.heldY = y, e) : line; }, null)));
      style(art, "--article-width", grid);
      // Owner (2026-11-06, replacing U59 c's rows and U65 b's pairing): two columns, "never a big gap following the
      // previous section". In reading order each open tile goes to the column that is shorter now, and a tie goes left.
      // A tile starts where that column ends, and that height only grows, so a head never starts above the one before
      // it: head tops down the page are the DOM's and the index's order, and the left wins a draw. Real heights: overview
      // has only a 400-character minimum, so a character count cannot size a tile. 24 is reading.css's --gap on two
      // columns; on one, a side changes nothing. Both columns are one width, so a side cannot change a height.
      this.sortColumns(...this.leadCells || []);
      if (toc) {
        toc.hidden = root.dataset.readerReady !== "true" || !fits;
        root.toggleAttribute("data-indexed", !toc.hidden);
        for (const [key, value] of Object.entries({ left: lead, right: "auto", top, "max-height": Math.max(44, end - top) })) style(toc, key, value);
      }
      root.toggleAttribute("data-reference", reference);
      for (const s of [...this.gameSections, this.sections.find(s => s.type === "videos")]) if (s) this.paintPart(s);
      this.nodeBand = reference ? null : a._readerBand(top);
      const band = this.nodeBand?.height || 0;
      if (reference) { this.restoreGame(); this.syncIndex(); return; }
      const card = a._landEl, row = a.optionsRef.current, showCard = card && this.on("card"), showHand = row && a._handShown();
      const deck = !!card?.classList.contains("ng-land-deck");
      // U52 b: an asking question is a quiet line with no outside arrows to clear, so it takes the column's width.
      // Its step stays the deck's: taking it up must move nothing above its answers (D-351, the answer appears
      // once at its final rect; a smaller asking step moved Moves and the answers 8px at 1440).
      const asking = card?.hasAttribute("data-land-ask"), arrows = deck && !asking;
      // D-351: _readerHold keeps a landing's card and hand unpublished until the article it asked
      // for renders (800ms at most). Parts the ceiling publishes are pinned (_readerPin), and the
      // Videos lift and the film's move wait until they settle: a late article used to move live
      // answers under the pointer.
      const hold = a._readerHold(this, W, H), pin = a._readerPin;
      const moved = (el, key) => {
        if (!el) return;
        if (!this.gameHomes.has(el)) {
          const keys = ["position", "left", "right", "top", "bottom", "transform", "width", "height"];
          this.gameHomes.set(el, { parent: el.parentElement, next: el.nextSibling, styles: keys.map(k => [k, el.style.getPropertyValue(k), el.style.getPropertyPriority(k)]) });
          // A choice can execute before the deferred reader adopts the hand.
          // Translate its fixed rectangle once into the native flow.
          const dock = el === row && a._executionDock();
          if (dock) {
            const box = rect(el), top = rect(game).top;
            dock.reader = { rowTop: box.top - top, height: box.bottom - top, rowHeight: box.height };
          }
          // The hand goes before the closed Questions label: Tab order follows Moves, then Questions.
          if (key === "hand") this.gameSections[1].card.before(el); else home.before(el);
          el.setAttribute("data-reader-game-part", key);
          // A late question can replace its body after syncSections. Publish
          // the named eye's target with the actual adopted surface, once.
          if (key === "card" || key === "hand") el.id = "reader-" + key + "-body";
          this.resize.observe(el);
        }
      };
      // A native scrollport contains the actual, already-dealt controls. Their
      // handlers, question/answer state and row order are never reconstructed.
      const oldTop = card && !this.gameHomes.has(card) ? rect(card).top :
        showHand && !this.gameHomes.has(row) ? rect(row).top : null;
      // Keep the node-band reservation through navigation. A new card can be
      // adopted before its article arrives; resetting here would jump it to 64px.
      if (this.gameTop == null && oldTop > 0) this.gameTop = Math.max(64, oldTop - ownTop);
      const gap = showCard && showHand ? deck ? 16 : a.isMobile() ? 8 : 12 : 0;
      // D-352 S2: a pinned landing keeps the media home it was pinned with, its film and its height:
      // any other film (a late chunk's, measuring 0 before its thumbnails load) waits hidden until
      // the parts settle, so nothing opens above or over the pinned rows.
      let homeMedia = this.media?.parentElement === home && !this.media.hidden, film = homeMedia;
      // HIDESEC2: the video's message holds the film's place while it stands: the film's home, width and column, at its own height.
      const note = this.noticeMap.get("videos")?.home === home ? this.noticeMap.get("videos").box : null;
      const filmHeight = () => note && !film ? rect(note).height : a.currentFilmHeight?.() ?? rect(this.media).height;
      if (pin) {
        const h = homeMedia ? filmHeight() : 0;
        if (!("film" in pin)) { pin.film = homeMedia && this.media; pin.mh = h; }
        // Sticky: a hidden home measures 0, so re-testing the height would show the film again.
        homeMedia = homeMedia && !pin.hid && this.media === pin.film && h <= pin.mh;
        if (!homeMedia) pin.hid = true;
      }
      film = homeMedia;
      if (note) homeMedia = true;
      let start = Math.max(6, showCard || showHand || homeMedia ? this.gameTop ?? 64 : 0);
      if (chrome) start += chrome.offset;
      // Adopt the existing controls; the phone catch branch below also aligns Tab order.
      moved(row, "hand"); moved(card, "card");
      const position = (el, x, y, w) => {
        for (const [key, value] of Object.entries({ position: "absolute", left: x, right: "auto", top: y, bottom: "auto" })) style(el, key, value, "important");
        // Inspect owns the hand's horizontal animation. Clearing its transform
        // here exposes the closing row before its overflow/scroll is restored;
        // a following execution then inherits a different rectangle.
        if (el !== row) style(el, "transform", "none", "important");
        if (w != null) style(el, "width", w, "important");
      };
      // Book keeps a stable, scrollable node reservation. Tall questions grow
      // downward instead of squeezing that reservation or moving live answers.
      // Chrome may own the desktop head; phone tools always remain in this flow.
      const inlineHead = tools?.parentElement === game ? tools : head?.parentElement === game ? head : null;
      if (inlineHead) position(inlineHead, free.center - width / 2, band + (chrome?.offset || 0), width);
      const headHeight = inlineHead ? rect(inlineHead).height + 6 : 0;
      if (home.hidden !== !homeMedia) home.hidden = !homeMedia;
      // D-368 (layout C): the current film sits in the game's stage. U65 removes the duplicate article
      // credits; the retained Videos control still governs the film.
      // Keep the deck's 44px outside arrows plus 8px clearance. The left arrow
      // lives in the 60px media gap; the right arrow also fits inside the pane.
      // U104 (owner, 2026-11-06): the question is the left column's first row and the current technique's video card the right's,
      // asking or open. Under an 800px grid a column is too narrow for a card and its arrow (288px at 768), so they stack, question first.
      const column = grid > 800 && H > 500 ? (grid - 24) / 2 : 0;
      // v1.253.0 (owner, 2026-11-09): "when it's just a one liner tease it should appear under the choices row" and take "as much width as
      // the choices row does": in columns, under an open Moves row, the asking line is the grid's width; opened, it takes the left column.
      const tease = column && asking && showHand ? grid : column;
      const [beside, mediaWidth, askStep] = a.filmLayout(cap ? Math.min(free.width, cap + 32) : free.width, H, homeMedia && (showCard || column), card, row, column, tease);
      const mediaLayout = homeMedia ? beside ? "side-by-side" : "stacked" : "none";
      if (game.dataset.mediaLayout !== mediaLayout) game.dataset.mediaLayout = mediaLayout;
      if (card) style(card, "width", Math.min(column ? asking ? tease : column - 52 : beside ? 390 : cap || (arrows ? 560 : 520), free.width - (arrows && !beside ? 104 : 32)), "important");
      const cardWidth = rect(card)?.width || 0;
      style(home, "width", mediaWidth, "important");
      // Videos supplies its natural content height (A: ~241px desktop, ~220px
      // phone). Measuring the shared host keeps its future renderer independent.
      // D-353: a film in the media home is observed like the Videos card, so its growth (a played
      // clip opens over frames) relays out the rows below it instead of covering them.
      if (film) this.resize.observe(this.media);
      // D-368: the film stays home under C, so place() never docks it again; its reel's edge arrows are
      // re-read here, after the home's width changes, or a stale data-off leaves Next dead to the mouse.
      if (film) a._syncFilmEdges?.();
      const mediaHeight = homeMedia ? filmHeight() : 0;
      const cardHeight = showCard ? rect(card).height : 0, handHeight = showHand ? rect(row).height : 0;
      const handoff = a._executionDock()?.reader;
      let cardX = Math.max(a.isMobile() ? 10 : 16, free.center - cardWidth / 2), cardY, gameHeight;
      // U110 a: the Moves row shares the column's edges wherever the stacked box binds, from 600px free (the cap and the card's
      // 104px arrow lane), so on a phone-sized screen from 600 to 640px too. Under 600px a phone keeps its full-width tray.
      const flush = this.trayFlush = W > 640 || free.width >= 600;
      {
        // D-338 (owner): Video, Moves, Questions, then the article, under the node band.
        // No header names a part; a closed one keeps its place as its label. An escape's
        // handoff keeps the hand's clicked rectangle, and the card below it stays put too.
        const left = free.center - width / 2, step = deck ? 16 : a.isMobile() ? 8 : 12;
        const label = part => this.gameSections.find(s => s.part === part).card;
        // D-368: Moves follow the node band at the parts' own step (it used to sit under the lifted Videos
        // card): a zoomed roll-start pair reaches the band's edge, so 6px left camera-continuity no 2px clearance.
        let y = band + Math.max(headHeight, step) + (chrome?.offset || 0);
        // The grid's own box, so no move or ✕ hides under an index link. The app pads the row by the pane
        // (free.left), so its box starts that much before the grid's edge; trayFlush takes its 24px inset away.
        const rowLeft = flush ? free.center - grid / 2 - free.left : 0;
        const placeHand = () => {
          if (pin) y = pin.rowTop || (pin.rowTop = y);
          const rowTop = handoff?.rowTop ?? y;
          if (row) position(row, rowLeft, rowTop, flush ? grid + free.left : W);
          // Variant b: a label (a landing's take-away, or b2's message) takes the grid's edges, as the tiles do.
          if (!label("hand").hidden) { position(label("hand"), free.center - grid / 2, y, grid); y += rect(label("hand")).height + step; }
          else y = rowTop + (handoff?.rowHeight ?? handHeight) + (askStep ?? step);
        };
        // D-433 (2026-10-26), D-370 adapted to U35: Answer for Points (U47 d) and all shown answers
        // must be reachable on arrival, with no scroll writer. The SAME untimed
        // Moves row follows the phone question; all other landings keep layout C.
        // Keep DOM/Tab order aligned too, restoring it on a desktop resize.
        const questionFirst = phoneCatch && showCard && row;
        if (questionFirst) { if (card.nextSibling !== row) row.before(card); }
        else { if (card?.nextSibling === row) row.after(card); placeHand(); }
        // D-368 (layout C): the stage after Moves. On a desktop the current card sits 60px beside the
        // question (400 + 60 + 390, the approved A geometry), tops aligned so the question stays high.
        // U52 b (owner, 2026-10-28) supersedes D-368's stacked order: the question comes "immediately
        // following the your move row", so stacked, the current card follows the question in every
        // landing (it already did in a catch, so the answers stay on screen).
        // CARDGAP1 (owner, 2026-11-11, v1.256.3): "this big ass space between sections where the landcard used to be". A film-first
        // line stood here, `homeMedia && !beside && !follows`: placed the film, then `y += mediaHeight + 12`. Since U52 b (v1.241.0)
        // dropped the catch from `follows`, that test IS the closed-card film line's below (`!showCard`), so the two always fired
        // together; the later one moved the film under the label and the first left its height behind, above the label: 240px at
        // 390x844, 311px at 574x760, the film's height plus 20. It was the only thing the line did. Pinned by card-close-gap.spec.ts.
        const follows = homeMedia && !beside && showCard;
        if (pin) y = pin.cardY || (pin.cardY = y);
        cardY = y;
        if (column) cardX = free.center - grid / 2;
        // Owner (2026-11-06, U90): "the question below the choices should be left aligned, aligned with the left start of
        // Your choices/moves label". The label is its group's first line, 3px inside it, and the line's text sits 4px inside
        // the card. offsetLeft, because a scrolled tray or Inspect's slide moves the label and must not take the line along.
        const moves = showHand && asking && row.firstElementChild;
        if (moves) cardX = rowLeft + moves.offsetLeft - 1;
        if (card) position(card, cardX, cardY);
        // The deck's backs peek 3px per remaining card below the face; the article clears them.
        if (showCard) y += cardHeight + 3 * (a._landStackEl?.childElementCount || 0);
        else if (!label("card").hidden) { position(label("card"), free.center - grid / 2, y, grid); y += rect(label("card")).height; }
        if (questionFirst) { y += step; placeHand(); y -= step; }
        if (follows) { y += step; position(home, free.center - mediaWidth / 2, y, mediaWidth); y += mediaHeight; }
        else if (homeMedia && !showCard && !beside) {
          // The step after Moves is already in y; a painted label adds its own. None painted (the index carries it, or no card yet
          // on this landing), the film takes the place the label would: one step under Moves, never two.
          const lead = rect(label("card")).height ? step : 0;
          position(home, free.center - mediaWidth / 2, y + lead, mediaWidth); y += lead + mediaHeight;
        }
        // U104: the film's cell. An asking question is a line in the Moves band, whose padding the row gives back as it opens, so
        // the film starts where the open card will, and taking the question up moves it nowhere. `reach` is how far the taller
        // cell runs past the shorter one, and each column carries on under its own.
        let reach = 0;
        if (column) {
          // A closed question leaves its label, a row across the grid, so both cells start under it; from cardY the right column
          // ran up over the label and took its reopening press (D-338, at 1,024 to 1,349px, where no index sits beside it).
          // #346's review (finding 3): the asking line sits in the Moves band only while Moves is open (placeHand), so only then does
          // the film start where the open card will; with Moves closed, it starts on the question, which opens downward.
          // v1.253.0: a tease across the row puts the film under it, and the film keeps that place as the question opens: the tease's
          // height, kept for this card (a new landing's card is a new element), drops the opened card's film by the same amount.
          if (tease > column && askStep != null) this.teaseDrop = [card, cardHeight - 3];
          // #354's review (finding 7): only while Moves is open, where the tease spans; with Moves closed the asking line is the column's
          // and the film starts on the question (finding 3), whatever Moves did earlier on this card.
          const drop = showCard && showHand && this.teaseDrop?.[0] === card ? this.teaseDrop[1] : 0;
          const filmEnd = (showCard ? cardY : y) + (homeMedia ? (showHand && askStep != null ? step + 3 : 0) + drop + mediaHeight : 0);
          if (homeMedia) position(home, free.center + 12, filmEnd - mediaHeight, mediaWidth);
          reach = filmEnd - y; y = Math.min(y, filmEnd);
        }
        gameHeight = Math.max((handoff?.height ?? 0) + (handoff?.slot || 0), y);
        this.leadCells = [-reach, reach].map(x => Math.max(0, x));
        this.sortColumns(...this.leadCells);
      }
      for (const [el, key] of [[a._landStackEl, "stack"], [a._landNavEl, "nav"]]) {
        if (el && card) { moved(el, key); position(el, cardX, cardY, cardWidth); style(el, "height", cardHeight); }
      }
      if (a._landNavEl && showCard) {
        // Long answers keep their outside arrows beside the visible face.
        const cardTop = top + cardY - root.scrollTop;
        const middle = (Math.max(top, cardTop) + Math.min(end, cardTop + cardHeight)) / 2 - cardTop;
        // #354's review (finding 5): beside the index Previous stands one target above Next (helmet.html), so with little of the face
        // in view it climbed over the choices (23px of their bottoms at 1440x520). There the guide keeps Previous's top on the face.
        style(a._landNavEl, "--guide-y", Math.max(a._landNavEl.hasAttribute("data-index") ? 70 : 22, Math.min(cardHeight - 22, middle)));
      }
      style(game, "height", gameHeight);
      style(art, "margin-top", 6);
      // #354's review (finding 3): Answer for Points' 23px hang (helmet.html) reaches a tile's ✕ where the film is closed: 328px² of the
      // first tile's 1,936px² at 390x631 (ask-line.spec.ts, every point sampled with elementsFromPoint), as it reached the retired
      // article ✕; that ✕ takes the shared corner. Only where the card's own ✕ is clear of it: the card is one stacking context, so a tile
      // ✕ raised there would cover the card's ✕ too (1440, the film closed). Measured after this pass's game height and article margin,
      // so the pass that moves the tiles decides on where they now are (round 7's review, nit 7).
      const go = rect(card?.querySelector("[data-land-ask-go]")), shut = rect(card?.querySelector("[data-land-close]"));
      const meets = (x, y) => x && y.width && x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
      for (const s of this.sections) { const b = rect(s.toggle); s.toggle.style.zIndex = meets(go, b) && !meets(shut, b) ? 6 : ""; }
      this.trayBottom = H - end + 12 + Math.min(128, H * .15);
      this.cardBottom = this.trayBottom;
      // Publication is the last write, after the actual controls and their
      // outside arrows have a final rectangle. Keyboard/clock ask the same flag.
      if (hold <= 0) card?.removeAttribute("data-reader-pending");
      for (const [el] of this.gameHomes) if (!el.isConnected) { this.resize.unobserve(el); this.gameHomes.delete(el); }
      this.syncIndex();
    } finally {
      if (this.placeTop > root.scrollTop) root.scrollTop = this.placeTop;
      // After the clamp's restore, and it is the new place at once: the pane slides open over many
      // passes, and the next pass's clamp must not put back a place its scroll event has not recorded.
      // Rounded: the pane slides open over ~40 passes, and an unrounded correction is rounded by the browser the same
      // way each time, so the line crept 5px up and then lost the anchor to the block below it (26px).
      // SIDECX5: a partially clipped block above the top can wrap and move the first visible line;
      // anchor a block starting within the reader instead, retaining the rounded correction.
      if (keep) { this.held = keep; root.scrollTop += Math.round(rect(keep).top - was); this.heldAt = this.placeTop = root.scrollTop; }
      this.laying = false;
    }
  }
  // U104: l and r are how far the stage's taller first-row cell reaches past the shorter one, so each column carries on under its own cell.
  sortColumns(l = 0, r = 0) {
    const a = l, b = r;
    let last = 0;
    for (const s of this.sections) {
      // #346's review (finding 2): a tile this pass skips keeps neither, or a closed one carried its margin into "Hidden sections".
      // Only the skipped ones are written: rewriting an open tile would lay it out again on every pass.
      const css = s.card.style;
      // HIDESEC2: a closed tile holding its message keeps its place in its column until the message has gone.
      if (s.body.hidden && !s.card.hasAttribute("data-notice") || s.control) { css.marginTop = css.clear = ""; continue; }
      // Within a pixel is a draw: a reader sees one line, and the left wins it.
      const right = l > r + 1, height = rect(s.card).height + 24, at = right ? r : l;
      s.card.toggleAttribute("data-right", right);
      // The first tile under the taller cell starts below it. A float's margin counts from the float before it (CSS 2.1 9.5.1 rule 5),
      // and with nothing yet across the column two tiles of one side would stand side by side, so each clears its own side.
      css.marginTop = (right ? r == b : l == a) ? at - last + "px" : 0;
      css.clear = a + b ? right ? "right" : "left" : "";
      last = at;
      if (right) r += height; else l += height;
    }
  }
  destroy() {
    cancelAnimationFrame(this.layoutFrame);
    for (const n of this.noticeMap.values()) clearTimeout(n.timer);
    this.place(this.mediaOrigin); this.restoreGame();
    this.abort?.abort(); this.resize.disconnect(); this.tileSizer.disconnect(); this.root.remove(); this.contents?.remove();
    this.app._readerTocEl = null;
    document.removeEventListener("pointerup", this.selectionEnd);
    this.app.wrapRef.current?.classList.remove("ng-reader-dormant", "ng-reader-no-map", "ng-reader-no-feedback");
    this.app.__ngRoot?.classList.remove("ng-reader-no-feedback");
  }
}
