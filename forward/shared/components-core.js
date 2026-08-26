import { defaultContext, giTechniques } from "./fixtures.js";
import { icon } from "./icons.js";
import { escapeHtml } from "./utils.js";

function copy(context = defaultContext) {
  return {
    name: escapeHtml(context.name),
    role: escapeHtml(context.roleLabel),
    origin: escapeHtml(context.origin),
    definition: escapeHtml(context.definition),
  };
}

function categoryGlyph(category, number = 1) {
  const shape =
    category === "Submission"
      ? '<path d="M10 2.6 17.6 16.6H2.4Z"></path>'
      : category === "Position"
        ? '<circle cx="10" cy="10" r="7.7"></circle>'
        : '<path d="M10 1.9 18.1 10 10 18.1 1.9 10Z"></path>';
  return `<span class="ng-category-glyph" aria-hidden="true"><svg viewBox="0 0 20 20">${shape}<text x="10" y="11">${number}</text></svg></span>`;
}

const GRAPH_NODES = Array.from({ length: 144 }, (_, index) => {
  const angle = index * 2.399963;
  const radius = 7 + ((index * 37) % 100) * 0.38;
  const type =
    index % 13 === 0
      ? "submission"
      : index % 3 === 0
        ? "position"
        : "transition";
  return {
    type,
    x: 50 + Math.cos(angle) * radius * 1.15,
    y: 48 + Math.sin(angle) * radius * 0.75,
  };
});

const GRAPH_LINKS = GRAPH_NODES.slice(1)
  .flatMap((node, index) => {
    const child = index + 1;
    const parent = Math.max(0, Math.floor((child - 1) / 2));
    const links = [[GRAPH_NODES[parent], node]];
    if (child > 10 && child % 4 === 0)
      links.push([GRAPH_NODES[(child * 5) % child], node]);
    return links;
  })
  .map(
    ([from, to]) =>
      `M${from.x.toFixed(1)} ${from.y.toFixed(1)}L${to.x.toFixed(1)} ${to.y.toFixed(1)}`,
  )
  .join("");

// A lit set is a stable, spread-out walk of the synthetic constellation: the same
// indices every render, so a share link, a System and a list all light the SAME shape
// and two frames of one journey can be compared. Deliberately not random.
const LIT_SEQUENCE = [7, 23, 41, 58, 76, 94, 112, 130, 19, 52, 88, 121];

function litIndices(lit) {
  if (Array.isArray(lit)) return lit.filter((index) => GRAPH_NODES[index]);
  const count = Math.max(0, Math.min(LIT_SEQUENCE.length, Number(lit) || 0));
  return LIT_SEQUENCE.slice(0, count);
}

/**
 * The graph canvas.
 *
 * `lit` is the shared LIT-NODE-SET primitive (v1.106 catalog): a set of nodes held
 * alight while the camera frames them — a shared class arriving from `/l/<code>`, a
 * saved list re-lit from Explore, a System's members. `litPath` joins them in order
 * for the cases where the set is a sequence rather than a bag. `litLabel` names the
 * set on the canvas the way production labels the focused node.
 */
export function graphField({
  focus = "position",
  muted = false,
  lit = null,
  litLabel = "",
  litPath = false,
  label = "DEEP HALF",
} = {}) {
  const focusIndex =
    GRAPH_NODES.findIndex((node) => node.type === focus) >= 0
      ? GRAPH_NODES.findIndex((node) => node.type === focus)
      : 0;
  const litSet = litIndices(lit);
  const litLookup = new Set(litSet);
  const litTrail =
    litPath && litSet.length > 1
      ? `<path class="graph-link-lit" d="${litSet
          .map(
            (index, order) =>
              `${order ? "L" : "M"}${GRAPH_NODES[index].x.toFixed(1)} ${GRAPH_NODES[index].y.toFixed(1)}`,
          )
          .join("")}"></path>`
      : "";
  // A lit set owns the canvas: the ordinary focus label would compete with it.
  const showFocusLabel = !litSet.length;
  return `<div class="graph-field ng-graph ${muted ? "is-muted" : ""} ${litSet.length ? "has-lit" : ""}" data-production-selector="canvas" ${litSet.length ? `data-lit="${litSet.length}"` : ""} aria-hidden="true">
    <div class="graph-wash"></div>
    <svg class="graph-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="${GRAPH_LINKS}"></path>
      <path class="graph-link-hot" d="M${GRAPH_NODES[focusIndex].x.toFixed(1)} ${GRAPH_NODES[focusIndex].y.toFixed(1)}L${GRAPH_NODES[(focusIndex + 17) % GRAPH_NODES.length].x.toFixed(1)} ${GRAPH_NODES[(focusIndex + 17) % GRAPH_NODES.length].y.toFixed(1)}"></path>
      ${litTrail}
    </svg>
    ${GRAPH_NODES.map(({ type, x, y }, index) => {
      const isFocus = index === focusIndex;
      const isLit = litLookup.has(index);
      const caption =
        isFocus && showFocusLabel
          ? `<span>${escapeHtml(label)}</span>`
          : isLit && litLabel && index === litSet[0]
            ? `<span class="lit-label">${escapeHtml(litLabel)}</span>`
            : "";
      return `<i class="graph-node graph-node--${type} ${isFocus && showFocusLabel ? "is-focus" : ""} ${isLit ? "is-lit" : ""}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%">${caption}</i>`;
    }).join("")}
    <div class="graph-depth"></div>
  </div>`;
}

