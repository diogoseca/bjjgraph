import { defaultContext, history, lessons, tutorialSteps } from "./fixtures.js";
import { filmStrip, questionBlock } from "./components-core.js";
import { icon } from "./icons.js";
import { escapeHtml } from "./utils.js";

function progress(value) {
  return `<div class="progress"><span style="--progress:${value}%"></span></div>`;
}

export function flashcard(
  { state = "question", mode = "classic" } = {},
  context = defaultContext,
) {
  const revealed = state === "revealed";
  const multipleChoice = mode === "multiple-choice";
  return `<article class="flashcard ng-flashcard" data-drill-card data-production-selector="[data-drill-card]">
    <div class="flashcard-meta"><span>${escapeHtml(context.name)}</span><small>Card 2 of 8</small></div>
    ${progress(25)}
    <p class="flashcard-question">${escapeHtml(context.question.prompt)}</p>
    ${
      multipleChoice
        ? questionBlock({
            state: state === "correct" ? "correct" : "unanswered",
            question: context.question,
            compact: true,
          })
        : revealed
          ? `<div class="flashcard-answer"><small>Answer</small><p>${escapeHtml(context.question.answer || context.question.answers[context.question.correct])}</p></div>`
          : '<button class="primary-action" type="button" data-reveal>Reveal answer</button>'
    }
    ${
      revealed
        ? '<div class="flashcard-actions"><button type="button">Review again</button><button class="primary-action" type="button">Got it</button></div>'
        : ""
    }
    <footer><span>&larr;&rarr; card</span><span>space flip</span></footer>
  </article>`;
}

function drillHome() {
  return `<div class="drill-home" data-drill-home>
    <button class="drill-auth ngHdrAuth" type="button"><b>Create account or log in</b><span>Save your rolls &amp; progress</span></button>
    <section class="drill-progress"><div><small>Your game</small><strong>38%</strong></div>${progress(38)}<p><span><b>8</b> mastered</span><span><b>2</b> today</span><span class="is-weak"><b>30+</b> weak spots</span></p></section>
    <section class="drill-section roll-history"><header><b>Roll history</b><button type="button">View all</button></header>${history
      .slice(0, 2)
      .map(
        (entry) =>
          `<button class="history-row" type="button"><span><b>${escapeHtml(entry.title)}</b><small>${entry.time}</small></span><strong class="${entry.result === "Won" ? "is-good" : "is-bad"}">${entry.result} ${entry.delta}</strong></button>`,
      )
      .join("")}</section>
    <section class="drill-section"><header><b>Study</b><span>Today</span></header>
      <button class="study-session primary-action" type="button"><span><b>Continue today</b><small>22 cards left to win gold</small></span><span>${icon("play", 14)}</span></button>
      <button class="study-session" type="button"><span><b>Weak spots in your game</b><small>Suggested from recent rolls</small></span><span>${icon("chevron-right", 14)}</span></button>
    </section>
  </div>`;
}

export function drillPanel({ state = "home" } = {}, context = defaultContext) {
  const body =
    state === "home"
      ? drillHome()
      : state === "history"
        ? `<div class="drill-history"><h3>Roll history</h3>${history
            .map(
              (entry) =>
                `<div class="history-row"><span><b>${escapeHtml(entry.title)}</b><small>${entry.time}</small></span><strong>${entry.result} ${entry.delta}</strong></div>`,
            )
            .join("")}</div>`
        : state === "complete"
          ? '<div class="drill-complete"><span>✓</span><h3>Session complete</h3><p>8 cards reviewed. Your roll odds now reflect the work.</p><button class="primary-action" type="button">Back to study</button></div>'
          : flashcard(
              {
                state: state === "revealed" ? "revealed" : "question",
                mode:
                  state === "multiple-choice" ? "multiple-choice" : "classic",
              },
              context,
            );
  return `<aside class="side-panel right side-panel--right ng-drill" aria-label="Flashcards pane" data-production-selector=".ng-drill" data-drill-state="${state}">
    <header class="drill-pane-head"><button class="ngClose" type="button" aria-label="Collapse Flashcards">${icon("panel", 16)}</button><button class="ngGear" type="button" aria-label="Settings">${icon("gear", 15)}</button></header>
    <div class="ng-panel-scroll">${body}</div>
  </aside>`;
}

export function crownBadge({ level = 2, locked = false } = {}) {
  const progressValue = Math.max(0, Math.min(4, level)) * 25;
  return `<span class="crown-badge" data-crown="${locked ? "locked" : level}" style="--crown-progress:${progressValue}%"><i>${locked ? icon("lock", 11) : level === 4 ? "★" : level}</i></span>`;
}

