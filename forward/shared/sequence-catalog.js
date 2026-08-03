import { devices, loadEntities } from "./catalog.js";
import { initCatalogRail } from "./catalog-rail.js";
import { fallbackEntities, resolveEntityContext } from "./fixtures.js";
import { icon } from "./icons.js";
import { renderDevRoutes } from "./routes.js";
import { framesFor } from "./sequence-registry.js";
import { gameScreen } from "./screen-renderers.js";

const routeNames = {
  "use-cases": "Use cases",
  "user-journeys": "User journeys",
};

function paramsFromHash() {
  return new URLSearchParams(location.hash.replace(/^#/, ""));
}

function selectedEntity(entities, id) {
  return entities.find((entity) => entity.id === id) || entities[0];
}

function resolveFrameState(frame, context) {
  const state =
    typeof frame.state === "function" ? frame.state(context) : frame.state;
  return {
    ...state,
    motion: frame.motion,
    motionProgress: frame.motionProgress,
  };
}

export async function mountSequenceCatalog({ kind, items, version }) {
  const app = document.querySelector("#app");
  if (!app || !items.length) return;
  app.innerHTML =
    '<div class="catalog-loading">Loading timeline fixtures…</div>';

  const entities = await loadEntities();
  const defaultEntity =
    entities.find((entity) => entity.id === "position:deep-half-guard") ||
    fallbackEntities[0] ||
    entities[0];
  const hash = paramsFromHash();
  const state = {
    itemId: hash.get("item") || items[0].id,
    entityId: hash.get("entity") || defaultEntity.id,
    role: hash.get("role") || "",
    device: hash.get("viewport") || "phone",
    step: Number(hash.get("step") || 0),
    speed: Number(hash.get("speed") || 1),
    playing: false,
  };
  let playTimer = null;

  if (!items.some((item) => item.id === state.itemId))
    state.itemId = items[0].id;
  if (!entities.some((entity) => entity.id === state.entityId)) {
    state.entityId = defaultEntity.id;
  }

  app.innerHTML = `<div class="sequence-catalog">
    <header class="catalog-header">
      <a class="catalog-brand" href="/dev/"><span class="catalog-mark">◈</span><span>Forward Components <small>BJJGraph</small></span></a>
      <nav class="catalog-routes" aria-label="Development routes">${renderDevRoutes(kind === "user-journeys" ? "journeys" : kind)}</nav>
      <button class="catalog-rail-toggle" type="button" aria-label="Browse ${routeNames[kind]}" aria-controls="catalog-rail" aria-expanded="false">${icon("menu", 17)}<span>Browse ${routeNames[kind]}</span></button>
      <span class="catalog-version">v${version} · dev only</span>
    </header>
    <button class="catalog-rail-backdrop" type="button" aria-label="Close ${routeNames[kind]} browser" tabindex="-1"></button>
    <aside class="sequence-sidebar catalog-rail" id="catalog-rail" aria-label="${routeNames[kind]} catalog">
      <div class="catalog-rail-head"><div><b>${routeNames[kind]}</b><span>${items.length} browsable timelines</span></div><button class="catalog-rail-close" type="button" aria-label="Close ${routeNames[kind]} browser">${icon("close", 16)}</button></div>
      <div class="catalog-search"><label>${icon("search", 14)}<input type="search" placeholder="Filter ${routeNames[kind].toLowerCase()}…" aria-label="Filter ${routeNames[kind].toLowerCase()}" /></label></div>
      <div class="catalog-count"></div>
      <nav class="sequence-nav"></nav>
    </aside>
    <main class="sequence-main" id="sequence-main">
      <section class="sequence-intro">
        <div><div class="catalog-eyebrow"></div><h1 class="catalog-title"></h1><p class="catalog-description"></p><div class="catalog-meta"></div></div>
        <div class="sequence-config">
          <label><span>Node</span><select aria-label="Preview node" class="variant-select entity-select"></select></label>
          <label><span>Role</span><select aria-label="Preview role" class="variant-select role-select"></select></label>
          <label><span>Viewport</span><select aria-label="Preview viewport" class="variant-select viewport-select"></select></label>
          <label><span>Speed</span><select aria-label="Playback speed" class="variant-select speed-select"><option value="0.5">0.5x</option><option value="1">1x</option><option value="2">2x</option></select></label>
        </div>
      </section>
      <section class="sequence-player" aria-label="Timeline player">
        <div class="sequence-player-head">
          <button type="button" class="catalog-action prev-step" aria-label="Previous timepoint">${icon("chevron-left", 14)} Prev</button>
          <button type="button" class="catalog-action play-sequence">${icon("play", 13)} Play timeline</button>
          <button type="button" class="catalog-action next-step">Next ${icon("chevron-right", 14)}</button>
          <span class="sequence-position"></span>
        </div>
        <div class="sequence-focus-wrap"><div class="sequence-device"><div class="sequence-focus"></div></div></div>
        <div class="sequence-caption"></div>
      </section>
      <section class="sequence-chapters" aria-label="Journey chapters"></section>
      <section class="sequence-timeline" aria-label="All timeline timepoints"></section>
    </main>
  </div>`;

  const refs = {
    search: app.querySelector('input[type="search"]'),
    count: app.querySelector(".catalog-count"),
    nav: app.querySelector(".sequence-nav"),
    eyebrow: app.querySelector(".catalog-eyebrow"),
    title: app.querySelector(".catalog-title"),
    description: app.querySelector(".catalog-description"),
    meta: app.querySelector(".catalog-meta"),
    entity: app.querySelector(".entity-select"),
    role: app.querySelector(".role-select"),
    viewport: app.querySelector(".viewport-select"),
    speed: app.querySelector(".speed-select"),
    prev: app.querySelector(".prev-step"),
    play: app.querySelector(".play-sequence"),
    next: app.querySelector(".next-step"),
    position: app.querySelector(".sequence-position"),
    device: app.querySelector(".sequence-device"),
    focus: app.querySelector(".sequence-focus"),
    caption: app.querySelector(".sequence-caption"),
    chapters: app.querySelector(".sequence-chapters"),
    timeline: app.querySelector(".sequence-timeline"),
    rail: app.querySelector("#catalog-rail"),
    railToggle: app.querySelector(".catalog-rail-toggle"),
    railClose: app.querySelector(".catalog-rail-close"),
    railBackdrop: app.querySelector(".catalog-rail-backdrop"),
  };

  initCatalogRail({
    rail: refs.rail,
    toggle: refs.railToggle,
    close: refs.railClose,
    backdrop: refs.railBackdrop,
    nav: refs.nav,
  });

  function item() {
    return items.find((entry) => entry.id === state.itemId) || items[0];
  }

  function context() {
    const entity = selectedEntity(entities, state.entityId);
    const resolved = resolveEntityContext(entity, state.role);
    state.role = resolved.role;
    return resolved;
  }

  function frames() {
    return framesFor(item());
  }

  function stop() {
    state.playing = false;
    clearTimeout(playTimer);
    refs.play.innerHTML = `${icon("play", 13)} Play timeline`;
    refs.focus.dataset.playing = "false";
  }

  function writeHash() {
    const next = new URLSearchParams({
      item: state.itemId,
      viewport: state.device,
      entity: state.entityId,
      role: state.role,
      step: String(state.step),
      speed: String(state.speed),
    });
    history.replaceState(null, "", `#${next}`);
  }

  function renderEntityControls() {
    const active = selectedEntity(entities, state.entityId);
    if (!refs.entity.options.length) {
      refs.entity.innerHTML = ["Position", "Transition", "Submission"]
        .map(
          (type) =>
            `<optgroup label="${type}s">${entities
              .filter((entity) => entity.type === type)
              .map(
                (entity) =>
                  `<option value="${entity.id}">${entity.name}</option>`,
              )
              .join("")}</optgroup>`,
        )
        .join("");
    }
    refs.entity.value = active.id;
    const resolved = context();
    refs.role.innerHTML = resolved.availableRoles
      .map(
        (role) =>
          `<option value="${role}" ${role === resolved.role ? "selected" : ""}>${active.roles[role].roleLabel}</option>`,
      )
      .join("");
  }

  function renderNav(query = "") {
    const normalized = query.trim().toLowerCase();
    const visible = items.filter(
      (entry) =>
        !normalized ||
        `${entry.title} ${entry.group} ${entry.description}`
          .toLowerCase()
          .includes(normalized),
    );
    refs.count.textContent = `${visible.length} ${routeNames[kind].toLowerCase()}`;
    refs.nav.innerHTML = visible
      .map(
        (
          entry,
          index,
        ) => `<button class="catalog-item" data-id="${entry.id}" aria-current="${entry.id === state.itemId}">
          <span class="catalog-item-index">${String(index + 1).padStart(2, "0")}</span>
          <span><b>${entry.title}</b><small>${framesFor(entry).length} timepoints</small></span>
        </button>`,
      )
      .join("");
    refs.nav
      .querySelector(`[data-id="${state.itemId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function renderViewport() {
    refs.viewport.innerHTML = devices
      .map(
        (device) =>
          `<option value="${device.id}" ${device.id === state.device ? "selected" : ""}>${device.label}${device.width ? ` · ${device.width}x${device.height}` : ""}</option>`,
      )
      .join("");
    refs.speed.value = String(state.speed);
    refs.device.dataset.device = state.device;
    const device =
      devices.find((entry) => entry.id === state.device) || devices[0];
    refs.device.style.setProperty(
      "--device-ratio",
      device.width ? device.width / device.height : 16 / 10,
    );
  }

  function renderChapters(activeFrames) {
    if (kind !== "user-journeys") {
      refs.chapters.hidden = true;
      return;
    }
    refs.chapters.hidden = false;
    refs.chapters.innerHTML = item()
      .chapters.map((chapter, index) => {
        const first = activeFrames.findIndex(
          (entry) => entry.chapterIndex === index,
        );
        const active = activeFrames[state.step]?.chapterIndex === index;
        return `<button type="button" data-chapter="${index}" data-step="${first}" aria-current="${active}"><span>${String(index + 1).padStart(2, "0")}</span><b>${chapter.label}</b></button>`;
      })
      .join("");
  }

  function renderTimeline() {
    const activeFrames = frames();
    const resolved = context();
    refs.timeline.innerHTML = activeFrames
      .map((entry, index) => {
        const screen = gameScreen(resolveFrameState(entry, resolved), resolved);
        return `<article class="sequence-frame" data-step="${index}" aria-current="${index === state.step}">
          <div class="sequence-frame-visual" aria-hidden="true" inert>
            <div class="sequence-frame-meta"><span>${entry.at}ms</span><b>${entry.label}</b><small>${entry.beat}</small></div>
            <div class="sequence-mini-frame">${screen}</div>
            ${entry.chapter ? `<div class="sequence-frame-chapter">${entry.chapter}</div>` : ""}
          </div>
          <button type="button" class="sequence-frame-select" data-frame-step="${index}" aria-label="Show ${entry.label}"></button>
        </article>`;
      })
      .join("");
    renderChapters(activeFrames);
  }

  function renderStep({ scroll = false } = {}) {
    const activeFrames = frames();
    state.step = Math.max(0, Math.min(state.step, activeFrames.length - 1));
    const active = activeFrames[state.step];
    const resolved = context();
    refs.focus.innerHTML = gameScreen(
      resolveFrameState(active, resolved),
      resolved,
    );
    refs.focus.dataset.playing = String(state.playing);
    refs.position.textContent = `${state.step + 1} / ${activeFrames.length} · ${active.at}ms`;
    refs.caption.innerHTML = `<div><small>${active.beat}</small><h2>${active.label}</h2><p>${active.note || item().description}</p></div>${active.chapter ? `<span>${active.chapter}</span>` : ""}`;
    refs.prev.disabled = state.step === 0;
    refs.next.disabled = state.step === activeFrames.length - 1;
    refs.timeline.querySelectorAll("[data-step]").forEach((element) => {
      if (element.classList.contains("sequence-frame")) {
        element.setAttribute(
          "aria-current",
          String(Number(element.dataset.step) === state.step),
        );
      }
    });
    renderChapters(activeFrames);
    writeHash();
    if (scroll) {
      refs.timeline
        .querySelector(`.sequence-frame[data-step="${state.step}"]`)
        ?.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
    }
  }

  function renderSelection() {
    stop();
    state.step = Math.max(0, Math.min(state.step, frames().length - 1));
    const active = item();
    refs.eyebrow.textContent = `${active.group} · ${routeNames[kind]}`;
    refs.title.textContent = active.title;
    refs.description.textContent = active.description;
    refs.meta.innerHTML = [
      `${frames().length} timepoints`,
      kind === "user-journeys"
        ? `${active.chapters.length} use cases`
        : "Screen timeline",
      `${context().type} · ${context().roleLabel}`,
    ]
      .map((value) => `<span class="catalog-tag">${value}</span>`)
      .join("");
    renderEntityControls();
    renderViewport();
    renderNav(refs.search.value);
    renderTimeline();
    renderStep();
  }

  function advancePlayback() {
    if (!state.playing) return;
    if (state.step >= frames().length - 1) {
      stop();
      return;
    }
    const current = frames()[state.step];
    const next = frames()[state.step + 1];
    const delta = Math.max(240, next.at - current.at);
    playTimer = setTimeout(() => {
      state.step += 1;
      renderStep({ scroll: true });
      advancePlayback();
    }, delta / state.speed);
  }

  refs.search.addEventListener("input", (event) =>
    renderNav(event.target.value),
  );
  refs.nav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (!button) return;
    state.itemId = button.dataset.id;
    state.step = 0;
    renderSelection();
  });
  refs.entity.addEventListener("change", (event) => {
    state.entityId = event.target.value;
    state.role = "";
    renderSelection();
  });
  refs.role.addEventListener("change", (event) => {
    state.role = event.target.value;
    renderSelection();
  });
  refs.viewport.addEventListener("change", (event) => {
    state.device = event.target.value;
    renderViewport();
    writeHash();
  });
  refs.speed.addEventListener("change", (event) => {
    state.speed = Number(event.target.value);
    writeHash();
  });
  refs.prev.addEventListener("click", () => {
    stop();
    state.step -= 1;
    renderStep({ scroll: true });
  });
  refs.next.addEventListener("click", () => {
    stop();
    state.step += 1;
    renderStep({ scroll: true });
  });
  refs.play.addEventListener("click", () => {
    if (state.playing) {
      stop();
      return;
    }
    if (state.step >= frames().length - 1) state.step = 0;
    state.playing = true;
    refs.play.innerHTML = `${icon("pause", 13)} Pause timeline`;
    renderStep({ scroll: true });
    advancePlayback();
  });
  refs.timeline.addEventListener("click", (event) => {
    const button = event.target.closest(".sequence-frame-select");
    if (!button) return;
    stop();
    state.step = Number(button.dataset.frameStep);
    renderStep();
  });
  refs.chapters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-step]");
    if (!button) return;
    stop();
    state.step = Number(button.dataset.step);
    renderStep({ scroll: true });
  });
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (event.key === "Escape") {
      if (state.playing) event.preventDefault();
      stop();
      return;
    }
    const isFormControl =
      target instanceof HTMLElement &&
      (target.matches("input, select, textarea, button") ||
        target.isContentEditable);
    if (isFormControl) return;
    if (event.key === "ArrowLeft") refs.prev.click();
    if (event.key === "ArrowRight") refs.next.click();
    if (event.key === " ") {
      event.preventDefault();
      refs.play.click();
    }
  });

  renderSelection();
}
