import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * "HOW DOES IT KNOW WHAT LIST?" — the capture picker (v1.99.5).
 *
 * Owner: "there's an add button for adding it to a list — but how does it know what list? If
 * there's two lists it always adds to the latest! It should let me select before adding, and
 * even show a create-inline option like YouTube does for playlists."
 *
 * The defect was SILENT MISFILING: `addToList(nodeId)` defaults to `activeListId`, so with two
 * lists every + landed in whichever was touched last, with the destination invisible. Nothing
 * looked wrong until a coach shared the wrong class.
 *
 * The contract:
 *  1. ≥2 lists → the + opens a PICKER instead of adding. Choosing the non-active list files it
 *     THERE and leaves the other untouched (that pair is the bug's regression proof).
 *  2. The check state mirrors real membership and untoggles (the checkbox doubles as remove).
 *  3. An inline "New list" row names and files in ONE action.
 *  4. Zero lists → no empty picker: the first capture creates "Class · <date>" and files it,
 *     one tap, and the create affordance is one further tap away from the resulting ✓.
 *  5. THE CLOCK KEEPS RUNNING while the picker is open, and the picker never covers the option
 *     hand past a decision (canon: capture never commits the move and never stops the clock).
 *  6. The destination is CHOSEN, never assumed: the likeliest is offered first and marked, and
 *     capture control's own accessible name.
 *  7. 390px: reachable, clamped inside the viewport, 44px rows.
 *
 * Rails: __neural.captureNode, .openListPicker, .pickList, .createListWith, .targetList(),
 *        .nodeInAnyList(), .paused, .lists
 * Handles: [data-list-picker], [data-list-pick="<listId>"], [data-list-pick-new],
 *          [data-list-pick-newname], [data-list-pick-create], [data-picker-default],
 *          [data-picker-default], [data-picker-check]
 */

const SHOTS = resolve(__dirname, "../../tests/artifacts/chrome");
mkdirSync(SHOTS, { recursive: true });

const settleSystems = async (page: Page) => {
  await page.evaluate(() => (window as any).__neural._ensureSystems());
  await expect
    .poll(() => page.evaluate(() => !!(window as any).__neural.systems), {
      timeout: 20_000,
    })
    .toBe(true);
  await page.waitForTimeout(80);
};

const openExplore = async (page: Page) => {
  await page.locator(".ng-logo").click();
  await page.locator("[data-view='explore']").click();
  await settleSystems(page);
};

/** Two named lists, created oldest-first — so "the latest" (the silent old destination) is
 *  unambiguously the SECOND one and choosing the first proves the fix. */
const seedTwoLists = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    const older = a.newList("Monday fundamentals");
    const newer = a.newList("Tuesday takedowns");
    return { older, newer };
  });

const pickNodes = (page: Page, n: number) =>
  page.evaluate((count) => {
    const a = (window as any).__neural;
    const usable = a.nodes
      .filter(
        (x: any) =>
          typeof x.o === "number" &&
          (x.ty === "transitions" || x.ty === "submissions") &&
          a.splitName(x.t).from,
      )
      .sort((p: any, q: any) => p.o - q.o);
    const step = Math.max(1, Math.floor(usable.length / count));
    const out: any[] = [];
    for (let i = 0; out.length < count && i * step < usable.length; i++)
      out.push(usable[i * step]);
    return out.map((x: any) => ({ id: x.id, name: x.t }));
  }, n);

/** The + on an Explore row, found through a search (a search renders results flat, so this
 *  reaches any technique without opening a section).
 *
 *  SCOPED BY SURFACE, deliberately: `[data-list-add]` also matches the landing card's and every
 *  option card's capture button, which live OUTSIDE the pane at the bottom of the screen — and
 *  since the pane moved LEFT (v1.94.0) an option card's + sits under it. A bare `.first()` picked
 *  one of those and spent the whole test timeout retrying a click the pane was intercepting. */
const exploreAddFor = async (page: Page, tech: { id: string; name: string }) => {
  await page.locator(".ng-explorer-search input").fill(tech.name);
  const add = page.locator(
    `[data-list-add="${tech.id}"][data-list-surface="explore"]`,
  );
  await expect(add).toBeVisible();
  return add;
};

// ─────────────────────────────────────── 1. the bug, and its regression proof

