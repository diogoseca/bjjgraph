import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * THE SHARE LINK ON A PHONE — the only device this feature actually ships to.
 *
 * A gym WhatsApp link is opened on a phone, in a changing room, one-handed. Every assertion in
 * this file runs at 390x844 with touch enabled, because the desktop layout hides the two
 * defects that matter most:
 *
 *  1. THE PANE IS AN 88vw DRAWER HERE (helmet.html `@media (max-width:640px){.ng-drill{width:88vw}}`).
 *     A drawer that covers the screen is the WRONG terminal state for a link whose whole promise
 *     is "open it and see exactly what we drilled" — and a re-light control living inside that
 *     drawer is unreachable in the one state where you want it. So: the landing ends on the LIT
 *     GRAPH, and the re-light control is the standalone `.ng-sharecue` band control (v1.99.0 —
 *     the pill that used to host it is deleted), OUTSIDE the
 *     drawer. Pane law is untouched: nothing in the roll loop opens or closes the pane, and the
 *     arrival no longer opens it here at all.
 *  2. A 150px option card in a horizontally-scrolling tray, on a 390px screen, is where a
 *     coach's `+` has to survive a real thumb. Proven with `page.mouse.click` / `touchscreen.tap`
 *     at MEASURED coordinates plus `document.elementFromPoint` — never `locator.click()`, which
 *     scrolls the element into view and hid the landing card's clipping bug for a whole pass.
 *
 * Rails: __neural._sharedIncoming, ._focusIdxSet, ._listFocusId, .deckShown, .lists
 * Beats: list_item_added, list_opened, list_relit, list_failed
 */

const PHONE = { width: 390, height: 844 };
test.use({ viewport: PHONE, hasTouch: true });

const PUBLIC = resolve(__dirname, "../../source/public");
const shellPath = resolve(PUBLIC, "l.html");

/** The production `/l/* /l.html 200` rewrite, emulated with NO Function in the path (the rung
 *  that matters). The rule itself is asserted from the emitted `_redirects` in share-lists.spec. */
const serveShellWithoutFunction = async (page: Page) => {
  const shell = readFileSync(shellPath);
  await page.route("**/l/*", (r) =>
    r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: shell }),
  );
};

const litIds = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    return Array.from(a._focusIdxSet || [])
      .map((i: any) => a.nodes[i].id)
      .sort();
  });

const pickClassNodes = (page: Page, n: number) =>
  page.evaluate((count) => {
    const a = (window as any).__neural;
    const usable = a.nodes
      .filter(
        (x: any) =>
          typeof x.o === "number" && (x.ty === "transitions" || x.ty === "submissions"),
      )
      .sort((p: any, q: any) => p.o - q.o);
    const step = Math.max(1, Math.floor(usable.length / count));
    const out: any[] = [];
    for (let i = 0; out.length < count && i * step < usable.length; i++) out.push(usable[i * step]);
    return out.map((x: any) => ({ id: x.id, name: x.t, o: x.o }));
  }, n);

const codeFor = (page: Page, ids: string[]) =>
  page.evaluate((list: string[]) => {
    const a = (window as any).__neural;
    for (const id of list) a.addToList(id);
    return a.listShareCode(a.activeListId);
  }, ids);

/** Where a control REALLY is, and whether a thumb could reach it: the box, whether it is inside
 *  the 390x844 viewport, whether it sits outside the drawer element, what
 *  document.elementFromPoint returns at its centre (so a failure names the thief), and — the one
 *  that caught a real bug in this pass — whether it can actually be SEEN. `pointer-events:auto`
 *  is set inline on every fixed-overlay control in this app (it has to be; the property is
 *  inherited and the canvas hit-tests above anything that doesn't re-enable it), and that beats
 *  the ancestor's `none`. So a control can be perfectly clickable inside a container at
 *  `opacity:0` — which is exactly how the share cue shipped in the first draft. Effective
 *  opacity is the product up the ancestor chain. */
