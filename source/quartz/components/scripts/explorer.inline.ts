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

  // folder-icon is now a span after the div[data-folderpath], or could be a button click
  const isIcon = target.classList.contains("folder-icon")
  const childFolderContainer = (
    isIcon
      ? target.parentElement?.nextElementSibling
      : target.parentElement?.parentElement?.nextElementSibling
  ) as MaybeHTMLElement
  const currentFolderParent = (
    isIcon ? target.previousElementSibling : target.parentElement
  ) as MaybeHTMLElement
  if (!(childFolderContainer && currentFolderParent)) return

  childFolderContainer.classList.toggle("open")
  const isCollapsed = childFolderContainer.classList.contains("open")
  setFolderState(childFolderContainer, !isCollapsed)
  const fullFolderPath = (currentFolderParent as HTMLElement).dataset.folderpath as string
  toggleCollapsedByPath(currentExplorerState, fullFolderPath)
  const stringifiedFileTree = JSON.stringify(currentExplorerState)
  localStorage.setItem("fileTree", stringifiedFileTree)
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

  // Get folder state from local storage
  const storageTree = localStorage.getItem("fileTree")
  const useSavedFolderState = explorer?.dataset.savestate === "true"
  const oldExplorerState: FolderState[] =
    storageTree && useSavedFolderState ? JSON.parse(storageTree) : []
  const oldIndex = new Map(oldExplorerState.map((entry) => [entry.path, entry.collapsed]))
  const newExplorerState: FolderState[] = explorer.dataset.tree
    ? JSON.parse(explorer.dataset.tree)
    : []
  currentExplorerState = []
  for (const { path, collapsed } of newExplorerState) {
    currentExplorerState.push({ path, collapsed: oldIndex.get(path) ?? collapsed })
  }

  currentExplorerState.map((folderState) => {
    const folderLi = document.querySelector(
      `[data-folderpath='${folderState.path}']`,
    ) as MaybeHTMLElement
    const folderUl = folderLi?.parentElement?.nextElementSibling as MaybeHTMLElement
    if (folderUl) {
      setFolderState(folderUl, folderState.collapsed)
    }
  })

  // Auto-expand folders in the path to the current page
  const currentSlug = document.body.dataset.slug
  if (currentSlug) {
    // Build all ancestor folder paths for the current page
    // e.g., "Positions/Mount/Bottom" → ["Positions", "Positions/Mount"]
    const slugSegments = currentSlug.split("/")
    const folderPaths: string[] = []

    // Build paths for all parent folders (exclude the file itself)
    for (let i = 0; i < slugSegments.length - 1; i++) {
      folderPaths.push(slugSegments.slice(0, i + 1).join("/"))
    }

    // Also check if the current page itself is a folder (e.g., "Positions/Mount" hub page)
    // by checking if there's a folder with the exact slug path
    const exactFolderLi = document.querySelector(
      `[data-folderpath='${currentSlug}']`,
    ) as MaybeHTMLElement
    if (exactFolderLi) {
      folderPaths.push(currentSlug)
    }

    // Expand each folder in the path
    folderPaths.forEach((folderPath) => {
      const folderLi = document.querySelector(
        `[data-folderpath='${folderPath}']`,
      ) as MaybeHTMLElement
      const folderUl = folderLi?.parentElement?.nextElementSibling as MaybeHTMLElement

      if (folderUl) {
        // Set folder to expanded state (false = not collapsed = open)
        setFolderState(folderUl, false)

        // Update state array to reflect the expansion
        const stateEntry = currentExplorerState.find((entry) => entry.path === folderPath)
        if (stateEntry) {
          stateEntry.collapsed = false
        }
      }
    })

    // Save the updated state to localStorage so it persists
    const stringifiedFileTree = JSON.stringify(currentExplorerState)
    localStorage.setItem("fileTree", stringifiedFileTree)

    // Highlight the active page in the explorer
    // Remove any existing active classes first
    const existingActive = document.querySelectorAll("#explorer-content a.active")
    existingActive.forEach((el) => el.classList.remove("active"))

    // Find and highlight the current page link
    const activeLink = document.querySelector(
      `#explorer-content a[data-for='${currentSlug}']`,
    ) as MaybeHTMLElement
    if (activeLink) {
      activeLink.classList.add("active")
    }
  }
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
