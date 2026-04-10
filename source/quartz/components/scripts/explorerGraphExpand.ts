// Explorer Graph Expansion — inline semantic sub-tree in the sidebar explorer
// Shared module imported by explorer.inline.ts and moveCards/victoryDisplay

interface ExplorerPositionTech {
  k: string
  n: string
  p: number
  s: boolean
}

interface ExplorerPosition {
  name: string
  id: string
  top: ExplorerPositionTech[]
  bottom: ExplorerPositionTech[]
}

interface ExplorerOutcome {
  hub: string
  role: string
  p: number
  r: string // "s" | "f" | "c"
}

interface ExplorerTechnique {
  n: string
  id: string
  path: string
  o: ExplorerOutcome[]
  sub?: boolean
}

export interface ExplorerTreeData {
  positions: Record<string, ExplorerPosition>
  techniques: Record<string, ExplorerTechnique>
}

const MAX_DEPTH = 6

let cachedData: ExplorerTreeData | null = null

/** Lazy-fetch and cache explorerTree.json */
export async function fetchExplorerTree(): Promise<ExplorerTreeData> {
  if (cachedData) return cachedData
  const resp = await fetch("/static/explorerTree.json")
  cachedData = await resp.json()
  return cachedData!
}

/** Clear cached data (for cleanup on navigation) */
export function clearExplorerTreeCache() {
  cachedData = null
}

/**
 * Handle a click on a .graph-expand-btn element.
 * Toggles expansion or creates it on first click.
 */
export async function handleGraphExpandClick(btn: HTMLElement): Promise<void> {
  // Find the right insertion point:
  // - For buttons inside .folder-container → insert after the folder-container within the <li>
  // - For buttons inside .graph-technique or .graph-outcome → insert after that row
  // - For buttons inside a leaf <li> → insert at end of the <li>
  const insertionTarget = getInsertionTarget(btn)

  // Check if already has an expansion container (stored as data ref)
  const existingId = btn.dataset.expansionId
  if (existingId) {
    const existing = document.getElementById(existingId)
    if (existing) {
      const isHidden = existing.style.display === "none"
      existing.style.display = isHidden ? "" : "none"
      btn.textContent = isHidden ? "\u2212" : "+"
      return
    }
  }

  const key = btn.dataset.graphKey
  const type = btn.dataset.graphType
  if (!key || !type) return

  const data = await fetchExplorerTree()

  // Compute ancestors by walking up the DOM
  const ancestors = getAncestors(btn)

  // Create expansion container
  const container = document.createElement("div")
  const expansionId = `graph-exp-${key}-${Date.now()}`
  container.id = expansionId
  container.className = "graph-inline"
  container.dataset.graphKey = key

  if (type === "position") {
    renderPositionExpansion(container, key, ancestors, data)
  } else {
    // "transition", "submission", or "technique" — all use technique rendering
    renderTechniqueExpansion(container, key, ancestors, data)
  }

  // Insert after the target element
  insertionTarget.insertAdjacentElement("afterend", container)
  btn.dataset.expansionId = expansionId
  btn.textContent = "\u2212"
}

/** Find the right DOM element after which to insert the expansion container */
function getInsertionTarget(btn: HTMLElement): HTMLElement {
  // Button inside .folder-container → insert after the folder-container
  const folderContainer = btn.closest(".folder-container") as HTMLElement | null
  if (folderContainer) return folderContainer

  // Button inside .graph-technique or .graph-outcome → insert after that row
  const graphRow = btn.closest(".graph-technique, .graph-outcome") as HTMLElement | null
  if (graphRow) return graphRow

  // Fallback: insert after the button itself (e.g., leaf <li> items)
  return btn
}

/** Walk up DOM to find ancestor graph keys (for cycle detection) */
function getAncestors(element: HTMLElement): Set<string> {
  const ancestors = new Set<string>()
  let el: HTMLElement | null = element
  while (el) {
    if (el.classList.contains("graph-inline") && el.dataset.graphKey) {
      ancestors.add(el.dataset.graphKey)
    }
    el = el.parentElement
  }
  return ancestors
}

function renderPositionExpansion(
  container: HTMLElement,
  hubKey: string,
  ancestors: Set<string>,
  data: ExplorerTreeData,
) {
  const pos = data.positions[hubKey]
  if (!pos) {
    container.textContent = "No data"
    return
  }

  const newAncestors = new Set(ancestors)
  newAncestors.add(hubKey)

  // Top role (attacking / playing as Top)
  if (pos.top.length > 0) {
    const header = el("div", "graph-role-header role-top")
    header.innerHTML =
      '<span class="graph-role-line"></span><span class="graph-role-label">Top</span><span class="graph-role-line"></span>'
    container.appendChild(header)
    renderTechniqueList(container, pos.top, newAncestors, data)
  }

  // Bottom role (defending / playing as Bottom)
  if (pos.bottom.length > 0) {
    const header = el("div", "graph-role-header role-bottom")
    header.innerHTML =
      '<span class="graph-role-line"></span><span class="graph-role-label">Bottom</span><span class="graph-role-line"></span>'
    container.appendChild(header)
    renderTechniqueList(container, pos.bottom, newAncestors, data)
  }
}

