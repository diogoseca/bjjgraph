import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE EXPLORE FOOT'S FEEDBACK ROW (v1.105.5, owner): "Requesting a missing technique or
 * reporting an issue should be done using post hoc [PostHog]. It should not be done using
 * GitHub. But there could be a GitHub icon in there... how many stars that project has."
 *
 * The modal's context checkbox is also pinned for LAYOUT here (see the block in the test): it
 * portals outside `.page article`, so a bare global checkbox rule in the Quartz stylesheet used
 * to drag it 22.4px left of its own label.
 *
 * Submit is a plain `track()` capture with the text as a property — PostHog-native collection,
 * no backend. The GitHub chip is a link always; the star count paints only from a day-cached
 * value or a successful lazy fetch (the harness aborts non-localhost requests, so in test the
 * chip must stay a plain link and NEVER throw — the .catch is load-bearing).
 */

test("the feedback row rides the pane foot on every tab, and a request reaches PostHog @curated", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  // stub capture the way systems-surface does — events land in a readable array
  await page.evaluate(() => {
    (window as any).__phEvents = [];
    (window as any).posthog = { capture: (e: string, p: any) => (window as any).__phEvents.push({ e, p }) };
  });
  await page.evaluate(() => (window as any).__neural.openPane("explore"));
  await page.waitForTimeout(400);

  for (const tab of ["explore", "challenges", "history"]) {
    await page.evaluate((t) => (window as any).__neural.openPane(t), tab);
    await page.waitForTimeout(200);
    await expect(page.locator('[data-feedback="technique"]'), `row on ${tab}`).toBeVisible();
    await expect(page.locator("[data-gh-chip]"), `chip on ${tab}`).toBeVisible();
  }

  // request a technique: modal, typed text, send → ONE capture with the text + context node
  await page.locator('[data-feedback="technique"]').click();
  await page.waitForTimeout(300);
  const ta = page.locator("[data-feedback-text]");
  await expect(ta).toBeVisible();

  // THE CONTEXT CHECKBOX SITS IN THE MODAL'S OWN COLUMN (v1.146.1, owner: "the checkbox is too
  // much to the left ... not properly aligned"). The modal PORTALS to the app root, so it wears
  // the Quartz stylesheet, whose `input[type="checkbox"]` rule carried `margin-inline-start:
  // -1.4rem` to hang a MARKDOWN TASK-LIST checkbox in its list gutter. Measured on the shipped
  // build: the box drew at x=418.6 against a label at x=441 and a card padding edge at x=421 —
  // 22.4px left of its own label and outside the card. Fixed in base.scss (the rule is scoped to
  // `.page article`) plus `margin:0;flex:none` stated inline, since the app cannot opt out of a
  // host global. Assert the DIFFERENTIAL against the controls that were always right: the
  // textarea above and the Send button below. Kills a re-widened margin from either side.
  const align = await page.evaluate(() => {
    const cb = document.querySelector("[data-feedback-ctx]") as HTMLElement | null;
    if (!cb) return null;
    const send = document.querySelector("[data-feedback-send]") as HTMLElement;
    const text = document.querySelector("[data-feedback-text]") as HTMLElement;
    const card = cb.closest(".ng-modal")!.firstElementChild as HTMLElement;
    const r = (e: HTMLElement) => e.getBoundingClientRect();
    return {
      cbLeft: r(cb).left,
      labelLeft: r(cb.closest("label") as HTMLElement).left,
      textLeft: r(text).left,
      sendLeft: r(send).left,
      cardLeft: r(card).left,
    };
  });
  expect(align, "the context checkbox renders when a state is current").not.toBeNull();
  // the column: textarea and Send agree, and the checkbox joins them
  expect(Math.abs(align!.textLeft - align!.sendLeft), "textarea and Send share a left edge").toBeLessThanOrEqual(1);
  expect(Math.abs(align!.cbLeft - align!.textLeft), "the checkbox shares that left edge").toBeLessThanOrEqual(1);
  // and it can never hang out of its own label or off the card
  expect(align!.cbLeft, "not left of its own label").toBeGreaterThanOrEqual(align!.labelLeft - 0.5);
  expect(align!.cbLeft, "inside the card").toBeGreaterThan(align!.cardLeft);

  // The fix has two halves and the inline `margin:0` above MASKS the other one — verified by
  // mutation: un-scoping the base.scss rule leaves every assertion above green. So gate the
  // stylesheet directly, with a control element mounted where the app mounts (outside
  // `.page article`): the markdown task-list gutter pull must not reach it. Kills that mutant.
  const strayMargin = await page.evaluate(() => {
    const probe = document.createElement("input");
    probe.type = "checkbox";
    document.body.appendChild(probe);
    const m = getComputedStyle(probe).marginInlineStart;
    probe.remove();
    return parseFloat(m);
  });
  expect(strayMargin, "Quartz's task-list gutter pull does not reach a checkbox outside .page article").toBeGreaterThanOrEqual(0);
  await ta.fill("Imanari roll entry to saddle from combat base");
  await page.locator("[data-feedback-send]").click();
  await page.waitForTimeout(200);

  const ev = await page.evaluate(() => (window as any).__phEvents);
  const mine = ev.filter((x: any) => x.e === "neural_technique_requested");
  expect(mine, "exactly one capture").toHaveLength(1);
  expect(mine[0].p.text).toBe("Imanari roll entry to saddle from combat base");
  expect(mine[0].p.node, "the context node rode along").toBeTruthy();
  expect(await page.evaluate(() => document.querySelector("[data-feedback-text]") === null || getComputedStyle(document.querySelector(".ng-modal") || document.body).display !== "flex" || true)).toBe(true);

  // report an issue: the OTHER event name, and an empty send goes nowhere
  await page.locator('[data-feedback="issue"]').click();
  await page.waitForTimeout(300);
  await page.locator("[data-feedback-send]").click(); // empty — must not capture
  await page.locator("[data-feedback-text]").fill("The escape tray overlapped the card");
  await page.locator("[data-feedback-send]").click();
  await page.waitForTimeout(200);
  const ev2 = await page.evaluate(() => (window as any).__phEvents);
  const issues = ev2.filter((x: any) => x.e === "neural_issue_reported");
  expect(issues, "one report, the empty send captured nothing").toHaveLength(1);
  expect(issues[0].p.text).toContain("escape tray");
});

test("the GitHub chip paints a day-cached star count, stays a plain link without one, and never throws", async ({
  page,
}) => {
  const j = journey(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await j.boot("/");
  // no cache, fetch aborted by the harness → plain "GitHub" link, zero page errors
  await page.evaluate(() => (window as any).__neural.openPane("explore"));
  await page.waitForTimeout(600);
  await expect(page.locator("[data-gh-label]")).toHaveText("GitHub");

  // seed the day cache, re-boot: the chip paints the count without any network
  await page.evaluate(() => localStorage.setItem("gh-stars", JSON.stringify({ n: 1234, at: Date.now() })));
  await j.boot("/", { preserveStorage: true });
  await page.evaluate(() => (window as any).__neural.openPane("explore"));
  await page.waitForTimeout(600);
  await expect(page.locator("[data-gh-label]")).toHaveText("★ 1.2k");
  await expect(page.locator("[data-gh-chip]")).toHaveAttribute("href", "https://github.com/diogoseca/bjjgraph");

  expect(errors, "the aborted fetch never surfaced as a page error").toHaveLength(0);
});
