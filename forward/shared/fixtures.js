export const node = {
  name: "Deep Half Guard",
  role: "Bottom",
  origin: "Half Guard / Bottom",
  status: "met",
  definition:
    "A guard where you move underneath the opponent's hips, isolate one leg, and make their base available to sweeps.",
  seo: "Deep Half Guard is a bottom guard in Brazilian Jiu-Jitsu that places the defender beneath an opponent's center of gravity to expose sweep directions while protecting against upper-body pressure.",
  context:
    "The position exchanges conventional distance management for direct access to the opponent's base. The bottom player must keep the trapped leg connected while denying crossface control.",
  principles: [
    "Keep your head close to the trapped hip.",
    "Hide the near arm from the crossface.",
    "Move the knee line before chasing upper-body control.",
  ],
  defense: [
    "Win the crossface and flatten the shoulders.",
    "Free the trapped knee before turning away.",
    "Back-step only after clearing the underhook.",
  ],
  outcomes: ["Back Control", "Single Leg", "Top Half Guard"],
};

// THREE answers, mirroring production (app.src.jsx MC_DISTRACTORS = 2 → 1 correct + 2 wrong).
// The catalog is a MOCK with no parity gate — check_forward_catalog.mjs only proves the frames
// render — so a fourth answer here would drift silently, which is what happened before v1.148.0.
export const question = {
  prompt:
    "Your opponent begins to elevate their hips while maintaining a deep underhook — what immediate adjustment do you make?",
  answers: [
    "Release crossface, post both hands",
    "Muscle the underhook away instead",
    "Shift weight back and sprawl",
  ],
  correct: 2,
};

export const longQuestion = {
  prompt:
    "Your opponent connects the deep underhook, elevates your trapped leg, and starts rotating under your base while your far hand is occupied. Which adjustment preserves your balance without conceding the back?",
  answers: [
    "Post the occupied hand and square the hips",
    "Drive forward harder and ignore the trapped knee",
    "Shift weight back, widen the free leg, and clear the knee line",
  ],
  correct: 2,
};

export const techniques = [
  {
    name: "Electric Chair",
    eyebrow: "Sweep",
    path: "Deep Half Guard → Butterfly Half",
    odds: 35,
  },
  {
    name: "Buggy Choke",
    eyebrow: "Submission",
    path: "Deep Half Guard → Back Control",
    odds: 35,
  },
  {
    name: "Kneebar",
    eyebrow: "Submission",
    path: "Deep Half Guard → Game over",
    odds: 31,
  },
  {
    name: "Waiter Sweep",
    eyebrow: "Sweep",
    path: "Deep Half Guard → Top Half",
    odds: 56,
  },
  {
    name: "Backdoor Escape",
    eyebrow: "Escape",
    path: "Deep Half Guard → Back Control",
    odds: 47,
  },
];

export const clips = [
  { title: "Back take reaction", by: "Lachlan Giles" },
  { title: "Stop the waiter sweep", by: "Bernardo Faria" },
];

function fallbackRole(role, overrides = {}) {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  return {
    role,
    roleLabel,
    origin: node.origin,
    successRate: techniques[0].odds,
    definition: node.definition,
    seo: node.seo,
    context: node.context,
    principles: node.principles,
    defense: node.defense,
    outcomes: node.outcomes,
    question,
    techniques,
    clips,
    ...overrides,
  };
}

function namedFallbackRole({ name, type, role, origin, definition, outcomes }) {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const choices = outcomes.map((outcome, index) => ({
    name: outcome,
    eyebrow: index === 0 ? "Primary" : "Connection",
    path: `${name} → ${outcome}`,
    odds: Math.max(18, 58 - index * 14),
  }));
  return fallbackRole(role, {
    origin,
    definition,
    seo: `${name} is a Brazilian Jiu-Jitsu ${type.toLowerCase()} shown from the ${roleLabel.toLowerCase()} perspective.`,
    context: `Curated fallback content keeps ${name} identifiable when the generated graph fixture cannot load.`,
    principles: [
      `Preserve structure while playing ${roleLabel}.`,
      `Control the nearest inside space before advancing ${name}.`,
    ],
    defense: [
      `Deny the strongest connection available in ${name}.`,
      "Protect alignment before changing direction.",
    ],
    outcomes,
    question: {
      prompt: `What is the first priority in ${name} as ${roleLabel}?`,
      answer: `Establish the controlling connection before advancing from ${origin}.`,
      answers: [
        "Establish the controlling connection",
        "Release every grip",
        "Turn away from the exchange",
      ],
      correct: 0,
    },
    techniques: choices,
    clips: [
      { title: `${name} · ${roleLabel}`, by: "Curated fallback" },
      { title: `${type} mechanics`, by: "Film study" },
    ],
  });
}

