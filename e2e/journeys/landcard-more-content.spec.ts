import { test, expect, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/**
 * More's authored content, seat boundary, and independent lifetime.
 *
 * The DSL deliberately serves {} for dossier chunks. These tests AUTHOR their content; the
 * corpus/source-to-emitted-data contract belongs to the dossier unit suite. Assertions read the
 * real renderer's DOM, never a second renderer. The late-arrival case additionally holds a real
 * _hydrateContent request, so calling a hook alone cannot satisfy the arrival claim.
 *
 * Coverage limits: these fixtures do not certify medical advice, calibrated probabilities,
 * screen-reader speech, or touch scrolling. The existing roll-card journeys cover wheel/touch
 * column geometry. Search/index loading is covered separately by alias-search.spec.ts.
 */

type Dossier = Record<string, any>
const BODY = "[data-land-more-body]"
const ALIASES = ["Knee Mount", "Knee on Stomach", "Knee on Chest", "KOB", "Uki Gatame", "Joelho na Barriga", "Seventh authored alias"]
const LONG_CUE = "Preserve the connection while your partner changes direction, keeping the near elbow and knee aligned before moving your weight. ".repeat(3) + "THE ENTIRE CUE ENDS HERE."
const SAFETY = {
  notice: "Practise only with qualified supervision; release immediately when your partner taps.",
  risks: Array.from({ length: 5 }, (_, i) => ({ i: `Authored injury risk ${i + 1}`, sev: i ? "moderate" : "severe" })),
  speed: "Apply controlled pressure and leave your partner time to signal. ".repeat(5) + "FINAL APPLICATION SENTENCE.",
  tap: Array.from({ length: 5 }, (_, i) => `Tap signal ${i + 1}: stop as soon as this signal is recognised.`),
  release: Array.from({ length: 5 }, (_, i) => `Release action ${i + 1}: maintain control while removing all finishing pressure.`),
  restrictions: ["Training restriction one: use a qualified supervisor.", "FINAL TRAINING RESTRICTION: do not continue after a stop signal."],
}

const position = (role: "Top" | "Bottom"): Dossier => ({
  cat: "Position", role,
  lead: `${role} authored summary.`,
  def: "Master this position in BJJ. SEO FALLBACK SHOULD NOT REPLACE THE SUMMARY.",
  aka: ALIASES,
  confuse: [{ n: "A different position", why: "The knee and hip contact points differ." }],
  props: { pts: role === "Top" ? 4 : -4, type: role === "Top" ? "Offensive" : "Defensive", risk: "Low", energy: "Low", time: "Long hold" },
  principles: [LONG_CUE, "Keep a connected frame."],
  decisionTree: Array.from({ length: 4 }, (_, i) => ({ cond: `Authored condition ${i + 1}`, acts: [[`Authored move ${i + 1}`, 73, "Mount"]] })),
  mistakes: [{ err: "Reaching without a base", why: "It exposes the supporting arm.", fix: "Establish the base first." }],
  variations: ["Named positional variation"], varNote: { "Named positional variation": "Use when the opponent turns toward you." },
  drills: [{ n: "Controlled recovery drill", dur: "3 minutes" }],
  related: ["Related position sentinel"],
})

const technique = (): Dossier => ({
  cat: "Submission", lead: "A submission-specific authored definition.",
  aka: ["Own variant alias"],
  family: { name: "Ezekiel Choke", aka: ["Sode Guruma Jime", "Family's second alias"], confuse: [{ n: "A different choke", why: "Its finishing grip differs." }] },
  kind: { cat: "Choke", type: "Blood choke", area: "Carotid arteries" },
  safety: SAFETY,
  outcomes: [{ result: "Success", position: "Game Over", prob: 55, tone: "good" }],
  related: ["Related technique sentinel"],
  variations: ["Alternate grip"], varNote: { "Alternate grip": "Use when the sleeve is available." },
  perspectives: {
    attacker: {
      summary: "ATTACKER ONLY summary.", recognition: ["ATTACKER ONLY recognition."],
      prerequisites: ["ATTACKER ONLY prerequisite."],
      steps: Array.from({ length: 8 }, (_, i) => `Execution step ${i + 1}: ${i === 7 ? LONG_CUE : "Preserve a stable connection."}`),
      principles: ["ATTACKER ONLY principle."], counters: ["ATTACKER ONLY counter."],
      mistakes: [{ err: "ATTACKER ONLY mistake.", fix: "ATTACKER ONLY correction." }],
    },
    defender: {
      authored: true, summary: "DEFENDER ONLY summary.", recognition: ["DEFENDER ONLY recognition."],
      principles: ["DEFENDER ONLY principle."],
      options: [{ move: "Recover the defensive frame", when: "Before the grip closes", leadsTo: "Guard recovery" }],
      mistakes: [{ err: "DEFENDER ONLY mistake.", fix: "DEFENDER ONLY correction." }],
      bestOutcomes: ["ATTACKER OUTCOME MUST NOT LEAK"],
    },
  },
})

/** Install a dossier for the CURRENT rendered surface, using its actual production lookup key.
 * Data installation is fixture setup; onContentReady is the same invalidation that fetch uses.
 */
async function seedCurrent(page: Page, dossier: Dossier) {
  return page.evaluate((value) => {
    const w = window as any, a = w.__neural
    const n = a.nodes[a._defendSub != null ? a._defendSub : a._landIdx != null ? a._landIdx : a.currentPos]
    const key = n.ty === "positions" ? a.deckKeyFor(n).key : n.t
    w.NG_CONTENT ||= {}; w.NG_CONTENT.decks ||= {}
    w.NG_CONTENT.decks[key] = value
    a.onContentReady(key)
    return { key, name: n.t, role: n.role }
  }, dossier)
}

async function openMore(page: Page, j: ReturnType<typeof journey>) {
  await expect(page.locator("[data-land-more]")).toHaveCount(1)
  await expect(page.locator("[data-land-more]")).toBeVisible()
  await j.advance(250)
  await j.clickByMouse("[data-land-more]", "More's own mouse target")
  await expect(page.locator("[data-land-more]")).toHaveAttribute("aria-expanded", "true")
  await expect(page.locator(BODY)).toBeVisible()
}

async function expectSafety(page: Page) {
  const safety = page.locator(`${BODY} [data-land-safety]`)
  await expect(safety).toHaveCount(1)
  for (const row of SAFETY.risks) await expect(safety).toContainText(row.i)
  for (const text of [...SAFETY.tap, ...SAFETY.release, ...SAFETY.restrictions]) await expect(safety).toContainText(text)
  await expect(safety).toContainText("FINAL APPLICATION SENTENCE.")
  await expect(page.locator(`${BODY} [data-land-safety-notice]`)).toHaveText(SAFETY.notice)
  expect(await page.locator(BODY).evaluate((body) => {
    const notice = body.querySelector("[data-land-safety-notice]")!
    const instructions = body.querySelector("[data-land-steps], [data-land-options]")!
    return !!(notice.compareDocumentPosition(instructions) & Node.DOCUMENT_POSITION_FOLLOWING)
  }), "the safety notice comes before actionable instruction").toBe(true)
}

test("@curated position More reads the selected seat and complete authored sections", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  for (const role of ["Top", "Bottom"] as const) {
    if (role === "Bottom") {
      await page.keyboard.press("Escape")
      await page.evaluate(() => {
        const a = (window as any).__neural
        a.rollFromPosition(a.currentPos, true, "bottom")
      })
      await j.landSettled()
      await j.advance(500)
    }
    const selected = await seedCurrent(page, position(role))
    expect(selected.key).toBe(`Mount|${role}`)
    await openMore(page, j)
    await expect(page.locator(`${BODY} [data-land-def]`)).toHaveText(`${role} authored summary.`)
    await expect(page.locator(BODY)).not.toContainText("SEO FALLBACK")
    const aka = page.locator(`${BODY} [data-land-aka]`)
    for (const alias of ALIASES) await expect(aka).toContainText(alias)
    const aliasText = await aka.innerText()
    expect(ALIASES.map((alias) => aliasText.indexOf(alias))).toEqual(ALIASES.map((alias) => aliasText.indexOf(alias)).sort((a, b) => a - b))
    await expect(page.locator(`${BODY} [data-land-props]`)).toContainText(role === "Top" ? "Offensive" : "Defensive")
    await expect(page.locator(`${BODY} [data-land-props]`)).not.toContainText(/[-−]?4\s*(?:pts|points)/i)
    await expect(page.locator(`${BODY} [data-land-principles]`)).toContainText(LONG_CUE)
    await expect(page.locator(`${BODY} [data-land-tree]`)).toContainText("Authored condition 3")
    await expect(page.locator(`${BODY} [data-land-tree]`)).not.toContainText("Authored condition 4")
    await expect(page.locator(`${BODY} [data-land-tree]`)).not.toContainText("%")
    await expect(page.locator(`${BODY} [data-land-mistakes]`)).toContainText("It exposes the supporting arm.")
    await expect(page.locator(`${BODY} [data-land-variations]`)).toContainText("Use when the opponent turns toward you.")
    await expect(page.locator(`${BODY} [data-land-drills]`)).toContainText("3 minutes")
    await expect(page.locator(`${BODY} [data-land-related]`)).toContainText("Related position sentinel")
    await expect(page.locator(`${BODY} [data-land-safety]`)).toHaveCount(0)
  }
})

