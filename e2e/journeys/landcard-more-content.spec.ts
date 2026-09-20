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

/* ══════════════════════════════════════════════════════════════════════════════════════════
 * THE READING SYSTEM AND ITS CONTENTS ROW (v1.194.0)
 *
 * Every assertion below is @curated on purpose: `test:curated` is `--grep @curated`, so an
 * untagged test is invisible to the deployment gate. An earlier draft of this work had eleven
 * claims gated on paper and four in reality — absence reporting as success, on the plan that
 * cites that failure class more than any other.
 *
 * Each test names the mutant that must turn it red, so a later reader can check the claim is
 * gated rather than described. All of them were run against their mutant before shipping.
 * ════════════════════════════════════════════════════════════════════════════════════════ */

const NAV = "[data-read-nav]"

/** The rhythm is a RATIO of the card's own padding, never a pixel literal — the owner sizes
 *  spacing that way ("50% more of the left padding"), so the test pins the ratio. */
test("@curated the reading rhythm is a ratio, not a pixel", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  await seedCurrent(page, position("Top"))
  await openMore(page, j)
  const r = await page.locator(BODY).evaluate((body) => {
    const px = (el: Element, prop: string) => parseFloat(getComputedStyle(el)[prop as any] as string)
    const section = body.querySelector("[data-land-principles]")!
    const list = section.querySelector("ul")!
    return {
      section: px(section, "marginBottom"),   // s4 = 2u
      item: px(list, "rowGap"),               // s2 = u/2
      fontSize: px(section, "fontSize"),
    }
  })
  // MUTANT: change any one gap token in reading.css -> this goes red.
  expect(r.fontSize, "the reading size is unchanged at 13px").toBe(13)
  expect(r.section / r.item, "section gap is 4x the item gap (s4 = 24, s2 = 6)").toBe(4)
  expect(r.section, "s4 is 2u where u is the card's own 12px padding").toBe(24)
})

/** The landmark used to be the smallest, dimmest text on a column up to 8.4 phone screens. */
test("@curated the section heading is the largest and brightest thing in its section", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  await seedCurrent(page, position("Top"))
  await openMore(page, j)
  const r = await page.locator(BODY).evaluate((body) => {
    const lum = (c: string) => {
      const [r, g, b] = c.match(/\d+/g)!.slice(0, 3).map((n) => {
        const v = +n / 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const section = body.querySelector("[data-land-principles]")!
    const h3 = section.querySelector("h3")!
    const cs = getComputedStyle(section), ch = getComputedStyle(h3)
    return {
      headSize: parseFloat(ch.fontSize), bodySize: parseFloat(cs.fontSize),
      headLum: lum(ch.color), bodyLum: lum(cs.color),
    }
  })
  // MUTANT: swap the title and body colour tokens, or drop the h3 size -> this goes red.
  expect(r.headSize, "the heading is larger than the prose it heads").toBeGreaterThan(r.bodySize)
  expect(r.headLum, "the heading is brighter than the prose it heads").toBeGreaterThan(r.bodyLum)
})

/** 9,087 of 9,090 steps are authored "<action>: <description>". The renderer used to print the
 *  join as one <li> — the worst is 804 characters. Splitting must not drop the description. */
test("@curated a split step keeps its 804-character description", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Submissions/Ezekiel-Choke/from-Mount")
  await j.advance(8000)
  await j.landSettled()
  const LONG = "Extend the hips progressively ".padEnd(44, "-") + "X".repeat(760)
  const base = technique()
  await seedCurrent(page, {
    ...base,
    perspectives: {
      ...base.perspectives,
      attacker: {
        ...base.perspectives.attacker,
        steps: [`Extend hips for the finish: ${LONG}`, "Plain step with no shape"],
      },
    },
  })
  await openMore(page, j)
  const steps = page.locator(`${BODY} [data-land-steps]`)
  await expect(steps).toHaveCount(1)
  const r = await steps.evaluate((el) => {
    const items = Array.from(el.querySelectorAll("li"))
    return {
      n: items.length,
      firstAction: items[0].querySelector("b")?.textContent ?? null,
      firstText: items[0].textContent ?? "",
      secondHasAction: !!items[1].querySelector("b"),
      secondText: items[1].textContent ?? "",
    }
  })
  // MUTANT: drop the description after the split -> firstText collapses and this goes red.
  expect(r.n).toBe(2)
  expect(r.firstAction, "the authored action becomes its own line, delimiter and all").toBe("Extend hips for the finish:")
  expect(r.firstText, "and the whole description survives").toContain(LONG)
  expect(r.firstText.length, "nothing is clipped").toBeGreaterThan(800)
  expect(r.secondHasAction, "a step with no authored shape is not guessed at").toBe(false)
  expect(r.secondText).toBe("Plain step with no shape")
})

/** The owner's model is a Quartz TOC: a long list of the document. An index that cannot address
 *  the first thing in the document is not one — `def` is present on 100% of seats. */
test("@curated the contents row addresses every section", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  await seedCurrent(page, position("Top"))
  await openMore(page, j)
  const r = await page.locator("[data-read-bar]").evaluate((bar) => {
    const body = document.querySelector("[data-land-more-body]")!
    const keyOf = (el: Element) =>
      (Array.from(el.attributes).find((a) => a.name.startsWith("data-land-")) || { name: "" }).name.slice(10)
    return {
      sections: Array.from(body.children).map(keyOf).filter(Boolean),
      entries: Array.from(bar.querySelectorAll("[data-read-to]")).map((b) => b.getAttribute("data-read-to")!),
      labels: Array.from(bar.querySelectorAll("[data-read-to]")).map((b) => (b.textContent || "").trim()),
    }
  })
  // MUTANT: filter the nav to sections that carry a label, or delete one entry -> red.
  expect(r.entries, "one entry per section, in document order, none omitted").toEqual(r.sections)
  expect(r.entries, "the unlabelled opening sections are addressable too").toContain("def")
  expect(r.labels.every((l) => l.length > 0), "no entry is blank").toBe(true)
  const targets = await page.locator(BODY).evaluate((b, keys) =>
    (keys as string[]).every((k) => !!b.querySelector(`[data-land-${k}]`)), r.entries)
  expect(targets, "every entry resolves to a real section, not a wrong one").toBe(true)
})

