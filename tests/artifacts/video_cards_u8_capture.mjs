// Owner review specimens, not a full-app layout assertion. Run under the shared
// browser/build lock, against this worktree's server:
// U8_BASE_URL=http://127.0.0.1:<private-port> node tests/artifacts/video_cards_u8_capture.mjs
// No image viewing is required. Geometry and captions accompany the WebPs.
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const out = process.env.U8_OUTPUT || "/home/user/bjj-orchestrator/reports/u8r2";
const base = process.env.U8_BASE_URL;
if (!base) throw Error("U8_BASE_URL must name this worktree's private server");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const captions = {}, geometry = [];
try {
  let page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const served = await page.request.get(new URL("/static/neural/app/neural.js", base).href);
  const digest = bytes => createHash("sha256").update(bytes).digest("hex");
  const bundleHash = digest(readFileSync(resolve(root, "source/public/static/neural/app/neural.js")));
  if (!served.ok() || digest(await served.body()) !== bundleHash) throw Error("The server is not serving this worktree's bundle");
  const css = readFileSync(resolve(root, "neural/dist/neural.css"), "utf8");
  const stylesheetHash = digest(css);
  const servedCSS = await page.request.get(new URL("/static/neural/app/neural.css", base).href);
  if (!servedCSS.ok() || digest(await servedCSS.body()) !== stylesheetHash)
    throw Error("The server is not serving this worktree's current stylesheet");
  await page.waitForFunction(() => window.__neural?.nodes?.length);
  await page.evaluate(() => {
    const a = window.__neural, mount = a.nodes.find(n => n.posId === "mount" && n.role === "top");
    if (!mount) throw Error("Mount Top missing");
    a.rollFromPosition(mount.idx, true, "top");
    a.setPaused(true);
    a._handTouched = true;
  });
  await page.waitForFunction(() => window.__neural?._landFilmEl?.querySelector("[data-current-film-win]"));
  const cards = await page.evaluate(async () => {
    const a = window.__neural;
    a.currentWinView = () => ({ text: "65%", stale: false, handId: "u8-review-specimen" });
    a._paintCurrentFilmWin();
    const own = a._optionCards.filter(c => !c.opt.threat);
    const chosen = [own.find(c => c.node.t === "Consolidate Mount"),
      own.find(c => c.node.ty === "submissions"),
      ...own.filter(c => c.node.ty === "transitions" && c.node.t !== "Consolidate Mount")].filter(Boolean).slice(0, 5);
    if (chosen.length !== 5) throw Error("Five distinct own choices required");
    const views = [
      { immediate: "58%", value: "65%" }, { immediate: "28%", value: "72%" },
      { immediate: "36%", value: "8%" }, { immediate: "54%", value: "64–66%" },
      { immediate: "—", value: "—" },
    ];
    for (const c of chosen) {
      await a._hydrateContent(c.card._choiceTarget.key);
      a._queueChoiceMedia(c.card, c.card._choiceTarget, a._choiceHandId);
    }
    while (a._choiceMediaActive > 0) await new Promise(r => setTimeout(r, 20));
    return {
      current: a._landFilmEl.outerHTML,
      choices: chosen.map((c, i) => {
        const card = c.card.cloneNode(true), value = card.querySelector("[data-choice-value]");
        value.innerHTML = a.choiceStatsHTML({ status: "ready",
          immediateLabel: c.node.ty === "submissions" ? "Works" : "Move", ...views[i] });
        card.querySelector("[data-choice-recommended]").textContent = "";
        return card.outerHTML;
      }),
    };
  });
  if (!cards.choices.some(c => c.includes('data-choice-front="approved"'))) throw Error("No approved video front captured");
  const posters = new Map();
  for (const match of (cards.current + cards.choices.join("")).matchAll(/src="(https:\/\/i\.ytimg\.com\/vi\/[^"]+)"/g)) {
    if (posters.has(match[1])) continue;
    const response = await page.request.get(match[1], { timeout: 30000 });
    if (!response.ok()) throw Error("Poster fetch failed: " + response.status());
    posters.set(match[1], "data:image/jpeg;base64," + (await response.body()).toString("base64"));
  }
  const local = html => html.replace(/src="(https:\/\/i\.ytimg\.com\/vi\/[^"]+)"/g,
    (_, url) => 'src="' + posters.get(url) + '"').replace(/loading="lazy"/g, 'loading="eager"');
  const specimen = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${css}
