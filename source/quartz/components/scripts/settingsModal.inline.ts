// SettingsModal runtime — tabbed settings overlay.
//   Tab 1 (Flashcards, default): Daily Goal + Show Flashcards on pages
//   Tab 2 (Game): Game Mode selector (Off / Normal / Hard 🔒 / Ultra 🔒)
//
// Exposed via window.__openSettingsModal(defaultTab?: 'flashcards' | 'game').
// Stacks at z-index 9991 — above DecksModal at 9990 so it's the top layer
// when opened from inside the DecksModal header.

import { registerEscapeHandler } from "./util"
import { loadSettings, saveSettings } from "./settings"
import type { GameMode } from "./settings"
import { playGameSound, stopGameSounds } from "./gameAudio"

const MODAL_ID = "settings-modal-overlay"

type Tab = "flashcards" | "game"

function close() {
  document.getElementById(MODAL_ID)?.remove()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function renderTab(panel: HTMLElement, tab: Tab) {
  const settings = loadSettings()

  if (tab === "flashcards") {
    panel.innerHTML = `
      <div class="settings-modal-row">
        <label for="settings-daily-goal" class="settings-modal-label">
          Daily goal
          <span class="settings-modal-hint">Techniques to review or learn each day</span>
        </label>
        <input
          type="number"
          id="settings-daily-goal"
          class="settings-modal-input"
          min="1"
          max="100"
          value="${settings.dailyGoal}"
        />
      </div>
      <div class="settings-modal-row">
        <label for="settings-show-flashcards" class="settings-modal-label">
          Show flashcards on pages
          <span class="settings-modal-hint">Display a quiz pill on each technique page</span>
        </label>
        <input
          type="checkbox"
          id="settings-show-flashcards"
          class="settings-modal-toggle"
          ${settings.showFlashcards ? "checked" : ""}
        />
      </div>
    `

    const dailyGoalInput = document.getElementById("settings-daily-goal") as HTMLInputElement
    dailyGoalInput?.addEventListener("change", () => {
      const v = Math.max(1, Math.min(100, parseInt(dailyGoalInput.value, 10) || 30))
      dailyGoalInput.value = String(v)
      const s = loadSettings()
      s.dailyGoal = v
      saveSettings(s)
    })

    const showFlashcardsCheckbox = document.getElementById(
      "settings-show-flashcards",
    ) as HTMLInputElement
    showFlashcardsCheckbox?.addEventListener("change", () => {
      const s = loadSettings()
      s.showFlashcards = showFlashcardsCheckbox.checked
      saveSettings(s)
      // Reflect the change on the current page immediately instead of waiting for
      // the next SPA navigation (re-runs the flashcard pill's nav handler).
      document.dispatchEvent(new CustomEvent("nav", { detail: { url: window.location.pathname } }))
    })
  } else {
    panel.innerHTML = `
      <div class="settings-modal-row settings-modal-row--column">
        <span class="settings-modal-label">
          Rolling simulation
          <span class="settings-modal-hint">When you click a move on a position page, dice roll against an AI opponent — success depends on the move's win % (boosted by your mastery).</span>
        </span>
        <div class="settings-modal-pill-group" id="settings-game-mode-group">
          <button type="button" class="settings-modal-pill" data-mode="off" title="No dice rolls — just navigate when you click a move">Off</button>
          <button type="button" class="settings-modal-pill" data-mode="normal" title="Dice rolls based on each move's win %, plus mastery bonus from flashcards">Normal</button>
          <button type="button" class="settings-modal-pill settings-modal-pill--locked" data-mode="hard" title="Coming soon" disabled>Hard &#x1F512;</button>
          <button type="button" class="settings-modal-pill settings-modal-pill--locked" data-mode="ultra" title="Coming soon" disabled>Ultra &#x1F512;</button>
        </div>
      </div>
      <div class="settings-modal-row">
        <label for="settings-sound-effects" class="settings-modal-label">
          Sound effects
          <span class="settings-modal-hint">Neural, electrical feedback for rolls and milestones</span>
        </label>
        <input
          type="checkbox"
          id="settings-sound-effects"
          class="settings-modal-toggle"
          ${settings.soundEnabled ? "checked" : ""}
        />
      </div>
    `

    const group = document.getElementById("settings-game-mode-group")
    if (group) {
      group.querySelectorAll(".settings-modal-pill").forEach((btn) => {
        const mode = (btn as HTMLElement).dataset.mode as GameMode
        if (mode === settings.gameMode) btn.classList.add("settings-modal-pill--active")
        if (btn.classList.contains("settings-modal-pill--locked")) return
        btn.addEventListener("click", () => {
          const s = loadSettings()
          s.gameMode = mode
          saveSettings(s)
          group
            .querySelectorAll(".settings-modal-pill")
            .forEach((b) => b.classList.remove("settings-modal-pill--active"))
          btn.classList.add("settings-modal-pill--active")
        })
      })
    }

    const soundEffectsCheckbox = document.getElementById(
      "settings-sound-effects",
    ) as HTMLInputElement
    soundEffectsCheckbox?.addEventListener("change", () => {
      const s = loadSettings()
      s.soundEnabled = soundEffectsCheckbox.checked
      saveSettings(s)

      if (s.soundEnabled) {
        playGameSound("interface-on")
      } else {
        stopGameSounds()
      }
    })
  }
}

function open(defaultTab: Tab = "flashcards") {
  if (document.getElementById(MODAL_ID)) return

  const overlay = document.createElement("div")
  overlay.id = MODAL_ID
  overlay.className = "settings-modal-overlay"
  overlay.innerHTML = `
    <div class="settings-modal-panel" role="dialog" aria-labelledby="settings-modal-title">
      <header class="settings-modal-header">
        <h2 id="settings-modal-title" class="settings-modal-title">Settings</h2>
        <button
          type="button"
          class="settings-modal-icon-btn"
          id="settings-modal-close"
          aria-label="Close"
          title="Close"
        >&times;</button>
      </header>
      <div class="settings-modal-tabs" role="tablist">
        <button type="button" class="settings-modal-tab" data-tab="flashcards" role="tab">Flashcards</button>
        <button type="button" class="settings-modal-tab" data-tab="game" role="tab">Rolling</button>
      </div>
      <div class="settings-modal-body" id="settings-modal-tabpanel" role="tabpanel"></div>
    </div>
  `

  document.body.appendChild(overlay)
  registerEscapeHandler(overlay, close)

  document.getElementById("settings-modal-close")?.addEventListener("click", close)

  const panel = document.getElementById("settings-modal-tabpanel")
  if (!panel) return

  let activeTab: Tab = defaultTab
  const tabButtons = overlay.querySelectorAll(".settings-modal-tab")

  const setTab = (t: Tab) => {
    activeTab = t
    tabButtons.forEach((b) => {
      const isActive = (b as HTMLElement).dataset.tab === t
      b.classList.toggle("settings-modal-tab--active", isActive)
      b.setAttribute("aria-selected", isActive ? "true" : "false")
    })
    renderTab(panel, t)
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = (btn as HTMLElement).dataset.tab as Tab
      setTab(t)
    })
  })

  setTab(activeTab)
}

;(window as any).__openSettingsModal = open