const reach = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return { found: false } as any;
    const r = el.getBoundingClientRect();
    const x = Math.round(r.x + r.width / 2);
    const y = Math.round(r.y + r.height / 2);
    const at = document.elementFromPoint(x, y) as HTMLElement | null;
    const drawer = document.querySelector(".ng-drill");
    let opacity = 1;
    let hidden = "";
    for (let p: HTMLElement | null = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      opacity *= Number(cs.opacity);
      if (cs.display === "none" || cs.visibility === "hidden")
        hidden = `${p.tagName}.${String(p.className).slice(0, 30)}:${cs.display}/${cs.visibility}`;
    }
    return {
      found: true,
      x,
      y,
      w: Math.round(r.width),
      h: Math.round(r.height),
      opacity: Math.round(opacity * 100) / 100,
      hidden,
      visible: opacity > 0.5 && !hidden,
      inViewport:
        r.width > 0 &&
        r.height > 0 &&
        r.x >= 0 &&
        r.y >= 0 &&
        r.right <= window.innerWidth &&
        r.bottom <= window.innerHeight,
      insideDrawer: !!(drawer && drawer.contains(el)),
      hit: !at
        ? "NOTHING (the canvas is above it)"
        : at === el || el.contains(at)
          ? "the control"
          : `${at.tagName}.${String(at.className).slice(0, 40)}`,
    };
  }, selector);

// ══════════════════════════════════════════════════ 1. THE BLOCKER: the lit graph is the end state

test("a WhatsApp link opened on a phone ends on the LIT GRAPH, not a covering drawer @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickClassNodes(page, 5);
  const want = picks.map((p) => p.id).sort();
  const code = await codeFor(
    page,
    picks.map((p) => p.id),
  );

  await serveShellWithoutFunction(page);
  await j.boot(`/l/${code}`);

  const arrival = await page.evaluate(() => {
    const a = (window as any).__neural;
    const drawer = document.querySelector(".ng-drill") as HTMLElement | null;
    const dr = drawer ? drawer.getBoundingClientRect() : null;
    return {
      lit: !!(a._focusIdxSet && a._focusIdxSet.size),
      paneShown: !!a.deckShown,
      mobile: a.isMobile(),
      drawerDisplay: drawer ? getComputedStyle(drawer).display : "absent",
      // how much of a 390px-wide screen the drawer eats when it IS up
      drawerCoversPct: dr ? Math.round((dr.width / window.innerWidth) * 100) : 0,
      incoming: a._sharedIncoming && a._sharedIncoming.ids,
    };
  });

  expect(arrival.mobile, "premise: the app is in its mobile layout at 390px").toBe(true);
  expect(
    [...(arrival.incoming || [])].sort(),
    "the link resolved to exactly the coach's techniques",
  ).toEqual(want);
  expect(await litIds(page), "the class is LIT — that is the whole promise of the link").toEqual(
    want,
  );
  expect(
    arrival.paneShown,
    `the terminal state on a phone must be the lit graph: the drawer covers ` +
      `${arrival.drawerCoversPct}% of a 390px screen, so auto-opening it hides the one thing ` +
      `the recipient opened the link to see`,
  ).toBe(false);

  // …and the recipient is still TOLD what arrived — silence is not an option either
  const cue = await reach(page, "[data-share-cue]");
  expect(cue.found, "a persistent share cue reaches the recipient outside the drawer").toBe(true);
  expect(cue.insideDrawer, "the cue is NOT inside the covering drawer").toBe(false);
  expect(cue.inViewport, `the cue is on screen (${JSON.stringify(cue)})`).toBe(true);
  expect(
    cue.visible,
    `and it can be SEEN, not merely hit — effective opacity ${cue.opacity}${cue.hidden ? `, hidden by ${cue.hidden}` : ""}`,
  ).toBe(true);
  expect(cue.hit, `elementFromPoint(${cue.x},${cue.y}) must be the cue itself`).toBe("the control");
  expect(
    (await page.locator("[data-share-cue]").textContent())?.replace(/\s+/g, " "),
    "and it names the size of the class",
  ).toMatch(/5/);

  // the class is READABLE: one tap on the cue's open half brings up the list, on Explore
  const open = await reach(page, "[data-share-open]");
  expect(open.found, "a way INTO the list exists outside the drawer").toBe(true);
  expect(open.insideDrawer, "…and it is outside the drawer too").toBe(false);
  await page.touchscreen.tap(open.x, open.y);
  await expect(page.locator("[data-shared-list]")).toBeVisible();
  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      return { shown: !!a.deckShown, view: a._viewMode };
    }),
    "the recipient CHOSE to open it, and lands where Lists live",
  ).toMatchObject({ shown: true, view: "explore" });
});

