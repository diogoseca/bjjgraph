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
const mutants = [
  ['content-loss', sections, 'semantic sections.*Mount/Bottom', s => replace(s, 'fragment.append(part.node);', 'part.node.querySelector?.("p")?.remove(); fragment.append(part.node);')],
  ['wrong-order', sections, 'semantic sections.*Knee-Slice-Pass/Attacker', s => replace(s, 'return rank(a) - rank(b);', 'return rank(b) - rank(a);')],
  ['settings-ignored', sections, 'section settings carry', s => replace(s, 'return app.get("readerSection." + type, true) !== false;', 'return true;')],
  ['collapsed-body-still-visible', sections, 'contents and header targets at 390x844', s => replace(s, 's.body.hidden = !shown;', 's.body.hidden = false;')],
  ['aria-control-broken', sections, 'contents and header targets at 390x844', s => replace(s, '"aria-controls": id + "-body"', '"aria-controls": id + "-missing"')],
  ['phone-contents', sections, 'contents and header targets at 390x844', s => replace(s, '|| !fits;', '|| false;')],
  ['label-toggles', sections, 'contents and header targets at 1366x768', s => replace(s, 'if (section) this.scrollTo(section.toggle);', 'if (section) { this.toggleSection(section.type); this.scrollTo(section.toggle); }')],
  ['eye-scrolls', sections, 'contents and header targets at 1366x768', s => replace(s, 'this.app.set("readerSection." + type, shown);', 'this.app.set("readerSection." + type, shown); this.scrollTo(this.sections.find(s => s.type === type).toggle);')],
  ['toc-input-guard-lost', sections, 'floating contents owns.*dark', s => replace(s, 'contents.style.pointerEvents = "auto";', 'contents.style.pointerEvents = "auto"; this.app._readerTocEl = null;')],
  ['toc-camera-occupied-lost', sections, 'current node clears the occupied TOC', s => replace(s, 'const occupied = [toc, this.articleEl]', 'const occupied = [this.articleEl]')],
  ['toc-first-click-repaint', sections, 'floating contents owns.*dark', s => replace(s, 'if (!b || b.getAttribute("aria-expanded") === String(shown)) continue;', 'if (!b) continue;')],
  ['toc-shifts-column', sections, 'contents and header targets at 1440x900', s => replace(s, 'free.center - parseFloat(this.articleEl.style.width) / 2', 'free.center - parseFloat(this.articleEl.style.width) / 2 - 100')],
  ['toc-overlaps-tablet', sections, 'contents and header targets at 1024x768', s => replace(s, '>= tocWidth + 12', '>= 0')],
  ['toc-not-fixed', sections, 'floating contents owns.*dark', s => s, css => replace(css, '.ng-reader-toc{position:fixed', '.ng-reader-toc{position:absolute')],
  ['toc-container', sections, 'floating contents owns.*light', s => s, css => css + '\n.ng-reader-toc{background:#1b2034;border:1px solid #414c68;box-shadow:0 0 4px #000}\n'],
  ['missing-gap', sections, '1366px choices precede', s => s, css => replace(css, '--section-gap:6px', '--section-gap:0px')],
  ['collapsed-contrast', sections, 'contents and header targets at 390x844', s => s, css => replace(css, 'color:#a8b0c2', 'color:#555b68')],
  ['defender-hub-leak', contract, 'defender reading excludes.*Rear-Naked-Choke', s => replace(s, 'shared.replaceChildren(...safety);', '/* mutant: keep the full attacker-rich hub */')],
  ['stale-response', contract, 'a late response cannot repaint', s => replace(replace(s, 'this.abort?.abort();', '/* mutant: no abort */'), 'if (serial !== this.serial || this.app.__ngDestroyed) return;', 'if (this.app.__ngDestroyed) return;')],
  ['native-reloads', seam, '1366px media identity and native', s => replace(s, 'if (typeof target.moveBefore === "function")', 'if (false)')],
  ['fallback-no-pause', seam, '1366px media identity and pause-before', s => replace(s, 'else { this.app.pauseLandFilm(); target.appendChild(host);', 'else { target.appendChild(host);')],
  ['fallback-stale-player', seam, '1366px media identity and pause-before', s => replace(s, 'target.appendChild(host); this.app._landFilmMoved();', 'target.appendChild(host);')],
  ['duplicate-host', seam, '1366px media identity and native', s => replace(s, 'host.toggleAttribute("data-reader-media",', 'target.append(host.cloneNode(true)); host.toggleAttribute("data-reader-media",')],
  ['moved-film-hit-target', seam, '1366px media identity and native', s => s, css => css + '\n[data-reader-media] .ng-clip{pointer-events:none!important}\n'],
  ['collapse-no-pause', seam, '1366px media identity and native', s => replace(s, 'this.app = app;', 'this.app = app; app.pauseLandFilm = () => {};')],
  ['fixed-home', seam, '1366px normal media home', s => replace(s, 'this.game.append(this.mediaHome);', 'app.wrapRef.current.append(this.mediaHome);')],
  ['layout-no-coalescing', seam, '1366px normal media home', s => replace(s, 'if (this.layoutFrame || this.app.__ngDestroyed) return;', 'if (this.app.__ngDestroyed) return;')],
  ['layout-style-churn', seam, '1366px normal media home', s => replace(s, 'if (!same || el.style.getPropertyPriority(key) !== priority)', 'if (true)')],
  ['chrome-hook-ignored', sections, 'optional chrome frame', s => replace(s, 'typeof a.readerChromeFrame === "function"', 'false')],
  ['chrome-node-band-lost', sections, 'optional chrome frame', s => replace(s, 'start += chrome.offset;', 'start = chrome.offset;')],
  ['chrome-bottom-reserve-ignored', sections, 'optional chrome frame', s => replace(s, 'chrome?.bottomReserve != null', 'false')],
  ['head-over-map', 'dual-pair.spec.ts', 'hit-test reads where the orb is drawn', s => replace(s, 'const parent = chrome ? this.root : this.articleEl,', 'const parent = this.root,'), css => css + '\n.ng-reader>.ng-reader-head{left:calc(50% - 455px);top:0}\n'],
  ['phone-tools-in-header', sections, '390px chrome keeps', s => replace(s, 'chrome && W <= 640 ? this.articleEl : head', 'false ? this.articleEl : head')],
  ['execution-label-clearance-lost', 'card-presentation.spec.ts', '1440px.*chosen card rises', s => replace(s, 'card.style.marginTop = shown.getBoundingClientRect().top - box.top - parseFloat(getComputedStyle(row).paddingTop) + "px";', 'card.style.marginTop = "0px";')],
  ['execution-row-anchor-lost', 'card-click-contract.spec.ts', 'with the pane open the stand-in', s => replace(s, 'card._ngDock.reader = { rowTop: box.top - game.top, height: game.height };', '/* mutant: forget the selected row */')],
  ['hand-close-behind-reader', 'land-layers.spec.ts', 'hand X owns its centre', s => s, css => css + '\n[data-hand-close]{z-index:4!important}\n'],
  ['native-game-focus-lost', 'pane-keyboard.spec.ts', 'recall page mounted under the pane', s => replace(s, '{ class: "ng-reader-game", tabindex: "-1" }', '{ class: "ng-reader-game" }')],
  ['reduced-motion-flash-lost', 'outcome-on-cards.spec.ts', 'reduced motion.*1440', s => s, css => replace(css, '.ng-reader,.ng-reader-article *', '.ng-reader,.ng-reader *')],
  ['entry-centering-lost', 'coldstart-backfill.spec.ts', 'landing card stays centred', s => replace(s, 'style(el, key, value, "important");', 'style(el, key, value, key === "transform" ? "" : "important");')],
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
    const run = spawnSync(resolve(root, 'node_modules/.bin/playwright'), ['test', '-c', config, spec, '--grep', grep, '--max-failures=1', '--timeout=30000'], { cwd: root, encoding: 'utf8', timeout: 120000, env: process.env })
    const log = (run.stdout || '') + (run.stderr || '')
    writeFileSync(resolve(out, name + '.log'), log)
    const killed = run.status === 1 && /1 failed/.test(log) && !/No tests found|already used|Executable doesn't exist|webServer.*not able/.test(log)
    receipt.results.push({ name, spec, grep, exit: run.status, killed })
    writeFileSync(resolve(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
    console.log(name + ': ' + (killed ? 'killed (inspect assertion in log)' : 'NOT KILLED'))
  }
} finally {
  for (const [path, bytes] of originals) writeFileSync(path, bytes)
}
if (receipt.results.some(r => !r.killed)) process.exitCode = 1
