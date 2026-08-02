import {
  accountBubble,
  brand,
  comboPop,
  drillTab,
  eventToast,
  filmStrip,
  graphField,
  landingCard,
  legend,
  loader,
  momentum,
  odds,
  optionCard,
  optionTray,
  questionBlock,
  transport,
  verdict,
  vignette,
  winLose,
} from "./components-core.js";
import {
  authModal,
  beltPath,
  coach,
  crownBadge,
  dossier,
  drillPanel,
  explorerPanel,
  flashcard,
  optionSheet,
  panicCard,
  beltMeter,
  masteryOverview,
  progressNudge,
  progressPanel,
  proofStripes,
  restartCard,
  settingsModal,
  systemState,
  tutorial,
} from "./components-panels.js";
import { longQuestion } from "./fixtures.js";
import { icon } from "./icons.js";
import { productionSource } from "./production-sources.js";

const stage = (content, graph = false) =>
  `<div class="component-demo component-demo--screen">${graph ? graphField() : ""}${content}</div>`;
const stack = (content) =>
  `<div class="component-demo"><div class="component-stack">${content}</div></div>`;

const item = (id, title, group, description, variants, render, notes = {}) => ({
  id,
  title,
  group,
  description,
  variants,
  render,
  production: productionSource("component", id, group),
  notes: {
    source: notes.source || "Neural runtime",
    behavior:
      notes.behavior ||
      "Static catalog representation of the current production surface.",
    usage: notes.usage || "Composed into gameplay and learning screens.",
  },
});

