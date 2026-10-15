// The complete published article is the source of truth. This module is deferred:
// content arrivals prepare dormant controls; game articles load after the real hand.
const PARTS = [
  ["film", "Videos", "▶"], ["card", "Practice questions", "?"],
  ["hand", "Moves", "⋯"], ["map", "Map", "◇"],
  ["feedback", "Game feedback", "◌"], ["book", "Article", "▤"],
];
const GAME_KEYS = { film: "landFilm", card: "landCard", hand: "landHand", map: "landMap", feedback: "landFeedback" };
const READ_KEYS = { film: "readingFilm", card: "readingCard", hand: "readingHand", map: "readingMap", feedback: "readingFeedback" };
const CONTENT = /^\/(Positions|Transitions|Submissions|Principles|Learning|Systems)(?:\/|$)/i;
const ROLES = /\/(Top|Bottom|Attacker|Defender)$/i;
const cleanPath = (path) => decodeURI(new URL(path, location.href).pathname).replace(/\.html$/, "").replace(/\/$/, "") || "/";

function element(tag, attrs = {}, text = "") {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.textContent = text;
  return node;
}
function button(label, action, attrs = {}) {
  const node = element("button", { type: "button", ...attrs }, label);
  node.style.pointerEvents = "auto";
  node.addEventListener("click", (event) => { event.stopPropagation(); action(event); });
  return node;
}

export async function installReader(app) {
  // Measure only styled chrome. A bare nav initially lays out at the top of the
  // wrap; reserving that rectangle would move the hand above the viewport and
  // poison the camera's tighten-only band cache before the CSS arrives.
  if (!await app._ensureReadCSS()) throw new Error("Reading styles could not be loaded.");
  if (app._reader || app.__ngDestroyed) return;
  const reader = app._reader = new Reader(app);
  // Game intent is explicit. Restoring a layer, closing Browse or leaving Focus is
  // deliberately absent from these lifters: none of those actions starts a roll.
  for (const name of ["rollFromPosition", "stageRollAt", "startRoll", "resetRoll"]) {
    const original = app[name];
    app[name] = function (...args) {
      if (!reader.seating) reader.leaveReading();
      return original.apply(this, args);
    };
  }
  const activate = app.activateOption;
  app.activateOption = function (opt, pick, card, inspect) {
    if (opt && !opt.threat && !inspect && !this._execution && !this._checkpoint && (!this._rollHand || this._rollHand.mounted)) reader.beginPlay();
    return activate.call(this, opt, pick, card, inspect);
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
    app[name] = function (...args) { const result = original.apply(this, args); reader.layout(); return result; };
  }
  const scroll = app._readApply;
  app._readApply = function (...args) { const result = scroll.apply(this, args); reader.layout(); return result; };
  reader.shelf();
}

