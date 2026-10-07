import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE CARD IS THE MOVE, INSPECT IS THE BUTTON — AND THE CHOSEN CARD STAYS ON THE TABLE (v1.218.1).
 *
 * Owner, 2026-10-05, on the dev preview at v1.218.0:
 *  1. "when i'm in ezekiel choke from side control (defending), and i try to click this choice:
 *     [Escape · Chin tuck with two-on-one forearm block · Win chance 13% · Inspect · Escape 35%] it
 *     doesnt seem possible, any click on that card works as inspect and that shouldnt be so, it's a
 *     choice i just chose, not to inspect but to move"
 *  2. "sometimes clicking a choice card causes it to vanish (maybeo nly in submissions case? coudlnt
 *     confirm the scope)"
 *
 * THE CONTRACT (Phase 1, docs/Neural.md "Executing and inspecting an option"): a click on one of YOUR
 * cards executes it; only its Inspect control inspects. Every move type that executes is driven here
 * by a real MOUSE (`j.clickByMouse`, CLAUDE.md §6.3), body and Inspect both: a transition, a
 * submission entry, a Finish and an escape. A THREAT is the opponent's move, never yours: it stays
 * inspect-only, and that is pinned too.
 *
 * THE VANISH, NAMED: picking an ESCAPE (the hand you get while caught, `enterDefense`, which a URL
 * arrival on a Defender seat also runs) cleared the whole hand and left no card at all, where every
 * other pick leaves a non-actionable copy reading Executing and then its result (`executionCard`).
 * Measured in the real app (dev-serve, 1440 and 390, Ezekiel Choke from Side Control/Defender): 0
 * stand-in frames in 2.5s after the pick, the row empty. The second fault in the same seam: the
 * stand-in's offset ignored the row's left padding (tray inset + open pane), so it landed 378px
 * right of the clicked card with the pane open at 1440, 24px with it shut, 12px at 390.
 *
 * WHAT THE HARNESS SERVES: the submission choices (`submission-details/*.json`) are static files and
 * are served; dossier chunks are `{}` (nothing here reads one). The clock is pumped, so nothing moves
 * between a measurement and the click that follows it unless the spec advances it.
 *
 * Mutants, recorded on the built bundle (one at a time; a neutral control stayed green): see the
 * bottom of the file.
 */

type Kind = "transition" | "entry" | "finish" | "escape"

/** Tag one of YOUR dealt cards (by kind, or by its title) and return its title. The hand is marked
 *  touched first: a hand the player has reached into never re-sorts (CLAUDE.md §5), so the card the
 *  spec measured is the card the mouse then hits. The card is brought into the row's view the way a
 *  swipe would; reachability by mouse is then `clickByMouse`'s own claim. */
async function mark(page: Page, kind: Kind, title?: string) {
  return page.evaluate(({ kind, title }) => {
    const a = (window as any).__neural
    a._handTouched = true
    document.querySelectorAll("[data-cc-target]").forEach((e) => e.removeAttribute("data-cc-target"))
    const own = (a._optionCards || []).filter((c: any) => !c.opt.threat)
    const kindOf = (o: any) => o.action === "escape" ? "escape" : o.action === "finish" ? "finish" : o.node.ty === "submissions" ? "entry" : "transition"
    const hit = own.find((c: any) => (title ? c.card.querySelector(".ngchoice-title").textContent.trim() === title : kindOf(c.opt) === kind))
    if (!hit) throw new Error(`no ${kind} card (${title || "any"}) in a hand of ${own.map((c: any) => kindOf(c.opt)).join(",")}`)
    hit.card.setAttribute("data-cc-target", "1")
    hit.card.scrollIntoView({ inline: "nearest", block: "nearest" })
    return hit.card.querySelector(".ngchoice-title").textContent.trim() as string
  }, { kind, title })
}

/** A dealt card eases in from translateY(10px) over .34s of REAL time (buildOptionCard); a measurement
 *  taken mid-ease is not where the card is. Wait for the marked card to come to rest. */
async function atRest(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const t = document.querySelector("[data-cc-target]") as HTMLElement
    const m = getComputedStyle(t).transform
    return m === "none" || m === "matrix(1, 0, 0, 1, 0, 0)"
  }), { message: "the marked card has finished its deal-in ease" }).toBe(true)
}

