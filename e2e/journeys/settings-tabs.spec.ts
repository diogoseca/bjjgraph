import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE SETTINGS TAB ROW FITS THE PANEL, AT EVERY WIDTH AND ANY TAB COUNT.
 *
 * Owner, 2026-09-23, with a desktop screenshot: "settings doesnt have room for all tabs … and
 * this is in desktop, not working right. i wonder if this will also work right on phone or
 * tablet after we fix it on desktop tho." The row was five hand-built <span>s with no overflow
 * behaviour at all. Measured before the fix: on the 440px card (every width >= 478px) "Shortcuts"
 * ran 22.5px past the panel's content box and 0.5px past the card's own edge, which clips it.
 * At 390 it sat 81.7px outside the card, invisible even when it WAS the active tab, which is what
 * the account menu's "Keyboard shortcuts" row opens.
 *
 * The row is now the More fold's contents-row idiom ("tabs in a single row, with horizontal
 * scrolling", owner), made a real tablist: one declared list (NG_SETTINGS_TABS), one click
 * handler, arrow/Home/End keys, 44px hit boxes, and an edge fade published as `data-fade` on
 * exactly the side where a tab is hidden. Seam: `renderSettings` / `_settingsTabRow` in
 * neural/src/app.src.jsx; styles `.ng-stabs` / `.ng-stab` in neural/src/helmet.html.
 *
 * TWO BOXES PER TAB, BECAUSE THE CLAIM HAS TWO HALVES:
 *  - the LABEL (the <span>: text plus underline) is what the eye reads. It must sit inside the
 *    panel's CONTENT box, the column that the title and the close control align to.
 *  - the BUTTON is the hit box. It pads past the label (by 7px each side and 16px up), so the
 *    first and last buttons deliberately reach into the head's padding. That is the
 *    `.ng-lists-new` trade. The button must stay inside the card's PADDING box, which is
 *    the region the card's `overflow:hidden` does not clip. Asserting the button against the
 *    content box would be stricter than the claim and red on a correct build (§6.3).
 *
 * Every number here is read from the rendered DOM (rects, computed style, the published
 * `data-fade`), never recomputed from the CSS (§6.3).
 *
 * TRIPWIRE, NOT A BUG: "all five fit at >= 768" is pinned against the SHIPPED list. A sixth tab
 * makes that one assertion red, and the row itself does not break (it scrolls, with a fade, as
 * the 390 case and the injected-tabs test prove). The red is there so that somebody looks at the
 * desktop row on purpose. The decision it asks for is whether a desktop user should scroll, not
 * how to repair the layout.
 *
 * NON-KILL, recorded so nobody reads it as coverage: the inline `pointer-events:auto` on each tab
 * survives deletion. The modal is portaled OUT of the wrap (`__ngRoot`), so `attachInput`'s
 * pointer capture never sees it, and no ancestor sets `pointer-events:none`. It is there for the
 * day either of those changes. The clickByMouse journeys below are what would catch that day.
 *
 * NOT covered: that the fade is legible (a pixel-level check of a mask is theatre here; the spec
 * asserts that the mask is APPLIED and HONEST, not that it is pretty); the smooth glide itself
 * (only where it comes to rest); real touch-drag scrolling (Playwright has no touch-move, so the
 * phone journey scrolls with a horizontal wheel, which is also real input).
 */

const WIDTHS: [number, number][] = [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
];

const openSettings = (page: Page, tab?: string) =>
  page.evaluate((t) => (window as any).__neural.openSettings(t), tab);

type Box = { l: number; r: number; t: number; b: number };
type Geo = {
  n: number;
  cardPad: Box;
  content: Box;
  list: Box & { scrollW: number; clientW: number; overflowX: string; fade: string; mask: string };
  cardOverflowX: number;
  tabs: { id: string; label: string; selected: boolean; tabindex: string; btn: Box; lab: Box }[];
};