test("with two lists the + asks WHERE — and the list you choose is the one that gets it @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const { older, newer } = await seedTwoLists(page);
  const [tech] = await pickNodes(page, 1);
  await openExplore(page);

  // premise: the old silent destination is the LATEST list
  expect(
    await page.evaluate(() => (window as any).__neural.targetList()),
    "premise: the default destination is the most recently made list",
  ).toBe(newer);

  const add = await exploreAddFor(page, tech);
  await add.click();

  const picker = page.locator("[data-list-picker]");
  await expect(picker, "the + asks instead of filing silently").toBeVisible();
  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      return Object.keys(a.lists).map((k) => a.lists[k].items.length);
    }),
    "…and nothing has been filed yet",
  ).toEqual([0, 0]);

  // the rows name both lists; the default is marked and comes first
  await expect(page.locator("[data-list-pick]")).toHaveCount(2);
  const order = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-list-pick]")).map((e) =>
      e.getAttribute("data-list-pick"),
    ),
  );
  expect(order[0], "the destination a one-tap capture would use comes first").toBe(newer);
  await expect(page.locator(`[data-list-pick="${newer}"]`)).toHaveAttribute(
    "data-picker-default",
    "1",
  );

  await page.locator(`[data-list-picker]`).screenshot({
    path: resolve(SHOTS, "picker-two-lists-desktop.png"),
  });

  // THE REGRESSION PROOF: choose the OLDER list — the one the old code could never pick
  await j.clickByMouse(`[data-list-pick="${older}"]`, "the non-default list row");
  await expect(picker, "picking is decisive: the menu gets out of the way").toHaveCount(0);

  const after = await page.evaluate(
    (ids: { older: string; newer: string }) => {
      const a = (window as any).__neural;
      return {
        older: a.lists[ids.older].items,
        newer: a.lists[ids.newer].items,
      };
    },
    { older, newer },
  );
  expect(after.older, "it went where it was told").toEqual([tech.id]);
  expect(
    after.newer,
    "…and the list that used to swallow every capture is untouched",
  ).toEqual([]);
});

// ─────────────────────────────────────── 2. the check doubles as remove

test("the picker's checks mirror real membership, and tapping a checked row removes @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const { older, newer } = await seedTwoLists(page);
  const [tech] = await pickNodes(page, 1);
  await page.evaluate(
    (arg: { id: string; list: string }) =>
      (window as any).__neural.addToList(arg.id, arg.list),
    { id: tech.id, list: older },
  );
  await openExplore(page);

  // the + reads "captured" from ANY list, not just the active one — the old glyph called this
  // technique uncaptured because it lives in the list that is not active
  const add = await exploreAddFor(page, tech);
  await expect(add).toHaveAttribute("aria-pressed", "true");
  await expect(add, "the control names where it already lives").toHaveAttribute(
    "aria-label",
    /Monday fundamentals/,
  );

  await add.click();
  await expect(page.locator(`[data-list-pick="${older}"]`)).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.locator(`[data-list-pick="${newer}"]`)).toHaveAttribute(
    "aria-checked",
    "false",
  );

  // tapping the checked row removes it from THAT list
  await j.clickByMouse(`[data-list-pick="${older}"]`, "the checked row");
  expect(
    await page.evaluate(
      (lid: string) => Object.keys((window as any).__neural.lists).indexOf(lid),
      older,
    ),
    "removing the last item drops the list (and arms the undo row — v1.99.4)",
  ).toBe(-1);
  // the Lists section only renders when Explore is NOT in search mode (a query renders flat
  // ranked results instead), so clear the query before reading the section's own surfaces
  await page.locator(".ng-explorer-search input").fill("");
  await expect(page.locator("[data-list-undo]")).toBeVisible();
});

// ─────────────────────────────────────── 3. inline create

