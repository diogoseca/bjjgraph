import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/variant.inline"

// Neural Graph variant bootstrap (Phase 0.2). Renders no markup — it exists solely to
// register the early inline script that resolves ?variant / bjj-settings.variant, sets
// <html data-variant>, and (when neural) boots the Neural app bundle as an overlay.
// beforeDOMLoaded so data-variant is set before first paint (no legacy flash). Emitting
// nothing keeps the static HTML — and thus the SEO surface — identical for both variants.
const NeuralMount: QuartzComponent = () => null

NeuralMount.beforeDOMLoaded = script
export default (() => NeuralMount) satisfies QuartzComponentConstructor
