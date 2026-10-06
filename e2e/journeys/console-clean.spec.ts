// == A CLIENT-SIDE NAVIGATION LEAVES A CLEAN CONSOLE (CONSOLE0, 2026-10-05) ==
//
// The owner, in Brave on the dev preview: opened `/`, the app moved the address bar to
// `/Positions/Side-Control/Bottom` by itself, and the console showed `GET /Positions/static/icon.png
// 404` twice plus 33 report-only CSP violations. This journey replays that path through the app's
// OWN navigation seam (a rigged opening, then `_pushUrl` on the reveal; never `page.goto`) and fails
// on each of the four things that console showed, naming every offender.
//
// WHY DEPTH THREE. Quartz used to emit page resources relative to the page (`../static/icon.png` on
// `/`). The browser re-resolves such a URL against the CURRENT address. From `/` to a two-segment
// path, `../static/icon.png` still lands on `/static/icon.png` by luck. Only at three segments does
// it break (`/Positions/Side-Control/` + `../` = `/Positions/`). So the journey insists on the
// owner's three-segment role URL, and a shallower landing is a failed precondition, not a pass.
//
// WHAT THE HARNESS CANNOT SEE, beside the assertions that would otherwise look like coverage:
//  - The DSL aborts every non-localhost request and the local build is keyless, so PostHog (the
//    owner's 7 script + 24 connect violations) and Cloudflare's edge-injected analytics beacon never
//    load here. Those hosts are gated on the REAL deploy by scripts/check_deployed_console.mjs, run
//    after both deploys. Here, a CSP violation can come only from what a keyless page requests
//    itself, which is why the CSP mutant below drops Google Fonts, the one third party it requests.
//  - Headless Chromium never requests a favicon, so the owner's 404 cannot arrive as a response
//    here. The journey fetches every head resource ITSELF, at the URL the current address resolves
//    it to. That is the claim the browser's own re-fetch makes, made executable.
//  - The CSP exists here only because scripts/e2e-serve.mjs now applies the emitted `_headers`
//    `/*` CSP. The first assertion pins that, so "no violations" can never mean "no policy".
//
// MUTANTS (each red, by the assertion named; run against a built tree, inside the build lock):
//  M1 relative favicon: the served index.html's icon href back to `../static/icon.png`
//     -> "resource URLs that re-resolve after the navigation" AND "head resources at the new address".
//  M2 a host dropped from the CSP: `https://fonts.googleapis.com` removed from style-src in the
//     served `_headers` -> "securitypolicyviolation events".
// NOT KILLED HERE: a host missing for PostHog or the beacon (the harness never requests them; see
// above). That claim belongs to check_deployed_console.mjs and its own red proof.
import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

const LOCAL = /^(http:\/\/localhost|http:\/\/127\.)/;
const OWNER_PATH = "/Positions/Side-Control/Bottom";