test("New list names and files in one action — the YouTube 'new playlist' row @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await seedTwoLists(page);
  const [tech] = await pickNodes(page, 1);
  await openExplore(page);

  const add = await exploreAddFor(page, tech);
  await add.click();
  await j.clickByMouse("[data-list-pick-new]", "the New list row");

  const inp = page.locator("[data-list-pick-newname]");
  await expect(inp, "the name field opens right there").toBeVisible();
  await expect(inp, "prefilled with the established default — offered, never demanded").toHaveValue(
    /^Class · /,
  );
  await page.locator("[data-list-picker]").screenshot({
    path: resolve(SHOTS, "picker-inline-create.png"),
  });

  await page.keyboard.type("Thursday guard");
  await page.keyboard.press("Enter");

  await expect(page.locator("[data-list-picker]")).toHaveCount(0);
  const made = await page.evaluate(
    (nid: string) => {
      const a = (window as any).__neural;
      const id = a.activeListId;
      return { name: a.lists[id].name, items: a.lists[id].items, n: Object.keys(a.lists).length, has: a.nodeInAnyList(nid) };
    },
    tech.id,
  );
  expect(made, "one action made the list AND filed the technique").toMatchObject({
    name: "Thursday guard",
    items: [tech.id],
    n: 3,
    has: true,
  });
});

// ─────────────────────────────────────── 4. zero and one list stay one tap

test("the + ALWAYS asks — nothing is filed into a list the reader did not choose @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const [tech, other] = await pickNodes(page, 2);
  await openExplore(page);

  // v1.101.9 overturns the old "one destination, one tap" shortcut. Owner: "list of lists should
  // show before adding anything, instead of showing it already green and saying 'added to list
  // whatever was being added last' — rather let the user select which list to add to. dont
  // assume." One list is only unambiguous the FIRST time; after that `activeListId` is whichever
  // list was last created or touched, which nobody picked.
  //
  // ZERO lists: it still asks — and opens straight into the name field, so the first capture is
  // one decision rather than one tap plus a surprise.
  const add = await exploreAddFor(page, tech);
  await add.click();
  await expect(
    page.locator("[data-list-picker]"),
    "the + asks even with nothing to choose from",
  ).toBeVisible();
  await expect(
    page.locator("[data-list-pick-newname]"),
    "…by offering the name field, not an empty menu",
  ).toBeVisible();
  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      return Object.values(a.lists || {}).some((l: any) => (l.items || []).length);
    }),
    "and files NOTHING before a destination exists",
  ).toBe(false);

  // name it and commit: that is the first capture, explicitly
  await page.locator("[data-list-pick-newname]").fill("Tuesday");
  await page.locator("[data-list-pick-newname]").press("Enter");
  const first = await page.evaluate(() => {
    const a = (window as any).__neural;
    return { n: Object.keys(a.lists).length, items: a.lists[a.activeListId].items };
  });
  expect(first.n).toBe(1);
  expect(first.items).toEqual([tech.id]);

  // ONE list: it asks again. "The only list you have" is a destination worth confirming, not one
  // worth assuming — and the same menu is where a second list gets created.
  const add2 = await exploreAddFor(page, other);
  await add2.click();
  await expect(page.locator("[data-list-picker]"), "one list still asks").toBeVisible();
  const rows = page.locator("[data-list-pick]");
  await expect(rows, "with the one list on offer").toHaveCount(1);
  await expect(page.locator("[data-list-pick-new]"), "…and a way to make another").toBeVisible();
  await rows.first().click();
  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      return a.lists[a.activeListId].items.length;
    }),
  ).toBe(2);

  // and pressing + on an ALREADY-captured technique asks too, so "put this in a new list" is
  // always one tap from a ✓
  const again = await exploreAddFor(page, other);
  await expect(again).toHaveAttribute("aria-pressed", "true");
  await again.click();
  await expect(
    page.locator("[data-list-picker]"),
    "the ✓ is the way back to the chooser",
  ).toBeVisible();
  await expect(page.locator("[data-list-pick-new]")).toBeVisible();
});

// ─────────────────────────────────────── 5. the clock

