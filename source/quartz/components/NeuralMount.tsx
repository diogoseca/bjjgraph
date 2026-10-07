import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/variant.inline"
import { version } from "../../../package.json"

// Neural Graph variant bootstrap (Phase 0.2). Renders no markup — it exists solely to
// register the early inline script that resolves ?variant / bjj-settings.variant, sets
// <html data-variant>, and (when neural) boots the Neural app bundle as an overlay.
// beforeDOMLoaded so data-variant is set before first paint (no legacy flash). Emitting
// nothing keeps the static HTML — and thus the SEO surface — identical for both variants.
const NeuralMount: QuartzComponent = () => null

NeuralMount.beforeDOMLoaded = script
// THE DEPLOY'S BUILD STAMP (v1.205.1): the package version, for the loader above to key the
// bundle URL on (variant.inline.ts appAsset -> neural.js?v=<stamp>). Before it, the loader asked
// for neural.js at a FIXED URL under /static/*, cached 4 h plus a 1 d stale-while-revalidate,
// while the JSON data is not edge-cached. On 2026-09-29 the edge served v1.182.15's bundle
// against v1.204.4's format-4 data: no decks and a white belt. A new stamp per deploy is a new
// cache key per deploy. It rides /postscript.js (afterDOMLoaded), which is served
// `max-age=0, must-revalidate` (static/_headers; gated by check_headers_cache.py STAMP_CARRIER),
// so it is always the deployed build, and it runs before the router's first "nav" and before
// DOMContentLoaded, the two moments the loader reads it. It is emitted as the one literal
// `window.__NEURAL_BUILD="<version>"`; check_build_fingerprint.py normalises it out of
// postscript.js's hash and asserts it appears exactly once and equals package.json.
// It lives in THIS keep-list file rather than a new one because a new file under components/
// cannot be accepted by check_frozen_surfaces.py (it has no base bytes to move from).
NeuralMount.afterDOMLoaded = `window.__NEURAL_BUILD = ${JSON.stringify(version)};`
export default (() => NeuralMount) satisfies QuartzComponentConstructor
