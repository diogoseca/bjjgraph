import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

// Small authored fixtures exercise UI contracts without live courses or all 83 guide bodies.
// The DSL still serves the real graph/deck manifest. These tests do NOT certify provider
// playback, the authored corpus, or static-page generation; those are integration checks.
const COURSE = "https://bjjfanatics.com/products/fixture-course";
const CANONICAL_DISCLOSURE = readFileSync(resolve(__dirname, "../../CLAUDE.md"), "utf8")
  .match(/<!-- CANONICAL-DISCLOSURE:START -->([\s\S]*?)<!-- CANONICAL-DISCLOSURE:END -->/)![1].trim();
const product = () => ({ name: "Exact Fixture Course", instructor: "Fixture Instructor", id: "fixture-course", vendor: "bjjfanatics",
  course_url: COURSE, url: COURSE, affiliate: false });
const catalog = () => ({ _meta: { count: 3 }, systems: [
  { id: "Systems/Fixture-Octopus", key: "Fixture Octopus|System", name: "Stable Fixture Octopus System", display_title: "Octopus choices",
    aliases: ["Seated decision study"], type: "Guard System", nodes: ["Positions/Mount"], glue: [], products: [product()], summary: "Compare the advertised scope with your study question." },
  { id: "Systems/Fixture-Alternative", key: "Fixture Alternative|System", name: "Alternative guard", display_title: "Turtle alternative",
    aliases: [], type: "Guard System", nodes: [], glue: [], products: [], summary: "A different starting position." },
  { id: "Systems/Fixture-Passing", key: "Fixture Passing|System", name: "Passing study", display_title: "Passing study",
    aliases: [], type: "Passing System", nodes: [], glue: [], products: [], summary: "Organize your study." },
] });
const body = (): any => ({
  overview: "The official listing describes the course scope; it does not establish effectiveness.",
  guide: {
    kind: "course_companion", display_title: "Octopus choices",
    audience: { fits: ["You want to compare seated-guard options."], consider_alternative_if: ["Choose the turtle guide for a turtle starting point."], prerequisites: ["Recognize the named starting positions."] },
    coverage: { includes: ["Advertised seated-guard topics."], limits: ["The listing does not demonstrate mechanics."] },
    start_here: { title: "Compare the published starting positions", kind: "observation", task: "Read the free contents and write down one question about its starting position.", source_ids: ["listing"] },
    sources: [{ id: "listing", url: COURSE, title: "Official fixture course contents", kind: "official_listing", checked_on: "2026-09-16", note: "Listing scope only; no physical practice instruction inspected." }],
  },
  references: [
    { name: "Turtle alternative", type: "System", url: "/Systems/Fixture-Alternative", relationship: "Compare a turtle starting position with seated guard." },
    { name: "Frames reference", type: "Principle", url: "/Principles/Fixture-Frames", relationship: "Related concept, not a claim about the course syllabus." },
  ],
  points: ["LEGACY REPETITION MUST NOT RENDER"], sequence: [{ phase: "OLD PHASE", detail: "OLD DETAIL" }],
});
const watchErrors = (page: Page) => { const errors: string[] = []; page.on("pageerror", e => errors.push(e.message)); return errors; };
const bootFixtures = async (page: Page, j = journey(page), data = catalog(), dossier = body()) => {
  await j.boot("/");
  // Register after the DSL routes so authored fixtures override its intentionally empty chunks.
  await page.route("**/systems.json", r => r.fulfill({ json: data }));
  await page.route("**/concepts.json", r => r.fulfill({ json: { concepts: [
    { id: "Principles/Fixture-Frames", key: "Fixture Frames|Principle", name: "Frames reference", cat: "Principle", nodes: [] },
  ] } }));
  await page.route("**/static/neural/content/*.json", r => r.fulfill({ json: {
    [data.systems[0].key]: dossier,
    [data.systems[1].key]: { guide: { ...body().guide, display_title: "Turtle alternative", kind: "topic_guide" }, references: [] },
    [data.systems[2].key]: { guide: { ...body().guide, display_title: "Passing study", kind: "topic_guide", sources: [] } },
    "Fixture Frames|Principle": { overview: "Read this principle as a reference." },
  } }));
  await page.evaluate(() => (window as any).__neural._ensureSystems());
  return j;
};
const openFirst = async (page: Page) => { await openExplore(page); await page.locator('[data-system-row="Systems/Fixture-Octopus"]').click(); };
const referenceState = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural;
  return { ref: a._refPage, position: a.currentPos, system: a._systemId,
    lit: a._focusIdxSet ? [...a._focusIdxSet].map((i: any) => a.nodes[i].id).sort() : [] };
});
const openExplore = async (page: Page, expandCategories = true) => {
  await page.locator(".ng-logo").click();
  await page.locator("[data-view='explore']").click();
  const hdr = page.locator('[data-explore-section="Systems"]');
  await expect(hdr).toBeVisible();
  if ((await hdr.getAttribute("aria-expanded")) !== "true") await hdr.click();
  if (expandCategories) {
    for (const category of await page.locator("[data-system-category]").all()) {
      if ((await category.getAttribute("aria-expanded")) !== "true") await category.click();
    }
  }
};

