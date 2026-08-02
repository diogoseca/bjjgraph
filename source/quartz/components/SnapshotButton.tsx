import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import consoleTap from "./scripts/consoleTap.inline"
// @ts-ignore
import script from "./scripts/snapshotButton.inline"

// Dev-only snapshot button (see CLAUDE.md "Dev Snapshots"). Renders no markup — the button is
// created client-side only on localhost and only once /__snapshot/ping answers, so prod HTML
// carries nothing. The console tap goes beforeDOMLoaded to catch errors thrown while the neural
// bundle boots; the button itself waits for afterDOMLoaded.
const SnapshotButton: QuartzComponent = () => null

SnapshotButton.beforeDOMLoaded = consoleTap
SnapshotButton.afterDOMLoaded = script
export default (() => SnapshotButton) satisfies QuartzComponentConstructor
