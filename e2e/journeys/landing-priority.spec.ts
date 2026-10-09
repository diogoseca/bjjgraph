import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE LANDING CARD'S PRIORITY LAW.
 *
 * The timed question remains a separate surface from the complete published article.
 * Issue #289 replaces the old More fold with visible, independently scrollable prose.
 * Reading must not append deep content to the question, reshuffle it, or score a miss.
 * Surfaces: [data-landcard], [data-land-film], [data-land-q], [data-reader].
 */

test("the landing shows film, then the question — in that order @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  const card = page.locator("[data-landcard]");
  await expect(card).toBeVisible();

  // DOM order is the question's read order. The independent article owns prose;
  // swipe guides and the film remain siblings outside the timed card.
  const order = await card.evaluate((el) =>
    Array.from(el.children)
      .filter((c) => !c.hasAttribute("data-land-corner") && !c.hasAttribute("data-land-clock-track"))
      .map((c) =>
        c.hasAttribute("data-land-film")
          ? "film"
          : c.hasAttribute("data-land-q")
            ? "q"
            : c.hasAttribute("data-land-nav")
              ? "nav"
            : "other",
      ),
  );
  expect(order.indexOf("other"), "nothing unaccounted for above the question").toBe(-1);
  const qi = order.indexOf("q");
  expect(qi, "the question is present, and it is at the top or just under the film").toBeGreaterThanOrEqual(0);
  expect(order.indexOf("nav"), "swipe guides live outside the question card").toBe(-1);
  await expect(page.locator("[data-land-nav]")).toHaveCount(1);
  // v1.101.1: film is no longer a CHILD of the card — it is its own strip docked immediately
  // above it, so "before the question" is a geometry claim now, not a DOM-order one.
  expect(order.indexOf("film"), "the film row is not inside the card any more").toBe(-1);
  const filmGeom = await page.evaluate(() => {
    const a = (window as any).__neural;
    const f = a._landFilmEl, c = a._landEl;
    if (!f || !c) return null;
    const fr = f.getBoundingClientRect(), cr = c.getBoundingClientRect();
    return { inside: c.contains(f), filmBottom: Math.round(fr.bottom), cardTop: Math.round(cr.top) };
  });
  if (filmGeom) {
    expect(filmGeom.inside, "the film strip is a sibling of the card, not a child").toBe(false);
    expect(
      filmGeom.filmBottom,
      "and it sits immediately above it",
    ).toBeLessThanOrEqual(filmGeom.cardTop + 1);
  }
  expect(
    await card.locator("[data-land-more-body]").count(),
    "the fuller body is never a landing-card child",
  ).toBe(0);
});

test("the graph owns identity; the timed card keeps only a quiet deck count", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  // v1.101.1: the landing card has NO header block — the question shows the moment it does.
  await expect(page.locator("[data-land-id]")).toHaveCount(0);
  // the card minus the question: a flashcard may legitimately name the state it is asking about
  const txt = await page.evaluate(() => {
    const c = document.querySelector("[data-landcard]") as HTMLElement;
    if (!c) return "";
    const clone = c.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-land-q]").forEach((q) => q.remove());
    return clone.textContent || "";
  });

  const expected = await page.evaluate(() => {
    const a = (window as any).__neural;
    const t = a.nodes[a.currentPos].t;
    // posFamily, NOT splitName: the visual graph collapses a position to one hub node titled
    // "… Top", and this spec used to assert that stale suffix appeared on the card — which is
    // exactly the self-contradiction WIN 2 removed ("Mount Top" over "Bottom"). The state's name
    // is role-free; the side is named once, on the line below it.
    return {
      main: a.posFamily(t),
      title: t,
      role: a.roleLabel(),
      other: a.playerRole === "bottom" ? "top" : "bottom",
    };
  });
  // v1.101.0 moved the name and side onto the graph. v1.175.0 keeps the deck count in the timed
  // card, as bare text under the corner buttons — no glyph, no pill, no name, no side.
  expect(txt, "the state's name is the graph's job now").not.toContain(expected.main);
  expect(
    txt,
    `nor either side (title is ${expected.title})`,
  ).not.toMatch(new RegExp(`\\b(${expected.role}|${expected.other})\\b`, "i"));
  await expect(page.locator("[data-landcard] [data-land-corner] [data-land-count]")).toHaveCount(1);
  await expect(page.locator(".ng-landmore [data-land-count]")).toHaveCount(0);
  expect(txt, "no familiarity glyph leaks into the timed card").not.toMatch(/[○◐●]/);
});

test("the complete article stays separate from the timed question", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const card = page.locator("[data-landcard]");
  const article = page.locator('[data-reader-ready="true"] [data-reader-body]');
  await expect(article).toContainText("Mount");
  const question = await card.textContent();
  expect(await card.locator("article").count()).toBe(0);
  await expect(page.locator("[data-land-more]")).toHaveCount(0);
  await article.focus();
  expect(await page.evaluate(() => !!(window as any).__neural.paused)).toBe(true);
  expect(await card.textContent(), "reading leaves the question's text intact").toBe(question);
  expect(await page.evaluate(() => (window as any).__neural._dossierIdx ?? null)).toBeNull();
});

test("turning questions off leaves the landing surface but asks nothing", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await expect(page.locator("[data-land-q]"), "on by default").toBeVisible();

  await page.evaluate(() => {
    const a = (window as any).__neural;
    a.set("landQuestions", false);
    a._landQ = null;
    a.renderLandCard(a.nodes[a.currentPos], "land", null);
  });
  await expect(
    page.locator("[data-land-q]"),
    "the question is gone",
  ).toHaveCount(0);
  await expect(
    page.locator("[data-landcard]"),
    "but the remaining landing controls stay available",
  ).toBeVisible();

  await page.evaluate(() => {
    const a = (window as any).__neural;
    a.set("landQuestions", true);
    a._landQ = null;
    a.renderLandCard(a.nodes[a.currentPos], "land", null);
  });
  await expect(
    page.locator("[data-land-q]"),
    "and back on when re-enabled",
  ).toBeVisible();
});

test("a state you have proven greets you without a question", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  await page.evaluate(() => {
    const a = (window as any).__neural;
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key;
    for (const c of a.flashcards.decks[key].cards) a._bumpStage(key, c.q, 4);
    a._landQ = null;
    a.renderLandCard(a.nodes[a.currentPos], "land", null);
  });

  await expect(
    page.locator("[data-land-q]"),
    "nothing left to ask",
  ).toHaveCount(0);
  await expect(
    page.locator("[data-landcard]"),
    "the remaining landing controls stay available",
  ).toBeVisible();
  await expect(page.locator("[data-landcard] [data-land-corner] [data-land-count]"), "the count stays").toHaveCount(1);
  await expect(page.locator(".ng-landmore [data-land-count]")).toHaveCount(0);
});