test("dismissing the drawer on a phone leaves the class lit, and re-lighting never needs the drawer @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickClassNodes(page, 4);
  const want = picks.map((p) => p.id).sort();
  const code = await codeFor(
    page,
    picks.map((p) => p.id),
  );

  await serveShellWithoutFunction(page);
  await j.boot(`/l/${code}`);

  // read the list (the drawer covers the screen), then dismiss it to look at the graph
  const open = await reach(page, "[data-share-open]");
  await page.touchscreen.tap(open.x, open.y);
  await expect(page.locator("[data-shared-list]")).toBeVisible();
  const paused = await page.evaluate(() => (window as any).__neural.paused);
  expect(paused, "PANE LAW: opening the pane stops the game").toBe(true);

  await page.locator(".ng-explorer-close").click();
  expect(
    await page.evaluate(() => ({
      shown: !!(window as any).__neural.deckShown,
      paused: !!(window as any).__neural.paused,
    })),
    "PANE LAW: closing the pane resumes the roll it paused",
  ).toMatchObject({ shown: false, paused: false });
  expect(
    await litIds(page),
    "and the class the link was FOR is still lit — on a phone, dismissing the drawer is how " +
      "you look at the graph, not how you throw the class away",
  ).toEqual(want);

  // even after the recipient clears the highlight themselves, the way back is outside the drawer
  await page.evaluate(() => (window as any).__neural.clearFocus());
  expect(await litIds(page)).toEqual([]);
  const cue = await reach(page, "[data-share-cue]");
  expect(cue.insideDrawer, "the re-light control lives OUTSIDE the drawer").toBe(false);
  expect(cue.inViewport, `and a thumb can reach it (${JSON.stringify(cue)})`).toBe(true);
  expect(cue.visible, `and see it (effective opacity ${cue.opacity})`).toBe(true);
  expect(cue.hit, "nothing is on top of it").toBe("the control");
  await page.touchscreen.tap(cue.x, cue.y);
  expect(await litIds(page), "one tap, and the class is back on the graph").toEqual(want);
  expect(
    await page.evaluate(() => !!(window as any).__neural.deckShown),
    "…without covering the graph it just lit",
  ).toBe(false);
  await j.expectBeat("list_relit");
});

// ══════════════════════════════════════════════════ 1b. the sentence has to be READABLE

