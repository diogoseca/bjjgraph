import { expect, test, type Page } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * SYSTEMS — the affiliate surface, inside the app.
 *
 * A System exists to send a reader to the BJJ Fanatics course taught by the instructor whose
 * game they just studied. The Neural app is 100% of default traffic, and until this phase it
 * never mentioned one: the Explore tree carried SIX hardcoded search shortcuts, so 47 authored
 * systems (and every product in them) were reachable only from the static site.
 *
 * The law, in one line: every authored system is listed, selecting one LIGHTS its member nodes
 * on the graph, the highlight dies with the view that lit it, and a course link is rendered
 * ONLY when a course was authored.
 *
 * Payload contract — source/quartz/static/neural/systems.json, emitted by
 * scripts/regenerate_neural_data.py: `_meta.count` + `systems[].{id,name,nodes,products}`.
 * Every expected count is read FROM that payload: a literal here would just re-encode the bug
 * (six shortcuts passes any hand-written number you pick).
 *
 * COMPLIANCE, gated here rather than trusted: the affiliate disclosure is a legal claim (FTC 16
 * CFR 255, UK ASA/CAP) rendered from TWO hand-maintained copies — the app shelf and the generated
 * page — so both are compared against the single authored sentence in CLAUDE.md section 7 AND
 * asserted to render ABOVE their link, in the same block, uncollapsed, on screen. Its offline
 * twin is scripts/check_affiliate_surface.py.
 *
 * And only a HUMAN-VERIFIED link may render at all: content/Systems/*.json carries
 * link_status/link_checked, only "live" survives into the payload and the page, and a system whose
 * product is dead or unchecked degrades to the free study surface instead of a dead CTA.
 *
 * AND THE SYSTEM'S OWN WORDS (v1.155.3). Every authored System carries ~20KB of prose — an
 * overview, its key principles, the components it is built from, the obstacles, the mistakes, how
 * to train it, how to know it is working — 145,746 words across the 47, of which the app read
 * exactly two fields. The body now rides the same on-demand chunk a node dossier does, keyed
 * "<Name>|System" (`systems[].key`), and the last test here is that it reaches the panel EVEN IF
 * THE FIRST REQUEST FOR IT FAILS: `_hydrateContent` used to fold a 502 and a 404 into one `null`
 * and cache it for the session, so a single dropped request cost the reader the page with no
 * error anywhere.
 *
 * Rails: __neural.systems, ._systemsById, ._focusIdxSet (the fog gate the draw loop reads),
 *        ._systemId, .camTarget, window.NG_CONTENT.decks (the chunk cache the panel draws from)
 * Handles: [data-system-row], [data-system-detail], [data-system-node], [data-system-family],
 *          [data-system-back],
 *          [data-system-courses], [data-system-cta], [data-affiliate-disclosure],
 *          [data-system-body] + [data-doc-*], p.affiliate-disclosure + a[data-affiliate="true"]
 *          (page), #study-this-system
 * Beats (PostHog): neural_system_opened, neural_system_course_clicked, affiliate_clickout
 *
 * NON-KILLS, recorded so nobody reads this spec as covering them (CLAUDE.md section 6.3):
 *  · nothing here asserts the CAPS in _system_body. Every cap sits at or above the authored
 *    maximum today, so a wrong cap would cut prose no assertion counts.
 *  · the retry claim covers a stale 200 and a TRANSPORT failure (502). A 404 is still an answer
 *    and is still cached permanently, deliberately — deleting that branch would not turn this red.
 *  · nothing here bounds the number of retries — only that they happen. Raising `NG_CHUNK_TRIES`
 *    to 50, or deleting `_docRetried`'s stamp so the forced re-read fires on every render, both
 *    SURVIVE this journey (the second was measured, not assumed). What that stamp protects — a
 *    panel that refetches on every paint — has no journey.
 */

type GlueEntry = { ref: string; nodes: string[]; role?: string; fam?: number };

type SystemEntry = {
  id: string;
  key: string;
  name: string;
  nodes: string[];
  glue: GlueEntry[];
  products: Array<{
    name: string;
    instructor: string;
    url: string;
    id: string;
    vendor: string;
  }>;
};

/** The panel's row plan, mirroring renderSystemDetail: one row per authored reference, families
 *  collapsed, and FIRST REFERENCE WINS for a node two refs both claim (a synonym pair such as
 *  "Knee Slice Pass" / "Knee Cut Pass"). Recomputing it here is legitimate only because the
 *  assertions below also pin the expanded set against `target.nodes` — the app's own answer. */
