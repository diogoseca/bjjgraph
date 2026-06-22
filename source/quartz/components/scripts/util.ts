export function registerEscapeHandler(outsideContainer: HTMLElement | null, cb: () => void) {
  if (!outsideContainer) return
  function click(this: HTMLElement, e: HTMLElementEventMap["click"]) {
    if (e.target !== this) return
    e.preventDefault()
    e.stopPropagation()
    cb()
  }

  function esc(e: HTMLElementEventMap["keydown"]) {
    if (!e.key.startsWith("Esc")) return
    e.preventDefault()
    cb()
  }

  outsideContainer?.addEventListener("click", click)
  window.addCleanup(() => outsideContainer?.removeEventListener("click", click))
  document.addEventListener("keydown", esc)
  window.addCleanup(() => document.removeEventListener("keydown", esc))
}

export function removeAllChildren(node: HTMLElement) {
  while (node.firstChild) {
    node.removeChild(node.firstChild)
  }
}

/** localStorage.setItem that never throws into the caller. On QuotaExceededError
 * (Safari private mode / full store) it surfaces a snackbar and returns false
 * instead of aborting the in-progress flow (e.g. a flashcard grade). */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    const err = e as { name?: string; code?: number }
    if (err?.name === "QuotaExceededError" || err?.code === 22) {
      ;(window as any).showSnackbar?.({
        type: "failure",
        message: "Storage full — changes weren't saved. Sign in to sync or clear space.",
      })
    } else {
      console.error("[storage] setItem failed:", e)
    }
    return false
  }
}
