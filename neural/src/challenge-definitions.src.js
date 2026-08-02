// Challenge progression is intentionally separate from Game Knowledge. These definitions only
// observe existing evidence; rewards never feed odds, timers, curriculum access, or score math.

const NG_CHALLENGE_TRACKS = Object.freeze([
  { id: "white", name: "White Foundations", label: "White content track" },
  { id: "blue", name: "Blue Connections", label: "Blue content track" },
  { id: "purple", name: "Purple Patterns", label: "Purple content track" },
  { id: "brown", name: "Brown Pressure", label: "Brown content track" },
  { id: "black", name: "Black Breadth", label: "Black content track" },
]);

function ngChallenge(id, track, title, why, action, target, rule) {
  return Object.freeze({
    id,
    track,
    title,
    why,
    action,
    target,
    ...rule,
  });
}

const NG_WHITE_CHALLENGES = [
  ngChallenge(
    "white.coach1",
    "white",
    "Read your hand",
    "Recognizing the available routes is the first step toward deliberate choices.",
    "Start a roll here",
    1,
    {
      legacyId: "coach1",
      copy: "Read your hand - the cards below are every move you have here",
      event: "coach_1",
    },
  ),
  ngChallenge(
    "white.coach2",
    "white",
    "Preview a move",
    "A quick preview connects a technique name to its likely outcome.",
    "Open a move sheet",
    1,
    {
      legacyId: "coach2",
      copy: "Peek a move's sheet before you commit to it",
      event: "coach_2",
    },
  ),
  ngChallenge(
    "white.coach3",
    "white",
    "Read a landing question",
    "Landing questions turn each new position into a recall opportunity.",
    "Start a roll here",
    1,
    {
      legacyId: "coach3",
      copy: "Every state you land on asks you one question",
      event: "coach_3",
    },
  ),
  ngChallenge(
    "white.answer",
    "white",
    "Answer a landing question correctly",
    "Correct recognition improves the decision you are about to make.",
    "Start a roll here",
    1,
    {
      legacyId: "answer",
      copy: "Answer a landing question correctly - press A, B, C or D",
      event: "land_q_answered",
      when: (p) => !!p.correct,
    },
  ),
  ngChallenge(
    "white.sheet",
    "white",
    "Open a move sheet",
    "The sheet shows what the move is trying to win before you commit.",
    "Study the technique",
    1,
    {
      legacyId: "sheet",
      copy: "Open a move's sheet to see what it wins you",
      event: "sheet_opened",
    },
  ),
  ngChallenge(
    "white.commit",
    "white",
    "Execute a move",
    "Committing turns recognition into an actual grappling decision.",
    "Start a roll here",
    1,
    { legacyId: "commit", copy: "Execute a move", event: "commit" },
  ),
  ngChallenge(
    "white.sweep",
    "white",
    "See an exchange resolve",
    "Watching the exchange resolve links live odds to an outcome.",
    "Start a roll here",
    1,
    {
      legacyId: "sweep",
      copy: "Watch the needle decide it",
      event: "sweep_land",
    },
  ),
  ngChallenge(
    "white.win1",
    "white",
    "Win an exchange",
    "Winning one exchange demonstrates a complete position-to-technique loop.",
    "Start a roll here",
    1,
    { legacyId: "win1", copy: "Win an exchange", event: "impact_success" },
  ),
  ngChallenge(
    "white.refund",
    "white",
    "Earn a decision-time refund",
    "Fast recognition creates more time for the next choice.",
    "Start a roll here",
    1,
    {
      legacyId: "refund",
      copy: "Buy yourself clock with a right answer",
      event: "timer_refund",
      when: (p) => !!p.granted,
    },
  ),
  ngChallenge(
    "white.defend",
    "white",
    "Survive an attack",
    "Defensive composure starts with recognizing that the exchange has changed.",
    "Start a roll here",
    1,
    { legacyId: "defend", copy: "Survive an attack", event: "defend_start" },
  ),
  ngChallenge(
    "white.escape",
    "white",
    "Escape a submission",
    "A successful escape closes the defensive loop under pressure.",
    "Start a roll here",
    1,
    { legacyId: "escape", copy: "Escape a submission", event: "escape" },
  ),
  ngChallenge(
    "white.roll",
    "white",
    "Finish a complete roll",
    "Seeing a roll through connects isolated decisions into one sequence.",
    "Start a roll here",
    1,
    {
      legacyId: "roll",
      copy: "See a roll through to the end",
      event: "roll_end",
    },
  ),
  ngChallenge(
    "white.pane-open",
    "white",
    "Open Flashcards during a roll",
    "Pausing to study lets you inspect the exact position without losing it.",
    "Study the technique",
    1,
    {
      legacyId: "pane_open",
      copy: "Open your flashcards - the game stops while you study",
      event: "pane_paused",
    },
  ),
  ngChallenge(
    "white.pane-close",
    "white",
    "Resume after studying",
    "Returning to the same exchange turns study into immediate application.",
    "Start a roll here",
    1,
    {
      legacyId: "pane_close",
      copy: "Close them - the game picks up exactly where it left off",
      event: "pane_resumed",
    },
  ),
  ngChallenge(
    "white.film",
    "white",
    "Watch a film-study Short",
    "A visual example makes the movement pattern easier to recognize.",
    "Study the technique",
    1,
    {
      legacyId: "film",
      copy: "Watch a film-study Short",
      event: "short_watched",
    },
  ),
  ngChallenge(
    "white.recall",
    "white",
    "Prove a card from memory",
    "Unaided recall is stronger evidence than recognizing an answer from a list.",
    "Study the technique",
    1,
    {
      legacyId: "recall",
      copy: "Prove a card from memory instead of from a list",
      event: "recall_proven",
    },
  ),
  ngChallenge(
    "white.roam",
    "white",
    "Roam to a graph position",
    "Choosing a starting state makes the graph a navigable game map.",
    "Start a roll here",
    1,
    {
      legacyId: "roam",
      copy: "Click any node on the graph to roam there",
      event: "roll_staged",
    },
  ),
  ngChallenge(
    "white.challenges",
    "white",
    "Open Challenges",
    "The challenge rail keeps suggested practice visible without gating the graph.",
    "Browse Challenges",
    1,
    {
      legacyId: "path",
      copy: "Open your Challenges",
      event: "challenges_opened",
      aliases: ["path_opened"],
    },
  ),
  ngChallenge(
    "white.lesson",
    "white",
    "Finish a lesson",
    "Completing a focused deck builds reliable knowledge around one position.",
    "Study the technique",
    1,
    { legacyId: "lesson", copy: "Finish a lesson", event: "lesson_done" },
  ),
  ngChallenge(
    "white.capstone",
    "white",
    "Clear the White content capstone",
    "The optional capstone checks whether the foundation holds together in a roll.",
    "Start the capstone",
    1,
    {
      legacyId: "belt",
      copy: "Clear the White content capstone",
      event: "belt_test_won",
    },
  ),
];

