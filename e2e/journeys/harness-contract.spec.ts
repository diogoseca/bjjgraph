import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE HARNESS'S OWN CONTRACT.
 *
 * Everything in e2e/journeys rests on the DSL telling the truth. Two of its promises were not kept,
 * and both failed in the direction that manufactures green:
 *
 *   1. `releasePayload(pattern)` took a pattern and ignored it — it resolved EVERY held gate. So a
 *      spec holding two payloads and landing one landed both, and any per-payload ordering claim
 *      (including the per-deck-chunk rule the sibling chunking stream is meant to use) was
 *      meaningless while still passing.
 *   2. `clickByMouse` accepted `top.contains(el)` — an ANCESTOR overlay that merely contains the
 *      target. That is the exact interception the helper exists to catch: the click lands on the
 *      overlay, the target never sees it, and the assertion said "reachable by mouse".
 *   3. `payloads` rules were documented as applying to "THIS boot" and were never cleared, so a rule
 *      armed for one boot silently governed every later boot of the same page.
 *
 * A harness bug cannot be caught by the tests that use the harness — they go green. So it is pinned
 * here, directly, in the units the DSL claims: gates, patterns, and coordinates.
 */

// ── B2: clickByMouse ── a DOM fixture is enough (the helper measures a rect, hit-tests the centre
// and clicks coordinates; no app state is involved). setContent keeps it hermetic and instant.
const FIXTURE = `
  <style>body{margin:0;background:#111}</style>
  <button id="plain" style="position:fixed;left:40px;top:40px;width:220px;height:60px;">
    plain target
  </button>
  <button id="wrapper" style="position:fixed;left:40px;top:140px;width:220px;height:60px;">
    <span id="inner" style="display:block;width:100%;height:100%;pointer-events:auto;">a child on top</span>
  </button>
  <div id="ancestor" style="position:fixed;left:40px;top:240px;width:220px;height:60px;background:#245;pointer-events:auto;">
    <button id="captured" style="pointer-events:none;width:100%;height:100%;">under an overlay</button>
  </div>
  <button id="covered" style="position:fixed;left:40px;top:340px;width:220px;height:60px;">covered</button>
  <div id="cover" style="position:fixed;left:0;top:330px;width:600px;height:80px;background:#822;pointer-events:auto;"></div>
  <button id="offscreen" style="position:fixed;left:40px;top:4000px;width:220px;height:60px;">below the fold</button>
  <script>
    window.__hits = [];
    for (const id of ["plain","wrapper","inner","ancestor","captured","cover","offscreen"]) {
      // no stopPropagation: the bubbling IS the observation — a click on a child must be seen by
      // the target, and a click captured by an ancestor must NOT be
      document.getElementById(id).addEventListener("click", () => window.__hits.push(id));
    }
  </script>`;

const hits = (page: any): Promise<string[]> =>
  page.evaluate(() => (window as any).__hits.slice());

test("harness: clickByMouse accepts a target the mouse can really reach", async ({
  page,
}) => {
  const j = journey(page);
  await page.setContent(FIXTURE);

  await j.clickByMouse("#plain", "a plain unobstructed button");
  expect(await hits(page), "the click reached the target itself").toEqual([
    "plain",
  ]);

  // the one legitimate non-identity case: what is on top is the target's OWN child, so the click
  // lands inside the target and bubbles to it. This must keep passing.
  await page.evaluate(() => ((window as any).__hits.length = 0));
  await j.clickByMouse("#wrapper", "a button whose own child owns the point");
  expect(
    await hits(page),
    "the child took the click and the target saw it",
  ).toEqual(["inner", "wrapper"]);
});

