import { expect, test, type Page } from "@playwright/test";
import { journey } from "../dsl";

// Small authored fixtures exercise UI contracts without live courses or all 83 guide bodies.
// The DSL still serves the real graph/deck manifest. These tests do NOT certify provider
// playback, the authored corpus, or static-page generation; those are integration checks.
const COURSE = "https://bjjfanatics.com/products/fixture-course";
const COVER = "https://cdn.shopify.com/s/files/1/fixture-course-cover.png";
const preview = (provider: "bunny" | "youtube" = "bunny") => ({ provider,
  embed_url: provider === "bunny" ? "https://iframe.mediadelivery.net/embed/123456/11111111-1111-1111-1111-111111111111?autoplay=false&preload=false&responsive=true" :
    "https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1",
  title: "Official fixture intro", kind: "trailer", source_id: "listing", checked_on: "2026-09-16",
  content_reviewed: false, playback_verified_on: [] as string[] });
const product = () => ({ name: "Exact Fixture Course", instructor: "Fixture Instructor", id: "fixture-course", vendor: "bjjfanatics",
  course_url: COURSE, url: COURSE, affiliate: false });
const catalog = () => ({ _meta: { count: 3 }, systems: [
  { id: "Systems/Fixture-Octopus", key: "Fixture Octopus|System", name: "Stable Fixture Octopus System", display_title: "Octopus choices",
    aliases: ["Seated decision study"], type: "Guard System", difficulty: "Intermediate", nodes: ["Positions/Mount"], glue: [], products: [product()], summary: "Compare the advertised scope with your study question." },
  { id: "Systems/Fixture-Alternative", key: "Fixture Alternative|System", name: "Alternative guard", display_title: "Turtle alternative",
    aliases: [], type: "Guard System", nodes: [], glue: [], products: [], summary: "A different starting position." },
  { id: "Systems/Fixture-Passing", key: "Fixture Passing|System", name: "Passing study", display_title: "Passing study",
    aliases: [], type: "Passing System", nodes: [], glue: [], products: [], summary: "Organize your study." },
] });
const body = (): any => ({
  overview: "The official listing describes the course scope; it does not establish effectiveness.",
  guide: {
    kind: "course_companion", display_title: "Octopus choices",
    audience: { fits: ["You want to compare seated-guard options."], consider_alternative_if: [], prerequisites: ["Recognize the named starting positions."] },
    coverage: { includes: ["Advertised seated-guard topics."], limits: ["The listing does not demonstrate mechanics."] },
    // Stale cached exercise data is intentionally present to prove it is never shown.
    start_here: { title: "Compare the published starting positions", kind: "observation", task: "Read the free contents and write down one question about its starting position.", source_ids: ["listing"] },
    alternatives: [{ system: "Alternative guard", title: "Turtle alternative", url: "/Systems/Fixture-Alternative", reason: "Choose the turtle guide for a turtle starting point." }],
    sources: [{ id: "listing", url: COURSE, title: "Official fixture course contents", kind: "official_listing", checked_on: "2026-09-16", note: "Listing scope only; no physical practice instruction inspected." }],
  },
  references: [
    { name: "Frames reference", type: "Principle", url: "/Principles/Fixture-Frames", relationship: "Related concept, not a claim about the course syllabus." },
  ],
  points: ["LEGACY REPETITION MUST NOT RENDER"], sequence: [{ phase: "OLD PHASE", detail: "OLD DETAIL" }],
});
const watchErrors = (page: Page) => { const errors: string[] = []; page.on("pageerror", e => errors.push(e.message)); return errors; };
// Synthetic media certifies requests, autoplay configuration and lifecycle, never provider playback.
const stubPreviews = async (page: Page) => {
  const activity = { requests: 0, sdkRequests: 0 };
  await page.route(/https:\/\/(iframe\.mediadelivery\.net|player\.mediadelivery\.net|www\.youtube(?:-nocookie)?\.com)\/embed\//, route => {
    activity.requests++;
    return route.fulfill({ contentType: "text/html", body: "<p>Synthetic official player fixture.</p>" });
  });
  await page.route("https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js", route => {
    activity.sdkRequests++;
    return route.fulfill({ contentType: "application/javascript", body: `
      window.playerjs = { Player: class {
        constructor() { this.callbacks = {}; }
        on(name, callback) {
          this.callbacks[name] = callback;
          if (name === "ready") Promise.resolve().then(() => { if (this.callbacks[name] === callback) callback(); });
        }
        off(name) { delete this.callbacks[name]; }
        destroy() { this.callbacks = {}; }
      } };
    ` });
  });
  await page.evaluate(() => {
    (window as any).__systemYTEvents = [];
    (window as any).YT = { Player: class {
      constructor(_frame: unknown, options: any) {
        (window as any).__systemYTCallbacks = options.events;
        Promise.resolve().then(() => options.events.onReady({ target: this }));
      }
      mute() { (window as any).__systemYTEvents.push("mute"); }
      playVideo() { (window as any).__systemYTEvents.push("play"); }
      destroy() { (window as any).__systemYTEvents.push("destroy"); }
    } };
  });
  return activity;
};
const stubCover = (page: Page) => page.route(COVER, route => route.fulfill({ contentType: "image/svg+xml",
  body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#59406d"/></svg>' }));
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


test("guide gives course identity, fit, evidence and working internal alternatives @curated", async ({ page }) => {
  const errors = watchErrors(page);
  const j = await bootFixtures(page);
  await openFirst(page);
  await expect(page.locator("[data-system-detail] h2")).toHaveText("Octopus choices");
  await expect(page.locator("[data-system-attribution]")).toContainText("Independent guide by BJJGraph");
  await expect(page.locator("[data-system-course-title]")).toHaveText("Exact Fixture Course");
  await expect(page.locator(".ng-system-instructor")).toHaveText("By Fixture Instructor");
  await expect(page.locator("[data-system-alternatives]")).toContainText("Choose the turtle guide");
  await expect(page.locator(".ng-learning-list")).not.toContainText("Read the free contents");
  await expect(page.locator("[data-system-start]")).toHaveCount(0);
  await expect(page.locator("[data-system-coverage]")).toContainText("does not demonstrate mechanics");
  await expect(page.locator('[data-system-source="listing"]')).toContainText("Checked 2026-09-16");
  await expect(page.locator('[data-system-source="listing"]')).toContainText("Listing scope only");
  await expect(page.locator(".ng-learning-list")).not.toContainText("LEGACY REPETITION");
  await expect(page.locator("[data-system-sequence]")).toHaveCount(0);
  await expect(page.locator("[data-system-courses]")).toHaveCount(2);
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
    await expect(page.locator("[data-system-coverage]")).toBeVisible();
    const link = page.locator('[data-course-placement="overview"] [data-system-cta]');
    await expect(link).toHaveCount(1);
    const href = new URL((await link.getAttribute("href"))!);
    expect(href.href).not.toContain("REPLACE_ME");
    await expect(page.locator("[data-affiliate-disclosure]")).toHaveCount(0);
    await expect(page.locator(".ng-learning-list")).not.toContainText("commission");
    if (mode === "active") {
      await expect(link).toHaveAttribute("data-affiliate", "true");
      await expect(link).toHaveAttribute("rel", "sponsored nofollow noopener");
      expect(href.searchParams.get("rfsn")).toBe("123456.test");
      expect(href.searchParams.get("utm_source")).toBe("bjjgraph");
      expect(href.searchParams.get("utm_medium")).toBe("affiliate");
      expect(href.searchParams.get("utm_content")).toBe("fixture-octopus");
      await link.scrollIntoViewIfNeeded();
      await page.evaluate(() => {
        (window as any).__caps = [];
        (window as any).posthog = { capture: (event: any, props: any) => (window as any).__caps.push({ event, props }) };
      });
      await j.clickByMouse('[data-course-placement="overview"] [data-system-cta]');
      const events = await page.evaluate(() => (window as any).__caps);
      expect(events).toContainEqual(expect.objectContaining({ event: "neural_system_course_clicked", props: expect.objectContaining({ course: p.name, placement: "overview" }) }));
      expect(events).toContainEqual(expect.objectContaining({ event: "affiliate_clickout", props: expect.objectContaining({ product_id: p.id, placement: "overview" }) }));
    } else {
      expect(href.href).toBe(mode === "unsupported-vendor" ? p.course_url : COURSE);
      await expect(page.locator('[data-affiliate="true"]')).toHaveCount(0);
      await expect(page.locator("[data-affiliate-disclosure]")).toHaveCount(0);
      await expect(page.locator(".ng-learning-list")).not.toContainText("commission");
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
  await expect(page.locator("[data-system-coverage]")).toBeVisible();
  expect(attempts).toBe(3);
  await expect(page.locator("[data-system-courses]")).toHaveCount(2);
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
  await expect(page.locator("[data-system-coverage]")).toBeVisible();
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
  for (const history of ["none", "production"] as const) {
    test(`${provider} intro mounts with ${history} verification history and stops on navigation`, async ({ page }) => {
      const dossier = body();
      dossier.guide.preview = preview(provider);
      if (history === "production") dossier.guide.preview.playback_verified_on = ["https://bjjgraph.org"];
      const j = await bootFixtures(page, journey(page), catalog(), dossier);
      const activity = await stubPreviews(page);
      await openFirst(page);
      await expect(page.locator("[data-system-coverage]")).toBeVisible();
      await expect(page.locator("[data-system-preview-load]")).toHaveCount(0);
      await expect(page.locator("[data-system-cta]")).toHaveCount(2);
      expect(await page.locator("[data-system-cta]").evaluateAll(links => links.map(a => a.getAttribute("href")))).toEqual([COURSE, COURSE]);
      await expect(page.locator("[data-affiliate-disclosure]")).toHaveCount(0);
      await expect(page.locator("[data-system-sources] [data-system-preview-review]")).toContainText("BJJGraph has not reviewed this preview’s instructional content");
      const player = page.locator("[data-system-player]");
      await expect(player).toHaveCount(1); await expect.poll(() => activity.requests).toBe(1);
      await expect(player).toHaveAttribute("title", "Official fixture intro");
      await expect(player).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      await expect(player).toHaveAttribute("allow", /autoplay/);
      const url = new URL((await player.getAttribute("src"))!);
      expect(url.searchParams.get("autoplay")).toBe(provider === "bunny" ? "true" : "0");
      if (provider === "bunny") {
        for (const key of ["muted", "preload", "playsinline", "responsive"]) expect(url.searchParams.get(key)).toBe("true");
      } else {
        expect(url.searchParams.get("enablejsapi")).toBe("1"); expect(url.searchParams.get("playsinline")).toBe("1");
        await expect.poll(() => page.evaluate(() => (window as any).__systemYTEvents)).toEqual(["mute", "play"]);
        // Autoplay denial keeps the ready player and its native controls usable.
        await page.evaluate(() => (window as any).__systemYTCallbacks.onAutoplayBlocked());
        await expect(player).toBeVisible();
      }
      expect(await player.evaluate(el => !!el.closest(".ng-learning-list"))).toBe(true);
      const alternative = '[data-system-reference="Systems/Fixture-Alternative"]';
      await page.locator(alternative).scrollIntoViewIfNeeded();
      if (provider === "bunny") await j.clickByMouse(alternative);
      else { await page.locator(alternative).focus(); await page.keyboard.press("Enter"); }
      await expect(page.locator('[data-system-detail="Systems/Fixture-Alternative"]')).toBeVisible();
      await expect(player).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).__neural._systemPlayer)).toBeNull();
      if (provider === "youtube") expect(await page.evaluate(() => (window as any).__systemYTEvents)).toEqual(["mute", "play", "destroy"]);
    });
  }
}

for (const width of [1440, 390]) {
  test(`opening a related System starts at the top after scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const j = await bootFixtures(page);
    await openFirst(page);
    const list = page.locator(".ng-learning-list");
    await expect(page.locator("[data-system-coverage]")).toBeVisible();
    await list.hover();
    await page.mouse.wheel(0, 2000);
    await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
    const related = '[data-system-reference="Systems/Fixture-Alternative"]';
    await page.locator(related).scrollIntoViewIfNeeded();
    await j.clickByMouse(related);
    await expect(page.locator('[data-system-detail="Systems/Fixture-Alternative"]')).toBeVisible();
    await expect(page.locator("[data-system-coverage]")).toBeVisible();
    await expect.poll(() => list.evaluate(el => el.scrollTop)).toBe(0);
    const geometry = await list.evaluate(el => {
      const top = el.getBoundingClientRect().top;
      return { back: el.querySelector("[data-system-back]")!.getBoundingClientRect().top - top,
        card: el.querySelector("[data-system-detail]")!.getBoundingClientRect().top - top };
    });
    expect(geometry.back).toBeGreaterThanOrEqual(0);
    expect(geometry.card).toBeGreaterThanOrEqual(0);
  });
}

test("opening a System from scrolled search results starts at the top", async ({ page }) => {
  const data = catalog();
  data.systems[0].name = "ZZ search target";
  data.systems[0].aliases = ["Shared search"];
  for (let i = 0; i < 24; i++) data.systems.push({ ...data.systems[2],
    id: `Systems/Fixture-Search-${i}`, key: `Fixture Search ${i}|System`, name: `Search filler ${i}`,
    display_title: `Search filler ${i}`, aliases: ["Shared search"] });
  const j = await bootFixtures(page, journey(page), data);
  await openExplore(page, false);
  await page.locator(".ng-explorer-search input").fill("Shared search");
  await expect(page.locator("[data-system-row]")).toHaveCount(25);
  const list = page.locator(".ng-learning-list");
  await list.hover();
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  const target = '[data-system-row="Systems/Fixture-Octopus"]';
  await page.locator(target).scrollIntoViewIfNeeded();
  await j.clickByMouse(target);
  await expect(page.locator('[data-system-detail="Systems/Fixture-Octopus"]')).toBeVisible();
  await expect(page.locator("[data-system-coverage]")).toBeVisible();
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBe(0);
  expect(await list.evaluate(el => el.querySelector("[data-system-back]")!.getBoundingClientRect().top - el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
});

test("index preview starts before its guide loads and survives hydration and unrelated renders @curated", async ({ page }) => {
  const data = catalog(), dossier = body();
  dossier.guide.preview = preview();
  (data.systems[0] as any).preview = { ...dossier.guide.preview };
  const j = await bootFixtures(page, journey(page), data, dossier);
  const activity = await stubPreviews(page);
  let release!: () => void, dossierRequests = 0;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/static/neural/content/*.json", async route => {
    dossierRequests++; await held;
    await route.fulfill({ json: { [data.systems[0].key]: dossier } });
  });
  try {
    await openExplore(page);
    await expect(page.locator("[data-system-row]")).toHaveCount(3);
    // Rendering a catalog with preview metadata must not start any video requests.
    await expect(page.locator("[data-system-player]")).toHaveCount(0);
    expect(activity.requests).toBe(0);
    expect(activity.sdkRequests).toBe(0);
    const row = '[data-system-row="Systems/Fixture-Octopus"]';
    await page.locator(row).scrollIntoViewIfNeeded(); await j.clickByMouse(row);
    await expect.poll(() => dossierRequests).toBe(1);
    await expect(page.locator("[data-system-loading]")).toContainText("Loading guide");
    const player = page.locator("[data-system-player]");
    await expect(player).toBeVisible(); await expect.poll(() => activity.requests).toBe(1);
    const original = (await player.elementHandle())!;
    release();
    await expect(page.locator("[data-system-coverage]")).toContainText("Advertised seated-guard topics");
    await expect(page.locator("[data-system-loading]")).toHaveCount(0);
    await expect(page.locator("[data-system-cta]")).toHaveCount(2);
    expect(await original.evaluate(el => el.isConnected && el === document.querySelector("[data-system-player]"))).toBe(true);
    await page.evaluate(() => (window as any).__neural.renderExplorer());
    await expect(page.locator("[data-system-coverage]")).toBeVisible();
    expect(await original.evaluate(el => el.isConnected && el === document.querySelector("[data-system-player]"))).toBe(true);
    expect(activity.requests).toBe(1);
  } finally { release(); }
});

test("cover-only System uses its exact primary course and never requests a video", async ({ page }) => {
  const data = catalog(); Object.assign(data.systems[0].products[0], { image: COVER });
  data.systems[0].products.push({ ...product(), name: "Different course", course_url: COURSE + "-different", url: COURSE + "-different" });
  await bootFixtures(page, journey(page), data);
  const activity = await stubPreviews(page); await stubCover(page);
  await openFirst(page);
  await expect(page.locator("[data-system-coverage]")).toBeVisible();
  const image = page.locator("[data-system-media] img");
  await expect(image).toHaveAttribute("src", COVER); await expect(image).toHaveAttribute("alt", "Exact Fixture Course cover");
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator("[data-system-player], [data-system-preview-load]")).toHaveCount(0);
  await expect(page.locator("[data-system-cta]")).toHaveCount(2);
  expect(await page.locator("[data-system-cta]").evaluateAll(links => links.map(a => a.getAttribute("href")))).toEqual([COURSE, COURSE]);
  await expect(page.locator("[data-system-course-title]")).toHaveText("Exact Fixture Course");
  expect(activity.requests).toBe(0);
});

test("a provider error restores the exact course cover and keeps the course link usable", async ({ page }) => {
  const data = catalog(), dossier = body();
  Object.assign(data.systems[0].products[0], { image: COVER });
  dossier.guide.preview = preview("youtube");
  await bootFixtures(page, journey(page), data, dossier);
  await stubPreviews(page); await stubCover(page);
  await openFirst(page);
  await expect.poll(() => page.evaluate(() => (window as any).__systemYTEvents)).toEqual(["mute", "play"]);
  await expect(page.locator("[data-system-player]")).toBeVisible();
  await page.evaluate(() => (window as any).__systemYTCallbacks.onError({ data: 101 }));
  await expect(page.locator("[data-system-player]")).toHaveCount(0);
  await expect(page.locator("[data-system-preview-fallback] img")).toBeVisible();
  await expect(page.locator("[data-system-preview-fallback] img")).toHaveAttribute("src", COVER);
  await expect(page.locator('[data-course-placement="overview"] [data-system-cta]')).toHaveAttribute("href", COURSE);
  await expect(page.locator("[data-system-cta]")).toHaveCount(2);
  expect(await page.evaluate(() => (window as any).__systemYTEvents)).toEqual(["mute", "play", "destroy"]);
});

for (const exit of ["back", "pane-close", "hidden", "pagehide"] as const) {
  test(`System preview is destroyed on ${exit}`, async ({ page }) => {
    const dossier = body(); dossier.guide.preview = preview();
    const j = await bootFixtures(page, journey(page), catalog(), dossier);
    const activity = await stubPreviews(page);
    await openFirst(page);
    const player = page.locator("[data-system-player]");
    await expect(player).toHaveCount(1); await expect.poll(() => activity.requests).toBe(1);
    const original = (await player.elementHandle())!;
    if (exit === "back") await j.clickByMouse("[data-system-back]");
    else if (exit === "pane-close") await page.keyboard.press("Escape");
    else if (exit === "pagehide") await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
    else await page.evaluate(() => {
      // Model browser tab hiding explicitly; headless focus does not consistently change visibility.
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(player).toHaveCount(0);
    expect(await original.evaluate(el => el.isConnected)).toBe(false);
    expect(await page.evaluate(() => ({ player: (window as any).__neural._systemPlayer, media: (window as any).__neural._systemMedia }))).toEqual({ player: null, media: null });
    expect(activity.requests).toBe(1);
  });
}

test("late Concepts hydration preserves the same System preview until navigation", async ({ page }) => {
  const dossier = body();
  dossier.guide.preview = { provider: "bunny",
    embed_url: "https://iframe.mediadelivery.net/embed/123456/11111111-1111-1111-1111-111111111111?autoplay=false&preload=false",
    source_id: "listing", title: "Official fixture sample", content_reviewed: false, playback_verified_on: [] };
  const j = await bootFixtures(page, journey(page), catalog(), dossier);
  // Synthetic player only; this fixture does not verify provider playback.
  dossier.guide.preview.playback_verified_on = [new URL(page.url()).origin];
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let conceptsRequested = 0;
  const activity = await stubPreviews(page);
  await page.route("**/concepts.json", async route => {
    conceptsRequested++;
    await held;
    await route.fulfill({ json: { concepts: [
      { id: "Principles/Fixture-Frames", key: "Fixture Frames|Principle", name: "Frames reference", cat: "Principle", nodes: [] },
    ] } });
  });
  try {
    await openFirst(page);
    await expect.poll(() => conceptsRequested).toBe(1);
    const player = page.locator("[data-system-player]");
    await expect(player).toHaveCount(1);
    await expect.poll(() => activity.requests).toBe(1);
    const originalPlayer = (await player.elementHandle())!;
    const list = page.locator(".ng-learning-list");
    await list.hover({ position: { x: 10, y: 10 } });
    const beforeWheel = await list.evaluate(el => el.scrollTop);
    await page.mouse.wheel(0, 120);
    await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(beforeWheel);
    // Wait for the wheel event's layout update before releasing the delayed payload.
    const readingScroll = await list.evaluate(el => el.scrollTop);
    release();
    await expect.poll(() => page.evaluate(() => !!(window as any).__neural._conceptsById?.["Principles/Fixture-Frames"])).toBe(true);
    await expect(page.locator('[data-system-detail="Systems/Fixture-Octopus"]')).toBeVisible();
    expect((await referenceState(page)).system).toBe("Systems/Fixture-Octopus");
    await expect(player).toHaveCount(1);
    expect(await originalPlayer.evaluate(el => el.isConnected && el === (window as any).__neural._systemPlayer)).toBe(true);
    expect(await list.evaluate(el => el.scrollTop)).toBe(readingScroll);
    expect(activity.requests).toBe(1);
    // The newly hydrated concept remains navigable, and leaving the System removes its player.
    const principle = '[data-system-reference="Principles/Fixture-Frames"]';
    await page.locator(principle).scrollIntoViewIfNeeded();
    await j.clickByMouse(principle);
    await expect(page.locator('[data-concept-detail="Principles/Fixture-Frames"]')).toBeVisible();
    await expect(player).toHaveCount(0);
    expect(await originalPlayer.evaluate(el => el.isConnected)).toBe(false);
    expect(await page.evaluate(() => (window as any).__neural._systemPlayer)).toBeNull();
  } finally { release(); }
});

for (const rejected of ["host", "provider"]) {
  test(`preview rejects wrong ${rejected} while retaining the exact course cover and CTA`, async ({ page }) => {
    const data = catalog(); Object.assign(data.systems[0].products[0], { image: COVER });
    const dossier = body(); dossier.guide.preview = { provider: rejected === "provider" ? "arbitrary" : "bunny",
      embed_url: "https://" + (rejected === "host" ? "iframe.mediadelivery.net.attacker.invalid" : "iframe.mediadelivery.net") + "/embed/123/11111111-1111-1111-1111-111111111111",
      source_id: "listing", title: "Official sample", playback_verified_on: [] };
    await bootFixtures(page, journey(page), data, dossier);
    const activity = await stubPreviews(page); await stubCover(page);
    await openFirst(page);
    await expect(page.locator("[data-system-coverage]")).toBeVisible();
    await expect(page.locator("[data-system-preview-fallback] img")).toHaveAttribute("src", COVER);
    await expect(page.locator("[data-system-preview-fallback] img")).toBeVisible();
    await expect(page.locator('[data-course-placement="overview"] [data-system-cta]')).toHaveAttribute("href", COURSE);
    await expect(page.locator("[data-system-cta]")).toHaveCount(2);
    await expect(page.locator("[data-system-preview-load]")).toHaveCount(0);
    await expect(page.locator("[data-system-player]")).toHaveCount(0);
    expect(activity.requests).toBe(0);
  });
}

test("related-card review keeps the existing session behavior", async ({ page }) => {
  const j = await bootFixtures(page); await openFirst(page);
  await expect(page.locator("[data-system-coverage]")).toBeVisible();
  await page.locator("[data-system-drill]").scrollIntoViewIfNeeded();
  await j.clickByMouse("[data-system-drill]");
  const session = await page.evaluate(() => {
    const a = (window as any).__neural; return { bucket: a._session.bucket, keys: a._session.keys, position: a.currentPos };
  });
  expect(session.bucket).toBe("system:Systems/Fixture-Octopus");
  expect(session.keys.length).toBeGreaterThan(0); expect(session.position).toBeNull();
});


for (const legacy of [false, true]) {
  test(`course layout excludes rejected study exercises from ${legacy ? "cached bodies" : "guides"}`, async ({ page }) => {
    const data = catalog(), dossier = body();
    Object.assign(data.systems[0].products[0], { blurb: "Duplicated scope note", best_for: "Duplicated audience fit", study_focus: "Invented study focus", practice_tip: "Invented practice task" });
    await bootFixtures(page, journey(page), data, legacy ? { overview: "Legacy overview" } : dossier);
    await openFirst(page);
    await expect(page.locator(legacy ? "[data-system-body]" : "[data-system-coverage]")).toBeVisible();
    const top = page.locator('[data-course-placement="overview"]');
    await expect(top).toContainText("Exact Fixture Course"); await expect(top).toContainText("Fixture Instructor");
    await expect(page.locator("[data-system-cta]")).toHaveCount(2);
    for (const text of ["Duplicated scope note", "Duplicated audience fit", "Invented study focus", "Invented practice task", "Start here", "Course reference"]) await expect(page.locator(".ng-learning-list")).not.toContainText(text);
  });
}

for (const width of [390, 1440]) {
  test(`video-first hierarchy, wrapping chips and Sources last at ${width}px @curated`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const data = catalog();
    data.systems[0].type = "Guard transitions and positional connections";
    data.systems[0].difficulty = "Intermediate to advanced";
    const dossier = body(); dossier.guide.preview = preview();
    (data.systems[0] as any).preview = dossier.guide.preview;
    const j = await bootFixtures(page, journey(page), data, dossier);
    const activity = await stubPreviews(page);
    await openFirst(page);
    await expect(page.locator("[data-system-coverage]")).toBeVisible();
    const list = page.locator(".ng-learning-list");
    await expect(page.locator("[data-system-overview]")).toHaveText("About this course" + body().overview);
    await expect(list).not.toContainText(data.systems[0].summary);
    await expect(list).not.toContainText("Course reference");
    await expect(page.locator("[data-system-start], [data-system-preview-load]")).toHaveCount(0);
    await expect(page.locator("[data-system-player]")).toBeVisible();
    await expect.poll(() => activity.requests).toBe(1);
    await expect(page.locator("[data-system-cta]")).toHaveCount(2);
    await expect(page.locator(".ng-system-chip")).toHaveText([data.systems[0].type, data.systems[0].difficulty!]);
    await expect(page.locator(".ng-system-graph-count")).toHaveText("1 techniques and positions on the graph");
    const result = await list.evaluate(el => {
      const order = ["[data-system-detail]", "[data-system-media]", '[data-course-placement="overview"]', "[data-system-overview]", "[data-system-fit]", "[data-system-alternatives]", "[data-system-coverage]", '[data-course-placement="conclusion"]', "[data-system-references]", "[data-system-drill]", "[data-system-sources]"];
      const title = el.querySelector("h2")!, meta = el.querySelector(".ng-system-meta")!;
      const video = el.querySelector("[data-system-player]")!.getBoundingClientRect();
      const course = el.querySelector('[data-course-placement="overview"]')!.getBoundingClientRect();
      return { ordered: order.every((selector, i) => !i || !!(el.querySelector(order[i - 1])!.compareDocumentPosition(el.querySelector(selector)!) & Node.DOCUMENT_POSITION_FOLLOWING)),
        videoFirst: video.bottom <= course.top, videoWidth: video.width, videoRatio: video.width / video.height,
        last: el.lastElementChild!.hasAttribute("data-system-sources"), font: parseFloat(getComputedStyle(title).fontSize),
        stacked: meta.getBoundingClientRect().top >= title.getBoundingClientRect().bottom,
        chips: Array.from(el.querySelectorAll(".ng-system-chip")).every(chip => parseFloat(getComputedStyle(chip).borderRadius) >= 10 && chip.scrollWidth <= chip.clientWidth && chip.getBoundingClientRect().right <= el.getBoundingClientRect().right),
        overflow: el.scrollWidth > el.clientWidth };
    });
    expect(result).toMatchObject({ ordered: true, last: true, stacked: true, chips: true, overflow: false, videoFirst: true });
    expect(result.videoWidth).toBeGreaterThan(200); expect(result.videoRatio).toBeCloseTo(16 / 9, 1);
    expect(result.font).toBeGreaterThanOrEqual(24);
    await page.locator("[data-system-sources] summary").scrollIntoViewIfNeeded();
    await j.clickByMouse("[data-system-sources] summary");
    await expect(page.locator('[data-system-source="listing"] a')).toBeVisible();
    const summary = page.locator("[data-system-sources] summary");
    expect(await summary.evaluate(el => getComputedStyle(el, "::after").content)).toContain("−");
    await summary.focus(); await page.keyboard.press("Enter");
    await expect(page.locator("[data-system-sources] details")).not.toHaveAttribute("open");
    expect(await summary.evaluate(el => getComputedStyle(el, "::after").content)).toContain("+");
    await page.keyboard.press("Space");
    await expect(page.locator("[data-system-sources] details")).toHaveAttribute("open");
    await expect(page.locator("[data-system-overview] p").first()).toHaveCSS("hyphens", "none");
    await expect(page.locator("[data-system-attribution]")).toHaveCSS("hyphens", "none");
    await expect(page.locator("[data-system-sources] [data-system-attribution]")).toContainText("Independent guide by BJJGraph");
  });
}

for (const state of ["active-topic", "neutral-source-active-product", "placeholder-source"]) {
  test(`source resolver handoff: ${state}`, async ({ page }) => {
    const data = catalog(), dossier = body();
    const blog = "https://bjjfanatics.com/blogs/news/fixture-guide";
    const active = state === "active-topic";
    if (active) { data.systems[0].products = []; dossier.guide.kind = "topic_guide"; }
    if (state === "neutral-source-active-product") Object.assign(data.systems[0].products[0], { url: COURSE + "?rfsn=123456.product", affiliate: true });
    dossier.guide.sources = [
      { id: "blog", title: "Official article", kind: "official_article", canonical_url: blog,
        url: active ? blog + "?rfsn=654321.source&utm_source=bjjgraph&utm_medium=affiliate&utm_campaign=systems" : state === "placeholder-source" ? blog + "?rfsn=REPLACE_ME" : blog,
        affiliate: active || state === "placeholder-source" },
      { id: "independent", title: "Independent source", kind: "official_listing", url: "https://example.org/guide" },
    ];
    const j = await bootFixtures(page, journey(page), data, dossier);
    await openFirst(page);
    await expect(page.locator("[data-system-coverage]")).toBeVisible();
    if (active) {
      await expect(page.locator("[data-system-cta]")).toHaveCount(0);
      await expect(page.locator("[data-system-overview] h3")).toHaveText("About this guide");
    }
    await page.locator("[data-system-sources] summary").scrollIntoViewIfNeeded();
    await j.clickByMouse("[data-system-sources] summary");
    const source = page.locator('[data-system-source="blog"] a');
    await expect(source).toHaveAttribute("href", active ? dossier.guide.sources[0].url : blog);
    await expect(page.locator("[data-affiliate-disclosure]")).toHaveCount(0);
    await expect(page.locator("[data-system-sources]")).not.toContainText("commission");
    if (active) {
      await expect(source).toHaveAttribute("data-affiliate", "true");
      await expect(source).toHaveAttribute("rel", "sponsored nofollow noopener");
    } else await expect(source).not.toHaveAttribute("data-affiliate");
    await expect(page.locator('[data-system-source="independent"] a')).toHaveAttribute("href", "https://example.org/guide");
    await expect(page.locator('[data-system-source="independent"] a')).not.toHaveAttribute("data-affiliate");
  });
}

for (const legacy of [false, true]) {
  test(`${legacy ? "legacy" : "guide"} related cards keep useful relationships without repeated guide disclaimers`, async ({ page }) => {
    const data = catalog();
    data.systems[0].nodes.push("Positions/Side-Control");
    (data.systems[0] as any).glue = [
      { nodes: ["Positions/Mount"], role: "Related position reference; graph linkage does not establish inclusion in the course." },
      { nodes: ["Positions/Side-Control"], role: "Compare the available upper-body controls." },
    ];
    await bootFixtures(page, journey(page), data, legacy ? { overview: "Cached guide overview" } : body());
    await openFirst(page);
    await expect(page.locator(legacy ? "[data-system-body]" : "[data-system-coverage]")).toBeVisible();
    await expect(page.locator(".ng-system-role")).toHaveCount(legacy ? 2 : 1);
    await expect(page.locator('[data-system-node="Positions/Side-Control"]')).toContainText("Compare the available upper-body controls.");
    await expect(page.locator(".ng-system-recall")).toContainText("Related techniques may not be taught in the course.");
  });
}

test("guide stock captions disappear across graph and reference types while authored context and links remain", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const data = catalog();
  data.systems[0].nodes = ["Positions/Mount", "Transitions/Knee-Slice-Pass", "Submissions/Twister/from-Twister-Control", "Positions/Side-Control"];
  (data.systems[0] as any).glue = data.systems[0].nodes.map((id, i) => ({ nodes: [id], role: [
    "Related position: Mount.",
    "Related transition reference for rear-mount escape study.",
    "Twister: related submission study, separate from the source syllabus.",
    "Related endpoint for the standing-from-turtle section in Volume 4.",
  ][i] }));
  const dossier = body();
  const stock = [
    "Related principle on the graph.", "Further conceptual reading: Frames.",
    "Related BJJGraph position.", "Related BJJGraph transition.", "Related BJJGraph submission.",
    "Related transition on the graph.", "Related submission on the graph.",
    "Related transition reference: Knee Slice Pass.", "Related submission reference: Twister.",
    "Related submission reference for leg-entanglement study.",
    "Related principle reference for turtle defense and exits.",
    "Related study guide: Companion.", "Related Systems guide.",
    "Related guide with a separate scope and source list.",
    "Related study guide; its scope should be checked separately from this course.",
    "Companion: related system study, separate from the source syllabus.",
  ];
  const useful = [
    "Related guard reference for comparing the guard-return sections in Volume 4.",
    "Focused companion for the rubber-guard material in this same release.",
    "Related study guide: Companion. This covers the same course; no additional purchase is needed.",
  ];
  dossier.references = [...stock, ...useful].map((relationship, i) => ({
    name: `Editorial reference ${i}`, source_name: `Stable reference ${i}`, type: "System",
    url: "/Systems/Fixture-Alternative", relationship,
  }));
  const j = await bootFixtures(page, journey(page), data, dossier);
  await openFirst(page);
  await expect(page.locator("[data-system-coverage]")).toBeVisible();
  await expect(page.locator("[data-system-node]")).toHaveCount(4);
  await expect(page.locator(".ng-system-role")).toHaveText(["Related endpoint for the standing-from-turtle section in Volume 4."]);
  const references = page.locator("[data-system-references]");
  await expect(references.locator("a")).toHaveCount(stock.length + useful.length);
  await expect(references.locator("p")).toHaveText(useful);
  await expect(references).not.toContainText("Stable reference");
  await expect(page.locator("[data-system-alternatives]")).toContainText("Choose the turtle guide for a turtle starting point.");
  // Caption suppression must leave the actual reference usable through overlay event capture.
  const target = '[data-system-references] a:first-of-type';
  await page.locator(target).scrollIntoViewIfNeeded();
  await j.clickByMouse(target);
  await expect(page.locator('[data-system-detail="Systems/Fixture-Alternative"]')).toBeVisible();
});