function rowPlan(s: SystemEntry): {
  fams: Array<{ ref: string; nodes: string[] }>;
  loose: number;
} {
  const seen = new Set<string>();
  const fams: Array<{ ref: string; nodes: string[] }> = [];
  let loose = 0;
  for (const g of s.glue) {
    const kids = g.nodes.filter((n) => !seen.has(n));
    if (!kids.length) continue;
    for (const n of kids) seen.add(n);
    if (g.fam && kids.length > 1) fams.push({ ref: g.ref, nodes: kids });
    else loose += kids.length;
  }
  return { fams, loose };
}

// The SERVED copy is what the app fetches; the emitted copy is what the build will serve next.
// Reading either keeps the spec honest before a build has copied the payload across.
const PAYLOAD_PATHS = [
  "../../source/public/static/neural/systems.json",
  "../../source/quartz/static/neural/systems.json",
];
let PAYLOAD: { _meta: { count: number }; systems: SystemEntry[] } | null = null;
const payload = () => {
  if (!PAYLOAD) {
    for (const rel of PAYLOAD_PATHS) {
      try {
        PAYLOAD = JSON.parse(readFileSync(resolve(__dirname, rel), "utf8"));
        break;
      } catch {
        /* next candidate */
      }
    }
    if (!PAYLOAD)
      throw new Error(
        "systems.json is not emitted — run `npm run regenerate:neural`",
      );
  }
  return PAYLOAD;
};

/** The CANONICAL disclosure sentence, read from its single authored home. Hardcoding it here
 *  would just add a fourth copy of a legal claim — the whole failure mode being guarded. */
const CANONICAL_DISCLOSURE = (() => {
  const doc = readFileSync(
    resolve(__dirname, "../../CLAUDE.md"),
    "utf8",
  );
  const m = doc.match(
    /<!-- CANONICAL-DISCLOSURE:START -->([\s\S]*?)<!-- CANONICAL-DISCLOSURE:END -->/,
  );
  if (!m)
    throw new Error(
      "CLAUDE.md lost its CANONICAL-DISCLOSURE block (section 7 — the owner deleted docs/Affiliate.md deliberately: public repo) — that block is the source of truth for both rendered copies",
    );
  return m[1].trim();
})();

/** A course link may only exist for an authored http(s) product — the app filters on exactly
 *  this, because a placeholder rendered as a CTA is a dead promise to a paying reader. */
const courses = (s: SystemEntry) =>
  (s.products || []).filter(
    (p) => p && typeof p.url === "string" && /^https?:\/\//i.test(p.url),
  );

/** Graph ids of the nodes currently lit — the canvas has no DOM, so the fog gate the draw loop
 *  reads (_focusIdxSet) is the seam, mapped back to payload ids so the assertion stays in the
 *  payload's own vocabulary. */
const litIds = (page: Page): Promise<string[] | null> =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    const set = a._focusIdxSet;
    return set
      ? Array.from(set)
          .map((i: any) => a.nodes[i].id)
          .sort()
      : null;
  });

/** A lit graph or a rendered CTA is worthless if the app threw on the way there. */
const watchErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
};

/** systems.json is a DEFERRED payload (v1.80.4): 324KB that only the Explore tab and the system
 *  buckets read, so boot does not fetch it and there is deliberately no idle warm (an idle
 *  callback fires before a hand exists, which put it straight back on the first-paint bill).
 *  Asking for it here is what the first reader does. A timeout still means what it always meant:
 *  the SERVED site is missing systems.json, or serves a bundle that never asks for it. */
const awaitSystems = async (page: Page) => {
  await page.evaluate(() => (window as any).__neural._ensureSystems())
  return expect
    .poll(() => page.evaluate(() => !!(window as any).__neural.systems), {
      timeout: 20_000,
      message:
        "systems.json reached the app (needs `npm run regenerate:neural` + a build so source/public serves both the payload and a bundle that fetches it)",
    })
    .toBe(true);
};

