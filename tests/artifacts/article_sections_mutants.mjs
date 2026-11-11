// v1.253.0 RETIRED with their subject (U114 a, the article's ✕ and the shelf): reading-shelf-retained and u110-close-on-article-edge.
// Their source is gone, so no build can carry them. So is u59r4-reopen-ungated (#354's review, finding 2): its journey, putting the article
// away and back, went with them. u59-pill-covers and reader-end-double-gap were retargeted onto _readerReserve's lane
// (both killed). pane-card-overflow lost its spec with the map view's dock tests; retargeted onto pane-layout.spec.ts it is NOT KILLED,
// so the card's width with the pane open at 800px has no live claim now.
// v1.252.1 recorded NON-KILL, not coverage: u59r4-table-margin. Its claim, that Quartz's table margin clips a three-column table, needed
// a 340px lane; since U110 a and U104 no lane above the phone is narrower than 439px, and with the margin back neither 768x1024 (one
// 496px column), 1024x768 (two 439px lanes) nor 390x844 clips a table. The margin:0 stays; nothing can see it now.
// H139 recorded NON-KILLS, not coverage: execution-node-band-removed, d338-film-waits-for-intent,
// and d353-play-keeps-pin. Under layout C the old catch has no film above its question, so
// d351-deferral-removed and d352-film-over-pin also passed their old catch claims. They now target
// the existing calm phone late-film journey, where a late film can move already-published answers.
// H139 phone-catch-question-first-lost-844 stopped before its claim on a detached temporary marker;
// -631 had a red 30s baseline. Neither counts as a kill; H140's 3/3 per timeout arm did not establish cause.
// DASHCX1 reran all controls against green, nonempty baselines: those three still survive, as do
// d338-page-scrolls-flow-top and d338-clamped-place-lost. Record these five as coverage gaps, not kills.
// Run only after a green built suite and a heavy-advisory GO, outside the build lock. Private
// Playwright config and scratch output are required; no source or baseline edits.
// SECTIONS_MUTANT_CONFIG=/.../playwright.config.ts SECTIONS_MUTANT_OUT=/... node tests/artifacts/article_sections_mutants.mjs
// Optional SECTIONS_MUTANT_ONLY selects named controls after their focused journeys pass.
// SECTIONS_MUTANT_TIMEOUT_MS can use the private runner's 240000ms bound for measured long camera journeys;
// the default 30000ms is deliberately short. An expired baseline never counts as a mutation kill.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
const root = resolve(import.meta.dirname, '../..')
const require = createRequire(resolve(root, 'source/package.json'))
const { build } = require('esbuild')
const config = process.env.SECTIONS_MUTANT_CONFIG, out = process.env.SECTIONS_MUTANT_OUT
if (!config || !out) throw Error('An isolated config and scratch output are required')
const testTimeout = Number(process.env.SECTIONS_MUTANT_TIMEOUT_MS || 30000)
if (!Number.isInteger(testTimeout) || testTimeout < 1 || testTimeout > 240000) throw Error('Invalid mutation test timeout')
mkdirSync(out, { recursive: true })
// An isolated served tree lets the reader controls run without changing another suite's bundle.
// Its private config MUST serve this exact directory; the source inputs still come from this worktree.
const served = resolve(process.env.SECTIONS_MUTANT_PUBLIC || resolve(root, 'source/public'))
const readerPath = resolve(served, 'static/neural/app/reader.js')
const cssPath = resolve(served, 'static/neural/app/reading.css')
const source = readFileSync(resolve(root, 'neural/src/reader.src.js'), 'utf8')
const originals = new Map([readerPath, cssPath].map(p => [p, readFileSync(p)]))
const replace = (text, from, to) => {
  if (!text.includes(from)) throw Error('Mutation target moved: ' + from)
  return text.replace(from, to)
}
const sections = 'article-sections.spec.ts', seam = 'reading-media-placement.spec.ts', contract = 'reading-contract.spec.ts'
// D-368 control: the pre-C integration. The game film goes to its Videos slot and the Videos section is lifted
// column-wide above Moves again.
const columnWideVideos = s => replace(replace(s,
  'if (wants && correct && !a._readerPin && referencePath) this.place(this.mediaSlot);', 'if (wants && correct && !a._readerPin) this.place(this.mediaSlot);'),
  '        let y = band + Math.max(headHeight, step) + (chrome?.offset || 0);\n',
  '        let y = band + Math.max(headHeight, step) + (chrome?.offset || 0);\n        const lifted = !pin && this.sections.find(s => s.type === "videos")?.card;\n        if (lifted) { if (lifted.parentElement !== this.game) { this.mediaHome.after(lifted); this.videoCard = lifted; } position(lifted, left, y, width); y += lifted.getBoundingClientRect().height + step; }\n')

// D-433 (2026-10-26), D-370 adapted to U35: losing phone question-first
// placement must fail the new no-scroll claim. U16's opposite premise is retired.
const phoneQuestionFirstLost = s => replace(s,
  'const questionFirst = phoneCatch && showCard && row;', 'const questionFirst = false;')
