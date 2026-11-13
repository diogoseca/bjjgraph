import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * CARDWIDTH (owner, 2026-11-12, a note on a 390x631 phone screenshot): "wow, i see that landcard section isn't going the same width as
 * the choices row container! pls fix that, the left and right arrwos on each side should tightly fit whatever centered on whatever
 * space there is left on the left and right respectfully".
 *
 * WAS (to v1.262.10): the open face was the column less 104px and each deck arrow stood in a 52px lane OUTSIDE it, 8px clear. At 390 the
 * face ran 52-338 under a Moves row whose cards start at 12, its arrows on the screen's edges (0-44, 346-390); at 768 the face was the
 * row's 496px and its arrows hung outside the row; at 1440, beside the index, Previous was stacked over Next in the right lane.
 * NOW: the card's SECTION, the face and its two arrows, spans the Moves row's own box: the row less its phone gutter under 600px free,
 * the grid where the row is flush, the left column in columns. INSIDE (variant a: phones, and the columns): the face takes all of it but
 * one 32px lane per arrow; each arrow's 44px target abuts the face and reaches 12px past the section's edge; its glyph stands in the
 * middle of its lane. OUTSIDE (WIDTH2, U152 b, built while the owner looks: from 600px free up to the columns, where both margins hold a
 * 44px target): the face IS the section, and each target abuts it from outside, the glyph the same 16px from the face. With no deck,
 * the face alone spans the section either way. (reader.src.js, `arrowLanes`; helmet.html, `.ng-landnav`.)
 * WIDTH4 (owner, 2026-11-12 18:18, "on mobile it still doesnt look as wide as the choices row and as other sections in the article"),
 * p5: on a phone (under 600px free) the face is the whole section, the grid's box, which there is the Moves row's own content box up to
 * the 496px cap, and the film and the article's sections share it; the arrows stand INSIDE the face, each target over its 44px side
 * padding and reaching 12px past its edge, the answers clear of both. Mode "phone" below; "lanes" is now the columns only.
 * WIDTH5 (the owner's U154 e, 13 Nov 2026: "make sure the left and right arrows are centered in the left available and right available
 * space inside the card. it seems well positioned in p2 but not in p5"): on a phone each glyph stands in the middle of the space free on
 * its side inside the face, between the face's edge and the answers' edge. WAS (p5 as he saw it): 16px in, the lane's place, 6.5px
 * short of that middle once the padding grew to 44px (p2's shot had 36px: 2.5px short, which read as centred).
 *
 * THE CLAIMS, at 390x844, 390x631 (the real p10 phone), 574x760, 768x1024 and 1440x900, and one width each side of each switch
 * (599 | 600: the row turns flush; 1023 | 1024: the columns begin), each box read from the page, never recomputed:
 *   1. INSIDE: the face stands one lane in from each edge of the section, the same lane on both sides: 32px, the 44px target less the
 *      12px it reaches past the section's edge. OUTSIDE: the face is the section, edge for edge, and each margin holds a target;
 *   2. each arrow's target is 44 x 44, abuts the face, lies on screen and within the face's height (so it stands beside the face and
 *      never in the Moves band above it);
 *   3. LANES: each glyph's centre is the middle of its lane, between the section's edge and the face. OUTSIDE: 16px from the face.
 *      PHONE (WIDTH5): the drawn chevron's centre is the middle of the free space inside the face on its side, within half a pixel;
 *   4. every point of a target is the arrow's (inside, its reach past the section included), and 1px inside the face's edge is the
 *      face's; Next pages by mouse at its centre, and Previous pages back pressed in its outer part (by mouse; by touch at 390x844 and
 *      390x631);
 *   5. no deck (questions off): the face alone spans the section.
 * THE SECTION, measured: stacked, the Moves row's box less its computed padding; in columns, the grid's left edge to the film's width
 * past it (the two columns are one width, `mediaWidth` is `column`).
 * HARNESS: the real dossier chunks are served (`route.continue()`), so the film stands where it does in play: under the question
 * stacked, beside it in columns, where its width is what the section is read from. The DSL stubs Google Fonts, so a face's HEIGHT is
 * the harness's; no claim here rests on a height.
 * Red-proof is recorded at the foot of this file.
 */

// `mode` is the claim: where the arrows stand at this size. "phone" (WIDTH4, p5): inside the face's own side padding, the face the
// whole section; "outside" (WIDTH2, U152 b): tight outside the face, which is the section; "lanes": in a 32px lane each side of the
// face inside its column. `rowWide`: the stacked cap does not bind, so the section is the Moves row's own content box.
const SIZES = [
  { width: 390, height: 844, touch: true, mode: "phone", rowWide: true },
  { width: 390, height: 631, touch: true, mode: "phone", rowWide: true },
  { width: 360, height: 740, touch: true, mode: "phone", rowWide: true },
  { width: 574, height: 760, touch: false, mode: "phone", rowWide: false },
  { width: 599, height: 760, touch: false, mode: "phone", rowWide: false },
  { width: 600, height: 760, touch: false, mode: "outside", rowWide: false },
  { width: 768, height: 1024, touch: false, mode: "outside", rowWide: false },
  { width: 1023, height: 768, touch: false, mode: "outside", rowWide: false },
  { width: 1024, height: 768, touch: false, mode: "lanes", rowWide: false },
  { width: 1440, height: 900, touch: false, mode: "lanes", rowWide: false },
] as const

const realChunks = async (page: Page) => { await page.route("**/static/neural/content/*.json", r => r.continue()) }

type Box = { l: number, r: number, t: number, b: number }

/** What the page laid out: the section (see the header), the face, both targets and glyphs, the film, the first tile, the answers. */
const geometry = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, reader = a._reader, row = a.optionsRef.current as HTMLElement
  const box = (e: Element | null | undefined): Box | null => {
    if (!e || !(e as HTMLElement).getClientRects().length) return null
    const q = e.getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom }
  }
  const layout = reader.game.dataset.mediaLayout as string
  const rb = row.getBoundingClientRect(), cs = getComputedStyle(row)
  const grid = reader.body.getBoundingClientRect(), film = a._landFilmEl?.getBoundingClientRect()
  // stacked, the section is the grid's box (WIDTH4: on a phone the Moves row's own width, up to the cap); in columns, the left column
  const section = layout === "side-by-side" ? { l: grid.left, r: grid.left + film.width } : { l: grid.left, r: grid.right }
  const nav = a._landNavEl as HTMLElement | null
  const prev = nav?.querySelector("[data-land-prev]") as HTMLElement | null, next = nav?.querySelector("[data-land-next]") as HTMLElement | null
  const tile = row.querySelector("[data-tech]")
  const firstSection = ([...reader.body.children] as HTMLElement[]).find(e => e.getClientRects().length && e.getBoundingClientRect().height > 20) || null
  return { W: innerWidth, H: innerHeight, layout, section, rowContent: { l: rb.left + parseFloat(cs.paddingLeft), r: rb.right - parseFloat(cs.paddingRight) },
    face: box(a._landEl), deck: !!a._landEl?.classList.contains("ng-land-deck"), asking: !!a._landEl?.hasAttribute("data-land-ask"),
    prev: box(prev), next: box(next), prevGlyph: box(prev?.querySelector("svg")), nextGlyph: box(next?.querySelector("svg")), tile: box(tile),
    // WIDTH5: the chevron as drawn, its path's own box (it stands 0.29px off its 14px box's centre: M15 5l-7 7 7 7 in a 24 box)
    prevInk: box(prev?.querySelector("path")), nextInk: box(next?.querySelector("path")),
    film: box(a._landFilmEl), firstSection: box(firstSection),
    answers: ([...(a._landEl?.querySelectorAll("[data-land-mc-opt]") || [])] as Element[]).filter(e => e.getClientRects().length).map(e => ({ ...box(e)!, v: e.getAttribute("data-land-mc-opt") })),
    count: (a._landEl?.querySelector("[data-land-count]") as HTMLElement | null)?.textContent || "" }
})

