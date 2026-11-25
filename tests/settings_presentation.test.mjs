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
// progress-owner.src.js rides along (v1.301.0, MODS1): the modifiers' panel reads and writes its rows through the shared
// helpers there (`ngModsRead`, NG_MOD_PREFIX), as the bundle concatenates it above the class
const ownerSource = readFileSync(new URL("../neural/src/progress-owner.src.js", import.meta.url), "utf8").replace(/^export (function|const|let|var|class) /gm, "$1 ");
const makeComponent = (text) => new Function("DCLogic","React","NG_SETTINGS_UI_BUILD", ownerSource + "\n" + text + "\nreturn Component;")(class {}, {createRef:()=>({current:null})}, build);
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
  card.querySelector('[data-mode-pick="mc"]').click(); assert.equal(app.get("mcMode"),"mc"); assert.equal(calls.saved,2);
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
  card.querySelector('[data-shows-pick="none"]').click(); assert.equal(app.get("landCard"),false); assert.equal(calls.layers,1);
  const slider=card.querySelectorAll("input").find(e=>e.type === "range"); slider.value="12"; slider.fire("input"); assert.equal(app.get("decisionSec"),12); assert.equal(card.querySelector(".paceVal").textContent,"12");
  const row=card.querySelector('[role="tablist"]'), event=row.fire("keydown",{key:"End"});
  assert.equal(event.stopped,true); assert.equal(event.defaultPrevented,true); assert.equal(app._settingsTab,"shortcuts"); assert.equal(document.activeElement.getAttribute("data-settings-tab"),"shortcuts");
  const current=card.querySelector('[role="tablist"]'); current.fire("keydown",{key:"ArrowRight"}); assert.equal(app._settingsTab,"app");
  // U139 a (v1.261.1): a signed-in player reaches the email switch only while it is stored on, so this
  // presses Off; pressing On is the flipped tests' claim below (the email live, v1.259.1's Settings).
  // SET1: every group is on the one page, so "Off" is pressed in the email's own row (the opponent's comes first).
  app.user={email:"test@example.invalid"}; app.settings.emailDigest=true; assert.equal(app.openSettings("notifications"),true); clickText(card.querySelector("[data-digest-setting]"),"Off"); assert.equal(app.get("emailDigest"),false);
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
// SET1 (v1.295.3): seven groups of one page, the five old ids kept and `reading` and `app` added (NG_SETTINGS_TABS).
// SETH2 A (v1.298.2, the owner): General (`app`) first; the others keep their order, and Settings opens on the first.
const FIVE = ["app", "flashcards", "rolling", "reading", "modifiers", "notifications", "shortcuts"];
const FOUR = ["app", "flashcards", "rolling", "reading", "modifiers", "shortcuts"];
const digest = (card) => card.querySelector("[data-digest-setting]");
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
  assert.equal(app._settingsTab, "app"); assert.equal(selectedTab(card), "app"); assert.equal(panelOf(card), "ng-stab-app");
  assert.equal(card.querySelector("[data-digest-setting]"), null); assert.equal(card.querySelector("[data-notif-signedout]"), null);
  // the arrow keys walk the four drawn tabs and never land on the hidden one
  app.openSettings("modifiers"); key(card, "ArrowRight"); assert.equal(app._settingsTab, "shortcuts", "Modifiers → Shortcuts, skipping the hidden tab");
  key(card, "ArrowLeft"); assert.equal(app._settingsTab, "modifiers");
  key(card, "End"); assert.equal(app._settingsTab, "shortcuts"); key(card, "ArrowRight"); assert.equal(app._settingsTab, "app", "and wraps over four");
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
  clickText(digest(card), "Off");
  assert.equal(app.get("emailDigest"), false); assert.equal(calls.saved, 1, "the player's own press is the only write");
  // this opening keeps the row, so the press visibly took; the tab is gone from the next opening on
  assert.deepEqual(tabIds(card), FIVE); assert.ok(card.querySelector("[data-digest-setting]"), "the row stays until Settings closes");
  app.closeModal(); assert.equal(await app.openSettings("notifications"), true);
  assert.deepEqual(tabIds(card), FOUR, "reopened: no Notifications tab"); assert.equal(selectedTab(card), "app");
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
    assert.equal(selectedTab(card), "app", "the link opens the first tab, stored " + stored); assert.equal(panelOf(card), "ng-stab-app");
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
  await app.openSettings("notifications"); clickText(digest(card), "On"); assert.equal(app.get("emailDigest"), true, "On stores the key the worker reads");
  app.closeModal(); assert.equal(app.openSettings("notifications"), true); clickText(digest(card), "Off"); assert.equal(app.get("emailDigest"), false);
  assert.deepEqual(tabIds(card), FIVE, "Off hides nothing while the email is live");
  const guest = fixture(LiveComponent);
  assert.equal(await guest.app.openSettings("notifications"), true); assert.deepEqual(tabIds(guest.card), FIVE);
  assert.equal(guest.card.querySelector("[data-notif-signedout]").textContent, V1259_GUEST);
});

