import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * SETTINGS IS ONE PAGE OF GROUPS, WITH ITS GROUP LIST ALWAYS IN VIEW, IN A FRAME THAT BREATHES (SET1, v1.295.3).
 *
 * The owner, 23 Nov 2026: "in settings, why is article settings inside rolling? one can just have landed in an article and
 * not be rolling, please improve the org of settings, and also the UX and filling and distance to the browser edge max width
 * ofc but currently it's too thin and doesnt allow breathing very much". Measured before (v1.295.0, the preview): a 440 px card
 * at every desktop width (317 px of empty screen each side at his 1074 window); the Rolling tab 3,048 px tall in a 509-560 px
 * window, 1,415 px of it the article sections; 23 controls under 44 px; and at 390x631 the card ran 18 px off the top and the
 * bottom of the screen. Ruled SET1-GO: one page, groups by what a setting is about (Practice, Rolling, Articles, General, Your
 * odds, Email, Keyboard), at most 760 px wide, 48 px from the browser's edges at 900 px and up, 32 px below that, a full-screen
 * sheet under 600 px, and every control 40 px (44 on a phone).
 *
 * THE CLAIMS, each read from the rendered DOM (rects, the published `data-fade`, aria), never recomputed from the CSS (§6.3):
 *  1. the frame at the owner's four sizes (1440x900, 1074x796 his window, 800x900, 390x631 by touch);
 *  2. the group list is always in view: a rail beside the panel on a wide screen, every group wholly inside it with no scroll;
 *     a row of chips above the panel on a phone, whose fade is honest (published exactly on the side that hides a chip);
 *  3. every control in the card is at least 40x40 (44x44 on a phone), the article rows included (their whole row is the target);
 *  4. help lines are at most 76 characters long on a wide screen (every line of prose is held to 60ch); 5. the owner's note is first, word for word, and on a phone
 *     it is in the panel (it scrolls with the page), not the head;
 *  6. a press on a group, by a real mouse and by a touch tap, brings that group's heading to the panel's top and lights it;
 *     scrolling lights the group in view; an old id still opens on its own group; a redraw keeps the panel where it was;
 *  7. the keys: arrows, Home and End walk and wrap the groups, nothing leaks to the game, Esc closes; and a resize re-derives
 *     the list (a rail at 1440, a row of chips at 390, a rail again).
 *
 * Every opening seats an account with the training-day email stored on, so the longest list (seven groups) is the one measured;
 * which groups each player sees is notifications-tab.spec.ts's claim.
 *
 * NOT covered: a modifier's own row (its dot, − / +, delete): it exists only after one is added in this visit, and is not lifted
 * to the target (modifiers are not saved; the orchestrator's finding). The search's clear button exists only while typing. That the
 * grain and the fade look right (a pixel check of a mask is theatre here). Real touch-drag scrolling (Playwright has no touch-move,
 * so the phone scrolls with a wheel, which is also real input). Back closing only the phone sheet: NOT in this PR (SET1-PUSH 1,
 * noted for a follow-up). The sheet closes by its close button and Esc; Back steps the page history, as it did before SET1.
 *
 * MUTANTS (tests/artifacts/settings_layout_mutants.mjs) name the test each kills.
 */

const SIZES: [number, number, boolean][] = [
  [1440, 900, false],
  [1074, 796, false],
  [800, 900, false],
  [390, 631, true],
];
const NOTE =
  "BJJ Graph is still being actively built — the success rates and probabilities you see are being continuously fine-tuned and will keep improving.";

const openSettings = (page: Page, tab?: string) =>
  page.evaluate((t) => {
    const a = (window as any).__neural;
    a.user = a.user || { name: "Player", initial: "P", email: "player@example.com" };
    a.settings.emailDigest = true;
    return a.openSettings(t);
  }, tab);

type Box = { l: number; r: number; t: number; b: number };
type Geo = {
  vw: number;
  vh: number;
  card: Box;
  list: Box & { scrollW: number; clientW: number; scrollH: number; clientH: number; overflowX: string; fade: string; mask: string };
  panel: Box & { scrollTop: number; scrollH: number; clientH: number; label: string };
  tabs: { id: string; label: string; selected: boolean; tabindex: string; btn: Box }[];
  groups: { id: string; top: number }[];
  controls: { what: string; w: number; h: number }[];
  helps: { text: string; cpl: number }[];
  notes: { inHead: boolean; shown: boolean; text: string }[];
};

const geo = (page: Page): Promise<Geo> =>
  page.evaluate(() => {
    const card = (window as any).__neural.modalCardRef.current as HTMLElement;
    const lists = card.querySelectorAll('[role="tablist"]');
    if (lists.length !== 1) throw new Error(`expected exactly ONE group list in the modal, found ${lists.length}`);
    const panels = card.querySelectorAll('[role="tabpanel"]');
    if (panels.length !== 1) throw new Error(`expected exactly ONE panel, found ${panels.length}`);
    const list = lists[0] as HTMLElement,
      panel = panels[0] as HTMLElement;
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { l: r.left, r: r.right, t: r.top, b: r.bottom };
    };
    const ls = getComputedStyle(list);
    const shown = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
    };
    const pr = box(panel);
    const controls = (Array.from(card.querySelectorAll('button, input, select, textarea, label, [role="tab"]')) as HTMLElement[])
      .filter(shown)
      // a box inside a label is pressed through its label: the LABEL is the target, and it is measured
      .filter((e) => !(e.tagName === "INPUT" && e.closest("label")))
      .map((e) => {
        const r = e.getBoundingClientRect();
        const name = (e.getAttribute("aria-label") || e.textContent || (e as HTMLInputElement).type || "").trim().slice(0, 32);
        return { what: `<${e.tagName.toLowerCase()}> ${name}`, w: r.width, h: r.height };
      });
    const helps = (Array.from(card.querySelectorAll(".ng-set-h, .ng-set-grp > p, .ng-set-note")) as HTMLElement[]).filter(shown).map((e) => {
      const lh = parseFloat(getComputedStyle(e).lineHeight);
      const lines = Math.max(1, Math.round(e.getBoundingClientRect().height / lh));
      const text = (e.textContent || "").trim();
      return { text: text.slice(0, 40), cpl: text.length / lines };
    });
    return {
      vw: innerWidth,
      vh: innerHeight,
      card: box(card),
      list: {
        ...box(list),
        scrollW: list.scrollWidth,
        clientW: list.clientWidth,
        scrollH: list.scrollHeight,
        clientH: list.clientHeight,
        overflowX: ls.overflowX,
        fade: list.getAttribute("data-fade") || "",
        mask: (ls as any).maskImage || (ls as any).webkitMaskImage || "none",
      },
      panel: { ...pr, scrollTop: panel.scrollTop, scrollH: panel.scrollHeight, clientH: panel.clientHeight, label: panel.getAttribute("aria-labelledby") || "" },
      tabs: (Array.from(list.querySelectorAll('[role="tab"]')) as HTMLElement[]).map((t) => ({
        id: t.getAttribute("data-settings-tab") || "",
        label: (t.textContent || "").trim(),
        selected: t.getAttribute("aria-selected") === "true",
        tabindex: t.getAttribute("tabindex") || "",
        btn: box(t),
      })),
      groups: (Array.from(panel.querySelectorAll("[data-settings-group]")) as HTMLElement[]).map((g) => ({
        id: g.getAttribute("data-settings-group") || "",
        top: g.getBoundingClientRect().top - pr.t,
      })),
      controls,
      helps,
      notes: (Array.from(card.querySelectorAll(".ng-set-note")) as HTMLElement[]).map((n) => ({
        inHead: !panel.contains(n),
        shown: shown(n),
        text: n.textContent || "",
      })),
    };
  });

