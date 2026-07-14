class Component extends DCLogic {
  canvasRef = React.createRef();
  wrapRef = React.createRef();
  loaderRef = React.createRef();
  evRef = React.createRef();
  evKickerRef = React.createRef();
  evTextRef = React.createRef();
  optionsRef = React.createRef();
  fxRef = React.createRef();
  drillRef = React.createRef();
  drillTitleRef = React.createRef();
  drillHeadRef = React.createRef();
  drillListRef = React.createRef();
  drillFootRef = React.createRef();
  drillCountRef = React.createRef();
  drillTabRef = React.createRef();
  drillTabSubRef = React.createRef();
  drillTabShortRef = React.createRef();
  // (short label is single-line; see updateDrillTab)
  drillTabTitleRef = React.createRef();
  drillTabIconRef = React.createRef();
  legendMarkRef = React.createRef();
  legendPointRef = React.createRef();
  legendRef = React.createRef();
  optionHintRef = React.createRef();
  optDetailRef = React.createRef();
  brandFontRef = React.createRef();
  accountRef = React.createRef();
  acctChipRef = React.createRef();
  acctCtaRef = React.createRef();
  acctCloseRef = React.createRef();
  acctSpacerRef = React.createRef();
  menuRef = React.createRef();
  modalRef = React.createRef();
  modalCardRef = React.createRef();
  explorerRef = React.createRef();
  explorerListRef = React.createRef();
  explorerSearchRef = React.createRef();
  dossierRef = React.createRef();
  dossierSheetRef = React.createRef();
  giToggleRef = React.createRef();
  nodeCardRef = React.createRef();
  transportRef = React.createRef();
  playPauseRef = React.createRef();
  evCenterRef = React.createRef();
  evcKickerRef = React.createRef();
  evcTextRef = React.createRef();
  evcSubRef = React.createRef();

  renderVals() {
    return {
      canvasRef: this.canvasRef, wrapRef: this.wrapRef, loaderRef: this.loaderRef,
      evRef: this.evRef, evKickerRef: this.evKickerRef, evTextRef: this.evTextRef,
      optionsRef: this.optionsRef, fxRef: this.fxRef,
      drillRef: this.drillRef, drillTitleRef: this.drillTitleRef, drillHeadRef: this.drillHeadRef, drillListRef: this.drillListRef, drillFootRef: this.drillFootRef, drillCountRef: this.drillCountRef,
      drillTabRef: this.drillTabRef, drillTabSubRef: this.drillTabSubRef, drillTabShortRef: this.drillTabShortRef, drillTabTitleRef: this.drillTabTitleRef, drillTabIconRef: this.drillTabIconRef,
      openDeck: () => this.openHomeToLatest(), closeDeck: () => this.setDeckOpen(false),
      openTerms: () => this.openLegal("terms"), openPrivacy: () => this.openLegal("privacy"),
      statusRef: this.statusRef, legendMarkRef: this.legendMarkRef,
      accountRef: this.accountRef, acctChipRef: this.acctChipRef, acctCtaRef: this.acctCtaRef, openSignup: () => this.openAuth("create"), chipMergeClass: this.deckShown ? "ng-chip-merged" : "", transportRef: this.transportRef, playPauseRef: this.playPauseRef,
      modalRef: this.modalRef, modalCardRef: this.modalCardRef,
      explorerRef: this.explorerRef, explorerListRef: this.explorerListRef, explorerSearchRef: this.explorerSearchRef, dossierRef: this.dossierRef, dossierSheetRef: this.dossierSheetRef, nodeCardRef: this.nodeCardRef, giToggleRef: this.giToggleRef,
      toggleExplorer: () => this.toggleExplorer(), openSearch: () => this.openSearch(),
      legendPointRef: this.legendPointRef, legendRef: this.legendRef, optionHintRef: this.optionHintRef, optDetailRef: this.optDetailRef, brandFontRef: this.brandFontRef,
      scrollOptions: () => { const op = this.optionsRef.current; if (op) this.tweenScroll(op, Math.round(op.clientWidth * 0.62)); },
      toggleMenu: () => this.toggleMenu(), togglePause: () => this.setPaused(!this.paused), resetRoll: () => this.resetRoll(),
      evCenterRef: this.evCenterRef, evcKickerRef: this.evcKickerRef, evcTextRef: this.evcTextRef, evcSubRef: this.evcSubRef,
    };
  }

  componentDidMount() { this.boot(); }
  componentWillUnmount() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    if (this._onWinResize) window.removeEventListener("resize", this._onWinResize);
    if (this._onKey) window.removeEventListener("keydown", this._onKey);
    this.clearTimers();
  }

  // ---------- config ----------
  num(v, d) { const n = parseFloat(v); return isFinite(n) ? n : d; }
  cfg() {
    return {
      signalSpeed: 1, glow: 4.5, decisionTime: 3.4,
      cameraMode: this.props.cameraMode || "Hybrid", showLabels: true,
    };
  }

  // ---------- timers (pause-aware) ----------
  clearTimers() { (this._timers || []).forEach((t) => { if (t.id) clearTimeout(t.id); }); this._timers = []; }
  after(sec, fn) {
    const item = { fn: fn, remaining: sec * 1000, start: performance.now(), id: null };
    const fire = () => { this._timers = (this._timers || []).filter((x) => x !== item); fn(); };
    item._fire = fire;
    if (!this.paused) item.id = setTimeout(fire, item.remaining);
    (this._timers = this._timers || []).push(item);
    return item;
  }
  pauseTimers() {
    for (const it of (this._timers || [])) {
      if (it.id) { clearTimeout(it.id); it.remaining -= (performance.now() - it.start); it.id = null; }
    }
  }
  resumeTimers() {
    for (const it of (this._timers || [])) {
      if (!it.id) { it.start = performance.now(); it.id = setTimeout(it._fire, Math.max(0, it.remaining)); }
    }
  }
  setPaused(p) {
    if (this.paused === p) return;
    this.paused = p;
    if (p) this.pauseTimers(); else this.resumeTimers();
    // freeze/resume the option countdown bars
    const op = this.optionsRef.current;
    if (op) op.querySelectorAll(".ngbar").forEach((b) => { b.style.animationPlayState = p ? "paused" : "running"; });
    const list = this.drillListRef.current;
    if (list) list.querySelectorAll(".ngCurExpire").forEach((w) => { w.style.animationPlayState = p ? "paused" : "running"; });
    if (this._curSetIcon) this._curSetIcon();
    this.updateTransport();
  }
  resetRoll() {
    this.setPaused(false);
    this.startRoll();
  }

  // ---------- color ----------
  lerp3(a, b, t) { return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }; }
  lerpCol(a, b, t) { return this.lerp3(a, b, t); }
  rgba(c, a) { return "rgba(" + (c.r | 0) + "," + (c.g | 0) + "," + (c.b | 0) + "," + a + ")"; }
  domColor(d) {
    const blue = { r: 64, g: 132, b: 255 }, red = { r: 232, g: 64, b: 64 }, mid = { r: 142, g: 142, b: 148 };
    if (d >= 0) return this.lerp3(mid, blue, Math.min(1, d));
    return this.lerp3(mid, red, Math.min(1, -d));
  }
  hex(c) { const h = (x) => ("0" + (x | 0).toString(16)).slice(-2); return "#" + h(c.r) + h(c.g) + h(c.b); }
  ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  // ---------- dominance ----------
  dominance(ty, title) {
    const t = (title || "").toLowerCase();
    const top = /\btop\b/.test(t), bot = /\bbottom\b/.test(t);
    if (ty === "submissions") {
      if (/escape|defen[sc]|survive|prevent|counter|defend/.test(t)) return -0.85;
      return 0.9;
    }
    if (ty === "positions") {
      let m = 0.5;
      if (/mount|back|crucifix|truck|rodeo|mounted/.test(t)) m = 0.8;
      else if (/side control|north.?south|kesa|knee on belly|knee.?ride/.test(t)) m = 0.65;
      else if (/control|headlock|ashi|saddle|honey/.test(t)) m = 0.6;
      else if (/guard|half|butterfly|spider|lasso|de la riva|dlr|x.?guard|worm|z.?guard/.test(t)) m = 0.3;
      else if (/standing|clinch|scramble|neutral|50.?50|double/.test(t)) return 0;
      if (bot) return -m;
      if (top) return m;
      return /guard/.test(t) ? -m * 0.6 : m * 0.7;
    }
    if (/escape|recover|defen[sc]|survive|extract|prevent|posture up|replace guard/.test(t)) return -0.3;
    if (/pass|sweep|take|to back|to mount|to side|to crucifix|to truck|entry|elevator|berimbolo|finish/.test(t)) return 0.35;
    return 0;
  }

  // ---------- boot + data ----------
  async boot() {
    this.canvas = this.canvasRef.current;
    this.ctx = this.canvas.getContext("2d");
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this.wrapRef.current);
    this._onWinResize = () => this.resize();
    window.addEventListener("resize", this._onWinResize);
    this.resize();
    this.attachInput();
    // block pan when interacting with overlay controls
    [this.optionsRef.current, this.drillRef.current, this.drillTabRef.current, this.accountRef.current, this.transportRef.current, this.explorerRef.current, this.optDetailRef.current].forEach((el) => {
      if (el) { el.addEventListener("pointerdown", (e) => e.stopPropagation()); el.addEventListener("wheel", (e) => e.stopPropagation(), { passive: false }); }
    });
    // modal: card blocks pan + wheel; backdrop click closes
    if (this.modalCardRef.current) { this.modalCardRef.current.addEventListener("pointerdown", (e) => e.stopPropagation()); this.modalCardRef.current.addEventListener("wheel", (e) => e.stopPropagation(), { passive: false }); }
    if (this.modalRef.current) this.modalRef.current.addEventListener("pointerdown", (e) => { e.stopPropagation(); this._detailCtx = null; this.setPaused(false); this.closeModal(); });
    const logoEl = this.wrapRef.current.querySelector(".ng-logo");
    if (logoEl) logoEl.addEventListener("pointerdown", (e) => e.stopPropagation());
    // keyboard: "/" or Cmd/Ctrl+K focuses search in the explorer
    this._onKey = (e) => {
      const t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
      if (((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        const el = this.explorerRef.current;
        if (el && el.style.display !== "flex") this.toggleExplorer();
        else { const inp = this.explorerSearchRef.current; if (inp) inp.focus(); }
      } else if (e.key === "Escape") {
        if (this._detailCtx) { e.preventDefault(); this.closeOptionDetail(); return; }
        if (this.closeNodeDossier()) return; // in-node dossier open (desktop) — fly back out
        const sh = this.dossierSheetRef.current;
        if (sh && sh.style.display === "block") { this.closeDossierSheet(); }
        else {
          const el = this.explorerRef.current;
          if (el && el.style.display === "flex") { if (this._dossierIdx != null) this.showExplorerList(); else this.toggleExplorer(); }
        }
      } else if ((e.key === "Enter" || e.key === "x" || e.key === "X") && this._detailCtx && !typing) {
        e.preventDefault(); const ctx = this._detailCtx; this.closeOptionDetail(); ctx.onPick(ctx.opt);
      } else if (!typing && !this._detailCtx && this.deckShown && this._drillView === "home" && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const f = (this._rollFocus == null ? (this.rollLog ? this.rollLog.length - 1 : 0) : this._rollFocus);
        if (e.key === "ArrowUp") this.focusRollItem(f - 1);
        else if (e.key === "ArrowDown") this.focusRollItem(f + 1);
        else { const c = this._focusRow && this._miniReg && this._miniReg[this._focusRow]; if (c) (e.key === "ArrowLeft" ? c.prev() : c.next()); }
      } else if (!typing && !this._detailCtx && this.isDrillOpen() && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        if (e.key === "ArrowLeft") this.drillPrev();
        else if (e.key === "ArrowRight") this.drillNext();
        else if (e.key === "ArrowDown") { if (!this.drillTechNav(1)) { if (!this.revealed) this.drillReveal(); else this.drillGrade(true); } }
        else if (e.key === "ArrowUp") { if (!this.drillTechNav(-1)) { if (this.revealed) this.drillGrade(false); else this.drillReveal(); } }
      } else if ((e.key === " " || e.key === "p" || e.key === "P") && !typing && !this._detailCtx) {
        e.preventDefault();
        if (e.key === " " && this.isDrillOpen()) { if (!this.revealed) this.drillReveal(); else this.drillGrade(true); }
        else if (e.key === " " && this.deckShown && this._drillView === "home" && this._focusRow && this._miniReg && this._miniReg[this._focusRow]) { this._miniReg[this._focusRow].reveal(); }
        else this.setPaused(!this.paused);
      } else if (!typing && /^[1-9]$/.test(e.key) && this._optPick && this._optList && this.get("cardNumbers", true)) {
        const opt = this._optList[parseInt(e.key) - 1];
        if (opt && !(this._detailCtx && this._detailCtx.opt === opt)) { e.preventDefault(); const oc = (this._optionCards || []).find((c) => c.node === opt.node); this.expandOption(opt, this._optPick, oc && oc.card); }
      }
    };
    window.addEventListener("keydown", this._onKey);
    // swipe gestures on the drill panel: left/right = prev/next, down = reveal/got it, up = review again
    const drill = this.drillRef.current;
    if (drill) {
      let sx = 0, sy = 0, st = 0, tracking = false;
      drill.addEventListener("touchstart", (e) => { const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); tracking = true; }, { passive: true });
      drill.addEventListener("touchend", (e) => {
        if (!tracking || !this.isDrillOpen()) { tracking = false; return; }
        tracking = false;
        const t = e.changedTouches[0]; const dx = t.clientX - sx, dy = t.clientY - sy;
        if (Date.now() - st > 700) return;
        if (Math.abs(dx) < 40 && Math.abs(dy) < 40) return;
        if (Math.abs(dx) > Math.abs(dy)) { if (dx < 0) this.drillNext(); else this.drillPrev(); }
        else { if (dy > 0) { if (!this.revealed) this.drillReveal(); else this.drillGrade(true); } else { if (this.revealed) this.drillGrade(false); else this.drillReveal(); } }
      }, { passive: true });
    }
    this.mastered = new Set();
    this.prep = {};
    this.settings = this.settings || {};
    this._loadProgress(); // restore prep / daily history / settings (guest persistence)
    this._initAuth();     // signed-in? real identity + merge-on-pull cloud sync (facade-gated)
    this.paused = false;
    this.applyFont();
    this.updateTransport();
    let data = null;
    for (let attempt = 0; attempt < 5 && !data; attempt++) {
      try {
        const r = await fetch("graph-data.json", { cache: "no-cache" });
        if (r.ok) data = await r.json();
      } catch (e) { /* retry */ }
      if (!data) await new Promise((res) => setTimeout(res, 400));
    }
    if (!data) { console.error("graph load failed after retries"); this._fallbackToLegacy(); return; }
    // ingest can throw on malformed data; the mount try/catch has already returned by now, so
    // guard here too — otherwise the opaque full-screen overlay stays up and HIDES the legacy
    // (SEO) content, defeating the "overlay so legacy always shows" fallback contract.
    try { this.ingest(data); }
    catch (e) { console.error("[neural] ingest failed:", e); this._fallbackToLegacy(); return; }
    // flashcards (13.5MB) load in the BACKGROUND — first paint doesn't wait; the drill panel
    // and odds refresh when the decks land. (fetch literal kept patchable by build.mjs.)
    fetch("flashcards.json", { cache: "no-cache" })
      .then((fr) => (fr.ok ? fr.json() : null))
      .then((j) => { if (j) { this.flashcards = j; this.onFlashcardsReady(); } })
      .catch(() => { /* optional payload */ });
    if (this.loaderRef.current) this.loaderRef.current.style.display = "none";
    this.startLoop();
  }

  // tear the overlay down and hand the page back to the legacy DOM (SEO content stays intact).
  // mirrors the mount-time shim fallback in build.mjs so any boot failure degrades gracefully.
  _fallbackToLegacy() {
    try { const r = this.__ngRoot || document.getElementById("neural-root"); if (r) r.remove(); } catch (e) { /* noop */ }
    try { document.documentElement.dataset.variant = "legacy"; } catch (e) { /* noop */ }
  }

  ingest(data) {
    const idIndex = new Map();
    const nodes = data.nodes.map((n, i) => {
      idIndex.set(n.id, i);
      const dom = (n.s && typeof n.s[0] === "number") ? n.s[0] : this.dominance(n.ty, n.t);
      return { idx: i, id: n.id, x: n.x, y: n.y, t: n.t, ty: n.ty, s: n.s || null, dom, col: this.domColor(dom), deg: 0, lit: -99, posId: n.posId || null, fromPositionId: n.fromPositionId || null, fromRole: n.fromRole || null, cal: n.cal || null, familyHub: n.familyHub || null };
    });
    const adj = nodes.map(() => []);
    const links = [];
    for (const l of data.links) {
      const a = idIndex.get(l.source), b = idIndex.get(l.target);
      if (a == null || b == null || a === b) continue;
      links.push([a, b]); adj[a].push(b); adj[b].push(a); nodes[a].deg++; nodes[b].deg++;
    }
    for (const n of nodes) n.r = 2.0 + Math.min(5.5, Math.sqrt(n.deg) * 0.62);
    // de-overlap: push near-coincident vertices to a minimum gap so close zoom can tell them apart
    for (let it = 0; it < 30; it++) {
      const order = [];
      for (let i = 0; i < nodes.length; i++) if (isFinite(nodes[i].x) && isFinite(nodes[i].y)) order.push(i);
      order.sort((p, q) => nodes[p].x - nodes[q].x);
      let any = false;
      for (let ii = 0; ii < order.length; ii++) {
        const a = nodes[order[ii]];
        for (let jj = ii + 1; jj < order.length; jj++) {
          const b = nodes[order[jj]];
          if (b.x - a.x > 26) break;
          let dx = b.x - a.x, dy = b.y - a.y;
          if (dy > 26 || dy < -26) continue;
          const g = a.r + b.r + 3.5;
          let d = Math.hypot(dx, dy);
          if (d >= g) continue;
          if (d < 0.01) { const th = order[jj] * 2.4; dx = Math.cos(th); dy = Math.sin(th); d = 1; }
          const push = (g - d) / 2 / d;
          a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
          any = true;
        }
      }
      if (!any) break;
    }
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, cx = 0, cy = 0, cnt = 0;
    for (const n of nodes) { if (!isFinite(n.x) || !isFinite(n.y)) continue; cnt++; minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); cx += n.x; cy += n.y; }
    cx = cnt ? cx / cnt : 0; cy = cnt ? cy / cnt : 0;
    if (!isFinite(minX)) { minX = -500; maxX = 500; minY = -500; maxY = 500; }
    let r = 0; for (const n of nodes) { if (!isFinite(n.x) || !isFinite(n.y)) continue; r = Math.max(r, Math.hypot(n.x - cx, n.y - cy)); }

    this.nodes = nodes; this.links = links; this.adj = adj; this._idIndex = idIndex;
    // slug indices for resolving cal.outcomes[].to -> node index. Robust to the layout's
    // nested ids: cal targets use the bare state-machine slug ("rear-triangle/top",
    // "arm-triangle-from-side-control") while nested layout ids are compound
    // ("triangle-control/rear-triangle") or slash-nested ("arm-triangle/from-side-control").
    const posSlugIndex = new Map(), techSlugIndex = new Map();
    const setTech = (k, i, ty) => { if (k && (!techSlugIndex.has(k) || ty === "submissions")) techSlugIndex.set(k, i); };
    for (const n of nodes) {
      if (n.ty === "positions") { if (n.posId) posSlugIndex.set(String(n.posId).toLowerCase(), n.idx); }
      else {
        const tail = (n.id.includes("/") ? n.id.slice(n.id.indexOf("/") + 1) : n.id).toLowerCase();
        setTech(tail, n.idx, n.ty);
        if (tail.includes("/")) setTech(tail.replace(/\//g, "-"), n.idx, n.ty); // hyphenated full-name form (graph.json slug)
      }
    }
    // secondary pass: index nested positions by their bare child slug too (full posId already set,
    // so it wins any collision); recovers targets like "rear-triangle/top" -> the compound node.
    for (const n of nodes) {
      if (n.ty === "positions" && n.posId) {
        const pid = String(n.posId).toLowerCase();
        if (pid.includes("/")) { const bare = pid.slice(pid.lastIndexOf("/") + 1); if (!posSlugIndex.has(bare)) posSlugIndex.set(bare, n.idx); }
      }
    }
    this._posSlugIndex = posSlugIndex; this._techSlugIndex = techSlugIndex;
    this.gcx = cx; this.gcy = cy;
    this.graphW = maxX - minX; this.graphH = maxY - minY; this.graphR = r;
    this.trail = []; this.pulse = null;
    this.focusIdx = -1; this.optionIdxs = [];
    this.camFocus = { x: cx, y: cy };
    this.introDone = false; this.alpha = 0;
    this.uiShift = 0; this.deckShown = false; this.deckReady = false; this.deckOpen = false;
    this.adv = { cur: 50, target: 50, glow: 0, sign: 1, shown: false };
    const vw0 = this.graphW * 2.3;
    this.cam = { cx, cy, vw: vw0, lvw: Math.log(vw0) };
    this.camTarget = { cx, cy, vw: vw0 };
    this.phaseVW = this.graphW * 0.34;
  }

  // ---------- travel primitive ----------
  anim(k, d) { const v = this.props[k]; return v === undefined || v === null ? d : v; }
  startTravel(path, onArrive) {
    this.pulse = { path, seg: 0, t: 0, onArrive, done: false, t0: this.now, tint: this.activeMove ? this.activeMove.col : null };
  }
  flare(idx) { if (this.nodes[idx]) this.nodes[idx].lit = this.now; }
  headPos() {
    const p = this.pulse;
    if (!p) { const n = this.nodes[this.focusIdx] || { x: this.gcx, y: this.gcy }; return { x: n.x, y: n.y, col: { r: 255, g: 255, b: 255 } }; }
    if (p.seg >= p.path.length - 1) { const n = this.nodes[p.path[p.path.length - 1]]; return { x: n.x, y: n.y, col: n.col }; }
    const a = this.nodes[p.path[p.seg]], b = this.nodes[p.path[p.seg + 1]];
    const tt = this.ease(p.t);
    return { x: a.x + (b.x - a.x) * tt, y: a.y + (b.y - a.y) * tt, col: this.lerpCol(a.col, b.col, tt) };
  }
  updateTravel(dt) {
    const p = this.pulse; if (!p || p.done) return;
    // edge anticipation: hold the pulse for a beat while the chosen edge tenses
    if (this.anim("edgeAnticipation", true) && p.seg === 0 && p.t === 0 && this.now - (p.t0 || 0) < 0.38) {
      const h = this.headPos(); this.camFocus = { x: h.x, y: h.y }; return;
    }
    const speedMul = this.cfg().signalSpeed;
    const speed = 175 * speedMul;
    const minSegTime = 0.6 / speedMul;
    let advance = dt, guard = 0;
    while (advance > 0 && p.seg < p.path.length - 1 && guard++ < 40) {
      const a = this.nodes[p.path[p.seg]], b = this.nodes[p.path[p.seg + 1]];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const segTime = Math.max(minSegTime, segLen / speed);
      const left = (1 - p.t) * segTime;
      if (advance >= left) {
        advance -= left; p.t = 0;
        this.trail.push({ a: p.path[p.seg], b: p.path[p.seg + 1], time: this.now, tint: this.anim("pulseTrails", true) ? p.tint : null });
        this.flare(p.path[p.seg + 1]); p.seg++;
      } else { p.t += advance / segTime; advance = 0; }
    }
    const h = this.headPos(); this.camFocus = { x: h.x, y: h.y };
    if (p.seg >= p.path.length - 1 && !p.done) { p.done = true; const cb = p.onArrive; if (cb) this.after(0, cb); }
  }

  // ---------- narrative helpers ----------
  // ---------- player perspective (role = which side YOU play; data stores one canonical node per position with s=[topValue, bottomValue]) ----------
  roleIdx() { return this.playerRole === "bottom" ? 1 : 0; }
  myVal(node) {
    const s = node.s;
    if (Array.isArray(s) && s.length >= 2 && typeof s[this.roleIdx()] === "number") return s[this.roleIdx()];
    return this.playerRole === "bottom" ? -(node.dom || 0) : (node.dom || 0);
  }
  myColor(node) { return this.domColor(this.myVal(node)); }
  signedVal(node) { const v = Math.round(this.myVal(node) * 100); return (v > 0 ? "+" : "") + v; }
  // structural role the PERFORMER of an action ends up in
  performerRole(name, ty) {
    const t = (name || "").toLowerCase();
    if (ty === "submissions") return null; // doesn't change role
    if (/sweep|reversal|come ?up|wrestle ?up|back ?take|take.*back|to mount|to side|to back|to top|pass|stand ?up|get ?up|to knees|kimura trap to/.test(t)) return "top";
    if (/escape|recover|replace guard|retain|guard pull|pull guard|to closed guard|to half guard|to guard|to bottom|shrimp|hip ?escape|underhook recovery|technical stand/.test(t)) return "bottom";
    return null;
  }
  applyRoleByAction(name, ty, performerIsYou) {
    const pr = this.performerRole(name, ty);
    if (!pr) return;
    this.playerRole = performerIsYou ? pr : (pr === "top" ? "bottom" : "top");
  }
  roleLabel() { return this.playerRole === "bottom" ? "Bottom" : "Top"; }
  advLabel(d) {
    if (d >= 0.55) return "Dominant";
    if (d >= 0.18) return "Winning";
    if (d > -0.18) return "Even";
    if (d > -0.55) return "Losing";
    return "In trouble";
  }
  setStatus(node) {
    const val = this.myVal(node);
    const wasShown = this.adv.shown;
    this.adv.target = Math.max(2, Math.min(98, (val + 1) * 50));
    this.adv.shown = true;
    if (!wasShown) this.adv.cur = this.adv.target; // snap on first appearance, glide thereafter
  }
  toneColor(tone) {    return { neutral: "#cfe0ff", info: "#9bb6ff", good: "#7ee0a8", bad: "#ff8b8b", muted: "#8ba0c0" }[tone] || "#cfe0ff";
  }
  splitName(t) {
    const m = (t || "").match(/^(.*?)\s+[Ff]rom\s+(.+)$/);
    return m ? { main: m[1].trim(), from: "from " + m[2].trim() } : { main: t || "", from: "" };  }
  posFamily(t) { return (t || "").replace(/\s+(Top|Bottom)\s*$/i, "").trim(); }
  setEvent(kicker, text, tone) {
    const k = this.evKickerRef.current, t = this.evTextRef.current, box = this.evRef.current;
    if (k) { k.textContent = kicker; k.style.color = this.toneColor(tone); }
    if (t) {
      const sp = this.splitName(text);
      t.innerHTML = sp.from
        ? sp.main + '<div style="opacity:.6;font-weight:500;font-size:.66em;letter-spacing:0;margin-top:3px;">' + sp.from + '</div>'
        : sp.main;
    }
    if (box) box.style.opacity = "1";
  }
  // ---------- drill deck (flashcards) + dominance flash ----------
  deckCat(node) { return node.ty === "positions" ? "Position" : (node.ty === "submissions" ? "Submission" : "Transition"); }
  richContentFor(n) {
    const C = (window.NG_CONTENT && window.NG_CONTENT.decks) || {};
    const rc = C[n.t];
    return (rc && rc.perspectives) ? rc : null;
  }
  splitTo(t) {
    const m = (t || "").match(/^(.*?)\s+to\s+(.+)$/i);
    return m ? { from: m[1].trim(), to: m[2].trim() } : null;
  }
  titleParts(n) {
    const rc = this.richContentFor(n);
    if (rc && rc.from && rc.target) return { from: rc.from, to: rc.target };
    const st = this.splitTo(n.t);
    if (st) return { from: st.from, to: st.to };
    return null;   // no from->to structure; caller renders the plain name
  }
  detailHTML(n, cat, neighbors, persp) {
    const rc = this.richContentFor(n);
    if (rc) return this.richDetailHTML(n, cat, rc, persp || "attacker");
    const C = (window.NG_CONTENT && window.NG_CONTENT.decks) || {};
    // positions are keyed "<fam>|<Role>" (deckKeyFor); techniques are keyed bare "<name>" in
    // NG_CONTENT, so fall back on the full title, not the "<name>|Attacker" deck key.
    const c = n.ty === "positions" ? C[this.deckKeyFor(n).key] : C[n.t];
    this._curClips = null;
    const sec = (label) => '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7b8aa8;font-weight:700;margin:16px 0 9px;">' + label + '</div>';
    const lead = (t) => '<div style="font-size:13.5px;color:#c2ccde;line-height:1.6;">' + t + '</div>';
    const li = (t) => '<div style="display:flex;gap:9px;margin-bottom:7px;"><span style="color:#7e9bff;flex:none;">\u2014</span><span style="font-size:13px;color:#cdd5e6;line-height:1.5;">' + t + '</span></div>';
    if (!c) {
      return lead("A " + cat.toLowerCase() + " from your current position" + (neighbors.length ? ", connecting toward <b style=\"color:#dbe2f0;\">" + neighbors.map((x) => this.splitName(x).main).join("</b>, <b style=\"color:#dbe2f0;\">") + "</b>" : "") + ".") +
        '<div style="margin-top:12px;font-size:12px;color:#7e8aa3;">Full breakdown — definition, key principles, decision tree, common mistakes — is authored on bjjgraph.org. Drill its deck to raise your odds.</div>';
    }
    let h = lead(c.def);
    this._curClips = c.clips || null; h += this.filmStudyHTML(c.clips);
    if (c.steps) { h += sec(cat === "Submission" ? "Finish mechanics" : "How to execute"); c.steps.forEach((s, i) => h += '<div style="display:flex;gap:10px;margin-bottom:7px;"><span style="flex:none;width:18px;height:18px;border-radius:50%;background:rgba(74,108,255,.25);color:#bcd0ff;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</span><span style="font-size:13px;color:#cdd5e6;line-height:1.5;">' + s + '</span></div>'); }
    if (c.principles) { h += sec(cat === "Position" ? "Key principles" : "Details that matter"); c.principles.forEach((p) => h += li(p)); }
    if (c.decisionTree) { h += sec("Decision tree"); c.decisionTree.forEach((d) => { h += '<div style="font-size:12.5px;font-weight:600;color:#dbe2f0;margin:9px 0 5px;">If ' + d.cond + ':</div>'; d.acts.forEach((a) => h += '<div style="display:flex;align-items:center;gap:8px;margin:0 0 4px 10px;"><span style="font-size:12.5px;color:#cdd5e6;flex:1;">' + a[0] + ' <span style="color:#7e8aa3;">\u2192 ' + a[2] + '</span></span><span style="font-size:11.5px;font-weight:700;color:#7ee0a8;">' + a[1] + '%</span></div>'); }); }
    if (c.mistakes) { h += sec("Common mistakes"); c.mistakes.forEach((m) => h += '<div style="margin-bottom:10px;"><div style="font-size:12.5px;color:#e8956b;line-height:1.45;">\u2717 ' + m.err + '</div><div style="font-size:12.5px;color:#7ee0a8;line-height:1.45;margin-top:2px;">\u2713 ' + m.fix + '</div></div>'); }
    if (c.counters) { h += sec("If it stalls"); c.counters.forEach((x) => h += li(x)); }
    if (c.metrics) { h += sec("Numbers"); h += '<div style="display:flex;gap:10px;flex-wrap:wrap;">'; Object.keys(c.metrics).forEach((k) => h += '<div style="flex:1;min-width:90px;background:rgba(255,255,255,.04);border:1px solid rgba(150,170,210,.14);border-radius:9px;padding:9px 11px;"><div style="font-size:15px;font-weight:700;color:#eef1f6;font-family:\'Space Grotesk\',sans-serif;">' + c.metrics[k] + '</div><div style="font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#7e8aa3;font-weight:600;margin-top:2px;">' + k + '</div></div>'); h += '</div>'; }
    if (c.related && c.related.length) {
      h += sec("Related positions");
      h += '<div style="display:flex;flex-wrap:wrap;gap:7px;">';
      c.related.forEach((t) => h += '<span style="font-size:11.5px;color:#aeb9d4;background:rgba(255,255,255,.05);border:1px solid rgba(150,170,210,.14);border-radius:999px;padding:4px 11px;">' + t + '</span>');
      h += '</div>';
    }
    return h;
  }
  richDetailHTML(n, cat, rc, persp) {
    const sec = (label, col) => '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:' + (col || "#7b8aa8") + ';font-weight:700;margin:18px 0 9px;">' + label + '</div>';
    const lead = (t) => '<div style="font-size:13.5px;color:#c2ccde;line-height:1.6;">' + t + '</div>';
    const li = (t, dash) => '<div style="display:flex;gap:9px;margin-bottom:7px;"><span style="color:' + (dash || "#7e9bff") + ';flex:none;">\u2014</span><span style="font-size:13px;color:#cdd5e6;line-height:1.5;">' + t + '</span></div>';
    const steps = (arr) => { let s = ""; arr.forEach((t, i) => s += '<div style="display:flex;gap:10px;margin-bottom:7px;"><span style="flex:none;width:18px;height:18px;border-radius:50%;background:rgba(74,108,255,.25);color:#bcd0ff;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</span><span style="font-size:13px;color:#cdd5e6;line-height:1.5;">' + t + '</span></div>'); return s; };
    const mistakes = (arr) => { let s = ""; arr.forEach((m) => s += '<div style="margin-bottom:10px;"><div style="font-size:12.5px;color:#e8956b;line-height:1.45;">\u2717 ' + m.err + '</div><div style="font-size:12.5px;color:#7ee0a8;line-height:1.45;margin-top:2px;">\u2713 ' + m.fix + '</div></div>'); return s; };

    let h = "";
    const P = rc.perspectives || {};
    const blk = P[persp];
    const isDef = persp === "defender";
    const clips = (blk && blk.clips) || rc.clips || null;
    this._curClips = isDef && (!blk || !blk.authored) ? null : clips;

    if (isDef && (!blk || !blk.authored)) {
      // N=1: do NOT clone the attacker view or fabricate a defender breakdown for unauthored moves.
      h += lead("The defender's breakdown for this transition isn't authored here yet.");
      h += '<div style="margin-top:13px;padding:14px 15px;background:rgba(232,149,107,.08);border:1px solid rgba(232,149,107,.2);border-radius:11px;">' +
        '<div style="font-size:12.5px;color:#e8b89c;line-height:1.5;">We hand-author each defender perspective rather than auto-generating one from the attack &mdash; a real defense is its own technique, not a mirror of the attack. The full escape tree, recognition cues and counters for <b style="color:#f0d2bf;">' + this.splitName(n.t).main + '</b> live on bjjgraph.org.</div>' +
        '<a href="https://bjjgraph.org" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;font-size:12px;font-weight:700;color:#e8956b;text-decoration:none;">Open the full breakdown on bjjgraph.org \u2192</a>' +
        '</div>';
      return h;
    }

    // ----- chosen perspective -----
    if (blk) {
      if (blk.summary) h += lead(blk.summary);
      h += this.filmStudyHTML(this._curClips);
      if (blk.recognition) { h += sec("Recognise it", "#cbd24e"); blk.recognition.forEach((t) => h += li(t, "#cbd24e")); }
      if (blk.prerequisites) { h += sec("Before you start"); blk.prerequisites.forEach((t) => h += li(t)); }
      if (blk.steps) { h += sec("How to execute"); h += steps(blk.steps); }
      if (blk.principles) { h += sec("Key principles"); blk.principles.forEach((t) => h += li(t)); }
      if (blk.options) {
        h += sec("Your options", "#7ee0a8");
        blk.options.forEach((o) => h += '<div style="margin-bottom:9px;padding:10px 12px;background:rgba(255,255,255,.035);border:1px solid rgba(150,170,210,.12);border-radius:10px;">' +
          '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;"><span style="font-size:13px;font-weight:700;color:#dbe2f0;">' + o.move + '</span><span style="flex:none;font-size:10.5px;color:#8b97b0;">' + o.when + '</span></div>' +
          '<div style="font-size:12px;color:#9fb0d0;margin-top:4px;"><span style="color:#7ee0a8;">\u2192</span> ' + o.leadsTo + '</div></div>');
      }
      if (blk.bestOutcomes) { h += sec("Best you can hope for"); blk.bestOutcomes.forEach((t) => h += li(t, "#7ee0a8")); }
      if (blk.counters) { h += sec("If they resist"); blk.counters.forEach((t) => h += li(t)); }
      if (blk.mistakes) { h += sec("Common mistakes"); h += mistakes(blk.mistakes); }
    }

    // ----- common: where it leads -----
    if (rc.outcomes && rc.outcomes.length) {
      h += sec("Where it leads");
      rc.outcomes.forEach((o) => {
        const tc = o.tone === "good" ? "#7ee0a8" : o.tone === "bad" ? "#e8956b" : "#cbd24e";
        h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">' +
          '<div style="flex:none;width:42px;font-size:14px;font-weight:700;color:' + tc + ';font-family:\'Space Grotesk\',sans-serif;">' + o.prob + '%</div>' +
          '<div style="flex:1;min-width:0;"><span style="font-size:13px;color:#dbe2f0;font-weight:600;">' + o.result + '</span>' + (o.position ? '<span style="font-size:11.5px;color:#8b97b0;"> \u00b7 ' + o.position + '</span>' : '') + '</div></div>';
      });
    }
    if (rc.variations && rc.variations.length) { h += sec("Variations"); rc.variations.forEach((t) => h += li(t, "#9b8cff")); }
    if (rc.related && rc.related.length) {
      h += sec("Related");
      h += '<div style="display:flex;flex-wrap:wrap;gap:7px;">';
      rc.related.forEach((t) => h += '<span style="font-size:11.5px;color:#aeb9d4;background:rgba(255,255,255,.05);border:1px solid rgba(150,170,210,.14);border-radius:999px;padding:4px 11px;">' + t + '</span>');
      h += '</div>';
    }
    // SEO / AEO / GEO context — indexable prose, always present on the page
    if (rc.context) h += '<div style="margin-top:20px;padding-top:14px;border-top:1px solid rgba(150,170,210,.1);font-size:12px;color:#8b97b0;line-height:1.6;">' + rc.context + '</div>';
    return h;
  }
  fmtDur(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  filmStudyHTML(clips) {
    if (!clips || !clips.length) return "";
    let h = '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7b8aa8;font-weight:700;margin:20px 0 11px;display:flex;align-items:center;gap:8px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="#e0584f"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>Film study</div>';
    h += '<div class="ng-cliprow" style="display:flex;gap:11px;overflow-x:auto;padding-bottom:6px;">';
    clips.forEach((c, i) => {
      const w = c.vertical ? 126 : 210, ht = 170;
      const dur = (c.end != null && c.start != null) ? this.fmtDur(c.end - c.start) + " \u00b7 loop" : "clip";
      h += '<button class="ng-clip" data-i="' + i + '" style="scroll-snap-align:start;flex:none;position:relative;width:' + w + 'px;height:' + ht + 'px;border-radius:13px;overflow:hidden;border:1px solid rgba(150,170,210,.16);background:#0c0f17;cursor:pointer;padding:0;display:block;transition:width .34s cubic-bezier(.4,0,.2,1),height .34s cubic-bezier(.4,0,.2,1);">' +
        '<img src="https://i.ytimg.com/vi/' + c.id + '/hqdefault.jpg" loading="lazy" referrerpolicy="no-referrer" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.92;transition:transform .4s ease,opacity .3s ease;">' +
        '<span style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,10,16,0) 38%,rgba(8,10,16,.88) 100%);"></span>' +
        '<span class="ngPlay" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:50%;background:rgba(12,14,22,.6);backdrop-filter:blur(3px);border:1.5px solid rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center;transition:transform .2s ease,background .2s ease;"><svg width="15" height="15" viewBox="0 0 24 24" fill="#fff" style="margin-left:2px;"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg></span>' +
        '<span style="position:absolute;top:8px;right:8px;font-size:9px;font-weight:700;color:#eef1f6;background:rgba(8,10,16,.72);border-radius:6px;padding:2px 6px;letter-spacing:.02em;">' + dur + '</span>' +
        '<span style="position:absolute;left:10px;right:10px;bottom:9px;text-align:left;"><span style="display:block;font-size:11.5px;font-weight:700;color:#fff;line-height:1.25;text-shadow:0 1px 6px rgba(0,0,0,.65);">' + c.title + '</span>' + (c.by ? '<span style="display:block;font-size:10px;color:#c3cce0;margin-top:2px;text-shadow:0 1px 5px rgba(0,0,0,.6);">' + c.by + '</span>' : '') + '</span>' +
        '</button>';
    });
    h += '</div>';
    return h;
  }
  clearClipLoops() { if (this._expandedClip) { try { this.collapseClip(this._expandedClip); } catch (e) {} } this._expandedClip = null; }
  expandClip(card, clip) {
    if (!card || !clip) return;
    if (card._expanded) return;
    if (this._expandedClip && this._expandedClip !== card) this.collapseClip(this._expandedClip);
    card._expanded = true; this._expandedClip = card;
    const vertical = !!clip.vertical, start = clip.start || 0, end = clip.end || 0;
    const row = card.parentElement;
    const rw = (row && row.clientWidth) || 460;
    let W, H;
    if (vertical) { H = 460; W = Math.round(H * 9 / 16); const capW = Math.round(rw * 0.7); if (W > capW) { W = capW; H = Math.round(W * 16 / 9); } }
    else { W = Math.min(496, Math.round(rw * 0.96)); H = Math.round(W * 9 / 16); }
    if (!card._bw) { card._bw = card.offsetWidth; card._bh = card.offsetHeight; }
    card.style.cursor = "default";
    const glyph = card.querySelector(".ngPlay"); if (glyph) glyph.style.display = "none";
    card.style.setProperty("width", W + "px", "important"); card.style.setProperty("height", H + "px", "important");
    const ph = document.createElement("div"); ph.className = "ngPlayerHost"; ph.style.cssText = "position:absolute;inset:0;background:#000;z-index:2;";
    const vhost = document.createElement("div"); vhost.style.cssText = "position:absolute;inset:0;";
    const spin = document.createElement("div"); spin.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0c0f17;"; spin.innerHTML = '<span style="width:24px;height:24px;border:2.5px solid rgba(255,255,255,.16);border-top-color:rgba(224,88,79,.9);border-radius:50%;animation:ngSpin .9s linear infinite;"></span>';
    ph.appendChild(vhost); ph.appendChild(spin); card.appendChild(ph);
    const muteBtn = document.createElement("button");
    muteBtn.className = "ngMuteBtn";
    muteBtn.style.cssText = "position:absolute;bottom:9px;right:9px;z-index:6;width:34px;height:34px;border-radius:9px;background:rgba(8,10,16,.72);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.22);color:#eef1f6;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:background .18s ease;";
    const mutedIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
    const onIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"></polygon><path d="M15.5 8.5a5 5 0 0 1 0 7"></path><path d="M19 5a9 9 0 0 1 0 14"></path></svg>';
    let cmuted = true;
    muteBtn.innerHTML = mutedIcon; muteBtn.title = "Unmute";
    muteBtn.addEventListener("mouseenter", () => { muteBtn.style.background = "rgba(224,88,79,.9)"; });
    muteBtn.addEventListener("mouseleave", () => { muteBtn.style.background = "rgba(8,10,16,.72)"; });
    muteBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); const pl = card._player; if (!pl) return; cmuted = !cmuted; if (cmuted) { try { pl.mute(); } catch (x) {} muteBtn.innerHTML = mutedIcon; muteBtn.title = "Unmute"; } else { try { pl.unMute(); pl.setVolume(80); } catch (x) {} muteBtn.innerHTML = onIcon; muteBtn.title = "Mute"; } });
    card.appendChild(muteBtn);
    if (row) { requestAnimationFrame(() => { const target = card.offsetLeft - Math.max(0, (row.clientWidth - card.offsetWidth) / 2); this.tweenScroll(row, Math.round(target - row.scrollLeft)); }); }
    const fail = () => { window.open("https://www.youtube.com/watch?v=" + clip.id + (start ? "&t=" + start + "s" : ""), "_blank", "noopener"); this.collapseClip(card); };
    this.ytApiReady().then((YT) => {
      if (!card._expanded) return;
      if (!YT || !YT.Player) { fail(); return; }
      let started = false;
      const player = new YT.Player(vhost, {
        width: "100%", height: "100%", videoId: clip.id,
        playerVars: { autoplay: 1, mute: 1, controls: 0, disablekb: 1, start: start, end: end || undefined, rel: 0, modestbranding: 1, playsinline: 1, fs: 0, iv_load_policy: 3 },
        events: {
          onReady: (e) => { try { const fr = e.target.getIframe && e.target.getIframe(); if (fr) fr.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture"); e.target.mute(); e.target.seekTo(start, true); e.target.playVideo(); setTimeout(() => { try { e.target.playVideo(); } catch (x) {} }, 220); } catch (x) {} },
          onStateChange: (e) => { if (e.data === 1) { started = true; if (spin) spin.style.display = "none"; } if (e.data === YT.PlayerState.ENDED) { try { e.target.seekTo(start, true); e.target.playVideo(); } catch (x) {} } },
          onError: () => { fail(); }
        }
      });
      card._player = player;
      if (end) { card._loop = setInterval(() => { try { if (player.getCurrentTime && player.getCurrentTime() >= end) player.seekTo(start, true); } catch (x) {} }, 250); }
      setTimeout(() => { if (!started && spin) spin.style.display = "none"; }, 4500);
    });
  }
  collapseClip(card) {
    if (!card) return;
    if (card._loop) { clearInterval(card._loop); card._loop = null; }
    if (card._player) { try { card._player.destroy(); } catch (e) {} card._player = null; }
    const ph = card.querySelector(".ngPlayerHost"); if (ph) ph.remove();
    const mb = card.querySelector(".ngMuteBtn"); if (mb) mb.remove();
    const glyph = card.querySelector(".ngPlay"); if (glyph) glyph.style.display = "";
    if (card._bw) { card.style.setProperty("width", card._bw + "px", "important"); card.style.setProperty("height", card._bh + "px", "important"); }
    card.style.cursor = "pointer";
    card._expanded = false;
    if (this._expandedClip === card) this._expandedClip = null;
  }
  ytApiReady() {
    if (this._ytPromise) return this._ytPromise;
    this._ytPromise = new Promise((resolve) => {
      if (window.YT && window.YT.Player) { resolve(window.YT); return; }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) { try { prev(); } catch (e) {} } resolve(window.YT); };
      if (!document.getElementById("yt-iframe-api")) {
        const s = document.createElement("script"); s.id = "yt-iframe-api"; s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
      }
    });
    return this._ytPromise;
  }
  wireClips(body, clips) {
    if (!clips) return;
    body.querySelectorAll(".ng-clip").forEach((card) => {
      const glyph = card.querySelector(".ngPlay"), img = card.querySelector("img");
      card.addEventListener("mouseenter", () => { if (card._expanded) return; if (img) img.style.transform = "scale(1.05)"; if (glyph) { glyph.style.transform = "translate(-50%,-50%) scale(1.08)"; glyph.style.background = "rgba(224,88,79,.92)"; } });
      card.addEventListener("mouseleave", () => { if (img) img.style.transform = "scale(1)"; if (glyph) { glyph.style.transform = "translate(-50%,-50%) scale(1)"; glyph.style.background = "rgba(12,14,22,.6)"; } });
      card.addEventListener("click", () => this.expandClip(card, clips[+card.getAttribute("data-i")]));
    });
  }
  deckRole(node) {
    if (node.ty === "positions") {
      const rm = (node.t || "").match(/\s+(Top|Bottom)\s*$/i);
      return rm ? (rm[1][0].toUpperCase() + rm[1].slice(1).toLowerCase()) : (this.playerRole === "bottom" ? "Bottom" : "Top");
    }
    return "Attacker"; // you drilling a move = learning to execute it
  }
  deckKeyFor(node) {
    const cat = this.deckCat(node), role = this.deckRole(node);
    // techniques: key by the FULL node title (e.g. "Kimura from Mount"), NOT the display
    // shorthand splitName().main ("Kimura") — the shorthand collapses ~110 distinct origins
    // onto one key and drops the per-origin calibrated content. positions keep posFamily
    // (strips the Top/Bottom role suffix) so the base|Role key matches the emitted decks.
    const fam = node.ty === "positions" ? this.posFamily(node.t) : node.t;
    return { fam: fam, role: role, cat: cat, key: fam + "|" + role };
  }
  stateBonus(key) { return key ? Math.min(0.3, 0.06 * ((this.prep && this.prep[key]) || 0)) : 0; }
  // Cross-variant credit for the blended hierarchy cards: a family/position-tier card is the SAME
  // card duplicated into every variant's deck (identical question). The first time it's answered
  // anywhere, credit every other deck that contains it — so a "Mount principle" mastered while
  // drilling High Mount also counts on S Mount, Technical Mount, base Mount… Role-specific cards
  // are unique to their deck (map entry of one), so nothing changes for them.
  noteCardDone(card, key) {
    const q = card && card.q;
    if (!q) return;
    this._saveProgress(); // persist prep bumps (debounced) even for repeat answers
    this.cardDone = this.cardDone || new Set();
    if (this.cardDone.has(q)) return;          // already credited everywhere
    this.cardDone.add(q);
    { // honest daily counter — cardsToday was read everywhere but never written
      const dk = this._dayKey(); this._days = this._days || {};
      this._days[dk] = (this._days[dk] || 0) + 1; this.cardsToday = this._days[dk];
      this.track("neural_card_answered", { deck_key: key, cards_today: this.cardsToday });
    }
    if (!this._qkDecks) {                      // lazy one-time index: question -> deck keys carrying it
      this._qkDecks = new Map();
      const decks = (this.flashcards && this.flashcards.decks) || {};
      for (const k of Object.keys(decks)) {
        for (const c of decks[k].cards || []) {
          const arr = this._qkDecks.get(c.q);
          if (arr) arr.push(k); else this._qkDecks.set(c.q, [k]);
        }
      }
    }
    const shared = this._qkDecks.get(q);
    if (!shared || shared.length < 2) return;
    const decks = (this.flashcards && this.flashcards.decks) || {};
    this.prep = this.prep || {};
    for (const k of shared) {
      if (k === key) continue;                 // the local deck's own paths already counted it
      const cap = decks[k] && decks[k].cards ? decks[k].cards.length : 0;
      this.prep[k] = Math.min(cap, (this.prep[k] || 0) + 1);
    }
  }
  setDrillHeader(title, sub, countText, role, roleColor) {
    const head = this.drillHeadRef.current; if (!head) return;
    head.innerHTML =
      '<div style="display:flex;align-items:center;height:40px;margin-bottom:12px;">' +
        '<span class="ngBack" style="cursor:pointer;color:#aeb9d2;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;white-space:nowrap;height:30px;padding:0 13px 0 10px;border-radius:9px;background:rgba(255,255,255,.05);transition:background .15s,color .15s;"><span style="font-size:14px;line-height:1;">\u2039</span>All flashcards</span>' +
      '</div>' +
      (role ? '<div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;color:' + (roleColor || "#9fb0d8") + ';margin-bottom:5px;">' + role + '</div>' : '') +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">' +
        '<div style="font-size:19px;font-weight:700;color:#eef1f6;line-height:1.14;letter-spacing:-.01em;text-wrap:balance;">' + title + '</div>' +
        (countText ? '<span style="flex:none;margin-top:3px;font-size:11px;font-weight:700;color:#7ee0a8;letter-spacing:.02em;">' + countText + '</span>' : '') +
      '</div>' +
      (sub ? '<div style="font-size:11.5px;color:#93a0bd;margin-top:7px;line-height:1.45;">' + sub + '</div>' : '');
    head.querySelector(".ngBack").addEventListener("click", () => { this._session = null; this.openMenu(); });
    { const b = head.querySelector(".ngBack"); if (b) { b.addEventListener("mouseenter", () => { b.style.background = "rgba(255,255,255,.09)"; b.style.color = "#eef1f6"; }); b.addEventListener("mouseleave", () => { b.style.background = "rgba(255,255,255,.05)"; b.style.color = "#aeb9d2"; }); } }
  }
  updateDrillCount() {
    const el = this.drillCountRef.current;
    const e = this.drillEntries && this.drillEntries[this.activeDrill];
    const bonus = e ? Math.round(this.stateBonus(e.info.key) * 100) : 0;
    if (el) el.textContent = bonus > 0 ? "+" + bonus + "% odds" : "";
    this.updateDrillTab();
  }
  drillBtn(label, primary) {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = "flex:1;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;padding:9px 8px;border-radius:8px;transition:filter .12s;border:1px solid " + (primary ? "rgba(110,224,168,.5)" : "rgba(150,170,210,.25)") + ";background:" + (primary ? "rgba(60,150,100,.22)" : "rgba(255,255,255,.05)") + ";color:" + (primary ? "#bff0d2" : "#c3cde0") + ";";
    b.addEventListener("mouseenter", () => b.style.filter = "brightness(1.25)");
    b.addEventListener("mouseleave", () => b.style.filter = "none");
    return b;
  }

  buildDrillPanel(posIdx, deckKeyOverride) {
    const decks = (this.flashcards && this.flashcards.decks) || {};
    const entryFor = (node) => {
      const info = this.deckKeyFor(node);
      const d = decks[info.key];
      return { info: info, cards: d ? d.cards.slice() : null };
    };
    let firstEntry;
    if (deckKeyOverride) {
      const fam = deckKeyOverride.split("|")[0], role = deckKeyOverride.split("|")[1] || "Defender";
      const d = decks[deckKeyOverride];
      firstEntry = { info: { fam: fam, role: role, cat: "Defense", key: deckKeyOverride }, cards: d ? d.cards.slice() : null };
    } else {
      firstEntry = entryFor(this.nodes[posIdx]);
    }
    this.drillEntries = [firstEntry];
    this._posKey = this.drillEntries[0].info.key;
    this.activeDrill = 0; this.deckIdx = 0; this.revealed = false;
    this._session = null;
    this._drillView = "home";
    if (this.deckShown) {
      const list = this.drillListRef.current;
      const nearBottom = list ? (list.scrollHeight - list.scrollTop - list.clientHeight < 90) : true;
      const grew = (this._lastHomeRollLen || 0) < (this.rollLog ? this.rollLog.length : 0);
      this.renderDrillHome();
      if (list && grew && nearBottom) requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
    }
    this._lastHomeRollLen = this.rollLog ? this.rollLog.length : 0;
    this.deckReady = true;
    this.updateDrillTab();
    this.applyDeckVisibility(); // hidden by default; tab invites the user to open it
  }

  setDeckOpen(open) {
    if (open && !this.deckOpen) this.track("neural_drill_opened", { deck_key: this._posKey || null });
    this.deckOpen = !!open;       // sticky: once opened it stays open across lands until closed
    this.applyDeckVisibility();
    this.lastInteract = this.now;
  }
  applyDeckVisibility() {
    const open = this.deckReady && this.deckOpen;
    this.deckShown = open;
    const hint = this.optionHintRef.current;
    if (hint && open) { hint.style.opacity = "0"; hint.style.pointerEvents = "none"; }   // hide the scroll hint immediately when the sidebar opens
    const panel = this.drillRef.current;
    if (panel) { panel.style.opacity = open ? "1" : "0"; panel.style.pointerEvents = open ? "auto" : "none"; }
    const tab = this.drillTabRef.current;
    if (tab) { const tv = (this.deckReady && !this.deckOpen) ? "1" : "0"; tab.style.opacity = tv; tab.style.pointerEvents = tv === "1" ? "auto" : "none"; }
    const chip = this.acctChipRef.current;
    if (chip) chip.classList.toggle("ng-chip-merged", open);
    this.forceUpdate();
    this.updateDrillTab();
  }
  updateDrillTab() {
    const sub = this.drillTabSubRef.current; const title = this.drillTabTitleRef.current; const icon = this.drillTabIconRef.current;
    const e0 = this.drillEntries && this.drillEntries[0];
    if (!sub || !e0) return;
    const bonus = Math.round(this.stateBonus(this._posKey) * 100);
    const cards = e0.cards;
    const total = cards ? cards.length : 0;
    const done = Math.min((this.prep && this.prep[this._posKey]) || 0, total);
    let ic = "\u26a1", t1 = "Study this state", t2 = "Flashcards being authored", c1 = "#9ab0e0", c2 = "#c9d3e6", shortLn2 = "Study state", ln2Col = "#c9d3e6";
    const famName = (e0.info && e0.info.fam) || "";
    if (!total && famName) { t1 = famName; t2 = "Cards coming soon"; }
    if (total) {
      t1 = famName || "This position";
      if (done >= total) {
        ic = "\uD83E\uDD47"; t2 = total + "/" + total + " Mastered"; c2 = "#7ee0a8"; shortLn2 = total + "/" + total + " Mastered"; ln2Col = "#7ee0a8";
      } else if (done === 0) {
        ic = "\u25CB";
        t2 = "0/" + total + " Mastered \u00b7 prove it";
        shortLn2 = "0/" + total + " Mastered";
      } else {
        const frac = done / total;
        ic = frac < 0.34 ? "\uD83E\uDD49" : (frac < 0.67 ? "\uD83E\uDD48" : "\uD83E\uDD47");
        t2 = done + "/" + total + " Mastered";
        shortLn2 = done + "/" + total + " Mastered";
      }
    }
    const famSize = famName.length > 18 ? 8 : (famName.length > 13 ? 8.5 : 9.5);
    const short = '<span style="display:block;font-size:' + famSize + 'px;font-weight:600;color:#9ab0e0;letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:118px;line-height:1.25;">' + famName + '</span>' +
      '<span style="display:block;font-size:12.5px;font-weight:800;color:' + ln2Col + ';line-height:1.2;">' + shortLn2 + '</span>';
    if (icon) { icon.textContent = ic; icon.style.opacity = (total && done === 0) ? "0.45" : "1"; icon.style.filter = done >= total && total ? "drop-shadow(0 0 6px rgba(126,224,168,.7))" : "drop-shadow(0 0 5px rgba(120,160,255,.6))"; }
    if (title) { title.textContent = t1; title.style.color = c1; title.style.fontSize = "11px"; title.style.fontWeight = "600"; }
    const shortEl = this.drillTabShortRef.current; if (shortEl) shortEl.innerHTML = short;
    sub.textContent = t2; sub.style.color = c2; sub.style.fontSize = "13px"; sub.style.fontWeight = "800";
  }

  // ---------- progress / save hint ----------
  bumpBounce() {
    this.totalBounces = (this.totalBounces || 0) + 1;
    if (this.totalBounces >= 20) this.maybeShowSaveHint("bounces");
  }
  noteCardAnswered() {
    this.cardsAnswered = (this.cardsAnswered || 0) + 1;
    if (this.cardsAnswered >= 2) this.maybeShowSaveHint("cards");
  }
  maybeShowSaveHint(reason) {
    if (this.saveDismissed || this.saveShown) return;
    this.saveShown = true; this._menuNudge = true;
    this.openMenu();
  }
  toggleMenu() {
    if (this.deckShown) { this.setDeckOpen(false); return; }
    this.openHomeToLatest();   // open the panel AND the current position's flashcard box
  }
  openMenu() {
    this._drillView = "home";
    this.deckReady = true; this.deckOpen = true;
    this.applyDeckVisibility();
    this.renderDrillHome();
    this.lastInteract = this.now;
  }
  closeMenu() { this.setDeckOpen(false); }
  _deckHasCards(key) { const d = (this.flashcards && this.flashcards.decks) ? this.flashcards.decks[key] : null; return !!(d && d.cards && d.cards.length); }
  openHomeToLatest() {
    // "Study this state" lands in the flashcards home, focused on the CURRENT state's deck (even if its
    // cards aren't authored yet — the row shows the scaffold). Never falls back to a previous state.
    this._drillView = "home"; this.deck = null;
    const rl = this.rollLog || [];
    let idx = rl.length - 1;
    this._rollFocus = idx;
    this._openRow = null;
    this._focusRow = null;
    if (idx >= 0) { this._openRow = "c" + idx; this._focusRow = "c" + idx; }
    this.deckReady = true; this.deckOpen = true;
    this.applyDeckVisibility();
    this.renderDrillHome();
    this._scrollFocusedDeck();
    this.lastInteract = this.now;
  }
  focusRollItem(idx) {
    // arrow up/down moves the focus through THIS ROLL, opening the focused state's deck (collapsing the rest)
    const rl = this.rollLog || [];
    if (!rl.length) return;
    idx = Math.max(0, Math.min(rl.length - 1, idx));
    this._rollFocus = idx;
    this._openRow = null;
    this._focusRow = null;
    const key = rl[idx].key;
    if (this._deckHasCards(key)) { this._openRow = "c" + idx; this._focusRow = "c" + idx; }
    this.renderDrillHome();
    this._scrollFocusedDeck();
  }
  _armDeckExpire() {
    // gray-out the OPEN current-state flashcard box over the decision window; it fully grays as time runs out, then the roll moves on
    const list = this.drillListRef.current; if (!list) return;
    const w = list.querySelector(".ngCurExpire"); if (!w) return;
    const dsec = this._decisionDsec || 10;
    w.style.animation = "none"; void w.offsetWidth;
    w.style.animation = "ngDeckExpire " + dsec + "s linear forwards";
    w.style.animationPlayState = this.paused ? "paused" : "running";
  }
  _scrollFocusedDeck() {    requestAnimationFrame(() => {
      const list = this.drillListRef.current; if (!list) return;
      const mt = list.querySelector(".mt"); if (!mt) return;
      const tr = mt.getBoundingClientRect(), lr = list.getBoundingClientRect();
      list.scrollTop += (tr.top - lr.top) - 110;
    });
  }
  menuBtn(label, active, onClick) {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = "flex:1;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:600;padding:7px 4px;border-radius:8px;transition:none;border:1px solid " + (active ? "rgba(150,180,255,.6)" : "rgba(150,170,210,.16)") + ";background:" + (active ? "rgba(74,108,255,.26)" : "rgba(255,255,255,.03)") + ";color:" + (active ? "#eef1f6" : "#aeb6c8") + ";";
    b.addEventListener("click", onClick);
    return b;
  }
  fontStack(name) { return ({ Grotesk: "'Space Grotesk'", Sora: "'Sora'", Archivo: "'Archivo'", Jakarta: "'Plus Jakarta Sans'" }[name] || "'Space Grotesk'"); }
  applyFont() {
    const stack = "'Space Grotesk'";
    this._displayFam = stack;
    const fam = stack + ",sans-serif";
    [this.brandFontRef, this.evcTextRef, this.evcKickerRef, this.evTextRef].forEach((r) => { if (r && r.current) r.current.style.fontFamily = fam; });
  }
  // ---------- account menu / modals ----------
  // ---------- local persistence (bjj-neural-progress) — drill progress used to reset on every
  // reload; this is the single blob the cloud sync (slice 6) pushes/pulls. ----------
  _dayKey(d) { const x = d || new Date(); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
  _loadProgress() {
    try {
      const raw = localStorage.getItem("bjj-neural-progress"); if (!raw) return;
      const p = JSON.parse(raw); if (!p || p.v !== 1) return;
      this.prep = Object.assign({}, p.prep || {});
      this._days = Object.assign({}, p.days || {});
      if (p.settings) this.settings = Object.assign({}, this.settings || {}, p.settings);
      this.cardsToday = this._days[this._dayKey()] || 0;
    } catch (e) { /* corrupt/absent — start fresh */ }
  }
  _progressBlob() {
    const days = this._days || {};
    const trimmed = {};
    for (const k of Object.keys(days).sort().slice(-30)) trimmed[k] = days[k];
    this._progressAt = Date.now();
    return { v: 1, prep: this.prep || {}, days: trimmed, settings: this.settings || {}, updatedAt: this._progressAt };
  }
  _saveProgress() {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => {
      try { localStorage.setItem("bjj-neural-progress", JSON.stringify(this._progressBlob())); } catch (e) { /* quota */ }
      if (this._pushCloud) this._pushCloud(); // cloud sync (slice 6) — no-op for guests
    }, 400);
  }
  set(k, v) { this.settings = this.settings || {}; this.settings[k] = v; this._saveProgress(); }
  // deferred-payload hooks: refresh whatever is open when the heavy files land post-boot
  onFlashcardsReady() {
    try {
      if (this.currentPos != null && this.currentPos >= 0) this.buildDrillPanel(this.currentPos);
      if (this.deckShown && this._drillView === "home") this.renderDrillHome();
      this.refreshOptionOdds(); this.updateDrillTab();
    } catch (e) { /* non-fatal */ }
  }
  onContentReady() {
    try {
      if (this._nodeCardOn) { this._nodeCardIdx = null; this.updateNodeCard(this.W / this.cam.vw); }
      else if (this._dossierIdx != null && this.isMobile() && this.nodes) this.renderDossier(this.nodes[this._dossierIdx]);
    } catch (e) { /* non-fatal */ }
  }
  // guarded PostHog capture (the page loads posthog globally; token absent on localhost) — no PII
  track(event, props) {
    try { const ph = window.posthog; if (ph && ph.capture) ph.capture(event, Object.assign({ variant: "neural" }, props || {})); } catch (e) { /* analytics must never break the app */ }
  }
  get(k, d) { const v = (this.settings || {})[k]; return v == null ? d : v; }
  masteredCount() { const p = this.prep || {}; return Object.keys(p).filter((k) => p[k] > 0).length; }
  coveragePct(mastered, goal) {
    const raw = (mastered / Math.max(1, goal)) * 100;
    if (raw <= 0) return 0;
    if (raw >= 100) return 100;
    if (raw > 99) return 99;
    return Math.max(1, Math.ceil(raw));
  }
  iconStack(col) { return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="' + (col || '#9fb0d8') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"></path><path d="m2 17 10 5 10-5"></path><path d="m2 12 10 5 10-5"></path></svg>'; }
  iconGear() { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"></path></svg>'; }
  iconDrawer() { return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"></rect><line x1="14" y1="5" x2="14" y2="19"></line><path d="M5.6 12h5.2M8.6 9.8 6.4 12l2.2 2.2"></path></svg>'; }

  renderDrillHome() {
    this.settings = this.settings || {};
    const mastered = this.masteredCount();
    const explored = (this.exploredSet ? this.exploredSet.size : 0);
    const goal = this.get("dailyGoal", 30);
    const head = this.drillHeadRef.current, list = this.drillListRef.current, foot = this.drillFootRef.current;
    if (!head || !list) return;
    if (foot) { foot.style.display = "none"; foot.innerHTML = ""; }

    // header: FLASHCARDS + gear, then the "Your game" hero (merges mastered + cards-today + coverage)
    const pct = this.coveragePct(mastered, goal);
    head.innerHTML =
      '<div style="display:flex;align-items:center;gap:4px;height:34px;margin-bottom:' + (this.user ? '18px' : '14px') + ';">' +
        '<span class="ngClose" title="Collapse panel" style="cursor:pointer;color:#aeb9d2;width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none;transition:background .15s ease,color .15s ease;">' + this.iconDrawer() + '</span>' +
        '<span class="ngGear" title="Settings" style="cursor:pointer;color:#9aa6bd;width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none;transition:background .15s ease,color .15s ease;">' + this.iconGear() + '</span>' +
      '</div>' +
      (this.user ? '' :
        '<div class="ngHdrAuth" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;width:100%;padding:11px;border-radius:12px;background:linear-gradient(135deg,#4a6cff,#7a4cff);box-shadow:0 5px 18px rgba(74,108,255,.4);margin-bottom:16px;transition:filter .15s ease,transform .1s ease;">' +
          '<span style="font-size:13px;font-weight:700;color:#fff;">Create account or log in</span>' +
          '<span style="font-size:10.5px;font-weight:500;color:rgba(255,255,255,.8);">Save your rolls &amp; progress</span>' +
        '</div>') +
      '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:9px;">' +
        '<span style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:#7b8aa8;white-space:nowrap;">Your game</span>' +
        '<span style="font-size:13px;font-weight:700;color:#9ab0e0;font-family:\'Space Grotesk\',sans-serif;">' + pct + '%</span>' +
      '</div>' +
      '<div style="height:7px;border-radius:4px;background:rgba(255,255,255,.06);overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#4a6cff,#7ee0a8);border-radius:4px;"></div></div>' +
      '<div style="display:flex;gap:14px;margin-top:10px;font-size:11.5px;">' +
        '<span class="ngStat" data-b="mastered" style="cursor:pointer;color:#8b97b0;display:inline-flex;align-items:center;gap:4px;border-bottom:1px dashed rgba(139,151,176,.35);padding-bottom:1px;"><b style="color:#cbd4e6;font-weight:700;">' + mastered + '</b> mastered</span>' +
        '<span class="ngStat" data-b="due" style="cursor:pointer;color:#8b97b0;display:inline-flex;align-items:center;gap:4px;border-bottom:1px dashed rgba(139,151,176,.35);padding-bottom:1px;"><b style="color:#7ee0a8;font-weight:700;">' + (this.cardsToday || 0) + '</b> today</span>' +
        '<span class="ngStat" data-b="suggested" style="cursor:pointer;color:#d6a45a;display:inline-flex;align-items:center;gap:4px;border-bottom:1px dashed rgba(214,164,90,.4);padding-bottom:1px;"><b style="color:#e9bd70;font-weight:700;">' + goal + '+</b> weak spots</span>' +
      '</div>';
    head.querySelectorAll(".ngStat").forEach((s) => {
      const sg = s.getAttribute("data-b") === "suggested";
      s.addEventListener("mouseenter", () => s.style.color = sg ? "#f0cf8e" : "#cbd4e6");
      s.addEventListener("mouseleave", () => s.style.color = sg ? "#d6a45a" : "#8b97b0");
      s.addEventListener("click", () => { const b = s.getAttribute("data-b"); if (b === "suggested") { this.openSession("suggested", "Weak spots in your game"); } else { this.openFlashBrowser(b, b === "mastered" ? "Mastered" : "Due Today"); } });
    });
    head.querySelectorAll(".ngGear,.ngClose").forEach((b) => {
      b.addEventListener("mouseenter", () => { b.style.background = "rgba(255,255,255,.07)"; b.style.color = "#eef1f6"; });
      b.addEventListener("mouseleave", () => { b.style.background = "transparent"; b.style.color = b.classList.contains("ngClose") ? "#aeb9d2" : "#9aa6bd"; });
    });
    { const a = head.querySelector(".ngHdrAuth"); if (a) { a.addEventListener("mouseenter", () => a.style.filter = "brightness(1.08)"); a.addEventListener("mouseleave", () => a.style.filter = "none"); a.addEventListener("click", () => this.openAuth("create")); } }
    head.querySelector(".ngGear").addEventListener("click", () => this.openSettings("flashcards"));
    head.querySelector(".ngClose").addEventListener("click", () => this.setDeckOpen(false));

    list.innerHTML = "";
    this._miniReg = {};
    const sec = (label) => { const d = document.createElement("div"); d.style.cssText = "font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#6b7691;font-weight:700;padding:6px 8px 4px;margin:0 -8px;"; d.textContent = label; return d; };
    const row = (label, count, strong, bucket) => {
      const r = document.createElement("div");
      r.style.cssText = "display:flex;align-items:center;gap:10px;padding:11px 8px;margin:0 -8px;cursor:pointer;border-radius:8px;transition:background .12s;";
      r.innerHTML =
        '<span style="flex:1;font-size:13.5px;font-weight:' + (strong ? 600 : 500) + ';color:' + (strong ? "#eef1f6" : "#9aa6bd") + ';">' + label + '</span>' +
        '<span style="font-size:13px;font-weight:600;color:' + (strong ? "#cbd4e6" : "#7e8aa3") + ';">' + count + '</span>' +
        '<span style="color:#5d6883;font-size:15px;">\u203a</span>';
      r.addEventListener("mouseenter", () => r.style.background = "rgba(255,255,255,.03)");
      r.addEventListener("mouseleave", () => r.style.background = "transparent");
      r.addEventListener("click", () => { if (count <= 0) return; if (bucket === "suggested" || bucket === "explored") { this.openSession(bucket, label); } else this.openFlashBrowser(bucket, label); });
      if (count === 0) { r.style.cursor = "default"; r.style.opacity = ".5"; }
      return r;
    };

    // grouped roll history — the current roll's CURRENT row expands to an inline flashcard deck
    this.renderRollHistory(list);

    // hero CTA pinned in the footer — only for signed-in users (guests get the auth CTA up in the header)
    if (foot) {
      foot.innerHTML = "";
      if (!this.user) {
        foot.style.display = "none";
      } else {
        foot.style.display = "flex";
        const cta = document.createElement("button");
        cta.style.cssText = "width:100%;cursor:pointer;font-family:inherit;border:none;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;align-items:center;gap:2px;background:linear-gradient(135deg,#4a6cff,#7a4cff);box-shadow:0 6px 20px rgba(74,108,255,.4);transition:filter .15s,transform .1s;";
        cta.addEventListener("mouseenter", () => cta.style.filter = "brightness(1.08)");
        cta.addEventListener("mouseleave", () => cta.style.filter = "none");
        const left = Math.max(0, goal - (this.cardsToday || 0));
        const sub = left > 0 ? left + " card" + (left === 1 ? "" : "s") + " left to win gold \uD83E\uDD47" : "Gold earned today \uD83E\uDD47";
        cta.innerHTML = '<span style="font-size:14px;font-weight:700;color:#fff;">Continue today</span><span style="font-size:10.5px;font-weight:500;color:rgba(255,255,255,.82);">' + sub + '</span>';
        cta.addEventListener("click", () => this.openSession("suggested", "Suggested for you"));
        foot.appendChild(cta);
        const out = document.createElement("button");
        out.textContent = "Log out";
        out.style.cssText = "width:100%;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:600;padding:6px;border-radius:9px;border:none;background:transparent;color:#7e8aa3;";
        out.addEventListener("click", () => { const A = this._auth(); if (A && A.signOut) { try { A.signOut(); } catch (e) {} } this.user = null; this._pulled = false; this.updateAccountUI(); this.renderDrillHome(); });
        foot.appendChild(out);
      }
    }
  }

  _timeBucket(ts) {
    const d = new Date(ts), now = new Date();
    const day0 = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day0(now) - day0(d)) / 86400000);
    if (diff <= 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  _agoLabel(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }
  _histRow(h, decks, opts) {
    const isCurrent = !!opts.isCurrent;
    const dot = h.actor === "you" ? "#5b8cff" : (h.actor === "opp" ? "#d8607a" : "#7e8aa3");
    const deck = decks[h.key];
    const ncards = deck ? deck.cards.length : 0;
    const prep = Math.min((this.prep && this.prep[h.key]) || 0, ncards);
    const r = document.createElement("div");
    r.style.cssText = "display:flex;align-items:center;gap:10px;padding:7px 8px;margin:0 -8px;border-radius:8px;transition:background .12s;position:relative;";
    const railTop = opts.isFirst ? "50%" : "0"; const railBot = opts.isLast ? "50%" : "0";
    const valColor = h.val != null ? (parseInt(h.val, 10) >= 0 ? "#5b8cff" : "#d8889e") : "#6b7691";
    r.innerHTML =
      '<span style="position:relative;width:10px;flex:none;align-self:stretch;display:flex;justify-content:center;">' +
        '<span style="position:absolute;top:' + railTop + ';bottom:' + railBot + ';width:1.5px;background:rgba(150,170,210,.16);"></span>' +
        '<span style="position:relative;align-self:center;width:8px;height:8px;border-radius:50%;background:' + dot + ';box-shadow:0 0 0 3px rgba(15,17,30,1)' + (isCurrent ? ',0 0 7px ' + dot : '') + ';"></span>' +
      '</span>' +
      '<div style="flex:1;min-width:0;">' +
      (h.intend ? '<div style="font-size:9px;color:#5d6680;font-weight:600;letter-spacing:.01em;margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (h.actor === "opp" ? "they aimed for" : "you aimed for") + ' <span style="color:#7e8aa3;">' + h.intend.val + ' ' + h.intend.name + '</span></div>' : '') +
      '<div style="display:flex;align-items:baseline;gap:6px;"><span style="font-size:12.5px;font-weight:' + (isCurrent ? 700 : 500) + ';color:' + (isCurrent ? "#eef1f6" : "#9aa6bd") + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (h.intend ? "\u21b3 " : "") + h.name + '</span>' + (h.val != null && parseInt(h.val, 10) !== 0 ? '<span style="flex:none;font-size:10px;font-weight:700;color:' + valColor + ';font-family:\'Space Grotesk\',sans-serif;">' + h.val + '</span>' : '') + '</div>' +
      '<div style="font-size:9.5px;color:#6b7691;font-weight:600;letter-spacing:.02em;">' + h.role + (ncards ? " \u00b7 " + (prep >= ncards && ncards ? "mastered" : prep + "/" + ncards + " cards") : "") + '</div></div>' +
      (isCurrent ? '<span style="flex:none;font-size:8.5px;letter-spacing:.12em;font-weight:800;color:#7ee0a8;border:1px solid rgba(126,224,168,.4);border-radius:5px;padding:2px 5px;">LATEST</span>' : '') +
      '<span class="hplay" style="flex:none;cursor:pointer;width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04);color:' + (ncards ? "#8b97b0" : "#586378") + ';transition:background .12s,color .12s;"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"></path></svg></span>';
    const box = document.createElement("div");
    const detail = document.createElement("div");
    detail.style.cssText = "display:none;margin:0 -8px;";
    let built = false;
    const rid = opts.rid != null ? opts.rid : ("c" + (opts.rollIndex != null ? opts.rollIndex : h.key));
    {
      const play = r.querySelector(".hplay");
      const closeSelf = () => { detail.style.display = "none"; if (this._openRow === rid) this._openRow = null; if (this._focusRow === rid) this._focusRow = null; if (this._openMini && this._openMini.rid === rid) this._openMini = null; };
      const openD = () => {
        if (this._openMini && this._openMini.rid !== rid) this._openMini.close();   // accordion: only one box open at a time
        if (!built) { built = true; detail.appendChild(ncards ? this._miniDeck(h.key, deck, isCurrent, rid) : this._miniDeckEmpty(h)); }
        detail.style.display = "block";
        this._openRow = rid; this._focusRow = rid;
        this._openMini = { rid: rid, el: detail, close: closeSelf };
      };
      const toggle = () => {
        if (detail.style.display !== "none") closeSelf();
        else { this._rollFocus = (opts.rollIndex != null ? opts.rollIndex : this._rollFocus); openD(); }
      };
      r.style.cursor = "pointer";
      r.addEventListener("click", () => toggle());
      // play button: only the current (LATEST) state acts as a play/pause transport; every other row is a gray "roll from here"
      const setIcon = () => {
        const playing = isCurrent && !this.paused;
        const p = play.querySelector("svg path");
        if (p) p.setAttribute("d", playing ? "M6 5h4v14H6zM14 5h4v14h-4z" : "M7 5v14l12-7z");
        play.title = isCurrent ? (this.paused ? "Resume roll" : "Pause roll") : "Roll from this position";
      };
      setIcon();
      if (isCurrent) this._curSetIcon = setIcon;
      play.addEventListener("mouseenter", () => { play.style.background = "rgba(74,108,255,.3)"; play.style.color = "#dbe6ff"; });
      play.addEventListener("mouseleave", () => { play.style.background = "rgba(255,255,255,.04)"; play.style.color = ncards ? "#8b97b0" : "#586378"; });
      play.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (isCurrent) { this.setPaused(!this.paused); setIcon(); return; }   // current state = pause / resume
        // any other row = start another roll from this position (current roll archived into Previous rolls)
        this._openLatestOnLand = true;
        const ni = this.nodeForKey(h.key);
        this.rollFromPosition(ni >= 0 ? ni : this.currentPos);
      });
      if (this._openRow === rid) openD();
    }
    r.addEventListener("mouseenter", () => r.style.background = "rgba(255,255,255,.03)");
    r.addEventListener("mouseleave", () => r.style.background = "transparent");
    box.appendChild(r); box.appendChild(detail);
    return box;
  }
  _miniDeck(key, deck, isCurrent, rid) {
    const cards = deck.cards, total = cards.length;
    this._deckState = this._deckState || {};
    const st = this._deckState[key] || (this._deckState[key] = { idx: 0, revealed: false });
    if (st.idx >= total) st.idx = 0;
    this._answered = this._answered || {};
    const ansSet = this._answered[key] || (this._answered[key] = new Set());
    this.prep = this.prep || {};
    const wrap = document.createElement("div");
    if (isCurrent) wrap.className = "ngCurExpire";
    wrap.style.cssText = "padding:0 8px 12px 26px;animation:ngCardIn .26s cubic-bezier(.2,.7,.2,1) both;";
    const navBtn = (cls, d) => '<button class="' + cls + '" style="flex:none;width:42px;height:36px;cursor:pointer;border:1px solid rgba(150,170,210,.2);border-radius:9px;background:rgba(255,255,255,.03);color:#aab4c8;display:flex;align-items:center;justify-content:center;transition:background .12s,color .12s;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"></path></svg></button>';
    const doPrev = () => { st.idx = (st.idx - 1 + total) % total; st.revealed = false; render(); };
    const doNext = () => { st.idx = (st.idx + 1) % total; st.revealed = false; render(); };
    const doReveal = () => {
      st.revealed = !st.revealed;
      if (st.revealed) { ansSet.add(st.idx); this.prep[key] = Math.max((this.prep[key] || 0), ansSet.size); this.noteCardDone(cards[st.idx], key); } // answering raises this state's score (+ shared-card credit)
      render();
    };
    const render = () => {
      const card = cards[st.idx] || {};
      const tabs = cards.map((c, i) => {
        const active = i === st.idx, done = ansSet.has(i);
        const bg = active ? "#5b8cff" : (done ? "#6ed6a0" : "rgba(150,170,210,.22)");
        return '<span class="mt" data-i="' + i + '" style="height:4px;width:' + (active ? "22px" : "8px") + ';border-radius:2px;background:' + bg + ';cursor:pointer;transition:width .22s,background .22s;"></span>';
      }).join("");
      wrap.innerHTML =
        '<div style="display:flex;gap:4px;align-items:center;margin:0 0 8px 3px;">' + tabs + '</div>' +
        '<div style="border:1px solid rgba(120,150,255,.2);border-radius:11px;background:linear-gradient(160deg,rgba(32,40,68,.55),rgba(13,16,30,.6));padding:14px 15px 13px;box-shadow:0 6px 18px rgba(0,0,0,.2);">' +
          // scope chip: only on higher-tier (general) cards blended in — names the position/family
          // the card is about, so it reads as a concept rather than a state:role-specific detail.
          (card.tag ? '<div style="display:inline-block;font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;color:#9ab0e0;background:rgba(90,140,255,.13);border:1px solid rgba(120,150,255,.26);border-radius:999px;padding:2px 8px;margin-bottom:9px;">' + card.tag + '</div>' : '') +
          '<div style="font-size:13px;line-height:1.5;color:#e3e9f4;font-weight:500;">' + (card.q || card.front || "") + '</div>' +
        '</div>' +
        (st.revealed ? '<div style="margin-top:8px;border:1px solid rgba(110,214,160,.28);border-radius:11px;background:rgba(20,38,30,.42);padding:13px 15px;font-size:12.5px;line-height:1.6;color:#bfe6cf;animation:ngCardIn .22s ease both;">' + (card.a || card.back || "") + '</div>' : '') +
        '<div style="display:flex;gap:7px;margin-top:9px;">' +
          navBtn("mp", "M15 18l-6-6 6-6") +
          '<button class="mr" style="flex:1;cursor:pointer;border:1px solid rgba(120,150,255,.4);border-radius:9px;background:rgba(74,108,255,.16);color:#dbe6ff;font-family:inherit;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:7px;transition:background .12s;">' + (st.revealed ? "Hide answer" : "Reveal") + '<kbd style="font-family:inherit;font-size:9px;font-weight:700;opacity:.55;border:1px solid currentColor;border-radius:4px;padding:1px 6px;letter-spacing:.04em;">space</kbd></button>' +
          navBtn("mn", "M9 18l6-6-6-6") +
        '</div>';
      const mp = wrap.querySelector(".mp"), mn = wrap.querySelector(".mn"), mr = wrap.querySelector(".mr");
      const navHov = (b, on) => { b.style.background = on ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.03)"; b.style.color = on ? "#dfe6f2" : "#aab4c8"; };
      mp.onmouseenter = () => navHov(mp, true); mp.onmouseleave = () => navHov(mp, false);
      mn.onmouseenter = () => navHov(mn, true); mn.onmouseleave = () => navHov(mn, false);
      mr.onmouseenter = () => mr.style.background = "rgba(74,108,255,.28)";
      mr.onmouseleave = () => mr.style.background = "rgba(74,108,255,.16)";
      mp.onclick = doPrev; mn.onclick = doNext; mr.onclick = doReveal;
      wrap.querySelectorAll(".mt").forEach((t) => t.onclick = () => { st.idx = parseInt(t.dataset.i, 10); st.revealed = false; render(); });
    };
    this._miniReg = this._miniReg || {};
    this._miniReg[rid != null ? rid : key] = { reveal: doReveal, prev: doPrev, next: doNext };
    render();
    return wrap;
  }
  _miniDeckEmpty(h) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "padding:0 8px 12px 26px;animation:ngCardIn .26s cubic-bezier(.2,.7,.2,1) both;";
    wrap.innerHTML =
      '<div style="position:relative;border:1px dashed rgba(150,170,210,.22);border-radius:11px;background:linear-gradient(160deg,rgba(28,33,52,.4),rgba(13,16,30,.45));padding:20px 16px;overflow:hidden;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="rgba(150,170,210,.07)" stroke-width="1.4" style="position:absolute;right:-10px;bottom:-14px;width:84px;height:84px;pointer-events:none;"><rect x="3" y="4" width="18" height="14" rx="2"></rect><path d="M3 9h18M8 14h2"></path></svg>' +
        '<div style="position:relative;font-size:12.5px;font-weight:600;color:#aab4c8;line-height:1.45;">Flashcards in the works</div>' +
        '<div style="position:relative;margin-top:5px;font-size:11.5px;color:#6b7691;line-height:1.5;">This state\u2019s deck is being authored on <span style="color:#8b97b0;">bjjgraph.org</span>. Drilling it will raise your odds here soon.</div>' +
      '</div>';
    return wrap;
  }
  _pastRollRow(roll, decks) {
    const log = roll.log || [];
    const start = log[0], end = log[log.length - 1];
    const oc = { win: { c: "#7ee0a8", t: "won" }, lose: { c: "#e8889e", t: "tapped" }, reset: { c: "#7e8aa3", t: "reset" } }[roll.outcome] || { c: "#7e8aa3", t: "ended" };
    const box = document.createElement("div");
    box.style.cssText = "margin:0 -8px;";
    const r = document.createElement("div");
    r.style.cssText = "display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:8px;cursor:pointer;transition:background .12s;";
    r.innerHTML =
      '<span style="flex:none;width:8px;height:8px;border-radius:50%;background:' + oc.c + ';box-shadow:0 0 6px ' + oc.c + '55;"></span>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:12.5px;font-weight:600;color:#c2cce0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (start ? start.name : "?") + ' <span style="color:#5d6883;">\u2192</span> ' + (end ? end.name : "?") + '</div>' +
        '<div style="font-size:9.5px;color:#6b7691;font-weight:600;letter-spacing:.02em;">' + log.length + ' states \u00b7 ' + oc.t + ' \u00b7 ' + this._agoLabel(roll.ts) + '</div>' +
      '</div>' +
      '<span class="pchev" style="flex:none;color:#5d6883;font-size:14px;transition:transform .18s;">\u203a</span>';
    const detail = document.createElement("div");
    detail.style.cssText = "display:none;flex-direction:column;padding-left:6px;margin-top:2px;";
    let built = false;
    r.addEventListener("mouseenter", () => r.style.background = "rgba(255,255,255,.03)");
    r.addEventListener("mouseleave", () => r.style.background = "transparent");
    r.addEventListener("click", () => {
      const open = detail.style.display === "none";
      if (open && !built) { built = true; log.forEach((h, i) => detail.appendChild(this._histRow(h, decks, { isFirst: i === 0, isLast: i === log.length - 1, rid: "p" + roll.ts + "_" + i }))); }
      detail.style.display = open ? "flex" : "none";
      const chev = r.querySelector(".pchev"); if (chev) chev.style.transform = open ? "rotate(90deg)" : "none";
    });
    box.appendChild(r); box.appendChild(detail);
    return box;
  }
  renderRollHistory(list) {
    const decks = (this.flashcards && this.flashcards.decks) || {};
    const label = (txt) => { const d = document.createElement("div"); d.style.cssText = "font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#6b7691;font-weight:700;padding:12px 8px 4px;margin:0 -8px;white-space:nowrap;"; d.textContent = txt; return d; };
    const box = document.createElement("div");
    const cur = this.rollLog || [];
    const past = this._pastRolls || [];
    if (past.length) {
      box.appendChild(label("Previous rolls"));
      past.forEach((roll) => box.appendChild(this._pastRollRow(roll, decks)));
    }
    if (cur.length) {
      box.appendChild(label("This roll"));
      const wrap = document.createElement("div"); wrap.style.cssText = "display:flex;flex-direction:column;";
      cur.forEach((h, i) => wrap.appendChild(this._histRow(h, decks, { isCurrent: i === cur.length - 1, isFirst: i === 0, isLast: i === cur.length - 1, rollIndex: i, rid: "c" + i })));
      box.appendChild(wrap);
    }
    if (box.children.length) {
      list.appendChild(box);
    }
  }
  openModal() { const m = this.modalRef.current; if (m) m.style.display = "flex"; this.lastInteract = this.now; }
  openLegal(kind) {
    const card = this.modalCardRef.current; if (!card) return;
    card.style.width = "min(520px,92vw)";
    card.innerHTML = "";
    const head = document.createElement("div");
    head.style.cssText = "padding:20px 22px 0;";
    const title = kind === "privacy" ? "Privacy Policy" : "Terms of Use";
    head.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;"><div style="font-size:20px;font-weight:700;color:#eef1f6;letter-spacing:-.01em;">' + title + '</div><span class="x" style="cursor:pointer;color:#8b97b0;font-size:20px;">&times;</span></div><div style="font-size:11.5px;color:#7e8aa8;margin-top:5px;">bjjgraph.org &middot; Last updated July 2026</div>';
    head.querySelector(".x").addEventListener("click", () => this.closeModal());
    card.appendChild(head);
    const body = document.createElement("div");
    body.style.cssText = "padding:16px 22px 22px;overflow-y:auto;max-height:min(62vh,540px);display:flex;flex-direction:column;gap:14px;";
    const sec = (h, t) => '<div><div style="font-size:13px;font-weight:700;color:#dbe2f0;margin-bottom:5px;">' + h + '</div><div style="font-size:12.5px;line-height:1.6;color:#9aa6bd;">' + t + '</div></div>';
    if (kind === "privacy") {
      body.innerHTML =
        sec("What we collect", "Your study progress (flashcards answered, techniques mastered, roll history) and, if you create an account, your email address. Guest progress is stored locally on your device.") +
        sec("How we use it", "To sync your progress across devices, personalize which cards are surfaced, and improve the graph. We do not sell your data or share it with advertisers.") +
        sec("Cookies & analytics", "We use minimal, privacy-respecting analytics to understand aggregate usage. No cross-site tracking.") +
        sec("Your rights", "You can export or delete your account and all associated data at any time from Settings, or by contacting us.") +
        sec("Contact", "Questions about this policy: privacy@bjjgraph.org");
    } else {
      body.innerHTML =
        '<div style="border:1px solid rgba(232,116,107,.3);background:rgba(232,116,107,.07);border-radius:11px;padding:12px 14px;font-size:12.5px;line-height:1.6;color:#c4cde0;"><b style="color:#eda49c;">Safety first.</b> Brazilian Jiu-Jitsu is a contact sport with inherent risk of serious injury. bjjgraph.org is a study companion for practitioners who already train at an academy under qualified instruction. It is not a substitute for in-person coaching, and it is not a self-teaching program.</div>' +
        sec("What this service is", "An interactive knowledge base and study tool: positions, transitions, submissions, flashcards, and a simulated \u201croll\u201d for reviewing decision-making. The simulation, including any success percentages or modifiers, is a gameplay estimate for study purposes only \u2014 it does not predict real outcomes.") +
        sec("Assumption of risk", "Only practice techniques under the supervision of a qualified instructor, with a willing, informed partner, and at an intensity appropriate to your level. You assume all risk arising from your training. Never practice chokes or joint locks outside supervised training.") +
        sec("No warranties", "Content is provided \u201cas is\u201d, without warranty of accuracy or completeness. Technique descriptions may contain errors, and what works varies by body type, skill, and context.") +
        sec("Limitation of liability", "To the maximum extent permitted by law, bjjgraph.org and its contributors are not liable for any injury, loss, or damage arising from use of this service or from training decisions informed by it.") +
        sec("Your account", "You are responsible for activity under your account. We may suspend accounts that abuse the service.") +
        sec("Contact", "Questions about these terms: legal@bjjgraph.org");
    }
    card.appendChild(body);
    this.openModal();
  }
  closeModal() { const m = this.modalRef.current; if (m) m.style.display = "none"; }

  expandOption(opt, onPick, srcCard) {
    const n = opt.node;
    const panel = this.optDetailRef.current; if (!panel) { onPick(opt); return; }
    this.setPaused(true);           // freeze time while the player reads/confirms
    const col = this.hex(n.col), cat = this.deckCat(n);
    const pct = Math.round(this.moveChance(n) * 100);
    const oddsCol = pct >= 60 ? "#7ee0a8" : pct >= 38 ? "#cbd24e" : "#e8956b";
    const resName = opt.res >= 0 ? this.splitName(this.nodes[opt.res].t).main : "\u2014";
    const myMod = Math.round(this.stateBonus(this._posKey) * 100) + Math.round(this.stateBonus(this.deckKeyFor(n).key) * 100);
    const neighbors = this.adj[n.idx].filter((k) => this.nodes[k].ty === "positions").slice(0, 4).map((k) => this.splitName(this.nodes[k].t).main);
    const pot = Math.round(this.movePotential(opt) * 100);
    const potCol = this.potColor(pot);
    const tp = this.titleParts(n);                 // {from,to} when the move reads "X to Y", else null
    const sp = this.splitName(n.t);
    const rc = this.richContentFor(n);
    const hasPersp = !!rc;                          // only authored dual-perspective entries get the tab
    if (!this._perspective) this._perspective = "attacker";
    const persp = this._perspective;
    const ptBtn = (p, lbl) => { const on = p === persp; return '<button data-p="' + p + '" class="ng-pt" style="cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:700;letter-spacing:.02em;padding:5px 13px;border-radius:999px;border:none;background:' + (on ? "rgba(255,255,255,.92)" : "transparent") + ';color:' + (on ? "#10131c" : "#aeb9d4") + ';transition:background .15s,color .15s;">' + lbl + '</button>'; };
    panel.innerHTML = "";
    // grabber handle — drag/click to expand or collapse the sheet
    const grab = document.createElement("div");
    grab.style.cssText = "flex:none;display:flex;justify-content:center;align-items:center;height:18px;cursor:ns-resize;background:linear-gradient(150deg," + col + "22,transparent 80%);border-top-left-radius:20px;border-top-right-radius:20px;";
    grab.innerHTML = '<span style="width:38px;height:4px;border-radius:2px;background:rgba(150,170,210,.4);"></span>';
    panel.appendChild(grab);
    const head = document.createElement("div");
    head.style.cssText = "position:relative;flex:none;padding:6px 26px 18px;background:linear-gradient(150deg," + col + "1f,transparent 72%);border-bottom:1px solid rgba(150,170,210,.1);";
    const editBtn = '<button class="ng-bsuc-edit" title="Adjust your success rate" style="flex:none;width:24px;height:24px;border-radius:50%;border:1px solid rgba(150,170,210,.22);background:rgba(255,255,255,.03);color:#8b97b0;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg></button>';
    const stepsSpan = '<span class="ng-bsuc-steps" style="display:none;align-items:center;gap:7px;opacity:0;transition:opacity .18s ease;"><button class="ng-bsuc-dn" title="Lower" style="flex:none;width:24px;height:24px;border-radius:50%;border:1px solid rgba(150,170,210,.3);background:rgba(255,255,255,.04);color:#aeb9d4;font-size:15px;font-weight:700;line-height:1;cursor:pointer;">\u2212</button><button class="ng-bsuc-up" title="Raise" style="flex:none;width:24px;height:24px;border-radius:50%;border:1px solid rgba(150,170,210,.3);background:rgba(255,255,255,.04);color:#aeb9d4;font-size:15px;font-weight:700;line-height:1;cursor:pointer;">+</button></span>';
    // right-aligned stat stack — Edge on top, Success below (mirrors the small option card)
    const edgeBlock = '<div style="text-align:right;"><div style="font-size:23px;font-weight:700;color:' + potCol + ';font-family:\'Space Grotesk\',sans-serif;line-height:1;">' + (pot > 0 ? "+" : "") + pot + '</div><div style="font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#7e8aa3;font-weight:700;margin-top:4px;">Edge</div></div>';
    const succRight = '<div style="text-align:right;margin-top:15px;"><div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">' + stepsSpan + editBtn + '<div class="ngsucbig" style="font-size:25px;font-weight:700;color:' + oddsCol + ';font-family:\'Space Grotesk\',sans-serif;line-height:1;">' + pct + '%</div></div><div style="font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#7e8aa3;font-weight:600;margin-top:6px;">Success</div></div>';
    const drillNote = myMod > 0 ? '<div style="margin-top:11px;display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:#7ee0a8;"><b style="font-weight:700;">+' + myMod + '%</b><span style="color:#6f8a78;">from your drilling</span></div>' : '';
    head.innerHTML =
      '<span class="x" style="position:absolute;top:2px;right:20px;cursor:pointer;color:#9aa6bd;font-size:21px;line-height:1;">&times;</span>' +
      '<div style="display:flex;align-items:center;gap:9px;margin-bottom:12px;flex-wrap:wrap;">' +
        (hasPersp ? '<div class="ng-persp" style="display:inline-flex;background:rgba(255,255,255,.05);border:1px solid rgba(150,170,210,.16);border-radius:999px;padding:3px;gap:2px;">' + ptBtn("attacker", "Attacker") + ptBtn("defender", "Defend") + '</div>' : '') +
        '<button class="ng-playfrom" title="Start a fresh roll from this state" style="cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#bcd0ff;padding:5px 12px 5px 11px;border-radius:999px;border:1px solid rgba(124,156,255,.3);background:rgba(74,108,255,.12);transition:background .15s;"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>Play from here</button>' +
      '</div>' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;">' +
        '<div style="min-width:0;">' +
          '<div style="display:flex;align-items:center;gap:9px;margin-bottom:9px;">' + this.nodeGlyph(n.ty, col, 11) +
            '<span style="font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:#9fb0d8;">' + cat + '</span></div>' +
          (tp
            ? '<div style="display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;font-family:\'Space Grotesk\',sans-serif;line-height:1.08;">' +
                '<span style="font-size:18px;font-weight:600;color:#8b97b0;">' + tp.from + '</span>' +
                '<span style="font-size:16px;color:#5d6a86;font-weight:600;">\u2192</span>' +
                '<span style="font-size:25px;font-weight:700;color:#eef1f6;letter-spacing:-.015em;">' + tp.to + '</span>' +
              '</div>'
            : '<div style="font-size:25px;font-weight:700;color:#eef1f6;letter-spacing:-.015em;line-height:1.05;font-family:\'Space Grotesk\',sans-serif;">' + sp.main + '</div>' +
              (sp.from ? '<div style="font-size:14px;color:#8b97b0;margin-top:3px;">' + sp.from + '</div>' : '')) +
          drillNote +
        '</div>' +
        '<div style="flex:none;">' + edgeBlock + succRight + '</div>' +
      '</div>' +
      (cat === "Submission"
        ? ''
        : (!tp && resName !== "\u2014" ? '<div style="margin-top:13px;font-size:12px;color:#8b97b0;display:flex;align-items:center;gap:6px;"><span style="color:#7ee0a8;">\u2192</span>on success, advances to <b style="color:#c3cde0;font-weight:600;">' + this.splitName(resName).main + '</b></div>' : ''));
    const scroller = document.createElement("div");
    scroller.style.cssText = "flex:1;min-height:0;overflow-y:auto;";
    scroller.appendChild(head);
    const body = document.createElement("div");
    body.style.cssText = "padding:18px 26px 48px;";
    const renderBody = () => { this.clearClipLoops(); body.innerHTML = this.detailHTML(n, cat, neighbors, this._perspective); this.wireClips(body, this._curClips); };
    renderBody();
    scroller.appendChild(body);
    panel.appendChild(scroller);
    const foot = document.createElement("div");
    foot.style.cssText = "flex:none;display:flex;gap:11px;padding:16px 26px 20px;border-top:1px solid rgba(150,170,210,.1);";
    const back = document.createElement("button");
    back.innerHTML = 'Back <kbd style="font-family:inherit;font-size:10px;font-weight:700;opacity:.6;margin-left:4px;border:1px solid currentColor;border-radius:4px;padding:0 4px;">Esc</kbd>';
    back.style.cssText = "cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:600;padding:12px 18px;border-radius:11px;border:1px solid rgba(150,170,210,.25);background:rgba(255,255,255,.04);color:#c3cde0;display:flex;align-items:center;";
    const go = document.createElement("button");
    go.innerHTML = (cat === "Submission" ? "Go for the " + sp.main : "Execute this move") + ' <kbd style="font-family:inherit;font-size:10px;font-weight:700;opacity:.7;margin-left:7px;border:1px solid rgba(255,255,255,.5);border-radius:4px;padding:0 5px;">\u23ce</kbd>';
    go.style.cssText = "flex:1;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:700;padding:12px;border-radius:11px;border:none;background:linear-gradient(135deg,#4a6cff,#6a5cff);color:#fff;box-shadow:0 4px 16px rgba(74,108,255,.35);display:flex;align-items:center;justify-content:center;";
    back.addEventListener("click", () => this.closeOptionDetail());
    head.querySelector(".x").addEventListener("click", () => this.closeOptionDetail());
    // perspective tab — re-render the body for attacker / defender and restyle the segmented control
    head.querySelectorAll(".ng-pt").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const p = b.getAttribute("data-p"); if (p === this._perspective) return;
      this._perspective = p;
      head.querySelectorAll(".ng-pt").forEach((x) => { const on = x.getAttribute("data-p") === p; x.style.background = on ? "rgba(255,255,255,.92)" : "transparent"; x.style.color = on ? "#10131c" : "#aeb9d4"; });
      renderBody();
    }));
    { const pf = head.querySelector(".ng-playfrom"); if (pf) { pf.addEventListener("mouseenter", () => pf.style.background = "rgba(74,108,255,.22)"); pf.addEventListener("mouseleave", () => pf.style.background = "rgba(74,108,255,.12)"); pf.addEventListener("click", (e) => { e.stopPropagation(); this.confirmPlayFrom(n); }); } }
    { const bdn = head.querySelector(".ng-bsuc-dn"), bup = head.querySelector(".ng-bsuc-up"), bsvAll = head.querySelectorAll(".ngsucbig"), bedit = head.querySelector(".ng-bsuc-edit"), bsteps = head.querySelector(".ng-bsuc-steps");
      const bupd = () => { const p = Math.round(this.moveChance(n) * 100); const c = p >= 60 ? "#7ee0a8" : p >= 38 ? "#cbd24e" : "#e8956b"; bsvAll.forEach((el) => { el.textContent = p + "%"; el.style.color = c; }); this.refreshOptionOdds(); };
      if (bedit) bedit.addEventListener("click", (e) => { e.stopPropagation(); bedit.style.display = "none"; if (bsteps) { bsteps.style.display = "flex"; requestAnimationFrame(() => bsteps.style.opacity = "1"); } });
      if (bdn) bdn.addEventListener("click", (e) => { e.stopPropagation(); this.bumpCardSuccess(n, -1); bupd(); });
      if (bup) bup.addEventListener("click", (e) => { e.stopPropagation(); this.bumpCardSuccess(n, 1); bupd(); }); }
    go.addEventListener("click", () => { this._detailCtx = null; this.hideOptDetail(); this.setPaused(false); onPick(opt); });
    foot.appendChild(back); foot.appendChild(go);
    panel.appendChild(foot);
    this._detailCtx = { opt: opt, onPick: onPick };

    // expand / collapse the sheet (compact peek -> full)
    this._optExpanded = false;
    const COLLAPSED = 340, EXPANDED = () => Math.round(window.innerHeight * 0.86);
    const setExpanded = (full) => { this._optExpanded = full; panel.style.transition = "opacity .26s cubic-bezier(.2,.7,.2,1),transform .34s cubic-bezier(.2,.7,.2,1),height .34s cubic-bezier(.2,.7,.2,1)"; panel.style.height = full ? EXPANDED() + "px" : COLLAPSED + "px"; };
    let gDrag = false, gY0 = 0, gH0 = 0, gMoved = 0;
    grab.addEventListener("pointerdown", (e) => { gDrag = true; gY0 = e.clientY; gH0 = panel.getBoundingClientRect().height; gMoved = 0; panel.style.transition = "none"; try { grab.setPointerCapture(e.pointerId); } catch (x) {} e.stopPropagation(); });
    grab.addEventListener("pointermove", (e) => { if (!gDrag) return; const dy = gY0 - e.clientY; gMoved += Math.abs(e.movementY || 0); const h = Math.max(COLLAPSED, Math.min(EXPANDED(), gH0 + dy)); panel.style.height = h + "px"; });
    const gEnd = () => { if (!gDrag) return; gDrag = false; const h = panel.getBoundingClientRect().height; if (gMoved < 4) { setExpanded(!this._optExpanded); } else { setExpanded(h >= (COLLAPSED + EXPANDED()) / 2); } };
    grab.addEventListener("pointerup", gEnd); grab.addEventListener("pointercancel", gEnd);
    panel.onwheel = (e) => {
      e.stopPropagation();
      if (!this._optExpanded && e.deltaY > 0) { e.preventDefault(); setExpanded(true); }
      else if (this._optExpanded && e.deltaY < 0 && scroller.scrollTop <= 0) { e.preventDefault(); setExpanded(false); }
    };

    // one motion: the row scrolls so the clicked card centers, while that card grows into the centered sheet
    const row = this.optionsRef.current;
    // SMOOTH SWITCH: if another card is already open, don't hard-reset to baseline (which jerks the row
    // left then back). Instead crossfade the slots — old card shrinks 660->150 while the new card grows
    // 150->660 and the row glides — keeping the strip's spacing continuous. Panel stays centred, content swaps.
    const prevCard = this._detailSrc;
    if (prevCard && srcCard && prevCard !== srcCard && row) {
      const W = Math.min(660, Math.round(window.innerWidth * 0.94));
      const offParent = panel.offsetParent || this.wrapRef.current;
      const opr = offParent.getBoundingClientRect();
      const sbW = (this.uiShift || 0) * this.sbOffset();            // open sidebar overlays the graph from the right
      const pcx = opr.left + (opr.width - sbW) / 2;       // centre of the VISIBLE graph, not the full play area
      const centerLeft = Math.round((opr.width - sbW - W) / 2);
      const savedTransform = row.style.transform;
      // freeze everything for hidden synchronous measurement (no paint until handler returns)
      row.style.transition = "none"; prevCard.style.transition = "none"; srcCard.style.transition = "none";
      // (a) TARGET layout: new=W, prev=150, flex-start, transform 0 -> new card's natural left
      row.style.transform = "none";
      prevCard.style.flex = "0 0 150px"; prevCard.style.width = "150px";
      srcCard.style.flex = "0 0 auto"; srcCard.style.width = W + "px";
      void row.offsetWidth;
      const Lnew = srcCard.getBoundingClientRect().left;
      const Fnew = Math.round(pcx - Lnew - W / 2);
      // (b) TRUE BASELINE (justify centre, all 150) -> panel collapse target + T0 for close
      row.style.justifyContent = "safe center"; row.style.overflowX = "auto"; row.style.overflowY = "hidden";
      srcCard.style.flex = "0 0 150px"; srcCard.style.width = "150px";
      row.scrollLeft = 0; void row.offsetWidth;
      const baseRect = srcCard.getBoundingClientRect();
      this._optStart = { left: Math.round(baseRect.left - opr.left), width: Math.round(baseRect.width), height: Math.round(baseRect.height), bottom: Math.round(opr.bottom - baseRect.bottom) };
      row.style.justifyContent = "flex-start"; row.style.overflow = "visible"; void row.offsetWidth;
      this._optT0 = Math.round(baseRect.left - srcCard.getBoundingClientRect().left);
      this._rowScrollAtOpen = 0;
      // (c) RESTORE pre-switch visual instantly (prev big+hidden, new small+visible, row where it was)
      prevCard.style.flex = "0 0 auto"; prevCard.style.width = W + "px"; prevCard.style.opacity = "0";
      srcCard.style.flex = "0 0 150px"; srcCard.style.width = "150px"; srcCard.style.opacity = "";
      row.style.transform = savedTransform;
      void row.offsetWidth;
      // (d) ANIMATE both slots + the row together
      prevCard.style.transition = "width .42s cubic-bezier(.2,.8,.2,1), opacity .3s ease";
      srcCard.style.transition = "width .42s cubic-bezier(.2,.8,.2,1), opacity .24s ease";
      row.style.transition = "transform .42s cubic-bezier(.2,.8,.2,1)";
      prevCard.style.flex = "0 0 150px"; prevCard.style.width = "150px"; prevCard.style.opacity = "";
      srcCard.style.flex = "0 0 auto"; srcCard.style.width = W + "px"; srcCard.style.opacity = "0";
      row.style.transform = "translateX(" + Fnew + "px)";
      this._detailSrc = srcCard;
      // panel stays centred — just swap content (already rebuilt above), no position animation
      panel.style.right = "auto"; panel.style.margin = "0"; panel.style.pointerEvents = "auto";
      panel.style.transition = "none"; panel.style.transform = "none"; panel.style.opacity = "1";
      panel.style.left = centerLeft + "px"; panel.style.width = W + "px"; panel.style.height = "400px"; panel.style.bottom = "0px";
      this.lastInteract = this.now;
      return;
    }
    // NORMALIZE first, UNCONDITIONALLY: return the row to its true baseline (overflow:auto, justify
    // reset, no transform, scroll 0) and collapse EVERY card slot back to 150px. This guarantees a clean
    // measurement even if a prior close's delayed reset was skipped (reopened mid-animation) — which is
    // what made the strip drift uncentred after several open/close cycles.
    if (row) {
      clearTimeout(this._optSettle);
      for (const ch of row.children) { ch.style.transition = "none"; ch.style.width = "150px"; ch.style.flex = "0 0 150px"; ch.style.opacity = ""; }
      row.style.transition = "none"; row.style.transform = "none";
      row.style.overflowX = "auto"; row.style.overflowY = "hidden"; row.style.webkitMaskImage = ""; row.style.maskImage = "";
      row.style.justifyContent = "safe center"; row.scrollLeft = 0;
      void row.offsetWidth;
    }
    this._detailSrc = null;
    // Measure the card's TRUE baseline on-screen position FIRST (centred layout, overflow:auto) —
    // this is where the panel animates from and the visual anchor we must not jump away from.
    const srcRect = srcCard ? srcCard.getBoundingClientRect() : null;
    this._detailSrc = srcCard || null;
    const hint = this.optionHintRef.current; if (hint) { hint.style.opacity = "0"; hint.style.pointerEvents = "none"; }
    const offParent = panel.offsetParent || this.wrapRef.current;
    const opr = offParent.getBoundingClientRect();
    const W = Math.min(660, Math.round(window.innerWidth * 0.94));
    const sbW = (this.uiShift || 0) * this.sbOffset();                    // open sidebar overlays the graph from the right
    const pcx = opr.left + (opr.width - sbW) / 2;            // centre of the VISIBLE graph (shifts left when sidebar open)
    const centerLeft = Math.round((opr.width - sbW - W) / 2);
    // Now force a deterministic, left-anchored, unclipped layout (flex-start + overflow:visible).
    // This is count-agnostic: it changes where the card sits (centring offset for few cards, scroll
    // reset for many) — so we re-measure and compensate by the delta, rather than reasoning about S/C.
    let srcFV = srcRect;
    if (row) {
      row.style.pointerEvents = "none";
      row.style.transition = "none";
      row.style.justifyContent = "flex-start";
      row.style.overflow = "visible"; row.style.webkitMaskImage = "none"; row.style.maskImage = "none";
      row.style.transform = "none";
      void row.offsetWidth;
      srcFV = srcCard ? srcCard.getBoundingClientRect() : srcRect;   // card position in the new layout (scroll forced to 0)
      this._rowScrollAtOpen = 0;
      for (const ch of row.children) ch.style.transition = "opacity .3s ease";
    }
    if (srcCard && srcRect && srcFV) {
      // T0 returns the card to its exact baseline position (cancels both the centring offset and scroll reset)
      const T0 = Math.round(srcRect.left - srcFV.left);
      this._optT0 = T0;
      row.style.transform = "translateX(" + T0 + "px)";
      void row.offsetWidth;
      srcCard.style.flex = "0 0 auto";
      srcCard.style.transition = "width .42s cubic-bezier(.2,.8,.2,1), opacity .24s ease";
      srcCard.style.opacity = "0";
      void srcCard.offsetWidth;
      srcCard.style.width = W + "px";
      // The clicked card is left-anchored, so widening keeps its left edge at srcFV.left; centre it on screen.
      const F = Math.round(pcx - srcFV.left - W / 2);
      row.style.transition = "transform .42s cubic-bezier(.2,.8,.2,1)";
      row.style.transform = "translateX(" + F + "px)";
    }
    panel.style.right = "auto"; panel.style.margin = "0"; panel.style.pointerEvents = "auto"; panel.style.opacity = "0"; panel.style.transform = "none";
    panel.style.transition = "none";
    this._optStart = null;
    if (srcRect) {
      this._optStart = { left: Math.round(srcRect.left - opr.left), width: Math.round(srcRect.width), height: Math.round(srcRect.height), bottom: Math.round(opr.bottom - srcRect.bottom) };
      panel.style.left = this._optStart.left + "px";
      panel.style.width = this._optStart.width + "px";
      panel.style.height = this._optStart.height + "px";
      panel.style.bottom = this._optStart.bottom + "px";
    } else {
      panel.style.left = centerLeft + "px"; panel.style.width = W + "px"; panel.style.height = "400px"; panel.style.bottom = "0px";
    }
    void panel.offsetWidth;        // commit the start frame (card-sized)
    panel.style.transition = "left .42s cubic-bezier(.2,.8,.2,1), width .42s cubic-bezier(.2,.8,.2,1), height .38s cubic-bezier(.2,.7,.2,1), bottom .42s cubic-bezier(.2,.8,.2,1), opacity .28s ease";
    panel.style.opacity = "1";
    panel.style.left = centerLeft + "px";
    panel.style.width = W + "px";
    panel.style.height = "400px";
    panel.style.bottom = "0px";
    this.lastInteract = this.now;
  }
  hideOptDetail() {
    const panel = this.optDetailRef.current;
    if (panel) { panel.style.transition = "opacity .2s ease, transform .26s ease"; panel.style.transform = "translateY(16px)"; panel.style.opacity = "0"; panel.style.pointerEvents = "none"; panel.onwheel = null; setTimeout(() => { if (panel.style.opacity === "0") panel.style.transform = "none"; }, 280); }
    if (this._detailSrc) { this._detailSrc.style.opacity = ""; this._detailSrc = null; }
  }
  closeOptionDetail() {
    this._detailCtx = null;
    this.clearClipLoops();
    clearTimeout(this._optSettle);
    const panel = this.optDetailRef.current;
    const row = this.optionsRef.current;
    // collapse the sheet back into the card's slot
    if (panel && this._optStart) {
      panel.style.transition = "left .34s cubic-bezier(.4,0,.2,1), width .34s cubic-bezier(.4,0,.2,1), height .34s cubic-bezier(.4,0,.2,1), bottom .34s cubic-bezier(.4,0,.2,1), opacity .3s ease";
      panel.style.opacity = "0";
      panel.style.left = this._optStart.left + "px"; panel.style.width = this._optStart.width + "px";
      panel.style.height = this._optStart.height + "px"; panel.style.bottom = this._optStart.bottom + "px";
      panel.style.pointerEvents = "none"; panel.onwheel = null;
    } else { this.hideOptDetail(); }
    // restore the clicked card's slot to its STANDARD size (never cleared, so it can't shrink)
    if (this._detailSrc) { const s = this._detailSrc; s.style.transition = "width .36s cubic-bezier(.4,0,.2,1), opacity .3s ease"; s.style.width = "150px"; s.style.flex = "0 0 150px"; s.style.opacity = ""; this._detailSrc = null; }
    if (row) { row.style.opacity = "1"; row.style.pointerEvents = "auto"; const S = this._rowScrollAtOpen || 0; const T0 = this._optT0 || 0; row.style.transition = "transform .4s cubic-bezier(.4,0,.2,1)"; row.style.transform = "translateX(" + T0 + "px)"; setTimeout(() => { if (!this._detailCtx) { row.style.transition = "none"; row.style.transform = "none"; row.style.overflowX = "auto"; row.style.overflowY = "hidden"; row.style.webkitMaskImage = ""; row.style.maskImage = ""; row.style.justifyContent = "safe center"; row.scrollLeft = S; } }, 400); }
    this.setPaused(false);
  }
  segBtn(label, active, locked, onClick) {
    const b = document.createElement("button");
    b.innerHTML = label + (locked ? ' <span style="opacity:.7;">\uD83D\uDD12</span>' : "");
    b.style.cssText = "cursor:" + (locked ? "not-allowed" : "pointer") + ";font-family:inherit;font-size:12.5px;font-weight:600;padding:8px 14px;border-radius:9px;border:1px solid " + (active ? "rgba(150,180,255,.6)" : "rgba(150,170,210,.18)") + ";background:" + (active ? "rgba(74,108,255,.26)" : "rgba(255,255,255,.03)") + ";color:" + (locked ? "#69748f" : active ? "#eef1f6" : "#aeb6c8") + ";";
    if (!locked) b.addEventListener("click", onClick);
    return b;
  }
  openSettings(tab) { this._settingsTab = tab || "flashcards"; this.track("neural_settings_opened", { tab: this._settingsTab }); this.openModal(); this.renderSettings(); }
  bucketTechniques(bucket) {
    // build a deck list from seeded decks + node families, tagged by bucket
    const decks = (this.flashcards && this.flashcards.decks) || {};
    const keys = Object.keys(decks);
    const prep = this.prep || {};
    if (bucket === "mastered") return keys.filter((k) => prep[k] > 0);
    if (bucket === "explored") return [...(this._exploredKeys || [])];
    if (bucket === "suggested") {
      // weakest-first, ONE entry per technique/position — deck keys come in Top/Bottom pairs of
      // the same base (and base positions' blended Top/Bottom decks are identical), which reads
      // as duplicated entries. Also make "your game" mean YOUR game: states you actually rolled
      // through but haven't drilled come first, then untouched decks, then low-rep ones.
      const seenBase = new Set();
      const uniq = (arr) => arr.filter((k) => { const f = k.split("|")[0]; if (seenBase.has(f)) return false; seenBase.add(f); return true; });
      const explored = this._exploredKeys ? [...this._exploredKeys] : [];
      const undoneExplored = explored.filter((k) => decks[k] && !prep[k]);
      const undone = keys.filter((k) => !prep[k]);
      const lowReps = keys.filter((k) => prep[k] > 0 && prep[k] < 3);
      return uniq(undoneExplored.concat(undone, lowReps)).slice(0, this.get("dailyGoal", 30));
    }
    if (bucket === "reviewing") return keys.filter((k) => prep[k] > 0 && prep[k] < 3);
    if (bucket === "due") return keys.filter((k) => prep[k] > 0).slice(0, 0); // none scheduled in guest mode
    return keys;
  }
  openFlashBrowser(bucket, label) {
    this._fbBucket = bucket; this._fbLabel = label; this.openModal(); this.renderFlashBrowser();
  }
  renderFlashBrowser() {
    const card = this.modalCardRef.current; if (!card) return;
    card.style.width = "min(460px,93vw)";
    const list = this.bucketTechniques(this._fbBucket);
    const decks = (this.flashcards && this.flashcards.decks) || {};
    const catCol = { Position: "#c9d2e3", Transition: "#9fb0d8", Submission: "#e8956b", Defense: "#e8956b" };
    card.innerHTML = "";
    const head = document.createElement("div");
    head.style.cssText = "padding:20px 22px 16px;border-bottom:1px solid rgba(150,170,210,.12);";
    head.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;"><div style="display:flex;align-items:center;gap:9px;">' + this.iconStack("#9fb0d8") + '<span style="font-size:18px;font-weight:700;color:#eef1f6;letter-spacing:-.01em;">' + this._fbLabel + '</span></div><span class="x" style="cursor:pointer;color:#8b97b0;font-size:20px;">&times;</span></div>' +
      '<div style="font-size:12.5px;color:#93a0bd;margin-top:5px;">' + list.length + (list.length === 1 ? " technique" : " techniques") + '</div>';
    head.querySelector(".x").addEventListener("click", () => this.closeModal());
    card.appendChild(head);
    const body = document.createElement("div");
    body.style.cssText = "padding:10px 14px 16px;max-height:54vh;overflow-y:auto;";
    if (!list.length) {
      body.innerHTML = '<div style="padding:34px 16px;text-align:center;color:#7e8aa3;font-size:13px;line-height:1.6;">' +
        (this._fbBucket === "due" ? "Nothing due right now. Drill cards and they\u2019ll resurface here on a spaced-repetition schedule once you have an account." :
         this._fbBucket === "explored" ? "States you land in during a roll show up here. Start rolling to populate it." :
         "Nothing here yet \u2014 drill some cards to fill this list.") + '</div>';
    } else {
      list.forEach((key) => {
        const fam = key.split("|")[0], role = key.split("|")[1] || "";
        const d = decks[key]; const cat = d ? d.cat : "Position";
        const prep = (this.prep || {})[key] || 0;
        const r = document.createElement("div");
        r.style.cssText = "display:flex;align-items:center;gap:11px;padding:11px 10px;border-radius:10px;cursor:pointer;transition:background .12s;";
        r.innerHTML =
          '<span style="width:9px;height:9px;border-radius:' + (cat === "Submission" ? "2px" : cat === "Transition" ? "2px" : "50%") + ';background:' + (catCol[cat] || "#9fb0d8") + ';flex:none;"></span>' +
          '<div style="flex:1;min-width:0;"><div style="font-size:13.5px;font-weight:600;color:#eef1f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + fam + '</div><div style="font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#7e8aa3;font-weight:600;margin-top:1px;">' + cat + ' \u00b7 ' + role + '</div></div>' +
          (prep > 0 ? '<span style="font-size:11px;font-weight:700;color:#7ee0a8;">\u2713 drilled</span>' : (d ? '<span style="font-size:11px;font-weight:600;color:#9ab0e0;">' + d.cards.length + ' cards</span>' : '<span style="font-size:11px;color:#69748f;">soon</span>')) +
          '<span style="color:#5d6883;font-size:14px;">\u203a</span>';
        r.addEventListener("mouseenter", () => r.style.background = "rgba(255,255,255,.04)");
        r.addEventListener("mouseleave", () => r.style.background = "transparent");
        r.addEventListener("click", () => { this.closeModal(); this.openStudy(key); });
        body.appendChild(r);
      });
    }
    card.appendChild(body);
  }
  openStudy(key) {
    // open the drill sidebar focused on this deck, regardless of current state
    this.drillEntries = [this._entryForKey(key)];
    this._posKey = key; this.activeDrill = 0; this.deckIdx = 0; this.revealed = false;
    this.renderDrill(); this.deckReady = true; this.deckOpen = true; this.applyDeckVisibility();
  }
  _entryForKey(key) {
    const decks = (this.flashcards && this.flashcards.decks) || {};
    const fam = key.split("|")[0], role = key.split("|")[1] || "Top";
    const d = decks[key];
    const cat = d ? d.cat : "Position";
    return { info: { fam: fam, role: role, cat: cat, key: key }, cards: d ? d.cards.slice() : null };
  }
  nodeForKey(key) {
    if (!this._keyNode) {
      this._keyNode = new Map();
      for (const n of this.nodes) { const k = this.deckKeyFor(n).key; if (!this._keyNode.has(k)) this._keyNode.set(k, n.idx); }
    }
    return this._keyNode.has(key) ? this._keyNode.get(key) : -1;
  }
  openSession(bucket, label) {
    const keys = this.bucketTechniques(bucket);
    this._session = { keys: keys, label: label, idx: 0 };
    this._sessionNodes = keys.map((k) => this.nodeForKey(k)).filter((i) => i >= 0);
    this.closeModal();
    // frame the highlighted nodes
    if (this._sessionNodes.length) {
      let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      for (const i of this._sessionNodes) { const n = this.nodes[i]; minx = Math.min(minx, n.x); maxx = Math.max(maxx, n.x); miny = Math.min(miny, n.y); maxy = Math.max(maxy, n.y); }
      this.camTarget = { cx: (minx + maxx) / 2, cy: (miny + maxy) / 2, vw: Math.max(this.graphW * 0.4, (maxx - minx) * 2.2) };
      this.lastInteract = 0; // let camera move
    }
    this.renderSession();
    this.deckReady = true; this.deckOpen = true; this.applyDeckVisibility();
  }
  renderSession() {
    const list = this.drillListRef.current; const s = this._session; if (!list || !s) return;
    { const foot = this.drillFootRef.current; if (foot) { foot.innerHTML = ""; foot.style.display = "none"; } }
    this.setDrillHeader(s.label, (s.idx + 1) + " of " + s.keys.length + " in session");
    const decks = (this.flashcards && this.flashcards.decks) || {};
    const catCol = { Position: "#c9d2e3", Transition: "#9fb0d8", Submission: "#e8956b", Defense: "#e8956b" };
    list.innerHTML = "";
    const intro = document.createElement("div");
    intro.style.cssText = "font-size:12px;color:#93a0bd;line-height:1.5;margin-bottom:12px;";
    intro.textContent = s.keys.length + " techniques highlighted on the graph. Run the session to drill them in order.";
    list.appendChild(intro);
    s.keys.forEach((key, i) => {
      const fam = key.split("|")[0], role = key.split("|")[1] || "";
      const d = decks[key]; const cat = d ? d.cat : "Position";
      const done = (this.prep || {})[key] > 0;
      const r = document.createElement("div");
      r.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px 11px;border-radius:10px;cursor:pointer;border:1px solid " + (i === s.idx ? "rgba(150,180,255,.5)" : "rgba(150,170,210,.12)") + ";background:" + (i === s.idx ? "rgba(58,72,118,.5)" : "rgba(255,255,255,.025)") + ";margin-bottom:7px;";
      r.innerHTML =
        '<span style="width:9px;height:9px;border-radius:' + (cat === "Position" ? "50%" : "2px") + ';background:' + (catCol[cat] || "#9fb0d8") + ';flex:none;"></span>' +
        '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;color:#eef1f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + fam + '</div><div style="font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#7e8aa3;font-weight:600;margin-top:1px;">' + cat + ' \u00b7 ' + role + '</div></div>' +
        (done ? '<span style="color:#7ee0a8;font-size:12px;">\u2713</span>' : (d ? '<span style="font-size:10.5px;color:#9ab0e0;">' + d.cards.length + '</span>' : '<span style="font-size:10px;color:#69748f;">soon</span>'));
      r.addEventListener("click", () => { s.idx = i; const idx = this.nodeForKey(key); if (idx >= 0) this.locateNode(idx); this.studyFromSession(key); });
      list.appendChild(r);
    });
    const play = document.createElement("button");
    play.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right:7px;vertical-align:-2px;"><path d="M7 5v14l12-7z"></path></svg>Start session';
    play.style.cssText = "width:100%;margin-top:6px;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:700;padding:12px;border-radius:11px;border:none;background:linear-gradient(135deg,#4a6cff,#6a5cff);color:#fff;box-shadow:0 4px 16px rgba(74,108,255,.35);";
    play.addEventListener("click", () => { s.idx = 0; const idx = this.nodeForKey(s.keys[0]); if (idx >= 0) this.locateNode(idx); this.studyFromSession(s.keys[0]); });
    list.appendChild(play);
  }
  studyFromSession(key) {
    this.drillEntries = [this._entryForKey(key)];
    this._posKey = key; this.activeDrill = 0; this.deckIdx = 0; this.revealed = false;
    this._inSession = true;
    this.renderDrill(); this.deckReady = true; this.deckOpen = true; this.applyDeckVisibility();
  }
  renderSettings() {
    const card = this.modalCardRef.current; if (!card) return;
    card.style.width = "min(440px,92vw)";
    const tab = this._settingsTab || "flashcards";
    card.innerHTML = "";
    const head = document.createElement("div");
    head.style.cssText = "padding:20px 22px 0;";
    head.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;"><div style="font-size:20px;font-weight:700;color:#eef1f6;letter-spacing:-.01em;">Settings</div><span class="x" style="cursor:pointer;color:#8b97b0;font-size:20px;">&times;</span></div>' +
      // owner-requested disclaimer — first thing the user reads when opening settings
      '<div style="margin-top:14px;padding:11px 13px;border:1px solid rgba(232,184,107,.28);border-radius:10px;background:rgba(232,168,90,.08);display:flex;gap:9px;align-items:flex-start;">' +
        '<span style="flex:none;font-size:13px;line-height:1.4;">⚠️</span>' +
        '<span style="font-size:12px;line-height:1.5;color:#e8c9a0;">BJJ Graph is still being actively built — the success rates and probabilities you see are being continuously fine-tuned and will keep improving.</span>' +
      '</div>' +
      '<div style="display:flex;gap:22px;margin-top:18px;border-bottom:1px solid rgba(150,170,210,.12);">' +
        '<span class="t-fc" style="cursor:pointer;padding-bottom:11px;font-size:13.5px;font-weight:600;color:' + (tab === "flashcards" ? "#eef1f6" : "#8b97b0") + ';border-bottom:2px solid ' + (tab === "flashcards" ? "#7e9bff" : "transparent") + ';">Flashcards</span>' +
        '<span class="t-rl" style="cursor:pointer;padding-bottom:11px;font-size:13.5px;font-weight:600;color:' + (tab === "rolling" ? "#eef1f6" : "#8b97b0") + ';border-bottom:2px solid ' + (tab === "rolling" ? "#7e9bff" : "transparent") + ';">Rolling</span>' +
        '<span class="t-md" style="cursor:pointer;padding-bottom:11px;font-size:13.5px;font-weight:600;color:' + (tab === "modifiers" ? "#eef1f6" : "#8b97b0") + ';border-bottom:2px solid ' + (tab === "modifiers" ? "#7e9bff" : "transparent") + ';">Modifiers</span>' +
        '<span class="t-kb" style="cursor:pointer;padding-bottom:11px;font-size:13.5px;font-weight:600;color:' + (tab === "shortcuts" ? "#eef1f6" : "#8b97b0") + ';border-bottom:2px solid ' + (tab === "shortcuts" ? "#7e9bff" : "transparent") + ';">Shortcuts</span>' +
      '</div>';
    head.querySelector(".x").addEventListener("click", () => this.closeModal());
    head.querySelector(".t-kb").addEventListener("click", () => { this._settingsTab = "shortcuts"; this.renderSettings(); });
    head.querySelector(".t-fc").addEventListener("click", () => { this._settingsTab = "flashcards"; this.renderSettings(); });
    head.querySelector(".t-rl").addEventListener("click", () => { this._settingsTab = "rolling"; this.renderSettings(); });
    head.querySelector(".t-md").addEventListener("click", () => { this._settingsTab = "modifiers"; this.renderSettings(); });
    card.appendChild(head);

    const body = document.createElement("div");
    body.style.cssText = "padding:18px 22px 22px;overflow-y:auto;max-height:min(64vh,560px);";
    if (tab === "flashcards") {
      // daily goal
      const g = document.createElement("div");
      g.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px;";
      g.innerHTML = '<div><div style="font-size:14px;font-weight:600;color:#eef1f6;">Daily goal</div><div style="font-size:12px;color:#93a0bd;margin-top:3px;">Techniques to review or learn each day</div></div>';
      const inp = document.createElement("input");
      inp.type = "number"; inp.value = this.get("dailyGoal", 30); inp.min = "5"; inp.max = "200";
      inp.style.cssText = "width:74px;font-family:inherit;font-size:14px;font-weight:600;color:#eef1f6;background:rgba(255,255,255,.04);border:1px solid rgba(150,170,210,.25);border-radius:9px;padding:9px 11px;text-align:center;";
      inp.addEventListener("change", () => { this.set("dailyGoal", Math.max(5, Math.min(200, parseInt(inp.value) || 30))); inp.value = this.get("dailyGoal", 30); });
      g.appendChild(inp); body.appendChild(g);
      // study order
      body.appendChild(this.settingRow("Study order", "Which cards to surface first",
        [["Weakest spots", "weakest"], ["Newest", "new"], ["Due first", "due"]], "studyOrder", "weakest"));
      // focus
      body.appendChild(this.settingRow("Focus", "Shore up weaknesses, or sharpen strengths",
        [["Antifragile", "antifragile"], ["Converge", "converge"]], "focus", "antifragile",
        { antifragile: '<b style="color:#cbd4e6;">Antifragile</b> &mdash; a solid, well-rounded game. Surfaces cards from the spots you\u2019re weakest, so you have no holes to be exploited.',
          converge: '<b style="color:#cbd4e6;">Converge</b> &mdash; competition focus. Builds the most effective gameplan from your strongest modifiers, steering rolls toward the states you finish from.' }));
      // toggle
      const tg = document.createElement("div");
      tg.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:20px;";
      tg.innerHTML = '<div><div style="font-size:14px;font-weight:600;color:#eef1f6;">Show flashcards on pages</div><div style="font-size:12px;color:#93a0bd;margin-top:3px;">Display a quiz pill on each technique</div></div>';
      const cb = document.createElement("button");
      const on = this.get("quizOnPages", true);
      cb.innerHTML = on ? "\u2713" : "";
      cb.style.cssText = "width:24px;height:24px;border-radius:7px;cursor:pointer;border:1px solid " + (on ? "rgba(110,160,255,.6)" : "rgba(150,170,210,.3)") + ";background:" + (on ? "rgba(74,108,255,.4)" : "transparent") + ";color:#fff;font-size:13px;font-weight:700;";
      cb.addEventListener("click", () => { this.set("quizOnPages", !this.get("quizOnPages", true)); this.renderSettings(); });
      tg.appendChild(cb); body.appendChild(tg);
    } else if (tab === "rolling") {
      const r = document.createElement("div");
      r.innerHTML = '<div style="font-size:15px;font-weight:600;color:#eef1f6;">Rolling simulation</div><div style="font-size:12.5px;color:#93a0bd;margin-top:5px;line-height:1.5;margin-bottom:16px;">When you pick a move, a dice-roll plays out against an AI opponent &mdash; success depends on the move\u2019s win % (boosted by your mastery).</div>';
      body.appendChild(r);
      const seg = document.createElement("div");
      seg.style.cssText = "display:flex;gap:9px;flex-wrap:wrap;margin-bottom:22px;";
      const diff = this.get("difficulty", "normal");
      seg.appendChild(this.segBtn("Off", diff === "off", false, () => { this.set("difficulty", "off"); this.renderSettings(); }));
      seg.appendChild(this.segBtn("Normal", diff === "normal", false, () => { this.set("difficulty", "normal"); this.renderSettings(); }));
      seg.appendChild(this.segBtn("Hard", false, true));
      seg.appendChild(this.segBtn("Ultra", false, true));
      body.appendChild(seg);
      // decision time pace
      const dt = document.createElement("div");
      dt.style.cssText = "border-top:1px solid rgba(150,170,210,.12);padding-top:16px;margin-bottom:18px;";
      const dsecBase = this.get("decisionSec", 9);
      dt.innerHTML =
        '<div style="display:flex;align-items:baseline;justify-content:space-between;"><div style="font-size:14px;font-weight:600;color:#eef1f6;">Decision time</div><div style="font-size:13px;font-weight:700;color:#9ab0e0;font-family:\'Space Grotesk\',sans-serif;"><span class="paceVal">' + dsecBase + '</span>s</div></div>' +
        '<div style="font-size:12.5px;color:#93a0bd;margin-top:4px;line-height:1.5;">How long you get to read options and drill the current state\u2019s flashcards before the roll moves on. The card box grays out as time runs down.</div>';
      const slider = document.createElement("input");
      slider.type = "range"; slider.min = "5"; slider.max = "15"; slider.step = "1"; slider.value = String(dsecBase);
      slider.style.cssText = "width:100%;margin-top:13px;accent-color:#5b8cff;cursor:pointer;";
      slider.addEventListener("input", () => { const v = parseInt(slider.value); this.set("decisionSec", v); const lab = dt.querySelector(".paceVal"); if (lab) lab.textContent = v; });
      dt.appendChild(slider);
      const ticks = document.createElement("div");
      ticks.style.cssText = "display:flex;justify-content:space-between;font-size:10px;color:#6b7691;font-weight:600;margin-top:2px;";
      ticks.innerHTML = "<span>Brisk</span><span>Default</span><span>Relaxed</span>";
      dt.appendChild(ticks);
      body.appendChild(dt);
      // option ordering
      body.appendChild(this.settingRow("Option ordering", "How the move options are ranked, left to right",
        [["Potential", "potential"], ["Popularity", "popularity"]], "cardOrder", "potential",
        { potential: '<b style="color:#cbd4e6;">Potential</b> &mdash; a Bayesian estimate blending how likely you are to land the move, how strong the resulting position is, and how many follow-ups it opens. The highest-leverage move sits first.',
          popularity: '<b style="color:#cbd4e6;">Popularity</b> &mdash; how often the move gets picked from here across rolls. Common, well-trodden paths sit first.' }));
    } else if (tab === "modifiers") {
      this.buildModifiers(body);
    } else {
      const rows = [
        ["Play / pause roll", ["Space", "P"]],
        ["Open card detail", ["1\u20139"]],
        ["Execute technique", ["\u23ce", "X"]],
        ["Flashcards: prev / next card", ["\u2190", "\u2192"]],
        ["Flashcards: prev / next technique", ["\u2191", "\u2193"]],
        ["Flashcards: flip / got it", ["Space"]],
        ["Flashcards: review again", ["\u2191"]],
        ["Open / search explorer", ["/", "\u2318K"]],
        ["Close detail / explorer", ["Esc"]],
        ["Pan the graph", ["Drag"]],
        ["Zoom the graph", ["Scroll"]],
      ];
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;flex-direction:column;gap:2px;";
      for (const [label, keys] of rows) {
        const r = document.createElement("div");
        r.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 2px;border-bottom:1px solid rgba(150,170,210,.08);";
        const kb = keys.map((k) => '<kbd style="font-family:inherit;font-size:11.5px;font-weight:600;color:#cbd4e6;background:rgba(255,255,255,.06);border:1px solid rgba(150,170,210,.22);border-bottom-width:2px;border-radius:6px;padding:3px 8px;">' + k + '</kbd>').join('<span style="color:#6b7691;font-size:11px;margin:0 5px;">or</span>');
        r.innerHTML = '<span style="font-size:13.5px;color:#dbe2f0;">' + label + '</span><span style="display:flex;align-items:center;">' + kb + '</span>';
        wrap.appendChild(r);
      }
      body.appendChild(wrap);
    }
    card.appendChild(body);
  }
  ensureMods() {
    if (this.userMods) return;
    this.userMods = [
      { name: "Triangle Choke", cat: "Submission", pct: 64, on: true },
      { name: "Knee Cut Pass", cat: "Transition", pct: 58, on: true },
      { name: "Closed Guard", cat: "Position", pct: 72, on: true },
    ];
  }
  buildModifiers(host) {
    this.ensureMods();
    host.innerHTML = "";
    const head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;";
    const active = this.userMods.filter((m) => m.on).length;
    head.innerHTML = '<div><div style="font-size:14px;font-weight:600;color:#eef1f6;">Your modifiers</div><div style="font-size:12px;color:#93a0bd;margin-top:3px;">Per-technique success rate that overrides the base win %</div></div><div style="font-size:12px;font-weight:600;color:#7ee0a8;white-space:nowrap;">' + active + ' active</div>';
    host.appendChild(head);

    const catCol = { Submission: "#e8956b", Transition: "#9fb0d8", Position: "#7ee0a8" };
    const q = (this._modQuery || "").trim().toLowerCase();
    const catF = this._modCat || "All";

    // search + category filter
    const tools = document.createElement("div");
    tools.style.cssText = "display:flex;flex-direction:column;gap:9px;margin-bottom:12px;";
    const sb = document.createElement("div");
    sb.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 11px;border-radius:9px;border:1px solid rgba(150,170,210,.2);background:rgba(255,255,255,.035);";
    sb.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b97b0" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.2-3.2"></path></svg>';
    const search = document.createElement("input");
    search.placeholder = "Search modifiers\u2026"; search.value = this._modQuery || "";
    search.style.cssText = "flex:1;min-width:0;font-family:inherit;font-size:13px;color:#eef1f6;background:transparent;border:none;outline:none;";
    search.addEventListener("input", () => { this._modQuery = search.value; this.buildModifiers(host); });
    sb.appendChild(search);
    if (q) {
      const clr = document.createElement("button");
      clr.innerHTML = "&times;"; clr.title = "Clear";
      clr.style.cssText = "flex:none;width:18px;height:18px;cursor:pointer;border:none;background:transparent;color:#8b97b0;font-size:16px;line-height:1;";
      clr.addEventListener("click", () => { this._modQuery = ""; this.buildModifiers(host); });
      sb.appendChild(clr);
    }
    tools.appendChild(sb);
    const chips = document.createElement("div");
    chips.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";
    ["All", "Submission", "Transition", "Position"].forEach((c) => {
      const on = catF === c;
      const b = document.createElement("button");
      b.textContent = c;
      const cc = catCol[c] || "#9fb0d8";
      b.style.cssText = "cursor:pointer;font-family:inherit;font-size:11px;font-weight:600;padding:5px 11px;border-radius:999px;border:1px solid " + (on ? cc + "99" : "rgba(150,170,210,.18)") + ";background:" + (on ? cc + "22" : "transparent") + ";color:" + (on ? "#eef1f6" : "#9aa6bd") + ";";
      b.addEventListener("click", () => { this._modCat = c; this.buildModifiers(host); });
      chips.appendChild(b);
    });
    tools.appendChild(chips);
    host.appendChild(tools);

    const matches = (m) => (catF === "All" || m.cat === catF) && (!q || m.name.toLowerCase().includes(q));
    const shownCount = this.userMods.filter(matches).length;

    const list = document.createElement("div");
    list.style.cssText = "display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;margin:0 -4px;padding:0 4px;";
    this.userMods.forEach((m, i) => {
      if (!matches(m)) return;
      const r = document.createElement("div");
      r.style.cssText = "display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:11px;border:1px solid rgba(150,170,210,.14);background:" + (m.on ? "rgba(255,255,255,.035)" : "rgba(255,255,255,.012)") + ";opacity:" + (m.on ? "1" : ".55") + ";";
      // toggle dot
      const dot = document.createElement("button");
      dot.title = m.on ? "Active" : "Paused";
      dot.style.cssText = "flex:none;width:11px;height:11px;border-radius:50%;cursor:pointer;border:none;background:" + (m.on ? (catCol[m.cat] || "#7ee0a8") : "#48506a") + ";box-shadow:" + (m.on ? "0 0 8px " + (catCol[m.cat] || "#7ee0a8") : "none") + ";";
      dot.addEventListener("click", () => { m.on = !m.on; this.buildModifiers(host); });
      // label
      const lab = document.createElement("div");
      lab.style.cssText = "flex:1;min-width:0;";
      lab.innerHTML = '<div style="font-size:13px;font-weight:600;color:#eef1f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + this.hl(m.name, q) + '</div><div style="font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:' + (catCol[m.cat] || "#9aa6bd") + ';font-weight:700;margin-top:2px;">' + m.cat + '</div>';
      // stepper
      const step = document.createElement("div");
      step.style.cssText = "display:flex;align-items:center;gap:3px;flex:none;";
      const mkStep = (txt, d) => { const b = document.createElement("button"); b.textContent = txt; b.style.cssText = "width:22px;height:22px;cursor:pointer;border-radius:6px;border:1px solid rgba(150,170,210,.22);background:rgba(255,255,255,.04);color:#c3cde0;font-size:14px;line-height:1;font-family:inherit;"; b.addEventListener("click", () => { m.pct = Math.max(0, Math.min(100, m.pct + d)); this.buildModifiers(host); }); return b; };
      const val = document.createElement("span"); val.textContent = m.pct + "%"; val.style.cssText = "width:42px;text-align:center;font-size:13px;font-weight:700;color:#7ee0a8;";
      step.appendChild(mkStep("\u2212", -1)); step.appendChild(val); step.appendChild(mkStep("+", 1));
      // delete
      const del = document.createElement("button");
      del.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"></path></svg>';
      del.title = "Remove"; del.style.cssText = "flex:none;width:26px;height:26px;cursor:pointer;border-radius:7px;border:none;background:transparent;color:#7e8aa3;display:flex;align-items:center;justify-content:center;";
      del.addEventListener("mouseenter", () => del.style.color = "#e8767a");
      del.addEventListener("mouseleave", () => del.style.color = "#7e8aa3");
      del.addEventListener("click", () => { this.userMods.splice(i, 1); this.buildModifiers(host); });
      r.appendChild(dot); r.appendChild(lab); r.appendChild(step); r.appendChild(del);
      list.appendChild(r);
    });
    host.appendChild(list);

    if (!shownCount) {
      const empty = document.createElement("div");
      empty.style.cssText = "font-size:12.5px;color:#7e8aa3;padding:14px 4px;text-align:center;";
      empty.textContent = this.userMods.length ? "No modifiers match your search." : "No modifiers yet. Add one to override a move\u2019s base win %.";
      host.appendChild(empty);
    }

    // create
    if (this._addMod) {
      const form = document.createElement("div");
      form.style.cssText = "margin-top:10px;padding:12px;border:1px solid rgba(110,160,255,.3);border-radius:11px;background:rgba(74,108,255,.07);display:flex;flex-direction:column;gap:9px;";
      const inp = document.createElement("input");
      inp.placeholder = "Technique name"; inp.style.cssText = "font-family:inherit;font-size:13px;color:#eef1f6;background:rgba(255,255,255,.05);border:1px solid rgba(150,170,210,.25);border-radius:8px;padding:9px 11px;outline:none;";
      const cats = document.createElement("div"); cats.style.cssText = "display:flex;gap:6px;";
      let pickCat = "Submission";
      ["Submission", "Transition", "Position"].forEach((c) => { const b = this.segBtn(c, c === pickCat, false, () => { pickCat = c; [...cats.children].forEach((x, j) => { const on = ["Submission", "Transition", "Position"][j] === pickCat; x.style.background = on ? "rgba(74,108,255,.26)" : "rgba(255,255,255,.03)"; x.style.color = on ? "#eef1f6" : "#aeb6c8"; x.style.borderColor = on ? "rgba(150,180,255,.6)" : "rgba(150,170,210,.18)"; }); }); b.style.flex = "1"; b.style.fontSize = "11.5px"; b.style.padding = "7px 4px"; cats.appendChild(b); });
      const acts = document.createElement("div"); acts.style.cssText = "display:flex;gap:8px;";
      const save = this.segBtn("Add modifier", true, false, () => { const nm = inp.value.trim(); if (nm) { this.userMods.push({ name: nm, cat: pickCat, pct: 50, on: true }); } this._addMod = false; this.buildModifiers(host); });
      save.style.flex = "1";
      const cancel = this.segBtn("Cancel", false, false, () => { this._addMod = false; this.buildModifiers(host); });
      acts.appendChild(cancel); acts.appendChild(save);
      form.appendChild(inp); form.appendChild(cats); form.appendChild(acts);
      host.appendChild(form);
      setTimeout(() => { try { inp.focus(); } catch (e) {} }, 50);
    } else {
      const add = document.createElement("button");
      add.innerHTML = '<span style="font-size:15px;">+</span> Add modifier';
      add.style.cssText = "margin-top:11px;width:100%;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;padding:10px;border-radius:10px;border:1px dashed rgba(150,170,210,.3);background:transparent;color:#aeb6c8;display:flex;align-items:center;justify-content:center;gap:6px;";
      add.addEventListener("click", () => { this._addMod = true; this.buildModifiers(host); });
      host.appendChild(add);
    }
  }
  modifierCount() { const p = this.prep || {}; return Object.keys(p).filter((k) => p[k] > 0).length; }
  settingRow(title, sub, options, key, def, notes) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "margin-bottom:20px;";
    wrap.innerHTML = '<div style="font-size:14px;font-weight:600;color:#eef1f6;">' + title + '</div><div style="font-size:12px;color:#93a0bd;margin-top:3px;margin-bottom:11px;">' + sub + '</div>';
    const seg = document.createElement("div");
    seg.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
    const curr = this.get(key, def);
    options.forEach(([lab, v]) => seg.appendChild(this.segBtn(lab, curr === v, false, () => { this.set(key, v); this.renderSettings(); })));
    wrap.appendChild(seg);
    if (notes && notes[curr]) {
      const nt = document.createElement("div");
      nt.style.cssText = "font-size:12px;color:#93a0bd;line-height:1.5;margin-top:10px;padding:9px 11px;background:rgba(255,255,255,.03);border:1px solid rgba(150,170,210,.12);border-radius:9px;";
      nt.innerHTML = notes[curr];
      wrap.appendChild(nt);
    }
    return wrap;
  }
  openAuth(mode) { this._authMode = mode || "create"; this.openModal(); this.renderAuth(); }
  // ---------- real auth via the page's Supabase facade (window.__bjjAuth, see supabase.ts) ----------
  _auth() { const A = window.__bjjAuth; return (A && typeof A.isAuthenticated === "function") ? A : null; }
  async _initAuth() {
    const A = this._auth(); if (!A) return; // facade absent (no Supabase config) -> guest-only, zero UX change
    try {
      if (A.isAuthenticated()) {
        await A.ensureClientInitialized();
        const sess = await A.getSession();
        if (sess && sess.user) this._applyUser(sess.user);
        await this._pullAndMerge();
      }
      if (A.onAuthChange) A.onAuthChange((event, session) => {
        if (event === "SIGNED_IN" && session && session.user) {
          this._applyUser(session.user); this._pullAndMerge();
          this.track("neural_signin_completed", { method: this._authMethod || "session" });
        } else if (event === "SIGNED_OUT") {
          this.user = null; this._pulled = false; this.updateAccountUI();
        }
      });
    } catch (e) { /* auth is optional — guest experience stands */ }
  }
  _applyUser(u) {
    const email = u.email || "";
    const name = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || (email ? email.split("@")[0] : "You");
    this.user = { name: name, initial: (name[0] || "Y").toUpperCase() };
    this.updateAccountUI();
  }
  // merge-on-pull: per-key max for prep/days (monotonic counters), settings LWW by updatedAt.
  async _pullAndMerge() {
    const A = this._auth(); if (!A || !A.pullNeural) return;
    try {
      const cloud = await A.pullNeural();
      if (cloud && cloud.v === 1) {
        const prep = this.prep || {}, days = this._days || {};
        for (const k in (cloud.prep || {})) prep[k] = Math.max(prep[k] || 0, cloud.prep[k] || 0);
        for (const d in (cloud.days || {})) days[d] = Math.max(days[d] || 0, cloud.days[d] || 0);
        this.prep = prep; this._days = days;
        const localAt = this._progressAt || 0;
        if (cloud.settings && (cloud.updatedAt || 0) > localAt) this.settings = Object.assign({}, this.settings, cloud.settings);
        this.cardsToday = days[this._dayKey()] || 0;
      }
      this._pulled = true;          // a fresh device must pull before it may push (no cloud clobber)
      this._saveProgress();         // persist merged state + push it back
      this.updateDrillTab();
    } catch (e) { /* keep local on any failure */ }
  }
  _pushCloud() {
    const A = this._auth(); if (!A || !A.pushNeural || !this._pulled) return;
    try { if (!A.isAuthenticated()) return; } catch (e) { return; }
    clearTimeout(this._pushT);
    this._pushT = setTimeout(() => { try { A.pushNeural(this._progressBlob()); } catch (e) { /* retry on next save */ } }, 500);
  }
  updateAccountUI() {
    const chip = this.acctChipRef.current; if (!chip) return;
    const cta = this.acctCtaRef.current;
    if (this.user) {
      chip.children[0].textContent = this.user.name;
      const av = chip.children[1]; av.textContent = this.user.initial;
      av.style.background = "linear-gradient(135deg,#1f8a5b,#2a6fdb)";
      if (cta) cta.style.display = "none";
    } else {
      chip.children[0].textContent = "Guest";
      chip.children[1].textContent = "G";
      if (cta) cta.style.display = "";
    }
  }
  renderAuth() {
    const card = this.modalCardRef.current; if (!card) return;
    card.style.width = "min(440px,92vw)";
    const mode = this._authMode || "create";
    card.innerHTML = "";
    const b = document.createElement("div");
    b.style.cssText = "padding:26px 26px 28px;";
    b.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><div style="display:flex;align-items:center;gap:9px;">' + this.iconStack("#7e9bff") + '<span style="font-size:17px;font-weight:700;color:#eef1f6;font-family:\'Space Grotesk\',sans-serif;">bjjgraph<span style="color:#7b8aa8;">.org</span></span></div><span class="x" style="cursor:pointer;color:#8b97b0;font-size:20px;">&times;</span></div>' +
      '<div style="font-size:21px;font-weight:700;color:#eef1f6;letter-spacing:-.01em;margin-top:14px;">' + (mode === "create" ? "Create your account" : "Welcome back") + '</div>' +
      '<div style="font-size:13px;color:#93a0bd;margin-top:6px;line-height:1.5;">' + (mode === "create" ? "Keep your drilled reps, progress and rolling stats across sessions." : "Log back in and pick up where you left off.") + '</div>';
    // email + password (real Supabase auth via the page facade; guest-only when unconfigured)
    const A = this._auth();
    const inp = document.createElement("input");
    inp.type = "email"; inp.placeholder = "you@email.com"; inp.autocomplete = "email";
    inp.style.cssText = "width:100%;margin-top:20px;font-family:inherit;font-size:14px;color:#eef1f6;background:rgba(255,255,255,.04);border:1px solid rgba(150,170,210,.25);border-radius:11px;padding:13px 14px;box-sizing:border-box;";
    b.appendChild(inp);
    const pw = document.createElement("input");
    pw.type = "password"; pw.placeholder = mode === "create" ? "Choose a password (8+ characters)" : "Password";
    pw.autocomplete = mode === "create" ? "new-password" : "current-password";
    pw.style.cssText = "width:100%;margin-top:9px;font-family:inherit;font-size:14px;color:#eef1f6;background:rgba(255,255,255,.04);border:1px solid rgba(150,170,210,.25);border-radius:11px;padding:13px 14px;box-sizing:border-box;";
    b.appendChild(pw);
    const err = document.createElement("div");
    err.style.cssText = "display:none;margin-top:9px;font-size:12px;line-height:1.45;color:#ff9a8f;";
    b.appendChild(err);
    const showErr = (m) => { err.textContent = m; err.style.display = "block"; };
    const cont = document.createElement("button");
    cont.textContent = mode === "create" ? "Create account" : "Log in";
    cont.style.cssText = "width:100%;margin-top:11px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;padding:13px;border-radius:11px;border:none;background:linear-gradient(135deg,#4a6cff,#6a5cff);color:#fff;";
    cont.addEventListener("click", async () => {
      if (!A) { showErr("Accounts aren\u2019t available right now \u2014 your progress is saved on this device."); return; }
      const email = inp.value.trim(), pass = pw.value;
      if (!email || !pass) { showErr("Enter your email and password."); return; }
      err.style.display = "none"; cont.disabled = true; const label = cont.textContent; cont.textContent = "\u2026";
      this._authMethod = "email"; this.track("neural_signin_started", { method: "email", mode: mode });
      try {
        if (mode === "create") await A.signUp(email, pass); else await A.signIn(email, pass);
        this.closeModal(); // SIGNED_IN handler applies identity + pulls; sign-up may require email confirm
        if (mode === "create") this.showCenter && this.showCenter("Check your inbox", "Confirm your email to finish creating the account", "", "muted", true);
      } catch (e2) {
        showErr((e2 && e2.message) || "Sign-in failed \u2014 check your details and try again.");
        cont.disabled = false; cont.textContent = label;
      }
    });
    b.appendChild(cont);
    // divider + Google (Apple dropped — provider not configured)
    const div = document.createElement("div");
    div.style.cssText = "display:flex;align-items:center;gap:12px;margin:18px 0;color:#6b7691;font-size:11px;";
    div.innerHTML = '<div style="flex:1;height:1px;background:rgba(150,170,210,.15);"></div>OR<div style="flex:1;height:1px;background:rgba(150,170,210,.15);"></div>';
    b.appendChild(div);
    {
      const sb = document.createElement("button");
      sb.textContent = "Continue with Google";
      sb.style.cssText = "width:100%;margin-bottom:9px;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:600;padding:12px;border-radius:11px;border:1px solid rgba(150,170,210,.25);background:rgba(255,255,255,.03);color:#dbe2f0;";
      sb.addEventListener("click", async () => {
        if (!A) { showErr("Accounts aren\u2019t available right now \u2014 your progress is saved on this device."); return; }
        this._authMethod = "google"; this.track("neural_signin_started", { method: "google", mode: mode });
        try { await A.signInWithGoogle(); } catch (e2) { showErr((e2 && e2.message) || "Google sign-in failed."); } // PKCE redirect navigates away on success
      });
      b.appendChild(sb);
    }
    const sw = document.createElement("div");
    sw.style.cssText = "text-align:center;margin-top:14px;font-size:12.5px;color:#93a0bd;";
    sw.innerHTML = (mode === "create" ? "Already have an account? " : "New here? ") + '<span class="sw" style="cursor:pointer;color:#9ab0e0;font-weight:600;">' + (mode === "create" ? "Log in" : "Create account") + '</span>';
    sw.querySelector(".sw").addEventListener("click", () => { this._authMode = mode === "create" ? "login" : "create"; this.renderAuth(); });
    b.appendChild(sw);
    b.querySelector(".x").addEventListener("click", () => this.closeModal());
    card.appendChild(b);
  }

  // ---------- explorer + search ----------
  buildExplorer() {
    if (this._explorer && this._explorerGi === (this._giMode || "gi")) return this._explorer;
    this._explorerGi = this._giMode || "gi";
    const groups = { positions: {}, transitions: {}, submissions: {} };
    for (const n of this.nodes) {
      const g = groups[n.ty]; if (!g) continue;
      if (!this.giAllows(n)) continue;
      const fam = n.ty === "positions" ? this.posFamily(n.t) : this.splitName(n.t).main;
      (g[fam] = g[fam] || []).push(n);
    }
    this._explorer = { order: [["Positions", "positions"], ["Transitions", "transitions"], ["Submissions", "submissions"]], groups: groups };
    return this._explorer;
  }
  toggleExplorer() {
    const el = this.explorerRef.current; if (!el) return;
    if (el.style.display === "flex") {
      el.style.display = "none"; this._dossierIdx = null;
      if (this._explorerAutoPaused) { this.setPaused(false); this._explorerAutoPaused = false; }
    }
    else {
      this.openExplorer(); this.showExplorerList();
      const inp = this.explorerSearchRef.current;
      setTimeout(() => { try { if (inp) inp.focus(); } catch (e) {} }, 80);
    }
    this.lastInteract = this.now;
  }
  openExplorer() {
    const el = this.explorerRef.current; if (!el) return;
    if (el.style.display !== "flex") {
      el.style.display = "flex";
      if (!this.paused) { this.setPaused(true); this._explorerAutoPaused = true; }
    }
    const inp = this.explorerSearchRef.current;
    if (inp && !inp._wired) {
      inp._wired = true;
      inp.addEventListener("input", () => { this._exQ = inp.value; this.showExplorerList(); });
      inp.addEventListener("pointerdown", (e) => e.stopPropagation());
    }
    if (this._giMode == null) { try { this._giMode = localStorage.getItem("bjj_gi_mode") === "nogi" ? "nogi" : "gi"; } catch (e) { this._giMode = "gi"; } }
    const gt = this.giToggleRef.current;
    if (gt && !gt._wired) {
      gt._wired = true;
      gt.addEventListener("pointerdown", (e) => e.stopPropagation());
      gt.querySelectorAll("[data-gi]").forEach((s) => s.addEventListener("click", () => this.setGiMode(s.getAttribute("data-gi"))));
    }
    this.styleGiToggle();
  }
  setGiMode(m) {
    if (m !== "gi" && m !== "nogi") return;
    this._giMode = m;
    try { localStorage.setItem("bjj_gi_mode", m); } catch (e) {}
    this._explorer = null;
    this.styleGiToggle();
    const list = this.explorerListRef.current;
    if (list && list.style.display !== "none") this.renderExplorer();
  }
  styleGiToggle() {
    const gt = this.giToggleRef.current; if (!gt) return;
    gt.querySelectorAll("[data-gi]").forEach((s) => {
      const on = s.getAttribute("data-gi") === (this._giMode || "gi");
      s.style.background = on ? "#9fb0d8" : "transparent";
      s.style.color = on ? "#0e1630" : "#8b97b0";
    });
  }
  giAllows(n) {
    // data-driven: a node's cal.avail.{gi,nogi} is derived from Q3's per-frame attempt
    // probabilities (available in F iff attempted in F). Falls back to the old name heuristic
    // only for nodes without calibrated availability (keeps behaviour for uncalibrated data).
    const av = n.cal && n.cal.avail;
    const frame = this._giMode || "gi";
    if (av && typeof av[frame] === "boolean") return av[frame];
    if (this._giMode !== "nogi") return true;
    return !/collar|sleeve|lapel|spider|lasso|worm|loop |bow and arrow|ezekiel|cross choke|judo|gi tail|pant/i.test(n.t || "");
  }
  showExplorerList() {
    const sh = this.dossierSheetRef.current;
    if (sh && sh.style.display === "block") this.closeDossierSheet();
    this._dossierIdx = null;
    const dos = this.dossierRef.current; if (dos) dos.style.display = "none";
    const list = this.explorerListRef.current; if (list) list.style.display = "block";
    this.renderExplorer();
  }
  closeExplorerIfOpen() {
    const el = this.explorerRef.current;
    if (el && el.style.display === "flex") this.toggleExplorer();
  }
  closeDeckIfStudying() {
    // close the right sidebar when clicking the graph, but only when it's an opened study panel
    // (not the live in-roll drill that should stay docked during a decision)
    if (this.deckOpen && this.sbOffset() === 0) { this.setDeckOpen(false); this._session = null; this._sessionNodes = null; this._inSession = false; return; }  // mobile: tapping the exposed 20% graph strip always dismisses
    if (this.deckOpen && (this._inSession || this._session)) { this.setDeckOpen(false); this._session = null; this._sessionNodes = null; this._inSession = false; }
    else if (this.deckOpen && !this.optionIdxs.length && !this.pulse) { this.setDeckOpen(false); }
  }
  renderExplorer() {
    const list = this.explorerListRef.current; if (!list) return;
    const data = this.buildExplorer();
    this._exp = this._exp || { g: new Set(["Submissions"]), f: new Set() };
    const q = (this._exQ || "").toLowerCase().trim();
    list.innerHTML = "";
    const mk = (html, pad, onClick) => {
      const d = document.createElement("div");
      d.style.cssText = "cursor:pointer;padding:7px " + pad + "px;border-radius:7px;display:flex;align-items:center;gap:8px;";
      d.innerHTML = html;
      d.addEventListener("mouseenter", () => d.style.background = "rgba(255,255,255,.045)");
      d.addEventListener("mouseleave", () => d.style.background = "transparent");
      if (onClick) d.addEventListener("click", onClick);
      return d;
    };
    // search mode: flat ranked results across all nodes
    if (q) {
      const matches = this.nodes.filter((n) => n.t.toLowerCase().includes(q)).slice(0, 120);
      if (!matches.length) { list.appendChild(mk('<span style="font-size:12.5px;color:#7e8aa3;padding:8px 0;">No techniques match \u201c' + q + '\u201d</span>', 12)); return; }
      list.appendChild(mk('<span style="font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#7b8aa8;font-weight:700;">' + matches.length + ' result' + (matches.length === 1 ? "" : "s") + '</span>', 12));
      for (const n of matches) {
        const cat = ({ positions: "Pos", transitions: "Trans", submissions: "Sub" })[n.ty];
        list.appendChild(mk(this.nodeGlyph(n.ty, this.hex(n.col), 9) + '<span style="font-size:13px;color:#dbe2f0;">' + this.hl(this.splitName(n.t).main, q) + (this.splitName(n.t).from ? ' <span style="color:#6b7691;font-size:11px;">' + this.splitName(n.t).from + '</span>' : "") + '</span><span style="margin-left:auto;font-size:10px;color:#7e8aa3;">' + cat + '</span>', 12, () => this.openDossier(n.idx)));
      }
      return;
    }
    // curated concept sections (authored on bjjgraph.org)
    const curatedMap = {
      Systems: ["#a98bff", [["Leg Lock System", "ashi"], ["Back Attack System", "back"], ["Pressure Passing", "pass"], ["Guard Retention", "guard"], ["Half Guard System", "half guard"], ["Mount Attacks", "mount"]]],
      Principles: ["#66CCEE", [["Frames & posture", "guard"], ["Base & connection", "control"], ["Hip movement", "escape"], ["Grip fighting", "grip"], ["Angles", "back"], ["Pressure", "side control"]]],
      Learning: ["#7ee0a8", [["Fundamentals path", "guard"], ["Submission escapes", "escape"], ["Guard passing 101", "pass"], ["Back control & finishes", "back"]]],
    };
    const renderCurated = (label) => {
      const entry = curatedMap[label], col = entry[0], items = entry[1];
      const open = this._exp.g.has(label);
      list.appendChild(mk('<span style="font-size:14px;font-weight:700;color:#dbe2f0;">' + label + '</span><span style="font-size:11px;color:#7e8aa3;">(' + items.length + ')</span><span style="margin-left:auto;color:#5d6883;font-size:11px;">' + (open ? "\u25be" : "\u25b8") + '</span>', 12, () => { if (open) this._exp.g.delete(label); else this._exp.g.add(label); this.renderExplorer(); }));
      if (!open) return;
      for (const [name, term] of items) {
        list.appendChild(mk('<span style="width:7px;height:7px;border-radius:50%;background:' + col + ';flex:none;"></span><span style="font-size:13px;color:#c4cde0;">' + name + '</span>', 22, () => {
          this._exQ = term; const inp = this.explorerSearchRef.current; if (inp) inp.value = term;
          this.renderExplorer();
        }));
      }
    };
    const renderGraphGroup = (pair) => {
      const label = pair[0], key = pair[1];
      const fams = data.groups[key];
      const famNames = Object.keys(fams).sort((a, b) => a.localeCompare(b));
      const count = famNames.reduce((a, f) => a + fams[f].length, 0);
      const gOpen = this._exp.g.has(label);
      list.appendChild(mk('<span style="font-size:14px;font-weight:700;color:#dbe2f0;">' + label + '</span><span style="font-size:11px;color:#7e8aa3;">(' + count + ')</span><span style="margin-left:auto;color:#5d6883;font-size:11px;">' + (gOpen ? "\u25be" : "\u25b8") + '</span>', 12, () => { if (gOpen) this._exp.g.delete(label); else this._exp.g.add(label); this.renderExplorer(); }));
      if (!gOpen) return;
      for (const fam of famNames) {
        const nodes = fams[fam], col = this.hex(nodes[0].col);
        if (nodes.length > 1) {
          const fk = key + "|" + fam, fOpen = this._exp.f.has(fk);
          list.appendChild(mk(this.nodeGlyph(nodes[0].ty, col, 8) + '<span style="font-size:13px;font-weight:600;color:#c4cde0;">' + fam + '</span><span style="font-size:10.5px;color:#7e8aa3;">' + nodes.length + '</span><span style="margin-left:auto;color:#5d6883;font-size:10px;">' + (fOpen ? "\u25be" : "\u25b8") + '</span>', 22, () => { if (fOpen) this._exp.f.delete(fk); else this._exp.f.add(fk); this.renderExplorer(); }));
          if (fOpen) for (const n of nodes) list.appendChild(mk('<span style="font-size:12px;color:#9aa6bd;">' + this.splitName(n.t).main + (this.splitName(n.t).from ? ' <span style="color:#6b7691;">' + this.splitName(n.t).from + '</span>' : "") + '</span>', 38, () => this.openDossier(n.idx)));
        } else {
          list.appendChild(mk(this.nodeGlyph(nodes[0].ty, col, 8) + '<span style="font-size:13px;color:#c4cde0;">' + fam + '</span>', 22, () => this.openDossier(this.famDossierNode(nodes))));
        }
      }
    };
    // order: Systems \u2192 Principles \u2192 Positions \u2192 Transitions \u2192 Submissions \u2192 Learning
    renderCurated("Systems");
    renderCurated("Principles");
    for (const pair of data.order) renderGraphGroup(pair);
    renderCurated("Learning");
  }
  locateNode(idx) {
    const n = this.nodes[idx]; if (!n) return;
    this.camTarget = { cx: n.x, cy: n.y, vw: Math.max(this.graphW * 0.22, this.graphR * 0.5) };
    this.lastInteract = this.now; this.flare(idx);
    this.toggleExplorer();
  }
  // ---------- dossier: the technique page, living in the left pane ----------
  isMobile() { return (this.W || window.innerWidth) <= 640; }
  famDossierNode(nodes) {
    // prefer the side the authored deck is written for (e.g. Closed Guard|Bottom -> the Bottom node)
    const C = (window.NG_CONTENT && window.NG_CONTENT.decks) || {};
    const real = nodes.map((w) => this.nodes[w.idx]).filter(Boolean);
    if (!real.length) return nodes[0].idx;
    const fam = this.posFamily(real[0].t);
    for (const side of ["Bottom", "Top"]) {
      if (C[fam + "|" + side]) {
        const m = real.find((n) => this.roleLabelOf(n) === side.toLowerCase());
        if (m) return m.idx;
      }
    }
    return real[0].idx;
  }
  openDossier(idx, skipCam) {
    const n = this.nodes && this.nodes[idx]; if (!n) return;
    this.track("neural_dossier_opened", { node: n.t, node_type: n.ty, mode: this.isMobile() ? "sheet" : "node" });
    this._dossierIdx = idx;
    if (this.isMobile()) {
      // top sheet: 70% tall, graph strip + options + win bar + drill row stay visible below
      const ex = this.explorerRef.current;
      if (ex && ex.style.display === "flex") { ex.style.display = "none"; if (this._explorerAutoPaused) { this.setPaused(false); this._explorerAutoPaused = false; } }
      const sh = this.dossierSheetRef.current;
      if (sh) {
        clearTimeout(this._shT);
        if (sh.style.display !== "block") { sh.style.display = "block"; sh.style.transform = "translateY(-102%)"; void sh.offsetHeight; }
        sh.style.transform = "translateY(0)";
        sh.scrollTop = 0;
      }
      if (!skipCam && this.cam) {
        const W = this.W || 400, H = this.H || 800;
        const vw = Math.max(this.graphW * 0.12, Math.min(this.graphW * 0.42, this.cam.vw));
        const bandY = (H * 0.70 + (H - 190)) / 2;   // midpoint between sheet bottom and options tray
        this.camTarget = { cx: n.x, cy: n.y - (bandY - H / 2) * vw / W, vw: vw };
      }
      this.lastInteract = this.now; this.flare(idx);
      this.renderDossier(n);
      return;
    }
    // desktop: unified prezi reveal — no side panel. Close the explorer, auto-pause the roll,
    // and fly the camera all the way into node-mode zoom (s=1). updateNodeCard fades the
    // in-node dossier in during the flight; the reveal IS the zoom.
    {
      const ex = this.explorerRef.current;
      if (ex && ex.style.display === "flex") { ex.style.display = "none"; if (this._explorerAutoPaused) { this.setPaused(false); this._explorerAutoPaused = false; } }
      const dos = this.dossierRef.current; if (dos) dos.style.display = "none";
    }
    if (!this.paused) { this.setPaused(true); this._dossierAutoPaused = true; }
    if (!skipCam) {
      if (!this._camBefore) this._camBefore = { cx: this.camTarget.cx, cy: this.camTarget.cy, vw: this.camTarget.vw };
      this.camTarget = { cx: n.x, cy: n.y, vw: this.graphW * 0.0085 };
    }
    this.lastInteract = this.now; this.flare(idx);
  }
  // leave the in-node dossier: restore the pre-open camera, resume the roll if we auto-paused it.
  closeNodeDossier() {
    if (this._dossierIdx == null || this.isMobile()) return false;
    this._dossierIdx = null;
    const cb = this._camBefore; this._camBefore = null;
    this.camTarget = cb || { cx: this.gcx, cy: this.gcy, vw: this.graphW * 0.42 };
    if (this._dossierAutoPaused) { this.setPaused(false); this._dossierAutoPaused = false; }
    this.lastInteract = this.now;
    return true;
  }
  closeDossierSheet() {
    const sh = this.dossierSheetRef.current;
    this._dossierIdx = null;
    if (sh && sh.style.display === "block") {
      sh.style.transform = "translateY(-102%)";
      clearTimeout(this._shT);
      this._shT = setTimeout(() => { if (this._dossierIdx == null) sh.style.display = "none"; }, 360);
    }
  }
  // semantic zoom: pin the full dossier card to the node nearest screen center, scaling with zoom.
  // sc hits 1 (side-panel text size) at vw = graphW*0.0085; min zoom (0.006) leaves headroom past that.
  updateNodeCard(scale) {
    const el = this.nodeCardRef && this.nodeCardRef.current; if (!el) return;
    const W = this.W, H = this.H;
    const s = scale / (W / (this.graphW * 0.0085));
    const off = () => { if (el.style.display !== "none") el.style.display = "none"; this._nodeCardIdx = null; this._nodeCardOn = false; this._nodeCardO = 0; this._suppressTray(false); };
    if (s < 0.32 || !this.nodes || !this.nodes.length || !this.cam) { off(); return; }
    let best = -1, bd = 1e9;
    if (this._dossierIdx != null && this.nodes[this._dossierIdx]) {
      best = this._dossierIdx; // an explicit open pins the card — no other node's card mid-flight
    } else {
      for (const n of this.nodes) { const d = Math.hypot(n.x - this.cam.cx, n.y - this.cam.cy); if (d < bd) { bd = d; best = n.idx; } }
    }
    if (best < 0) { off(); return; }
    const n = this.nodes[best];
    const sx = (n.x - this.cam.cx) * scale + W / 2, sy = (n.y - this.cam.cy) * scale + H / 2;
    if (this._nodeCardIdx !== best) {
      this._nodeCardIdx = best;
      this.renderDossier(n, el);
    }
    this._nodeCardOn = true;
    el.style.display = "block";
    const cardO = Math.min(1, (s - 0.32) / 0.2);
    this._nodeCardO = cardO; // draw() crossfades the canvas glyph out as the card fades in
    el.style.opacity = cardO.toFixed(3);
    this._suppressTray(cardO > 0.5);
    // slight upscale past s=1 instead of letting the canvas glyph outgrow a hard-capped card
    el.style.transform = "translate(" + sx.toFixed(1) + "px," + sy.toFixed(1) + "px) translate(-50%,-50%) scale(" + Math.min(1.12, s).toFixed(4) + ")";
    const hit = el.querySelector(".ndHit");
    if (hit) hit.style.pointerEvents = s > 0.75 ? "auto" : "none";
  }
  // keep the in-node dossier readable: fade the options tray under it while the card is up
  _suppressTray(hide) {
    if (this._traySup === hide) return;
    this._traySup = hide;
    for (const ref of [this.optionsRef, this.optionHintRef]) {
      const op = ref && ref.current; if (!op) continue;
      op.style.transition = "opacity .25s";
      if (hide) { op.style.opacity = "0.1"; op.style.pointerEvents = "none"; }
      else { op.style.opacity = ""; op.style.pointerEvents = ""; }
    }
  }
  // role badge colored by the advantage the seat gives you (app's dominance model): blue = ahead, red = behind
  badgePill(b, fs, pad) {
    if (!b) return "";
    const c = b.tone === "ahead" ? ["#7fb4ff", "rgba(90,155,240,.13)", "rgba(90,155,240,.34)"]
      : b.tone === "behind" ? ["#ff9a8f", "rgba(242,104,95,.13)", "rgba(242,104,95,.34)"]
      : ["#cfd6e4", "rgba(150,170,210,.12)", "rgba(150,170,210,.3)"];
    return '<span title="blue = you\u2019re ahead \u00b7 red = you\u2019re behind" style="font-size:' + fs + 'px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:' + c[0] + ';background:' + c[1] + ';border:1px solid ' + c[2] + ';border-radius:999px;padding:' + pad + ';">' + b.label + '</span>';
  }
  _zoomOpenCheck(vw) {
    if (!this.isMobile() || !this.nodes || !this.cam) return;
    const deep = this.graphW * 0.05, rearm = this.graphW * 0.085;
    if (vw > rearm) { this._zoomArmed = true; return; }
    if (vw > deep || this._zoomArmed === false || this._dossierIdx != null) return;
    let best = -1, bd = 1e9;
    for (const n of this.nodes) { const d = Math.hypot(n.x - this.cam.cx, n.y - this.cam.cy); if (d < bd) { bd = d; best = n.idx; } }
    if (best >= 0 && bd * (this.W / vw) < this.W * 0.5) { this._zoomArmed = false; this.openDossier(best, true); }
  }
  renderDossier(n, targetEl) {
    const nodeMode = !!targetEl;
    const mob = !nodeMode && this.isMobile();
    const dos = targetEl || (mob ? this.dossierSheetRef.current : this.dossierRef.current); if (!dos) return;
    const sp = this.splitName(n.t), cat = this.deckCat(n), col = this.hex(n.col);
    const C = (window.NG_CONTENT && window.NG_CONTENT.decks) || {};
    const rc = this.richContentFor(n);
    // authored decks are keyed "Name|Role" — fall back across role variants so content always surfaces
    const fam = n.ty === "positions" ? this.posFamily(n.t) : sp.main;
    let legacy = null, legacyKey = "";
    for (const k of [this.deckKeyFor(n).key, fam + "|Bottom", fam + "|Top", fam + "|Attacker", fam + "|Defender", fam, sp.main]) {
      if (C[k]) { legacy = C[k]; legacyKey = k; break; }
    }
    const persp = rc ? rc.perspectives.attacker : null;
    const isCur = n.idx === this.currentPos;
    let role = n.ty === "positions" ? (this.roleLabelOf(n) === "bottom" ? "Bottom" : "Top") : null;
    // authored copy is side-specific; if it came from the other side, don't contradict it with a badge
    const lm = legacyKey.match(/\|(Top|Bottom)$/i);
    if (role && lm && lm[1].toLowerCase() !== role.toLowerCase()) role = null;
    const title = role ? sp.main.replace(new RegExp("\\s+" + role + "\\s*$", "i"), "") : sp.main;
    const dom0 = n.dom || 0;
    const badge = n.ty === "positions"
      ? (role ? { label: role, tone: dom0 >= 0.18 ? "ahead" : dom0 <= -0.18 ? "behind" : "even" } : null)
      : (dom0 > 0.02 ? { label: "Attacking", tone: "ahead" } : dom0 < -0.02 ? { label: "Defending", tone: "behind" } : null);
    const overview = (rc && rc.def) || (legacy && legacy.def) || "";
    const clips = ((rc && rc.clips) || (legacy && legacy.clips) || []).slice(0, 3);
    const principles = ((persp && persp.principles) || (legacy && legacy.principles) || []).slice(0, 4);
    const defence = ((legacy && legacy.counters) || (persp && persp.counters) || []).slice(0, 3);
    const adj = (this.adj && this.adj[n.idx]) || [];
    const attacks = adj.filter((k) => this.nodes[k].ty !== "positions").slice(0, 4);
    const relPos = adj.filter((k) => this.nodes[k].ty === "positions").slice(0, 4);
    const mistakes = ((legacy && legacy.mistakes) || (persp && persp.mistakes) || []).slice(0, 3);
    const secHead = (txt, c2) => '<div style="font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:' + (c2 || "#96a3bf") + ';margin-bottom:7px;">' + txt + '</div>';
    const bullet = (txt, dot) => '<div style="display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:1.45;color:#c4cde0;margin-bottom:6px;"><span style="flex:none;width:5px;height:5px;border-radius:50%;background:' + dot + ';margin-top:6px;"></span><span>' + txt + '</span></div>';
    const pct = (k) => { try { const nd = this.nodes[k]; const cs = this.calSuccess(nd); const p = cs != null ? Math.round(cs * 100) : Math.round(this.moveChance(nd) * 100); return isFinite(p) && p > 0 && p < 100 ? " \u00b7 " + p + "%" : ""; } catch (e) { return ""; } };

    // ── node mode: the node IS the dossier — content lives inside the node's own shape ──
    if (nodeMode) {
      let ovN = overview;
      if (!ovN) {
        if (sp.from && !role) ovN = 'A ' + cat.toLowerCase() + ' from ' + sp.from.replace(/^from\s+/i, '') + '.';
        else {
          const na = attacks.length, np = relPos.length, parts = [];
          if (na) parts.push(na + ' attack' + (na > 1 ? 's' : ''));
          if (np) parts.push(np + ' connected position' + (np > 1 ? 's' : ''));
          ovN = parts.length ? 'Links to ' + parts.join(' and ') + ' on the map.' : '';
        }
      }
      const shape = n.ty === "positions" ? "circle" : n.ty === "submissions" ? "tri" : "diamond";
      const size = shape === "circle" ? 560 : shape === "tri" ? 680 : 600;
      // em-based reflow: ONE root font-size drives every dimension inside the card, so the
      // content scales as a unit instead of fixed-px text cramping inside a scaled shape.
      const rootFs = (size / 46).toFixed(2);
      // two-layer ring echoing the canvas node stroke (thin bright inner + faint outer, gap of
      // background between) + top-lit fill in the canvas hue family + colored bloom instead of
      // a flat drop-shadow \u2014 the DOM card reads as the same object the canvas draws.
      const ringIn = this.rgba(n.col, 0.75), ringOut = this.rgba(n.col, 0.35);
      const fill = 'radial-gradient(140% 100% at 50% 0%,' + this.rgba(n.col, 0.16) + ',rgba(16,18,35,0) 52%),linear-gradient(180deg,#171a30,#101223)';
      const bloom = '0 0 90px ' + this.rgba(n.col, 0.10) + ',0 24px 70px rgba(0,0,0,.45)';
      const nClips = clips.slice(0, shape === "circle" ? 3 : 2);
      const nPrin = principles.slice(0, shape === "circle" ? 3 : 2);
      const kick = isCur
        ? '<span style="width:.58em;height:.58em;border-radius:50%;background:#5a9bf0;box-shadow:0 0 .66em rgba(90,155,240,.7);"></span><span style="font-size:.82em;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#7fb4ff;">Your current position</span>'
        : '<span style="font-size:.82em;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:' + col + ';">' + cat + '</span>';
      let c = '<div style="display:flex;align-items:center;justify-content:center;gap:.66em;">' + kick + this.badgePill(badge, 10, "3px 12px") + '</div>';
      // diamond/tri narrow sharply toward the title's height — keep the headline inside the shape
      c += '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:' + (shape === "circle" ? "2.05em" : "1.7em") + ';font-weight:600;letter-spacing:-.01em;line-height:1.12;color:#eef1f6;max-width:' + (shape === "circle" ? "15em" : "11em") + ';">' + title + '</div>';
      if (sp.from && (!role || sp.from.toLowerCase() !== role.toLowerCase())) c += '<div style="font-size:.94em;color:#8b97b0;margin-top:-.3em;">' + sp.from + '</div>';
      if (ovN) c += '<p style="margin:0;max-width:' + (shape === "circle" ? "27em" : "22em") + ';font-size:1em;line-height:1.5;color:#9aa6bd;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">' + ovN + '</p>';
      if (nClips.length) {
        c += '<div style="display:flex;gap:.5em;justify-content:center;">' + nClips.map((cl) =>
          '<a href="https://www.youtube.com/watch?v=' + cl.id + (cl.start ? '&t=' + cl.start + 's' : '') + '" target="_blank" rel="noopener" title="' + (cl.title || "") + '" style="position:relative;width:' + (shape === "circle" ? "8.5em" : "9.2em") + ';aspect-ratio:16/10;border-radius:.66em;overflow:hidden;border:1px solid rgba(150,170,210,.18);background:linear-gradient(135deg,#2b2336,#1b1b30);display:block;">' +
            '<img src="https://i.ytimg.com/vi/' + cl.id + '/hqdefault.jpg" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.85;">' +
            '<span style="position:absolute;top:50%;left:50%;transform:translate(-45%,-50%);width:0;height:0;border-left:.74em solid rgba(255,255,255,.9);border-top:.45em solid transparent;border-bottom:.45em solid transparent;filter:drop-shadow(0 1px 3px rgba(0,0,0,.6));"></span>' +
          '</a>').join("") + '</div>';
      }
      if (nPrin.length) c += '<div style="width:' + (shape === "circle" ? "26em" : shape === "tri" ? "24em" : "23em") + ';text-align:left;">' + secHead("Essential principles") + nPrin.map((p) => bullet(p, "#96a3bf")).join("") + '</div>';
      // techniques: where it leads \u2014 top outcomes with calibrated %s (positions get attack pills below)
      if (shape !== "circle" && rc && Array.isArray(rc.outcomes) && rc.outcomes.length) {
        const toneCol = { good: "#7ee0a8", bad: "#e8956b", mid: "#cbd24e" };
        c += '<div style="width:' + (shape === "tri" ? "24em" : "23em") + ';text-align:left;">' + secHead("Where it leads") +
          rc.outcomes.slice(0, 2).map((o) =>
            '<div style="display:flex;align-items:center;gap:.6em;margin-bottom:.4em;"><span style="flex:1;font-size:1em;color:#cdd5e6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (o.result || "") + ' \u2192 ' + (o.position || "") + '</span><span style="font-size:.95em;font-weight:700;color:' + (toneCol[o.tone] || "#cfd6e4") + ';">' + (o.prob != null ? o.prob + '%' : '') + '</span></div>').join("") + '</div>';
      }
      if (shape === "circle" && attacks.length) {
        // dedupe by display label — adjacent variants often collapse to the same short name
        const seenLbl = new Set();
        const atk3 = attacks.filter((k) => { const l = this.splitName(this.nodes[k].t).main; if (seenLbl.has(l)) return false; seenLbl.add(l); return true; }).slice(0, 3);
        c += '<div style="width:26em;text-align:left;">' + secHead("Attacks from here", "#ff8a7e") +
          '<div style="display:flex;gap:.4em;flex-wrap:wrap;">' + atk3.map((k) =>
            '<span class="dsAtk" data-i="' + k + '" style="cursor:pointer;font-size:.82em;font-weight:700;color:#ff8a7e;background:rgba(242,104,95,.14);border-radius:999px;padding:.4em 1em;">' + this.splitName(this.nodes[k].t).main + pct(k) + '</span>').join("") + '</div></div>';
      }
      c += '<div class="dsRoll" style="cursor:pointer;display:inline-flex;align-items:center;gap:.74em;background:linear-gradient(135deg,rgba(74,108,255,.2),rgba(74,108,255,.08));border:1px solid rgba(110,160,255,.35);border-radius:1em;padding:.74em 1.5em;">' +
        '<span style="flex:none;width:2em;height:2em;border-radius:.66em;background:rgba(74,108,255,.22);color:#9ab0e0;display:flex;align-items:center;justify-content:center;"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg></span>' +
        '<span style="font-size:1.03em;font-weight:700;color:#eef1f6;">Roll from here</span><span style="font-size:1em;color:#9ab0e0;">\u2192</span></div>';
      // \u2715 \u2014 fly back out. Lives on the UNCLIPPED shell root (the shape's overflow/clip-path would
      // swallow it at any corner position), floating just off the ring's top-right.
      const closeBtn = '<span class="ndClose" title="Close (Esc)" style="position:absolute;top:' + (shape === "tri" ? "14%" : "6%") + ';right:' + (shape === "tri" ? "10%" : "6%") + ';cursor:pointer;width:' + (size / 20) + 'px;height:' + (size / 20) + 'px;border-radius:35%;border:1px solid rgba(150,170,210,.3);background:rgba(12,15,28,.82);color:#c3cde0;font-size:' + (size / 38) + 'px;display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:2;box-shadow:0 4px 14px rgba(0,0,0,.4);">\u00d7</span>';
      let shell;
      const colCss = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.9em;text-align:center;font-size:' + rootFs + 'px;';
      // ring layers: outer faint 1px + gap + inner bright 3px (inset), matching canvas stroke style
      const ringLayers = (radiusCss, clip) => {
        if (radiusCss) return '<div style="position:absolute;inset:0;border-radius:50%;border:1px solid ' + ringOut + ';"></div>' +
          '<div style="position:absolute;inset:8px;border-radius:50%;border:3px solid ' + ringIn + ';"></div>';
        return '<div style="position:absolute;inset:0;clip-path:' + clip + ';background:' + ringOut + ';"></div>' +
          '<div style="position:absolute;inset:2px;clip-path:' + clip + ';background:#0b0e1a;"></div>' +
          '<div style="position:absolute;inset:8px;clip-path:' + clip + ';background:' + ringIn + ';"></div>' +
          '<div style="position:absolute;inset:12px;clip-path:' + clip + ';background:#0b0e1a;"></div>';
      };
      if (shape === "circle") {
        shell = '<div style="position:absolute;inset:0;border-radius:50%;background:' + fill + ';box-shadow:' + bloom + ';"></div>' + ringLayers(true) +
          '<div class="ndHit" style="position:absolute;inset:14px;border-radius:50%;overflow:hidden;pointer-events:none;font-size:' + rootFs + 'px;"><div style="' + colCss + '">' + c + '</div></div>' + closeBtn;
      } else if (shape === "diamond") {
        const clip = 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)';
        // content lives in the diamond's wide middle band — the top/bottom quarters are too narrow
        shell = '<div style="position:absolute;inset:0;clip-path:' + clip + ';background:' + fill + ';"></div>' +
          '<div style="position:absolute;inset:0;border-radius:50%;box-shadow:' + bloom + ';"></div>' + ringLayers(false, clip) +
          '<div class="ndHit" style="position:absolute;inset:14px;clip-path:' + clip + ';background:' + fill + ';pointer-events:none;font-size:' + rootFs + 'px;"><div style="position:absolute;left:0;right:0;top:14%;bottom:14%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.9em;text-align:center;font-size:1em;">' + c + '</div></div>' + closeBtn;
      } else {
        const clip = 'polygon(50% 2%,98% 92%,2% 92%)';
        // triangle: center the content in the incircle (upper-middle of the polygon), not bottom-crushed
        shell = '<div style="position:absolute;inset:0;clip-path:' + clip + ';background:' + fill + ';"></div>' +
          '<div style="position:absolute;inset:0;border-radius:50%;box-shadow:' + bloom + ';"></div>' + ringLayers(false, clip) +
          '<div class="ndHit" style="position:absolute;inset:14px;clip-path:' + clip + ';background:' + fill + ';pointer-events:none;font-size:' + rootFs + 'px;"><div style="position:absolute;left:0;right:0;top:22%;bottom:10%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.8em;text-align:center;font-size:1em;">' + c + '</div></div>' + closeBtn;
      }
      dos.style.width = size + "px"; dos.style.height = size + "px";
      dos.innerHTML = shell;
      dos.querySelectorAll(".dsAtk").forEach((a2) => a2.addEventListener("click", () => this.openDossier(parseInt(a2.getAttribute("data-i"), 10))));
      const roll2 = dos.querySelector(".dsRoll"); if (roll2) roll2.addEventListener("click", () => { this.closeNodeDossier(); this.jumpToState(n.idx); });
      const xnd = dos.querySelector(".ndClose"); if (xnd) xnd.addEventListener("click", (ev) => { ev.stopPropagation(); this.closeNodeDossier(); });
      return;
    }

    let h = nodeMode ? '' : mob
      ? '<div style="display:flex;align-items:center;padding:6px 16px 8px;"><span class="dsBack" style="cursor:pointer;font-size:12px;font-weight:600;color:#8b97b0;padding:6px 0;">\u2039 All techniques</span><span class="dsClose" style="cursor:pointer;margin-left:auto;width:32px;height:32px;border-radius:10px;border:1px solid rgba(150,170,210,.2);background:rgba(255,255,255,.04);color:#8b97b0;font-size:16px;display:flex;align-items:center;justify-content:center;">\u00d7</span></div>'
      : '<div class="dsBack" style="cursor:pointer;display:flex;align-items:center;gap:7px;padding:10px 18px 8px;font-size:12px;font-weight:600;color:#8b97b0;">\u2039 All techniques</div>';
    h += '<div style="padding:2px 18px 22px;">';
    h += '<div style="display:flex;align-items:center;gap:7px;">' +
      (isCur
        ? '<span style="width:8px;height:8px;border-radius:50%;background:#5a9bf0;box-shadow:0 0 8px rgba(90,155,240,.7);flex:none;"></span><span style="font-size:9px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#7fb4ff;">Your current position</span>'
        : this.nodeGlyph(n.ty, col, 9) + '<span style="font-size:9px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#9fb0d8;">' + cat + '</span>') +
      '</div>';
    h += '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:7px;">' +
      '<span style="font-family:\'Space Grotesk\',sans-serif;font-size:22px;font-weight:600;letter-spacing:-.01em;line-height:1.1;color:#eef1f6;">' + title + '</span>' +
      this.badgePill(badge, 9.5, "2.5px 10px") +
      '</div>';
    if (sp.from && (!role || sp.from.toLowerCase() !== role.toLowerCase())) h += '<div style="font-size:12px;color:#8b97b0;margin-top:3px;">' + sp.from + '</div>';
    const pills = [["Overview", "ov"]];
    if (clips.length) pills.push(["Film", "film"]);
    if (principles.length) pills.push(["Principles", "pr"]);
    if (defence.length) pills.push(["Defence", "df"]);
    if (attacks.length) pills.push(["Attacks", "at"]);
    h += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:12px;">' + pills.map((p, i) =>
      '<span class="dsPill" data-t="' + p[1] + '" style="cursor:pointer;font-size:8.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:' + (i === 0 ? "#0e1630" : "#9aa6bd") + ';background:' + (i === 0 ? "#7fb4ff" : "rgba(150,170,210,.12)") + ';border-radius:999px;padding:3px 10px;">' + p[0] + '</span>').join("") + '</div>';
    let ov = overview;
    if (!ov) {
      if (sp.from && !role) ov = 'A ' + cat.toLowerCase() + ' from ' + sp.from.replace(/^from\s+/i, '') + '.';
      else {
        const na = attacks.length, np = relPos.length, parts = [];
        if (na) parts.push(na + ' attack' + (na > 1 ? 's' : ''));
        if (np) parts.push(np + ' connected position' + (np > 1 ? 's' : ''));
        ov = parts.length ? 'Links to ' + parts.join(' and ') + ' on the map.' : '';
      }
    }
    if (ov) h += '<div data-ds="ov" style="margin-top:12px;"><p style="margin:0;font-size:12px;line-height:1.55;color:#9aa6bd;">' + ov + '</p></div>';
    if (clips.length) {
      h += '<div data-ds="film" style="display:flex;gap:6px;margin-top:12px;">' + clips.map((c) =>
        '<a href="https://www.youtube.com/watch?v=' + c.id + (c.start ? '&t=' + c.start + 's' : '') + '" target="_blank" rel="noopener" title="' + (c.title || "") + '" style="position:relative;flex:1;aspect-ratio:16/10;border-radius:7px;overflow:hidden;border:1px solid rgba(150,170,210,.16);background:linear-gradient(135deg,#2b2336,#1b1b30);display:block;">' +
          '<img src="https://i.ytimg.com/vi/' + c.id + '/hqdefault.jpg" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.85;">' +
          '<span style="position:absolute;top:50%;left:50%;transform:translate(-45%,-50%);width:0;height:0;border-left:8px solid rgba(255,255,255,.9);border-top:5px solid transparent;border-bottom:5px solid transparent;filter:drop-shadow(0 1px 3px rgba(0,0,0,.6));"></span>' +
        '</a>').join("") + '</div>';
    }
    if (principles.length) h += '<div data-ds="pr" style="margin-top:15px;">' + secHead("Essential principles") + principles.map((p) => bullet(p, "#96a3bf")).join("") + '</div>';
    if (defence.length) h += '<div data-ds="df" style="margin-top:13px;">' + secHead("Defence", "#7fb4ff") + defence.map((p) => bullet(p, "#5a9bf0")).join("") + '</div>';
    if (attacks.length) {
      h += '<div data-ds="at" style="margin-top:13px;">' + secHead("Attacks from here", "#ff8a7e") +
        '<div style="display:flex;gap:5px;flex-wrap:wrap;">' + attacks.map((k) =>
          '<span class="dsAtk" data-i="' + k + '" style="cursor:pointer;font-size:10px;font-weight:700;color:#ff8a7e;background:rgba(242,104,95,.14);border-radius:999px;padding:4px 10px;">' + this.splitName(this.nodes[k].t).main + pct(k) + '</span>').join("") + '</div></div>';
    }
    const hasFold = mistakes.length || relPos.length || (rc && rc.context);
    if (hasFold) {
      h += '<div class="dsSeam" style="cursor:pointer;display:flex;align-items:center;gap:8px;margin:16px -18px 0;padding:9px 18px;background:rgba(150,170,210,.05);border-top:1px dashed rgba(150,170,210,.26);border-bottom:1px dashed rgba(150,170,210,.26);white-space:nowrap;"><span class="dsSeamTxt" style="font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#b8c2d8;">More details \u2193</span></div>';
      h += '<div class="dsFold" style="display:none;padding-top:14px;">';
      if (rc && rc.context) h += '<p style="margin:0 0 13px;font-size:11.5px;line-height:1.55;color:#9aa6bd;">' + rc.context + '</p>';
      if (mistakes.length) h += '<div style="margin-bottom:13px;">' + secHead("Common mistakes", "#6b7691") + mistakes.map((m) => bullet('<b style="color:#dbe2f0;font-weight:600;">' + m.err + '</b> \u2014 ' + m.fix, "#8b97b0")).join("") + '</div>';
      if (relPos.length) h += '<div>' + secHead("Related positions", "#6b7691") + '<div style="display:flex;gap:5px;flex-wrap:wrap;">' + relPos.map((k) =>
        '<span class="dsAtk" data-i="' + k + '" style="cursor:pointer;font-size:10px;font-weight:600;color:#c4cde0;background:rgba(150,170,210,.12);border:1px solid rgba(150,170,210,.2);border-radius:7px;padding:4px 10px;">' + this.splitName(this.nodes[k].t).main + '</span>').join("") + '</div></div>';
      h += '</div>';
    }
    h += '<div class="dsRoll" style="cursor:pointer;display:flex;align-items:center;gap:10px;margin-top:16px;background:linear-gradient(135deg,rgba(74,108,255,.18),rgba(74,108,255,.07));border:1px solid rgba(110,160,255,.35);border-radius:12px;padding:11px 14px;">' +
      '<span style="flex:none;width:26px;height:26px;border-radius:8px;background:rgba(74,108,255,.22);color:#9ab0e0;display:flex;align-items:center;justify-content:center;"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg></span>' +
      '<div style="display:flex;flex-direction:column;gap:1px;"><span style="font-size:12.5px;font-weight:700;color:#eef1f6;">Roll from here</span><span style="font-size:10.5px;color:#9aa6bd;">make this the current state</span></div>' +
      '<span style="margin-left:auto;font-size:13px;color:#9ab0e0;">\u2192</span></div>';
    h += '</div>';
    dos.innerHTML = h;
    const back = dos.querySelector(".dsBack"); if (back) back.addEventListener("click", () => { if (mob) { this.closeDossierSheet(); this.openExplorer(); this.showExplorerList(); } else this.showExplorerList(); });
    const xb = dos.querySelector(".dsClose"); if (xb) xb.addEventListener("click", () => this.closeDossierSheet());
    dos.querySelectorAll(".dsAtk").forEach((el) => el.addEventListener("click", () => this.openDossier(parseInt(el.getAttribute("data-i"), 10))));
    const seam = dos.querySelector(".dsSeam"), fold = dos.querySelector(".dsFold");
    if (seam && fold) seam.addEventListener("click", () => { const open = fold.style.display !== "none"; fold.style.display = open ? "none" : "block"; seam.querySelector(".dsSeamTxt").innerHTML = open ? "More details \u2193" : "Less \u2191"; });
    const roll = dos.querySelector(".dsRoll"); if (roll) roll.addEventListener("click", () => { if (mob) this.closeDossierSheet(); this.jumpToState(n.idx); });
    const pillEls = dos.querySelectorAll(".dsPill");
    pillEls.forEach((p) => p.addEventListener("click", () => {
      pillEls.forEach((q) => { q.style.background = "rgba(150,170,210,.12)"; q.style.color = "#9aa6bd"; });
      p.style.background = "#7fb4ff"; p.style.color = "#0e1630";
      const sec = dos.querySelector('[data-ds="' + p.getAttribute("data-t") + '"]');
      if (sec) dos.scrollTo({ top: Math.max(0, sec.offsetTop - 10), behavior: "smooth" });
    }));
  }
  hl(text, q) {
    if (!q) return text;
    const i = text.toLowerCase().indexOf(q); if (i < 0) return text;
    return text.slice(0, i) + '<span style="background:rgba(120,160,255,.32);border-radius:3px;padding:0 1px;">' + text.slice(i, i + q.length) + '</span>' + text.slice(i + q.length);
  }
  openSearch() { this._searchQ = ""; this._searchSel = null; this.openModal(); this.renderSearch(); }
  playFrom(idx, role) {
    this.clearTimers(); this.clearOptions(); this.closeModal(); this.setPaused(false);
    this.playerRole = role;
    this.aiSkill = this.get("difficulty", "normal") === "off" ? 0 : 0.06 + Math.random() * 0.14;
    this.moveCount = 0; this.maxMoves = 9 + ((Math.random() * 4) | 0);
    this.currentPos = idx; this.focusIdx = idx; this.pulse = null; this.activeMove = null;
    this.camTarget = { cx: this.nodes[idx].x, cy: this.nodes[idx].y, vw: this.graphW * 0.42 };
    this.camFocus = { x: this.nodes[idx].x, y: this.nodes[idx].y };
    this.flare(idx);
    this.after(0.4, () => this.enterLand(false));
  }
  roleLabelOf(n) { const rm = (n.t || "").match(/\s+(Top|Bottom)\s*$/i); return rm ? rm[1].toLowerCase() : (n.dom >= 0 ? "top" : "bottom"); }
  posNodeForId(posId) {
    if (!posId) return -1;
    for (let i = 0; i < this.nodes.length; i++) { if (this.nodes[i].ty === "positions" && this.nodes[i].posId === posId) return i; }
    return -1;
  }
  confirmPlayFrom(n) {
    const persp = this._perspective || "attacker";
    // every state (position / transition / submission) is a node you can roll from.
    // positions seed at themselves; transitions & submissions seed at their origin position.
    let seedIdx = n.idx, seedName = this.splitName(n.t).main;
    if (n.ty !== "positions") {
      const fp = this.posNodeForId(n.fromPositionId);
      if (fp >= 0) { seedIdx = fp; seedName = this.splitName(this.nodes[fp].t).main; }
    }
    const baseRole = (n.fromRole || this.roleLabelOf(this.nodes[seedIdx]) || "top").toLowerCase();
    const role = persp === "defender" ? (baseRole === "top" ? "bottom" : "top") : baseRole;
    const roleLabel = persp === "defender" ? "defending" : "attacking";
    const host = this.wrapRef.current; if (!host) { this._detailCtx = null; this.hideOptDetail(); this.playFrom(seedIdx, role); return; }
    const ov = document.createElement("div");
    ov.style.cssText = "position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(8,11,18,.62);backdrop-filter:blur(3px);";
    const close = () => { ov.style.opacity = "0"; setTimeout(() => ov.remove(), 160); };
    ov.innerHTML =
      '<div style="width:min(380px,90vw);background:linear-gradient(180deg,#161b27,#11151e);border:1px solid rgba(150,170,210,.18);border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.5);padding:22px 22px 18px;font-family:inherit;">' +
        '<div style="font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:#7c9cff;">Start a fresh roll</div>' +
        '<div style="font-size:18px;font-weight:700;color:#eef1f6;margin-top:7px;line-height:1.25;font-family:\'Space Grotesk\',sans-serif;">Roll from <span style="color:#bcd0ff;">' + seedName + '</span>, ' + roleLabel + '?</div>' +
        '<div style="font-size:12.5px;color:#93a0bd;margin-top:9px;line-height:1.55;">Your current roll will be archived to <b style="color:#c3cde0;font-weight:600;">Previous rolls</b>. A new roll begins here with you on the <b style="color:#c3cde0;font-weight:600;">' + role + '</b>.</div>' +
        '<div style="display:flex;gap:10px;margin-top:18px;">' +
          '<button class="ng-cf-no" style="cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;padding:11px 16px;border-radius:11px;border:1px solid rgba(150,170,210,.25);background:rgba(255,255,255,.04);color:#c3cde0;">Cancel</button>' +
          '<button class="ng-cf-yes" style="flex:1;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;padding:11px;border-radius:11px;border:none;background:linear-gradient(135deg,#4a6cff,#6a5cff);color:#fff;box-shadow:0 4px 16px rgba(74,108,255,.35);display:flex;align-items:center;justify-content:center;gap:7px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>Start roll</button>' +
        '</div>' +
      '</div>';
    host.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
    ov.querySelector(".ng-cf-no").addEventListener("click", close);
    ov.querySelector(".ng-cf-yes").addEventListener("click", () => {
      close();
      this._detailCtx = null; this.hideOptDetail();
      this._openSidebarOnLand = true;     // land back in the flashcards home on the seeded state
      this.playFrom(seedIdx, role);
    });
  }
  renderSearch() {
    const card = this.modalCardRef.current; if (!card) return;
    card.style.width = "min(1000px,93vw)";
    card.innerHTML = "";
    const top = document.createElement("div");
    top.style.cssText = "padding:16px 20px;border-bottom:1px solid rgba(150,170,210,.12);display:flex;gap:12px;align-items:center;";
    top.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b97b0" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>';
    const inp = document.createElement("input");
    inp.placeholder = "Search positions, transitions, submissions\u2026"; inp.value = this._searchQ || "";
    inp.style.cssText = "flex:1;font-family:inherit;font-size:16px;color:#eef1f6;background:transparent;border:none;outline:none;";
    const x = document.createElement("span"); x.textContent = "\u00d7"; x.style.cssText = "cursor:pointer;color:#8b97b0;font-size:21px;";
    x.addEventListener("click", () => this.closeModal());
    top.appendChild(inp); top.appendChild(x); card.appendChild(top);

    const body = document.createElement("div"); body.style.cssText = "display:flex;height:min(560px,68vh);";
    const results = document.createElement("div"); results.style.cssText = "width:312px;border-right:1px solid rgba(150,170,210,.12);overflow-y:auto;padding:8px;flex:none;";
    const detail = document.createElement("div"); detail.style.cssText = "flex:1;overflow-y:auto;padding:24px 28px;";
    body.appendChild(results); body.appendChild(detail); card.appendChild(body);

    const renderDetail = () => {
      detail.innerHTML = "";
      const n = this.nodes.find((z) => z.idx === this._searchSel);
      if (!n) { detail.innerHTML = '<div style="color:#7e8aa3;font-size:14px;">Search and pick a technique to see details.</div>'; return; }
      const cat = this.deckCat(n), isPos = n.ty === "positions";
      const deckKey = this.deckKeyFor(n).key;
      const deck = (this.flashcards && this.flashcards.decks) ? this.flashcards.decks[deckKey] : null;
      let html = '<div style="font-size:26px;font-weight:700;color:#eef1f6;letter-spacing:-.01em;font-family:\'Space Grotesk\',sans-serif;">' + this.splitName(n.t).main + '</div>';
      if (this.splitName(n.t).from) html += '<div style="font-size:14px;color:#8b97b0;margin-top:2px;">' + this.splitName(n.t).from + '</div>';
      html += '<div style="display:inline-block;margin-top:11px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#8094b4;border:1px solid rgba(150,170,210,.25);border-radius:6px;padding:4px 9px;">' + cat + '</div>';
      detail.innerHTML = html;
      const btns = document.createElement("div"); btns.style.cssText = "display:flex;gap:10px;margin:18px 0 6px;flex-wrap:wrap;";
      if (isPos) {
        const mkPlay = (lbl, role) => { const b = document.createElement("button"); b.textContent = lbl; b.style.cssText = "cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;padding:9px 16px;border-radius:10px;border:1px solid rgba(150,170,210,.25);background:rgba(255,255,255,.04);color:#dbe2f0;"; b.addEventListener("click", () => this.playFrom(n.idx, role)); return b; };
        btns.appendChild(mkPlay("Play as Bottom", "bottom"));
        btns.appendChild(mkPlay("Play as Top", "top"));
      }
      const loc = document.createElement("button"); loc.textContent = "Locate on graph";
      loc.style.cssText = "cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;padding:9px 16px;border-radius:10px;border:1px solid rgba(110,160,255,.4);background:rgba(74,108,255,.2);color:#dbe6ff;";
      loc.addEventListener("click", () => { this.closeModal(); this.locateNode2(n.idx); });
      btns.appendChild(loc);
      detail.appendChild(btns);
      const desc = document.createElement("div"); desc.style.cssText = "margin-top:18px;font-size:14px;color:#c2ccde;line-height:1.65;";
      const neighbors = this.adj[n.idx].slice(0, 6).map((k) => this.splitName(this.nodes[k].t).main);
      if (deck && deck.cards.length) {
        desc.innerHTML = '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7b8aa8;font-weight:700;margin-bottom:8px;">Key question</div><div style="font-weight:600;color:#eef1f6;margin-bottom:6px;">' + deck.cards[0].q + '</div>' + deck.cards[0].a;
      } else {
        desc.innerHTML = (isPos ? "A " + this.roleLabelOf(n) + " state in the graph. " : "A " + cat.toLowerCase() + " linking positions. ") +
          (neighbors.length ? 'It connects to <b style="color:#dbe2f0;">' + neighbors.join('</b>, <b style="color:#dbe2f0;">') + '</b>.' : "") +
          '<div style="margin-top:12px;font-size:12.5px;color:#7e8aa3;">Full write-up is authored on bjjgraph.org.</div>';
      }
      detail.appendChild(desc);
    };
    const renderResults = () => {
      const q = (this._searchQ || "").toLowerCase().trim();
      results.innerHTML = "";
      let matches = q ? this.nodes.filter((n) => n.t.toLowerCase().includes(q)) : this.nodes.slice(0, 80);
      matches = matches.slice(0, 100);
      if ((this._searchSel == null || !matches.some((m) => m.idx === this._searchSel)) && matches.length) this._searchSel = matches[0].idx;
      for (const n of matches) {
        const r = document.createElement("div"); const active = n.idx === this._searchSel;
        r.style.cssText = "cursor:pointer;padding:10px 12px;border-radius:9px;margin-bottom:2px;font-size:13.5px;background:" + (active ? "rgba(74,108,255,.18)" : "transparent") + ";color:" + (active ? "#eef1f6" : "#aeb6c8") + ";";
        r.innerHTML = '<span style="display:inline-flex;width:12px;justify-content:center;margin-right:8px;vertical-align:middle;">' + this.nodeGlyph(n.ty, this.hex(n.col), 9) + '</span>' + this.hl(this.splitName(n.t).main, q) + (this.splitName(n.t).from ? ' <span style="color:#6b7691;font-size:11.5px;">' + this.splitName(n.t).from + '</span>' : "");
        r.addEventListener("click", () => { this._searchSel = n.idx; renderResults(); renderDetail(); });
        results.appendChild(r);
      }
      if (!matches.length) results.innerHTML = '<div style="padding:16px;color:#7e8aa3;font-size:13px;">No matches.</div>';
    };
    inp.addEventListener("input", () => { this._searchQ = inp.value; this._searchSel = null; renderResults(); renderDetail(); });
    renderResults(); renderDetail();
    setTimeout(() => { try { inp.focus(); } catch (e) {} }, 60);
  }
  locateNode2(idx) {
    // search "Locate" takes the same unified prezi path as explorer rows and canvas clicks
    this.openDossier(idx);
  }
  updateTransport() {
    const b = this.playPauseRef.current; if (!b) return;
    b.innerHTML = this.paused
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"></path></svg>'
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1.2"></rect><rect x="14" y="4" width="5" height="16" rx="1.2"></rect></svg>';
    b.title = this.paused ? "Play" : "Pause";
  }

  nodeGlyph(ty, col, sz) {
    const s = sz || 8;
    if (ty === "positions") return '<span style="width:' + s + 'px;height:' + s + 'px;border-radius:50%;background:' + col + ';flex:none;"></span>';
    if (ty === "submissions") return '<span style="width:0;height:0;border-left:' + (s * .62) + 'px solid transparent;border-right:' + (s * .62) + 'px solid transparent;border-bottom:' + (s * 1.05) + 'px solid ' + col + ';flex:none;"></span>';
    return '<span style="width:' + (s * .82) + 'px;height:' + (s * .82) + 'px;background:' + col + ';transform:rotate(45deg);flex:none;margin:0 ' + (s * .09) + 'px;"></span>';
  }
  drillGlyph(cat, col) {
    if (cat === "Submission") return '<span style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:7px solid ' + col + ';flex:none;"></span>';
    if (cat === "Transition") return '<span style="width:7px;height:7px;background:' + col + ';transform:rotate(45deg);flex:none;"></span>';
    return '<span style="width:8px;height:8px;border-radius:50%;background:' + col + ';flex:none;"></span>';
  }
  drillPrev() { if (this.deck && this.deckIdx > 0) { this.deckIdx--; this.revealed = false; this.renderDrill(); } }
  drillNext() { if (this.deck) { this.deckIdx++; this.revealed = false; this.renderDrill(); } }
  drillTechNav(dir) {
    if (!this._inSession || !this._session || !this._session.keys) return false;
    const ses = this._session; const cur = ses.keys.indexOf(this._posKey);
    if (cur < 0) return false;
    const ni = cur + dir;
    if (ni < 0 || ni >= ses.keys.length) return false;
    ses.idx = ni; const key = ses.keys[ni];
    const idx = this.nodeForKey(key); if (idx >= 0) this.locateNode(idx);
    this.studyFromSession(key); return true;
  }
  drillReveal() { if (this.deck && !this.revealed && this.deckIdx < this.deck.length) { this.revealed = true; this.renderDrill(); } }
  drillGrade(got) {
    if (!this.deck || !this.revealed) return;
    if (got && this._deckInfo) { this.prep[this._deckInfo.key] = (this.prep[this._deckInfo.key] || 0) + 1; this.noteCardDone(this.deck[this.deckIdx], this._deckInfo.key); this.noteCardAnswered(); this.refreshOptionOdds(); }
    this.deckIdx++; this.revealed = false; this.renderDrill();
  }
  isDrillOpen() { const el = this.drillRef.current; return el && el.style.opacity === "1" && !!this.deck; }
  renderDrill() {
    const list = this.drillListRef.current;
    const entries = this.drillEntries;    if (!list || !entries || !entries.length) return;
    { const foot = this.drillFootRef.current; if (foot) { foot.innerHTML = ""; foot.style.display = "none"; } }
    const e = entries[this.activeDrill] || entries[0];
    const info = e.info, deck = e.cards;
    this.deck = deck; this._deckInfo = info; // persist for keyboard/swipe nav helpers
    const catCol = { Position: "#c9d2e3", Transition: "#9fb0d8", Submission: "#d99", }[info.cat] || "#c9d2e3";
    const bonus = Math.round(this.stateBonus(info.key) * 100);
    this.setDrillHeader(info.fam, "Recall to sharpen your odds", bonus > 0 ? "+" + bonus + "%" : "", this.roleLabel(), catCol);
    this.updateDrillCount();
    list.innerHTML = "";

    const chipLabel = '<span style="font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#8094b4;">' + info.cat + '</span>';

    if (!deck) {
      const ph = document.createElement("div");
      ph.style.cssText = "margin-top:auto;background:rgba(30,34,54,.5);border:1px dashed rgba(150,170,210,.22);border-radius:12px;padding:18px 16px;";
      ph.innerHTML =
        '<div style="margin-bottom:12px;">' + chipLabel + '</div>' +
        '<div style="font-size:13.5px;font-weight:600;color:#cdd5e6;line-height:1.45;margin-bottom:8px;">Flashcards for this ' + info.cat.toLowerCase() + ' are being authored.</div>' +
        (function (D) { const nd = Object.keys(D).length; let nc = 0; for (const k in D) nc += (D[k].cards ? D[k].cards.length : 0); return '<div style="font-size:11.5px;color:#8b97b0;line-height:1.5;">Cards are baked per role from the BJJ Graph guide — <b style="color:#a9b6cf;">' + nd.toLocaleString() + ' decks</b> · <b style="color:#a9b6cf;">' + nc.toLocaleString() + ' cards</b> and counting.</div>'; })((this.flashcards && this.flashcards.decks) || {});
      list.appendChild(ph);
      return;
    }

    if (this.deckIdx >= deck.length) {
      const bonus = Math.round(this.stateBonus(info.key) * 100);
      const done = document.createElement("div");
      done.style.cssText = "margin-top:auto;background:rgba(28,46,38,.5);border:1px solid rgba(110,224,168,.35);border-radius:12px;padding:20px 16px;text-align:center;animation:ngCardIn .3s ease both;";
      done.innerHTML =
        '<div style="font-size:22px;margin-bottom:8px;color:#7ee0a8;">\u2713</div>' +
        '<div style="font-size:14px;font-weight:700;color:#bff0d2;margin-bottom:6px;">All ' + deck.length + ' cards reviewed</div>' +
        '<div style="font-size:11.5px;color:#9ab3a4;line-height:1.5;margin-bottom:14px;">' + (bonus > 0 ? "+" + bonus + "% odds with " + info.fam + " (" + info.role + ") this roll." : "Recall them again to lock them in.") + '</div>';
      const again = this.drillBtn("Review again", false);
      again.style.flex = "none"; again.style.width = "100%";
      again.addEventListener("click", () => { this.deckIdx = 0; this.revealed = false; this.renderDrill(); });
      done.appendChild(again);
      // in a study session: offer advancing to the next technique
      if (this._inSession && this._session && this._session.keys) {
        const ses = this._session;
        const cur = ses.keys.indexOf(info.key);
        if (cur >= 0 && cur < ses.keys.length - 1) {
          const next = this.drillBtn("Next technique \u2192", true);
          next.style.flex = "none"; next.style.width = "100%"; next.style.marginTop = "8px";
          next.addEventListener("click", () => { ses.idx = cur + 1; const nk = ses.keys[cur + 1]; const ni = this.nodeForKey(nk); if (ni >= 0) this.locateNode(ni); this.studyFromSession(nk); });
          done.appendChild(next);
        } else if (cur === ses.keys.length - 1) {
          // session finished — celebrate, then a subtle close
          this.track("neural_session_completed", { techniques: ses.keys.length });
          done.innerHTML =
            '<div style="font-size:26px;margin-bottom:10px;">\uD83C\uDF89</div>' +
            '<div style="font-size:15px;font-weight:700;color:#bff0d2;margin-bottom:6px;">Done for today \u2014 great job!</div>' +
            '<div style="font-size:11.5px;color:#9ab3a4;line-height:1.5;margin-bottom:14px;">You reviewed all ' + ses.keys.length + ' techniques in this session.</div>';
          // 7-day progress sparkline — REAL history from the persisted daily counts
          const dk7 = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); dk7.push(d); }
          const week = dk7.map((d) => (this._days || {})[this._dayKey(d)] || 0);
          const days = dk7.map((d) => ["S", "M", "T", "W", "T", "F", "S"][d.getDay()]);
          const maxv = Math.max(1, Math.max.apply(null, week));
          let bars = '<div style="display:flex;align-items:flex-end;justify-content:center;gap:7px;height:60px;margin-bottom:6px;">';
          week.forEach((v, i) => { const last = i === week.length - 1; const h = Math.max(6, Math.round((v / maxv) * 54)); bars += '<div style="display:flex;flex-direction:column;align-items:center;gap:5px;"><div style="width:16px;height:' + h + 'px;border-radius:4px;background:' + (last ? "linear-gradient(180deg,#7ee0a8,#4a9c74)" : "rgba(120,150,210,.3)") + ';"></div><span style="font-size:9px;color:' + (last ? "#7ee0a8" : "#6b7691") + ';font-weight:600;">' + days[i] + '</span></div>'; });
          bars += '</div>';
          const plot = document.createElement("div");
          plot.style.cssText = "background:rgba(255,255,255,.03);border:1px solid rgba(150,170,210,.12);border-radius:12px;padding:14px 12px 10px;margin-bottom:14px;";
          plot.innerHTML = '<div style="font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#7b8aa8;font-weight:700;margin-bottom:10px;">This week</div>' + bars;
          done.appendChild(plot);
          const close = document.createElement("button");
          close.textContent = "Close";
          close.style.cssText = "cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;padding:9px 18px;border-radius:10px;border:1px solid rgba(150,170,210,.25);background:rgba(255,255,255,.04);color:#aeb6c8;";
          close.addEventListener("click", () => { this._session = null; this._sessionNodes = null; this._inSession = false; this.setDeckOpen(false); });
          done.appendChild(close);
        }
      }
      list.appendChild(done);
      return;
    }

    const card = deck[this.deckIdx];
    const host = document.createElement("div");
    host.style.cssText = "margin-top:auto;background:rgba(30,34,54,.72);border:1px solid rgba(150,170,210,.18);border-radius:14px;padding:16px 16px 15px;animation:ngCardIn .28s cubic-bezier(.2,.7,.2,1) both;";
    // progress dots
    let dots = '';
    for (let i = 0; i < deck.length; i++) dots += '<span style="width:6px;height:6px;border-radius:50%;background:' + (i === this.deckIdx ? '#7e9bff' : (i < this.deckIdx ? 'rgba(126,224,168,.55)' : 'rgba(150,170,210,.22)')) + ';"></span>';
    host.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">' +
        '<span style="display:flex;align-items:center;gap:7px;">' + chipLabel +
          (card.tag ? '<span style="font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;color:#9ab0e0;background:rgba(90,140,255,.13);border:1px solid rgba(120,150,255,.26);border-radius:999px;padding:2px 8px;">' + card.tag + '</span>' : '') +
        '</span>' +
        '<span style="font-size:10px;font-weight:600;color:#8094b4;">' + (this.deckIdx + 1) + ' / ' + deck.length + '</span>' +
      '</div>' +
      '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:#7b8aa8;margin-bottom:7px;">Question</div>' +
      '<div style="font-size:15px;font-weight:600;color:#eef1f6;line-height:1.45;min-height:44px;">' + card.q + '</div>' +
      (this.revealed
        ? '<div style="margin-top:14px;padding-top:13px;border-top:1px solid rgba(150,170,210,.14);"><div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:#7ee0a8;margin-bottom:7px;">Answer</div><div style="font-size:13px;color:#c8d2e4;line-height:1.6;">' + card.a + '</div></div>'
        : '<div style="margin-top:14px;height:1px;"></div>') +
      '<div class="acts" style="margin-top:16px;"></div>' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px;">' + dots + '</div>';
    list.appendChild(host);

    // controls live in the pinned footer so they're always in the same place (and mobile-friendly)
    const foot = this.drillFootRef.current; if (foot) {
      foot.style.display = "flex"; foot.innerHTML = "";
      const acts = document.createElement("div"); acts.style.cssText = "display:flex;gap:8px;";
      if (!this.revealed) {
        const show = this.drillBtn("Reveal answer", true);
        show.addEventListener("click", () => { this.revealed = true; this.renderDrill(); });
        acts.appendChild(show);
      } else {
        const again = this.drillBtn("Review again", false);
        const got = this.drillBtn("Got it", true);
        again.addEventListener("click", () => { this.deckIdx++; this.revealed = false; this.renderDrill(); });
        got.addEventListener("click", () => { this.prep[info.key] = (this.prep[info.key] || 0) + 1; this.noteCardDone(this.deck[this.deckIdx], info.key); this.noteCardAnswered(); this.refreshOptionOdds(); this.deckIdx++; this.revealed = false; this.renderDrill(); });
        acts.appendChild(again); acts.appendChild(got);
      }
      foot.appendChild(acts);
      const nav = document.createElement("div"); nav.style.cssText = "display:flex;gap:8px;";
      const prev = this.drillBtn("\u2039 Previous", false);
      const next = this.drillBtn("Next \u203a", false);
      prev.style.fontSize = "12px"; next.style.fontSize = "12px";
      if (this.deckIdx === 0) { prev.style.opacity = ".4"; }
      prev.addEventListener("click", () => { if (this.deckIdx > 0) { this.deckIdx--; this.revealed = false; this.renderDrill(); } });
      next.addEventListener("click", () => { this.deckIdx++; this.revealed = false; this.renderDrill(); });
      nav.appendChild(prev); nav.appendChild(next);
      foot.appendChild(nav);
      const hint = document.createElement("div");
      hint.style.cssText = "display:flex;align-items:center;justify-content:center;gap:10px;margin-top:4px;font-size:9.5px;font-weight:600;letter-spacing:.02em;color:#6b7691;";
      const kb = '<span style="display:inline-block;min-width:13px;text-align:center;padding:1px 3px;border-radius:3px;background:rgba(255,255,255,.06);color:#9aa6bd;">';
      hint.innerHTML = kb + '\u2190\u2192</span> card' + (this._inSession ? '<span style="color:#3d4761;">\u00b7</span>' + kb + '\u2191\u2193</span> technique' : '') + '<span style="color:#3d4761;">\u00b7</span>' + kb + 'space</span> flip';
      foot.appendChild(hint);
    }
    return;
  }

  flashFx(delta) {
    if (Math.abs(delta) < 0.02) return;
    // primary attention cue: glow + move the lose-win marker
    this.adv.glow = 1; this.adv.sign = delta > 0 ? 1 : -1; this.adv.glowMag = Math.min(1, Math.abs(delta) * 1.4);
    // secondary: a gentle, capped global tint (never overwhelming)
    const el = this.fxRef.current; if (!el) return;
    const inten = Math.min(0.26, 0.08 + Math.abs(delta) * 0.5);
    const col = delta > 0 ? "64,132,255" : "232,64,64";
    el.style.background = "radial-gradient(ellipse at center, rgba(" + col + ",0) 38%, rgba(" + col + "," + inten + ") 112%)";
    this.flash = { t0: this.now, dur: 1.1, inten: inten };
    el.style.opacity = String(inten);
  }
  updateFlash() {
    if (this.flash) {
      const el = this.fxRef.current;
      const k = (this.now - this.flash.t0) / this.flash.dur;
      if (k >= 1) { if (el) el.style.opacity = "0"; this.flash = null; }
      else if (el) el.style.opacity = String(this.flash.inten * (1 - k) * (1 - k));
    }
    this.updateAdvMarker();
  }
  updateAdvMarker() {
    const m = this.legendMarkRef.current; if (!m || !this.adv) return;
    const dt = this._mdt || 0.016;
    this.adv.cur += (this.adv.target - this.adv.cur) * (1 - Math.exp(-dt / 0.26));
    m.style.left = this.adv.cur.toFixed(2) + "%";
    m.style.opacity = this.adv.shown ? "1" : "0";
    if (this.adv.glow > 0) this.adv.glow = Math.max(0, this.adv.glow - dt / 0.95);
    const g = this.adv.glow * (this.adv.glowMag || 1);
    const col = this.adv.sign >= 0 ? "64,132,255" : "232,64,64";
    m.style.width = (2.5 + 2.4 * g).toFixed(1) + "px";
    m.style.background = g > 0.15 ? "rgb(" + col + ")" : "#fff";
    m.style.boxShadow = "0 0 5px rgba(0,0,0,.6)" + (g > 0.02
      ? ", 0 0 " + (7 + 18 * g).toFixed(0) + "px rgba(" + col + "," + (0.9 * g).toFixed(2) + "), 0 0 " + (3 + 7 * g).toFixed(0) + "px rgba(" + col + "," + g.toFixed(2) + ")"
      : ", 0 0 3px rgba(255,255,255,.8)");
    const pt = this.legendPointRef.current;
    if (pt) { pt.style.borderTopColor = g > 0.15 ? "rgb(" + col + ")" : "#fff"; pt.style.filter = g > 0.02 ? "drop-shadow(0 0 " + (4 + 8 * g).toFixed(0) + "px rgba(" + col + "," + g.toFixed(2) + "))" : "none"; }
  }
  updateUiShift(dt) {
    // sidebar overlays the graph — nothing slides. Only keep the option cards clear of the panel.
    const tgt = this.deckShown ? 1 : 0;
    this.uiShift += (tgt - this.uiShift) * (1 - Math.exp(-dt / 0.4));
    if (Math.abs(tgt - this.uiShift) < 0.001) this.uiShift = tgt;
    const op = this.optionsRef.current;
    if (op) op.style.paddingRight = (24 + this.uiShift * this.sbOffset()).toFixed(1) + "px";
    // fade the legend out only while option cards actually overlap it; fade back in otherwise
    const leg = this.legendRef.current;
    if (leg && op) {
      let overlap = false;
      if (op.children.length) {
        const lr = leg.getBoundingClientRect();
        for (const c of op.children) { const cr = c.getBoundingClientRect(); if (cr.right > lr.left - 12 && cr.left < lr.right + 12 && cr.bottom > lr.top - 12) { overlap = true; break; } }
      }
      leg.style.opacity = overlap ? "0.06" : "1";
    }
    // scroll affordance: show "more →" only when the option row overflows and isn't at the end
    const hint = this.optionHintRef.current;
    if (hint && op) {
      const more = !this.deckShown && !this._detailCtx && op.children.length && (op.scrollWidth - op.clientWidth - op.scrollLeft > 8);
      hint.style.opacity = more ? "0.5" : "0";
      hint.style.pointerEvents = more ? "auto" : "none";
    }
    // the open sidebar owns the top-right corner — retract the account pill so it doesn't sit over the sidebar's close button
    // the Guest pill stays put and fuses with the sidebar (like the logo with the left explorer) — never retracts
    const ac = this.accountRef.current;
    if (ac) { ac.style.opacity = "1"; ac.style.pointerEvents = "auto"; ac.style.transform = "none"; }
  }
  clearOptions() { const el = this.optionsRef.current; if (el) { el.innerHTML = ""; el.style.pointerEvents = "none"; el.style.opacity = "1"; el.style.transform = "none"; el.style.overflowX = "auto"; el.style.overflowY = "hidden"; el.style.webkitMaskImage = ""; el.style.maskImage = ""; el.style.justifyContent = "safe center"; el.style.paddingLeft = ""; el.style.paddingRight = ""; el.scrollLeft = 0; } this._detailCtx = null; this.hideOptDetail(); this.optionIdxs = []; this._optionCards = []; this._optHintAt = 0; }
  tweenScroll(el, delta) {
    if (this._scrollRaf) cancelAnimationFrame(this._scrollRaf);
    const from = el.scrollLeft;
    const to = from + delta;                       // desired target (clamped live below, since scrollWidth grows as the slot expands)
    const dur = 420, t0 = performance.now();
    const ease = (p) => 1 - Math.pow(1 - p, 3);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const maxNow = el.scrollWidth - el.clientWidth;
      const dest = Math.max(0, Math.min(maxNow, to));
      el.scrollLeft = from + (dest - from) * ease(p);
      if (p < 1) this._scrollRaf = requestAnimationFrame(step);
    };
    this._scrollRaf = requestAnimationFrame(step);
  }

  showCenter(kicker, text, sub, tone, small) {
    const col = this.toneColor(tone);
    const k = this.evcKickerRef.current, t = this.evcTextRef.current, s = this.evcSubRef.current, box = this.evCenterRef.current;
    if (k) { k.textContent = kicker; k.style.color = col; }
    if (t) { t.textContent = text; t.style.color = tone === "good" ? "#cfe6ff" : tone === "bad" ? "#ffd6d6" : "#eef1f6"; t.style.fontSize = small ? "clamp(26px,3.2vw,38px)" : "clamp(40px,6vw,68px)"; }
    if (s) s.textContent = sub || "";
    if (box) box.style.opacity = "1";
  }
  hideCenter() { const box = this.evCenterRef.current; if (box) box.style.opacity = "0"; }

  endRound(kind, name) {
    this.clearTimers(); this.clearOptions();
    this.track("neural_roll_ended", { outcome: kind, moves: this.moveCount || 0 });
    if (kind !== "reset" && this.anim("slowMoFinish", true)) this._slowmo = this.now;
    this._lastOutcome = kind;
    this.deckReady = false;
    this.applyDeckVisibility();
    if (this.adv) this.adv.shown = false;
    this.pulse = null; this.optionIdxs = [];
    const map = {
      win: { k: "Submission", big: "You finished it", tone: "good", hold: 4.4 },
      lose: { k: "Tapped out", big: "You got caught", tone: "bad", hold: 3.8 },
      reset: { k: "Scramble", big: "Roll reset", tone: "muted", hold: 2.8 },
    };
    const m = map[kind] || map.reset;
    if (this.evRef.current) this.evRef.current.style.opacity = "0";
    this.showCenter(m.k, m.big, name || "", m.tone);
    this.endCenter = { x: this.nodes[this.currentPos].x, y: this.nodes[this.currentPos].y };
    this.endZoom = true;
    this.after(m.hold, () => {
      this.hideCenter();
      this.after(0.55, () => { this.endZoom = false; this.startRoll(); });
    });
  }

  // action nodes adjacent to a position, ranked, deduped by title
  optionsFor(posIdx) {
    const seen = new Set(); const out = [];
    const hereId = this.nodes[posIdx].posId || null;
    for (const k of this.adj[posIdx]) {
      const n = this.nodes[k];
      if (n.ty === "positions") continue;
      if (seen.has(n.t)) continue; seen.add(n.t);
      // only moves YOUR role performs: the action must favor your side (the beneficiary is the performer)
      if (this.myVal(n) < this.oppVal(n) - 0.05) continue;
      // contextual: exact canonical origin match (data now provides fromPositionId)
      if (n.fromPositionId && hereId && n.fromPositionId !== hereId) continue;
      const res = this.resultPos(k, posIdx);
      out.push({ idx: k, node: n, res });
    }
    // safety: if role-filtering left nothing, fall back to the best-for-me handful
    if (!out.length) {
      for (const k of this.adj[posIdx]) {
        const n = this.nodes[k]; if (n.ty === "positions") continue; if (seen.has(n.t + "_fb")) continue; seen.add(n.t + "_fb");
        out.push({ idx: k, node: n, res: this.resultPos(k, posIdx) });
      }
      out.sort((a, b) => this.myVal(b.node) - this.myVal(a.node));
      return out.slice(0, 6);
    }
    out.sort((a, b) => this.orderScore(b) - this.orderScore(a));
    return out.slice(0, 10);
  }
  resultPos(actIdx, fromIdx) {
    let best = -1;
    for (const k of this.adj[actIdx]) { if (this.nodes[k].ty === "positions" && k !== fromIdx) { best = k; break; } }
    if (best < 0) for (const k of this.adj[actIdx]) { if (this.nodes[k].ty === "positions") { best = k; break; } }
    return best;
  }

  catGlyph(n, num, col) {
    // category shape (circle=position, diamond=transition, triangle=submission) with the keyboard number fused inside
    const showNum = !!(num && num <= 9 && this.get("cardNumbers", true));
    const sub = n.ty === "submissions";
    const ty = n.ty === "positions" ? "circle" : (sub ? "tri" : "diamond");
    let shape;
    if (ty === "tri") shape = '<path d="M10 2.6 L17.6 16.6 L2.4 16.6 Z" fill="' + col + '26" stroke="' + col + '" stroke-width="1.5" stroke-linejoin="round"></path>';
    else if (ty === "circle") shape = '<circle cx="10" cy="10" r="7.7" fill="' + col + '26" stroke="' + col + '" stroke-width="1.5"></circle>';
    else shape = '<path d="M10 1.9 L18.1 10 L10 18.1 L1.9 10 Z" fill="' + col + '26" stroke="' + col + '" stroke-width="1.5" stroke-linejoin="round"></path>';
    const ty2 = sub ? "12.9" : "10.7";
    const txt = showNum ? '<text x="10" y="' + ty2 + '" text-anchor="middle" dominant-baseline="middle" font-size="8.5" font-weight="700" font-family="\'Space Grotesk\',sans-serif" fill="#eef1f6">' + num + '</text>' : '';
    return '<span style="flex:none;width:20px;height:20px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 0 4px ' + col + '70);"><svg width="20" height="20" viewBox="0 0 20 20">' + shape + txt + '</svg></span>';
  }
  buildOptionCard(opt, onPick, decisionSec, num, mode) {
    const n = opt.node;
    const isEsc = mode === "escape";
    const card = document.createElement("div");
    card.style.cssText = "pointer-events:auto;cursor:pointer;position:relative;overflow:hidden;flex:0 0 150px;width:150px;background:rgba(28,32,52,.78);backdrop-filter:blur(6px);border:1px solid rgba(150,170,210,.18);border-radius:11px;padding:11px 12px 13px;opacity:1;transform:translateY(10px);transition:transform .34s cubic-bezier(.2,.7,.2,1),border-color .15s,background .15s;";
    const col = this.hex(n.col);
    const resName = opt.res >= 0 ? this.nodes[opt.res].t : "\u2014";
    const pct = Math.round((isEsc ? Math.max(0.08, Math.min(0.92, 0.4 + (this.myVal(n) - this.myVal(this.nodes[this._defendSub])) * 0.15 + this.stateBonus(this.defendKeyFor(this.nodes[this._defendSub])) - (this.aiSkill || 0))) : this.moveChance(n)) * 100);
    const oddsCol = pct >= 60 ? "#7ee0a8" : pct >= 38 ? "#cbd24e" : "#e8956b";
    const pot = Math.round(this.movePotential(opt) * 100);
    const bottomRow = '<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(150,170,210,.1);display:flex;align-items:baseline;justify-content:space-between;gap:8px;">' +
      '<div style="font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8094b4;">Success rate</div>' +
      '<span class="ngodds" style="font-size:15px;font-weight:700;color:' + oddsCol + ';">' + pct + '%</span>' +
      '</div>';
    card.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">' +
        this.catGlyph(n, num, col) +
        '<span style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#8094b4;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (n.ty === "positions" ? "Position" : n.ty === "submissions" ? "Submission" : "Transition") + '</span>' +
        '<span style="flex:none;font-size:13px;font-weight:700;color:' + this.potColor(pot) + ';">' + (pot > 0 ? "+" : "") + pot + '</span>' +
      '</div>' +
      '<div style="font-size:13.5px;font-weight:600;color:#eef1f6;line-height:1.22;margin-bottom:3px;">' + this.splitName(n.t).main + '</div>' +
      (this.splitName(n.t).from ? '<div style="font-size:10.5px;color:#8094b4;margin-bottom:5px;">' + this.splitName(n.t).from + '</div>' : '') +
      '<div style="font-size:11px;color:#93a0bd;line-height:1.3;">' + (isEsc ? "escape route" : "&rarr; " + this.splitName(resName).main) + '</div>' +
      bottomRow +
      '<div class="ngbar" style="position:absolute;left:0;bottom:0;height:3px;width:100%;background:' + col + ';transform-origin:left;transform:scaleX(1);"></div>';
    card.addEventListener("mouseenter", () => { card.style.borderColor = "rgba(150,180,255,.55)"; card.style.background = "rgba(40,48,76,.9)"; card.style.transform = "translateY(-2px)"; });
    card.addEventListener("mouseleave", () => { card.style.borderColor = "rgba(150,170,210,.18)"; card.style.background = "rgba(28,32,52,.78)"; card.style.transform = "translateY(0)"; });
    card.addEventListener("click", () => { if (isEsc) onPick(opt); else this.expandOption(opt, onPick, card); });
    const bar = card.querySelector(".ngbar");
    if (bar) { bar.style.animation = "ngCount " + decisionSec + "s linear forwards"; if (this.paused) bar.style.animationPlayState = "paused"; }
    (this._optionCards = this._optionCards || []).push({ node: n, card: card });
    const di = 20 + (num && num > 0 ? num - 1 : 0) * 45;
    setTimeout(() => { card.style.transform = "none"; }, di);
    return card;
  }
  refreshOptionOdds() {
    for (const oc of (this._optionCards || [])) {
      const el = oc.card.querySelector(".ngodds"); if (!el) continue;
      const pct = Math.round(this.moveChance(oc.node) * 100);
      el.textContent = pct + "%";
      el.style.color = pct >= 60 ? "#7ee0a8" : pct >= 38 ? "#cbd24e" : "#e8956b";
    }
  }

  // ---------- roll state machine ----------
  rollFromPosition(nodeIdx) {
    // start a NEW roll seeded at a chosen position; the current roll is archived into Previous rolls
    this.clearTimers(); this.clearOptions();
    let posIdx = nodeIdx;
    if (this.nodes[nodeIdx] && this.nodes[nodeIdx].ty !== "positions") {
      let p = -1; for (const k of this.adj[nodeIdx]) { if (this.nodes[k].ty === "positions") { p = k; break; } }
      posIdx = p >= 0 ? p : nodeIdx;
    }
    if (this.rollLog && this.rollLog.length > 1) {
      this._pastRolls = this._pastRolls || [];
      this._pastRolls.unshift({ log: this.rollLog.slice(), outcome: this._lastOutcome || "reset", ts: Date.now() });
      if (this._pastRolls.length > 40) this._pastRolls.pop();
    }
    this._lastOutcome = null;
    this.rollLog = []; this._lastActor = null; this._currentDeckKey = null;
    this._sessionNodes = null; this._session = null; this._inSession = false;
    this.moveCount = 0; this.maxMoves = 9 + ((Math.random() * 4) | 0);
    this.aiSkill = this.get("difficulty", "normal") === "off" ? 0 : 0.06 + Math.random() * 0.14;
    const t = (this.nodes[posIdx].t || "");
    this.playerRole = /\bbottom\b/i.test(t) ? "bottom" : (/\btop\b/i.test(t) ? "top" : (Math.random() < 0.5 ? "top" : "bottom"));
    this.currentPos = posIdx; this.focusIdx = posIdx; this.pulse = null; this.activeMove = null;
    this.camFocus = { x: this.nodes[posIdx].x, y: this.nodes[posIdx].y };
    this.camTarget = { cx: this.nodes[posIdx].x, cy: this.nodes[posIdx].y, vw: this.graphW * 0.42 };
    this.prevPosVal = this.myVal(this.nodes[posIdx]);
    this.hideCenter(); this.setPaused(false);
    this.flare(posIdx);
    this.after(0.6, () => this.enterLand(true));
  }
  startRoll() {
    this.clearTimers(); this.clearOptions();
    this.track("neural_roll_started", {});
    // archive the roll that just ended so the sidebar can show "Previous roll / Today / Yesterday"
    if (this.rollLog && this.rollLog.length > 1) {
      this._pastRolls = this._pastRolls || [];
      this._pastRolls.unshift({ log: this.rollLog.slice(), outcome: this._lastOutcome || "reset", ts: Date.now() });
      if (this._pastRolls.length > 40) this._pastRolls.pop();
    }
    this._lastOutcome = null;
    this.rollLog = []; this._lastActor = null;
    this._sessionNodes = null; this._session = null; this._inSession = false;
    this.moveCount = 0; this.maxMoves = 9 + ((Math.random() * 4) | 0);
    this.playerRole = Math.random() < 0.5 ? "top" : "bottom"; // you start either side
    this.aiSkill = this.get("difficulty", "normal") === "off" ? 0 : 0.06 + Math.random() * 0.14; // opponent resistance, gated by difficulty
    // random starting position
    const positions = this._posIdx || (this._posIdx = this.nodes.filter((n) => n.ty === "positions" && this.adj[n.idx].some((k) => this.nodes[k].ty !== "positions")).map((n) => n.idx));
    if (!positions.length) { console.error("[neural] no playable position nodes"); this._fallbackToLegacy(); return; } // degenerate graph → don't crash in a timer
    // first roll: start on a position that has a seeded deck so the example shows immediately
    if (!this._firstRollDone) {
      this._firstRollDone = true;
      const withDeck = positions.filter((i) => this.flashcards && this.flashcards.decks && this.flashcards.decks[this.deckKeyFor(this.nodes[i]).key]);
      this.currentPos = withDeck.length ? withDeck[(Math.random() * withDeck.length) | 0] : positions[(Math.random() * positions.length) | 0];
    } else {
      this.currentPos = positions[(Math.random() * positions.length) | 0];
    }
    this.showCenter("Restarting the roll", this.posFamily(this.nodes[this.currentPos].t), this.roleLabel() + " \u00b7 new roll", "muted", true);
    this.focusIdx = this.currentPos; this.pulse = null;
    this.camFocus = { x: this.nodes[this.currentPos].x, y: this.nodes[this.currentPos].y };
    this.prevPosVal = this.myVal(this.nodes[this.currentPos]);
    this.flare(this.currentPos);
    this.after(1.3, () => this.enterLand(true));
  }

  startLandRipple(centerIdx, neighborIdxs) {
    const c = this.nodes[centerIdx]; if (!c) return;
    this.ripples = [];
    let i = 0;
    for (const nb of neighborIdxs) {
      const n = this.nodes[nb]; if (!n) continue;
      const len = Math.hypot(n.x - c.x, n.y - c.y);
      this.ripples.push({ a: centerIdx, b: nb, t0: this.now + i * 0.13, dur: 0.95 + len / 850, done: false });
      i++;
    }
  }
  updateRipples() {
    if (!this.ripples || !this.ripples.length) return;
    for (const r of this.ripples) {
      if (!r.done && this.now >= r.t0 + r.dur) { r.done = true; this.flare(r.b); }
    }
    const last = this.ripples[this.ripples.length - 1];
    if (this.now - (last.t0 + last.dur) > 1.9) this.ripples = [];
  }
  enterLand(first) {
    const pos = this.nodes[this.currentPos];
    this.focusIdx = this.currentPos; this.pulse = null;
    this._settleT = this.now;
    this.activeMove = null;
    this.hideCenter(); // clear the "Restarting the roll" center toast as play begins
    this.flare(this.currentPos);
    if (!first) {
      // HUD + marker communicate the landing; clear any stale action toast (no duplicate position text)
      if (this.evRef.current) this.evRef.current.style.opacity = "0";
    }
    this.setStatus(pos);
    (this.exploredSet = this.exploredSet || new Set()).add(this.posFamily(pos.t));
    (this._exploredKeys = this._exploredKeys || new Set()).add(this.deckKeyFor(pos).key);
    // append to the roll history log (skip exact consecutive dupes)
    this.rollLog = this.rollLog || [];
    const hkey = this.deckKeyFor(pos).key;
    // was the OPEN flashcard box the latest (current-state) row? if so, carry it forward to the new latest row
    const prevLatest = this.rollLog.length - 1;
    const wasLatestOpen = this._openLatestOnLand || (prevLatest >= 0 && this._openRow === ("c" + prevLatest));
    const lastLog = this.rollLog[this.rollLog.length - 1];
    if (!lastLog || lastLog.key !== hkey) {
      const intent = this._pendingIntent; this._pendingIntent = null;
      let intendInfo = null;
      if (intent && intent.idx != null && intent.idx !== this.currentPos && this.nodes[intent.idx]) {
        const inode = this.nodes[intent.idx];
        intendInfo = { name: this.posFamily(inode.t), val: this.signedVal(inode) };
      }
      this.rollLog.push({ key: hkey, name: this.posFamily(pos.t), role: this.roleLabel(), idx: this.currentPos, actor: first ? "start" : (this._lastActor || "you"), val: this.signedVal(pos), intend: intendInfo });
      if (this.rollLog.length > 24) this.rollLog.shift();

    }
    // carry the open current-state box forward to the new latest row (also opens it after a "roll from here")
    if (wasLatestOpen) { const L = this.rollLog.length - 1; this._openRow = "c" + L; this._focusRow = "c" + L; }
    // a new roll restarting (manual restart / after an end-game) opens the flashcards for the starting position
    if (first && this._openSidebarOnLand) {
      const L = this.rollLog.length - 1;
      this._openRow = "c" + L; this._focusRow = "c" + L;
      this._drillView = "home"; this.deck = null;
      this.deckReady = true; this.deckOpen = true;
    }
    this._openLatestOnLand = false;
    this._lastActor = null;
    this.buildDrillPanel(this.currentPos);
    if (first && this._openSidebarOnLand) { this._openSidebarOnLand = false; this.applyDeckVisibility(); this.renderDrillHome(); }
    const opts = this.optionsFor(this.currentPos);
    if (!opts.length) { this.after(1.0, () => this.startRoll()); return; }
    this.optionIdxs = opts.map((o) => o.idx);
    this.startLandRipple(this.currentPos, this.optionIdxs);
    // base reading time (seconds, user-set) plus a little for more options to weigh
    const base = this.get("decisionSec", 9);
    const dsec = base + (opts.length - 1) * 0.8;
    this._decisionDsec = dsec;
    this._armDeckExpire();
    const el = this.optionsRef.current; if (el) el.innerHTML = "";
    let picked = false;
    const pick = (opt) => { if (picked) return; picked = true; this._optPick = null; this._optList = null; this.clearTimers(); this.clearOptions(); this.enterAttempt(opt); };
    for (let i = 0; i < opts.length; i++) el.appendChild(this.buildOptionCard(opts[i], pick, dsec, i + 1));
    if (el) el.style.pointerEvents = "auto";
    this._optPick = pick; this._optList = opts;
    // default auto-pick weighted toward aggressive moves
    this.after(dsec, () => {
      if (picked) return;
      let pool = []; for (const o of opts) { const w = Math.max(0.12, 0.5 + o.node.dom); for (let i = 0; i < Math.round(w * 10); i++) pool.push(o); }
      pick(pool[(Math.random() * pool.length) | 0] || opts[0]);
    });
  }

  enterAttempt(opt) {
    const act = this.nodes[opt.idx];
    this.track("neural_move_picked", { technique: act.t, node_type: act.ty });
    this._pendingIntent = { actor: "you", idx: opt.res >= 0 ? opt.res : opt.idx };
    const verb = act.ty === "submissions" ? "Going for the submission" : "Attempting the transition";
    this.setEvent(verb, act.t, "info");
    this.activeMove = { idx: opt.idx, verb: "Attacking", col: { r: 94, g: 149, b: 255 } };
    this.startTravel([this.currentPos, opt.idx], () => {
      this.after(0.35, () => this.resolve(opt));
    });
  }

  // calibrated per-technique success as 0..1, frame-aware (gi/no-gi), from graph.json via
  // node.cal; null when the node carries no calibrated rate. This is the page==graph==game seam:
  // the same number the dossier/page shows, selected for the active ruleset.
  calSuccess(act) {
    const c = act && act.cal;
    if (!c) return null;
    const br = c.successRateByRuleset;
    let v = (br && this._giMode && br[this._giMode] != null) ? br[this._giMode] : c.successRate;
    return (typeof v === "number") ? Math.max(0, Math.min(1, v / 100)) : null;
  }
  // success = the calibrated base (page==graph==game) shifted by your modifiers (skill + drilling)
  // vs the opponent's resistance. Falls back to the old dominance heuristic only for uncalibrated nodes.
  moveChance(act) {
    const ov = this.successOverride(act);
    if (ov != null) return ov;
    const cal = this.calSuccess(act);
    const base = (cal != null) ? cal : ((act.ty === "submissions" ? 0.36 : 0.56) + act.dom * 0.1);
    const playerMod = this.stateBonus(this._posKey) + this.stateBonus(this.deckKeyFor(act).key);
    const aiMod = Math.max(0, this.oppVal(this.nodes[this.currentPos])) * 0.4 + (this.aiSkill || 0);
    return Math.max(0.05, Math.min(0.95, base + playerMod - aiMod));
  }
  _hash01(i) { const x = Math.sin((i + 1) * 12.9898) * 43758.5453; return x - Math.floor(x); }
  // a per-technique success override (0..1) set via the card steppers / Your modifiers panel, or null if none active
  successOverride(act) {
    if (!this.userMods) return null;
    const m = this.userMods.find((x) => x.on && x.name === act.t);
    return m ? Math.max(0.05, Math.min(0.95, m.pct / 100)) : null;
  }
  // bump the player's success rate for this technique by dir*5, creating a modifier if none exists; persists + shows in Settings
  bumpCardSuccess(node, dir) {
    this.ensureMods();
    let m = this.userMods.find((x) => x.name === node.t);
    if (!m) {
      const cat = node.ty === "submissions" ? "Submission" : node.ty === "transitions" ? "Transition" : "Position";
      const cs = this.calSuccess(node); // seed the stepper from the calibrated rate, not the pre-modifier heuristic
      m = { name: node.t, cat: cat, pct: Math.round((cs != null ? cs : this.moveChance(node)) * 100), on: true };
      this.userMods.push(m);
    }
    m.on = true;
    m.pct = Math.max(5, Math.min(95, Math.round(m.pct / 5) * 5 + dir * 5));
    this.refreshOptionOdds();
  }
  // colour a potential value (-100..100): vivid red when negative, blue when positive, neutral near zero
  potColor(p) {
    const lerp = (a, b, t) => "#" + [0, 1, 2].map((i) => { const av = parseInt(a.substr(1 + i * 2, 2), 16), bv = parseInt(b.substr(1 + i * 2, 2), 16); return ("0" + Math.round(av + (bv - av) * t).toString(16)).slice(-2); }).join("");
    const neutral = "#9aa6bd";
    if (p > 1) return lerp("#8fa6d4", "#5b8cff", Math.min(1, p / 45));        // → blue (winning)
    if (p < -1) return lerp("#e09089", "#f23b4e", Math.min(1, -p / 45));      // → red (losing), already red at small magnitude
    return neutral;
  }
  // POTENTIAL: signed proximity-to-win the move unlocks (-1..1). Strong resulting position = +, worse position = -. A finish = +1.
  movePotential(opt) {
    const n = opt.node;
    if (n.ty === "submissions") return 1;                       // a finish IS the win
    const resIdx = opt.res;
    const resVal = resIdx >= 0 ? this.myVal(this.nodes[resIdx]) : this.myVal(n);   // -1..1 dominance where you land
    const onward = resIdx >= 0 ? (this.nodes[resIdx].deg || 0) : (n.deg || 0);
    const reach = Math.min(1, onward / 16);                      // follow-ups it opens (0..1)
    const p = resVal * 0.88 + (resVal >= 0 ? reach * 0.12 : 0);   // follow-ups only sweeten an already-good spot
    return Math.max(-1, Math.min(1, p));
  }
  // POPULARITY: how often the move gets picked from here (a stable, graph-derived pick rate)
  movePopularity(opt) {
    const n = opt.node;
    const resIdx = opt.res;
    const hub = resIdx >= 0 ? (this.nodes[resIdx].deg || 0) : (n.deg || 0);
    const self = n.deg || 0;
    const base = Math.min(1, (self * 0.6 + hub * 0.4) / 15);
    const typeAdj = n.ty === "submissions" ? -0.05 : 0.03;
    return Math.max(0.03, Math.min(1, base * 0.8 + this._hash01(n.idx) * 0.2 + typeAdj));
  }
  // ON-MAP frequency: from how many positions across the graph this technique shows up
  mapFreq(n) {
    if (!this._freqMap) {
      const byName = {};
      this.nodes.forEach((nd, i) => { if (nd.ty === "positions") return; const key = this.splitName(nd.t).main; (byName[key] = byName[key] || []).push(i); });
      const m = {};
      for (const key in byName) {
        const posSet = new Set();
        for (const i of byName[key]) for (const k of this.adj[i]) if (this.nodes[k].ty === "positions") posSet.add(k);
        m[key] = Math.max(byName[key].length, posSet.size);
      }
      this._freqMap = m;
    }
    return this._freqMap[this.splitName(n.t).main] || 1;
  }
  orderScore(opt) { return this.get("cardOrder", "potential") === "popularity" ? this.movePopularity(opt) : this.movePotential(opt); }
  // resolve a cal.outcomes[].to (role-node slug "<pos>/top|bottom" | bare technique slug |
  // "game-over") to a node index. { idx:-1 } unresolved, { terminal:true } for game-over,
  // role = the authored landing role (top/bottom) for position targets.
  resolveOutcomeTo(to) {
    if (!to || typeof to !== "string") return { idx: -1, terminal: false };
    const t = to.trim().toLowerCase();
    if (t === "game-over") return { idx: -1, terminal: true };
    const m = t.match(/^(.*)\/(top|bottom)$/);
    if (m) { const i = this._posSlugIndex && this._posSlugIndex.get(m[1]); return { idx: i == null ? -1 : i, terminal: false, role: m[2] }; }
    let i = this._techSlugIndex && this._techSlugIndex.get(t);
    if (i != null) return { idx: i, terminal: false };
    i = this._posSlugIndex && this._posSlugIndex.get(t);
    return { idx: i == null ? -1 : i, terminal: false };
  }
  // draw one cal.outcome weighted by probability (they sum ~100); null when the node has no cal.
  drawOutcome(act) {
    const outs = act && act.cal && Array.isArray(act.cal.outcomes) ? act.cal.outcomes : null;
    if (!outs || !outs.length) return null;
    let total = 0; for (const o of outs) total += Math.max(0, +o.probability || 0);
    if (total <= 0) return outs[0];
    let r = Math.random() * total;
    for (const o of outs) { r -= Math.max(0, +o.probability || 0); if (r <= 0) return o; }
    return outs[outs.length - 1];
  }
  resolve(opt) {
    const act = this.nodes[opt.idx];
    const success = Math.random() < this.moveChance(act);   // player-facing, drill-improvable gate
    const out = this.drawOutcome(act);
    if (!out) { return success ? this.enterSuccess(opt) : this.enterFail(opt); }  // no cal -> legacy path
    if (success) {
      const win = out.result === "success" ? out : (act.cal.outcomes.find((o) => o.result === "success") || out);
      return this.enterSuccessCal(opt, win);
    }
    const bad = out.result !== "success" ? out : (act.cal.outcomes.find((o) => o.result !== "success") || out);
    return this.enterFailCal(opt, bad);
  }

  enterSuccess(opt) {
    const act = this.nodes[opt.idx];
    const dest = opt.res >= 0 ? opt.res : this.currentPos;
    if (act.ty === "submissions") {
      this.flare(opt.idx);
      this.endRound("win", act.t);
      return;
    }
    this.setEvent("Transition lands", act.t, "good");
    this.startTravel([opt.idx, dest], () => {
      const before = this.myVal(this.nodes[this.currentPos]);
      this.applyRoleByAction(act.t, act.ty, true);
      this.flashFx(this.myVal(this.nodes[dest]) - before);
      this.currentPos = dest; this.moveCount++; this.bumpBounce(); this._lastActor = "you";
      if (this.moveCount >= this.maxMoves) this.after(0.8, () => this.endRound("reset"));
      else this.after(0.5, () => this.enterLand(false));
    });
  }

  enterFail(opt) {
    const act = this.nodes[opt.idx];
    this.setEvent("Failed", act.t + " stuffed", "bad");
    this.after(1.25 / this.cfg().signalSpeed, () => this.opponentDefend());
  }

  // calibrated success: travel to the outcome's real target position (fallback to legacy resultPos)
  enterSuccessCal(opt, out) {
    const act = this.nodes[opt.idx];
    const r = this.resolveOutcomeTo(out.to);
    if (act.ty === "submissions" || r.terminal) { this.flare(opt.idx); this.endRound("win", act.t); return; }
    const dest = r.idx >= 0 ? r.idx : (opt.res >= 0 ? opt.res : this.currentPos);
    this.setEvent("Transition lands", act.t, "good");
    this.startTravel([opt.idx, dest], () => {
      const before = this.myVal(this.nodes[this.currentPos]);
      if (r.role) this.playerRole = r.role; else this.applyRoleByAction(act.t, act.ty, true);
      this.flashFx(this.myVal(this.nodes[dest]) - before);
      this.currentPos = dest; this.moveCount++; this.bumpBounce(); this._lastActor = "you";
      if (this.moveCount >= this.maxMoves) this.after(0.8, () => this.endRound("reset"));
      else this.after(0.5, () => this.enterLand(false));
    });
  }
  // calibrated failure/counter: travel to the regress target first (so a counter visibly puts you
  // in a worse spot), then hand initiative to the opponent; stay-put failures go straight to defense.
  enterFailCal(opt, out) {
    const act = this.nodes[opt.idx];
    const r = this.resolveOutcomeTo(out.to);
    const dest = r.idx >= 0 ? r.idx : this.currentPos;
    const counter = out.result === "counter";
    this.setEvent(counter ? "Countered" : "Failed", act.t + (counter ? " reversed" : " stuffed"), "bad");
    if (dest === this.currentPos) { this.after(1.25 / this.cfg().signalSpeed, () => this.opponentDefend()); return; }
    this.startTravel([opt.idx, dest], () => {
      const before = this.myVal(this.nodes[this.currentPos]);
      if (r.role) this.playerRole = r.role;
      this.flashFx(this.myVal(this.nodes[dest]) - before);
      this.currentPos = dest; this.moveCount++; this.bumpBounce(); this._lastActor = "opp";
      this.after(0.5, () => this.opponentDefend());
    });
  }

  defendKeyFor(subNode) { return subNode.t + "|Defender"; } // full name, matches the emitted Defender deck key
  enterDefense(subIdx) {
    const sub = this.nodes[subIdx];
    // escape routes: positions reachable from the submission node (back to safety)
    const escapes = []; const seen = new Set();
    for (const k of this.adj[subIdx]) {
      const n = this.nodes[k];
      if (n.ty !== "positions") continue; if (seen.has(n.t)) continue; seen.add(n.t);
      escapes.push({ idx: k, node: n, res: k });
    }
    // fallback: stay-and-survive returns to current position
    if (!escapes.length) escapes.push({ idx: this.currentPos, node: this.nodes[this.currentPos], res: this.currentPos });
    this.optionIdxs = escapes.map((e) => e.idx);
    const dsec = Math.max(4, Math.min(9, 4 + escapes.length));
    this.setEvent("Defend! \u00b7 escape the " + this.splitName(sub.t).main, "Pick an escape \u2014 or drill defense", "bad");
    // surface the Defender deck for the submission so drilling improves the escape
    this._defendSub = subIdx;
    this.buildDrillPanel(this.currentPos, this.defendKeyFor(sub)); // surfaces the Defender deck via the tab; respects the user's open/closed choice (no auto-open)

    const el = this.optionsRef.current; if (el) el.innerHTML = "";
    let picked = false;
    const finish = () => { picked = true; this._optPick = null; this._optList = null; this.clearTimers(); this.clearOptions(); this._defendSub = null;
      this.activeMove = null; this.flare(subIdx); this.setEvent("Tapped", this.splitName(sub.t).main, "bad");
      this.after(0.5, () => this.endRound("lose", sub.t)); };
    const pick = (opt) => {
      if (picked) return; picked = true; this._optPick = null; this._optList = null; this.clearTimers(); this.clearOptions();
      const dmod = this.stateBonus(this.defendKeyFor(sub));
      const chance = Math.max(0.08, Math.min(0.92, 0.4 + (this.myVal(opt.node) - this.myVal(sub)) * 0.15 + dmod - (this.aiSkill || 0)));
      this.setEvent("Escaping", opt.node.t, "info");
      this.activeMove = { idx: opt.idx, verb: "Escaping", col: { r: 126, g: 224, b: 168 } };
      this.startTravel([subIdx, opt.idx], () => {
        this._defendSub = null;
        if (Math.random() < chance) {
          const before = this.myVal(this.nodes[this.currentPos]);
          this.playerRole = "bottom"; // escaping usually lands you bottom/neutral
          this.flashFx(this.myVal(opt.node) - before);
          this.currentPos = opt.idx; this.moveCount++; this.bumpBounce(); this._lastActor = "you";
          this.setEvent("Escaped!", opt.node.t, "good");
          this.after(0.7, () => this.enterLand(false));
        } else { finish(); }
      });
    };
    for (let i = 0; i < escapes.length; i++) el.appendChild(this.buildOptionCard(escapes[i], pick, dsec, i + 1, "escape"));
    if (el) el.style.pointerEvents = "auto";
    this._optPick = pick; this._optList = escapes;
    this.after(dsec, () => { if (!picked) finish(); }); // freeze too long → opponent finishes
  }
  oppVal(node) {
    const s = node.s;
    if (Array.isArray(s) && s.length >= 2) return s[this.roleIdx() === 0 ? 1 : 0];
    return -(node.dom || 0);
  }
  opponentDefend() {
    // gather the opponent's adjacent options, split into finishes vs positional counters
    const subs = [], trans = []; const seen = new Set();
    for (const k of this.adj[this.currentPos]) {
      const n = this.nodes[k]; if (n.ty === "positions") continue; if (seen.has(n.t)) continue; seen.add(n.t);
      if (n.ty === "submissions") subs.push(k); else trans.push(k);
    }
    if (!subs.length && !trans.length) { this.endRound("reset"); return; }
    // the more dominant the opponent is here, the more likely they go for the finish
    const oppAdv = this.oppVal(this.nodes[this.currentPos]); // + = opponent is winning
    let pFinish = subs.length ? Math.max(0.18, Math.min(0.85, 0.34 + oppAdv * 0.55)) : 0;
    if (!trans.length && subs.length) pFinish = 0.9;
    if (subs.length && Math.random() < pFinish) {
      const def = subs[(Math.random() * subs.length) | 0];
      this.flare(def);
      this.setEvent("Opponent attacks", this.nodes[def].t, "bad");
      this.activeMove = { idx: def, verb: "Attacking", col: { r: 255, g: 110, b: 110 } };
      this.startTravel([this.currentPos, def], () => this.after(0.3, () => this.enterDefense(def)));
      return;
    }

    // positional counter — prefer moves that improve the opponent most
    trans.sort((a, b) => this.oppVal(this.nodes[this.resultPos(b, this.currentPos)] || this.nodes[b]) - this.oppVal(this.nodes[this.resultPos(a, this.currentPos)] || this.nodes[a]));
    const def = (trans.length ? trans : subs)[(Math.random() * Math.min(3, (trans.length ? trans : subs).length)) | 0];
    const defNode = this.nodes[def];
    // calibrated destination: draw from the move's own cal.outcomes (encodes the miss distribution),
    // fall back to the legacy resultPos heuristic when the node is uncalibrated.
    const draw = this.drawOutcome(defNode);
    let intendDest;
    if (draw) { const rr = this.resolveOutcomeTo(draw.to); intendDest = rr.terminal ? this.currentPos : (rr.idx >= 0 ? rr.idx : this.resultPos(def, this.currentPos)); }
    else { intendDest = this.resultPos(def, this.currentPos); }
    if (intendDest < 0) intendDest = this.currentPos;
    const actualDest = intendDest; // the weighted draw already models "doesn't always land clean" — no extra random slip
    this._pendingIntent = { actor: "opp", idx: intendDest };
    const offensive = this.performerRole(defNode.t, defNode.ty) === "top";
    this.setEvent(offensive ? "Opponent counters" : "Opponent defends", defNode.t, "bad");
    this.activeMove = { idx: def, verb: "Defending", col: { r: 255, g: 140, b: 100 } };
    const path = actualDest !== this.currentPos ? [this.currentPos, def, actualDest] : [this.currentPos, def];
    this.startTravel(path, () => {
      const nd = actualDest;
      const before = this.myVal(this.nodes[this.currentPos]);
      this.applyRoleByAction(defNode.t, defNode.ty, false);
      this.flashFx(this.myVal(this.nodes[nd]) - before);
      this.currentPos = nd; this.moveCount++; this.bumpBounce(); this._lastActor = "opp";
      if (this.moveCount >= this.maxMoves) this.after(0.8, () => this.endRound("reset"));
      else this.after(0.6, () => this.enterLand(false));
    });
  }

  // ---------- camera ----------
  userActiveNow() { return this.now - (this.lastInteract || -99) < 4; }
  updateCamera(dt) {
    const el = this.now - this.startTime;
    let tgt = null;
    if (!this.introDone) {
      if (el < 1.6) tgt = { cx: this.gcx, cy: this.gcy, vw: this.graphW * 2.3 - this.graphW * 0.3 * (el / 1.6) };
      else { tgt = { cx: this.gcx, cy: this.gcy, vw: this.graphW * 1.0 }; if (el > 3.2) { this.introDone = true; this.startRoll(); } }
    } else if (this.userActiveNow()) {
      tgt = null;
    } else if (this.endZoom) {
      tgt = { cx: this.endCenter.x, cy: this.endCenter.y, vw: this.graphW * 1.55 };
    } else {
      const mode = this.cfg().cameraMode;
      if (mode === "Overview") {
        const br = 1 + 0.03 * Math.sin(this.now * 0.22);
        tgt = { cx: this.gcx + 9 * Math.sin(this.now * 0.07), cy: this.gcy + 7 * Math.cos(this.now * 0.06), vw: this.graphW * 1.02 * br };
      } else {
        const f = this.camFocus;
        const wide = this.pulse ? this.graphW * 0.3 : this.graphW * 0.42;
        const vw = Math.max(wide, this.graphR * 0.7);
        // shift focus left so it isn't hidden under the right sidebar
        const offset = (156 * vw) / this.W;
        tgt = { cx: f.x + offset, cy: f.y, vw: vw };
      }
    }
    // while paused or reading an in-node dossier, suppress only the AUTO-retarget — the tween
    // itself keeps flying toward whatever camTarget was set (Follow/Overview must not yank the
    // camera away mid-read, but manual prezi targets still animate).
    if (this.introDone && (this.paused || this._dossierIdx != null)) tgt = null;
    if (tgt) { this.camTarget.cx = tgt.cx; this.camTarget.cy = tgt.cy; this.camTarget.vw = tgt.vw; }
    // dossier flight: CENTER faster than the zoom dives (prezi-style) — otherwise at deep zoom the
    // viewport shrinks quicker than the target centers and mid-flight shows empty space instead of
    // the glowing node you're flying toward.
    const flight = this._dossierIdx != null;
    const tauP = !this.introDone ? 0.8 : flight ? 0.28 : 0.5;
    const tauV = !this.introDone ? 0.9 : flight ? 0.7 : 0.55;
    const aP = 1 - Math.exp(-dt / tauP), aV = 1 - Math.exp(-dt / tauV);
    this.cam.cx += (this.camTarget.cx - this.cam.cx) * aP;
    this.cam.cy += (this.camTarget.cy - this.cam.cy) * aP;
    this.cam.lvw += (Math.log(this.camTarget.vw) - this.cam.lvw) * aV;
    this.cam.vw = Math.exp(this.cam.lvw);
  }

  startLoop() {
    this.startTime = null;
    this.lastT = performance.now() / 1000;
    const loop = (ms) => {
      this._raf = requestAnimationFrame(loop);
      try {
        this.now = ms / 1000;
        let dt = this.now - this.lastT; this.lastT = this.now;
        if (dt > 0.05) dt = 0.05;
        this._mdt = dt;
        const el = this.wrapRef.current;
        if (el && (this.W !== el.clientWidth || this.H !== el.clientHeight)) this.resize();
        if (!this.W || !this.H) return;
        // self-heal: a camera seeded while unsized can hold NaN — re-init it once we have geometry
        if (this.cam && (!isFinite(this.cam.cx) || !isFinite(this.cam.cy) || !isFinite(this.cam.vw))) {
          const vw0 = (this.graphW || 1000) * 2.3;
          this.cam = { cx: this.gcx || 0, cy: this.gcy || 0, vw: vw0, lvw: Math.log(vw0) };
          this.camTarget = { cx: this.cam.cx, cy: this.cam.cy, vw: vw0 };
        }
        if (this.startTime == null) this.startTime = this.now; // start intro clock once sized
        if (this.alpha < 1) this.alpha = Math.min(1, this.alpha + dt / 1.3);
        const gdt = this.paused ? 0 : dt;
        this.updateTravel(gdt);
        this.updateFlash();
        this.updateRipples();
        this.updateUiShift(dt);
        // camera runs on the REAL clock — pausing the sim must not freeze the tween
        // (the prezi flight into a dossier happens while the roll is auto-paused)
        this.updateCamera(dt);
        this.trail = this.trail.filter((e) => this.now - e.time < 2.8);
        this.draw();
      } catch (err) {
        console.error("frame error", err);
      }
    };
    this._raf = requestAnimationFrame(loop);
  }

  resize() {
    const el = this.wrapRef.current; if (!el) return;
    if (!el.clientWidth || !el.clientHeight) return;   // mid-mount: never seed a 0-size viewport
    this.W = el.clientWidth; this.H = el.clientHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.W * this.dpr; this.canvas.height = this.H * this.dpr;
  }

  jumpToState(idx) {
    const n = this.nodes[idx]; if (!n) return;
    // resolve to a position: positions go directly; actions resolve to a connected position
    let posIdx = idx;
    if (n.ty !== "positions") {
      let p = -1;
      for (const k of this.adj[idx]) { if (this.nodes[k].ty === "positions") { p = k; break; } }
      posIdx = p >= 0 ? p : -1;
    }
    if (posIdx < 0) return;
    this.clearTimers(); this.clearOptions();
    this._session = null; this._sessionNodes = null; this._inSession = false;
    this.activeMove = null; this.pulse = null; this.ripples = [];
    // keep role sensible: derive from the node's name if it encodes one
    const t = (this.nodes[posIdx].t || "");
    if (/\bbottom\b/i.test(t)) this.playerRole = "bottom"; else if (/\btop\b/i.test(t)) this.playerRole = "top";
    this.currentPos = posIdx;
    this.focusIdx = posIdx;
    this.camFocus = { x: this.nodes[posIdx].x, y: this.nodes[posIdx].y };
    this.flare(posIdx);
    this.hideCenter();
    this.setPaused(true);            // freeze with a fresh decision timer; Play resumes
    this.enterLand(false);           // build options for the new state (no restart toast)
  }
  _updateHover(e) {
    if (!this.cam || !this.nodes) return;
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.W / this.cam.vw;
    const wx = this.cam.cx + (e.clientX - rect.left - this.W / 2) / scale;
    const wy = this.cam.cy + (e.clientY - rect.top - this.H / 2) / scale;
    let best = -1, bd = (28 / scale) * (28 / scale);
    for (const n of this.nodes) {
      const dx = n.x - wx, dy = n.y - wy, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = n.idx; }
    }
    this._hover = best >= 0 ? { idx: best, t: this.now } : null;
  }
  sbOffset() { const w = this.W || (this.wrapRef.current ? this.wrapRef.current.clientWidth : 1200); return w <= 640 ? 0 : (w <= 1023 ? 300 : 312); }
  attachInput() {
    const el = this.wrapRef.current;
    let dragging = false, lx = 0, ly = 0, dsx = 0, dsy = 0, moved = 0;
    const ptrs = new Map();
    let pinch = null;
    const dist = () => { const a = [...ptrs.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
    const mid = () => { const a = [...ptrs.values()]; return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 }; };
    el.addEventListener("pointerdown", (e) => {
      this.closeDeckIfStudying();
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      if (ptrs.size === 2) {
        dragging = false; const m = mid();
        pinch = { d0: dist() || 1, vw0: this.cam ? this.cam.vw : 1, mx: m.x, my: m.y };
      } else if (ptrs.size === 1) {
        dragging = true; lx = e.clientX; ly = e.clientY; dsx = e.clientX; dsy = e.clientY; moved = 0; el.style.cursor = "grabbing";
      }
      this.lastInteract = this.now;
    });
    el.addEventListener("pointermove", (e) => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size >= 2 && this.cam) {
        const rect = this.canvas.getBoundingClientRect();
        const m = mid(); const sx = m.x - rect.left, sy = m.y - rect.top;
        const sb = this.W / this.cam.vw;
        const wx = this.cam.cx + (sx - this.W / 2) / sb, wy = this.cam.cy + (sy - this.H / 2) / sb;
        let vw = pinch.vw0 * (pinch.d0 / (dist() || 1));
        vw = Math.max(this.graphW * 0.006, Math.min(this.graphW * 2.6, vw));
        this.cam.vw = vw; this.cam.lvw = Math.log(vw);
        const sa = this.W / vw;
        this.cam.cx = wx - (sx - this.W / 2) / sa; this.cam.cy = wy - (sy - this.H / 2) / sa;
        this.camTarget.cx = this.cam.cx; this.camTarget.cy = this.cam.cy; this.camTarget.vw = vw;
        this.lastInteract = this.now; return;
      }
      if (!dragging || !this.cam) { this._updateHover(e); return; }
      moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
      const scale = this.W / this.cam.vw;
      this.cam.cx -= (e.clientX - lx) / scale; this.cam.cy -= (e.clientY - ly) / scale;
      this.camTarget.cx = this.cam.cx; this.camTarget.cy = this.cam.cy;
      lx = e.clientX; ly = e.clientY; this.lastInteract = this.now;
    });
    const end = (e) => {
      if (e) { ptrs.delete(e.pointerId); try { el.releasePointerCapture(e.pointerId); } catch (err) {} }
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 1) { const r = [...ptrs.values()][0]; dragging = true; lx = r.x; ly = r.y; moved = 99; }
      else if (ptrs.size === 0) {
        const card = this.nodeCardRef && this.nodeCardRef.current;
        const inCard = card && card.style.display !== "none" && e && card.contains(e.target);
        if (dragging && moved < 5 && e && !inCard) { this._updateHover(e); if (this._hover && this._hover.idx >= 0) this.openDossier(this._hover.idx); else { this.closeNodeDossier(); this.closeExplorerIfOpen(); this.closeDossierSheet(); } }
        dragging = false; el.style.cursor = "grab";
      }
      this.lastInteract = this.now;
    };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    el.addEventListener("pointerleave", () => { this._hover = null; });
    el.addEventListener("wheel", (e) => {
      e.preventDefault(); if (!this.cam) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const sb = this.W / this.cam.vw;
      const wx = this.cam.cx + (sx - this.W / 2) / sb, wy = this.cam.cy + (sy - this.H / 2) / sb;
      let vw = this.cam.vw * Math.exp(e.deltaY * 0.0012);
      // while reading an in-node dossier, don't let wheel-zoom overshoot past the card's sweet spot
      const zmin = this._dossierIdx != null ? this.graphW * 0.0075 : this.graphW * 0.006;
      vw = Math.max(zmin, Math.min(this.graphW * 2.6, vw));
      this.cam.vw = vw; this.cam.lvw = Math.log(vw);
      const sa = this.W / vw;
      this.cam.cx = wx - (sx - this.W / 2) / sa; this.cam.cy = wy - (sy - this.H / 2) / sa;
      this.camTarget.cx = this.cam.cx; this.camTarget.cy = this.cam.cy; this.camTarget.vw = vw;
      this.lastInteract = this.now;
    }, { passive: false });
  }

  shapePath(ctx, ty, x, y, r) {
    if (ty === "positions") { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832); }
    else if (ty === "submissions") { const h = r * 1.35; ctx.moveTo(x, y - h); ctx.lineTo(x + h * 0.92, y + h * 0.72); ctx.lineTo(x - h * 0.92, y + h * 0.72); ctx.closePath(); }
    else { const h = r * 1.18; ctx.moveTo(x, y - h); ctx.lineTo(x + h, y); ctx.lineTo(x, y + h); ctx.lineTo(x - h, y); ctx.closePath(); }
  }

  draw() {
    const ctx = this.ctx; if (!ctx || !this.nodes) return;
    const W = this.W, H = this.H, dpr = this.dpr;
    const scale = W / this.cam.vw;
    const cfg = this.cfg();
    const A = this.alpha;
    // slow-mo finish: dim the map for a beat while the finishing flare burns, then recover
    let dim = 1;
    if (this._slowmo) {
      const da = this.now - this._slowmo;
      if (da < 1.1) dim = 0.3 + 0.7 * Math.min(1, Math.max(0, (da - 0.6) / 0.5));
      else this._slowmo = 0;
    }
    const glow = Math.min(2.2, cfg.glow);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, W, H);

    const ox = W / 2 - this.cam.cx * scale, oy = H / 2 - this.cam.cy * scale;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);

    // grid
    const halfW = this.cam.vw / 2, halfH = (H / scale) / 2;
    const L = this.cam.cx - halfW, R = this.cam.cx + halfW, Tp = this.cam.cy - halfH, B = this.cam.cy + halfH;
    const gs = 60;
    ctx.lineWidth = 1 / scale; ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.beginPath();
    for (let x = Math.floor(L / gs) * gs; x < R; x += gs) { ctx.moveTo(x, Tp); ctx.lineTo(x, B); }
    for (let y = Math.floor(Tp / gs) * gs; y < B; y += gs) { ctx.moveTo(L, y); ctx.lineTo(R, y); }
    ctx.stroke();

    // base links
    ctx.lineWidth = 0.6 / scale; ctx.strokeStyle = "rgba(170,182,215," + (0.12 * A * dim) + ")";
    ctx.beginPath();
    for (const [a, b] of this.links) { const na = this.nodes[a], nb = this.nodes[b]; ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y); }
    ctx.stroke();

    ctx.globalCompositeOperation = "lighter";
    // edge anticipation: the chosen edge brightens + tightens before the pulse launches
    if (this.pulse && !this.pulse.done && this.anim("edgeAnticipation", true)) {
      const aAge = this.now - (this.pulse.t0 || 0);
      if (aAge < 0.38 && this.pulse.seg === 0) {
        const k = aAge / 0.38;
        const pa = this.nodes[this.pulse.path[0]], pb = this.nodes[this.pulse.path[1]];
        if (pa && pb) {
          ctx.strokeStyle = this.rgba(pb.col, (0.12 + 0.55 * k) * A);
          ctx.lineWidth = (3.4 - 2.2 * k) / scale;
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        }
      }
    }
    // path ahead
    if (this.pulse && !this.pulse.done) {
      const p = this.pulse, head = this.headPos();
      ctx.strokeStyle = this.rgba(this.nodes[p.path[p.path.length - 1]].col, 0.16 * glow * A);
      ctx.lineWidth = 1.2 / scale;
      ctx.beginPath(); ctx.moveTo(head.x, head.y);
      for (let i = p.seg + 1; i < p.path.length; i++) { const n = this.nodes[p.path[i]]; ctx.lineTo(n.x, n.y); }
      ctx.stroke();
    }
    // comet trail
    for (const e of this.trail) {
      const age = this.now - e.time; const k = Math.max(0, 1 - age / 2.6); if (k <= 0) continue;
      const na = this.nodes[e.a], nb = this.nodes[e.b];
      const tc = e.tint ? this.lerpCol(nb.col, e.tint, 0.6) : nb.col;
      ctx.strokeStyle = this.rgba(tc, 0.6 * k * glow * A);
      ctx.lineWidth = (0.8 + 2.4 * k) / scale;
      ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y); ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";

    // landing ripple: a slow pulse travels each connecting edge to the option nodes
    if (this.ripples && this.ripples.length) {
      ctx.globalCompositeOperation = "lighter";
      for (const r of this.ripples) {
        const a = this.nodes[r.a], b = this.nodes[r.b];
        const tt = (this.now - r.t0) / r.dur;
        if (tt < 0 || tt > 1.35) continue;
        const e = tt < 1 ? (tt < 0.5 ? 4 * tt * tt * tt : 1 - Math.pow(-2 * tt + 2, 3) / 2) : 1;
        // birth: ease the pulse into existence over the first stretch so it doesn't pop
        const birth = Math.min(1, tt / 0.22);
        const fade = tt <= 1 ? 1 : Math.max(0, 1 - (tt - 1) / 0.35);
        ctx.strokeStyle = this.rgba(b.col, 0.5 * fade * birth * A);
        ctx.lineWidth = 1.6 / scale;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e); ctx.stroke();
        if (tt <= 1) {
          const hx = a.x + (b.x - a.x) * e, hy = a.y + (b.y - a.y) * e;
          const hr = (2 + 4.5 * birth) * (tt > 0.85 ? Math.max(0.4, (1 - tt) / 0.15) : 1);
          const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
          g.addColorStop(0, this.rgba({ r: 255, g: 255, b: 255 }, 0.9 * birth * A));
          g.addColorStop(0.4, this.rgba(b.col, 0.7 * birth * A));
          g.addColorStop(1, this.rgba(b.col, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, 6.2832); ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // session highlight rings (from "Suggested for you" etc.)
    if (this._sessionNodes && this._sessionNodes.length) {
      const pulse = 0.5 + 0.5 * Math.sin(this.now * 2.6);
      for (const k of this._sessionNodes) {
        const n = this.nodes[k]; if (!n) continue;
        ctx.strokeStyle = this.rgba(n.col, (0.45 + 0.4 * pulse) * A);
        ctx.lineWidth = 2 / scale;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 3, 0, 6.2832); ctx.stroke();
        ctx.fillStyle = this.rgba(n.col, 0.1 * A);
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 3, 0, 6.2832); ctx.fill();
      }
    }

    // option rings (during land)
    if (this.optionIdxs.length) {
      const pulse = 0.5 + 0.5 * Math.sin(this.now * 3);
      for (const k of this.optionIdxs) {
        const n = this.nodes[k];
        ctx.strokeStyle = this.rgba(n.col, (0.3 + 0.35 * pulse) * A);
        ctx.lineWidth = 1.4 / scale;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 2.4, 0, 6.2832); ctx.stroke();
      }
    }

    // base nodes — shrink a touch when zoomed in so dense clusters separate
    const nodeK = Math.max(0.4, Math.min(1, this.cam.vw / (this.graphW * 0.5)));
    const br = this.anim("idleBreath", 2) * 0.01;
    // glyph→dossier handoff: the carded node's canvas glyph fades out exactly as the DOM card
    // fades in (matched ring/fill geometry) so the zoom reads as one object revealing itself
    const cardFade = (idx) => (this._nodeCardOn && idx === this._nodeCardIdx) ? 1 - (this._nodeCardO || 0) : 1;
    for (const n of this.nodes) {
      const cf = cardFade(n.idx); if (cf <= 0.01) continue;
      const bk = br ? 1 + br * Math.sin(this.now * 1.4 + n.idx * 0.83) : 1;
      ctx.fillStyle = this.rgba(n.col, 0.62 * A * dim * cf);
      ctx.beginPath(); this.shapePath(ctx, n.ty, n.x, n.y, n.r * nodeK * bk); ctx.fill();
    }

    // current position marker
    if (this.focusIdx >= 0 && !this.pulse) {
      const n = this.nodes[this.focusIdx];
      const cf = cardFade(n.idx);
      const pulse = 0.5 + 0.5 * Math.sin(this.now * 2.4);
      const pc = this.myColor(n);
      // landing settle: damped overshoot when the roll arrives
      let settle = 1;
      if (this.anim("landingSettle", true) && this._settleT) {
        const sa = this.now - this._settleT;
        if (sa >= 0 && sa < 0.9) settle = 1 + 0.26 * Math.exp(-3.4 * sa) * Math.sin(sa * 14);
      }
      if (cf > 0.01) {
        // recolor the current node to YOUR perspective (red when you're losing, blue when winning)
        ctx.fillStyle = this.rgba(pc, 0.98 * A * cf);
        ctx.beginPath(); this.shapePath(ctx, n.ty, n.x, n.y, n.r * 1.28 * settle); ctx.fill();
        ctx.strokeStyle = this.rgba(pc, (0.7 + 0.3 * pulse) * A * cf);
        ctx.lineWidth = 2.4 / scale;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 2.9 * settle, 0, 6.2832); ctx.stroke();
      }
    }

    // sustained halo — the roll-end flare's light, present BEFORE the end: the current position
    // breathes softly all roll long, and a dossier target brightens as the prezi flight closes in
    // (then yields to the DOM card's own bloom through the glyph crossfade — light continuity).
    ctx.globalCompositeOperation = "lighter";
    {
      const halo = (n, col2, k) => {
        if (!n || k <= 0.01) return;
        const gr = n.r * (2.2 + 2.6 * k);
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, gr);
        g.addColorStop(0, this.rgba(col2, 0.5 * k * glow * A));
        g.addColorStop(0.45, this.rgba(col2, 0.18 * k * glow * A));
        g.addColorStop(1, this.rgba(col2, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, gr, 0, 6.2832); ctx.fill();
      };
      const breathe = 0.75 + 0.25 * Math.sin(this.now * 1.6);
      if (this.focusIdx >= 0 && this.nodes[this.focusIdx]) {
        const cur = this.nodes[this.focusIdx];
        const cf = (this._nodeCardOn && this.focusIdx === this._nodeCardIdx) ? 1 - (this._nodeCardO || 0) : 1;
        halo(cur, this.myColor(cur), 0.34 * breathe * dim * cf); // perspective-tinted, like the marker ring
      }
      if (this._dossierIdx != null && this._dossierIdx !== this.focusIdx && this.nodes[this._dossierIdx]) {
        const sN = scale / (W / (this.graphW * 0.0085));
        const appr = Math.max(0, Math.min(1, (sN - 0.02) / 0.5)); // ramps over the approach
        const cf = (this._nodeCardOn && this._dossierIdx === this._nodeCardIdx) ? 1 - (this._nodeCardO || 0) : 1;
        halo(this.nodes[this._dossierIdx], this.nodes[this._dossierIdx].col, 0.5 * appr * cf);
      }
    }
    // flaring nodes
    for (const n of this.nodes) {
      const age = this.now - n.lit; if (age > 1.9) continue;
      const k = Math.max(0, 1 - age / 1.9);
      const gr = n.r * (1.8 + 4.2 * k);
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, gr);
      g.addColorStop(0, this.rgba(n.col, 0.9 * k * glow * A));
      g.addColorStop(0.4, this.rgba(n.col, 0.32 * k * glow * A));
      g.addColorStop(1, this.rgba(n.col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, gr, 0, 6.2832); ctx.fill();
      ctx.fillStyle = this.rgba({ r: 255, g: 255, b: 255 }, 0.8 * k * A);
      ctx.beginPath(); this.shapePath(ctx, n.ty, n.x, n.y, n.r * (1 + 0.7 * k)); ctx.fill();
    }
    // pulse head
    if (this.pulse && !this.pulse.done) {
      const h = this.headPos();
      const hr = 6.5 * glow;
      const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, hr);
      g.addColorStop(0, this.rgba({ r: 255, g: 255, b: 255 }, 0.95 * A));
      g.addColorStop(0.3, this.rgba(h.col, 0.8 * A));
      g.addColorStop(1, this.rgba(h.col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, hr, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    this.updateNodeCard(scale);

    // in-node content once a node is big enough on screen to read into (~20px radius)
    {
      const inMin = 20;
      let anyBig = false;
      for (const n of this.nodes) { if (n.r * nodeK * scale > inMin) { anyBig = true; break; } }
      if (anyBig) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.textAlign = "center";
        for (const n of this.nodes) {
          const rs = n.r * nodeK * scale; if (rs <= inMin) continue;
          if (this._nodeCardOn && n.idx === this._nodeCardIdx) continue;   // dossier card covers this node
          const sx = (n.x - this.cam.cx) * scale + W / 2, sy = (n.y - this.cam.cy) * scale + H / 2;
          if (sx < -rs * 1.5 || sx > W + rs * 1.5 || sy < -rs * 1.5 || sy > H + rs * 1.5) continue;
          const k = Math.min(1, (rs - inMin) / 14);
          const isCur = n.idx === this.focusIdx;
          ctx.fillStyle = this.rgba(this.lerpCol(n.col, { r: 15, g: 17, b: 33 }, 0.74), 0.94 * k * A * dim);
          ctx.beginPath(); this.shapePath(ctx, n.ty, sx, sy, rs); ctx.fill();
          ctx.strokeStyle = this.rgba(isCur ? this.myColor(n) : n.col, (isCur ? 0.95 : 0.62) * k * A);
          ctx.lineWidth = Math.max(1.2, rs * 0.045);
          ctx.beginPath(); this.shapePath(ctx, n.ty, sx, sy, rs); ctx.stroke();
          const cyOff = n.ty === "submissions" ? rs * 0.24 : 0;   // triangle: optical center sits lower
          const name = this.splitName(n.t).main;
          const maxW = rs * (n.ty === "positions" ? 1.5 : 1.05);
          const fs = Math.max(9, Math.min(15, rs * 0.24));
          ctx.font = "600 " + fs.toFixed(1) + "px 'Plus Jakarta Sans', sans-serif";
          const words = name.split(" "), lines = []; let cur = "";
          for (const w of words) { const t2 = cur ? cur + " " + w : w; if (!cur || ctx.measureText(t2).width <= maxW) cur = t2; else { lines.push(cur); cur = w; } }
          if (cur) lines.push(cur);
          if (lines.length > 3) { lines.length = 3; lines[2] += "\u2026"; }
          const lh = fs * 1.16, kfs = Math.max(6.5, Math.min(9, rs * 0.11));
          const blockH = lines.length * lh;
          ctx.textBaseline = "middle";
          const kick = n.ty === "positions" ? "POSITION" : n.ty === "submissions" ? "SUBMISSION" : "TRANSITION";
          ctx.font = "800 " + kfs.toFixed(1) + "px 'Plus Jakarta Sans', sans-serif";
          ctx.fillStyle = this.rgba(n.col, 0.9 * k * A);
          ctx.fillText(kick, sx, sy + cyOff - blockH / 2 - kfs * 0.95, rs * 1.7);
          ctx.font = "600 " + fs.toFixed(1) + "px 'Plus Jakarta Sans', sans-serif";
          ctx.fillStyle = this.rgba({ r: 240, g: 243, b: 248 }, 0.98 * k * A);
          lines.forEach((ln2, li) => ctx.fillText(ln2, sx, sy + cyOff - blockH / 2 + lh * (li + 0.5), maxW + 6));
        }
        ctx.textAlign = "left";
        ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);
      }
    }

    // labels
    if (cfg.showLabels) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // transient names on recently-lit nodes (excluding the focus, which gets a rich label)
      ctx.textBaseline = "bottom";
      ctx.font = "600 12px 'Plus Jakarta Sans', sans-serif";
      for (const n of this.nodes) {
        const age = this.now - n.lit; if (age > 3.2 || n.idx === this.focusIdx) continue;
        if (n.r * nodeK * scale > 20) continue;   // name already drawn inside the node
        if (this.activeMove && n.idx === this.activeMove.idx) continue;
        if (this.optionIdxs.indexOf(n.idx) >= 0) continue; // outgoing nodes get persistent labels below
        const k = Math.max(0, 1 - age / 3.2);
        const sx = (n.x - this.cam.cx) * scale + W / 2, sy = (n.y - this.cam.cy) * scale + H / 2;
        if (sx < -60 || sx > W + 60 || sy < 0 || sy > H + 20) continue;
        ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 6;
        ctx.fillStyle = this.rgba({ r: 238, g: 241, b: 246 }, 0.8 * k * A);
        ctx.fillText(this.splitName(n.t).main, sx + 9, sy - 7); ctx.shadowBlur = 0;
      }
      // rich label = role + name, anchored beside a node
      const richLabel = (idx, role, roleCol, name, big) => {
        const n = this.nodes[idx]; if (!n) return;
        const sx = (n.x - this.cam.cx) * scale + W / 2, sy = (n.y - this.cam.cy) * scale + H / 2;
        if (sx < -120 || sx > W + 260 || sy < -30 || sy > H + 50) return;
        const ox = sx + n.r * scale + 11;
        ctx.shadowColor = "rgba(0,0,0,0.92)"; ctx.shadowBlur = 8;
        ctx.textBaseline = "alphabetic";
        const dfam = this._displayFam || "'Space Grotesk'";
        ctx.font = "700 " + (big ? 11 : 10) + "px " + dfam + ", sans-serif";
        ctx.fillStyle = this.rgba(roleCol, A);
        ctx.fillText(role.toUpperCase(), ox, sy - (big ? 7 : 5));
        ctx.font = (big ? "700 18px " : "600 13px ") + dfam + ", sans-serif";
        ctx.fillStyle = this.rgba({ r: 240, g: 243, b: 248 }, A);
        ctx.fillText(name, ox, sy + (big ? 11 : 9));
        ctx.shadowBlur = 0;
      };
      // active move during travel: "ATTACKING / Triangle Choke" etc.
      if (this.pulse && this.activeMove) {
        const am = this.activeMove;
        richLabel(am.idx, am.verb, am.col, this.splitName(this.nodes[am.idx].t).main, false);
      }
      // persistent labels on the outgoing option nodes while a decision is open
      if (this.optionIdxs && this.optionIdxs.length && !this.pulse) {
        ctx.textBaseline = "bottom"; ctx.font = "600 12px 'Plus Jakarta Sans', sans-serif";
        for (const idx of this.optionIdxs) {
          const n = this.nodes[idx]; if (!n) continue;
          if (n.r * nodeK * scale > 20) continue;   // name already drawn inside the node
          const sx = (n.x - this.cam.cx) * scale + W / 2, sy = (n.y - this.cam.cy) * scale + H / 2;
          if (sx < -60 || sx > W + 60 || sy < 0 || sy > H + 20) continue;
          ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 6;
          ctx.fillStyle = this.rgba(n.col, 0.95 * A);
          ctx.fillText(this.splitName(n.t).main, sx + 9, sy - 7); ctx.shadowBlur = 0;
        }
      }
      // current position drawn LAST so its rich label sits above the outgoing-node labels
      if (this.focusIdx >= 0 && !this.pulse) {
        const n = this.nodes[this.focusIdx];
        richLabel(this.focusIdx, this.roleLabel(), this.myColor(n), this.posFamily(n.t), true);
      }
      // hover: nearest node label (brighter + "your move" tag if it's an outgoing option)
      if (this._hover && this._hover.idx >= 0 && this.now - (this._hover.t || 0) < 0.5 && this.nodes[this._hover.idx].r * nodeK * scale <= 20) {
        const n = this.nodes[this._hover.idx];
        const sx = (n.x - this.cam.cx) * scale + W / 2, sy = (n.y - this.cam.cy) * scale + H / 2;
        const isOpt = this.optionIdxs && this.optionIdxs.indexOf(n.idx) >= 0;
        ctx.textBaseline = "bottom";
        ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 7;
        if (isOpt) { ctx.font = "700 10px 'Plus Jakarta Sans', sans-serif"; ctx.fillStyle = this.rgba(n.col, A); ctx.fillText("YOUR MOVE", sx + 10, sy - 22); }
        ctx.font = "600 13px 'Plus Jakarta Sans', sans-serif";
        ctx.fillStyle = this.rgba({ r: 240, g: 243, b: 248 }, A);
        ctx.fillText(this.splitName(n.t).main, sx + 10, sy - 8);
        ctx.shadowBlur = 0;
      }
    }
  }
}