export function proofStripes({ filled = 2, belt = "blue" } = {}) {
  return `<div class="proof-stripes" data-stripes data-belt="${belt}" aria-label="${filled} of 4 proof stripes">${[
    0, 1, 2, 3,
  ]
    .map(
      (index) =>
        `<i class="${index < filled ? "is-filled" : ""}" data-filled="${index < filled}"></i>`,
    )
    .join("")}</div>`;
}

export function beltMeter({ score = 52, belt = "blue" } = {}) {
  const thresholds = [
    ["white", 20],
    ["blue", 40],
    ["purple", 60],
    ["brown", 70],
    ["black", 80],
  ];
  return `<div class="belt-meter" data-score-row data-production-selector="[data-belt-track]">
    <div class="belt-track" data-belt-track="${belt === "black" ? "black" : "normal"}">
      <i class="belt-fill" data-belt-fill="${belt}" style="height:${score}%"></i>
      ${thresholds
        .map(
          ([id, threshold]) =>
            `<span class="belt-mark" data-belt-mark="${id}" data-met="${score >= threshold}" style="bottom:${threshold}%"></span>`,
        )
        .join("")}
      <span class="you-are-here" data-you-are-here style="bottom:${score}%"></span>
    </div>
    <div class="belt-labels"><div class="belt-score"><strong>${score.toFixed(1)}%</strong><span>Game knowledge</span></div>${thresholds
      .slice()
      .reverse()
      .map(
        ([id, threshold]) =>
          `<span data-belt-label="${id}" data-met="${score >= threshold}" style="bottom:${threshold}%">${id} · ${threshold}%</span>`,
      )
      .join("")}</div>
  </div>`;
}

export function masteryOverview(
  { mode = "category" } = {},
  context = defaultContext,
) {
  if (mode === "technique") {
    return `<section class="path-proof-update" data-lesson="selected"><small>SELECTED LESSON</small><div class="path-lesson">${crownBadge({ level: 3 })}<span><b>${escapeHtml(context.name)}</b><small>${escapeHtml(context.roleLabel)} · 67% recall mastery</small></span><span>${icon("chevron-right", 13)}</span></div></section>`;
  }
  return `<section class="path-proof-update" data-score-row><small>GAME KNOWLEDGE</small><div class="path-proof-score"><strong>38%</strong><span>White belt ${proofStripes({ filled: 2, belt: "white" })}</span></div>${progress(38)}<p>One weighted score. Lesson crowns and proof stripes use the same mastery.</p></section>`;
}

function lessonRow(lesson, index, { locked = false, mastered = false } = {}) {
  const pct = mastered ? 100 : Math.round(lesson.progress * 100);
  return `<button class="path-lesson" type="button" data-lesson="${index}" data-locked="${locked}" data-done="${pct === 100}" data-live="${lesson.live || false}">
    ${crownBadge({ level: locked ? 0 : Math.round(pct / 25), locked })}
    <span><b>${escapeHtml(lesson.title)}</b><small>${locked ? "Complete the previous lesson" : `${pct}% mastery`}</small></span>
    <span>${locked ? icon("lock", 12) : icon("chevron-right", 13)}</span>
  </button>`;
}

export function beltPath({
  ruleset = "gi",
  state = "progress",
  focus = "overview",
} = {}) {
  const mastered = state === "mastered";
  const demoted = state === "demoted";
  const score = state === "new" ? 8 : mastered ? 82 : demoted ? 34 : 38;
  return `<div class="belt-path ng-belt-path" data-production-selector="[data-score-row]" data-path-focus="${focus}">
    ${beltMeter({ score, belt: score >= 80 ? "black" : score >= 60 ? "purple" : score >= 40 ? "blue" : "white" })}
    <div class="path-content">
      <button class="tutorial-path-row path-row" type="button" data-tut-row><i></i><b>Tutorial</b><small>4/20 steps</small></button>
      <p class="tutorial-next">Read your hand — the cards below are every move you have here</p>
      <section class="path-belt" data-belt="white" data-live="true">
        <header class="path-row"><span class="belt-dot is-white"></span><h3>White Belt</h3>${proofStripes({ filled: mastered ? 4 : state === "new" ? 0 : demoted ? 1 : 2, belt: "white" })}<small>${mastered ? "6/6" : "0/6"} units</small></header>
        <div class="path-unit" data-unit="1"><div class="unit-heading"><b>Mount: Escapes</b><small>${ruleset.toUpperCase()}</small></div>
          ${lessons
            .map((lesson, index) =>
              lessonRow(lesson, index, {
                locked: state === "new" && index > 0,
                mastered,
              }),
            )
            .join("")}
          <button class="checkpoint-row" type="button" data-checkpoint data-locked="${state === "new"}"><span>◇</span><b>Checkpoint</b><strong>${state === "new" ? icon("lock", 11) : "READY"}</strong></button>
        </div>
        <button class="belt-test-row" type="button" data-belt-test data-locked="${!mastered}"><span>${icon("crown", 14)}</span><b>White belt test</b><small>${mastered ? "READY" : "Prove every unit first"}</small></button>
      </section>
      <section class="path-belt is-locked" data-belt="blue" data-locked="true"><header class="path-row"><span class="belt-dot is-blue"></span><h3>Blue Belt</h3>${proofStripes({ filled: 0, belt: "blue" })}<small>locked</small></header></section>
    </div>
  </div>`;
}