/** The frame's own boxes. The only arithmetic is insetting a rect by its computed padding/border. */
const geo = (page: Page): Promise<Geo> =>
  page.evaluate(() => {
    const card = (window as any).__neural.modalCardRef.current as HTMLElement;
    const lists = card.querySelectorAll('[role="tablist"]');
    if (lists.length !== 1) throw new Error(`expected exactly ONE tablist in the modal, found ${lists.length}`);
    const list = lists[0] as HTMLElement;
    const head = card.firstElementChild as HTMLElement;
    if (!head.contains(list)) throw new Error("the tablist is not inside the modal's head");
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { l: r.left, r: r.right, t: r.top, b: r.bottom };
    };
    const px = (v: string) => parseFloat(v) || 0;
    const cs = getComputedStyle(card),
      hs = getComputedStyle(head),
      ls = getComputedStyle(list);
    const c = box(card),
      h = box(head);
    const tabs = Array.from(list.querySelectorAll('[role="tab"]')) as HTMLElement[];
    return {
      n: tabs.length,
      cardPad: {
        l: c.l + px(cs.borderLeftWidth),
        r: c.r - px(cs.borderRightWidth),
        t: c.t + px(cs.borderTopWidth),
        b: c.b - px(cs.borderBottomWidth),
      },
      content: { l: h.l + px(hs.paddingLeft), r: h.r - px(hs.paddingRight), t: h.t, b: h.b },
      list: {
        ...box(list),
        scrollW: list.scrollWidth,
        clientW: list.clientWidth,
        overflowX: ls.overflowX,
        fade: list.getAttribute("data-fade") || "",
        mask: (ls as any).maskImage || (ls as any).webkitMaskImage || "none",
      },
      cardOverflowX: card.scrollWidth - card.clientWidth,
      tabs: tabs.map((t) => ({
        id: t.getAttribute("data-settings-tab") || "",
        label: (t.textContent || "").trim(),
        selected: t.getAttribute("aria-selected") === "true",
        tabindex: t.getAttribute("tabindex") || "",
        btn: box(t),
        lab: box((t.firstElementChild as Element) || t),
      })),
    };
  });

const EPS = 0.5;
const inside = (a: Box, b: Box) => a.l >= b.l - EPS && a.r <= b.r + EPS;
const fmt = (b: Box) => `[${b.l.toFixed(1)}, ${b.r.toFixed(1)}]`;

/**
 * The invariant that holds at EVERY width and ANY tab count. A tab that is not wholly inside the
 * tablist's own box must be clipped by a real scroll container, and the side it is hidden on
 * must be the side the fade is published on. A fade over nothing is as dishonest as none.
 */
function assertCannotOverflow(g: Geo, where: string) {
  expect(g.n, `${where}: a non-trivial tab count (a spec that finds no tabs passes everything)`).toBeGreaterThanOrEqual(5);
  expect(inside(g.list, g.cardPad), `${where}: the tablist ${fmt(g.list)} is inside the card ${fmt(g.cardPad)}`).toBe(true);
  expect(g.cardOverflowX, `${where}: the card itself does not overflow sideways (nothing is clipped by its edge)`).toBeLessThanOrEqual(0);
  const hiddenL = g.tabs.some((t) => t.btn.l < g.list.l - EPS),
    hiddenR = g.tabs.some((t) => t.btn.r > g.list.r + EPS);
  if (hiddenL || hiddenR) {
    expect(["auto", "scroll"], `${where}: tabs overhang the row, so it must be a scroll container`).toContain(g.list.overflowX);
    expect(g.list.scrollW, `${where}: and actually scroll`).toBeGreaterThan(g.list.clientW);
    expect(g.list.mask, `${where}: a published fade is APPLIED, not decorative`).not.toBe("none");
  }
  const fade = g.list.fade.split(/\s+/).filter(Boolean);
  expect(fade.includes("l"), `${where}: a left fade exactly when a tab is hidden on the left (fade="${g.list.fade}")`).toBe(hiddenL);
  expect(fade.includes("r"), `${where}: a right fade exactly when a tab is hidden on the right (fade="${g.list.fade}")`).toBe(hiddenR);
  for (const t of g.tabs) {
    expect(t.btn.b - t.btn.t, `${where}: "${t.label}" hit box is 44px tall`).toBeGreaterThanOrEqual(44 - EPS);
    expect(t.btn.r - t.btn.l, `${where}: "${t.label}" hit box is 44px wide`).toBeGreaterThanOrEqual(44 - EPS);
  }
  const on = g.tabs.filter((t) => t.selected);
  expect(on.length, `${where}: exactly one tab is aria-selected`).toBe(1);
  expect(inside(on[0].btn, g.list), `${where}: the ACTIVE tab "${on[0].label}" ${fmt(on[0].btn)} is in view inside ${fmt(g.list)}`).toBe(true);
  expect(g.tabs.map((t) => t.tabindex), `${where}: roving tabindex, 0 only on the active tab`).toEqual(
    g.tabs.map((t) => (t.selected ? "0" : "-1")),
  );
}

