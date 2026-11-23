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

test("the New list + is a house-styled chip: 44px hit area around a proportionate visual, with CSS states", async ({
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

  // CREATE = "+", CAPTURE = star — the design rule the v1.129.8 trade created, pinned because its
  // mutant SURVIVED the star rollout: turning this chip into a star left every test green while
  // the empty-state copy ("tap + to start one") pointed at a + that no longer existed on screen.
  // `toHaveText("+")` alone kills that mutant (an svg-filled chip has empty text); the svg count
  // states the rule outright.
  await expect(chip, "the create control is a +, never the capture star").toHaveText("+");
  expect(await chip.locator("svg").count(), "no star silhouette on the create control").toBe(0);

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
  // "click somewhere else" needs an INERT somewhere. It used to be the lists head, which became a
  // section toggle in v1.196.1 (Your lists folds like its neighbours) — so the section's own bottom
  // padding, which no handler owns, is the neutral spot now.
  const secBox = (await page.locator("[data-lists-section]").boundingBox())!;
  await page.mouse.click(secBox.x + 4, secBox.y + secBox.height - 4);
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
  // …and a reload comes back to a FOLDED Your lists (v1.196.1), so open it for the shot
  await page.locator('[data-explore-section="Your lists"]').click();
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
      return a.lists[a.listsArray()[0]].name; // the one list — the one just made
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
  await page.locator('[data-view="explore"]').click();
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

// ────────────────────────────────────────────── LISTS-R Slice 1: rename you can find
//
// The owner, 19 Nov: "how can i rename a list?". The name's press had renamed since v1.99.3 and nothing on screen said
// so (the preview, measured: the name's target was its text, 87x16px; a desktop showed an I-beam and a delayed tooltip,
// a phone nothing). Slice 1, the orchestrator's rulings 1 and 5:
//   · a PENCIL on every list row, always visible ([data-list-edit]); its press renames and never lights the row;
//   · the NAME's target is its TEXT (LISTS-S1-R1 took back the first build's stretch to the row's height: it cut the
//     share of a phone's row that lights the list from about two thirds to 18%); every point of the row that is not a
//     control lights the list, and the pencil costs its own area and no more;
//   · on a phone the row's three actions (✎ · share · ×) are 44px targets on one line, at an even 44px pitch, that
//     overlap no other target (LISTS-S1-GO took the 12px between Share and × back for the name);
//   · a key that closes the editor hands focus back to the pencil.
// Every rect below is MEASURED on the rendered row; no size is a constant of the spec.
// Mutants, all red against these tests on a real rebuild (the archive's v1.293.5 entry has the table): the pencil's
// press a no-op; no pencil on a phone; the phone's boxes at 24px; both row guards gone; the name STRETCHED to the
// row's height (LISTS-S1-R1: the first build's M5, inverted); no focus back on Enter; the pencil drawn over Share;
// × drawn over Share (M9; it survived the first build of this file, which checked overlap only); search or the map
// without a star; the armed Delete? shrunk; the pencil hover-only. GONE with the code it guarded: M6 (the name grown by
// padding), since the name no longer grows at all. NOT KILLED, and equivalent: the row's button guard alone removed
// (M4) — the pencil opens the editor synchronously and the row's second guard, "an editor is open on this row", stops
// the light.

type Box = { x: number; y: number; width: number; height: number };
const boxOf = async (page: Page, sel: string): Promise<Box> => {
  const b = await page.locator(sel).boundingBox();
  if (!b) throw new Error("no box for " + sel);
  return b;
};
/** elementFromPoint at the centre and 2px inside each edge: every point must be the control or inside it. */
const hitsAll = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement | null;
    if (!el) return { ok: false, misses: ["no element"] };
    const r = el.getBoundingClientRect();
    const pts: [string, number, number][] = [
      ["centre", r.left + r.width / 2, r.top + r.height / 2],
      ["left", r.left + 2, r.top + r.height / 2],
      ["right", r.right - 2, r.top + r.height / 2],
      ["top", r.left + r.width / 2, r.top + 2],
      ["bottom", r.left + r.width / 2, r.bottom - 2],
    ];
    const misses: string[] = [];
    for (const [k, x, y] of pts) {
      const at = document.elementFromPoint(x, y);
      if (!at || !(at === el || el.contains(at)))
        misses.push(k + " → " + (at ? at.tagName + " " + [...at.attributes].map((a) => a.name).filter((n) => n.startsWith("data-")).join(",") : "nothing"));
    }
    return { ok: misses.length === 0, misses };
  }, sel);
const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
/** Fold a list's items away (its own count button), so the row is its one header line. */
const collapse = async (page: Page, id: string, press: () => Promise<void>) => {
  if ((await page.locator(`[data-list-items="${id}"]`).count()) === 0) return;
  await press();
  await expect(page.locator(`[data-list-items="${id}"]`)).toHaveCount(0);
};
const activeAttr = (page: Page, attr: string) =>
  page.evaluate((a) => (document.activeElement as HTMLElement | null)?.getAttribute(a) ?? null, attr);

test("LISTS-R: the pencil renames from every list row, always visible, and never lights the row (1440, mouse)", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const first = await seedList(page, "Monday fundamentals");
  const second = await seedList(page, "Guard retention");
  await openExplore(page);
  await page.mouse.move(700, 450); // off the pane: nothing below may depend on a hover

  for (const { id } of [first, second]) {
    const pencil = page.locator(`[data-list-edit="${id}"]`);
    await expect(pencil, "every list row carries its pencil").toHaveCount(1);
    await expect(pencil, "…shown without a hover").toBeVisible();
    await expect(pencil).toHaveAttribute("aria-label", /^Rename “/);
    const look = await pencil.evaluate((el) => {
      let op = 1;
      for (let e: HTMLElement | null = el as HTMLElement; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
      const c = getComputedStyle(el);
      return { op, vis: c.visibility, color: c.color, svg: el.querySelectorAll("svg").length };
    });
    expect(look.op, "fully opaque at rest (hover-only is what hid rename)").toBe(1);
    expect(look.vis).toBe("visible");
    expect(look.svg, "a drawn glyph, not a word").toBe(1);
    expect(look.color, "inked like Share, not dimmed like ×").toBe(
      await page.locator(`[data-list-share="${id}"]`).evaluate((el) => getComputedStyle(el).color),
    );
    const hit = await hitsAll(page, `[data-list-edit="${id}"]`);
    expect(hit.misses, "the pencil's whole box is the pencil").toEqual([]);
  }

  // its press opens the editor on THAT list, focused and selected, and lights nothing
  const id = first.id;
  await j.clickByMouse(`[data-list-edit="${id}"]`, "the pencil");
  const inp = page.locator(`[data-list-rename="${id}"]`);
  await expect(inp, "the pencil opens the name editor").toBeVisible();
  expect(await activeAttr(page, "data-list-rename"), "…focused").toBe(id);
  expect(
    await inp.evaluate((el: HTMLInputElement) => el.selectionStart === 0 && el.selectionEnd === el.value.length),
    "…the whole name selected, so typing replaces it",
  ).toBe(true);
  await expect(page.locator(`[data-list-edit="${id}"]`), "no pencil beside its own open editor").toHaveCount(0);
  await expect(page.locator(`[data-list-edit="${second.id}"]`), "the other row keeps its pencil").toHaveCount(1);
  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      return { lit: a._listFocusId, set: a._focusIdxSet ? a._focusIdxSet.size : 0 };
    }),
    "the pencil's press did not light the list",
  ).toEqual({ lit: null, set: 0 });

  await page.keyboard.type("Thursday drills");
  await page.keyboard.press("Enter");
  await expect(page.locator(`[data-list-name="${id}"]`)).toContainText("Thursday drills");
  const after = await page.evaluate((lid) => (window as any).__neural.lists[lid], id);
  expect(after.name).toBe("Thursday drills");
  expect(after.t, "a rename bumps t, so the merge carries it").toBeGreaterThan(first.t);
  expect(await activeAttr(page, "data-list-edit"), "Enter hands focus back to the pencil").toBe(id);

  // the keyboard way round: Enter on the focused pencil opens it; Esc cancels and focus comes back again
  await page.keyboard.press("Enter");
  await expect(page.locator(`[data-list-rename="${id}"]`)).toBeVisible();
  await page.keyboard.type("Not this");
  await page.keyboard.press("Escape");
  await expect(page.locator(`[data-list-rename="${id}"]`)).toHaveCount(0);
  expect(await page.evaluate((lid) => (window as any).__neural.lists[lid].name, id)).toBe("Thursday drills");
  expect(await activeAttr(page, "data-list-edit"), "Esc hands focus back to the pencil").toBe(id);
  await expect(page.locator(".ng-drill"), "…and Esc did not close the pane").toBeVisible();
});

