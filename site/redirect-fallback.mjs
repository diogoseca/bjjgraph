// The category wildcard redirects that Cloudflare's `_redirects` cannot hold (v1.237.2, RDR546).
//
// Cloudflare loads at most 100 dynamic rules, and it counts every rule after the first wildcard as
// one, so only the first 100 of 1,954 rules worked for months. scripts/regenerate_redirects.py now
// lists the exact rules first in `_redirects` and writes every wildcard under /Positions,
// /Transitions and /Submissions to static/redirect-fallback.json. The middleware runs on those
// paths anyway (`_routes.json`), so this adds no Function invocation: it is consulted only after
// the asset server has answered 404, which also means a built page under a wildcard now wins over
// it. scripts/check_redirect_limits.py fails the build if one exists.
//
// The matcher is Cloudflare's own, ported from workers-sdk fc57bc0e
// (asset-worker/src/utils/rules-engine.ts generateRuleRegExp + replacer, and the Location that
// pages-shared/asset-server/handler.ts writes), so a rule means here what it meant in `_redirects`.
// tests/redirect_fallback.test.mjs holds this to the Python port rule by rule.

export const FALLBACK_TABLE = "/static/redirect-fallback.json";
// The response says which layer answered: a fallback that never says it fired reads exactly like
// one that is not there (CLAUDE.md §6). The deploy's live probe asserts it.
export const FALLBACK_HEADER = "X-Redirect-Source";

const ESCAPE_REGEX_CHARACTERS = /[-/\\^$*+?.()|[\]{}]/g;
const escapeRegex = (str) => str.replace(ESCAPE_REGEX_CHARACTERS, "\\$&");
const PLACEHOLDER_REGEX = /:([A-Za-z]\w*)/g;

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

// [[source, target, status], ...] -> compiled rules, in table order. Like generateRulesMatcher, a
// rule whose RegExp throws is dropped; the Python gate fails on one before it can ship.
export function compileRules(table) {
  const rules = [];
  for (const [source, to, status] of table?.rules || []) {
    try {
      rules.push({ regExp: generateRuleRegExp(source), to, status });
    } catch {}
  }
  return rules;
}

// First match wins. Returns { status, location } or null.
export function resolveRedirect(rules, requestUrl) {
  const url = new URL(requestUrl);
  for (const { regExp, to, status } of rules) {
    const result = regExp.exec(url.pathname);
    if (!result) continue;
    const destination = new URL(replacer(to, result.groups || {}), url);
    const location =
      destination.origin === url.origin
        ? `${destination.pathname}${destination.search || url.search}${destination.hash}`
        : `${destination.href.slice(0, destination.href.length - (destination.search.length + destination.hash.length))}${
            destination.search ? destination.search : url.search
          }${destination.hash}`;
    return { status, location };
  }
  return null;
}

let compiled; // one table per isolate, which serves one deployment

async function loadRules(env, origin) {
  if (compiled) return compiled;
  const response = await env.ASSETS.fetch(new Request(new URL(FALLBACK_TABLE, origin)));
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`${FALLBACK_TABLE} answered ${response.status}`);
  }
  compiled = compileRules(await response.json());
  return compiled;
}

// After a 404: the redirect response, or null when no wildcard matches. A missing or broken table
// leaves the 404 standing and logs; it never turns a page into an error.
export async function redirectFallback(request, env, cacheControl) {
  let rules;
  try {
    rules = await loadRules(env, new URL(request.url).origin);
  } catch (error) {
    console.error(`redirect fallback unavailable: ${error.message}`);
    return null;
  }
  const hit = resolveRedirect(rules, request.url);
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

// Tests only: forget the per-isolate table.
export function _resetFallback() {
  compiled = undefined;
}