export const fallbackEntities = [
  {
    id: "position:deep-half-guard",
    type: "Position",
    name: "Deep Half Guard",
    curated: true,
    roles: {
      bottom: fallbackRole("bottom"),
      top: fallbackRole("top", {
        definition:
          "Deep Half Guard top is the passing perspective above an opponent who has moved underneath the hips and isolated one leg.",
      }),
    },
  },
  {
    id: "transition:waiter-sweep",
    type: "Transition",
    name: "Waiter Sweep",
    roles: {
      attacker: namedFallbackRole({
        name: "Waiter Sweep",
        type: "Transition",
        role: "attacker",
        origin: "Deep Half Guard",
        definition:
          "Waiter Sweep elevates the opponent's trapped leg from Deep Half Guard to expose their base and come on top.",
        outcomes: ["Top Half Guard", "Back Control", "Deep Half Guard"],
      }),
      defender: namedFallbackRole({
        name: "Waiter Sweep",
        type: "Transition",
        role: "defender",
        origin: "Deep Half Guard",
        definition:
          "Waiter Sweep defense protects the knee line and widens the free-leg base before elevation turns into a sweep.",
        outcomes: ["Base recovered", "Knee line cleared", "Deep Half Guard"],
      }),
    },
  },
  {
    id: "submission:rear-naked-choke-from-back-control",
    type: "Submission",
    name: "Rear Naked Choke from Back Control",
    roles: {
      attacker: namedFallbackRole({
        name: "Rear Naked Choke from Back Control",
        type: "Submission",
        role: "attacker",
        origin: "Back Control",
        definition:
          "Rear Naked Choke from Back Control is a strangle that isolates the neck after upper-body control is secured.",
        outcomes: ["Game Over", "Hand fighting", "Back Control"],
      }),
      defender: namedFallbackRole({
        name: "Rear Naked Choke from Back Control",
        type: "Submission",
        role: "defender",
        origin: "Back Control",
        definition:
          "Rear Naked Choke defense prioritizes two-on-one hand control, chin position, and shoulder-to-mat alignment.",
        outcomes: ["Grip cleared", "Shoulders to mat", "Game Over"],
      }),
    },
  },
];

export function resolveEntityContext(
  entity = fallbackEntities[0],
  requestedRole = "",
) {
  const roles = Object.keys(entity.roles);
  const role = entity.roles[requestedRole] ? requestedRole : roles[0];
  return {
    entityId: entity.id,
    type: entity.type,
    name: entity.name,
    availableRoles: roles,
    ...entity.roles[role],
    role,
  };
}

export const defaultContext = resolveEntityContext(
  fallbackEntities[0],
  fallbackEntities[0].roles.bottom ? "bottom" : "",
);

export const lessons = [
  { title: "Surviving Side Control", progress: 1, live: true },
  { title: "Closed Guard Foundations", progress: 0.75 },
  { title: "Half Guard Underhooks", progress: 0.5 },
  { title: "Back Escapes", progress: 0.25, locked: true },
];

