import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

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
 * Surfaces: [data-landcard] [data-land-id] [data-land-def] [data-land-film] [data-land-q]
 *           [data-land-more] · setting: landQuestions
 */

test("the landing card shows identity, then film, then the question — in that order @curated", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const card = page.locator("[data-landcard]")
  await expect(card).toBeVisible()

  // DOM order IS the read order the owner specified
  const order = await card.evaluate((el) =>
    Array.from(el.children).map((c) =>
      c.hasAttribute("data-land-id")
        ? "id"
        : c.hasAttribute("data-land-def")
          ? "def"
          : c.hasAttribute("data-land-film")
            ? "film"
            : c.hasAttribute("data-land-q")
              ? "q"
              : "foot",
    ),
  )
  expect(order[0], "identity first").toBe("id")
  expect(order[order.length - 1], "More last").toBe("foot")
  const qi = order.indexOf("q")
  expect(qi, "the question is present").toBeGreaterThan(0)
  for (const earlier of ["def", "film"]) {
    const i = order.indexOf(earlier)
    if (i >= 0) expect(i, `${earlier} comes before the question`).toBeLessThan(qi)
  }
})

test("identity names the state, where you came from, your role, and whether you have met it", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const id = page.locator("[data-land-id]")
  await expect(id).toBeVisible()
  const txt = (await id.textContent()) || ""

  const expected = await page.evaluate(() => {
    const a = (window as any).__neural
    return { main: a.splitName(a.nodes[a.currentPos].t).main, role: a.roleLabel() }
  })
  expect(txt, "the state's name").toContain(expected.main)
  expect(txt.toLowerCase(), "which side you are playing").toContain(expected.role.toLowerCase())
  // the seen marker is one of the three glyphs, and on a fresh boot it is "new"
  expect(txt, "a have-you-met-it marker").toMatch(/[○◐●]/)
  expect(txt, "fresh player has met nothing").toContain("○")
})

test("everything that is NOT priority stays behind More", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const card = page.locator("[data-landcard]")
  const body = ((await card.textContent()) || "").toLowerCase()
  // the dossier's deep sections must not leak onto the landing
  for (const deep of [
    "decision tree",
    "common mistakes",
    "key principles",
    "if it stalls",
    "numbers",
  ]) {
    expect(body, `"${deep}" is not on the landing card`).not.toContain(deep)
  }

  await expect(page.locator("[data-land-more]"), "one affordance for the rest").toBeVisible()
  expect(
    await page.evaluate(() => (window as any).__neural._dossierIdx != null),
    "and the dossier is shut until it is used",
  ).toBe(false)

  await page.locator("[data-land-more]").click()
  expect(
    await page.evaluate(() => (window as any).__neural._dossierIdx != null),
    "More opens the node's full dossier",
  ).toBe(true)
  expect(
    await page.evaluate(() => !!(window as any).__neural.paused),
    "which stops the game while you read, like every other reading surface",
  ).toBe(true)
})

test("turning questions off leaves the identity card but asks nothing", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await expect(page.locator("[data-land-q]"), "on by default").toBeVisible()

  await page.evaluate(() => {
    const a = (window as any).__neural
    a.set("landQuestions", false)
    a.renderLandCard(a.nodes[a.currentPos], "land", null)
  })
  await expect(page.locator("[data-land-q]"), "the question is gone").toHaveCount(0)
  await expect(page.locator("[data-land-id]"), "but identity is priority either way").toBeVisible()

  await page.evaluate(() => {
    const a = (window as any).__neural
    a.set("landQuestions", true)
    a.renderLandCard(a.nodes[a.currentPos], "land", null)
  })
  await expect(page.locator("[data-land-q]"), "and back on when re-enabled").toBeVisible()
})

test("a state you have proven greets you without a question", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    for (const c of a.flashcards.decks[key].cards) a._bumpStage(key, c.q, 4)
    a.renderLandCard(a.nodes[a.currentPos], "land", null)
  })

  await expect(page.locator("[data-land-q]"), "nothing left to ask").toHaveCount(0)
  await expect(page.locator("[data-land-id]"), "but it still introduces itself").toBeVisible()
  const txt = (await page.locator("[data-land-id]").textContent()) || ""
  expect(txt, "and says you have proven it").toContain("●")
})
