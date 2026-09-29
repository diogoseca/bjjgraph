import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE FEEDBACK MODAL'S COPY AND COLUMN, FROM BOTH ENTRY POINTS, BY MOUSE, AT 390 AND 1440.
 *
 * Owner, 2026-09-24: remove "Please don't include personal information." The hint was the fourth
 * child of the modal's flex column (textarea · "about:" checkbox · hint · Send). Deleting the
 * TEXT is not the whole fix: an emptied or hidden spacer still costs the column one extra `gap`,
 * and Send floats a hole's height below the control it belongs to. So the claim is the column's
 * RHYTHM, measured as a differential against a control gap the change never touched: Send sits
 * exactly one column gap below whatever control is above it (the "about:" row when a state is
 * current, the textarea otherwise), which is the same distance as textarea -> "about:".
 *
 * Both entry points live in the pane foot (`[data-feedback="technique" | "issue"]`, footer-feedback
 * pins that the row exists on every tab); `openFeedback(kind)` is their only caller. Every control
 * here is reached with `j.clickByMouse` — never `locator.click()`, which dispatches ON the element
 * and cannot see an overlay eating the click (CLAUDE.md 6.1/6.3). The modal portals to the app
 * root (outside the wrap `attachInput` captures on), so it does not need an early-return entry;
 * the mouse journey below is what proves that stays true.
 *
 * v1.196.2: the issue entry invites improvements. Pin its one-line fit at 390 using
 * the rendered text's line boxes, the exact title/placeholder and the announcer after Send.
 * Both event names stay fixed and carry a boolean signed_in, with no account/email properties.
 * Signed-in coverage uses _applyUser, the same session projection as account-menu.spec.ts and
 * the app's SIGNED_IN handler; it does not assign user or signed_in directly. UNCOVERED: real
 * Supabase/OAuth and PostHog delivery (the harness aborts remote requests and stubs capture).
 *
 * Red-proof, v1.196.2 (each mutant rebuilt and served; 2 guest viewports + 1 applied session):
 *   - issue title reverted ..................................... killed 2/3 (issue: title)
 *   - issue placeholder reverted ............................... killed 2/3 (issue: placeholder)
 *   - signed_in dropped ........................................ killed 3/3 (both events, false and true)
 *   - signed_in always false ................................... killed 1/3 (both session events)
 *   - signed_in always true .................................... killed 2/3 (both guest events)
 *   - issue announcer reverted ................................. killed 2/3 (announcer thanks the sender)
 *   - entry changed to "Improve the graph" ..................... killed 2/3 (entry copy at both widths;
 *     specifically ONE line at 390 fails with 2 text line boxes, independently of the copy assertion)
 *   - email property added ..................................... killed 3/3 (only feedback properties)
 * No new surviving mutants. The previous display:none non-kill below remains outside this claim.
 *
 * Red-proof, v1.196.1 (each mutant built, served, run at BOTH viewports, then restored):
 *   - the hint restored verbatim ............................... killed 2/2 (copy)
 *   - hint.textContent = "" (an empty spacer left in the column)  killed 2/2 (Send gap 20px vs 10px)
 *   - the hint kept, visibility:hidden ......................... killed 2/2 (Send gap 31px vs 10px)
 *   - the issue title changed ................................... killed 2/2 (title)
 *   - the modal card's pointerdown stopPropagation removed ...... killed 2/2 (a mouse click on the
 *     textarea bubbles to the scrim, which closes the modal)
 *   - the "about:" checkbox's change listener removed ........... killed 2/2 (node rides along unticked)
 *   - the close control's click listener removed ................ killed 2/2
 *   - `pointer-events:none` on the pane-foot feedback row ....... killed 2/2 (clickByMouse names the
 *     `.ng-explorer` ancestor that owns the point)
 * Non-kills, recorded so nobody reads this spec as covering them:
 *   - a hint re-added with display:none SURVIVES (2/2 green): invisible AND out of the flex flow,
 *     and `innerText` skips it, so it changes nothing a user can see. Not a defect, not covered.
 *   - the WORDING of the titles and placeholders is pinned verbatim in ENTRIES, so a deliberate
 *     rename of either entry point must update ENTRIES in the same change.
 */

const ENTRIES = [
  {
    kind: "technique",
    title: "Request a technique",
    placeholder: "Which technique is missing? A name is enough — a position it starts from helps.",
    event: "neural_technique_requested",
    thanks: "We read every request",
    untick: true, // exercises the checkbox by mouse: the context node must NOT ride along
  },
  {
    kind: "issue",
    title: "Help improve the graph",
    placeholder: "What’s wrong, missing or confusing? Where were you when you noticed?",
    event: "neural_issue_reported",
    thanks: "Reports like this decide what gets fixed next",
    untick: false,
  },
] as const;

