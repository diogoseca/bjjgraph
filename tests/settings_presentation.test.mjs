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
const document = { activeElement: null, createElement: tag => new Element(tag), createTextNode: text => Object.assign(new Element("#text"), { _text: text }), removeEventListener(){} };
const window = { removeEventListener(){} };
globalThis.document = document; globalThis.window = window;
const makeComponent = (text) => new Function("DCLogic","React","NG_SETTINGS_UI_BUILD", text + "\nreturn Component;")(class {}, {createRef:()=>({current:null})}, build);
const Component = makeComponent(source);
// THE SAME APP WITH THE TRAINING-DAY EMAIL LIVE (NG_DIGEST_LIVE flipped, its only edit). The swap must
// match exactly once, or the "flipped" tests would be testing the shipped constant and pass by absence.
const LIVE_OFF = "const NG_DIGEST_LIVE = false;", LIVE_ON = "const NG_DIGEST_LIVE = true;";
assert.equal(source.split(LIVE_OFF).length, 2, "the app declares NG_DIGEST_LIVE = false exactly once");
const LiveComponent = makeComponent(source.replace(LIVE_OFF, LIVE_ON));

function fixture(Comp = Component) {
  const app = Object.create(Comp.prototype), calls = {loads:[], saved:0, changed:[], events:[], layers:0};
  const card = new Element(), modal = new Element(); modal.style.display = "none";
  Object.assign(app, { modalCardRef:{current:card}, modalRef:{current:modal}, explorerListRef:{current:null},
    _progressOwnerStamp:{}, _progressCurrent:()=>true, settings:{}, _settingsAt:{}, now:123,
    _session:{keys:["due-a","due-b"],idx:1}, _landQ:{key:"frozen-question",answered:false},
    currentPos:7, currentRole:"bottom", deck:{key:"active-deck"}, _evLam:[1,2,4],
    gameScore:()=>({belt:"white"}), wornBelt:()=>({id:"white",rank:0,done:0,total:6,stripes:0}), _reducedMotion:()=>true, _weakStates:()=>[],
    _saveProgress:()=>calls.saved++, _gameValueChanged:r=>calls.changed.push(r), _rebuildRulesetMask:()=>{},
    _applyLayers:()=>calls.layers++, fx:()=>{}, track:(event,p)=>calls.events.push({event,p}),
    _fetchSettingsPresentation:attempt=>{calls.loads.push(attempt);return Promise.resolve(runtime);},
    // The real deferred registry import executes without constructing a reader.
    _appAsset:()=>new URL("../neural/src/reader.src.js?v=unit",import.meta.url).href,
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
  card.querySelector("[data-settings-retry]").click(); await app._settingsIntent.pending;
  assert.deepEqual(calls.loads,[1,2]); assert.ok(card.querySelector('[role="tabpanel"]'));
  const goal = card.querySelectorAll("input").find(e=>e.type === "number");
  // SIDE-R2 M3: the field's default IS the app's NG_PRACTICE_GOAL (one source), not a second literal
  assert.equal(goal.value, Number(source.match(/const NG_PRACTICE_GOAL = (\d+);/)[1])); assert.equal(goal.value, 20);
  goal.value="999"; goal.fire("change");
  assert.equal(app.get("dailyGoal",30),200); assert.equal(goal.value,200); assert.equal(calls.saved,1);
  clickText(card,"Multiple choice"); assert.equal(app.get("mcMode"),"mc"); assert.equal(calls.saved,2);
  assert.equal(app.renderSettings(),true,"installed callbacks stay synchronous");
});

test("close, competing modal, owner change, replaced card and unmount reject late rendering", async () => {
  // LEGAL3 (v1.264.0): "feedback" was "legal". The legal box now reads its page (a document or a fetch this fixture does not have);
  // the claim needs only a real competing modal, and the Feedback form is one.
  for (const kind of ["close","feedback","owner","not-current","card","unmount"]) {
    const {app,card,modal} = fixture(), gate = deferred(); app._fetchSettingsPresentation=()=>gate.promise;
    const pending=app.openSettings("rolling"); await flush();
    if(kind==="close") app.closeModal();
    if(kind==="feedback") app.openFeedback();
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
    if(kind==="feedback") assert.ok(card.querySelector("[data-feedback-title]"),"the Feedback modal stays");
  }
});

test("latest Settings tab intent wins shared import; dismissed error Retry is inert", async () => {
  const {app,card,calls} = fixture(), gate=deferred(); app._fetchSettingsPresentation=attempt=>{calls.loads.push(attempt);return gate.promise;};
  // v1.261.1 (U139 a, DIGEST2): a guest has no Notifications tab while the email is not live, so the second,
  // winning intent names Shortcuts; the claim is which intent wins, not which tab.
  const first=app.openSettings("flashcards"); await flush(); const second=app.openSettings("shortcuts");
  gate.resolve(runtime); assert.equal(await first,false); assert.equal(await second,true); assert.deepEqual(calls.loads,[1]);
  assert.equal(card.querySelector('[role="tabpanel"]').getAttribute("aria-labelledby"),"ng-stab-shortcuts");
  assert.match(card.textContent,/Pan the graph/);
  const failed=fixture(); failed.app._fetchSettingsPresentation=()=>Promise.reject(Error("offline")); await failed.app.openSettings();
  const retry=failed.card.querySelector("[data-settings-retry]"); failed.app.openFeedback(); const before=failed.card.textContent;
  retry.click(); await flush(); assert.equal(failed.card.textContent,before); assert.ok(failed.card.querySelector("[data-feedback-title]"));
});

test("installer rejects wrong build without changing target; app offers retry", async () => {
  const target={}; await assert.rejects(runtime.ngInstallSettingsPresentation(target,{expectedBuild:"other"}),/version mismatch/); assert.deepEqual(target,{});
  const {app,card}=fixture(); const wrong=await import("data:text/javascript;base64,"+Buffer.from('const NG_SETTINGS_UI_BUILD="old-build";\n'+moduleSource).toString("base64"));
  app._fetchSettingsPresentation=()=>Promise.resolve(wrong); assert.equal(await app.openSettings(),false);
  assert.equal(app._renderSettingsPresentation,undefined); assert.ok(card.querySelector("[data-settings-retry]"));
  app._fetchSettingsPresentation=()=>Promise.resolve(runtime); card.querySelector("[data-settings-retry]").click(); await app._settingsIntent.pending; assert.ok(card.querySelector('[role="tabpanel"]'));
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
  // U139 a (v1.261.1): a signed-in player reaches the email switch only while it is stored on, so this
  // presses Off; pressing On is the flipped tests' claim below (the email live, v1.259.1's Settings).
  app.user={email:"test@example.invalid"}; app.settings.emailDigest=true; assert.equal(app.openSettings("notifications"),true); clickText(card,"Off"); assert.equal(app.get("emailDigest"),false);
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

// ── THE TRAINING-DAY EMAIL WHILE IT IS NOT LIVE (owner U139 a, 12 Nov 2026: "Hide it while the digest is off").
// NG_DIGEST_LIVE (app.src.jsx) is false: `openSettings` drops Notifications for a signed-in player whose stored
// `emailDigest` is off, and for every guest (DIGEST2); an account with it on keeps the tab and the row (saying no
// email is sent yet) so it can turn it off, and the choice is made once per opening. The browser half, pressed
// by mouse and by a touch tap at 390, is e2e/journeys/notifications-tab.spec.ts.
const tabIds = (card) => card.querySelectorAll('[role="tab"]').map((t) => t.getAttribute("data-settings-tab"));
const selectedTab = (card) => card.querySelector('[role="tab"][aria-selected="true"]').getAttribute("data-settings-tab");
const panelOf = (card) => card.querySelector('[role="tabpanel"]').getAttribute("aria-labelledby");
const key = (card, k) => card.querySelector('[role="tablist"]').fire("keydown", { key: k });
const FIVE = ["flashcards", "rolling", "modifiers", "notifications", "shortcuts"];
const FOUR = ["flashcards", "rolling", "modifiers", "shortcuts"];
// v1.259.1's own words, copied from that version's settings-ui.src.js, so "to the letter" has a fixed oracle.
const V1259_ROW = "After a day you reviewed something: your techniques, your Game Knowledge, your streak — mailed to player@example.com.";
const V1259_GUEST = "The training-day email needs a signed-in account — that’s where it would be sent. Sign in from the badge at the foot of the sidebar to turn it on.";
const UNSENT = "No email is being sent yet.";
const rowSub = (card) => card.querySelector("[data-digest-setting]").children[0].children[1].textContent;

test("U139 a: signed in with the email off, Settings has no Notifications tab, a link to it opens the first tab, and nothing is written", async () => {
  const { app, card, calls } = fixture();
  app.user = { email: "player@example.com" };
  assert.equal(await app.openSettings(), true);
  assert.deepEqual(tabIds(card), FOUR, "four tabs: Notifications is not drawn");
  assert.equal(card.querySelector("[data-digest-setting]"), null);
  // a deep link (and any saved tab) naming the hidden tab opens the first one, with its own panel
  assert.equal(app.openSettings("notifications"), true);
  assert.equal(app._settingsTab, "flashcards"); assert.equal(selectedTab(card), "flashcards"); assert.equal(panelOf(card), "ng-stab-flashcards");
  assert.equal(card.querySelector("[data-digest-setting]"), null); assert.equal(card.querySelector("[data-notif-signedout]"), null);
  // the arrow keys walk the four drawn tabs and never land on the hidden one
  app.openSettings("modifiers"); key(card, "ArrowRight"); assert.equal(app._settingsTab, "shortcuts", "Modifiers → Shortcuts, skipping the hidden tab");
  key(card, "ArrowLeft"); assert.equal(app._settingsTab, "modifiers");
  key(card, "End"); assert.equal(app._settingsTab, "shortcuts"); key(card, "ArrowRight"); assert.equal(app._settingsTab, "flashcards", "and wraps over four");
  for (const t of FOUR) { app.openSettings(t); assert.equal(selectedTab(card), t); assert.equal(card.querySelector("[data-digest-setting]"), null, t); }
  // NOTHING STORED CHANGES: no key, no timestamp, no save, and the recorder still reads the stored setting
  assert.equal("emailDigest" in app.settings, false); assert.equal("emailDigest" in app._settingsAt, false); assert.equal(calls.saved, 0);
  assert.equal(app.get("emailDigest", false), false);
});

test("U139 a: an account with the email stored on keeps the tab and the row, is told no email is sent, and Off hides them from the next opening", async () => {
  const { app, card, calls } = fixture();
  app.user = { email: "player@example.com" }; app.settings.emailDigest = true;
  assert.equal(await app.openSettings(), true);
  assert.deepEqual(tabIds(card), FIVE, "five tabs while the stored setting is on");
  // the row delegates clicks (this DOM adapter does not bubble), so press the tab where the row hears it
  card.querySelector('[role="tablist"]').fire("click", { target: card.querySelector('[data-settings-tab="notifications"]') });
  assert.equal(selectedTab(card), "notifications"); assert.equal(panelOf(card), "ng-stab-notifications");
  assert.equal(rowSub(card), V1259_ROW + " " + UNSENT, "the row says, in plain words, that no email is sent yet");
  assert.equal(calls.saved, 0, "opening and choosing the tab write nothing"); assert.equal(app._settingsAt.emailDigest, undefined);
  clickText(card, "Off");
  assert.equal(app.get("emailDigest"), false); assert.equal(calls.saved, 1, "the player's own press is the only write");
  // this opening keeps the row, so the press visibly took; the tab is gone from the next opening on
  assert.deepEqual(tabIds(card), FIVE); assert.ok(card.querySelector("[data-digest-setting]"), "the row stays until Settings closes");
  app.closeModal(); assert.equal(await app.openSettings("notifications"), true);
  assert.deepEqual(tabIds(card), FOUR, "reopened: no Notifications tab"); assert.equal(selectedTab(card), "flashcards");
  assert.equal(card.querySelector("[data-digest-setting]"), null);
});

test("U139 a: a guest has no Notifications tab, whatever this device stored, and a link to it opens the first tab", async () => {
  // DIGEST2: the guest's line ("Sign in … to turn it on") would send them to sign in for a switch that is not
  // there, so while the email is not live the tab shows for ONE case only, an account with it stored on.
  for (const stored of [undefined, false, true]) {
    const { app, card, calls } = fixture();
    if (stored !== undefined) app.settings.emailDigest = stored;
    assert.equal(await app.openSettings(), true, String(stored));
    assert.deepEqual(tabIds(card), FOUR, "a guest sees four tabs, stored " + stored);
    assert.equal(app.openSettings("notifications"), true);
    assert.equal(selectedTab(card), "flashcards", "the link opens the first tab, stored " + stored); assert.equal(panelOf(card), "ng-stab-flashcards");
    assert.equal(card.querySelector("[data-notif-signedout]"), null, String(stored)); assert.equal(card.querySelector("[data-digest-setting]"), null, String(stored));
    app.openSettings("modifiers"); key(card, "ArrowRight"); assert.equal(app._settingsTab, "shortcuts", "the keys skip it, stored " + stored);
    assert.equal(app.settings.emailDigest, stored, "nothing stored changes"); assert.equal(calls.saved, 0);
  }
});

test("flipped: with NG_DIGEST_LIVE true, Settings are v1.259.1's to the letter", async () => {
  for (const stored of [undefined, false, true]) {
    const { app, card } = fixture(LiveComponent);
    app.user = { email: "player@example.com" };
    if (stored !== undefined) app.settings.emailDigest = stored;
    assert.equal(await app.openSettings(), true, String(stored));
    assert.deepEqual(tabIds(card), FIVE, "every signed-in player sees five tabs, stored " + stored);
    assert.equal(app.openSettings("notifications"), true); assert.equal(selectedTab(card), "notifications");
    assert.equal(rowSub(card), V1259_ROW, "the row's words, with no not-sent sentence, stored " + stored);
    assert.ok(!card.textContent.includes(UNSENT), "nowhere on the card");
    key(card, "ArrowLeft"); assert.equal(app._settingsTab, "modifiers"); key(card, "ArrowRight"); assert.equal(app._settingsTab, "notifications");
    key(card, "End"); key(card, "ArrowLeft"); assert.equal(app._settingsTab, "notifications", "Shortcuts → Notifications");
  }
  const { app, card } = fixture(LiveComponent);
  app.user = { email: "player@example.com" };
  await app.openSettings("notifications"); clickText(card, "On"); assert.equal(app.get("emailDigest"), true, "On stores the key the worker reads");
  app.closeModal(); assert.equal(app.openSettings("notifications"), true); clickText(card, "Off"); assert.equal(app.get("emailDigest"), false);
  assert.deepEqual(tabIds(card), FIVE, "Off hides nothing while the email is live");
  const guest = fixture(LiveComponent);
  assert.equal(await guest.app.openSettings("notifications"), true); assert.deepEqual(tabIds(guest.card), FIVE);
  assert.equal(guest.card.querySelector("[data-notif-signedout]").textContent, V1259_GUEST);
});
