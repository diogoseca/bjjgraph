const SOURCES = {
  shell: {
    files: ["neural/src/xdc-template.html", "neural/src/app.src.jsx"],
    symbols: ["Neural shell", "render"],
    handles: [".ng-logo", ".ng-acctwrap", ".ng-account-menu", "transportRef"],
  },
  graph: {
    files: [
      "neural/src/xdc-template.html",
      "neural/src/app.src.jsx",
      "neural/src/helmet.html",
    ],
    symbols: ["draw", "stageRollAt", "startTravel"],
    handles: ["canvasRef", ".ng-legendkey"],
  },
  event: {
    files: ["neural/src/xdc-template.html", "neural/src/app.src.jsx"],
    symbols: ["setEvent", "showCenter"],
    handles: [".ng-evtoast", "evCenterRef", ".ng-winbar"],
  },
  options: {
    files: [
      "neural/src/xdc-template.html",
      "neural/src/app.src.jsx",
      "neural/src/helmet.html",
    ],
    symbols: ["buildOptionCard", "optionsFor", "clearOptions"],
    handles: [".ng-optionrow", "[data-tech]", ".ngbar", ".ngodds"],
  },
  landing: {
    files: ["neural/src/app.src.jsx", "neural/src/helmet.html"],
    symbols: ["renderLandCard", "_mcBlock", "filmStudyHTML"],
    handles: [
      ".ng-landcard",
      "[data-land-id]",
      "[data-land-film]",
      "[data-land-q]",
      "[data-land-more]",
    ],
  },
  optionDetail: {
    files: ["neural/src/xdc-template.html", "neural/src/app.src.jsx"],
    symbols: ["expandOption", "hideOptDetail"],
    handles: ["optDetailRef", "expandOption", "hideOptDetail"],
  },
  drill: {
    files: ["neural/src/xdc-template.html", "neural/src/app.src.jsx"],
    symbols: ["renderDrillHome", "renderDrill", "applyDeckVisibility"],
    handles: [".ng-drill", ".ng-drilltab", "drillHeadRef", "drillListRef"],
  },
  // The unit checkpoint is the ONE pane in study mode, never a modal: `_checkpointShow()` calls
  // `setDrillHeader("Checkpoint", "<i> of <n> \u00b7 <unit name>")` and then `renderDrill()`, and
  // `_paneStudyActive()` counts `_checkpoint` alongside a deck and a session. There is no
  // `[data-checkpoint]` anywhere in app.src.jsx — the catalog used to cite one.
  checkpoint: {
    files: ["neural/src/xdc-template.html", "neural/src/app.src.jsx"],
    symbols: [
      "startCheckpoint",
      "_checkpointShow",
      "_checkpointAnswer",
      "_cancelCheckpoint",
      "setDrillHeader",
      "_mcBlock",
    ],
    handles: [
      ".ng-drill",
      ".ng-pane-drillhead",
      "drillHeadRef",
      "drillListRef",
    ],
  },
  explorer: {
    files: ["neural/src/xdc-template.html", "neural/src/app.src.jsx"],
    symbols: ["renderExplorer", "applyExplorerVisibility"],
    handles: [
      ".ng-explorer",
      "viewToggleRef",
      "explorerSearchRef",
      "explorerListRef",
    ],
  },
  knowledge: {
    files: ["neural/src/challenge-ui.src.js", "neural/src/app.src.jsx"],
    symbols: ["renderKnowledgeHeader", "gameScore", "deckMastery"],
    handles: ["knowledgeRef", "[data-score-row]", ".ng-knowledge-meter"],
  },
  challenges: {
    files: [
      "neural/src/challenge-ui.src.js",
      "neural/src/challenge-feedback.src.js",
      "neural/src/challenge-engine.src.js",
      "neural/src/challenge-definitions.src.js",
      "neural/src/app.src.jsx",
    ],
    symbols: [
      "renderChallenges",
      "renderCollection",
      "renderChallengeCue",
      "acknowledgeChallenge",
      "queueChallengeReward",
      "ngAdvanceChallenges",
      "ngRewardChanges",
      "ngMergeChallengeMaps",
      "ngMergeCollectibles",
      "NG_CHALLENGE_TRACKS",
      "NG_BADGE_DEFINITIONS",
      "NG_MAT_COINS",
    ],
    handles: [
      "[data-challenge-cue]",
      "[data-challenge-id]",
      ".ng-challenge-row",
      ".ng-challenge-reward",
    ],
  },
  dossier: {
    files: [
      "neural/src/xdc-template.html",
      "neural/src/app.src.jsx",
      "neural/src/helmet.html",
    ],
    symbols: ["renderDossier", "openDossier"],
    handles: ["nodeCardRef", "dossierRef", "dossierSheetRef"],
  },
  settings: {
    files: ["neural/src/app.src.jsx"],
    symbols: ["renderSettings", "buildModifiers"],
    handles: ["modalCardRef", "_settingsTab", "renderSettings"],
  },
  auth: {
    files: ["neural/src/app.src.jsx"],
    symbols: ["renderAuth", "openAuth"],
    handles: ["modalRef", "modalCardRef", "renderAuth"],
  },
  coach: {
    files: ["neural/src/app.src.jsx", "neural/src/helmet.html"],
    symbols: ["renderCoach"],
    handles: [".ng-coach", "coachRef", "renderCoach"],
  },
  defense: {
    files: ["neural/src/app.src.jsx", "neural/src/helmet.html"],
    symbols: ["enterDefense", "buildPanicCard", "showVignette"],
    handles: ["[data-panic]", ".ng-vignette", ".ng-optionrow"],
  },
  momentum: {
    files: ["neural/src/app.src.jsx", "neural/src/helmet.html"],
    symbols: ["_comboUp", "_breakCombo", "momentumMod"],
    handles: [".ng-momentum", ".ng-combo-pop"],
  },
  restart: {
    files: ["neural/src/app.src.jsx"],
    symbols: ["restart", "startRoll", "showCenter"],
    handles: ["evCenterRef"],
  },
  terminal: {
    files: ["neural/src/xdc-template.html", "neural/src/app.src.jsx"],
    symbols: ["endRound", "showCenter"],
    handles: ["evCenterRef", ".ng-winbar"],
  },
  fallback: {
    files: ["neural/src/app.src.jsx"],
    symbols: ["renderFallback"],
    handles: ["wrapRef", "renderFallback"],
  },
  seo: {
    files: [
      "scripts/regenerate_md_from_json.py",
      "templates/Positions/TEMPLATE-DUAL.md.jinja2",
    ],
    symbols: ["generated Markdown and JSON-LD projection"],
    handles: ["article", "script[type='application/ld+json']"],
    classification: "output-only",
  },
};