class Reader {
  constructor(app) {
    this.app = app;
    this.cache = new Map();
    this.serial = 0;
    this.interacting = false;
    this.trayBottom = 84;
    // _pushUrl changes the address without replacing Quartz's DOM. Only data-slug
    // identifies this cached article; location.pathname would reuse the wrong page.
    const slug = document.body.dataset.slug;
    if (slug && document.querySelector("article")) this.cache.set(cleanPath("/" + slug), this.extract(document));
    this.root = app._readerEl = element("section", { class: "ng-reader", "aria-label": "Reading", "data-reader": "", tabindex: "-1" });
    this.root.style.pointerEvents = "auto";
    app.wrapRef.current.append(this.root);
    for (const type of ["wheel", "touchstart", "pointerdown", "focusin"]) {
      this.root.addEventListener(type, (event) => {
        // Toolbar activation has its own intent. Native text selection and prose
        // focus count as reading before the question clock gets another frame.
        if (type === "wheel" || type === "touchstart" || !event.target.closest(".ng-reader-tools,.ng-reader-roles")) this.readingInteraction(type);
        event.stopPropagation();
      }, { passive: true });
    }
    this.root.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") { this.readingInteraction(); event.stopPropagation(); }
    });
    this.root.addEventListener("click", (event) => this.link(event));
    this.resize = new ResizeObserver(() => this.layout());
    this.resize.observe(this.root);
  }
  extract(doc) {
    const article = doc.querySelector("article");
    if (!article) throw new Error("This page has no article.");
    return {
      title: doc.querySelector("h1.article-title, .article-title, h1")?.textContent?.trim() || doc.title.split(" | ")[0],
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
    this.path = path;
    this.intent = intent;
    const hit = this.app._nodeAndRoleForPath(path);
    this.interacting = !!intent && (this.app.get("readingFocus", false) || hit.idx < 0);
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
    const controller = this.abort = new AbortController(), serial = ++this.serial;
    this.reference = null;
    if (intent && /^\/(Principles|Learning|Systems)\//i.test(path)) {
      this.app.clearFocus();
      this.app._exQ = "";
      if (this.app.explorerSearchRef.current) this.app.explorerSearchRef.current.value = "";
      this.highlightReference(path, serial);
    }
    if (push) history.pushState({ ...history.state, ngReading: true }, "", url.pathname + url.search + url.hash);
    this.root.dataset.readerPath = path;
    this.root.dataset.readerReady = "false";
    this.root.replaceChildren(element("p", { role: "status" }, "Loading the complete article…"));
    this.sync();
    try {
      const styled = await this.app._ensureReadCSS();
      if (!styled) throw new Error("Reading styles could not be loaded.");
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
      if (serial !== this.serial || this.app.__ngDestroyed) return;
      this.render(record.title, guide, guidePath, context, hub);
      this.root.dataset.readerReady = "true";
      this.sync();
      if (url.hash) this.anchor(url.hash);
      else if (this.interacting) this.root.querySelector("h1").focus({ preventScroll: true });
    } catch (error) {
      if (serial !== this.serial || error.name === "AbortError" || this.app.__ngDestroyed) return;
      this.root.replaceChildren(element("p", { role: "alert" }, error.message),
        button("Retry article", () => this.open({ path, intent, push: false }), { "data-reader-retry": "" }),
        element("a", { href: path, target: "_blank", rel: "noopener" }, "Open the original page in a new tab"));
    }
  }
  async highlightReference(path, serial) {
    const a = this.app, id = path.slice(1), system = path.startsWith("/Systems/");
    let record;
    if (system) record = await a._ensureSystemRecord(id);
    else { await a._ensureConcepts(); record = a._conceptsById?.[id]; }
    if (!record || serial !== this.serial || a.__ngDestroyed || !this.intent) return;
    this.reference = { record, system };
    if (system) { a._systemId = id; a._systemRecordStatus = "ready"; }
    else a._conceptId = id;
    this.lightReference();
  }
  lightReference() {
    if (!this.reference || !this.on("map")) return;
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
  article(record, path, kind) {
    const article = element("article", { "data-reader-article": kind, "data-source-path": path });
    article.innerHTML = record.html;
    article.querySelectorAll("script,style").forEach((node) => node.remove());
    const overview = article.querySelector("section#overview");
    if (overview && !overview.querySelector("h2")) overview.prepend(element("h2", { id: "overview" }, "Overview"));
    const base = new URL(path, location.origin), ids = new Map();
    // Source pages sometimes repeat a section's id on its heading. Each clone id
    // is unique, and heading links resolve within this article, never the hidden DOM.
    article.querySelectorAll("[id]").forEach((node, index) => {
      const id = node.id, mapped = "reader-" + this.serial + "-" + kind + "-" + index;
      if (!ids.has(id)) ids.set(id, mapped);
      node.dataset.sourceId = id; node.id = mapped;
    });
    for (const node of article.querySelectorAll("[href],[src],[poster]")) {
      for (const attr of ["href", "src", "poster"]) {
        const value = node.getAttribute(attr); if (!value) continue;
        const url = new URL(value, base);
        if (attr === "href" && url.origin === base.origin && cleanPath(url.href) === path && url.hash) {
          node.dataset.readerAnchor = decodeURIComponent(url.hash.slice(1));
          node.setAttribute(attr, path + url.hash);
        } else node.setAttribute(attr, url.href);
        if (attr === "href" && url.origin === location.origin && ROLES.test(url.pathname) && /^Play as /i.test(node.textContent.trim())) node.textContent = node.textContent.replace(/Play as /i, "Read as ");
      }
      for (const attr of [...node.attributes]) if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
    }
    // Published films have exactly one owner here. Keep every authored credit and
    // source link; mount an iframe only after the reader asks to play it.
    article.querySelectorAll("iframe").forEach((frame) => {
      const src = frame.getAttribute("src");
      const play = button("Play video", () => { play.replaceWith(frame); frame.loading = "eager"; }, { "data-reader-video": "" });
      frame._readerPlay = play;
      const holder = element("div", { "data-reader-film": "" }); holder.append(play); frame.removeAttribute("autoplay");
      frame.src = src; frame.title ||= "Instructional video";
      frame.replaceWith(holder);
    });
    return article;
  }
  render(title, record, path, context, hub) {
    this.root.replaceChildren();
    const head = element("header", { class: "ng-reader-head" });
    const heading = element("h1", { tabindex: "-1" }, title);
    const tools = element("div", { class: "ng-reader-tools" });
    tools.append(button(this.app.get("readingFocus", false) ? "Leave reading focus" : "Focus on reading", () => this.focus(), { "data-reading-focus": "" }));
    tools.append(button("Browse", () => this.app.openPane("explore"), { "data-reader-browse": "" }));
    if (/^\/(Systems|Principles|Learning)\//.test(this.path)) {
      tools.append(button("Study tools", async () => {
        const id = this.path.slice(1);
        if (id.startsWith("Systems/")) this.app.openSystem(id);
        else { await this.app._ensureConcepts(); if (this.path.slice(1) === id) this.app.openConcept(id); }
      }, { "data-reader-study": "" }));
    }
    head.append(heading, tools);
    const roles = element("nav", { "aria-label": "Reading perspectives", class: "ng-reader-roles" });
    const roleLinks = this.roleLinks((context || record).html, hub);
    if (roleLinks.length) {
      roleLinks.unshift(new URL(hub, location.origin));
      for (const url of roleLinks) {
        const a = element("a", { href: url.pathname }, url.pathname === hub ? "Overview" : url.pathname.split("/").pop());
        if (url.pathname === this.path) a.setAttribute("aria-current", "page");
        roles.append(a);
      }
      head.append(roles);
    }
    const body = element("div", { "data-reader-body": "", tabindex: "0" });
    if (context) {
      const shared = this.article(context, hub, "hub");
      // A perspective page is already complete. Its hub contains BOTH players'
      // summaries, execution steps and outcomes, which must never leak across a
      // seat or stand in for an unauthored defender. Only shared safety is added.
      if (ROLES.test(this.path)) {
        const safety = [...shared.querySelectorAll('[data-source-id="safety-considerations"],blockquote.callout.danger')];
        shared.replaceChildren(...safety);
      }
      body.append(shared);
      body.append(element("h2", {}, record.title));
    }
    body.append(this.article(record, path, "guide"));
    const contents = element("nav", { class: "ng-reader-contents", "aria-label": "Article contents" });
    for (const section of body.querySelectorAll("h2[id],h3[id]")) {
      const link = element("a", { href: section.closest("article").dataset.sourcePath + "#" + encodeURIComponent(section.dataset.sourceId), "data-reader-target": section.id }, section.textContent.trim());
      contents.append(link);
    }
    head.append(contents);
    this.root.append(head, body);
    this.root.scrollTop = 0;
  }
  link(event) {
    const link = event.target.closest("a[href]");
    // Quartz's global handler ignores defaultPrevented. Stop propagation even for
    // modified clicks, while leaving the browser's new-tab behavior untouched.
    event.stopPropagation();
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === "_blank" || link.hasAttribute("download")) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (link.dataset.readerTarget || link.dataset.readerAnchor) {
      event.preventDefault(); this.readingInteraction();
      this.anchor(url.hash, link.dataset.readerTarget, link.closest("article")); return;
    }
    if (CONTENT.test(url.pathname) || !/\.[a-z0-9]+$/i.test(url.pathname)) {
      event.preventDefault(); this.app._readArticle(url.pathname + url.search + url.hash);
    }
  }
  anchor(hash, target, scope = this.root) {
    const id = decodeURIComponent(hash.replace(/^#/, ""));
    const node = target ? this.root.querySelector("#" + CSS.escape(target)) : scope.querySelector('[data-source-id="' + CSS.escape(id) + '"]');
    if (!node) return;
    node.tabIndex = -1;
    this.root.scrollTop += node.getBoundingClientRect().top - this.root.querySelector("header").getBoundingClientRect().bottom - 12;
    node.focus({ preventScroll: true });
    history.replaceState({ ...history.state, ngReading: !!this.intent }, "", this.path + hash);
  }
  readingInteraction(type) {
    if (this.interacting) return;
    this.interacting = true;
    if (!this.intent) this.app._declineLandQ("reading");
    this.app.setPaused(true);
    // Do not move text during a drag selection. The clock is already declined;
    // expanding after pointerup keeps the browser's native selection intact.
    if (type === "pointerdown") {
      this.selecting = true;
      this.selectionEnd = () => { this.selecting = false; if (!this.app.__ngDestroyed) this.sync(); };
      document.addEventListener("pointerup", this.selectionEnd, { once: true });
    }
    this.sync();
  }
  leaveReading() {
    document.removeEventListener("pointerup", this.selectionEnd);
    this.selecting = false;
    if (this.app.get("readingFocus", false)) this.app.set("readingFocus", false);
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
  focus() {
    const a = this.app, on = !a.get("readingFocus", false);
    a.set("readingFocus", on);
    if (on) {
      // Only this explicit preset writes overrides. Render, navigation, hydration
      // and reload read them as-is, so an individually restored part stays restored.
      for (const key of Object.values(READ_KEYS)) a.set(key, false);
      a.set("readerBook", true);
      a._declineLandQ("reading");
      a.setPaused(true);
      a._readerIntent = this.intent = this.interacting = true;
      a.setDeckOpen(false);
    } else this.interacting = false;
    a._applyLayers(); this.sync();
    const b = this.root.querySelector("[data-reading-focus]");
    if (b) b.textContent = on ? "Leave reading focus" : "Focus on reading";
  }
  on(part) {
    if (part === "book") return this.app.get("readerBook", true) !== false;
    return this.app.get((this.app.get("readingFocus", false) ? READ_KEYS : GAME_KEYS)[part], true) !== false;
  }
  toggle(part) {
    const a = this.app, on = !this.on(part);
    if (part === "book") a.set("readerBook", on);
    else if (["film", "card", "hand"].includes(part)) a.setLayer(part, on, "reader-shelf");
    else a.set((a.get("readingFocus", false) ? READ_KEYS : GAME_KEYS)[part], on);
    if (on && (part === "card" || part === "hand")) this.interacting = false;
    this.sync();
    // The old button may have been replaced. Give focus to the visible replacement.
    this.dock.querySelector('[data-reader-part="' + part + '"]')?.focus({ preventScroll: true });
    if (part === "book" && on) this.root.focus({ preventScroll: true });
  }
  shelf() {
    if (!this.dock) {
      this.app._layerDockEl?.remove();
      this.dock = this.app._layerDockEl = element("nav", { class: "ng-reader-shelf", "data-layer-dock": "1", "aria-label": "Reading and game parts" });
      this.dock.style.pointerEvents = "auto";
      this.app.wrapRef.current.append(this.dock);
      this.dock.addEventListener("pointerdown", (e) => e.stopPropagation());
      this.dock.addEventListener("keydown", (e) => e.stopPropagation());
      this.resize.observe(this.dock);
    }
    const state = PARTS.map(([part]) => this.on(part)).join();
    if (state !== this.shelfState) {
      this.shelfState = state;
      this.dock.replaceChildren(...PARTS.map(([part, label, icon]) => {
        const on = this.on(part);
        const b = button("", () => this.toggle(part), { "data-reader-part": part, [on ? "data-layer-hide" : "data-layer-show"]: part, "aria-label": (on ? "Hide " : "Show ") + label, "aria-pressed": String(on), title: (on ? "Hide " : "Show ") + label });
        b.append(element("span", { "aria-hidden": "true" }, icon), element("span", {}, part === "card" ? "Questions" : part === "feedback" ? "Feedback" : part === "book" ? "Book" : label));
        return b;
      }));
    }
    this.layout();
  }
  sync() {
    const a = this.app, wrap = a.wrapRef.current;
    if (a.get("readingFocus", false) && !a._readerIntent && this.path) { a._readArticle(this.path, true, false); return; }
    this.root.hidden = !this.on("book");
    const expanded = !!(this.interacting && !this.selecting);
    this.root.toggleAttribute("data-reading-expanded", expanded);
    for (const ref of [a.nodeCardRef]) ref.current?.setAttribute("data-reader-map", "");
    for (const ref of [a.evCenterRef, a.fxRef]) ref.current?.setAttribute("data-reader-feedback", "");
    wrap.classList.toggle("ng-reader-active", expanded && this.on("book"));
    wrap.classList.toggle("ng-reader-dormant", !!this.intent);
    const map = this.on("map");
    if (!map) a._cancelGraphInput?.();
    else if (wrap.classList.contains("ng-reader-no-map")) this.lightReference();
    wrap.classList.toggle("ng-reader-no-map", !map);
    wrap.classList.toggle("ng-reader-no-feedback", !this.on("feedback"));
    a.__ngRoot?.classList.toggle("ng-reader-no-feedback", !this.on("feedback"));
    // Static embeds and app clips never play together. The prose owns playback on
    // reading intent; mixed game view retains the landing strip and credit links.
    this.root.dataset.videos = String(this.on("film") && !!this.intent);
    for (const frame of this.root.querySelectorAll("iframe")) {
      if (this.root.dataset.videos === "false" || this.root.hidden) frame.replaceWith(frame._readerPlay);
    }
    // v1.227.0: a defending landing owns its films even on a reader/link arrival.
    // Clearing them here made cache timing decide whether the correct reel survived:
    // a dossier arriving after sync showed it, one arriving before sync lost it.
    const land = a.nodes[a._landIdx];
    const defending = land && a._landPerspSide(land) === "defender";
    if ((this.intent && !defending) || !this.on("film")) a._clearLandFilm();
    this.shelf();
  }
  layout() {
    if (!this.dock || this.app.__ngDestroyed) return;
    const a = this.app, H = window.innerHeight, W = window.innerWidth;
    const free = a._paneLayout(), width = Math.max(240, Math.min(680, free.width - 24));
    this.dock.style.left = free.center + "px";
    this.dock.style.maxWidth = Math.min(width, W - 16) + "px";
    const horizontal = this.dock.getBoundingClientRect();
    this.dock.style.bottom = a._readerShelfBottom(horizontal) + "px";
    const shelf = this.dock.getBoundingClientRect();
    const logo = a.wrapRef.current.querySelector(".ng-logo").getBoundingClientRect();
    const top = Math.max(68, logo.bottom + 12), end = shelf.top - 8;
    const expanded = this.interacting && !this.selecting;
    // Explicit playback borrows the preview's space while the game film is open.
    // Keep the article DOM and preference, then restore its dock when playback closes.
    const playing = !expanded && a._expandedClip && a._landFilmEl?.contains(a._expandedClip);
    const arriving = !expanded && a._arriveLabelT != null && a.now < a._arriveLabelT;
    this.root.hidden = !this.on("book") || !!playing || arriving;
    // A preview shares the screen with the actual game stack. Preserve the deck's
    // ordinary height instead of squeezing its answers to make room for prose.
    const card = a._landEl, hand = a._handShown() ? a.optionsRef.current?.offsetHeight || 0 : 0;
    const film = a._landFilmEl?.offsetHeight || 0;
    const compact = !expanded && a._compactLandDeck();
    const gameHeight = hand + (card ? Math.max(236, card.scrollHeight + 2) + 16 : 0) + (film ? film + 8 : 0);
    const n = a.nodes[a.focusIdx];
    // Preserve the graph's drawn pair at resting roll zoom as well as the game
    // controls. A late film can borrow preview space before moving the graph.
    const graphSpace = n ? Math.max(132, 2 * ((n.h || 0) + n.r * 1.6) * .4 * W / (a.graphW * a.ROLL_ZOOM) + 50) : 180;
    // Keep the chosen card's column reservation until its execution ends. A
    // generic deck's teardown must not move that card or expand prose over it.
    const handoff = a._executionDock()?.reader;
    const height = handoff?.height ?? (compact ? 54 : Math.max(expanded ? 80 : 52, expanded ? end - top : Math.min(128, H * .15, end - gameHeight - graphSpace)));
    const column = compact ? card.getBoundingClientRect() : null;
    this.root.toggleAttribute("data-reading-compact", !expanded && height < 80);
    this.root.style.width = (column ? column.width : width) + "px";
    this.root.style.left = (column ? column.left + column.width / 2 : free.center) + "px";
    // On a very short screen the existing tall-question column scrolls. The
    // article follows its hand below the fold until that column reaches its end.
    const push = handoff?.push ?? (!expanded && !compact ? Math.max(0, (a._readMax || 0) - (a._readS || 0)) : 0);
    this._layoutSnapshot = { height, push };
    this.root.style.bottom = H - end - push + "px";
    this.root.style.height = height + "px";
    const previous = this.trayBottom, previousCard = this.cardBottom;
    // Hiding the preview during the arrival heading must keep its reservation.
    // Releasing it here moves the camera's landing aim twice during one flight.
    this.cardBottom = expanded ? 84 : H - end + 12 + ((!this.on("book") || playing) ? 0 : height);
    // Short landscape has independent columns: the article sits under the quiz
    // on the left, while the hand keeps room for its film on the right.
    this.trayBottom = compact ? 84 : this.cardBottom;
    if (!a._readMax && a.optionsRef.current) a.optionsRef.current.style.bottom = a._landDatum().tray + "px";
    // The question and film use the same datum as the hand. Move all of them in
    // this layout pass; a later animation frame leaves a live hand behind its quiz.
    if ((previous !== this.trayBottom || previousCard !== this.cardBottom) && !this.docking) {
      this.docking = true;
      a._bandMemo = {}; a._bandBot = null;
      if (a._landEl) a._dockLandCard(a._landEl); else a._dockLandFilm();
      this.docking = false;
    }
  }
  destroy() {
    this.abort?.abort(); this.resize.disconnect(); this.root.remove(); this.dock?.remove();
    document.removeEventListener("pointerup", this.selectionEnd);
    this.app.wrapRef.current?.classList.remove("ng-reader-active", "ng-reader-dormant", "ng-reader-no-map", "ng-reader-no-feedback");
    this.app.__ngRoot?.classList.remove("ng-reader-no-feedback");
  }
}
