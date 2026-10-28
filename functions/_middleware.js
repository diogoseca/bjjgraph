// Public-page content negotiation, plus the category redirects Cloudflare's _redirects cannot hold
// (v1.237.2, RDR546). The table is the build's own static/redirect-fallback.json, which
// scripts/regenerate_redirects.py writes beside _redirects; wrangler bundles it into this Function at
// deploy time, so there is no runtime fetch and it always matches the deployed _redirects. A deploy
// whose build did not write it fails at bundling instead of shipping a Function without its table.
// Other Pages Functions pass through unchanged. Behaviour: tests/agent_discovery.test.mjs and
// tests/redirect_fallback.test.mjs (which also bundles this file).
import table from "../source/public/static/redirect-fallback.json" with { type: "json" };
import { withRedirects } from "../site/agent-response.mjs";

export const onRequest = withRedirects(table);
