const NG_CHALLENGE_TRACK_COLORS = Object.freeze({
  white: "#d8dde8",
  blue: "#78a2f5",
  purple: "#b38bdd",
  brown: "#bd8a68",
  black: "#8d929f",
});

function ngChallengeHTML(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function ngTrackName(track) {
  return track ? track.name : "White Foundations";
}

// hex -> rgba() — belt tints for corridor headers and lesson-row category edges
function ngChallengeTint(hex, alpha) {
  const h = String(hex || "").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
}

// ladder headers speak plain belts (owner, v1.96.0): "White belt", never
// "White Foundations · WHITE CONTENT TRACK". Track ids and data names are unchanged.
function ngBeltDisplayName(trackId) {
  return trackId.charAt(0).toUpperCase() + trackId.slice(1) + " belt";
}

// lesson-row category palette — the same Position/Transition/Submission colors the
// Explore list and the dossier already speak
const NG_LESSON_CAT_COLORS = Object.freeze({
  position: "#c9d2e3",
  transition: "#9fb0d8",
  submission: "#e8956b",
});

const NG_CHALLENGE_UI_METHODS = {
  // ── the score belt as a VISUAL is retired (v1.98.1, owner: "we should no longer see
  // this") — the header mount died in v1.96.0, the Explore mount died here. The renderer
  // (_knowledgeBlock: woven meter, band road, white-floor display) lives in git history at
  // v1.96.0 if a home is ever wanted again. gameScore() and the Challenges tab belt are
  // untouched; the score's one exposure is the Explore tab subtitle below.

  // THE PATH ROW LEFT THE DRAWER (v1.284.0, owner 15 Nov: "it's time to remove the Path section from the sidebar"; SET1
  // slice B, his four small losses accepted 16 Nov). Its tail, the worn track's proven units in words ("2 of 6 units", the
  // first loss), went with it, and so did `renderTabSubtitles`, which painted nothing else. The belt the player wears is
  // the "Master the game" row's (`beltWorn()`); `wornBelt()` still names the Path's own course for the corridor.

  noteLearningViewOpen(view) {
    // A render is not a visit: setGiMode can repaint the corridor behind a closed drawer or a deck over it. Reject it
    // BEFORE consuming the per-open dedupe flag, so the beat belongs to the next visible visit (SIDECX3). Since v1.284.0
    // the corridor is drawn only in Master the game, so its visit is Master the game's: the drawer shown and Practice on it.
    if (view === "challenges" && (!this.deckShown || !this._practiceInDrawer())) return;
    this._learningViewsTracked = this._learningViewsTracked || {};
    if (this._learningViewsTracked[view]) return;
    this._learningViewsTracked[view] = true;
    if (view === "challenges") {
      // THE WHITE OBJECTIVE'S BEAT MOVED WITH THE CORRIDOR (P22, v1.284.0, SET1 slice B). "Open Challenges"
      // (`white.challenges`) completes on it, and the White Foundations patch needs all 20 White objectives: until v1.284.0
      // only the Path's first visible visit fired it, so without this line nobody new could earn the patch. It fires on
      // the first visible draw of Master the game's corridor in each drawer opening (the dedupe resets on close), as it
      // did for the Path. `neural_challenges_viewed` ENDED with the Path (the fourth small loss, accepted; a data-loss
      // event, CLAUDE.md 6.7): its series stops on the ship day, and `neural_practice_opened` carries on.
      this.fx("challenges_opened", {
        tracks: NG_CHALLENGE_TRACKS.length,
      });
    } else if (view === "history") {
      this.track("neural_history_viewed", {});
    }
  },

  selectedChallengeTrack() {
    const requested = this.get(
      "challengeSelectedTrack",
      this.wornBelt().id,
    );
    return this.beltUnlocked(requested)
      ? requested
      : this.wornBelt().id;
  },

  // THE BLACK BELT ADVERTISES ITS REWARD UP FRONT (v1.105.1, owner: "we can see it in the
  // challenges"). Same idiom as the capstone's "Earns a patch": a visible row on the Black
  // section. It reads "earned" once the badge exists — the mint happens in the reward loop. Since U163 c (v1.270.0) the
  // patch is a patch and nothing more. Until v1.283.0 the row also said where the Recall Mode switch was ("turn it on in
  // Settings → Flashcards"); that switch left Settings (Auto does its job, R2), so the row says only how the patch is earned.
  _recallRewardRow() {
    const earned = !!(this.badges && this.badges["recall-in-play"]);
    const rw = document.createElement("div");
    rw.className = "ng-challenge-capstone";
    rw.setAttribute("data-recall-reward", earned ? "earned" : "unearned");
    rw.innerHTML =
      "<small>BLACK-BELT PATCH</small><b>Recall Mode</b><p>" +
      (earned ? "Earned." : "Reach black belt to earn it.") + "</p>";
    return rw;
  },

  // EVERYTHING OPENS (U163 c, owner, 13 Nov: "the belt only shows"). Until v1.270.0 this was the progression lock (U87):
  // a section, a lesson, a checkpoint, a capstone and a track pick were open only up to the worn belt. It now asks one
  // thing, "is this a belt", so every caller stays (one seam, §6.5) and every section is open; the Path's own evidence
  // gates (a checkpoint after its lessons, a capstone after its checkpoints) are not belt locks and stay where they are.
  // e2e/journeys/everything-opens.spec.ts and tests/belt_worn.test.mjs (P1-B, rewritten) pin it.
  beltUnlocked(id) {
    return ngBeltRank(id) >= 0;
  },

  _repaintBeltCorridor() {
    if (this._session?.practice && this._sessionInline()) this._practiceCorridor();
    else this.renderExplorer();
  },

  selectChallengeTrack(trackId) {
    if (!this.beltUnlocked(trackId)) return;
    // selecting a folded belt opens it — collapse is presentation only, never a lock
    if (!this._beltSectionOpen(trackId)) this._setBeltSectionOpen(trackId, true);
    if (this.selectedChallengeTrack() !== trackId) {
      this.set("challengeSelectedTrack", trackId);
      this.track("neural_challenge_track_viewed", { track_id: trackId });
    }
    this._repaintBeltCorridor();
  },

  // Eligible corridor sections keep independent presentation folds in ONE settings map.
  // Every section can fold (U163 c: none is locked). The worn belt opens by default. The map may still carry a
  // "tutorial" key from before v1.137.0 — nothing reads it, and a settings key can never
  // be deleted (CLAUDE.md §6.6), so it simply sits there.
  _beltSectionOpen(id) {
    if (!this.beltUnlocked(id)) return false;
    const map = this.get("challengeOpenSections", null);
    if (
      map &&
      typeof map === "object" &&
      Object.prototype.hasOwnProperty.call(map, id)
    ) {
      return !!map[id];
    }
    return id === this.wornBelt().id;
  },

  // THE FRONTIER BELT (v1.99.2, owner: "what's that pinning about? show the belt open on
  // the topmost section still left to complete") — the first belt, in corridor order,
  // whose live lessons are not all done. It replaces the pinned track everywhere the UI
  // used one: default-open section, arrival scroll, frontier glow, challenge cue,
  // selected-track fallback. NAVIGATION ONLY since v1.211.0: the tab belt is `wornBelt()`,
  // because this falls back to the corridor's top when everything is done (right for a
  // scroll target, wrong for a belt — it painted a finished player white). `challengePinnedTrack` is DORMANT: still merged in
  // progress blobs for compatibility, read by nothing.
  _frontierBeltId() {
    const belts = (this.curriculum && this.curriculum.belts) || [];
    for (const belt of belts) {
      const summary = this._beltLessonSummary(belt.id);
      if (summary && summary.total && summary.done < summary.total) return belt.id;
    }
    return belts.length ? belts[0].id : "white"; // everything proven -> the corridor's top
  },

  _setBeltSectionOpen(id, open) {
    if (!this.beltUnlocked(id)) return;
    const current = this.get("challengeOpenSections", null);
    const map = Object.assign(
      {},
      current && typeof current === "object" ? current : {},
    );
    map[id] = !!open;
    this.set("challengeOpenSections", map);
  },

  // done / total LIVE lessons of one belt — what the belt header counts (the objective
  // count moved to the Getting started section along with the objectives themselves)
  _beltLessonSummary(trackId) {
    const belt =
      this.curriculum &&
      this.curriculum.belts.find((item) => item.id === trackId);
    if (!belt) return null;
    let done = 0;
    let total = 0;
    for (const unit of belt.units) {
      for (const lesson of unit.lessons) {
        if (!this._lessonLive(lesson)) continue;
        total += 1;
        if (this.lessonDone(lesson.deckKey)) done += 1;
      }
    }
    return { done: done, total: total };
  },

  // PRINCIPLES OF THIS LEVEL — a data slot, deliberately unfilled: a belt section renders
  // this group only when curriculum data ships `belt.principles` (name + optional blurb).
  // Distributing the actual Principles content across belts is curriculum authoring —
  // owner-gated, never invented here.
  renderBeltPrinciples(trackId) {
    const belt =
      this.curriculum &&
      this.curriculum.belts.find((item) => item.id === trackId);
    const entries = belt && Array.isArray(belt.principles) ? belt.principles : null;
    if (!entries || !entries.length) return null;
    const group = document.createElement("div");
    group.className = "ng-principles-group";
    group.setAttribute("data-principles", trackId);
    group.innerHTML = "<small>Principles of this level</small>";
    for (const entry of entries) {
      const item =
        entry && typeof entry === "object" ? entry : { name: String(entry) };
      const row = document.createElement("div");
      row.className = "ng-principle-row";
      row.innerHTML =
        "<b>" +
        ngChallengeHTML(item.name || "") +
        "</b>" +
        (item.blurb ? "<p>" + ngChallengeHTML(item.blurb) + "</p>" : "");
      group.appendChild(row);
    }
    return group;
  },


  openLearningView(view, trackId) {
    if (trackId && this.beltUnlocked(trackId)) {
      this.settings = this.settings || {};
      this.settings.challengeSelectedTrack = trackId;
      (this._settingsAt = this._settingsAt || {}).challengeSelectedTrack =
        Date.now();
    }
    // THE PATH'S DOOR (v1.284.0, SET1 slice B): "challenges" opens Master the game, where the corridor lives
    // (`setViewMode` → `openCorridor`), and must not be followed by `openExplorer`, whose `openPane` would leave the
    // session it just opened. View Collection (O1) comes through here.
    this.setViewMode(view);
    if (view !== "challenges") this.openExplorer(); // openPane renders the active view's body (and hides any in-pane dossier)
  },

  challengeAction(definition, trackId) {
    if (!this.beltUnlocked(trackId)) return;
    const action = String((definition && definition.action) || "").toLowerCase();
    const belt =
      this.curriculum &&
      this.curriculum.belts.find((item) => item.id === trackId);
    const liveLessons = [];
    if (belt) {
      for (const unit of belt.units) {
        for (const lesson of unit.lessons) {
          if (this._lessonLive(lesson)) liveLessons.push({ lesson, unit, belt });
        }
      }
    }
    const nextLesson =
      liveLessons.find((item) => !this.lessonDone(item.lesson.deckKey)) ||
      liveLessons[0];
    if (action.includes("checkpoint") && belt) {
      const readyUnit = belt.units.find((unit) => {
        const live = unit.lessons.filter((lesson) => this._lessonLive(lesson));
        return live.length && live.every((lesson) => this.lessonDone(lesson.deckKey));
      });
      if (readyUnit) {
        this.startCheckpoint(belt.id, readyUnit);
        return;
      }
    }
    if (action.includes("capstone") && belt) {
      if (belt.units.every((unit) => this.unitComplete(belt.id, unit))) {
        this.startBeltTest(belt.id);
        return;
      }
    }
    if (
      action.includes("study") ||
      action.includes("checkpoint") ||
      action.includes("capstone")
    ) {
      if (nextLesson) {
        this.openLessonStudy(nextLesson.lesson, nextLesson.unit, nextLesson.belt);
      } else {
        this.closeExplorerIfOpen();
        this.openHomeToLatest();
      }
      return;
    }
    this.closeExplorerIfOpen();
  },

  challengeObjectiveElement(definition, trackId) {
    const entry = this.challengeProgress(definition.id);
    const article = document.createElement("article");
    article.className = "ng-challenge-row";
    article.setAttribute("data-challenge-id", definition.id);
    article.setAttribute("data-complete", entry.done ? "true" : "false");
    article.setAttribute(
      "aria-label",
      definition.title +
        ", " +
        entry.progress +
        " of " +
        definition.target +
        (entry.done ? ", complete" : ""),
    );
    article.innerHTML =
      '<span class="ng-challenge-check" aria-hidden="true">' +
      (entry.done ? "OK" : "") +
      "</span><div><b>" +
      ngChallengeHTML(definition.title) +
      "</b><p>" +
      ngChallengeHTML(definition.why) +
      "</p><small>" +
      (entry.done
        ? "Complete"
        : entry.progress + " of " + definition.target) +
      '</small><button type="button" class="ng-challenge-action">' +
      ngChallengeHTML(definition.action) +
      "</button></div>";
    article
      .querySelector(".ng-challenge-action")
      .addEventListener("click", () =>
        this.challengeAction(definition, trackId),
      );
    return article;
  },

  // First unproven live lesson of a track — the "what do I do next?" answer. Purely a
  // navigation aid: nothing about it locks or unlocks anything (canon).
  challengeFrontier(trackId) {
    const belt =
      this.curriculum &&
      this.curriculum.belts.find((item) => item.id === trackId);
    if (!belt) return null;
    for (const unit of belt.units) {
      for (const lesson of unit.lessons) {
        if (this._lessonLive(lesson) && !this.lessonDone(lesson.deckKey)) {
          return { lesson: lesson, unit: unit, belt: belt };
        }
      }
    }
    return null;
  },

  // THE CORRIDOR'S OWN KEYBOARD LEFT WITH THE PATH (v1.284.0): `challengeLessonNav` walked the Path's lesson rows and
  // opened their inline decks; in Master the game a lesson opens as a session row, and ↑/↓/←/→/Space/⏎ are the
  // session's own (`sessionNav`, `_miniDeck`).

  challengeCurriculumElement(trackId) {
    const section = document.createElement("section");
    section.className = "ng-challenge-curriculum";
    section.setAttribute("data-track-curriculum", trackId); // per-track scope handle (the ladder renders every track)
    const belt =
      this.curriculum &&
      this.curriculum.belts.find((item) => item.id === trackId);
    if (!belt) {
      section.innerHTML =
        "<small>CURRICULUM PRACTICE</small><p>Curriculum is unavailable right now. Action challenges still work.</p>";
      return section;
    }
    // the frontier lesson (frontier belt only) gets the glow — everything else that's not
    // done yet dims gently via CSS on data-lesson-done (visual only; every row stays live)
    const frontier =
      trackId === this._frontierBeltId() ? this.challengeFrontier(trackId) : null;
    // no per-track prose here — and since v1.162.0 no corridor-wide line either
    for (let index = 0; index < belt.units.length; index += 1) {
      const unit = belt.units[index];
      const live = unit.lessons.filter((lesson) => this._lessonLive(lesson));
      const done = live.filter((lesson) => this.lessonDone(lesson.deckKey)).length;
      const unitKey = belt.id + "/" + unit.id;
      const checkpointDone = !!(
        this.units &&
        this.units[unitKey] &&
        this.units[unitKey].checkpoint
      );
      const details = document.createElement("details");
      details.className = "ng-challenge-group";
      details.open = true; // the ladder shows everything — the whole journey scrolls
      details.innerHTML =
        "<summary><span><b>" +
        ngChallengeHTML(unit.name) +
        "</b><small>" +
        done +
        " of " +
        live.length +
        " lessons</small></span><em>" +
        // NOT "Open group" (v1.104.9, owner: "it then says 'Open group', which makes no sense
        // because the group is already open"). `details.open = true` two lines up, unconditionally
        // and forever — this <em> was never a toggle, it is a STATUS field that was wearing an
        // imperative. It now reports what it actually knows: the checkpoint, or how far in you are.
        (checkpointDone
          ? "Checkpoint cleared"
          : done === 0
            ? "Not started"
            : done >= live.length
              ? "All lessons done"
              : done + "/" + live.length + " done") +
        "</em></summary><div class=\"ng-challenge-lessons\"></div>";
      const lessons = details.querySelector(".ng-challenge-lessons");
      for (const lesson of live) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ng-challenge-lesson";
        button.setAttribute("data-lesson", lesson.deckKey);
        button.setAttribute(
          "data-lesson-done",
          this.lessonDone(lesson.deckKey) ? "true" : "false",
        );
        const isFrontier = !!(
          frontier &&
          frontier.lesson.deckKey === lesson.deckKey &&
          frontier.unit === unit
        );
        if (isFrontier) button.setAttribute("data-frontier", "1");
        const lessonComplete = this.lessonDone(lesson.deckKey);
        button.innerHTML =
          this.crownBadge(
            this.deckMastery(lesson.deckKey),
            NG_CHALLENGE_TRACK_COLORS[trackId],
            false,
          ) +
          "<span>" +
          ngChallengeHTML(lesson.deckKey.split("|")[0]) +
          "<small>" +
          ngChallengeHTML(lesson.deckKey.split("|")[1] || "") +
          "</small></span>" +
          // done rows wear a clear check on the row edge (dimming alone was too quiet)
          (lessonComplete
            ? '<i class="ng-lesson-check" aria-hidden="true">✓</i>'
            : "");
        // A LESSON OPENS IN MASTER THE GAME (v1.284.0, SET1 slice B): its cards come up as a session row
        // (`_practiceLesson`) and the map points at it, the drawer staying open. Until v1.284.0 the Path's own tap staged a
        // roll on the technique (the second small loss, accepted: the orb on the map and its Explore row still stage one),
        // and its ▸ opened an inline deck here, with its own keyboard; the corridor is now drawn only in Master the game.
        const open = () => { if (this.beltUnlocked(trackId)) this._practiceLesson(lesson.deckKey); };
        button.addEventListener("click", () => {
          open();
          const ni = this._lessonNodeIdx(lesson.deckKey);
          if (ni >= 0) { this.focusIdx = ni; this.locateNode(ni); this._syncUrl(ni); }
        });
        const lessonIdx = this._lessonNodeIdx ? this._lessonNodeIdx(lesson.deckKey) : -1;
        const lessonNode = lessonIdx >= 0 && this.nodes ? this.nodes[lessonIdx] : null;
        // category tint: the row leans toward its node's palette color (position /
        // transition / submission — the same colors Explore speaks)
        if (lessonNode) {
          const cat =
            lessonNode.ty === "positions"
              ? "position"
              : lessonNode.ty === "submissions"
                ? "submission"
                : "transition";
          const cc = NG_LESSON_CAT_COLORS[cat];
          button.setAttribute("data-cat", cat);
          button.style.borderLeft = "2px solid " + ngChallengeTint(cc, 0.45);
          button.style.background =
            "linear-gradient(90deg," +
            ngChallengeTint(cc, 0.07) +
            ",rgba(255,255,255,.035) 55%)";
        }
        const lessonRow = document.createElement("div");
        lessonRow.className = "ng-challenge-lessonrow";
        lessonRow.appendChild(button);
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "ng-lesson-decktoggle";
        toggle.setAttribute("data-lesson-deck-toggle", lesson.deckKey);
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute(
          "aria-label",
          "Show this lesson's cards inline",
        );
        toggle.innerHTML = '<span aria-hidden="true">▸</span>';
        toggle.addEventListener("click", open);
        lessonRow.appendChild(toggle);
        lessons.appendChild(lessonRow);
      }
      const checkpoint = document.createElement("button");
      checkpoint.type = "button";
      checkpoint.className = "ng-challenge-checkpoint";
      checkpoint.setAttribute("data-checkpoint", unitKey);
      checkpoint.disabled = !checkpointDone && done < live.length;
      checkpoint.textContent = checkpointDone
        ? "Checkpoint cleared"
        : done < live.length
          ? "Checkpoint available after " + (live.length - done) + " lessons"
          : "Start checkpoint";
      checkpoint.addEventListener("click", () =>
        this.startCheckpoint(belt.id, unit),
      );
      lessons.appendChild(checkpoint);
      section.appendChild(details);
    }
    const won = !!(
      this.belts &&
      this.belts.won &&
      this.belts.won[belt.id]
    );
    const ready = belt.units.every((unit) =>
      this.unitComplete(belt.id, unit),
    );
    const capstone = document.createElement("div");
    const challengeTrack =
      NG_CHALLENGE_TRACKS.find((track) => track.id === belt.id) ||
      NG_CHALLENGE_TRACKS[0];
    capstone.className = "ng-challenge-capstone";
    capstone.setAttribute("data-capstone", belt.id);
    capstone.innerHTML =
      "<small>OPTIONAL CONTENT CAPSTONE</small><b>" +
      ngChallengeHTML(ngTrackName(challengeTrack) + " capstone") +
      "</b><p>Earns a patch. It never opens or closes another track.</p>";
    // capstone is not yet in the DOM here — the builder appends it below, and the append
    // site places this row immediately before it.
    if (belt.id === "black") this._pendingRecallReward = this._recallRewardRow();
    if (belt.test) {
      const button = document.createElement("button");
      button.type = "button";
      button.disabled = !ready || won;
      button.textContent = won
        ? "Capstone cleared"
        : ready
          ? "Start capstone"
          : "Available after every unit checkpoint";
      button.addEventListener("click", () => this.startBeltTest(belt.id));
      capstone.appendChild(button);
    }
    if (this._pendingRecallReward) { section.appendChild(this._pendingRecallReward); this._pendingRecallReward = null; }
    section.appendChild(capstone);
    return section;
  },

  // THE CORRIDOR, DRAWN IN MASTER THE GAME ONLY (v1.284.0, SET1 slice B): its one caller is `_practiceCorridor`, into the
  // session's own corridor slot. The Path drew it into the drawer's list too, with a sticky band over it ("8 of 20 today",
  // the third small loss, accepted: the Master the game row is the same door with the same count) and an arrival scroll to
  // the worn belt (Master the game's corridor starts at the worn belt, so nothing to scroll to).
  renderChallenges(list) {
    this._renderingChallengeView = true;
    try {
      this.noteLearningViewOpen("challenges");
      // THE MAP'S CURRICULUM DIMMING (P19): set by the corridor's draw, now Master the game's
      this._pathDim = !!this.curriculum;
      const selectedId = this.selectedChallengeTrack();
      const selected =
        NG_CHALLENGE_TRACKS.find((track) => track.id === selectedId) ||
        NG_CHALLENGE_TRACKS[0];
      // v1.162.0, owner: the two prose lines that used to open this tab (.ng-challenge-
      // distinction — guest/offline/migration state; .ng-ladder-note — "Every lesson is
      // open …") are GONE. Both sat ABOVE the corridor, so the arrival scroll below pushed
      // them off the top and nobody read them without scrolling back up. The corridor now
      // starts at the top of the scrollport and the arrival scroll can land at 0.
      // `challengeEnvironmentNotice()` left with them (it had no other reader), and so did
      // the migration notice; `challengeMigrationSeen` is a settings key, so it is RETIRED
      // BY CEASING TO READ IT, never deleted (CLAUDE.md §6.6 — a deleted settings key is
      // re-added by the first pull from any device that still carries it).
      // The CONTINUE button is dead (v1.98.1, owner) — arrival positioning replaced it:
      // the arrival scroll that replaced it left with the Path (v1.284.0); the glow still marks "do this next".

      // THE BELT CORRIDOR (v1.96.0) — one continuous woven belt runs down the left, white
      // through black, a knot tied at every boundary; lesson rows hang off it. Belt headers
      // carry selection (still .ng-track-card / data-track / aria-pressed). Eligible
      // sections fold independently (none is locked since U163 c, v1.270.0).
      const ladder = document.createElement("section");
      ladder.className = "ng-track-list ng-challenge-ladder ng-corridor";
      ladder.setAttribute("aria-label", "Belt corridor");
      const earlier = document.createElement("div");
      const rank = this.wornBelt().rank;
      for (let index = 0; index < NG_CHALLENGE_TRACKS.length; index += 1) {
        const track = NG_CHALLENGE_TRACKS[index];
        if (index < rank && !this._session.earlier) continue;
        const unlocked = this.beltUnlocked(track.id);
        const color = NG_CHALLENGE_TRACK_COLORS[track.id];
        const summary = this.challengeTrackProgress(track.id);
        const lessons = this._beltLessonSummary(track.id);
        const count = lessons || summary;
        const open = this._beltSectionOpen(track.id);
        const beltSection = document.createElement("section");
        beltSection.className = "ng-belt-section";
        beltSection.setAttribute("data-belt", track.id);
        beltSection.setAttribute("data-collapsed", open ? "false" : "true");
        beltSection.style.setProperty("--ng-track", color);
        // pronounced dye (v1.99.2, owner: "the white in white belt card bg ... should be
        // more pronounced"): the card wears its belt's color plainly, not as a hint
        beltSection.style.setProperty(
          "--ng-track-soft",
          ngChallengeTint(color, 0.34),
        );
        beltSection.style.setProperty(
          "--ng-track-faint",
          ngChallengeTint(color, 0.1),
        );
        beltSection.style.setProperty(
          "--ng-track-line",
          ngChallengeTint(color, 0.42),
        );
        const rail = document.createElement("i");
        rail.className = "ng-corridor-rail";
        rail.setAttribute("aria-hidden", "true");
        beltSection.appendChild(rail);
        // (the LOCKED section, "Locked · progress through the earlier belts" with no button, chevron or lesson, went with
        // U163 c in v1.270.0: a later belt is now an ordinary section, folded until opened, like any belt not worn)
        if (!unlocked) continue; // not a belt id: nothing to draw
        if (index > 0) {
          // the knot: a simple tie marking where one belt ends and the next begins
          const knot = document.createElement("i");
          knot.className = "ng-corridor-knot";
          knot.setAttribute("aria-hidden", "true");
          knot.innerHTML = "<b></b><b></b>";
          beltSection.appendChild(knot);
        }
        const head = document.createElement("div");
        head.className = "ng-belt-head";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ng-track-card";
        button.setAttribute("data-track", track.id);
        button.setAttribute(
          "aria-pressed",
          track.id === selected.id ? "true" : "false",
        );
        const beltComplete = !!count.total && count.done >= count.total;
        if (beltComplete) beltSection.setAttribute("data-belt-complete", "1");
        button.setAttribute(
          "aria-label",
          ngBeltDisplayName(track.id) +
            ": " +
            count.done +
            " of " +
            count.total +
            (lessons ? " lessons" : " challenges") +
            " done" +
            (beltComplete ? ", complete" : ""),
        );
        // the completion stamp (v1.99.2, owner): a subtle gray boxed-check watermark
        // INSIDE the header card once the belt is complete — behind the text (z:-1
        // against the card's own stacking context), never a layout participant
        button.innerHTML =
          "<b>" +
          ngBeltDisplayName(track.id) +
          "</b><strong>" +
          count.done +
          " of " +
          count.total +
          "</strong>" +
          (beltComplete
            ? '<i class="ng-belt-stamp" aria-hidden="true">✓</i>'
            : "");
        button.addEventListener("click", () =>
          this.selectChallengeTrack(track.id),
        );
        head.appendChild(button);
        // (the header pin died in v1.99.2 — the corridor derives its target from
        // _frontierBeltId; there is nothing to pin)
        const fold = document.createElement("button");
        fold.type = "button";
        fold.className = "ng-belt-toggle";
        fold.setAttribute("data-belt-toggle", track.id);
        fold.setAttribute("aria-expanded", open ? "true" : "false");
        fold.setAttribute(
          "aria-label",
          (open ? "Collapse " : "Expand ") + ngBeltDisplayName(track.id),
        );
        fold.innerHTML =
          '<span aria-hidden="true">' + (open ? "▾" : "▸") + "</span>";
        fold.addEventListener("click", () => {
          this._setBeltSectionOpen(track.id, !this._beltSectionOpen(track.id));
          this._repaintBeltCorridor();
        });
        head.appendChild(fold);
        beltSection.appendChild(head);

        const body = document.createElement("div");
        body.className = "ng-belt-body";

        // principles slot — renders only when curriculum data provides this belt's list
        const principles = this.renderBeltPrinciples(track.id);
        if (principles) body.appendChild(principles);

        // v1.98.1: the detail HEAD is gone (it restated the belt header's name and count —
        // the double title the owner flagged) and the pin lives on the header row above.
        // What remains of the detail is the selected ADVANCED belt's objectives; White's
        // twenty ARE the Tutorial section at the top of the tab, so it renders nothing.
        if (track.id === selected.id && track.id !== "white") {
          const detail = document.createElement("section");
          detail.className = "ng-challenge-detail";
          detail.setAttribute("aria-label", selected.name + " challenges");
          detail.style.setProperty("--ng-track", color);
          for (const definition of NG_CHALLENGES) {
            if (definition.track === selected.id) {
              detail.appendChild(
                this.challengeObjectiveElement(definition, selected.id),
              );
            }
          }
          body.appendChild(detail);
        }

        const curriculum = this.challengeCurriculumElement(track.id);
        curriculum.style.setProperty("--ng-track", color);
        body.appendChild(curriculum);
        beltSection.appendChild(body);
        (index < rank ? earlier : ladder).appendChild(beltSection);
      }
      list.appendChild(ladder);
      const shelf = this.renderRewardsShelf();
      if (shelf) list.appendChild(shelf); // null until something is earned (v1.99.1)
      list.appendChild(this._session.support);
      if (rank > 0) {
        const reveal = document.createElement("button");
        reveal.type = "button"; reveal.className = "ng-earlier-belts";
        reveal.setAttribute("data-earlier-belts", "1");
        reveal.setAttribute("aria-expanded", String(!!this._session.earlier));
        reveal.textContent = this._session.earlier ? "Hide earlier belts" : "Show earlier belts";
        reveal.onclick = () => { this._session.earlier = !this._session.earlier; this._practiceCorridor(); };
        list.append(earlier, reveal);
      }
    } finally {
      this._renderingChallengeView = false;
    }
  },

  // earned items only since v1.99.1 — the "Available to earn" placeholder branch is dead
  // (the shelf renders nothing it cannot show off)
  collectionItem(definition, kind) {
    const article = document.createElement("article");
    article.className =
      kind === "patch" ? "ng-patch-badge" : "ng-mat-coin";
    article.setAttribute("data-earned", "true");
    article.setAttribute("aria-label", definition.name + ": earned");
    if (kind === "patch") {
      article.innerHTML =
        '<span aria-hidden="true">BJJ</span><b>' +
        ngChallengeHTML(definition.name) +
        "</b><small>" +
        ngChallengeHTML(definition.detail) +
        "</small>";
    } else {
      article.innerHTML =
        '<span aria-hidden="true">' +
        ngChallengeHTML(definition.name.slice(0, 2).toUpperCase()) +
        "</span><div><b>" +
        ngChallengeHTML(definition.name) +
        "</b><small>" +
        ngChallengeHTML(definition.detail) +
        "</small></div>";
    }
    return article;
  },

  // The Collection tab retired in v1.76.0 — its content lives here, a rewards shelf at the
  // foot of the Challenges tab. Same handles (ng-patch-badge / ng-mat-coin / data-earned);
  // one <details> so Challenges stays scannable.
  // v1.99.1 (owner: "I don't see the point" of the zero-state): the shelf EARNS its place.
  // No rewards = no shelf at all, and the "Available to earn" placeholder grid is gone for
  // good — the ladder's capstones already name the milestones ("Earns a patch"), and Mat
  // Coins are jokes that spoil if listed upfront. Only what IS earned renders.
  renderRewardsShelf() {
    const badgeMap = this.badges || {};
    const coinMap = this.coins || {};
    const earnedPatches = NG_BADGE_DEFINITIONS.filter((d) => badgeMap[d.id]);
    const earnedCoins = NG_MAT_COINS.filter((d) => coinMap[d.id]);
    const patches = earnedPatches.length;
    const coins = earnedCoins.length;
    if (!patches && !coins) return null;
    const shelf = document.createElement("details");
    shelf.className = "ng-rewards-shelf";
    shelf.setAttribute("data-rewards-shelf", "1");
    // THE SHELF STAYS AS THE PLAYER LEFT IT ACROSS A REPAINT (v1.284.0, SET1 slice B). Its one home is Master the game's
    // corridor now, which repaints whenever the plan lands or evidence moves, and the Path's view rarely did: View
    // Collection (O1) opened it, and the plan's landing a moment later closed it again. Its state rides on the session,
    // and only a closed-to-open change is a visit (`neural_collection_opened`), so a repaint of an open shelf sends nothing.
    const s = this._session;
    if (this._scrollRewardsShelf || (s && s.shelfOpen)) shelf.open = true;
    const summary = document.createElement("summary");
    summary.innerHTML =
      "<small>REWARDS</small><b>" +
      patches + " patch" + (patches === 1 ? "" : "es") + " · " +
      coins + " mat coin" + (coins === 1 ? "" : "s") +
      "</b><em>Patches mark milestones. Mat Coins are just for laughs. They do not buy anything.</em>";
    shelf.appendChild(summary);
    shelf.addEventListener("toggle", () => {
      const was = !!(s && s.shelfOpen);
      if (s) s.shelfOpen = shelf.open;
      if (shelf.open && !was) {
        this.track("neural_collection_opened", { patches: patches, coins: coins });
      }
    });
    // earned-only sections; a section with nothing earned does not render
    if (patches) {
      const patchSection = document.createElement("section");
      patchSection.className = "ng-collection-section";
      patchSection.innerHTML =
        "<div><h3>Patches</h3><span>" +
        patches +
        " earned</span></div><div class=\"ng-patch-grid\"></div>";
      for (const patch of earnedPatches) {
        patchSection
          .querySelector(".ng-patch-grid")
          .appendChild(this.collectionItem(patch, "patch"));
      }
      shelf.appendChild(patchSection);
    }
    if (coins) {
      const coinSection = document.createElement("section");
      coinSection.className = "ng-collection-section";
      coinSection.innerHTML =
        "<div><h3>Mat Coins</h3><span>" +
        coins +
        " minted once</span></div><div class=\"ng-coin-list\"></div>";
      for (const coin of earnedCoins) {
        coinSection
          .querySelector(".ng-coin-list")
          .appendChild(this.collectionItem(coin, "coin"));
      }
      shelf.appendChild(coinSection);
    }
    // VIEW COLLECTION'S SCROLL OUTLIVES A REPAINT TOO (v1.284.0): Master the game lays its page out again when the plan lands,
    // which put the shelf View Collection had scrolled to back below the fold. The request rides on the session until the
    // player moves the page themselves (a wheel, a touch, a press, a key), and each repaint until then scrolls to the shelf.
    if (this._scrollRewardsShelf) {
      this._scrollRewardsShelf = false;
      if (s) {
        s.shelfScroll = true;
        const host = this.drillListRef && this.drillListRef.current;
        if (host) for (const t of ["wheel", "touchstart", "pointerdown", "keydown"]) host.addEventListener(t, () => { s.shelfScroll = false; }, { once: true, passive: true });
      } else requestAnimationFrame(() => { try { shelf.scrollIntoView({ block: "start" }); } catch (e) {} });
    }
    if (s && s.shelfScroll) requestAnimationFrame(() => { try { if (shelf.isConnected && s.shelfScroll) shelf.scrollIntoView({ block: "start" }); } catch (e) {} });
    return shelf;
  },
};

Object.assign(Component.prototype, NG_CHALLENGE_UI_METHODS);