// Compare topic membership against the emitted catalog and exercise real branch controls.
// The DSL serves empty dossier chunks here; this checks tree navigation, not dossier prose.
// Mutation coverage for this journey has not yet been measured.
for (const width of [1440, 390]) {
  test(`Systems topics expand as independent subtrees at ${width}px @curated`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = watchErrors(page);
    const data = catalog();
    const guards = data.systems.filter((s) => s.type === "Guard System");
    expect(guards.length).toBeGreaterThan(0);
    const j = journey(page);
    await bootFixtures(page, j, data);
    await j.land("Mount Top");

    await openExplore(page, false);

    const categories = page.locator("[data-system-category]");
    const rows = page.locator("[data-system-row]");
    const ids = () => rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-system-row")).sort());
    const types = [...new Set(data.systems.map((s) => s.type || "Uncategorized"))].sort();
    expect(await categories.evaluateAll((els) => els.map((e) => e.getAttribute("data-system-category")).sort())).toEqual(types);
    await expect(page.locator("[data-system-filter]")).toHaveCount(0);
    await expect(rows).toHaveCount(0);

    const guardSelector = '[data-system-category="Guard System"]';
    const guard = page.locator(guardSelector);
    await guard.scrollIntoViewIfNeeded();
    await j.clickByMouse(guardSelector);
    await expect(guard).toHaveAttribute("aria-expanded", "true");
    await expect(guard).toContainText(String(guards.length));
    expect(await ids()).toEqual(guards.map((s) => s.id).sort());
    const nestedRows = page.locator('[data-system-children="Guard System"] [data-system-row]');
    await expect(nestedRows).toHaveCount(guards.length);
    const indent = await nestedRows.first().evaluate((el) => {
      const branch = el.closest("[data-system-branch]")!;
      const parent = branch.querySelector("[data-system-category]")!;
      return parseFloat(getComputedStyle(el).paddingLeft) - parseFloat(getComputedStyle(parent).paddingLeft);
    });
    expect(indent, "systems sit one tree level below their topic").toBe(16);
    expect(await nestedRows.evaluateAll((els) => els.every((el) => el.scrollWidth <= el.clientWidth))).toBe(true);

    // Keyboard collapse/reopen stays on the same branch button.
    await page.keyboard.press("Enter");
    await expect(guard).toBeFocused();
    await expect(rows).toHaveCount(0);
    await page.keyboard.press("Space");
    await expect(guard).toHaveAttribute("aria-expanded", "true");
    expect(await ids()).toEqual(guards.map((s) => s.id).sort());

    const targetId = await nestedRows.first().getAttribute("data-system-row");
    await nestedRows.first().scrollIntoViewIfNeeded();
    await j.clickByMouse(`[data-system-row="${targetId}"]`);
    await expect(page.locator(`[data-system-detail="${targetId}"]`)).toBeVisible();
    await j.clickByMouse("[data-system-back]");
    await expect(guard).toHaveAttribute("aria-expanded", "true");
    expect(await ids()).toEqual(guards.map((s) => s.id).sort());

    // A second topic opens alongside the first; folding the parent preserves both choices.
    const secondType = types.find((type) => type !== "Guard System")!;
    const second = page.locator(`[data-system-category="${secondType}"]`);
    await second.scrollIntoViewIfNeeded();
    await j.clickByMouse(`[data-system-category="${secondType}"]`);
    await expect(guard).toHaveAttribute("aria-expanded", "true");
    await expect(second).toHaveAttribute("aria-expanded", "true");
    const expected = data.systems.filter((s) => ["Guard System", secondType].includes(s.type)).map((s) => s.id).sort();
    expect(await ids()).toEqual(expected);
    const header = page.locator('[data-explore-section="Systems"]');
    await header.click();
    await expect(categories).toHaveCount(0);
    await expect(rows).toHaveCount(0);
    await header.click();
    expect(await ids()).toEqual(expected);
    await expect(guard).toHaveAttribute("aria-expanded", "true");
    await expect(second).toHaveAttribute("aria-expanded", "true");
    expect(errors).toEqual([]);
  });
}


