import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/systemProgress.inline"

// Script-only component. The "unlock this part of the graph" shell (progress ring +
// member checklist) is emitted inline by templates/Systems.md.jinja2; this component
// just ships systemProgress.inline.ts, which self-gates to system pages by reading
// #page-graph-data (type === "system").
const SystemProgress: QuartzComponent = () => null

SystemProgress.afterDOMLoaded = script
export default (() => SystemProgress) satisfies QuartzComponentConstructor