/** ONE EMITTER. A late dossier is the ordinary case, not an edge one: the chunk is fetched on a
 *  miss, so the first landing on any node renders, then re-renders. If the body and the index
 *  are written in two places, the index can describe a document the body no longer shows. */
test("@curated a delayed dossier leaves no stale contents entry", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  await seedCurrent(page, position("Top"))
  await openMore(page, j)
  const before = await page.locator("[data-read-bar]").evaluate((bar) =>
    Array.from(bar.querySelectorAll("[data-read-to]")).map((b) => b.getAttribute("data-read-to")))
  expect(before.length).toBeGreaterThan(2)

  // the same node gains a section while More is OPEN — exactly what a late chunk does
  await seedCurrent(page, { ...position("Top"), drills: undefined, metrics: undefined, confuse: [] })
  await j.advance(250)
  const after = await page.locator("[data-read-bar]").evaluate((bar) => {
    const body = document.querySelector("[data-land-more-body]")!
    const keyOf = (el: Element) =>
      (Array.from(el.attributes).find((a) => a.name.startsWith("data-land-")) || { name: "" }).name.slice(10)
    return {
      sections: Array.from(body.children).map(keyOf).filter(Boolean),
      entries: Array.from(bar.querySelectorAll("[data-read-to]")).map((b) => b.getAttribute("data-read-to")!),
      navs: bar.querySelectorAll("[data-read-nav]").length,
    }
  })
  // MUTANT: let _refreshReadingContent repaint the body without repainting the nav -> red.
  expect(after.entries, "the index still describes the document the body is showing").toEqual(after.sections)
  expect(after.navs, "the row is replaced, never stacked").toBe(1)
})

/** A control inside a fixed overlay is dead to the MOUSE unless the overlay is guarded and the
 *  control re-enables hit-testing inline. `locator.click()` passes either way — that is the
 *  entire point, and why this uses the mouse contract. */
test("@curated the contents row is reachable by mouse", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  await seedCurrent(page, position("Top"))
  await openMore(page, j)
  await expect(page.locator(`${NAV} [data-read-to]`).first()).toBeVisible()
  const target = await page.locator(NAV).evaluate((nav) =>
    `[data-read-to="${nav.querySelectorAll("[data-read-to]")[1].getAttribute("data-read-to")}"]`)
  // MUTANT: remove the buttons' inline pointer-events AND the row's at _readApply's
  // `row.style.pointerEvents = "auto"` (children inherit it, so one alone proves nothing).
  await j.clickByMouse(target, "a contents entry")
})

