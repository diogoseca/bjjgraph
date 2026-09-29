// Actual stats/repaint methods and eager debt module. Tiny DOM only; no browser,
// model values, build or timer handle. This catches the late planner-arrival seam.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ngGameplanDebt,ngGameplanReviewed} from '../neural/src/gameplan-debt.src.js';
const source=readFileSync(process.env.BJJ_STATS_APP_SOURCE||new URL('../neural/src/app.src.jsx',import.meta.url),'utf8');
class Element {
 attrs={};style={};children=[];listeners={};html='';
 setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}
 set innerHTML(value){this.html=value;this.children=[...value.matchAll(/<span class="ngStat"([^>]*)>/g)].map(match=>{const e=new Element();e.attrs.class='ngStat';for(const a of match[1].matchAll(/([\w:-]+)="([^"]*)"/g))e.attrs[a[1]]=a[2];return e;});}
 get innerHTML(){return this.html;}querySelectorAll(selector){return selector==='.ngStat'?this.children:[];}
 querySelector(){return null;}addEventListener(type,fn){this.listeners[type]=fn;}click(){this.listeners.click?.();}
 replaceChildren(...nodes){this.children=nodes;}
}
function fixture(){const tasks=[],document={createElement:()=>new Element()};
 const Component=Function('DCLogic','React','document','setTimeout','ngGameplanDebt','ngGameplanReviewed',source+'\nreturn Component;')(
  class {},{createRef:()=>({current:null})},document,fn=>{tasks.push(fn);return tasks.length;},ngGameplanDebt,ngGameplanReviewed);
 const app=Object.create(Component.prototype),stats=new Element(),session={keys:['Mount|Top'],idx:0,review:{count:1}},calls={panels:0,plans:[]};let plan=null;
 Object.assign(app,{masteredCount:()=>2,gameScore:()=>({score:.5}),_ensureGameplanClock(){},planSummary:()=>plan,
 _epochDay:()=>5,_gameplanDecks:()=>({'Mount|Top':{count:1,exact:true,questions:['q1'],allowed:true}}),srs:{'Mount|Top':{q1:[4,2,3]}},
 _gameplanLoadState:'pending',_gameStudyState:{phase:'pending'},_session:session,paneStatsRef:{current:stats},drillListRef:{current:new Element()},drillFootRef:{current:null},
 _sessionInline:()=>true,_gameplanProgress:()=>({dayChanged:false,dueCards:1,completed:0,total:1,newDebt:[],blocked:[],complete:false}),
 _paintGameStudyPanel(){calls.panels++;},setDrillHeader(){},openPlanSession(anchor){calls.plans.push(anchor);},openFlashBrowser(){}});
 stats.querySelector=selector=>selector==='[data-explore-stats]'?{}:null;
 return{app,stats,session,calls,tasks,plan(value){plan=value;app._gameplanRuntime={ngGameplanSummary:()=> 'real planner summary seam'};}};
}
const cell=(row,bucket)=>row.children.find(e=>e.getAttribute('data-b')===bucket);
test('absent planner keeps unknown suggestion count and actual due debt while retaining new/due intents',()=>{
 const f=fixture(),row=f.app._exploreStatsRow(),newCell=cell(row,'new');
 assert.equal(newCell.getAttribute('data-new'),null);assert.equal(newCell.getAttribute('data-weak'),null);
 assert.match(row.innerHTML,/Suggestions loading/);assert.doesNotMatch(row.innerHTML,/0 suggested/);
 assert.equal(cell(row,'due').getAttribute('data-due-decks'),'1');assert.match(cell(row,'due').getAttribute('title'),/^1 card due/);
 newCell.click();cell(row,'due').click();assert.deepEqual(f.calls.plans,['new','due']);assert.equal(f.tasks.length,0);
});
test('late loaded planner stats refresh reaches the existing review panel without replacing its queue',()=>{
 const f=fixture(),before=structuredClone(f.session),keys=f.session.keys;
 f.app._exploreStatsRow();f.plan({status:'ready',fresh:[{key:'Guard|Top'},{key:'Side Control|Bottom'}],reviewed:[],due:[{key:'Mount|Top'}],dueCards:1});
 f.app._gameStudyState={phase:'idle'};f.app._refreshGameplanUI();f.app._refreshGameplanUI();assert.equal(f.tasks.length,1);
 assert.doesNotThrow(()=>f.tasks.shift()());const row=f.stats.children[0];
 assert.equal(cell(row,'new').getAttribute('data-new'),'2');assert.equal(cell(row,'new').getAttribute('data-weak'),'2');assert.match(row.innerHTML,/>2<\/b> suggested/);
 assert.equal(f.calls.panels,1);assert.equal(f.app._gameplanRefresh,null);assert.equal(f.app._session,f.session);assert.equal(f.session.keys,keys);assert.deepEqual(f.session,before);
});
test('loaded empty plan retains loading text while pending and reports assessed zero only when ready',()=>{
 const f=fixture();f.plan({status:'exhausted',fresh:[],reviewed:[],due:[],dueCards:0});
 let row=f.app._exploreStatsRow();assert.match(row.innerHTML,/Suggestions loading/);assert.doesNotMatch(row.innerHTML,/0<\/b> suggested/);
 f.app._gameStudyState={phase:'ready'};row=f.app._exploreStatsRow();assert.equal(cell(row,'new').getAttribute('data-new'),'0');assert.match(row.innerHTML,/>0<\/b> suggested/);
});
