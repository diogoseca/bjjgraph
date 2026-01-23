// Viewport-aware highlighting - items light up when in view, dim when scrolled past
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const slug = entry.target.id
      const tocEntryElement = document.querySelector(`a[data-for="${slug}"]`)
      if (tocEntryElement) {
        // Use isIntersecting - true when visible, false when not
        if (entry.isIntersecting) {
          tocEntryElement.classList.add("in-view")
        } else {
          tocEntryElement.classList.remove("in-view")
        }
      }
    }
  },
  {
    // Focus on top 30% of viewport for better highlighting behavior
    rootMargin: "-10% 0px -60% 0px",
    threshold: 0,
  },
)

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
}

window.addEventListener("resize", setupToc)
document.addEventListener("nav", () => {
  setupToc()

  // update toc entry highlighting
  observer.disconnect()
  const headers = document.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]")
  headers.forEach((header) => observer.observe(header))
})
