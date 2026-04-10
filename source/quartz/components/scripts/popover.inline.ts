import { computePosition, flip, inline, shift } from "@floating-ui/dom"
import { normalizeRelativeURLs } from "../../util/path"

const p = new DOMParser()
const portalPopovers = new WeakMap<HTMLAnchorElement, HTMLElement>()
const portalElements = new Set<HTMLElement>()

async function mouseEnterHandler(
  this: HTMLAnchorElement,
  { clientX, clientY }: { clientX: number; clientY: number },
) {
  const link = this
  if (link.dataset.noPopover === "true") {
    return
  }

  const isPortal = !!link.closest(".move-cards")

  async function setPosition(popoverElement: HTMLElement) {
    const { x, y } = await computePosition(link, popoverElement, {
      ...(isPortal && { strategy: "fixed" }),
      middleware: [inline({ x: clientX, y: clientY }), shift(), flip()],
    })
    Object.assign(popoverElement.style, {
      left: `${x}px`,
      top: `${y}px`,
      ...(isPortal && { position: "fixed" }),
    })
  }

  const hasAlreadyBeenFetched = () =>
    isPortal
      ? portalPopovers.has(link)
      : [...link.children].some((child) => child.classList.contains("popover"))

  // dont refetch if there's already a popover
  if (hasAlreadyBeenFetched()) {
    if (isPortal) {
      const existing = portalPopovers.get(link)!
      existing.classList.add("visible")
      return setPosition(existing)
    }
    return setPosition(link.lastChild as HTMLElement)
  }

  const thisUrl = new URL(document.location.href)
  thisUrl.hash = ""
  thisUrl.search = ""
  const targetUrl = new URL(link.href)
  const hash = decodeURIComponent(targetUrl.hash)
  targetUrl.hash = ""
  targetUrl.search = ""

  const response = await fetch(`${targetUrl}`).catch((err) => {
    console.error(err)
  })

  // bailout if another popover exists
  if (hasAlreadyBeenFetched()) {
    return
  }

  if (!response) return
  const [contentType] = response.headers.get("Content-Type")!.split(";")
  const [contentTypeCategory, typeInfo] = contentType.split("/")

  const popoverElement = document.createElement("div")
  popoverElement.classList.add("popover")
  const popoverInner = document.createElement("div")
  popoverInner.classList.add("popover-inner")
  popoverElement.appendChild(popoverInner)

  popoverInner.dataset.contentType = contentType ?? undefined

  switch (contentTypeCategory) {
    case "image":
      const img = document.createElement("img")
      img.src = targetUrl.toString()
      img.alt = targetUrl.pathname

      popoverInner.appendChild(img)
      break
    case "application":
      switch (typeInfo) {
        case "pdf":
          const pdf = document.createElement("iframe")
          pdf.src = targetUrl.toString()
          popoverInner.appendChild(pdf)
          break
        default:
          break
      }
      break
    default:
      const contents = await response.text()
      const html = p.parseFromString(contents, "text/html")
      normalizeRelativeURLs(html, targetUrl)
      const elts = [...html.getElementsByClassName("popover-hint")]
      if (elts.length === 0) return

      elts.forEach((elt) => popoverInner.appendChild(elt))
  }

  setPosition(popoverElement)

  if (isPortal) {
    document.body.appendChild(popoverElement)
    portalPopovers.set(link, popoverElement)
    portalElements.add(popoverElement)
    popoverElement.classList.add("visible")

    // Hide on mouseleave with grace period for moving to popover
    let hideTimer: ReturnType<typeof setTimeout> | null = null
    const hide = () => popoverElement.classList.remove("visible")

    link.addEventListener("mouseleave", () => {
      hideTimer = setTimeout(hide, 200)
    })
    popoverElement.addEventListener("mouseenter", () => {
      if (hideTimer) clearTimeout(hideTimer)
    })
    popoverElement.addEventListener("mouseleave", hide)

    window.addCleanup(() => {
      popoverElement.remove()
      portalElements.delete(popoverElement)
    })
  } else {
    link.appendChild(popoverElement)
  }

  if (hash !== "") {
    const heading = popoverInner.querySelector(hash) as HTMLElement | null
    if (heading) {
      // leave ~12px of buffer when scrolling to a heading
      popoverInner.scroll({ top: heading.offsetTop - 12, behavior: "instant" })
    }
  }
}

document.addEventListener("nav", () => {
  const links = [...document.getElementsByClassName("internal")] as HTMLAnchorElement[]
  for (const link of links) {
    link.addEventListener("mouseenter", mouseEnterHandler)
    window.addCleanup(() => link.removeEventListener("mouseenter", mouseEnterHandler))
  }

  window.addCleanup(() => {
    for (const el of portalElements) el.remove()
    portalElements.clear()
  })
})
