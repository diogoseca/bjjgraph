// Actual app methods and actual installer, with a small parse5-backed DOM adapter.
// This proves controls/lifecycle, not browser layout, hit-testing or network caching.
// Integration collection: root package.json test:units includes tests/*.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const appPath = process.env.BJJ_SETTINGS_APP_SOURCE || new URL("../neural/src/app.src.jsx", import.meta.url);
const modulePath = process.env.BJJ_SETTINGS_UI_SOURCE || new URL("../neural/src/settings-ui.src.js", import.meta.url);
const dependencyRoot = process.env.BJJ_SETTINGS_DEPENDENCY_ROOT;
const parseURL = dependencyRoot ? pathToFileURL(dependencyRoot + "/source/node_modules/parse5/dist/index.js")
  : new URL("../source/node_modules/parse5/dist/index.js", import.meta.url);
const { parseFragment } = await import(parseURL.href);
const source = readFileSync(appPath, "utf8"), moduleSource = readFileSync(modulePath, "utf8"), build = "test-settings-build";
const runtime = await import("data:text/javascript;base64," + Buffer.from(`const NG_SETTINGS_UI_BUILD = ${JSON.stringify(build)};\n` + moduleSource).toString("base64"));
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

class Element {
  constructor(tag = "div") { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.style = {}; this.listeners = {}; this.scrollLeft = 0; this.scrollWidth = 420; this.clientWidth = 420; this.offsetLeft = 0; this.offsetWidth = 84; this._text = ""; }
  setAttribute(k,v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  removeAttribute(k) { delete this.attrs[k]; }
  set id(v) { this.setAttribute("id",v); }
  get id() { return this.getAttribute("id"); }
  set innerHTML(html) { for (const c of this.children) c.parentElement = null; this.children = []; this._text = ""; for (const n of parseFragment(html).childNodes) this.appendChild(fromParsed(n)); }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(""); }
  set textContent(v) { this.children = []; this._text = String(v); }
  appendChild(c) { c.parentElement = this; this.children.push(c); return c; }
  append(...children) { children.forEach(c => this.appendChild(c)); }
  contains(c) { return c === this || this.children.some(x => x.contains(c)); }
  matches(s) {
    const tag = s.match(/^[a-z]+/i)?.[0]; if (tag && this.tagName !== tag.toUpperCase()) return false;
    const cls = s.match(/\.([\w-]+)/)?.[1]; if (cls && !(this.attrs.class || "").split(/\s+/).includes(cls)) return false;
    for (const [,k,v] of s.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)) if (!(k in this.attrs) || (v !== undefined && this.attrs[k] !== v)) return false;
    return true;
  }
  querySelectorAll(s) { const all = []; for (const c of this.children) { if (c.matches(s)) all.push(c); all.push(...c.querySelectorAll(s)); } return all; }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
  closest(s) { return this.matches(s) ? this : this.parentElement?.closest(s); }
  addEventListener(name,fn) { (this.listeners[name] ||= []).push(fn); }
  fire(name,init={}) { const event = { target:this, preventDefault(){this.defaultPrevented=true;}, stopPropagation(){this.stopped=true;}, ...init }; for (const fn of this.listeners[name] || []) fn(event); return event; }
  click() { this.fire("click"); }
  focus() { document.activeElement = this; }
  scrollTo({left}) { this.scrollLeft = left; }
}
function fromParsed(n) { const e = new Element(n.tagName || "#text"); if (n.nodeName === "#text") e._text = n.value; for (const a of n.attrs || []) e.setAttribute(a.name,a.value); for (const c of n.childNodes || []) e.appendChild(fromParsed(c)); return e; }
const document = { activeElement: null, createElement: tag => new Element(tag), removeEventListener(){} };
const window = { removeEventListener(){} };
globalThis.document = document; globalThis.window = window;
const Component = new Function("DCLogic","React","NG_SETTINGS_UI_BUILD", source + "\nreturn Component;")(class {}, {createRef:()=>({current:null})}, build);