/** `scrollIntoView` does nothing on this surface: the fold is overflow:visible and reading
 *  TRANSLATES the column. The jump must drive `_readApply`. */
test("@curated a contents click lands its section under the head", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  await seedCurrent(page, position("Top"))
  await openMore(page, j)
  // A MID-DOCUMENT target, deliberately. `_readApply` clamps to `_readMax`, so a near-end
  // section physically cannot come to rest under the head — the column has run out of travel.
  // Asserting the pin on the LAST entry tests the clamp, not the jump. The clamped case is a
  // separate claim, asserted below.
  const key = await page.locator(NAV).evaluate((nav) =>
    nav.querySelectorAll("[data-read-to]")[2].getAttribute("data-read-to")!)
  // THE HEAD PINS IN THIS SHIPMENT (plan D.4's counter-translate, v1.194.1), so the resting
  // place is the head's PINNED line and not the geometry before the jump — the head no longer
  // travels with the column. That also makes this the stronger statement of the same claim:
  // it is measured against where the head IS when the jump settles, so it cannot be satisfied
  // by a head that has walked off the screen.
  const before = await page.evaluate(() => ({ read: (window as any).__neural._readS || 0 }))
  // The row scrolls horizontally BY DESIGN, so the last entry starts off-screen and
  // `clickByMouse` rightly refuses an off-screen centre. Flick the row first, exactly as a
  // reader does — this is the gesture, not a workaround for it.
  await page.locator(NAV).evaluate((nav, k) => {
    const b = nav.querySelector(`[data-read-to="${k}"]`) as HTMLElement
    nav.scrollLeft = b.offsetLeft - nav.clientWidth / 2 + b.clientWidth / 2
  }, key)
  await j.advance(150)
  await j.clickByMouse(`[data-read-to="${key}"]`, "a mid-document contents entry")
  await j.advance(250)
  const r = await page.evaluate((k) => {
    const a = (window as any).__neural
    const el = document.querySelector(`[data-land-${k}]`)!
    const pin = document.querySelector("[data-read-pin]") as HTMLElement
    return {
      read: a._readS || 0, max: a._readMax || 0, top: el.getBoundingClientRect().top,
      head: pin.getBoundingClientRect().bottom, pinned: pin.classList.contains("pinned"),
    }
  }, key)
  // MUTANT: no-op the jump handler -> the read never moves and this goes red.
  expect(r.read, "the read travelled").toBeGreaterThan(before.read)
  expect(r.read, "and it did not have to clamp to get there, so the landing below is the jump's own")
    .toBeLessThan(r.max)
  // MUTANT: aim `_navJump` at `_navPin()` (the head's LIVE line) instead of `_navRest()` — the
  // head is still in flow when the click lands, so the column overshoots by the head's home top
  // and the section ends up far above the head.
  expect(r.pinned, "the jump left the head floating, where the reader can still reach it").toBe(true)
  expect(r.top - r.head, "the section came to rest UNDER the head, not behind it").toBeGreaterThanOrEqual(0)
  expect(r.top - r.head, "and within one rhythm unit of it").toBeLessThan(24)

  // AND THE CLAMPED CASE, stated as its own claim: the last section cannot reach the pin
  // because the column runs out of travel, so what is owed is that it is ON SCREEN.
  const lastKey = await page.locator(NAV).evaluate((nav) => {
    const all = Array.from(nav.querySelectorAll("[data-read-to]"))
    return all[all.length - 1].getAttribute("data-read-to")!
  })
  await page.locator(NAV).evaluate((nav, k) => {
    const b = nav.querySelector(`[data-read-to="${k}"]`) as HTMLElement
    nav.scrollLeft = b.offsetLeft - nav.clientWidth / 2 + b.clientWidth / 2
  }, lastKey)
  await j.advance(150)
  await j.clickByMouse(`[data-read-to="${lastKey}"]`, "the last contents entry")
  await j.advance(250)
  const last = await page.evaluate((k) => {
    const a = (window as any).__neural
    const el = document.querySelector(`[data-land-${k}]`)!.getBoundingClientRect()
    return { top: el.top, bottom: el.bottom, h: window.innerHeight, read: a._readS || 0, max: a._readMax || 0 }
  }, lastKey)
  // Whether the clamp actually binds depends on the document and the viewport — on this seat
  // at 1440x900 the last section is still reachable. So the claim is not "it clamps", it is
  // the one that must hold either way: the column never travels past its limit, and the
  // section the reader asked for is ON SCREEN when it stops.
  expect(last.read, "the column never travels past `_readMax`").toBeLessThanOrEqual(last.max)
  expect(last.read, "and it travelled further than the mid-document jump").toBeGreaterThan(r.read)
  expect(last.bottom > 0 && last.top < last.h, "the last section is on screen when it stops").toBe(true)
})