/** WHAT THE HARNESS DOES NOT SERVE, named beside the assertions that need it (CLAUDE.md 6.4).
 *  `dsl.ts` fulfils EVERY per-node dossier chunk with `{}` on purpose, so journeys run without
 *  authored content — which would make "the system body is absent" a statement about the DSL and
 *  not about the app. This journey is about that body, so it serves the real chunk for a SYSTEM
 *  key and leaves every other chunk exactly as the DSL had it.
 *
 *  The chunk is identified by READING the emitted files and looking for a key the payload names —
 *  never by recomputing fnv1a32 here, which would be a second implementation of the addressing
 *  scheme under test (6.3).
 *
 *  `hobbleFirst` is the second half of the claim, and it is TWO different misses on purpose,
 *  because the app has two different repairs and one of them alone would leave the other
 *  untested (CLAUDE.md 6.3):
 *    1. the first request for that key's chunk is answered `{}` — a clean 200 that simply does not
 *       carry the key. That is what a STALE cached copy looks like, and `_hydrateContent` is right
 *       to treat it as an answer; only `_docBody`'s one forced re-read gets past it.
 *    2. the second is answered 502 — a transport failure, which `_docBody` has already spent its
 *       one retry on; only `_hydrateContent`'s classification (a 5xx is not an answer) gets past
 *       THAT.
 *  Serve real content from the third on. Both repairs are therefore load-bearing for this journey
 *  and removing either one turns it red. `seen` is returned so the spec proves both stages
 *  actually happened rather than assuming them.
 *
 *  Registered AFTER boot() so it sits above the DSL's own handler (Playwright matches last-first);
 *  nothing fetches a system chunk before a row is clicked. */
const serveSystemChunks = async (page: Page, hobbleFirst?: string) => {
  const keys = new Set(payload().systems.map((s) => s.key));
  const roots = [
    "../../source/public/static/neural/content",
    "../../source/quartz/static/neural/content",
  ];
  const seen = { empty: 0, failed: 0, served: 0 };
  await page.route("**/static/neural/content/*.json", (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop()!;
    for (const root of roots) {
      try {
        const raw = readFileSync(resolve(__dirname, root, name), "utf8");
        const map = JSON.parse(raw);
        if (!Object.keys(map).some((k) => keys.has(k))) break;
        if (hobbleFirst && map[hobbleFirst]) {
          if (!seen.empty) {
            seen.empty++;
            return r.fulfill({ body: "{}", contentType: "application/json" });
          }
          if (!seen.failed) {
            seen.failed++;
            return r.fulfill({
              status: 502,
              contentType: "text/plain",
              body: "bad gateway",
            });
          }
        }
        seen.served++;
        return r.fulfill({ body: raw, contentType: "application/json" });
      } catch {
        /* next root */
      }
    }
    return r.fulfill({ body: "{}", contentType: "application/json" }); // the DSL's default
  });
  return seen;
};

/** Open the pane on Explore the way a reader does: the logo, then the tab — then expand
 *  the Systems section, which (like every Explore section) defaults COLLAPSED since
 *  v1.99.3 (explore-sections.spec.ts owns that contract). */
const openExplore = async (page: Page) => {
  await page.locator(".ng-logo").click();
  await page.locator("[data-view='explore']").click();
  const hdr = page.locator('[data-explore-section="Systems"]');
  await expect(hdr).toBeVisible();
  if ((await hdr.getAttribute("aria-expanded")) !== "true") await hdr.click();
};