const state = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural
  const t = document.querySelector("[data-cc-target]") as HTMLElement | null
  const s = document.querySelector("[data-executing-tech]") as HTMLElement | null
  const box = (el: HTMLElement | null) => { if (!el) return null; const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10) }
  return {
    moves: a.moveCount, executing: !!a._execution, inspecting: !!a._detailCtx,
    sheet: !!document.querySelector("[data-go]") && !!a._detailCtx, preview: !!document.querySelector("[data-choice-preview]") && !!a._detailCtx,
    stand: s ? { label: s.getAttribute("data-executing-tech"), status: s.getAttribute("data-execution-status"), box: box(s),
      opacity: getComputedStyle(s).opacity, visibility: getComputedStyle(s).visibility } : null,
    target: box(t), ev: (a.evRef.current && a.evRef.current.textContent || "").replace(/\s+/g, " ").trim(),
  }
})

const SEATS: Record<Kind, { url?: string; land?: string }> = {
  transition: { land: "Mount Top" },
  entry: { land: "Mount Top" },
  finish: { url: "/Submissions/Triangle-Choke/from-Triangle-Control/Attacker" },
  escape: { url: "/Submissions/Triangle-Choke/from-Triangle-Control/Defender" },
}

async function seat(page: Page, kind: Kind) {
  const j = journey(page)
  const s = SEATS[kind]
  if (s.land) { await j.boot("/"); await j.land(s.land) } else { await j.boot(s.url!); await j.advance(4000) }
  await expect.poll(() => page.evaluate(() => ((window as any).__neural._optionCards || []).filter((c: any) => !c.opt.threat).length)).toBeGreaterThan(0)
  return j
}

for (const kind of ["transition", "entry", "finish", "escape"] as Kind[]) {
  test(`@curated ${kind}: a mouse click on Inspect inspects, a mouse click on the card executes`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message))
    const j = await seat(page, kind)
    const title = await mark(page, kind)
    const before = await state(page)

    await j.clickByMouse("[data-cc-target] [data-choice-inspect]", `the Inspect control of "${title}"`)
    const inspected = await state(page)
    expect(inspected.inspecting, `Inspect on "${title}" opens its detail`).toBe(true)
    expect(kind === "escape" ? inspected.preview : inspected.sheet, "...on the surface this kind inspects in").toBe(true)
    expect([inspected.executing, inspected.stand, inspected.moves], "...and executes nothing").toEqual([false, null, before.moves])

    await page.keyboard.press("Escape")
    await expect.poll(async () => (await state(page)).inspecting, "Escape closes the inspection").toBe(false)

    await j.clickByMouse("[data-cc-target] .ngchoice-title", `the body of "${title}"`)
    const executed = await state(page)
    expect(executed.inspecting, `a click on the body of "${title}" does not inspect`).toBe(false)
    expect(executed.executing, `...it executes`).toBe(true)
    expect(executed.stand?.label, "...and the chosen card stays on the table").toBe(title)
    expect(errors).toEqual([])
  })
}