test("guide gives authorship, fit, a free action, supported detail and working comparisons @curated", async ({ page }) => {
  const errors = watchErrors(page);
  const j = await bootFixtures(page);
  await openFirst(page);
  await expect(page.locator("[data-system-detail] h2")).toHaveText("Octopus choices");
  await expect(page.locator("[data-system-attribution]")).toContainText("Independent guide by BJJGraph");
  await expect(page.locator("[data-system-detail]")).toContainText("Exact Fixture Course — Fixture Instructor");
  await expect(page.locator("[data-system-fit]")).toContainText("Choose the turtle guide");
  await expect(page.locator("[data-system-start]")).toContainText("Read the free contents and write down one question");
  await expect(page.locator("[data-system-start] a")).toHaveAttribute("href", COURSE);
  await expect(page.locator("[data-system-coverage]")).toContainText("does not demonstrate mechanics");
  await expect(page.locator('[data-system-source="listing"]')).toContainText("Checked 2026-09-16");
  await expect(page.locator('[data-system-source="listing"]')).toContainText("Listing scope only");
  await expect(page.locator(".ng-learning-list")).not.toContainText("LEGACY REPETITION");
  await expect(page.locator("[data-system-sequence]")).toHaveCount(0);
  await expect(page.locator("[data-system-courses]")).toHaveCount(1);
  await expect(page.locator("[data-system-drill]")).toHaveText("Review related technique cards");
  await expect(page.locator(".ng-system-recall")).toContainText("not evidence of practical mastery");
  expect(await referenceState(page)).toMatchObject({ ref: true, position: null, lit: ["Positions/Mount"] });
  const alternative = '[data-system-reference="Systems/Fixture-Alternative"]';
  await page.locator(alternative).scrollIntoViewIfNeeded();
  await j.clickByMouse(alternative);
  await expect(page.locator('[data-system-detail="Systems/Fixture-Alternative"]')).toBeVisible();
  await expect(page).toHaveURL(/Systems\/Fixture-Alternative/);
  expect(await referenceState(page)).toMatchObject({ ref: true, position: null });
  await page.locator("[data-system-back]").click();
  await page.locator('[data-system-row="Systems/Fixture-Octopus"]').click();
  const principle = page.locator('[data-system-reference="Principles/Fixture-Frames"]');
  await principle.focus(); await page.keyboard.press("Enter");
  await expect(page.locator('[data-concept-detail="Principles/Fixture-Frames"]')).toBeVisible();
  await expect(page).toHaveURL(/Principles\/Fixture-Frames/);
  expect(await referenceState(page)).toMatchObject({ ref: true, position: null });
  expect(errors).toEqual([]);
});

test("Explore searches stable names, display titles, aliases, instructors and courses without a roll @curated", async ({ page }) => {
  await bootFixtures(page); await openExplore(page);
  for (const query of ["Stable Fixture Octopus", "Octopus choices", "Seated decision study", "Fixture Instructor", "Exact Fixture Course"]) {
    await page.locator(".ng-explorer-search input").fill(query);
    const row = page.locator('[data-system-row="Systems/Fixture-Octopus"]');
    await expect(row).toHaveCount(1); await expect(row).toContainText("Octopus choices");
    await row.focus(); await page.keyboard.press("Enter");
    await expect(page.locator("[data-system-detail] h2")).toHaveText("Octopus choices");
    expect(await referenceState(page)).toMatchObject({ ref: true, position: null });
    await page.locator("[data-system-back]").click();
    await expect(page.locator(".ng-explorer-search input")).toHaveValue("");
  }
});