test("Explore lists every authored system and selecting one lights its members @curated", async ({
  page,
}) => {
  const errors = watchErrors(page);
  const data = payload();
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await awaitSystems(page);

  await openExplore(page);

  const rows = page.locator("[data-system-row]");
  await expect(
    rows,
    "the whole authored library is listed, not a hand-picked shortlist",
  ).toHaveCount(data._meta.count);
  expect(
    await rows.evaluateAll((els) =>
      els.map((e) => e.getAttribute("data-system-row")).sort(),
    ),
    "and it is the real library — every emitted system id has a row",
  ).toEqual(data.systems.map((s) => s.id).sort());

  // the widest system makes the strongest fog claim; picked from the payload, never named here
  const target = [...data.systems].sort(
    (a, b) => b.nodes.length - a.nodes.length,
  )[0];
  await page.locator(`[data-system-row="${target.id}"]`).click();

  await expect(
    page.locator(`[data-system-detail="${target.id}"]`),
  ).toBeVisible();
  // a System is a page: opening it pushes its own path (owner: "clicking items in the explore
  // should change the url"), and the Explore-root search row steps aside while it owns the pane
  await expect(page, "opening a system pushes its page path").toHaveURL(
    new RegExp("/" + target.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\?|$)"),
  );
  await expect(
    page.locator(".ng-explorer-tools"),
    "no search row while a system owns the pane",
  ).toBeHidden();
  // ONE ROW PER AUTHORED REFERENCE. A ref naming a submission family ("Calf Slicer") expands to
  // every "from X" finish, so listing one row per NODE turned one authored word into eleven
  // near-identical rows — the owner's report. Membership is untouched (a System is not exhaustive
  // on positions, and v1.151.0's attempt to filter it deleted `Inside Heel Hook` from the Craig
  // Jones Leg Lock System); the collapse is presentational, and this is what pins it.
  const { fams, loose } = rowPlan(target);
  await expect(
    page.locator("[data-system-family]"),
    "each family reference is ONE row, not one row per variant",
  ).toHaveCount(fams.length);
  await expect(
    page.locator("[data-system-node]"),
    "collapsed families contribute no node rows until opened",
  ).toHaveCount(loose);
  const widest = [...fams].sort((a, b) => b.nodes.length - a.nodes.length)[0];
  expect(
    await page
      .locator(`[data-system-family="${widest.ref}"] .ng-system-variants`)
      .innerText(),
    "the collapsed row says how many variants it stands for",
  ).toContain(`${widest.nodes.length} variants`);

  // expanding every family reveals exactly the member set — nothing was dropped to achieve the
  // collapse, which is the failure mode the reverted v1.151.0 filter actually shipped
  for (const g of fams) {
    await page.locator(`[data-system-family="${g.ref}"]`).click();
  }
  await expect(
    page.locator("[data-system-node]"),
    "every member is still reachable once the families are open",
  ).toHaveCount(target.nodes.length);
  expect(
    await page
      .locator("[data-system-node]")
      .evaluateAll((els) =>
        els.map((e) => e.getAttribute("data-system-node")).sort(),
      ),
    "and they are exactly the published members",
  ).toEqual([...target.nodes].sort());
  for (const g of fams) {
    await page.locator(`[data-system-family="${g.ref}"]`).click();
  }
  await expect(
    page.locator("[data-system-node]"),
    "collapsing again removes them from the DOM, so 'collapsed' is checkable",
  ).toHaveCount(loose);
  expect(
    await litIds(page),
    "exactly this system's published members are lit — none dropped, none extra",
  ).toEqual([...target.nodes].sort());

  const fog = await page.evaluate((memberIds: string[]) => {
    const a = (window as any).__neural;
    const set = a._focusIdxSet;
    const idxs = Array.from(set) as number[];
    const xs = idxs.map((i) => a.nodes[i].x);
    const ys = idxs.map((i) => a.nodes[i].y);
    const outsider = a.nodes.find((n: any) => memberIds.indexOf(n.id) < 0);
    return {
      armed: !!(set && set.size),
      pathDim: !!a._pathDim,
      dimsNonMember: !!(outsider && !set.has(outsider.idx)),
      framesMembers:
        !!a.camTarget &&
        a.camTarget.cx >= Math.min(...xs) &&
        a.camTarget.cx <= Math.max(...xs) &&
        a.camTarget.cy >= Math.min(...ys) &&
        a.camTarget.cy <= Math.max(...ys),
    };
  }, target.nodes);
  expect(fog.armed, "the fog gate is armed").toBe(true);
  expect(
    fog.pathDim,
    "and armed by the selection itself — the path view is not what dimmed the graph",
  ).toBe(false);
  expect(fog.dimsNonMember, "a non-member is left out of the lit set").toBe(
    true,
  );
  expect(fog.framesMembers, "the camera flies to the lit members").toBe(true);

  // frames actually draw with the set armed — a highlight that dies on the next tick is no
  // highlight, and the draw loop is where the fog rule is spent
  await j.advance(1200);
  expect(
    await litIds(page),
    "the highlight survives the frames that draw it",
  ).toEqual([...target.nodes].sort());
  expect(errors, "no page error across the journey").toEqual([]);
});

test("the highlight dies with the view that lit it", async ({ page }) => {
  const errors = watchErrors(page);
  const data = payload();
  const first = data.systems[0];
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await awaitSystems(page);

  await openExplore(page);
  await page.locator(`[data-system-row="${first.id}"]`).click();
  expect(await litIds(page)).toEqual([...first.nodes].sort());

  // close the pane the way the user does
  await page.locator(".ng-explorer-close").click();
  expect(
    await litIds(page),
    "closing the pane leaves no lit graph the user can no longer see a selection for",
  ).toBeNull();
  expect(
    await page.evaluate(() => !!(window as any).__neural.paused),
    "and the pane law still holds — the roll it stopped resumes",
  ).toBe(false);

  // reopening lands on the list, not on a detail view whose highlight has already gone
  await page.locator(".ng-logo").click();
  await expect(page.locator("[data-system-detail]")).toHaveCount(0);
  await expect(page.locator("[data-system-row]")).toHaveCount(data._meta.count);

  // leaving Explore for another tab drops it too: Challenges' own curriculum fog must never
  // fight a stale System selection for the same graph
  await page.locator(`[data-system-row="${first.id}"]`).click();
  expect(await litIds(page)).toEqual([...first.nodes].sort());
  await page.locator("[data-view='challenges']").click();
  expect(
    await litIds(page),
    "switching tabs drops the highlight the other tab lit",
  ).toBeNull();
  expect(errors, "no page error across the journey").toEqual([]);
});