export function brand({ compact = false } = {}) {
  return `<button class="brand-lockup ng-logo ${compact ? "is-compact" : ""}" type="button" data-production-selector=".ng-logo" title="Open Explorer">
    <span class="ng-brand-stack"><span class="ng-word">bjjgraph<span>.org</span></span><span class="ng-kbd">${icon("search", 10)} Explore <span>/</span></span></span>
  </button>`;
}

export function accountBubble({ signedIn = false, open = false } = {}) {
  // v1.94.0: the chip opens a compact account menu (auth rows │ settings · shortcuts · legal —
  // one separator, no filler). The pane opener is the top-left logo, not this chip.
  const authRows = signedIn
    ? `<div class="menu-row menu-row--static" data-menu-email>diogo@bjjgraph.org</div>
      <button class="menu-row" type="button" data-menu-logout>Log out</button>`
    : `<button class="menu-row" type="button" data-menu-create>Create account</button>
      <button class="menu-row" type="button" data-menu-login>Log in</button>`;
  const menu = open
    ? `<div class="account-menu ng-account-menu" role="menu" aria-label="Account" data-production-selector=".ng-account-menu">
      ${authRows}
      <div class="menu-sep" data-menu-sep></div>
      <button class="menu-row" type="button" data-menu-settings>Settings</button>
      <button class="menu-row" type="button" data-menu-shortcuts>Keyboard shortcuts</button>
      <div class="menu-legal"><button class="menu-row" type="button" data-menu-terms>Terms</button><i></i><button class="menu-row" type="button" data-menu-privacy>Privacy</button></div>
    </div>`
    : "";
  return `<div class="account-bubble ng-acctwrap ${open ? "is-open" : ""}" data-production-selector=".ng-acctwrap">
    ${menu}
    <button class="ng-account-chip ngAcctChip" type="button" aria-haspopup="menu" aria-expanded="${open}">
      <span>${signedIn ? "Diogo" : "Guest"}</span>
      <span class="account-avatar">${signedIn ? "DS" : "G"}</span>
    </button>
  </div>`;
}

export function transport({ paused = false } = {}) {
  return `<div class="transport ng-transport" data-ng-transport data-production-selector="[data-ng-transport]">
    <button class="transport-main" type="button" aria-label="${paused ? "Resume roll" : "Pause roll"}">${icon(paused ? "play" : "pause", 17)}</button>
    <button type="button" aria-label="Restart roll">${icon("reset", 15)}</button>
  </div>`;
}

export function winLose({ value = 58 } = {}) {
  return `<div class="win-lose ng-winbar" data-production-selector=".ng-winbar">
    <span>LOSE</span>
    <div class="win-track"><i style="left:${value}%"></i><b style="width:${value}%"></b></div>
    <span>WIN</span>
  </div>`;
}

export function eventToast({
  kicker = "YOUR TURN",
  text = "Choose a move",
  tone = "info",
} = {}) {
  return `<div class="event-toast ng-event ng-evtoast tone-${tone}" data-production-selector=".ng-evtoast" role="status" aria-live="polite">
    <b>${escapeHtml(kicker)}</b>
    <span>${escapeHtml(text)}</span>
  </div>`;
}

export function legend({ value = 58 } = {}) {
  return `<div class="graph-legend ng-legend" data-production-selector=".ng-legend">
    <div class="legend-labels"><span>YOU</span><span>OPPONENT</span></div>
    <div class="legend-track"><i style="left:${value}%"></i><b style="left:${value}%"></b></div>
    <div class="legend-key"><span><i class="circle"></i>Position</span><span><i class="diamond"></i>Transition</span><span><i class="triangle"></i>Submission</span></div>
  </div>`;
}

export function odds({ value = 46, label = "Success rate" } = {}) {
  const tone = value >= 60 ? "good" : value >= 38 ? "mid" : "bad";
  return `<div class="odds-block" data-production-selector=".ngodds">
    <span>${escapeHtml(label)}</span>
    <b class="ngodds odds-${tone}">${value}%</b>
  </div>`;
}

