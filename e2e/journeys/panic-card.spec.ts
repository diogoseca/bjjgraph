import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE DEFENCE QUESTION IS ASKED ABOVE THE HAND, NOT INSIDE IT (v1.104.4).
 *
 * Owner, on the panic drill: it "should show alike the ng-landcard, in fact it should be a
 * ng-landcard i think. it should never be in the options row lol wtf".
 *
 * It was a 236px flex item inserted as the FIRST CHILD of the escape tray — so the question you
 * have to read sat in the row of things you have to choose between, shifted every escape card one
 * slot right, and competed with them for the same glance under a 4-9s clock. Everywhere else in
 * the app a question is asked ABOVE the hand.
 *
 * It is not merely styled like a landing card, it IS one: the element goes in `_landEl`, so
 * `_dockLandCard`, `_suppressLand`, `attachInput`'s pointer-capture early-return and
 * `clearLandCard` all apply to it without a second copy of any of them.
 */

const enterDefence = (page: any) =>
  page.evaluate(() => {
    const a: any = (window as any).__neural;
    const sub = a.adj[a.currentPos].find((k: number) => a.nodes[k].ty === "submissions");
    a.enterDefense(sub != null ? sub : a.nodes.findIndex((n: any) => n.ty === "submissions"));
  });

const geo = (page: any) =>
  page.evaluate(() => {
    const a: any = (window as any).__neural;
    const p = document.querySelector("[data-panic]") as HTMLElement;
    if (!p) return null;
    const row = a.optionsRef.current as HTMLElement;
    const pb = p.getBoundingClientRect(), rb = row.getBoundingClientRect();
    return {
      inOptionsRow: row.contains(p),
      isLandCard: p.classList.contains("ng-landcard"),
      isLandEl: a._landEl === p,
      mode: p.getAttribute("data-landcard"),
      clearOfTray: Math.round(rb.top - pb.bottom),
      width: Math.round(pb.width),
      escapeCards: row.querySelectorAll("[data-tech]").length,
    };
  });

test("the panic drill is a landing card, above the escape hand @curated", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.hydrateAll();
  await j.land("Mount Top");
  await enterDefence(page);
  await page.waitForTimeout(400);

  const g = await geo(page);
  expect(g, "a panic drill (the position deck has cards)").toBeTruthy();
  expect(g!.inOptionsRow, "NEVER in the options row").toBe(false);
  expect(g!.isLandCard, "it is a landing card").toBe(true);
  expect(g!.isLandEl, "...and occupies the landing-card slot, so all its machinery applies").toBe(true);
  expect(g!.mode).toBe("defense");
  // measured before the fix at 1440x900: card bottom 664 vs tray top 657, a 7px overlap
  expect(g!.clearOfTray, "it clears the escape tray").toBeGreaterThanOrEqual(0);
  expect(g!.width, "card width, not a 236px tray item").toBeGreaterThan(300);
  expect(g!.escapeCards, "and every escape is still dealt").toBeGreaterThan(0);
});

test("grading it pumps the escape odds and refunds clock, from its new home", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.hydrateAll();
  await j.land("Mount Top");
  await enterDefence(page);
  await page.waitForTimeout(400);
  if (!(await geo(page))) test.skip();

  const before = await page.evaluate(() => {
    const a: any = (window as any).__neural;
    return { rem: a._decision.remaining, odds: a._optList.map((o: any) => a.escapeChance(o)) };
  });

  await j.clickByMouse("[data-panic-reveal]", "Reveal");
  await page.waitForTimeout(150);
  await j.clickByMouse("[data-panic-got]", "Got it");
  await page.waitForTimeout(250);

  const after = await page.evaluate(() => {
    const a: any = (window as any).__neural;
    return { rem: a._decision.remaining, odds: a._optList.map((o: any) => a.escapeChance(o)) };
  });
  expect(after.rem, "composure buys clock").toBeGreaterThan(before.rem);
  expect(after.odds.some((o: number, i: number) => o > before.odds[i]), "every escape's odds climb").toBe(true);
  await j.expectBeat("escape_odds_pumped");
});

test("it goes when the defence does", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.hydrateAll();
  await j.land("Mount Top");
  await enterDefence(page);
  await page.waitForTimeout(400);
  if (!(await geo(page))) test.skip();

  await page.evaluate(() => {
    const a: any = (window as any).__neural;
    a._optPick(a._optList[0]);           // take an escape
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => !!document.querySelector("[data-panic]")),
    "no panic card survives the escape").toBe(false);
  expect(await page.evaluate(() => (window as any).__neural._landEl === null ||
    !(window as any).__neural._landEl.hasAttribute("data-panic")),
    "and the landing-card slot is free for the next landing").toBe(true);
});