export function explorerPanel({
  mode = "tree",
  query = "",
  pathState = "progress",
  ruleset = "gi",
  focus = "overview",
} = {}) {
  const path = mode === "path" || mode === "progress";
  const treeGroups = [
    ["Systems", ["Leg Lock System", "Back Attack System", "Pressure Passing"]],
    ["Principles", ["Frames & posture", "Base & connection", "Hip movement"]],
    ["Positions", ["Closed Guard", "Half Guard", "Mount", "Back Control"]],
    ["Transitions", ["Knee Slice Pass", "Waiter Sweep", "Technical Stand-up"]],
    ["Submissions", ["Armbar", "Triangle Choke", "Rear Naked Choke"]],
  ];
  return `<aside class="side-panel left side-panel--left ng-explorer" aria-label="${path ? "Belt Path pane" : "Explorer pane"}" data-production-selector=".ng-explorer" data-explorer-mode="${path ? "path" : "tree"}">
    <div class="explorer-controls">
      <div class="segmented" role="group" aria-label="Explorer mode"><button type="button" aria-pressed="${path}">PATH</button><button type="button" aria-pressed="${!path}">TREE</button></div>
      <div class="segmented ruleset" role="group" aria-label="Ruleset"><button type="button" aria-pressed="${ruleset === "gi"}">GI</button><button type="button" aria-pressed="${ruleset !== "gi"}">NO-GI</button></div>
    </div>
    <div class="explorer-search-row"><label class="explorer-search">${icon("search", 13)}<input data-explorer-search type="search" value="${escapeHtml(query)}" placeholder="Search techniques..." aria-label="Search graph" /></label><button type="button" aria-label="Close Explorer">${icon("close", 14)}</button></div>
    <div class="ng-panel-scroll">${
      path
        ? beltPath({ ruleset, state: pathState, focus })
        : `<div class="explorer-tree">${treeGroups
            .map(
              ([title, rows]) =>
                `<section><header><span>${title}</span><small>${rows.length}</small></header>${rows
                  .filter(
                    (row) =>
                      !query || row.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map(
                    (row, index) =>
                      `<button type="button"><span class="tree-shape tree-shape--${title.toLowerCase()}"></span><span><b>${row}</b><small>${index + 3}</small></span>${icon("chevron-right", 12)}</button>`,
                  )
                  .join("")}</section>`,
            )
            .join("")}</div>`
    }</div>
  </aside>`;
}

export function progressPanel(
  { mode = "overview" } = {},
  context = defaultContext,
) {
  return explorerPanel({
    mode: "path",
    pathState: "progress",
    focus: mode === "technique" ? "technique" : "overview",
    query: mode === "technique" ? context.name : "",
  });
}

