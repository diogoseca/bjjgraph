import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

const CURRICULUM = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../source/public/static/neural/curriculum.json"),
    "utf8",
  ),
);
const WHITE = CURRICULUM.belts[0];
const BLUE = CURRICULUM.belts[1];

function capstoneReadyBlob(track = WHITE) {
  const prep: Record<string, number> = {};
  const units: Record<string, any> = {};
  for (const unit of track.units) {
    units[`${track.id}/${unit.id}`] = { checkpoint: true, t: 1 };
    for (const lesson of unit.lessons) prep[lesson.deckKey] = 3;
  }
  return {
    v: 2,
    prep,
    rec: { ...prep },
    stage: {},
    units,
    belts: { won: {} },
    tut: { done: {} },
    challenges: {},
    badges: {},
    coins: {},
    days: {},
    settings: {},
    settingsAt: {},
    updatedAt: 1,
  };
}

async function openTrack(page: any, trackId = WHITE.id) {
  await page.evaluate((id) => {
    const app = (window as any).__neural;
    app.settings.challengeSelectedTrack = id;
    app.setViewMode("challenges");
    app.openExplorer();
    app.showExplorerList();
  }, trackId);
  await page.locator(`.ng-track-card[data-track="${trackId}"]`).click();
}

async function awaitCapstoneHand(j: any) {
  await j.nextHand(30000);
}

async function playToTap(j: any, page: any, maxMoves = 8): Promise<boolean> {
  for (let move = 0; move < maxMoves; move += 1) {
    const submission = await page.evaluate(() => {
      const app = (window as any).__neural;
      const options = (app.optionIdxs || [])
        .map((index: number) => app.nodes[index])
        .filter((node: any) => node.ty === "submissions");
      return options.length ? options[0].t : null;
    });
    await j.rig("resolve", [0.01]);
    await j.rig("outcome", [0.01]);
    if (submission) {
      await j.pick(submission);
      await j.advanceUntil("roll_end", 20000);
      return true;
    }
    const transition = await page.evaluate(() => {
      const app = (window as any).__neural;
      let fallback = null;
      for (const index of app.optionIdxs || []) {
        const node = app.nodes[index];
        if (node.ty !== "transitions") continue;
        fallback ||= node.t;
        const result = app.resultPos(index, app.currentPos);
        if (
          result >= 0 &&
          app.adj[result].some(
            (candidate: number) => app.nodes[candidate].ty === "submissions",
          )
        ) {
          return node.t;
        }
      }
      return fallback;
    });
    if (!transition) return false;
    await j.pick(transition);
    await j.nextHand(30000);
  }
  return false;
}