test("harness: clickByMouse REFUSES a target an ancestor overlay has captured", async ({
  page,
}) => {
  // THE HOLE. `document.elementFromPoint` returns #ancestor — a parent of #captured — because the
  // target itself is `pointer-events:none`. The old third clause (`top.contains(el)`) called that
  // reachable, so the helper's entire reason for existing was defeated by the commonest shape of
  // interception there is: an overlay wrapping the control it swallows.
  const j = journey(page);
  await page.setContent(FIXTURE);

  const err = await j
    .clickByMouse("#captured", "a button captured by its own ancestor")
    .then(
      () => null,
      (e: Error) => e,
    );
  expect(
    err,
    "an ancestor overlay owning the point is NOT reachability — this must fail, loudly",
  ).toBeTruthy();
  expect(
    String(err),
    "and the failure names what is really under the cursor",
  ).toMatch(/ancestor|ng-|<div/i);
  expect(
    await hits(page),
    "and no click was delivered at all — the helper refused before clicking",
  ).toEqual([]);
});

test("harness: clickByMouse refuses an unrelated cover and an off-screen centre", async ({
  page,
}) => {
  const j = journey(page);
  await page.setContent(FIXTURE);

  const covered = await j.clickByMouse("#covered").then(
    () => null,
    (e: Error) => e,
  );
  expect(covered, "a plain overlay on top is refused").toBeTruthy();

  const off = await j.clickByMouse("#offscreen").then(
    () => null,
    (e: Error) => e,
  );
  expect(off, "a centre outside the viewport is refused").toBeTruthy();
  expect(String(off), "and says so in those terms").toMatch(/OUTSIDE the/);
  expect(await hits(page), "neither click was delivered").toEqual([]);
});

test("harness: releasePayload lands ONLY the payload it names", async ({
  page,
}) => {
  // BLOCKER 1. Two payloads held; one released. The other must still be held — otherwise no spec can
  // state an ORDER between two late payloads (the measured production skew is decks @25.3s then
  // dossier @27.0s, and the per-deck chunking stream needs exactly this per-chunk control).
  const j = journey(page);
  await j.boot("/", {
    keepTutorial: true,
    payloads: {
      "flashcards.json": { never: true },
      "curriculum.json": { never: true },
    },
  });
  const state = () =>
    page.evaluate(() => ({
      decks: !!(window as any).__neural.flashcards,
      curriculum: !!(window as any).__neural.curriculum,
    }));
  expect(await state(), "both payloads are outstanding").toEqual({
    decks: false,
    curriculum: false,
  });

  j.releasePayload("flashcards.json");
  await page.waitForFunction(
    () => !!(window as any).__neural.flashcards,
    null,
    { timeout: 30_000 },
  );
  // give any wrongly-released sibling a generous window to land before claiming it did not
  await page.waitForTimeout(1500);
  const after = await state();
  expect(after.decks, "the named payload landed").toBe(true);
  expect(
    after.curriculum,
    "and the one that was NOT named is still held — releasing one payload must not release them all",
  ).toBe(false);

  const tl = j.payloadTimeline();
  const deck = tl.find((p) => /flashcards\.json/.test(p.url))!;
  const cur = tl.find((p) => /curriculum\.json/.test(p.url))!;
  expect(deck.releasedAtMs, "the timeline agrees: decks served").not.toBe(null);
  expect(cur.releasedAtMs, "curriculum never served").toBe(null);

  // ...and the bare form still means "everything", which is what teardown relies on
  j.releasePayload();
  await page.waitForFunction(
    () => !!(window as any).__neural.curriculum,
    null,
    { timeout: 30_000 },
  );
});

test("harness: a payload rule belongs to the boot that declared it", async ({
  page,
}) => {
  // MINOR. `PayloadRule` and boot()'s own doc comment both say the rules apply to "THIS boot", and
  // afterSim/afterMs are already re-based per boot — but the rule table was never cleared, so a
  // `never` declared once silently governed every later boot of the same page. Either the code or
  // the documentation had to give; the code did.
  const j = journey(page);
  await j.boot("/", {
    keepTutorial: true,
    payloads: { "flashcards.json": { never: true } },
  });
  expect(
    await page.evaluate(() => !!(window as any).__neural.flashcards),
    "held on the boot that asked for it",
  ).toBe(false);

  await j.boot("/", { keepTutorial: true }); // a fresh boot declares nothing
  expect(
    await page.evaluate(() => !!(window as any).__neural.flashcards),
    "and served normally on the next boot, which declared no rule at all",
  ).toBe(true);
});
