import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * WHERE THE ROLL STARTS — the `startFrom` setting (v1.165.0; "My weak spots" shipped v1.166.0).
 *
 * Owner: "the user can select how it starts, whether to start from random, from standing, or from
 * the position most beneficial for the user to learn to complement his game. … or something that
 * feels personal like my weak spots." And on what a weak spot IS (2026-09-02): a crack is a DECK —
 * a position family or a technique family, WITH A SEAT — and the roll opens on the STATE where
 * that crack lives, on that seat. Same list as the pane's "N weak spots", through the same seam
 * (`weakSpots()`), mapped to (posId, role) by `_weakStates` (§6.6 — never `startPosTraffic`,
 * which is top-only) and drawn ONCE per roll, weighted by each crack's FLOW gain.
 *
 * Three pills in Settings → Rolling, ALL live: Standing · Anywhere (default) · My weak spots.
 *
 * The claims, each with the mutant that kills it:
 *   1. the row ships, ALL THREE pills live: `weak` writes and re-renders, the
 *      note names the live spot, no "coming soon" text anywhere in the modal — lock the pill again
 *   2. Standing opens EVERY roll on standing-position; Anywhere does not     — delete the branch
 *      …and the `start-pos` draw is still consumed, one per roll, either way — drop the rng() call
 *   3. the test rail (`rigStart`) outranks the setting                       — reorder the branches
 *   4. a wire without a playable standing position falls back LOUDLY         — delete the fx()
 *   5. flipping it changes nothing earned, and emits no gameplay beat        — fx() in the onClick
 *   6. a weak roll opens on the published window's row, on ITS seat, and the
 *      seat is the wire's own field                                          — role not overridden
 *   7. a bottom-seat spot seats you bottom over a rigged top role draw       — role not overridden
 *   8. the draw is weighted by FLOW gain, not uniform                        — uniform window
 *   9. an empty ranking falls back LOUDLY, without spending a draw           — delete the fx()
 *  10. two cracks in one state count once (weight dropped, never doubled),
 *      and a Defender crack seats you on the OTHER side                      — dedupe / flip deleted
 *
 * §6.3 discipline: every journey below reads what the app PUBLISHED (`_lastWeakWindow`, the wire's
 * own node fields) and drives the real entry points — none re-implements the ranking or the map.
 */

