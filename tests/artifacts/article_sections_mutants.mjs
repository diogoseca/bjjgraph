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
  ['content-loss', sections, 'semantic sections.*Mount/Bottom', s => replace(s, 'fragment.append(part.node);', 'part.node.querySelector?.("p")?.remove(); fragment.append(part.node);')],
  ['wrong-order', sections, 'semantic sections.*Knee-Slice-Pass/Attacker', s => replace(s, 'return rank(a) - rank(b);', 'return rank(b) - rank(a);')],
  ['settings-ignored', sections, 'section settings carry', s => replace(s, 'return app.get("readerSection." + type, true) !== false;', 'return true;')],
  ['collapsed-body-still-visible', sections, 'contents and header targets at 390x844', s => replace(s, 'body.hidden = !shown;', 'body.hidden = false;')],
  ['aria-control-broken', sections, 'contents and header targets at 390x844', s => replace(s, '"data-section-toggle": group.type, "aria-controls": id + "-body"', '"data-section-toggle": group.type, "aria-controls": id + "-missing"')],
  ['game-eye-control-broken', sections, 'D-318 1440px', s => replace(s, '"data-game-eye": part, "aria-controls": id + "-body"', '"data-game-eye": part, "aria-controls": id + "-missing"')],
  ['late-game-control-target', sections, 'late question backfill', s => replace(replace(s,
    'if (!s.part) { body.hidden = !shown; body.inert = !shown; }',
    'if (s.part) { if (body) body.id = s.id + "-body"; } else { body.hidden = !shown; body.inert = !shown; }'),
    'if (key === "card" || key === "hand") el.id = "reader-" + key + "-body";', '/* mutant: only the old sync binds the body */')],
  ['phone-contents', sections, 'contents and header targets at 390x844', s => replace(s, '|| !fits;', '|| false;')],
  ['label-toggles', sections, 'contents and header targets at 1366x768', s => replace(s, 'if (section) this.scrollTo(section.toggle);', 'if (section) { this.toggleSection(section.type); this.scrollTo(section.toggle); }')],
  ['eye-scrolls', sections, 'contents and header targets at 1366x768', s => replace(s, 'this.app.set("readerSection." + type, shown);', 'this.app.set("readerSection." + type, shown); this.scrollTo(this.sections.find(s => s.type === type).toggle);')],
  ['toc-input-guard-lost', sections, 'floating contents owns.*dark', s => replace(s, 'contents.style.pointerEvents = "auto";', 'contents.style.pointerEvents = "auto"; this.app._readerTocEl = null;')],
  ['toc-camera-gutter-restored', sections, 'current node stays centred', s => replace(replace(s, '  destroy() {', retiredGutter + '  destroy() {'), '  app._readerFailed = false;', '  app._readerFailed = false; const paneCamera = app._paneCameraTarget; app._paneCameraTarget = function (target) { return reader.frameCamera(paneCamera.call(this, target)); };')],
  ['reader-overwrites-inspect', 'roll-execution.spec.ts', 'with reader layout during close', s => replace(s, 'if (el !== row) style(el, "transform", "none", "important");', 'style(el, "transform", "none", "important");')],
  // D-326: restore the 11px band acceptance; the scrolled phone case must fail its painted-overlap claim.
  ['execution-thin-band-accepted', 'roll-execution.spec.ts', 'execution camera frames the technique at 390px; pane false; reduced motion true scrolled to the top', s => replace(s, 'card.top - toast.bottom >= box.bottom - box.top + 24', 'card.top > toast.bottom')],
  // D-331 S1: every placement search fails, so each frame takes the counted no-fit fallback.
  ['execution-no-fit-forced', 'roll-execution.spec.ts', 'execution camera frames the technique at 1440px; pane false; reduced motion false$', s => replace(s, '    const search = within => {', '    const search = within => { return null;')],
  // D-329: drop the reader node band; the 390px exchange's pair is covered by the landing rows again.
  ['execution-node-band-removed', 'camera-continuity.spec.ts', '390px camera continuity.*an exchange lands on a new current node', s => replace(s, 'const nodeBand = this.nodeBand && this.on("book") ? this.nodeBand : null;', 'const nodeBand = null;')],
  ['execution-occupied-space-lost', 'roll-execution.spec.ts', 'execution camera frames.*1440px; pane false; reduced motion false after native wheel', s => replace(s, '  frameExecution(target, node) {', '  frameExecution(target, node) { return target;')],
  // D-333: the reader never publishes a new landing card, so a cold start's greeting stays hidden,
  // (D4-S1) the card behind the list picker is not readable, and (D-336) every claim that a visitor
  // sees the card, not only that it is built or counted, fails.
  ['landing-never-published', 'coldstart-funnel.spec.ts', 'funnel spine', neverPublish],
  ['landing-never-published-picker', 'lists-picker.spec.ts', 'the picker is reachable', neverPublish],
  ['landing-never-published-late-question', 'coldstart-late-payload.spec.ts', 'the harness can hold a payload back', neverPublish],
  ['landing-never-published-no-decks', 'coldstart-late-payload.spec.ts', 'a payload that never arrives', neverPublish],
  ['landing-never-published-list-item', 'lists-disclosure.spec.ts', 'clicking a listed technique opens its dossier', neverPublish],
  ['landing-never-published-eye-restore', sections, 'D-318 1440px Questions and Moves use named eyes', neverPublish],
  ['reading-shelf-retained', sections, 'D-318 1440px', s => replace(s, 'this.dock.hidden = this.on("book");', 'this.dock.hidden = false;')],
  ['native-role-starts-game', sections, 'D-318 1440px', s => replace(s, 'if (reader.intent && node?.pi === this.focusIdx)', 'if (false)')],
  ['question-eye-does-nothing', sections, 'D-318 1440px', s => replace(s, '() => this.toggle(part), { "data-game-eye": part', '() => {}, { "data-game-eye": part')],
  ['index-role-lost', sections, 'D-318 1440px', s => replace(s, 'indexTitle.append(element("span", {}, " · " + role),', 'indexTitle.append(element("span", {}, ""),')],
  ['toc-first-click-repaint', sections, 'floating contents owns.*dark', s => replace(s, 'if (!b || b.getAttribute("aria-expanded") === String(shown)) continue;', 'if (!b) continue;')],
  ['toc-shifts-column', sections, 'contents and header targets at 1440x900', s => replace(s, 'free.center - parseFloat(this.articleEl.style.width) / 2', 'free.center - parseFloat(this.articleEl.style.width) / 2 - 100')],
  ['toc-overlaps-tablet', sections, 'contents and header targets at 1024x768', s => replace(s, '>= tocWidth + 12', '>= 0')],
  ['toc-not-fixed', sections, 'floating contents owns.*dark', s => s, css => replace(css, '.ng-reader-toc{position:fixed', '.ng-reader-toc{position:absolute')],
  ['toc-container', sections, 'floating contents owns.*light', s => s, css => css + '\n.ng-reader-toc{background:#1b2034;border:1px solid #414c68;box-shadow:0 0 4px #000}\n'],
  ['missing-gap', sections, '1366px choices precede', s => s, css => replace(css, '--section-gap:6px', '--section-gap:0px')],
  ['collapsed-contrast', sections, 'contents and header targets at 390x844', s => s, css => replace(css, 'color:#a8b0c2', 'color:#555b68')],
  ['game-collapsed-contrast', sections, 'D-318 1440px', s => s, css => css + '\n.ng-reader-game-heading[data-collapsed=true]{color:#555b68}\n'],
  ['defender-hub-leak', contract, 'defender reading excludes.*Rear-Naked-Choke', s => replace(s, 'shared.replaceChildren(...safety);', '/* mutant: keep the full attacker-rich hub */')],
  ['stale-response', contract, 'a late response cannot repaint', s => replace(replace(s, 'this.abort?.abort();', '/* mutant: no abort */'), 'if (serial !== this.serial || this.app.__ngDestroyed) return;', 'if (this.app.__ngDestroyed) return;')],
  ['toc-current-targets', contract, 'a late response cannot repaint', s => replace(s, 'row.append(link, toggle);', 'if (section.type === "options") { link.textContent = "Decisions from bottom"; link.dataset.sectionLink = "stale-bottom"; } row.append(link, toggle);')],
  ['reference-videos-removed', seam, 'published reference videos remain playable.*Principles/Frames', s => replace(s, 'if (/^\\/(Principles|Learning|Systems)\\//.test(path) && source)', 'if (false)')],
  ['native-reloads', seam, '1366px media identity and native', s => replace(s, 'if (typeof target.moveBefore === "function")', 'if (false)')],
  ['fallback-no-pause', seam, '1366px media identity and pause-before', s => replace(s, 'else { this.app.pauseLandFilm(); target.appendChild(host);', 'else { target.appendChild(host);')],
  ['fallback-stale-player', seam, '1366px media identity and pause-before', s => replace(s, 'target.appendChild(host); this.app._landFilmMoved();', 'target.appendChild(host);')],
  ['duplicate-host', seam, '1366px media identity and native', s => replace(s, 'host.toggleAttribute("data-reader-media",', 'target.append(host.cloneNode(true)); host.toggleAttribute("data-reader-media",')],
  ['moved-film-hit-target', seam, '1366px media identity and native', s => s, css => css + '\n[data-reader-media] .ng-clip{pointer-events:none!important}\n'],
  ['collapse-no-pause', seam, '1366px media identity and native', s => replace(s, 'this.app = app;', 'this.app = app; app.pauseLandFilm = () => {};')],
  ['pause-first-player-only', seam, 'pauseLandFilm pauses every owner player', s => replace(s, 'this.app = app;', 'this.app = app; app.pauseLandFilm = function () { const card = this._landFilmEl?.querySelector(".ng-clip"); if (card?._player) { card._player.pauseVideo(); card._mediaPaused = true; } };')],
  ['fixed-home', seam, '1366px normal media home', s => replace(s, 'this.game.append(this.mediaHome);', 'app.wrapRef.current.append(this.mediaHome);')],
  ['layout-no-coalescing', seam, '1366px normal media home', s => replace(s, 'if (this.layoutFrame || this.app.__ngDestroyed) return;', 'if (this.app.__ngDestroyed) return;')],
  ['layout-style-churn', seam, '1366px normal media home', s => replace(s, 'if (!same || el.style.getPropertyPriority(key) !== priority)', 'if (true)')],
  ['chrome-hook-ignored', sections, 'optional chrome frame', s => replace(s, 'typeof a.readerChromeFrame === "function"', 'false')],
  ['chrome-node-band-lost', sections, 'optional chrome frame', s => replace(s, 'if (available) start = band + headHeight + 44 + (chrome?.offset || 0);', 'if (available) start = headHeight + 44 + (chrome?.offset || 0);')],
  ['chrome-bottom-reserve-ignored', sections, 'optional chrome frame', s => replace(s, 'chrome?.bottomReserve != null', 'false')],
  ['head-over-map', sections, '1366px chrome keeps', s => replace(s, 'const parent = chrome ? this.root : flow,', 'const parent = this.root,'), css => css + '\n.ng-reader>.ng-reader-head{left:calc(50% - 455px);top:0}\n'],
  ['phone-tools-in-header', sections, '390px chrome keeps', s => replace(s, 'chrome && W <= 640 ? flow : head', 'false ? flow : head')],
  ['execution-label-clearance-lost', 'card-presentation.spec.ts', '1440px.*chosen card rises', s => replace(s, 'card.style.marginTop = shown.getBoundingClientRect().top - box.top - parseFloat(getComputedStyle(row).paddingTop) + "px";', 'card.style.marginTop = "0px";')],
  ['execution-row-anchor-lost', 'card-click-contract.spec.ts', 'with the pane open the stand-in', s => replace(s, 'card._ngDock.reader = { rowTop: box.top - game.top, height: game.height };', '/* mutant: forget the selected row */')],
  ['hand-close-behind-reader', 'land-layers.spec.ts', 'hand X owns its centre', s => s, css => css + '\n[data-hand-close]{z-index:4!important}\n'],
  ['native-game-focus-lost', 'pane-keyboard.spec.ts', 'recall page mounted under the pane', s => replace(s, '{ class: "ng-reader-game", tabindex: "-1" }', '{ class: "ng-reader-game" }')],
  ['reduced-motion-flash-lost', 'outcome-on-cards.spec.ts', 'reduced motion.*1440', s => s, css => replace(css, '.ng-reader,.ng-reader-article *', '.ng-reader,.ng-reader *')],
  ['entry-centering-lost', 'coldstart-backfill.spec.ts', 'landing card stays centred', s => replace(s, 'if (el !== row) style(el, "transform", "none", "important");', 'if (el !== row) style(el, "transform", "translateX(-50%)", "important");')],
  ['pane-card-overflow', 'layer-dock-centre.spec.ts', '800px with the pane open', s => replace(s, 'free.width - (deck && !beside ? 104 : 32)', 'W - (deck && !beside ? 104 : 32)')],
  ['media-inset-lost', 'film-row-arrows.spec.ts', '1440px.*no scrollbar', s => s, css => css + '\n[data-reader-game-media]{padding:0!important}\n'],
  ['film-only-node-band-lost', 'camera-continuity.spec.ts', '1440px.*CLEAR_SEC: a film', s => replace(s, 'showCard || showHand || homeMedia ?', 'showCard || showHand ?')],
  ['game-wheel-detached-target', 'landcard-deck.spec.ts', 'wheel momentum advances once', s => replace(s, 'if (event.composedPath().includes(this.game)) return;', 'if (this.game.contains(event.target)) return;')],
  ['native-game-touch-blocked', 'landcard-deck.spec.ts', 'long mobile choices', s => s, css => replace(css, '[data-reader-game-part=card]{touch-action:pan-y}', '[data-reader-game-part=card]{touch-action:none}')],
  ['native-game-keys-lost', 'landcard-deck.spec.ts', 'long recall answers', s => replace(s, 'return reader.gameKey(event) || readKey.call(this, event);', 'return readKey.call(this, event);')],
  ['native-page-scroll-lost', 'landcard-deck.spec.ts', 'long recall answers', s => replace(s, 'reader.gamePage !== this._landPage) reader.root.scrollTop = 0;', 'reader.gamePage !== this._landPage) {}')],
  ['pressed-answer-moved', 'reading-navigation.spec.ts', '1440px reader adoption during a mouse press', s => replace(s, ' || this.app._readerPress', '')],
]
const selection = process.env.SECTIONS_MUTANT_ONLY;
const selected = selection ? mutants.filter(([name]) => new RegExp(selection).test(name)) : mutants;
if (!selected.length) throw Error('No mutation controls match ' + selection);
const receipt = { builtReaderSha256: createHash('sha256').update(originals.get(readerPath)).digest('hex'), selection: selection || 'all', results: [] }
try {
  for (const [name, spec, grep, mutate, css] of selected) {
    for (const [path, bytes] of originals) writeFileSync(path, bytes)
    await build({ stdin: { contents: mutate(source), sourcefile: 'reader.src.js', resolveDir: resolve(root, 'neural/src'), loader: 'js' }, bundle: true, format: 'esm', target: 'es2019', minify: true, legalComments: 'none', outfile: readerPath, logLevel: 'silent' })
    if (css) writeFileSync(cssPath, css(originals.get(cssPath).toString()))
    const reportPath = resolve(out, name + '.json')
    const run = spawnSync(resolve(root, 'node_modules/.bin/playwright'), ['test', '-c', config, spec, '--grep', grep, '--max-failures=1', '--timeout=30000', '--reporter=list,json'], { cwd: root, encoding: 'utf8', timeout: 120000, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath } })
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
    const killed = run.status === 1 && failures.length === 1 && failures[0].status === 'failed' &&
      failures[0].errors.length > 0 && failures[0].errors.every(e => /expect\(/.test(e) && !/Test timeout|TimeoutError|page\.waitFor\w+:|locator\.\w+: Timeout/.test(e))
    receipt.results.push({ name, spec, grep, exit: run.status, killed, failures })
    writeFileSync(resolve(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
    console.log(name + ': ' + (killed ? 'killed (inspect assertion in log)' : 'NOT KILLED'))
  }
} finally {
  for (const [path, bytes] of originals) writeFileSync(path, bytes)
}
if (receipt.results.some(r => !r.killed)) process.exitCode = 1
