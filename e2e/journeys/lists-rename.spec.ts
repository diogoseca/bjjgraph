import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * LISTS CHROME (v1.99.3): the header + design pass and INLINE RENAME.
 *
 * Two owner items, one contract each:
 *
 *  1. THE + IS NATIVE TO THE PANE ("looks ugly as fuck" — owner). It keeps its 44px hit
 *     area, aria "New list" and the [data-lists-new] handle, but the VISUAL is a compact
 *     chip drawn in the pane's own token family (.ng-lists-new / .ng-lists-new-chip in
 *     helmet.html — the save-stack .ng-anchor-* pass is the house style reference), with
 *     real hover / 1px active press / keyboard focus-ring states in CSS, not JS.
 *
 *  2. A LIST'S NAME IS CLICK-TO-RENAME ("I can't seem to click to rename my lists" —
 *     owner). Clicking the name ([data-list-name]) swaps it for a text input
 *     ([data-list-rename]): Enter/blur commits, Esc cancels, empty reverts. A commit
 *     bumps the list's `t`, so the cloud merge's name-from-later-t rule carries the
 *     rename across devices. While the editor is open the row's OTHER behaviors
 *     (focus/light the list) must not fire — and the newborn list born from + opens
 *     straight into its name field, completing the intended "+ then rename" flow.
 *
 * Rails: __neural.lists, ._listEditId, ._listFocusId, .startListRename, .renameList
 * Handles: [data-lists-new], .ng-lists-new-chip, [data-list-name], [data-list-rename],
 *          [data-list-open], [data-list-row]
 */

const SHOTS = resolve(__dirname, "../../tests/artifacts/chrome");
mkdirSync(SHOTS, { recursive: true });

/** Open the pane on Explore the way a user does: the logo, then the tab — and let the
 *  deferred systems.json land before the test starts an edit. Its arrival re-renders the
 *  whole Explore body at an arbitrary moment; the editor SURVIVES that (pinned explicitly
 *  in the rename-commits test), but a keystroke fired by the harness in the exact
 *  microsecond of the rebuild lands on a detached input — a machine-speed artifact, not a
 *  user experience, so the typing tests wait it out instead. */
const settleSystems = async (page: Page) => {
  await page.evaluate(() => (window as any).__neural._ensureSystems());
  await expect
    .poll(() => page.evaluate(() => !!(window as any).__neural.systems), {
      timeout: 20_000,
    })
    .toBe(true);
  await page.waitForTimeout(80); // the arrival re-render settles
};

const openExplore = async (page: Page) => {
  await page.locator(".ng-logo").click();
  await page.locator("[data-view='explore']").click();
  await settleSystems(page);
};

/** A REAL reload with storage kept (the DSL wipes localStorage per navigation otherwise). */
const reloadKeepingStorage = async (page: Page) => {
  await page.evaluate(() => sessionStorage.setItem("__ng_keep", "1"));
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__neural?.nodes?.length);
  await page.evaluate(() => (window as any).__neural.advance(1200));
};

/** Seed one owned list straight through the app's own creation path (no UI), so rename
 *  tests start from a list that exists — with an item, so focusList has something to light. */
const seedList = (page: Page, name: string) =>
  page.evaluate((nm) => {
    const a = (window as any).__neural;
    const id = a.newList(nm);
    const n = a.nodes.find((x: any) => x.ty === "transitions");
    a.addToList(n.id, id);
    return { id, t: a.lists[id].t };
  }, name);

// ────────────────────────────────────────────── item 1: the + design pass

