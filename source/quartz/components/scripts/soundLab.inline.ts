import { loadSettings, saveSettings } from "./settings"
import { GAME_SOUND_CATALOG, playGameSound, stopGameSounds, type GameSoundCue } from "./gameAudio"

const soundByCue = new Map(GAME_SOUND_CATALOG.map((sound) => [sound.cue, sound]))

document.addEventListener("nav", () => {
  const root = document.getElementById("sound-lab")
  if (!root) return

  const toggle = document.getElementById("sound-lab-enabled") as HTMLInputElement | null
  const stopButton = document.getElementById("sound-lab-stop") as HTMLButtonElement | null
  const status = document.getElementById("sound-lab-status")
  const playButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-sound-cue]"))
  if (!toggle || !stopButton || !status) return

  let activeButton: HTMLButtonElement | null = null
  let finishTimer: number | undefined

  const setStatus = (message: string) => {
    status.textContent = message
  }

  const clearActive = () => {
    if (finishTimer !== undefined) window.clearTimeout(finishTimer)
    finishTimer = undefined
    activeButton?.closest(".sound-lab-cue")?.classList.remove("is-playing")
    activeButton?.setAttribute("aria-pressed", "false")
    activeButton = null
    stopButton.disabled = true
  }

  const syncEnabled = () => {
    const enabled = loadSettings().soundEnabled
    toggle.checked = enabled
    root.dataset.soundEnabled = String(enabled)
    playButtons.forEach((button) => {
      button.disabled = !enabled
    })
    if (!activeButton) {
      setStatus(enabled ? "Audio engine ready" : "Sound effects are off")
    }
  }

  const play = (button: HTMLButtonElement) => {
    const cue = button.dataset.soundCue as GameSoundCue | undefined
    const sound = cue ? soundByCue.get(cue) : undefined
    if (!cue || !sound || !loadSettings().soundEnabled) return

    stopGameSounds()
    clearActive()
    activeButton = button
    button.setAttribute("aria-pressed", "true")
    button.closest(".sound-lab-cue")?.classList.add("is-playing")
    stopButton.disabled = false
    setStatus(`Playing ${sound.label} · ${sound.context}`)
    playGameSound(cue, { preview: true })

    finishTimer = window.setTimeout(() => {
      clearActive()
      setStatus("Audio engine ready")
    }, sound.durationMs + 300)
  }

  const onToggle = () => {
    const settings = loadSettings()
    settings.soundEnabled = toggle.checked
    saveSettings(settings)

    if (settings.soundEnabled) {
      syncEnabled()
      setStatus("Audio engine online")
      playGameSound("interface-on", { preview: true })
    } else {
      stopGameSounds()
      clearActive()
      syncEnabled()
    }
  }

  const onStop = () => {
    stopGameSounds()
    clearActive()
    setStatus("Playback stopped")
  }

  const buttonHandlers = playButtons.map((button) => {
    const handler = () => play(button)
    button.addEventListener("click", handler)
    return { button, handler }
  })

  toggle.addEventListener("change", onToggle)
  stopButton.addEventListener("click", onStop)
  syncEnabled()

  window.addCleanup(() => {
    if (finishTimer !== undefined) window.clearTimeout(finishTimer)
    toggle.removeEventListener("change", onToggle)
    stopButton.removeEventListener("click", onStop)
    buttonHandlers.forEach(({ button, handler }) => button.removeEventListener("click", handler))
    stopGameSounds()
  })
})