function fixture() {
  const app = Object.create(Component.prototype), calls = {loads:[], saved:0, changed:[], events:[], layers:0};
  const card = new Element(), modal = new Element(); modal.style.display = "none";
  Object.assign(app, { modalCardRef:{current:card}, modalRef:{current:modal}, explorerListRef:{current:null},
    _progressOwnerStamp:{}, _progressCurrent:()=>true, settings:{}, _settingsAt:{}, now:123,
    _session:{keys:["due-a","due-b"],idx:1}, _landQ:{key:"frozen-question",answered:false},
    currentPos:7, currentRole:"bottom", deck:{key:"active-deck"}, _evLam:[1,2,4],
    gameScore:()=>({belt:"white"}), wornBelt:()=>({id:"white",rank:0,done:0,total:6,stripes:0}), _reducedMotion:()=>true, _weakStates:()=>[],
    _saveProgress:()=>calls.saved++, _gameValueChanged:r=>calls.changed.push(r), _rebuildRulesetMask:()=>{},
    _applyLayers:()=>calls.layers++, fx:()=>{}, track:(event,p)=>calls.events.push({event,p}),
    _fetchSettingsPresentation:attempt=>{calls.loads.push(attempt);return Promise.resolve(runtime);},
  });
  return {app,card,modal,calls};
}
const clickText = (card,text) => { const button = card.querySelectorAll("button").find(b=>b.textContent===text); assert.ok(button, `rendered button ${text}`); button.click(); };

test("no Settings import before intent; delay shows loading and preserves live exercise/session", async () => {
  const {app,card,modal,calls} = fixture(), gate = deferred();
  const session = app._session, question = app._landQ, deck = app.deck, before = JSON.stringify([session,question,deck,app.currentPos,app.currentRole]);
  app.get("sound","on"); app.openModal(); app.closeModal(); await flush(); assert.deepEqual(calls.loads,[]);
  app._fetchSettingsPresentation = attempt => {calls.loads.push(attempt);return gate.promise;};
  const pending = app.openSettings("shortcuts"); await flush();
  assert.ok(pending instanceof Promise); assert.equal(modal.style.display,"flex");
  assert.equal(card.querySelector("[data-settings-load]").getAttribute("data-settings-load"),"loading");
  assert.match(card.textContent,/Loading settings/); assert.equal(card.querySelector('[role="tab"]'),null);
  assert.equal(app.renderSettings(),pending); assert.deepEqual(calls.loads,[1]);
  gate.resolve(runtime); assert.equal(await pending,true);
  assert.match(card.textContent,/Pan the graph/); assert.equal(document.activeElement.getAttribute("data-settings-tab"),"shortcuts");
  assert.equal(app._session,session); assert.equal(app._landQ,question); assert.equal(app.deck,deck);
  assert.equal(JSON.stringify([session,question,deck,app.currentPos,app.currentRole]),before); assert.equal(calls.saved,0);
});

test("load failure has real Retry; explicit retry uses fresh attempt and real controls", async () => {
  const {app,card,calls} = fixture();
  app._fetchSettingsPresentation = attempt=>{calls.loads.push(attempt);return attempt===1?Promise.reject(Error("offline")):Promise.resolve(runtime);};
  assert.equal(await app.openSettings("flashcards"),false);
  assert.equal(card.querySelector("[data-settings-load]").getAttribute("data-settings-load"),"error");
  assert.match(card.textContent,/could not load/); assert.equal(card.querySelector('[role="tabpanel"]'),null);
  card.querySelector("[data-settings-retry]").click(); await flush();
  assert.deepEqual(calls.loads,[1,2]); assert.ok(card.querySelector('[role="tabpanel"]'));
  const goal = card.querySelectorAll("input").find(e=>e.type === "number"); goal.value="999"; goal.fire("change");
  assert.equal(app.get("dailyGoal",30),200); assert.equal(goal.value,200); assert.equal(calls.saved,1);
  clickText(card,"Multiple choice"); assert.equal(app.get("mcMode"),"mc"); assert.equal(calls.saved,2);
  assert.equal(app.renderSettings(),true,"installed callbacks stay synchronous");
});