const EPS = 0.5;
const insideX = (a: Box, b: Box) => a.l >= b.l - EPS && a.r <= b.r + EPS;
const insideY = (a: Box, b: Box) => a.t >= b.t - EPS && a.b <= b.b + EPS;
const fmt = (b: Box) => `[${b.l.toFixed(1)}..${b.r.toFixed(1)} x ${b.t.toFixed(1)}..${b.b.toFixed(1)}]`;
const isRail = (g: Geo) => g.vw >= 600;

/** The list's own invariant at any width: always in view, honest about what it hides, roving tabindex. */
function assertList(g: Geo, where: string) {
  expect(g.tabs.length, `${where}: a non-trivial group count (a spec that finds none passes everything)`).toBeGreaterThanOrEqual(6);
  expect(insideX(g.list, g.card) && insideY(g.list, g.card), `${where}: the list ${fmt(g.list)} is inside the card ${fmt(g.card)}`).toBe(true);
  if (isRail(g)) {
    // A RAIL: beside the panel, every group wholly in it, nothing to scroll.
    expect(g.list.r, `${where}: the rail sits left of the panel`).toBeLessThanOrEqual(g.panel.l + EPS);
    expect(g.list.scrollH, `${where}: every group fits the rail, no scroll`).toBeLessThanOrEqual(g.list.clientH);
    for (const t of g.tabs) expect(insideX(t.btn, g.list) && insideY(t.btn, g.list), `${where}: "${t.label}" ${fmt(t.btn)} wholly in the rail`).toBe(true);
    expect(g.list.fade, `${where}: nothing hidden, no fade`).toBe("");
  } else {
    // A ROW OF CHIPS above the panel, which may hide chips at its sides, and says which.
    expect(g.list.b, `${where}: the chips sit above the panel`).toBeLessThanOrEqual(g.panel.t + EPS);
    const hiddenL = g.tabs.some((t) => t.btn.l < g.list.l - EPS),
      hiddenR = g.tabs.some((t) => t.btn.r > g.list.r + EPS);
    if (hiddenL || hiddenR) {
      expect(["auto", "scroll"], `${where}: chips overhang the row, so it must scroll`).toContain(g.list.overflowX);
      expect(g.list.mask, `${where}: a published fade is APPLIED`).not.toBe("none");
    }
    const fade = g.list.fade.split(/\s+/).filter(Boolean);
    expect(fade.includes("l"), `${where}: a left fade exactly when a chip is hidden on the left ("${g.list.fade}")`).toBe(hiddenL);
    expect(fade.includes("r"), `${where}: a right fade exactly when a chip is hidden on the right ("${g.list.fade}")`).toBe(hiddenR);
  }
  const on = g.tabs.filter((t) => t.selected);
  expect(on.length, `${where}: exactly one group is lit`).toBe(1);
  expect(insideX(on[0].btn, g.list), `${where}: the lit group "${on[0].label}" ${fmt(on[0].btn)} is in view`).toBe(true);
  expect(g.panel.label, `${where}: the panel is labelled by the lit group`).toBe("ng-stab-" + on[0].id);
  expect(g.tabs.map((t) => t.tabindex), `${where}: roving tabindex, 0 only on the lit group`).toEqual(g.tabs.map((t) => (t.selected ? "0" : "-1")));
}