test("the picker never stops the clock, and never sits over the option hand past a decision @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await seedTwoLists(page);
  await openExplore(page);
  await page.locator(".ng-explorer-close").click(); // back to the roll, pane shut

  // THE in-roll capture surface (v1.101.1): the landing card's corner +. Option cards lost their
  // own copy — a 150px card on a running clock is a choice, and capture belongs on a surface you
  // opened to read. This is still the anchor with the least room around it while a hand is dealt.
  const optAdd = page.locator('[data-list-add][data-list-surface="land"]').first();
  await expect(optAdd, "the roll carries a capture affordance").toBeVisible();

  const before = await page.evaluate(() => {
    const a = (window as any).__neural;
    return { paused: a.paused, t: a.decisionLeft };
  });
  expect(before.paused, "premise: the roll is running").toBe(false);

  await optAdd.click();
  await expect(page.locator("[data-list-picker]")).toBeVisible();
  expect(
    await page.evaluate(() => (window as any).__neural.paused),
    "capture NEVER stops the clock — canon, and the reason the picker is chrome not a screen",
  ).toBe(false);

  // AND IT DOES NOT COVER THE HAND. At z:90 an overlapping menu does not just look wrong — it
  // OWNS those taps, so the card the user reaches for next delivers its click to a "New list"
  // row. This assertion exists because the first version of the picker did exactly that and
  // made committing the move impossible.
  const clear = await page.evaluate(() => {
    const p = (document.querySelector("[data-list-picker]") as HTMLElement).getBoundingClientRect();
    const tray = (window as any).__neural.optionsRef.current.getBoundingClientRect();
    return { pickerBottom: Math.round(p.bottom), trayTop: Math.round(tray.top) };
  });
  expect(
    clear.pickerBottom,
    `the picker sits clear of the option tray (bottom ${clear.pickerBottom} vs tray top ${clear.trayTop})`,
  ).toBeLessThanOrEqual(clear.trayTop);

  // the clock really is draining underneath it
  await j.advance(1200);
  expect(
    await page.evaluate(() => (window as any).__neural.paused),
    "…still running after time passes with the picker up",
  ).toBe(false);

  // and it is gone the moment a decision is committed — the tray must never be re-dealt
  // underneath an open menu at z:90. Committed through the app's own path (the tray card and
  // its Execute button), not a synthetic call, so the assertion is about the real sequence.
  const first = (await j.optionTitles())[0];
  await j.pick(first);
  await expect(
    page.locator("[data-list-picker]"),
    "committing the move closes the chooser",
  ).toHaveCount(0);
});

// ─────────────────────────────────────── 6. the destination, chosen not assumed

test("the picker offers a default FIRST, but files nothing until it is picked @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const { newer } = await seedTwoLists(page);
  await openExplore(page);

  // v1.103.3 retired the persistent "Adding to <list>" line: it existed to make v1.99.5's SILENT
  // default legible, and v1.102.0 removed the silent default — the picker always asks, so there is
  // no destination left for a status line to name. Owner: it "shouldnt exist". What survives is
  // the picker's own ordering: the would-be default is offered first and marked.
  await expect(page.locator("[data-lists-target]"), "no standing destination line").toHaveCount(0);

  const [tech] = await pickNodes(page, 1);
  const add = await exploreAddFor(page, tech);
  await add.click();

  const rows = page.locator("[data-list-pick]");
  await expect(rows.first(), "the likeliest destination is offered first").toHaveAttribute(
    "data-list-pick",
    newer,
  );
  await expect(page.locator("[data-picker-default]"), "…and marked as the default").toHaveCount(1);
  expect(
    await page.evaluate(() =>
      Object.values((window as any).__neural.lists || {}).some((l: any) => (l.items || []).length),
    ),
    "but nothing is filed until a row is chosen",
  ).toBe(false);

  // choosing the OTHER one files it there — the default is an offer, not a decision
  const older = await page.evaluate(
    (n: string) => Object.keys((window as any).__neural.lists).find((k) => k !== n)!,
    newer,
  );
  await j.clickByMouse(`[data-list-pick="${older}"]`, "the other list");
  expect(
    await page.evaluate(
      (o: string) => ((window as any).__neural.lists[o].items || []).length,
      older,
    ),
    "the technique lands in the list the reader picked",
  ).toBe(1);
});


// ─────────────────────────────────────── 7. the phone

