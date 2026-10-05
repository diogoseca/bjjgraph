import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE CARD, PRESENTED (v@CARD2@). Owner, 2026-10-05, on the dev preview at v1.218.0:
 *  3. "the win chance label and value% should be significantly smaller than the move label and value%,
 *     as, despite being gthe most imporant, the cahnce of it working is only that of the %"
 *  4. "when i click on a choice card there should be a more polished animation of the card. it seems
 *     very static and immovable, perhaps it should move a little bit up as if putting a card on the
 *     table in front of us"
 *  5. "readability / presentation / view of inspect in a submission is not consistent design as the
 *     inspect of other techniques like a transitions"
 *
 * THE RATIOS ARE PINNED, NOT THE PIXELS (the owner sizes by ratio to a token on screen). They mirror
 * app.src.jsx's NG_CARD_*: an answer from the owner is an edit to both, never to one.
 *
 * MEASURED, NEVER RE-IMPLEMENTED (CLAUDE.md §6.3): sizes are the rendered cards' computed fonts; the
 * lift is the app's OWN animation (`getAnimations()`), paused and seeked, its peak found by scanning
 * what it renders rather than read from its keyframes.
 *
 * WHAT THE HARNESS SERVES: submission choices (`submission-details/*.json`) are served; dossiers are
 * `{}`, so the safety test AUTHORS the submission's safety content (window.NG_CONTENT).
 *
 * Mutants, recorded on the built bundle (one at a time): see the bottom of the file.
 */

const MOVE_LABEL = 0.75 // NG_CARD_MOVE_LABEL: the move's label, of the move's own %
const WIN = 0.6 // NG_CARD_WIN: Win chance, label and value, of the move's own %
const LIFT = 1 / 12 // NG_CARD_LIFT: the chosen card's rise, of its own height
const LIFT_MS = 440 // NG_CARD_LIFT_MS

const a = (page: Page, fn: string) => page.evaluate(fn)

async function seat(page: Page, where: "Mount Top" | "Attacker" | "Defender") {
  const j = journey(page)
  if (where === "Mount Top") { await j.boot("/"); await j.land("Mount Top") }
  else { await j.boot(`/Submissions/Triangle-Choke/from-Triangle-Control/${where}`); await j.advance(4000) }
  await expect.poll(() => page.evaluate(() => ((window as any).__neural._optionCards || []).length)).toBeGreaterThan(0)
  return j
}

/** Tag one dealt card (own by kind, or a threat) and return its title. The hand is marked touched so
 *  it never re-sorts under the measurement (CLAUDE.md §5). */
async function mark(page: Page, kind: "transition" | "entry" | "escape" | "threat") {
  return page.evaluate((kind) => {
    const a = (window as any).__neural
    a._handTouched = true
    document.querySelectorAll("[data-cp-target]").forEach((e) => e.removeAttribute("data-cp-target"))
    const hit = (a._optionCards || []).find((c: any) => kind === "threat" ? c.opt.threat
      : !c.opt.threat && (kind === "escape" ? c.opt.action === "escape" : kind === "entry" ? c.opt.node.ty === "submissions" && !c.opt.action : c.opt.node.ty === "transitions"))
    if (!hit) throw new Error("no " + kind + " card")
    hit.card.setAttribute("data-cp-target", "1")
    hit.card.scrollIntoView({ inline: "nearest", block: "nearest" })
    return hit.card.querySelector(".ngchoice-title").textContent.trim() as string
  }, kind)
}

async function atRest(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const m = getComputedStyle(document.querySelector("[data-cp-target]") as HTMLElement).transform
    return m === "none" || m === "matrix(1, 0, 0, 1, 0, 0)"
  }), { message: "the marked card has finished its deal-in ease" }).toBe(true)
}