const NG_ADVANCED_CHALLENGES = [
  ngChallenge("blue.combo-three", "blue", "Build a three-move rhythm", "Connected decisions matter more than one lucky exchange.", "Start a roll here", 1, { event: "combo", when: (p) => p.n === 3 }),
  ngChallenge("blue.escape-three", "blue", "Escape three submissions", "Repeated escapes build calm defensive recognition.", "Start a roll here", 3, { event: "escape" }),
  ngChallenge("blue.roll-three", "blue", "Finish three complete rolls", "Complete rolls expose the links between positions.", "Start a roll here", 3, { event: "roll_end" }),
  ngChallenge("blue.lesson-three", "blue", "Complete three lessons", "Focused study gives connected actions a technical base.", "Study the curriculum", 3, { snapshot: "lessonCount" }),
  ngChallenge("blue.checkpoint", "blue", "Pass a unit checkpoint", "A checkpoint confirms the lesson evidence holds together.", "Start a checkpoint", 1, { snapshot: "checkpointCount" }),
  ngChallenge("blue.recall-five", "blue", "Recall-prove five cards", "Recall turns familiar routes into usable decisions.", "Study Flashcards", 5, { snapshot: "recallCount" }),

  ngChallenge("purple.combo-five", "purple", "Build a five-move rhythm", "Longer chains reveal patterns across several positions.", "Start a roll here", 1, { event: "combo", when: (p) => p.n === 5 }),
  ngChallenge("purple.recall-fifteen", "purple", "Recall-prove fifteen cards", "Broader recall makes recurring grappling patterns easier to spot.", "Study Flashcards", 15, { snapshot: "recallCount" }),
  ngChallenge("purple.lesson-eight", "purple", "Complete eight lessons", "Coverage across units exposes relationships between systems.", "Study the curriculum", 8, { snapshot: "lessonCount" }),
  ngChallenge("purple.checkpoint-three", "purple", "Pass three checkpoints", "Repeated proof shows the pattern is not tied to one deck.", "Start a checkpoint", 3, { snapshot: "checkpointCount" }),
  ngChallenge("purple.master-three", "purple", "Master three technique decks", "Full-deck recall supports pattern recognition from either side.", "Study Flashcards", 3, { snapshot: "masteredDeckCount" }),
  ngChallenge("purple.capstone-one", "purple", "Clear one content capstone", "A capstone tests a connected game rather than an isolated answer.", "Start a capstone", 1, { snapshot: "capstoneCount" }),

  ngChallenge("brown.combo-seven", "brown", "Reach seven-move momentum", "Sustained correct decisions simulate recall under pressure.", "Start a roll here", 1, { event: "combo", when: (p) => p.n === 7 }),
  ngChallenge("brown.escape-ten", "brown", "Escape ten submissions", "A larger defensive sample rewards consistency, not a single save.", "Start a roll here", 10, { event: "escape" }),
  ngChallenge("brown.recall-thirty", "brown", "Recall-prove thirty cards", "Fast unaided recall supports decisions in difficult exchanges.", "Study Flashcards", 30, { snapshot: "recallCount" }),
  ngChallenge("brown.lesson-fifteen", "brown", "Complete fifteen lessons", "Deep curriculum coverage supports several connected systems.", "Study the curriculum", 15, { snapshot: "lessonCount" }),
  ngChallenge("brown.checkpoint-six", "brown", "Pass six checkpoints", "Repeated checkpoint evidence tests durable understanding.", "Start a checkpoint", 6, { snapshot: "checkpointCount" }),
  ngChallenge("brown.master-eight", "brown", "Master eight technique decks", "Full-deck mastery keeps advanced options available under stress.", "Study Flashcards", 8, { snapshot: "masteredDeckCount" }),

  ngChallenge("black.combo-seven-three", "black", "Reach seven-move momentum three times", "Repeatable long sequences show breadth without creating a second score.", "Start a roll here", 3, { event: "combo", when: (p) => p.n === 7 }),
  ngChallenge("black.recall-sixty", "black", "Recall-prove sixty cards", "Broad recall supports a game that can travel across the graph.", "Study Flashcards", 60, { snapshot: "recallCount" }),
  ngChallenge("black.lesson-twenty-five", "black", "Complete twenty-five lessons", "Wide curriculum coverage connects multiple grappling systems.", "Study the curriculum", 25, { snapshot: "lessonCount" }),
  ngChallenge("black.checkpoint-ten", "black", "Pass ten checkpoints", "Proof across many units shows durable coverage.", "Start a checkpoint", 10, { snapshot: "checkpointCount" }),
  ngChallenge("black.master-fifteen", "black", "Master fifteen technique decks", "Full recall across many decks demonstrates durable breadth.", "Study Flashcards", 15, { snapshot: "masteredDeckCount" }),
  ngChallenge("black.capstone-four", "black", "Clear four content capstones", "Multiple capstones demonstrate connected systems at several difficulties.", "Start a capstone", 4, { snapshot: "capstoneCount" }),
];

