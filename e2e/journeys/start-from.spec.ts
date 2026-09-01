import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * WHERE THE ROLL STARTS — the `startFrom` setting (v1.165.0).
 *
 * Owner: "the user can select how it starts, whether to start from random, from standing, or from
 * the position most beneficial for the user to learn to complement his game. That one is coming
 * soon. … or something that feels personal like my weak spots."
 *
 * Three pills in Settings → Rolling: Standing · Anywhere (the default, i.e. the historical draw)
 * · My weak spots (LOCKED — rendered as a promise, written by nothing). `startFrom()` is the one
 * reader; `startRoll` consults it after the test rail and before the first-impression draw.
 *
 * The claims, each with the mutant that kills it (all run against the shipped build, v1.165.0):
 *   1. the row ships, in white-belt words, the locked pill is inert          — hide the row / unlock it
 *   2. Standing opens EVERY roll on standing-position; Anywhere does not     — delete the branch
 *      …and the `start-pos` draw is still consumed, one per roll, either way — drop the rng() call
 *   3. the test rail (`rigStart`) outranks the setting                       — reorder the branches
 *   4. a wire without a playable standing position falls back LOUDLY         — delete the fx()
 *   5. flipping it changes nothing earned, and emits no gameplay beat        — fx() in the onClick
 *
 * NOT covered here, on purpose: the "My weak spots" behaviour, which does not exist yet. When it
 * ships, its spec must assert the start state is keyed on posId + "/" + role (§6.6).
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

/* ── 1. THE CONTROL ITSELF ─────────────────────────────────────────────────────────────────── */

test("@curated the row ships in Settings → Rolling: Standing · Anywhere · My weak spots (locked)", async ({
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

  // the promise is VISIBLE and INERT: locked, says so without a click, and cannot be written
  const weak = s.picks.find((p: any) => p.v === "weak");
  expect(weak.locked, "My weak spots is locked").toBe(true);
  expect(weak.cursor).toBe("not-allowed");
  expect(weak.title).toBe("Coming soon");
  expect(s.soon.toLowerCase()).toContain("coming soon");
  expect(s.soon).toContain("My weak spots");
  const beats0 = await page.evaluate(() => ((window as any).__neural.beats || []).length);
  await page.click('[data-start-pick="weak"]');
  expect(
    await page.evaluate(() => (window as any).__neural.get("startFrom", "unset")),
    "clicking the locked pill writes nothing",
  ).toBe("unset");
  expect(await page.evaluate(() => (window as any).__neural.startFrom())).toBe("random");

  // the copy is the player's, not the model's
  expect(s.text).toContain("Where the roll starts");
  for (const jargon of ["rng", "start-pos", "startFrom", "posId", "slug", "seed", "rig"])
    expect(
      new RegExp(`\\b${jargon.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(s.text),
      `never says "${jargon}"`,
    ).toBe(false);

  // the live pills write through the REAL control, re-render, and emit no gameplay beat
  await page.click('[data-start-pick="standing"]');
  let t = await openRolling(page);
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
  expect(pool.size, "the playable pool is the 136 sites").toBe(136);
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
  for (const v of ["standing", "random", "standing"]) {
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