test("the sentence explaining the arrival waits until there is a settled screen to read it on @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickClassNodes(page, 5);
  const code = await codeFor(
    page,
    picks.map((p) => p.id),
  );
  await serveShellWithoutFunction(page);
  await j.boot(`/l/${code}`);

  const toast = () =>
    page.evaluate(() => {
      const el = document.querySelector(".ng-evtoast") as HTMLElement | null;
      let opacity = 1;
      for (let p: HTMLElement | null = el; p; p = p.parentElement)
        opacity *= Number(getComputedStyle(p).opacity);
      return {
        text: (el ? el.textContent || "" : "").replace(/\s+/g, " ").trim(),
        opacity: Math.round(opacity * 100) / 100,
        t: Math.round(((window as any).__neural.now || 0) * 10) / 10,
      };
    });

  // t=0 is mid-intro: the graph is still flying in and the roll's own first landing overwrites
  // the single toast slot a second later. A sentence delivered here is a sentence nobody reads.
  const atZero = await toast();
  expect(
    atZero.opacity < 0.5 || !/technique/i.test(atZero.text),
    `the arrival sentence must not be spent during the intro (got "${atZero.text}" at ` +
      `opacity ${atZero.opacity}, t=${atZero.t}s)`,
  ).toBe(true);

  // …and it arrives on the first landing: intro over, hand dealt, graph settled.
  await j.advance(6000);
  // the toast fades in over `transition:opacity .45s` — CSS transitions run on the REAL clock,
  // and pumped sim time passes none of it, so read the computed opacity after a real beat
  await page.waitForTimeout(600);
  const landed = await toast();
  expect(
    landed.text,
    `the recipient is told what arrived once there is a screen to read it on (t=${landed.t}s)`,
  ).toMatch(/Shared with you[\s\S]*5 techniques/i);
  expect(landed.opacity, "and it is visible, not merely present").toBeGreaterThan(0.5);

  // it stays up long enough to be read (the roll's next event is several seconds out)
  await j.advance(1500);
  expect((await toast()).text, "it lingers rather than flashing").toMatch(/Shared with you/i);
});

// ══════════════════════════════════════════════════ 2. THE MAJOR: capture a TECHNIQUE, mid-roll

test("a coach captures a TECHNIQUE from the live hand with a real tap at real coordinates @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");

  // the hand is techniques (optionsFor() skips positions) — which is the point: "the techniques
  // we learned in today's class" is transitions and submissions, not the position you stood in
  const hand = await page.evaluate(() => {
    const a = (window as any).__neural;
    return (a.optionIdxs || []).map((i: number) => ({
      id: a.nodes[i].id,
      name: a.nodes[i].t,
      ty: a.nodes[i].ty,
    }));
  });
  expect(hand.length, "a hand of techniques is dealt").toBeGreaterThan(1);
  expect(
    hand.every((h: any) => h.ty === "transitions" || h.ty === "submissions"),
    `the hand is techniques, not positions (${JSON.stringify(hand.map((h: any) => h.ty))})`,
  ).toBe(true);

  // ── WHERE THE CAPTURE LIVES NOW (v1.101.1) ──────────────────────────────────────────────────
  // Option cards lost their own `+`: a 150px card on a running clock is a CHOICE, and eight
  // copies of one control is clutter the owner asked to be rid of. The capability this journey
  // guards is unchanged — a coach takes a note on a TECHNIQUE, mid-roll, with a real tap, and it
  // must not commit the move — but the surface is the sheet a card tap already opens, which is
  // the phone's reading surface anyway.
  await expect(
    page.locator('[data-list-add][data-list-surface="option"]'),
    "no per-card capture on the hand any more",
  ).toHaveCount(0);

  // tap the CARD (a real tap, at measured coordinates) — that opens the sheet
  const cardBox = await page.locator(`[data-tech="${hand[0].name}"]`).first().boundingBox();
  expect(cardBox, "the first technique's card is on a 390x844 screen").not.toBeNull();
  await page.touchscreen.tap(cardBox!.x + cardBox!.width / 2, cardBox!.y + 24);

  // the sheet animates open over ~420ms — poll for the control, don't guess
  let sheetAdd = await reach(page, '[data-list-add][data-list-surface="sheet"]');
  for (let i = 0; i < 25 && !(sheetAdd.inViewport && sheetAdd.hit === "the control"); i++) {
    await page.waitForTimeout(100);
    sheetAdd = await reach(page, '[data-list-add][data-list-surface="sheet"]');
  }
  expect(sheetAdd.found, "the technique sheet can capture the technique it is describing").toBe(true);
  expect(sheetAdd.inViewport, `and it is reachable (${JSON.stringify(sheetAdd)})`).toBe(true);
  expect(sheetAdd.hit, "with nothing on top of it").toBe("the control");
  expect(
    Math.min(sheetAdd.w, sheetAdd.h),
    `a full-width sheet has room for a real thumb target (got ${sheetAdd.w}x${sheetAdd.h})`,
  ).toBeGreaterThanOrEqual(44);
  // …and it is LABELLED, which was claimed of it while its entire text was "+" and its only
  // words lived in a `title` attribute — a tooltip, on a device with no hover.
  const sheetText = (
    (await page.locator('[data-list-add][data-list-surface="sheet"]').textContent()) || ""
  ).replace(/\s+/g, " ").trim();
  expect(sheetText, `the sheet's capture says what it does in words (got "${sheetText}")`).toMatch(
    /class/i,
  );
  expect(
    await page.locator('[data-list-add][data-list-surface="sheet"]').getAttribute("aria-label"),
    "and every capture carries a real accessible name, not a title attribute",
  ).toMatch(/class/i);

  const targetId = await page.evaluate(
    () =>
      (
        document.querySelector('[data-list-add][data-list-surface="sheet"]') as HTMLElement
      ).getAttribute("data-list-add")!,
  );

  // THE PROOF: a real trusted touch tap at those coordinates. No locator.click (it scrolls into
  // view first), no window.__neural.
  await page.touchscreen.tap(sheetAdd.x, sheetAdd.y);

  const after = await page.evaluate(() => {
    const a = (window as any).__neural;
    const id = a.activeListId;
    const items = ((a.lists[id] || {}).items || []) as string[];
    return {
      items,
      types: items.map((nid) => a.nodes[a._idIndex.get(nid)].ty),
      committed: (a.beats || []).filter((b: any) => b.beat === "commit").length,
    };
  });
  expect(after.items, "one tap captures the TECHNIQUE the sheet is about").toEqual([targetId]);
  expect(
    after.types,
    `…and what got captured is a TECHNIQUE, not the position the coach happened to be in ` +
      `(got ${JSON.stringify(after.types)})`,
  ).toEqual([expect.stringMatching(/^(transitions|submissions)$/)]);
  expect(
    after.committed,
    "capturing a technique must NOT commit the move — a coach is taking a note, not playing it",
  ).toBe(0);
  await j.expectBeat("list_item_added");
});