/** The group's heading is at the panel's top (or the panel cannot scroll further), and it is the lit one. */
function assertAt(g: Geo, id: string, where: string) {
  const grp = g.groups.find((x) => x.id === id)!;
  expect(grp, `${where}: the ${id} group is drawn`).toBeTruthy();
  const bottom = g.panel.scrollTop >= g.panel.scrollH - g.panel.clientH - 1;
  expect(grp.top >= -EPS && (grp.top <= 24 || bottom), `${where}: the ${id} heading is at the panel's top (it is ${grp.top.toFixed(1)} px down, scrollTop ${g.panel.scrollTop})`).toBe(true);
  expect(grp.top, `${where}: and inside the panel's window`).toBeLessThan(g.panel.clientH);
  expect(g.tabs.find((t) => t.selected)?.id, `${where}: ${id} is lit`).toBe(id);
}

/** THE CARD AT REST: its entrance has finished, and the panel and the chip row have stopped moving (a smooth glide), their
 *  scroll events delivered. SET1-RED (PR #451's first CI run): this waited for the scroll alone, so on CI the frame was read
 *  while the card's entrance (ngCardIn, 0.28 s, an 8 px slide) was still moving it: 30.68 px from the bottom at 800x900 and
 *  [0, 1, 390, 632] at 390x631. Seeking that animation to 150 ms reproduces both to the hundredth (30.69, [0, 1, 390, 632]);
 *  finished, the card rests at exactly 32 and [0, 0, 390, 631]. The tolerance is unchanged: the frame is read where it rests. */