test("a system with an authored course offers a sponsored BJJ Fanatics link that reports the click", async ({
  page,
  context,
}) => {
  const errors = watchErrors(page);
  const data = payload();
  const stocked = data.systems.filter((s) => courses(s).length);
  expect(
    stocked.length,
    "the payload carries at least one authored course — this is the revenue surface",
  ).toBeGreaterThan(0);
  const target = stocked[0];
  const products = courses(target);

  // HERMETIC belt: the CTA is a real target=_blank anchor, so a click genuinely reaches for
  // bjjfanatics.com. A CONTEXT route (page routes are not inherited) also covers the popup.
  await context.route(/bjjfanatics\.com/, (r) => r.abort());
  context.on("page", (p) => p.close().catch(() => {}));

  const j = journey(page);
  await j.boot("/");
  await awaitSystems(page);

  // track() reports through window.posthog.capture. PostHog never loads in a hermetic run, and
  // the CI build's own snippet would overwrite an init-script stub — so wrap whatever is on
  // window AFTER boot, which is what the click will call. Nothing is forwarded on: a real
  // capture would fire the network request this suite exists without.
  await page.evaluate(() => {
    const w = window as any;
    w.__caps = [];
    w.posthog = Object.assign(w.posthog || {}, {
      capture: (event: string, props: any) => w.__caps.push({ event, props }),
    });
  });

  await openExplore(page);
  await page.locator(`[data-system-row="${target.id}"]`).click();

  const cta = page.locator("[data-system-cta]");
  await expect(page.locator("[data-system-courses]")).toHaveCount(1);
  await expect(cta, "one CTA per authored course").toHaveCount(products.length);
  await expect(cta.first()).toHaveAttribute("target", "_blank");
  const rel = (await cta.first().getAttribute("rel")) || "";
  expect(rel, "affiliate links are disclosed to crawlers").toContain(
    "sponsored",
  );
  expect(rel, "and are not endorsements we pass PageRank to").toContain(
    "nofollow",
  );
  expect(rel, "and never hand the opener to the shop").toContain("noopener");

  const href = (await cta.first().getAttribute("href")) || "";
  const url = new URL(href);
  expect(url.hostname, "the course link goes to BJJ Fanatics").toBe(
    "bjjfanatics.com",
  );
  // verbatim from content/Systems/*.json, never synthesized. Compared path-only because the
  // deploy stamps the real affiliate ref into the query (scripts/apply_affiliate_ref.py).
  expect(url.pathname, "and is the authored product, not a guessed one").toBe(
    new URL(products[0].url).pathname,
  );
  // UTM convention (CLAUDE.md section 7). The app is the DEFAULT variant, so without these
  // the majority of clicks arrive at the vendor indistinguishable from page clicks.
  expect(
    [...url.searchParams.entries()].filter(([k]) => k.startsWith("utm_")),
    "the app tags its clicks with the same campaign convention as the page",
  ).toEqual([
    ["utm_source", "bjjgraph"],
    ["utm_medium", "affiliate"],
    ["utm_campaign", "systems"],
    ["utm_content", target.id.split("/").pop()!.toLowerCase()],
    ["utm_term", products[0].id],
  ]);

  await cta.first().click();

  // selection + click are the pair the affiliate revenue is read from
  const caps = await page.evaluate(() => (window as any).__caps);
  const opened = caps.find((c: any) => c.event === "neural_system_opened");
  expect(opened, "selecting a system is reported").toBeTruthy();
  expect(opened.props).toMatchObject({ system: target.name, has_course: true });
  const clicked = caps.find(
    (c: any) => c.event === "neural_system_course_clicked",
  );
  expect(
    clicked,
    "and so is the click that may earn the commission",
  ).toBeTruthy();
  expect(clicked.props).toMatchObject({
    system: target.name,
    course: products[0].name,
  });
  // FUNNEL STEP 3, from the DEFAULT variant. affiliateTracking.inline.ts delegates this on
  // a[data-affiliate="true"] and it is the one cross-surface conversion event — until v1.83.0
  // the app CTA carried no such attribute, so the documented funnel had no step 3 for 100% of
  // default traffic and every conversion report was measuring the legacy page only.
  const clickout = caps.find((c: any) => c.event === "affiliate_clickout");
  expect(
    clickout,
    "the app reports the documented conversion event, not only its own beat",
  ).toBeTruthy();
  expect(clickout.props).toMatchObject({
    product_id: products[0].id,
    vendor: "bjjfanatics",
    system_slug: `systems/${target.id.split("/").pop()!.toLowerCase()}`,
    system_name: target.name,
    position: 0,
  });
  expect(errors, "no page error across the journey").toEqual([]);
});

