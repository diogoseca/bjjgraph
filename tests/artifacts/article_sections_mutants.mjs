// H139 recorded NON-KILLS, not coverage: execution-node-band-removed, d338-film-waits-for-intent,
// and d353-play-keeps-pin. Under layout C the old catch has no film above its question, so
// d351-deferral-removed and d352-film-over-pin also passed their old catch claims. They now target
// the existing calm phone late-film journey, where a late film can move already-published answers.
// H139 phone-catch-question-first-lost-844 stopped before its claim on a detached temporary marker;
// -631 had a red 30s baseline. Neither counts as a kill; H140's 3/3 per timeout arm did not establish cause.
// Run only after a green built suite, under the shared heavy-job lock. Private
// Playwright config and scratch output are required; no source or baseline edits.
// SECTIONS_MUTANT_CONFIG=/.../playwright.config.ts SECTIONS_MUTANT_OUT=/... node tests/artifacts/article_sections_mutants.mjs
// Optional SECTIONS_MUTANT_ONLY selects named controls after their focused journeys pass.
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
mkdirSync(out, { recursive: true })
const readerPath = resolve(root, 'source/public/static/neural/app/reader.js')
const cssPath = resolve(root, 'source/public/static/neural/app/reading.css')
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
    'else { body.hidden = !shown; body.inert = !shown; }',
    'else { body.hidden = !shown; body.inert = !shown; } if (s.part && body) body.id = s.id + "-body";'),
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
  ['execution-node-band-removed', 'camera-continuity.spec.ts', '390px camera continuity.*an exchange from a node with no Videos section', s => replace(s, 'const nodeBand = this.nodeBand && this.on("book") ? this.nodeBand : null,', 'const nodeBand = null,')],
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
  ['reading-shelf-retained', sections, 'D-338 1440px', s => replace(s, 'this.dock.hidden = this.on("book");', 'this.dock.hidden = false;')],
  ['native-role-starts-game', sections, 'D-338 1440px', s => replace(s, 'if (reader.intent && node?.pi === this.focusIdx)', 'if (false)')],
  // D-355 (U11): where the index shows (1440, 1152) a closed part leaves no label in the content, so the label's
  // claims (it reopens, its contrast, it hides while open) are killed at 1024, the widest viewport without the index.
  ['question-label-does-nothing', sections, 'D-338 1024px', s => replace(s, '() => this.toggle(part), { "data-game-open": part', '() => {}, { "data-game-open": part')],
  ['index-role-after-name', sections, 'D-338 1440px', s => replace(s, 'indexTitle.textContent = role + " " + this.app.graphName(node);', 'indexTitle.textContent = this.app.graphName(node) + " · " + role;')],
  ['section-x-repaint', sections, 'floating contents owns.*dark', s => replace(s, '      if (s.toggle.getAttribute("aria-expanded") !== String(shown)) {', '      if (!s.part) s.toggle.replaceChildren(...faces(s.type, s.title));\n      if (s.toggle.getAttribute("aria-expanded") !== String(shown)) {')],
  ['toc-shifts-column', sections, 'contents and header targets at 1440x900', s => replace(s, 'free.center - parseFloat(this.articleEl.style.width) / 2', 'free.center - parseFloat(this.articleEl.style.width) / 2 - 100')],
  ['toc-overlaps-tablet', sections, 'contents and header targets at 1024x768', s => replace(s, '>= tocWidth + 12', '>= 0')],
  ['toc-not-fixed', sections, 'floating contents owns.*dark', s => s, css => replace(css, '.ng-reader-toc{position:fixed', '.ng-reader-toc{position:absolute')],
  ['toc-container', sections, 'floating contents owns.*light', s => s, css => css + '\n.ng-reader-toc{background:#1b2034;border:1px solid #414c68;box-shadow:0 0 4px #000}\n'],
  ['missing-gap', sections, '1366px choices precede', s => s, css => replace(css, '--section-gap:6px', '--section-gap:0px')],
  // U16B-S1: target the closed label itself. The first #a8b0c2 is the OPEN divider title.
  // U25 now carries that same control in its disclosure; the 7:1 claim must kill this override.
  ['collapsed-contrast', sections, 'contents and header targets at 390x844', s => s,
    css => css + '\n.ng-reader .ng-section-card[data-collapsed=true] [data-section-toggle]{color:#555b68!important}\n'],
  ['game-collapsed-contrast', sections, 'D-338 1024px', s => s, css => css + '\n.ng-reader-closed-part [data-game-open]{color:#555b68!important}\n'],
  ['defender-hub-leak', contract, 'defender reading excludes.*Rear-Naked-Choke', s => replace(s, 'shared.replaceChildren(...safety);', '/* mutant: keep the full attacker-rich hub */')],
  ['stale-response', contract, 'a late response cannot repaint', s => replace(replace(s, 'this.abort?.abort();', '/* mutant: no abort */'), 'if (serial !== this.serial || this.app.__ngDestroyed) return;', 'if (this.app.__ngDestroyed) return;')],
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
  ['chrome-bottom-reserve-ignored', sections, 'optional chrome frame', s => replace(s, 'chrome?.bottomReserve != null', 'false')],
  ['head-over-map', sections, '1366px chrome keeps', s => replace(s, 'const parent = chrome ? this.root : flow,', 'const parent = this.root,'), css => css + '\n.ng-reader>.ng-reader-head{left:calc(50% - 455px);top:0}\n'],
  ['phone-tools-in-header', sections, '390px chrome keeps', s => replace(s, 'chrome && W <= 640 ? flow : head', 'false ? flow : head')],
  ['execution-label-clearance-lost', 'card-presentation.spec.ts', '1440px.*chosen card rises', s => replace(s, 'card.style.marginTop = shown.getBoundingClientRect().top - box.top - parseFloat(getComputedStyle(row).paddingTop) + "px";', 'card.style.marginTop = "0px";')],
  // D-368: under C Moves lead, so on a desktop a fresh layout gives the chosen row its old top and the handoff is
  // unexercised; U16 b (owner, 2026-10-24) now pins it through the result-time band restore.
  ['execution-row-anchor-lost', 'defending-landing.spec.ts', 'U16 b: at 390x631 only the live catch band', s => replace(s, 'card._ngDock.reader = { rowTop: box.top - game.top, height: game.height, rowHeight: box.height };', '/* mutant: forget the selected row */')],
  ['hand-close-behind-reader', 'land-layers.spec.ts', 'hand X owns its centre', s => s, css => css + '\n[data-hand-close]{z-index:4!important}\n'],
  ['native-game-focus-lost', 'pane-keyboard.spec.ts', 'recall page mounted under the pane', s => replace(s, '{ class: "ng-reader-game", tabindex: "-1" }', '{ class: "ng-reader-game" }')],
  ['reduced-motion-flash-lost', 'outcome-on-cards.spec.ts', 'reduced motion.*1440', s => s, css => replace(css, '.ng-reader,.ng-reader-article *', '.ng-reader,.ng-reader *')],
  ['entry-centering-lost', 'coldstart-backfill.spec.ts', 'landing card stays centred', s => replace(s, 'if (el !== row) style(el, "transform", "none", "important");', 'if (el !== row) style(el, "transform", "translateX(-50%)", "important");')],
  ['pane-card-overflow', 'layer-dock-centre.spec.ts', '800px with the pane open', s => replace(s, 'free.width - (arrows && !beside ? 104 : 32)', 'W - (arrows && !beside ? 104 : 32)')],
  // D-338: with the article shown the film's home is its Videos section's slot ([data-reader-media]).
  // RETIRED (v1.230.0, feat/video-cards): media-inset-lost removed the film strip's side padding, which the current
  // card no longer has (padding 0, no fades: choice-value.css .ng-current-card); film-row-arrows retires those ratios.
  ['film-only-node-band-lost', 'camera-continuity.spec.ts', '1440px.*CLEAR_SEC: a film', s => replace(s, 'showCard || showHand || homeMedia ?', 'showCard || showHand ?')],
  ['game-wheel-detached-target', 'landcard-deck.spec.ts', 'wheel momentum advances once', s => replace(s, 'const path = event.composedPath(); return path.includes(this.game) && !(this.videoCard && path.includes(this.videoCard));', 'return this.game.contains(event.target) && !(this.videoCard && this.videoCard.contains(event.target));')],
  ['native-game-touch-blocked', 'landcard-deck.spec.ts', 'long mobile choices', s => s, css => replace(css, '[data-reader-game-part=card]{touch-action:pan-y}', '[data-reader-game-part=card]{touch-action:none}')],
  ['native-game-keys-lost', 'landcard-deck.spec.ts', 'long recall answers', s => replace(s, 'return reader.gameKey(event) || readKey.call(this, event);', 'return readKey.call(this, event);')],
  ['native-page-scroll-lost', 'landcard-deck.spec.ts', 'long recall answers', s => replace(s, 'root.scrollTop = Math.min(root.scrollTop, Math.max(0, top));', '/* mutant: keep the scroll */')],
  // D-338 (owner: U7 round 2), one control per new claim, each killed at its own assertion.
  // RETIRED (D-368, layout C): d338-video-not-lifted claimed the Videos section is lifted above Moves. Nothing is
  // lifted under C; the opposite is pinned by a-column-wide-videos-question and -catch.
  ['d338-questions-above-moves', sections, '1366px choices precede', s => replace(s, '          cardY = y;\n          if (beside) {', '          cardY = (row ? parseFloat(row.style.top) : y) - cardHeight - step;\n          if (beside) {')],
  ['d338-open-part-keeps-header', sections, 'D-338 1024px', s => replace(replace(s, 'if (s.part) s.card.hidden = shown || !labels;', 'if (s.part) s.card.hidden = !labels;'), 's.card.hidden = !available || reference || this.on(s.part);', 's.card.hidden = !available || reference;')],
  ['d338-focus-browse-retained', 'reading-mode.spec.ts', '1366px complete article, every close', s => replace(s, 'this.head.append(this.heading, this.tools); this.game.append(this.head);', 'this.tools.append(button("Focus on reading", () => {}, { "data-reading-focus": "" }), button("Browse", () => app.openPane("explore"), { "data-reader-browse": "" })); this.head.append(this.heading, this.tools); this.game.append(this.head);')],
  ['d338-saved-focus-read', 'reading-mode.spec.ts', 'reading perspectives and Back retain canonical content without gameplay$', s => replace(s, 'return this.app.get(GAME_KEYS[part], true) !== false;', 'return this.app.get((this.app.get("readingFocus", false) ? { card: "readingCard", hand: "readingHand", map: "readingMap", feedback: "readingFeedback" } : GAME_KEYS)[part], true) !== false;')],
  ['d338-index-eyes-retained', sections, 'contents and header targets at 1440x900', s => replace(s, 'row.append(link, eyeOff()); contents.append(row);', 'row.append(link, eyeOff(), button("", () => {}, { "data-toc-eye": section.type })); contents.append(row);')],
  ['d338-section-settings-retained', sections, 'contents and header targets at 1440x900', s => replace(s, '    contents.append(indexTitle);', '    contents.append(indexTitle, button("Section settings", () => this.app.openSettings("rolling"), { "data-section-settings": "" }));')],
  ['d338-tray-under-index', sections, 'D-338 1152px', s => replace(s, 'if (row) position(row, rowLeft, rowTop, indexEdge ? W + 2 * free.left - 2 * indexEdge : W);', 'if (row) position(row, 0, rowTop, W);')],
  ['d338-closed-label-boxed', sections, 'contents and header targets at 390x844', s => s, css => css + '\n.ng-section-card[data-collapsed=true]{background:#1b2034!important;border-color:#414c68!important}\n'],
  ['d338-page-scrolls-flow-top', 'landcard-deck.spec.ts', '390px MC: deck pages', s => replace(s, 'root.scrollTop = Math.min(root.scrollTop, Math.max(0, top));', 'root.scrollTop = 0;')],
  ['d338-clamped-place-lost', 'pane-layout.spec.ts', 'exposed cards, videos and reading', s => replace(s, '      if (this.placeTop > this.root.scrollTop) this.root.scrollTop = this.placeTop;\n', '')],
  ['d338-running-reader-not-paused', 'pane-layout.spec.ts', 'exposed cards, videos and reading', s => replace(s, '    if (this.interacting && this.app.paused) return;', '    if (this.interacting) return;')],
  // D5-N1: the deck backs' clearance and the tray's symmetry, each with its own claim.
  // D-368: at 1440 the current card's film beside the question is taller and absorbs the backs' reserve; the
  // stacked phone stage is where the article must clear them.
  ['d338-deck-backs-unreserved', 'landcard-deck.spec.ts', '390px: the deck face keeps its 1.5x foot', s => replace(s, 'if (showCard) y += (beside ? Math.max(cardHeight, mediaHeight) : cardHeight) + 3 * (a._landStackEl?.childElementCount || 0);', 'if (showCard) y += (beside ? Math.max(cardHeight, mediaHeight) : cardHeight);')],
  ['d338-tray-asymmetric', sections, 'D-338 1440px Questions and Moves close', s => replace(s, 'const rowLeft = indexEdge ? indexEdge - free.left : 0;', 'const rowLeft = 0;')],
  ['d338-film-waits-for-intent', seam, '1366px the current card sits in the game\'s stage', s => replace(s, 'wantsMedia() { return this.on("book"); }', 'wantsMedia() { return this.on("book") && !!(this.intent || this.interacting); }')],
  ['pressed-answer-moved', 'reading-navigation.spec.ts', '1440px reader adoption during a mouse press', s => replace(s, ' || this.app._readerPress', '')],
  // D-351: the hold (a landing is unpublished until its article renders; the reader stops honouring it
  // for the card) and the deferral (parts the ceiling published stay pinned; the reader drops the pin, so
  // the Videos lift and the rows move). The exchange journey is gated by the pair: either keeps it still.
  ['d351-hold-removed', 'defending-landing.spec.ts', 'D-351: a catch whose article lands late', s => replace(s, 'const hold = a._readerHold(this, available, W, H), pin', 'const hold = Math.min(0, a._readerHold(this, available, W, H)), pin')],
  ['d351-deferral-removed', 'reading-media-placement.spec.ts', '390px a film chunk landing after 2.6s', s => replace(s, ', pin = a._readerPin;', ', pin = null;')],
  ['d351-both-removed-exchange', sections, 'D-351: an exchange whose article lands late', s => replace(replace(s, 'const hold = a._readerHold(this, available, W, H), pin', 'const hold = Math.min(0, a._readerHold(this, available, W, H)), pin'), ', pin = a._readerPin;', ', pin = null;')],
  // D-352 (Delta 6): S2's media-home pin, the ready-means-laid-out fix, and N2's two gated D-347 fixes.
  ['d352-film-over-pin', 'reading-media-placement.spec.ts', '390px a film chunk landing after 2.6s', s => replace(s, 'homeMedia = homeMedia && !pin.hid && this.media === pin.film && h <= pin.mh;', 'homeMedia = homeMedia;')],
  ['d352-ready-before-layout', 'systems-surface.spec.ts', 'D-352: a reference page says ready only once', s => replace(s, '      // out of the game\'s header row; a frame later, a click aimed at "ready" hit the map instead.\n      this.layoutNow();\n', '      // out of the game\'s header row; a frame later, a click aimed at "ready" hit the map instead.\n')],
  ['d352-home-clamp-lost', sections, 'D-352: at arrival Home and PageUp', s => replace(s, 'this.root.scrollTop = /Home|Up/.test(event.key) ? Math.min(top, to) : to;', 'this.root.scrollTop = to;')],
  ['d352-hand-after-questions', sections, 'D-352: at arrival Home and PageUp', s => replace(s, 'if (key === "hand") this.gameSections[1].card.before(el); else this.game.append(el);', 'this.game.append(el);')],
  // D-353 (Delta 7 B1): a play settles the pin, as grading does.
  ['d353-play-keeps-pin', 'defending-landing.spec.ts', 'D-353: playing the pinned film', s => replace(s, '      if (name === "expandClip") this._readerPin = null;\n', '')],
  // D-368 (layout C) invariants. A: the video card column-wide in the Videos section, lifted above Moves (the
  // pre-C integration); it pushes the question and a catch's answers below the 1440x900 fold.
  ['a-column-wide-videos-question', 'defending-landing.spec.ts', "D-368: at 1440x900 the question card's top", columnWideVideos],
  ['a-column-wide-videos-catch', 'defending-landing.spec.ts', 'D-368: in a catch at 1440x900', columnWideVideos],
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
  ['u47-backs-unpaid', 'landcard-deck.spec.ts', '390px: the deck face keeps its 1.5x foot',
    s => replace(s, 'if (showCard) y += (beside ? Math.max(cardHeight, mediaHeight) : cardHeight) + 3 * (a._landStackEl?.childElementCount || 0);',
      'if (showCard) y += (beside ? Math.max(cardHeight, mediaHeight) : cardHeight);')],
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
    const run = spawnSync(resolve(root, 'node_modules/.bin/playwright'), ['test', '-c', config, spec, '--grep', grep, '--timeout=30000', '--output', resolve(out, 'baseline-' + baselines.size + '-results'), '--reporter=list,json'], { cwd: root, encoding: 'utf8', timeout: 300000, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath } })
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
    const run = spawnSync(resolve(root, 'node_modules/.bin/playwright'), ['test', '-c', config, spec, '--grep', grep, '--max-failures=1', '--timeout=30000', '--output', resolve(out, name + '-results'), '--reporter=list,json'], { cwd: root, encoding: 'utf8', timeout: 240000, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath } })
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