test("close, competing modal, owner change, replaced card and unmount reject late rendering", async () => {
  for (const kind of ["close","legal","owner","not-current","card","unmount"]) {
    const {app,card,modal} = fixture(), gate = deferred(); app._fetchSettingsPresentation=()=>gate.promise;
    const pending=app.openSettings("rolling"); await flush();
    if(kind==="close") app.closeModal();
    if(kind==="legal") app.openLegal("privacy");
    if(kind==="owner") app._progressOwnerStamp={};
    if(kind==="not-current") app._progressCurrent=()=>false;
    if(kind==="card") app.modalCardRef.current=new Element();
    if(kind==="unmount") {
      for(const n of ["_destroyGameplanStudy","_invalidateCloudSync","_stopGameValueActivation","cancelChoiceValues","clearExecution","_stopSystemPreview","clearTimers"]) app[n]=()=>{};
      app.componentWillUnmount(); assert.equal(app.__ngDestroyed,true);
    }
    const before=card.textContent; gate.resolve(runtime); assert.equal(await pending,false,kind);
    assert.equal(card.textContent,before,kind); assert.equal(card.querySelector('[role="tab"]'),null,kind);
    if(kind==="close") assert.equal(modal.style.display,"none");
    if(kind==="legal") assert.match(card.textContent,/Privacy Policy/);
  }
});

test("latest Settings tab intent wins shared import; dismissed error Retry is inert", async () => {
  const {app,card,calls} = fixture(), gate=deferred(); app._fetchSettingsPresentation=attempt=>{calls.loads.push(attempt);return gate.promise;};
  const first=app.openSettings("flashcards"); await flush(); const second=app.openSettings("notifications");
  gate.resolve(runtime); assert.equal(await first,false); assert.equal(await second,true); assert.deepEqual(calls.loads,[1]);
  assert.equal(card.querySelector('[role="tabpanel"]').getAttribute("aria-labelledby"),"ng-stab-notifications");
  assert.match(card.textContent,/signed-in account/);
  const failed=fixture(); failed.app._fetchSettingsPresentation=()=>Promise.reject(Error("offline")); await failed.app.openSettings();
  const retry=failed.card.querySelector("[data-settings-retry]"); failed.app.openLegal("terms"); const before=failed.card.textContent;
  retry.click(); await flush(); assert.equal(failed.card.textContent,before); assert.match(before,/Terms of Use/);
});

test("installer rejects wrong build without changing target; app offers retry", async () => {
  const target={}; assert.throws(()=>runtime.ngInstallSettingsPresentation(target,{expectedBuild:"other"}),/version mismatch/); assert.deepEqual(target,{});
  const {app,card}=fixture(); const wrong=await import("data:text/javascript;base64,"+Buffer.from('const NG_SETTINGS_UI_BUILD="old-build";\n'+moduleSource).toString("base64"));
  app._fetchSettingsPresentation=()=>Promise.resolve(wrong); assert.equal(await app.openSettings(),false);
  assert.equal(app._renderSettingsPresentation,undefined); assert.ok(card.querySelector("[data-settings-retry]"));
  app._fetchSettingsPresentation=()=>Promise.resolve(runtime); card.querySelector("[data-settings-retry]").click(); await flush(); assert.ok(card.querySelector('[role="tabpanel"]'));
});