const neverPublish = s => replace(s, 'card?.removeAttribute("data-reader-pending");', '/* mutant: never publish */')
// D-318 U4a control: restore the actual retired e26 gutter correction.
const retiredGutter = `  frameCamera(target) {
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
`;
const mutants = [
  // D-501: restore the ancestor move that reloads a seatless reference player's document.
  ['d501-card-insert-before', seam, 'published reference videos.*Learning/Position-Over-Submission 1440px.*native card moves',
    s => replace(s, 'parent.moveBefore(s.card, parent.children[i] || null)', 'parent.insertBefore(s.card, parent.children[i] || null)')],
  // D-482: reach the claim through the approved U25 disclosure and actual inline-link fragments.
  ['d482-closed-anchor-hidden', sections, '390px unknown authored sections and cross-section anchors',
    s => replace(s, 'this.toggleSection(section.dataset.sectionType, true); this.layoutNow();', '/* mutant: leave the anchor target hidden */')],
  ['d482-hidden-row-inert', 'reading-navigation.spec.ts', '390px native reading keys and section toggles',
    s => replace(s, 'const opening = !sectionShown(this.app, group.type);', 'const opening = !sectionShown(this.app, group.type); if (opening) return;')],
  ['content-loss', sections, 'semantic sections.*Mount/Bottom', s => replace(s, 'fragment.append(part.node);', 'part.node.querySelector?.("p")?.remove(); fragment.append(part.node);')],
  ['wrong-order', sections, 'semantic sections.*Knee-Slice-Pass/Attacker', s => replace(s, 'return rank(a) - rank(b);', 'return rank(b) - rank(a);')],
  ['settings-ignored', sections, 'section settings carry', s => replace(s, 'return app.get("readerSection." + type, true) !== false;', 'return true;')],
  ['collapsed-body-still-visible', sections, 'contents and header targets at 390x844', s => replace(s, 'body.hidden = !shown;', 'body.hidden = false;')],
  ['aria-control-broken', sections, 'contents and header targets at 390x844', s => replace(s, '"data-section-toggle": group.type, "aria-controls": id + "-body"', '"data-section-toggle": group.type, "aria-controls": id + "-missing"')],
  ['game-label-control-broken', sections, 'D-338 1440px', s => replace(s, '"data-game-open": part, "aria-controls": id + "-body"', '"data-game-open": part, "aria-controls": id + "-missing"')],
  ['late-game-control-target', sections, 'late question backfill', s => replace(replace(s,
    'if (s.part || s.type === "videos") this.paintPart(s);',
    'if (s.part || s.type === "videos") this.paintPart(s); if (s.part && body) body.id = s.id + "-body";'),
    'if (key === "card" || key === "hand") el.id = "reader-" + key + "-body";', '/* mutant: only the old sync binds the body */')],
  ['phone-contents', sections, 'contents and header targets at 390x844', s => replace(s, '|| !fits;', '|| false;')],
  ['label-toggles', sections, 'contents and header targets at 1366x768', s => replace(s, 'else if (section) this.scrollTo(section.card, section.toggle);', 'else if (section) { this.toggleSection(section.type); this.scrollTo(section.card, section.toggle); }')],
  // RETIRED (D-338): 'eye-scrolls' guarded "an index eye changes visibility without navigation";
  // the index has no eyes, so the claim and its control go together.
  ['toc-input-guard-lost', sections, 'floating contents owns.*dark', s => replace(s, 'contents.style.pointerEvents = "auto";', 'contents.style.pointerEvents = "auto"; this.app._readerTocEl = null;')],
  ['toc-camera-gutter-restored', sections, 'current node stays centred', s => replace(replace(s, '  destroy() {', retiredGutter + '  destroy() {'), '  app._readerFailed = false;', '  app._readerFailed = false; const paneCamera = app._paneCameraTarget; app._paneCameraTarget = function (target) { return reader.frameCamera(paneCamera.call(this, target)); };')],
  // RETIRED (v1.230.0, feat/video-cards merged): reader-overwrites-inspect guarded the reader leaving
  // Inspect's closing row transform alone (roll-execution 'with reader layout during close'). Inspect,
  // its close and that journey are retired with the option-detail sheet, so the control has no claim.
  // D-326: restore the 11px band acceptance; the scrolled phone case must fail its painted-overlap claim.
  ['execution-thin-band-accepted', 'roll-execution.spec.ts', 'execution camera frames the technique at 390px; pane false; reduced motion true scrolled to the top', s => replace(s, 'card.top - toast.bottom >= box.bottom - box.top + 24', 'card.top > toast.bottom')],
  // D-331 S1: every placement search fails, so each frame takes the counted no-fit fallback.
  ['execution-no-fit-forced', 'roll-execution.spec.ts', 'execution camera frames the technique at 1440px; pane false; reduced motion false$', s => replace(s, '    const search = (within, reserved) => {', '    const search = (within, reserved) => { return null;')],
  // D-354 B2: the same fallback at the phone's arrival pick, now pressed by a mouse after the layout settles.
  ['d354-phone-pick-no-fit', 'roll-execution.spec.ts', 'execution camera frames the technique at 390px; pane false; reduced motion false$', s => replace(s, '    const search = (within, reserved) => {', '    const search = (within, reserved) => { return null;')],
  // D-329: drop the reader node band; the 390px exchange's pair is covered by the landing rows again.
  ['execution-node-band-removed', 'camera-continuity.spec.ts', '390px camera continuity.*an exchange from a node with no Videos section', s => replace(s, 'const nodeBand = this.nodeBand || null,', 'const nodeBand = null,')],
  ['execution-occupied-space-lost', 'roll-execution.spec.ts', 'execution camera frames.*1440px; pane false; reduced motion false after native wheel', s => replace(s, '  frameExecution(target, node) {', '  frameExecution(target, node) { return target;')],
  // D-333: the reader never publishes a new landing card, so a cold start's greeting stays hidden,
  // (D4-S1) the card behind the list picker is not readable, and (D-336) every claim that a visitor
  // sees the card, not only that it is built or counted, fails.
  ['landing-never-published', 'coldstart-funnel.spec.ts', 'funnel spine', neverPublish],
  ['landing-never-published-picker', 'lists-picker.spec.ts', 'the picker is reachable', neverPublish],
  ['landing-never-published-late-question', 'coldstart-late-payload.spec.ts', 'the harness can hold a payload back', neverPublish],
  ['landing-never-published-no-decks', 'coldstart-late-payload.spec.ts', 'a payload that never arrives', neverPublish],
  ['landing-never-published-list-item', 'lists-disclosure.spec.ts', 'clicking a listed technique opens its dossier', neverPublish],
  ['landing-never-published-label-restore', sections, 'D-338 1440px Questions and Moves close with their own', neverPublish],
  ['native-role-starts-game', sections, 'D-338 1440px', s => replace(s, 'if (reader.intent && node?.pi === this.focusIdx)', 'if (false)')],
  // D-355 (U11): where the index shows (1440, 1152) a closed part leaves no label in the content, so the label's
  // claims (it reopens, its contrast, it hides while open) are killed at 1024, the widest viewport without the index.
  ['question-label-does-nothing', sections, 'D-338 1024px', s => replace(s, '() => this.toggle(part), { "data-game-open": part', '() => {}, { "data-game-open": part')],
  ['index-role-after-name', sections, 'D-338 1440px', s => replace(s, 'indexTitle.textContent = role + " " + this.app.graphName(node);', 'indexTitle.textContent = this.app.graphName(node) + " · " + role;')],
  ['section-x-repaint', sections, 'floating contents owns.*dark', s => replace(s, '      if (s.toggle.getAttribute("aria-expanded") !== String(shown)) {', '      if (!s.part) s.toggle.replaceChildren(...faces(s.type, s.title));\n      if (s.toggle.getAttribute("aria-expanded") !== String(shown)) {')],
  ['toc-shifts-column', sections, 'contents and header targets at 1440x900', s => replace(s, 'free.center - parseFloat(art.style.width) / 2', 'free.center - parseFloat(art.style.width) / 2 - 100')],
  // U97 b: the fit is the free width now. The claim is unchanged: a tablet has no index over its article.
  ['toc-overlaps-tablet', sections, 'contents and header targets at 1024x768', s => replace(s, 'free.width >= 1350', 'free.width >= 0')],
  ['toc-not-fixed', sections, 'floating contents owns.*dark', s => s, css => replace(css, '.ng-reader-toc{position:fixed', '.ng-reader-toc{position:absolute')],
  ['toc-container', sections, 'floating contents owns.*light', s => s, css => css + '\n.ng-reader-toc{background:#1b2034;border:1px solid #414c68;box-shadow:0 0 4px #000}\n'],
  ['missing-gap', sections, '1366px choices precede', s => s, css => replace(css, '--section-gap:6px', '--section-gap:0px')],
  // U16B-S1: target the closed label itself. The first #a8b0c2 is the OPEN divider title.
  // U25 now carries that same control in its disclosure; the 7:1 claim must kill this override.
  ['collapsed-contrast', sections, 'contents and header targets at 390x844', s => s,
    css => css + '\n.ng-reader .ng-section-card[data-collapsed=true] [data-section-toggle]{color:#555b68!important}\n'],
  ['game-collapsed-contrast', sections, 'D-338 1024px', s => s, css => css + '\n.ng-reader-closed-part [data-game-open]{color:#555b68!important}\n'],
  ['defender-hub-leak', contract, 'defender reading excludes.*Rear-Naked-Choke', s => replace(s, `shared.replaceChildren(...shared.querySelectorAll('[data-source-id="safety-considerations"]'));`, '/* mutant: keep the full attacker-rich hub */')],
  ['stale-response', contract, 'a late response cannot repaint', s => replace(replace(s, 'this.abort?.abort();', '/* mutant: no abort */'), 'if (serial !== this.renderSerial || this.app.__ngDestroyed) return;', 'if (this.app.__ngDestroyed) return;')],
  ['toc-current-targets', contract, 'a late response cannot repaint', s => replace(s, 'row.append(link, eyeOff()); contents.append(row);', 'if (section.type === "options") { link.textContent = "Decisions from bottom"; link.dataset.sectionLink = "stale-bottom"; } row.append(link, eyeOff()); contents.append(row);')],
  ['reference-videos-removed', seam, 'published reference videos remain playable.*Principles/Frames', s => replace(s, 'if (REFERENCE.test(path) && source)', 'if (false)')],
  ['native-reloads', seam, '1366px media identity and native', s => replace(s, 'if (typeof target.moveBefore === "function")', 'if (false)')],
  ['fallback-no-pause', seam, '1366px media identity and pause-before', s => replace(s, 'else { this.app.pauseLandFilm(); target.appendChild(host);', 'else { target.appendChild(host);')],
  ['fallback-stale-player', seam, '1366px media identity and pause-before', s => replace(s, 'target.appendChild(host); this.app._landFilmMoved();', 'target.appendChild(host);')],
  ['duplicate-host', seam, '1366px media identity and native', s => replace(s, 'host.toggleAttribute("data-reader-media",', 'target.append(host.cloneNode(true)); host.toggleAttribute("data-reader-media",')],
  ['moved-film-hit-target', seam, '1366px media identity and native', s => s, css => css + '\n:is([data-reader-media],[data-reader-game-media]) .ng-clip{pointer-events:none!important}\n'],  // D-368: a game film moves to the media home
  ['collapse-no-pause', seam, '1366px media identity and native', s => replace(s, 'this.app = app;', 'this.app = app; app.pauseLandFilm = () => {};')],
  ['pause-first-player-only', seam, 'pauseLandFilm pauses every owner player', s => replace(s, 'this.app = app;', 'this.app = app; app.pauseLandFilm = function () { const card = this._landFilmEl?.querySelector(".ng-clip"); if (card?._player) { card._player.pauseVideo(); card._mediaPaused = true; } };')],
  ['fixed-home', seam, '1366px the current card sits in the game\'s stage', s => replace(s, 'this.game.append(this.mediaHome);', 'app.wrapRef.current.append(this.mediaHome);')],
  ['layout-no-coalescing', seam, '1366px the current card sits in the game\'s stage', s => replace(s, 'if (this.layoutFrame || this.app.__ngDestroyed) return;', 'if (this.app.__ngDestroyed) return;')],
  ['layout-style-churn', seam, '1366px the current card sits in the game\'s stage', s => replace(s, 'if (!same || el.style.getPropertyPriority(key) !== priority)', 'if (true)')],
  ['chrome-hook-ignored', sections, 'optional chrome frame', s => replace(s, 'typeof a.readerChromeFrame === "function"', 'false')],
  ['chrome-node-band-lost', sections, 'optional chrome frame', s => replace(s, 'let y = band + Math.max(headHeight, step) + (chrome?.offset || 0);', 'let y = Math.max(headHeight, step) + (chrome?.offset || 0);')],
  ['chrome-bottom-reserve-ignored', sections, 'optional chrome frame', s => replace(s, 'chrome?.bottomReserve ??', 'undefined ??')],
  ['head-over-map', sections, '1366px chrome keeps', s => replace(s, 'const parent = chrome ? root : flow,', 'const parent = root,'), css => css + '\n.ng-reader>.ng-reader-head{left:calc(50% - 455px);top:0}\n'],
  ['phone-tools-in-header', sections, '390px chrome keeps', s => replace(s, 'chrome && W <= 640 ? flow : head', 'false ? flow : head')],
  ['execution-label-clearance-lost', 'card-presentation.spec.ts', '1440px.*chosen card rises', s => replace(s, 'card.style.marginTop = rect(shown).top - box.top - parseFloat(getComputedStyle(row).paddingTop) + "px";', 'card.style.marginTop = "0px";')],
  // D-368: under C Moves lead, so on a desktop a fresh layout gives the chosen row its old top and the handoff is
  // unexercised; U16 b (owner, 2026-10-24) now pins it through the result-time band restore.
  // D-433 renamed the short live-band journey; its native pick/result rectangle claim remains.
  ['execution-row-anchor-lost', 'defending-landing.spec.ts', 'D-433: at 390x631 the smaller live band', s => replace(s, 'card._ngDock.reader = { rowTop: box.top - game.top, height: game.height, rowHeight: box.height };', '/* mutant: forget the selected row */')],
  ['hand-close-behind-reader', 'land-layers.spec.ts', 'hand X owns its centre', s => s, css => css + '\n[data-hand-close]{z-index:4!important}\n'],
  ['native-game-focus-lost', 'pane-keyboard.spec.ts', 'recall page mounted under the pane', s => replace(s, '{ class: "ng-reader-game", tabindex: "-1" }', '{ class: "ng-reader-game" }')],
  ['reduced-motion-flash-lost', 'outcome-on-cards.spec.ts', 'reduced motion.*1440', s => s, css => replace(css, '.ng-reader,.ng-reader-article *', '.ng-reader,.ng-reader *')],
  ['entry-centering-lost', 'coldstart-backfill.spec.ts', 'landing card stays centred', s => replace(s, 'if (el !== row) style(el, "transform", "none", "important");', 'if (el !== row) style(el, "transform", "translateX(-50%)", "important");')],
  ['pane-card-overflow', 'pane-layout.spec.ts', 'pane moves film, card, article', s => replace(s, 'free.width - (arrows && !beside ? 104 : 32)', 'W - (arrows && !beside ? 104 : 32)')],
  // D-338: with the article shown the film's home is its Videos section's slot ([data-reader-media]).
  // RETIRED (v1.230.0, feat/video-cards): media-inset-lost removed the film strip's side padding, which the current
  // card no longer has (padding 0, no fades: choice-value.css .ng-current-card); film-row-arrows retires those ratios.
  ['film-only-node-band-lost', 'camera-continuity.spec.ts', '1440px.*CLEAR_SEC: a film', s => replace(s, 'showCard || showHand || homeMedia ?', 'showCard || showHand ?')],
  ['game-wheel-detached-target', 'landcard-deck.spec.ts', 'wheel momentum advances once', s => replace(s, 'return event.composedPath().includes(this.game);', 'return this.game.contains(event.target);')],
  ['native-game-touch-blocked', 'landcard-deck.spec.ts', 'long mobile choices', s => s, css => replace(css, '[data-reader-game-part=card]{touch-action:pan-y}', '[data-reader-game-part=card]{touch-action:none}')],
  ['native-game-keys-lost', 'landcard-deck.spec.ts', 'long recall answers', s => replace(s, 'return reader.gameKey(event) || readKey.call(this, event);', 'return readKey.call(this, event);')],
  ['native-page-scroll-lost', 'landcard-deck.spec.ts', 'long recall answers', s => replace(s, 'root.scrollTop = Math.min(root.scrollTop, Math.max(0, top));', '/* mutant: keep the scroll */')],
  // D-338 (owner: U7 round 2), one control per new claim, each killed at its own assertion.
  // RETIRED (D-368, layout C): d338-video-not-lifted claimed the Videos section is lifted above Moves. Nothing is
  // lifted under C; the opposite is pinned by a-column-wide-videos-question and -catch.
  ['d338-questions-above-moves', sections, '1366px choices precede', s => replace(s, '        cardY = y;\n        if (column) cardX', '        cardY = (row ? parseFloat(row.style.top) : y) - cardHeight - step;\n        if (column) cardX')],
  ['d338-open-part-keeps-header', sections, 'D-338 1024px', s => replace(s, 's.card.hidden = !closed || REFERENCE.test(this.path);', 's.card.hidden = REFERENCE.test(this.path);')],
  ['d338-focus-browse-retained', 'reading-mode.spec.ts', '1366px complete article, every close', s => replace(s, 'this.head.append(this.heading, this.tools); this.game.append(this.head);', 'this.tools.append(button("Focus on reading", () => {}, { "data-reading-focus": "" }), button("Browse", () => app.openPane("explore"), { "data-reader-browse": "" })); this.head.append(this.heading, this.tools); this.game.append(this.head);')],
  ['d338-saved-focus-read', 'reading-mode.spec.ts', 'reading perspectives and Back retain canonical content without gameplay$', s => replace(s, 'return !GAME_KEYS[part] || this.app.get(GAME_KEYS[part], true) !== false;', 'return !GAME_KEYS[part] || this.app.get((this.app.get("readingFocus", false) ? { card: "readingCard", hand: "readingHand" } : GAME_KEYS)[part], true) !== false;')],
  ['d338-index-eyes-retained', sections, 'contents and header targets at 1440x900', s => replace(s, 'row.append(link, eyeOff()); contents.append(row);', 'row.append(link, eyeOff(), button("", () => {}, { "data-toc-eye": section.type })); contents.append(row);')],
  ['d338-section-settings-retained', sections, 'contents and header targets at 1440x900', s => replace(s, '    contents.append(indexTitle);', '    contents.append(indexTitle, button("Section settings", () => this.app.openSettings("rolling"), { "data-section-settings": "" }));')],
  // U97 b took the index from 1152, so this claim lives at 1440.
  ['d338-tray-under-index', sections, 'D-338 1440px', s => replace(s, 'if (row) position(row, rowLeft, rowTop, flush ? grid + free.left : W);', 'if (row) position(row, 0, rowTop, W);')],
  ['d338-closed-label-boxed', sections, 'contents and header targets at 390x844', s => s, css => css + '\n.ng-section-card[data-collapsed=true]{background:#1b2034!important;border-color:#414c68!important}\n'],
  ['d338-page-scrolls-flow-top', 'landcard-deck.spec.ts', '390px MC: deck pages', s => replace(s, 'root.scrollTop = Math.min(root.scrollTop, Math.max(0, top));', 'root.scrollTop = 0;')],
  // NOT KILLED SINCE U59 c (DASH-R4 measured; dev's reader kills it): the reader's bottom reserve now spans the full
  // width (the account pill), so opening the pane at 1024 no longer moves it, the scrollport never grows and the
  // browser never clamps in this journey. The restore is still code; this control no longer exercises it.
  // Owner (2026-11-01): the claims of article-order.spec.ts, one control each.
  ['order-position-list', 'article-order.spec.ts', 'a position reads in the owner', s => replace(s, 'const order = position ? POSITION_ORDER : SECTION_ORDER;', 'const order = SECTION_ORDER;')],
  ['order-reaches-others', 'article-order.spec.ts', 'every other page keeps', s => replace(s, 'const order = position ? POSITION_ORDER : SECTION_ORDER;', 'const order = POSITION_ORDER;')],
  ['relations-not-split', 'article-order.spec.ts', 'a position reads in the owner', s => replace(s, ' + (position ? ",.entity-relations" : "")', '')],
  ['definition-in-overview', 'article-order.spec.ts', 'a position reads in the owner', s => replace(replace(s, '  "definition": "state-invariants",\n', ''), '"overview": "overview definition"', '"overview": "overview definition state-invariants"')],
  ['wikilink-printed', 'article-order.spec.ts', 'a position reads in the owner', s => replace(s, 'if (type === "confused") n.innerHTML = n.innerHTML.replace(/\\[\\[.*?\\|(.*?)]]/, "$1");', '')],
  // U101 b and U102 a replaced the numbered tiles, so these three pinned a rule he retired: overview-index-rows went with `more`;
  // overview-one-wall and overview-loses-text now break the opening and the words instead.
  ['overview-one-wall', 'article-order.spec.ts', 'Side-Control/Bottom: one tile named How it works', s => replace(s, 'of position && buckets.get("overview")?.parts || [])', 'of [])')],
  ['read-more-open', 'article-order.spec.ts', 'Side-Control/Bottom: one tile named How it works', s => replace(s, 'more = element("details", { class: "ng-rm" });', 'more = element("details", { class: "ng-rm", open: "" });')],
  ['overview-loses-text', 'article-order.spec.ts', 'New-York/Bottom: one tile named How it works', s => replace(s, 'more.append(...paragraphs.slice(1));', 'paragraphs.slice(1).forEach(p => p.remove());')],
  ['read-more-sentence-lost', 'article-order.spec.ts', 'Side-Control/Bottom: one tile named How it works', s => replace(s, 'rest.innerHTML = html.slice(lead.length);', 'rest.innerHTML = html.slice(lead.length + 60);')],
  ['label-reverted', 'article-order.spec.ts', 'Side-Control/Bottom: one tile named How it works', s => replace(s, '["overview", "How it works"]', '["overview", "Overview"]')],
  ['label-hub-reverted', 'article-order.spec.ts', 'Positions/Mount: the seats take', s => replace(s, '"From the top"', '"Top overview"')],
  ['label-shared-reverted', 'article-order.spec.ts', 'Transitions/Knee-Slice-Pass: the seats take', s => replace(s, '"For both sides"', '"Shared overview"')],
  // Past the source-id filter since U103 a: `position` alone removed now reaches a transition's own overview section.
  ['read-more-everywhere', 'article-order.spec.ts', 'every other page keeps', s => replace(s, 'of position && buckets.get("overview")?.parts || [])', 'of buckets.get("overview")?.parts || [])')],
  ['read-more-global-css', 'article-order.spec.ts', 'own disclosures keep their summaries', s => s, css => replace(css, '.ng-rm[open]>summary{display:none}', 'article [open]>summary{display:none}')],
  ['read-more-stays', 'article-dashboard.spec.ts', 'Read more on /Positions/Mount/Top opens in place', s => s, css => replace(css, '.ng-rm[open]>summary{display:none}', '')],
  ['read-more-no-grow', 'article-dashboard.spec.ts', 'Read more on /Positions/Mount/Top opens in place', s => s, css => css + '\n.ng-rm>:not(summary){display:none!important}\n'],
  ['read-more-scrolls', 'article-dashboard.spec.ts', 'Read more on /Positions/Mount/Top opens in place', s => replace(s, 'if (more.children[1]) wall.append(more);', 'if (more.children[1]) { wall.append(more); more.addEventListener("toggle", () => { this.root.scrollTop += 40; }); }')],
  // The keyboard journey's two claims: Enter opens it, and focus does not fall back to the page's start when the label goes.
  ['read-more-no-keyboard', 'article-dashboard.spec.ts', 'Read more opens by the keyboard', s => replace(s, 'more.append(element("summary", {}, "Read more"));', 'more.append(element("summary", {}, "Read more")); listen(more, "keydown", e => e.preventDefault());')],
  ['read-more-focus-to-top', 'article-dashboard.spec.ts', 'Read more opens by the keyboard', s => replace(s, 'if (more.children[1]) wall.append(more);', 'if (more.children[1]) { wall.append(more); listen(more, "toggle", () => this.body.querySelector("[data-section-type=aka] [data-section-toggle]").focus()); }')],
  ['settings-key-renamed', 'article-order.spec.ts', 'a saved closed section survives', s => replace(s, 'this.app.set("readerSection." + type, shown);', 'this.app.set("readerSection." + type, shown);').replace('return app.get("readerSection." + type, true) !== false;', 'return app.get("readerSection." + (type === "overview" ? "how-it-works" : type), true) !== false;')],
  ['width-right-edge', 'article-order.spec.ts', 'share both edges', s => replace(s, 'free.width + 2 * (free.left - indexEdge)', 'W - 24 - indexEdge')],
  // v1.252.1: retargeted to U110 a's flush condition (600 to 640px too), which #346 changed under these two rows.
  ['row-keeps-inset', 'article-order.spec.ts', 'share both edges', s => replace(s, 'const flush = this.trayFlush = W > 640 || free.width >= 600;', 'const flush = W > 640 || free.width >= 600;')],
  ['row-full-width', 'article-order.spec.ts', 'share both edges', s => replace(s, 'const flush = this.trayFlush = W > 640 || free.width >= 600;', 'const flush = this.trayFlush = !!indexEdge;')],
  ['grid-spans-all', 'article-order.spec.ts', 'no section spans the whole grid at 1440x900', s => s, css => css + '\n[data-reader-body]>[data-section-type=definition]{width:100%}'],
  ['beta-everywhere', 'article-order.spec.ts', 'every other page keeps', s => s, css => replace(css, ':has([data-source-id=decision-tree],[data-source-id=position-metrics])', '[data-section-type=options]')],
  ['beta-suffix', 'article-order.spec.ts', 'Beta mark: /Systems', s => s, css => replace(css, ':has([data-source-id=decision-tree],[data-source-id=position-metrics])', ':has([data-source-id$=tree],[data-source-id$=metrics])')],
  ['beta-suffix-training', 'article-order.spec.ts', 'Beta mark: /Positions/Leg-Drag', s => s, css => replace(css, ':has([data-source-id=decision-tree],[data-source-id=position-metrics])', ':has([data-source-id$=tree],[data-source-id$=metrics])')],
  ['relations-label-unscoped', 'article-order.spec.ts', 'a transition keeps the words', s => s, css => replace(css, 'article>:is(.also-known-as,.often-confused-with)>em{display:none}', ':is(.also-known-as,.often-confused-with)>em{display:none}')],
  ['relations-label-shown', 'article-order.spec.ts', 'a position reads in the owner', s => s, css => replace(css, 'article>:is(.also-known-as,.often-confused-with)>em{display:none}', '')],
  // v1.249.2: the reader holds one line at one height through a pane's slide, until its place moves.
  ['pane-hold-rechosen', 'pane-layout.spec.ts', '768px the pane opened and closed at the end of /Transitions', s => replace(s, 'this.placeTop === this.heldAt && this.held?.offsetWidth', 'false')],
  ['pane-open-hold-lost', 'pane-layout.spec.ts', '768px the line holds while the pane is open, mid-article', s => replace(s, 'keep = this.gridW - (this.gridW = free.width) && ', 'keep = this.gridW - (this.gridW = free.width) && false && ')],
  ['pane-hold-rechosen-mount', 'pane-layout.spec.ts', '768px the pane overlays the article', s => replace(s, 'this.placeTop === this.heldAt && this.held?.offsetWidth', 'false')],
  ['pane-hold-height-lost', 'pane-layout.spec.ts', '768px the pane opened and closed at the end of /Transitions', s => replace(s, '(was = this.heldY, this.held)', '(was = this.held.getBoundingClientRect().top, this.held)')],
  // RECORDED NON-KILL since v1.251.3: with heldAt the read-back, no journey separates root.scrollTop from placeTop. pane-layout.spec.ts says why.
  ['pane-hold-keyed-on-scroll', 'pane-layout.spec.ts', '768px the pane opened and closed at the end of /Transitions', s => replace(s, 'this.placeTop === this.heldAt && this.held?.offsetWidth', 'root.scrollTop === this.heldAt && this.held?.offsetWidth')],
  ['pane-hold-survives-scroll', 'pane-layout.spec.ts', 'a scroll while the pane is open', s => replace(s, 'this.placeTop === this.heldAt && this.held?.offsetWidth', 'this.held?.offsetWidth')],
  ['d338-clamped-place-lost', 'pane-layout.spec.ts', 'exposed cards, videos and reading', s => replace(s, '      if (this.placeTop > root.scrollTop) root.scrollTop = this.placeTop;\n', '')],
  // The clamp guard back as #340 wrote it: a 1px tick from the end reads as the browser's clamp.
  ['place-end-tick', 'pane-layout.spec.ts', 'one-pixel scroll up', s => replace(s, 'r.scrollTop >= end - 1 && this.placeTop > end + 1', 'r.scrollTop >= end - 1 && r.scrollTop < this.placeTop')],
  ['d338-running-reader-not-paused', 'pane-layout.spec.ts', 'exposed cards, videos and reading', s => replace(s, '    if (this.interacting && this.app.paused) { if', '    if (this.interacting) { if')],
  // D5-N1: the deck backs' clearance and the tray's symmetry, each with its own claim.
  // D-368: at 1440 the current card's film beside the question is taller and absorbs the backs' reserve; the
  // stacked phone stage is where the article must clear them.
  ['d338-deck-backs-unreserved', 'landcard-deck.spec.ts', '390px: the deck face keeps its 1.5x foot', s => replace(s, 'if (showCard) y += cardHeight + 3 * (a._landStackEl?.childElementCount || 0);', 'if (showCard) y += cardHeight;')],
  ['d338-tray-asymmetric', sections, 'D-338 1440px Questions and Moves close', s => replace(s, 'const rowLeft = flush ? free.center - grid / 2 - free.left : 0;', 'const rowLeft = 0;')],
  ['d338-film-waits-for-intent', seam, '1366px the current card sits in the game\'s stage', s => replace(s, 'wantsMedia() { return true; }', 'wantsMedia() { return !!(this.intent || this.interacting); }')],
  ['pressed-answer-moved', 'reading-navigation.spec.ts', '1440px reader adoption during a mouse press', s => replace(s, ' || this.app._readerPress', '')],
  // D-351: the hold (a landing is unpublished until its article renders; the reader stops honouring it
  // for the card) and the deferral (parts the ceiling published stay pinned; the reader drops the pin, so
  // the Videos lift and the rows move). The exchange journey is gated by the pair: either keeps it still.
  ['d351-hold-removed', 'defending-landing.spec.ts', 'D-351: a catch whose article lands late', s => replace(s, 'const hold = a._readerHold(this, W, H), pin', 'const hold = Math.min(0, a._readerHold(this, W, H)), pin')],
  ['d351-deferral-removed', 'reading-media-placement.spec.ts', '390px a film chunk landing after 2.6s', s => replace(s, ', pin = a._readerPin;', ', pin = null;')],
  ['d351-both-removed-exchange', sections, 'D-351: an exchange whose article lands late', s => replace(replace(s, 'const hold = a._readerHold(this, W, H), pin', 'const hold = Math.min(0, a._readerHold(this, W, H)), pin'), ', pin = a._readerPin;', ', pin = null;')],
  // D-352 (Delta 6): S2's media-home pin, the ready-means-laid-out fix, and N2's two gated D-347 fixes.
  ['d352-film-over-pin', 'reading-media-placement.spec.ts', '390px a film chunk landing after 2.6s', s => replace(s, 'homeMedia = homeMedia && !pin.hid && this.media === pin.film && h <= pin.mh;', 'homeMedia = homeMedia;')],
  ['d352-ready-before-layout', 'systems-surface.spec.ts', 'D-352: a reference page says ready only once', s => replace(s, '      // out of the game\'s header row; a frame later, a click aimed at "ready" hit the map instead.\n      this.layoutNow();\n', '      // out of the game\'s header row; a frame later, a click aimed at "ready" hit the map instead.\n')],
  ['d352-home-clamp-lost', sections, 'D-352: at arrival Home and PageUp', s => replace(s, 'this.root.scrollTop = /Home|Up/.test(event.key) ? Math.min(top, to) : to;', 'this.root.scrollTop = to;')],
  ['d352-hand-after-questions', sections, 'D-352: at arrival Home and PageUp', s => replace(s, 'if (key === "hand") this.gameSections[1].card.before(el); else home.before(el);', 'home.before(el);')],
  // D-353 (Delta 7 B1): a play settles the pin, as grading does.
  ['d353-play-keeps-pin', 'defending-landing.spec.ts', 'D-353: playing the pinned film', s => replace(s, '      if (name === "expandClip") this._readerPin = null;\n', '')],
  // D-368 (layout C) invariants. A: the video card column-wide in the Videos section, lifted above Moves (the
  // pre-C integration); it pushes the question and a catch's answers below the 1440x900 fold.
  ['a-column-wide-videos-question', 'defending-landing.spec.ts', "D-368: at 1440x900 the question card's top", columnWideVideos],
  // a-column-wide-videos-catch retired (v1.251.0): it pinned "the escape answers are on screen without scrolling", the claim U99 b
  // replaced on a desktop, and it now dies only at a premise, which proves nothing. D-368's new claim has d368-no-scroll.
  ['d368-no-scroll', 'defending-landing.spec.ts', 'D-368: in a catch at 1440x900', s => s, css => css + '\n.ng-reader{overflow:hidden!important}\n'],
  // RETIRED by U16 b (owner, 2026-10-24): phone-catch-question-first-lost-844/-631,
  // and d370-concessions-stick guarded the retired order/account/spacing concessions.
  // Band lifetime is now controlled directly in the app runner, not through the CSS marker.
  ['d433-question-first-lost-844', 'covered-card.spec.ts', 'U35 D-433.*390x844', phoneQuestionFirstLost],
  ['d433-question-first-lost-631', 'covered-card.spec.ts', 'U35 D-433.*390x631', phoneQuestionFirstLost],
  // U47 d review (6) + U52 b: the reader pays 3px per deck back before what follows a shown deck (the current card
  // stacked, else the article's 6px token); unpaid, the next part starts on the backs.
  // U52 b: the asking line keeps the deck's step, so a take-up moves nothing above its answers (D-351); a smaller
  // asking step shows as the article's chrome-frame card gap.
  ['u52b-asking-small-step', sections, 'optional chrome frame preserves the node band',
    s => replace(s, 'const deck = !!card?.classList.contains("ng-land-deck");', 'const deck = !!card?.classList.contains("ng-land-deck") && !card.hasAttribute("data-land-ask");')],
  // U52 b (APTS-SHARD4): a quiet asking line leaves no slot under the executing row on a covered phone band; the
  // execution opens one. Without it the pair falls under the card just pressed at reader scroll 170-200px.
  ['u52b-execution-slot-lost', 'roll-execution.spec.ts', 'at 390x844 a pick with the reader scrolled',
    s => replace(s, '      if (need > 0 && need < H / 3) {', '      if (false) {')],
  // APTS-R4 (2): Chromium sends a touch press's pointerdown before touchstart; without the pointer-type check a
  // touch scroll declines the asking question.
  ['u52b-touch-press-declines', 'covered-card.spec.ts', 'a touch scroll over the article does not decline',
    s => replace(s, ' || type === "pointerdown" && event.pointerType !== "mouse"', '')],
  ['u47-backs-unpaid', 'landcard-deck.spec.ts', '390px: the deck face keeps its 1.5x foot',
    s => replace(s, 'if (showCard) y += cardHeight + 3 * (a._landStackEl?.childElementCount || 0);', 'if (showCard) y += cardHeight;')],
  // U14 b (owner, 2026-10-24): asymmetric side reserves shift the words; missing rules lose the divider.
  ['u14-divider-off-centre', 'section-divider.spec.ts', '1440px divider titles', s => s,
    css => css + '.ng-section-card>h2{padding-left:52px}'],
  // U14 b (owner, 2026-10-24), H163: display:none also moved the words and failed centering first.
  // Keep the flex boxes and remove only their paint so this control reaches its own rules claim.
  ['u14-divider-rules-lost', 'section-divider.spec.ts', '390px divider titles', s => s,
    css => css + '.ng-section-title::before,.ng-section-title::after{background:transparent}'],
  // D-370 (D9-N3): a phone pick with the reader scrolled. D-329's reservation kept on a phone leaves no free
  // spot at about 170-290px and the pair falls back; the pre-fix code painted the unfitted target there.
  // NON-KILL by construction: the band fallback alone (return target in its place) is unreached by the sweep,
  // whose every step found free space (noFit 0 at 0-290px, 390x844 and 390x631, H129).
  ['d370-n3-d329-kept', 'roll-execution.spec.ts', 'at 390x844 a pick with the reader scrolled',
    s => replace(s, 'const free = nodeBand && (search(nodeBand) || col.width && search(null, { left: col.left, right: col.right, top: nodeBand.bottom, bottom: H })) || search(null);',
      'const free = nodeBand ? search(nodeBand) || col.width && search(null, { left: col.left, right: col.right, top: nodeBand.bottom, bottom: H }) : search(null);')],
  ['d370-n3-pre-fix', 'roll-execution.spec.ts', 'at 390x631 a pick with the reader scrolled',
    s => replace(replace(s, 'const free = nodeBand && (search(nodeBand) || col.width && search(null, { left: col.left, right: col.right, top: nodeBand.bottom, bottom: H })) || search(null);',
      'const free = nodeBand ? search(nodeBand) || col.width && search(null, { left: col.left, right: col.right, top: nodeBand.bottom, bottom: H }) : search(null);'),
      'return nodeBand ? { ...target, cy: target.cy - Math.min(Math.max(0, nodeBand.top - box.top), nodeBand.bottom - box.bottom) / scale } : target;', 'return target;')],
  // D-354 N2 (Delta 8): reopening Videos is the player's own input and settles the pin.
  ['d354-reopen-keeps-pin', 'defending-landing.spec.ts', 'D-354 N2: reopening Videos while pinned', s => replace(s, '    if (shown && type === "videos") this.app._readerGraded();\n', '')],
  // U55 b (owner, 2026-10-28) and U59 c (owner, 2026-10-28): the desktop dashboard. Each control breaks one claim of
  // article-dashboard.spec.ts, which serves real content. "No tile is capped": the owner-rejected mock's cap and fade.
  ['u55-tile-capped', 'article-dashboard.spec.ts', 'at 1440x900 the article is two columns', s => s,
    css => css + '\n[data-reader-body]>*{max-height:520px;overflow:hidden;mask-image:linear-gradient(#000 82%,transparent)}\n'],
  // DASH-R2 (the independent review of #323): mutants of "every tile shows its whole content" that survived its
  // first spec. The rows mutants of U55 b's 8px rows retired with them (U59 c rows are the grid's own auto rows);
  // their claim, a row no taller than its tallest content, is u59-rows-padded's.
  ['u59-rows-padded', 'article-dashboard.spec.ts', 'at 1440x900 the article is two columns', s => s, css => css + '\n[data-reader-body]>*{padding-bottom:100px}\n'],
  ['u55r-body-capped', 'article-dashboard.spec.ts', 'at 1440x900 the article is two columns', s => s, css => css + '\n.ng-section-body{max-height:240px;overflow:hidden}\n'],
  ['u55r-para-clamp', 'article-dashboard.spec.ts', 'at 1440x900 the article is two columns', s => s,
    css => css + '\n.ng-section-body p{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}\n'],
  // Owner (2026-11-06): two columns replace U59 c's rows and U65 b's pairing, so 9 controls retired with the rule each pinned:
  // u59-row-alone, u59-pair-flipped, u59-trio-last, u59r4-table-third, u59r4-player-third, u59r4-trio-unsized, u59r4-thirds-below,
  // u59r4-lanes-1366 (spans and thirds no longer exist) and u65-tiles-stretched (a float does not stretch). u59-order-moved
  // retired too: `order` does nothing to a float, and columns-tie-right and columns-close-reorders move a tile instead.
  // Each new claim of the columns has its own control:
  // Every second tile clears both columns: the rows back, with the holes the owner saw.
  ['columns-rows-back', 'article-dashboard.spec.ts', 'at 1440x900 the article is two columns', s => s, css => css + '\n[data-reader-body]>:nth-child(odd){clear:both}\n'],
  // Sides by parity, whatever the heights: a tile lands on the taller column and leaves a hole beside it.
  ['columns-alternate', 'article-dashboard.spec.ts', 'at 1440x900 the article is two columns', s => replace(s, 'const right = l > r + 1, height', 'const right = (this.flip = !this.flip), height')],
  ['columns-tie-right', 'article-dashboard.spec.ts', 'at 1440x900 the article is two columns', s => replace(s, 'const right = l > r + 1, height', 'const right = l >= r, height')],
  // A left tile not held in its lane: within a pixel of a draw it slides into the right one (found at 1366, Mount/Top).
  ['columns-left-slides', 'article-dashboard.spec.ts', 'at 1366x768 the article is two columns', s => s, css => replace(css, '[data-right]~:not([data-right]){clear:left}', '')],
  ['columns-draw-strict', 'article-dashboard.spec.ts', 'at 1366x768 the article is two columns', s => replace(s, 'const right = l > r + 1, height', 'const right = l > r, height')],
  ['columns-one-lane', 'article-dashboard.spec.ts', 'at 1440x900 the article is two columns', s => s, css => replace(css, 'width:calc(50% - var(--gap)/2)', 'width:100%')],
  ['columns-three-lanes', 'article-dashboard.spec.ts', 'at 1920x1080 the article is two columns', s => s, css => replace(css, 'width:calc(50% - var(--gap)/2)', 'width:calc(33.3% - var(--gap)*.7)')],
  ['columns-gap-lost', 'article-dashboard.spec.ts', 'at 1440x900 the article is two columns', s => s, css => replace(css, 'margin:0 0 var(--gap)', 'margin:0')],
  // The two gap specs that measured between rows now measure down a column, so each must still see a lost gap.
  ['columns-gap-lost-sections', sections, '1366px choices precede', s => s, css => replace(css, 'margin:0 0 var(--gap)', 'margin:0')],
  // v1.251.1: the tile's margin hard-coded to today's value, so only the token's own poke can see it.
  ['gap-hard-coded', sections, '1366px choices precede', s => s, css => replace(css, 'margin:0 0 var(--gap)', 'margin:0 0 24px')],
  ['columns-gap-lost-rhythm', contract, '1366px reader rhythm', s => s, css => replace(css, 'margin:0 0 var(--gap)', 'margin:0')],
  // A character count for the height: the schemas' field limits, the owner's first thought, and the brief's reason to measure.
  ['columns-tall-tile', 'article-dashboard.spec.ts', 'at 1440x900 the article is two columns', s => replace(s, 'height = rect(s.card).height + 24', 'height = s.body.textContent.length / 3')],
  ['columns-stale-height', 'article-dashboard.spec.ts', 'a tile that grows reorders', s => replace(s, '      this.tileSizer.observe(card);\n', '')],
  ['columns-close-waits-a-frame', 'article-dashboard.spec.ts', 'a close sorts the columns in its own task', s => replace(s, '        this.layoutNow();\n        if (opening) this.scrollTo(card, toggle);', '        if (opening) { this.layoutNow(); this.scrollTo(card, toggle); }')],
  // Closing a tile re-sorts the tiles before it, which is the one thing a close must not do.
  ['columns-close-reorders', 'article-dashboard.spec.ts', 'closing a tile moves nothing', s => replace(s, '    for (const [parent, sections] of [[this.body, open], [hidden.lastChild, closed]]) {', '    if (closed.length) open.reverse();\n    for (const [parent, sections] of [[this.body, open], [hidden.lastChild, closed]]) {')],
  // The block first in the source, not the one nearest the reader's top: the source order no longer runs down the page.
  ['line-dom-first', 'article-dashboard.spec.ts', 'opening Explore keeps the line', s => replace(s, 'return y >= top - 0.5 && y < was ? (was = this.heldY = y, e) : line;', 'return y >= top - 0.5 && !line ? (was = this.heldY = y, e) : line;')],
  // The anchor on the grid's width again: the grid stands still through most of a slide while the stage grows.
  ['line-keyed-on-grid', 'article-dashboard.spec.ts', 'at 1152x900 opening Explore keeps the line', s => replace(s, '(this.gridW = free.width)', '(this.gridW = grid)')],
  // U97 b: the index back at 1,152, and never.
  ['index-from-1152', 'article-order.spec.ts', 'U97 at 1349px', s => replace(s, 'free.width >= 1350', 'free.width >= 1152')],
  ['index-never', 'article-order.spec.ts', 'U97 at 1350px', s => replace(s, 'free.width >= 1350', 'free.width >= 1e4')],
  // U99 b's floor: the reader cannot scroll, and a strip fixed along the window's bottom over the answers.
  ['u99-no-scroll', 'article-order.spec.ts', 'U99 at 1440x900 every answer', s => s, css => css + '\n.ng-reader{overflow:hidden!important}\n'],
  // After the take-up, not before: a strip up from arrival died in j.openQuestion(), a preflight red that proved nothing.
  ['u99-fixed-over-answer', 'article-order.spec.ts', 'U99 at 1440x900 every answer', s => s, css => css + '\nbody:has(.ng-landcard:not([data-land-ask])):after{content:"";position:fixed;left:0;right:0;top:40%;height:60%;z-index:99;pointer-events:auto}\n'],
  ['u99-wheel-declines', 'article-order.spec.ts', 'U99 at 1440x640 the last answer', s => replace(s, '        if (this.gameInput(event)) return;\n        // Toolbar activation', '        if (this.gameInput(event) && type !== "wheel") return;\n        // Toolbar activation')],
  // U100 a: each phase of Training its own tile, on Transitions and Submissions alone.
  ['training-one-tile', 'article-order.spec.ts', 'U100 a /Transitions/Knee-Slice-Pass/Attacker', s => replace(s, '(transition || submission) && group.type == "training"', 'false')],
  ['training-numbered', 'article-order.spec.ts', 'U100 a /Transitions/Knee-Slice-Pass/Attacker', s => replace(s, 'if (!group.more) { card.setAttribute("aria-labelledby", heading.id); card.append(heading); }', 'card.setAttribute("aria-labelledby", heading.id); card.append(heading);')],
  ['training-text-lost', 'article-order.spec.ts', 'U100 a /Submissions/Armbar/from-Mount/Attacker', s => replace(s, 'more: 1, parts: [{ ...group.parts[0], node }]', 'more: 1, parts: [{ ...group.parts[0], node: (node.lastChild.remove(), node) }]')],
  ['training-index-rows', 'article-order.spec.ts', 'U100 a /Transitions/Knee-Slice-Pass/Attacker', s => replace(s, '      if (section.more) continue;\n', '')],
  ['training-flush', 'article-order.spec.ts', 'U100 a /Transitions/Knee-Slice-Pass/Attacker', s => s, css => replace(css, '.ng-section-body{padding:var(--reader-unit)}', '.ng-section-body{padding:0 var(--reader-unit) var(--reader-unit)}')],
  ['training-head-padded', 'article-order.spec.ts', 'U100 a /Transitions/Knee-Slice-Pass/Attacker', s => s, css => replace(css, 'h2+.ng-section-body{padding-top:0}', '')],
  ['training-on-positions', 'article-order.spec.ts', 'U100 a a position keeps', s => replace(s, '(transition || submission) && group.type == "training"', 'group.type == "training"')],
  ['training-on-principles', 'article-order.spec.ts', 'U100 a a Principle keeps', s => replace(s, '(transition || submission) && group.type == "training"', '!position && group.type == "training"')],
  ['training-closed-rows', 'article-dashboard.spec.ts', 'U100 a closing Training', s => replace(s, '(shown ? open : s.more ? [] : closed)', '(shown ? open : closed)')],
  ['training-closed-stays', 'article-dashboard.spec.ts', 'U100 a closing Training', s => replace(s, 'if (s.more) s.card.hidden = !shown; ', '')],
  ['training-index-first', 'article-dashboard.spec.ts', 'U100 a the index row follows', s => replace(s, '[...this.sections.filter(x => x.title == s.title).map(x => x.card), s.type === "videos"', '[s.card, s.type === "videos"')],
  // #345's review: the row by type lights all 8 of /Systems's `additional` rows together, and the hold keeps a closed line.
  ['index-row-by-type', 'article-dashboard.spec.ts', 'the index follows each section of /Systems', s => replace(s, 'this.sections.filter(x => x.title == s.title)', 'this.sections.filter(x => x.type == s.type)')],
  ['hold-closed-line', 'article-dashboard.spec.ts', 'a held line whose tile closes', s => replace(s, 'this.held?.offsetWidth', 'this.held?.isConnected')],
  // #345's review, round B: the claims it found with no control, and the hold at a real fractional scale.
  ['hold-exact', 'reader-scale-125.spec.ts', 'at a real device scale of 1.25', s => replace(s, 'root.scrollTop += Math.round(rect(keep).top - was); this.heldAt = this.placeTop = root.scrollTop;', 'this.heldAt = this.placeTop = root.scrollTop += Math.round(rect(keep).top - was);')],
  // #348's review: the 1px tolerance, its first fix, which 0.5 breaks; and a hold too loose for a small real scroll.
  ['hold-tolerance', 'reader-scale-050.spec.ts', 'at a real device scale of 0.5', s => replace(replace(s, 'root.scrollTop += Math.round(rect(keep).top - was); this.heldAt = this.placeTop = root.scrollTop;', 'this.heldAt = this.placeTop = root.scrollTop += Math.round(rect(keep).top - was);'), '(this.placeTop === this.heldAt && this.held?.offsetWidth', '(Math.abs(this.placeTop - this.heldAt) < 1 && this.held?.offsetWidth')],
  ['hold-loose', 'pane-layout.spec.ts', '1440px a small wheel while the pane is open', s => replace(s, '(this.placeTop === this.heldAt && this.held?.offsetWidth', '(Math.abs(this.placeTop - this.heldAt) < 100 && this.held?.offsetWidth')],
  ['columns-end-apart', 'article-dashboard.spec.ts', 'U100 a at 1440x900 the phases fill', s => s, css => css + '\n[data-reader-body]>[data-section-type=training]:last-child{min-height:900px}\n'],
  ['training-one-tile-columns', 'article-dashboard.spec.ts', 'U100 a at 1440x900 the phases fill', s => replace(s, '(transition || submission) && group.type == "training"', 'false')],
  ['training-apart', 'article-order.spec.ts', 'U100 a /Submissions/Armbar/from-Mount/Attacker', s => replace(s, '      : group);\n    this.sections = []; this.mediaSlot = null;', '      : group).sort((a, b) => !!a.more - !!b.more);\n    this.sections = []; this.mediaSlot = null;')],
  ['training-head-not-back', 'article-dashboard.spec.ts', 'U100 a closing Training.*moveBefore absent', s => replace(s, 's.card.prepend(s.closedRow.firstChild); s.closedRow.remove();', 's.closedRow.remove();')],
  ['training-close-scrolls', 'article-dashboard.spec.ts', 'U100 a closing Training.*moveBefore present', s => replace(s, 'if (opening) this.scrollTo(card, toggle);', 'if (opening) this.scrollTo(card, toggle); else this.root.scrollTop -= 200;')],
  ['hub-seat-scrolls', 'article-dashboard.spec.ts', 'U103 a on a hub', s => replace(s, 'if (more.children[1]) wall.append(more);', 'if (more.children[1]) { wall.append(more); if (wall.closest("[data-reader-article=guide]")) more.addEventListener("toggle", () => { this.root.scrollTop += 40; }); }')],
  // v1.251.4: How it works once, each page's provenance once, and #overview still landing.
  ['hub-heading-injected', 'article-order.spec.ts', 'Positions/Mount: How it works says its name once', s => replace(s, '    const base = new URL(path, location.origin);\n', '    const overview = article.querySelector("section#overview");\n    if (overview && !overview.querySelector("h2")) overview.prepend(element("h2", { id: "overview" }, "How it works"));\n    const base = new URL(path, location.origin);\n')],
  ['provenance-every-part', 'article-order.spec.ts', 'Positions/Mount: How it works says its name once', s => replace(s, 'if (said != group.said) fragment.append(', 'if (true) fragment.append(')],
  ['anchor-lost', 'article-order.spec.ts', 'Positions/Mount#overview lands', s => replace(s, '    if (!node) return;\n    node.tabIndex = -1;', '    return;\n    node.tabIndex = -1;')],
  ['gap-extra-phone', sections, '390px choices precede', s => s, css => css + '\n@media(max-width:599px){.ng-section-card{margin-top:calc(var(--section-gap) - 6px)}}\n'],
  // U103 a: Read more on a hub, both text sections.
  ['hub-first-section-only', 'article-order.spec.ts', 'U103 a /Positions/Mount:', s => replace(s, 'if (wall.dataset?.sourceId == "overview") {', 'if (wall.dataset?.sourceId == "overview" && !buckets.done && (buckets.done = 1)) {')],
  ['hub-parts-first', 'article-order.spec.ts', 'U103 a /Positions/Mount:', s => replace(s, 'of position && buckets.get("overview")?.parts || []) if (wall.dataset?.sourceId == "overview") {', 'of position && buckets.get("overview")?.parts.slice(0, 1) || []) {')],
  ['hub-one-opens-both', 'article-dashboard.spec.ts', 'U103 a on a hub', s => replace(s, 'if (more.children[1]) wall.append(more);', 'if (more.children[1]) { wall.append(more); more.addEventListener("toggle", () => this.body.querySelectorAll(".ng-rm").forEach(x => { x.open = more.open })); }')],
  // The wrapping-block journeys, retargeted: their rows in video_theater_mutants.json named strings this PR replaced.
  // reader-rounding-remainder-dropped was a recorded NON-KILL and its code is gone (v1.251.1): article-dashboard.spec.ts's header says why.
  ['wrapping-anchor-lost', 'article-dashboard.spec.ts', 'at 720x900 opening Explore holds the place around a wrapping block just under', s => replace(s, 'if (keep) { this.held = keep;', 'if (false) { this.held = keep;')],
  ['reader-clipped-block-anchored', 'article-dashboard.spec.ts', 'at 720x900 opening Explore holds the place around a wrapping block clipped by', s => replace(s, 'return y >= top - 0.5 && y < was ?', 'return y >= top - 20 && y < was ?')],

  ['ask-line-centred', 'article-order.spec.ts', 'U90 at 1440x900 the question line', s => replace(s, 'if (moves) cardX = rowLeft + moves.offsetLeft - 1;', '')],
  ['ask-line-label-offset', 'article-order.spec.ts', 'U90 at 390x844 the question line', s => replace(s, 'if (moves) cardX = rowLeft + moves.offsetLeft - 1;', 'if (moves) cardX = rowLeft + 3;')],
  // "Tab and visual order agree": the columns mirrored, so focus (source order) runs against the eye.
  ['u59-tab-rtl', 'article-dashboard.spec.ts', 'Tab walks the tiles', s => s, css => css + '\n[data-reader-body]>*{float:right!important}[data-reader-body]>[data-right]{float:left!important}\n'],
  // "Prose at a readable ~65-70ch": the column's measure removed. Only 1920 can show it: a tile's text is 432px at 1440, under
  // the 552px of 46ch, so this control survives there with nothing wrong (measured, v1.251.0).
  ['u59-measure-unset', 'article-dashboard.spec.ts', 'at 1920x1080 the article is two columns', s => s, css => replace(css, 'overflow-wrap:break-word;max-width:46ch;margin:auto}', 'overflow-wrap:break-word}')],
  // U46 b moved the Guest badge into the drawer. The conditional share cue now occupies the corner;
  // retain the obstruction control (historical name) with its reserve measured over the old 680px column only.
  ['u59-pill-covers', 'article-dashboard.spec.ts', 'at 1440x900 the article is two columns', s => replace(s, 'lane = { left: free.center - grid / 2, right: W }', 'lane = { left: free.center - grid / 2, right: free.center + grid / 2 }')],
  // "Keep the reader's place when the lane count changes": the anchor found but never put back.
  ['u59-place-lost', 'article-dashboard.spec.ts', 'opening Explore keeps', s => replace(s, 'root.scrollTop += Math.round(rect(keep).top - was);', 'root.scrollTop;')],
  // "A link inside a tile still opens its page": the tile swallows its links' clicks.
  ['u55r-link-swallowed', 'article-dashboard.spec.ts', 'a click on a section tile does nothing', s => replace(s, 'card.append(content); body.append(card);',
    'card.append(content); body.append(card); card.addEventListener("click", e => { if (e.target.closest("a")) { e.preventDefault(); e.stopPropagation(); } });')],
  // "A section tile click does nothing": a click on the tile (not on its links or controls) toggles it.
  ['u55-tile-click-toggles', 'article-dashboard.spec.ts', 'a click on a section tile does nothing', s => replace(s, 'card.append(content); body.append(card);',
    'card.append(content); body.append(card); card.addEventListener("click", e => e.target.closest("button,a") || toggle.click());')],
  // "The node band stays clear": the article pulled up over the game stage to use the space above it.
  ['u55-band-covered', 'article-dashboard.spec.ts', 'at 1440x900 the article is two columns', s => replace(s, 'style(art, "margin-top", 6);', 'style(art, "margin-top", 6 - gameHeight);')],
  // "Uses the width": the grid keeps today's centred column instead of starting at the index's clearance.
  // u55-width-unused retired with U55 b's run to the right edge: width-right-edge is the owner's rule that replaced it.
  // DASH-R4 (the independent review of R3): one control per claim added for its findings.
  // Finding 1, "the stage holds still at the arrival": the anchor without its gate (the article above the reader's top).
  ['u59r4-anchor-arrival', 'article-dashboard.spec.ts', 'opening Explore at the arrival', s => replace(s, ' && rect(art).top < top', '')],
  ['u59r4-anchor-resize', 'article-dashboard.spec.ts', 'window narrowed at the arrival', s => replace(s, ' && rect(art).top < top', '')],
  ['u59r4-anchor-rotation', 'article-dashboard.spec.ts', 'phone turned to landscape', s => replace(s, ' && rect(art).top < top', '')],
  // v1.251.0: keyed on the GRID, as R3 was: the free width does not change when the article is put away, so a control keyed on it
  // reopens nothing and survives with the claim unbroken (measured). The grid does change, because the hidden article has no index.
  // Finding 2, "putting the article away and back returns the same line": restore R3's ungated anchor and
  // remembered hidden width together. The reset alone is redundant with the gate in this journey.
  // Finding 3, "a wide table shows every column": kept in the 46ch column.
  ['u59r4-table-measured', 'article-dashboard.spec.ts', 'wide Top/Bottom table', s => s, css => replace(css, '.ng-section-body article:has(tr>:nth-child(4)){max-width:none}', '')],
  // v1.252.1: retargeted to the rule with #346's padding-top:0 (cobbler's gap check); the mutant still takes only the margin away.
  ['u59r4-table-margin', 'article-dashboard.spec.ts', 'at 768x1024', s => s, css => replace(css, 'table{display:block;overflow-x:auto;font-size:14px;margin:0;padding-top:0}', 'table{display:block;overflow-x:auto;font-size:14px;padding-top:0}')],
  // Finding 6, "an article arriving under a held press still shows two lanes": the default width back to the whole grid.
  ['u59r4-press-full', 'article-dashboard.spec.ts', 'arrives under a held press', s => s, css => replace(css, 'width:calc(50% - var(--gap)/2)', 'width:100%')],
  // U65 b and note (owner, 2026-10-29): each tile ends at its own content; game pages have no credits tile.
  ['u65-watch-tile-restored', 'article-dashboard.spec.ts', 'game pages have one film', s => replace(s, 'const control = group.type === "videos" && !REFERENCE.test(path);', 'const control = false;')],
  // Restore the old null film target AND its unsafe dereference; the corrected target itself is focusable.
  ['u65-film-index-throws', 'article-dashboard.spec.ts', 'game pages have one film', s => replace(replace(s,
    'focus = node.querySelector("[data-film-close]");', 'focus = null;'),
    'if (focus) focus.focus({ preventScroll: true });\n  }\n  readingInteraction', 'focus.focus({ preventScroll: true });\n  }\n  readingInteraction')],
  ['u65-disclosure-destination-lost', 'article-dashboard.spec.ts', 'native Videos disclosure', s => replace(s,
    'if ("mediaControl" in node.dataset) {', 'if (false) {')],
  ['u65-disclosure-focus-lost', 'article-dashboard.spec.ts', 'native Videos disclosure', s => replace(s,
    'focus = node.querySelector("[data-film-close]");', 'focus = null;')],
  ['u65-grid-overview-hidden', 'article-grid.spec.ts', '1440px preserves content', s => s,
    css => css + '\n[data-reader-body]>[data-section-type=overview]{display:none!important}\n'],
  ['u65-gap-passes-map', 'article-dashboard.spec.ts', 'space below the shorter column', s => s, css => css + '\n.ng-reader-article,[data-reader-body]{pointer-events:none!important}\n'],
  ['u59r4-phone-measure', 'article-dashboard.spec.ts', 'at 390x844 the phone keeps', s => s, css => css + '\n@media(max-width:640px){.ng-section-body article{max-width:120px}}\n'],
  ['u59r4-drag-on-reader', 'opening-camera.spec.ts', 'a drag mid-rise', s => s, css => css + '\nbody:after{content:"";position:fixed;left:1290px;top:150px;width:40px;height:40px;z-index:99}\n'],
  // "The phone keeps its stacked flow": its one-column rule removed, so the desktop's half width applies at 390px.
  ['u59-phone-pairs', 'article-dashboard.spec.ts', 'at 390x844 the phone keeps', s => s, css => replace(css, '@container (max-width:660px){[data-reader-body]>*{width:100%}}', '')],
  // U110 a (owner, 2026-11-09): under 1,024px every stacked container is one 496px box. At 600px the card is 496px with or
  // without the cap (600 less the arrows' 104), so the card's own control runs at 768px.
  // U104 (v1.252.0): a closed question's label is a row across the grid, so both columns start under it.
  ['u104-label-under-article', sections, 'D-338 1152px Questions and Moves close', s => replace(s, 'const filmEnd = (showCard ? cardY : y) + ', 'const filmEnd = cardY + ')],
  // U104: each column carries on under its own stage cell.
  ['u104-no-lead', 'article-dashboard.spec.ts', '@curated at 1440x900 the article is two columns', s => replace(s, 'this.sortColumns(...this.leadCells);', 'this.sortColumns();')],
  // U112 a: the reader shows the page's guide whole; the old reader cut would drop the closing line with the four parts.
  ['u111-reader-cut-back', 'safety-risks-only.spec.ts', 'Armbar/from-Mount/Attacker', s => replace(s, "    // U111, U112 a (owner, 2026-11-09): a submission's guide is cut in its template",
    '    submission && buckets.get("safety")?.parts[0].node.querySelectorAll(":scope>.table-container~*").forEach(n => n.remove());\n    // U111, U112 a (owner, 2026-11-09): a submission\'s guide is cut in its template')],
  // Cobbler's gap check (v1.252.0): a reader table keeps Quartz's side and foot padding, not its top.
  ['table-top-padding-back', 'safety-risks-only.spec.ts', 'Armbar/from-Mount/Attacker', s => s, css => replace(css, 'margin:0;padding-top:0}', 'margin:0}')],
  // #346's review (v1.252.1). Finding 2: a tile sortColumns skips keeps neither of its column styles.
  ['closed-tile-keeps-column-margin', 'article-dashboard.spec.ts', 'finding 2', s => replace(s, 'if (s.body.hidden || s.control) { css.marginTop = css.clear = ""; continue; }', 'if (s.body.hidden || s.control) continue;')],
  // Finding 3: with Moves closed the film starts on the question.
  ['film-ask-step-without-moves', 'reading-media-placement.spec.ts', 'finding 3', s => replace(s, '(showHand && askStep != null ? step + 3 : 0)', '(askStep != null ? step + 3 : 0)')],
  // v1.253.0 (owner, 2026-11-09): the one-line tease spans the choices row, and the film keeps its place under it as the question opens.
  ['tease-column-width', 'tease-width.spec.ts', 'one-line tease spans.*1440', s => replace(s, 'const tease = column && asking && showHand ? grid : column;', 'const tease = column;')],
  ['tease-drop-lost', 'tease-width.spec.ts', 'one-line tease spans.*1440', s => replace(s, 'const drop = showCard && showHand && this.teaseDrop?.[0] === card ? this.teaseDrop[1] : 0;', 'const drop = 0;')],
  ['tease-drop-asking-only', 'tease-width.spec.ts', 'one-line tease spans.*1440', s => replace(s, 'const drop = showCard && showHand && this.teaseDrop?.[0] === card ? this.teaseDrop[1] : 0;', 'const drop = askStep != null && this.teaseDrop?.[0] === card ? this.teaseDrop[1] : 0;')],
  // v1.253.0: the article runs to the fold, or to one gap above the win bar where the bar falls under the grid.
  ['legend-restore-blank', 'reader-fold.spec.ts', '1440x900', s => replace(s, 'under ? "8px" : "30px"', 'under ? "8px" : ""')],
  ['legend-not-docked', 'reader-fold.spec.ts', '1024x768', s => replace(s, 'under ? "8px" : "30px"', 'under ? "30px" : "30px"')],
  ['reader-end-double-gap', 'reader-fold.spec.ts', '1024x768', s => replace(s, 'a._readerReserve(lane));', 'a._readerReserve(lane) + 8);')],
  // v1.253.0: an index row reopens its closed section (U11), checked by mouse.
  // v1.253.0: the line within half a pixel of the reader's top is the one held (the ✕'s 44px gone put a line at 73.86 against 74).
  ['anchor-line-strict-top', 'article-dashboard.spec.ts', '1152x900 opening Explore keeps the line at the reader.s top \\(30% down\\)', s => replace(s, 'return y >= top - 0.5 && y < was ?', 'return y >= top && y < was ?')],
  // v1.253.0 (#354's review, finding 1): the rows of a card and film the background tap took away read closed.
  ['land-away-row-open', 'index-reveal.spec.ts', 'after a background tap the Video', s => replace(s, 's.row?.setAttribute("data-collapsed", String(closed));', 's.row?.setAttribute("data-collapsed", String(!(s.part ? this.on(s.part) : sectionShown(this.app, s.type))));')],
  // v1.253.0 (#354's review, finding 3): the first open tile's ✕ takes the corner Answer for Points' hang reaches.
  ['tile-close-under-ask-hang', 'ask-line.spec.ts', 'first tile.s close keeps its presses', s => replace(s, 's.toggle.style.zIndex = meets(go, b) && !meets(shut, b) ? 6 : "";', 's.toggle.style.zIndex = "";')],
  // NOT KILLED (v1.253.0), recorded: no journey has a tile ✕ that both the hang and the card's own ✕ reach, so the guard has no live case.
  ['tile-close-over-card-close', 'land-layers.spec.ts', 'the article survives minimizing the question', s => replace(s, 's.toggle.style.zIndex = meets(go, b) && !meets(shut, b) ? 6 : "";', 's.toggle.style.zIndex = meets(go, b) ? 6 : "";')],
  // v1.253.0 (#354's review, finding 5): beside the index the guide keeps Previous's top on the face. Finding 7: the film's drop only
  // while Moves is open.
  ['prev-climbs-over-choices', 'deck-arrows-index.spec.ts', 'Previous stays on the face', s => replace(s, 'Math.max(a._landNavEl.hasAttribute("data-index") ? 70 : 22, Math.min(cardHeight - 22, middle))', 'Math.max(22, Math.min(cardHeight - 22, middle))')],
  ['tease-drop-moves-closed', 'tease-width.spec.ts', 'Moves closed', s => replace(s, 'const drop = showCard && showHand && this.teaseDrop?.[0] === card ? this.teaseDrop[1] : 0;', 'const drop = showCard && this.teaseDrop?.[0] === card ? this.teaseDrop[1] : 0;')],
  // #354's review, round 7 (finding 1): a closed control only ever opens, and the parts' look is painted on every layout pass.
  ['stale-label-turns-off', 'index-reveal.spec.ts', 'never turns the card layer off', s => replace(s, 'const back = a.restoreLanding?.();\n    if (!this.on(part)) a.setLayer(part, true, "reader");\n    else if (!back) { this.sync(); return; }', 'a.restoreLanding?.();\n    a.setLayer(part, !this.on(part), "reader");')],
  ['parts-painted-at-sync-only', 'index-reveal.spec.ts', 'reads open again \\(1152', s => replace(s, 'for (const s of [...this.gameSections, this.sections.find(s => s.type === "videos")]) if (s) this.paintPart(s);', 'for (const s of this.gameSections) s.card.hidden = reference || this.on(s.part);')],
  // Round 7's review (finding 3): a restore from the index row stops reading, so the question's clock runs.
  ['row-restore-keeps-reading', 'index-reveal.spec.ts', 'clock runs', s => replace(s, '        this.interacting = false;\n        if (section.part && !this.on(section.part)) this.app.setLayer', '        if (section.part && !this.on(section.part)) this.app.setLayer')],
  ['index-reveal-lost', 'index-reveal.spec.ts', 'an article tile', s => replace(s, 'if (section.part) this.toggle(section.part); else this.toggleSection(section.type, true);', '')],
  ['video-title-plural', 'reading-contract.spec.ts', 'cannot repaint the opposite seat', s => replace(s, '["videos", "Video"], ["aka"', '["videos", "Videos"], ["aka"')],
  ['u110-cap-lost', 'stacked-width.spec.ts', 'stacked at 768px', s => replace(s, 'const cap = free.width < 1024 && 496;', 'const cap = 0;')],
  ['u110-card-uncapped', 'stacked-width.spec.ts', 'stacked at 768px', s => replace(s, 'beside ? 390 : cap || (arrows ? 560 : 520)', 'beside ? 390 : arrows ? 560 : 520')],
  ['u110-film-uncapped', 'stacked-width.spec.ts', 'stacked at 900px', s => replace(s, 'a.filmLayout(cap ? Math.min(free.width, cap + 32) : free.width,', 'a.filmLayout(free.width,')],
  ['u110-grid-uncapped', 'stacked-width.spec.ts', 'stacked at 600px', s => replace(s, 'Math.min(cap || 902, free.width - 64)', 'Math.min(902, free.width - 64)')],
  // U110 a: the Moves row takes the column wherever the stacked box binds, 600 to 640px included (cobbler's check, 2026-11-09).
  ['u110-tray-phone-flush', 'stacked-width.spec.ts', 'stacked at 600px', s => replace(s, 'this.trayFlush = W > 640 || free.width >= 600', 'this.trayFlush = W > 640')],
  // #346's review, finding 6: stacked, the article's ✕ ends on the column's right edge.
  ['u110-cap-past-columns', 'stacked-width.spec.ts', 'at 1,024px the columns begin', s => replace(s, 'const cap = free.width < 1024 && 496;', 'const cap = free.width < 1100 && 496;')],
  // v1.254.0: a reader button's pointer click counts only if its own pointerdown was on it, so the click ending a background tap on
  // touch cannot land on the Questions label that took the card's place and reopen the card.
  // #331's review (R1), v1.254.1: Retry reopens the address as asked, its #section included.
  ['retry-drops-fragment', 'tab-title.spec.ts', 'keeps its #section on Retry', s => replace(s, 'this.open({ path: url.href, intent, push })', 'this.open({ path, intent, push })')],
  ['ghost-press-reopens-card', 'legend-search.spec.ts', 'nowhere a node is revealed \\(768', s => replace(s, 'if (!event.detail || node.contains(downOn)) action(event);', 'action(event);')],
  // WINBAR1 (2026-11-11): the reader's measured answer "the bar falls under the grid" is what puts the bar away (claim 1 of winbar-fold).
  ['winbar-under-unpublished', 'winbar-fold.spec.ts', '574x760', s => replace(s, 'this.barUnder = !!bar && bar.left < lane.right && bar.right > lane.left;', 'this.barUnder = false;')],
  // WINBAR1: something that clips the article leaves its last section out of reach although the column runs to the edge (claim 3).
  ['winbar-last-section-clipped', 'winbar-fold.spec.ts', '768x1024', s => s, css => replace(css, '.ng-reader-article{position:relative;', '.ng-reader-article{max-height:2400px;overflow:hidden;position:relative;')],
]
// D7-N1: controls whose claim IS the landSettled stall (land_publish_stalled). None today.
const STALL_CLAIMS = new Set([])
const selection = process.env.SECTIONS_MUTANT_ONLY;
const selected = selection ? mutants.filter(([name]) => new RegExp(selection).test(name)) : mutants;
if (!selected.length) throw Error('No mutation controls match ' + selection);
const receipt = { builtReaderSha256: createHash('sha256').update(originals.get(readerPath)).digest('hex'), selection: selection || 'all', results: [] }
// D5-B2: a kill counts only against a GREEN unmutated baseline of the same spec and grep, run on the
// original bytes first (once per pair). A red the head already shows is never recorded as a kill.
// D-370: roll-execution's phone sweeps restage 30 picks (about 100s each), so a run may take 240s (the app
// runner's bound) and a baseline 300s.
const baselines = new Map()
const baseline = (spec, grep) => {
  const key = spec + '\n' + grep
  if (!baselines.has(key)) {
    for (const [path, bytes] of originals) writeFileSync(path, bytes)
    const reportPath = resolve(out, 'baseline-' + baselines.size + '.json')
    const run = spawnSync(resolve(root, 'node_modules/.bin/playwright'), ['test', '-c', config, 'journeys/' + spec.replaceAll('.', '\\.'), '--grep', grep, '--timeout=' + testTimeout, '--output', resolve(out, 'baseline-' + baselines.size + '-results'), '--reporter=list,json'], { cwd: root, encoding: 'utf8', timeout: 300000, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath } })
    const logPath = resolve(out, 'baseline-' + baselines.size + '.log')
    writeFileSync(logPath, (run.stdout || '') + (run.stderr || ''))
    let passed = 0
    try { const visit = suite => { for (const sp of suite.specs || []) for (const t of sp.tests) for (const r of t.results) if (r.status === 'passed') passed++; for (const c of suite.suites || []) visit(c) }; visit(JSON.parse(readFileSync(reportPath, 'utf8'))) } catch {}
    baselines.set(key, { green: run.status === 0 && passed > 0, exit: run.status, passed, report: reportPath, log: logPath })
  }
  return baselines.get(key)
}
try {
  for (const [name, spec, grep, mutate, css] of selected) {
    const base = baseline(spec, grep)
    for (const [path, bytes] of originals) writeFileSync(path, bytes)
    await build({ stdin: { contents: mutate(source), sourcefile: 'reader.src.js', resolveDir: resolve(root, 'neural/src'), loader: 'js' }, bundle: true, format: 'esm', target: 'es2019', minify: true, legalComments: 'none', outfile: readerPath, logLevel: 'silent' })
    if (css) writeFileSync(cssPath, css(originals.get(cssPath).toString()))
    const reportPath = resolve(out, name + '.json')
    const run = spawnSync(resolve(root, 'node_modules/.bin/playwright'), ['test', '-c', config, 'journeys/' + spec.replaceAll('.', '\\.'), '--grep', grep, '--max-failures=1', '--timeout=' + testTimeout, '--output', resolve(out, name + '-results'), '--reporter=list,json'], { cwd: root, encoding: 'utf8', timeout: 240000, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath } })
    const log = (run.stdout || '') + (run.stderr || '')
    writeFileSync(resolve(out, name + '.log'), log)
    let failures = []
    try {
      const visit = suite => {
        for (const spec of suite.specs || []) for (const test of spec.tests) for (const result of test.results) {
          if (result.status !== 'passed') failures.push({ status: result.status, errors: (result.errors || []).map(e => (e.message || '').replace(/\u001b\[[0-9;]*m/g, '')) })
        }
        for (const child of suite.suites || []) visit(child)
      }
      visit(JSON.parse(readFileSync(reportPath, 'utf8')))
    } catch {}
    // A delivered stimulus must reach its assertion. A wait/test timeout or
    // infrastructure error is NOT a claim-level kill, even with exit 1.
    // D7-N1: N6's soft landSettled stall is not a claim. It is left out of the kill evidence unless the
    // control's own claim is that stall (none today), so a mutant that only stalls publication is not
    // counted as killed; the remaining evidence must still be assertion failures, never a timeout.
    const evidence = failures.length === 1 ? failures[0].errors.filter(e => STALL_CLAIMS.has(name) || !/^Error: landSettled: /.test(e)) : []
    const killed = base.green && run.status === 1 && failures.length === 1 && failures[0].status === 'failed' &&
      evidence.length > 0 && evidence.every(e => /expect\(/.test(e) && !/Test timeout|TimeoutError|page\.waitFor\w+:|locator\.\w+: Timeout/.test(e))
    receipt.results.push({ name, spec, grep, baseline: base, exit: run.status, killed, failures })
    writeFileSync(resolve(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
    console.log(name + ': ' + (!base.green ? 'BASELINE RED, not counted' : killed ? 'killed (inspect assertion in log)' : 'NOT KILLED'))
  }
} finally {
  for (const [path, bytes] of originals) writeFileSync(path, bytes)
}
if (receipt.results.some(r => !r.killed)) process.exitCode = 1
