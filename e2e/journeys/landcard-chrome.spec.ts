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

// The former film/card alignment assertion is superseded by the approved A layout.
// reading-media-placement.spec.ts pins both measured normal-home geometries.

// RETIRED in part (D-338, no View menu): the article view has no Book minimize. Book off survives
// only as a saved state, whose shelf keeps the restore control; that half keeps its claim.
// v1.253.0 (U114 a): "Book restore keeps a readable, reachable control" went with the shelf and the article-away view.

test("the question corner keeps its close button and count; capture belongs to the seat", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  // v1.280.0 (POSNAME): the position's own name, and the seat star beside its role, are never written under a control. The
  // landing can mint White Foundations, whose opaque phone card (rgba 18,22,37 at 0.98) covers the node band here: the
  // star used to be drawn under it, unseen; dismissed first, as article-sections.spec.ts dismisses it
  if (await page.locator("[data-reward-close]").isVisible()) await j.clickByMouse("[data-reward-close]");
  await seedFilm(page);
  await page.waitForTimeout(300);
  await j.openQuestion(); // U47 d: the deck count shows on the card, once the question is taken up
  // D-338: Questions follows Videos and Moves and can start below the fold; scroll to it first.
  await page.locator(".ng-landcard").evaluate(e => e.scrollIntoView({ block: "nearest" }));
  await j.readerLayoutSettled();
  const m = await page.evaluate(() => {
    const card = document.querySelector(".ng-landcard") as HTMLElement;
    const x = card.querySelector("[data-land-close]") as HTMLElement;
    const cnt = card.querySelector("[data-land-count]") as HTMLElement | null;
    const cb = card.getBoundingClientRect(), xb = x.getBoundingClientRect();
    const hit = document.elementFromPoint(xb.x + xb.width / 2, xb.y + xb.height / 2);
    return {
      rowH: Math.round(x.parentElement!.getBoundingClientRect().height),
      top: Math.round(xb.top - cb.top), right: Math.round(cb.right - xb.right),
      countBelow: cnt ? cnt.getBoundingClientRect().top >= xb.bottom : true,
      hit: hit === x || x.contains(hit), stars: card.querySelectorAll("[data-list-add]").length,
    };
  });
  expect(m.rowH).toBe(24);
  expect(m.top).toBe(m.right);
  expect(m.countBelow).toBe(true);
  expect(m.hit).toBe(true);
  expect(m.stars).toBe(0);
  // v1.280.0 (POSNAME): the seat's name, and its star, are placed frame by frame and never under a control; the frame this
  // test last pumped was drawn while the reader still scrolled the card over the node band (probed: nothing covers it now,
  // and one fresh frame places the name and its star). A player's app draws every frame; the harness draws when pumped
  await j.advance(34);
  await expect(page.locator('[data-seat-star][data-list-add="Positions/Mount"]')).toHaveCount(1);
  await expect(page.locator('[data-seat-star][data-list-add="Positions/Mount"]')).toBeVisible();
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
