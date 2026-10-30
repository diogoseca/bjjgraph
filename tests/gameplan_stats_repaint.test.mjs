// Actual Train/Practice-row and repaint methods and the eager debt module. Tiny DOM only; no browser,
// model values, build or timer handle. This catches the late planner-arrival seam.
// v1.242.0: the stat row became the drawer's Practice row (owner U56 e). Its due cell IS the row
// (`data-b="due"`), "N new" and the loading states live in its tooltip, and the FGD13 rule — repaint
// in place, never under a pointer — moved with it into `_paintTrain`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ngGameplanDebt,ngGameplanReviewed} from '../neural/src/gameplan-debt.src.js';
const source=readFileSync(process.env.BJJ_STATS_APP_SOURCE||new URL('../neural/src/app.src.jsx',import.meta.url),'utf8');
class Element {
 attrs={};style={};children=[];listeners={};html='';className='';title='';
 setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
 set innerHTML(value){this.html=value;}get innerHTML(){return this.html;}
 append(...nodes){this.children.push(...nodes);}appendChild(node){this.children.push(node);return node;}
 addEventListener(type,fn){this.listeners[type]=fn;}click(){this.listeners.click?.();}
 querySelector(selector){
  if(selector==='.ng-dr-tail')return this.tail||(this.tail=new Element());
  const m=/\[([\w-]+)(?:="([^"]*)")?\]/.exec(selector);if(!m)return null;
  const walk=(e)=>{for(const c of e.children){if(m[2]==null?c.getAttribute(m[1])!=null:c.getAttribute(m[1])===m[2])return c;const r=walk(c);if(r)return r;}return null;};
  return walk(this);
 }
}
function fixture(){const tasks=[],document={createElement:()=>new Element()};
 const Component=Function('DCLogic','React','document','setTimeout','ngGameplanDebt','ngGameplanReviewed',source+'\nreturn Component;')(
  class {},{createRef:()=>({current:null})},document,fn=>{tasks.push(fn);return tasks.length;},ngGameplanDebt,ngGameplanReviewed);
 const app=Object.create(Component.prototype),drawer=new Element(),session={keys:['Mount|Top'],idx:0,review:{count:1}},calls={panels:0,plans:[]};let plan=null;
 Object.assign(app,{masteredCount:()=>2,gameScore:()=>({score:.5}),_ensureGameplanClock(){},planSummary:()=>plan,
 _epochDay:()=>5,_gameplanDecks:()=>({'Mount|Top':{count:1,exact:true,questions:['q1'],allowed:true}}),srs:{'Mount|Top':{q1:[4,2,3]}},
 _gameplanLoadState:'pending',_gameStudyState:{phase:'pending'},_session:session,drillRef:{current:drawer},drillListRef:{current:new Element()},drillFootRef:{current:null},
 _sessionInline:()=>true,_gameplanProgress:()=>({dayChanged:false,dueCards:1,completed:0,total:1,newDebt:[],blocked:[],complete:false}),
 _paintGameStudyPanel(){calls.panels++;},setDrillHeader(){},openPlanSession(anchor){calls.plans.push(anchor);},openFlashBrowser(){},renderTabSubtitles(){}});
 const mount=()=>{drawer.children=[];app._renderTrain(drawer);const box=drawer.children[0];return{box,row:box.querySelector('[data-b="due"]')};};
 return{app,drawer,session,calls,tasks,mount,plan(value){plan=value;app._gameplanRuntime={ngGameplanSummary:()=> 'real planner summary seam'};}};
}
test('absent planner: the Practice row keeps the owed reviews and the loading state, and opens Practice',()=>{
 const f=fixture(),{box,row}=f.mount();
 assert.equal(box.getAttribute('data-explore-stats'),'1');assert.equal(box.getAttribute('data-gameplan-status'),'pending');
 assert.equal(row.getAttribute('data-new'),null);assert.equal(row.getAttribute('data-due-decks'),'1');
 assert.match(row.title,/^1 card due · 1 technique · 0 answered today · Suggestions loading/);assert.doesNotMatch(row.title,/0 new/);
 assert.match(row.tail.html,/>1 due</);assert.match(row.tail.html,/0\/20$/);
 row.click();assert.deepEqual(f.calls.plans,['due']);assert.equal(f.tasks.length,0);
});
test('late loaded planner stats refresh reaches the existing review panel without replacing its queue',()=>{
 const f=fixture(),before=structuredClone(f.session),keys=f.session.keys,{row}=f.mount();
 f.plan({status:'ready',fresh:[{key:'Guard|Top'},{key:'Side Control|Bottom'}],reviewed:[],due:[{key:'Mount|Top'}],dueCards:1});
 f.app._gameStudyState={phase:'idle'};f.app._refreshGameplanUI();f.app._refreshGameplanUI();assert.equal(f.tasks.length,1);
 assert.doesNotThrow(()=>f.tasks.shift()());
 assert.equal(row.getAttribute('data-new'),'2');assert.match(row.title,/· 2 new$/);
 assert.equal(f.calls.panels,1);assert.equal(f.app._gameplanRefresh,null);assert.equal(f.app._session,f.session);assert.equal(f.session.keys,keys);assert.deepEqual(f.session,before);
});
test('loaded empty plan retains loading text while pending and reports assessed zero only when ready',()=>{
 const f=fixture();f.plan({status:'exhausted',fresh:[],reviewed:[],due:[],dueCards:0});
 let {row}=f.mount();assert.match(row.title,/Suggestions loading/);assert.doesNotMatch(row.title,/0 new/);
 f.app._gameStudyState={phase:'ready'};({row}=f.mount());assert.equal(row.getAttribute('data-new'),'0');assert.match(row.title,/· 0 new$/);
});

// FGD13: the row is repainted IN PLACE, so a late refresh never detaches the row under a pointer (or a
// spec's resolved locator). Mutant (tests/artifacts/sidebar_mutants.md): a refresh that re-renders the
// drawer list instead of `_paintTrain` turns this red at "the same row object".
test('a late refresh repaints the mounted Practice row in place and keeps its listener',()=>{
 const f=fixture(),{box,row}=f.mount();let clicks=0;row.addEventListener('click',()=>clicks++);
 f.plan({status:'ready',fresh:[{key:'Guard|Top'}],reviewed:[],due:[{key:'Mount|Top'}],dueCards:3});f.app._gameStudyState={phase:'ready'};
 f.app._refreshGameplanUI();f.tasks.shift()();
 assert.equal(f.drawer.children[0],box,'the same block');assert.equal(box.querySelector('[data-b="due"]'),row,'the same row object');
 assert.match(row.tail.html,/>3 due</);assert.equal(box.getAttribute('data-gameplan-status'),'ready');
 row.click();assert.equal(clicks,1,'its listener survived the repaint');
});

// v1.242.0: the Train block lives in the drawer's list, which payload arrivals rebuild. The block is ONE
// element re-appended on every rebuild, so a press or a resolved locator never loses the Practice row.
// Mutant (tests/artifacts/sidebar_mutants.md): building a fresh block per render turns this red.
test('a list rebuild re-appends the same Practice row, listener and all',()=>{
 const f=fixture(),first=f.mount();let clicks=0;first.row.addEventListener('click',()=>clicks++);
 const second=f.mount();
 assert.equal(second.box,first.box,'the same block');assert.equal(second.row,first.row,'the same row object');
 second.row.click();assert.equal(clicks,1,'its listener survived the rebuild');
});
