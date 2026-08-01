import { clips, question as defaultQuestion, techniques } from "./fixtures.js"
import { icon } from "./icons.js"

export function graphField({ active = true, sparse = false } = {}) {
  const dots = sparse
    ? [
        ["position", 34, 38],
        ["transition", 56, 54],
        ["submission", 73, 36],
      ]
    : [
        ["position", 15, 58],
        ["transition", 22, 42],
        ["position", 31, 65],
        ["transition", 42, 36],
        ["position", 50, 55],
        ["transition", 60, 42],
        ["submission", 69, 65],
        ["position", 78, 49],
        ["transition", 87, 63],
        ["position", 40, 76],
        ["transition", 59, 79],
      ]
  return `<div class="graph-field" aria-hidden="true">
    ${dots
      .map(
        ([type, x, y]) =>
          `<i class="graph-node graph-node--${type}" style="left:${x}%;top:${y}%"></i>`,
      )
      .join("")}
    ${
      active
        ? '<i class="graph-node graph-node--active" style="left:calc(50% - 22px);top:calc(51% - 22px)">YOU</i>'
        : ""
    }
  </div>`
}

export function brand({ compact = false } = {}) {
  return `<div class="brand-lockup" aria-label="BJJGraph home">
    <span>${compact ? "bjjgraph" : "bjjgraph.org"}</span>
    <small>${icon("search", 10)} Explore /</small>
  </div>`
}

export function accountBubble({ signedIn = false, menu = false } = {}) {
  return `<div class="account-bubble" ${menu ? 'data-menu-open="true"' : ""}>
    <span>${signedIn ? "Diogo" : "Guest"}</span>
    <span class="account-avatar">${signedIn ? "D" : "G"}</span>
  </div>`
}

export function transport({ paused = false } = {}) {
  return `<div class="transport" aria-label="Roll controls">
    <button class="round-button" aria-label="${paused ? "Resume roll" : "Pause roll"}">${icon(paused ? "play" : "pause", 14)}</button>
    <button class="round-button round-button--ghost" aria-label="Restart roll">${icon("reset", 15)}</button>
  </div>`
}

export function winLose({ lose = 42 } = {}) {
  return `<div class="win-lose" style="--lose:${lose}%">
    <div class="win-lose-track"><span></span><span></span><i class="win-lose-pin"></i></div>
    <div class="win-lose-labels"><span>Lose</span><span>Win</span></div>
  </div>`
}

export function eventToast({
  kicker = "NOT QUITE",
  text = "−4% on this exchange",
  tone = "danger",
} = {}) {
  return `<div class="event-toast" data-tone="${tone}" role="status">
    <small>${kicker}</small><b>${text}</b>
  </div>`
}

export function legend() {
  return `<div class="legend" aria-label="Graph legend">
    <span><i></i>Position</span><span><i></i>Transition</span><span><i></i>Submission</span>
  </div>`
}

export function odds(value = 35) {
  return `<div class="odds" style="--odds:${value}%">
    <div class="odds-label"><span>Success rate</span><strong>${value}%</strong></div>
    <div class="odds-track"><span></span></div>
  </div>`
}

export function optionCard(item = techniques[0], state = "default") {
  return `<article class="option-card" data-state="${state}">
    <small>${item.eyebrow}</small>
    <b>${item.name}</b>
    <p>${item.path}</p>
    ${odds(item.odds)}
  </article>`
}

export function optionTray({ count = 4, selected = -1, expired = -1, hidden = false } = {}) {
  if (hidden) return ""
  return `<div class="option-tray" aria-label="Available techniques">
    ${techniques
      .slice(0, count)
      .map((item, index) =>
        optionCard(
          item,
          index === selected ? "selected" : index === expired ? "expired" : "default",
        ),
      )
      .join("")}
  </div>`
}

export function filmStrip({ count = 2 } = {}) {
  return `<div class="film-strip" aria-label="Film study clips">
    ${clips
      .slice(0, count)
      .map((clip) => `<div class="film-card">${clip.title}<br />${clip.by}</div>`)
      .join("")}
  </div>`
}

export function questionBlock({
  data = defaultQuestion,
  state = "default",
  visibleAnswers = 3,
} = {}) {
  return `<div class="question-block" data-question-state="${state}">
    <p class="question-copy">${data.prompt}</p>
    <div class="answer-list">
      ${data.answers
        .slice(0, visibleAnswers)
        .map((answer, index) => {
          let answerState = ""
          if (state === "correct" && index === data.correct) answerState = "correct"
          if (state === "wrong" && index === 1) answerState = "wrong"
          return `<div class="answer" ${answerState ? `data-state="${answerState}"` : ""}>
            <span class="answer-key">${String.fromCharCode(65 + index)}</span><span>${answer}</span>
          </div>`
        })
        .join("")}
    </div>
  </div>`
}

export function landingCard({
  question = defaultQuestion,
  questionState = "default",
  showQuestion = true,
  showFilm = true,
  density = "default",
  priority = "default",
  status = "met",
} = {}) {
  const mark = status === "proven" ? "● recall-proven" : status === "new" ? "○ new" : "◐ met"
  return `<section class="landing-card" data-density="${density}" data-priority="${priority}" aria-label="Current position">
    <div class="landing-identity"><b>Deep Half Guard</b><span>· from Half Guard</span><span>· Bottom</span><span class="mastery-dot">${mark}</span></div>
    <p class="landing-definition">Move underneath the hips, isolate one leg, and expose the opponent's base.</p>
    ${showFilm ? filmStrip() : ""}
    ${showQuestion ? questionBlock({ data: question, state: questionState }) : ""}
    <span class="landing-more">More ▸</span>
  </section>`
}

export function drillTab({ count = 5, compact = false } = {}) {
  return `<div class="drill-tab" aria-label="Open flashcards">
    <span style="color:#9ab0e0">${icon("bolt", 16)}</span>
    <div><b>${count} cards to master</b><small>Drill to boost your odds →</small></div>
    ${compact ? `<b>${count}</b>` : ""}
  </div>`
}

export function momentum({ combo = 3, broken = false } = {}) {
  const colors = ["#9ad0ff", "#7ee0a8", "#e9d75a", "#ffb45a", "#ff5f6d"]
  return `<div class="momentum" style="--combo:${colors[Math.min(combo - 2, 4)]}" ${broken ? 'data-broken="true"' : ""}>
    <b>×${combo}</b><span>${broken ? "momentum gone" : "momentum"}</span>
  </div>`
}

export function comboPop({ combo = 3 } = {}) {
  const names = {
    2: "DOUBLE COMBO!",
    3: "TRIPLE COMBO!",
    4: "MEGA COMBO!",
    5: "ULTRA COMBO!",
    6: "RAMPAGE!",
    7: "GODLIKE",
  }
  return `<div class="combo-pop" style="--combo:${combo >= 5 ? "#ffb45a" : "#7ee0a8"}" role="status">
    <small>×${combo} momentum</small><b>${names[Math.min(combo, 7)]}</b>
  </div>`
}

export function verdict({ result = "victory", detail = "Three exchanges won" } = {}) {
  const won = result === "victory"
  return `<div class="verdict" role="status">
    <small>${won ? "ROLL COMPLETE" : "SUBMITTED"}</small>
    <b>${won ? "Victory" : "Defeat"}</b>
    <p>${detail}</p>
  </div>`
}

export function vignette() {
  return '<div class="vignette" aria-hidden="true"></div>'
}

export function loader() {
  return '<div class="loader"><div class="spinner" role="status"><span class="sr-only">Loading graph</span></div></div>'
}