test.describe("in the 390px drawer", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("the picker is reachable and fully on screen when opened from a 390px option card", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    await seedTwoLists(page);

    // the hardest anchor on the hardest device: the landing card's corner +, docked just above a
    // full option tray with the thumb band below that. An un-clamped drop-down lands under both.
    // (Option cards lost their own + in v1.101.1.)
    const optAdd = page.locator('[data-list-add][data-list-surface="land"]').first();
    await expect(optAdd).toBeVisible();
    const ab = (await optAdd.boundingBox())!;
    await page.touchscreen.tap(ab.x + ab.width / 2, ab.y + ab.height / 2);

    const picker = page.locator("[data-list-picker]");
    await expect(picker).toBeVisible();
    const geo = await page.evaluate(() => {
      const el = document.querySelector("[data-list-picker]") as HTMLElement;
      const r = el.getBoundingClientRect();
      const rows = Array.from(el.querySelectorAll("[data-list-pick],[data-list-pick-new]")).map(
        (e) => {
          const b = e.getBoundingClientRect();
          const mid = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return { h: Math.round(b.height), hit: !!mid && (mid === e || e.contains(mid)) };
        },
      );
      return {
        r: { l: Math.round(r.left), t: Math.round(r.top), rt: Math.round(r.right), b: Math.round(r.bottom) },
        vw: window.innerWidth,
        vh: window.innerHeight,
        rows,
      };
    });
    expect(geo.r.l, "clamped inside the left edge").toBeGreaterThanOrEqual(0);
    expect(geo.r.rt, "…and the right").toBeLessThanOrEqual(geo.vw);
    expect(geo.r.t, "…and the top").toBeGreaterThanOrEqual(0);
    expect(geo.r.b, "…and the bottom, above the thumb band").toBeLessThanOrEqual(geo.vh);
    for (const row of geo.rows) {
      expect(row.h, "44px rows for a thumb").toBeGreaterThanOrEqual(44);
      expect(row.hit, "every row is the topmost thing at its own centre").toBe(true);
    }
    // AND IT IS ON TOP OF THE AMBIENT CHROME IT OVERLAPS. On a phone the picker's band (above
    // the tray) is exactly where `.ng-landcard` lives — root plane, z:5. The Z LADDER says a
    // deliberate screen is never underdrawn by ambient gameplay chrome, so the assertion is on
    // the PICKER'S OWN centre, not just its rows: a card painting over it would be invisible to
    // a rows-only hit test if the rows happened to sit clear.
    const stack = await page.evaluate(() => {
      const p = document.querySelector("[data-list-picker]") as HTMLElement;
      const r = p.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const land = document.querySelector(".ng-landcard") as HTMLElement | null;
      const lr = land ? land.getBoundingClientRect() : null;
      return {
        topIsPicker: !!top && (top === p || p.contains(top)),
        topWas: top ? (top as HTMLElement).className || top.tagName : "none",
        pickerZ: getComputedStyle(p).zIndex,
        landZ: land ? getComputedStyle(land).zIndex : null,
        overlapsLand: !!lr && r.top < lr.bottom && r.bottom > lr.top,
        landOpacity: land ? getComputedStyle(land).opacity : null,
      };
    });
    expect(
      stack.topIsPicker,
      `the picker owns its own centre (found ${stack.topWas}; picker z=${stack.pickerZ}, landcard z=${stack.landZ}, overlapping=${stack.overlapsLand})`,
    ).toBe(true);
    expect(Number(stack.pickerZ), "…from the deliberate-screen band").toBeGreaterThanOrEqual(90);
    // …and the card it shares that band with STAYS VISIBLE (v1.103.2). It used to be suppressed,
    // on the reasoning that the picker's band is exactly where the card lives on a phone. Owner:
    // the + "should show the list of lists to choose from without hiding ng-landcard" — and the
    // z ladder already settles it, 90 over 5. Hiding what you were reading in order to answer a
    // question ABOUT it is the wrong trade; owning the INPUT is what matters, and that is
    // asserted above by `topIsPicker`.
    expect(
      Number(stack.landOpacity),
      "the landing card is still readable behind the picker",
    ).toBeGreaterThan(0.5);

    await page.screenshot({ path: resolve(SHOTS, "picker-390-option-card.png") });

    // a real touch on a row files it, with the clock still running
    const rowBox = (await page.locator("[data-list-pick]").nth(1).boundingBox())!;
    const chosen = await page
      .locator("[data-list-pick]")
      .nth(1)
      .getAttribute("data-list-pick");
    await page.touchscreen.tap(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
    expect(
      await page.evaluate(
        (lid: string) => (window as any).__neural.lists[lid].items.length,
        chosen!,
      ),
      "the tap filed it into the row that was tapped",
    ).toBe(1);
    expect(await page.evaluate(() => (window as any).__neural.paused)).toBe(false);
  });
});