const COMPONENT_SOURCES = {
  "brand-lockup": ["shell"],
  "account-bubble": ["shell"],
  "icon-button": ["shell"],
  pill: ["settings"],
  "toggle-group": ["settings"],
  "ruleset-toggle": ["explorer"],
  "progress-bar": ["drill", "knowledge"],
  "odds-meter": ["options"],
  "win-lose-bar": ["event"],
  transport: ["shell"],
  "event-toast": ["event"],
  "decision-timer": ["options"],
  "graph-canvas": ["graph"],
  "position-node": ["graph"],
  "transition-node": ["graph"],
  "submission-node": ["graph"],
  "graph-legend": ["graph"],
  "option-card": ["options"],
  "option-row": ["options"],
  "landing-identity": ["landing"],
  "film-strip": ["landing"],
  "multiple-choice": ["landing"],
  "landing-card": ["landing"],
  "mobile-fit-card": ["landing"],
  "option-sheet": ["optionDetail"],
  "drill-tab": ["drill"],
  flashcard: ["drill"],
  "flashcard-mc": ["drill"],
  "drill-pane": ["drill"],
  "lesson-row": ["challenges"],
  "challenge-panel": ["challenges", "knowledge"],
  "game-knowledge-header": ["knowledge"],
  "challenge-track-card": ["challenges"],
  "challenge-row": ["challenges"],
  "collection-panel": ["challenges", "knowledge"],
  "milestone-patch": ["challenges"],
  "mat-coin": ["challenges"],
  "belt-meter": ["knowledge"],
  "proof-stripes": ["knowledge"],
  "lesson-crown": ["knowledge"],
  "mastery-overview": ["knowledge"],
  "progress-pane": ["knowledge"],
  "explorer-tree": ["explorer"],
  "dossier-collapsed": ["dossier"],
  "dossier-expanded": ["dossier"],
  "dossier-seo": ["seo"],
  "settings-modal": ["settings"],
  "auth-modal": ["auth"],
  "coach-card": ["coach"],
  "challenge-cue": ["challenges"],
  "defense-panic": ["defense"],
  "restart-card": ["restart"],
  "progress-nudge": ["knowledge"],
  "reward-toast": ["challenges"],
  "defense-vignette": ["defense"],
  "momentum-chip": ["momentum"],
  "combo-announcer": ["momentum"],
  "roll-verdict": ["terminal"],
  "graph-loader": ["graph"],
  "system-state": ["fallback"],
};

