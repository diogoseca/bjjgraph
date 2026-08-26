import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * LANDING-CARD CHROME, FOUR OWNER REPORTS (v1.104.2). Run at 390x844 because that is where three
 * of the four actually bite — the corner's 44px thumb target, the card's mobile width override,
 * and the film strip that duplicated the DESKTOP width rule as a constant.
 *
 *  1. After More -> Less the toggle "is black over a dark background, so it's poorly readable".
 *     `expandLandCard` restored it with `style.color = ""`, which DELETES the inline declaration
 *     from the button's own cssText rather than restoring it, so the collapsed button inherited
 *     from a parent that sets no colour and fell back to the UA default: black, on a #131625 card.
 *  2. The corner pair should be "a bit closer and a bit closer to the top (symmetric to how the x
 *     close button is close to the right edge)". A 44px + beside a 24px ✕ under align-items:center
 *     made the row 44 tall, so both glyphs sat 10px below the 5px inset implied.
 *  3. "the span of the videos row should perhaps be the same width as the ng-landcard?" — both
 *     used min(520px, 100vw-32px), but the card has a mobile override
 *     (width:calc(100vw - 20px)!important; padding:11px 12px) the strip never knew about.
 *  4. The clip hover was "too long and too shiny" — a 5%/400ms zoom plus a flip to brand red.
 */

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

/** the DSL serves {} for content chunks, so a card with film + a fold has to be authored */
const seedFilm = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key;
    const w = window as any;
    w.NG_CONTENT = w.NG_CONTENT || {};
    w.NG_CONTENT.decks = w.NG_CONTENT.decks || {};
    w.NG_CONTENT.decks[key] = {
      def: "Seeded definition.",
      principles: ["P1", "P2"],
      counters: ["C1"],
      clips: [
        { id: "aQ2vFXXBn-o", title: "Countering a full inversion", who: "Gordon Ryan" },
        { id: "bQ2vFXXBn-o", title: "Second clip", who: "Someone" },
      ],
    };
    a._landQ = null;
    a.renderLandCard(a.nodes[a.currentPos], "land", null);
  });

test("the film strip spans exactly the card it sits on, outer AND content box @curated", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await seedFilm(page);
  await page.waitForTimeout(400);

  const geo = await page.evaluate(() => {
    const f = document.querySelector("[data-land-film]") as HTMLElement;
    const c = document.querySelector(".ng-landcard") as HTMLElement;
    const inner = (el: HTMLElement) => {
      const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return [Math.round(b.left + parseFloat(cs.paddingLeft)), Math.round(b.right - parseFloat(cs.paddingRight))];
    };
    const outer = (el: HTMLElement) => {
      const b = el.getBoundingClientRect();
      return [Math.round(b.left), Math.round(b.right)];
    };
    return { filmOuter: outer(f), cardOuter: outer(c), filmInner: inner(f), cardInner: inner(c) };
  });
  // measured before the fix at 390x844: film [16,374] vs card [10,380]
  expect(geo.filmOuter, "same box as the card").toEqual(geo.cardOuter);
  expect(geo.filmInner, "and the thumbnails line up with the text above them").toEqual(geo.cardInner);
});

test("More -> Less leaves the toggle readable, not black @curated", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await seedFilm(page);
  await page.waitForTimeout(300);

  const read = () =>
    page.evaluate(() => {
      const el = document.querySelector("[data-land-more]") as HTMLElement;
      // BOTH: the computed colour is what the user sees, the inline one is what the code wrote.
      // `color` carries a .16s transition, so a computed read taken in the same tick as the write
      // still returns the OLD value — measure after settling, and keep the inline value as the
      // statement of intent.
      return el ? { computed: getComputedStyle(el).color, inline: el.style.color } : null;
    });

  const before = await read();
  expect(before, "the fold must exist (content is authored above)").toBeTruthy();

  await page.evaluate(() => (window as any).__neural.expandLandCard(true));
  await page.waitForTimeout(260);
  const open = await read();

  await page.evaluate(() => (window as any).__neural.expandLandCard(false));
  await page.waitForTimeout(260);
  const after = await read();

  // THE BUG: `style.color = ""` deleted the inline declaration instead of restoring it, so the
  // collapsed button inherited and computed to black.
  expect(after!.inline, "collapsing RESTORES a colour, it does not clear one").not.toBe("");
  expect(after!.computed, "and it is the resting colour again").toBe(before!.computed);
  expect(after!.computed, "certainly not black on a #131625 card").not.toBe("rgb(0, 0, 0)");
  expect(open!.computed, "open is brighter, so the toggle still reads as active").not.toBe(before!.computed);
});