test("@curated an attacker's More preserves alias provenance, every step, and the complete safety guide", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Submissions/Ezekiel-Choke/from-Mount")
  await j.advance(8000)
  await j.landSettled()
  await seedCurrent(page, technique())
  await openMore(page, j)
  await expect(page.locator(`${BODY} [data-land-aka]`)).toContainText("Own variant alias")
  await expect(page.locator(`${BODY} [data-land-aka]`)).toContainText("Ezekiel Choke")
  await expect(page.locator(`${BODY} [data-land-aka]`)).toContainText("Family's second alias")
  await expect(page.locator(`${BODY} [data-land-kind]`)).toContainText("Carotid arteries")
  await expect(page.locator(`${BODY} [data-land-confuse]`)).toContainText("Its finishing grip differs.")
  for (let i = 1; i <= 8; i++) await expect(page.locator(`${BODY} [data-land-steps]`)).toContainText(`Execution step ${i}:`)
  await expect(page.locator(`${BODY} [data-land-steps]`)).toContainText(LONG_CUE)
  await expect(page.locator(BODY)).not.toContainText("DEFENDER ONLY")
  await expectSafety(page)
})

test("@curated a defender panic More reads escapes and safety without attacker content", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Submissions/Kimura/from-Knee-on-Belly/Defender")
  await j.advance(8000)
  await expect(page.locator("[data-panic]")).toBeVisible()
  await seedCurrent(page, technique())
  await openMore(page, j)
  await expect(page.locator(BODY)).toContainText("DEFENDER ONLY summary.")
  await expect(page.locator(`${BODY} [data-land-options]`)).toContainText("Recover the defensive frame")
  await expect(page.locator(`${BODY} [data-land-options]`)).toContainText("Before the grip closes")
  await expect(page.locator(`${BODY} [data-land-options]`)).toContainText("Guard recovery")
  await expect(page.locator(BODY)).not.toContainText("ATTACKER ONLY")
  await expect(page.locator(`${BODY} [data-land-outcomes], ${BODY} [data-land-steps], ${BODY} [data-land-counters]`)).toHaveCount(0)
  await expectSafety(page)
})

