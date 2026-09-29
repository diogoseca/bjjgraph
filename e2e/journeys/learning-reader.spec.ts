import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

// The DSL intentionally serves empty dossier chunks. These journeys override that route
// with explicit fixtures or the real built Learning dossiers; absence cannot satisfy them.
const id = "Learning/Reader-Fixture";
const key = "Reader Fixture|Learning";
const fixture = () => ({
  overview: "Choose the next useful action from the position you actually have.",
  points: ["Find your base.", "Protect the inside space.", "Watch their response.", "Keep a way back."],
  contexts: [1, 2, 3].map(n => ({ c: `Situation ${n}`, how: `Specific action ${n}.`, outcome: `Observable result ${n}.` })),
  errors: [1, 2, 3].map(n => ({ err: `Mistake ${n}`, why: `Consequence ${n}.`, fix: `Correction ${n}.` })),
  drills: [1, 2].map(n => ({ name: `Exercise ${n}`, how: `Start in guard, recover your knee line, then reset ${n}.`, focus: `Notice the space ${n}.` })),
  assessment: [{ question: "What changes your next move?", answer: "The space your partner leaves available." }],
  references: [{ title: "Coach’s notes", author: "Example coach", url: "https://example.com/notes" }],
  relatedReadings: [
    { id: "Learning/Second-Fixture", cat: "Learning", title: "A second decision", url: "/Learning/Second-Fixture" },
    { id: "Systems/Reader-Fixture", cat: "System", title: "A related course", url: "/Systems/Reader-Fixture" },
    { id: "Systems/Second-Reader-Fixture", cat: "System", title: "Another course", url: "/Systems/Second-Reader-Fixture" },
  ],
});
const setup = async (page: Page) => {
  const j = journey(page);
  await j.boot("/");
  await page.route("**/concepts.json", r => r.fulfill({ json: { concepts: [
    { id, key, cat: "Learning", name: "Reader Fixture", title: "A useful decision", summary: "Make room before trying to move.", meta: "Strategy", nodes: ["Positions/Mount"] },
    { id: "Learning/Second-Fixture", key: "Second Fixture|Learning", cat: "Learning", name: "Second Fixture", title: "A second decision", nodes: [] },
  ] } }));
  await page.route("**/systems.json", r => r.fulfill({ json: { systems: [
    { id: "Systems/Reader-Fixture", key: "Reader Fixture|System", name: "Course fixture", nodes: [], products: [] },
  ] } }));
  await page.route("**/static/neural/content/*.json", r => r.fulfill({ json: {
    [key]: fixture(), "Second Fixture|Learning": fixture(), "Reader Fixture|System": { overview: "A related course reference." },
  } }));
  await page.evaluate(async () => { await (window as any).__neural._ensureConcepts(); });
  await page.evaluate(id => (window as any).__neural.openConcept(id), id);
  await expect(page.locator("[data-concept-body]")).toBeVisible();
  return j;
};