async function modalOpen(page: Page) {
  return page.evaluate(() => {
    const m = document.querySelector(".ng-modal") as HTMLElement | null;
    return !!m && getComputedStyle(m).display === "flex";
  });
}

for (const vp of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`feedback modal at ${vp.width}: both entry points, no privacy hint, an even column, every control by mouse @curated`, async ({
    page,
  }) => {
    await page.setViewportSize(vp);
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    await expect(page.locator(".ngAcctChip"), "the harness starts as Guest").toContainText("Guest");
    await page.evaluate(() => {
      (window as any).__phEvents = [];
      (window as any).posthog = { capture: (e: string, p: any) => (window as any).__phEvents.push({ e, p }) };
    });

    for (const entry of ENTRIES) {
      await page.evaluate(() => (window as any).__neural.openPane("explore"));
      await page.waitForTimeout(300);
      const entryLink = page.locator(`[data-feedback="${entry.kind}"]`);
      await expect(entryLink, `${entry.kind}: exactly one entry`).toHaveCount(1);
      if (entry.kind === "issue" && vp.width === 390) {
        const lines = await entryLink.evaluate(async (el) => {
          await document.fonts.ready;
          const range = document.createRange();
          range.selectNodeContents(el);
          return Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0).length;
        });
        expect.soft(lines, "issue: the entry renders on ONE line at 390").toBe(1);
      }
      await expect.soft(entryLink, `${entry.kind}: entry copy`).toHaveText(
        entry.kind === "issue" ? "Help improve it" : "Request a technique",
      );
      await j.clickByMouse(`[data-feedback="${entry.kind}"]`, `the "${entry.title}" entry in the pane foot`);
      await page.waitForTimeout(300);
      expect(await modalOpen(page), `${entry.kind}: the entry opens the modal`).toBe(true);

      const m = await page.evaluate(() => {
        const ta = document.querySelector("[data-feedback-text]") as HTMLTextAreaElement;
        const card = ta.closest(".ng-modal")!.firstElementChild as HTMLElement;
        const body = ta.parentElement as HTMLElement;
        const send = document.querySelector("[data-feedback-send]") as HTMLElement;
        const ctxBox = document.querySelector("[data-feedback-ctx]") as HTMLElement | null;
        const ctx = ctxBox ? (ctxBox.closest("label") as HTMLElement) : null;
        const r = (e: HTMLElement) => e.getBoundingClientRect();
        const above = ctx || ta; // the control Send belongs under
        return {
          title: (document.querySelector("[data-feedback-title]") as HTMLElement | null)?.innerText ?? null,
          closeCount: document.querySelectorAll("[data-feedback-close]").length,
          placeholder: ta.placeholder,
          text: card.innerText,
          hasCtx: !!ctx,
          declaredGap: parseFloat(getComputedStyle(body).rowGap),
          controlGap: ctx ? r(ctx).top - r(ta).bottom : null,
          sendGap: r(send).top - r(above).bottom,
          card: { left: r(card).left, right: r(card).right, top: r(card).top, bottom: r(card).bottom },
        };
      });

      // the copy each entry point promises
      expect.soft(m.title, `${entry.kind}: title`).toBe(entry.title);
      expect.soft(m.placeholder, `${entry.kind}: placeholder`).toBe(entry.placeholder);
      expect(m.closeCount, `${entry.kind}: exactly one close control`).toBe(1);
      // THE CLAIM: the hint is gone, in any wording that names personal information
      expect(m.text, `${entry.kind}: no privacy hint in the modal`).not.toMatch(/personal information/i);

      // THE COLUMN CLOSES OVER THE HOLE. Differential: Send's gap equals the gap the change never
      // touched (textarea -> "about:"), and both equal the column's declared gap. An emptied spacer
      // reads 2x, the old hint ~3x.
      expect(m.hasCtx, `${entry.kind}: a landed state puts the "about:" row in the column`).toBe(true);
      expect(m.controlGap!, `${entry.kind}: control gap is the declared column gap`).toBeCloseTo(m.declaredGap, 0);
      expect(
        Math.abs(m.sendGap - m.controlGap!),
        `${entry.kind}: Send sits one column gap below "about:" (${m.sendGap.toFixed(1)}px vs ${m.controlGap!.toFixed(1)}px) — no hole where the hint was`,
      ).toBeLessThanOrEqual(1);

      // the card fits the viewport, so every control below is reachable without scrolling
      expect(m.card.left, `${entry.kind}: card inside the viewport (left)`).toBeGreaterThanOrEqual(0);
      expect(m.card.right, `${entry.kind}: card inside the viewport (right)`).toBeLessThanOrEqual(vp.width);
      expect(m.card.bottom, `${entry.kind}: card inside the viewport (bottom)`).toBeLessThanOrEqual(vp.height);

      // every control by MOUSE. The textarea is focused on open, so blur first — otherwise
      // "focused after the click" proves nothing about the click.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await j.clickByMouse("[data-feedback-text]", `${entry.kind}: the textarea`);
      expect(
        await page.evaluate(() => document.activeElement === document.querySelector("[data-feedback-text]")),
        `${entry.kind}: a mouse click on the textarea focuses it`,
      ).toBe(true);
      const said = `${entry.kind} typed at ${vp.width}`;
      await page.keyboard.type(said);
      if (entry.untick) {
        await j.clickByMouse("[data-feedback-ctx]", `${entry.kind}: the "about:" checkbox`);
        expect(
          await page.evaluate(() => (document.querySelector("[data-feedback-ctx]") as HTMLInputElement).checked),
          `${entry.kind}: the mouse unticked it`,
        ).toBe(false);
      }
      expect(await modalOpen(page), `${entry.kind}: clicks inside the card never reach the backdrop`).toBe(true);
      await j.clickByMouse("[data-feedback-send]", `${entry.kind}: Send`);
      await page.waitForTimeout(200);
      expect(await modalOpen(page), `${entry.kind}: Send closes the modal`).toBe(false);
      const mine = (await page.evaluate(() => (window as any).__phEvents)).filter((x: any) => x.e === entry.event);
      expect(mine, `${entry.kind}: exactly one capture`).toHaveLength(1);
      expect(mine[0].p.text).toBe(said);
      expect.soft(mine[0].p.signed_in, `${entry.kind}: guest signed_in is false`).toBe(false);
      expect.soft(Object.keys(mine[0].p).sort(), `${entry.kind}: only feedback properties, no identity`).toEqual(
        ["app_version", "node", "signed_in", "text", "variant"],
      );
      if (entry.untick) expect(mine[0].p.node, `${entry.kind}: unticked, no context node`).toBeNull();
      else expect(mine[0].p.node, `${entry.kind}: ticked, the context node rides along`).toBeTruthy();
      const announced = await page.evaluate(() => {
        const a = (window as any).__neural;
        return { kicker: a.evKickerRef.current.textContent, text: a.evTextRef.current.textContent };
      });
      expect.soft(announced, `${entry.kind}: the announcer thanks the sender`).toEqual({
        kicker: "Sent — thank you", text: entry.thanks,
      });

      // and the close control by mouse: reopen, close, nothing captured
      await page.evaluate(() => (window as any).__neural.openPane("explore"));
      await page.waitForTimeout(300);
      await j.clickByMouse(`[data-feedback="${entry.kind}"]`, `${entry.kind}: the entry, again`);
      await page.waitForTimeout(300);
      await j.clickByMouse("[data-feedback-close]", `${entry.kind}: the close control`);
      await page.waitForTimeout(150);
      expect(await modalOpen(page), `${entry.kind}: the close control closes it`).toBe(false);
      const after = (await page.evaluate(() => (window as any).__phEvents)).filter((x: any) => x.e === entry.event);
      expect(after, `${entry.kind}: closing captured nothing`).toHaveLength(1);
    }
  });
}

