import {
  categoryNotes,
  fallbackEntities,
  resolveEntityContext,
} from "./fixtures.js";
import { icon } from "./icons.js";

export const devices = [
  { id: "responsive", label: "Fluid", width: null, height: null },
  { id: "small", label: "320", width: 320, height: 700 },
  { id: "phone", label: "Phone", width: 393, height: 852 },
  { id: "compact", label: "400", width: 400, height: 875 },
  { id: "tablet", label: "Tablet", width: 768, height: 1024 },
  { id: "desktop", label: "Desktop", width: 1440, height: 900 },
  { id: "landscape", label: "Wide", width: 844, height: 390 },
];

function paramsFromHash() {
  return new URLSearchParams(location.hash.replace(/^#/, ""));
}

function groupItems(items) {
  return items.reduce((groups, entry) => {
    if (!groups.has(entry.group)) groups.set(entry.group, []);
    groups.get(entry.group).push(entry);
    return groups;
  }, new Map());
}

function preferredDevice(entry) {
  if (entry.id.includes("400x875")) return "compact";
  if (entry.id.includes("320")) return "small";
  if (entry.id.includes("landscape")) return "landscape";
  if (entry.id.includes("mobile")) return "phone";
  return null;
}

export async function loadEntities() {
  try {
    const response = await fetch(
      new URL("../shared/entities.json", location.href),
    );
    if (!response.ok)
      throw new Error(`Entity catalog returned ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.entities) || payload.entities.length === 0) {
      throw new Error("Entity catalog is empty");
    }
    return payload.entities.map((entity) => {
      const curated = fallbackEntities.find(
        (fallback) => fallback.curated && fallback.id === entity.id,
      );
      return curated
        ? {
            ...entity,
            ...curated,
            roles: { ...entity.roles, ...curated.roles },
          }
        : entity;
    });
  } catch (error) {
    console.error("[forward] Using curated entity fallbacks.", error);
    return fallbackEntities;
  }
}

export async function mountCatalog({ kind, items, version }) {
  const app = document.querySelector("#app");
  if (!app || !items.length) return;
  app.innerHTML = '<div class="catalog-loading">Loading graph fixtures…</div>';
  const entities = await loadEntities();
  const defaultEntity =
    entities.find((entity) => entity.id === "position:deep-half-guard") ||
    entities[0];

  const hash = paramsFromHash();
  const state = {
    selectedId: hash.get("item") || items[0].id,
    device: hash.get("viewport") || "responsive",
    variant: hash.get("variant") || "",
    query: "",
    fullscreen: false,
    deviceWasChosen: hash.has("viewport"),
    entityId: hash.get("entity") || defaultEntity.id,
    role: hash.get("role") || "",
  };

  if (!items.some((entry) => entry.id === state.selectedId))
    state.selectedId = items[0].id;
  if (!entities.some((entity) => entity.id === state.entityId))
    state.entityId = defaultEntity.id;

  app.innerHTML = `<div class="catalog">
    <header class="catalog-header">
      <a class="catalog-brand" href="/dev/"><span class="catalog-mark">◈</span><span>Forward Components <small>BJJGraph</small></span></a>
      <nav class="catalog-routes" aria-label="Forward libraries">
        <a href="/dev/components/" ${kind === "components" ? 'aria-current="page"' : ""}>Components</a>
        <a href="/dev/screens/" ${kind === "screens" ? 'aria-current="page"' : ""}>Screens</a>
        <a href="/dev/use-cases/">Use cases</a>
        <a href="/dev/user-journeys/">User journeys</a>
      </nav>
      <span class="catalog-version">v${version} · dev only</span>
    </header>
    <aside class="catalog-sidebar" aria-label="${kind} catalog">
      <div class="catalog-search"><label>${icon("search", 14)}<input type="search" placeholder="Filter ${kind}…" aria-label="Filter ${kind}" /></label></div>
      <div class="catalog-count"></div>
      <nav class="catalog-nav"></nav>
    </aside>
    <main class="catalog-main" id="catalog-main" tabindex="-1">
      <section class="catalog-intro">
        <div class="catalog-intro-copy">
          <div class="catalog-eyebrow"></div>
          <h1 class="catalog-title"></h1>
          <p class="catalog-description"></p>
          <div class="catalog-meta"></div>
        </div>
        <div class="catalog-controls">
          <div class="control-row mobile-item-row"><span class="control-label">Item</span><select class="variant-select mobile-item-select" aria-label="Catalog item"></select></div>
          <div class="control-row"><span class="control-label">Node</span><select class="variant-select entity-select" aria-label="Preview node"></select><select class="variant-select role-select" aria-label="Preview role"></select></div>
          <div class="control-row"><span class="control-label">Viewport</span><div class="segment device-controls"></div></div>
          <div class="control-row"><span class="control-label">Variant</span><select class="variant-select" aria-label="Preview variant"></select><button class="catalog-action fullscreen-action" type="button">Full frame</button></div>
        </div>
      </section>
      <section class="preview-shell" aria-label="Preview">
        <div class="preview-toolbar"><span class="preview-dot"></span><span class="preview-dot"></span><span class="preview-dot"></span><span style="margin-left:7px">forward://${kind}</span><span class="preview-size"></span></div>
        <div class="device-stage"><div class="device-frame" data-device="responsive"><div class="forward-preview"></div></div></div>
      </section>
      <section class="catalog-note" aria-label="Implementation notes"></section>
    </main>
  </div>`;

  const refs = {
    search: app.querySelector('input[type="search"]'),
    count: app.querySelector(".catalog-count"),
    nav: app.querySelector(".catalog-nav"),
    eyebrow: app.querySelector(".catalog-eyebrow"),
    title: app.querySelector(".catalog-title"),
    description: app.querySelector(".catalog-description"),
    meta: app.querySelector(".catalog-meta"),
    devices: app.querySelector(".device-controls"),
    mobileItem: app.querySelector(".mobile-item-select"),
    entity: app.querySelector(".entity-select"),
    role: app.querySelector(".role-select"),
    variant: app.querySelector('[aria-label="Preview variant"]'),
    fullscreen: app.querySelector(".fullscreen-action"),
    stage: app.querySelector(".device-stage"),
    frame: app.querySelector(".device-frame"),
    preview: app.querySelector(".forward-preview"),
    size: app.querySelector(".preview-size"),
    notes: app.querySelector(".catalog-note"),
  };

  function selected() {
    return items.find((entry) => entry.id === state.selectedId) || items[0];
  }

  function selectedEntity() {
    return (
      entities.find((entity) => entity.id === state.entityId) || entities[0]
    );
  }

  function entityContext() {
    const context = resolveEntityContext(selectedEntity(), state.role);
    state.role = context.role;
    return context;
  }

  function writeHash() {
    const next = new URLSearchParams();
    next.set("item", state.selectedId);
    next.set("viewport", state.device);
    if (state.variant) next.set("variant", state.variant);
    next.set("entity", state.entityId);
    next.set("role", state.role);
    history.replaceState(null, "", `#${next}`);
  }

  function renderNavigation() {
    const query = state.query.trim().toLowerCase();
    const visible = items.filter(
      (entry) =>
        !query ||
        `${entry.title} ${entry.group} ${entry.description}`
          .toLowerCase()
          .includes(query),
    );
    refs.count.textContent = `${visible.length} of ${items.length} ${kind}`;
    if (!visible.length) {
      refs.nav.innerHTML =
        '<div class="catalog-empty">No matching states.</div>';
      return;
    }
    refs.nav.innerHTML = [...groupItems(visible)]
      .map(
        ([group, entries]) => `<section class="catalog-group">
          <div class="catalog-group-title">${group} · ${entries.length}</div>
          ${entries
            .map((entry) => {
              const index = items.indexOf(entry) + 1;
              return `<button class="catalog-item" type="button" data-id="${entry.id}" aria-current="${entry.id === state.selectedId}">
                <span class="catalog-item-index">${String(index).padStart(2, "0")}</span><span>${entry.title}</span>
              </button>`;
            })
            .join("")}
        </section>`,
      )
      .join("");
  }

  function renderDevices() {
    refs.devices.innerHTML = devices
      .map(
        (device) =>
          `<button type="button" data-device="${device.id}" aria-pressed="${state.device === device.id}" title="${device.width ? `${device.width} × ${device.height}` : "Fill available space"}">${device.label}</button>`,
      )
      .join("");
  }

  function renderEntityControls() {
    const selectedNode = selectedEntity();
    const groups = ["Position", "Transition", "Submission"];
    if (!refs.entity.options.length) {
      refs.entity.innerHTML = groups
        .map((type) => {
          const options = entities
            .filter((entity) => entity.type === type)
            .map(
              (entity) =>
                `<option value="${entity.id}">${entity.name}</option>`,
            )
            .join("");
          return `<optgroup label="${type}s">${options}</optgroup>`;
        })
        .join("");
    }
    refs.entity.value = selectedNode.id;
    const context = entityContext();
    refs.role.innerHTML = context.availableRoles
      .map((role) => {
        const label = selectedNode.roles[role].roleLabel;
        return `<option value="${role}" ${role === context.role ? "selected" : ""}>${label}</option>`;
      })
      .join("");
  }

  function sizeFrame() {
    const device =
      devices.find((entry) => entry.id === state.device) || devices[0];
    refs.frame.dataset.device = device.id;
    if (!device.width) {
      refs.frame.style.width = "";
      refs.frame.style.height = "";
      refs.frame.style.transform = "";
      refs.stage.style.height = "";
      refs.size.textContent = "Responsive";
      return;
    }
    const availableWidth = Math.max(280, refs.stage.clientWidth - 52);
    const availableHeight = Math.max(
      380,
      Math.min(720, window.innerHeight - 220),
    );
    const scale = Math.min(
      1,
      availableWidth / device.width,
      availableHeight / device.height,
    );
    refs.frame.style.width = `${device.width}px`;
    refs.frame.style.height = `${device.height}px`;
    refs.frame.style.transform = `scale(${scale})`;
    refs.stage.style.height = `${Math.ceil(device.height * scale + 52)}px`;
    refs.size.textContent = `${device.width} × ${device.height} · ${Math.round(scale * 100)}%`;
  }

  function renderSelection({ allowPreferredDevice = false } = {}) {
    const entry = selected();
    if (allowPreferredDevice && !state.deviceWasChosen) {
      const preferred = preferredDevice(entry);
      if (preferred) state.device = preferred;
    }
    if (!entry.variants.includes(state.variant))
      state.variant = entry.variants[0];
    renderEntityControls();
    const context = entityContext();

    refs.eyebrow.textContent = `${entry.group} · ${kind.slice(0, -1)} ${items.indexOf(entry) + 1} of ${items.length}`;
    refs.title.textContent = entry.title;
    refs.description.textContent = entry.description;
    refs.meta.innerHTML = [
      entry.group,
      `${entry.variants.length} variant${entry.variants.length === 1 ? "" : "s"}`,
      kind === "screens" ? "Composed screen" : "Reusable component",
      `${context.type} · ${context.roleLabel}`,
    ]
      .map((tag) => `<span class="catalog-tag">${tag}</span>`)
      .join("");
    refs.variant.innerHTML = entry.variants
      .map(
        (variant) =>
          `<option ${variant === state.variant ? "selected" : ""}>${variant}</option>`,
      )
      .join("");
    refs.mobileItem.innerHTML = items
      .map(
        (item) =>
          `<option value="${item.id}" ${item.id === entry.id ? "selected" : ""}>${item.group} · ${item.title}</option>`,
      )
      .join("");
    refs.preview.innerHTML = entry.render(state.variant, context);
    refs.notes.innerHTML = `
      <article class="note-card"><b>Source of truth</b><span>${entry.notes.source}</span></article>
      <article class="note-card"><b>Behavior contract</b><span>${entry.notes.behavior}</span></article>
      <article class="note-card"><b>Used in</b><span>${entry.notes.usage}. ${categoryNotes[entry.group] || ""}</span></article>`;
    renderNavigation();
    renderDevices();
    writeHash();
    requestAnimationFrame(sizeFrame);
  }

  refs.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderNavigation();
  });

  refs.nav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (!button) return;
    state.selectedId = button.dataset.id;
    state.variant = "";
    renderSelection({ allowPreferredDevice: true });
    refs.title.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  refs.devices.addEventListener("click", (event) => {
    const button = event.target.closest("[data-device]");
    if (!button) return;
    state.device = button.dataset.device;
    state.deviceWasChosen = true;
    renderDevices();
    writeHash();
    requestAnimationFrame(sizeFrame);
  });

  refs.mobileItem.addEventListener("change", (event) => {
    state.selectedId = event.target.value;
    state.variant = "";
    renderSelection({ allowPreferredDevice: true });
  });

  refs.variant.addEventListener("change", (event) => {
    state.variant = event.target.value;
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

  refs.fullscreen.addEventListener("click", () => {
    state.fullscreen = !state.fullscreen;
    document.body.classList.toggle("catalog-fullscreen", state.fullscreen);
    refs.fullscreen.textContent = state.fullscreen
      ? "Exit full frame"
      : "Full frame";
    requestAnimationFrame(sizeFrame);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.fullscreen) refs.fullscreen.click();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      refs.search.focus();
    }
  });

  const observer = new ResizeObserver(() => sizeFrame());
  observer.observe(refs.stage);
  window.addEventListener("hashchange", () => {
    const next = paramsFromHash();
    const id = next.get("item");
    if (id && items.some((entry) => entry.id === id)) {
      state.selectedId = id;
      state.device = next.get("viewport") || state.device;
      state.variant = next.get("variant") || "";
      const entityId = next.get("entity");
      if (entityId && entities.some((entity) => entity.id === entityId)) {
        state.entityId = entityId;
        state.role = next.get("role") || "";
      }
      renderSelection();
    }
  });

  renderSelection({ allowPreferredDevice: true });
}
