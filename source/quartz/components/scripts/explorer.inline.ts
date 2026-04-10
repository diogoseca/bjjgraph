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
    const existingActive = document.querySelectorAll("#explorer-content a.active, #explorer-content .explorer-role-link.active")
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
      (document.querySelector(
        `#explorer-content a[href$='/${currentSlug}']`,
      ) as MaybeHTMLElement)
    if (activeLink) {
      activeLink.classList.add("active")

      // Also highlight the role badge (A/D/T/B) when on a role page
      const roleSuffix = effectiveSlug !== currentSlug
        ? currentSlug.split("/").pop()
        : null
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

      // Delay scroll to after folder expand animation (0.3s CSS transition)
      setTimeout(() => {
        activeLink.scrollIntoView({ block: "center", behavior: "smooth" })
      }, 350)
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
