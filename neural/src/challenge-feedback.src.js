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

  // D-326: a notice yields while a move executes. A full-width phone notice left the
  // execution camera nowhere to frame the move. One already showing goes back to the
  // queue's front; clearExecution shows it again, with its full time, once the move lands.
  holdChallengeReward() {
    const reward = this._challengeRewardEl && this._challengeRewardActive;
    if (reward) this._challengeRewardQueue.unshift(reward), this._challengeRewardDismiss();
  },

  // The theater yields the same way (REV332 S1). Its dialog is in the top layer, so a notice shown
  // under it runs out its 4.8 seconds unseen and never comes back. _openFilmTheater holds, and
  // collapseClip releases, exactly as startExecution and clearExecution do.
  showNextChallengeReward() {
    if (this._execution || this._filmTheater || this.__ngDestroyed) return;
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
    // The notice is ambient. Only its deliberate controls take input; its prose
    // must not swallow a graph pan or an arrow in the nearby videos row.
    for (const b of el.querySelectorAll("button")) b.style.pointerEvents = "auto";
    // THE MAP UNDER THE CARD COMES BACK IN THE SAME TASK (v1.280.0, GOLD1-R1). On a phone this card covers the node band, and
    // the position's own name and its seat star are not written under paint (POSNAME, `_hides`), so they come back with the
    // first frame drawn after it goes: the frame loop's next one in the app (16 ms), but a journey's clock draws only when
    // pumped, so a press on the ✕ and a look for the star met the frame drawn under the card (lists-picker.spec.ts's phone
    // test; dev drew the star under the card and kept it). One frame drawn by each close (the ✕, View Collection, the card's
    // own timer), AFTER that close's own work (GOLD1-R3): drawn inside `dismiss`, it ran before View Collection opened the
    // Path, and a frame that threw there stopped the handler (challenges-ui.spec.ts, "a Mat Coin acknowledgement": the card
    // closed before the frame clock's first tick, `now` undefined, so the arrival glow's age read NaN and its gradient
    // threw). No frame before that first tick: nothing was drawn under the card yet, and the first frame draws the map.
    // `holdChallengeReward` draws none: the move's own frames follow.
    const redraw = () => {
      if (this.ctx && this.nodes && Number.isFinite(this.now) && typeof this.draw === "function") this.draw();
    };
    const dismiss = (this._challengeRewardDismiss = () => {
      clearTimeout(this._challengeRewardTimer);
      if (this._challengeRewardEl) this._challengeRewardEl.remove();
      this._challengeRewardEl = null;
      this._challengeRewardActive = null;
      this.showNextChallengeReward();
    });
    el
      .querySelector("[data-reward-collection]")
      .addEventListener("click", () => {
        dismiss();
        // VIEW COLLECTION LANDS ON THE SHELF IN MASTER THE GAME (O1, v1.284.0, SET1 slice B): the Path it opened left the
        // drawer; the same shelf is drawn at the foot of Master the game's corridor (`renderChallenges`), and this flag opens
        // it and scrolls it into view there (`renderRewardsShelf`). `openLearningView("challenges")` → `openCorridor`.
        this._scrollRewardsShelf = true;
        this.openLearningView("challenges");
        redraw();
      });
    el.querySelector("[data-reward-close]").addEventListener("click", () => {
      dismiss();
      redraw();
    });
    this._challengeRewardTimer = setTimeout(() => {
      dismiss();
      redraw();
    }, 4800);
  },
};

Object.assign(Component.prototype, NG_CHALLENGE_FEEDBACK_METHODS);
