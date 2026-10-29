import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/** v1.230.0 — feedback_owner_rules_reverse_shipped_contracts.
 * Reverses v1.218.1's Inspect / shifted digits and v1.220.0's option-sheet entry.
 * D-318: the whole card executes; only its play circle opens the viewer.
 * The retained execution face, geometry, result and no-click-hole checks survive.
 * Watch, front admission and keyboard isolation are covered by video-cards.spec.ts.
 * v1.227.0 regression: the generic defender's 53px overflow was dropped on teardown,
 * then the reader expanded by another 75px. Preserve the chosen card's column until
 * arrival; the original 2px assertion also runs through flight below.
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
  test(`@curated ${kind}: no Inspect or Read, and the card title executes`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message))
    const j = await seat(page, kind)
    const title = await mark(page, kind)
    const before = await state(page)

    // STALE SPEC (D-338, D-347): beside the index the Moves tray is a scroller, so the marked card can
    // sit past its clip; a reader scrolls the tray to it first, until it sits inside its clip.
    const reach = () => expect.poll(() => page.evaluate(() => {
      const t = document.querySelector("[data-cc-target]") as HTMLElement, row = document.querySelector(".ng-optionrow")!.getBoundingClientRect(), b = t.getBoundingClientRect()
      if (b.left >= row.left - 1 && b.right <= row.right + 1) return true
      t.scrollIntoView({ block: "nearest", inline: "nearest" }); return false
    }), { message: "the marked card is scrolled inside the tray", timeout: 10000 }).toBe(true)
    await expect(page.locator("[data-cc-target] [data-choice-inspect]")).toHaveCount(0)
    await expect(page.locator("[data-cc-target] [data-choice-read], [data-cc-target] footer")).toHaveCount(0)
    await page.keyboard.press("Shift+Digit1")
    expect([(await state(page)).inspecting, (await state(page)).executing, (await state(page)).moves]).toEqual([false, false, before.moves])

    await reach(); await j.readerLayoutSettled()
    await j.clickByMouse("[data-cc-target] .ngchoice-title", `the body of "${title}"`)
    const executed = await state(page)
    expect(executed.inspecting, `a click on the body of "${title}" does not inspect`).toBe(false)
    expect(executed.executing, `...it executes`).toBe(true)
    expect(executed.stand?.label, "...and the chosen card stays on the table").toBe(title)
    expect(errors).toEqual([])
  })
}

test("@curated a threat is the opponent's move: its title is inert and no execute or Read control exists", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Submissions/Triangle-Choke/from-Triangle-Control/Attacker")
  await j.advance(4000)
  // A reading-first arrival prepares the real hand asynchronously; pumped game
  // time cannot complete its HTTP request. Require the actual threat to arrive.
  await expect.poll(() => page.evaluate(() => ((window as any).__neural._optionCards || []).some((c: any) => c.opt.threat))).toBe(true)
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
  expect(after.preview, "the retired threat preview stays absent").toBe(false)
  await expect(page.locator("[data-cc-threat] [data-choice-read], [data-cc-threat] [data-choice-execute]")).toHaveCount(0)
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
    for (let i = 0; i < 20 && after.stand && after.stand.status === "executing"; i++) {
      await j.advance(200); after = await state(page)
      if (after.stand) for (let d = 0; d < 4; d++) {
        expect(Math.abs(after.stand.box![d] - before.target![d]), "the chosen escape keeps its rectangle through flight and result").toBeLessThanOrEqual(2)
      }
    }
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

/* Historical v1.218.1 execution mutants remain covered above. Inspect-specific
   mutants were reversed with the owner contract; new input mutants are recorded
   in video-cards.spec.ts and the v1.230.0 delivery report. */
