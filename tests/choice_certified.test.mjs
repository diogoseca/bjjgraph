// Certified consumer contract regressions; source fixture intentionally isolated.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ngChoiceValueController,ngChoiceValueView,ngChoiceValueOrder} from '../neural/src/choice-value.src.js';
function fixture() {
  const request={apiVersion:2,revision:1,ruleset:'gi',objective:'max-win/min-loss/min-nontermination',futureStudyPolicy:'no-additional-study-events',state:{id:'s'},horizon:{kind:'actual-roll',episodeCap:9,moveCount:8},requestedActionIds:['b','a']};
  for(const k of ['requestId','contractHash','modelHash','mechanicsHash','graphHash','profileHash','opponentPolicyHash']) request[k]=k;
  const row=actionId=>({stateId:'s',actionId,status:'bounded',policyId:'p',outcomes:{win:.5,loss:.5,explicitNoResult:0,nontermination:0},outcomeBounds:{win:[.49999,.50001],loss:[.49999,.50001],explicitNoResult:[0,0],nontermination:[0,0]},winBounds:[.49999,.500005],secondaryStatus:'unresolved-primary-ties'});
  const response={...request,root:{...row(undefined),selectedActionId:'a'},actions:[row('a'),row('b')],quality:{numericalStatus:'certified',maxWinError:1e-5,coordinateErrorBound:1e-5,policyRegretBound:1e-5,secondaryStatus:'unresolved-primary-ties',tertiaryStatus:'unresolved-primary-loss-ties'},diagnostics:{certificate:'exact-rational-all-action-drift+common-policy-residual+Bellman-supersolution'}};
  const c=ngChoiceValueController(),token=c.begin(request,{handId:'h'});
  return {request,response,c,token};
}
test('bounded primary suggestion does not claim verified secondary optimum or reorder overlapping cards',()=>{
  const {response,c,token}=fixture(); assert.equal(c.accept(token,response),true);
  const s=c.snapshot(),r=s.actions.find(r=>r.actionId==='a'),v=ngChoiceValueView(r,s);
  assert.equal(v.recommended,true);assert.equal(v.recommendationLabel,'Suggested');
  assert.ok(!v.detail.includes('best legal'));assert.ok(!v.notes.some(x=>x.includes('favoring wins, then')));
  assert.deepEqual(ngChoiceValueOrder(['b','a'],s),['b','a']);
});
test('missing, NaN, excess regret or wrong certificate cannot produce a suggested card',()=>{
  for(const mutate of [r=>delete r.quality.policyRegretBound,r=>r.quality.policyRegretBound=NaN,r=>r.quality.policyRegretBound=.01,r=>r.diagnostics.certificate='other']) {
    const {response,c,token}=fixture();mutate(response);c.accept(token,response);
    assert.ok(c.snapshot().actions.every(r=>!ngChoiceValueView(r,c.snapshot()).recommended));
  }
});
test('valid bounded root/action residual accepted, disjoint same-policy intervals rejected',()=>{
  const {response,c,token}=fixture(),a=response.actions[0];
  a.outcomes.win+=5e-6;a.outcomes.loss-=5e-6;
  c.accept(token,response);assert.equal(c.snapshot().actions.find(r=>r.actionId==='a').status,'bounded');
  const f=fixture(),b=f.response.actions[0];b.outcomes.win=.50004;b.outcomes.loss=.49996;
  b.outcomeBounds.win=[.50003,.50005];b.outcomeBounds.loss=[.49995,.49997];b.winBounds=[.50003,.50005];
  f.c.accept(f.token,f.response);assert.equal(f.c.snapshot().actions.find(r=>r.actionId==='a').status,'unavailable');
});
test('bounded common-policy display uses outcome bounds rather than optimal-continuation upper',()=>{
  const {response,c,token}=fixture();response.actions[0].winBounds=[.49999,.51];
  c.accept(token,response);const s=c.snapshot();assert.equal(ngChoiceValueView(s.actions.find(r=>r.actionId==='a'),s).value,'50%');
});
test('exact reference continues to use verified lexicographic recommendation',()=>{
  const {response,c,token}=fixture();response.quality={numericalStatus:'exact-rational',maxWinError:0};
  for(const r of [response.root,...response.actions]) {r.status='ready';delete r.winBounds;delete r.outcomeBounds;}
  c.accept(token,response);const s=c.snapshot(),v=ngChoiceValueView(s.actions.find(r=>r.actionId==='a'),s);
  assert.equal(v.recommended,true);assert.ok(v.notes.some(x=>x.includes('favoring wins, then')));
});

