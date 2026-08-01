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
  beltPath,
  coach,
  dossier,
  drillPanel,
  explorerPanel,
  optionSheet,
  panicCard,
  progressNudge,
  progressPanel,
  restartCard,
  settingsModal,
  systemState,
  tutorial,
} from "./components-panels.js";
import { defaultContext } from "./fixtures.js";
import { icon } from "./icons.js";

function intro({ firstRun = false } = {}) {
  return `<section style="position:absolute;top:72px;left:36px;z-index:3;max-width:300px">
    <h1 style="margin:0;font:700 28px/1.05 var(--fc-display);letter-spacing:-.02em">${firstRun ? "Your first roll." : "Roll the graph."}</h1>
    <p style="margin:10px 0 0;color:#9aa3b8;font-size:12px;line-height:1.5">${firstRun ? "Choose a move, answer what you know, and watch the state machine react." : "A live roll plays out across the map. Choose your move, or let it flow."}</p>
  </section>`;
}

function pausedChip({ staged = false } = {}) {
  return `<div class="pill" style="position:absolute;top:76px;left:50%;z-index:5;transform:translateX(-50%)">${icon("pause", 11)} ${staged ? "STAGED · CLOCK HELD" : "PAUSED"}</div>`;
}

function checkpoint({ result = "question" } = {}, context = defaultContext) {
  const data = context.question;
  return `<div class="modal-layer"><section class="modal-card" role="dialog" aria-modal="true" aria-label="Checkpoint quiz">
    <small style="color:#789fff;font-weight:800">BLUE BELT CHECKPOINT · 4/8</small>
    <h2 style="margin-top:8px">${data.prompt}</h2>
    <div style="margin-top:13px">${data.answers
      .map(
        (answer, index) =>
          `<div class="answer" ${
            result === "correct" && index === data.correct
              ? 'data-state="correct"'
              : result === "wrong" && index === 1
                ? 'data-state="wrong"'
                : ""
          }><span class="answer-key">${String.fromCharCode(65 + index)}</span>${answer}</div>`,
      )
      .join("")}</div>
  </section></div>`;
}

function ladder({ belt = false } = {}) {
  return `<div class="modal-layer"><section class="modal-card" style="text-align:center">
    <span style="color:${belt ? "#78a4ff" : "#e9d75a"}">${icon(belt ? "crown" : "bolt", 34)}</span>
    <small style="display:block;margin-top:10px;color:#789fff;font-weight:800;letter-spacing:.12em">${belt ? "BELT TEST PASSED" : "GAME KNOWLEDGE"}</small>
    <h2 style="margin-top:8px">${belt ? "Blue belt earned" : "38% · stripe gained"}</h2>
    <p style="color:#8b97b0;font-size:11px">${belt ? "The test wins the belt. Continued recall proves the degrees." : "Half Guard Underhooks moved to crown level 3."}</p>
    <div class="detail-actions" style="justify-content:center"><span class="pill pill--primary">Continue</span></div>
  </section></div>`;
}

function accountMenu() {
  return `<div class="detail-sheet" style="right:18px;left:auto;top:62px;bottom:auto;width:220px;border:1px solid var(--fc-border);border-radius:14px;padding:12px">
    <div class="lesson-row"><b>Settings</b></div><div class="lesson-row"><b>Roll history</b></div><div class="lesson-row"><b>Create account</b></div>
  </div>`;
}

function browser({ empty = false } = {}, context = defaultContext) {
  return `<div class="modal-layer"><section class="modal-card" style="width:min(720px,96%)">
    <h2>Flashcard browser</h2>
    <div class="detail-section" style="margin-top:12px"><small>SEARCH ALL TECHNIQUES</small><p>${empty ? "no-matching-technique" : context.name.toLowerCase()}</p></div>
    ${
      empty
        ? systemState({ type: "empty" })
        : `<div class="sheet-grid"><div class="flashcard"><small>${context.name.toUpperCase()}</small><p>${context.question.prompt}</p></div><div class="flashcard"><small>${context.type.toUpperCase()} · ${context.roleLabel.toUpperCase()}</small><p>${context.question.answer}</p></div></div>`
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
    tutorialDone = null,
    panic = null,
    combo = 0,
    comboBroken = false,
    showVignette = false,
    result = null,
    accountOpen = false,
    checkpointState = null,
    ladderState = null,
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
    (panel === "explorer" || panel === "path" || panel === "progress"
      ? panel
      : null);
  const activeRightPanel = rightPanel || (panel === "drill" ? "drill" : null);

  return `<div class="game-stage" data-screen-state="${result || (staged ? "staged" : "rolling")}" data-motion="${motion}" style="--motion-progress:${Math.max(0, Math.min(1, motionProgress))}">
    ${graphField({ active, sparse })}
    ${brand()}
    ${accountBubble({ signedIn, menu: accountOpen })}
    ${showIntro ? intro({ firstRun }) : ""}
    ${toast ? eventToast(toast) : ""}
    ${landing ? landingCard(landing, context) : ""}
    ${tray ? optionTray(tray, context) : ""}
    ${showLegend ? legend() : ""}
    ${showWinBar ? winLose({ lose: options.lose ?? 42 }) : ""}
    ${showTransport ? transport({ paused: paused || staged }) : ""}
    ${paused || staged ? pausedChip({ staged }) : ""}
    ${showDrillTab ? drillTab() : ""}
    ${combo ? momentum({ combo, broken: comboBroken }) : ""}
    ${options.comboPop ? comboPop({ combo: options.comboPop }) : ""}
    ${activeLeftPanel === "explorer" ? explorerPanel({ mode: options.explorerMode, query: options.query }) : activeLeftPanel === "path" ? beltPath({ ruleset: options.ruleset, state: options.pathState }) : activeLeftPanel === "progress" ? progressPanel({ mode: options.progressMode, state: progressState }, context) : ""}
    ${activeRightPanel === "drill" ? drillPanel({ state: options.panelState }, context) : ""}
    ${sheet ? optionSheet({ state: sheet }, context) : ""}
    ${detail ? dossier({ variant: detail, mobile: options.mobileDetail }, context) : ""}
    ${modal ? (modal === "auth" ? authModal({ mode: options.authMode }) : settingsModal({ tab: modal })) : ""}
    ${coachStep ? coach({ step: coachStep }) : ""}
    ${tutorialDone !== null ? tutorial({ done: tutorialDone }) : ""}
    ${panic !== null ? panicCard({ revealed: panic === "revealed" }) : ""}
    ${showVignette ? vignette() : ""}
    ${result ? verdict({ result, detail: options.resultDetail }) : ""}
    ${accountOpen ? accountMenu() : ""}
    ${checkpointState ? checkpoint({ result: checkpointState }, context) : ""}
    ${ladderState ? ladder({ belt: ladderState === "belt" }) : ""}
    ${flashBrowser !== null ? browser({ empty: flashBrowser === "empty" }, context) : ""}
    ${system ? `<div style="position:absolute;inset:0;z-index:18;display:grid;place-items:center">${systemState({ type: system })}</div>` : ""}
    ${restartState ? restartCard({ state: restartState }, context) : ""}
    ${progressState ? progressNudge({ type: progressState }) : ""}
    <div class="motion-overlay" aria-hidden="true"></div>
    ${loading ? loader() : ""}
  </div>`;
}
