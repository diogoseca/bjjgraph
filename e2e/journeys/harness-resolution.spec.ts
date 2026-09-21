import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * THE HARNESS RESOLVES A BARE ROUTE THE WAY PRODUCTION DOES.
 *
 * 1,518 of the site's pages are emitted TWICE — `X.html` and `X/index.html` — and the two are
 * not copies. The folder one is a strictly degraded clone: 6–25 KB smaller, and 1,506 of the
 * 1,518 carry no `#page-graph-data` block at all. Production (Cloudflare Pages) picks between
 * them by URL FORM, measured 2026-09-20 with read-only curls against bjjgraph.org:
 *
 *      bare  /Positions/Mount   -> Positions/Mount.html        (data-slug="Positions/Mount")
 *      slash /Positions/Mount/  -> Positions/Mount/index.html  (data-slug="Positions/Mount/index")
 *
 * `serve` — which every one of the ten playwright configs used to launch — returned the FOLDER
 * copy for both, and its stock `cleanUrls` 301s `/X.html` back to the bare form, so under the
 * old harness the flat document was unreachable at EVERY url. Ten bare routes across eleven spec
 * files were asserting against a document production does not serve there, at 200, with no
 * redirect and nothing to signal the substitution.
 *
 * WHY THIS SPEC AND NOT A PROBE: a probe is evidence for a commit message; only a spec is a gate
 * (CLAUDE.md 6.3). It is `@curated` because an untagged test is invisible to the deployment gate.
 *
 * THE ORACLE IS THE DOCUMENT'S OWN SELF-REPORT: `<body data-slug>`, written by renderPage.tsx
 * from the page's own slug. The folder copy says `X/index`, the flat one says `X`. Nothing here
 * re-implements the resolver it is testing — it reads which FILE came back.
 *
 * NON-KILLS, recorded so nobody reads this spec as covering them (CLAUDE.md 6.3):
 *   - it says nothing about which document is CORRECT — only that the harness agrees with
 *     production. Both would be wrong together if production's rule changed.
 *   - it does not cover non-HTML assets, headers, ranges or compression; those are untouched
 *     code paths, pinned only by the control case below.
 */

const PUBLIC = path.resolve(__dirname, "../../source/public");

/** Every route the build emits BOTH ways, plus routes emitted only one way (the controls).
 *  Derived from the served tree, never authored — a hand-typed route list rots against content. */
function inventory() {
  const dupes: string[] = [];
  const flatOnly: string[] = [];
  const walk = (abs: string, rel: string) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const p = path.join(abs, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p, r);
      else if (e.isFile() && e.name.endsWith(".html") && e.name !== "index.html") {
        const stem = r.slice(0, -5);
        (fs.existsSync(path.join(PUBLIC, stem, "index.html")) ? dupes : flatOnly).push(`/${stem}`);
      }
    }
  };
  walk(PUBLIC, "");
  dupes.sort();
  flatOnly.sort();
  return { dupes, flatOnly };
}

const slugOf = (html: string) => html.match(/data-slug="([^"]*)"/)?.[1] ?? null;

test("@curated the harness resolves a bare duplicated route to the FLAT file, like production", async ({
  request,
}) => {
  const { dupes, flatOnly } = inventory();

  // A gate that can pass vacuously is not a gate (CLAUDE.md 6.6). If the folder duplicates are
  // ever deleted — an approved, separate decision — this fails loudly and names the follow-up
  // rather than going quietly green about nothing.
  expect(
    dupes.length,
    `source/public emits no route both ways, so this gate has nothing to hold. If the 1,518 ` +
      `folder duplicates were deliberately removed, delete this spec AND the rewrite layer in ` +
      `scripts/e2e-serve.mjs in the same commit.`,
  ).toBeGreaterThan(0);
  expect(flatOnly.length, "no single-emission route to use as a control").toBeGreaterThan(0);

  // Deterministic picks: first and last of a sorted list, so one content edit cannot quietly
  // move the subject, and a `/Positions/...`-shaped route is covered alongside whatever sorts last.
  const subjects = [dupes[0], dupes[dupes.length - 1], dupes[Math.floor(dupes.length / 2)]];
  // Controls are CONTENT pages (a `/` in the path), not root utilities: `/404` is emitted flat-only
  // too and would "pass" this as an error page served at 200, which is not the comparison meant.
  const nested = flatOnly.filter((r) => r.includes("/"));
  expect(nested.length, "no nested single-emission page to use as a control").toBeGreaterThan(0);
  const controls = [nested[0], nested[nested.length - 1]];

  for (const route of subjects) {
    const bare = await request.get(route);
    expect(bare.status(), `${route} (bare) did not 200`).toBe(200);
    expect(
      slugOf(await bare.text()),
      `${route} (bare) served the FOLDER copy. Production serves ${route.slice(1)}.html here — ` +
        `the harness is testing a document production does not serve at this url.`,
    ).toBe(route.slice(1));

    // The other half of production's rule, and the half a whole-table `rewrites` config gets
    // wrong: the slash form is a different document and must stay the folder copy.
    const slash = await request.get(`${route}/`);
    expect(slash.status(), `${route}/ did not 200`).toBe(200);
    expect(
      slugOf(await slash.text()),
      `${route}/ served the FLAT file — production serves the folder copy at the slash form`,
    ).toBe(`${route.slice(1)}/index`);

    // Reachability, stated separately because it was the sharper half of the defect: under
    // `serve` the flat document could not be fetched at ANY spelling.
    const explicit = await request.get(`${route}.html`);
    expect(
      slugOf(await explicit.text()),
      `${route}.html does not reach the flat document (followed ${explicit.url()})`,
    ).toBe(route.slice(1));
  }

  // THE CONTROL. A route the rewrite layer does not name must behave exactly as it did before —
  // this is what bounds the change to the routes it is about.
  for (const route of controls) {
    const r = await request.get(route);
    expect(r.status(), `${route} (control) did not 200`).toBe(200);
    expect(slugOf(await r.text()), `${route} (control) resolved to something else`).toBe(
      route.slice(1),
    );
  }
});

test("@curated the block the folder copy lacks is served at the canonical url", async ({
  browser,
}) => {
  // The consequence, not the mechanism: the flat document carries `#page-graph-data` and the
  // folder clone does not, so a bare-route journey under `serve` was reading a page with the
  // block missing. Asserted through a real navigation (JS off — the app would rewrite the DOM),
  // because `request.get` proves the server and this proves what a browser lands on.
  const { dupes } = inventory();
  const withBlock = dupes.find(
    (r) =>
      fs.readFileSync(path.join(PUBLIC, `${r.slice(1)}.html`), "utf8").includes('id="page-graph-data"') &&
      !fs
        .readFileSync(path.join(PUBLIC, r.slice(1), "index.html"), "utf8")
        .includes('id="page-graph-data"'),
  );
  expect(
    withBlock,
    "no duplicated route where only the flat file carries #page-graph-data — the differential " +
      "this test is about no longer exists in the build; re-derive it before deleting the test",
  ).toBeTruthy();

  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(withBlock!, { waitUntil: "domcontentloaded" });
  expect(await p.evaluate(() => document.body.dataset.slug)).toBe(withBlock!.slice(1));
  await expect(p.locator("#page-graph-data")).toHaveCount(1);
  await ctx.close();
});
