// ANSWERS GIVEN BEFORE A COPY HAS SEEN THE CARD'S ROW (v1.280.2, NEXT2, ruled NEXT2-GO) — the journal and the replay in
// neural/src/progress-owner.src.js (`ngProgressReplay`, the host's `journal`, `replayCloud`, `delivered`, the tab merge and
// the guest join) and the app's writers that feed it (`_gradeKnowledge`, `_schedule`, `_gradeMove`).
//
// Until v1.280.2 a first right answer ([d+1, 1, d], the same row a miss writes) given before a device's first pull, offline,
// by a guest before signing in, or in a tab that never saw another tab's row, met the other copy in a merge that keeps the
// later answer, and a mature schedule became one day (proven in four places on v1.279.0). Now each owner keeps the
// answers this browser has not yet seen delivered, and where its copy meets another copy's rows those cards are rebuilt
// on the other copy's rows by the writer. Every answer here is given through the app's own writer and every sync runs
// through the app's own pull, push, save and join, against a FAKE CLOUD THAT HOLDS ROWS.
//
// INVARIANTS: a right answer never makes a card due sooner than the other copy had it; only an answer made on or after the
// other copy's last answer is replayed (NEXT2-R1): a miss made after it counts, a miss made before it is superseded by
// that later answer, as on dev, and an older answer never overrides a newer one; a stale one-day row never comes back
// (another tab's memory, the guest's copy at a second join); an entry leaves the journal only when a copy the cloud
// accepted or holds has exactly its row (never cleared too early, never applied twice); two devices converge in both
// orders; one owner's answers never reach another owner's rows except through the guest join, once; an older client
// receives ordinary rows; nothing is written on a passive boot; the journal never holds more than about 20 KB.
//
// MUTANTS (v1.280.2, and again at NEXT2-R1), each applied alone to a clean tree and run against this file; each turned the
// NAMED test red (and OLD, the reviewed head c05f399bc's own progress-owner and app, is red at every case of the read):
//   J1 the pull does not replay (`replayCloud` returns the merge)          → "P1 a new device…", "P2 an offline device…"
//   J2 the replay skips a miss                                             → "offline, a miss and then a right answer…"
//   J3 an entry the other copy holds is applied again (no in-copy check)  → "a push that fails keeps the entry…", "P1…"
//   J4 entries cleared at the pull whatever the cloud holds               → "a push that fails keeps the entry…"
//   J5 the tab merge does not replay                                       → "P4 a second tab…"
//   J6 the guest join does not replay                                      → "P3 a guest's first right answer…"
//   J8 the bound ignored                                                   → "the journal is capped…", "the journal is bounded…"
//   J9 a push's delivery taken without its rows (every entry cleared)      → "an answer given while a push is in flight…"
//   J10 an entry replayed though older than the other row's last (NEXT2-R1) → "an old guest miss never resets…"
//   J11 the taken guest rows ignored at a second join                      → "a second guest join keeps the account's row…"
//   J12 a row this tab did not touch does not yield to the stored row      → "two tabs: the tab that did not answer…"
//   J13 a stored row a replay superseded does not yield                    → "two tabs: the tab that did not answer…"
//   J15 a journal of another version read as empty (and written over)      → "a journal of a version this build does not know…"
//   J16 ids restarted at 1, not from the clock                             → "a journal of a version this build does not know…"
// NEXT2-R2 (the second look; OLD2, the reviewed head 052d58745's own code, is red at both of its cases):
//   J17 the replay's row always taken (D1's rule removed)                  → "two offline devices, only right answers…"
//   J19 the taken guest rows never written                                 → "a second guest join keeps…", "after any number of
//                                                                              guest joins an answer still rewrites…"
//   J20 D1's rule without its narrowing (later-due even when nothing was   → "a later right answer replayed onto another
//       set aside: this copy's own answer on the old row wins)                device's miss keeps the miss…"
// NOT KILLED, and why: J7 (the guest high-water `g` ignored) and J14 ("one more answer on top" counted as holding an entry,
// the relaxation NEXT2-R1 removed) leave every row as it is. Under the day rule a guest entry already taken in is older
// than, or of the same day as, the account's row, and a same-day replay changes nothing; an answer on top of an entry is
// later than it, so the entry is superseded rather than held. `g` stays as the cheaper guard; J14's form stays removed.
//
// Run: node --test tests/answers_before_sync.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ngProgressOwner, ngProgressLocalKey, ngProgressCreateHost, ngProgressJournalParse, NG_PROGRESS_JOURNAL_CAP } from "../neural/src/progress-owner.src.js";
import { ngKnowledgeScheduleRow, ngKnowledgeQuestionHash, ngKnowledgeMergeRow } from "../neural/src/knowledge-profile.src.js";
import { onestep } from "./_onestep_client.mjs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const strip = (t) => t.replace(/^export (function|const|let|var|class) /gm, "$1 ");
const deps = ["lists-codec", "lists", "belt", "knowledge-profile", "rating", "challenge-definitions", "challenge-engine"].map((n) => strip(read("../neural/src/" + n + ".src.js"))).join("\n");
const Component = new Function("DCLogic", "React", strip(read("../neural/src/progress-owner.src.js")) + "\n" + deps + "\n" + read("../neural/src/app.src.jsx") + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
const OLD = JSON.parse(read("./artifacts/schedule_old_client.json"));
const devSrsMerge = new Function("cloud", OLD.app.srsMerge);
const copy = (v) => JSON.parse(JSON.stringify(v));
const D = 20400;
const Q1 = "Which grip breaks the posture?", Q2 = "Where does the knee go?", H1 = ngKnowledgeQuestionHash(Q1), H2 = ngKnowledgeQuestionHash(Q2);
const MATURE = [D + 30, 60, D - 30];   // the other copy: a 60-day card answered 30 days ago, due in 30
const write = ngKnowledgeScheduleRow;

// A FAKE CLOUD THAT HOLDS ROWS: a push stores the blob (or, as asked, fails, or stores it and answers false)
function cloud(blob = null) {
  const c = { blob: blob && copy(blob), pushes: 0, mode: "ok", pulls: 0, pullFails: false };
  c.pull = async (id) => { c.pulls++; if (c.pullFails) throw new Error("offline"); return { userId: id, blob: c.blob && copy(c.blob) }; };
  c.push = async (b) => { c.pushes++; if (c.mode === "fail") return false; c.blob = copy(b); return c.mode !== "lost-answer"; };
  return c;
}
function memory() { const rows = new Map(); return { rows, getItem: (k) => rows.get(k) ?? null, setItem: (k, v) => rows.set(k, String(v)) }; }
function harness(mem, C) {
  let current, identity = null;
  const facade = { resolveNeuralUser: async () => identity, neuralSyncVersion: 2, isAuthenticated: () => true, pullNeural: (id) => C.pull(id), pushNeural: (b) => C.push(b) };
  const host = ngProgressCreateHost({ storage: mem, resolveUser: () => facade.resolveNeuralUser(), hold: () => {}, mount(boot) {
    const inst = new Component({}); current = inst; host.bind(inst, boot);
    inst._publishKnowledge = () => {}; inst._applyLayers = () => {}; inst._refreshChallengeEvidence = () => {}; inst.updateAccountUI = () => {};
    inst.track = () => {}; inst.fx = () => {}; inst._announceArrival = () => {}; inst._auth = () => facade; inst.isTest = () => true;
    inst.destroy = () => { if (inst.__ngDestroyed) return; inst.__ngDestroyed = true; inst._authDisposed = true; inst._invalidateCloudSync(); };
    inst._loadProgress();
  } });
  const signIn = (id) => { identity = { id, email: id + "@example.invalid" }; const old = current; old._applyUser(identity); current._applyUser(identity); return current; };
  return { host, facade, get: () => current, signIn, boot: () => host.bootstrap() };
}
async function fakeTimers(run) {
  const oldSet = globalThis.setTimeout, oldClear = globalThis.clearTimeout; let seq = 0; const q = new Map();
  globalThis.setTimeout = (fn) => { const id = ++seq; q.set(id, fn); return id; }; globalThis.clearTimeout = (id) => q.delete(id);
  try { return await run({ flush: async () => { for (let i = 0; i < 4 && q.size; i++) { const jobs = [...q.values()]; q.clear(); for (const fn of jobs) await fn(); } },
    drop: () => q.clear(), kick: () => { const jobs = [...q.values()]; q.clear(); for (const fn of jobs) fn(); } }); }
  finally { globalThis.setTimeout = oldSet; globalThis.clearTimeout = oldClear; }
}
async function withDay(day, run) {
  const had = Object.getOwnPropertyDescriptor(globalThis, "window");
  globalThis.window = { ...(had ? had.value : {}), __NG_EPOCH_DAY__: day };
  try { return await run(); } finally { if (had) Object.defineProperty(globalThis, "window", had); else delete globalThis.window; }
}
const blob = (extra = {}) => ({ v: 2, prep: {}, ...extra });
const journal = (mem, owner) => ngProgressJournalParse(mem.getItem(ngProgressLocalKey(owner, "pending")));
const A = ngProgressOwner("A"), GUEST = ngProgressOwner();
// answer through the app's own writers
const answer = (a, q, ok, deck = "d") => a._gradeKnowledge(deck, { q }, ok, "recall");
function answerMove(a, seat, mv, ok) {
  a._moveKey = () => [seat, mv]; a._sealCard = () => {}; a._moveState = () => "known";
  a._gradeMove({ node: { t: "x" }, threat: false, action: "move" }, ok, null);
}
// a pull or push already in flight settles before the next step (`_pullAndMerge` refuses while one is in flight)
const settle = () => new Promise((r) => setImmediate(r));
// boot an account on a browser and try its first pull (it lands unless the cloud is set to fail)
async function account(mem, C, flush, id = "A") { const h = harness(mem, C); await h.boot(); const a = h.signIn(id); await a._pullAndMerge(); await flush(); await settle(); return { h, a }; }
async function pull(a, flush) { await settle(); const ok = await a._pullAndMerge(); await flush(); await settle(); return ok; }

test("P1 a new device answers before its first pull lands: the card is rebuilt on the cloud's row, then delivered", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } }, stage: { d: { [H1]: 3 } }, moves: { "1/top": { m: MATURE.concat(1) } } }));
  C.pullFails = true;   // the first pull has not landed yet
  const { a } = await account(mem, C, flush); await flush();
  answer(a, Q1, true); answerMove(a, "1/top", "m", true); await settle();
  assert.deepEqual(a.srs.d[H1], [D + 1, 1, D], "on this copy alone: a first answer");
  assert.equal(journal(mem, A).e.length, 2, "both answers wait in the journal");
  C.pullFails = false;
  assert.equal(await pull(a, flush), true);
  const want = write(MATURE, true, D);
  assert.deepEqual(a.srs.d[H1], want, "the writer on the cloud's row: never sooner than the cloud had it, its credit earned");
  assert.ok(want[0] > MATURE[0]);
  // the moves row through the same writer, its Yes at [3] and the schedule's pair after it (v1.281.0)
  assert.deepEqual(a.moves["1/top"].m, write(MATURE.concat(1), true, D, 4), "the hidden move the same, its Yes kept");
  assert.equal(a.moves["1/top"].m[3], 1);
  assert.equal(a.stage.d[H1], 3, "the stage is a MAX, as before");
  assert.deepEqual(C.blob.srs.d[H1], want, "and that is what the cloud holds");
  assert.equal(journal(mem, A).e.length, 0, "delivered: the push that carried them cleared them");
})));