function renderTechniqueList(
  container: HTMLElement,
  techs: ExplorerPositionTech[],
  ancestors: Set<string>,
  data: ExplorerTreeData,
) {
  for (const tech of techs) {
    const row = el("div", "graph-technique")

    const nameSpan = el("span", "graph-technique-name", tech.n)
    row.appendChild(nameSpan)

    const pctSpan = el("span", "graph-technique-pct", `(${tech.p}%)`)
    row.appendChild(pctSpan)

    // Only show [+] if we have outcome data for this technique
    if (data.techniques[tech.k]) {
      const btn = el("span", "graph-expand-btn", "+")
      btn.dataset.graphKey = tech.k
      btn.dataset.graphType = tech.s ? "submission" : "technique"
      btn.title = "Let's go down the rabbit hole.."
      row.appendChild(btn)
    }

    container.appendChild(row)
  }
}

function renderTechniqueExpansion(
  container: HTMLElement,
  techKey: string,
  ancestors: Set<string>,
  data: ExplorerTreeData,
) {
  const tech = data.techniques[techKey]
  if (!tech || !tech.o || tech.o.length === 0) {
    container.textContent = "No outcome data"
    return
  }

  for (const outcome of tech.o) {
    const resultCls = outcomeClass(outcome.r)
    const row = el("div", `graph-outcome outcome-${resultCls}`)

    const icon = outcome.r === "s" ? "\u2713" : outcome.r === "f" ? "\u2717" : "\u26A1"
    row.appendChild(el("span", "graph-outcome-icon", icon))
    row.appendChild(el("span", "graph-outcome-pct", `${outcome.p}%`))
    row.appendChild(el("span", "graph-outcome-arrow", "\u2192"))

    const isCycle = ancestors.has(outcome.hub)
    const pos = data.positions[outcome.hub]
    const displayName = pos?.name || outcome.hub || "game-over"

    const nameSpan = el(
      "span",
      `graph-outcome-name${isCycle ? " graph-cycle" : ""}`,
      `${displayName}${isCycle ? " \u21A9" : ""}`,
    )
    row.appendChild(nameSpan)

    // Show [+] for recursive expansion if not a cycle and within depth limit
    if (!isCycle && pos && ancestors.size < MAX_DEPTH) {
      const btn = el("span", "graph-expand-btn", "+")
      btn.dataset.graphKey = outcome.hub
      btn.dataset.graphType = "position"
      btn.title = "Let's go down the rabbit hole.."
      row.appendChild(btn)
    }

    container.appendChild(row)
  }
}

function outcomeClass(r: string): string {
  switch (r) {
    case "s":
      return "success"
    case "f":
      return "failure"
    case "c":
      return "counter"
    default:
      return "unknown"
  }
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const element = document.createElement(tag)
  element.className = className
  if (text) element.textContent = text
  return element
}

// ── Roll URL utilities ──────────────────────────────────────────────
// Roll history is stored in sessionStorage and synced to the URL on each
// SPA navigation. This avoids the race condition where async fetch resolves
// after spaNavigate has already changed the URL.

const ROLL_STORAGE_KEY = "bjj-roll-ids"

/** Get cached explorer tree data synchronously (null if not fetched yet) */
export function getCachedExplorerTree(): ExplorerTreeData | null {
  return cachedData
}

/** Append a short ID to the roll history in sessionStorage */
export function appendToRollHistory(shortId: string) {
  const current = sessionStorage.getItem(ROLL_STORAGE_KEY) || ""
  const updated = current ? `${current}-${shortId}` : shortId
  sessionStorage.setItem(ROLL_STORAGE_KEY, updated)
}

/** Clear roll history (call when starting a new game) */
export function clearRollHistory() {
  sessionStorage.removeItem(ROLL_STORAGE_KEY)
}

/** Get current roll history from sessionStorage */
export function getRollHistory(): string {
  return sessionStorage.getItem(ROLL_STORAGE_KEY) || ""
}

/**
 * Sync roll history from sessionStorage to the URL via ?roll= param.
 * Call this on every `nav` event so the URL always reflects the roll state.
 */
export function syncRollToUrl() {
  const rollIds = sessionStorage.getItem(ROLL_STORAGE_KEY)
  const url = new URL(window.location.href)
  const currentParam = url.searchParams.get("roll")

  if (rollIds && rollIds !== currentParam) {
    url.searchParams.set("roll", rollIds)
    history.replaceState(history.state, "", url.toString())
  } else if (!rollIds && currentParam) {
    url.searchParams.delete("roll")
    history.replaceState(history.state, "", url.toString())
  }
}

/** Read and decode the ?roll= parameter back to node names */
export async function decodeRollUrl(rollParam: string): Promise<string[]> {
  const data = await fetchExplorerTree()
  return decodeRollUrlSync(rollParam, data)
}

/** Synchronous decode when data is already available */
export function decodeRollUrlSync(rollParam: string, data: ExplorerTreeData): string[] {
  const ids = rollParam.split("-").filter(Boolean)
  const names: string[] = []

  // Build reverse lookup: id -> name
  const idToName: Record<string, string> = {}
  for (const pos of Object.values(data.positions)) {
    idToName[pos.id] = pos.name
  }
  for (const tech of Object.values(data.techniques)) {
    idToName[tech.id] = tech.n
  }

  for (const id of ids) {
    names.push(idToName[id] || id)
  }

  return names
}

/** Get the current ?roll= parameter value (from URL) */
export function getRollParam(): string | null {
  return new URL(window.location.href).searchParams.get("roll")
}

/** Clear the ?roll= parameter from URL */
export function clearRollUrl() {
  const url = new URL(window.location.href)
  if (url.searchParams.has("roll")) {
    url.searchParams.delete("roll")
    history.replaceState(history.state, "", url.toString())
  }
}
