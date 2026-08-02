const NG_CHALLENGE_FEEDBACK_METHODS = {
  renderChallengeCue() {
    const remove = () => {
      if (!this._tutEl) return;
      try {
        this._tutEl.remove();
      } catch (e) {}
      this._tutEl = null;
    };
    const visible =
      this.get("challengeCueVisible", true) &&
      !this.tutHidden &&
      !this._coach &&
      !(
        this.explorerRef &&
        this.explorerRef.current &&
        this.explorerRef.current.style.display === "flex"
      );
    if (!visible) {
      remove();
      return;
    }
    const trackId = this.get("challengePinnedTrack", "white");
    const track =
      NG_CHALLENGE_TRACKS.find((item) => item.id === trackId) ||
      NG_CHALLENGE_TRACKS[0];
    const summary = this.challengeTrackProgress(track.id);
    const current = this.challengeCurrent(track.id);
    const ack = this._challengeCueAck;
    const title = ack
      ? "Challenge complete - next up"
      : current
        ? current.title
        : track.name + " cleared";
    const detail = ack
      ? current
        ? current.title
        : "Browse another open track"
      : current
        ? current.action
        : "Patch added to your Collection";
    let el = this._tutEl;
    if (!el) {
      el = document.createElement("aside");
      el.className = "ng-tut ng-challenge-cue";
      el.setAttribute("data-tut", "1");
      el.setAttribute("data-challenge-cue", "1");
      (this.__ngRoot || document.body).appendChild(el);
      this._tutEl = el;
    }
    el.setAttribute(
      "data-tut-step",
      current && current.legacyId ? current.legacyId : current ? current.id : "",
    );
    el.innerHTML =
      '<button type="button" data-challenge-cue-open><span class="ng-cue-head"><small>' +
      track.id.toUpperCase() +
      ' CHALLENGES</small><span data-tut-count>' +
      summary.done +
      "/" +
      summary.total +
      "</span></span><b data-tut-copy>" +
      ngChallengeHTML(title) +
      '</b><span class="ng-cue-detail">' +
      ngChallengeHTML(detail) +
      "<em>Open Challenges</em></span></button>" +
      '<button type="button" data-tut-hide aria-label="Hide challenge cue" title="Hide challenge cue">&times;</button>' +
      '<span class="ng-sr-only" aria-live="polite">' +
      (ack ? ngChallengeHTML(title + ". " + detail) : "") +
      "</span>";
    el
      .querySelector("[data-challenge-cue-open]")
      .addEventListener("click", () =>
        this.openLearningView("challenges", track.id),
      );
    el.querySelector("[data-tut-hide]").addEventListener("click", () => {
      this.tutHidden = true;
      this.set("challengeCueVisible", false);
      this.track("neural_challenge_cue_hidden", { track_id: track.id });
      this.renderChallengeCue();
    });
  },

  renderTutorial() {
    this.renderChallengeCue();
  },

  acknowledgeChallenge(id) {
    const definition = NG_CHALLENGE_BY_ID[id];
    if (
      !definition ||
      definition.hidden ||
      definition.track !== this.get("challengePinnedTrack", "white")
    ) {
      this.renderChallengeCue();
      return;
    }
    this._challengeCueAck = id;
    clearTimeout(this._challengeCueTimer);
    this.renderChallengeCue();
    this._challengeCueTimer = setTimeout(() => {
      this._challengeCueAck = null;
      this.renderChallengeCue();
    }, 2800);
  },

  queueChallengeReward(kind, id) {
    this._challengeRewardQueue = this._challengeRewardQueue || [];
    this._challengeRewardQueue.push({ kind, id });
    if (!this._challengeRewardActive) this.showNextChallengeReward();
  },

  showNextChallengeReward() {
    const reward = (this._challengeRewardQueue || []).shift();
    if (!reward) {
      this._challengeRewardActive = null;
      return;
    }
    const definitions =
      reward.kind === "patch" ? NG_BADGE_DEFINITIONS : NG_MAT_COINS;
    const definition = definitions.find((item) => item.id === reward.id);
    if (!definition) {
      this.showNextChallengeReward();
      return;
    }
    this._challengeRewardActive = reward;
    if (this._challengeRewardEl) this._challengeRewardEl.remove();
    const el = document.createElement("section");
    el.className = "ng-challenge-reward";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("data-reward", reward.kind);
    el.innerHTML =
      '<span class="' +
      (reward.kind === "patch" ? "ng-reward-patch" : "ng-reward-coin") +
      '" aria-hidden="true">' +
      (reward.kind === "patch"
        ? "BJJ"
        : ngChallengeHTML(definition.name.slice(0, 2).toUpperCase())) +
      "</span><div><small>" +
      (reward.kind === "patch" ? "PATCH EARNED" : "MAT COIN MINTED") +
      "</small><b>" +
      ngChallengeHTML(definition.name) +
      '</b><button type="button" data-reward-collection>View Collection</button></div><button type="button" data-reward-close aria-label="Dismiss reward">&times;</button>';
    (this.__ngRoot || document.body).appendChild(el);
    this._challengeRewardEl = el;
    const dismiss = () => {
      clearTimeout(this._challengeRewardTimer);
      if (this._challengeRewardEl) this._challengeRewardEl.remove();
      this._challengeRewardEl = null;
      this._challengeRewardActive = null;
      this.showNextChallengeReward();
    };
    el
      .querySelector("[data-reward-collection]")
      .addEventListener("click", () => {
        dismiss();
        this.openLearningView("collection");
      });
    el.querySelector("[data-reward-close]").addEventListener("click", dismiss);
    this._challengeRewardTimer = setTimeout(dismiss, 4800);
  },
};

Object.assign(Component.prototype, NG_CHALLENGE_FEEDBACK_METHODS);