for (const mode of ["canonical", "legacy-placeholder", "legacy-ref-placeholder", "flagged-placeholder", "invalid-ref", "encoded-placeholder", "unsupported-vendor", "unconfigured-real-ref", "active"] as const) {
  test(`course reference handles ${mode} without false affiliate claims`, async ({ page, context }) => {
    const data = catalog(), p = data.systems[0].products[0];
    if (mode.includes("placeholder")) p.url = COURSE + (mode === "legacy-ref-placeholder" ? "?ref=REPLACE_ME" : "?rfsn=REPLACE_ME");
    if (mode.startsWith("legacy")) { delete (p as any).course_url; delete (p as any).affiliate; }
    if (["active", "unconfigured-real-ref"].includes(mode)) p.url = COURSE + "?rfsn=123456.test";
    if (mode === "invalid-ref") p.url = COURSE + "?rfsn=bad%20value";
    if (mode === "encoded-placeholder") p.url = COURSE + "?rfsn=%52EPLACE_ME";
    if (mode === "unsupported-vendor") { p.course_url = "https://official.example/course"; p.url = p.course_url + "?rfsn=123456.test"; }
    if (["active", "flagged-placeholder", "invalid-ref", "encoded-placeholder", "unsupported-vendor"].includes(mode)) p.affiliate = true;
    await context.route("**/bjjfanatics.com/**", r => r.abort());
    const j = await bootFixtures(page, journey(page), data); await openFirst(page);
    const link = page.locator("[data-system-cta]");
    await expect(link).toHaveCount(1);
    const href = new URL((await link.getAttribute("href"))!);
    expect(href.href).not.toContain("REPLACE_ME");
    if (mode === "active") {
      await expect(link).toHaveAttribute("data-affiliate", "true");
      await expect(link).toHaveAttribute("rel", "sponsored nofollow noopener");
      await expect(page.locator("[data-affiliate-disclosure]")).toHaveText(CANONICAL_DISCLOSURE);
      expect(href.searchParams.get("rfsn")).toBe("123456.test");
      expect(href.searchParams.get("utm_source")).toBe("bjjgraph");
      expect(href.searchParams.get("utm_medium")).toBe("affiliate");
      expect(href.searchParams.get("utm_content")).toBe("fixture-octopus");
      await link.scrollIntoViewIfNeeded();
      const near = await link.evaluate(a => {
        const d = a.closest("[data-system-courses]")!.querySelector("[data-affiliate-disclosure]")!;
        return { before: !!(d.compareDocumentPosition(a) & 4), gap: a.getBoundingClientRect().top - d.getBoundingClientRect().bottom,
          font: parseFloat(getComputedStyle(d).fontSize) };
      });
      expect(near.before).toBe(true); expect(near.gap).toBeLessThan(40); expect(near.font).toBeGreaterThanOrEqual(11);
      await page.evaluate(() => {
        (window as any).__caps = [];
        (window as any).posthog = { capture: (event: any, props: any) => (window as any).__caps.push({ event, props }) };
      });
      await j.clickByMouse("[data-system-cta]");
      const events = await page.evaluate(() => (window as any).__caps);
      expect(events).toContainEqual(expect.objectContaining({ event: "neural_system_course_clicked", props: expect.objectContaining({ course: p.name, placement: "overview" }) }));
      expect(events).toContainEqual(expect.objectContaining({ event: "affiliate_clickout", props: expect.objectContaining({ product_id: p.id, placement: "overview" }) }));
    } else {
      expect(href.href).toBe(mode === "unsupported-vendor" ? p.course_url : COURSE);
      await expect(page.locator('[data-affiliate="true"]')).toHaveCount(0);
      await expect(page.locator("[data-affiliate-disclosure]")).toHaveCount(0);
      await expect(page.locator("[data-system-courses]")).not.toContainText("commission");
    }
  });
}

