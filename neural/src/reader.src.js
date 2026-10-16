// The complete published article is the source of truth. This module is deferred:
// content arrivals prepare dormant controls; game articles load after the real hand.
const PARTS = [
  ["film", "Videos", "▶"], ["card", "Practice questions", "?"],
  ["hand", "Moves", "⋯"], ["map", "Map", "◇"],
  ["feedback", "Game feedback", "◌"], ["book", "Article", "▤"],
];
// Film has dedicated normal-home and section preferences; legacy keys remain in storage.
const GAME_KEYS = { card: "landCard", hand: "landHand", map: "landMap", feedback: "landFeedback" };
const READ_KEYS = { card: "readingCard", hand: "readingHand", map: "readingMap", feedback: "readingFeedback" };
const CONTENT = /^\/(Positions|Transitions|Submissions|Principles|Learning|Systems)(?:\/|$)/i;
const ROLES = /\/(Top|Bottom|Attacker|Defender)$/i;
const cleanPath = (path) => decodeURI(new URL(path, location.href).pathname).replace(/\.html$/, "").replace(/\/$/, "") || "/";
const pathRole = path => (path.split("/").pop() || "Guide") + " perspective";

// Shared with the deferred Settings UI. Persist semantic types, never a route,
// translated heading or ordinal. Additions do not delete old settings (§6.6).
export const SECTION_TYPES = [
  ["videos", "Videos"], ["overview", "Overview"], ["principles", "Essential principles"],
  ["recognition", "Recognition"], ["setup", "Setup"], ["prerequisites", "Prerequisites"],
  ["options", "Options and applications"], ["safety", "Safety guides"], ["mistakes", "Common mistakes"],
  ["escapes", "Escape paths"], ["favorable-outcomes", "Favorable outcomes"], ["outcomes", "Outcomes"],
  ["training", "Training"], ["statistics", "Statistics"], ["variations", "Variations"],
  ["role-comparison", "Role comparison"], ["top-summary", "Top overview"], ["bottom-summary", "Bottom overview"],
  ["attacker-summary", "Attacker overview"], ["defender-summary", "Defender overview"],
  ["assessment", "Self-assessment"], ["progress", "Progress markers"], ["integration", "Position integration"],
  ["sources", "Sources"], ["course", "Course"], ["related", "Related"], ["additional", "Additional reading"],
];
export function sectionShown(app, type) {
  return app.get("readerSection." + type, true) !== false;
}
// Group aliases by their semantic type: one destination string per group.
const SECTION_IDS = Object.fromEntries(Object.entries({
  "videos": "film-study official-preview",
  "overview": "overview definition state-invariants",
  "principles": "key-principles building-blocks key-takeaways",
  "recognition": "recognition-cues",
  "setup": "setup-requirements conditions",
  "prerequisites": "prerequisites fit",
  "options": "defensive-options execution-steps common-counters opponent-defense-patterns decision-tree applications where-to-apply how-to-apply coverage",
  "safety": "safety-considerations",
  "mistakes": "common-mistakes mistakes-to-avoid mistakes",
  "escapes": "escape-paths",
  "favorable-outcomes": "favorable-outcomes",
  "outcomes": "possible-outcomes outcomes terminal-state",
  "training": "exercises training-drills training-progressions practice how-to-practice training",
  "variations": "variations-and-setups variants-and-adaptations variations variants",
  "assessment": "knowledge-assessment self-assessment test-your-knowledge",
  "statistics": "position-metrics",
  "role-comparison": "role-comparison",
  "top-summary": "top-summary",
  "bottom-summary": "bottom-summary",
  "attacker-summary": "attacker-summary",
  "defender-summary": "defender-summary",
  "progress": "progress-markers",
  "integration": "position-integration",
  "sources": "sources",
  "related": "related related-content related-positions related-submissions related-techniques related-systems techniques from-positions",
}).flatMap(([type, ids]) => ids.split(" ").map(id => [id, type])));
const SECTION_ORDER = ["videos", "overview", "principles", "recognition", "setup", "prerequisites", "options", "safety", "mistakes"];
function eye(shown) {
  const span = element("span", { "aria-hidden": "true", class: "ng-section-eye" });
  span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>' + (shown ? "" : '<path d="m3 3 18 18"/>') + '</svg>';
  return span;
}

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
  const paneCamera = app._paneCameraTarget;
  app._paneCameraTarget = function (target) { return reader.frameCamera(paneCamera.call(this, target)); };
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
  const execution = app.executionCard;
  app.executionCard = function (opt) {
    const card = execution.call(this, opt), row = this.optionsRef.current;
    if (card && row?.parentElement === reader.game) {
      const shown = this._optionCards.find(c => c.opt === opt).card;
      // Escape owns the reservation's lifetime (arrival, resize or deliberate
      // reading). Native flow carries measured row/height instead of a fixed
      // preview push, including the selected card's group-label clearance.
      const box = row.getBoundingClientRect(), game = reader.game.getBoundingClientRect();
      card.style.marginTop = shown.getBoundingClientRect().top - box.top - parseFloat(getComputedStyle(row).paddingTop) + "px";
      card._ngDock.bottom = window.innerHeight - box.bottom;
      card._ngDock.reader = { rowTop: box.top - game.top, height: game.height };
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
    app[name] = function (...args) { const result = original.apply(this, args); reader.layout(); return result; };
  }
  const scroll = app._readApply;
  app._readApply = function (...args) { const result = scroll.apply(this, args); reader.layout(); return result; };
  const pageDeck = app._updateLandDeck;
  app._updateLandDeck = function (...args) {
    const result = pageDeck.apply(this, args);
    if (reader.gamePage != null && this._landPage != null && reader.gamePage !== this._landPage) reader.root.scrollTop = 0;
    reader.gamePage = this._landPage;
    return result;
  };
  const readKey = app._readKey;
  app._readKey = function (event) { return reader.gameKey(event) || readKey.call(this, event); };
  reader.shelf();
}