export const challengeTracks = [
  {
    id: "white",
    name: "White Foundations",
    color: "#d7dce7",
    done: 7,
    total: 20,
    suggested: false,
    objectives: [
      {
        title: "Answer a landing question correctly",
        why: "Reading the state before moving builds better decisions.",
        done: 1,
        target: 1,
      },
      {
        title: "Open a move sheet",
        why: "Know what a technique wins before you commit.",
        done: 0,
        target: 1,
      },
      {
        title: "Finish your first roll",
        why: "Complete loops reveal how positions connect.",
        done: 0,
        target: 1,
      },
    ],
  },
  {
    id: "blue",
    name: "Blue Connections",
    color: "#7398df",
    done: 3,
    total: 8,
    suggested: true,
    objectives: [
      {
        title: "Win two connected exchanges",
        why: "Reliable sequences beat isolated techniques.",
        done: 1,
        target: 2,
      },
      {
        title: "Escape a submission",
        why: "Composure creates the next attacking chance.",
        done: 0,
        target: 1,
      },
    ],
  },
  {
    id: "purple",
    name: "Purple Patterns",
    color: "#9274bd",
    done: 1,
    total: 6,
    suggested: false,
    objectives: [
      {
        title: "Recall-prove five cards",
        why: "Pattern recognition starts with durable recall.",
        done: 2,
        target: 5,
      },
    ],
  },
  {
    id: "brown",
    name: "Brown Pressure",
    color: "#9c745b",
    done: 0,
    total: 6,
    suggested: false,
    objectives: [
      {
        title: "Reach x5 momentum",
        why: "Keep making sound decisions as the pace rises.",
        done: 0,
        target: 1,
      },
    ],
  },
  {
    id: "black",
    name: "Black Breadth",
    color: "#6d7380",
    done: 0,
    total: 6,
    suggested: false,
    objectives: [
      {
        title: "Recall-prove twenty-five cards",
        why: "Broad recall supports a game that travels.",
        done: 4,
        target: 25,
      },
    ],
  },
];

export const patches = [
  {
    id: "white-foundations",
    name: "White Foundations",
    detail: "Clear the White content track",
    earned: true,
  },
  {
    id: "recall-pressure",
    name: "Recall Under Pressure",
    detail: "Prove ten cards from memory",
    earned: false,
  },
  {
    id: "clean-checkpoint",
    name: "Clean Checkpoint",
    detail: "Pass a checkpoint first try",
    earned: false,
  },
];

export const matCoins = [
  {
    id: "houdini",
    name: "Houdini",
    detail: "Escape when the finish looked inevitable",
    earned: true,
  },
  {
    id: "guard-again",
    name: "Pulled Guard Again",
    detail: "Choose the guard-pull route three times",
    earned: false,
  },
  {
    id: "godlike",
    name: "GODLIKE",
    detail: "Reach x7 momentum",
    earned: false,
  },
  {
    id: "berimbolo",
    name: "Berimbolo, Briefly",
    detail: "Attempt the advanced route",
    earned: false,
  },
];

export const history = [
  { title: "Deep Half Guard", result: "Won", delta: "+6%", time: "2m ago" },
  { title: "Mount Escape", result: "Lost", delta: "-3%", time: "Yesterday" },
  { title: "Closed Guard", result: "Won", delta: "+4%", time: "Fri" },
];

// PAST ROLLS are what the Last rolls tab actually lists: one row per finished roll, named
// by where it started and where it ended, with the state count and the outcome. Roll history
// is in-memory in production and has never survived a reload.
export const pastRolls = [
  {
    from: "Deep Half Guard",
    to: "Back Control",
    states: 7,
    outcome: "won",
    ago: "2m ago",
  },
  {
    from: "Closed Guard",
    to: "Game over",
    states: 5,
    outcome: "tapped",
    ago: "18m ago",
  },
  {
    from: "Standing",
    to: "Half Guard",
    states: 4,
    outcome: "reset",
    ago: "Yesterday",
  },
];

// EVERY LIST SURFACE RENDERS THE FULL AUTHORED NAME. 648 of 1467 nodes carry a
// `from <position>` qualifier and 89 short names are shared — "Kimura" is 35 different
// techniques — so the qualifier IS the disambiguator and dropping it destroys the point
// of sharing a class at all.
export const listItems = [
  { main: "Waiter Sweep", from: "Deep Half Guard" },
  { main: "Kimura", from: "Side Control / Top" },
  { main: "Knee Slice Pass", from: "Half Guard / Top" },
  { main: "Back Take", from: "Deep Half Guard" },
  { main: "Rear Naked Choke", from: "Back Control" },
];

