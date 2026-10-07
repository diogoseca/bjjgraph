import test from 'node:test';
import assert from 'node:assert/strict';
import {ngStudyBuildRegistration,ngStudyInstallBuiltWorker} from '../neural/src/game-study-entry.src.js';
const hash=x=>x.repeat(64),h=hash('a'),build={mechanics:{modelHash:hash('b'),graphHash:hash('c'),opponentPolicyHash:hash('d'),manifestHash:hash('e'),manifestBytes:300},
  variants:[1,2,4].flatMap(lossAversion=>['gi','nogi'].map(ruleset=>({ruleset,lossAversion,status:'COMPLETE',mechanicsHash:ruleset+lossAversion,sha256:h,file:'variant-'+h+'.json',evFrame:'reference'}))),lossAversions:[1,2,4]};
const request={modelHash:build.mechanics.modelHash,graphHash:build.mechanics.graphHash,opponentPolicyHash:build.mechanics.opponentPolicyHash,ruleset:'nogi',mechanicsHash:'nogi4'};
test('study worker selects exact baked frame/lambda and derives URLs from its own location',()=>{
 const r=ngStudyBuildRegistration(build,{...request,metadataUrl:'https://untrusted.invalid/steal',dataBase:'https://wrong.invalid/'},'https://site.test/neural/app/game-study.worker.js?v=12');
 assert.equal(r.registration.lossAversion,4);assert.equal(r.registration.evIndex,2);assert.equal(r.registration.ruleset,'nogi');assert.equal(r.dataBase,'https://site.test/neural/');
 assert.equal(r.registration.metadataUrl,'https://site.test/neural/mdp/variant-'+h+'.json');assert.equal(r.registration.manifestUrl,'https://site.test/neural/mdp/manifest-'+hash('e')+'.json');
});
test('study registration rejects moving build identities and ambiguous or incomplete variants',()=>{
 for(const key of ['modelHash','graphHash','opponentPolicyHash'])assert.throws(()=>ngStudyBuildRegistration(build,{...request,[key]:'changed'},'https://site.test/neural/app/w.js'),/stale-study-build/);
 assert.throws(()=>ngStudyBuildRegistration({...build,variants:[...build.variants,build.variants.at(-1)]},request,'https://site.test/neural/app/w.js'),/unavailable-study-mechanics-variant/);
 assert.throws(()=>ngStudyBuildRegistration({...build,variants:build.variants.map(v=>({...v,status:'PARTIAL'}))},request,'https://site.test/neural/app/w.js'),/invalid-study-mechanics-variant/);
 assert.throws(()=>ngStudyBuildRegistration(build,{...request,mechanicsHash:'missing'},'https://site.test/neural/app/w.js'),/unavailable-study-mechanics-variant/);
 for(const url of ['file:///tmp/w.js','https://user:password@site.test/neural/app/w.js'])assert.throws(()=>ngStudyBuildRegistration(build,request,url),/invalid-study-worker-location/);
});
test('study worker requires explicit computation admission before metadata or engine work',()=>{
 let touched=false;assert.throws(()=>ngStudyInstallBuiltWorker({}, {...build,sources:{graphHash:'g',indexHash:'i',lawHashes:{}},computation:{}},
  {M:{ngMdpDigest:()=> 'test'},createMetadataHost(){touched=true;}},{workerURL:'https://site.test/neural/app/w.js'}),/missing-study-computation-admission/);assert.equal(touched,false);
});
