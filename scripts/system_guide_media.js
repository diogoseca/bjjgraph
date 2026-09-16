// Built-only static enhancement. No iframe or provider request before a verified-origin click.
let active = null
function stop() {
  if (!active) return
  active.frame.remove()
  active.button.hidden = false
  active = null
}
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
function init() {
  stop()
  document.querySelectorAll('[data-system-preview]').forEach(section => {
    const button = section.querySelector('[data-load-preview]')
    const target = section.querySelector('[data-preview-player]')
    const url = validPlayer(section)
    if (!button || !target) return
    button.hidden = !url
    if (!url || button.dataset.bound) return
    button.dataset.bound = 'true'
    button.addEventListener('click', () => {
      stop()
      const frame = document.createElement('iframe')
      frame.title = section.dataset.previewTitle || 'Official course sample'
      frame.referrerPolicy = 'strict-origin-when-cross-origin'
      frame.allow = 'fullscreen; picture-in-picture; encrypted-media'
      frame.allowFullscreen = true
      frame.style.cssText = 'width:100%;aspect-ratio:16/9;border:0'
      frame.src = url
      target.appendChild(frame)
      button.hidden = true
      active = { frame, button }
    })
  })
}
document.addEventListener('nav', init)
window.addEventListener('popstate', stop)
window.addEventListener('pagehide', stop)
document.addEventListener('click', event => {
  const link = event.target.closest?.('a[href]')
  if (link && link.target !== '_blank') stop()
}, true)
init()