test("a miss made on or after the other copy's last answer counts; one made before it is superseded by that answer, as on dev", () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE, [H2]: MATURE } } }));
  let a;
  await withDay(D, async () => {
    C.pullFails = true;
    a = (await account(mem, C, flush)).a;
    answer(a, Q1, false);   // a miss on day D, before the pull
    answer(a, Q2, false); await settle();   // another, on a card another device answers right the next day
  });
  C.blob.srs.d[H2] = write(MATURE, true, D + 1);
  await withDay(D + 2, async () => {   // the pull lands two days later
    C.pullFails = false;
    assert.equal(await pull(a, flush), true);
    assert.deepEqual(a.srs.d[H1], [D + 1, 1, D], "made after the cloud's last answer: back to one day");
    assert.deepEqual(a.srs.d[H2], write(MATURE, true, D + 1), "made before the other device's later answer: superseded by it");
    assert.deepEqual(C.blob.srs.d[H2], write(MATURE, true, D + 1));
    assert.equal(journal(mem, A).e.length, 0, "the miss reached the cloud; the superseded one left the journal at the pull");
  });
}));

test("offline, a miss and then a right answer: the miss stands, the right answer climbs from one day (the heal no longer erases it)", () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  let a;
  await withDay(D, async () => { C.pullFails = true; a = (await account(mem, C, flush)).a; answer(a, Q1, false); await settle(); });
  await withDay(D + 1, async () => { answer(a, Q1, true); await settle(); });
  await withDay(D + 2, async () => {
    C.pullFails = false;
    assert.equal(await pull(a, flush), true);
    // merged by the rule alone, the later right answer [D+4, 3, D+1] would heal to the cloud's 60 days and erase the miss
    assert.deepEqual(a.srs.d[H1], write([D + 1, 1, D], true, D + 1), "rebuilt: the miss, then one rung from one day");
    assert.deepEqual(C.blob.srs.d[H1], write([D + 1, 1, D], true, D + 1));
  });
}));

