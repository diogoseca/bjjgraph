import { FolderState } from "../ExplorerNode"
type MaybeHTMLElement = HTMLElement | undefined
let currentExplorerState: FolderState[]
const observer = new IntersectionObserver((entries) => {
  // If last element is observed, remove gradient of "overflow" class so element is visible
  const explorerUl = document.getElementById("explorer-ul")
  if (!explorerUl) return
  for (const entry of entries) {
    if (entry.isIntersecting) {
      explorerUl.classList.add("no-background")
    } else {
      explorerUl.classList.remove("no-background")
    }
  }
})

function toggleFolder(evt: MouseEvent) {
  evt.stopPropagation()
  const target = evt.target as MaybeHTMLElement
  if (!target) return

  // Find the containing <li> and query by structure, not fragile sibling traversal
  const li = target.closest("li")
  if (!li) return
  const childFolderContainer = li.querySelector(":scope > .folder-outer") as MaybeHTMLElement
  const currentFolderParent = li.querySelector(
    ":scope > .folder-container [data-folderpath]",
  ) as MaybeHTMLElement
  if (!(childFolderContainer && currentFolderParent)) return

  childFolderContainer.classList.toggle("open")
  const isOpen = childFolderContainer.classList.contains("open")
  setFolderState(childFolderContainer, !isOpen)
  if (isOpen) {
    expandAllDescendants(childFolderContainer)
  }
  const fullFolderPath = (currentFolderParent as HTMLElement).dataset.folderpath as string
  toggleCollapsedByPath(currentExplorerState, fullFolderPath)
  const stringifiedFileTree = JSON.stringify(currentExplorerState)
  localStorage.setItem("fileTree", stringifiedFileTree)
}