// ══════════════════════════════════════════════════ 3. a saved link whose list is gone

test("a saved class the recipient later DELETED is offered again, not answered with silence @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickClassNodes(page, 3);
  const want = picks.map((p) => p.id).sort();
  const code = await codeFor(
    page,
    picks.map((p) => p.id),
  );

  await serveShellWithoutFunction(page);
  await j.boot(`/l/${code}`);
  const open = await reach(page, "[data-share-open]");
  await page.touchscreen.tap(open.x, open.y);
  await page.locator("[data-shared-save]").click();
  expect(
    await page.evaluate(() => Object.keys((window as any).__neural.lists).length),
    "saved: it is theirs now",
  ).toBe(1);

  // …and then they clear it out (two-step delete + the undo row expires with the session)
  await page.evaluate(() => {
    const a = (window as any).__neural;
    a.deleteList(Object.keys(a.lists)[0]);
    a._undoList = null;
    a._flushSave();
  });
  expect(await page.evaluate(() => Object.keys((window as any).__neural.lists).length)).toBe(0);

  // the coach re-posts the link in the group and they open it again
  await page.evaluate(() => sessionStorage.setItem("__ng_keep", "1"));
  await page.goto(`/l/${code}?again=1`);
  await page.waitForFunction(() => !!(window as any).__neural?.nodes?.length);
  await page.evaluate(() => (window as any).__neural.advance(1500));

  const second = await page.evaluate(() => {
    const a = (window as any).__neural;
    return {
      seen: a._shareSeen()[(window as any).NGLists.ngListShareId(location.pathname.split("/l/")[1].split("?")[0])],
      incoming: a._sharedIncoming && a._sharedIncoming.ids,
      lit: !!(a._focusIdxSet && a._focusIdxSet.size),
      cue: !!document.querySelector("[data-share-cue]"),
    };
  });
  expect(
    second.seen && second.seen.s,
    "premise: the code is still on record as saved",
  ).toBe("saved");
  expect(
    [...(second.incoming || [])].sort(),
    "the list it was saved into is GONE, so the link must be offered again — not answered " +
      "with nothing lit, no offer and no message",
  ).toEqual(want);
  expect(second.lit, "and the class is lit again").toBe(true);
  expect(second.cue, "with the cue outside the drawer, as on any arrival").toBe(true);
  expect(await litIds(page)).toEqual(want);
});

