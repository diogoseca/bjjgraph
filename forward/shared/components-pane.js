/**
 * ONE PANE (v1.76.0; anchored LEFT since v1.94.0).
 *
 * The left explorer rail and the right flashcards rail were merged into ONE 360px pane on
 * the left, carrying three tabs — Explore | Challenges | Last rolls. It opens from the
 * top-left logo, which is why it lives on the logo's side.
 *
 * This module is the composition model the catalog authors against from v1.106 on. The old
 * `leftPanel` / `rightPanel` two-rail keys still render (the historical screens are pinned
 * by spec), but nothing new is authored against them: they describe a layout the product
 * retired, and a test faithfully derived from those frames would assert a second rail that
 * cannot exist.
 *
 * PANE LAW (v1.68.0) governs every frame that uses this: the pane is manual-only. Nothing
 * in the roll loop opens or closes it. Open = the game stops; close = the game resumes, but
 * only if the pane is what stopped it.
 */
import {
  corridorBelts,
  corridorLessons,
  defaultContext,
  matCoins,
  pastRolls,
  patches,
} from "./fixtures.js";
import { crownBadge, flashcard, matCoin, patchBadge } from "./components-panels.js";
import { listsSection } from "./components-share.js";
import { icon } from "./icons.js";
import { escapeHtml } from "./utils.js";

const EXPLORE_SECTIONS = [
  ["Systems", 47],
  ["Principles", 12],
  ["Positions", 136],
  ["Transitions", 1014],
  ["Submissions", 297],
  ["Learning", 24],
];

// circle = position, triangle = submission, diamond = transition — ONE vocabulary shared
// with the canvas (v1.103.6), so a row says what kind of thing it is before you read it.
function catGlyph(cat) {
  return `<span class="pane-glyph-shape pane-glyph-shape--${cat}" aria-hidden="true"></span>`;
}

/**
 * Two-line tabs (v1.95.0). Explore carries "Mastered N%" — since v1.98.1 that subtitle is
 * the Game Knowledge score's ONE exposure anywhere in the app (the woven knowledge belt
 * visual was retired). Challenges carries a miniature belt in the FRONTIER belt's colour
 * wearing 0-4 stripes from that belt's proven-unit fraction — deliberately NOT the score's
 * stripes. Two belts, two meanings. "Last rolls" is display only; the view id stays history.
 */
function paneTabs({ tab = "explore", score = 38, belt = "white", stripes = 0 }) {
  const tape = Array.from({ length: stripes }, () => "<b></b>").join("");
  const subs = {
    explore: `Mastered ${score}%`,
    challenges: `<i class="ng-tab-belt" data-tab-stripes="${stripes}" data-belt="${belt}">${tape}</i>`,
    history: "Your last rolls",
  };
  return `<nav class="learning-nav pane-tabs ng-learning-nav" aria-label="Learning views">
    ${[
      ["explore", "Explore"],
      ["challenges", "Challenges"],
      ["history", "Last rolls"],
    ]
      .map(
        ([view, label]) =>
          `<button type="button" data-view="${view}" aria-pressed="${view === tab}"><b>${label}</b><small data-tab-sub="${view}">${subs[view]}</small></button>`,
      )
      .join("")}
  </nav>`;
}

/** Explore: lists first, then the six category sections — COLLAPSED by default (v1.99.3). */
function exploreBody({ lists = {}, open = null, search = "" } = {}) {
  return `<div class="pane-body pane-body--explore" data-pane-view="explore">
    <div class="pane-search"><label>${icon("search", 13)}<input type="search" value="${escapeHtml(search)}" placeholder="Search techniques…" aria-label="Search techniques" /></label></div>
    ${listsSection(lists)}
    ${EXPLORE_SECTIONS.map(
      ([label, count]) => `<div class="pane-row pane-row--section">
        <button type="button" data-explore-section="${label}" aria-expanded="${open === label}"><span>${label}</span><small>(${count})</small><span class="chev">${open === label ? "▾" : "▸"}</span></button>
      </div>
      ${
        open === label
          ? `<div class="pane-items">${["Deep Half Guard", "Half Guard", "Closed Guard"]
              .map(
                (row) =>
                  `<div class="pane-row pane-row--item">${catGlyph("position")}<span class="pane-item-name"><b>${row}</b></span><button class="pane-glyph" type="button" data-play-from aria-label="Play from ${row}">${icon("play", 12)}</button><button class="pane-glyph" type="button" data-list-add data-list-surface="explore" aria-label="Add ${row} to a class list…">+</button></div>`,
              )
              .join("")}</div>`
          : ""
      }`,
    ).join("")}
  </div>`;
}

