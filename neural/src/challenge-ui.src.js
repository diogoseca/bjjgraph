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

  // ── tab subtitles (v1.95.0) ── each pane tab is a title over one plain second line:
  //  · Explore — the Game Knowledge score as "Mastered N%" (same number as the belt);
  //  · Challenges — a miniature belt in the PINNED track's color wearing 0-4 stripes from
  //    that track's PROVEN-UNITS fraction (unitComplete: lessons done + checkpoint —
  //    v1.95.3; objectives were too generous, a guest wore unearned stripes). Deliberately
  //    NOT gameScore().stripes: the knowledge belt is the SCORE's belt; the Challenges
  //    tab's stripes are LADDER progress. Two meters, two meanings — documented in CLAUDE.md.
  //  · Last rolls — static copy from the template ("History reads as the history of BJJ",
  //    owner). The internal view id and settings keys stay `history`.
  renderTabSubtitles() {
    const vt = this.viewToggleRef && this.viewToggleRef.current;
    if (!vt) return;
    const ex = vt.querySelector('[data-tab-sub="explore"]');
    if (ex)
      // word first, integer percent (owner, v1.95.2): "Mastered 0%", never "0.0% mastered"
      ex.textContent = "Mastered " + Math.round(this.gameScore().score * 100) + "%";
    const ch = vt.querySelector('[data-tab-sub="challenges"]');
    if (ch) {
      const pinned = this._frontierBeltId(); // the frontier belt (pinning retired v1.99.2)
      // stripes = the pinned track's PROVEN UNITS (all live lessons done + checkpoint
      // passed) over its unit count → 0-4. NOT the objectives fraction (v1.95.3): the
      // first-roll coach auto-ticks objectives and incidental evidence completes more
      // through normal play, so a casual guest wore stripes he never deliberately earned
      // (owner: a guest must be 0). Units only move through deliberate challenge work.
      const belt =
        this.curriculum && this.curriculum.belts
          ? this.curriculum.belts.find((b) => b.id === pinned)
          : null;
      const total = belt ? belt.units.length : 0;
      let done = 0;
      if (belt)
        for (const unit of belt.units)
          if (this.unitComplete(belt.id, unit)) done += 1;
      const stripes = total
        ? Math.max(0, Math.min(4, Math.floor((done / total) * 4)))
        : 0;
      let tape = "";
      for (let i = 0; i < stripes; i++) tape += "<b></b>";
      ch.innerHTML =
        '<i class="ng-tab-belt" data-tab-stripes="' +
        stripes +
        '" style="--tb:' +
        (NG_CHALLENGE_TRACK_COLORS[pinned] || NG_CHALLENGE_TRACK_COLORS.white) +
        ';" aria-hidden="true"><span>' +
        tape +
        "</span></i>";
      const btn = ch.closest("button");
      if (btn)
        btn.setAttribute(
          "aria-label",
          "Challenges: " +
            done +
            " of " +
            total +
            " units proven on the " +
            pinned +
            " track, " +
            stripes +
            (stripes === 1 ? " stripe" : " stripes"),
        );
    }
  },

  noteLearningViewOpen(view) {
    this._learningViewsTracked = this._learningViewsTracked || {};
    if (this._learningViewsTracked[view]) return;
    this._learningViewsTracked[view] = true;
    if (view === "challenges") {
      if (!this._challengeMigrationNotice) {
        this.fx("challenges_opened", {
          tracks: NG_CHALLENGE_TRACKS.length,
        });
      }
      this.track("neural_challenges_viewed", {});
    } else if (view === "history") {
      this.track("neural_history_viewed", {});
    }
  },

  selectedChallengeTrack() {
    const requested = this.get(
      "challengeSelectedTrack",
      this._frontierBeltId(),
    );
    return NG_CHALLENGE_TRACKS.some((track) => track.id === requested)
      ? requested
      : "white";
  },

  selectChallengeTrack(trackId) {
    if (!NG_CHALLENGE_TRACKS.some((track) => track.id === trackId)) return;
    // selecting a folded belt opens it — collapse is presentation only, never a lock
    if (!this._beltSectionOpen(trackId)) this._setBeltSectionOpen(trackId, true);
    if (this.selectedChallengeTrack() !== trackId) {
      this.set("challengeSelectedTrack", trackId);
      this.track("neural_challenge_track_viewed", { track_id: trackId });
    }
    this.renderExplorer();
  },

  // ── corridor sections (v1.96.0): collapse is presentation ONLY (nothing re-locks; every
  // row stays in the DOM). Open/closed is remembered per section in ONE settings map.
  // Defaults: the pinned belt rides open, the rest fold; the tutorial folds itself once
  // largely done (owner: at 14 of 20, show the remainder compactly instead).
  _beltSectionOpen(id) {
    const map = this.get("challengeOpenSections", null);
    if (
      map &&
      typeof map === "object" &&
      Object.prototype.hasOwnProperty.call(map, id)
    ) {
      return !!map[id];
    }
    // the tutorial defaults FOLDED at any progress (v1.98.1 — the ≥14 threshold is
    // dead; the owner at 11/20 met a wall of done rows). Expansion persists in the map.
    if (id === "tutorial") return false;
    return id === this._frontierBeltId();
  },

  // THE FRONTIER BELT (v1.99.2, owner: "what's that pinning about? show the belt open on
  // the topmost section still left to complete") — the first belt, in corridor order,
  // whose live lessons are not all done. It replaces the pinned track everywhere the UI
  // used one: default-open section, arrival scroll, frontier glow, tab belt, challenge
  // cue, selected-track fallback. `challengePinnedTrack` is DORMANT: still merged in
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

  // TUTORIAL — the twenty White evidence objectives the coach feeds, as their OWN section
  // ABOVE the belt corridor (owner: "the tutorial should be separate from the open
  // curriculum practice"). FOLDED by default at any progress (v1.98.1); the folded head
  // still shows what he hasn't seen as chips on the title row.
  renderTutorialSection() {
    const prog = this.challengeTrackProgress("white");
    const open = this._beltSectionOpen("tutorial");
    const section = document.createElement("section");
    section.className = "ng-tutorial-section";
    section.setAttribute("data-tutorial", "1");
    section.setAttribute("data-collapsed", open ? "false" : "true");
    const head = document.createElement("button");
    head.type = "button";
    head.className = "ng-tutorial-head";
    head.setAttribute("data-tutorial-toggle", "1");
    head.setAttribute("aria-expanded", open ? "true" : "false");
    // v1.98.1: titled "Tutorial" in the belt headers' own lettering; when folded and
    // unfinished, the still-to-see chips ride the SAME ROW, right of the title, clipping
    // gracefully at the pane's width (360 rail / 390 drawer).
    let chips = "";
    if (!open && prog.done < prog.total) {
      const left = [];
      for (const definition of NG_CHALLENGES) {
        if (
          definition.track === "white" &&
          !this.challengeProgress(definition.id).done
        ) {
          left.push(definition.title);
        }
      }
      chips =
        '<span class="ng-tutorial-chips" data-tutorial-remainder="1" aria-label="Still to see: ' +
        ngChallengeHTML(left.join(", ")) +
        '">' +
        left.map((title) => "<i>" + ngChallengeHTML(title) + "</i>").join("") +
        "</span>";
    }
    const tutComplete = !!prog.total && prog.done >= prog.total;
    if (tutComplete) section.setAttribute("data-tutorial-complete", "1");
    head.innerHTML =
      "<b>Tutorial</b>" +
      chips +
      "<strong>" +
      prog.done +
      " of " +
      prog.total +
      "</strong>" +
      (tutComplete ? '<i class="ng-belt-stamp" aria-hidden="true">✓</i>' : "") +
      '<em aria-hidden="true">' +
      (open ? "▾" : "▸") +
      "</em>";
    head.addEventListener("click", () => {
      this._setBeltSectionOpen("tutorial", !this._beltSectionOpen("tutorial"));
      this.renderExplorer();
    });
    section.appendChild(head);
    const body = document.createElement("div");
    body.className = "ng-tutorial-body";
    for (const definition of NG_CHALLENGES) {
      if (definition.track === "white") {
        body.appendChild(this.challengeObjectiveElement(definition, "white"));
      }
    }
    section.appendChild(body);
    return section;
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
    if (trackId) {
      this.settings = this.settings || {};
      this.settings.challengeSelectedTrack = trackId;
      (this._settingsAt = this._settingsAt || {}).challengeSelectedTrack =
        Date.now();
    }
    this.setViewMode(view);
    this.openExplorer(); // openPane renders the active tab's body (and hides any in-pane dossier)
  },

  challengeAction(definition, trackId) {
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
    // no per-track prose here — the whole corridor explains itself ONCE (.ng-ladder-note)
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
        (checkpointDone ? "Checkpoint cleared" : "Open group") +
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
        if (frontier && frontier.lesson.deckKey === lesson.deckKey && frontier.unit === unit) {
          button.setAttribute("data-frontier", "1");
        }
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
        button.addEventListener("click", () =>
          this.openLessonStudy(lesson, unit, belt),
        );
        // A lesson row is also a technique a coach may have covered in class, so it carries the
        // same + affordance as Explore/dossier/landing. The button must be a SIBLING: a nested
        // <button> closes the outer one in the HTML parser and would break the row entirely.
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
        // inline mini deck — the History pattern on the ladder: the disclosure reveals the
        // deck IN PLACE (no study takeover); the row itself still opens the full study
        const deckBox = document.createElement("div");
        deckBox.className = "ng-lesson-deckbox";
        deckBox.style.display = "none";
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
        const rid = "lesson:" + lesson.deckKey;
        const closeSelf = () => {
          deckBox.style.display = "none";
          toggle.setAttribute("aria-expanded", "false");
          toggle.querySelector("span").textContent = "▸";
          if (this._openLessonMini && this._openLessonMini.rid === rid) {
            this._openLessonMini = null;
          }
        };
        let built = false;
        toggle.addEventListener("click", () => {
          if (deckBox.style.display !== "none") {
            closeSelf();
            return;
          }
          if (this._openLessonMini && this._openLessonMini.rid !== rid) {
            this._openLessonMini.close(); // accordion — one inline deck at a time
          }
          const decks = (this.flashcards && this.flashcards.decks) || {};
          const deck = decks[lesson.deckKey];
          const ncards = this._deckCardCount(deck);
          const resident = !!this._cardsOf(deck);
          if (!built) {
            built = true;
            deckBox.appendChild(
              ncards && resident
                ? this._miniDeck(lesson.deckKey, deck, false, rid)
                : this._miniDeckEmpty({ key: lesson.deckKey }),
            );
            // authored but not here yet: this click IS the request for it
            if (ncards && !resident) {
              this.hydrateDeck(lesson.deckKey).then(() => {
                if (
                  !this._cardsOf(this.flashcards.decks[lesson.deckKey]) ||
                  deckBox.style.display === "none"
                ) {
                  return;
                }
                deckBox.innerHTML = "";
                deckBox.appendChild(
                  this._miniDeck(
                    lesson.deckKey,
                    this.flashcards.decks[lesson.deckKey],
                    false,
                    rid,
                  ),
                );
              });
            }
          }
          deckBox.style.display = "block";
          toggle.setAttribute("aria-expanded", "true");
          toggle.querySelector("span").textContent = "▾";
          this._openLessonMini = { rid: rid, close: closeSelf };
        });
        lessonRow.appendChild(toggle);
        if (lessonNode) {
          lessonRow.appendChild(this._listAddButton(lessonNode.id, "lesson"));
        }
        lessons.appendChild(lessonRow);
        lessons.appendChild(deckBox);
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
    section.appendChild(capstone);
    return section;
  },

  challengeEnvironmentNotice() {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return {
        state: "offline",
        text: "Offline - completions stay on this device and sync later.",
      };
    }
    if (!this.user) {
      return {
        state: "signed-out",
        text: "Playing as guest - progress is saved on this device.",
      };
    }
    return null;
  },

  renderChallenges(list) {
    this._renderingChallengeView = true;
    try {
      this.noteLearningViewOpen("challenges");
      this._pathDim = !!this.curriculum;
      const selectedId = this.selectedChallengeTrack();
      const selected =
        NG_CHALLENGE_TRACKS.find((track) => track.id === selectedId) ||
        NG_CHALLENGE_TRACKS[0];
      const intro = document.createElement("p");
      intro.className = "ng-challenge-distinction";
      const migrated = !!this._challengeMigrationNotice;
      const environment = this.challengeEnvironmentNotice();
      if (migrated) {
        intro.textContent =
          "Tutorial is now White Challenges - same progress, more to collect.";
        intro.dataset.challengeState = "migrated";
      } else if (environment) {
        intro.textContent = environment.text;
        intro.dataset.challengeState = environment.state;
      } else {
        intro.textContent =
          "Tracks label the material. Your Game Knowledge shows your proven progress.";
        intro.dataset.challengeState = "synced";
      }
      list.appendChild(intro);
      if (migrated) {
        this._challengeMigrationNotice = false;
        this.set("challengeMigrationSeen", true);
      }
      // The CONTINUE button is dead (v1.98.1, owner) — arrival positioning replaced it:
      // opening the tab scrolls the corridor to the frontier belt (the topmost belt still
      // left to complete; below, after the ladder mounts). The glow marks "do this next".
      const pinnedId = this._frontierBeltId();

      // TUTORIAL — rides ABOVE the belts, separate from the curriculum; scrolling up to
      // it is the user's choice
      list.appendChild(this.renderTutorialSection());

      // ONE explainer line for the whole corridor (was a prose block per track)
      const note = document.createElement("p");
      note.className = "ng-ladder-note";
      note.textContent =
        "Every lesson is open. Checkpoints and the optional capstones just ask for proof first.";
      list.appendChild(note);

      // THE BELT CORRIDOR (v1.96.0) — one continuous woven belt runs down the left, white
      // through black, a knot tied at every boundary; lesson rows hang off it. Belt headers
      // carry selection (still .ng-track-card / data-track / aria-pressed); each section
      // folds via its chevron — display only, nothing re-locks, every row stays in the DOM.
      const ladder = document.createElement("section");
      ladder.className = "ng-track-list ng-challenge-ladder ng-corridor";
      ladder.setAttribute("aria-label", "Belt corridor");
      for (let index = 0; index < NG_CHALLENGE_TRACKS.length; index += 1) {
        const track = NG_CHALLENGE_TRACKS[index];
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
          this.renderExplorer();
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
        ladder.appendChild(beltSection);
      }
      list.appendChild(ladder);
      const shelf = this.renderRewardsShelf();
      if (shelf) list.appendChild(shelf); // null until something is earned (v1.99.1)
      // ── ARRIVAL POSITIONING (v1.98.1, replaces the Continue button) ── opening the tab
      // lands the corridor where the person is: the pinned belt's header at the top of the
      // view, its frontier row (already glow-marked) in sight. INSTANT, on OPEN only —
      // reduced-motion identical; re-renders never touch the scroll (renderExplorer
      // preserves it, the History-body gate precedent). No frontier (everything proven) =
      // the pinned belt's top. The Tutorial sits above; scrolling up to it is a choice.
      if (this._challengeScrollPending) {
        this._challengeScrollPending = false;
        const sec = ladder.querySelector(
          '.ng-belt-section[data-belt="' + pinnedId + '"]',
        );
        if (sec) {
          const lr = list.getBoundingClientRect();
          if (lr.height > 0) {
            list.scrollTop += sec.getBoundingClientRect().top - lr.top;
            const row = ladder.querySelector(
              ".ng-challenge-lesson[data-frontier]",
            );
            if (row) {
              // keep the frontier row in view with the MINIMUM extra motion: when the
              // section opens with more content (principles, units) than one viewport
              // holds above the frontier, the header cedes only what the row needs
              const lr2 = list.getBoundingClientRect();
              const rr = row.getBoundingClientRect();
              if (rr.bottom > lr2.bottom)
                list.scrollTop += rr.bottom - lr2.bottom + 20;
            }
          }
        }
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
    if (this._scrollRewardsShelf) shelf.open = true;
    const summary = document.createElement("summary");
    summary.innerHTML =
      "<small>REWARDS</small><b>" +
      patches + " patch" + (patches === 1 ? "" : "es") + " · " +
      coins + " mat coin" + (coins === 1 ? "" : "s") +
      "</b><em>Patches mark milestones. Mat Coins are just for laughs. They do not buy anything.</em>";
    shelf.appendChild(summary);
    shelf.addEventListener("toggle", () => {
      if (shelf.open) {
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
    if (this._scrollRewardsShelf) {
      this._scrollRewardsShelf = false;
      requestAnimationFrame(() => { try { shelf.scrollIntoView({ block: "start" }); } catch (e) {} });
    }
    return shelf;
  },
};

Object.assign(Component.prototype, NG_CHALLENGE_UI_METHODS);