test("the New list + is a house-styled chip: 44px hit area around a proportionate visual, with CSS states @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openExplore(page);

  const plus = page.locator("[data-lists-new]");
  await expect(plus).toBeVisible();
  await expect(
    plus,
    "the + wears the pane's design language via class, not ad-hoc inline paint",
  ).toHaveClass(/ng-lists-new/);
  await expect(plus).toHaveAttribute("aria-label", "New list");

  // 44px HIT area preserved…
  const box = (await plus.boundingBox())!;
  expect(box.width, "44px hit target").toBeGreaterThanOrEqual(44);
  expect(box.height, "44px hit target").toBeGreaterThanOrEqual(44);

  // …around a COMPACT visual chip, proportionate to the 14px header text beside it —
  // the old design drew the full 44px square, a bare 20px glyph floating in space
  const chip = plus.locator(".ng-lists-new-chip");
  await expect(chip, "the visual is the chip, not the hit area").toBeVisible();
  const cbox = (await chip.boundingBox())!;
  expect(cbox.height, "chip reads at header scale").toBeLessThanOrEqual(34);
  expect(cbox.height).toBeGreaterThanOrEqual(20);
  expect(cbox.width).toBeLessThanOrEqual(34);

  // interactive states live in the stylesheet (helmet.html), the .ng-anchor-* pass pattern:
  // hover brighten, 1px active press, visible keyboard focus ring
  const rules = await page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const sheet of Array.from(document.styleSheets)) {
      let list: CSSRuleList;
      try {
        list = sheet.cssRules;
      } catch (e) {
        continue; // cross-origin (fonts)
      }
      for (const r of Array.from(list) as CSSStyleRule[])
        if (r.selectorText && r.selectorText.includes(".ng-lists-new"))
          out[r.selectorText] = r.cssText;
    }
    return out;
  });
  expect(
    Object.keys(rules).some((s) => s.includes(":hover")),
    "a hover state exists in CSS",
  ).toBe(true);
  const active = Object.keys(rules).find((s) => s.includes(":active"));
  expect(active, "an active state exists in CSS").toBeTruthy();
  expect(rules[active!], "…and it is the house 1px press").toContain("translateY(1px)");
  const focus = Object.keys(rules).find((s) => s.includes(":focus-visible"));
  expect(focus, "a keyboard focus ring exists in CSS").toBeTruthy();
  expect(rules[focus!]).toContain("outline");

  // it still works, by mouse, where it sits
  await j.clickByMouse("[data-lists-new]", "the New list +");
  await expect(page.locator("[data-lists-head]")).toContainText(/Your lists\s*\(1\)/);

  // the after-state gallery (tests/artifacts/chrome is the polish-screenshot home)
  await page
    .locator("[data-lists-section]")
    .screenshot({ path: resolve(SHOTS, "lists-plus-after.png") });
  await page.locator(".ng-drill").screenshot({ path: resolve(SHOTS, "pane-after.png") });
});

// ────────────────────────────────────────────── item 2: inline rename

