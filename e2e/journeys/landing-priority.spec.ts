import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE LANDING CARD'S PRIORITY LAW.
 *
 * Owner's rule for what a landing may show, in order: the title, a one- or two-phrase description,
 * where you came from, your role, whether you have done this — then film, then the question, then
 * the multiple choice, then your options. And then: "if it's not priority, if it's not video, if
 * it's not that quick explanation, if it's not the Q&A, if it's not multiple choice, if it's not
 * the choices out of this — then it doesn't matter. If it doesn't matter, it should be hidden and
 * only shown if the user clicks to show more."
 * v1.174.0 makes the boundary structural: More and the retained familiarity control share a
 * root-plane sibling; expanding it must never append to or mutate the timed landing card.
 *
 * So this spec is a NEGATIVE test as much as a positive one: the deep content the dossier holds
 * (decision trees, principles, common mistakes, metrics) must NOT be in the landing card before
 * or after More is used.
 *
 * Surfaces: [data-landcard] [data-land-film] [data-land-q] [data-land-more-body]
 *           .ng-landmore [data-land-more] [data-land-count] · setting: landQuestions
 */

test("the landing shows film, then the question — in that order @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  const card = page.locator("[data-landcard]");
  await expect(card).toBeVisible();

  // DOM order IS the landing card's read order. The graph owns name and side; the definition
  // stays behind More, while More and familiarity share a root-plane sibling below the dealt
  // choices. Neither adds a footer or content child to the timed card.
  const order = await card.evaluate((el) =>
    Array.from(el.children)
      .filter((c) => !c.hasAttribute("data-land-corner") && !c.hasAttribute("data-land-clock-track"))
      .map((c) =>
        c.hasAttribute("data-land-film")
          ? "film"
          : c.hasAttribute("data-land-q")
            ? "q"
            : "other",
      ),
  );
  expect(order.indexOf("other"), "nothing unaccounted for above the question").toBe(-1);
  const qi = order.indexOf("q");
  expect(qi, "the question is present, and it is at the top or just under the film").toBeGreaterThanOrEqual(0);
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

test("the graph owns identity; familiarity stays outside the timed card", async ({
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
  // v1.101.0 moved the name and side onto the graph. v1.174.0 moves the retained familiarity
  // control with More into the detached row, leaving the timed card to its question and chrome.
  expect(txt, "the state's name is the graph's job now").not.toContain(expected.main);
  expect(
    txt,
    `nor either side (title is ${expected.title})`,
  ).not.toMatch(new RegExp(`\\b(${expected.role}|${expected.other})\\b`, "i"));
  await expect(page.locator("[data-landcard] [data-land-count]")).toHaveCount(0);
  await expect(page.locator(".ng-landmore [data-land-count]")).toHaveCount(1);
  expect(txt, "no familiarity glyph leaks into the timed card").not.toMatch(/[○◐●]/);
});

test("everything that is NOT priority stays behind More", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  // v1.101.9: a state with nothing behind `More` renders no `More`. Author one, so this journey
  // is about what stays BEHIND the fold rather than about whether the fold exists.
  await page.evaluate(() => {
    const a = (window as any).__neural;
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key;
    const w = window as any;
    w.NG_CONTENT = w.NG_CONTENT || {};
    w.NG_CONTENT.decks = w.NG_CONTENT.decks || {};
    w.NG_CONTENT.decks[key] = { def: "Seeded.", principles: ["Seeded principle"] };
    a._landQ = null;
    a.renderLandCard(a.nodes[a.currentPos], "land", null);
  });

  const card = page.locator("[data-landcard]");
  const landingBody = ((await card.textContent()) || "").toLowerCase();
  // the dossier's deep sections must not leak onto the landing
  for (const deep of [
    "decision tree",
    "common mistakes",
    "key principles",
    "if it stalls",
    "numbers",
  ]) {
    expect(landingBody, `"${deep}" is not on the landing card`).not.toContain(deep);
  }

  await expect(
    page.locator("[data-land-more]"),
    "one affordance for the rest",
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as any).__neural._dossierIdx != null),
    "and the dossier is shut until it is used",
  ).toBe(false);

  await j.clickByMouse("[data-land-more]", "the independent More control");
  const opened = await page.evaluate(() => {
    const a = (window as any).__neural;
    const card = a._landEl as HTMLElement;
    const row = a._landMoreEl as HTMLElement;
    const detail = row && row.querySelector("[data-land-more-body]") as HTMLElement | null;
    return {
      visible: !!detail && detail.style.display === "block" && (detail.textContent || "").trim().length > 0,
      separate: !!detail && row.contains(detail) && !card.contains(detail),
      expanded: row && row.classList.contains("open"),
      landingText: (card.textContent || "").toLowerCase(),
    };
  });
  expect(opened.visible, "More fills its own card with the fuller rows").toBe(true);
  expect(opened.separate, "the reading card is a sibling, never a landing-card child").toBe(true);
  expect(opened.expanded, "the More surface itself becomes that card").toBe(true);
  expect(opened.landingText, "opening More leaves the landing card's content untouched").toBe(landingBody);
  expect(
    await page.evaluate(() => (window as any).__neural._dossierIdx != null),
    "and still does not enter the node dossier",
  ).toBe(false);
  expect(
    await page.evaluate(() => !!(window as any).__neural.paused),
    "the independent reading card stops the game while it is open",
  ).toBe(true);
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
  await expect(page.locator("[data-landcard] [data-land-count]")).toHaveCount(0);
  await expect(page.locator(".ng-landmore [data-land-count]"), "study remains available").toHaveCount(1);
});
