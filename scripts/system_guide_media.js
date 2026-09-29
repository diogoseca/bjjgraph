import { ngSystemPreviewURL, ngMountSystemPreview } from "./system-preview.js"

// One controller owns the visible static guide across Quartz navigation.
const controllerKey = '__bjjStaticSystemPreview'
if (!window[controllerKey]) {
  let active = null
  let suspended = false
  let currentPath = location.pathname
  const watched = new Set()
  // A failed Neural bundle can reveal the article after module init. Observe even
  // hidden sections so their first visible size retries mounting, and hiding or
  // removal stops playback. Layout changes require no app-runtime coupling.
  const visibility = new ResizeObserver(() => {
    if (!suspended) reconcile()
  })
  function stop() {
    if (!active) return
    active.handle.destroy()
    if (active.fallback) active.fallback.hidden = false
    active = null
  }
  function reconcile() {
    const sections = [...document.querySelectorAll('[data-system-preview]')]
    for (const section of watched) {
      if (!sections.includes(section)) { visibility.unobserve(section); watched.delete(section) }
    }
    for (const section of sections) {
      if (!watched.has(section)) { watched.add(section); visibility.observe(section) }
    }
    const section = !document.hidden && sections.find(el => el.getClientRects().length)
    const preview = section && { provider: section.dataset.provider, embed_url: section.dataset.embedUrl, title: section.dataset.previewTitle }
    const url = preview && ngSystemPreviewURL(preview)
    const target = section && section.querySelector('[data-preview-player]')
    const fallback = section && section.querySelector('[data-preview-fallback]')
    if (!url || !target) { stop(); return }
    const key = section.dataset.systemKey || location.pathname
    if (active && active.key === key && active.url === url && (active.frame.isConnected || active.target === target)) {
      if (active.failed) return
      if (active.frame.isConnected && active.frame.parentNode !== target) {
        if (target.moveBefore && active.frame.isConnected) target.moveBefore(active.frame, null)
        else target.appendChild(active.frame)
      }
      if (fallback) fallback.hidden = active.ready
      active.fallback = fallback
      active.target = target
      return
    }
    stop()
    const state = { key, url, target, fallback, ready: false, failed: false }
    const handle = ngMountSystemPreview(target, preview, {
      onReady() { state.ready = true; if (state.fallback) state.fallback.hidden = true },
      onError() { state.failed = true; if (state.fallback) state.fallback.hidden = false; target.hidden = true },
    })
    if (!handle) return
    target.hidden = false
    // Keep callbacks and reconciliation on the same state object.
    Object.assign(state, { frame: handle.frame, handle })
    active = state
  }
  function init() {
    currentPath = location.pathname
    suspended = false
    reconcile()
  }
  function pause() {
    suspended = true
    visibility.disconnect()
    watched.clear()
    stop()
  }
  window[controllerKey] = { init, stop: pause }
  document.addEventListener('nav', init)
  window.addEventListener('pagehide', pause)
  window.addEventListener('pageshow', init)
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else init() })
  window.addEventListener('popstate', () => {
    if (currentPath !== location.pathname) pause()
  })
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]')
    if (!link || link.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const next = new URL(link.href, location.href)
    if (next.origin !== location.origin || next.pathname !== location.pathname) pause()
  }, true)
}
window[controllerKey].init()
