// Worker assembly is separate from live card computation and the eager bundle.
// Caller supplies the already verified mechanics build and resource admission.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
// The one decoder of the deck manifest (format 4 keys decks by share ordinal, v1.204.3).
import { ngWireDecks } from '../src/wire-keys.src.js';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export async function buildStudyBundles({ root, build, common, expected, runtimeBuild, joinSources, computation, core }) {
  const src=resolve(root,'neural/src'),dist=resolve(root,'neural/dist'),data=resolve(root,'source/quartz/static/neural');
  const graphBytes=readFileSync(resolve(data,'graph-data.json')),indexBytes=readFileSync(resolve(data,'flashcards/_index.json'));
  if(sha(graphBytes)!==expected.graphHash)throw new Error('study-bundles: graph changed after mechanics admission');
  const files={wireKeys:'wire-keys.src.js',exposure:'mdp-exposure.src.js',studyBridge:'study-native-bridge.src.js',studyEngine:'game-study-engine.src.js',
    projector:'knowledge-scenarios.src.js',manifestProducer:'knowledge-scenario-manifest.src.js',coordinator:'gameplan-study-provider.src.js',
    presenter:'gameplan-study-presenter.src.js',host:'gameplan-study-host.src.js',inputs:'game-study-inputs.src.js',installer:'game-study-install.src.js',controls:'game-study-controls.src.js',browser:'game-study-browser.src.js',batch:'study-batch-runner.src.js',scheduler:'study-scheduler.src.js',transport:'study-worker.src.js',sources:'game-study-sources.src.js',entry:'game-study-entry.src.js'};
  const laws={...expected.lawHashes,...Object.fromEntries(Object.entries(files).map(([name,file])=>[name,sha(readFileSync(resolve(src,file)))]))};
  const sources={graphHash:expected.graphHash,indexHash:sha(indexBytes),graphBytes:graphBytes.length,indexBytes:indexBytes.length,lawHashes:laws};
  const graph=JSON.parse(graphBytes),index=JSON.parse(indexBytes),dec=ngWireDecks(index,graph.nodes),decks=Object.keys(dec.decks).length;
  // Skipped, never guessed: an ordinal the graph cannot name means the two files are from different emits.
  if(dec.unresolved||dec.dupes)throw new Error(`study-bundles: manifest decode left ${dec.unresolved} unresolved and ${dec.dupes} duplicate ordinal(s)`);
  if(!graph.nodes.length||!decks)throw new Error('study-bundles: empty source admission');
  // These are whole-request computation limits. Over-limit jobs refuse in full;
  // no rows are selected/truncated, and these values are not gameplay clocks.
  const study={
    scheduler:{maxRequestNodes:500000,maxRequestBytes:8*1024*1024,maxResultNodes:2000000,maxResultBytes:32*1024*1024,maxDepth:48,
      maxStarts:graph.nodes.length*2,maxScenarios:decks*2+Object.keys(index.shared).length,maxTargets:decks,maxQueueMilliseconds:30000,maxRunMilliseconds:120000},
    manifest:{maxGraphBytes:graphBytes.length,maxIndexBytes:indexBytes.length,maxNodes:graph.nodes.length,maxDecks:decks,maxSharedGroups:Object.keys(index.shared).length,maxSharedMemberships:100000},
    projector:{maxTargets:decks,maxDecks:decks,maxSharedGroups:Object.keys(index.shared).length,maxSharedMemberships:100000},
    coordinator:{maxScenarios:decks*2+Object.keys(index.shared).length,maxDecksPerScenario:decks,maxProfileKeys:decks},
    bridge:{maxStarts:graph.nodes.length*2,maxStates:40000,maxBranches:400000,maxWorkStates:40000,maxWorkBranches:400000,maxRationalBits:8192,maxCacheEntries:2,
      maxMilliseconds:60000,maxPrepareMilliseconds:10000,maxSolveMilliseconds:15000,maxFixedMilliseconds:15000,maxExposureMilliseconds:15000,maxQueries:32}
  };
  const config={sources,mechanics:expected,variants:runtimeBuild.variants,lossAversions:graph.evLam,version:runtimeBuild.version,computation:{...computation,study}};
  const M=['NG_MDP_API_VERSION','NG_MDP_OBJECTIVE','ngMdpStable','ngMdpDigest','ngMdpContractHash','ngMdpActionId','ngMdpStateId','ngMdpDefenseId','ngMdpNormalizeRootSnapshot','ngMdpEnvelope',
    'ngMdpSolve','ngMdpSolveAsync','ngMdpCompile','ngMdpRat','ngMdpAdd','ngMdpSub','ngMdpMul','ngMdpDiv','ngMdpFraction','ngMdpNumber','ngMdpComponents'];
  const G=['ngMdpCreateGameAdapter'];
  // The adapter and engine receive only their actual probability/profile interface.
  // Link the authoritative ESM once, shared with scenario/manifest imports, instead
  // of retaining a second concatenated copy and the unrelated grading API.
  const K=['ngKnowledgeBonus','ngKnowledgeSharpAfter','ngKnowledgeAdvance','ngKnowledgeOutcomeWeights',
    'ngKnowledgeSkew','ngKnowledgeExplainMove','ngKnowledgeExplainEscape','ngKnowledgeFingerprint','ngKnowledgeOverride',
    'ngKnowledgeCalAt'];   // a listing's own table (v1.214.0): the adapter's actAt
  const E=['ngMdpCreateExposureAdapter','ngMdpEvaluateFixedPolicyAsync','ngMdpEvaluateExposureAsync','ngMdpExposureProviderRecord'];
  const names=list=>'{'+list.join(',')+'}';
  // All frozen native arithmetic stays in one worker-local scope. ESM wrappers
  // are linked by esbuild, so their private helpers cannot collide with native laws.
  const worker=core.bindings+joinSources(root,['mdp-learning.src.js','mdp-exposure.src.js'])
    +`import {ngStudyCreateEngine} from './game-study-engine.src.js';\n`
    +`import {ngStudyInstallBuiltWorker} from './game-study-entry.src.js';\n`
    +`ngStudyInstallBuiltWorker(self,${JSON.stringify(config)},{M:${names(M)},G:${names(G)},K:${names(K)},E:${names(E)},\n`
    +`evaluateStudyScenarios:ngMdpEvaluateStudyScenarios,createMetadataHost:ngGameValueCreateWorkerHost,registrationKey:ngGameValueRegistrationKey,createEngine:ngStudyCreateEngine});\n`;
  const host=`export * as identity from './mdp-identity.src.js';
export {ngGameplanStudyInstallBrowser} from './game-study-browser.src.js';
export {ngGameplanStudyCreateHost} from './gameplan-study-host.src.js';
export {ngStudySnapshot,ngGameplanStudyCreateScheduler} from './study-scheduler.src.js';\nexport {ngGameplanStudyPresent} from './gameplan-study-presenter.src.js';\nexport const NG_GAMEPLAN_STUDY_BUILD=${JSON.stringify(config)};\n`;
  await build({...common,banner:{js:core.bootstrap},plugins:[core.plugin],stdin:{contents:worker,resolveDir:src,sourcefile:'game-study.worker.js'},target:'es2020',format:'iife',outfile:resolve(dist,'game-study.worker.js')});
  await build({...common,stdin:{contents:host,resolveDir:src,sourcefile:'game-study.js'},target:'es2020',format:'esm',outfile:resolve(dist,'game-study.js')});
  // The caller includes both in the ordinary aggregate receipt and payload gates.
  return {files:['game-study.js','game-study.worker.js'],config};
}
