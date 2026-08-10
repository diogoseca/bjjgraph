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
    // The meter IS a belt (v1.90.0) — woven strap, rank bar, tape stripes. Display-only by
    // canon: it reads gameScore() and nothing reads it back. Black wears the red bar and no
    // stripe ladder (the stripe system ends at black — owner's rule).
    const B = this.BELT_SCORE;
    let lo = 0;
    let hi = B[0][1];
    for (let i = 0; i < B.length; i++)
      if (game.belt === B[i][0]) {
        lo = B[i][1];
        hi = i + 1 < B.length ? B[i + 1][1] : 1;
      }
    const pct = Math.max(
      0,
      Math.min(100, Math.round(((game.score - lo) / (hi - lo)) * 100)),
    );
    const black = game.belt === "black";
    const stripes = black ? 0 : game.stripes;
    const next = game.next || (game.belt ? null : "white");
    const road = next ? pct + "% to " + next : "";
    const label = black
      ? "Black belt"
      : (game.belt
          ? belt + " belt, " + stripes + (stripes === 1 ? " stripe" : " stripes")
          : belt) + (road ? " — " + road : "");
    // a stripe EARNED on the same belt gets the tape-wrap animation (data-new)
    const prev = this._beltShown;
    const fresh =
      prev && prev.belt === game.belt && stripes > prev.stripes
        ? prev.stripes
        : stripes;
    this._beltShown = { belt: game.belt, stripes: stripes };
    let tape = "";
    for (let i = 0; i < stripes; i++)
      tape += i >= fresh ? "<b data-new></b>" : "<b></b>";
    el.innerHTML =
      '<div class="ng-knowledge-line"><span>YOUR GAME KNOWLEDGE</span><b>' +
      score.toFixed(1) +
      '% <em>' +
      ngChallengeHTML(belt) +
      "</em></b></div>" +
      '<div class="ng-knowledge-meter ng-belt" role="meter" data-belt="' +
      (game.belt || "none") +
      '" aria-label="' +
      ngChallengeHTML(label) +
      '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      score.toFixed(1) +
      '"><i class="ng-belt-bar" aria-hidden="true">' +
      tape +
      "</i></div>" +
      "<p>Proven recall, not challenge completion." +
      (road ? " " + road + " belt." : "") +
      "</p>";
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
    // the frontier lesson (pinned track only) gets the glow — everything else that's not
    // done yet dims gently via CSS on data-lesson-done (visual only; every row stays live)
    const pinnedId = this.get("challengePinnedTrack", "white");
    const frontier = trackId === pinnedId ? this.challengeFrontier(trackId) : null;
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
        // A lesson row is also a technique a coach may have covered in class, so it carries the
        // same + affordance as Explore/dossier/landing. The button must be a SIBLING: a nested
        // <button> closes the outer one in the HTML parser and would break the row entirely.
        const lessonIdx = this._lessonNodeIdx ? this._lessonNodeIdx(lesson.deckKey) : -1;
        const lessonNode = lessonIdx >= 0 && this.nodes ? this.nodes[lessonIdx] : null;
        if (lessonNode) {
          const lessonRow = document.createElement("div");
          lessonRow.className = "ng-challenge-lessonrow";
          lessonRow.appendChild(button);
          lessonRow.appendChild(this._listAddButton(lessonNode.id, "lesson"));
          lessons.appendChild(lessonRow);
        } else {
          lessons.appendChild(button);
        }
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
      // CONTINUE — the zero-thought next step: jump straight to the pinned track's frontier
      const pinnedId = this.get("challengePinnedTrack", "white");
      const frontier = this.challengeFrontier(pinnedId);
      if (frontier) {
        const go = document.createElement("button");
        go.type = "button";
        go.className = "ng-challenge-continue";
        go.setAttribute("data-challenge-continue", "1");
        go.style.setProperty("--ng-track", NG_CHALLENGE_TRACK_COLORS[pinnedId]);
        go.innerHTML =
          "<span><small>CONTINUE · " +
          pinnedId.toUpperCase() +
          "</small><b>" +
          ngChallengeHTML(frontier.lesson.deckKey.split("|")[0]) +
          "</b></span><em aria-hidden=\"true\">▸</em>";
        go.addEventListener("click", () =>
          this.openLessonStudy(frontier.lesson, frontier.unit, frontier.belt),
        );
        list.appendChild(go);
      }

      // THE LADDER — all five tracks top to bottom, whole journey visible (the old Belt
      // Path feel): belt-header rows carry selection; the selected track's objectives ride
      // under its header; every track's curriculum is always on the ladder. No locks.
      const ladder = document.createElement("section");
      ladder.className = "ng-track-list ng-challenge-ladder";
      ladder.setAttribute("aria-label", "Challenge tracks");
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
        ladder.appendChild(button);

        if (track.id === selected.id) {
          const detail = document.createElement("section");
          detail.className = "ng-challenge-detail";
          detail.setAttribute("aria-label", selected.name + " challenges");
          detail.style.setProperty("--ng-track", NG_CHALLENGE_TRACK_COLORS[track.id]);
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
            (pinnedId === selected.id
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
          ladder.appendChild(detail);
        }

        const curriculum = this.challengeCurriculumElement(track.id);
        curriculum.style.setProperty("--ng-track", NG_CHALLENGE_TRACK_COLORS[track.id]);
        ladder.appendChild(curriculum);
      }
      list.appendChild(ladder);
      list.appendChild(this.renderRewardsShelf());
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

  // The Collection tab retired in v1.76.0 — its content lives here, a rewards shelf at the
  // foot of the Challenges tab. Same items, same handles (ng-patch-badge / ng-mat-coin /
  // data-earned); one <details> so Challenges stays scannable.
  renderRewardsShelf() {
    const patches = Object.keys(this.badges || {}).length;
    const coins = Object.keys(this.coins || {}).length;
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
    const patchSection = document.createElement("section");
    patchSection.className = "ng-collection-section";
    patchSection.innerHTML =
      "<div><h3>Patches</h3><span>" +
      patches +
      " earned</span></div><div class=\"ng-patch-grid\"></div>";
    for (const patch of NG_BADGE_DEFINITIONS) {
      patchSection
        .querySelector(".ng-patch-grid")
        .appendChild(this.collectionItem(patch, "patch"));
    }
    shelf.appendChild(patchSection);
    const coinSection = document.createElement("section");
    coinSection.className = "ng-collection-section";
    coinSection.innerHTML =
      "<div><h3>Mat Coins</h3><span>" +
      coins +
      " minted once</span></div><div class=\"ng-coin-list\"></div>";
    for (const coin of NG_MAT_COINS) {
      coinSection
        .querySelector(".ng-coin-list")
        .appendChild(this.collectionItem(coin, "coin"));
    }
    shelf.appendChild(coinSection);
    if (this._scrollRewardsShelf) {
      this._scrollRewardsShelf = false;
      requestAnimationFrame(() => { try { shelf.scrollIntoView({ block: "start" }); } catch (e) {} });
    }
    return shelf;
  },
};

Object.assign(Component.prototype, NG_CHALLENGE_UI_METHODS);