const cardSizes = (page: Page) => page.evaluate(() => {
  const px = (el: Element | null) => el ? parseFloat(getComputedStyle(el).fontSize) : null
  return [...document.querySelectorAll("[data-choice-group] [data-tech], [data-choice-group] [data-threat-tech]")].map((c) => ({
    threat: c.hasAttribute("data-threat-tech"), title: (c.querySelector(".ngchoice-title") as HTMLElement).textContent!.trim(),
    moveNum: px(c.querySelector(".ngodds")), moveLabel: px(c.querySelector("[data-immediate-label]")),
    winLabel: px(c.querySelector(".ngcv-line > span")), winNum: px(c.querySelector("[data-choice-win]")),
    threatWin: px(c.querySelector("[data-threat-win]")), h: Math.round(c.getBoundingClientRect().height),
  }))
})

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height } })

    test("@curated item 3: on every card Win chance is significantly smaller than the move's own label and %", async ({ page }) => {
      let own = 0, threats = 0
      for (const where of ["Mount Top", "Attacker", "Defender"] as const) {
        await seat(page, where)
        for (const c of await cardSizes(page)) {
          const at = `${where} · ${c.title}`
          expect(c.h, `${at}: the card keeps its 144px box`).toBe(144)
          expect(Math.abs(c.moveLabel! / c.moveNum! - MOVE_LABEL), `${at}: move label = ${MOVE_LABEL} of the move % (${c.moveLabel}/${c.moveNum})`).toBeLessThan(0.02)
          if (c.threat) {
            threats++
            expect(Math.abs(c.threatWin! / c.moveNum! - WIN), `${at}: a threat's Win chance = ${WIN} of its Odds (${c.threatWin}/${c.moveNum})`).toBeLessThan(0.02)
            continue
          }
          own++
          expect(Math.abs(c.winNum! / c.moveNum! - WIN), `${at}: Win chance value = ${WIN} of the move % (${c.winNum}/${c.moveNum})`).toBeLessThan(0.02)
          expect(Math.abs(c.winLabel! / c.moveNum! - WIN), `${at}: Win chance label = ${WIN} of the move % (${c.winLabel}/${c.moveNum})`).toBeLessThan(0.02)
          // "significantly smaller", both halves of it, whatever the ratios are tuned to
          expect(c.winNum! / c.moveNum!, `${at}: the Win chance value is significantly smaller than the move %`).toBeLessThanOrEqual(0.7)
          expect(c.winLabel! / c.moveLabel!, `${at}: the Win chance label is significantly smaller than the move label`).toBeLessThanOrEqual(0.85)
        }
      }
      // a check that measured nothing must not pass (CLAUDE.md §6.6)
      expect(own, "own cards measured across a position, an attacker's and a defender's hand").toBeGreaterThan(10)
      expect(threats, "threat cards measured").toBeGreaterThan(1)
    })

    test("@curated item 4: the chosen card rises a twelfth of its height and settles, its rectangle never moves", async ({ page }) => {
      const j = await seat(page, "Mount Top")
      // a submission ENTRY: certain, no roll, and the one path whose next deal follows the stand-in
      // with no clearOptions between (choice-row-centre's case), so only the deal can restore the row
      const title = await mark(page, "entry")
      await atRest(page)
      const before = await page.evaluate(() => { const r = document.querySelector("[data-cp-target]")!.getBoundingClientRect(); return [r.left, r.top, r.width, r.height] })
      await j.clickByMouse("[data-cp-target] .ngchoice-title", `the card "${title}"`)
      const lift = await page.evaluate(() => {
        // whatever the app animates under the stand-in, measured as it renders (a lift that moved the
        // HOLDER must be measured, not missed)
        const holder = document.querySelector("[data-executing-tech]") as HTMLElement
        const an = holder.getAnimations({ subtree: true })[0]
        if (!an) return null
        const face = (an.effect as KeyframeEffect).target as HTMLElement
        an.pause()
        const dur = Number(an.effect!.getTiming().duration)
        // the peak, found from what the animation RENDERS, not from its keyframes
        let peak = { t: 0, ty: 0 }
        for (let t = 0; t <= dur; t += 5) { an.currentTime = t; const ty = new DOMMatrix(getComputedStyle(face).transform).m42; if (ty < peak.ty) peak = { t, ty } }
        an.currentTime = peak.t
        const hr = holder.getBoundingClientRect(), row = (window as any).__neural.optionsRef.current
        const hit = document.elementFromPoint(hr.left + hr.width / 2, hr.bottom - 3)
        const out = { dur, peak, holder: [hr.left, hr.top, hr.width, hr.height], hole: !(hit && (hit === holder || holder.contains(hit))), rowOverflowY: getComputedStyle(row).overflowY,
          faceTop: face.getBoundingClientRect().top, end: "" }
        an.currentTime = dur - 1   // the last rendered moment (at `dur` an unfilled animation applies nothing)
        const m = new DOMMatrix(getComputedStyle(face).transform)
        out.end = Math.abs(m.m42) < 0.5 && Math.abs(m.m11 - 1) < 0.01 ? "settled" : `ty ${m.m42.toFixed(2)} scale ${m.m11.toFixed(3)}`
        an.play()
        return out
      })
      expect(lift, "the chosen card animates").not.toBeNull()
      expect(lift!.dur, `the lift takes NG_CARD_LIFT_MS (${LIFT_MS} ms)`).toBe(LIFT_MS)
      expect(Math.abs(-lift!.peak.ty / before[3] - LIFT), `it rises ${LIFT.toFixed(3)} of its height (${-lift!.peak.ty}px of ${before[3]})`).toBeLessThan(0.005)
      expect(lift!.faceTop, "...past the row's top: the row does not clip the rising card").toBeLessThan(before[1] - 2)
      expect(lift!.rowOverflowY, "...because the row holding the stand-in does not clip").toBe("visible")
      for (let i = 0; i < 4; i++) expect(Math.abs(lift!.holder[i] - before[i]), `the stand-in's rectangle stays where the card was (${lift!.holder} vs ${before})`).toBeLessThanOrEqual(1)
      expect(lift!.hole, "at the peak, the bottom of the card's rectangle still belongs to the stand-in (no click hole onto the graph)").toBe(false)
      expect(lift!.end, "it settles back where it was").toBe("settled")
      // the next deal scrolls again: it restores the row's clipping
      await j.nextHand()
      expect(await a(page, "(() => { const s = getComputedStyle(window.__neural.optionsRef.current); return s.overflowX + '/' + s.overflowY })()"), "the next deal restores the row's scrolling").toBe("auto/hidden")
    })

    test("@curated item 4: under reduced motion the chosen card does not rise", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" })
      const j = await seat(page, "Mount Top")
      const title = await mark(page, "transition")
      await atRest(page)
      await j.clickByMouse("[data-cp-target] .ngchoice-title", `the card "${title}"`)
      const still = await page.evaluate(() => { const f = (document.querySelector("[data-executing-tech]") as HTMLElement).firstElementChild as HTMLElement; return { anims: f.getAnimations().length, tf: getComputedStyle(f).transform } })
      expect(still.anims, "no animation on the chosen card").toBe(0)
      expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(still.tf)
    })

    test("@curated item 5: Inspect in a submission is the same sheet as a transition's, safety included", async ({ page }) => {
      // the sheet's measurable anatomy: geometry, head, the chance row, the footer
      const shape = () => page.evaluate(() => {
        const a = (window as any).__neural, p = a.optDetailRef.current as HTMLElement, r = p.getBoundingClientRect()
        const kids = [...p.children] as HTMLElement[], grab = kids[0], foot = kids[kids.length - 1]
        const big = p.querySelector(".ngsucbig") as HTMLElement | null
        const title = [...p.querySelectorAll("div")].find((d) => getComputedStyle(d).fontSize === "27px") as HTMLElement | undefined
        const back = [...foot.querySelectorAll("button")].find((b) => /Back/.test(b.textContent || "")) as HTMLElement | undefined
        const body = p.querySelector("[data-sheet-escape]")?.parentElement || null
        return {
          rect: [Math.round(r.left), Math.round(r.width), Math.round(r.height), Math.round(window.innerHeight - r.bottom)],
          grabber: getComputedStyle(grab).cursor, glyph: !!p.querySelector("svg"), title: title ? title.textContent!.trim() : null,
          chance: big ? [getComputedStyle(big).fontSize, (big.closest("div") as HTMLElement).textContent!.replace(/\s+/g, " ").trim().slice(0, 40)] : null,
          back: back ? [getComputedStyle(back).fontSize, Math.round(back.getBoundingClientRect().height), /Esc/.test(back.textContent || "")] : null,
          go: !!p.querySelector("[data-go]"), goHeight: Math.round(p.querySelector("[data-go]")?.getBoundingClientRect().height || 0),
          sections: body ? [...body.querySelectorAll(":scope > section")].map((s) => [...s.attributes].map((x) => x.name).find((n) => n.startsWith("data-sheet-"))) : [],
        }
      })
      const settled = async () => { let last = ""; await expect.poll(async () => { const s = JSON.stringify(await shape()); const same = s === last; last = s; return same }, { intervals: [200, 200, 300] }).toBe(true); return shape() }
      const close = async () => { await page.keyboard.press("Escape"); await expect.poll(() => a(page, "!!window.__neural._detailCtx")).toBe(false) }

      // the reference: a transition's Inspect
      const j = await seat(page, "Mount Top")
      await mark(page, "transition")
      await j.clickByMouse("[data-cp-target] [data-choice-inspect]", "Inspect on a transition")
      const ref = await settled()
      await close()

      // the submission's dossier, authored: the harness serves {} for dossiers
      const seedSafety = () => page.evaluate(() => {
        const a = (window as any).__neural, w = window as any, sub = a.nodes[a.currentPos]
        w.NG_CONTENT = w.NG_CONTENT || {}; w.NG_CONTENT.decks = w.NG_CONTENT.decks || {}
        w.NG_CONTENT.decks[sub.t] = { safety: { notice: "Seeded safety notice.", tap: ["Tap with the hand."], release: ["Release at once."] } }
        return sub.t
      })

      // your escape, defending the triangle
      await seat(page, "Defender")
      await seedSafety()
      await mark(page, "escape")
      await j.clickByMouse("[data-cp-target] [data-choice-inspect]", "Inspect on an escape")
      const esc = await settled()
      await close()

      // the opponent's escape while you finish: a threat
      await seat(page, "Attacker")
      await seedSafety()
      const threat = await mark(page, "threat")
      await j.clickByMouse("[data-cp-target] .ngchoice-title", `the opponent's threat "${threat}"`)
      const thr = await settled()
      const before = await a(page, "window.__neural.moveCount")
      await page.keyboard.press("Enter")
      expect(await a(page, "window.__neural.moveCount"), "Enter on a threat's sheet plays nothing").toBe(before)

      for (const [name, s] of [["escape", esc], ["threat", thr]] as const) {
        expect(s.rect, `${name}: the same docked sheet, same place and size, as a transition's`).toEqual(ref.rect)
        expect(s.grabber, `${name}: the sheet's grabber`).toBe(ref.grabber)
        expect(s.glyph, `${name}: the head's glyph`).toBe(true)
        expect(s.title, `${name}: the sheet's 27px title`).toBeTruthy()
        expect(s.chance && s.chance[0], `${name}: the sheet's chance row, at the sheet's size`).toBe(ref.chance![0])
        expect(s.back, `${name}: the sheet's Back (Esc)`).toEqual(ref.back)
        // the submission's safety notice opens the body and its safety guide closes it (CLAUDE.md §7)
        expect(s.sections[0], `${name}: the safety notice first (${s.sections})`).toBe("data-sheet-safety-notice")
        expect(s.sections[s.sections.length - 1], `${name}: the safety guide last (${s.sections})`).toBe("data-sheet-safety")
        expect(s.sections, `${name}: the escape's own detail between them`).toContain("data-sheet-escape")
      }
      expect([esc.go, esc.goHeight], "your escape plays from its sheet, at the sheet's touch size").toEqual([true, ref.goHeight])
      expect([ref.goHeight >= 44, ref.back![1] >= 44], `the sheet's play and Back buttons are touch-sized (${ref.goHeight}, ${ref.back![1]})`).toEqual([true, true])
      expect(thr.go, "the opponent's move can be read, never played").toBe(false)
    })
  })
}