test("the app discloses the commission immediately above the link it applies to @curated", async ({
  page,
  context,
}) => {
  // FTC 16 CFR 255 / UK ASA-CAP: clear, conspicuous, and CLOSE TO THE LINK. terms.md is the
  // backstop, not the disclosure — so proximity is asserted in the RENDERED DOM, and the wording
  // is compared against its single authored home (CLAUDE.md section 7) so the two hand-maintained
  // copies cannot drift apart unnoticed.
  const errors = watchErrors(page);
  const data = payload();
  const target = data.systems.filter((s) => courses(s).length)[0];
  await context.route(/bjjfanatics\.com/, (r) => r.abort());

  const j = journey(page);
  await j.boot("/");
  await awaitSystems(page);
  await openExplore(page);
  await page.locator(`[data-system-row="${target.id}"]`).click();

  const disc = page.locator("[data-affiliate-disclosure]");
  await expect(disc, "exactly one disclosure on the shelf").toHaveCount(1);
  await expect(
    disc,
    "and it is actually rendered, not display:none or zero-height",
  ).toBeVisible();
  expect(
    (await disc.textContent())?.trim(),
    "wording is byte-identical to CLAUDE.md",
  ).toBe(CANONICAL_DISCLOSURE);

  const geometry = await page.evaluate(() => {
    const d = document.querySelector(
      "[data-affiliate-disclosure]",
    ) as HTMLElement;
    const a = document.querySelector("[data-system-cta]") as HTMLElement;
    if (!d || !a) return null;
    const db = d.getBoundingClientRect(),
      ab = a.getBoundingClientRect();
    return {
      // 4 = DOCUMENT_POSITION_FOLLOWING: the CTA comes after the disclosure in the DOM
      discFirst: !!(d.compareDocumentPosition(a) & 4),
      sameBlock: !!(
        a.closest("[data-system-courses]") &&
        a.closest("[data-system-courses]") ===
          d.closest("[data-system-courses]")
      ),
      collapsed: !!d.closest("details") || !!a.closest("details"),
      gapPx: Math.round(ab.top - db.bottom),
      discHeight: Math.round(db.height),
      // "conspicuous" has a legibility floor: fine print in a dimmer grey than the copy around
      // it is the pattern regulators name. Floor, not a design opinion.
      fontPx: parseFloat(getComputedStyle(d).fontSize),
      opacity: parseFloat(getComputedStyle(d).opacity),
    };
  });
  expect(
    geometry,
    "both the disclosure and a CTA are on screen",
  ).not.toBeNull();
  expect(
    geometry!.discFirst,
    "the disclosure precedes the link it covers",
  ).toBe(true);
  expect(geometry!.sameBlock, "and lives in the same shelf as the link").toBe(
    true,
  );
  expect(
    geometry!.collapsed,
    "neither is inside a <details> — a disclosure the reader must expand is not conspicuous",
  ).toBe(false);
  expect(
    geometry!.discHeight,
    "the disclosure has real rendered height",
  ).toBeGreaterThan(8);
  expect(
    geometry!.gapPx,
    "and sits immediately above the link, not a scroll away",
  ).toBeLessThan(200);
  expect(
    geometry!.fontPx,
    "rendered at readable size, not shrunk into fine print",
  ).toBeGreaterThanOrEqual(11);
  expect(geometry!.opacity, "and not faded out").toBeGreaterThan(0.85);
  expect(errors, "no page error across the journey").toEqual([]);
});