/** The keyboard has to follow the eye. The emitted sections carry tabindex="-1" for this. */
test("@curated a contents click moves focus to its section", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  await seedCurrent(page, position("Top"))
  await openMore(page, j)
  const key = await page.locator(NAV).evaluate((nav) =>
    nav.querySelectorAll("[data-read-to]")[2].getAttribute("data-read-to")!)
  await j.clickByMouse(`[data-read-to="${key}"]`, "a contents entry")
  // MUTANT: remove tabindex="-1" from the emitted section -> focus stays on <body> and this reds.
  const focused = await page.evaluate(() => {
    const a = document.activeElement
    if (!a) return null
    const attr = Array.from(a.attributes).find((x) => x.name.startsWith("data-land-"))
    return attr ? attr.name.slice(10) : a.tagName
  })
  expect(focused, "focus moved to the section the reader asked for").toBe(key)
})

/** The head reserves height, height is `_readMax`, and `_readMax` is how far the player's hand
 *  is pushed down the screen while they read. The row must not add to that beyond the body. */
test("@curated the contents row leaves the tray where the body put it", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  await seedCurrent(page, position("Top"))
  await openMore(page, j)
  await j.advance(250)
  const withRow = await page.evaluate(() => {
    const a = (window as any).__neural
    const tray = a.optionsRef && a.optionsRef.current
    return { readMax: a._readMax || 0, tray: tray ? tray.getBoundingClientRect().bottom : null }
  })
  // the SAME body, with the row removed — the differential the claim is actually about
  const withoutRow = await page.evaluate(() => {
    const a = (window as any).__neural
    const nav = document.querySelector("[data-read-nav]")!
    nav.remove()
    a._dockLandMore(a._landEl)
    const tray = a.optionsRef && a.optionsRef.current
    return { readMax: a._readMax || 0, tray: tray ? tray.getBoundingClientRect().bottom : null }
  })
  // MUTANT: give .r-toc a height (e.g. make the row 12px taller) -> the two diverge and this reds.
  expect(withRow.readMax, "the row rides inside the head's existing 38px, adding no travel")
    .toBe(withoutRow.readMax)
  expect(withRow.tray, "so the hand does not move because the index exists").toBe(withoutRow.tray)
})

/* ══════════════════════════════════════════════════════════════════════════════════════════
 * THE PINNED HEAD (v1.194.1)
 *
 * Plan D.4, which v1.194.0 designed and did not implement: the contents row holds while the
 * document travels under it. The fold is not a scrollport — reading is ONE transform on the
 * whole column — so `position:sticky` is dead here, measured dead by three independent seats.
 * `_readPin` counter-translates the INNER bar by exactly what `_readApply` took away, from the
 * offset where the head would otherwise cross the card's own side padding.
 *
 * Each test names the mutant that must turn it red; every one was run against its mutant, RED
 * first, before this shipped.
 *
 * NOT COVERED, DECLARED: real-device touch. Every gesture below is CDP-driven headless
 * Chromium, and `touch-action` is a compositor hint CDP does not exercise — "the head holds
 * while a thumb drags the card" needs one check on a real phone.
 * ════════════════════════════════════════════════════════════════════════════════════════ */

const PIN = "[data-read-pin]"

/** A phone-sized seat with a document long enough that the head HAS to pin, plus the geometry
 *  the claims are stated against. The floor is not decoration: on a document with no travel
 *  every assertion below would pass for the wrong reason. */