test("the corner pair sits high, tight, and symmetric — and both controls stay hittable", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await seedFilm(page);
  await page.waitForTimeout(300);

  const m = await page.evaluate(() => {
    const c = document.querySelector("[data-land-corner]") as HTMLElement;
    const card = document.querySelector(".ng-landcard") as HTMLElement;
    const add = c.querySelector("[data-list-add]") as HTMLElement;
    const x = c.querySelector("[data-land-close]") as HTMLElement;
    const star = add.querySelector("svg") as unknown as SVGElement;
    const cb = card.getBoundingClientRect(), ab = add.getBoundingClientRect(), xb = x.getBoundingClientRect();
    return {
      rowH: Math.round(c.getBoundingClientRect().height),
      xFromTop: Math.round(xb.top - cb.top),
      xFromRight: Math.round(cb.right - xb.right),
      addGlyphMid: Math.round(ab.top + ab.height / 2 - cb.top),
      xGlyphMid: Math.round(xb.top + xb.height / 2 - cb.top),
      addHit: Math.round(ab.width),
      starW: star ? star.getAttribute("width") : null,
      starBox: star ? Math.round(star.getBoundingClientRect().width) : -1,
    };
  });
  // the row is the ✕'s height, NOT the thumb ★'s — that is what lifts the pair to the inset
  expect(m.rowH, "the 44px thumb target must not set the row height").toBe(24);
  expect(m.xFromTop, "same inset from the top as from the right").toBe(m.xFromRight);
  expect(m.addGlyphMid, "both glyphs on one baseline").toBe(m.xGlyphMid);
  expect(m.addHit, "and the star keeps its 44px thumb target").toBe(44);
  // THE GLYPH IS SIZED BY ITS BOX, NOT BY `font-size` (v1.129.8). Under an SVG `font-size` is
  // inert, and this corner used to be the site that set it — 15px, which after the star would
  // have silently rendered at the 12px default. 14 here: unboxed beside the ✕ (nothing competing,
  // so it reads heavier), and one step under the sheet's 15 because v1.104.2 requires this
  // corner's geometry to come from the 24px ✕ rather than the 44px thumb.
  expect(m.starW, "the corner star is sized deliberately, not left on the boxed default").toBe("14");
  expect(m.starBox, "and it renders at that size, not at the 44px hit area").toBe(14);

  // THE OVERLAP IS DELIBERATE BUT MUST NOT EAT THE ✕: the + renders 44 while laying out at 24, so
  // its box overhangs. The ✕ paints later and should still win — verified, never assumed, because
  // an intercepting sibling is exactly this repo's recurring pointer bug class.
  const hit = await page.evaluate(() => {
    const c = document.querySelector("[data-land-corner]")!;
    const at = (el: HTMLElement) => {
      const b = el.getBoundingClientRect();
      const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return t === el || el.contains(t!) ? "self" : "INTERCEPTED";
    };
    return {
      x: at(c.querySelector("[data-land-close]") as HTMLElement),
      add: at(c.querySelector("[data-list-add]") as HTMLElement),
    };
  });
  expect(hit.x, "the ✕ owns its own centre").toBe("self");
  expect(hit.add, "the star owns its own centre").toBe("self");
});

test("the clip hover is a hint, not a flash", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await seedFilm(page);
  await page.waitForTimeout(300);

  const s = await page.evaluate(() => {
    const card = document.querySelector(".ng-clip") as HTMLElement;
    if (!card) return null;
    const img = card.querySelector("img") as HTMLElement;
    const glyph = card.querySelector(".ngPlay") as HTMLElement;
    const rest = getComputedStyle(glyph).backgroundColor;
    card.dispatchEvent(new MouseEvent("mouseenter"));
    return {
      rest,
      hoverGlyph: glyph.style.background,
      hoverImg: img.style.transform,
      imgTransition: getComputedStyle(img).transitionDuration,
    };
  });
  expect(s, "a clip to hover").toBeTruthy();
  // it used to flip to brand red rgba(224,88,79,.92) — a colour change is the loudest signal a
  // hover can make, and this strip sits directly above the question being read.
  expect(s!.hoverGlyph, "no brand-red flash").not.toContain("224");
  expect(s!.hoverImg, "a 2% zoom, not 5%").toBe("scale(1.02)");
  expect(parseFloat(s!.imgTransition), "and it settles fast").toBeLessThanOrEqual(0.2);
});