const NG_REWARD_COUNTERS = [
  ngChallenge("reward.guard-pull-three", null, "Pulled Guard Again", "", "", 3, {
    hidden: true,
    event: "commit",
    when: (p) => /guard.*pull|pull.*guard/i.test(p.technique || ""),
  }),
  ngChallenge("reward.sheet-twelve", null, "Oss and Found", "", "", 12, {
    hidden: true,
    event: "sheet_opened",
  }),
];

const NG_CHALLENGES = Object.freeze([
  ...NG_WHITE_CHALLENGES,
  ...NG_ADVANCED_CHALLENGES,
]);
const NG_ALL_CHALLENGES = Object.freeze([
  ...NG_CHALLENGES,
  ...NG_REWARD_COUNTERS,
]);
const NG_CHALLENGE_BY_ID = Object.freeze(
  Object.fromEntries(NG_ALL_CHALLENGES.map((item) => [item.id, item])),
);
const NG_SNAPSHOT_BEATS = new Set([
  "challenge_snapshot",
  "lesson_done",
  "checkpoint_passed",
  "recall_proven",
  "belt_test_won",
]);

const NG_BADGE_DEFINITIONS = Object.freeze([
  { id: "white-foundations", name: "White Foundations", detail: "Clear the White content track", sourceTrack: "white" },
  { id: "blue-connections", name: "Connected Game", detail: "Clear the Blue content track", sourceTrack: "blue" },
  { id: "purple-patterns", name: "Pattern Finder", detail: "Clear the Purple content track", sourceTrack: "purple" },
  { id: "brown-pressure", name: "Recall Under Pressure", detail: "Clear the Brown content track", sourceTrack: "brown" },
  { id: "black-breadth", name: "Broad Game", detail: "Clear the Black content track", sourceTrack: "black" },
  { id: "clean-checkpoint", name: "Clean Checkpoint", detail: "Pass a checkpoint on the first try", event: "checkpoint_passed", when: (p) => !!p.firstTry },
  { id: "thirty-from-memory", name: "Thirty From Memory", detail: "Recall-prove thirty cards", sourceChallenge: "brown.recall-thirty" },
]);

const NG_MAT_COINS = Object.freeze([
  { id: "houdini", name: "Houdini", detail: "Escape three submissions", sourceChallenge: "blue.escape-three" },
  { id: "pulled-guard-again", name: "Pulled Guard Again", detail: "Choose a guard-pull route three times", sourceChallenge: "reward.guard-pull-three" },
  { id: "frame-job", name: "Frame Job", detail: "Improve escape odds under pressure", event: "escape_odds_pumped" },
  { id: "tap-and-carry-on", name: "Tap and Carry On", detail: "Start another roll after a submission loss", sequence: "after-loss" },
  { id: "oss-and-found", name: "Oss and Found", detail: "Open twelve technique sheets", sourceChallenge: "reward.sheet-twelve" },
  { id: "research-position", name: "Research Position", detail: "Study three sheets before committing", sequence: "research" },
  { id: "godlike", name: "GODLIKE", detail: "Reach seven-move momentum", event: "combo", when: (p) => p.n >= 7 },
  { id: "berimbolo-briefly", name: "Berimbolo, Briefly", detail: "Attempt a Berimbolo route", event: "commit", when: (p) => /berimbolo/i.test(p.technique || "") },
]);