class Reader {
  constructor(app) {
    this.app = app;
    this.cache = new Map();
    this.serial = 0;
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
    this.game.append(this.mediaHome);
    this.articleEl = element("div", { class: "ng-reader-article" });
    this.root.append(this.game, this.articleEl);
    this.gameHomes = new Map();
    this.sections = [];
    app.wrapRef.current.append(this.root);
    for (const type of ["wheel", "touchstart", "pointerdown", "focusin"]) {
      this.root.addEventListener(type, (event) => {
        // Paging can replace the target before this event bubbles. Its original
        // path still identifies game input, even after that target is detached.
        if (event.composedPath().includes(this.game)) return;
        // Toolbar activation has its own intent. Native text selection and prose
        // focus count as reading before the question clock gets another frame.
        if (type === "wheel" || type === "touchstart" || !event.target.closest(".ng-reader-tools,.ng-reader-roles")) this.readingInteraction(type);
        event.stopPropagation();
      }, { passive: true });
    }
    this.root.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" && !event.composedPath().includes(this.game)) { this.readingInteraction(); event.stopPropagation(); }
    });
    this.root.addEventListener("click", (event) => this.link(event));
    this.root.addEventListener("scroll", () => this.layout(), { passive: true });
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
    if (this.path !== path) {
      if (this.app._landFilmEl?.dataset.referenceFilm) this.app._clearLandFilm();
      this.place(this.mediaHome); this.media = null; this.root.scrollTop = 0;
    }
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
    if (this.contents) this.contents.hidden = true;
    this.place(this.mediaHome);
    this.sections = []; this.mediaSlot = null;
    this.articleEl.replaceChildren(element("p", { role: "status" }, "Loading the complete article…"));
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
      if (serial !== this.serial || this.app.__ngDestroyed) return;
      this.render(record.title, guide, guidePath, context, hub);
      this.root.dataset.readerReady = "true";
      this.sync();
      if (url.hash) this.anchor(url.hash);
      else if (this.interacting) this.root.querySelector("h1").focus({ preventScroll: true });
    } catch (error) {
      if (serial !== this.serial || error.name === "AbortError" || this.app.__ngDestroyed) return;
      this.articleEl.replaceChildren(element("p", { role: "alert" }, error.message),
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
    const base = new URL(path, location.origin);
    // Source pages sometimes repeat a section's id on its heading. Each clone id
    // is unique, and heading links resolve within this article, never the hidden DOM.
    article.querySelectorAll("[id]").forEach((node, index) => {
      const id = node.id, mapped = "reader-" + this.serial + "-" + kind + "-" + index;
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
    // The media owner supplies one live host; article extraction never creates
    // another player. Retain all authored prose, credits and source destinations.
    article.querySelectorAll("iframe").forEach((frame) => {
      const source = frame.getAttribute("src"), parent = frame.parentElement;
      // Seatless pages have no landing dossier. Adapt their published embeds to
      // the SAME media owner before retiring the source player, including clips
      // in Learning/System pages. No game seat or second playback path is made.
      if (/^\/(Principles|Learning|Systems)\//.test(path) && source) {
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
    if (this.head) { this.resize.unobserve(this.head); this.head.remove(); }
    this.articleEl.replaceChildren();
    const head = this.head = element("header", { class: "ng-reader-head" });
    const heading = element("h1", { tabindex: "-1" }, title);
    const tools = this.tools = element("div", { class: "ng-reader-tools" });
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

    }
    body.append(this.article(record, path, "guide"));
    this.splitSections(body);
    this.contents?.remove();
    const contents = this.contents = this.app._readerTocEl = element("nav", { class: "ng-reader-toc", "aria-label": "Table of contents", id: "reader-contents", hidden: "" });
    // Ambient state (z:6), outside the native scrollport. Its inline hit surface
    // is named separately in attachInput: pointerdown must not capture the wrap.
    contents.style.pointerEvents = "auto";
    contents.addEventListener("click", event => this.link(event));
    for (const type of ["wheel", "touchstart", "focusin"]) contents.addEventListener(type, event => {
      this.readingInteraction(); event.stopPropagation();
    }, { passive: true });
    contents.addEventListener("keydown", event => { if (event.key !== "Escape") event.stopPropagation(); });
    contents.append(element("h2", {}, "Contents"));
    for (const section of this.sections) {
      const row = element("div", { class: "ng-reader-toc-row", "data-toc-section": section.id });
      const link = element("a", { href: "#" + section.id, "data-section-link": section.id, "aria-label": "Go to " + section.title }, section.title);
      link.style.pointerEvents = "auto";
      const toggle = button("", () => this.toggleSection(section.type), { "data-toc-eye": section.type, "aria-controls": section.body.id });
      row.append(link, toggle); contents.append(row); section.row = row; section.eye = toggle;
    }
    contents.append(button("Section settings", () => this.app.openSettings("rolling"), { "data-section-settings": "" }));
    this.resize.observe(head);
    this.articleEl.append(head, body);
    this.app.wrapRef.current.append(contents);
    this.syncSections();
  }
  splitSections(body) {
    const parts = [];
    for (const article of [...body.children]) {
      if (!article.matches("article")) continue;
      const flat = [];
      const walk = (node) => {
        if (node.nodeType === 1 && node.matches("main.content-wrapper,main.system-guide,.learning-reader")) [...node.childNodes].forEach(walk);
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
    const buckets = new Map(), position = /^\/Positions\//.test(this.path), transition = /^\/Transitions\//.test(this.path);
    const defender = /\/Defender$/.test(this.path), bottom = /\/Bottom$/.test(this.path), reference = /^\/(Learning|Systems)\//.test(this.path);
    const labels = Object.fromEntries(SECTION_TYPES);
    labels.recognition = transition ? "Recognize the transition" : "Recognize the attack";
    labels.setup = transition ? "Set up the transition" : "Set up the attack";
    if (/^\/Systems\//.test(this.path)) labels.prerequisites = "Is this for you?";
    labels.options = /^\/Systems\//.test(this.path) ? "Coverage and limits" : position ? "Decisions from " + (bottom ? "bottom" : "top") : defender ? "Defensive options" : transition ? "Execution and counters" : /^\/Submissions\//.test(this.path) ? "Attacking options" : /^\/Learning\//.test(this.path) ? "In practice" : "Applications";
    let ordinal = 0;
    for (const part of parts) {
      const n = part.node, heading = n.nodeType === 1 && n.querySelector("h2,h3,summary"), id = n.dataset?.sourceId || "";
      let type = SECTION_IDS[id], title;
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
      if (type === "prerequisites" && !position && /^\/(Submissions|Transitions)\//.test(this.path)) type = "setup";
      const key = type === "additional" ? type + "-" + ordinal++ : type;
      title = type === "additional" ? heading.textContent.trim() : labels[type];
      if (!buckets.has(key)) buckets.set(key, { type, title, parts: [] });
      buckets.get(key).parts.push(part);
    }
    if (this.referenceClips.length && !buckets.has("videos")) buckets.set("videos", { type: "videos", title: "Videos", parts: [] });
    const ordered = [...buckets.values()].sort((a, b) => {
      const rank = x => SECTION_ORDER.includes(x.type) ? SECTION_ORDER.indexOf(x.type) : x.type === "related" ? 100 : x.type === "sources" && reference ? 101 : 50;
      return rank(a) - rank(b);
    });
    this.sections = []; this.mediaSlot = null;
    body.replaceChildren();
    ordered.forEach((group, index) => {
      const id = "reader-section-" + this.serial + "-" + index;
      const card = element("section", { class: "ng-section-card", "data-section-type": group.type, id });
      const heading = element("h2", { id: id + "-title" });
      const toggle = button("", () => this.toggleSection(group.type), { "data-section-toggle": group.type, "aria-controls": id + "-body" });
      toggle.append(element("span", {}, group.title), eye(true)); heading.append(toggle);
      const content = element("div", { class: "ng-section-body", id: id + "-body" });
      if (group.type === "videos") { this.mediaSlot = element("div", { "data-reader-media-slot": "" }); content.append(this.mediaSlot); }
      for (const part of group.parts) {
        const fragment = element("article", { "data-reader-article": part.source.dataset.readerArticle, "data-source-path": part.source.dataset.sourcePath });
        if (!ROLES.test(this.path) && group.parts.some(p => p.source.dataset.readerArticle !== part.source.dataset.readerArticle)) {
          fragment.append(element("p", { class: "ng-section-provenance" }, part.source.dataset.readerArticle === "hub" ? "Shared overview" : pathRole(part.source.dataset.sourcePath)));
        }
        // Keep authored headings, anchors and complete safety text in the source
        // fragment. The new heading supplies the visible semantic group title.
        const sourceHeading = part.node.nodeType === 1 && part.node.querySelector("h2");
        if (sourceHeading && group.parts.length === 1) sourceHeading.classList.add("ng-section-source-title");
        fragment.append(part.node); content.append(fragment);
      }
      card.setAttribute("aria-labelledby", heading.id); card.append(heading, content); body.append(card);
      this.sections.push({ ...group, id, card, body: content, toggle });
    });
  }
  toggleSection(type, shown = !sectionShown(this.app, type)) {
    this.readingInteraction();
    this.app.set("readerSection." + type, shown);
    this.sync();
  }
  syncSections() {
    for (const s of this.sections) {
      const shown = sectionShown(this.app, s.type), focused = !shown && s.body.contains(document.activeElement);
      if (s.type === "videos" && !shown && !s.body.hidden) this.app.pauseLandFilm();
      s.card.dataset.collapsed = String(!shown); s.body.hidden = !shown; s.body.inert = !shown;
      s.row?.setAttribute("data-collapsed", String(!shown));
      for (const b of [s.toggle, s.eye]) {
        // Focus can enter reading between pointerdown and click. Replacing that
        // unchanged SVG detaches the mouse target and loses its first activation.
        if (!b || b.getAttribute("aria-expanded") === String(shown)) continue;
        b.setAttribute("aria-expanded", String(shown)); b.setAttribute("aria-label", (shown ? "Hide " : "Show ") + s.title);
        const old = b.querySelector(".ng-section-eye");
        if (old) old.replaceWith(eye(shown)); else b.append(eye(shown));
      }
      if (focused) s.toggle.focus({ preventScroll: true });
    }
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
      const section = this.sections.find(s => s.id === link.dataset.sectionLink);
      if (section) this.scrollTo(section.toggle);
      return;
    }
    if (CONTENT.test(url.pathname) || !/\.[a-z0-9]+$/i.test(url.pathname)) {
      event.preventDefault(); this.app._readArticle(url.pathname + url.search + url.hash);
    }
  }
  anchor(hash, scope = this.root) {
    const id = decodeURIComponent(hash.replace(/^#/, ""));
    const fragments = scope.dataset?.sourcePath ? [...this.root.querySelectorAll("article[data-source-path]")].filter(a => a.dataset.sourcePath === scope.dataset.sourcePath) : [scope];
    const node = fragments.map(f => f.querySelector('[data-source-id="' + CSS.escape(id) + '"]')).find(Boolean);
    if (!node) return;
    node.tabIndex = -1;
    const section = node.closest(".ng-section-card");
    this.scrollTo(section?.dataset.collapsed === "true" || node.classList.contains("ng-section-source-title") ? section.querySelector("[data-section-toggle]") : node);
    history.replaceState({ ...history.state, ngReading: !!this.intent }, "", this.path + hash);
  }
  scrollTo(node) {
    this.root.scrollTop += node.getBoundingClientRect().top - this.root.getBoundingClientRect().top - 6;
    node.focus({ preventScroll: true });
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
    if (part === "film" && this.wantsMedia()) return sectionShown(this.app, "videos");
    if (part === "film") return this.app.get("landFilm", true) !== false;
    if (part === "book") return this.app.get("readerBook", true) !== false;
    return this.app.get((this.app.get("readingFocus", false) ? READ_KEYS : GAME_KEYS)[part], true) !== false;
  }
  toggle(part) {
    const a = this.app, on = !this.on(part);
    if (part === "film" && this.wantsMedia()) { this.toggleSection("videos", on); return; }
    if (part === "book") { if (!on) a.pauseLandFilm(); a.set("readerBook", on); }
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
    const book = this.on("book"), wasHidden = this.articleEl.hidden;
    if (!book && !wasHidden) this.bookScroll = this.root.scrollTop;
    this.articleEl.hidden = !book;
    if (!book && this.contents) this.contents.hidden = true;
    const head = this.root.querySelector(".ng-reader-head"); if (head) head.hidden = !this.on("book");
    const expanded = !!(this.interacting && !this.selecting);
    this.root.toggleAttribute("data-reading-expanded", expanded);
    for (const ref of [a.nodeCardRef]) ref.current?.setAttribute("data-reader-map", "");
    for (const ref of [a.evCenterRef, a.fxRef]) ref.current?.setAttribute("data-reader-feedback", "");
    wrap.classList.toggle("ng-reader-dormant", !!this.intent);
    const map = this.on("map");
    if (!map) a._cancelGraphInput?.();
    else if (wrap.classList.contains("ng-reader-no-map")) this.lightReference();
    wrap.classList.toggle("ng-reader-no-map", !map);
    wrap.classList.toggle("ng-reader-no-feedback", !this.on("feedback"));
    a.__ngRoot?.classList.toggle("ng-reader-no-feedback", !this.on("feedback"));
    this.syncMedia();
    this.syncSections();
    this.shelf();
    if (book && wasHidden && this.bookScroll != null) this.root.scrollTop = this.bookScroll;
  }
  wantsMedia() { return this.on("book") && !!(this.intent || this.interacting); }
  ownsMedia(host = this.app._landFilmEl) { return !!host && host.parentElement === this.mediaSlot; }
  placesMedia(host = this.app._landFilmEl) { return !!host && (host.parentElement === this.mediaSlot || host.parentElement === this.mediaHome); }
  // Today's autoplay player needs an explicit way to resume after suspension.
  // Keep this presentation deferred; pauseLandFilm remains the owner's API.
  resumeFilm(card) {
    if (card.querySelector("[data-film-resume]")) return;
    const a = this.app;
    const play = button("Play", () => {
      if (card._mediaStale) { const clip = card._mediaClip; a.collapseClip(card); a.expandClip(card, clip); }
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
    if (wants && correct) this.place(this.mediaSlot);
    else this.place(this.mediaHome);
    if (host) host.hidden = this.wantsMedia() ? !correct : !a.get("landFilm", true);
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
    const end = Math.max(0, card.offsetTop + card.offsetHeight + 12 - this.root.clientHeight);
    this.root.scrollTop = event.key === "Home" ? 0 : event.key === "End" ? end : Math.max(0, Math.min(end, this.root.scrollTop + this.root.clientHeight * .85 * (event.key === "PageUp" ? -1 : 1)));
    event.preventDefault();
    return true;
  }
  layout() {
    if (this.layoutFrame || this.app.__ngDestroyed) return;
    this.layoutFrame = requestAnimationFrame(() => { this.layoutFrame = 0; this.layoutNow(); });
  }
  layoutNow() {
    if (!this.dock || this.app.__ngDestroyed || this.app._readerPress || this.laying) return;
    this.laying = true;
    const style = (el, key, value, priority = "") => {
      const old = el.style.getPropertyValue(key);
      const same = old === value || old.endsWith("px") && value.endsWith("px") && Math.abs(parseFloat(old) - parseFloat(value)) < 1 / 64;
      if (!same || el.style.getPropertyPriority(key) !== priority) el.style.setProperty(key, value, priority);
    };
    try {
      const a = this.app, H = window.innerHeight, W = window.innerWidth, free = a._paneLayout();
      const width = Math.max(240, Math.min(680, free.width - 24));
      style(this.dock, "left", free.center + "px"); style(this.dock, "max-width", Math.min(width, W - 16) + "px");
      style(this.dock, "bottom", a._readerShelfBottom(this.dock.getBoundingClientRect()) + "px");
      const head = this.head, available = this.on("book");
      const ownTop = Math.max(68, (a.wrapRef.current.querySelector(".ng-logo")?.getBoundingClientRect().bottom || 0) + 12);
      // Without chrome (including a null return on reference pages), the entire
      // head belongs before the article, never over the map. Chrome positions
      // the SAME head in its header row; phone tools remain in the article.
      // headBottom replaces ownTop only. Keep the node band/gameTop and add
      // offset before the fit clamp: there is no map-band head reservation.
      // Optional bottomReserve already includes the live shelf, its clearance
      // and the 8px flow gap; do not subtract any of those a second time.
      let chrome = typeof a.readerChromeFrame === "function" ? a.readerChromeFrame(head) : null;
      if (head) {
        const parent = chrome ? this.root : this.articleEl, toolsParent = chrome && W <= 640 ? this.articleEl : head;
        let moved = false;
        if (head.parentElement !== parent) { parent.prepend(head); moved = true; }
        if (this.tools.parentElement !== toolsParent) { toolsParent.prepend(this.tools); moved = true; }
        // Re-measure once after changing homes, not on every observer callback.
        if (chrome && moved) chrome = a.readerChromeFrame(head);
        if (!chrome) {
          head.removeAttribute("data-chrome-head");
          if (head.hasAttribute("style")) head.removeAttribute("style");
        }
      }
      const top = chrome ? chrome.headBottom : ownTop;
      const end = chrome?.bottomReserve != null ? H - chrome.bottomReserve : this.dock.getBoundingClientRect().top - 8;
      for (const [key, value] of Object.entries({ left: "0px", top: top + "px", width: W + "px", height: Math.max(80, end - top) + "px" })) style(this.root, key, value);
      this.articleEl.hidden = !available;
      // Contents never participates in the column's width or centre calculation.
      style(this.articleEl, "width", Math.min(680, free.width - 24) + "px");
      style(this.articleEl, "margin-left", Math.max(12, free.center - parseFloat(this.articleEl.style.width) / 2) + "px");
      if (this.contents) {
        const edge = a.accountRef?.current?.getBoundingClientRect(), inset = edge?.width ? Math.max(0, W - edge.right) : 24;
        const tocWidth = parseFloat(getComputedStyle(this.contents).width);
        const fits = W > 640 && H > 500 && W - inset - this.articleEl.getBoundingClientRect().right >= tocWidth + 12;
        this.contents.hidden = !available || this.root.dataset.readerReady !== "true" || !fits;
        for (const [key, value] of Object.entries({ right: inset + "px", top: top + "px", "max-height": Math.max(44, end - top) + "px" })) style(this.contents, key, value);
      }
      const reference = /^\/(Principles|Learning|Systems)\//.test(this.path || "");
      this.root.toggleAttribute("data-reference", reference);
      this.root.hidden = !available && reference;
      if (reference) { this.restoreGame(); return; }
      const card = a._landEl, row = a.optionsRef.current, showCard = card && this.on("card"), showHand = row && a._handShown();
      const moved = (el, key) => {
        if (!el) return;
        if (!this.gameHomes.has(el)) {
          const keys = ["position", "left", "right", "top", "bottom", "transform", "width", "height"];
          this.gameHomes.set(el, { parent: el.parentElement, next: el.nextSibling, styles: keys.map(k => [k, el.style.getPropertyValue(k), el.style.getPropertyPriority(k)]) });
          // A choice can execute before the deferred reader adopts the hand.
          // Translate its fixed rectangle once into the native flow.
          const dock = el === row && a._executionDock();
          if (dock) {
            const box = el.getBoundingClientRect(), top = this.game.getBoundingClientRect().top;
            dock.reader = { rowTop: box.top - top, height: box.bottom - top };
          }
          this.game.append(el); el.setAttribute("data-reader-game-part", key);
          this.resize.observe(el);
        }
      };
      // A native scrollport contains the actual, already-dealt controls. Their
      // handlers, question/answer state and row order are never reconstructed.
      const oldTop = card && !this.gameHomes.has(card) ? card.getBoundingClientRect().top :
        showHand && !this.gameHomes.has(row) ? row.getBoundingClientRect().top : null;
      // Keep the node-band reservation through navigation. A new card can be
      // adopted before its article arrives; resetting here would jump it to 64px.
      if (this.gameTop == null && oldTop > 0) this.gameTop = Math.max(64, oldTop - ownTop);
      const gap = showCard && showHand ? card.classList.contains("ng-land-deck") ? 16 : a.isMobile() ? 8 : 12 : 0;
      const homeMedia = this.media?.parentElement === this.mediaHome && !this.media.hidden;
      let start = Math.max(6, showCard || showHand || homeMedia ? this.gameTop ?? 64 : 0);
      if (chrome) start += chrome.offset;
      moved(card, "card"); moved(row, "hand");
      const position = (el, x, y, w) => {
        for (const [key, value] of Object.entries({ position: "absolute", left: x + "px", right: "auto", top: y + "px", bottom: "auto", transform: "none" })) style(el, key, value, "important");
        if (w != null) style(el, "width", w + "px", "important");
      };
      if (this.mediaHome.hidden !== !homeMedia) this.mediaHome.hidden = !homeMedia;
      // Keep the deck's 44px outside arrows plus 8px clearance. The left arrow
      // lives in the 60px media gap; the right arrow also fits inside the pane.
      const beside = homeMedia && showCard && free.width >= 400 + 60 + 390 + 52 && H > 500;
      const mediaLayout = homeMedia ? beside ? "side-by-side" : "stacked" : "none";
      if (this.game.dataset.mediaLayout !== mediaLayout) this.game.dataset.mediaLayout = mediaLayout;
      if (card) {
        const deck = card.classList.contains("ng-land-deck");
        style(card, "width", Math.min(beside ? 390 : deck ? 560 : 520, free.width - (deck && !beside ? 104 : 32)) + "px", "important");
      }
      const mediaWidth = Math.min(400, free.width - 32), cardWidth = card?.getBoundingClientRect().width || 0;
      style(this.mediaHome, "width", mediaWidth + "px", "important");
      // Videos supplies its natural content height (A: ~241px desktop, ~220px
      // phone). Measuring the shared host keeps its future renderer independent.
      const mediaHeight = homeMedia ? a.currentFilmHeight?.() ?? this.media.getBoundingClientRect().height : 0;
      const cardHeight = showCard ? card.getBoundingClientRect().height : 0, handHeight = showHand ? row.getBoundingClientRect().height : 0;
      const stageHeight = beside ? Math.max(cardHeight, mediaHeight) : cardHeight + mediaHeight + (homeMedia && showCard ? 12 : 0);
      start = Math.max(6, Math.min(start, end - top - stageHeight - gap - handHeight - (available ? 64 : 0)));
      const groupLeft = free.center - (mediaWidth + 60 + cardWidth + 52) / 2;
      if (homeMedia) position(this.mediaHome, beside ? groupLeft : free.center - mediaWidth / 2, start + (beside ? (stageHeight - mediaHeight) / 2 : 0), mediaWidth);
      const cardX = beside ? groupLeft + mediaWidth + 60 : Math.max(a.isMobile() ? 10 : 16, free.center - cardWidth / 2);
      const cardY = start + (beside ? stageHeight - cardHeight : homeMedia ? mediaHeight + 12 : 0);
      if (card) position(card, cardX, cardY);
      const handoff = a._executionDock()?.reader;
      const rowTop = handoff?.rowTop ?? start + stageHeight + gap;
      if (row) position(row, 0, rowTop, W);
      for (const [el, key] of [[a._landStackEl, "stack"], [a._landNavEl, "nav"]]) {
        if (el && card) { moved(el, key); position(el, cardX, cardY, cardWidth); style(el, "height", cardHeight + "px"); }
      }
      if (a._landNavEl && showCard) {
        // Long answers keep their outside arrows beside the visible face.
        const cardTop = top + cardY - this.root.scrollTop;
        const middle = (Math.max(top, cardTop) + Math.min(end, cardTop + cardHeight)) / 2 - cardTop;
        style(a._landNavEl, "--guide-y", Math.max(22, Math.min(cardHeight - 22, middle)) + "px");
      }
      style(this.game, "height", (handoff?.height ?? rowTop + handHeight) + "px");
      style(this.articleEl, "margin-top", "6px");
      this.trayBottom = H - end + 12 + Math.min(128, H * .15);
      this.cardBottom = this.trayBottom;
      for (const [el] of this.gameHomes) if (!el.isConnected) { this.resize.unobserve(el); this.gameHomes.delete(el); }
    } finally { this.laying = false; }
  }
  frameCamera(target) {
    // Undo only this reader's previous correction. Keep it out of _paneFraction:
    // pane insets are applied after easing, but an occupied-area move must fly.
    target = { ...target, cx: target.cx + (target._tocFraction || 0) * target.vw, _tocFraction: 0 };
    const a = this.app, n = a.nodes?.[a.focusIdx], toc = this.contents;
    if (!n || !a._LY || !toc || toc.hidden || !this.on("map")) return target;
    const W = a.W, H = a.H, scale = W / target.vw, mid = a.pairMid(n);
    const pair = [n, n.pi >= 0 ? a.nodes[n.pi] : null].filter(Boolean);
    const k = Math.max(.4, Math.min(1, target.vw / (a.graphW * .5)));
    const half = Math.max(...pair.map(q => a._nodeHalfW(q, scale, k, a._lodK ?? 1)));
    const x = W / 2 + (mid.x - target.cx) * scale;
    const ys = pair.map(q => H / 2 + (a._LY(q) - target.cy) * scale);
    const top = Math.min(...ys) - half - 32, bottom = Math.max(...ys) + half + 32;
    const left = x - half, right = x + half + 11 + a._labelWidthPx(n);
    // Only camera space is excluded: the article's own centre never depends on
    // the TOC. Once the article covers the node band, use a fitting side gutter.
    const occupied = [toc, this.articleEl].map(el => el.getBoundingClientRect())
      .filter(r => r.width && r.top < bottom && r.bottom > top).sort((a, b) => a.left - b.left);
    // A deliberate view can leave the current node off-screen. Exclude actual
    // intersections; bringing that node back would steal the selected subject.
    if (!occupied.some(r => r.left < right && r.right > left)) return target;
    let edge = a._paneLayout().left + 12;
    const gaps = [];
    for (const r of occupied) { gaps.push([edge, r.left - 12]); edge = Math.max(edge, r.right + 12); }
    gaps.push([edge, W - 12]);
    const shifts = gaps.filter(([l, r]) => r - l >= right - left)
      .map(([l, r]) => Math.max(l - left, Math.min(0, r - right)));
    // An exceptionally long name may not fit either article gutter. It can sit
    // behind the article, but never under the controls. Preserve its full name.
    const shift = shifts.length ? shifts.sort((a, b) => Math.abs(a) - Math.abs(b))[0]
      : Math.min(0, toc.getBoundingClientRect().left - 12 - right);
    return { ...target, cx: target.cx - shift / scale, _tocFraction: shift / W };
  }
  destroy() {
    cancelAnimationFrame(this.layoutFrame);
    this.place(this.mediaOrigin); this.restoreGame();
    this.abort?.abort(); this.resize.disconnect(); this.root.remove(); this.dock?.remove(); this.contents?.remove();
    this.app._readerTocEl = null;
    document.removeEventListener("pointerup", this.selectionEnd);
    this.app.wrapRef.current?.classList.remove("ng-reader-dormant", "ng-reader-no-map", "ng-reader-no-feedback");
    this.app.__ngRoot?.classList.remove("ng-reader-no-feedback");
  }
}