export function optionCard(
  technique,
  { selected = false, expired = false, compact = false, index = 1 } = {},
) {
  const category =
    technique.eyebrow === "Submission"
      ? "Submission"
      : technique.eyebrow === "Position"
        ? "Position"
        : "Transition";
  const potential = Math.round((technique.odds - 40) / 2);
  return `<button class="option-card ng-option-card ${selected ? "is-selected" : ""} ${expired ? "is-expired" : ""} ${compact ? "is-compact" : ""}" type="button" data-tech="${escapeHtml(technique.name)}" data-production-selector="[data-tech]">
    <span class="option-card-head">${categoryGlyph(category, index)}<span>${category}</span><b>${potential >= 0 ? "+" : ""}${potential}</b></span>
    <strong>${escapeHtml(technique.name)}</strong>
    <small>${escapeHtml(technique.path.split("→")[0]?.trim() || "")}</small>
    <span class="option-outcome">&rarr; ${escapeHtml(technique.path.split("→").at(-1)?.trim() || "next state")}</span>
    ${odds({ value: technique.odds })}
    <i class="ngbar" style="--decision-progress:${expired ? 0 : selected ? 0.42 : 0.78}"></i>
  </button>`;
}

export function optionTray({
  count = 4,
  selected = -1,
  expired = false,
  mode = "normal",
  ruleset = null,
  context = defaultContext,
} = {}) {
  const authored = context.techniques?.length
    ? context.techniques
    : defaultContext.techniques;
  // GI/NO-GI is the first real divergence in CONTENT, not just in votes (v1.53.0): the gi
  // frame carries collar and lapel material the no-gi frame simply does not have, and both
  // frames carry their own attempt and success priors. Only frames that ask for a ruleset
  // see this, so no existing screen moves.
  const source =
    ruleset === "gi"
      ? [...giTechniques, ...authored]
      : ruleset === "nogi"
        ? authored.filter((technique) => !technique.gi)
        : authored;
  const cards = Array.from(
    { length: Math.min(count, Math.max(1, source.length)) },
    (_, index) => source[index % source.length],
  );
  return `<div class="option-tray ng-optionrow ${mode === "defense" ? "is-defense" : ""}" data-production-selector=".ng-optionrow">
    ${cards
      .map((technique, index) =>
        optionCard(technique, {
          selected: selected === index,
          expired,
          index: index + 1,
        }),
      )
      .join("")}
  </div>`;
}

export function questionBlock({
  state = "unanswered",
  compact = false,
  question,
} = {}) {
  const fixture = question || defaultContext.question;
  return `<div class="question-block ${compact ? "is-compact" : ""}" data-production-selector="[data-land-q]">
    <div class="question-kicker">Choose one</div>
    <p>${escapeHtml(fixture.prompt)}</p>
    <div class="answer-grid" role="radiogroup" aria-label="Answer options">
      ${fixture.answers
        .map((answer, index) => {
          const result =
            state === "correct" && index === fixture.correct
              ? "correct"
              : state === "wrong" && index === 0
                ? "trap"
                : "";
          return `<button type="button" role="radio" aria-checked="${result === "correct"}" data-land-mc-opt="${index}" ${result ? `data-mc-result="${result}"` : ""}><b>${String.fromCharCode(65 + index)}</b><span>${escapeHtml(answer)}</span></button>`;
        })
        .join("")}
    </div>
  </div>`;
}

export function filmStrip({
  compact = false,
  clips,
  title = "Film study",
} = {}) {
  const source = clips?.length ? clips : defaultContext.clips;
  return `<section class="film-strip ng-film" data-production-selector=".ng-clip">
    <div class="film-heading"><span>${escapeHtml(title)}</span><small>${source.length} clips</small></div>
    <div class="film-row">
      ${source
        .slice(0, compact ? 1 : 3)
        .map(
          (
            clip,
            index,
          ) => `<button class="film-card ng-clip" type="button" aria-label="Play ${escapeHtml(clip.title)}">
            <span class="film-thumb film-thumb--${index + 1}">${icon("play", 16)}</span>
            <span><b>${escapeHtml(clip.title)}</b><small>${escapeHtml(clip.by)}</small></span>
          </button>`,
        )
        .join("")}
    </div>
  </section>`;
}