test("@curated an unauthored transition defender never falls back to the attacker", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Transitions/Kuzure-Kesa-Gatame-to-Kesa-Gatame/Defender")
  await j.advance(8000)
  await j.landSettled()
  const dossier = technique()
  dossier.cat = "Transition"
  delete dossier.safety; delete dossier.kind
  dossier.counters = ["ATTACKER ONLY legacy counter."]
  dossier.principles = ["ATTACKER ONLY legacy principle."]
  dossier.perspectives.defender = { authored: false }
  await seedCurrent(page, dossier)
  await openMore(page, j)
  await expect(page.locator(BODY)).not.toContainText("ATTACKER ONLY")
  await expect(page.locator(`${BODY} [data-land-options], ${BODY} [data-land-steps], ${BODY} [data-land-outcomes], ${BODY} [data-land-counters], ${BODY} [data-land-principles]`)).toHaveCount(0)
  await expect(page.locator("[data-panic]")).toHaveCount(0)
})

test("@curated no-content More is absent, while a wire alias alone is meaningful content", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  // Mount itself has real aliases. Author a genuinely empty state for this half, including
  // its wire/optional-index identity fallback; {} alone would be a legitimate alias-only read.
  await page.evaluate(() => {
    const a = (window as any).__neural, n = a.nodes[a._landIdx]
    delete n.aka; delete n.aliasMeta; delete n.aliases
  })
  await seedCurrent(page, {})
  await expect(page.locator("[data-land-more]")).toHaveCount(0)
  await page.evaluate(() => {
    const a = (window as any).__neural
    const n = a.nodes.find((n: any) => n.id === "Positions/Side-Control/Kesa-Gatame")
    if (!n || !n.aka) throw new Error("Fixture requires Kesa Gatame's real wire alias")
    a.rollFromPosition(n.idx, true, "top")
  })
  await j.landSettled()
  await j.advance(500)
  await seedCurrent(page, {})
  await openMore(page, j)
  await expect(page.locator(`${BODY} [data-land-aka]`)).toContainText("Scarf Hold")
  await expect(page.locator(`${BODY} [data-land-def], ${BODY} [data-land-principles]`)).toHaveCount(0)
})