const settled = async (page: Page) => {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<boolean>((res) => {
              const card = (window as any).__neural.modalCardRef.current as HTMLElement;
              const list = card.querySelector('[role="tablist"]') as HTMLElement,
                panel = card.querySelector('[role="tabpanel"]') as HTMLElement;
              const moving = () => card.getAnimations().some((a) => a.playState !== "finished");
              const at = () => list.scrollLeft + "," + panel.scrollTop;
              const t0 = performance.now();
              let x = at(),
                since = t0;
              const tick = () => {
                const now = performance.now();
                if (moving()) since = now;
                if (at() !== x) {
                  x = at();
                  since = now;
                }
                if (now - since >= 150) return res(true);
                if (now - t0 > 3000) return res(false);
                requestAnimationFrame(tick);
              };
              requestAnimationFrame(tick);
            }),
        ),
      { intervals: [50, 100, 250] },
    )
    .toBe(true);
};

for (const [w, h, touch] of SIZES) {
  test.describe(`${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h }, hasTouch: touch });

    test(`at ${w}x${h}: the frame, the group list in view, every control at the target, help lines that read, the note first`, async ({ page }) => {
      const j = journey(page);
      await j.boot("/");
      await openSettings(page, "flashcards");
      await settled(page);
      const g = await geo(page);
      const where = `${w}x${h}`;
      // 1. THE FRAME (SET1-GO): at most 760 px, 48 px from the browser's edges at 900 px and up, 32 px below, a full sheet under 600.
      if (w < 600) {
        expect([g.card.l, g.card.t, g.card.r, g.card.b].map(Math.round), `${where}: the full-screen sheet`).toEqual([0, 0, w, h]);
      } else {
        const edge = w >= 900 ? 48 : 32;
        const want = Math.min(760, w - 2 * edge);
        expect(Math.abs(g.card.r - g.card.l - want), `${where}: the card is ${want} px wide (it is ${(g.card.r - g.card.l).toFixed(1)})`).toBeLessThanOrEqual(1);
        expect(Math.abs(g.card.l - (w - g.card.r)), `${where}: centred, ${g.card.l.toFixed(1)} and ${(w - g.card.r).toFixed(1)} px from the sides`).toBeLessThanOrEqual(1);
        expect(g.card.l, `${where}: at least ${edge} px from the side`).toBeGreaterThanOrEqual(edge - 1);
        expect(g.card.t, `${where}: at least ${edge} px from the top`).toBeGreaterThanOrEqual(edge - 1);
        expect(h - g.card.b, `${where}: at least ${edge} px from the bottom`).toBeGreaterThanOrEqual(edge - 1);
      }
      // 2. the list
      assertList(g, where);
      expect(isRail(g) ? g.list.b - g.list.t : g.list.r - g.list.l, `${where}: the list runs the panel's height (a rail) or the card's width (chips)`).toBeGreaterThan(isRail(g) ? 200 : w - 2);
      expect(g.groups.map((x) => x.id), `${where}: every group is on the one page, in the list's order`).toEqual(g.tabs.map((t) => t.id));
      // 3. every control at the target
      const min = touch ? 44 : 40;
      expect(g.controls.length, `${where}: a non-trivial control count`).toBeGreaterThan(40);
      const small = g.controls.filter((c) => c.w < min - EPS || c.h < min - EPS).map((c) => `${c.what} ${c.w.toFixed(0)}x${c.h.toFixed(0)}`);
      expect(small, `${where}: every control is at least ${min}x${min}`).toEqual([]);
      // 4. help lines that read (a wide screen; a phone's lines are as long as the phone)
      if (!touch) {
        expect(g.helps.length, `${where}: help lines measured`).toBeGreaterThan(10);
        const long = g.helps.filter((x) => x.cpl > 76).map((x) => `${x.text}… ${x.cpl.toFixed(0)}`);
        expect(long, `${where}: no help line runs past 76 characters`).toEqual([]);
      }
      // 5. the owner's note, word for word, first; on a phone in the panel, where it scrolls with the settings
      const shown = g.notes.filter((n) => n.shown);
      expect(shown.length, `${where}: one copy of the note is shown`).toBe(1);
      expect(shown[0].text, `${where}: word for word`).toBe(NOTE);
      expect(shown[0].inHead, `${where}: in the head on a wide screen, in the panel on a phone`).toBe(!touch);
      expect(await page.evaluate(() => /⚠/.test((window as any).__neural.modalCardRef.current.textContent)), `${where}: no emoji`).toBe(false);
    });

    test(`at ${w}x${h}: a press on each group, by ${touch ? "a touch tap" : "a real mouse"}, brings it to the top and lights it`, async ({ page }) => {
      const j = journey(page);
      await j.boot("/");
      await openSettings(page, "flashcards");
      await settled(page);
      const ids = (await geo(page)).tabs.map((t) => t.id);
      for (const id of [...ids.slice(1).reverse(), ids[0], "reading"]) {
        let g = await geo(page);
        if (touch) {
          // the chip may be off the row: a real horizontal wheel over the row brings it in first
          let t = g.tabs.find((x) => x.id === id)!;
          if (!insideX(t.btn, g.list)) {
            await page.mouse.move((g.list.l + g.list.r) / 2, (g.list.t + g.list.b) / 2);
            await page.mouse.wheel(t.btn.l < g.list.l ? -800 : 800, 0);
            await settled(page);
            g = await geo(page);
            t = g.tabs.find((x) => x.id === id)!;
          }
          expect(insideX(t.btn, g.list), `${id}'s chip is in view to tap`).toBe(true);
          const x = (t.btn.l + t.btn.r) / 2,
            y = (t.btn.t + t.btn.b) / 2;
          const own = await page.evaluate(([px, py, tid]) => {
            const el = document.elementFromPoint(px, py);
            const tab = document.querySelector(`[data-settings-tab="${tid}"]`)!;
            return !!el && (el === tab || tab.contains(el));
          }, [x, y, id] as [number, number, string]);
          expect(own, `the chip owns its centre (${x.toFixed(0)}, ${y.toFixed(0)})`).toBe(true);
          await page.touchscreen.tap(x, y);
        } else {
          await j.clickByMouse(`[data-settings-tab="${id}"]`, `the ${id} group`);
        }
        await settled(page);
        const after = await geo(page);
        assertAt(after, id, `pressed ${id}`);
        assertList(after, `after pressing ${id}`);
        expect(await page.evaluate(() => (window as any).__neural._settingsTab), `${id} is what a redraw keeps`).toBe(id);
      }
    });
  });
}

