import assert from "node:assert/strict"
import test, { beforeEach, describe } from "node:test"
import { localDateKey } from "./dateUtil"
import {
  DEFAULT_SETTINGS,
  claimDailyGoalAchievement,
  loadDailyProgress,
  loadSettings,
} from "./settings"
import { GAME_SOUND_CATALOG, GAME_SOUND_CUES } from "./gameAudio"

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value))
  }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, "localStorage", { value: storage })
Object.defineProperty(globalThis, "window", { value: globalThis })

beforeEach(() => storage.clear())

describe("sound settings", () => {
  test("enables sounds for new and legacy settings", () => {
    assert.equal(loadSettings().soundEnabled, true)

    storage.setItem("bjj-settings", JSON.stringify({ gameMode: "normal", dailyGoal: 12 }))
    assert.equal(loadSettings().soundEnabled, true)
  })

  test("preserves an explicit opt-out", () => {
    storage.setItem("bjj-settings", JSON.stringify({ ...DEFAULT_SETTINGS, soundEnabled: false }))
    assert.equal(loadSettings().soundEnabled, false)
  })
})

describe("game sound catalog", () => {
  test("lists every cue once with contextual preview metadata", () => {
    const cueIds = GAME_SOUND_CATALOG.map(({ cue }) => cue)

    assert.deepEqual(cueIds, GAME_SOUND_CUES)
    assert.equal(new Set(cueIds).size, cueIds.length)
    assert.ok(
      GAME_SOUND_CATALOG.every(
        ({ label, group, context, character, durationMs }) =>
          label.length > 0 &&
          group.length > 0 &&
          context.length > 0 &&
          character.length > 0 &&
          durationMs > 0,
      ),
    )
  })
})

describe("daily goal celebration", () => {
  test("can be claimed only once per local day", () => {
    storage.setItem("bjj-settings", JSON.stringify({ ...DEFAULT_SETTINGS, dailyGoal: 3 }))
    storage.setItem(
      "bjj-daily-progress",
      JSON.stringify({
        date: localDateKey(),
        learned: 1,
        reviewed: 1,
        goalCelebrated: false,
      }),
    )
    assert.equal(claimDailyGoalAchievement(), false)

    storage.setItem(
      "bjj-daily-progress",
      JSON.stringify({
        date: localDateKey(),
        learned: 1,
        reviewed: 2,
        goalCelebrated: false,
      }),
    )
    assert.equal(claimDailyGoalAchievement(), true)
    assert.equal(loadDailyProgress().goalCelebrated, true)
    assert.equal(claimDailyGoalAchievement(), false)
  })
})
