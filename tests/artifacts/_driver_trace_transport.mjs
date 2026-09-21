// Optional preload for tracing quartz_driver.test.mjs's spawned processes and workers.
// This is transport for the EXISTING dev tracer, not another dependency guard or matcher.
//   mkdir /tmp/driver-trace
//   DRIVER_TRACE_DIR=/tmp/driver-trace NODE_OPTIONS="--import=$(pwd)/tests/artifacts/_driver_trace_transport.mjs" \
//     TRACE_OUT=/tmp/driver-trace/parent.json CI=true node --import ./tests/artifacts/_promised_deps_trace.mjs tests/quartz_driver.test.mjs
// Use a fresh output directory; union the package keys across every receipt. Plain CLI
// --import alone does not reach spawnSync children. Each PID/thread needs its own file.
import path from "node:path";
import { threadId, parentPort } from "node:worker_threads";

const directory = process.env.DRIVER_TRACE_DIR;
if (!directory || !path.isAbsolute(directory)) {
  throw new Error("driver trace transport requires an absolute DRIVER_TRACE_DIR");
}
process.env.TRACE_OUT = path.join(directory, `${process.pid}-${threadId}.json`);
const prior = new Set(process.listeners("exit"));
await import("./_promised_deps_trace.mjs");
const added = process.listeners("exit").filter((fn) => !prior.has(fn));
if (added.length !== 1) {
  throw new Error("expected exactly one canonical trace writer");
}
// Worker.terminate() bypasses worker exit listeners. Flush ONLY the canonical writer
// before the existing reply; do not emit an exit event or run unrelated exit handlers.
// The caller's MessagePort arguments and result remain unchanged. This route is pinned
// by an exact three-receipt control: parent chalk, child gray-matter, worker github-slugger,
// including a worker terminated immediately after its first reply (D-S1-14 evidence).
if (parentPort) {
  const send = parentPort.postMessage;
  parentPort.postMessage = function (...args) {
    added[0]();
    return Reflect.apply(send, this, args);
  };
}