test("P2 an offline device: rebuilt on the newer cloud row two days later, from a stale row and from none", () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: [D - 4, 14, D - 18] } } }));
  await withDay(D - 10, async () => { const { a } = await account(mem, C, flush); await flush(); assert.deepEqual(a.srs.d[H1], [D - 4, 14, D - 18]); });
  // another device takes the card to 60 days; this one is offline and answers both cards on day D
  C.blob = blob({ srs: { d: { [H1]: MATURE, [H2]: MATURE } } });
  await withDay(D, async () => {
    C.pullFails = true; const { a } = await account(mem, C, flush);
    answer(a, Q1, true); answer(a, Q2, true); await settle();
    assert.equal(a.srs.d[H1][1], 30, "from its stale 14 days, on time: 30");
    C.pullFails = false;
  });
  await withDay(D + 2, async () => {   // the pull lands two days later
    const { a } = await account(mem, C, flush);
    assert.deepEqual(a.srs.d[H1], write(MATURE, true, D), "the stale row's answer, rebuilt on the cloud's 60 days");
    assert.deepEqual(a.srs.d[H2], write(MATURE, true, D), "a first answer, the same");
    assert.equal(journal(mem, A).e.length, 0);
  });
}));

// v1.281.0 (LIN1): the app's own moves writer on a row between steps keeps the answer at [3], where `_moveMastered` reads the
// Yes, and the schedule's pair after it, exactly as the writer builds it for a moves row
test("the app's moves writer on a card between steps: the Yes at [3], the pair after it", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({}));
  const { a } = await account(mem, C, flush); await flush();
  const prior = [D + 20, 30, D - 10, 1];   // a 30-day card answered 10 days ago: answered today it is early, so between steps
  a.moves = { "1/top": { m: prior.slice() } };
  answerMove(a, "1/top", "m", true); await settle();
  const row = a.moves["1/top"].m;
  assert.deepEqual(row, [D + 40, 30, D, 1, 30, D - 10], "40 days, the pair [30, its last full step's day] after the Yes");
  assert.deepEqual(row, write(prior, true, D, 4));
  assert.equal(row[3], 1, "the Yes where _moveMastered reads it");
  assert.equal(a._moveMastered({}), true);
  answerMove(a, "1/top", "m", false); await settle();
  assert.deepEqual(a.moves["1/top"].m, [D + 1, 1, D, 0], "a No: 1 day, no pair");
})));

// v1.281.0 (LIN1): the other copy's row sits between steps (its pair at the end). The replay reads that pair, so the card
// is rebuilt by the writer exactly as one copy holding both answers would have it, and the entry is delivered on that row
test("P1 on a card between steps: the cloud's pair is read by the replay, and the entry is delivered on the exact row", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  // a 14-day card answered early, 5 days in: 19.714… days, a pair (v1.281.3: a card whose exact interval is whole, as a 30-day
  // card's 40 days 10 days in, reads the same rung line from its own due, so only a pair off a whole day changes the answer)
  const BETWEEN = write([D - 4, 14, D - 18], true, D - 13);
  assert.equal(BETWEEN.length, 5);
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: BETWEEN } }, moves: { "1/top": { m: BETWEEN.slice(0, 3).concat(1, BETWEEN.slice(3)) } } }));
  C.pullFails = true;
  const { a } = await account(mem, C, flush); await flush();
  answer(a, Q1, true); answerMove(a, "1/top", "m", true); await settle();
  C.pullFails = false;
  assert.equal(await pull(a, flush), true);
  const want = write(BETWEEN, true, D);
  assert.notDeepEqual(want, write(BETWEEN.slice(0, 3), true, D), "the pair changes the answer: a fixture that can fail");
  assert.deepEqual(a.srs.d[H1], want, "the writer on the cloud's row, its pair read");
  assert.deepEqual(a.moves["1/top"].m, write(BETWEEN.slice(0, 3).concat(1, BETWEEN.slice(3)), true, D, 4), "and the move's, its pair at [4]");
  assert.deepEqual(C.blob.srs.d[H1], want, "the cloud holds it");
  await pull(a, flush);
  assert.equal(journal(mem, A).e.length, 0, "both entries delivered on their exact rows");
})));

