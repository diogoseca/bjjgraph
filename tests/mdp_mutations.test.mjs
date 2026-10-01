// Mutation controls run isolated source copies in memory, never touching the
// implementation or original worktrees. Each control must fail the SAME numeric
// invariant that the unmodified source passes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const source=readFileSync(new URL('../neural/src/mdp-model.src.js',import.meta.url),'utf8');
const require=createRequire(new URL('../neural/src/mdp-model.src.js',import.meta.url));
const load=text=>new Function('module','require',text+'\nreturn module.exports;')({exports:{}},require);
function fixture(M,states){
  const request={apiVersion:2,requestId:'mutation',revision:1,modelHash:'m',mechanicsHash:'c',graphHash:'g',profileHash:'p',opponentPolicyHash:'o',ruleset:'gi',state:{id:states[0].id},horizon:{kind:'eventual'},objective:'max-win/min-loss/min-nontermination',futureStudyPolicy:'no-additional-study-events'};
  return [ {...request,states,contractHash:M.ngMdpContractHash(request)},request,{maxPolicyIterations:4} ];
}
const action=(id,...branches)=>({id,branches}),state=(id,...actions)=>({id,actions});
const to=(probability,id)=>({probability,to:id}),win=probability=>({probability,terminal:'win'}),loss=probability=>({probability,terminal:'loss'});
function mutate(from,to){assert.ok(source.includes(from),'mutation operator has a live target');return load(source.replace(from,to));}

test('strict-improvement mutation is killed by the proper tied-policy invariant',()=>{
  const states=[state('s',action('exit',win(1)),action('stay',to(1,'s')))];
  const check=M=>{const result=M.ngMdpSolve(...fixture(M,states));assert.equal(result.root.status,'ready');assert.equal(result.root.selectedActionId,'exit');};
  check(load(source));assert.throws(()=>check(mutate('ngMdpCmp(q, best) * direction > 0','ngMdpCmp(q, best) * direction >= 0')),assert.AssertionError);
});

test('closed-class mutation is killed by an analytic leaking SCC',()=>{
  const states=[state('s',action('leak',win('1/1000000000'),to('999999999/1000000000','s')))];
  const check=M=>{const result=M.ngMdpSolve(...fixture(M,states));assert.equal(result.root.status,'ready');assert.equal(result.root.outcomes.win,1);assert.equal(result.root.outcomes.nontermination,0);};
  check(load(source));assert.throws(()=>check(mutate('choices.get(id).branches.every(b => b.to && members.has(b.to))','choices.get(id).branches.some(b => b.to && members.has(b.to))')),assert.AssertionError);
});

test('secondary objective mutation is killed by a same-win loss comparison',()=>{
  const states=[state('s',action('danger',win('1/2'),loss('1/2')),action('reset',win('1/2'),{probability:'1/2',terminal:'explicitNoResult'}))];
  const check=M=>{const result=M.ngMdpSolve(...fixture(M,states));assert.equal(result.root.status,'ready');assert.equal(result.root.selectedActionId,'reset');assert.equal(result.root.outcomes.loss,0);};
  check(load(source));assert.throws(()=>check(mutate('[[0, 1], [1, -1], [3, -1]]) {\n    if (phase === 1)','[[0, 1], [1, 1], [3, -1]]) {\n    if (phase === 1)')),assert.AssertionError);
});
