import {
  accountBubble,
  brand,
  comboPop,
  drillTab,
  eventToast,
  graphField,
  landingCard,
  legend,
  loader,
  momentum,
  optionTray,
  transport,
  verdict,
  vignette,
  winLose,
} from "./components-core.js";
import {
  authModal,
  challengeCue,
  challengesPanel,
  coach,
  collectionPanel,
  dossier,
  drillPanel,
  explorerPanel,
  optionSheet,
  panicCard,
  progressNudge,
  progressPanel,
  restartCard,
  rewardToast,
  settingsModal,
  systemState,
} from "./components-panels.js";
import { pane } from "./components-pane.js";
import { listPicker, shareCue } from "./components-share.js";
import { defaultContext } from "./fixtures.js";
import { icon } from "./icons.js";

function intro({ firstRun = false } = {}) {
  return `<section class="ng-intro" data-production-selector=".ng-intro">
    <h1>${firstRun ? "Your first roll." : "Roll the graph."}</h1>
    <p>${firstRun ? "Choose a move, answer what you know, and watch the state machine react." : "A live roll plays out across the map. Choose your move, or let it flow."}</p>
  </section>`;
}

function pausedChip({ staged = false } = {}) {
  return `<div class="paused-chip ng-paused">${icon("pause", 11)} ${staged ? "STAGED · CLOCK HELD" : "PAUSED"}</div>`;
}

// ── A CHECKPOINT IS THE PANE, NOT A MODAL ──────────────────────────────────────────────────
//
// `_checkpointShow()` (app.src.jsx) sets `drillEntries`, calls
// `setDrillHeader("Checkpoint", (cp.i + 1) + " of " + cp.picks.length + " \u00b7 " + cp.unit.name)`,
// then `renderDrill(); deckOpen = true; applyDeckVisibility()`. That is the study takeover of the
// one left pane — `_paneStudyActive()` counts `_checkpoint` alongside a deck and a session — and
// there is no dialog anywhere in it.
//
// The catalog used to draw a centred `role="dialog"` modal headed "BLUE BELT CHECKPOINT · 4/8",
// annotated `[data-checkpoint]`: a surface production does not have, a string it has never
// emitted, and a selector with ZERO matches in app.src.jsx. /dev is internal-only and is never
// linked to end users, so its whole job is fidelity — the ceremony had no audience to justify it.
// Owner's call. Archive: "THE CATALOG'S CHECKPOINT WAS A MODAL PRODUCTION HAS NEVER HAD".
function checkpoint(
  { result = "question", step = 2, total = 6, unit = "Foundations and complete loops" } = {},
  context = defaultContext,
  paneState = null,
) {
  return pane(
    { ...(paneState || {}), study: "checkpoint", checkpoint: { result, step, total, unit } },
    context,
  );
}

function browser({ empty = false } = {}, context = defaultContext) {
  return `<div class="modal-layer ng-modal-layer"><section class="modal-card ng-flash-browser" data-production-selector="[data-flash-browser]">
    <header><div><small>STUDY LIBRARY</small><h2>Flashcard browser</h2></div><button type="button" aria-label="Close browser">${icon("close", 14)}</button></header>
    <label>${icon("search", 13)}<input type="search" value="${empty ? "no-matching-technique" : context.name.toLowerCase()}" aria-label="Search all techniques" /></label>
    ${
      empty
        ? systemState({ type: "empty" })
        : `<div class="flash-browser-results"><button type="button"><b>${context.name}</b><small>${context.type} · ${context.roleLabel}</small></button><button type="button"><b>${context.question.prompt}</b><small>Classic recall</small></button></div>`
    }
  </section></div>`;
}