async function openTallRead(page: Page, j: ReturnType<typeof journey>) {
  await page.setViewportSize({ width: 390, height: 844 })
  await j.boot()
  await j.land("Mount Top")
  await seedCurrent(page, position("Top"))
  await openMore(page, j)
  await j.advance(250)
  // SETTLE THE ENTRY ANIMATION IN REAL TIME, and not with `advance`. The open fold carries
  // `ngCardInX .28s` (helmet.html:191) whose first keyframe is `translate(-50%, 8px)`, the DSL's
  // clock is PUMPED so `advance` does not drive a CSS animation at all, and `_readApply` only
  // kills the animation once the offset is non-zero. So the HOME frame here can be sampled
  // mid-ease while every frame measured after a scroll cannot, and "the head came home" then
  // compares the two against each other. Measured: 0px in isolation, 3.27px under the full
  // suite — the shape of a flake, caught by the full suite and fixed at the cause rather than
  // by widening the tolerance. The browser's own animation promise is the signal; the race is
  // there so an ambient infinite animation could never hang the journey.
  await page.locator(".ng-landmore").evaluate((el) => Promise.race([
    Promise.all((el as HTMLElement).getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))),
    new Promise((r) => setTimeout(r, 1000)),
  ]))
  const room = await page.evaluate(() => {
    const a = (window as any).__neural
    const inset = a._readPinInset || 12
    return {
      max: a._readMax || 0,
      inset,
      start: Math.max(0, (a._readPinTop || 0) - inset),
      cap: a._readPinCap || 0,
    }
  })
  expect(room.max, "this seat's document is long enough to need a pinned head")
    .toBeGreaterThan(room.start + 120)
  return room
}

/** Everything the claims below measure, in one read of the real frame. */
async function readFrame(page: Page) {
  return page.evaluate(() => {
    const a = (window as any).__neural
    const pin = document.querySelector("[data-read-pin]") as HTMLElement
    const nav = document.querySelector("[data-read-nav]") as HTMLElement
    const body = document.querySelector("[data-land-more-body]") as HTMLElement
    const tray = a.optionsRef && a.optionsRef.current
    const pr = pin.getBoundingClientRect(), nr = nav.getBoundingClientRect()
    return {
      read: a._readS || 0,
      max: a._readMax || 0,
      pinTop: pr.top, pinBottom: pr.bottom,
      pinned: pin.classList.contains("pinned"),
      navTop: nr.top, navBottom: nr.bottom,
      first: body.children[0].getBoundingClientRect().top,
      // Opaque means alpha 1. A floating head with a see-through background lets the prose read
      // straight through the index, which is the whole failure mode a pinned head introduces.
      opaque: (() => {
        const m = /^rgba?\(([^)]+)\)$/.exec(getComputedStyle(pin).backgroundColor || "")
        const p = m ? m[1].split(",").map(Number) : []
        return p.length >= 3 && (p.length < 4 || p[3] === 1)
      })(),
      tray: tray ? tray.getBoundingClientRect().bottom : null,
      h: window.innerHeight,
    }
  })
}

/** The wheel is a document-level capture listener, so this is the reader's own gesture and not
 *  a call into the app: the same path a mouse takes over the open fold. */
async function wheelRead(page: Page, j: ReturnType<typeof journey>, times: number) {
  const at = await page.locator(BODY).evaluate((b) => {
    const r = b.getBoundingClientRect()
    return { x: Math.round(r.left + r.width / 2), y: Math.round(Math.min(r.top + 60, window.innerHeight - 40)) }
  })
  await page.mouse.move(at.x, at.y)
  for (let i = 0; i < times; i++) await page.mouse.wheel(0, 240)
  await j.advance(400)
}

test("@curated the pinned head holds while the document travels under it", async ({ page }) => {
  const j = journey(page)
  const room = await openTallRead(page, j)
  const home = await readFrame(page)
  expect(home.pinned, "at rest the head stands in its own place, not floating").toBe(false)
  expect(home.opaque, "and at rest it is transparent, exactly as it was before it could pin").toBe(false)

  await wheelRead(page, j, 8)
  const moved = await readFrame(page)

  // THE CONTROL: the document itself travelled, by exactly the offset, so the differential
  // below is about the head and not about a frame that never moved.
  expect(moved.read, "the column travelled past the pinning offset").toBeGreaterThan(room.start + 100)
  // A LOOSE tolerance ON PURPOSE. This line is the CONTROL — "the document travelled" — not the
  // claim, and `_readApply` rounds the offset to an integer while the section's own top is
  // fractional (measured: 1.22px on a correct build, 3.28 with the pin deleted). A tight control
  // makes the test red on the wrong line under its own mutant, which proves nothing; the claim
  // below is where the strictness belongs (§6.3).
  expect(Math.abs((home.first - moved.first) - moved.read),
    "the document moved up by the read offset").toBeLessThanOrEqual(6)

  // MUTANT: delete `this._readPin(s)` from `_readApply` — the head travels with the column and
  // both of these go red (the class never arrives; the head leaves the top of the screen).
  expect(moved.pinned, "the head is floating").toBe(true)
  expect(Math.abs(moved.pinTop - room.inset),
    "and it is held at the card's own side-padding inset").toBeLessThanOrEqual(1)
  // MUTANT: rename the `.r-pin.pinned` rule in reading.css so the floating head keeps no
  // background — the prose reads straight through the index and this goes red.
  expect(moved.opaque, "and it is opaque, so the document does not read through it").toBe(true)
  expect(moved.navTop >= 0 && moved.navBottom <= moved.h,
    `the whole contents row is on screen (${Math.round(moved.navTop)}..${Math.round(moved.navBottom)} of ${moved.h})`).toBe(true)

  // AND IT COMES HOME. Reading back to the top puts the head exactly where it started, so the
  // pin is a lift the column can take back and not a one-way write.
  await page.mouse.wheel(0, -4000)
  await j.advance(400)
  const back = await readFrame(page)
  expect(back.read, "the read returned to the top").toBe(0)
  expect(Math.abs(back.pinTop - home.pinTop), "and the head with it").toBeLessThanOrEqual(1)
  expect(back.pinned, "no longer floating").toBe(false)
})

