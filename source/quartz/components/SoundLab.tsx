import { QuartzComponent, QuartzComponentConstructor } from "./types"
import { GAME_SOUND_CATALOG } from "./scripts/gameAudio"
import type { GameSoundGroup } from "./scripts/gameAudio"
import styles from "./styles/soundLab.scss"

// @ts-ignore
import script from "./scripts/soundLab.inline"

const GROUPS: readonly GameSoundGroup[] = ["System", "Gameplay", "Learning", "Training", "Outcomes"]

const groupId = (group: GameSoundGroup) => group.toLowerCase()

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5.5v13l10-6.5z" />
  </svg>
)

const SoundLab: QuartzComponent = () => {
  return (
    <main class="sound-lab" id="sound-lab">
      <header class="sound-lab-hero">
        <div class="sound-lab-hero-grid" aria-hidden="true"></div>
        <p class="sound-lab-kicker">
          <span>DEV TOOL</span>
          <span class="sound-lab-path">/dev/sounds</span>
        </p>
        <h1>Neural audio field</h1>
        <p class="sound-lab-intro">
          Every synthesized gameplay cue, shown at the moment it belongs. Previewing uses the
          production Web Audio engine, output limiter, and saved sound preference.
        </p>
        <div class="sound-lab-console" aria-label="Sound lab controls">
          <div class="sound-lab-engine-state">
            <span class="sound-lab-state-dot" aria-hidden="true"></span>
            <span id="sound-lab-status" role="status" aria-live="polite">
              Audio engine ready
            </span>
          </div>
          <div class="sound-lab-console-actions">
            <label class="sound-lab-switch" for="sound-lab-enabled">
              <span>Sound effects</span>
              <input id="sound-lab-enabled" type="checkbox" />
              <span class="sound-lab-switch-track" aria-hidden="true">
                <span></span>
              </span>
            </label>
            <button class="sound-lab-stop" id="sound-lab-stop" type="button" disabled>
              Stop
            </button>
          </div>
        </div>
      </header>

      <div class="sound-lab-index" aria-label="Sound groups">
        {GROUPS.map((group) => {
          const count = GAME_SOUND_CATALOG.filter((sound) => sound.group === group).length
          return (
            <a href={`#sound-group-${groupId(group)}`}>
              <span>{group}</span>
              <span>{String(count).padStart(2, "0")}</span>
            </a>
          )
        })}
      </div>

      <div class="sound-lab-groups">
        {GROUPS.map((group, groupIndex) => {
          const sounds = GAME_SOUND_CATALOG.filter((sound) => sound.group === group)
          return (
            <section
              class={`sound-lab-group sound-lab-group--${groupId(group)}`}
              id={`sound-group-${groupId(group)}`}
            >
              <header class="sound-lab-group-header">
                <span class="sound-lab-group-number">
                  {String(groupIndex + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2>{group}</h2>
                  <p>{sounds.length === 1 ? "1 cue" : `${sounds.length} cues`}</p>
                </div>
              </header>

              <div class="sound-lab-cues">
                {sounds.map((sound, soundIndex) => (
                  <article class="sound-lab-cue" data-sound-row={sound.cue}>
                    <span class="sound-lab-cue-index">
                      {String(soundIndex + 1).padStart(2, "0")}
                    </span>
                    <div class="sound-lab-cue-identity">
                      <h3>{sound.label}</h3>
                      <code>{sound.cue}</code>
                    </div>
                    <div class="sound-lab-cue-copy">
                      <p>
                        <span>Trigger</span>
                        {sound.context}
                      </p>
                      <p>
                        <span>Character</span>
                        {sound.character}
                      </p>
                    </div>
                    <div class="sound-lab-wave" aria-hidden="true">
                      <i></i>
                      <i></i>
                      <i></i>
                      <i></i>
                      <i></i>
                    </div>
                    <button
                      class="sound-lab-play"
                      type="button"
                      data-sound-cue={sound.cue}
                      data-sound-duration={sound.durationMs}
                      aria-label={`Play ${sound.label}`}
                      aria-pressed="false"
                    >
                      <PlayIcon />
                      <span>Play</span>
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <footer class="sound-lab-note">
        <span>Design constraint</span>
        <p>
          Navigation, votes, skips, modal clicks, and routine notifications intentionally remain
          silent. Sound is reserved for state changes that deserve feedback.
        </p>
      </footer>
    </main>
  )
}

SoundLab.css = styles
SoundLab.afterDOMLoaded = script

export default (() => SoundLab) satisfies QuartzComponentConstructor