// ══════════════════════════════════════════════════ 4. a clipped link SAYS SO — and only a clip

/** THE CURATED REPRESENTATIVE. The exhaustive every-offset walk below boots the app 22 times in
 *  one test; that belongs in the full suite, not in a 12-minute deployment gate. This is the same
 *  contract in two boots: a real code cut in half says "incomplete", and a string that was never
 *  one of our codes is NOT blamed on the coach. */
test("a clipped link says it is incomplete; a string that was never our link says something else @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickClassNodes(page, 5);
  const code = await codeFor(
    page,
    picks.map((p) => p.id),
  );
  await serveShellWithoutFunction(page);

  await j.boot(`/l/${code.slice(0, Math.floor(code.length / 2))}`);
  const clip = await page.evaluate(() => {
    const a = (window as any).__neural;
    const beat = (a.beats || []).filter((b: any) => b.beat === "list_failed").pop();
    const pill = document.querySelector("[data-share-open]") as HTMLElement | null;
    return {
      clipped: beat ? !!beat.clipped : false,
      error: beat ? beat.error : null,
      pillText: (pill ? pill.textContent || "" : "").replace(/\s+/g, " ").trim(),
    };
  });
  expect(clip.clipped, `a real code cut in half is a clip (error ${clip.error})`).toBe(true);
  expect(clip.pillText, "and the pill says so").toMatch(/incomplete/i);
  const cutCue = await reach(page, "[data-share-open]");
  await page.touchscreen.tap(cutCue.x, cutCue.y);
  await expect(page.locator('[data-shared-broken-kind="clipped"]')).toBeVisible();
  expect(
    ((await page.locator("[data-shared-broken]").textContent()) || "").replace(/\s+/g, " "),
    "…in the same words the pill used",
  ).toMatch(/incomplete[\s\S]*cut short/i);

  // NOT OUR CODE AT ALL. `not_base64url` is also what a random pasted word looks like, so the
  // error alone cannot carry "your coach's link was cut short" — that would be a confident claim
  // about a stranger's typo. The leading wire-version byte is what tells them apart.
  await j.boot("/l/hello-there-friend");
  const foreign = await page.evaluate(() => {
    const a = (window as any).__neural;
    const beat = (a.beats || []).filter((b: any) => b.beat === "list_failed").pop();
    const pill = document.querySelector("[data-share-open]") as HTMLElement | null;
    return {
      clipped: beat ? !!beat.clipped : false,
      error: beat ? beat.error : null,
      pillText: (pill ? pill.textContent || "" : "").replace(/\s+/g, " ").trim(),
    };
  });
  expect(
    foreign.clipped,
    `"hello-there-friend" fails as ${foreign.error} — the same error most real clips produce — ` +
      `but it is not one of our codes, so it must NOT be reported as a truncated share link`,
  ).toBe(false);
  expect(foreign.pillText, "the pill says the link is unreadable, not incomplete").toMatch(
    /unreadable/i,
  );
  const badCue = await reach(page, "[data-share-open]");
  await page.touchscreen.tap(badCue.x, badCue.y);
  await expect(page.locator('[data-shared-broken-kind="unreadable"]')).toBeVisible();
  expect(
    ((await page.locator("[data-shared-broken]").textContent()) || "").replace(/\s+/g, " "),
    "…and the panel agrees with the pill (they used to contradict each other outright)",
  ).toMatch(/doesn.t look like one of our class links/i);
});