for (const width of [320, 390]) {
  test(`@curated ${width}px More supports keyboard reading without operating the question`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const j = journey(page)
    await j.boot()
    await j.land("Mount Top")
    await page.evaluate(() => {
      const a = (window as any).__neural, n = a.nodes[a.currentPos]
      const key = a.deckKeyFor(n).key, cards = a._cardsOf(a.flashcards.decks[key])
      a.stage[key] = { [a.qhash(cards[0].q)]: 3 }
      const today = a._epochDay()
      a.srs[key] = { [a.qhash(cards[0].q)]: [today - 1, 3, today - 4] }
      a.settings.recallInPlay = true
      a._landQ = null
      a.renderLandCard(n, "land", null)
    })
    await expect(page.locator("[data-land-recall]")).toBeVisible()
    const dossier = position("Top")
    dossier.principles = Array.from({ length: 6 }, (_, i) => `Principle ${i + 1}. ${LONG_CUE}`)
    await seedCurrent(page, dossier)
    await openMore(page, j)
    await page.keyboard.press("Tab")
    await expect(page.locator(BODY), "keyboard focus enters the reading region").toBeFocused()
    await page.evaluate(() => {
      const w = window as any, a = w.__neural
      w.__moreQuestion = document.querySelector("[data-land-q]")
      w.__moreQuestionHTML = w.__moreQuestion.outerHTML
      w.__moreBeatCount = a.beats.filter((b: any) => ["commit", "land_q_answered", "land_q_extra"].includes(b.beat)).length
    })
    await page.keyboard.press("PageDown")
    await expect.poll(() => page.evaluate(() => (window as any).__neural._readS || 0)).toBeGreaterThan(0)
    const paged = await page.evaluate(() => (window as any).__neural._readS)
    await page.keyboard.press("Space")
    await expect.poll(() => page.evaluate(() => (window as any).__neural._readS)).toBeGreaterThan(paged)
    await page.keyboard.press("End")
    await expect.poll(() => page.evaluate(() => {
      const a = (window as any).__neural
      return a._readMax > 0 && a._readS === a._readMax
    })).toBe(true)
    const observed = await page.evaluate(() => {
      const w = window as any, a = w.__neural, body = document.querySelector("[data-land-more-body]") as HTMLElement
      const related = body.querySelector("[data-land-related]")!.getBoundingClientRect()
      return {
        sameQuestion: w.__moreQuestion === document.querySelector("[data-land-q]"),
        questionUnchanged: w.__moreQuestion.outerHTML === w.__moreQuestionHTML,
        extraActions: a.beats.filter((b: any) => ["commit", "land_q_answered", "land_q_extra"].includes(b.beat)).length - w.__moreBeatCount,
        finalRowVisible: related.top >= 0 && related.bottom <= innerHeight,
        horizontalOverflow: body.scrollWidth > body.clientWidth + 1,
      }
    })
    expect(observed).toEqual({ sameQuestion: true, questionUnchanged: true, extraActions: 0, finalRowVisible: true, horizontalOverflow: false })
    await page.keyboard.press("Home")
    await expect.poll(() => page.evaluate(() => (window as any).__neural._readS)).toBe(0)
    await page.keyboard.press("Escape")
    await expect(page.locator("[data-land-more]")).toHaveAttribute("aria-expanded", "false")
    await expect(page.locator("[data-land-more]")).toBeFocused()
  })
}

