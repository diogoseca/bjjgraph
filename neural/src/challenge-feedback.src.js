const NG_CHALLENGE_FEEDBACK_METHODS = {
  // ── THE CUE CARD IS RETIRED (v1.133.0, owner: "let's also remove the learning card. I don't
  // think that's helping very much right now.") ── the persistent bottom-left "WHITE CHALLENGES ·
  // Preview a move" card is gone: it congratulated arrival, occluded the phone's focus label (the
  // repo's long-standing STILL OPEN collision), and trained newcomers to dismiss the one channel
  // that talked to them. The challenge ENGINE is untouched — objectives still tick from beats and
  // the pane's Challenges tab is the surface. This method survives as a REMOVER so every existing
  // call site stays harmless and a live profile's mounted cue is cleaned up on the next call.
  renderChallengeCue() {
    if (!this._tutEl) return;
    try {
      this._tutEl.remove();
    } catch (e) {}
    this._tutEl = null;
  },
  renderTutorial() {
    this.renderChallengeCue();
  },

  acknowledgeChallenge(id) {
    const definition = NG_CHALLENGE_BY_ID[id];
    if (
      !definition ||
      definition.hidden ||
      definition.track !== this._frontierBeltId()
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
        this._scrollRewardsShelf = true; // open + scroll the shelf inside Challenges
        this.openLearningView("challenges");
      });
    el.querySelector("[data-reward-close]").addEventListener("click", dismiss);
    this._challengeRewardTimer = setTimeout(dismiss, 4800);
  },
};

Object.assign(Component.prototype, NG_CHALLENGE_FEEDBACK_METHODS);