test("@curated the pinned head costs the hand nothing", async ({ page }) => {
  const j = journey(page)
  const room = await openTallRead(page, j)
  const offsets = [0, Math.round(room.start + 60), Math.round(room.max / 2), room.max]

  // (a) the LIFT costs nothing: the same body, swept at the same offsets, with the head's travel
  // live and then flattened. `_readPinCap = 0` is the pin's own off switch, so what is left is
  // the same head in flow — variant A's head.
  const sweep = async () =>
    page.evaluate((list) => {
      const a = (window as any).__neural
      const tray = a.optionsRef && a.optionsRef.current
      const pin = document.querySelector("[data-read-pin]") as HTMLElement
      return list.map((s: number) => {
        a._readApply(s)
        return { s: a._readS, tray: tray ? Math.round(tray.getBoundingClientRect().bottom) : null, pin: Math.round(pin.getBoundingClientRect().top) }
      })
    }, offsets)

  const pinned = await sweep()
  await page.evaluate(() => { (window as any).__neural._readPinCap = 0 })
  const flat = await sweep()

  // NON-TRIVIALITY FIRST: without this the whole test passes on a build with no pin in it.
  expect(pinned.some((r, i) => r.pin !== flat[i].pin), "the head actually moved between the two sweeps").toBe(true)
  // MUTANT: add the lift to `_readApply`'s `push`, or write the transform on the row instead of
  // the inner bar — the hand moves under the reader and this goes red.
  expect(pinned.map((r) => r.tray), "the hand sits in the same place at every offset")
    .toEqual(flat.map((r) => r.tray))

  // (b) AND THE INNER BAR COSTS NO HEIGHT: unwrap it and re-dock, which is the same document
  // with variant A's head exactly.
  //
  // NON-KILL, RECORDED so nobody later reads this half as coverage: I could not write a mutant
  // that turns it red. The outer bar's height is `38px` INLINE and the inner bar is inside it,
  // so an inner bar cannot add row height whatever you do to it — `.r-pin{height:50px}` and
  // `.r-pin.pinned{padding:12px 0}` both leave `_readMax` untouched, and `height:auto` on the
  // OUTER bar moves both sides of the comparison equally. This is a structural check that the
  // structure has not changed out from under the claim, not a gate on it. The gate on the claim
  // is (a) above and the 38px head is (c) below.
  const before = await readFrame(page)
  const after = await page.evaluate(() => {
    const a = (window as any).__neural
    const pin = document.querySelector("[data-read-pin]") as HTMLElement
    while (pin.firstChild) pin.parentNode!.insertBefore(pin.firstChild, pin)
    pin.remove()
    a._dockLandMore(a._landEl)
    const tray = a.optionsRef && a.optionsRef.current
    return { max: a._readMax || 0, tray: tray ? Math.round(tray.getBoundingClientRect().bottom) : null }
  })
  expect(before.max, "the inner bar rides inside the head's existing 38px").toBe(after.max)
  expect(Math.round(before.tray!), "so the hand does not move because the head can pin").toBe(after.tray)
})

/** The head's BOX is what `_readMax` is measured from, and the pin must not change it — not at
 *  rest, not floating. This is the half of "no displacement" that has a mutant. */