test("@curated a late dossier refreshes More after an answer without replacing or paying the question twice", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  const truth = await j.landQuestion()
  expect(truth, "a real unanswered MC question is mounted").not.toBeNull()
  const target = await page.evaluate(() => {
    const a = (window as any).__neural, key = a.deckKeyFor(a.nodes[a.currentPos]).key
    return { key, filename: a.qhash(key) + ".json" }
  })
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  let requested = 0
  await page.route(`**/content/${target.filename}`, async (route) => {
    requested++
    await held
    await route.fulfill({ json: { [target.key]: position("Top") } })
  })
  // The normal DSL boot already negative-cached this key. Clear that FIXTURE absence and ask
  // through the production hydration seam; the resulting HTTP response owns the real refresh.
  await page.evaluate((key) => {
    const w = window as any, a = w.__neural
    delete w.NG_CONTENT.decks[key]
    delete (a._contentWaits || {})[key]
    a._hydrateContent(key)
  }, target.key)
  await expect.poll(() => requested, { message: "the intended dossier request really is held" }).toBe(1)
  await page.locator("[data-land-mc-opt]").nth(truth!.correct).evaluate((el) => el.setAttribute("data-more-test-correct", "1"))
  await j.clickByMouse("[data-more-test-correct]", "the mounted question's actual correct answer")
  await page.evaluate(() => {
    const w = window as any, a = w.__neural
    if (!a._landQ?.answered) throw new Error("The premise requires an answered landing")
    w.__moreAnsweredQuestion = document.querySelector("[data-land-q]")
    w.__moreAnsweredHTML = w.__moreAnsweredQuestion.outerHTML
    w.__moreAnsweredCount = a.beats.filter((b: any) => b.beat === "land_q_answered").length
  })
  release()
  await expect.poll(() => page.evaluate((key) => !!(window as any).NG_CONTENT.decks[key]?.props, target.key)).toBe(true)
  await openMore(page, j)
  await expect(page.locator(`${BODY} [data-land-props]`)).toContainText("Offensive")
  expect(await page.evaluate(() => {
    const w = window as any, a = w.__neural
    return {
      sameElement: w.__moreAnsweredQuestion === document.querySelector("[data-land-q]"),
      sameContent: w.__moreAnsweredQuestion.outerHTML === w.__moreAnsweredHTML,
      answered: a._landQ.answered,
      paidAgain: a.beats.filter((b: any) => b.beat === "land_q_answered").length - w.__moreAnsweredCount,
    }
  })).toEqual({ sameElement: true, sameContent: true, answered: true, paidAgain: 0 })
})

test("@curated More builds its HTML on first open and reuses it on repeated reads", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  const filename = await page.evaluate(() => {
    const w = window as any, a = w.__neural, render = a._readingHTML
    w.__moreRenders = 0
    a._readingHTML = function (...args: any[]) {
      if (args[1] === "land") w.__moreRenders++
      return render.apply(this, args)
    }
    return a.qhash(a.deckKeyFor(a.nodes[a.currentPos]).key) + ".json"
  })
  const requests: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(`/content/${filename}`)) requests.push(request.url())
  })
  await seedCurrent(page, position("Top"))
  await expect(page.locator(`${BODY} > *`), "collapsed reading content has no generated DOM").toHaveCount(0)
  expect(await page.evaluate(() => (window as any).__moreRenders), "availability checks never build the long HTML").toBe(0)
  await openMore(page, j)
  expect(await page.evaluate(() => (window as any).__moreRenders)).toBe(1)
  await page.keyboard.press("Escape")
  await openMore(page, j)
  expect(await page.evaluate(() => (window as any).__moreRenders), "a second open reuses the existing body").toBe(1)
  expect(requests, "resident content is not requested again while opening or closing").toEqual([])
})