/** What a press does on each point of a list's row, sampled as the orchestrator's probe samples it (a 2px grid over the
 *  row, `elementFromPoint`): LIGHT = inside the row and inside no button or input. `free` counts the points that lie
 *  outside every control's measured box, so "everything that is not a control lights" is a comparison of two counts
 *  taken on the same grid, not a constant. With `hide`, the pencil is taken out of the layout first (and put back). */
const rowPressMap = (page: Page, id: string, hide = false) =>
  page.evaluate(
    ({ lid, hide }) => {
      const row = document.querySelector(`[data-list-row="${lid}"]`) as HTMLElement;
      const pencil = row.querySelector("[data-list-edit]") as HTMLElement | null;
      if (hide && pencil) pencil.style.display = "none";
      const R = row.getBoundingClientRect();
      const boxes = [...row.querySelectorAll("button,input")]
        .map((e) => e.getBoundingClientRect())
        .filter((q) => q.width > 0 && q.height > 0);
      const pr = pencil && !hide ? pencil.getBoundingClientRect() : null;
      // `outside`: the row's rounded corners, which the browser does not hit-test as the row (the probe's "outside").
      // `stolen`: a point outside every control's box that a control answers all the same; the claim is that none is.
      let n = 0, light = 0, free = 0, stolen = 0, outside = 0, onPencil = 0;
      for (let y = R.top + 1; y < R.bottom; y += 2)
        for (let x = R.left + 1; x < R.right; x += 2) {
          n++;
          const el = document.elementFromPoint(x, y);
          const inRow = !!el && row.contains(el);
          const lit = inRow && !el!.closest("button,input");
          if (lit) light++;
          if (!inRow) outside++;
          // a point within 1px of a control's edge belongs to neither side (subpixel rounding)
          const inBox = boxes.some((q) => x >= q.left - 1 && x <= q.right + 1 && y >= q.top - 1 && y <= q.bottom + 1);
          if (!inBox) { free++; if (inRow && !lit) stolen++; }
          if (pr && x >= pr.left && x <= pr.right && y >= pr.top && y <= pr.bottom) onPencil++;
        }
      if (hide && pencil) pencil.style.display = "";
      const pct = (v: number) => Math.round((1000 * v) / n) / 10;
      return { light: pct(light), free: pct(free), outside: pct(outside), stolen, pencil: pct(onPencil), n };
    },
    { lid: id, hide },
  );
