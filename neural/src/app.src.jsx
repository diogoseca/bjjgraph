// Resting colour of the landing card's More/Less toggle. ONE source, because the two sites that
// write it (the button's own cssText, and expandLandCard restoring it on collapse) drifted apart
// once already — see v1.104.2. NB `build.mjs` throws on duplicated top-level names.
const NG_LAND_MORE_COL = "#7e8aa3";
// SPACED-REPETITION INTERVAL LADDER (v1.105.0, owner directive — reverses the old "forgetting is
// tested, not timed" canon). No ease factor: fewer fields, fewer merge cases. A success climbs one
// rung; any failure resets to rung 0 (1 day).
const NG_SRS_IVLS = [1, 3, 7, 14, 30, 60, 120];
// How long a landing question may be "still settling" before readers stop waiting on it. A stalled
// deck fetch must not make the app look hung; the fetch itself is never cancelled. See v1.104.8.
const NG_LAND_WARM_CEILING_MS = 8000;
// EDGE — the loss-aversion preset the card ranks by until the "What matters more" control ships.
// It must be a value of the wire's own `evLam` list; if it is not, the app falls back to the first
// block rather than guessing, because a wrong block is a silently WRONG ranking, not a missing one.
const NG_EDGE_LAM = 2;
// EDGE saturates its palette at |15|, not `potColor`'s default 45. MEASURED over all 1246 emitted
// (state,move) pairs: p5 −14 · median 0 · p95 +12, and 93.3% inside ±15 — so on the 45 scale the
// whole hand renders one indistinguishable grey-blue and the colour channel says nothing. Same
// palette, same deadband, different domain: `potColor`'s own callers are untouched (v1.118.0).
const NG_EDGE_SAT = 15;
// ── THE HAND IS NO LONGER CAPPED (v1.123.0, owner: "show all, fold the overflow") ────────────
// `NG_HAND_CAP = 10` and `_capHand`'s category floor are GONE. The hand is the player's entire
// action space for the turn, so a display cap was always a cap on the game, and the floor only
// ever existed to stop the cap erasing a whole class of move — remove the cap and the floor has
// nothing to protect, along with its open "best-EDGE vs most-attempted" question. Measured over
// all 272 role-hands: 256 were already under 10, so uncapping moves 16 hands; the corpus deals
// 1205 -> 1326 cards and the biggest hand goes 10 -> 34 (standing-position/top).
//
// The number 10 did NOT die — it moved off the DISPLAY and onto the two things that genuinely
// do not scale, each with its own measured reason:
//
// NG_DECISION_KNEE — where the decision clock stops paying per-card. The old clock was
//   `decisionSec + 0.8*(n-1)`, linear, which turns a 34-card hand into a 35.4-SECOND turn. Ten is
//   the knee because it is exactly the old hand size, so EVERY hand that exists today keeps its
//   current clock to the millisecond and only the newly-enlarged hands take the sublinear tail.
const NG_DECISION_KNEE = 10;
// NG_DECISION_K — seconds per DOUBLING beyond the knee (Hick's law: choice time grows with
//   log2 of the alternatives, not with their count). 2.2 is set so the curve is continuous at the
//   knee and the worst hand in the corpus lands at 20.1s instead of 35.4s.
const NG_DECISION_K = 2.2;
// NG_PREFETCH_CAP — how many of the dealt cards' decks `enterLand` warms. THIS is the one that
//   had to stay, and the measurement is not close: the prefetch is on the first-hand payload bill
//   (payload-first-hand's own report shows five flashcards/*.json rows), the gzip headroom is
//   7,050 B, and warming every card of an uncapped hand costs +15,819 B gzip on the AVERAGE first
//   visit — with 46.6% of real first draws landing on a hand whose delta alone exceeds the
//   headroom (closed-guard/bottom +70,213 B, standing-position/top +86,911 B). The hand is ranked
//   by EDGE, so the first ten are the likeliest picks; card 11+ hydrates on demand through the
//   existing "Loading this state's cards…" path. Ten keeps the payload byte-identical to today.
const NG_PREFETCH_CAP = 10;

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
  shareCueRef = React.createRef(); // the standalone share-cue control (v1.99.0 — the pill is gone)
  legendMarkRef = React.createRef();
  legendPointRef = React.createRef();
  legendRef = React.createRef();
  optionHintRef = React.createRef();
  optDetailRef = React.createRef();
  brandFontRef = React.createRef();
  accountRef = React.createRef();
  acctChipRef = React.createRef();
  acctMenuRef = React.createRef();
  acctCtaRef = React.createRef();
  acctCloseRef = React.createRef();
  acctSpacerRef = React.createRef();
  menuRef = React.createRef();
  modalRef = React.createRef();
  modalCardRef = React.createRef();
  // the merged learning pane IS the drill pane — explorerRef stays as an alias so every
  // display-based open-check (incl. renderChallengeCue's) reads the one real element
  explorerRef = this.drillRef;
  // how long a focus flight OWNS the camera (see holdCamera). Long enough to read a lit class on
  // a phone, short enough that the roll's follow-cam is never held hostage.
  camHoldSec = 7;
  // THE ROLL'S SETTLED ZOOM, as a fraction of graphW (v1.101.0). `graphW * 0.0085` is the
  // deepest read zoom the app ever asked for, so this is "a tenth of the max zoom".
  // (v1.114.0: it no longer decides whether the state is NAMED — the label beside the node is
  // the one naming design at every zoom. See THE ARRIVAL IS THE EVENT, below.)
  ROLL_ZOOM = 0.085;
  /** The resting light on the state you are STANDING IN — present always, hugging the orb.
   *  Not the retired halo: a third of its alpha and a quarter of its reach. See v1.114.1. */
  REST_GLOW = 0.42;
  /** How much harder a node blooms when the roll ARRIVES there (a landing, or the submission
   *  that ends a round) than when the travelling light merely passes over it. The owner's
   *  "50% or even 100% more"; 2 is the 100%. */
  ARRIVE_BLOOM = 2;
  explorerListRef = React.createRef();
  explorerSearchRef = React.createRef();
  explorerSearchWrapRef = React.createRef();
  explorerToolsRef = React.createRef();
  dossierRef = React.createRef();
  dossierSheetRef = React.createRef();
  viewToggleRef = React.createRef();
  paneAnchorRef = React.createRef();
  paneStatsRef = React.createRef();
  ghChipRef = React.createRef();
  _viewMode = "challenges";
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
      shareCueRef: this.shareCueRef,
      closeDeck: () => this.setDeckOpen(false),
      openSettings: () => this.openSettings("flashcards"), openFeedbackTechnique: () => this.openFeedback("technique"), openFeedbackIssue: () => this.openFeedback("issue"),
      openTerms: () => this.openLegal("terms"), openPrivacy: () => this.openLegal("privacy"),
      statusRef: this.statusRef, legendMarkRef: this.legendMarkRef,
      accountRef: this.accountRef, acctChipRef: this.acctChipRef, acctMenuRef: this.acctMenuRef, toggleAccountMenu: () => this.toggleAccountMenu(), transportRef: this.transportRef, playPauseRef: this.playPauseRef,
      modalRef: this.modalRef, modalCardRef: this.modalCardRef,
      explorerRef: this.explorerRef, explorerListRef: this.explorerListRef, explorerSearchRef: this.explorerSearchRef, explorerSearchWrapRef: this.explorerSearchWrapRef, explorerToolsRef: this.explorerToolsRef, dossierRef: this.dossierRef, dossierSheetRef: this.dossierSheetRef, nodeCardRef: this.nodeCardRef, viewToggleRef: this.viewToggleRef, paneAnchorRef: this.paneAnchorRef, paneStatsRef: this.paneStatsRef, ghChipRef: this.ghChipRef,
      toggleExplorer: () => this.toggleExplorer(), openSearch: () => this.openSearch(),
      legendPointRef: this.legendPointRef, legendRef: this.legendRef, optionHintRef: this.optionHintRef, optDetailRef: this.optDetailRef, brandFontRef: this.brandFontRef,
      scrollOptions: () => { const op = this.optionsRef.current; if (op) this.tweenScroll(op, Math.round(op.clientWidth * 0.62)); },
      togglePause: () => this.setPaused(!this.paused), resetRoll: () => this.resetRoll(),
      evCenterRef: this.evCenterRef, evcKickerRef: this.evcKickerRef, evcTextRef: this.evcTextRef, evcSubRef: this.evcSubRef,
    };
  }

  componentDidMount() { this.boot(); }
  componentWillUnmount() {
    // Q001: SPA soft-navs never fire pagehide, so without this the 400ms-debounced save is
    // lost on teardown AND the orphaned timer clobbers the next instance's storage ~400ms in.
    // _flushSave also clears _saveT, killing that late writer. Guarded so a (hypothetical)
    // pre-ingest unmount can never overwrite real storage with empty state.
    try { if (this._progressLoaded) this._flushSave(); } catch (e) {}
    try { this.closeAccountMenu(); } catch (e) {} // drops the capture-phase outside-tap listener
    try { this.clearClipLoops(); } catch (e) {}
    try { if (this.sound && this.sound.destroy) this.sound.destroy(); } catch (e) {} // close AudioContext, stop voices, drop listeners
    clearTimeout(this._challengeCueTimer);
    clearTimeout(this._challengeRewardTimer);
    try { if (this._challengeRewardEl) this._challengeRewardEl.remove(); } catch (e) {}
    try { if (this._tutEl) this._tutEl.remove(); } catch (e) {}
    if (this._mcAdvT) { clearTimeout(this._mcAdvT); this._mcAdvT = null; }
    if (this._onPageHide) window.removeEventListener("pagehide", this._onPageHide);
    if (this._onVisHide) document.removeEventListener("visibilitychange", this._onVisHide);
    if (this._onChallengeConnectivity) {
      window.removeEventListener("online", this._onChallengeConnectivity);
      window.removeEventListener("offline", this._onChallengeConnectivity);
    }
    this._detailCtx = null;
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
  /** Cancel ONE timer handed back by `after()` — the replay steps its own film and must be able to
   *  stop it without `clearTimers()`, which would also disarm the paused roll waiting underneath. */
  _cancelTimer(it) {
    if (!it) return;
    if (it.id) clearTimeout(it.id);
    this._timers = (this._timers || []).filter((x) => x !== it);
  }
  // ---------- deterministic test rails (P0) ----------
  // Every random draw in the app goes through rng(tag); journeys queue values per tag via rig()
  // so a full roll replays frame-exact. In production (no rig) this is Math.random passthrough.
  rng(tag) {
    const q = this._rig && this._rig[tag];
    const v = q && q.length ? q.shift() : Math.random();
    if (this._rec) this._rec.draws.push({ tag: tag, v: v });
    if (this._rngTx) (this._rngTx[tag] = this._rngTx[tag] || []).push(v);
    return v;
  }
  // ── RNG transaction: draw, then put it back ──
  // Used by _warmMcPool to run the distractor pooler as a DRY PASS (to discover which deck
  // chunks it wants) without consuming the stream. Rollback unshifts the drawn values back onto
  // the rigged queue in order, so the real pass that follows sees exactly the same numbers —
  // including the Math.random ones, which is the point: a replay must see what the probe saw.
  _rngBegin() { this._rngTx = {}; }
  _rngRollback() {
    const tx = this._rngTx; this._rngTx = null;
    if (!tx) return;
    this._rig = this._rig || {};
    for (const tag in tx) this._rig[tag] = tx[tag].concat(this._rig[tag] || []);
  }
  rig(tag, values) { this._rig = this._rig || {}; (this._rig[tag] = this._rig[tag] || []).push(...(values || [])); }
  rigStart(idx) { this._rigStart = idx; }
  isTest() { return !!(typeof window !== "undefined" && window.__NEURAL_TEST__); }
  // fx facade: every gameplay beat is a first-class event — journeys assert on this stream and
  // (from P1 on) animations key off the same beats, so feel and tests share one vocabulary.
  fx(beat, props) {
    (this.beats = this.beats || []).push(Object.assign({ t: this.now || 0, beat: beat }, props || {}));
    if (this.sound) this.sound.beat(beat, props || {});
    if (this._cs) this._csBeat(beat, props || {}); // cold-start funnel rides the SAME beat stream
    if (this.beats.length > 4000) this.beats.splice(0, 1000);
    // Challenges are completed by doing. The guard matters because acknowledgements emit beats.
    if (!this._inChallenges) {
      this._inChallenges = true;
      try {
        this.noteChallenges(beat, props || {});
      } catch (e) {
        console.warn("[neural] challenge event failed:", e);
      } finally {
        this._inChallenges = false;
      }
    }
  }
  // frame pump: advance simulated time in fixed ticks — timers, travel, camera, draw all step
  // deterministically. Only available in test mode (the rAF loop is not armed there).
  advance(ms) {
    if (!this.isTest()) return;
    const step = 1000 / 60;
    let left = ms;
    while (left > 0) {
      const d = Math.min(step, left); left -= d;
      this._simNow = (this._simNow || 0) + d;
      // fire due sim-timers (paused timers hold, matching pauseTimers semantics)
      for (const it of (this._timers || []).slice()) {
        if (it.id) continue; // wall-clock timer (shouldn't exist in test mode)
        if (!this.paused || it.ignorePause) {
          it.remaining -= d;
          if (it.remaining <= 0) it._fire();
        }
      }
      this._noDraw = left > 0; // sim every tick, RENDER once at the end (headless perf)
      this._tick(this._simNow / 1000);
    }
    this._noDraw = false;
  }
  // ignorePause: the handful of steps that must still run while the clock is stopped — landing a
  // STAGED roll (roam), where the whole point is to arrive somewhere with time held.
  after(sec, fn, ignorePause) {
    const item = { fn: fn, remaining: sec * 1000, start: performance.now(), id: null, ignorePause: !!ignorePause };
    const fire = () => { this._timers = (this._timers || []).filter((x) => x !== item); fn(); };
    item._fire = fire;
    if (!this.isTest() && (!this.paused || item.ignorePause)) item.id = setTimeout(fire, item.remaining); // test mode: advance() drives
    (this._timers = this._timers || []).push(item);
    return item;
  }
  pauseTimers() {
    for (const it of (this._timers || [])) {
      if (it.ignorePause) continue;
      if (it.id) { clearTimeout(it.id); it.remaining -= (performance.now() - it.start); it.id = null; }
    }
  }
  resumeTimers() {
    if (this.isTest()) return; // sim timers resume via advance()
    for (const it of (this._timers || [])) {
      if (!it.id) { it.start = performance.now(); it.id = setTimeout(it._fire, Math.max(0, it.remaining)); }
    }
  }
  /** A HAND ON THE CLOCK VOIDS EVERY SURFACE'S CLAIM TO IT (v1.113.4).
   *
   * Four surfaces auto-pause behind their own latch (pane, dossier, unfolded card, replay) and
   * each releases only what it took — that is the rule CLAUDE.md states as "a hand-paused roll
   * stays paused when you close the pane". But `setPaused` never cleared a latch, so a manual
   * toggle left a stale one behind, and the sequence was reachable from the keyboard in three
   * presses: open the pane (latches `_paneAutoPaused`), press Space to resume — the roll now runs
   * BEHIND an open pane, which pane law forbids — press Space again to hand-pause, then close the
   * pane, and the stale latch resumes a roll the user had just paused by hand. The promise
   * inverted. Any deliberate pause/resume now voids all four claims. */
  _clearPauseLatches() {
    this._paneAutoPaused = false; this._dossierAutoPaused = false;
    this._landAutoPaused = false; this._bgAutoPaused = false;
  }
  setPaused(p) {
    if (this.paused === p) return;
    // PRESSING PLAY ENDS THE FILM. A replay holds the clock on purpose; resuming the roll under it
    // would leave two things moving the same camera and the same pulse. `stopReplay` nulls
    // `_replay` before it can call back in here, so this cannot recurse.
    if (p === false && this._replay) { this._replayAutoPaused = false; this.stopReplay("resumed"); }
    // PRESSING PLAY ALSO ENDS A BACKGROUND DISMISSAL, and flies back to the node you chose.
    if (p === false && this._bgDown) this._bgRestore();
    this.paused = p;
    if (p) this.pauseTimers(); else this.resumeTimers();
    // The option countdown bars need nothing here since v1.114.1: they are no longer CSS
    // animations but a width written by `_tickDecision`, which is `gdt`-driven — so a paused
    // clock freezes them by construction, and a refund moves them, which an animation could not.
    const list = this.drillListRef.current;
    if (list) list.querySelectorAll(".ngCurExpire").forEach((w) => { w.style.animationPlayState = p ? "paused" : "running"; });
    if (this._curSetIcon) this._curSetIcon();
    this.updateTransport();
  }
  resetRoll() {
    this.setPaused(false);
    this.startRoll();
  }
  // hard-disarm every in-flight engagement (decision window, defense, tension sweep) — the
  // seam every roll restart goes through, so a stale clock can never tap you out of a roll
  // you already left (ghost defeat + persisted ladder demotion), a dead defense can never
  // reroute odds refreshes to escape math, and a cancelled sweep never haunts the canvas.
  clearEngagement() {
    // NOTE: _beltTest is deliberately ABSENT from this list — a belt test SURVIVES the
    // rollFromPosition that starts it. Cancellation is explicit (startRoll / endRound).
    this._decision = null; this._optPick = null; this._optList = null;
    this._defendSub = null; this._panicKey = null;
    this._sweep = null; this._hitStop = null; this._shake = null;
    this.killVignette(false);
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
    this._csInit(); // cold-start funnel: armed before anything can emit a beat    // PRE-BOOT RIG — same family of rail as rig()/rigStart()/advance(), but readable before the
    // app instance exists. A page can pin the draws the FIRST roll makes (start-pos, role,
    // ai-skill, max-moves), which is the only way a measurement that must use the real network
    // and no test mode can be reproducible: see e2e/journeys/payload-first-hand.spec.ts, where
    // an unpinned draw decided how many chunks the boot pulled and made the budget gate flaky.
    try {
      const R = window.__NEURAL_RIG;
      if (R) for (const t in R) this.rig(t, R[t]);
    } catch (e) { /* a malformed rig must never stop the app booting */ }
    this.canvas = this.canvasRef.current;
    this.ctx = this.canvas.getContext("2d");
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this.wrapRef.current);
    this._onWinResize = () => this.resize();
    window.addEventListener("resize", this._onWinResize);
    this.resize();
    this.attachInput();
    // block pan when interacting with overlay controls
    [this.optionsRef.current, this.drillRef.current, this.shareCueRef.current, this.accountRef.current, this.transportRef.current, this.optDetailRef.current].forEach((el) => {
      if (el) { el.addEventListener("pointerdown", (e) => e.stopPropagation()); el.addEventListener("wheel", (e) => e.stopPropagation(), { passive: false }); }
    });
    // ── A WHEEL OVER THE HAND SCROLLS THE HAND (v1.123.0) ─────────────────────────────────────
    // The loop above only stops the wheel reaching the canvas zoom; it does not scroll anything.
    // A VERTICAL wheel over a horizontally-overflowing element scrolls it in no browser, so with
    // the cap gone (standing-position/top: 34 cards, a 4,104px overflow at 1440x900) a mouse user
    // could reach card 34 only by dragging or by clicking "see more" repeatedly. Take the larger
    // of the two deltas so a trackpad's real horizontal gesture still works unchanged.
    const orow = this.optionsRef.current;
    if (orow) orow.addEventListener("wheel", (e) => {
      if (orow.scrollWidth - orow.clientWidth < 1) return;   // nothing folded — leave the page alone
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      e.preventDefault();
      orow.scrollLeft += d;
    }, { passive: false });
    // modal: card blocks pan + wheel; backdrop click closes
    if (this.modalCardRef.current) { this.modalCardRef.current.addEventListener("pointerdown", (e) => e.stopPropagation()); this.modalCardRef.current.addEventListener("wheel", (e) => e.stopPropagation(), { passive: false }); }
    if (this.modalRef.current) this.modalRef.current.addEventListener("pointerdown", (e) => { e.stopPropagation(); this._detailCtx = null; this.setPaused(false); this.closeModal(); });
    // Z LADDER (v1.95.1, see helmet.html): the modal is a DELIBERATE screen — portal it out
    // of the wrap (whose stacking context traps any z it wears) onto the root overlay plane,
    // where its 95 outranks every ambient overlay (landcard 5, combo pop 72).
    // Listeners above survive the move; the account menu portals the same way when opened.
    if (this.modalRef.current && this.__ngRoot && this.modalRef.current.parentElement !== this.__ngRoot) this.__ngRoot.appendChild(this.modalRef.current);
    const logoEl = this.wrapRef.current.querySelector(".ng-logo");
    if (logoEl) logoEl.addEventListener("pointerdown", (e) => e.stopPropagation());
    // keyboard: "/" or Cmd/Ctrl+K focuses search in the explorer
    this._onKey = (e) => {
      const t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
      if (((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        this.openPane("explore");
        setTimeout(() => { try { const inp = this.explorerSearchRef.current; if (inp) inp.focus(); } catch (err) {} }, 80);
      } else if (e.key === "Escape") {
        // Esc walks the Z LADDER top-down: deliberate screens first (modal 95, menu 90),
        // then gameplay overlays, then the pane last (pane law)
        if (this.closeModalIfOpen()) return;
        if (this.closeListPicker()) return; // anchored chooser, same deliberate band as the menu
        if (this.closeAccountMenu()) return;
        if (this._detailCtx) { e.preventDefault(); this.closeOptionDetail(); return; }
        if (this.closeNodeDossier()) return; // in-node dossier open (desktop) — fly back out
        if (this.stopReplay("esc")) return;  // a film is ambient chrome: it stops before the pane closes
        const sh = this.dossierSheetRef.current;
        if (sh && sh.style.display === "block") { this.closeDossierSheet(); }
        else if (this.deckShown) {
          if (this._dossierIdx != null) this.showExplorerList();
          else this.setDeckOpen(false); // PANE LAW: Esc closes the pane last, once no overlay is up
        }
      } else if ((e.key === "Enter" || e.key === "x" || e.key === "X") && this._detailCtx && !typing) {
        e.preventDefault(); const ctx = this._detailCtx; this.closeOptionDetail(); ctx.onPick(ctx.opt);
      } else if (!typing && !this._detailCtx && this.deckShown && this._viewMode === "history" && this._drillView === "home" && !this._paneStudyActive() && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
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
        // ── SPACE BELONGS TO THE FOCUSED CONTROL FIRST (v1.113.4) ────────────────────────────
        // `preventDefault()` used to run BEFORE this branch decided anything, so Space suppressed
        // the browser's activation of whatever <button>/<summary> had focus. The Challenges
        // corridor is built ENTIRELY from those (lesson rows, belt headers, checkpoints, the
        // fold summaries) and it is Tab-navigable — so tabbing to a lesson and pressing Space
        // did not open it, it toggled the roll's pause behind the pane. That is the literal
        // "keyboard shortcuts don't really work in challenges" report, and it also swallowed
        // spacebar page-scroll inside the pane's own scroller.
        // `p`/`P` is unaffected: it is nobody's activation key, so it still pauses from anywhere.
        if (e.key === " " && t && t.closest && t.closest("button,summary,a[href],select,[role='button'],[contenteditable]")) return;
        e.preventDefault();
        if (e.key === " " && this.isDrillOpen()) { if (!this.revealed) this.drillReveal(); else this.drillGrade(true); }
        else if (e.key === " " && this.deckShown && this._viewMode === "history" && this._drillView === "home" && this._focusRow && this._miniReg && this._miniReg[this._focusRow]) { this._miniReg[this._focusRow].reveal(); }
        else { this._clearPauseLatches(); this.setPaused(!this.paused); }
      } else if (!typing && /^[a-dA-D]$/.test(e.key) && this._mc && this._mc.answer && !(this._mc.surface === "land" && this._landHidden()) && "abcd".indexOf(e.key.toLowerCase()) < (this._mc.n || 0)) {
        e.preventDefault(); // A/B/C/D answer whichever MC block is live — digits stay the option-card openers
        this._mc.answer("abcd".indexOf(e.key.toLowerCase()));
      } else if (!typing && /^[1-4]$/.test(e.key) && this._mc && this._mc.surface === "deck" && this.deckShown) {
        e.preventDefault();
        const mbtns = this.drillListRef.current ? this.drillListRef.current.querySelectorAll("[data-mc-opt]") : [];
        const mb = mbtns[parseInt(e.key) - 1]; if (mb) mb.click();
      } else if (!typing && /^[1-9]$/.test(e.key) && this._optPick && this._optList && !this._checkpoint && this.get("cardNumbers", true)) {
        // Q007: an open checkpoint quiz owns the keyboard — digits above the MC option
        // count must never fall through to the roll's option-card openers (a '5' opened
        // the expand sheet and Enter then COMMITTED the roll under the live quiz)
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
    this._onChallengeConnectivity = () => {
      const explorer = this.explorerRef.current;
      if (
        this._viewMode === "challenges" &&
        explorer &&
        explorer.style.display === "flex"
      ) {
        this.renderExplorer();
      }
    };
    window.addEventListener("online", this._onChallengeConnectivity);
    window.addEventListener("offline", this._onChallengeConnectivity);
    // THE AFFILIATE FUNNEL'S ONE EVENT, RE-EMITTED (v1.106.7). `affiliateTracking.inline.ts` —
    // the only `affiliate_clickout` delegate — died with the legacy front-end in v1.80.0, and
    // v1.83.0 restored the ATTRIBUTES but not the listener, so the documented funnel (CLAUDE.md
    // §7: "one event on both surfaces, delegated on a[data-affiliate=true]") had ZERO emitters
    // and every conversion report was dark. One document-level delegate covers both surfaces;
    // the per-anchor data-* props carry the taxonomy the dashboards already expect.
    document.addEventListener("click", (e) => {
      const t = e.target;
      const a = t && t.closest ? t.closest('a[data-affiliate="true"]') : null;
      if (!a) return;
      this.track("affiliate_clickout", {
        url: a.href || null,
        product_id: a.getAttribute("data-product-id") || null,
        system_slug: a.getAttribute("data-system-slug") || null,
        system_name: a.getAttribute("data-system-name") || null,
        vendor: a.getAttribute("data-vendor") || null,
        position: a.hasAttribute("data-position") ? Number(a.getAttribute("data-position")) : null,
      });
    });
    try { if (typeof NGSound !== "undefined") this.sound = new NGSound(this); } catch (e) { /* silent app */ }
    this._initAuth();     // signed-in? real identity + merge-on-pull cloud sync (facade-gated)
    this.paused = false;
    this.applyFont();
    this.updateTransport();
    let data = null;
    for (let attempt = 0; attempt < 5 && !data; attempt++) {
      try {
        // no `cache: "no-cache"`: these files are content-stable between deploys and the edge
        // serves them with a Cache-Control tier (see scripts/regenerate_headers.py). Forcing a
        // revalidation on every boot threw away the one free win available — a returning
        // visitor re-downloaded the entire payload.
        // PROTOTYPE (dual close-pair graph): ?dual=fixed|force loads a role-pair variant of the
        // layout (scripts/prototype_dual_pair_layout.py) — every dual state as TWO close nodes.
        const dv = this._dualVariant();
        // A PROTOTYPE FLAG MUST NEVER BREAK THE APP (v1.112.1). The dual payloads are dev-only —
        // dev-serve.mjs maps the URL straight to tests/artifacts/dualpair/payloads/ and they are
        // NEVER in the shipped tree — so `?dual=iso` against a build without them used to 404 on
        // all five retries and land in `_fallbackToLegacy()`, which since v1.80.0 falls back to a
        // front-end that no longer exists: a blank app. Missing prototype data degrades to the
        // real graph instead, and says so in the console.
        // NB the bare `fetch("graph-data.json"` literal below is REWRITTEN by build.mjs to prefix
        // __NEURAL_DATA_BASE; it must survive verbatim or the build throws by design.
        let r = null;
        if (dv) {
          try { r = await fetch(this._dataBase() + "graph-data-dual-" + dv + ".json"); } catch (e) { r = null; }
          if (r && !r.ok) r = null;
          if (!r) console.warn("[neural] ?dual=" + dv + " payload not found — run `npm run prototype:dual`. Loading the standard graph.");
        }
        if (!r) r = await fetch("graph-data.json");
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
    // a /l/<code> arrival is decoded HERE — client-side, off the static shell, no Function
    // needed. Synchronous (not deferred through after()) so the lit graph and the list are
    // the first thing the recipient sees, on the first frame.
    try { this._openSharedListFromUrl(); } catch (e) { console.warn("[neural] share link failed:", e); }
    // arriving on a node's own page rolls there; Back/Forward walk the nodes you chose.
    try { this._urlSeeded = this._seedFromUrl(); } catch (e) { console.warn("[neural] url seed failed:", e); }
    try {
      window.addEventListener("popstate", () => {
        const hit = this._nodeAndRoleForPath(location.pathname);
        if (hit.idx >= 0 && hit.idx !== this.currentPos) this.rollFromPosition(hit.idx, true, hit.role);
      });
    } catch (e) { /* non-fatal */ }
    // DECKS: boot from the MANIFEST, fetch each deck on demand (v1.80.4). The monolith was
    // 16.4MB raw / 4.4MB gzip of flashcards — every card for all 2,924 decks — pulled before
    // the visitor could make one move. The manifest names every deck with its card count and
    // chunk file; a deck's ~6KB chunk lands when something actually needs its cards.
    // The card COUNT is the load-bearing part: it keeps mastery, crowns, goals and the belt
    // score exact while the cards themselves are still absent (see deckMastery).
    fetch(this._dataBase() + "flashcards/_index.json")
      .then((fr) => (fr.ok ? fr.json() : null))
      .then((j) => { if (j) { this._ingestDeckManifest(j); this.onFlashcardsReady(); } })
      .catch(() => { /* optional payload */ });
    // Challenge curriculum is tiny and optional; action objectives still work if it is absent.
    // It stays EAGER: curriculum.weights is what gameScore sums, so deferring it would show
    // every visitor a zero belt for as long as it took to arrive.
    fetch("curriculum.json")
      .then((cr) => (cr.ok ? cr.json() : null))
      .then((c) => { if (c && c.belts && c.belts.length) { this.curriculum = c; this._onCurriculum(); } })
      .catch(() => { /* optional payload */ });
    // Systems (the authored course library) are DEFERRED: nothing on the roll path reads them —
    // only the Explore tab and the system buckets do — so 324KB has no business being on the
    // critical path. _ensureSystems() is called from those read sites, and warmed at idle only
    // AFTER the first hand is dealt (see the options_dealt path): an idle callback fires long
    // before a hand exists, so warming here would have put all 324KB back on the boot bill.
    if (this.loaderRef.current) this.loaderRef.current.style.display = "none";
    this._csStep("app_ready"); // graph ingested, loader down: the first frame the user can see
    // durability: the pagehide/visibility flush that keeps a belt win from being lost to a quick
    // reload is armed in _csArmHide(), called from _csInit() at the TOP of boot — registering it
    // here left the whole cold-load window (loader up, nothing playable) unmeasurable.
    this._csArmHide();
    this.startLoop();
  }

  // tear the overlay down and hand the page back to the legacy DOM (SEO content stays intact).
  // mirrors the mount-time shim fallback in build.mjs so any boot failure degrades gracefully.
  _fallbackToLegacy() {
    try { const r = this.__ngRoot || document.getElementById("neural-root"); if (r) r.remove(); } catch (e) { /* noop */ }
    try { document.documentElement.dataset.variant = "legacy"; } catch (e) { /* noop */ }
  }

  ingest(data) {
    // ── WIRE EXPANSION (v1.107.0). graph-data.json ships COMPACT (it is the largest boot
    // payload) and is expanded HERE into the exact legacy shapes, so every downstream reader
    // (drawOutcome, resolve, calSuccess, giAllows, the edge-weight pass below) is untouched
    // and no RNG draw can move. The wire: technique outcomes are [to, probability, s|f|c]
    // tuples; a technique's posId is not carried (it equals fromPositionId by construction);
    // links are [sourceIdx, targetIdx] pairs. The legacy object spellings still expand
    // correctly (Array.isArray forks per item), so a spec-authored old-shape fixture keeps
    // working.
    const RESULT_WORD = { s: "success", f: "failure", c: "counter" };
    for (const n of data.nodes) {
      const c = n.cal;
      if (c && Array.isArray(c.outcomes)) {
        c.outcomes = c.outcomes.map((o) => Array.isArray(o) ? { to: o[0], probability: o[1], result: RESULT_WORD[o[2]] || o[2] } : o);
      }
    }
    // ── EDGE (v1.117.0 wire, read here since v1.118.0) ─────────────────────────────────────────
    // `cal.ev` hangs off the POSITION nodes and says what each move dealt from that state is
    // WORTH relative to the ordinary choice from there. Per role, the wire is
    //     [ nodeIdxs, attemptPct, ...one flat [e0,c1,e0,c1,…] block per entry in `evLam` ]
    // and it is expanded here — beside the outcome/link expansions above, same reason: every
    // reader downstream gets a shape it can use without knowing the wire.
    //
    // MEMBERSHIP IS THE INDEX LIST, and that is load-bearing rather than defensive. `0` is a real
    // EDGE — it is the DEFINITION of "the ordinary choice from here" — so it can never double as
    // "no data", and a dense array would need a sentinel a partial payload could read as a value.
    // Measured at emit: `optionsFor` deals 82 of 1204 cards this table legitimately cannot value
    // (gi-only moves zeroed in the no-gi solve, plus layout neighbours the role-node's authored
    // transitions[] never offers), so the unvalued path is walked on the FIRST hand.
    //
    // Keyed by "<position node index>/<role>" because that is the join the app can actually
    // perform: `optionsFor(posIdx)` hands back node indexes, exactly like `cal.ew` above.
    this._evLam = Array.isArray(data.evLam) ? data.evLam.slice() : [];
    this._evFrame = data.evFrame || null;
    this._ev = new Map();
    for (let i = 0; i < data.nodes.length; i++) {
      const tab = data.nodes[i].cal && data.nodes[i].cal.ev;
      if (!tab) continue;
      for (const role in tab) {
        const blk = tab[role];
        if (!Array.isArray(blk) || blk.length < 3 || !Array.isArray(blk[0])) continue;
        const idxs = blk[0], att = blk[1] || [], m = new Map();
        for (let k = 0; k < idxs.length; k++) {
          const lams = [];
          for (let L = 2; L < blk.length; L++) lams.push([blk[L][2 * k], blk[L][2 * k + 1]]);
          m.set(idxs[k], { att: att[k] || 0, lam: lams });
        }
        this._ev.set(i + "/" + role, m);
      }
    }
    const idIndex = new Map();
    const nodes = data.nodes.map((n, i) => {
      idIndex.set(n.id, i);
      // dual close-pair prototype: `sv` = this MEMBER's own side's strength — colors the pair
      // members truthfully apart. `s` stays the full pair so myVal()'s role-indexing is unchanged.
      const dom = (typeof n.sv === "number") ? n.sv : (n.s && typeof n.s[0] === "number") ? n.s[0] : this.dominance(n.ty, n.t);
      // `o` = this node's PERMANENT share-link ordinal (node_ordinals.json, stamped into
      // graph-data.json by regenerate_neural_data.py). Never the array index `i`: that is
      // filesystem-ordered and one new content file renumbers it, which would silently
      // repoint every share link already posted in a WhatsApp group.
      return { idx: i, id: n.id, x: n.x, y: n.y, t: n.t, ty: n.ty, s: n.s || null, dom, col: this.domColor(dom), deg: 0, lit: -99, posId: n.posId || n.fromPositionId || null, fromPositionId: n.fromPositionId || null, fromRole: n.fromRole || null, cal: n.cal || null, familyHub: n.familyHub || null, o: typeof n.o === "number" ? n.o : null, role: n.role || null, pairId: n.pairId || null };
    });
    const adj = nodes.map(() => []);
    const links = [];
    // ── THE TIE IS NEVER DRAWN, AND THE STATIC WEB LIVES ON ONE LAYER (v1.113.0) ──
    // `this.links` has exactly ONE consumer — the static base-web stroke in draw() — so filtering
    // HERE is free and touches nothing else: `adj`, `deg`, the radii and `_edgeW` all stay whole.
    //
    // Two rulings, finally implemented rather than merely written down:
    //  · Q3, the owner's own veto — "a dashed line would mean you could go from one state to
    //    another, and there's no direct translation of that". The emitter marks every pair with a
    //    {"pair":true} link and ingest was treating it as an ordinary edge, so the app has been
    //    drawing a SOLID connector welding each pair together (1170 of them) and LIGHTING it on
    //    focus. The vetoed line was already on screen; that is a large part of why a pair read as
    //    one engorged blob rather than two orbs at different heights.
    //  · Q2 — the static web belongs to the upper layer. Iso games draw the roads once and let
    //    units at different heights share them; mirroring every edge onto the lower layer doubles
    //    the web and buries both. A lower member still lights its real options when focused or
    //    played (that path reads `adj`, which is untouched).
    // Measured on the iso build: 1170 ties + 2505 lower-layer segments = 62% of 5969 removed, and
    // what remains is a single sheet at one height — which is itself a depth cue, for free.
    const _isLower = (n) => !!n.pairId && n.role !== "top" && n.role !== "attacker";
    let nTie = 0, nLower = 0;
    for (const l of data.links) {
      const a = Array.isArray(l) ? l[0] : idIndex.get(l.source), b = Array.isArray(l) ? l[1] : idIndex.get(l.target);
      if (a == null || b == null || a === b || !nodes[a] || !nodes[b]) continue;
      const na = nodes[a], nb = nodes[b];
      const tie = na.pairId === nb.id || nb.pairId === na.id;
      // deg is deliberately counted BEFORE the filter: radii must not move in this step, so the
      // change is provably render-only (same geometry, fewer strokes).
      adj[a].push(b); adj[b].push(a); na.deg++; nb.deg++;
      if (tie) { nTie++; continue; }
      if (_isLower(na) || _isLower(nb)) { nLower++; continue; }
      links.push([a, b]);
    }
    if (nTie || nLower) this._webTrim = { ties: nTie, lower: nLower, drawn: links.length };
    for (const n of nodes) n.r = 2.0 + Math.min(5.5, Math.sqrt(n.deg) * 0.62);
    // ── THE LIFT IS EDGE-ANCHORED, NOT A BAKED CONSTANT (v1.113.1) ──────────────────────────────
    // The emitter baked z into y as a flat ±4.0. That cannot work, for two measured reasons:
    //
    //  · A FLAT GAP IS SMALLER THAN A BIG NODE. Radii run 2.0–7.5, so the 8.0 centre gap is less
    //    than the DIAMETER of the hubs the owner named: 100 of 1170 pairs overlapped themselves,
    //    Side Control / Open Guard / Mount / Half Guard / Back Control by a full 7.0u. That is the
    //    "engorged… glued together" report, exactly.
    //  · A SYMMETRIC SPLIT PUSHES A BIG ORB THROUGH ITS OWN GROUND. Splitting a shared gap evenly
    //    about the centre puts the near edge at (r_other − r_self)/2 + C/2 — negative whenever the
    //    partners differ in size, and every technique pair does (attacker ~6.1 vs defender 2.62).
    //
    // So each member is anchored by its EDGE: its near face sits exactly C/2 above/below the
    // ground, at every size. The clearance between the two orbs is then exactly C everywhere —
    // which is the owner's chosen reading, "the gap you SEE is the same", and it makes
    // self-overlap impossible by construction rather than by tuning.
    const ISO_C = 2.0, ISO_EMIT_H = 4.0;
    for (const n of nodes) {
      n.z = 0; n.h = 0;
      if (!n.pairId) continue;
      n.z = (n.role === "top" || n.role === "attacker") ? 1 : -1;
      n.h = n.r + ISO_C / 2;
      n.y = (n.y + n.z * ISO_EMIT_H) - n.z * n.h;   // recover the emit ground, re-lift by the edge
    }
    // A PAIR IS ONE RIGID BODY (v1.112.2). The de-overlap below already refused to push partners
    // apart from EACH OTHER — but strangers still shoved each member INDEPENDENTLY, and that
    // silently destroyed the projection: measured on the iso build, only 121 of 1170 pairs stayed
    // vertical, mean horizontal drift 2.6u (worst 29.8), the fixed 8u gap smeared across −6..41,
    // and 79 pairs ended up UPSIDE DOWN with the top member below its partner. The offset IS the
    // paradigm ("learn it once and you know it everywhere"), so a push applied to one member is
    // applied to both — the pair translates, never deforms.
    const _partnerOf = (n) => { if (!n.pairId) return null; const j = idIndex.get(n.pairId); return j == null ? null : nodes[j]; };
    const _mv = (n, ddx, ddy) => { n.x += ddx; n.y += ddy; const p = _partnerOf(n); if (p) { p.x += ddx; p.y += ddy; } };
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
          // dual close-pair prototype: partners are PLACED deliberately tight — never push them
          if (a.pairId && (a.pairId === b.id || b.pairId === a.id)) continue;
          let dx = b.x - a.x, dy = b.y - a.y;
          if (dy > 26 || dy < -26) continue;
          const g = a.r + b.r + 3.5;
          let d = Math.hypot(dx, dy);
          if (d >= g) continue;
          if (d < 0.01) { const th = order[jj] * 2.4; dx = Math.cos(th); dy = Math.sin(th); d = 1; }
          const push = (g - d) / 2 / d;
          _mv(a, -dx * push, -dy * push); _mv(b, dx * push, dy * push); // pair moves whole (v1.112.2)
          any = true;
        }
      }
      if (!any) break;
    }
    // ── SITE METADATA (v1.113.1) ──────────────────────────────────────────────────────────────
    // A "site" is the ground point a pair straddles — the thing that used to be ONE hub node and
    // still is, at overview zoom. `rep` is the member that speaks for it (the one owning the bare
    // slug and the share ordinal); `rSite` is the historical hub radius, recovered by re-running
    // the radius formula on the combined degree minus the two tie edges, so a collapsed site is
    // drawn at exactly the size that node has always been in production.
    let anyZ = false;
    for (const n of nodes) {
      n.rep = !n.pairId || n.z > 0;
      n.pi = n.pairId ? (idIndex.get(n.pairId) ?? -1) : -1;
      n.rSite = n.pi >= 0
        ? 2.0 + Math.min(5.5, Math.sqrt(Math.max(1, n.deg + nodes[n.pi].deg - 2)) * 0.62)
        : n.r;
      // UNDERWORLD TONE, baked once (v1.113.2). LUMINANCE ONLY — each member already carries its
      // own side's advantage colour via `sv`, so shifting hue "cooler" would read as a different
      // advantage value rather than as being below the ground. Tone, never size: scale
      // attenuation would say "bottom players matter less", which sweeps and half the submission
      // game flatly contradict.
      if (n.z < 0) { n.colU = { r: n.col.r * 0.78, g: n.col.g * 0.80, b: n.col.b * 0.86 }; anyZ = true; }
      else if (n.z > 0) anyZ = true;
    }
    this._hasGround = anyZ;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, cx = 0, cy = 0, cnt = 0;
    for (const n of nodes) { if (!isFinite(n.x) || !isFinite(n.y)) continue; cnt++; minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); cx += n.x; cy += n.y; }
    cx = cnt ? cx / cnt : 0; cy = cnt ? cy / cnt : 0;
    if (!isFinite(minX)) { minX = -500; maxX = 500; minY = -500; maxY = 500; }
    let r = 0; for (const n of nodes) { if (!isFinite(n.x) || !isFinite(n.y)) continue; r = Math.max(r, Math.hypot(n.x - cx, n.y - cy)); }

    this.nodes = nodes; this.links = links; this.adj = adj; this._idIndex = idIndex;
    // AMBIGUITY SET (v1.103.0) — how many nodes share each short name. "Triangle" is not a
    // technique here, it is several: the owner was offered "Triangle" from Harness, opened it, and
    // read "Harness → rear-triangle" with no idea which triangle it was. 648 of 1467 nodes carry a
    // `from <position>` qualifier and 89 short names are shared, so dropping the qualifier is only
    // safe where the short name is unique. One pass over titles, no payload change.
    this._ambig = new Map();
    for (const n of nodes) {
      const m = this.splitName(n.t).main;
      this._ambig.set(m, (this._ambig.get(m) || 0) + 1);
    }
    // share-link ordinal manifest, both directions, built once per ingest
    this._sharedIncoming = null; // "no share link on this URL" is a value, not an absence
    this._sharedStale = null;    // …and "a valid link this build is too old for" is a third value
    this._undoList = null; this._delArm = null;
    this._ordById = new Map(); this._ordToId = new Map();
    for (const n of nodes) {
      if (typeof n.o !== "number") continue;
      this._ordById.set(n.id, n.o);
      if (!this._ordToId.has(n.o)) this._ordToId.set(n.o, n.id);
    }
    // slug indices for resolving cal.outcomes[].to -> node index. Robust to the layout's
    // nested ids: cal targets use the bare state-machine slug ("rear-triangle/top",
    // "arm-triangle-from-side-control") while nested layout ids are compound
    // ("triangle-control/rear-triangle") or slash-nested ("arm-triangle/from-side-control").
    const posSlugIndex = new Map(), techSlugIndex = new Map();
    const setTech = (k, i, ty) => { if (k && (!techSlugIndex.has(k) || ty === "submissions")) techSlugIndex.set(k, i); };
    for (const n of nodes) {
      if (n.ty === "positions") {
        if (n.posId) {
          const pid = String(n.posId).toLowerCase();
          // dual close-pair prototype: role members index under "<pos>/<role>"; the TOP member
          // also owns the bare slug (compat for role-less lookups). Single nodes: unchanged.
          if (n.role && n.pairId) {
            posSlugIndex.set(pid + "/" + n.role, n.idx);
            if (n.role === "top" || !posSlugIndex.has(pid)) posSlugIndex.set(pid, n.idx);
          } else posSlugIndex.set(pid, n.idx);
        }
      } else {
        let tail = (n.id.includes("/") ? n.id.slice(n.id.indexOf("/") + 1) : n.id).toLowerCase();
        // dual close-pair prototype: the ATTACKER member owns the pair's bare technique slug;
        // the defender member is reachable only under its own suffixed key.
        if (n.role && n.pairId) {
          if (n.role === "attacker" && tail.endsWith("/attacker")) tail = tail.slice(0, -9);
          else { setTech(tail, n.idx, n.ty); continue; }
        }
        setTech(tail, n.idx, n.ty);
        if (tail.includes("/")) setTech(tail.replace(/\//g, "-"), n.idx, n.ty); // hyphenated full-name form (graph.json slug)
      }
    }
    // secondary pass: index nested positions by their bare child slug too (full posId already set,
    // so it wins any collision); recovers targets like "rear-triangle/top" -> the compound node.
    for (const n of nodes) {
      if (n.ty === "positions" && n.posId) {
        const pid = String(n.posId).toLowerCase();
        if (pid.includes("/")) {
          const bare = pid.slice(pid.lastIndexOf("/") + 1);
          if (n.role && n.pairId && !posSlugIndex.has(bare + "/" + n.role)) posSlugIndex.set(bare + "/" + n.role, n.idx);
          if (!posSlugIndex.has(bare)) posSlugIndex.set(bare, n.idx);
        }
      }
    }
    // dual close-pair prototype: alias each retired HUB id -> its primary member (top/attacker),
    // so id-keyed consumers (systems lighting, curriculum fog, lists) still resolve.
    for (const n of nodes) {
      if (n.pairId && (n.role === "top" || n.role === "attacker")) {
        const hid = n.id.slice(0, n.id.lastIndexOf("/"));
        if (hid && !idIndex.has(hid)) idIndex.set(hid, n.idx);
      }
    }
    this._posSlugIndex = posSlugIndex; this._techSlugIndex = techSlugIndex;
    // precomputed DIRECTED edge weights = P(actually taking this edge), for the whole graph:
    //   position -> technique : occurrence% × success% (calibrated attempt & success rates)
    //   technique -> landing  : calibrated outcome probability
    // The active node's edges light up scaled by these (relative to its strongest edge).
    {
      const NN = nodes.length;
      const edgeW = new Map();
      const byName = new Map();
      for (const n of nodes) if (n.ty !== "positions" && !byName.has(n.t)) byName.set(n.t, n.idx);
      for (const n of nodes) {
        const cal = n.cal;
        if (!cal) continue;
        if (n.ty === "positions" && Array.isArray(cal.ew)) {
          // the wire's precomputed [nodeIdx, w*10000] pairs — regenerate_neural_data.py ran
          // the exact byName x attemptProbability x successRate arithmetic below at build time
          for (const e of cal.ew) {
            const k = n.idx * NN + e[0];
            const w = e[1] / 10000;
            if (w > (edgeW.get(k) || 0)) edgeW.set(k, w);
          }
        } else if (n.ty === "positions" && cal.moves) {
          for (const role of ["top", "bottom"]) {
            for (const m of (cal.moves[role] || [])) {
              const ti = byName.get(m.technique); if (ti == null) continue;
              const w = Math.max(0, (m.attemptProbability || 0) / 100) * Math.max(0, (m.successRate || 0) / 100);
              const k = n.idx * NN + ti;
              if (w > (edgeW.get(k) || 0)) edgeW.set(k, w);
            }
          }
        } else if (Array.isArray(cal.outcomes)) {
          for (const o of cal.outcomes) {
            const r = this.resolveOutcomeTo(o.to);
            if (r.idx >= 0) {
              const k = n.idx * NN + r.idx;
              const w = Math.max(0, (o.probability || 0) / 100);
              if (w > (edgeW.get(k) || 0)) edgeW.set(k, w);
            }
          }
        }
      }
      const maxW = new Float32Array(NN);
      for (const [k, w] of edgeW) { const a = Math.floor(k / NN); if (w > maxW[a]) maxW[a] = w; }
      this._edgeW = edgeW; this._maxW = maxW;
    }
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
  /** `amp` scales the bloom this node gets; the places the roll STOPS pass ARRIVE_BLOOM. */
  flare(idx, amp) { const n = this.nodes[idx]; if (n) { n.lit = this.now; n.litK = amp || 1; } }
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
        // ORDINARY amplitude, deliberately — even for the last node of THIS path. A move is two
        // travels (`[here, technique]`, then `[technique, outcome]`), so "end of the path" is
        // the TECHNIQUE half the time, and blooming it would light the thing the light merely
        // passed through. The arrival bloom belongs where the roll STOPS: `enterLand`, and the
        // submission that ends a round. (Measured: without this, "Sweep from Meathook" bloomed
        // as hard as the position it swept you into.)
        this.flare(p.path[p.seg + 1]); p.seg++;
      } else { p.t += advance / segTime; advance = 0; }
    }
    const h = this.headPos(); this.camFocus = { x: h.x, y: h.y };
    if (p.seg >= p.path.length - 1 && !p.done) { p.done = true; const cb = p.onArrive; if (cb) this.after(0, cb); }
  }

  // ---------- narrative helpers ----------
  // ---------- player perspective ----------
  // `s` IS TWO DIFFERENT PAIRS AND THE SLOT DEPENDS ON THE NODE KIND (v1.103.0):
  //   · a POSITION carries [topValue, bottomValue]        -> the slot is the side you play
  //   · a TECHNIQUE carries [attackerValue, defenderValue] -> the slot is whether you PERFORM it
  // (`scripts/enrich_graph_strength.py:18` states the split; every technique pair is exactly
  // antisymmetric, verified 0 of 1328 asymmetric, which is the fingerprint of an attacker/defender
  // pair rather than a top/bottom one.)
  //
  // Indexing BOTH with roleIdx() was the bug behind "why do I only get transitions, no
  // submissions?". Every submission scores ≈ +0.90 for its attacker, so a BOTTOM attacker read
  // their opponent's −0.90 and `optionsFor`'s old filter dropped it: measured, a bottom player was
  // shown ZERO of the 297 submission nodes, and 144 of the 596 bottom-authored techniques (the
  // 60 submissions + 84 sweeps that are EV-positive) were exactly the ones discarded.
  roleIdx() { return this.playerRole === "bottom" ? 1 : 0; }
  /** Which slot of `node.s` is MINE — see the note above. */
  valIdx(node) {
    if (node && node.ty !== "positions" && node.fromRole)
      return node.fromRole === this.playerRole ? 0 : 1;   // performer / opponent
    return this.roleIdx();                                 // top / bottom
  }
  myVal(node) {
    const s = node.s;
    const i = this.valIdx(node);
    if (Array.isArray(s) && s.length >= 2 && typeof s[i] === "number") return s[i];
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
  /** The shortest name that is still unambiguous: "Triangle from Back" when "Triangle" is shared
   *  by more than one node, plain "Gogoplata" when it is not. Compact surfaces only — the share
   *  surfaces, lists and dossier always render the FULL authored name by canon. */
  displayName(n) {
    if (!n) return "";
    const sp = this.splitName(n.t);
    return this._ambig && (this._ambig.get(sp.main) || 0) > 1 ? n.t : sp.main;
  }
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
    const rc = this._ngc(n.t);
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
  /**
   * Authored prose carries real paragraph breaks — 939 of the 997 entries that have both a
   * summary and a context do (94%). Dropping it into innerHTML collapses every one of them, so
   * three paragraphs arrive as one wall with sentences colliding at the joins ("…over the
   * shoulder.Strategically, the Triangle from Back is…"). That single missing split is most of
   * why this sheet read as a prototype.
   */
  proseHTML(t, style) {
    const parts = String(t == null ? "" : t).split(/\n{1,}/).map((x) => x.trim()).filter(Boolean);
    if (!parts.length) return "";
    return parts.map((x, i) => '<p style="margin:' + (i ? "10px 0 0" : "0") + ';' + (style || "") + '">' + x + '</p>').join("");
  }
  detailHTML(n, cat, neighbors, persp) {
    const rc = this.richContentFor(n);
    if (rc) return this.richDetailHTML(n, cat, rc, persp || "attacker");
    // positions are keyed "<fam>|<Role>" (deckKeyFor); techniques are keyed bare "<name>" in
    // NG_CONTENT, so fall back on the full title, not the "<name>|Attacker" deck key.
    const c = this._ngc(n.ty === "positions" ? this.deckKeyFor(n).key : n.t);
    this._curClips = null;
    const sec = (label) => '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7b8aa8;font-weight:700;margin:16px 0 9px;">' + label + '</div>';
    const lead = (t) => '<div style="font-size:13.5px;color:#c2ccde;line-height:1.6;">' + this.proseHTML(t) + '</div>';
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
  /** Cheap near-duplicate test: does `b` already say what `a` says? Compares a normalised
   *  middle slice, which is what a shared body of paragraphs has in common even when the two
   *  differ in their opening sentence (exactly the shape seen in the corpus). */
  _echoesSummary(a, b) {
    if (!a || !b) return false;
    const norm = (x) => String(x).replace(/\s+/g, " ").trim().toLowerCase();
    const A = norm(a), B = norm(b);
    if (A.length < 120 || B.length < 120) return false;
    const probe = B.slice(Math.floor(B.length * 0.35), Math.floor(B.length * 0.35) + 160);
    return probe.length >= 120 && A.indexOf(probe) >= 0;
  }
  richDetailHTML(n, cat, rc, persp) {
    const sec = (label, col) => '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:' + (col || "#7b8aa8") + ';font-weight:700;margin:18px 0 9px;">' + label + '</div>';
    const lead = (t) => '<div style="font-size:13.5px;color:#c2ccde;line-height:1.6;">' + this.proseHTML(t) + '</div>';
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
    // SEO / AEO / GEO context — indexable prose. NOT when it merely repeats the summary already
    // at the top of this sheet: measured, 205 of 997 entries (21%) carry a `context` that is >80%
    // the same text, and for the reported case (Triangle from Back) it was 92.2% similar with a
    // 1,534-character identical run — the same three paragraphs, twice, top and bottom. The
    // static page keeps its copy either way; this is the app surface.
    if (rc.context && !this._echoesSummary(rc.context, blk && blk.summary))
      h += '<div style="margin-top:20px;padding-top:14px;border-top:1px solid rgba(150,170,210,.1);font-size:12px;color:#8b97b0;line-height:1.6;">' + this.proseHTML(rc.context) + '</div>';
    return h;
  }
  fmtDur(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  /**
   * `compact` is the landing card's variant (v1.101.0). The full strip is 170px of thumbnail
   * under a 20px-margined header — ~210px inside a card whose whole height is 380, which pushed
   * the QUESTION, the thing the roll is actually asking, below the fold and under the sticky
   * footer. Same row, same wiring, same expand-to-play; roughly half the height.
   */
  filmStudyHTML(clips, compact) {
    if (!clips || !clips.length) return "";
    // NO CAPTION IN THE COMPACT VARIANT (v1.101.0, owner: "unnecessary"). A row of video
    // thumbnails with play buttons on them does not need a label reading "Film study"; the
    // reading sheet keeps its heading because there it sits among other headed sections.
    let h = compact ? '' : '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7b8aa8;font-weight:700;margin:20px 0 11px;display:flex;align-items:center;gap:8px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="#e0584f"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>Film study</div>';
    h += '<div class="ng-cliprow" style="display:flex;gap:' + (compact ? 8 : 11) + 'px;overflow-x:auto;padding-bottom:6px;">';
    clips.forEach((c, i) => {
      const w = compact ? (c.vertical ? 62 : 148) : (c.vertical ? 126 : 210), ht = compact ? 92 : 170;
      const dur = (c.end != null && c.start != null) ? this.fmtDur(c.end - c.start) + " \u00b7 loop" : "clip";
      h += '<button class="ng-clip" data-i="' + i + '" style="scroll-snap-align:start;flex:none;position:relative;width:' + w + 'px;height:' + ht + 'px;border-radius:13px;overflow:hidden;border:1px solid rgba(150,170,210,.16);background:#0c0f17;cursor:pointer;padding:0;display:block;transition:width .34s cubic-bezier(.4,0,.2,1),height .34s cubic-bezier(.4,0,.2,1);">' +
        '<img src="https://i.ytimg.com/vi/' + c.id + '/hqdefault.jpg" loading="lazy" referrerpolicy="no-referrer" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.92;transition:transform .18s ease,opacity .3s ease;">' +
        '<span style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,10,16,0) 38%,rgba(8,10,16,.88) 100%);"></span>' +
        '<span class="ngPlay" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:' + (compact ? 30 : 44) + 'px;height:' + (compact ? 30 : 44) + 'px;border-radius:50%;background:rgba(12,14,22,.6);backdrop-filter:blur(3px);border:1.5px solid rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center;transition:transform .16s ease,background .16s ease;"><svg width="15" height="15" viewBox="0 0 24 24" fill="#fff" style="margin-left:2px;"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg></span>' +
        '<span style="position:absolute;top:8px;right:8px;font-size:9px;font-weight:700;color:#eef1f6;background:rgba(8,10,16,.72);border-radius:6px;padding:2px 6px;letter-spacing:.02em;">' + dur + '</span>' +
        '<span style="position:absolute;left:10px;right:10px;bottom:9px;text-align:left;"><span style="display:block;font-size:' + (compact ? 10 : 11.5) + 'px;font-weight:700;color:#fff;line-height:1.25;text-shadow:0 1px 6px rgba(0,0,0,.65);">' + c.title + '</span>' + (c.by ? '<span style="display:block;font-size:10px;color:#c3cce0;margin-top:2px;text-shadow:0 1px 5px rgba(0,0,0,.6);">' + c.by + '</span>' : '') + '</span>' +
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
    this.fx("short_watched", { id: clip.id });
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
    // ── THE WAY OUT OF A PLAYING CLIP (v1.101.1) ──
    // Owner: "clicking outside the currently viewed video should close it, but there should also
    // be a closing x button top right of it". Two ways out, both ending in the same collapse.
    const xb = document.createElement("button");
    xb.className = "ngClipX";
    xb.type = "button";
    xb.setAttribute("aria-label", "Close video");
    xb.title = "Close video";
    xb.innerHTML = "✕";
    xb.style.cssText = "position:absolute;top:9px;right:9px;z-index:7;width:28px;height:28px;border-radius:9px;background:rgba(8,10,16,.78);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.22);color:#eef1f6;font-family:inherit;font-size:12px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:background .18s ease;";
    xb.addEventListener("mouseenter", () => { xb.style.background = "rgba(224,88,79,.9)"; });
    xb.addEventListener("mouseleave", () => { xb.style.background = "rgba(8,10,16,.78)"; });
    xb.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); this.collapseClip(card); });
    card.appendChild(xb);
    // capture phase, so a surface that stops propagation cannot keep the player alive behind it.
    // Registered DURING the click that expanded this card, which has already dispatched its own
    // pointerdown — so it cannot close what it just opened.
    card._outside = (e) => { if (!card._expanded) return; if (e.target && card.contains(e.target)) return; this.collapseClip(card); };
    document.addEventListener("pointerdown", card._outside, true);
    // TOP-CENTRE. Two axes, and they were both wrong for the same reason: the clip grew inside a
    // horizontal scroller and nothing re-placed the strip afterwards. `tweenScroll` centres the
    // card WITHIN the row; `_dockLandFilm` re-anchors the row itself now that it is 92px taller,
    // and because that anchor is a BOTTOM the growth goes upward — which is what puts a playing
    // clip at the top of the screen instead of halfway down it.
    if (row) { requestAnimationFrame(() => { const target = card.offsetLeft - Math.max(0, (row.clientWidth - card.offsetWidth) / 2); this.tweenScroll(row, Math.round(target - row.scrollLeft)); this._dockLandFilm(); }); }
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
    const cx = card.querySelector(".ngClipX"); if (cx) cx.remove();
    if (card._outside) { document.removeEventListener("pointerdown", card._outside, true); card._outside = null; }
    const glyph = card.querySelector(".ngPlay"); if (glyph) glyph.style.display = "";
    if (card._bw) { card.style.setProperty("width", card._bw + "px", "important"); card.style.setProperty("height", card._bh + "px", "important"); }
    card.style.cursor = "pointer";
    card._expanded = false;
    if (this._expandedClip === card) this._expandedClip = null;
    // the strip just shrank back — re-anchor it, or it stays parked where the player left it
    if (this._landFilmEl && this._landFilmEl.contains(card)) requestAnimationFrame(() => this._dockLandFilm());
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
      // A HINT, NOT A FLASH (v1.104.2, owner: the hover is "too long and too shiny and should be
      // just minor (almost unnoticeable) very subtle just to give the same idea but not attention
      // grabbing"). It zoomed the still 5% over 400ms and flipped the play glyph to BRAND RED at
      // 108% — a colour change is the loudest signal a hover can make, and this strip sits
      // directly above the question the player is meant to be reading. Now a 2% zoom and a
      // slightly more solid disc: same affordance, no announcement. (The click-to-expand morph is
      // untouched — the owner signed that one off in v1.102.1.)
      card.addEventListener("mouseenter", () => { if (card._expanded) return; if (img) img.style.transform = "scale(1.02)"; if (glyph) { glyph.style.transform = "translate(-50%,-50%) scale(1.03)"; glyph.style.background = "rgba(16,19,30,.8)"; } });
      card.addEventListener("mouseleave", () => { if (img) img.style.transform = "scale(1)"; if (glyph) { glyph.style.transform = "translate(-50%,-50%) scale(1)"; glyph.style.background = "rgba(12,14,22,.6)"; } });
      card.addEventListener("click", () => this.expandClip(card, clips[+card.getAttribute("data-i")]));
    });
  }
  // ── WHICH SIDE IS IN PLAY AT THIS NODE ── the ONE seam every side-aware read goes through.
  //
  // The visual layer collapses each position into a single hub node, and graph-data.json titles all
  // 136 of them "… Top". So a title suffix is a RENDERING ARTIFACT, not evidence of a side, and the
  // title-first derivation this replaces was a constant: it returned "Top" for every position node
  // in the graph, INCLUDING the one you are standing on while playing bottom. The `playerRole`
  // fallback beneath it could never run. Everything keyed off it therefore described the other
  // side's deck on half of all rolls — the landing card's question and familiarity chip, `_posKey`
  // and its odds bonus, the roll-log row, `_exploredKeys`, and `_maybeLessonDone` (13 curriculum
  // lessons are authored against a `|Bottom` deck key, so playing bottom could never complete one).
  //
  // The truth for the node you are STANDING ON is `playerRole` — the same value the option hand is
  // filtered by (`myVal`/`oppVal` via `roleIdx`) and the same value the identity card prints. For any
  // OTHER node there is no side in play, and the (constant) title is all there is; those reads are
  // side-agnostic lookups — content fallback, the key→node index — and are left exactly as they were.
  playedRole(node) {
    if (!node || node.ty !== "positions") return null;
    if (this.currentPos != null && node.idx === this.currentPos && this.playerRole) return this.roleLabel();
    const rm = (node.t || "").match(/\s+(Top|Bottom)\s*$/i);
    return rm ? (rm[1][0].toUpperCase() + rm[1].slice(1).toLowerCase()) : this.roleLabel();
  }
  deckRole(node) {
    if (node.ty === "positions") return this.playedRole(node);
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
  // ── P3 economy: permanent mastery + decaying sharpness. Drilling stays valuable forever
  // (mastery), but recency matters (sharpness fades as the roll moves on). ──
  mastery(key) { return key ? Math.min(0.15, 0.03 * ((this.prep && this.prep[key]) || 0)) : 0; }
  sharpness(key) { return (key && this._sharp && this._sharp[key]) || 0; }
  stateBonus(key) { return this.mastery(key) + this.sharpness(key); }
  bumpSharp(key) { if (key) (this._sharp = this._sharp || {})[key] = 0.10; }
  decaySharp() { const s = this._sharp; if (!s) return; for (const k in s) { s[k] = Math.round((s[k] - 0.025) * 1000) / 1000; if (s[k] <= 0) delete s[k]; } }
  bonusSplit(key) { return { mastery: this.mastery(key), sharp: this.sharpness(key) }; }
  // the Odds Pump: odometer count-up + spring on every odds element in a container. In test
  // mode the final value lands instantly (headless rAF is throttled); prod gets the 450ms ride.
  _pumpOdds(container, n) {
    const to = Math.round(this.moveChance(n) * 100);
    const col = to >= 60 ? "#7ee0a8" : to >= 38 ? "#cbd24e" : "#e8956b";
    container.querySelectorAll(".ngsucbig").forEach((el) => {
      const from = parseInt((el.textContent || "0").replace(/[^0-9]/g, ""), 10) || 0;
      el.style.color = col;
      if (this.isTest()) { el.textContent = to + "%"; return; }
      el.style.transition = "transform .45s cubic-bezier(.2,1.6,.3,1)";
      el.style.transform = "scale(1.18)";
      const t0 = performance.now(), dur = 450;
      const step = (ts) => {
        const k = Math.min(1, (ts - t0) / dur);
        el.textContent = Math.round(from + (to - from) * k) + "%";
        if (k < 1) requestAnimationFrame(step); else el.style.transform = "scale(1)";
      };
      requestAnimationFrame(step);
    });
    this.refreshOptionOdds();
  }
  // Cross-variant credit for the blended hierarchy cards: a family/position-tier card is the SAME
  // card duplicated into every variant's deck (identical question). The first time it's answered
  // anywhere, credit every other deck that contains it — so a "Mount principle" mastered while
  // drilling High Mount also counts on S Mount, Technical Mount, base Mount… Role-specific cards
  // are unique to their deck (map entry of one), so nothing changes for them.
  noteCardDone(card, key) {
    const q = card && card.q;
    if (!q) return;
    this.bumpSharp(key); // sharpness refreshes on EVERY grade, even repeats of a mastered card
    this._maybeLessonDone(key);
    this._saveProgress(); // persist prep bumps (debounced) even for repeat answers
    this.cardDone = this.cardDone || new Set();
    if (this.cardDone.has(q)) return;          // already credited everywhere
    this.cardDone.add(q);
    { // honest daily counter — cardsToday was read everywhere but never written
      const dk = this._dayKey(); this._days = this._days || {};
      this._days[dk] = (this._days[dk] || 0) + 1; this.cardsToday = this._days[dk];
      // THE DIGEST'S RAW MATERIAL (v1.105.7): a tiny per-day record — techniques touched, a
      // Game Knowledge snapshot, the top weak spots — synced in the blob so the email Worker
      // reads YOUR day from the same store everything else uses. Trimmed with `days` (30 keys);
      // merged per-day (union of keys, MAX count, latest score). Written only when the digest
      // is opted in: no consent, no data.
      if (this.get("emailDigest", false)) {
        try {
          this.dayLog = this.dayLog || {};
          const e = (this.dayLog[dk] = this.dayLog[dk] || { s: 0, k: [] });
          if (key && e.k.indexOf(key) < 0 && e.k.length < 40) e.k.push(key);
          e.s = Math.round((this.gameScore().score || 0) * 1000) / 10;
          const w = this.weakSpots ? this.weakSpots() : null;
          if (w) e.w = [w.n, w.word].concat(w.top || []);   // count, degree, then the top-2 names for the magazine section
        } catch (err) { /* the digest must never break a grade */ }
      }
      this.track("neural_card_answered", { deck_key: key, cards_today: this.cardsToday });
      this.fx("bonus_pumped", { deck_key: key });
    }
    const shared = this._sharedDecksFor(q, key);
    if (!shared) return;
    const decks = (this.flashcards && this.flashcards.decks) || {};
    this.prep = this.prep || {};
    for (const k of shared) {
      if (k === key) continue;                 // the local deck's own paths already counted it
      const cap = this._deckCardCount(decks[k]);   // manifest count when the cards are absent
      this.prep[k] = Math.min(cap, (this.prep[k] || 0) + 1);
    }
  }
  /**
   * Every deck carrying this question, or null when it is a role card unique to its own deck.
   *
   * The manifest's shared index is the authority (see _ingestDeckManifest): it lists every
   * multi-deck question in the CORPUS, so credit is the same whatever is loaded. Question
   * identity is hashable without the card text being resident, and a 32-bit hash is safe here
   * because the answering deck must itself appear in the entry — a non-shared question that
   * happens to collide with a shared one cannot pass that test.
   *
   * Fallback (a monolith boot, or a manifest older than the index): scan the resident decks, as
   * before. It is residency-dependent by nature, hence lazy + invalidated on every hydration.
   */
  _sharedDecksFor(q, key) {
    if (this._sharedQ) {
      const list = this._sharedQ.get(this.qhash(q));
      return list && list.length > 1 && list.indexOf(key) >= 0 ? list : null;
    }
    if (!this._qkDecks) {
      this._qkDecks = new Map();
      const decks = (this.flashcards && this.flashcards.decks) || {};
      for (const k of Object.keys(decks)) {
        for (const c of this._cardsOf(decks[k]) || []) {
          const arr = this._qkDecks.get(c.q);
          if (arr) arr.push(k); else this._qkDecks.set(c.q, [k]);
        }
      }
    }
    const list = this._qkDecks.get(q);
    return list && list.length > 1 ? list : null;
  }
  setDrillHeader(title, sub, countText, role, roleColor) {
    const head = this.drillHeadRef.current; if (!head) return;
    head.innerHTML =
      '<div style="display:flex;align-items:center;height:40px;margin-bottom:12px;">' +
        '<span class="ngBack" data-pane-back="1" style="cursor:pointer;color:#aeb9d2;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;white-space:nowrap;height:30px;padding:0 13px 0 10px;border-radius:9px;background:rgba(255,255,255,.05);transition:background .15s,color .15s;"><span style="font-size:14px;line-height:1;">\u2039</span>Back</span>' +
      '</div>' +
      (role ? '<div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;color:' + (roleColor || "#9fb0d8") + ';margin-bottom:5px;">' + role + '</div>' : '') +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">' +
        '<div style="font-size:19px;font-weight:700;color:#eef1f6;line-height:1.14;letter-spacing:-.01em;text-wrap:balance;">' + title + '</div>' +
        (countText ? '<span style="flex:none;margin-top:3px;font-size:11px;font-weight:700;color:#7ee0a8;letter-spacing:.02em;">' + countText + '</span>' : '') +
      '</div>' +
      (sub ? '<div style="font-size:11.5px;color:#93a0bd;margin-top:7px;line-height:1.45;">' + sub + '</div>' : '');
    head.querySelector(".ngBack").addEventListener("click", () => this._exitStudyTo(this._paneReturnTab)); // ‹ Back returns to the tab the study came from
    { const b = head.querySelector(".ngBack"); if (b) { b.addEventListener("mouseenter", () => { b.style.background = "rgba(255,255,255,.09)"; b.style.color = "#eef1f6"; }); b.addEventListener("mouseleave", () => { b.style.background = "rgba(255,255,255,.05)"; b.style.color = "#aeb9d2"; }); } }
  }
  updateDrillCount() {
    const el = this.drillCountRef.current;
    const e = this.drillEntries && this.drillEntries[this.activeDrill];
    const bonus = e ? Math.round(this.stateBonus(e.info.key) * 100) : 0;
    if (el) el.textContent = bonus > 0 ? "+" + bonus + "% odds" : "";
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
      const c = this._cardsOf(decks[info.key]);
      return { info: info, cards: c ? c.slice() : null };
    };
    let firstEntry;
    if (deckKeyOverride) {
      const fam = deckKeyOverride.split("|")[0], role = deckKeyOverride.split("|")[1] || "Defender";
      const c = this._cardsOf(decks[deckKeyOverride]);
      firstEntry = { info: { fam: fam, role: role, cat: "Defense", key: deckKeyOverride }, cards: c ? c.slice() : null };
    } else {
      firstEntry = entryFor(this.nodes[posIdx]);
    }
    this.drillEntries = [firstEntry];
    this._posKey = this.drillEntries[0].info.key;
    this.activeDrill = 0; this.deckIdx = 0; this.revealed = false;
    this._session = null;
    this._studyOpen = null;   // a new roll state retires any study surface (see _paneStudyActive)
    this._drillView = "home";
    // roll advance refreshes the History body ONLY when History is the shown tab — an open
    // Explore search or Challenges scroll must never be stomped by the roll loop
    if (this.deckShown && this._viewMode === "history" && !this._paneStudyActive()) {
      const list = this.drillListRef.current;
      const nearBottom = list ? (list.scrollHeight - list.scrollTop - list.clientHeight < 90) : true;
      const grew = (this._lastHomeRollLen || 0) < (this.rollLog ? this.rollLog.length : 0);
      this.renderDrillHome();
      if (list && grew && nearBottom) requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
    }
    this._lastHomeRollLen = this.rollLog ? this.rollLog.length : 0;
    this.deckReady = true;
    this.applyDeckVisibility(); // hidden by default; tab invites the user to open it
  }

  // The ONLY way the pane opens or closes is a user action routed through here (or through the
  // direct-assign study entry points). Nothing in the roll loop may call it — see PANE LAW below.
  setDeckOpen(open) {
    if (open && !this.deckOpen) this.track("neural_drill_opened", { deck_key: this._posKey || null });
    if (!open) {
      if (this._checkpoint) this._cancelCheckpoint(); // abandoning the quiz cancels it (natural completion nulled it first)
      if (this._mcAdvT) { clearTimeout(this._mcAdvT); this._mcAdvT = null; } // a closed deck must not auto-advance
    }
    this.deckOpen = !!open;       // sticky: once opened it stays open across lands until closed
    this.applyDeckVisibility();
    this.lastInteract = this.now;
  }
  applyDeckVisibility() {
    // an anchored chooser cannot outlive the surface it hangs off (v1.99.5)
    if (this._pickEl) this.closeListPicker();
    const open = this.deckReady && this.deckOpen;
    const wasShown = this.deckShown;
    this.deckShown = open;
    // ── PANE LAW ── the pane showing STOPS the game; hiding it resumes ONLY if the pane is what
    // stopped it (a hand-paused roll stays paused when you close it). One latch for the whole
    // merged pane (any tab, any study surface) — _dossierAutoPaused stays separate for the node
    // dossier. Latched here, not in setDeckOpen, because several study entry points (openMenu,
    // openHomeToLatest, checkpoint) assign deckOpen directly.
    // _paneTransition: the open/close beats run challenge-evidence processing, whose refresh
    // tail re-renders the pane body — mid-transition that's a double render that eats one-shot
    // state (migration notice, shelf scroll). The flag makes the refresh skip it; the caller's
    // own render is the one that lands.
    this._paneTransition = true;
    if (open && !wasShown) {
      this._csStep("pane_opened"); // marked HERE, not in setDeckOpen: study entry points assign deckOpen directly
      // EVERY open path wires the pane's static controls exactly once (v1.93.0). The tab bar,
      // search and gi-toggle used to be wired only by openPane(); a session whose FIRST open came
      // through openHomeToLatest / openMenu / openStudy (account chip, drill pill, landing chip,
      // challenge fallback) got a pane whose Explore/Challenges tabs were dead buttons. This is
      // the same choke point that latches the pane law, so no open path can miss it; the _wired
      // flags inside make repeat calls no-ops.
      this._wirePaneControls();
      this._refreshGhChip();   // lazy star count: first pane open, never the boot path (v1.105.5)
      // arrival positioning (v1.98.1): opening the pane onto Challenges lands the corridor
      // where the person is — renderChallenges consumes this once, instantly
      if (this._viewMode === "challenges") this._challengeScrollPending = true;
      if (!this.paused) { this.setPaused(true); this._paneAutoPaused = true; this.fx("pane_paused", {}); }
      const active = document.activeElement;
      this._explorerReturnFocus = active && active !== document.body ? active : null;
    } else if (!open && wasShown) {
      // ── CLOSING THE PANE WHILE A FILM IS RUNNING HANDS THE CLOCK OVER, IT DOES NOT RESUME ──
      // On a phone the 88vw drawer IS the screen, so closing it is how you WATCH the replay you
      // just started — and resuming the roll there would cancel the film with the very gesture
      // that exists to see it (`setPaused(false)` stops a replay, by design). The pause is simply
      // re-latched onto the film, which gives it back when it ends or is stopped. Desktop takes
      // the same branch and reads the same way: the film keeps holding the clock it was given.
      if (this._paneAutoPaused && this._replay) { this._paneAutoPaused = false; this._replayAutoPaused = true; }
      if (this._paneAutoPaused) { this._paneAutoPaused = false; this.setPaused(false); this.fx("pane_resumed", {}); }
      this._pathDim = false;
      // ── ON A PHONE, CLOSING THE DRAWER IS HOW YOU LOOK AT THE GRAPH ──────────────────────
      // The pane is 88vw here: it IS the screen. So a close is "let me see the graph", not
      // "throw the selection away" — and a shared class that vanished the moment the drawer
      // was dismissed made the link's whole promise unreachable on the only device it ships
      // to. A LIST selection therefore survives a mobile close (desktop keeps the original
      // clear-on-close: there the pane never covered the graph, so nothing was hidden).
      const keepList = this.isMobile() && this._listFocusId && this.listIdxs(this._listFocusId).length ? this._listFocusId : null;
      this.clearFocus();
      if (keepList) { this._listFocusId = keepList; this.setFocusIdxSet(this.listIdxs(keepList), true); }
      this._learningViewsTracked = {};
      const fallback = this._tutEl
        ? this._tutEl.querySelector("[data-challenge-cue-open]")
        : this.wrapRef.current && this.wrapRef.current.querySelector(".ng-logo");
      const restore =
        this._explorerReturnFocus && document.documentElement.contains(this._explorerReturnFocus)
          ? this._explorerReturnFocus
          : fallback;
      this._explorerReturnFocus = null;
      setTimeout(() => { try { if (restore && restore.focus) restore.focus(); } catch (e) {} }, 0);
    }
    const hint = this.optionHintRef.current;
    if (hint && open) { hint.style.opacity = "0"; hint.style.pointerEvents = "none"; }   // hide the scroll hint immediately when the sidebar opens
    const panel = this.drillRef.current;
    if (panel) { panel.style.display = open ? "flex" : "none"; panel.style.pointerEvents = open ? "auto" : "none"; }
    // the drill pill is DELETED (v1.99.0) — the share cue is a standalone conditional
    // control; every apply re-renders it (it hides while the pane owns its corner)
    this._renderShareCue();
    // the pane lives LEFT now (v1.94.0): on desktop the bottom-right chip and the pane no longer
    // share a corner, so the chip keeps its normal look. On a phone the drawer takes the screen
    // and the chip fades (updateUiShift) — close its menu so it can't linger over the drawer.
    if (open && !wasShown && this.isMobile()) this.closeAccountMenu();
    // ── ON A PHONE THE DRAWER OWNS THE SCREEN (v1.97.0) ── the landing card is a root-plane
    // overlay (z ladder: ambient 5) and the pane lives INSIDE the wrap, so at 88vw the card
    // painted OVER the drawer and stole its clicks (the Lists + was unreachable at 390px).
    // Same treatment the option sheet gives it: hide while the drawer is up, restore on close.
    // ── EVERY WIDTH, NOT JUST THE PHONE (v1.101.7) ──────────────────────────────────────────
    // "Desktop is untouched — there the card sits beside the left pane by design" was true at
    // 1440 and false everywhere narrower: the card is `min(520px, 100vw-32px)` and CENTRED, so
    // at 1024 it spans 252..772 against a pane at 0..360 — 108px of overlap, painted the wrong
    // way round for exactly the reason the phone rule exists. The pane's own `z-index:8` cannot
    // win: it lives inside the `position:fixed` app wrap, which is its own stacking context, so
    // it is trapped at plane level 0 while the card is a root-plane child at z:5.
    // Owner: "the left side pane should always appear in front of the current node's dialog, not
    // hidden behind it — the game pauses when the left pane is open". That second clause is the
    // argument: nothing is lost by standing the card down, because nothing is running. It comes
    // back, unchanged, on close. `_suppressLand` is the seam (it also takes the film strip, and
    // sets `visibility:hidden` so no invisible child keeps eating clicks — see v1.100.2).
    if (this._landEl || this._landFilmEl) {
      if (open) { this._suppressLand(true); this._landPaneHid = true; }
      // ...but only the LAST holder may lift it. `_traySup` is the other holder (an in-node read,
      // and since v1.106.5 a running replay, which stands the card down for the same reason the
      // pane does: it talks about a state you are not looking at). Without this, closing the
      // drawer to watch a film put the card back on top of the film.
      else if (this._landPaneHid && !this._traySup) { this._suppressLand(false); this._landPaneHid = false; }
      else if (this._landPaneHid && this._traySup) { this._landPaneHid = false; }
    }
    if (open !== wasShown && this.renderChallengeCue) this.renderChallengeCue(); // cue hides while the pane is up
    if (open) this.renderPaneAnchor(); // bottom anchor: stats + guest save nudge, fresh on every apply
    this._layoutPane();
    this.forceUpdate();
    this._paneTransition = false;
  }
  // ── merged-pane layout ── two body modes share the one pane:
  //  · tabs mode — knowledge header + Explore|Challenges|History nav + the active tab's body
  //  · study takeover — a live deck/session/checkpoint owns the pane; nav hides so the quiz
  //    can't be walked away from mid-question by a stray tab click (Esc/✕/‹Back still exit)
  // `_studyOpen` is the seam for a study surface whose CARDS HAVE NOT ARRIVED YET (v1.80.4).
  // Without it, an open-but-cold deck reads as "not a study surface", so the coalesced
  // post-hydration refresh ran buildDrillPanel and stomped the very surface the user opened —
  // the same class of bug as onFlashcardsReady's, one layer down.
  _paneStudyActive() { return !!(this.deck || this._session || this._checkpoint || this._studyOpen); }
  _layoutPane() {
    const panel = this.drillRef.current; if (!panel) return;
    const study = this._paneStudyActive();
    if (study && !this._paneWasStudy) this._paneReturnTab = this._viewMode; // remember where ‹ Back goes
    this._paneWasStudy = study;
    if (study) panel.setAttribute("data-pane-study", "1"); else panel.removeAttribute("data-pane-study");
    const vt = this.viewToggleRef.current; if (vt) vt.style.display = study ? "none" : "grid";
    const tools = this.explorerToolsRef.current;
    if (tools) tools.style.display = (study || this._viewMode !== "explore") ? "none" : "flex";
    const showEx = !study && this._viewMode !== "history";
    const exList = this.explorerListRef.current; if (exList) exList.style.display = showEx ? "block" : "none";
    if (!showEx) { const dos = this.dossierRef.current; if (dos) dos.style.display = "none"; }
    const showDrill = study || this._viewMode === "history";
    // the drill head is a STUDY surface now (setDrillHeader's ‹ Back + title) — History home
    // renders no head since the stat row + save nudge moved to the bottom anchor (v1.93.0)
    const dh = this.drillHeadRef.current; if (dh) dh.style.display = study ? "block" : "none";
    const dl = this.drillListRef.current; if (dl) dl.style.display = showDrill ? "flex" : "none";
    const df = this.drillFootRef.current; if (df && !showDrill) df.style.display = "none";
    // the bottom anchor supersedes tabs (all three see it); a study takeover hides it, and an
    // EMPTY anchor stays collapsed (signed-in users have no save nudge — v1.95.0, the stat
    // row lives in Explore now, so the anchor can be legitimately contentless)
    const pa = this.paneAnchorRef.current; if (pa) pa.style.display = study || !pa.childElementCount ? "none" : "flex";
    // THE STAT BAND SITS AT THE PANE'S FOOT (v1.104.5, owner: "I would prefer to be closer to the
    // bottom"). It is its OWN element above `.ng-pane-anchor` rather than inside it, because the
    // anchor collapses entirely for a signed-in user and these three numbers must not vanish with
    // the save nudge. Hidden during a study takeover, like everything else in the foot.
    const ps = this.paneStatsRef.current;
    if (ps) {
      if (study) ps.style.display = "none";
      else { ps.innerHTML = ""; ps.appendChild(this._exploreStatsRow()); ps.style.display = "block"; }
    }
  }
  // render whichever body the active tab owns (no-op while a study surface holds the pane)
  _renderPaneBody() {
    this._layoutPane();
    if (!this.deckShown || this._paneStudyActive()) return;
    this.renderPaneAnchor(); // exiting a study surface re-shows the anchor with fresh counts
    if (this._viewMode === "history") { this._pathDim = false; this.clearFocus(); this.renderDrillHome(); }
    else this.renderExplorer();
  }
  // exit an active study surface back to tabs mode on the given (or remembered) tab
  _exitStudyTo(view) {
    if (this._mcAdvT) { clearTimeout(this._mcAdvT); this._mcAdvT = null; } // leaving the card view cancels the pending advance
    if (this._checkpoint) this._cancelCheckpoint();
    this.deck = null; this._studyOpen = null; this._session = null; this._sessionNodes = null; this._inSession = false;
    this._drillView = "home";
    const target = view || this._paneReturnTab || "history";
    if (this._viewMode !== target) this.setViewMode(target);
    else this._renderPaneBody();
  }

  // ---------- progress / save hint ----------
  bumpBounce() {
    this.totalBounces = (this.totalBounces || 0) + 1;
    if (this.totalBounces >= 20) this.maybeShowSaveHint("bounces");
  }
  noteCardAnswered() {
    this.cardsAnswered = (this.cardsAnswered || 0) + 1;
    if (this.cardsAnswered >= 2) this.maybeShowSaveHint("cards");
    // THE BLACK-BELT CROSSING (v1.105.1). Post-grade by construction (both chokes bump
    // _stageVer before landing here, so gameScore() is fresh) — NOT in _bumpStageVer, which
    // hydration also calls: a badge minted by a payload arriving would be a badge for nothing.
    // Fires while black AND unminted — unconditional-at-black rather than edge-triggered, so a
    // user who was ALREADY black before v1.105.1 is grandfathered on their next answer; goes
    // quiet forever once the badge exists (replay noise, and the mint loop is idempotent anyway).
    try {
      if (!(this.badges && this.badges["recall-in-play"]) && this.gameScore().belt === "black") {
        this.fx("belt_reached", { belt: "black" });
      }
    } catch (e) { /* score not ready at boot — the next answer retries */ }
  }
  // PANE LAW: never force the pane open. One quiet toast; the save CTA still renders
  // inside the pane whenever the user opens it by hand (_menuNudge). The pill this used
  // to shake is deleted (v1.99.0).
  maybeShowSaveHint(reason) {
    if (this.saveDismissed || this.saveShown) return;
    this.saveShown = true; this._menuNudge = true;
    this.fx("save_hint", { reason: reason });
    this.setEvent("Save your progress", "Open the panel to keep it", "muted");
  }
  // (v1.94.0) the chip's old toggleMenu — open the pane / close the pane — is gone: the chip
  // opens the ACCOUNT MENU now (toggleAccountMenu), and the pane opener is the top-left logo.
  openMenu() {
    if (this._mcAdvT) { clearTimeout(this._mcAdvT); this._mcAdvT = null; } // leaving the card view cancels the pending advance
    this._drillView = "home";
    if (this._checkpoint) this._cancelCheckpoint(); // walking home mid-quiz abandons it (same as ✕/Esc)
    this.deck = null; this._studyOpen = null; this._session = null; // home = tabs mode, not study takeover
    if (this._viewMode !== "history") this.setViewMode("history");
    this.deckReady = true; this.deckOpen = true;
    this.applyDeckVisibility();
    this.renderDrillHome();
    this.lastInteract = this.now;
  }
  closeMenu() { this.setDeckOpen(false); }
  _deckHasCards(key) { const d = (this.flashcards && this.flashcards.decks) ? this.flashcards.decks[key] : null; return !!(d && d.cards && d.cards.length); }
  // ONE accessor for a deck's cards. A deck entry can be PRESENT but not hydrated: the
  // on-demand chunk path boots from a manifest stub ({n} with no `cards`) and fills
  // `cards` only once that deck's chunk lands. Read cards through here, never `d.cards`
  // directly — the stub is truthy, so it slips past every `if (d)` guard in this file and
  // turns into a TypeError (or a silent NaN index) at the point of use.
  _cardsOf(d) { return d && Array.isArray(d.cards) ? d.cards : null; }

  // ─────────────────────────── ON-DEMAND DECK RESIDENCY (v1.80.4) ───────────────────────────
  // The deck payload is no longer one 16.4MB file. Boot reads flashcards/_index.json (a
  // manifest: every deck key -> [chunk file, category, card count]) and each deck's cards
  // arrive when something needs them. Three rules make that safe:
  //
  //   1. A stub is a deck we KNOW about but whose cards are absent. `_cardsOf` is the only
  //      legal way to read cards (a stub is truthy and sails past `if (d)`).
  //   2. `n` is authoritative. Card counts, lesson goals, seen-glyphs and — above all —
  //      deckMastery/gameScore are computed from `n` plus the persisted grades, so a manifest
  //      boot shows the user the SAME belt as a fully-loaded one. Nothing regresses while
  //      chunks are in flight.
  //   3. Hydration FILLS IN PLACE (`d.cards = …` on the very object the manifest created), so
  //      any surface holding the deck object sees the cards appear. Surfaces that snapshotted
  //      `_cardsOf(d).slice()` are re-rendered by _onDeckHydrated.
  _dataBase() { return (typeof window !== "undefined" && window.__NEURAL_DATA_BASE) || ""; }
  // PROTOTYPE (dual close-pair graph): opt-in variant selector. null = production layout.
  _dualVariant() {
    try { const v = new URLSearchParams(location.search).get("dual"); return v === "fixed" || v === "force" || v === "iso" ? v : null; } // iso = projection C, the chosen 2.5D paradigm
    catch (e) { return null; }
  }
  _ingestDeckManifest(j) {
    const src = (j && j.decks) || {};
    const decks = {};
    for (const k in src) {
      const e = src[k];
      // Formats, oldest to newest — a stale manifest on a CDN edge must never break a fresh
      // bundle: {file,cat,role,n} (1) · [file,cat,n] (2) · [cat,n] (3, the address is derived).
      decks[k] = Array.isArray(e)
        ? (e.length >= 3 ? { file: e[0], cat: e[1], n: e[2] || 0 } : { cat: e[0], n: e[1] || 0 })
        : { file: e.file, cat: e.cat, n: e.n || 0 };
    }
    this.flashcards = { decks: decks, manifest: true };
    this._deckWaits = {};
    this._qkDecks = null;
    // CROSS-DECK CREDIT, RESIDENCY-INDEPENDENT (v1.80.5). The blended hierarchy duplicates one
    // position/family card into every variant deck, and answering it anywhere credits all of
    // them (see noteCardDone). That map used to be built by scanning RESIDENT decks, so the same
    // answer paid different credit depending on which chunks happened to have landed — a
    // correctness bug in the mastery economy, not a caching detail. The manifest now ships the
    // whole index: qhash(question) -> deck INDEXES into its own ordered deck list. Only
    // questions carried by 2+ decks are listed (451 of 21,334 — 10.6KB raw / 4.3KB gzip), which
    // is why it can be eager.
    this._sharedQ = null;
    const sh = (j && j.shared) || null;
    if (sh) {
      const keys = Object.keys(decks);   // JSON object order == the manifest's emitted order
      const m = new Map();
      for (const h in sh) {
        const list = (sh[h] || []).map((i) => keys[i]).filter(Boolean);
        if (list.length > 1) m.set(h, list);
      }
      this._sharedQ = m;
    }
    this._bumpStageVer();
  }
  /** Is every deck's cards present? (A monolith/test boot has no manifest flag.) */
  _deckResident(key) { return !!this._cardsOf(((this.flashcards && this.flashcards.decks) || {})[key]); }
  // ── A FAILED CHUNK IS A CONDITION, NOT A VERDICT (v1.80.5) ──
  // The first version of hydrateDeck cached the RESOLVED promise and set `d.cards = []` on ANY
  // failure. One dropped request — a phone stepping off gym wifi — therefore made that deck
  // EMPTY for the rest of the session, indistinguishable from "authored with no cards", and it
  // destroyed the authority of the manifest's `n` for that deck (mastery, crowns and the belt
  // score all read the cards once `cards` exists). A failure now leaves the stub exactly as it
  // was, is announced (`deck_fetch_failed`), and is retried by the next reader.
  get DECK_RETRY_CAP() { return 3; }         // consecutive failures before a cooldown
  get DECK_RETRY_COOLDOWN_MS() { return 20000; }
  /** Has this deck failed enough, recently enough, that asking again would just be hammering? */
  _deckCooling(key) {
    const d = ((this.flashcards && this.flashcards.decks) || {})[key];
    return !!(d && (d.err || 0) >= this.DECK_RETRY_CAP &&
      Date.now() - (d.errAt || 0) < this.DECK_RETRY_COOLDOWN_MS);
  }
  /**
   * What is true about this deck's cards RIGHT NOW — the three states that used to be one:
   *   "ready"   cards are here          ·  "empty"   authored with no cards (nothing to load)
   *   "pending" not asked for yet       ·  "loading" chunk in flight
   *   "failed"  the chunk did not arrive; `n` still speaks for it and the next reader retries
   *   "missing" not in the manifest at all
   */
  deckStatus(key) {
    const d = ((this.flashcards && this.flashcards.decks) || {})[key];
    if (!d) return "missing";
    const c = this._cardsOf(d);
    if (c) return c.length ? "ready" : "empty";
    if (this._deckWaits && this._deckWaits[key]) return "loading";
    if (d.err) return "failed";
    return (d.n || 0) > 0 ? "pending" : "empty";
  }
  /** Fetch one deck's chunk. Idempotent, coalesced, and safe to call on a resident deck. */
  hydrateDeck(key) {
    const decks = (this.flashcards && this.flashcards.decks) || {};
    const d = decks[key];
    if (!d) return Promise.resolve(null);
    if (this._cardsOf(d)) return Promise.resolve(d);
    const waits = (this._deckWaits = this._deckWaits || {});
    if (waits[key]) return waits[key];
    if (this._deckCooling(key)) return Promise.resolve(null);   // backing off, still retryable
    // the chunk address is DERIVED from the key (fnv1a32 == qhash), so the manifest carries no
    // filenames at all; `file` is only read when an older manifest supplies one.
    const file = d.file || this.qhash(key) + ".json";
    const p = fetch(this._dataBase() + "flashcards/" + file)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http " + r.status))))
      .then((j) => {
        // a chunk is a {deckKey: deck} MAP (collision-safe); older chunks were a bare deck
        const got = j && (j.cards ? j : j[key]);
        const cards = got && Array.isArray(got.cards) ? got.cards : null;
        // A chunk that carries no cards for a deck the MANIFEST says has `n` of them is a STALE
        // OR BROKEN chunk, not an empty deck. `n` wins; we retry rather than publish a lie.
        if (!cards || (!cards.length && (d.n || 0) > 0)) throw new Error("chunk carries no " + key);
        if (waits[key] === p) delete waits[key];
        d.cards = cards;                       // fill IN PLACE: open surfaces hold this object
        if (got.cat) d.cat = got.cat;
        if (got.role) d.role = got.role;
        d.err = 0;
        this._pruneStaleGrades(key, cards);
        this._onDeckHydrated(key);
        return d;
      })
      .catch(() => {
        if (waits[key] === p) delete waits[key];   // never cache a failure as success
        d.err = (d.err || 0) + 1; d.errAt = Date.now();
        this.fx("deck_fetch_failed", { deckKey: key, attempt: d.err, n: d.n || 0 });
        return null;
      });
    waits[key] = p;
    return p;
  }
  /** Hydrate several decks; resolves when all have landed (or failed). */
  hydrateDecks(keys) { return Promise.all((keys || []).map((k) => this.hydrateDeck(k))); }
  /** THE LANDING'S QUESTION NEEDS ITS DECK, AND THE FLIGHT IS FREE RUNWAY (v1.106.6). The moment
   *  a roll knows WHERE it will land (startRoll's draw, rollFromPosition's stage, an outcome's
   *  destination) there are 0.6-1.3s of travel before renderLandCard runs — exactly the window a
   *  cached chunk resolves in. Prefetching here is what makes the funnel honest: a skip recorded
   *  at render time now really means the payload is in flight (4G), not that nobody asked early
   *  enough. hydrateDeck is idempotent, coalesced, and a no-op before the manifest lands — the
   *  manifest-arrival backfill re-requests in that case. Fire-and-forget on purpose. */
  _prefetchLandDeck(idx) {
    const n = this.nodes && this.nodes[idx]; if (!n) return;
    const k = this.deckKeyFor(n); if (k && k.key) this.hydrateDeck(k.key);
  }
  /**
   * ONE definition of mastery, resident or not.
   *
   * `this.stage[key]` is keyed by question HASH, so a content pass that rewords a card leaves a
   * grade behind for a question that no longer exists. deckMastery's resident branch iterates
   * real cards and cannot see such a grade; its stub branch sums the persisted grades and
   * therefore CAN. Rather than let the two disagree, the arriving chunk heals the stored state:
   * a grade the shipped deck has no card for counts for nothing anywhere, so it is dropped.
   *
   * Guarded on the chunk agreeing with the manifest (`cards.length === n`): a truncated or
   * mid-deploy chunk must never be the thing that deletes a user's proof.
   */
  _pruneStaleGrades(key, cards) {
    const d = ((this.flashcards && this.flashcards.decks) || {})[key];
    const s = this.stage && this.stage[key];
    if (!s || !d || !cards || cards.length !== (d.n || cards.length)) return;
    const live = new Set(cards.map((c) => this.qhash(c.q)));
    let dropped = 0;
    for (const qh in s) if (!live.has(qh)) { delete s[qh]; dropped++; }
    if (dropped) { this._bumpStageVer(); this._saveProgress(); }
  }
  /** A deck the MC pooler wanted but did not have resident. */
  _mcCold(key) {
    if (this._mcNeed) {
      if (this._mcNeed.indexOf(key) < 0) this._mcNeed.push(key);
      // ABORT THE DRY PASS at the FIRST cold deck. Everything the pooler would consult after
      // this point is speculative — the missing deck usually satisfies it, and the tiers are
      // ordered by preference for exactly that reason. Without this, one pass names every deck
      // the later tiers would have walked (measured: 45 chunks for ONE landing question,
      // because the global tier walks the whole manifest). The pass is rolled back and re-run,
      // so aborting costs nothing but a repeat of some cheap arithmetic.
      throw { mcCold: key };   // caught by _warmMcPool's dry-pass guard
    }
    // Outside a warm pass this is a bug, not a condition: some surface rendered an MC block
    // without warming its pool. Say so — tests/neural_residency_contract.test.mjs and
    // tests/neural_manifest_boot.test.mjs are what assert on this beat.
    this.fx("mc_pool_cold", { deckKey: key });
  }
  /**
   * Make every deck the MC pooler will touch resident BEFORE it draws, so residency can never
   * move the RNG stream. Runs the pooler as a dry pass inside an RNG transaction, hydrates
   * whatever THAT PASS asked for, and repeats until a pass consults nothing cold. Each pass is
   * rolled back, so the caller's own mcDistractors() call draws from an untouched stream.
   *
   * LAZY AND BOUNDED (v1.80.5). This used to hydrate a pre-computed pool key list first — the
   * landing deck AND EVERY GRAPH NEIGHBOUR, unconditionally, on the one path that exists to
   * be lazy. It was an unbounded fan-out paid on 100% of landings for a pool that most cards
   * never consult: 85.5% of the corpus is satisfied by authored distractor tiers alone (12.0%
   * need their own deck, 0.5% a neighbour, 2.0% reach the global tier). The DRY PASS is the only
   * thing that knows which decks are really wanted, so it decides — and it ABORTS at the first
   * cold deck (see _mcCold), so the global tier's walk over the whole manifest cannot turn one
   * question into dozens of chunk fetches.
   */
  _mcWarmKey(key, card) { return key + "|" + this.qhash(card && card.q); }
  /** Is this card's distractor pool already resident? (Always true on a monolith/test boot.) */
  mcPoolWarm(key, card) {
    if (!this.flashcards || !this.flashcards.manifest) return true;
    return !!(this._mcWarmed && this._mcWarmed[this._mcWarmKey(key, card)]);
  }
  async _warmMcPool(card, deckKey, tag) {
    if (!card || !this.flashcards || !this.flashcards.manifest) return;   // monolith boot: nothing to warm
    const wk = this._mcWarmKey(deckKey, card);
    if (this._mcWarmed && this._mcWarmed[wk]) return;
    for (let pass = 0; pass < 6; pass++) {
      this._mcNeed = [];
      this._rngBegin();
      try { this.mcDistractors(card, deckKey, 3, tag); }
      catch (e) { /* the pass ABORTS at the first cold deck (see _mcCold); and a dry pass must
                     never break the surface it is warming */ }
      finally { this._rngRollback(); }
      const need = this._mcNeed; this._mcNeed = null;
      if (!need.length) break;
      await this.hydrateDecks(need);
      // A top-up that landed nothing (offline, a 404, a deck in its retry cooldown) must not
      // spin: the next dry pass would ask for exactly the same decks. The pool is as warm as it
      // is going to get, and mcDistractors degrades by drawing from fewer decks.
      if (!need.some((k) => this._deckResident(k))) break;
    }
    (this._mcWarmed = this._mcWarmed || {})[wk] = 1;
  }
  _onDeckHydrated(key) {
    this._qkDecks = null;      // the cross-deck credit index is built from cards — rebuild it
    this._bumpStageVer();      // mastery/crowns/belt read cards now; drop the memo
    (this._justHydrated = this._justHydrated || new Set()).add(key);
    // Re-render whatever is open, coalesced: a warm sweep can land a dozen chunks in a frame
    // and buildDrillPanel + renderDrillHome are not free.
    if (this._hydrateRefresh) return;
    this._hydrateRefresh = setTimeout(() => {
      this._hydrateRefresh = null;
      const fresh = this._justHydrated || new Set();
      this._justHydrated = null;
      // An OPEN study surface holds a snapshot (`_entryForKey` does `.slice()`), so filling
      // `d.cards` in place is not enough for it — it has to be rebuilt. Only when this exact
      // deck landed, and never over a live answer (a revealed card or an armed MC block).
      const e = this.drillEntries && this.drillEntries[this.activeDrill];
      if (e && fresh.has(e.info.key) && !e.cards && !this.revealed && !this._mc) {
        // REBUILD THE ENTRY, not just the DOM. `_entryForKey` takes a `.slice()` of the cards,
        // so the open surface holds a SNAPSHOT taken when the deck was still a stub — filling
        // `d.cards` in place is invisible to it. Re-rendering without this repaints the same
        // "being authored" placeholder forever.
        this.drillEntries[this.activeDrill] = this._entryForKey(e.info.key, e.info.filter); // re-apply the session filter (see _entryForKey)
        this.renderDrill();
      }
      this.onFlashcardsReady();
    }, 0);
  }
  // ── deferred Systems payload (324KB, read only by Explore + the system buckets) ──
  _ensureSystems() {
    if (this._systemsWait) return this._systemsWait;
    this._systemsWait = fetch(this._dataBase() + "systems.json")
      .then((sr) => (sr.ok ? sr.json() : null))
      .catch(() => null)
      .then((s) => {
        if (s && Array.isArray(s.systems) && s.systems.length) { this.systems = s.systems; this._onSystems(); }
        return this.systems || [];
      });
    return this._systemsWait;
  }
  // Deliberately NO speculative warm for systems.json. An idle callback fires long before a
  // hand exists on a cold boot, so "warm it at idle" simply put all 324KB back on the
  // bytes-to-first-hand bill (measured: it did). The read sites fetch it, and the Explore tab
  // re-renders when it lands — one click's worth of latency, once.
  openHomeToLatest() {
    // "Study this state" lands in the flashcards home (History tab), focused on the CURRENT state's
    // deck (even if its cards aren't authored yet — the row shows the scaffold). Never falls back
    // to a previous state.
    this._drillView = "home"; this.deck = null; this._studyOpen = null; this._session = null;
    if (this._checkpoint) this._cancelCheckpoint();
    if (this._viewMode !== "history") this.setViewMode("history");
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
  _syncWhiteChallengeCompatibility(timestamp) {
    const migrated = ngMigrateWhiteChallenges(this.challenges, this.tut, timestamp || 0);
    this.challenges = migrated.challenges;
    this.tut = migrated.tut;
    return migrated.changed;
  }
  _loadProgress() {
    this._progressLoaded = true; // ingest ran (any path) — unmount flush is now safe (Q001)
    this.rec = {}; this.stage = {}; this.srs = {}; this.units = {}; this.belts = { won: {} }; this._settingsAt = {}; this.tut = { done: {} };
    this.challenges = {}; this.badges = {}; this.coins = {}; this._challengeRuntime = {};
    this.lists = {}; // shareable technique lists (ids of graph nodes) — see the LISTS section
    try {
      const raw = localStorage.getItem("bjj-neural-progress"); if (!raw) return;
      const p = JSON.parse(raw); if (!p || (p.v !== 1 && p.v !== 2)) return;
      this.prep = Object.assign({}, p.prep || {});
      this._days = Object.assign({}, p.days || {});
      this.dayLog = Object.assign({}, p.dayLog || {});
      if (p.settings) this.settings = Object.assign({}, this.settings || {}, p.settings);
      this._settingsAt = Object.assign({}, p.settingsAt || {});
      // v1 -> v2 migration: recall history didn't exist — grandfather rec = prep so nobody's
      // mastery collapses on upgrade (Phase 2 gates NEW mastery on real recall grades).
      this.rec = Object.assign({}, p.v === 2 ? (p.rec || {}) : (p.prep || {}));
      // per-card review schedule (v1.105.0): {deckKey: {qhash: [due, ivl, last]}} in epoch DAYS.
      // Rides the v2 blob without a version bump (the `lists` precedent); absent on old blobs.
      this.srs = Object.assign({}, p.srs || {});
      this.stage = Object.assign({}, p.stage || {});
      this.units = Object.assign({}, p.units || {});
      this.belts = Object.assign({ won: {} }, p.belts || {});
      this.belts.won = Object.assign({}, (p.belts || {}).won || {});
      const hadLegacyTutorial = Object.keys(((p.tut || {}).done) || {}).length > 0;
      const hadChallenges = Object.keys(p.challenges || {}).length > 0;
      this.tut = { done: Object.assign({}, (p.tut || {}).done || {}) };
      this.challenges = Object.assign({}, p.challenges || {});
      this.badges = Object.assign({}, p.badges || {});
      this.coins = Object.assign({}, p.coins || {});
      // lists ride the EXISTING v2 blob: a coach's class list is not worth a schema migration
      this.lists = ngListsNormalize(p.lists);
      this.activeListId = this.get("activeListId", null);
      if (this.activeListId && !this.lists[this.activeListId]) this.activeListId = this.listsArray()[0] || null;
      // a user who already met the old 3-beat coach starts the drip past those three steps
      if (!p.tut) { try { if (localStorage.getItem("bjj-neural-coached")) { this.tut.done.coach1 = 1; this.tut.done.coach2 = 1; this.tut.done.coach3 = 1; } } catch (e) {} }
      this._syncWhiteChallengeCompatibility(p.updatedAt || 0);
      this._challengeMigrationNotice =
        hadLegacyTutorial &&
        !hadChallenges &&
        !this.get("challengeMigrationSeen", false);
      this.cardsToday = this._days[this._dayKey()] || 0;
    } catch (e) { /* corrupt/absent — start fresh */ }
  }
  /** last-30-keys trim, shared by `days` and `dayLog` */
  _trimDays(m) { const out = {}; for (const k of Object.keys(m).sort().slice(-30)) out[k] = m[k]; return out; }
  _progressBlob() {
    this._syncWhiteChallengeCompatibility(this._progressAt || Date.now());
    const days = this._days || {};
    const trimmed = {};
    for (const k of Object.keys(days).sort().slice(-30)) trimmed[k] = days[k];
    this._progressAt = Date.now();
    return { v: 2, prep: this.prep || {}, rec: this.rec || {}, stage: this.stage || {}, srs: this.srs || {}, dayLog: this._trimDays(this.dayLog || {}), units: this.units || {}, belts: this.belts || { won: {} }, tut: this.tut || { done: {} }, challenges: this.challenges || {}, badges: this.badges || {}, coins: this.coins || {}, lists: this.lists || {}, days: trimmed, settings: this.settings || {}, settingsAt: this._settingsAt || {}, updatedAt: this._progressAt };
  }
  _saveProgress() {
    clearTimeout(this._saveT);
    const write = () => {
      try { localStorage.setItem("bjj-neural-progress", JSON.stringify(this._progressBlob())); } catch (e) { /* quota */ }
      if (this._pushCloud) this._pushCloud(); // cloud sync (slice 6) — no-op for guests
    };
    if (this.isTest()) { write(); return; } // journeys reload faster than a debounce
    this._saveT = setTimeout(write, 400);
  }
  // synchronous flush — the debounced write loses a belt win / checkpoint pass if the user
  // reloads or closes the tab within 400ms of the fanfare. Called on the critical milestones
  // AND on pagehide/visibility-hidden (registered in boot).
  _flushSave() {
    clearTimeout(this._saveT);
    try { localStorage.setItem("bjj-neural-progress", JSON.stringify(this._progressBlob())); } catch (e) { /* quota */ }
    if (this._pushCloud) this._pushCloud();
  }
  set(k, v) { this.settings = this.settings || {}; this.settings[k] = v; (this._settingsAt = this._settingsAt || {})[k] = Date.now(); this._saveProgress(); }
  // deferred-payload hooks: refresh whatever is open when the heavy files land post-boot
  onFlashcardsReady() {
    try {
      // NEVER rebuild the roll panel over a live study surface. buildDrillPanel resets
      // `deck`/`_drillView` (it is the roll-advance entry point), so when this hook fired once
      // — the monolith landing — that was harmless. Now a deck chunk landing calls it, and
      // without this guard an arriving chunk wiped the very deck the user had just opened:
      // the card stayed on screen but `deck` went null, so grading and keyboard nav went dead.
      if (this.currentPos != null && this.currentPos >= 0 && !this._paneStudyActive()) this.buildDrillPanel(this.currentPos);
      if (this.deckShown && this._viewMode === "history" && this._drillView === "home" && !this._paneStudyActive()) this.renderDrillHome();
      this.refreshOptionOdds();
      this._landBackfill(); // the state on screen right now gets the question it was owed
      this._refreshChallengeEvidence();
    } catch (e) { /* non-fatal */ }
  }
  onContentReady() {
    try {
      if (this._nodeCardOn) { this._nodeCardIdx = null; this.updateNodeCard(this.W / this.cam.vw); }
      else if (this._dossierIdx != null && this.isMobile() && this.nodes) this.renderDossier(this.nodes[this._dossierIdx]);
      this._landBackfill(); // definition + film for the state the player is standing on
    } catch (e) { /* non-fatal */ }
  }
  // guarded PostHog capture (the page loads posthog globally; token absent on localhost) — no PII
  track(event, props) {
    try { const ph = window.posthog; if (ph && ph.capture) ph.capture(event, Object.assign({ variant: "neural" }, props || {})); } catch (e) { /* analytics must never break the app */ }
  }

  // ── COLD-START FUNNEL ── the one journey with no instrumentation behind it: does a first-time
  // visitor get from "app painted" to "roll finished"? Deliberately CHEAP — it is a beat-stream
  // OBSERVER, not a second channel: fx() hands every beat to _csBeat, a lookup table maps the
  // handful that matter to once-only marks, and each mark fires ONE guarded posthog.capture
  // (no fetch, no beacon, no blocking work). Total hot-path cost is one property read per beat.
  //
  // Two event names, matching the existing neural_<noun>_<verb> taxonomy:
  //   neural_coldstart_step      — one per mark; build the funnel on the `step` property
  //   neural_coldstart_abandoned — summary emitted from the pagehide/visibility flush
  // ANALYSIS NOTE: a hide can be a tab-switch, so the report RE-ARMS whenever the spine advances.
  // Take the LAST abandoned event per session; the step events are the authoritative funnel.
  //
  // ── THE SPINE IS DERIVED FROM THE DEFAULT PATH, NOT FROM THE IDEAL ONE ──
  // v1.82.0 shipped a 7-step spine that included `question_answered` between the question and the
  // commit. Measured on the DEFAULT (coached) path, the recorded order was
  //
  //     ["app_ready","hand_dealt","move_committed","outcome_seen"]      (indices 0,1,4,5)
  //
  // — an ordered PostHog funnel on that spine reports a 100% drop at `question_shown` for a
  // visitor who played a whole exchange. Two separate errors caused it:
  //   1. the coach suppressed the landing card, so the question was never asked (fixed in v1.82.x
  //      by letting the coached landing carry its question; the coach itself went in v1.104.0);
  //   2. `question_answered` was a GATE when it is a BRANCH. Ignoring the question is a legitimate
  //      way to play on; gating the funnel on it reports every such visitor as a drop-off.
  // So `question_answered` is now a side mark alongside `question_ignored`, and the spine is the
  // path every cold visitor must physically walk. A landing that can ask nothing at all (proven
  // deck, no authored cards, `landQuestions` off) emits `question_skipped` WITH A REASON, so a gap
  // in the funnel always has a named cause rather than being a phantom.
  _csSpine() { return this._csSp || (this._csSp = ["app_ready", "hand_dealt", "question_shown", "move_committed", "outcome_seen", "roll_ended"]); }
  // beat -> mark. Cached (not a getter) so the per-beat path allocates nothing.
  _csMapOf() {
    return this._csM || (this._csM = {
      options_dealt: "hand_dealt",        // the first hand of options is the first actionable state
      land_q_shown: "question_shown",
      land_q_answered: "question_answered", // BRANCH, not a gate — see the note above
      land_q_ignored: "question_ignored", // committing past an unanswered question
      land_q_skipped: "question_skipped", // the landing could ask nothing; `reason` says why
      land_q_unseen: "unseen_question",   // the specific suspected confusion (see renderLandCard)
      commit: "move_committed",
      impact_success: "outcome_seen", impact_fail: "outcome_seen",
      bonus_pumped: "deck_card_graded",   // first flashcard actually graded
      roll_end: "roll_ended",
    });
  }
  // ONE definition of "has this person been here before", decided once per app life. The cold-start
  // funnel's cold/warm split and the first-impression draw must never disagree about it — and the
  // answer has to be latched, because the very act of starting that first roll writes a marker.
  // Storage unreadable (private mode) → NOT returning: a browser that keeps no history has none, so
  // every visit genuinely is a first impression. Same default the funnel already used.
  _returningVisitor() {
    if (this._returning != null) return this._returning;
    let r = false;
    try { r = !!(localStorage.getItem("bjj-neural-progress") || localStorage.getItem("bjj-neural-coached") || localStorage.getItem("bjj-neural-firstroll") === "1"); } catch (e) { /* private mode */ }
    return (this._returning = r);
  }
  // ── IS THE FIRST IMPRESSION STILL OWED? ── latched once per app life, like _returningVisitor.
  //
  // `bjj-neural-firstroll` carries three states: ABSENT (never drawn), "owed" (drawn, but the traffic
  // weights had not landed, so the biased opening WIN 1 exists for was never actually GIVEN) and "1"
  // (given). Only "1" is evidence of a first impression, and "owed" outranks every other marker.
  //
  // It has to, because the other two markers `_returningVisitor` reads are written by ordinary play
  // inside the very visit whose draw degraded: `bjj-neural-coached` when the newcomer finishes the
  // 3-panel coach, `bjj-neural-progress` on the first save (grading one card is enough). Neither is
  // evidence that an opening was given, but both persist — so treating them as proof spent an
  // impression that was never made, and spent it FOR EVER: the newcomer with the worst connection,
  // the one the bias helps most, kept the ~95%-unnameable opening on every future visit. Within a
  // session this was already safe (_returningVisitor is latched), which is exactly why it hid.
  _firstImpressionOwed() {
    if (this._owedFirst != null) return this._owedFirst;
    let v = null;
    try { v = localStorage.getItem("bjj-neural-firstroll"); } catch (e) { /* private mode */ }
    return (this._owedFirst = !!v && v !== "1");
  }
  _csInit() {
    this._cs = { at: {}, cold: !this._returningVisitor(), last: 0, reported: false, hides: 0 };
    // OBSERVER MEANS OBSERVER. v1.82.0 pushed its marks into `this.beats`, the gameplay beat
    // stream — so a freshly remounted app life no longer had an empty stream, and SEVEN gen specs
    // that use exactly that emptiness as their "rebuilt, not resumed" proof went red. Analytics
    // must never be visible to the thing it measures: the marks live in their own array.
    this.csBeats = [];
    this._csArmHide();
  }
  // ── ARMED FIRST, NOT LAST ── these were registered at the END of boot(), downstream of the
  // graph ingest and the loader teardown. On the cold load this funnel exists to measure, that is
  // seconds of dead air: a visitor who gives up while the loader is still spinning emitted
  // NOTHING, so the abandonment the funnel was built to find was unmeasurable by construction.
  // _csInit() is the first statement of boot(), so registering here covers the whole session.
  // The save side keeps its own guard: _flushSave is only safe once _loadProgress has run (Q001),
  // and _loadProgress happens later in boot — hence the _progressLoaded check, not a bare call.
  _csArmHide() {
    if (this._onPageHide) return;
    // NOT a constant: true only because arming happens before app_ready is recorded. Move this call
    // back down to the end of boot() and it flips to false, which is what the structural test pins.
    if (this._cs) this._cs.armedBefore = this._cs.at.app_ready == null;
    const flush = () => { try { if (this._progressLoaded) this._flushSave(); } catch (e) { /* durability is best-effort */ } };
    this._onPageHide = () => { flush(); this._csAbandon("pagehide"); };
    this._onVisHide = () => { if (document.visibilityState === "hidden") { flush(); this._csAbandon("hidden"); } };
    window.addEventListener("pagehide", this._onPageHide);
    document.addEventListener("visibilitychange", this._onVisHide);
  }
  // ms since NAVIGATION start (not since boot) — the honest number for "how long until the user
  // could do anything". NB in test mode this is wall clock; the `funnel` beat's own `t` is sim time.
  _csNow() { try { return Math.round(performance.now()); } catch (e) { return 0; } }
  _csBeat(beat, props) {
    const step = this._csMapOf()[beat];
    if (!step) return;
    let extra = null;
    if (beat === "land_q_answered") extra = { correct: !!props.correct, tier: props.tier || null };
    else if (beat === "land_q_unseen") extra = { node: props.node || null, cards_authored: props.cards || 0 };
    else if (beat === "land_q_ignored") extra = { deck_key: props.deckKey || null };
    else if (beat === "land_q_skipped") extra = { deck_key: props.deckKey || null, reason: props.reason || null };
    this._csStep(step, extra);
  }
  _csStep(step, extra) {
    const cs = this._cs;
    if (!cs || cs.at[step] != null) return; // once only — this is a funnel, not a counter
    const ms = this._csNow();
    cs.at[step] = ms;
    const sp = this._csSpine();
    const spine = sp.indexOf(step);
    // SELF-DESCRIBING ORDER. An ordered funnel is only meaningful if a recorded spine step arrives
    // with every earlier spine step already recorded. When it does not, say so IN THE EVENT rather
    // than let the analysis infer a drop-off that never happened — this is the exact failure that
    // made the v1.82.0 spine unusable, and stamping it here means it can never recur silently.
    // BOTH DIRECTIONS. Scanning only EARLIER steps for absence catches a step that arrives too LATE
    // and misses one that arrives too EARLY — and the cold path produces exactly the second shape:
    // when the deck payload lands mid-turn, `question_shown` (spine 2) is backfilled with
    // `move_committed` (3) and `outcome_seen` (4) ALREADY recorded. Every earlier step is present, so
    // a one-way check calls that clean while an ordered funnel built on it silently reads a
    // 2-after-4 arrival as a fresh visitor entering at step 2. `skipped` names earlier steps still
    // missing, `late_after` names later steps already recorded; either sets `out_of_order`.
    let missing = null, ahead = null;
    if (spine >= 0) {
      const gaps = [], past = [];
      for (let i = 0; i < spine; i++) if (cs.at[sp[i]] == null) gaps.push(sp[i]);
      for (let i = spine + 1; i < sp.length; i++) if (cs.at[sp[i]] != null) past.push(sp[i]);
      if (gaps.length) missing = gaps.join(",");
      if (past.length) ahead = past.join(",");
    }
    const props = Object.assign({
      step: step, step_index: spine, spine: spine >= 0, cold: !!cs.cold,
      ms_since_nav: ms, ms_since_prev: ms - cs.last,
      out_of_order: !!(missing || ahead), skipped: missing, late_after: ahead,
    }, extra || {});
    if (spine >= 0) { cs.last = ms; cs.reported = false; } // re-arm the abandon report
    (this.csBeats = this.csBeats || []).push(Object.assign({ t: this.now || 0, beat: "funnel" }, props));
    this.track("neural_coldstart_step", props);
  }
  _csFurthest() {
    const cs = this._cs; if (!cs) return -1;
    const sp = this._csSpine();
    let f = -1;
    for (let i = 0; i < sp.length; i++) if (cs.at[sp[i]] != null) f = i;
    return f;
  }
  _csAbandon(reason) {
    const cs = this._cs;
    if (!cs || cs.reported) return;
    const sp = this._csSpine();
    const f = this._csFurthest();
    if (f >= sp.length - 1) return; // finished a whole roll — there is nothing to report
    cs.reported = true; cs.hides++;
    const props = {
      reason: reason, cold: !!cs.cold, furthest_step: f >= 0 ? sp[f] : "none", furthest_index: f,
      ms_since_nav: this._csNow(), hides: cs.hides, marks: Object.keys(cs.at).join(","),
    };
    (this.csBeats = this.csBeats || []).push(Object.assign({ t: this.now || 0, beat: "funnel_abandon" }, props));
    this.track("neural_coldstart_abandoned", props);
  }
  get(k, d) { const v = (this.settings || {})[k]; return v == null ? d : v; }
  masteredCount() { const r = this.rec || {}; return Object.keys(r).filter((k) => r[k] >= 3).length; } // mastery is RECALL-proven: 3 recall grades (MC can never mint it)
  // reveal-only rail: seeing an answer is 'seen', never mastery credit (the honest economy)
  noteCardSeen(key, idx) {
    this._seen = this._seen || {};
    (this._seen[key] = this._seen[key] || new Set()).add(idx);
  }
  iconStack(col) { return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="' + (col || '#9fb0d8') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"></path><path d="m2 17 10 5 10-5"></path><path d="m2 12 10 5 10-5"></path></svg>'; }

  // ── pane bottom anchor: the guest save nudge, ONE block at the pane's foot, every tab ──
  // v1.95.0: the stat row (mastered / today / weak spots) moved OUT of the anchor to the top
  // of Explore — "the 30 weak spots are the call to action" there (owner). The anchor keeps
  // exactly one job: "Create an account to save your progress" over a quieter "or log in",
  // directly above the Settings/Terms/Privacy row. A study takeover hides it (_layoutPane);
  // signed-in users have nothing here, so the block collapses entirely (their session CTA
  // and Log out live in the Last rolls foot as before).
  renderPaneAnchor() {
    const el = this.paneAnchorRef.current; if (!el) return;
    if (this.user) { el.innerHTML = ""; el.style.display = "none"; return; }
    // THE CLASSIC STACK (v1.98.1, owner's final design — supersedes the v1.97 one-liner):
    // three levels reading as ONE unit — a small muted caption (the why), the full-width
    // primary button (the block's one visual anchor), and a centered quiet escape line.
    // Tight vertical rhythm; guest-only; drawer + desktop alike.
    // styled via .ng-anchor-* classes (helmet.html) — hover/active/focus-visible states
    // need real CSS, and the block should read as one designed unit (owner, v1.99.1)
    el.innerHTML =
      '<div class="ng-anchor-caption" data-anchor-caption="1">Save your progress</div>' +
      '<button type="button" class="ngHdrAuth ng-anchor-cta" data-anchor-auth="1">Create account</button>' +
      '<div class="ng-anchor-alt" data-anchor-alt="1"><span>Already have one?</span><button type="button" class="ng-anchor-login" data-anchor-login="1">Log in</button></div>';
    el.style.display = this._paneStudyActive() ? "none" : "flex";
    { const a = el.querySelector("[data-anchor-auth]"); if (a) { a.addEventListener("mouseenter", () => a.style.filter = "brightness(1.08)"); a.addEventListener("mouseleave", () => a.style.filter = "none"); a.addEventListener("click", () => this.openAuth("create")); } }
    { const l = el.querySelector("[data-anchor-login]"); if (l) { l.addEventListener("mouseenter", () => l.style.color = "#cbd4e6"); l.addEventListener("mouseleave", () => l.style.color = "#7e8aa3"); l.addEventListener("click", () => this.openAuth("login")); } }
  }

  // ── the stat row (v1.95.0): mastered / today / weak spots, at the TOP of Explore ──
  // Same .ngStat handles and click-throughs it has carried since v1.7 — only its home moved
  // (History head → pane anchor → Explore body top). The weak-spots count is the browse
  // surface's call to action; the other two open their flashcard lists.
  /**
   * THE WEAK-SPOT FIGURE WAS THE DAILY GOAL (v1.104.5). `_exploreStatsRow` printed
   * `get("dailyGoal", 30) + "+"`, so it read "30+" for a player with 3 gaps and for one with 700,
   * and never moved as they closed them. The real pool is `bucketTechniques("suggested")` BEFORE
   * its `.slice(0, dailyGoal)` — and that pool is already ranked in three tiers, which is exactly
   * the "degrees of gaps" the owner asked for:
   *   rolled through but never drilled -> VERY WEAK (you have been here and cannot recall it)
   *   never touched                    -> WEAK
   *   started, under 3 recall reps     -> SHAKY
   * The stat names the worst tier that still has anything in it, and counts THAT tier — so the
   * number falls as you close them and the word tells you what kind of gap is left.
   */
  weakSpots() {
    const decks = (this.flashcards && this.flashcards.decks) || {};
    const keys = Object.keys(decks);
    const prep = this.prep || {};
    const seen = new Set();
    const uniq = (arr) => arr.filter((k) => { const f = k.split("|")[0]; if (seen.has(f)) return false; seen.add(f); return true; });
    const explored = this._exploredKeys ? [...this._exploredKeys] : [];
    const veryWeak = uniq(explored.filter((k) => decks[k] && !prep[k]));
    const weak = uniq(keys.filter((k) => !prep[k]));
    const shaky = uniq(keys.filter((k) => prep[k] > 0 && prep[k] < 3));
    // `top` (v1.105.7): the two worst offenders by name — the digest's magazine section
    if (veryWeak.length) return { n: veryWeak.length, word: "very weak", total: veryWeak.length + weak.length + shaky.length, top: veryWeak.slice(0, 2) };
    if (weak.length) return { n: weak.length, word: "weak", total: weak.length + shaky.length, top: weak.slice(0, 2) };
    return { n: shaky.length, word: shaky.length ? "shaky" : "weak", total: shaky.length, top: shaky.slice(0, 2) };
  }
  _exploreStatsRow() {
    const mastered = this.masteredCount();
    const gs = this.gameScore();
    const pctMastered = Math.round((gs && gs.score ? gs.score : 0) * 100);
    const weak = this.weakSpots();
    const due = this.dueCount();
    const row = document.createElement("div");
    row.setAttribute("data-explore-stats", "1");
    // DISTRIBUTED, NOT CLUMPED (v1.104.5, owner: it "still looks left aligned instead of neatly
    // designed and distributed"). `display:flex;gap:14px` packs three stats against the left edge
    // of a 360px pane and leaves the right third empty. A 3-column grid gives each stat an equal
    // share and lets the outer two hug the edges, so the row reads as a designed band.
    row.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);align-items:center;font-size:11.5px;min-height:34px;padding:8px 12px 10px;gap:8px;";
    row.innerHTML =
      // word first (owner, v1.95.2): "Mastered 3" — NB this figure is the recall-proven
      // technique COUNT (masteredCount), not a percent; the percent lives in the Explore
      // tab subtitle ("Mastered N%"). Its siblings keep their number-first shapes.
      // each cell is its own column: left / centre / right, so the three share the width
      '<span class="ngStat" data-b="mastered" style="grid-column:1;justify-self:start;cursor:pointer;color:#8b97b0;display:inline-flex;align-items:baseline;gap:4px;border-bottom:1px dashed rgba(139,151,176,.35);padding-bottom:1px;">Mastered <b style="color:#cbd4e6;font-weight:700;">' + mastered + '</b><span style="color:#7e8aa3;font-size:10.5px;">(' + pctMastered + '%)</span></span>' +
      // MAINTENANCE FIRST (v1.105.0, owner): the middle cell is the daily dosage — the honest
      // due count (deduped by FACT, not deck), amber while anything is owed. "N today" moves to
      // the title/aria; one press opens the due SESSION, not the browse modal.
      '<span class="ngStat" data-b="due" title="' + (this.cardsToday || 0) + ' answered today" aria-label="' + due + ' cards due \u00b7 ' + (this.cardsToday || 0) + ' answered today" style="grid-column:2;justify-self:center;cursor:pointer;color:' + (due > 0 ? "#d6a45a" : "#8b97b0") + ';display:inline-flex;align-items:baseline;gap:4px;border-bottom:1px dashed rgba(139,151,176,.35);padding-bottom:1px;"><b style="color:' + (due > 0 ? "#e9bd70" : "#7ee0a8") + ';font-weight:700;">' + due + '</b> due</span>' +
      '<span class="ngStat" data-b="suggested" data-weak="' + weak.n + '" style="grid-column:3;justify-self:end;text-align:right;cursor:pointer;color:#d6a45a;display:inline-flex;align-items:baseline;gap:4px;border-bottom:1px dashed rgba(214,164,90,.4);padding-bottom:1px;"><b style="color:#e9bd70;font-weight:700;">' + weak.n + '</b> ' + weak.word + ' spots</span>';
    row.querySelectorAll(".ngStat").forEach((s) => {
      const sg = s.getAttribute("data-b") === "suggested";
      s.addEventListener("mouseenter", () => s.style.color = sg ? "#f0cf8e" : "#cbd4e6");
      s.addEventListener("mouseleave", () => s.style.color = sg ? "#d6a45a" : "#8b97b0");
      s.addEventListener("click", () => { const b = s.getAttribute("data-b"); if (b === "suggested") { this.openSession("suggested", "Weak spots in your game"); } else if (b === "due") { if (this.dueCount() > 0) this.openSession("due", "Due today \u2014 maintenance"); else this.openFlashBrowser("due", "Due Today"); } else { this.openFlashBrowser(b, "Mastered"); } });
    });
    return row;
  }

  renderDrillHome() {
    this.settings = this.settings || {};
    const goal = this.get("dailyGoal", 30);
    const head = this.drillHeadRef.current, list = this.drillListRef.current, foot = this.drillFootRef.current;
    if (!head || !list) return;
    if (foot) { foot.style.display = "none"; foot.innerHTML = ""; }

    // The History head is empty since v1.93.0: the guest save nudge + the compact stat row moved
    // to the pane's bottom anchor (renderPaneAnchor), one block above Settings/Terms/Privacy,
    // visible on all three tabs. The knowledge header above the tabs stays the ONLY progress
    // meter (v1.76.0 canon). _layoutPane shows the head only for study takeover now.
    head.innerHTML = "";

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

    // hero CTA pinned in the footer — only for signed-in users (guests get the save nudge in the
    // pane's bottom anchor, renderPaneAnchor)
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
    // the count is the manifest's `n` (the corpus truth); residency only decides whether the
    // inline Q&A card can be built yet, and a cold deck is fetched when the row is opened
    const ncards = this._deckCardCount(deck);
    const resident = !!this._cardsOf(deck);
    const prep = Math.min((this.prep && this.prep[h.key]) || 0, ncards);
    const r = document.createElement("div");
    // journey handles: the pane's roll history is a first-class surface (it is what the pane IS)
    r.setAttribute("data-hist", h.key);
    r.setAttribute("data-hist-actor", h.actor || "");
    if (isCurrent) r.setAttribute("data-hist-current", "1");
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
        if (!built) {
          built = true;
          detail.appendChild(ncards && resident ? this._miniDeck(h.key, deck, isCurrent, rid) : this._miniDeckEmpty(h));
          // authored but not here yet: this click IS the request for it (and, after a dropped
          // chunk, the retry). Swap the placeholder for the real card when it lands.
          if (ncards && !resident) {
            this.hydrateDeck(h.key).then(() => {
              if (!this._cardsOf(this.flashcards.decks[h.key]) || detail.style.display === "none") return;
              detail.innerHTML = "";
              detail.appendChild(this._miniDeck(h.key, decks[h.key], isCurrent, rid));
            });
          }
        }
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
        const lbl = isCurrent ? (this.paused ? "Resume roll" : "Pause roll") : ("Roll from " + (h.name || "this position") + ", " + ((h.role || "Top").toLowerCase()));
        play.title = lbl;
        play.setAttribute("aria-label", lbl);   // a title is not an accessible name (v1.106.5)
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
        // ...ON THE SIDE THIS ROW WAS PLAYED FROM (v1.106.5). Without the override
        // `rollFromPosition` derives the role from the node TITLE, and every position hub is
        // titled "… Top" in the visual layer — so rolling from a Bottom row put you on top, in
        // the one place in the app that knows exactly which side you were on.
        this.rollFromPosition(ni >= 0 ? ni : this.currentPos, false, (h.role || "").toLowerCase() === "bottom" ? "bottom" : "top");
        // AND GET OUT OF THE WAY (v1.104.5, owner: pressing this "didnt open the MC nor position
        // the graph"). It did both — behind the pane. An open pane pauses the roll (pane law) and
        // since v1.101.7 stands the landing card down at EVERY width, so the card, its question
        // and the film strip were built, framed and immediately hidden by the surface the button
        // lives on. Pane law forbids the ROLL LOOP opening or closing the pane; this is the USER
        // pressing play, which is precisely the "close = the game resumes" half of the same law.
        this.setDeckOpen(false);
      });
      if (this._openRow === rid) openD();
    }
    r.addEventListener("mouseenter", () => r.style.background = "rgba(255,255,255,.03)");
    r.addEventListener("mouseleave", () => r.style.background = "transparent");
    box.appendChild(r); box.appendChild(detail);
    return box;
  }
  _miniDeck(key, deck, isCurrent, rid) {
    const cards = this._cardsOf(deck) || [], total = cards.length; // caller gates on ncards; belt AND braces
    this._deckState = this._deckState || {};
    const st = this._deckState[key] || (this._deckState[key] = { idx: 0, revealed: false });
    if (st.idx >= total) st.idx = 0;
    this._answered = this._answered || {};
    const ansSet = this._answered[key] || (this._answered[key] = new Set());
    // per-card GRADED latch (session-scoped, like ansSet): render() rebuilds innerHTML wholesale,
    // so without it the grade buttons would be re-clickable — six Got-its = six interval rungs.
    this._miniGraded = this._miniGraded || {};
    const gradedSet = this._miniGraded[key] || (this._miniGraded[key] = new Set());
    this.prep = this.prep || {};
    const wrap = document.createElement("div");
    if (isCurrent) wrap.className = "ngCurExpire";
    wrap.setAttribute("data-mini-deck", key); // the pane's Q&A card: question, reveal, answer — never MC
    wrap.style.cssText = "padding:0 8px 12px 26px;animation:ngCardIn .26s cubic-bezier(.2,.7,.2,1) both;";
    const navBtn = (cls, d) => '<button class="' + cls + '" style="flex:none;width:42px;height:36px;cursor:pointer;border:1px solid rgba(150,170,210,.2);border-radius:9px;background:rgba(255,255,255,.03);color:#aab4c8;display:flex;align-items:center;justify-content:center;transition:background .12s,color .12s;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"></path></svg></button>';
    const doPrev = () => { st.idx = (st.idx - 1 + total) % total; st.revealed = false; render(); };
    const doNext = () => { st.idx = (st.idx + 1) % total; st.revealed = false; render(); };
    const doReveal = () => {
      st.revealed = !st.revealed;
      if (st.revealed) { ansSet.add(st.idx); this.noteCardSeen(key, st.idx); } // reveal = SEEN only; mastery credit requires grading (honest economy)
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
        '<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:0 0 8px 3px;">' + tabs + '</div>' +
        '<div style="border:1px solid rgba(120,150,255,.2);border-radius:11px;background:linear-gradient(160deg,rgba(32,40,68,.55),rgba(13,16,30,.6));padding:14px 15px 13px;box-shadow:0 6px 18px rgba(0,0,0,.2);">' +
          // scope chip: only on higher-tier (general) cards blended in — names the position/family
          // the card is about, so it reads as a concept rather than a state:role-specific detail.
          (card.tag ? '<div style="display:inline-block;font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;color:#9ab0e0;background:rgba(90,140,255,.13);border:1px solid rgba(120,150,255,.26);border-radius:999px;padding:2px 8px;margin-bottom:9px;">' + card.tag + '</div>' : '') +
          '<div data-mini-q="1" style="font-size:13px;line-height:1.5;color:#e3e9f4;font-weight:500;">' + (card.q || card.front || "") + '</div>' +
        '</div>' +
        (st.revealed ? '<div data-mini-a="1" style="margin-top:8px;border:1px solid rgba(110,214,160,.28);border-radius:11px;background:rgba(20,38,30,.42);padding:13px 15px;font-size:12.5px;line-height:1.6;color:#bfe6cf;animation:ngCardIn .22s ease both;">' + (card.a || card.back || "") + '</div>' : '') +
        (st.revealed && !gradedSet.has(st.idx)
          ? '<div style="display:flex;gap:7px;margin-top:8px;"><button data-mini-again="1" style="flex:1;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:700;padding:9px;border-radius:9px;border:1px solid rgba(232,150,107,.4);background:rgba(232,150,107,.12);color:#f0c4ad;">Review again</button><button data-mini-got="1" style="flex:1;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:700;padding:9px;border-radius:9px;border:1px solid rgba(110,214,160,.4);background:rgba(110,214,160,.13);color:#bfe6cf;">Got it</button></div>'
          : (st.revealed ? '<div data-mini-graded="1" style="margin-top:8px;font-size:10.5px;color:#7e8aa3;text-align:center;">Graded \u2014 next card \u2192</div>' : '')) +
        '<div style="display:flex;gap:7px;margin-top:9px;">' +
          navBtn("mp", "M15 18l-6-6 6-6") +
          '<button class="mr" data-mini-reveal="1" style="flex:1;cursor:pointer;border:1px solid rgba(120,150,255,.4);border-radius:9px;background:rgba(74,108,255,.16);color:#dbe6ff;font-family:inherit;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:7px;transition:background .12s;">' + (st.revealed ? "Hide answer" : "Reveal") + '<kbd style="font-family:inherit;font-size:9px;font-weight:700;opacity:.55;border:1px solid currentColor;border-radius:4px;padding:1px 6px;letter-spacing:.04em;">space</kbd></button>' +
          navBtn("mn", "M9 18l6-6-6-6") +
        '</div>';
      const mp = wrap.querySelector(".mp"), mn = wrap.querySelector(".mn"), mr = wrap.querySelector(".mr");
      const navHov = (b, on) => { b.style.background = on ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.03)"; b.style.color = on ? "#dfe6f2" : "#aab4c8"; };
      mp.onmouseenter = () => navHov(mp, true); mp.onmouseleave = () => navHov(mp, false);
      mn.onmouseenter = () => navHov(mn, true); mn.onmouseleave = () => navHov(mn, false);
      mr.onmouseenter = () => mr.style.background = "rgba(74,108,255,.28)";
      mr.onmouseleave = () => mr.style.background = "rgba(74,108,255,.16)";
      mp.onclick = doPrev; mn.onclick = doNext; mr.onclick = doReveal;
      // GRADING IN PLACE (v1.105.2): reveal stays SEEN-only; these are the credit, through the
      // same gradeRecall choke as every surface — lesson evidence, prep, stage and the SRS
      // schedule all flow. One grade per card per session (the latch above).
      const gb = wrap.querySelector("[data-mini-got]"), ab = wrap.querySelector("[data-mini-again]");
      const gradeMini = (ok) => {
        if (gradedSet.has(st.idx)) return;
        gradedSet.add(st.idx);
        ansSet.add(st.idx);
        this.gradeRecall(key, cards[st.idx], ok);
        if (ok) doNext(); else render();               // a miss stays put for a re-read
      };
      if (gb) gb.onclick = () => gradeMini(true);
      if (ab) ab.onclick = () => gradeMini(false);
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
    // Three different truths used to render as one sentence about authoring. A deck whose cards
    // are on the way, and a deck whose chunk did not arrive, are NOT "being authored".
    const st = this.deckStatus(h && h.key);
    if (st === "pending" || st === "loading" || st === "failed") {
      const n = this._deckCardCount(((this.flashcards && this.flashcards.decks) || {})[h.key]);
      const failed = st === "failed";
      wrap.setAttribute("data-mini-deck-state", st);
      wrap.innerHTML =
        '<div style="position:relative;border:1px dashed rgba(150,170,210,.22);border-radius:11px;background:linear-gradient(160deg,rgba(28,33,52,.4),rgba(13,16,30,.45));padding:20px 16px;">' +
          '<div style="font-size:12.5px;font-weight:600;color:#aab4c8;line-height:1.45;">' +
            (failed ? "Couldn’t load these cards" : "Loading " + n + (n === 1 ? " card" : " cards") + "…") + '</div>' +
          '<div style="margin-top:5px;font-size:11.5px;color:#6b7691;line-height:1.5;">' +
            (failed
              ? "Your connection dropped mid-download. Nothing is lost — close and reopen this row to try again."
              : "This state’s deck is on its way. Your progress on it is already counted.") + '</div>' +
        '</div>';
      return wrap;
    }
    wrap.innerHTML =
      '<div style="position:relative;border:1px dashed rgba(150,170,210,.22);border-radius:11px;background:linear-gradient(160deg,rgba(28,33,52,.4),rgba(13,16,30,.45));padding:20px 16px;overflow:hidden;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="rgba(150,170,210,.07)" stroke-width="1.4" style="position:absolute;right:-10px;bottom:-14px;width:84px;height:84px;pointer-events:none;"><rect x="3" y="4" width="18" height="14" rx="2"></rect><path d="M3 9h18M8 14h2"></path></svg>' +
        '<div style="position:relative;font-size:12.5px;font-weight:600;color:#aab4c8;line-height:1.45;">Flashcards in the works</div>' +
        '<div style="position:relative;margin-top:5px;font-size:11.5px;color:#6b7691;line-height:1.5;">This state\u2019s deck is being authored on <span style="color:#8b97b0;">bjjgraph.org</span>. Drilling it will raise your odds here soon.</div>' +
      '</div>';
    return wrap;
  }
  /**
   * A PANE CONTROL: 24px glyph, grown hit area, states in CSS (v1.106.5). The house pattern is
   * `.ng-lists-new`'s \u2014 the glyph is small because the pane's control figure is 24 (WCAG 2.2 AA
   * 2.5.8; 44 is the thumb figure and belongs to the surfaces you hit mid-roll) and the hit area
   * grows past it with padding + a matching negative margin, so a row does not get taller. Hover /
   * active / focus-visible live in `helmet.html` beside `.ng-anchor-*`, never as JS hover painting:
   * a `mouseenter` handler cannot express `:focus-visible` and leaves keyboard users unlit.
   */
  _histCtl(glyph, label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ng-histctl";
    b.setAttribute("aria-label", label);   // a title is not an accessible name
    b.title = label;
    b.innerHTML = glyph;
    b.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); onClick(); });
    return b;
  }
  _pastRollRow(roll, decks) {
    const log = roll.log || [];
    const start = log[0], end = log[log.length - 1];
    const oc = { win: { c: "#7ee0a8", t: "won" }, lose: { c: "#e8889e", t: "tapped" }, reset: { c: "#7e8aa3", t: "reset" } }[roll.outcome] || { c: "#7e8aa3", t: "ended" };
    const box = document.createElement("div");
    box.style.cssText = "margin:0 -8px;";
    const r = document.createElement("div");
    r.setAttribute("data-past-roll", String(roll.ts));
    r.style.cssText = "display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:8px;cursor:pointer;transition:background .12s;";
    const label = this.replayLabel(roll);
    r.innerHTML =
      '<span style="flex:none;width:8px;height:8px;border-radius:50%;background:' + oc.c + ';box-shadow:0 0 6px ' + oc.c + '55;"></span>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:12.5px;font-weight:600;color:#c2cce0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (start ? start.name : "?") + ' <span style="color:#5d6883;">\u2192</span> ' + (end ? end.name : "?") + '</div>' +
        '<div style="font-size:9.5px;color:#6b7691;font-weight:600;letter-spacing:.02em;">' + log.length + ' states \u00b7 ' + oc.t + ' \u00b7 ' + this._agoLabel(roll.ts) + '</div>' +
      '</div>';
    // \u2500\u2500 THE ROW'S TWO QUIET CONTROLS (v1.106.5, owner: "a play from here and a replay button") \u2500\u2500
    // They are 12px apart, the same miss-distance a list row keeps between Share and Delete: these
    // two do DIFFERENT things to the same roll (one starts a NEW roll and archives the one you are
    // in, the other only shows you a recording) and a mis-tap between them is the one mistake this
    // row can make. \u25b6 first, because it is the verb every other row in the app already carries.
    const ctls = document.createElement("div");
    // 20, to buy 12. A `.ng-histctl` paints a 32px hit box and pulls it back to a 24px layout box
    // with `margin:-4px`, and flex `gap` measures between MARGIN boxes — so a 12px gap here would
    // leave the two hit areas 4px apart, which is not the miss-distance that was asked for. What
    // matters is the distance between the things a thumb can actually hit.
    ctls.style.cssText = "flex:none;display:flex;align-items:center;gap:20px;";
    const startIdx = start && start.idx != null ? start.idx : -1;
    let playBtn = null;
    if (startIdx >= 0 && this.nodes[startIdx]) {
      // Roll from where this roll STARTED \u2014 with the side you actually played it from. Every
      // position hub is titled "\u2026 Top" in the visual layer, so a role derived from the title is
      // the constant `top`; the log recorded the real one (v1.82.3's rule, and why playFrom takes
      // a role at all). `confirmPlayFrom` asks first \u2014 pressing this discards the roll you are in.
      const role = (start.role || "").toLowerCase() === "bottom" ? "bottom" : "top";
      playBtn = this._histCtl(
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>',
        "Roll from " + (start.name || "this position") + ", " + role,
        () => this.confirmPlayFrom(this.nodes[startIdx], {
          role: role,
          staged: true,   // ROAM & STAGE: land there, deal the hand, HOLD the clock
          go: (idx, r) => {
            this._openLatestOnLand = true;
            this.rollFromPosition(idx, true, r);
            this._staged = this.currentPos;
            this.fx("roll_staged", { position: this.nodes[this.currentPos] ? this.nodes[this.currentPos].t : null });
            // ...AND GET OUT OF THE WAY, exactly like the per-state ▶ below (v1.104.5): the pane
            // stands the landing card down at every width, so setting a board the user cannot see
            // is the same defect that button was fixed for. Pane law forbids the ROLL LOOP closing
            // the pane; this is the USER pressing play.
            this.setDeckOpen(false);
          },
        }),
      );
      playBtn.setAttribute("data-roll-from", String(roll.ts));
      ctls.appendChild(playBtn);
    }
    const playing = !!(this._replay && this._replay.id === roll.ts);
    const rep = this._histCtl(
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path></svg>',
      playing ? "Stop replaying " + label : "Replay " + label,
      () => { if (this._replay && this._replay.id === roll.ts) this.stopReplay("stopped"); else this.startReplay(roll); },
    );
    rep.setAttribute("data-replay-roll", String(roll.ts));
    rep.setAttribute("aria-pressed", playing ? "true" : "false");
    if (playing) rep.setAttribute("data-replaying", "1");
    ctls.appendChild(rep);
    r.appendChild(ctls);
    const chev = document.createElement("span");
    chev.className = "pchev";
    chev.style.cssText = "flex:none;color:#5d6883;font-size:14px;margin-left:10px;transition:transform .18s;";
    chev.textContent = "\u203a";
    r.appendChild(chev);
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
      return;
    }
    // Nothing rolled yet THIS SESSION (rollLog/_pastRolls are in-memory — roll history has
    // never persisted across reloads). A bare void here read as "my history got deleted"
    // after the v1.95 stats move stripped the tab's only other furniture (owner) — so the
    // empty case explains itself.
    const empty = document.createElement("div");
    empty.setAttribute("data-hist-empty", "1");
    empty.style.cssText = "padding:18px 8px;font-size:12.5px;line-height:1.55;color:#7e8aa3;";
    empty.textContent = "No rolls yet — press play and your roll shows up here, state by state.";
    list.appendChild(empty);
  }
  openModal() { const m = this.modalRef.current; if (m) m.style.display = "flex"; this.lastInteract = this.now; }
  /**
   * FEEDBACK GOES TO POSTHOG (v1.105.5, owner: "using post hoc. It should not be done using
   * GitHub"). One small modal for both kinds; submit is a plain `track()` capture with the text
   * as a property — PostHog-native collection, no new backend. The auth form is the styling
   * prior art. A quiet "no personal info" hint keeps track()'s no-PII convention honest.
   */
  openFeedback(kind) {
    const card = this.modalCardRef.current; if (!card) return;
    card.style.width = "min(440px,92vw)";
    card.innerHTML = "";
    const isTech = kind === "technique";
    const head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:16px 20px 0;";
    head.innerHTML = '<div style="font-size:16px;font-weight:700;color:#eef1f6;font-family:\'Space Grotesk\',sans-serif;">' + (isTech ? "Request a technique" : "Report an issue") + '</div><span class="x" style="cursor:pointer;color:#8b97b0;font-size:21px;line-height:1;">\u00d7</span>';
    head.querySelector(".x").addEventListener("click", () => this.closeModal());
    card.appendChild(head);
    const body = document.createElement("div");
    body.style.cssText = "padding:12px 20px 20px;display:flex;flex-direction:column;gap:10px;";
    const ta = document.createElement("textarea");
    ta.setAttribute("data-feedback-text", "1");
    ta.maxLength = 500;
    ta.placeholder = isTech ? "Which technique is missing? A name is enough \u2014 a position it starts from helps." : "What went wrong, and where were you when it did?";
    ta.style.cssText = "width:100%;min-height:110px;resize:vertical;font-family:inherit;font-size:14px;line-height:1.5;color:#eef1f6;background:rgba(255,255,255,.04);border:1px solid rgba(150,170,210,.25);border-radius:11px;padding:12px 14px;box-sizing:border-box;outline:none;";
    body.appendChild(ta);
    // context rides along unless removed — names the state the report is about
    const node = this.nodes && this.nodes[this.currentPos];
    let ctxOn = !!node;
    if (node) {
      const ctx = document.createElement("label");
      ctx.style.cssText = "display:flex;align-items:center;gap:7px;font-size:11px;color:#8b97b0;cursor:pointer;";
      ctx.innerHTML = '<input type="checkbox" checked data-feedback-ctx="1" style="accent-color:#4a6cff;"> about: ' + this.splitName(node.t).main;
      ctx.querySelector("input").addEventListener("change", (e) => { ctxOn = e.target.checked; });
      body.appendChild(ctx);
    }
    const hint = document.createElement("div");
    hint.style.cssText = "font-size:10px;color:#5d6883;";
    hint.textContent = "Please don\u2019t include personal information.";
    body.appendChild(hint);
    const btn = document.createElement("button");
    btn.setAttribute("data-feedback-send", "1");
    btn.textContent = "Send";
    btn.style.cssText = "cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;padding:12px;border-radius:11px;border:none;background:linear-gradient(135deg,#4a6cff,#6a5cff);color:#fff;";
    btn.addEventListener("click", () => {
      const text = (ta.value || "").trim();
      if (!text) { ta.focus(); return; }
      this.track(isTech ? "neural_technique_requested" : "neural_issue_reported", {
        text: text.slice(0, 500),
        node: ctxOn && node ? node.id : null,
        app_version: (typeof NG_APP_VERSION !== "undefined" ? NG_APP_VERSION : null),
      });
      this.closeModal();
      this.setEvent("Sent \u2014 thank you", isTech ? "We read every request" : "We read every report", "good");
    });
    body.appendChild(btn);
    card.appendChild(body);
    this.openModal();
    ta.focus();
  }
  /** GitHub star chip: lazy (first pane open, never boot), day-cached, and NEVER throwing —
   *  the harness aborts non-localhost fetches and at least one spec collects pageerror. */
  _refreshGhChip() {
    const el = this.ghChipRef.current; if (!el || this._ghTried) return;
    this._ghTried = true;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem("gh-stars") || "null"); } catch (e) { /* fine */ }
    const paint = (n) => { const l = el.querySelector("[data-gh-label]"); if (l && typeof n === "number") l.textContent = "\u2605 " + (n >= 1000 ? (n / 1000).toFixed(1) + "k" : n); };
    if (cached && Date.now() - cached.at < 86400000) { paint(cached.n); return; }
    try {
      fetch("https://api.github.com/repos/diogoseca/bjjgraph")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j || typeof j.stargazers_count !== "number") return;
          paint(j.stargazers_count);
          try { localStorage.setItem("gh-stars", JSON.stringify({ n: j.stargazers_count, at: Date.now() })); } catch (e) { /* fine */ }
        })
        .catch(() => { /* plain link is the fallback state */ });
    } catch (e) { /* fetch unavailable — plain link */ }
  }
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
  // Esc seam (v1.95.1): close the topmost deliberate screen and report. Pause state is
  // deliberately NOT touched here — if the pane (or the user's hand) froze the clock,
  // dismissing a modal ABOVE it must not resume anything (the backdrop-click path keeps
  // its legacy resume; Esc is the pane-law-safe close).
  closeModalIfOpen() {
    const m = this.modalRef.current;
    if (!m || m.style.display !== "flex") return false;
    this.closeModal();
    return true;
  }

  expandOption(opt, onPick, srcCard) {
    const n = opt.node;
    const panel = this.optDetailRef.current; if (!panel) { onPick(opt); return; }
    this.setPaused(true);           // freeze time while the player reads/confirms
    this.fx("sheet_opened", { technique: (opt && opt.node && opt.node.t) || null });
    if (this._landEl) { this._landEl.style.opacity = "0"; this._landEl.style.pointerEvents = "none"; } // the sheet owns the screen while it is up
    // THE HEAD IS THE OPTION CARD, ENLARGED (v1.102.1) — so it shows the card's marks, not a
    // second set. Since v1.118.0 that means EDGE: the same value, from the same `edgeMark`, in the
    // same palette. A sheet is only ever opened from a non-escape option card, so `opt` is always
    // a move from the live hand and carries its deal-time `ev` row.
    const edge = this.edgeMark(opt);
    const col = edge ? edge.col : this.hex(this.myColor(n)), cat = this.deckCat(n); // role-correct, see buildOptionCard
    const pct = Math.round(this.moveChance(n) * 100);
    const oddsCol = pct >= 60 ? "#7ee0a8" : pct >= 38 ? "#cbd24e" : "#e8956b";
    const resName = opt.res >= 0 ? this.splitName(this.nodes[opt.res].t).main : "\u2014";
    const myMod = Math.round(this.stateBonus(this._posKey) * 100) + Math.round(this.stateBonus(this.deckKeyFor(n).key) * 100);
    const neighbors = this.adj[n.idx].filter((k) => this.nodes[k].ty === "positions").slice(0, 4).map((k) => this.splitName(this.nodes[k].t).main);
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
    const mPct = Math.round((this.mastery(this._posKey) + this.mastery(this.deckKeyFor(n).key)) * 100);
    const sPct = Math.round((this.sharpness(this._posKey) + this.sharpness(this.deckKeyFor(n).key)) * 100);
    const fPct = (this._filmLook && this._filmLook[n.t]) ? 4 : 0;
    const noteBits = [mPct ? mPct + "% mastered" : "", sPct ? sPct + "% sharp" : "", fPct ? "4% film study" : ""].filter(Boolean).join(" \u00b7 ");
    const drillNote = myMod + fPct > 0 ? '<div style="margin-top:11px;display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:#7ee0a8;"><b style="font-weight:700;">+' + (myMod + fPct) + '%</b><span style="color:#6f8a78;">' + noteBits + '</span></div>' : '';
    head.innerHTML =
      // TOP-RIGHT CORNER PAIR (v1.102.1), the same shape the game card uses: capture and dismiss
      // are both chrome ABOUT the sheet, so they sit together in its corner. Owner: "add to class
      // should rather not exist and the same + add icon that shows on current selected node
      // dialog should show top right next to x close icon" — the labelled footer button is gone.
      '<span data-sheet-corner="1" style="position:absolute;top:0;right:18px;z-index:3;display:flex;align-items:center;gap:2px;">' +
        '<span class="ng-sheet-cap"></span>' +
        '<span class="x" style="cursor:pointer;color:#9aa6bd;font-size:21px;line-height:1;width:26px;height:26px;display:flex;align-items:center;justify-content:center;">&times;</span>' +
      '</span>' +
      // NOT AT THE TOP (v1.102.1, owner: "play from here (as attacker / as defender) should show
      // not on top"). The head is identity — category, the from→to name, edge and success — and
      // the two ACTIONS moved down to sit with the other two, in the footer. A sheet whose first
      // row is a pair of controls reads as a toolbar; a sheet whose first row is a name reads as
      // a technique.
      // ── THE HEAD IS THE OPTION CARD, ENLARGED (v1.102.1) ──────────────────────────────────
      // Owner: "the choice expanded content should be the same thing as in the smaller version of
      // the choice card, so to improve visual continuity and coherence". So it takes the card's
      // exact three-part anatomy — glyph + CATEGORY with the potential opposite it, the name, then
      // a bordered success row — at sheet scale. The card you pressed grows into this; it does not
      // become a different object. The one thing the sheet adds is DETAIL: the name keeps its
      // from→to structure, and the success row carries the adjust control the card has no room for.
      // padding-right clears the corner pair (+ and ✕, ~56px) — the potential is right-aligned in
      // this same row and the two were drawing on top of each other ("+-30")
      '<div style="display:flex;align-items:center;gap:9px;margin-bottom:10px;padding-right:60px;">' + this.nodeGlyph(n.ty, col, 11) +
        '<span style="flex:1;min-width:0;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:#9fb0d8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (edge ? "Edge" : cat) + '</span>' +
        (edge
          ? '<span class="ngedgebig" style="flex:none;font-size:19px;font-weight:700;color:' + edge.col + ';font-family:\'Space Grotesk\',sans-serif;line-height:1;">' + edge.txt + '</span>'
          : '') +
      '</div>' +
      (tp
        ? '<div style="display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;font-family:\'Space Grotesk\',sans-serif;line-height:1.08;">' +
            '<span style="font-size:18px;font-weight:600;color:#8b97b0;">' + tp.from + '</span>' +
            '<span style="font-size:16px;color:#5d6a86;font-weight:600;">\u2192</span>' +
            '<span style="font-size:25px;font-weight:700;color:#eef1f6;letter-spacing:-.015em;">' + tp.to + '</span>' +
          '</div>'
        : '<div style="font-size:25px;font-weight:700;color:#eef1f6;letter-spacing:-.015em;line-height:1.05;font-family:\'Space Grotesk\',sans-serif;">' + sp.main + '</div>' +
          (sp.from ? '<div style="font-size:14px;color:#8b97b0;margin-top:3px;">' + sp.from + '</div>' : '')) +
      drillNote +
      // the card's own bottom row, at sheet scale: caption left, the number right
      '<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(150,170,210,.12);display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
        '<span style="font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#7e8aa3;">Success rate</span>' +
        '<span style="display:flex;align-items:center;gap:8px;">' + stepsSpan + editBtn +
          '<span class="ngsucbig" data-odds style="font-size:25px;font-weight:700;color:' + oddsCol + ';font-family:\'Space Grotesk\',sans-serif;line-height:1;">' + pct + '%</span>' +
        '</span>' +
      '</div>' +
      '</div>' +
      (cat === "Submission"
        ? ''
        : (!tp && resName !== "\u2014" ? '<div style="margin-top:13px;font-size:12px;color:#8b97b0;display:flex;align-items:center;gap:6px;"><span style="color:#7ee0a8;">\u2192</span>on success, advances to <b style="color:#c3cde0;font-weight:600;">' + this.splitName(resName).main + '</b></div>' : ''));
    const scroller = document.createElement("div");
    scroller.style.cssText = "flex:1;min-height:0;overflow-y:auto;";
    scroller.appendChild(head);
    // ── JIT micro-drill: drill the exact cards for THIS decision, right here. Every graded
    // card pumps the odds (+6%) and refunds decision time (+2.5s, cap 2) — knowledge is tempo. ──
    {
      const decks = (this.flashcards && this.flashcards.decks) || {};
      const tk = this.deckKeyFor(n).key;
      // _deckHasCards is stub-safe, so an unhydrated deck yields no jitKey and the whole JIT
      // block is skipped — exactly what already happens when the deck is missing.
      const jitKey = this._deckHasCards(tk) ? tk : (this._deckHasCards(this._posKey) ? this._posKey : null);
      if (jitKey) {
        const jc = this._cardsOf(decks[jitKey]);
        let jitGrades = 0;
        this._jitIdx = this._jitIdx || {};
        const jit = document.createElement("div");
        jit.setAttribute("data-jit", "1");
        jit.style.cssText = "margin:10px 26px 4px;padding:12px 14px;border:1px solid rgba(126,224,168,.22);border-radius:12px;background:rgba(22,38,30,.35);";
        const renderJit = () => {
          const idx = (this._jitIdx[jitKey] || 0) % jc.length;
          const card = jc[idx];
          jit.innerHTML =
            '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:7px;">' +
              '<span style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#7ee0a8;">Drill it \u2014 earn odds & time</span>' +
              '<span style="font-size:10px;color:#6f8a78;">+10% now \u00b7 +3% forever \u00b7 +2.5s</span></div>' +
            '<div style="font-size:12.5px;line-height:1.5;color:#dbe8df;">' + card.q + '</div>' +
            '<div class="jitAns" style="display:none;margin-top:8px;font-size:12px;line-height:1.55;color:#a9cdb6;border-top:1px solid rgba(126,224,168,.15);padding-top:8px;">' + card.a + '</div>' +
            '<div style="display:flex;gap:8px;margin-top:10px;">' +
              '<button data-jit-reveal style="flex:1;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;padding:9px;border-radius:9px;border:1px solid rgba(126,224,168,.35);background:rgba(126,224,168,.12);color:#bfe6cf;">Reveal answer</button>' +
              '<button data-jit-got style="display:none;flex:1;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;padding:9px;border-radius:9px;border:none;background:linear-gradient(135deg,#2f9e6a,#207a55);color:#eafff3;">Got it \u2192 pump the odds</button>' +
            '</div>';
          const rv = jit.querySelector("[data-jit-reveal]"), gt = jit.querySelector("[data-jit-got]");
          rv.addEventListener("click", (ev) => { ev.stopPropagation(); jit.querySelector(".jitAns").style.display = "block"; rv.style.display = "none"; gt.style.display = "block"; });
          gt.addEventListener("click", (ev) => {
            ev.stopPropagation();
            this.prep[jitKey] = (this.prep[jitKey] || 0) + 1;
            this.noteCardDone(card, jitKey);          // credit + bonus_pumped beat + persistence
            this.refundDecision(2500);                 // knowledge is tempo
            this._pumpOdds(panel, n);                  // the Odds Pump — odometer + spring
            this._jitIdx[jitKey] = idx + 1;
            renderJit();
            jitGrades++; if (jitGrades >= 2) this.setBeacon("execute", go); // bonus banked — commit is the next thing
          });
        };
        renderJit();
        scroller.appendChild(jit);
        this.fx("jit_opened", { deck_key: jitKey });
      }
    }
    const body = document.createElement("div");
    body.style.cssText = "padding:18px 26px 48px;";
    const renderBody = () => { this.clearClipLoops(); body.innerHTML = this.detailHTML(n, cat, neighbors, this._perspective); this.wireClips(body, this._curClips); };
    renderBody();
    scroller.appendChild(body);
    // film-first: auto-open the first Short (muted) once the sheet settles — the film row is
    // the sheet's hero now that the clip corpus is triaged. Journeys drive watchShort()
    // explicitly instead (a surprise auto-playing player would poison determinism).
    if (this._curClips && this._curClips.length && !this.isTest()) {
      const fi = this._curClips.findIndex((c) => c.vertical);
      setTimeout(() => { if (!this.__ngDestroyed && this._detailCtx && this._detailCtx.opt === opt) this.watchShort(fi < 0 ? 0 : fi); }, 420);
    }
    panel.appendChild(scroller);
    const foot = document.createElement("div");
    foot.style.cssText = "flex:none;display:flex;gap:11px;padding:16px 26px 20px;border-top:1px solid rgba(150,170,210,.1);";
    const back = document.createElement("button");
    back.innerHTML = 'Back <kbd style="font-family:inherit;font-size:10px;font-weight:700;opacity:.6;margin-left:4px;border:1px solid currentColor;border-radius:4px;padding:0 4px;">Esc</kbd>';
    back.style.cssText = "cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:600;padding:12px 18px;border-radius:11px;border:1px solid rgba(150,170,210,.25);background:rgba(255,255,255,.04);color:#c3cde0;display:flex;align-items:center;";
    const go = document.createElement("button");
    go.setAttribute("data-go", "1"); // journey tests confirm the commit via this button
    go.innerHTML = (cat === "Submission" ? "Go for the " + sp.main : "Execute this move") + ' <kbd style="font-family:inherit;font-size:10px;font-weight:700;opacity:.7;margin-left:7px;border:1px solid rgba(255,255,255,.5);border-radius:4px;padding:0 5px;">\u23ce</kbd>';
    go.style.cssText = "flex:1;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:700;padding:12px;border-radius:11px;border:none;background:linear-gradient(135deg,#4a6cff,#6a5cff);color:#fff;box-shadow:0 4px 16px rgba(74,108,255,.35);display:flex;align-items:center;justify-content:center;";
    // the same capture, with room for a label: this sheet is what a coach reads BEFORE committing,
    // and on a phone it is a full-width surface where a 44px target actually fits.
    // the compact glyph, in the corner — NOT a labelled footer button any more (v1.102.1)
    const capture = this._listAddButton(n.id, "sheet");
    capture.style.border = "none"; capture.style.background = "none"; capture.style.fontSize = "16px";
    const capSlot = head.querySelector(".ng-sheet-cap");
    if (capSlot && capSlot.parentNode) capSlot.parentNode.replaceChild(capture, capSlot);
    back.addEventListener("click", () => this.closeOptionDetail());
    head.querySelector(".x").addEventListener("click", () => this.closeOptionDetail());
    // perspective tab — re-render the body for attacker / defender and restyle the segmented control
    { const bdn = head.querySelector(".ng-bsuc-dn"), bup = head.querySelector(".ng-bsuc-up"), bsvAll = head.querySelectorAll(".ngsucbig"), bedit = head.querySelector(".ng-bsuc-edit"), bsteps = head.querySelector(".ng-bsuc-steps");
      // the stepper moves the odds, so it moves the EDGE — here and on the small card behind it,
      // from the one `edgeMark`, or the sheet would contradict the card it grew out of
      const bedge = head.querySelector(".ngedgebig");
      const bupd = () => { const p = Math.round(this.moveChance(n) * 100); const c = p >= 60 ? "#7ee0a8" : p >= 38 ? "#cbd24e" : "#e8956b"; bsvAll.forEach((el) => { el.textContent = p + "%"; el.style.color = c; }); const e2 = this.edgeMark(opt); if (bedge && e2) { bedge.textContent = e2.txt; bedge.style.color = e2.col; } this.refreshOptionOdds(); };
      if (bedit) bedit.addEventListener("click", (e) => { e.stopPropagation(); bedit.style.display = "none"; if (bsteps) { bsteps.style.display = "flex"; requestAnimationFrame(() => bsteps.style.opacity = "1"); } });
      if (bdn) bdn.addEventListener("click", (e) => { e.stopPropagation(); this.bumpCardSuccess(n, -1); bupd(); });
      if (bup) bup.addEventListener("click", (e) => { e.stopPropagation(); this.bumpCardSuccess(n, 1); bupd(); }); }
    go.addEventListener("click", () => { this._detailCtx = null; this.hideOptDetail(); this.setPaused(false); onPick(opt); });
    // the two actions lifted out of the head (v1.102.1) land here, on their own row above the
    // primary pair — grouped with the other things you can DO, not stacked over the name
    if (hasPersp || true) {
      const actions = document.createElement("div");
      actions.setAttribute("data-sheet-actions", "1");
      actions.style.cssText = "flex:1 0 100%;display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:2px;";
      actions.innerHTML =
        (hasPersp ? '<div class="ng-persp" style="display:inline-flex;background:rgba(255,255,255,.05);border:1px solid rgba(150,170,210,.16);border-radius:999px;padding:3px;gap:2px;">' + ptBtn("attacker", "Attacker") + ptBtn("defender", "Defend") + '</div>' : '') +
        '<button class="ng-playfrom" title="Start a fresh roll from this state" style="cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#bcd0ff;padding:5px 12px 5px 11px;border-radius:999px;border:1px solid rgba(124,156,255,.3);background:rgba(74,108,255,.12);transition:background .15s;"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>Play from here</button>';
      foot.style.flexWrap = "wrap";
      foot.appendChild(actions);
    }
    // wired AFTER the actions row is in the footer — these two controls moved there in
    // v1.102.1 and a query against `head` would now find nothing at all
    foot.querySelectorAll(".ng-pt").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const p = b.getAttribute("data-p"); if (p === this._perspective) return;
      this._perspective = p;
      foot.querySelectorAll(".ng-pt").forEach((x) => { const on = x.getAttribute("data-p") === p; x.style.background = on ? "rgba(255,255,255,.92)" : "transparent"; x.style.color = on ? "#10131c" : "#aeb9d4"; });
      renderBody();
    }));
    { const pf = foot.querySelector(".ng-playfrom"); if (pf) { pf.addEventListener("mouseenter", () => pf.style.background = "rgba(74,108,255,.22)"); pf.addEventListener("mouseleave", () => pf.style.background = "rgba(74,108,255,.12)"); pf.addEventListener("click", (e) => { e.stopPropagation(); this.confirmPlayFrom(n); }); } }
    foot.appendChild(back); foot.appendChild(go);
    panel.appendChild(foot);
    // beat beacon hands into the sheet: the drill first (odds are pumpable) — else straight to Execute
    { const jitEl = panel.querySelector("[data-jit]"); this.setBeacon(jitEl ? "jit" : "execute", jitEl || go); }
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
      const sbW = (this.uiShift || 0) * this.sbOffset();            // open sidebar overlays the graph from the LEFT (v1.94.0)
      const pcx = opr.left + sbW + (opr.width - sbW) / 2;       // centre of the VISIBLE graph, not the full play area
      const centerLeft = Math.round(sbW + (opr.width - sbW - W) / 2);
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
    const sbW = (this.uiShift || 0) * this.sbOffset();                    // open sidebar overlays the graph from the LEFT (v1.94.0)
    const pcx = opr.left + sbW + (opr.width - sbW) / 2;            // centre of the VISIBLE graph (shifts right when sidebar open)
    const centerLeft = Math.round(sbW + (opr.width - sbW - W) / 2);
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
    if (this._landEl) { this._landEl.style.opacity = ""; this._landEl.style.pointerEvents = ""; } // the landing card comes back when the sheet leaves
    const panel = this.optDetailRef.current;
    if (panel) { panel.style.transition = "opacity .2s ease, transform .26s ease"; panel.style.transform = "translateY(16px)"; panel.style.opacity = "0"; panel.style.pointerEvents = "none"; panel.onwheel = null; setTimeout(() => { if (panel.style.opacity === "0") panel.style.transform = "none"; }, 280); }
    if (this._detailSrc) { this._detailSrc.style.opacity = ""; this._detailSrc = null; }
  }
  closeOptionDetail() {
    // the landing card comes back when the sheet leaves — here TOO, not only via hideOptDetail:
    // the animated collapse below (the normal ✕ / back path, taken whenever _optStart is set)
    // never called it, so peeking at an option and backing out left the card that says where you
    // are invisible for the rest of the turn. Found by the late-payload journey.
    if (this._landEl) { this._landEl.style.opacity = ""; this._landEl.style.pointerEvents = ""; }
    this._detailCtx = null;
    if (this._optPick && this._defendSub == null && this.optionsRef.current) this.setBeacon("options", this.optionsRef.current); // back to the hand
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
    // "system:<Systems/Slug>" — drill exactly the lit members, in the system's own order rather
    // than alphabetically, so the session walks the sequence the way the material teaches it.
    if (bucket.indexOf("system:") === 0) {
      const sys = (this.systems || []).find((x) => x.id === bucket.slice(7)); // this.systems IS the array
      if (!sys) { this._ensureSystems(); return []; }   // deferred payload — fetch and try again
      const seen = new Set();
      const out = [];
      const ordered = (Array.isArray(sys.glue) && sys.glue.length)
        ? sys.glue.reduce((acc, g) => acc.concat(g.nodes || []), [])
        : (sys.nodes || []);
      for (const id of ordered) {
        const i = this._idIndex ? this._idIndex.get(id) : null;
        if (i == null) continue;
        const k = this.deckKeyFor(this.nodes[i]).key;
        if (!decks[k] || seen.has(k)) continue;   // skip unauthored decks, never a dead session row
        seen.add(k);
        out.push(k);
      }
      return out;
    }
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
    if (bucket === "due") {
      // REAL now (v1.105.0). Deck keys holding >=1 due-and-unreviewed card, most overdue first.
      // Guests keep local schedules — the "once you have an account" promise in the old empty
      // copy was never a mechanism, and the schedule lives in the same local blob as everything.
      const today = this._epochDay();
      const over = new Map();
      for (const e of this.duePool()) {
        const m = this.srs[e.key][e.qh];
        const od = today - m[0];
        if (!over.has(e.key) || od > over.get(e.key)) over.set(e.key, od);
      }
      return [...over.keys()].filter((k) => decks[k]).sort((a, b) => over.get(b) - over.get(a));
    }
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
        (this._fbBucket === "due" ? "Nothing due right now. Answer cards anywhere \u2014 in a roll or a session \u2014 and they\u2019ll come back here on a spaced-repetition schedule when it\u2019s time to prove you still know them." :
         this._fbBucket === "explored" ? "States you land in during a roll show up here. Start rolling to populate it." :
         "Nothing here yet \u2014 drill some cards to fill this list.") + '</div>';
    } else {
      list.forEach((key) => {
        const fam = key.split("|")[0], role = key.split("|")[1] || "";
        const d = decks[key]; const cat = (d && d.cat) || "Position";
        const count = this._deckCountLabel(key);   // the manifest's `n`, not what has landed
        const prep = (this.prep || {})[key] || 0;
        const r = document.createElement("div");
        r.style.cssText = "display:flex;align-items:center;gap:11px;padding:11px 10px;border-radius:10px;cursor:pointer;transition:background .12s;";
        r.innerHTML =
          '<span style="width:9px;height:9px;border-radius:' + (cat === "Submission" ? "2px" : cat === "Transition" ? "2px" : "50%") + ';background:' + (catCol[cat] || "#9fb0d8") + ';flex:none;"></span>' +
          '<div style="flex:1;min-width:0;"><div style="font-size:13.5px;font-weight:600;color:#eef1f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + fam + '</div><div style="font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#7e8aa3;font-weight:600;margin-top:1px;">' + cat + ' \u00b7 ' + role + '</div></div>' +
          (prep > 0 ? '<span style="font-size:11px;font-weight:700;color:#7ee0a8;">\u2713 drilled</span>' : (count === "soon" || count === "retry" ? '<span style="font-size:11px;color:#69748f;">' + count + '</span>' : '<span style="font-size:11px;font-weight:600;color:#9ab0e0;">' + count + '</span>')) +
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
    // (same on-demand residency rule as studyFromSession: a study surface IS its cards)
    this._studyOpen = key;
    if (!this._deckResident(key)) this.hydrateDeck(key).then(() => this._restudy(key));
    this.drillEntries = [this._entryForKey(key, this._session && this._session.filter)];
    this._posKey = key; this.activeDrill = 0; this.deckIdx = 0; this.revealed = false;
    this.renderDrill(); this.deckReady = true; this.deckOpen = true; this.applyDeckVisibility();
  }
  /** Re-take the open study surface's card snapshot once `key`'s chunk has landed. */
  _restudy(key) {
    const e = this.drillEntries && this.drillEntries[this.activeDrill];
    if (!e || e.info.key !== key || e.cards || this.revealed) return;
    this.drillEntries[this.activeDrill] = this._entryForKey(key, e.info.filter); // keep the session filter
    this.renderDrill();
  }
  _entryForKey(key, filter) {
    const decks = (this.flashcards && this.flashcards.decks) || {};
    const fam = key.split("|")[0], role = key.split("|")[1] || "Top";
    const d = decks[key];
    // `|| "Position"` not `d ? d.cat : …` — an unhydrated stub is truthy but may carry no `cat`,
    // and renderDrill's no-cards branch does info.cat.toLowerCase(). Every authored deck has a
    // cat, so this is a no-op for hydrated decks and keeps a stub on the missing-deck path.
    const cat = (d && d.cat) || "Position";
    let c = this._cardsOf(d);
    // `filter` (v1.105.0): "due" narrows a session to the cards past due — maintenance sessions
    // show due cards ONLY. It is stored ON the entry (info.filter) because two sites rebuild an
    // open entry from nothing but the key when a chunk hydrates (:1647, _restudy) — without the
    // stored filter, a due-only session silently became a whole-deck session the moment its
    // payload landed, which is the NORMAL case since openSession hydrates on the way in.
    // Falls back to the whole deck if the filter empties (mid-session grades drain it).
    if (c && filter === "due") { const f = c.filter((x) => this._cardDue(key, x.q)); if (f.length) c = f; }
    return { info: { fam: fam, role: role, cat: cat, key: key, filter: filter || null }, cards: c ? c.slice() : null };
  }
  // fly the camera so a whole SET of nodes is in view — shared by session highlights and by
  // focus sets (Systems now, shareable Lists next), so every "here is your selection" flight
  // frames identically.
  frameNodes(idxs) {
    if (!idxs || !idxs.length || !this.nodes) return;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const i of idxs) { const n = this.nodes[i]; if (!n) continue; minx = Math.min(minx, n.x); maxx = Math.max(maxx, n.x); miny = Math.min(miny, n.y); maxy = Math.max(maxy, n.y); }
    if (minx > maxx) return;
    // FIT BOTH AXES. `vw` is the visible WIDTH; the visible height is vw * H/W. A phone is 390x844,
    // so a selection that is tall and narrow was framed on its width and hung off the top and
    // bottom of the screen — the same margin has to be asked for vertically or "framed" is a claim
    // about one axis only.
    const aspect = (this.H || 1) / (this.W || 1);
    const need = Math.max((maxx - minx) * 2.2, aspect > 0 ? ((maxy - miny) * 2.2) / aspect : 0);
    this.camTarget = { cx: (minx + maxx) / 2, cy: (miny + maxy) / 2, vw: Math.max(this.graphW * 0.4, need) };
    // …and TAKE THE CAMERA, or the flight above is a wish. See holdCamera().
    this.holdCamera();
  }
  // ══════════════════════════════════════════════════════════════════════════════════════
  // CAMERA OWNERSHIP — a focus flight gets a short LEASE on the camera.
  //
  // frameNodes() only ever wrote `camTarget`. It does not move anything: the render loop eases
  // the camera toward camTarget, and updateCamera()'s follow-cam REWRITES camTarget at the
  // current roll node on EVERY FRAME. So every "here is your selection" flight — a shared class
  // lighting up, a System lighting its members — was overwritten within one frame whenever a
  // roll was live. (It also set `lastInteract = 0` "to let the camera move", which did the
  // opposite: `userActiveNow()` is the ONE condition that suppresses the follow-cam, so zeroing
  // it handed the camera straight back to the roll.)
  //
  // Nobody saw it because on a desktop the arrival opened the pane, and an open pane pauses the
  // roll, and a paused roll suppresses the auto-retarget. The moment a phone arrival stopped
  // opening the pane (v1.81.3 — the terminal state on a phone is the LIT GRAPH) the follow-cam
  // won every time, and both the arrival flight and every later ◉ re-light died a beat after
  // they started.
  //
  // The lease, therefore, and its three rules:
  //   · IT EXPIRES (CAM_HOLD_SEC). The roll must get its camera back; a frozen camera is a worse
  //     bug than the one this fixes, and the 400ms pan-to-current-node behaviour has to survive.
  //   · A REAL PAN OR PINCH CANCELS IT. If the user takes the camera, we do not fight them.
  //   · IT IS RE-TAKEN, not queued: a second ◉ tap starts a fresh lease.
  // The roll's automatic camera writers yield while it is live; the roll's USER-driven ones
  // (roam to a node, "roll from here", opening a dossier) release it instead — asking to go
  // somewhere else is not a collision, it is a decision.
  // ══════════════════════════════════════════════════════════════════════════════════════
  holdCamera(sec) {
    // PENDING (-1) when the frame clock does not exist yet. A share arrival is decoded during
    // ingest, which can be before the first frame — and `this.now` is not a page-relative zero in
    // production (it is the rAF timestamp), so "0 + 7" could be a deadline already in the past on
    // a slow phone. Starting the lease on the first frame instead has no such origin to get wrong.
    const t = typeof this.now === "number" && isFinite(this.now) ? this.now : null;
    this._camHoldUntil = t == null ? -1 : t + (sec || this.camHoldSec);
    this._camHoldSecs = sec || this.camHoldSec;
    // remembered so an intro that is still flying can hand the flight over when it finishes,
    // instead of eating it (a share link is decoded at t=0, mid-intro, every time)
    const c = this.camTarget;
    this._camHoldTarget = c ? { cx: c.cx, cy: c.cy, vw: c.vw } : null;
  }
  camHeld() {
    if (this._camHoldUntil == null) return false;
    if (this._camHoldUntil === -1) return true; // taken before the clock existed; armed on the next frame
    return (this.now || 0) < this._camHoldUntil;
  }
  /** The user took the camera (pan/pinch/wheel) or asked to go elsewhere: drop the lease. */
  releaseCamera() { this._camHoldUntil = null; this._camHoldTarget = null; }
  // deck key -> the node that key belongs to. Built ONCE and cached, so it must not depend on live
  // state: a position collapses to a single node that answers to BOTH of its role keys, and both are
  // registered here rather than whichever side `deckKeyFor` reports for the state currently in play.
  // (Before v1.82.4 that reported "Top" for every position, so a `|Bottom` lesson key — 13 of them in
  // the curriculum — could never resolve to a node at all.)
  nodeForKey(key) {
    if (!this._keyNode) {
      this._keyNode = new Map();
      const put = (k, i) => { if (k && !this._keyNode.has(k)) this._keyNode.set(k, i); };
      for (const n of this.nodes) {
        if (n.ty === "positions") {
          const fam = this.posFamily(n.t);
          put(fam + "|Top", n.idx); put(fam + "|Bottom", n.idx);
        } else put(this.deckKeyFor(n).key, n.idx);
      }
    }
    return this._keyNode.has(key) ? this._keyNode.get(key) : -1;
  }
  openSession(bucket, label) {
    const keys = this.bucketTechniques(bucket);
    this.hydrateDecks(keys);   // a session is a queue of decks the user has already committed to
    // "due" sessions narrow every deck to its due cards (see _entryForKey); others are whole-deck
    this._session = { keys: keys, label: label, idx: 0, filter: bucket === "due" ? "due" : null };
    this._sessionNodes = keys.map((k) => this.nodeForKey(k)).filter((i) => i >= 0);
    this.closeModal();
    this.frameNodes(this._sessionNodes);   // frame the highlighted nodes
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
      const d = decks[key]; const cat = (d && d.cat) || "Position";
      const count = this._deckCountLabel(key, true);   // the manifest's `n`, not what has landed
      const done = (this.prep || {})[key] > 0;
      const r = document.createElement("div");
      r.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px 11px;border-radius:10px;cursor:pointer;border:1px solid " + (i === s.idx ? "rgba(150,180,255,.5)" : "rgba(150,170,210,.12)") + ";background:" + (i === s.idx ? "rgba(58,72,118,.5)" : "rgba(255,255,255,.025)") + ";margin-bottom:7px;";
      r.innerHTML =
        '<span style="width:9px;height:9px;border-radius:' + (cat === "Position" ? "50%" : "2px") + ';background:' + (catCol[cat] || "#9fb0d8") + ';flex:none;"></span>' +
        '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;color:#eef1f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + fam + '</div><div style="font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#7e8aa3;font-weight:600;margin-top:1px;">' + cat + ' \u00b7 ' + role + '</div></div>' +
        (done ? '<span style="color:#7ee0a8;font-size:12px;">\u2713</span>' : (count === "soon" || count === "retry" ? '<span style="font-size:10px;color:#69748f;">' + count + '</span>' : '<span style="font-size:10.5px;color:#9ab0e0;">' + count + '</span>'));
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
    // A study surface IS its cards, so if they are not here yet, fetch and rebuild when they
    // land. This cannot be left to _onDeckHydrated: when the deck is ALREADY in flight (the
    // warm sweep started it), its hydration event fires before this entry exists, so nothing
    // would ever refresh the snapshot and the surface would sit on "being authored" for good.
    this._studyOpen = key;
    if (!this._deckResident(key)) this.hydrateDeck(key).then(() => this._restudy(key));
    this.drillEntries = [this._entryForKey(key, this._session && this._session.filter)]; // due sessions stay due-only
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
      body.appendChild(this.settingRow("Answer mode", "How cards read back HERE. Questions asked in-roll are always multiple choice \u2014 this sidebar is the study surface, so it reads back as recall unless you say otherwise.",
        [["Classic recall", "classic"], ["Auto", "auto"], ["Multiple choice", "mc"]], "mcMode", "classic"));
      // TRAINING-DAY DIGEST (v1.105.7, Beta) — the opt-in that makes the email Worker see you.
      // Signed-in only: a digest without an address has nowhere to go. Default OFF; flipping it
      // on starts recording the per-day dayLog (see noteCardDone) which syncs in the blob.
      if (this.user) {
        const wrap = document.createElement("div");
        wrap.setAttribute("data-digest-setting", "1");
        wrap.appendChild(this.settingRow("Training-day email", "After a day you reviewed something: your techniques, your Game Knowledge, your streak \u2014 mailed to " + (this.user.email || "your account email") + ".",
          [["On", true], ["Off", false]], "emailDigest", false));
        const beta = document.createElement("span");
        beta.textContent = "Beta";
        beta.style.cssText = "position:relative;top:-44px;left:150px;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#9ab0e0;border:1px solid rgba(120,150,255,.35);border-radius:5px;padding:1px 6px;pointer-events:none;";
        wrap.style.position = "relative";
        wrap.appendChild(beta);
        body.appendChild(wrap);
      }
      // RECALL MODE — the black-belt badge's toggle (v1.105.1). LOCKED until the knowledge band
      // reaches black; auto-flipped ON when the badge mints; freely flippable back. When on, a
      // stage-2+ card in PLAY renders as reveal/self-grade instead of multiple choice.
      {
        const isBlack = (() => { try { return this.gameScore().belt === "black"; } catch (e) { return false; } })();
        const hasBadge = !!(this.badges && this.badges["recall-in-play"]);
        if (isBlack || hasBadge) {
          body.appendChild(this.settingRow("Recall mode (in play)", "The black-belt reward: proven cards stop being multiple choice mid-roll \u2014 question, reveal, self-grade.",
            [["On", true], ["Off", false]], "recallInPlay", false));
        } else {
          const locked = document.createElement("div");
          locked.setAttribute("data-recall-locked", "1");
          locked.style.cssText = "opacity:.55;padding:12px 0;border-top:1px solid rgba(150,170,210,.1);";
          locked.innerHTML = '<div style="font-size:13px;font-weight:600;color:#c3cde0;display:flex;align-items:center;gap:7px;">Recall mode (in play) <span style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#8b97b0;border:1px solid rgba(150,170,210,.3);border-radius:5px;padding:2px 6px;">Locked</span></div>' +
            '<div style="font-size:11px;color:#7e8aa3;margin-top:3px;line-height:1.5;">Unlocks at black belt \u2014 the elite format: no options, just the question and your memory.</div>';
          body.appendChild(locked);
        }
      }
      // (the dead "Study order" setting row was deleted in v1.105.0 — `studyOrder` was written but read nowhere; due-first is now BEHAVIOUR, not a preference)
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
      // uniform — the GI/NO-GI choice lives HERE and only here (v1.95.3, owner: the pane
      // tabs each carried a duplicate pill). Placement only: setGiMode is unchanged and
      // still re-filters techniques, lessons, checkpoints and odds everywhere.
      const gv = document.createElement("div");
      gv.style.cssText = "border-top:1px solid rgba(150,170,210,.12);padding-top:16px;margin-bottom:18px;";
      gv.innerHTML = '<div style="font-size:14px;font-weight:600;color:#eef1f6;">Uniform</div><div style="font-size:12.5px;color:#93a0bd;margin-top:4px;line-height:1.5;">Gi or no-gi. Filters which techniques, lessons and odds the whole app uses.</div>';
      const gseg = document.createElement("div");
      gseg.style.cssText = "display:flex;gap:9px;margin-top:12px;";
      gseg.setAttribute("data-settings-gi", "1");
      const giCur = this._giMode || "gi";
      gseg.appendChild(this.segBtn("Gi", giCur === "gi", false, () => { this.setGiMode("gi"); this.renderSettings(); }));
      gseg.appendChild(this.segBtn("No-gi", giCur === "nogi", false, () => { this.setGiMode("nogi"); this.renderSettings(); }));
      gv.appendChild(gseg);
      body.appendChild(gv);
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
      // landing questions — the in-roll quiz beat
      const lq = document.createElement("div");
      lq.style.cssText = "display:flex;align-items:flex-start;justify-content:space-between;gap:16px;border-top:1px solid rgba(150,170,210,.12);padding-top:16px;margin-bottom:18px;";
      lq.innerHTML = '<div><div style="font-size:14px;font-weight:600;color:#eef1f6;">Questions while you roll</div><div style="font-size:12.5px;color:#93a0bd;margin-top:4px;line-height:1.5;">Every state you land on asks one multiple-choice question (keys <b style="color:#c3cde0;">A–D</b>). Right answers raise that exchange’s odds and refund clock; wrong ones cost odds for that exchange only. String rights together across states to build <b style="color:#c3cde0;">combos</b> — momentum that heats your whole hand and makes counters fade. Wrong or ignored breaks it.</div></div>';
      const lqb = document.createElement("button");
      const lqOn = this.get("landQuestions", true);
      lqb.innerHTML = lqOn ? "✓" : "";
      lqb.style.cssText = "flex:none;margin-top:2px;width:24px;height:24px;border-radius:7px;cursor:pointer;border:1px solid " + (lqOn ? "rgba(110,160,255,.6)" : "rgba(150,170,210,.3)") + ";background:" + (lqOn ? "rgba(74,108,255,.4)" : "transparent") + ";color:#fff;font-size:13px;font-weight:700;";
      lqb.addEventListener("click", () => { this.set("landQuestions", !this.get("landQuestions", true)); this.renderSettings(); });
      lq.appendChild(lqb); body.appendChild(lq);
      // pinned challenge cue
      const tu = document.createElement("div");
      tu.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:16px;border-top:1px solid rgba(150,170,210,.12);padding-top:16px;";
      const frontierBelt = this._frontierBeltId(); // pinning retired (v1.99.2): the cue tracks the corridor's frontier belt
      const frontierSummary = this.challengeTrackProgress(frontierBelt);
      const cueVisible = this.get("challengeCueVisible", true) && !this.tutHidden;
      tu.innerHTML = '<div><div style="font-size:14px;font-weight:600;color:#eef1f6;">Challenge cue</div><div style="font-size:12.5px;color:#93a0bd;margin-top:4px;line-height:1.5;">' + frontierBelt.charAt(0).toUpperCase() + frontierBelt.slice(1) + ' content track · ' + frontierSummary.done + ' of ' + frontierSummary.total + ' complete</div></div>';
      const tb = document.createElement("button");
      tb.setAttribute("data-challenge-cue-toggle", "1");
      tb.textContent = cueVisible ? "Hide" : "Show";
      tb.style.cssText = "flex:none;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:700;padding:9px 14px;border-radius:9px;border:1px solid rgba(150,170,210,.25);background:rgba(255,255,255,.04);color:#dbe2f0;";
      tb.addEventListener("click", () => {
        const next = !cueVisible;
        this.tutHidden = !next;
        this.set("challengeCueVisible", next);
        this.track(next ? "neural_challenge_cue_restored" : "neural_challenge_cue_hidden", { track_id: frontierBelt });
        this.renderChallengeCue();
        this.renderSettings();
      });
      tu.appendChild(tb); body.appendChild(tu);
      body.appendChild(this.settingRow("Sound", "Synthesized feedback on every gameplay beat",
        [["On", "on"], ["Off", "off"]], "sound", "on"));
      body.appendChild(this.settingRow("Sound volume", "How loud the beats land",
        [["Quiet", "0.25"], ["Normal", "0.5"], ["Loud", "0.8"]], "soundVolume", "0.5"));
      // (the "Option ordering" row was RETIRED in v1.122.0, owner's decision. It offered
      // Potential / Popularity; `orderScore` forked on it but `edgeMark` did not, so choosing
      // Popularity re-ranked the hand while every card still printed EDGE — measured, 211 of the
      // 270 live hands printed their corner integers OUT of descending order, one click from the
      // default. And the control was over almost nothing: across those same 270 hands the setting
      // changed the dealt SET in 16, while re-ordering 223 of them. `cardOrder` is now DORMANT —
      // written by no one, read by no one, and deliberately NOT pruned from stored blobs; see the
      // tombstone on orderScore for why a settings key cannot be deleted at all.)
    } else if (tab === "modifiers") {
      this.buildModifiers(body);
    } else {
      const rows = [
        ["Play / pause roll", ["Space", "P"]],
        ["Answer a multiple-choice question", ["A", "B", "C", "D"]],
        ["Open card detail", ["1\u20139"]],
        ["Execute technique", ["\u23ce", "X"]],
        ["Flashcards: prev / next card", ["\u2190", "\u2192"]],
        ["Flashcards: prev / next technique", ["\u2191", "\u2193"]],
        ["Flashcards: flip / got it", ["Space"]],
        ["Flashcards: review again", ["\u2191"]],
        ["Open / search explorer", ["/", "\u2318K"]],
        ["Close detail / explorer / flashcards", ["Esc"]],
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
    // legal links live HERE too (v1.93.0): the first Settings overlay carries Terms · Privacy,
    // so the account surface never needs a "Learn More" submenu (Shortcuts is already a tab).
    const legal = document.createElement("div");
    legal.setAttribute("data-settings-legal", "1");
    legal.style.cssText = "display:flex;justify-content:center;align-items:center;gap:14px;padding:10px 22px 14px;border-top:1px solid rgba(150,170,210,.1);";
    const mkLegal = (label, kind) => {
      const a = document.createElement("button");
      a.type = "button";
      a.setAttribute("data-legal", kind);
      a.textContent = label;
      a.style.cssText = "cursor:pointer;font-family:inherit;border:none;background:transparent;font-size:10.5px;color:#5d6883;letter-spacing:.02em;padding:8px 6px;min-height:32px;";
      a.addEventListener("mouseenter", () => a.style.color = "#9aa6bd");
      a.addEventListener("mouseleave", () => a.style.color = "#5d6883");
      a.addEventListener("click", () => this.openLegal(kind));
      return a;
    };
    legal.appendChild(mkLegal("Terms", "terms"));
    const dot = document.createElement("span");
    dot.style.cssText = "width:3px;height:3px;border-radius:50%;background:#3c4358;";
    legal.appendChild(dot);
    legal.appendChild(mkLegal("Privacy", "privacy"));
    card.appendChild(legal);
  }
  ensureMods() {
    // no demo seeds — modifiers exist only when the user creates them (odds must not lie)
    if (this.userMods) return;
    this.userMods = [];
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
    this.user = { name: name, initial: (name[0] || "Y").toUpperCase(), email: email }; // email feeds the account menu's identity row
    this.updateAccountUI();
  }
  // merge-on-pull: per-key max for prep/days (monotonic counters), settings LWW by updatedAt.
  async _pullAndMerge() {
    const A = this._auth(); if (!A || !A.pullNeural) return;
    try {
      const cloud = await A.pullNeural();
      if (cloud && (cloud.v === 1 || cloud.v === 2)) {
        const prep = this.prep || {}, days = this._days || {};
        for (const k in (cloud.prep || {})) prep[k] = Math.max(prep[k] || 0, cloud.prep[k] || 0);
        for (const d in (cloud.days || {})) days[d] = Math.max(days[d] || 0, cloud.days[d] || 0);
        this.prep = prep; this._days = days;
        // v2 fields: per-key MAX for rec/stage/challenges, UNION for durable proof.
        const rec = this.rec || {}, stage = this.stage || {};
        const cRec = cloud.v === 2 ? (cloud.rec || {}) : (cloud.prep || {}); // v1 cloud grandfathers
        for (const k in cRec) rec[k] = Math.max(rec[k] || 0, cRec[k] || 0);
        for (const dk in (cloud.stage || {})) { const s = (stage[dk] = stage[dk] || {}); const cs = cloud.stage[dk] || {}; for (const qh in cs) s[qh] = Math.max(s[qh] || 0, cs[qh] || 0); }
        // srs merge (v1.105.0): per-card, the LATER review wins its schedule — the freshest grade
        // knows the memory best. Ties are the COMMON case (`last` is a day; two devices studying
        // the same day tie constantly), so the tie rule IS the rule: the SMALLER interval wins —
        // showing a card early is cheap, hiding a demonstrably-forgotten card for 30 days is not.
        // When the winner was a SUCCESS (ivl > 1; failures always write ivl 1) it keeps the larger
        // of the two intervals, which heals the grade-before-pull race (a fresh device's 1→3 would
        // otherwise erase a mature cloud schedule through nothing but recency). Ingested `last` is
        // clamped to today so a fast clock cannot win merges forever. NB `stage` merges MAX while
        // this merges by recency — post-merge they can disagree (proven stage, relearn schedule);
        // benign and deliberate: stage is proof, srs is memory freshness.
        {
          const srs = (this.srs = this.srs || {});
          const today = this._epochDay();
          for (const dk in (cloud.srs || {})) {
            const l = (srs[dk] = srs[dk] || {});
            const cs = cloud.srs[dk] || {};
            for (const qh in cs) {
              const c = cs[qh], m = l[qh];
              if (!Array.isArray(c) || c.length < 3) continue;
              const cc = [c[0] | 0, c[1] | 0, Math.min(today, c[2] | 0)];
              if (!m) { l[qh] = cc; continue; }
              let w, o;
              if (cc[2] > m[2]) { w = cc; o = m; }
              else if (m[2] > cc[2]) { w = m; o = cc; }
              else if (cc[1] < m[1]) { w = cc; o = m; }
              else { w = m; o = cc; }
              if (w[1] > 1 && o[1] > w[1]) w = [w[2] + o[1], o[1], w[2]];
              l[qh] = w;
            }
          }
        }
        // dayLog merge (v1.105.7): per-day, union of technique keys, latest score snapshot
        {
          const dl = (this.dayLog = this.dayLog || {});
          for (const day in (cloud.dayLog || {})) {
            const c = cloud.dayLog[day] || {}; const m = dl[day];
            if (!m) { dl[day] = { s: c.s || 0, k: (c.k || []).slice(0, 40), w: c.w }; continue; }
            for (const k of c.k || []) if (m.k.indexOf(k) < 0 && m.k.length < 40) m.k.push(k);
            if ((c.s || 0) > (m.s || 0)) m.s = c.s;   // the higher snapshot is the later one — score is monotonic-ish within a day
            if (!m.w && c.w) m.w = c.w;
          }
        }
        this.rec = rec; this.stage = stage;
        this.units = Object.assign({}, cloud.units || {}, this.units || {});
        const won = Object.assign({}, (cloud.belts || {}).won || {}, (this.belts || {}).won || {});
        const att = Object.assign({}, (this.belts || {}).attempts || {});
        const cAtt = (cloud.belts || {}).attempts || {};
        for (const k in cAtt) att[k] = Math.max(att[k] || 0, cAtt[k] || 0);
        this.belts = Object.assign({ won: {} }, this.belts || {}, { won: won, attempts: att });
        const tutDone = Object.assign(
          {},
          ((cloud.tut || {}).done || {}),
          ((this.tut || {}).done || {}),
        );
        this.tut = { done: tutDone };
        this.challenges = ngMergeChallengeMaps(
          this.challenges || {},
          cloud.challenges || {},
        );
        this.badges = ngMergeCollectibles(
          this.badges || {},
          cloud.badges || {},
        );
        this.coins = ngMergeCollectibles(
          this.coins || {},
          cloud.coins || {},
        );
        // ADD-WINS, beside the collectibles' UNION: union of lists, union of their items. A
        // delete loses to a stale device — deliberate (see ngMergeLists).
        this.lists = ngMergeLists(this.lists || {}, cloud.lists || {});
        if (this.activeListId && !this.lists[this.activeListId]) this.activeListId = this.listsArray()[0] || null;
        this._syncWhiteChallengeCompatibility(cloud.updatedAt || 0);
        const localAt = this._progressAt || 0;
        if (cloud.settings) {
          // per-KEY merge: a whole-blob LWW let one device's stale keys clobber another
          // device's fresher settings. Each key keeps its most-recently-changed value.
          const cAt = cloud.settingsAt || {}, lAt = this._settingsAt || {}, cBlob = cloud.updatedAt || 0;
          const merged = Object.assign({}, this.settings), mAt = Object.assign({}, lAt);
          for (const sk in cloud.settings) {
            const ct = cAt[sk] != null ? cAt[sk] : cBlob;      // pre-per-key clouds fall back to the blob ts
            const lt = lAt[sk] != null ? lAt[sk] : localAt;
            if (!(sk in merged) || ct > lt) { merged[sk] = cloud.settings[sk]; mAt[sk] = ct; }
          }
          this.settings = merged; this._settingsAt = mAt;
        }
        this.cardsToday = days[this._dayKey()] || 0;
        this._refreshChallengeEvidence();
      }
      this._pulled = true;          // a fresh device must pull before it may push (no cloud clobber)
      this._saveProgress();         // persist merged state + push it back
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
    if (this.deckShown) this.renderPaneAnchor(); // auth state flips the anchor's save nudge
    if (this._acctMenuOpen) this.renderAccountMenu(); // …and the menu's auth rows, if it's up
    const explorer = this.explorerRef.current;
    if (
      this._viewMode === "challenges" &&
      explorer &&
      explorer.style.display === "flex" &&
      !this._renderingChallengeView
    ) {
      this.renderExplorer();
    }
  }
  // ── account menu (v1.94.0) ── compact chrome anchored above the bottom-right chip. It is
  // CHROME, not gameplay: opening it never opens/closes the pane, never touches the pause
  // latch, never freezes the roll clock. Esc closes it FIRST (before any gameplay overlay),
  // and any outside tap closes it — the closer is a CAPTURE-phase pointerdown, so surfaces
  // that stop propagation (the pane, the option cards, the logo) still count as "outside".
  toggleAccountMenu() { if (this._acctMenuOpen) this.closeAccountMenu(); else this.openAccountMenu(); }
  openAccountMenu() {
    const m = this.acctMenuRef.current; if (!m || this._acctMenuOpen) return;
    this._acctMenuOpen = true;
    this.renderAccountMenu();
    // PORTAL to the app root: the fixed wrap div is its own stacking context, so root-level
    // overlays (the landing card at z5, the combo pop at z72) paint over ANYTHING inside it —
    // measured on the phone, the landing card buried the menu's rows. The menu joins the
    // root-level overlay family while open, fixed-anchored to the chip's measured corner.
    const root = this.__ngRoot || document.body;
    if (m.parentElement !== root) root.appendChild(m);
    const chip = this.acctChipRef.current;
    const r = chip ? chip.getBoundingClientRect() : null;
    m.style.position = "fixed";
    m.style.left = "auto"; m.style.top = "auto";
    m.style.right = (r ? Math.max(8, window.innerWidth - r.right) : 24) + "px";
    m.style.bottom = ((r ? window.innerHeight - r.top : 64) + 10) + "px";
    m.style.zIndex = "90"; // Z LADDER (helmet.html): deliberate band — above combo 72, under the modal 95
    m.style.display = "flex";
    m.setAttribute("data-open", "1");
    if (chip) chip.setAttribute("aria-expanded", "true");
    this._acctMenuAway = (e) => {
      const wrap = this.accountRef.current;
      if ((wrap && wrap.contains(e.target)) || m.contains(e.target)) return;
      this.closeAccountMenu();
    };
    document.addEventListener("pointerdown", this._acctMenuAway, true);
    this.track("neural_account_menu_opened", { signed_in: !!this.user });
  }
  // returns true when it actually closed something — the Esc handler uses that to stop there
  closeAccountMenu() {
    if (!this._acctMenuOpen) return false;
    this._acctMenuOpen = false;
    const m = this.acctMenuRef.current;
    if (m) { m.style.display = "none"; m.removeAttribute("data-open"); }
    const chip = this.acctChipRef.current; if (chip) chip.setAttribute("aria-expanded", "false");
    if (this._acctMenuAway) { document.removeEventListener("pointerdown", this._acctMenuAway, true); this._acctMenuAway = null; }
    return true;
  }
  renderAccountMenu() {
    const m = this.acctMenuRef.current; if (!m) return;
    m.innerHTML = "";
    const row = (attr, label, fn) => {
      const b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "menuitem"); b.setAttribute(attr, "1");
      b.textContent = label;
      b.style.cssText = "cursor:pointer;font-family:inherit;border:none;background:transparent;width:100%;min-height:44px;padding:0 13px;border-radius:9px;text-align:left;font-size:13px;font-weight:600;color:#cbd4e6;";
      b.addEventListener("mouseenter", () => b.style.background = "rgba(255,255,255,.05)");
      b.addEventListener("mouseleave", () => b.style.background = "transparent");
      b.addEventListener("click", () => { this.closeAccountMenu(); fn(); });
      return b;
    };
    if (this.user) {
      // the signed-in identity, readable but not a control
      const em = document.createElement("div");
      em.setAttribute("data-menu-email", "1");
      em.textContent = this.user.email || this.user.name;
      em.title = this.user.email || this.user.name;
      em.style.cssText = "min-height:44px;display:flex;align-items:center;padding:0 13px;font-size:12px;font-weight:600;color:#8b97b0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default;";
      m.appendChild(em);
      m.appendChild(row("data-menu-logout", "Log out", () => {
        const A = this._auth(); if (A && A.signOut) { try { A.signOut(); } catch (e) {} }
        this.user = null; this._pulled = false; this.updateAccountUI();
        if (this.deckShown && this._viewMode === "history" && !this._paneStudyActive()) this.renderDrillHome();
      }));
    } else {
      m.appendChild(row("data-menu-create", "Create account", () => this.openAuth("create")));
      m.appendChild(row("data-menu-login", "Log in", () => this.openAuth("login")));
    }
    // ONE separator between the auth rows and the rest — nothing else, per the owner
    const sep = document.createElement("div");
    sep.setAttribute("data-menu-sep", "1");
    sep.style.cssText = "flex:none;height:1px;margin:5px 4px;background:rgba(150,170,210,.14);";
    m.appendChild(sep);
    m.appendChild(row("data-menu-settings", "Settings", () => this.openSettings()));
    m.appendChild(row("data-menu-shortcuts", "Keyboard shortcuts", () => this.openSettings("shortcuts")));
    const legal = document.createElement("div");
    legal.style.cssText = "display:flex;align-items:center;";
    const lb = (attr, label, kind) => { const b = row(attr, label, () => this.openLegal(kind)); b.style.width = "auto"; return b; };
    legal.appendChild(lb("data-menu-terms", "Terms", "terms"));
    const dot = document.createElement("span");
    dot.style.cssText = "flex:none;width:3px;height:3px;border-radius:50%;background:#3c4358;";
    legal.appendChild(dot);
    legal.appendChild(lb("data-menu-privacy", "Privacy", "privacy"));
    m.appendChild(legal);
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
  // Challenge curriculum: curated tracks -> units -> lessons over the graph
  _onCurriculum() {
    const c = this.curriculum;
    this._lessonIndex = {}; this._curriculumIdxSet = new Set();
    for (const b of c.belts) {
      for (const u of b.units) {
        const uk = b.id + "/" + u.id;
        const pi = this._idIndex ? this._idIndex.get(u.positionNodeId) : null;
        if (pi != null) this._curriculumIdxSet.add(pi);
        for (const l of u.lessons) {
          this._lessonIndex[l.deckKey] = { belt: b.id, unit: uk, nodeId: l.nodeId, frames: l.frames || ["gi", "nogi"] };
          const i = this._idIndex ? this._idIndex.get(l.nodeId) : null;
          if (i != null) this._curriculumIdxSet.add(i);
        }
      }
    }
    const currentView = this.get("challengeView", null);
    let stored = currentView;
    if (!stored) {
      try { stored = localStorage.getItem("bjj_view_mode"); } catch (e) {}
    }
    // History replaced the Collection tab (v1.76.0) — stored `collection` (and legacy `path`)
    // land on challenges; `tree` stays explore.
    const migrated =
      stored === "tree" || stored === "explore"
        ? "explore"
        : stored === "history"
          ? "history"
          : "challenges";
    this._viewMode = migrated;
    if (stored && currentView !== migrated) {
      this.set("challengeView", migrated);
    }
    this.styleViewToggle();
    if (this.deckShown) this._renderPaneBody();
    this._refreshChallengeEvidence();
  }
  setViewMode(m) {
    if (m === "collection") m = "challenges"; // retired tab — its content lives in Challenges now
    if (m !== "explore" && m !== "challenges" && m !== "history") return;
    if (this._viewMode === m) return;
    // a focus set belongs to the tab that lit it: leaving Explore drops the highlight, so the
    // Challenges tab's curriculum fog is never fighting a stale System selection for the graph
    this.clearFocus();
    this._viewMode = m;
    if (m === "challenges") this._challengeScrollPending = true; // arrival positioning on tab open (v1.98.1)
    // a TAB SWITCH starts the incoming body at its top — without this, Explore inherits
    // the corridor's deep arrival scroll and its Lists head renders buried under the nav
    // (in-tab re-renders never come through here, so browsing/search scroll is untouched)
    { const l = this.explorerListRef.current; if (l) l.scrollTop = 0; }
    this.set("challengeView", m);
    try { localStorage.setItem("bjj_view_mode", m); } catch (e) {}
    this.styleViewToggle();
    this._renderPaneBody();
  }
  styleViewToggle() {
    const vt = this.viewToggleRef.current; if (!vt) return;
    vt.style.display = this._paneStudyActive() ? "none" : "grid";
    vt.querySelectorAll("[data-view]").forEach((s) => {
      const on = s.getAttribute("data-view") === this._viewMode;
      s.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const search = this.explorerSearchWrapRef.current;
    if (search) search.style.display = this._viewMode === "explore" ? "flex" : "none";
    // tools = the search row only since the GI pill moved to Settings (v1.95.3) — Explore only
    const tools = this.explorerToolsRef.current;
    if (tools) tools.style.display = this._viewMode === "explore" ? "flex" : "none";
    if (this.renderTabSubtitles) this.renderTabSubtitles(); // the Explore subtitle is the score's one exposure (v1.98.1)
  }
  // A deck's lesson goal is min(3, its card count) — and the manifest's `n` is that count even
  // before the cards land, so a 1-card deck never asks for 3 answers just because it is still
  // in flight (which is what made lessonDone, and every crown downstream of it, flicker).
  _deckGoal(key) { const d = this.flashcards && this.flashcards.decks ? this.flashcards.decks[key] : null; return Math.min(3, this._deckCardCount(d) || 3); }
  /** How many cards this deck HAS — from the cards if resident, else the manifest count. */
  _deckCardCount(d) { const c = this._cardsOf(d); return c ? c.length : ((d && d.n) || 0); }
  /**
   * The count a deck ROW shows. ONE seam, because every list that renders it was reading
   * `_cardsOf(d).length` and therefore told a cold visitor "soon" about decks that have had
   * cards authored for months. The manifest's `n` is the corpus truth before and after the chunk
   * lands; the only thing residency changes is whether a dropped fetch is admitted ("retry").
   */
  _deckCountLabel(key, compact) {
    const n = this._deckCardCount(((this.flashcards && this.flashcards.decks) || {})[key]);
    if (this.deckStatus(key) === "failed") return "retry";
    if (!n) return "soon";
    return compact ? String(n) : n + (n === 1 ? " card" : " cards");
  }
  lessonDone(key) { return ((this.prep && this.prep[key]) || 0) >= this._deckGoal(key); }
  _lessonLive(l) { const fr = l.frames || ["gi", "nogi"]; return fr.indexOf(this._giMode === "nogi" ? "nogi" : "gi") >= 0; }
  unitComplete(beltId, unit) {
    const uk = beltId + "/" + unit.id;
    const live = unit.lessons.filter((l) => this._lessonLive(l));
    return live.length > 0 && live.every((l) => this.lessonDone(l.deckKey)) && !!(this.units && this.units[uk] && this.units[uk].checkpoint);
  }
  _lessonNodeIdx(deckKey) { const e = this._lessonIndex && this._lessonIndex[deckKey]; if (!e || !this._idIndex) return -1; const i = this._idIndex.get(e.nodeId); return i == null ? -1 : i; }
  _maybeLessonDone(key) {
    const e = this._lessonIndex && this._lessonIndex[key];
    if (!e || !this.lessonDone(key)) return;
    this._lessonBeatFired = this._lessonBeatFired || new Set();
    if (this._lessonBeatFired.has(key)) return;
    this._lessonBeatFired.add(key);
    this.fx("lesson_done", { deckKey: key, unit: e.unit, belt: e.belt });
  }
  openLessonStudy(l, unit, belt) {
    const keys = unit.lessons.filter((x) => this._lessonLive(x)).map((x) => x.deckKey);
    this._session = { keys: keys, label: unit.name, idx: Math.max(0, keys.indexOf(l.deckKey)) };
    this._sessionNodes = keys.map((k) => this.nodeForKey(k)).filter((i) => i >= 0);
    const idx = this._lessonNodeIdx(l.deckKey);
    if (idx >= 0) this.locateNode(idx); // prezi flight (pane stays open — study takes it over next)
    this.studyFromSession(l.deckKey);
  }
  // (completeCheckpoint — the Phase-1 no-quiz placeholder — is DELETED, v1.106.9: zero callers
  // since startCheckpoint shipped the real MC quiz, and a surviving function that grants
  // `units[uk].checkpoint` without a quiz is a footgun for any future caller. `unit_done` now
  // exists only in the checkpoint pass branch.)
  // ── DEGREES: ONE SCORE FOR THE WHOLE GAME ──
  // Every technique carries a WEIGHT — how often a roll actually passes through it, read off the
  // graph's stationary distribution at build time (see build_technique_weights). Your standing is
  // the frequency-weighted average of how well you know them:
  //
  //     score = Σ (weight_i × mastery_i),   Σ weight_i = 1
  //
  // Know nothing → 0. Prove the entire game by recall → 1. Belts are thresholds on that one
  // number. Nothing is cut: a rare technique still counts, just proportionally to how rare it is
  // (the old "drop the tail 20%" canon was arbitrary — attempt_probability is normalised per
  // position, so any mass cutoff is meaningless).
  //
  // Per-deck mastery is min(stage,3)/3 averaged over its cards, so a multiple-choice answer is
  // worth 2/3 of a card and recognition alone tops out at 0.67 — enough for purple, never enough
  // for brown or black. Recall is the only route past 0.7, by construction, which is exactly the
  // "white belts recognise, black belts recall" rule.
  get BELT_SCORE() { return [["white", 0.2], ["blue", 0.4], ["purple", 0.6], ["brown", 0.7], ["black", 0.8]]; }
  deckMastery(key) {
    const d = (this.flashcards && this.flashcards.decks) ? this.flashcards.decks[key] : null;
    if (!d) return 0;
    const cards = this._cardsOf(d);
    if (cards && cards.length) {
      let s = 0;
      for (const c of cards) s += Math.min(3, this.cardStage(key, c.q)) / 3;
      return s / cards.length;
    }
    // UNHYDRATED, but not unknown. Every grade the user has ever made is persisted per
    // (deck, question-hash) in this.stage, and the manifest carries the deck's card count, so:
    //
    //     mastery = Σ min(stage,3)/3  over the graded cards      ÷  n
    //
    // which is the SAME arithmetic as the hydrated branch — an ungraded card contributes 0 to
    // the mean either way. The cards are only needed to enumerate the zeroes.
    //
    // This is the difference between a correct belt and a lie. Without it, a manifest boot
    // reads every deck at 0 mastery, gameScore sums to ~0, the user is told they are a white
    // belt again — and because the score is memoised on _stageVer (bumped only by a card
    // grade), that lie STICKS until they answer a card. Crowns and "mastered decks" hang off
    // the same number, so Challenge evidence would appear to regress too.
    const n = d.n || 0;
    if (!n) return 0;
    const s = this.stage && this.stage[key];
    if (!s) return 0;
    const graded = [];
    for (const qh in s) graded.push(Math.min(3, s[qh]) / 3);
    // ONE definition of mastery, resident or not. `this.stage[key]` can hold grades for
    // questions the deck no longer has (a content pass rewords a card and its hash changes) —
    // the resident branch iterates real cards and cannot see them, so neither may this one.
    // Only `n` cards can be live; keep the best `n` grades and drop the rest. In the healthy
    // case (grades ⊆ live cards) that is every grade, so nothing changes.
    if (graded.length > n) { graded.sort((a, b) => b - a); graded.length = n; }
    let sum = 0;
    for (const g of graded) sum += g;
    return Math.min(1, sum / n);   // clamp: belt AND braces
  }
  gameScore() {
    const ver = this._stageVer || 0;
    if (this._scoreCache && this._scoreCache.v === ver) return this._scoreCache.out; // ~21k card reads — memoised per stage change
    const w = (this.curriculum && this.curriculum.weights) || null;
    const B = this.BELT_SCORE;
    let score = 0;
    if (w) {
      let total = 0;
      for (const k in w) { total += w[k]; score += w[k] * this.deckMastery(k); }
      score = total ? score / total : 0;
    }
    let earned = -1;
    for (let i = 0; i < B.length; i++) if (score >= B[i][1]) earned = i;
    const lo = earned < 0 ? 0 : B[earned][1];
    const hi = earned + 1 < B.length ? B[earned + 1][1] : 1;
    const out = {
      score: score,
      belt: earned < 0 ? null : B[earned][0],
      next: earned + 1 < B.length ? B[earned + 1][0] : null,
      stripes: hi > lo ? Math.max(0, Math.min(4, Math.floor(((score - lo) / (hi - lo)) * 4))) : 4,
    };
    this._scoreCache = { v: ver, out: out };
    return out;
  }
  // a lesson's crown: the ring fills with deckMastery, and the numeral is the crown level 0-4.
  // Same numbers that drive the belt score — grinding a bubble to gold IS moving your belt.
  crownBadge(frac, tint, locked) {
    const f = Math.max(0, Math.min(1, frac));
    const lvl = Math.floor(f * 4);
    const ring = locked ? "rgba(150,170,210,.16)" : (lvl >= 4 ? "#f0c05a" : tint);
    const ink = locked ? "#5d6a86" : (lvl >= 4 ? "#f0c05a" : lvl ? "#dbe2f0" : "#7e8aa3");
    return '<span data-crown="' + lvl + '" title="' + Math.round(f * 100) + '% mastered" style="position:relative;flex:none;width:25px;height:25px;border-radius:50%;background:conic-gradient(' + ring + ' ' + (f * 100).toFixed(1) + '%, rgba(150,170,210,.13) 0);display:flex;align-items:center;justify-content:center;">' +
      '<span style="width:18px;height:18px;border-radius:50%;background:#121623;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:800;color:' + ink + ';font-family:\'Space Grotesk\',sans-serif;">' + (lvl >= 4 ? "★" : lvl) + '</span>' +
      '</span>';
  }
  // Content capstones reuse the existing deterministic roll-test engine without gating tracks.
  _beltPoolAllows(n) {
    const bt = this._beltTest; if (!bt) return true;
    return bt.names.indexOf(this.splitName(n.t).main.toLowerCase()) >= 0;
  }
  startBeltTest(beltId) {
    const bs = (this.curriculum && this.curriculum.belts) || [];
    const bi = bs.findIndex((b) => b.id === beltId);
    const belt = bs[bi];
    if (!belt || !belt.test) return;
    if (!belt.units.every((u) => this.unitComplete(belt.id, u))) {
      this.setEvent("Capstone evidence needed", "Complete every unit first", "bad"); return;
    }
    const frame = this._giMode === "nogi" ? "nogi" : "gi";
    // set BEFORE rollFromPosition: clearEngagement runs inside it and deliberately leaves
    // _beltTest alone (see the note there). startRoll (manual reset) cancels it cleanly —
    // no attempt is burned by bailing out.
    this._beltTest = {
      beltId: beltId,
      names: ((belt.pool && belt.pool[frame]) || []).slice(), // computed pool, never authored
      maxMoves: (belt.test && belt.test.maxMoves) || 14,
      pointsWin: (belt.test && belt.test.pointsWinDominance) || 0.35,
    };
    this.fx("belt_test_start", { belt: beltId, maxMoves: this._beltTest.maxMoves });
    if (this.deckShown) this.setDeckOpen(false);
    const posIdx = this._idIndex ? this._idIndex.get(belt.test.startNodeId) : null;
    const challengeTrack = NG_CHALLENGE_TRACKS.find((track) => track.id === beltId);
    this.showCenter("CONTENT CAPSTONE", (challengeTrack ? challengeTrack.name : belt.name) + " capstone", this._beltTest.maxMoves + " moves \u00b7 win by tap or on points", "bad", true);
    this.rollFromPosition(posIdx != null ? posIdx : this.currentPos);
    // the authored budget + start role override the roll seeder's randomized defaults
    this.maxMoves = this._beltTest.maxMoves;
    const role = ((belt.test.startDeckKey || "").split("|")[1] || "").toLowerCase();
    if (role) this.playerRole = role === "bottom" ? "bottom" : "top";
  }

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
  // ── Explore sections (v1.99.3, owner: "showing all categories should be collapsed") ──
  // EVERY top-level section — Systems, Principles, Positions, Transitions, Submissions,
  // Learning — defaults COLLAPSED; expanding (or re-folding) persists per section in ONE
  // settings map, `exploreOpenSections` (the challengeOpenSections pattern: per-key LWW,
  // cross-device). Collapse is presentation only — nothing locks. Search is untouched by
  // design: a query renders FLAT ranked results before any section exists, so a match
  // inside a folded group is never hidden. Family sub-folds (_exp.f) stay session-local —
  // they live inside an already-deliberate expansion.
  _exploreSectionOpen(label) {
    const map = this.get("exploreOpenSections", null);
    if (map && typeof map === "object" && Object.prototype.hasOwnProperty.call(map, label)) return !!map[label];
    return false;
  }
  _toggleExploreSection(label) {
    const cur = this.get("exploreOpenSections", null);
    const map = Object.assign({}, cur && typeof cur === "object" ? cur : {});
    map[label] = !this._exploreSectionOpen(label);
    this.set("exploreOpenSections", map);
    this.renderExplorer();
  }
  toggleExplorer() {
    // the logo (and legacy callers) toggle the merged pane
    if (this.deckShown) { this.setDeckOpen(false); }
    else {
      this.openPane();
      if (this._viewMode === "explore") {
        setTimeout(() => { try { const inp = this.explorerSearchRef.current; if (inp) inp.focus(); } catch (e) {} }, 80);
      }
    }
    this.lastInteract = this.now;
  }
  // open the merged pane in tabs mode, optionally jumping to a tab. A live study surface is
  // exited first — browsing intent (logo, "/", cue) always lands on the tab bar.
  openPane(view) {
    if (this._paneStudyActive()) this._exitStudyTo(view || this._viewMode);
    else if (view) this.setViewMode(view);
    { const sh = this.dossierSheetRef.current; if (sh && sh.style.display === "block") this.closeDossierSheet(); } // the pane replaces the mobile sheet
    // no _wirePaneControls here: applyDeckVisibility is the one wiring seam for every open path
    this._drillView = "home";
    this.deckReady = true; this.deckOpen = true;
    this.applyDeckVisibility();
    this._renderPaneBody();
    this.lastInteract = this.now;
  }
  // legacy name kept — challenge-ui's openLearningView calls openExplorer()+showExplorerList()
  openExplorer() { this.openPane(); }
  _wirePaneControls() {
    const inp = this.explorerSearchRef.current;
    if (inp && !inp._wired) {
      inp._wired = true;
      inp.addEventListener("input", () => { this._exQ = inp.value; this.showExplorerList(); });
      inp.addEventListener("pointerdown", (e) => e.stopPropagation());
    }
    // the GI/NO-GI pill left the pane for Settings → Rolling (v1.95.3) — only the stored
    // preference is loaded here; setGiMode stays the one behavior seam
    if (this._giMode == null) { try { this._giMode = localStorage.getItem("bjj_gi_mode") === "nogi" ? "nogi" : "gi"; } catch (e) { this._giMode = "gi"; } }
    const vt = this.viewToggleRef.current;
    if (vt && !vt._wired) {
      vt._wired = true;
      vt.addEventListener("pointerdown", (e) => e.stopPropagation());
      vt.querySelectorAll("[data-view]").forEach((s) => s.addEventListener("click", () => this.setViewMode(s.getAttribute("data-view"))));
    }
    this.styleViewToggle();
  }
  setGiMode(m) {
    if (m !== "gi" && m !== "nogi") return;
    this._giMode = m;
    try { localStorage.setItem("bjj_gi_mode", m); } catch (e) {}
    this._explorer = null;
    const list = this.explorerListRef.current;
    if (list && list.style.display !== "none") this.renderExplorer();
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
    if (this.deckShown) this.setDeckOpen(false);
  }
  closeDeckIfStudying() {
    // close the side pane when clicking the graph, but only when it's an opened study panel
    // (not the live in-roll drill that should stay docked during a decision)
    // PANE LAW: on desktop a graph click NEVER closes the pane — the tab, the ✕ and Esc do.
    // Mobile keeps exactly one dismissal: the pane covers the screen there, so tapping the
    // exposed 20% graph strip is the only way back out.
    if (this.deckOpen && this.sbOffset() === 0) { this.setDeckOpen(false); this._session = null; this._sessionNodes = null; this._inSession = false; }
  }
  renderExplorer() {
    // defensive: legacy callers (setGiMode, selectChallengeTrack) call this
    // directly — route the History tab to its own renderer instead of the explorer list
    if (this._viewMode === "history") {
      if (this.renderTabSubtitles) this.renderTabSubtitles();
      if (this.deckShown && !this._paneStudyActive()) this.renderDrillHome();
      return;
    }
    const list = this.explorerListRef.current; if (!list) return;
    // corridor re-renders (evidence beats, pin/select/fold clicks) must not yank the
    // scroll while the user reads (the History-body gate precedent) — keep it unless an
    // arrival reposition is pending (v1.98.1)
    const keepScroll =
      this._viewMode === "challenges" && !this._challengeScrollPending ? list.scrollTop : null;
    list.innerHTML = "";
    if (this.renderTabSubtitles) this.renderTabSubtitles();
    if (this._viewMode === "challenges") {
      this.renderChallenges(list);
      if (keepScroll != null) list.scrollTop = keepScroll;
      return;
    }
    const data = this.buildExplorer();
    // v1.99.3: `g` (the section-open set, which pre-opened Systems + Submissions) is gone —
    // section folds live in the persisted `exploreOpenSections` settings map, all-collapsed
    // by default. Only the session-local family sub-folds remain here.
    this._exp = this._exp || { f: new Set() };
    const q = (this._exQ || "").toLowerCase().trim();
    const mk = (html, pad, onClick) => {
      const d = document.createElement(onClick ? "button" : "div");
      if (onClick) d.type = "button";
      d.style.cssText = "width:100%;font-family:inherit;text-align:left;color:inherit;border:0;background:transparent;cursor:" + (onClick ? "pointer" : "default") + ";padding:7px " + pad + "px;border-radius:7px;display:flex;align-items:center;gap:8px;";
      d.innerHTML = html;
      if (onClick) {
        d.addEventListener("mouseenter", () => d.style.background = "rgba(255,255,255,.045)");
        d.addEventListener("mouseleave", () => d.style.background = "transparent");
        d.addEventListener("click", onClick);
      }
      return d;
    };
    // a System detail view owns the list — and it owns the graph focus set, so it has to render
    // BEFORE the reset below (which is what drops the highlight when you leave the view).
    if (this._systemId && !q && this._systemsById && this._systemsById[this._systemId]) {
      this.renderSystemDetail(list, this._systemId, mk);
      return;
    }
    // A list selection SURVIVES the reset below (Systems does the same via _systemId, but from
    // its own detail view). Without this, every Explore re-render — including one keystroke in
    // the search box — would drop the highlight a shared link just lit.
    const keepList = this._listFocusId;
    this._pathDim = false;
    this.clearFocus();
    // a still-EXISTING selection survives the reset even when the list is empty (a newborn
    // list from the header + has no members yet — its row must still read as selected).
    // Two legitimate shapes: an OWNED list (in _listsMap, possibly empty) and the "__shared"
    // incoming preview (never in the map — listIdxs resolves it). The graph focus set only
    // lights when there is something to light.
    if (keepList && (this._listsMap()[keepList] || this.listIdxs(keepList).length)) {
      this._listFocusId = keepList;
      const ki = this.listIdxs(keepList);
      if (ki.length) this.setFocusIdxSet(ki, true);
    }
    // search mode: flat ranked results across all nodes
    if (q) {
      const matches = this.nodes.filter((n) => n.t.toLowerCase().includes(q)).slice(0, 120);
      if (!matches.length) { list.appendChild(mk('<span style="font-size:12.5px;color:#7e8aa3;padding:8px 0;">No techniques match \u201c' + q + '\u201d</span>', 12)); return; }
      list.appendChild(mk('<span style="font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#7b8aa8;font-weight:700;">' + matches.length + ' result' + (matches.length === 1 ? "" : "s") + '</span>', 12));
      for (const n of matches) {
        const cat = ({ positions: "Pos", transitions: "Trans", submissions: "Sub" })[n.ty];
        const hit = mk(this.nodeGlyph(n.ty, this.hex(n.col), 9) + '<span style="font-size:13px;color:#dbe2f0;">' + this.hl(this.splitName(n.t).main, q) + (this.splitName(n.t).from ? ' <span style="color:#6b7691;font-size:11px;">' + this.splitName(n.t).from + '</span>' : "") + '</span><span style="margin-left:auto;font-size:10px;color:#7e8aa3;">' + cat + '</span>', 12, () => this.openDossier(n.idx));
        list.appendChild(this._withListAdd(hit, n, "explore"));
      }
      return;
    }
    // curated concept sections (authored on bjjgraph.org)
    const curatedMap = {
      Principles: ["#66CCEE", [["Frames & posture", "guard"], ["Base & connection", "control"], ["Hip movement", "escape"], ["Grip fighting", "grip"], ["Angles", "back"], ["Pressure", "side control"]]],
      Learning: ["#7ee0a8", [["Fundamentals path", "guard"], ["Submission escapes", "escape"], ["Guard passing 101", "pass"], ["Back control & finishes", "back"]]],
    };
    const renderCurated = (label) => {
      const entry = curatedMap[label], col = entry[0], items = entry[1];
      const open = this._exploreSectionOpen(label);
      const hdr = mk('<span style="font-size:14px;font-weight:700;color:#dbe2f0;">' + label + '</span><span style="font-size:11px;color:#7e8aa3;">(' + items.length + ')</span><span style="margin-left:auto;color:#5d6883;font-size:11px;">' + this._caretHTML(open) + '</span>', 12, () => this._toggleExploreSection(label));
      hdr.setAttribute("data-explore-section", label);
      hdr.setAttribute("aria-expanded", open ? "true" : "false");
      list.appendChild(hdr);
      if (!open) return;
      for (const [name, term] of items) {
        list.appendChild(mk('<span style="width:7px;height:7px;border-radius:50%;background:' + col + ';flex:none;"></span><span style="font-size:13px;color:#c4cde0;">' + name + '</span>', 22, () => {
          this._exQ = term; const inp = this.explorerSearchRef.current; if (inp) inp.value = term;
          this.renderExplorer();
        }));
      }
    };
    // Systems: every authored system in systems.json, alphabetical. The whole library is listed
    // (no hand-picked shortlist) — a row lights its members on the graph and opens its page.
    const renderSystems = () => {
      const all = this.systems || [];
      // Systems are a DEFERRED payload (v1.80.4): 324KB nothing on the roll path reads. Ask for
      // it here, at the first read; _onSystems re-renders Explore when it lands.
      if (!all.length) { this._ensureSystems(); return; }   // absent (or 404) -> no section yet
      const open = this._exploreSectionOpen("Systems");
      const hdr = mk('<span style="font-size:14px;font-weight:700;color:#dbe2f0;">Systems</span><span style="font-size:11px;color:#7e8aa3;">(' + all.length + ')</span><span style="margin-left:auto;color:#5d6883;font-size:11px;">' + this._caretHTML(open) + '</span>', 12, () => this._toggleExploreSection("Systems"));
      hdr.setAttribute("data-explore-section", "Systems");
      hdr.setAttribute("aria-expanded", open ? "true" : "false");
      list.appendChild(hdr);
      if (!open) return;
      for (const s of all) {
        const meta = [s.difficulty, s.type].filter(Boolean).join(" \u00b7 ");
        const row = mk('<span style="width:7px;height:7px;border-radius:50%;background:#a98bff;flex:none;"></span><span style="font-size:13px;color:#c4cde0;">' + this.escHTML(s.name) + '</span>' + (meta ? '<span style="margin-left:auto;font-size:10px;color:#7e8aa3;white-space:nowrap;">' + this.escHTML(meta) + '</span>' : ""), 22, () => this.openSystem(s.id));
        row.setAttribute("data-system-row", s.id);
        row.style.pointerEvents = "auto";
        list.appendChild(row);
      }
    };
    const renderGraphGroup = (pair) => {
      const label = pair[0], key = pair[1];
      const fams = data.groups[key];
      const famNames = Object.keys(fams).sort((a, b) => a.localeCompare(b));
      const count = famNames.reduce((a, f) => a + fams[f].length, 0);
      const gOpen = this._exploreSectionOpen(label);
      const hdr = mk('<span style="font-size:14px;font-weight:700;color:#dbe2f0;">' + label + '</span><span style="font-size:11px;color:#7e8aa3;">(' + count + ')</span><span style="margin-left:auto;color:#5d6883;font-size:11px;">' + this._caretHTML(gOpen) + '</span>', 12, () => this._toggleExploreSection(label));
      hdr.setAttribute("data-explore-section", label);
      hdr.setAttribute("aria-expanded", gOpen ? "true" : "false");
      list.appendChild(hdr);
      if (!gOpen) return;
      for (const fam of famNames) {
        const nodes = fams[fam], col = this.hex(nodes[0].col);
        if (nodes.length > 1) {
          const fk = key + "|" + fam, fOpen = this._exp.f.has(fk);
          list.appendChild(mk(this.nodeGlyph(nodes[0].ty, col, 8) + '<span style="font-size:13px;font-weight:600;color:#c4cde0;">' + fam + '</span><span style="font-size:10.5px;color:#7e8aa3;">' + nodes.length + '</span><span style="margin-left:auto;color:#5d6883;font-size:10px;">' + this._caretHTML(fOpen) + '</span>', 22, () => { if (fOpen) this._exp.f.delete(fk); else this._exp.f.add(fk); this.renderExplorer(); }));
          // THE CATEGORY SHAPE RIDES EVERY TECHNIQUE ROW (v1.103.6). These leaf rows carried no
          // glyph at all, so a technique inside a family fold was the one place in Explore that
          // did not say what it was. `nodeGlyph` is the same vocabulary `draw()` puts on the
          // canvas — circle = position, triangle = submission, diamond = transition (:9516-9518).
          if (fOpen) for (const n of nodes) list.appendChild(this._withListAdd(mk(this.nodeGlyph(n.ty, col, 7) + '<span style="font-size:12px;color:#9aa6bd;">' + this.splitName(n.t).main + (this.splitName(n.t).from ? ' <span style="color:#6b7691;">' + this.splitName(n.t).from + '</span>' : "") + '</span>', 38, () => this.openDossier(n.idx)), n, "explore"));
        } else {
          const solo = this.nodes[this.famDossierNode(nodes)] || nodes[0];
          list.appendChild(this._withListAdd(mk(this.nodeGlyph(nodes[0].ty, col, 8) + '<span style="font-size:13px;color:#c4cde0;">' + fam + '</span>', 22, () => this.openDossier(this.famDossierNode(nodes))), solo, "explore"));
        }
      }
    };
    // order: stats \u2192 Lists \u2192 Systems \u2192 Principles \u2192 Positions \u2192 Transitions \u2192
    // Submissions \u2192 Learning. The score-belt block is GONE (v1.98.1, owner: "we should no
    // longer see this") \u2014 the score lives in the Explore tab subtitle; the stat row leads
    // (the weak-spots count is Explore's call to action); Lists heads the sections.
    this.renderLists(list);
    renderSystems();
    renderCurated("Principles");
    for (const pair of data.order) renderGraphGroup(pair);
    renderCurated("Learning");
  }
  // ---------- focus set: the node selection the graph lights up ----------
  // General by design: a System lights its member techniques today, a shareable List will light
  // its own through these same two calls. The draw loop reads _focusIdxSet exactly like the
  // path-view fog (non-members drop to 30% ink) and rings the members on top.
  setFocusIdxSet(idxs, noFrame) {
    const set = new Set();
    for (const i of idxs || []) if (this.nodes && this.nodes[i]) set.add(i);
    this._focusIdxSet = set.size ? set : null;
    // noFrame: a re-render of the SAME selection must not yank the camera again (typing in the
    // Explore search re-renders on every keystroke).
    if (this._focusIdxSet && !noFrame) this.frameNodes(Array.from(this._focusIdxSet));
  }
  // drops the highlight AND the view that owns it: a lit graph with no visible selection is a
  // state the user cannot undo. Called from every _pathDim reset and on any tab change.
  clearFocus() { this._focusIdxSet = null; this._systemId = null; this._listFocusId = null; }

  // ---------- systems: the authored course library (systems.json, optional payload) ----------
  _onSystems() {
    this.systems = this.systems.slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    this._systemsById = {};
    for (const s of this.systems) if (s && s.id) this._systemsById[s.id] = s;
    if (this.deckShown && this._viewMode === "explore") this._renderPaneBody(); // payload can land after the pane is already up
  }
  // member graph nodes, resolved once per system against the ingested id index
  systemNodeIdxs(s) {
    if (!s) return [];
    if (!s._idxs) {
      const out = [];
      for (const id of (Array.isArray(s.nodes) ? s.nodes : [])) {
        const i = this._idIndex ? this._idIndex.get(id) : null;
        if (i != null && this.nodes[i] && out.indexOf(i) < 0) out.push(i);
      }
      s._idxs = out;
    }
    return s._idxs;
  }
  openSystem(id) {
    const s = this._systemsById ? this._systemsById[id] : null; if (!s) return;
    // Explore is the tab that owns the highlight. Any pane/tab transition runs clearFocus, so the
    // transition goes FIRST and the selection is claimed after it (a row click skips this).
    if (!this.deckShown || this._viewMode !== "explore") this.openPane("explore");
    const idxs = this.systemNodeIdxs(s);
    this._systemId = id;
    this.track("neural_system_opened", { system: s.name, nodes: idxs.length, has_course: !!(s.products && s.products.length) });
    this.setFocusIdxSet(idxs);
    this.showExplorerList();
  }
  closeSystem() { this.clearFocus(); this.showExplorerList(); }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // SHAREABLE LISTS — the gym-WhatsApp loop
  //
  // A coach collects the techniques a class covered, shares ONE link into the group, and the
  // people who open it see exactly those techniques lit on the graph and can drill them.
  //
  // Three rules the rest of this section exists to keep:
  //  1. Lists STORE node ids, in the EXISTING v2 progress blob (no version bump, no
  //     migration). Only the WIRE uses ordinals — see lists-codec.src.js.
  //  2. The item cap is enforced HERE, at the point of adding. ngListEncodeOrdinals THROWS
  //     above the cap (deliberately — silently truncating a coach's class is worse), so an
  //     unguarded add would blow up at share time, i.e. in front of the whole group.
  //  3. The link works with NO Cloudflare Function deployed: `_openSharedListFromUrl` decodes
  //     `location.pathname` client-side off the static shell. The Function only ever adds the
  //     social preview.
  // ══════════════════════════════════════════════════════════════════════════════════════
  _ordinalById() { return this._ordById || new Map(); }
  _ordinalIndex() { return this._ordToId || new Map(); }
  _listsMap() { this.lists = this.lists || {}; return this.lists; }
  listsArray() {
    const m = this._listsMap();
    return Object.keys(m).sort((a, b) => (m[b].t || 0) - (m[a].t || 0));
  }
  activeList() { const m = this._listsMap(); return this.activeListId && m[this.activeListId] ? m[this.activeListId] : null; }
  activeListHas(nodeId) { const l = this.activeList(); return !!(l && l.items.indexOf(nodeId) >= 0); }
  newList(name) {
    // id from the clock plus a per-session counter: no RNG (the rigged test RNG must never be
    // spent on bookkeeping), and a same-millisecond collision across two devices is merged
    // harmlessly by the add-wins rule anyway.
    const id = "l" + Date.now().toString(36) + (this._listSeq = (this._listSeq || 0) + 1).toString(36);
    this._listsMap()[id] = { name: name || ngListDefaultName(new Date()), items: [], t: Date.now() };
    this.activeListId = id;
    this.set("activeListId", id); // settings are LWW per key -> the active list follows the user
    this._expandList(id); // a list you just made is a list you are about to fill — show its inside
    return id;
  }
  // ── the per-list disclosure (v1.99.4) ────────────────────────────────────────────────
  // "I should be able to see the listed techniques after adding under Your lists" (owner). A
  // received class was legible (_sharedBlock names every technique); your OWN list printed a
  // name and a count and nothing else.
  //
  // THE EXPANSION IS SESSION STATE, ON PURPOSE — a Set, not a settings map. Explore's section
  // folds persist (`exploreOpenSections`) because their keys are a FIXED vocabulary of six
  // section labels: the map is bounded and every key still means something next week. List ids
  // are minted per device from `Date.now()` and die with the list, so a persisted map would grow
  // an unbounded tail of keys naming lists that no longer exist (and, through the per-key LWW
  // settings merge, would sync that tail to every other device). Expansion is also DERIVED here
  // rather than chosen: the list you just created, and any list you just added to, opens itself —
  // a posture that follows what you are doing, not a preference worth carrying across days.
  _listExpand() { return this._listExpandSet || (this._listExpandSet = new Set()); }
  _listExpanded(id) { return this._listExpand().has(id); }
  _expandList(id) { if (id) this._listExpand().add(id); }
  _toggleListExpand(id) {
    const s = this._listExpand();
    if (s.has(id)) s.delete(id); else s.add(id);
    // KEYBOARD CONTINUITY. Toggling re-renders the ENTIRE Explore body, so the button that was
    // just pressed is destroyed and rebuilt — and focus lands back on <body>. By mouse that is
    // invisible; by keyboard it means one Enter opens the list and the next one does nothing,
    // with a Tab walk back through every control to reach the same button. Same class of defect
    // the rename editor's _listEditFocusPending exists for; same shape of fix.
    try {
      const ae = document.activeElement;
      if (ae && ae.getAttribute && ae.getAttribute("data-list-open") === id) this._listOpenFocusPending = id;
    } catch (e) { /* non-fatal */ }
    this._refreshListSurfaces();
  }
  addToList(nodeId, listId) {
    const i = this._idIndex ? this._idIndex.get(nodeId) : null;
    if (i == null || !this.nodes[i]) return { added: false, reason: "unknown_node" };
    const m = this._listsMap();
    let id = listId || this.activeListId;
    if (!id || !m[id]) id = this.newList();
    const l = m[id];
    if (l.items.indexOf(nodeId) >= 0) return { added: false, listId: id, reason: "already" };
    if (l.items.length >= NG_LIST_ITEM_CAP) return { added: false, listId: id, reason: "full" };
    l.items.push(nodeId); l.t = Date.now();
    this.activeListId = id;
    this.set("activeListId", id); // saves the blob too
    // AUTO-EXPAND THE LIST YOU JUST ADDED TO. The owner's ask is literally "see the listed
    // techniques AFTER ADDING": a + pressed while the pane is open has to land somewhere the
    // eye can follow it, not just tick a counter.
    this._expandList(id);
    this.fx("list_item_added", { list: id, node: nodeId, count: l.items.length });
    return { added: true, listId: id, count: l.items.length };
  }
  removeFromList(nodeId, listId) {
    const m = this._listsMap();
    const id = listId || this.activeListId;
    const l = id ? m[id] : null; if (!l) return false;
    const at = l.items.indexOf(nodeId); if (at < 0) return false;
    l.items.splice(at, 1); l.t = Date.now();
    if (!l.items.length) { delete m[id]; if (this.activeListId === id) { this.activeListId = this.listsArray()[0] || null; this.set("activeListId", this.activeListId); } }
    this._saveProgress();
    if (this._listFocusId === id && !m[id]) this.clearFocus();
    return true;
  }
  /**
   * Arm the "Undo" offer for a list that is about to stop existing. ONE seam, two callers:
   * the explicit two-step delete, and the removal that empties a list (removeFromList drops a
   * list the moment its last item goes — which used to destroy a NAMED list silently, and the
   * v1.99.4 per-item × puts that one click from a list you are reading). `t` is when the OFFER
   * was made — it expires (an undo row is a reaction, not a permanent record).
   */
  _armListUndo(id, snapshot) {
    this._undoList = { id: id, t: Date.now(), list: { name: snapshot.name, items: snapshot.items.slice(), t: snapshot.t } };
    if (this._undoT) clearTimeout(this._undoT);
    // real setTimeout, not the sim clock: this is UI patience, not game time
    this._undoT = setTimeout(() => { if (this._undoList && this._undoList.id === id) { this._undoList = null; this._refreshListSurfaces(); } }, 90000);
  }
  deleteList(id) {
    const m = this._listsMap(); if (!m[id]) return;
    // stash it whole so the delete is takeable-back (see _undoRowLive / undoDeleteList)
    this._armListUndo(id, m[id]);
    delete m[id];
    if (this._listFocusId === id) this.clearFocus();
    if (this._listEditId === id) this._listEditId = null; // a dead list has no editor
    if (this.activeListId === id) { this.activeListId = this.listsArray()[0] || null; this.set("activeListId", this.activeListId); }
    else this._saveProgress();
    this._refreshListSurfaces();
  }
  /** Open the inline name editor on a list's row (v1.99.3 — clicking the NAME gets here). */
  startListRename(id) {
    if (!this._listsMap()[id]) return;
    this._listEditId = id;
    this._listEditDraft = null;
    this._listEditFocusPending = true;
    this.renderExplorer();
  }
  /**
   * Commit a rename. Empty (or whitespace) reverts, unchanged is a no-op; a REAL rename
   * bumps `t`, because the cloud merge's rule is name-from-later-t (ngMergeLists) — that
   * bump is what carries the new name across the owner's other devices instead of losing
   * it to a stale copy. Bumping `t` also re-sorts the list to the top of listsArray(),
   * which is the same freshness rule every other list touch follows.
   */
  renameList(id, name) {
    const m = this._listsMap(); const l = m[id]; if (!l) return false;
    const nm = String(name == null ? "" : name).replace(/\s+/g, " ").trim();
    if (!nm || nm === l.name) return false;
    l.name = nm;
    l.t = Date.now();
    this._saveProgress();
    this.track("neural_list_renamed", { chars: nm.length });
    return true;
  }
  /** Graph indices of a list. "__shared" is the just-received link (not yet a list of theirs). */
  listIdxs(listId) {
    if (listId === "__shared") return (this._sharedIncoming && this._sharedIncoming.idxs) || [];
    const l = this._listsMap()[listId]; if (!l) return [];
    const out = [];
    for (const id of l.items) { const i = this._idIndex ? this._idIndex.get(id) : null; if (i != null && this.nodes[i]) out.push(i); }
    return out;
  }
  listShareCode(listId) {
    const l = this._listsMap()[listId];
    const ids = listId === "__shared" ? ((this._sharedIncoming && this._sharedIncoming.ids) || []) : (l ? l.items : []);
    if (!ids.length) return "";
    const res = ngListEncodeIds(ids, this._ordinalById());
    if (res.missing && res.missing.length) {
      // a node newer than this build's manifest: one technique is dropped, never the link
      this.track("neural_share_list_missing_ordinal", { count: res.missing.length });
    }
    return res.code;
  }
  listShareUrl(listId) {
    const code = this.listShareCode(listId);
    if (!code) return "";
    let origin = "";
    try { origin = location.origin; } catch (e) { origin = ""; }
    return ngListShareUrl(origin, code);
  }
  async shareList(listId) {
    const code = this.listShareCode(listId);
    if (!code) { this.setEvent("Nothing to share", "Add a technique to this list first", "bad"); return ""; }
    const url = this.listShareUrl(listId);
    const l = this._listsMap()[listId];
    const count = l ? l.items.length : 0;
    const shareId = ngListShareId(code);
    this._lastShareUrl = url; this._lastShareId = shareId;
    this.fx("list_shared", { share_id: shareId, items: count, chars: url.length });
    // canonical encoding => the creator's share_id and every recipient's are the same string,
    // so this joins into a real viral funnel with no server state.
    this.track("neural_share_list_created", { share_id: shareId, items: count, url_chars: url.length });
    const text = (l && l.name ? l.name : "Today's class") + " — " + count + " technique" + (count === 1 ? "" : "s");
    try {
      if (navigator.share && this.isMobile()) { await navigator.share({ title: "BJJGraph", text: text, url: url }); return url; }
    } catch (e) { /* user dismissed the sheet — fall through to the clipboard */ }
    try {
      await navigator.clipboard.writeText(url);
      this.setEvent("Link copied", count + " technique" + (count === 1 ? "" : "s") + " · paste it in the group chat", "good");
    } catch (e) {
      // clipboard denied (or no permission prompt available): show it, selectable, in the row
      this._showShareFallback(listId, url);
    }
    return url;
  }
  _showShareFallback(listId, url) {
    const row = (this.__ngRoot || document).querySelector('[data-list-row="' + listId + '"]');
    if (!row) return;
    let out = row.querySelector("[data-list-url]");
    if (!out) {
      out = document.createElement("input");
      out.setAttribute("data-list-url", "1");
      out.readOnly = true;
      out.style.cssText = "width:100%;margin-top:6px;font-family:inherit;font-size:11px;color:#dbe2f0;background:rgba(255,255,255,.05);border:1px solid rgba(150,170,210,.22);border-radius:7px;padding:5px 7px;pointer-events:auto;";
      row.appendChild(out);
    }
    out.value = url;
    try { out.select(); } catch (e) { /* non-fatal */ }
  }
  /** Light a list on the graph (Explore owns the highlight, exactly like a System). */
  focusList(listId) {
    if (!this.deckShown || this._viewMode !== "explore") this.openPane("explore");
    const idxs = this.listIdxs(listId);
    if (!idxs.length) return;
    this._listFocusId = listId;
    this.setFocusIdxSet(idxs);
    this.renderExplorer(); // keepList carries the selection through the render's own reset
  }
  // ══════════════════════════════════════════════════════════════════════════════════════
  // THE SHARE CUE — the only share control that lives OUTSIDE the pane
  //
  // On a 390x844 phone `.ng-drill` is an 88vw drawer: it IS the screen. Two consequences:
  //  1. A shared-link landing must NOT end inside that drawer. The lit graph is the entire
  //     promise of the link ("open it and see exactly what we drilled") and a drawer over it
  //     delivers none of it. So on a narrow viewport the arrival lights the graph and STOPS —
  //     which serves PANE LAW better, not worse: nothing but the user opens the pane.
  //  2. The control that lights the class again therefore cannot live in the drawer either, or
  //     it is unreachable in the exact state you want it. It is a STANDALONE band control
  //     since v1.99.0 (.ng-sharecue, above the account chip — the drill pill that used to
  //     host it is deleted): fixed, outside the pane, conditional on a live cue.
  //
  // Two zones because they are two different intentions: ◉ lights the class WITHOUT covering
  // it, and "Class ▸" opens the pane to read / save / drill it.
  // ══════════════════════════════════════════════════════════════════════════════════════
  _setShareCue(cue) { this._shareCue = cue || null; this._renderShareCue(); }
  /**
   * One flag on <body> naming the live cue kind — a layout/diagnostic hook for the thumb
   * band (the pill-era CSS that consumed it is gone; specs and snapshots still read it).
   *
   * NAMED `data-share-band`, NOT `data-share-cue`: the cue BUTTON already carries
   * `data-share-cue`, so a body flag of the same name makes `document.querySelector(
   * "[data-share-cue]")` return the whole document body — every measurement of "where is the cue"
   * silently became "the entire 390x844 viewport", and every tap aimed at its centre landed in the
   * middle of the screen. Three share journeys caught it; one attribute name away from shipping a
   * re-light control that could not be tapped at all.
   */
  _markShareCueLayout() {
    try {
      const b = document.body; if (!b) return;
      if (this._shareCue) b.setAttribute("data-share-band", this._shareCue.kind || "1");
      else b.removeAttribute("data-share-band");
    } catch (e) { /* non-fatal */ }
  }
  _renderShareCue() {
    // STANDALONE since v1.99.0 — the drill pill that used to host these buttons is deleted.
    // The cue is a conditional control in the thumb band (above the account chip): rendered
    // ONLY while a cue exists, hidden while the pane owns its corner, gone otherwise.
    const host = this.shareCueRef.current; if (!host) return;
    try { host.querySelectorAll("[data-share-cue],[data-share-open]").forEach((el) => el.remove()); } catch (e) { /* non-fatal */ }
    const cue = this._shareCue;
    this._markShareCueLayout();
    if (!cue || this.deckOpen) { host.style.display = "none"; return; }
    // a class cue whose list no longer resolves (deleted, merged away) is not a cue: dropping it
    // here means the control can never offer to light a set that does not exist
    // (re-entering with a null cue takes the branch above — one level, no recursion)
    if (cue.kind === "class" && !this.listIdxs(cue.target).length) { this._shareCue = null; return this._renderShareCue(); }
    const mk = (attr, label, title, tint, onClick) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute(attr, cue.kind);
      b.title = title;
      b.innerHTML = label;
      // pointer-events:auto INLINE — the property is inherited, the overlay root disables it and
      // the canvas hit-tests above anything that does not re-enable it (this repo has paid for
      // that twice: v1.69.1, v1.81.2). 44px targets (v1.99.0).
      b.style.cssText = "flex:none;pointer-events:auto;cursor:pointer;font-family:inherit;font-size:11px;font-weight:700;line-height:1;min-height:44px;min-width:44px;padding:8px 12px;margin-left:8px;border-radius:11px;border:1px solid " + tint[0] + ";background:" + tint[1] + ";color:" + tint[2] + ";white-space:nowrap;box-shadow:0 6px 22px rgba(0,0,0,.4);";
      b.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); onClick(); });
      host.appendChild(b);
      return b;
    };
    const green = ["rgba(126,224,168,.45)", "rgba(126,224,168,.15)", "#cdebd9"];
    const amber = ["rgba(232,185,138,.45)", "rgba(232,185,138,.15)", "#f0d5b4"];
    if (cue.kind === "class") {
      const lit = this._listFocusId === cue.target && this._focusIdxSet && this._focusIdxSet.size;
      mk("data-share-cue", (lit ? "◉" : "◎") + " " + cue.n, "Light this class on the graph again", green, () => this.relightShare());
      mk("data-share-open", "Class ▸", "Read, save or drill the shared class", green, () => this.openShareCue());
    } else {
      // the cue says exactly what the panel says (see _brokenCopy): a cue that contradicts
      // the explanation it opens is worse than no cue
      const label = cue.kind === "stale" ? "Newer link ▸" : this._brokenCopy().pill;
      mk("data-share-open", label, "What happened to this shared link", amber, () => this.openShareCue());
    }
    host.style.display = "flex";
  }
  /** Light the shared class again WITHOUT covering it — the mobile answer to "where did it go". */
  relightShare() {
    const cue = this._shareCue; if (!cue || !cue.target) return false;
    const idxs = this.listIdxs(cue.target);
    if (!idxs.length) return false;
    this._listFocusId = cue.target;
    this.setFocusIdxSet(idxs); // frames the class too: the camera goes back to what the link was for
    this.fx("list_relit", { list: cue.target, items: idxs.length, shared: cue.target === "__shared" });
    this.track("neural_share_list_relit", { items: idxs.length, shared: cue.target === "__shared" });
    this.setEvent("On the graph", idxs.length + " technique" + (idxs.length === 1 ? "" : "s") + " from this class", "good");
    if (this.deckShown && this._viewMode === "explore" && !this._paneStudyActive()) this.renderExplorer();
    this._renderShareCue();
    return true;
  }
  /** The recipient's deliberate "let me read it": the pane, on Explore, with the class kept lit. */
  openShareCue() {
    const cue = this._shareCue;
    this.openPane("explore");
    if (cue && cue.target && this.listIdxs(cue.target).length) {
      this._listFocusId = cue.target;
      this.setFocusIdxSet(this.listIdxs(cue.target), true);
      this.renderExplorer();
    }
    this.track("neural_share_cue_opened", { kind: cue ? cue.kind : "none" });
  }
  /** A session over a list's decks — the "and drill them" half of the thesis. */
  openListSession(listId) {
    const idxs = this.listIdxs(listId);
    if (!idxs.length) return;
    const keys = [];
    for (const i of idxs) { const k = this.deckKeyFor(this.nodes[i]).key; if (k && keys.indexOf(k) < 0) keys.push(k); }
    if (!keys.length) return;
    const l = this._listsMap()[listId];
    const label = listId === "__shared" ? "Shared class" : (l && l.name) || "Class list";
    this._session = { keys: keys, label: label, idx: 0 };
    this._sessionNodes = idxs;
    this.frameNodes(idxs);
    this.renderSession();
    this.deckReady = true; this.deckOpen = true; this.applyDeckVisibility();
    this.track("neural_share_list_drill", { list: listId, techniques: keys.length, shared: listId === "__shared" });
  }

  // ---------- add affordance (dossier, Explore rows, landing card, challenge lesson rows) ----------
  /**
   * The name a technique must be called by ANYWHERE a list is read: the FULL authored name,
   * qualifier included. `splitName().main` is a display shorthand for surfaces that show the
   * `from …` line separately — on its own it is ambiguous to the point of uselessness: this
   * corpus has 35 techniques whose main name is "Kimura" and 16 called "Americana", and 648 of
   * 1467 nodes carry a qualifier. "Americana" is not a technique a coach taught; "Americana
   * from Mount" is. A share link that drops the qualifier destroys its own purpose.
   */
  listItemName(nodeId) {
    const i = this._idIndex ? this._idIndex.get(nodeId) : null;
    const n = i != null ? this.nodes[i] : null;
    return n ? n.t : nodeId;
  }
  toggleListItem(nodeId, surface) {
    const had = this.activeListHas(nodeId);
    // full name, not splitName().main — setEvent renders the `from …` half on its own line
    const name = this.listItemName(nodeId);
    // ONE remove path (v1.99.4): the ✓ toggle and the expanded list's × are the same call, so
    // the toast, the persist, the undo offer and the graph re-light can never diverge.
    if (had) return void this.removeListItem(nodeId, this.activeListId);
    const r = this.addToList(nodeId);
    if (r.added) {
      this.setEvent("Added to today’s list · " + r.count + " technique" + (r.count === 1 ? "" : "s"), name, "good");
      this.track("neural_list_item_added", { surface: surface || "unknown", count: r.count });
    } else if (r.reason === "full") {
      this.setEvent("List is full", "A share link holds " + NG_LIST_ITEM_CAP + " techniques", "bad");
    }
    this._refreshListSurfaces();
  }
  /**
   * THE remove path for one technique, from any surface — the ✓ toggle (active list) and the
   * expanded row's × (that row's list, whichever it is).
   *
   * It is NOT the _listAddButton: that button's ✓/+ is defined against the ACTIVE list
   * (activeListHas / addToList with no id). Inside a list's own disclosure the technique is a
   * member of THAT list by construction, so a toggle there would be a mislabel at best and, on
   * any list that is not the active one, would silently ADD the technique to a DIFFERENT list
   * instead of removing it from the one being read. An explicit × addressed to `listId` is the
   * only affordance that says what it does.
   */
  removeListItem(nodeId, listId) {
    const m = this._listsMap();
    const id = listId || this.activeListId;
    const l = id ? m[id] : null;
    if (!l || l.items.indexOf(nodeId) < 0) return false;
    const name = this.listItemName(nodeId); // FULL qualified name — 35 techniques are "Kimura"
    const where = l.name ? "“" + l.name + "”" : "today’s list";
    // removeFromList DELETES a list whose last item just left; snapshot first so that deletion
    // is takeable back through the same undo row the two-step delete uses
    const snapshot = l.items.length === 1 ? { name: l.name, items: l.items.slice(), t: l.t } : null;
    if (!this.removeFromList(nodeId, id)) return false;
    if (snapshot && !m[id]) this._armListUndo(id, snapshot);
    this.setEvent("Removed from " + where, name, "bad");
    // the lit graph follows the list it is lighting. noFrame: a removal must not fly the camera
    // — the user is reading a row, not asking to be taken somewhere. (removeFromList already
    // clearFocus()es when the list itself is gone.)
    if (this._listFocusId === id && m[id]) {
      const ki = this.listIdxs(id);
      if (ki.length) this.setFocusIdxSet(ki, true); else this.clearFocus();
    }
    this._refreshListSurfaces();
    return true;
  }
  /**
   * The words on a capture control. Two things changed in v1.99.5:
   *  · the ✓ now means "in ANY of your lists", not "in the ACTIVE one" — with two lists the old
   *    glyph told you a technique was uncaptured while it sat in the other list;
   *  · the control NAMES ITS DESTINATION. That is the whole answer to "how does it know what
   *    list?" on the one-tap path, and it has to be a real accessible name, not a `title`:
   *    a phone has no hover.
   */
  _captureCopy(nodeId) {
    const on = this.nodeInAnyList(nodeId);
    const m = this._listsMap();
    if (on) {
      // A CONTROL SAYS WHAT IT DOES, NOT WHAT IS TRUE (v1.113.5). This read "In your class list
      // “Class · Aug 12” — choose where it goes": a status report where the hover of an action
      // belongs. The membership is already carried by the ✓ glyph and aria-pressed; the label's
      // job is the verb, with the state as a short aside.
      const names = this.listsWith(nodeId).map((k) => "“" + m[k].name + "”");
      return { on: true, label: "Add to a list — already in " + names.join(", ") };
    }
    // NO DESTINATION IN THE LABEL (v1.101.9). It used to read "Add to class list “Class · Aug 12”"
    // — naming a list the user never picked, on a control that now always asks.
    return { on: false, label: "Add to a list" };
  }
  _styleListAdd(el, nodeId) {
    const c = this._captureCopy(nodeId), on = c.on;
    // A GLYPH IS NOT A LABEL. The sheet's capture was described as "a 44px labelled target" while
    // its whole text was "+" and its only words were in a `title` — invisible on a phone, where
    // there is no hover. Surfaces with room (data-list-label) say it in words; the cramped ones
    // keep the glyph but carry a real accessible name, which a `title` is not.
    const labelled = el.getAttribute("data-list-label") === "1";
    el.textContent = labelled ? (on ? "✓ In class" : "+ Add to class") : (on ? "✓" : "+");
    el.title = c.label;
    el.setAttribute("aria-label", c.label);
    el.setAttribute("aria-pressed", on ? "true" : "false");
    el.style.color = on ? "#7ee0a8" : "#9ab0e0";
    el.style.borderColor = on ? "rgba(126,224,168,.45)" : "rgba(150,170,210,.28)";
    el.style.background = on ? "rgba(126,224,168,.12)" : "rgba(255,255,255,.04)";
  }
  _listAddButton(nodeId, surface) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-list-add", nodeId);
    b.setAttribute("data-list-surface", surface || "explore");
    // THUMB SIZE, ON THE SURFACES A THUMB USES. The in-roll surfaces — the option hand, the escape
    // hand (same card builder) and the landing card — are hit mid-roll, one-handed, on a moving
    // screen: 24x24 there was about half the 44px minimum this feature applies to its own sheet,
    // for the hardest tap of the three. The pane's list rows keep the compact glyph: the ROW is
    // the target there and the + sits beside it.
    // "sheet" joins them (v1.102.1): its capture is the compact corner glyph now, not a labelled
    // footer button, and 24px in a corner is exactly the target a thumb misses. The GLYPH stays
    // small on both form factors; only the hit area grows.
    const thumb = this.isMobile() && (surface === "option" || surface === "land" || surface === "sheet");
    const size = thumb ? 44 : 24;
    // pointer-events:auto INLINE — the property is inherited, fixed overlays disable it at the
    // root and the canvas hit-tests above anything that does not re-enable it. This exact trap
    // made the landing card's options (and the retired coach's Next) unclickable by mouse.
    b.style.cssText = "flex:none;pointer-events:auto;cursor:pointer;font-family:inherit;font-size:" + (thumb ? "17px" : "13px") + ";font-weight:700;line-height:1;width:" + size + "px;height:" + size + "px;border-radius:" + (thumb ? 11 : 7) + "px;border:1px solid rgba(150,170,210,.28);background:rgba(255,255,255,.04);display:inline-flex;align-items:center;justify-content:center;";
    this._styleListAdd(b, nodeId);
    // captureNode is the ONE seam: one tap while there is nothing to choose, the picker the
    // moment there is (see the picker's header comment for the matrix and its reasoning).
    b.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); this.captureNode(nodeId, surface, b); });
    return b;
  }
  /**
   * ▶ PLAY BELONGS TO A TECHNIQUE, NOT TO A COLLECTION (v1.103.6, owner: "that play button
   * should be reserved for techniques inside lists and outside of it, meaning positions,
   * transitions, and submissions"). ▶ means "make this the current state and roll", which is
   * a thing you can do to a position or a technique and NOT to a list — a list is a collection,
   * like a System. `confirmPlayFrom` is the seam because it already handles every node type
   * (a position seeds at itself, a technique at its origin position) AND it confirms first:
   * pressing play in the pane mid-roll discards the roll you are in, so it must ask.
   */
  /** A stroked, ROTATING caret — the disclosure half of the chip rule (v1.113.5). Deliberately
   *  not a filled triangle: `▸` and the play glyph were the same shape, and shape is the first
   *  thing the eye sorts on. Thin strokes, no box, and it turns when it opens. */
  _caretHTML(open) {
    return '<span class="ng-caret" data-open="' + (open ? "1" : "0") + '" aria-hidden="true">' +
      '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg></span>';
  }
  _playButton(node) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-play-from", node.id);
    const nm = this.displayName ? this.displayName(node) : this.splitName(node.t).main;
    b.setAttribute("aria-label", "Play from " + nm);   // a title is not an accessible name
    b.title = "Play from " + nm;
    // ACTIONS ARE CHIPS (v1.113.5, owner). Play wears the `+`'s own outline, which makes it the
    // only bordered triangle in the pane and ends its collision with the chevron. The class
    // carries hover/active/focus-visible; a JS `mouseenter` painter cannot express the last one.
    b.className = "ng-actchip";
    b.style.pointerEvents = "auto";
    b.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>';
    b.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); this.confirmPlayFrom(node); });
    return b;
  }
  /** Wrap an Explore row so the row keeps its click and gains a + on the right. */
  _withListAdd(rowEl, node, surface) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;align-items:center;gap:4px;width:100%;";
    rowEl.style.flex = "1"; rowEl.style.minWidth = "0";
    wrap.appendChild(rowEl);
    // ▶ then + : play is the primary verb on a technique row, capture the secondary one.
    // Only reached from renderGraphGroup (Positions/Transitions/Submissions) and a list's own
    // items — Systems, Principles and Learning use different builders and stay play-less.
    wrap.appendChild(this._playButton(node));
    wrap.appendChild(this._listAddButton(node.id, surface));
    return wrap;
  }
  /** Wire the .dsList row emitted by BOTH dossier renderers (pane/sheet and the in-node card). */
  _wireDossierListButton(dos, n, surface) {
    const lb = dos ? dos.querySelector(".dsList") : null; if (!lb) return;
    lb.setAttribute("data-list-add", n.id);
    lb.setAttribute("data-list-surface", surface || "dossier");
    lb.style.pointerEvents = "auto"; // inherited property; the canvas hit-tests above anything that doesn't re-enable it
    const paint = () => {
      const c = this._captureCopy(n.id), on = c.on;
      const g = lb.querySelector(".dsListGlyph"), t = lb.querySelector(".dsListTxt");
      if (g) { g.textContent = on ? "\u2713" : "+"; g.style.color = on ? "#7ee0a8" : "#9ab0e0"; }
      // the VISIBLE words stay short and fixed-width. The destination goes in the accessible
      // name, not into this row's text: the in-node dossier card is laid out at the node's own
      // screen point, and a longer label grew it far enough to slide this control under the
      // landing card's MC options — measured, and it cost the dossier capture entirely. The
      // "Adding to <list>" line in the Lists head is where the destination is READ.
      // ONE PROMISE PER CONTROL (v1.113.5): the visible words said "today's class list" while
      // the title said "a class list" — two different promises on one button, and the picker
      // has asked WHICH list since v1.102.0, so "today's" was never true anyway.
      if (t) t.textContent = on ? "In a list" : "Add to a list";
      lb.title = c.label;
      lb.setAttribute("aria-label", c.label);
      lb.setAttribute("aria-pressed", on ? "true" : "false");
    };
    paint();
    lb._ngPaint = paint; // the picker's refresh repaints this row too
    lb.addEventListener("click", (e) => { e.stopPropagation(); this.captureNode(n.id, surface || "dossier", lb); });
  }
  _refreshListSurfaces() {
    const root = this.__ngRoot || document;
    try {
      root.querySelectorAll("[data-list-add]").forEach((el) => {
        // the dossier's .dsList row has its own painter (glyph + words in child spans); the
        // plain buttons take _styleListAdd. One loop, so no surface can be left stale.
        if (el._ngPaint) el._ngPaint(); else this._styleListAdd(el, el.getAttribute("data-list-add"));
      });
    } catch (e) { /* non-fatal */ }
    // re-render the Explore body so the Lists section's counts follow the model. Safe while a
    // dossier is up: the list element is hidden behind it, and renderExplorer preserves an
    // intentional list highlight (keepList) instead of clearing it.
    if (this.deckShown && this._viewMode === "explore" && !this._paneStudyActive()) this.renderExplorer();
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // THE LIST PICKER (v1.99.5) — "how does it know what list?"
  //
  // THE BUG: `addToList(nodeId)` defaults to `activeListId`, and `_listAddButton` toggled
  // against `activeListHas()`. With two lists every + filed into whichever was last created
  // or touched, with the destination invisible and unchosen — silent misfiling, the worst kind
  // of data bug, because nothing looks wrong until a coach shares the wrong class.
  //
  // WHEN THE PICKER OPENS, AND WHY NOT ALWAYS (decision, v1.99.5):
  //   0 lists, not captured  → create "Class · <date>" and add. ONE tap.
  //   1 list,  not captured  → add to it. ONE tap. There is no second destination to choose.
  //   ≥2 lists, not captured → PICKER. The choice is real, so it is asked.
  //   already in a list      → PICKER, at any count. (This is also a fix: the ✓ used to remove
  //                            from the ACTIVE list, which with two lists could be a list the
  //                            technique was never in.)
  // The reference the owner named is YouTube's "Save to playlist", where the sheet opens every
  // time. It opens here only where selection MEANS something, for two reasons. First, canon:
  // capture "never commits the move and never stops the clock" — the + is pressed mid-roll, on
  // an option card, with the decision window draining, and taxing every capture with a chooser
  // to solve a problem single-list users do not have is the wrong trade. Second, the create-
  // inline affordance stays reachable everywhere anyway: pressing + on an already-captured
  // technique opens the picker on ANY surface, so "put this in a new list" is one tap from a ✓,
  // at every list count. And the destination is never a mystery even on the one-tap path — the
  // button's own title/aria names it ("Add to “Monday fundamentals”"), and the Lists head
  // named the destination in a persistent line under the head (retired in v1.103.3).
  //
  // THE CLOCK KEEPS RUNNING. The picker is anchored chrome, not a screen: it never pauses, it
  // closes on the first outside pointerdown or Esc, and it CLOSES ON PICK rather than staying
  // open YouTube-style — a menu left open over the option tray is exactly what "never blocks
  // the option hand" forbids. Capturing into a second list costs a second press of the +.
  // ══════════════════════════════════════════════════════════════════════════════════════
  /** Is this technique in ANY list? The + glyph answers that, not "is it in the active one". */
  nodeInAnyList(nodeId) {
    const m = this._listsMap();
    for (const k of Object.keys(m)) if (m[k].items.indexOf(nodeId) >= 0) return true;
    return false;
  }
  /** Every list holding this technique, for the button's title and the picker's checks. */
  listsWith(nodeId) {
    const m = this._listsMap();
    return Object.keys(m).filter((k) => m[k].items.indexOf(nodeId) >= 0);
  }
  /** The list the picker offers FIRST — its `[data-picker-default]` row. Not a silent
   *  destination any more: since v1.102.0 nothing files without a pick. */
  targetList() {
    const m = this._listsMap();
    if (this.activeListId && m[this.activeListId]) return this.activeListId;
    return this.listsArray()[0] || null;
  }
  /** Picker order: the default destination first, then most-recently-touched. */
  _pickerOrder() {
    const t = this.targetList();
    const rest = this.listsArray().filter((k) => k !== t);
    return t ? [t].concat(rest) : rest;
  }
  closeListPicker() {
    if (!this._pickEl) return false;
    try { this._pickEl.remove(); } catch (e) { /* non-fatal */ }
    this._pickEl = null;
    if (this._pickAway) { document.removeEventListener("pointerdown", this._pickAway, true); this._pickAway = null; }
    const a = this._pickAnchor; this._pickAnchor = null; this._pickNode = null;
    if (a) { try { a.setAttribute("aria-expanded", "false"); a.focus(); } catch (e) { /* non-fatal */ } }
    return true;
  }
  /**
   * Anchor the menu to the button that opened it, CLAMPED to the viewport. On a 390px phone the
   * + is pressed on an option card sitting in a tray at the bottom of the screen, inside an 88vw
   * drawer, above a thumb band — an un-clamped drop-down would land under all three. So: measured
   * anchor rect, prefer above, flip below when there is no room above, clamp both axes to an 8px
   * inset. Fixed positioning + the root portal keep it out of every local stacking context.
   */
  _placeListPicker(el, anchor) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = anchor ? anchor.getBoundingClientRect() : { left: vw / 2, right: vw / 2, top: vh / 2, bottom: vh / 2 };
    const w = Math.min(272, vw - 16);
    el.style.width = w + "px";
    const h = el.offsetHeight || 220;
    let left = Math.round(r.left + r.width / 2 - w / 2);
    left = Math.max(8, Math.min(left, vw - w - 8));
    let top = Math.round(r.top - h - 8);           // prefer ABOVE: the + often sits low on screen
    if (top < 8) top = Math.round(r.bottom + 8);   // no room -> below
    // IT MUST NOT COVER THE OPTION HAND. The + it hangs off is often ON an option card, and a
    // menu over the tray does not merely look wrong: at z:90 it OWNS those taps, so the card the
    // user reaches for next delivers its click to a "New list" row instead. (Caught by
    // lists-picker's clock journey, where committing the move became impossible.) The tray's
    // measured top is the ceiling; only a viewport with no room above it gives way.
    const tray = this.optionsRef && this.optionsRef.current;
    if (tray) {
      const tr = tray.getBoundingClientRect();
      if (tr.height > 0 && top + h > tr.top - 8) {
        const above = Math.round(tr.top - h - 8);
        if (above >= 8) top = above;
      }
    }
    top = Math.max(8, Math.min(top, vh - h - 8));
    el.style.left = left + "px";
    el.style.top = top + "px";
  }
  openListPicker(nodeId, surface, anchor) {
    this.closeListPicker();
    this.closeAccountMenu();
    const root = this.__ngRoot || document.body;
    const el = document.createElement("div");
    el.className = "ng-listpicker";
    el.setAttribute("data-list-picker", nodeId);
    el.setAttribute("data-list-surface", surface || "unknown");
    el.setAttribute("role", "menu");
    el.setAttribute("aria-label", "Add to list");
    // Z LADDER (helmet.html): 90-99 is the deliberate-temporary-screen band. The picker is a
    // screen the user asked for, so it must not be underdrawn by the landing card (5), the
    // option sheet; it sits with the account menu at 90, under the modal 95.
    el.style.cssText = "position:fixed;z-index:90;pointer-events:auto;display:flex;flex-direction:column;";
    root.appendChild(el);
    this._pickEl = el; this._pickNode = nodeId; this._pickAnchor = anchor || null;
    this._pickNewOpen = !this.listsArray().length; // no lists -> the create row IS the picker
    // THE LANDING CARD STAYS PUT (v1.103.2). It used to be hidden while the picker was up, on the
    // reasoning that on a phone the picker's band is exactly where the card lives. Owner: the +
    // "should show the list of lists to choose from without hiding ng-landcard". Right — the
    // picker is z:90 on the root plane and the card is z:5, so it already paints above it; hiding
    // the thing you were reading in order to answer a question ABOUT it is the wrong trade.
    if (anchor) anchor.setAttribute("aria-expanded", "true");
    this.renderListPicker();
    this._placeListPicker(el, anchor);
    this._pickAway = (e) => {
      if (el.contains(e.target) || (anchor && anchor.contains(e.target))) return;
      this.closeListPicker();
    };
    document.addEventListener("pointerdown", this._pickAway, true);
    this.track("neural_list_picker_opened", { surface: surface || "unknown", lists: this.listsArray().length });
    return el;
  }
  renderListPicker() {
    const el = this._pickEl; if (!el) return;
    const nodeId = this._pickNode;
    const m = this._listsMap();
    el.innerHTML = "";
    const head = document.createElement("div");
    head.setAttribute("data-picker-head", "1");
    head.className = "ng-listpicker-head";
    // the technique being filed, named in FULL — the picker is where a mis-file is prevented,
    // so it cannot be vague about which of the 35 Kimuras is going where
    head.innerHTML = '<b>Add to list</b><small>' + this.escHTML(this.listItemName(nodeId)) + '</small>';
    el.appendChild(head);
    const body = document.createElement("div");
    body.className = "ng-listpicker-body";
    el.appendChild(body);
    for (const id of this._pickerOrder()) {
      const l = m[id]; if (!l) continue;
      const on = l.items.indexOf(nodeId) >= 0;
      const isTarget = id === this.targetList();
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "menuitemcheckbox");
      b.setAttribute("data-list-pick", id);
      b.setAttribute("aria-checked", on ? "true" : "false");
      if (isTarget) b.setAttribute("data-picker-default", "1");
      b.className = "ng-listpicker-row";
      b.setAttribute("aria-label", (on ? "Remove from " : "Add to ") + l.name);
      b.innerHTML =
        '<span class="ng-listpicker-box" data-picker-check="' + (on ? "1" : "0") + '" aria-hidden="true">' + (on ? "✓" : "") + '</span>' +
        '<span class="ng-listpicker-name">' + this.escHTML(l.name) + '</span>' +
        '<span class="ng-listpicker-n">' + l.items.length + '</span>';
      b.addEventListener("click", (e) => {
        e.stopPropagation(); e.preventDefault();
        this.pickList(id, nodeId);
      });
      body.appendChild(b);
    }
    // ── inline create, the YouTube "New playlist" row: name it and file it in one action ──
    if (this._pickNewOpen) {
      const wrap = document.createElement("div");
      wrap.className = "ng-listpicker-new";
      const inp = document.createElement("input");
      inp.setAttribute("data-list-pick-newname", "1");
      inp.setAttribute("aria-label", "New list name");
      inp.maxLength = 60;
      inp.value = ngListDefaultName(new Date()); // offered, never demanded — Enter keeps it
      inp.className = "ng-listpicker-input";
      let done = false;
      const commit = () => {
        if (done) return; done = true;
        this.createListWith(inp.value, nodeId);
      };
      inp.addEventListener("keydown", (e) => {
        e.stopPropagation(); // the editor owns the keyboard: A/B/C/D, digits, and Esc
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        else if (e.key === "Escape") { e.preventDefault(); done = true; this.closeListPicker(); }
      });
      inp.addEventListener("pointerdown", (e) => e.stopPropagation());
      wrap.appendChild(inp);
      const go = document.createElement("button");
      go.type = "button";
      go.setAttribute("data-list-pick-create", "1");
      go.className = "ng-listpicker-go";
      go.textContent = "Create";
      go.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); commit(); });
      wrap.appendChild(go);
      el.appendChild(wrap);
      setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) { /* non-fatal */ } }, 0);
    } else {
      const nb = document.createElement("button");
      nb.type = "button";
      nb.setAttribute("role", "menuitem");
      nb.setAttribute("data-list-pick-new", "1");
      nb.className = "ng-listpicker-row ng-listpicker-newrow";
      nb.innerHTML = '<span class="ng-listpicker-box" aria-hidden="true">+</span><span class="ng-listpicker-name">New list</span>';
      nb.addEventListener("click", (e) => {
        e.stopPropagation(); e.preventDefault();
        this._pickNewOpen = true;
        this.renderListPicker();
        this._placeListPicker(el, this._pickAnchor); // the menu just grew — re-clamp it
      });
      el.appendChild(nb);
    }
  }
  /** A row in the picker: toggle THIS node's membership of THAT list, then get out of the way. */
  pickList(listId, nodeId) {
    const l = this._listsMap()[listId]; if (!l) return false;
    const on = l.items.indexOf(nodeId) >= 0;
    const anchor = this._pickAnchor;
    const surface = this._pickEl ? this._pickEl.getAttribute("data-list-surface") : "picker";
    this.closeListPicker(); // decisive: the option hand must not sit under an open menu
    if (on) { this.removeListItem(nodeId, listId); return true; }
    const r = this.addToList(nodeId, listId);
    if (r.added) {
      this.setEvent("Added to “" + l.name + "” · " + r.count + " technique" + (r.count === 1 ? "" : "s"), this.listItemName(nodeId), "good");
      this.track("neural_list_item_added", { surface: surface || "picker", count: r.count, via: "picker" });
    } else if (r.reason === "full") {
      this.setEvent("List is full", "A share link holds " + NG_LIST_ITEM_CAP + " techniques", "bad");
    }
    this._refreshListSurfaces();
    if (anchor) { try { anchor.focus(); } catch (e) { /* non-fatal */ } }
    return true;
  }
  /** The inline-create commit: one action makes the list AND files the technique into it. */
  createListWith(name, nodeId) {
    const anchor = this._pickAnchor;
    this.closeListPicker();
    const id = this.newList(String(name == null ? "" : name).replace(/\s+/g, " ").trim() || undefined);
    this.track("neural_list_created", { surface: "picker" });
    const r = this.addToList(nodeId, id);
    const l = this._listsMap()[id];
    if (r.added) {
      this.setEvent("Added to “" + l.name + "” · " + r.count + " technique" + (r.count === 1 ? "" : "s"), this.listItemName(nodeId), "good");
      this.track("neural_list_item_added", { surface: "picker", count: r.count, via: "picker_new" });
    }
    this._refreshListSurfaces();
    if (anchor) { try { anchor.focus(); } catch (e) { /* non-fatal */ } }
    return id;
  }
  /**
   * What a press of + does. The matrix is documented on the picker above; this is the seam
   * every surface's + and both dossier renderers route through, so no surface can drift.
   */
  /**
   * THE PICKER ALWAYS OPENS — NOTHING IS EVER ASSUMED (v1.101.9).
   *
   * v1.99.5 took a shortcut: with zero or one list and the technique not yet captured, the `+`
   * filed it straight into `activeListId` — "unambiguous: one destination". Owner: "list of
   * lists should show before adding anything, instead of showing it already green and saying
   * 'added to list whatever was being added last' — rather let the user select which list to
   * add to. dont assume." They are right on both counts. "One list" is only unambiguous the
   * first time; from the second onward `activeListId` is whichever list was last created or
   * touched, which is not a destination the user chose, and the ✓ that followed announced a
   * filing they never made.
   *
   * The canon this overturns — "capture never blocks the option hand, so do not tax it with a
   * chooser" — was written when every option card in the dealt hand carried its own `+`, mid-roll
   * with the decision window draining. Those went in v1.101.1. What is left is the landing card's
   * corner and the technique sheet: surfaces you are already reading, where a two-tap choice is
   * a choice, not a tax. The picker's own create-inline row covers the zero-list case, so a first
   * capture is still one decision — it is just an EXPLICIT one.
   */
  captureNode(nodeId, surface, anchor) {
    this.openListPicker(nodeId, surface, anchor);
    return "picker";
  }

  /**
   * ONE technique inside an expanded list — deliberately the SAME shape as _sharedBlock's
   * item (name button → openDossier, control on the right), because the asymmetry between the
   * two was the bug: a class a teammate sent you named every technique, your own named none.
   *
   * THE NAME IS THE FULL AUTHORED NAME: splitName().main plus the dimmer `from <position>`
   * qualifier. Non-negotiable — 648 of 1467 nodes carry a qualifier, "Kimura" alone is 35
   * different techniques here and "Americana" 16, so main-only would make your own class as
   * unreadable as a share link that dropped the qualifier.
   */
  _listItemRow(nodeId, listId) {
    const i = this._idIndex ? this._idIndex.get(nodeId) : null;
    const n = i != null ? this.nodes[i] : null;
    const item = document.createElement("div");
    item.setAttribute("data-list-itemrow", nodeId);
    // EXPLORE'S ITEM ROW (v1.103.4): the same 22px indent, 8px gap and hover wash its sections
    // give a position or a technique — because that is exactly what these are.
    item.style.cssText = "display:flex;align-items:center;gap:8px;min-width:0;padding:7px 12px 7px 38px;border-radius:7px;";
    item.addEventListener("mouseenter", () => item.style.background = "rgba(255,255,255,.045)");
    item.addEventListener("mouseleave", () => item.style.background = "transparent");
    // the category shape, same vocabulary as the canvas and as Explore's own rows
    if (n) { const g = document.createElement("span"); g.style.cssText = "flex:none;display:inline-flex;align-items:center;"; g.innerHTML = this.nodeGlyph(n.ty, this.hex(n.col), 7); item.appendChild(g); }
    const nameBtn = document.createElement("button");
    nameBtn.type = "button";
    nameBtn.setAttribute("data-list-item", nodeId);
    nameBtn.setAttribute("data-list-of", listId);
    // pointer-events:auto INLINE — inherited property, the overlay root disables it and the
    // canvas hit-tests above anything that does not re-enable it (v1.69.1 / v1.81.2).
    // 12px #9aa6bd with the qualifier in #6b7691 — byte for byte what Explore's leaf rows use
    nameBtn.style.cssText = "flex:1;min-width:0;pointer-events:auto;cursor:pointer;font-family:inherit;text-align:left;border:0;background:transparent;padding:0;font-size:12px;color:#9aa6bd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    if (n) {
      const sp = this.splitName(n.t);
      nameBtn.innerHTML = this.escHTML(sp.main) +
        (sp.from ? ' <span style="color:#6b7691;">' + this.escHTML(sp.from) + '</span>' : "");
      nameBtn.title = n.t; // the full name survives the ellipsis on a 390px drawer
      nameBtn.setAttribute("aria-label", n.t);
    } else {
      // an id this build cannot resolve (a list synced from a newer build): name it, don't hide it
      nameBtn.textContent = nodeId;
    }
    if (i != null) nameBtn.addEventListener("click", (e) => { e.stopPropagation(); this.openDossier(i); });
    item.appendChild(nameBtn);
    if (n) item.appendChild(this._playButton(n));   // ▶ is the technique's, on every surface
    const rm = document.createElement("button");
    rm.type = "button";
    rm.setAttribute("data-list-item-remove", nodeId);
    rm.setAttribute("data-list-of", listId);
    rm.textContent = "×";
    rm.title = "Remove from this list";
    rm.setAttribute("aria-label", "Remove " + (n ? n.t : nodeId) + " from this list");
    // 22px, not 44 — a 44px control inside a 30px row IS the row's height, which is what made
    // these read as cards among Explore's rows. The pane is a scroller, not a thumb band.
    rm.style.cssText = "flex:none;width:24px;height:24px;pointer-events:auto;cursor:pointer;font-family:inherit;font-size:13px;line-height:1;border:0;border-radius:7px;background:transparent;color:#6b7691;display:inline-flex;align-items:center;justify-content:center;";
    rm.addEventListener("mouseenter", () => { rm.style.background = "rgba(255,255,255,.08)"; rm.style.color = "#dbe2f0"; });
    rm.addEventListener("mouseleave", () => { rm.style.background = "transparent"; rm.style.color = "#6b7691"; });
    rm.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); this.removeListItem(nodeId, listId); });
    item.appendChild(rm);
    return item;
  }

  // ---------- the Lists section (top of Explore) ----------
  renderLists(list) {
    const sec = document.createElement("div");
    sec.setAttribute("data-lists-section", "1");
    sec.style.cssText = "margin:2px 0 10px;padding-bottom:10px;border-bottom:1px solid rgba(150,170,210,.12);";
    const ids = this.listsArray();
    // READ ORDER: what ARRIVED comes first. A first-time recipient reading "Lists (0)" above
    // "Shared with you · 5 techniques" is being told two contradictory things about the same
    // screen — and the count they care about is not the one about lists they have never made.
    if (this._sharedIncoming) sec.appendChild(this._sharedBlock());
    else if (this._sharedStale) sec.appendChild(this._staleBlock());
    else if (this._sharedBroken) sec.appendChild(this._brokenBlock());
    if (this._undoRowLive()) sec.appendChild(this._undoRow());

    const head = document.createElement("div");
    head.setAttribute("data-lists-head", "1");
    head.style.cssText = "display:flex;align-items:center;gap:8px;padding:0 6px 0 12px;min-height:36px;";
    head.innerHTML =
      // "Your lists (0)" — the count is explicit even at zero (owner's call, v1.95.0), and
      // "Your" scopes it so it no longer contradicts an incoming shared block above: the
      // shared class is theirs to save, the zero is about lists of your own.
      '<span style="font-size:14px;font-weight:700;color:#dbe2f0;">Your lists</span>' +
      '<span style="font-size:11px;color:#7e8aa3;">(' + ids.length + ')</span>';
    // THE + IS HOW A LIST IS BORN (v1.97.0, owner). It replaced the "share a class" caption
    // — which was a static label, not a control (creation only happened implicitly through
    // a technique's +). Reuses newList(): the SAME function the implicit add path and the
    // shared-class save use — the new list carries the established default name
    // ("Class · <date>"), becomes the active add target immediately, and its row highlights.
    // Per-list Share buttons are untouched.
    // Design pass v1.99.3 (owner: "looks ugly as fuck"): the visual is a compact
    // .ng-lists-new-chip inside the 44px hit target, with CSS hover/press/focus states in
    // helmet.html (the .ng-anchor-* house pass) — no JS hover painting.
    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "ng-lists-new";
    plus.setAttribute("data-lists-new", "1");
    plus.setAttribute("aria-label", "New list");
    plus.title = "New list";
    plus.style.pointerEvents = "auto"; // inherited property — re-enabled inline like every pane control
    plus.innerHTML = '<span class="ng-lists-new-chip" aria-hidden="true">+</span>';
    plus.addEventListener("click", () => {
      const id = this.newList();
      this._listFocusId = id; // highlight the newborn row (no graph set yet — it is empty)
      // "+ then rename" (v1.99.3): the newborn opens straight into its name field. The
      // default name rides along as the prefilled, selected value — Enter/blur/Esc all
      // keep it, so naming is offered, never demanded.
      this._listEditId = id;
      this._listEditDraft = null;
      this._listEditFocusPending = true;
      this.track("neural_list_created", { surface: "lists-head" });
      this.renderExplorer();
    });
    head.appendChild(plus);
    sec.appendChild(head);

    // "AND BE VISIBLE UP TOP" (owner, v1.99.5). With one list the + files in one tap and never
    // opens the picker, so the destination has to be legible SOMEWHERE that is not a tooltip.
     // NO "ADDING TO <LIST>" LINE (v1.103.3). It existed because v1.99.5 gave capture a DEFAULT
    // destination — `activeListId` — and a silent default has to be legible or it misfiles. The
    // picker now always asks (v1.102.0), so there is no default left for this line to name: it
    // was stating a fact that had stopped being true. Owner: it "shouldnt exist". `targetList()`
    // survives because the picker still uses it to mark and order its own default row.

    if (!ids.length) {
      const empty = document.createElement("div");
      empty.setAttribute("data-lists-empty", "1");
      empty.style.cssText = "font-size:11.5px;line-height:1.5;color:#7e8aa3;padding:4px 12px 6px 22px;";
      empty.textContent = this._sharedIncoming
        ? "Save the shared class above to keep it — or tap + to start your own."
        : "No lists yet — tap + to start one.";
      sec.appendChild(empty);
      list.appendChild(sec);
      return;
    }
    for (const id of ids) {
      const l = this._listsMap()[id];
      const row = document.createElement("div");
      row.setAttribute("data-list-row", id);
      const lit = this._listFocusId === id;
      const expanded = this._listExpanded(id);
      const itemsId = "ng-list-items-" + id;
      // EXPLORE'S OWN IDIOM (v1.103.4). Owner: "the listings of the lists design look very ugly,
      // instead ... the lists and items like categories / items in the explore tab, except they
      // are lists ... with a play + share icon + close icon on the right of it". So a list reads
      // as a SECTION HEADER — the same full-width row, 7px/12px padding, hover wash and chevron
      // that Systems/Positions/Transitions use — and its techniques read as that section's ITEMS
      // at 22px. No card, no border box: the boxed pill made a list look like a different KIND of
      // thing from everything else in this pane, which it is not. A LIT list keeps a wash, because
      // "these are on the graph right now" is real state, not decoration.
      // ONE LEVEL IN, AND ON EXPLORE'S EXACT LADDER (v1.103.5). Owner: "they must go one to the
      // right i mean inline and the spacing between items is off, the style doesn't feel like the
      // Positions category". It didn't: Explore nests header(12) → family(22) → leaf(38), every
      // row `padding:7px <pad>px` via mk(). "Your lists" is the header, so a LIST is a family row
      // at 22 and its techniques are leaf rows at 38 — the same indents, the same 7px rhythm, the
      // same type ramp (14/700 → 13/600 #c4cde0 → 12 #9aa6bd). The 44px min-heights that used to
      // sit on these buttons are what made the spacing feel foreign: nothing else in this pane is
      // 44px tall, and the pane is a scroller, not a thumb band.
      row.style.cssText = "display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 22px;border-radius:7px;cursor:pointer;border:0;background:" + (lit ? "rgba(58,72,118,.45)" : "transparent") + ";";
      if (!lit) {
        row.addEventListener("mouseenter", () => { if (this._listFocusId !== id) row.style.background = "rgba(255,255,255,.045)"; });
        row.addEventListener("mouseleave", () => { if (this._listFocusId !== id) row.style.background = "transparent"; });
      }
      // THE ROW lights the list; THE NAME renames it (v1.99.3, owner: "I can't seem to
      // click to rename my lists"). Controls own their clicks (the closest() guard), and a
      // click that lands while — or just after — the editor is open must NOT light: blur
      // fires before click, so by click time the editor is already committed and gone, and
      // without the closed-at latch the same click would light the list under the caret.
      row.addEventListener("click", (e) => {
        const t = e.target;
        if (t && t.closest && t.closest("button,input")) return;
        if (this._listEditId === id) return;
        if (Date.now() - (this._listEditClosedAt || 0) < 400) return;
        this.focusList(id);
      });
      const main = document.createElement("div");
      main.style.cssText = "flex:1;min-width:0;display:flex;align-items:center;gap:8px;";
      if (this._listEditId === id) {
        // ── INLINE RENAME: Enter/blur commits, Esc cancels, empty reverts ──
        const inp = document.createElement("input");
        inp.setAttribute("data-list-rename", id);
        inp.setAttribute("aria-label", "List name");
        inp.maxLength = 60;
        // the draft survives unrelated re-renders: a deferred payload landing (systems.json
        // re-renders the whole Explore body) rebuilds this input mid-edit, and without the
        // draft the user's half-typed name would silently reset to the stored one
        inp.value = this._listEditDraft != null ? this._listEditDraft : l.name;
        inp.style.cssText = "width:100%;min-width:0;pointer-events:auto;font-family:inherit;font-size:13px;font-weight:600;color:#eef1f6;background:rgba(255,255,255,.06);border:1px solid rgba(150,180,255,.55);border-radius:7px;padding:4px 7px;outline:none;";
        let done = false, cancelled = false;
        const finish = (commit) => {
          if (done) return;
          done = true;
          this._listEditId = null;
          this._listEditDraft = null;
          this._listEditClosedAt = Date.now();
          if (commit) this.renameList(id, inp.value); // empty/unchanged = no-op revert
          this._refreshListSurfaces();
        };
        inp.addEventListener("input", () => { this._listEditDraft = inp.value; });
        inp.addEventListener("keydown", (e) => {
          // the editor owns the keyboard: stopPropagation keeps A/B/C/D, digits and —
          // critically — Escape (the pane's Esc ladder) out of the global handler
          e.stopPropagation();
          if (e.key === "Enter") { e.preventDefault(); finish(true); }
          else if (e.key === "Escape") { e.preventDefault(); cancelled = true; finish(false); }
        });
        inp.addEventListener("blur", () => {
          // A blur from DETACH is not a decision. An unrelated re-render (the deferred
          // systems.json arrival re-renders the whole Explore body ~a second into a fresh
          // profile's first edit) wipes the list via innerHTML="" — and Chrome dispatches
          // that blur BEFORE the disconnect lands, so `inp.isConnected` still reads TRUE
          // inside the handler (measured; a synchronous guard shipped and failed). Defer
          // the decision one tick: by then a detached input reads disconnected and is
          // skipped (the rebuilt editor carries the draft on), while a genuine user blur
          // — the input still in the document — commits. Real timeout, not the sim clock:
          // UI patience, same as the delete-arm timer.
          setTimeout(() => { if (!cancelled && !done && inp.isConnected) finish(true); }, 0);
        });
        inp.addEventListener("pointerdown", (e) => e.stopPropagation());
        main.appendChild(inp);
      } else {
        const nameBtn = document.createElement("button");
        nameBtn.type = "button";
        nameBtn.setAttribute("data-list-name", id);
        nameBtn.title = "Rename this list";
        nameBtn.setAttribute("aria-label", "Rename “" + l.name + "”");
        // 13px/600 #c4cde0 — the weight Explore gives a FAMILY row ("Armbar", "Half Guard")
        nameBtn.style.cssText = "display:block;min-width:0;pointer-events:auto;cursor:text;font-family:inherit;text-align:left;border:0;background:transparent;padding:0;font-size:13px;font-weight:600;color:#c4cde0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
        nameBtn.textContent = l.name;
        nameBtn.addEventListener("click", () => this.startListRename(id));
        main.appendChild(nameBtn);
        // THE COUNT LINE IS THE DISCLOSURE (v1.99.4). It used to be a second way to light the
        // list — a duplicate of the row's own click, which is still there. "3 techniques" is
        // the natural place to ask *which* three, so it now opens the list in place: chevron,
        // aria-expanded, aria-controls, and a real band to press.
        const open = document.createElement("button");
        open.type = "button";
        open.setAttribute("data-list-open", id);
        open.setAttribute("aria-expanded", expanded ? "true" : "false");
        open.setAttribute("aria-controls", itemsId);
        open.setAttribute("aria-label", (expanded ? "Hide" : "Show") + " the techniques in “" + l.name + "”");
        open.title = expanded ? "Hide these techniques" : "Show these techniques";
        // the count reads like Explore's "(6)", and the chevron sits where its sections put it
        // a family row prints its count bare (10.5px) and puts the chevron last, at 10px.
        // THE GLYPHS STAY SMALL, THE HIT AREA GROWS (`.ng-lists-new`'s pattern): 10.5px text and
        // a 10px chevron are an 18x12 target if you let them size the button, which is under the
        // pane's own 24px figure and under WCAG 2.2 AA. The padding buys the target without
        // touching the type, and costs the row nothing — its 24px controls already set 38px.
        open.style.cssText = "display:flex;align-items:center;gap:7px;flex:none;pointer-events:auto;cursor:pointer;font-family:inherit;text-align:left;border:0;background:transparent;color:inherit;padding:6px 5px;margin:-6px -5px;border-radius:7px;";
        open.innerHTML = '<span data-list-count="' + l.items.length + '" style="font-size:10.5px;color:#7e8aa3;">' + l.items.length + '</span>' +
          '<span data-list-chevron="1" style="flex:none;display:inline-flex;">' + this._caretHTML(expanded) + '</span>';
        open.addEventListener("click", () => this._toggleListExpand(id));
        main.appendChild(open);
      }
      row.appendChild(main);

      // ── THREE ICONS ON THE RIGHT (v1.103.4) ────────────────────────────────────────────────
      // Owner: "a play + share icon + close icon on the right of it". Two word-buttons made every
      // list row a toolbar; a section header carries glyphs. Same handles, same actions, same
      // accessible names — a `title` is not a name, so each carries a real `aria-label`.
      const icon = (attr, glyph, label, tint) => {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute(attr, id);
        b.setAttribute("aria-label", label);
        b.title = label;
        b.innerHTML = glyph;
        b.style.cssText = "flex:none;pointer-events:auto;cursor:pointer;font-family:inherit;width:24px;height:24px;padding:0;border:0;border-radius:7px;background:transparent;color:" + tint + ";display:inline-flex;align-items:center;justify-content:center;font-size:12px;line-height:1;transition:background .15s,color .15s;";
        b.addEventListener("mouseenter", () => { b.style.background = "rgba(255,255,255,.08)"; b.style.color = "#eef1f6"; });
        b.addEventListener("mouseleave", () => { b.style.background = "transparent"; b.style.color = tint; });
        return b;
      };
      // NO DRILL CONTROL ON A LIST ROW (v1.103.7, owner). v1.103.6 kept the action and only
      // changed its glyph off ▶; the owner then deleted the button outright. A list row is now
      // exactly three things — light it (the row), read it (the count line), share it — plus
      // the ×. Every technique inside it carries its own ▶ and its own ✕, which is where the
      // per-item verbs belong. `openListSession` is NOT dead: `[data-shared-drill]` ("Drill
      // these") still runs it on a RECEIVED class, which is the case that needs a one-press
      // study path before the list has even been saved.

      const share = icon("data-list-share", '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"></path><path d="M12 16V3"></path><path d="M8 7l4-4 4 4"></path></svg>',
        "Share “" + l.name + "” as a link", "#9ab0e0");
      share.addEventListener("click", () => { void this.shareList(id); });
      row.appendChild(share);

      // DELETE: two steps, then undoable. It sits next to Share — the one button a coach
      // presses in front of the class — so a single stray click may not destroy the list the
      // whole session was spent building. `margin-left` buys the miss-distance.
      const armed = this._delArm === id;
      const del = document.createElement("button");
      del.type = "button";
      del.setAttribute("data-list-delete", id);
      if (armed) del.setAttribute("data-list-delete-armed", "1");
      del.textContent = armed ? "Delete?" : "×";
      del.title = armed ? "Click again to delete this list" : "Delete this list";
      del.setAttribute("aria-label", armed ? "Confirm deleting “" + l.name + "”" : "Delete “" + l.name + "”");
      // still 12px clear of Share — the button a coach presses in front of the class — so a stray
      // click cannot destroy the list the session was spent building (the two-step is unchanged)
      del.style.cssText = "flex:none;margin-left:12px;pointer-events:auto;cursor:pointer;font-family:inherit;font-size:" + (armed ? "10.5px;font-weight:700;" : "13px;") + "line-height:1;" + (armed ? "padding:5px 8px;width:auto;height:auto;" : "padding:0;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;") + "border-radius:7px;border:" + (armed ? "1px solid rgba(242,104,95,.5)" : "0") + ";background:" + (armed ? "rgba(242,104,95,.16)" : "transparent") + ";color:" + (armed ? "#ff9c92" : "#6b7691") + ";";
      del.addEventListener("click", () => {
        if (this._delArm !== id) {
          this._delArm = id;
          if (this._delArmT) clearTimeout(this._delArmT);
          // real setTimeout, not the sim clock: this is UI patience, not game time
          this._delArmT = setTimeout(() => { if (this._delArm === id) { this._delArm = null; this._refreshListSurfaces(); } }, 8000);
          this._refreshListSurfaces();
          return;
        }
        this._delArm = null;
        if (this._delArmT) { clearTimeout(this._delArmT); this._delArmT = null; }
        this.deleteList(id);
      });
      row.appendChild(del);
      // ── the disclosure body: the techniques themselves ──
      // A CHILD of the row (which is flex-wrap), not a sibling, so the list reads as one card
      // and Drill / Share / × keep their own line above it. No overflow of its own: the pane
      // scrolls, a row inside a scroller that scrolls too is a trap on a 390px drawer.
      if (expanded) {
        const items = document.createElement("div");
        items.id = itemsId;
        items.setAttribute("data-list-items", id);
        // no rule, no inset card: Explore's own sections just list their children underneath
        items.style.cssText = "flex-basis:100%;width:100%;min-width:0;margin-top:2px;";
        if (!l.items.length) {
          const em = document.createElement("div");
          em.setAttribute("data-list-empty", id);
          em.style.cssText = "font-size:11px;line-height:1.5;color:#7e8aa3;padding:5px 12px 5px 38px;";
          // the three surfaces that actually carry [data-list-add] where a technique is named:
          // the in-roll option cards (data-list-surface="option"), both dossier renderers
          // ("dossier"/"sheet") and Explore's own leaf rows ("explore").
          em.textContent = "No techniques yet — tap + on an option card while you roll, on a technique’s dossier, or on any Explore row.";
          items.appendChild(em);
        } else {
          for (const nodeId of l.items) items.appendChild(this._listItemRow(nodeId, id));
        }
        row.appendChild(items);
      }
      sec.appendChild(row);
    }
    list.appendChild(sec);
    // give the disclosure toggle its focus back after the re-render it caused (keyboard only —
    // the flag is set only when the toggle actually held focus at the time)
    if (this._listOpenFocusPending) {
      const back = sec.querySelector('[data-list-open="' + this._listOpenFocusPending + '"]');
      this._listOpenFocusPending = null;
      if (back) { try { back.focus(); } catch (e) { /* non-fatal */ } }
    }
    // focus the rename editor exactly once per startListRename/+ — NOT on every re-render
    // (an unrelated _refreshListSurfaces while editing must never yank the caret from a
    // control the user deliberately moved to)
    if (this._listEditId) {
      const inp = sec.querySelector("[data-list-rename]");
      if (inp && this._listEditFocusPending) {
        this._listEditFocusPending = false;
        try { inp.focus(); inp.select(); } catch (e) { /* non-fatal */ }
      } else if (inp && (!document.activeElement || document.activeElement === document.body)) {
        // the editor lost focus to a DOM rebuild (detach), not to the user — restore the
        // state it was in: an UNTOUCHED editor (no draft yet) gets its select-all back, so
        // typing still replaces the old name; a mid-edit draft gets the caret at its end
        try {
          inp.focus();
          if (this._listEditDraft == null) inp.select();
          else inp.setSelectionRange(inp.value.length, inp.value.length);
        } catch (e) { /* non-fatal */ }
      }
    }
  }
  /**
   * Is the undo offer still live? An undo is a REACTION, not a record: the old version only ever
   * cleared `_undoList` when the undo was USED, so a delete left "Deleted “X” · 3 techniques ·
   * Undo" pinned to the top of Lists — above the recipient's own lists and above a shared class —
   * for the rest of the session. 90s is generous for "oh no, put it back" and short enough that
   * it is gone by the next time the pane is opened.
   */
  _undoRowLive() {
    const u = this._undoList; if (!u) return false;
    if (Date.now() - (u.t || 0) > 90000) { this._undoList = null; return false; }
    return true;
  }
  /** The way back from a delete. One outstanding undo at a time, cleared when it is used. */
  _undoRow() {
    const u = this._undoList;
    const box = document.createElement("div");
    box.style.cssText = "display:flex;align-items:center;gap:8px;margin:0 6px 6px;padding:7px 9px;border-radius:9px;border:1px solid rgba(150,170,210,.2);background:rgba(255,255,255,.03);";
    const txt = document.createElement("span");
    txt.style.cssText = "flex:1;min-width:0;font-size:11.5px;color:#aeb9d4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    txt.textContent = "Deleted “" + u.list.name + "” · " + u.list.items.length + " technique" + (u.list.items.length === 1 ? "" : "s");
    box.appendChild(txt);
    const undo = document.createElement("button");
    undo.type = "button";
    undo.setAttribute("data-list-undo", u.id);
    undo.textContent = "Undo";
    undo.style.cssText = "flex:none;pointer-events:auto;cursor:pointer;font-family:inherit;font-size:10.5px;font-weight:700;padding:5px 10px;border-radius:7px;border:1px solid rgba(150,170,210,.3);background:rgba(255,255,255,.05);color:#dbe2f0;";
    undo.addEventListener("click", () => this.undoDeleteList());
    box.appendChild(undo);
    return box;
  }
  undoDeleteList() {
    const u = this._undoList; if (!u) return false;
    this._undoList = null;
    this._listsMap()[u.id] = u.list;
    this._expandList(u.id); // it came back — show what came back with it
    this.activeListId = u.id;
    this.set("activeListId", u.id); // saves the blob
    this.setEvent("Restored", u.list.name, "good");
    this._refreshListSurfaces();
    return true;
  }
  /** The block a RECIPIENT sees: what arrived, whether anything didn't resolve, and the two
   *  things they can do with it. A received link is offered, never silently adopted. */
  _sharedBlock() {
    const inc = this._sharedIncoming;
    const box = document.createElement("div");
    box.setAttribute("data-shared-list", inc.code);
    box.style.cssText = "margin:4px 6px 8px;padding:9px 10px;border-radius:10px;border:1px solid rgba(126,224,168,.35);background:linear-gradient(180deg,rgba(24,44,38,.6),rgba(17,28,26,.5));";
    const head = document.createElement("div");
    head.style.cssText = "font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7ee0a8;";
    head.innerHTML = 'Shared with you · <span data-shared-count="' + inc.ids.length + '">' + inc.ids.length + ' technique' + (inc.ids.length === 1 ? "" : "s") + '</span>';
    box.appendChild(head);
    for (const id of inc.ids) {
      const i = this._idIndex ? this._idIndex.get(id) : null;
      const n = i != null ? this.nodes[i] : null;
      const item = document.createElement("div");
      item.style.cssText = "display:flex;align-items:center;gap:6px;margin-top:5px;";
      const nameBtn = document.createElement("button");
      nameBtn.type = "button";
      nameBtn.setAttribute("data-shared-item", id);
      nameBtn.style.cssText = "flex:1;min-width:0;pointer-events:auto;cursor:pointer;font-family:inherit;text-align:left;border:0;background:transparent;padding:0;font-size:12.5px;color:#dbe2f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      // THE FULL, QUALIFIED NAME. The `from <position>` half is the disambiguator — see
      // listItemName(). It renders dimmer, but it renders: a recipient has to be able to tell
      // which of the 35 Kimuras their coach drilled.
      if (n) {
        const sp = this.splitName(n.t);
        nameBtn.innerHTML = this.escHTML(sp.main) +
          (sp.from ? ' <span style="color:#8b97b0;font-size:11px;">' + this.escHTML(sp.from) + '</span>' : "");
        nameBtn.title = n.t;
      } else {
        nameBtn.textContent = id;
      }
      if (i != null) nameBtn.addEventListener("click", () => this.openDossier(i));
      item.appendChild(nameBtn);
      if (n) item.appendChild(this._playButton(n));   // a received technique plays like any other
      item.appendChild(this._listAddButton(id, "shared"));
      box.appendChild(item);
    }
    if (inc.unknown && inc.unknown.length) {
      const un = document.createElement("div");
      un.setAttribute("data-shared-unresolved", String(inc.unknown.length));
      un.style.cssText = "margin-top:7px;font-size:10.5px;line-height:1.45;color:#e8b98a;";
      // the verb has to agree with the noun it was just given: "2 techniques … isn't" read like
      // a bug in the app to anybody who noticed it, on the one surface that has to look trustworthy
      const many = inc.unknown.length !== 1;
      un.textContent = inc.unknown.length + (many ? " techniques" : " technique") + " in this link " +
        (many ? "aren’t" : "isn’t") + " in this version of the graph yet.";
      box.appendChild(un);
    }
    const acts = document.createElement("div");
    acts.style.cssText = "display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:9px;";
    // RE-LIGHT. Every other focus source in the app can be lit again (a System from its row, a
    // list from its row); the received set had no way back, so once the fog cleared — which the
    // pane's own close does, by design — the recipient had permanently lost the one visual that
    // made the link worth opening. Reuses the same setFocusIdxSet path via focusList().
    const light = document.createElement("button");
    light.type = "button";
    light.setAttribute("data-shared-relight", "1");
    light.textContent = this._listFocusId === "__shared" ? "◉ On graph" : "Show on graph";
    light.title = "Light these techniques on the graph again";
    light.style.cssText = "flex:none;pointer-events:auto;cursor:pointer;font-family:inherit;font-size:11px;font-weight:700;padding:7px 10px;border-radius:8px;border:1px solid rgba(150,170,210," + (this._listFocusId === "__shared" ? ".5" : ".28") + ");background:rgba(255,255,255," + (this._listFocusId === "__shared" ? ".09" : ".04") + ");color:#c4cde0;";
    light.addEventListener("click", () => this.focusList("__shared"));
    acts.appendChild(light);
    const drill = document.createElement("button");
    drill.type = "button";
    drill.setAttribute("data-shared-drill", "1");
    drill.textContent = "Drill these";
    drill.style.cssText = "flex:1;pointer-events:auto;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:700;padding:7px 9px;border-radius:8px;border:1px solid rgba(110,160,255,.4);background:linear-gradient(135deg,rgba(74,108,255,.32),rgba(74,108,255,.15));color:#eef1f6;";
    drill.addEventListener("click", () => this.openListSession("__shared"));
    acts.appendChild(drill);
    const save = document.createElement("button");
    save.type = "button";
    save.setAttribute("data-shared-save", "1");
    save.textContent = "Save";
    save.style.cssText = "flex:none;pointer-events:auto;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:700;padding:7px 11px;border-radius:8px;border:1px solid rgba(126,224,168,.4);background:rgba(126,224,168,.12);color:#cdebd9;";
    save.addEventListener("click", () => this.saveSharedList());
    acts.appendChild(save);
    box.appendChild(acts);
    // DISMISS SITS ON ITS OWN ROW, WELL AWAY FROM SAVE. It used to be the next flex child after
    // Save, 6px from it: on a phone that is inside one thumb's contact patch, and a mis-tap does
    // not merely close a card — it discards the class AND records the code `dismissed`, so the
    // link can never offer it again. Own row, real 32px target, and worded as the action it is
    // instead of an anonymous ×, which is also what stops it reading as a second Save.
    const dismissRow = document.createElement("div");
    dismissRow.style.cssText = "display:flex;justify-content:flex-end;margin-top:26px;";
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.setAttribute("data-shared-dismiss", "1");
    dismiss.textContent = "Not for me";
    dismiss.title = "Dismiss this shared list";
    dismiss.style.cssText = "flex:none;pointer-events:auto;cursor:pointer;font-family:inherit;font-size:11px;font-weight:600;line-height:1;min-height:32px;padding:9px 12px;border-radius:8px;border:1px solid rgba(150,170,210,.2);background:transparent;color:#8b97b0;";
    dismiss.addEventListener("click", () => this.dismissSharedList());
    dismissRow.appendChild(dismiss);
    box.appendChild(dismissRow);
    return box;
  }
  /**
   * ONE set of words for a damaged link, read by all three surfaces that mention it: the pill
   * cue, this panel and the arrival toast. They used to disagree — the pill said "Link
   * incomplete" about every non-stale failure while the panel said the opposite for the
   * not-clipped case — and a recipient who reads both learns only that the app is guessing.
   */
  _brokenCopy() {
    const b = this._sharedBroken;
    if (b && b.clipped)
      return {
        pill: "Link incomplete ▸",
        kicker: "Shared class · this link is incomplete",
        toast: ["This link is incomplete", "It was cut short in transit — ask for it again"],
        body: "It was cut short in transit — chat apps and mail clients re-wrap long links. Nothing is wrong with the class itself; ask for the link again.",
      };
    return {
      pill: "Link unreadable ▸",
      kicker: "Shared class · this link can’t be read",
      toast: ["This link didn’t work", "Check the whole link was copied"],
      // NOT "it was cut short": we do not know that. This branch is reached by anything that is
      // code-shaped but does not start with one of our wire versions — a stranger's typo, a
      // pasted fragment of something else entirely — and telling that person their coach's link
      // was truncated is a confident answer to a question nobody asked.
      body: "This doesn’t look like one of our class links — a character may be missing or changed, or it may not be a class link at all. Check the whole link was copied, or ask for it again.",
    };
  }
  /** "This link arrived damaged." A code-shaped string that will not decode does not deserve
   *  silence: the recipient can act on "ask for it again" and cannot act on nothing at all.
   *  DURABLE, because the toast carrying the same sentence is overwritten by the roll in seconds. */
  _brokenBlock() {
    const b = this._sharedBroken;
    const copy = this._brokenCopy();
    const box = document.createElement("div");
    box.setAttribute("data-shared-broken", b.error);
    box.setAttribute("data-shared-broken-kind", b.clipped ? "clipped" : "unreadable");
    box.style.cssText = "margin:4px 6px 8px;padding:9px 10px;border-radius:10px;border:1px solid rgba(232,185,138,.35);background:rgba(46,36,24,.5);";
    box.innerHTML =
      '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#e8b98a;">' + this.escHTML(copy.kicker) + '</div>' +
      '<div style="margin-top:5px;font-size:11.5px;line-height:1.5;color:#cbb69c;">' + this.escHTML(copy.body) + "</div>";
    return box;
  }
  /** "The link is fine — this build is older." A valid code whose ordinals this build has no
   *  nodes for is NOT garbage, and must not be answered with the same silence. */
  _staleBlock() {
    const st = this._sharedStale;
    const box = document.createElement("div");
    box.setAttribute("data-shared-stale", String(st.unknown.length));
    box.style.cssText = "margin:4px 6px 8px;padding:9px 10px;border-radius:10px;border:1px solid rgba(232,185,138,.35);background:rgba(46,36,24,.5);";
    box.innerHTML =
      '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#e8b98a;">Shared class · not in this version yet</div>' +
      '<div style="margin-top:5px;font-size:11.5px;line-height:1.5;color:#cbb69c;">This link is valid, and all ' +
      st.unknown.length + ' of its techniques are newer than the graph this page loaded. Reload in a little while — nothing is wrong with the link.</div>';
    return box;
  }
  // ── has this code already been answered? ───────────────────────────────────────────────
  // A received link is offered ONCE. Without a record, every reload at that URL re-offers a
  // list the recipient already saved (a duplicate trap) or already dismissed (nagging, forever).
  // Keyed by share_id, which is canonical, so the record is stable across devices too.
  _shareSeen() { const v = this.get("shareSeen", null); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
  _markShareSeen(shareId, state, listId) {
    if (!shareId) return;
    const seen = this._shareSeen();
    seen[shareId] = { s: state, t: Date.now(), listId: listId || null };
    // keep the newest 24: this is a courtesy record, not an archive
    const keys = Object.keys(seen).sort((a, b) => (seen[b].t || 0) - (seen[a].t || 0));
    const trimmed = {};
    for (const k of keys.slice(0, 24)) trimmed[k] = seen[k];
    this.set("shareSeen", trimmed); // settings are LWW per key → follows the user across devices
  }
  saveSharedList() {
    const inc = this._sharedIncoming; if (!inc) return "";
    const id = this.newList("Shared · " + ngListDefaultName(new Date()).replace(/^Class · /, ""));
    for (const nid of inc.ids) this.addToList(nid, id);
    this._sharedIncoming = null;
    this._listFocusId = id;
    this._markShareSeen(inc.shareId, "saved", id);
    this._flushSave();
    // the cue follows the class into its new home, so ◉ keeps working after Save
    this._setShareCue({ kind: "class", n: inc.ids.length, target: id });
    this.track("neural_share_list_saved", { share_id: inc.shareId, items: inc.ids.length });
    this._arrivalSay = null; // "Saved" is the current truth; don't let the arrival line land on top of it
    this.setEvent("Saved", inc.ids.length + " technique" + (inc.ids.length === 1 ? "" : "s") + " added to your lists", "good");
    this._refreshListSurfaces();
    return id;
  }
  dismissSharedList() {
    if (!this._sharedIncoming) return;
    this._arrivalSay = null; // they answered the offer; a held sentence about it is now stale
    this._markShareSeen(this._sharedIncoming.shareId, "dismissed");
    this._sharedIncoming = null;
    this._setShareCue(null); // they said no: the pill stops offering it too
    this.clearFocus();
    this._flushSave();
    this._refreshListSurfaces();
  }
  /**
   * RECIPIENT LANDING. Runs once per boot, right after ingest, off `location`. Works on the
   * plain static shell — no Function, no server state, no extra request. An unparseable code
   * is simply not a share link: the app is an ordinary app and nothing is lit.
   */
  _openSharedListFromUrl() {
    this._sharedIncoming = null;
    this._sharedStale = null;
    this._sharedBroken = null;
    let code = "";
    try { code = ngListParseSharePath(location.pathname + location.search); } catch (e) { code = ""; }
    if (!code) return; // not code-shaped at all (`/l/not!a!code`): this is an ordinary app visit
    const res = ngListDecodeIds(code, this._ordinalIndex());
    const shareId = ngListShareId(code);
    if (!res.ok) {
      // A CODE-SHAPED STRING THAT WILL NOT DECODE IS A DAMAGED LINK, AND THE RECIPIENT IS TOLD.
      // Measured on a real 8-technique code (23 chars, 22 prefixes): 10 of the 22 clip
      // positions fail as `not_base64url` (a cut that lands mid-quantum, or on non-zero
      // trailing bits) — the MAJORITY — and only 12 as count_mismatch/truncated*. Keying the
      // message off the count-byte errors alone therefore answered most real clips with total
      // silence. Anything that got past ngListParseSharePath is code-shaped, so every failure
      // here is a link that arrived damaged; say so.
      // WHICH sentence: the error says what failed, the classifier says whose code it was.
      // `not_base64url` is both "a real code cut mid-quantum" (the majority of clips) and "a
      // random pasted word", and only the leading wire-version byte tells them apart.
      const clipped = ngListClassifyFailure(code, res.error) === "clipped";
      this._sharedBroken = { code: code, error: res.error || "unresolved", clipped: clipped, shareId: shareId };
      // the toast is best-effort ONLY: the roll loop overwrites the single `setEvent` slot within
      // a couple of seconds. The durable telling is _brokenBlock(), plus the pill cue.
      { const t = this._brokenCopy().toast; this._announceArrival(t[0], t[1], "bad"); }
      this.track("neural_share_list_failed", { share_id: shareId, error: res.error || "unresolved", clipped: clipped });
      this.fx("list_failed", { share_id: shareId, error: res.error || "unresolved", clipped: clipped });
      this._offerShare({ kind: "broken" });
      return;
    }
    if (!res.ids.length) {
      // VALID code, nothing this build can resolve — a different sentence, and an actionable
      // one: their app is behind the link, not broken.
      this._sharedStale = { code: code, unknown: res.unknown || [], shareId: shareId };
      this.track("neural_share_list_stale", { share_id: shareId, unknown: (res.unknown || []).length });
      this.fx("list_stale", { share_id: shareId, unknown: (res.unknown || []).length });
      this._offerShare({ kind: "stale" });
      return;
    }
    // already answered? (see _markShareSeen) — a reload is the same visit, not a second offer
    const seen = this._shareSeen()[shareId];
    const nav = (() => { try { const e = performance.getEntriesByType("navigation")[0]; return e ? e.type : ""; } catch (e) { return ""; } })();
    const sameVisit = nav === "reload" || nav === "back_forward";
    // RECONCILE THE RECORD AGAINST REALITY. "saved" is a claim about a list that may no longer
    // exist — the recipient can delete it, a merge can drop it, a blob can be rewritten. When
    // the list is gone the old code answered with perfect silence: nothing lit, no offer, no
    // message, on a URL whose entire job is to show a class. The record loses to the list set.
    if (seen && seen.s === "saved") {
      const mine = seen.listId && this._listsMap()[seen.listId] && this._listsMap()[seen.listId].items.length ? seen.listId : null;
      if (mine) {
        this.track("neural_share_list_reopened", { share_id: shareId, state: "saved" });
        this._listFocusId = mine;
        this.setFocusIdxSet(this.listIdxs(mine));
        this.setEvent("Already saved", "This class is in your Lists", "good");
        this._offerShare({ kind: "class", n: this._listsMap()[mine].items.length, target: mine });
        return;
      }
      this.track("neural_share_list_reoffered", { share_id: shareId, reason: "saved_list_missing" });
      // fall through and OFFER it again — exactly as if it had never been saved
    } else if (seen && seen.s === "dismissed" && sameVisit) {
      this.track("neural_share_list_reopened", { share_id: shareId, state: "dismissed" });
      return; // they said no on this visit; reloading is not a new ask
    }
    const idxs = [];
    for (const id of res.ids) { const i = this._idIndex ? this._idIndex.get(id) : null; if (i != null && this.nodes[i]) idxs.push(i); }
    this._sharedIncoming = { code: code, ids: res.ids, idxs: idxs, unknown: res.unknown || [], shareId: shareId };
    this.fx("list_opened", { share_id: shareId, items: res.ids.length, unknown: (res.unknown || []).length });
    // canonical code => this joins the creator's share_list_created with no server state
    this.track("neural_share_list_opened", { share_id: shareId, items: res.ids.length, unknown: (res.unknown || []).length });
    this._listFocusId = "__shared";
    this.setFocusIdxSet(idxs);
    this._offerShare({ kind: "class", n: res.ids.length, target: "__shared" });
  }
  /**
   * THE ONE SENTENCE THAT EXPLAINS AN ARRIVAL — held back until it can actually be read.
   *
   * A share arrival is decoded at ingest, t=0: the intro is still flying the camera in, and the
   * toast is a SINGLE slot that the roll's first landing overwrites a second or two later. On a
   * phone that made the sentence a formality — on screen while the graph was still assembling,
   * gone before it settled. So the arrival is announced on the FIRST LANDING instead: intro over,
   * hand dealt, and the slot free for the length of a decision window.
   *
   * A timer cannot do this job: `startRoll()` calls `clearTimers()` at the end of the intro, so
   * an `after()` scheduled at t=0 for t=5 is dropped at t=3.2 without ever firing.
   */
  _announceArrival(kicker, text, tone) { this._arrivalSay = { k: kicker, t: text, tone: tone }; }
  _sayArrivalIfPending() {
    const s = this._arrivalSay; if (!s) return;
    this._arrivalSay = null;
    this.setEvent(s.k, s.t, s.tone);
  }
  /**
   * Present an arrival. THE VIEWPORT DECIDES THE TERMINAL STATE, and it is the one design rule
   * in this whole feature that a desktop reviewer cannot see:
   *   · wide  — open the pane on Explore (it sits beside the graph; nothing is hidden, and the
   *             list is read first). Latches _paneAutoPaused as usual, so closing it resumes.
   *   · phone — the pane is 88vw. Opening it would bury the lit class under a drawer, so the
   *             landing ENDS on the lit graph and the pill cue carries the offer instead. One
   *             tap on "Class ▸" reads it; one tap on ◉ lights it again. Nothing auto-opens.
   * Either way the arrival is the USER's action (they tapped a link), never the roll loop's, so
   * PANE LAW holds — and on the phone path nothing opens the pane at all.
   */
  _offerShare(cue) {
    this._setShareCue(cue);
    if (this.isMobile()) {
      if (cue.kind === "class") {
        this._announceArrival(cue.target === "__shared" ? "Shared with you" : "Already saved",
          cue.n + " technique" + (cue.n === 1 ? "" : "s") + " lit on the graph · tap Class to read them", "good");
      }
      this.forceUpdate();
      return;
    }
    // openPane -> setViewMode("explore") clears the focus set by design (a focus belongs to the
    // tab that lit it), so the class is re-applied AFTER the pane is up. noFrame: the camera was
    // already flown to the class above and must not be yanked a second time.
    const keep = this._listFocusId;
    this.openPane("explore");
    if (keep && this.listIdxs(keep).length) { this._listFocusId = keep; this.setFocusIdxSet(this.listIdxs(keep), true); }
    this._renderPaneBody();
  }
  // authored copy reaches innerHTML through here
  escHTML(v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  // "Systems/Danaher-Leg-Lock-System" -> "danaher-leg-lock-system": the same slug the generated
  // page puts in data-system-slug / utm_content, so one campaign report covers both surfaces.
  systemSlug(s) { return String((s && s.id) || "").split("/").pop().toLowerCase(); }
  // The authored affiliate URL plus BJJGraph's own UTM tags — nothing else. Mirrors
  // scripts/regenerate_md_from_json.py::_with_utm exactly (same keys, same order, same slug
  // casing) and never touches the vendor's existing query, so the deploy-time ?ref= stamp
  // (scripts/apply_affiliate_ref.py) still finds and rewrites the placeholder it owns.
  affiliateHref(url, s, p) {
    if (!url) return url;
    const q = [
      "utm_source=bjjgraph",
      "utm_medium=affiliate",
      "utm_campaign=systems",
      "utm_content=" + encodeURIComponent(this.systemSlug(s)),
    ];
    if (p && p.id) q.push("utm_term=" + encodeURIComponent(p.id));
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + q.join("&");
  }
  renderSystemDetail(list, id, mk) {
    const s = this._systemsById[id]; if (!s) return;
    const E = (v) => this.escHTML(v);
    const idxs = this.systemNodeIdxs(s);
    const back = mk('<span style="color:#9ab0e0;font-size:12.5px;font-weight:600;">\u2039 All systems</span>', 12, () => this.closeSystem());
    back.setAttribute("data-system-back", "1");
    back.style.pointerEvents = "auto";
    list.appendChild(back);
    const card = document.createElement("section");
    card.className = "ng-system-detail";
    card.setAttribute("data-system-detail", s.id);
    card.setAttribute("aria-label", s.name + " system");
    const meta = [s.difficulty, s.type].filter(Boolean).map(E);
    meta.push(idxs.length + " lit on the graph");
    card.innerHTML = "<h2>" + E(s.name) + '</h2><div class="ng-system-meta">' + meta.join(" \u00b7 ") + "</div>" + (s.summary ? "<p>" + E(s.summary) + "</p>" : "");
    list.appendChild(card);
    // Course CTA, ONLY for a system that carries an authored product: a placeholder or a guessed
    // link here would be a dead promise to a reader who trusted the recommendation. The payload
    // itself is already filtered to products whose URL was opened and confirmed
    // (content/Systems/*.json link_status:"live" — see regenerate_neural_data._products); this
    // shape check is the second belt, so a malformed entry renders nothing rather than a dead CTA.
    const products = (Array.isArray(s.products) ? s.products : []).filter((p) => p && typeof p.url === "string" && /^https?:\/\//i.test(p.url));
    if (products.length) {
      const shelf = document.createElement("div");
      shelf.className = "ng-system-courses";
      shelf.setAttribute("data-system-courses", "1");
      // PROXIMATE DISCLOSURE — legally required, and required HERE. FTC 16 CFR Part 255 and the
      // UK ASA/CAP code both want it clear, conspicuous and CLOSE TO THE LINK; the site-wide
      // statement in terms.md is the backstop, not the disclosure. It renders above the cards so
      // someone who reads only the card still sees it, and it ships BEFORE the first real ref so
      // a monetised link can never appear without it. Wording per docs/Affiliate.md.
      const disc = document.createElement("p");
      disc.className = "ng-system-disclosure";
      disc.setAttribute("data-affiliate-disclosure", "1");
      disc.textContent =
        "BJJGraph earns a commission if you buy through this link, at no extra cost to you. " +
        "It never changes what the graph teaches.";
      shelf.appendChild(disc);
      // The DISCLOSURE IS APPENDED FIRST, above every anchor in this shelf, on purpose: a
      // monetised link then structurally cannot render without it. e2e/journeys/systems-surface
      // asserts that order in the live DOM and scripts/check_affiliate_surface.py asserts it in
      // this source \u2014 the compliance claim is gated, not merely intended.
      products.forEach((p, i) => {
        const a = document.createElement("a");
        a.className = "ng-system-cta";
        a.setAttribute("data-system-cta", "1");
        // Same funnel contract as the generated page (templates/Systems.md.jinja2): the app is the
        // DEFAULT variant, so without these it is invisible to the documented affiliate funnel \u2014
        // data-affiliate is what affiliateTracking.inline.ts delegates `affiliate_clickout` on,
        // and the UTM convention is what separates app clicks from legacy-page clicks vendor-side.
        a.setAttribute("data-affiliate", "true");
        a.setAttribute("data-product-id", p.id || "");
        a.setAttribute("data-system-slug", "systems/" + this.systemSlug(s));
        a.setAttribute("data-system-name", s.name || "");
        a.setAttribute("data-vendor", String(p.vendor || "bjjfanatics").toLowerCase());
        a.setAttribute("data-position", String(i));
        a.href = this.affiliateHref(p.url, s, p);  // authored URL + utm only; never synthesized
        a.target = "_blank";
        a.rel = "sponsored nofollow noopener";     // byte-for-byte the page's rel
        a.style.pointerEvents = "auto";
        a.innerHTML = "<span><small>LEARN IT FROM THE SOURCE</small><b>" + E(p.name || "See the course") + "</b>" +
          (p.instructor ? "<em>" + E(p.instructor) + "</em>" : "") + '</span><i aria-hidden="true">\u2197</i>';
        a.addEventListener("click", () => this.track("neural_system_course_clicked", { system: s.name, course: p.name || null, instructor: p.instructor || null, product_id: p.id || null, position: i }));
        shelf.appendChild(a);
      });
      list.appendChild(shelf);
    }
    // ── THE GLUE ── A system is not a node and not merely a set of nodes: it is the set plus the
    // reason they belong together. Two authored layers carry that and neither was ever surfaced:
    // `sequence` (the ordered narrative — do this, then this) and each member's `role` (what that
    // technique DOES here). Without them a selection is just a constellation lighting up.
    const seq = Array.isArray(s.sequence) ? s.sequence : [];
    if (seq.length) {
      const spine = document.createElement("ol");
      spine.className = "ng-system-sequence";
      spine.setAttribute("data-system-sequence", String(seq.length));
      spine.innerHTML = seq
        .map((st) => "<li><b>" + E(st.phase || "") + "</b>" + (st.detail ? "<span>" + E(st.detail) + "</span>" : "") + "</li>")
        .join("");
      list.appendChild(mk('<span style="font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#7b8aa8;font-weight:700;">How it runs</span>', 12));
      list.appendChild(spine);
    }
    if (idxs.length) {
      // Derived progress, never self-reported: this app's canon is that mastery is recall-proven
      // (MC can never mint it), so a "mark as known" button would let a claim outrank the evidence.
      // Count members whose deck is recall-proven and offer the drill instead of the claim.
      const proven = idxs.filter((i) => {
        try { return (this.rec || {})[this.deckKeyFor(this.nodes[i]).key] >= 3; } catch (e) { return false; }
      }).length;
      const head = document.createElement("div");
      head.className = "ng-system-members-head";
      head.setAttribute("data-system-progress", proven + "/" + idxs.length);
      head.innerHTML =
        '<span class="ng-system-kicker">In this system</span><b>' + proven + "/" + idxs.length + " recall-proven</b>";
      list.appendChild(head);
      const roleFor = new Map();
      for (const g of Array.isArray(s.glue) ? s.glue : []) {
        for (const id of g.nodes || []) if (g.role && !roleFor.has(id)) roleFor.set(id, g.role);
      }
      for (const i of idxs) {
        const n = this.nodes[i], sp = this.splitName(n.t);
        const role = roleFor.get(n.id) || "";
        const row = mk(
          this.nodeGlyph(n.ty, this.hex(n.col), 8) +
            '<span style="min-width:0;"><span style="font-size:13px;color:#c4cde0;">' + sp.main +
            (sp.from ? ' <span style="color:#6b7691;font-size:11px;">' + sp.from + "</span>" : "") + "</span>" +
            (role ? '<span class="ng-system-role">' + E(role) + "</span>" : "") + "</span>",
          22,
          () => this.openDossier(i),
        );
        row.setAttribute("data-system-node", n.id);
        if (role) row.setAttribute("data-system-role", "1");
        row.style.pointerEvents = "auto";
        list.appendChild(row);
      }
      const drill = document.createElement("button");
      drill.type = "button";
      drill.className = "ng-system-drill";
      drill.setAttribute("data-system-drill", "1");
      drill.style.pointerEvents = "auto";
      drill.textContent = proven >= idxs.length ? "Review this system" : "Drill this system";
      drill.addEventListener("click", () => {
        this.track("neural_system_drill_started", { system: s.name, nodes: idxs.length, proven: proven });
        this.openSession("system:" + s.id, s.name);
      });
      list.appendChild(drill);
    }
    const missing = (Array.isArray(s.unresolved) ? s.unresolved : []).length;
    if (missing) list.appendChild(mk('<span style="font-size:11px;color:#69748f;">' + missing + " more technique" + (missing === 1 ? "" : "s") + " here aren\u2019t on the map yet</span>", 22));
  }
  locateNode(idx) {
    // pure camera flight — the pane sits on the LEFT (v1.94.0; this comment used to say right),
    // and every caller (session rows, lesson study) keeps the pane open for the study that follows.
    const n = this.nodes[idx]; if (!n) return;
    this.releaseCamera(); // a row click asks to go somewhere ELSE: end any focus lease, don't fight it
    const vw = Math.max(this.graphW * 0.22, this.graphR * 0.5);
    // PANE-AWARE (v1.105.2, owner: keep the sidebar open "so we know where we are"). Centre the
    // node in the VISIBLE region, not the viewport: with the 360px pane up, viewport-centre puts
    // the node half behind it. TARGET values on both axes of the correction — `deckShown ? 1 : 0`
    // (uiShift eases over 0.4s, and camTarget is written ONCE; a click mid-open would bake a
    // fractional offset in forever) and THIS vw (mid-flight cam.vw can be 10x larger and would
    // blow the node off-screen). sbOffset() is 0 on a phone, so mobile is a free no-op.
    const sbW = (this.deckShown ? 1 : 0) * this.sbOffset();
    const W = this.W || 1200;
    this.camTarget = { cx: n.x - (sbW / 2) * (vw / W), cy: n.y, vw: vw };
    this.lastInteract = this.now; this.flare(idx);
  }
  // ---------- dossier: the technique page, living in the left pane ----------
  isMobile() { return (this.W || window.innerWidth) <= 640; }
  famDossierNode(nodes) {
    // prefer the side the authored deck is written for (e.g. Closed Guard|Bottom -> the Bottom node)
    const real = nodes.map((w) => this.nodes[w.idx]).filter(Boolean);
    if (!real.length) return nodes[0].idx;
    const fam = this.posFamily(real[0].t);
    for (const side of ["Bottom", "Top"]) {
      if (this._ngc(fam + "|" + side)) {
        const m = real.find((n) => this.roleLabelOf(n) === side.toLowerCase());
        if (m) return m.idx;
      }
    }
    return real[0].idx;
  }
  openDossier(idx, skipCam) {
    const n = this.nodes && this.nodes[idx]; if (!n) return;
    if (this._pickEl) this.closeListPicker(); // the chooser's anchor is about to be re-rendered away
    this.track("neural_dossier_opened", { node: n.t, node_type: n.ty, mode: "card" });
    this.releaseCamera(); // reading a node is a camera decision of its own
    // the phone used to get a 70%-tall top sheet here and the desktop a right-docked column.
    // Both are retired (v1.101.5) — one surface, both form factors. The camera still flies to
    // the node; the card that lands is the one the player already knows.
    // THE SAME FRAMING A ROLL SETTLES INTO (v1.104.6). This had the right ZOOM but nothing else:
    // no lift into the free band between the announce block and the film strip, no aim at the
    // node's LABEL, no horizontal bias — so clicking a node to read it composed differently from
    // arriving at the same node by rolling, which is the divergence `rollCamTarget` exists to end
    // (v1.103.2) and the one playFrom was carrying until v1.104.5.
    if (!skipCam && this.cam) this.camTarget = this.rollCamTarget({ x: n.x, y: n.y }, false, n.idx);
    // ── ONE SURFACE: THE GAME'S OWN CARD (v1.101.5) ─────────────────────────────────────────
    // v1.101.0 retired the in-node container and sent the state you are STANDING IN to the
    // landing card, but left every OTHER node opening a right-docked reading sheet. The owner,
    // looking at that sheet: "when i click on a node in the graph, [it] shouldnt appear anymore,
    // the node dialog we just practiced now should show instead". So the sheet never opens, on
    // any form factor, and `openDossier` has exactly two jobs:
    //
    //   · the node you are on   -> make sure its card is there, and unfold it
    //   · any other node        -> STAGE the roll there (fly, land, deal, clock held) and unfold
    //     the card that lands. This is already what tapping a node on the graph does, and
    //     `rollFromPosition` hops a technique to its adjacent position, so it is safe for both
    //     node kinds. NB it archives a roll that has actually been PLAYED (`_played`); a staged
    //     roll nobody played is never recorded.
    //
    // The `_landEl` guard used to sit on the first branch, which is how the sheet appeared for
    // "Your current position" at all: dismissing the card with its ✕ (v1.101.1) nulls `_landEl`,
    // so the next click on your own node fell straight through to the sheet. A dismissed card is
    // a card to REBUILD, not a reason to open a different surface.
    if (n.ty !== "positions") {
      // A TECHNIQUE READS AS ITSELF. Staging would hop to its origin POSITION
      // (`rollFromPosition` does that deliberately), and then the card on screen — and the `+`
      // in its corner — would be about the position, not the technique a coach just tapped in
      // their class list. "attempt" mode is the card that names a technique and asks its
      // question; `hooks` is optional (only `onAnswer` is ever read) and the roll is untouched.
      this._landOpenNext = true;
      this.renderLandCard(n, "attempt", null);
    } else if (idx !== this.currentPos) {
      // the card for a staged node is built LATER, when the flight lands and `enterLand` runs —
      // so the intent ("I opened this to read it") is carried forward rather than applied to a
      // card that does not exist yet. One shot: `renderLandCard` consumes it after the
      // node-change reset that would otherwise wipe a plain `_landOpen`.
      this._landOpenNext = true;
      this.stageRollAt(idx);
    } else if (!this._landEl) {
      this.renderLandCard(n, "land", null);
    }
    this._dossierIdx = null;                   // nothing "opened"; the game card simply grew
    if (this.deckShown) this.setDeckOpen(false);
    if (!this.paused) { this.setPaused(true); this._dossierAutoPaused = true; }
    this.expandLandCard(true);
    this.lastInteract = this.now; this.flare(idx);
  }
  /**
   * Leave the desktop reading sheet: restore the camera it interrupted and resume the roll if
   * opening it is what paused us. Since v1.101.0 there is no in-node card to dismiss, so this is
   * simply "put the reading surface away" — but it keeps its name and its return value because
   * the Esc ladder, the ✕ and the empty-canvas click all read it to decide whether they consumed
   * the gesture.
   */
  closeNodeDossier() {
    if (this.isMobile()) return false;
    if (this._dossierIdx == null) return false;
    this._dossierIdx = null;
    this._clearNodeQ();
    this.closeDossierSheet();
    const cb = this._camBefore; this._camBefore = null;
    this.releaseCamera();
    if (cb) this.camTarget = cb;
    if (this._dossierAutoPaused) { this.setPaused(false); this._dossierAutoPaused = false; }
    this.lastInteract = this.now;
    return true;
  }
  closeDossierSheet() {
    const sh = this.dossierSheetRef.current;
    this._dossierIdx = null;
    this._clearNodeQ();
    // ...and the landing card comes back with it — unless the in-node card is what owns the
    // screen (`_traySup`), which happens on the desktop empty-canvas path where this runs
    // alongside closeNodeDossier and would otherwise pop the card back over a still-visible node.
    if (!this._traySup) this._suppressLand(false);
    if (sh && sh.style.display === "block") {
      sh.style.transform = "translateY(-102%)";
      clearTimeout(this._shT);
      this._shT = setTimeout(() => { if (this._dossierIdx == null) sh.style.display = "none"; }, 360);
    }
  }
  /**
   * RETIRED (v1.101.0): the in-node "fuller container". Zooming into a node used to mount the
   * whole dossier inside the node's own shape; the owner's call is that the game's normal card
   * is the container and `More ▸` unfolds it there, so this surface no longer exists. The method
   * stays as the ONE place that guarantees it stays down — `draw()` calls it every frame, and a
   * hidden element with a stale `_nodeCardOn` would keep the options tray faded and the canvas
   * glyph crossfaded out with nothing drawn in their place.
   */
  updateNodeCard() {
    const el = this.nodeCardRef && this.nodeCardRef.current;
    if (el && el.style.display !== "none") { el.style.display = "none"; el.innerHTML = ""; }
    if (this._nodeCardOn || this._nodeCardIdx != null || this._nodeCardO) {
      this._nodeCardOn = false; this._nodeCardIdx = null; this._nodeCardO = 0;
      this._suppressTray(false);
    }
  }

  // keep the in-node dossier readable: fade the options tray under it while the card is up
  /** ── TAPPING EMPTY GRAPH IS A REAL GESTURE (v1.113.6) ──────────────────────────────────────
   *
   * Owner: "when I click the graph background and I'm not clicking any node it should close, and
   * do the same thing as closing the current node — which should also close the choices, by the
   * way, currently doesn't — and it should pause when you do that, and when you click play again
   * it shows you where you were."
   *
   * It did almost nothing: three closers, every one of which is a no-op in the ordinary in-roll
   * state (no dossier open, pane shut), so tapping empty space was a complete no-op. Now it is
   * "stand everything down and hold the clock":
   *
   *  · THE TRAY GOES WITH THE CARD. `clearOptions()` is destructive — it drops `optionIdxs` and
   *    every caller of it ends or restarts the roll. `_suppressTray` is the existing primitive
   *    that hides the tray WITHOUT ending anything (the replay film uses it), so the hand is
   *    still there, still yours, just out of the way. Joins the same two-holder discipline with
   *    `_suppressLand` that `applyDeckVisibility` and `stopReplay` already observe.
   *  · ITS OWN LATCH. Each surface owns a boolean so closing it can only give back a clock it
   *    took; reusing `_paneAutoPaused` here would make the next pane close release a pause it
   *    never took. Hence `_bgAutoPaused`.
   *  · THE PANE IS NOT TOUCHED ON DESKTOP. The old branch called `closeExplorerIfOpen()`, which
   *    has no width guard — so a desktop background tap closed the pane, contradicting PANE LAW
   *    ("desktop graph clicks leave it alone"). `closeDeckIfStudying()` is the guarded helper
   *    that already exists for exactly this, and the owner's ask was about the card anyway.
   *  · AND IT REMEMBERS. `_syncUrl` already records the last node the USER chose (deliberate
   *    navigation only), so pressing play flies back to it rather than wherever the roll drifted.
   */
  _tapBackground() {
    this.closeNodeDossier();
    this.closeDossierSheet();
    this.closeDeckIfStudying();        // mobile-only by design (the drawer owns the screen there)
    this._standDown(true);
  }
  /** Stand the play surfaces down and hold the clock on our own latch. */
  _standDown() {
    if (this._bgDown) return;
    this._bgDown = true;
    this._bgReturnIdx = (this._lastChosenIdx != null ? this._lastChosenIdx : this.currentPos);
    this._suppressTray(true);
    if (!this.paused) { this.setPaused(true); this._bgAutoPaused = true; }
    this.fx("bg_dismissed", { returnTo: this._bgReturnIdx });
  }
  /** …and bring them back. Called from setPaused's resume path (never calls back into it, so it
   *  cannot recurse — same shape as the replay teardown that already lives there). */
  _bgRestore() {
    if (!this._bgDown) return;
    this._bgDown = false; this._bgAutoPaused = false;
    this._suppressTray(false);
    // "when you click play again it shows you where you were" — the node the USER last chose,
    // not wherever an auto-advance happened to leave the roll.
    const i = this._bgReturnIdx;
    if (i != null && this.nodes && this.nodes[i]) {
      this.camTarget = this.rollCamTarget(this.nodes[i], false);
      this.holdCamera();
    }
  }
  _suppressTray(hide) {
    if (this._traySup === hide) return;
    this._traySup = hide;
    for (const ref of [this.optionsRef, this.optionHintRef]) {
      const op = ref && ref.current; if (!op) continue;
      op.style.transition = "opacity .25s";
      if (hide) { op.style.opacity = "0.1"; op.style.pointerEvents = "none"; }
      else { op.style.opacity = ""; op.style.pointerEvents = ""; }
    }
    this._suppressLand(hide);
  }
  /**
   * ...AND THE LANDING CARD, which is the surface that actually covered the node.
   *
   * `.ng-landcard` is root-plane z:5 and the in-node card is z:5 in the wrap, so the landing card
   * paints ON TOP — measured at 1440x900 it sat squarely over the middle of every node card,
   * which is exactly where the question now lives. The tray was already faded for this reason;
   * the landing card belongs to the roll the dossier has just paused, so it goes with it.
   * Same treatment (inline opacity + pointer-events) the option-detail sheet uses, and
   * _landBackfill already knows to preserve an inline hide across a re-render.
   */
  /** Is the landing card currently standing down? A–D must not grade a question nobody can see:
   *  opening the pane suppresses the card but never nulls `this._mc`, so the keys stayed live
   *  over an invisible surface and a stray keystroke scored a question the player was not being
   *  asked (v1.113.4). Reads the inline opacity `_suppressLand` writes — the same tell
   *  `_landBackfill` already uses, so there is no second source of truth. */
  _landHidden() {
    // ASK THE HOLDERS, NOT THE PIXELS. The first cut read the inline opacity `_suppressLand`
    // writes — and lost a race: the option sheet restores the card through a .25s transition, so
    // pressing Esc and immediately answering found the card still styled hidden and the keys went
    // dead. Every surface that stands the card down owns a synchronous flag, and intent flips the
    // instant the user acts; a style is only true once the animation says so.
    return !this._landEl || !!this._landPaneHid || !!this._traySup || !!this._bgDown || !!this._detailCtx;
  }
  _suppressLand(hide) {
    const el = this._landEl; if (!el) return;
    // `!important` is REQUIRED, not defensive. `.ng-landcard` carries `animation:ngCardInX .28s`,
    // and a running CSS animation outranks a plain inline declaration — so a plain
    // `style.opacity = "0"` is simply ignored while it plays. That window is not theoretical here:
    // a deck chunk landing fires onFlashcardsReady -> _landBackfill, which builds a NEW card
    // element (fresh animation) at exactly the moment a reader is opening a dossier. Measured:
    // inline opacity "0", computed 0.99, card fully painted over the node. `!important` outranks
    // an animation; `style.opacity` still reads "0", which is what _landBackfill detects.
    // ...AND `visibility`, WHICH IS THE ONLY ONE OF THE THREE THAT ACTUALLY DISARMS THE CARD.
    // `pointer-events` on the root is INHERITED, so a child that re-enables it inline wins for
    // itself — and `[data-land-foot]` does exactly that, deliberately (a fixed overlay's
    // disabled pointer-events is inherited, and the footer holds `More ▸` and the capture +).
    // Hit-testing ignores `opacity`. So a "hidden" landing card left a fully INVISIBLE sticky
    // footer strip live across the bottom of its box, and whatever sat under it was dead to the
    // mouse: measured with elementFromPoint returning `<div data-land-foot="1">` at the centre
    // of the in-node dossier's capture button (Playwright: "subtree intercepts pointer events",
    // 120s of retries). `visibility` is inherited too, but nothing here sets `visible` to
    // escape it, and it removes the subtree from hit-testing outright. `!important` for the
    // same reason as the opacity above: a running entry animation outranks a plain declaration.
    for (const t of [el, this._landFilmEl]) {
      if (!t) continue;
      if (hide) { t.style.setProperty("opacity", "0", "important"); t.style.pointerEvents = "none"; t.style.setProperty("visibility", "hidden", "important"); }
      else { t.style.removeProperty("opacity"); t.style.pointerEvents = ""; t.style.removeProperty("visibility"); }
    }
  }
  // role badge colored by the advantage the seat gives you (app's dominance model): blue = ahead, red = behind
  badgePill(b, fs, pad) {
    if (!b) return "";
    const c = b.tone === "ahead" ? ["#7fb4ff", "rgba(90,155,240,.13)", "rgba(90,155,240,.34)"]
      : b.tone === "behind" ? ["#ff9a8f", "rgba(242,104,95,.13)", "rgba(242,104,95,.34)"]
      : ["#cfd6e4", "rgba(150,170,210,.12)", "rgba(150,170,210,.3)"];
    return '<span data-dossier-badge title="blue = you\u2019re ahead \u00b7 red = you\u2019re behind" style="font-size:' + fs + 'px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:' + c[0] + ';background:' + c[1] + ';border:1px solid ' + c[2] + ';border-radius:999px;padding:' + pad + ';">' + b.label + '</span>';
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
  /**
   * The reading surface for a node that is NOT the one you are standing in. Since v1.101.0 it is
   * the dossier SHEET on every form factor (a top sheet on a phone, a right-docked reading column
   * on a desktop) — the in-node container is retired, and `dossierRef` cannot be used because it
   * is a child of the explorer pane, which pane law says only the user may open.
   */
  renderDossier(n) {
    const mob = this.isMobile();
    const dos = this.dossierSheetRef.current; if (!dos) return;
    const sp = this.splitName(n.t), cat = this.deckCat(n), col = this.hex(n.col);
    const rc = this.richContentFor(n);
    // authored decks are keyed "Name|Role" — fall back across role variants so content always surfaces
    const fam = n.ty === "positions" ? this.posFamily(n.t) : sp.main;
    let legacy = null, legacyKey = "";
    for (const k of [this.deckKeyFor(n).key, fam + "|Bottom", fam + "|Top", fam + "|Attacker", fam + "|Defender", fam, sp.main]) {
      const cand = this._ngc(k);
      if (cand) { legacy = cand; legacyKey = k; break; }
    }
    const persp = rc ? rc.perspectives.attacker : null;
    const isCur = n.idx === this.currentPos;
    // the dossier is the landing card's `More ▸`, so it must not name the other side either: for the
    // state in play `playedRole` is the true side, and for anything else the title is all there is
    let role = this.playedRole(n);
    // authored copy is side-specific; if it came from the other side, don't contradict it with a badge
    const lm = legacyKey.match(/\|(Top|Bottom)$/i);
    if (role && lm && lm[1].toLowerCase() !== role.toLowerCase()) role = null;
    // THE HEADLINE IS A NAME, never a statement about the side. Every one of the 136 collapsed
    // position hubs is titled "… Top" by graph-data.json, so that suffix is a rendering artifact and
    // comes off for EVERY position, whichever side is in play — naming the side is the badge's job.
    // Stripping `role` instead coupled the two, and it only looked right while `role` was the (always
    // "Top") title suffix: once it became the side actually being played, `\s+Bottom\s*$` could not
    // match "Mount Top", so a bottom landing's dossier read "Mount Top" next to a "Bottom" badge —
    // and the same hole opened whenever the badge was suppressed for other-side authored copy.
    const title = n.ty === "positions" ? this.posFamily(sp.main) : sp.main;
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

    // the sheet is the reading surface on BOTH form factors now, so it always carries a way out
    let h = '<div style="display:flex;align-items:center;padding:6px 16px 8px;">' +
      (mob ? '<span class="dsBack" style="cursor:pointer;font-size:12px;font-weight:600;color:#8b97b0;padding:6px 0;">\u2039 All techniques</span>' : '') +
      '<span class="dsClose" style="cursor:pointer;margin-left:auto;width:32px;height:32px;border-radius:10px;border:1px solid rgba(150,170,210,.2);background:rgba(255,255,255,.04);color:#8b97b0;font-size:16px;display:flex;align-items:center;justify-content:center;">\u00d7</span></div>';
    h += '<div style="padding:2px 18px 22px;">';
    h += '<div style="display:flex;align-items:center;gap:7px;">' +
      (isCur
        ? '<span style="width:8px;height:8px;border-radius:50%;background:#5a9bf0;box-shadow:0 0 8px rgba(90,155,240,.7);flex:none;"></span><span style="font-size:9px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#7fb4ff;">Your current position</span>'
        : this.nodeGlyph(n.ty, col, 9) + '<span style="font-size:9px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#9fb0d8;">' + cat + '</span>') +
      '</div>';
    h += '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:7px;">' +
      '<span data-dossier-title style="font-family:\'Space Grotesk\',sans-serif;font-size:22px;font-weight:600;letter-spacing:-.01em;line-height:1.1;color:#eef1f6;">' + title + '</span>' +
      this.badgePill(badge, 9.5, "2.5px 10px") +
      // the phone reads a node here, so the familiarity counter belongs here too — same chip,
      // same handle as the in-node card's plate (the two are never on screen together)
      (mob ? this.familiarityChip(this.deckKeyFor(n).key, "data-node-count", { style: "margin-left:auto;" }).html : "") +
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
    // ── THE PHONE GETS THE QUESTION ON THE SHEET, NOT IN THE NODE ──
    // openDossier forks on isMobile(): a phone reads a node in the 70%-tall sheet, and the in-node
    // card is a desktop object — 700-780 CSS px of shape, which the fit cap would squeeze to ~0.45
    // on a 390x844 screen, turning 12px option rows into 5px ones. So the sheet carries it: same
    // builder, same surface tag, same economy, in a scrollable column at full text size.
    // the question host, on BOTH form factors — the sheet is the reading surface now (v1.101.0)
    h += '<div data-node-q style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(150,170,210,.14);"></div>';
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
    // add-to-class-list, right where a coach is already reading about the technique
    h += '<div class="dsList" style="cursor:pointer;display:flex;align-items:center;gap:10px;margin-top:8px;border:1px solid rgba(150,170,210,.2);border-radius:12px;padding:10px 14px;">' +
      '<span class="dsListGlyph" style="flex:none;width:26px;height:26px;border-radius:8px;background:rgba(150,170,210,.14);color:#9ab0e0;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;line-height:1;">+</span>' +
      '<div style="display:flex;flex-direction:column;gap:1px;"><span class="dsListTxt" style="font-size:12.5px;font-weight:700;color:#eef1f6;">Add to today\u2019s class list</span><span style="font-size:10.5px;color:#9aa6bd;">share the class as one link</span></div></div>';
    h += '</div>';
    dos.innerHTML = h;
    // clear only on a CHANGE of node: re-rendering the sheet for the node already open must not
    // reset a question the reader has already answered (that is the freeze rule)
    // the state's own question, on every form factor — the sheet is the reading surface now, and
    // it was only ever gated on `mob` because the desktop read happened in the node instead
    if (!this._nodeQ || this._nodeQ.idx !== n.idx) this._clearNodeQ();
    this._renderNodeQuestion(n, dos.querySelector("[data-node-q]"));
    this._wireDossierListButton(dos, n, "dossier");
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
  // ── ONE "START A ROLL HERE" (v1.104.5, owner: "why wasn't this calling the same method as
  // when navigation happens? or wtv. i thought this had been streamlined") ──
  //
  // playFrom used to be a SECOND, STALE implementation of rollFromPosition, and it had drifted:
  //   · `camTarget = { cx, cy, vw: this.graphW * 0.42 }` — the exact hard-coded framing v1.103.2
  //     replaced everywhere else with `rollCamTarget()`. So a roll started from the search modal
  //     or the "Roll from here" confirm landed on a DIFFERENT composition (5x zoomed out, no
  //     vertical lift into the free band, not aimed at the node's label, no horizontal bias)
  //     than the identical action taken by clicking the node.
  //   · it never archived the roll it replaced into `_pastRolls`, never reset `rollLog` /
  //     `_lastActor` / `_currentDeckKey` / session state, never reset `_played` or `prevPosVal`,
  //     and never called `hideCenter()`.
  //   · it landed via `enterLand(false)` — `first=false` — so the new roll's opening state was
  //     not marked as a start in the log.
  // Every one of those is what `rollFromPosition` already does correctly. The ONLY thing playFrom
  // legitimately added is a caller-chosen role, which is now a parameter.
  playFrom(idx, role) {
    this.closeModal();
    this.rollFromPosition(idx, false, role);
  }
  // ── THE URL FOLLOWS DELIBERATE NAVIGATION (v1.104.5, owner: "make sure every roll from here
  // does navigation (including in the url)") ──
  //
  // Every graph node id IS a real page path: 1466 of the 1467 ids resolve to a built page (the
  // one miss is `Transitions/100%-Sweep`, whose `%` cannot survive a filename), because both the
  // layout and Quartz derive them from the same content files. So a node's canonical URL needs no
  // mapping table and cannot drift from the site.
  //
  // ONLY on DELIBERATE navigation — `rollFromPosition`, i.e. a node the USER chose. A roll's own
  // moves never touch the URL: they are gameplay, not browsing, and the site's PostHog snippet
  // captures `$pageview` on history changes (Quartz's own SPA router navigates by pushState too),
  // so syncing every auto-advance would multiply pageviews by the length of a roll.
  //
  // A `/l/<code>` arrival owns its URL — the recipient path parses `location.pathname`, and the
  // rewrite rung depends on it — so it is never rewritten out from under itself.
  _nodeUrlPath(idx) {
    const n = this.nodes && this.nodes[idx];
    return n && n.id ? "/" + n.id : null;
  }
  _syncUrl(idx) {
    try {
      if (/^\/l\//.test(location.pathname)) return;
      const path = this._nodeUrlPath(idx); if (!path) return;
      if (location.pathname === path) return;
      history.pushState({ ngNode: this.nodes[idx].id }, "", path + location.search);
    } catch (e) { /* history unavailable (sandboxed iframe) — navigation is not load-bearing */ }
  }
  /** the node a path names, or -1. Used by boot-seeding and by Back/Forward. */
  _nodeForPath(path) {
    if (!path || !this._idIndex) return -1;
    const id = decodeURIComponent(String(path).replace(/^\/+/, "").replace(/\/+$/, ""));
    if (!id) return -1;
    const i = this._idIndex.get(id);
    return i == null ? -1 : i;
  }
  /**
   * The node a path names AND the ROLE it asks for, or `{idx:-1}`.
   *
   * `/Positions/Side-Control/Bottom` is a REAL built page — one of 272 — and until v1.114.2 it
   * resolved to NOTHING on the production layout, because the visual layer collapses Top/Bottom
   * into a single hub (`Positions/Side-Control`) and only the `?dual` prototype emits role
   * members. So arriving on any role page seeded nothing at all and the app dealt a random
   * weighted start instead. Measured: production `_nodeForPath` returned -1 and the visitor
   * landed on whatever the first-impression draw picked, on the wrong side.
   */
  _nodeAndRoleForPath(path) {
    const NONE = { idx: -1, role: null };
    if (!this._idIndex) return NONE;
    const id = decodeURIComponent(String(path || "").replace(/^\/+/, "").replace(/\/+$/, ""));
    if (!id) return NONE;                       // "/" is the front door — never seeded
    let role = null;
    let i = this._idIndex.get(id);
    if (i == null) {
      const m = id.match(/^(.*)\/(top|bottom)$/i);   // hub + side, the production shape
      if (m) { const j = this._idIndex.get(m[1]); if (j != null) { i = j; role = m[2].toLowerCase(); } }
    }
    if (i == null) return NONE;
    const n = this.nodes[i]; if (!n) return NONE;
    if (!role && (n.role === "top" || n.role === "bottom")) role = n.role;   // dual: the member IS a side
    // A TECHNIQUE PAGE SEEDS AT ITS ORIGIN POSITION — the same rule `confirmPlayFrom` uses, and
    // the reason it exists: `currentPos` must be a position, or the roll begins inside a
    // transition node with no hand to deal.
    if (n.ty !== "positions") {
      const fp = this.posNodeForId(n.fromPositionId);
      if (fp < 0) return NONE;
      if (!role && n.fromRole) role = String(n.fromRole).toLowerCase();
      i = fp;
    }
    return { idx: i, role: role };
  }
  /**
   * ARRIVING ON A NODE'S PAGE SETS THE BOARD; IT DOES NOT START A ROLL (v1.114.2).
   *
   * Owner: "if I just enter this address in my browser and it goes to this position, I don't want
   * it to start the roll from there. I wanted it to start there, but paused ... only start a new
   * roll in roll history if the player clicks the play button explicitly."
   *
   * This used to stage the board at ingest (t=0) — and then `updateCamera` called `startRoll()`
   * unconditionally when the intro finished 3.2s later, which drew a fresh position, printed
   * "Restarting the roll" and discarded the seed entirely. `_urlSeeded` was assigned and never
   * read. So the seed is now only RECORDED here (plus the deck prefetch, since the intro is still
   * its runway) and applied at the one place a boot roll begins.
   *
   * `/` is untouched, so the first-impression weighted draw (v1.82.3) still owns the front door.
   */
  _seedFromUrl() {
    if (/^\/l\//.test(location.pathname)) return false;
    const hit = this._nodeAndRoleForPath(location.pathname);
    if (hit.idx < 0) return false;
    this._urlSeedIdx = hit.idx; this._urlSeedRole = hit.role;
    this._prefetchLandDeck(hit.idx);   // the intro is still the deck's runway (v1.106.6)
    return true;
  }
  /**
   * WHERE A DUAL PAIR ACTUALLY IS (v1.114.3). Owner: "the position should be rather centered on
   * the middle of the two icons, not the actual icon that's active, so that both icons appear."
   *
   * Two things were wrong and they compounded. The camera aimed at a member's STORED `y`, which
   * is not where it is drawn — `LY` lifts each member off the shared ground by
   * `z * h * (1 - nodeK * kLOD)`, ~56px at roll zoom — and it aimed at the MEMBER rather than the
   * pair. Measured on `/Positions/Side-Control/Bottom?dual=iso`: the Top orb sat at screen y=5,
   * effectively off the top edge, while the free band the roll frames into was 76..268.
   *
   * Returns the DRAWN midpoint of the two members, or the node's own drawn point when it has no
   * partner — so every production node (no `pairId`, no `z`) is unchanged by construction.
   */
  pairMid(n) {
    if (!n) return { x: 0, y: 0 };
    const ly = this._LY || ((q) => q.y);   // before the first frame there is no lift to apply
    const p = n.pi >= 0 ? this.nodes[n.pi] : null;
    if (!p) return { x: n.x, y: ly(n) };
    return { x: (n.x + p.x) / 2, y: (ly(n) + ly(p)) / 2 };
  }
  roleLabelOf(n) { const rm = (n.t || "").match(/\s+(Top|Bottom)\s*$/i); return rm ? rm[1].toLowerCase() : (n.dom >= 0 ? "top" : "bottom"); }
  posNodeForId(posId) {
    if (!posId) return -1;
    for (let i = 0; i < this.nodes.length; i++) { if (this.nodes[i].ty === "positions" && this.nodes[i].posId === posId) return i; }
    return -1;
  }
  /**
   * `opts.role` (v1.106.5) is for a caller that KNOWS the side, where this function can only
   * derive it: a Last-rolls row recorded the role you actually played, and every position hub is
   * titled "… Top" in the visual layer, so `roleLabelOf` returns the constant `top` for all 136 of
   * them (the same reason `playFrom` takes a role at all — v1.82.3). Callers that pass nothing are
   * unchanged.
   */
  confirmPlayFrom(n, opts) {
    const persp = this._perspective || "attacker";
    // every state (position / transition / submission) is a node you can roll from.
    // positions seed at themselves; transitions & submissions seed at their origin position.
    let seedIdx = n.idx, seedName = this.splitName(n.t).main;
    if (n.ty !== "positions") {
      const fp = this.posNodeForId(n.fromPositionId);
      if (fp >= 0) { seedIdx = fp; seedName = this.splitName(this.nodes[fp].t).main; }
    }
    const given = opts && opts.role ? String(opts.role).toLowerCase() : null;
    const staged = !!(opts && opts.staged);
    const baseRole = (n.fromRole || this.roleLabelOf(this.nodes[seedIdx]) || "top").toLowerCase();
    const role = given || (persp === "defender" ? (baseRole === "top" ? "bottom" : "top") : baseRole);
    const roleLabel = given ? ("on the " + role) : (persp === "defender" ? "defending" : "attacking");
    // Z LADDER (helmet.html): a confirm is a DELIBERATE screen — host it on the root overlay
    // plane at the modal band (95), not inside the wrap where the landing card (z:5, root
    // plane) would paint over it and its z:40 could never win.
    const host = this.__ngRoot || this.wrapRef.current; if (!host) { this._detailCtx = null; this.hideOptDetail(); this.playFrom(seedIdx, role); return; }
    const ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:95;display:flex;align-items:center;justify-content:center;background:rgba(8,11,18,.62);backdrop-filter:blur(3px);pointer-events:auto;";
    const close = () => { ov.style.opacity = "0"; setTimeout(() => ov.remove(), 160); };
    ov.innerHTML =
      '<div style="width:min(380px,90vw);background:linear-gradient(180deg,#161b27,#11151e);border:1px solid rgba(150,170,210,.18);border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.5);padding:22px 22px 18px;font-family:inherit;">' +
        '<div style="font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:#7c9cff;">' + (staged ? "Set the board here" : "Start a fresh roll") + '</div>' +
        '<div style="font-size:18px;font-weight:700;color:#eef1f6;margin-top:7px;line-height:1.25;font-family:\'Space Grotesk\',sans-serif;">Roll from <span style="color:#bcd0ff;">' + seedName + '</span>, ' + roleLabel + '?</div>' +
        '<div style="font-size:12.5px;color:#93a0bd;margin-top:9px;line-height:1.55;">Your current roll will be archived to <b style="color:#c3cde0;font-weight:600;">Previous rolls</b>. ' + (staged ? 'The board is set here with you on the <b style="color:#c3cde0;font-weight:600;">' + role + '</b> and the clock held \u2014 press play when you are ready.' : 'A new roll begins here with you on the <b style="color:#c3cde0;font-weight:600;">' + role + '</b>.') + '</div>' +
        '<div style="display:flex;gap:10px;margin-top:18px;">' +
          '<button class="ng-cf-no" style="cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;padding:11px 16px;border-radius:11px;border:1px solid rgba(150,170,210,.25);background:rgba(255,255,255,.04);color:#c3cde0;">Cancel</button>' +
          '<button class="ng-cf-yes" style="flex:1;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;padding:11px;border-radius:11px;border:none;background:linear-gradient(135deg,#4a6cff,#6a5cff);color:#fff;box-shadow:0 4px 16px rgba(74,108,255,.35);display:flex;align-items:center;justify-content:center;gap:7px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>' + (staged ? "Set it up" : "Start roll") + '</button>' +
        '</div>' +
      '</div>';
    host.appendChild(ov);
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
    ov.querySelector(".ng-cf-no").addEventListener("click", close);
    ov.querySelector(".ng-cf-yes").addEventListener("click", () => {
      close();
      this._detailCtx = null; this.hideOptDetail();
      this._openSidebarOnLand = true;     // land back in the flashcards home on the seeded state
      // THE ACTION IS THE CALLER'S WHEN IT NEEDS ITS OWN (v1.106.5): the SCREEN is shared — one
      // copy of the wording, one z:95 host, one place that asks before a live roll is discarded —
      // but Last rolls STAGES (clock held, per ROAM & STAGE) and gets out of the pane's way, and
      // that is not the same action as an Explore row's "start rolling now".
      if (opts && typeof opts.go === "function") { opts.go(seedIdx, role); return; }
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
      const deckCards = this._cardsOf(deck);
      if (deckCards && deckCards.length) {
        desc.innerHTML = '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7b8aa8;font-weight:700;margin-bottom:8px;">Key question</div><div style="font-weight:600;color:#eef1f6;margin-bottom:6px;">' + deckCards[0].q + '</div>' + deckCards[0].a;
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
  // ═══ P2: MC flashcards graduating to recall (owner's fusion rule) ═══
  qhash(q) { // FNV-1a over the question text — the per-card stage key
    let h = 0x811c9dc5;
    const s = String(q || "");
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ("0000000" + h.toString(16)).slice(-8);
  }
  cardStage(key, q) { const s = this.stage && this.stage[key]; return (s && s[this.qhash(q)]) || 0; }
  /** LOCAL calendar day as an integer. Local, not UTC, because `_dayKey()` (the "N today"
   *  counter) is local — two cells on one band must roll over at the same midnight. Overridable
   *  for tests via `window.__NG_EPOCH_DAY__`; most specs simply seed past-due blobs instead. */
  _epochDay() {
    try { if (typeof window !== "undefined" && typeof window.__NG_EPOCH_DAY__ === "number") return window.__NG_EPOCH_DAY__; } catch (e) { /* non-browser */ }
    const d = new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  }
  /**
   * THE ONE SCHEDULE WRITER (v1.105.0). Called from BOTH grade chokes (`gradeRecall`,
   * `_mcAnswer`) — scheduling is about MEMORY, not format, so an MC answer moves the clock even
   * though it cannot move the stage past 2. Success climbs one rung of NG_SRS_IVLS; ANY failure
   * resets to rung 0 (due again, but not before tomorrow — see duePool's `last < today`, which is
   * what lets the pool DRAIN on a failure instead of re-serving the card all day).
   * Mirrors `noteCardDone`'s cross-deck credit: the same question text in N decks is ONE fact,
   * so it carries ONE schedule — without this, a family card duplicated into 6 variant decks
   * would go due six times and the maintenance count would read 47 when there are 12 facts.
   * Deliberately emits NO fx beat (replay-digest safety) and deliberately NOT in noteCardDone:
   * the harness's drill rail writes prep directly and must keep an empty srs.
   */
  _schedule(key, q, ok) {
    const today = this._epochDay();
    const write = (dk) => {
      const m = (this.srs[dk] = this.srs[dk] || {});
      const qh = this.qhash(q);
      const cur = m[qh];
      let ivl;
      if (!ok) ivl = NG_SRS_IVLS[0];
      else {
        const at = cur ? NG_SRS_IVLS.indexOf(cur[1]) : -1;
        ivl = NG_SRS_IVLS[Math.min(NG_SRS_IVLS.length - 1, at + 1)];
      }
      m[qh] = [today + ivl, ivl, today];
    };
    write(key);
    // NB _sharedDecksFor returns null when unshared, and the list INCLUDES the origin deck —
    // noteCardDone's loop has the same skip. Without it every grade wrote twice and climbed
    // two rungs (1→3 on a first answer), which the srs-due spec caught on its first run.
    const shared = this._sharedDecksFor(q, key);
    if (shared) for (const k of shared) { if (k !== key) write(k); }
    // no _saveProgress here: both callers already save via _bumpStage/noteCardDone
  }
  /** Cards past due and NOT yet reviewed today — `last < today` is what lets a failed card leave
   *  the pool until tomorrow. Returns [{key, qh}]; `dueCount()` dedupes by qhash (one FACT due
   *  once, however many decks carry it). */
  duePool() {
    const today = this._epochDay();
    const out = [];
    for (const dk in this.srs || {}) {
      const m = this.srs[dk];
      for (const qh in m) { const e = m[qh]; if (e && e[0] <= today && e[2] < today) out.push({ key: dk, qh: qh }); }
    }
    return out;
  }
  dueCount() { const seen = new Set(); for (const e of this.duePool()) seen.add(e.qh); return seen.size; }
  /** is THIS card due (and unreviewed today)? */
  _cardDue(key, q) {
    const m = this.srs && this.srs[key]; if (!m) return false;
    const e = m[this.qhash(q)]; if (!e) return false;
    const today = this._epochDay();
    return e[0] <= today && e[2] < today;
  }
  _bumpStage(key, q, d, cap) {
    const qh = this.qhash(q);
    const s = (this.stage[key] = this.stage[key] || {});
    // THE CAP IS A CEILING ON GROWTH, NEVER A DEMOTION (v1.105.0). The absolute clamp meant a
    // correct MC answer (cap 2) on a recall-proven card wrote min(2, 3+1) = 2 — the belt DROPPED
    // on a right answer, and gradeRecall's `wasProven` guard then re-minted `rec` for the same
    // card. Latent while the landing only asked stage<2 cards; due-first selection asks any
    // stage, so maintenance answers would have fired it constantly.
    const cur = s[qh] || 0;
    const lim = cap == null ? 4 : cap;
    s[qh] = d > 0 ? Math.max(cur, Math.min(lim, cur + d)) : Math.max(0, Math.min(lim, cur + d));
    this._bumpStageVer();
    this._saveProgress();
    return s[qh];
  }
  // The ONE seam that invalidates the gameScore memo. It is not only card grades that move the
  // score: a deck landing can change what deckMastery can see, and gameScore memoises on
  // _stageVer, so hydration MUST come through here or a stale score sticks for the session.
  _bumpStageVer() {
    this._stageVer = (this._stageVer || 0) + 1;
    if (this.renderTabSubtitles) this.renderTabSubtitles(); // keep the Explore subtitle live with the score
  }
  // first sentence, ≤160 chars — applied to the CORRECT answer too (no length tell).
  // null = this text cannot be an MC option (the card falls back to classic recall).
  get MC_LINE() { return 36; } // one-line option cap; keep in sync with regenerate_neural_data MC_LINE_BUDGET
  mcClip(a) {
    const m = String(a || "").match(/^[\s\S]*?[.!?]/);
    const s = (m ? m[0] : String(a || "")).trim();
    return s.length > 0 && s.length <= 160 ? s : null;
  }
  _mcNorm(s) { return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim(); }
  _mcSimilar(a, b) {
    const A = new Set(this._mcNorm(a).split(" ")), B = new Set(this._mcNorm(b).split(" "));
    let inter = 0; for (const w of A) if (B.has(w)) inter++;
    const uni = A.size + B.size - inter;
    return uni ? inter / uni > 0.8 : true;
  }
  // distractor pooling: authored graded tiers first, then same deck → graph neighbors →
  // same category. Deterministic via rng("mc-pick")/rng("mc-shuffle"). <2 survivors → null.
  // `tag` scopes the RNG so one surface can never eat another's rigged queue: the landing card
  // draws on "land-mc-*", leaving "mc-*" to the sidebar/checkpoint exactly as journeys rig it.
  mcDistractors(card, deckKey, n, tag) {
    n = n || 3;
    const tPick = tag ? tag + "-mc-pick" : "mc-pick", tShuf = tag ? tag + "-mc-shuffle" : "mc-shuffle";
    const correct = card.a;
    if (!correct) return null;
    const picked = [], tiers = [];
    const tryAdd = (text, tier, clip) => {
      if (picked.length >= n || !text) return;
      const t = clip ? this.mcClip(text) : String(text || "").trim(); if (!t) return;
      const ratio = t.length / correct.length;
      if (ratio < 0.4 || ratio > 2.5) return;                 // no length tell
      if (this._mcSimilar(t, correct)) return;                // accidental-correct guard
      for (const p of picked) if (this._mcSimilar(t, p)) return;
      picked.push(t); tiers.push(tier);
    };
    const d = card.mc || null;                                // authored one-line graded tiers win
    if (d) {
      (d.p || []).forEach((x) => tryAdd(x, "plausible", false));
      (d.t || []).forEach((x) => tryAdd(x, "trap", false));
    }
    const decks = (this.flashcards && this.flashcards.decks) || {};
    // RESIDENCY DISCIPLINE (v1.80.4). Every deck this pooler consults must already be resident,
    // because whether a deck's cards happen to have arrived decides whether a draw contributes
    // a distractor — and therefore how many further draws the loops make. If residency could
    // shift the draw count, the RNG stream would depend on network timing: rigged journeys
    // would replay differently run to run, and the shuffle below would deal different options
    // for the same card. `_mcCold` records every deck we wanted but did not have, so
    // _warmMcPool() can fetch them and re-run from the SAME stream position (it rolls the draws
    // back), and so a cold consult is loud instead of silent (beat: mc_pool_cold).
    const consult = (k) => {
      const d = decks[k];
      const c = this._cardsOf(d);
      if (c) return c;
      if (d) this._mcCold(k);
      return null;
    };
    const deckCards = consult(deckKey);
    if (deckCards) {
      const order = deckCards.filter((c) => c.q !== card.q);
      while (picked.length < n && order.length) tryAdd(order.splice((this.rng(tPick) * order.length) | 0, 1)[0].a, "pool", true);
    }
    if (picked.length < n) {                                  // graph-neighbor decks
      const idx = this.nodeForKey(deckKey);
      if (idx >= 0 && this.adj && this.adj[idx]) {
        for (const k of this.adj[idx]) {
          if (picked.length >= n) break;
          const nc = consult(this.deckKeyFor(this.nodes[k]).key);
          if (nc && nc.length) tryAdd(nc[(this.rng(tPick) * nc.length) | 0].a, "pool", true);
        }
      }
    }
    if (picked.length < n) {                                  // same-category anywhere (bounded)
      // `keys` is the MANIFEST key list, identical whether or not any deck is resident — so the
      // key draw itself never moves. Only the card draw can, and consult() makes that loud.
      const keys = Object.keys(decks);
      let guard = 0;
      while (picked.length < n && guard++ < 60) {
        const k = keys[(this.rng(tPick) * keys.length) | 0];
        const dc = consult(k);
        if (dc && dc.length && k !== deckKey) tryAdd(dc[(this.rng(tPick) * dc.length) | 0].a, "pool", true);
      }
    }
    if (picked.length < 2) return null;
    const opts = [{ text: correct, tier: "correct" }].concat(picked.map((t, i) => ({ text: t, tier: tiers[i] })));
    for (let i = opts.length - 1; i > 0; i--) {               // deterministic shuffle
      const j = (this.rng(tShuf) * (i + 1)) | 0;
      const tmp = opts[i]; opts[i] = opts[j]; opts[j] = tmp;
    }
    return { options: opts, correctIdx: opts.findIndex((o) => o.tier === "correct") };
  }
  // MC is the IN-PLAY format (the landing card asks it under a clock); the side pane is the
  // study surface and reads back as classic Q&A unless the user opts in. Hence the default flip
  // auto -> classic: nobody meets multiple choice in the sidebar by accident.
  mcActive(key, card) {
    if (this._checkpoint) return true;                        // the quiz is always MC
    const mode = this.get("mcMode", "classic");
    if (mode === "classic") return false;
    if (mode === "mc") return true;
    return this.cardStage(key, card.q) < 2;                   // auto: MC until graduated
  }
  get MC_KEYS() { return ["A", "B", "C", "D", "E"]; }
  // the shared MC renderer. Truth (correct index, tier map) lives ONLY in this closure +
  // this._mc — never in a DOM attribute (cheat vector). Never calls setBeacon (one-beacon law).
  // `surface` names the block ("land" | "deck" | "checkpoint") so two live blocks can't read
  // each other's truth: the landing question and an open sidebar card coexist.
  _mcBlock(card, key, onDone, surface) {
    // RNG SCOPE. `tag` is what keeps one surface out of another's rigged queue: the landing card
    // draws on land-mc-*, the node card on node-mc-*, and the sidebar/checkpoint keep the bare
    // mc-* stream journeys rig by name. A new surface that forgot its tag would eat those values
    // and every frame-exact replay would drift.
    const mc = this.mcDistractors(card, key, 3, surface === "land" || surface === "node" ? surface : null);
    // a surface that cannot build options must not disarm another surface's live block
    if (!mc) { if (!this._mc || this._mc.surface === (surface || "deck")) this._mc = null; return null; }
    const qh = this.qhash(card.q);
    const truth = { key: key, qhash: qh, correct: mc.correctIdx, tiers: mc.options.map((o) => o.tier), n: mc.options.length, surface: surface || "deck" };
    this._mc = truth;                                         // the keyboard drives the newest block
    const wrap = document.createElement("div");
    wrap.__ngMc = truth;   // so a surface that took the keyboard can hand it back (see _clearNodeQ)
    wrap.setAttribute("role", "radiogroup");
    wrap.setAttribute("aria-label", "Answer options");
    wrap.style.cssText = "position:relative;display:flex;flex-direction:column;gap:7px;";
    const live = document.createElement("div");
    live.setAttribute("aria-live", "polite");
    live.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);";
    wrap.appendChild(live);
    const oneLine = (mc.options[mc.correctIdx] && mc.options[mc.correctIdx].text.length <= this.MC_LINE);
    // Each surface gets its OWN option handle. The landing card and an open sidebar card are on
    // screen at the same time, so a bare [data-mc-opt] selector would silently match both — the
    // split keeps every "the sidebar shows N options" assertion meaning what it says.
    const OPT = truth.surface === "land" ? "data-land-mc-opt" : truth.surface === "node" ? "data-node-mc-opt" : "data-mc-opt";
    let answered = false;
    const answer = (i) => { if (answered) return; answered = true; this._mcAnswer(i, card, key, wrap, live, onDone, truth); };
    truth.answer = answer;                                    // the A/B/C/D keyboard seam
    mc.options.forEach((o, i) => {
      const b = document.createElement("button");
      b.setAttribute(OPT, String(i));
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", "false");
      b.style.cssText = "cursor:pointer;font-family:inherit;text-align:left;font-size:12px;line-height:1.45;padding:9px 11px;border-radius:9px;border:1px solid rgba(150,170,210,.22);background:rgba(255,255,255,.03);color:#c8d2e4;transition:border-color .15s,background .15s;" + (oneLine ? "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" : "");
      b.innerHTML = '<b style="color:#8094b4;font-weight:800;margin-right:7px;">' + (this.MC_KEYS[i] || i + 1) + '</b>' + o.text;
      b.addEventListener("click", () => answer(i));
      wrap.appendChild(b);
    });
    this.fx("mc_shown", { deckKey: key, qhash: qh, opts: mc.options.length, surface: truth.surface });
    return wrap;
  }
  _mcAnswer(i, card, key, wrap, live, onDone, truth) {
    const mc = truth || this._mc; if (!mc) return;
    const correct = i === mc.correct;
    const tier = mc.tiers[i];
    const btns = wrap.querySelectorAll("[data-mc-opt],[data-land-mc-opt],[data-node-mc-opt]");
    btns.forEach((b) => { b.style.cursor = "default"; b.setAttribute("aria-disabled", "true"); });
    const cbtn = btns[mc.correct];
    if (cbtn) {
      cbtn.setAttribute("data-mc-result", "correct");
      cbtn.style.borderColor = "rgba(126,224,168,.6)"; cbtn.style.background = "rgba(126,224,168,.12)";
    }
    if (correct) {
      btns[i].setAttribute("aria-checked", "true");
      const stage = this._bumpStage(key, card.q, 1, 2);       // MC caps at the recall gate (growth-only — see _bumpStage)
      this._schedule(key, card.q, true);                       // memory reviewed — move its clock
      this.prep[key] = (this.prep[key] || 0) + 1;             // MC is honest work: feeds odds/JIT
      this.noteCardDone(card, key);
      this.noteCardAnswered();
      this.refreshOptionOdds();
      this.fx("mc_correct", { deckKey: key, qhash: mc.qhash, stage: stage });
      live.textContent = "Correct.";
      cbtn.style.animation = "ngCardIn .3s ease";
      // only the sidebar deck auto-advances to the next card; the landing question is a
      // one-shot beat inside the roll and must hand back to its own onDone.
      if (!this.isTest() && !this._checkpoint && mc.surface === "deck") {
        if (this._mcAdvT) clearTimeout(this._mcAdvT);
        this._mcAdvT = setTimeout(() => { this._mcAdvT = null; if (this.deckShown && this._mc && this._mc.qhash === mc.qhash) { this.deckIdx++; this.revealed = false; this.renderDrill(); } }, 600);
        return;
      }
      if (onDone) onDone(true, "correct");
    } else {
      const btier = tier === "plausible" || tier === "trap" ? tier : "wrong";
      btns[i].setAttribute("data-mc-result", btier);
      btns[i].style.borderColor = btier === "trap" ? "rgba(255,80,80,.6)" : "rgba(255,150,110,.5)";
      btns[i].style.background = "rgba(255,110,110,.07)";
      if (btier === "trap") this._bumpStage(key, card.q, -1);
      this._schedule(key, card.q, false);                      // any wrong answer resets the schedule // the trap costs a stage
      this.fx("mc_wrong", { deckKey: key, qhash: mc.qhash, tier: btier, correct: mc.correct });
      live.textContent = btier === "plausible"
        ? "Close \u2014 compare your pick with the highlighted answer."
        : btier === "trap"
          ? "That one gets you in trouble \u2014 the correct answer is highlighted."
          : "Not this one \u2014 the correct answer is highlighted.";
      if (onDone) onDone(false, btier);
    }
  }
  // rails: re-present a specific card of the open deck by its qhash (journeys + weakest-link)
  presentCard(qh) {
    const deck = this.deck; if (!deck) return false;
    for (let i = 0; i < deck.length; i++) {
      if (this.qhash(deck[i].q) === qh) { this.deckIdx = i; this.revealed = false; this.renderDrill(); return true; }
    }
    return false;
  }
  // the recall grading choke (footer Got-it / Review-again, keyboard, journeys). Recall is the
  // ONLY path that mints rec — MC can never reach it (mastered means recall-proven).
  recallGrade(got) {
    if (!this.deck || !this._deckInfo) return;
    this.gradeRecall(this._deckInfo.key, this.deck[this.deckIdx], got);
    this.deckIdx++; this.revealed = false; this.renderDrill();
  }
  /**
   * THE recall grade — extracted from recallGrade so a second surface can mint the same proof
   * instead of forking it. The sidebar's own recall UI is welded into renderDrill (question in
   * the card, buttons in the pane's pinned footer) and cannot be lifted out; the ARITHMETIC can,
   * and must be, or "recall-proven" would mean two different things depending on where you were
   * standing when you proved it. Card may be absent (an empty deck's footer still grades).
   */
  gradeRecall(key, card, got) {
    if (got) {
      this.prep[key] = (this.prep[key] || 0) + 1;
      if (card) {
        const wasProven = this.cardStage(key, card.q) >= 3;
        this._bumpStage(key, card.q, 1);                     // toward mastered (cap 4)
        this._schedule(key, card.q, true);                   // memory reviewed — move its clock
        // rec = DISTINCT cards proven by recall (stage>=3): count each card ONCE, the first
        // time it crosses. Re-grading a mastered card no longer inflates the deck's mastered
        // status; MC caps stage at 2, so only recall can mint rec.
        if (!wasProven && this.cardStage(key, card.q) >= 3) { this.rec[key] = (this.rec[key] || 0) + 1; this.fx("recall_proven", { deckKey: key }); }
        this.noteCardDone(card, key);
      }
      this.noteCardAnswered();
      this.refreshOptionOdds();
    } else if (card) {
      this._bumpStage(key, card.q, -1);                       // Review-again drops a stage
      this._schedule(key, card.q, false);                     // failure: schedule resets to 1 day
    }
  }
  /**
   * A self-contained recall block: think → Show answer → Got it / Review again.
   *
   * `surface` names the block's DOM handles ("node" → [data-node-recall] / [data-node-reveal] /
   * [data-node-got] / [data-node-again]), the same split _mcBlock uses for its options, so two
   * live surfaces can never answer to one selector. Grading goes through gradeRecall — this
   * renders, it does not decide what a grade is worth.
   */
  _recallBlock(card, key, onDone, surface) {
    const p = "data-" + (surface || "deck");
    const wrap = document.createElement("div");
    wrap.setAttribute(p + "-recall", "1");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:.6em;";
    const live = document.createElement("div");
    live.setAttribute("aria-live", "polite");
    live.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);";
    wrap.appendChild(live);
    const ans = document.createElement("div");
    ans.setAttribute(p + "-answer", "1");
    ans.style.cssText = "display:none;font-size:1em;line-height:1.5;color:#c8d2e4;padding:.6em .8em;border-radius:.6em;border:1px solid rgba(126,224,168,.28);background:rgba(126,224,168,.07);";
    ans.textContent = card.a || "";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:.5em;";
    const btn = (label, attr, primary) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute(attr, "1");
      b.style.cssText = "flex:1;cursor:pointer;font-family:inherit;font-size:.95em;font-weight:700;padding:.7em .9em;min-height:2.6em;border-radius:.66em;border:1px solid " + (primary ? "rgba(110,160,255,.4)" : "rgba(150,170,210,.24)") + ";background:" + (primary ? "rgba(74,108,255,.18)" : "rgba(255,255,255,.04)") + ";color:" + (primary ? "#eef1f6" : "#c8d2e4") + ";";
      b.textContent = label;
      return b;
    };
    const reveal = btn("Show answer", p + "-reveal", true);
    let graded = false;
    reveal.addEventListener("click", () => {
      ans.style.display = "block";
      live.textContent = "Answer revealed.";
      row.innerHTML = "";
      const again = btn("Review again", p + "-again", false);
      const got = btn("Got it", p + "-got", true);
      const grade = (ok) => {
        if (graded) return; graded = true;
        this.gradeRecall(key, card, ok);
        row.querySelectorAll("button").forEach((b) => { b.setAttribute("aria-disabled", "true"); b.style.cursor = "default"; });
        live.textContent = ok ? "Marked as recalled." : "Marked for review.";
        if (onDone) onDone(!!ok, ok ? "recalled" : "review");
      };
      again.addEventListener("click", () => grade(false));
      got.addEventListener("click", () => grade(true));
      row.appendChild(again); row.appendChild(got);
    });
    row.appendChild(reveal);
    wrap.appendChild(ans); wrap.appendChild(row);
    return wrap;
  }

  // ═══ P2: checkpoint quiz (replaces the P1 placeholder behind the same handle + beats) ═══
  _cancelCheckpoint() { if (this._checkpoint) { this._checkpoint = null; this.fx("checkpoint_abandoned", {}); } }
  startCheckpoint(beltId, unit) {
    if (this._checkpoint) return; // a quiz is already in progress — don't discard it
    const uk = beltId + "/" + unit.id;
    const live = unit.lessons.filter((l) => this._lessonLive(l));
    if (!live.every((l) => this.lessonDone(l.deckKey))) { this.setEvent("Checkpoint evidence needed", "Finish this unit's lessons first", "bad"); return; }
    // The quiz pool IS this unit's cards, so they must be resident before we draw. Without this
    // a manifest boot reported "No quizzable cards in this unit" for a unit the user had just
    // finished. Nothing has been drawn yet, so re-entering consumes no RNG (checkpoint-pick
    // rigging is untouched) and the evidence check above already passed on manifest counts.
    const cold = live.map((l) => l.deckKey).filter((k) => !this._deckResident(k));
    if (cold.length) { this.hydrateDecks(cold).then(() => this.startCheckpoint(beltId, unit)); return; }
    const decks = (this.flashcards && this.flashcards.decks) || {};
    const pool = [];
    for (const l of live) {
      const dc = this._cardsOf(decks[l.deckKey]);
      if (dc) for (const c of dc) { if (this.mcClip(c.a)) pool.push({ card: c, key: l.deckKey }); }
    }
    const want = Math.min((unit.checkpoint && unit.checkpoint.cards) || 6, pool.length);
    if (!want) { this.setEvent("Checkpoint unavailable", "No quizzable cards in this unit", "bad"); return; }
    const picks = [];
    const order = pool.slice();
    while (picks.length < want && order.length) picks.push(order.splice((this.rng("checkpoint-pick") * order.length) | 0, 1)[0]);
    this._checkpoint = { belt: beltId, unit: unit, uk: uk, picks: picks, i: 0, firstTry: 0, pass: (unit.checkpoint && unit.checkpoint.pass) || 5 };
    this.fx("checkpoint_start", { unit: uk, cards: picks.length });
    this._checkpointShow();
  }
  _checkpointShow() {
    const cp = this._checkpoint; if (!cp) return;
    const pick = cp.picks[cp.i];
    const e = this._entryForKey(pick.key);
    // FULL deck, presented at the picked card: same-deck distractor pooling needs the
    // siblings (a single-card synthetic deck forced pooling into unrigged category scans,
    // which stochastically found <2 survivors — the CI flake of v1.62.0)
    this.drillEntries = [e];
    this._posKey = pick.key; this.activeDrill = 0; this.revealed = false;
    this.deckIdx = Math.max(0, (e.cards || []).findIndex((c) => c.q === pick.card.q));
    this._inSession = true;
    this.setDrillHeader("Checkpoint", (cp.i + 1) + " of " + cp.picks.length + " \u00b7 " + cp.unit.name);
    this.renderDrill(); this.deckReady = true; this.deckOpen = true; this.applyDeckVisibility();
  }
  _checkpointAnswer(ok) {
    const cp = this._checkpoint; if (!cp) return;
    if (ok) cp.firstTry++;
    cp.i++;
    if (cp.i < cp.picks.length) { this._checkpointShow(); return; }
    this._checkpoint = null;
    const passed = cp.firstTry >= cp.pass;
    if (passed) {
      this.units[cp.uk] = Object.assign({}, this.units[cp.uk] || {}, { checkpoint: true, t: Date.now() });
      this.fx("checkpoint_passed", { unit: cp.uk, firstTry: cp.firstTry, of: cp.picks.length });
      this.fx("unit_done", { unit: cp.uk, belt: cp.belt });
      this._flushSave();
      this.setEvent("Checkpoint passed", cp.firstTry + "/" + cp.picks.length + " first try \u2014 unit complete", "good");
    } else {
      let weakest = null, wv = Infinity;
      for (const l of cp.unit.lessons) {
        if (!this._lessonLive(l)) continue;
        const v = ((this.prep && this.prep[l.deckKey]) || 0) + ((this.rec && this.rec[l.deckKey]) || 0);
        if (v < wv) { wv = v; weakest = l.deckKey; }
      }
      this.fx("checkpoint_failed", { unit: cp.uk, firstTry: cp.firstTry, of: cp.picks.length, weakest: weakest });
      this.setEvent("Not yet \u2014 " + cp.firstTry + "/" + cp.picks.length, "Revisit " + (weakest ? weakest.split("|")[0] : "the unit") + " and try again", "bad");
    }
    this.setDeckOpen(false);
  }

  drillGrade(got) {
    if (!this.deck || !this.revealed) return;
    this.recallGrade(got); // one choke: prep+rec+stage on Got-it, stage-drop on Review-again
  }
  isDrillOpen() { return !!(this.deckShown && this.deck); }
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
        // card total reads the manifest count for decks whose cards have not landed — the line
        // is a claim about the corpus, not about this session's downloads.
        ((D) => { const nd = Object.keys(D).length; let nc = 0; for (const k in D) nc += this._deckCardCount(D[k]); return '<div style="font-size:11.5px;color:#8b97b0;line-height:1.5;">Cards are baked per role from the BJJ Graph guide — <b style="color:#a9b6cf;">' + nd.toLocaleString() + ' decks</b> · <b style="color:#a9b6cf;">' + nc.toLocaleString() + ' cards</b> and counting.</div>'; })((this.flashcards && this.flashcards.decks) || {});
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
        ? '<div style="margin-top:14px;padding-top:13px;border-top:1px solid rgba(150,170,210,.14);"><div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:#7ee0a8;margin-bottom:7px;">Answer</div><div style="font-size:13px;color:#c8d2e4;line-height:1.6;">' + card.a + '</div>' + (card.d ? '<button data-mc-more style="margin-top:9px;cursor:pointer;font-family:inherit;font-size:11px;font-weight:700;color:#9ab0e0;background:none;border:none;padding:0;">\u24d8 More detail</button><div class="mcDetail" style="display:none;margin-top:8px;font-size:12.5px;color:#aeb9d4;line-height:1.55;">' + card.d + '</div>' : '') + '</div>'
        : '<div style="margin-top:14px;height:1px;"></div>') +
      '<div class="acts" style="margin-top:16px;"></div>' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px;">' + dots + '</div>';
    list.appendChild(host);
    { const mb = host.querySelector("[data-mc-more]"); if (mb) mb.addEventListener("click", () => { const dd = host.querySelector(".mcDetail"); if (dd) { const open = dd.style.display !== "none"; dd.style.display = open ? "none" : "block"; mb.textContent = open ? "\u24d8 More detail" : "Hide detail"; } }); }

    // MC stage: fresh cards answer as seeded multiple-choice, graduating to recall at stage 2
    this._mc = null;
    if (!this.revealed && this.flashcards && this.mcActive(info.key, card) && !this.mcPoolWarm(info.key, card)) {
      // The distractor pool is not resident yet (manifest boot). Fetch it and re-render this
      // same card, rather than dealing options from whatever happens to have arrived — that
      // would make the option set a function of network timing. Falling back to classic reveal
      // instead is not an option either: it would hand the answer to a card meant to be tested.
      const want = { key: info.key, q: card.q, idx: this.deckIdx };
      this._warmMcPool(card, info.key, null).then(() => {
        const e = this.drillEntries && this.drillEntries[this.activeDrill];
        if (e && e.info.key === want.key && this.deckIdx === want.idx && !this.revealed) this.renderDrill();
      });
    } else if (!this.revealed && this.flashcards && this.mcActive(info.key, card)) {
      const onDone = this._checkpoint
        ? (ok) => this._checkpointAnswer(ok)
        : () => {
            const f2 = this.drillFootRef.current;
            if (f2) {
              f2.style.display = "flex"; f2.innerHTML = "";
              const cont = this.drillBtn("Continue", true);
              cont.addEventListener("click", () => { this.deckIdx++; this.revealed = false; this.renderDrill(); });
              f2.appendChild(cont);
            }
          };
      const mcWrap = this._mcBlock(card, info.key, onDone);
      if (mcWrap) {
        const acts = host.querySelector(".acts");
        if (acts) acts.appendChild(mcWrap);
        return; // MC owns this card — no reveal footer
      }
    }

    // controls live in the pinned footer so they're always in the same place (and mobile-friendly)
    const foot = this.drillFootRef.current; if (foot) {
      foot.style.display = "flex"; foot.innerHTML = "";
      const acts = document.createElement("div"); acts.style.cssText = "display:flex;gap:8px;";
      if (!this.revealed) {
        const show = this.drillBtn("Reveal answer", true);
        show.setAttribute("data-reveal", "1");
        show.addEventListener("click", () => { this.revealed = true; this.renderDrill(); });
        acts.appendChild(show);
      } else {
        const again = this.drillBtn("Review again", false);
        const got = this.drillBtn("Got it", true);
        again.addEventListener("click", () => this.recallGrade(false));
        got.addEventListener("click", () => this.recallGrade(true));
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
    // the pane anchors LEFT (v1.94.0), so the cards yield leftward padding, not rightward
    if (op) op.style.paddingLeft = (24 + this.uiShift * this.sbOffset()).toFixed(1) + "px";
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
      if (more) this._dockOptionHint(hint, op);
    }
    // the pane moved LEFT (v1.94.0): on desktop it no longer shares a corner with the
    // bottom-right chip, so the chip stays put and stays clickable while the pane is open.
    // On a PHONE the fade stays: the 88vw drawer owns the screen and the exposed right strip
    // is the tap-to-dismiss surface — a live chip there would eat the dismiss tap (its
    // pointerdown stops propagation) and float over the drawer's edge.
    const ac = this.accountRef.current;
    if (ac) { const cover = this.isMobile() ? this.uiShift : 0; ac.style.opacity = (1 - cover).toFixed(3); ac.style.pointerEvents = cover > 0.5 ? "none" : "auto"; ac.style.transform = "none"; }
  }
  clearOptions() { const el = this.optionsRef.current; if (el) { el.innerHTML = ""; el.style.pointerEvents = "none"; el.style.opacity = "1"; el.style.transform = "none"; el.style.overflowX = "auto"; el.style.overflowY = "hidden"; el.style.webkitMaskImage = ""; el.style.maskImage = ""; el.style.justifyContent = "safe center"; el.style.paddingLeft = ""; el.style.paddingRight = ""; el.scrollLeft = 0; } this._detailCtx = null; this.hideOptDetail(); this.clearLandCard(); this.optionIdxs = []; this._optionCards = []; this._optHintAt = 0; this.setBeacon(null); }
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

  /**
   * `nodeIdx` (v1.106.5) names the node the round ENDED on — the submission you finished with, or
   * the one you were caught in. A finish never produces a landing (the roll log's last row is the
   * position you attacked FROM), so without it the film of a won roll would simply stop one beat
   * short of the finish, which is the beat the whole roll was for. Display-only, in memory, and
   * carried onto the archived roll record beside `outcome`.
   */
  endRound(kind, name, nodeIdx) {
    this.clearTimers(); this.clearOptions();
    this._lastFinish = (name || nodeIdx != null)
      ? { name: name || null, idx: (nodeIdx != null && this.nodes[nodeIdx]) ? nodeIdx : null }
      : null;
    // ── belt test verdict FIRST (belt_test_won/lost must precede the generic beats; the
    // generic win/lose paths still run after — the ladder rides along, dual-track) ──
    if (this._beltTest) {
      const bt = this._beltTest; this._beltTest = null;
      const dominance = Math.round(this.myVal(this.nodes[this.currentPos]) * 100) / 100;
      const wonByPoints = kind !== "win" && dominance >= bt.pointsWin;
      if (kind === "win" || wonByPoints) {
        this.belts.won = this.belts.won || {};
        this.belts.won[bt.beltId] = { t: Date.now(), moves: this.moveCount || 0, byPoints: wonByPoints };
        this.fx("belt_test_won", { belt: bt.beltId, moves: this.moveCount || 0, byPoints: wonByPoints, dominance: dominance });
        this._flushSave();
        if (kind !== "win") { kind = "win"; name = name || "Won on points"; } // points wins celebrate like wins
      } else {
        this.belts.attempts = this.belts.attempts || {};
        this.belts.attempts[bt.beltId] = (this.belts.attempts[bt.beltId] || 0) + 1;
        this.fx("belt_test_lost", { belt: bt.beltId, moves: this.moveCount || 0, dominance: dominance, attempts: this.belts.attempts[bt.beltId] });
        this._flushSave();
        if (kind === "reset") kind = "lose"; // the test ended in defeat, not a scramble
        name = name || "Not yet \u2014 retry from Challenges";
      }
    }
    if (kind === "win") {
      // victory cascade: flares hop the roll trail 110ms apart, hard-capped at 1.5s total
      const rows = (this.rollLog || []).slice(-13);
      const hops = Math.max(1, rows.length);
      for (let ci = 0; ci < rows.length; ci++) { const cidx = rows[ci].idx; this.after(ci * 0.11, () => this.flare(cidx)); }
      this.fx("victory_cascade", { hops: hops, durMs: hops * 110 });
      this.ladderMove(1);
    } else if (kind === "lose") {
      this.fx("defeat_drain", {});
      this.ladderMove(-1);
    }
    if (kind === "win") this.fx("finish", { technique: name || null });
    this.fx("roll_end", { outcome: kind, moves: this.moveCount || 0 });
    this.track("neural_roll_ended", { outcome: kind, moves: this.moveCount || 0 });
    if (kind !== "reset" && this.anim("slowMoFinish", true)) this._slowmo = this.now;
    this._lastOutcome = kind;
    // PANE LAW: a round ending does NOT hide the pane (deckReady stays a data-readiness flag).
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
    // the EDGE table for THIS state and THIS side, resolved once. Stamped onto each opt below so
    // every later reader (the card, the sheet, the odds refresh) values the move against the state
    // it was dealt from, not against wherever the roll has since moved to.
    const evOf = this._evRowsFor(posIdx, this.playerRole);
    for (const k of this.adj[posIdx]) {
      const n = this.nodes[k];
      if (n.ty === "positions") continue;
      if (seen.has(n.t)) continue; seen.add(n.t);
      // ONLY MOVES YOUR ROLE PERFORMS — READ, NOT INFERRED (v1.103.0). This used to be
      // `myVal(n) < oppVal(n) - 0.05`: "the beneficiary is the performer". That is a heuristic over
      // a strength score, and the data states the performer outright — every technique node carries
      // `fromRole` from its authored `from_position`. The heuristic mis-indexed the pair (see
      // valIdx) AND could invert on its own whenever a position's score disagreed with the side
      // that actually holds it, which is how a bottom player ended up with no submissions at all.
      // The authored role cannot invert; if it is WRONG that is a content bug, and
      // validate_graph_integrity's `from_position_role_mismatch` names all 65 of them.
      if (n.fromRole && n.fromRole !== this.playerRole) continue;
      // contextual: exact canonical origin match (data now provides fromPositionId)
      if (n.fromPositionId && hereId && n.fromPositionId !== hereId) continue;
      const res = this.resultPos(k, posIdx);
      out.push({ idx: k, node: n, res, ev: evOf ? evOf(k) : null });
    }
    // safety: if role-filtering left nothing, fall back to the best-for-me handful
    if (!out.length) {
      for (const k of this.adj[posIdx]) {
        const n = this.nodes[k]; if (n.ty === "positions") continue; if (seen.has(n.t + "_fb")) continue; seen.add(n.t + "_fb");
        // the fallback relaxes ORIGIN, never ROLE: dealing the opponent's moves is not a
        // safety net, it is the bug this filter exists to prevent
        if (n.fromRole && n.fromRole !== this.playerRole) continue;
        out.push({ idx: k, node: n, res: this.resultPos(k, posIdx), ev: evOf ? evOf(k) : null });
      }
      out.sort((a, b) => this.myVal(b.node) - this.myVal(a.node));
      return out.slice(0, 6);
    }
    // FREEZE (v1.118.0). Both ranking inputs are read HERE, once, and never again: `moveChance`
    // moves with drilling and momentum, and re-reading it in a comparator would let a mid-decision
    // JIT grade re-sort the tray the player is already reaching into. See _cmpDealt.
    for (const o of out) { o.ord = this.orderScore(o); o.ordOdds = this.moveChance(o.node); }
    out.sort((a, b) => this._cmpDealt(a, b));
    // EVERY legal move is dealt (v1.123.0). What used to be cut is now simply further down a
    // scrollable tray — the overflow is FOLDED, not removed. See NG_DECISION_KNEE for the clock
    // and NG_PREFETCH_CAP for the only thing that still counts to ten.
    return out;
  }
  // ── `_capHand` IS DELETED, AND SO IS THE QUESTION IT LEFT OPEN (v1.123.0) ──────────────────
  // v1.119.0 found that ranking by EDGE and taking the first ten is category-blind, and that at
  // exactly one role-hand — side-control/top, 16 submissions and 9 transitions, the ten best by
  // EDGE all submissions — it erased every positional move, including `Side Control to Mount`
  // (23% attempt, the largest authored anywhere from that state). Its answer was a floor: admit
  // the best-EDGE card of any category the ten leave empty.
  //
  // That floor was a REPAIR TO THE CAP, and the cap is gone, so it repairs nothing: side-control/
  // top now deals all 25 of its cards and the 9 transitions are simply there. It is deleted
  // rather than kept, and with it goes the open question v1.119.0 recorded for the owner —
  // whether the admitted card should be the category's best by EDGE or its most-ATTEMPTED
  // (`Side Control to Scarf Hold Position` +3 vs `Side Control to Mount` −2 on 23%). Both moves
  // are dealt now, so there is nothing left to choose between and nothing to answer.
  //
  // NB the `!out.length` fallback in optionsFor keeps its own `.slice(0, 6)`. That is NOT this
  // cap: measured, 0 of 272 live hands reach it, so it protects no real hand — leaving it alone
  // means this change cannot alter a path nobody can observe.
  resultPos(actIdx, fromIdx) {
    let best = -1;
    for (const k of this.adj[actIdx]) { if (this.nodes[k].ty === "positions" && k !== fromIdx) { best = k; break; } }
    if (best < 0) for (const k of this.adj[actIdx]) { if (this.nodes[k].ty === "positions") { best = k; break; } }
    return best;
  }

  // the glyph is split span/svg so the EDGE repaint can rewrite the shape's colour in place
  // without disturbing the card's flex row (see _paintEdge)
  catGlyph(n, num, col) {
    return '<span class="ngglyph" style="flex:none;width:20px;height:20px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 0 4px ' + col + '70);">' + this.catGlyphSvg(n, num, col) + '</span>';
  }
  catGlyphSvg(n, num, col) {
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
    return '<svg width="20" height="20" viewBox="0 0 20 20">' + shape + txt + '</svg>';
  }
  buildOptionCard(opt, onPick, decisionSec, num, mode) {
    const n = opt.node;
    const isEsc = mode === "escape";
    const card = document.createElement("div");
    card.setAttribute("data-tech", n.t); // journey tests click option cards by technique title
    card.style.cssText = "pointer-events:auto;cursor:pointer;position:relative;overflow:hidden;flex:0 0 150px;width:150px;background:rgba(28,32,52,.78);backdrop-filter:blur(6px);border:1px solid rgba(150,170,210,.18);border-radius:11px;padding:11px 12px 13px;opacity:1;transform:translateY(10px);transition:transform .34s cubic-bezier(.2,.7,.2,1),border-color .15s,background .15s;";
    // DERIVED, NOT COINCIDENTAL (v1.104.3). `n.col` is `domColor(n.s[0])` frozen at INGEST, and
    // `s[0]` is ATTACKER for a technique — a role-BLIND read of a role-typed pair. On THIS
    // surface it happens to be right, and the audit says so: 0 of 1203 cards across all 136
    // positions x both roles differ from the role-correct value, because `optionsFor` only ever
    // deals moves YOU perform (the fromRole filter, v1.103.0), so you are always the attacker of
    // your own hand. `myColor` states that instead of relying on it.
    //
    // NB the owner's question this came from — "+13 in blue but the icon seems gray reddish" —
    // is NOT a colour bug. The two marks measure different things: the GLYPH is the technique's
    // own strength (is this a strong move?) and the +13 is `movePotential`, the value of where it
    // LANDS you. `Open Guard to Double Unders` scores -0.113 for its attacker yet arrives
    // somewhere good, which is a real and common shape: a mediocre technique into a strong
    // position. They share one palette and say so nowhere — that is a LABELLING gap, not a maths
    // one, and it is the owner's call whether to close it.
    //
    // \u2500\u2500 AND IT IS CLOSED, BY DELETION (v1.118.0) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // Both marks are now the SAME quantity \u2014 EDGE \u2014 so they cannot disagree, and the technique's
    // own strength leaves the card FACE entirely (it stays in the sheet's content). Three marks,
    // two channels: SHAPE = category, COLOUR (glyph + clock bar + corner number) = EDGE,
    // bottom-right = odds. Odds are an INPUT to EDGE, one inside the other, so those two cannot
    // contradict either. An ESCAPE card is deliberately UNCHANGED: its options are POSITIONS, not
    // moves this state authors, so the EDGE table cannot value them and a fabricated number is
    // forbidden \u2014 it keeps its category word, its own-strength glyph and its landing-position
    // potential, which there is not a second quantity but the same one twice.
    const edge = isEsc ? null : this.edgeMark(opt);
    const col = edge ? edge.col : this.hex(this.myColor(n));
    const resName = opt.res >= 0 ? this.nodes[opt.res].t : "\u2014";
    const pct = Math.round((isEsc ? this.escapeChance(opt) : this.moveChance(n)) * 100);
    const oddsCol = pct >= 60 ? "#7ee0a8" : pct >= 38 ? "#cbd24e" : "#e8956b";
    const pot = Math.round(this.movePotential(opt) * 100);
    // the 44px capture target (below) needs the width the "SUCCESS RATE" caption was using: on a
    // 150px card at 390px there is no slack, and a coloured percentage is legible without a caption
    const rateCaption = this.isMobile() ? "Odds" : "Success rate";
    const bottomRow = '<div class="ngbotrow" style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(150,170,210,.1);display:flex;align-items:center;justify-content:space-between;gap:6px;">' +
      '<div style="font-size:8px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8094b4;">' + rateCaption + '</div>' +
      '<span class="ngodds" style="font-size:15px;font-weight:700;color:' + oddsCol + ';">' + pct + '%</span>' +
      '</div>';
    // THE MIDDLE SLOT NAMES THE NUMBER OPPOSITE IT. The category word there was redundant with the
    // glyph SHAPE beside it (v1.103.6 canon: circle=position, triangle=submission, diamond=
    // transition), and an unlabelled signed integer is exactly what makes a legitimate ranking
    // read as a bug: in 98 of 272 hands the best-EDGE card is NOT the best-odds card, and in 17 of
    // them the odds gap exceeds 15pp. `SUBMISSION` (10 chars) → `EDGE` (4) costs no height and no
    // new row. A card with no wire value keeps the category word, because there is no number for a
    // caption to name.
    const headMid = edge ? "Edge" : (n.ty === "positions" ? "Position" : n.ty === "submissions" ? "Submission" : "Transition");
    const headVal = edge
      ? '<span class="ngedge" style="flex:none;font-size:13px;font-weight:700;color:' + edge.col + ';">' + edge.txt + '</span>'
      : (isEsc ? '<span style="flex:none;font-size:13px;font-weight:700;color:' + this.potColor(pot) + ';">' + (pot > 0 ? "+" : "") + pot + '</span>' : '');
    card.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">' +
        this.catGlyph(n, num, col) +
        '<span style="font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#8094b4;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + headMid + '</span>' +
        headVal +
      '</div>' +
      // ── THE CARD IS A CHOICE, NOT A DOSSIER (v1.101.1) ──────────────────────────────────
      // The `from <origin>` line and the `→ <destination>` line came off at the owner's call
      // ("it can be removed to make for smaller option cards"). Both were restating what the
      // hand already tells you: every option in a hand shares the state you are standing in, so
      // `from X` is the same word on all of them, and where a move LEADS is what the sheet is
      // for — this card's job is name, category, potential and odds, at a glance, on a clock.
      // An ESCAPE hand keeps its one word, because "escape route" is not a restatement.
      '<div style="font-size:13.5px;font-weight:600;color:#eef1f6;line-height:1.22;">' + this.displayName(n) + '</div>' +
      (isEsc ? '<div style="font-size:11px;color:#93a0bd;line-height:1.3;margin-top:3px;">escape route</div>' : '') +
      bottomRow +
      '<div class="ngbar" style="position:absolute;left:0;bottom:0;height:3px;width:100%;background:' + col + ';transform-origin:left;transform:scaleX(1);"></div>';
    // ── CAPTURE THE TECHNIQUE, NOT THE POSITION ──────────────────────────────────────────────
    // "These are the techniques we learned in today's class" means TRANSITIONS AND SUBMISSIONS.
    // The landing card's + adds the position you happen to be standing in — legitimate ("we
    // worked from half guard"), but not what the feature is for. The hand IS the techniques, so
    // the hand is where a coach captures one: one tap, no commit, the roll carries on.
    // ...AND IT IS NOT ON THE CARD ANY MORE (v1.101.1). Owner: "the + on those small options
    // cards can also be removed. the + should only show top right next to the x close icon when
    // the card is open". A 150px card on a running clock is a CHOICE; capture belongs on the
    // surface you opened to read, where you already stopped. The option-detail sheet
    // (`expandOption`) and the landing card both carry it, so nothing is lost — only the
    // per-card clutter, which is 8 copies of the same control across one hand.
    card.addEventListener("mouseenter", () => { card.style.borderColor = "rgba(150,180,255,.55)"; card.style.background = "rgba(40,48,76,.9)"; card.style.transform = "translateY(-2px)"; });
    card.addEventListener("mouseleave", () => { card.style.borderColor = "rgba(150,170,210,.18)"; card.style.background = "rgba(28,32,52,.78)"; card.style.transform = "translateY(0)"; });
    card.addEventListener("click", () => { if (isEsc) onPick(opt); else this.expandOption(opt, onPick, card); });
    // ONE CLOCK (v1.114.1). This bar used to be a CSS animation (`ngCount <dsec>s`) on the WALL
    // clock, while the decision it depicts runs on `gdt` in `_tickDecision`. `setPaused` kept the
    // two in step for pauses — but nothing kept them in step for a REFUND: answering the landing
    // question correctly calls `refundDecision(2500)`, up to twice, adding 5s to a 16.2s window
    // that the animation could not know about. The bar then under-reported by up to 31% and the
    // hand looked about to expire when it was not. `_tickDecision` now writes the width, so the
    // bar cannot disagree with the number it draws — including growing BACK when you buy time,
    // which is the honest feedback for having bought it.
    const bar = card.querySelector(".ngbar");
    // `opt`/`num`/`esc` ride along so the EDGE channel can be repainted in place when the odds
    // move (refreshOptionOdds). They are the DEAL-TIME opt, so a repaint values the move against
    // the state it was dealt from — and it repaints, it never re-sorts.
    (this._optionCards = this._optionCards || []).push({ node: n, card: card, bar: bar, opt: opt, num: num, esc: isEsc });
    const di = 20 + (num && num > 0 ? num - 1 : 0) * 45;
    setTimeout(() => { card.style.transform = "none"; }, di);
    return card;
  }
  // repaint ONE dealt card's EDGE channel in place — corner number, glyph and clock bar, all three
  // from the same `edgeMark`, so they cannot drift apart between a deal and a refresh.
  _paintEdge(oc) {
    if (!oc || oc.esc) return;
    const e = this.edgeMark(oc.opt); if (!e) return;
    const num = oc.card.querySelector(".ngedge");
    if (num) { num.textContent = e.txt; num.style.color = e.col; }
    const g = oc.card.querySelector(".ngglyph");
    if (g) { g.style.filter = "drop-shadow(0 0 4px " + e.col + "70)"; g.innerHTML = this.catGlyphSvg(oc.node, oc.num, e.col); }
    if (oc.bar) oc.bar.style.background = e.col;
  }
  // THE NUMBERS MOVE, THE CARDS DO NOT (v1.118.0). Drilling a JIT deck mid-decision raises this
  // move's odds, and EDGE is a function of those odds, so the corner number and its colour MUST
  // follow — that visible payoff is the reason to drill at all. What must never follow is the
  // ORDER: re-sorting the tray under a player already reaching for a card is the one thing a
  // ranking must not do. The hand's order is frozen in optionsFor (see _cmpDealt) and nothing
  // here touches the DOM's child order.
  refreshOptionOdds() {
    if (this._defendSub != null) { this.refreshEscapeOdds(); return; } // defense window: the tray holds ESCAPE cards
    for (const oc of (this._optionCards || [])) {
      const el = oc.card.querySelector(".ngodds"); if (!el) continue;
      const pct = Math.round(this.moveChance(oc.node) * 100);
      el.textContent = pct + "%";
      el.style.color = pct >= 60 ? "#7ee0a8" : pct >= 38 ? "#cbd24e" : "#e8956b";
      this._paintEdge(oc);
    }
  }

  // ═══ P1b: QUESTION-FIRST LANDING ═══
  // The flashcard stopped being a place you go. It is what the game asks the moment you arrive:
  // what this state is, where you came from, which side you're playing, one film clip, and ONE
  // question — then your options. A right answer pays through the ordinary credit path (mastery
  // + sharpness already move the odds; no second bonus stacked on top) and buys clock. A wrong
  // answer costs THIS exchange's odds and is forgotten on the next arrival. Everything else the
  // page knows — decision trees, principles, mistakes — stays behind "More".

  // the one card this state still owes you: its first unproven (stage < 2) card. A proven deck
  // asks nothing, and the card degrades to identity + film.
  questionFor(key) {
    const cards = this._cardsOf(((this.flashcards && this.flashcards.decks) || {})[key]);
    if (!cards || !cards.length) return null;
    // DUE FIRST (v1.105.0, owner: "when you're in a particular state, it should prioritize due
    // cards before new cards"). A due card is asked at ANY stage — maintenance before learning.
    for (const c of cards) if (this._cardDue(key, c.q)) return c;
    for (const c of cards) if (this.cardStage(key, c.q) < 2) return c;
    return null;
  }
  // ═══════════════ THE NODE DOSSIER'S QUESTION (v1.100.0) ═══════════════
  //
  // The dossier is a state you WALKED INTO — on desktop by flying the camera into the node
  // itself, on a phone by the sheet. So it asks. Three rules make it a study surface rather than
  // a second landing card:
  //
  //  · IT KEEPS ASKING TO THE RECALL GATE. questionFor() stops at stage 2 because the landing
  //    question is the in-play format and MC caps there. Here the ladder is the point: a card met
  //    by recognition comes back as recall, which is the only route past 0.667 mastery.
  //  · ITS ECONOMY IS STUDY-ONLY. See _renderNodeQuestion.
  //  · IT IS NOT GATED BY `landQuestions`. That setting is "Questions while you roll" — it gates
  //    the question that interrupts a TIMED decision. Opening a dossier stops the clock
  //    (openDossier -> setPaused + _dossierAutoPaused); there is no decision to interrupt, and
  //    silencing the surface a reader deliberately opened would delete a feature nobody
  //    turned off.
  //
  // `skip` holds the qhashes already asked in THIS visit, so "Next card" advances instead of
  // re-serving the card whose stage just moved from 0 to 1 (still under the gate, still first).
  nodeQuestionFor(key, skip) {
    const cards = this._cardsOf(((this.flashcards && this.flashcards.decks) || {})[key]);
    if (!cards || !cards.length) return null;
    for (const c of cards) {
      if (skip && skip.has(this.qhash(c.q))) continue;
      if (this._cardDue(key, c.q)) return c;               // due first (v1.105.0)
    }
    for (const c of cards) {
      if (skip && skip.has(this.qhash(c.q))) continue;
      if (this.cardStage(key, c.q) < 3) return c;
    }
    return null;
  }
  /**
   * Recognition below the gate, recall at or above it.
   *
   * This is mcActive()'s `auto` branch stated explicitly, because the node card is deliberately
   * NOT governed by `mcMode`: that setting chooses how the SIDEBAR reads a card back (default
   * classic), and honouring it here would mean a default-settings user never meets a multiple
   * choice on the one surface built to teach the ladder. The checkpoint quiz is MC always for
   * the same kind of reason.
   */
  askFormat(key, card) { return this.cardStage(key, card.q) < 2 ? "mc" : "recall"; }
  /** The live [data-node-q] host. The in-node card is retired (v1.101.0); this is the sheet. */
  _nodeQHost() {
    const card = this.nodeCardRef && this.nodeCardRef.current;
    if (card && card.style.display !== "none") { const h = card.querySelector("[data-node-q]"); if (h) return h; }
    const sh = this.dossierSheetRef && this.dossierSheetRef.current;
    return sh && sh.style.display === "block" ? sh.querySelector("[data-node-q]") : null;
  }
  /** A payload this question needs is in flight — dock the question when it lands, once. */
  _nodeWarm(n, fn) {
    const idx = n.idx;
    const p = Promise.resolve()
      .then(fn)
      .then(() => {
        if (!this._nodeQ || this._nodeQ.idx !== idx || this._nodeQ.answered) return;
        const host = this._nodeQHost();
        if (host) this._renderNodeQuestion(this.nodes[idx], host);
      })
      .catch(() => {});
    this._nodeWarmP = p;
    p.then(() => { if (this._nodeWarmP === p) this._nodeWarmP = null; });
  }
  /** Is the node card's question settled — mounted, or definitively not coming? */
  nodeQuestionReady() { return !this._nodeWarmP; }
  /** Resolves once it is. Chases the chain (deck chunk → distractor pool → render). */
  async nodeSettled() {
    for (let i = 0; i < 8; i++) {
      const p = this._nodeWarmP;
      if (!p) return;
      await p.catch(() => {});
      if (this._nodeWarmP === p) return;
    }
  }
  /** Forget this visit's question — a different node, or the card going away. */
  _clearNodeQ() {
    this._nodeQ = null; this._nodeAsked = null; this._nodeWarmP = null;
    // `this._mc` is what A-D grades against, and the newest block owns it. A dossier visit is
    // short and the LANDING question outlives it, so hand the keys back to the block still on
    // screen instead of leaving them pointed at one that no longer exists (nulling outright made
    // A-D dead for the rest of the exchange).
    if (this._mc && this._mc.surface === "node") {
      const opt = this._landEl ? this._landEl.querySelector("[data-land-mc-opt]") : null;
      const back = opt && opt.parentNode ? opt.parentNode.__ngMc : null;
      this._mc = back && !(this._landQ && this._landQ.answered) ? back : null;
    }
  }
  /**
   * Fill the dossier's question section.
   *
   * ECONOMY — deliberately NARROWER than the landing card's. Answering here mints the ORDINARY
   * card credit and nothing else: stage (_bumpStage, MC capped at the recall gate), prep,
   * sharpness, cross-deck credit and the daily counter, all via the shared _mcAnswer/gradeRecall
   * paths. It does NOT call refundDecision (there is no clock — the dossier paused it),
   * _comboUp (momentum is a roll mechanic, and a paused screen would farm it) or touch _qMod
   * (that penalty prices an exchange that is not being taken). Those three are the landing
   * question's own onDone (_landAnswered); this surface simply does not wire them.
   *
   * A SCORED QUESTION IS FROZEN. Re-mounting one would reshuffle it under the reader and hand out
   * a second attempt at credit already given — so an answered card is restated read-only if the
   * card around it is ever rebuilt, and never re-blocked.
   */
  _renderNodeQuestion(n, host) {
    if (!host) return;
    const key = this.deckKeyFor(n).key;
    const qHead = (txt) => '<div data-node-qtext="1" style="font-size:1em;font-weight:600;color:#dbe2f0;line-height:1.35;margin-bottom:.6em;">' + txt + '</div>';
    // A QUESTION ALREADY ON THE TABLE IS RE-PARENTED, NEVER REBUILT — the landing card's `reuse`
    // rule, and for the same two reasons. Every render draws a fresh shuffle, so rebuilding moves
    // the correct answer under the reader's cursor mid-read; and rebuilding a SCORED block hands
    // out a second attempt at credit already given. The same element, the same closure, moved.
    const prior = this._nodeQ;
    if (prior && prior.idx === n.idx && prior.card && prior.el) {
      if (host.contains(prior.el)) return;                    // still on screen — leave it alone
      host.innerHTML = qHead(prior.card.q);
      host.appendChild(prior.el);
      if (prior.el.__ngMc && !prior.answered) this._mc = prior.el.__ngMc;   // A-D still grades it
      return;
    }
    const say = (reason, txt) => {
      host.innerHTML = '<div data-node-q-empty="' + reason + '" style="font-size:.95em;line-height:1.45;color:#8b97b0;">' + txt + '</div>';
      this._nodeQ = { idx: n.idx, key: key, card: null, answered: false, format: null, reason: reason, el: null };
      this.fx("node_q_skipped", { deckKey: key, reason: reason, node: n.t });
    };
    const wait = (txt) => {
      host.innerHTML = '<div data-node-q-empty="loading" style="font-size:.95em;line-height:1.45;color:#8b97b0;">' + txt + '</div>';
      this._nodeQ = { idx: n.idx, key: key, card: null, answered: false, format: null, reason: "loading", el: null };
    };
    const status = this.deckStatus(key);
    // NAME THE GAP. A dossier that asks nothing is legitimate; a dossier that shows an empty
    // section is a bug the reader has to guess at.
    if (status === "missing" || status === "empty") return say("no_cards_authored", "No flashcards are written for this state yet.");
    if (status === "failed") return say("deck_unavailable", "These cards could not be loaded — close and reopen to try again.");
    if (status === "pending" || status === "loading") { wait("Loading this state’s cards…"); this._nodeWarm(n, () => this.hydrateDeck(key)); return; }
    const card = this.nodeQuestionFor(key, this._nodeAsked);
    if (!card) return say(this._nodeAsked && this._nodeAsked.size ? "visit_complete" : "deck_proven",
      this._nodeAsked && this._nodeAsked.size ? "That’s every card this state still owed you." : "Every card here is recall-proven.");
    const format = this.askFormat(key, card);
    // MC RESIDENCY (v1.80.4 rule): the distractor pool must be resident before we draw, or which
    // neighbour chunks happened to arrive would decide the options — and therefore the RNG stream.
    if (format === "mc" && !this.mcPoolWarm(key, card)) { wait("Loading this state’s cards…"); this._nodeWarm(n, () => this._warmMcPool(card, key, "node")); return; }
    host.innerHTML = qHead(card.q);
    const done = (correct, tier) => {
      const q = this._nodeQ;
      if (q) q.answered = true;
      (this._nodeAsked = this._nodeAsked || new Set()).add(this.qhash(card.q));
      this.fx("node_q_answered", { deckKey: key, node: n.t, format: fmt, correct: !!correct, tier: tier || null });
      this._refreshNodeCount();
      // one deliberate step onward — the counter just moved, and a dead card is a dead surface
      if (this.nodeQuestionFor(key, this._nodeAsked)) {
        const nx = document.createElement("button");
        nx.type = "button";
        nx.setAttribute("data-node-next", "1");
        nx.style.cssText = "align-self:center;margin-top:.7em;cursor:pointer;font-family:inherit;font-size:.9em;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:.6em 1.2em;min-height:2.8em;border-radius:.66em;border:1px solid rgba(150,170,210,.26);background:rgba(255,255,255,.04);color:#9ab0e0;";
        nx.textContent = "Next card ▸";
        nx.addEventListener("click", () => { this._nodeQ = null; this._renderNodeQuestion(n, host); });
        host.appendChild(nx);
      }
    };
    // FALL BACK TO RECALL, DO NOT FALL SILENT. mcDistractors returns null when fewer than two
    // usable distractors survive its length/similarity filters — routine for a long or unusual
    // answer, and measured here on a submission node. The landing card can only skip in that case
    // (multiple choice IS the in-play format), but recall is this surface's other native format
    // and works for any card at all, so a state that cannot be recognised is still studied.
    let fmt = format;
    let block = fmt === "mc" ? this._mcBlock(card, key, done, "node") : null;
    if (!block) { fmt = "recall"; block = this._recallBlock(card, key, done, "node"); }
    if (!block) return say("no_question", "This card cannot be asked here yet.");
    this._styleNodeBlock(block);
    host.appendChild(block);
    this._nodeQ = { idx: n.idx, key: key, card: card, answered: false, format: fmt, reason: null, el: block };
    this.fx("node_q_shown", { deckKey: key, node: n.t, format: fmt, asked: format, stage: this.cardStage(key, card.q) });
  }
  /**
   * _mcBlock styles its options in fixed px (it was written for the pane, which has one text
   * size). The node card is em-driven — ONE root font-size scales every dimension with the shape
   * — so a 12px option inside a triangle whose root em is 14.8px reads as fine print. Re-express
   * the block's own sizes in em; nothing about its behaviour is touched.
   */
  _styleNodeBlock(block) {
    block.style.gap = ".5em";
    block.querySelectorAll("button").forEach((b) => {
      b.style.fontSize = "1em";
      b.style.lineHeight = "1.4";
      if (b.hasAttribute("data-node-mc-opt")) { b.style.padding = ".6em .75em"; b.style.borderRadius = ".6em"; b.style.minHeight = "2.4em"; }
    });
  }
  /** Repaint the header's familiarity chip in place — the count is what an answer just moved. */
  _refreshNodeCount() {
    const host = this.nodeCardRef && this.nodeCardRef.current;
    const chip = host ? host.querySelector("[data-node-count]") : null;
    if (!chip || this._nodeCardIdx == null || !this.nodes[this._nodeCardIdx]) return;
    const key = this.deckKeyFor(this.nodes[this._nodeCardIdx]).key;
    const box = document.createElement("div");
    box.innerHTML = this.familiarityChip(key, "data-node-count", { fs: ".82em", gs: ".9em" }).html;
    const fresh = box.firstChild;
    if (fresh && chip.parentNode) chip.parentNode.replaceChild(fresh, chip);
  }
  // ○ new to you · ◐ met some · ● recall-proven — the "have you done this" marker
  seenGlyph(key) {
    const d = (this.flashcards && this.flashcards.decks) ? this.flashcards.decks[key] : null;
    const cards = this._cardsOf(d);
    const total = this._deckCardCount(d);
    // total comes from the manifest when the cards are still in flight, so an unhydrated deck
    // reports "new to you" (or the user's real progress) instead of the flatly wrong "no cards
    // authored yet" — the glyph told returning users their decks did not exist.
    if (!total) return ["○", "#7e8aa3", "no cards authored yet"];
    let proven = 0, met = 0;
    if (cards && cards.length) {
      for (const c of cards) { const s = this.cardStage(key, c.q); if (s >= 3) proven++; if (s >= 1) met++; }
    } else {
      const st = (this.stage && this.stage[key]) || {};
      for (const qh in st) { if (st[qh] >= 3) proven++; if (st[qh] >= 1) met++; }
      proven = Math.min(proven, total); met = Math.min(met, total);
    }
    if (proven >= total) return ["●", "#7ee0a8", "recall-proven"];
    if (met) return ["◐", "#cbd24e", met + " of " + total + " met"];
    return ["○", "#7e8aa3", "new to you"];
  }
  /**
   * THE FAMILIARITY CHIP — the seen-glyph fused with the deck's answered count ("● 3/8").
   *
   * ONE implementation for every surface that wears it: the landing card's identity header and
   * the in-node card's header plate. `attr` is the SURFACE'S OWN HANDLE — a shared selector would
   * silently match both when they are on screen together (the landing card is up behind the node
   * card whenever a reader opens one mid-roll), exactly the trap the MC option split exists for.
   * Glyph-only when nothing is authored yet; `total` reads the manifest `n` until the chunk lands,
   * so an unhydrated deck reports the user's real progress instead of "no cards".
   */
  familiarityChip(key, attr, opts) {
    const o = opts || {};
    const glyph = this.seenGlyph(key);
    const deckD = (this.flashcards && this.flashcards.decks) ? this.flashcards.decks[key] : null;
    const total = this._deckCardCount(deckD);
    const done = Math.min((this.prep && this.prep[key]) || 0, total);
    const full = total > 0 && done >= total;
    const title = glyph[2] + (total ? " · " + done + " of " + total + " cards recall-proven" : "");
    const html = '<span ' + attr + '="' + (total ? done + "/" + total : "") + '" title="' + title + '" style="flex:none;' + (o.style || "") + 'display:inline-flex;align-items:center;gap:5px;' + (total && o.clickable ? "cursor:pointer;" : "") + 'padding:3px 9px;border-radius:999px;border:1px solid rgba(150,170,210,.22);background:rgba(255,255,255,.04);font-size:' + (o.fs || "10.5px") + ';font-weight:700;font-family:\'Space Grotesk\',sans-serif;color:' + (full ? "#7ee0a8" : "#9ab0e0") + ';">' +
      '<span style="font-size:' + (o.gs || "11px") + ';line-height:1;color:' + glyph[1] + ';">' + glyph[0] + '</span>' +
      (total ? '<span>' + done + "/" + total + '</span>' : '') +
    '</span>';
    return { html: html, total: total, done: done, glyph: glyph, full: full };
  }
  ngContentFor(node) {
    return this._ngc(node.ty === "positions" ? this.deckKeyFor(node).key : node.t);
  }
  // ───────────────────── ON-DEMAND NODE DOSSIERS (v1.80.4) ─────────────────────
  // window.NG_CONTENT used to arrive as a 21.2MB <script> (5.5MB gzip) holding the dossier for
  // every node in the graph — the single heaviest thing the site shipped, for content that is
  // only ever read one node at a time. It is now one ~6KB chunk per node, fetched when a
  // surface asks, and window.NG_CONTENT stays as the in-memory cache so every existing reader
  // is unchanged. Chunks are addressed by fnv1a32(key) (the same hash as qhash) and hold a
  // {key: dossier} MAP, so a hash collision merely shares a file instead of losing a dossier.
  //
  // Every reader already tolerates null (the payload used to land after first paint, hence
  // onContentReady), so a miss is a graceful degradation and not a hole.
  _ngc(key) {
    if (!key) return null;
    const C = (window.NG_CONTENT && window.NG_CONTENT.decks) || {};
    if (Object.prototype.hasOwnProperty.call(C, key)) return C[key] || null;
    this._hydrateContent(key);
    return null;
  }
  _hydrateContent(key) {
    const waits = (this._contentWaits = this._contentWaits || {});
    if (waits[key]) return waits[key];
    const p = fetch(this._dataBase() + "content/" + this.qhash(key) + ".json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((j) => {
        const C = (window.NG_CONTENT = window.NG_CONTENT || {});
        C.decks = C.decks || {};
        if (j && typeof j === "object") for (const k in j) C.decks[k] = j[k];
        // negative cache: a node with no authored dossier must not refetch on every hover
        if (!Object.prototype.hasOwnProperty.call(C.decks, key)) C.decks[key] = null;
        this.onContentReady();
        return C.decks[key];
      });
    waits[key] = p;
    return p;
  }
  clearLandCard() {
    this._landQ = null; this._landIdx = null; this._landMode = null;    this._landWarmP = null;   // no card, nothing outstanding (see landSettled)
    // The truth for a destroyed surface must not linger: `this._mc` is what a keypress grades
    // against, so a stale land block's answer key would let `A`-`D` grade a question that is no
    // longer on screen. It also made "wait for the next landing question" unreliable — the old
    // one was still there to find, which since v1.80.4 (the question docks a fetch after the
    // card) is a window wide enough to matter.
    if (this._mc && this._mc.surface === "land") this._mc = null;
    if (this._landEl) { try { this._landEl.remove(); } catch (e) {} this._landEl = null; }
    // the film strip is a SIBLING now, so it does not go away with the card on its own
    if (this._landFilmEl) { this.clearClipLoops(); try { this._landFilmEl.remove(); } catch (e) {} this._landFilmEl = null; }
  }
  // ── LATE PAYLOAD BACKFILL ── the comprehension payloads are deferred on purpose (decks 4.3MB
  // gz, dossier content 5.3MB gz — first paint must not wait on them) and on a measured Fast-4G
  // cold load they land ~18s AFTER the first hand. Until this existed, the landing card that
  // greeted a first-time visitor stayed silent for its WHOLE turn: onFlashcardsReady refreshed
  // the drill panel, the odds and the tab, but never the card — so the question-first landing,
  // the app's central comprehension mechanic, simply did not happen for their first decision
  // (measured: tests/artifacts/coldstart/probe-late-payload.json). Fill the live card IN PLACE.
  // Every guard is load-bearing:
  //   _landEl + _landMode "land" — never touch a technique card in flight (it owns answer hooks)
  //   NOT ANSWERED — the one hard rule. Mastery is recall-proven and an MC answer is scored once,
  //              so re-mounting a question the player has already answered would hand out a second
  //              attempt at credit already banked. An UNANSWERED question, by contrast, may be
  //              completed in place: v1.82.1 froze on "a question has MOUNTED", which is a proxy,
  //              not the property — and it cost exactly the case that matters. The measured
  //              production ordering is decks @25.3s then dossier content @27.0s, 1.7s apart, so
  //              the proxy dropped the definition from the first card a visitor ever reads. The
  //              question itself is carried across VERBATIM (same card, same option order, same
  //              closure) rather than rebuilt, so nothing reshuffles under a player mid-read and
  //              no second answer can be scored.
  //   _landIdx === currentPos + a live _decision — the roll has not moved on; a card whose turn
  //              is over must never be rewritten under the next state.
  // Not a pane/roll-loop action: it re-renders one overlay in place, opens nothing, pauses nothing.
  /** The deferred skip verdict comes due (v1.106.6): a landing whose deck was still in flight
   *  armed `_landSkipDebt` instead of recording a skip that might un-happen. If the question
   *  never docked — the warm failed, or the landing is ending (a commit, the next arrival) —
   *  the skip is real and is recorded NOW, with the reason that was true all along. */
  _flushLandSkipDebt() {
    const d = this._landSkipDebt;
    if (!d) return;
    this._landSkipDebt = null;
    this._landQSkip(d.key, "decks_in_flight", d.mode);
  }
  _landBackfill() {
    if (!this._landEl) return;
    if (this._landQ && this._landQ.answered) return;   // scored once, never re-asked
    if (this._landMode !== "land" || this._landIdx !== this.currentPos) return;
    if (!this._decision || !this._optPick) return;
    const pos = this.nodes && this.nodes[this.currentPos];
    if (!pos) return;
    // carry a live, unanswered question across the re-render instead of drawing a new one
    // …including the KEYBOARD's truth (v1.106.10): clearLandCard nulls this._mc for the land
    // surface, and a re-parented block is never re-created — so without carrying it, a backfill
    // over a mounted question left A-D dead and truth() empty while the mouse (whose listeners
    // ride the surviving DOM nodes) kept working. The exact bug class j.clickByMouse exists for,
    // inverted.
    const reuse = this._landQ ? { q: this._landQ, el: this._landEl.querySelector("[data-land-q]"), pending: !!this._landPending, mc: (this._mc && this._mc.surface === "land") ? this._mc : null } : null;
    // keyboard users: if focus was on one of the card's own handles, put it back on the new one
    const act = document.activeElement;
    const held = act && this._landEl.contains(act)
      ? (act.hasAttribute("data-land-more") ? "[data-land-more]" : (act.hasAttribute("data-land-count") ? "[data-land-count]" : null))
      : null;
    // somebody is hiding the card inline (the expand sheet owns the screen while it is up, and
    // restores these two on close) — a fresh element must inherit that, or the card pops into
    // view over the sheet the player is reading
    const hidden = this._landEl.style.opacity === "0";
    this._landLate = true;                       // the beat says "this question arrived late"
    try { this.renderLandCard(pos, "land", null, reuse); } finally { this._landLate = false; }
    if (this._landEl && hidden) this._suppressLand(true);   // one seam, and it survives the entry animation
    if (held && this._landEl) { const t = this._landEl.querySelector(held); if (t && t.focus) try { t.focus(); } catch (e) {} }
  }
  // mode: "land" (a position — your options are dealt below) | "attempt" (a technique in flight —
  // the tension sweep is waiting on this answer). hooks: {onAnswer(correct), onSkip()}.
  // reuse: {q, el, pending} — an unanswered question block carried verbatim across a backfill
  // re-render (see _landBackfill). Absent on a normal landing.
  renderLandCard(node, mode, hooks, reuse) {
    const key0 = this.deckKeyFor(node).key;
    // NEVER re-shuffle a question the player is already looking at. Every render draws a fresh
    // shuffle, so a rebuild moves the correct answer under their cursor mid-read — and since
    // v1.80.4 re-renders are routine (the card paints immediately and the question docks once
    // the deck + its pool land; finishCoach hands the card over as well). Skip ONLY when the
    // mounted question is still the one this state would ask: if the deck has since been proven,
    // or a different card is now due, the card must genuinely re-render.
    // …but NEVER when the caller passes `reuse` (v1.106.6): a backfill re-render carries the
    // mounted question across verbatim BY CONSTRUCTION, and its whole point is to complete the
    // card AROUND it — the More affordance, film, definition — which this early return threw
    // away. With reuse in hand there is no reshuffle to prevent.
    if (!reuse && this._landQ && this._landEl && this._landQ.key === key0 && this._landQ.mode === (mode || "land")) {
      const want = this.get("landQuestions", true) ? this.questionFor(key0) : null;
      if (want && this._landQ.card && want.q === this._landQ.card.q) return this._landEl;
    }
    // A NEW landing starts folded; a re-render of the SAME one (a late payload backfilling film
    // or the question) keeps whatever the reader opened. Dropping the pause latch with it means
    // a stale `_landAutoPaused` can never resume a roll somebody else paused.
    if (this._landIdx !== node.idx) { this._landOpen = false; this._landAutoPaused = false; }
    if (this._landOpenNext) { this._landOpen = true; this._landOpenNext = false; } // opened to be read
    this.clearLandCard();
    // A cold visitor's FIRST landing carries its question like every other one. This used to
    // return null when the coach owned the first landing — which was every cold visitor, i.e. it
    // silently deleted the question from the one decision the comprehension mechanic exists for.
    const key = key0;
    // the setting gates the QUESTION, not the card: identity and film are priority either way
    const wantQ = this.get("landQuestions", true);
    let card = wantQ ? this.questionFor(key) : null;
    // ── deck residency (v1.80.4) ──────────────────────────────────────────────────────────
    // On a manifest boot this state's cards may not be here yet. The card renders NOW either
    // way (identity + film are the priority order, and the hand below it must not wait on a
    // fetch), and `warm` re-renders it once the question can be asked honestly:
    //   · cards absent            -> hydrate this deck
    //   · cards here, MC in play  -> warm the distractor pool first, so the options are not a
    //                                function of which neighbour chunks happened to arrive
    // THE IN-PLAY FORMAT (v1.105.1). MC by design, whatever mcMode says (that setting governs
    // the sidebar) — EXCEPT under the black-belt badge: `recallInPlay` (a reward toggle, locked
    // until the knowledge band reaches black) renders a stage-2+ card as the classic
    // reveal/self-grade block instead. Per-card, exactly as the owner specified: "after the
    // player gets the multiple choice right, the second time we show the card... Q and A, and we
    // hide the answer." A stage-0/1 card stays MC even with the badge on — recognition first.
    const landRecall = !!(card && this.get("recallInPlay", false) && this.cardStage(key, card.q) >= 2);
    let warm = null, warmKind = null;
    if (wantQ && !card && !this._deckResident(key)) { warm = () => this.hydrateDeck(key); warmKind = "deck"; }
    // the warm gate is FORMAT-AWARE: a recall block needs no distractor pool, and holding its
    // card hostage to one would delay the question behind a fetch it will never use.
    else if (card && !landRecall && !this.mcPoolWarm(key, card)) {
      const c0 = card;
      warm = () => this._warmMcPool(c0, key, "land");
      card = null;                                     // ask nothing until the pool is resident
      warmKind = "pool";                               // the card EXISTS — this is pending, not skipped
    }
    const info = this.ngContentFor(node);
    const sp = this.splitName(node.t);
    const glyph = this.seenGlyph(key);
    const log = this.rollLog || [];
    const prev = log[log.length - 2];
    const roleTxt = node.ty === "positions" ? this.roleLabel() : "Attacking";
    // ── ONE ROLE CLAIM, AND IT IS THE TRUE ONE ── the visual graph collapses a position to a
    // single hub node, and graph-data.json labels every one of those 136 hubs "… Top". The side
    // you actually play is decided independently (startRoll's coin flip, playFrom's explicit
    // choice), so pasting the raw title above the role line made HALF of all cold starts open a
    // card reading "X-Guard Top" over "Bottom" — above the bottom player's hand. The name line
    // carries the state's name; `roleTxt` is the only place a side is named.
    const nameTxt = node.ty === "positions" ? this.posFamily(node.t) : sp.main;

    const el = document.createElement("div");
    el.className = "ng-landcard";
    el.setAttribute("data-landcard", mode || "land");
    (this.__ngRoot || document.body).appendChild(el);
    this._landEl = el;
    this._landIdx = node.idx; this._landMode = mode || "land"; // what _landBackfill is allowed to refill

    // 1 — THE LANDING CARD HAS NO HEADER AT ALL (v1.101.1).
    // v1.101.0 cut the name and the side out of it, because the roll now settles at ROLL_ZOOM
    // and the graph draws both inside the node — leaving a thin "from <previous>" line with the
    // familiarity chip parked opposite it. The owner's read on that leftover: the chip "should
    // show bottom right same row as More instead of top right in its own row", and the block it
    // was in "shouldn't show". Both are right: one line and one chip do not earn a row above the
    // question, and the chip is a footer control (it opens this state's flashcards) sitting in a
    // header's slot. So a LANDING opens on its question, and the counter rides the foot beside
    // `More ▸` and the capture `+`, which are the card's other two controls.
    //
    // An ATTEMPT card keeps its headline: it names the technique the question is ABOUT, and the
    // graph only labels that one while the sweep is animating.
    const famChip = this.familiarityChip(key, "data-land-count", { clickable: true, style: "margin-left:auto;" });
    const totalCards = famChip.total;   // manifest `n` until the chunk lands
    const attemptMode = (mode || "land") === "attempt";
    if (attemptMode) {
      const head = document.createElement("div");
      head.setAttribute("data-land-id", "1");
      head.style.cssText = "display:flex;align-items:flex-start;gap:9px;";
      head.innerHTML =
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:14.5px;font-weight:700;color:#eef1f6;font-family:\'Space Grotesk\',sans-serif;line-height:1.2;">' + nameTxt + '</div>' +
          '<div style="font-size:10.5px;color:#8094b4;margin-top:3px;line-height:1.3;">' +
            '<b style="color:#9ab0e0;font-weight:700;">' + roleTxt + '</b>' +
            (sp.from ? ' &middot; ' + sp.from : '') +
          '</div>' +
        '</div>';
      el.appendChild(head);
    }

    // 2 — the one-phrase definition MOVED BEHIND `More` (v1.101.0). Owner, reading "Master Deep
    // Half Guard Top with defensive counters, pressure maintenance, and systematic passing
    // strategies" above their hand: "unnecessary — please remove those, or push the intro if SEO
    // needs it to the content after clicking More". It is marketing prose written for the static
    // page; the roll wants film and a question. It is not deleted, because the static article is
    // where the SEO value actually lives — it is one fold lower, in `_landMore`.

    // 3 — FILM RIDES ITS OWN STRIP, OUTSIDE THE CARD (v1.101.1, owner: "place the film study row
    // aka the videos outside the ng-landcard ... should be outside, immediately above it").
    // It is a row of thumbnails that GROWS when one is played, and growing it inside a card with
    // `max-height` + `overflow-y:auto` meant the player was clipped and had to be scrolled to.
    // As a sibling anchored above the card it grows UPWARD into empty screen, which is also what
    // makes an expanded clip land top-centre.
    if (info && info.clips && info.clips.length) {
      const film = document.createElement("div");
      film.className = "ng-landfilm";
      film.setAttribute("data-land-film", "1");
      // width/padding are a FIRST-FRAME GUESS only — _dockLandFilm immediately overwrites both
      // from the card's measured box, which is the one source of truth (see it for why).
      film.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);z-index:5;width:min(520px,calc(100vw - 32px));padding:0 15px;pointer-events:auto;";
      film.innerHTML = this.filmStudyHTML(info.clips, true);
      (this.__ngRoot || document.body).appendChild(film);
      this._landFilmEl = film;
      this.wireClips(film, info.clips);
    }

    // 4 — ONE question, always multiple choice: this is the in-play format (the sidebar is
    // where the same cards read back as classic recall)
    // A question already on the table is re-parented, never rebuilt: same card, same option order,
    // same `answered` closure — so a backfill completes the card around it without reshuffling it
    // under the player and without any chance of a second scored answer.
    if (reuse && reuse.el) {
      el.appendChild(reuse.el);
      this._landQ = reuse.q;
      this._landPending = reuse.pending;
      if (reuse.mc) this._mc = reuse.mc; // the keyboard's truth survives the re-parent (v1.106.10)
    } else if (card) {
      const qw = document.createElement("div");
      qw.setAttribute("data-land-q", "1");
      // no top border and no top margin (v1.101.1): with the header gone and film lifted out to
      // its own strip, the question IS the first thing in the card and that rule divided it from
      // nothing.
      qw.style.cssText = "";
      const qt = document.createElement("div");
      // THE CORNER CLEARANCE BELONGS TO THE QUESTION, NOT THE BLOCK (v1.101.3). It was on the
      // wrapper, so all four answers were inset 54px as well — they start below the corner
      // controls and have nothing to clear, and every one of them is `white-space:nowrap` +
      // ellipsis, so the padding was spending width that answer text needed. Only the line that
      // actually runs under the `+` and the ✕ pays for them.
      qt.style.cssText = "padding-right:54px;font-size:12.5px;font-weight:600;color:#dbe2f0;line-height:1.35;margin-bottom:8px;";
      qt.textContent = card.q;
      qw.appendChild(qt);
      const block = landRecall
        ? this._recallBlock(card, key, (ok, tier) => this._landAnswered(ok, tier, mode, hooks, "recall"), "land")
        : this._mcBlock(card, key, (correct, tier) => this._landAnswered(correct, tier, mode, hooks), "land");
      if (block) {
        qw.appendChild(block);
        el.appendChild(qw);
        this._landQ = { key: key, card: card, mode: mode || "land", answered: false };
        this._landPending = true; // a question is on the table — walking past it breaks momentum
        // COLD-START MEASUREMENT: is the game quizzing a state the player has never studied? The
        // glyph is the existing evidence ("○" = not one card in this deck has ever been met), so
        // this asks nothing new of the data model — it just names the suspected confusion.
        const unseen = glyph[0] === "○";
        this._landSkipDebt = null; // the question showed — any deferred skip verdict is void
        this.fx("land_q_shown", { deckKey: key, mode: mode || "land", unseen: unseen, cards: totalCards, backfill: !!this._landLate });
        if (unseen) this.fx("land_q_unseen", { deckKey: key, node: node.t, cards: totalCards, mode: mode || "land", landing: (this.rollLog || []).length });
      } else this._landQSkip(key, "no_distractors", mode);
    } else if ((mode || "land") === "land") {
      // NAME THE GAP. A landing that asks nothing is legitimate, but the cold-start funnel must not
      // be left to infer a drop-off from its absence — an unexplained hole in an ordered funnel is
      // exactly the phantom that made the v1.82.0 spine unusable.
      // THE REASON MUST BE TRUE (v1.106.6). `totalCards` is the manifest `n` until the chunk
      // lands, so the old chain called an in-flight deck "deck_proven" — a fresh profile's first
      // landing, rendered a beat before its (prefetched) chunk resolved, was recorded as a skip
      // that never happened. In-flight is judged by RESIDENCY, not by the manifest's count.
      // And a card WAITING ON ITS DISTRACTOR POOL (warmKind "pool") is not skipped at all: the
      // card exists, the question docks on this same landing when the pool warms, and
      // `mc_pool_cold` already names the wait — a funnel skip here would be a false drop-off.
      const reason = !this.get("landQuestions", true) ? "setting_off"
        : (!this.flashcards || (totalCards > 0 && !this._deckResident(key))) ? "decks_in_flight"
        : (!totalCards ? "no_cards_authored" : "deck_proven");
      // A CHUNK ALREADY REQUESTED IS A VERDICT NOT YET IN (v1.106.6): the prefetch asked for
      // this deck when the flight began, and from HTTP cache it resolves within this same
      // landing — a skip recorded now is a drop-off that un-happens moments later. Defer to the
      // resolution: dock → land_q_shown; failure or landing over → the skip, then (see the warm
      // .then and _flushLandSkipDebt). A missing MANIFEST stays an immediate skip: nothing is
      // even requestable, and the funnel must name that silence while it lasts.
      if (warmKind === "pool") { /* pending, never skipped — mc_pool_cold names the wait */ }
      else if (reason === "decks_in_flight" && this.flashcards && this._deckWaits && this._deckWaits[key])
        this._landSkipDebt = { key: key, mode: mode };
      else this._landQSkip(key, reason, mode);
    }

    // 5 — THE FULLER CONTAINER, UNFOLDED IN PLACE (v1.101.0). Everything the retired in-node
    // card used to carry now lives one affordance lower, inside the card you are already
    // reading — "the normal game container should be the default" (owner). Built lazily on the
    // first open, so a roll nobody expands never pays for it.
    // Computed at render time, not on first open: the FOOT has to know whether a `More` is
    // warranted before it draws one. It is a few cache reads and a string, no DOM.
    const moreHTML = this._landMoreHTML(node);
    let moreBody = null;
    if (moreHTML) {
      moreBody = document.createElement("div");
      moreBody.id = "ng-land-more";
      moreBody.setAttribute("data-land-more-body", "1");
      moreBody.style.cssText = "display:none;";
      moreBody._ngMoreHTML = moreHTML;
      el.appendChild(moreBody);
    }

    // 6 — everything else is behind one affordance
    // STICKY: the card is `max-height:min(320px,40vh); overflow-y:auto`, and with a definition,
    // a film row and a 4-option question the content is routinely TALLER than that. A static
    // footer then sits below the scroll box: present in the DOM, reported "visible" by a
    // locator, and unreachable by a real mouse until the user scrolls INSIDE the card — which
    // nobody does mid-roll. Sticking it to the bottom of the scrollport keeps `More ▸` and the
    // add-to-class + on screen at every scroll offset. pointer-events is re-enabled here as
    // well as on the button: a fixed overlay's disabled pointer-events is inherited, and this
    // repo has paid for that twice (v1.69.1).
    const foot = document.createElement("div");
    foot.setAttribute("data-land-foot", "1");
    foot.style.cssText = "position:sticky;bottom:0;z-index:2;pointer-events:auto;display:flex;align-items:center;gap:12px;margin-top:9px;padding:8px 0 2px;background:linear-gradient(180deg,rgba(19,22,37,0),rgba(19,22,37,.94) 45%,rgba(19,22,37,.97));";
    if (moreBody) {
      const more = document.createElement("button");
      more.setAttribute("data-land-more", "1");
      more.setAttribute("aria-expanded", "false");
      more.setAttribute("aria-controls", "ng-land-more");
      more.innerHTML = '<span data-land-more-label="1">More</span><span data-land-more-chevron="1" style="display:inline-block;transition:transform .22s cubic-bezier(.2,.7,.2,1);">▸</span>';
      more.style.cssText = "cursor:pointer;font-family:inherit;font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:" + NG_LAND_MORE_COL + ";background:none;border:none;padding:2px 0;display:inline-flex;align-items:center;gap:5px;transition:color .16s;";
      more.addEventListener("click", () => this.expandLandCard());
      foot.appendChild(more);
    }
    // THE COUNTER LIVES HERE NOW (v1.101.1), between `More ▸` and the capture `+`: it is a
    // control (it opens this state's flashcards), not a header ornament, and the owner asked for
    // it "bottom right same row as More". `margin-left:auto` on the chip is what pushes the pair
    // to the right edge, so the + no longer needs its own.
    const chip = document.createElement("span");
    chip.innerHTML = famChip.html;
    const chipEl = chip.firstChild;
    if (chipEl) {
      if (totalCards) chipEl.addEventListener("click", (e) => { e.stopPropagation(); this.openHomeToLatest(); });
      foot.appendChild(chipEl);
    }
    el.appendChild(foot);
    // ── THE CARD'S TWO CORNER CONTROLS, TOP-RIGHT (v1.101.1) ──
    // Owner: "the + should only show top right next of the x close icon when the card is open".
    // Capture and dismiss are the same KIND of thing — chrome you reach for deliberately, about
    // the card as a whole — so they sit together in the corner, absolutely positioned so they
    // cost the card NO vertical space. That is the whole point of this pass: the question shows
    // the moment the card does. Dismiss clears this landing's card only; the next landing renders
    // a fresh one, and `_landBackfill` returns early on a null `_landEl`, so a late payload can
    // never resurrect a card the player put away.
    const corner = document.createElement("div");
    corner.setAttribute("data-land-corner", "1");
    // 5px from the top AND 5px from the right — the owner asked for the pair to sit "a bit
    // closer and a bit closer to the top (symmetric to how the x close button is close to the
    // right edge)". The symmetry only works once the row's height is the 24px ✕ and not the
    // 44px thumb + (see below), or align-items:center pushes BOTH glyphs 10px down.
    corner.style.cssText = "position:absolute;top:5px;right:5px;z-index:3;pointer-events:auto;display:flex;align-items:center;gap:2px;";
    // pointer-events:auto is set INLINE by _listAddButton: .ng-landcard is a fixed overlay and
    // the canvas hit-tests above anything that does not re-enable it.
    const addBtn = this._listAddButton(node.id, "land");
    // quieter than every other surface's copy of it: two bordered boxes in a corner read as a
    // toolbar. The HIT AREA is untouched (24px desktop / 44px thumb) — only the paint is.
    addBtn.style.border = "none";
    addBtn.style.background = "none";
    addBtn.style.fontSize = "15px";
    // THE 44px THUMB TARGET MUST NOT SET THE CORNER'S GEOMETRY (v1.104.2). On a phone
    // `_listAddButton` returns a 44x44 box; beside a 24x24 ✕ under align-items:center that makes
    // the row 44 tall, so both glyphs sat 10px lower than the 5px inset implies and 20px apart.
    // A -10px margin shrinks its LAYOUT box to 24x24 while the button still renders — and still
    // takes a thumb — at 44. Same trick as `.ng-lists-new`: the glyph is small, the hit area is
    // not. The ✕ is painted after it, so it wins hit-testing where the boxes overlap.
    if (addBtn.style.width === "44px") addBtn.style.margin = "-10px";
    corner.appendChild(addBtn);
    const xb = document.createElement("button");
    xb.type = "button";
    xb.setAttribute("data-land-close", "1");
    xb.setAttribute("aria-label", "Hide this card");
    xb.title = "Hide this card";
    xb.textContent = "✕";
    xb.style.cssText = "flex:none;pointer-events:auto;cursor:pointer;font-family:inherit;width:24px;height:24px;border:none;border-radius:7px;background:none;color:#8b97b0;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;transition:color .15s,background .15s;";
    xb.addEventListener("mouseenter", () => { xb.style.color = "#dbe2f0"; xb.style.background = "rgba(255,255,255,.08)"; });
    xb.addEventListener("mouseleave", () => { xb.style.color = "#8b97b0"; xb.style.background = "none"; });
    xb.addEventListener("click", (e) => { e.stopPropagation(); this.fx("land_dismissed", { node: node.t, answered: !!(this._landQ && this._landQ.answered) }); this.clearLandCard(); });
    corner.appendChild(xb);
    el.appendChild(corner);
    // deck/pool still landing: come back once, for THIS card only (`_landEl === el` proves the
    // player has not moved on), and never loop — after the warm, questionFor either has a card
    // or the deck genuinely has none.
    if (warm) {
      // RE-RENDER ONLY ON PROGRESS (v1.105.6). With the deck payload HELD (a stalled manifest),
      // hydrateDeck cannot progress and resolves INSTANTLY — and an unconditional .then re-render
      // re-armed the same no-op warm, forever: an infinite MICROTASK chain that starves the event
      // loop. The page hard-froze (this is the 2.2m cold-start hang the fixed harness glob
      // exposed), and no setTimeout watchdog can fire under a spinning microtask queue — which is
      // why v1.104.8's wall-clock bound never helped. The guard: re-render only if the wait
      // actually produced something (the deck arrived, or the MC pool warmed). When nothing
      // changed, stop — `_landBackfill` re-renders on the payload-arrival hooks anyway.
      const c1 = card;
      const p = warm().then(() => {
        if (this._landEl !== el) return;
        const progressed = this._deckResident(key) || (c1 && this.mcPoolWarm(key, c1));
        // a question docking on the warm re-render IS a late arrival — the initial render asked
        // nothing, which is why the warm existed. Same stamp `_landBackfill` wears (v1.106.6).
        if (progressed) { this._landLate = true; try { this.renderLandCard(node, mode, hooks); } finally { this._landLate = false; } }
        // the deferred verdict comes in: the warm could not produce this deck — the skip is real
        else this._flushLandSkipDebt();
      }).catch(() => {});
      // ── THE "QUESTION IS SETTLED" SIGNAL (v1.80.5) ──
      // Since the payload was chunked, the question docks ONE FETCH after the card paints. Any
      // reader that wants the question — a journey pressing A-D, a screen reader, us — needs a
      // deterministic way to know it has stopped moving, or it races the network. `_landWarmP`
      // is that: the promise of the CURRENT landing's outstanding work, replaced (not cleared)
      // when the re-render itself needs another fetch, so landSettled() can chase the chain.
      // ── AND IT IS BOUNDED (v1.104.8) ──
      // `warm()` awaits deck fetches. A STALLED connection never settles them, so `p` never
      // settled, so `_landWarmP` never cleared and `landSettled()` awaited it forever — the app
      // was left permanently "still settling" on exactly the connection the cold-start journeys
      // exist to describe. It went unnoticed for months because the harness rule meant to
      // reproduce that connection named a URL the app never fetches (v1.104.6), so the case was
      // never actually exercised.
      // The SIGNAL is bounded; the WORK is not. `p` still re-renders the card if the payload
      // ever lands (and `_landBackfill` covers it too), so a slow-but-working network is
      // unchanged — only the promise that readers await stops being unbounded. Wall clock, not
      // the sim clock: a stalled socket stalls in real time.
      this._landWarmP = p;
      p.then(() => { if (this._landWarmP === p) this._landWarmP = null; });
      const giveUp = setTimeout(() => {
        if (this._landWarmP === p) {
          this._landWarmP = null;
          this.fx("land_warm_stalled", { node: node ? node.t : null });
        }
      }, NG_LAND_WARM_CEILING_MS);
      p.then(() => clearTimeout(giveUp), () => clearTimeout(giveUp));
    } else {
      this._landWarmP = null;   // nothing outstanding: this card is what the state has to ask
    }
    // an unfolded card stays unfolded across a backfill — the payload landing is not a request
    // to close what the reader opened. `_landOpen` is dropped when the LANDING changes, below.
    if (this._landOpen) this.expandLandCard(true);
    this._dockLandCard(el);
    // a fresh card born while the reading sheet owns the screen must not pop over it
    if (this._traySup || this._dossierIdx != null) this._suppressLand(true);
    return el;
  }
  /**
   * MORE ▸ UNFOLDS THE GAME'S OWN CARD (v1.101.0).
   *
   * It used to call `openDossier`, which flew the camera into the node and mounted a second,
   * differently-shaped container over the graph. The owner's call: "the other fuller container
   * should no longer show, and instead the normal game container should be the default. upon
   * clicking more all of the other sections that were present in the fuller container would show
   * there now." So the card grows instead — same card, same place, same question still on the
   * table above it.
   *
   * Reading is not free time: unfolding auto-pauses the roll and folding gives the clock back,
   * on its OWN latch (`_landAutoPaused`), so it can never resume a roll the player paused by
   * hand — the same rule the pane and the dossier already follow.
   */
  expandLandCard(open) {
    const el = this._landEl; if (!el) return false;
    const body = el.querySelector("[data-land-more-body]");
    const btn = el.querySelector("[data-land-more]");
    if (!body || !btn) return false;
    const want = open == null ? !this._landOpen : !!open;
    this._landOpen = want;
    const node = this.nodes && this._landIdx != null ? this.nodes[this._landIdx] : null;
    if (want) {
      if (!body.firstChild && body._ngMoreHTML) {
        const box = document.createElement("div");
        box.style.cssText = "margin-top:10px;padding-top:10px;border-top:1px solid rgba(150,170,210,.14);animation:ngMoreIn .22s cubic-bezier(.2,.7,.2,1);";
        box.innerHTML = body._ngMoreHTML;
        body.appendChild(box);
      }
      body.style.display = "block";
      // BOUND IT BY THE SPACE THAT ACTUALLY EXISTS, not by a constant. The card is anchored by its
      // BOTTOM (bottom:236px desktop, 206px phone, and _dockLandCard overrides that again), so a
      // fixed "min(620px,74vh)" grows it upward past the top of the viewport on any short screen —
      // measured at 1440x720 the expanded card's top was -28 with scrollHeight == clientHeight, so
      // there was no internal scroll to recover it either. The owner: "I can't scroll up".
      // Its own measured bottom is the honest ceiling: everything above it, less a 12px inset.
      // (`!important` for the same reason as the mobile rule it has to outrank.)
      const r = el.getBoundingClientRect();
      const avail = Math.max(220, Math.round(r.bottom) - 12);
      el.style.setProperty("max-height", Math.min(620, avail) + "px", "important");
      if (!this.paused) { this.setPaused(true); this._landAutoPaused = true; }
      this.fx("land_more_opened", { node: node ? node.t : null });
    } else {
      body.style.display = "none";
      el.style.removeProperty("max-height");
      if (this._landAutoPaused) { this.setPaused(false); this._landAutoPaused = false; }
    }
    btn.setAttribute("aria-expanded", want ? "true" : "false");
    const lab = btn.querySelector("[data-land-more-label]"); if (lab) lab.textContent = want ? "Less" : "More";
    const ch = btn.querySelector("[data-land-more-chevron]"); if (ch) ch.style.transform = want ? "rotate(90deg)" : "";
    // "#7e8aa3", NOT "" (v1.104.2, owner: after More -> Less it "is black over a dark
    // background, so it's poorly readable"). The resting colour is declared in the button's
    // OWN cssText, and `style.color = ""` REMOVES that inline declaration rather than restoring
    // it — so a collapsed card inherited from a parent that sets no colour and fell back to the
    // UA default, black, on a #131625 card. Restore the value; never clear it.
    btn.style.color = want ? "#cdd5e6" : NG_LAND_MORE_COL;
    this._dockLandCard(el);
    return true;
  }
  /**
   * The sections the retired in-node container carried, at the game card's own text size:
   * principles, where it leads, what beats it, and — for a position — the attacks available from
   * it. Film and the one-line definition are NOT repeated here; they are already above, because
   * they are what a player wants without asking.
   */
  /**
   * The fuller sections as HTML, or "" when this state has none — and "" is the whole point:
   * `More ▸` is only rendered when this returns something. Owner: "if there is nothing to show
   * by clicking More then don't show the More". A control that opens onto "nothing more is
   * authored for this state yet" is a dead affordance; the card should just be the card.
   * ONE function for the predicate and the content, so the button and the panel can never
   * disagree about whether there is anything behind it.
   */
  /**
   * The DEFINITION, with the page-title sentence taken off the front.
   *
   * 1144 of the 1598 authored `def` strings (72%) open with "Master <thing> in BJJ." — an SEO
   * lead-in for the static page — and `mcClip` clips to the FIRST SENTENCE, so the reader was
   * shown the marketing line and denied the definition behind it. In every one of those 1144 there
   * IS content after it ("Deep underhook half guard variant with excellent sweeping and back-take
   * options…"). Owner, on seeing "Master the Estima Lock Bottom Position in BJJ." under More:
   * "this is kinda pointless info". It was — but the fix is to skip the lead-in, not to drop the
   * field: the useful half was one sentence away the whole time.
   */
  definitionOf(raw) {
    let t = String(raw == null ? "" : raw).trim();
    if (!t) return "";
    t = t.replace(/^\s*(?:master|learn|discover)\b[^.!?]{0,90}?\bin (?:bjj|brazilian jiu-?jitsu)\b[.!?]\s*/i, "");
    t = t.trim();
    if (!t) return "";                       // it was ONLY the lead-in: say nothing
    return this.mcClip(t) || t.slice(0, 220);
  }
  _landMoreHTML(node) {
    const info = this.ngContentFor(node) || {};
    const rc = this.richContentFor(node);
    const persp = rc && rc.perspectives ? rc.perspectives.attacker : null;
    const secHead = (t) => '<div style="font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:#8496b8;margin:0 0 6px;">' + t + '</div>';
    const bullet = (t, dot) => '<div style="display:flex;gap:8px;align-items:flex-start;font-size:11.5px;line-height:1.45;color:#c4cde0;margin-bottom:5px;"><span style="flex:none;width:5px;height:5px;border-radius:50%;background:' + dot + ';margin-top:6px;"></span><span>' + t + '</span></div>';
    let h = "";
    // the intro the compact card no longer shows — kept, one fold lower, because the same
    // sentence is the static page's SEO copy and deleting it outright would lose it
    const def = this.definitionOf(info.def);
    if (def)
      h += '<div data-land-def="1" style="font-size:11.5px;line-height:1.5;color:#aeb9d4;margin-bottom:11px;">' + def + '</div>';
    const principles = ((persp && persp.principles) || info.principles || []).slice(0, 4);
    if (principles.length)
      h += '<div data-land-principles="1" style="margin-bottom:11px;">' + secHead("Essential principles") + principles.map((p) => bullet(p, "#7fb4ff")).join("") + '</div>';
    if (rc && Array.isArray(rc.outcomes) && rc.outcomes.length) {
      const tone = { good: "#7ee0a8", bad: "#e8956b", mid: "#cbd24e" };
      h += '<div data-land-outcomes="1" style="margin-bottom:11px;">' + secHead("Where it leads") + rc.outcomes.slice(0, 3).map((o) =>
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><span style="flex:1;min-width:0;font-size:11.5px;color:#cdd5e6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (o.result || "") + ' → ' + (o.position || "") + '</span><span style="flex:none;font-size:11px;font-weight:700;color:' + (tone[o.tone] || "#cfd6e4") + ';">' + (o.prob != null ? o.prob + '%' : '') + '</span></div>').join("") + '</div>';
    }
    const counters = (info.counters || (persp && persp.counters) || []).slice(0, 3);
    if (counters.length)
      h += '<div data-land-counters="1" style="margin-bottom:11px;">' + secHead("What beats it") + counters.map((c) => bullet(c, "#e8956b")).join("") + '</div>';
    // ── NO "ATTACKS FROM HERE" (v1.101.8) ───────────────────────────────────────────────────
    // The owner asked whether it was repeated content, "since we anyway show options for the
    // user to select (which are attacks / transitions / edges out of this state)". It was worse
    // than repetition. That block was raw adjacency — first six neighbours, deduped by short
    // name, with NO role filter and NO origin filter — while `optionsFor()` builds the hand from
    // the same adjacency and then keeps only what favours the side you are playing and what
    // actually originates here. Measured across all 272 position-role hands, 1,632 pills:
    //   · 42.3%  originate at a DIFFERENT position
    //   · 35.4%  the opponent's move, and from elsewhere
    //   · 10.8%  the opponent's move
    //   ·  11.5% legitimately yours from here
    // So 88.5% of it told the reader they could do things they cannot, under a heading that
    // said otherwise — and it overlapped the dealt hand by only 12.9%, so it did not even read
    // as a summary of the tray below it. The hand IS the answer to "what can I do from here":
    // role-correct, origin-correct, ordered, and already on screen.
    return h;   // "" means: this state has nothing more, so it gets no `More` at all
  }
  /** Is the landing question settled — mounted, or definitively not coming? */
  landQuestionReady() { return !this._landWarmP; }
  /**
   * Resolves once the landing question is settled. Chases the chain (deck fetch -> distractor
   * pool fetch -> render), so one await is enough however many hops the card needs. Safe to call
   * when no landing card exists: it returns immediately.
   */
  async landSettled() {
    for (let i = 0; i < 8; i++) {
      const p = this._landWarmP;
      if (!p) return;
      await p.catch(() => {});
      if (this._landWarmP === p) return;   // resolved and nothing chained on
    }
  }
  // this landing asked nothing, and `reason` says why (so the funnel gap is never a phantom)
  _landQSkip(key, reason, mode) {
    this.fx("land_q_skipped", { deckKey: key, reason: reason, mode: mode || "land", backfill: !!this._landLate });
  }
  /**
   * Dock the landing card ABOVE the options tray on a narrow viewport.
   *
   * The tray is `position:absolute; bottom:84px` with NO height, so it grows UPWARD as its cards
   * grow; the landing card's `bottom` is a CSS constant (206px on a phone) that was tuned against
   * a shorter tray. Measured at 390x844: tray top 583, landing-card bottom 646 — a 63px overlap,
   * and the card is z-index 5 over the tray's 4, so it covered the top of every option card: the
   * category, the potential and the technique NAME you are choosing between. (The overlap
   * pre-dates the capture `+`, which widened it by ~9px; a constant cannot track a tray whose
   * height depends on how many lines a technique's name wraps to.)
   *
   * So dock off the tray's MEASURED top instead. Mobile only: on desktop the tray is one row of
   * cards well below the card and the authored constant is right.
   */
  /**
   * The film strip is anchored to the TOP EDGE OF THE CARD, whatever height the card has taken —
   * and it grows upward, so an expanded clip climbs into empty screen instead of being clipped
   * inside a scrollport. If it would climb off the top it pins to a 16px inset instead.
   */
  _dockLandFilm() {
    const f = this._landFilmEl; if (!f) return;
    const H = window.innerHeight || 800;
    const c = this._landEl;
    // THE STRIP TAKES ITS WIDTH FROM THE CARD IT SITS ON, MEASURED (v1.104.2, owner: "the span
    // of the videos row should perhaps be the same width as the ng-landcard?"). It used to
    // duplicate the card's DESKTOP rule as a constant — and the card has a mobile override
    // (`width:calc(100vw - 20px)!important; padding:11px 12px`), so at 390x844 the two boxes
    // measured [16,374] against [10,380] and their content edges were 9px apart on each side.
    // Copying the padding too is what lines the THUMBNAILS up with the text above them; both
    // boxes are left:50% + translateX(-50%), so equal widths centre identically.
    if (c) {
      const cb = c.getBoundingClientRect(), cs = getComputedStyle(c);
      if (cb.width > 0) {
        f.style.width = Math.round(cb.width) + "px";
        f.style.paddingLeft = cs.paddingLeft;
        f.style.paddingRight = cs.paddingRight;
      }
    }
    const cardTop = c ? c.getBoundingClientRect().top : H - 236;
    const h = f.offsetHeight || 0;
    let bottom = Math.round(H - cardTop + 8);
    if (H - bottom - h < 16) bottom = Math.max(8, H - 16 - h);
    f.style.bottom = bottom + "px";
  }
  _dockLandCard(el) {
    if (this._landFilmEl) requestAnimationFrame(() => this._dockLandFilm());
    if (!el) return;
    const row = this.optionsRef.current; if (!row) return;
    const h = row.getBoundingClientRect().height;
    if (!(h > 0)) return; // no hand dealt yet — the CSS constant is as good a guess as any
    const TRAY_BOTTOM = 84; // matches .ng-optionrow's own `bottom` in xdc-template.html
    // DESKTOP DOCKS ONLY WHEN IT MUST (v1.104.4). This was mobile-only because the desktop
    // constant (`bottom:236px`) clears an ordinary option tray. An ESCAPE tray is taller — its
    // cards carry the extra "escape route" line — and measured at 1440x900 the card's bottom
    // landed at 664 against a tray top of 657: a 7px overlap on the one screen where you are
    // under a 4-9s clock. So desktop now measures, and moves the card ONLY if it would actually
    // collide; with no overlap the CSS constant is left exactly as it was, so nothing that
    // looked right before can move.
    if (!this.isMobile()) {
      const rb = row.getBoundingClientRect(), cb = el.getBoundingClientRect();
      if (cb.bottom <= rb.top - 8) { el.style.removeProperty("bottom"); return; }
      el.style.setProperty("bottom", Math.round(TRAY_BOTTOM + h + 12) + "px", "important");
      return;
    }
    // `!important` is REQUIRED, not cargo cult: the mobile rule is
    // `@media (max-width:640px){.ng-landcard{bottom:206px!important}}`, and a plain inline style
    // loses to an !important declaration in a stylesheet. Setting `el.style.bottom` moved the card
    // by 2px (646 → 644) and looked like the measurement was wrong rather than the cascade.
    el.style.setProperty("bottom", Math.round(TRAY_BOTTOM + h + 8) + "px", "important");  }
  // ── "SEE MORE" SITS ABOVE THE HAND, NOT UNDER IT (v1.123.0, owner) ──────────────────────────
  // It was `bottom:68px`, a constant BELOW the tray's own `bottom:84px` — so it hung under the
  // hand, in the bottom band, on top of the account chip. MEASURED at every width where it
  // renders (844x390 through 1440x900): the hint's box sits exactly 2px above the chip's, with
  // the same right edge — 1345,819..1416,832 against 1317,834..1416,876 at 1440x900. That is the
  // owner's "overlaps user icon and text", and it is universal, not device-specific.
  //
  // The fix is the tray's own MEASURED top, never a constant: the row has no fixed height (138px
  // at 390x844, 144px at 1440x900, and taller again for an escape hand, whose cards carry an
  // extra line), which is the same lesson `_dockLandCard` learned. Right-aligned, so it never
  // meets the landing card — that card is `min(520px, 100vw-32px)` and CENTRED, and at every
  // width this hint is still shown its right edge clears the hint's left edge.
  _dockOptionHint(el, row) {
    const h = row.getBoundingClientRect().height;
    if (!h) return;
    const TRAY_BOTTOM = 84; // matches .ng-optionrow's own `bottom` in xdc-template.html
    const want = Math.round(TRAY_BOTTOM + h + 10) + "px";
    if (this._hintDockAt !== want) { this._hintDockAt = want; el.style.bottom = want; }
  }
  _landAnswered(correct, tier, mode, hooks, format) {
    this._landPending = false;
    if (this._landQ) this._landQ.answered = true; // scored — no payload may ever re-mount this block
    if (correct) {
      // SELF-GRADED RECALL EARNS ODDS, NEVER CLOCK OR COMBO (v1.105.1). "Show answer → Got it"
      // is an unverifiable claim; under MC the +2.5s refund and the combo tick are unforgeable,
      // under recall they would be a free-time button on every landing. The mastery/odds credit
      // (gradeRecall → noteCardDone) still flows — recall is worth MORE proof, just not more
      // clock.
      const selfGraded = format === "recall";
      const granted = selfGraded ? false : this.refundDecision(2500);
      if (!selfGraded) this._comboUp();
      // ×2+ gets the announcer pop — a toast underneath it would just mumble
      if ((this._combo || 0) < 2) this.setEvent("Correct", granted ? "Odds up · +2.5s on the clock" : "Odds up on this exchange", "good");
    } else {
      const cost = tier === "trap" ? 0.08 : 0.04;
      this._qMod = (this._qMod || 0) - cost;
      const broke = this._breakCombo("wrong");
      this.setEvent(
        tier === "trap" ? "That one gets you hurt" : "Not quite",
        "−" + Math.round(cost * 100) + "% on this exchange" + (broke >= 2 ? " · ×" + broke + " momentum gone" : ""),
        "bad");
    }
    this.refreshOptionOdds();
    this.fx("land_q_answered", { correct: !!correct, tier: tier || null, mode: mode || "land", qMod: this._qMod || 0, combo: this._combo || 0 });
    if (hooks && hooks.onAnswer) hooks.onAnswer(!!correct);
  }
  // ── MOMENTUM: the combo meter ──
  // Answer landing questions right back-to-back and the whole match tilts your way: every option
  // and escape gets hotter (+2.5% per tier, cap +10%) and, when a move fails anyway, the opponent
  // capitalizes less (counter-outcomes shed up to 40% of their weight — you're moving too fast to
  // counter). Per ROLL: a fresh match starts cold. A WRONG answer breaks it; so does IGNORING a
  // question that was asked (executing past it, or letting the clock auto-pick). A landing that
  // asks nothing carries the streak — silence isn't neglect.
  get COMBO_NAMES() { return { 2: "DOUBLE COMBO!", 3: "TRIPLE COMBO!", 4: "MEGA COMBO!", 5: "ULTRA COMBO!", 6: "RAMPAGE!" }; }
  comboName(n) { return this.COMBO_NAMES[n] || (n >= 7 ? "GODLIKE" + (n > 7 ? " ×" + n : "") : ""); }
  momentumMod() { const n = this._combo || 0; return Math.min(0.10, Math.max(0, (Math.min(n, 5) - 1) * 0.025)); }
  momentumSkew() { const n = this._combo || 0; return Math.min(0.40, Math.max(0, (Math.min(n, 5) - 1) * 0.10)); }
  _comboUp() {
    this._combo = (this._combo || 0) + 1;
    const n = this._combo;
    if (n >= 2) {
      const name = this.comboName(n);
      this.fx("combo", { n: n, name: name, mod: this.momentumMod() });
      if (n >= 5) this.fx("combo_big", { n: n }); // the top tiers get the louder patch
      this._comboPop(name, n);
    }
    this._updateComboChip();
    this.refreshOptionOdds(); // the whole hand ticks up — the skew is visible, not hidden math
  }
  _breakCombo(reason) {
    const was = this._combo || 0;
    this._landPending = false;
    if (!was) return 0;
    this._combo = 0;
    this.fx("combo_break", { at: was, reason: reason });
    this._updateComboChip(true);
    this.refreshOptionOdds(); // and cools back down just as visibly
    return was;
  }
  _comboPop(name, n) {
    if (this._comboPopEl) { try { this._comboPopEl.remove(); } catch (e) {} }
    const el = document.createElement("div");
    el.className = "ng-combo-pop";
    el.setAttribute("data-combo-pop", String(n));
    el.setAttribute("data-heat", String(Math.min(5, n - 1)));
    const mod = Math.round(this.momentumMod() * 100);
    el.innerHTML =
      '<div class="ng-combo-x">MOMENTUM &times;' + n + '</div>' +
      '<div class="ng-combo-name">' + name + '</div>' +
      (mod ? '<div class="ng-combo-sub">+' + mod + '% everything &middot; counters fade</div>' : '');
    (this.__ngRoot || document.body).appendChild(el);
    this._comboPopEl = el;
    this.after(n >= 5 ? 1.7 : 1.2, () => { if (this._comboPopEl === el) this._comboPopEl = null; try { el.remove(); } catch (e) {} });
  }
  _updateComboChip(broken) {
    const n = this._combo || 0;
    let chip = this._comboChip;
    if (n < 2) {
      if (chip) {
        this._comboChip = null;
        if (broken) { chip.setAttribute("data-combo-broken", "1"); this.after(0.55, () => { try { chip.remove(); } catch (e) {} }); }
        else { try { chip.remove(); } catch (e) {} }
      }
      return;
    }
    if (!chip) {
      chip = document.createElement("div");
      chip.className = "ng-momentum";
      (this.__ngRoot || document.body).appendChild(chip);
      this._comboChip = chip;
    }
    chip.setAttribute("data-momentum", String(n));
    chip.setAttribute("data-heat", String(Math.min(5, n - 1)));
    chip.innerHTML = '<b>&times;' + n + '</b><span>momentum &middot; +' + Math.round(this.momentumMod() * 100) + '%</span>';
  }

  // NB there is deliberately NO second question at the technique node between commit and sweep.
  // It was built and cut: gating the sweep on a 4s window added that delay to EVERY move, and the
  // landing question already does the job the owner described — it moves the odds of the very
  // transition or submission you are about to attempt. Peeking a move's sheet still offers the
  // JIT micro-drill for anyone who wants to buy odds right before committing.

  // ═══ P2: one-beacon guidance + panic-drill defense + guided first roll ═══

  // Beat Beacon — the ONE glowing next-thing. Setting a new target strips the old one, so
  // the one-beacon law holds by construction (journeys assert [data-beacon] count == 1).
  setBeacon(target, el) {
    const prev = this._beacon;
    if (prev && prev.el && prev.el.removeAttribute) { prev.el.removeAttribute("data-beacon"); if (prev.el.classList) prev.el.classList.remove("ng-beacon"); }
    if (!target || !el) { this._beacon = null; return; }
    el.setAttribute("data-beacon", target);
    if (el.classList) el.classList.add("ng-beacon");
    this._beacon = { target: target, el: el };
    this.fx("beacon_moved", { target: target });
  }
  beaconState() { return this._beacon ? { target: this._beacon.target } : null; }

  // shared defense math: one seam for the escape cards, the live re-render, and the resolve.
  // dmod credits whichever deck the panic drill drills (authored Defender deck when it exists,
  // else your position deck) — so grading under fire visibly moves EVERY escape's number.
  escapeChance(opt) {
    const sub = this._defendSub != null ? this.nodes[this._defendSub] : null;
    if (!sub || !opt || !opt.node) return 0;
    const dmod = this.stateBonus(this._panicKey || this.defendKeyFor(sub));
    // momentum is morale — it helps you defend just as it helps you attack
    return Math.max(0.08, Math.min(0.92, 0.4 + (this.myVal(opt.node) - this.myVal(sub)) * 0.15 + dmod - (this.aiSkill || 0) + this.momentumMod()));
  }
  escapeOddsSnapshot() {
    const list = this._optList;
    if (this._defendSub == null || !list || !list.length) return 0;
    return Math.round(this.escapeChance(list[0]) * 100);
  }
  refreshEscapeOdds() {
    if (this._defendSub == null) return;
    for (const oc of (this._optionCards || [])) {
      const el = oc.card.querySelector(".ngodds"); if (!el) continue;
      const pct = Math.round(this.escapeChance({ node: oc.node }) * 100);
      el.textContent = pct + "%";
      el.style.color = pct >= 60 ? "#7ee0a8" : pct >= 38 ? "#cbd24e" : "#e8956b";
    }
  }
  pickFirstEscape() { const p = this._optPick, l = this._optList; if (p && l && l.length) p(l[0]); }

  // heartbeat vignette — visible trouble. Escape snaps it off in 180ms (the relief IS the
  // reward); a tap lets it drain slowly with the defeat.
  showVignette() {
    if (this._vignetteEl) return;
    const v = document.createElement("div");
    v.className = "ng-vignette";
    (this.__ngRoot || document.body).appendChild(v);
    this._vignetteEl = v;
  }
  killVignette(relief) {
    const v = this._vignetteEl; if (!v) return; this._vignetteEl = null;
    v.style.transition = relief ? "opacity .18s ease" : "opacity .5s ease";
    v.style.opacity = "0";
    setTimeout(() => { try { v.remove(); } catch (e) {} }, relief ? 200 : 520);
  }

  // ── PANIC DRILL: THE DEFENCE QUESTION IS A LANDING CARD (v1.104.4, owner: it "should show
  // alike the ng-landcard, in fact it should be a ng-landcard i think. it should never be in the
  // options row lol wtf"). It used to be a 236px flex item INSERTED AS THE FIRST CHILD OF THE
  // ESCAPE TRAY — so the question you must read sat in the row of things you must choose between,
  // shifting every escape card one slot right and competing with them for the same glance under a
  // 4-9s clock. Everywhere else in the app a question is asked ABOVE the hand; this was the one
  // place it was asked INSIDE it.
  //
  // It is not merely STYLED like a landing card, it IS one: the element goes in `_landEl`, so
  // every piece of landing-card machinery applies for free and cannot drift — `_dockLandCard`
  // (which keeps it clear of a tray whose height depends on how many lines a name wraps to),
  // `_suppressLand` (the pane and the option sheet stand it down), `attachInput`'s
  // pointer-capture early-return, and `clearLandCard` for teardown.
  //
  // Grading it still pumps every escape's odds live (+6% stateBonus) and refunds clock (+2s).
  buildPanicCard(row, sub) {
    const decks = (this.flashcards && this.flashcards.decks) || {};
    const pk = this._panicKey;
    const pc = pk ? this._cardsOf(decks[pk]) : null;
    if (!pc || !pc.length) return;
    this._jitIdx = this._jitIdx || {};
    this.clearLandCard();               // one card slot; never two stacked
    const card = document.createElement("div");
    card.className = "ng-landcard";     // position, width, dock, animation — all inherited
    card.setAttribute("data-landcard", "defense");
    card.setAttribute("data-panic", "1");
    // pointer-events:auto is LOAD-BEARING on every fixed overlay (inherited property; the canvas
    // hit-tests above anything that does not re-enable it). The palette is the only thing this
    // overrides — `.ng-landcard[data-landcard="defense"]` in helmet.html carries the danger skin.
    card.style.pointerEvents = "auto";
    const render = () => {
      const idx = (this._jitIdx[pk] || 0) % pc.length;
      const fc = pc[idx];
      card.innerHTML =
        '<div style="font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:#ff9c9c;margin-bottom:6px;">Panic drill &mdash; defend it</div>' +
        '<div style="font-size:13.5px;line-height:1.45;color:#f6e6e6;">' + fc.q + '</div>' +
        '<div class="pAns" style="display:none;margin-top:8px;font-size:12.5px;line-height:1.5;color:#e8b8b8;border-top:1px solid rgba(255,110,110,.22);padding-top:8px;">' + fc.a + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:10px;">' +
          '<button data-panic-reveal style="flex:1;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;padding:9px;border-radius:9px;border:1px solid rgba(255,110,110,.45);background:rgba(255,110,110,.14);color:#ffc9c9;">Reveal</button>' +
          '<button data-panic-got style="display:none;flex:1;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;padding:9px;border-radius:9px;border:none;background:linear-gradient(135deg,#b8434a,#8f2f38);color:#ffecec;">Got it &rarr; +escape%</button>' +
        '</div>';
      const rv = card.querySelector("[data-panic-reveal]"), gt = card.querySelector("[data-panic-got]");
      rv.addEventListener("click", (ev) => { ev.stopPropagation(); card.querySelector(".pAns").style.display = "block"; rv.style.display = "none"; gt.style.display = "block"; this._dockLandCard(card); });
      gt.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.prep[pk] = (this.prep[pk] || 0) + 1;
        this.noteCardDone(fc, pk);
        this.refundDecision(2000);      // composure buys time
        this.refreshEscapeOdds();       // the payoff: every escape's % climbs before your eyes
        this.fx("escape_odds_pumped", { deck_key: pk });
        this._jitIdx[pk] = idx + 1;
        render();
        this._dockLandCard(card);
        if (row) this.setBeacon("escape", row);  // drilled — now TAKE the escape
      });
    };
    render();
    (this.__ngRoot || document.body).appendChild(card);
    this._landEl = card;
    this._landMode = "defense";
    this._dockLandCard(card);
    this.fx("panic_drill_opened", { deck_key: pk });
    this.setBeacon("panic", card);
  }

  // ── CHALLENGES: permanent evidence tracks, separate from Game Knowledge ──
  get CHALLENGE_TRACKS() { return NG_CHALLENGE_TRACKS; }
  get CHALLENGES() { return NG_CHALLENGES; }
  get PATCHES() { return NG_BADGE_DEFINITIONS; }
  get MAT_COINS() { return NG_MAT_COINS; }
  get TUTORIAL() {
    // Transitional test/API rail: older clients and journeys keep the same twenty IDs.
    return NG_WHITE_CHALLENGES.map((challenge) => ({
      id: challenge.legacyId,
      copy: challenge.copy,
      m: (beat, props) => ngMatches(challenge, beat, props || {}),
    }));
  }
  challengeProgress(id) {
    const definition = NG_CHALLENGE_BY_ID[id];
    if (!definition) return null;
    return ngProgressEntry((this.challenges || {})[id], definition);
  }
  challengeTrackProgress(trackId) {
    return ngTrackSummary(this.challenges || {}, trackId);
  }
  challengeDoneCount(trackId) {
    return this.challengeTrackProgress(trackId || "white").done;
  }
  challengeCurrent(trackId) {
    const track = trackId || "white";
    for (const definition of NG_CHALLENGES) {
      if (definition.track === track && !this.challengeProgress(definition.id).done) {
        return definition;
      }
    }
    return null;
  }
  _challengeSnapshot() {
    let lessonCount = 0;
    for (const key in (this._lessonIndex || {})) {
      if (this.lessonDone(key)) lessonCount += 1;
    }
    let checkpointCount = 0;
    for (const key in (this.units || {})) {
      if (this.units[key] && this.units[key].checkpoint) checkpointCount += 1;
    }
    const capstoneCount = Object.keys(((this.belts || {}).won) || {}).length;
    let recallCount = 0;
    for (const deckKey in (this.stage || {})) {
      const deck = this.stage[deckKey] || {};
      for (const questionHash in deck) {
        if ((deck[questionHash] || 0) >= 3) recallCount += 1;
      }
    }
    let masteredDeckCount = 0;
    if (this.flashcards && this.flashcards.decks) {
      for (const deckKey of Object.keys(this.stage || {})) {
        if (this.deckMastery(deckKey) >= 1) masteredDeckCount += 1;
      }
    }
    return {
      lessonCount,
      checkpointCount,
      capstoneCount,
      recallCount,
      masteredDeckCount,
    };
  }
  _refreshChallengeEvidence() {
    if (!this._progressLoaded || this._inChallenges) return;
    this._inChallenges = true;
    try {
      this.noteChallenges("challenge_snapshot", {});
    } finally {
      this._inChallenges = false;
    }
  }
  noteChallenges(beat, props) {
    this.challenges = this.challenges || {};
    this.badges = this.badges || {};
    this.coins = this.coins || {};
    const now = Date.now();
    const compatibilityChanged = this._syncWhiteChallengeCompatibility(now);
    const snapshot = NG_SNAPSHOT_BEATS.has(beat) ? this._challengeSnapshot() : null;
    const advanced = ngAdvanceChallenges(
      this.challenges,
      beat,
      props || {},
      snapshot,
      now,
    );
    this.challenges = advanced.state;
    const rewards = ngRewardChanges(
      this.challenges,
      this.badges,
      this.coins,
      this._challengeRuntime,
      advanced.completed,
      beat,
      props || {},
      now,
    );
    this.badges = rewards.badges;
    this.coins = rewards.coins;
    this._challengeRuntime = rewards.runtime;
    const durableChanged =
      compatibilityChanged ||
      advanced.changed ||
      rewards.newBadges.length > 0 ||
      rewards.newCoins.length > 0;
    if (!durableChanged) return;
    this._syncWhiteChallengeCompatibility(now);
    if (this._progressLoaded) this._saveProgress();

    if (beat !== "challenge_snapshot") {
      for (const id of advanced.completed) {
        const definition = NG_CHALLENGE_BY_ID[id];
        if (!definition || definition.hidden) continue;
        this.fx("challenge_completed", {
          id,
          track: definition.track,
          progress: definition.target,
          target: definition.target,
        });
        this.track("neural_challenge_completed", {
          challenge_id: id,
          track_id: definition.track,
        });
        if (this.acknowledgeChallenge) this.acknowledgeChallenge(id);
        if (definition.track === "white") {
          this.fx("tut_step", {
            id: definition.legacyId,
            done: this.tutDoneCount(),
            of: NG_WHITE_CHALLENGES.length,
          });
        }
      }
      for (const trackId of rewards.clearedTracks) {
        this.fx("challenge_track_cleared", { track: trackId });
        this.track("neural_challenge_track_cleared", { track_id: trackId });
        if (trackId === "white") this.fx("tutorial_done", {});
      }
      for (const id of rewards.newBadges) {
        // THE AUTO-FLIP LIVES HERE AND NOWHERE ELSE (v1.105.1): flipping on the MINT (a
        // once-per-account event) means turning the toggle off later STICKS — a flip driven by
        // "belt is black" would re-enable recall on every device forever through settings LWW.
        if (id === "recall-in-play") this.set("recallInPlay", true);
        this.fx("patch_earned", { id });
        this.track("neural_patch_earned", { patch_id: id });
        if (this.queueChallengeReward) this.queueChallengeReward("patch", id);
      }
      for (const id of rewards.newCoins) {
        this.fx("coin_earned", { id });
        this.track("neural_coin_earned", { coin_id: id });
        if (this.queueChallengeReward) this.queueChallengeReward("coin", id);
      }
    }
    if (
      compatibilityChanged ||
      advanced.completed.some(
        (id) => NG_CHALLENGE_BY_ID[id] && NG_CHALLENGE_BY_ID[id].track === "white",
      )
    ) {
      this.renderTutorial();
    }
    if (this.renderChallengeCue) this.renderChallengeCue();
    if (
      this.deckShown &&
      !this._paneTransition &&
      !this._renderingChallengeView &&
      !this._paneStudyActive() &&
      this._viewMode === "challenges"
    ) {
      this.renderExplorer();
    }
  }
  tutDoneCount() { const d = (this.tut && this.tut.done) || {}; let n = 0; for (const s of this.TUTORIAL) if (d[s.id]) n++; return n; }
  tutCurrent() { const d = (this.tut && this.tut.done) || {}; for (const s of this.TUTORIAL) if (!d[s.id]) return s; return null; }
  noteTutorial(beat, props) {
    if (this._inChallenges) return;
    this._inChallenges = true;
    try {
      this.noteChallenges(beat, props || {});
    } finally {
      this._inChallenges = false;
    }
  }
  restartTutorial() {
    this.tut = { done: {} };
    this.challenges = ngResetWhiteChallenges(this.challenges);
    this.tutHidden = false;
    try { localStorage.removeItem("bjj-neural-coached"); } catch (e) {} // the coach is gone; still clear its legacy marker
    this._saveProgress();
    this.renderTutorial();
  }
  renderTutorial() {
    const cur = this.tutCurrent();
    const drop = () => { if (this._tutEl) { try { this._tutEl.remove(); } catch (e) {} this._tutEl = null; } };
    if (!cur || this.tutHidden) { drop(); return; }
    let el = this._tutEl;
    if (!el) {
      el = document.createElement("div");
      el.className = "ng-tut";
      el.setAttribute("data-tut", "1");
      (this.__ngRoot || document.body).appendChild(el);
      this._tutEl = el;
    }
    const n = this.tutDoneCount(), of = this.TUTORIAL.length;
    el.setAttribute("data-tut-step", cur.id);
    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">' +
        '<span style="font-size:9px;letter-spacing:.15em;text-transform:uppercase;font-weight:800;color:#7ee0a8;">White Challenges</span>' +
        '<span data-tut-count style="font-size:9.5px;font-weight:800;color:#9ab0e0;font-family:\'Space Grotesk\',sans-serif;">' + n + '/' + of + '</span>' +
        '<span style="flex:1;height:3px;border-radius:2px;background:rgba(150,170,210,.18);overflow:hidden;"><span style="display:block;height:100%;width:' + Math.round((n / of) * 100) + '%;background:#7ee0a8;"></span></span>' +
        '<span data-tut-hide title="Hide (Settings can bring it back)" style="cursor:pointer;font-size:14px;line-height:1;color:#7e8aa3;">×</span>' +
      '</div>' +
      '<div data-tut-copy style="font-size:11.5px;line-height:1.4;color:#dbe2f0;">' + cur.copy + '</div>';
    el.querySelector("[data-tut-hide]").addEventListener("click", () => { this.tutHidden = true; this.renderTutorial(); });
  }

  // ── THE FIRST-ROLL COACH IS DELETED (v1.104.0, owner) ──
  // A 3-panel card at top-centre (z:70) that opened over the first-ever landing. The owner, on
  // meeting it: it "shows on top and is really nasty, grabbing the attention", and step 1 said
  // "these cards are your options from this position" while pointing at nothing in particular —
  // it was a FIXED overlay at `top:92px`, not anchored to the tray it was describing. Step 2
  // ("Peek before you leap") read as being about the film-study Shorts. On a screen that already
  // carries a graph, a landing card, a question and a hand of options, a floating explainer of
  // that hand is one more thing to read, in the worst place, at the worst moment.
  //
  // Its one true claim IS verified and is worth recording: the decision clock really was frozen
  // (measured — `remaining` unchanged at 13,800ms across 12 simulated seconds, all seven `.ngbar`
  // countdowns `paused`, no auto-pick, resuming on dismiss). `_tickDecision` still freezes for
  // `_checkpoint`, which is the same rule for the same reason.
  //
  // Its three White objectives were NOT deleted with it — they were re-keyed to the actions they
  // are named for (`options_dealt`, `sheet_opened`, `land_q_shown`), so White stays at 20 and
  // "Preview a move" now needs a move actually previewed instead of a Next button pressed.
  // See challenge-definitions.src.js.
  //
  // GONE WITH IT: `_setBarsPaused`, the only thing that ever froze the CSS countdown bars. NB
  // those bars run on wall clock, so during a checkpoint quiz or a paused pane they keep draining
  // while the clock is stopped — a pre-existing desync the coach happened to be immune to. Not
  // fixed here, disclosed rather than silently inherited.
  // ── programmatic film-study open (journey rail + the sheet's auto-expand seam): expand clip
  // i of the open sheet. In test mode with no clips loaded (journeys abort the dossier payload),
  // a stub clip + synthetic card exercise the full player pipeline against the page's YT stub. ──
  watchShort(i) {
    i = i || 0;
    const panel = this.optDetailRef.current;
    let card = panel ? panel.querySelectorAll(".ng-clip")[i] : null;
    let clip = this._curClips && this._curClips[i];
    if ((!card || !clip) && this.isTest()) {
      clip = clip || { id: "stub-clip-" + i, title: "stub", start: 0, end: 20, vertical: true };
      if (!card && panel) { card = document.createElement("button"); card.className = "ng-clip"; card.style.cssText = "position:relative;width:126px;height:170px;"; panel.appendChild(card); }
    }
    if (!card || !clip) return false;
    this.expandClip(card, clip);
    // film-study first look: +4% on THIS technique the first time you watch one of its Shorts
    const ctxNode = this._detailCtx && this._detailCtx.opt && this._detailCtx.opt.node;
    if (ctxNode) {
      this._filmLook = this._filmLook || {};
      if (!this._filmLook[ctxNode.t]) {
        this._filmLook[ctxNode.t] = 1;
        this.fx("film_first_look", { technique: ctxNode.t });
        if (panel) this._pumpOdds(panel, ctxNode);
      }
    }
    return true;
  }

  // ── P3 opponent ladder: a persistent rank staked at every roll intro. Wins climb, taps drop. ──
  ladderNames() { return ["Fresh White Belt", "Tough White Belt", "Blue Belt", "Purple Belt", "Brown Belt", "Black Belt", "World-Class Black Belt"]; }
  ladderState() {
    if (!this._ladder) {
      let r = 1;
      try { const raw = localStorage.getItem("bjj-neural-ladder"); if (raw) r = Math.max(1, Math.min(this.ladderNames().length, (JSON.parse(raw) || {}).rank || 1)); } catch (e) {}
      this._ladder = { rank: r };
    }
    const names = this.ladderNames();
    return { rank: this._ladder.rank, opponent: names[Math.min(names.length, this._ladder.rank) - 1] };
  }
  ladderMove(dir) {
    const st = this.ladderState();
    const next = Math.max(1, Math.min(this.ladderNames().length, st.rank + dir));
    this._ladder.rank = next;
    this.fx(dir > 0 ? "ladder_up" : "ladder_down", { rank: next, capped: next === st.rank });
    try { localStorage.setItem("bjj-neural-ladder", JSON.stringify({ rank: next })); } catch (e) {}
  }

  // ── P3 journey recorder: capture beats + rng draws so a hand-played session can be pinned
  // into a .journey.ts replay (rig() the recorded draws back per tag). Rail-first. ──
  startRecording() { this._rec = { startedAt: this.now || 0, beat0: (this.beats || []).length, draws: [] }; }
  stopRecording() {
    const r = this._rec; if (!r) return null; this._rec = null;
    return { startedAt: r.startedAt, beats: (this.beats || []).slice(r.beat0), draws: r.draws };
  }

  // ---------- roll state machine ----------
  rollFromPosition(nodeIdx, staged, roleOverride) {
    // start a NEW roll seeded at a chosen position; the current roll is archived into Previous rolls
    // A NEW ROLL ENDS THE FILM, FIRST (v1.106.5) — before `clearTimers()` takes its step timer and
    // before this function writes the camera. `setPaused` also stops a replay, but it is called at
    // the END of this function, by which point `stopReplay`'s restore would put the PREVIOUS roll's
    // focus and camTarget back over the roll being started.
    this.stopReplay("roll");
    this.clearTimers(); this.clearOptions(); this.clearEngagement(); this._cancelCheckpoint();
    this._combo = 0; this._landPending = false; this._updateComboChip(); // fresh match, cold momentum
    let posIdx = nodeIdx;
    if (this.nodes[nodeIdx] && this.nodes[nodeIdx].ty !== "positions") {
      let p = -1; for (const k of this.adj[nodeIdx]) { if (this.nodes[k].ty === "positions") { p = k; break; } }
      posIdx = p >= 0 ? p : nodeIdx;
    }
    // a roll that never played is not a roll: restaging over it archives nothing (see _played)
    if (this._played && this.rollLog && this.rollLog.length > 1) {
      this._pastRolls = this._pastRolls || [];
      this._pastRolls.unshift({ log: this.rollLog.slice(), outcome: this._lastOutcome || "reset", ts: Date.now(), finish: this._lastFinish || null });
      if (this._pastRolls.length > 40) this._pastRolls.pop();
    }
    this._lastOutcome = null; this._lastFinish = null;
    this.rollLog = []; this._lastActor = null; this._currentDeckKey = null;
    this._sessionNodes = null; this._session = null; this._inSession = false;
    this.moveCount = 0; this.maxMoves = 9 + ((this.rng("max-moves") * 4) | 0);
    this.aiSkill = this.get("difficulty", "normal") === "off" ? 0 : 0.06 + this.rng("ai-skill") * 0.14;
    // ROLE: an explicit request wins. Deriving from the title is a CONSTANT for positions — the
    // visual layer titles all 136 of them "… Top" — which is exactly why playFrom had to set the
    // role itself, and why merging the two paths needs this parameter rather than a heuristic.
    const t = (this.nodes[posIdx].t || "");
    this.playerRole = roleOverride
      || (/\bbottom\b/i.test(t) ? "bottom" : (/\btop\b/i.test(t) ? "top" : (this.rng("role") < 0.5 ? "top" : "bottom")));
    // dual close-pair prototype: a role MEMBER node IS a side — landing on it means playing it.
    // An explicit roleOverride still wins (the comment above); member role beats title-derivation.
    // Inert on the production layout: no default graph-data node carries `role`.
    if (!roleOverride && (this.nodes[posIdx].role === "top" || this.nodes[posIdx].role === "bottom")) this.playerRole = this.nodes[posIdx].role;
    this.currentPos = posIdx; this.focusIdx = posIdx; this.pulse = null; this.activeMove = null;
    // SWAPPING BETWEEN TWO HALVES OF ONE STATE MOVES NOTHING. Both members of a pair share a
    // midpoint, so the camera's subject is literally unchanged — and the right way to guarantee
    // the owner's "the camera should move just a little" is to not touch it at all rather than to
    // recompute the same answer from a layout that is, at this instant, mid-teardown. Chasing the
    // band instead cost three wrong attempts: an undocked film strip reporting `top: 0`, a card
    // back before its film, and a fallback to the whole screen — each a different wrong frame.
    const _nextFocus = this.pairMid(this.nodes[posIdx]);
    const _sameSubject = !!this.camFocus
      && Math.abs(this.camFocus.x - _nextFocus.x) < 1e-6
      && Math.abs(this.camFocus.y - _nextFocus.y) < 1e-6;
    this.camFocus = _nextFocus;
    this.releaseCamera(); // roaming/staging elsewhere ends the focus lease (the user chose a node)
    // the SAME framing the settled follow-cam uses — a click that navigates must not land on a
    // different composition than the roll does (v1.103.2)
    // ...and aim at the PAIR (`camFocus`), not at `n.y`. This line still read the stored
    // coordinates, which `LY` lifts a member ~37px off at roll zoom — the same "code reads `n.y`
    // where the renderer draws `LY(n)`" defect v1.114.3 fixed in three other places.
    if (!_sameSubject) this.camTarget = this.rollCamTarget(this.camFocus, false, posIdx);
    this.prevPosVal = this.myVal(this.nodes[posIdx]);
    this._syncUrl(posIdx);                     // the address bar follows a chosen node
    this._lastChosenIdx = posIdx;                // …and so does "take me back where I was"                       // the address bar follows a chosen node
    this._played = false;                        // nothing counts until it runs unpaused
    this._prefetchLandDeck(posIdx);              // the flight is the deck's runway (v1.106.6)
    this.hideCenter(); this.setPaused(!!staged); // staged: land here, but hold the clock
    if (staged) this._stagedCamFree = true;      // ...and its framing tracks until they pan
    // HOLD THE FRAME UNTIL THE CARD IS BACK. `clearOptions()` above dropped the landing card and
    // the film strip, and `enterLand` rebuilds them ~600ms later on DIFFERENT frames — so between
    // here and there the layout is half-mounted and every read of it is a different wrong answer
    // (measured on a pair swap: an undocked film strip reporting `top: 0`, then a card without its
    // film, then the real band — the camera chasing all three). The target written on the line
    // below is computed from the cached band and is already right; nothing after it has anything
    // truer to say until the card exists again.
    this._reframeHold = !!staged;

    this.flare(posIdx);
    this.after(0.6, () => this.enterLand(true), true);
  }
  // ── ROAM & STAGE ── clicking any node takes you there and STAGES a roll: the camera flies,
  // the state lands, the options deal — and the clock stays stopped. Click somewhere else and
  // you restage the same non-session; it never played, so there is nothing to archive, no
  // stake on the ladder, no counter moved. Press play and only then does the roll begin.
  stageRollAt(nodeIdx) {
    this.rollFromPosition(nodeIdx, true);
    this._staged = this.currentPos;
    this.fx("roll_staged", { position: this.nodes[this.currentPos] ? this.nodes[this.currentPos].t : null });
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // REPLAY — THE FILM OF A ROLL YOU ALREADY ROLLED (v1.106.5)
  //
  // Owner: "History should have a play from here and a replay button indeed." The camera walks
  // the archived exchanges in order — fly to a state, sweep the edge to the technique and on to
  // where it landed you, announcer line per beat — which is what watching film of your own roll
  // looks like. Four rules make it a FILM rather than a second way to play:
  //
  //   1. IT CREDITS NOTHING. No grade, no stage, no srs, no score, no combo, no challenge
  //      evidence — its beats deliberately bypass `fx()` (see `_replayBeat`). Watching is not
  //      doing, and a progress number that moved because you watched a recording would be a lie.
  //   2. THE CLOCK IS HELD THROUGHOUT, on its own latch (`_replayAutoPaused`, the pane/dossier/
  //      More pattern) — so stopping the film gives back only a pause the film itself took.
  //   3. ANY REAL INPUT CANCELS IT. Pan, pinch, wheel, a tap on the graph, Esc, or pressing play:
  //      never fight the user's camera, and never make them wait out a recording.
  //   4. IT NEVER TOUCHES THE PANE (pane law). On a phone the drawer IS the screen, so closing it
  //      is how you watch — and closing it hands the pause latch over instead of resuming, the
  //      same way a mobile share arrival keeps its lit class when the drawer goes away.
  //
  // Everything it borrows from the live roll — pulse, trail, activeMove, focusIdx, camFocus,
  // camTarget, the one announcer slot — is snapshotted at the start and handed back on stop.
  // It replays ONLY what is already in the in-memory roll log; nothing is persisted for it.
  // ══════════════════════════════════════════════════════════════════════════════════════
  _reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  }
  /** The one announcer slot, saved and put back — a film borrows it, it does not own it. */
  _evSnapshot() {
    const k = this.evKickerRef.current, t = this.evTextRef.current, box = this.evRef.current;
    return { k: k ? k.textContent : "", col: k ? k.style.color : "", html: t ? t.innerHTML : "", op: box ? box.style.opacity : "" };
  }
  _restoreEvent(s) {
    if (!s) return;
    const k = this.evKickerRef.current, t = this.evTextRef.current, box = this.evRef.current;
    if (k) { k.textContent = s.k; k.style.color = s.col; }
    if (t) t.innerHTML = s.html;
    if (box) box.style.opacity = s.op;
  }
  /**
   * A film's beats are OBSERVABLE but they are not `fx()`. `fx()` is the challenge-evidence seam
   * (and the sound catalog's): every beat through it is offered to `noteChallenges`, which is
   * exactly what a replay must never reach. So this pushes onto the same `this.beats` stream every
   * journey reads and stops there. Analytics — which is allowed to know a film was watched — is
   * one `track()` at the start.
   */
  _replayBeat(beat, props) {
    (this.beats = this.beats || []).push(Object.assign({ t: this.now || 0, beat: beat }, props || {}));
    if (this.beats.length > 4000) this.beats.splice(0, 1000);
  }
  replayLabel(roll) {
    const log = (roll && roll.log) || [];
    const a = log[0], b = log[log.length - 1];
    return (a ? a.name : "?") + " → " + (b ? b.name : "?");
  }
  /**
   * PURE: an archived roll -> the ordered beats of its film. One `land` per state, one `sweep` per
   * exchange that recorded its edge (`via`, written by enterLand), and a closing `finish` when the
   * roll ended on a technique — a finish produces no landing, so without that step the film of a
   * won roll would stop one beat short of the thing the roll was for.
   */
  replaySteps(roll) {
    const log = (roll && roll.log) || [];
    const steps = [];
    for (let i = 0; i < log.length; i++) {
      const h = log[i];
      if (h.idx == null || !this.nodes[h.idx]) continue;
      if (i > 0 && h.via && h.via.idx != null && this.nodes[h.via.idx]) {
        const prev = (h.from != null && this.nodes[h.from]) ? h.from : log[i - 1].idx;
        if (prev != null && this.nodes[prev]) {
          steps.push({
            kind: "sweep", from: prev, via: h.via.idx, to: h.idx,
            actor: h.via.actor || "you", escape: h.via.kind === "escape",
            name: h.via.name || this.nodes[h.via.idx].t,
          });
        }
      }
      steps.push({ kind: "land", to: h.idx, name: h.name, role: h.role, first: i === 0 });
    }
    const fin = roll && roll.finish;
    if (fin && fin.idx != null && this.nodes[fin.idx]) {
      const last = log.length ? log[log.length - 1].idx : null;
      if (last != null && this.nodes[last]) {
        steps.push({ kind: "finish", from: last, via: fin.idx, name: fin.name || this.nodes[fin.idx].t, outcome: roll.outcome || null });
      }
    }
    // THE ESTABLISHING SHOT IS A STEP, NOT A FLOURISH BEFORE ONE. The film opens on the WHOLE roll
    // — every state and technique it passed through, framed at once — and then walks it: film
    // language, and load-bearing. The camera starts wherever the paused roll left it, at ROLL_ZOOM,
    // which can be the far side of the graph, and it EASES (tau ~0.5s). Aiming wide and stepping in
    // the same tick simply overwrites the wide target, so the opening beat spent its whole second
    // flying with its own state off screen — measured, intermittently, before this was a step with
    // a duration of its own. A wide frame contains the first state by construction.
    if (steps.length) {
      const all = [];
      for (const st of steps) for (const k of [st.from, st.via, st.to]) if (k != null && all.indexOf(k) < 0) all.push(k);
      if (all.length) steps.unshift({ kind: "wide", nodes: all, name: this.replayLabel(roll) });
    }
    return steps;
  }
  /**
   * How long `updateTravel` will take over this path — the SAME arithmetic, because the film's
   * step timer is what advances to the next beat and a step that fires early would cut its own
   * sweep in half. (Travel is driven by the render loop; the timer only decides when to move on.)
   */
  _travelDur(path) {
    const speedMul = this.cfg().signalSpeed || 1;
    const speed = 175 * speedMul, minSeg = 0.6 / speedMul;
    let t = this.anim("edgeAnticipation", true) ? 0.38 : 0;
    for (let i = 0; i + 1 < path.length; i++) {
      const a = this.nodes[path[i]], b = this.nodes[path[i + 1]];
      if (!a || !b) continue;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      t += Math.max(minSeg, len / speed);
    }
    return t;
  }
  /**
   * Frame one beat. A single node gets the composition the roll itself settles into
   * (`rollCamTarget` — label centred in the free band); an exchange gets all of its nodes fitted
   * on BOTH axes, `frameNodes`' rule, or a tall sweep hangs off a 390x844 phone. Both are then
   * shifted for an OPEN pane exactly like `locateNode`: on desktop the film plays beside a pane
   * the user may legitimately have left open, and the visible region is not the viewport.
   */
  _replayFrame(idxs) {
    const ns = (idxs || []).map((i) => this.nodes[i]).filter(Boolean);
    if (!ns.length) return null;
    const W = this.W || 1200;
    const sbW = (this.deckShown ? 1 : 0) * this.sbOffset();
    if (ns.length === 1) {
      const t = this.rollCamTarget({ x: ns[0].x, y: ns[0].y }, false, ns[0].idx);
      return { cx: t.cx - (sbW / 2) * (t.vw / W), cy: t.cy, vw: t.vw };
    }
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const n of ns) { minx = Math.min(minx, n.x); maxx = Math.max(maxx, n.x); miny = Math.min(miny, n.y); maxy = Math.max(maxy, n.y); }
    const aspect = (this.H || 1) / W;
    const need = Math.max((maxx - minx) * 2.4, aspect > 0 ? ((maxy - miny) * 2.4) / aspect : 0);
    const vw = Math.max(this.graphW * 0.16, need);
    return { cx: (minx + maxx) / 2 - (sbW / 2) * (vw / W), cy: (miny + maxy) / 2, vw: vw };
  }
  /** Point the camera at a beat and TAKE the lease for its duration (never longer — the roll must
   *  get its camera back the moment the film is over). Under reduced motion the camera SNAPS. */
  _replayAim(idxs, sec) {
    const t = this._replayFrame(idxs); if (!t || !this.cam) return;
    this.camTarget = { cx: t.cx, cy: t.cy, vw: t.vw };
    this.holdCamera(Math.max(1, (sec || 1) + 0.5));
    if (this._replay && this._replay.reduced) {
      this.cam.cx = t.cx; this.cam.cy = t.cy; this.cam.vw = t.vw; this.cam.lvw = Math.log(t.vw);
    }
  }
  startReplay(roll, opts) {
    if (!roll || !this.nodes) return false;
    const steps = this.replaySteps(roll);
    if (!steps.length) return false;
    this.stopReplay("restart");                       // one film at a time
    const reduced = this._reducedMotion();
    this._replay = {
      roll: roll, steps: steps, i: -1, done: false, timer: null, reduced: reduced,
      id: (opts && opts.id) || roll.ts || Date.now(),
      label: (opts && opts.label) || this.replayLabel(roll),
      keep: {
        pulse: this.pulse, activeMove: this.activeMove, trail: (this.trail || []).slice(),
        focusIdx: this.focusIdx,
        camFocus: this.camFocus ? { x: this.camFocus.x, y: this.camFocus.y } : null,
        camTarget: this.camTarget ? { cx: this.camTarget.cx, cy: this.camTarget.cy, vw: this.camTarget.vw } : null,
        ev: this._evSnapshot(),
      },
    };
    if (!this.paused) { this._replayAutoPaused = true; this.setPaused(true); }
    this.pulse = null; this.activeMove = null;        // the live roll's own travel is parked, not advanced
    this._suppressTray(true);                          // a hand you are not playing, and a card about a state you are not in
    this.track("neural_roll_replayed", { states: ((roll.log || []).length), steps: steps.length, outcome: roll.outcome || null });
    this._replayBeat("roll_replay_start", { states: ((roll.log || []).length), steps: steps.length, outcome: roll.outcome || null, reduced: reduced });
    this._renderReplayBar();
    this._replayRefreshRows();
    this._replayStep();
    return true;
  }
  _replayStep() {
    const R = this._replay; if (!R) return;
    R.i++;
    if (R.i >= R.steps.length) {
      R.done = true;
      this._renderReplayBar();
      R.timer = this.after(1.6, () => this.stopReplay("ended"), true);   // hold the last frame, then hand back
      return;
    }
    const s = R.steps[R.i];
    let dur;
    if (s.kind === "wide") {
      dur = R.reduced ? 0.8 : 1.4;
      this._replayAim(s.nodes, dur);
      this.setEvent("Replay", s.name, "info");
      for (const k of s.nodes) this.flare(k);
    } else if (s.kind === "land") {
      dur = R.reduced ? 0.85 : 1.15;
      this.focusIdx = s.to;
      const n = this.nodes[s.to];
      this.camFocus = { x: n.x, y: n.y };
      this.flare(s.to);
      this._replayAim([s.to], dur);
      // the announcer names the beat in the PAST tense — this already happened, you are watching it
      this.setEvent((s.first ? "Roll opened · " : "Landed · ") + (s.role || ""), s.name || n.t, "info");
    } else {
      const path = s.kind === "finish" ? [s.from, s.via] : [s.from, s.via, s.to];
      const you = s.actor !== "opp";
      // ONE SUBJECT PER LABEL (v1.104.1): the announcer names WHO INITIATED, the graph verb names
      // YOUR posture toward that move. A film must not invent a third voice.
      const kicker = s.kind === "finish"
        ? (s.outcome === "win" ? "Finished with" : "Tapped to")
        : (s.escape ? "You escaped" : (you ? "You went for" : "Opponent went for"));
      const verb = s.escape ? "Escaping" : (you ? "Attacking" : "Defending");
      const col = s.escape ? { r: 126, g: 224, b: 168 } : (you ? { r: 94, g: 149, b: 255 } : { r: 255, g: 140, b: 100 });
      this.setEvent(kicker, s.name, s.kind === "finish" ? (s.outcome === "win" ? "good" : "bad") : (you ? "info" : "bad"));
      this.activeMove = { idx: s.via, verb: verb, col: col };
      this.focusIdx = s.via;
      if (R.reduced) {
        // DISCRETE, per prefers-reduced-motion: no travel, no easing — the beat simply IS the
        // next state, lit, with its line said.
        dur = 1.0;
        this.flare(s.via); if (s.to != null) this.flare(s.to);
        const nv = this.nodes[s.to != null ? s.to : s.via];
        if (nv) this.camFocus = { x: nv.x, y: nv.y };
        this._replayAim(path.concat(s.to != null ? [s.to] : []), dur);
      } else {
        dur = this._travelDur(path) + 0.45;
        this._replayAim(path, dur);
        this.startTravel(path);                        // no onArrive: the film's own timer advances it
      }
    }
    this._renderReplayBar();
    R.timer = this.after(dur, () => this._replayStep(), true);   // ignorePause: the clock is held BY the film
  }
  stopReplay(reason) {
    const R = this._replay; if (!R) return false;
    this._replay = null;
    this._cancelTimer(R.timer);
    this.pulse = R.keep.pulse; this.activeMove = R.keep.activeMove;
    this.trail = R.keep.trail; this.focusIdx = R.keep.focusIdx;
    if (R.keep.camFocus) this.camFocus = R.keep.camFocus;
    this.releaseCamera();                              // the film's lease dies with the film
    if (R.keep.camTarget && this.camTarget) { this.camTarget.cx = R.keep.camTarget.cx; this.camTarget.cy = R.keep.camTarget.cy; this.camTarget.vw = R.keep.camTarget.vw; }
    this._restoreEvent(R.keep.ev);
    this._suppressTray(false);
    // `_suppressTray(false)` un-hides the landing card too — but the PANE's own suppression is not
    // ours to lift: on desktop the pane can be open behind the film, and it stands the card down
    // by its own rule (v1.101.7).
    if (this._landPaneHid) this._suppressLand(true);
    this._clearReplayBar();
    if (this._replayAutoPaused) { this._replayAutoPaused = false; this.setPaused(false); }
    this._replayBeat("roll_replay_end", { reason: reason || "stopped", step: Math.max(0, R.i), steps: R.steps.length });
    this._replayRefreshRows();
    return true;
  }
  /** The History rows show which roll is playing, so the ⟲ that started it can offer to stop it. */
  _replayRefreshRows() {
    if (this.deckShown && this._viewMode === "history" && this._drillView === "home" && !this._paneStudyActive()) this.renderDrillHome();
  }
  /**
   * THE FILM'S OWN CHROME — z:8, the AMBIENT STATE band of the Z LADDER (helmet.html), beside the
   * landing card (5) and the momentum chip (6) it plays over, and deliberately NOT in the 90-99
   * deliberate-screen band: a replay is a state you are in, not a screen you asked for, and it
   * must never take the input the way a modal scrim does.
   *
   * It docks where the LANDING CARD docks — via `_dockLandCard`, the same measured tray clearance —
   * because that is exactly the surface it stands in for: the card that names the state you are
   * standing in, replaced for the duration by the strip that names the roll you are watching.
   */
  _renderReplayBar() {
    const R = this._replay;
    if (!R) { this._clearReplayBar(); return; }
    let el = this._replayEl;
    if (!el) {
      el = document.createElement("div");
      el.className = "ng-replaybar";
      el.setAttribute("data-replay-bar", "1");
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.innerHTML =
        '<span class="ng-replay-dot" aria-hidden="true"></span>' +
        '<span class="ng-replay-txt"><b>REPLAY</b><small data-replay-label></small></span>' +
        '<button type="button" class="ng-replay-stop" data-replay-stop="1" aria-label="Stop replay">✕</button>';
      (this.__ngRoot || document.body).appendChild(el);
      el.querySelector("[data-replay-stop]").addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); this.stopReplay("stopped"); });
      this._replayEl = el;
    }
    const lab = el.querySelector("[data-replay-label]");
    const n = R.steps.length, at = Math.min(n, Math.max(1, R.i + 1));
    if (lab) lab.textContent = R.label + (R.done ? " · end" : " · " + at + "/" + n);
    el.setAttribute("data-replay-step", String(at));
    requestAnimationFrame(() => { if (this._replayEl) this._dockLandCard(this._replayEl); });
  }
  _clearReplayBar() {
    if (!this._replayEl) return;
    try { this._replayEl.remove(); } catch (e) { /* noop */ }
    this._replayEl = null;
  }
  // ── FIRST IMPRESSION: REAL TRAFFIC, NOT A UNIFORM LOTTERY ──
  // Share of real roll traffic per playable position, read off the SAME stationary distribution
  // Game Knowledge is built on. `curriculum.weights` is keyed "<technique>|Attacker" (exactly the
  // deck key `nodeForKey` resolves), each technique node carries exactly ONE canonical origin
  // (`fromPositionId`), and a position's attempt probabilities sum to 100 — so summing a
  // position's techniques recovers that position's own visit mass. Result: 136 entries summing to
  // 1, heaviest Side Control .115 / Half Guard .105 / Closed Guard .084 / Mount .059.
  //
  // NB there are TWO position-traffic distributions in this repo and they are NOT the same number.
  // `graphAdjacency v2` (trainingData.ts, for the legacy trainer) prints closed-guard .196 /
  // standing .152 / side-control .109 — that is 85% stationary with a RESTART_ANCHORS teleport into
  // standing + closed guard, blended 15% with a hand-authored FUNDAMENTALS table. It concentrates
  // harder, and it is the distribution the cold-start diagnosis quoted. We use `curriculum.weights`
  // because it is ALREADY on the Neural payload path (curriculum.json, loaded anyway) — reaching for
  // graphAdjacency would mean either a new cold-path fetch on the very journey that is trying to
  // shed bytes, or re-implementing that editorial table in Python. START_BIAS.gamma closes the gap:
  // the measured six-hub share lands ~.66, i.e. graphAdjacency's own .672, from the leaner input.
  startPosTraffic() {
    if (this._posTraffic) return this._posTraffic;
    const w = (this.curriculum && this.curriculum.weights) || null;
    const out = {};
    if (w && this.nodes && this._posSlugIndex) {
      for (const k in w) {
        const ti = this.nodeForKey(k); if (ti < 0) continue;
        const pid = this.nodes[ti].fromPositionId; if (!pid) continue;
        const pi = this._posSlugIndex.get(String(pid).toLowerCase());
        if (pi == null) continue;
        out[pi] = (out[pi] || 0) + w[k];
      }
    }
    // Do NOT memoise an empty table. curriculum.json is a separate fetch, and on the slow cold
    // load this exists for it could still be in flight at the first draw — caching {} there would
    // pin the uniform fallback for the whole session, silently reinstating the bug on exactly the
    // connections that suffer from it most.
    for (const k in out) return (this._posTraffic = out);
    return out;
  }
  // gamma SHARPENS that distribution, because the goal is not to reproduce mid-roll traffic — it
  // is to open on a state the newcomer can NAME. At 1.5, ~2/3 of first impressions land on the six
  // hubs (closed guard / standing / side control / half guard / open guard / mount) and ~90% inside
  // the twenty most-travelled, while ~17 states stay genuinely likely. `floor` mixes uniform back
  // in so all 136 keep a real chance: the draw is BIASED, never NARROWED, and never repetitive.
  get START_BIAS() { return { gamma: 1.5, floor: 0.02 }; }
  // Returns {idx, weighted} — `weighted:false` means the traffic table was not there yet and this is
  // the historical uniform pick. The CALLER needs to know, because a degraded draw must not be
  // allowed to spend the once-per-visitor first impression (see startRoll).
  _weightedStart(pool, u) {
    const tw = this.startPosTraffic(), B = this.START_BIAS;
    const p = new Array(pool.length); let total = 0;
    for (let i = 0; i < pool.length; i++) { const v = Math.pow(Math.max(0, tw[pool[i]] || 0), B.gamma); p[i] = v; total += v; }
    if (!(total > 0)) return { idx: pool[(u * pool.length) | 0], weighted: false }; // no curriculum payload → historical uniform draw
    const flat = B.floor / pool.length;
    let acc = 0;
    for (let i = 0; i < pool.length; i++) {
      acc += (1 - B.floor) * (p[i] / total) + flat;
      if (u < acc) return { idx: pool[i], weighted: true };
    }
    return { idx: pool[pool.length - 1], weighted: true }; // float slack at u→1
  }
  startRoll() {
    this.stopReplay("roll");   // a new roll ends the film first (see rollFromPosition)
    this.clearTimers(); this.clearOptions(); this.clearEngagement();
    this._beltTest = null; // a fresh normal roll is never a belt test (manual reset = clean cancel, no attempt burned)
    this._cancelCheckpoint(); // and never a stale checkpoint quiz
    this._combo = 0; this._landPending = false; this._updateComboChip(); // momentum is per-MATCH: a new roll starts cold
    this.track("neural_roll_started", {});
    // archive the roll that just ended so the sidebar can show "Previous roll / Today / Yesterday"
    // — but only if it ever actually played (a staged roam is not a roll; see _played)
    if (this._played && this.rollLog && this.rollLog.length > 1) {
      this._pastRolls = this._pastRolls || [];
      this._pastRolls.unshift({ log: this.rollLog.slice(), outcome: this._lastOutcome || "reset", ts: Date.now(), finish: this._lastFinish || null });
      if (this._pastRolls.length > 40) this._pastRolls.pop();
    }
    this._lastOutcome = null; this._lastFinish = null;
    this.rollLog = []; this._lastActor = null;
    this._sessionNodes = null; this._session = null; this._inSession = false;
    this.moveCount = 0; this.maxMoves = 9 + ((this.rng("max-moves") * 4) | 0);
    this.playerRole = this.rng("role") < 0.5 ? "top" : "bottom"; // you start either side
    this.aiSkill = this.get("difficulty", "normal") === "off" ? 0 : 0.06 + this.rng("ai-skill") * 0.14; // opponent resistance, gated by difficulty
    // random starting position
    const positions = this._posIdx || (this._posIdx = this.nodes.filter((n) => n.ty === "positions" && this.adj[n.idx].some((k) => this.nodes[k].ty !== "positions")).map((n) => n.idx));
    if (!positions.length) { console.error("[neural] no playable position nodes"); this._fallbackToLegacy(); return; } // degenerate graph → don't crash in a timer
    if (this._rigStart != null && this.nodes[this._rigStart]) { // test rail: deterministic start
      this.currentPos = this._rigStart; this._rigStart = null; this._firstRollDone = true;
    } else
    // FIRST-EVER ROLL: bias the opening state toward one a newcomer might have a NAME for.
    // The `withDeck` filter this replaces was meant to do that and was a NO-OP — all 136 playable
    // positions carry a deck — so the opening was drawn uniformly and ~95% of first impressions
    // opened on Gogoplata Control / Estima Lock Control / Hindulotine / Shoulder of Justice, under
    // a running clock, with the heavy content payloads still ~20s out. ONE draw off the SAME rng
    // tag, so rigged replays are structurally untouched; only a fresh profile takes this branch, and
    // it takes it once a weighted draw has actually been GIVEN (see the marker note below).
    if (!this._firstRollDone) {
      const u = this.rng("start-pos");
      // owed OUTRANKS the other markers: coach-finished and progress-saved are written by ordinary
      // play in the same visit as a degraded draw, and neither is evidence of an opening given.
      const fresh = this._firstImpressionOwed() || !this._returningVisitor();
      let weighted = false;
      if (fresh) { const d = this._weightedStart(positions, u); this.currentPos = d.idx; weighted = d.weighted; }
      else this.currentPos = positions[(u * positions.length) | 0];
      // ── A FIRST IMPRESSION IS ONLY SPENT WHEN IT WAS ACTUALLY GIVEN ──
      // curriculum.json is a separate background fetch, so on the slow connection this bias exists FOR
      // it can still be in flight at this very draw, and `_weightedStart` then correctly degrades to
      // the historical uniform pick. Marking the visitor as having had their first roll THERE latched
      // that degradation for ever: the newcomer with the worst link — the one the bias helps most —
      // would get the old ~95%-unnameable opening on this visit and on every visit after it, because
      // `bjj-neural-firstroll` makes them a returning player. So "given" is written only when a
      // weighted draw really happened, and the branch stays ARMED in-session otherwise: the next roll
      // after curriculum.json lands takes the biased draw. Either way exactly ONE `start-pos` value is
      // consumed, so rigged replays are structurally identical.
      // A degraded draw writes "owed" INSTEAD — durably, because the visitor may not come back in this
      // session, and by then the coach and the first save have made them look like a returning player
      // (see _firstImpressionOwed). "owed" is what makes the debt survive that.
      this._firstRollDone = !fresh || weighted;
      if (fresh) { try { localStorage.setItem("bjj-neural-firstroll", weighted ? "1" : "owed"); } catch (e) { /* private mode */ } }
    } else {
      this.currentPos = positions[(this.rng("start-pos") * positions.length) | 0];
    }
    this._prefetchLandDeck(this.currentPos); // the intro is the deck's runway (v1.106.6)
    const lad = this.ladderState();
    this.fx("stakes", { rank: lad.rank, opponent: lad.opponent });
    this.showCenter("Restarting the roll", this.posFamily(this.nodes[this.currentPos].t), this.roleLabel() + " \u00b7 vs " + lad.opponent, "muted", true);
    this.focusIdx = this.currentPos; this.pulse = null;
    this.camFocus = this.pairMid(this.nodes[this.currentPos]);
    this.prevPosVal = this.myVal(this.nodes[this.currentPos]);
    this._played = false;
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
    this._flushLandSkipDebt(); // a new arrival settles the previous landing's deferred verdict
    this._prefetchLandDeck(this.currentPos); // idempotent; covers outcome landings' render window
    this._qMod = 0; // a new arrival forgives the last exchange's wrong answer
    this.fx("land", { position: pos ? pos.t : null, first: !!first });
    if (!first) this.decaySharp(); // sharpness fades as the roll moves on
    if (this._beltTest) this.setEvent("Content capstone", Math.max(0, (this.maxMoves || 0) - (this.moveCount || 0)) + " moves left", "info");
    this.focusIdx = this.currentPos; this.pulse = null;
    this._settleT = this.now;
    this.activeMove = null;
    this.hideCenter(); // clear the "Restarting the roll" center toast as play begins
    // THE LANDING IS the arrival, so it carries the arrival bloom (v1.114.0). This re-flare fires
    // AFTER updateTravel's, on the same node — without the amplitude here it would immediately
    // demote the destination's bloom back to a pass-through's and restart its decay, i.e. the
    // owner's "grow 50-100% more" would be visible for one frame and then undone.
    this.flare(this.currentPos, this.ARRIVE_BLOOM);
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
      // the EDGE that produced this landing (v1.106.5) — the technique node the exchange
      // travelled over, plus who performed it. The replay walks these; nothing else reads them.
      let viaInfo = null;
      if (intent && intent.via != null && this.nodes[intent.via]) {
        const vnode = this.nodes[intent.via];
        viaInfo = { idx: intent.via, name: vnode.t, ty: vnode.ty, actor: intent.actor || "you", kind: intent.kind || null };
      }
      this.rollLog.push({ key: hkey, name: this.posFamily(pos.t), role: this.roleLabel(), idx: this.currentPos, actor: first ? "start" : (this._lastActor || "you"), val: this.signedVal(pos), intend: intendInfo, via: viaInfo, from: prevLatest >= 0 ? this.rollLog[prevLatest].idx : null });
      if (this.rollLog.length > 24) this.rollLog.shift();

    }
    // carry the open current-state box forward to the new latest row (also opens it after a "roll from here")
    if (wasLatestOpen) { const L = this.rollLog.length - 1; this._openRow = "c" + L; this._focusRow = "c" + L; }
    // PANE LAW: a new roll NEVER opens the pane. If the user already has it open, focus the
    // seeded state's row so what they are reading follows the roll; otherwise leave it shut.
    if (first && this._openSidebarOnLand) {
      this._openSidebarOnLand = false;
      if (this.deckOpen) {
        const L = this.rollLog.length - 1;
        this._openRow = "c" + L; this._focusRow = "c" + L;
        this._drillView = "home"; this.deck = null; this._studyOpen = null;
      }
    }
    this._openLatestOnLand = false;
    this._lastActor = null;
    this.buildDrillPanel(this.currentPos);
    const opts = this.optionsFor(this.currentPos);
    if (!opts.length) { this.after(1.0, () => this.startRoll()); return; }
    this.optionIdxs = opts.map((o) => o.idx);
    this.fx("options_dealt", { count: opts.length });
    // WARM THE NEIGHBOURHOOD (v1.80.4) — one macrotask LATER, so it cannot compete with drawing
    // the hand. These are the decks the player is about to need: this state's own, and one per
    // option card (the JIT drill behind each option, and the landing question wherever they go
    // next), ~6KB each. Deferring by a tick is not cosmetic: fired inline, these fetches were on
    // the bytes-to-first-hand bill and delayed the very cards they exist to support.
    //
    // ── THE HAND UNCAPPED; THIS DID NOT (v1.123.0) ────────────────────────────────────────────
    // The deferral above is one macrotask, and `payload-first-hand.spec.ts` freezes its request
    // set when `[data-tech]` attaches — a Playwright poll, which resolves well after that tick —
    // so these fetches ARE on the first-hand bill and its own report proves it (five
    // flashcards/*.json rows in its heaviest-15). Warming every card of an uncapped hand costs
    // +15,819 B gzip on the AVERAGE first visit against 7,050 B of headroom, and 46.6% of real
    // first draws land on a hand whose delta alone exceeds it. So the warm-up takes the hand's
    // FIRST `NG_PREFETCH_CAP` cards — the tray is ranked by EDGE, so those are the likeliest
    // picks — and everything below hydrates on demand through the "Loading this state's cards…"
    // path that already serves every cold deck in the app. Today's payload is unchanged to the
    // byte, because ten is what the hand used to be.
    setTimeout(() => {
      this.hydrateDecks(
        [this.deckKeyFor(this.nodes[this.currentPos]).key].concat(
          opts.slice(0, NG_PREFETCH_CAP).map((o) => (o.node ? this.deckKeyFor(o.node).key : null)).filter(Boolean),
        ),
      );
    }, 0);
    this.startLandRipple(this.currentPos, this.optionIdxs);
    // ── THE CLOCK STOPS SCALING WITH THE HAND (v1.123.0) ──────────────────────────────────────
    // It was `base + 0.8*(n-1)`: fine while n was capped at 10, absurd the moment it is not —
    // measured, standing-position/top deals 34 cards, which bought a 35.4-SECOND turn. Time to
    // choose does not grow linearly with the alternatives; Hick's law says it grows with their
    // LOG, and this tray is ranked best-first, so the cards past the fold are scanned rather than
    // weighed. Below the knee nothing changes at all — every hand in the corpus today keeps its
    // exact clock — and beyond it each DOUBLING of the hand buys NG_DECISION_K seconds. The two
    // branches meet exactly at the knee, so there is no step. Worst case: 35.4s -> 20.1s.
    const base = this.get("decisionSec", 9);
    const n = opts.length;
    const dsec = n <= NG_DECISION_KNEE
      ? base + (n - 1) * 0.8
      : base + (NG_DECISION_KNEE - 1) * 0.8 + NG_DECISION_K * Math.log2(n / NG_DECISION_KNEE);
    this._decisionDsec = dsec;
    this._armDeckExpire();
    const el = this.optionsRef.current; if (el) el.innerHTML = "";
    let picked = false;
    const pick = (opt) => { if (picked) return; picked = true; this._optPick = null; this._optList = null; this._decision = null; this.clearTimers(); this.clearOptions(); this.enterAttempt(opt); };
    for (let i = 0; i < opts.length; i++) el.appendChild(this.buildOptionCard(opts[i], pick, dsec, i + 1));
    if (el) el.style.pointerEvents = "auto";
    this._optPick = pick; this._optList = opts;
    // the decision CLOCK (gdt-driven in _tick, so sheets/pauses freeze it): narrated 3-2-1
    // expiry + a visible auto-pick pop — never a silent teleport. Drilling refunds time (cap 2).
    this._decision = { remaining: dsec * 1000, total: dsec * 1000, refunds: 0, warned: 0, pick: pick, opts: opts };
    this._barF = null;   // a new hand's bars start full, and the first tick must actually write
    this.setBeacon("options", el); // beat beacon: your move — read the hand
    this.renderLandCard(pos, "land", null); // identity → film → ONE question, above the hand
    this._reframeHold = false;              // the card is back — the band means something again
    this.renderTutorial();
    this._sayArrivalIfPending(); // the shared-link sentence, now that there is a screen to read it on
  }

  decisionRemaining() { return this._decision ? Math.max(0, this._decision.remaining / 1000) : 0; }
  // drilling buys time — a real tempo decision. +2.5s per graded card, hard cap 2 per window.
  refundDecision(ms) {
    const d = this._decision; if (!d) return false;
    const granted = d.refunds < 2;
    if (granted) { d.refunds++; d.remaining += ms; }
    this.fx("timer_refund", { granted: granted });
    return granted;
  }
  _tickDecision(gdt) {
    const d = this._decision;
    if (!d || !this._optPick || this._checkpoint) return; // Q002: the checkpoint quiz is untimed — nobody reads new UI under a timer they don't understand yet; without this guard the roll auto-played UNDER the open quiz and clobbered it
    d.remaining -= gdt * 1000;
    if (d.total) {
      const f = Math.max(0, Math.min(1, d.remaining / d.total));
      if (Math.abs(f - (this._barF == null ? -1 : this._barF)) > 0.002) {
        this._barF = f;
        for (const oc of (this._optionCards || [])) {
          if (oc.bar) oc.bar.style.transform = "scaleX(" + f.toFixed(4) + ")";
        }
      }
    }
    if (this._vignetteEl && d.total) { // defense heartbeat: 60 → 100bpm as the window drains
      const f = Math.max(0, Math.min(1, d.remaining / d.total));
      this._vignetteEl.style.animationDuration = (0.6 + 0.4 * f).toFixed(2) + "s";
    }
    const secLeft = Math.ceil(d.remaining / 1000);
    if (d.remaining > 0 && secLeft <= 3 && d.warned !== secLeft) {
      d.warned = secLeft;
      this.fx("expiry_warning", { seconds: secLeft });
      this.setEvent("Decide", secLeft + "\u2026", "bad");
    }
    if (d.remaining <= 0) {
      if (d.onExpire) { this._decision = null; d.onExpire(); return; } // defense window: expiry = tapped
      const opts = d.opts, pick = d.pick;
      this._decision = null;
      this.fx("auto_pick", {});
      let pool = []; for (const o of opts) { const w = Math.max(0.12, 0.5 + o.node.dom); for (let i = 0; i < Math.round(w * 10); i++) pool.push(o); }
      const chosen = pool[(this.rng("auto-pick") * pool.length) | 0] || opts[0];
      this.flare(chosen.idx); // the pop: the position moves on, visibly
      this.setEvent("Time's up", "The position moves on \u2014 " + this.splitName(chosen.node.t).main, "bad");
      pick(chosen);
    }
  }

  enterAttempt(opt) {
    // THE OPTION HAND IS NEVER UNDER AN OPEN MENU (v1.99.5). Capture never stops the clock, so
    // a picker opened from an option card can still be up when the decision resolves — and at
    // z:90 it would sit over the tray that is about to be re-dealt.
    if (this._pickEl) this.closeListPicker();
    this._flushLandSkipDebt(); // committing ends the landing — an unasked question is a real skip now
    // committing past an unanswered question is IGNORING it — momentum demands engagement
    // (owner's rule: wrong or ignored breaks; a landing that asked nothing carries)
    // the beat is emitted BEFORE the break because _breakCombo clears _landPending — and it fires
    // even at combo 0 (where _breakCombo is a silent no-op), so an ignored question is never invisible
    if (this._landPending) { this.fx("land_q_ignored", { deckKey: (this._landQ && this._landQ.key) || null }); this._breakCombo("ignored"); }
    const act = this.nodes[opt.idx];
    this.fx("commit", { technique: act.t });
    this.track("neural_move_picked", { technique: act.t, node_type: act.ty });
    // `via` IS THE EDGE, AND A REPLAY CANNOT BE RECONSTRUCTED WITHOUT IT (v1.106.5). The roll log
    // records the STATES you passed through; a film of the roll has to show HOW — which technique
    // node the exchange travelled over. That fact exists only here, at the moment of the commit,
    // so it rides the pending-intent seam the "you aimed for" line already uses and `enterLand`
    // copies it onto the landing it produces. In-memory only: `rollLog` has never persisted
    // across a reload and this does not change that.
    this._pendingIntent = { actor: "you", idx: opt.res >= 0 ? opt.res : opt.idx, via: opt.idx };
    // ONE SUBJECT PER LABEL (v1.104.1, owner). The announcer names WHO IS INITIATING; the graph
    // verb names YOUR posture toward that move. They used to have different subjects and
    // contradict each other on screen — "OPPONENT DEFENDS Crucifix Maintenance" over a graph
    // reading "DEFENDING Crucifix Maintenance", for a move the opponent was going FOR.
    //   opponent acts -> "Opponent goes for X"  + graph "DEFENDING X"
    //   you act       -> "You go for Y"         + graph "ATTACKING Y"
    this.setEvent("You go for", act.t, "info");
    this.activeMove = { idx: opt.idx, verb: "Attacking", col: { r: 94, g: 149, b: 255 } };
    this.startTravel([this.currentPos, opt.idx], () => {
      this.after(0.35, () => this.tensionSweep(opt));
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
    const playerMod = this.stateBonus(this._posKey) + this.stateBonus(this.deckKeyFor(act).key) + ((this._filmLook && this._filmLook[act.t]) ? 0.04 : 0);
    const aiMod = Math.max(0, this.oppVal(this.nodes[this.currentPos])) * 0.4 + (this.aiSkill || 0);
    // _qMod: a WRONG landing question costs this exchange only — cleared on next arrival.
    // momentumMod: the combo meter heats the WHOLE hand (+2.5%/tier, cap +10%).
    return Math.max(0.05, Math.min(0.95, base + playerMod - aiMod + (this._qMod || 0) + this.momentumMod()));
  }
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
      const cs = this.calSuccess(node); // seed from the calibrated (or raw base) rate — moveChance would fossilize transient sharpness/film/opponent modifiers into a permanent override
      const seed = cs != null ? cs : Math.max(0.05, Math.min(0.95, (node.ty === "submissions" ? 0.36 : 0.56) + (node.dom || 0) * 0.1));
      m = { name: node.t, cat: cat, pct: Math.round(seed * 100), on: true };
      this.userMods.push(m);
    }
    m.on = true;
    m.pct = Math.max(5, Math.min(95, Math.round(m.pct / 5) * 5 + dir * 5));
    this.refreshOptionOdds();
  }
  // colour a signed value on the -100..100 scale: vivid red when negative, blue when positive,
  // neutral in the ±1 deadband. `sat` = the magnitude at which the palette tops out; EDGE passes
  // NG_EDGE_SAT because its values live an order of magnitude closer to zero (see the constant).
  // The default is the historical 45, so every pre-EDGE caller is byte-identical.
  potColor(p, sat) {
    const lerp = (a, b, t) => "#" + [0, 1, 2].map((i) => { const av = parseInt(a.substr(1 + i * 2, 2), 16), bv = parseInt(b.substr(1 + i * 2, 2), 16); return ("0" + Math.round(av + (bv - av) * t).toString(16)).slice(-2); }).join("");
    const neutral = "#9aa6bd";
    const s = sat > 0 ? sat : 45;
    if (p > 1) return lerp("#8fa6d4", "#5b8cff", Math.min(1, p / s));         // → blue (winning)
    if (p < -1) return lerp("#e09089", "#f23b4e", Math.min(1, -p / s));       // → red (losing), already red at small magnitude
    return neutral;
  }

  // ═══ EDGE — what a move is worth from where you are standing ═══════════════════════════════
  // EDGE = 100 × ( Q(s,a) − B(s) ),  B(s) = Σ attempt%(a′)·Q(s,a′)
  // i.e. how much better or worse this move is than the ORDINARY choice from this state, where
  // "ordinary" is the Q3 Delphi occurrence distribution — what people actually do. 0 is not
  // "no value", it is "the normal thing to do here". Q counts not just whether the move works but
  // WHERE A MISS LEAVES YOU, out to the end of a real roll, so a 78%-odds move that gives up
  // initiative can score below a 55% one that finishes. That divergence is the whole feature: in
  // 98 of 272 hands the best-EDGE card is not the best-odds card.
  //
  // The wire ships the LINE, not the point:   EDGE(p) = e0 + (p − p0)·c1
  // because Q is linear in p and `moveChance` is not a constant — it is the calibrated rate plus
  // your drilling, momentum, a wrong landing question and the opponent's resistance. A frozen
  // integer would be EDGE at the authored odds and at NO OTHER MOMENT, which would make "drilling
  // moves it" a lie. `e0` is the solver's own displayed integer at `p0`, so a card at rest shows
  // exactly what the build-time solve published.
  //
  // p0 IS THE FRAME'S OWN RATE, NEVER `calSuccess`. `calSuccess` selects by the ACTIVE ruleset and
  // the default ruleset is gi, while the table is solved in `evFrame` (no-gi) — measured, 146 of
  // 1467 nodes carry a gi rate that differs from the scalar, so anchoring on `calSuccess` would
  // put a gi player's card off its published value at rest, with no drill and no modifier in
  // sight. Anchored on the solve's own frame, that gi/no-gi difference instead rides through `c1`
  // like any other odds movement, which is what it is.
  _evP0(n) {
    const c = n && n.cal; if (!c) return null;
    const br = c.successRateByRuleset;
    const v = (br && this._evFrame && br[this._evFrame] != null) ? br[this._evFrame] : c.successRate;
    return (typeof v === "number") ? Math.max(0, Math.min(1, v / 100)) : null;
  }
  // which `evLam` block the dial selects. -1 = no table on this wire at all.
  _evLamIdx() {
    if (!this._evLam || !this._evLam.length) return -1;
    let k = this._evLam.indexOf(this.get("lossAversion", NG_EDGE_LAM));
    if (k < 0) k = this._evLam.indexOf(NG_EDGE_LAM);
    return k < 0 ? 0 : k;
  }
  // the { e0, c1, att } row for one move dealt from one position role, or null when this table
  // cannot value it. Resolved ONCE per hand in optionsFor and stamped on the opt, so nothing that
  // reads an EDGE later depends on `currentPos` still being where the hand was dealt.
  _evRowsFor(posIdx, role) {
    const key = posIdx + "/" + role;
    const m = this._ev && this._ev.get(key);
    const k = m ? this._evLamIdx() : -1;
    if (!m || k < 0) return null;
    return (techIdx) => {
      const r = m.get(techIdx); const c = r && r.lam[k];
      return c ? { e0: c[0], c1: c[1], att: r.att, key: key, k: k } : null;
    };
  }
  // ── THE BASELINE MOVES WITH THE HAND, OR THE NUMBER STOPS BEING RELATIVE ──────────────────
  // EDGE is a DIFFERENCE: this move minus the ordinary choice from here. `e0` is that difference
  // evaluated at the authored odds, and the emitter's own numbers prove the definition —
  // Σ att·e0 / Σ att is 0 to within 0.47 of a point on all 272 role-hands (rounding).
  //
  // But `moveChance` does not only carry YOUR drilling. It subtracts `aiMod` — the opponent's
  // resistance — which is a property of the STATE and therefore the same for every card in the
  // hand. MEASURED at side-control/bottom on a fresh profile: aiMod = 0.2612 (0.131 from the top
  // player's own strength + 0.130 aiSkill), so every one of the seven cards is dealt 26pp below
  // its authored rate. Against a FROZEN baseline that made all seven read NEGATIVE — "every
  // option here is worse than the ordinary choice here", which is arithmetically impossible for a
  // weighted mean and would have shipped as the feature's headline hand.
  //
  // So the baseline is re-evaluated under the same conditions as the move: the same attempt
  // weights, over the state's FULL authored action set (the wire carries all of it — 25 moves at
  // side-control/top where only 10 are dealt), at each move's own live odds. Δ is 0 at rest, so a
  // card with no modifiers still shows exactly the integer the build-time solve published, and
  // Σ att·EDGE = 0 stays true at every moment. What survives is the honest part: a uniform odds
  // shift re-ranks by SLOPE (EDGE becomes e0 + Δp·(c1 − c̄1)), because a move whose success and
  // miss branches are far apart cares about its odds and one whose branches are close does not.
  _evShift(key, k) {
    const m = this._ev && this._ev.get(key); if (!m) return 0;
    let wsum = 0, acc = 0;
    for (const [j, r] of m) {
      const c = r.lam[k]; const nd = this.nodes[j];
      if (!c || !nd) continue;
      const p0 = this._evP0(nd); if (p0 == null) continue;
      wsum += r.att;
      acc += r.att * (this.moveChance(nd) - p0) * c[1];
    }
    return wsum > 0 ? acc / wsum : 0;
  }
  // EDGE for a dealt option, at its LIVE odds. null = this move has no value on the wire; the
  // caller renders nothing rather than a fabricated 0 (see the ingest note).
  moveEdge(opt) {
    const r = opt && opt.ev; if (!r) return null;
    const p0 = this._evP0(opt.node);
    if (p0 == null) return r.e0;              // unanchorable: the value at rest is still true
    return r.e0 + (this.moveChance(opt.node) - p0) * r.c1 - this._evShift(r.key, r.k);
  }
  // the EDGE mark as it is rendered: one integer, one colour, computed in ONE place so the card,
  // the sheet and the odds refresh can never print different numbers for the same move.
  edgeMark(opt) {
    const v = this.moveEdge(opt);
    if (v == null) return null;
    const i = Math.round(v) + 0;              // +0 normalises -0, which would otherwise print "-0"
    return { v: v, i: i, txt: (i > 0 ? "+" : "") + i, col: this.potColor(i, NG_EDGE_SAT) };
  }

  // POTENTIAL: signed proximity-to-win the move unlocks (-1..1). Strong resulting position = +, worse position = -.
  // NB the `if (n.ty === "submissions") return 1` shortcut is GONE (v1.118.0). It made every
  // submission score the maximum, so the sort key was a constant across all of them and the
  // 10-card cap then dealt the first ten ALPHABETICALLY — at side-control/top that dealt the
  // hand's worst card (Kneebar, EDGE −17) and truncated its most-attempted move (Side Control to
  // Mount, 23%). The hand no longer ranks on this function at all; the constant is deleted anyway,
  // so nothing can re-inherit a flat ordering from it.
  movePotential(opt) {
    const n = opt.node;
    const resIdx = opt.res;
    const resVal = resIdx >= 0 ? this.myVal(this.nodes[resIdx]) : this.myVal(n);   // -1..1 dominance where you land
    const onward = resIdx >= 0 ? (this.nodes[resIdx].deg || 0) : (n.deg || 0);
    const reach = Math.min(1, onward / 16);                      // follow-ups it opens (0..1)
    const p = resVal * 0.88 + (resVal >= 0 ? reach * 0.12 : 0);   // follow-ups only sweeten an already-good spot
    return Math.max(-1, Math.min(1, p));
  }
  // ── THE HAND IS RANKED BY THE NUMBER IT PRINTS. THERE IS NO SECOND MODE (v1.122.0) ────────
  // `null` means "this move has no value on the wire" — NOT zero, which is a real EDGE.
  // _cmpDealt sorts those last, and never as a 0.
  //
  // RETIRED HERE, owner's decision: `orderScore` used to fork on the `cardOrder` setting —
  //   `this.get("cardOrder","potential") === "popularity" ? this.movePopularity(opt) : this.moveEdge(opt)`
  // — while `edgeMark` did not fork at all. So `Popularity` ranked the tray by one quantity and
  // printed another on every card. MEASURED over the 270 live role-hands
  // (`tests/artifacts/_edge_cardorder_probe.mjs`): under the default, 0 hands print an EDGE that
  // runs out of descending order; under Popularity, 211 do — worst `back-control/bottom`,
  // [-6,-20,+6,+8,-2,+14,+17,+19], the +19 card dealt LAST. That is exactly the "a legitimate
  // ranking reads as a bug" failure the `Edge` caption exists to prevent, one settings click from
  // the default. The other half of the owner's call is also measured: the setting changed the
  // dealt SET in only 16 of those 270 hands while re-ordering 223 — control over the ORDER of
  // almost everything and over the action space of almost nothing.
  //
  // `movePopularity` went with it (its only caller), and `_hash01` with that (its only caller —
  // a `Math.sin` hash whose whole job was jittering a placeholder pick rate), and the already
  // dead `mapFreq` was swept in the same pass. `movePotential` STAYS: it is the escape tray's
  // corner value, and an escape's options are POSITIONS, which the EDGE table cannot value.
  //
  // THE STORED KEY IS DORMANT, AND THAT IS THE ONLY AVAILABLE ANSWER. A profile that saved
  // `cardOrder:"popularity"` keeps it in its blob forever and nothing reads it — the same shape
  // as `studyOrder` (v1.105.0) and `challengePinnedTrack` (v1.99.2). Pruning it on load would be
  // theatre: `_pullAndMerge`'s per-key settings merge has NO TOMBSTONE — its condition is
  // `if (!(sk in merged) || ct > lt)`, so a key deleted locally is unconditionally RE-ADDED by
  // the first pull from any device that still carries it. Deletion is not expressible in this
  // blob, so the honest handling is to stop reading the key, not to pretend it is gone.
  orderScore(opt) { return this.moveEdge(opt); }
  // THE HAND'S ORDER IS FROZEN AT DEAL TIME. Every field this compares is a value stamped onto
  // the opt by optionsFor at the moment the cards were dealt — never a live read. `moveChance`
  // carries your drilling bonus, so a JIT grade taken mid-decision (which is a FEATURE: it moves
  // the odds and the EDGE you can see) would otherwise re-rank the hand under the player's hand
  // while they are reaching for a card. The displayed numbers move; the cards do not.
  // Documented rank: EDGE desc → odds desc → attempt% desc → name asc, all four deterministic.
  _cmpDealt(a, b) {
    const av = a.ord, bv = b.ord;
    if ((av == null) !== (bv == null)) return av == null ? 1 : -1;
    if (av != null && av !== bv) return bv - av;
    if (a.ordOdds !== b.ordOdds) return b.ordOdds - a.ordOdds;
    const aa = (a.ev && a.ev.att) || 0, ba = (b.ev && b.ev.att) || 0;
    if (aa !== ba) return ba - aa;
    return a.node.t < b.node.t ? -1 : a.node.t > b.node.t ? 1 : 0;
  }
  // resolve a cal.outcomes[].to (role-node slug "<pos>/top|bottom" | bare technique slug |
  // "game-over") to a node index. { idx:-1 } unresolved, { terminal:true } for game-over,
  // role = the authored landing role (top/bottom) for position targets.
  resolveOutcomeTo(to) {
    if (!to || typeof to !== "string") return { idx: -1, terminal: false };
    const t = to.trim().toLowerCase();
    if (t === "game-over") return { idx: -1, terminal: true };
    const m = t.match(/^(.*)\/(top|bottom)$/);
    if (m) {
      // dual close-pair prototype: prefer the ROLE MEMBER node ("mount/top") when the pair
      // layout is live; falls back to the bare slug (the hub node) on the production layout.
      let i = this._posSlugIndex && this._posSlugIndex.get(m[1] + "/" + m[2]);
      if (i == null) i = this._posSlugIndex && this._posSlugIndex.get(m[1]);
      return { idx: i == null ? -1 : i, terminal: false, role: m[2] };
    }
    let i = this._techSlugIndex && this._techSlugIndex.get(t);
    if (i != null) return { idx: i, terminal: false };
    i = this._posSlugIndex && this._posSlugIndex.get(t);
    return { idx: i == null ? -1 : i, terminal: false };
  }
  // draw one cal.outcome weighted by probability (they sum ~100); null when the node has no cal.
  // MOMENTUM skews this table live: counter-outcomes shed up to 40% of their weight while a combo
  // is hot — you're moving too fast for the opponent to capitalize. Favorable outcomes gain the
  // difference implicitly (relative weights), which is exactly "the outcomes that favor you get
  // more probable" without ever touching the authored numbers.
  //
  // `branch` (v1.121.0) — WHEN THE CALLER HAS ALREADY DECIDED THE BRANCH, DRAW INSIDE IT. `resolve`
  // decides success/miss on `moveChance` (the player-facing, drill-improvable gate) BEFORE any
  // outcome exists, so drawing from the whole table and then repairing the mismatch produced a
  // distribution nobody authored — see resolve() for the measurement. Passing the decided branch
  // restricts the table to that branch's rows and renormalises INSIDE it, which is exactly the
  // conditional the authored weights state. Omitted (`opponentDefend`'s destination draw) = the
  // whole table, byte-identical to before. Exactly ONE `rng("outcome")` draw either way.
  drawOutcome(act, branch) {
    const all = act && act.cal && Array.isArray(act.cal.outcomes) ? act.cal.outcomes : null;
    if (!all || !all.length) return null;
    // An EMPTY branch cannot be honoured — a node authoring no success row has no success cell to
    // draw — so fall back to the whole table, which is what the old `.find(...) || out` did. The
    // fallback is chosen BEFORE the draw so the rng call count never depends on content. Measured
    // over graph-data.json: 0 of 1331 outcome lists have an empty branch, so this is defensive.
    // (`total <= 0` below returns without drawing at all — a pre-existing hole in the one-draw
    // contract, and restricting to a branch cannot newly open it: 0 of 1331 lists have a
    // zero-weight branch, so the branch draw and the whole-table draw consume the same stream.)
    let outs = all;
    if (branch != null) {
      const want = !!branch;
      const sub = all.filter((o) => (o.result === "success") === want);
      if (sub.length) outs = sub;
    }
    const sk = this.momentumSkew();
    const w = (o) => { let v = Math.max(0, +o.probability || 0); if (sk > 0 && o.result === "counter") v *= (1 - sk); return v; };
    let total = 0; for (const o of outs) total += w(o);
    if (total <= 0) return outs[0];
    let r = this.rng("outcome") * total;
    let chosen = outs[outs.length - 1];
    for (const o of outs) { r -= w(o); if (r <= 0) { chosen = o; break; } }
    if (sk > 0 && chosen.result !== "success") this.fx("outcome_skewed", { skew: sk, result: chosen.result });
    return chosen;
  }
  // ── P3 impact contrast: commit → 0.38s hold → 0.7s needle sweep vs a band sized to
  // moveChance → detonation (in band) or 90ms hit-stop + recoil (out). The resolve draw
  // happens at sweep start, so the needle's landing IS the verdict — no second dice roll. ──
  tensionSweep(opt) {
    const act = this.nodes[opt.idx];
    const chance = this.moveChance(act);
    const roll = this.rng("resolve");
    const success = roll < chance;
    this.fx("sweep_start", { technique: act.t, band: Math.round(chance * 100) });
    this._sweep = { idx: opt.idx, t0: this.now, hold: 0.38, dur: 0.7, band: chance, roll: roll };
    this.after(1.08, () => {
      this._sweep = null;
      this.fx("sweep_land", { inBand: success, roll: Math.round(roll * 100) });
      if (success) { this.fx("detonation", { technique: act.t }); this.flare(opt.idx); }
      else { this.fx("hit_stop", { technique: act.t }); this._hitStop = this.now; this._shake = { idx: opt.idx, t0: this.now }; }
      this.resolve(opt, success);
    });
  }
  // THE MISS DISTRIBUTION THE CARD PRICES IS THE ONE THE ROLL ROLLS (v1.121.0).
  //
  // WHAT WAS WRONG. The branch was decided here on `moveChance` — correctly, that is the
  // player-facing gate drilling moves — and then the ROW was drawn from the WHOLE authored table
  // and, when the two disagreed, REPAIRED with `outcomes.find(...)`: the FIRST matching cell, not
  // a re-draw inside the branch. Authored lists run success → failure → counter, so every miss
  // that happened to draw a success cell was dumped onto the first `failure`, and 1327 of 1331
  // lists end in a `counter`. MEASURED against the within-branch kernel the EDGE solver prices
  // (`tests/artifacts/_resolve_kernel_measure.py`): TV distance mean 0.0902 · median 0.0825 ·
  // max 0.2440, TV == 0 on ZERO of 1331 nodes, > 0.10 on 276 (20.7%) — and 47.39% of all authored
  // counter mass never reached the player (233.82 authored vs 123.01 rolled, summed over the 1331
  // nodes at their authored no-gi rates). A counter is the expensive miss — it is what makes a
  // 78%-odds move that gives up initiative score below a 55% one — so draining half of it made
  // every EDGE integer on every option card a price for a game nobody was playing.
  //
  // THE FIX IS A CONDITIONAL, NOT A SECOND DICE. `moveChance` still owns the branch; `drawOutcome`
  // is told which branch was chosen and draws inside it from the authored weights, renormalised.
  // Still exactly ONE `rng("outcome")` draw per resolution, same tag, same order — so a rigged
  // journey consumes the same queue; what changes is which row a mid-band value lands on.
  // This DELIBERATELY re-baselines `replay-digest`: the miss distribution genuinely changed.
  resolve(opt, forced) {
    const act = this.nodes[opt.idx];
    const success = forced != null ? forced : this.rng("resolve") < this.moveChance(act);   // player-facing, drill-improvable gate
    const out = this.drawOutcome(act, success);
    if (!out) { return success ? this.enterSuccess(opt) : this.enterFail(opt); }  // no cal -> legacy path
    return success ? this.enterSuccessCal(opt, out) : this.enterFailCal(opt, out);
  }

  enterSuccess(opt) {
    const act = this.nodes[opt.idx];
    this.fx("impact_success", { technique: act.t });
    const dest = opt.res >= 0 ? opt.res : this.currentPos;
    if (act.ty === "submissions") {
      this.flare(opt.idx);
      this.endRound("win", act.t, opt.idx);   // the finishing node, for the film (see endRound)
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
    this.fx("impact_fail", { technique: act.t });
    this.setEvent("Failed", act.t + " stuffed", "bad");
    this.after(1.25 / this.cfg().signalSpeed, () => this.opponentDefend());
  }

  // calibrated success: travel to the outcome's real target position (fallback to legacy resultPos)
  enterSuccessCal(opt, out) {
    const act = this.nodes[opt.idx];
    this.fx("impact_success", { technique: act.t, to: out && out.to });
    const r = this.resolveOutcomeTo(out.to);
    // a finish is the roll's LAST node — the one arrival that never produces a landing, so it
    // takes the arrival bloom here or nowhere (v1.114.0).
    if (act.ty === "submissions" || r.terminal) { this.flare(opt.idx, this.ARRIVE_BLOOM); this.endRound("win", act.t, opt.idx); return; }
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
    this.fx("impact_fail", { technique: act.t, counter: !!(out && out.result === "counter") });
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
    this.fx("defend_start", { submission: sub ? sub.t : null });
    this.fx("caught", { submission: sub ? sub.t : null });
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
    this._defendSub = subIdx;
    // the panic drill credits the authored Defender deck when it exists, else your position deck
    const dk = this.defendKeyFor(sub);
    this._panicKey = this._deckHasCards(dk) ? dk : (this._deckHasCards(this._posKey) ? this._posKey : null);
    this.buildDrillPanel(this.currentPos, dk); // surfaces the Defender deck via the tab; respects the user's open/closed choice (no auto-open)
    this.showVignette(); // heartbeat — you are IN TROUBLE, and the screen says so

    const el = this.optionsRef.current; if (el) el.innerHTML = "";
    let picked = false;
    const finish = () => { picked = true; this._optPick = null; this._optList = null; this._decision = null; this.clearTimers(); this.clearOptions(); this.clearLandCard(); this._defendSub = null; this._panicKey = null; this.killVignette(false);
      this.activeMove = null; this.flare(subIdx); this.setEvent("Tapped", this.splitName(sub.t).main, "bad");
      this.after(0.5, () => this.endRound("lose", sub.t, subIdx)); };
    const pick = (opt) => {
      if (picked) return; picked = true;
      const chance = this.escapeChance(opt); // computed BEFORE teardown (needs _defendSub/_panicKey)
      this._optPick = null; this._optList = null; this._decision = null; this.clearTimers(); this.clearOptions(); this.clearLandCard();
      this.setEvent("Escaping", opt.node.t, "info");
      this.activeMove = { idx: opt.idx, verb: "Escaping", col: { r: 126, g: 224, b: 168 } };
      this.startTravel([subIdx, opt.idx], () => {
        this._defendSub = null; this._panicKey = null;
        if (this.rng("escape") < chance) {
          this.fx("escape", { via: opt.node.t });
          const before = this.myVal(this.nodes[this.currentPos]);
          this.playerRole = "bottom"; // escaping usually lands you bottom/neutral
          this.flashFx(this.myVal(opt.node) - before);
          this.currentPos = opt.idx; this.moveCount++; this.bumpBounce(); this._lastActor = "you";
          this.killVignette(true); // 180ms snap-off — the relief IS the reward
          this.fx("relief", {});
          // the escape's EDGE is the submission you got out of (see enterAttempt's `via` note).
          // `idx` is the position you land on, so enterLand's own guard (`intent.idx !==
          // currentPos`) still renders no "you aimed for" line here — this adds the film's edge,
          // not a new sentence in the history row.
          this._pendingIntent = { actor: "you", idx: opt.idx, via: subIdx, kind: "escape" };
          this.setEvent("Escaped!", opt.node.t, "good");
          this.after(0.7, () => this.enterLand(false));
        } else { finish(); }
      });
    };
    for (let i = 0; i < escapes.length; i++) el.appendChild(this.buildOptionCard(escapes[i], pick, dsec, i + 1, "escape"));
    if (el) el.style.pointerEvents = "auto";
    this._optPick = pick; this._optList = escapes;
    this.buildPanicCard(el, sub);
    // the defense window runs on the decision clock (gdt-driven, drill-refundable); expiry = tapped
    this._decision = { remaining: dsec * 1000, total: dsec * 1000, refunds: 0, warned: 0, pick: pick, opts: escapes, onExpire: finish };
    this._barF = null;   // same as the landing hand: a fresh tray's bars start full
  }
  oppVal(node) {
    const s = node.s;
    if (Array.isArray(s) && s.length >= 2) return s[this.valIdx(node) === 0 ? 1 : 0];
    return -(node.dom || 0);
  }
  opponentDefend() {
    // gather the opponent's adjacent options, split into finishes vs positional counters
    const subs = []; let trans = []; const seen = new Set();
    for (const k of this.adj[this.currentPos]) {
      const n = this.nodes[k]; if (n.ty === "positions") continue; if (seen.has(n.t)) continue; seen.add(n.t);
      // STRICT during a belt test: the opponent only goes for finishes in the belt's vocabulary
      if (n.ty === "submissions") { if (this._beltPoolAllows(n)) subs.push(k); }
      else trans.push(k);
    }
    if (this._beltTest) {
      // SOFT for transitions: prefer pool moves, but never let the filter stall the roll
      const pt = trans.filter((k) => this._beltPoolAllows(this.nodes[k]));
      if (pt.length) trans = pt;
    }
    if (!subs.length && !trans.length) { this.endRound("reset"); return; }
    // the more dominant the opponent is here, the more likely they go for the finish
    const oppAdv = this.oppVal(this.nodes[this.currentPos]); // + = opponent is winning
    let pFinish = subs.length ? Math.max(0.18, Math.min(0.85, 0.34 + oppAdv * 0.55)) : 0;
    if (!trans.length && subs.length) pFinish = 0.9;
    if (subs.length && this.rng("opp-finish") < pFinish) {
      const def = subs[(this.rng("opp-sub-pick") * subs.length) | 0];
      this.fx("opponent_attack", { technique: this.nodes[def].t, idx: def }); // belt-pool journeys assert on this
      this.flare(def);
      this.setEvent("Opponent goes for", this.nodes[def].t, "bad");
      // "Defending", not "Attacking": the verb is YOURS, and the opponent is the one attacking.
      // This branch and the positional one below disagreed with each other.
      this.activeMove = { idx: def, verb: "Defending", col: { r: 255, g: 110, b: 110 } };
      this.startTravel([this.currentPos, def], () => this.after(0.3, () => this.enterDefense(def)));
      return;
    }

    // positional counter — prefer moves that improve the opponent most
    trans.sort((a, b) => this.oppVal(this.nodes[this.resultPos(b, this.currentPos)] || this.nodes[b]) - this.oppVal(this.nodes[this.resultPos(a, this.currentPos)] || this.nodes[a]));
    const def = (trans.length ? trans : subs)[(this.rng("opp-pick") * Math.min(3, (trans.length ? trans : subs).length)) | 0];
    const defNode = this.nodes[def];
    this.fx("opponent_move", { technique: defNode.t, idx: def });
    // calibrated destination: draw from the move's own cal.outcomes (encodes the miss distribution),
    // fall back to the legacy resultPos heuristic when the node is uncalibrated.
    const draw = this.drawOutcome(defNode);
    let intendDest;
    if (draw) { const rr = this.resolveOutcomeTo(draw.to); intendDest = rr.terminal ? this.currentPos : (rr.idx >= 0 ? rr.idx : this.resultPos(def, this.currentPos)); }
    else { intendDest = this.resultPos(def, this.currentPos); }
    if (intendDest < 0) intendDest = this.currentPos;
    const actualDest = intendDest; // the weighted draw already models "doesn't always land clean" — no extra random slip
    this._pendingIntent = { actor: "opp", idx: intendDest, via: def };  // `via`: the edge, for the film (see enterAttempt)
    // `performerRole(...) === "top"` used to pick between "Opponent counters" and "Opponent
    // defends" here — a TOP/BOTTOM test standing in for an OFFENCE/DEFENCE one, the same defect
    // class as roleIdx-vs-valIdx (v1.103.0). In BJJ the dominance axis is not top/bottom, so a
    // bottom-authored attack (the reported crucifix) announced itself as the opponent DEFENDING.
    // Naming the actor needs no such guess.
    this.setEvent("Opponent goes for", defNode.t, "bad");
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
  /**
   * WHERE THE CAMERA PUTS THE STATE YOU ARE PLAYING (v1.103.2) — ONE function, so a click that
   * navigates and the settled follow-cam cannot land on different compositions.
   *
   * Travel pulls back so a move reads as a move; settled, it closes to ROLL_ZOOM, where the canvas
   * draws the state's own name and role inside the node (which is why the landing card stopped
   * repeating them). Horizontally it sits slightly LEFT of centre: every name hanging off a node
   * runs left-to-right FROM it, so the room a node needs is on its right.
   *
   * Vertically it centres the node's LABEL in the band that is actually free — below the announce
   * block, above the film strip (or the card, when there is no film). That band is MEASURED. The
   * constant it replaces (`0.34 * H`) was right at 1440x900 and wrong everywhere else, and it
   * aimed at the node's centre while the eye reads the label: `draw()` writes a submission's text
   * `rs * 0.24` below centre, so a triangle's label sat low by exactly that much.
   */
  /** `nodeIdx` names the node being framed. It defaults to `focusIdx` because the follow-cam's
   *  focus IS the node — but a reader (openDossier) frames a node it has not focused yet, and the
   *  submission label offset below would otherwise be computed from whatever was focused before. */
  rollCamTarget(f, moving, nodeIdx) {
    const vw = moving
      ? Math.max(this.graphW * 0.3, this.graphR * 0.7)
      : this.graphW * this.ROLL_ZOOM;
    const H = this.H || 800, W = this.W || 1200;
    let top = 16;
    const ev = this.evRef && this.evRef.current;
    if (ev) {
      try {
        const r = ev.getBoundingClientRect();
        if (r.height > 0 && getComputedStyle(ev).opacity !== "0") top = Math.max(top, r.bottom + 12);
      } catch (e) { /* non-fatal */ }
    }
    // THE BAND MUST SURVIVE THE CARD'S TEARDOWN (v1.114.4). Staging a new state calls
    // `clearOptions()`, which drops the landing card AND the film strip — and for the ~600ms
    // until `enterLand` rebuilds them there is nothing to measure, so `bot` fell back to
    // `H - 240` and the frame became the middle of the WHOLE SCREEN. Owner: "it seems to want to
    // center the node to the center of the screen initially instead of centering to the available
    // visible space (above the landcard)". Measured clicking the partner orb: wantY 136 -> 338 for
    // two frames, and `rollFromPosition` writes camTarget inside exactly that window. So remember
    // the last real measurement and keep using it while the card is rebuilding; it is the same
    // card, docked to the same bottom, so this is a truer answer than the fallback.
    let bot = H - 240, measured = false;
    for (const el of [this._landFilmEl, this._landEl]) {
      if (!el) continue;
      try {
        const r = el.getBoundingClientRect();
        // AN UNDOCKED ELEMENT IS NOT A CONSTRAINT. `_dockLandFilm` positions the film strip AFTER
        // it is inserted, so for a frame or two `rect.top` reads **0** — measured, that made the
        // band `-12`, tripped the "no room" fallback, and threw the camera 61px in one frame and
        // ~90px in another during a pair swap. A surface that leaves no band above it has not
        // laid out yet; skip it and let the next one (or the cache) answer.
        if (r.height > 0 && r.top > top + 80) { bot = Math.min(bot, r.top - 12); measured = true; break; }
      } catch (e) { /* non-fatal */ }
    }
    // THE BAND TIGHTENS AT ONCE AND GIVES GROUND SLOWLY. Caching only the "nothing to measure"
    // case was not enough: the card and the film strip are rebuilt on DIFFERENT frames, so for a
    // moment the card is back (bot 362) while the film is not (bot 256) and the band flickers
    // LOOSER — measured as a 4.8 world-unit / ~53px camera swing on a pair swap, which is exactly
    // the "moves a lot" the owner saw. Every transient during a rebuild loosens the band, and
    // every real change that matters (a card appearing, a taller question) tightens it — so
    // taking a tighter answer instantly and easing toward a looser one absorbs the flicker
    // without ever letting the camera sit in space the card is about to cover. The ease is
    // per-call and this is called once per frame by the follow-cam: tau is about a quarter second.
    // THE BAND ONLY EVER TIGHTENS, FOR THE LIFE OF THE VIEWPORT. The card and the film strip mount
    // on DIFFERENT frames, and a film box can measure zero mid-transition — so a "first element
    // with height wins" read ALTERNATES between two answers: measured on a pair swap, the
    // follow-cam flipped `camTarget.cy` between 4.44 (film seen, bot 256) and -0.36 (card only,
    // bot 363) frame after frame. That flicker IS the swing the owner saw. Keeping the tightest
    // answer ever measured at this height is stable by construction, and it errs in the safe
    // direction: too tight only ever puts the node HIGHER, never behind the card. Deliberately NOT
    // reset per landing — that was tried, and it hands the very first post-reset frame (card
    // without its film) back to the loose answer, which is the whole bug.
    if (this._bandBot && this._bandBot.h === H) bot = Math.min(bot, this._bandBot.y);
    if (measured) this._bandBot = { h: H, y: bot };
    if (bot - top < 80) { top = 16; bot = Math.max(120, H * 0.42); }   // no room: use the top band
    const wantY = (top + bot) / 2;
    const scale = W / vw;
    const ni = nodeIdx == null ? this.focusIdx : nodeIdx;
    const n = this.nodes && ni >= 0 ? this.nodes[ni] : null;
    const nodeK = Math.max(0.4, Math.min(1, vw / (this.graphW * 0.5)));
    // a PAIR is aimed at its midpoint, where the name is now drawn — the triangle nudge that
    // compensates for a submission's low in-shape label has nothing to compensate for there.
    const paired = !!(n && n.pi >= 0);
    const labelOff = n && n.ty === "submissions" && !paired ? n.r * nodeK * scale * 0.24 : 0;
    // screen y = (n.y - cy) * scale + H/2  =>  cy = n.y - (wantY - H/2)/scale
    const cy = f.y + labelOff / scale - (wantY - H / 2) / scale;
    return { cx: f.x + 0.06 * vw, cy: cy, vw: vw };
  }
  updateCamera(dt) {
    const el = this.now - this.startTime;
    // a lease taken before there was a clock starts counting now (see holdCamera)
    if (this._camHoldUntil === -1) this._camHoldUntil = this.now + (this._camHoldSecs || this.camHoldSec);
    let tgt = null;
    // A STAGED BOARD TRACKS ITS FRAMING UNTIL THE USER MOVES THE CAMERA THEMSELVES (v1.114.4).
    // `userActiveNow()` measures `now - lastInteract` on the GAME clock, and a staged board is
    // paused from birth — so `now` is frozen and one click latches "the user is active" FOREVER,
    // which silently disabled the v1.114.2 tracking for every roam. That is why the bad frame
    // taken during the card's teardown was never corrected: measured, the band was back to its
    // right answer 600ms later and `camTarget` still held the wrong one three seconds on.
    // `_stagedCamFree` is the honest gate instead: a real pan, pinch or wheel clears it, and the
    // "never fight a user's camera" rule survives intact.
    const stagedIdle = this._staged != null && !this._played && this.paused && !this._replay
      && this._stagedCamFree !== false;
    if (!this.introDone) {
      if (el < 1.6) tgt = { cx: this.gcx, cy: this.gcy, vw: this.graphW * 2.3 - this.graphW * 0.3 * (el / 1.6) };
      else {
        tgt = { cx: this.gcx, cy: this.gcy, vw: this.graphW * 1.0 };
        if (el > 3.2) {
          this.introDone = true;
          // HAND THE INTRO'S CAMERA TO A FLIGHT THAT WAS ASKED FOR DURING IT. A share link is
          // decoded at ingest — t=0, 3.2 seconds before this line — so its frameNodes() ran while
          // the intro owned the camera and was simply lost. Re-assert it here, with a fresh lease,
          // and let it fly instead of the intro's parting overview.
          if (this.camHeld() && this._camHoldTarget) {
            const h = this._camHoldTarget;
            this.camTarget = { cx: h.cx, cy: h.cy, vw: h.vw };
            this._camHoldUntil = this.now + this.camHoldSec;
            tgt = null;
          }
          // A URL ARRIVAL SETS THE BOARD AND HOLDS THE CLOCK — it never starts a roll (v1.114.2).
          // Deliberately NOT `stageRollAt`: that fires `roll_staged`, which is the White objective
          // "Start a roll here", whose own copy is *click any node on the graph to roam there*.
          // Typing an address is not that, and crediting it would be the same false tick the
          // retired coach used to hand out.
          if (this._urlSeeded && this._urlSeedIdx >= 0) {
            this.rollFromPosition(this._urlSeedIdx, true, this._urlSeedRole);
            this._staged = this.currentPos;
            tgt = null;   // ...and the intro's parting overview must not overwrite that framing
          } else {
            this.startRoll();
          }
        }
      }
    } else if (this.userActiveNow() && !stagedIdle) {
      tgt = null;
    } else if (this.endZoom) {
      tgt = { cx: this.endCenter.x, cy: this.endCenter.y, vw: this.graphW * 1.55 };
    } else {
      const mode = this.cfg().cameraMode;
      if (mode === "Overview") {
        const br = 1 + 0.03 * Math.sin(this.now * 0.22);
        tgt = { cx: this.gcx + 9 * Math.sin(this.now * 0.07), cy: this.gcy + 7 * Math.cos(this.now * 0.06), vw: this.graphW * 1.02 * br };
      } else {
        // ONE framing function, so a click and the follow-cam cannot disagree (v1.103.2).
        tgt = this.rollCamTarget(this.camFocus, !!this.pulse);
      }
    }
    // while paused or reading an in-node dossier, suppress only the AUTO-retarget — the tween
    // itself keeps flying toward whatever camTarget was set (Follow/Overview must not yank the
    // camera away mid-read, but manual prezi targets still animate).
    // ...EXCEPT A STAGED BOARD, WHICH IS PAUSED FROM BIRTH (v1.114.2). `rollCamTarget` measures
    // the free band between the announce block and the landing card, and a fresh landing builds
    // that card 0.6s AFTER the frame is computed — so suppression froze an answer taken before
    // there was anything to measure. A running roll self-corrects every frame; a staged one had
    // no second chance. Measured on /Positions/Side-Control/Bottom: node bottom 371 against a
    // card top of 366, the node 5px INSIDE the card, permanently. A board that has never played
    // therefore keeps tracking — and the moment the user pans (`userActiveNow`), takes a lease,
    // or presses play, every one of the guards around this line takes the camera back.
    if (this.introDone && (this.paused || this._dossierIdx != null) && !stagedIdle) tgt = null;
    if (this._reframeHold) tgt = null;   // mid-rebuild: the layout has nothing true to say yet
    // …and a live focus lease outranks every AUTOMATIC retarget there is — follow, overview, the
    // end-of-round zoom. This is the line the whole camera-ownership fix comes down to: without
    // it the follow-cam re-aims camTarget at the current roll node on the very next frame and the
    // flight the user asked for never happens. See holdCamera().
    if (this.introDone && this.camHeld()) tgt = null;
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
    if (this.isTest()) { this._simNow = 0; this.lastT = 0; return; } // frames advance only via advance()
    const loop = (ms) => {
      this._raf = requestAnimationFrame(loop);
      try {
        this._tick(ms / 1000);
      } catch (err) {
        console.error("frame error", err);
      }
    };
    this._raf = requestAnimationFrame(loop);
  }

  // one simulation+render frame — shared by the rAF loop and the test-mode frame pump
  _tick(nowSec) {
    {
      {
        this.now = nowSec;
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
        let gdt = this.paused ? 0 : dt;
        // a session exists the moment it runs unpaused with a live hand — before that, a staged
        // roam can be restaged freely and costs nothing
        if (gdt > 0 && this.optionIdxs && this.optionIdxs.length) this._played = true;
        if (this._hitStop) { if (this.now - this._hitStop < 0.09) gdt = 0; else this._hitStop = null; } // 90ms hit-stop
        // A REPLAY RUNS WITH THE GAME CLOCK HELD, and its sweeps are the whole point of it. Travel
        // is a DISPLAY primitive (like the camera two lines below, which has always run on the real
        // clock so a paused prezi flight still flies), so while a film owns the screen it steps on
        // the real frame delta. The live roll's own pulse was parked at `startReplay` and is handed
        // back on stop, so nothing of the roll advances here.
        this.updateTravel(this._replay ? dt : gdt);
        this._tickDecision(gdt);
        this.updateFlash();
        this.updateRipples();
        this.updateUiShift(dt);
        // camera runs on the REAL clock — pausing the sim must not freeze the tween
        // (the prezi flight into a dossier happens while the roll is auto-paused)
        this.updateCamera(dt);
        this.trail = this.trail.filter((e) => this.now - e.time < 2.8);
        if (!this._noDraw) this.draw();
      }
    }
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
    this.clearEngagement();
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
    this.camFocus = this.pairMid(this.nodes[posIdx]);
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
    // HIT-TEST WHERE THE ORB IS DRAWN, NOT WHERE IT IS STORED (v1.114.3). `LY` lifts each member
    // of a dual pair off its shared ground point, so `n.y` is ~37px from the circle you can see at
    // roll zoom — further than this 28px pick radius. The consequence was not just a dead hover:
    // the TAP handler runs through this same function, so clicking a visible orb in `?dual` matched
    // NOTHING and fell through to `_tapBackground()`. Production is untouched by construction —
    // no node carries `z`, so `LY(n) === n.y`.
    const ly = this._LY || ((q) => q.y);
    let best = -1, bd = (28 / scale) * (28 / scale);
    for (const n of this.nodes) {
      const dx = n.x - wx, dy = ly(n) - wy, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = n.idx; }
    }
    this._hover = best >= 0 ? { idx: best, t: this.now } : null;
  }
  sbOffset() { const w = this.W || (this.wrapRef.current ? this.wrapRef.current.clientWidth : 1200); return w <= 640 ? 0 : 360; }
  attachInput() {
    const el = this.wrapRef.current;
    let dragging = false, lx = 0, ly = 0, dsx = 0, dsy = 0, moved = 0;
    const ptrs = new Map();
    let pinch = null;
    const dist = () => { const a = [...ptrs.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
    const mid = () => { const a = [...ptrs.values()]; return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 }; };
    el.addEventListener("pointerdown", (e) => {
      // ── the in-node dossier owns gestures that START inside it ──
      // Below, pointerdown calls el.setPointerCapture(). Capture RETARGETS every later pointer
      // event to `el`, so (a) pointerup's `inCard` guard saw the wrap div instead of the card
      // and dismissed the dossier mid-gesture, and (b) the browser computed the click event's
      // target from the down/up common ancestor — also the wrap div. Net effect: EVERY button
      // inside the desktop in-node dossier ("Roll from here", the attack pills, and now "Add to
      // today's class list") was visible, enabled, stable — and dead to the mouse. Keyboard and
      // programmatic paths masked it, exactly like the retired coach's button in v1.69.1. Found by
      // Playwright: pointerdown hit .dsListTxt, mouseup and click hit a DIV.
      // Panning the graph from inside the card was never a gesture anyone wanted.
      const nc = this.nodeCardRef && this.nodeCardRef.current;
      if (nc && nc.style.display !== "none" && e.target && nc.contains(e.target)) return;
      // ...AND THE READING SHEET, which since v1.101.0 is a desktop surface too. Same bug, same
      // shape: the sheet's "Add to today's class list" row was visible, enabled, hit-testable —
      // `elementFromPoint` at its centre returned its own `.dsListTxt` — and its click listener
      // never fired. Traced: `doc-down:dsListTxt` followed by `doc-click:` on an element with NO
      // class, i.e. this wrap. The capture above retargets pointerup, the browser computes the
      // click target from the down/up common ancestor, and the row's handler is skipped entirely.
      // The mobile sheet was exposed to this all along; it only surfaced when the desktop read
      // moved out of the node and into the sheet.
      const dsh = this.dossierSheetRef && this.dossierSheetRef.current;
      if (dsh && dsh.style.display === "block" && e.target && dsh.contains(e.target)) return;
      // ...AND THE GAME CARD ITSELF, plus its film strip. Fourth surface, same bug: `clickByMouse`
      // on the card's corner `+` measured the button, hit-tested to the button, dispatched a real
      // mouse click on the button — and the capture never happened, because the capture below
      // retargets pointerup to this wrap and the browser resolves the click to their common
      // ancestor. `locator.click()` (which dispatches on the element) masked it completely.
      // Every fixed overlay that owns its own controls needs to be named here; the alternative is
      // finding it once per surface, by hand, forever.
      // FIFTH SURFACE (v1.102.1): the option-detail sheet. Its capture moved into the header
      // corner and a REAL tap on it did nothing — same retarget, same silence. Every fixed
      // overlay that owns controls belongs in this list; that is why it is a list.
      // SIXTH SURFACE (v1.123.0): the "see more" hint. It is a fixed overlay whose whole purpose
      // is a click (`onClick={scrollOptions}`), and it has NEVER been in this list — the option
      // ROW next to it is immune only because componentDidMount gives it its own `pointerdown`
      // stopPropagation, which the hint never had. PRE-EXISTING, not introduced by moving it:
      // the affordance has been dead to the mouse for as long as it has existed, and it surfaced
      // now only because uncapping the hand made it worth writing the first spec that clicks it
      // with a REAL mouse instead of `locator.click()`. Sixth time; the list is the cure.
      for (const ov of [this._landEl, this._landFilmEl, this.optDetailRef && this.optDetailRef.current,
        this.optionHintRef && this.optionHintRef.current]) {
        if (ov && e.target && ov.contains(e.target)) return;
      }
      this.closeDeckIfStudying();
      // A HAND ON THE GRAPH ENDS THE FILM (v1.106.5). This covers pan, pinch and tap in one place —
      // the overlays that own controls have already returned above, and the replay bar is a
      // root-plane sibling of this wrap, so its own ✕ never reaches here.
      if (this._replay) this.stopReplay("input");
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
        this.releaseCamera(); // a pinch is the user taking the camera; never fight a live gesture
        this.lastInteract = this.now; return;
      }
      if (!dragging || !this.cam) { this._updateHover(e); return; }
      moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
      const scale = this.W / this.cam.vw;
      this.cam.cx -= (e.clientX - lx) / scale; this.cam.cy -= (e.clientY - ly) / scale;
      this.camTarget.cx = this.cam.cx; this.camTarget.cy = this.cam.cy;
      if (moved > 6) { this.releaseCamera(); this._stagedCamFree = false; } // a real pan ends the lease AND the staged framing
      lx = e.clientX; ly = e.clientY; this.lastInteract = this.now;
    });
    const end = (e) => {
      if (e) { ptrs.delete(e.pointerId); try { el.releasePointerCapture(e.pointerId); } catch (err) {} }
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 1) { const r = [...ptrs.values()][0]; dragging = true; lx = r.x; ly = r.y; moved = 99; }
      else if (ptrs.size === 0) {
        const card = this.nodeCardRef && this.nodeCardRef.current;
        const inCard = card && card.style.display !== "none" && e && card.contains(e.target);
        // tapping a node ROAMS to it (stages a paused roll there); tapping the one you're already
        // on reads it instead. Empty space closes whatever is open.
        if (dragging && moved < 5 && e && !inCard) { this._updateHover(e); if (this._hover && this._hover.idx >= 0) { if (this._hover.idx === this.currentPos) this.openDossier(this._hover.idx); else this.stageRollAt(this._hover.idx); } else { this._tapBackground(); } }
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
      // ONE zoom floor. The second one existed to stop a wheel overshooting past the in-node
      // dossier's sweet spot; that surface was retired in v1.101.0 and `_dossierIdx` has only
      // been assigned null since, so the branch has been dead — and reading a node by zooming
      // into it is exactly the behaviour v1.114.0 retired ("to see details on a node we click
      // on it. We don't zoom in anymore"). Zoom is a camera; it decides how many nodes you see.
      vw = Math.max(this.graphW * 0.006, Math.min(this.graphW * 2.6, vw));
      this.cam.vw = vw; this.cam.lvw = Math.log(vw);
      const sa = this.W / vw;
      this.cam.cx = wx - (sx - this.W / 2) / sa; this.cam.cy = wy - (sy - this.H / 2) / sa;
      this.camTarget.cx = this.cam.cx; this.camTarget.cy = this.cam.cy; this.camTarget.vw = vw;
      this.releaseCamera(); this._stagedCamFree = false; // wheel-zoom is the desktop equivalent of a pinch
      if (this._replay) this.stopReplay("input");   // ...and so it ends a film, for the same reason
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
    // ── THE LIFT IS RE-APPLIED PER FRAME, AND IT COLLAPSES WITH ZOOM (v1.113.1) ────────────────
    // `nodeK` rescales every orb by up to 2.5x across the zoom range, so a lift baked into the
    // payload is too small at one end and too big at the other — measured, the clearance between
    // a big pair's orbs ran from −6.6px (overlapping) at overview to +22px at roll zoom. Scaling
    // the lift by the SAME factor as the radius makes the gap a fixed fraction of the orbs at
    // every zoom, which is the "learn it once" property actually delivered to the eye.
    //
    // `kLOD` then collapses the pair toward its ground point as you zoom out, because no spacing
    // can rescue the overview: at nodeK = 1 the orbs are at full size and the whole graph is
    // 0.94px per unit, so ANY honest gap is a hairline. At k = 0 a site is one orb — the familiar
    // 1467-node map — and it opens as you approach. The position collapse is CONTINUOUS, so by
    // the time the partner fades out the two are already coincident: no pop, no crossfade.
    //
    // `n.z` is 0 for singles and for the entire production payload, so LY() is the identity there
    // and this whole mechanism costs one comparison per node off `?dual`.
    const nodeK = Math.max(0.4, Math.min(1, this.cam.vw / (this.graphW * 0.5)));
    const kRaw = (scale - 1.15) / (2.20 - 1.15);          // px per world unit: MERGE 1.15, SPLIT 2.20
    const kLOD = kRaw <= 0 ? 0 : kRaw >= 1 ? 1 : kRaw * kRaw * (3 - 2 * kRaw);   // smoothstep
    this._lodK = kLOD;
    const lift = nodeK * kLOD;
    const LY = (n) => (n.z ? n.y + n.z * n.h * (1 - lift) : n.y);
    this._LY = LY;   // ONE definition — `pairMid` reads the same lift the frame just drew with
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

    // hit-stop recoil: a decaying camera shake after an out-of-band landing
    let shk = 0;
    if (this._shake) { const sa = this.now - this._shake.t0; if (sa < 0.22) shk = Math.sin(sa * 80) * 5 * (1 - sa / 0.22); else this._shake = null; }
    const ox = W / 2 - this.cam.cx * scale + shk, oy = H / 2 - this.cam.cy * scale + shk;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);

    // grid
    const halfW = this.cam.vw / 2, halfH = (H / scale) / 2;
    const L = this.cam.cx - halfW, R = this.cam.cx + halfW, Tp = this.cam.cy - halfH, B = this.cam.cy + halfH;
    const gs = 60;
    ctx.lineWidth = 1 / scale;
    if (this._hasGround) {
      // ── THE GROUND PLANE, AT LAST (v1.113.2) ────────────────────────────────────────────────
      // The grid was not missing — it was WRONG, and it was cancelling the projection. An
      // axis-aligned square lattice under an isometric point cloud is the strongest possible
      // statement that this is a flat top-down map, and it has been drawn under every iso frame
      // shot so far (visible as vertical bars in iso-1-overview.png). The owner's own
      // prescription — "make the 2.5D grid a little bit more obvious" — is really: draw the
      // right one.
      //
      // The ground lattice is the set of lines of constant ground-x and constant ground-y. Under
      // the baked matrix those project to two families at ±30° from horizontal, and the matrix
      // hands us two gifts: it maps the orthonormal ground basis to two UNIT vectors exactly
      // 120° apart (precisely the owner's description), so `gs = 60` carries over 1:1 with no
      // retuning, and inverting it for the visible rect is two lines of algebra.
      const IC = 0.8660254, IS = 0.5;              // cos30, sin30 — the emitter's own constants
      const gX = (x, y) => x / (2 * IC) + y / (2 * IS);   // screen -> ground x
      const gY = (x, y) => -x / (2 * IC) + y / (2 * IS);  // screen -> ground y
      let gx0 = Infinity, gx1 = -Infinity, gy0 = Infinity, gy1 = -Infinity;
      for (const [cx0, cy0] of [[L, Tp], [R, Tp], [L, B], [R, B]]) {
        const a = gX(cx0, cy0), b2 = gY(cx0, cy0);
        if (a < gx0) gx0 = a; if (a > gx1) gx1 = a;
        if (b2 < gy0) gy0 = b2; if (b2 > gy1) gy1 = b2;
      }
      // Two levels, never more: one 60u lattice would be 32px apart at overview but 660px at roll
      // zoom, where four lines on screen stop being a grid. The major carries the plane when you
      // are close; the minor fades in as the ground fills the viewport.
      const drawLat = (step, alpha) => {
        if (alpha <= 0.004) return;
        ctx.strokeStyle = "rgba(150,175,235," + alpha.toFixed(4) + ")";
        ctx.beginPath();
        for (let g = Math.floor(gx0 / step) * step; g <= gx1; g += step) {
          ctx.moveTo((g - gy0) * IC, (g + gy0) * IS); ctx.lineTo((g - gy1) * IC, (g + gy1) * IS);
        }
        for (let g = Math.floor(gy0 / step) * step; g <= gy1; g += step) {
          ctx.moveTo((gx0 - g) * IC, (gx0 + g) * IS); ctx.lineTo((gx1 - g) * IC, (gx1 + g) * IS);
        }
        ctx.stroke();
      };
      // The ground is PRESENT at every zoom (owner: "make the 2.5D grid a little bit more
      // obvious") — the major lattice never fades below two thirds, because a plane that
      // disappears when you pull back stops being a plane. Only the fine lattice is zoom-gated,
      // and only because 60u is 32px at overview but 660px at roll zoom, where four lines on
      // screen have stopped being a grid.
      const gFade = Math.max(0, Math.min(1, (scale - 0.55) / 1.2));
      drawLat(240, 0.075 * A * dim * (0.66 + 0.34 * gFade));
      drawLat(60, 0.055 * A * dim * gFade);
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.beginPath();
      for (let x = Math.floor(L / gs) * gs; x < R; x += gs) { ctx.moveTo(x, Tp); ctx.lineTo(x, B); }
      for (let y = Math.floor(Tp / gs) * gs; y < B; y += gs) { ctx.moveTo(L, y); ctx.lineTo(R, y); }
      ctx.stroke();
    }

    // ── THE SITE POOL: the tie that is not a line (v1.113.2) ───────────────────────────────────
    // The owner rejected a dashed connector for the right reason ("there's no direct translation
    // of that"), and two collinear drop lines would have rebuilt exactly the object he vetoed. A
    // shared pool of light ON THE GROUND says "these two orbs are one place" without claiming any
    // traversal — the same job a shadow does in an isometric game, inverted because a DARK mark
    // on #1a1a2e is nine luminance levels and the focus halo composites over it in "lighter" and
    // erases it. Light survives, and keeps the planets/neurons feel the graph already has.
    //
    // ONE ellipse per SITE (1467, not one per node), rx/ry = √3 because that is what a circle on
    // the ground becomes under the baked matrix, and sized ~1.8r so it reads as a pool the pair
    // stands in rather than a shadow hidden behind them. One beginPath, one fill: 3x cheaper than
    // per-node fills, and the nonzero-winding union stops overlapping pools double-brightening.
    if (this._hasGround && kLOD > 0.02) {
      const pad = 40 / scale;
      ctx.fillStyle = "rgba(188,208,255," + (0.055 * A * dim * kLOD).toFixed(4) + ")";
      ctx.beginPath();
      for (const n of this.nodes) {
        if (!n.rep || !n.z) continue;                       // one per site, singles have no pool
        const gyy = n.y + n.z * n.h;                        // the ground point itself
        if (n.x < L - pad || n.x > R + pad || gyy < Tp - pad || gyy > B + pad) continue;
        const rx = n.rSite * nodeK * 2.2, ry = rx / 1.7320508;
        ctx.moveTo(n.x + rx, gyy);
        ctx.ellipse(n.x, gyy, rx, ry, 0, 0, 6.2832);
      }
      ctx.fill();
    }

    // base links
    ctx.lineWidth = 0.6 / scale; ctx.strokeStyle = "rgba(170,182,215," + (0.12 * A * dim) + ")";
    ctx.beginPath();
    for (const [a, b] of this.links) { const na = this.nodes[a], nb = this.nodes[b]; ctx.moveTo(na.x, LY(na)); ctx.lineTo(nb.x, LY(nb)); }
    ctx.stroke();

    ctx.globalCompositeOperation = "lighter";
    // tension sweep: a needle arcs the committed node toward its landing angle vs a band
    // sized to the move's success chance — where it stops IS the verdict (same rng draw).
    if (this._sweep) {
      const sw = this._sweep, sn = this.nodes[sw.idx], sa2 = this.now - sw.t0;
      if (sn) {
        const R0 = 22, a0 = -Math.PI / 2;
        ctx.lineWidth = 5 / scale; ctx.strokeStyle = "rgba(126,224,168,.55)";
        ctx.beginPath(); ctx.arc(sn.x, sn.y, R0, a0, a0 + sw.band * Math.PI * 2); ctx.stroke();
        const prog = Math.max(0, Math.min(1, (sa2 - sw.hold) / sw.dur));
        const ease = 1 - Math.pow(1 - prog, 3);
        const ang = a0 + sw.roll * Math.PI * 2 * ease;
        const pulse = prog <= 0 ? 1 + 0.25 * Math.sin(sa2 * 18) : 1;
        ctx.lineWidth = 2.5 / scale; ctx.strokeStyle = "rgba(255,255,255,.92)";
        ctx.beginPath();
        ctx.moveTo(sn.x + Math.cos(ang) * (R0 - 8) * pulse, sn.y + Math.sin(ang) * (R0 - 8) * pulse);
        ctx.lineTo(sn.x + Math.cos(ang) * (R0 + 8) * pulse, sn.y + Math.sin(ang) * (R0 + 8) * pulse);
        ctx.stroke();
      }
    }
    // active edges: the selected node's connections take the destination's color, with width and
    // brightness scaled by the PRECOMPUTED likelihood of actually taking that edge (occurrence% ×
    // success% for a position's moves; outcome% for a technique's landings) relative to the
    // node's strongest edge — the probable paths read instantly, the unlikely ones stay whisper-faint.
    if (this.adj && this.alpha > 0.05) {
      const NN = this.nodes.length;
      const lit = [];
      if (this.focusIdx >= 0) lit.push(this.focusIdx);
      if (this._dossierIdx != null && this._dossierIdx !== this.focusIdx) lit.push(this._dossierIdx);
      for (const li of lit) {
        const cn = this.nodes[li]; if (!cn || !this.adj[li]) continue;
        const mw = (this._maxW && this._maxW[li]) || 0;
        for (const k2 of this.adj[li]) {
          const o = this.nodes[k2]; if (!o) continue;
          const w = (this._edgeW && this._edgeW.get(li * NN + k2)) || 0;
          const rel = mw > 0 ? w / mw : 0;
          ctx.lineWidth = (0.8 + 1.4 * rel) / scale;
          const g2 = ctx.createLinearGradient(cn.x, cn.y, o.x, o.y);
          g2.addColorStop(0, this.rgba(o.col, (0.04 + 0.06 * rel) * A * dim));
          g2.addColorStop(1, this.rgba(o.col, (0.10 + 0.28 * rel) * A * dim));
          ctx.strokeStyle = g2;
          ctx.beginPath(); ctx.moveTo(cn.x, cn.y); ctx.lineTo(o.x, o.y); ctx.stroke();
        }
      }
    }
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
      for (let i = p.seg + 1; i < p.path.length; i++) { const n = this.nodes[p.path[i]]; ctx.lineTo(n.x, LY(n)); }
      ctx.stroke();
    }
    // comet trail
    for (const e of this.trail) {
      const age = this.now - e.time; const k = Math.max(0, 1 - age / 2.6); if (k <= 0) continue;
      const na = this.nodes[e.a], nb = this.nodes[e.b];
      const tc = e.tint ? this.lerpCol(nb.col, e.tint, 0.6) : nb.col;
      ctx.strokeStyle = this.rgba(tc, 0.6 * k * glow * A);
      ctx.lineWidth = (0.8 + 2.4 * k) / scale;
      ctx.beginPath(); ctx.moveTo(na.x, LY(na)); ctx.lineTo(nb.x, LY(nb)); ctx.stroke();
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
        ctx.beginPath(); ctx.moveTo(a.x, LY(a)); ctx.lineTo(a.x + (b.x - a.x) * e, LY(a) + (LY(b) - LY(a)) * e); ctx.stroke();
        if (tt <= 1) {
          const hx = a.x + (b.x - a.x) * e, hy = LY(a) + (LY(b) - LY(a)) * e;
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

    // EVERY RING IS A MULTIPLE OF THE DRAWN ORB, NOT OF `n.r` (v1.114.0). The three passes below
    // and the retired focus ring were all authored when `n.r` WAS the drawn radius. v1.113.1 made
    // it `n.r * nodeK` and told none of them, so at roll zoom (nodeK = 0.4) a "2.4x" option ring
    // was drawn at **6x** the orb it rings, a "2.7x" focus-set ring at 6.75x and a "3x" session
    // ring at 7.5x. Seen on screen: the owner's "bigger, wider circle" around every card in the
    // hand, not just under the node you stand on. At overview (nodeK = 1) nothing moves — these
    // are the authored proportions, now honoured at every camera.
    // session highlight rings (from "Suggested for you" etc.)
    if (this._sessionNodes && this._sessionNodes.length) {
      const pulse = 0.5 + 0.5 * Math.sin(this.now * 2.6);
      for (const k of this._sessionNodes) {
        const n = this.nodes[k]; if (!n) continue;
        ctx.strokeStyle = this.rgba(n.col, (0.45 + 0.4 * pulse) * A);
        ctx.lineWidth = 2 / scale;
        ctx.beginPath(); ctx.arc(n.x, LY(n), n.r * nodeK * 3, 0, 6.2832); ctx.stroke();
        ctx.fillStyle = this.rgba(n.col, 0.1 * A);
        ctx.beginPath(); ctx.arc(n.x, LY(n), n.r * nodeK * 3, 0, 6.2832); ctx.fill();
      }
    }

    // focus rings — the members of the lit selection (a System now, a shared List later). The fog
    // below dims everything else; these rings are the "lights up" half of the same effect.
    if (this._focusIdxSet && this._focusIdxSet.size) {
      const pulse = 0.5 + 0.5 * Math.sin(this.now * 2.2);
      for (const k of this._focusIdxSet) {
        const n = this.nodes[k]; if (!n) continue;
        ctx.strokeStyle = this.rgba(n.col, (0.4 + 0.35 * pulse) * A);
        ctx.lineWidth = 1.8 / scale;
        ctx.beginPath(); ctx.arc(n.x, LY(n), n.r * nodeK * 2.7, 0, 6.2832); ctx.stroke();
      }
    }

    // option rings (during land)
    if (this.optionIdxs.length) {
      const pulse = 0.5 + 0.5 * Math.sin(this.now * 3);
      for (const k of this.optionIdxs) {
        const n = this.nodes[k];
        ctx.strokeStyle = this.rgba(n.col, (0.3 + 0.35 * pulse) * A);
        ctx.lineWidth = 1.4 / scale;
        ctx.beginPath(); ctx.arc(n.x, LY(n), n.r * nodeK * 2.4, 0, 6.2832); ctx.stroke();
      }
    }

    // base nodes — shrink a touch when zoomed in so dense clusters separate
    // (nodeK is hoisted to the top of draw() since v1.113.1: the pair lift scales with it)
    const br = this.anim("idleBreath", 2) * 0.01;
    // (owner call: the original glyph NEVER hides — the dossier card renders on top of it)
    // one fog rule, two owners: an explicit focus set (a System's members, later a List's) outranks
    // the path view's curriculum territory while it is up.
    const fogSet = (this._focusIdxSet && this._focusIdxSet.size) ? this._focusIdxSet : (this._pathDim ? this._curriculumIdxSet : null);
    // MITOSIS (v1.113.1). Zoomed out a pair IS its site: the representative wears the historical
    // hub radius and its twin has faded to nothing, on the exact ground point the single node
    // always occupied — so the overview is the map people already know. Zooming in, the
    // representative shrinks to its own radius while the twin fades up and the two slide apart.
    // Position is collapsed continuously by LY(), so the fade only ever finishes on top of a
    // coincident pair — nothing pops, and no crossfade is needed.
    const cullPad = 60 / scale, cxv = this.cam.cx, cyv = this.cam.cy, halfVW = this.cam.vw / 2, halfVH = (H / scale) / 2;
    const spec = this._hasGround ? [] : null;
    for (const n of this.nodes) {
      // viewport cull — the pass had none, and it issues a fill for every node at every zoom
      if (n.x < cxv - halfVW - cullPad || n.x > cxv + halfVW + cullPad) continue;
      const ny = LY(n);
      if (ny < cyv - halfVH - cullPad || ny > cyv + halfVH + cullPad) continue;
      let rr = n.r, aK = 1;
      if (n.z) {
        if (n.rep) rr = n.rSite + (n.r - n.rSite) * kLOD;
        else { aK = kLOD; if (aK < 0.02) continue; }
      }
      const bk = br ? 1 + br * Math.sin(this.now * 1.4 + n.idx * 0.83) : 1;
      const fogK = fogSet && !fogSet.has(n.idx) ? 0.3 : 1;
      const rD = rr * nodeK * bk;
      ctx.fillStyle = this.rgba(n.z < 0 && n.colU ? n.colU : n.col, 0.62 * A * dim * fogK * aK);
      ctx.beginPath(); this.shapePath(ctx, n.ty, n.x, ny, rD); ctx.fill();
      // one light direction for the whole scene — collected here, painted in a single batch below
      if (spec && rD * scale > 7 && aK > 0.55 && fogK > 0.5) spec.push(n.x - rD * 0.3, ny - rD * 0.3, rD * 0.4);
    }
    // ── LIGHT IS WHAT THE EYE READS DEPTH FROM (v1.113.2) ──────────────────────────────────────
    // An affine shear with no shading is invisible — that is the whole reason the iso build did
    // not look 2.5D. One small off-centre highlight turns a flat disc into a lit sphere, and it
    // is the cheapest thing on the list: a single colour means a single path and a single fill
    // for the entire graph, gated on rendered size so it costs nothing at the zooms where the
    // orbs are too small to shade.
    if (spec && spec.length) {
      ctx.fillStyle = "rgba(255,255,255," + (0.1 * A * dim).toFixed(3) + ")";
      ctx.beginPath();
      for (let i = 0; i < spec.length; i += 3) {
        ctx.moveTo(spec[i] + spec[i + 2], spec[i + 1]);
        ctx.arc(spec[i], spec[i + 1], spec[i + 2], 0, 6.2832);
      }
      ctx.fill();
    }

    // ── THE ARRIVAL IS THE EVENT (v1.114.0) ──────────────────────────────────────────────────
    //
    // Owner: "when we go to a node there's this bigger, wider circle that appears, and it's
    // blooming, beaming — I don't like that very much. I'd rather have the pulse signal, the
    // white node that goes from one node to another; when it arrives at its final node its
    // bloom should grow a little bit more, like 50% or even 100% more. A bigger, wider circle
    // shouldn't appear on its back anymore."
    //
    // TWO passes were drawing that circle, and one of them was a scaling BUG. `nodeK` shrinks
    // every orb to 0.4x at roll zoom (v1.113.1) and this marker never applied it — so the fill
    // meant to be 1.28x the node was 1.28/0.4 = **3.2x** it, and the ring meant to sit just
    // outside at 2.9x was **7.25x**, a circle seven times the node it marks. The second was the
    // sustained halo below (deleted outright): a breathing radial gradient with a 46px screen
    // floor, lit all roll long, which is the "blooming, beaming" the owner named. The steady
    // state is now a MARK — the node's own silhouette in your perspective colour, with a rim —
    // and the light is spent where it means something: the moment the move lands.
    if (this.focusIdx >= 0 && !this.pulse) {
      const n = this.nodes[this.focusIdx];
      const pc = this.myColor(n);
      // landing settle: damped overshoot when the roll arrives
      let settle = 1;
      if (this.anim("landingSettle", true) && this._settleT) {
        const sa = this.now - this._settleT;
        if (sa >= 0 && sa < 0.9) settle = 1 + 0.26 * Math.exp(-3.4 * sa) * Math.sin(sa * 14);
      }
      // 1.28 is the AUTHORED ratio, restored — the bug was never the ratio, it was `nodeK`
      // missing from it. The mark is a quarter bigger than its neighbours, repainted at 0.98
      // alpha against their 0.62, and rimmed; that is "this one" without being a wide circle.
      const rM = n.r * nodeK * 1.28 * settle;
      // recolor the current node to YOUR perspective (red when you're losing, blue when winning)
      ctx.fillStyle = this.rgba(pc, 0.98 * A);
      ctx.beginPath(); this.shapePath(ctx, n.ty, n.x, LY(n), rM); ctx.fill();
      // the rim was the SAME colour as the fill, i.e. invisible — a "selected" outline has to
      // contrast with what it outlines, so it is lightened toward white.
      ctx.strokeStyle = this.rgba(this.lerpCol(pc, { r: 255, g: 255, b: 255 }, 0.55), 0.95 * A);
      ctx.lineWidth = 2 / scale;
      ctx.beginPath(); this.shapePath(ctx, n.ty, n.x, LY(n), rM); ctx.stroke();
    }

    ctx.globalCompositeOperation = "lighter";
    // flaring nodes — the arrival bloom, and since v1.114.0 the ONLY bloom on the graph. `litK`
    // is ARRIVE_BLOOM (2) where the roll STOPS (`enterLand`, and the submission that ends a
    // round) and 1 everywhere else, including the technique node a move travels over. The
    // screen-space floor is inherited from the deleted halo and is what makes this read at roll
    // zoom, where nodeK has taken the orb down to 0.4x.
    for (const n of this.nodes) {
      const age = this.now - n.lit; if (age > 1.9) continue;
      const k = Math.max(0, 1 - age / 1.9);
      const amp = n.litK || 1;
      const gr = Math.max(n.r * nodeK * (1.8 + 4.2 * k) * amp, (34 * k * amp) / scale);
      const g = ctx.createRadialGradient(n.x, LY(n), 0, n.x, LY(n), gr);
      g.addColorStop(0, this.rgba(n.col, 0.9 * k * glow * A));
      g.addColorStop(0.4, this.rgba(n.col, 0.32 * k * glow * A));
      g.addColorStop(1, this.rgba(n.col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, LY(n), gr, 0, 6.2832); ctx.fill();
      ctx.fillStyle = this.rgba({ r: 255, g: 255, b: 255 }, 0.8 * k * A);
      ctx.beginPath(); this.shapePath(ctx, n.ty, n.x, LY(n), n.r * nodeK * (1 + 0.7 * k * amp)); ctx.fill();
    }

    // ── THE STATE YOU ARE STANDING IN IS NEVER DARK (v1.114.1) ────────────────────────────────
    //
    // v1.114.0 deleted the sustained halo, correctly — the owner named it ("blooming, beaming")
    // and it reached ~11x the drawn orb with a 46px screen floor. But deleting it outright left
    // NOTHING in its place, and the arrival bloom expires after 1.9s. Measured at roll zoom, a
    // settled node carried light to just 30px against a 21px orb: the orb and nothing else, for
    // the whole rest of the turn. Owner: "there seems to be no highlight at all now ... that
    // pulse, when it reaches the correct node, it disappears, and it becomes stale."
    //
    // This is the PRESENCE without the BEAM. It hugs the orb at 2.6x instead of 11x, carries a
    // third of the old alpha, and breathes slowly rather than beaming. It is additive with the
    // arrival bloom, which means the bloom no longer decays to zero at 1.9s — it decays INTO
    // this, so there is no cliff and no stale state. And it DRAINS into the pulse on departure
    // exactly as the halo did, which is what covers the marker's own cut at `!this.pulse`.
    if (this.focusIdx >= 0 && this.nodes[this.focusIdx]) {
      const cur = this.nodes[this.focusIdx];
      const pu = this.pulse;
      let dep = 1;
      if (pu && !pu.done) {
        dep = pu.path && pu.path[0] === this.focusIdx
          ? Math.max(0, 1 - (pu.seg + (pu.t || 0)) * 1.4)   // leg 1: stream it into the light
          : 0;                                              // later legs: the light has left
      }
      if (dep > 0.01) {
        const kR = this.REST_GLOW * (0.86 + 0.14 * Math.sin(this.now * 1.6)) * dep * dim;
        const col2 = this.myColor(cur);
        const gr = Math.max(cur.r * nodeK * 2.6, 44 / scale);
        const g2 = ctx.createRadialGradient(cur.x, LY(cur), 0, cur.x, LY(cur), gr);
        g2.addColorStop(0, this.rgba(col2, 0.62 * kR * glow * A));
        g2.addColorStop(0.45, this.rgba(col2, 0.24 * kR * glow * A));
        g2.addColorStop(1, this.rgba(col2, 0));
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(cur.x, LY(cur), gr, 0, 6.2832); ctx.fill();
      }
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

    // ── NOTHING IS WRITTEN INSIDE A NODE (v1.114.0) ──────────────────────────────────────────
    //
    // Owner, on both halves of the same idea: "we don't want content to appear inside any node…
    // the label, which consists of the role and the technique name, should appear to the right
    // of it — that's the winner design for labelling these nodes, even when we zoom in or zoom
    // out" and "when we're zooming in we want to see other nodes that are around it, we don't
    // want more detail on a node. To see details on a node we click on it. We don't zoom in
    // anymore."
    //
    // So the ~68-line pass that filled every orb over 20px with a dark plate, a kicker and a
    // wrapped name is DELETED, and with it the last consumer of `_nodeCardOn` in the draw loop.
    // Zoom is now purely a camera: it changes how many nodes you can see, never what a node
    // says. What a node says lives beside it, in ONE design, at every scale — `richLabel`
    // below, which used to be suppressed above 20px precisely because this pass took over.
    //
    // Two things that rode on it and had to move rather than die:
    //  · The state's NAME AND SIDE. v1.101.0 stripped the header off the landing card on the
    //    grounds that "the graph names the state" — it did, from in here. The focus's rich
    //    label now carries role + name unconditionally, so that promise still holds.
    //  · The dual prototype's per-orb side kicker (Q5). A twin that is not the focus carries no
    //    text at all now, which is the consistent reading of the same rule; if the pair needs to
    //    label both halves, that is a label-side decision, not an in-node one.

    // labels
    if (cfg.showLabels) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // HOW FAR RIGHT A NODE'S SILHOUETTE ACTUALLY REACHES, in screen px (v1.114.0). Every label
      // here anchored on `n.r * scale`, which stopped being the drawn radius twice over: `nodeK`
      // takes an orb to 0.4x at roll zoom, the mitosis LOD interpolates a representative between
      // its site radius and its own, and `shapePath` widens a triangle to 1.242r and a diamond to
      // 1.18r. Now that the label is THE naming design at every zoom it has to sit against the
      // edge it is naming, not against a number that only agreed with it at one camera.
      const halfW = (n) => {
        const rr = (n.z && n.rep) ? n.rSite + (n.r - n.rSite) * kLOD : n.r;
        const f = n.ty === "submissions" ? 1.242 : n.ty === "positions" ? 1 : 1.18;
        // ...and it must clear whatever the node is WEARING, not just its own silhouette. The
        // focus mark and the three ring passes are all concentric circles centred on it, and the
        // widest wins: measured on screen, an option's name started INSIDE its own 2.4x ring.
        let worn = f;
        if (n.idx === this.focusIdx && !this.pulse) worn = Math.max(worn, 1.28);
        if (this.optionIdxs && this.optionIdxs.indexOf(n.idx) >= 0) worn = Math.max(worn, 2.4);
        if (this._focusIdxSet && this._focusIdxSet.has(n.idx)) worn = Math.max(worn, 2.7);
        if (this._sessionNodes && this._sessionNodes.indexOf(n.idx) >= 0) worn = Math.max(worn, 3);
        return rr * nodeK * worn * scale;
      };
      // transient names on recently-lit nodes (excluding the focus, which gets a rich label)
      ctx.textBaseline = "bottom";
      ctx.font = "600 12px 'Plus Jakarta Sans', sans-serif";
      for (const n of this.nodes) {
        const age = this.now - n.lit; if (age > 3.2 || n.idx === this.focusIdx) continue;
        if (this.activeMove && n.idx === this.activeMove.idx) continue;
        if (this.optionIdxs.indexOf(n.idx) >= 0) continue; // outgoing nodes get persistent labels below
        const k = Math.max(0, 1 - age / 3.2);
        const sx = (n.x - this.cam.cx) * scale + W / 2, sy = (LY(n) - this.cam.cy) * scale + H / 2;
        if (sx < -60 || sx > W + 60 || sy < 0 || sy > H + 20) continue;
        ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 6;
        ctx.fillStyle = this.rgba({ r: 238, g: 241, b: 246 }, 0.8 * k * A);
        ctx.fillText(this.splitName(n.t).main, sx + halfW(n) + 9, sy - 7); ctx.shadowBlur = 0;
      }
      // rich label = role + name, anchored beside a node
      const richLabel = (idx, role, roleCol, name, big) => {
        const n = this.nodes[idx]; if (!n) return;
        const sx = (n.x - this.cam.cx) * scale + W / 2, sy = (LY(n) - this.cam.cy) * scale + H / 2;
        if (sx < -120 || sx > W + 260 || sy < -30 || sy > H + 50) return;
        const ox = sx + halfW(n) + 11;
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
          const sx = (n.x - this.cam.cx) * scale + W / 2, sy = (LY(n) - this.cam.cy) * scale + H / 2;
          if (sx < -60 || sx > W + 60 || sy < 0 || sy > H + 20) continue;
          ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 6;
          ctx.fillStyle = this.rgba(n.col, 0.95 * A);
          ctx.fillText(this.splitName(n.t).main, sx + halfW(n) + 9, sy - 7); ctx.shadowBlur = 0;
        }
      }
      // THE ONE LABELLING DESIGN, AT EVERY ZOOM (v1.114.0). This used to be suppressed the moment
      // the node grew past 20px, because above that the in-node pass took over and drawing both
      // printed the state's name twice. That pass is gone, so the suppression goes with it: the
      // selected node is named beside itself whether you are looking at the whole graph or at one
      // orb filling the screen. Drawn LAST so it sits above the outgoing-node labels.
      if (this.focusIdx >= 0 && !this.pulse) {
        const n = this.nodes[this.focusIdx];
        // every position hub is titled "… Top" in graph-data.json — a rendering artifact of the
        // visual collapse, not a claim about the side, so it comes off here as everywhere else.
        const nm = n.ty === "positions" ? this.posFamily(n.t) : this.displayName(n);
        const partner = n.pi >= 0 ? this.nodes[n.pi] : null;
        if (partner) {
          // ── ONE LABEL GROUP FOR A DUAL PAIR (v1.114.3) ──────────────────────────────────────
          // Owner: "the main label stays positioned in the middle on the right, and the active
          // role appears above or below it in case we hover over it. It's not two labels, it's
          // just one group of labels that's dynamic, in which the subtitle's position seems to
          // appear depending on where you are."
          //
          // So the NAME never moves: it sits on the horizontal line equidistant between the two
          // orbs, which is what makes above/below mean anything. The SUBTITLE'S SIDE is the whole
          // signal — above for the top/attacker half, below for the bottom/defender half — and
          // hovering either orb moves it without disturbing the name.
          let act = n;
          if (this._hover && this._hover.idx >= 0 && this.now - (this._hover.t || 0) < 0.5) {
            const hv = this.nodes[this._hover.idx];
            if (hv === n || hv === partner) act = hv;
          }
          const mid = this.pairMid(n);
          const sx = (mid.x - this.cam.cx) * scale + W / 2;
          const sy = (mid.y - this.cam.cy) * scale + H / 2;
          if (sx > -140 && sx < W + 280 && sy > -40 && sy < H + 60) {
            const ox = sx + Math.max(halfW(n), halfW(partner)) + 11;
            const above = act.z > 0;
            // "ATTEMPTING", not "ATTACKING" (owner's word). It also keeps this clear of
            // `activeMove.verb`, which names YOUR POSTURE during travel (v1.104.1) and must not
            // start sharing vocabulary with a label about which half of a pair you are on.
            const sub = n.ty === "positions"
              ? (above ? "TOP" : "BOTTOM")
              : (above ? "ATTEMPTING" : "DEFENDING");
            const subCol = act.idx === this.focusIdx
              ? this.myColor(act)
              : (act.z < 0 && act.colU ? act.colU : act.col);
            const dfam = this._displayFam || "'Space Grotesk'";
            ctx.shadowColor = "rgba(0,0,0,0.92)"; ctx.shadowBlur = 8;
            ctx.textBaseline = "alphabetic";
            ctx.font = "700 18px " + dfam + ", sans-serif";
            ctx.fillStyle = this.rgba({ r: 240, g: 243, b: 248 }, A);
            ctx.fillText(nm, ox, sy + 6);
            ctx.font = "700 11px " + dfam + ", sans-serif";
            ctx.fillStyle = this.rgba(subCol, A);
            ctx.fillText(sub, ox, above ? sy - 12 : sy + 24);
            ctx.shadowBlur = 0;
          }
        } else {
          // the kicker the deleted in-node pass carried: category, plus the side YOU are playing.
          const rl = this.roleLabel();
          const kick = (n.ty === "positions" ? "POSITION" : n.ty === "submissions" ? "SUBMISSION" : "TRANSITION")
            + (rl ? " · " + String(rl).toUpperCase() : "");
          richLabel(this.focusIdx, kick, this.myColor(n), nm, true);
        }
      }
      // hover: nearest node label (brighter + "your move" tag if it's an outgoing option)
      // ...but NOT for a member of the focused pair: the label group above already names it, and
      // its whole point is that the name does not move — a second copy hanging off the hovered
      // orb would be the "printed twice" problem the in-node pass had (v1.114.0), on hover.
      const _hovIsPairHalf = this._hover && this._hover.idx >= 0 && this.focusIdx >= 0 &&
        (this._hover.idx === this.focusIdx || this._hover.idx === this.nodes[this.focusIdx].pi);
      if (this._hover && this._hover.idx >= 0 && !_hovIsPairHalf && this.now - (this._hover.t || 0) < 0.5) {
        const n = this.nodes[this._hover.idx];
        const sx = (n.x - this.cam.cx) * scale + W / 2, sy = (LY(n) - this.cam.cy) * scale + H / 2;
        const isOpt = this.optionIdxs && this.optionIdxs.indexOf(n.idx) >= 0;
        const hx = sx + halfW(n) + 10;
        ctx.textBaseline = "bottom";
        ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 7;
        if (isOpt) { ctx.font = "700 10px 'Plus Jakarta Sans', sans-serif"; ctx.fillStyle = this.rgba(n.col, A); ctx.fillText("YOUR MOVE", hx, sy - 22); }
        ctx.font = "600 13px 'Plus Jakarta Sans', sans-serif";
        ctx.fillStyle = this.rgba({ r: 240, g: 243, b: 248 }, A);
        ctx.fillText(this.splitName(n.t).main, hx, sy - 8);
        ctx.shadowBlur = 0;
      }
    }
  }
}