test("P3 a guest's first right answer joins an account that holds the card mature: rebuilt, then the account delivers it", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } }, moves: { "1/top": { m: MATURE.concat(1) } }, prep: { d: 5 } }));
  const h = harness(mem, C); await h.boot(); const g = h.get();
  answer(g, Q1, true); answerMove(g, "1/top", "m", true); g._flushSave(); await flush();
  assert.equal(journal(mem, GUEST).e.length, 2, "the guest's answers wait in the guest's journal");
  const a = h.signIn("A"); await pull(a, flush);
  const want = write(MATURE, true, D);
  assert.deepEqual(a.srs.d[H1], want, "the account's card: the guest's answer applied to it");
  assert.deepEqual(a.moves["1/top"].m, write(MATURE.concat(1), true, D, 4));
  assert.deepEqual(C.blob.srs.d[H1], want);
  assert.equal(journal(mem, A).e.length, 0, "taken in, then delivered by the account's push");
  assert.ok(journal(mem, A).g > 0, "the account remembers the guest answers it has taken in");
  assert.equal(Object.keys(JSON.parse(mem.getItem(ngProgressLocalKey(A, "taken"))).t).length, 2, "and the guest rows it took, card by card, under their own key");
  assert.equal(journal(mem, GUEST).e.length, 0, "the guest's entries leave its journal once the account's cloud holds what they rebuilt");
  const guestCopy = JSON.parse(mem.getItem(ngProgressLocalKey(GUEST))).blob;
  assert.deepEqual(guestCopy.srs.d[H1], [D + 1, 1, D], "the guest's copy stays as it was (signing out still plays it)");
})));

test("a guest copy that joins twice (the guest played again) applies only its new answers", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE, [H2]: MATURE } } }));
  const h = harness(mem, C); await h.boot(); const g = h.get();
  answer(g, Q1, false); g._flushSave(); await flush();       // the guest misses Q1
  let a = h.signIn("A"); await pull(a, flush);
  assert.deepEqual(a.srs.d[H1], [D + 1, 1, D]);
  // the account answers Q1 right twice and syncs (no one-answer step leads back to the guest's row any more); then,
  // signed out, the guest plays Q2; then signs in again
  await withDay(D + 1, async () => { answer(a, Q1, true); a._flushSave(); await flush(); await settle(); });
  await withDay(D + 4, async () => { answer(a, Q1, true); a._flushSave(); await flush(); await settle(); });
  const after = copy(C.blob.srs.d[H1]);
  assert.deepEqual(after, write(write([D + 1, 1, D], true, D + 1), true, D + 4));
  const h2 = harness(mem, C); await h2.boot(); const g2 = h2.get();
  await withDay(D + 4, async () => { answer(g2, Q2, true); g2._flushSave(); await flush(); a = h2.signIn("A"); await pull(a, flush); });
  assert.deepEqual(a.srs.d[H1], after, "the guest's old miss is not counted a second time");
  assert.deepEqual(a.srs.d[H2], write(MATURE, true, D + 4), "its new answer is");
})));

test("P4 a second tab that never saw the other tab's row: rebuilt on it at its save", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(null);
  const h1 = harness(mem, C); await h1.boot(); const t1 = h1.get();
  const h2 = harness(mem, C); await h2.boot(); const t2 = h2.get();   // tab 2 opens on a copy without the card
  t1.srs = { d: { [H1]: MATURE.slice() } }; t1._flushSave(); await flush();
  answer(t2, Q1, true); t2._flushSave(); await flush();               // tab 2 answers it from no row
  const stored = JSON.parse(mem.getItem(ngProgressLocalKey(GUEST))).blob;
  assert.deepEqual(stored.srs.d[H1], write(MATURE, true, D), "the browser's copy: tab 2's answer on tab 1's row");
  assert.deepEqual(t2.srs.d[H1], write(MATURE, true, D));
})));

test("a push that fails keeps the entry: the next pull applies it once, on what the cloud then holds", () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  let a;
  await withDay(D, async () => {
    C.pullFails = true;
    a = (await account(mem, C, flush)).a;
    answer(a, Q1, false); await settle();   // a miss, offline
    C.pullFails = false; C.mode = "fail";
    assert.equal(await pull(a, flush), true, "the pull lands; its push fails");
    assert.deepEqual(C.blob.srs.d[H1], MATURE, "the cloud never got the miss");
    assert.equal(journal(mem, A).e.length, 1, "so the miss stays in the journal");
  });
  // a device offline since the day before syncs its own right answer of the card, given on day D-1
  C.blob.srs.d[H1] = write(MATURE, true, D - 1);
  await withDay(D + 2, async () => {
    C.mode = "ok";
    assert.equal(await pull(a, flush), true);
    assert.deepEqual(C.blob.srs.d[H1], [D + 1, 1, D], "the miss, once, on the row the cloud then held (its last answer was earlier)");
    assert.equal(journal(mem, A).e.length, 0);
  });
}));