/**
 * Wait until the row has come to rest AND its scroll event has been delivered. Two traps, both
 * measured while writing this spec:
 *  - a scroll event is dispatched on the next RENDERING frame, and under SwiftShader with the graph
 *    canvas painting behind the modal a frame can take well over 100ms, so a timer is not a frame.
 *    The first cut polled every 120ms and read `data-fade` before the fade listener had run.
 *  - a smooth `scrollTo` does not move on the frame it is called: traced after a tap, the row
 *    read 0 on TWO consecutive frames (34ms, 47ms) and then glided 3 → 65 by 164ms. "Unchanged
 *    across two frames" therefore passes BEFORE the glide starts.
 * So: the position must hold across real frames for 150ms after its last change.
 */
const settled = async (page: Page) => {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<boolean>((res) => {
              const list = (window as any).__neural.modalCardRef.current.querySelector('[role="tablist"]') as HTMLElement;
              const t0 = performance.now();
              let x = list.scrollLeft,
                since = t0;
              const tick = () => {
                const now = performance.now();
                if (list.scrollLeft !== x) {
                  x = list.scrollLeft;
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

for (const [w, h] of WIDTHS) {
  test(`@curated at ${w}px no tab is clipped by the panel, the row cannot overflow, and the fade is honest`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const j = journey(page);
    await j.boot("/");

    for (const tab of ["flashcards", "shortcuts"]) {
      await openSettings(page, tab);
      await settled(page);
      const g = await geo(page);
      expect(g.n, `${w}px: a non-trivial tab count`).toBeGreaterThanOrEqual(5);

      if (w >= 768) {
        // THE OWNER'S DESKTOP COMPLAINT, literally, and FIRST so that it is the red a regression
        // prints: every label in the panel's content box, no scrolling, no fade. (Before the fix:
        // Shortcuts +22.5px past the content box, +0.5px past the card's edge, at all three.)
        for (const t of g.tabs) {
          expect(inside(t.lab, g.content), `${w}px: "${t.label}" label ${fmt(t.lab)} inside the content box ${fmt(g.content)}`).toBe(true);
          expect(inside(t.btn, g.cardPad), `${w}px: "${t.label}" hit box ${fmt(t.btn)} inside the card ${fmt(g.cardPad)}`).toBe(true);
        }
        // and the row sits IN the column: flush with its left edge (the title's) and its right edge
        // (the notice box's), the leftover going into the gaps (helmet.html: space-between)
        expect(Math.abs(g.tabs[0].lab.l - g.content.l), `${w}px: the first label starts on the column's left edge`).toBeLessThanOrEqual(1);
        expect(Math.abs(g.tabs[g.n - 1].lab.r - g.content.r), `${w}px: the last label ends on the column's right edge`).toBeLessThanOrEqual(1);
        expect(g.list.scrollW, `${w}px: the shipped five fit without scrolling`).toBeLessThanOrEqual(g.list.clientW);
        expect(g.list.fade, `${w}px: nothing hidden, so no fade`).toBe("");
      }
      assertCannotOverflow(g, `${w}px, opened on ${tab}`);
      expect(g.tabs.find((t) => t.selected)?.id, `${w}px: openSettings("${tab}") selects it`).toBe(tab);
      if (w < 768) {
        // THE PHONE: the row scrolls, and the fade says so.
        expect(g.list.scrollW, `${w}px: five labels do not fit a phone, so the row scrolls`).toBeGreaterThan(g.list.clientW);
        expect(g.list.fade, `${w}px: something is hidden, so a fade is published`).not.toBe("");
      }
      await page.evaluate(() => (window as any).__neural.closeModal());
    }
  });
}

test("@curated a sixth and seventh tab do not re-break it: the panel keeps its width and the row scrolls", async ({ page }) => {
  // The shipped list cannot be extended from a spec, so the row is given two more CHILDREN in
  // the DOM: this tests the CSS contract (the row cannot push the card) and the published fade,
  // on the real rendered row. The fade listener is driven by a REAL scroll, not a synthetic event.
  const j = journey(page);
  await j.boot("/");
  await openSettings(page, "flashcards");
  const before = await geo(page);
  const cardW = await page.evaluate(() => (window as any).__neural.modalCardRef.current.getBoundingClientRect().width);
  await page.evaluate(() => {
    const list = (window as any).__neural.modalCardRef.current.querySelector('[role="tablist"]') as HTMLElement;
    for (const label of ["Integrations", "Accessibility"]) {
      const t = list.lastElementChild!.cloneNode(true) as HTMLElement;
      t.setAttribute("aria-selected", "false");
      t.setAttribute("tabindex", "-1");
      t.firstElementChild!.textContent = label;
      list.appendChild(t);
    }
    list.scrollLeft = 1;
  });
  await settled(page);
  await page.evaluate(() => {
    ((window as any).__neural.modalCardRef.current.querySelector('[role="tablist"]') as HTMLElement).scrollLeft = 0;
  });
  await settled(page);
  const g = await geo(page);
  expect(g.n).toBe(before.n + 2);
  expect(
    await page.evaluate(() => (window as any).__neural.modalCardRef.current.getBoundingClientRect().width),
    "the tab row never decides the panel's width",
  ).toBe(cardW);
  expect(g.list.scrollW, "seven tabs overflow the 440px card, so the row scrolls").toBeGreaterThan(g.list.clientW);
  assertCannotOverflow(g, "1440px with 7 tabs, at the start");
  expect(g.list.fade, "hidden on the right only").toBe("r");

  // scroll to the far end: the fade must MOVE to the side that now hides something
  await page.evaluate(() => {
    const list = (window as any).__neural.modalCardRef.current.querySelector('[role="tablist"]') as HTMLElement;
    list.scrollLeft = list.scrollWidth;
  });
  await settled(page);
  const end = await geo(page);
  expect(end.list.fade, "at the far end the fade is on the left only").toBe("l");
  // an overflowing row is scrollable by a plain vertical WHEEL too (a desktop mouse has no x axis)
  const lb = end.list;
  await page.mouse.move((lb.l + lb.r) / 2, (lb.t + lb.b) / 2);
  await page.mouse.wheel(0, -400);
  await settled(page);
  expect((await geo(page)).list.fade, "a vertical wheel over the row scrolled it back to the start").toBe("r");
});

test("@curated desktop: every tab, Shortcuts included, is reachable by a real mouse", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await openSettings(page, "flashcards");
  const ids = (await geo(page)).tabs.map((t) => t.id);
  expect(ids).toContain("shortcuts");
  for (const id of [...ids.slice(1), ids[0]]) {
    await j.clickByMouse(`[data-settings-tab="${id}"]`, `the ${id} tab`);
    await settled(page);
    expect(await page.evaluate(() => (window as any).__neural._settingsTab), `mouse selected ${id}`).toBe(id);
    const g = await geo(page);
    expect(g.tabs.find((t) => t.selected)?.id).toBe(id);
    // the panel under the row is the selected tab's, and says so to assistive tech
    const panel = await page.evaluate(() => {
      const p = (window as any).__neural.modalCardRef.current.querySelector('[role="tabpanel"]') as HTMLElement | null;
      return p && { labelledby: p.getAttribute("aria-labelledby"), id: p.id };
    });
    expect(panel, "a tabpanel exists").not.toBeNull();
    const btnId = await page.evaluate((x) => document.querySelector(`[data-settings-tab="${x}"]`)!.id, id);
    expect(panel!.labelledby, "the tabpanel is labelled by the selected tab").toBe(btnId);
    expect(
      await page.evaluate((x) => document.querySelector(`[data-settings-tab="${x}"]`)!.getAttribute("aria-controls"), id),
    ).toBe(panel!.id);
  }
  await j.clickByMouse('[data-settings-tab="shortcuts"]', "the Shortcuts tab");
  await expect(page.locator(".ng-modal"), "the Shortcuts legend is what the panel now shows").toContainText("Pan the graph");
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("@curated a hidden tab is INERT until scrolled in, then a tap reaches it; the deep link lands in view", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await openSettings(page, "flashcards");
    await settled(page);
    const g = await geo(page);
    const sc = g.tabs.find((t) => t.id === "shortcuts")!;
    // It PEEKS: its leading edge is inside the row, under the fade, which is the affordance. The
    // rest of it runs past the row's right edge, clipped.
    expect(sc.btn.r, "on a phone Shortcuts is NOT wholly in view at open").toBeGreaterThan(g.list.r + 20);

    // INERT, proven by hit-testing (§6.1), not by looking: an on-screen point of its box that the
    // row clips must resolve to something that is NOT the tab.
    const probeX = (g.list.r + Math.min(sc.btn.r, 389)) / 2;
    expect(probeX, "there is an on-screen point of the clipped tab to probe").toBeGreaterThan(g.list.r + 2);
    const hit = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        const tab = document.querySelector('[data-settings-tab="shortcuts"]')!;
        return { isTab: !!el && (el === tab || tab.contains(el)), what: el ? el.tagName + "." + el.className : "null" };
      },
      [probeX, (sc.btn.t + sc.btn.b) / 2],
    );
    expect(hit.isTab, `elementFromPoint on the clipped part resolved to ${hit.what}`).toBe(false);

    // a real horizontal scroll over the row brings it in, and the fade moves
    await page.mouse.move((g.list.l + g.list.r) / 2, (g.list.t + g.list.b) / 2);
    await page.mouse.wheel(600, 0);
    await settled(page);
    const s = await geo(page);
    const sc2 = s.tabs.find((t) => t.id === "shortcuts")!;
    expect(inside(sc2.btn, s.list), `after the scroll Shortcuts ${fmt(sc2.btn)} is in view in ${fmt(s.list)}`).toBe(true);
    expect(s.list.fade, "scrolled to the end: hidden on the left only").toBe("l");

    // THE PEEK IS A DOOR: scroll back, then TAP the sliver of Shortcuts that shows under the fade.
    // It must select the tab AND glide it wholly into view. (Without the glide it would be
    // selected and still hidden, which is the bug this spec exists for, in miniature.) The point
    // is proven to be the tab's own before the tap, because a tap that misses proves nothing.
    await page.mouse.wheel(-600, 0);
    await settled(page);
    const b = await geo(page);
    expect(b.list.fade, "back at the start: hidden on the right only").toBe("r");
    const peek = b.tabs.find((t) => t.id === "shortcuts")!;
    const px = (peek.btn.l + b.list.r) / 2,
      py = (peek.btn.t + peek.btn.b) / 2;
    expect(b.list.r - peek.btn.l, "a sliver of Shortcuts is inside the row to tap").toBeGreaterThan(4);
    const own = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        const tab = document.querySelector('[data-settings-tab="shortcuts"]')!;
        return !!el && (el === tab || tab.contains(el));
      },
      [px, py],
    );
    expect(own, `the tab owns the peeking point (${px.toFixed(1)}, ${py.toFixed(1)})`).toBe(true);
    await page.touchscreen.tap(px, py);
    await settled(page);
    expect(await page.evaluate(() => (window as any).__neural._settingsTab)).toBe("shortcuts");
    assertCannotOverflow(await geo(page), "390px after tapping the peeking Shortcuts");

    // the account menu's deep link: opening straight onto Shortcuts must land it IN VIEW, with no
    // scrolling by the user (before the fix it was selected and 81.7px outside the card)
    await page.evaluate(() => (window as any).__neural.closeModal());
    await openSettings(page, "shortcuts");
    await settled(page);
    const d = await geo(page);
    const on = d.tabs.find((t) => t.selected)!;
    expect(on.id).toBe("shortcuts");
    expect(inside(on.btn, d.list), `deep-linked Shortcuts ${fmt(on.btn)} is in view in ${fmt(d.list)}`).toBe(true);
    expect(d.list.fade, "and the fade now points back at the tabs before it").toContain("l");
  });
});