test('checked float is explicitly unavailable, and incomplete rows are not recommendations',()=>{
  for (const status of ['checked-float','incomplete']) {
    const {response,c,token}=fixture();response.quality.numericalStatus=status;c.accept(token,response);
    const s=c.snapshot();assert.ok(s.actions.every(r=>!ngChoiceValueView(r,s).recommended));
    if(status==='checked-float') assert.ok(s.actions.every(r=>r.status==='error'));
  }
});
test('dedicated coordinate budget is enforced independently of regret',()=>{
  const {response,c,token}=fixture();response.quality.coordinateErrorBound=.01;c.accept(token,response);
  assert.equal(c.snapshot().status,'error');
});
test('real app paint method uses Suggested in badge and accessible label through actual runtime signatures',async()=>{
  const {readFileSync}=await import('node:fs');
  const source=readFileSync(new URL('../neural/src/app.src.jsx',import.meta.url),'utf8');
  const Component=new Function('DCLogic','React',source+'\nreturn Component;')(class {},{createRef:()=>({current:null})});
  const a=new Component({}),f=fixture();f.c.accept(f.token,f.response);
  const opt={node:{ty:'transitions'}},badge={textContent:''},execute={setAttribute:(k,v)=>execute[k]=v};
  a._choiceValues=f.c;a._choiceHandId='h';a._choiceValueBindings=[{opt,actionId:'a'}];
  a._choiceValueRuntime={ngChoiceValueView};a.choiceLabel=()=> 'Move';
  a._optionCards=[{opt,card:{querySelector:s=>s==='[data-choice-recommended]'?badge:s==='[data-choice-execute]'?execute:null}}];
  a.paintChoiceValues();assert.equal(badge.textContent,'Suggested');assert.match(execute['aria-label'],/Suggested/);assert.doesNotMatch(execute['aria-label'],/Best/);
});
test('endpoint radius must satisfy its own tighter absolute tolerance',()=>{
  const f=fixture();f.request.precision={absoluteProbabilityError:1e-4,policyRegret:1e-3};
  // Begin again: request stamp must include the precision contract being validated.
  f.token=f.c.begin(f.request,{handId:'h'});f.response.precision=f.request.precision;
  f.response.actions[1].outcomeBounds.nontermination=[0,.00015];
  f.c.accept(f.token,f.response);assert.equal(f.c.snapshot().actions.find(r=>r.actionId==='b').status,'unavailable');
});
test('no-result decomposition respects nonzero upper bounds and root recommendation excludes bad first moves',()=>{
  const f=fixture(),b=f.response.actions[1];b.outcomes={win:.1,loss:.9,explicitNoResult:0,nontermination:0};
  b.outcomeBounds={win:[.09999,.10001],loss:[.89999,.90001],explicitNoResult:[0,0],nontermination:[0,.00001]};b.winBounds=[.09999,.10001];
  f.c.accept(f.token,f.response);const s=f.c.snapshot(),v=ngChoiceValueView(s.actions.find(r=>r.actionId==='b'),s);
  assert.equal(v.recommended,false);assert.ok(!v.notes.some(n=>n.includes('highest win chance')));
  assert.ok(v.notes.some(n=>n.includes('0–1% play that never ends')));
});
test('certified independently tighter optimal upper need only intersect the outcome enclosure',()=>{
  const f=fixture();f.response.actions[1].winBounds=[.49999,.499999];f.c.accept(f.token,f.response);
  assert.equal(f.c.snapshot().actions.find(r=>r.actionId==='b').status,'bounded');
});

test('both audited certificate arithmetic routes use the same bounded schema; unknown routes fail closed',()=>{
  for (const arithmetic of ['exact-rational','outward-interval']) {
    const f=fixture();
    f.response.diagnostics.certificate=arithmetic+'-all-action-drift+common-policy-residual+Bellman-supersolution';
    f.c.accept(f.token,f.response);const s=f.c.snapshot();
    assert.equal(s.status,'bounded');assert.equal(ngChoiceValueView(s.actions.find(r=>r.actionId==='a'),s).recommendationLabel,'Suggested');
  }
  for(const certificate of ['outward-interval','float-all-action-drift+common-policy-residual+Bellman-supersolution',null]) {
    const f=fixture();f.response.diagnostics.certificate=certificate;f.c.accept(f.token,f.response);
    assert.equal(f.c.snapshot().status,'error');
  }
  const f=fixture();f.response.diagnostics.certificate='outward-interval-all-action-drift+common-policy-residual+Bellman-supersolution';
  delete f.response.quality.coordinateErrorBound;f.c.accept(f.token,f.response);assert.equal(f.c.snapshot().status,'error');
});
