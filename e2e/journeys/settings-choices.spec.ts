import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * SETTINGS' THREE-CHOICE ROWS (v1.298.2).
 *
 * SETH2 B (the owner, 23 Nov 2026: "isnt 'Questions while you roll …' a bit duplicate of 'Question card: Off = no card and no
 * question. (Turning questions off above keeps the card.)'? or are they diff things?"). They were two ticks over two keys,
 * `landQuestions` (does a landing ask) and the `card` layer (`landCard`, is the card on screen at all), whose copy had to explain the
 * difference. Now ONE row, "During a roll, each place shows": A question (landQuestions on, the card on) · The card only
 * (landQuestions off, the card on) · No card (the card off, landQuestions LEFT AS IT IS, so the card coming back returns to the
 * player's own choice). No key is added or removed (CLAUDE.md §6.6); the row writes through the setters the two rows used.
 *
 * THE CLAIMS, pressed as a player does (a real mouse at 1074x796, a touch tap at 390x631, each at a measured point the control owns,
 * after a real wheel brings it into the panel):
 *  1. each choice sets exactly the two values above, and writes no other setting; a pick that leaves `landQuestions` where it is
 *     does not write it; the row says which choice it shows (`data-settings-shows`) after every press;
 *  2. from No card, the card's own Undo on the board brings back the choice before it (The card only, with its question key still
 *     off), and the row follows a change made on the board both ways (the ✕ shows No card; the Undo shows The card only).
 *
 * MUTANTS (tests/artifacts/settings_layout_mutants.mjs, the `spec` field names this file): one per mapping, after a green control.
 * NOT covered here: what a landing then shows for each state (the card, its question, the defence drill), which is the two keys'
 * own behaviour, pinned where it always was (land-layers.spec.ts for the card layer, returner-landq-off-freezes-meter.spec.ts and
 * landing-priority.spec.ts for `landQuestions`). The harness serves `{}` for dossiers: nothing here reads a film.
 */

const SHOWS = "[data-settings-shows]";
const pick = (v: string) => `[data-shows-pick="${v}"]`;
const PANEL = '[role="tabpanel"]';

/** The two stored values as the app reads them, the row's published choice, and every settings key's write stamp. */
const state = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    return {
      q: a.get("landQuestions", true) as boolean,
      card: a.get("landCard", true) as boolean,
      shows: document.querySelector("[data-settings-shows]")?.getAttribute("data-settings-shows") ?? null,
      stamps: { ...(a._settingsAt || {}) } as Record<string, number>,
    };
  });

/** Bring a control wholly into the Settings panel by a real wheel over the panel, and wait until it holds still. */
async function intoPanel(page: Page, j: ReturnType<typeof journey>, sel: string) {
  for (let i = 0; i < 30; i++) {
    await j.scrollSettled(sel);
    const r = await page.locator(sel).boundingBox(),
      p = (await page.locator(PANEL).boundingBox())!;
    if (r && r.y >= p.y && r.y + r.height <= p.y + p.height) return;
    await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
    await page.mouse.wheel(0, r && r.y < p.y ? -160 : 160);
  }
  throw Error(`${sel} never came wholly into the Settings panel`);
}

/** Press as a player does: a real mouse (clickByMouse refuses a point the control does not own), or a touch tap at the measured
 *  centre, which must be the control's own. */
async function press(page: Page, j: ReturnType<typeof journey>, sel: string, touch: boolean, what: string) {
  await intoPanel(page, j, sel);
  if (!touch) return j.clickByMouse(sel, what);
  const b = (await page.locator(sel).boundingBox())!;
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  const own = await page.evaluate(
    ([px, py, s]) => {
      const e = document.elementFromPoint(px as number, py as number),
        t = document.querySelector(s as string);
      return !!e && !!t && (e === t || t.contains(e));
    },
    [x, y, sel] as [number, number, string],
  );
  expect(own, `${what}: the control owns its centre (${x.toFixed(0)}, ${y.toFixed(0)})`).toBe(true);
  await page.touchscreen.tap(x, y);
}

