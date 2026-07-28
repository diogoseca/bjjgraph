/* @hyperspace {"theme":"onboarding","L":"fresh-visitor","F":"option-tray-sheet","B":"happy-path"} @invariant "The very first thing highlighted for a brand-new player is the option tray: beaconState() is null before any hand is dealt and becomes exactly {target:'options'} with exactly one [data-beacon] the instant the first hand lands — first-contact guidance points at the tray, nothing else." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { freshVisitor } from "./personas"

/**
 * ONBOARDING — FIRST-CONTACT BEACON IS THE OPTION TRAY (and nothing else).
 *
 * A brand-new player's very first guided highlight must land on the option tray — the hand they
 * have to read. This spec pins the TRANSITION at that first moment of guidance: the Beat Beacon is
 * absent before any hand exists (null state, zero [data-beacon]) and, the instant the first hand is
 * dealt, becomes EXACTLY one [data-beacon] whose target is "options" and whose backing element IS
 * the tray node (optionsRef.current). No other surface competes for the first-ever highlight.
 *
 * Sibling to guidance-defense.spec.ts's "one-beacon law", which asserts the POST-land count===1 +
 * target==="options" mid-play. This spec adds the coverage that test lacks: the PRE-land null/zero
 * state (the "very first thing / nothing before") and the element-identity + attr-value proof (the
 * beacon element IS the tray, not merely a node labelled "options").
 *
 * Mechanism under test (source-verified, neural/src/app.src.jsx):
 *   _beacon        — never initialized → beaconState() (line 3947: `return this._beacon ? {target} : null`)
 *                    is null until the first setBeacon. No hand yet ⇒ no beacon.
 *   dealOptions()  — on the first landing sets the beacon at line 4302: `setBeacon("options", el)`
 *                    where `el = this.optionsRef.current` (line 4293) — the tray node itself.
 *   setBeacon()    — line 3942: `el.setAttribute("data-beacon", target)` + stores `{target, el}`, so
 *                    the attr VALUE === target === "options", written on the tray node.
 *   maybeStartCoach() fires AFTER at line 4303 but renderCoach builds a separate [data-coach]
 *                    element (NOT a [data-beacon]) — so the one-beacon law holds regardless; land()'s
 *                    default dismissCoach() removes the coach card anyway, leaving the tray sole.
 *
 * Working recipe (probe-verified, 2/2 deterministic, ~1.9s each):
 *   - freshVisitor() is undefined by design → boot("/") wipes storage, seeds NO initialState, so no
 *     prior hand and no beacon exist at boot. No rig needed for the beacon itself.
 *   - PRE-land assertions hold because test mode FREEZES the rAF loop: the intro/roll only advances
 *     via advance(). Immediately after boot (before land) the app has dealt nothing.
 *   - land("Mount Top") + advance(500): land() rigs ai-skill/role/max-moves internally and dismisses
 *     the coach by default, so the tray is the SOLE highlight when the first hand lands.
 *   - SELECTORS: [data-beacon] count + its data-beacon attr value + beaconState() shape + element
 *     identity vs optionsRef.current. All STRUCTURAL — never card/copy text. optionIdxs.length is a
 *     belt-and-suspenders "no hand exists yet" check pre-land. No rig queues; viewport config default.
 */

const POSITION = "Mount Top" // a valid positions node land() can rig-start on

test("first-contact: beacon is null with zero [data-beacon] pre-land, then exactly the option tray on the first hand", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  // freshVisitor() → boot wipes storage and passes no initialState: a truly brand-new player with
  // no prior hand and therefore no beacon at boot.
  await j.boot("/", { initialState: freshVisitor() })

  const beaconState = () => page.evaluate(() => (window as any).__neural.beaconState())
  const beaconCount = () => page.locator("[data-beacon]").count()
  const optionCount = () => page.evaluate(() => (((window as any).__neural || {}).optionIdxs || []).length)

  // ── PRE-LAND: no hand has been dealt (test mode froze the rAF loop; only advance() would deal),
  // so there is NOTHING to guide toward — beaconState() is null and no [data-beacon] exists. ──
  expect(await beaconState(), "beaconState() is null before any hand is dealt — nothing highlighted yet").toBeNull()
  expect(await beaconCount(), "zero [data-beacon] surfaces before the first hand").toBe(0)
  expect(await optionCount(), "belt-and-suspenders: no hand exists yet (optionIdxs empty)").toBe(0)

  // ── FIRST HAND: land the first roll (coach dismissed by default → tray is the sole highlight). ──
  await j.land(POSITION)
  await j.advance(500)

  // ── POST-LAND: the beacon now points at EXACTLY the option tray, and nothing else. ──
  // Shape proof: deep-equals { target: "options" } (proves the whole beaconState shape, not just target).
  expect(await beaconState(), "beaconState() is exactly { target: 'options' } once the first hand lands").toEqual({
    target: "options",
  })

  // One-beacon proof: exactly one [data-beacon] in the DOM — first-contact guidance is singular.
  expect(await beaconCount(), "exactly one [data-beacon] the instant the first hand lands").toBe(1)

  // Attr-value proof: the DOM attribute carries the literal target "options" (setBeacon writes it).
  expect(
    await page.locator("[data-beacon]").first().getAttribute("data-beacon"),
    "the [data-beacon] attribute value is literally 'options'",
  ).toBe("options")

  // Element-identity proof (the STRONGEST "beacon element IS the tray" check): the single beacon
  // node is the very optionsRef.current tray node — not merely some node labelled "options".
  expect(
    await page.evaluate(() => document.querySelector("[data-beacon]") === (window as any).__neural.optionsRef.current),
    "the [data-beacon] element IS the option tray (optionsRef.current), not a look-alike",
  ).toBe(true)

  expect(errors, "no pageerror across boot, the pre-land probe, and the first landing").toEqual([])
})