function screenSourceKeys(id, group) {
  if (id === "dossier-seo") return ["seo"];
  const keys = ["shell", "graph"];

  if (id.startsWith("boot-") || id === "offline") {
    keys.push(id === "boot-loading" ? "graph" : "fallback");
  } else if (group === "Landing") {
    keys.push("landing", "options", "event");
  } else if (group === "Hand") {
    keys.push("options");
  } else if (group === "Attempt") {
    keys.push("options", "optionDetail");
  } else if (group === "Outcome & defense") {
    keys.push(
      id.startsWith("defense") ? "defense" : "event",
      id.startsWith("combo") ? "momentum" : "options",
    );
  } else if (group === "Pane compositions") {
    if (id.includes("challenges") || id.includes("collection"))
      keys.push("challenges", "knowledge");
    else if (id.includes("progress")) keys.push("knowledge");
    else if (id.includes("left") || id.includes("tree"))
      keys.push("explorer");
    if (id.includes("right") || id.includes("study")) keys.push("drill");
  } else if (group === "Restart & terminal" || group === "Roll end") {
    keys.push(id.startsWith("restart") ? "restart" : "terminal");
    if (id.includes("study")) keys.push("drill");
    if (id.includes("challenge") || id.includes("patch"))
      keys.push("challenges");
  } else if (group === "Progress & mastery") {
    keys.push("knowledge", "event");
    if (id.includes("checkpoint")) keys.push("checkpoint");
    if (
      id.includes("challenge") ||
      id.includes("collection") ||
      id.includes("reward") ||
      id.includes("checkpoint")
    )
      keys.push("challenges");
  } else if (group === "Study") {
    keys.push("drill");
  } else if (group === "Challenges & collection") {
    keys.push("challenges", "knowledge");
  } else if (group === "Explore & challenges") {
    if (id.startsWith("dossier")) keys.push("dossier");
    else if (id.startsWith("checkpoint"))
      keys.push("checkpoint", "challenges", "knowledge");
    else if (id.startsWith("challenge")) keys.push("challenges", "knowledge");
    else keys.push("explorer");
  } else if (group === "Settings & account") {
    keys.push(
      id.startsWith("settings")
        ? "settings"
        : id.startsWith("auth")
          ? "auth"
          : "shell",
    );
  } else if (group === "Onboarding") {
    keys.push(id.startsWith("challenge") ? "challenges" : "coach");
  } else if (group === "Responsive stress") {
    keys.push("landing", "options", "event");
  }

  return keys;
}

function combine(keys) {
  const definitions = [...new Set(keys)].map((key) => SOURCES[key]);
  return {
    classification:
      definitions.find((source) => source.classification)?.classification ||
      "runtime",
    files: [...new Set(definitions.flatMap((source) => source.files))],
    symbols: [...new Set(definitions.flatMap((source) => source.symbols))],
    handles: [...new Set(definitions.flatMap((source) => source.handles))],
  };
}

export function productionSource(kind, id, group) {
  const keys =
    kind === "component"
      ? COMPONENT_SOURCES[id] || ["shell"]
      : screenSourceKeys(id, group);
  return combine(keys);
}
