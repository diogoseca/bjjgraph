// The category redirects Cloudflare's `_redirects` cannot hold (v1.237.2, RDR546).
//
// Cloudflare loads at most 100 dynamic rules, and it counts every rule after the first wildcard as
// one, so only the first 100 of 1,954 rules worked for months. scripts/regenerate_redirects.py now
// lists the exact rules first in `_redirects`, and writes EVERY rule under /Positions, /Transitions
// and /Submissions (exact rules first, then the wildcards) to static/redirect-fallback.json.
// functions/_middleware.js bundles that file into the Function at deploy time (no runtime fetch), and
// the middleware answers those paths from it BEFORE `context.next()`. That is the old edge order:
// Cloudflare's redirects run before any page lookup, including the up-to-7-day retention copy of a
// page a deploy removed, which would otherwise answer 200 noindex where the rule used to answer
// 301 (RDR-R2). `_routes.json` already sends these categories to the middleware, so no new
// invocation; scripts/check_redirect_limits.py fails if any rule matches a built page.
//
// The matcher is Cloudflare's own, ported from workers-sdk fc57bc0e: constructRedirects (exact
// rules before the first wildcard form a map, the rest are tried in order), rules-engine.ts
// generateRuleRegExp + replacer, and the Location pages-shared/asset-server/handler.ts writes. So a
// rule means here what it meant in `_redirects`. tests/redirect_fallback.test.mjs holds this to the
// Python port rule by rule.

// The response says which layer answered: a fallback that never says it fired reads exactly like
// one that is not there (CLAUDE.md §6). The deploy's live probe asserts it.
export const FALLBACK_HEADER = "X-Redirect-Source";
// regenerate_redirects.FALLBACK_PREFIXES; tests/redirect_fallback.test.mjs asserts they agree.
export const CATEGORY_PREFIXES = ["/Positions/", "/Transitions/", "/Submissions/"];

const ESCAPE_REGEX_CHARACTERS = /[-/\\^$*+?.()|[\]{}]/g;
const escapeRegex = (str) => str.replace(ESCAPE_REGEX_CHARACTERS, "\\$&");
const PLACEHOLDER_REGEX = /:([A-Za-z]\w*)/g;
const DYNAMIC = /\*|:[A-Za-z]\w*/;

export function generateRuleRegExp(rule) {
  rule = rule.split("*").map(escapeRegex).join("(?<splat>.*)");
  for (const match of rule.matchAll(PLACEHOLDER_REGEX)) {
    rule = rule.split(match[0]).join(`(?<${match[1]}>[^/]+)`);
  }
  return RegExp("^" + rule + "$");
}

function replacer(str, replacements) {
  for (const [name, value] of Object.entries(replacements)) {
    str = str.replaceAll(`:${name}`, value);
  }
  return str;
}

// {rules: [[source, target, status], ...]} -> constructRedirects' shape: the exact rules ahead of
// the first wildcard form a map, every later rule is tried in order. A rule whose RegExp throws is
// dropped, as generateRulesMatcher drops it; the Python gate fails on one before it can ship.
export function compileRules(table) {
  const exact = new Map();
  const dynamic = [];
  let canCreateStaticRule = true;
  for (const [source, to, status] of table?.rules || []) {
    if (canCreateStaticRule && !DYNAMIC.test(source)) {
      exact.set(source, { to, status });
      continue;
    }
    canCreateStaticRule = false;
    try {
      dynamic.push({ regExp: generateRuleRegExp(source), to, status });
    } catch {}
  }
  return { exact, dynamic, size: exact.size + dynamic.length };
}

// First match wins. Returns { status, location } or null.
export function resolveRedirect(compiled, requestUrl) {
  const url = new URL(requestUrl);
  let rule = compiled.exact.get(url.pathname);
  let groups = {};
  if (!rule) {
    for (const candidate of compiled.dynamic) {
      const result = candidate.regExp.exec(url.pathname);
      if (result) {
        rule = candidate;
        groups = result.groups || {};
        break;
      }
    }
  }
  if (!rule) return null;
  const destination = new URL(replacer(rule.to, groups), url);
  const location =
    destination.origin === url.origin
      ? `${destination.pathname}${destination.search || url.search}${destination.hash}`
      : `${destination.href.slice(0, destination.href.length - (destination.search.length + destination.hash.length))}${
          destination.search ? destination.search : url.search
        }${destination.hash}`;
  return { status: rule.status, location };
}

// The redirect for a category path, or null. Synchronous: the table is already in the bundle.
export function categoryRedirect(compiled, request, cacheControl) {
  const { pathname } = new URL(request.url);
  if (!compiled.size || !CATEGORY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  const hit = resolveRedirect(compiled, request.url);
  if (!hit) return null;
  return new Response(null, {
    status: hit.status,
    headers: {
      Location: hit.location,
      [FALLBACK_HEADER]: "fallback",
      "Cache-Control": cacheControl,
    },
  });
}