export function gameScreen(options = {}, context = defaultContext) {
  const {
    active = true,
    sparse = false,
    signedIn = false,
    showIntro = false,
    firstRun = false,
    toast = null,
    landing = null,
    tray = null,
    paused = false,
    staged = false,
    showTransport = true,
    showWinBar = true,
    showLegend = true,
    showDrillTab = false,
    panel = null,
    leftPanel = null,
    rightPanel = null,
    sheet = null,
    detail = null,
    modal = null,
    coachStep = 0,
    challengeDone = null,
    challengeComplete = false,
    reward = null,
    panic = null,
    combo = 0,
    comboBroken = false,
    showVignette = false,
    result = null,
    accountOpen = false,
    checkpointState = null,
    flashBrowser = null,
    loading = false,
    system = null,
    restartState = null,
    progressState = null,
    motion = "still",
    motionProgress = 1,
    // v1.106 composition model — see components-pane.js. `pane` is the ONE left pane;
    // `leftPanel`/`rightPanel` below it are the retired two-rail keys, kept only because the
    // historical screens are pinned, and never used by new authorship.
    pane: paneState = null,
    lit = null,
    litLabel = "",
    litPath = false,
    share = null,
    picker = null,
  } = options;
  const activeLeftPanel =
    leftPanel ||
    (panel === "explorer" ||
    panel === "progress" ||
    panel === "challenges" ||
    panel === "collection"
      ? panel
      : null);
  const activeRightPanel = rightPanel || (panel === "drill" ? "drill" : null);

  return `<div class="game-stage" data-screen-state="${result || (staged ? "staged" : "rolling")}" data-motion="${motion}" style="--motion-progress:${Math.max(0, Math.min(1, motionProgress))}">
    ${graphField({ muted: !active || sparse, lit, litLabel, litPath })}
    ${brand()}
    ${accountBubble({ signedIn, open: accountOpen })}
    ${showIntro ? intro({ firstRun }) : ""}
    ${toast ? eventToast(toast) : ""}
    ${landing ? landingCard(landing, context) : ""}
    ${tray ? optionTray({ ...tray, ruleset: tray.ruleset || options.ruleset || null, context }) : ""}
    ${showLegend ? legend() : ""}
    ${showWinBar ? winLose({ value: 100 - (options.lose ?? 42) }) : ""}
    ${showTransport ? transport({ paused: paused || staged }) : ""}
    ${paused || staged ? pausedChip({ staged }) : ""}
    ${showDrillTab ? drillTab() : ""}
    ${combo ? momentum({ combo, broken: comboBroken }) : ""}
    ${options.comboPop ? comboPop({ combo: options.comboPop }) : ""}
    ${activeLeftPanel === "explorer" ? explorerPanel({ mode: options.explorerMode, query: options.query, ruleset: options.ruleset }) : activeLeftPanel === "challenges" ? challengesPanel({ state: options.challengeState, selected: options.selectedTrack }) : activeLeftPanel === "collection" ? collectionPanel({ state: options.collectionState }) : activeLeftPanel === "progress" ? progressPanel({ mode: options.progressMode, state: progressState }, context) : ""}
    ${activeRightPanel === "drill" ? drillPanel({ state: options.panelState }, context) : ""}
    ${checkpointState ? checkpoint({ result: checkpointState, ...(options.checkpoint || {}) }, context, paneState) : paneState ? pane(paneState, context) : ""}
    ${share ? shareCue(share) : ""}
    ${picker ? listPicker(picker) : ""}
    ${sheet ? optionSheet({ state: sheet === "drilling" ? "expanded" : sheet, drilling: sheet === "drilling" }, context) : ""}
    ${detail ? dossier({ variant: detail, mobile: options.mobileDetail }, context) : ""}
    ${modal ? (modal === "auth" ? authModal({ mode: options.authMode }) : settingsModal({ tab: modal })) : ""}
    ${coachStep ? coach({ step: coachStep }) : ""}
    ${challengeDone !== null ? challengeCue({ track: options.challengeTrack || "White", done: challengeDone, complete: challengeComplete }) : ""}
    ${panic !== null ? panicCard({ revealed: panic === "revealed" }) : ""}
    ${showVignette ? vignette() : ""}
    ${result ? verdict({ result: result === "defeat" ? "defeat" : "victory", detail: options.resultDetail }) : ""}
    ${flashBrowser !== null ? browser({ empty: flashBrowser === "empty" }, context) : ""}
    ${system ? `<div style="position:absolute;inset:0;z-index:18;display:grid;place-items:center">${systemState({ type: system })}</div>` : ""}
    ${restartState ? restartCard({ state: restartState }, context) : ""}
    ${progressState ? progressNudge({ type: progressState }) : ""}
    ${reward ? rewardToast({ type: reward }) : ""}
    <div class="motion-overlay" aria-hidden="true"></div>
    ${loading ? loader() : ""}
  </div>`;
}
