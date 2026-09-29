// Intent-loaded browser installation. The lease bounds concurrency and time;
// it makes no inference about device RAM from server or navigator metrics.
import { ngGameplanStudyInstall } from './game-study-install.src.js';
import { ngGameplanStudyControls } from './game-study-controls.src.js';
import * as identity from './mdp-identity.src.js';
import { ngKnowledgeFingerprint } from './knowledge-profile.src.js';

export function ngGameplanStudyBrowserAdmission(app, { build, document, isCurrent, now = () => performance.now() }) {
  const limits = build?.computation?.study?.scheduler;
  if (!limits || !Number.isSafeInteger(limits.maxRunMilliseconds) || limits.maxRunMilliseconds <= 0)
    throw new Error('missing-browser-study-limits');
  let active = null, serial = 0;
  return (meta, signal) => {
    if (signal?.aborted || !isCurrent() || app.__ngDestroyed)
      throw new Error('stale-browser-study-admission');
    if (document.visibilityState !== 'visible') return { status: 'deferred', dependency: 'visible-page' };
    if (active) return { status: 'deferred', dependency: 'previous-study-worker' };
    if (!Number.isSafeInteger(meta?.scope?.starts) || meta.scope.starts < 1 || meta.scope.starts > limits.maxStarts
      || !Number.isSafeInteger(meta.scope.scenarios) || meta.scope.scenarios < 1 || meta.scope.scenarios > limits.maxScenarios)
      throw new Error('browser-study-demand-outside-admission');
    const lease = { status: 'admitted', id: 'browser-study:' + (++serial), expiresAt: now() + limits.maxRunMilliseconds,
      release() { if (active === lease) active = null; } };
    active = lease;
    return lease;
  };
}

export function ngGameplanStudyInstallBrowser(app, options) {
  const document = options.document || globalThis.document;
  if (!options.isCurrent() || !document) throw Object.assign(new Error('stale-browser-study-installation'), { phase: 'unavailable' });
  // Controls arrive after deliberate plan intent. They do not capture input,
  // start a worker, or select a scope/target when they are installed or painted.
  app._gameStudyControlsRuntime = ngGameplanStudyControls;
  const build = options.build, limits = build.computation.study.scheduler;
  const now = options.now || (() => performance.now());
  const admit = ngGameplanStudyBrowserAdmission(app, { build, document, isCurrent: options.isCurrent, now });
  return ngGameplanStudyInstall(app, { ...options, now, identity, knowledge: { ngKnowledgeFingerprint },
    documentURL: document.baseURI, admit,
    presenterBounds: { maxScenarios: limits.maxScenarios, maxDecks: build.computation.study.manifest.maxDecks,
      maxEvidenceNodes: limits.maxResultNodes, maxStringLength: limits.maxResultBytes } });
}
