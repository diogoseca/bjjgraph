// Only the Settings presentation moves here. All persisted settings, setting effects,
// gameplay laws, owner/auth control and general modal primitives remain eager.
// Build identity is injected by build.mjs and verified before any instance is changed.
export const NG_SETTINGS_PRESENTATION_BUILD = NG_SETTINGS_UI_BUILD;
export function ngInstallSettingsPresentation(target, dependencies) {
  if (dependencies.expectedBuild !== NG_SETTINGS_PRESENTATION_BUILD) throw new Error("Settings presentation version mismatch");
  const { NG_SETTINGS_TABS, NG_START_FROM } = dependencies;
  const methods = {
_settingsTabRow(row, tab, refocus) {
    const go = (id) => { if (id !== this._settingsTab) { this._settingsTab = id; this.renderSettings(); } };
    row.addEventListener("click", (e) => { const b = e.target.closest("[data-settings-tab]"); if (b) go(b.getAttribute("data-settings-tab")); });
    row.addEventListener("keydown", (e) => {
      const n = NG_SETTINGS_TABS.length, at = NG_SETTINGS_TABS.findIndex((t) => t[0] === tab);
      const to = { ArrowRight: at + 1, ArrowLeft: at + n - 1, Home: 0, End: n - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault(); e.stopPropagation(); go(NG_SETTINGS_TABS[to % n][0]);
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
    const on = row.querySelector('[aria-selected="true"]'), x0 = this._settingsRowX;
    const mid = on ? on.offsetLeft + on.offsetWidth / 2 - row.clientWidth / 2 : 0;
    row.scrollLeft = x0 == null ? mid : x0;
    if (x0 != null && this._settingsRowTab !== tab) row.scrollTo({ left: mid, behavior: this._reducedMotion() ? "auto" : "smooth" });
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
    card.style.width = "min(440px,92vw)";
    const tab = this._settingsTab || "flashcards";
    // Every change re-renders the whole card, so a tab that HAS focus (an arrow key, or the click
    // that just chose it) is destroyed under the user. Remember that, before the wipe blurs it,
    // and hand focus to the new active tab below; otherwise the second arrow press lands on <body>.
    const ae = document.activeElement, refocus = !!(ae && card.contains(ae) && ae.getAttribute("role") === "tab");
    card.innerHTML = "";
    const head = document.createElement("div");
    head.style.cssText = "padding:20px 22px 0;";
    head.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;"><div style="font-size:20px;font-weight:700;color:#eef1f6;letter-spacing:-.01em;">Settings</div><span class="x" style="cursor:pointer;color:#8b97b0;font-size:20px;">&times;</span></div>' +
      // owner-requested disclaimer — first thing the user reads when opening settings
      '<div style="margin-top:14px;padding:11px 13px;border:1px solid rgba(232,184,107,.28);border-radius:10px;background:rgba(232,168,90,.08);display:flex;gap:9px;align-items:flex-start;">' +
        '<span style="flex:none;font-size:13px;line-height:1.4;">⚠️</span>' +
        '<span style="font-size:12px;line-height:1.5;color:#e8c9a0;">BJJ Graph is still being actively built — the success rates and probabilities you see are being continuously fine-tuned and will keep improving.</span>' +
      '</div>' +
      // THE TAB ROW (v1.196.1): one declared list, real tabs. The wrapper keeps the content width
      // and carries the hairline; the row inside it scrolls, takes the fade and pads its hit boxes
      // past the labels (helmet.html `.ng-stabs`). The mask would fade a hairline drawn on the row
      // itself, so the line lives one level up.
      '<div style="margin-top:2px;border-bottom:1px solid rgba(150,170,210,.12);"><div class="ng-stabs" role="tablist" aria-label="Settings sections" data-settings-tabs>' +
        NG_SETTINGS_TABS.map(([id, label]) => '<button type="button" role="tab" class="ng-stab" id="ng-stab-' + id + '" data-settings-tab="' + id + '" aria-controls="ng-stab-panel" aria-selected="' + (id === tab) + '" tabindex="' + (id === tab ? 0 : -1) + '" style="pointer-events:auto;"><span>' + label + '</span></button>').join("") +
      '</div></div>';
    head.querySelector(".x").addEventListener("click", () => this.closeModal());
    card.appendChild(head);
    this._settingsTabRow(head.querySelector("[data-settings-tabs]"), tab, refocus);

    const body = document.createElement("div");
    body.id = "ng-stab-panel"; body.setAttribute("role", "tabpanel"); body.setAttribute("aria-labelledby", "ng-stab-" + tab);
    body.style.cssText = "padding:18px 22px 22px;overflow-y:auto;max-height:min(64vh,560px);";
    if (tab === "flashcards") {
      // daily goal
      const g = document.createElement("div");
      g.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px;";
      // CARDS, NOT TECHNIQUES (v1.138.0). The budget is spent on what is DUE first and only the
      // remainder buys new techniques (newTechniques) — maintenance is the debt, new is the
      // throttle. Anki pairs 20 new/day with a 200 reviews/day cap for the same reason:
      // steady-state reviews land near 10x daily new, so 30 cards supports ~3 new cards a day.
      g.innerHTML = '<div><div style="font-size:14px;font-weight:600;color:#eef1f6;">Daily goal</div><div style="font-size:12px;color:#93a0bd;margin-top:3px;">Cards a day. What\u2019s due comes first; the rest buys new techniques.</div></div>';
      const inp = document.createElement("input");
      inp.type = "number"; inp.value = this.get("dailyGoal", 30); inp.min = "5"; inp.max = "200";
      inp.style.cssText = "width:74px;font-family:inherit;font-size:14px;font-weight:600;color:#eef1f6;background:rgba(255,255,255,.04);border:1px solid rgba(150,170,210,.25);border-radius:9px;padding:9px 11px;text-align:center;";
      inp.addEventListener("change", () => { this.set("dailyGoal", Math.max(5, Math.min(200, parseInt(inp.value) || 30))); inp.value = this.get("dailyGoal", 30); });
      g.appendChild(inp); body.appendChild(g);
      // study order
      body.appendChild(this.settingRow("Answer mode", "How cards read back HERE. Questions asked in-roll are always multiple choice \u2014 this sidebar is the study surface, so it reads back as recall unless you say otherwise.",
        [["Classic recall", "classic"], ["Auto", "auto"], ["Multiple choice", "mc"]], "mcMode", "classic"));
      // (the training-day email row moved to the Notifications tab in v1.150.0)
      // RECALL MODE — the black-belt badge's toggle (v1.105.1). LOCKED until the WORN belt is
      // black (v1.209.0 — proven units, never a Game Knowledge band); auto-flipped ON when the
      // badge mints; freely flippable back. When on, a stage-2+ card in PLAY renders as
      // reveal/self-grade instead of multiple choice.
      {
        const isBlack = (() => { try { return this.wornBelt().id === "black"; } catch (e) { return false; } })();
        const hasBadge = !!(this.badges && this.badges["recall-in-play"]);
        if (isBlack || hasBadge) {
          body.appendChild(this.settingRow("Recall mode (in play)", "The black-belt reward: proven cards stop being multiple choice mid-roll \u2014 question, reveal, self-grade.",
            [["On", true], ["Off", false]], "recallInPlay", false));
        } else {
          const locked = document.createElement("div");
          locked.setAttribute("data-recall-locked", "1");
          locked.style.cssText = "opacity:.55;padding:12px 0;border-top:1px solid rgba(150,170,210,.1);";
          locked.innerHTML = '<div style="font-size:13px;font-weight:600;color:#c3cde0;display:flex;align-items:center;gap:7px;">Recall mode (in play) <span style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#8b97b0;border:1px solid rgba(150,170,210,.3);border-radius:5px;padding:2px 6px;">Locked</span></div>' +
            '<div style="font-size:11px;color:#7e8aa3;margin-top:3px;line-height:1.5;">Unlocks at black belt \u2014 the elite format: no options, just the question and your memory.</div>';
          body.appendChild(locked);
        }
      }
      // (the dead "Study order" setting row was deleted in v1.105.0 — `studyOrder` was written but read nowhere; due-first is now BEHAVIOUR, not a preference)
      // focus
      body.appendChild(this.settingRow("Focus", "Shore up weaknesses, or sharpen strengths",
        [["Antifragile", "antifragile"], ["Converge", "converge"]], "focus", "antifragile",
        { antifragile: '<b style="color:#cbd4e6;">Antifragile</b> &mdash; a solid, well-rounded game. Surfaces cards from the spots you\u2019re weakest, so you have no holes to be exploited.',
          converge: '<b style="color:#cbd4e6;">Converge</b> &mdash; competition focus. Builds the most effective gameplan from your strongest modifiers, steering rolls toward the states you finish from.' }));
      // toggle
      const tg = document.createElement("div");
      tg.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:20px;";
      tg.innerHTML = '<div><div style="font-size:14px;font-weight:600;color:#eef1f6;">Show flashcards on pages</div><div style="font-size:12px;color:#93a0bd;margin-top:3px;">Display a quiz pill on each technique</div></div>';
      const cb = document.createElement("button");
      const on = this.get("quizOnPages", true);
      cb.innerHTML = on ? "\u2713" : "";
      cb.style.cssText = "width:24px;height:24px;border-radius:7px;cursor:pointer;border:1px solid " + (on ? "rgba(110,160,255,.6)" : "rgba(150,170,210,.3)") + ";background:" + (on ? "rgba(74,108,255,.4)" : "transparent") + ";color:#fff;font-size:13px;font-weight:700;";
      cb.addEventListener("click", () => { this.set("quizOnPages", !this.get("quizOnPages", true)); this.renderSettings(); });
      tg.appendChild(cb); body.appendChild(tg);
    } else if (tab === "notifications") {
      // ONE ROW, AND THAT IS THE WHOLE TAB (owner, 2026-08-31: "a notifications tab would do
      // great"). The training-day email shipped inside FLASHCARDS in v1.105.7 — a tab about
      // daily goal, answer mode and study format, i.e. the last place anyone looks for an email
      // preference. It is the only notification the product sends, so this tab is honestly
      // near-empty; do not pad it. When a second one exists it lands here beside the first.
      if (this.user) {
        // Signed-in only: a digest without an address has nowhere to go. Default OFF; flipping
        // it on starts recording the per-day dayLog (see noteCardDone) which syncs in the blob.
        // The KEY MUST STAY `emailDigest` — the digest Worker selects rows on
        // `neural->settings->>emailDigest=eq.true`, so renaming it here would read to every
        // opted-in user as a silent unsubscribe, with nothing anywhere going red.
        const wrap = document.createElement("div");
        wrap.setAttribute("data-digest-setting", "1");
        wrap.appendChild(this.settingRow("Training-day email", "After a day you reviewed something: your techniques, your Game Knowledge, your streak \u2014 mailed to " + (this.user.email || "your account email") + ".",
          [["On", true], ["Off", false]], "emailDigest", false));
        const beta = document.createElement("span");
        beta.textContent = "Beta";
        beta.style.cssText = "position:relative;top:-44px;left:150px;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#9ab0e0;border:1px solid rgba(120,150,255,.35);border-radius:5px;padding:1px 6px;pointer-events:none;";
        wrap.style.position = "relative";
        wrap.appendChild(beta);
        body.appendChild(wrap);
      } else {
        // an empty tab reads as broken; a dead toggle reads as a lie. One line of why.
        const note = document.createElement("div");
        note.setAttribute("data-notif-signedout", "1");
        note.style.cssText = "font-size:12.5px;line-height:1.6;color:#93a0bd;padding:2px 0 4px;";
        note.textContent = "The training-day email needs a signed-in account \u2014 that\u2019s where it would be sent. Sign in from the account menu to turn it on.";
        body.appendChild(note);
      }
    } else if (tab === "rolling") {
      const r = document.createElement("div");
      r.innerHTML = '<div style="font-size:15px;font-weight:600;color:#eef1f6;">Rolling simulation</div><div style="font-size:12.5px;color:#93a0bd;margin-top:5px;line-height:1.5;margin-bottom:16px;">When you pick a move, a dice-roll plays out against an AI opponent &mdash; success depends on the move\u2019s win % (boosted by your mastery).</div>';
      body.appendChild(r);
      const seg = document.createElement("div");
      seg.style.cssText = "display:flex;gap:9px;flex-wrap:wrap;margin-bottom:22px;";
      const diff = this.get("difficulty", "normal");
      seg.appendChild(this.segBtn("Off", diff === "off", false, () => { this.set("difficulty", "off"); this.renderSettings(); }));
      seg.appendChild(this.segBtn("Normal", diff === "normal", false, () => { this.set("difficulty", "normal"); this.renderSettings(); }));
      body.appendChild(seg);
      const dnote = document.createElement("div");
      dnote.style.cssText = "font-size:11px;color:#69748f;line-height:1.5;margin:-14px 0 22px;";
      dnote.textContent = "Harder opponents arrive with the ladder \u2014 Normal is the calibrated one.";
      body.appendChild(dnote);
      // ── WHERE THE ROLL STARTS (v1.166.0) ── three pills from NG_START_FROM, all LIVE. The
      // note box describes the ACTIVE choice, the way the loss-aversion row does; under "My weak
      // spots" it also names the live spot — the crack and where the roll opens — read from the
      // SAME window the draw uses (`_weakStates`), never a second ranking (§6.5).
      const sf = document.createElement("div");
      sf.style.cssText = "border-top:1px solid rgba(150,170,210,.12);padding-top:16px;margin-bottom:18px;";
      sf.setAttribute("data-settings-start", "1");
      sf.innerHTML = '<div style="font-size:14px;font-weight:600;color:#eef1f6;">Where the roll starts</div><div style="font-size:12.5px;color:#93a0bd;margin-top:4px;line-height:1.5;">Where you and your opponent are when a new roll begins. Which side you play \u2014 top or bottom \u2014 is still drawn each time.</div>';
      const sseg = document.createElement("div");
      sseg.style.cssText = "display:flex;gap:9px;flex-wrap:wrap;margin-top:12px;";
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
      const sfNote = document.createElement("div");
      sfNote.setAttribute("data-start-note", sfRow[0]);
      sfNote.style.cssText = "font-size:12px;color:#93a0bd;line-height:1.5;margin-top:11px;padding:9px 11px;background:rgba(255,255,255,.03);border:1px solid rgba(150,170,210,.12);border-radius:9px;";
      sfNote.innerHTML = '<b style="color:#cbd4e6;">' + sfRow[1] + '</b> \u2014 ' + sfRow[2];
      if (sfCur === "weak") {
        // The live spot, in the player's words (no "FLOW", "gain", "tier", "kernel"): the CRACK
        // by name — a technique deck names the technique, a position deck the position — and the
        // state + seat the roll opens on. textContent, because the names come from the wire.
        const win = this._weakStates(this._posIdx || []);
        const live = document.createElement("div");
        live.setAttribute("data-start-now", "1");
        live.style.cssText = "margin-top:7px;color:#cbd4e6;";
        if (win.length) {
          const w0 = win[0];
          const side = /\|Attacker$/.test(w0.deck) ? "attacking" : /\|Defender$/.test(w0.deck) ? "defending" : w0.role;
          live.textContent = "Right now: " + w0.deck.split("|")[0] + " (" + side + ") \u2014 opens " + this.posFamily(this.nodes[w0.idx].t) + ", " + w0.role + ".";
        } else {
          live.textContent = "Until the model has your first drills, this opens Anywhere.";
        }
        sfNote.appendChild(live);
      }
      sf.appendChild(sfNote);
      body.appendChild(sf);
      // uniform — the GI/NO-GI choice lives HERE and only here (v1.95.3, owner: the pane
      // tabs each carried a duplicate pill). Placement only: setGiMode is unchanged and
      // still re-filters techniques, lessons, checkpoints and odds everywhere.
      const gv = document.createElement("div");
      gv.style.cssText = "border-top:1px solid rgba(150,170,210,.12);padding-top:16px;margin-bottom:18px;";
      gv.innerHTML = '<div style="font-size:14px;font-weight:600;color:#eef1f6;">Uniform</div><div style="font-size:12.5px;color:#93a0bd;margin-top:4px;line-height:1.5;">Gi or no-gi. Filters which techniques, lessons and odds the whole app uses.</div>';
      const gseg = document.createElement("div");
      gseg.style.cssText = "display:flex;gap:9px;margin-top:12px;";
      gseg.setAttribute("data-settings-gi", "1");
      const giCur = this._giMode || "gi";
      gseg.appendChild(this.segBtn("Gi", giCur === "gi", false, () => { this.setGiMode("gi"); this.renderSettings(); }));
      gseg.appendChild(this.segBtn("No-gi", giCur === "nogi", false, () => { this.setGiMode("nogi"); this.renderSettings(); }));
      gv.appendChild(gseg);
      body.appendChild(gv);
      // "WINNING vs NOT LOSING" (v1.124.0) IS RETIRED (v1.207.0, owner, 2026-09-29). The full game's card
      // number is pure Win chance and the hand sorts once by it, so the dial only reordered the ~5 s
      // before values arrived and nudged the opponent's tie-breaks. The stored `lossAversion` key is
      // never read again and never deleted (CLAUDE.md §6.6); the wire ships the default block only.
      // decision time pace
      const dt = document.createElement("div");
      dt.style.cssText = "border-top:1px solid rgba(150,170,210,.12);padding-top:16px;margin-bottom:18px;";
      const dsecBase = this.get("decisionSec", 9);
      dt.innerHTML =
        '<div style="display:flex;align-items:baseline;justify-content:space-between;"><div style="font-size:14px;font-weight:600;color:#eef1f6;">Answer time</div><div style="font-size:13px;font-weight:700;color:#9ab0e0;font-family:\'Space Grotesk\',sans-serif;"><span class="paceVal">' + dsecBase + '</span>s</div></div>' +
        '<div style="font-size:12.5px;color:#93a0bd;margin-top:4px;line-height:1.5;">How long a landing\u2019s question stays open before its answer reveals itself \u2014 as a missed review. Your move is never on the clock.</div>';
      const slider = document.createElement("input");
      slider.type = "range"; slider.min = "5"; slider.max = "15"; slider.step = "1"; slider.value = String(dsecBase);
      slider.style.cssText = "width:100%;margin-top:13px;accent-color:#5b8cff;cursor:pointer;";
      slider.addEventListener("input", () => { const v = parseInt(slider.value); this.set("decisionSec", v); const lab = dt.querySelector(".paceVal"); if (lab) lab.textContent = v; });
      dt.appendChild(slider);
      const ticks = document.createElement("div");
      ticks.style.cssText = "display:flex;justify-content:space-between;font-size:10px;color:#6b7691;font-weight:600;margin-top:2px;";
      ticks.innerHTML = "<span>Brisk</span><span>Default</span><span>Relaxed</span>";
      dt.appendChild(ticks);
      body.appendChild(dt);
      // landing questions — the in-roll quiz beat
      const lq = document.createElement("div");
      lq.style.cssText = "display:flex;align-items:flex-start;justify-content:space-between;gap:16px;border-top:1px solid rgba(150,170,210,.12);padding-top:16px;margin-bottom:18px;";
      lq.innerHTML = '<div><div style="font-size:14px;font-weight:600;color:#eef1f6;">Questions while you roll</div><div style="font-size:12.5px;color:#93a0bd;margin-top:4px;line-height:1.5;">Every state you land on asks one multiple-choice question (keys <b style="color:#c3cde0;">A–C</b>). Right answers raise that exchange’s odds and refund clock; wrong ones cost odds for that exchange only. String rights together across states to build <b style="color:#c3cde0;">combos</b> — momentum that heats your whole hand and makes counters fade. Wrong or ignored breaks it.</div></div>';
      const lqb = document.createElement("button");
      const lqOn = this.get("landQuestions", true);
      lqb.innerHTML = lqOn ? "✓" : "";
      lqb.style.cssText = "flex:none;margin-top:2px;width:24px;height:24px;border-radius:7px;cursor:pointer;border:1px solid " + (lqOn ? "rgba(110,160,255,.6)" : "rgba(150,170,210,.3)") + ";background:" + (lqOn ? "rgba(74,108,255,.4)" : "transparent") + ";color:#fff;font-size:13px;font-weight:700;";
      lqb.addEventListener("click", () => { this.set("landQuestions", !this.get("landQuestions", true)); this.renderSettings(); });
      lq.appendChild(lqb); body.appendChild(lq);
      // ── THE THREE BOTTOM LAYERS (v1.171.0) ── the same rows the ghost ✕ and the dock write,
      // here so the state is discoverable when every handle is collapsed. Same ✓ box as above.
      const lay = document.createElement("div");
      lay.style.cssText = "border-top:1px solid rgba(150,170,210,.12);padding-top:16px;margin-bottom:18px;";
      lay.innerHTML = '<div style="font-size:14px;font-weight:600;color:#eef1f6;">Bottom of the screen</div><div style="font-size:12.5px;color:#93a0bd;margin-top:4px;line-height:1.5;">Each row has its own ✕ on the board; the small glyphs at the bottom bring one back. Your choice sticks across states and devices.</div>';
      const LAYER_ROWS = [
        ["film", "Videos", "The film row above the card."],
        ["card", "Question card", "Off = no card and no question. (Turning questions off above keeps the card.)"],
        ["hand", "Your moves", "The hand of moves, escapes included. Off = the roll waits until you show them."],
      ];
      for (const [name, title, sub] of LAYER_ROWS) {
        const on = this._layerOn(name);
        const r = document.createElement("div");
        r.setAttribute("data-layer-row", name);
        r.style.cssText = "display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-top:12px;";
        r.innerHTML = '<div><div style="font-size:13px;font-weight:600;color:#dfe5f1;">' + title + '</div><div style="font-size:12px;color:#93a0bd;margin-top:2px;line-height:1.5;">' + sub + '</div></div>';
        const rb = document.createElement("button");
        rb.setAttribute("data-layer-toggle", name);
        rb.setAttribute("aria-pressed", on ? "true" : "false");
        rb.innerHTML = on ? "✓" : "";
        rb.style.cssText = "flex:none;margin-top:2px;width:24px;height:24px;border-radius:7px;cursor:pointer;border:1px solid " + (on ? "rgba(110,160,255,.6)" : "rgba(150,170,210,.3)") + ";background:" + (on ? "rgba(74,108,255,.4)" : "transparent") + ";color:#fff;font-size:13px;font-weight:700;";
        rb.addEventListener("click", () => { this.setLayer(name, !this._layerOn(name), "settings"); this.renderSettings(); });
        r.appendChild(rb); lay.appendChild(r);
      }
      body.appendChild(lay);
      body.appendChild(this.settingRow("Sound", "Synthesized feedback on every gameplay beat",
        [["On", "on"], ["Off", "off"]], "sound", "on"));
      body.appendChild(this.settingRow("Sound volume", "How loud the beats land",
        [["Quiet", "0.25"], ["Normal", "0.5"], ["Loud", "0.8"]], "soundVolume", "0.5"));
      // (the "Option ordering" row was RETIRED in v1.122.0, owner's decision. It offered
      // Potential / Popularity; `orderScore` forked on it but `edgeMark` did not, so choosing
      // Popularity re-ranked the hand while every card still printed EDGE — measured, 211 of the
      // 270 live hands printed their corner integers OUT of descending order, one click from the
      // default. And the control was over almost nothing: across those same 270 hands the setting
      // changed the dealt SET in 16, while re-ordering 223 of them. `cardOrder` is now DORMANT —
      // written by no one, read by no one, and deliberately NOT pruned from stored blobs; see the
      // tombstone on orderScore for why a settings key cannot be deleted at all.)
    } else if (tab === "modifiers") {
      this.buildModifiers(body);
    } else {
      const rows = [
        ["Answer a multiple-choice question", ["A", "B", "C"]],
        ["Execute option", ["1\u20139"]],
        ["Inspect option", ["Shift + 1\u20139"]],
        ["Execute from detail", ["\u23ce", "X"]],
        // THE FLASHCARD ROWS COVER ALL FOUR DECK SURFACES (v1.175.0): the study takeover, the
        // roll history's inline decks, the inline session queue and — new here — the Challenges
        // corridor's lesson decks. One vocabulary, because there is one handler and one
        // `_miniReg` behind them; the legend is the only place these are documented, so a row
        // that is not true of every one of the four does not belong in it.
        ["Flashcards: prev / next card", ["\u2190", "\u2192"]],
        ["Flashcards: prev / next technique", ["\u2191", "\u2193"]],
        ["Flashcards: flip the card", ["Space"]],
        ["Flashcards: got it, next card", ["\u23ce"]],
        ["Flashcards: review again", ["\u2191"]],
        ["Landing card: prev / next question", ["\u2190", "\u2192"]],
        ["Open / search explorer", ["/", "\u2318K"]],
        ["Close detail / explorer / flashcards", ["Esc"]],
        ["Pan the graph", ["Drag"]],
        ["Zoom the graph", ["Scroll"]],
      ];
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;flex-direction:column;gap:2px;";
      for (const [label, keys] of rows) {
        const r = document.createElement("div");
        r.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 2px;border-bottom:1px solid rgba(150,170,210,.08);";
        const kb = keys.map((k) => '<kbd style="font-family:inherit;font-size:11.5px;font-weight:600;color:#cbd4e6;background:rgba(255,255,255,.06);border:1px solid rgba(150,170,210,.22);border-bottom-width:2px;border-radius:6px;padding:3px 8px;">' + k + '</kbd>').join('<span style="color:#6b7691;font-size:11px;margin:0 5px;">or</span>');
        r.innerHTML = '<span style="font-size:13.5px;color:#dbe2f0;">' + label + '</span><span style="display:flex;align-items:center;">' + kb + '</span>';
        wrap.appendChild(r);
      }
      body.appendChild(wrap);
    }
    card.appendChild(body);
    // legal links live HERE too (v1.93.0): the first Settings overlay carries Terms · Privacy,
    // so the account surface never needs a "Learn More" submenu (Shortcuts is already a tab).
    const legal = document.createElement("div");
    legal.setAttribute("data-settings-legal", "1");
    legal.style.cssText = "display:flex;justify-content:center;align-items:center;gap:14px;padding:10px 22px 14px;border-top:1px solid rgba(150,170,210,.1);";
    const mkLegal = (label, kind) => {
      const a = document.createElement("button");
      a.type = "button";
      a.setAttribute("data-legal", kind);
      a.textContent = label;
      a.style.cssText = "cursor:pointer;font-family:inherit;border:none;background:transparent;font-size:10.5px;color:#5d6883;letter-spacing:.02em;padding:8px 6px;min-height:32px;";
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
settingRow(title, sub, options, key, def, notes) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "margin-bottom:20px;";
    wrap.innerHTML = '<div style="font-size:14px;font-weight:600;color:#eef1f6;">' + title + '</div><div style="font-size:12px;color:#93a0bd;margin-top:3px;margin-bottom:11px;">' + sub + '</div>';
    const seg = document.createElement("div");
    seg.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
    const curr = this.get(key, def);
    options.forEach(([lab, v]) => seg.appendChild(this.segBtn(lab, curr === v, false, () => { this.set(key, v); this.renderSettings(); })));
    wrap.appendChild(seg);
    if (notes && notes[curr]) {
      const nt = document.createElement("div");
      nt.style.cssText = "font-size:12px;color:#93a0bd;line-height:1.5;margin-top:10px;padding:9px 11px;background:rgba(255,255,255,.03);border:1px solid rgba(150,170,210,.12);border-radius:9px;";
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