// v1.282.0 (owner 15 Nov; rulings R2, SET1-GO; U190 c, 16 Nov): THE FLASHCARDS TAB, REFORMED. Daily goal, then Answer mode;
// Answer mode reads Auto / Multiple choice / Recall (SETH3, v1.298.2) with its words saying where it applies, and Auto is what a
// player who pressed nothing sees, without anything being written; "Recall mode (in play)" and "Show flashcards on pages"
// are gone, and so is Focus (the owner, U190 c: "Take the row off the screen"; `focus` was read by nothing). A press writes
// the choice. Mutants: the default back to Classic recall (Auto not chosen), a row still drawn, a write at render (mcMode present),
// and the old label each turn an assertion here red. Layout, hit-testing and the press by mouse and touch:
// e2e/journeys/answer-mode.spec.ts.
test("the Flashcards tab: Daily goal, Answer mode (Auto chosen for nothing stored, no write); the three retired rows gone", async () => {
  const {app,card}=fixture();
  assert.equal(await app.openSettings("flashcards"),true);
  const text = card.textContent;
  const at = (s) => { const i = text.indexOf(s); assert.ok(i >= 0, "drawn: " + s); return i; };
  assert.ok(at("Daily goal") < at("Answer mode"), "in that order");
  assert.ok(text.includes("How a card asks you, in Practice and in a roll."), "the words say where it applies");
  assert.ok(!/HERE|study surface|Classic recall|Front Back/.test(text), "no old words, no old label");
  const row = card.querySelector("[data-answer-mode]"); assert.ok(row, "the row is marked");
  const choices = row.querySelectorAll("[data-mode-pick]");
  assert.deepEqual(choices.map((c) => c.querySelector("[data-choice-name]").textContent), ["Auto", "Multiple choice", "Recall"], "SETH3: renamed and reordered");
  assert.deepEqual(choices.map((c) => c.getAttribute("data-mode-pick")), ["auto", "mc", "classic"], "the stored values never change");
  assert.deepEqual(choices.map((c) => c.getAttribute("aria-checked")), ["true", "false", "false"], "Auto is chosen for a player who pressed nothing");
  assert.ok(text.toLowerCase().includes("multiple choice until you get a card right twice, then recall from then on"), "Auto's line");
  assert.equal(card.querySelector("[data-recall-mode]"), null, "Recall mode (in play) is gone");
  assert.ok(!text.includes("Recall mode") && !text.includes("Show flashcards on pages"), "and both retired rows' words");
  assert.ok(!/Focus|Shore up weaknesses|Antifragile|Converge/.test(text), "Focus is gone, its words with it (U190 c)");
  assert.deepEqual(card.querySelectorAll("button").map((b) => b.textContent).filter((t) => /Antifragile|Converge/.test(t)), [], "and its buttons");
  assert.equal("mcMode" in app.settings, false, "rendering wrote nothing");
  card.querySelector('[data-mode-pick="mc"]').click(); assert.equal(app.get("mcMode"), "mc", "a press writes the choice");
  card.querySelector('[data-mode-pick="classic"]').click(); assert.equal(app.get("mcMode"), "classic", "Recall is the stored classic (SETH3: the value never changes)");
});

