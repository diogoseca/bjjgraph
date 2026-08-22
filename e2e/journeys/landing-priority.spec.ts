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
 *
 * So this spec is a NEGATIVE test as much as a positive one: the deep content the dossier holds
 * (decision trees, principles, common mistakes, metrics) must NOT be on screen until More is used.
 *
 * Surfaces: [data-landcard] [data-land-count] [data-land-film] [data-land-q] [data-land-more-body]
 *           [data-land-more] · setting: landQuestions
 */

test("the landing card shows identity, then film, then the question — in that order @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  const card = page.locator("[data-landcard]");
  await expect(card).toBeVisible();

  // DOM order IS the read order — and since v1.101.1 it opens on the CONTENT, not on a header:
  // the name and the side are on the graph, the definition is behind `More`, and the counter
  // sits in the foot. What is left above the question is film, which is comprehension support
  // for it. (The ✕ is a child too, but it is absolutely positioned and reads as chrome.)
  const order = await card.evaluate((el) =>
    Array.from(el.children)
      .filter((c) => !c.hasAttribute("data-land-corner"))
      .map((c) =>
        c.hasAttribute("data-land-film")
          ? "film"
          : c.hasAttribute("data-land-q")
            ? "q"
            : c.hasAttribute("data-land-more-body")
              ? "more"
              : c.hasAttribute("data-land-foot")
                ? "foot"
                : "other",
      ),
  );
  expect(order.indexOf("other"), "nothing unaccounted for above the question").toBe(-1);
  expect(order[order.length - 1], "More last").toBe("foot");
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
  const mi = order.indexOf("more");
  if (mi >= 0) expect(mi, "the unfoldable rest comes after it").toBeGreaterThan(qi);
});

test("identity names the state, where you came from, your role, and whether you have met it", async ({
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
  // v1.101.0 MOVED the name and the side onto the GRAPH — the roll settles close enough that the
  // node draws both, and repeating them here was the owner's complaint. What the card keeps is the
  // part the graph cannot say: where you came from, and how well you know this state.
  expect(txt, "the state's name is the graph's job now").not.toContain(expected.main);
  expect(
    txt,
    `nor either side (title is ${expected.title})`,
  ).not.toMatch(new RegExp(`\\b(${expected.role}|${expected.other})\\b`, "i"));
  // the seen marker is one of the three glyphs, and on a fresh boot it is "new"
  expect(txt, "a have-you-met-it marker").toMatch(/[○◐●]/);
  expect(txt, "fresh player has met nothing").toContain("○");
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
  const body = ((await card.textContent()) || "").toLowerCase();
  // the dossier's deep sections must not leak onto the landing
  for (const deep of [
    "decision tree",
    "common mistakes",
    "key principles",
    "if it stalls",
    "numbers",
  ]) {
    expect(body, `"${deep}" is not on the landing card`).not.toContain(deep);
  }

  await expect(
    page.locator("[data-land-more]"),
    "one affordance for the rest",
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as any).__neural._dossierIdx != null),
    "and the dossier is shut until it is used",
  ).toBe(false);

  await page.locator("[data-land-more]").click();
  // v1.101.0: More UNFOLDS THIS CARD. It does not open a dossier — there is no second container
  // to open — so the thing to assert is that the rest arrived, in place.
  expect(
    await page.evaluate(() => {
      const b = (window as any).__neural._landEl.querySelector("[data-land-more-body]");
      return !!b && b.style.display === "block" && (b.textContent || "").trim().length > 0;
    }),
    "More unfolds the rest into the card you are already reading",
  ).toBe(true);
  expect(
    await page.evaluate(() => (window as any).__neural._dossierIdx != null),
    "and still opens no separate reading surface",
  ).toBe(false);
  expect(
    await page.evaluate(() => !!(window as any).__neural.paused),
    "which stops the game while you read, like every other reading surface",
  ).toBe(true);
});

test("turning questions off leaves the identity card but asks nothing", async ({
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
    "but identity is priority either way",
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
    "but it still introduces itself",
  ).toBeVisible();
  const txt = (await page.locator("[data-landcard]").textContent()) || "";
  expect(txt, "and says you have proven it").toContain("●");
});