test("@curated two hidden reading layers request no dossiers and restoring the card fetches its own once", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  const target = await page.evaluate(() => {
    const w = window as any, a = w.__neural
    a.setLayer("film", false, "test")
    a.setLayer("card", false, "test")
    const n = a.nodes.find((n: any) => n.rep && n.ty === "positions" && a.graphName(n) === "Knee on Belly")
    if (!n) throw new Error("The corpus must contain Knee on Belly")
    const key = a.posFamily(n.t) + "|Top"
    // Ensure the next landing is cold even if a different boot path warmed it incidentally.
    delete (w.NG_CONTENT?.decks || {})[key]
    delete (a._contentWaits || {})[key]
    return { idx: n.idx, key, filename: a.qhash(key) + ".json" }
  })
  const requests: string[] = []
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname
    if (path.includes("/content/")) requests.push(path.split("/").pop()!)
  })
  await page.evaluate((idx) => (window as any).__neural.rollFromPosition(idx, true, "top"), target.idx)
  await j.landSettled()
  await j.advance(500)
  await expect(page.locator("[data-landcard], [data-land-film], [data-land-more]")).toHaveCount(0)
  expect(requests, "rendering a landing with both reading layers hidden asks for no dossier").toEqual([])
  await page.evaluate(() => (window as any).__neural.setLayer("card", true, "test"))
  await j.landSettled()
  await expect.poll(() => requests, { message: "restoring the reader asks only for its own cold dossier" }).toEqual([target.filename])
  await expect(page.locator("[data-landcard]")).toBeVisible()
})

test("@curated the real emitted dossier reaches More through the production chunk request", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Submissions/Ezekiel-Choke/from-Mount")
  await j.advance(8000)
  await j.landSettled()
  const target = await page.evaluate(() => {
    const a = (window as any).__neural, n = a.nodes[a._landIdx]
    return { key: n.t, filename: a.qhash(n.t) + ".json" }
  })
  const emitted = JSON.parse(readFileSync(resolve(__dirname, "../../source/public/static/neural/content", target.filename), "utf8"))[target.key]
  expect(emitted.safety?.release.length, "the served emitter artifact contains a release protocol").toBeGreaterThan(0)
  expect(emitted.family?.aka.length, "the served emitter artifact contains inherited family aliases").toBeGreaterThan(0)
  // Remove ONLY the DSL's empty-dossier handler. The next request goes to the built site's
  // actual content file, whose bytes above supply the expected text without re-emitting them.
  await page.unroute("**/static/neural/content/*.json")
  const response = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith(`/content/${target.filename}`))
  await page.evaluate(async (key) => {
    const w = window as any, a = w.__neural
    delete w.NG_CONTENT.decks[key]
    delete (a._contentWaits || {})[key]
    await a._hydrateContent(key)
  }, target.key)
  expect((await response).status()).toBe(200)
  await openMore(page, j)
  for (const alias of emitted.family.aka) await expect(page.locator(`${BODY} [data-land-aka]`)).toContainText(alias)
  for (const step of emitted.perspectives.attacker.steps) await expect(page.locator(`${BODY} [data-land-steps]`)).toContainText(step)
  for (const text of emitted.safety.release) await expect(page.locator(`${BODY} [data-safety-release]`)).toContainText(text)
  for (const text of emitted.safety.restrictions) await expect(page.locator(`${BODY} [data-safety-restrictions]`)).toContainText(text)
})