test("@curated the head keeps the same box whether it is floating or at rest", async ({ page }) => {
  const j = journey(page)
  const room = await openTallRead(page, j)
  const box = () => page.evaluate(() => {
    const bar = document.querySelector("[data-read-bar]") as HTMLElement
    const row = document.querySelector(".ng-landmore") as HTMLElement
    return { bar: Math.round(bar.getBoundingClientRect().height), row: row.offsetHeight }
  })
  const rest = await box()
  await page.evaluate((s) => (window as any).__neural._readApply(s), Math.round(room.start + 400))
  const afloat = await box()
  const pinnedNow = await page.evaluate(() =>
    (document.querySelector("[data-read-pin]") as HTMLElement).classList.contains("pinned"))
  expect(pinnedNow, "the head is floating, which is the case under test").toBe(true)
  // MUTANT: change the outer bar's inline `height:38px` to `height:auto` — the 9px the open fold
  // adds as padding stops being absorbed, the bar becomes 47, the row grows with it and both of
  // these go red.
  expect(afloat.bar, "the head's box is the same 38px floating as at rest").toBe(rest.bar)
  expect(afloat.bar, "and that box is the 38px head `_readMax` has always been measured from").toBe(38)
  expect(afloat.row, "so the row the hand is pushed by does not change either").toBe(rest.row)
})

/** A dock mid-read is the ordinary case, not an edge one: a late dossier re-renders the body and
 *  every resize re-docks. Each one measures in the HOME frame, which is why `_readClear` has to
 *  bring the head home before it measures. */
test("@curated a re-dock in the middle of a read leaves the head where it was", async ({ page }) => {
  const j = journey(page)
  const room = await openTallRead(page, j)
  await wheelRead(page, j, 8)
  const before = await readFrame(page)
  expect(before.pinned, "the head is floating before the dock, which is the case under test").toBe(true)
  await page.evaluate(() => {
    const a = (window as any).__neural
    a._dockLandCard(a._landEl)   // the same entry point a late dossier and a resize both use
  })
  await j.advance(250)
  const after = await readFrame(page)
  // MUTANT: delete `this._readPin(0)` from `_readClear` — the dock then measures the head through
  // its own lift, `_readPinTop` jumps by that lift, and the head lands somewhere else entirely.
  expect(after.read, "the reader kept their place").toBe(before.read)
  expect(after.pinned, "the head is still floating").toBe(true)
  expect(Math.abs(after.pinTop - room.inset),
    "and still held at the inset, not at wherever the dock found it").toBeLessThanOrEqual(1)
})

test("@curated the pinned contents row is reachable by mouse where it floats", async ({ page }) => {
  const j = journey(page)
  await openTallRead(page, j)
  await wheelRead(page, j, 8)
  // The entry the READER can see: `_navMark` recentres the row on the section being read, so
  // "the second entry" is not necessarily on screen after a long read — and `clickByMouse`
  // rightly refuses an off-screen centre. Ask the row which of its entries is showing.
  const state = await page.evaluate(() => {
    const pin = document.querySelector("[data-read-pin]") as HTMLElement
    const nav = document.querySelector("[data-read-nav]") as HTMLElement
    const nr = nav.getBoundingClientRect()
    const seen = Array.from(nav.querySelectorAll("[data-read-to]")).filter((b) => {
      const r = b.getBoundingClientRect()
      return r.left >= nr.left - 1 && r.right <= nr.right + 1 && r.top >= 0 && r.bottom <= window.innerHeight
    })
    return {
      pinned: pin.classList.contains("pinned"),
      showing: seen.length,
      key: seen.length ? seen[0].getAttribute("data-read-to") : null,
    }
  })
  expect(state.pinned, "the head is floating over the document, which is the case under test").toBe(true)
  expect(state.showing, "the floating head is still showing entries to click").toBeGreaterThan(0)
  // TWO MUTANTS, and it takes both to prove the claim: (a) remove the entries' inline
  // `pointer-events` AND the row's at `_readApply`'s `row.style.pointerEvents = "auto"` —
  // children inherit it, so one alone proves nothing; (b) drop `position:relative` from the
  // outer bar, and the body — a later in-flow sibling — paints over the floating head, so
  // `elementFromPoint` returns a section and this reds on an ANCESTOR interception.
  await j.clickByMouse(`[data-read-to="${state.key}"]`, "a contents entry on the floating head")
})
