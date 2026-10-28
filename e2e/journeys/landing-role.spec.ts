import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

// Exercise the normal opening and restart, without rigStart (which bypasses the draw).
// Reads the intro DOM and draw()'s published label; deleting startRoll's seat resolution
// must fail the Bottom cases. The DSL omits dossier content; none is needed for identity.
for (const role of ["bottom", "top"] as const) {
  test(`@curated a ${role} opening keeps its seat from intro to landing and Carni restart`, async ({ page }) => {
    const j = journey(page);
    await j.boot("/", { seedRolls: { role: [role === "bottom" ? 0.9 : 0], "start-pos": [0] } });

    const readSeat = () => page.evaluate(() => {
      const a = (window as any).__neural;
      const n = a.nodes[a.currentPos];
      const f = a.nodes[a.focusIdx];
      return {
        idx: a.currentPos, role: a.playerRole, nodeRole: n.role, focusRole: f.role,
        name: a.graphName(n), deck: a.deckKeyFor(n).key,
        introName: a.evcTextRef.current.textContent, introRole: a.evcSubRef.current.textContent,
        label: a._lastPairLabel,
      };
    });

    for (const opening of ["first", "Carni"]) {
      if (opening === "Carni") {
        // Select the middle of Carni's slot in the actual random pool. Leave the pool and
        // role draw intact, including the one-entry-per-position distribution.
        const draw = await page.evaluate(() => {
          const a = (window as any).__neural;
          const slot = a._posIdx.findIndex((idx: number) => a.graphName(a.nodes[idx]) === "Carni");
          return { slot, value: (slot + 0.5) / a._posIdx.length };
        });
        expect(draw.slot, "Carni is in the normal opening pool").toBeGreaterThanOrEqual(0);
        await j.rig("start-pos", [draw.value]);
        await j.rig("role", [role === "bottom" ? 0.9 : 0]);
        await page.evaluate(() => (window as any).__neural.resetRoll());
      }
      // Observe the named intro BEFORE enterLand can repair or replace any state.
      await expect.poll(async () => {
        await j.advance(100);
        return page.evaluate(() => {
          const a = (window as any).__neural;
          return a._arriveLabelT != null && !!a.evcTextRef.current.textContent;
        });
      }, { timeout: 30000, intervals: [10] }).toBe(true);
      const intro = await readSeat();
      const word = role === "bottom" ? "Bottom" : "Top";
      expect(intro.introRole).toBe(word);
      expect(intro.introName).toBe(intro.name);
      expect(intro.nodeRole, "the named seat owns the opening node").toBe(role);
      expect(intro.focusRole, "the camera follows that seat during the flight").toBe(role);
      if (opening === "Carni") expect(intro.name).toBe("Carni");

      // The hand is already dealt when the intro names the node. Wait for the hand-off,
      // not for a second options_dealt event that requires playing another move.
      await expect.poll(async () => {
        await j.advance(200);
        return page.evaluate(() => {
          const a = (window as any).__neural;
          return a._arriveGlideUntil == null && a.optionIdxs.length > 0;
        });
      }, { timeout: 30000, intervals: [10] }).toBe(true);
      await j.landQuestion();
      await j.advance(300);
      const landed = await readSeat();
      expect(landed.idx, "the intro hands off to the same node").toBe(intro.idx);
      expect(landed.role).toBe(role);
      expect(landed.focusRole).toBe(role);
      expect(landed.deck).toBe(`${landed.name}|${word}`);
      expect(landed.label, "the graph drew its focused pair label").not.toBeNull();
      expect(landed.label.focused).toBe(true);
      expect(landed.label.main).toBe(landed.name);
      expect(landed.label.sub).toBe(word.toUpperCase());
    }
  });
}