test("an answer given while a push is in flight stays until a copy holds it", () => fakeTimers(async ({ flush, kick, drop }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  let a, open;
  await withDay(D, async () => {
    a = (await account(mem, C, flush)).a;
    const push = C.push; let gate; C.push = async (b) => { await new Promise((r) => { gate = r; }); return push(b); };
    answer(a, Q1, true); kick(); await settle();   // its push starts, and waits at the server
    open = gate;
    answer(a, Q2, true);                             // given while that push is in flight: Q2 is not in the copy it carries
    C.push = push; open(); await settle(); await settle();
    assert.deepEqual(C.blob.srs.d[H1], write(MATURE, true, D), "the first push landed");
    assert.equal(C.blob.srs.d[H2], undefined, "without the second answer");
    drop();                                          // and the second answer's own push never runs (the tab closed)
  });
  // another device, which has held Q2 at 60 days, syncs it after that push
  C.blob.srs.d[H2] = MATURE.slice();
  await withDay(D + 1, async () => {
    assert.equal(await pull(a, flush), true);
    assert.deepEqual(a.srs.d[H2], write(MATURE, true, D), "the answer given during the push is rebuilt on the other device's row, never lost to a one-day row");
  });
}));

test("a push that landed but answered false is not applied twice: the cloud's row proves it", () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  await withDay(D, async () => {
    const { a } = await account(mem, C, flush); await flush();
    C.mode = "lost-answer";
    answer(a, Q1, false); await flush(); await settle();   // stored at the server, answered false
    assert.deepEqual(C.blob.srs.d[H1], [D + 1, 1, D]);
    assert.equal(journal(mem, A).e.length, 1);
    C.mode = "ok";
  });
  // the next day another device answers it right (from the cloud's row, which holds the miss); then this device pulls
  C.blob.srs.d[H1] = write([D + 1, 1, D], true, D + 1);
  await withDay(D + 1, async () => {
    const { a } = await account(mem, C, flush);
    assert.deepEqual(a.srs.d[H1], write([D + 1, 1, D], true, D + 1), "the miss is not counted a second time over the other device's answer");
  });
}));

test("an app closed between the answer and its push: the answer is delivered at the next session's pull", () => withDay(D, () => fakeTimers(async ({ flush, drop }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  C.pullFails = true;
  const { a } = await account(mem, C, flush); await flush();
  answer(a, Q1, true); await settle(); drop();   // closed before any push
  C.pullFails = false;
  const { a: b } = await account(mem, C, flush);
  assert.deepEqual(b.srs.d[H1], write(MATURE, true, D));
  assert.deepEqual(C.blob.srs.d[H1], write(MATURE, true, D));
  assert.equal(journal(mem, A).e.length, 0);
})));

test("a push that succeeds while another tab pushed an older copy: nothing is lost", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  const t1 = (await account(mem, C, flush)).a; await flush();
  const t2 = (await account(mem, C, flush)).a; await flush();
  const older = copy(C.blob);
  answer(t2, Q1, false); await flush(); await settle();   // tab 2's push delivers the miss: the cloud holds it, the entry goes
  assert.equal(journal(mem, A).e.length, 0);
  C.blob = older;                         // ...then tab 1's older push lands over it
  assert.equal(await pull(t1, flush), true);
  assert.deepEqual(t1.srs.d[H1], [D + 1, 1, D], "the browser's copy still holds the miss, the later answer, and pushes it again");
  assert.deepEqual(C.blob.srs.d[H1], [D + 1, 1, D]);
})));

test("two devices converge in both orders, each with an answer the other has not seen", () => fakeTimers(async ({ flush }) => {
  for (const order of [["X", "Y"], ["Y", "X"]]) {
    const C = cloud(blob({ srs: { d: { [H1]: MATURE } } })), dev = { X: memory(), Y: memory() }, app = {};
    await withDay(D - 1, async () => { for (const n of ["X", "Y"]) { app[n] = (await account(dev[n], C, flush)).a; await flush(); } });
    await withDay(D, async () => {
      C.pullFails = true;
      answer(app.X, Q1, true); answer(app.Y, Q1, false); await settle();   // offline, both answer the card: X right, Y wrong
      C.pullFails = false;
      for (const n of order) await pull(app[n], flush);
      for (const n of order) await pull(app[n], flush);
      assert.deepEqual(app.X.srs.d[H1], app.Y.srs.d[H1], `order ${order}: both devices hold one row`);
      assert.deepEqual(app.X.srs.d[H1], [D + 1, 1, D], `order ${order}: the miss counts`);
    });
  }
}));

test("one owner's answers never reach another owner's rows", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  C.pullFails = true;
  const { a } = await account(mem, C, flush);
  answer(a, Q1, false); await settle();   // account A misses the card, offline
  // A signs out; account B signs in on the same browser, its cloud holding the card mature
  const B = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  const { a: b } = await account(mem, B, flush, "B");
  assert.deepEqual(b.srs.d[H1], MATURE, "B's card is B's");
  assert.equal(journal(mem, ngProgressOwner("B")).e.length, 0);
  assert.equal(journal(mem, A).e.length, 1, "A's miss waits for A");
})));

test("the journal is capped: beyond it the oldest answers meet other copies by the merge's rule", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  C.pullFails = true;
  const { a } = await account(mem, C, flush); await flush();
  answer(a, Q1, true); await settle();
  const rows = Array.from({ length: NG_PROGRESS_JOURNAL_CAP }, (_, i) => [0, "filler", "q" + i, 1, D, [D + 1, 1, D]]);
  a._journal(rows);
  const j = journal(mem, A);
  assert.equal(j.e.length, NG_PROGRESS_JOURNAL_CAP);
  assert.ok(!j.e.some((e) => e[3] === H1), "the oldest went");
  C.pullFails = false;
  assert.equal(await pull(a, flush), true);
  assert.deepEqual(a.srs.d[H1], [D + 1, 1, D], "that card met the cloud by the merge's rule, as before v1.280.2");
})));

