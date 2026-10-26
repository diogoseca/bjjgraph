import type { Page } from '@playwright/test'

// D-433 / D-370 adapted to U35: observe the actual reader and hit targets.
// These helpers never align, focus, click or scroll a surface.
export async function questionGeometry(page: Page) {
  return page.evaluate(() => {
    const a = (window as any).__neural, root = a._reader.root
    const reader = root.getBoundingClientRect()
    const bounds = { top: Math.max(0, reader.top), bottom: Math.min(innerHeight, reader.bottom),
      left: Math.max(0, reader.left), right: Math.min(innerWidth, reader.right) }
    const rect = (e: Element) => e.getBoundingClientRect().toJSON()
    const target = (e: HTMLElement) => {
      const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
      let opacity = 1
      for (let p: HTMLElement | null = e; p; p = p.parentElement) opacity *= Number(getComputedStyle(p).opacity)
      const hit = document.elementFromPoint(x, y)
      return { rect: r.toJSON(), hit: !!hit && e.contains(hit), opacity,
        inside: r.top >= bounds.top && r.bottom <= bounds.bottom && r.left >= bounds.left && r.right <= bounds.right,
        bottomMargin: bounds.bottom - r.bottom, fontSize: getComputedStyle(e).fontSize }
    }
    const stage = a._landEl.querySelector('.ng-question-stage'), block = stage.firstElementChild
    const reveal = a._landEl.querySelector('[data-question-reveal]')
    return { reader: reader.toJSON(), bounds, scrollTop: root.scrollTop, pageScroll: window.scrollY,
      band: a._reader.nodeBand, card: rect(a._landEl), moves: rect(a.optionsRef.current),
      stage: rect(stage), answerBlock: { ...rect(block), display: getComputedStyle(block).display,
        visibility: getComputedStyle(block).visibility, inert: block.inert },
      reveal: reveal ? target(reveal) : null,
      answers: [...a._landEl.querySelectorAll('[data-panic-mc-opt]')].map(e => target(e as HTMLElement)) }
  })
}

export async function watchQuestionScroll(page: Page) {
  await page.evaluate(() => {
    const w = window as any, root = w.__neural._reader.root
    const writes: any[] = [], events: number[] = [], restore: (() => void)[] = []
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop')!
    Object.defineProperty(root, 'scrollTop', { configurable: true,
      get() { return descriptor.get!.call(this) },
      set(value) { writes.push({ method: 'scrollTop', value, stack: new Error().stack }); descriptor.set!.call(this, value) } })
    restore.push(() => delete root.scrollTop)
    for (const name of ['scroll', 'scrollTo', 'scrollBy', 'scrollIntoView']) {
      const original = (Element.prototype as any)[name]
      ;(Element.prototype as any)[name] = function (...args: any[]) {
        if (this === root || root.contains(this) || this.contains(root)) writes.push({ method: name, args, stack: new Error().stack })
        return original.apply(this, args)
      }
      restore.push(() => { (Element.prototype as any)[name] = original })
    }
    for (const name of ['scroll', 'scrollTo', 'scrollBy']) {
      const original = w[name]
      w[name] = function (...args: any[]) { writes.push({ method: 'window.' + name, args, stack: new Error().stack }); return original.apply(this, args) }
      restore.push(() => { w[name] = original })
    }
    const onScroll = () => events.push(root.scrollTop)
    root.addEventListener('scroll', onScroll)
    restore.push(() => root.removeEventListener('scroll', onScroll))
    w.__questionScrollAudit = { top: root.scrollTop, pageTop: window.scrollY, writes, events,
      stop() { restore.forEach(fn => fn()) } }
  })
}

export async function stopQuestionScroll(page: Page) {
  return page.evaluate(() => {
    const w = window as any, audit = w.__questionScrollAudit
    const result = { before: audit.top, after: w.__neural._reader.root.scrollTop,
      pageBefore: audit.pageTop, pageAfter: window.scrollY, writes: audit.writes, events: audit.events }
    audit.stop(); delete w.__questionScrollAudit
    return result
  })
}
