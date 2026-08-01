import { defaultContext, history, lessons, settings } from "./fixtures.js";
import { filmStrip, odds, questionBlock } from "./components-core.js";
import { icon } from "./icons.js";

export function flashcard(
  { state = "question", mode = "classic" } = {},
  context = defaultContext,
) {
  return `<article class="flashcard" data-state="${state}">
    <small>${mode === "multiple-choice" ? "Recognition · Multiple choice" : "Recall · Classic"}</small>
    <p>${context.question.prompt}</p>
    ${state === "revealed" ? `<div class="flashcard-answer">${context.question.answer}</div>` : ""}
    ${mode === "multiple-choice" ? questionBlock({ data: context.question, visibleAnswers: 3 }) : ""}
  </article>`;
}

export function drillPanel({ state = "home" } = {}, context = defaultContext) {
  let body = "";
  if (state === "study")
    body = `${flashcard({}, context)}<div class="progress"><span style="--progress:40%"></span></div>`;
  else if (state === "revealed")
    body = `${flashcard({ state: "revealed" }, context)}<div class="detail-actions"><span class="pill">Again</span><span class="pill">Hard</span><span class="pill pill--primary">Easy</span></div>`;
  else if (state === "multiple-choice")
    body = flashcard({ mode: "multiple-choice" }, context);
  else if (state === "history")
    body = history
      .map(
        (item) =>
          `<div class="history-row"><b>${item.title}</b><p>${item.result} · ${item.delta} · ${item.time}</p></div>`,
      )
      .join("");
  else if (state === "complete")
    body =
      '<div class="system-state"><b>Session complete</b><h3>8 cards trained</h3><p>Three techniques moved closer to recall-proven.</p></div>';
  else
    body = `<div class="detail-section"><small>Due now</small><p>5 cards across 3 techniques</p></div>
      <div class="detail-section"><small>Suggested</small><p>${context.name} · 4 unseen cards</p></div>
      <div class="detail-section"><small>Recently explored</small><p>${context.outcomes.slice(0, 2).join(" · ")}</p></div>`;
  return `<aside class="side-panel" aria-label="Flashcards pane">
    <div class="panel-head"><small>FLASHCARDS</small><b>${state === "history" ? "Roll history" : state === "complete" ? "Nice work" : context.name}</b></div>
    <div class="panel-body">${body}</div>
    <div class="panel-foot"><div class="progress"><span style="--progress:${state === "complete" ? 100 : 48}%"></span></div></div>
  </aside>`;
}

export function crownBadge({ level = 2, locked = false } = {}) {
  const safeLevel = Math.max(0, Math.min(4, level));
  return `<span class="crown-badge" data-level="${safeLevel}" ${locked ? 'data-locked="true"' : ""} aria-label="Crown level ${safeLevel} of 4"><i style="--crown:${safeLevel * 25}%"></i><b>${safeLevel === 4 ? "★" : safeLevel}</b></span>`;
}

export function proofStripes({ filled = 2, belt = "blue" } = {}) {
  return `<div class="proof-stripes" data-belt="${belt}" aria-label="${filled} of 4 ${belt} belt proof stripes">
    ${[0, 1, 2, 3].map((index) => `<i ${index < filled ? 'data-filled="true"' : ""}></i>`).join("")}
  </div>`;
}

export function beltMeter({ score = 52, belt = "blue" } = {}) {
  const thresholds = [
    ["white", 20],
    ["blue", 40],
    ["purple", 60],
    ["brown", 70],
    ["black", 80],
  ];
  return `<div class="belt-meter" aria-label="Game knowledge ${score}%">
    <div class="belt-track" data-belt="${belt}"><span class="belt-fill" style="--score:${score}%"></span><i class="belt-you" style="--score:${score}%"></i>
      ${thresholds.map(([name, threshold]) => `<em style="--threshold:${threshold}%;" data-met="${score >= threshold}"></em>`).join("")}
    </div>
    <div class="belt-scale">${thresholds.map(([name]) => `<span>${name}</span>`).join("")}</div>
  </div>`;
}