test("@curated a threat is the opponent's move: a mouse click inspects it and never plays it", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Submissions/Triangle-Choke/from-Triangle-Control/Attacker")
  await j.advance(4000)
  const title = await page.evaluate(() => {
    const a = (window as any).__neural
    a._handTouched = true
    const t = (a._optionCards || []).find((c: any) => c.opt.threat)
    t.card.setAttribute("data-cc-threat", "1"); t.card.scrollIntoView({ inline: "nearest", block: "nearest" })
    return t.card.querySelector(".ngchoice-title").textContent.trim()
  })
  const before = await state(page)
  await j.clickByMouse("[data-cc-threat] .ngchoice-title", `the opponent's threat "${title}"`)
  const after = await state(page)
  expect(after.preview, "a threat opens its preview").toBe(true)
  await expect(page.locator("[data-choice-go]"), "...which offers no way to play it").toHaveCount(0)
  expect([after.executing, after.stand, after.moves], "...and nothing executes").toEqual([false, null, before.moves])
})

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test(`@curated a chosen escape stays on the table, where it was, until its result (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const j = await seat(page, "escape")
    // Posture up's authored destination is open guard, on top: a clean escape, so the result is "Escaped!"
    const title = await mark(page, "escape", "Posture up")
    await atRest(page)
    await j.rig("escape", [0])
    const before = await state(page)
    await j.clickByMouse("[data-cc-target] .ngchoice-title", `the escape "${title}"`)
    const picked = await state(page)
    expect(picked.stand, "the chosen escape does not vanish: a stand-in replaces the hand").not.toBeNull()
    expect([picked.stand!.label, picked.stand!.status, picked.stand!.opacity, picked.stand!.visibility],
      "...naming the escape, executing, visible").toEqual([title, "executing", "1", "visible"])
    for (let i = 0; i < 4; i++) {
      expect(Math.abs(picked.stand!.box![i] - before.target![i]), `...exactly where the card was (${picked.stand!.box} vs ${before.target})`).toBeLessThanOrEqual(2)
    }
    // the escape resolves on the card it was chosen from, and the announcer says so
    let after = picked
    for (let i = 0; i < 20 && after.stand && after.stand.status === "executing"; i++) { await j.advance(200); after = await state(page) }
    expect(after.stand?.status, "the stand-in shows the escape's result").toBe("landed")
    expect(after.ev, "...and the announcer names it, not the stale 'Escaping'").toContain("Escaped!")
    // the arrival lifts the stand-in (the one owner of that lifetime, enterLand)
    await expect.poll(async () => { await j.advance(300); return (await state(page)).stand }, { timeout: 20_000 }).toBeNull()
  })
}

test("@curated with the pane open the stand-in is where the clicked card was, not the pane's width to the right", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = await seat(page, "transition")
  await page.evaluate(() => (window as any).__neural.setDeckOpen(true))
  await j.advance(1500)
  const pad = await page.evaluate(() => parseFloat(getComputedStyle((window as any).__neural.optionsRef.current).paddingLeft))
  expect(pad, "precondition: the open pane insets the tray").toBeGreaterThan(200)
  const title = await mark(page, "transition")
  await atRest(page)
  const before = await state(page)
  await j.clickByMouse("[data-cc-target] .ngchoice-title", `the card "${title}" beside the open pane`)
  const picked = await state(page)
  expect(picked.stand?.label).toBe(title)
  for (let i = 0; i < 4; i++) {
    expect(Math.abs(picked.stand!.box![i] - before.target![i]), `the stand-in sits on the clicked card (${picked.stand!.box} vs ${before.target}, row padding ${pad}px)`).toBeLessThanOrEqual(2)
  }
})

test("@curated a card scrolled into the row's left inset keeps its place when chosen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = await seat(page, "transition")
  const title = await mark(page, "transition")
  await atRest(page)
  // swipe the row so the marked card's left edge sits halfway into the left inset (the tray's own
  // NG_TRAY_INSET, the fade side), where a player can still see and click it
  const into = await page.evaluate(() => {
    const a = (window as any).__neural, row = a.optionsRef.current, t = document.querySelector("[data-cc-target]") as HTMLElement
    const pad = parseFloat(getComputedStyle(row).paddingLeft)
    row.scrollLeft += t.getBoundingClientRect().left - (row.getBoundingClientRect().left + pad / 2)
    return t.getBoundingClientRect().left - row.getBoundingClientRect().left
  })
  expect(into, "precondition: the card starts inside the left inset").toBeLessThan(await page.evaluate(() => parseFloat(getComputedStyle((window as any).__neural.optionsRef.current).paddingLeft)))
  const before = await state(page)
  await j.clickByMouse("[data-cc-target] .ngchoice-title", `the card "${title}" in the left inset`)
  const picked = await state(page)
  expect(picked.stand?.label).toBe(title)
  expect(Math.abs(picked.stand!.box![0] - before.target![0]), `the stand-in keeps the card's x (${picked.stand!.box} vs ${before.target})`).toBeLessThanOrEqual(2)
})

/* MUTANTS, recorded 2026-10-05 on the built bundle (one at a time; the neutral control stayed green):
   - escape body click inspects again (preview-first) .... "a click on the body of "Posture up" does not inspect", "the chosen
                                                             escape does not vanish" x2, and submission-choices "the plain
                                                             digit plays the escape: no preview"
   - a threat routed to pick ............................... "a threat opens its preview"
   - Inspect executes ...................................... "Inspect on "<card>" opens its detail", all four kinds
   - the escape pick leaves no stand-in (THE VANISH) ....... "...and the chosen card stays on the table" + "the chosen escape
                                                             does not vanish" at 1440 and 390
   - row left padding not subtracted ....................... "...exactly where the card was" (48 vs 24 at 1440, 24 vs 12 at 390)
                                                             + "the stand-in keeps the card's x"
   - clamp's upper bound stops at the content box .......... "the stand-in sits on the clicked card" (1266 vs 1289.5)
   - clamp's lower bound 0 ................................. "the stand-in keeps the card's x" (24 vs 12)
   - escape result through setEvent (blocked by the stamp) . "the stand-in shows the escape's result", both widths
   NON-KILL, recorded so nobody reads this file as covering it: the escape stand-in taking the camera
   (`_execution.camera` left true) survives. The catch's framing during an escape is not pinned here. */