/* MUTANTS, recorded 2026-10-05 on the built bundle (one at a time; the neutral control stayed green):
   item 3
   - NG_CARD_WIN = 1 ........................................ "Win chance value = 0.6 of the move %" (15/15), both widths
   - the card's Win chance CSS rule removed ................. "Win chance value = 0.6 of the move %" (16/15)
   - move label back to a literal 9px ....................... "move label = 0.75 of the move %" (9/15)
   - threat Win chance back to a literal 13px ............... "a threat's Win chance = 0.6 of its Odds" (13/15)
   item 4
   - no lift ................................................ "the chosen card animates"
   - the lift moves the HOLDER (opens a click hole) ......... "the stand-in's rectangle stays where the card was"
   - reduced motion ignored ................................. "no animation on the chosen card"
   - NG_CARD_LIFT = 1/6 ..................................... "it rises 0.083 of its height" (24px of 144)
   - never settles (last keyframe lifted) ................... "it settles back where it was"; it SURVIVED a first cut
                                                               that read the transform at currentTime = duration, where
                                                               an unfilled animation applies nothing
   - the row keeps clipping the lift ........................ "...because the row holding the stand-in does not clip"
   - the deal does not restore the row ...................... "the next deal restores the row's scrolling" (an ENTRY,
                                                               the one path with no clearOptions before the next deal)
   item 5
   - escape sheet drops the safety notice ................... "escape: the safety notice first"
   - escape sheet drops the safety guide .................... "escape: the safety guide last"
   - a threat gets a play button ............................ "the opponent's move can be read, never played"
   - the escape/threat head loses its glyph ................. "escape: the head's glyph"
   - both sheet buttons lose min-height:44px ................ "the sheet's play and Back buttons are touch-sized (41, 41)"
   NON-KILL, recorded: removing the play button's min-height ALONE survives, because the footer stretches
   it to Back's 44px; only both together are pinned. */