export function masteryOverview(
  { mode = "category" } = {},
  context = defaultContext,
) {
  const rows =
    mode === "technique"
      ? [
          [context.name, 67, "Recognition"],
          [context.outcomes[0] || "Primary outcome", 42, "Learning"],
          [context.outcomes[1] || "Next connection", 18, "New"],
        ]
      : [
          ["Positions", 72, "Blue"],
          ["Transitions", 54, "Blue"],
          ["Submissions", 31, "White"],
          ["Principles", 63, "Purple"],
        ];
  return `<section class="mastery-overview" aria-label="${mode} mastery">
    ${rows
      .map(
        ([name, progress, status]) => `<div class="mastery-row">
          <div><b>${name}</b><small>${status} · ${progress}%</small></div>
          <div class="progress"><span style="--progress:${progress}%"></span></div>
        </div>`,
      )
      .join("")}
  </section>`;
}

export function progressPanel(
  { mode = "overview", state = "default" } = {},
  context = defaultContext,
) {
  const demoted = state === "demoted";
  return `<aside class="side-panel side-panel--left" aria-label="Progress">
    <div class="panel-head"><small>PROGRESS · ${mode.toUpperCase()}</small><b>${mode === "technique" ? context.name : "Your game"}</b></div>
    <div class="panel-body">
      <div class="detail-section"><small>GAME KNOWLEDGE</small><p>${demoted ? "43% · Blue belt · 1 stripe" : "52% · Blue belt · 2 stripes"}</p>${beltMeter({ score: demoted ? 43 : 52 })}${proofStripes({ filled: demoted ? 1 : 2 })}</div>
      ${masteryOverview({ mode: mode === "technique" ? "technique" : "category" }, context)}
    </div>
  </aside>`;
}

export function restartCard(
  { state = "confirm" } = {},
  context = defaultContext,
) {
  const restarting = state === "restarting";
  return `<div class="modal-layer"><section class="modal-card restart-card" role="dialog" aria-modal="true" aria-label="Restart roll">
    <small style="color:#789fff;font-weight:800">${restarting ? "NEW ROLL" : "RESTART"}</small>
    <h2 style="margin-top:8px">${restarting ? "Clearing the exchange…" : "Restart this roll?"}</h2>
    <p>${restarting ? "Decision, defense, sweep, and momentum state are disarmed. Belt progress is preserved." : `${context.name} · ${context.roleLabel} is the current state. Training progress will not be reset.`}</p>
    <div class="detail-actions">${restarting ? '<span class="pill pill--primary">Starting fresh</span>' : '<span class="pill">Keep rolling</span><span class="pill pill--primary">Restart roll</span>'}</div>
  </section></div>`;
}

export function progressNudge({ type = "saved" } = {}) {
  const belt = type === "demoted";
  return `<section class="progress-nudge" role="status">
    <small>${belt ? "KNOWLEDGE UPDATED" : "PROGRESS SAVED"}</small>
    <b>${belt ? "Blue belt · 1 stripe" : "Keep building your game"}</b>
    <p>${belt ? "A missed recall lowered proof. Nothing decays with time." : "Open Flashcards when you choose; the roll stays live."}</p>
  </section>`;
}

