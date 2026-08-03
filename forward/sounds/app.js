import { initCatalogRail } from "../shared/catalog-rail.js";
import { icon } from "../shared/icons.js";
import { renderDevRoutes } from "../shared/routes.js";

const catalog = Array.isArray(globalThis.NG_SOUND_CATALOG)
  ? globalThis.NG_SOUND_CATALOG
  : [];
const SoundEngine = globalThis.NGSound;
const groups = [...new Set(catalog.map((cue) => cue.group))];
const settings = { sound: "on", soundVolume: "0.55" };
const app = document.querySelector("#app");
let engine;
let activeBeat = "";
let activeTimer;

function createEngine() {
  if (typeof SoundEngine !== "function") return null;
  return new SoundEngine({
    isTest: () => false,
    get: (key, fallback) =>
      Object.prototype.hasOwnProperty.call(settings, key)
        ? settings[key]
        : fallback,
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function waveform(beat) {
  let seed = 0;
  for (const character of beat)
    seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  return Array.from({ length: 18 }, (_, index) => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const height = 18 + (seed % 72);
    return `<i style="--bar:${height}%;--delay:${index * 18}ms"></i>`;
  }).join("");
}

function renderCue(cue) {
  return `<article class="sound-cue" data-beat="${escapeHtml(cue.beat)}">
    <div class="sound-signal" aria-hidden="true">${waveform(cue.beat)}</div>
    <div class="sound-copy">
      <div class="sound-cue-meta"><span>${escapeHtml(cue.group)}</span><code>${escapeHtml(cue.beat)}</code><span>${cue.durationMs} ms</span></div>
      <h3>${escapeHtml(cue.label)}</h3>
      <p>${escapeHtml(cue.character)}</p>
      <dl><dt>Trigger</dt><dd>${escapeHtml(cue.context)}</dd></dl>
    </div>
    <button class="sound-preview" type="button" data-preview="${escapeHtml(cue.beat)}" aria-label="Preview ${escapeHtml(cue.label)}">${icon("play", 15)}<span>Preview</span></button>
  </article>`;
}

function renderGroup(group, cues) {
  return `<section class="sound-group" data-group="${escapeHtml(group)}" aria-labelledby="group-${escapeHtml(group.toLowerCase())}">
    <header><div><span class="sound-node" aria-hidden="true"></span><h2 id="group-${escapeHtml(group.toLowerCase())}">${escapeHtml(group)}</h2></div><span>${cues.length} signals</span></header>
    <div>${cues.map(renderCue).join("")}</div>
  </section>`;
}

function setStatus(message, tone = "") {
  const status = app?.querySelector(".sound-status");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function syncActiveCue() {
  app?.querySelectorAll(".sound-cue").forEach((cue) => {
    const active = cue.dataset.beat === activeBeat;
    cue.toggleAttribute("data-playing", active);
    const button = cue.querySelector(".sound-preview");
    if (button) {
      button.innerHTML = active
        ? `${icon("volume", 15)}<span>Playing</span>`
        : `${icon("play", 15)}<span>Preview</span>`;
      button.setAttribute(
        "aria-label",
        `${active ? "Playing" : "Preview"} ${cue.querySelector("h3")?.textContent || "sound"}`,
      );
    }
  });
}

async function playCue(beat) {
  const cue = catalog.find((entry) => entry.beat === beat);
  if (!cue || !engine) return;
  clearTimeout(activeTimer);
  engine.stop();
  const played = await engine.preview(beat);
  if (!played) {
    setStatus(
      "Audio could not start. Check browser audio permissions.",
      "error",
    );
    return;
  }
  activeBeat = beat;
  syncActiveCue();
  setStatus(`Transmitting: ${cue.label}`, "active");
  activeTimer = setTimeout(() => {
    activeBeat = "";
    syncActiveCue();
    setStatus("Signal array ready");
  }, cue.durationMs + 280);
}

function stopPlayback() {
  clearTimeout(activeTimer);
  engine?.stop();
  activeBeat = "";
  syncActiveCue();
  setStatus("Playback stopped");
}

function mount() {
  if (!app) return;
  if (!catalog.length || typeof SoundEngine !== "function") {
    app.innerHTML =
      '<div class="sound-failure"><b>Sound catalog unavailable</b><span>Run the Forward build to copy the production engine.</span></div>';
    return;
  }

  app.innerHTML = `<div class="catalog sound-catalog">
    <header class="catalog-header">
      <a class="catalog-brand" href="/dev/"><span class="catalog-mark sound-mark">${icon("volume", 15)}</span><span>Forward Components <small>BJJGraph</small></span></a>
      <nav class="catalog-routes" aria-label="Development routes">${renderDevRoutes("sounds")}</nav>
      <button class="catalog-rail-toggle" type="button" aria-label="Browse sound groups" aria-controls="catalog-rail" aria-expanded="false">${icon("menu", 17)}<span>Browse sounds</span></button>
      <span class="catalog-version">production engine · dev only</span>
    </header>
    <button class="catalog-rail-backdrop" type="button" aria-label="Close sound browser" tabindex="-1"></button>
    <aside class="catalog-sidebar catalog-rail sound-sidebar" id="catalog-rail" aria-label="Sound groups">
      <div class="catalog-rail-head"><div><b>Sound palette</b><span>${catalog.length} production signals</span></div><button class="catalog-rail-close" type="button" aria-label="Close sound browser">${icon("close", 16)}</button></div>
      <div class="catalog-search"><label>${icon("search", 14)}<input type="search" placeholder="Find a cue or trigger..." aria-label="Filter sounds" /></label></div>
      <div class="catalog-count">${catalog.length} production signals</div>
      <nav class="catalog-nav sound-nav" aria-label="Filter by context"></nav>
      <div class="sound-rail-note"><span>Engine</span><b>Web Audio synthesis</b><small>No samples or external audio files</small></div>
    </aside>
    <main class="catalog-main sound-main" id="sound-main">
      <section class="sound-hero">
        <div class="sound-hero-copy">
          <div class="catalog-eyebrow">Neural signal array / production palette</div>
          <h1 class="catalog-title">Electric current.<br /><em>Not arcade noise.</em></h1>
          <p class="catalog-description">Every cue below is the production sound mapped to a real Neural gameplay event. The palette uses spatial travel, filtered current, restrained harmonics, and longer starflight rewards for the moments that matter.</p>
          <div class="catalog-meta"><span class="catalog-tag">${catalog.length} contextual cues</span><span class="catalog-tag">${groups.length} event systems</span><span class="catalog-tag">deterministic synthesis</span></div>
        </div>
        <div class="sound-console" aria-label="Sound preview controls">
          <div class="sound-orbit" aria-hidden="true"><i></i><i></i><span></span></div>
          <div class="sound-console-controls">
            <label><span>Output energy</span><select aria-label="Preview volume"><option value="0.35">Quiet</option><option value="0.55" selected>Balanced</option><option value="0.8">Cinematic</option></select></label>
            <button class="sound-stop" type="button">${icon("stop", 13)} Stop</button>
          </div>
          <p class="sound-status" role="status" aria-live="polite">Signal array ready</p>
        </div>
      </section>
      <div class="sound-results" aria-live="polite"></div>
      <div class="sound-groups"></div>
    </main>
  </div>`;

  const search = app.querySelector('input[type="search"]');
  const nav = app.querySelector(".sound-nav");
  const groupsRoot = app.querySelector(".sound-groups");
  const results = app.querySelector(".sound-results");
  const state = { query: "", group: "All" };

  const render = () => {
    const query = state.query.trim().toLowerCase();
    const filtered = catalog.filter(
      (cue) =>
        (state.group === "All" || cue.group === state.group) &&
        (!query ||
          [cue.label, cue.beat, cue.group, cue.context, cue.character].some(
            (value) => value.toLowerCase().includes(query),
          )),
    );
    nav.innerHTML = ["All", ...groups]
      .map((group) => {
        const count =
          group === "All"
            ? catalog.length
            : catalog.filter((cue) => cue.group === group).length;
        return `<button class="catalog-item" type="button" data-sound-group="${escapeHtml(group)}" aria-current="${state.group === group}"><span class="catalog-item-index">${String(count).padStart(2, "0")}</span>${escapeHtml(group)}</button>`;
      })
      .join("");
    groupsRoot.innerHTML = groups
      .map((group) => [group, filtered.filter((cue) => cue.group === group)])
      .filter(([, cues]) => cues.length)
      .map(([group, cues]) => renderGroup(group, cues))
      .join("");
    results.textContent = `${filtered.length} of ${catalog.length} signals`;
    if (!filtered.length) {
      groupsRoot.innerHTML =
        '<div class="sound-empty"><b>No signal found</b><span>Try a cue name, event, or gameplay context.</span></div>';
    }
    syncActiveCue();
  };

  nav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sound-group]");
    if (!button) return;
    state.group = button.dataset.soundGroup;
    render();
  });
  search.addEventListener("input", () => {
    state.query = search.value;
    render();
  });
  groupsRoot.addEventListener("click", (event) => {
    const button = event.target.closest("[data-preview]");
    if (button) playCue(button.dataset.preview);
  });
  app.querySelector(".sound-stop").addEventListener("click", stopPlayback);
  app.querySelector("select").addEventListener("change", (event) => {
    settings.soundVolume = event.target.value;
    setStatus(`Output energy set to ${event.target.selectedOptions[0].text}`);
  });

  initCatalogRail({
    rail: app.querySelector(".catalog-rail"),
    toggle: app.querySelector(".catalog-rail-toggle"),
    close: app.querySelector(".catalog-rail-close"),
    backdrop: app.querySelector(".catalog-rail-backdrop"),
    nav,
  });
  engine = createEngine();
  render();
}

mount();
window.addEventListener("pagehide", () => engine?.destroy(), { once: true });
