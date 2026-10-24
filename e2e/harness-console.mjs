// The DSL's external route.abort() produces this browser diagnostic on keyed builds
// (PostHog's /static/array.js; scripts/check_analytics_surface.py LOADER_LABEL).
// Record at the actual abort site, not every external requestfailed event: a spec can
// override a route, and its HTTP/CSP/transport failures must remain real errors.
const abortedRequests = new WeakMap();

export function recordHarnessAbort(page, url) {
  if (!abortedRequests.has(page)) abortedRequests.set(page, new Map());
  const counts = abortedRequests.get(page);
  counts.set(url, (counts.get(url) || 0) + 1);
}

/** Collect first, classify when asserted: console and request events may arrive in either order. */
export function collectConsoleErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push({ text: message.text(), at: message.location().url || "" });
  });
  return () => {
    const remaining = new Map(abortedRequests.get(page));
    const harness = errors.filter((error) => {
      if (error.text !== "Failed to load resource: net::ERR_FAILED" || !remaining.get(error.at)) return false;
      remaining.set(error.at, remaining.get(error.at) - 1);
      return true;
    });
    return { harness, errors: errors.filter((error) => !harness.includes(error)) };
  };
}