const openRolling = async (page: any) => {
  await page.evaluate(() => (window as any).__neural.openSettings("rolling"));
  return page.evaluate(() => {
    // the app's OWN ref to the settings card — never a class another surface might share
    const m = (window as any).__neural.modalCardRef.current;
    const row = document.querySelector("[data-settings-start]");
    const gi = document.querySelector("[data-settings-gi]");
    return {
      text: (m as HTMLElement).innerText,
      present: !!row,
      picks: [...document.querySelectorAll("[data-start-pick]")].map((b: any) => ({
        v: b.getAttribute("data-start-pick"),
        // the lock glyph segBtn appends is a rendering detail, not part of the name
        label: b.textContent.replace(/\s*\u{1F512}\s*$/u, "").trim(),
        locked: b.getAttribute("data-start-locked") === "1",
        cursor: b.style.cursor,
        title: b.title,
        active: /rgba\(74, 108, 255/.test(b.style.background),
      })),
      note: (document.querySelector("[data-start-note]") as HTMLElement | null)?.textContent || "",
      noteFor: document.querySelector("[data-start-note]")?.getAttribute("data-start-note") || null,
      soon: (document.querySelector("[data-start-soon]") as HTMLElement | null)?.textContent || "",
      // DOM order: the row is about the roll itself, so it sits above the uniform choice
      beforeGi: !!(row && gi && row.compareDocumentPosition(gi) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
};

const STANDING = "standing-position";
const posIdNow = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    const n = a.nodes[a.currentPos];
    return { posId: n.posId, t: n.t, rep: n.rep, hand: (a.optionIdxs || []).length };
  });

/** Restart the roll through the real transport seam and pump until the new hand is dealt. */
const restart = async (j: any, page: any) => {
  await page.evaluate(() => (window as any).__neural.resetRoll());
  await j.nextHand(30000);
  return posIdNow(page);
};

/** The per-roll ambient draws, rigged so three restarts cannot flake on role or opponent. */
const rigAmbient = async (j: any, n: number) => {
  await j.rig("role", new Array(n).fill(0));
  await j.rig("ai-skill", new Array(n).fill(0.5));
  await j.rig("max-moves", new Array(n).fill(0.5));
};

/* ── the app members these journeys touch, typed at the page boundary (the page context is
      untyped; `window.__neural` is the app's own debug handle) ─────────────────────────────── */
type WeakRow = { idx: number; role: string; deck: string; w: number };
type WeakNode = {
  idx: number; t: string; ty: string; rep?: boolean;
  posId: string | null; fromPositionId: string | null; fromRole: string | null;
};
type NeuralApp = {
  nodes: WeakNode[];
  currentPos: number;
  playerRole: string;
  _lastWeakWindow?: WeakRow[];
  _startSpot?: string | null;
  _posIdx?: number[];
  _posSlugIndex: Map<string, number>;
  _rig: Record<string, number[] | undefined>;
  rig(tag: string, vals: number[]): void;
  startRoll(): void;
  set(k: string, v: string): void;
  get(k: string, d?: string): string;
  startFrom(): string;
  openSettings(tab: string): void;
  closeModal(): void;
  nodeForKey(key: string): number;
  deckKeyFor(n: WeakNode): { key: string };
  weakSpots(): { ranked: Array<{ deck: string; gain: number; tier: string | null }> };
  evcKickerRef: { current: HTMLElement | null };
};

/* ── 1. THE CONTROL ITSELF ─────────────────────────────────────────────────────────────────── */

test("@curated the row ships in Settings → Rolling: Standing · Anywhere · My weak spots — all three live", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.nextHand(30000); // the boot roll lands first — a restart mid-intro is not a user path
  await j.engage(); // spend the first-interaction latch: its beats are not the setting's

  const s = await openRolling(page);
  expect(s.present, "the row rendered").toBe(true);
  expect(s.beforeGi, "it sits above the Gi / No-gi choice").toBe(true);

  expect(s.picks.map((p: any) => p.v)).toEqual(["standing", "random", "weak"]);
  expect(s.picks.map((p: any) => p.label)).toEqual(["Standing", "Anywhere", "My weak spots"]);

  // the default is the historical draw, lit with no profile input at all
  expect(s.picks.filter((p: any) => p.active).map((p: any) => p.v)).toEqual(["random"]);
  expect(s.noteFor).toBe("random");
  expect(s.note).toContain("the default");

  // the v1.165.0 promise KEPT: every pill is live, nothing is locked, and no "coming soon" text
  // survives anywhere in the modal
  for (const p of s.picks) {
    expect(p.locked, `${p.v} is not locked`).toBe(false);
    expect(p.cursor, `${p.v} takes the pointer`).toBe("pointer");
    expect(p.title, `${p.v} promises nothing`).toBe("");
  }
  expect(s.soon, "the coming-soon line is gone").toBe("");
  expect(/coming soon/i.test(s.text), 'no "coming soon" text anywhere in the modal').toBe(false);

  const beats0 = await page.evaluate(() => ((window as any).__neural.beats || []).length);

  // `weak` WRITES and re-renders through the real pill — the shipped third choice
  await page.click('[data-start-pick="weak"]');
  expect(
    await page.evaluate(() => {
      const a = (window as unknown as { __neural: NeuralApp }).__neural; // page boundary: the app's own debug handle
      return a.get("startFrom", "unset");
    }),
    "clicking the live pill writes the setting",
  ).toBe("weak");
  expect(
    await page.evaluate(() => {
      const a = (window as unknown as { __neural: NeuralApp }).__neural; // page boundary: the app's own debug handle
      return a.startFrom();
    }),
  ).toBe("weak");
  let t = await openRolling(page);
  expect(t.picks.filter((p: any) => p.active).map((p: any) => p.v)).toEqual(["weak"]);
  expect(t.noteFor).toBe("weak");
  expect(t.note).toContain("My weak spots");
  // …and the note names the LIVE spot — the crack, its seat, and where the roll opens
  expect(t.note, "the note names the live spot").toContain("Right now:");
  expect(/\((attacking|defending|top|bottom)\)/.test(t.note), "the crack carries its seat").toBe(true);
  expect(t.note).toMatch(/opens .+, (top|bottom)\./);

  // the copy is the player's, not the model's — checked on the WEAK view, where the live spot renders
  for (const jargon of ["rng", "start-pos", "startFrom", "posId", "slug", "seed", "rig", "FLOW", "gain", "tier", "kernel"])
    expect(
      new RegExp(`\\b${jargon.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t.text),
      `never says "${jargon}"`,
    ).toBe(false);

  // the other pills still write through the REAL control, re-render, and emit no gameplay beat
  await page.click('[data-start-pick="standing"]');
  t = await openRolling(page);
  expect(t.picks.filter((p: any) => p.active).map((p: any) => p.v)).toEqual(["standing"]);
  expect(t.noteFor).toBe("standing");
  expect(t.note).toContain("Standing");
  await page.click('[data-start-pick="random"]');
  t = await openRolling(page);
  expect(t.picks.filter((p: any) => p.active).map((p: any) => p.v)).toEqual(["random"]);
  expect(
    await page.evaluate(() => ((window as any).__neural.beats || []).length),
    "a settings write is not a gameplay beat — got " +
      (await page.evaluate(() => ((window as any).__neural.beats || []).slice(-4).map((b: any) => b.beat).join(","))),
  ).toBe(beats0);

  // neighbours still render — a blank tab must not pass as a shipped row
  expect(s.text).toContain("Uniform");
  expect(s.text).toContain("Answer time");
});

/* ── 2. STANDING OPENS EVERY ROLL ON THE FEET; ANYWHERE DOES NOT ───────────────────────────── */

test("@curated Standing opens every roll on standing-position, consuming one start-pos draw each; Anywhere does not", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.nextHand(30000); // the boot roll (Anywhere, unrigged) lands and builds the pool

  // choose Standing through the real control
  await page.evaluate(() => (window as any).__neural.openSettings("rolling"));
  await page.click('[data-start-pick="standing"]');
  await page.evaluate(() => (window as any).__neural.closeModal());

  // three draws that would land three DIFFERENT sites under Anywhere (idx 0, 68, 134 of 136)
  const U = [0.0, 0.5, 0.99];
  await rigAmbient(j, 3);
  await j.rig("start-pos", U);
  const standing = [];
  for (let i = 0; i < 3; i++) standing.push(await restart(j, page));
  expect(
    standing.map((s: any) => s.posId),
    "every restart opened on the feet",
  ).toEqual([STANDING, STANDING, STANDING]);
  for (const s of standing) expect(s.hand, "…and dealt a live hand there").toBeGreaterThan(0);
  // the standing site is in the playable pool as its REP member (the pool is built by the first
  // startRoll, so it is read here and not before), so this was a real opening, never the fallback
  const pool = await page.evaluate(() => {
    const a = (window as any).__neural;
    const ix = a._posSlugIndex.get("standing-position");
    return { size: (a._posIdx || []).length, inPool: (a._posIdx || []).indexOf(ix) >= 0, rep: a.nodes[ix]?.rep, at: a.currentPos === ix };
  });
  expect(pool.size, "the playable position pool excludes submission aliases").toBe(124); // census:playablePositions
  expect(pool.inPool, "standing-position's rep member is in it").toBe(true);
  expect(pool.rep, "…and it IS the rep member").toBe(true);
  expect(pool.at, "…and that is the node the roll stands on").toBe(true);
  expect(
    await page.evaluate(() => ((window as any).__neural._rig["start-pos"] || []).length),
    "the start-pos draw was consumed once per roll, even though Standing ignores its value",
  ).toBe(0);
  expect(
    (await j.beats()).filter((b) => b.beat === "start_from_fallback").length,
    "no fallback fired — this was the real branch",
  ).toBe(0);

  // THE CONTROL: the same three draws under Anywhere open three different states
  await page.evaluate(() => (window as any).__neural.openSettings("rolling"));
  await page.click('[data-start-pick="random"]');
  await page.evaluate(() => (window as any).__neural.closeModal());
  await rigAmbient(j, 3);
  await j.rig("start-pos", U);
  const anywhere = [];
  for (let i = 0; i < 3; i++) anywhere.push(await restart(j, page));
  const distinct = new Set(anywhere.map((s: any) => s.posId));
  expect(distinct.size, `Anywhere drew ${[...distinct].join(", ")}`).toBe(3);
  expect(
    await page.evaluate(() => ((window as any).__neural._rig["start-pos"] || []).length),
    "…consuming the same one draw per roll",
  ).toBe(0);
});

/* ── 3. THE TEST RAIL OUTRANKS THE SETTING ─────────────────────────────────────────────────── */

test("a rigged start outranks Standing — land() keeps working on a profile that carries the setting", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await page.evaluate(() => (window as any).__neural.set("startFrom", "standing"));
  await j.land("Mount Top");
  const s = await posIdNow(page);
  expect(s.t).toBe("Mount Top");
  expect(s.hand).toBeGreaterThan(0);
  // and the setting is still what the player chose — the rail did not overwrite it
  expect(await page.evaluate(() => (window as any).__neural.startFrom())).toBe("standing");
});

/* ── 4. THE FALLBACK IS LOUD ───────────────────────────────────────────────────────────────── */

test("a wire without a playable standing position still starts, on the ordinary draw, and says so", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.nextHand(30000); // the boot roll lands and builds the pool (`_posIdx` is lazy)
  await page.evaluate(() => (window as any).__neural.set("startFrom", "standing"));

  // simulate the wire this repo has never shipped: standing-position exists but is not playable
  const removed = await page.evaluate(() => {
    const a = (window as any).__neural;
    if (!a._posIdx) throw new Error("the pool is built by the first startRoll; it must exist here");
    const ix = a._posSlugIndex.get("standing-position");
    const before = a._posIdx.length;
    a._posIdx = a._posIdx.filter((i: number) => i !== ix);
    return before - a._posIdx.length;
  });
  expect(removed, "exactly the standing site was removed from the pool").toBe(1);

  await rigAmbient(j, 1);
  await j.rig("start-pos", [0.5]);
  const beats0 = (await j.beats()).length;
  const s = await restart(j, page);
  expect(s.posId, "the roll still started, somewhere else").not.toBe(STANDING);
  expect(s.hand).toBeGreaterThan(0);
  const fb = (await j.beats()).slice(beats0).filter((b: any) => b.beat === "start_from_fallback");
  expect(fb.length, "the fallback NAMED itself").toBe(1);
  expect((fb[0] as any).want).toBe("standing");
  expect((fb[0] as any).have).toBe("not-playable");
  expect(
    await page.evaluate(() => ((window as any).__neural._rig["start-pos"] || []).length),
    "one draw, as in every other mode",
  ).toBe(0);
});

/* ── 5. IT TOUCHES NOTHING YOU HAVE EARNED ─────────────────────────────────────────────────── */

const EARNED = `(() => {
  const a = window.__neural;
  const g = a.gameScore();
  return {
    score: Math.round(g.score * 1e9), belt: g.belt, next: g.next, stripes: g.stripes,
    stage: JSON.stringify(a.stage || {}), srs: JSON.stringify(a.srs || {}),
    prep: JSON.stringify(a.prep || {}), rec: JSON.stringify(a.rec || {}),
    challenges: JSON.stringify(a.challenges || {}), badges: JSON.stringify(a.badges || {}),
    coins: JSON.stringify(a.coins || {}), units: JSON.stringify(a.units || {}),
    due: a.dueCount ? a.dueCount() : null,
  };
})()`;

/** the persisted blob with ONLY this setting's own key removed — see loss-aversion.spec.ts for why
 *  this diff is the only thing in the suite that notices a persisted field whose write never fires */
const BLOB = `(() => {
  const raw = localStorage.getItem("bjj-neural-progress");
  if (!raw) return "";
  const b = JSON.parse(raw);
  if (b.settings) delete b.settings.startFrom;
  if (b.settingsAt) delete b.settingsAt.startFrom;
  delete b.updatedAt;
  return JSON.stringify(b);
})()`;

test("@curated changing where the roll starts changes nothing you have earned", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  const before = await page.evaluate(EARNED);
  const blobBefore = await page.evaluate(BLOB);
  const beats = await page.evaluate(() => ((window as any).__neural.beats || []).length);

  await page.evaluate(() => (window as any).__neural.openSettings("rolling"));
  for (const v of ["standing", "weak", "random", "standing"]) {
    await page.click(`[data-start-pick="${v}"]`);
    expect(await page.evaluate(() => (window as any).__neural.get("startFrom")), `the click set ${v}`).toBe(v);
  }
  await page.evaluate(() => (window as any).__neural.closeModal());

  expect(await page.evaluate(EARNED), "belt score, SRS, evidence, rewards — all untouched").toEqual(before);
  expect(await page.evaluate(BLOB), "the rest of the blob is untouched").toBe(blobBefore);
  expect(await page.evaluate(() => ((window as any).__neural.beats || []).length), "not one gameplay beat").toBe(beats);
  // the live hand is not restarted by a settings write — the choice applies to the NEXT roll
  expect((await posIdNow(page)).t, "the roll the player is in did not move").toBe("Mount Top");
});

/* ── 6. MY WEAK SPOTS OPENS ON THE PUBLISHED WINDOW, ON ITS SEAT ───────────────────────────── */

/** Pick the third pill through the real control (the pill itself is claim 1's subject). */
const pickWeak = async (page: any) => {
  await page.evaluate(() => {
    const a = (window as unknown as { __neural: NeuralApp }).__neural; // page boundary: the app's own debug handle
    a.openSettings("rolling");
  });
  await page.click('[data-start-pick="weak"]');
  await page.evaluate(() => {
    const a = (window as unknown as { __neural: NeuralApp }).__neural; // page boundary: the app's own debug handle
    a.closeModal();
  });
};

test("@curated a weak-spots roll opens on the biggest leak, on its seat — and the seat is the wire's", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.nextHand(30000); // the boot roll lands and builds the pool (`_posIdx` is lazy)
  await pickWeak(page);

  await rigAmbient(j, 1); // role rigged TOP — the seat below must come from the SPOT, not this draw
  await j.rig("start-pos", [0]); // u = 0 → the first window row, the biggest leak
  const s = await restart(j, page);
  expect(s.hand, "a live hand was dealt there").toBeGreaterThan(0);

  const r = await page.evaluate(() => {
    const a = (window as unknown as { __neural: NeuralApp }).__neural; // page boundary: the app's own debug handle
    const win = a._lastWeakWindow || [];
    const w0 = win[0];
    const n = w0 ? a.nodes[a.nodeForKey(w0.deck)] : null;
    return {
      len: win.length,
      w0,
      spot: a._startSpot,
      current: { idx: a.currentPos, posId: a.nodes[a.currentPos].posId, role: a.playerRole },
      wire: n ? { ty: n.ty, posId: n.posId, fromPositionId: n.fromPositionId, fromRole: n.fromRole } : null,
      rigLeft: (a._rig["start-pos"] || []).length,
    };
  });
  expect(r.len, "the window the draw used is PUBLISHED").toBeGreaterThan(0);
  expect(r.current.idx, "the roll opened on the first row's state").toBe(r.w0.idx);
  expect(r.current.role, "…on the spot's own seat, over the rigged top role draw").toBe(r.w0.role);
  expect(r.spot, "…and the crack is named for the toast").toBe(r.w0.deck);
  expect(r.rigLeft, "exactly one start-pos draw, as in every other mode").toBe(0);

  // (posId, role) is what the WIRE says for that deck — read from the node's own fields, never
  // re-ranked (§6.3): a position deck's seat is the key's own suffix; a technique deck opens on
  // `fromPositionId` seated `fromRole`, and a `|Defender` deck flips the seat.
  if (r.wire!.ty === "positions") {
    expect(String(r.current.posId).toLowerCase()).toBe(String(r.wire!.posId).toLowerCase());
    expect(r.w0.role).toBe(/\|Bottom$/.test(r.w0.deck) ? "bottom" : "top");
  } else {
    expect(String(r.current.posId).toLowerCase()).toBe(String(r.wire!.fromPositionId).toLowerCase());
    const flipped = r.wire!.fromRole === "top" ? "bottom" : "top";
    expect(r.w0.role).toBe(/\|Defender$/.test(r.w0.deck) ? flipped : r.wire!.fromRole);
  }

  // the opening toast names the CRACK — read on the very frame startRoll runs, before the landing
  // clears it (`hideCenter` fires with the hand)
  const kick = await page.evaluate(() => {
    const a = (window as unknown as { __neural: NeuralApp }).__neural; // page boundary: the app's own debug handle
    a.rig("role", [0]);
    a.rig("start-pos", [0]);
    a.startRoll();
    return { kicker: a.evcKickerRef.current ? a.evcKickerRef.current.textContent : null, spot: a._startSpot };
  });
  expect(kick.kicker, "the toast names the crack, not the generic restart").toBe(
    "Your weak spot: " + String(kick.spot).split("|")[0],
  );
});

/* ── 7. BOTTOM SEATS ARE REACHABLE ─────────────────────────────────────────────────────────── */

test("@curated a bottom-seat spot seats you bottom even when the role draw says top", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.nextHand(30000);
  await pickWeak(page);

  // publish the window through the real draw once
  await rigAmbient(j, 1);
  await j.rig("start-pos", [0]);
  await restart(j, page);

  const t = await page.evaluate(() => {
    const a = (window as unknown as { __neural: NeuralApp }).__neural; // page boundary: the app's own debug handle
    const win = a._lastWeakWindow || [];
    const k = win.findIndex((row) => row.role === "bottom");
    if (k < 0) return { k, mid: 0, row: null };
    const total = win.reduce((acc, row) => acc + row.w, 0);
    let below = 0;
    for (let i = 0; i < k; i++) below += win[i].w;
    // the row's cumulative-weight midpoint, computed from the PUBLISHED window's own weights
    return { k, mid: (below + win[k].w / 2) / total, row: win[k] };
  });
  expect(t.k, "some window row is a bottom seat — games leak from under people too").toBeGreaterThanOrEqual(0);

  await rigAmbient(j, 1); // rng("role") rigged to TOP…
  await j.rig("start-pos", [t.mid]);
  const s = await restart(j, page);
  expect(s.hand).toBeGreaterThan(0);
  const after = await page.evaluate(() => {
    const a = (window as unknown as { __neural: NeuralApp }).__neural; // page boundary: the app's own debug handle
    return { idx: a.currentPos, role: a.playerRole };
  });
  expect(after.idx, "the draw landed the bottom-seat row").toBe(t.row!.idx);
  expect(after.role, "…and the SEAT is the spot's, overriding the rigged top role").toBe("bottom");
});

/* ── 8. WEIGHTED, NOT UNIFORM ──────────────────────────────────────────────────────────────── */

test("@curated the opening draw is weighted by the leak, not uniform", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.nextHand(30000);
  await pickWeak(page);

  // publish the window once through the real draw, then sweep the whole unit interval the way
  // first-impression.spec.ts's sweepFirstStart does — startRoll() direct, timers cleared by the
  // next call, so nothing else in the roll loop runs
  await rigAmbient(j, 1);
  await j.rig("start-pos", [0]);
  await restart(j, page);

  const s = await page.evaluate((N) => {
    const a = (window as unknown as { __neural: NeuralApp }).__neural; // page boundary: the app's own debug handle
    const win = (a._lastWeakWindow || []).slice();
    if (!win.length) return { n: 0, expected: 0, share: 0, uniform: 0 };
    const total = win.reduce((acc, row) => acc + row.w, 0);
    let hits = 0;
    for (let i = 0; i < N; i++) {
      a.rig("role", [0]);
      a.rig("start-pos", [(i + 0.5) / N]);
      a.startRoll();
      if (a.currentPos === win[0].idx && a.playerRole === win[0].role) hits++;
    }
    return { n: win.length, expected: win[0].w / total, share: hits / N, uniform: 1 / win.length };
  }, 400);
  expect(s.n, "a window with more than one row — otherwise weighting is unobservable").toBeGreaterThan(1);
  test.skip(
    Math.abs(s.expected - s.uniform) <= 0.08,
    `top-row share ${s.expected.toFixed(3)} within 0.08 of uniform ${s.uniform.toFixed(3)} — indistinguishable on this profile`,
  );
  expect(Math.abs(s.share - s.expected), "the measured share IS the window's own weight").toBeLessThanOrEqual(0.03);
  expect(Math.abs(s.share - s.uniform), "…and is NOT the uniform share").toBeGreaterThan(0.05);
});

/* ── 9. AN EMPTY RANKING FALLS BACK LOUDLY, WITHOUT DRAWING ────────────────────────────────── */

test("@curated an empty ranking still starts the roll, on the ordinary draw, and says so", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.nextHand(30000);
  await page.evaluate(() => {
    const a = (window as unknown as { __neural: NeuralApp }).__neural; // page boundary: the app's own debug handle
    a.set("startFrom", "weak");
    // the payload race the harness cannot lose — simulate the cold profile at the one seam the
    // opening reads (`weakSpots()`), the way test 4 cuts the pool
    a.weakSpots = () => ({ ranked: [] });
  });

  await rigAmbient(j, 1);
  await j.rig("start-pos", [0.5]);
  const beats0 = (await j.beats()).length;
  const s = await restart(j, page);
  expect(s.hand, "the roll still started, on the ordinary draw").toBeGreaterThan(0);
  const fb = (await j.beats()).slice(beats0).filter((b: any) => b.beat === "start_from_fallback");
  expect(fb.length, "the fallback NAMED itself, once").toBe(1);
  expect((fb[0] as any).want).toBe("weak");
  expect((fb[0] as any).have).toBe("no-ranking");
  expect(
    await page.evaluate(() => {
      const a = (window as unknown as { __neural: NeuralApp }).__neural; // page boundary: the app's own debug handle
      return (a._rig["start-pos"] || []).length;
    }),
    "ONE draw — the fallback was chosen BEFORE any rng, and the ordinary draw took the rigged value",
  ).toBe(0);
});

/* ── 10. DEDUPE AND THE DEFENDER FLIP, ON AN AUTHORED RANKING ──────────────────────────────── */

test("@curated two cracks in one state count once, and a Defender crack seats you on the other side", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.nextHand(30000);

  // author a ranking through the REAL seam: three cracks, two of them living in one state+seat.
  // The decks are real wire decks (found by reading the nodes, not invented), so the deck→state
  // map under test runs unmodified.
  const made = await page.evaluate(() => {
    const a = (window as unknown as { __neural: NeuralApp }).__neural; // page boundary: the app's own debug handle
    const pool = a._posIdx || [];
    const posDeck = "Side Control|Top";
    let attacker: string | null = null;
    let defender: { key: string; from: string; role: string } | null = null;
    for (const n of a.nodes) {
      if (n.ty === "positions") continue;
      const key = a.deckKeyFor(n).key;
      if (
        !attacker &&
        /\|Attacker$/.test(key) &&
        String(n.fromPositionId).toLowerCase() === "side-control" &&
        String(n.fromRole).toLowerCase() === "top"
      )
        attacker = key;
      if (
        !defender &&
        /\|Defender$/.test(key) &&
        (n.fromRole === "top" || n.fromRole === "bottom") &&
        String(n.fromPositionId).toLowerCase() !== "side-control"
      ) {
        const idx = a._posSlugIndex.get(String(n.fromPositionId).toLowerCase());
        if (idx != null && pool.indexOf(idx) >= 0)
          defender = { key, from: String(n.fromPositionId).toLowerCase(), role: String(n.fromRole).toLowerCase() };
      }
      if (attacker && defender) break;
    }
    a.set("startFrom", "weak");
    a.weakSpots = () => ({
      ranked: [
        { deck: posDeck, gain: 3, tier: "leaking" },
        { deck: attacker as string, gain: 2, tier: "leaking" },
        { deck: (defender as { key: string }).key, gain: 1, tier: "leaking" },
      ],
    });
    return { posDeck, attacker, defender };
  });
  expect(made.attacker, "the corpus has an attacker deck authored at Side Control top").toBeTruthy();
  expect(made.defender, "…and a Defender deck at some other playable position").toBeTruthy();

  // deduped weights are 3 then 1 → cumulative shares 0.75, 1.0: u = 0.9 lands the DEFENDER row
  await rigAmbient(j, 1);
  await j.rig("start-pos", [0.9]);
  const s = await restart(j, page);
  expect(s.hand).toBeGreaterThan(0);

  const r = await page.evaluate(() => {
    const a = (window as unknown as { __neural: NeuralApp }).__neural; // page boundary: the app's own debug handle
    return {
      win: a._lastWeakWindow || [],
      posId: a.nodes[a.currentPos].posId,
      role: a.playerRole,
    };
  });
  // DEDUPE (§6.6, the `_ev` doubling trap): the attacker crack lives in the position crack's
  // state+seat — one row survives, and its weight is the FIRST row's, dropped not summed
  expect(r.win.length, "three cracks, two states").toBe(2);
  expect(r.win[0].deck).toBe(made.posDeck);
  expect(r.win[0].w, "the duplicate's weight was DROPPED, never added").toBe(3);
  // DEFENDER FLIP: the defender stands in the same position, on the other seat
  expect(r.win[1].deck).toBe(made.defender!.key);
  expect(String(r.posId).toLowerCase()).toBe(made.defender!.from);
  expect(r.role, "the Defender crack seats you on the OTHER side").toBe(
    made.defender!.role === "top" ? "bottom" : "top",
  );
});