export function beltPath({
  mode = "path",
  ruleset = "gi",
  state = "progress",
} = {}) {
  const profiles = {
    new: { score: 8, belt: "none", stripes: 0, label: "No belt standard met" },
    progress: {
      score: 52,
      belt: "blue",
      stripes: 2,
      label: "Blue belt · Purple in reach",
    },
    mastered: {
      score: 88,
      belt: "black",
      stripes: 4,
      label: "Black belt · recall-proven",
    },
  };
  const profile = profiles[state] || profiles.progress;
  return `<aside class="side-panel side-panel--left" aria-label="Explorer">
    <div class="panel-head"><small>${ruleset.toUpperCase()} · ${mode.toUpperCase()}</small><b>Belt Path</b></div>
    <div class="panel-body">
      <div class="detail-section"><small>GAME KNOWLEDGE</small><p>${profile.score}% · ${profile.label}</p>${beltMeter({ score: profile.score, belt: profile.belt })}${proofStripes({ filled: profile.stripes, belt: profile.belt })}</div>
      <div class="lesson-row"><small>WHITE BELT · UNIT 3</small><b>Half Guard Foundations</b><div class="progress" style="margin-top:8px"><span style="--progress:${state === "new" ? 0 : state === "mastered" ? 100 : 72}%"></span></div></div>
      ${lessons
        .map((lesson, index) => {
          const progress =
            state === "new" ? 0 : state === "mastered" ? 1 : lesson.progress;
          const locked =
            state === "new"
              ? index > 0
              : state === "mastered"
                ? false
                : lesson.locked;
          const live = state === "new" ? index === 0 : lesson.live;
          return `<div class="lesson-row" ${locked ? 'data-locked="true"' : ""}>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
              <b>${locked ? icon("lock", 12) : live ? "●" : "○"} ${lesson.title}</b>${crownBadge({ level: Math.round(progress * 4), locked })}
            </div>
            <div class="progress" style="margin-top:8px"><span style="--progress:${progress * 100}%"></span></div>
          </div>`;
        })
        .join("")}
      <div class="lesson-row" ${state === "mastered" ? "" : 'data-locked="true"'}><b>${state === "mastered" ? "✓" : icon("lock", 12)} Unit checkpoint</b><small>${state === "mastered" ? "Passed · belt proof updated" : "Finish 2 lessons to unlock"}</small></div>
    </div>
  </aside>`;
}

export function explorerPanel({ mode = "tree", query = "" } = {}) {
  if (mode === "path") return beltPath();
  const rows = [
    "Positions",
    "Transitions",
    "Submissions",
    "Principles",
    "Systems",
    "Learning",
  ];
  return `<aside class="side-panel side-panel--left" aria-label="Explorer tree">
    <div class="panel-head"><small>EXPLORE · TREE</small><b>${query ? `Results for “${query}”` : "Browse the graph"}</b></div>
    <div class="panel-body">
      ${rows
        .map(
          (row, index) =>
            `<div class="lesson-row"><div style="display:flex;justify-content:space-between"><b>${row}</b><span>${index * 217 + 48}</span></div></div>`,
        )
        .join("")}
    </div>
  </aside>`;
}

export function optionSheet(
  { state = "collapsed" } = {},
  context = defaultContext,
) {
  const expanded = state === "expanded" || state === "confirm";
  const technique = context.techniques[0];
  return `<section class="option-sheet" aria-label="Technique detail">
    <div class="sheet-head"><div><small>${technique.eyebrow.toUpperCase()} · ${context.roleLabel.toUpperCase()}</small><h3>${technique.name}</h3></div>${odds(technique.odds)}</div>
    ${filmStrip({}, context)}
    <div class="sheet-grid">
      <div class="detail-section"><small>WHY IT WORKS</small><p>${context.principles[0]}</p></div>
      <div class="detail-section"><small>WATCH FOR</small><p>${context.defense[0]}</p></div>
      ${expanded ? `<div class="detail-section"><small>KEY MECHANIC</small><p>${context.principles.slice(1).join(" ") || context.context}</p></div><div class="detail-section"><small>CHAIN</small><p>${context.outcomes.slice(0, 3).join(" → ")}</p></div>` : ""}
    </div>
    <div class="detail-actions"><span class="pill">${expanded ? "Less" : "More details"}</span><span class="pill pill--primary">${state === "confirm" ? "Confirm play" : "Drill first"}</span></div>
  </section>`;
}

export function dossier(
  { variant = "collapsed", mobile = false } = {},
  context = defaultContext,
) {
  const expanded = variant === "expanded";
  const seo = variant === "seo";
  return `<section class="detail-sheet" ${mobile ? 'data-mobile="true"' : ""} aria-label="${context.name} dossier">
    <small style="color:#789fff;font-weight:800">${context.type.toUpperCase()} · ${context.roleLabel.toUpperCase()}</small>
    <h2>${context.name}</h2>
    <p>${seo ? context.seo : context.definition}</p>
    <div class="detail-actions"><span class="pill pill--primary">Roll from here</span>${context.availableRoles.map((role) => `<span class="pill ${role === context.role ? "pill--primary" : ""}">${role.charAt(0).toUpperCase() + role.slice(1)}</span>`).join("")}</div>
    ${filmStrip({}, context)}
    <div class="detail-section"><small>${seo ? "SEO / AI DEFINITION" : "CONTEXT"}</small><p>${seo ? context.context : context.principles[0]}</p></div>
    ${
      expanded || seo
        ? `<div class="detail-section"><small>KEY PRINCIPLES</small><p>${context.principles.join(" ")}</p></div>
           <div class="detail-section"><small>DEFENSIVE RESPONSE</small><p>${context.defense.join(" ")}</p></div>
           <div class="detail-section"><small>LIKELY OUTCOMES</small><p>${context.outcomes.join(" · ")}</p></div>`
        : ""
    }
    <div class="detail-actions"><span class="pill">${expanded || seo ? "Collapse" : "More details"}</span></div>
  </section>`;
}