test("@curated a cold option sheet gains its own dossier without replacing the drill or scroll position", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  const target = await page.evaluate(() => {
    const w = window as any, a = w.__neural
    const option = a._optionCards.find((c: any) => !c.esc && !c.opt.threat)
    if (!option) throw new Error("The real hand must contain a selectable technique")
    option.card.setAttribute("data-more-test-option", "1")
    const key = option.node.t
    delete (w.NG_CONTENT?.decks || {})[key]
    delete (a._contentWaits || {})[key]
    return { key, filename: a.qhash(key) + ".json", deck: a.deckKeyFor(option.node).key, cat: a.deckCat(option.node) }
  })
  await j.hydrate([target.deck])
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  let requests = 0
  const dossier = technique()
  dossier.cat = target.cat
  if (target.cat !== "Submission") { delete dossier.safety; delete dossier.kind }
  await page.route(`**/content/${target.filename}`, async (route) => {
    requests++
    await held
    await route.fulfill({ json: { [target.key]: dossier } })
  })
  await j.clickByMouse("[data-more-test-option]", "the first real technique in the hand")
  await expect.poll(() => requests, { message: "the sheet's own dossier request is held" }).toBe(1)
  await expect(page.locator("[data-jit]")).toBeVisible()
  const before = await page.evaluate(() => {
    const w = window as any, a = w.__neural
    const jit = document.querySelector("[data-jit]") as HTMLElement
    const scroll = jit.parentElement!
    scroll.scrollTop = 37
    w.__moreSheetJit = jit
    w.__moreSheetJitHTML = jit.outerHTML
    w.__moreSheetScroll = scroll
    return { scroll: scroll.scrollTop, owner: a._detailCtx.contentKey }
  })
  expect(before.owner).toBe(target.key)
  expect(before.scroll, "the cold sheet really is scrolled before the response").toBeGreaterThan(0)
  release()
  await expect(page.locator("[data-sheet-steps]")).toContainText("Execution step 8:")
  expect(await page.evaluate(() => {
    const w = window as any
    return {
      sameDrill: w.__moreSheetJit === document.querySelector("[data-jit]"),
      sameQuestion: w.__moreSheetJitHTML === w.__moreSheetJit.outerHTML,
      scroll: w.__moreSheetScroll.scrollTop,
    }
  })).toEqual({ sameDrill: true, sameQuestion: true, scroll: before.scroll })
  await j.clickByMouse('.ng-pt[data-p="defender"]', "the defender tab added by the late dossier")
  await expect(page.locator("[data-sheet-options]")).toContainText("Recover the defensive frame")
  await expect(page.locator("[data-sheet-steps]")).toHaveCount(0)
  await expect(page.locator("[data-sheet-aka]")).toContainText("Own variant alias")
})

test("@curated a matching late dossier preserves the visible reading section and keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  const initial = position("Top")
  initial.principles = Array.from({ length: 6 }, (_, i) => `Principle ${i + 1}. ${LONG_CUE}`)
  const selected = await seedCurrent(page, initial)
  await openMore(page, j)
  await page.keyboard.press("Tab")
  await expect(page.locator(BODY)).toBeFocused()
  await page.keyboard.press("PageDown")
  const before = await page.evaluate(() => {
    const a = (window as any).__neural
    const section = Array.from(document.querySelector("[data-land-more-body]")!.children)
      .find((el) => el.getBoundingClientRect().bottom > 0)!
    const marker = Array.from(section.attributes).find((a) => a.name.startsWith("data-land-"))!.name
    return { marker, top: section.getBoundingClientRect().top, offset: a._readS }
  })
  expect(before.offset, "the reader has moved away from the top").toBeGreaterThan(0)
  expect(before.marker, "the anchor is below the introductory section that will grow").not.toBe("data-land-def")
  const fresh = { ...initial, lead: "Extra introductory context above the visible reading section. ".repeat(15) }
  const filename = await page.evaluate((key) => (window as any).__neural.qhash(key) + ".json", selected.key)
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  let requests = 0
  await page.route(`**/content/${filename}`, async (route) => {
    requests++
    await held
    await route.fulfill({ json: { [selected.key]: fresh } })
  })
  await page.evaluate((key) => {
    const w = window as any, a = w.__neural
    delete w.NG_CONTENT.decks[key]
    delete a._contentWaits[key]
    a._hydrateContent(key)
  }, selected.key)
  await expect.poll(() => requests, { message: "the matching request is actually pending" }).toBe(1)
  release()
  await expect(page.locator(`${BODY} [data-land-def]`)).toHaveText(fresh.lead)
  await expect(page.locator(BODY)).toBeFocused()
  const after = await page.locator(`${BODY} [${before.marker}]`).boundingBox()
  expect(after).not.toBeNull()
  expect(Math.abs(after!.y - before.top), "the same visible section stays in place as earlier content grows").toBeLessThanOrEqual(2)
  const offset = await page.evaluate(() => (window as any).__neural._readS)
  await page.keyboard.press("ArrowDown")
  await expect.poll(() => page.evaluate(() => (window as any).__neural._readS)).toBeGreaterThan(offset)
})

