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
}

export const question = {
  prompt:
    "Your opponent begins to elevate their hips while maintaining a deep underhook — what immediate adjustment do you make?",
  answers: [
    "Release crossface, post both hands",
    "Muscle the underhook away instead",
    "Shift weight back and sprawl",
    "Turn away and expose the back",
  ],
  correct: 2,
}

export const longQuestion = {
  prompt:
    "Your opponent connects the deep underhook, elevates your trapped leg, and starts rotating under your base while your far hand is occupied. Which adjustment preserves your balance without conceding the back?",
  answers: [
    "Post the occupied hand and square the hips",
    "Drive forward harder and ignore the trapped knee",
    "Shift weight back, widen the free leg, and clear the knee line",
    "Turn away to pull the underhook free",
  ],
  correct: 2,
}

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
]

export const clips = [
  { title: "Back take reaction", by: "Lachlan Giles" },
  { title: "Stop the waiter sweep", by: "Bernardo Faria" },
]

export const lessons = [
  { title: "Surviving Side Control", progress: 1, live: true },
  { title: "Closed Guard Foundations", progress: 0.75 },
  { title: "Half Guard Underhooks", progress: 0.5 },
  { title: "Back Escapes", progress: 0.25, locked: true },
]

export const history = [
  { title: "Deep Half Guard", result: "Won", delta: "+6%", time: "2m ago" },
  { title: "Mount Escape", result: "Lost", delta: "-3%", time: "Yesterday" },
  { title: "Closed Guard", result: "Won", delta: "+4%", time: "Fri" },
]

export const settings = {
  Flashcards: ["Daily goal", "Answer mode", "Study order", "Focus", "Show flashcards on pages"],
  Rolling: [
    "Rolling simulation",
    "Questions while you roll",
    "Sound",
    "Sound volume",
    "Option ordering",
  ],
  Modifiers: ["Athleticism", "Experience", "Ruleset", "Round length"],
  Shortcuts: ["A B C D · answer", "1–9 · choose option", "Space · pause", "/ · explore"],
}

export const tutorialSteps = [
  "Choose a technique from your hand",
  "Answer the landing question",
  "Open a technique sheet",
  "Commit to the sweep",
  "Survive a defense turn",
  "Finish your first roll",
]

export const categoryNotes = {
  Primitives: "Atomic controls and identity surfaces shared across all states.",
  HUD: "Persistent game information that should never compete with the active decision.",
  Graph: "The spatial state-machine canvas and its node language.",
  Decisions: "Choice, question, odds, timing, and detail surfaces used during a roll.",
  Learning: "Flashcard, lesson, history, and progress components.",
  Explorer: "Search, path, tree, and rich node dossier surfaces.",
  Overlays: "Modal, coach, tutorial, and defensive interruption layers.",
  Feedback: "Outcome, combo, verdict, and system communication.",
}
