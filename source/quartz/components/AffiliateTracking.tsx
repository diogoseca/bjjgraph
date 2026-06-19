import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/affiliateTracking.inline"

// Script-only, site-wide component. Renders nothing; ships affiliateTracking.inline.ts
// which captures the Systems affiliate funnel (related-card click → system view →
// affiliate clickout) into PostHog.
const AffiliateTracking: QuartzComponent = () => null

AffiliateTracking.afterDOMLoaded = script
export default (() => AffiliateTracking) satisfies QuartzComponentConstructor
