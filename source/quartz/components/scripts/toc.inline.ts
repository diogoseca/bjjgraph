// Track section visibility with proportional opacity based on how much of the SECTION is visible
function updateActiveSection() {
  const headers = Array.from(
    document.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]"),
  )
  if (headers.length === 0) return

  const viewportTop = 0
  const viewportBottom = window.innerHeight

  // Calculate section boundaries and what percentage of each section is visible
  const sectionVisibility: Map<string, number> = new Map()

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    const nextHeader = headers[i + 1]

    // Section starts at this header
    const headerRect = header.getBoundingClientRect()
    const sectionTop = headerRect.top

    // Section ends at next header or at end of content
    let sectionBottom: number
    if (nextHeader) {
      sectionBottom = nextHeader.getBoundingClientRect().top
    } else {
      // Last section: extend to end of document content
      const article = document.querySelector("article")
      if (article) {
        sectionBottom = article.getBoundingClientRect().bottom
      } else {
        sectionBottom = document.body.getBoundingClientRect().bottom
      }
    }

    const sectionHeight = sectionBottom - sectionTop

    // Calculate visible portion of this section within viewport
    const visibleTop = Math.max(sectionTop, viewportTop)
    const visibleBottom = Math.min(sectionBottom, viewportBottom)
    const visibleHeight = Math.max(0, visibleBottom - visibleTop)

    // Calculate what percentage of the SECTION is visible (not viewport)
    const visibility = sectionHeight > 0 ? visibleHeight / sectionHeight : 0

    sectionVisibility.set(header.id, visibility)
  }

  // Update TOC entries with proportional opacity
  const tocEntries = document.querySelectorAll("#toc-content a[data-for]")
  const minOpacity = 0.35
  const maxOpacity = 0.85

  tocEntries.forEach((entry) => {
    const slug = entry.getAttribute("data-for")
    const visibility = slug ? sectionVisibility.get(slug) || 0 : 0

    // Interpolate opacity based on section visibility
    // 0% visible → minOpacity, 100% visible → maxOpacity
    const opacity = minOpacity + visibility * (maxOpacity - minOpacity)

    ;(entry as HTMLElement).style.opacity = opacity.toFixed(2)

    // Add/remove class for any additional styling hooks
    if (visibility > 0.05) {
      entry.classList.add("in-view")
    } else {
      entry.classList.remove("in-view")
    }
  })
}

function setupToc() {
  // Prevent page scroll when scrolling TOC content
  const tocContent = document.getElementById("toc-content")
  if (tocContent) {
    const preventPageScroll = (e: WheelEvent) => {
      // Stop event from bubbling to page - let TOC scroll naturally
      e.stopPropagation()
    }

    tocContent.addEventListener("wheel", preventPageScroll, { passive: true })
    window.addCleanup(() => tocContent.removeEventListener("wheel", preventPageScroll))
  }

  // Set up scroll-based section tracking
  updateActiveSection()
  window.addEventListener("scroll", updateActiveSection, { passive: true })
  window.addCleanup(() => window.removeEventListener("scroll", updateActiveSection))
}

window.addEventListener("resize", setupToc)
document.addEventListener("nav", () => {
  setupToc()
})