export const componentItems = [
  item(
    "brand-lockup",
    "Brand & explorer trigger",
    "Primitives",
    "Persistent BJJGraph identity and slash-search affordance.",
    ["Default", "Compact"],
    (v) => stage(brand({ compact: v === "Compact" }), true),
  ),
  item(
    "account-bubble",
    "Guest / user bubble",
    "Primitives",
    "Top-right identity chip for guest and signed-in states.",
    ["Guest", "Signed in"],
    (v) => stage(accountBubble({ signedIn: v === "Signed in" }), true),
  ),
  item(
    "icon-button",
    "Round icon button",
    "Primitives",
    "Reusable circular control for transport and close actions.",
    ["Primary", "Ghost"],
    (v) =>
      stack(
        `<button class="round-button ${v === "Ghost" ? "round-button--ghost" : ""}" aria-label="Play preview">${icon("play", 15)}</button>`,
      ),
  ),
  item(
    "pill",
    "Action pill",
    "Primitives",
    "Compact action, tab, and metadata control.",
    ["Neutral", "Primary", "Locked"],
    (v) =>
      stack(
        `<span class="pill ${v === "Primary" ? "pill--primary" : ""}">${v === "Locked" ? icon("lock", 12) : ""} ${v}</span>`,
      ),
  ),
  item(
    "toggle-group",
    "Path / tree toggle",
    "Primitives",
    "Segmented mode selector used in the explorer.",
    ["Path", "Tree"],
    (v) =>
      stack(
        `<div class="detail-actions"><span class="pill ${v === "Path" ? "pill--primary" : ""}">PATH</span><span class="pill ${v === "Tree" ? "pill--primary" : ""}">TREE</span></div>`,
      ),
  ),
  item(
    "ruleset-toggle",
    "GI / NO-GI toggle",
    "Primitives",
    "Ruleset control that changes authored attempt and success priors.",
    ["GI", "NO-GI"],
    (v) =>
      stack(
        `<div class="detail-actions"><span class="pill ${v === "GI" ? "pill--primary" : ""}">GI</span><span class="pill ${v === "NO-GI" ? "pill--primary" : ""}">NO-GI</span></div>`,
      ),
  ),
  item(
    "progress-bar",
    "Progress bar",
    "Primitives",
    "Shared linear progress for cards, lessons, and sessions.",
    ["25%", "50%", "100%"],
    (v) =>
      stack(
        `<div class="progress"><span style="--progress:${v}"></span></div>`,
      ),
  ),
  item(
    "odds-meter",
    "Technique odds meter",
    "HUD",
    "Success-rate label and compact probability bar.",
    ["Low", "Medium", "High"],
    (v) => stack(odds(v === "Low" ? 28 : v === "High" ? 74 : 51)),
  ),
  item(
    "win-lose-bar",
    "Win / lose bar",
    "HUD",
    "Persistent round balance with a high-contrast center marker.",
    ["Losing", "Even", "Winning"],
    (v) =>
      stage(
        winLose({ lose: v === "Losing" ? 72 : v === "Winning" ? 28 : 50 }),
        true,
      ),
  ),
  item(
    "transport",
    "Play & restart controls",
    "HUD",
    "Bottom-center roll transport that preserves manual pause.",
    ["Playing", "Paused"],
    (v) => stage(transport({ paused: v === "Paused" }), true),
  ),
  item(
    "event-toast",
    "Exchange event toast",
    "HUD",
    "Top-center, transient result line for changes in the roll.",
    ["Negative", "Positive", "Neutral"],
    (v) =>
      stage(
        eventToast(
          v === "Positive"
            ? {
                kicker: "CLEAN SWEEP",
                text: "+7% on this exchange",
                tone: "success",
              }
            : v === "Neutral"
              ? {
                  kicker: "POSITION HELD",
                  text: "No change in control",
                  tone: "neutral",
                }
              : {},
        ),
        true,
      ),
  ),
  item(
    "decision-timer",
    "Decision timer",
    "HUD",
    "Short-lived time budget for the live option hand.",
    ["Fresh", "Expiring", "Expired"],
    (v) =>
      stack(
        `<div class="detail-section"><small>${v.toUpperCase()}</small><div class="progress" style="margin-top:8px"><span style="--progress:${v === "Fresh" ? 90 : v === "Expiring" ? 18 : 0}%"></span></div></div>`,
      ),
  ),
  item(
    "graph-canvas",
    "Graph canvas",
    "Graph",
    "Spatial stage for the role-typed state machine.",
    ["Dense", "Sparse", "No active node"],
    (v) =>
      stage(
        graphField({ active: v !== "No active node", sparse: v === "Sparse" }),
      ),
  ),
  item(
    "position-node",
    "Position node",
    "Graph",
    "Circular graph node for stable position states.",
    ["Default", "Active", "Mastered"],
    (v) =>
      stack(
        `<i class="graph-node ${v === "Active" ? "graph-node--active" : "graph-node--position"}" style="position:relative;left:auto;top:auto">${v === "Active" ? "YOU" : ""}</i>`,
      ),
  ),
  item(
    "transition-node",
    "Transition node",
    "Graph",
    "Diamond graph node for movement and technique states.",
    ["Default", "Highlighted"],
    () =>
      stack(
        '<i class="graph-node graph-node--transition" style="position:relative;left:auto;top:auto"></i>',
      ),
  ),
  item(
    "submission-node",
    "Submission node",
    "Graph",
    "Triangular graph node for terminal threats.",
    ["Default", "Danger"],
    () =>
      stack(
        '<i class="graph-node graph-node--submission" style="position:relative;left:auto;top:auto"></i>',
      ),
  ),
  item(
    "graph-legend",
    "Graph legend",
    "Graph",
    "Shape key for position, transition, and submission nodes.",
    ["Default"],
    () => stage(legend(), true),
  ),
  item(
    "option-card",
    "Technique option card",
    "Decisions",
    "One technique in the player's live hand.",
    ["Default", "Selected", "Expired"],
    (v, context) => stack(optionCard(context.techniques[0], v.toLowerCase())),
  ),
  item(
    "option-row",
    "Scrollable option tray",
    "Decisions",
    "Responsive horizontal hand of available techniques.",
    ["Three cards", "Five cards", "Selected"],
    (v, context) =>
      stage(
        optionTray(
          {
            count: v === "Five cards" ? 5 : 3,
            selected: v === "Selected" ? 1 : -1,
          },
          context,
        ),
        true,
      ),
  ),
  item(
    "landing-identity",
    "Landing identity",
    "Decisions",
    "Position name, origin, role, and mastery status in reading order.",
    ["New", "Met", "Recall-proven"],
    (v, context) =>
      stack(
        `<div class="landing-identity"><b>${context.name}</b><span>· from ${context.origin}</span><span>· ${context.roleLabel}</span><span class="mastery-dot">${v === "New" ? "○ new" : v === "Recall-proven" ? "● recall-proven" : "◐ met"}</span></div>`,
      ),
  ),
  item(
    "film-strip",
    "Film study strip",
    "Decisions",
    "Short, horizontally clipped technique film references.",
    ["One clip", "Two clips"],
    (v, context) =>
      stack(filmStrip({ count: v === "One clip" ? 1 : 2 }, context)),
  ),
  item(
    "multiple-choice",
    "Multiple-choice block",
    "Decisions",
    "In-play A–D recognition question with explicit outcome states.",
    ["Unanswered", "Correct", "Wrong", "Long copy"],
    (v, context) =>
      stack(
        questionBlock({
          data: v === "Long copy" ? longQuestion : context.question,
          state:
            v === "Correct" ? "correct" : v === "Wrong" ? "wrong" : "default",
        }),
      ),
  ),
  item(
    "landing-card",
    "Question-first landing card",
    "Decisions",
    "Identity, definition, film, one question, and More in a fixed priority stack.",
    ["Default", "Compact", "No question", "Proven"],
    (v, context) =>
      stage(
        landingCard(
          {
            density: v === "Compact" ? "compact" : "default",
            showQuestion: v !== "No question" && v !== "Proven",
            status: v === "Proven" ? "proven" : "met",
          },
          context,
        ),
        true,
      ),
    {
      source: "renderLandCard / questionFor",
      behavior:
        "Question is optional; identity and film remain. Mobile fit hides lower-priority context before answers.",
      usage: "Landing, staged, and attempt screens.",
    },
  ),
  item(
    "mobile-fit-card",
    "Constrained landing card",
    "Decisions",
    "Priority-aware 400×875 variant for the reported crowded mobile state.",
    ["Fit", "Long copy"],
    (v, context) =>
      stage(
        landingCard(
          {
            question: v === "Long copy" ? longQuestion : undefined,
            priority: "fit",
          },
          context,
        ),
        true,
      ),
    {
      behavior:
        "In constrained frames, definition, film, and More hide before the active question or hand is clipped.",
    },
  ),
  item(
    "option-sheet",
    "Technique detail sheet",
    "Decisions",
    "Bottom sheet for film, mechanics, chains, and commit.",
    ["Collapsed", "Expanded", "Confirm"],
    (v, context) =>
      stage(optionSheet({ state: v.toLowerCase() }, context), true),
  ),
  item(
    "drill-tab",
    "Flashcards edge tab",
    "Learning",
    "Manual-only entry point to the right study pane.",
    ["Default", "Compact"],
    (v) => stage(drillTab({ compact: v === "Compact" }), true),
  ),
  item(
    "flashcard",
    "Classic recall card",
    "Learning",
    "Question-first card that reveals an authored answer.",
    ["Question", "Revealed"],
    (v, context) => stack(flashcard({ state: v.toLowerCase() }, context)),
  ),
  item(
    "flashcard-mc",
    "Study multiple choice",
    "Learning",
    "Opt-in recognition mode for the study pane.",
    ["Unanswered", "Correct"],
    (v, context) =>
      stack(
        flashcard({ mode: "multiple-choice", state: v.toLowerCase() }, context),
      ),
  ),
  item(
    "drill-pane",
    "Flashcards pane",
    "Learning",
    "Manual study home, active card, history, and completion states.",
    ["Home", "Study", "Revealed", "Multiple-choice", "History", "Complete"],
    (v, context) =>
      stage(drillPanel({ state: v.toLowerCase() }, context), true),
    {
      source: "renderDrillHome / renderRollHistory",
      behavior:
        "Opening pauses a live roll; closing resumes only if this pane paused it.",
    },
  ),
  item(
    "lesson-row",
    "Belt lesson row",
    "Learning",
    "Crowned lesson state with lock, live, and completion signals.",
    ["Live", "Progress", "Locked"],
    (v) =>
      stack(
        `<div class="lesson-row"><b>${v === "Locked" ? icon("lock", 12) : v === "Live" ? "●" : "○"} Half Guard Underhooks</b><div class="progress" style="margin-top:9px"><span style="--progress:${v === "Locked" ? 0 : v === "Live" ? 20 : 65}%"></span></div></div>`,
      ),
  ),
  item(
    "belt-path",
    "Belt path panel",
    "Learning",
    "Curriculum sequence, game knowledge score, lessons, and crowns.",
    ["New", "In progress", "Mastered", "NO-GI"],
    (v) =>
      stage(
        beltPath({
          ruleset: v === "NO-GI" ? "nogi" : "gi",
          state:
            v === "New" ? "new" : v === "Mastered" ? "mastered" : "progress",
        }),
        true,
      ),
  ),
  item(
    "belt-meter",
    "Game knowledge belt meter",
    "Progress",
    "One weighted score with belt thresholds and an exact you-are-here marker.",
    ["White", "Blue", "Purple", "Black"],
    (v) =>
      stack(
        beltMeter({
          score:
            v === "White" ? 28 : v === "Blue" ? 52 : v === "Purple" ? 66 : 88,
          belt: v.toLowerCase(),
        }),
      ),
  ),
  item(
    "proof-stripes",
    "Belt proof stripes",
    "Progress",
    "Four display-only proof marks within the current belt band.",
    ["0", "1", "2", "4"],
    (v) => stack(proofStripes({ filled: Number(v) })),
  ),
  item(
    "lesson-crown",
    "Lesson mastery crown",
    "Progress",
    "Zero-to-four crown driven by the same deck mastery used by the belt score.",
    ["0", "1", "2", "3", "4", "Locked"],
    (v) =>
      stack(
        crownBadge({
          level: v === "Locked" ? 0 : Number(v),
          locked: v === "Locked",
        }),
      ),
  ),
  item(
    "mastery-overview",
    "Path / lesson mastery",
    "Progress",
    "Production game score and selected-lesson crown without a second category score.",
    ["Game score", "Selected technique"],
    (v, context) =>
      stack(
        masteryOverview(
          { mode: v === "Selected technique" ? "technique" : "category" },
          context,
        ),
      ),
  ),
  item(
    "progress-pane",
    "Belt Path · progress focus",
    "Progress",
    "Production progress rendered inside Explorer PATH, not as a separate invented pane.",
    ["Overview", "Technique"],
    (v, context) =>
      stage(
        progressPanel(
          { mode: v === "Technique" ? "technique" : "overview" },
          context,
        ),
        true,
      ),
  ),
  item(
    "explorer-tree",
    "Explorer tree panel",
    "Explorer",
    "Reference browser for graph categories.",
    ["Tree", "Search results"],
    (v) =>
      stage(
        explorerPanel({ query: v === "Search results" ? "half guard" : "" }),
        true,
      ),
  ),
  item(
    "dossier-collapsed",
    "Node dossier · collapsed",
    "Explorer",
    "Compact node truth with summary, film, perspective, and roll action.",
    ["Desktop", "Mobile"],
    (v, context) => stage(dossier({ mobile: v === "Mobile" }, context), true),
    {
      source: "NG_CONTENT + graph node data",
      usage: "Desktop semantic zoom and mobile dossier sheet.",
    },
  ),
  item(
    "dossier-expanded",
    "Node dossier · expanded",
    "Explorer",
    "Full authored context, principles, defense, and outcomes.",
    ["Desktop", "Mobile"],
    (v, context) =>
      stage(
        dossier({ variant: "expanded", mobile: v === "Mobile" }, context),
        true,
      ),
  ),
  item(
    "dossier-seo",
    "Node dossier · SEO / AI output only",
    "Explorer",
    "Answer-first text representation for crawlers, AI, and no-JS readers.",
    ["Definition", "Expanded"],
    (v, context) => stage(dossier({ variant: "seo" }, context), true),
    {
      source: "JSON summary/context → generated markdown and JSON-LD",
      behavior:
        "Not a competing runtime truth; this is the explicit text projection of the same content model.",
    },
  ),
  item(
    "settings-modal",
    "Settings modal",
    "Overlays",
    "Tabbed game and learning preferences.",
    ["Flashcards", "Rolling", "Modifiers", "Shortcuts"],
    (v) => stage(settingsModal({ tab: v }), true),
  ),
  item(
    "auth-modal",
    "Account modal",
    "Overlays",
    "Optional sync entry point; the dev catalog itself remains unauthenticated.",
    ["Sign in", "Sign up"],
    (v) => stage(authModal({ mode: v.toLowerCase().replace(" ", "-") }), true),
  ),
  item(
    "coach-card",
    "Three-beat coach",
    "Overlays",
    "First-run instruction that points at the current task.",
    ["Step 1", "Step 2", "Step 3"],
    (v) => stage(coach({ step: Number(v.slice(-1)) }), true),
  ),
  item(
    "tutorial-strip",
    "Tutorial drip",
    "Overlays",
    "One next action from the 20-step learning checklist.",
    ["4 / 20", "19 / 20", "Complete"],
    (v) =>
      stage(
        tutorial({ done: v === "Complete" ? 20 : Number(v.split(" ")[0]) }),
        true,
      ),
  ),
  item(
    "defense-panic",
    "Defense panic card",
    "Overlays",
    "Urgent recall interruption during opponent control.",
    ["Prompt", "Revealed"],
    (v) => stage(panicCard({ revealed: v === "Revealed" }), true),
  ),
  item(
    "restart-card",
    "Restart center event",
    "Overlays",
    "Immediate restart feedback while the engine clears the live exchange and deals a new roll.",
    ["Triggered", "Restarting"],
    (v, context) =>
      stage(restartCard({ state: v.toLowerCase() }, context), true),
  ),
  item(
    "progress-nudge",
    "Path score update",
    "Feedback",
    "Production PATH score after mastery gains or tested forgetting; not a runtime toast.",
    ["Saved", "Demoted"],
    (v) => stage(progressNudge({ type: v.toLowerCase() }), true),
  ),
  item(
    "defense-vignette",
    "Defense vignette",
    "Feedback",
    "Non-interactive danger frame behind the defense prompt.",
    ["Default"],
    () => stage(vignette(), true),
  ),
  item(
    "momentum-chip",
    "Momentum chip",
    "Feedback",
    "Persistent combo heat and odds modifier indicator.",
    ["×2", "×4", "×6", "Broken"],
    (v) =>
      stage(
        momentum({
          combo: v === "×2" ? 2 : v === "×4" ? 4 : 6,
          broken: v === "Broken",
        }),
        true,
      ),
  ),
  item(
    "combo-announcer",
    "Combo announcer",
    "Feedback",
    "Large transient feedback for consecutive correct landing answers.",
    ["Double", "Triple", "Ultra", "Godlike"],
    (v) =>
      stage(
        comboPop({
          combo:
            v === "Double" ? 2 : v === "Triple" ? 3 : v === "Ultra" ? 5 : 7,
        }),
        true,
      ),
  ),
  item(
    "roll-verdict",
    "Victory / defeat verdict",
    "Feedback",
    "Centered end-of-roll status with supporting outcome.",
    ["Victory", "Defeat"],
    (v) => stage(verdict({ result: v.toLowerCase() }), true),
  ),
  item(
    "graph-loader",
    "Graph loader",
    "Feedback",
    "Minimal boot surface while Neural data is ingested.",
    ["Default"],
    () => stage(loader()),
  ),
  item(
    "system-state",
    "Empty / error state",
    "Feedback",
    "Explicit, non-silent fallback for queues, offline mode, and boot failure.",
    ["Empty", "Offline", "Error"],
    (v) => stack(systemState({ type: v.toLowerCase() })),
  ),
];