export const classLists = [
  {
    id: "l-tue",
    name: "Tuesday class · deep half",
    items: listItems.slice(0, 4),
    when: "2m ago",
  },
  {
    id: "l-comp",
    name: "Comp prep · back attacks",
    items: listItems.slice(3),
    when: "Fri",
  },
];

// The recipient half: what a `/l/<code>` arrival offers, before anything is adopted.
export const sharedClass = {
  code: "AgQHCwIF",
  from: "your coach",
  items: listItems,
};

// GI-ONLY MATERIAL, used only by frames that pass a ruleset — so no existing screen moves.
// v1.53.0 made gi/no-gi the first real divergence in CONTENT, not just in votes.
export const giTechniques = [
  {
    name: "Cross Collar Choke",
    eyebrow: "Submission",
    path: "Deep Half Guard → Game over",
    odds: 29,
    gi: true,
  },
  {
    name: "Lapel Sweep",
    eyebrow: "Sweep",
    path: "Deep Half Guard → Top Half",
    odds: 44,
    gi: true,
  },
];

// The belt corridor: one continuous woven belt, white through black, lessons hanging off it.
export const corridorBelts = [
  { id: "white", name: "White belt", done: 6, total: 6, color: "#d7dce7" },
  { id: "blue", name: "Blue belt", done: 3, total: 8, color: "#7398df" },
  { id: "purple", name: "Purple belt", done: 0, total: 6, color: "#9274bd" },
  { id: "brown", name: "Brown belt", done: 0, total: 6, color: "#9c745b" },
  { id: "black", name: "Black belt", done: 0, total: 6, color: "#6d7380" },
];

export const corridorLessons = [
  { title: "Deep Half Guard", cat: "position", crown: 3, done: true },
  { title: "Waiter Sweep from Deep Half", cat: "transition", crown: 2, done: true },
  { title: "Back Take from Deep Half", cat: "transition", crown: 1, done: false },
  { title: "Rear Naked Choke from Back", cat: "submission", crown: 0, done: false },
];

// NB the catalog is a DESIGN mock, not a mirror of renderSettings, and nothing gates the two
// against each other — so a retired row survives here until someone deletes it by hand. Two were
// found doing exactly that: "Study order" (the app's `studyOrder`, deleted v1.105.0 — due-first is
// behaviour, not a preference) and "Option ordering" (`cardOrder`, retired v1.122.0 — it ranked
// the hand by one quantity while every card printed another).
export const settings = {
  Flashcards: [
    "Daily goal",
    "Answer mode",
    "Focus",
    "Show flashcards on pages",
  ],
  Rolling: [
    "Rolling simulation",
    "Questions while you roll",
    "Sound",
    "Sound volume",
  ],
  Modifiers: ["Athleticism", "Experience", "Ruleset", "Round length"],
  Shortcuts: [
    "A B C D · answer",
    "1–9 · choose option",
    "Space · pause",
    "/ · explore",
  ],
};

export const categoryNotes = {
  Primitives: "Atomic controls and identity surfaces shared across all states.",
  HUD: "Persistent game information that should never compete with the active decision.",
  Graph: "The spatial state-machine canvas and its node language.",
  Decisions:
    "Choice, question, odds, timing, and detail surfaces used during a roll.",
  Learning: "Flashcard, lesson, history, challenge, and progress components.",
  Progress:
    "One-score belt, proof stripe, crown, category, and technique mastery projections.",
  Explorer: "Search, challenges, collection, and rich node dossier surfaces.",
  Overlays: "Modal, coach, challenge cue, and defensive interruption layers.",
  Feedback: "Outcome, combo, verdict, and system communication.",
  "Pane compositions":
    "Independent left and right rails, including simultaneous pressure states.",
  "Restart & terminal":
    "Reset hygiene, game-over boundaries, pane persistence, and rematch readiness.",
  "Progress & mastery":
    "Belt, stripe, crown, unit, checkpoint, category, and technique progress states.",
  "Challenges & collection":
    "Open content tracks, action evidence, scarce patches, and non-spendable Mat Coins.",
};