// SET1 (v1.295.3; the owner, 23 Nov 2026: "why is article settings inside rolling? one can just have landed in an article and not be
// rolling"; ruled SET1-GO): SETTINGS IS ONE PAGE OF GROUPS, filed by what a setting is about. Whatever group an opening names, every
// group is drawn into the one panel, in NG_SETTINGS_TABS' order, the opening's group is the lit one, and the article's sections sit
// in Articles, not under Rolling. The owner's note is first and word for word, with no emoji. Video is ONE switch (the film's row
// under Rolling is gone): it writes the Video section's own setting, and with no reader yet `landFilm` too, as the retired row did.
// Layout, the rail and the chips, the presses by mouse and by touch and the edges at four sizes: e2e/journeys/settings-tabs.spec.ts.
const NOTE = "BJJ Graph is still being actively built — the success rates and probabilities you see are being continuously fine-tuned and will keep improving.";
test("SET1: one page of groups in their order, each old id lighting its own; articles under Articles; the note word for word", async () => {
  const {app,card}=fixture();
  for (const id of FOUR) {
    assert.equal(await app.openSettings(id), true, id);
    const groups = card.querySelectorAll("[data-settings-group]").map((g) => g.getAttribute("data-settings-group"));
    assert.deepEqual(groups, FOUR, "every group on the page, in order, opened at " + id);
    assert.equal(selectedTab(card), id, "the opening's group is lit"); assert.equal(panelOf(card), "ng-stab-" + id);
    assert.equal(card.querySelectorAll('[role="tabpanel"]').length, 1, "one panel");
  }
  const group = (id) => card.querySelector('[data-settings-group="' + id + '"]');
  const inGroup = (sel) => FOUR.find((id) => group(id).querySelector(sel));
  assert.equal(inGroup("[data-section-settings]"), "reading", "the article's sections are under Articles");
  assert.equal(group("rolling").querySelector("[data-section-setting]"), null, "and nothing of them under Rolling");
  assert.equal(inGroup("[data-settings-gi]"), "app", "gi / no-gi under General");
  assert.equal(inGroup("[data-answer-mode]"), "flashcards"); assert.equal(inGroup("[data-settings-start]"), "rolling");
  assert.equal(inGroup("[data-settings-shows]"), "rolling"); assert.equal(inGroup('[data-layer-toggle="hand"]'), "rolling");
  assert.equal(card.querySelector('[data-layer-toggle="card"]'), null, "the card's tick left for the row of three (SETH2 B)");
  assert.equal(card.querySelector('[data-layer-toggle="film"]'), null, "the film's own row is gone: Video is the one switch");
  assert.deepEqual(card.querySelectorAll('[role="tab"]').map((t) => t.textContent), ["General", "Practice", "Rolling", "Articles", "Your odds", "Keyboard"]);
  const notes = card.querySelectorAll(".ng-set-note").map((n) => n.textContent);
  assert.deepEqual(notes, [NOTE, NOTE], "the owner's note, word for word: the head's copy and the phone's, which scrolls");
  assert.ok(!/⚠/.test(card.textContent), "no emoji");
  assert.ok(/Opponent/.test(group("rolling").textContent) && !/Rolling simulation/.test(card.textContent), "the row is called Opponent");
});
test("SET1: the Video row is one switch for the article's video and the film during a roll", async () => {
  const {app,card,calls}=fixture();
  await app.openSettings("reading");
  const box = () => card.querySelector('[data-section-setting="videos"]');
  assert.ok(box().closest("label").textContent.includes("also the film during a roll"));
  box().checked = false; box().fire("change");
  assert.equal(app.get("readerSection.videos"), false, "the Video section's own setting");
  assert.equal(app.get("landFilm"), false, "and, with no reader built yet, the film's, as the retired row wrote then");
  const layers = calls.layers;
  app._reader = { sync(){ calls.synced = (calls.synced || 0) + 1; }, wantsMedia: () => false };
  await app.openSettings("reading"); box().checked = true; app._readerGraded = () => { calls.graded = 1; }; box().fire("change");
  assert.equal(app.get("readerSection.videos"), true); assert.equal(app.get("landFilm"), false, "with a reader, the film's key is left alone");
  assert.equal(calls.synced, 1); assert.equal(calls.graded, 1, "turning it on settles a pinned landing"); assert.equal(calls.layers, layers);
});