/** The name's TEXT, not its button: a Range over its contents, so a stretched button cannot pass for its text. */
const nameText = (page: Page, id: string) =>
  page.locator(`[data-list-name="${id}"]`).evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const q = r.getBoundingClientRect(), b = el.getBoundingClientRect();
    return { x: q.left, y: q.top, width: Math.min(q.width, b.width), height: q.height, buttonHeight: b.height };
  });
/** The row's press and the name's press, by real input (`press` is a mouse click or a touch tap at a point).
 *  BY TOUCH, THE BROWSER WIDENS EVERY BUTTON: Chromium's touch adjustment moves a tap that lands near a control onto it.
 *  Measured with real taps on the preview (dev v1.293.4, the name's box its text exactly as here) and on this build, at
 *  390x631: a tap up to 6 to 8px above or below the name's text RENAMES, though `elementFromPoint` there says "row"; from
 *  10px it lights. So the mouse presses 4px above the text, and touch presses 2px inside the row's top edge, which is
 *  about 12px above the text on a phone's 44px row: past the browser's reach, and still the row's own press. */
const rowAndNamePresses = async (page: Page, id: string, press: (x: number, y: number) => Promise<void>, how: string, touch = false) => {
  const row = await boxOf(page, `[data-list-row="${id}"]`);
  const text = await nameText(page, id);
  expect(text.buttonHeight, "the name's box is its text (" + how + ")").toBeLessThanOrEqual(text.height + 2);

  // every point of the row that is not a control lights the list; the pencil costs its own area, and nothing more
  const map = await rowPressMap(page, id);
  const bare = await rowPressMap(page, id, true);
  const say = `${how}: the row lights on ${map.light}% of its area (outside every control: ${map.free}%, its rounded corners: ${map.outside}%), the pencil takes ${map.pencil}%, the row without the pencil lights on ${bare.light}%`;
  expect(map.stolen, say + " — no control answers a point outside its own box").toBe(0);
  expect(map.light, say + " — every point outside the controls lights").toBeGreaterThanOrEqual(map.free - map.outside - 1);
  expect(map.light, say + " — the pencil's own cost, and no more").toBeGreaterThanOrEqual(bare.light - map.pencil - 2);

  // above the name's text, inside the row: the row's own press, which lights the list and opens no editor
  const x = text.x + Math.min(20, text.width / 2), above = touch ? row.y + 2 : text.y - 4;
  const where = touch ? "2px inside the row's top edge (" + Math.round(text.y - above) + "px above the text)" : "4px above the name's text";
  expect(above, "the point is inside the row").toBeGreaterThan(row.y);
  expect(above, "the point is above the text").toBeLessThan(text.y);
  await press(x, above);
  await expect.poll(() => page.evaluate(() => (window as any).__neural._listFocusId), { message: where + " lights the list (" + how + ")" }).toBe(id);
  await expect(page.locator(`[data-list-rename="${id}"]`), "…and opens no editor").toHaveCount(0);

  // on the text: rename (the shortcut it always was), and nothing lit by it
  await page.evaluate(() => (window as any).__neural.clearFocus());
  await page.waitForTimeout(450); // clear of the row's just-pressed guard
  const t2 = await nameText(page, id);
  await press(t2.x + Math.min(20, t2.width / 2), t2.y + t2.height / 2);
  await expect(page.locator(`[data-list-rename="${id}"]`), "a press on the name's text renames (" + how + ")").toBeVisible();
  expect(await page.evaluate(() => (window as any).__neural._listFocusId), "…and lights nothing").toBe(null);
  await page.keyboard.press("Escape");
};