test("@curated a resize with Settings open re-derives the fade (a phone rotated, a window narrowed)", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await openSettings(page, "flashcards");
  await settled(page);
  expect((await geo(page)).list.fade, "1440: everything fits, no fade").toBe("");
  await page.setViewportSize({ width: 390, height: 844 });
  await settled(page);
  const g = await geo(page);
  assertCannotOverflow(g, "narrowed from 1440 to 390 with Settings open");
  expect(g.list.fade, "narrowed: the row now hides something on the right, and says so").toBe("r");
  await page.setViewportSize({ width: 1440, height: 900 });
  await settled(page);
  expect((await geo(page)).list.fade, "widened again: the fade goes away").toBe("");
});

test("@curated keyboard: the row is a tablist — arrows, Home and End move and wrap, nothing leaks to the game, Esc closes", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  // everything that reaches `window` is what `_onKey` would see: record the arrows that get there
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
      return a && a.getAttribute("role") === "tab" ? a.getAttribute("data-settings-tab") : `not a tab: ${a && a.tagName}`;
    });
  const state = async () => ({ tab: await page.evaluate(() => (window as any).__neural._settingsTab), focus: await focused() });

  expect(await focused(), "opening Settings puts focus on the active tab, so the keys work at once").toBe("flashcards");
  await page.keyboard.press("ArrowRight");
  expect(await state()).toEqual({ tab: ids[1], focus: ids[1] });
  // a second arrow proves focus SURVIVED the re-render (the row is rebuilt on every change)
  await page.keyboard.press("ArrowRight");
  expect(await state()).toEqual({ tab: ids[2], focus: ids[2] });
  await page.keyboard.press("End");
  expect(await state()).toEqual({ tab: "shortcuts", focus: "shortcuts" });
  await page.keyboard.press("ArrowRight");
  expect(await state(), "ArrowRight on the last tab wraps to the first").toEqual({ tab: ids[0], focus: ids[0] });
  await page.keyboard.press("ArrowLeft");
  expect(await state(), "ArrowLeft on the first tab wraps to the last").toEqual({ tab: ids[ids.length - 1], focus: ids[ids.length - 1] });
  await page.keyboard.press("Home");
  expect(await state()).toEqual({ tab: ids[0], focus: ids[0] });
  assertCannotOverflow(await geo(page), "1440px after keyboard travel");
  expect(await page.evaluate(() => (window as any).__leaked), "no tab-row key reached the game's key handler").toEqual([]);

  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => (window as any).__neural.modalRef.current.style.display), "Esc still closes the modal").toBe("none");
});
