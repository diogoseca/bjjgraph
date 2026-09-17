// Official samples mount immediately on verified origins; video never autoplays.
// One shared controller survives Quartz's repeated module evaluation during navigation.
const controllerKey = '__bjjStaticSystemPreview'
function validPlayer(section) {
  try {
    const url = new URL(section.dataset.embedUrl)
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return null
    if (!JSON.parse(section.dataset.verifiedOrigins).includes(location.origin)) return null
    if (section.dataset.provider === 'bunny') {
      if (url.host !== 'iframe.mediadelivery.net' || !/^\/embed\/\d+\/[a-f0-9-]{36}$/i.test(url.pathname) || url.searchParams.get('autoplay') !== 'false' || url.searchParams.get('preload') !== 'false') return null
    } else if (section.dataset.provider === 'youtube') {
      if (!['www.youtube.com', 'www.youtube-nocookie.com'].includes(url.host) || !/^\/embed\/[\w-]{11}$/.test(url.pathname) || url.searchParams.get('autoplay') !== '0') return null
    } else return null
    return url.href
  } catch { return null }
}
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
    active.frame.remove()
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
    const section = sections.find(el => el.getClientRects().length)
    const url = section && validPlayer(section)
    const target = section && section.querySelector('[data-preview-player]')
    const fallback = section && section.querySelector('[data-preview-fallback]')
    if (!url || !target) { stop(); return }
    const key = section.dataset.systemKey || location.pathname
    if (active && active.key === key && active.url === url) {
      if (active.frame.parentNode !== target) {
        if (target.moveBefore && active.frame.isConnected) target.moveBefore(active.frame, null)
        else target.appendChild(active.frame)
      }
      if (fallback) fallback.hidden = true
      active.fallback = fallback
      return
    }
    stop()
    const frame = document.createElement('iframe')
    frame.title = section.dataset.previewTitle || 'Official course sample'
    frame.referrerPolicy = 'strict-origin-when-cross-origin'
    frame.allow = 'fullscreen; picture-in-picture; encrypted-media'
    frame.allowFullscreen = true
    frame.style.cssText = 'width:100%;aspect-ratio:16/9;border:0;pointer-events:auto'
    frame.src = url
    target.appendChild(frame)
    if (fallback) fallback.hidden = true
    active = { key, url, frame, fallback, path: location.pathname }
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