/** The rewards shelf (v1.99.1): earned-only, a <details> at the foot of Challenges. */
export function rewardsShelf({ open = false, earned = 2 } = {}) {
  const earnedPatches = patches.filter((patch) => patch.earned);
  const earnedCoins = matCoins.filter((coin) => coin.earned);
  if (!earned) return "";
  return `<details class="rewards-shelf" data-rewards-shelf ${open ? "open" : ""}>
    <summary>Rewards <small>${earnedPatches.length + earnedCoins.length} earned</small></summary>
    <div class="rewards-body">
      ${earnedPatches.map((patch) => patchBadge(patch, true)).join("")}
      ${earnedCoins.map((coin) => matCoin(coin, true)).join("")}
      <p>Patches mark meaningful milestones. Mat Coins are just for laughs. Neither is spendable and neither changes odds, score, timers, or content access.</p>
    </div>
  </details>`;
}

/**
 * THE BELT CORRIDOR (v1.98.0). One continuous woven belt runs down the left, white through
 * black, with a knot tied at each boundary; lesson rows hang off it. Belt headers speak
 * plain belts ("White belt"), carry their dye pronounced, and stamp themselves complete.
 * Nothing locks — every belt is open from day one — and the corridor's one target is the
 * FRONTIER belt: the topmost belt whose live lessons are not all done. Pinning is retired
 * (v1.99.2); the frontier drives the default-open section, the arrival scroll, the frontier
 * glow, the tab belt and the challenge cue.
 */
function corridorBody({
  frontier = "blue",
  open = "blue",
  maintenance = 0,
  tutorial = "folded",
  rewards = false,
  recallReward = false,
} = {}) {
  return `<div class="pane-body pane-body--corridor" data-pane-view="challenges">
    ${maintenance ? `<div class="maintenance-band" data-maintenance="${maintenance}"><b>${maintenance} due today</b><span>Maintenance first — then new material.</span><button class="primary-action" type="button">Review ${maintenance}</button></div>` : ""}
    <section class="tutorial-section" data-tutorial data-tutorial-complete="false">
      <div class="pane-head"><span>Tutorial</span><small>17 of 20</small>
        <div class="ng-tutorial-chips"><i>Open a move sheet</i><i>Finish a roll</i><i>Escape a submission</i></div>
        <span class="chev">${tutorial === "open" ? "▾" : "▸"}</span>
      </div>
    </section>
    <div class="ng-challenge-ladder ng-corridor">
      <div class="ng-corridor-rail" aria-hidden="true">${corridorBelts.map((belt) => `<i data-knot="${belt.id}" style="--track:${belt.color}"></i>`).join("")}</div>
      ${corridorBelts
        .map((belt) => {
          const complete = belt.done >= belt.total;
          const isOpen = open === belt.id;
          return `<section class="ng-belt-section" data-belt="${belt.id}" data-collapsed="${!isOpen}">
            <div class="track-card ng-track-card" data-track="${belt.id}" data-belt-complete="${complete}" aria-pressed="${belt.id === frontier}" style="--track:${belt.color}">
              <b>${belt.name}</b><span>${belt.done} of ${belt.total}</span>
              ${complete ? '<span class="ng-belt-stamp" aria-hidden="true">☑</span>' : ""}
              <button class="ng-belt-toggle" type="button" aria-expanded="${isOpen}" aria-label="${isOpen ? "Collapse" : "Expand"} ${belt.name}">${isOpen ? "▾" : "▸"}</button>
            </div>
            ${
              isOpen
                ? `<div class="ng-belt-body">
                    ${corridorLessons
                      .map(
                        (lesson, index) =>
                          `<div class="ng-challenge-lessonrow" data-cat="${lesson.cat}" data-lesson-done="${lesson.done}" ${!lesson.done && index === 2 ? 'data-frontier="1"' : ""}>
                            ${lesson.done ? '<span class="ng-lesson-check" aria-hidden="true">✓</span>' : ""}
                            ${catGlyph(lesson.cat)}
                            <button type="button" class="lesson-name">${escapeHtml(lesson.title)}</button>
                            ${crownBadge({ level: lesson.crown })}
                            <button class="pane-glyph" type="button" data-lesson-deck-toggle aria-label="Show cards for ${escapeHtml(lesson.title)}">▸</button>
                            <button class="pane-glyph" type="button" data-list-add data-list-surface="lesson" aria-label="Add ${escapeHtml(lesson.title)} to a class list…">+</button>
                          </div>`,
                      )
                      .join("")}
                    ${belt.id === "black" && recallReward ? '<div class="recall-reward" data-recall-reward><small>EARNS A BADGE</small><b>Recall mode in play</b><span>Answer from memory while you roll — unlocked at black.</span></div>' : ""}
                  </div>`
                : ""
            }
          </section>`;
        })
        .join("")}
    </div>
    ${rewardsShelf({ open: rewards, earned: rewards ? 2 : 0 })}
  </div>`;
}