for (const width of [1440, 390]) {
  test(`Learning is complete, expandable, and readable at ${width}px @curated`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    const j = await setup(page);
    const body = page.locator("[data-concept-body]");
    await expect(page.locator("[data-concept-detail] h2")).toHaveText("A useful decision");
    await expect(page.locator("[data-concept-page]")).toHaveCount(0);
    await expect(body.locator("[data-doc-points] > li:visible")).toHaveCount(3);
    await expect(body.locator("[data-doc-contexts] > div:visible")).toHaveCount(2);
    await expect(body.locator("[data-doc-errors] > div:visible")).toHaveCount(2);
    await expect(body.locator("[data-doc-drills] > div:visible")).toHaveCount(1);
    await expect(body.locator(".ng-doc-outcome").first()).toHaveText("Observable result 1.");
    const toggle = '[data-concept-disclosure="points"] > summary';
    await page.locator(toggle).scrollIntoViewIfNeeded();
    await j.clickByMouse(toggle);
    await expect(body.locator("[data-doc-points] > li:visible")).toHaveCount(4);
    await expect(body.locator("[data-doc-contexts] > div:visible")).toHaveCount(2);
    await page.locator(toggle).focus();
    await page.keyboard.press("Enter");
    await expect(body.locator("[data-doc-points] > li:visible")).toHaveCount(3);
    await page.keyboard.press("Space");
    await expect(body.locator("[data-doc-points] > li:visible")).toHaveCount(4);

    const question = '[data-concept-disclosure="question-0"] > summary';
    await page.locator(question).scrollIntoViewIfNeeded();
    await j.clickByMouse(question);
    await expect(body.getByText("The space your partner leaves available.")).toBeVisible();
    const before = await page.locator(".ng-learning-list").evaluate(el => el.scrollTop);
    await page.evaluate(() => { const a = (window as any).__neural; a._onSystems(); a.setGiMode("nogi"); });
    await expect(page.locator('[data-concept-disclosure="points"]')).toHaveAttribute("open", "");
    await expect(page.locator('[data-concept-disclosure="question-0"]')).toHaveAttribute("open", "");
    expect(await page.locator(".ng-learning-list").evaluate(el => el.scrollTop)).toBeCloseTo(before, 0);
    await expect(page.locator(question)).toBeFocused();

    const sources = '[data-concept-disclosure="sources"] > summary';
    await page.locator(sources).scrollIntoViewIfNeeded();
    await j.clickByMouse(sources);
    await expect(page.getByRole("link", { name: "Coach’s notes" })).toHaveAttribute("href", "https://example.com/notes");
    expect(await body.evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth, font: getComputedStyle(el).fontSize })))
      .toMatchObject({ font: "14px" });
    expect(await page.locator(".ng-learning-list").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await body.locator("p").first().evaluate(el => ({ color: getComputedStyle(el).color, hyphens: getComputedStyle(el).hyphens })))
      .toEqual({ color: "rgb(185, 197, 216)", hyphens: "none" });
    expect(await body.locator("li").first().evaluate(el => getComputedStyle(el).hyphens)).toBe("none");
    expect(await page.evaluate(() => { const a = (window as any).__neural; return { pos: a.currentPos, staged: a._staged, played: !!a._played }; }))
      .toMatchObject({ pos: null, staged: null, played: false });

    const related = '[data-concept-link="Learning/Second-Fixture"]';
    await page.evaluate(() => { (window as any).__readingApp = (window as any).__neural; });
    await page.locator(related).scrollIntoViewIfNeeded();
    await j.clickByMouse(related);
    await expect(page.locator("[data-concept-detail] h2")).toHaveText("A second decision");
    expect(await page.evaluate(() => (window as any).__readingApp === (window as any).__neural)).toBe(true);
    expect(await page.locator(".ng-learning-list").evaluate(el => el.scrollTop)).toBe(0);
    await expect(page.locator("[data-concept-disclosure][open]")).toHaveCount(0);
    const system = '[data-concept-link="Systems/Reader-Fixture"]';
    await page.locator(system).scrollIntoViewIfNeeded();
    await j.clickByMouse(system);
    await expect(page.locator('[data-system-detail="Systems/Reader-Fixture"]')).toBeVisible();
    expect(await page.evaluate(() => (window as any).__readingApp === (window as any).__neural)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("Learning explains a failed load and retries the complete article @curated", async ({ page }) => {
  const j = await setup(page);
  let serve = false;
  let requests = 0;
  await page.route("**/static/neural/content/*.json", r => {
    requests++;
    return serve ? r.fulfill({ json: { [key]: fixture() } }) : r.fulfill({ status: 503, body: "unavailable" });
  });
  await page.evaluate(key => {
    const a = (window as any).__neural;
    delete (window as any).NG_CONTENT.decks[key];
    delete a._contentWaits[key];
    a.renderExplorer();
  }, key);
  await expect(page.locator("[data-concept-retry]")).toBeVisible();
  expect(requests).toBeGreaterThanOrEqual(3);
  await expect(page.locator("[data-concept-loading] [role=status]")).toContainText("could not be loaded");
  serve = true;
  await j.clickByMouse("[data-concept-retry]");
  await expect(page.locator("[data-concept-body]")).toBeVisible();
  await expect(page.locator("[data-concept-loading]")).toHaveCount(0);
  await expect(page.locator("[data-concept-page]")).toHaveCount(0);
});

for (const action of ["latest click", "new visit"] as const) {
  test(`delayed related Systems navigation respects the ${action}`, async ({ page }) => {
    const j = await setup(page);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let requests = 0;
    await page.route("**/systems.json", async r => {
      requests++;
      await gate;
      await r.fulfill({ json: { systems: ["Reader-Fixture", "Second-Reader-Fixture"].map(slug => ({
        id: "Systems/" + slug, key: slug + "|System", name: slug, nodes: [], products: [],
      })) } });
    });
    await page.evaluate(() => {
      const a = (window as any).__neural;
      a._systemsWait = null; a.systems = []; a._systemsById = {};
    });
    const first = '[data-concept-link="Systems/Reader-Fixture"]';
    await page.locator(first).scrollIntoViewIfNeeded();
    await j.clickByMouse(first);
    await expect.poll(() => requests).toBe(1);
    if (action === "latest click") {
      const second = '[data-concept-link="Systems/Second-Reader-Fixture"]';
      await page.locator(second).scrollIntoViewIfNeeded();
      await j.clickByMouse(second);
    } else {
      const second = '[data-concept-link="Learning/Second-Fixture"]';
      await page.locator(second).scrollIntoViewIfNeeded();
      await j.clickByMouse(second);
      await page.evaluate(id => (window as any).__neural.openConcept(id), id);
    }
    release();
    await page.evaluate(async () => { await (window as any).__neural._systemsWait; });
    if (action === "latest click") {
      await expect(page.locator('[data-system-detail="Systems/Second-Reader-Fixture"]')).toBeVisible();
    } else {
      await expect(page.locator(`[data-concept-detail="${id}"]`)).toBeVisible();
      await expect(page.locator("[data-system-detail]")).toHaveCount(0);
    }
  });
}

test("Learning escapes new reading fields and rejects executable source URLs", async ({ page }) => {
  await setup(page);
  await page.evaluate(key => {
    const a = (window as any).__neural;
    const body = (window as any).NG_CONTENT.decks[key];
    const text = '<img data-xss="yes" src=x onerror="window.learningUnsafe=true">';
    body.contexts[0].outcome = text;
    body.assessment[0].answer = text;
    body.references = [{ title: text, author: text, url: "javascript:window.learningUnsafe=true" }];
    a.renderExplorer();
  }, key);
  await expect(page.locator(".ng-doc-outcome").first()).toContainText("<img data-xss=");
  await expect(page.locator('[data-concept-disclosure="sources"]')).toContainText("<img data-xss=");
  await expect(page.locator('[data-concept-disclosure="sources"] a')).toHaveCount(0);
  await expect(page.locator("[data-xss]")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).learningUnsafe)).toBeUndefined();
});

