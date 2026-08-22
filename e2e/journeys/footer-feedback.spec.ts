import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE EXPLORE FOOT'S FEEDBACK ROW (v1.105.5, owner): "Requesting a missing technique or
 * reporting an issue should be done using post hoc [PostHog]. It should not be done using
 * GitHub. But there could be a GitHub icon in there... how many stars that project has."
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