test("LISTS-S1-R1: the row lights wherever it holds no control; the name renames on its text, 4px above it lights (1440, mouse)", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const { id } = await seedList(page, "Monday fundamentals");
  await openExplore(page);
  await collapse(page, id, () => j.clickByMouse(`[data-list-open="${id}"]`, "the count"));
  await page.mouse.move(700, 450);
  await rowAndNamePresses(page, id, (x, y) => page.mouse.click(x, y), "1440, mouse");
});

test.describe("LISTS-R at 390x631 by touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } });

  const tapAt = async (page: Page, sel: string) => {
    const b = await boxOf(page, sel);
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  };
  const openDrawerByTouch = async (page: Page) => {
    await tapAt(page, ".ng-logo");
    await expect(page.locator(".ng-drill")).toBeVisible();
    await settleSystems(page);
  };
  const LONG = "Monday fundamentals: guard retention, passing and escapes"; // 57 of the 60 a name may hold

  test("the pencil, Share and × are 44px targets on one line that overlap nothing, on a long name", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const { id } = await seedList(page, LONG);
    await openDrawerByTouch(page);
    await page.locator(`[data-list-row="${id}"]`).scrollIntoViewIfNeeded();
    await collapse(page, id, () => tapAt(page, `[data-list-open="${id}"]`));
    await page.locator(`[data-list-row="${id}"]`).scrollIntoViewIfNeeded();

    const sels = {
      pencil: `[data-list-edit="${id}"]`,
      share: `[data-list-share="${id}"]`,
      del: `[data-list-delete="${id}"]`,
    };
    const b: Record<string, Box> = {};
    for (const [k, s] of Object.entries(sels)) {
      b[k] = await boxOf(page, s);
      expect(b[k].width, k + " is a thumb's width").toBeGreaterThanOrEqual(44);
      expect(b[k].height, k + " is a thumb's height").toBeGreaterThanOrEqual(44);
      const hit = await hitsAll(page, s);
      expect(hit.misses, k + ": its whole 44px box is its own (elementFromPoint)").toEqual([]);
    }
    const others = {
      name: await boxOf(page, `[data-list-name="${id}"]`),
      count: await boxOf(page, `[data-list-open="${id}"]`),
    };
    const all = { ...b, ...others };
    const keys = Object.keys(all);
    for (let i = 0; i < keys.length; i++)
      for (let k = i + 1; k < keys.length; k++)
        expect(overlap(all[keys[i]], all[keys[k]]), keys[i] + " and " + keys[k] + " overlap nowhere").toBe(0);
    const row = await boxOf(page, `[data-list-row="${id}"]`);
    expect(Math.abs(b.pencil.y - b.share.y) + Math.abs(b.share.y - b.del.y), "the three sit on one line").toBeLessThanOrEqual(1);
    expect(row.height, "the row is that one line: no taller than its tallest target").toBeLessThanOrEqual(
      Math.max(b.pencil.height, b.share.height, b.del.height) + 1,
    );
    expect(
      await page.locator(`[data-list-name="${id}"]`).evaluate((el) => el.scrollWidth > el.clientWidth),
      "the long name is cut by its ellipsis, it does not push the actions off the line",
    ).toBe(true);
    // WHAT THE OLD 12px WAS FOR, pinned instead of the 12px (LISTS-S1-GO): a press aimed at one action never lands on
    // the next. The three boxes abut at an even pitch, so each glyph's centre is at least a thumb (44px) from its
    // neighbour's, and no box overlaps another (above), armed or not (below). Mutant M9 draws × over Share's box.
    const cx = (r: Box) => r.x + r.width / 2;
    expect(cx(b.share) - cx(b.pencil), "pencil and Share: centres a thumb apart").toBeGreaterThanOrEqual(44 - 0.5);
    expect(cx(b.del) - cx(b.share), "Share and ×: centres a thumb apart").toBeGreaterThanOrEqual(44 - 0.5);
    expect(b.del.x + b.del.width, "× stays inside the drawer").toBeLessThanOrEqual(
      (await boxOf(page, ".ng-drill")).x + (await boxOf(page, ".ng-drill")).width,
    );

    // the armed delete keeps a thumb's box and stays clear of Share
    await tapAt(page, sels.del);
    await expect(page.locator(`[data-list-delete-armed]`)).toHaveCount(1);
    const armed = await boxOf(page, sels.del);
    expect(armed.height, "the armed Delete? is still a thumb's height").toBeGreaterThanOrEqual(44);
    const shareNow = await boxOf(page, sels.share);
    expect(overlap(armed, shareNow), "…and overlaps Share nowhere").toBe(0);
    expect(cx(armed) - cx(shareNow), "…and its centre is a thumb from Share's").toBeGreaterThanOrEqual(44 - 0.5);
    expect((await hitsAll(page, sels.del)).misses).toEqual([]);
  });

  test("LISTS-S1-R1 by touch: the row lights wherever it holds no control; the name renames on its text, the row's top band lights", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const { id } = await seedList(page, LONG);
    await openDrawerByTouch(page);
    await page.locator(`[data-list-row="${id}"]`).scrollIntoViewIfNeeded();
    await collapse(page, id, () => tapAt(page, `[data-list-open="${id}"]`));
    await page.locator(`[data-list-row="${id}"]`).scrollIntoViewIfNeeded();
    await rowAndNamePresses(page, id, (x, y) => page.touchscreen.tap(x, y), "390x631, touch", true);
  });

  test("a tap on the pencil renames; a tap on the name still renames; neither lights the list", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    const { id } = await seedList(page, LONG);
    await openDrawerByTouch(page);
    await page.locator(`[data-list-row="${id}"]`).scrollIntoViewIfNeeded();

    await tapAt(page, `[data-list-edit="${id}"]`);
    const inp = page.locator(`[data-list-rename="${id}"]`);
    await expect(inp, "the pencil, tapped, opens the editor").toBeVisible();
    expect(await activeAttr(page, "data-list-rename")).toBe(id);
    expect(await page.evaluate(() => (window as any).__neural._listFocusId), "…and lights nothing").toBe(null);
    await page.keyboard.type("Wed open mat");
    await page.keyboard.press("Enter");
    await expect(page.locator(`[data-list-name="${id}"]`)).toContainText("Wed open mat");

    await page.waitForTimeout(450); // clear of the editor's just-closed press guard (400ms)
    const tx = await nameText(page, id); // on the TEXT's middle: the name's target is its text
    await page.touchscreen.tap(tx.x + Math.min(20, tx.width / 2), tx.y + tx.height / 2);
    await expect(page.locator(`[data-list-rename="${id}"]`), "the name itself, tapped, still renames").toBeVisible();
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => (window as any).__neural._listFocusId), "…and lights nothing").toBe(null);
    expect(await page.evaluate((lid) => (window as any).__neural.lists[lid].name, id)).toBe("Wed open mat");
  });
});