test.describe("Content capstones @curated", () => {
  test("capstones require their own checkpoint evidence, never a previous track", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/");
    await j.land("Mount Top");
    await openTrack(page);
    await expect(
      page.locator(`[data-capstone="${WHITE.id}"] button`),
    ).toBeDisabled();

    await j.boot("/", { initialState: capstoneReadyBlob() });
    await j.land("Mount Top");
    await openTrack(page);
    await expect(
      page.locator(`[data-capstone="${WHITE.id}"] button`),
    ).toBeEnabled();

    await page.locator(`.ng-track-card[data-track="${BLUE.id}"]`).click();
    await expect(
      page.locator(`[data-capstone="${BLUE.id}"] button`),
    ).toBeDisabled();
    await expect(page.locator(".ng-challenge-lesson").first()).toBeEnabled();
  });

  test("starting a capstone uses its authored position, move budget, and vocabulary", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { initialState: capstoneReadyBlob() });
    await j.land("Mount Top");
    await openTrack(page);
    await page.locator(`[data-capstone="${WHITE.id}"] button`).click();
    await j.advanceUntil("belt_test_start", 20000);

    const state = await page.evaluate(() => {
      const app = (window as any).__neural;
      return {
        track: app._beltTest?.beltId ?? null,
        maxMoves: app.maxMoves,
        positionId: app.nodes[app.currentPos]?.id,
        names: (app._beltTest?.names || []).length,
      };
    });
    expect(state.track).toBe(WHITE.id);
    expect(state.positionId).toBe(WHITE.test.startNodeId);
    expect(state.maxMoves).toBe(WHITE.test.maxMoves);
    expect(state.names).toBeGreaterThanOrEqual(5);
  });

  test("resetting an active capstone cancels without recording a failed attempt", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { initialState: capstoneReadyBlob() });
    await j.land("Mount Top");
    await openTrack(page);
    await page.locator(`[data-capstone="${WHITE.id}"] button`).click();
    await j.advanceUntil("belt_test_start", 20000);
    expect(
      await page.evaluate(() => !!(window as any).__neural._beltTest),
    ).toBe(true);

    await page.evaluate(() => (window as any).__neural.resetRoll());
    await j.advance(3000);
    const state = await page.evaluate(() => {
      const app = (window as any).__neural;
      return {
        capstone: app._beltTest ?? null,
        attempts: app.belts?.attempts?.white ?? 0,
      };
    });
    expect(state.capstone).toBeNull();
    expect(state.attempts).toBe(0);
    expect((await j.beats()).map((beat: any) => beat.beat)).not.toContain(
      "belt_test_lost",
    );
  });

  test("the capstone opponent only submits with the selected track vocabulary", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { initialState: capstoneReadyBlob() });
    await j.land("Mount Top");
    await openTrack(page);
    await page.locator(`[data-capstone="${WHITE.id}"] button`).click();
    await j.advanceUntil("belt_test_start", 20000);
    await awaitCapstoneHand(j);

    for (let move = 0; move < 2; move += 1) {
      const transition = await page.evaluate(() => {
        const app = (window as any).__neural;
        for (const index of app.optionIdxs || []) {
          if (app.nodes[index].ty === "transitions") return app.nodes[index].t;
        }
        return null;
      });
      if (!transition) break;
      await j.rig("resolve", [0.99]);
      await j.rig("outcome", [0.99]);
      await j.rig("opp-finish", [0.01]);
      await j.rig("opp-sub-pick", [0.01]);
      await j.rig("escape", [0.01]);
      await j.pick(transition);
      await j.advanceUntil("opponent_attack", 25000).catch(() => {});
      if ((await j.beats()).some((beat: any) => beat.beat === "caught")) {
        await page.evaluate(() => (window as any).__neural.pickFirstEscape());
        await j.nextHand(30000).catch(() => {});
      }
    }

    const attacks = (await j.beats()).filter(
      (beat: any) => beat.beat === "opponent_attack",
    );
    expect(attacks.length).toBeGreaterThanOrEqual(1);
    const pool = await page.evaluate(() =>
      Array.from((window as any).__neural._beltTest?.names || []),
    );
    for (const attack of attacks as any[]) {
      const base = attack.technique.split(" from ")[0].trim().toLowerCase();
      expect(pool).toContain(base);
    }
  });

  test("clearing a capstone records proof without unlocking or closing content", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { initialState: capstoneReadyBlob() });
    await j.land("Mount Top");
    await openTrack(page);
    await expect(page.locator(".ng-track-card")).toHaveCount(5);
    await page.locator(`[data-capstone="${WHITE.id}"] button`).click();
    await j.advanceUntil("belt_test_start", 20000);
    await awaitCapstoneHand(j);
    expect(await playToTap(j, page)).toBe(true);

    const beats = (await j.beats()).map((beat: any) => beat.beat);
    expect(beats.indexOf("belt_test_won")).toBeGreaterThanOrEqual(0);
    expect(beats.indexOf("belt_test_won")).toBeLessThan(
      beats.indexOf("roll_end"),
    );
    expect(beats).not.toContain("belt_unlocked");
    expect(
      await page.evaluate(() => !!(window as any).__neural.belts?.won?.white),
    ).toBe(true);

    await j.boot("/", { preserveStorage: true });
    await j.land("Mount Top");
    await openTrack(page);
    await expect(
      page.locator(`[data-capstone="${WHITE.id}"] button`),
    ).toHaveText("Capstone cleared");
    await expect(page.locator(".ng-track-card")).toHaveCount(5);
    await page.locator(`.ng-track-card[data-track="${BLUE.id}"]`).click();
    await expect(page.locator(".ng-challenge-lesson").first()).toBeEnabled();
  });

  test("the move-limit verdict uses dominance and leaves a failed capstone retryable", async ({
    page,
  }) => {
    const j = journey(page);
    await j.boot("/", { initialState: capstoneReadyBlob() });
    await j.land("Mount Top");
    await openTrack(page);
    await page.locator(`[data-capstone="${WHITE.id}"] button`).click();
    await j.advanceUntil("belt_test_start", 20000);
    await awaitCapstoneHand(j);
    await page.evaluate(() => {
      const app = (window as any).__neural;
      app.maxMoves = 1;
      app._beltTest.maxMoves = 1;
    });
    const transition = await page.evaluate(() => {
      const app = (window as any).__neural;
      for (const index of app.optionIdxs || []) {
        if (app.nodes[index].ty === "transitions") return app.nodes[index].t;
      }
      return null;
    });
    expect(transition).toBeTruthy();
    await j.rig("resolve", [0.01]);
    await j.rig("outcome", [0.01]);
    await j.pick(transition as string);
    await j.advanceUntil("roll_end", 30000);

    const verdict = await page.evaluate(() => {
      const app = (window as any).__neural;
      const won = app.beats
        .filter((beat: any) => beat.beat === "belt_test_won")
        .pop();
      const lost = app.beats
        .filter((beat: any) => beat.beat === "belt_test_lost")
        .pop();
      return {
        won: won || null,
        lost: lost || null,
        attempts: app.belts?.attempts?.white || 0,
      };
    });
    if (verdict.won) {
      expect(verdict.won.byPoints).toBe(true);
      expect(verdict.won.dominance).toBeGreaterThanOrEqual(
        WHITE.test.pointsWinDominance,
      );
    } else {
      expect(verdict.lost).toBeTruthy();
      expect(verdict.lost.dominance).toBeLessThan(
        WHITE.test.pointsWinDominance,
      );
      expect(verdict.attempts).toBe(1);
      await openTrack(page);
      await expect(
        page.locator(`[data-capstone="${WHITE.id}"] button`),
      ).toBeEnabled();
      await expect(
        page.locator(`[data-capstone="${WHITE.id}"] button`),
      ).toHaveText("Start capstone");
    }
  });
});