test("the generated system page discloses the commission above its product link @curated", async ({
  page,
  context,
}) => {
  // The same claim on the OTHER surface: CRAWLERS and no-JS readers get this HTML, and it
  // carries its own hand-maintained copy of the sentence. (?variant=legacy is accepted-and-
  // ignored since v1.80.0, so the way to read the static article is the static-article-layout
  // pattern: block the bundle — otherwise the overlay boots and hides the article, and this
  // test only ever passed against a serve root whose bundle failed to boot.)
  const data = payload();
  const target = data.systems.filter((s) => courses(s).length)[0];
  // HERMETIC: the shop and the (placeholder) cover image are the only off-box requests this page
  // makes; a suite that reaches the internet is a suite that fails when the internet does.
  await context.route(/bjjfanatics\.com|placehold\.co/, (r) => r.abort());
  await context.route("**/static/neural/app/neural.js", (r) => r.abort());
  await page.goto(`/${target.id}`);

  const disc = page.locator("p.affiliate-disclosure");
  const link = page.locator('a[data-affiliate="true"]');
  await expect(link, "the page renders the sponsored product link").toHaveCount(
    courses(target).length,
  );
  await expect(disc).toHaveCount(1);
  await expect(disc).toBeVisible();
  expect((await disc.textContent())?.trim()).toBe(CANONICAL_DISCLOSURE);

  const layout = await page.evaluate(() => {
    const d = document.querySelector("p.affiliate-disclosure") as HTMLElement;
    const a = document.querySelector('a[data-affiliate="true"]') as HTMLElement;
    const db = d.getBoundingClientRect(),
      ab = a.getBoundingClientRect();
    return {
      discFirst: !!(d.compareDocumentPosition(a) & 4),
      sameSection: d.closest("section")?.id === a.closest("section")?.id,
      collapsed: !!d.closest("details") || !!a.closest("details"),
      gapPx: Math.round(ab.top - db.bottom),
    };
  });
  expect(layout.discFirst, "disclosure first, then the link").toBe(true);
  expect(layout.sameSection, "both inside #unlock-this-system").toBe(true);
  expect(layout.collapsed, "not collapsed behind a <details>").toBe(false);
  expect(
    layout.gapPx,
    "and within a screen of the link, never scrolled away from it",
  ).toBeLessThan(900);
});

test("a system whose product link was never verified renders no CTA on either surface @curated", async ({
  page,
  context,
}) => {
  // Verified 2026-08-09: two of the three authored products 404. Only link_status:"live"
  // survives into the payload (regenerate_neural_data._products) and onto the page
  // (live_products in templates/Systems.md.jinja2) — a dead CTA earns exactly what no CTA earns
  // and costs the reader's trust, so an empty slot is the honest degradation.
  const dir = resolve(__dirname, "../../content/Systems");
  const unverified = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")))
    .filter((d: any) =>
      (d.products || []).some(
        (p: any) => (p.link_status || "unverified") !== "live",
      ),
    );
  expect(
    unverified.length,
    "there is at least one authored-but-unverified product to guard",
  ).toBeGreaterThan(0);

  const data = payload();
  const bareIds: string[] = [];
  for (const s of unverified) {
    const entry = data.systems.find((e) => e.name === s.name);
    expect(entry, `${s.name}: still listed in the app`).toBeTruthy();
    expect(
      courses(entry!).length,
      `${s.name}: an unverified product must not reach the app payload`,
    ).toBe(0);
    bareIds.push(entry!.id);
  }

  // and its page shows the free study surface instead of an empty region
  await context.route("**/static/neural/app/neural.js", (r) => r.abort()); // static surface = bundle blocked (see above)
  await page.goto(`/${bareIds[0]}`);
  await expect(page.locator('a[data-affiliate="true"]')).toHaveCount(0);
  await expect(page.locator("p.affiliate-disclosure")).toHaveCount(0);
  await expect(
    page.locator("#study-this-system"),
    "the slot is filled with the free next step, not left blank",
  ).toBeVisible();
});

test("a system with no authored course offers no link at all", async ({
  page,
}) => {
  const errors = watchErrors(page);
  const data = payload();
  const bare = data.systems.filter((s) => !courses(s).length);
  expect(
    bare.length,
    "most systems have no product yet — that is the case this guards",
  ).toBeGreaterThan(0);
  const target = bare[0];

  const j = journey(page);
  await j.boot("/");
  await awaitSystems(page);
  await openExplore(page);
  await page.locator(`[data-system-row="${target.id}"]`).click();

  await expect(
    page.locator(`[data-system-detail="${target.id}"]`),
  ).toBeVisible();
  await expect(
    page.locator("[data-system-courses]"),
    "no course shelf without a course",
  ).toHaveCount(0);
  await expect(
    page.locator("[data-system-cta]"),
    "and never a dead CTA",
  ).toHaveCount(0);
  // the pane offers no outbound link whatsoever here — a placeholder or a guessed shop URL
  // would be a broken promise, so the honest surface has nothing to click through to
  await expect(page.locator(".ng-learning-list a")).toHaveCount(0);

  // the system is still fully usable: members lit, and readable as one row per authored ref
  // (families collapse — see the row-count claim in the first journey)
  expect(await litIds(page)).toEqual([...target.nodes].sort());
  const plan = rowPlan(target);
  await expect(page.locator("[data-system-family]")).toHaveCount(plan.fams.length);
  await expect(page.locator("[data-system-node]")).toHaveCount(plan.loose);
  expect(
    plan.fams.reduce((n, f) => n + f.nodes.length, 0) + plan.loose,
    "and between them the rows account for every member",
  ).toBe(target.nodes.length);

  // and the way back out is a click, not a reload
  await page.locator("[data-system-back]").click();
  await expect(page.locator("[data-system-row]")).toHaveCount(data._meta.count);
  expect(
    await litIds(page),
    "leaving the detail view drops its highlight",
  ).toBeNull();
  expect(errors, "no page error across the journey").toEqual([]);
});

