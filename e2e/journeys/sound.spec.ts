import { test, expect } from "@playwright/test";
import { journey } from "../dsl";

/**
 * PURPOSEFUL FEEDBACK SOUNDS ON THE fx() BEAT BUS.
 *
 * One WebAudio synth module (neural/src/sound.src.js, composed into the bundle) subscribes
 * to mapped fx() beats, so audio, journeys, and animation share one vocabulary. Under
 * isTest() NO AudioContext is ever created: beats log to a ring
 * buffer (window.__neural.sound.soundLog) that journeys read exactly like the beats array.
 *
 * Surfaces forced into existence:
 *   NGSound {beat(name, props), soundLog, _ctxCreated} · this.sound wired in boot ·
 *   one-line hook in fx() · settings rows sound (on/off) + soundVolume · rate limits
 *   (≥40ms voice spacing, 100ms same-beat dedupe) · rng("sfx") only (check_no_raw_random
 *   covers the file with count 0).
 */

test("the ring buffer logs patches for gameplay beats", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const log0 = await j.soundLog();

  await j.drill(1); // grade a card → bonus_pumped
  const log = await j.soundLog();
  expect(log.length).toBeGreaterThan(log0.length);
  const entry = log.filter((s: any) => s.beat === "bonus_pumped").pop() as any;
  expect(entry).toBeTruthy();
  expect(typeof entry.patch).toBe("string");
  expect(entry.patch.length).toBeGreaterThan(0);
});

test("the canonical palette maps every catalog cue to a synthesis voice", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")

  const palette = await page.evaluate(async () => {
    const app = (window as any).__neural
    const catalog = (window as any).NG_SOUND_CATALOG
    const start = app.sound.soundLog.length
    for (const cue of catalog) {
      app.sound._lastVoice = -1e9
      app.sound._lastByBeat[cue.beat] = -1e9
      app.sound.beat(cue.beat)
    }
    const playScene = async (beats: string[]) => {
      const Engine = (window as any).NGSound
      const played: string[] = []
      const engine = new Engine({
        isTest: () => false,
        get: (_key: string, fallback: string) => fallback,
      })
      engine._play = (patch: { id: string }) => {
        played.push(patch.id)
        return true
      }
      beats.forEach((beat) => engine.beat(beat))
      await new Promise((resolve) => setTimeout(resolve, 70))
      engine.destroy()
      return played
    }
    return {
      cues: catalog.length,
      groups: new Set(catalog.map((cue: any) => cue.group)).size,
      voices: app.sound.soundLog.slice(start).map((entry: any) => entry.patch),
      winner: catalog.find((cue: any) => cue.beat === "victory_cascade")?.voice,
      loser: catalog.find((cue: any) => cue.beat === "defeat_drain")?.voice,
      scenes: {
        bigCombo: await playScene(["combo", "combo_big"]),
        defense: await playScene(["defend_start", "caught"]),
        checkpoint: await playScene(["checkpoint_passed", "unit_done"]),
        beltWin: await playScene([
          "belt_test_won",
          "victory_cascade",
          "finish",
          "roll_end",
        ]),
        defeat: await playScene(["defeat_drain", "roll_end"]),
      },
    }
  })

  expect(palette.cues).toBeGreaterThanOrEqual(40)
  expect(palette.groups).toBeGreaterThanOrEqual(7)
  expect(palette.voices).toHaveLength(palette.cues)
  expect(palette.voices).not.toContain("boom")
  expect(palette.voices).not.toContain("deal-arp")
  expect(palette.winner).toContain("fanfare")
  expect(palette.loser).toBe("reactor-shutdown")
  expect(palette.scenes.bigCombo).toEqual(["momentum-supernova"])
  expect(palette.scenes.defense).toEqual(["shield-charge"])
  expect(palette.scenes.checkpoint).toEqual(["constellation-complete"])
  expect(palette.scenes.beltWin).toEqual(["belt-fanfare"])
  expect(palette.scenes.defeat).toEqual(["reactor-shutdown"])
})

test("a rigged win plays the victory fanfare", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const subName = await page.evaluate(() => {
    const a = (window as any).__neural;
    const subs = (a.optionIdxs || [])
      .map((i: number) => a.nodes[i])
      .filter((n: any) => n.ty === "submissions");
    return subs.length ? subs[0].t : null;
  });
  test.skip(!subName, "no submission from the start position");
  await j.rig("resolve", [0.01]);
  await j.pick(subName as string);
  await j.advanceUntil("roll_end", 20000);

  const log = await j.soundLog();
  const fanfare = log
    .filter((s: any) => s.beat === "victory_cascade")
    .pop() as any;
  expect(fanfare).toBeTruthy();
  expect(fanfare.patch).toContain("fanfare");
});

test("sound off: the log goes silent", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await page.evaluate(() => (window as any).__neural.set("sound", "off"));
  const n0 = (await j.soundLog()).length;
  await j.drill(2);
  expect((await j.soundLog()).length).toBe(n0);
});

test("volume setting rides every logged voice", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await page.evaluate(() => (window as any).__neural.set("soundVolume", "0.8"));
  await j.drill(1);
  const entry = (await j.soundLog()).pop() as any;
  expect(entry.volume).toBeCloseTo(0.8, 5);
});

test("same-beat dedupe: two identical beats within 100ms log one voice", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const n = await page.evaluate(() => {
    const a = (window as any).__neural;
    const before = a.sound.soundLog.length;
    a.fx("bonus_pumped", { deck_key: "x" });
    a.fx("bonus_pumped", { deck_key: "x" }); // immediate repeat → deduped
    return a.sound.soundLog.length - before;
  });
  expect(n).toBe(1);
});

test("no AudioContext is ever created under test", async ({ page }) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await j.drill(1);
  const state = await page.evaluate(() => {
    const s = (window as any).__neural.sound;
    return { ctxCreated: s._ctxCreated, logNonEmpty: s.soundLog.length > 0 };
  });
  expect(state.ctxCreated).toBe(false);
  expect(state.logNonEmpty).toBe(true);
});

test("Challenge rewards use restrained patch and Mat Coin acknowledgements", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });
  await page.evaluate(() => {
    const app = (window as any).__neural;
    app.fx("escape", { via: "Elbow Escape" });
    app.fx("escape", { via: "Elbow Escape" });
    app.fx("escape", { via: "Elbow Escape" });
  });

  const log = await j.soundLog();
  const coin = log
    .filter((entry: any) => entry.beat === "coin_earned")
    .pop() as any;
  expect(coin).toBeTruthy();
  expect(coin.patch).toBe("coin-mint");
  expect(
    await page.evaluate(() => !!(window as any).__neural.coins?.houdini),
  ).toBe(true);
});

test("turning sound off silences rewards without suppressing the collectible", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/", { keepTutorial: true });
  await page.evaluate(() => {
    const app = (window as any).__neural;
    app.set("sound", "off");
    app.fx("escape", { via: "Elbow Escape" });
    app.fx("escape", { via: "Elbow Escape" });
    app.fx("escape", { via: "Elbow Escape" });
  });

  expect(
    (await j.soundLog()).filter((entry: any) => entry.beat === "coin_earned"),
  ).toHaveLength(0);
  expect(
    await page.evaluate(() => !!(window as any).__neural.coins?.houdini),
  ).toBe(true);
});
