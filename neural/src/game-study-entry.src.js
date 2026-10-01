// A dedicated study worker selects only build-pinned metadata and source URLs.
import { ngGameplanStudyInstallWorker } from './study-worker.src.js';

export function ngStudyBuildRegistration(build, request, workerURL) {
  const expected=build.mechanics,base=new URL('../',workerURL);
  if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw new Error('invalid-study-worker-location');
  const variants=build.variants.filter(v=>v.ruleset===request.ruleset&&v.mechanicsHash===request.mechanicsHash);
  if(variants.length!==1)throw new Error('unavailable-study-mechanics-variant');
  const v=variants[0],index=build.lossAversions.indexOf(v.lossAversion);
  if(index<0||v.status!=='COMPLETE'||v.file!=='variant-'+v.sha256+'.json'||!/^[a-f0-9]{64}$/.test(v.sha256))throw new Error('invalid-study-mechanics-variant');
  for(const key of ['modelHash','graphHash','opponentPolicyHash'])if(request[key]!==expected[key])throw new Error('stale-study-build:'+key);
  const registration={verified:true,coverage:{status:'COMPLETE'},modelHash:expected.modelHash,graphHash:expected.graphHash,opponentPolicyHash:expected.opponentPolicyHash,
    mechanicsHash:v.mechanicsHash,metadataHash:v.sha256,metadataUrl:new URL('mdp/'+v.file,base).href,
    manifestHash:expected.manifestHash,manifestBytes:expected.manifestBytes,manifestUrl:new URL('mdp/manifest-'+expected.manifestHash+'.json',base).href,
    ruleset:v.ruleset,evFrame:v.evFrame,evIndex:index,lossAversion:v.lossAversion};
  return {registration,dataBase:base.href};
}

export function ngStudyInstallBuiltWorker(endpoint,build,deps,environment={}) {
  const body={graphHash:build.sources.graphHash,indexHash:build.sources.indexHash,lawHashes:build.sources.lawHashes};
  const installation={...body,id:deps.M.ngMdpDigest(body)},bounds=build.computation.study;
  if(!bounds?.scheduler)throw new Error('missing-study-computation-admission');
  const workerURL=environment.workerURL||globalThis.location?.href;
  if(typeof workerURL!=='string')throw new Error('missing-study-worker-location');
  const metadataHost=deps.createMetadataHost({mdp:deps.M,knowledge:deps.K,expected:build.mechanics,
    registrationKey:deps.registrationKey,...(environment.fetch?{fetch:environment.fetch}:{})});
  return ngGameplanStudyInstallWorker(endpoint,{identity:deps.M,fingerprint:deps.K.ngKnowledgeFingerprint,installation,
    async execute(job,control){
      const selected=ngStudyBuildRegistration(build,job.baseline.request,workerURL);
      const engine=deps.createEngine({expected:build.sources,...selected,installation,bounds},
        {M:deps.M,G:deps.G,K:deps.K,E:deps.E,evaluateStudyScenarios:deps.evaluateStudyScenarios,metadataHost,
          ...(environment.fetch?{fetch:environment.fetch}:{})});
      try{return await engine.execute(job,control);}finally{engine.dispose();}
    }},bounds.scheduler);
}