test("a system panel reads the system's own words — and one dropped chunk does not cost them @curated", async ({
  page,
}) => {
  const errors = watchErrors(page);
  const data = payload();
  // whichever system sorts first: the claim is about every one of them, and naming a favourite
  // here would be the shortlist bug this whole surface was written against.
  const target = [...data.systems].sort((a, b) => a.id.localeCompare(b.id))[0];
  const j = journey(page);
  await j.boot("/");
  const seen = await serveSystemChunks(page, target.key);
  await j.land("Mount Top");
  await awaitSystems(page);
  await openExplore(page);

  await page.locator(`[data-system-row="${target.id}"]`).click();
  await expect(
    page.locator(`[data-system-detail="${target.id}"]`),
    "the row opens the system",
  ).toBeVisible();

  // THE RETRIES, first: this body's first request came back as a chunk without it (a stale 200)
  // and its second as a 502. Under the cache this replaces, either one was the session's permanent
  // answer and the block below could never arrive.
  const body = page.locator(`[data-system-body="${target.id}"]`);
  await expect(
    body,
    "the system's own words reach the panel even though the first two requests for them did not carry it",
  ).toBeVisible({ timeout: 20_000 });
  expect(
    [seen.empty, seen.failed],
    "and both misses really happened — a stale 200 and a dropped request",
  ).toEqual([1, 1]);

  // WHAT IT DREW, against what the emitter WROTE — read back from the app's own chunk cache
  // rather than recomputed spec-side (6.3). The floors underneath keep that comparison from
  // passing trivially on an empty body.
  const emitted = await page.evaluate((k: string) => {
    const d = (window as any).NG_CONTENT && (window as any).NG_CONTENT.decks;
    const b = d ? d[k] : null;
    return b
      ? {
          overview: String(b.overview || "").length,
          blocks: {
            points: (b.points || []).length,
            contexts: (b.contexts || []).length,
            errors: (b.errors || []).length,
            mistakes: (b.mistakes || []).length,
            drills: (b.drills || []).length,
            metrics: (b.metrics || []).length,
          },
        }
      : null;
  }, target.key);
  expect(emitted, "the panel drew from the chunk the emitter wrote").not.toBeNull();
  expect(
    emitted!.overview,
    "and the overview is authored prose, not a placeholder",
  ).toBeGreaterThan(200);

  const drawn: Record<string, number> = {};
  for (const [block, n] of Object.entries(emitted!.blocks)) {
    const el = body.locator(`[data-doc-${block}]`);
    await expect(
      el,
      `the ${block} block is drawn exactly once when the body carries it`,
    ).toHaveCount(n ? 1 : 0);
    if (!n) continue;
    expect(
      Number(await el.getAttribute(`data-doc-${block}`)),
      `every authored ${block} entry reaches the panel`,
    ).toBe(n);
    await expect(
      el.locator("> li, > dt"),
      `...and each one is a row, not a count`,
    ).toHaveCount(n);
    drawn[block] = n;
  }
  expect(
    Object.keys(drawn).length,
    "a System authors seven blocks; a body that renders one or two is a regression, not a short page",
  ).toBeGreaterThanOrEqual(5);
  expect(
    ((await body.textContent()) || "").trim().length,
    "and the panel is a read, not a title and a shrug",
  ).toBeGreaterThan(1500);

  // the index card and the members still stand: the body is added TO the panel, not instead of it.
  // Members are one row per authored reference (families collapsed), so the claim is against the
  // row plan — and against the LIT set, which is still every member.
  const bodyPlan = rowPlan(target);
  await expect(page.locator("[data-system-family]")).toHaveCount(
    bodyPlan.fams.length,
  );
  await expect(page.locator("[data-system-node]")).toHaveCount(bodyPlan.loose);
  expect(await litIds(page)).toEqual([...target.nodes].sort());
  expect(errors, "no page error across the journey").toEqual([]);
});