test("unchanged real controls retain settings keys, effects, direct tabs and keyboard focus; the loss-aversion row is retired", async () => {
  const {app,card,calls}=fixture(); const session=app._session, question=app._landQ;
  await app.openSettings("rolling");
  card.querySelector('[data-start-pick="weak"]').click(); assert.equal(app.get("startFrom"),"weak"); assert.equal(app.startFrom(),"weak");
  // "Winning vs not losing" is RETIRED (v1.207.0, owner 2026-09-29): no row even though this fixture's wire
  // still carries three presets, and a stored choice changes nothing the game or the model reads.
  assert.ok(!card.querySelector("[data-settings-loss]") && !card.querySelector("[data-loss-pick]"), "retired row absent");
  app.set("lossAversion",4); assert.equal(app._evLamIdx(), 1, "EDGE reads the default block, never the stored key"); assert.ok(!calls.changed.includes("loss-aversion"));
  clickText(card,"No-gi"); assert.equal(app._giMode,"nogi"); assert.ok(calls.changed.includes("ruleset"));
  card.querySelector('[data-layer-toggle="card"]').click(); assert.equal(app.get("landCard"),false); assert.equal(calls.layers,1);
  const slider=card.querySelectorAll("input").find(e=>e.type === "range"); slider.value="12"; slider.fire("input"); assert.equal(app.get("decisionSec"),12); assert.equal(card.querySelector(".paceVal").textContent,"12");
  const row=card.querySelector('[role="tablist"]'), event=row.fire("keydown",{key:"End"});
  assert.equal(event.stopped,true); assert.equal(event.defaultPrevented,true); assert.equal(app._settingsTab,"shortcuts"); assert.equal(document.activeElement.getAttribute("data-settings-tab"),"shortcuts");
  const current=card.querySelector('[role="tablist"]'); current.fire("keydown",{key:"ArrowRight"}); assert.equal(app._settingsTab,"flashcards");
  app.user={email:"test@example.invalid"}; assert.equal(app.openSettings("notifications"),true); clickText(card,"On"); assert.equal(app.get("emailDigest"),true);
  assert.equal(app.openSettings("modifiers"),true); assert.match(card.textContent,/No modifiers yet/);
  assert.equal(app._session,session); assert.equal(app._landQ,question);
});

test("close path disconnects Settings row observer and prevents late failure repaint", async()=>{
  const {app,card}=fixture(), gate=deferred(); let disconnected=0; app._settingsRowRO={disconnect(){disconnected++;}};
  app._fetchSettingsPresentation=()=>gate.promise; const pending=app.openSettings(); const oldClose=card.querySelector("[data-settings-load-close]");
  oldClose.click(); const before=card.textContent; gate.reject(Error("network")); assert.equal(await pending,false);
  assert.equal(card.textContent,before); assert.equal(disconnected,2); assert.equal(app.renderSettings(),false);
});

test("actual build loader pins URL identity and retry, and rejects cross-origin before import", async()=>{
  const buildSource=readFileSync(process.env.BJJ_SETTINGS_BUILD_SOURCE || new URL("../neural/build/build.mjs",import.meta.url),"utf8");
  const start=buildSource.indexOf("Component.prototype._fetchSettingsPresentation = function(attempt) {");
  assert.ok(start>0,"real emitted loader exists");
  const end=buildSource.indexOf("\n};",start)+3;
  const loaderSource=buildSource.slice(start,end); assert.match(loaderSource,/return import\(url.href\)/);
  const imported=[];
  // Inject only the module-import boundary; URL construction, origin check and pinning
  // execute directly from the build's actual loader source.
  const load=new Function("document","window","NG_SETTINGS_UI_BUILD","__import",
    "const Component={prototype:{}};\n"+loaderSource.replace("return import(url.href)","return __import(url.href)")+"\nreturn Component.prototype._fetchSettingsPresentation;")(
      {baseURI:"https://example.test/Positions/Mount"},{location:{origin:"https://example.test"}},build,url=>{imported.push(url);return Promise.resolve(runtime);});
  const app={_dataBase:()=>"/static/neural/"}; await load.call(app,1); await load.call(app,2);
  assert.equal(imported.length,2); const first=new URL(imported[0]),second=new URL(imported[1]);
  assert.equal(first.pathname,"/static/neural/app/settings-ui.js"); assert.equal(first.searchParams.get("v"),build);
  assert.equal(first.searchParams.get("attempt"),"1"); assert.equal(second.searchParams.get("attempt"),"2");
  await assert.rejects(load.call({_dataBase:()=>"https://other.test/"},3),/same-origin/); assert.equal(imported.length,2);
});
