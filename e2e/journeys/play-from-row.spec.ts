import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * ▶ BELONGS TO A TECHNIQUE, NOT TO A COLLECTION (v1.103.6).
 *
 * Owner: "that play button should be reserved for techniques inside lists and outside of it,
 * meaning positions, transitions, and submissions" — and "a list shouldn't actually have that".
 *
 * ▶ means "make this the current state and roll". You can do that to a position or a technique;
 * you cannot do it to a list, any more than to a System. The list's old ▶ opened a FLASHCARD
 * session and never touched the roll, so it wore the wrong verb — v1.103.6 moved it to a
 * stacked-cards glyph and v1.103.7 removed the control entirely (owner). A list row is now
 * light-it / read-it / share-it / ×, and every verb that acts on ONE technique lives on the
 * item that carries it.
 *
 * The second half is the category SHAPE. `nodeGlyph` and the canvas `draw()` share one
 * vocabulary — circle = position, triangle = submission, diamond = transition — and the rows
 * that carry a technique must all speak it. Two did not: Explore's leaf rows inside a family
 * fold had no glyph at all, and a list's items had none either.
 */

/**
 * Classify a rendered glyph the way it is actually built, not by guessing at markup.
 *
 * NB the triangle is NOT identified by `width === "0px"`: the page sets `box-sizing:border-box`,
 * so a `width:0` element with 4.34px side borders computes to 8px. The unambiguous tell is the
 * CSS-triangle trick itself — transparent left/right borders under a coloured bottom one.
 */
const CLASSIFY = `(el) => {
  const cs = getComputedStyle(el);
  const clear = (c) => /rgba\\(0, 0, 0, 0\\)|transparent/.test(c);
  if (parseFloat(cs.borderBottomWidth) > 0 && clear(cs.borderLeftColor) && clear(cs.borderRightColor)) return "triangle";
  if (cs.transform && cs.transform !== "none") return "diamond";   // a rotated square
  if (parseFloat(cs.borderTopLeftRadius) > 0) return "circle";
  return "unknown";
}`;

async function seedList(page: any) {
  return page.evaluate(() => {
    const a: any = (window as any).__neural;
    a.newList();
    a.renameList(a.activeListId, "Tuesday takedowns");
    a.addToList("Positions/Mount");
    const tr = a.nodes.find((n: any) => n.ty === "transitions");
    const sb = a.nodes.find((n: any) => n.ty === "submissions" && !n.isFamily);
    if (tr) a.addToList(tr.id);
    if (sb) a.addToList(sb.id);
    a.openPane("explore");
    return { tr: tr && tr.id, sb: sb && sb.id };
  });
}

test("▶ rides every technique row — and never the list itself @curated", async ({ page }) => {
  const j = await journey(page, { seed: 7 });
  await j.boot("/");
  await seedList(page);
  await page.waitForTimeout(500);

  // three items, three play buttons
  await expect(page.locator("[data-list-itemrow]")).toHaveCount(3);
  await expect(page.locator("[data-list-itemrow] [data-play-from]")).toHaveCount(3);

  // ...and the LIST row has none.
  expect(
    await page.evaluate(() => document.querySelectorAll("[data-list-row] > [data-play-from]").length),
    "a list is a collection — it is not a state you can roll from",
  ).toBe(0);
  // NO DRILL CONTROL EITHER (v1.103.7, owner). The row is light-it / read-it / share-it / ×;
  // the per-item verbs live on the items. `openListSession` stays reachable from a RECEIVED
  // class's "Drill these", which is the case that needs a study path before anything is saved.
  await expect(page.locator("[data-list-drill]")).toHaveCount(0);
  await expect(page.locator("[data-list-share]")).toHaveCount(1);
  await expect(page.locator("[data-list-delete]")).toHaveCount(1);
  expect(
    await page.evaluate(() => typeof (window as any).__neural.openListSession === "function"),
    "the received-class drill path must not have been deleted with the button",
  ).toBe(true);

  // every play button names its technique for a screen reader (a title is not an accessible name)
  for (const l of await page.locator("[data-list-itemrow] [data-play-from]").all())
    expect(await l.getAttribute("aria-label")).toMatch(/^Play from .+/);
});