test("scrolling lights the group in view; an old id opens on its own group; a redraw keeps the panel where it was", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await openSettings(page, "flashcards");
  await settled(page);
  let g = await geo(page);
  assertAt(g, "flashcards", "opened");
  // a real wheel over the panel, until the Articles heading has passed a third of the way up: Articles is lit
  const art = g.groups.find((x) => x.id === "reading")!.top;
  await page.mouse.move((g.panel.l + g.panel.r) / 2, (g.panel.t + g.panel.b) / 2);
  await page.mouse.wheel(0, art - 40);
  await settled(page);
  g = await geo(page);
  expect(g.tabs.find((t) => t.selected)?.id, `scrolled to Articles (its heading ${g.groups.find((x) => x.id === "reading")!.top.toFixed(0)} px down)`).toBe("reading");
  // to the very bottom: the last group is lit, short as it is
  await page.mouse.wheel(0, 20000);
  await settled(page);
  g = await geo(page);
  expect(g.tabs.find((t) => t.selected)?.id, "at the bottom, the last group").toBe(g.tabs[g.tabs.length - 1].id);
  // EVERY OLD ID STILL OPENS ON ITS GROUP (the badge menu, the reader's notice, a saved tab), and so do the two new ones
  for (const id of ["rolling", "modifiers", "notifications", "shortcuts", "reading", "app", "flashcards"]) {
    await page.evaluate(() => (window as any).__neural.closeModal());
    await openSettings(page, id);
    await settled(page);
    const o = await geo(page);
    assertAt(o, id, `openSettings("${id}")`);
    assertList(o, `opened at ${id}`);
  }
  // A REDRAW KEEPS THE PANEL WHERE IT WAS: a switch deep in the page, pressed by mouse, stays under the pointer.
  await page.evaluate(() => (window as any).__neural.closeModal());
  await openSettings(page, "rolling");
  await settled(page);
  await page.evaluate(() => document.querySelector("[data-danger-animation]")!.scrollIntoView({ block: "center" }));
  await settled(page);
  const sel = "[data-danger-animation] button:nth-of-type(2)";
  const before = await page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { y: r.top, top: (document.querySelector('[role="tabpanel"]') as HTMLElement).scrollTop };
  }, sel);
  await j.clickByMouse(sel, "Danger animation: Off");
  expect(await page.evaluate(() => (window as any).__neural.get("dangerAnimation", true))).toBe(false);
  const after = await page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { y: r.top, top: (document.querySelector('[role="tabpanel"]') as HTMLElement).scrollTop };
  }, sel);
  expect(after.top, "the redraw kept the panel's scroll").toBe(before.top);
  expect(Math.abs(after.y - before.y), "and the switch under the pointer").toBeLessThanOrEqual(1);
});

