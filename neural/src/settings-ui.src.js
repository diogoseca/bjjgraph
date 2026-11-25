// Only the Settings presentation moves here. All persisted settings, setting effects,
// gameplay laws, owner/auth control and general modal primitives remain eager.
// Build identity is injected by build.mjs and verified before any instance is changed.
export const NG_SETTINGS_PRESENTATION_BUILD = NG_SETTINGS_UI_BUILD;
// ── SETTINGS IS ONE PAGE OF GROUPS (SET1, v1.295.3; the owner, 23 Nov 2026: "why is article settings inside rolling? one can
// just have landed in an article and not be rolling … it's too thin and doesnt allow breathing very much"; ruled SET1-GO). ──
// It was five tabs in a 440 px card, and the Rolling tab held the article sections (1,415 of its 3,048 px), sound and the
// gi/no-gi choice. Now every group is drawn into ONE scrolling panel, filed by what a setting is ABOUT (NG_SETTINGS_TABS,
// app.src.jsx, is the list and its order), and the group list beside it is always visible: a rail on a wide screen, a row
// of chips on a phone. A press on a group SCROLLS to it, and the group in view is the lit one; nothing is behind a tab, and
// `openSettings(id)` with any old id (flashcards, rolling, modifiers, notifications, shortcuts) still opens on its group.
// The group list keeps the tab roles, ids and keys the tab row had (`[data-settings-tab]`, `#ng-stab-<id>`, aria-selected,
// Right/Left/Home/End), and `#ng-stab-panel` stays the one scroll container; aria-selected names the group at the top.
// SPACING IS ONE TOKEN, 4 px: every gap below is a whole multiple of it (4 8 12 16 24 32 40 48), and every target is
// 40 px (10 tokens) on a wide screen and 44 px (11) on a phone. The frame: at most 760 px wide (a 176 px rail and a
// column whose prose is held to 60ch: at most 76 characters a line, pinned by settings-tabs.spec.ts), 48 px from the browser's edges at 900 px
// and up, 32 px below that, and a full-screen sheet under 600 px. The look stays the app's: dark, a faint grain over the
// card's own gradient, no emoji. Settings keys: none added, renamed or deleted (CLAUDE.md §6.6).
// A GROUP'S HEADING IS A LABEL, NOT ANOTHER OPTION (SETH1, v1.298.2; the owner, 23 Nov 2026: "section headers in settings need to be
// better diferentiates, otherwise i think they're options, type is too similar"). It was 17 px / 700 / #eef1f6 over the first option's
// grey line; an option's title is 14 px / 600 / #eef1f6 over the same line: one face, one colour, one shape, 3 px apart. Now it is
// a small-caps eyebrow (12 px / 700, uppercase, .08em) in the selected tab's own blue, #96b4ff (the hue of its border, rgba(150,180,
// 255,.45), at full strength: 8.0:1 on the card's top, 6.8:1 on its lightest point, the radial tint plus the grain), standing on a
// full-width hairline whose first 32 px is that blue. The rule chosen over a short bar before the word (the screens, 390 and 1074): a
// 16 px dash read as a bullet at 390 and as a cousin of the grey "On screen during a roll" sub-heading, while the hairline marks the
// edge of a group across the whole column of a long page. Its line stays under it, grey; the first control below drops its own top
// line (two rules in a row read as noise). The space above a group (the last row's 16 plus the group's own 40) is more than between
// two options (16 each side of a line), and it is the PREVIOUS group's padding, so the groups still tile the panel with no gap and
// the spy's "group in view" is unchanged; the first group has no extra gap. Option titles are untouched.
// NOT STICKY, measured: a heading held at the panel's top (position:sticky) covered the keyboard-focused control on 11 of 59 focus
// steps backwards through the page at 390x631 and 16 of 59 at 1074x796, Chromium holds it below the panel's padding with controls
// passing visibly above it, and it needs an opaque surface over the card's gradient. The group list already lights the group in
// view (a rail on a wide screen, the chips on a phone), so it stays out. Pinned by settings-tabs.spec.ts (the heading against every
// option title at four sizes; a wheel to each heading in turn lights its group), with the mutant "heads-as-options".
// The modifiers' own controls are drawn by `buildModifiers` (eager, app.src.jsx) with inline sizes under the target; the
// rules at the foot that name `.ng-set-mods` lift its search box, its kind chips and "Add modifier" to the
// target from here, so the eager bundle does not grow. A MODIFIER'S OWN ROW (its dot, − / +, delete) is lifted too since
// v1.301.0 (MODS1): the modifiers are saved, so a player opens Settings with rows in it. Each control keeps its drawn size and
// gains a hit area of the target (40, 44 on a phone) from a centred `::before`; the bin stands 6 px (10 on a phone) further from
// "+", because their centres were 35 px apart and two targets of 40 would have overlapped. Pinned by e2e/journeys/
// mods-saved.spec.ts (every edge of each target answers to its own control, at 1440 by mouse and 390x631 by touch).
const NG_SETTINGS_CSS = "\
.ng-modal>[data-settings-card]{display:flex;flex-direction:column;width:min(760px,calc(100vw - 96px))!important;height:min(880px,calc(100vh - 96px));height:min(880px,calc(100dvh - 96px));\
background:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .7 0 0 0 0 .75 0 0 0 0 .9 0 0 0 .05 0'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\"),radial-gradient(120% 60% at 0 0,rgba(74,108,255,.07),transparent 60%),linear-gradient(180deg,rgba(26,30,52,.99),rgba(18,21,38,.99))!important;color:#eef1f6}\
@media (max-width:899px){.ng-modal>[data-settings-card]{width:min(760px,calc(100vw - 64px))!important;height:min(880px,calc(100vh - 64px));height:min(880px,calc(100dvh - 64px))}}\
.ng-set-head{flex:none;padding:24px 24px 16px;border-bottom:1px solid rgba(150,170,210,.12)}\
.ng-set-top{display:flex;align-items:center;justify-content:space-between;gap:16px}\
.ng-set-top h2{margin:0;font-size:20px;font-weight:700;letter-spacing:-.01em;color:#eef1f6}\
.ng-set-x{flex:none;width:44px;height:44px;margin:-12px -12px -12px 0;border:none;border-radius:12px;background:transparent;color:#8b97b0;font:inherit;font-size:24px;line-height:1;cursor:pointer}\
.ng-set-x:hover{color:#c4cde0}.ng-set-x:focus-visible{outline:2px solid rgba(160,185,255,.85)}\
.ng-set-note{margin-top:8px;padding-left:12px;border-left:2px solid rgba(232,184,107,.55);font-size:12.5px;line-height:1.5;color:#d9bf9a;max-width:60ch}\
#ng-stab-panel .ng-set-note{display:none;margin:0 0 24px}\
.ng-set-body{flex:1;min-height:0;display:flex}\
.ng-stabs.ng-set-nav{flex:none;width:176px;flex-direction:column;justify-content:flex-start;gap:4px;margin:0;padding:24px 12px;overflow-x:hidden;overflow-y:auto;border-right:1px solid rgba(150,170,210,.1);background:rgba(8,10,20,.22)}\
.ng-set-nav .ng-stab{display:flex;align-items:center;min-height:40px;padding:0 12px;border-radius:12px;text-align:left}\
.ng-set-nav .ng-stab>span{padding:0;border:none}\
.ng-set-nav .ng-stab[aria-selected=true]{background:rgba(74,108,255,.2);box-shadow:inset 0 0 0 1px rgba(150,180,255,.45)}\
#ng-stab-panel{position:relative;flex:1;min-width:0;overflow-y:auto;overscroll-behavior:contain;padding:24px 24px 0}\
.ng-set-grp{padding-bottom:40px}\
.ng-set-grp>h3{position:relative;margin:0;padding-bottom:8px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#96b4ff;border-bottom:1px solid rgba(150,170,210,.16)}\
.ng-set-grp>h3::after{content:'';position:absolute;left:0;bottom:-1px;width:32px;height:2px;border-radius:1px;background:#96b4ff}\
.ng-set-grp>p,.ng-set-sub>p{margin:4px 0 12px;font-size:13px;line-height:1.5;color:#8b97b0;max-width:60ch}\
.ng-set-grp>h3+p{margin-top:8px}\
.ng-set-grp>h3+:not(p),.ng-set-grp>h3+:not(p)>:first-child,.ng-set-grp>h3+p+*,.ng-set-grp>h3+p+*>:first-child{border-top:0}\
.ng-set-sub{padding-top:16px;border-top:1px solid rgba(150,170,210,.09)}\
.ng-set-sub>div{font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:#7f8aa6}\
.ng-set-row{position:relative;padding:16px 0;border-top:1px solid rgba(150,170,210,.09)}\
.ng-set-row.side{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:24px;align-items:start}\
.ng-set-row.side>*{grid-column:1}.ng-set-row.side>.ng-set-ctl{grid-column:2;grid-row:1/span 2}\
.ng-set-row.side>.ng-set-wide{grid-column:1/-1}\
.ng-set-t{font-size:14px;font-weight:600;color:#eef1f6}\
.ng-set-h{margin-top:4px;font-size:13px;line-height:1.5;color:#93a0bd;max-width:60ch}\
.ng-set-seg{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}\
.ng-set-row.side>.ng-set-seg{margin-top:0;flex-wrap:nowrap}\
.ng-set-seg>button,.ng-set-num{min-height:40px;min-width:40px}\
.ng-set-cn{margin-top:12px;padding:8px 12px;font-size:12.5px;line-height:1.5;color:#93a0bd;background:rgba(255,255,255,.03);border:1px solid rgba(150,170,210,.12);border-radius:10px;max-width:60ch}\
.ng-set-num{width:80px;box-sizing:border-box;font:inherit;font-size:14px;font-weight:600;color:#eef1f6;background:rgba(255,255,255,.04);border:1px solid rgba(150,170,210,.25);border-radius:10px;text-align:center}\
.ng-set-tick{flex:none;width:40px;height:40px;margin:-8px -8px 0 0;display:flex;align-items:center;justify-content:center;border:none;background:transparent;cursor:pointer}\
.ng-set-tick>span{width:24px;height:24px;box-sizing:border-box;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;border:1px solid rgba(150,170,210,.3)}\
.ng-set-tick[aria-pressed=true]>span{border-color:rgba(110,160,255,.6);background:rgba(74,108,255,.4)}\
.ng-set-tick:focus-visible{outline:2px solid rgba(160,185,255,.85);outline-offset:-4px;border-radius:10px}\
.ng-set-range{display:block;width:100%;height:40px;margin:4px 0 0;accent-color:#5b8cff;cursor:pointer}\
.ng-set-ticks{display:flex;justify-content:space-between;font-size:11px;color:#6b7691;font-weight:600;max-width:60ch}\
.ng-set-arts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:24px;border-top:1px solid rgba(150,170,210,.09)}\
.ng-set-arts label{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px;font-size:13px;color:#dfe5f1;border-bottom:1px solid rgba(150,170,210,.06);cursor:pointer}\
.ng-set-arts label>span>span{display:block;font-size:11.5px;color:#93a0bd}\
.ng-set-arts input{-webkit-appearance:none;appearance:none;flex:none;width:24px;height:24px;margin:0;border-radius:7px;border:1px solid rgba(150,170,210,.3);background:transparent center/14px no-repeat;cursor:pointer}\
.ng-set-arts input:checked{border-color:rgba(110,160,255,.6);background-color:rgba(74,108,255,.4);background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='M2.5 7.4l3 3 6-6.8' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")}\
.ng-set-arts input:focus-visible{outline:2px solid rgba(160,185,255,.85);outline-offset:2px}\
.ng-set-keys>div{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-top:1px solid rgba(150,170,210,.07);font-size:13.5px;color:#dbe2f0}\
.ng-set-foot{flex:none;display:flex;justify-content:center;align-items:center;gap:16px;padding:0 24px;border-top:1px solid rgba(150,170,210,.1)}\
.ng-set-choices{display:flex;flex-direction:column;gap:8px;margin-top:12px}\
.ng-set-choice{display:grid;grid-template-columns:20px minmax(0,1fr);column-gap:12px;row-gap:4px;align-items:start;width:100%;box-sizing:border-box;min-height:44px;margin:0;padding:12px 16px 12px 12px;border:1px solid rgba(150,170,210,.14);border-radius:12px;background:rgba(255,255,255,.03);color:#eef1f6;font:inherit;text-align:left;cursor:pointer}\
.ng-set-choice:hover{border-color:rgba(150,170,210,.3)}\
.ng-set-choice[aria-checked=true]{background:rgba(74,108,255,.2);border-color:rgba(150,180,255,.45)}\
.ng-set-choice:focus-visible{outline:2px solid rgba(160,185,255,.85);outline-offset:2px}\
.ng-set-radio{grid-row:1/span 2;display:flex;align-items:center;justify-content:center;width:20px;height:20px;box-sizing:border-box;border-radius:50%;border:2px solid rgba(150,170,210,.5)}\
.ng-set-choice[aria-checked=true] .ng-set-radio{border-color:#96b4ff}\
.ng-set-choice[aria-checked=true] .ng-set-radio::after{content:'';width:8px;height:8px;border-radius:50%;background:#96b4ff}\
.ng-set-cname{grid-column:2;display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-height:20px;font-size:14px;font-weight:600;line-height:20px;color:#eef1f6}\
.ng-set-cline{grid-column:2;font-size:13px;line-height:1.5;color:#93a0bd}\
.ng-set-choice[aria-checked=true] .ng-set-cline{color:#b4c0da}\
.ng-set-tag{padding:0 8px;border-radius:999px;background:rgba(74,108,255,.22);font-size:11px;font-weight:600;line-height:20px;letter-spacing:.02em;color:#c9d6ff}\
.ng-set-mods>div:nth-of-type(2)>div:first-child{padding-top:0!important;padding-bottom:0!important}\
.ng-set-mods>div:nth-of-type(2)>div:first-child>input,.ng-set-mods>div:nth-of-type(2)>div:last-child>button,.ng-set-mods>button{box-sizing:border-box;min-height:40px;min-width:40px}\
.ng-mod-row>button,.ng-mod-step{position:relative}\
.ng-mod-row>button::before,.ng-mod-step::before{content:'';position:absolute;left:50%;top:50%;width:40px;height:40px;transform:translate(-50%,-50%)}\
.ng-mod-del{margin-left:6px}\
@media (max-width:599px){\
.ng-modal>[data-settings-card]{width:100vw!important;height:100vh;height:100dvh;border:none!important;border-radius:0!important;box-shadow:none!important}\
.ng-set-head{padding:16px 16px 8px;border-bottom:none}.ng-set-head .ng-set-note{display:none}#ng-stab-panel .ng-set-note{display:block}\
.ng-set-body{flex-direction:column}\
.ng-stabs.ng-set-nav{width:auto;flex-direction:row;gap:8px;padding:0 16px 8px;overflow-x:auto;overflow-y:hidden;border-right:none;border-bottom:1px solid rgba(150,170,210,.1);background:none}\
.ng-set-nav .ng-stab{min-height:44px;padding:0 16px;border-radius:999px}\
#ng-stab-panel{padding:16px 16px 0}\
.ng-set-row.side.stack{display:block}.ng-set-row.side.stack>.ng-set-seg{margin-top:12px;flex-wrap:wrap}\
.ng-set-seg>button,.ng-set-num,.ng-set-range,.ng-set-arts label{min-height:44px}.ng-set-seg>button{min-width:44px}.ng-set-range{height:44px}.ng-set-tick{width:44px;height:44px;margin:-10px -10px 0 0}\
.ng-set-arts{column-gap:16px}.ng-set-foot{padding:0 16px}\
.ng-set-mods>div:nth-of-type(2)>div:first-child>input,.ng-set-mods>div:nth-of-type(2)>div:last-child>button,.ng-set-mods>button{min-height:44px;min-width:44px}\
.ng-mod-row>button::before,.ng-mod-step::before{width:44px;height:44px}.ng-mod-del{margin-left:10px}}";
// THE OWNER'S NOTE, WORD FOR WORD (ruling SET1-GO 4: "his words are his"). It stays the first thing Settings says; it is a
// quiet line with an amber rule, not a boxed warning with an emoji. On a phone it scrolls away with the settings (the
// head's copy is hidden there and the panel's shown), so the sheet's own height goes to the settings.
const NG_SETTINGS_NOTE = "BJJ Graph is still being actively built — the success rates and probabilities you see are being continuously fine-tuned and will keep improving.";
// One line under each group's heading: what the group is ABOUT. An id with no line has a heading that says it already.
const NG_SETTINGS_LINES = {
  flashcards: "How your flashcards are asked, here and in a roll.",
  rolling: "The game against the opponent: how a roll starts, plays and is timed.",
  reading: "What an article shows, whether you opened it to read or landed on it in a roll. A section you hide with its ✕ comes back here. Your choices carry across pages and sync when signed in.",
  app: "Acts everywhere: the map, a roll, Practice, Master the game and every article.",
  shortcuts: "Keys for a keyboard; nothing to set.",
};
// ANSWER MODE'S THREE CHOICES: [stored value, name, its one line] (SETH3, v1.298.2; the owner, 24 Nov: "instead of Auto, Front Back
// cards, Multiple choice, say Multiple Choice cards / Front Back cards or instead multiple choice, or what would the teacher call it
// instead of front/back?"). The teacher's word is RECALL (recall against recognition): "front/back" described the card, not what the
// player does. Reordered Auto, Multiple choice, Recall; no "cards" suffix; Auto stays first and the default. The STORED VALUES,
// the default and what each does are unchanged ("classic" was "Classic recall", then "Front Back cards"): labels and lines only.
// Each line is the orchestrator's, plus the fact the old line carried: Multiple choice keeps D1 (a), THE OWNER'S ANSWER TO U194 (16
// Nov, SET1-R3: it means it everywhere, so a card is never asked from memory and the goals that need one proven from memory, "Prove
// a card from memory" and the four "Recall-prove …", wait; "the line says both, plainly"), pinned by answer-mode.spec.ts; Recall
// keeps that checkpoints and the defence drill stay multiple choice (`_cardAsksMc`).
// WHAT EACH PLACE SHOWS DURING A ROLL: [choice, name, its one line] (SETH2 B, v1.298.2; the lines are the orchestrator's, ruled with the
// survey's two findings: the defence drill in "The card only", the film's own switch in "No card").
const NG_ROLL_SHOWS = [
  ["question", "A question", "One multiple-choice question at each place (keys A–C). Right answers raise that exchange’s odds and refund clock, and rights in a row build a combo; a wrong or ignored one breaks it."],
  ["card", "The card only", "The place’s card, with no question. No combos. A submission that catches you still asks its defence drill."],
  ["none", "No card", "No card and no question; the film follows Video under Articles. The ✕ on the card does the same; this brings it back."],
];
const NG_OPPONENT_MODES = [
  ["normal", "Normal", "A move lands by its odds; when it misses, it’s the opponent’s turn."],
  ["off", "Off", "No opponent: every move you pick lands. No Win %, nothing won or lost, nothing a roll earns; your answers still count."],
];
const NG_ANSWER_MODES = [
  ["auto", "Auto", "Multiple choice until you get a card right twice, then recall from then on."],
  ["mc", "Multiple choice", "Pick the answer from three. Recognition: easier, good for a first pass. A card is never asked from memory, so the goals that need one proven from memory wait."],
  ["classic", "Recall", "Answer from memory, then reveal and grade yourself. Harder, and what makes it stick. Checkpoints and the defence drill stay multiple choice."],
];
export async function ngInstallSettingsPresentation(target, dependencies) {
  if (dependencies.expectedBuild !== NG_SETTINGS_PRESENTATION_BUILD) throw new Error("Settings presentation version mismatch");
  // Share the reader's registry instead of bundling a second copy. Importing the
  // module installs nothing; Settings keeps its existing intent/owner checks.
  const attempt = target._settingsPresentationAttempt;
  const { SECTION_TYPES, sectionShown } = await import(target._appAsset("reader.js") + (attempt > 1 ? "&retry=" + attempt : ""));
  if (target.__ngDestroyed || !target._progressCurrent()) throw new Error("Settings owner changed");
  // The group list is `this._settingsTabs`, chosen by `openSettings` for each opening (NG_DIGEST_LIVE,
  // app.src.jsx). renderSettings reads it once and hands the same list to the list's arrow keys, so
  // the keys walk exactly the groups that were drawn and never land on one this opening hides.
  const { NG_START_FROM, NG_DIGEST_LIVE } = dependencies;
  if (document.getElementById && document.head && !document.getElementById("ng-settings-css")) {
    const st = document.createElement("style"); st.id = "ng-settings-css"; st.textContent = NG_SETTINGS_CSS; document.head.appendChild(st);
  }
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.setAttribute("class", cls); if (html != null) e.innerHTML = html; return e; };
  // A row's words: its title and its help, as the first two children of the row (three specs read the help as children[1]).
  const words = (row, title, sub) => { row.append(el("div", "ng-set-t", title), el("div", "ng-set-h", sub)); return row; };
  // The ✓ box, with a hit area of 40 px (44 on a phone) around its 24 px face. aria-pressed carries its state.
  const tick = (on, attr, onPress) => {
    const b = el("button", "ng-set-tick ng-set-ctl", "<span>" + (on ? "✓" : "") + "</span>");
    b.type = "button"; b.setAttribute("aria-pressed", on ? "true" : "false"); if (attr) b.setAttribute(attr[0], attr[1]);
    b.addEventListener("click", onPress); return b;
  };
  // CHOICE CARDS (SETH4, v1.298.2; the owner, 24 Nov, on Answer mode: "that option can be improved wrt ux i think"). It was three small
  // buttons and a box explaining ONLY the chosen one, so learning what the other two do meant choosing them, which changed the setting.
  // Now each choice is its own full-width card, stacked: a radio mark, the name in an option title's look, and its one line ALWAYS
  // shown under it; the chosen card has the selected tab's treatment (its fill and border), the others the plain row surface. A radio
  // group (role radiogroup / radio, aria-checked): Tab enters on the chosen card and leaves the group in one step (roving tabindex),
  // the arrows move AND choose (wrapping), Space or ⏎ chooses the focused card, and the whole card is the target (44 px or more).
  // A choice redraws the card (`renderSettings`), and the redraw puts focus back on the chosen card (`_settingsRadio`, below, the
  // tabs' refocus rule). STACKED AT EVERY WIDTH, measured: Settings is at most 760 px wide, so three cards side by side at 1074 and
  // at 1440 would hold their line at ~18 characters a line, under the 28 a row needs. One pattern for Answer mode and for "During a
  // roll, each place shows" (`id` names the group for the refocus; `attr` is each card's hook, `data-mode-pick` / `data-shows-pick`).
  // ONE COMMIT (SETH4): the owner may pick the old look, and the revert of that commit is the whole way back.
  const choiceCards = (id, label, choices, now, attr, onPick, tag) => {
    const g = el("div", "ng-set-choices");
    g.setAttribute("role", "radiogroup"); g.setAttribute("aria-label", label); g.setAttribute("data-choices", id);
    const cards = choices.map(([v, name, line]) => {
      const on = v === now, c = el("button", "ng-set-choice");
      c.type = "button"; c.setAttribute("role", "radio"); c.setAttribute("aria-checked", on ? "true" : "false");
      c.setAttribute("tabindex", on ? "0" : "-1"); c.setAttribute(attr, v);
      const mark = el("span", "ng-set-radio"), nm = el("span", "ng-set-cname"), word = el("span"), ln = el("span", "ng-set-cline");
      nm.id = "ng-choice-" + id + "-" + v; ln.id = nm.id + "-line"; mark.setAttribute("aria-hidden", "true");
      word.textContent = name; word.setAttribute("data-choice-name", ""); nm.appendChild(word);
      if (tag && tag[0] === v) nm.appendChild(el("span", "ng-set-tag")).textContent = tag[1];
      ln.textContent = line;
      c.setAttribute("aria-labelledby", nm.id); c.setAttribute("aria-describedby", ln.id);
      c.append(mark, nm, ln);
      c.addEventListener("click", () => { if (v !== now) onPick(v); });
      g.appendChild(c); return c;
    });
    g.addEventListener("keydown", (e) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault(); e.stopPropagation();
      const at = cards.indexOf(document.activeElement), n = cards.length;
      const to = ((at < 0 ? choices.findIndex((c) => c[0] === now) : at) + step + n) % n;
      if (choices[to][0] !== now) onPick(choices[to][0]); else cards[to].focus();
    });
    return g;
  };
  const methods = {
_settingsTabRow(row, tab, refocus, tabs, panel) {
    const pick = (id) => row.querySelector('[data-settings-tab="' + id + '"]');
    // LIGHT A GROUP without redrawing: the list's selected button, its tab stop, the panel's label, and on a phone the
    // chip row brings the lit chip to its middle. `_settingsTab` follows, so a redraw after a setting keeps the same light.
    const light = (id) => {
      this._settingsTab = id;
      for (const b of row.querySelectorAll("[data-settings-tab]")) {
        const on = b.getAttribute("data-settings-tab") === id;
        b.setAttribute("aria-selected", on ? "true" : "false"); b.setAttribute("tabindex", on ? "0" : "-1");
      }
      if (panel) panel.setAttribute("aria-labelledby", "ng-stab-" + id);
      const b = pick(id);
      if (b && row.scrollWidth > row.clientWidth) {
        const mid = b.offsetLeft + b.offsetWidth / 2 - row.clientWidth / 2;
        if (row.scrollTo) row.scrollTo({ left: mid, behavior: this._reducedMotion() ? "auto" : "smooth" }); else row.scrollLeft = mid;
      }
    };
    const groupTop = (id) => { const g = panel && panel.querySelector('[data-settings-group="' + id + '"]'); return g ? Math.max(0, (g.offsetTop || 0) - 16) : 0; };
    // A PRESS SCROLLS TO ITS GROUP (as far as the panel can: a group near the end stops short of the top). The press HOLDS its
    // light: the spy below must not re-light the groups the glide passes, nor, once it has arrived, the next group whose heading
    // shares the top of the panel with a short one ("Your odds", "Email"). The hold ends at the player's own next scroll, or
    // 900 ms after a glide that never arrived (one the player's wheel interrupted).
    const jump = (id, smooth) => {
      light(id);
      if (!panel) return;
      const y = Math.max(0, Math.min(groupTop(id), (panel.scrollHeight || 0) - (panel.clientHeight || 0)));
      this._settingsHold = { id, y, until: Date.now() + 900, arrived: false };
      if (smooth && panel.scrollTo && !this._reducedMotion()) panel.scrollTo({ top: y, behavior: "smooth" }); else panel.scrollTop = y;
    };
    this._settingsJump = jump;
    row.addEventListener("click", (e) => { const b = e.target.closest("[data-settings-tab]"); if (b) jump(b.getAttribute("data-settings-tab"), true); });
    row.addEventListener("keydown", (e) => {
      const n = tabs.length, at = tabs.findIndex((t) => t[0] === this._settingsTab);
      const to = { ArrowRight: at + 1, ArrowLeft: at + n - 1, ArrowDown: at + 1, ArrowUp: at + n - 1, Home: 0, End: n - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault(); e.stopPropagation();
      const id = tabs[to % n][0]; jump(id, true);
      const b = pick(id); if (b) b.focus({ preventScroll: true });
    });
    row.addEventListener("wheel", (e) => {
      if (row.scrollWidth <= row.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault(); row.scrollLeft += e.deltaY;
    }, { passive: false });
    const fade = () => {
      const x = row.scrollLeft, f = [x > 1 ? "l" : "", x < row.scrollWidth - row.clientWidth - 1 ? "r" : ""].join(" ").trim();
      if (f) row.setAttribute("data-fade", f); else row.removeAttribute("data-fade");
    };
    row.addEventListener("scroll", () => { this._settingsRowX = row.scrollLeft; fade(); }, { passive: true });
    // THE SPY: the group in view is the lit one. "In view" = the last group whose top has passed a third of the way down
    // the panel; at the very bottom the last group drawn, so a short last group can still be lit by scrolling.
    if (panel) panel.addEventListener("scroll", () => {
      const h = this._settingsHold, top = panel.scrollTop || 0, there = h && Math.abs(top - h.y) <= 2;
      if (h && there) { h.arrived = true; return; }
      if (h && !h.arrived && Date.now() < h.until) return;
      this._settingsHold = null;
      const groups = panel.querySelectorAll("[data-settings-group]");
      let id = groups.length ? groups[0].getAttribute("data-settings-group") : tab;
      if (top + panel.clientHeight >= panel.scrollHeight - 2 && groups.length) id = groups[groups.length - 1].getAttribute("data-settings-group");
      else for (const g of groups) if ((g.offsetTop || 0) <= top + panel.clientHeight / 3) id = g.getAttribute("data-settings-group");
      if (id !== this._settingsTab) light(id);
    }, { passive: true });
    const on = row.querySelector('[aria-selected="true"]'), x0 = this._settingsRowX;
    const mid = on ? on.offsetLeft + on.offsetWidth / 2 - row.clientWidth / 2 : 0;
    row.scrollLeft = x0 == null ? mid : x0;
    this._settingsRowX = row.scrollLeft; this._settingsRowTab = tab;
    fade(); this._settingsRowFade = fade;
    // ONE observer for the app's lifetime, moved to each new row: an observer per render would
    // keep every detached row alive for as long as the page is open.
    if (window.ResizeObserver) {
      const ro = this._settingsRowRO || (this._settingsRowRO = new ResizeObserver(() => this._settingsRowFade()));
      ro.disconnect(); ro.observe(row);
    }
    if (refocus && on) on.focus({ preventScroll: true });
  },
renderSettings() {
    const card = this.modalCardRef.current; if (!card) return;
    // The frame is the stylesheet's (`[data-settings-card]` above, over the inline width every dialog writes); `openModal`
    // takes the mark off for every other dialog, so none of them inherits it.
    card.setAttribute("data-settings-card", "");
    const tabs = this._settingsTabs, tab = this._settingsTab || tabs[0][0];
    // EVERY CHANGE REDRAWS THE CARD, so the panel keeps its scroll through a redraw (a switch stays under the pointer) and only
    // a new opening goes to its group: `openSettings` clears `_settingsRowX`, and the list's first draw sets it again.
    const previous = card.querySelector('[role="tabpanel"]'), fresh = this._settingsRowX == null;
    const panelY = !fresh && previous ? previous.scrollTop || 0 : 0;
    // Every change re-renders the whole card, so a group button that HAS focus (an arrow key, or the click
    // that just chose it) is destroyed under the user. Remember that, before the wipe blurs it,
    // and hand focus to the new active one below; otherwise the second arrow press lands on <body>.
    const ae = document.activeElement, refocus = !!(ae && card.contains(ae) && ae.getAttribute("role") === "tab");
    // A CHOICE CARD THAT HAS FOCUS (SETH4) gets it back on the redraw: the chosen card of the same group (an arrow key's choice, or
    // the card a click just chose), as the group list's tab does above.
    const radio = ae && card.contains(ae) && ae.getAttribute("role") === "radio" && ae.closest("[data-choices]") ? ae.closest("[data-choices]").getAttribute("data-choices") : null;
    card.innerHTML = "";
    const head = el("div", "ng-set-head");
    head.innerHTML = '<div class="ng-set-top"><h2>Settings</h2><button type="button" class="x ng-set-x" aria-label="Close settings">&times;</button></div>';
    head.appendChild(el("div", "ng-set-note")).textContent = NG_SETTINGS_NOTE;
    head.querySelector(".x").addEventListener("click", () => this.closeModal());
    card.appendChild(head);
    const bodyWrap = el("div", "ng-set-body");
    // THE GROUP LIST (SET1): the tab row's own element and keys, laid out as a rail (or, on a phone, as the row it was).
    const nav = el("div", "ng-stabs ng-set-nav",
      tabs.map(([id, label]) => '<button type="button" role="tab" class="ng-stab" id="ng-stab-' + id + '" data-settings-tab="' + id + '" aria-controls="ng-stab-panel" aria-selected="' + (id === tab) + '" tabindex="' + (id === tab ? 0 : -1) + '" style="pointer-events:auto;"><span>' + label + '</span></button>').join(""));
    nav.setAttribute("role", "tablist"); nav.setAttribute("aria-label", "Settings groups"); nav.setAttribute("data-settings-tabs", "");
    const body = el("div");
    body.id = "ng-stab-panel"; body.setAttribute("role", "tabpanel"); body.setAttribute("aria-labelledby", "ng-stab-" + tab);
    body.appendChild(el("div", "ng-set-note")).textContent = NG_SETTINGS_NOTE;
    bodyWrap.append(nav, body); card.appendChild(bodyWrap);
    const label = Object.fromEntries(tabs);
    const group = (id) => {
      const g = el("section", "ng-set-grp"); g.setAttribute("data-settings-group", id);
      g.appendChild(el("h3")).textContent = label[id];
      if (NG_SETTINGS_LINES[id]) g.appendChild(el("p")).textContent = NG_SETTINGS_LINES[id];
      body.appendChild(g); return g;
    };
    for (const [id] of tabs) {
    const sec = group(id);
    if (id === "flashcards") {
      // daily goal
      const g = words(el("div", "ng-set-row side"), "Daily goal", "Cards a day, reviews and new together.");
      // CARDS, NOT TECHNIQUES (v1.138.0). Practice (U56 e, v1.242.0) counts reviews and new cards
      // together against this goal (the app's NG_PRACTICE_GOAL, through `practiceGoal`, its one source:
      // SIDE-R2 M3): new cards fill what reviews leave of it, never fewer than a fifth of it (the
      // planner's quota), and stop once the day's answers reach it. Reviews are never capped.
      const inp = el("input", "ng-set-num ng-set-ctl");
      inp.type = "number"; inp.value = this.practiceGoal(); inp.min = "5"; inp.max = "200"; inp.setAttribute("aria-label", "Daily goal");
      inp.addEventListener("change", () => { this.set("dailyGoal", this.practiceGoal(parseInt(inp.value))); inp.value = this.practiceGoal(); });
      g.appendChild(inp); sec.appendChild(g);
      // ANSWER MODE (v1.282.0, owner 15 Nov; rulings R2, SET1-GO): ONE SWITCH, ONE MEANING, everywhere a card is asked (the
      // app's `_answerMode`, beside `mcActive`). Auto first and the default for a player who pressed nothing: the reader's
      // default, never a write (nothing here or in the app writes `mcMode` unless the player presses a choice). The stored
      // values never change (auto / mc / classic); the names and lines are NG_ANSWER_MODES' (SETH3, above). The words say
      // where it applies, in his order of things: no "HERE", no "study surface".
      {
        // SETH4: the three as choice cards, every line shown; Auto is tagged "Recommended" (the owner's default since v1.282.0).
        const mode = words(el("div", "ng-set-row"), "Answer mode", "How a card asks you, in Practice and in a roll.");
        mode.appendChild(choiceCards("mode", "Answer mode", NG_ANSWER_MODES, this.get("mcMode", this._answerMode()), "data-mode-pick",
          (v) => { this.set("mcMode", v); this.renderSettings(); }, ["auto", "Recommended"]));
        mode.setAttribute("data-answer-mode", "1");
        sec.appendChild(mode);
      }
      // (the training-day email row moved to the Notifications tab in v1.150.0)
      // "RECALL MODE (IN PLAY)" LEFT SETTINGS in v1.282.0 (R2): its job is Auto's (a card right twice asks front and back
      // in a roll), and a switch on no screen must not decide what plays. Its key `recallInPlay` and the account's
      // `recallCarry` fact are kept, stored, synced and merged as before, and read by nothing (CLAUDE.md 6.6: a settings key
      // can never be deleted). It was a switch anyone turned on from v1.270.0 (U163 c), the black-belt toggle before that.
      // (the dead "Study order" setting row was deleted in v1.105.0 — `studyOrder` was written but read nowhere; due-first is now BEHAVIOUR, not a preference)
      // "FOCUS" (Antifragile / Converge) LEFT SETTINGS in v1.282.0 (the owner, 16 Nov, U190 c: "Take the row off the
      // screen"): nothing in the app ever read `focus` (the row came with the app, Phase 0.2; `git log -S"antifragile"`
      // finds the row only), so every player already had one order, and still does. The key `focus` stays stored, synced
      // and merged, read by nothing (CLAUDE.md 6.6: a settings key can never be deleted).
      // "SHOW FLASHCARDS ON PAGES" LEFT SETTINGS in v1.282.0: it switched nothing (its own row was the only reader of
      // `quizOnPages`; the quiz pill went with the old front-end, tests/artifacts/sidebar_capabilities.md row 115). The key
      // stays stored, synced and readable, read by nothing (CLAUDE.md 6.6).
      // "Turn what you know gold" (`masteryGold`) left Settings in v1.280.0 (GOLD1, ruled): the map's gold is the outlines,
      // always shown; the stored key stays stored, synced and readable, and nothing reads it for paint (CLAUDE.md 6.6).
    } else if (id === "notifications") {
      // ONE ROW, AND THAT IS THE WHOLE GROUP (owner, 2026-08-31: "a notifications tab would do
      // great"). The training-day email shipped inside FLASHCARDS in v1.105.7 — a tab about
      // daily goal, answer mode and study format, i.e. the last place anyone looks for an email
      // preference. It is the only notification the product sends, so this group is honestly
      // near-empty; do not pad it. When a second one exists it lands here beside the first.
      if (this.user) {
        // Signed-in only: a digest without an address has nowhere to go. Default OFF; flipping
        // it on starts recording the per-day dayLog (see noteCardDone) which syncs in the blob.
        // The KEY MUST STAY `emailDigest` — the digest Worker selects rows on
        // `neural->settings->>emailDigest=eq.true`, so renaming it here would read to every
        // opted-in user as a silent unsubscribe, with nothing anywhere going red.
        // NOT LIVE YET (NG_DIGEST_LIVE, app.src.jsx; owner U139 a): a signed-in player reaches this
        // row only with the setting already on, and the row says, in plain words, that nothing is
        // mailed. The sentence goes with the flag; flipped, the row reads as it did in v1.259.1.
        const wrap = document.createElement("div");
        wrap.setAttribute("data-digest-setting", "1");
        // THE ADDRESS IS MARKED (v1.261.2): the app's NG_NO_CAPTURE note (app.src.jsx) says why. `_addressMarkup` (eager, app.src.jsx)
        // puts it in its own `ph-no-capture` span, so the line around it stays readable to analytics and the replay records the address
        // as an empty box. It is built in the app, not here: this deferred set is at its ceiling, and the call is shorter than the address
        // expression it replaces.
        wrap.appendChild(this.settingRow("Training-day email", "After a day you reviewed something: your techniques, your Game Knowledge, your streak — mailed to " + this._addressMarkup() + "." + (NG_DIGEST_LIVE ? "" : " No email is being sent yet."),
          [["On", true], ["Off", false]], "emailDigest", false, null, true));
        const beta = document.createElement("span");
        beta.textContent = "Beta";
        beta.style.cssText = "position:absolute;top:20px;left:148px;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#9ab0e0;border:1px solid rgba(120,150,255,.35);border-radius:5px;padding:1px 6px;pointer-events:none;";
        wrap.style.position = "relative";
        wrap.appendChild(beta);
        sec.appendChild(wrap);
      } else {
        // an empty group reads as broken; a dead toggle reads as a lie. One line of why. Reached only
        // while the email is live (NG_DIGEST_LIVE): until then a guest gets no Email group, since
        // this line would send them to sign in for a switch that signing in does not offer.
        const note = document.createElement("div");
        note.setAttribute("data-notif-signedout", "1");
        note.style.cssText = "font-size:13px;line-height:1.6;color:#93a0bd;padding:4px 0;";
        note.textContent = "The training-day email needs a signed-in account — that’s where it would be sent. Sign in from the badge at the foot of the sidebar to turn it on.";
        sec.appendChild(note);
      }
    } else if (id === "rolling") {
      // THE OPPONENT (OFF1, v1.302.0; the owner's U218 b, 25 Nov 2026: "Two choices: Normal · Off (new)"). Two choice cards
      // (SETH4's pattern), Normal first and tagged Recommended, each with one honest line. "Off" is the no-opponent study the app
      // plays (`_studyRoll`, app.src.jsx); it used to be a weaker opponent (skill 0, misses and the opponent's turns kept). THE STORED
      // VALUE KEEPS ITS NAME: `difficulty` "off" / "normal", no new key and no migration (a settings key is never deleted or
      // renamed, CLAUDE.md §6.6), so a player who chose Off before plays the new Off from their next roll. Any other stored value
      // plays Normal, as the app has always read it, and shows Normal here.
      {
        const diff = this.get("difficulty", "normal") === "off" ? "off" : "normal";
        const r = words(el("div", "ng-set-row"), "Opponent", "Who answers your moves. A belt test always plays the opponent; a change starts with your next roll.");
        r.setAttribute("data-settings-opponent", diff);
        r.appendChild(choiceCards("opponent", "Opponent", NG_OPPONENT_MODES, diff, "data-opponent-pick",
          (v) => { this.set("difficulty", v); this.renderSettings(); }, ["normal", "Recommended"]));
        sec.appendChild(r);
      }
      // ── WHERE THE ROLL STARTS (v1.166.0) ── three pills from NG_START_FROM, all LIVE. The
      // note box describes the ACTIVE choice, the way the loss-aversion row does; under "My weak
      // spots" it also names the live spot — the crack and where the roll opens — read from the
      // SAME window the draw uses (`_weakStates`), never a second ranking (§6.5).
      const sf = words(el("div", "ng-set-row"), "Where the roll starts", "Where you and your opponent are when a new roll begins. Which side you play — top or bottom — is still drawn each time.");
      sf.setAttribute("data-settings-start", "1");
      const sseg = el("div", "ng-set-seg");
      const sfCur = this.startFrom();
      for (const [v, label] of NG_START_FROM) {
        const b = this.segBtn(label, v === sfCur, false, () => {
          this.set("startFrom", v);
          this.track("neural_start_from_set", { mode: v });
          this.renderSettings();
        });
        b.setAttribute("data-start-pick", v);
        sseg.appendChild(b);
      }
      sf.appendChild(sseg);
      const sfRow = NG_START_FROM.find((r) => r[0] === sfCur) || NG_START_FROM[1];
      const sfNote = el("div", "ng-set-cn");
      sfNote.setAttribute("data-start-note", sfRow[0]);
      sfNote.innerHTML = '<b style="color:#cbd4e6;">' + sfRow[1] + '</b> — ' + sfRow[2];
      if (sfCur === "weak") {
        // The live spot, in the player's words (no "FLOW", "gain", "tier", "kernel"): the CRACK
        // by name — a technique deck names the technique, a position deck the position — and the
        // state + seat the roll opens on. textContent, because the names come from the wire.
        const win = this._weakStates(this._posIdx || []);
        const live = document.createElement("div");
        live.setAttribute("data-start-now", "1");
        live.style.cssText = "margin-top:8px;color:#cbd4e6;";
        if (win.length) {
          const w0 = win[0];
          const side = /\|Attacker$/.test(w0.deck) ? "attacking" : /\|Defender$/.test(w0.deck) ? "defending" : w0.role;
          live.textContent = "Right now: " + w0.deck.split("|")[0] + " (" + side + ") — opens " + this.posFamily(this.nodes[w0.idx].t) + ", " + w0.role + ".";
        } else {
          live.textContent = "Until the model has your first drills, this opens Anywhere.";
        }
        sfNote.appendChild(live);
      }
      sf.appendChild(sfNote);
      sec.appendChild(sf);
      // HIDDEN MOVES (v1.255.0, owner U115-U116): the dealt row's names and films stay face down
      // until you look, and each look asks "Did you get it?". One boolean key, off by default
      // (a settings key can never be deleted, CLAUDE.md §6.6). Since v1.266.0 a move you know stays face up until it is
      // due again (owner, 13 Nov), and the line says so: it was "...are dealt face down: hover or tap...". v1.268.0 (KS2):
      // so does a move whose flashcards are all learned, which "Moves known" does not count, so the line names it apart
      // (it was "...except moves you know that are not due yet: ...").
      const hm = this.settingRow("Hide moves until I look", "Your moves and their threats are dealt face down, except moves you know or whose flashcards you have learned, until they are due: hover or tap a card to see it, then say if you got it.",
        [["On", true], ["Off", false]], "hideMoves", false, null, true);
      hm.setAttribute("data-settings-hide-moves", "1");
      sec.appendChild(hm);
      // "WINNING vs NOT LOSING" (v1.124.0) IS RETIRED (v1.207.0, owner, 2026-09-29). The full game's card
      // number is pure Win chance and the hand sorts once by it, so the dial only reordered the ~5 s
      // before values arrived and nudged the opponent's tie-breaks. The stored `lossAversion` key is
      // never read again and never deleted (CLAUDE.md §6.6); the wire ships the default block only.
      // WHAT EACH PLACE SHOWS DURING A ROLL: ONE ROW OF THREE (SETH2 B, v1.298.2; the owner, 23 Nov: "isnt 'Questions while you roll …'
      // a bit duplicate of 'Question card: Off = no card and no question. (Turning questions off above keeps the card.)'? or are they
      // diff things?"). They were different things whose copy had to explain the difference, which was the fault: "Questions while
      // you roll" (`landQuestions`) said whether a landing asks, and "Question card" (the `card` layer) whether the card is on screen
      // at all, two ticks for three states that matter and a fourth equal to the third. NG_ROLL_SHOWS is the one row; it READS the
      // two keys and WRITES them through the setters the two rows used (`set("landQuestions")`, `setLayer("card", …, "settings")`), so
      // sync, the card's own ✕ and its Undo stay in step. No key is added or removed (CLAUDE.md §6.6). "No card" leaves `landQuestions`
      // as it is, so the card coming back (Undo, the index row, this row) returns to the player's own choice; a pick that would not
      // change `landQuestions` does not write it. The order of the writes matters: the question key first, then the layer, because
      // turning the card on mid-landing builds it at once (`_applyLayers`) and reads the key then.
      // THE STATES THE ORCHESTRATOR'S SURVEY FOUND (renderLandCard): a defence drill asks whatever `landQuestions` says (`wantQ =
      // defense || …`), so "The card only" says so; with the card off the drill is skipped too (`panic_skipped`, "collapsed"). The film
      // is its own layer (the Video row under Articles), docked with or without the card, so the third choice is "No card", not
      // "Nothing", and its line says where the film is decided (the orchestrator's ruling: no third key written here).
      {
        const now = !this._layerOn("card") ? "none" : this.get("landQuestions", true) ? "question" : "card";
        const pick = (v) => {
          if (v !== "none" && this.get("landQuestions", true) !== (v === "question")) this.set("landQuestions", v === "question");
          this.setLayer("card", v !== "none", "settings");
          this.renderSettings();
        };
        const shows = el("div", "ng-set-row"); shows.append(el("div", "ng-set-t", "During a roll, each place shows"));
        shows.setAttribute("data-settings-shows", now); shows.setAttribute("data-layer-row", "card");
        shows.appendChild(choiceCards("shows", "During a roll, each place shows", NG_ROLL_SHOWS, now, "data-shows-pick", pick));
        sec.appendChild(shows);
      }
      // decision time pace
      const dt = el("div", "ng-set-row");
      const dsecBase = this.get("decisionSec", 9);
      dt.innerHTML =
        '<div class="ng-set-t" style="display:flex;align-items:baseline;justify-content:space-between;max-width:60ch;"><span>Answer time</span><span style="font-size:13px;font-weight:700;color:#9ab0e0;font-family:\'Space Grotesk\',sans-serif;"><span class="paceVal">' + dsecBase + '</span>s</span></div>' +
        '<div class="ng-set-h">How long a landing’s question stays open before its answer reveals itself — as a missed review. Your move is never on the clock.</div>';
      const range = el("div"); range.style.maxWidth = "60ch";
      const slider = el("input", "ng-set-range");
      slider.type = "range"; slider.min = "5"; slider.max = "15"; slider.step = "1"; slider.value = String(dsecBase); slider.setAttribute("aria-label", "Answer time, seconds");
      slider.addEventListener("input", () => { const v = parseInt(slider.value); this.set("decisionSec", v); const lab = dt.querySelector(".paceVal"); if (lab) lab.textContent = v; });
      range.appendChild(slider);
      range.appendChild(el("div", "ng-set-ticks", "<span>Brisk</span><span>Default</span><span>Relaxed</span>"));
      dt.appendChild(range);
      sec.appendChild(dt);
      // Permanent boolean key (per-key LWW; never delete it). Only the catch's
      // visual treatment changes; a live question keeps its timer and grading.
      const danger = this.settingRow("Danger animation",
        "Show pulsing red edges and card warnings when an opponent catches you. Turning this off keeps the drill and timer running.",
        [["On", true], ["Off", false]], "dangerAnimation", true, null, true);
      danger.setAttribute("data-danger-animation", "");
      sec.appendChild(danger);
      // ── THE BOTTOM LAYERS (v1.171.0) ── the same rows the ghost ✕ and the dock write,
      // here so the state is discoverable when every handle is collapsed. Same ✓ box as above.
      // THE FILM'S ROW LEFT FOR ARTICLES (SET1-GO 2): it wrote `readerSection.videos`, the Video section's own setting, so
      // two rows switched one thing; the Video row under Articles is now the one switch, and says it is the film too.
      const lay = el("div", "ng-set-sub", '<div>On screen during a roll</div><p>Each part has its own ✕ on the board, and this is where a hidden part comes back. Your choice sticks across states and devices.</p>');
      sec.appendChild(lay);
      // The card's own row left for "During a roll, each place shows" above (SETH2 B); the moves stay here alone.
      const LAYER_ROWS = [
        ["hand", "Your moves", "The hand of moves, escapes included. Off = the roll waits until you show them."],
      ];
      for (const [name, title, sub] of LAYER_ROWS) {
        const on = this._layerOn(name);
        const r = words(el("div", "ng-set-row side"), title, sub);
        r.setAttribute("data-layer-row", name);
        r.appendChild(tick(on, ["data-layer-toggle", name], () => { this.setLayer(name, !this._layerOn(name), "settings"); this.renderSettings(); }));
        sec.appendChild(r);
      }
    } else if (id === "reading") {
      // THE ARTICLE'S SECTIONS (SET1-GO: their own group, because an article is read with or without a roll). Two columns,
      // each whole row the target. VIDEO IS ALSO THE FILM DURING A ROLL (D-338 moved the film under the Video section's setting),
      // so its row is the one switch for both: it writes `readerSection.videos`, as the section box and the film's ✕ do, and
      // where no reader has been built yet it also writes `landFilm`, as the retired "Videos during play" row did then
      // (HIDESEC2; no key is added, §6.6). Turning it back on is the player's own input, so it settles a pinned landing (D-354 N2,
      // #372's review D2), as the section's own reopen does.
      const grid = el("div", "ng-set-arts");
      grid.setAttribute("data-section-settings", "");
      for (const [type, title] of SECTION_TYPES) {
        const row = document.createElement("label"), input = document.createElement("input");
        const video = type === "videos", film = video && !this._reader;
        input.type = "checkbox";
        input.checked = sectionShown(this, type) && (!film || this.get("landFilm", true) !== false);
        if (video) { const t = el("span"); t.append(document.createTextNode(title)); t.appendChild(el("span")).textContent = "also the film during a roll"; row.append(t); }
        else row.append(document.createTextNode(title));
        input.setAttribute("data-section-setting", type); input.setAttribute("aria-label", "Show " + title);
        input.addEventListener("change", () => {
          if (video && input.checked) this._readerGraded();
          this.set("readerSection." + type, input.checked);
          if (film) { this.set("landFilm", input.checked); this._applyLayers(); }
          this._reader?.sync();
        });
        row.append(input); grid.append(row);
      }
      sec.appendChild(grid);
    } else if (id === "app") {
      // uniform — the GI/NO-GI choice lives HERE and only here (v1.95.3, owner: the pane
      // tabs each carried a duplicate pill). Placement only: setGiMode is unchanged and
      // still re-filters techniques, lessons, checkpoints and odds everywhere. It is filed under General (SET1) because
      // it acts on every surface; its store is this device's `bjj_gi_mode`, not a settings key.
      const gv = words(el("div", "ng-set-row side"), "Uniform", "Gi or no-gi. Filters which techniques, lessons and odds the whole app uses.");
      const gseg = el("div", "ng-set-seg ng-set-ctl");
      gseg.setAttribute("data-settings-gi", "1");
      const giCur = this._giMode || "gi";
      gseg.appendChild(this.segBtn("Gi", giCur === "gi", false, () => { this.setGiMode("gi"); this.renderSettings(); }));
      gseg.appendChild(this.segBtn("No-gi", giCur === "nogi", false, () => { this.setGiMode("nogi"); this.renderSettings(); }));
      gv.appendChild(gseg);
      sec.appendChild(gv);
      sec.appendChild(this.settingRow("Sound", "Synthesized feedback on every gameplay beat.",
        [["On", "on"], ["Off", "off"]], "sound", "on", null, true));
      const vol = this.settingRow("Sound volume", "How loud the beats land.",
        [["Quiet", "0.25"], ["Normal", "0.5"], ["Loud", "0.8"]], "soundVolume", "0.5", null, true);
      vol.setAttribute("class", vol.getAttribute("class") + " stack");
      sec.appendChild(vol);
      // (the "Option ordering" row was RETIRED in v1.122.0, owner's decision. It offered
      // Potential / Popularity; `orderScore` forked on it but `edgeMark` did not, so choosing
      // Popularity re-ranked the hand while every card still printed EDGE — measured, 211 of the
      // 270 live hands printed their corner integers OUT of descending order, one click from the
      // default. And the control was over almost nothing: across those same 270 hands the setting
      // changed the dealt SET in 16, while re-ordering 223 of them. `cardOrder` is now DORMANT —
      // written by no one, read by no one, and deliberately NOT pruned from stored blobs; see the
      // tombstone on orderScore for why a settings key cannot be deleted at all.)
    } else if (id === "modifiers") {
      const host = el("div", "ng-set-row ng-set-mods");
      sec.appendChild(host);
      this.buildModifiers(host);
    } else if (id === "shortcuts") {
      const rows = [
        ["Answer a multiple-choice question", ["A", "B", "C"]],
        ["Execute option", ["1–9"]],
        ["Choose the focused move or open its video", ["Tab", "⏎"]],
        // THE FLASHCARD ROWS COVER ALL FOUR DECK SURFACES (v1.175.0): the study takeover, the
        // roll history's inline decks, the inline session queue and — new here — the Challenges
        // corridor's lesson decks. One vocabulary, because there is one handler and one
        // `_miniReg` behind them; the legend is the only place these are documented, so a row
        // that is not true of every one of the four does not belong in it.
        ["Flashcards: prev / next card", ["←", "→"]],
        ["Flashcards: prev / next technique", ["↑", "↓"]],
        ["Flashcards: flip the card", ["Space"]],
        ["Flashcards: got it, next card", ["⏎"]],
        ["Flashcards: review again", ["↑"]],
        ["Landing card: prev / next question", ["←", "→"]],
        ["Open / search explorer", ["/", "⌘K"]],
        ["Close detail / explorer / flashcards", ["Esc"]],
        ["Pan the graph", ["Drag"]],
        ["Zoom the graph", ["Scroll"]],
      ];
      const wrap = el("div", "ng-set-keys");
      for (const [label, keys] of rows) {
        const kb = keys.map((k) => '<kbd style="font-family:inherit;font-size:11.5px;font-weight:600;color:#cbd4e6;background:rgba(255,255,255,.06);border:1px solid rgba(150,170,210,.22);border-bottom-width:2px;border-radius:6px;padding:3px 8px;">' + k + '</kbd>').join('<span style="color:#6b7691;font-size:11px;margin:0 4px;">or</span>');
        wrap.appendChild(el("div", "", '<span>' + label + '</span><span style="display:flex;align-items:center;">' + kb + '</span>'));
      }
      sec.appendChild(wrap);
    }
    }
    this._settingsTabRow(nav, tab, refocus, tabs, body);
    if (radio) { const r = body.querySelector('[data-choices="' + radio + '"] [aria-checked="true"]'); if (r) r.focus({ preventScroll: true }); }
    // A new opening starts at its group (the first group is the top); a redraw keeps the panel where it was.
    if (fresh) { if (tab !== tabs[0][0]) this._settingsJump(tab, false); } else body.scrollTop = panelY;
    // HIDESEC2: a closed part's message (reader.src.js notice) opens Settings here, at that part's own switch: scrolled to the middle,
    // focused and outlined. Read once, so the redraw a toggle makes does not jump back. The video's is the Video row under Articles
    // (SET1-GO 2); the moves' and the question card's are under Rolling.
    const aim = this._settingsAim; this._settingsAim = null;
    // The card's switch is the chosen choice of "During a roll, each place shows" (SETH2 B): after its ✕ that is "No card", focused, so the
    // player picks the way it comes back.
    const aimed = aim && (body.querySelector('[data-layer-toggle="' + aim + '"]') || body.querySelector('[data-section-setting="' + aim + '"]')
      || aim === "card" && body.querySelector('[data-settings-shows] [data-shows-pick="' + body.querySelector("[data-settings-shows]").getAttribute("data-settings-shows") + '"]'));
    if (aimed) requestAnimationFrame(() => {
      const row = aimed.closest("[data-layer-row],label");
      row.setAttribute("data-settings-aimed", "");
      row.style.outline = "2px solid rgba(110,160,255,.7)"; row.style.outlineOffset = "4px"; row.style.borderRadius = "8px";
      aimed.scrollIntoView({ block: "center" }); aimed.focus({ preventScroll: true });
    });
    // legal links live HERE too (v1.93.0): the first Settings overlay carries Terms · Privacy,
    // so the account surface never needs a "Learn More" submenu (Shortcuts is already a tab).
    const legal = el("div", "ng-set-foot");
    legal.setAttribute("data-settings-legal", "1");
    const mkLegal = (label, kind) => {
      const a = document.createElement("button");
      a.type = "button";
      a.setAttribute("data-legal", kind);
      a.textContent = label;
      a.style.cssText = "cursor:pointer;font-family:inherit;border:none;background:transparent;font-size:11px;color:#5d6883;letter-spacing:.02em;padding:0 8px;min-height:44px;";
      a.addEventListener("mouseenter", () => a.style.color = "#9aa6bd");
      a.addEventListener("mouseleave", () => a.style.color = "#5d6883");
      a.addEventListener("click", () => this.openLegal(kind));
      return a;
    };
    legal.appendChild(mkLegal("Terms", "terms"));
    const dot = document.createElement("span");
    dot.style.cssText = "width:3px;height:3px;border-radius:50%;background:#3c4358;";
    legal.appendChild(dot);
    legal.appendChild(mkLegal("Privacy", "privacy"));
    card.appendChild(legal);
  },
// A ROW OF CHOICES: its title, its help, its buttons, and the note for the chosen one. `side` puts the buttons beside the
// words (two or three short choices); otherwise they sit under them. The title and the help stay the row's first two children.
settingRow(title, sub, options, key, def, notes, side) {
    const wrap = words(el("div", "ng-set-row" + (side ? " side" : "")), title, sub);
    const seg = el("div", "ng-set-seg" + (side ? " ng-set-ctl" : ""));
    const curr = this.get(key, def);
    options.forEach(([lab, v]) => seg.appendChild(this.segBtn(lab, curr === v, false, () => { this.set(key, v); this.renderSettings(); })));
    wrap.appendChild(seg);
    if (notes && notes[curr]) {
      const nt = el("div", "ng-set-cn ng-set-wide");
      nt.innerHTML = notes[curr];
      wrap.appendChild(nt);
    }
    return wrap;
  }
  };
  target._renderSettingsPresentation = methods.renderSettings;
  target._settingsTabRow = methods._settingsTabRow;
  target.settingRow = methods.settingRow;
}