export function optionSheet(
  { state = "collapsed", expanded = false, drilling = false } = {},
  context = defaultContext,
) {
  const open = expanded || state !== "collapsed";
  const confirm = state === "confirm";
  return `<section class="option-sheet ng-optdetail" data-production-selector=".ng-optdetail" data-sheet-state="${state}">
    <div class="sheet-grabber"></div>
    <header><div><small>${escapeHtml(context.type)} · ${escapeHtml(context.origin)}</small><h2>${escapeHtml(context.name)}</h2></div><button type="button" aria-label="Close technique detail">${icon("close", 14)}</button></header>
    <div class="sheet-role-tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-detail-role="attacker">Attacker</button><button type="button" role="tab" aria-selected="false" data-detail-role="defender">Defend</button></div>
    <div class="sheet-stats"><div><span>Edge</span><b>+18</b></div><div><span>Success</span><b>${context.successRate || 46}%</b></div><button class="primary-action" type="button" data-play-here>${icon("play", 13)} Play from here</button></div>
    ${open ? `<div class="sheet-body"><p>${escapeHtml(context.definition)}</p>${filmStrip({ compact: true, clips: context.clips })}<section class="jit-drill"><small>${drilling ? "JIT DRILL ACTIVE" : "BUY BETTER ODDS"}</small><b>${escapeHtml(context.question.prompt)}</b><button type="button">${drilling ? "Reveal answer" : "Drill before committing"}</button></section><div class="sheet-principles">${context.principles.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div></div>` : ""}
    <footer><button type="button">${confirm ? "Commit this move" : open ? "Commit" : "Open move sheet"}</button></footer>
  </section>`;
}

export function dossier(
  { variant = "collapsed", mobile = false } = {},
  context = defaultContext,
) {
  const expanded = variant === "expanded";
  const seo = variant === "seo";
  if (seo) {
    return `<article class="seo-dossier" data-output-only="true" data-production-selector="article"><small>OUTPUT ONLY · SEO / AI PROJECTION</small><h1>${escapeHtml(context.name)}: ${escapeHtml(context.roleLabel)} guide</h1><p>${escapeHtml(context.seo)}</p><h2>What matters first?</h2><p>${escapeHtml(context.context)}</p><h2>Key principles</h2><ul>${context.principles.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></article>`;
  }
  const shape = context.type.toLowerCase();
  const clips = (context.clips || []).slice(0, expanded ? 3 : 2);
  const attacks = (context.techniques || []).slice(0, 4);
  return `<article class="dossier ng-dossier dossier--${shape} ${mobile ? "ng-mobile-dossier is-mobile" : "is-node-mode"}" data-production-handle="${mobile ? "dossierSheetRef" : "dossierRef"}" data-dossier-shape="${shape}" data-dossier-state="${expanded ? "expanded" : "collapsed"}">
    ${mobile ? `<nav class="dossier-mobile-nav"><button type="button">‹ All techniques</button><button type="button" aria-label="Close dossier">${icon("close", 14)}</button></nav>` : ""}
    <div class="dossier-content">
      <div class="dossier-eyebrow"><span class="tree-shape tree-shape--${shape}s"></span><small>${escapeHtml(context.type)}${context.origin ? ` · ${escapeHtml(context.origin)}` : ""}</small></div>
      <header><h2>${escapeHtml(context.name)}</h2><span data-dossier-role>${escapeHtml(context.roleLabel)}</span>${mobile ? "" : '<button type="button" aria-label="Close dossier">' + icon("close", 14) + "</button>"}</header>
      <div class="dossier-tabs" role="tablist"><button type="button" role="tab" aria-selected="true">Overview</button>${clips.length ? '<button type="button" role="tab">Film</button>' : ""}<button type="button" role="tab">Principles</button>${attacks.length ? '<button type="button" role="tab">Attacks</button>' : ""}</div>
      <p>${escapeHtml(context.definition)}</p>
      ${clips.length ? `<div class="dossier-film" data-ds="film">${clips.map((clip, index) => `<button type="button" aria-label="Play ${escapeHtml(clip.title)}"><span class="dossier-thumb dossier-thumb--${index + 1}">${icon("play", 13)}</span><small>${escapeHtml(clip.title)}</small></button>`).join("")}</div>` : ""}
      ${
        expanded
          ? `<section data-ds="pr"><small>ESSENTIAL PRINCIPLES</small><ul>${context.principles.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>${attacks.length ? `<section data-ds="at"><small>ATTACKS FROM HERE</small><div class="dossier-attacks">${attacks.map((item) => `<button type="button">${escapeHtml(item.name)} · ${item.odds}%</button>`).join("")}</div></section>` : ""}<section data-ds="df"><small>DEFENCE</small><ul>${context.defense
              .slice(0, 3)
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}</ul></section>`
          : ""
      }
      <button class="dossier-roll" type="button"><span>${icon("play", 12)}</span><span><b>Roll from here</b><small>make this the current state</small></span><i>→</i></button>
    </div>
  </article>`;
}

function settingChoices(label, detail, choices, selected = 0, note = "") {
  return `<div class="setting-choice" data-setting-row><b>${escapeHtml(label)}</b><small>${escapeHtml(detail)}</small><div class="setting-pills">${choices.map((choice, index) => `<button type="button" aria-pressed="${index === selected}">${escapeHtml(choice)}</button>`).join("")}</div>${note ? `<p>${note}</p>` : ""}</div>`;
}

function settingToggle(label, detail) {
  return `<div class="setting-row" data-setting-row><span><b>${escapeHtml(label)}</b><small>${escapeHtml(detail)}</small></span><button class="setting-check" type="button" aria-pressed="true">✓</button></div>`;
}

export function settingsModal({ tab = "Flashcards" } = {}) {
  const normalized = tab.toLowerCase();
  const tabContent = {
    flashcards: `<div class="setting-row daily-goal" data-setting-row><span><b>Daily goal</b><small>Techniques to review or learn each day</small></span><input type="number" value="30" aria-label="Daily goal" /></div>
      ${settingChoices("Answer mode", "How cards read back HERE. Questions asked in-roll are always multiple choice — this sidebar is the study surface.", ["Classic recall", "Auto", "Multiple choice"])}
      ${settingChoices("Study order", "Which cards to surface first", ["Weakest spots", "Newest", "Due first"])}
      ${settingChoices("Focus", "Shore up weaknesses, or sharpen strengths", ["Antifragile", "Converge"], 0, "<b>Antifragile</b> — a solid, well-rounded game. Surfaces cards from the spots you’re weakest.")}
      ${settingToggle("Show flashcards on pages", "Display a quiz pill on each technique")}`,
    rolling: `<div class="settings-section"><b>Rolling simulation</b><p>When you pick a move, a dice-roll plays out against an AI opponent — success depends on the move’s win % and your mastery.</p><div class="setting-pills"><button type="button">Off</button><button type="button" aria-pressed="true">Normal</button><button type="button" disabled>Hard</button><button type="button" disabled>Ultra</button></div></div>
      <div class="setting-choice decision-setting" data-setting-row><b>Decision time</b><small>How long you get to read options before the roll moves on.</small><div><input type="range" min="5" max="15" value="9" aria-label="Decision time" /><strong>9s</strong></div><p class="setting-ticks"><span>Brisk</span><span>Default</span><span>Relaxed</span></p></div>
      ${settingToggle("Questions while you roll", "Each state asks one multiple-choice question. Correct answers refund clock and build momentum.")}
      <div class="tutorial-setting" data-setting-row><span><b>Tutorial</b><small>4 of 20 steps done — each one is completed by doing it.</small></span><button type="button">Restart</button></div>
      ${settingChoices("Sound", "Synthesized feedback on every gameplay beat", ["On", "Off"])}
      ${settingChoices("Option ordering", "How move options are ranked, left to right", ["Potential", "Popularity"])}`,
    modifiers:
      '<label class="modifier-search">Search modifiers<input type="search" placeholder="Athleticism, grip, fatigue..." /></label><div class="modifier-card"><span><b>Athleticism</b><small>Physical advantage</small></span><strong>50%</strong></div><div class="modifier-card"><span><b>Experience</b><small>Decision quality</small></span><strong>50%</strong></div>',
    shortcuts:
      '<div class="shortcut-grid"><span><kbd>A</kbd><kbd>B</kbd><kbd>C</kbd><kbd>D</kbd><b>Answer landing question</b></span><span><kbd>1</kbd>–<kbd>9</kbd><b>Open option card</b></span><span><kbd>Space</kbd><b>Pause or resume</b></span><span><kbd>/</kbd><b>Open Explorer</b></span></div>',
  };
  return `<div class="modal-layer ng-modal-layer"><section class="modal-card settings-modal ng-settings" role="dialog" aria-modal="true" aria-label="Settings" data-settings data-production-handle="renderSettings">
    <header><h2>Settings</h2><button type="button" aria-label="Close settings">${icon("close", 15)}</button></header>
    <div class="development-notice"><span>⚠</span><p>BJJ Graph is still being actively built — the success rates and probabilities you see are being continuously fine-tuned and will keep improving.</p></div>
    <div class="settings-tabs" role="tablist">${["Flashcards", "Rolling", "Modifiers", "Shortcuts"].map((label) => `<button type="button" role="tab" data-settings-tab="${label.toLowerCase()}" aria-selected="${label.toLowerCase() === normalized}">${label}</button>`).join("")}</div>
    <div class="settings-body">${tabContent[normalized] || tabContent.flashcards}</div>
  </section></div>`;
}

export function authModal({ mode = "sign-in" } = {}) {
  const create = mode === "sign-up" || mode === "create";
  return `<div class="modal-layer ng-modal-layer"><section class="modal-card auth-modal" role="dialog" aria-modal="true" aria-label="${create ? "Create account" : "Sign in"}" data-auth data-auth-mode="${create ? "create" : "login"}" data-production-selector="[data-auth]">
    <button class="modal-close" type="button" aria-label="Close account">${icon("close", 15)}</button><small>OPTIONAL ACCOUNT</small><h2>${create ? "Keep your game." : "Welcome back."}</h2><p>${create ? "Sync progress between devices. You can keep rolling as a guest." : "Restore your saved BJJGraph progress."}</p>
    <label>Email<input type="email" value="grappler@example.com" /></label><label>Password<input type="password" value="password" /></label><button class="primary-action" type="button">${create ? "Create free account" : "Sign in"}</button><button class="auth-switch" type="button">${create ? "Already have an account? Sign in" : "New here? Create an account"}</button>
  </section></div>`;
}

export function coach({ step = 1 } = {}) {
  const copy = [
    ["Read your hand", "The cards below are every move you have here."],
    [
      "Peek before you commit",
      "Open a move sheet to see film, odds, and a just-in-time drill.",
    ],
    [
      "Answer on arrival",
      "Each new state can ask one question before your next move.",
    ],
  ][Math.max(0, Math.min(2, step - 1))];
  return `<section class="coach-card ng-coach" data-coach="${step}" data-production-selector=".ng-coach"><small>YOUR FIRST ROLL · ${step}/3</small><h2>${copy[0]}</h2><p>${copy[1]}</p><button class="primary-action" type="button">${step === 3 ? "Start rolling" : "Next"}</button></section>`;
}

export function tutorial({ done = 4, total = 20 } = {}) {
  const complete = done >= total;
  return `<div class="tutorial-strip ng-tut" data-tut data-production-selector=".ng-tut"><span>${complete ? "✓" : `${done + 1}`}</span><div><small>TUTORIAL · ${Math.min(done, total)}/${total}</small><b>${complete ? "Tutorial complete" : tutorialSteps[done % tutorialSteps.length]}</b></div>${progress((Math.min(done, total) / total) * 100)}</div>`;
}

export function panicCard({ revealed = false } = {}) {
  return `<article class="panic-card" data-panic data-production-selector="[data-panic]"><small>PANIC DRILL · DEFEND IT</small><p>What must you protect before turning into the choke?</p>${revealed ? '<div><b>Answer</b><span>Win two-on-one hand control and put the choking shoulder toward the mat.</span></div><button type="button">Got it &rarr; +escape%</button>' : '<button type="button" data-panic-reveal>Reveal</button>'}</article>`;
}

export function restartCard(
  { state = "triggered" } = {},
  context = defaultContext,
) {
  const restarting = state === "restarting" || state === "complete";
  return `<div class="restart-card ng-evcenter" data-restart-state="${state}" data-production-selector=".ng-evcenter" role="status"><small>RESTART</small><h2>Restarting the roll</h2><p>${restarting ? "Clearing the live exchange and dealing a new hand." : `${escapeHtml(context.name)} · ${escapeHtml(context.roleLabel)}`}</p></div>`;
}

export function progressNudge({ type = "saved" } = {}) {
  const demoted = type === "demoted";
  const score = demoted ? 34 : 38;
  return `<section class="path-proof-update" data-score-row data-production-selector="[data-score-row]"><small>${demoted ? "TESTED FORGETTING" : "PATH UPDATE"}</small><div class="path-proof-score"><strong>${score}%</strong><span>White belt ${proofStripes({ filled: demoted ? 1 : 2, belt: "white" })}</span></div>${progress(score)}<p>${demoted ? "Review again lowered the tested score; elapsed time did not." : "Half Guard Underhooks moved to crown 3."}</p></section>`;
}

export function systemState({ type = "empty" } = {}) {
  const content = {
    empty: ["No cards yet", "Explore the graph to build a study queue."],
    offline: [
      "You are offline",
      "Saved progress and local study remain available.",
    ],
    error: [
      "Neural could not load",
      "The crawlable BJJGraph article remains available below.",
    ],
  }[type] || ["Unavailable", "Try again."];
  return `<div class="system-state" data-system-state="${type}" data-production-selector="[data-system-state]">${icon(type === "error" ? "warning" : "book", 25)}<h3>${content[0]}</h3><p>${content[1]}</p><button type="button">${type === "empty" ? "Explore techniques" : "Try again"}</button></div>`;
}
