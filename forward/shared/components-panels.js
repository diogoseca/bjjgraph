import { history, lessons, node, question, settings } from "./fixtures.js"
import { filmStrip, odds, questionBlock } from "./components-core.js"
import { icon } from "./icons.js"

export function flashcard({ state = "question", mode = "classic" } = {}) {
  return `<article class="flashcard" data-state="${state}">
    <small>${mode === "multiple-choice" ? "Recognition · Multiple choice" : "Recall · Classic"}</small>
    <p>What must remain hidden to stop the crossface in Deep Half Guard?</p>
    ${state === "revealed" ? '<div class="flashcard-answer">Hide the near arm and keep your head connected to the trapped hip.</div>' : ""}
    ${mode === "multiple-choice" ? questionBlock({ data: question, visibleAnswers: 3 }) : ""}
  </article>`
}

export function drillPanel({ state = "home" } = {}) {
  let body = ""
  if (state === "study")
    body = `${flashcard()}<div class="progress"><span style="--progress:40%"></span></div>`
  else if (state === "revealed")
    body = `${flashcard({ state: "revealed" })}<div class="detail-actions"><span class="pill">Again</span><span class="pill">Hard</span><span class="pill pill--primary">Easy</span></div>`
  else if (state === "multiple-choice") body = flashcard({ mode: "multiple-choice" })
  else if (state === "history")
    body = history
      .map(
        (item) =>
          `<div class="history-row"><b>${item.title}</b><p>${item.result} · ${item.delta} · ${item.time}</p></div>`,
      )
      .join("")
  else if (state === "complete")
    body =
      '<div class="system-state"><b>Session complete</b><h3>8 cards trained</h3><p>Three techniques moved closer to recall-proven.</p></div>'
  else
    body = `<div class="detail-section"><small>Due now</small><p>5 cards across 3 techniques</p></div>
      <div class="detail-section"><small>Suggested</small><p>Deep Half Guard · 4 unseen cards</p></div>
      <div class="detail-section"><small>Recently explored</small><p>Waiter Sweep · Backdoor Escape</p></div>`
  return `<aside class="side-panel" aria-label="Flashcards pane">
    <div class="panel-head"><small>FLASHCARDS</small><b>${state === "history" ? "Roll history" : state === "complete" ? "Nice work" : "Deep Half Guard"}</b></div>
    <div class="panel-body">${body}</div>
    <div class="panel-foot"><div class="progress"><span style="--progress:${state === "complete" ? 100 : 48}%"></span></div></div>
  </aside>`
}

function crown(progress = 0.5) {
  const level = Math.round(progress * 4)
  return `<span class="pill" aria-label="Crown level ${level} of 4">${level === 4 ? "★" : level}</span>`
}

export function beltPath({ mode = "path", ruleset = "gi" } = {}) {
  return `<aside class="side-panel side-panel--left" aria-label="Explorer">
    <div class="panel-head"><small>${ruleset.toUpperCase()} · ${mode.toUpperCase()}</small><b>Belt Path</b></div>
    <div class="panel-body">
      <div class="detail-section"><small>GAME KNOWLEDGE</small><p>38% · Blue belt in reach</p><div class="progress"><span style="--progress:38%"></span></div></div>
      ${lessons
        .map(
          (lesson) => `<div class="lesson-row" ${lesson.locked ? 'data-locked="true"' : ""}>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
              <b>${lesson.locked ? icon("lock", 12) : lesson.live ? "●" : "○"} ${lesson.title}</b>${crown(lesson.progress)}
            </div>
            <div class="progress" style="margin-top:8px"><span style="--progress:${lesson.progress * 100}%"></span></div>
          </div>`,
        )
        .join("")}
    </div>
  </aside>`
}