test("a link clipped anywhere in transit tells the recipient it is incomplete", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickClassNodes(page, 8);
  const code = await codeFor(
    page,
    picks.map((p) => p.id),
  );
  expect(code.length, "an 8-technique code is long enough to clip in several places").toBeGreaterThan(
    8,
  );

  // WhatsApp/Telegram/mail clients clip and re-wrap long URLs at whatever column they like, so
  // walk EVERY prefix, not one: the message has to reach the user wherever the cut landed.
  const offsets: number[] = [];
  for (let n = 2; n < code.length; n++) offsets.push(n);

  await serveShellWithoutFunction(page);
  const failures: string[] = [];
  const errors: Record<string, number> = {};
  for (const n of offsets) {
    const clip = code.slice(0, n);
    await j.boot(`/l/${clip}`);
    const state = await page.evaluate(() => {
      const a = (window as any).__neural;
      const beat = (a.beats || []).filter((b: any) => b.beat === "list_failed").pop();
      const pill = document.querySelector("[data-share-open]") as HTMLElement | null;
      let opacity = 1;
      for (let p: HTMLElement | null = pill; p; p = p.parentElement)
        opacity *= Number(getComputedStyle(p).opacity);
      const toast = document.querySelector(".ng-evtoast") as HTMLElement | null;
      return {
        incoming: a._sharedIncoming && a._sharedIncoming.ids,
        error: beat ? beat.error : null,
        clipped: beat ? !!beat.clipped : false,
        broken: a._sharedBroken && a._sharedBroken.error,
        // the DURABLE telling: a pill cue the recipient can see and act on, long after the
        // roll's next toast has overwritten the transient one
        pillText: (pill ? pill.textContent || "" : "").replace(/\s+/g, " ").trim(),
        pillSeen: !!pill && opacity > 0.5,
        toastText: (toast ? toast.textContent || "" : "").replace(/\s+/g, " ").trim(),
      };
    });
    errors[String(state.error)] = (errors[String(state.error)] || 0) + 1;
    // never a SUBSET of the class: that is the failure the count byte exists to prevent
    if (state.incoming && state.incoming.length)
      failures.push(`offset ${n}: decoded ${state.incoming.length} techniques from a CLIPPED code`);
    // EVERY code-shaped string that will not decode must reach the user, whatever the cut did
    if (!state.clipped)
      failures.push(
        `offset ${n}: error "${state.error}" is not classified as a clip, so the recipient was ` +
          `told nothing about a link that plainly arrived cut`,
      );
    if (!state.pillSeen)
      failures.push(
        `offset ${n} (${state.error}): no visible cue outside the drawer (toast="${state.toastText}")`,
      );
    if (!/incomplete/i.test(state.pillText))
      failures.push(`offset ${n}: the cue does not say the link is incomplete: "${state.pillText}"`);
  }
  expect(
    failures,
    `${failures.length} failures over ${offsets.length} clip offsets; error mix ${JSON.stringify(errors)}`,
  ).toEqual([]);
  // the error mix is the point of walking every offset: keying the message off the count-byte
  // errors alone leaves the majority of real cuts silent
  expect(
    errors["not_base64url"] || 0,
    `most real clip positions fail at the base64 layer, not the count byte (mix ${JSON.stringify(errors)})`,
  ).toBeGreaterThan(0);

  // and the full explanation is one tap away, on the surface a recipient can reach
  await j.boot(`/l/${code.slice(0, Math.floor(code.length / 2))}`);
  const cue = await reach(page, "[data-share-open]");
  expect(cue.insideDrawer, "the cue is outside the drawer here too").toBe(false);
  await page.touchscreen.tap(cue.x, cue.y);
  const broken = page.locator("[data-shared-broken]");
  await expect(broken, "…and it opens the durable explanation").toBeVisible();
  expect(((await broken.textContent()) || "").replace(/\s+/g, " ")).toMatch(
    /incomplete[\s\S]*cut short/i,
  );

  // a whole, unclipped code still works — the detector is not just refusing everything
  await j.boot(`/l/${code}`);
  expect(
    await page.evaluate(() => {
      const a = (window as any).__neural;
      return (a._sharedIncoming && a._sharedIncoming.ids.length) || 0;
    }),
    "the intact link still opens all 8",
  ).toBe(8);
  await expect(page.locator("[data-shared-broken]")).toHaveCount(0);
});

