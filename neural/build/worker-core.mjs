// Shared executable bytes, separate worker-local instances. Never loaded by main.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const sha = value => createHash('sha256').update(value).digest('hex');
const key = '__NG_GAME_WORKER_CORE_V1__';
const identity = ['NG_MDP_API_VERSION','NG_MDP_OBJECTIVE','ngMdpStable','ngMdpDigest','ngMdpContractHash',
  'ngMdpActionId','ngMdpStateId','ngMdpNormalizeRootSnapshot','ngMdpDefenseId','ngMdpEnvelope'];
const math = ['NG_MDP_OUTCOMES','ngMdpSolve','ngMdpSolveAsync','ngMdpCompile','ngMdpRat','ngMdpAdd',
  'ngMdpSub','ngMdpMul','ngMdpDiv','ngMdpFraction','ngMdpNumber','ngMdpComponents','ngMdpProbability','ngMdpCmp'];
const knowledge = ['NG_KNOWLEDGE_VERSION','NG_KNOWLEDGE_STUDY_POLICY','ngKnowledgeMastery','ngKnowledgeBonus',
  'ngKnowledgeSharpAfter','ngKnowledgeAdvance','ngKnowledgeOutcomeWeights','ngKnowledgeSkew','ngKnowledgeExplainMove',
  'ngKnowledgeExplainEscape','ngKnowledgeFingerprint','ngKnowledgeOverride'];
const runtime = ['ngMdpCreateGameAdapter','ngMdpExpandAsync','ngMdpInstallWorker',
  'ngGameValueRegistrationKey','ngGameValueCreateWorkerHost'];
const names = [...identity,...math,...knowledge,...runtime];
const files = ['mdp-identity.src.js','mdp-model.src.js','mdp-certified.src.js','knowledge-profile.src.js',
  'mdp-adapter.src.js','mdp-worker.src.js','game-value-provider.src.js','game-value-loader.src.js'];

export async function buildGameWorkerCore({root,build,joinSources,common,expected}) {
  const sourceHashes = Object.fromEntries(files.map(file => [file,sha(readFileSync(resolve(root,'neural/src',file)))]));
  const sourceKey = sha(JSON.stringify({abi:1,sourceHashes,lawHashes:expected.lawHashes,names}));
  const contents = joinSources(root,files) + `\nif(Object.prototype.hasOwnProperty.call(globalThis,${JSON.stringify(key)}))throw new Error('duplicate-game-worker-core');\n`
    + `Object.defineProperty(globalThis,${JSON.stringify(key)},{value:Object.freeze({abi:1,sourceKey:${JSON.stringify(sourceKey)},${names.join(',')}})});\n`;
  const result = await build({...common,stdin:{contents,resolveDir:resolve(root,'neural/src'),sourcefile:'game-worker-core.js'},
    target:'es2020',format:'iife',write:false});
  if(result.outputFiles.length!==1)throw new Error('game-worker-core: unexpected output inventory');
  const bytes = result.outputFiles[0].contents, hash = sha(bytes), file = 'game-worker-core-'+hash+'.js';
  writeFileSync(resolve(root,'neural/dist',file),bytes);
  // ES module dependencies in the study bundle execute before its entry body.
  // A classic banner loads the core before that complete bundled module graph.
  const bootstrap = `(()=>{const u=new URL(${JSON.stringify(file)},globalThis.location.href);`
    + `if(!['http:','https:'].includes(u.protocol)||u.origin!==globalThis.location.origin||u.username||u.password)throw new Error('invalid-game-worker-core-location');`
    + `importScripts(u.href);const c=globalThis[${JSON.stringify(key)}];`
    + `if(!c||c.abi!==1||c.sourceKey!==${JSON.stringify(sourceKey)})throw new Error('stale-game-worker-core');})();`;
  const bindings = `const {${names.join(',')}}=globalThis[${JSON.stringify(key)}];\n`;
  const plugin = {name:'worker-core-knowledge',setup(api) {
    api.onResolve({filter:/(^|\/)knowledge-profile\.src\.js$/},args => {
      if(resolve(args.resolveDir,args.path)!==resolve(root,'neural/src/knowledge-profile.src.js'))throw new Error('game-worker-core: unexpected knowledge import');
      return {path:'knowledge-profile',namespace:'game-worker-core'};
    });
    api.onLoad({filter:/.*/,namespace:'game-worker-core'},() => ({loader:'js',contents:
      `const core=globalThis[${JSON.stringify(key)}];\n`+knowledge.map(name=>`export const ${name}=core.${name};`).join('\n')}));
  }};
  return {file,sha256:hash,bytes:bytes.length,sourceKey,sourceHashes,bootstrap,bindings,plugin};
}
