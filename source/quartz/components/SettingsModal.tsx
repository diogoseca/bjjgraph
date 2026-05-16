import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/settingsModal.inline"

// SettingsModal — overlay opened by clicking ⚙ in DecksModal header.
// Stacks above DecksModal (z-index 9991 > 9990). Two tabs: Flashcards / Game.
// Component renders null; modal DOM is injected by the script on demand.
const SettingsModal: QuartzComponent = () => {
  return null
}

SettingsModal.css = `/* Styles defined in custom.scss */`

SettingsModal.afterDOMLoaded = script
export default (() => SettingsModal) satisfies QuartzComponentConstructor