test("nothing is written on a passive boot, and an older client receives ordinary rows", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  const { a } = await account(mem, C, flush); await flush();
  assert.equal(mem.getItem(ngProgressLocalKey(A, "pending")), null, "no journal written by a boot and a pull");
  C.pullFails = true; answer(a, Q1, true); await settle(); C.pullFails = false;
  await pull(a, flush);
  const pushed = C.blob;
  assert.ok(!JSON.stringify(pushed).includes("pending"), "the journal never rides the blob");
  // ordinary rows: the three cells every client reads, then (v1.281.0) the schedule's pair while a card is between steps
  assert.ok(Object.values(pushed.srs.d).every((r) => (r.length === 3 || r.length === 5) && r.every((x) => Number.isFinite(x) && x >= 0)), "ordinary rows");
  assert.equal(pushed.srs.d[H1].length, 5, "this answer came early: the card sits between steps");
  // dev's own pull (captured) of what was pushed, against its copy of the mature row: an ordinary merge, never sooner; it
  // keeps the three cells and drops the pair, so the row reads as anchored at its last there
  const dev = { srs: { d: { [H1]: MATURE.slice() } }, _epochDay: () => D };
  devSrsMerge.call(dev, { srs: copy(pushed.srs) });
  assert.ok(dev.srs.d[H1][0] >= MATURE[0]);
  assert.deepEqual(dev.srs.d[H1], pushed.srs.d[H1].slice(0, 3));
})));

// v1.305.0 (LATE1): a late right answer earns max(one step, twice the days since the last answer). Its row is an ordinary
// row (three cells, the pair while not whole), so every merge reads it; what must hold is that the LATER answer is never
// lost, whichever build meets it, through this build's own pull against a fake cloud that holds rows, and through the
// one-step client's merge (v1.281.3 to v1.304.0, captured: tests/artifacts/schedule_onestep_client.json) and v1.278.2's
test("a late answer's doubled wait meets an older client's row: the later answer is kept, by this build's pull and by the older clients' merges (LATE1)", () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } }, stage: { d: { [H1]: 3 } } }));
  let X;
  await withDay(D, async () => { X = (await account(mem, C, flush)).a; });   // synced: it holds the 60-day row
  // an older device answers the card on day D + 40 (10 days late: one step, 90 days) and its push lands
  const older = onestep.write(MATURE, true, D + 40);
  assert.deepEqual(older, [D + 130, 60, D + 40], "premise: the one-step client's late answer");
  C.blob.srs.d[H1] = older;
  // this device, offline, answers it on day D + 60: on its own copy, twice the 90 days since the last answer it knows
  await withDay(D + 60, async () => { C.pullFails = true; C.mode = "fail"; answer(X, Q1, true); await flush(); await settle(); });
  assert.deepEqual(C.blob.srs.d[H1], older, "premise: offline, its push never landed");
  assert.deepEqual(X.srs.d[H1], [D + 240, 120, D + 60, 0, 0, 90, 180], "on this copy alone: 180 days (its late mark: the one-step 90)");
  // it comes online the same day: its answer is replayed on the cloud's newer row, in time order: 20 days after the other
  // device's answer and before that row's due, so EARLY there (20 days up the 90-day rung's line: 110), never the 180 its
  // stale copy gave (the doubled wait counts from the last answer, and the replay knows it)
  await withDay(D + 60, async () => { C.pullFails = false; C.mode = "ok"; assert.equal(await pull(X, flush), true); });
  const want = write(older, true, D + 60);
  assert.deepEqual(want, [D + 170, 60, D + 60, 90, D + 40], "in time order: early on the newer row, 110 days");
  assert.deepEqual([X.srs.d[H1], C.blob.srs.d[H1]], [want, want], "the later answer is kept, and the cloud holds it");
  // the older clients pull it against their own older row: the later answer wins there too, never sooner
  for (const local of [older, MATURE]) {
    assert.deepEqual(onestep.merge(local.slice(), copy(C.blob.srs.d[H1]), D + 60), want, `the one-step client's merge, its row ${local}`);
    const dev = { srs: { d: { [H1]: local.slice() } }, _epochDay: () => D + 60 };
    devSrsMerge.call(dev, { srs: copy(C.blob.srs) });
    assert.deepEqual(dev.srs.d[H1], want.slice(0, 3), `v1.278.2's merge, its row ${local}`);
  }
  // the same day: the one-step client's own late answer (one step, 90 days) against this build's doubled one (120 days):
  // its merge keeps the longer interval (the heal), both orders, and so does this build's
  const mine = write(MATURE, true, D + 30), theirs = onestep.write(MATURE, true, D + 30);
  assert.deepEqual([mine, theirs], [[D + 150, 120, D + 30, 0, 0, 90, 120], [D + 120, 60, D + 30]], "premise: 120 days (marked: one step was 90) and 90 days");
  // (v1.305.0's late mark rides through this build's merge; the one-step client's keeps the schedule and drops the cells after
  // the pair, so there the row reads uncorrected: knowledge-profile.src.js, `ngKnowledgeMark`, NOT COVERED)
  for (const [merge, want] of [[onestep.merge, mine.slice(0, 3)], [ngKnowledgeMergeRow, mine]]) {
    assert.deepEqual(merge(theirs.slice(), mine.slice(), D + 30), want, "the older copy pulls the doubled row: kept");
    assert.deepEqual(merge(mine.slice(), theirs.slice(), D + 30), want, "the doubled copy pulls the older row: kept");
  }
}));

// ── NEXT2-R1: the independent read of PR #418 (its findings 1, 2, 3, 6, 8, as cases) ──────────────────────────────────

