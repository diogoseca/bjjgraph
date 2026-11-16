import { expect, test, type Browser, type Page } from "@playwright/test"
import { journey } from "../dsl"
import { installNeuralAuthSDK, signInNeuralAuthSDK, waitNeuralAuthOwner } from "../fixtures/neural-auth-sdk"

/**
 * A POSITION STARRED IN ONE BROWSER, SEEN FROM ANOTHER (v1.280.3, STAR1). The owner, 15 Nov: "it's also strange that the favorite
 * star now appears in another browser... double check pls". Read as "a position he starred in one browser shows starred in
 * another": signed in to the SAME account in both, that is the lists syncing as designed (`_pushCloud` writes the account's row,
 * `_pullAndMerge` pulls it and `ngMergeLists` unions it, add-wins; local storage is keyed per owner, `ngProgressLocalKey`). This
 * journey holds the design AND its three must-nots, with two (three) real browser contexts sharing one synthetic backend:
 *  1. same account, two browsers: the star saved in browser X reads saved in browser Y (the backend holds something);
 *  2. signed OUT in Y: not saved, and A's list is not among Y's lists;
 *  3. ANOTHER account (B) in Y: not saved, A's list not among B's, and no write of B's carries it;
 *  4. a GUEST's browser (Z, never signed in): its list never leaves it (no write at all), and A never has it.
 * THE BACKEND: `e2e/fixtures/neural-auth-sdk.ts` keeps its synthetic `user_training_data` per browser context (sessionStorage),
 * so the one backend is modelled by copying the account's row from the browser that wrote it into the next one before that one
 * reads (`cloudOf` -> `seedCloud`). Nothing else is copied; each context's local storage is its own, as two browsers' are.
 * Every save is a player's: the seat's star pressed by mouse, the list picked in its menu by mouse.
 * NO MUTANT: the must-nots are what the app already does (no fault was found). The same-account case is the positive control
 * that keeps them from passing on an empty backend: it fails unless A's row really reached browser Y.
 */

type W = any
const A = "two-browsers-a", B = "two-browsers-b"
const SEAT = '[data-seat-star][data-list-add="Positions/Mount"]'

async function browserAt(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  const j = journey(page)
  await j.boot("/", {
    keepTutorial: true,
    beforeNavigate: async (p) => {
      await installNeuralAuthSDK(p)
      await p.route(/\/app\/game-values\.js(?:\?|$)/, (route) => route.abort("failed"))
    },
  })
  await waitNeuralAuthOwner(page, null)
  return { ctx, page, j, errors }
}
const listNames = (page: Page) => page.evaluate(() => Object.values((window as W).__neural.lists || {}).map((l: W) => l.name).sort())
const fixture = (page: Page) => page.evaluate(() => (window as W).__authOwnerFixture.snapshot())
/** Mount Top landed, settled, any earned patch closed: the seat's star is where a player presses it. */
async function atMount(page: Page, j: ReturnType<typeof journey>) {
  await j.land("Mount Top")
  await j.advance(1500)
  if (await page.locator("[data-reward-close]").isVisible()) { await j.clickByMouse("[data-reward-close]", "dismiss the earned patch"); await j.advance(600) }
  await expect(page.locator(SEAT)).toHaveCount(1)
}
/** The seat's star pressed, a list picked in its menu: Mount saved there. */
async function saveMount(page: Page, j: ReturnType<typeof journey>, list: string) {
  await page.evaluate((name) => (window as W).__neural.newList(name), list)
  await j.clickByMouse(SEAT, "the seat star")
  await expect(page.locator("[data-list-picker]")).toBeVisible()
  await j.clickByMouse("[data-list-pick]", "the list " + list)
  await expect(page.locator(SEAT)).toHaveAttribute("data-list-saved", "true")
  await page.evaluate(() => (window as W).__neural._flushSave())
}
const share = async (from: Page, to: Page, id: string) => {
  const row = await from.evaluate((id) => (window as W).__authOwnerFixture.cloudOf(id), id)
  expect(row, `the backend holds ${id}'s row`).not.toBeNull()
  await to.evaluate(([id, row]) => (window as W).__authOwnerFixture.seedCloud(id, row), [id, row] as const)
}

test("a starred position: synced to the same account in another browser, never to a guest, another account, or from a guest", async ({ browser }) => {
  test.setTimeout(240_000)
  const X = await browserAt(browser), Y = await browserAt(browser), Z = await browserAt(browser)
  try {
    // X, signed in as A, stars Mount into "A practice": the account's row carries it
    await signInNeuralAuthSDK(X.page, A)
    await atMount(X.page, X.j)
    await saveMount(X.page, X.j, "A practice")
    await expect.poll(async () => (await fixture(X.page)).writes.filter((r: W) => r.user_id === A && Object.values(r.neural.lists || {}).some((l: W) => l.name === "A practice")).length,
      { message: "A's row in the backend carries the star" }).toBeGreaterThan(0)

    // Z, a guest who never signs in, stars Mount too: nothing leaves Z
    await atMount(Z.page, Z.j)
    await saveMount(Z.page, Z.j, "Z guest practice")
    await Z.j.advance(2000)
    expect((await fixture(Z.page)).writes, "a guest's browser writes nothing to any account").toEqual([])

    // Y signed OUT, with the backend holding A's row: not saved
    await share(X.page, Y.page, A)
    await atMount(Y.page, Y.j)
    await expect(Y.page.locator(SEAT), "signed out: not saved").toHaveAttribute("data-list-saved", "false")
    expect(await listNames(Y.page), "signed out: none of A's lists").toEqual([])

    // Y signed in as ANOTHER account, B: not saved, A's list not B's, and B writes none of it
    await signInNeuralAuthSDK(Y.page, B)
    await atMount(Y.page, Y.j)
    await expect(Y.page.locator(SEAT), "another account: not saved").toHaveAttribute("data-list-saved", "false")
    expect(await listNames(Y.page), "another account: none of A's lists").not.toContain("A practice")
    await Y.j.advance(2000)
    for (const r of (await fixture(Y.page)).writes) expect(Object.values(r.neural.lists || {}).map((l: W) => l.name), "no write of B's carries A's list").not.toContain("A practice")

    // Y signed in as A (out of B first, through the facade's own event): the same account, so the star reads saved (the design)
    await Y.page.evaluate(() => (window as W).__authOwnerFixture.emit("SIGNED_OUT", null))
    await waitNeuralAuthOwner(Y.page, null)
    await share(X.page, Y.page, A)
    await signInNeuralAuthSDK(Y.page, A)
    await atMount(Y.page, Y.j)
    await expect(Y.page.locator(SEAT), "the same account in another browser: saved").toHaveAttribute("data-list-saved", "true")
    expect(await listNames(Y.page), "the same account: its list arrived, and nothing of Z's").toEqual(["A practice"])
    for (const r of (await fixture(Y.page)).writes) expect(Object.values(r.neural.lists || {}).map((l: W) => l.name), "A never takes Z's guest list").not.toContain("Z guest practice")
    for (const s of [X, Y, Z]) expect(s.errors, "page errors").toEqual([])
  } finally {
    for (const s of [X, Y, Z]) await s.ctx.close()
  }
})