function applyTrainingOverlay() {
  const isTraining = document.body.dataset.slug === "training"

  if (!isTraining) {
    // Clean up on non-training pages (SPA navigation)
    document
      .querySelectorAll(".explorer-faded")
      .forEach((el) => el.classList.remove("explorer-faded"))
    return
  }

  // Read flashcard cards from localStorage (avoid importing srs.ts to keep bundle small)
  const SRS_KEY = "bjj-srs-cards"
  let knownSlugs: Set<string>
  try {
    const cards = JSON.parse(localStorage.getItem(SRS_KEY) || "[]")
    knownSlugs = new Set(cards.map((c: { slug?: string }) => (c.slug || "").replace(/^\//, "")))
  } catch {
    knownSlugs = new Set()
  }

  const links = document.querySelectorAll("#explorer-content a[data-for]")
  for (const link of links) {
    const slug = (link as HTMLElement).dataset.for || ""
    const li = link.parentElement

    // Skip top-level category folders (no slash = root level)
    if (!slug.includes("/")) continue

    let isKnown = false
    if (slug.startsWith("Positions/")) {
      // Position hub: known if any flashcard card is under this path
      const prefix = slug + "/"
      for (const s of knownSlugs) {
        if (s.startsWith(prefix)) {
          isKnown = true
          break
        }
      }
    } else {
      // Transition/Submission: direct slug match
      isKnown = knownSlugs.has(slug)
    }

    // Apply fading
    if (isKnown) {
      link.classList.remove("explorer-faded")
    } else {
      link.classList.add("explorer-faded")
    }
  }
}

function setupExplorer() {
  const explorer = document.getElementById("explorer")
  if (!explorer) return

  if (explorer.dataset.behavior === "collapse") {
    for (const item of document.getElementsByClassName(
      "folder-button",
    ) as HTMLCollectionOf<HTMLElement>) {
      item.addEventListener("click", toggleFolder)
      window.addCleanup(() => item.removeEventListener("click", toggleFolder))
    }
  }

  // Set up click handlers for each folder (click handler on folder "icon")
  for (const item of document.getElementsByClassName(
    "folder-icon",
  ) as HTMLCollectionOf<HTMLElement>) {
    item.addEventListener("click", toggleFolder)
    window.addCleanup(() => item.removeEventListener("click", toggleFolder))
  }

  // Set up scrollable list fade classes
  for (const list of document.getElementsByClassName(
    "scrollable-list",
  ) as HTMLCollectionOf<HTMLElement>) {
    const updateFade = () => {
      const atTop = list.scrollTop <= 2
      const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 2
      list.classList.toggle("scroll-top", atTop)
      list.classList.toggle("scroll-bottom", atBottom)
    }
    updateFade()
    list.addEventListener("scroll", updateFade, { passive: true })
    window.addCleanup(() => list.removeEventListener("scroll", updateFade))
  }

  // Unified wheel scrolling for the drawer. Native overscroll-behavior already
  // chains a saturated inner .scrollable-list out to .sidebar.left (see
  // explorer.scss), so we only handle the case CSS can't: wheel events landing
  // in the left gutter / dead space, where there's no scroll box under the
  // cursor and the event would otherwise be dropped.
  const overlay = document.getElementById("sidebar-overlay")
  const outerScroll = explorer.closest(".sidebar.left") as MaybeHTMLElement
  if (overlay && outerScroll) {
    const onWheel = (e: WheelEvent) => {
      if (!document.body.classList.contains("drawer-open")) return
      // Horizontal swipe — leave to native handling.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      // Normalize deltaMode (lines / pages) to pixels.
      const px =
        e.deltaMode === 1
          ? e.deltaY * 16
          : e.deltaMode === 2
            ? e.deltaY * outerScroll.clientHeight
            : e.deltaY
      if (px === 0) return

      // Over an inner .scrollable-list → leave it to the browser: native scroll,
      // and a native chain out to .sidebar.left at the edge (explorer.scss). The
      // early return is also what prevents a double-scroll when the outer isn't
      // scrollable but the cursor is over an inner list.
      const path = e.composedPath() as EventTarget[]
      const overInner = path.some(
        (el) => el instanceof HTMLElement && el.classList?.contains("scrollable-list"),
      )
      if (overInner) return

      // Otherwise the cursor is over the outer scroll box — including its left
      // padding/gutter, which is part of .sidebar.left. If the outer can scroll
      // in this direction, let the browser do it natively (preserves momentum).
      if (canScrollInDir(outerScroll, px)) return

      // Outer can't move (it isn't scrollable, or is pinned at this edge). If a
      // single inner list is the only scrollable thing, drive it from the gutter
      // so wheel anywhere in the drawer keeps the tree moving.
      const target = pickGutterTarget(outerScroll)
      if (target && target !== outerScroll && canScrollInDir(target, px)) {
        e.preventDefault()
        target.scrollTop += px
      }
    }
    overlay.addEventListener("wheel", onWheel, { passive: false })
    window.addCleanup(() => overlay.removeEventListener("wheel", onWheel))
  }

  // Start with all folders collapsed
  const newExplorerState: FolderState[] = explorer.dataset.tree
    ? JSON.parse(explorer.dataset.tree)
    : []
  currentExplorerState = newExplorerState.map(({ path }) => ({ path, collapsed: true }))

  // Collapse all folders in the DOM
  currentExplorerState.forEach((folderState) => {
    const folderLi = document.querySelector(
      `[data-folderpath='${CSS.escape(folderState.path)}']`,
    ) as MaybeHTMLElement
    const folderUl = folderLi?.parentElement?.nextElementSibling as MaybeHTMLElement
    if (folderUl) {
      setFolderState(folderUl, true)
    }
  })

  // Only expand folders in the path to the current page
  const currentSlug = document.body.dataset.slug
  if (currentSlug) {
    // For role pages (filtered from explorer), resolve to parent hub
    // Also strip /index suffix used by Quartz for folder index pages
    let effectiveSlug = currentSlug
    if (effectiveSlug.endsWith("/index")) {
      effectiveSlug = effectiveSlug.slice(0, -"/index".length)
    }
    const lower = effectiveSlug.toLowerCase()
    if (
      lower.endsWith("/top") ||
      lower.endsWith("/bottom") ||
      lower.endsWith("/attacker") ||
      lower.endsWith("/defender")
    ) {
      effectiveSlug = effectiveSlug.split("/").slice(0, -1).join("/")
    }

    // Build all ancestor folder paths (including the item itself if it's a folder)
    const slugSegments = effectiveSlug.split("/")
    const folderPaths: string[] = []
    for (let i = 0; i < slugSegments.length; i++) {
      folderPaths.push(slugSegments.slice(0, i + 1).join("/"))
    }

    // Expand each folder in the path, plus all its descendant subtrees
    folderPaths.forEach((folderPath) => {
      const folderLi = document.querySelector(
        `[data-folderpath='${CSS.escape(folderPath)}']`,
      ) as MaybeHTMLElement
      const folderUl = folderLi?.parentElement?.nextElementSibling as MaybeHTMLElement
      if (folderUl) {
        setFolderState(folderUl, false)
        expandAllDescendants(folderUl)
        const stateEntry = currentExplorerState.find((e) => e.path === folderPath)
        if (stateEntry) stateEntry.collapsed = false
      }
    })
    // Highlight the active page in the explorer and scroll into view
    const existingActive = document.querySelectorAll(
      "#explorer-content a.active, #explorer-content .explorer-role-link.active",
    )
    existingActive.forEach((el) => el.classList.remove("active"))

    // Try data-for, then folderpath, then href matching (most robust fallback)
    const activeLink =
      (document.querySelector(
        `#explorer-content a[data-for='${effectiveSlug}']`,
      ) as MaybeHTMLElement) ||
      (document.querySelector(
        `#explorer-content a[data-for='${currentSlug}']`,
      ) as MaybeHTMLElement) ||
      (document.querySelector(
        `#explorer-content [data-folderpath='${effectiveSlug}'] > a`,
      ) as MaybeHTMLElement) ||
      (document.querySelector(
        `#explorer-content [data-folderpath='${currentSlug}'] > a`,
      ) as MaybeHTMLElement) ||
      (document.querySelector(
        `#explorer-content a[href$='/${effectiveSlug}']`,
      ) as MaybeHTMLElement) ||
      (document.querySelector(`#explorer-content a[href$='/${currentSlug}']`) as MaybeHTMLElement)
    if (activeLink) {
      activeLink.classList.add("active")

      // Also highlight the role badge (A/D/T/B) when on a role page
      const roleSuffix = effectiveSlug !== currentSlug ? currentSlug.split("/").pop() : null
      if (roleSuffix) {
        // Find the role link badge near the active folder
        const container = activeLink.closest(".folder-container")
        if (container) {
          const roleLink = container.querySelector(
            `.explorer-role-link[title='${roleSuffix}']`,
          ) as MaybeHTMLElement
          if (roleLink) {
            roleLink.classList.add("active")
          }
        }
      }

      // Scroll the active link into the center of the sidebar over 1s total.
      // 300ms wait (folder expand CSS transition) + 700ms eased animation.
      setTimeout(() => {
        const container = activeLink.closest(".sidebar") as HTMLElement | null
        if (!container) return
        const linkRect = activeLink.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        const target =
          container.scrollTop + linkRect.top - containerRect.top - container.clientHeight / 2
        const start = container.scrollTop
        const distance = target - start
        if (Math.abs(distance) < 1) return
        const duration = 700
        const t0 = performance.now()
        const step = (now: number) => {
          const elapsed = Math.min((now - t0) / duration, 1)
          const ease = elapsed < 0.5 ? 2 * elapsed * elapsed : -1 + (4 - 2 * elapsed) * elapsed
          container.scrollTop = start + distance * ease
          if (elapsed < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }, 300)
    }
  }

  localStorage.setItem("fileTree", JSON.stringify(currentExplorerState))
  applyTrainingOverlay()
}

window.addEventListener("resize", setupExplorer)
document.addEventListener("nav", () => {
  setupExplorer()
  observer.disconnect()

  // select pseudo element at end of list
  const lastItem = document.getElementById("explorer-end")
  if (lastItem) {
    observer.observe(lastItem)
  }
})

/**
 * Expands all descendant folders within a given folder element
 * and updates their state in currentExplorerState.
 */
function expandAllDescendants(parentFolderOuter: HTMLElement) {
  parentFolderOuter.querySelectorAll(":scope .folder-outer").forEach((folder) => {
    setFolderState(folder as HTMLElement, false)
  })
  parentFolderOuter.querySelectorAll(":scope [data-folderpath]").forEach((el) => {
    const path = (el as HTMLElement).dataset.folderpath
    if (path) {
      const entry = currentExplorerState.find((e) => e.path === path)
      if (entry) entry.collapsed = false
    }
  })
}

/**
 * Toggles the state of a given folder
 * @param folderElement <div class="folder-outer"> Element of folder (parent)
 * @param collapsed if folder should be set to collapsed or not
 */
function setFolderState(folderElement: HTMLElement, collapsed: boolean) {
  return collapsed ? folderElement.classList.remove("open") : folderElement.classList.add("open")
}

/**
 * Toggles visibility of a folder
 * @param array array of FolderState (`fileTree`, either get from local storage or data attribute)
 * @param path path to folder (e.g. 'advanced/more/more2')
 */
function toggleCollapsedByPath(array: FolderState[], path: string) {
  const entry = array.find((item) => item.path === path)
  if (entry) {
    entry.collapsed = !entry.collapsed
  }
}

/**
 * Whether `el` can still scroll vertically in the wheel's direction.
 * `direction: rtl` on .scrollable-list only mirrors horizontal layout — vertical
 * scrollTop semantics are unaffected, so this works for the rtl inner lists too.
 */
function canScrollInDir(el: HTMLElement, deltaY: number): boolean {
  const max = el.scrollHeight - el.clientHeight
  if (max <= 1) return false
  return deltaY > 0 ? el.scrollTop < max - 1 : el.scrollTop > 1
}

/**
 * When a wheel event lands in the gutter (the sidebar's left padding or the
 * inner list's rtl scrollbar gutter — i.e. NOT over a real scroll box), pick
 * which element should move:
 *  - the outer explorer scroll (.sidebar.left) if it's scrollable; else
 *  - the single scrollable .scrollable-list, if exactly one exists; else
 *  - null (0 or >1 candidates — ambiguous, do nothing).
 */
function pickGutterTarget(outer: HTMLElement): HTMLElement | null {
  if (outer.scrollHeight - outer.clientHeight > 1) return outer
  // `clientHeight > 0` excludes COLLAPSED categories: their ul keeps the
  // .scrollable-list class but is clipped to 0 height (grid 0fr + overflow
  // hidden), yet still reports scrollHeight > 0 — without this guard every
  // collapsed list would count as a candidate and the gutter would do nothing.
  const lists = Array.from(outer.querySelectorAll<HTMLElement>("ul.scrollable-list")).filter(
    (l) => l.clientHeight > 0 && l.scrollHeight - l.clientHeight > 1,
  )
  return lists.length === 1 ? lists[0] : null
}
