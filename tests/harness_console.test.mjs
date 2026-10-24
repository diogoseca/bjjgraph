// Boundary controls for the shared journey collector. No browser/dependency promise is needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { collectConsoleErrors, recordHarnessAbort } from "../e2e/harness-console.mjs";

const loader = "https://us-assets.i.posthog.com/static/array.js";
const failed = "Failed to load resource: net::ERR_FAILED";
const emit = (page, text, at) => page.emit("console", {
  type: () => "error", text: () => text, location: () => ({ url: at }),
});

test("only the browser diagnostic at an actual DSL-aborted URL is discounted", () => {
  const page = new EventEmitter(), collect = collectConsoleErrors(page);
  recordHarnessAbort(page, loader);
  emit(page, failed, loader);
  assert.deepEqual(collect(), { harness: [{ text: failed, at: loader }], errors: [] });
});

test("local failures and unrecorded external failures remain errors, including the loader", () => {
  const page = new EventEmitter(), collect = collectConsoleErrors(page);
  const urls = ["http://localhost:18847/broken.js", loader, "https://example.com/other.js", ""];
  for (const at of urls) emit(page, failed, at);
  assert.deepEqual(collect(), { harness: [], errors: urls.map(at => ({ text: failed, at })) });
});

test("HTTP, CSP, transport and application errors at an aborted URL are still errors", () => {
  const page = new EventEmitter(), collect = collectConsoleErrors(page);
  recordHarnessAbort(page, loader);
  const texts = [
    "Failed to load resource: the server responded with a status of 404 (Not Found)",
    "Failed to load resource: the server responded with a status of 500 (Internal Server Error)",
    "Failed to load resource: net::ERR_CONNECTION_REFUSED",
    "Refused to load the script because it violates the Content Security Policy directive",
    "ResizeObserver loop completed with undelivered notifications.",
    "TypeError: broken application",
  ];
  for (const text of texts) emit(page, text, loader);
  assert.deepEqual(collect(), { harness: [], errors: texts.map(text => ({ text, at: loader })) });
});

test("abort records cannot leak across browser pages", () => {
  const first = new EventEmitter(), second = new EventEmitter(), collect = collectConsoleErrors(second);
  recordHarnessAbort(first, loader);
  emit(second, failed, loader);
  assert.deepEqual(collect(), { harness: [], errors: [{ text: failed, at: loader }] });
});

test("classification happens at assertion time, after either event ordering", () => {
  const page = new EventEmitter(), collect = collectConsoleErrors(page);
  emit(page, failed, loader);
  recordHarnessAbort(page, loader);
  assert.deepEqual(collect(), { harness: [{ text: failed, at: loader }], errors: [] });
});

test("one recorded abort cannot pardon another failure at the same URL", () => {
  const page = new EventEmitter(), collect = collectConsoleErrors(page);
  recordHarnessAbort(page, loader);
  emit(page, failed, loader);
  emit(page, failed, loader);
  assert.deepEqual(collect(), { harness: [{ text: failed, at: loader }], errors: [{ text: failed, at: loader }] });
  recordHarnessAbort(page, loader);
  assert.deepEqual(collect(), { harness: [{ text: failed, at: loader }, { text: failed, at: loader }], errors: [] });
});
