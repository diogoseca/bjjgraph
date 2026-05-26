// Tree Explorer — standalone page for browsing the BJJ knowledge graph as a tree
import { fetchExplorerTree, handleGraphExpandClick } from "./explorerGraphExpand"
import type { ExplorerTreeData } from "./explorerGraphExpand"
import { removeAllChildren } from "./util"

document.addEventListener("nav", async () => {
  const container = document.getElementById("tree-explorer")
  if (!container) return

  const searchInput = document.getElementById("tree-search-input") as HTMLInputElement | null
  const searchResults = document.getElementById("tree-search-results")
  const treeContent = document.getElementById("tree-content")
  if (!searchInput || !searchResults || !treeContent) return

  // Fetch data
  let data: ExplorerTreeData
  try {
    data = await fetchExplorerTree()
  } catch {
    treeContent.textContent = "Failed to load graph data"
    return
  }

  // Build sorted position list for search
  const positionEntries = Object.entries(data.positions)
    .map(([key, pos]) => ({ key, name: pos.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  function renderTree(hubKey: string) {
    removeAllChildren(treeContent!)

    const pos = data.positions[hubKey]
    if (!pos) {
      treeContent!.textContent = "Position not found"
      return
    }

    // Render position header
    const header = document.createElement("div")
    header.className = "tree-position-header"
    header.textContent = pos.name
    treeContent!.appendChild(header)

    // Render expansion
    const expansion = document.createElement("div")
    expansion.className = "graph-inline"
    expansion.dataset.graphKey = hubKey

    const ancestors = new Set<string>()
    ancestors.add(hubKey)

    // Top role
    if (pos.top.length > 0) {
      const topHeader = document.createElement("div")
      topHeader.className = "graph-role-header role-top"
      topHeader.innerHTML =
        '<span class="graph-role-line"></span><span class="graph-role-label">Top</span><span class="graph-role-line"></span>'
      expansion.appendChild(topHeader)

      for (const tech of pos.top) {
        const row = document.createElement("div")
        row.className = "graph-technique"

        const nameSpan = document.createElement("span")
        nameSpan.className = "graph-technique-name"
        nameSpan.textContent = tech.n
        row.appendChild(nameSpan)

        const pctSpan = document.createElement("span")
        pctSpan.className = "graph-technique-pct"
        pctSpan.textContent = `(${tech.p}%)`
        row.appendChild(pctSpan)

        if (data.techniques[tech.k]) {
          const btn = document.createElement("span")
          btn.className = "graph-expand-btn"
          btn.textContent = "+"
          btn.dataset.graphKey = tech.k
          btn.dataset.graphType = tech.s ? "submission" : "technique"
          btn.title = "Let's go down the rabbit hole.."
          row.appendChild(btn)
        }

        expansion.appendChild(row)
      }
    }

    // Bottom role
    if (pos.bottom.length > 0) {
      const bottomHeader = document.createElement("div")
      bottomHeader.className = "graph-role-header role-bottom"
      bottomHeader.innerHTML =
        '<span class="graph-role-line"></span><span class="graph-role-label">Bottom</span><span class="graph-role-line"></span>'
      expansion.appendChild(bottomHeader)

      for (const tech of pos.bottom) {
        const row = document.createElement("div")
        row.className = "graph-technique"

        const nameSpan = document.createElement("span")
        nameSpan.className = "graph-technique-name"
        nameSpan.textContent = tech.n
        row.appendChild(nameSpan)

        const pctSpan = document.createElement("span")
        pctSpan.className = "graph-technique-pct"
        pctSpan.textContent = `(${tech.p}%)`
        row.appendChild(pctSpan)

        if (data.techniques[tech.k]) {
          const btn = document.createElement("span")
          btn.className = "graph-expand-btn"
          btn.textContent = "+"
          btn.dataset.graphKey = tech.k
          btn.dataset.graphType = tech.s ? "submission" : "technique"
          btn.title = "Let's go down the rabbit hole.."
          row.appendChild(btn)
        }

        expansion.appendChild(row)
      }
    }

    treeContent!.appendChild(expansion)
  }

  // Search functionality
  function showResults(query: string) {
    removeAllChildren(searchResults!)
    if (!query) {
      searchResults!.style.display = "none"
      return
    }

    const lowerQuery = query.toLowerCase()
    const matches = positionEntries
      .filter((p) => p.name.toLowerCase().includes(lowerQuery))
      .slice(0, 12)

    if (matches.length === 0) {
      searchResults!.style.display = "none"
      return
    }

    for (const match of matches) {
      const item = document.createElement("div")
      item.className = "tree-search-result-item"
      item.textContent = match.name
      item.addEventListener("click", () => {
        searchInput!.value = match.name
        searchResults!.style.display = "none"
        renderTree(match.key)
      })
      searchResults!.appendChild(item)
    }
    searchResults!.style.display = "block"
  }

  searchInput.addEventListener("input", () => {
    showResults(searchInput.value.trim())
  })

  searchInput.addEventListener("focus", () => {
    if (searchInput.value.trim()) {
      showResults(searchInput.value.trim())
    }
  })

  // Close dropdown when clicking outside
  const outsideClickHandler = (e: MouseEvent) => {
    if (!container.contains(e.target as Node)) {
      searchResults.style.display = "none"
    }
  }
  document.addEventListener("click", outsideClickHandler)

  // Event delegation for dynamic graph expand buttons
  const expandHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target?.classList.contains("graph-expand-btn")) return
    e.stopPropagation()
    handleGraphExpandClick(target)
  }
  treeContent.addEventListener("click", expandHandler)

  // Cleanup
  window.addCleanup(() => {
    document.removeEventListener("click", outsideClickHandler)
    treeContent.removeEventListener("click", expandHandler)
  })
})