/**
 * Last rolls. Roll history is in-memory and has never persisted across reloads, so the empty
 * case explains itself rather than reading as "my history got deleted".
 *
 * FRAME NOTE — the two row controls (▶ play from this roll, ↺ replay it) are landing in the
 * same release as this catalog entry: a parallel branch is building them with a design pass.
 * They are depicted at the pane's control figure (24px, WCAG 2.2 AA target size) and by
 * intent, not pixel-exact chrome.
 */
function historyBody({ rolls = pastRolls, empty = false, expanded = -1 } = {}) {
  if (empty) {
    return `<div class="pane-body pane-body--history" data-pane-view="history">
      <div class="hist-empty" data-hist-empty>No rolls yet — press play and your roll shows up here, state by state.</div>
    </div>`;
  }
  return `<div class="pane-body pane-body--history" data-pane-view="history">
    <div class="pane-label">Previous rolls</div>
    ${rolls
      .map(
        (roll, index) => `<div class="pane-row pane-row--roll" data-past-roll="${index}">
        <span class="roll-dot is-${roll.outcome}" aria-hidden="true"></span>
        <div class="pane-row-main">
          <b>${escapeHtml(roll.from)} <span>→</span> ${escapeHtml(roll.to)}</b>
          <small>${roll.states} states · ${roll.outcome} · ${roll.ago}</small>
        </div>
        <button class="pane-glyph" type="button" data-roll-play="${index}" aria-label="Play from ${escapeHtml(roll.from)}">${icon("play", 12)}</button>
        <button class="pane-glyph" type="button" data-roll-replay="${index}" aria-label="Replay this roll">${icon("replay", 12)}</button>
        <span class="chev">${expanded === index ? "▾" : "▸"}</span>
      </div>
      ${
        expanded === index
          ? `<div class="pane-items">${["Deep Half Guard", "Waiter Sweep", "Top Half Guard"]
              .map(
                (state) =>
                  `<div class="pane-row pane-row--item">${catGlyph("position")}<span class="pane-item-name"><b>${state}</b></span><button class="pane-glyph" type="button" data-lesson-deck-toggle aria-label="Show cards for ${state}">▸</button></div>`,
              )
              .join("")}</div>`
          : ""
      }`,
      )
      .join("")}
    <div class="pane-label">This roll</div>
    <div class="pane-row pane-row--item">${catGlyph("position")}<span class="pane-item-name"><b>Deep Half Guard</b></span><small>now</small></div>
  </div>`;
}

