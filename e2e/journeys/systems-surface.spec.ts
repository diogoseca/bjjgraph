import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
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
 * Rails: __neural.systems, ._systemsById, ._focusIdxSet (the fog gate the draw loop reads),
 *        ._systemId, .camTarget
 * Handles: [data-system-row], [data-system-detail], [data-system-node], [data-system-back],
 *          [data-system-courses], [data-system-cta]
 * Beats (PostHog): neural_system_opened, neural_system_course_clicked
 */

type SystemEntry = {
  id: string;
  name: string;
  nodes: string[];
  products: Array<{ name: string; instructor: string; url: string }>;
};

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

/** Open the pane on Explore the way a reader does: the logo, then the tab. */
const openExplore = async (page: Page) => {
  await page.locator(".ng-logo").click();
  await page.locator("[data-view='explore']").click();
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
  await expect(
    page.locator("[data-system-node]"),
    "its members are readable as a list too",
  ).toHaveCount(target.nodes.length);
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
  expect(errors, "no page error across the journey").toEqual([]);
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

  // the system is still fully usable: members lit and readable
  expect(await litIds(page)).toEqual([...target.nodes].sort());
  await expect(page.locator("[data-system-node]")).toHaveCount(
    target.nodes.length,
  );

  // and the way back out is a click, not a reload
  await page.locator("[data-system-back]").click();
  await expect(page.locator("[data-system-row]")).toHaveCount(data._meta.count);
  expect(
    await litIds(page),
    "leaving the detail view drops its highlight",
  ).toBeNull();
  expect(errors, "no page error across the journey").toEqual([]);
});