test("an old guest miss never resets a card an account has answered since (finding 1, a regression against dev)", () => fakeTimers(async ({ flush }) => {
  const mem = memory();
  await withDay(D - 100, async () => {   // a guest misses Q1, a hundred days ago
    const h = harness(mem, cloud(null)); await h.boot(); const g = h.get();
    answer(g, Q1, false); g._flushSave(); await flush();
  });
  // account B answered Q1 right thirty days ago, at 60 days, and signs in on this browser
  const CB = cloud(blob({ srs: { d: { [H1]: MATURE } }, stage: { d: { [H1]: 3 } } }));
  await withDay(D, async () => {
    const h = harness(mem, CB); await h.boot(); const b = h.signIn("B"); await pull(b, flush);
    assert.deepEqual(b.srs.d[H1], MATURE, "B's later answer stands: the older miss meets it by the merge's rule, as on dev");
    assert.deepEqual(CB.blob.srs.d[H1], MATURE);
  });
}));

test("a second guest join keeps the account's row of a card it took in (finding 3), the same day and later", () => fakeTimers(async ({ flush }) => {
  for (const later of [0, 3]) {
    const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE, [H2]: MATURE } }, stage: { d: { [H1]: 3 } } }));
    let first;
    await withDay(D, async () => {
      const h = harness(mem, C); await h.boot(); const g = h.get();
      answer(g, Q1, true); g._flushSave(); await flush();            // the guest answers Q1 right, then signs in
      const a = h.signIn("A"); await pull(a, flush);
      first = copy(C.blob.srs.d[H1]);
      assert.deepEqual(first, write(MATURE, true, D));
    });
    await withDay(D + later, async () => {
      const h2 = harness(mem, C); await h2.boot(); const g2 = h2.get();   // signed out, the guest plays Q2
      answer(g2, Q2, true); g2._flushSave(); await flush();
      const a = h2.signIn("A"); await pull(a, flush);                     // and signs in again
      assert.deepEqual(a.srs.d[H1], first, `D+${later}: the guest's old one-day row of Q1 does not come back`);
      assert.deepEqual(C.blob.srs.d[H1], first);
      assert.deepEqual(a.srs.d[H2], write(MATURE, true, D + later), "its new answer is taken in");
    });
  }
}));

test("two tabs: the tab that did not answer pulls first, and the one-day row never comes back (finding 2, both variants)", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  for (const variant of ["tab 2 opens after the answer", "tab 2 open before the answer"]) {
    const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } }, stage: { d: { [H1]: 3 } } }));
    C.pullFails = true;
    let t2;
    const t1 = (await account(mem, C, flush)).a;                       // tab 1: its pull has not landed
    if (variant.includes("before")) t2 = (await account(mem, C, flush)).a;
    answer(t1, Q1, true); await flush(); await settle();                // tab 1 answers the mature card right
    C.pullFails = false;
    if (!t2) t2 = (await account(mem, C, flush)).a; else await pull(t2, flush);   // tab 2's pull lands first
    const want = write(MATURE, true, D);
    assert.deepEqual(C.blob.srs.d[H1], want, `${variant}: tab 2 rebuilt it on the cloud's row`);
    answer(t1, Q2, true); await flush(); await settle();                // tab 1 answers another card: its save meets tab 2's copy
    await pull(t1, flush); await pull(t2, flush);
    assert.deepEqual(C.blob.srs.d[H1], want, `${variant}: the cloud keeps it`);
    assert.deepEqual([t1.srs.d[H1], t2.srs.d[H1]], [want, want], `${variant}: both tabs hold it`);
  }
})));

test("a journal of a version this build does not know is never written over; a damaged guest journal never reuses an id", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE, [H2]: MATURE } } }));
  const later = JSON.stringify({ v: 2, entries: ["a later build's"] });
  mem.setItem(ngProgressLocalKey(A, "pending"), later);
  C.pullFails = true;
  const { a } = await account(mem, C, flush);
  answer(a, Q1, true); await settle();
  assert.equal(mem.getItem(ngProgressLocalKey(A, "pending")), later, "left alone: nothing journaled for this owner");
  C.pullFails = false; await pull(a, flush);
  assert.equal(mem.getItem(ngProgressLocalKey(A, "pending")), later, "and nothing replayed or rewritten at the pull");
  // the guest's journal: an account took in a guest answer (its high-water `g`); the guest journal is then damaged
  const mem2 = memory(), C2 = cloud(blob({ srs: { d: { [H1]: MATURE, [H2]: MATURE } } }));
  const h = harness(mem2, C2); await h.boot(); const g = h.get();
  answer(g, Q1, true); g._flushSave(); await flush();
  let b = h.signIn("A"); await pull(b, flush);
  const high = journal(mem2, A).g;
  mem2.setItem(ngProgressLocalKey(GUEST, "pending"), "{damaged");
  const h2 = harness(mem2, C2); await h2.boot(); const g2 = h2.get();
  answer(g2, Q2, true); g2._flushSave(); await flush();
  assert.ok(journal(mem2, GUEST).e[0][0] > high, "the replaced journal's first id is above every id already taken");
  b = h2.signIn("A"); await pull(b, flush);
  assert.deepEqual(b.srs.d[H2], write(MATURE, true, D), "so the account takes the guest's new answer in");
})));

test("the journal is bounded: an answer never rewrites more than about 20 KB", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({ srs: { d: { [H1]: MATURE } } }));
  C.pullFails = true;
  const { a } = await account(mem, C, flush);
  const deck = "Submissions/Rear Naked Choke from Back Control|Attacker";   // a long deck key, as the wire has them
  a._journal(Array.from({ length: NG_PROGRESS_JOURNAL_CAP + 50 }, (_, i) => [0, deck, ngKnowledgeQuestionHash("q" + i), 1, D, [D + 241, 120, D]]));
  const raw = mem.getItem(ngProgressLocalKey(A, "pending"));
  assert.equal(journal(mem, A).e.length, NG_PROGRESS_JOURNAL_CAP);
  assert.ok(raw.length <= 21000, `${raw.length} characters at the bound`);
})));