test("deferred guide survives stale 200 and 502, with one neutral reference while loading @curated", async ({ page }) => {
  await bootFixtures(page);
  let release!: () => void; const held = new Promise<void>(r => release = r); let attempts = 0;
  await page.route("**/static/neural/content/*.json", async r => {
    attempts++;
    if (attempts === 1) { await held; return r.fulfill({ json: {} }); }
    if (attempts === 2) return r.fulfill({ status: 502, body: "retry" });
    return r.fulfill({ json: { "Fixture Octopus|System": body() } });
  });
  await openFirst(page);
  try {
    await expect.poll(() => attempts).toBe(1);
    await expect(page.locator("[data-system-loading]")).toContainText("Loading guide");
    await expect(page.locator("[data-system-loading] a")).toHaveAttribute("href", "/Systems/Fixture-Octopus");
    await expect(page.locator("[data-system-courses]")).toHaveCount(1);
    await expect(page.locator("[data-system-cta]")).toHaveAttribute("href", COURSE);
    await expect(page.locator("[data-affiliate-disclosure]")).toHaveCount(0);
  } finally { release(); }
  await expect(page.locator("[data-system-start]")).toBeVisible();
  expect(attempts).toBe(3);
  await expect(page.locator("[data-system-courses]")).toHaveCount(1);
});

test("exhausted deferred guide has a real-pointer retry and remains usable", async ({ page }) => {
  const j = await bootFixtures(page); let fail = true, attempts = 0;
  await page.route("**/static/neural/content/*.json", r => { attempts++; return r.fulfill(fail ? { status: 502, body: "retry" } : { json: { "Fixture Octopus|System": body() } }); });
  await openFirst(page);
  await expect(page.locator("[data-system-retry]")).toBeVisible();
  expect(attempts).toBeGreaterThan(1); expect(attempts).toBeLessThanOrEqual(5);
  await expect(page.locator("[data-system-loading]")).toContainText("could not be loaded");
  fail = false;
  await page.locator("[data-system-retry]").scrollIntoViewIfNeeded(); await j.clickByMouse("[data-system-retry]");
  await expect(page.locator("[data-system-start]")).toBeVisible();
});

test("legacy cached bodies remain readable; no course is invented for a topic guide", async ({ page }) => {
  const data = catalog(); data.systems[0].products = [];
  delete (data.systems[0] as any).display_title;
  await bootFixtures(page, journey(page), data, { overview: "Legacy readable overview", points: ["A cached study note"], sequence: [{ phase: "Compare", detail: "Read the source" }] });
  await openFirst(page);
  await expect(page.locator("[data-system-detail] h2")).toHaveText(data.systems[0].name);
  await expect(page.locator("[data-system-body]")).toContainText("Legacy readable overview");
  await expect(page.locator("[data-system-sequence]")).toContainText("Compare");
  await expect(page.locator("[data-system-courses]")).toHaveCount(0);
  await expect(page.locator("[data-system-attribution]")).toBeVisible();
});

for (const provider of ["bunny", "youtube"] as const) {
  for (const verified of [false, true]) {
    test(`${provider} sample is ${verified ? "click-to-load" : "link-only"} and stops on navigation`, async ({ page }) => {
      const dossier = body();
      dossier.guide.preview = { provider, embed_url: provider === "bunny" ?
        "https://iframe.mediadelivery.net/embed/123456/11111111-1111-1111-1111-111111111111?autoplay=true&preload=true&responsive=true" :
        "https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1", title: "Official fixture sample", kind: "sample", source_id: "listing",
        checked_on: "2026-09-16", content_reviewed: false, playback_verified_on: [] };
      const j = await bootFixtures(page, journey(page), catalog(), dossier);
      // This is a synthetic origin fixture, not a claim that a real provider played video.
      if (verified) dossier.guide.preview.playback_verified_on = [new URL(page.url()).origin];
      let requests = 0;
      await page.route(/https:\/\/(iframe\.mediadelivery\.net|www\.youtube-nocookie\.com)\//, r => {
        requests++; return r.fulfill({ contentType: "text/html", body: "<p>Synthetic player fixture, not playback verification.</p>" });
      });
      await openFirst(page);
      await expect(page.locator("[data-system-preview] a")).toHaveAttribute("href", COURSE);
      await expect(page.locator("[data-system-preview-review]")).toContainText("BJJGraph has not reviewed this preview’s instructional content");
      await expect(page.locator("[data-system-player]")).toHaveCount(0); expect(requests).toBe(0);
      const load = page.locator("[data-system-preview-load]");
      if (!verified) { await expect(load).toHaveCount(0); return; }
      await load.scrollIntoViewIfNeeded();
      if (provider === "bunny") await j.clickByMouse("[data-system-preview-load]");
      else { await load.focus(); await page.keyboard.press("Enter"); }
      await expect(page.locator("[data-system-player]")).toHaveCount(1); await expect.poll(() => requests).toBe(1);
      await expect(page.locator("[data-system-player]")).toHaveAttribute("title", "Official fixture sample");
      await expect(page.locator("[data-system-player]")).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      const url = new URL((await page.locator("[data-system-player]").getAttribute("src"))!);
      expect(url.searchParams.get("autoplay")).toBe(provider === "bunny" ? "false" : "0");
      if (provider === "bunny") {
        expect(url.searchParams.get("preload")).toBe("false");
        expect(url.searchParams.get("responsive"), "preserve official player parameters").toBe("true");
      }
      await expect(load).toBeDisabled(); await expect(page.locator("[data-system-preview] a")).toBeVisible();
      await page.locator('[data-system-reference="Systems/Fixture-Alternative"]').click();
      await expect(page.locator('[data-system-detail="Systems/Fixture-Alternative"]')).toBeVisible();
      await expect(page.locator("[data-system-player]")).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).__neural._systemPlayer)).toBeNull();
    });
  }
}

