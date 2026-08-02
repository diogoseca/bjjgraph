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

function checkpoint({ result = "question" } = {}, context = defaultContext) {
  const data = context.question;
  return `<div class="modal-layer ng-modal-layer"><section class="modal-card ng-checkpoint" role="dialog" aria-modal="true" aria-label="Checkpoint quiz" data-production-selector="[data-checkpoint]">
    <small>BLUE CONTENT CHECKPOINT · 4/8</small>
    <h2>${data.prompt}</h2>
    <div class="answer-grid">${data.answers
      .map(
        (answer, index) =>
          `<button type="button" class="answer" ${
            result === "correct" && index === data.correct
              ? 'data-state="correct"'
              : result === "wrong" && index === 1
                ? 'data-state="wrong"'
                : ""
          }><span class="answer-key">${String.fromCharCode(65 + index)}</span>${answer}</button>`,
      )
      .join("")}</div>
  </section></div>`;
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
    ${graphField({ muted: !active || sparse })}
    ${brand()}
    ${accountBubble({ signedIn, open: accountOpen })}
    ${showIntro ? intro({ firstRun }) : ""}
    ${toast ? eventToast(toast) : ""}
    ${landing ? landingCard(landing, context) : ""}
    ${tray ? optionTray({ ...tray, context }) : ""}
    ${showLegend ? legend() : ""}
    ${showWinBar ? winLose({ value: 100 - (options.lose ?? 42) }) : ""}
    ${showTransport ? transport({ paused: paused || staged }) : ""}
    ${paused || staged ? pausedChip({ staged }) : ""}
    ${showDrillTab ? drillTab() : ""}
    ${combo ? momentum({ combo, broken: comboBroken }) : ""}
    ${options.comboPop ? comboPop({ combo: options.comboPop }) : ""}
    ${activeLeftPanel === "explorer" ? explorerPanel({ mode: options.explorerMode, query: options.query, ruleset: options.ruleset }) : activeLeftPanel === "challenges" ? challengesPanel({ state: options.challengeState, selected: options.selectedTrack }) : activeLeftPanel === "collection" ? collectionPanel({ state: options.collectionState }) : activeLeftPanel === "progress" ? progressPanel({ mode: options.progressMode, state: progressState }, context) : ""}
    ${activeRightPanel === "drill" ? drillPanel({ state: options.panelState }, context) : ""}
    ${sheet ? optionSheet({ state: sheet }, context) : ""}
    ${detail ? dossier({ variant: detail, mobile: options.mobileDetail }, context) : ""}
    ${modal ? (modal === "auth" ? authModal({ mode: options.authMode }) : settingsModal({ tab: modal })) : ""}
    ${coachStep ? coach({ step: coachStep }) : ""}
    ${challengeDone !== null ? challengeCue({ track: options.challengeTrack || "White", done: challengeDone, complete: challengeComplete }) : ""}
    ${panic !== null ? panicCard({ revealed: panic === "revealed" }) : ""}
    ${showVignette ? vignette() : ""}
    ${result ? verdict({ result: result === "defeat" ? "defeat" : "victory", detail: options.resultDetail }) : ""}
    ${checkpointState ? checkpoint({ result: checkpointState }, context) : ""}
    ${flashBrowser !== null ? browser({ empty: flashBrowser === "empty" }, context) : ""}
    ${system ? `<div style="position:absolute;inset:0;z-index:18;display:grid;place-items:center">${systemState({ type: system })}</div>` : ""}
    ${restartState ? restartCard({ state: restartState }, context) : ""}
    ${progressState ? progressNudge({ type: progressState }) : ""}
    ${reward ? rewardToast({ type: reward }) : ""}
    <div class="motion-overlay" aria-hidden="true"></div>
    ${loading ? loader() : ""}
  </div>`;
}