// SETH2 B (v1.298.2; the owner, 23 Nov: "isnt 'Questions while you roll …' a bit duplicate of 'Question card …'? or are they diff
// things?"): ONE row of three over the two keys the two ticks wrote. A question = landQuestions on, the card on; The card only =
// landQuestions off, the card on; No card = the card off, landQuestions LEFT AS IT IS. No key added or removed; a pick that leaves
// landQuestions where it is does not write it; the row reads the keys, so a change made on the board (the card's ✕, its Undo) shows.
// The presses by mouse and touch and the board's own ✕ and Undo: e2e/journeys/settings-choices.spec.ts.
test("SETH2 B: During a roll, each place shows: each choice sets exactly its two values, No card keeps the question key, the row follows the board", async () => {
  const {app,card} = fixture();
  await app.openSettings("rolling");
  const shows = () => card.querySelector("[data-settings-shows]").getAttribute("data-settings-shows");
  const now = () => [app.get("landQuestions", true), app._layerOn("card"), shows()];
  const pickIt = (v) => card.querySelector('[data-shows-pick="' + v + '"]').click();
  assert.deepEqual(card.querySelectorAll("[data-shows-pick]").map((b) => b.querySelector("[data-choice-name]").textContent), ["A question", "The card only", "No card"]);
  assert.ok(!/Questions while you roll|Question card/.test(card.textContent), "the two old rows are gone");
  assert.deepEqual(now(), [true, true, "question"], "nothing stored reads as A question");
  pickIt("question"); assert.equal("landQuestions" in app.settings || "landCard" in app.settings, false, "a pick that changes nothing writes nothing");
  pickIt("card"); assert.deepEqual(now(), [false, true, "card"]);
  pickIt("none"); assert.deepEqual(now(), [false, false, "none"], "No card leaves the question key off");
  pickIt("question"); assert.deepEqual(now(), [true, true, "question"]);
  pickIt("none"); assert.deepEqual(now(), [true, false, "none"], "No card leaves the question key on");
  const at = app._settingsAt.landQuestions;
  pickIt("question"); assert.deepEqual(now(), [true, true, "question"]); assert.equal(app._settingsAt.landQuestions, at, "the question key was not written again");
  assert.match(card.querySelector("[data-settings-shows]").textContent, /one multiple-choice question at each place/i, "the chosen one's line");
  // the board: The card only, then the card's own ✕ (No card), then its Undo: back to The card only
  pickIt("card");
  app.setLayer("card", false, "x"); app.renderSettings(); assert.deepEqual(now(), [false, false, "none"], "the row shows the board's ✕");
  app.setLayer("card", true, "undo"); app.renderSettings(); assert.deepEqual(now(), [false, true, "card"], "and its Undo: the choice before it");
  assert.match(card.querySelector("[data-settings-shows]").textContent, /A submission that catches you still asks its defence drill/, "The card only says the drill still asks");
  pickIt("none"); assert.match(card.querySelector("[data-settings-shows]").textContent, /the film follows Video under Articles/, "No card says where the film is decided");
});

