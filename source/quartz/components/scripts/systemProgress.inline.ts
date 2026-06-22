// System "unlock the graph" UX — progress ring + per-node mark-known checklist.
// Runs only on system pages. Reads the system's members from #page-graph-data
// (injected by renderPage) and the honor-system known set from known.ts.

import { getKnownSlugSet, toggleKnown, markManyKnown } from "./known"

interface Member {
  slug: string // lowercase node id, e.g. "positions/ashi-garami"
  path: string // case-preserving node id, e.g. "Positions/Ashi-Garami"
  type: string // position | transition | submission | principle
  name: string
  relationship?: string
}

interface SystemPageData {
  type: string
  name: string
  members?: Member[]
}

const RING_R = 19
const RING_C = 2 * Math.PI * RING_R

function getSystemData(): SystemPageData | null {
  const el = document.getElementById("page-graph-data")
  if (!el?.textContent) return null
  try {
    const data = JSON.parse(el.textContent)
    return data?.type === "system" ? data : null
  } catch {
    return null
  }
}

function systemSlug(): string {
  return (document.body.dataset.slug || "").toLowerCase().replace(/\/$/, "")
}

function safeHref(path: string): string {
  const p = "/" + String(path || "").replace(/^\//, "")
  return /^\/[A-Za-z0-9/_%.-]*$/.test(p) ? p : "#"
}

function capture(event: string, props: Record<string, unknown>) {
  const ph = (window as any).posthog
  if (ph?.capture) ph.capture(event, props)
}

function paintRing(section: HTMLElement, known: number, total: number) {
  const frac = total > 0 ? known / total : 0
  const fill = section.querySelector(".system-progress__ring-fill") as SVGCircleElement | null
  if (fill) {
    fill.style.strokeDasharray = `${RING_C}`
    fill.style.strokeDashoffset = `${RING_C * (1 - frac)}`
  }
  const knownEl = section.querySelector(".system-progress__known")
  const totalEl = section.querySelector(".system-progress__total")
  if (knownEl) knownEl.textContent = String(known)
  if (totalEl) totalEl.textContent = String(total)
  section.dataset.complete = total > 0 && known >= total ? "true" : "false"
}

function render() {
  const section = document.querySelector("[data-system-unlock]") as HTMLElement | null
  if (!section) return
  const data = getSystemData()
  const members = data?.members || []
  if (!data || members.length === 0) {
    section.setAttribute("hidden", "")
    return
  }
  section.removeAttribute("hidden")

  const knownSet = getKnownSlugSet() // case-preserving node-id paths
  const list = section.querySelector("[data-system-members]") as HTMLElement | null
  if (!list) return

  let knownCount = 0
  list.innerHTML = ""
  for (const m of members) {
    const isOn = knownSet.has(m.path)
    if (isOn) knownCount++
    const li = document.createElement("li")
    li.className = "system-member" + (isOn ? " is-known" : "")
    li.dataset.memberSlug = m.path
    li.dataset.memberName = m.name
    li.dataset.memberType = m.type
    li.innerHTML =
      `<button class="system-member__toggle" type="button" data-mark-known ` +
      `aria-pressed="${isOn}" title="Mark as known"><span class="system-member__check" aria-hidden="true">&#10003;</span></button>` +
      `<a class="system-member__name internal" href="${safeHref(m.path)}">${escapeHtml(m.name)}</a>` +
      `<span class="system-member__type">${escapeHtml(m.type)}</span>`
    list.appendChild(li)
  }
  paintRing(section, knownCount, members.length)

  // Per-node toggle (event delegation on the list)
  list.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-mark-known]") as HTMLElement | null
    if (!btn) return
    e.preventDefault()
    const li = btn.closest(".system-member") as HTMLElement | null
    if (!li) return
    const slug = li.dataset.memberSlug || ""
    const name = li.dataset.memberName || slug
    const type = li.dataset.memberType || ""
    const nowKnown = toggleKnown(slug, name, type)
    li.classList.toggle("is-known", nowKnown)
    btn.setAttribute("aria-pressed", String(nowKnown))
    const newCount = (section.querySelectorAll(".system-member.is-known") || []).length
    paintRing(section, newCount, members.length)
    capture(nowKnown ? "system_node_marked_known" : "system_node_unmarked", {
      system_slug: systemSlug(),
      node_slug: slug.toLowerCase(),
      node_type: type,
    })
    scheduleGraphRefresh()
  })

  // Mark whole system known
  const markAll = section.querySelector("[data-mark-system]") as HTMLButtonElement | null
  if (markAll) {
    markAll.addEventListener("click", (e) => {
      e.preventDefault()
      const added = markManyKnown(
        members.map((m) => ({ slug: m.path, name: m.name, type: m.type })),
      )
      capture("system_marked_complete", {
        system_slug: systemSlug(),
        member_count: members.length,
        newly_added: added,
      })
      render() // repaint checklist + ring from store
      scheduleGraphRefresh()
    })
  }
}

// Re-render the page in place so the graph (which reads the known set once at render)
// lights up newly-known nodes. Debounced so rapid toggles coalesce into one re-render.
let _refreshTimer: number | null = null
function scheduleGraphRefresh() {
  if (typeof (window as any).spaNavigate !== "function") return
  if (_refreshTimer !== null) clearTimeout(_refreshTimer)
  _refreshTimer = window.setTimeout(() => {
    _refreshTimer = null
    try {
      ;(window as any).spaNavigate(new URL(window.location.toString()), false)
    } catch {
      /* no-op */
    }
  }, 450)
}

function escapeHtml(s: string): string {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  )
}

document.addEventListener("nav", render)
