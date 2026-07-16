import { expect, type Page } from "@playwright/test"

/**
 * Journey DSL — Playwright plays AS the user through the Neural Graph app.
 *
 * Contract with the app's TEST RAILS (implemented in neural/src/app.src.jsx, P0):
 *   window.__neural.rig(tag, values[])  — queue deterministic values for a tagged RNG site;
 *                                         every Math.random in the app is `this.rng(tag)`.
 *   window.__neural.testMode(true)      — stop the free-running rAF loop; frames advance only
 *                                         via advance().
 *   window.__neural.advance(ms)         — the frame pump: steps timers (after()), travel,
 *                                         camera, halo smoothing and draw in fixed 16.6ms ticks.
 *   window.__neural.beats               — array of fx beat events ({t, beat, ...props}) emitted
 *                                         by the fx() facade: land, options_dealt, bonus_pumped,
 *                                         commit, impact_success, impact_fail, defend_start,
 *                                         escape, finish, roll_end.
 *
 * Journeys click REAL UI surfaces (option cards, drill buttons) — internal methods are used
 * only where canvas hit-testing has no DOM (documented per call).
 */

type W = Window & { __neural?: any; NG_CONTENT?: any }

export class Journey {
  constructor(private page: Page) {}

  /** Boot the app fresh on a route with the deterministic rails engaged. */
  async boot(path = "/", opts: { seedRolls?: Record<string, number[]> } = {}) {
    await this.page.addInitScript(() => {
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch {}
      // engage test mode BEFORE the bundle boots: the app checks this flag at construction
      ;(window as any).__NEURAL_TEST__ = true
    })
    await this.page.goto(path)
    await this.page.waitForFunction(
      () => {
        const a = (window as W).__neural
        return !!(a && a.nodes && a.nodes.length && typeof a.advance === "function" && a.flashcards && a.flashcards.decks)
      },
      undefined,
      { timeout: 30_000 },
    )
    if (opts.seedRolls) {
      for (const [tag, values] of Object.entries(opts.seedRolls)) await this.rig(tag, values)
    }
    return this
  }

  /** Queue deterministic values for a tagged RNG site. */
  async rig(tag: string, values: number[]) {
    await this.page.evaluate(([t, v]) => (window as W).__neural.rig(t as string, v as number[]), [tag, values] as const)
    return this
  }

  /** Pump simulated time through the app in fixed ticks. */
  async advance(ms: number) {
    await this.page.evaluate((m) => (window as W).__neural.advance(m), ms)
    return this
  }

  /** Land the roll at a named position (rigged start), completing the intro. */
  async land(position: string) {
    await this.page.evaluate((pos) => {
      const a = (window as W).__neural
      const idx = a.nodes.findIndex((n: any) => n.ty === "positions" && n.t === pos)
      if (idx < 0) throw new Error(`position not found: ${pos}`)
      a.rigStart(idx) // test rail: next startRoll begins here (deterministic role=top)
    }, position)
    // intro (3.2s) + roll-start toast + landing + options dealt — pump until the hand exists
    for (let i = 0; i < 12; i++) {
      await this.advance(1000)
      const n = await this.page.evaluate(() => ((window as W).__neural.optionIdxs || []).length)
      if (n > 0) break
    }
    return this
  }

  /** The visible option cards (bottom tray), by title. */
  async optionTitles(): Promise<string[]> {
    return this.page.evaluate(() => {
      const a = (window as W).__neural
      return (a.optionIdxs || []).map((o: any) => a.nodes[typeof o === "number" ? o : o.idx]?.t).filter(Boolean)
    })
  }

  /** Pick an option like a user: click its tray card (expand sheet opens), then confirm Go. */
  async pick(technique: string) {
    const card = this.page.locator(`[data-tech="${technique}"]`).first()
    await expect(card, `option card for "${technique}" visible`).toBeVisible()
    await card.click()
    const go = this.page.locator("[data-go]").first()
    await expect(go, "expand-sheet Execute button visible").toBeVisible()
    await go.click()
    return this
  }

  /** Read the currently displayed success % for a technique's option card. */
  async displayedOdds(technique: string): Promise<number> {
    return this.page.evaluate((t) => {
      const a = (window as W).__neural
      const idx = a.nodes.findIndex((n: any) => n.t === t)
      return Math.round(a.moveChance(a.nodes[idx]) * 100)
    }, technique)
  }

  /** Drill n cards of the CURRENT position's deck via the same choke points the UI uses. */
  async drill(n: number) {
    for (let i = 0; i < n; i++) {
      await this.page.evaluate((idx) => {
        const a = (window as W).__neural
        const key = a.deckKeyFor(a.nodes[a.currentPos]).key
        const deck = a.flashcards?.decks?.[key]
        if (!deck || !deck.cards.length) throw new Error(`no deck for ${key}`)
        const card = deck.cards[Math.min(idx, deck.cards.length - 1)]
        if (!card) throw new Error(`no card ${idx} in ${key}`)
        // drill rail: grade the card correct through the same choke the UI uses
        a.prep[key] = (a.prep[key] || 0) + 1
        a.noteCardDone(card, key)
        a.refreshOptionOdds()
      }, i)
    }
    return this
  }

  /** Beat events emitted since boot. */
  async beats(): Promise<Array<{ beat: string }>> {
    return this.page.evaluate(() => ((window as W).__neural.beats || []).slice())
  }

  async expectBeat(beat: string) {
    const bs = await this.beats()
    expect(bs.map((b) => b.beat), `beat "${beat}" emitted`).toContain(beat)
    return this
  }

  /** The visited-position trail of the current roll. */
  async rollTrail(): Promise<string[]> {
    return this.page.evaluate(() => {
      const a = (window as W).__neural
      return (a.rollLog || []).map((h: any) => h.name + "/" + h.role)
    })
  }

  async currentPosition(): Promise<string> {
    return this.page.evaluate(() => {
      const a = (window as W).__neural
      return a.nodes[a.currentPos]?.t || ""
    })
  }

  /** Outcome of the most recently ENDED roll — read from the durable beat stream (the live
   *  _lastOutcome field is cleared the moment the next roll auto-starts). */
  async lastOutcome(): Promise<string> {
    return this.page.evaluate(() => {
      const beats = ((window as W).__neural.beats || []).filter((b: any) => b.beat === "roll_end")
      return beats.length ? beats[beats.length - 1].outcome || "" : ""
    })
  }

  async keyframe(name: string) {
    await this.page.screenshot({ path: `e2e/gallery/${name}.png` })
    return this
  }
}

export const journey = (page: Page) => new Journey(page)