test("@curated an old Top dossier response cannot repaint the current Bottom reading surface", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  const target = await page.evaluate(() => {
    const a = (window as any).__neural, key = a.deckKeyFor(a.nodes[a.currentPos]).key
    return { key, filename: a.qhash(key) + ".json" }
  })
  expect(target.key).toBe("Mount|Top")
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  let requests = 0
  await page.route(`**/content/${target.filename}`, async (route) => {
    requests++
    await held
    await route.fulfill({ json: { [target.key]: { ...position("Top"), lead: "STALE TOP CONTENT" } } })
  })
  await page.evaluate((key) => {
    const w = window as any, a = w.__neural
    delete w.NG_CONTENT.decks[key]
    delete a._contentWaits[key]
    a._hydrateContent(key)
    a.rollFromPosition(a.currentPos, true, "bottom")
  }, target.key)
  await expect.poll(() => requests, { message: "the old seat's request is actually pending" }).toBe(1)
  await j.landSettled()
  await j.advance(500)
  const current = await seedCurrent(page, position("Bottom"))
  expect(current.key).toBe("Mount|Bottom")
  await openMore(page, j)
  await page.keyboard.press("Tab")
  await expect(page.locator(BODY)).toBeFocused()
  await page.evaluate(() => {
    const w = window as any
    w.__currentBottomSection = document.querySelector("[data-land-more-body] [data-land-def]")
    w.__currentBottomQuestion = document.querySelector("[data-land-q]")
  })
  release()
  await expect.poll(() => page.evaluate((key) => (window as any).NG_CONTENT.decks[key]?.lead, target.key)).toBe("STALE TOP CONTENT")
  await expect(page.locator(`${BODY} [data-land-def]`)).toHaveText("Bottom authored summary.")
  await expect(page.locator(BODY)).not.toContainText("STALE TOP CONTENT")
  await expect(page.locator(BODY)).toBeFocused()
  expect(await page.evaluate(() => {
    const w = window as any
    return {
      sameSection: w.__currentBottomSection === document.querySelector("[data-land-more-body] [data-land-def]"),
      sameQuestion: w.__currentBottomQuestion === document.querySelector("[data-land-q]"),
      role: w.__neural.playerRole,
    }
  })).toEqual({ sameSection: true, sameQuestion: true, role: "bottom" })
})

test("@curated a shared technique dossier arriving after a seat switch reads the current defender", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Transitions/Kuzure-Kesa-Gatame-to-Kesa-Gatame")
  await j.advance(8000)
  await j.landSettled()
  const target = await page.evaluate(() => {
    const a = (window as any).__neural, n = a.nodes[a._landIdx], partner = a.nodes[n.pi]
    if (a._stagedTech?.side !== "attacker" || partner?.role !== "defender") throw new Error("The premise requires both seats of an attacking technique")
    return { key: n.t, filename: a.qhash(n.t) + ".json", defender: partner.idx }
  })
  const dossier = technique()
  dossier.cat = "Transition"
  dossier.lead = "A shared transition dossier with separately authored perspectives."
  delete dossier.safety; delete dossier.kind; delete dossier.family
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  let requests = 0
  await page.route(`**/content/${target.filename}`, async (route) => {
    requests++
    await held
    await route.fulfill({ json: { [target.key]: dossier } })
  })
  await page.evaluate((key) => {
    const w = window as any, a = w.__neural
    delete w.NG_CONTENT.decks[key]
    delete a._contentWaits[key]
    a._hydrateContent(key)
  }, target.key)
  await expect.poll(() => requests, { message: "the request began on the attacking seat" }).toBe(1)
  // Canvas navigation has no DOM target; this is the same production entry point its tap uses.
  await page.evaluate((idx) => (window as any).__neural.openDossier(idx), target.defender)
  await j.landSettled()
  await j.advance(500)
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return { key: a.nodes[a._landIdx].t, side: a._stagedTech?.side, panic: a._defendSub != null }
  })).toEqual({ key: target.key, side: "defender", panic: false })
  expect(requests, "both seats share the SAME in-flight dossier request").toBe(1)
  release()
  await expect.poll(() => page.evaluate((key) => !!(window as any).NG_CONTENT.decks[key]?.perspectives, target.key)).toBe(true)
  await openMore(page, j)
  await expect(page.locator(`${BODY} [data-land-def]`)).toHaveText("DEFENDER ONLY summary.")
  await expect(page.locator(`${BODY} [data-land-options]`)).toContainText("Recover the defensive frame")
  await expect(page.locator(BODY)).not.toContainText("ATTACKER ONLY")
  await expect(page.locator(`${BODY} [data-land-steps], ${BODY} [data-land-outcomes], ${BODY} [data-land-counters]`)).toHaveCount(0)
})