// SETH4 (v1.298.2; the owner, 24 Nov, on Answer mode: "that option can be improved wrt ux i think"): CHOICE CARDS, one pattern for
// Answer mode and for "During a roll, each place shows". A radio group: each card a role=radio with aria-checked, the chosen one the
// only tab stop, its name and its one line ALWAYS there (no box that explains only the chosen one), Auto tagged "Recommended", the
// arrows move and choose (wrapping), and the redraw a choice makes puts focus back on the chosen card. Layout, hit-testing, the focus
// ring and the presses by mouse, touch and keyboard: e2e/journeys/settings-choices.spec.ts.
test("SETH4: Answer mode and each place shows are radio groups of cards, every line shown, the arrows choosing, focus kept", async () => {
  const {app,card} = fixture();
  await app.openSettings("flashcards");
  const group = (id) => card.querySelectorAll("[data-choices]").find((g) => g.getAttribute("data-choices") === id);
  for (const [id, n, lines] of [["mode", 3, ["then recall from then on", "Recognition: easier", "Harder, and what makes it stick"]], ["shows", 3, ["keys A–C", "No combos.", "the film follows Video under Articles"]]]) {
    const g = group(id); assert.ok(g, id + ": drawn"); assert.equal(g.getAttribute("role"), "radiogroup"); assert.ok(g.getAttribute("aria-label"));
    const cs = g.querySelectorAll('[role="radio"]'); assert.equal(cs.length, n, id + ": three radios");
    assert.equal(cs.filter((c) => c.getAttribute("aria-checked") === "true").length, 1, id + ": exactly one chosen");
    assert.deepEqual(cs.map((c) => c.getAttribute("tabindex")), cs.map((c) => (c.getAttribute("aria-checked") === "true" ? "0" : "-1")), id + ": the chosen card is the one tab stop");
    lines.forEach((l, i) => assert.ok(cs[i].textContent.includes(l), id + ": card " + i + " carries its own line, chosen or not"));
    assert.equal(card.querySelectorAll(".ng-set-cn").filter((b) => g.parentElement.contains(b)).length, 0, id + ": no box explaining only the chosen one");
  }
  const tags = card.querySelectorAll(".ng-set-tag");
  // OFF1 (v1.302.0): the Opponent row's choice cards tag Normal too, so Settings holds exactly two tags, each on its row's default
  const tagged = (t) => { const c = t.parentElement.parentElement; return c.getAttribute("data-mode-pick") || c.getAttribute("data-opponent-pick"); };
  assert.deepEqual(tags.map((t) => [t.textContent, tagged(t)]), [["Recommended", "auto"], ["Recommended", "normal"]], "two tags: on Auto, and on the opponent's Normal");
  // the arrows choose, wrapping, and focus follows the choice through the redraw
  const keyOn = (id, k) => { const g = group(id); document.activeElement = g.querySelector('[aria-checked="true"]'); return g.fire("keydown", { key: k }); };
  const ev = keyOn("mode", "ArrowDown"); assert.equal(ev.defaultPrevented, true); assert.equal(ev.stopped, true, "the key does not reach the game");
  assert.equal(app.get("mcMode"), "mc", "ArrowDown chooses the next");
  keyOn("mode", "ArrowDown"); assert.equal(app.get("mcMode"), "classic");
  keyOn("mode", "ArrowDown"); assert.equal(app.get("mcMode"), "auto", "and wraps");
  keyOn("mode", "ArrowUp"); assert.equal(app.get("mcMode"), "classic", "ArrowUp wraps back");
  keyOn("shows", "ArrowRight"); assert.deepEqual([app.get("landQuestions", true), app._layerOn("card")], [false, true], "ArrowRight: The card only");
  keyOn("shows", "ArrowLeft"); assert.deepEqual([app.get("landQuestions", true), app._layerOn("card")], [true, true], "ArrowLeft: A question");
  assert.equal(keyOn("mode", "Tab").defaultPrevented, undefined, "Tab is left to the browser: it leaves the group in one step");
});

// ── THE MODIFIERS' PANEL, PRESSED (v1.301.0, MODS1): every press writes its own technique's settings key, stamped, and saves;
// a removal is a stamped 0, never a delete (CLAUDE.md §6.6); a stored name is TEXT, never markup (`hl` escapes every slice).
// tests/mods_sync.test.mjs proves what those keys do across devices; this file proves the panel writes them.
test("the modifiers' panel: Add, + and −, the dot and the bin each write their technique's own settings key and save", async () => {
  const { app, card, calls } = fixture();
  assert.equal(await app.openSettings("modifiers"), true);
  const panel = () => card.querySelector(".ng-set-mods");
  const press = (text) => { const b = panel().querySelectorAll("button").find((x) => x.textContent.trim() === text); assert.ok(b, "a button " + text); b.click(); };
  press("+ Add modifier");
  const inp = panel().querySelector("input[placeholder]") || panel().querySelectorAll("input").find((x) => x.placeholder === "Technique name");
  inp.value = "  Armbar from Mount  "; press("Add modifier");
  const k = "mod:Armbar from Mount", row = () => app.settings[k];
  assert.deepEqual(row().slice(0, 3), [50, 1, "S"], "added at 50%, on, a Submission (the form's first kind), the name trimmed");
  assert.ok(Number.isSafeInteger(row()[3]) && row()[3] > 0, "born is stamped");
  const at0 = app._settingsAt[k]; assert.ok(at0 > 0, "and the key is stamped"); assert.equal(calls.saved, 1, "and saved");
  assert.deepEqual(app.userMods.map((m) => [m.name, m.pct, m.on]), [["Armbar from Mount", 50, true]], "the list is the stored key");
  press("+"); press("+"); assert.equal(row()[0], 52); press("\u2212"); assert.equal(row()[0], 51);
  assert.ok(app._settingsAt[k] > at0, "each press stamps the key later than the last");
  panel().querySelectorAll("button").find((b) => b.title === "Active").click(); assert.equal(row()[1], 0, "the dot pauses it");
  assert.equal(app.userMods[0].on, false); assert.equal(row()[3], app.userMods[0].born, "and born is kept");
  panel().querySelectorAll("button").find((b) => b.title === "Paused").click(); assert.equal(row()[1], 1);
  panel().querySelectorAll("button").find((b) => b.title === "Remove").click();
  assert.equal(row(), 0, "the bin writes a stamped 0"); assert.ok(k in app.settings, "the key is never deleted");
  assert.deepEqual(app.userMods, [], "and the row is gone"); assert.match(panel().textContent, /No modifiers yet/);
  assert.equal(calls.saved, 7, "one save per press: Add, +, +, −, the dot twice, the bin");
  // Add again: the removed name comes back under its own key, at 50% (a new born)
  press("+ Add modifier"); panel().querySelectorAll("input").find((x) => x.placeholder === "Technique name").value = "Armbar from Mount"; press("Add modifier");
  assert.deepEqual(row().slice(0, 2), [50, 1]);
  // and a second Add of a live name keeps its odds: one row, never a second
  press("+"); press("+ Add modifier"); panel().querySelectorAll("input").find((x) => x.placeholder === "Technique name").value = "Armbar from Mount"; press("Add modifier");
  assert.equal(row()[0], 51); assert.equal(app.userMods.length, 1);
});