/**
 * The study takeover. A live deck/session/checkpoint hides the tab bar entirely and the
 * head's `‹ Back` returns to the tab you came from — two body modes, one pane.
 */
function studyBody({ state = "recall" } = {}, context = defaultContext) {
  return `<div class="pane-body pane-body--study" data-pane-view="study">
    <div class="pane-study-head"><button class="pane-back" type="button" data-pane-back>‹ Back</button><b>${escapeHtml(context.name)}</b></div>
    ${
      state === "complete"
        ? '<div class="drill-complete"><span>✓</span><h3>Session complete</h3><p>8 cards reviewed. Your roll odds now reflect the work.</p></div>'
        : flashcard({ state: state === "revealed" ? "revealed" : "question" }, context)
    }
  </div>`;
}

/** The pane's foot: stats band, guest save nudge, feedback row, legal row. */
function paneFoot({
  signedIn = false,
  stats = {},
  study = false,
  sync = null,
} = {}) {
  if (study) return "";
  const {
    mastered = 3,
    masteredPct = 12,
    due = 0,
    weak = 14,
    weakWord = "weak",
  } = stats;
  return `<div class="pane-foot">
    ${sync ? `<div class="pane-sync" data-sync="${sync}">${sync === "offline" ? "Offline — evidence keeps counting on this device." : sync === "merging" ? "Reconciling this device with your account…" : "Synced · nothing re-announced"}</div>` : ""}
    <div class="pane-stats ng-pane-stats" data-explore-stats>
      <span class="ngStat" data-b="mastered">Mastered <b>${mastered}</b><small>(${masteredPct}%)</small></span>
      <span class="ngStat ${due ? "is-owed" : ""}" data-b="due"><b>${due}</b> due</span>
      <span class="ngStat is-weak" data-b="suggested" data-weak="${weak}"><b>${weak}</b> ${weakWord} spots</span>
    </div>
    ${
      signedIn
        ? ""
        : `<div class="pane-anchor ng-pane-anchor">
            <div class="ng-anchor-caption" data-anchor-caption>Save your progress</div>
            <button class="primary-action ng-anchor-cta" type="button" data-anchor-auth>Create account</button>
            <div class="ng-anchor-alt" data-anchor-alt><span>Already have one?</span> <button type="button" data-anchor-login>Log in</button></div>
          </div>`
    }
    <div class="pane-feedback"><span data-feedback="technique">Request a technique</span><i></i><span data-feedback="issue">Report an issue</span><i></i><span data-gh-chip>${icon("book", 11)} GitHub</span></div>
    <div class="pane-legal">${icon("gear", 13)}<i></i><span>Terms</span><i></i><span>Privacy</span></div>
  </div>`;
}

export function pane(
  {
    tab = "explore",
    study = null,
    score = 38,
    belt = "white",
    stripes = 0,
    signedIn = false,
    stats = {},
    sync = null,
    explore = {},
    corridor = {},
    history = {},
  } = {},
  context = defaultContext,
) {
  const body = study
    ? studyBody({ state: study }, context)
    : tab === "challenges"
      ? corridorBody(corridor)
      : tab === "history"
        ? historyBody(history)
        : exploreBody(explore);
  return `<aside class="side-panel side-panel--left one-pane ng-drill ng-explorer" role="complementary" aria-label="Explore, Challenges, and Last rolls" data-pane-tab="${tab}" ${study ? 'data-pane-study="1"' : ""}>
    <button class="pane-close" type="button" aria-label="Close panel">×</button>
    ${study ? "" : paneTabs({ tab, score, belt, stripes })}
    ${body}
    ${paneFoot({ signedIn, stats, study: !!study, sync })}
  </aside>`;
}
