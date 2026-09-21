import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

const source = JSON.parse(readFileSync(resolve(__dirname, "../../content/Learning/Training Intensity.json"), "utf8"));
const related = JSON.parse(readFileSync(resolve(__dirname, "../../content/Learning/Training Partner Diversity.json"), "utf8"));
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

for (const width of [1440, 390]) {
  test(`Learning native disclosures work without JavaScript at ${width}px @curated`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width, height: 900 } });
    try {
      const page = await context.newPage();
      await page.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL!).origin
        ? route.continue() : route.abort());
      const j = journey(page); // Mouse hit-testing only: do not boot the app or install its routes.
      await page.goto("/Learning/Training-Intensity", { waitUntil: "load" });
      const reader = page.locator("article .learning-reader");
      await expect(reader).toBeVisible();
      await expect(page.locator("h1").first()).toContainText(source.display_title);
      expect(await page.evaluate(() => document.documentElement.dataset.variant)).toBeUndefined();

      // A stylesheet failure produces an apparently spacious, unstyled page. Prove the actual
      // Learning style and Quartz grid are applied before trusting visibility or geometry.
      const style = await reader.evaluate(el => ({
        maxWidth: getComputedStyle(el).maxWidth,
        lineHeight: parseFloat(getComputedStyle(el).lineHeight),
        fontSize: parseFloat(getComputedStyle(el).fontSize),
        grid: getComputedStyle(document.querySelector("#quartz-body")!).display,
      }));
      expect(style.maxWidth).not.toBe("none");
      expect(style.lineHeight / style.fontSize).toBeGreaterThan(1.6);
      expect(style.grid).toBe("grid");

      await expect(reader.locator("details[open]")).toHaveCount(0);
      await expect(reader.locator("#key-takeaways > ul > li:visible")).toHaveCount(3);
      await expect(reader.locator("#applications > .learning-example:visible")).toHaveCount(2);
      await expect(reader.locator("#mistakes > .learning-example:visible")).toHaveCount(2);
      await expect(reader.locator("#exercises > .learning-exercise:visible")).toHaveCount(1);
      await expect(reader.locator("#applications > details .learning-example")).toBeHidden();
      await expect(reader.locator("#exercises > details .learning-exercise")).toBeHidden();

      // The built static article must retain the complete authored prose even inside closed
      // disclosures. This reads the article DOM, not the source JSON-LD or an app fixture.
      const prose = normalize((await reader.textContent()) || "");
      const authored = [
        source.summary, source.overview, ...source.key_takeaways,
        ...source.bjj_applications.flatMap((item: any) => [item.scenario, item.application, item.outcome]),
        ...source.common_mistakes.flatMap((item: any) => [item.mistake, item.consequence, item.correction]),
        ...source.training_exercises.flatMap((item: any) => [item.name, item.description, item.focus]),
        ...source.knowledge_assessment.flatMap((item: any) => [item.question, item.answer]),
      ];
      for (const text of authored) expect(prose).toContain(normalize(text));

      const points = "#key-takeaways > details > summary";
      await page.locator(points).scrollIntoViewIfNeeded();
      await j.clickByMouse(points);
      await expect(reader.locator("#key-takeaways li:visible")).toHaveCount(source.key_takeaways.length);
      await expect(reader.locator("#applications .learning-example:visible")).toHaveCount(2);
      await page.locator(points).focus();
      await page.keyboard.press("Enter");
      await expect(reader.locator("#key-takeaways li:visible")).toHaveCount(3);
      await page.keyboard.press("Space");
      await expect(reader.locator("#key-takeaways li:visible")).toHaveCount(source.key_takeaways.length);

      for (const section of ["applications", "mistakes", "exercises"]) {
        const summary = `#${section} > details > summary`;
        await page.locator(summary).scrollIntoViewIfNeeded();
        await j.clickByMouse(summary);
        await expect(reader.locator(`#${section} > details`)).toHaveAttribute("open", "");
      }
      await expect(reader.locator("#applications .learning-example:visible")).toHaveCount(source.bjj_applications.length);
      await expect(reader.locator("#mistakes .learning-example:visible")).toHaveCount(source.common_mistakes.length);
      await expect(reader.locator("#exercises .learning-exercise:visible")).toHaveCount(source.training_exercises.length);

      const answer = reader.locator("#self-assessment details > p").first();
      await expect(answer).toBeHidden();
      const question = reader.locator("#self-assessment details > summary").first();
      // Focus on an offscreen summary starts Quartz's CSS smooth scroll. Bring it into view
      // first so the next native disclosure interaction does not race that ongoing scroll.
      await question.scrollIntoViewIfNeeded();
      await question.focus();
      await page.keyboard.press("Enter");
      await expect(answer).toBeVisible();
      await expect(answer).toHaveText(source.knowledge_assessment[0].answer);

      const citation = reader.getByRole("link", { name: source.references[0].title, exact: true });
      await expect(citation).toBeHidden();
      await page.locator("#sources > summary").scrollIntoViewIfNeeded();
      await j.clickByMouse("#sources > summary");
      await expect(citation).toBeVisible();
      await expect(citation).toHaveAttribute("href", source.references[0].url);
      await expect(reader.locator("#sources")).toContainText(source.references[0].author);

      await page.locator("#techniques > summary").scrollIntoViewIfNeeded();
      await j.clickByMouse("#techniques > summary");
      await expect(reader.locator("#techniques a")).toHaveCount(2);
      await expect(reader.locator("#techniques a").first()).toBeVisible();

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      expect(await reader.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

      // An actual related-page navigation proves these are usable static links with JavaScript
      // disabled. The reader-facing title changes while the established URL stays intact.
      const next = reader.locator('#related a[href$="/Learning/Training-Partner-Diversity"]');
      await expect(next).toHaveText(related.display_title);
      await next.scrollIntoViewIfNeeded();
      await j.clickByMouse('#related a[href$="/Learning/Training-Partner-Diversity"]');
      await expect(page).toHaveURL(url => url.pathname === "/Learning/Training-Partner-Diversity");
      await expect(page.locator("article .learning-reader")).toBeVisible();
      await expect(page.locator("h1").first()).toContainText(related.display_title);
    } finally {
      await context.close();
    }
  });
}