/** Who owns each point: the selector's element (or a descendant) must, at every one. */
const owners = (page: Page, sel: string, points: [number, number][]) => page.evaluate(([sel, points]) => {
  const el = document.querySelector(sel as string)
  return (points as [number, number][]).map(([x, y]) => {
    const top = document.elementFromPoint(x, y)
    const ok = !!el && !!top && (top === el || el.contains(top))
    return ok ? "" : `(${x.toFixed(1)},${y.toFixed(1)}) is <${top ? top.tagName.toLowerCase() + " " + String((top as HTMLElement).className || "") + [...top.attributes].filter(t => t.name.startsWith("data-")).map(t => " " + t.name).join("") : "nothing"}>`
  }).filter(Boolean)
}, [sel, points] as const)

async function opened(page: Page) {
  const j = journey(page)
  await j.boot("/", { beforeNavigate: realChunks })
  await j.land("Mount Top")
  await j.openQuestion()
  await page.locator("[data-landcard]").evaluate(e => e.scrollIntoView({ block: "nearest" }))
  await j.readerLayoutSettled()
  return j
}

const TITLE = { phone: "inside the face, at its edges", outside: "outside the face", lanes: "in their lanes" } as const

for (const size of SIZES) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use(size.touch ? { viewport: { width: size.width, height: size.height }, hasTouch: true, isMobile: true } : { viewport: { width: size.width, height: size.height } })

    test(`CARDWIDTH: the card's section spans the Moves row's box, its arrows tight ${TITLE[size.mode]} (${size.width}x${size.height})`, async ({ page }) => {
      const j = await opened(page)
      const g = await geometry(page)
      expect(g.layout, "premise: the film is served and placed").toBe(size.width >= 1024 ? "side-by-side" : "stacked")
      expect(g.deck && !g.asking, "premise: the question is taken up and has a deck").toBe(true)
      const { section: s, face: f, prev: p, next: n } = g
      expect(f && p && n && g.prevGlyph && g.nextGlyph, "premise: the face, both arrows and both glyphs are painted").toBeTruthy()
      const r = (x: number) => Math.round(x)

      // 1. PHONE and OUTSIDE: the face is the section. LANES: one 32px lane each side, the face the section less the two.
      const left = f!.l - s.l, right = s.r - f!.r
      if (size.mode === "lanes") {
        expect(Math.abs(left - right), `the face is centred in the section [${s.l}, ${s.r}]: lanes ${left} / ${right}`).toBeLessThanOrEqual(0.5)
        expect(left, `each lane is 32px, the target less its 12px reach (face ${f!.l}..${f!.r} in ${s.l}..${s.r})`).toBeCloseTo(32, 0)
      } else {
        expect([left, right].map(r), `the face is the section, edge for edge (face ${f!.l}..${f!.r} in ${s.l}..${s.r})`).toEqual([0, 0])
      }
      if (size.mode === "outside") expect(Math.min(s.l, g.W - s.r), `premise: each margin beside the section holds a 44px target (${s.l} / ${g.W - s.r})`).toBeGreaterThanOrEqual(44)
      if (size.mode === "phone") {
        // WIDTH4 (owner, 2026-11-12 18:18): on a phone the face, the film and the article's sections share one box, and where the cap
        // does not bind it is the Moves row's own content box.
        if (size.rowWide) expect([s.l - g.rowContent.l, s.r - g.rowContent.r].map(r), `the section is the Moves row's box (${s.l}..${s.r} / ${g.rowContent.l}..${g.rowContent.r})`).toEqual([0, 0])
        expect(g.film && [g.film.l - f!.l, g.film.r - f!.r].map(r), `the film shares the face's two edges (${g.film?.l}..${g.film?.r})`).toEqual([0, 0])
        expect(g.firstSection && [g.firstSection.l - f!.l, g.firstSection.r - f!.r].map(r), `the article's first section shares the face's two edges (${g.firstSection?.l}..${g.firstSection?.r})`).toEqual([0, 0])
      }

      // 2. The targets: 44 x 44, on screen, within the face's height; where each stands against the face.
      for (const [name, t] of [["Previous", p!], ["Next", n!]] as const) {
        expect(t.r - t.l, `${name}'s target is 44px wide`).toBeCloseTo(44, 0)
        expect(t.b - t.t, `${name}'s target is 44px tall`).toBeCloseTo(44, 0)
        expect(t.t, `${name} stands beside the face, not above it`).toBeGreaterThanOrEqual(f!.t - 0.5)
        expect(t.b, `${name} stands beside the face, not below it`).toBeLessThanOrEqual(f!.b + 0.5)
      }
      expect(p!.l, "Previous is on screen").toBeGreaterThanOrEqual(-0.5)
      expect(n!.r, "Next is on screen").toBeLessThanOrEqual(g.W + 0.5)
      const mid = (b: Box) => (b.l + b.r) / 2
      if (size.mode === "phone") {
        // PHONE: each target over the face's own edge, 32px inside it and 12px past it; the answers clear of both.
        expect([p!.r - f!.l, f!.l - p!.l].map(r), `Previous stands 32px inside the face and reaches 12px past its edge (${p!.l}..${p!.r} / ${f!.l})`).toEqual([32, 12])
        expect([f!.r - n!.l, n!.r - f!.r].map(r), `Next stands 32px inside the face and reaches 12px past its edge (${n!.l}..${n!.r} / ${f!.r})`).toEqual([32, 12])
        expect(g.answers.length, "premise: the answers are painted").toBeGreaterThan(1)
        for (const a of g.answers) expect([a.l >= p!.r - 0.5, a.r <= n!.l + 0.5], `an answer (${a.l}..${a.r}) runs under neither arrow (${p!.r} / ${n!.l})`).toEqual([true, true])
        // 3. PHONE (WIDTH5, U154 e): each drawn chevron in the middle of the space free on its side inside the face: from the face's edge
        // to the answers' (WAS: 16px in, 6.5px short of it). Both read from the page, the answers' outermost edges.
        expect(g.prevInk && g.nextInk, "premise: both chevrons are drawn").toBeTruthy()
        const ansL = Math.min(...g.answers.map(a => a.l)), ansR = Math.max(...g.answers.map(a => a.r))
        expect(Math.abs(mid(g.prevInk!) - (f!.l + ansL) / 2), `Previous's glyph is centred in the free space on its side (${mid(g.prevInk!)} / ${(f!.l + ansL) / 2}, from ${f!.l} to ${ansL})`).toBeLessThanOrEqual(0.5)
        expect(Math.abs(mid(g.nextInk!) - (ansR + f!.r) / 2), `Next's glyph is centred in the free space on its side (${mid(g.nextInk!)} / ${(ansR + f!.r) / 2}, from ${ansR} to ${f!.r})`).toBeLessThanOrEqual(0.5)
        for (const [name, ink, t] of [["Previous", g.prevInk!, p!], ["Next", g.nextInk!, n!]] as const)
          expect(ink.l >= t.l && ink.r <= t.r, `${name}'s glyph stays inside its own 44px target (${ink.l}..${ink.r} in ${t.l}..${t.r})`).toBe(true)
      } else {
        expect(Math.abs(p!.r - f!.l), `Previous abuts the face (${p!.r} / ${f!.l})`).toBeLessThanOrEqual(0.5)
        expect(Math.abs(n!.l - f!.r), `Next abuts the face (${n!.l} / ${f!.r})`).toBeLessThanOrEqual(0.5)
        if (size.mode === "outside") {
          // 3. OUTSIDE: each glyph 16px from the face, as it stands inside the face on a phone.
          expect(f!.l - mid(g.prevGlyph!), `Previous's glyph stands 16px from the face (${mid(g.prevGlyph!)} / ${f!.l})`).toBeCloseTo(16, 0)
          expect(mid(g.nextGlyph!) - f!.r, `Next's glyph stands 16px from the face (${mid(g.nextGlyph!)} / ${f!.r})`).toBeCloseTo(16, 0)
        } else {
          expect(s.l - p!.l, "Previous reaches 12px past the section's edge").toBeCloseTo(12, 0)
          expect(n!.r - s.r, "Next reaches 12px past the section's edge").toBeCloseTo(12, 0)
          // 3. LANES: each glyph stands in the middle of its lane.
          expect(Math.abs(mid(g.prevGlyph!) - (s.l + f!.l) / 2), `Previous's glyph is centred in its lane (${mid(g.prevGlyph!)} / ${(s.l + f!.l) / 2})`).toBeLessThanOrEqual(0.5)
          expect(Math.abs(mid(g.nextGlyph!) - (f!.r + s.r) / 2), `Next's glyph is centred in its lane (${mid(g.nextGlyph!)} / ${(f!.r + s.r) / 2})`).toBeLessThanOrEqual(0.5)
        }
      }

      // 4. Presses: every point of each target is the arrow's; outside a target the face (on a phone, each answer) keeps its edges;
      // the moves keep their first card.
      const grid = (t: Box): [number, number][] => [t.l + 1, t.l + 6, (t.l + t.r) / 2, t.r - 6, t.r - 1].flatMap(x => [t.t + 1, (t.t + t.b) / 2, t.b - 1].map(y => [x, y] as [number, number]))
      expect(await owners(page, "[data-land-prev]", grid(p!)), "every point of Previous's target is Previous's").toEqual([])
      expect(await owners(page, "[data-land-next]", grid(n!)), "every point of Next's target is Next's").toEqual([])
      if (size.mode === "phone") {
        for (const a of g.answers) expect(await owners(page, `[data-land-mc-opt="${a.v}"]`, [[a.l + 1, (a.t + a.b) / 2], [a.r - 1, (a.t + a.b) / 2]]), `answer ${a.v} keeps both its edges`).toEqual([])
      } else {
        const y = (p!.t + p!.b) / 2
        expect(await owners(page, "[data-landcard]", [[f!.l + 1, y], [f!.r - 1, y]]), "1px inside the face's edges is the face's").toEqual([])
      }
      if (g.tile) expect(await owners(page, "[data-tech]", [[g.tile.l + 1, (g.tile.t + g.tile.b) / 2]]), "the first move keeps its own edge").toEqual([])
      const total = g.count.split("/")[1]
      await j.clickByMouse("[data-land-next]", "Next, by mouse where it sits")
      await expect(page.locator("[data-land-count]"), "Next pages the deck").toHaveText(`2/${total}`)
      await j.readerLayoutSettled()
      const back = (await geometry(page)).prev!, reach: [number, number] = [back.l + 4, (back.t + back.b) / 2]
      expect(await owners(page, "[data-land-prev]", [reach]), "Previous owns its outer part (its reach past the edge)").toEqual([])
      if (size.touch) await page.touchscreen.tap(...reach); else await page.mouse.click(...reach)
      await expect(page.locator("[data-land-count]"), `Previous pages back, ${size.touch ? "tapped" : "clicked"} in its outer part`).toHaveText(`1/${total}`)
    })

    test(`CARDWIDTH: with no deck the face alone spans the section (${size.width}x${size.height})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/", { beforeNavigate: realChunks })
      await page.evaluate(() => (window as any).__neural.set("landQuestions", false))
      await j.land("Mount Top")
      await j.readerLayoutSettled()
      const g = await geometry(page)
      expect(g.face && !g.deck && !g.asking, "premise: a card with no question, so no deck and no arrows").toBe(true)
      expect(g.prev, "premise: no arrows").toBeNull()
      expect(g.layout, "premise: the film is served and placed").toBe(size.width >= 1024 ? "side-by-side" : "stacked")
      expect(Math.abs(g.face!.l - g.section.l), `the face starts on the section's edge (${g.face!.l} / ${g.section.l})`).toBeLessThanOrEqual(0.5)
      expect(Math.abs(g.face!.r - g.section.r), `the face ends on the section's edge (${g.face!.r} / ${g.section.r})`).toBeLessThanOrEqual(0.5)
    })
  })
}

