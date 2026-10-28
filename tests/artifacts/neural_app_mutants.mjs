// Historical NON-KILL, not coverage (H147): the desktop late-film control's former 400ms target
// passed with its film already present at first publication. H145 killed it; H147 did not, on
// the same app/spec bytes. Target the existing 2.6s past-ceiling journey (as on the phone), keeping
// the published-answer assertion. The original 400ms positive journey and its claims stay intact.
// D-326 / CI 48be3a910 / D-332 controls on the served neural.js. Run after the positive journeys, under the
// shared FIFO lock. NEURAL_MUTANT_APP must be the neural.js served by NEURAL_MUTANT_CONFIG's private
// server; NEURAL_MUTANT_ONLY optionally selects controls by name. No rebuild, capture, source or
// baseline change is made, and the original bytes are restored after every control.
// NON-KILLS, not coverage (H139 / ORCH-377): noahead-exchange-1440 and -390 both pass on green
// unmutated baselines. Reading-view exchanges use frameExecution; these journeys do not exercise
// the map-view `ahead` prediction. Keep their receipts and report both limits in the counts.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { Script } from 'node:vm'

const root = resolve(import.meta.dirname, '../..')
const app = process.env.NEURAL_MUTANT_APP, config = process.env.NEURAL_MUTANT_CONFIG, out = process.env.NEURAL_MUTANT_OUT
if (!app || !config || !out) throw Error('Name the served app, private config and evidence directory')
const original = readFileSync(app), source = original.toString()
// D-370: optional NEURAL_MUTANT_CSS, the served neural.css, for controls whose claim is an eager stylesheet rule.
const cssPath = process.env.NEURAL_MUTANT_CSS, cssOriginal = cssPath ? readFileSync(cssPath) : null
// [name, spec, grep, [[minified target, replacement]...], claim: message text or the asserting line, css edits?]
const controls = [
  // D10-N1: a genuinely held deck manifest lands while Watch is open. Suppress only that backfill;
  // the new question-presence claim must fail, rather than passing on an already-mounted card.
  ['watch-backfill-lost', 'coldstart-backfill.spec.ts', 'a payload arriving behind Watch',
    [['this.refreshOptionOdds(),this._landBackfill(),this._refreshChallengeEvidence()',
      'this.refreshOptionOdds(),this._choiceWatch||this._landBackfill(),this._refreshChallengeEvidence()']],
    'the newly backfilled question exists behind Watch'],
  // D-326: the notice keeps showing while the move executes.
  ['reward-hold-lost', 'roll-execution.spec.ts', 'reward notice yields',
    [['this.holdChallengeReward&&this.holdChallengeReward(),', ''], ['if(this._execution||this.__ngDestroyed)return;', 'if(this.__ngDestroyed)return;']],
    'the showing notice yields to the executing move'],
  // A calm reading catch's lease window: an escape picked inside it re-zooms again.
  ['calm-catch-window-lost', 'camera-continuity.spec.ts', '1440px camera continuity.*an escape: the catch keeps its own framing',
    [['this._execution.camera===!1&&this._execution.calmHeld&&', 'this._execution.camera===!1&&!1&&']], 'the catch keeps its framing through the escape'],
  // D-332 D2-B1: the window re-read every frame (the 105c5f110 code) instead of the pick's latch.
  ['calm-catch-latch-lost', 'camera-continuity.spec.ts', '1440px camera continuity.*an escape picked just inside',
    [['this._execution.camera===!1&&this._execution.calmHeld&&', 'this._execution.camera===!1&&this._calmCatchHeld()&&']],
    'an escape picked inside the window keeps the catch framing to the landing'],
  // The intro's handover starts a fresh roll over a board staged during it (a shared-list read).
  ['intro-overrides-stage', 'defending-arrivals.spec.ts', 'a shared list link opens its defending item',
    [['this._refPage||this._staged!=null||this.startRoll()', 'this._refPage||this.startRoll()']], 'the other read role must be a reachable drawn canvas half'],
  // D-338: a saved Focus is read again by the layer seam (its reading* overrides hide the card).
  ['d338-saved-focus-layer-read', 'reading-mode.spec.ts', 'reading perspectives and Back retain canonical content without gameplay$',
    [['let t=ft[e];return!t||this.get(t,!0)!==!1', 'let t=ft[e];return!t||this.get(this.get("readingFocus",!1)?"reading"+t.slice(4):t,!0)!==!1']],
    'a saved Focus no longer hides the question'],
  // The follow-cam lifts the node against the reading band's edge again (two rest framings).
  ['reading-band-lift-restored', 'pane-layout.spec.ts', '1440px pane moves film, card, article',
    [['(!d.band||u)&&(a.lift={f:this.camFocus', '(a.lift={f:this.camFocus'], ['active:!d.band||!!(u!=null&&u.band)', 'active:!0']], 131],   // back.node.y; 125 -> 127 (D-347), -> 131 (D-368's pane-layout:82). D-355: the band lifts only in a flight
  // H46 (2026-10-21): landcard-modes:349 now waits for the defender's question before its press; the arrows must
  // still be what pages it (the defense mode dropped from the landing card's arrow branch).
  ['defense-arrows-lost', 'landcard-modes.spec.ts', 'the generic defending card pages its own deck with the same arrows',
    [['["land","attempt","defense"].includes(this._landMode)&&this._landPage!=null&&(o.key==="ArrowLeft"', '["land","attempt"].includes(this._landMode)&&this._landPage!=null&&(o.key==="ArrowLeft"']], 'arrows page the defender deck'],
  // D-352 (Delta 6): S1, a landing laid out with the article put away is live, so showing the article
  // mid-load publishes it pinned instead of holding it; and N1, the hand's half of D-351's hold.
  ['d352-book-rehold', 'article-sections.spec.ts', 'D-352: showing the article while its page loads',
    [['else if(!t)n.live=!0;else{', 'else if(!t);else{']], 'the live hand is never hidden again'],
  ['d351-hand-hold-removed', 'article-sections.spec.ts', 'D-351: an exchange whose article lands late',
    [['h==null||h.toggleAttribute("data-reader-pending",a>0);return c&&a<=0', 'h==null||h.toggleAttribute("data-reader-pending",!1);return c&&a<=0']], 'the new hand is shown once, at its final place'],
  // D-354 (Delta 8, B1): parts the reader adopted follow the pane's slide in the same frame.
  ['d354-pane-follow-lag', 'pane-keyboard.spec.ts', 'D-354: the landing deck and its arrows follow the pane',
    [[',this.uiShift!==s&&((r=this._reader)==null||r.layoutNow())', '']], 'the card and its arrows follow the pane in the same frame'],
  // D-354 (H95, H97): REAL BREAK from D-351. A hand the reader held starts its Win chance when it publishes.
  ['d354-held-hand-no-value', 'article-sections.spec.ts', 'D-354: a hand the reader held starts its Win chance',
    [['return c&&a<=0&&this._ensureGameValues(),a}_readerGraded(){', 'return a}_readerGraded(){']], 'the Win chance starts in the frame the held hand publishes'],
  // RETIRED (D-368, layout C): d354-play-film-left-home; the game film never enters the Videos slot.
  // D-354 N3: the film's only remover ends the reader's media-home observation.
  ['d354-removed-film-observed', 'defending-landing.spec.ts', 'D-354 N3: a removed film',
    [['._ngRO.disconnect(),(e=this._reader)==null||e.resize.unobserve(this._landFilmEl);try{', '._ngRO.disconnect();try{']], 'the removed film is no longer observed by the reader'],
  // D-350b: the header's ZERO-overlap mutants (v1.219.0's noprelift / noahead), scripted so the frame filter is
  // shown not to carry their kills. noprelift: the arrival and the URL intro make no room for the rows.
  ['noprelift-roll-start', 'camera-continuity.spec.ts', 'camera continuity.*roll start: the intro and the staged arrival',
    [['_liftForLanding(e,t){let s=this.nodes&&this.nodes[t];', '_liftForLanding(e,t){return e;let s=this.nodes&&this.nodes[t];']], 'ZERO overlap roll start @'],
  ['noprelift-url-arrival', 'camera-continuity.spec.ts', 'camera continuity.*URL arrival: from the intro',
    [['_liftForLanding(e,t){let s=this.nodes&&this.nodes[t];', '_liftForLanding(e,t){return e;let s=this.nodes&&this.nodes[t];']], 'ZERO overlap URL arrival @'],
  // noahead: `_viewRect` ignores `ahead`, so a landing's band is not predicted before its rows mount.
  ['noahead-exchange-1440', 'camera-continuity.spec.ts', '1440px camera continuity.*an exchange lands on a new current node',
    [['e&&e.ahead!=null&&e.ahead!==!1&&(a=this._predictBottom(e.ahead),u=!0)', '!1&&(a=this._predictBottom(e.ahead),u=!0)']], 'ZERO overlap exchange @'],
  ['noahead-exchange-390', 'camera-continuity.spec.ts', '390px camera continuity.*an exchange lands on a new current node',
    [['e&&e.ahead!=null&&e.ahead!==!1&&(a=this._predictBottom(e.ahead),u=!0)', '!1&&(a=this._predictBottom(e.ahead),u=!0)']], 'ZERO overlap exchange @'],
  // D-433 (2026-10-26): migrate only the phone ordering/short-band premises.
  // U16's account, card spacing, scrolled input, handoff and restoration controls remain.
  // Kills on this implementation are pending the guarded host run; these tuples
  // name their claims, not new execution evidence.
  ['d370-band-186-in-catch', 'defending-landing.spec.ts', 'D-433: at 390x631 the smaller live band',
    [['this.W<=640?this._phoneCatch()?this.H<700?80:144:186:144', 'this.W<=640?186:144']], 'D-433 short live catch uses the smaller band'],
  ['u16-account-hidden', 'defending-landing.spec.ts', 'D-433: at 390x631 the smaller live band', [],
    'D-433 short live catch uses the smaller band', [['.ng-landcard.ng-land-deck{min-height:236px;padding:11px 12px 18px!important}',
      '.ng-landcard.ng-land-deck{min-height:236px;padding:11px 12px 18px!important}[data-phone-catch] .ng-acctwrap{visibility:hidden!important}']]],
  ['u16-card-compacted', 'defending-landing.spec.ts', 'D-433: at 390x631 the smaller live band', [],
    'D-433 short live catch uses the smaller band', [['.ng-landcard.ng-land-deck{min-height:236px;padding:11px 12px 18px!important}',
      '.ng-landcard.ng-land-deck{min-height:236px;padding:11px 12px 18px!important}[data-phone-catch] .ng-landcard.ng-land-deck{padding-top:8px!important}']]],
  ['u16-scrolled-answer-inert', 'defending-landing.spec.ts', 'D-433: in a catch at 390x631',
    [["_mcAnswer(e,t,s,i,n,o,r){", "_mcAnswer(e,t,s,i,n,o,r){if(this._reader?.root.scrollTop>0&&this._mc?.surface===\"panic\")return;"]], 'the scrolled escape answer receives its real mouse click'],
  ['u16-band-restoration-lost', 'defending-landing.spec.ts', 'D-433: at 390x631 the smaller live band',
    [['this.W<=640?this._phoneCatch()?this.H<700?80:144:186:144', 'this.W<=640?80:144']], 'the result transition restores the usual 186px band'],
  ['u16-band-ends-at-pick', 'defending-landing.spec.ts', 'D-433: at 390x631 the smaller live band',
    [['this.isMobile()&&!!this._defensePressure&&this._layerOn("card")', 'this.isMobile()&&!!this._defensePressure&&this._landMode==="defense"&&this._layerOn("card")']],
    'at the pick the small band holds'],
  ['d370-calm-landing-concedes', 'defending-landing.spec.ts', 'U16 b: a calm phone defender',
    [['this.isMobile()&&!!this._defensePressure&&this._layerOn("card")', 'this.isMobile()&&this._landMode==="defense"&&this._layerOn("card")']],
    'a calm phone defender keeps the usual band'],
  // D-370 (2), D-325: a published question never moves for its film; the hold waits for the node's content chunk.
  ['d370-late-film-unheld-390', 'reading-media-placement.spec.ts', '390px a film chunk landing after 2.6s',
    [['l&&!l.done&&a<=0&&t&&!this._readerPin&&this._filmPending()', '!1']], 'the published answers never move'],
  ['d370-late-film-unheld-1440', 'reading-media-placement.spec.ts', '1440px a film chunk landing after 2.6s',
    [['l&&!l.done&&a<=0&&t&&!this._readerPin&&this._filmPending()', '!1']], 'the published answers never move'],
  // D-355: the band's soft hold engages only for a flight that reaches its lower edge (a URL arrival), never for one
  // inside the band (a hover's re-aim), and it is what keeps the arrival clear of the Moves row.
  ['d355-flight-lift-ungated', 'dual-pair.spec.ts', 'hovering any pair names it once',
    [['active:!d.band||!!(u!=null&&u.band)', 'active:!0']], 'and the role moved below it'],
  ['d355-flight-lift-lost', 'camera-continuity.spec.ts', '1440px camera continuity.*URL arrival: from the intro',
    [['(!d.band||u)&&(a.lift=', '!d.band&&(a.lift=']], 'URL arrival @'],
  // ORCH-382 / H140-H144: the old 30px gate engages after contact; activating the subject only
  // when its gate opens starts the spring too late. Both fail the unchanged ZERO-overlap pin.
  ['flight-lift-fixed-margin', 'camera-continuity.spec.ts', '1440px camera continuity.*URL arrival: from the intro',
    [['u.band=(this.H||800)/2+(this.camFocus.y-this.cam.cy)*(this.W||1200)/this.cam.vw+g+gt>d.bottom', 'u.band=(this.H||800)/2+(this.pairMid(h).y-this.cam.cy)*(this.W||1200)/this.cam.vw+30>d.bottom']], 'ZERO overlap URL arrival @'],
  ['flight-lift-tracking-lost', 'camera-continuity.spec.ts', '1440px camera continuity.*URL arrival: from the intro',
    [['(!d.band||u)&&(a.lift=', '(!d.band||u!=null&&u.band)&&(a.lift=']], 'ZERO overlap URL arrival @'],
  // D-371 / H136-H138: the initial animation frame can precede the portrait's final height. Removing only
  // its transition-end reveal reproduces the card extending below the Learning pane at 1440px.
  ['concept-fit-reveal-lost', 'concepts-surface.spec.ts', 'principle film study.*1440px',
    [['e.addEventListener("transitionend",_)', 'void 0']], 'the expanded portrait and its close button fit inside the reading pane'],
  // U47 d (owner, 2026-10-27): a landing asks with its question alone; "Answer for Points", or a tap on the
  // question, shows today's card for the rest of the landing. Each control dies at one covered-card claim.
  ['u47-arrives-shown', 'covered-card.spec.ts', 'U47 d a landing asks with its question alone.*\\(390\\)',
    [['i||(this._landAsk=!0,this._landPage=null', 'i||(this._landAsk=!1,this._landPage=null']], 'U47 d: on landing only the question (and its ✕) shows; the card waits'],
  ['u47-asking-clock-runs', 'covered-card.spec.ts', 'U47 d a landing asks with its question alone.*\\(1440\\)',
    [['_clockGate(){return!this._landAsk&&', '_clockGate(){return ']], 'an arriving question has no running clock'],
  ['u47-asking-pages', 'covered-card.spec.ts', 'U47 d a landing asks with its question alone.*\\(1440\\)',
    [['_landPageTo(e){let t=this._landEl;if(!t||this._landAsk||', '_landPageTo(e){let t=this._landEl;if(!t||']], 'an asking question cannot grade, page or charge time'],
  ['u47-reveal-keeps-answers-inert', 'covered-card.spec.ts', 'U47 d a landing asks with its question alone.*\\(390\\)',
    [['i.inert=!1,this.fx("land_q_taken_up"', 'this.fx("land_q_taken_up"']], "Answer for Points shows today's card, with no reveal control inside it"],
  // U34 a's per-card cover, reintroduced at paging: the shown card must stay shown.
  ['u47-paging-asks-again', 'covered-card.spec.ts', 'U47 d a landing asks with its question alone.*\\(1440\\)',
    [['this._landPage=n,this._armPagedLandClock(),this._readStop()', 'this._landPage=n,this._landAsk=!0,this._armPagedLandClock(),this._readStop()']], 'the shown card stays shown across paging, with its own window'],
  ['u47-question-tap-dead', 'covered-card.spec.ts', 'U47 d tapping the question itself shows the card.*\\(390\\)',
    [['u.addEventListener("click",()=>this._landReveal());', '']], 'a tap on the question shows the card'],
  ['u47-phone-clamp-lost', 'covered-card.spec.ts', 'U47 d a long question is cut.*390x844', [],
    'U47 d: a long question is cut to two lines on a phone', [['-webkit-line-clamp:2;', '']]],
  ['u47-desktop-clamped', 'covered-card.spec.ts', 'U47 d a long question is cut.*1440x900', [],
    'desktop shows the whole question and still offers Answer for Points', [['@media(max-width:640px){[data-land-ask] [data-land-q]>div:first-child{', '@media(min-width:1px){[data-land-ask] [data-land-q]>div:first-child{']]],
  ['u47-desktop-offer-lost', 'covered-card.spec.ts', 'U47 d a long question is cut.*1440x900',
    [['d.appendChild(b)}if(d.appendChild(f)', 'this.isMobile()&&d.appendChild(b)}if(d.appendChild(f)']], "Answer for Points sits on the question's line, at its right"],
  ['u47-reveal-keeps-asking-face', 'covered-card.spec.ts', 'U47 d a long question is cut.*390x844',
    [['this._landTakenAt=performance.now(),e.removeAttribute("data-land-ask");', 'this._landTakenAt=performance.now();']], 'the shown card carries the whole question'],
  ['u47-asking-answers-laid-out', 'covered-card.spec.ts', 'U35 D-433.*1440x900', [],
    'U47 d the asking card collapses its answer block', [['[data-land-ask] [data-land-count],[data-land-ask] [data-land-q]>[inert]{display:none!important}', '[data-land-ask] [data-land-count]{display:none!important}']]],
  ['u47-reveal-scroll-writer', 'covered-card.spec.ts', 'U35 D-433.*390x844',
    [['i.inert=!1,this.fx("land_q_taken_up"', 'i.inert=!1,e.scrollIntoView(),this.fx("land_q_taken_up"']], 'D-433 no automatic scroll writer through Answer for Points'],
  // U47 d: a reading gesture (a phone scrolls the reader to reach it) must not decline an asking question.
  ['u47-reading-declines-asking', 'covered-card.spec.ts', 'U47 d tapping the question itself shows the card.*\\(390\\)',
    [['(t&&this._landAsk||(s.answered=!0', '((s.answered=!0']], 'U47 d: scrolling to an asking question does not decline it'],
  // The covered-card branch's "a covered invitation is free to pass" silenced the cold-start funnel's
  // question_ignored mark; restoring dev's pending question is what coldstart-funnel pins.
  ['u47-asking-ignore-silent', 'coldstart-funnel.spec.ts', 'ignoring the landing question is measured',
    [['if(!n.paged&&!o){this._landPending=!0;let', 'if(!n.paged&&!o){this._landPending=!this._landAsk;let']], 'beat "land_q_ignored" emitted'],
  // U47 d review (2026-10-28): the fix list's controls, each killed at the claim its fix added.
  ['u47-double-tap-answers', 'covered-card.spec.ts', 'U47 d a double tap on Answer for Points grades nothing \\(touch, 180 ms\\)',
    [['_landTapGuard(e){var t;return(e==="land"||e==="panic")&&', '_landTapGuard(e){var t;return!1&&(e==="land"||e==="panic")&&']], 'a double tap on Answer for Points grades nothing'],
  ['u47-double-click-answers', 'covered-card.spec.ts', 'U47 d a double click on Answer for Points grades nothing \\(390 landing\\)',
    [['_landTapGuard(e){var t;return(e==="land"||e==="panic")&&', '_landTapGuard(e){var t;return!1&&(e==="land"||e==="panic")&&']], 'a double click on Answer for Points grades nothing'],
  ['u47-catch-double-click-answers', 'covered-card.spec.ts', "U47 d a double click on the catch's Answer for Points",
    [['_landTapGuard(e){var t;return(e==="land"||e==="panic")&&', '_landTapGuard(e){var t;return!1&&(e==="land"||e==="panic")&&']], "a double click on the catch's Answer for Points grades nothing"],
  // The review's repro: every "reading" decline exempted while asking, so a link spared the question.
  ['u47-link-spares-asking', 'covered-card.spec.ts', 'U47 d following an article link declines an asking question',
    [['(t&&this._landAsk||(s.answered=!0', '(e==="reading"&&this._landAsk||(s.answered=!0']], 'following an article link declines the asking question (reason reading), as on dev'],
  // The branch's reveal that played a reading arrival ("as it already works" says it must not).
  ['u47-arrival-plays-on-take-up', 'reading-contract.spec.ts', '1440px a real landing-card answer starts the dormant game once',
    [['this._readerIntent?this._reader&&(this._reader.interacting=!1):(', '!1?this._reader&&(this._reader.interacting=!1):(']], 'Answer for Points leaves a reading arrival dormant, with no clock'],
  ['u47-take-up-unmeasured', 'covered-card.spec.ts', 'U47 d a landing asks with its question alone.*\\(1440\\)',
    [['this.fx("land_q_taken_up",{deckKey:t.key||null,mode:this._landMode||"land"}),', '']], 'land_q_taken_up fires once per take-up'],
  ['u47-asking-letters-answer', 'covered-card.spec.ts', 'U47 d a landing asks with its question alone.*\\(390\\)',
    [['g=f=>{if(!(a.inert||["land","panic"].includes(r.surface)&&this._landHidden(!0))){if(u||r.spent)', 'g=f=>{if(!(["land","panic"].includes(r.surface)&&this._landHidden(!0))){if(u||r.spent)']], 'an asking question cannot grade, page or charge time'],
  ['u47-hover-latch-lost', 'landing-card.spec.ts', 'no clock before Answer for Points',
    [['["pointerdown","pointermove","keydown"]', '["pointerdown","keydown"]']], 'one hover engages'],
  ['u36-motion-listener-lost', 'defending-landing.spec.ts', 'reduced motion keeps a static cue',
    [['(e=this._motionQuery)==null||e.addEventListener("change",this._motionChanged)', '(e=this._motionQuery)==null||0']], 'the media-change listener acted, with no frame pumped'],
  ['u35-watch-in-question', 'covered-card.spec.ts', 'U35 every question builder segregates technique media',
    [['if(d.appendChild(f),this._landQ=c', 'if(d.appendChild(f),d.insertAdjacentHTML("beforeend","<button data-choice-watch>Watch technique</button>"),this._landQ=c']], 'U35 question surfaces contain no media/watch controls'],
  // REAL BREAK inherited from bfdfad39d: a reading arrival has intent=true and a live hand. Restoring that
  // gate leaves plain digits dead although the same card plays by mouse (H138 video-cards cross).
  ['reading-intent-blocks-digit', 'submission-choices.spec.ts', 'triangle defender',
    [['if(u&&!((d=this._reader)!=null&&d.interacting))', 'if(u&&!this._reader?.intent&&!((d=this._reader)!=null&&d.interacting))']],
    '...and the chosen escape stays on the table'],
]
const only = process.env.NEURAL_MUTANT_ONLY ? new RegExp(process.env.NEURAL_MUTANT_ONLY) : null
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
mkdirSync(out, { recursive: true })
const receipt = { original: hash(original), results: [] }
// D5-B2: a kill counts only against a GREEN unmutated baseline of the same spec and grep (once per pair).
const baselines = new Map()
const baseline = (spec, grep) => {
  const key = spec + '\n' + grep
  if (!baselines.has(key)) {
    writeFileSync(app, original)
    // H139: discarded baseline stdout left two URL-arrival reds without their assertion evidence.
    // Preserve the same unmutated run's log and JSON; a red baseline still cannot count as a kill.
    const report = resolve(out, 'baseline-' + baselines.size + '.json')
    const log = resolve(out, 'baseline-' + baselines.size + '.log')
    const run = spawnSync(resolve(root, 'node_modules/.bin/playwright'), ['test', '-c', config, spec, '--grep', grep, '--output', resolve(out, 'baseline-' + baselines.size + '-results'), '--reporter=list,json'], { cwd: root, encoding: 'utf8', timeout: 240000, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: report } })
    writeFileSync(log, (run.stdout || '') + (run.stderr || ''))
    baselines.set(key, { green: run.status === 0 && / passed /.test(run.stdout || ''), exit: run.status, report, log })
  }
  return baselines.get(key)
}
try {
  for (const [name, spec, grep, edits, claim, cssEdits] of controls.filter(([n]) => !only || only.test(n))) {
    const base = baseline(spec, grep)
    const once = (text, list) => list.reduce((out, [from, to]) => {
      if (out.split(from).length !== 2) throw Error(name + ': the target moved: ' + from)
      return out.replace(from, to)
    }, text)
    const mutant = once(source, edits)
    if (cssEdits && !cssOriginal) throw Error(name + ': a stylesheet control needs NEURAL_MUTANT_CSS')
    if (cssEdits) writeFileSync(cssPath, once(cssOriginal.toString(), cssEdits))
    // D-354: a mutant that does not parse never boots; its run waited out the 240s timeout, orphaned
    // the private server, and every later baseline read red on the busy port. Refuse it here instead.
    try { new Script(mutant) } catch (e) { throw Error(name + ': the mutant does not parse: ' + e.message) }
    writeFileSync(app, mutant)
    const report = resolve(out, name + '.json')
    const run = spawnSync(resolve(root, 'node_modules/.bin/playwright'), ['test', '-c', config, spec, '--grep', grep, '--max-failures=1', '--output', resolve(out, name + '-results'), '--reporter=list,json'], {
      cwd: root, encoding: 'utf8', timeout: 240000, env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: report },
    })
    writeFileSync(app, original)
    if (cssOriginal) writeFileSync(cssPath, cssOriginal)
    writeFileSync(resolve(out, name + '.log'), (run.stdout || '') + (run.stderr || ''))
    const failures = []
    const visit = suite => {
      for (const s of suite.specs || []) for (const t of s.tests) for (const r of t.results) if (r.status !== 'passed') failures.push(r)
      for (const child of suite.suites || []) visit(child)
    }
    try { visit(JSON.parse(readFileSync(report, 'utf8'))) } catch {}
    const errors = failures.flatMap(r => r.errors || [])
    const text = e => (e.message || '').replace(/\u001b\[[0-9;]*m/g, '')
    // A wait timeout is infrastructure/fixture failure, never a mutation kill.
    const killed = base.green && run.status === 1 && failures.length === 1 && failures[0].status === 'failed' && errors.length > 0 &&
      errors.every(e => /expect\(/.test(text(e)) && !/Test timeout|TimeoutError|page\.waitFor\w+:|locator\.\w+: Timeout/.test(text(e))) &&
      errors.some(e => typeof claim === 'number' ? e.location?.line === claim : text(e).includes(claim))
    receipt.results.push({ name, spec, baseline: base, mutant: hash(mutant), exit: run.status, killed, errors: errors.map(e => text(e).split('\n')[0]) })
    console.log(name + ': ' + (!base.green ? 'BASELINE RED, not counted' : killed ? 'killed at its claim' : 'NOT KILLED'))
  }
} finally {
  writeFileSync(app, original)
  if (cssOriginal) writeFileSync(cssPath, cssOriginal)
  receipt.restored = hash(readFileSync(app)) === receipt.original && (!cssOriginal || hash(readFileSync(cssPath)) === hash(cssOriginal))
  writeFileSync(resolve(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
}
if (!receipt.restored || receipt.results.some(r => !r.killed)) process.exitCode = 1