export function explorerPanel({ mode = "tree", query = "" } = {}) {
  if (mode === "path") return beltPath()
  const rows = ["Positions", "Transitions", "Submissions", "Principles", "Systems", "Learning"]
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
  </aside>`
}

export function optionSheet({ state = "collapsed" } = {}) {
  const expanded = state === "expanded" || state === "confirm"
  return `<section class="option-sheet" aria-label="Technique detail">
    <div class="sheet-head"><div><small>SWEEP · ATTACKING</small><h3>Electric Chair</h3></div>${odds(35)}</div>
    ${filmStrip()}
    <div class="sheet-grid">
      <div class="detail-section"><small>WHY IT WORKS</small><p>Control the far leg and rotate under the opponent's center.</p></div>
      <div class="detail-section"><small>WATCH FOR</small><p>They may free the knee and recover a crossface.</p></div>
      ${expanded ? '<div class="detail-section"><small>KEY MECHANIC</small><p>Keep the lockdown active until their posting hand is committed.</p></div><div class="detail-section"><small>CHAIN</small><p>Waiter sweep → backdoor escape → single leg.</p></div>' : ""}
    </div>
    <div class="detail-actions"><span class="pill">${expanded ? "Less" : "More details"}</span><span class="pill pill--primary">${state === "confirm" ? "Confirm play" : "Drill first"}</span></div>
  </section>`
}

export function dossier({ variant = "collapsed", mobile = false } = {}) {
  const expanded = variant === "expanded"
  const seo = variant === "seo"
  return `<section class="detail-sheet" ${mobile ? 'data-mobile="true"' : ""} aria-label="Deep Half Guard dossier">
    <small style="color:#789fff;font-weight:800">POSITION · BOTTOM</small>
    <h2>${node.name}</h2>
    <p>${seo ? node.seo : node.definition}</p>
    <div class="detail-actions"><span class="pill pill--primary">Roll from here</span><span class="pill">Top</span><span class="pill">Bottom</span></div>
    ${filmStrip()}
    <div class="detail-section"><small>${seo ? "SEO / AI DEFINITION" : "CONTEXT"}</small><p>${seo ? node.context : node.principles[0]}</p></div>
    ${
      expanded || seo
        ? `<div class="detail-section"><small>KEY PRINCIPLES</small><p>${node.principles.join(" ")}</p></div>
           <div class="detail-section"><small>DEFENSIVE RESPONSE</small><p>${node.defense.join(" ")}</p></div>
           <div class="detail-section"><small>LIKELY OUTCOMES</small><p>${node.outcomes.join(" · ")}</p></div>`
        : ""
    }
    <div class="detail-actions"><span class="pill">${expanded || seo ? "Collapse" : "More details"}</span></div>
  </section>`
}

export function settingsModal({ tab = "Flashcards" } = {}) {
  const rows = settings[tab] || settings.Flashcards
  return `<div class="modal-layer"><section class="modal-card" role="dialog" aria-modal="true" aria-label="${tab} settings">
    <div style="display:flex;justify-content:space-between;align-items:center"><h2>Settings</h2><span>${icon("close", 16)}</span></div>
    <div class="detail-actions">${Object.keys(settings)
      .map((name) => `<span class="pill ${name === tab ? "pill--primary" : ""}">${name}</span>`)
      .join("")}</div>
    ${rows.map((row, index) => `<div class="settings-row"><span>${row}</span>${index % 2 ? '<span class="pill">Auto</span>' : '<span class="switch"></span>'}</div>`).join("")}
  </section></div>`
}

export function authModal({ mode = "sign-in" } = {}) {
  return `<div class="modal-layer"><section class="modal-card" role="dialog" aria-modal="true" aria-label="Account">
    <small style="color:#789fff;font-weight:800">BJJGRAPH ACCOUNT</small>
    <h2 style="margin-top:8px">${mode === "sign-up" ? "Save your game" : "Welcome back"}</h2>
    <p style="color:#8b97b0;font-size:11px;line-height:1.5">Sync belts, crowns, flashcards, and roll history across devices.</p>
    <div class="detail-section"><small>EMAIL</small><p>you@example.com</p></div>
    <div class="detail-section"><small>PASSWORD</small><p>••••••••••••</p></div>
    <div class="detail-actions"><span class="pill pill--primary">${mode === "sign-up" ? "Create account" : "Sign in"}</span><span class="pill">Continue as guest</span></div>
  </section></div>`
}

export function coach({ step = 1 } = {}) {
  const copy = [
    "This is your hand. Pick one technique before the decision clock runs out.",
    "The question changes the odds of the move you are about to attempt.",
    "Open the sheet when you need film, mechanics, or a quick drill.",
  ]
  return `<section class="coach" aria-label="Coach step ${step}"><small>COACH · ${step}/3</small><p>${copy[step - 1]}</p><div class="detail-actions"><span class="pill pill--primary">Next</span><span class="pill">Skip</span></div></section>`
}

export function tutorial({ done = 4, total = 20 } = {}) {
  return `<section class="tutorial-strip"><small>TUTORIAL · ${done}/${total}</small><p>Answer the question at your next landing.</p></section>`
}

export function panicCard({ revealed = false } = {}) {
  return `<section class="panic-card" role="alert"><small>DEFEND NOW</small><p>${revealed ? "Frame at the hip, clear the crossface, and recover your inside knee." : "You are being flattened. Recall the first defensive action before time runs out."}</p><div class="detail-actions"><span class="pill pill--primary">${revealed ? "Got it" : "Reveal defense"}</span></div></section>`
}

export function systemState({ type = "empty" } = {}) {
  const states = {
    empty: ["No cards due", "Your review queue is clear. Explore the graph to discover more."],
    error: [
      "Graph unavailable",
      "The Neural layer could not load. The crawlable BJJGraph page remains available.",
    ],
    offline: ["Working offline", "Saved lessons and recent rolls remain available on this device."],
  }
  const [title, copy] = states[type] || states.empty
  return `<div class="system-state"><span style="color:${type === "error" ? "#ff6b78" : "#789fff"}">${icon(type === "error" ? "warning" : "book", 22)}</span><h3>${title}</h3><p>${copy}</p></div>`
}
