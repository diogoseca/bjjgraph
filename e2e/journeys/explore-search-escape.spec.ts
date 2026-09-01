import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE EXPLORE SEARCH QUERY IS TEXT, NOT MARKUP.
 *
 * `renderExplorer()`'s zero-result branch built its empty state by string concatenation
 * straight into `mk()`, whose body is `d.innerHTML = html`:
 *
 *     '…No techniques match “' + q + '”</span>'
 *
 * so anything typed into the Explore search was parsed as HTML. `.toLowerCase()` is not a
 * sanitiser — `<img src=x onerror=…>` is already lowercase — and the payload ran in
 * bjjgraph.org's origin, where localStorage holds the Supabase session.
 *
 * SEVERITY, on the record: SELF-XSS ONLY. `_exQ` has exactly two writers — the search
 * input's own `input` handler and a hardcoded `curatedMap` term — and NO URL parameter
 * feeds it. (Corrected v1.158.1: the note here used to say `?dual=` was the only param the app
 * read at all, which was never true — `?l=<code>` is read too, by `ngListParseSharePath`. `?dual=`
 * is now GONE, so what holds today is the stronger and accurate claim: no query parameter can
 * change how the graph renders, and none reaches `_exQ`.) The query is never persisted
 * and never rendered for a second user, so there is no link-delivery and no stored vector:
 * a victim has to paste the payload into their own search box. `hl(text, q)` is NOT a
 * second sink — it slices from the trusted node title and uses `q` only for indexOf/length.
 *
 * The fix is the house pattern already used at 11 sites in app.src.jsx: `this.escHTML(q)`.
 *
 * This spec is the mutant detector: drop the escHTML call and the canary fires.
 */

// All-lowercase on purpose: the empty state prints `q` AFTER .toLowerCase(), so the rendered
// text is byte-identical to what we typed — which lets us assert the query still SHOWS.
const PAYLOAD = '<img src=x data-xss onerror="window.__xssfired=1">';

/** Open the pane on Explore the way a user does: the logo, then the tab. */
const openExplore = async (page: Page) => {
  await page.locator(".ng-logo").click();
  await page.locator("[data-view='explore']").click();
  // Systems is a deferred payload and its arrival re-renders the Explore body — settle it
  // first so nothing swaps an element between the fill and the assertions.
  await page.evaluate(() => (window as any).__neural._ensureSystems());
  await expect
    .poll(() => page.evaluate(() => !!(window as any).__neural.systems), { timeout: 20_000 })
    .toBe(true);
  await page.waitForTimeout(80);
};

test("a markup payload in the Explore search renders as text and never executes", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await openExplore(page);

  await page.evaluate(() => {
    (window as any).__xssfired = 0;
  });

  await page.locator(".ng-explorer-search input").fill(PAYLOAD);
  await expect(
    page.locator(".ng-learning-list"),
    "the query matches nothing, so we are on the empty-search branch",
  ).toContainText("No techniques match");

  // `onerror` is async (src=x has to fail to load first) — give it room to fire before
  // concluding it did not. Without this the canary could read 0 on a build that IS injecting.
  await page.waitForTimeout(250);

  expect(
    await page.evaluate(() => (window as any).__xssfired),
    "the payload's onerror never ran",
  ).toBe(0);

  expect(
    await page.evaluate(
      () => document.querySelectorAll(".ng-learning-list [data-xss], .ng-learning-list img").length,
    ),
    "no element was parsed out of the query — it stayed a string",
  ).toBe(0);

  // …and escaping did not simply swallow the query: the user must still see what they typed.
  await expect(
    page.locator(".ng-learning-list"),
    "the empty state still shows the query, as literal text",
  ).toContainText(PAYLOAD);
});