test("▶ asks before it discards the roll you are in @curated", async ({ page }) => {
  const j = await journey(page, { seed: 7 });
  await j.boot("/");
  await seedList(page);
  await page.waitForTimeout(500);

  const sel = "[data-list-itemrow] [data-play-from]";
  // clickByMouse, never locator.click(): the pane sits inside the fixed wrap whose pointerdown
  // captures the pointer, and that is exactly how four earlier controls shipped mouse-dead.
  await j.clickByMouse(sel, "the item's play");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => /Start a fresh roll/i.test(document.body.innerText))).toBe(true);

  // Cancel leaves the roll alone. NB `__neural.cur` does NOT exist — reading it compared undefined
  // to undefined and could never fail. The state is `currentPos`, and "the roll you are in" is the
  // session as well as the node, so the log length rides along.
  const snap = () =>
    page.evaluate(() => {
      const a: any = (window as any).__neural;
      return { pos: a.currentPos, moves: (a.rollLog || []).length };
    });
  const before = await snap();
  expect(before.pos, "premise: there IS a roll to preserve").toBeGreaterThanOrEqual(0);
  await page.evaluate(() => (document.querySelector(".ng-cf-no") as HTMLElement).click());
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => /Start a fresh roll/i.test(document.body.innerText))).toBe(false);
  expect(await snap()).toEqual(before);
});

test("an Explore technique row plays too, by real mouse", async ({ page }) => {
  const j = await journey(page, { seed: 7 });
  await j.boot("/");
  await page.evaluate(() => (window as any).__neural.openPane("explore"));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const h = [...document.querySelectorAll("[data-explore-section]")].find((e) =>
      (e.textContent || "").startsWith("Transitions"),
    ) as HTMLElement;
    h?.click();
  });
  await page.waitForTimeout(500);

  const first = page.locator("[data-play-from]").first();
  await first.scrollIntoViewIfNeeded();
  const id = await first.getAttribute("data-play-from");
  await j.clickByMouse(`[data-play-from="${id}"]`, "an Explore row's play");
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => /Start a fresh roll/i.test(document.body.innerText))).toBe(true);
});

test("the category shape rides every technique row, in Explore and inside a list", async ({ page }) => {
  const j = await journey(page, { seed: 7 });
  await j.boot("/");
  const ids = await seedList(page);
  await page.waitForTimeout(500);

  // A LIST'S ITEMS: one of each, and each wearing its own category's shape.
  const inList = await page.evaluate(
    ([classify, tr, sb]: any) => {
      const kind = eval(classify);
      const out: any = {};
      for (const row of document.querySelectorAll("[data-list-itemrow]")) {
        const id = row.getAttribute("data-list-itemrow")!;
        const g = row.firstElementChild?.firstElementChild as HTMLElement | null;
        out[id === tr ? "transition" : id === sb ? "submission" : "position"] = g ? kind(g) : "none";
      }
      return out;
    },
    [CLASSIFY, ids.tr, ids.sb],
  );
  expect(inList).toEqual({ position: "circle", transition: "diamond", submission: "triangle" });

  // EXPLORE'S LEAF ROWS (inside a family fold) used to render no glyph at all.
  const inFold = await page.evaluate((classify: string) => {
    const kind = eval(classify);
    const head = [...document.querySelectorAll("[data-explore-section]")].find((e) =>
      (e.textContent || "").startsWith("Submissions"),
    ) as HTMLElement;
    head.click();
    // open the first family fold that has one (a fold row carries a chevron, not a +)
    const fold = [...document.querySelectorAll("button")].find(
      (b) => /▸$/.test((b.textContent || "").trim()) && b.style.paddingLeft === "22px",
    ) as HTMLElement | undefined;
    fold?.click();
    const leaf = document.querySelector('[data-list-add]')?.parentElement?.firstElementChild;
    const g = leaf?.firstElementChild as HTMLElement | null;
    return g ? kind(g) : "none";
  }, CLASSIFY);
  expect(inFold, "a technique in a family fold says what it is").not.toBe("none");
});