html,body{height:auto!important;min-height:100%;overflow:visible!important;margin:0;background:#f1f3f7;color:#192238;font:14px Arial,sans-serif}
*{box-sizing:border-box}body.dark{background:#101524;color:#edf1f8}
.review-header{height:52px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #9ba8be}
.review-header span{font-size:11px}main{max-width:1134px;margin:auto;padding:20px 16px}
.current-zone{display:flex;justify-content:center;align-items:center;gap:60px;padding-right:52px}
.current-zone .ng-landfilm{position:relative!important;left:auto!important;top:auto!important;bottom:auto!important;transform:none!important;width:400px!important;flex:none}
.practice{position:relative;width:390px;height:236px;padding:16px;border:1px solid #45536e;border-radius:12px;background:#181e2e;color:#edf1f8;flex:none}
.practice small{color:#9cacc7}.practice p{font-size:14px;font-weight:600;margin:10px 0}
.practice button{display:block;width:100%;min-height:44px;margin:6px 0;background:#242c40;color:#d3dcec;border:1px solid #485570;border-radius:7px;font:12px Arial;text-align:left;padding:8px}
.practice .arrow{position:absolute;top:96px;width:44px;height:44px;padding:0;text-align:center;background:none;border:0;color:#8a9fbd;font-size:24px}
.practice .prev{left:-52px}.practice .next{right:-52px}
.hand-head{font-size:16px;margin:20px 0 12px}.rail{display:flex;gap:9px;overflow:auto;padding:3px 0 12px;scrollbar-width:none}
.review-note{max-width:850px;font-size:12px;line-height:1.7;margin:20px auto}
.ng-current-title{margin:0!important}.ng-landfilm .ng-cliprow{width:100%}
.current-zone [data-film-close],.current-zone .ng-film-arrow{display:none}
body.left .ng-choice-stat+.ng-choice-stat,body.left .ng-current-stat{text-align:left}
@media(max-width:700px){main{padding:14px 16px}.review-header{padding:0 16px}.review-header span{font-size:10px}
.current-zone{flex-direction:column;gap:12px;padding:0}.current-zone .ng-landfilm{width:358px!important;max-width:100%}
.practice{width:286px;max-width:calc(100vw - 104px);height:236px;padding:12px}.practice p{font-size:13px}.practice button{font-size:11px}
.hand-head{margin-top:16px}.review-note{font-size:11px;margin:8px auto}}
</style>
<header class="review-header"><b>Video cards</b><span id="alignment"></span></header>
<main><div class="current-zone">${local(cards.current)}
<section class="practice"><small>Practice · 1 / 8</small><p>What structural configuration defines the Mount position?</p>
<button>A &nbsp; Chest-to-chest, legs to one side</button><button>B &nbsp; Knee each side, hips centered</button><button>C &nbsp; Sitting on the thighs</button>
<button class="arrow prev" aria-label="Previous question">‹</button><button class="arrow next" aria-label="Next question">›</button></section>
</div><h1 class="hand-head">Your move</h1><div class="rail">${cards.choices.map(local).join("")}</div>
<p class="review-note">Card comparison in the approved A layout · Illustrative odds.</p></main>`;
  writeFileSync(resolve(out, "cards.html"), specimen);
  // Give the static specimens a fresh document/context: setContent alone leaves
  // the live game's animation loop and global handlers running.
  await page.close();
  page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [width, height, theme] of [[1440, 900, "light"], [390, 844, "light"], [1440, 900, "dark"]]) {
    for (const alignment of ["right", "left"]) {
      await page.setViewportSize({ width, height });
      await page.setContent(specimen);
      await page.evaluate(({ theme, alignment }) => {
        document.body.className = theme + " " + alignment;
        document.querySelector("#alignment").textContent = "Win: " + alignment + "-aligned";
      }, { theme, alignment });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map(i => i.decode()));
      });
      const measured = await page.evaluate(() => {
        const rect = el => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
        };
        return {
          media: rect(document.querySelector(".ng-landfilm")), rail: rect(document.querySelector(".rail")),
          cards: [...document.querySelectorAll(".ng-choice-card")].map(rect),
          posters: [...document.images].map(img => {
            const r = img.getBoundingClientRect(), f = img.closest(".ng-clip,.ng-choice-media").getBoundingClientRect();
            return { top: r.top - f.top, bottom: f.bottom - r.bottom, left: r.left - f.left, right: f.right - r.right };
          }),
          winAlignment: [...document.querySelectorAll(".ng-current-stat,.ng-choice-stat:last-child")].map(e => getComputedStyle(e).textAlign),
        };
      });
      if (!measured.posters.length || measured.posters.some(p => Math.abs(p.top - p.bottom) > .5 || Math.abs(p.left - p.right) > .5))
        throw Error("Uncentered poster in owner specimen: " + JSON.stringify(measured.posters));
      if (measured.winAlignment.some(a => a !== alignment)) throw Error("Wrong Win alignment");
      const name = `videos-u8r2-${alignment}-${theme}-${width}x${height}.webp`;
      const encoded = spawnSync("convert", ["png:-", "-quality", "90", resolve(out, name)],
        { input: await page.screenshot(), encoding: null });
      if (encoded.status !== 0) throw Error("WebP export failed: " + encoded.stderr?.toString());
      captions[name] = `U8 round 2 · ${alignment}-aligned Win${alignment === "right" ? " (recommended)" : " (previous alignment)"} · ${width}×${height}, ${theme} review canvas; composed A layout with centered production cards and illustrative odds.`;
      geometry.push({ name, width, height, theme, alignment, ...measured });
    }
  }
  writeFileSync(resolve(out, "captions.json"), JSON.stringify(captions, null, 2) + "\n");
  writeFileSync(resolve(out, "geometry.json"), JSON.stringify(geometry, null, 2) + "\n");
  const provenance = { screens: Object.keys(captions).length, bundleHash, stylesheetHash, imagesViewed: 0, output: out };
  writeFileSync(resolve(out, "provenance.json"), JSON.stringify(provenance, null, 2) + "\n");
  console.log(JSON.stringify(provenance));
} finally {
  await browser.close();
}