test("@curated a client-side navigation leaves no broken URL, console error or CSP violation", async ({ page }) => {
  const badResponses: string[] = [];
  const aborted = new Set<string>();
  const consoleErrors: { text: string; at: string }[] = [];
  const pageErrors: string[] = [];
  page.on("response", (r) => {
    if (r.status() >= 400 && LOCAL.test(r.url())) badResponses.push(`${r.status()} ${r.url()}`);
  });
  page.on("requestfailed", (r) => {
    if (!LOCAL.test(r.url())) aborted.add(r.url());
  });
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push({ text: m.text(), at: m.location().url || "" });
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.addInitScript(() => {
    (window as any).__cspViolations = [];
    document.addEventListener(
      "securitypolicyviolation",
      (e) => (window as any).__cspViolations.push(`${e.effectiveDirective} ${e.blockedURI} (from ${e.sourceFile || "-"})`),
      true,
    );
  });

  const j = journey(page);
  const docResponse = page.waitForResponse((r) => r.request().resourceType() === "document" && LOCAL.test(r.url()));
  // The opening pool (`_posIdx`) is built lazily by the FIRST roll, so that roll is seeded (as
  // landing-role.spec.ts does) and the owner's Side Control Bottom is rigged for the second.
  await j.boot("/", { seedRolls: { role: [0.9], "start-pos": [0] } });
  const csp = (await docResponse).headers()["content-security-policy-report-only"] ?? "";
  expect(csp, "the document arrives WITH the site's CSP (scripts/e2e-serve.mjs applies the emitted _headers /*): without it every violation check below is vacuous").toContain("script-src");
  const loadUrl = page.url();
  expect(new URL(loadUrl).pathname).toBe("/");

  // The owner's navigation: the app itself seats Side Control's bottom and pushes its URL.
  await expect
    .poll(async () => {
      await j.advance(200);
      return page.evaluate(() => Array.isArray((window as any).__neural._posIdx));
    }, { timeout: 30000, intervals: [10], message: "the first roll builds the opening pool" })
    .toBe(true);
  const slot = await page.evaluate(() => {
    const a = (window as any).__neural;
    const s = a._posIdx.findIndex((idx: number) => a.nodes[idx].id === "Positions/Side-Control");
    return { slot: s, value: (s + 0.5) / a._posIdx.length };
  });
  expect(slot.slot, "Side Control is in the opening pool").toBeGreaterThanOrEqual(0);
  await j.rig("start-pos", [slot.value]);
  await j.rig("role", [0.9]);
  await page.evaluate(() => (window as any).__neural.resetRoll());
  await expect
    .poll(async () => {
      await j.advance(200);
      return page.evaluate(() => location.pathname);
    }, { timeout: 30000, intervals: [10], message: "the app pushes the owner's three-segment role URL by itself" })
    .toBe(OWNER_PATH);

  const after = await page.evaluate(async (loadUrl) => {
    const SKIP = /^([a-z][a-z0-9+.-]*:|\/\/|\/|#)/i;
    const moved: string[] = [];
    const sel = "link[href],script[src],img[src],source[src],iframe[src],video[src],audio[src],embed[src],object[data],use[href]";
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const attr = el.hasAttribute("src") ? "src" : el.hasAttribute("data") ? "data" : "href";
      const raw = el.getAttribute(attr) || "";
      if (!raw || SKIP.test(raw)) continue;
      const was = new URL(raw, loadUrl).href, now = new URL(raw, location.href).href;
      if (was !== now) moved.push(`<${el.tagName.toLowerCase()} ${attr}="${raw}"> now -> ${now} (at load ${was})`);
    }
    // the relative ANCHORS are the crawler fallback; they are safe only while nobody can reach them
    const reachableAnchors: string[] = [];
    for (const a of Array.from(document.querySelectorAll("a[href]"))) {
      const raw = a.getAttribute("href") || "";
      if (!raw || SKIP.test(raw) || new URL(raw, loadUrl).href === new URL(raw, location.href).href) continue;
      const r = a.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (top && (top === a || a.contains(top))) reachableAnchors.push(`<a href="${raw}"> -> ${new URL(raw, location.href).href}`);
    }
    const heads: string[] = [];
    for (const el of Array.from(document.querySelectorAll('link[rel~="icon"][href],link[rel="stylesheet"][href],link[rel="manifest"][href],link[rel~="preload"][href],script[src]'))) {
      const url = new URL(el.getAttribute(el.tagName === "SCRIPT" ? "src" : "href")!, location.href);
      if (url.origin === location.origin) heads.push(url.href);
    }
    return { moved, reachableAnchors, heads, csp: (window as any).__cspViolations as string[] };
  }, loadUrl);
  // Fetched OUTSIDE the page (page.request emits no page events), so a broken head resource fails
  // here once, by name, and not again as a response or console error of the journey's own making.
  const fetched: string[] = [];
  for (const href of after.heads) {
    const res = await page.request.get(href);
    if (res.status() !== 200) fetched.push(`${res.status()} ${new URL(href).pathname}`);
  }

  // positive coverage: the head carries at least the icon, index.css, prescript.js and postscript.js
  expect(after.heads.length, "same-origin head resources checked at the new address").toBeGreaterThanOrEqual(4);
  expect(after.moved, "resource URLs that re-resolve after the navigation (must be root-absolute: plugins/emitters/helpers.ts siteRoot)").toEqual([]);
  expect(fetched, "head resources at the new address (headless never fetches the favicon itself, so this does)").toEqual([]);
  expect(after.reachableAnchors, "relative links a visitor can click after the navigation").toEqual([]);
  // The dev snapshot camera probes /__snapshot/ping, gated on a localhost hostname, so it fires
  // HERE and on no deployed host; only dev-serve answers it. It is the repo's one legitimate 404,
  // excluded BY NAME and counted, as payload-first-hand.spec.ts does (snapshotButton.inline.ts).
  const snapshotProbe = badResponses.filter((b) => / http:\/\/[^/]+\/__snapshot\/ping$/.test(b));
  expect(snapshotProbe.length, "the localhost-only snapshot probe 404s at most once per load").toBeLessThanOrEqual(1);
  test.info().annotations.push({ type: "snapshot-probe 404s discounted", description: String(snapshotProbe.length) });
  expect(badResponses.filter((b) => !snapshotProbe.includes(b)), "same-origin 4xx/5xx responses").toEqual([]);
  expect(after.csp, "securitypolicyviolation events").toEqual([]);
  expect(pageErrors, "uncaught page errors").toEqual([]);
  // The harness aborts every external request, and Chromium logs each as "Failed to load resource".
  // Those, and only those, are discounted: same URL, recorded as aborted. Counted, never silent.
  // The snapshot probe's 404 above is logged here too, at its own URL; same rule, same name.
  const harness = consoleErrors.filter(
    (c) => /^Failed to load resource/.test(c.text) && (aborted.has(c.at) || /^http:\/\/[^/]+\/__snapshot\/ping$/.test(c.at)),
  );
  const real = consoleErrors.filter((c) => !harness.includes(c)).map((c) => `${c.text} @ ${c.at}`);
  test.info().annotations.push({ type: "harness-aborted console errors discounted", description: String(harness.length) });
  expect(real, "console errors").toEqual([]);
});