test("all 26 authored Learning articles are reachable with complete bodies @curated", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await page.route("**/static/neural/content/*.json", r => {
    const name = new URL(r.request().url()).pathname.split("/").pop()!;
    return r.fulfill({ body: readFileSync(resolve(__dirname, "../../source/public/static/neural/content", name)), contentType: "application/json" });
  });
  const catalog = JSON.parse(readFileSync(resolve(__dirname, "../../source/public/static/neural/concepts.json"), "utf8"));
  const learning = catalog.concepts.filter((c: any) => c.cat === "Learning");
  expect(learning).toHaveLength(26);
  expect(catalog._meta.mdOnlyPages.filter((p: string) => p.startsWith("Learning/"))).toEqual([]);
  await page.evaluate(async () => { await (window as any).__neural._ensureConcepts(); });
  for (const c of learning) {
    await page.evaluate(id => (window as any).__neural.openConcept(id), c.id);
    await expect(page.locator("[data-concept-detail] h2")).toHaveText(c.title || c.name);
    await expect(page.locator("[data-concept-body]")).toBeVisible();
    await expect(page.locator("[data-concept-page]")).toHaveCount(0);
    await expect(page).toHaveURL(url => url.pathname === c.url);
    const source = JSON.parse(readFileSync(resolve(__dirname, "../../content/Learning", c.name + ".json"), "utf8"));
    const body = page.locator("[data-concept-body]");
    await expect(body).toContainText(source.overview);
    for (const app of source.bjj_applications) await expect(body).toContainText(app.outcome);
    for (const qa of source.knowledge_assessment || []) await expect(body).toContainText(qa.answer);
  }
  await j.advance(4000);
  expect(await page.evaluate(() => (window as any).__neural.currentPos)).toBe(null);
});

for (const slug of ["BJJ-For-Beginners-Roadmap", "BJJ-Guard-Types-Explained", "BJJ-Position-Hierarchy-Explained"]) {
  test(`existing ${slug} URL opens its Learning entry`, async ({ page }) => {
    const j = journey(page);
    await j.boot("/Learning/" + slug);
    await expect(page.locator(`[data-concept-detail="Learning/${slug}"]`)).toBeVisible();
    await j.advance(4000);
    expect(await page.evaluate(() => (window as any).__neural.currentPos)).toBe(null);
  });
}