// ── NEXT2-R2: the second look at PR #418 (its findings D1 and D3, as cases) ────────────────────────────────────────────

// v1.305.0 (LATE1): a late right answer earns the larger of one step and twice the days since the last answer THE COPY KNOWS.
// X, offline, never saw Y's answers, so its answer doubles the whole wait since c0's last answer, and in "short" and "long"
// that beats Y's two answers in time order: the merge keeps the longer interval (its heal), so the card ends AHEAD of the
// in-order copy (short: 8 days where in order 7; long: 300 where in order 210.83), never behind. That over-credit is the
// rule meeting a copy that had not synced (NOT COVERED here: nothing on X can know Y's answers). "rung 180" is the case where
// Y's two answers still earn more than X's one (the step from 181.03 is 367.03, X's doubled wait 366): there the card keeps
// what Y's answers earned only through D1's rule, so J17 stays red here
test("two offline devices, only right answers, the other device syncs first: no step is lost (D1, short and long)", () => fakeTimers(async ({ flush }) => {
  for (const [name, c0, yDays, xDay] of [["short", [D + 1, 1, D], [D + 1, D + 4], D + 4], ["long", [D, 60, D - 60], [D, D + 90], D + 90],
    ["rung 180", [D + 180, 120, D], [D + 1, D + 183], D + 183]]) {
    const C = cloud(blob({ srs: { d: { [H1]: c0 } }, stage: { d: { [H1]: 3 } } })), memX = memory(), memY = memory();
    let X, Y;
    await withDay(c0[2], async () => { X = (await account(memX, C, flush)).a; Y = (await account(memY, C, flush)).a; });   // both synced
    C.pullFails = true; C.mode = "fail";   // then both offline: no pull, no push
    for (const d of yDays) await withDay(d, async () => { answer(Y, Q1, true); await flush(); await settle(); });
    await withDay(xDay, async () => { answer(X, Q1, true); await flush(); await settle(); });
    // one copy that saw every answer in time order: Y's two, then X's of the same day as Y's second
    const ideal = write(write(write(c0, true, yDays[0]), true, yDays[1]), true, xDay), stale = write(c0, true, xDay);
    C.pullFails = false; C.mode = "ok";
    await withDay(xDay, async () => { for (const dev of [X, Y, X, Y]) await pull(dev, flush); });
    // the later due of the two: the in-order copy's, or X's doubled wait when it is longer (short, long)
    const kept = stale[0] > ideal[0] ? stale : ideal;
    assert.deepEqual(kept === stale ? "stale" : "ideal", { short: "stale", long: "stale", "rung 180": "ideal" }[name], `${name}: premise`);
    assert.ok(C.blob.srs.d[H1][0] >= ideal[0], `${name}: no step is lost: due ${C.blob.srs.d[H1][0]}, in order ${ideal[0]}`);
    assert.deepEqual(C.blob.srs.d[H1], kept, `${name}: the card keeps the step Y's right answers earned, or X's longer doubled wait`);
    assert.deepEqual([X.srs.d[H1], Y.srs.d[H1]], [kept, kept], `${name}: both devices hold it`);
  }
}));

test("after any number of guest joins an answer still rewrites no more than about 20 KB (D3)", () => withDay(D, () => fakeTimers(async ({ flush }) => {
  const mem = memory(), C = cloud(blob({})), deck = "Submissions/Rear Naked Choke from Back Control|Attacker";
  let a;
  for (let round = 0; round < 3; round++) {   // a guest answers 180 new cards, then signs in: three times
    const h = harness(mem, C); await h.boot(); const g = h.get();
    for (let i = 0; i < 180; i++) g._gradeKnowledge(deck, { q: `round ${round} question ${i}` }, true, "recall");
    g._flushSave(); await flush(); await settle();
    a = h.signIn("A"); await pull(a, flush);
  }
  assert.ok(Object.keys(JSON.parse(mem.getItem(ngProgressLocalKey(A, "taken"))).t).length >= 500, "the taken rows are kept, under their own key");
  C.pullFails = true;
  answer(a, Q1, true); await settle();
  const raw = mem.getItem(ngProgressLocalKey(A, "pending"));
  assert.ok(raw.length <= 21000, `one answer rewrites ${raw.length} characters`);
})));

test("a later right answer replayed onto another device's miss keeps the miss: nothing set aside, the replay stands (D1's rule, narrowed)", () => fakeTimers(async ({ flush }) => {
  // Z answers right and then misses on day D, offline; X, offline on the old 60-day row, answers right on day D+1. Z syncs
  // first. X's one answer is later than Z's miss, so it is replayed onto it: the miss counts, and X's answer climbs from one
  // day. Preferring the later-due merge row here (X's answer on the old row) would hide the card for 74 days.
  const C = cloud(blob({ srs: { d: { [H1]: MATURE } }, stage: { d: { [H1]: 3 } } })), memX = memory(), memZ = memory();
  let X, Z;
  await withDay(D - 1, async () => { X = (await account(memX, C, flush)).a; Z = (await account(memZ, C, flush)).a; });
  C.pullFails = true; C.mode = "fail";
  await withDay(D, async () => { answer(Z, Q1, true); answer(Z, Q1, false); await flush(); await settle(); });
  await withDay(D + 1, async () => { answer(X, Q1, true); await flush(); await settle(); });
  C.pullFails = false; C.mode = "ok";
  await withDay(D + 1, async () => { for (const dev of [Z, X, Z, X]) await pull(dev, flush); });
  assert.deepEqual(C.blob.srs.d[H1], write([D + 1, 1, D], true, D + 1), "Z's miss, then X's right answer: three days");
}));