for (const rejected of ["host", "provider", "origin"]) {
  test(`preview rejects wrong ${rejected} while retaining the official fallback`, async ({ page }) => {
    const dossier = body(); dossier.guide.preview = { provider: rejected === "provider" ? "arbitrary" : "bunny",
      embed_url: "https://" + (rejected === "host" ? "iframe.mediadelivery.net.attacker.invalid" : "iframe.mediadelivery.net") + "/embed/123/11111111-1111-1111-1111-111111111111",
      source_id: "listing", title: "Official sample", playback_verified_on: [] };
    await bootFixtures(page, journey(page), catalog(), dossier);
    dossier.guide.preview.playback_verified_on = [rejected === "origin" ? "https://bjjgraph.org" : new URL(page.url()).origin];
    await openFirst(page);
    await expect(page.locator("[data-system-preview] a")).toHaveAttribute("href", COURSE);
    await expect(page.locator("[data-system-preview-load]")).toHaveCount(0);
    await expect(page.locator("[data-system-player]")).toHaveCount(0);
  });
}

test("related-card review keeps the existing session behavior", async ({ page }) => {
  const j = await bootFixtures(page); await openFirst(page);
  await page.locator("[data-system-drill]").scrollIntoViewIfNeeded();
  await j.clickByMouse("[data-system-drill]");
  const session = await page.evaluate(() => {
    const a = (window as any).__neural; return { bucket: a._session.bucket, keys: a._session.keys, position: a.currentPos };
  });
  expect(session.bucket).toBe("system:Systems/Fixture-Octopus");
  expect(session.keys.length).toBeGreaterThan(0); expect(session.position).toBeNull();
});


for (const legacy of [false, true]) {
  test(`course card ${legacy ? "retains legacy notes" : "omits guidance already in the guide"}`, async ({ page }) => {
    const data = catalog(), dossier = body();
    Object.assign(data.systems[0].products[0], {
      blurb: "Course scope note", best_for: "Audience fit note", study_focus: "Study focus note", practice_tip: "Practice note",
    });
    await bootFixtures(page, journey(page), data, legacy ? { overview: "Legacy overview" } : dossier);
    await openFirst(page);
    await expect(page.locator(legacy ? "[data-system-body]" : "[data-system-start]")).toBeVisible();
    const card = page.locator("[data-system-courses]");
    await expect(card).toContainText("Exact Fixture Course"); await expect(card).toContainText("Fixture Instructor");
    await expect(card.locator("[data-system-cta]")).toHaveCount(1);
    await expect(card.locator(".ng-system-course-note")).toHaveCount(legacy ? 1 : 0);
    if (legacy) { await expect(card).toContainText("Course scope note"); await expect(card).toContainText("Audience fit note"); }
    else for (const text of ["Course scope note", "Audience fit note", "Study focus note", "Practice note"]) await expect(card).not.toContainText(text);
  });
}
