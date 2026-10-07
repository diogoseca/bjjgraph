// Real corpus target. Default emits current bound metadata from required Neural
// assets; explicit BJJ_MDP_METADATA_DIR/BJJ_MDP_WIRE_DIR select a measured snapshot.
// No synthetic fallback, truncation or silently skipped missing input.
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const M=new Function('module','require',read('neural/src/mdp-identity.src.js')+'\n'+read('neural/src/mdp-model.src.js')+'\nconst core=module.exports;\n'+read('neural/src/mdp-adapter.src.js')+'\nreturn {...core,...module.exports};')({exports:{}},createRequire(new URL('../neural/src/mdp-model.src.js',import.meta.url)));
const knowledgeSource=readFileSync(process.env.BJJ_MDP_KNOWLEDGE_SOURCE||new URL('../neural/src/knowledge-profile.src.js',import.meta.url),'utf8');
const K=await import('data:text/javascript;base64,'+Buffer.from(knowledgeSource).toString('base64'));
const Component=new Function('DCLogic','React',knowledgeSource.replace(/^export /gm,'')+'\n'+read('neural/src/app.src.jsx')+'\nreturn Component;')(class {},{createRef:()=>({current:null})});
const sourceRoot=fileURLToPath(new URL('..',import.meta.url));
const wireDirectory=process.env.BJJ_MDP_WIRE_DIR||resolve(sourceRoot,'source/quartz/static/neural');
let directory=process.env.BJJ_MDP_METADATA_DIR;
if(!directory){
  // Standard unit runs use the required real emitted corpus, never a fixture or
  // skip. Explicit resource/performance probes may provide their bound snapshot.
  const generated=mkdtempSync(resolve(tmpdir(),'mdp-solver-corpus-'));
  after(()=>rmSync(generated,{recursive:true,force:true}));
  directory=resolve(generated,'decoded');
  execFileSync('python3',['-B',resolve(sourceRoot,'scripts/regenerate_mdp_data.py'),
    '--source-root',sourceRoot,'--data-root',wireDirectory,
    '--output',resolve(generated,'transport'),'--decoded-output',directory],
    {encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
}
const raw=readFileSync(resolve(wireDirectory,'graph-data.json'));
const digest=x=>createHash('sha256').update(x).digest('hex');
const graphHash=digest(raw);
const lossAversion=Number(process.env.BJJ_MDP_LOSS_AVERSION||2);
const meta=frame=>JSON.parse(readFileSync(resolve(directory,frame+'-lambda-'+lossAversion+'.json')));
function requestFor(graph,profile,snapshot,horizon={kind:'actual-roll',episodeCap:Number(process.env.BJJ_MDP_PROBE_CAP||9),moveCount:snapshot.moveCount}){
  const request={apiVersion:2,requestId:'corpus',revision:1,modelHash:'corpus:'+digest(JSON.stringify(graph)),mechanicsHash:'test-law:'+digest(read('neural/src/mdp-adapter.src.js')),graphHash,profileHash:profile.fingerprint,opponentPolicyHash:'actual-source:'+digest(read('neural/src/app.src.jsx')),ruleset:graph.ruleset,state:{id:'',snapshot,aiSkill:.07},horizon,objective:'max-win/min-loss/min-nontermination',futureStudyPolicy:'no-additional-study-events'};
  return request;
}
function appFor(frame){
  const a=Object.create(Component.prototype);
  Object.assign(a,{settings:{},beats:[],get:(key,v)=>key==='lossAversion'?lossAversion:v,set(){},track(){},fx(){},_saveProgress(){},playerRole:'top',currentPos:0,prep:{},_sharp:{},_giMode:frame,aiSkill:.07,_qMod:0,_combo:0,flashcards:{decks:{}}});
  a.ingest(JSON.parse(raw));
  for(const n of a.nodes.filter(n=>n.ty==='submissions'&&n.role==='attacker')){
    const body=JSON.parse(readFileSync(resolve(wireDirectory,'submission-details',a.qhash(n.t)+'.json')))[n.t];
    n.cal.defenses=body.choices;n._defenseDetails=body.details;
  }
  return a;
}

test('complete metadata bounded solver measurement preserves the sampled roll clock',()=>{
  const measurements=[];
  for(const frame of (process.env.BJJ_MDP_PROBE_FRAMES||'gi').split(',')){
    const graph=meta(frame);assert.equal(graph.coverage.status,'COMPLETE');
    const data={prep:{},sharp:{}};
    if(process.env.BJJ_MDP_PROBE_PROFILE==='learned')for(const [i,n] of graph.nodes.entries()){
      data.prep[n.deckKey]=i%6;
      if(i%43===0)data.sharp[n.deckKey]=.1;
    }
    const profile=K.ngKnowledgeBuildProfile(data),baseAdapter=M.ngMdpCreateGameAdapter(graph,profile,K,{deckReady:{}});
    const challengeId=process.env.BJJ_MDP_PROBE_CHALLENGE;
    const curriculum=challengeId?JSON.parse(readFileSync(resolve(wireDirectory,'curriculum.json'))):null;
    const challenge=curriculum?.belts.find(b=>b.id===challengeId);if(challengeId)assert.ok(challenge,'authored challenge exists');
    const start=challenge?graph.nodes.find(n=>n.id===challenge.test.startNodeId):graph.nodes.find(n=>n.t==='Triangle Choke from Triangle Control'&&n.role==='attacker');assert.ok(start);
    for(const count of (process.env.BJJ_MDP_PROBE_COUNTS||'8').split(',').map(Number)){
      let snapshot={nodeId:start.id,role:challenge?challenge.test.startDeckKey.split('|')[1].toLowerCase():start.fromRole,phase:'user',moveCount:count,arrivalAge:0,qMod:0,combo:0,positionKey:start.deckKey,panicKey:null};
      const request=requestFor(graph,profile,snapshot);let adapter=baseAdapter,startCount=1;
      if(process.env.BJJ_MDP_HORIZON==='eventual')request.horizon={kind:'eventual'};
      if(challenge){request.horizon.episodeCap=challenge.test.maxMoves;request.state.challenge={names:challenge.pool[frame],pointsWin:challenge.test.pointsWinDominance};assert.notEqual(process.env.BJJ_MDP_ALL_STARTS,'1','challenge uses its authored start');}
      if(process.env.BJJ_MDP_ALL_STARTS==='1'){
        const nodes=new Map(graph.nodes.map(n=>[n.id,n])),unique=new Map();
        for(const key of Object.keys(graph.hands)){
          const [id,role]=JSON.parse(key),nodeId=graph.canonical[key]||id,n=nodes.get(nodeId);
          if(!n.allowed)continue;
          const s={...snapshot,nodeId,role,positionKey:n.deckKey};
          unique.set(baseAdapter.stateId(s,request),s);
        }
        const starts=[...unique.values()];startCount=starts.length;
        snapshot={...snapshot,nodeId:'@all-corpus-starts',positionKey:null};request.state.snapshot=snapshot;
        adapter={...baseAdapter,
          normalize:(s,r)=>s.nodeId==='@all-corpus-starts'?s:baseAdapter.normalize(s,r),
          behaviorKey:(s,r)=>s.nodeId==='@all-corpus-starts'?'@all-corpus-starts':baseAdapter.behaviorKey(s,r),
          stateId:(s,r)=>s.nodeId==='@all-corpus-starts'?M.ngMdpStateId(s):baseAdapter.stateId(s,r),
          enumerate:(s,r)=>s.nodeId==='@all-corpus-starts'?{id:M.ngMdpStateId(s),actions:[{id:'declared-uniform-all-legal-role-contexts',branches:starts.map(next=>({probability:'1/'+starts.length,next}))}]}:baseAdapter.enumerate(s,r)};
      }
      request.state.id=adapter.stateId(snapshot,request);
      const begin=performance.now();
      const admission={maxStates:Number(process.env.BJJ_MDP_MAX_STATES||20000),maxBranches:Number(process.env.BJJ_MDP_MAX_BRANCHES||200000)};
      let model;
      try{model=M.ngMdpExpand(adapter,request,{...admission,maxMilliseconds:10000});}
      catch(error){console.log('MDP_CORPUS_PREPARATION_UNAVAILABLE '+JSON.stringify({frame,count,cap:request.horizon.episodeCap,startCount,profile:process.env.BJJ_MDP_PROBE_PROFILE||'neutral',reason:error.message,coverage:error.coverage,elapsedMilliseconds:performance.now()-begin,peakRssKiB:process.resourceUsage().maxRSS}));throw error;}
      const prepared=performance.now(),byId=new Map(model.states.map(s=>[s.id,s]));
      const components=M.ngMdpComponents([...byId.keys()],id=>byId.get(id).actions.flatMap(a=>(a.branches||[]).filter(b=>b.to).map(b=>b.to)));
      const result=M.ngMdpSolve(model,request,{...admission,maxMilliseconds:15000});
      const measurement={frame,lossAversion,horizon:request.horizon.kind,count,cap:request.horizon.episodeCap,startCount,challenge:challengeId||null,profile:process.env.BJJ_MDP_PROBE_PROFILE||'neutral',profileHash:profile.fingerprint,graphHash,metadataHash:digest(JSON.stringify(graph)),knowledgeHash:digest(knowledgeSource),states:model.states.length,branches:model.adapterCoverage.branches,equivalentRedirects:model.adapterCoverage.equivalentDestinationRedirects,largestComponent:Math.max(...components.map(c=>c.length)),prepareMilliseconds:prepared-begin,solveMilliseconds:performance.now()-prepared,peakRssKiB:process.resourceUsage().maxRSS,status:result.root.status,reason:result.root.reason||null,diagnostics:result.diagnostics,outcomes:result.root.outcomes||null};
      measurements.push(measurement);console.log('MDP_CORPUS_SOLVER '+JSON.stringify(measurement));
      assert.ok(['ready','bounded'].includes(result.root.status),result.root.reason);
      assert.ok(result.quality.maxWinError<=1e-4);assert.ok(result.quality.policyRegretBound<=1e-4);
      if(request.horizon.kind==='actual-roll'){assert.equal(result.horizon.moveCount,count);assert.equal(result.horizon.episodeCap,request.horizon.episodeCap);}
    }
  }
  assert.ok(measurements.length);
});

test('opponent destination ordering uses the actual source current seat in every role hand',()=>{
  let hands=0,different=0;const examples=[];
  for(const frame of ['gi','nogi']){
    const a=appFor(frame),graph=meta(frame),byId=new Map(graph.nodes.map(n=>[n.id,n]));
    for(const n of a.nodes.filter(n=>n.ty==='positions')){
      // opponentDefend canonicalizes BEFORE deciding whether to take its
      // submission or position route. Aliases never execute the position path.
      if(a.canonicalState(n.idx,n.role)!==n.idx)continue;
      a.currentPos=n.idx;a.playerRole=n.role;a._posKey=a.deckKeyFor(n).key;
      const opposite=n.role==='top'?'bottom':'top',opts=a.optionsFor(n.idx,opposite);
      for(const opt of opts.filter(o=>o.node.ty!=='submissions')){
        // the app's opponentDefend ranks by `landOf`: a move dealt from its listing's OWN table lands
        // where that table says (opt.res, _tableLanding), every other move by resultPos (v1.214.0, PR B)
        const live=opt.node&&opt.node.here!=null?opt.res:a.resultPos(opt.idx,a.currentPos),captured=opt.res;
        const liveNode=a.nodes[live]||opt.node,metaNode=byId.get(a.nodes[captured]?.id)||byId.get(opt.node.id);
        const liveVal=a.oppVal(liveNode),capturedVal=a.oppVal(metaNode);
        if(liveVal!==capturedVal){different++;if(examples.length<3)examples.push({frame,node:n.id,move:opt.node.id,live:liveNode.id,captured:metaNode.id,liveVal,capturedVal});}
      }
      hands++;
    }
  }
  console.log('MDP_OPPONENT_ORDER '+JSON.stringify({hands,different,examples}));
  assert.ok(hands>=300);assert.equal(different,0,JSON.stringify(examples));
});

test('live routing replay covers every legal entry, outcome row and defense destination',()=>{
  const counts={hands:0,entries:0,outcomes:0,escapes:0,chainedEscapes:0,opponentReplays:0};
  const STOP=Symbol('next decision reached');
  for(const frame of ['gi','nogi']){
    const base=appFor(frame),graph=meta(frame),profile=K.ngKnowledgeBuildProfile({prep:{},sharp:{}});
    const adapter=M.ngMdpCreateGameAdapter(graph,profile,K,{deckReady:{}}),seen=new Set();
    function fork(snapshot){
      const a=Object.create(base);Object.assign(a,{currentPos:base.nodes.findIndex(n=>n.id===snapshot.nodeId),playerRole:snapshot.role,moveCount:snapshot.moveCount,maxMoves:9,_combo:snapshot.combo,_qMod:snapshot.qMod,_posKey:snapshot.positionKey,_panicKey:snapshot.panicKey,_sharp:{},_testAge:0,phase:snapshot.phase,rollLog:[],evRef:{current:null},optionsRef:{current:null}});
      for(const k of ['fx','setEvent','flashFx','bumpBounce','flare','clearTimers','clearOptions','clearLandCard','_flushSave','applyDeckVisibility','_syncUrl','_prefetchLandDeck','_prefetchDefendDeck','_endArrival','hideCenter','showCenter','setStatus','_saveFlowSoon','_flushLandSkipDebt','_declineLandQ','setPaused','frameNodes','showVignette','killVignette','_syncHandLayer','buildPanicCard','releaseCamera','_disarmLandClock','_noteFlow','renderChoiceGroups'])a[k]=()=>{};
      a.cfg=()=>({signalSpeed:1});a.pairMid=()=>null;a.waitForSubmissionChoices=()=>false;a.hydrateDeck=()=>null;
      a._deckHasCards=()=>false;a.startTravel=(_path,done)=>done();a.after=(_delay,done)=>done();
      a.decaySharp=()=>{a._testAge++;Component.prototype.decaySharp.call(a);};
      a.buildDrillPanel=(...args)=>{Component.prototype.buildDrillPanel.apply(a,args);if(!a._preparingDefense)throw STOP;};
      a.enterLand=(...args)=>{a.phase='user';Component.prototype.enterLand.apply(a,args);};
      a.enterDefense=(...args)=>{a.phase='user';Component.prototype.enterDefense.apply(a,args);};
      a.opponentDefend=()=>{a.phase='opponent';};a.endRound=kind=>{a._testTerminal=kind;};
      return a;
    }
    function run(a,fn){try{fn();}catch(e){if(e!==STOP)throw e;}return a;}
    function endpoint(a,request){
      if(a._testTerminal)return {terminal:a._testTerminal==='win'?'win':a._testTerminal==='lose'?'loss':'explicitNoResult'};
      return {next:adapter.normalize({...M.ngMdpCaptureDecision(a),phase:a.phase,arrivalAge:a._testAge},request)};
    }
    function matches(actual,branches,label){
      const found=branches.some(b=>actual.terminal?b.terminal===actual.terminal:b.next&&M.ngMdpStable(b.next)===M.ngMdpStable(actual.next));
      assert.ok(found,label+' '+JSON.stringify(actual));
    }
    for(const n of base.nodes.filter(n=>['positions','submissions'].includes(n.ty)))for(const role of ['top','bottom']){
      const idx=base.canonicalState(n.idx,role),node=base.nodes[idx],key=JSON.stringify([node.id,role]);
      if(seen.has(key)||!base.rsAllows(node))continue;seen.add(key);
      const snapshot={nodeId:node.id,role,phase:'user',moveCount:8,arrivalAge:0,qMod:-.04,combo:3,positionKey:base.deckKeyFor(node).key,panicKey:null};
      const request={ruleset:frame,horizon:{kind:'actual-roll',episodeCap:9,moveCount:8},state:{snapshot,aiSkill:.07}};
      const model=adapter.enumerate(snapshot,request),a0=fork(snapshot),options=a0.optionsFor(idx,role);counts.hands++;
      for(const opt of options){
        const kind=opt.action==='enter'?'entry':opt.action||(opt.node.ty==='submissions'?'entry':'transition');
        const defenseId=opt.defense?M.ngMdpDefenseId(opt.defense,base.nodes[opt.submission]._defenseDetails?.[opt.defense.detail]):null;
        const actionId=M.ngMdpActionId(model.id,opt.node.id,kind,opt.res>=0?base.nodes[opt.res].id:null,defenseId);
        const action=model.actions.find(row=>row.id===actionId);assert.ok(action,'every real option enumerated '+key+' '+actionId);
        if(kind==='entry'){
          const a=fork(snapshot);run(a,()=>a.enterAttempt(opt));matches(endpoint(a,request),action.branches,kind+' '+opt.node.id);counts.entries++;continue;
        }
        if(kind==='escape'){
          for(const success of [true,false]){
            const a=fork(snapshot);a._preparingDefense=true;run(a,()=>a.enterDefense(opt.submission));a._preparingDefense=false;
            const chance=a.escapeChance(opt);assert.equal(chance,action.immediateExecutionChance);
            const tags=[];a.rng=tag=>{tags.push(tag);return success?chance/2:chance+(1-chance)/2;};
            run(a,()=>a._optPick(opt));matches(endpoint(a,request),action.branches,'escape '+opt.node.id);assert.deepEqual(tags,['escape']);counts.escapes++;
            if(success&&base.submissionNode(base.nodes[a.currentPos]))counts.chainedEscapes++;
          }
          continue;
        }
        assert.equal(a0.moveChance(opt.node),action.immediateExecutionChance);
        for(const success of [true,false]){
          const all=opt.node.cal?.outcomes||[],filtered=all.filter(row=>(row.result==='success')===success),rows=filtered.length?filtered:all;
          const weights=rows.map(row=>Math.max(0,+row.probability||0)*(row.result==='counter'?1-a0.momentumSkew():1)),total=weights.reduce((x,y)=>x+y,0);
          if(!rows.length){const a=fork(snapshot);run(a,()=>success?a.enterSuccess(opt):a.enterFail(opt));matches(endpoint(a,request),action.branches,kind+' fallback');counts.outcomes++;continue;}
          let before=0;
          for(const [i,row]of rows.entries()){
            if(!weights[i])continue;
            const a=fork(snapshot),tags=[];a.rng=tag=>{tags.push(tag);return(before+weights[i]/2)/total;};
            run(a,()=>a.resolve(opt,success));matches(endpoint(a,request),action.branches,kind+' '+opt.node.id+' '+row.to);assert.deepEqual(tags,['outcome']);
            before+=weights[i];counts.outcomes++;
          }
        }
      }
      const opponent={...snapshot,phase:'opponent'},opponentBranches=adapter.enumerate(opponent,request).actions[0].branches;
      function replay(queue){
        const a=fork(opponent),tags=[];a.rng=tag=>{tags.push(tag);assert.ok(Object.hasOwn(queue,tag),'unexpected RNG '+tag);return queue[tag];};
        run(a,()=>Component.prototype.opponentDefend.call(a));matches(endpoint(a,request),opponentBranches,'opponent '+node.id);counts.opponentReplays++;return tags;
      }
      const submission=base.submissionNode(node);
      if(submission){
        if(role!==submission.fromRole)assert.deepEqual(replay({}),[]);
        else {
          const responses=a0.submissionDefenses(submission);
          if(!responses.length)replay({});
          responses.forEach((_,i)=>assert.deepEqual(replay({'opp-pick':(i+.5)/responses.length}),['opp-pick']));
        }
      }else{
        const other=a0.optionsFor(idx,role==='top'?'bottom':'top').filter(o=>o.node.ty!=='positions');
        const subs=other.filter(o=>o.node.ty==='submissions'),trans=other.filter(o=>o.node.ty!=='submissions');
        const pf=subs.length?(trans.length?Math.max(.18,Math.min(.85,.34+a0.oppVal(node)*.55)):.9):0;
        subs.forEach((_,i)=>assert.deepEqual(replay({'opp-finish':pf/2,'opp-sub-pick':(i+.5)/subs.length}),['opp-finish','opp-sub-pick']));
        trans.sort((a,b)=>a0.oppVal(base.nodes[a0.resultPos(b.idx,idx)]||b.node)-a0.oppVal(base.nodes[a0.resultPos(a.idx,idx)]||a.node));
        const fallback=(trans.length?trans:subs).slice(0,3);
        if(!fallback.length)replay({});
        for(const [j,opt]of fallback.entries()){
          const rows=opt.node.cal?.outcomes||[],weights=rows.map(row=>Math.max(0,+row.probability||0)*(row.result==='counter'?1-a0.momentumSkew():1)),total=weights.reduce((x,y)=>x+y,0);
          let before=0;
          if(!rows.length)replay({'opp-finish':pf+(1-pf)/2,'opp-pick':(j+.5)/fallback.length});
          for(const [i]of rows.entries())if(weights[i]){
            const queue={'opp-finish':pf+(1-pf)/2,'opp-pick':(j+.5)/fallback.length,outcome:(before+weights[i]/2)/total};
            assert.deepEqual(replay(queue),[...(subs.length?['opp-finish']:[]),'opp-pick','outcome']);before+=weights[i];
          }
        }
      }
    }
  }
  console.log('MDP_SOURCE_ROUTING '+JSON.stringify({graphHash,appHash:digest(read('neural/src/app.src.jsx')),...counts}));
  assert.ok(counts.entries>1000&&counts.outcomes>2000&&counts.escapes>2000&&counts.chainedEscapes>0&&counts.opponentReplays>1000);
});