test("clicking a list's name opens the editor and Enter commits — the rename persists with a fresh t", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const { id, t: t0 } = await seedList(page, "Rename me");
  await openExplore(page);

  await j.clickByMouse(`[data-list-name="${id}"]`, "the list's name");
  const inp = page.locator(`[data-list-rename="${id}"]`);
  await expect(inp, "the name swaps to a text input").toBeVisible();
  expect(
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.getAttribute("data-list-rename"),
    ),
    "…which is focused, ready to type",
  ).toBe(id);

  // AN UNRELATED RE-RENDER MUST NOT EAT THE EDITOR. Deferred payloads (systems.json) and
  // list-surface refreshes rebuild the Explore body mid-edit; Chrome fires blur on the
  // detach (reporting isConnected TRUE at dispatch — measured), which a naive blur-commit
  // turns into "the editor closed itself a second after opening". The rebuilt editor must
  // still be there, focused, with the untouched select-all offer intact.
  await page.evaluate(() => (window as any).__neural.renderExplorer());
  await expect(inp, "the editor survives a re-render").toBeVisible();
  expect(
    await page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement | null;
      return el && el.getAttribute("data-list-rename")
        ? { sel: [el.selectionStart, el.selectionEnd], len: el.value.length }
        : null;
    }),
    "…refocused with the select-all restored, so typing still replaces",
  ).toMatchObject({ sel: [0, 9], len: 9 }); // "Rename me"

  // the current name arrives selected, so typing replaces it outright
  await page.keyboard.type("Monday fundamentals");
  await page.keyboard.press("Enter");
  await expect(inp).toHaveCount(0);
  await expect(page.locator(`[data-list-name="${id}"]`)).toContainText(
    "Monday fundamentals",
  );

  const after = await page.evaluate(
    (lid) => {
      const a = (window as any).__neural;
      return { name: a.lists[lid].name, t: a.lists[lid].t };
    },
    id,
  );
  expect(after.name).toBe("Monday fundamentals");
  expect(
    after.t,
    "t bumps on commit — name-from-later-t is what carries the rename across devices",
  ).toBeGreaterThan(t0);

  // blur commits too (the other half of "Enter/blur commits")
  await j.clickByMouse(`[data-list-name="${id}"]`, "the list's name again");
  await page.keyboard.type("Monday takedowns");
  await page.locator("[data-lists-head]").click({ position: { x: 8, y: 8 } });
  await expect(page.locator(`[data-list-rename="${id}"]`)).toHaveCount(0);
  expect(
    await page.evaluate((lid) => (window as any).__neural.lists[lid].name, id),
  ).toBe("Monday takedowns");

  // and the committed name is durable: a reload is the same device coming back
  await reloadKeepingStorage(page);
  expect(
    await page.evaluate((lid) => (window as any).__neural.lists[lid].name, id),
    "the rename lives in the v2 blob",
  ).toBe("Monday takedowns");

  await openExplore(page); // the reload landed on a closed pane — reopen before the gallery shot
  await page
    .locator("[data-lists-section]")
    .screenshot({ path: resolve(SHOTS, "lists-renamed-after.png") });
});

test("Esc cancels a rename — the old name stays, and the pane does NOT close under the caret", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const { id } = await seedList(page, "Rename me");
  await openExplore(page);

  await j.clickByMouse(`[data-list-name="${id}"]`, "the list's name");
  await page.keyboard.type("garbage the owner never meant");
  await page.keyboard.press("Escape");

  await expect(page.locator(`[data-list-rename="${id}"]`)).toHaveCount(0);
  await expect(page.locator(`[data-list-name="${id}"]`)).toContainText("Rename me");
  expect(
    await page.evaluate((lid) => (window as any).__neural.lists[lid].name, id),
  ).toBe("Rename me");
  // Esc belonged to the editor, not the Esc ladder: the pane is still up
  expect(
    await page.evaluate(() => (window as any).__neural.deckShown),
    "Escape cancelled the edit — it must not also close the pane",
  ).toBe(true);
  await expect(page.locator(".ng-drill")).toBeVisible();
});

test("an empty commit reverts to the previous name", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const { id } = await seedList(page, "Rename me");
  await openExplore(page);

  await j.clickByMouse(`[data-list-name="${id}"]`, "the list's name");
  await page.keyboard.press("Backspace"); // the selected name deletes to nothing
  await page.keyboard.press("Enter");
  await expect(page.locator(`[data-list-rename="${id}"]`)).toHaveCount(0);
  await expect(page.locator(`[data-list-name="${id}"]`)).toContainText("Rename me");

  // whitespace is empty too
  await j.clickByMouse(`[data-list-name="${id}"]`, "the list's name again");
  await page.keyboard.type("   ");
  await page.keyboard.press("Enter");
  expect(
    await page.evaluate((lid) => (window as any).__neural.lists[lid].name, id),
    "a name of spaces is no name",
  ).toBe("Rename me");
});