export function landingCard(
  {
    status = "new",
    question = defaultContext.question,
    questionState = "unanswered",
    showQuestion = true,
    showFilm = true,
    compact = false,
    density = "default",
    priority = "default",
    layout = "full",
    mode = "land",
    proven = 3,
    cards = 8,
    capture = "none",
  } = {},
  context = defaultContext,
) {
  const isCompact = compact || density === "compact";
  const text = copy(context);
  const statusMark =
    status === "proven"
      ? ["●", "recall-proven"]
      : status === "met"
        ? ["◐", "met"]
        : ["○", "new"];
  const identity = `<div class="landing-identity" data-land-id>
    <span class="status-mark is-${status}">${statusMark[0]}</span>
    <div><strong>${text.name}</strong><small><b>${text.role}</b> · from ${text.origin} · ${statusMark[1]}</small></div>
  </div>`;
  if (layout === "identity")
    return `<div class="landing-identity-demo">${identity}</div>`;

  // THE FAMILIARITY CHIP (v1.76.0, moved to the card's foot in v1.101.1). One control, not
  // two facts: the ○/◐/● seen glyph FUSED with the deck's recall-proven count — "● 3/8" — so
  // "have I met this state" and "how much of it can I recall" are read in one glance. It is
  // glyph-only when no deck is authored, and pressing it opens this state's flashcards.
  const chip = `<button class="landing-count" type="button" data-land-count aria-label="${cards ? `${proven} of ${cards} cards recall-proven — open this state's flashcards` : "No flashcards authored for this state yet"}"><span class="status-mark is-${status}">${statusMark[0]}</span>${cards ? `<b>${proven}/${cards}</b>` : ""}</button>`;
  // capture rides the corner beside the chip on the surfaces you opened in order to READ
  // (v1.101.1 removed it from the option cards); pressing it opens the list picker (v1.102.0).
  const captureBtn =
    capture === "none"
      ? ""
      : `<button class="landing-capture" type="button" data-list-add data-list-surface="${capture}" aria-haspopup="menu" aria-expanded="false" aria-label="Add to a list">${icon("star", 14)}</button>`;
  return `<article class="landing-card ng-landcard ${isCompact ? "is-compact" : ""}" data-landcard="${mode}" data-density="${isCompact ? "compact" : "default"}" data-priority="${priority}" data-production-selector=".ng-landcard">
    ${identity}
    ${isCompact ? "" : `<p class="landing-definition" data-land-def>${text.definition}</p>`}
    ${showFilm ? `<div data-land-film>${filmStrip({ compact: true, clips: context.clips })}</div>` : ""}
    ${showQuestion ? `<div class="landing-question" data-land-q>${questionBlock({ state: questionState, compact: isCompact, question })}</div>` : ""}
    <div class="landing-foot" data-land-foot>
      <button class="landing-more" type="button" data-land-more>More <span aria-hidden="true">▸</span></button>
      <span class="landing-corner">${chip}${captureBtn}</span>
    </div>
  </article>`;
}

export function drillTab({ compact = false } = {}) {
  return `<button class="study-tab ng-drilltab ${compact ? "is-compact" : ""}" type="button" data-production-selector=".ng-drilltab"><span>${icon("book", 15)}</span><span><b>Flashcards</b><small>12 due</small></span></button>`;
}

export function momentum({ combo = 3, broken = false } = {}) {
  return `<div class="momentum-chip ng-momentum ${broken ? "is-broken" : ""}" data-heat="${Math.min(5, combo - 1)}" data-production-selector=".ng-momentum">
    <b>×${combo}</b><span>${broken ? "Momentum gone" : "Momentum"}</span>
  </div>`;
}

export function comboPop({ combo = 3 } = {}) {
  const names = {
    2: "DOUBLE COMBO!",
    3: "TRIPLE",
    4: "MEGA",
    5: "ULTRA",
    6: "RAMPAGE!",
  };
  return `<div class="combo-pop ng-combo-pop" data-combo-pop data-heat="${Math.min(5, combo - 1)}" data-production-selector=".ng-combo-pop"><span>×${combo}</span><b>${names[combo] || "GODLIKE"}</b></div>`;
}

export function verdict({ result = "victory", detail = "" } = {}) {
  const victory = result === "victory";
  return `<div class="roll-verdict verdict ng-evcenter is-${result}" data-production-selector=".ng-evcenter" role="status">
    <span>${victory ? "SUBMISSION" : "TAPPED OUT"}</span>
    <strong>${victory ? "You finished it" : "You got caught"}</strong>
    <small>${escapeHtml(detail || (victory ? "Rear Naked Choke" : "Triangle Choke"))}</small>
  </div>`;
}

export function loader() {
  return `<div class="graph-loader" data-production-selector="canvas"><span></span><b>Building the mat</b><small>Loading the BJJ state graph</small></div>`;
}

export function vignette() {
  return '<div class="defense-vignette vignette ng-vignette" data-production-selector=".ng-vignette"></div>';
}