const openRolling = async (page: Page, j: ReturnType<typeof journey>) => {
  await page.evaluate(() => (window as any).__neural.openSettings("rolling"));
  await expect(page.locator(SHOWS), "the row is drawn").toHaveCount(1);
  await j.settingsAtRest();
};

for (const [w, h, touch] of [
  [1074, 796, false],
  [390, 631, true],
] as [number, number, boolean][])
  test.describe(`${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });

    test(`at ${w}x${h}: each place shows: every choice sets exactly its two values, by ${touch ? "a touch tap" : "a real mouse"}`, async ({ page }) => {
      const j = journey(page);
      await j.boot("/");
      await openRolling(page, j);
      let s = await state(page);
      expect([s.q, s.card, s.shows], "nothing stored: A question, the card on").toEqual([true, true, "question"]);
      expect("landQuestions" in s.stamps || "landCard" in s.stamps, "premise: neither key was ever written").toBe(false);
      await expect(page.locator(`${SHOWS} [data-shows-pick]`), "three choices, in order").toHaveText(["A question", "The card only", "No card"]);
      await expect(page.locator(".ng-modal"), "the two old rows are gone").not.toContainText(/Questions while you roll|Question card/);
      // [choice, landQuestions after, card after], walked so that every choice is reached from both other states
      const WALK: [string, boolean, boolean][] = [
        ["question", true, true], // from nothing stored: no write at all (both already so)
        ["card", false, true],
        ["none", false, false],
        ["question", true, true],
        ["none", true, false],
        ["card", false, true],
        ["question", true, true],
      ];
      for (const [v, q, card] of WALK) {
        const before = await state(page);
        await press(page, j, pick(v), touch, `"${v}"`);
        await expect.poll(async () => (await state(page)).shows, { message: `pressed ${v}: the row shows it` }).toBe(v);
        const after = await state(page);
        expect([after.q, after.card], `pressed ${v}: landQuestions and the card`).toEqual([q, card]);
        const written = Object.keys(after.stamps).filter((k) => after.stamps[k] !== before.stamps[k]);
        expect(written.filter((k) => k !== "landQuestions" && k !== "landCard"), `pressed ${v}: no other setting is written`).toEqual([]);
        if (before.q === q) expect(written.includes("landQuestions"), `pressed ${v}: landQuestions unchanged, so not written`).toBe(false);
      }
    });
  });

test("from No card, the card's own Undo on the board brings back the choice before it, and the row follows the board both ways", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openRolling(page, j);
  await press(page, j, pick("card"), false, "The card only");
  await expect.poll(async () => (await state(page)).shows).toBe("card");
  await page.keyboard.press("Escape");
  // the board: the live card's own ✕, by a real mouse, once the reader holds still (CLAUDE.md §6.3)
  await j.readerLayoutSettled();
  await j.clickByMouse("[data-land-close]", "the card's ✕");
  await expect.poll(() => page.evaluate(() => (window as any).__neural.get("landCard", true)), { message: "the ✕ put the card away" }).toBe(false);
  await openRolling(page, j);
  let s = await state(page);
  expect([s.shows, s.q], "the row follows the board: No card, the question key left off").toEqual(["none", false]);
  await page.keyboard.press("Escape");
  // its Undo (while the message stands) or, where the article's index shows, the closed row: the board's own ways back
  await j.readerLayoutSettled();
  const undo = '[data-hidesec-notice="card"] [data-hidesec-undo]';
  if (await page.locator(undo).isVisible()) await j.clickByMouse(undo, "the closed card's Undo");
  else await j.clickByMouse('[data-toc-type="card"] a', "the closed card's index row");
  await expect.poll(() => page.evaluate(() => (window as any).__neural.get("landCard", true)), { message: "the board brought the card back" }).toBe(true);
  await openRolling(page, j);
  s = await state(page);
  expect([s.shows, s.q, s.card], "the choice before it: The card only, its question key still off").toEqual(["card", false, true]);
});