// ══════════════════════════════════════════════════ 5. thumb-sized targets on the arrival surface

test("the arrival surface has no thumb trap: dismiss is nowhere near Save @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickClassNodes(page, 3);
  const code = await codeFor(
    page,
    picks.map((p) => p.id),
  );

  await serveShellWithoutFunction(page);
  await j.boot(`/l/${code}`);
  const open = await reach(page, "[data-share-open]");
  await page.touchscreen.tap(open.x, open.y);
  await expect(page.locator("[data-shared-list]")).toBeVisible();

  const geo = await page.evaluate(() => {
    const box = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
    };
    const save = box("[data-shared-save]");
    const dis = box("[data-shared-dismiss]");
    // centre-to-centre in whichever axis they are separated by
    const dx = Math.max(0, Math.max(save.x - dis.right, dis.x - save.right));
    const dy = Math.max(0, Math.max(save.y - dis.bottom, dis.y - save.bottom));
    return { save, dis, gap: Math.round(Math.hypot(dx, dy)) };
  });

  expect(
    geo.gap,
    `dismiss sits ${geo.gap}px from Save — a mis-tap on a phone discards the class AND records ` +
      `it dismissed, so the link can never offer it again`,
  ).toBeGreaterThanOrEqual(24);
  expect(
    Math.min(geo.dis.w, geo.dis.h),
    `dismiss is ${Math.round(geo.dis.w)}x${Math.round(geo.dis.h)} — under a thumb's 44px`,
  ).toBeGreaterThanOrEqual(28);
  expect(
    Math.min(geo.save.w, geo.save.h),
    `Save is ${Math.round(geo.save.w)}x${Math.round(geo.save.h)}`,
  ).toBeGreaterThanOrEqual(28);
});

// ══════════════════════════════════════════════════ 6. copy that agrees with itself

test("the unresolved-techniques notice is grammatical for one and for many", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const good = await page.evaluate(() => {
    const a = (window as any).__neural;
    const nodes = a.nodes.filter((n: any) => typeof n.o === "number").slice(0, 2);
    for (const n of nodes) a.addToList(n.id);
    return nodes.map((n: any) => a.nodes[a._idIndex.get(n.id)].o);
  });

  await serveShellWithoutFunction(page);
  for (const [extra, expectation] of [
    [[9_000_000], /1 technique in this link (isn't|isn’t|is not)/],
    [[9_000_000, 9_000_001], /2 techniques in this link (aren't|aren’t|are not)/],
  ] as [number[], RegExp][]) {
    const code = await page.evaluate(
      ([os, ex]: [number[], number[]]) =>
        (window as any).NGLists.ngListEncodeOrdinals([...os, ...ex]),
      [good, extra] as [number[], number[]],
    );
    await j.boot(`/l/${code}`);
    const open = await reach(page, "[data-share-open]");
    await page.touchscreen.tap(open.x, open.y);
    const text = (
      (await page.locator("[data-shared-unresolved]").textContent()) || ""
    ).replace(/\s+/g, " ");
    expect(text, `copy must agree with itself (got: "${text}")`).toMatch(expectation);
  }
});