test("the modifiers' panel: a stored name is text, never markup; at the bound a new name is refused with its line", async () => {
  const { app, card } = fixture();
  const evil = '<img src=x onerror="globalThis.__pwned=1">Kimura';
  app.settings = { ["mod:" + evil]: [40, 1, "T", 5] }; app._settingsAt = { ["mod:" + evil]: 9 };
  assert.equal(await app.openSettings("modifiers"), true);
  const panel = card.querySelector(".ng-set-mods");
  assert.equal(panel.querySelector("img"), null, "no element is made from the name");
  assert.ok(panel.textContent.includes(evil), "the name is shown as typed");
  app._modQuery = "kim"; app.buildModifiers(panel);
  assert.equal(panel.querySelector("img"), null, "nor with the search's highlight"); assert.ok(panel.textContent.includes(evil));
  // the bound: NG_MOD_CAP keys, removed ones counted
  const cap = Number(ownerSource.match(/const NG_MOD_CAP = (\d+);/)[1]); assert.equal(cap, 200);
  app._modQuery = ""; app.settings = {}; app._settingsAt = {};
  for (let i = 0; i < cap; i++) app.settings["mod:Move " + i] = i % 2 ? 0 : [50, 1, "T", i + 1];
  app._modsFromSettings(); app.buildModifiers(panel);
  const press = (text) => { const b = panel.querySelectorAll("button").find((x) => x.textContent.trim() === text); assert.ok(b, text); b.click(); };
  press("+ Add modifier"); panel.querySelectorAll("input").find((x) => x.placeholder === "Technique name").value = "Move 999"; press("Add modifier");
  assert.equal("mod:Move 999" in app.settings, false, "a new name past the bound writes nothing");
  assert.equal(panel.querySelector("[data-mod-full]").textContent, "You have used all 200 slots for odds, counting ones you removed. Edit an existing one, or add back one you removed.", "the bound, said as it is (MODS1-R1 5)");
  assert.equal(panel.querySelectorAll("input").find((x) => x.placeholder === "Technique name").value, "Move 999", "the typed name stays in the field");
  panel.querySelectorAll("input").find((x) => x.placeholder === "Technique name").value = "Move 1"; press("Add modifier");
  assert.deepEqual(app.settings["mod:Move 1"].slice(0, 2), [50, 1], "a removed name comes back at the bound");
  assert.equal(panel.querySelector("[data-mod-full]"), null, "and the line goes");
});

test("the modifiers' quiet line says where they are kept: on this device for a guest, on every device for an account", async () => {
  const { app, card } = fixture();
  assert.equal(await app.openSettings("modifiers"), true);
  const line = () => card.querySelector(".ng-set-mods").querySelector("[data-mods-saved]").textContent;
  assert.equal(line(), "Saved on this device. Sign in to have them on your other devices.", "a guest's words (ruling 3 b)");
  app._progressOwner = { kind: "account", id: "A" }; app.buildModifiers(card.querySelector(".ng-set-mods"));
  assert.equal(line(), "Saved with your progress, on every device you sign in on.", "an account's words");
  // the line is the head's third line: the head stays the panel's first block, so the structural lifts still find the tools
  const host = card.querySelector(".ng-set-mods");
  assert.ok(host.children[0].contains(host.querySelector("[data-mods-saved]")), "inside the head");
  assert.ok(host.children[1].querySelector("input"), "the search box is still the second block");
});