export function settingsModal({ tab = "Flashcards" } = {}) {
  const rows = settings[tab] || settings.Flashcards;
  return `<div class="modal-layer"><section class="modal-card" role="dialog" aria-modal="true" aria-label="${tab} settings">
    <div style="display:flex;justify-content:space-between;align-items:center"><h2>Settings</h2><span>${icon("close", 16)}</span></div>
    <div class="detail-actions">${Object.keys(settings)
      .map(
        (name) =>
          `<span class="pill ${name === tab ? "pill--primary" : ""}">${name}</span>`,
      )
      .join("")}</div>
    ${rows.map((row, index) => `<div class="settings-row"><span>${row}</span>${index % 2 ? '<span class="pill">Auto</span>' : '<span class="switch"></span>'}</div>`).join("")}
  </section></div>`;
}

export function authModal({ mode = "sign-in" } = {}) {
  return `<div class="modal-layer"><section class="modal-card" role="dialog" aria-modal="true" aria-label="Account">
    <small style="color:#789fff;font-weight:800">BJJGRAPH ACCOUNT</small>
    <h2 style="margin-top:8px">${mode === "sign-up" ? "Save your game" : "Welcome back"}</h2>
    <p style="color:#8b97b0;font-size:11px;line-height:1.5">Sync belts, crowns, flashcards, and roll history across devices.</p>
    <div class="detail-section"><small>EMAIL</small><p>you@example.com</p></div>
    <div class="detail-section"><small>PASSWORD</small><p>••••••••••••</p></div>
    <div class="detail-actions"><span class="pill pill--primary">${mode === "sign-up" ? "Create account" : "Sign in"}</span><span class="pill">Continue as guest</span></div>
  </section></div>`;
}

export function coach({ step = 1 } = {}) {
  const copy = [
    "This is your hand. Pick one technique before the decision clock runs out.",
    "The question changes the odds of the move you are about to attempt.",
    "Open the sheet when you need film, mechanics, or a quick drill.",
  ];
  return `<section class="coach" aria-label="Coach step ${step}"><small>COACH · ${step}/3</small><p>${copy[step - 1]}</p><div class="detail-actions"><span class="pill pill--primary">Next</span><span class="pill">Skip</span></div></section>`;
}

export function tutorial({ done = 4, total = 20 } = {}) {
  return `<section class="tutorial-strip"><small>TUTORIAL · ${done}/${total}</small><p>Answer the question at your next landing.</p></section>`;
}

export function panicCard({ revealed = false } = {}) {
  return `<section class="panic-card" role="alert"><small>DEFEND NOW</small><p>${revealed ? "Frame at the hip, clear the crossface, and recover your inside knee." : "You are being flattened. Recall the first defensive action before time runs out."}</p><div class="detail-actions"><span class="pill pill--primary">${revealed ? "Got it" : "Reveal defense"}</span></div></section>`;
}

export function systemState({ type = "empty" } = {}) {
  const states = {
    empty: [
      "No cards due",
      "Your review queue is clear. Explore the graph to discover more.",
    ],
    error: [
      "Graph unavailable",
      "The Neural layer could not load. The crawlable BJJGraph page remains available.",
    ],
    offline: [
      "Working offline",
      "Saved lessons and recent rolls remain available on this device.",
    ],
  };
  const [title, copy] = states[type] || states.empty;
  return `<div class="system-state"><span style="color:${type === "error" ? "#ff6b78" : "#789fff"}">${icon(type === "error" ? "warning" : "book", 22)}</span><h3>${title}</h3><p>${copy}</p></div>`;
}