// Red-proof (v1.263.1, under the build lock on a private server, each against a green baseline of the same test; reader rows in
// tests/artifacts/article_sections_mutants.mjs, stylesheet rows in tests/artifacts/neural_app_mutants.mjs):
//   cardwidth-old-face ............. dev's width line back, 390x631 ........ killed: each lane is 32px (face 52..338 in 12..378)
//   cardwidth-section-free ......... section from the free width, 390x844 .. killed: each lane is 32px (face 48..342 in 12..378)
//   cardwidth-tablet-lanes-lost .... RETIRED in WIDTH2 with its subject (at 768 the lanes are gone by design)
//   cardwidth-column-offset-lost ... the face on the grid's edge, 1440 ..... killed: the face is centred in the section (lanes 0 / 64)
//   WIDTH2 (U152 b), the switch, from both sides:
//   cardwidth-b-lost ............... lanes everywhere (a), 768 ............. killed: the face is the section, edge for edge (168..600 in 136..632)
//   cardwidth-b-in-columns ......... outside in the columns too, 1024x768 .. killed: each lane is 32px (face 61..500 in 61..500)
//   cardwidth-b-margin-too-strict .. 120px of margin asked for, 600x760 ... killed: the face is the section, edge for edge (84..516 in 52..548)
//   cardwidth-b-starts-early ....... the row flush from 590px, 599x760 ..... killed: each lane is 32px (face 51.5..547.5 in 51.5..547.5)
//   cardwidth-b-gap-back ........... Previous 8px clear outside, 768 ....... killed: Previous abuts the face
//   cardwidth-nodeck-old ........... no deck keeps free - 32, 390x844 ...... killed: the face starts on the section's edge (16 / 12)
//   cardwidth-nodeck-column-old .... no deck keeps column - 52, 1440 ....... killed: the face ends on the section's edge (656 / 708)
//   cardwidth-arrow-gap-back ....... Previous 8px clear again, 390x844 ..... killed: Previous abuts the face (36 / 44)
//   cardwidth-glyph-in-target ...... the glyph centred in its target, 390x631 killed: Previous's glyph is centred in its lane (22 / 28)
//   cardwidth-next-glyph-in-target . Next's glyph pushed out, 768 .......... killed: Next's glyph stands 16px from the face (WIDTH2)
//   cardwidth-arrows-in-moves-band . the arrows up at top:-60px, 1440 ...... killed: Previous stands beside the face, not above it
// WIDTH4 (v1.265.0, p5), under the build lock, each against a green baseline:
//   width4-grid-phone-gutter-lost .. the grid back to free - 64, 390x844 .. killed: the section is the Moves row's box (32..358 / 12..378)
//   width4-phone-lanes-back ........ the 32px lanes back on a phone, 390x631 killed: the face is the section (face 44..346 in 12..378)
//   width4-film-phone-lost ......... the film back to filmLayout's, 360x740 . killed: the film shares the face's two edges (16..344)
//   width4-padding-lost ............ the face's 44px padding gone, 390x631 .. killed: an answer runs under neither arrow
//   width4-arrows-outside-on-phone . the phone arrow rule gone, 390x844 ..... killed: Previous is on screen
//   width4-switch-media-early ...... the phone query at 589px, 599x760 ..... killed: Previous stands 32px inside the face
//   width4-asking-padded ........... the padding on the asking line too ..... killed in article-order.spec.ts: the line starts at the label
//   cardwidth-b-starts-early ....... NON-KILL under WIDTH4, equivalent: at 599px the cap binds on both sides of the reader's switch
// Control (v1.263.1): this whole file against dev v1.262.10's own bundle, 9 of 10 red at these claims; the 768 no-deck test green (that face
// already spanned the row). NOT KILLED, recorded: nothing here can see the 12px reach go to a neighbour's press, because no control
// stands in a phone's 12px gutter or the index's 12px clearance today; the press samples would catch one that did.
