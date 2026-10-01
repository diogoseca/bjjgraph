import { NG_GAMEPLAN_STUDY_PROTOCOL as protocol, ngStudyDemand, ngStudyLimits, ngStudyInstallation,
  ngStudySnapshot, ngStudyJsonLimits } from './study-scheduler.src.js';

// Dedicated study worker only. Root supplies the real source/bridge executor.
export function ngGameplanStudyInstallWorker(endpoint, deps, inputLimits) {
  const limits = ngStudyLimits(inputLimits), installation = ngStudyInstallation(deps.installation, deps.identity, limits);
  let active = null, used = false, destroyed = false;
  const post = (token, message) => {
    if (destroyed || active !== token || token.cancelled) return;
    endpoint.postMessage(ngStudySnapshot({ protocol, jobId: token.id, key: token.key, ...message }, ngStudyJsonLimits(limits, true)));
  };
  const receive = async event => {
    let token;
    try {
      const message = ngStudySnapshot(event.data, ngStudyJsonLimits(limits));
      if (destroyed || message.protocol !== protocol) return;
      if (message.type === 'cancel') {
        if (active && message.jobId === active.id && message.key === active.key) active.cancelled = true;
        return;
      }
      if (message.type !== 'run' || typeof message.jobId !== 'string' || typeof message.key !== 'string') return;
      if (used) { endpoint.postMessage({ protocol, jobId: message.jobId, key: message.key, type: 'error', reason: 'study-worker-single-job-only' }); return; }
      used = true;
      token = { id: message.jobId, key: message.key, cancelled: false }; active = token;
      const check = () => { if (destroyed || active !== token || token.cancelled) throw new Error('study-worker-cancelled'); };
      const { job, key } = ngStudyDemand(message.job, deps, limits, installation);
      if (key !== message.key) throw new Error('study-demand-key-mismatch');
      if (typeof deps.execute !== 'function') throw new Error('missing-study-batch-executor');
      post(token, { type: 'accepted' }); check();
      const result = await deps.execute(job, Object.freeze({ installation, check,
        progress(stage) { check(); post(token, { type: 'progress', stage }); } }));
      check();
      if (!result || !['ready', 'partial', 'unavailable'].includes(result.status)) throw new Error('invalid-study-executor-result');
      post(token, { type: 'result', result });
    } catch (error) {
      if (token) {
        try { post(token, { type: 'error', reason: error.message || 'study-worker-failed' }); }
        catch (_) { if (!destroyed && active === token && !token.cancelled) endpoint.postMessage({ protocol, jobId: token.id, key: token.key, type: 'error', reason: 'study-worker-result-over-limit' }); }
      }
    }
  };
  endpoint.addEventListener('message', receive);
  return Object.freeze({ destroy() { if (destroyed) return; destroyed = true; if (active) active.cancelled = true; endpoint.removeEventListener('message', receive); } });
}
