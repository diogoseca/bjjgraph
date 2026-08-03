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

const NG_CHALLENGE_UI_METHODS = {
  renderKnowledgeHeader() {
    const el = this.knowledgeRef && this.knowledgeRef.current;
    if (!el) return;
    const game = this.gameScore();
    const score = Math.max(0, Math.min(100, game.score * 100));
    const belt = game.belt
      ? game.belt.charAt(0).toUpperCase() + game.belt.slice(1)
      : "Building foundations";
    el.setAttribute(
      "aria-label",
      "Your Game Knowledge: " + score.toFixed(1) + " percent, " + belt,
    );
    el.innerHTML =
      '<div class="ng-knowledge-line"><span>YOUR GAME KNOWLEDGE</span><b>' +
      score.toFixed(1) +
      '% <em>' +
      ngChallengeHTML(belt) +
      "</em></b></div>" +
      '<div class="ng-knowledge-meter" role="meter" aria-label="Game Knowledge" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      score.toFixed(1) +
      '"><i style="width:' +
      score.toFixed(1) +
      '%"></i><em style="left:20%"></em><em style="left:40%"></em><em style="left:60%"></em><em style="left:70%"></em><em style="left:80%"></em></div>' +
      "<p>Proven recall, not challenge completion.</p>";
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
    } else if (view === "collection") {
      this.track("neural_collection_opened", {
        patches: Object.keys(this.badges || {}).length,
        coins: Object.keys(this.coins || {}).length,
      });
    }
  },

  selectedChallengeTrack() {
    const requested = this.get(
      "challengeSelectedTrack",
      this.get("challengePinnedTrack", "white"),
    );
    return NG_CHALLENGE_TRACKS.some((track) => track.id === requested)
      ? requested
      : "white";
  },

  selectChallengeTrack(trackId) {
    if (!NG_CHALLENGE_TRACKS.some((track) => track.id === trackId)) return;
    if (this.selectedChallengeTrack() !== trackId) {
      this.set("challengeSelectedTrack", trackId);
      this.track("neural_challenge_track_viewed", { track_id: trackId });
    }
    this.renderExplorer();
  },

  pinChallengeTrack(trackId) {
    if (!NG_CHALLENGE_TRACKS.some((track) => track.id === trackId)) return;
    this.set("challengePinnedTrack", trackId);
    this.set("challengeCueVisible", true);
    this.tutHidden = false;
    this.track("neural_challenge_pinned", { track_id: trackId });
    this.renderExplorer();
    this.renderChallengeCue();
  },

  openLearningView(view, trackId) {
    if (trackId) {
      this.settings = this.settings || {};
      this.settings.challengeSelectedTrack = trackId;
      (this._settingsAt = this._settingsAt || {}).challengeSelectedTrack =
        Date.now();
    }
    this.setViewMode(view);
    this.openExplorer();
    this.showExplorerList();
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

  challengeCurriculumElement(trackId) {
    const section = document.createElement("section");
    section.className = "ng-challenge-curriculum";
    const belt =
      this.curriculum &&
      this.curriculum.belts.find((item) => item.id === trackId);
    if (!belt) {
      section.innerHTML =
        "<small>CURRICULUM PRACTICE</small><p>Curriculum is unavailable right now. Action challenges still work.</p>";
      return section;
    }
    section.innerHTML =
      "<small>OPEN CURRICULUM PRACTICE</small><p>Every lesson is open. Checkpoints and the optional capstone ask for evidence first.</p>";
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
      if (index === 0) details.open = true;
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
          "</small></span>";
        button.addEventListener("click", () =>
          this.openLessonStudy(lesson, unit, belt),
        );
        lessons.appendChild(button);
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
      const game = this.gameScore();
      const suggested = game.belt || "white";
      const suggestedIndex = NG_CHALLENGE_TRACKS.findIndex(
        (track) => track.id === suggested,
      );
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
      const tracks = document.createElement("section");
      tracks.className = "ng-track-list";
      tracks.setAttribute("aria-label", "Challenge tracks");
      for (let index = 0; index < NG_CHALLENGE_TRACKS.length; index += 1) {
        const track = NG_CHALLENGE_TRACKS[index];
        const summary = this.challengeTrackProgress(track.id);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ng-track-card";
        button.setAttribute("data-track", track.id);
        button.setAttribute(
          "aria-pressed",
          track.id === selected.id ? "true" : "false",
        );
        button.style.setProperty(
          "--ng-track",
          NG_CHALLENGE_TRACK_COLORS[track.id],
        );
        const advice =
          index > Math.max(0, suggestedIndex)
            ? "Advanced material - swing away."
            : track.id === suggested
              ? "Suggested for your Game Knowledge"
              : "Open from day one";
        button.innerHTML =
          '<span class="ng-track-token" aria-hidden="true"></span><span><small>' +
          track.id.toUpperCase() +
          " CONTENT TRACK</small><b>" +
          ngChallengeHTML(track.name) +
          "</b><em>" +
          advice +
          "</em></span><strong>" +
          summary.done +
          " of " +
          summary.total +
          "</strong>";
        button.addEventListener("click", () =>
          this.selectChallengeTrack(track.id),
        );
        tracks.appendChild(button);
      }
      list.appendChild(tracks);

      const summary = this.challengeTrackProgress(selected.id);
      const detail = document.createElement("section");
      detail.className = "ng-challenge-detail";
      detail.setAttribute(
        "aria-label",
        selected.name + " challenges",
      );
      detail.innerHTML =
        '<div class="ng-challenge-detail-head"><div><small>' +
        selected.id.toUpperCase() +
        " CONTENT TRACK</small><h2>" +
        ngChallengeHTML(selected.name) +
        "</h2></div><span>" +
        summary.done +
        " of " +
        summary.total +
        '</span></div><button type="button" class="ng-pin-track">' +
        (this.get("challengePinnedTrack", "white") === selected.id
          ? "Pinned to my roll"
          : "Pin this track to my roll") +
        "</button>";
      detail
        .querySelector(".ng-pin-track")
        .addEventListener("click", () =>
          this.pinChallengeTrack(selected.id),
        );
      for (const definition of NG_CHALLENGES) {
        if (definition.track === selected.id) {
          detail.appendChild(
            this.challengeObjectiveElement(definition, selected.id),
          );
        }
      }
      detail.appendChild(this.challengeCurriculumElement(selected.id));
      list.appendChild(detail);
    } finally {
      this._renderingChallengeView = false;
    }
  },

  collectionItem(definition, kind) {
    const earnedMap = kind === "patch" ? this.badges || {} : this.coins || {};
    const earned = earnedMap[definition.id];
    const article = document.createElement("article");
    article.className =
      kind === "patch" ? "ng-patch-badge" : "ng-mat-coin";
    article.setAttribute("data-earned", earned ? "true" : "false");
    article.setAttribute(
      "aria-label",
      definition.name + ": " + (earned ? "earned" : "available to earn"),
    );
    if (kind === "patch") {
      article.innerHTML =
        '<span aria-hidden="true">' +
        (earned ? "BJJ" : "") +
        "</span><b>" +
        ngChallengeHTML(definition.name) +
        "</b><small>" +
        (earned ? ngChallengeHTML(definition.detail) : "Available to earn") +
        "</small>";
    } else {
      article.innerHTML =
        '<span aria-hidden="true">' +
        ngChallengeHTML(definition.name.slice(0, 2).toUpperCase()) +
        "</span><div><b>" +
        ngChallengeHTML(definition.name) +
        "</b><small>" +
        (earned ? ngChallengeHTML(definition.detail) : "Available to earn") +
        "</small></div>";
    }
    return article;
  },

  renderCollection(list) {
    this.noteLearningViewOpen("collection");
    this._pathDim = false;
    const intro = document.createElement("section");
    intro.className = "ng-collection-intro";
    const earned = Object.keys(this.badges || {}).length +
      Object.keys(this.coins || {}).length;
    intro.innerHTML =
      "<small>COLLECTION</small><h2>" +
      (earned ? "Proof from the mat" : "Your first patch is ahead") +
      "</h2><p>Patches mark meaningful milestones. Mat Coins are just for laughs. They do not buy anything.</p>";
    list.appendChild(intro);
    const patchSection = document.createElement("section");
    patchSection.className = "ng-collection-section";
    patchSection.innerHTML =
      "<div><h3>Patches</h3><span>" +
      Object.keys(this.badges || {}).length +
      " earned</span></div><div class=\"ng-patch-grid\"></div>";
    for (const patch of NG_BADGE_DEFINITIONS) {
      patchSection
        .querySelector(".ng-patch-grid")
        .appendChild(this.collectionItem(patch, "patch"));
    }
    list.appendChild(patchSection);
    const coinSection = document.createElement("section");
    coinSection.className = "ng-collection-section";
    coinSection.innerHTML =
      "<div><h3>Mat Coins</h3><span>" +
      Object.keys(this.coins || {}).length +
      " minted once</span></div><div class=\"ng-coin-list\"></div>";
    for (const coin of NG_MAT_COINS) {
      coinSection
        .querySelector(".ng-coin-list")
        .appendChild(this.collectionItem(coin, "coin"));
    }
    list.appendChild(coinSection);
  },
};

Object.assign(Component.prototype, NG_CHALLENGE_UI_METHODS);