test("a resize with Settings open re-derives the list: a rail at 1440, chips with an honest fade at 390, a rail again", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await openSettings(page, "flashcards");
  await settled(page);
  assertList(await geo(page), "1440");
  await page.setViewportSize({ width: 390, height: 844 });
  await settled(page);
  const g = await geo(page);
  assertList(g, "narrowed from 1440 to 390 with Settings open");
  expect(g.list.fade, "narrowed: the row hides chips on the right, and says so").toBe("r");
  await page.setViewportSize({ width: 1440, height: 900 });
  await settled(page);
  assertList(await geo(page), "widened again");
});

test("keyboard: the list keeps its keys — arrows, Home and End move and wrap, nothing leaks to the game, Esc closes", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await page.evaluate(() => {
    (window as any).__leaked = [];
    window.addEventListener("keydown", (e) => {
      if (/^(Arrow|Home|End)/.test(e.key)) (window as any).__leaked.push(e.key);
    });
  });
  await openSettings(page, "flashcards");
  const ids = (await geo(page)).tabs.map((t) => t.id);
  const focused = () =>
    page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      return a && a.getAttribute("role") === "tab" ? a.getAttribute("data-settings-tab") : `not a group: ${a && a.tagName}`;
    });
  const state = async () => ({ tab: await page.evaluate(() => (window as any).__neural._settingsTab), focus: await focused() });

  expect(await focused(), "opening Settings puts focus on the lit group, so the keys work at once").toBe("flashcards");
  await page.keyboard.press("ArrowRight");
  expect(await state()).toEqual({ tab: ids[1], focus: ids[1] });
  await page.keyboard.press("ArrowDown");
  expect(await state(), "ArrowDown walks the rail too").toEqual({ tab: ids[2], focus: ids[2] });
  await page.keyboard.press("End");
  expect(await state()).toEqual({ tab: "shortcuts", focus: "shortcuts" });
  await page.keyboard.press("ArrowRight");
  expect(await state(), "ArrowRight on the last group wraps to the first").toEqual({ tab: ids[0], focus: ids[0] });
  await page.keyboard.press("ArrowLeft");
  expect(await state(), "ArrowLeft on the first group wraps to the last").toEqual({ tab: ids[ids.length - 1], focus: ids[ids.length - 1] });
  await page.keyboard.press("Home");
  expect(await state()).toEqual({ tab: ids[0], focus: ids[0] });
  await settled(page);
  assertList(await geo(page), "1440px after keyboard travel");
  expect(await page.evaluate(() => (window as any).__leaked), "no list key reached the game's key handler").toEqual([]);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => (window as any).__neural.modalRef.current.style.display), "Esc still closes the modal").toBe("none");
});

test("another dialog opened after Settings is drawn in its own frame, not the Settings one", async ({ page }) => {
  // The modal card is shared by every dialog. Settings marks it (`data-settings-card`) and its stylesheet sizes it; `openModal`
  // takes the mark off for every other dialog, which then keeps the inline width it writes (Feedback: min(440px, 92vw)).
  const j = journey(page);
  await j.boot("/");
  await openSettings(page, "flashcards");
  await settled(page);
  const frame = () =>
    page.evaluate(() => {
      const c = (window as any).__neural.modalCardRef.current as HTMLElement;
      return { marked: c.hasAttribute("data-settings-card"), w: c.getBoundingClientRect().width };
    });
  expect(await frame(), "premise: Settings is drawn in its own frame").toEqual({ marked: true, w: 760 });
  await page.evaluate(() => (window as any).__neural.openFeedback());
  await expect(page.locator("[data-feedback-title]")).toBeVisible();
  expect(await frame(), "Feedback, opened next, is its own 440 px").toEqual({ marked: false, w: 440 });
});