test("the newborn list from + opens straight into its name field — the '+ then rename' flow", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openExplore(page);

  await j.clickByMouse("[data-lists-new]", "the New list +");
  const inp = page.locator("[data-list-rename]");
  await expect(inp, "the newborn arrives editing").toBeVisible();
  await expect(inp, "…prefilled with the established default name").toHaveValue(
    /^Class · /,
  );
  expect(
    await page.evaluate(
      () =>
        (document.activeElement as HTMLElement | null)?.hasAttribute(
          "data-list-rename",
        ) || false,
    ),
    "…and focused, so typing names it immediately",
  ).toBe(true);

  await page.keyboard.type("Tuesday: takedowns");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-lists-head]")).toContainText(/Your lists\s*\(1\)/);
  await expect(page.locator("[data-list-name]")).toContainText("Tuesday: takedowns");
  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      return a.lists[a.activeListId].name;
    }),
  ).toBe("Tuesday: takedowns");
});

test("rename works at 390px inside the drawer — tap the name, type, Enter", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const { id } = await seedList(page, "Rename me");
  await page.locator(".ng-logo").click(); // the phone pane opener (the pill is gone, v1.99.0)
  await expect(page.locator(".ng-drill")).toBeVisible();
  await page.locator('.ng-learning-nav [data-view="explore"]').click();
  await settleSystems(page);

  await j.clickByMouse(`[data-list-name="${id}"]`, "the list's name in the drawer");
  const inp = page.locator(`[data-list-rename="${id}"]`);
  await expect(inp).toBeVisible();
  const b = (await inp.boundingBox())!;
  expect(b.width, "the editor fits the 88vw drawer").toBeLessThanOrEqual(390 * 0.88);
  expect(b.width, "…without collapsing into an unusable sliver").toBeGreaterThan(120);
  await page.keyboard.type("Wed open mat");
  await page.keyboard.press("Enter");
  await expect(page.locator(`[data-list-name="${id}"]`)).toContainText("Wed open mat");
  expect(
    await page.evaluate((lid) => (window as any).__neural.lists[lid].name, id),
  ).toBe("Wed open mat");
});

test("while editing, the row's focus/light behavior does not fire — and fires again once the editor is gone", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const { id } = await seedList(page, "Rename me");
  await openExplore(page);
  // seedList made the list the active add target, not a lit selection
  expect(await page.evaluate(() => (window as any).__neural._listFocusId)).toBe(null);

  await j.clickByMouse(`[data-list-name="${id}"]`, "the list's name");
  await expect(page.locator(`[data-list-rename="${id}"]`)).toBeVisible();

  // a click inside the row while the editor is open: commits via blur, but must NOT light
  const row = page.locator(`[data-list-row="${id}"]`);
  // the deferred systems.json arrival re-renders the Explore body (replacing the row element)
  // at an arbitrary moment — measure against the SETTLED element, not a detached one
  const settledBox = async () => {
    for (let i = 0; i < 20; i++) {
      const b = await row.boundingBox();
      if (b) return b;
      await page.waitForTimeout(50);
    }
    throw new Error("list row never settled");
  };
  const r = await settledBox();
  await page.mouse.click(r.x + r.width / 2, r.y + r.height - 3); // the row's padding, no control there
  await expect(page.locator(`[data-list-rename="${id}"]`)).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as any).__neural._listFocusId),
    "the click that closed the editor did not light the list",
  ).toBe(null);
  expect(
    await page.evaluate(() => (window as any).__neural._focusIdxSet),
    "…and nothing lit on the graph",
  ).toBe(null);

  // Esc-cancel is equally inert
  await j.clickByMouse(`[data-list-name="${id}"]`, "the list's name again");
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => (window as any).__neural._listFocusId)).toBe(null);

  // positive control: with no editor open, the same row click DOES light the list
  await page.waitForTimeout(500); // clear of the editor's just-closed click guard
  const r2 = await settledBox();
  await page.mouse.click(r2.x + r2.width / 2, r2.y + r2.height - 3);
  expect(
    await page.evaluate(() => (window as any).__neural._listFocusId),
    "the row is still the way to light a list when nothing is being edited",
  ).toBe(id);
  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      return a._focusIdxSet ? a._focusIdxSet.size : 0;
    }),
  ).toBeGreaterThan(0);
});