test("both feedback events carry signed_in true after the session user is applied @curated", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  // Honest session seam, as in account-menu.spec.ts: exercise the app's projection and UI.
  // This covers feedback with an applied session, not a real OAuth exchange or auth persistence.
  await page.evaluate(() => {
    (window as any).__neural._applyUser({
      id: "feedback-test-user", email: "feedback@example.com", user_metadata: { full_name: "Feedback Tester" },
    });
    (window as any).__phEvents = [];
    (window as any).posthog = { capture: (e: string, p: any) => (window as any).__phEvents.push({ e, p }) };
  });
  await expect(page.locator(".ngAcctChip")).toContainText("Feedback Tester");

  for (const entry of ENTRIES) {
    await page.evaluate(() => (window as any).__neural.openPane("explore"));
    await page.waitForTimeout(300);
    await j.clickByMouse(`[data-feedback="${entry.kind}"]`, `${entry.kind}: signed-in entry`);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await j.clickByMouse("[data-feedback-text]", `${entry.kind}: signed-in textarea`);
    const said = `Signed-in ${entry.kind} feedback`;
    await page.keyboard.type(said);
    await j.clickByMouse("[data-feedback-send]", `${entry.kind}: signed-in Send`);
    expect(await modalOpen(page), `${entry.kind}: signed-in Send closes the modal`).toBe(false);
    const mine = (await page.evaluate(() => (window as any).__phEvents)).filter((x: any) => x.e === entry.event);
    expect(mine, `${entry.kind}: exactly one signed-in capture`).toHaveLength(1);
    expect(mine[0].p.text).toBe(said);
    expect.soft(mine[0].p.signed_in, `${entry.kind}: applied session signed_in is true`).toBe(true);
    expect.soft(Object.keys(mine[0].p).sort(), `${entry.kind}: session adds no identity properties`).toEqual(
      ["app_version", "node", "signed_in", "text", "variant"],
    );
  }
});
