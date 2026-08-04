import { expect, test } from "@playwright/test";
import { journey } from "../dsl";

const LEGACY_IDS = [
  "coach1",
  "coach2",
  "coach3",
  "answer",
  "sheet",
  "commit",
  "sweep",
  "win1",
  "refund",
  "defend",
  "escape",
  "roll",
  "pane_open",
  "pane_close",
  "film",
  "recall",
  "roam",
  "path",
  "lesson",
  "belt",
];

const progressBlob = (overrides: Record<string, unknown> = {}) => ({
  v: 2,
  prep: {},
  rec: {},
  stage: {},
  units: {},
  belts: { won: {} },
  tut: { done: {} },
  challenges: {},
  badges: {},
  coins: {},
  days: {},
  settings: {},
  settingsAt: {},
  updatedAt: 100,
  ...overrides,
});

test.describe("Challenge engine @curated", () => {
  test("a legacy 7/20 user migrates exactly and keeps the v2 compatibility write", async ({
    page,
  }) => {
    const j = journey(page);
    const done = Object.fromEntries(
      LEGACY_IDS.slice(0, 7).map((id) => [id, 1]),
    );
    await j.boot("/", {
      keepTutorial: true,
      initialState: progressBlob({ tut: { done } }),
    });

    const state = await page.evaluate(() => {
      const app = (window as any).__neural;
      const blob = app._progressBlob();
      return {
        white: app.challengeTrackProgress("white"),
        legacy: app.tutDoneCount(),
        challengeDone: Object.values(app.challenges).filter(
          (entry: any) => entry.done,
        ).length,
        blobVersion: blob.v,
        blobLegacy: Object.keys(blob.tut.done).length,
        blobWhite: Object.keys(blob.challenges).filter((id) =>
          id.startsWith("white."),
        ).length,
      };
    });

    expect(state.white).toMatchObject({ done: 7, total: 20, complete: false });
    expect(state.legacy).toBe(7);
    expect(state.challengeDone).toBe(7);
    expect(state.blobVersion).toBe(2);
    expect(state.blobLegacy).toBe(7);
    expect(state.blobWhite).toBe(7);
  });

  test("challenge completion and Mat Coins are idempotent", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });

    const state = await page.evaluate(() => {
      const app = (window as any).__neural;
      for (let i = 0; i < 6; i += 1) app.fx("escape", { via: "Elbow Escape" });
      // real beats carry firstTry as a COUNT; clean-checkpoint (v1.75.3) mints only on a
      // perfect run (firstTry === of) — the second identical pass proves mint-once dedupe
      app.fx("checkpoint_passed", { unit: "white/u1", firstTry: 3, of: 3 });
      app.fx("checkpoint_passed", { unit: "white/u1", firstTry: 3, of: 3 });
      return {
        escape: app.challengeProgress("blue.escape-three"),
        coins: Object.keys(app.coins),
        badges: Object.keys(app.badges),
        challengeBeats: app.beats.filter(
          (beat: any) =>
            beat.beat === "challenge_completed" &&
            beat.id === "blue.escape-three",
        ).length,
        coinBeats: app.beats.filter(
          (beat: any) => beat.beat === "coin_earned" && beat.id === "houdini",
        ).length,
        patchBeats: app.beats.filter(
          (beat: any) =>
            beat.beat === "patch_earned" && beat.id === "clean-checkpoint",
        ).length,
      };
    });

    expect(state.escape).toMatchObject({ progress: 3, done: true });
    expect(state.coins).toContain("houdini");
    expect(state.badges).toContain("clean-checkpoint");
    expect(state.challengeBeats).toBe(1);
    expect(state.coinBeats).toBe(1);
    expect(state.patchBeats).toBe(1);
  });

  test("historical mastery and curriculum evidence seed advanced tracks", async ({
    page,
  }) => {
    const j = journey(page);
    const recalled = Object.fromEntries(
      Array.from({ length: 15 }, (_, index) => [`question-${index}`, 3]),
    );
    await j.boot("/", {
      keepTutorial: true,
      initialState: progressBlob({
        stage: { "fixture|top": recalled },
        units: {
          "white/u1": { checkpoint: true, t: 1 },
          "white/u2": { checkpoint: true, t: 2 },
          "blue/u1": { checkpoint: true, t: 3 },
        },
      }),
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const app = (window as any).__neural;
          return {
            recall: app.challengeProgress("purple.recall-fifteen").done,
            checkpoints: app.challengeProgress("purple.checkpoint-three").done,
          };
        }),
      )
      .toEqual({ recall: true, checkpoints: true });
  });

  test("cloud merge uses MAX, OR, and UNION without dropping local proof", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", {
      keepTutorial: true,
      initialState: progressBlob({
        challenges: {
          "blue.roll-three": { progress: 2, done: false, t: 300 },
        },
        badges: { "white-foundations": { t: 300 } },
        coins: { godlike: { t: 400 } },
      }),
    });

    const merged = await page.evaluate(async (legacyIds) => {
      const app = (window as any).__neural;
      const cloudDone = Object.fromEntries(
        legacyIds.slice(0, 7).map((id) => [id, 1]),
      );
      const cloud = {
        v: 2,
        challenges: {
          "blue.roll-three": { progress: 1, done: false, t: 200 },
          "blue.escape-three": { progress: 3, done: true, t: 250 },
        },
        badges: { "clean-checkpoint": { t: 250 } },
        coins: { houdini: { t: 250 } },
        tut: { done: cloudDone },
        settings: {},
        updatedAt: 250,
      };
      app._auth = () => ({
        pullNeural: async () => cloud,
        pushNeural: () => {},
        isAuthenticated: () => true,
      });
      await app._pullAndMerge();
      return {
        rolls: app.challengeProgress("blue.roll-three"),
        escape: app.challengeProgress("blue.escape-three"),
        white: app.challengeTrackProgress("white"),
        badges: Object.keys(app.badges).sort(),
        coins: Object.keys(app.coins).sort(),
        pulled: app._pulled,
      };
    }, LEGACY_IDS);

    expect(merged.rolls).toMatchObject({ progress: 2, done: false });
    expect(merged.escape).toMatchObject({ progress: 3, done: true });
    expect(merged.white).toMatchObject({ done: 7, total: 20 });
    expect(merged.badges).toEqual(["clean-checkpoint", "white-foundations"]);
    expect(merged.coins).toEqual(["godlike", "houdini"]);
    expect(merged.pulled).toBe(true);
  });

  test("a fresh device pulls collectibles before its first cloud push", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });

    const state = await page.evaluate(async () => {
      const app = (window as any).__neural;
      let pushed: any = null;
      const cloud = {
        v: 2,
        challenges: {
          "blue.escape-three": { progress: 3, done: true, t: 200 },
        },
        badges: { "clean-checkpoint": { t: 200 } },
        coins: { houdini: { t: 200 } },
        settings: {},
        updatedAt: 200,
      };
      app._auth = () => ({
        pullNeural: async () => cloud,
        pushNeural: (blob: any) => {
          pushed = blob;
        },
        isAuthenticated: () => true,
      });

      await app._pullAndMerge();
      await new Promise((resolve) => setTimeout(resolve, 600));
      return {
        challenge: pushed?.challenges?.["blue.escape-three"],
        badges: Object.keys(pushed?.badges || {}),
        coins: Object.keys(pushed?.coins || {}),
      };
    });

    expect(state.challenge).toMatchObject({ progress: 3, done: true });
    expect(state.badges).toEqual(["clean-checkpoint"]);
    expect(state.coins).toEqual(["houdini"]);
  });

  test("cloud-only mastery evidence recomputes snapshot challenges before push", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });

    const state = await page.evaluate(async () => {
      const app = (window as any).__neural;
      const recalled = Object.fromEntries(
        Array.from({ length: 30 }, (_, index) => [
          `cloud-question-${index}`,
          3,
        ]),
      );
      let pushed: any = null;
      app._auth = () => ({
        pullNeural: async () => ({
          v: 2,
          stage: { "cloud|deck": recalled },
          settings: {},
          updatedAt: 200,
        }),
        pushNeural: (blob: any) => {
          pushed = blob;
        },
        isAuthenticated: () => true,
      });

      await app._pullAndMerge();
      await new Promise((resolve) => setTimeout(resolve, 600));
      return {
        purple: app.challengeProgress("purple.recall-fifteen"),
        brown: app.challengeProgress("brown.recall-thirty"),
        badge: app.badges["thirty-from-memory"],
        pushedBrown: pushed?.challenges?.["brown.recall-thirty"],
        pushedBadge: pushed?.badges?.["thirty-from-memory"],
        replayedBeats: (app.beats || [])
          .filter((entry: any) =>
            ["challenge_completed", "patch_earned", "coin_earned"].includes(
              entry.beat,
            ),
          )
          .map((entry: any) => entry.beat),
      };
    });

    expect(state.purple).toMatchObject({ progress: 15, done: true });
    expect(state.brown).toMatchObject({ progress: 30, done: true });
    expect(state.badge).toBeTruthy();
    expect(state.pushedBrown).toMatchObject({ progress: 30, done: true });
    expect(state.pushedBadge).toBeTruthy();
    expect(state.replayedBeats).toEqual([]);
  });

  test("corrupt local progress starts fresh and recovers on the first challenge event", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await page.goto("/?ngb=corrupt#ngseed=%7Bbroken", { waitUntil: "commit" });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const app = (window as any).__neural;
          return Boolean(app?.nodes?.length && app?.flashcards?.decks);
        }),
      )
      .toBe(true);

    const state = await page.evaluate(() => {
      const app = (window as any).__neural;
      const fresh = app.challengeTrackProgress("white");
      app.fx("roll_end", {});
      const stored = JSON.parse(
        localStorage.getItem("bjj-neural-progress") || "{}",
      );
      return {
        fresh,
        storedVersion: stored.v,
        rollProgress: stored.challenges?.["white.roll"]?.progress,
      };
    });

    expect(state.fresh).toMatchObject({ done: 0, total: 20, complete: false });
    expect(state.storedVersion).toBe(2);
    expect(state.rollProgress).toBe(1);
  });

  test("collectibles never alter score, odds, or decision timing", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { keepTutorial: true });
    await j.land("Mount Top");

    const values = await page.evaluate(() => {
      const app = (window as any).__neural;
      const action = app._optList[0].node;
      const before = {
        score: app.gameScore().score,
        odds: app.moveChance(action),
        decisionTime: app.cfg().decisionTime,
      };
      app.fx("escape_odds_pumped", { deck_key: "Mount|Top" });
      app.fx("combo", { n: 7 });
      app.fx("sheet_opened", { technique: "Armbar" });
      app.fx("sheet_opened", { technique: "Triangle" });
      app.fx("sheet_opened", { technique: "Kimura" });
      app.fx("commit", { technique: "Berimbolo Entry" });
      const after = {
        score: app.gameScore().score,
        odds: app.moveChance(action),
        decisionTime: app.cfg().decisionTime,
      };
      return {
        before,
        after,
        coins: Object.keys(app.coins),
      };
    });

    expect(values.after).toEqual(values.before);
    expect(values.coins).toEqual(
      expect.arrayContaining([
        "frame-job",
        "godlike",
        "research-position",
        "berimbolo-briefly",
      ]),
    );
  });
});
