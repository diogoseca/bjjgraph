# Changelog Archive — the full narrative behind every rule in CLAUDE.md

**This is a grep target, not a read target.** It is ~290,000 chars. Nobody should open it
top-to-bottom, and nothing here is loaded into a session automatically.

**It is NOT authoritative for current behaviour.** `CLAUDE.md` is authoritative for the rules,
`docs/Neural.md` for how the app behaves today, `docs/Architecture.md` for the data pipeline.
This file records *why* things are the way they are, in the words used at the time.

**STALE BY CONSTRUCTION.** Every measurement here was true as of its own version and must be
re-measured before being quoted. Entries assert present-tense behaviour and roughly a third of
them have since been superseded — that is the nature of a changelog, not a defect in it.

> **A `Status:` line appears only where a supersession or reversal was actually identified.**
> Its ABSENCE means *not reviewed*, never *still true*. Do not read silence as currency.

**How to use it**

```bash
grep -n 'attachInput'  docs/Changelog-Archive.md   # every time a seam was touched
grep -n 'siteIdOf'     docs/Changelog-Archive.md
grep -n '^## v1.125.0' docs/Changelog-Archive.md   # one version's story
```

Index B below answers *"I am about to touch X — what happened to it before?"*, which is how
people actually arrive here. Index A answers *"what shipped in vN?"*.

---

## Index A — by version

Newest first. Where a narrative's own label disagrees with git, the real shipping version is
given and the label is kept as an alias — **the labels in this document are not reliable keys**:
four separate commits are titled `v1.107.0`, nine are titled `v1.80.3`.

- **v1.148.0** — [MULTIPLE CHOICE DROPS TO THREE, AND THE TRAP SURVIVES THE CUT](#v1-148-0-multiple-choice-drops-to-three-and-the-t)
- **v1.147.0** — [THE PANE'S TAB BAR IS A PAGER](#v1-147-0-the-pane-s-tab-bar-is-a-pager)
- **v1.146.1** — [THE HOST STYLESHEET REACHED INTO THE APP'S MODAL](#v1-146-1-the-host-stylesheet-reached-into-the-a)
- **v1.146.0** — [THE SCORE COULD NOT SEE ITS OWN RULESET](#v1-146-0-the-score-could-not-see-its-own-ruleset)
- **v1.145.13** — [THE SCORE COVERS THE WHOLE CORPUS](#v1-145-13-the-score-covers-the-whole-corpus)
- **v1.145.10** — [WHAT THE SCORE CANNOT SEE, SIZED](#v1-145-10-what-the-score-cannot-see-sized)
- **v1.145.1** — [THE COLLAR CHOKE THAT WAS NOT A BUG, AND THE PANEL THAT WAS NOT A PANEL](#v1-145-1-the-collar-choke-that-was-not-a-bug)
- **v1.138.0** — [THE EXPIRY SENTENCE IS A LEASE, NOT A RESIDENT](#v1-138-0-the-expiry-sentence-is-a-lease-not-a-res)
- **v1.137.0** — [THE CLOCK WAITS FOR THE PLAYER](#v1-137-0-the-clock-waits-for-the-player)
- **v1.136.0** — [THE SHEET IS THE CARD YOU PRESSED, AND IT FINALLY OUTRANKS IT](#v1-136-0-the-sheet-is-the-card-you-pressed-and-it)
- **v1.135.1** — [THE EXPIRY STOPS FLASHING, AND THE COMMIT GETS ITS CAMERA](#v1-135-1-the-expiry-stops-flashing-and-the-commit)
- **v1.135.0** — [THE ROLE WORD RIDES ITS ORB, AND SPENT MEANS SPENT](#v1-135-0-the-role-word-rides-its-orb-and-spent-me)
- **v1.134.0** — [THE TRANSPORT DIES: THE GAME GOES FULLY TURN-BASED](#v1-134-0-the-transport-dies-the-game-goes-fully-t)
- **v1.133.0** — [THE CLOCK MOVES TO THE QUESTION, AND THE CUE CARD RETIRES](#v1-133-0-the-clock-moves-to-the-question-and-the)
- **v1.132.2** — [RECOGNITION COMES FIRST: EVERY DECK BUILDS A MULTIPLE CHOICE NOW](#v1-132-2-recognition-comes-first-every-deck-build)
- **v1.132.1** — [THE TECHNIQUE CARD WAS CHROME-ONLY, AND ALL THREE CAUSES WERE MEASURED](#v1-132-1-the-technique-card-was-chrome-only-and-a)
- **v1.132.0** — [CLICKING A TECHNIQUE LANDS ON IT, AND THE RUNG IS RETIRED](#v1-132-0-clicking-a-technique-lands-on-it-and-the)
- **v1.131.0** — [THE LANDING CARD GETS RUNGS AND PAGES ITS OWN DECK](#v1-131-0-the-landing-card-gets-rungs-and-pages-it)
- **v1.129.8** — [THE CAPTURE STAR](#v1-129-8-the-capture-star)
- **v1.129.6** — [THE OPENING FLIGHT AIMS AT THE CARD'S BAND](#v1-129-6-the-opening-flight-aims-at-the-card-s-ba)
- **v1.129.5** — [TAPPING A NODE IS COMING BACK](#v1-129-5-tapping-a-node-is-coming-back)
- **v1.129.4** — [THE ROLE WORD, THE BLOCK'S ALIGNMENT, AND FOUR PATCH BUMPS](#v1-129-4-the-role-word-the-block-s-alignment-and)
- **v1.129.3** — [THE HAND SCROLLS SMOOTHLY, AND AN ATTEMPT CARD CAN GO THERE](#v1-129-3-the-hand-scrolls-smoothly-and-an-attempt)
- **v1.129.1** — [FOUR OWNER REPORTS FROM ONE SITTING](#v1-129-1-four-owner-reports-from-one-sitting)
- **v1.129.0** — [HESITATION COSTS THE INITIATIVE, AND A NAME IS TWO LINES](#v1-129-0-hesitation-costs-the-initiative-and-a-na)
- **v1.128.1** — [THREE THINGS THE OWNER SAW IN ONE SITTING](#v1-128-1-three-things-the-owner-saw-in-one-sittin)
- **v1.128.0** — [MERGE AND SPLIT — the two phases, and the label group belongs to BOTH](#v1-128-0-merge-and-split-the-two-phases-and-the-l)
- **v1.127.2** — [THE CORE SUITE HAD A 1-IN-13 FLAKE AND FOUR GREEN RUNS HID IT](#v1-127-2-the-core-suite-had-a-1-in-13-flake-and-f)
- **v1.127.2** — [TWO THINGS THE OWNER SHOOT FOUND, BOTH PRE-EXISTING, NEITHER FIXED](#v1-127-2-two-things-the-owner-shoot-found-both-pr)
- **v1.127.0** — [THE PAIR JOURNEYS COME HOME](#v1-127-0-the-pair-journeys-come-home)
- **v1.127.0** — [GATES AT v1.127.0](#v1-127-0-gates-at-v1-127-0)
- **v1.126.0** — [THE PROTOTYPE IS RETIRED, AND EVERY ID-KEYED JOIN IS AUDITED](#v1-126-0-the-prototype-is-retired-and-every-id-ke)
- **v1.126.0** — [GATES AT v1.126.0](#v1-126-0-gates-at-v1-126-0)
- **v1.125.0** — [THE PAIR IS THE DEFAULT, AND IT IS DERIVED AT INGEST](#v1-125-0-the-pair-is-the-default-and-it-is-derive)
- **v1.125.0** — [THE GRAPH'S POSITION COLOURS WERE TOP-RELATIVE — RE-MEASURED, AND v1.125.0 ANSWERED MOST OF IT](#v1-125-0-the-graph-s-position-colours-were-top-re)
- **v1.124.0** — [WINNING vs NOT LOSING — the loss-aversion dial](#v1-124-0-winning-vs-not-losing-the-loss-aversion)
- **v1.123.0** — [SHOW EVERY OPTION — THE HAND IS NO LONGER CAPPED](#v1-123-0-show-every-option-the-hand-is-no-longer)
- **v1.123.0** — [WHAT UNCAPPING HAD TO PAY FOR — TWO THINGS THAT DO NOT SCALE](#v1-123-0-what-uncapping-had-to-pay-for-two-things)
- **v1.123.0** — [THE OVERFLOW HINT: ABOVE THE HAND, AND THE BREAKPOINT WAS MISSING A DEVICE](#v1-123-0-the-overflow-hint-above-the-hand-and-the)
- **v1.123.0** — [WHAT UNCAPPING DID *NOT* TOUCH, AND ONE THING IT MAKES WORSE](#v1-123-0-what-uncapping-did-not-touch-and-one-thi)
- **v1.123.0** — [WHAT IT CAN AND CANNOT REACH — and the strongest guarantee is a gift from v1.123.0](#v1-123-0-what-it-can-and-cannot-reach-and-the-str)
- **v1.122.0** — [THE `cardOrder` SETTING IS RETIRED — THE SETTING GOES, NOT THE SECOND MODE (v1.122.0, owner's](#v1-122-0-the-cardorder-setting-is-retired-the-set)
- **v1.121.0** — [THE HONESTY GAPS. There were two; ONE IS CLOSED and one is still live](#v1-121-0-the-honesty-gaps-there-were-two-one-is-c)
- **v1.121.0** — [THE MISS DISTRIBUTION THE CARD PRICES IS NOW THE ONE THE ROLL ROLLS](#v1-121-0-the-miss-distribution-the-card-prices-is)
- **v1.119.0** — [THE HAND'S FOUR OTHER INVARIANTS, WALKED OVER ALL 272 ROLE-HANDS](#v1-119-0-the-hand-s-four-other-invariants-walked)
- **v1.116.0** — [EDGE — THE MODEL BEHIND THE NUMBER](#v1-116-0-edge-the-model-behind-the-number)
- **v1.115.0** — [THE `cal` JOIN WAS SPELLING THE KEY WRONG, AND 294 OF 297 SUBMISSIONS SHIPPED NO ODDS](#v1-115-0-the-cal-join-was-spelling-the-key-wrong)
- **v1.114.4** — [THE FRAMING BAND, AND WHY A PAIR SWAP MOVED THE CAMERA AT ALL](#v1-114-4-the-framing-band-and-why-a-pair-swap-mov)
- **v1.114.3** — [THE LABEL GROUP IS THE RULE NOW, NOT THE FOCUS'S PRIVILEGE](#v1-114-3-the-label-group-is-the-rule-now-not-the)
- **v1.114.3** — [A DUAL PAIR IS ONE STATE WITH TWO HALVES](#v1-114-3-a-dual-pair-is-one-state-with-two-halves)
- **v1.114.2** — [ARRIVING ON A NODE'S PAGE SETS THE BOARD; IT DOES NOT START A ROLL](#v1-114-2-arriving-on-a-node-s-page-sets-the-board)
- **v1.114.1** — [ONE CLOCK — the countdown bar cannot disagree with the number it draws](#v1-114-1-one-clock-the-countdown-bar-cannot-disag)
- **v1.114.0** — [ZOOM IS A CAMERA, AND THE ARRIVAL IS THE EVENT](#v1-114-0-zoom-is-a-camera-and-the-arrival-is-the)
- **v1.109.0** _(narrative says v1.106.5)_ — [LAST ROLLS: ▶ ROLL FROM HERE, ⟲ REPLAY](#v1-106-5-last-rolls-roll-from-here-replay)
- **v1.105.5** — [THE EXPLORE FOOT'S FEEDBACK ROW](#v1-105-5-the-explore-foot-s-feedback-row)
- **v1.105.2** — [A LESSON ROW READS AND LOCATES; IT NEVER TAKES THE PANE OVER](#v1-105-2-a-lesson-row-reads-and-locates-it-never)
- **v1.104.8** — [A STALLED PAYLOAD LEFT THE LANDING QUESTION "STILL SETTLING" FOREVER](#v1-104-8-a-stalled-payload-left-the-landing-quest)
- **v1.104.6** — [THE HARNESS WAS HOLDING A PAYLOAD THAT IS NEVER FETCHED — root cause of 15 red journeys](#v1-104-6-the-harness-was-holding-a-payload-that-i)
- **v1.104.6** — [CI THAT COULD NOT PASS, AND GATES WEAKER THAN THE THING THEY GUARD](#v1-104-6-ci-that-could-not-pass-and-gates-weaker)
- **v1.104.5** — [ONE "START A ROLL HERE", AND THE URL FOLLOWS IT](#v1-104-5-one-start-a-roll-here-and-the-url-follow)
- **v1.104.5** — [THE STAT BAND MOVED TO THE PANE FOOT, AND ITS WEAK-SPOT NUMBER WAS A LIE](#v1-104-5-the-stat-band-moved-to-the-pane-foot-and)
- **v1.104.4** — [THE DEFENCE QUESTION IS ASKED ABOVE THE HAND, NOT INSIDE IT](#v1-104-4-the-defence-question-is-asked-above-the)
- **v1.104.3** — [THE OPTION CARD'S GLYPH AND ITS `+N` MEASURE DIFFERENT THINGS](#v1-104-3-the-option-card-s-glyph-and-its-n-measur)
- **v1.104.2** — [LANDING-CARD CHROME, FOUR OWNER REPORTS](#v1-104-2-landing-card-chrome-four-owner-reports)
- **v1.104.1** — [ONE SUBJECT PER LABEL: THE ANNOUNCER NAMES THE ACTOR, THE GRAPH NAMES YOUR POSTURE](#v1-104-1-one-subject-per-label-the-announcer-name)
- **v1.104.0** — [THE FIRST-ROLL COACH IS DELETED](#v1-104-0-the-first-roll-coach-is-deleted)
- **v1.103.4** — [LISTS READ AS EXPLORE SECTIONS](#v1-103-4-lists-read-as-explore-sections)
- **v1.103.2** — [THE PICKER NO LONGER HIDES WHAT YOU WERE READING](#v1-103-2-the-picker-no-longer-hides-what-you-were)
- **v1.103.2** — [ONE CAMERA FRAMING, AIMED AT THE LABEL, IN THE MEASURED BAND](#v1-103-2-one-camera-framing-aimed-at-the-label-in)
- **v1.103.1** — [THE UNFOLDED CARD, TWO FIXES](#v1-103-1-the-unfolded-card-two-fixes)
- **v1.103.0** — [ROLE CORRECTNESS: WHO MAY PERFORM A MOVE](#v1-103-0-role-correctness-who-may-perform-a-move)
- **v1.101.0** — [ONE CONTAINER: THE GAME'S OWN CARD](#v1-101-0-one-container-the-game-s-own-card)
- **v1.99.4** — [YOUR OWN LIST IS AS LEGIBLE AS A RECEIVED ONE](#v1-99-4-your-own-list-is-as-legible-as-a-receive)
- **v1.95.1** — [THE Z LADDER](#v1-95-1-the-z-ladder)
- **v1.82.3** — [FIRST IMPRESSION](#v1-82-3-first-impression)
- **v1.81.4** — [CAMERA OWNERSHIP — a focus flight holds a LEASE](#v1-81-4-camera-ownership-a-focus-flight-holds-a)
- **v1.81.4** — [THE BOTTOM THUMB BAND](#v1-81-4-the-bottom-thumb-band)
- **v1.81.4** — [ARRIVAL COPY IS HELD, NOT FIRED AT t=0](#v1-81-4-arrival-copy-is-held-not-fired-at-t-0)
- **v1.81.4** — [A DAMAGED SHARE LINK: TWO SENTENCES, ONE SOURCE](#v1-81-4-a-damaged-share-link-two-sentences-one-s)
- **v1.81.3** — [THE PHONE IS THE PRODUCT SURFACE, AND IT DECIDES THE TERMINAL STATE](#v1-81-3-the-phone-is-the-product-surface-and-it)
- **v1.81.3** — [THE LANDING CARD DOCKS OFF THE TRAY'S MEASURED TOP ON MOBILE](#v1-81-3-the-landing-card-docks-off-the-tray-s-me)
- **v1.81.3** — [CAPTURE THE TECHNIQUE, NOT JUST THE POSITION](#v1-81-3-capture-the-technique-not-just-the-posit)
- **v1.81.3** — [Offered once — but THE RECORD LOSES TO THE LIST SET](#v1-81-3-offered-once-but-the-record-loses-to-the)
- **v1.81.3** — [A DAMAGED LINK IS TOLD DURABLY, NOT IN A TOAST](#v1-81-3-a-damaged-link-is-told-durably-not-in-a)
- **v1.81.3** — [The gate checks OMISSION, not only drift](#v1-81-3-the-gate-checks-omission-not-only-drift)
- **v1.81.2** — [Four outcomes for a `/l/<code>` arrival, and they are FOUR DIFFERENT SENTENCES](#v1-81-2-four-outcomes-for-a-l-code-arrival-and-t)
- **v1.81.2** — [HEADERS FOR `/l/*` COME FROM ONE PLACE AT A TIME, AND THE TWO PLACES MUST AGREE](#v1-81-2-headers-for-l-come-from-one-place-at-a-t)
- **v1.81.1** — [Share links — the feature on top](#v1-81-1-share-links-the-feature-on-top)
- **v1.81.0** — [Share links — node ordinals + wire codec](#v1-81-0-share-links-node-ordinals-wire-codec)
- **v1.80.4** — [Neural data delivery: manifest boot + on-demand chunks](#v1-80-4-neural-data-delivery-manifest-boot-on-de)
- **v1.80.2** — [Known follow-up](#v1-80-2-known-follow-up)
- **v1.80.0** — [ONE front-end: the legacy Quartz page UI was deleted](#v1-80-0-one-front-end-the-legacy-quartz-page-ui)
- **v1.76.0** — [ONE PANE](#v1-76-0-one-pane)
- **v1.75.0** — [NEURAL AUDIO — one contextual signal catalog](#v1-75-0-neural-audio-one-contextual-signal-catal)
- **v1.74.0** — [CHALLENGES](#v1-74-0-challenges)
- **v1.70.0** — [MOMENTUM — the combo meter](#v1-70-0-momentum-the-combo-meter)
- **v1.68.0** — [Neural: pane law, landing questions, Challenges, Game Knowledge](#v1-68-0-neural-pane-law-landing-questions-challe)
- **v1.68.0** — [PANE LAW](#v1-68-0-pane-law)
- **v1.68.0** — [QUESTION-FIRST LANDING](#v1-68-0-question-first-landing)
- **v1.68.0** — [ROAM & STAGE](#v1-68-0-roam-stage)
- **v1.68.0** — [GAME KNOWLEDGE = ONE SKILL SCORE , display-only](#v1-68-0-game-knowledge-one-skill-score-display-o)
- **v1.20.0** — [Training System (SRS) — embedded UX](#v1-20-0-training-system-srs-embedded-ux)


---

## Index B — by subject

Generated mechanically from the backticked tokens in each entry (a hand-maintained index rots).
Only symbols touched by two or more versions are listed — a token that appears once is findable
by `grep` and does not need an index row.

- `rollFromPosition` — v1.129.1, v1.127.0, v1.126.0, v1.125.0, v1.114.4, v1.109.0, v1.104.5, v1.103.2, v1.101.0, v1.81.4, v1.70.0
- `_dockLandCard` — v1.127.2, v1.123.0, v1.109.0, v1.104.4, v1.103.1, v1.101.0, v1.81.3
- `graph.json` — v1.125.0, v1.116.0, v1.115.0, v1.104.6, v1.104.3, v1.80.4
- `opponentDefend` — v1.129.0, v1.127.2, v1.125.0, v1.121.0, v1.116.0, v1.109.0
- `rollCamTarget` — v1.129.6, v1.128.1, v1.127.2, v1.114.3, v1.114.2, v1.109.0
- `stageRollAt` — v1.129.5, v1.129.3, v1.129.1, v1.127.0, v1.123.0, v1.114.2
- `adj` — v1.126.0, v1.125.0, v1.123.0, v1.121.0, v1.119.0
- `applyDeckVisibility` — v1.109.0, v1.99.4, v1.95.1, v1.81.3, v1.68.0
- `attachInput` — v1.123.0, v1.114.3, v1.104.4, v1.101.0, v1.81.3
- `camFocus` — v1.127.0, v1.125.0, v1.114.4, v1.114.3, v1.109.0
- `enterAttempt` — v1.129.0, v1.128.1, v1.109.0, v1.99.4, v1.70.0
- `moveChance` — v1.121.0, v1.115.0, v1.104.3, v1.70.0, v1.68.0
- `openDossier` — v1.129.5, v1.129.1, v1.101.0, v1.99.4, v1.81.4
- `openListPicker` — v1.129.8, v1.126.0, v1.103.2, v1.101.0, v1.99.4
- `optionsFor` — v1.123.0, v1.119.0, v1.116.0, v1.104.3, v1.103.0
- `setEvent` — v1.129.0, v1.128.1, v1.104.1, v1.81.4, v1.81.3
- `_pastRolls` — v1.109.0, v1.104.5, v1.76.0, v1.68.0
- `challenges` — v1.109.0, v1.76.0, v1.74.0, v1.68.0
- `confirmPlayFrom` — v1.129.3, v1.126.0, v1.114.2, v1.76.0
- `displayName` — v1.126.0, v1.125.0, v1.114.0, v1.103.0
- `elementFromPoint` — v1.127.2, v1.104.2, v1.103.2, v1.101.0
- `enterLand` — v1.128.1, v1.123.0, v1.114.0, v1.68.0
- `movePotential` — v1.125.0, v1.123.0, v1.122.0, v1.104.3
- `pointerdown` — v1.123.0, v1.101.0, v1.99.4, v1.81.3
- `renderDossier` — v1.129.3, v1.127.0, v1.126.0, v1.101.0
- `title` — v1.129.8, v1.103.4, v1.99.4, v1.76.0
- `top` — v1.126.0, v1.125.0, v1.109.0, v1.82.3
- `Edge` — v1.129.1, v1.122.0, v1.104.3
- `_listAddButton` — v1.101.0, v1.99.4, v1.76.0
- `_redirects` — v1.104.6, v1.81.3, v1.20.0
- `_stagedCamFree` — v1.127.0, v1.114.4, v1.114.3
- `_tickDecision` — v1.128.1, v1.114.1, v1.104.0
- `af3588835ad1c6b6` — v1.123.0, v1.122.0, v1.121.0
- `attemptProbability` — v1.121.0, v1.116.0, v1.68.0
- `build.mjs` — v1.104.6, v1.81.1, v1.81.0
- `cal` — v1.125.0, v1.115.0, v1.80.4
- `cam.vw` — v1.127.2, v1.114.3, v1.105.2
- `challengeOpenSections` — v1.76.0, v1.74.0, v1.68.0
- `challengePinnedTrack` — v1.122.0, v1.74.0, v1.68.0
- `curriculum.weights` — v1.82.3, v1.80.4, v1.68.0
- `deck` — v1.80.4, v1.76.0, v1.68.0
- `enterDefense` — v1.129.0, v1.123.0, v1.109.0
- `expandLandCard` — v1.104.2, v1.103.1, v1.101.0
- `fromRole` — v1.126.0, v1.104.3, v1.103.0
- `globalGraphLayout.json` — v1.125.0, v1.104.6, v1.81.0
- `helmet.html` — v1.129.8, v1.109.0, v1.76.0
- `ingest` — v1.125.0, v1.104.3, v1.99.4
- `land` — v1.129.1, v1.127.2, v1.68.0
- `locateNode` — v1.109.0, v1.105.2, v1.81.4
- `location.pathname` — v1.126.0, v1.104.5, v1.99.4
- `moveEdge` — v1.123.0, v1.122.0, v1.104.3
- `n.y` — v1.127.0, v1.125.0, v1.114.3
- `nodeInAnyList` — v1.129.8, v1.126.0, v1.99.4
- `node_ordinals.json` — v1.127.0, v1.125.0, v1.81.0
- `pairMid` — v1.127.0, v1.125.0, v1.114.3
- `regenerate_neural_data.py` — v1.119.0, v1.103.0, v1.81.0
- `rep` — v1.128.0, v1.126.0, v1.125.0
- `rollLog` — v1.109.0, v1.104.5, v1.76.0
- `scrollLeft` — v1.129.3, v1.129.1, v1.123.0
- `tsc` — v1.129.4, v1.127.0, v1.126.0
- `tut.done` — v1.104.0, v1.74.0, v1.68.0
- `BELT_SCORE` — v1.76.0, v1.68.0
- `Math.random` — v1.127.2, v1.80.4
- `Math.round` — v1.122.0, v1.119.0
- `More` — v1.109.0, v1.101.0
- `ROLL_ZOOM` — v1.109.0, v1.101.0
- `SHARE_STATIC_HEADERS` — v1.81.3, v1.81.2
- `_ambig` — v1.126.0, v1.125.0
- `_bandBot` — v1.129.6, v1.114.4
- `_checkpoint` — v1.104.0, v1.76.0
- `_curriculumIdxSet` — v1.126.0, v1.125.0
- `_dockLandFilm` — v1.114.4, v1.104.2
- `_dockOptionHint` — v1.127.2, v1.123.0
- `_dossierAutoPaused` — v1.129.1, v1.68.0
- `_exploreStatsRow` — v1.129.8, v1.76.0
- `_landBackfill` — v1.104.8, v1.101.0
- `_landEl` — v1.104.4, v1.101.0
- `_landPending` — v1.129.0, v1.70.0
- `_lastPairLabel` — v1.129.4, v1.129.1
- `_nodeAndRoleForPath` — v1.126.0, v1.114.2
- `_nodeCardOn` — v1.114.0, v1.101.0
- `_openSharedListFromUrl` — v1.99.4, v1.81.3
- `_paneAutoPaused` — v1.109.0, v1.68.0
- `_played` — v1.104.5, v1.68.0
- `_posSlugIndex` — v1.125.0, v1.82.3
- `_stageVer` — v1.80.4, v1.68.0
- `_suppressLand` — v1.104.4, v1.101.0
- `_syncUrl` — v1.125.0, v1.104.5
- `_traySup` — v1.129.5, v1.109.0
- `_updateHover` — v1.127.0, v1.114.3
- `_warmMcPool` — v1.104.8, v1.80.4
- `activeListId` — v1.101.0, v1.99.4
- `addToList` — v1.126.0, v1.99.4
- `attempt_probability` — v1.121.0, v1.68.0
- `badges` — v1.109.0, v1.68.0
- `bottom` — v1.125.0, v1.81.3
- `buildExplorer` — v1.126.0, v1.125.0
- `build_forward_components.mjs` — v1.126.0, v1.75.0
- `cal.ev` — v1.126.0, v1.104.3
- `calSuccess` — v1.104.3, v1.80.4
- `camTarget` — v1.109.0, v1.81.4
- `camTarget.cy` — v1.129.6, v1.114.4
- `captureNode` — v1.129.8, v1.101.0
- `cardOrder` — v1.122.0, v1.104.3
- `challengeView` — v1.76.0, v1.68.0
- `check_position_type_vs_score` — v1.104.6, v1.103.0
- `clearLandCard` — v1.104.4, v1.101.0
- `clearOptions` — v1.129.3, v1.128.1
- `click` — v1.129.1, v1.123.0
- `coins` — v1.109.0, v1.68.0
- `collection` — v1.76.0, v1.68.0
- `combo` — v1.74.0, v1.70.0
- `count_mismatch` — v1.81.3, v1.81.0
- `cssText` — v1.129.8, v1.104.2
- `custom.scss` — v1.80.2, v1.20.0
- `deckMastery` — v1.126.0, v1.80.4
- `deg` — v1.125.0, v1.122.0
- `edgeMark` — v1.122.0, v1.104.3
- `enterFailCal` — v1.127.2, v1.116.0
- `exploreOpenSections` — v1.99.4, v1.76.0
- `from` — v1.109.0, v1.104.6
- `fromPositionId` — v1.103.0, v1.82.3
- `from_position_role_mismatch` — v1.126.0, v1.103.0
- `gameScore` — v1.126.0, v1.80.4
- `giAllows` — v1.125.0, v1.115.0
- `globalGraphLayout` — v1.125.0, v1.104.3
- `gradeRecall` — v1.105.2, v1.68.0
- `halfW` — v1.129.1, v1.129.0
- `history` — v1.76.0, v1.68.0
- `innerHTML` — v1.129.8, v1.101.0
- `jumpToState` — v1.127.0, v1.126.0
- `kLOD` — v1.128.0, v1.114.3
- `known.ts` — v1.80.2, v1.20.0
- `land_q_shown` — v1.104.0, v1.68.0
- `lossAversion` — v1.123.0, v1.104.3
- `nodeForKey` — v1.126.0, v1.125.0
- `nodeQuestionFor` — v1.101.0, v1.68.0
- `not_base64url` — v1.81.4, v1.81.3
- `orderScore` — v1.122.0, v1.104.3
- `outcomes` — v1.125.0, v1.80.4
- `package.json` — v1.129.4, v1.127.0
- `pairGroup` — v1.129.1, v1.129.0
- `pairId` — v1.125.0, v1.114.3
- `parkOn` — v1.125.0, v1.114.0
- `path` — v1.76.0, v1.68.0
- `paused` — v1.123.0, v1.104.0
- `playFrom` — v1.104.5, v1.81.4
- `playerRole` — v1.125.0, v1.82.3
- `popstate` — v1.126.0, v1.104.5
- `posFamily` — v1.128.1, v1.114.0
- `posId` — v1.103.0, v1.80.4
- `position_type` — v1.125.0, v1.103.0
- `pulse` — v1.109.0, v1.101.0
- `rSite` — v1.128.0, v1.125.0
- `rec` — v1.109.0, v1.68.0
- `regenerate_graph.py` — v1.104.6, v1.81.0
- `removeFromList` — v1.126.0, v1.99.4
- `renderLandCard` — v1.104.8, v1.82.3
- `resultPos` — v1.126.0, v1.125.0
- `richLabel` — v1.129.1, v1.114.0
- `role` — v1.127.2, v1.114.2
- `roll_staged` — v1.114.2, v1.68.0
- `setFocusIdxSet` — v1.81.3, v1.81.1
- `setPointerCapture` — v1.123.0, v1.101.0
- `share_id` — v1.81.3, v1.81.0
- `source` — v1.127.0, v1.126.0
- `srs` — v1.109.0, v1.68.0
- `stage` — v1.109.0, v1.68.0
- `stagedIdle` — v1.127.0, v1.114.2
- `startPosTraffic` — v1.126.0, v1.125.0


---

## Index C — decisions, reversals, and alternatives already rejected

A settled call should not be re-argued, and an idea already tried should not be re-proposed.
**A rejected alternative nobody recorded is one you cannot grep, because you do not know it was
tried.**

### Owner decisions that were later reversed

- **The `Edge` caption on the option card** — introduced v1.118.0 because an unlabelled signed
  integer reads as a bug (in 98 of 272 hands the best-EDGE card is not the best-odds card);
  **reversed v1.129.1** in favour of the category word. *Do not silently reinstate it.*
- **Capture filed into a default list** (v1.99.5) — **reversed v1.102.0**: the picker always
  opens, because "one list" is only unambiguous the first time.
- **The list-row ▶** (v1.103.6) — **deleted v1.103.7**: ▶ means *make this the current state and
  roll*, which you cannot do to a collection.
- **The in-node dossier** (v1.100.0) — **retired v1.101.0**: the game's own card is the one
  container. Zoom is a camera; it never changes what a node says.
- **The first-roll coach** (pre-v1.104.0) — **deleted v1.104.0**. Its three tutorial objectives
  were re-keyed, not dropped.
- **`?dual` prototype payloads** (v1.113–v1.125) — **retired v1.126.0**, accepted-and-ignored.
- **`cardOrder` / Option ordering** (Settings) — **retired v1.122.0**; the key is dormant, not
  pruned, because a settings key can never be deleted.

### Alternatives that were built or measured, and rejected — do not re-propose

- `body[data-share-cue]` as a diagnostic attribute — collides with the cue button's own
  attribute, so `querySelector` returns `<body>` and every measurement silently becomes the
  whole viewport.
- A 66px transport shift, and a `max-width` on the share pill — each merely relocates the
  collision onto the band's third tenant.
- **A touch drag for the option tray** — built, measured, reverted: its own mutants could not
  kill its test, because the harness scrolls that tray natively. A change whose mutant cannot
  kill its test is not evidence.
- **A second question at the technique node**, between commit and sweep — built and cut on
  tempo; it added its delay to every move.
- **40vh for the phone landing card** — reverted; it swallowed the band the graph is panned in.
- **Resetting the camera band per landing** — tried and wrong: it hands the first post-reset
  frame straight back to the loose answer.
- **A pure-log decision curve** with the same worst case — rejected for the knee, which leaves
  all 256 sub-knee hands untouched to the millisecond.
- **Hoisting `a.x`/`a.y` out of the de-overlap inner loop** — moved the emitted geometry, because
  `_mv` moves `a` itself during that loop. The cheap axis-reject beside it IS safe, but its win
  is inside run-to-run noise — *do not quote a speedup for it*.
- **Sweeping members rather than sites** in the de-overlap — named as the honest fix for the
  ingest cost and deliberately NOT done, because it changes the emitted geometry.
- **Role-splitting `adj`** — the suite found it: several readers walk it role-agnostically on
  purpose. *Do not role-split `adj`.*


---

## Entries

Document order is preserved (the authored grouping), rather than re-sorted by version:
entries cross-reference each other by position, and Index A above already provides the
newest-first view. Every entry is verbatim below its heading.


<a id="v1-145-10-the-host-stylesheet-reached-into-the-a"></a>

## v1.146.1 — THE HOST STYLESHEET REACHED INTO THE APP'S MODAL

> **Status:** Current. Both halves gated by `e2e/journeys/footer-feedback.spec.ts`, each proved
> by a mutant (see "Mutation" below — the first attempt at a gate killed neither).

**Owner:** "the checkbox is too much to the left ... It's not unclickable, and I can't do anything
about it. That checkbox is not properly aligned."

The "about: <state>" context checkbox in the feedback modal — reached from **Request a technique**
and **Report an issue** on the Explore pane's foot. Measured on the shipped build at 1280x860,
with the modal open on a real dev server (not the harness):

| box | left edge |
|---|---|
| checkbox | **418.6** |
| its own `<label>` | 441 |
| the textarea and Send it should line up with | 441 |
| the card's padding edge | 421 |

So the box drew **22.4px left of its own label and 2.4px outside the card**, hanging in the
card's padding. `elementFromPoint` at its centre still returned the input — which is exactly why
the owner reported it as misaligned rather than broken.

**Cause: a bare global in a stylesheet the app does not own.** `source/quartz/styles/base.scss`
carried an unscoped `input[type="checkbox"]` rule — stock Quartz, whose entire purpose is to hang
a **markdown task-list** checkbox out in the list gutter:

```scss
margin-inline-start: -1.4rem;   //  -22.4px, exactly the offset measured
appearance: none;               //  and this makes `accent-color` inert
```

The Neural app's modal **portals to the app root** (§6.1: the fixed wrap is its own stacking
context), so it sits *outside* `.page article` — confirmed in the same probe, `cb.closest(".page
article")` is `null` — and inherited a rule written for a list item it is not in. The app was
setting `accent-color:#4a6cff` on the input; under `appearance:none` that did nothing, so the box
also wore `var(--light)` on a dark card.

**The rule's only consumer on this site was the element it broke.** `grep -rl '^\s*[-*] \[[ xX]\]'
content/` returns **0 files** and the built HTML contains **0** `type="checkbox"` outside the app
— the site authors no task lists at all.

**Fix, both halves, because either alone is a half-fix:**

1. `base.scss` — scope the rule to `.page article`, beside the `li:has(> input[type="checkbox"])`
   rules that are its actual siblings. Task lists keep today's look if content ever authors one;
   everything else gets a native checkbox, and the app's `accent-color` starts working.
2. `app.src.jsx` — state `margin:0;flex:none` inline on the input. Not tidying: the app is an
   overlay on a stylesheet it cannot opt out of, and `margin:0` is also what pulls the box the
   last 4px (the UA default `margin-left`) into the modal's column.

After: checkbox left edge **441**, flush with the textarea and Send; `appearance: auto`;
`accent-color` live; nothing overflows the card.

**Mutation — the honest part.** The first version of the gate asserted only the geometry, and
**mutant A (un-scope the base.scss rule) survived it**: an inline `margin` beats a stylesheet
rule, so the app-side half masked the stylesheet half completely. A geometry assertion can never
see the difference. The gate therefore also probes the **cascade** with a control element — a
bare checkbox appended to `document.body`, where the app mounts — and asserts its computed
`margin-inline-start` is not negative.

| mutant | result |
|---|---|
| un-scope `input[type=checkbox]` in the built CSS | **RED** — `-22.4` vs expected `>= 0` |
| drop `margin:0` from the inline style | **RED** — checkbox left edge `4` off the column vs `<= 1` |

**Not written to CLAUDE.md, deliberately** (§9 admission test): the fact has a code home in three
places — the comment on the scss rule, the comment at the `innerHTML` site, and the spec header —
and it now has a gate that names it.


<a id="v1-80-0-one-front-end-the-legacy-quartz-page-ui"></a>

## v1.80.0 — ONE front-end: the legacy Quartz page UI was deleted

> **Status:** Current - the legacy Quartz front-end is deleted. `?variant=legacy` is accepted-and-ignored.

_Originally CLAUDE.md L295._

### ONE front-end: the legacy Quartz page UI was deleted (v1.80.0)

<a id="v1-81-0-share-links-node-ordinals-wire-codec"></a>

## v1.81.0 — Share links — node ordinals + wire codec

_Originally CLAUDE.md L296._

### Share links — node ordinals + wire codec (v1.81.0, foundation)

A share link carries a LIST OF GRAPH NODES in its URL (the gym-WhatsApp acquisition path:
"these are the techniques we learned in today's class"). Two artifacts underpin it.

**`node_ordinals.json` (repo root, COMMITTED, APPEND-ONLY).** `{id -> ordinal}` for every
`globalGraphLayout.json` node, plus a `retired` map.
- **A node's array index can NEVER go in a URL.** `regenerate_graph.py` builds graph.json from
  an unsorted `rglob('*.json')` and `regenerate_graph_layout.py` derives its node list from
  `adjacency` DICT INSERTION order seeded by that iteration — so adding one content file
  renumbers pre-existing entries (measured: +1 file in a 7-file dir moved 2 of the 7). An
  index-encoded link would silently open a DIFFERENT set of techniques, with no error anywhere.
  Live proof: `graph-data.json` node[0] is `Positions/Gogoplata-Control`, ordinal **42**.
- Ordinals are assigned once and are **permanent**: never renumbered, never reused, and a
  deleted node's entry is **retired, not removed** (so its ordinal can never be handed to
  another node). New nodes append at `next_ordinal` in **sorted-id order**, so the minting
  itself does not inherit filesystem order either.
- `npm run regenerate:ordinals` mints/appends (wired into the `regenerate:graph` umbrella,
  after graph-layout). `npm run validate:ordinals` is a HARD gate (`ci-validate.yml` + both
  deploy workflows). The generator self-gates: it refuses to write a lockfile that would fail
  `--check`.
- The browser gets it via **`o` on every `graph-data.json` node**, stamped by
  `regenerate_neural_data.py` — a step deploy actually runs. (`npm run build` and
  `regenerate:graph` do NOT run in deploy; the workflows re-list steps inline.) Cost: **+4.6 KB
  gzip**, deliberately paid inline so the `/l/<code>` recipient path resolves ordinals from a
  payload it already needs (node coordinates) instead of adding a request to the acquisition
  path's critical fetch chain.

**`neural/src/lists-codec.src.js` — the wire codec, PURE.** Format **v2** (current) = `[0x02]
varint(n-1) varint(d0) … varint(d(n-1))` base64url-unpadded, where ordinals are sorted-unique and
`di = oi - o(i-1) - 1`.
- That `-1` makes duplicates and out-of-order sets **unrepresentable**, so the encoding is
  **canonical**: one set of nodes has exactly one spelling on every device. That is what makes
  `share_id` (first 12 chars) join creator and recipient events into a viral funnel with no
  server state. Non-canonical spellings (base64 padding, non-zero trailing bits, non-minimal
  varints) are REJECTED for that reason, not pedantry.
- **`n` is the ITEM COUNT and it exists so TRUNCATION IS DETECTABLE (v1.81.2).** WhatsApp and
  mail clients clip and re-wrap long URLs. v1 had no length and no checksum, so a clipped code
  decoded perfectly cleanly into a strict PREFIX of the class — **measured: 198 of 955 prefixes
  of real 2-13 item codes decoded silently**, one turning a 12-technique class into a
  1-technique one, with nobody able to tell. With the count, the payload must hold EXACTLY `n`
  deltas and end there, so a clipped link fails as `count_mismatch` / `truncated_varint` /
  `trailing_bytes` and the recipient is TOLD ("This link is incomplete"). Cost: 1 byte.
- **v1 still decodes, forever** (`NG_LIST_WIRE_VERSIONS_READ = [1,2]`) — a code is a permanent
  promise like an ordinal — but is never minted. Canonicality is therefore per-version, and only
  v2 is ever emitted, so every code the app produces is still the one spelling of its set.
- **Measured URL length** (1467 nodes, `https://bjjgraph.org/l/` + code): 5 items → **37.0
  chars mean / 39 worst**; 12 items → **47.3 / 51** (v1 was 35.5/38 and 46/50 — the count byte
  costs ~1.5 chars).
- Decode NEVER throws — it returns `{ok:false, error}` — and caps input at 512 chars / 60 items.
  Unknown ordinals (a link from a newer build, or a retired node) are REPORTED, not fatal: the
  list still opens with what resolved.
- **One source, three consumers.** It is a real ES module so `node --test` and a Cloudflare
  Pages Function import the identical file; `neural/build/build.mjs` strips the `export `
  keywords when concatenating it into the IIFE and **throws if that strip stops matching** (a
  surviving `export` is a parse error that would delete the whole app). Exposed as
  `globalThis.NGLists`. Pinned by `tests/share_lists_codec.test.mjs` (19 tests, mutation-tested:
  every guard has a test that fails when the guard is deleted — the v2 count guards were checked
  against 8 mutants, 8 killed). `build.mjs`'s duplicate-top-level-name guard scans
  `function|const|let|var|class` (it used to scan only `function|const`, so a colliding `let`
  walked past it into the same SyntaxError it exists to prevent).
- Lists are **STORED as node ids** (in the existing v2 progress blob, add-wins merge); only the
  WIRE uses ordinals.

<a id="v1-81-1-share-links-the-feature-on-top"></a>

## v1.81.1 — Share links — the feature on top

_Originally CLAUDE.md L360._

### Share links — the feature on top (v1.81.1)

`neural/src/lists.src.js` is the DOMAIN module beside the codec: storage shape, the merge rule,
`/l/<code>` parsing and the link-preview text. Same three-consumers contract (node --test, the
browser IIFE via `build.mjs`, the Pages Function), same no-`import` rule — and note the two files
share ONE scope in the bundle, so no top-level name may collide. That is why the item cap is
`NG_LIST_ITEM_CAP` here and `NG_LIST_MAX_ITEMS` in the codec; a test pins them equal and
`build.mjs` throws on any duplicated top-level name.

**Storage.** `lists: {"<id>": {name, items:[nodeId], t}}` inside the **existing v2 blob** — no
version bump, no migration. Cloud reconciliation is **ADD-WINS** (`ngMergeLists`, beside
`ngMergeCollectibles`' UNION): union of lists, union of their items, name from the later `t`.
A DELETE therefore loses to a stale device — deliberate: deleting again is trivial, losing the
list a class was built from (already posted in a group chat) is not. The item cap is enforced at
**add** time because `ngListEncodeOrdinals` THROWS above it rather than truncating a coach's class.

**UI.** A **Lists** section at the TOP of Explore (`[data-lists-section]`, `[data-list-row]` with
Share / ×; the per-item ▶ and ✕ live on the items — v1.103.7). Read order inside it is **arrival first**: a `[data-shared-list]` (or
`[data-shared-stale]`) block, then any undo row, then `[data-lists-head]` — a first-time recipient
must never read "Lists (0)" above "Shared with you · 5 techniques", and the head prints no count
at all when there are no lists. **Delete is two-step and undoable**: the first click arms it
(`[data-list-delete-armed]`, label "Delete?", 8s window), the second deletes and leaves a
`[data-list-undo]` row holding the whole list; it also sits 12px clear of Share, which is the
button a coach presses in front of the class. The capture affordance — **a STAR since v1.129.8**,
see THE CAPTURE STAR below (`[data-list-add="<nodeId>"]` +
`data-list-surface=explore|sheet|land|lesson|shared|dossier`) — rides Explore rows, the
option-detail sheet, BOTH dossier
renderers, the in-roll landing card and challenge lesson rows (as a SIBLING of the lesson
`<button>` in `.ng-challenge-lessonrow` — a nested `<button>` would close the outer one in the
parser). Lighting a list reuses `setFocusIdxSet` exactly like a System; `_listFocusId` survives
each `renderExplorer` reset (which otherwise `clearFocus()`es on every keystroke) and is dropped
by `clearFocus`, i.e. on any tab change or pane close.

<a id="v1-99-4-your-own-list-is-as-legible-as-a-receive"></a>

## v1.99.4 — YOUR OWN LIST IS AS LEGIBLE AS A RECEIVED ONE

> **Status:** Superseded by v1.103.4/v1.103.5 - lists render as Explore sections, not cards.

_Originally CLAUDE.md L393._

**YOUR OWN LIST IS AS LEGIBLE AS A RECEIVED ONE (v1.99.4).** Until then the asymmetry was the
bug: `_sharedBlock` named every technique in a class a teammate sent you, while your own list
printed a name, a count and three buttons — a coach could not check their class before posting
it. Each `[data-list-row]` now carries an **inline disclosure** (the History / challenge-lesson
idiom): the **count line IS the toggle** (`[data-list-open]`, chevron `[data-list-chevron]`,
`aria-expanded` + `aria-controls`, a 44px band; it used to be a duplicate of the row's own
"light this list" click, which the row still does). Open reveals `[data-list-items]` →
`[data-list-item="<nodeId>"]` rows carrying the **FULL authored name** — `splitName().main` plus
the dimmer `from <position>` half, same rule and same shape as `[data-shared-item]`, because
"Kimura" is 35 techniques here — clicking one `openDossier`s it.
- **Removal is an explicit `×` (`[data-list-item-remove]` + `data-list-of`), never the
  `_listAddButton`.** That button's state is defined against list membership GENERALLY
  (`nodeInAnyList`): inside a list's own disclosure the technique is a member of THAT list
  by construction, so a toggle there would mislabel at best and, on any non-active list, would
  silently ADD it to a DIFFERENT list instead of removing it. `removeListItem(nodeId, listId)`
  is now **the** remove path — `toggleListItem`'s ✓ delegates to it — so the toast (which names
  the list and the qualified technique), the persist, the undo offer and the graph re-light can
  never diverge. A removal on the lit list re-lights the REDUCED set with `noFrame` (a removal
  is not a request to be flown somewhere).
- **Emptying a list still deletes it** (`removeFromList`'s long-standing rule) — but that
  deletion now arms the SAME `[data-list-undo]` row the two-step delete uses, via the shared
  `_armListUndo` seam. Before v1.99.4 it destroyed a named list silently, and the per-item × put
  that one click away from a list you are reading.
- **Auto-expand is the feature** ("see the listed techniques AFTER ADDING", owner): `newList`,
  `addToList` and `undoDeleteList` all expand their list, so a capture taken with the pane open
  lands somewhere the eye can follow.
- **Expansion is SESSION state — a `Set` (`_listExpand`), deliberately NOT a settings map.**
  `exploreOpenSections` persists because its keys are a fixed vocabulary of six section labels;
  list ids are minted per device from `Date.now()` and die with the list, so a persisted map
  would grow an unbounded tail of keys naming lists that no longer exist and sync that tail
  everywhere through per-key LWW. It is also derived, not chosen.
- `_toggleListExpand` **restores focus** to the rebuilt toggle (`_listOpenFocusPending`): a
  toggle re-renders the whole Explore body, so without it one Enter opens the list and the next
  goes to `<body>` — invisible by mouse, a dead end by keyboard.
- An empty list says so and says how (`[data-list-empty="<listId>"]`), naming only surfaces that
  really carry `[data-list-add]`, **in the glyph they actually wear**: the card you land on, a
  move's detail sheet, an Explore row. It said "tap **+** on an option card … on a technique's
  dossier" until v1.129.8 — a `+` that is now a star, on two surfaces that stopped carrying the
  control (option cards in v1.101.1, the dossier renderer unreachable since v1.101.5), i.e. it
  pointed at two controls nobody could find. `lists-disclosure` asserts the new three and asserts
  the old two are GONE.

**"HOW DOES IT KNOW WHAT LIST?" — THE CAPTURE PICKER (v1.99.5).** `addToList(nodeId)` defaults to
the single persisted `activeListId`, and `_listAddButton` toggled against `activeListHas()` — so
with two lists **every `+` filed into whichever was last created or touched**, destination
invisible and unchosen. Silent misfiling: nothing looks wrong until a coach shares the wrong
class. `captureNode(nodeId, surface, anchor)` is now the ONE seam every surface's `+` and both
dossier renderers route through, and the matrix is:

| state | behaviour |
|---|---|
| 0 lists, not captured | create `Class · <date>` + add. **One tap.** |
| 1 list, not captured | add to it. **One tap** — there is no second destination |
| ≥2 lists, not captured | **PICKER** (`openListPicker`) — the choice is real, so it is asked |
| already in any list | **PICKER**, at any count |

- **Why not always, when the owner named YouTube's "Save to playlist".** Canon: capture "never
  commits the move and never stops the clock" — the `+` is pressed mid-roll on an option card
  with the decision window draining, and taxing every capture with a chooser to fix a problem
  single-list users do not have is the wrong trade. The create-inline row stays reachable
  everywhere anyway, because pressing `+` on an **already-captured** technique opens the picker
  on ANY surface: "put this in a new list" is one tap from a ✓, at every list count. This also
  fixed a second misfiling — the old ✓ removed from the ACTIVE list, which with two lists could
  be a list the technique was never in.
- **THE CLOCK KEEPS RUNNING.** The picker is anchored chrome, not a screen: no pause latch, no
  pane interaction. It **closes on pick** rather than staying open YouTube-style — a menu left
  over the option tray is exactly what "never blocks the option hand" forbids — and
  `enterAttempt`, `openDossier` and `applyDeckVisibility` each close it so it can never outlive
  the surface it hangs off.
- **Placement is MEASURED, never CSS.** `_placeListPicker` reads the anchor rect, prefers above,
  flips below, and clamps both axes to an 8px inset: the anchor can be an option card at the
  bottom of a 390px phone, inside an 88vw drawer, above the thumb band. Portalled to the app
  root at **z:90** (the deliberate-screen band, beside the account menu) — inside the fixed wrap
  it would be underdrawn by the landing card at z:5. Esc closes it FIRST, before the account
  menu; a capture-phase outside `pointerdown` closes it too.
- Handles: `[data-list-picker="<nodeId>"]`, `[data-list-pick="<listId>"]` (`role=menuitemcheckbox`,
  `aria-checked` = real membership, `[data-picker-default]` on the destination, ordered
  default-first), `[data-list-pick-new]` → `[data-list-pick-newname]` + `[data-list-pick-create]`
  (Enter commits; `createListWith` names AND files in one action).
- **The destination is legible without opening anything:** `[data-lists-target]` — a permanent
  "Adding to **<name>**" line under the Lists head (owner: "be visible up top") — plus every
  capture control's own `aria-label`/`title` (`_captureCopy`), which names the target list, or
  the lists it is already in. The glyph — `✓` then, a FILLED STAR since v1.129.8 — means **in ANY
  list** (`nodeInAnyList`), not "in the active one". `[data-lists-target]` is a STATUS, not a control: the way to change the
  destination is to pick one (or create one), and a second silent re-targeting control would
  recreate the ambiguity it exists to remove.

**Recipient path (`_openSharedListFromUrl`, called right after `ingest`).** Decodes
`location.pathname` client-side, sets `_sharedIncoming`, opens the pane on Explore and lights the
nodes. A received link is **offered, never adopted**: Save is one deliberate click. Unknown
ordinals surface as `[data-shared-unresolved]` and the rest still opens. Beats: `list_item_added`,
`list_shared`, `list_opened` (the last two have sound cues in the `Sharing` group), plus
`list_stale` / `list_failed`.

<a id="v1-81-2-four-outcomes-for-a-l-code-arrival-and-t"></a>

## v1.81.2 — Four outcomes for a `/l/<code>` arrival, and they are FOUR DIFFERENT SENTENCES

_Originally CLAUDE.md L487._

**Four outcomes for a `/l/<code>` arrival, and they are FOUR DIFFERENT SENTENCES** (v1.81.2):
resolvable → the offer; **valid but nothing this build knows** → `[data-shared-stale]` ("this link
is valid, your app is older — reload in a bit"), which is actionable and must not be answered with
the silence garbage gets; **damaged** → `[data-shared-broken]` ("this link is incomplete");
**not code-shaped** (`/l/not!a!code` — fails `ngListParseSharePath`) → nothing at all, the app is
just an app.

<a id="v1-81-3-the-phone-is-the-product-surface-and-it"></a>

## v1.81.3 — THE PHONE IS THE PRODUCT SURFACE, AND IT DECIDES THE TERMINAL STATE

_Originally CLAUDE.md L494._

**THE PHONE IS THE PRODUCT SURFACE, AND IT DECIDES THE TERMINAL STATE** (v1.81.3). A gym WhatsApp
link is opened one-handed in a changing room, and on a 390x844 phone `.ng-drill` is an **88vw
drawer** — it IS the screen. So `_offerShare()` forks on `isMobile()`:
- **wide** → `openPane("explore")` as before (the pane sits beside the graph; nothing is hidden).
- **phone** → **nothing opens.** The class is lit, the camera framed on it, and the offer arrives
  on the standalone **`.ng-sharecue` band control** instead (v1.99.0 — the pill that hosted it is deleted): `[data-share-cue]` (`◉ N`, re-lights WITHOUT
  covering the graph, beat `list_relit`) + `[data-share-open]` (`Class ▸`, the deliberate "let me
  read it" → pane on Explore). This serves PANE LAW *better*, not worse: on the phone path nothing
  but the user ever opens the pane.
- **A LIST focus now SURVIVES a mobile pane close** (`applyDeckVisibility`): there, closing the
  drawer is how you look at the graph, not how you discard the class. Desktop keeps the original
  clear-on-close — the pane never covered anything there.
- Both cue buttons are `<button>`s inside the standalone `.ng-sharecue` host (v1.99.0) —
  `pointer-events:auto` is inline on them (it must be), which beats any inherited `none`,
  so the pill-era draft was fully
  CLICKABLE at `opacity:0` (the pill only appears on the first landing, and a share arrival is
  decoded before the first roll starts). A control you can hit but cannot see is worse than a late
  one. `reach()` in the mobile spec asserts effective opacity up the ancestor chain for this reason.

<a id="v1-81-3-the-landing-card-docks-off-the-tray-s-me"></a>

## v1.81.3 — THE LANDING CARD DOCKS OFF THE TRAY'S MEASURED TOP ON MOBILE

_Originally CLAUDE.md L513._

**THE LANDING CARD DOCKS OFF THE TRAY'S MEASURED TOP ON MOBILE** (`_dockLandCard`, v1.81.3). The
options tray is `position:absolute; bottom:84px` with NO height, so it grows UPWARD as its cards
grow, while `.ng-landcard`'s mobile `bottom` was a CSS constant tuned against a shorter tray.
Measured at 390x844: tray top **583**, landing-card bottom **646** — a 63px overlap, card at z-index
5 over the tray's 4, so it covered the top of every option card: the category, the potential and the
technique NAME you are choosing between. The overlap PRE-DATES the capture `+` (which widened it by
~9px), and no constant can track a tray whose height depends on how many lines a name wraps to.
`el.style.setProperty("bottom", …, "important")` is required, not cargo cult — the mobile rule is
`!important`, and a plain inline style moved the card 2px and looked like a bad measurement.

<a id="v1-81-3-capture-the-technique-not-just-the-posit"></a>

## v1.81.3 — CAPTURE THE TECHNIQUE, NOT JUST THE POSITION

_Originally CLAUDE.md L523._

**CAPTURE THE TECHNIQUE, NOT JUST THE POSITION** (v1.81.3). "The techniques we learned in today's
class" means TRANSITIONS AND SUBMISSIONS. The landing card's `+` adds the *position you are
standing in* — legitimate ("we worked from half guard"), but not what the feature is for. The hand
IS the techniques, so `+` now rides **every option card** (`data-list-surface="option"`, in the
`.ngbotrow` beside the odds — the 150px header row is already glyph + category + potential) and the
**technique sheet's footer** (`data-list-surface="sheet"`, a 44px labelled target, which is the
mobile path since a card tap opens the sheet). Capturing never commits the move and never stops the
clock. Proven by `page.mouse.click` / `page.touchscreen.tap` at MEASURED coordinates on 390x844 —
never `locator.click()`, which scrolls into view and hid the landing-card clipping bug for a pass.

**Named the way a coach named it.** Every list surface renders the FULL authored name
(`listItemName()`, and `splitName().main` + the dimmer `from …` in the shared block) — never
`splitName().main` alone. 648 of 1467 nodes carry a `from <position>` qualifier and 89 main names
are ambiguous: "Kimura" is **35** different techniques here, "Americana" **16**. The qualifier IS
the disambiguator; dropping it destroys the point of the share. The same rule holds for the
add/remove toasts and for `l-manifest.json` → the og preview text.

<a id="v1-81-3-offered-once-but-the-record-loses-to-the"></a>

## v1.81.3 — Offered once — but THE RECORD LOSES TO THE LIST SET

_Originally CLAUDE.md L540._

**Offered once — but THE RECORD LOSES TO THE LIST SET** (reconciled v1.81.3). `shareSeen` (a
settings key, so LWW per key and cross-device) records each `share_id` as `saved` (with its list id)
or `dismissed`. A **saved** code lights THEIR list instead of re-offering a duplicate; a
**dismissed** code is not re-offered within the same visit (`performance` navigation type
`reload`/`back_forward`) — reloading is not a second ask. `saved` is a *claim about a list that may
no longer exist* (deleted, merged away, blob rewritten), and when it doesn't the old code answered
with perfect silence — nothing lit, no offer, no message, on a URL whose only job is to show a
class. `_openSharedListFromUrl` now checks the list is still there **and non-empty**, and falls
through to offering it again (`neural_share_list_reoffered`) when it is not.

**Re-lightable, from inside AND outside the pane.** `[data-shared-relight]` ("Show on graph") in the
shared block and `[data-share-cue]` (`◉ N`) on the pill both re-run the same `setFocusIdxSet` path.
It exists because closing the pane `clearFocus()`es by design (on desktop), and the received set was
the ONE focus source with no way back. The cue is the mobile answer: the in-pane control is
unreachable in exactly the state you want it, since the pane is the screen there.

<a id="v1-81-3-a-damaged-link-is-told-durably-not-in-a"></a>

## v1.81.3 — A DAMAGED LINK IS TOLD DURABLY, NOT IN A TOAST

_Originally CLAUDE.md L556._

**A DAMAGED LINK IS TOLD DURABLY, NOT IN A TOAST** (v1.81.3). Two separate defects were behind
"detected but silent": (1) `setEvent` has ONE slot and the roll overwrites it within a couple of
seconds, so the toast alone never reached a real recipient — hence `[data-shared-broken]`, plus the
pill cue that survives; (2) the clip classifier only listened for the count-byte errors. Measured
over every prefix of real codes (908 prefixes): **`not_base64url` 478 · `truncated_varint` 191 ·
`count_mismatch` 179 · `truncated` 60** — the base64 layer refuses FIRST whenever a cut lands
mid-quantum (`len % 4 == 1`) or on non-zero trailing bits, so **the majority of real cuts are
`not_base64url`** and were answered with silence. `NG_LIST_CLIP_ERRORS` (in the codec, beside the
wire that defines them) is now the single classifier; errors a cut cannot produce (`bad_version`,
`too_many_items`, `non_canonical_varint`, `too_long`) stay out, because "cut short in transit" is
the wrong sentence for a mistyped code. Anything code-shaped that will not decode says *something*.

**The analytics join across a wire-version bump** is documented once, on `ngListShareId`:
canonicality is per-version, so one set has a v1 and a v2 spelling and two ids. v1 is never minted,
so a v1 id can only appear on the RECIPIENT side (a link pasted before the bump) and is counted as
an unattributed legacy open — never re-keyed to a synthetic v2 id. The ids diverge inside their
first two characters, so the two spellings can never be conflated.

**Four rungs, and the one that matters.** `_redirects` carries **`/l/* /l.html 200`** — a REWRITE,
so `/l/<code>` keeps its URL and gets the built shell. That plus client-side decode is the WHOLE
experience with **no Function at all**; `functions/l/[[path]].js` only adds the social preview
(og:title naming the techniques), because WhatsApp/Telegram/X fetch server-side and never run JS.

<a id="v1-81-2-headers-for-l-come-from-one-place-at-a-t"></a>

## v1.81.2 — HEADERS FOR `/l/*` COME FROM ONE PLACE AT A TIME, AND THE TWO PLACES MUST AGREE

_Originally CLAUDE.md L578._

**HEADERS FOR `/l/*` COME FROM ONE PLACE AT A TIME, AND THE TWO PLACES MUST AGREE** (v1.81.2).
Cloudflare: *"Custom headers defined in the `_headers` file are not applied to responses generated
by Pages Functions, even if the request URL matches a rule defined in `_headers`."* So unlike the
comma-join trap that `check_headers_cache.py` was built for, `/l/*` has **two mutually exclusive**
header sources — the Function when deployed, `_headers` on the rewrite rung — and the failure
available here is them DISAGREEING, so the TTL and security posture change the day the Function
lands. `SHARE_CACHE_CONTROL` + `SHARE_STATIC_HEADERS` in the Function are byte-identical to
`_headers`, gated (checks 6-8 of `check_headers_cache.py`, which also derives each Function's route
from its filename). The Function must also `delete` `content-length`/`etag`/`last-modified`/
`content-encoding` before reusing the asset's headers: it returns an **HTMLRewriter-transformed**
body, so the asset's length is wrong, its ETag/Last-Modified would make two different documents
share one cache validator, and a surviving `content-encoding` describes bytes `ASSETS.fetch` already
decoded.

<a id="v1-81-3-the-gate-checks-omission-not-only-drift"></a>

## v1.81.3 — The gate checks OMISSION, not only drift

_Originally CLAUDE.md L592._

**The gate checks OMISSION, not only drift** (v1.81.3) — omission is the likelier regression and
reproduces the very hazard: a Function that stops setting `Cache-Control` altogether used to pass
(the comparison loop had nothing to iterate), and a `SHARE_STATIC_HEADERS` block that is declared but
never written into the response passed every value comparison while shipping none of the headers.
`main()` now also runs the Function checks against the **emitted** `source/public/_headers` — the file
Cloudflare actually reads — not only the canonical `source/quartz/static/_headers`, which is merely
its input (`regenerate_headers.py` sits between them). All three new checks are red-proven by
deleting the line and watching the gate fail.

**`HTMLRewriter` selectors must be SCOPED** (v1.81.3): `.on("title", …)` matches by element NAME, and
the shell carries a second `<title>` — `<title>Search</title>` inside the search button's inline SVG.
The Function targets `title[data-share-title]`, a marker `build_share_shell.mjs` writes and asserts
exactly once, same contract shape as `meta[data-share-og]`. The pair (served bytes + Function source)
is asserted in the SEO journey.

`scripts/build_share_shell.mjs` derives `l.html` from the BUILT `index.html` (one source of truth;
`<base href="/">` so a trailing slash can't 404 the assets; `noindex,nofollow`; `data-share-og`
markers the Function's HTMLRewriter targets), emits `l-manifest.json` (ordinal→name, for the
Function only) and **GATES that no `/l` URL reached sitemap.xml or llms.txt**. It is wired into
root `build` AND explicitly into BOTH deploy workflows — deploy does not run root `npm run build`.

**Two mouse-only bugs this work uncovered and fixed** (both invisible to keyboard paths, the same
class as the coach button before v1.69.1):
- The in-node dossier card's z-index was **3**, under the bottom-centre transport pill (4), which
  intercepted clicks on its action row. Now **5**.
- `attachInput`'s `pointerdown` called `el.setPointerCapture()`, which RETARGETS later pointer
  events to the wrap — so pointerup's `inCard` guard saw the wrap, dismissed the dossier
  mid-gesture, and the browser computed the click target from the down/up common ancestor. Every
  button inside the desktop in-node dossier ("Roll from here", the attack pills) was dead to the
  mouse. A gesture starting inside the card now returns early.

**Tests.** `npm run e2e:share` → `e2e/playwright.share.config.ts` (own port :8129,
`reuseExistingServer:false`) runs BOTH halves: `e2e/journeys/share-lists.spec.ts` (11 journeys, the
desktop/logic half) and `e2e/journeys/share-mobile.spec.ts` (7 journeys, `test.use` **390x844 +
hasTouch** — the device this feature ships to). They are two files because only a spec file can set
its own viewport. The no-Function rung is tested by fulfilling `/l/*` with the bytes of
`source/public/l.html`, with the real `_redirects` rule asserted in the same file so the emulation
cannot drift from production. **Every port is dedicated now** (core :8133, gen :8127, share :8129,
all `reuseExistingServer:false`; observe/quarantine keep :8123 deliberately) — a config that reuses
a server started by ANOTHER worktree tests someone else's `source/public`, which makes any result
from it unreportable.

<a id="v1-20-0-training-system-srs-embedded-ux"></a>

## v1.20.0 — Training System (SRS) — embedded UX

_Originally CLAUDE.md L634._

### Training System (SRS) — embedded UX (v1.20.0+)
The site used to ship **two** front-ends to every visitor. The default was (and is) the Neural
app; the old Quartz page UI was opt-in via `?variant=legacy`. Nobody opted in, yet every page
downloaded ~1.46 MB of it — the single largest lever on a real-user LCP P75 of ~13.7 s. v1.80.0
deleted it.

**Gone, and not coming back** (do not restore any of it; do not write prose that implies it
exists): the embedded SRS/training UX (FlashcardsHeader strip, DecksModal, SettingsModal,
SessionChevrons, the per-page Flashcard) and the modules behind it (`trainingSession.ts`,
`srs.ts`, `settings.ts`, `explored.ts`, `known.ts`, `dateUtil.ts`, `gameAudio.ts`,
`explorerGraphExpand.ts`); the two in-page graphs (`Graph.tsx`/`graph.inline.ts` and
`BackgroundGraph.tsx`/`backgroundGraph.inline.ts`, the only importers of **pixi.js, d3 and
@tweenjs/tween.js**); MoveCards, OutcomeCards, VictoryDisplay, TreeExplorer, TreeDrawer,
ContentPanel, TopBar, Snackbar, RollSessionButton, SystemProgress, AffiliateTracking; the
`TrainingData` emitter (`questionBank.json` + `graphAdjacency.json`) and the
`window.loadQuestionBank`/`loadGraphAdjacency` injection; the `#graph-positions` per-page D3
layout blob (42.5% of all emitted HTML bytes) and `computePageGraphLayout`; `window.__contentStats`;
and ~4,100 lines of legacy sections in `custom.scss`.

The old localStorage keys (`bjj-srs-cards`, `bjj-settings`, `bjj-daily-progress`, `bjj-streak`,
`bjj-explored`, `bjj-banned-flashcards`, `bjj-journey`) have **no writer** any more. Neural uses
`bjj-neural-progress`, `bjj_view_mode`, `bjj_gi_mode`. The `user_training_data` columns the legacy
cloud sync wrote are still in Postgres — we stopped writing them, we did not drop them.

**`?variant=legacy` is now accepted-and-ignored.** Old links carry it; it selects a front-end that
no longer exists, so it has no effect. `/Training/* → / 301` stays in `_redirects`.

**What survives, and why it looks deletable:**
- **`AuthUI.tsx` + `scripts/authUI.inline.ts`** render NOTHING and must stay registered. That
  script is the only static importer of `supabase.ts`, which installs the **`window.__bjjAuth`**
  façade at module top-level — the seam the Neural app reaches auth and cloud sync through. It is
  also the ONLY code that completes a Google OAuth redirect-back (`hasAuthRedirectParams()` →
  `ensureClientInitialized()`); Neural's `_initAuth` only initializes when `isAuthenticated()` is
  already true, which is necessarily false right after a PKCE redirect. Deleting either breaks
  signed-in users while every headless test stays green — hence the MUTUAL-GUARD conjunction in
  `e2e/journeys/legacy-gone.spec.ts`.
- **`CategoryNav.tsx`** inside `#sidebar-overlay` — the six category links are the site's only
  persistent nav on the static surface, and the thing that replaced the Explorer's ~4,600
  per-page links. **No gate guards them.** `check_seo_parity.py` extracts its link set from the
  `<article>` only (see the `region` it derives), and `#sidebar-overlay` is a SIBLING of
  `#quartz-root`, i.e. outside the article — so the baseline's homepage links all come from
  authored prose in `content/index.md`, which merely happens to link the same six hubs. Delete
  CategoryNav and every gate stays green. Treat it as unguarded.
- **Quartz as the SSG.** The emitted HTML still carries the real `<article>`, `<head>` and JSON-LD
  for every indexed URL; Neural is an overlay on top of it (`scripts/variant.inline.ts`), and the
  static article is the fallback for crawlers, no-JS visitors and a failed bundle fetch. `/` now
  renders the same article shell as every other page (it used to emit a bare `#home-hero` with no
  `<article>` at all) — see `content/index.md`, which is authored, not generated.

**Gates that keep it deleted:**
- `scripts/check_payload_budget.py` — byte ratchet vs `tests/artifacts/budget_site.json`. Run by
  `npm run validate:payload`, chained onto `npm run build`, and a step of BOTH deploy workflows,
  placed after `Copy raw HTML folder` + `Build Forward development libraries` so it measures the
  tree we actually ship. Raising a ceiling means `--update` in its own justified commit. Since
  v1.80.4 it also gates the **neural eager set** — everything under `static/neural/` that is not
  an on-demand chunk and not in its short `DEFERRED` list — plus a chunk-size ceiling, so a
  "chunk" cannot become a monolith under a new name.
- `e2e/journeys/payload-first-hand.spec.ts` (`@curated`) — the same weight measured from a REAL
  browser: every byte the page REQUESTS before the first hand of option cards exists, against
  `tests/artifacts/budget_neural.json`. Requested, not finished: the app deals the hand without
  waiting for its deck payload, so a finished-only metric would score a background download as
  free. It also fails if a named monolith reappears on the boot path, and charges any request
  whose body Playwright cannot return at its on-disk size (that is not paranoia — the first
  version of the spec silently lost a 16MB file that way). The two gates cross-check each other:
  the Python one runs without a browser, the browser one cannot be fooled by a list.
- `scripts/check_seo_parity.py` — crawlable-surface ratchet (`npm run validate:seo`; both deploy
  workflows). Compares `<head>` + JSON-LD, crawlable text against a floor, and internal links —
  **`<article>`-scoped**, so nothing outside the article is covered.
- `e2e/journeys/legacy-gone.spec.ts` (absence ∧ the surviving auth seam),
  `e2e/journeys/crawlable-homepage.spec.ts` (the root carries real copy), and
  `e2e/journeys/static-article-layout.spec.ts` (the fallback LAYS OUT — it measures article
  geometry with JS disabled and with the bundle blocked, because "the prose is present" is
  satisfiable by a page rendering into a 450px gutter, which is exactly how v1.80.0 shipped).

**Known follow-up (revenue):** deleting `AffiliateTracking` removed the only emitter of the
`affiliate_clickout` / `related_system_card_click` / `system_page_view` PostHog events. The
affiliate links themselves are untouched and still earn; the *measurement* stopped. Re-instrument
the funnel on Neural's `data-system-cta` anchors (which today fire only
`neural_system_course_clicked`).

<a id="v1-80-2-known-follow-up"></a>

## v1.80.2 — Known follow-up

_Originally CLAUDE.md L714._

**Known follow-up (feature loss, disclosed v1.80.2):** deleting `SystemProgress` removed the
**"Unlock this part of the graph"** UX from all 48 `/Systems/*` pages — an honour-system progress
ring, a per-member mark-known checklist, and a "Mark whole system as known" button, backed by
`known.ts` (`bjj-known`, also deleted). Two consequences, neither of which any gate reports:
- **Analytics:** it was the only emitter of `system_node_marked_known`, `system_node_unmarked`
  and `system_marked_complete`. Those events stop. No Neural equivalent exists — Neural tracks
  mastery through SRS card stages, not an honour-system per-system "known" set — so this is a
  capability *lost*, not merely moved. Any per-system completion figure in PostHog dashboards
  goes flat from the deploy date; do not read that as a usage collapse.
- **Dead markup still ships:** the shell is emitted by `templates/Systems.md.jinja2`
  (`#unlock-graph`, `[data-system-progress]`, `[data-system-members]`), NOT by the component, so
  it survives the deletion — as does its `.system-progress*` CSS in `custom.scss`. It is inert
  rather than broken: the `<section>` is authored `hidden` and only the deleted script ever
  removed that attribute, so users see nothing. It is ~600 B × 48 pages of payload waiting for
  the chunking stream. Removing it means editing the template and REGENERATING `content/Systems/*.md`
  — content regeneration is owned outside this branch, so it was deliberately left in place.
  Do not hand-edit the generated `.md`.

<a id="v1-80-4-neural-data-delivery-manifest-boot-on-de"></a>

## v1.80.4 — Neural data delivery: manifest boot + on-demand chunks

_Originally CLAUDE.md L732._

### Neural data delivery: manifest boot + on-demand chunks (v1.80.4)

Field data (Cloudflare Observatory) put real-user LCP P75 at 13,764ms with 80% Poor while CLS was
0.017 / 100% Good — a delivery problem, not a rendering one. A first visit pulled **39.3MB raw /
10.1MB gzip** of Neural data before a single move was possible. v1.80.4 made it **2.4MB / 355KB**;
the graph-data wire compaction (v1.107.0, below) makes it **~1.3MB / 271KB** (browser-measured
bytes-to-first-hand: 1.57MB raw / 349KB gzip, `payload-first-hand`).

**What the app fetches, and when:**

| payload | when | notes |
|---|---|---|
| `graph-data.json` (547KB raw / 91KB gz) | boot | the graph IS the game. **COMPACT WIRE since v1.107.0** (was 1.55MB/144KB) — see the wire note below |
| `app/neural.js` + `.css` | boot | the bundle |
| `flashcards/_index.json` (155KB) | boot | the deck MANIFEST: `{deckKey: [cat, n]}` |
| `curriculum.json` (100KB) | boot | `curriculum.weights` is what `gameScore` sums — deferring it would show a zero belt |
| `flashcards/<hash>.json` (~6KB) | on demand | one deck's cards |
| `content/<hash>.json` (~13KB) | on demand | one node's dossier (`window.NG_CONTENT` is the cache) |
| `systems.json` (324KB) | first read | Explore tab + system buckets only. **No idle warm** — an idle callback fires before a hand exists, which put it straight back on the boot bill |

- **THE GRAPH-DATA WIRE IS COMPACT, AND `ingest()` EXPANDS IT (v1.107.0).** Measured per-field,
  `cal` was 45.8% of the old file (708KB) and `links`-as-id-objects another 30% (469KB) — but the
  roll-critical part of `cal` is small, so nothing gameplay-facing is deferred; the bytes
  themselves shrank (1,545,389 → 546,836 raw · 143,992 → 90,679 gzip -9). What changed on the wire,
  all expanded back to the legacy shapes at the top of `ingest()` so drawOutcome / resolve /
  calSuccess / giAllows / the edge-weight pass are untouched:
  · position `cal.moves` (336KB, the single biggest item) → **`cal.ew`**, precomputed
    `[nodeIdx, w*10000]` edge-lighting pairs. Its ONLY app consumer was ingest's `_edgeW`
    arithmetic (`attemptProbability × successRate`, max across roles, byName join) — the emitter
    now runs that exact join at build time; nothing else ever read the per-move tables.
  · technique `outcomes` → `[to, probability, s|f|c]` tuples; `successRateByRuleset` → only frames
    that differ from the scalar `successRate` (`calSuccess` already falls back per-frame);
    `endingPosition` → **dropped** (zero consumers anywhere — app, scripts, e2e).
  · `links` → `[sourceIdx, targetIdx]` pairs into the SAME file's nodes array (self-consistent,
    regenerated together; indices never leave the file — share links still ride the permanent `o`
    ordinals, which are unchanged and still on every node).
  · null keys omitted; a technique's `posId` is reconstructed as `posId || fromPositionId` (they
    were equal by construction); `fromPosition` is gone (ingest never copied it).
  Equivalence was PROVEN, not assumed: `tests/artifacts/_verify_wire_equiv.py` rebuilds the old
  emitter from git and asserts every app-visible read identical (1467 nodes, 5371 link pairs,
  3255 outcome tuples exact, 2490 ew edges within the 1e-4 quantum — which only scales edge
  lighting), and `replay-digest` produces the byte-identical beat digest on BOTH wires. Build-side
  readers of the old shapes were repointed: `draft_curriculum.py` takes move tables from
  `graph.json`, `audit_mc_viability.py` reads pair links (legacy object links still parse
  everywhere, so old spec fixtures keep working).
- **Chunks are addressed by `fnv1a32(key)`** — the app's own `qhash()`, ported byte-identically in
  `scripts/_neural_content.fnv1a32`. No filenames in the manifest (~110KB of redundancy: the key
  already names the deck) and no collision bookkeeping: a chunk holds a `{key: value}` **map**, so
  a hash collision shares a file instead of losing an entry.
- **`n` (the manifest card count) is load-bearing, not decoration.** `deckMastery` computes
  `Σ min(stage,3)/3 ÷ n` from the persisted grades when a deck's cards are absent — the SAME
  arithmetic as the resident branch, because an ungraded card contributes 0 either way. Without it
  a manifest boot reads every deck at 0, `gameScore` sums to ~0, the user is told they are a white
  belt again, and the memo on `_stageVer` makes that stick. Crowns, lesson goals, seen-glyphs,
  "mastered decks" and Challenge evidence all read the same number.
- **Hydration invalidates.** `_bumpStageVer()` is the ONE writer of `_stageVer` (grades and
  hydration share it, so the score memo can never go stale); `_qkDecks` is nulled on every
  hydration; `_onDeckHydrated` + `_restudy(key)` REBUILD an open study surface's entry, because
  `_entryForKey` takes a `.slice()` and filling `d.cards` in place is invisible to a snapshot.
- **`_cardsOf(d)` is still the only legal way to read cards.** A manifest stub is truthy.
- **MC distractors must not depend on residency.** Whether a deck's cards happened to arrive
  decides whether a draw yields a distractor and therefore how many further draws happen — network
  timing would pick the options and rigged journeys would drift. `_warmMcPool` makes residency a
  PRECONDITION: it dry-runs the pooler inside an RNG transaction (`_rngBegin`/`_rngRollback` put
  every drawn value back, `Math.random` ones included), hydrates what it asked for, and repeats
  until nothing is cold; then the real call draws from an untouched stream. A consult that was not
  warmed emits an **`mc_pool_cold`** beat — never silent. Surfaces defer their MC block by one
  fetch rather than dealing from a partial pool.
- **`buildDrillPanel` must not run over a live study surface** (`_paneStudyActive()`): it resets
  `deck`/`_drillView`, so an arriving chunk used to wipe the deck the user had just opened.
- **No `cache: "no-cache"`.** The edge serves these with Cache-Control tiers
  (`scripts/regenerate_headers.py`); forcing revalidation threw the one free win away.
- **One source of truth for cards.** No monolith is emitted anywhere. Tooling that needs the whole
  corpus (the exhaustive `validate:mc` audit, tests wanting full residency) assembles it from the
  chunks via `scripts/_neural_decks.py` / `e2e/decks.ts`.
- **Journeys exercise the real path.** `e2e/dsl.ts` serves the manifest and chunks from per-worker
  buffers; `j.hydrate(keys)` / `j.hydrateAll()` / `j.decksSettled()` let a test say when it wants
  residency instead of assuming it. `scripts/triple_replay.sh` proves three consecutive runs of
  golden-path, jit-loop, mc-flashcards and landing-card are identical, plus a full beat-stream
  digest of one scripted roll (`e2e/journeys/replay-digest.spec.ts`).

<a id="v1-68-0-neural-pane-law-landing-questions-challe"></a>

## v1.68.0 — Neural: pane law, landing questions, Challenges, Game Knowledge

_Originally CLAUDE.md L813._

### Neural: pane law, landing questions, Challenges, Game Knowledge (v1.68.0+)

The runtime remains one imperative component in `neural/src/app.src.jsx`. Challenge definitions, pure progression, UI composition, feedback, and styling are split into `neural/src/challenge-*.src.js` and `neural/src/challenge-*.css`, then composed by `neural/build/build.mjs`. Core journeys include `pane-law`, `landing-card`, `roam-stage`, `white-challenges`, `challenge-curriculum`, `content-capstone`, `game-knowledge`, and `challenges-{engine,ui}`.

<a id="v1-76-0-one-pane"></a>

## v1.76.0 — ONE PANE

_Originally CLAUDE.md L817._

**ONE PANE (v1.76.0; LEFT since v1.94.0).** The left explorer rail is gone — **one pane, anchored LEFT** (`.ng-drill .ng-explorer`, 360px, `left:0`, z:8, display-based visibility, both classes on the one element for spec continuity; it opens from the top-left logo, so it lives on the logo's side) carries three tabs: **Explore | Challenges | Last rolls** (`.ng-learning-nav`, `data-view`; the third tab DISPLAYS "Last rolls" since v1.95.0 — "History reads as the history of BJJ", owner — while its view id, settings keys and every internal seam stay `history`). The `.ng-knowledge-header` section is GONE (v1.96.0 — with the tab subtitles it triple-stated the score): the woven knowledge belt + band road + "N% to blue" line live at the TOP OF EXPLORE'S BODY (`_knowledgeBlock`, `[data-knowledge]`), above the stats row; the nav is the pane's first child and carries the 64px logo/close clearance. Each tab is two-line (v1.95.0, `renderTabSubtitles`): a `<b>` title over a `<small data-tab-sub>` subtitle — Explore carries "Mastered N%" (the Game Knowledge score — word first, integer percent, v1.95.2), Challenges a miniature `.ng-tab-belt`, Last rolls a static "Your last rolls". The history tab hosts the roll history with inline decks (the old "Daily flashcards" hero bar is deleted; the score shows only as the Explore tab subtitle since v1.98.1). `explorerRef` is an alias of `drillRef`; `toggleExplorer`/`openExplorer` remain as names (logo, cue, keyboard all route to `openPane(view)`). Geometry consumers flipped with it (v1.94.0): the option tray pads LEFT (`updateUiShift`), the option-detail sheet centres on `sbW + (w−sbW)/2`, the follow-cam biases the focused node RIGHT of centre (`cx: f.x − offset`), and the study head carries a 64px top pad (`!important` over its inline style) so `‹ Back` clears the logo that now shares its corner.
- **Two body modes** via `_layoutPane()`: tabs mode vs **study takeover** (a live `deck`/`_session`/`_checkpoint` — `_paneStudyActive()` — hides the nav; `data-pane-study` on the pane; the study header's `‹ Back` (`data-pane-back`) returns to `_paneReturnTab`).
- **Pane bottom anchor (v1.93.0; final stack v1.98.1, styled v1.99.1):** the guest save nudge is a three-level unit — kicker caption `[data-anchor-caption]` "Save your progress", full-width primary `[data-anchor-auth]` "Create account" (44px, the block's one visual anchor), centered quiet escape line `[data-anchor-alt]` "Already have one? Log in" (44px link) — styled by the `.ng-anchor-*` classes in `helmet.html` (hover/active/focus-visible states; do not regress to inline styles) — ONE block (`.ng-pane-anchor`, `[data-anchor-auth]`/`[data-anchor-login]`) at the pane's foot, directly above the Settings/Terms/Privacy row — visible on all three tabs, hidden during study takeover and collapsed entirely when signed in (it is then contentless). The mastered/today/weak-spots stat row moved to the TOP of Explore's body (`_exploreStatsRow`, `[data-explore-stats]`, same `.ngStat` handles) — "the weak spots are the call to action" there (owner, v1.95.0). The History head is empty (the drill head is study-only now); signed-in users keep their session CTA + Log out in the Last rolls foot.
- **Two belts, two meanings (v1.95.0 — do not conflate):** the **score's** display rules (white is the FLOOR — never "0% to white", always "to blue") belong to `gameScore()` consumers; its woven belt VISUAL is retired (v1.98.1, owner — header died v1.96.0, the Explore mount followed; renderer in git history at v1.96.0 if a home is ever wanted). The score's one exposure is the Explore tab subtitle "Mastered N%". The old canon for reference: the knowledge belt rendered `gameScore()` — and WHITE IS THE FLOOR, never a target: the cold state wears the white belt whose displayed road spans the whole 0→blue stretch ("there is never 0% to white. It's always 0% to blue", owner; `gameScore()`/`BELT_SCORE` math untouched — display semantics only; white's tape stripes are quarter-marks of that displayed road, held belts wear `gameScore().stripes` exactly). The **Challenges-tab mini belt** (`.ng-tab-belt`, `data-tab-stripes`) wears the PINNED track's color with 0-4 stripes from that track's PROVEN-UNITS fraction (`unitComplete`: lessons done + checkpoint — v1.95.3; the objectives fraction was too generous, coach auto-ticks gave a guest unearned stripes) — LADDER progress, deliberately NOT `gameScore().stripes`.
- **Wiring seam (v1.93.0):** `_wirePaneControls()` runs at the choke point — `applyDeckVisibility()` on the open transition — so EVERY open path (openPane, openHomeToLatest, openMenu, openStudy, chip, pill, landing chip) gets live tabs. It used to live only in `openPane()`, which left the tab bar dead when a session's first open came through the account chip.
- **▶ BELONGS TO A TECHNIQUE, NOT TO A COLLECTION (v1.103.6, owner: "that play button should be reserved for techniques inside lists and outside of it, meaning positions, transitions, and submissions").** ▶ means *make this the current state and roll*, which you can do to a position or a technique and cannot do to a list — a list is a collection, like a System. So `_playButton(node)` now rides **every technique row**: Explore's Positions/Transitions/Submissions rows (via `_withListAdd`, which only `renderGraphGroup` and the search hits reach — Systems, Principles and Learning use different builders and stay play-less), a list's own items, and the shared-class preview's items. Family fold rows carry none: a family hub is an edgeless aggregator, not a state. `confirmPlayFrom` is the seam because it already handles every node type (a position seeds at itself, a technique at its origin position) **and it confirms first** — pressing ▶ in the pane mid-roll discards the roll you are in, so it must ask. Handle `[data-play-from="<nodeId>"]`, 24px (the pane figure), `aria-label` "Play from <name>" because a `title` is not an accessible name.
  - **A LIST ROW HAS NO DRILL CONTROL AT ALL (v1.103.7, owner).** `openListSession` opens a FLASHCARD session over the list's cards and never touched the roll, so its ▶ wore the wrong verb; v1.103.6 moved it to a stacked-cards glyph and the owner then deleted the button outright. A list row is now exactly **light it (the row) / read it (the count line) / share it / ×** — every verb that acts on ONE technique lives on the item that carries it (▶ and its own ✕). `openListSession` is **not dead**: `[data-shared-drill]` ("Drill these") still runs it on a RECEIVED class, which is the case that needs a one-press study path before the list has even been saved. That is the only caller left; deleting it would take the received-class study path with it.
- **THE CATEGORY SHAPE RIDES EVERY TECHNIQUE ROW (v1.103.6).** `nodeGlyph` and the canvas `draw()` (`:9516-9518`) share ONE vocabulary — **circle = position, triangle = submission, diamond = transition** — and two row types were not speaking it: Explore's **leaf rows inside a family fold** rendered no glyph at all (the one place in Explore that did not say what a technique was), and a **list's items** had none either. Both now call `nodeGlyph(n.ty, col, 7)` — 7px at pad 38 against the family row's 8px at pad 22, so the size tracks the ladder. NB when testing: the triangle is a CSS-border trick, so with `box-sizing:border-box` its computed `width` is **8px, not 0** — identify it by its transparent left/right borders, never by width.
- **LISTS ARE EXPLORE'S LADDER, NOT CARDS (v1.103.5, owner: "the style doesn't feel like the Positions category at all").** The Lists section is built from the SAME three-rung indent every other Explore group uses (`renderGraphGroup`'s `mk(html, pad, onClick)`, `padding:7px <pad>px`): head **pad 12** (14px/700 #dbe2f0 + a bare count), each list **pad 22** (13px/600 #c4cde0, count 10.5px, chevron 10px last) exactly where a family row sits, its techniques **pad 38** (12px #9aa6bd, the `from …` qualifier in #6b7691) exactly where a leaf sits. No card chrome, no glyph on the item rows — `Your lists (2)` now reads as a peer of `Systems (47)` and `Positions (136)` in the same scroller, which is the whole point.
  - **The pane's control figure is 24px, and 44 is for the surfaces a THUMB uses mid-roll.** `_listAddButton` already stated this rule and Explore's capture has been 24×24 on all 136 Positions rows the whole time; the Lists section was the one part of the pane pinned to 44 (by its own v1.99.4 specs), which is what made its rows 58px among 38px neighbours. Row controls — ▶ play, share, ×, and the per-item × — are now **24×24** like Explore's, so a row with controls lands at `7 + 24 + 7 = 38px`, Explore's own height wherever a capture control rides. 24px is also WCAG 2.2 AA (2.5.8 Target Size Minimum); 44 is the AAA/HIG figure and stays where it belongs — the option hand, the escape hand, the landing card, hit one-handed on a moving screen.
  - **Glyphs stay small, hit areas grow** (`.ng-lists-new`'s pattern): the count-line toggle is 10.5px text + a 10px chevron, which is an **18×12** target if you let type size the button. `padding:6px 5px` with a matching negative margin buys 28×24 without touching the type or the row height. Do not size a pane control by its glyph.
- **Lists (v1.97.0; chrome pass v1.99.3):** the `+` beside "Your lists (N)" (`[data-lists-new]`, aria "New list", 44px hit area) is THE deliberate list-creation control (it replaced the static "share a class" caption; `newList()` stays the one creation function — default name "Class · <date>", newborn becomes the active add target and its row highlights; per-list Share untouched; no `?capture=today` deep link exists in source). Explore's `keepList` reset-survival accepts owned lists (even empty) AND the `__shared` preview. **The + is a house-styled chip (v1.99.3, owner: the bare glyph "looks ugly as fuck"):** `.ng-lists-new` is the transparent 44px hit target, `.ng-lists-new-chip` the compact 28px visual in the segBtn token family, states in helmet.html CSS per the `.ng-anchor-*` pass (hover brighten, 1px active press, focus-visible ring) — no JS hover painting, do not regress to a bare glyph.
- **Inline rename (v1.99.3, owner: "I can't seem to click to rename my lists"):** a row's NAME (`[data-list-name]`, a real button, cursor:text) opens the editor; the ROW body (and the `[data-list-open]` count line) lights the list via `focusList`. The editor (`[data-list-rename]`, maxlength 60) commits on **Enter/blur**, cancels on **Esc** (its keydown `stopPropagation`s so Esc never walks the pane's Esc ladder and letters never hit global shortcuts), and an empty/whitespace/unchanged commit is a no-op revert (`renameList`). A REAL commit bumps the list's `t` — the cloud merge's name-from-later-t rule is what carries renames across devices — and re-sorts the list to the top. **The newborn from + opens straight into its editor** (prefilled, selected — naming is offered, never demanded). Three hard-won guards, all pinned by `e2e/journeys/lists-rename.spec.ts` (10 journeys incl. 390px drawer): (1) **a blur from DETACH is not a decision** — unrelated re-renders (the deferred systems.json arrival ~1s into a fresh profile) wipe the Explore body, and Chrome dispatches that blur while `isConnected` still reads TRUE, so the commit decision is deferred one real tick; (2) the editor **survives re-renders**: `_listEditDraft` carries typed text through a rebuild and refocus restores select-all when untouched / caret-at-end mid-draft; (3) a click that lands while (or within 400ms after — blur precedes click) the editor is open must NOT light the list (`_listEditClosedAt` latch).
- **Explore sections default COLLAPSED (v1.99.3, owner: "showing all categories should be collapsed"):** every top-level Explore section — Systems, Principles, Positions, Transitions, Submissions, Learning — starts folded; headers carry `data-explore-section="<label>"` + `aria-expanded`. Expanding/folding persists per section in ONE settings map, `exploreOpenSections` (the `challengeOpenSections` pattern — per-key LWW, cross-device, reload-stable); collapse is presentation only, nothing locks. The old `_exp.g` session set (which pre-opened Systems + Submissions) is gone; family sub-folds (`_exp.f`) stay session-local. **Search is deliberately untouched:** a query renders FLAT ranked results before any section exists, so a match inside a folded group is never hidden. Gated by `e2e/journeys/explore-sections.spec.ts`; `systems-surface.spec.ts`'s `openExplore` helper now expands the Systems header first.
- **Corridor chrome (v1.98.1; v1.99.2):** belt headers wear their dye PRONOUNCED (`--ng-track-soft` at 0.34 across the whole card, `--ng-track-line` border) and a **completion stamp** — a gray boxed-check watermark (`.ng-belt-stamp`, z:-1 behind the header text, `data-belt-complete`) once every live lesson is done; the Tutorial head stamps the same way at 20/20 (`data-tutorial-complete`). The header pin (`[data-belt-pin]`, v1.98.1) lived one version and is gone. Also: the `.ng-challenge-detail` HEAD (the "CHALLENGES / <name> / N of M" double title) and `.ng-detail-up` are deleted for every belt — the detail is a headless objectives block (advanced belts only; White's objectives ARE the Tutorial section). Pinning lives ON the belt header row (`[data-belt-pin]`, 44px, aria-pressed; `.ng-pin-track` is gone). No border-top separators inside a section (corridor + spacing do the structure). The **Continue button is dead** — opening the tab AUTO-SCROLLS (instant, open-only, `_challengeScrollPending`) to the pinned belt's header with the frontier row kept fully in view (minimal extra motion when the section opens taller than a viewport); corridor re-renders preserve `scrollTop`. The **Tutorial** section (renamed from "Getting started", belt-header lettering) defaults FOLDED at any progress (the ≥14 threshold is dead); its still-to-see chips ride the head row right of the title (`.ng-tutorial-chips`, clipped with a fade).
- The GI/NO-GI choice lives in **Settings → Rolling only** (`[data-settings-gi]`, v1.95.3 — the per-tab `.ng-gi-toggle` pill is gone; `setGiMode` unchanged). Last rolls explains its empty case (`[data-hist-empty]`, "No rolls yet — press play…") — roll history (`rollLog`/`_pastRolls`) is in-memory and has never persisted across reloads — the replay (v1.106.5) reads only what is already there and adds no persistence.
- View state: `challengeView` ∈ `explore|challenges|history`; legacy `tree→explore`, `path`/`collection`→`challenges`. Roll-advance re-renders of the History body are gated on `_viewMode === "history"` so an open Explore search is never stomped.
- Mobile: ONE 88vw drawer (from the LEFT edge since v1.94.0; strip-tap dismiss on the exposed right strip unchanged). The `.ng-drilltab` pill is DELETED (v1.99.0, owner: it must not appear on any form factor) — the account chip holds the bottom-right band seat (`bottom:28/right:14` on the phone, exactly like desktop's corner ownership; the drawer-open fade stays) and the LOGO is the one pane opener. "Study this state" (openHomeToLatest) survives on the landing card's familiarity chip `[data-land-count]`.
- **Account chip (v1.93.0): BOTTOM-right** (desktop `bottom:24;right:24`; phone `bottom:86;right:14`, stacked above the thumb-band pill). Since the pane moved LEFT (v1.94.0) the chip fades ONLY on the phone drawer (which owns the screen; the fade keeps the dismiss strip tappable) — on desktop it stays put and clickable while the pane is open.
- **Account menu (v1.94.0)** — the "NO account menu" canon is retired. The chip opens a compact `.ng-account-menu` anchored above it: signed-out `Create account` + `Log in`, signed-in the account email (non-interactive) + `Log out`; ONE separator; then `Settings`, `Keyboard shortcuts` (Settings → Shortcuts tab), and `Terms · Privacy`. Nothing else. It is CHROME: opening it never touches the pane, the pause latch, or the roll clock. Esc closes it FIRST; any outside tap closes it (capture-phase pointerdown, so propagation-stopping surfaces still count). The open menu PORTALS to the app root at z:46 — the fixed wrap is its own stacking context, so root-level overlays (landcard z5, coach z70) would otherwise bury it. The pane opener is the LOGO only; the pane's bottom anchor + footer keep their auth CTAs for now (redundant with the menu — owner to decide). The Settings modal still carries Terms · Privacy (`[data-settings-legal]`).

<a id="v1-68-0-pane-law"></a>

## v1.68.0 — PANE LAW

_Originally CLAUDE.md L838._

**PANE LAW (v1.68.0).** The pane is **manual-only** — nothing in the roll loop opens or closes it. It no longer opens at roll start, no longer opens as a save nudge, no longer hides at round end, and desktop graph clicks leave it alone (mobile keeps the strip-tap dismiss, since the pane covers the screen there).
- **Open = the game stops. Close = the game resumes, but only if the pane is what stopped it.** Latched in `applyDeckVisibility()` via **`_paneAutoPaused`** — one latch for the whole merged pane (any tab, any study surface); `_dossierAutoPaused` stays separate for the node dossier. A hand-paused roll stays paused when you close the pane.
- Latched in `applyDeckVisibility`, not `setDeckOpen`, because several study entry points assign `deckOpen` directly. Beats: `pane_paused` / `pane_resumed`. Esc closes the pane last, once no overlay is up.

<a id="v1-68-0-question-first-landing"></a>

## v1.68.0 — QUESTION-FIRST LANDING

_Originally CLAUDE.md L842._

**QUESTION-FIRST LANDING (v1.68.0).** The flashcard is no longer a place you go — it is what the game asks on arrival. `renderLandCard(node, mode, hooks)` docks `.ng-landcard` above the options tray in fixed read order: **identity** (`[data-land-id]`: name · where you came from · Top/Bottom or Attacking, with ONE top-right familiarity chip `[data-land-count]` — the ○/◐/● seen-glyph fused with the deck's recall-proven count, e.g. `● 3/8`; glyph-only when no deck is authored; clicking it opens this state's flashcards, v1.76.0) → one-line definition → **film** → **ONE multiple-choice question** (`[data-land-q]`) → your options → **`More ▸`** (`[data-land-more]`, which since v1.101.0 UNFOLDS THIS CARD rather than opening a dossier — see ONE CONTAINER below, where the identity block's fate is also recorded: a landing card no longer prints the name or the side, because the graph does). The `.ng-drilltab` pill is fully DELETED (v1.99.0 — quieted in v1.93.0, gone now): the landing chip opens "study this state", the logo opens the pane, and the save hint is a toast + the in-pane CTA (no shake target).
- There is deliberately **no second question** at the technique node between commit and sweep. It was built and cut: gating the sweep on a 4s window added that delay to every move (and broke `golden-path` / `jit-loop` on tempo). The landing question already moves the odds of the very transition or submission you are about to attempt, and the sheet's JIT drill covers buying odds right before committing.
- **Economy, one rule on both surfaces:** right → the ordinary credit path (`noteCardDone`: mastery + sharpness already move the odds — no second bonus) plus `refundDecision(2500)`; wrong → `_qMod` −0.04 (plausible) / −0.08 (trap), folded into `moveChance` and **cleared on the next `enterLand`**. Timing out costs nothing.
- `questionFor(key)` picks the deck's first unproven card (`cardStage < 2`); a proven deck asks nothing.
- **The card BACKFILLS when a late payload lands (v1.82.1).** Decks and dossier content are deferred, and on a measured Fast-4G cold load they arrive ~18s AFTER the first hand — so a first-time visitor used to take their opening decision with no question, no definition and no film, and the ready hooks refreshed the drill panel/odds/tab but never the card, leaving that state silent for its whole turn. `_landBackfill()`, called from `onFlashcardsReady`/`onContentReady`, re-renders the LIVE card in place; `land_q_shown` carries `backfill:true`. It refills only a card that has **never shown a question** (`!_landQ`) on the **current** position with a live decision window — a question already on the table is frozen, because re-mounting an answered one would hand out a second attempt at credit already scored. Arrival TIME is journey 1's payload work; this is what makes it visible.
- **MC is the in-play format; the sidebar is the study surface.** `mcMode` default flipped `auto` → **`classic`** — nobody meets multiple choice in the sidebar unless they opt in. The checkpoint quiz stays MC always.
- `_mcBlock(card, key, onDone, surface)` — truth lives in the closure + `this._mc` (never a DOM attribute); `surface` (`land` | `deck`) lets two blocks coexist, and only `deck` auto-advances. **`surface` also scopes the RNG**: the landing card draws on `land-mc-pick` / `land-mc-shuffle` so it can never eat the rigged `mc-*` queues the sidebar journeys depend on (this is what kept `golden-path`'s frame-exact replay honest).
- **Keys: `A` `B` `C` `D` answer the live MC block; digits `1–9` stay the option-card openers.**

<a id="v1-104-8-a-stalled-payload-left-the-landing-quest"></a>

## v1.104.8 — A STALLED PAYLOAD LEFT THE LANDING QUESTION "STILL SETTLING" FOREVER

_Originally CLAUDE.md L851._

**A STALLED PAYLOAD LEFT THE LANDING QUESTION "STILL SETTLING" FOREVER (v1.104.8).** Fixing the harness glob (v1.104.6) exercised, for the first time, the case the cold-start journeys were written for — and the app failed it. `renderLandCard` stores the MC warm-up promise in **`_landWarmP`** as the "the question has stopped moving" signal, and `landSettled()` awaits it. `_warmMcPool` awaits deck fetches, so on a **stalled** connection (a socket that never completes, which is what `{ never: true }` models — not a 404) the promise never settled, the signal never cleared, and every reader waited forever: eleven journeys went from failing in ~1s to timing out at 120s. It survived for months only because the rule meant to reproduce that connection named a URL the app never fetches, so the case was never run.
- **The SIGNAL is bounded (`NG_LAND_WARM_CEILING_MS` = 8s, wall clock — a stalled socket stalls in real time); the WORK is not.** The fetch is never cancelled, `p` still re-renders the card if the payload eventually lands, and `_landBackfill` covers it independently — so a slow-but-working network behaves exactly as before. On timeout the app emits **`land_warm_stalled`**, so "no question here" always has a named cause rather than being a phantom.

<a id="v1-104-6-the-harness-was-holding-a-payload-that-i"></a>

## v1.104.6 — THE HARNESS WAS HOLDING A PAYLOAD THAT IS NEVER FETCHED — root cause of 15 red journeys

_Originally CLAUDE.md L854._

**THE HARNESS WAS HOLDING A PAYLOAD THAT IS NEVER FETCHED (v1.104.6) — root cause of 15 red journeys.** Every cold-start spec armed `boot("/", { payloads: { "flashcards.json": {...} } })`. A bare pattern is a SUBSTRING match over the request URL (`globToRe`), and the app has fetched **`flashcards/_index.json`** since v1.80.4 (`app.src.jsx:442`, via `_dataBase()`) plus per-deck `flashcards/<hash>.json`. `"flashcards/_index.json"` does not contain `"flashcards.json"`, so the rule matched nothing: the payload was never held and every assertion about the 18s cold-start skew was measuring a fully-warm boot. 12 rules + 3 timeline predicates repointed.
- **The same dead name hid in `build.mjs`.** Two of its four `fetch()` rewrites (`flashcards.json`, `systems.json`) could not fire — both call sites build their URL through `_dataBase()` — and the guard only warned when **every** rule missed, so a rule going stale was invisible. The rewrite table is now iterated per rule and **throws** on any `from` string absent from the source, because a rewrite that cannot fire silently stops prefixing `__NEURAL_DATA_BASE`, which is exactly how the harness serves its fixtures.
- **CORRECTION to v1.103.0:** `check_position_type_vs_score` never ran. `scripts/validate_graph_integrity.py` used `os.path.dirname` without `import os`, the `NameError` hit a bare `except Exception: return issues`, and the check returned empty on every run — so "0 disagreements across all 272 position-roles" meant "the check never executed". With `os` imported the real figure was **95 `position_type_score_disagreement` warnings**: positions where the authored dominance word disagrees with the arithmetic. The word still wins (v1.103.0 canon); these are content questions, not code ones. The skip path now prints instead of returning silently. **Re-measured 2026-08-21 (v1.120.0): it is now 49, and classed `info`, not `warning`** — the calibration waves closed 46 of them. The gate's headline is `Errors: 0, Warnings: 7` (`counter_high` 2, `technique_range_low` 4, and one from the bidirectional `from_position` check), with 345 `info` of which 295 are `attempt_negligible`.

<a id="v1-104-6-ci-that-could-not-pass-and-gates-weaker"></a>

## v1.104.6 — CI THAT COULD NOT PASS, AND GATES WEAKER THAN THE THING THEY GUARD

_Originally CLAUDE.md L858._

**CI THAT COULD NOT PASS, AND GATES WEAKER THAN THE THING THEY GUARD (v1.104.6).**
- **`e2e-full.yml` packaged an incomplete site — the PR gate for BOTH `main` and `dev` could not pass.** It tarred six allow-listed paths; the specs added since need `public/l.html`, `_redirects`, `l-manifest.json`, `/Positions/*`, `/Systems/*`, `/sitemap.xml`, `/llms.txt`. Now `tar -czf … -C source public`. **If size ever bites, use `--exclude`** — a new emitted path must be packaged by default, because an allow-list rots silently and this one predated every spec that broke on it.
- **`votes-refresh.yml` committed a `graph.json` with the strength pass skipped**, stripping `strength` from **4,464 of 4,465 nodes**. It ran bare `regenerate_graph.py`; it now runs the `npm run regenerate:graph` umbrella (graph-base → layout → ordinals → strength). CI must never run a subset of the chain a human runs.
- **The PR ratchet was weaker than the deploy gate it protects**: `graph_validation_baseline.json` allowed **76** errors while both deploys hard-fail on the first. Actual errors are 0, so the baseline is now **0**.
- `ci-validate.yml`'s `paths` filter omitted `globalGraphLayout.json` — the INPUT its own ordinal gate reads — and `neural/src/**`, which `test:units` pins. Both added.
- `keepalive.yml` has **never committed anything**: `git diff --quiet` reports no change for an UNTRACKED file, so the anti-auto-disable job always took the "nothing to do" branch. Now `git status --porcelain`.
- Node **20 (EOL) → 22** in the three build/test workflows (ci-validate was already 22); `seo-monitor.yml` runs Python with **no `setup-python`** step (added); **`serve`** — the web server every e2e gate depends on — was declared only in `package-lock.json` (now a real devDependency).

<a id="v1-104-5-one-start-a-roll-here-and-the-url-follow"></a>

## v1.104.5 — ONE "START A ROLL HERE", AND THE URL FOLLOWS IT

_Originally CLAUDE.md L866._

**ONE "START A ROLL HERE", AND THE URL FOLLOWS IT (v1.104.5).** Owner: "i clicked the play from this roll in one of my last rolls sidebar and it didnt open the MC nor position the graph … why wasnt this calling the same method as when navigation happens? i thought this had been streamlined". Three separate causes.
- **`playFrom` was a SECOND, STALE implementation of `rollFromPosition`.** It hard-coded `camTarget = { cx, cy, vw: this.graphW * 0.42 }` — the exact framing v1.103.2 replaced everywhere else with `rollCamTarget()` — so a roll started from the search modal or the "Roll from here" confirm landed on a different composition (≈5× zoomed out, no lift into the free band, not aimed at the node's label, no horizontal bias) than the identical action taken by clicking the node. It also never archived the roll it replaced into `_pastRolls`, never reset `rollLog`/`_lastActor`/`_currentDeckKey`/session state/`_played`/`prevPosVal`, never called `hideCenter()`, and landed via `enterLand(false)` so the new roll's opening state was not marked as a start. It is now a two-line wrapper; `rollFromPosition(nodeIdx, staged, roleOverride)` gained the ONE thing playFrom legitimately added — a caller-chosen role, which cannot be derived because every position title ends "… Top".
- **The pane hid what the button produced.** Pressing play in Last rolls DID roll and DID frame the camera — behind the pane, which pauses the roll (pane law) and since v1.101.7 stands the landing card down at every width. The button now `setDeckOpen(false)`: pane law forbids the ROLL LOOP touching the pane, and this is the USER pressing play, i.e. the "close = the game resumes" half of the same law.
- **THE URL NOW FOLLOWS DELIBERATE NAVIGATION.** Every graph node id IS a real page path — **1466 of 1467 ids resolve to a built page** (the miss is `Transitions/100%-Sweep`, whose `%` cannot survive a filename) — so `_syncUrl` needs no mapping table and cannot drift from the site. `pushState` fires ONLY from `rollFromPosition` (a node the user chose); a roll's own moves never touch the URL, because the site's PostHog snippet captures `$pageview` on history changes (Quartz's SPA router navigates by pushState too) and syncing every auto-advance would multiply pageviews by the length of a roll. `popstate` walks back through the nodes you chose, and arriving ON a node's page seeds a STAGED roll there (`_seedFromUrl`) — `/` is deliberately untouched, so the first-impression weighted draw still owns the front door. A `/l/<code>` path is never rewritten: the recipient path parses `location.pathname`.

<a id="v1-115-0-the-cal-join-was-spelling-the-key-wrong"></a>

## v1.115.0 — THE `cal` JOIN WAS SPELLING THE KEY WRONG, AND 294 OF 297 SUBMISSIONS SHIPPED NO ODDS

_Originally CLAUDE.md L871._

**THE `cal` JOIN WAS SPELLING THE KEY WRONG, AND 294 OF 297 SUBMISSIONS SHIPPED NO ODDS (v1.115.0).**
`graph.json` keys a technique by `slugify(<display name>)` — ONE flat kebab token. A layout id keeps
the authored PATH, so `Submissions/Kimura/from-Front-Headlock` reaches `enrich()` as
`kimura/from-front-headlock`, and that `/` is the `-` the key was built with. The emitter only ever
tried the first spelling. **0 of 297** submission keys in `graph.json` contain an inner slash.
- **Nothing went red for months, by construction.** A missing `cal` does not crash — `calSuccess()`
  returns null and `moveChance` falls back to `0.36 + dom*0.1` (`app.src.jsx:10371`). Because every
  submission's dominance sits in a narrow band, all of them printed **~45.5-45.7%**. MEASURED: the
  "Success rate" on **~289 of 1,204 dealt option cards** was fabricated, standing in for authored
  rates that actually span **10-74%**. `graph.json` was right the whole time; only the wire was
  starved, so anything computed offline from `graph.json` was always trustworthy.
- **`_tech_keys(slug, title)` is the fix: three rungs, cheapest first, and the last is the key's OWN
  CONSTRUCTOR rather than one more guess about spelling.** `as-is` (3 submissions + 1031
  transitions) → `slash→hyphen` (291 submissions) → `slugify(title)` (3 + 3: punctuation an id
  cannot carry — `100%-Sweep` → `100-percent-sweep`, "Fireman's-Carry" loses its apostrophe).
  Together **1331 of 1331**. The SAME ladder feeds `tech_avail` (which `giAllows` reads), lifting it
  **1033 → 1327**; the 4 that stay unmatched are techniques no position offers, so there is no
  availability for them to carry. Positions keep `_pos_role` — a position's leaf IS a slug, a
  technique's leaf (`from-mount`) is not, which is exactly why they cannot share a ladder.
- **The emitter now refuses to write a wire that has lost its calibration** (<95% per type, printed
  every run). A silent join is invisible by definition; it gets counted at the one place that can
  see it. Measured after: submissions **297/297**, transitions **1034/1034**.
- Payload **+46,605 raw / +3,321 gzip** → 1,371,502 / 1,600,000 and 281,649 / 330,000. **No ceiling
  raise.** Replay digests are byte-identical: the extra `rng("outcome")` draw a repaired submission
  can consume only fires on a FAILED submission, which the scripted rolls do not hit.

<a id="v1-114-2-arriving-on-a-node-s-page-sets-the-board"></a>

## v1.114.2 — ARRIVING ON A NODE'S PAGE SETS THE BOARD; IT DOES NOT START A ROLL

_Originally CLAUDE.md L897._

**ARRIVING ON A NODE'S PAGE SETS THE BOARD; IT DOES NOT START A ROLL (v1.114.2).** Owner, on
`/Positions/Side-Control/Bottom?dual=iso`: *"it seems like immediately after I go into this ... it
restarts the roll. It says 'Restarting the roll', so it leaves no time for me to stay in this
position. In fact, we should stay at this position. The graph should navigate to it, meaning
visually we should be zoomed in at this position so that its node shows up above the ng-landcard,
and it should start paused ... only start a new roll in roll history if the player clicks the play
button explicitly."* Three defects, and PRODUCTION WAS WORSE THAN THE PROTOTYPE.
- **All 272 role pages resolved to NOTHING in production.** The visual layer collapses Top/Bottom
  into one hub (`Positions/Side-Control`) and only `?dual` emits role members, so `_nodeForPath`
  returned **-1** for a REAL built page and the visitor got a random weighted start on the wrong
  side. `_nodeAndRoleForPath` now falls back to hub + side and carries `/Bottom` as the **role**;
  a `?dual` member node still resolves directly and its own `role` is used. A **technique** page
  seeds at its ORIGIN position (the `confirmPlayFrom` rule) — `currentPos` must be a position or
  the roll begins inside a transition node with no hand to deal.
- **`_urlSeeded` was assigned at boot and read by nothing.** `updateCamera` called `startRoll()`
  unconditionally when the intro finished, 3.2s after the seed ran at ingest — which drew a fresh
  position and printed "Restarting the roll" over it. The seed is now only RECORDED at ingest
  (plus the deck prefetch, since the intro is still its runway) and applied at the one place a
  boot roll begins. Deliberately **not** via `stageRollAt`: that fires `roll_staged`, which is the
  White objective *"Start a roll here"* whose own copy is *click any node on the graph to roam
  there* — typing an address is not that, and crediting it would be the retired coach's false tick
  all over again.
- **A STAGED BOARD NOW KEEPS ITS FRAMING.** `rollCamTarget` measures the free band between the
  announce block and the landing card, and a fresh landing builds that card 0.6s AFTER the frame
  is computed — so the auto-retarget suppression that protects a hand-paused roll ("never yank the
  camera the user is reading with") froze an answer taken before there was anything to measure.
  Measured on this very URL: node bottom **371** against a card top of **370**. `stagedIdle`
  (`_staged != null && !_played && paused && !_replay`) keeps a never-played board tracking; a pan
  (`userActiveNow`), a camera lease, or pressing play each take it back through guards that were
  already there.
- **`/` is untouched** — no node named, nothing seeded, and the first-impression weighted draw
  (v1.82.3) still owns the front door, running.
- Gated by `e2e/journeys/url-arrival.spec.ts` (5 journeys, 1 `@curated`), four mutants, four kills.
  **Harness note worth keeping:** the landing card ANIMATES IN, and a camera read taken inside one
  `advance()` describes nothing — measured, the card's top was still 588 on the frame the camera
  last aimed against and reached 376 on the next. A second bare `advance` is NOT enough; an
  intervening `page.evaluate` is what forces layout and lets a frame render between pumps.

<a id="v1-125-0-the-pair-is-the-default-and-it-is-derive"></a>

## v1.125.0 — THE PAIR IS THE DEFAULT, AND IT IS DERIVED AT INGEST

> **Status:** Current - the derived pair is the default; `?dual=legacy` is the only escape hatch.

_Originally CLAUDE.md L935._

### THE PAIR IS THE DEFAULT, AND IT IS DERIVED AT INGEST (v1.125.0)

Owner: *"dual=iso should be made the default now, we can keep the dual=legacy if it's ok, but the
dual=iso should be default now, and main thing, and optimized for that (not legacy anymore)."*

**IT COULD NOT SHIP THE WAY THE PROTOTYPE DID.** The prototype got two orbs per state by EMITTING
2,931 pre-split nodes: **2,471,947 raw / 199,358 gzip**, against the shipped wire's **546,746 /
90,492**. Swapping the file in puts the eager set at ~3.25MB against a 1.6MB ceiling. It never had
to ship that way — both roles are already in the data model, `ingest()` already computes `z`, `h`,
`pi`, `rep`, `rSite`, `colU`, and since v1.113.1 the lift is render-time — so **`_deriveDualPairs`
rewrites `data` into the exact shape the prototype file has and hands it to the same ingest that
has been rendering `?dual=iso` since v1.113.0.** The look the owner approved is reproduced by
running the identical code, not by reimplementing it. **Zero wire bytes**: `graph-data.json`,
`graph.json`, `globalGraphLayout.json` and `node_ordinals.json` are untouched.

- **`?dual=legacy` is the escape hatch** and now the only thing the flag opts *out* of; `null` is
  the default and means the derived pair. (`?dual=fixed|force|iso` loaded their prototype files for
  one version, which is what made the A/B below possible; **retired in v1.126.0** — see that
  section. They are accepted-and-ignored now.)

**THE HUB KEEPS ITS ID: THE REP MEMBER *IS* THE HUB NODE.** Same id, same share ordinal, same
`/Positions/Mount` URL. So `node_ordinals.json` needs no new ordinals — minting ~1,464 would be
irreversible and would not save one already-posted `/l/<code>` — and every id-keyed consumer
(lists, systems lighting, curriculum fog, `_lessonIndex.nodeId`) lands on the rep exactly as it
lands on the hub today. Only the PARTNER mints an id, `<hub>/Bottom` / `<hub>/Defender`: measured,
**0 of 1467 collide with an existing hub id**, and **1466 of 1467 resolve to a built page** — the
same 1466/1467 the hubs manage, with the same single miss (`Transitions/100%-Sweep`, whose `%`
cannot survive a filename). `_syncUrl` therefore keeps working on both halves with no mapping table.

**THE LINK SET IS RE-KEYED, NEVER REBUILT — AND IT TAKES TWO KINDS TO DO IT.**
- **Kind 1, the real edge, ONE FOR ONE**: each hub link goes to the member it belongs to — the
  PERFORMER side at the technique's canonical origin (the attempt edge), the side its outcomes LAND
  on anywhere else. One for one is load-bearing, not tidiness: `rSite` recovers the production hub
  radius as `sqrt(deg_a + deg_b − 2)`, which is the hub's own degree only if no hub link is split in
  two. Measured after: **1467/1467 sites recover exactly**. The prototype double-booked 187 hub
  edges onto both members, which is precisely what that formula cannot survive.
- **Kind 2, SITE ADJACENCY — one-way, no degree, never drawn.** Splitting the edges is right for
  GEOMETRY and wrong for GAMEPLAY, because several readers walk `adj[currentPos]` with NO role
  filter, deliberately: they are asking about the EXCHANGE, not about your hand. So the other half
  of the site gets the technique too, which makes `adj[<either member>]` byte-for-byte today's
  `adj[<hub>]`, in the same order, and every role-agnostic reader identical **by construction**
  rather than because it happened to be tested.

> **This was not theory — the suite found it.** With a purely role-split adjacency, `opponentDefend`
> was handed YOUR hand instead of your opponent's (their moves live on the other half of the site),
> so a belt-test opponent simply stopped finding submissions and `content-capstone` went red. The
> same shape would have quietly changed `_mcPool`'s graph-neighbour distractors and `_posIdx`'s
> playability test. **Do not role-split `adj`.**

**GAMEPLAY IS BIT-IDENTICAL, AND THAT IS ASSERTED, NOT ARGUED.** All **272/272** role-hands deal
the same cards **in the same order** as `?dual=legacy` — order included, because the tray is ranked
by EDGE and a re-sort is a visible change. All **1326/1326** dealt options resolve `resultPos` to
the same hub. `scripts/triple_replay.sh`: 3 byte-identical replays, 27 results, digest
`0390cc44ee7f40e5`. The split is a MODEL change, not a game one.

- **Three enumerations had to stay per-SITE, and each would have been a silent regression.**
  `_posIdx` (the first-impression pool) — v1.82.3 is a measured distribution over **136** positions
  and `startPosTraffic` sums weight per position SLUG, which `_posSlugIndex` hands to the rep; both
  halves in the pool would have doubled it with 136 zero-weight entries, spent the 2% floor on them
  and changed which state a newcomer opens on. `buildExplorer` — both halves carry the SAME title,
  so Explore would have printed every row of all three categories twice (272 Positions, 2662
  Transitions) with nothing to tell them apart. `_ambig` — counting members puts every name at ≥2,
  and `displayName` would print the FULL qualified name on every option card and in-node label, the
  exact inverse of the v1.103.0 rule. All three filter on `rep`, which is `true` for every unpaired
  node, so all three are no-ops on the legacy graph.
- **`deg` is GEOMETRY; `siteDeg` is the state.** A member's own degree is what makes an attacker orb
  bigger than its defender, so it must stay split — but `movePotential`'s `onward` ("how many
  follow-ups does this open") is a property of the STATE, and reading the split number there would
  halve a value the escape tray prints. `n.siteDeg` is the hub's degree, 1467/1467 exact, and
  identical to `deg` on any unpaired node.
- **`cal` is split by what each side can answer for.** Positions: both members get `avail` and the
  WHOLE `ev` table, and only the `ew` entries their own role performs. Techniques: the attacker owns
  the EXCHANGE (`successRate`, `outcomes`) because a defender's are the role-flipped mirror rather
  than a copy; the defender keeps `avail`, which is genuinely role-neutral, so `giAllows` never
  falls through to its name heuristic.

> **`ev` GOES ON BOTH HALVES, WHOLE — filing each role's block on its own member is a trap.**
> `_evRowsFor(posIdx, role)` looks up `posIdx + "/" + role`, so a per-member `ev` makes the answer
> depend on WHICH HALF you are standing on — and the side you are PLAYING is `playerRole`, which
> can differ. Measured: flipping the role without moving (option-edge's `landBottom`, and every
> role swap) left every card with a null EDGE, i.e. no number at all on the face the card exists to
> print. Two references to one block; the only per-member work is remapping the technique idxs.

**SIX SPECS HELD PRIVATE COPIES OF "WHAT THE NODE SET IS", AND THE PAIR CASHED THEM ALL IN.** The
baseline was measured first — the eight affected files were **49/49 green on HEAD** — so every
failure was attributable, and none of them was a gameplay defect the app had. Two classes:
- **Corpus counts**: `option-hand`'s independent hand sweep, `option-overflow`'s clock sweep and
  three copies of `_posIdx`'s filter inside `first-impression` all walk "every position", which is
  now 272 members rather than 136 sites — they double every sweep and then assert 272. Each now
  skips `rep === false`. `option-hand`'s "the corpus is 297 submissions" counts NODES, and a
  submission is two of them. These copies are deliberate (a second implementation checked against
  the app on every run IS a gate) — they just have to count the same objects the app counts.
- **`n.y` WHERE THE RENDERER DRAWS AT `LY(n)`, for the third time** (after v1.114.3's hover and tap,
  and v1.114.4's `rollFromPosition`). `graph-naming`'s `parkOn` AND its `profile` both centred on
  the stored coordinate, so the canvas annulus sampled empty sky and reported "no ring is drawn"
  about a ring that was drawn; `url-arrival` re-derived the camera's aim from `{x,y}` where the app
  passes `camFocus` = `pairMid`. **Any spec that converts a node to a screen position must go
  through `_LY`/`pairMid`.** Both are identities on an unpaired node.

**WHERE IT DIFFERS FROM THE PROTOTYPE, THE PROTOTYPE WAS WRONG** — proven at the time by
`e2e/prototype/dual-derive-equiv.spec.ts`, which booted both and diffed the live node sets. **That
spec went with the payload it needed (v1.126.0) and the figures below are its record, not a
re-runnable check** — the prototype file no longer exists to diff against. What survives, and is
the stronger oracle anyway, is `dual-consumers.spec.ts`: the same build booted twice, `/` against
`/?dual=legacy`.
- **+3 pairs (6 nodes).** The prototype left `100%-Sweep`, `Fireman's-Carry` and `Counter Entry to
  Opponent's Leg` UNPAIRED because its `tech_key()` could not spell them — **the same v1.115.0 slug
  class**. graph.json has attacker AND defender for all three.
- **+752 links** the prototype's graph.json rebuild never produced: **738 Submissions, 724 of them
  family-nested** (`Submissions/<Family>/<variant>`), the identical spelling failure.
- **−187 links**: the double-bookings above. **−1**: `Side-Control/Bottom ↔ Buggy-Choke`, a
  graph.json edge `globalGraphLayout` does not carry — and the visual layer's link set is the
  layout's, which is why production omits it today too.
- Net effect on play: the derivation **GAINS 8 cards across 7 of 272 hands and loses none**
  (`Rolling Omoplata`, `Reverse Armbar from Mount`, `Kneebar from Carni`, …). The spec asserts that
  direction rather than a count, so a real regression cannot hide in it.
- **Geometry.** The iso ground projection is EXACT (max |dx| 0.000000 pre-de-overlap). What differs
  is the de-overlap, and only because radii differ where the prototype lost edges: A→B median
  **1.14u** on a graph **1520u** wide. The claim that matters is stated against the layout instead
  of against the prototype — drift from `globalGraphLayout`'s own ground point is **derived median
  7.28u vs prototype 6.96u**, i.e. the derivation settles as close to the beloved global shape as
  the payload the owner approved, and the difference between the two is the sweep's own local jitter.

**WHAT IT COSTS, DISCLOSED RATHER THAN DISCOVERED.** Bundle **+3,275 raw / +1,349 gzip** (459,007 →
462,282; gzip -9 135,259 → 136,608). Browser-measured first-hand gzip **379,037 → 380,343** against
the 385,000 ceiling, so the tightest number in the tree keeps **4,657 B** of headroom; the payload
gate reports neural eager gzip **301,688 / 330,000**. The real bill is CPU: `ingest()` goes **38.6 →
105.2ms** on desktop and **138.4 → 395.2ms at 4x CPU throttle**, of which the derivation itself is
only **6.8ms** (28ms throttled). The rest is the de-overlap sweep running over 2,934 nodes instead of 1,467 —
**1,578,690 → 4,831,712 inner iterations**, and it never converges, so all 30 rounds always run.
**Not solved, and the honest fix is named**: sweep SITES rather than members (a pair is already a
rigid body there, so two stranger orbs get compared four times), which changes the emitted geometry
and therefore is not being done inside the change that ships the geometry. `?dual=legacy` is the
lever if it ever has to come off.

> **A hoist that looks obviously safe and is not.** Lifting `a.x`/`a.y` out of the de-overlap's
> inner loop moved the emitted geometry immediately: `_mv` moves `a` ITSELF during that loop, so
> the coordinates must be re-read every iteration. Only `r` and `pairId` are invariant. The cheap
> `dx >= g || dy >= g || dy <= -g` reject beside it IS safe — `hypot` is never smaller than either
> leg, so it rejects only what `d >= g` already rejected — and both graphs' coordinates are
> identical to 9 decimals before and after. It is kept for being free, not fast: the win is inside
> run-to-run noise (hub medians spread 36–58ms), so **do not quote a speedup for it**.

**KNOWN, DELIBERATELY NOT DONE.** `nodeForKey` maps `<family>|Bottom` to the rep (first-wins),
which is exactly what it did when the hub was the only node — identical behaviour, not a
regression, but now that a bottom member exists it could be made role-correct. Same for
`_curriculumIdxSet`, which lights the rep only. Both are behaviour changes and belong to whoever
decides them, not to the change that splits the node.

<a id="v1-126-0-the-prototype-is-retired-and-every-id-ke"></a>

## v1.126.0 — THE PROTOTYPE IS RETIRED, AND EVERY ID-KEYED JOIN IS AUDITED

> **Status:** Current - `?dual=iso|fixed|force` are accepted-and-ignored; the prototype payloads are gone from the build and every gate.

_Originally CLAUDE.md L1084._

### THE PROTOTYPE IS RETIRED, AND EVERY ID-KEYED JOIN IS AUDITED (v1.126.0)

**`?dual` IS A ONE-VALUE SWITCH NOW, AND THE VALUE IS THE WAY OUT.** `legacy` = the hub-collapsed
graph; **everything else, `null` included, is the pair.** `?dual=iso|fixed|force` named PROTOTYPE
PAYLOADS — 2.47MB pre-split files that only ever existed outside the shipped tree — and they are
gone with the fetch fork that loaded them, the `dev-serve.mjs` route that mapped them out of
`tests/artifacts/dualpair/payloads/`, `scripts/prototype_dual_pair_layout.py`, `npm run
prototype:dual` and the two `e2e/prototype/` specs whose subject they were. (The BEHAVIOURAL half of
those specs came back in **v1.127.0** as `e2e/journeys/dual-pair.spec.ts`, once the derivation made
their subject reachable without a payload; the screenshot shoot did not, and that block says why.)
**Accepted-and-ignored,
not rejected** (the `?variant=legacy` precedent), and here that is the *cheaper* option as well as
the kinder one: an unknown value has always fallen through to `null`, so deleting them from the
accept-list IS the accepted-and-ignored behaviour — zero code. It is also honest, because the graph
those links promised is the graph a plain visit now shows. The committed evidence PNGs STAY:
`/dev/experiments` renders them and `build_forward_components.mjs` throws without them; they are
the frames the owner judged, not a regeneration path. Bundle **−561 raw / −144 gzip**.
- Two ingest branches went with it, and the wire proves they cannot recur: the `/Attacker` suffix
  strip in `techSlugIndex`, and the **hub-id alias pass** that re-pointed a retired hub id onto a
  member. The derived pair retires nothing — the rep IS the hub — and that pass was held off it
  only by a `/(Top|Attacker)$/` guard, which is one edit away from turning `Positions/Mount` into
  the category `Positions` inside `_idIndex`. **Measured: 0 of 1467 hub ids end in a role suffix in
  either direction** — which is the same measurement that says a derived partner id can never
  collide with a hub.

**THE AUDIT: EVERY CONSUMER THAT ASSUMED 1,467 NODES OR HUB IDS, DIFFED LIVE.** The method is a
DIFFERENTIAL — one build, booted twice, `/` against `/?dual=legacy` — because the only trustworthy
oracle for "did this join move?" is the graph the join was written against. Pinned by
`e2e/journeys/dual-consumers.spec.ts` (7 journeys, 4 `@curated`), **11 mutants, 11 kills**.
Identical across both graphs:

| consumer | result |
|---|---|
| `_ordById` / `_ordToId` | **1467 = 1467, not one ordinal moved**; 0 partners carry one |
| a `/l/<code>` minted on `?dual=legacy` | decodes to the **same 11 ids**, 0 unknown, same lit sites, and **re-mints byte-identical** |
| `cal.ev` node-index join | **272/272 hands, 1326/1326 cards**: same technique, same landing, same `[e0,c1,att]` row, same printed integer |
| `buildExplorer` | 136 / 819 / 75 families, row-for-row |
| Explore SEARCH (driven through the real render) | same head, same row count, **0 duplicate rows** — see below, this one was BROKEN |
| `displayName` / `_ambig` | 1467/1467 identical |
| `deckKeyFor`, `nodeForKey`, `deckMastery`, `gameScore` | identical; a partner mints **no** deck (1467/1467 same key as its rep) |
| `systemNodeIdxs` | 47 systems, **1711/1711 members resolve, all to reps**, lit sets identical |
| `_lessonIndex` / `_lessonNodeIdx` / `_curriculumIdxSet` | 174 lessons, 0 unresolved, 167 fog nodes identical |
| `startPosTraffic` | 136 entries summing to 1, weight-for-weight identical, **0 non-rep keys** |
| `weakSpots`, `bucketTechniques`, `_frontierBeltId` | 1456 / {30,0,0} / white — identical |
| `resultPos` over every dealt option | **1326/1326** resolve to the same hub |
| `resolveOutcomeTo` over every authored outcome | 4160 total, 3863 hit — identical, including the misses |

- **THE `ev` JOIN IS THE ONE THAT FAILS SILENTLY, AND THAT IS WHY IT IS `@curated`.** Nothing in
  the format is self-describing: the map key is `<position node index>/<role>` and `blk[0]` is a
  list of TECHNIQUE node indexes. A wrong remap still finds rows, still prints integers on every
  card, and prints the WRONG technique's number on each — no exception, no warning, no blank. So
  the assertion compares the whole structure card-for-card rather than counting non-nulls, and it
  asserts **>1200 cards carry a real mark** so it cannot pass on a build where `_ev` came back
  empty on BOTH sides and every comparison was trivially equal. Mutants: `blk[0]` not remapped
  (**killed**), remapped to the DEFENDER member instead of the attacker (**killed**), `ev` filed
  only on the rep (**killed, 2 journeys**).
- **A HAND MUST NOT DEPEND ON WHICH ORB YOU STAND ON**, and it does not: **272/272** role-hands are
  identical dealt from the rep and from the partner, cards, rows and marks. That is what link kind
  2 (site adjacency) buys, and deleting it kills the journey.
- **The ordinal mutant is the shape of the whole risk.** Making the partner carry `h.o` too does
  NOT break an already-posted code — `_ordToId` is first-wins and the rep is at `2i`, so it still
  wins — it corrupts the *other* direction, `_ordById`, i.e. every code minted from then on. The
  gate has to check the direction that would rot, not the one a user would notice first.

**EXPLORE'S SEARCH IS A SECOND WALK, AND IT INHERITED NOTHING.** `buildExplorer` filters `rep`;
the query branch walks `this.nodes` DIRECTLY — deliberately, because a query renders flat ranked
results before any section exists (v1.99.3) — so it never had that filter. Both halves carry the
same title, so **every hit was doubled with nothing to tell the duplicates apart**, and the
`.slice(0, 120)` cap then HALVED how many distinct techniques a search could ever reach: "guard"
matches 320 sites and could only ever show 60 of them. Fixed with the same one-word filter and the
same reasoning as `buildExplorer`.
> **AND THE FIRST PASS OF THIS AUDIT MISSED IT**, because the probe measured
> `nodes.filter(n => n.rep && …)` — a private copy of the filter, with the fix already in it, so it
> reported "identical" about a path that was broken. The gate now drives `renderExplorer()` for
> real and counts `[data-list-add]` rows and duplicate row TEXT. **Never assert a render by
> re-implementing it**; that is the same defect class as the six specs that held private copies of
> the node set in v1.125.0, committed by the tool built to find them.

**THE AUDIT'S WORST FIND: A CLASS CAPTURED FROM THE LOWER HALF WAS UNSHAREABLE, SILENTLY.** Lists
are STORED as node ids and SHARED as ordinals, and **only a hub carries an ordinal** — the rep IS
the hub, the partner mints `<hub>/Bottom` / `<hub>/Defender` with `o: null`, **0 of 1467**. So a `+`
pressed while standing on the lower orb filed an id `ngListEncodeIds` reports as `missing`: the
technique is **dropped from the share code with no error**, and a one-item list of it encodes to the
**empty string**. Not an edge case — **136 of the 272 position landings and 172 of 400 technique
seats stand on a partner**, i.e. every time the coach is playing bottom, which is half of
jiu-jitsu. This shipped in v1.125.0 (a graph tap on a lower orb, or `/Positions/X/Bottom`, already
seated you there) and this change makes it *more* reachable, since `seatRole` now deliberately
seats bottom-authored techniques on the lower half.
- **`siteIdOf(nodeId)` normalises in the LIST LAYER, not at the capture button** — `addToList`,
  `removeFromList`, `removeListItem`, `activeListHas`, `nodeInAnyList`, `listsWith`,
  `listItemName`, `openListPicker`. That is deliberate: it is the layer's own invariant (*a list
  holds SITES*), so a surface added later cannot bypass it by calling `addToList` directly. The
  membership readers matter as much as the writer — normalising only the write makes a captured
  technique show a `+` instead of a `✓` on the very orb you captured it from (mutant, killed).
- Identity on every unpaired node, so `?dual=legacy` is untouched, and **no shipped build has ever
  been able to store a member id** — nothing to migrate.

**TWO MORE REAL DEFECTS, AND THE BIGGER ONE WAS PRE-EXISTING.** Both were in the same question —
*where does a technique start?* — answered in three places, three ways. `techniqueOrigin(n,
perspective)` is now the ONE seam; see its note.
1. **`rollFromPosition` walked `adj[]` for the first position it met, which is a coin toss with
   3-5 sides.** A technique is adjacent to its origin AND to everywhere its outcomes land, in link
   order. **Measured over all 1,331 techniques, on the paired graph AND on `?dual=legacy` alike:
   the walk disagrees with the canonical origin on 907, and the technique you just tapped is not
   even in the hand you are dealt 910 times — 68.4%.** Tapping `Head Extraction to Posture` stood
   you in Closed Guard; it is authored from Gogoplata Control. `confirmPlayFrom` had it right all
   along (`posNodeForId(fromPositionId)`), so this is the v1.104.5 "second stale implementation"
   defect one level down. **Now 1326/1331 = 99.6%**; the 5 that still miss are content
   (`from_position_role_mismatch`), not code.
2. **...and the split made that walk worse in a way only the pair can produce.** A technique's
   DEFENDER member carries only the pair tie — its real edges are all one-for-one on the attacker,
   by design — so the walk found **no position at all** and `posIdx` fell back to the technique
   itself: **1,331 of 2,934 nodes staged a roll ON A TECHNIQUE NODE**, whose "hand" is its own
   partner. One graph tap away, on the app's centrepiece. Now **2662/2662 technique members seat at
   a position**, on the side that performs it (`fromRole`, 100% covered — 735 top / 596 bottom).
   `seatRole` is why: 596 techniques are bottom-authored and the title-derive answers "top" for all
   136 positions, so without it the tap deals the hand the technique is not in. It draws no RNG.
3. **A TECHNIQUE'S TWO PERSPECTIVE PAGES ARE REAL BUILT PAGES, AND ONLY HALF OF EACH PAIR LANDED
   ANYWHERE.** `/Transitions/X/Attacker` resolved to **nothing** (the attacker member IS the hub and
   carries the bare id, so it matched no id and no regex) while `/Transitions/X/Defender` resolved —
   and seeded the **ATTACKER's** side, **1330 of 1330**: the page says you are the one being
   armbarred and the app dealt you the armbar. `_nodeAndRoleForPath` now accepts
   `top|bottom|attacker|defender` as the hub+side spelling and routes techniques through
   `techniqueOrigin`, so a typed address and a tapped orb cannot disagree. **1330/1330 and
   1330/1330**, both naming the same origin site.

> **The bare `/Positions/X` role changed from `null` to `"top"` and NOTHING moved** — checked, not
> assumed. All 136 position hub titles end "… Top", so `rollFromPosition`'s title-derive already
> answered `top` for every one of them; the member simply states now what the title used to imply.

**TWO MORE `adj`-WALKS EXIST AND ARE DELIBERATELY LEFT ALONE.** `resultPos(actIdx, fromIdx)` walks
for "where does this land you", which is a genuinely different question from "where does it start"
and is answered correctly by adjacency — proven, not assumed: **1326/1326 dealt options resolve to
the same hub on both graphs**. `jumpToState` walks for the origin exactly as `rollFromPosition`
used to, but it lives inside `renderDossier`, which v1.101.5 disclosed as unreachable from the app;
on a technique defender member it now returns `-1` and the function no-ops, which is a safe
degradation rather than a wrong seat. Recorded so the next reader does not have to re-derive it.
`scripts/triple_replay.sh` is **byte-identical at `0390cc44ee7f40e5`** — the same digest v1.125.0
recorded — so none of this moves an RNG draw or a scripted roll.

**A FLAKE WAS SEEN AND CHASED, NOT WAVED AWAY.** `history-replay`'s phone journey ("closing the
drawer is how you watch") failed twice during this pass — once inside a full core run, once in an
isolated run — and both times the machine was rebuilding a bundle in the background. Measured
rather than assumed: **2 failures in ~204 runs on this branch, 0 in 108 on HEAD's bundle** (six
`--repeat-each 3` batches each way). Fisher exact **p ≈ 0.55** — the data does not support "this
change introduced it", and the mechanism agrees: a film's beats step on the REAL frame delta
(`updateTravel(this._replay ? dt : gdt)`, v1.106.5), so a loaded machine drops frames and the film
can outrun the assertion. Nothing on that journey's path — `archivedRoll` calls
`rollFromPosition(a.currentPos)`, always a POSITION — touches `techniqueOrigin`, `siteIdOf` or the
search filter. **Recorded as a wall-clock-sensitive pre-existing flake, NOT as fixed.**

**KNOWN, NOT FIXED (pre-existing, identical on both graphs).** `_nodeAndRoleForPath` calls
`decodeURIComponent`, which THROWS on a stray `%` — `Transitions/100%-Sweep` is the only id that can
produce one, and the `popstate` listener's `try` wraps the `addEventListener` call rather than the
handler body. A browser percent-encodes `location.pathname`, so this needs a hand-typed URL to
reach; it is recorded rather than chased.

**WHAT IT COST.** The retirement paid for most of the fixes. Bundle **462,282 → 462,613 raw**
(+331) and **136,608 → 136,733 gzip -9** (+125) against v1.125.0 — the deletion was −561/−144, and
the four fixes plus `siteIdOf` and the audit's own reasoning were +892/+269. Browser-measured
bytes-to-first-hand: **380,343 → 380,403 gzip (+60)**, leaving **4,597 B** of headroom under the
385,000 ceiling. Payload gate: neural eager **301,751 / 330,000** gzip, **1,415,570 / 1,600,000**
raw.

<a id="v1-126-0-gates-at-v1-126-0"></a>

## v1.126.0 — GATES AT v1.126.0

> **Status:** Current - `?dual=iso|fixed|force` are accepted-and-ignored; the prototype payloads are gone from the build and every gate.

_Originally CLAUDE.md L1248._

**GATES AT v1.126.0.** Core suite **384 passed / 0 failed / 4 skipped** (11.7m); `test:units`
**75/75**; `e2e:share` **22/22**; `e2e:replay` **6/6**; `triple_replay` 3× byte-identical at
**`0390cc44ee7f40e5`**; `e2e:gen` at exactly its known **13-red** baseline, same 13 names;
ordinals, graph (Errors 0), headers, SEO parity, affiliate and payload all OK; `source` `tsc` clean
with only the two long-standing prettier warnings (`contentPage.tsx`, `path.ts`).

<a id="v1-128-0-merge-and-split-the-two-phases-and-the-l"></a>

## v1.128.0 — MERGE AND SPLIT — the two phases, and the label group belongs to BOTH

_Originally CLAUDE.md L1254._

### MERGE AND SPLIT — the two phases, and the label group belongs to BOTH (v1.128.0)

**THE VOCABULARY, because the owner asked for it and the code had already half-coined it.** The
constants at `app.src.jsx:11978` read `MERGE 1.15, SPLIT 2.20` — px per world unit — and `kLOD` is
the smoothstep between them. So:

| phase | what you see | the number |
|---|---|---|
| **merged** (a **site**) | one orb on the shared ground point; no role distinction — the familiar 1467-node map | `kLOD == 0` |
| **mitosis** | one orb shrinking while two grow out of it; continuous, no pop, no crossfade | `0 < kLOD < 1` |
| **split** (a **pair**) | two orbs, the two sides of one state | `kLOD == 1` |

`rep` is the member that speaks for a merged site (it wears `rSite` and owns the hub id); `members`
/ `halves` are the two sides. Use these words — they are already the variable names, so a comment, a
spec name and a conversation all point at the same thing. `this._lodK` is the live value, stamped
every frame.

<a id="v1-114-3-the-label-group-is-the-rule-now-not-the"></a>

## v1.114.3 — THE LABEL GROUP IS THE RULE NOW, NOT THE FOCUS'S PRIVILEGE

> **Status:** Extended by v1.128.0 - the label group is the rule for every pair, not the focus's privilege.

_Originally CLAUDE.md L1271._

**THE LABEL GROUP IS THE RULE NOW, NOT THE FOCUS'S PRIVILEGE.** v1.114.3 gave the pair you are
STANDING IN one dynamic group — name on the midline, role above or below depending on which half
you point at. Every other pair fell through to the single-node hover label, which prints
`splitName(n.t).main`; a POSITION title carries no "from", so that returned the whole authored
string **with the role baked into it**. Owner, hovering Front Headlock: *"it shows 'Front Headlock
Top' when I hover over the top and 'Front Headlock Bottom' when I hover over the bottom … instead of
showing a single label in the middle of the top and bottom nodes. I want this behavior to also be
true … for other nodes besides the current node."* Two different answers to one question on one
graph — and the same "printed twice" defect the in-node pass was deleted for in v1.114.0, arriving
by a different door. `pairGroup(n, act, focused)` is now one local renderer called for the focus and
for whatever pair the cursor is over; the single-label path yields whenever it drew
(`_hovPairDrawn`), and a non-focus group reads one step back (15px at 0.86 alpha vs the focus's
18px at full) so the state you are IN still outranks the one you are pointing at.

**THE GATE IS `kLOD`, AND A PIXEL THRESHOLD WOULD HAVE BEEN WRONG — MEASURED.** Owner: *"that's not
needed. That's only needed when we are zoomed in."* Which is not a preference: merged, the two
members are coincident, so "above" and "below" name the same orb. The first draft gated on measured
screen separation at 44px and **fired for nothing**: the lift is anchored to each node's OWN radius,
so at ONE zoom the focused pair separates **75px** (33px radius) while an ordinary pair separates
**34.7px median / 42.3px p90** (14px radius) — a 2.2x spread across the same frame. Any constant
tuned on the state you stand in excludes every other pair on the screen, which is precisely the case
being asked about. `kLOD` is the honest signal because it is the same number that decides whether
there are two orbs to point at at all.

**Pinned by `e2e/journeys/dual-pair.spec.ts`** (5 journeys, 3 `@curated`). Three mutants, three
kills: group restricted to the focus (the original bug) → journey 4; `kLOD` gate deleted → journey
5; name anchored to the hovered orb instead of the midline → journeys 1 **and** 4.
- **The canvas oracle had to be re-derived twice, and both failures are instructive.** (1) A strip
  centred on the hovered orb reads the GROUP'S OWN SUBTITLE at an ordinary 34.7px separation — the
  bands are 18-20px tall, so they overlap. The band ABOVE the upper orb is the one place the two
  behaviours never overlap at any separation, and it is exactly where the old label drew (`sy - 8`).
  (2) At merge scale "nothing is drawn" is FALSE and fails for the right reason on a correct build:
  the ordinary label takes the hover back. The midline is what separates them, as a RATIO — the
  single label's descenders bleed a few dozen px into it (measured 48 against 663).
- **`page.mouse.wheel` must be aimed at clear canvas.** At `W/2, H/2` it lands on the landing card
  (top edge y=366 on this URL) and `kLOD` stays at exactly 1 — the merge journey fails on its own
  setup rather than its subject. Writing `cam.vw` directly does not work either: a staged board
  re-aims every frame, and a direct write moved the frame by 0.00006 of the graph width and snapped
  back. The wheel is also the seam that releases the camera lease and `_stagedCamFree` (`:11946`),
  which is why it is the gesture that works.
- The candidate pair is sorted by separation **then by index**: a tie decided by array order picks a
  different pair per run, and every threshold is a function of which pair got picked.

<a id="v1-128-1-three-things-the-owner-saw-in-one-sittin"></a>

## v1.128.1 — THREE THINGS THE OWNER SAW IN ONE SITTING

_Originally CLAUDE.md L1314._

### THREE THINGS THE OWNER SAW IN ONE SITTING (v1.128.1)

**1. "DECIDE 1…" GOT STUCK OVER A BOARD THAT WAS NO LONGER COUNTING.** Owner: *"when i click
another node amid a 'Decide 3/2/1' the Decide number ... gets stuck there, even tho i navigated to
another node and the time bars are now back full at 100% and the game is correctly paused."* Root
cause is a guard doing more than it says: `enterLand` DOES drop a stale announcer, but only
`if (!first)`, and clicking a node stages a fresh board whose landing IS a roll's opening state —
so it passes `first` and skipped the clear. Flipping that guard would wipe legitimate arrival copy,
so the countdown sentence now **owns its own lifetime**: `_tickDecision` stamps `_evCountdown = d`
when it writes the line, **every other `setEvent` releases the stamp**, and `clearOptions` drops the
line only if the stamp is still standing when the hand is torn down. The announcer has ONE slot, so
whoever wrote it owns it — that is the whole mechanism.
> **DISCLOSED, PRE-EXISTING, NOT FIXED: "Time's up" never reaches the screen.** `_tickDecision`
> writes it and calls `pick(chosen)` on the very next line, which runs `enterAttempt` →
> `setEvent("You go for", …)` SYNCHRONOUSLY. Measured on HEAD's bundle as well as this one, the
> visible sequence is `Decide → You go for → Failed → Opponent goes for`, with no "Time's up" on
> either build. The one message that explains why the position moved without the player choosing is
> dead copy. Left alone because fixing it is a gameplay-copy change nobody asked for.

**2. THE PHONE FRAMES THE ORB *AND* ITS NAME.** Owner: *"i think the position in mobile should
center not to the node but to the label of the node(s)."* The name hangs to the RIGHT of the orb, so
parking the ORB at 44% of the width (the v1.101.1 reading bias) puts the thing you read off-centre —
measured at 390x844 on Side Control, the orb sat at 171.6 while the orb+label block ran 158..300,
centred at **229, i.e. 59% of the width**. And it is not only composition: at that framing the label
starts at orb + 44px leaving **174px** of screen, while the POSITION names the focus wears run to
**242px**, so **18 of 136 ran off the right edge**. `rollCamTarget` now solves
`nodeX = W/2 − (11 + labelW)/2` on `isMobile()`, which seats every one of the 136 — the widest
("Straight Ankle Lock Control") spans 65..326 of 390. **Desktop is untouched at 0.440**, because
there is room either way and the reading bias is deliberate.
- `_labelWidthPx(n, paired)` measures with the font the graph draws with, on a SCRATCH context —
  `this.ctx` is mid-frame during a draw and its `font` is state — and caches per node + size,
  because the follow-cam calls `rollCamTarget` every frame.
- **KNOWN, NOT FIXED, and framing cannot fix it:** the same measurement says TECHNIQUE labels reach
  **388px (transitions) and 444px (submissions)** — wider than a 390px phone — so 712 of 1034
  transitions and 256 of 297 submissions overflow when hovered on a phone at any offset. That needs
  truncation or wrapping, which is a design decision, not a camera one.

**3. THE GRAPH NEVER BAKES A ROLE INTO A NAME.** Owner: *"when i'm zoomed out i often see 'Turtle
Top' instead of 'Turtle' (roleless in the further zoomed out state)."* Every position hub is TITLED
"… Top" in `graph-data.json` — a rendering artifact of the visual collapse, not a claim about the
side (v1.82.3) — and `splitName().main` only strips a `from <position>` tail, which a position title
does not have. **Measured: 136 of 136 position titles carry a role.** The focus label already used
`posFamily`; three other canvas label paths did not (the fading recent-node labels, the active-move
label during travel, and the hover label), so at MERGE scale — where there is one orb, it is neither
side, and the role deliberately is not drawn — the name printed the role anyway. `graphName(n)` is
now the single rule for all four, and **136 of 136 are roleless**.

**Gated by `announcer-coherence.spec.ts` (+2), `dual-pair.spec.ts` (+2) and `graph-naming.spec.ts`
(+1). Four mutants, four kills** — including M4, the tempting half-fix that centres the ORB on a
phone rather than the orb+label block (it leaves the block centred at 253 of a wanted 195).
> **A MUTANT FOUND A MISSING TEST, WHICH IS THE POINT OF RUNNING THEM.** The first pass killed the
> countdown and the roleless-name mutants and **M2 survived** — because the mobile framing had been
> PROBED and never pinned by a journey. A probe is evidence for a commit message; only a spec is a
> gate.
> **And the pixel oracle had to be narrowed:** a first attempt swept 340px right of the orb and read
> 238 bright px against a 114px name, because at merge scale the whole graph is on screen and that
> strip was full of OTHER nodes' labels. The oracle is now the ~27px window where " Top" *would*
> land, on a node filtered to be isolated in its own label band, with a self-check that the name
> itself is on screen (or an empty window would pass against a build that draws no label at all).

> **THREE ASSERTIONS IN THIS COMMIT WERE STRICTER THAN THEIR OWN CLAIM, and each one went red on a
> CORRECT build.** They are worth naming together because they are one mistake wearing three hats —
> pinning an incidental fact instead of the thing that was asked for.
> · *"nothing is drawn above the name"* (the pair group's subtitle) — the 18px name's own ascenders
>   reach into that band, and how far depends on which pair the candidate filter picked; it read 93
>   against a limit of 63 in a full-suite run. The claim is **"the subtitle moved and the name did
>   not"**, which is a DIFFERENTIAL across the two hover states, where the name's constant
>   contribution cancels.
> · *"nothing is drawn at merge scale"* — false on a correct build, because the ordinary single
>   label takes the hover back. The midline is what separates them.
> · *"the announcer is blank after staging"* — also false on a correct build, because the staged
>   landing may legitimately say something else. The claim is **"the stuck countdown is not what you
>   are looking at"**, so the test reads the KICKER, not just the opacity.
> Each relaxation was re-checked against its mutant afterwards (3/3 kills on the announcer one), so
> "less strict" did not become "less able to fail".

<a id="v1-129-0-hesitation-costs-the-initiative-and-a-na"></a>

## v1.129.0 — HESITATION COSTS THE INITIATIVE, AND A NAME IS TWO LINES

_Originally CLAUDE.md L1390._

### HESITATION COSTS THE INITIATIVE, AND A NAME IS TWO LINES (v1.129.0)

**1. THE CLOCK RUNNING OUT IS A GAMEPLAY EVENT NOW, NOT A COPY BUG.** The v1.128.1 disclosure —
"Time's up" never reaches the screen — sat on top of a design problem, and the owner asked for the
gameplay answer: *"the best way possible that is rich gameplay (this is a great opportunity to
improve gameplay - let's gooo!)"*.
- **What expiry USED to do**: a weighted draw over YOUR OWN options, `w = max(0.12, 0.5 + dom)` —
  biased toward your DOMINANT moves. So freezing was **rewarded** with a decent move, chosen for
  you, and the sentence explaining it was overwritten synchronously by `enterAttempt`'s "You go
  for" before a frame rendered. The player watched their own hand play itself, well, unexplained.
- **What it does now**: **you froze, so they move first.** `opponentDefend()` takes the exchange.
  This is the same currency the rest of the engine is priced in — the asymmetric-initiative rule
  behind EDGE says a success returns the turn to you and a miss hands it over, so hesitation
  costing you the turn is consistent rather than novel.
- **IT CANNOT SPIRAL, BY CONSTRUCTION, which is why it is safe to ship.** `opponentDefend` always
  ends in `enterLand(false)` (or `enterDefense`, or `endRound`), so **the opponent never keeps
  initiative**. You freeze, they take ONE exchange, the board comes back. A player who never
  presses anything is not locked out of the game — they are losing it, correctly.
- **`HESITATE_HOLD = 1.1s` is load-bearing, not polish.** The announcer has ONE slot and
  `opponentDefend` writes into it, so handing over immediately would reproduce the exact defect
  this replaces. The hold is what turns two labels into a cause and its effect. Observed order:
  `Decide 3… → "You hesitated — they move first" → Opponent goes for Buggy Choke → Defend!`
- **Order inside the branch is load-bearing too**: `clearOptions()` runs BEFORE the sentence,
  because it drops the orphaned "Decide 1…" through the v1.128.1 ownership stamp — after it, it
  would take the new sentence with it.
- **The momentum break moved with the turn.** `enterAttempt` used to do it ("auto-pick counts as
  ignoring"); the turn no longer goes through it, so `land_q_ignored` + `_breakCombo("ignored")`
  fire here, beat first because `_breakCombo` clears `_landPending`.
- **`auto_pick` is RETIRED and `hesitated` replaces it**, catalog entry included (canon: adding a
  mapped `fx()` beat means adding a cue, retiring one means deleting it). It was never challenge
  evidence — checked, not assumed. **`e2e/gen/ready-test-expiry-autopick-burns-move.spec.ts` is one
  of the known-13 reds and asserts on `auto_pick`; it stays red, now for a different reason.**

**2. A QUALIFIED NAME IS TWO LINES, AND THE BREAK IS SEMANTIC.** Owner, on technique labels running
off a phone: *"probably a great idea to do wrapping in that case"*. `splitName` already separates
"Rear Naked Choke" from "from Seat Belt Control Back", and `setEvent`, every Explore row and every
list surface already render that pair as **bold over dimmer**. Putting the graph label on the same
idiom halves the widest line AND stops the canvas being a second naming system.
- **Measured at the hover label's 13px, whole corpus:** widest SUBMISSION **330px → 165px** (295 of
  297 carry a qualifier). Transitions keep a 275px worst case because **681 of 1034 have no "from"
  at all** — those are handled by `_fitText`, which ellipsizes to the room actually available
  instead of running off screen.
- In the pair group the main name stays pinned to the midline ("the name never moves" is the whole
  point of the group) and the qualifier hangs beneath it, which pushes the BOTTOM role subtitle
  down one line so the two can never overlap.

**3. THE ORB NEVER HUGS THE EDGE.** Owner: *"we want the node to be on the left of the centered
label BUT not so close to the edge (at least like 50px…)"*. `NG_LABEL_LEFT_MIN = 50` is a floor on
the drawn SILHOUETTE, not the centre, so a big focus orb is held off by the same visible margin as a
small one. Measured on the widest position name: at **320px** pure centring wants the orb edge at 30
and the clamp holds it at exactly **50** (label still ends at 309 of 320); at **360** it binds at
exactly 50; at **390** it does NOT bind (64) and pure centring wins. A floor that engages only when
needed.

**THE RENDERER PUBLISHES WHAT IT DREW, AND THAT IS WHY THE LAST MUTANT DIED.** `_lastPairLabel =
{idx, ox, sy, main, qual, focused}` is stamped by `pairGroup` — the `this._LY = LY` pattern.
> **THREE PIXEL ORACLES IN A ROW FAILED TO KILL "print the inline long name", and the reason
> generalises.** The group's `ox` comes from `halfW`, a **draw-local closure**, so every spec-side
> attempt to recompute it put the measurement window over the name's BODY instead of its TAIL — and
> a window full of body text reads the same on both builds. A control frame did not save it either,
> because the PARTNER orb's own label lands inside the same band (measured: baseline 154 in a
> 144..160 window, ~266 bright px either way). Reading the strings the frame passed to `fillText`
> is **not** re-implementing the render — it IS the render's output, and it is the only honest
> oracle when the geometry lives in a closure. Pixels still prove the qualifier line is *rendered*;
> the published strings prove *which name* is on it.

**Gated by** `announcer-coherence.spec.ts` (+2, 1 `@curated`), `dual-pair.spec.ts` (+1 `@curated`),
`graph-naming.spec.ts` (+1 `@curated`). **Five mutants, five kills**: hand over with no hold; the
old beat name; the clamp removed; no qualifier line; the group printing the inline long name.

**WHAT IT COST, MEASURED RATHER THAN ESTIMATED.** Core **398 passed / 0 failed / 4 skipped**;
`test:units` 75/75; payload OK (neural eager **302,482 / 330,000** gzip). Bundle vs v1.128.1:
**+1,041 raw / +383 gzip**.
- **`e2e:gen` moves 13 red → 14, and the +1 is honest**: `mid-timeout-question-costs-no-odds`
  asserts `expiry_warning → auto_pick → commit`, an ordering that describes the retired mechanic.
  Three MORE gen specs assert `auto_pick` (`ready-test-expiry-autopick-burns-move`,
  `returner-decision-timer-expiry-narrated-on-comeback`,
  `onboard-first-freeze-drilling-refunds-then-clock-runs`) but were ALREADY in the known-13; they
  stay red, now for a different reason. **Any honest implementation of the owner's request breaks
  these four** — they assert "auto_pick precedes the commit it drives" and "the auto-picked
  exchange debits exactly 1 move", and under the new rule there is no auto-pick and no player
  commit. Rewriting them is a separate pass.
- **`holder-passive-boot-blob-fixpoint` also went red in that run and is NOT attributed here:** it
  passes **5/5 in isolation**, fails in **412ms** (long before any decision window can expire), and
  is a "zero app writes across two reloads" spec — the documented order-dependent class, same shape
  as `corrupt-blob-settings-persist-cleanly-after-heal` (green alone, red at #7 of 112). Recorded
  as a pre-existing load-sensitive flake, **not** as fixed and not as caused.

> **A TRUNCATED GREP IS HOW YOU MISS A CONSUMER.** The blast radius was first measured with
> `grep -rn auto_pick … | head`, which showed the sound catalog, the app and ONE gen spec — so the
> retirement looked cheap. The real list is **7 gen specs + 2 core specs**, and the core one
> (`jit-loop`'s "expiry narrates 3-2-1 and auto-picks with a pop") only surfaced when the full
> suite went red. Never pipe the survey that decides a rename through `head`.

<a id="v1-129-1-four-owner-reports-from-one-sitting"></a>

## v1.129.1 — FOUR OWNER REPORTS FROM ONE SITTING

_Originally CLAUDE.md L1484._

### FOUR OWNER REPORTS FROM ONE SITTING (v1.129.1)

**1. TAPPING A SUBMISSION OR TRANSITION MOVED YOU INSTEAD OF OPENING IT.** Owner: *"Can't seem to
be able to click any submissions or transitions in the graph. When I click it, it seems to always
go to an adjacent or nearby position."* The tap handler's own comment gave it away — *"tapping a
node ROAMS to it; tapping the one you're already on reads it instead"* — a **TWO-branch rule
written before v1.101.5 added a third**, and never updated. So every node that was not your own
went to `stageRollAt`, and `rollFromPosition` deliberately hops a technique to its ORIGIN POSITION
(`techniqueOrigin`, v1.126.0): correct for *play from here*, exactly wrong for *open this*.
Measured: tapping `Float Passing` from Side Control Top landed on `Open Guard Top`, card in `land`
mode — about a position the player never tapped. A technique now routes to `openDossier`, which has
carried the right three-way rule since v1.101.5. **A POSITION deliberately still calls
`stageRollAt` directly**: routing it through `openDossier` would also unfold the card and take a
`_dossierAutoPaused` latch on every roam, which is a different feature from the one being fixed.

**2. THE HAND COULD NOT BE DRAGGED.** Owner: *"Either dragging or horizontally scrolling is not
working."* Measured separately, because the two halves had different answers: **the WHEEL was
fine** (a vertical wheel moved `scrollLeft` 0 → 351, a horizontal one → 675 — v1.123.0's handler
working as written); **dragging had never worked**, 0 → 0 across a 600px press-and-drag, because no
browser drag-scrolls an `overflow-x: auto` element with a mouse. v1.123.0 built a drag for this and
reverted it — **correctly**, because that one was written for TOUCH, where the browser already
scrolls natively and its own mutants therefore could not kill its test. This one is **mouse-only**
(`pointerType === "mouse"`), leaving touch to the platform, which makes it both the broken case and
the testable one. **A DRAG IS NOT A PICK**: a capture-phase `click` suppressor fires when the
gesture moved >6px, because without it every drag ending over a card would COMMIT that move —
worse than not being able to scroll at all.

**3. THE FOCUS KICKER SAID THE CATEGORY BEFORE THE SIDE.** Owner, zoomed out: *"instead of saying
'top', it says 'position: top', and that position is irrelevant."* Right: SHAPE is the category
vocabulary (circle / triangle / diamond, v1.103.6), so the word beside the shape that means it is
the same "stated twice" defect the in-node pass was deleted for. The kicker is now the ROLE alone;
the category survives only where there is no role to name. Visible only at MERGE scale, where
`pairGroup` stands down (v1.128.0) and the focus falls through to `richLabel`.

**4. THE OPTION CARD NAMES THE MOVE'S KIND AGAIN — AND THIS REVERSES v1.118.0.** Owner: *"'edge'
doesn't give us any information saying that. I'd rather you say 'submission position transition' or
whatever."* Offered four card faces, they chose **category word, number bare** — the pre-v1.118.0
face.
> **WHAT IT GIVES UP, ON THE RECORD.** v1.118.0 introduced the `Edge` caption precisely because
> *an unlabelled signed integer is what makes a legitimate ranking read as a bug*, and in **98 of
> 272 hands the best-EDGE card is not the best-odds card**. That concern is real and is now
> re-opened on the card FACE; the number is still explained in the option-detail sheet, and the
> shape/colour channels are unchanged. **It is the owner's call. Do not silently reinstate "Edge".**

**THE RENDERER PUBLISHES WHAT IT DREW — NOW FOR BOTH CANVAS LABEL PATHS.** `_lastRichLabel` joins
`_lastPairLabel` (v1.129.0); both are cleared every frame so they answer "what did THIS frame
draw". The kicker fix had no other honest oracle: it is canvas text with no DOM to query, anchored
off `halfW`, a draw-local closure. **Mutation-measured: the kicker mutant SURVIVED the first
red-proof pass** because no journey covered it — the same "a probe is not a gate" lesson as
v1.128.1's mobile framing, two versions running.

**Gated by** `roll-card.spec.ts` (+2 `@curated`), `graph-naming.spec.ts` (+1 `@curated`), and
`option-edge.spec.ts`'s caption journey rewritten to assert the category **per card type**, so a
build printing one constant for everything still fails. **Five mutants, five kills.**

<a id="v1-129-6-the-opening-flight-aims-at-the-card-s-ba"></a>

## v1.129.6 — THE OPENING FLIGHT AIMS AT THE CARD'S BAND

_Originally CLAUDE.md L1539._

### THE OPENING FLIGHT AIMS AT THE CARD'S BAND (v1.129.6)

Owner: *"correct the position of the graph shift since it initially centers to the screen, not the
available space above the landcard as it's should in the first animation."*

On the FIRST landing there is nothing to measure — the card mounts about a second after the intro
hands the camera over, and `_bandBot` has no cached answer at this viewport yet — so
`rollCamTarget`'s cold fallback was the only input. **`H - 240` is not a band, it is very nearly the
whole screen.** Measured at H=900: `wantY` 338, the focus opening at screen y **413** against a
screen middle of 450, then crawling to its real home at **196** over about five seconds. That slow
correction is what reads as "it centres to the screen first".

**THE FIX IS NOT A NEW CONSTANT.** `H * 0.42` is the value the "no room" branch a few lines below
already uses, and it predicts this viewport's settled band almost exactly — `wantY` **197** against
a measured resting **196**. Erring tight is the safe direction by the same argument `_bandBot` rests
on (too tight only ever puts the node HIGHER, never behind the card), and a real card overrides it
the moment one exists.

**MEASURED A/B on the same start node**, sampling `camTarget.cy` across the whole opening flight:
aim drift **13.06 world units → 0.28**. The camera still flies — it should — but it now makes ONE
approach to a target that was right from the first frame, instead of chasing one that moves under
it. Pinned by `url-arrival.spec.ts` (`@curated`), one mutant, one kill.

<a id="v1-129-5-tapping-a-node-is-coming-back"></a>

## v1.129.5 — TAPPING A NODE IS COMING BACK

_Originally CLAUDE.md L1562._

### TAPPING A NODE IS COMING BACK (v1.129.5)

Owner: *"sometimes when i click techniques like Float Passing … nothing happens, no navigation, no
url change, no new dialog with MC or choices, nothing but the node lighting up below the cursor upon
click"*, and *"when i click some other positions like top front headlock, i see the choices row but
not the MC landcard dialog"*.

**TWO SYMPTOMS, ONE LATCH.** Tapping empty space runs `_standDown()` — `_bgDown = true`,
`_suppressTray(true)`, clock held — which is the deliberate background-tap behaviour. But
**`_bgRestore()` had exactly ONE caller**, `setPaused(false)`, so the only way back was the PLAY
BUTTON. Clicking a node then did all of its own work — the hand re-dealt, the card was built, the
camera flew — underneath a suppression that nobody lifted.

Measured, after a background tap: both a technique click and a position click leave
`bgDown true / traySup true / card visibility hidden`, while `optionIdxs` goes **10 → 25** on the
position. That is exactly "the choices row is there and the card is not" — and on a technique,
where there is no hand to re-deal, it is "nothing happens at all".

- **PRE-EXISTING, not from v1.129.1.** Neither `stageRollAt` nor `openDossier` ever called
  `_bgRestore`; the latch has been un-liftable-by-tap since the background-tap behaviour shipped.
  v1.129.1 only made it more visible, by giving a technique tap a card to fail to show.
- **`_bgRestore(keepCam)`** is the fix: a tap on a node is the user re-engaging, so it lifts the
  stand-down — but with `keepCam`, because the camera return to `_bgReturnIdx` would yank the view
  straight back off the node they just chose. The clock stays held, which is ROAM & STAGE's rule.
- **The latch audit worth remembering:** `_landHidden()` asks FOUR holders — `_landPaneHid`,
  `_traySup`, `_bgDown`, `_detailCtx`. Any one of them stuck leaves a built, mounted, correctly
  populated card invisible while every other surface behaves. When a report says "nothing happens
  but the node lights up", read the holders before reading the render path.

<a id="v1-129-4-the-role-word-the-block-s-alignment-and"></a>

## v1.129.4 — THE ROLE WORD, THE BLOCK'S ALIGNMENT, AND FOUR PATCH BUMPS

_Originally CLAUDE.md L1591._

### THE ROLE WORD, THE BLOCK'S ALIGNMENT, AND FOUR PATCH BUMPS (v1.129.4)

**1. THE ROLE WORD IS THE ONE ITS CATEGORY ACTUALLY USES.** Owner: *"wrt submission
escaping/finishing — implement escaping/finishing roles"*. A BJJ point, not a copy preference: you
do not *attempt* a submission you are already holding, you **FINISH** it, and the other half is not
"defending" in the positional sense, they are **ESCAPING**. A transition is the case where
attempting/defending is honest, because the move may simply not come off.

| category | upper half | lower half |
|---|---|---|
| positions | TOP | BOTTOM |
| submissions | **FINISHING** | **ESCAPING** |
| transitions | ATTEMPTING | DEFENDING |

**2. A TWO-ROW LABEL STRADDLES THE MIDLINE.** Owner: *"those from wtv position look poorly aligned.
rule is when those extra subtitles show, the label shouldnt be aligned at the center, but rather the
label and the 'from subtitle' rows should be centered to the middle of the dual nodes"*. v1.129.0
pinned the NAME to the midline and hung the qualifier under it, so the two-row object's centre sat a
half-line BELOW the pair it names. `lift = NG_LABEL_LEAD / 2` when a qualifier renders and **ZERO
when it does not**, so the one-row layout keeps the exact baselines it always had — that degeneracy
is the uniformity the owner asked for: ONE rule, not two layouts that drift. The role subtitle rides
the OUTSIDE of whatever the block turned out to be, so it can never land on the qualifier.
`NG_LABEL_LEAD` is shared with the single hover label, which draws the same two-row object.
> **THE ROLE LINE AND THE QUALIFIER LINE ARE DIFFERENT OBJECTS** and the spec asserts it: the
> qualifier DISAMBIGUATES a shared short name ("Kimura" is 35 techniques here) and always matches
> `/^from /`; the role says which side of the exchange you are pointing at and is one of six words.
> They sit on opposite sides of the name for that reason and must never be conflated.

**3. FOUR PATCH BUMPS CLOSE THE DEPENDABOT REPORT.** GitHub said "9 high"; the real shape is **4
advisories across 2 lockfiles** — `brace-expansion` 1.1.13→1.1.18 / 5.0.6→5.0.9 (root + source),
`immutable` 5.1.5→5.1.9, `js-yaml` 3.15.0→3.15.1 / 4.3.0→4.3.1. **All patch-level, lockfiles only —
no `package.json` changed**, so no API surface moved. **All are BUILD-TIME**: rimraf/glob,
sass/esbuild-sass-plugin, and gray-matter (which parses our own frontmatter during the static
build). **None ship in the client bundle**, so the live exposure was smaller than the headline
implied. `npm audit` now reports **0 vulnerabilities** in both workspaces. Verified past a lockfile
diff: `tsc` clean, a full `npm run build` green (6190 files, payload budget OK — sass is the one
that could have broken silently), and the core suite. The agent worktree lockfiles under
`.claude/worktrees/` are **untracked**, so they were never being scanned.

> **THREE SPECS WERE PINNED TO WHERE THE LABEL USED TO BE**, and all three went red on a correct
> build the moment the block moved: a control-frame band centred on the midline (`body 0 -> 21`
> against a `> 40` bar), a row pair at `mid + 6` / `mid + 21`, and a `_hover.idx` read that is
> legitimately null while the control frame parks the pointer on empty sky. All three now measure
> against the **published** `ox` / `nameY` / `qualY` — the same rule the v1.129.0 note already
> stated for `ox`, extended to the baselines now that a layout change has proved it applies to them
> too. A fourth trap worth recording: `_lastPairLabel` holds whichever group drew LAST in the
> frame, so re-hovering to re-read it returned the FOCUS's label (idx 145 where 1682 was expected).
> Capture it once, while the hover is live.

<a id="v1-129-3-the-hand-scrolls-smoothly-and-an-attempt"></a>

## v1.129.3 — THE HAND SCROLLS SMOOTHLY, AND AN ATTEMPT CARD CAN GO THERE

_Originally CLAUDE.md L1640._

### THE HAND SCROLLS SMOOTHLY, AND AN ATTEMPT CARD CAN GO THERE (v1.129.3)

**1. THE "STUTTERING SLIDING STEPS" WERE SCROLL-SNAP, AND IT EXPLAINED BOTH SYMPTOMS.** Owner: *"i
was hoping that the drag and drop and horizontal scrolling of options would be smooth not stutering
sliding steps"*, then *"horizontal scrolling doesnt seem to be supported either"*. One cause:
`scroll-snap-type: x proximity` on `.ng-optionrow` (in `xdc-template.html`) with
`scroll-snap-align: center` on every card. Every gesture was pulled to centre a card — so a scroll
moved in card-sized JUMPS, and a small horizontal swipe was snapped back to where it started, which
reads exactly as "not supported". Measured live before the fix: `scrollSnapType: "x"`,
`scrollSnapAlign: "center"`.
- The snap was a phone affordance from when the tray showed **2** cards. The hand reaches **34**
  since v1.123.0, and a reader wants to graze it, not page through it. Removed, with the
  `scroll-padding` that only existed to give the snap a resting inset.
- **What replaces it is motion the browser will not give a horizontally-overflowing element on its
  own.** `_trayGlideBy` eases a wheel notch to its destination (measured: **12 distinct
  intermediate frames**, 66 → 285, where before it was one 300px jump) and consecutive notches
  compound onto ONE target instead of stacking jumps. `_trayFling` carries momentum on drag
  release with a 0.94/frame decay. **The drag itself stays 1:1 under the finger** — easing what the
  hand is holding feels like lag, not smoothness.
- **ONE rAF OWNS `scrollLeft`.** `_trayStop()` is called by a new grab, by `tweenScroll` (the "see
  more" button) and by `clearOptions`, so a glide, a fling, a tween and a teardown can never fight
  over the same property.

**2. "WHY CAN'T I NAVIGATE TO OMOPLATA FROM DE LA RIVA?" — THE TWO REPORTS ARE ONE STORY.** Before
v1.129.1 a technique tap NAVIGATED, **by accident**: it fell through to `stageRollAt`, which hops a
technique to its origin position. The owner asked for that to stop (*"it seems to always go to an
adjacent or nearby position"*), it did — and what was left was a card that NAMES a technique with no
way to act on it. The old "Roll from here" button exists only inside `renderDossier`, which v1.101.5
disclosed as unreachable from the app. So the attempt card now carries `[data-land-play]`, routed
through `confirmPlayFrom` (it handles every node type — a technique seeds at its origin, the same
hop as before — and it CONFIRMS first, because starting a roll here discards the one you are in).
**The tap reads; the button goes.** Deliberately, on a control you can see.
> **AND THE CONTENT IS FINE, which is worth knowing before anyone files a data bug.**
> `Omoplata from De La Riva Guard` **is authored** (3% from `de-la-riva-guard/bottom`) and **is
> dealt** in that hand — measured. It is absent from `de-la-riva-guard/top`, correctly: from the top
> you are passing, not attacking. Arriving on the bare hub seats you **TOP**, so the node is visible
> on the graph and legitimately not in your hand. 55 position-roles author an omoplata; DLR top is
> not one of them.

<a id="v1-127-0-the-pair-journeys-come-home"></a>

## v1.127.0 — THE PAIR JOURNEYS COME HOME

_Originally CLAUDE.md L1679._

### THE PAIR JOURNEYS COME HOME (v1.127.0)

**A SPEC THAT NEEDS A GITIGNORED PAYLOAD IS NOT A GATE — IT IS A NOTE.** The three v1.114.x
journeys about the pair (the label group, the hit-test, the camera on a half-swap) lived in
`e2e/prototype/dual-pair-shoot.spec.ts` behind `?dual=iso`, a 2.47MB PRE-SPLIT file that could not
ship, a private port, a private serve-root and their own lock. **No gate has ever collected that
directory** — checked, not assumed: `prototype` appears nowhere in `.github/workflows/`, nowhere in
`package.json`, and in no config's `testDir` (only `playwright.{private,chrome}.config.ts` take one
from `PW_TESTDIR`, which is a hand-typed invocation). So they ran when somebody remembered, through
thirteen versions that included making their subject the DEFAULT (v1.125.0) and deleting the flag
they booted with (v1.126.0). They are now `e2e/journeys/dual-pair.spec.ts`, on the default build,
in `npm test`, 2 of the 3 `@curated`.

**THE MOVE RE-DERIVED THE ASSERTIONS; IT DID NOT RE-POINT THEM.** Three of them were describing the
prototype's shape rather than the app's:
- The prototype emitted `<hub>/Top` + `<hub>/Bottom`. The derivation keeps the **HUB ID on the rep**
  (that is what leaves `node_ordinals.json` alone and every `/l/<code>` resolving), so the halves are
  `Positions/Side-Control` and `…/Bottom` — a `/\/Top$/` match now fails on the node it describes.
- "Both halves above the videos" was measured against the film strip, and **there is no film strip
  under the harness** (the DSL serves `{}` for dossier chunks). It is measured against the LANDING
  CARD, which is the surface the film docks off and the one that is actually there.
- The 10-second wall-clock sleeps became `j.boot()` + the pumped clock, so the three journeys cost
  **3.9s** together instead of ~35s of real waiting.

**SIX MUTANTS, FOUR KILLS — AND THE TWO THAT DID NOT KILL ARE THE FINDING.** Every claim below was
measured by reverting the named line, rebuilding the bundle and watching the named test:
| mutant | result |
|---|---|
| `pairMid` → the active MEMBER in the label group | **KILL** — bright pixels on the midline **644 → 0** |
| `_updateHover`'s `ly(n)` → `n.y` (the pre-v1.114.3 hit-test) | **KILL, all three journeys** — the hit-test is upstream of the hover label and of the tap |
| drop `_stagedCamFree = false` from the pan handler | **KILL** — `free` stays true and the tracking yanks the camera back out from under the user |
| `rollFromPosition`'s `camFocus = pairMid` → the member's drawn point | **KILL** — worst swing **11.900** world units against a `< 1` bar |
| `stagedIdle`'s `_stagedCamFree` clause → `!userActiveNow()` (the pre-v1.114.4 gate) | **no kill** — see the v1.114.4 block; its observable is `url-arrival`'s re-aim, not a swap |
| remove the `_sameSubject` guard so the target is recomputed anyway | **no kill** — with `pairMid` intact the recomputed answer IS the same answer; the guard buys robustness against a mid-teardown layout, which no assertion here can see |

The two non-kills are written into the spec's own header rather than left as folklore: a journey
that names what it does not cover cannot be mistaken later for having covered it. A seventh mutant
is worth recording for a different reason: aiming "aim at the member" at `jumpToState`'s `camFocus`
(line 11796, the OTHER `pairMid` writer) changed nothing at all, which is the mutation-test
confirmation of what v1.101.5 disclosed by reading — `jumpToState` lives inside `renderDossier` and
is unreachable from the app. The tap path is `stageRollAt` → `rollFromPosition`.

**WHAT WAS LEFT BEHIND: THE SCREENSHOT SHOOT, AND IT IS NOT A JUDGEMENT CALL.** `dual pair shoot —
<variant> strategy, 3 zooms` drove `?dual=fixed | force | iso` to three PNGs each for the owner to
choose between. The choice was made; two of those three placements never existed outside a
gitignored file; all three URLs now boot the same graph — so it is three copies of one test whose
only output is a picture a gate cannot fail on, plus a `holdCam` helper that exists solely to fight
the follow-cam with a 40ms `setInterval`. Its sanity block is dead as well as redundant: measured on
this build it asserts `nodes === 2931` against **2934** and `pairMembers === 2928` against **2934**
(every node is paired now), and its `_idIndex.get("Positions/Mount") === mountTop` still passes only
by accident — the hub-id ALIAS pass it was written for went in v1.126.0; the rep simply IS the hub.
The invariant it reached for is pinned harder by `dual-consumers.spec.ts`, as a DIFFERENTIAL. The
committed evidence PNGs stay; `/dev/experiments` renders them and `build_forward_components` throws
without them.

**REPLAY-DIGEST MUST NOT MOVE HERE, AND THE REASON IS MEASURED RATHER THAN ASSUMED.** The expected
objection is that ingesting 2,934 nodes instead of 1,467 should shift the digest — but that
happened in v1.125.0, not here, and it did not shift then either. Rather than argue from the absence
of a change, the digest was computed on BOTH graphs from one build: `/` and `/?dual=legacy` both
produce **`0390cc44ee7f40e5`**, byte for byte. That is not blindness, it is the derivation's whole
claim stated behaviourally — the split is a MODEL change, not a game one — and it is the same fact
`dual-consumers` measures structurally (272/272 hands identical, order included). This stage adds no
app code at all, so any movement would have been the defect. **Not re-recorded.** (Worth knowing for
whoever leans on it next: this digest carries **23 beats and 0 land options** — Mount Top has no
unproven card under the harness — so the `landOpts` half of it is currently contributing nothing.)

<a id="v1-127-0-gates-at-v1-127-0"></a>

## v1.127.0 — GATES AT v1.127.0

_Originally CLAUDE.md L1745._

**GATES AT v1.127.0.** Core suite **387 passed / 0 failed / 4 skipped** (11.9m — v1.126.0's 384 plus
these three); `test:units` **75/75**; `triple_replay` 3× byte-identical at **`0390cc44ee7f40e5`**;
`e2e:gen` **88 passed / 13 failed** — exactly the known baseline; ordinals (1467 assigned, 1467
live), graph (**Errors 0**), headers, SEO parity, affiliate and payload (neural eager
**301,751 / 330,000** gzip, **1,415,570 / 1,600,000** raw) all OK; `source` `tsc` clean with only
the two long-standing prettier warnings. Browser-measured bytes-to-first-hand is **unchanged to the
byte** — 380,403 gzip / 1,680,045 raw, 20 requests — because this commit ships no app code; the only
diff `payload-first-hand` produced was its own `measured_at`, which was reverted rather than
committed, since a timestamp-only change in a zero-byte commit reads as a payload event that did
not happen.

> **THE 13-RED `e2e:gen` BASELINE, NAMED.** Four versions of gates blocks have said "the same 13
> names" without ever writing them down, which makes the phrase uncheckable. They are:
> `holder-restart-tutorial-resets-white-only` · `holder-reward-beats-carry-reward-voices` ·
> `legacy-v1-asks-landing-question` · `mid-lesson-goal-exact-boundary` ·
> `onboard-first-freeze-drilling-refunds-then-clock-runs` · `ready-checkpoint-pass-margin-exact` ·
> `ready-film-not-neglect` · `ready-lost-attempt-survives-reload` ·
> `ready-nogi-checkpoint-pool-excludes-gi-only` · `ready-test-catch-escape-keeps-test-alive` ·
> `ready-test-expiry-autopick-burns-move` ·
> `returner-decision-timer-expiry-narrated-on-comeback` ·
> `veteran-combo-challenges-exact-n-single-count`. Two of them (`ready-checkpoint-pass-margin-exact`,
> `ready-test-catch-escape-keeps-test-alive`) burn **4.0m each** on a Playwright timeout, which is
> most of that suite's 12.5m wall time.

<a id="v1-127-2-the-core-suite-had-a-1-in-13-flake-and-f"></a>

## v1.127.2 — THE CORE SUITE HAD A 1-IN-13 FLAKE AND FOUR GREEN RUNS HID IT

_Originally CLAUDE.md L1769._

**THE CORE SUITE HAD A 1-IN-13 FLAKE AND FOUR GREEN RUNS HID IT (v1.127.2).** `graph-naming`'s
*"the node a move LANDS on blooms harder than one the light passed through"* went red on a verification
run at HEAD — the first core failure in four full runs (v1.125.0, v1.126.0, v1.127.0 all reported
`0 failed`). **It is not an app defect and the app's own screen said so**: the failure snapshot's
announcer read *"Tapped · Crotch Ripper"*, i.e. the round had ENDED, and a round that ends produces no
second `land` beat for the journey to find.
- **The journey already knew the rule and applied it to one side only.** Its own comment —
  *"deliberately NOT a submission: a finish ends the round instead of landing"* — filters `ty !==
  "submissions"` out of MY pick, then says nothing about the OPPONENT'S. A missed transition hands
  the turn over (`enterFailCal` → `opponentDefend`), which draws **`rng("opp-finish")`** against a
  `pFinish` of up to 0.85 and submits you when it hits. `dsl.land()` rigs only `ai-skill`, `role`
  and `max-moves`, so that draw was a live `Math.random` — **the journey has been a coin toss on
  this branch in every version it has existed**, not something this arc introduced.
- **The fix makes the branch UNREACHABLE, which is a deductive claim, not a statistical one.**
  `j.rig("opp-finish", [0.99, …])` clears BOTH ceilings — the `Math.min(0.85, …)` cap and the
  `!trans.length` special case at 0.9 — so `rng("opp-finish") < pFinish` is false by construction and
  the opponent always takes the positional branch, which travels and lands. That is the state this
  journey is about.
- **Measured, matched-pair, back to back on one machine:** with the rig **0 failures / 30**; with the
  rig deleted (the mutant) **2 / 30**, and **6 / 78** across every un-rigged run of the session
  (1/15 + 3/30 + 2/30, plus the one that reddened the full suite) = **7.7%**. Fisher two-tailed on
  0/30 vs 6/78 is **p = 0.18** — *the statistics alone do not carry this*, and saying so is the point:
  the unreachability argument is the proof and the counts are corroboration. At 7.7% per run,
  P(four consecutive green full suites) ≈ 0.73, so the three earlier clean reports were never
  evidence of absence.
- **The lesson generalises past this spec:** a journey that leaves a gameplay `rng()` tag unrigged has
  not chosen a branch, it has bought a lottery ticket, and the ticket only prints when it loses. When a
  journey's subject is what happens AFTER an exchange, rig every draw that can end the exchange early.

<a id="v1-127-2-two-things-the-owner-shoot-found-both-pr"></a>

## v1.127.2 — TWO THINGS THE OWNER SHOOT FOUND, BOTH PRE-EXISTING, NEITHER FIXED

_Originally CLAUDE.md L1798._

**TWO THINGS THE OWNER SHOOT FOUND, BOTH PRE-EXISTING, NEITHER FIXED (v1.127.2).** The shoot is
`tests/artifacts/_owner_shoot.mjs` — six views at 1440x900 and 390x844, driven against the REAL dev
server with real wall-clock time, because a screenshot taken under the harness photographs the
harness (`{}` dossier chunks, no film strip), not the product.
- **ON A PHONE THE CHALLENGE CUE IS WRITTEN ACROSS THE NAME OF THE STATE YOU ARE STANDING IN.**
  Reproduce with `node tests/artifacts/_cue_collision_probe.mjs`. At **390x844** the cue is a
  full-width band at `[12,118 .. 378,168]` while `rollCamTarget`'s lift parks the focus pair at ~16%
  of viewport height — measured overlap **label 6,700 px² · partner orb 322 · focus orb 68**. At
  **1440x900 the overlap is 0** on both graphs; this is phone-only.
  **THE PAIR DID NOT CAUSE IT AND MADE IT BETTER**: on `?dual=legacy` the same probe reads label
  6,700 and orb **251**, and `elementFromPoint` at the orb's centre returns **BUTTON** — the cue is
  eating the tap on your own node. On the pair the top orb clears the band by 5px and that same read
  returns **CANVAS**. So the pair improved the hit-test and left the label collision exactly where it
  was. It is the third instance of the lesson `_dockLandCard` (v1.81.3) and `_dockOptionHint`
  (v1.123.0) already learned — **fixed chrome cannot be positioned by a constant against a camera
  band that is computed** — and the fix is the same shape: dock the cue off a measurement. Not done
  here; this commit ships no app code.
  · It also eats GESTURES, which is how the shoot tripped over it: a wheel aimed at a node inside
    that band left `cam.vw` at 130.5, unchanged. Any probe that aims at a graph coordinate must
    hit-test `elementFromPoint(...) === canvas` first, and the shoot now does.
- **`segBtn` MARKS THE SELECTED RUNG IN COLOUR AND NOWHERE ELSE.** Every segmented control in
  Settings — Gi/No-gi, the rolling-simulation row, and the v1.124.0 loss-aversion dial — paints the
  active choice with a filled background and a brighter border and sets **no `aria-pressed`, no
  `aria-checked`, no `role="radiogroup"`, no data flag**: measured, `ariaPressed: 0` on all three
  rungs while "Slightly cautious" is plainly selected. `loss-aversion.spec.ts:84` already works
  around it by regex-matching `rgba(74, 108, 255` on the inline background, which is why no gate
  reports it. A screen-reader user is told there are three buttons and not which one is on.
  Pre-existing, unrelated to this arc, and left for the owner because it is one shared helper and
  therefore one small change with a wide blast radius.

<a id="v1-114-3-a-dual-pair-is-one-state-with-two-halves"></a>

## v1.114.3 — A DUAL PAIR IS ONE STATE WITH TWO HALVES

> **Status:** Extended by v1.128.0 - the label group is the rule for every pair, not the focus's privilege.

_Originally CLAUDE.md L1828._

**A DUAL PAIR IS ONE STATE WITH TWO HALVES (v1.114.3, `?dual` prototype).** Owner: *"I like to
see both variants ... above the videos we should see the two circles ... the position should be
rather centered on the middle of the two icons, not the actual icon that's active, so that both
icons appear ... the main label stays positioned in the middle on the right, and the active role
appears above or below it ... it's not two labels, it's just one group of labels that's dynamic, in
which the subtitle's position seems to appear depending on where you are."*

**THE ROOT CAUSE OF ALL THREE DEFECTS WAS THE SAME: code reading `n.y` where the renderer draws at
`LY(n)`.** `LY` lifts each member off the pair's shared ground by `z * h * (1 - nodeK * kLOD)` —
~37px per member at roll zoom — so `n.y` is simply not where the orb is.
- **`pairMid(n)`** is the new seam: the DRAWN midpoint of the two members, or the node's own drawn
  point when it has no partner — so every production node (no `pairId`, no `z`) is unchanged *by
  construction*, not by a flag check. `camFocus` is now `pairMid`, so the camera holds the PAIR.
  Measured before, on `/Positions/Side-Control/Bottom?dual=iso`: the Top orb sat at screen **y=5**,
  effectively off the top edge, while the free band was 76..268. After: 99 and 173 around a
  midpoint of 136, both clear of the film strip at 268. `rollCamTarget`'s submission `labelOff`
  (which compensates for a triangle's low in-shape label) is skipped for a pair, since the name is
  drawn on the midline.
- **`this._LY = LY`** is published each frame so `pairMid` uses the exact lift the frame just drew
  with. ONE definition; the hot loop still calls the local.
- **THE TAP HANDLER WAS BROKEN, NOT JUST HOVER.** `_updateHover` compared against `n.y`, ~37px from
  the visible orb against a **28px** pick radius — and `attachInput`'s pointerup runs through that
  same function, so clicking a visible orb in `?dual` matched NOTHING and fell through to
  `_tapBackground()`. It now hit-tests `ly(n)`.
- **ONE LABEL GROUP, AND THE SUBTITLE'S SIDE IS THE SIGNAL.** The NAME never moves — it sits on the
  line equidistant between the orbs, which is what makes above/below mean anything — and the
  subtitle renders ABOVE for the top/attacker half, BELOW for the bottom/defender half. Hovering
  either orb moves the subtitle and nothing else; the per-node hover label is suppressed for a
  member of the focused pair, or the name would print twice (the v1.114.0 in-node problem, on
  hover). Copy is **TOP / BOTTOM** for positions and **ATTEMPTING / DEFENDING** for techniques —
  the owner's word, and deliberately not "ATTACKING", which is `activeMove.verb` naming YOUR
  POSTURE during travel (v1.104.1); those two must not start sharing vocabulary.
- Gated by **`e2e/journeys/dual-pair.spec.ts`** since v1.127.0 — in the CORE suite, on the default
  build, because the split is derived now and the prototype payload it used to need is gone. (It
  was `e2e/prototype/dual-pair-shoot.spec.ts` until then, which is why nothing here ran on a gate
  for thirteen versions.)

<a id="v1-114-4-the-framing-band-and-why-a-pair-swap-mov"></a>

## v1.114.4 — THE FRAMING BAND, AND WHY A PAIR SWAP MOVED THE CAMERA AT ALL

_Originally CLAUDE.md L1865._

**THE FRAMING BAND, AND WHY A PAIR SWAP MOVED THE CAMERA AT ALL (v1.114.4).** Owner: "when I'm in
Side Control bottom and click top, instead of the camera moving just a little, it moves a lot, even
hiding the current node behind the landcard dialog momentarily" — and, precisely: *"it seems to want
to center the node to the center of the screen initially instead of centering to the available
visible space (above the landcard)."* Two halves of a pair share a midpoint, so the correct amount
of camera movement is **none**. Three separate things moved it; the first is a PRODUCTION bug, not a
prototype one, because staging any state tears the card down the same way.
- **`rollFromPosition` still aimed at `{x: n.x, y: n.y}`** — the stored coordinates — on the line
  beside the `camFocus` assignment v1.114.3 fixed. Same defect, missed once. It aims at `camFocus`
  now, and a swap whose subject is unchanged **skips the retarget entirely** rather than recomputing
  the same answer from a layout that is mid-teardown.
- **`bot` fell back to `H - 240` while the card and film were gone** — the middle of the whole
  screen. Measured on a pair swap: wantY 136 → 338, and `rollFromPosition` writes camTarget inside
  exactly that window. `_bandBot` caches the last real measurement and covers the gap.
- **THE BAND FLICKERED FRAME TO FRAME.** The card and the film strip mount on DIFFERENT frames and a
  film box can measure zero mid-transition, so "first element with height wins" alternated: measured,
  the follow-cam flipped `camTarget.cy` between 4.44 (film seen, bot 256) and −0.36 (card only, bot
  363) repeatedly. The band now keeps the **tightest answer ever measured at this viewport height**,
  which is stable by construction and errs safely — too tight only ever puts the node HIGHER, never
  behind the card. Resetting it per landing was tried and is wrong: it hands the first post-reset
  frame (card without its film) straight back to the loose answer.
- **An UNDOCKED element is not a constraint.** `_dockLandFilm` positions the film strip after
  insertion, so for a frame its `rect.top` reads **0**; that made the band −12, tripped the "no room"
  fallback, and threw the camera. A surface leaving no band above it has not laid out yet — skip it.
- **`userActiveNow()` measures the GAME clock, and a staged board is paused**, so one click latched
  "the user is active" FOREVER and silently disabled v1.114.2's staged tracking. `_stagedCamFree` is
  the honest gate: a real pan, pinch or wheel clears it, so "never fight a user's camera" survives.
- Gated in the core suite twice over: `url-arrival.spec.ts` (the torn-down band) and, since
  v1.127.0, `dual-pair.spec.ts` (the swap holds the camera; a pan releases it). **Mutation-measured
  there: it is `camFocus = pairMid` that holds the camera, NOT the `_stagedCamFree` gate** — with
  the aim correct there is nothing for the tracking to correct on a same-subject swap, so restoring
  the `userActiveNow()` gate leaves both specs green. That gate's real observable is `url-arrival`'s
  re-aim once the card exists. Recorded so nobody reads `dual-pair` as covering it.

<a id="v1-104-5-the-stat-band-moved-to-the-pane-foot-and"></a>

## v1.104.5 — THE STAT BAND MOVED TO THE PANE FOOT, AND ITS WEAK-SPOT NUMBER WAS A LIE

_Originally CLAUDE.md L1899._

**THE STAT BAND MOVED TO THE PANE FOOT, AND ITS WEAK-SPOT NUMBER WAS A LIE (v1.104.5).**
- **Foot, not Explore's top** (owner: "I would prefer to be closer to the bottom"). It is its OWN element (`.ng-pane-stats`, `paneStatsRef`) ABOVE `.ng-pane-anchor`, never inside it — the anchor collapses entirely for a signed-in user and three progress numbers must not vanish with a save nudge. It rides every tab and hides during a study takeover.
- **Distributed, not clumped** (owner: it "still looks left aligned instead of neatly designed and distributed"). `display:flex;gap:14px` packed three stats against the left edge of a 360px pane and left the right third empty; it is now `grid-template-columns:repeat(3,1fr)` with the outer two hugging the edges.
- **"30+ weak spots" was the DAILY GOAL.** It printed `get("dailyGoal", 30) + "+"`, so it read "30+" for a player with 3 gaps and for one with 700 and never moved as they closed them. `weakSpots()` counts the real pool — `bucketTechniques("suggested")` BEFORE its `.slice(0, dailyGoal)` — and names the worst tier still in it, which the ranking already computes: rolled-through-but-never-drilled → **very weak**, never touched → **weak**, started-but-under-3-reps → **shaky**. Mastered also carries its percent now ("Mastered 3 (12%)").

<a id="v1-104-4-the-defence-question-is-asked-above-the"></a>

## v1.104.4 — THE DEFENCE QUESTION IS ASKED ABOVE THE HAND, NOT INSIDE IT

_Originally CLAUDE.md L1904._

**THE DEFENCE QUESTION IS ASKED ABOVE THE HAND, NOT INSIDE IT (v1.104.4).** Owner, on the panic drill: it "should show alike the ng-landcard, in fact it should be a ng-landcard i think. it should never be in the options row lol wtf". It was a **236px flex item inserted as the FIRST CHILD of the escape tray** — so the question you must read sat in the row of things you must choose between, shifted every escape card one slot right, and competed with them for the same glance under a 4-9s clock. Everywhere else in the app a question is asked ABOVE the hand; this was the one place it was asked inside it.
- **It is not merely styled like a landing card, it IS one.** The element goes in **`_landEl`** with `class="ng-landcard"` + `data-landcard="defense"`, so `_dockLandCard`, `_suppressLand` (pane and option sheet stand it down), `attachInput`'s pointer-capture early-return and `clearLandCard` all apply without a second copy of any of them. The danger skin is one CSS rule (`.ng-landcard[data-landcard="defense"]`); everything else is inherited. `clearLandCard()` is now called on BOTH defence exits (the tap and the escape), so it can never outlive its hand.
- **`_dockLandCard` now measures on DESKTOP too — but only moves the card if it would actually collide.** It was mobile-only because the desktop constant (`bottom:236px`) clears an ordinary tray; an ESCAPE tray is taller (its cards carry the extra "escape route" line) and measured at 1440x900 the card's bottom landed at **664 against a tray top of 657** — a 7px overlap on the one screen where you are under a 4-9s clock. With no overlap the CSS constant is left untouched, so nothing that looked right before can move.
- Grading still pumps every escape's odds (+6% `stateBonus`) and refunds 2s. Pinned by `e2e/journeys/panic-card.spec.ts` (3 journeys, 1 `@curated`) — placement, the odds/clock payoff driven by REAL mouse clicks, and teardown.

<a id="v1-104-3-the-option-card-s-glyph-and-its-n-measur"></a>

## v1.104.3 — THE OPTION CARD'S GLYPH AND ITS `+N` MEASURE DIFFERENT THINGS

> **Status:** Superseded by v1.118.0 - the card face became EDGE on both channels; `movePotential` survives only as the escape tray's corner value.

_Originally CLAUDE.md L1909._

**THE OPTION CARD'S GLYPH AND ITS `+N` MEASURE DIFFERENT THINGS (v1.104.3).** Owner: "how come this transition says +13 in blue ... but the icon which has the 4 as the shortkey seems gray reddish? how come that's possible?" **It is not a colour bug**, and the audit says so — 0 of 1203 option cards (all 136 positions × both roles) differ from the role-correct value, because `optionsFor` only ever deals moves YOU perform (the `fromRole` filter, v1.103.0), so you are always the attacker of your own hand and `s[0]` is always your slot there. What the two marks actually say:
- **the glyph** = the TECHNIQUE's own strength (`domColor(myVal(n))` — is this a strong move?)
- **the `+N`** = `movePotential` — the value of WHERE IT LANDS YOU. **(HISTORY. Neither mark says
  this any more: the option card's face is EDGE on both channels since v1.118.0, and
  `movePotential` survives only as the ESCAPE tray's corner value. Read the next three blocks as
  one arc — this is the problem, the deletion is the answer, and the model is what replaced it.)**

`Open Guard to Double Unders` scores `-0.113` for its attacker and arrives somewhere good: a mediocre technique into a strong position, which is a real and common shape. They share one palette and say so nowhere — a LABELLING gap, not a maths one. `buildOptionCard`/`expandOption` now read `myColor(n)` so the correctness is DERIVED rather than coincidental.

**...AND THE GAP IS CLOSED BY DELETION — THE CARD SHOWS EDGE (v1.118.0, owner's decision).**

**EDGE = `100 × ( Q(s,a) − B(s) )`, `B(s) = Σ attempt%(a′)·Q(s,a′)`** — how much better or worse this
move is than the ORDINARY choice from where you are standing, where "ordinary" is the Q3 Delphi
occurrence distribution: what people actually do. `0` is not "no value", it is *the normal thing to
do here*. Q counts not just whether the move works but WHERE A MISS LEAVES YOU, out to the end of a
real roll — so a 78%-odds move that hands over initiative can score below a 55% one that finishes.
The build side (the 272-state MDP, `scripts/solve_edge_values.py`, and the `cal.ev` wire) shipped in
v1.116.0/v1.117.0; this is the app reading it. **The model itself — and the two honesty gaps that
come with it — is the block below, `EDGE — THE MODEL BEHIND THE NUMBER`. Read it before you change
anything that feeds EDGE.**
- **THREE MARKS, TWO CHANNELS.** SHAPE = category (v1.103.6). COLOUR — glyph + clock bar + corner
  number — = **EDGE**. Bottom-right = odds, which are an INPUT to EDGE, so one is inside the other
  and they cannot contradict either. The technique's own strength leaves the card FACE entirely.
  The middle slot's category word (redundant with the shape) becomes the caption **`Edge`**: an
  unlabelled signed integer is exactly what makes a legitimate ranking read as a bug, and in **98 of
  272 hands the best-EDGE card is not the best-odds card**.
- **`potColor` saturates at 15 for EDGE** (`NG_EDGE_SAT`), not its historical 45 — measured over all
  1246 emitted pairs, p5 −14 / median 0 / p95 +12, so on the 45 scale a whole hand renders one
  indistinguishable grey. It is an optional second parameter; every pre-EDGE caller is byte-identical.
- **THE WIRE SHIPS THE LINE, NOT THE POINT: `EDGE(p) = e0 + (p − p0)·c1 − Δ`.** `moveChance` is not a
  constant — it is the calibrated rate plus your drilling, momentum, a wrong landing question and the
  opponent's resistance — so a frozen integer would be EDGE at the authored odds and at no other
  moment, and "drilling moves it" would be a lie.
  · **`p0` is the SOLVE's frame (`evFrame`), NEVER `calSuccess`.** `calSuccess` selects by the ACTIVE
    ruleset and the app defaults to **gi**, while the table is solved no-gi; **140 wire entries carry
    a gi rate that differs**, so anchoring on `calSuccess` would put those cards off their published
    value at rest with nothing done. Anchored on the frame, that difference rides through `c1` like
    any other odds movement — which is what it is (median 1.9 EDGE points, max 27.6).
  · **Δ IS THE BASELINE, RE-EVALUATED LIVE, AND IT IS NOT OPTIONAL.** `moveChance` subtracts `aiMod`,
    a per-STATE handicap identical for every card in the hand — measured **0.2612 at
    side-control/bottom** on a fresh profile (0.131 from the top player's own strength + 0.130
    aiSkill; corpus median 0.132, max 0.432). Against a FROZEN baseline all seven cards there read
    NEGATIVE, i.e. "every option here is worse than the ordinary choice here" — arithmetically
    impossible for a weighted mean, and it would have shipped as the feature's headline hand. So the
    baseline is recomputed over the state's FULL authored action set (the wire carries all 25 at
    side-control/top where only 10 are dealt) at each move's live odds. Δ is 0 at rest, so a card
    with no modifiers shows EXACTLY the solver's published integer, and **Σ att·EDGE = 0 holds at
    every moment** (the emitted `e0` are attempt-weighted zero-mean to within 0.47 of a point).
    What survives is the honest part: a uniform shift re-ranks by SLOPE, `e0 + Δp·(c1 − c̄1)`.
- **MEMBERSHIP IS THE INDEX LIST.** `cal.ev[role] = [nodeIdxs, attemptPct, ...[e0,c1] per evLam]`,
  expanded at the top of `ingest` beside the other compact-wire expansions. A node absent from
  `nodeIdxs` has NO edge and renders **no number at all** — never a fabricated 0, because 0 is a real
  value here. Measured over the 272 hands BEFORE the 10-cap: **100 gathered cards carry no wire
  row** (gi-only moves zeroed in the no-gi solve, plus layout neighbours the role-node's
  `transitions[]` never offers) and **19 wire rows never reach the gather at all** — a pre-existing
  disagreement between `graph.json`'s `transitions[]` and `globalGraphLayout`'s adjacency, surfaced
  by this join, not introduced by it.
- **THE ORDER IS FROZEN AT DEAL TIME, AND THAT IS A HARD RULE.** `optionsFor` stamps `ord`
  (`orderScore` → EDGE) and `ordOdds` once; `_cmpDealt` compares only stamped values —
  **EDGE desc → odds desc → attempt% desc → name asc**, unvalued LAST and never as 0. A JIT grade
  taken mid-decision MUST move the numbers (`refreshOptionOdds` → `_paintEdge` repaints corner,
  glyph and bar from one `edgeMark`) and MUST NOT re-sort the tray a player is already reaching into.
  `_optList` — which the 1-9 keys index — is the same frozen array.
- **`movePotential`'s `if (n.ty === "submissions") return 1` IS DELETED.** It made every submission
  score the maximum, so the sort key was a constant across all of them and the 10-cap then dealt the
  first ten ALPHABETICALLY: at Mount Top, `Americana → Armbar → Cross Collar → Ezekiel → Kimura …`;
  at side-control/top it dealt the hand's WORST card (Kneebar, −17) and truncated its most-attempted
  move (Side Control to Mount, 23%). The function survives as the ESCAPE tray's corner value only —
  an escape's options are POSITIONS, which the EDGE table cannot value, so that tray is deliberately
  UNCHANGED (category word, own-strength glyph, landing-position potential).
- **`orderScore` IS `moveEdge`, full stop** — the `cardOrder` setting it used to fork on is RETIRED
  (v1.122.0; see the block below). The `lossAversion` control **SHIPPED in v1.124.0** as
  *Winning vs not losing* (Sport / Slightly cautious / Self-defence = λ 1/2/4) — see its own section.
  `_evLamIdx()` still falls back to `NG_EDGE_LAM = 2` rather than guessing when the key names a λ
  this wire does not carry, because a wrong λ block is a silently WRONG ranking, not a missing one.
- **Live vs published:** across all 272 role-hands the opponent handicap leaves the **top card
  unchanged in 241**, the **dealt ten unchanged in 267**, the full order in 181. The spec's §4.6
  tables are AT-REST values and are reproduced exactly there (Frame from Side Control −12, Side
  Control Escape +18); a live card differs because its odds differ, which is the feature.
  The consequence recorded here "while the 10-cap stands" is **resolved by v1.123.0**: `Mount
  Control` is dealt 8th at rest and slips to 11th live (it has mount's highest `c1`, 30 — the move
  that most depends on working), so the spec's "best odds 78%, EDGE −1" example used to fall off
  the screen. The cap is gone, Mount Top deals 16, and it is on screen at either rank.
- Pinned by **`e2e/journeys/option-edge.spec.ts`** (8 journeys, 4 `@curated`), mutation-tested by
  `tests/artifacts/_edge_mutants.sh`: seven mutants, seven kills.

<a id="v1-123-0-show-every-option-the-hand-is-no-longer"></a>

## v1.123.0 — SHOW EVERY OPTION — THE HAND IS NO LONGER CAPPED

_Originally CLAUDE.md L1995._

**SHOW EVERY OPTION — THE HAND IS NO LONGER CAPPED (v1.123.0, owner's decision).** Owner: *"show
all, fold the overflow, we currently have a 'see more' suggestion already, but should be shown ABOVE
the options row, rather than on bottom of it cos in mobile that see more overlaps user icon and
text, and in mobile screens or small screens i mean dont show it. so after clicking that or
scrolling enough we can infinite scroll (horizontal infinite scroll) or something."* `NG_HAND_CAP`
and `_capHand` are **deleted**; `optionsFor` returns its whole sorted list.
- **"horizontal infinite scroll (or something)" resolves to "the tray reaches its end".** There is
  nothing to lazy-load: the hand is a finite list — 34 cards at its very largest — and all of it is
  dealt in one pass, so paging would add a loading state to data already in the DOM. What the ask
  needs is REACHABILITY, and that is what is gated: click "see more", wheel, or drag, and the far
  end arrives (`e2e/journeys/option-overflow.spec.ts` asserts `scrollLeft` lands within 4px of
  `scrollWidth − clientWidth`).
- **Blast radius, measured over all 272 role-hands** (`tests/artifacts/_hand_uncapped_probe.mjs`):
  **256 were already under 10**, so only **16 hands change**. The corpus deals **1205 → 1326** cards,
  the median hand stays **4**, and the largest goes **10 → 34** (`standing-position/top`;
  `closed-guard/bottom` 32, `side-control/top` 25).
- **The v1.119.0 category floor dissolves with the cap it repaired**, and so does the OPEN question
  it left the owner ("admit the missing category's best-EDGE card, or its most-ATTEMPTED one?").
  side-control/top now deals all 25, so `Side Control to Scarf Hold Position` (+3) and
  `Side Control to Mount` (−2 on **23%** attempt, the largest authored anywhere from that state)
  are BOTH on screen. There is nothing left to choose between.
- The `!out.length` fallback keeps its own `.slice(0, 6)` — that is not this cap, and measured
  **0 of 272 live hands reach it**, so leaving it alone means this change cannot alter a path
  nobody can observe.
- **`replay-digest` MOVED, `af3588835ad1c6b6` → `0390cc44ee7f40e5`, and that is correct.** Unlike
  v1.122.0 — where the digest was *structurally blind* to the change — `options_dealt {count}` is a
  beat and 16 hands genuinely deal a different number of cards, so a digest that did NOT move would
  mean the change had not reached the beat stream. It is not pinned as a fixture anywhere (the spec
  compares runs to each other); `triple_replay.sh` re-proves three consecutive runs identical.

<a id="v1-123-0-what-uncapping-had-to-pay-for-two-things"></a>

## v1.123.0 — WHAT UNCAPPING HAD TO PAY FOR — TWO THINGS THAT DO NOT SCALE

_Originally CLAUDE.md L2025._

**WHAT UNCAPPING HAD TO PAY FOR — TWO THINGS THAT DO NOT SCALE (v1.123.0).** The number 10 did not
die, it moved off the DISPLAY and onto the two costs that genuinely grow with the hand. Pinned by
`e2e/journeys/option-overflow.spec.ts` (6 journeys, 6 `@curated`), mutation-tested by
`tests/artifacts/_overflow_mutants.sh`: **seven mutants, seven kills**.
- **THE DECISION CLOCK (`NG_DECISION_KNEE` = 10, `NG_DECISION_K` = 2.2).** `dsec = decisionSec +
  0.8·(n−1)` was fine while n was capped and absurd the moment it was not: 34 cards bought a
  **35.4-second turn**. Time to choose does not grow linearly with the alternatives — Hick's law
  says it grows with their LOG — and this tray is ranked best-first, so cards past the fold are
  scanned rather than weighed. Below the knee **nothing changes at all** (measured: all **256**
  sub-knee hands keep their clock to the millisecond, and the median turn is still **11.4s**);
  beyond it each DOUBLING buys `NG_DECISION_K` seconds. The branches meet **exactly** at the knee
  (16.200s both ways), so there is no step. Worst turn **35.4s → 20.1s**. The knee is what makes
  this the minimal change rather than a global re-tune: a pure log curve with the same worst case
  moves every small hand too (mutant O2 proves the spec catches that).
- **THE DECK WARM-UP (`NG_PREFETCH_CAP` = 10) — AND THIS ONE IS THE HONEST COMPROMISE.** `enterLand`
  hydrates one deck per dealt card, and that IS on the first-hand payload bill: it is deferred by a
  single macrotask while `payload-first-hand.spec.ts` freezes its request set at a Playwright poll
  for `[data-tech]`, and its own report carries five `flashcards/*.json` rows to prove it. Warming
  every card of an uncapped hand costs **+15,819 B gzip on the AVERAGE first visit** against
  **7,050 B** of headroom, and **46.6% of real first draws** land on a hand whose delta alone
  exceeds it (`closed-guard/bottom` **+70,213 B**, `standing-position/top` **+86,911 B**) — weighted
  by the app's own `_weightedStart` probabilities, not uniformly
  (`tests/artifacts/_prefetch_traffic_probe.mjs`). So the warm-up takes the hand's first ten; the
  tray is ranked by EDGE, so those are the likeliest picks, and card 11+ hydrates on demand through
  the `deckStatus === "pending"` → *"Loading this state's cards…"* path that already serves every
  cold deck in the app. **Ten keeps today's payload byte-identical**, because ten is what the hand
  used to be.
  > **THE GATE IS STRUCTURALLY BLIND TO THIS, AND SAYING SO IS THE POINT.** `payload-first-hand`
  > pins `start-pos:[0]` → `Gogoplata Control Top`, a **7-card** hand that is under the cap either
  > way, so it reports the same bytes with the cap and without it. It did not clear this design;
  > the traffic-weighted walk did. Do not read a green payload gate as evidence about hand size.

<a id="v1-123-0-the-overflow-hint-above-the-hand-and-the"></a>

## v1.123.0 — THE OVERFLOW HINT: ABOVE THE HAND, AND THE BREAKPOINT WAS MISSING A DEVICE

_Originally CLAUDE.md L2057._

**THE OVERFLOW HINT: ABOVE THE HAND, AND THE BREAKPOINT WAS MISSING A DEVICE (v1.123.0).**
- **The owner's diagnosis was off by a breakpoint; their observation was exact.** The element DOES
  carry `.ng-seemore` and `@media (max-width:640px)` DOES fire — measured, at 390x844 it is
  `display:none`. What was wrong is that a phone held **LANDSCAPE is 844x390 — 844px WIDE** — and
  sailed straight past a width-only rule. The rule is now `(max-width:767px), (max-height:500px)`;
  767 also clears the one band where the hint would have met the centred landing card
  (`min(520px,100vw-32px)` reaches its left edge below ~710px).
- **The collision was universal, not device-specific.** The hint was `bottom:68px` against the
  tray's own `bottom:84px` — i.e. UNDER the hand — and measured at **every** width where it renders
  (844x390 through 1440x900) its box sat exactly **2px** above the account chip's, sharing the same
  right edge (`[1345,819..1416,832]` vs `[1317,834..1416,876]` at 1440x900). It now docks off the
  tray's **MEASURED** top (`_dockOptionHint`) — never a constant, because the row has no fixed
  height (138px at 390x844, 144px at 1440x900, taller again for an escape hand) — which is the same
  lesson `_dockLandCard` learned. Clearance to the chip: **2px → 172px**.
- **SIXTH INSTANCE OF THE `setPointerCapture` BUG CLASS, and it was PRE-EXISTING.** `attachInput`'s
  pointerdown captures on the wrap, which retargets pointerup so the browser resolves the click to
  the common ancestor — and `.ng-seemore` has never been in the early-return list, though its whole
  purpose is an `onClick`. The option ROW beside it is immune only because `componentDidMount` gives
  it its own `pointerdown` stopPropagation, which the hint never had. So the affordance has been
  **dead to the mouse for as long as it has existed**; it surfaced now only because uncapping made
  it worth writing the first spec that clicks it with a REAL mouse instead of `locator.click()`.
  Any new fixed overlay with controls goes in that list.
- **A WHEEL OVER THE HAND NOW SCROLLS THE HAND.** A vertical wheel scrolls a horizontally-overflowing
  element in no browser, so with 34 cards (a **4,104px** overflow at 1440x900) a mouse user could
  reach card 34 only by dragging or by clicking "see more" repeatedly. The handler takes the larger
  of `deltaX`/`deltaY`, so a trackpad's real horizontal gesture is unchanged, and it no-ops when
  nothing is folded rather than swallowing the page's scroll.

<a id="v1-123-0-what-uncapping-did-not-touch-and-one-thi"></a>

## v1.123.0 — WHAT UNCAPPING DID *NOT* TOUCH, AND ONE THING IT MAKES WORSE

_Originally CLAUDE.md L2085._

**WHAT UNCAPPING DID *NOT* TOUCH, AND ONE THING IT MAKES WORSE (v1.123.0, disclosed).**
- **THE ESCAPE TRAY IS ENTIRELY UNAFFECTED.** `enterDefense` builds its own `escapes` array from
  `adj` — it never calls `optionsFor` — and its clock is already bounded:
  `Math.max(4, Math.min(9, 4 + escapes.length))`. Neither the cap, the knee nor the prefetch has
  ever applied there. `movePotential` likewise survives as that tray's corner value (v1.122.0),
  because an escape's options are POSITIONS and the EDGE table cannot value them.
- **MOBILE REACH IS AN OPEN QUESTION, AND A DRAG FIX WAS BUILT, MEASURED AND THEN REVERTED.**
  At 390x844 the tray shows **2 of 34** cards (it showed 2 of 10 before, so this is not new), and
  the "see more" hint is deliberately hidden there, so the tray itself is the only affordance.
  Chasing whether a thumb can drag it turned up a REAL and separate pre-existing defect, which is
  reproducible with `tests/artifacts/_onehand_reach_probe.mjs`: **~1s after a swipe ends, the whole
  roll restarts.** Traced — one `stakes` beat, no `click`, no `bg_dismissed`, `paused` true
  throughout, and the app lands on a fresh random position (Modified Mount, Back Control and
  Closed Guard on three consecutive runs). The 1s delay and the random landing match
  `enterLand`'s `if (!opts.length) after(1.0, () => startRoll())`, i.e. the gesture is resolving as
  a graph tap (`stageRollAt`) onto a node with no dealable hand.
  - **What was reverted, and WHY it had to be.** A JS `_attachTrayDrag` (touch events, because
    Chrome cancels the POINTER stream mid-swipe — instrumented: `pointerdown · touchstart ·
    pointermove · touchmove · POINTERCANCEL · touchmove ×11 · touchend`) did move the tray
    (`scrollLeft` 0 → 210 mid-gesture). But its premise — "the tray never scrolls by touch" —
    rested on a reading taken **450ms after touchend**, by which time the restart above had
    already cleared the tray and reset `scrollLeft` to 0. **The measurement was confounded, so the
    premise was never proven.** Two mutants confirmed it: deleting `_attachTrayDrag` entirely, and
    swapping it to pointer events, both left the mobile journey GREEN — the harness scrolls that
    tray natively (identical `touch-action`: wrap `none`, row `auto`). A change whose own mutant
    cannot kill its test is not evidence, so the drag, its journey and its two mutants are all out.
  - **What is therefore TRUE and what is NOT.** True: 2 of 34 cards are visible on a phone, and a
    swipe there restarts the roll. NOT established: whether the tray scrolls by touch on a real
    device. Settle the restart first — it corrupts any measurement taken after a gesture — then
    re-measure reach. Desktop is unaffected and fully gated (click + wheel, mutants O6/O7).
- **THE `1-9` KEYS NOW COVER LESS OF THE HAND, and nothing was done about it.** The digit handler is
  `/^[1-9]$/` and `catGlyphSvg` only draws a number for `num <= 9`, so cards 10+ have never had a
  shortcut or a numbered glyph. Under the cap that stranded at most 1 card (2 on side-control/top);
  now the largest hand strands **25 of 34**. It degrades rather than breaks — `_optList[8]` is the
  highest index reachable, so there is no out-of-range read, and the mouse/touch paths reach every
  card. Extending it is a DESIGN question, not a mechanical one: `0` buys only a tenth slot and
  `A`-`D` are already the live MC block's answer keys (v1.68.0). Owner's call.

<a id="v1-119-0-the-hand-s-four-other-invariants-walked"></a>

## v1.119.0 — THE HAND'S FOUR OTHER INVARIANTS, WALKED OVER ALL 272 ROLE-HANDS

_Originally CLAUDE.md L2123._

**THE HAND'S FOUR OTHER INVARIANTS, WALKED OVER ALL 272 ROLE-HANDS (v1.119.0)** —
`e2e/journeys/option-hand.spec.ts` (5 journeys, all `@curated`), mutation-tested by
`tests/artifacts/_hand_mutants.sh`: five mutants, five kills.
- **The order is the app's own ranking, under a STRICT TOTAL ORDER that is never node index.**
  `optionsFor` builds its list by walking `adj` — i.e. in node-index order — and `Array#sort` is
  stable, so a comparator that can return 0 silently hands the decision to the node index. Measured:
  **0 zero-pairs and 0 non-descending steps across all 272 hands**, and reversing each hand's input
  and re-sorting reproduces the dealt order in **272 of 272**. The name tiebreak is load-bearing,
  not decoration: **21 pairs tie on EDGE, odds AND attempt%** and only the name separates them.
- **The printed integer is `Math.round` of the value the hand was ranked by** — one quantity, two
  renderings, so the corner number and the position of the card can never describe different things.
  It follows that printed integers are non-increasing down the hand (**0 violations**).
- **AN EXACT TIE ON SCREEN IS A TIE IN THE DATA, NEVER A CONSTANT IN THE CODE.** This is the shape of
  the bug the feature replaced (`+100` on every submission). Two cards may print the same integer as
  ROUNDING NEIGHBOURS — **129 such groups**, raw values distinct — but where the raw values are
  bit-identical (**42 groups**) the wire rows behind them are identical too, in **42 of 42**. (Why
  the exact ties exist at all: `moveChance − p0` is a per-STATE constant, so two moves sharing
  `(e0, c1)` land on the same raw EDGE regardless of their own rates.)
- **A submission's odds are its AUTHORED rate.** All **297 of 297** carry a calibrated rate; they run
  **10%–74% across 37 distinct values**, and **270 of 297 sit outside the 44–47% band** the old
  dominance fallback (`0.36 + dom·0.1`) collapsed every submission into — that fallback prices the
  whole corpus at **2 distinct values**. It reaches the card: Mount Top's dealt submissions span
  **24 points** of printed odds. Reproduce all of it with `tests/artifacts/_hand_measure.mjs`.
- **`option-hand`'s pool is a second copy of `optionsFor`'s filters, and it knows it** — every
  journey also asserts POOL ⊇ DEALT, which fails loudly the day the app's filter and the spec's copy
  disagree. Since v1.123.0 the first journey asserts **SET EQUALITY**, which is strictly stronger
  and only became available when the cap stopped withholding cards: it now catches a card WITHHELD
  as well as one invented, so the copy is a real gate rather than a one-way check. That journey was
  "the cap thins a category, it never erases one"; it is now "every legal move is dealt — the hand
  IS the pool", and H1's mutant is the cap itself.
- **The mutant for the authored-odds claim needs THREE edits, and that is the finding.** Reverting
  only the `_tech_keys` slug ladder in `regenerate_neural_data.py` leaves the test GREEN, because two
  build gates refuse the bad wire in turn — `cal join regressed: only 3/297 submissions carry a
  successRate`, then `EDGE join regressed: only 976/1246 moves (78.3%) reached a graph-data node`.
  The wire can no longer rot silently on the build side; the mutant has to disable both gates to
  reach the browser at all.

<a id="v1-116-0-edge-the-model-behind-the-number"></a>

## v1.116.0 — EDGE — THE MODEL BEHIND THE NUMBER

_Originally CLAUDE.md L2160._

### EDGE — THE MODEL BEHIND THE NUMBER (solver v1.116.0 · wire v1.117.0 · landed v1.120.0)

**In plain English.** Every option card used to carry two marks that both claimed to say "how good
is this move", and one of them printed `+100` on every submission. EDGE is the one number that
replaced them: *how much better or worse this move is than the ORDINARY choice from where you are
standing, counting not just whether it works but where a miss leaves you.* `0` is the normal thing
to do here, `+18` is "this is the move", `−12` is "people do this and it costs them". It is not an
opinion and not a heuristic — it is computed by **playing every position out to the end of a real
roll** and asking how often you tap them versus tap.

**The solver is `scripts/solve_edge_values.py`** (`solve` + `solve_mixture` + `selfcheck` +
`mutants`). It reads **`graph.json`, never the wire** — the wire is derived and
was itself broken until v1.115.0, so an offline solve is the only correct place to do this.
Deterministic across `PYTHONHASHSEED`; the full report runs in ~2s.

**THE STATE MACHINE.** `V = p_win − λ·p_loss` (`R(WIN)=+1, R(LOSS)=−λ, R(DRAW)=0`), and
`Q(s,a) = p·A + (1−p)·B` where `p` is the calibrated success rate, `A` the success-branch value and
`B` the miss-branch value. Six rules, each of which is easy to get wrong and each of which was read
off `neural/src/app.src.jsx` rather than assumed:
- **272 states.** `graph.json.positions` has 409 keys; **272** end `/top` or `/bottom` and the other
  **137** (136 hubs + `game-over`) carry `transitions: []` — aggregators, not states. Neutral
  positions do not exist here: `standing-position`, `clinch` and `open-guard` all split. State is
  written from **your** side; the opponent occupies `opp(s)`.
- **INITIATIVE IS ASYMMETRIC, and it is the shipped rule.** A success returns to `enterLand(false)`
  — **you move again**. A miss that moves you costs 1 ply and hands over the turn; a miss that
  leaves you where you are costs **0 plies** (`enterFailCal` early-returns with no `startTravel`).
  `opponentDefend` always ends in `enterLand(false)`, so **the opponent never keeps initiative**.
  That is a large permanent player advantage. It is what ships, so it is what is modelled — and it
  is load-bearing: `--mutants` gives the opponent initiative and `V(side-control/bottom)` falls
  **+0.5055 → +0.2266**; charging the stay-put ply moves it to +0.4933.
- **YOU argmax; the OPPONENT samples the authored attempt distribution.** Owner's binding note:
  *"let's not assume yet that the opponent is the same level as we are."* **Not minimax** — this
  asymmetry is what makes drilling pay.
- **Actions are ORIGIN-FILTERED, exactly as `optionsFor` deals them**, and when origin empties a
  hand the model relaxes **ORIGIN, never ROLE** — same rule as the app. **3 role-nodes** hit that
  fallback in no-gi (`worm-guard/bottom`, `piranha-guard/bottom`, `inverted-lasso-guard/bottom`).
  Removing the origin filter moves `V(side-control/bottom)` to **+0.6261**, so this is a choice with
  teeth, not a detail.
- **THE 42 HUB-TARGET OUTCOME CELLS ARE CHAINED, NOT DROPPED.** 21 sit on `/attacker` nodes and
  **17 of those are a node's ENTIRE success branch** (`-finish`/`-setup`/`-variation` transitions
  whose success means "you secured the control"). Dropping and renormalising them — the obvious
  implementation — leaves **16 dealt actions with `successRate > 0` and no success branch at all**,
  which is where an earlier pass's *"19 broken content nodes, fail `validate:graph` on them"* claim
  came from. **It was a model artifact. Do not file those tickets.** Chained: **0**. There is no
  second-level chain and `selfcheck` asserts it.
- **Horizon = `maxMoves`, uniform on {9,10,11,12}.** The wire ships the **mixture**; every published
  table quotes **H=11**, and **80 of the 1246** emitted integers differ between the two by rounding.

**WHY THE OPPONENT MIRROR IS NOT OPTIONAL — the one thing that decides whether the number means
anything.** The opponent's action set is the **PAIRED role-node's** authored `transitions[]`, sampled
by `attemptProbability`; their outcomes are read off the technique's `/attacker` node and the landing
role suffix is flipped back into your frame. The `/defender` nodes are never needed. Three models,
λ=2, H=11, same-origin:

| model | mean V(top) | mean V(bottom) | bottoms above the mean top state |
|---|---|---|---|
| **A — mirrored (the correct one)** | **+0.8368** | **+0.5806** | **27 / 136** |
| D — no mirror (the opponent draws *your* list) | +0.7612 | +0.8181 | **119 / 136** |
| E — no opponent at all | +0.9999 | +0.9990 | 35 / 136 |

**Model D inverts the sport** — being underneath becomes better than being on top, in 119 of 136
positions. **Model E scores `back-control/bottom` — being strangled — at +0.9998**, where loss
aversion is literally meaningless. The reason is content, not arithmetic: **166 of 272 role-nodes
(61.0%) author zero submissions** (Side Control Bottom: 11 moves, 0 submissions; Mount Bottom: 7, 0)
while Side Control Top puts **49% of its no-gi attempt mass on 16 submissions**. **λ enters ONLY
through the mirror**: at `side-control/bottom`, `V = +0.5055` but `U = −0.1859` with `p_loss 0.3917`
— a **0.6914 swing** that exists only because the opponent's submission hand is in the model.

**THE FULLY-SYMMETRIC RESIDUAL IS NOT EVIDENCE ABOUT CONTENT — do not quote it as such.** The
report prints it (mean `2.26e-17`, exactly 0 at every horizon), and it is close to a **tautology**:
`--mutants` corrupts an `/attacker` outcome cell and it stays at 2.2e-16, replaces `flip()` with the
identity and it stays at ~0. It detects exactly ONE thing — the opponent sourced from the wrong node
(0.2508). **The mirror's zero-violation claim rests on the direct 6-invariant test over 1331 pairs**,
which DOES go red: one flipped `/defender` probability → `FAIL {'probability': 2}`, one retargeted
outcome → `FAIL {'to_flip': 1}`, both exit 1.

**Structural facts the self-check gates on every run** (all green today, so the gate ships green and
only fires on a content regression): attempt sums == 100 in **272/272**; outcome sums == 100 in
**2662/2662** technique role-nodes over **8320 cells** (`success 4160 / failure 2806 / counter 1354`);
**0 unresolved targets**; `game-over` reached by **594 cells, every one from a submission — 0 from a
transition**; the mirror **1331 pairs, zero violations**; branch form self-consistent to **2.22e-16**.

<a id="v1-121-0-the-honesty-gaps-there-were-two-one-is-c"></a>

## v1.121.0 — THE HONESTY GAPS. There were two; ONE IS CLOSED and one is still live

_Originally CLAUDE.md L2242._

**THE HONESTY GAPS. There were two; ONE IS CLOSED (v1.121.0, below) and one is still live.**

1. **`opponentDefend` IS NOT THE OPPONENT THE MODEL ASSUMES, and this is the biggest one.** It
   iterates `this.adj[this.currentPos]` — **undirected, hub-collapsed adjacency** — with **no role
   filter and no origin filter**, picks a finish with `pFinish = clamp(0.34 + oppAdv*0.55, .18, .85)`
   and otherwise takes one of the top 3 by `oppVal`. **It never reads `attemptProbability`.**
   **BOTH SIDES OF THE COMPARISON NOW NAME THEIR DEFINITION** (re-measured v1.127.1 — the model
   figure did not reproduce, see below), and `tests/artifacts/_opponent_gap_measure.py` computes
   them from the two code paths:
   · **SHIPPED** = `opponentDefend`'s own gather — the hub's adjacency, `ty !== "positions"`,
     deduped by title. (`adj` is per HUB; the v1.125.0 pair keeps `adj[<member>]` byte-identical to
     `adj[<hub>]`, so both role-states of a hub see one pool.) **10,662 cells over 272 role-states
     = 39.2 per state.**
   · **MODEL** = `Model.opp_hands[i] = hands[index[flip(s)]]` — the opponent plays THE PAIRED
     ROLE-NODE'S OWN DEALT HAND, built by the same `build_hand` that deals mine, so role-filtered
     (never relaxed) and origin-filtered. **1,246 cells over 272 = 4.58 per state**, which is the
     solver's own published `(state, action) pairs` headline read from the other side, and
     `--verify` reports 1246 independently. **So only 11.7% of what the shipped opponent may pick
     is a move the model's opponent would ever consider.** The modelled set is a **strict subset in
     272 of 272 states** — pure OVER-inclusion, no move modelled that the roll cannot reach.
   **THE RETIRED FIGURE (9.1 / 23.2% / 2476) WAS MEASURING A SET THE MODEL NEVER HOLDS**: the
   opponent's role-filtered moves **before `build_hand` narrows them to the ones that originate
   here** (reading D in the script; today **9.12 / 23.3% / 2481**, i.e. it still reproduces, on the
   wrong set). It was not a bad measurement, it was a measurement of the wrong thing — and it
   disclosed the gap at **roughly half** its real size. **A canon number nobody can reproduce is
   worse than no number**, which is why the definition is now written down beside the figure and
   computed by a script rather than by hand.
   **WHAT THE OVER-INCLUSION IS MADE OF**, splitting the 10,662-cell pool against the opponent's
   role and this hub: **the opponent's own move, from here 1,326 (12.4%)** · wrong role only 1,326
   (12.4%) · originates elsewhere only 4,005 (37.6%) · **both wrong 4,005 (37.6%)** — so **87.6% of
   the shipped opponent's pool is wrong on role, origin, or both**. (The two mirrored pairs are
   structural, not a coincidence: one pool serves both role-states of a hub, so summing over both
   roles makes each wrong-role count the reflection of its right-role twin.) **EDGE therefore
   describes a better-behaved opponent than the one you actually face.** Making the game match the
   number is a large, separate, owner-gated change; until it happens this sentence belongs in any
   copy that explains EDGE.
   **The measurement is red-proven, not merely run**: it reads `Model.opp_hands` directly, so
   `--mutant` (`opponent="mylist"`, the spec's model D) moves *reading A == MY OWN hand* from
   **0 of 272 to 272 of 272**. A count alone could not have caught that — the flip is a bijection
   over the 272 states, so *the size* of the opponent's hand is invariant under it.
2. ~~`resolve()` coerces the outcome branch instead of drawing inside it.~~ **CLOSED in v1.121.0 —
   see the section below.** The disclosure it replaced is kept there in full, because the numbers
   are the reason the fix exists.

<a id="v1-121-0-the-miss-distribution-the-card-prices-is"></a>

## v1.121.0 — THE MISS DISTRIBUTION THE CARD PRICES IS NOW THE ONE THE ROLL ROLLS

_Originally CLAUDE.md L2286._

### THE MISS DISTRIBUTION THE CARD PRICES IS NOW THE ONE THE ROLL ROLLS (v1.121.0)

EDGE's whole claim is that it counts **where a miss leaves you**. Honesty gap 2 was that the roll
did not roll the miss distribution EDGE prices, so every integer on every option card was a price
for a game nobody was playing.

**WHAT WAS WRONG.** `resolve()` decided success/miss on `moveChance` — correct, and unchanged: that
is the player-facing gate drilling moves. It then drew the ROW from the **whole** authored table and,
when the drawn row's branch disagreed with the gate, replaced it with `outcomes.find(...)` — the
**FIRST** matching cell, not a re-draw inside the branch. Authored lists run success → failure →
counter and **1327 of 1331** end in a `counter`, so every miss that happened to draw a success cell
was dumped onto the first `failure` and the counter cells starved.

**MEASURED, twice, by two methods that do not share code.** `tests/artifacts/_resolve_kernel_measure.py`
derives both kernels analytically from `graph-data.json`; `tests/artifacts/_resolve_kernel_probe.mjs`
sweeps a rigged `outcome` value through the app's OWN `resolve()` in a real browser (the four
entry points it calls after choosing are stubbed, so the function runs whole and moves nothing —
0 fx beats emitted during a full corpus sweep). They agree to grid resolution:

| | before | after |
|---|---|---|
| TV vs the authored within-branch kernel | mean **0.0902** · median 0.0825 · **max 0.2440** | mean 0.0001 · max 0.0004 (= 1/grid) |
| TV == 0 | **0 of 1331** | **1331 of 1331** |
| counter mass rolled (summed over 1331 nodes, authored **233.8164**) | **123.0071** — **47.39% never landed** | 233.7810 — 0.02%, which is the sweep grid |

Worst single node `Transitions/Escape-Scarf-Hold-Position` at TV 0.2440. **`> 0.10 on 276` is a
knife-edge count** — 88 nodes sit on 0.10 to float noise, so at-or-above reads **306**, which is
exactly what the sampled probe reports. Do not read the 276/306 gap as the two methods disagreeing.

**THE FIX IS A CONDITIONAL, NOT A SECOND DICE.** `drawOutcome(act, branch)` takes the branch the
gate already chose, restricts the table to that branch's rows and renormalises **inside** it —
which is precisely the conditional the authored weights state. **Exactly ONE `rng("outcome")` draw
per resolution, same tag, same order**, so a rigged journey consumes the same queue; what changed is
which row a mid-band value lands on. `branch` omitted (`opponentDefend`'s destination draw) = the
whole table, unchanged. An empty branch falls back to the whole table — what `.find(...) || out`
did — and the fallback is chosen BEFORE the draw so the rng call count never depends on content
(0 of 1331 lists have an empty or zero-weight branch, so this is defensive).

**MOMENTUM STILL SHEDS COUNTER WEIGHT, and now it is the only thing doing so.** `momentumSkew()`
scales counter rows by `(1-sk)` inside the miss branch, so "too fast to capitalize" reads exactly as
written. Its `outcome_skewed` beat also stopped lying: it used to fire on the row that was drawn
*before* coercion, so it could announce a skew applied to an outcome the player never saw.

**`replay-digest` DID NOT MOVE, AND THAT WAS EXPECTED TO BE THE OTHER WAY ROUND.** The task that
commissioned this fix said it would "deliberately re-baseline `replay-digest`". It did not: three
replays are byte-identical at **`af3588835ad1c6b6`**, the SAME digest v1.120.0 recorded, and the
artifact `diff`s clean against the pre-fix run. That is a property of the scripted roll, not a sign
the fix missed the roll, and the reason is measurable. **A rigged draw lands on a different cell on
18.19% of `u` under a MISS gate, but only 2.93% under a SUCCESS gate — and 0% on 1226 of the 1331
nodes**, because those author exactly ONE success cell, so every `u` maps to it under both kernels.
`replay-digest` rigs `resolve: 0.01` (success) and commits `Submissions/Kimura/from-Mount`, whose
table is `[game-over 72 success · mount/top 18 failure · closed-guard/bottom 10 counter]` — one
success row, and a submission finish that ends the round before the row's `to` is ever read. **So
that spec is structurally incapable of seeing this change**, which is exactly why the corpus gate
below exists rather than a digest bump standing in as evidence.

**Gated by `e2e/journeys/outcome-kernel.spec.ts`** (3 journeys, 2 `@curated`), which asserts the
corpus figures through the shipped `resolve()`. Red-proven with three mutants: **M1** restores the
coercion → `mean TV … Expected < 0.01, Received 0.09017653374680812` and `counter mass lost
(110.809 of 233.816) … Received 0.47391609835906745`; **M2** adds a second `rng("outcome")` draw →
`one rng('outcome') draw on the success branch … Expected 1, Received 2`; **M3** applies the filter
when NO branch was passed → `drawOutcome with no branch reaches the SUCCESS cell too: 0.01 landed on
a failure cell`. M3 is why that test asserts BOTH ends of the whole-table draw: `!!undefined` is
false, so a filter that forgot to check for "no branch at all" silently serves the miss branch — and
with 1327 of 1331 lists ending in a counter, the `0.99` end alone still looks right.

**REFUTED, and measured here rather than inherited.** The spec's "genuinely uncertain" note claims
`p_win` is compressed into **0.80–0.99** across all 272 states. It is not: the floor is **0.5538**
at `invisible-collar/bottom` and **39 of 272** states sit below 0.80. EDGE is a difference so it is
immune either way, but do not repeat the compressed-range claim.

**THREE MODELLING CHOICES THAT ARE CHOICES, NOT FACTS** — if you are about to defend a number, know
which of these it rests on. (a) **The zero point is the Q3 Delphi occurrence distribution.** `B(s)`
calls "ordinary" whatever `attempt_probability` says people do; if those are wrong, EDGE's zero is
wrong even when every `Q` is right. (b) **The chain performer is label-driven** (success → the actor
performs, failure/counter → the opponent does). Switching to "the actor always performs" moves
`V(mount/top)` and `V(side-control/bottom)` by **less than 1e-4**, so it is settled empirically, not
by argument. (c) **The wire is the horizon MIXTURE, the tables are H=11.**

<a id="v1-122-0-the-cardorder-setting-is-retired-the-set"></a>

## v1.122.0 — THE `cardOrder` SETTING IS RETIRED — THE SETTING GOES, NOT THE SECOND MODE (v1.122.0, owner's

> **Status:** Current - `cardOrder` is DORMANT, not pruned: a settings key cannot be deleted (no tombstone in the per-key LWW merge).

_Originally CLAUDE.md L2365._

**THE `cardOrder` SETTING IS RETIRED — THE SETTING GOES, NOT THE SECOND MODE (v1.122.0, owner's
decision).** Settings → Rolling → "Option ordering" offered `Potential` / `Popularity`.
`orderScore` forked on it; **`edgeMark` did not.** So `Popularity` ranked the tray by
`movePopularity` — a placeholder graph-derived pick rate, jittered by a `Math.sin` hash — while
every card went on printing its EDGE. Measured over all 270 live role-hands
(`tests/artifacts/_edge_cardorder_probe.mjs`, against the served bundle): under the default,
**0 hands** print an EDGE that runs out of descending order; under `Popularity`, **211 do**. Worst
case `back-control/bottom` printed `[−6, −20, +6, +8, −2, +14, +17, +19]` — the corner numbers climb
as you read down the tray and the `+19` card is dealt LAST. That is exactly the "a legitimate
ranking reads as a bug" failure the `Edge` caption exists to prevent, one settings click from the
default.
- **Why retire rather than repair.** Owner: the sort only changes the dealt set in a handful of
  hands, so control over it is control over almost nothing. Measured on the same walk: the choice
  changed the dealt **SET in 16** of the 270 hands, while re-ordering **223** and changing the top
  card in **190**. It re-ranked nearly every hand and widened the action space in almost none.
- **Deleted:** the Settings row and its explainer, `movePopularity` (its only caller was the fork)
  and `_hash01` (its only caller was `movePopularity`), plus the already-dead `mapFreq`/`_freqMap`.
  `orderScore(opt)` is now `return this.moveEdge(opt)`. **`movePotential` STAYS** — it is the ESCAPE
  tray's corner value, and an escape's options are POSITIONS, which the EDGE table cannot value.
- **The false explainer went with the row, and it was false BEFORE EDGE.** It described Potential as
  *"a Bayesian estimate blending how likely you are to land the move, how strong the resulting
  position is, and how many follow-ups it opens"* — but `movePotential` never read the odds at all
  (it reads the LANDING node's `myVal` and its `deg`), and by v1.118.0 the branch was `moveEdge`
  anyway. Nothing replaces it: the card's `Edge` caption is the app's only claim about the ranking,
  and inventing a fresh sentence for a control that no longer exists would be a third thing to keep
  true. (The spec's `.ng-seemore` legend line is still NOT BUILT — see ALSO NOT BUILT below.)
- **A SETTINGS KEY CANNOT BE DELETED, so `cardOrder` is DORMANT — not pruned.** A profile that saved
  `"popularity"` keeps the key forever and nothing reads it. Pruning on load would be theatre:
  `_pullAndMerge`'s per-key settings merge has **no tombstone** — `if (!(sk in merged) || ct > lt)`
  — so a key deleted locally is unconditionally RE-ADDED by the first pull from any device that
  still carries it, exactly like the add-wins list merge. Same shape as `studyOrder` (v1.105.0) and
  `challengePinnedTrack` (v1.99.2); this repo's answer is to stop READING the key and say so where
  the reader used to be.
- Pinned by **two journeys in `e2e/journeys/option-edge.spec.ts`** which boot a profile that really
  has `cardOrder:"popularity"` in its blob: one walks all 270 hands and asserts (a) `orderScore(o)`
  is bit-identical to `moveEdge(o)` on every dealt card, (b) 0 hands print out of descending order,
  (c) flipping the dormant key moves no hand; the other opens Settings → Rolling and asserts the row
  and both its choices are gone, the "Bayesian" sentence is nowhere in the modal, and the tab still
  renders its other rows. Three mutants, three kills — restoring the fork splits **270 of 270** hands
  and mis-orders **216**; restoring the row fails on the label; and `Math.round`-ing the sort key
  splits **265 of 270** while leaving the printed order *and* the inert-key check green, which is why
  assertion (a) exists and is not decoration. (216 vs the probe's 211: the journey pins
  `aiSkill = 0.13` and a bonus-free state key, the probe reads live browser defaults. Same
  contradiction, two conditions — both are stated rather than one being rounded to the other.)
- **`replay-digest` is UNCHANGED (`af3588835ad1c6b6`) and that is not the evidence.** The default was
  `"potential"`, so `orderScore` already returned `moveEdge` for every profile that never touched the
  setting, and no digest spec sets `cardOrder` — the digest is STRUCTURALLY unable to see this
  change. What it does confirm is the absence of an accidental side effect from the deletions. The
  corpus walk above is the evidence.
- The **Forward catalog's** settings mock (`forward/shared/components-panels.js`,
  `forward/shared/fixtures.js`) rendered the retired row too. It is a DESIGN mock with no parity gate
  against `renderSettings` — `check_forward_catalog.mjs` only checks that frames render — so retired
  rows survive there by default: "Study order" had been stale since v1.105.0. Both are removed and
  the reason is recorded in `fixtures.js`. **Treat the catalog as unguarded.**

<a id="v1-124-0-winning-vs-not-losing-the-loss-aversion"></a>

## v1.124.0 — WINNING vs NOT LOSING — the loss-aversion dial

_Originally CLAUDE.md L2420._

### WINNING vs NOT LOSING — the loss-aversion dial (v1.124.0, owner's decision on the default)

Owner: *"we really don't want to lose the game and we want to win the game … we're more averse to
losing than to winning. It depends if it's the context of sport or self-defense … typically in
self-defense they really don't want to lose. That's why they prioritize mount over side control
because it's more for the street … maybe that can be a setting of an optimization function."* They
chose **slightly loss-averse as the DEFAULT**, over play-to-win and play-not-to-lose. It ships in
**Settings → Rolling**, directly under the Gi / No-gi choice.

**THE NUMBERS WERE ALREADY RIGHT; THE MIDDLE RUNG'S NAME WAS WRONG — so nothing was re-emitted.**
The task allowed re-emitting the presets rather than mislabelling them. Reconciled instead:
`V = p_win − λ·p_loss`, so **λ=1 IS the balanced point** — a tap you get is worth exactly what a tap
you give away costs — and **λ=2 is already twice as afraid of losing as it is keen to win**. That is
the owner's "slightly loss-averse", and it was ALREADY `NG_EDGE_LAM`. The emitter's own comment
("Winning / **Balanced** / Not getting caught") named the default after a posture it does not hold;
that line is the only thing that changed on the build side. **Wire delta: 0 bytes.** The rungs are
**Sport (λ=1) · Slightly cautious (λ=2, default) · Self-defence (λ=4)**.
- **Cost, both endpoints measured HERE rather than inherited.** `payload-first-hand` run against
  the stashed pre-change bundle and again against the shipped one, same machine, same server:
  **378,281 → 379,037 B gzip (+756)** of a 385,000 ceiling, so headroom **6,719 → 5,963 B**. Raw
  1,674,404 → 1,676,439 (+2,035); the bundle alone is 456,972 → 459,007 raw / 134,528 → 135,259
  `gzip -9`. **20 requests before and after — nothing new is fetched.** `check_payload_budget.py`
  green (eager gzip 299,668 → 300,490 of 330,000); no ceiling raised.
  > The task's brief quoted 6,510 B of headroom; the measured figure before this change is
  > **6,719**, which is what v1.123.0's own closing note recorded. Both endpoints above come from
  > this machine so the delta is internally consistent either way.
  Comments are stripped by the build, so the documentation above the constant is free — only the
  copy and the code are on the bill, which is why the copy was tightened once and re-measured.
- **Built FROM the wire, never from a hardcoded three.** `evLam` is the preset list (emitter point
  4: "the app reads which lambdas exist"), so a two-block wire renders two buttons, an unknown λ
  renders under a plain description rather than being hidden, and a wire with **no** table renders
  **no row at all** — a control over a table the app does not have is a control over nothing.
- **NEVER the word "lambda" on this surface** (nor EV / MDP / utility / "optimization"). The axis a
  white belt has is sport ↔ self-defence, and the copy is checked for jargon on the VISIBLE text
  with word boundaries — a raw-innerHTML check for "EV" hits `class="paceVal"` and reports a leak
  that is not on screen.

<a id="v1-123-0-what-it-can-and-cannot-reach-and-the-str"></a>

## v1.123.0 — WHAT IT CAN AND CANNOT REACH — and the strongest guarantee is a gift from v1.123.0

_Originally CLAUDE.md L2457._

**WHAT IT CAN AND CANNOT REACH — and the strongest guarantee is a gift from v1.123.0.**
Measured over all 272 role-hands, in the browser (`e2e/journeys/loss-aversion.spec.ts`) and offline
(`tests/artifacts/_lambda_probe.py`):

| | |
|---|---|
| hands where the dealt **SET** differs across λ∈{1,2,4} | **0 of 272** |
| hands where the **ORDER** differs | **29** |
| hands where the **TOP CARD** differs | **7** |
| cards whose **odds** move | **0** |

**The dial cannot change WHICH moves you are offered.** Uncapping the hand removed the truncation a
re-ranking used to reach through, so a re-order can no longer add or withhold a card — and because
the option COUNT is fixed, it cannot move the decision clock either (`dsec` is a function of `n`).
Before v1.123.0 this control would have changed the action space; today it changes only the reading
order. It touches nothing earned: belt score, SRS, stage, prep, challenge evidence, badges, coins,
units and the persisted blob are byte-identical across a flip (only `settings.lossAversion`, its
per-key LWW stamp and the blob's own `updatedAt` move, which is what "persisted" means).
- **It emits NO `fx()` beat.** `fx` is the challenge-evidence seam, so a settings click that emitted
  one would be a way to farm objectives. `track("neural_loss_aversion_set")` is analytics, which is
  allowed to know. **The journey drives the real BUTTON, not `set()`** — mutant L7 (an `fx()` added
  to the button's own onClick) SURVIVED the version of that test that poked the key directly, because
  the handler never ran.
- **THE ORDER IS FROZEN AT DEAL TIME, and the freeze is stronger than sort order.** `_evLamIdx()` is
  read ONCE per deal, in `_evRowsFor`, whose closure captures `k` and stamps that block's own
  `e0`/`c1` onto every opt. So flipping the dial mid-hand moves neither a position nor a printed
  NUMBER in the tray a player is already reaching into; it lands on the next landing. Same rule as
  the JIT-grade freeze in `optionsFor`.
- **`replay-digest` is UNCHANGED (`0390cc44ee7f40e5`) and that is not the evidence.** The default is
  λ=2 and no digest spec writes `lossAversion`, so the digest is STRUCTURALLY unable to see this
  change — exactly the v1.122.0 situation. What it confirms is the absence of an accidental side
  effect. The 272-hand walk is the evidence.
- Pinned by **`e2e/journeys/loss-aversion.spec.ts`** (6 journeys, 4 `@curated`), mutation-tested by
  `tests/artifacts/_lossaversion_mutants.sh`: **eight mutants, eight kills**.

**THE OWNER'S FALSIFIABLE PREDICTION, ANSWERED ON THE SHIPPED BUILD — IT DOES NOT REPRODUCE.**
*"in self-defence … they prioritize mount over side control because it's more for the street."*
Measured through the app's own `optionsFor` + `moveEdge`, over every hand offering a move into BOTH:

| preset | hands where mount's best EDGE beats side control's best | `Side Control to Mount` in its own 25-card hand |
|---|---|---|
| Sport (λ=1) | **4 / 17** | rank **20**, EDGE **−1** |
| Slightly cautious (λ=2) | **4 / 17** | rank **23**, EDGE **−2** |
| Self-defence (λ=4) | **3 / 17** | rank **23**, EDGE **−2** |

Mount never wins the majority at any preset, and self-defence makes it **worse, not better** — both
in the head-to-head (4 → 3) and at the one instance everybody would name. The offline solve agrees
by an independent path (6/21 → 5/21 at λ=4, `Side Control to Mount` rank **21 of 25 at every λ**
with EDGE sliding −1 → −5 as λ rises to 8; the app sees 17 hands rather than 21 because it counts
only what a player is actually DEALT and can value).
- **Why, and it is not a bug.** (a) EDGE is relative to `B(s)`, and `Side Control to Mount` carries
  **23% of the attempt mass at that state** — it is most of the baseline it is being measured
  against. (b) Loss aversion makes *terminal wins* relatively more valuable, and side control top
  puts **49% of its no-gi attempt mass on 16 submissions**; measured, mean EDGE(submission) −
  mean EDGE(transition) widens **2.62 → 3.68 → 5.88** as λ goes 1 → 2 → 4. So raising λ promotes
  finishes over positional advances — including the advance into mount.
- **The honest reason the prediction cannot reproduce here: the model has no strikes.** Mount beats
  side control on the street because mount lets you strike and denies theirs. This graph models
  submission-only grappling, so that consideration is not merely mis-weighted — it is **absent from
  the state space**. λ cannot express it. What DOES agree with the owner is the position ranking
  itself: `V(mount/top) > V(side-control/top)` at every λ, and the gap **widens with loss aversion**
  (+0.0053 at λ=0.5 → +0.0095 at λ=2 → +0.0257 at λ=8).
- Reproduce: `python3 tests/artifacts/_lambda_probe.py` (offline, 8 λ values) and the console line
  the spec's last journey prints on every run.

**ALSO NOT BUILT** from the spec, so nobody hunts for it: the primary/tail band (`EDGE ≤ −3` →
"rarely the right call"), the live-band decision clock, the sheet's `WHAT IT'S WORTH` block and the
legend line. Two entries LEFT this list in v1.123.0: the hand is **no longer capped** (see below),
and "un-hiding `.ng-seemore` on mobile" is now a DECISION rather than a gap — it stays hidden on
small screens, by the owner's instruction, under a rule that finally covers the device they were
looking at.

**Reproduce any of it** — `python3 scripts/solve_edge_values.py` (report), `--verify` (measured vs
the spec's published headlines, side by side), `--mutants` (the mirror invariant + the five
load-bearing model rules, each reverted so you can see which checks move and which — deliberately —
do not), `--hand side-control/bottom` (the seven-card table this feature is sold on),
`--lam/--horizon/--frame`.

<a id="v1-125-0-the-graph-s-position-colours-were-top-re"></a>

## v1.125.0 — THE GRAPH'S POSITION COLOURS WERE TOP-RELATIVE — RE-MEASURED, AND v1.125.0 ANSWERED MOST OF IT

> **Status:** Current - the derived pair is the default; `?dual=legacy` is the only escape hatch.

_Originally CLAUDE.md L2535._

**THE GRAPH'S POSITION COLOURS WERE TOP-RELATIVE — RE-MEASURED, AND v1.125.0 ANSWERED MOST OF IT (v1.127.1).** As written since v1.104.3: `ingest` bakes `dom = n.s[0]`, for a POSITION `s[0]` is the TOP player's value, so while you play bottom the canvas paints them from your opponent's point of view under a palette whose stated meaning is "blue = good for you, red = good for the opponent" (`domColor`, and that IS how `myColor` uses it). Examples: `Side Control Top` `[+0.328, −0.712]`, `Reverse Mount Top` `[+0.380, −0.420]`. **Both of its numbers were stale, and the premise under them had moved.** Reproduce with `node tests/artifacts/_position_color_probe.mjs` (it walks the default path AND `?dual=legacy` in one session).
- **THE CONTENT FIGURE IS 115 OF 136 (85%), NOT 85 OF 136 (62%).** The definition, stated so it is reproducible: a position hub whose `s = [top, bottom]` slots are **STRICTLY opposite in sign** (`s[0]*s[1] < 0`), over the 136 position hubs of `graph-data.json` — identical to `graph.json`'s `<hub>/top` and `<hub>/bottom` `strength` (verified 136 of 136 matched, 0 value mismatches). **No magnitude threshold reproduces 85**: `≥0.01 → 110`, `≥0.02 → 100`, `≥0.05 → 81`, `≥0.10 → 53`, `≥0.20 → 31`. The line was never exactly right — walking `graph.json` at each tagged commit, it read **84** on the day it was written (v1.104.2 *and* v1.104.3) — and the **content calibration wave** moved it: 86 at v1.106.2, **113 at v1.106.3** (`the leading word decides`, the `position_type` parser fix), **115 at v1.106.4**, and 115 at every version since. That is the v1.103.0 rule doing exactly what it says — *the authored word sets the SIGN* — so more authored words being read correctly means more opposite-sign pairs.
- **THE RENDER PREMISE MOVED AT v1.125.0, AND THE DEFAULT PATH NO LONGER HAS THE DEFECT.** `_deriveDualPairs` splits every position hub into a `top` and a `bottom` member and stamps each with **`sv` = ITS OWN side's value**, which `ingest` prefers over `s[0]`. Measured in a real browser at HEAD: **272 drawn position orbs, 272 painted with their own side's value, 0 with the other side's**; playing bottom, **0 of 136** bottom orbs wear the opponent's colour. The defect survives ONLY behind **`?dual=legacy`**, the one flag that skips the derivation: there the 136 hubs are drawn once and, playing bottom, **132 of 136 wear a colour that is not the player's own value** — **115** of them a SIGN flip (the red↔blue inversion this disclosure is about), 17 a shade difference at the same sign, and 4 identical because both slots agree (Standing, Clinch, Leg Entanglement, Dogfight — the neutral positions, as they should be).
- **RED-PROVEN, one line**: delete the `sv` preference from ingest's `dom` and rebuild, and the DEFAULT path reports own-side **272 → 140** (the 136 top orbs plus those 4 neutrals) and bottom-cross-painted **0 → 132**, landing exactly on the legacy figure. Restored; rebuilt bundle byte-identical (md5 `00813c07…`).
- **What is left for the owner is smaller than it was**: whether `?dual=legacy` keeps a palette we now know is wrong, and whether "the side this orb represents" is the right MEANING for a pair member's colour at all — it is no longer "good for YOU", it is "good for THAT side", which is a different sentence from the one `domColor`'s palette advertises. `myColor(n)` is still the role-correct read for anything that must speak in the player's frame.

<a id="v1-104-2-landing-card-chrome-four-owner-reports"></a>

## v1.104.2 — LANDING-CARD CHROME, FOUR OWNER REPORTS

_Originally CLAUDE.md L2541._

**LANDING-CARD CHROME, FOUR OWNER REPORTS (v1.104.2).** Pinned by `e2e/journeys/landcard-chrome.spec.ts` (4 journeys, 2 `@curated`, `test.use` 390x844 — three of the four only bite on the phone).
- **`style.color = ""` DELETES, it does not restore.** After `More → Less` the toggle went black on a #131625 card. `expandLandCard` restored it with the empty string, which removes the inline declaration written by the button's own `cssText`; the collapsed button then inherited from a parent that sets no colour and fell back to the UA default. The resting colour is now the shared constant **`NG_LAND_MORE_COL`** so the two sites that write it cannot drift again. General rule: to return an element to a colour declared inline, WRITE it — clearing only works when the resting value comes from a stylesheet.
- **A 44px thumb target must not set a 24px row's geometry.** The corner (`[data-land-corner]`) holds a 44px capture control (a `+` then, a ★ since v1.129.8) beside a 24px ✕; under `align-items:center` the row became 44 tall, so both glyphs sat 10px below the inset and 20px apart — the owner asked for them "a bit closer and a bit closer to the top (symmetric to how the x close button is close to the right edge)". A `-10px` margin shrinks its LAYOUT box to 24×24 while it still renders and still takes a thumb at 44 (the `.ng-lists-new` pattern). Inset is 5px on both axes, gap 2px, and the spec asserts `xFromTop === xFromRight`, one shared glyph baseline, a 44px hit area, the star's own **14px** box (v1.129.8 — see THE CAPTURE STAR: `font-size` is inert under an SVG and this corner used to be one of the three sites that set it), AND — because that box overhangs the ✕ by 8px — that `elementFromPoint` at each control's centre still returns that control.
- **The film strip takes its width from the card, MEASURED.** `.ng-landfilm` duplicated the card's DESKTOP rule as a constant, and the card has a mobile override (`width:calc(100vw - 20px)!important; padding:11px 12px`) it never knew about: at 390x844 the boxes measured `[16,374]` against `[10,380]`. `_dockLandFilm` now copies the card's measured width AND its horizontal padding (the padding is what lines the THUMBNAILS up with the text above them), so they agree at every viewport by construction. The cssText width is a first-frame guess only.
- **The clip hover is a hint, not a flash.** It zoomed the still 5% over 400ms and flipped the play glyph to **brand red** at 108% — the loudest signal a hover can make, on a strip sitting directly above the question being read. Now a 2% zoom over 180ms and a slightly more solid disc. The click-to-expand morph is untouched (signed off in v1.102.1).

<a id="v1-104-1-one-subject-per-label-the-announcer-name"></a>

## v1.104.1 — ONE SUBJECT PER LABEL: THE ANNOUNCER NAMES THE ACTOR, THE GRAPH NAMES YOUR POSTURE

_Originally CLAUDE.md L2547._

**ONE SUBJECT PER LABEL: THE ANNOUNCER NAMES THE ACTOR, THE GRAPH NAMES YOUR POSTURE (v1.104.1).** The owner, mid-roll: the announce block read **"OPPONENT DEFENDS Crucifix Maintenance"** while the graph read **"DEFENDING Crucifix Maintenance"** — "wtf is this incoherence? also seems to me like opponent tried to go for crucifix and we're defending right?" Right on every count. Two labels described one event with two different subjects, and three things were wrong:
- `setEvent`'s opponent copy was chosen by **`performerRole(...) === "top"`** — a TOP/BOTTOM test standing in for an OFFENCE/DEFENCE one, the same defect class as roleIdx-vs-valIdx (v1.103.0). In BJJ the dominance axis is not top/bottom, so a bottom-authored attack (the reported crucifix) announced itself as the opponent *defending*. Naming the ACTOR needs no such guess, so the test is deleted rather than repaired.
- The two opponent branches used **opposite graph verbs** — a submission attempt set `activeMove.verb = "Attacking"` (whose subject is the opponent) while a positional move set `"Defending"` (whose subject is you). One actor, two subjects, in the same code path.
- The player's own copy was two strings (`"Going for the submission"` / `"Attempting the transition"`) that never matched the opponent's shape, so the two sides could not be read as one exchange.

The rule now, owner's words: **"announce opponent goes for X (graph shows defending X), or announce you go for Y (graph shows attacking Y)"** — the announcer names **who is initiating**, the graph verb names **your posture toward that move**. They can never contradict because they no longer answer the same question. Pinned by `e2e/journeys/announcer-coherence.spec.ts` (3 journeys, 2 `@curated`), including one that walks repeated opponent turns and fails if ANY branch claims you are attacking.

<a id="v1-104-0-the-first-roll-coach-is-deleted"></a>

## v1.104.0 — THE FIRST-ROLL COACH IS DELETED

> **Status:** Current - the first-roll coach is deleted and must not return.

_Originally CLAUDE.md L2554._

**THE FIRST-ROLL COACH IS DELETED (v1.104.0, owner).** A 3-panel card at top-centre (`.ng-coach`, z:70, `top:92px`) that opened over the first-ever landing and froze the decision clock. The owner, meeting it: it "shows on top and is really nasty, grabbing the attention", and panel 1 said "these cards are your options from this position" while being a FIXED overlay anchored to nothing — panel 2 ("Peek before you leap") read as being about the film-study Shorts. On a screen already carrying a graph, a landing card, a question and a hand, a floating explainer of that hand is one more thing to read, in the worst place, at the worst moment.
- **Its one factual claim was TRUE and was measured on the way out:** the clock really was frozen — `_decision.remaining` unchanged at 13,800ms across 12 simulated seconds, all seven `.ngbar` countdowns `paused`, no auto-pick, resuming on dismiss. `_tickDecision` still freezes for `_checkpoint` (same rule, same reason), pinned by `e2e/gen/mid-checkpoint-quiz-untimed.spec.ts`.
- **The three White objectives were RE-KEYED, not deleted** — White stays at 20. `white.coach1` "Read your hand" → **`options_dealt`**, `white.coach2` "Preview a move" → **`sheet_opened`**, `white.coach3` "Read a landing question" → **`land_q_shown`**. Each now measures the action it is NAMED for, and coach2 got strictly harder: it needs a move sheet actually opened, where the coach ticked it for pressing Next on a tooltip. The `legacyId`s (`coach1/2/3`) and the `bjj-neural-coached` → `tut.done` migration stay, so already-coached users keep their history.
- **Gone with it:** `maybeStartCoach`/`advanceCoach`/`dismissCoach`/`finishCoach`/`renderCoach`, the `.ng-coach` CSS, the `_coach` guards in `_tickDecision` and `renderTutorial`, the funnel's `coach_seen`/`coach_finished` side marks and its `coach_open` property, 11 `e2e/gen/onboard-coach-*` specs (+ their ledger rows), and `dsl.ts`'s auto-dismiss (`land()`'s `keepCoach` is now accepted-and-ignored). `bjj-neural-coached` has **no writer** any more — `_returningVisitor()` still reads it for pre-v1.104 users but the live marker is `bjj-neural-firstroll`.
- **DISCLOSED, not fixed:** `_setBarsPaused` went with the coach, and it was the ONLY thing that ever froze the CSS countdown bars. Those run on wall clock, so during a checkpoint quiz or a paused pane they keep draining while the clock is stopped — a pre-existing desync the coach happened to be immune to.

<a id="v1-82-3-first-impression"></a>

## v1.82.3 — FIRST IMPRESSION

> **Status:** Still current for the weighted draw. The role-naming half was extended by v1.129.1 (`graphName`).

_Originally CLAUDE.md L2560._

**FIRST IMPRESSION (v1.82.3).** Two rules about the opening screen, both gated by `e2e/journeys/first-impression.spec.ts`.
- **A fresh profile's first-ever roll is drawn from REAL TRAFFIC, not uniformly.** `startPosTraffic()` sums `curriculum.weights` (the stationary distribution Game Knowledge already uses) per position through each technique's single canonical origin (`fromPositionId` → `_posSlugIndex`), giving 136 entries summing to 1. `_weightedStart(pool, u)` inverse-CDF-samples `w^START_BIAS.gamma` (1.5) mixed with `START_BIAS.floor` (2%) uniform. Effect: the six hubs a beginner can name go from **4.4% → ~66%** of first impressions, ~17 states stay genuinely likely, and **all 136 keep a real chance — the draw is biased, never narrowed**. It replaced a `withDeck` filter that was a **no-op** (all 136 carry a deck). ONE draw off the SAME `rng("start-pos")` tag, so rigged replays are structurally untouched; a **returning** profile keeps the historical uniform mapping exactly (`_returningVisitor()` — one latched definition, shared with the cold-start funnel's `cold` flag, marker `bjj-neural-firstroll`).
- **The card names ONE side, and it is `playerRole`.** All 136 position hub titles in `graph-data.json` end in "… Top" (the visual layer collapses Top/Bottom into one node), so the raw title is not a role claim. `renderLandCard` shows `posFamily(node.t)` for positions; `roleTxt` is the only place a side is named. **Do not "derive the role from the node title"** the way `rollFromPosition()` does — that derivation is a constant (`top`) across the whole pool, which is why every staged/roamed roll deals a top hand and why `playFrom(idx, role)` has to set the role itself.

<a id="v1-114-0-zoom-is-a-camera-and-the-arrival-is-the"></a>

## v1.114.0 — ZOOM IS A CAMERA, AND THE ARRIVAL IS THE EVENT

_Originally CLAUDE.md L2564._

**ZOOM IS A CAMERA, AND THE ARRIVAL IS THE EVENT (v1.114.0).** Two owner reports, one surface.
*"When we go to a node there's this bigger, wider circle that appears, and it's blooming, beaming.
I don't like that very much. I'd rather have the pulse signal, the white node that goes from one
node to another — when it arrives at its final node its bloom should grow a little bit more, like
50% or even 100% more. A bigger, wider circle shouldn't appear on its back anymore. That used to be
the motivation for content to appear inside it. Now we don't want content to appear inside any
node… the label, which consists of the role and the technique name, should appear to the right of
it. That's the winner design for labelling these nodes, even when we zoom in or zoom out."* And:
*"When we're zooming in we want to see other nodes that are around it. We don't want more detail on
a node. To see details on a node we click on it. We don't zoom in anymore."*
- **THE WIDE CIRCLE WAS TWO PASSES, AND ONE OF THEM WAS A SCALING BUG.** v1.113.1 made every orb
  `n.r * nodeK` (nodeK = **0.4** at roll zoom) and the current-position marker was never told — so
  its "1.28x" fill was **3.2x** the node it marks and its "2.9x" ring **7.25x**, a circle seven
  times the node. The second was the **sustained halo**: a breathing radial gradient with a 46px
  screen floor reaching ~11x the drawn radius, lit for the whole roll. Both are deleted. The steady
  state is a MARK — the node's own silhouette in your perspective colour at the AUTHORED `1.28`
  ratio, now correctly scaled (`n.r * nodeK * 1.28`), with a 1.8px rim — and `_haloK`/`_haloT`
  are gone. The ratio was never the bug; `nodeK` missing from it was.
- **THE BLOOM MOVED TO THE ARRIVAL.** `flare(idx, amp)` stores `litK`; the flare pass scales its
  gradient radius and its white core by it, and inherits the deleted halo's screen-size floor so it
  still reads at roll zoom. `ARRIVE_BLOOM = 2` (the owner's "100% more") is spent where the roll
  **stops**: `enterLand` and a submission finish. Deliberately NOT at the end of a travel path — a
  move is two travels (`[here, technique]`, then `[technique, outcome]`), so "last node of the
  path" is the TECHNIQUE half the time (measured: "Sweep from Meathook" bloomed as hard as the
  position it swept you into). `enterLand`'s re-flare must carry the amplitude or it demotes the
  destination one frame after `updateTravel` set it.
- **NOTHING IS WRITTEN INSIDE A NODE.** The ~68-line in-node pass (dark plate, stroked outline,
  800-weight kicker, wrapped name at `rs * 0.24`) is deleted, and with it the last draw-loop
  consumer of `_nodeCardOn`. Zoom changes how many nodes you can see, never what a node says.
- **ONE LABELLING DESIGN, AT EVERY ZOOM.** `richLabel` — role over name, beside the node — was
  suppressed above 20px because the in-node pass took over there; the suppression is gone from all
  four label sites. The focus carries `<CATEGORY> · <ROLE>` over `posFamily`/`displayName`
  unconditionally, so v1.101.0's promise that "the graph names the state" (which is why the landing
  card has no header) still holds — it is now named BESIDE the node instead of inside it.
- **`halfW(n)` is how far right a node's silhouette actually reaches.** Every label anchored on
  `n.r * scale`, which stopped being the drawn radius twice over: `nodeK`, the mitosis LOD's
  interpolated representative radius, and `shapePath` widening a triangle to 1.242r / a diamond to
  1.18r. Now that the label IS the naming design it has to sit against the edge it names.
- The wheel's second zoom floor (`_dossierIdx != null ? 0.0075 : 0.006`) is gone — dead since
  v1.101.0, and reading a node by zooming into it is exactly what this retires.
- **Gated by `e2e/journeys/graph-naming.spec.ts` (3 journeys, 1 `@curated`), which reads the CANVAS
  BACK** — these are claims about what the renderer painted, and every state variable involved
  could be right while `draw()` still put a name or a ring on screen. **Five mutants had to die to
  get the statistic right**, and the two that survived early versions are the lesson: a sparse ring
  of sample points measured the empty space either side of the ring it was hunting, and a dense
  radial profile scored by *angular coverage* still passed, because the dealt hand's option nodes
  genuinely encircle the state you stand in (82% of wedges at r=7.7x) so coverage was already
  saturated where the ring lives. What works is a **control frame** (`focusIdx = -1`, same camera,
  same neighbours) plus a **per-sector luminance delta**: everything the graph would draw anyway
  subtracts to zero, a ring or halo raises every wedge's median, and the edges the focus
  legitimately lights are spokes the median ignores. It self-checks on the mark itself, so a
  sampler that has stopped seeing anything fails instead of passing.

**...AND THE ARRIVAL NEEDS SOMEWHERE TO LAND (v1.114.1).** v1.114.0 deleted the sustained halo
correctly and then put NOTHING in its place, which the owner met immediately: *"the highlights of
the current node don't seem to be happening anymore ... there seems to be no highlight at all now.
That pulse, that I appreciated so much, when it reaches the correct node, it disappears, and it
becomes stale."* Measured at roll zoom, per phase, light reach around the current node (orb radius
33px settled / 21px mid-flight):

| phase | before v1.114.1 |
|---|---|
| settled, before a move | core 131, reach **53px** — the orb and nothing else |
| travelling (4.2s) | core 113, reach **53px** — inert |
| arrival, 1.9s | core **255**, reach **~152px** — the bloom was working all along |
| after 1.9s, rest of the turn | core 133, reach **30px** vs a 21px orb — dead |

So the bloom was never the problem; the CLIFF at 1.9s was, and so was having no resting state.
- **`REST_GLOW = 0.42`** — the presence WITHOUT the beam. It hugs the orb at **2.6x** where the
  retired halo reached ~11x, carries about a third of its alpha, breathes slowly instead of
  beaming, and **drains into the pulse on departure** exactly as the halo did (which is what
  covers the marker's own cut at `!this.pulse`). It is additive with the arrival bloom, so the
  bloom now decays INTO it rather than to zero — no cliff, no stale state. Settled reach went
  53px → 84px; post-bloom 30px → 44px.
- **The rim was invisible** because it was stroked in the same colour as the fill it outlines. It
  is now lightened 55% toward white, which is what makes the orb read as *selected* at a glance.
- **The gate pins BOTH bounds** (`graph-naming.spec.ts`): a FLOOR — the resting glow must be
  there — and the CEILING from v1.114.0. Two traps found while building the floor, both worth
  keeping in mind for any future canvas assertion: (1) `parkOn` pauses, and **`this.now` IS the
  game clock**, so a paused roll freezes `age = now - lit` and leaves the node stuck mid-bloom —
  the first floor passed against a build with the glow deleted, on the frozen arrival flare. The
  test now ages `lit` out explicitly and asserts it did. (2) A floor band starting at 1.2x measured
  the **marker's own 2px rim's antialiasing** (19.6 luminance with the glow deleted), not any
  glow; it starts at 1.8x, clear of the mark.

<a id="v1-114-1-one-clock-the-countdown-bar-cannot-disag"></a>

## v1.114.1 — ONE CLOCK — the countdown bar cannot disagree with the number it draws

_Originally CLAUDE.md L2649._

**ONE CLOCK — the countdown bar cannot disagree with the number it draws (v1.114.1).** Owner, same
pass: *"for the current node, there's very little time for it to be answered."* The window is NOT
short — measured **16.2s** (`decisionSec` 9s base, settable in Settings → Rolling, plus 0.8s per
extra option) — and `setPaused` already froze the bars with the clock, so opening a card to read it
was never the divergence. **A REFUND was.** `refundDecision(2500)` (a correct landing answer, twice
at most) adds up to 5s to `d.remaining`, and the bar was a fixed-duration CSS animation
(`ngCount <dsec>s`) that could not know — so after answering correctly the bar under-reported by up
to **31%** and the hand looked about to expire with a third of its time left. `_tickDecision` now
writes `scaleX(remaining/total)` on the cached `.ngbar`s, so pauses freeze them by construction and
a refund visibly grows them BACK, which is the honest feedback for having bought time. The
`.ngbar` branch of `setPaused` is deleted (there is no animation left to pause) and `@keyframes
ngCount` has no consumer in the app.

<a id="v1-101-0-one-container-the-game-s-own-card"></a>

## v1.101.0 — ONE CONTAINER: THE GAME'S OWN CARD

> **Status:** Partly superseded by v1.101.1/v1.101.5 and by v1.114.0 - the landing card lost its header, and nothing is drawn inside a node.

_Originally CLAUDE.md L2662._

**ONE CONTAINER: THE GAME'S OWN CARD (v1.101.0).** v1.100.0 made the node itself the dossier —
`openDossier` flew the camera into the node and mounted the whole reading surface inside its shape.
The owner retired it after living with it: *"the other fuller container should no longer show, and
instead the normal game container should be the default. upon clicking more all of the other
sections that were present in the fuller container would show there now."* The in-node renderer,
its shell/clip geometry and its own question are **deleted** (162 lines); `updateNodeCard()` remains
only as the one place that guarantees the element stays down, because `draw()` calls it every frame
and a stale `_nodeCardOn` would keep the tray faded and the canvas glyph crossfaded out.
- **The roll settles ON the node.** `ROLL_ZOOM = 0.085` of `graphW` — a tenth of the deepest read
  zoom (`graphW * 0.0085`), which is the owner's "zoomed in but like 1/10th of the max zoom". Travel
  (`pulse`) still pulls back so a move reads as a move. The old `graphR * 0.7` floor is gone from the
  settled case: it is a whole-graph measure that dominated the number beside it, so leaving it in
  would have made `ROLL_ZOOM` change nothing.
- **...and UP, into the only clear band on the screen.** Measured at 1440x900: the focus node sat at
  y=450 with the landing card occupying y=362..900 — the state you are playing was BEHIND the card
  that talks about it, at every zoom. `lift = 0.34 * H * vw / W` parks it at ~16% of viewport height.
  The desktop card's ceiling moved with it (`max-height: min(420px,50vh)`) so all four options
  clear the sticky footer. **The PHONE override stays at 34vh** — 40vh was tried and reverted: on a
  390x844 screen it pushed the card's top edge from y=351 to y=301 and swallowed the band the graph
  is panned in, which `share-camera`'s pan journey caught (measured: `elementFromPoint` at the pan
  origin returned `DIV.ng-landcard`, the drag never reached the canvas, and the focus lease it
  exists to release survived).
- **The graph names the state, so the card stopped repeating it.** Owner, on a landing at The Chill
  Dog: *«the "The Chill Dog" and "Bottom" is repeated info»*. The kicker carries the ROLE for the
  current node (`POSITION · TOP`) and the name uses `posFamily()` for positions (every hub is titled
  "… Top" in `graph-data.json` — a reading artifact that would contradict a "· BOTTOM" kicker).
  **SUPERSEDED IN PART BY v1.114.0:** the promise holds, but the graph names the state BESIDE the
  node, not inside it — the in-node text pass is deleted and the focus's rich label, which used to
  be suppressed above 20px to avoid printing the name twice, is now unconditional. See ZOOM IS A
  CAMERA above.
  **A LANDING CARD HAS NO HEADER AT ALL (v1.101.1)** — v1.101.0 left a thin "from <previous>" line
  with the counter opposite it, and the owner's read on that leftover was that the chip "should
  show bottom right same row as More instead of top right in its own row" and the block it sat in
  "shouldn't show". So the card opens on its content, and its three controls live where controls
  belong: `More ▸` at the foot-left, the familiarity chip and the capture control at the foot-right
  (it keeps its 24/44px hit area and loses its box), and a 22px `[data-land-close]` **✕
  absolutely positioned top-right**, so the way out costs the card no vertical space. Dismissing
  clears the card for that landing only — the next one renders fresh, and `_landBackfill` returns
  early on a null `_landEl`, so no late payload can resurrect it. An ATTEMPT card keeps its
  headline, because it names the technique the question is about and the graph only labels that one
  while the sweep animates.
- **THE FILM STRIP IS ITS OWN SURFACE (v1.101.1).** Owner: "place the film study row aka the videos
  outside the ng-landcard ... immediately above it". `.ng-landfilm` / `[data-land-film]` is a fixed
  sibling on the root plane, docked by `_dockLandFilm()` to the card's measured top and anchored by
  its BOTTOM — so when a clip expands the strip grows UPWARD into empty screen instead of being
  clipped inside a `max-height` scrollport, which is also what lands a playing clip top-centre. It
  is cleared, suppressed and re-docked with the card (`clearLandCard`, `_suppressLand`,
  `_dockLandCard`), and `collapseClip` re-docks on the way back down.
- **A PLAYING CLIP HAS TWO WAYS OUT (v1.101.1).** A `.ngClipX` ✕ top-right of the player, and a
  capture-phase `pointerdown` outside it — registered during the click that expanded it, which has
  already dispatched, so it cannot close what it just opened. Both end in `collapseClip`.
- **THE CARD'S TWO CORNER CONTROLS (v1.101.1).** Owner: "the + should only show top right next of
  the x close icon". Capture and dismiss are the same kind of thing — chrome about the card as a
  whole — so `[data-land-corner]` holds both, absolutely positioned, costing the card no vertical
  space. The QUESTION LINE carries `padding-right:54px` to clear them — not the `[data-land-q]` block,
  which also holds the four answers: they start below the corner, have nothing to clear, and
  are `white-space:nowrap` + ellipsis, so insetting them spent 54px of answer text (v1.101.3).
  The block also has no top border or margin: with the header gone and film lifted out, it
  divided the card from nothing.
- **AN OPTION CARD IS A CHOICE, NOT A DOSSIER (v1.101.1).** The `from <origin>` line, the
  `→ <destination>` line and the per-card `+` are gone (owner: "it can be removed to make for
  smaller option cards ... the + on those small options cards can also be removed"). `from X` is the
  same word on every card in a hand — they all share the state you are standing in — and where a
  move LEADS is what the option-detail sheet is for. Capture stays on the surfaces you opened to
  read (the sheet, the landing card's corner), not eight times over a running clock. An ESCAPE hand
  keeps its "escape route" line, which is not a restatement.
- **HORIZONTALLY THE NODE IS CENTRE, BIASED LEFT (v1.101.1).** The follow-cam parked the focus 156px
  RIGHT of centre to clear the left pane — but the pane is manual-only and shut for almost the whole
  roll, so that cost was permanent and its reason was rare. Owner: "the selected node should also be
  center middle, or even center left (as text on it reads left to right) but usually it's just
  center right (which causes text to be mostly displayed on the right, sometimes cutoff)". Every
  name hanging off a node runs left-to-right FROM it, so the room a node needs is on its right:
  `offset = -0.06 * vw` parks it at ~44% of the width.
- **`More ▸` unfolds the card in place** (`expandLandCard`, `[data-land-more-body]`, aria-expanded +
  a rotating chevron, label flips to `Less`). It carries what the retired container carried —
  Essential principles, Where it leads, What beats it, Attacks from here — built lazily on first open,
  and never silently empty (`[data-land-more-empty]`). Unfolding **auto-pauses on its own latch**
  (`_landAutoPaused`), so folding can only give back a clock it took; a hand-paused roll stays paused.
  An unfolded card **survives a payload backfill** (`_landOpen`), and a NEW landing starts folded.
- **Film rides the game card, compactly and unlabelled.** `filmStudyHTML(clips, compact)` — the full
  strip is ~210px under a 20px-margined header, which pushed the question below the fold of a 420px
  card and under the sticky footer. Same row, same wiring, same expand-to-play, roughly half the
  height, and **no "FILM STUDY" caption** (owner: "unnecessary" — a row of thumbnails with play
  buttons on them does not need to be told what it is). The reading sheet keeps its heading, because
  there it sits among other headed sections.
- **The one-line definition moved behind `More`.** Owner, reading "Master Deep Half Guard Top with
  defensive counters, pressure maintenance, and systematic passing strategies" above their hand:
  "unnecessary — please remove those, or push the intro if SEO needs it to the content after
  clicking More". It is marketing prose written for the static page; the roll wants film and a
  question. `[data-land-def]` still exists, one fold lower, in `_landMore` — deleting it outright
  would lose copy the static article actually earns with.
- **A node you are NOT standing on opens the reading SHEET**, on every form factor (a top sheet on a
  phone, a right-docked column on desktop) — and it now renders `[data-node-q]` on desktop too, which
  was mobile-only while the desktop read happened inside the node. `dossierRef` is deliberately NOT
  used: it is a child of the explorer pane, which pane law says only the user may open. The camera
  flies TO the node at `ROLL_ZOOM`, not INTO it at `0.0085`.
- **THE READING SHEET IS RETIRED TOO — ONE SURFACE, BOTH FORM FACTORS (v1.101.5).** v1.101.0 sent
  the state you are STANDING IN to the game card but left every other node opening a right-docked
  sheet. Owner, looking at that sheet over their own position: *"when i click on a node in the
  graph, [it] shouldnt appear anymore, the node dialog we just practiced now should show instead"*.
  `openDossier` now has three branches and none of them is a second surface:
  a **technique** renders the game card in `"attempt"` mode (it names the technique and its `+`
  captures THAT technique — staging would hop to its origin position, since `rollFromPosition`
  does that on purpose, and the corner capture would then file a position the coach never tapped);
  **another position** stages the roll there (fly, land, deal, clock held); **your own node**
  rebuilds its card if it was dismissed. All three unfold — you opened it to read it — carried
  through the staged landing by the one-shot `_landOpenNext`, because that card is built later,
  when the flight lands. **The `_landEl` guard used to sit on the first branch, and that is how a
  sheet appeared over "Your current position" at all:** the ✕ (v1.101.1) nulls `_landEl`, so the
  next click on your own node fell straight through. A dismissed card is a card to REBUILD.
  DEAD NOW, disclosed rather than deleted at the end of a long pass: `renderDossier`, the
  `dossierSheetRef` element, `_renderNodeQuestion` / `nodeQuestionFor` / `askFormat` and the
  `data-list-surface="dossier"` capture are unreachable from the app (only `first-impression`
  calls `renderDossier` directly). Deleting them removes the **stage-3 recall** question that
  surface carried, which needs a home on the game card first.
- **THE OPTION-DETAIL SHEET GETS ITS DESIGN PASS (v1.102.1).** Owner, opening a technique from the
  hand: "it's very ugly! this should rather match the same design as in small, except with more
  detail but very properly well designed, right now it looks just like a prototype". Four things
  were wrong and all four were measurable:
  · **Prose collapsed into a wall.** Authored copy carries real paragraph breaks — **939 of the 997**
    entries that have both a summary and a context do (94%) — and dropping it into `innerHTML`
    collapsed every one, so three paragraphs arrived as one run-on with sentences colliding at the
    joins ("…over the shoulder.Strategically, the Triangle from Back is…"). `proseHTML()` splits on
    newlines and emits real `<p>`s. That single missing split was most of the "prototype" feel.
  · **The overview printed TWICE.** `rc.context` is a near-duplicate of the attacker summary —
    **205 of 997 (21%)** are >80% the same text, and for the reported node it was 92.2% similar with
    a 1,534-character identical run. `_echoesSummary()` suppresses the tail when it merely repeats
    what is already at the top. The static page keeps its copy either way; this is the app surface.
  · **The head is now the OPTION CARD, enlarged** — the card's exact three-part anatomy (glyph +
    CATEGORY with the potential opposite it, the name, then a bordered success row), so the card you
    pressed grows into this instead of becoming a different object. Owner: "improve visual continuity
    and coherence".
  · **Chrome moved to where the game card keeps it.** The labelled "+ Add to class" footer button is
    gone; capture is the compact glyph beside the ✕ in the corner (`[data-sheet-corner]`), with a
    44px hit area on mobile (`"sheet"` joins `_listAddButton`'s thumb list). The perspective toggle
    and "Play from here" left the header for the footer — "play from here (as attacker / as
    defender) should show not on top" — because a sheet whose first row is a pair of controls reads
    as a toolbar, and one whose first row is a name reads as a technique.
- **NO "ATTACKS FROM HERE" BEHIND `More` (v1.102.0).** The owner asked whether it was repeated
  content, "since we anyway show options for the user to select (which are attacks / transitions /
  edges out of this state)". It was worse than repetition. That block was RAW ADJACENCY — first
  six neighbours, deduped by short name, with **no role filter and no origin filter** — while
  `optionsFor()` builds the hand from the same adjacency and then keeps only what favours the side
  you are playing and what actually originates here. Measured across all 272 position-role hands
  (1,632 pills): **42.3%** originated at a DIFFERENT position, **35.4%** were the opponent's move
  *and* from elsewhere, **10.8%** were the opponent's move, and only **11.5%** were legitimately
  yours. It also overlapped the dealt hand by just 12.9%, so it did not even read as a summary of
  the tray below it. **All 188 of the legitimate pills were already in the choices — 100%** — so
  nothing was lost by deleting it. Zero SEO exposure: the string lived only in `neural.js` (and
  still does, in the dead `renderDossier`), never in emitted HTML; a generated position page's
  `<article>` never carried it.
- **`More ▸` IS ONLY RENDERED WHEN THERE IS MORE (v1.102.0).** Owner: "if there is nothing to show
  by clicking More then don't show the More". `_landMoreHTML(node)` returns the sections as a
  string, or `""` — and `""` is the point: the foot draws no button, the body is not created, and
  the old "Nothing more is authored for this state yet" placeholder is gone. ONE function serves
  as both the predicate and the content, so the button and the panel can never disagree. It is
  computed at render time (a few cache reads and a string), because the foot has to know before it
  draws. NB journeys about the fold must AUTHOR content — the DSL serves `{}` for dossier chunks,
  so most states legitimately have no `More` under test.
- **THE CAPTURE PICKER ALWAYS OPENS — NOTHING IS ASSUMED (v1.102.0).** v1.99.5 took a shortcut:
  zero or one list and not-yet-captured filed straight into `activeListId`. Owner: *"list of lists
  should show before adding anything, instead of showing it already green and saying 'added to list
  whatever was being added last' — rather let the user select which list to add to. dont assume."*
  Right on both counts: "one list" is only unambiguous the FIRST time, and from the second onward
  `activeListId` is whichever list was last created or touched — not a destination anyone chose —
  while the ✓ that followed announced a filing they never made. `captureNode` is now just
  `openListPicker`. The label lost its presumed destination too ("Add to a class list…", never
  "Add to class list *Class · Aug 12*"). The canon this overturns — "do not tax capture with a
  chooser, the option hand is on a clock" — was written when every option card carried its own
  `+`; those went in v1.101.1, and what is left are surfaces you are already reading. Zero lists
  opens straight into the name field, so a first capture is still one decision.
- **THE PANE PAINTS OVER THE GAME CARD, AT EVERY WIDTH (v1.101.7).** The card is
  `min(520px, 100vw - 32px)` and CENTRED; the pane is 360px on the left. They miss each other at
  1440 and overlap by **108px at 1024** — and the card won, because the pane's `z-index:8` is
  trapped inside the `position:fixed` app wrap (its own stacking context) while the card is a
  root-plane child at z:5. The phone rule ("hide the card while the drawer is up") was written as
  mobile-only on the reasoning that "desktop is untouched — there the card sits beside the left
  pane by design", which was true at one width and false below it. Owner: *"the left side pane
  should always appear in front of the current node's dialog, not hidden behind it — the game
  pauses when the left pane is open"*. That second clause is the argument: nothing is running, so
  standing the card down costs nothing, and it returns unchanged on close. `_suppressLand` is the
  seam (it takes the film strip too, and sets `visibility:hidden`, so no invisible child keeps
  eating clicks). Pinned at 1440 AND 1024 by `pane-chrome.spec.ts`.
- **`attachInput` MUST NAME EVERY FIXED OVERLAY THAT OWNS CONTROLS (v1.101.5).** Its pointerdown
  calls `setPointerCapture` on the wrap, which retargets pointerup, so the browser resolves the
  click to the down/up common ancestor and a listener inside an overlay never fires. Fourth
  instance: the game card's own corner capture. It measured the button, hit-tested to the button,
  took a real mouse click on the button — and captured nothing; `locator.click()` (which
  dispatches on the element) masked it completely. `.ng-landcard` and `.ng-landfilm` join the
  node card and the sheet in the early-return. Any new fixed overlay with controls goes here too.
- **A SUPPRESSED LANDING CARD MUST BE INERT, NOT MERELY TRANSPARENT (v1.100.2).** `_suppressLand`
  set `opacity:0` + `pointer-events:none` on the root. Both are inherited — and `[data-land-foot]`
  re-enables pointer-events INLINE on purpose (it holds `More ▸` and the capture control). Hit-testing
  ignores opacity, so a "hidden" landing card kept a fully **INVISIBLE** sticky footer strip live
  across its box and whatever sat under it was dead to the mouse (measured: `elementFromPoint`
  returning `<div data-land-foot="1">` at the centre of a capture button, 120s of Playwright
  retries). It now also sets **`visibility:hidden !important`**, which is inherited, which nothing
  here escapes with `visible`, and which removes the subtree from hit-testing outright. Fifth
  instance of this repo's recurring bug class. The three sibling hide-sites that write
  opacity/pointer-events directly (the option-detail sheet pair, the mobile-pane pair) share the
  shape of the hole and were NOT changed — unverified.
- Tests: `e2e/journeys/roll-card.spec.ts` (5 journeys). `node-card.spec.ts` is deleted with its
  subject; the label/plate journeys it held describe a surface that no longer exists.

<a id="v1-106-5-last-rolls-roll-from-here-replay"></a>

## v1.109.0 — LAST ROLLS: ▶ ROLL FROM HERE, ⟲ REPLAY

> **Version label reconciled.** The narrative below titles itself `v1.106.5`, but in git
> `v1.106.5` is a different commit entirely. This work shipped as **v1.109.0** (deca451bd — "History learns to show its work: play-from-here on the side you played, and Repl").

_Originally CLAUDE.md L2867._

**LAST ROLLS: ▶ ROLL FROM HERE, ⟲ REPLAY (v1.106.5, owner: "History should have a play from here and a replay button indeed. dunno how to best design it visually, wear your design hat").** A past-roll row is now a first-class object with two quiet right-side controls; a REPLAY is a **film of a roll you already rolled** — the camera walks the archived exchanges, sweeping each edge to its technique and on to where it landed you, with the announcer line for every beat.
- **THE LOG LEARNED THE EDGE.** `rollLog` recorded the STATES you passed through and nothing about how; a film cannot be reconstructed from that. Each landing now carries **`via` = `{idx, name, ty, actor, kind}`** (the technique node the exchange travelled over) plus `from` (the previous node), written through the SAME `_pendingIntent` seam the "you aimed for" line already used — set in `enterAttempt`, `opponentDefend` and the escape branch of `enterDefense`. `endRound(kind, name, nodeIdx)` gained its third argument so the archived record carries **`finish`**: a submission finish produces no landing, so without it the film of a won roll stopped one beat short of the thing the roll was for. All of it is IN MEMORY — `rollLog`/`_pastRolls` have never persisted and this does not change that.
- **A FILM CREDITS NOTHING, and that is enforced by not being an `fx()` beat.** `_replayBeat()` pushes onto the same `this.beats` stream journeys read and stops there; `fx()` is the challenge-evidence (and sound-catalog) seam, and every beat through it is offered to `noteChallenges`. Beats: `roll_replay_start` / `roll_replay_end`. Analytics — allowed to know — is one `track("neural_roll_replayed")`. Pinned by a journey that compares `stage`/`srs`/`prep`/`rec`/`challenges`/`badges`/`coins`/`units`/`gameScore()`/the whole persisted blob before and after a complete replay, and asserts the film is silent.
- **THE CLOCK IS HELD THROUGHOUT**, on its own latch (`_replayAutoPaused`, the pane/dossier/`More` pattern), so stopping gives back only a pause the film took. **Travel steps on the REAL frame delta while a film runs** (`updateTravel(this._replay ? dt : gdt)`) — the sweep IS the feature, and travel is a display primitive exactly like the camera, which has always run on the real clock. The live roll's `pulse`/`activeMove`/`trail`/`focusIdx`/`camFocus`/`camTarget` and the one announcer slot are snapshotted at `startReplay` and handed back by `stopReplay`.
- **ANY REAL INPUT ENDS IT**: a pointerdown on the canvas (pan, pinch and tap in one place), a wheel, Esc (a rung ABOVE the pane — a film is ambient chrome, the pane still closes last), and `setPaused(false)` — pressing play stops the film rather than running a roll underneath it. `rollFromPosition`/`startRoll` stop it FIRST, before `clearTimers()` and before they write the camera, or the restore would land on the new roll.
- **IT NEVER TOUCHES THE PANE, and closing the pane HANDS THE CLOCK OVER.** On a phone the 88vw drawer IS the screen, so closing it is how you watch — resuming there would cancel the film with the very gesture that exists to see it. `applyDeckVisibility` therefore moves the pause latch from `_paneAutoPaused` to `_replayAutoPaused` instead of resuming, and the landing card's un-hide is gated on `_traySup` so the card cannot reappear over the film.
- **Design.** The film opens on an **establishing shot** (every node of the roll framed at once) and then walks it — film language, and measured: the camera starts wherever the paused roll left it at `ROLL_ZOOM`, so without a wide frame first the opening beat spends its whole second flying with its own state off screen. Each beat takes a **fresh camera lease** for exactly its duration (`_replayAim` → `holdCamera`), framing a landing with `rollCamTarget` and an exchange with all its nodes on BOTH axes, shifted for an open pane like `locateNode`. Announcer copy is past tense and obeys ONE SUBJECT PER LABEL (v1.104.1): "You went for" / "Opponent went for" / "You escaped", with the graph verb naming YOUR posture.
- **Chrome:** `.ng-replaybar` (`[data-replay-bar]`, `role=status`) at **z:8 — the ambient-state band**, deliberately not the 90-99 deliberate-screen band (a replay is a state you are in, not a screen you asked for), docked where the LANDING CARD docks via the same `_dockLandCard` tray measurement, because it stands in for exactly that surface. Its `[data-replay-stop]` ✕ is the 44px thumb figure.
- **Row controls** are `.ng-histctl` — 24px glyphs (the pane's control figure, WCAG 2.2 AA 2.5.8), hit areas grown with `padding:4px;margin:-4px`, states in `helmet.html` beside `.ng-anchor-*` (never JS hover painting, which cannot express `:focus-visible`), real `aria-label`s naming the roll. `gap:20px` buys the **12px miss-distance between HIT BOXES** (flex gap measures between margin boxes, so 12 there would leave 4). Handles: `[data-past-roll]`, `[data-roll-from="<ts>"]`, `[data-replay-roll="<ts>"]` (`aria-pressed`, `[data-replaying]` while it plays).
- **▶ STAGES, and it asks first.** `confirmPlayFrom(n, opts)` gained `opts.role` (the row knows the side you actually played — every position hub is titled "… Top", so a derived role is the constant `top`), `opts.staged` (its own copy: "Set the board here" / "Set it up") and `opts.go` (the caller's action: the SCREEN is shared, but Last rolls stages with the clock held per ROAM & STAGE and closes the pane, per v1.104.5's "this is the USER pressing play"). The per-state ▶ inside a roll also passes the recorded role now — it derived `top` for every Bottom row it has ever had.
- **Reduced motion** is read at replay start (`_reducedMotion()`): no travel pulse is created, the camera SNAPS, and the beats step on a fixed dwell. The spec proves it with `page.emulateMedia({reducedMotion:"reduce"})` — measured, `test.use({ reducedMotion })` leaves `matchMedia` FALSE in this harness, so a spec relying on the fixture option asserts nothing and passes forever.
- **Tests:** `npm run e2e:replay` → `e2e/playwright.replay.config.ts` (own port **:8151**, `reuseExistingServer:false`) runs `e2e/journeys/history-replay.spec.ts` (6 journeys, 3 `@curated`, incl. a 390x844 drawer journey); it also runs inside `npm test`. Camera claims PROJECT each beat's node through `draw()`'s transform into the viewport rect — never `camTarget` (share-camera canon).

<a id="v1-68-0-roam-stage"></a>

## v1.68.0 — ROAM & STAGE

_Originally CLAUDE.md L2880._

**ROAM & STAGE (v1.68.0).** Clicking any graph node calls `stageRollAt(idx)`: fly there, land, deal the hand — **clock held**. Click elsewhere and you restage the same non-session. `_played` (set in `_tick` on the first unpaused frame with a live hand) is the seam: a roll that never played is never archived into `_pastRolls`. Tapping the node you are already on reads it (dossier) instead. `after(sec, fn, ignorePause)` exists so a staged landing still arrives while paused. Beat: `roll_staged`.

<a id="v1-81-4-camera-ownership-a-focus-flight-holds-a"></a>

## v1.81.4 — CAMERA OWNERSHIP — a focus flight holds a LEASE

_Originally CLAUDE.md L2882._

**CAMERA OWNERSHIP — a focus flight holds a LEASE (v1.81.4).** `frameNodes()` does not move the camera. It writes `camTarget`; the render loop eases toward it, and **`updateCamera()`'s follow-cam rewrites `camTarget` at the current roll node on every frame**. So every "here is your selection" flight (a shared class lighting up, a System lighting its members) used to be overwritten within one frame of a live roll — invisible on desktop only because the arrival opened the pane and an open pane pauses the roll. `frameNodes` therefore calls **`holdCamera()`**: `camHoldSec = 7`, checked by `camHeld()`, cleared by `releaseCamera()`.
- While the lease is live, **every automatic retarget yields** (`if (this.introDone && this.camHeld()) tgt = null` — follow, Overview and the end-of-round zoom alike). It **expires**, so the 400ms pan-to-current-node behaviour returns on its own.
- **A real pan, pinch or wheel releases it** (never fight a user's camera); so do the user's own "go somewhere else" paths — `locateNode`, `openDossier`, `playFrom`, `rollFromPosition`. A re-light (`relightShare`) takes a **fresh** lease.
- An intro still flying **hands the camera over** when it finishes: a share link is decoded at t=0, 3.2s before `introDone`, and its flight used to be eaten by the intro.
- `frameNodes` fits **both axes** (`vw` is a width; the visible height is `vw * H/W`), or a tall selection hangs off a 390x844 phone.
- **Never assert camera behaviour by reading `camTarget`** — that is exactly how this bug survived three reviews. Project the node through `draw()`'s transform and assert it is inside the viewport rect: `e2e/journeys/share-camera.spec.ts`.

<a id="v1-81-4-the-bottom-thumb-band"></a>

## v1.81.4 — THE BOTTOM THUMB BAND

_Originally CLAUDE.md L2889._

**THE BOTTOM THUMB BAND (v1.81.4; re-tenanted v1.99.0).** Fixed tenants at `bottom:28px` on a phone: legend (left), `.ng-transport` (centred), the **account chip** (right — it took the deleted pill's seat). The **share cue** is a standalone conditional control (`.ng-sharecue`, ABOVE the chip: desktop `bottom:76/right:24`, phone `bottom:84/right:14`) rendered only while a cue exists (`[data-share-cue]` ◉ re-light + `[data-share-open]` Class ▸, 44px targets, pointer-events:auto inline), hidden while the pane is open. `_renderShareCue()` still stamps `body[data-share-band]` (diagnostic hook; the pill-era CSS that consumed it is gone). Measured band at 390: legend 14–118 · transport 150–240 · cue above-chip, all individually hit-testable.

> Two values were tried, rejected, and must not come back. **`body[data-share-cue]`** collides with the cue BUTTON's own attribute, so `document.querySelector("[data-share-cue]")` returns `<body>` — every "where is the cue" measurement silently becomes the whole 390x844 viewport and every tap aimed at its centre lands mid-screen (three share journeys went red on it). And a **66px** transport shift merely relocates the collision onto the band's third tenant, the legend. Deliberately **not** a `max-width` on the pill: a capped right-anchored flex row pushes its last button off the right edge instead of shrinking. Asserted geometrically (transport, cue, legend) at 390x844.

<a id="v1-81-4-arrival-copy-is-held-not-fired-at-t-0"></a>

## v1.81.4 — ARRIVAL COPY IS HELD, NOT FIRED AT t=0

_Originally CLAUDE.md L2893._

**ARRIVAL COPY IS HELD, NOT FIRED AT t=0 (v1.81.4).** `setEvent` is ONE slot. A share arrival is decoded at ingest, mid-intro, and the roll's first landing overwrites it seconds later, so `_announceArrival()` stores the sentence and `enterLand()` says it (`_sayArrivalIfPending`) once the graph has settled. A timer cannot do this: `startRoll()` calls `clearTimers()` at the end of the intro. `saveSharedList`/`dismissSharedList` drop a held sentence — the user already answered.

<a id="v1-81-4-a-damaged-share-link-two-sentences-one-s"></a>

## v1.81.4 — A DAMAGED SHARE LINK: TWO SENTENCES, ONE SOURCE

_Originally CLAUDE.md L2895._

**A DAMAGED SHARE LINK: TWO SENTENCES, ONE SOURCE (v1.81.4).** `ngListClassifyFailure(code, error)` decides between **`clipped`** ("one of ours, cut short in transit") and **`unreadable`** ("not one of our codes"), because `not_base64url` — the majority of real clip positions — is *also* what a pasted random word looks like. The tell is the leading wire-version byte (`ngListWireVersionOf`, two base64url chars). `_brokenCopy()` is the single seam for the pill label, the panel (`[data-shared-broken-kind]`) and the toast, so they can no longer contradict each other.

<a id="v1-74-0-challenges"></a>

## v1.74.0 — CHALLENGES

_Originally CLAUDE.md L2897._

**CHALLENGES (v1.74.0, laddered v1.76.0).** Challenges replace the one-time Tutorial and locked progression path. Five content tracks — White Foundations, Blue Connections, Purple Patterns, Brown Pressure, and Black Breadth — are open from day one. Track colors describe material difficulty, never real-world rank or access.
- **The tab renders as THE BELT CORRIDOR (v1.98.0)** (`.ng-challenge-ladder.ng-corridor`): one continuous vertical woven belt (`.ng-corridor-rail`, the knowledge belt's weave turned vertical) runs down the left, white through blue/purple/brown/black, a knot (`.ng-corridor-knot`) tied at each boundary; lesson rows hang off it. Belt-section headers (still class `ng-track-card`, `data-track`, `aria-pressed`) speak **plain belts** — "White belt", never "White Foundations · CONTENT TRACK" (display only; track ids/names unchanged) — and count LIVE lessons. Each `.ng-belt-section` **collapses via its `.ng-belt-toggle` chevron** (`data-collapsed`; body display only, every row stays in the DOM, nothing re-locks); open/closed persists per section in the `challengeOpenSections` settings map; defaults = pinned belt open, the rest folded; clicking a folded header selects AND opens. The **Getting started tutorial** — the 20 White evidence objectives — is its OWN section (`[data-tutorial]`, `.ng-tutorial-section`) ABOVE the corridor, separate from the curriculum; it defaults collapsed at ≥14/20 done and then shows the not-done remainder compactly (`[data-tutorial-remainder]` chips). The corridor explains itself ONCE (`.ng-ladder-note`) — the per-track prose block is display-retired. The selected track's objectives block (`.ng-challenge-detail`, unique) rides inside its section's body (White's detail carries no objective rows — they ARE the tutorial). Lesson rows carry a category tint (`data-cat` position/transition/submission, Explore's palette), a `✓` **edge check** when done (`.ng-lesson-check`), and an inline mini-deck disclosure (`[data-lesson-deck-toggle]` reveals `_miniDeck` in place, the History pattern — the row itself still opens the full study takeover). Each belt body renders a **Principles slot** (`[data-principles]`, `renderBeltPrinciples`) ONLY when curriculum data ships `belt.principles` — distributing actual Principles content across belts is owner-gated curriculum authoring, never invented in code. The corridor's one target is the **frontier belt** — `_frontierBeltId()`, the topmost belt whose live lessons aren't all done (v1.99.2: PINNING IS RETIRED — `challengePinnedTrack` stays dormant in blobs, read by nothing; `pinChallengeTrack` deleted). The frontier belt drives: the default-open section, the arrival scroll, the frontier-lesson glow (`challengeFrontier(beltId)` → `data-frontier`), the tab belt's dye+stripes, the challenge cue, and the selected-track fallback. Completing a belt advances all of them to the next belt (tab belt = fresh dye, 0 stripes). Not-done rows dim **visually only** (`data-lesson-done`, opacity on the text span — crowns keep full color; nothing re-locks, per canon).
- White Foundations preserves the original 20 evidence predicates; the first-roll coach completes the first three. Legacy `tut.done` is dual-read and compatibility-written, then migrated exactly once into `challenges`.
- Advanced tracks combine event evidence (`combo`, `escape`, `roll_end`) with snapshot evidence (lessons, checkpoints, recall, mastered decks, capstones). `fx()` is the single processing seam.
- The challenge cue (frontier belt's next objective since v1.99.2) stays available during rolls, can be hidden in Settings → Rolling (the toggle is also its restore path), and never takes focus or blocks the option hand. Opening the pane temporarily removes the cue.
- Challenge lessons are always open. A unit checkpoint requires its own live lesson evidence; an optional content capstone requires that track's unit checkpoints. Clearing a capstone records proof but never unlocks another track.
- **Rewards shelf (was the Collection tab):** patch-style badges (meaningful milestones) and mint-once Mat Coins (humorous acknowledgements) live in a `<details>` shelf (`[data-rewards-shelf]`, `renderRewardsShelf`) at the foot of Challenges; reward toasts' "View Collection" opens+scrolls it. **The shelf earns its place (v1.99.1, owner):** it does not render until something is earned, and it shows ONLY earned items — the "Available to earn" placeholder grid is dead (capstones already say "Earns a patch"; the joke coins spoil if listed upfront). Neither is spendable and neither changes odds, score, timers, content access, or opponent behavior.
- Reward feedback is queued, polite (`role=status`, `aria-live=polite`), focus-safe, sound-aware, and remains visible without animation under reduced motion.

<a id="v1-68-0-game-knowledge-one-skill-score-display-o"></a>

## v1.68.0 — GAME KNOWLEDGE = ONE SKILL SCORE , display-only

_Originally CLAUDE.md L2906._

**GAME KNOWLEDGE = ONE SKILL SCORE (v1.68.0), display-only.** Challenge progress and skill are deliberately separate. Game Knowledge is the only mastery metric:

```
score = Σ (weight_i × mastery_i),   Σ weight_i = 1
```

- **`weight_i`** — how often a roll *actually* passes through technique *i*. Computed at build time by `build_technique_weights()` in `scripts/regenerate_neural_data.py`: the state machine is a Markov chain (position-role --`attemptProbability`--> technique --`outcome.probability`--> position-role), power-iterated with PageRank-style damping to a **stationary distribution**; each technique's expected visit rate is its weight. Emitted as `curriculum.weights` (`{"<name>|Attacker": w}`, 1269 entries summing to 1). Sanity check: the heaviest come out as *Side Control to Mount* (2.4%), *Knee Slice Pass*, *Underhook Sweep from Half* — a believable frequency ranking.
- **`mastery_i`** — `deckMastery(key)` = mean of `min(cardStage,3)/3` over the deck's cards.
- **Nothing is cut.** A rare technique still counts, proportionally to how rare it is. This replaced an earlier "drop the rare 20% tail" canon, which was arbitrary — `attempt_probability` is normalised *per position* across 10–20 options, so the distribution is flat and any mass cutoff is meaningless (80% of the mass kept 724 of 1270 techniques).
- **Knowledge bands are thresholds on that number** (`BELT_SCORE`): white .20 · blue .40 · purple .60 · brown .70 · black .80. `gameScore()` → `{score, belt, next, stripes}`, memoised against `_stageVer` (bumped in `_bumpStage`) because a full pass is ~21k card reads.
- **Emergent property worth keeping:** an MC answer caps a card at stage 2 = 2/3 mastery, so pure recognition tops out at **0.667** — enough for purple, never enough for brown or black. Recall is the only route past 0.7 *by construction*, which is exactly the "white belts recognise, black belts recall" rule, with no special-casing.
- **Effectiveness is already in there** — the chain propagates through `outcome.probability`, so a technique that works routes more traffic to its destination and lifts the weights downstream. An explicit effectiveness multiplier would double-count it.
- The score's UI exposure is the Explore tab subtitle "Mastered N%" (v1.98.1 — the woven `.ng-knowledge-meter` visual is retired everywhere: header v1.96.0, Explore mount v1.98.1; `gameScore()` and its math untouched). The Challenges tab's `.ng-tab-belt` (unit stripes) and the corridor rails are the only belt visuals. **Nothing is gated by the score** and the thresholds are provisional.
- **The meter IS a woven belt (v1.90.0)** — CSS-only strap + rank bar + tape stripes (`data-belt`, `.ng-belt-bar > b`; black wears the red bar and NO stripe ladder; stripes end at black). **Its quiet companion is the band line (v1.93.0)**: `.ng-belt-road`, the five bands white→blue→purple→brown→black laid on the score axis at the BELT_SCORE thresholds (20/40/60/70/80) with a `.ng-belt-you` dot at the score. **No pedagogical labels**: "Building foundations" and "Proven recall, not challenge completion" are deleted — pre-belt shows the bare score, a held belt shows its rank name, and the sub-line is the plain road ("50% to purple"). Belt-name aria labels are unchanged (belt-meter.spec pins them).
- **RECALL MODE IS A BLACK-BELT BADGE (v1.105.1, owner: "it's a badge he wins... a toggle that's disabled until he becomes black belt", "we can see it in the challenges").** The MC→recall flip IN PLAY is a reward, not a default: setting `recallInPlay` renders in Settings → Flashcards as a LOCKED teaser (`[data-recall-locked]`) until `gameScore().belt === "black"`. The badge `recall-in-play` is event-driven (`belt_reached`, fired post-grade from `noteCardAnswered` while black-and-unminted — NOT from `_bumpStageVer`, which hydration calls; a payload must never mint a badge) and **the auto-flip lives INSIDE the mint loop only**: flipping on the mint (once per account) means turning it off later STICKS — a flip driven by "belt is black" would re-enable it on every device forever through settings LWW. With the toggle on, a **stage-2+** landing card renders `_recallBlock` (`[data-land-recall]`) instead of MC — per-card, recognition first for stage-0/1; the warm gate is format-aware (a recall block never waits on a distractor pool). **A self-graded recall never refunds the clock or ticks the combo** (`_landAnswered`'s `format` arg) — "Show answer → Got it" is unverifiable and would be a free-time button; odds/mastery credit still flows. The Black corridor section advertises the reward up front (`[data-recall-reward]`, the capstone "Earns a patch" idiom). Pinned by `e2e/journeys/recall-badge.spec.ts`.
- **REAL SPACED REPETITION exists since v1.105.0 (owner directive, 2026-08-16 — this REVERSES the old "forgetting is tested, not timed / no idle decay" canon; "maintenance should come first before learning new techniques").** The resolution that makes both true at once: **due-ness decides what you are SHOWN; mastery stays stage-based and moves ONLY on answers.** A card a year overdue changes nothing about `gameScore()` — the belt cannot drop because time passed (pinned by `srs-due.spec.ts`). Review-again and trap answers still lower a card's stage; the calendar never does.
  - **`srs = {deckKey: {qhash: [due, ivl, last]}}`** in the v2 blob (no version bump), LOCAL epoch-day ints (`_epochDay()`, overridable via `window.__NG_EPOCH_DAY__`; LOCAL because `_dayKey()` is local and two cells on one band must share a midnight). ONE writer `_schedule(key,q,ok)` fed by BOTH grade chokes (`gradeRecall`, `_mcAnswer` — scheduling is memory, not format): success climbs `NG_SRS_IVLS = [1,3,7,14,30,60,120]`, any failure resets to 1. It mirrors `noteCardDone`'s cross-deck credit (one FACT, one schedule — `_sharedDecksFor` returns null-or-list-INCLUDING-self; skip self or every grade double-climbs), emits NO fx beat (replay-digest safety), and is deliberately NOT in `noteCardDone` (the harness drill rail writes prep directly and must keep an empty srs).
  - **The pool drains on failure**: `duePool()` = `due <= today && last < today` — a failed card returns TOMORROW instead of stalking every landing all day. `dueCount()` dedupes by qhash (facts, not deck copies).
  - **Merge** (beside `stage`'s MAX): later `last` wins; same-day tie → SMALLER ivl (a failure is never erased by an earlier same-day success); a winning SUCCESS keeps the larger ivl (heals grade-before-pull); ingested `last` clamps to today (a fast clock cannot win forever). `stage` MAX vs `srs` recency can disagree post-merge — deliberate: stage is proof, srs is freshness.
  - **Due first, everywhere**: `questionFor`/`nodeQuestionFor` ask due cards before new ones (any stage — which is why `_bumpStage`'s cap is now GROWTH-ONLY: `min(cap, cur+d)` used to write 2 over a proven 3 on a correct MC answer, dropping the belt and re-minting `rec`). The maintenance surfaces: the stats band's middle cell is the honest fact-deduped due count (amber when owed; one press opens the due SESSION), and Challenges opens with a `[data-maintenance]` band while anything is due. The `"due"` bucket is real (deck keys with due cards, most overdue first); due sessions narrow entries to due cards via `_entryForKey(key, "due")`, and the filter is stored ON the entry so hydration rebuilds (`_restudy`, the backfill) cannot silently widen a maintenance session to the whole deck. The dead `studyOrder` setting is deleted — due-first is behaviour, not a preference.
- `crownBadge(frac, tint, false)` gives each Challenge lesson a 0–4 crown from `deckMastery(deckKey)`. Crowns visualize the same evidence as Game Knowledge; they are not a second score.

**CHALLENGE PERSISTENCE + MERGE.** The existing v2 progress blob adds `challenges`, `badges`, and `coins` without changing the blob version. Challenge entries are `{progress, done, t}`; collectibles are `{t, context?}`. Cloud reconciliation uses MAX for progress, OR for completion, UNION for collectibles, and the existing per-key timestamp LWW rule for settings. A fresh device must pull before its first push. Corrupt local state falls back cleanly, and snapshot-derived historical rewards persist without replaying old toasts.
- Challenge settings: `challengeView`, `challengeSelectedTrack`, `challengePinnedTrack`, `challengeCueVisible`, `challengeMigrationSeen`, `challengeOpenSections` (per-section corridor fold map, v1.98.0).
- Legacy `path` and retired `collection` views migrate to `challenges`; legacy `tree` migrates to `explore`; `history` is first-class (v1.76.0).
- Compatibility identifiers such as `belt_test_*`, `TUTORIAL`, and `tut.done` remain internal migration rails only. Do not restore their retired UI or lock semantics.

<a id="v1-70-0-momentum-the-combo-meter"></a>

## v1.70.0 — MOMENTUM — the combo meter

_Originally CLAUDE.md L2933._

**MOMENTUM — the combo meter (v1.70.0).** Consecutive correct landing answers build an arcade combo: ×2 `DOUBLE COMBO!` · ×3 `TRIPLE` · ×4 `MEGA` · ×5 `ULTRA` · ×6 `RAMPAGE!` · ×7+ `GODLIKE` (re-stamps ×N). Owner's rules: **per roll** (fresh match starts cold — reset in `startRoll`/`rollFromPosition`); **wrong OR ignored breaks it** (`_landPending` is set when a question mounts; `enterAttempt` breaks with `reason:"ignored"` if it's still set — auto-pick counts as ignoring); a landing that asks nothing **carries** it (silence ≠ neglect).
- **Bonus:** `momentumMod()` = +2.5%/tier, **cap +10%** at ×5 — added in `moveChance` AND `escapeChance` (momentum is morale, it defends too). `momentumSkew()` = 10%/tier, **cap 40%**: in `drawOutcome`, counter-outcome weights shrink by the skew ("too fast to counter") — favorable outcomes gain implicitly via relative weights, authored numbers untouched. Beat `outcome_skewed {skew, result}` when a non-success lands under skew.
- **Surfaces:** `.ng-combo-pop` (`[data-combo-pop][data-heat 1-5]`, announcer slam, auto-removes) and the `.ng-momentum` heat chip (`[data-momentum]`, top-right, shatter animation on break). Beats: `combo {n, name, mod}`, `combo_big {n≥5}` (louder patch), `combo_break {at, reason}`. Sound patches `combo`/`combo_big`/`combo_break` in `sound.src.js`.
- The ×2+ announcer replaces the "Correct" toast; a break folds "×N momentum gone" into the wrong-answer toast.

<a id="v1-75-0-neural-audio-one-contextual-signal-catal"></a>

## v1.75.0 — NEURAL AUDIO — one contextual signal catalog

_Originally CLAUDE.md L2938._

**NEURAL AUDIO — one contextual signal catalog (v1.75.0).** `neural/src/sound.src.js` owns both `NGSound` and `NG_SOUND_CATALOG`; never maintain a second list of default-runtime sounds. Mapped `fx()` beats use filtered deterministic noise, sine/triangle foundations, spatial travel, smooth envelopes, delay, and compression. Routine events stay restrained; recall proof, checkpoints, belt tests, victory, and defeat earn progressively longer starflight signals. Test mode records `{beat, patch, volume}` without creating an `AudioContext`, and every noise/pitch draw goes through `app.rng("sfx")`.
- **The catalog documents beats that actually fire.** Challenge rewards own the `Rewards` group (`challenge_completed`/`objective-tick`, `patch_earned`/`patch-weave`, `coin_earned`/`coin-mint`), and the retired Belt Path cues (`path_opened`, `belt_unlocked`, `stripe_earned`) are gone with their voices. Adding a mapped `fx()` beat means adding a cue; retiring one means deleting it.
- `/dev/sounds/` lives in `forward/sounds/`, not a Quartz emitter. `build_forward_components.mjs` deletes/rebuilds `source/public/dev`, validates the catalog, then copies the production engine and emits `sound-catalog.json`.
- The sound lab previews `NGSound` directly, documents each real trigger, is `noindex,nofollow`, and appears in every Forward route nav. Sounds is a development tool, not a fifth composition layer.
- **There is ONE audio engine.** `source/quartz/components/scripts/gameAudio.ts` (the legacy variant's second engine, `GAME_SOUND_CATALOG`, gated on `BJJSettings.soundEnabled`) was **deleted in v1.80.0** with the rest of the legacy front-end — the file does not exist and `?variant=legacy` selects nothing. Neural's settings are `sound` and `soundVolume`. Do not reintroduce a second catalog of default-runtime sounds.

**`pointer-events:auto` is LOAD-BEARING on every fixed overlay** (`.ng-coach`, `.ng-landcard`, …): the property is *inherited*, the overlay root disables it, and the canvas hit-tests above anything that doesn't re-enable it — option cards set it inline for exactly this reason. Missing it = mouse clicks silently fall through to the graph (the coach's Next button and the landing card's MC options were unclickable by mouse until v1.69.1; keyboard paths masked it).

<a id="v1-95-1-the-z-ladder"></a>

## v1.95.1 — THE Z LADDER

_Originally CLAUDE.md L2946._

**THE Z LADDER (v1.95.1, documented in `neural/src/helmet.html`):** the root overlay plane (direct children of `#neural-root`) is banded — 1-9 ambient state chrome (landcard 5, momentum 6, tut/cue 7) · 10-49 ambient fx (toast 14, vignette 44) · 50-79 coaching (coach 70, combo pop 72) · **90-99 DELIBERATE temporary screens** (account menu 90, `.ng-modal` settings/legal/auth/search + roll-from confirm 95). The app wrap is `position:fixed` = its own stacking context, so any z inside it is trapped at plane level 0 — a deliberate screen must live on the root plane (the modal **portals out at boot**; the account menu portals on open). A screen the user asked for is never underdrawn by ambient gameplay overlays; the modal scrim takes the input; **Esc walks the ladder top-down** (modal → menu → sheet/dossier → pane last, per pane law). New overlay = pick a band, never a loose number. On a PHONE the 88vw drawer owns the screen: `applyDeckVisibility` hides the landing card (opacity/pointer-events, same treatment the option sheet gives it) while the drawer is open — the card is root-plane (z:5) and would otherwise paint over and out-click the in-wrap pane.

**Settings additions:** Rolling tab gains *Questions while you roll* (`landQuestions`, default on — gates the QUESTION only; identity+film render regardless) and *Challenge cue* (visibility; it tracks the frontier belt). Flashcards tab's *Answer mode* defaults to Classic recall. Shortcuts lists `A B C D`.

<a id="v1-105-2-a-lesson-row-reads-and-locates-it-never"></a>

## v1.105.2 — A LESSON ROW READS AND LOCATES; IT NEVER TAKES THE PANE OVER

_Originally CLAUDE.md L2950._

**A LESSON ROW READS AND LOCATES; IT NEVER TAKES THE PANE OVER (v1.105.2, owner: "we don't want content that opens in the sidebar and takes over the whole sidebar, nor do we want the sidebar to close").** A Challenge lesson's name click = the `▸`'s inline Q&A (shared `openMini`, hoisted from the toggle listener — same accordion law) + a **pane-aware `locateNode`**: the node centres in the VISIBLE region right of the 360px pane, computed from TARGET values on both axes (`deckShown ? 1 : 0`, never the eased `uiShift` — camTarget is written once and a click mid-open would bake a fractional offset in forever; and THIS flight's `vw`, never mid-flight `cam.vw`, which can be 10× larger). `sbOffset()` is 0 on phones. `openLessonStudy` survives for sessions/checkpoints only. **The inline mini-deck GRADES** (`[data-mini-got]`/`[data-mini-again]` → `gradeRecall`, so lesson evidence/prep/stage/srs all flow) behind a per-card session latch — `render()` rebuilds innerHTML wholesale, and an unlatched button is six interval rungs in six clicks; reveal stays SEEN-only. Pips wrap. Camera assertions PROJECT the node into the visible rect (share-camera canon) — `challenge-curriculum`'s old camTarget±60 takeover contract is retired, the four journeys whose subject is the study surface enter via `openLessonStudy`, and `test-story` keeps its real click as the proof the row does something.

<a id="v1-105-5-the-explore-foot-s-feedback-row"></a>

## v1.105.5 — THE EXPLORE FOOT'S FEEDBACK ROW

_Originally CLAUDE.md L2952._

**THE EXPLORE FOOT'S FEEDBACK ROW (v1.105.5, owner: PostHog, NOT GitHub issues).** `Request a technique · Report an issue · [★ GitHub]` between the pane anchor and the legal row. Both open ONE modal (`openFeedback(kind)`) → `track("neural_technique_requested" | "neural_issue_reported", {text ≤500, node, app_version})` — PostHog capture IS the collection, no backend; a "no personal info" hint keeps `track()`'s no-PII convention honest. The GitHub chip (`[data-gh-chip]`) is always a link; the star count paints only from a day-cached `gh-stars` localStorage value or a LAZY fetch (first pane open, never boot) whose `.catch` is load-bearing — the harness aborts non-localhost requests and specs collect `pageerror`. **CSP: `https://api.github.com` lives in `connect-src` in THREE places** — `source/quartz/static/_headers`, `functions/l/[[path]].js` (byte-identical, `check_headers_cache` check 8), and the re-emitted `source/public/_headers`.

<a id="v1-103-4-lists-read-as-explore-sections"></a>

## v1.103.4 — LISTS READ AS EXPLORE SECTIONS

> **Status:** Superseded by v1.103.5 - the ladder indent replaced the card chrome. `data-list-drill` no longer exists.

_Originally CLAUDE.md L2954._

**LISTS READ AS EXPLORE SECTIONS (v1.103.4).** Owner: "the listings of the lists design look very
ugly, instead ... the lists and items like categories / items in the explore tab, except they are
lists ... with a play + share icon + close icon on the right of it". A list row is now the SAME
object Explore gives "Systems" or "Positions" — full-width, 7px/12px padding, 14px/700 name,
`(n)` count, chevron, hover wash, no card and no border box — and its techniques are that section's
ITEMS at a 22px indent with the category glyph Explore puts in front of every technique. The three
controls are glyphs on the right: ▶ drill, share, ×. A LIT list keeps its wash, because "these are
on the graph right now" is state, not decoration. Every handle survives the restyle
(`data-list-row/-name/-open/-chevron/-count/-drill/-share/-delete/-items/-item/-item-remove`), as
does the two-step armed delete and its 12px miss-distance from Share; each glyph carries a real
`aria-label` naming its list, since a `title` is not an accessible name.

**`[data-lists-target]` IS RETIRED (v1.103.3).** it existed to make v1.99.5's silent default destination legible, and v1.102.0 removed the silent default, so it was naming a fact that had stopped being true (owner: it "shouldnt exist"). `targetList()` survives as the picker's `[data-picker-default]` ordering, which is an OFFER, not a decision.

<a id="v1-129-8-the-capture-star"></a>

---

## v1.137.0 (d554cca1b) — The logo drops its ring, the tutorial its whole section, and maintenance stops shouting

> Heading disambiguated by hash: this remote also carries a DIFFERENT `v1.137.0` ("The card
> behind the sheet stands down until the sheet leaves", 073c9f338). Two agents and the remote
> bumped independently; the merge at v1.140.0 records the collision.

Four owner passes on the Challenges tab and the top-left logo, in one sitting.

### The ring the owner could still see

Owner: *"I still see the outline on the graph icon. I don't see the outline on the close icon,
but I like that."* — pasted with the button's DOM, whose inline style already read `border: 0px`.
That inline `0` is why the grep for the ring on `.ng-logo` came up empty at first: the ring was
`border: 1px solid rgba(150,170,210,.2) !important` inside `@media (max-width: 640px)` in
`challenge-feedback.css`, overriding it. **The `!important` in a media query is what makes an
inline `border: 0` a lie** — reading the inline style is not reading the computed one.

The same declaration, byte for byte, was what `.ng-explorer-close` had been carrying until it was
dropped earlier in the same session. So the fix was parity, not invention: no resting box, the
44px thumb target untouched, the affordance moved into `:hover` / `:active`. `.ng-logo-mark`
gained `drop-shadow(0 1px 3px rgba(0,0,0,.7))` — with the opaque disc gone the glyph can land on
a lit orb, and the disc had been doing that legibility work invisibly.

**Verification trap worth keeping.** The first phone screenshot still showed a disc, and the
computed `backgroundColor` said `rgba(0,0,0,0)`. Both were right: `locator.click()` leaves the
pointer parked on the element, so the screenshot photographed `:hover`. **A screenshot taken
right after a Playwright click is a screenshot of the hover state.** Re-shot with
`page.mouse.move(300, 700)` first; resting background then read transparent and the disc was gone.

### The Challenges tab belt

Owner: *"remove the 0/6 ... with that belt a little bit more to the right, a bit more centered."*
The `<em>done/total</em>` added in v1.133.0 (to fix the belt reading as "tofu" — an unlabeled
rectangle at 0 stripes) was pushing the belt off the tab's centre line. Removed; the count still
ships in the `aria-label` and on every belt header in the corridor. Measured offset from the tab's
centre after: **0px**, in a 109px tab column.

The dark rank sleeve went **30px → 20px** (owner: *"like 30% narrower"*, *"round it to a round
number"*). Four 3px stripes plus three 3px gaps is 21px, so a full four-stripe tape now fills the
sleeve edge to edge — that is the floor, not a coincidence, and it is written above the rule.

### The Tutorial section is deleted

Owner: *"I think we should remove the whole tutorial section and really clean up the code."*
`renderTutorialSection()`, its call site, its default-folded branch, eleven CSS rules, and the
retired frame in the `/dev` catalog all left together.

**The twenty White objectives still tick.** They are what mints the White patch through
`ngTrackSummary`, and deleting a surface must not delete the ledger under it (CLAUDE.md §6.7 —
"deleting a component deletes its telemetry and its capability, and no gate reports it"). Both
halves are gated in the replacement spec: the handles are gone AND
`challengeTrackProgress("white").total` is still 20.

Two assertions elsewhere had been reading the DOM for that ledger and were rehomed rather than
deleted — `newcomer-story` compared `.ng-challenge-row[data-complete='true']` against
`challengeTrackProgress`, and `challenges-ui`'s migration test read `[data-tutorial] strong` for
the "8 of 20" count. **NON-KILL recorded in `newcomer-story`'s own line:** nothing on screen now
shows a newcomer what he ticked off.

The deletion survey was run with `| wc -l` first, per §6.7 — 33 `ng-tutorial` hits across the app,
the specs and the Forward catalog. The catalog frame would otherwise have survived by default
(§6.8: retired rows rot there because `check_forward_catalog.mjs` only checks that frames render).

### Maintenance: sticky, and quieter

Owner: *"maintenance should always appear on top, and you can scroll down, but maintenance should
still show ... it takes a lot of space right now. It should be a little bit more discreet and
convincing."* And on the copy: *"'Maintenance first' — it's very boring to say that, but '5 cards
due' and 'keep what you've earned' are better motivations."*

`position: sticky; top: 0` on `.ng-maint-band`, and two consequences that a sticky element makes
non-obvious:

- **It must be opaque.** A sticky child is scrolled UNDER, so the `.5`-alpha gradient it wore let
  belt headers read straight through it. It now paints a solid dark panel.
- **It must be subtracted from the arrival scroll.** `renderChallenges`' arrival positioning aims
  the frontier belt's header at the top of the scrollport; unchanged, that header lands underneath
  the band the scroll exists to clear it of. The offset is taken from the band's **measured** rect,
  never a CSS constant — the same rule `_dockLandCard` follows, because one wrapping line changes
  its height (§6.1).

The band went ~53px → ~41px, one row, and the "Maintenance first" eyebrow went with it: it labelled
a thing the person can already see. `N cards due` is the fact, `keep what you've earned` the
reason. The amber left the panel for the count and the Start chip — sticky chrome is re-read on
every scroll, so a permanently visible amber block reads as a warning that never clears.

### Measured, at 390x844

| | |
|---|---|
| belt offset from tab centre | **0px** (was left of centre with the count) |
| rank sleeve | **20px** (was 30px) |
| maintenance band | **41px**, pinned at `top: 4px` through a 400px scroll |
| white belt header on arrival | `headOffset 49` = band height + 8 |
| tutorial nodes / challenge rows | **0 / 0** |

23 journeys green across `challenges-ui`, `white-challenges`, `newcomer-story` and `belt-meter`;
`test:units` 79/79; payload, forward and claudemd gates green.

**A full `test:curated` was deliberately not run**, and this is the reportable part: a concurrent
agent was writing the same tree throughout, so a suite result taken from it is not a result
(§6.4). Two related hazards showed up in the same session and are worth the entry on their own:

- Running `source/`'s prettier over `neural/src/*.css` reformatted **seven `font:` shorthands and
  two multi-line `background:` gradients** that were not part of this change. `source/npm run
  check` scopes to `source/`; `neural/src` is not in it and is not prettier-clean at HEAD. The
  churn was reverted by hand. **Do not run source's formatter over neural's stylesheets.**
- `git add` on a shared file swallowed 112 lines of the other agent's in-flight cue-CSS deletion
  in `challenge-feedback.css`. Caught by reading `git diff --cached --stat` and disbelieving the
  line count — 131 changed lines for a fifteen-line edit. Recovered by staging only this change's
  hunk through the index (`git hash-object -w` + `git update-index --cacheinfo`), leaving the
  other agent's edit unstaged and intact. **On a shared tree, `--stat` before `commit` is the
  check; an unexpected line count is the tell.**

---

## v1.138.0 — FLOW: weak spots become a continuous, signed, value-weighted score

The owner reviewed the Explore stat row and found numbers that each broke one promise: **the
number you press is not the number you get.** "4 very weak spots" opened a 30-technique session;
"5 due" opened 7; and (found during the pass, unreported) "Mastered 3" opens a list headed
"180 techniques" — the cell counts `rec[k] >= 3`, the bucket returned `prep[k] > 0`.

Fixing the counts exposed the rule underneath. Weak spots were three unweighted set-membership
tiers over `prep`, reading neither value nor odds nor traffic — so `Aoki Lock` (stationary weight
**0.0**, a technique the chain never reaches) ranked identically to `Side Control to Mount`
(**2.4%** of all roll traffic), and tier 2 ("never drilled") was **1,452 of 1,456 families** for a
fresh player: a corpus constant wearing a personal number's clothes.

Owner's reframe: *"the very weak / weak definition should be buckets/ordinal class coming out of a
continuous data… like page rank, some nodes are more likely to be visited than others, like big
lakes (bigger accumulations of state) in a river"* — and the requirement that decided the design:
*"typically closed guard culminates in omoplatas and failed omoplatas for me… because I have
mastered the lockdown, the rubber guard, but can't do much out of it."* **Mastering one node made
his game worse.** No threshold rule can express that. A signed score can.

### What shipped

`GAIN(deck) = V₀(you, that deck mastered) − V₀(you, now)`, where V₀ is the player's own expected
`p_win − λ·p_loss` over a roll, by exact backward induction from the submission edges — the only
edges reaching `game-over`. Not Q-learning: the kernel is fully known (1,467 nodes, 4,924 outcome
cells, zero unresolved targets), so it is exact DP plus an adjoint sweep, no sampling. The owner
offered Monte Carlo as a fallback; declined with numbers — median technique weight is 0.000255, so
pinning it to 10% relative error needs ~390,000 sampled visits (~39,000 rolls) against ~246k flops
for the exact solve, the score is personal and moves on every grade, and sampling would break the
determinism `check_no_raw_random.sh` exists to protect.

- `scripts/solve_flow.py` — reference, gate and recompute command. Emits nothing.
- `neural/src/flow.src.js` — the browser kernel, a real ES module stripped of exports at bundle
  time (the `lists-codec.src.js` idiom), so `tests/flow.test.mjs` runs the identical source.
- `npm run validate:flow` — selfcheck + the content ratchet, 1.7s.

### Measurements that decided things

- **The cheap formula was refused, and it deserved it.** `traffic × att × headroom × c1` scores
  **exactly 0 for every bottom-side technique**: `startPosTraffic` keys through `_posSlugIndex`,
  which maps a position to its TOP member (136 of 272), while 2,071 outcome cells land on bottom
  members. Simulated on a bottom player who had drilled 90 bottom decks: **0 of 90 changed
  score**, and their "15 weakest" came back as fifteen guard-passing techniques. The obvious
  repair fails too — **136 of 136 hubs give top and bottom identical traffic**.
- **EDGE cannot carry a weak-spot score.** `_evShift` subtracts an attempt-weighted hand mean, so
  `Σ att·EDGE ≡ 0` at every state by construction. Build in Q.
- **`c1` is `int(round(100·(A−B)))`** — the win-vs-lose swing, ×100 and integer-rounded, one per λ.
- **Policy evaluation ≠ the shipped argmax solve.** Under argmax every dominant state compresses
  to `p_win ≈ 0.98`; under the played policy `mount/bottom` is −0.281. `sol.v` is unusable here.
- **The adjoint IS the derivative**: verified against finite differences to **1.9e-09**; ~50ms for
  all 1,500 decks; linearisation recovers 93–107%, so the shown shortlist is re-solved exactly.
- **18 decks are negative**, and the list is the Eddie Bravo rubber-guard ladder — `New York to
  Invisible Collar` (A−B = −0.943), `Crackhead Control to New York`, `Progression to Zombie`,
  `Lockdown to Vaporizer`. The owner's own example, derived rather than asserted.
- **A fixed denominator was wrong.** Tiers as shares of the blank-profile total made the called-out
  count GROW 37 → 94 → 236 → 570, because mastering decks makes every remaining deck worth more
  (V₀ 0.079 → 0.385). Against the CURRENT total the list is stable, a mastered deck scores exactly
  0 and leaves it, and recoverable value falls **0.862 → 0.425**.
- **The gradient is a slope and does not know the cap.** Without scaling by remaining headroom,
  `Side Control|Top` stayed #1 after being mastered.
- **JS vs Python**: identical 1,500-deck set, top-40 40/40, top-10 order identical, negative sets
  identical; V₀ within 0.457%. The residual is entirely the wire's `int(round(att))` — `p0` is
  bit-identical, and the worst case is `Back Control to Cross Body Ride`, 0.01299 → 0.01000 (23.6%).

### The ledger — rolling becomes a write path for the first time

Nothing about a roll survived a reload: `_progressBlob()` had 16 keys and `rollLog`, `_pastRolls`
and `_exploredKeys` were all absent (so the "very weak" tier was empty on every page load and
silently degraded to "weak"). One hook, at `resolve()` immediately after `drawOutcome` — the only
point where state, move, verdict and landing coexist in scope. Stored as a **per-device G-Counter**
because counters are the one thing the blob's per-key MAX merge cannot carry: two devices at 30
rolls each are 60, and MAX reads 30; plain SUM double-counts on re-pull. Merged per-device by MAX,
summed across devices at read time. Move identity is the permanent share ordinal, never an array
index. 6 devices LRU, 180-day hard window. `_saveFlowSoon` gives it a 6s trailing debounce so a
continuous roll does not `JSON.stringify` a 1.3MB blob per exchange.

### Estimation, and why per-cell was never on the table

5.23 my-turn decisions per roll, so at 50 rolls **0 of 1,246 (state, move) cells reach n≥8** — but
the 8 states that do carry **43% of all traffic**. Four levels, all shrinking to the prior at n=0
so cold start is a continuous deformation rather than a second code path: a global execution
offset, a conditional-logit tilt on the authored attempt distribution, per-state Dirichlet
refinement where counts allow, and per-technique rates pooled across states. `pseudo_count = 8`,
the repo's own `folded_rate` constant, for the reason `calibrate_probabilities.py` already gives.

### The UI, in the owner's words

*"Instead of showing very weak and weak spots at the same time… it should only show one or the
other"* — measured, the two-tier string was `"4 very weak · 1452 weak spots"` and wrapped on an
88vw drawer. The row became **Mastered / due / new**, the three states any card is in.

*"The daily new max goal is the default daily goal… ideally we aim for 30 flashcards — or what
does the literature on SRS say?"* — Anki pairs 20 new/day with a 200 reviews/day cap because
steady-state reviews land near 10× daily new, so a 30-card budget supports ~3 new cards a day, not
30. `dailyGoal` became a CARD budget: due cards are spent first and the remainder buys whole
techniques off the ranking. With 30 due it deals **0 new** and says why.

*"When we click to show them, it should show the same interface… 1. The maintenance ones… 2. Only
afterwards, the new techniques… 3. We can show more techniques that load on infinite scroll, but
they should be ranked and ordered by that metric."* — `openPlanSession(anchor)`: one queue,
Maintenance → Learn next → More in order, both stat cells opening it at different anchors.

Also this cycle, from the same review: the session surface became the inline Last-rolls accordion
(`←→` cards, `↑↓` techniques, space flips, green tick and auto-advance on completion, no "Start
session" gate and no full-sidebar takeover); the stat band moved from three `1fr` columns with
`justify-self` to `space-evenly` (measured 12px edge gaps against 56px internal — the owner's
"overglued to their edges"); `openDueSession()` collapsed two divergent labels for one queue; and
the logo's focus ring after a mobile tap was gated on a last-input-modality latch, because a
script `.focus()` on a `<button>` makes Chromium paint `:focus-visible` for a finger.

### Content finding — blocks the backfiring badge

`invisible-collar/bottom` is authored as the back-mount **victim** (Defensive, its hand is all
escapes; `/top` carries Rear Naked Choke at att 37, Back Control Maintenance, Bow and Arrow) while
the rubber-guard ladder points at `/bottom` as the **attacker**. Two different techniques share the
name: the graph's `invisible-collar` is a back attack, Bravo's is a choke from rubber guard. It is
the largest single distortion in the model (−1.012 and −0.858, the two worst rows in the audit) and
the reason that ladder tops the negative list. Recorded in
`tests/artifacts/flow_validation_baseline.json` with the full reasoning; a content decision, not a
model one.

### Free fixes that fell out

- `weakSpots().top` feeds the weekly digest headline and inherited the old rule's alphabetical
  order, so **the digest has been telling every fresh user their softest spot is `100% Sweep`**,
  forever. It is now the heaviest, `Side Control|Top`.
- The daily dose (`bucketTechniques("suggested")`) capped an unordered pool, dealing `100% Sweep`,
  `3-4 Mount…` and then sixteen varieties of `Americana`.
- `bucketTechniques("mastered")` now returns the same set `masteredCount()` counts.

### What it inherits, said out loud in the copy

The solve is no-gi while gi is the default ruleset (146 nodes carry a differing rate); the opponent
it prices is `opponentDefend`, which filters neither role nor origin, compounded over 11 plies
instead of one; the 1,326 Defender decks are unscored because drilling does not change the
opponent's rates; and `gameScore` weights all 272 position decks at **zero** while FLOW's top ten
are all positions — two published numbers that will disagree, on purpose.

## v1.138.0 — THE EXPIRY SENTENCE IS A LEASE, NOT A RESIDENT

### THE EXPIRY SENTENCE IS A LEASE, NOT A RESIDENT (v1.138.0)

Owner: *"The 'Answer revealed · −4% on this exchange' banner stays pinned while exploring other
cards/nodes — clear or fade it when focus moves to another card (or after ~5s)."* The announcer
recon confirmed the gap: the two expiry sentences were the only long-lived lines with NO owner —
`_evCountdown`'s machinery never touches them, and all five focus-move seams left them standing.
Fix, in the announcer's own stamped-owner idiom: `_evExpiry` is set right after each expiry
`setEvent` (which releases every stamp on its way in, so a successor sentence can never be faded
by a stale lease), dropped by ONE seam (`_dropExpiryEvent`) from the five focus moves —
staging, roam, the option sheet, the dossier, deck paging — and aged out at ~5s by the frame
loop, with the `.ng-evtoast` CSS easing the fade. Mutants Md (drop seam no-op), Me (5s fade
removed), Mf (setEvent not releasing) killed by the new announcer spec.

## v1.137.0 — THE CLOCK WAITS FOR THE PLAYER

### THE CLOCK WAITS FOR THE PLAYER (v1.137.0)

Owner: *"The drill countdown starts during page load — a first-time Guest can land on 'TOO
SLOW · −4%' before ever interacting … no drill timer starts until the user's first real
interaction AND the question card is fully visible; add a first-session grace multiplier
(~1.5×) for brand-new users. Keep full time pressure once engaged — the pressure is a feature,
the loading penalty is the bug."*

The v1.134.0 pause-immune clock made the load bite: the window armed at question mount and
drained through the boot itself. Now `_armLandClock` refuses to arm until `_clockGateOpen()` —
`_engaged` (a document-level once+capture latch on pointerdown/pointermove/keydown/touchstart;
a wrap-scoped listener measurably misses hovers over root-plane overlays) AND the card visible
(`_landHidden()`'s holders). An early arm parks and refires from `_engage` or the tick. Two
findings en route: (1) the park initially held the clock-bar ELEMENT, which the deck backfill's
re-render detached — the disarm then styled a bar nobody saw (transition "" on a
correct-looking build); the park is a flag now and the bar resolves at arm time from the live
card. (2) The grace multiplier reuses `_returningVisitor()` — the one latched definition of
"been here before" — so every fresh-profile e2e window is 13.5s, not 9s. `j.land()` now ends
with a real corner mouse-move (`j.engage()`), since a journey that lands is simulating a
playing user; the three boot-only clock specs engage explicitly.

The feature cost 2,012 raw bundle bytes and pushed the first-hand gzip 104 over its 385,000
ratchet. The ceiling stands: the review's #1 cheap win paid the bill instead — Sora and Archivo
(dead since applyFont hard-coded Space Grotesk; the fontStack map had no callers) left both
font links and the bundle, plus small shaves (shorter seam names, the useless passive flag, a
plain ease on the bar reset). Green at the same ceiling, and production browsers stop
downloading two font families.

Mutants Ma (gate dropped — arms on mount), Mb (grace dropped), Mc (latch removed) killed by the
new landing-card spec. Gen suite not re-baselined (its clock-timing rows will shift).

## v1.139.5 — THE STATE'S NAME IS THE PAGE'S HEADLINE

Owner, mid-roll: *"the announcement of, for example, 'Answer revealed · −4% on this exchange'. This
is larger than the current label of the current node, and it shouldn't be the case. The current
node is the fucking URL of the page, the fucking node of the page, so it should be absolutely the
biggest text that's shown on this page, not the announcement."*

It was. The announcer shipped at **22px** from the original design import (`9c01f1dbe`, "Neural
Graph Phase 0.2") and the focused pair label at **18px** — set last in v1.128.0 with no reference
to the toast. Neither number was ever a decision about the other.

Three findings made it an inversion rather than a preference. The canvas pair label is the **only**
place the current node is named during a roll: `renderLandCard` carries no header (v1.101.1)
*because* "the graph names the focused node beside it", and v1.132.0 removed the attempt card's
header for the same stated reason — the layout had already bet on that label being the state's
name. **18 of the 40 `setEvent` call sites pass a node title as their text**, so 45% of the
announcer's traffic was the app printing a name larger than the node printing the same name; in the
replay-landing case the two strings are byte-identical. And everywhere else in the app the node's
name already *is* the largest thing in its container — option-detail sheet 27px, node card 26px,
dossier 22px. The 18px canvas label was the outlier. Both surfaces resolve to one family
(`applyFont` writes `'Space Grotesk'` to `evTextRef` and to `_displayFam`) and canvas labels draw
after `ctx.setTransform(dpr,0,0,dpr,0,0)`, so 22-vs-18 was like-for-like at every zoom.

### The sizes, and the bound that set them

| | before | after |
|---|---|---|
| announcer text | 22px | **18px** desktop · **15px** phone |
| focused node name | 18px | **24px** desktop · **18px** phone |

`tests/artifacts/_label_size_probe.mjs` ships with the numbers and recomputes them. 24px ellipsizes
**0 of 1006** distinct drawn names at ≥768px and **14** at 641px. The phone cannot grow at all:
`dual-pair.spec.ts`'s `@curated` `labelRight < W` at 320px admits at most **19px** — "Straight Ankle
Lock Control" ends at 316.6 of 320 — and 3px of margin on a deploy gate is not worth 1px of type, so
on a phone the rank is restored by the announcer alone.

**A premise everything upstream of this shared was wrong.** The corpus's widest *drawn* name is not
that position (238px) but **"Standing Guard Pass with Distance Creation" at 381px**, a transition:
`pairGroup` draws `splitName(t).main` for a technique and only `posFamily(t)` for a position, and
nobody had measured the second set. The in-code comment claiming the block "spans 26.5..363.5 of
390" is also arithmetically impossible — it implies a 42px drawn radius against a cap of ~3px — while
the spec header's 309-of-320 reproduces to 0.03%.

### One seam, three literals

`18` was hand-copied into the pair-group draw, `richLabel`'s `big` branch, and `_labelWidthPx`'s
`paired ? 18 : 17`. That third one is a *measurement* of what the draw will do and feeds
`rollCamTarget`'s phone framing — and `dual-pair.spec.ts` reads **the measurement, not the render**,
so changing the draw alone would have left all four `@curated` phone tests green while long names ran
off the right edge (§6.5). All three now call `nameFontPx()`; the mirror had already drifted, since
`richLabel` draws `big` at the focus size and 17 was simply wrong. `_labelWidthPx` is only ever
called on mobile, where the value is unchanged, so the phone framing gate is byte-identical.

Two derived constants followed. The `subY` clearance literal `18` was an 18px name's ascender height
plus air — measured, that name reaches 13px above its baseline and a 24px one reaches 18px, so the
old constant would have put TOP/BOTTOM exactly *on* the new name's ascenders; derived, it reproduces
18 at 15px and 18px and gives 23 at 24px. `NG_LABEL_LEAD = 15` was checked and **left alone**:
descent 4→5px against a qualifier ascent of 8px leaves 2px of air at 24px, so `graph-naming.spec.ts`'s
five-decimal pin was not relaxed.

### The announcer's size is written at runtime

It needs a breakpoint, and `xdc-template.html`'s own `<helmet>` is **stripped by `build.mjs`** — the
shipped stylesheet is `helmet.html`'s, and the two `@media (max-width:640px)` blocks have already
drifted apart (18 lines against 40). A CSS rule would have to be duplicated into a file the app does
not read. So the template's `font-size` is now a documented **first-frame guess** (the
`.ng-optionrow` / `_dockLandFilm` idiom) and `_applyTypeScale`, driven from `resize()` where `this.W`
is set, is what holds. Side effect, deliberate: `rollCamTarget` takes the free band's top from the
toast's *measured* rect, so the shorter toast hands the graph back the room it was eating — the
owner's sentence went from two lines to one and every roll frames higher.

### Payload: net −29 gzip

Measured A/B with everything else held constant: the JS costs **+169**, and deleting **13
verified-dead `.ng-challenge-cue` rules** returns **−198**. The selector needs
`.ng-tut.ng-challenge-cue`, the only `className` assignment in the app is `"ng-tut"`, and
`grep -c ng-challenge-cue` on the shipped `neural.js` returns **0**. `.ng-cue-head` and
`.ng-cue-detail` went with it — same subtree, same evidence.

### There were no gates at all

Setting the announcer to 40px and the label to 6px turned **zero** specs red across 70 journeys, 98
gen specs, 20 probes and 5 unit tests. Nothing asserted either size, or the relation between them.

`tests/neural_type_scale.test.mjs` (pure node, `ci-validate.yml` on every PR) pins the ordering at
ten viewports, that all three draw/measure sites read `nameFontPx()`, and that the template's guess
matches `announcerPx()`. It instantiates with `new Component({})`, **not**
`Object.create(Component.prototype)`: these are class *fields*, so the prototype route reads
`undefined` and every comparison would compare `undefined` with `undefined` — a check that never ran,
reporting clean (§6.6). `announcer-coherence.spec.ts` gains one `@curated` test at both viewports
reading `_lastPairLabel.namePx` — the render's own published output, the `this._LY = LY` pattern —
against `getComputedStyle` on the toast, which is the only oracle that sees the runtime write beat
the template's guess.

Mutants killed: announcer back to 22px (2 tests); `NG_NAME_PX` back to 18 (2); `_applyTypeScale`
never called from `resize()` (1, phone); `_labelWidthPx` re-mirroring by hand (unit); the publish
dropped (unit). **One survives and is recorded in the spec header**: `namePx` lying *upward* still
passes, because a bigger reported name cannot falsify a "the announcer is smaller" claim — the unit
test is what pins the published field to the variable the draw used.

`dual-pair.spec.ts`'s `above` band was cut for an 18px name and caught the 24px name's own
ascenders, so "nothing is above it" went red on a correct build — §6.3's *"an assertion stricter
than its own claim"* exactly. The boundary now comes from the published baseline and size, so it
tracks any future change and returns the historical bands at 18px. Its mutant (the role word forced
to the above side) was re-run after the relaxation and still kills it.

### Notes for whoever is next

`Space Grotesk` is **never loaded**: the built pages request only JetBrains Mono and Plus Jakarta
Sans, and `build.mjs` deliberately does not carry the `@import` into `neural.css`, so every
`'Space Grotesk', sans-serif` resolves to the fallback. It does not affect this change — both sides
share the family string — but no measurement of these labels is a measurement of Space Grotesk.

Found and **not** fixed here: the toast prints raw `n.t` ("Mount Top") where the canvas prints
`graphName` ("Mount"), the one surface that never went through it; `" stuffed"` / `" reversed"` are
concatenated *before* `setEvent` splits on `" from "`, so the verb that says you failed lands in the
dim sub-row; `_labelWidthPx` measures `displayName(n)` while the pair group has drawn
`splitName().main` on its own row since v1.129.0; `richLabel` has no `_fitText` and no width bound at
all; and `docs/Neural.md:267` still documents `HESITATE_HOLD`, which no longer exists in any build
input.

The app-side half of this change landed in `1d3a17eaa` (v1.138.0, FLOW), which swept
`neural/src/app.src.jsx` up while this half was still in the working tree — a shared-worktree
accident, not a decision. v1.139.5 is the rest of it.

## v1.136.0 — THE SHEET IS THE CARD YOU PRESSED, AND IT FINALLY OUTRANKS IT

### THE SHEET IS THE CARD YOU PRESSED, AND IT FINALLY OUTRANKS IT (v1.136.0)

Owner, pasting the sheet's DOM: the EDGE explainer paragraph "is not supposed to show to every
user every time … needs to be a small, almost noticeable tooltip near the number"; the
from→to title ("Headquarters Position → open-guard") is "unreadable … the technique's own name
should really stand out"; the glyph "used to say 2, and now it just shows the transition icon";
and the landing card "magically disappears — it should be BEHIND the maximized card".

Shipped: the head keeps the option card's anatomy verbatim — `catGlyph(n, num, col)` with the
tray digit (recovered as `_optList.findIndex(o => o.idx === opt.idx) + 1` — the deal order IS
the digit order, verified against both deal sites), the category word at 10px/.05em, the
technique's own `splitName().main` as a 27px title with the `from …` qualifier under it, and
the explainer as a `title` tooltip on `.ngedgebig` (aria-label shrank to the NAME per the
app.src.jsx:5900 convention; the by-the-book-opponent caveat kept — canon). The landcard hide
in `expandOption` — §6.1's last leaky site — is deleted outright, with its two restore sites
and the backfill's opacity-inheritance dance.

**The ultracode adversarial pass paid for itself three times before the suite ran.** Five
parallel skeptics attacked the diff: (1) CONFIRMED — "z:6 over z:5" compared integers across
two stacking contexts: the sheet was `absolute z:6` INSIDE the fixed wrap (trapped at plane 0)
while the landcard is a ROOT-plane sibling at z:5 that paints over the whole wrap — the very
inversion the repo measured three times before. Fix: the sheet PORTALS to the root plane at
z:50 (coaching band, under the picker's 90). The first spec cut had asserted
`parseInt(panel.style.zIndex) > 5` — a §6.3 re-implementation that passed green on the broken
build; both specs now assert paint order with `elementFromPoint`. (2) CONFIRMED — widening the
on-success line's `!tp` gate exposed `opt.res` (a deal-time first-position-neighbor heuristic)
on 188 of 323 "X to Y" transitions, 28 printing a node that is no authored outcome ("Closed
Guard to Omoplata" → "advances to Clamp Guard Top"); the gate is restored, the title stays the
technique's own name. (3) CONFIRMED — `coldstart-backfill` still pinned the old hide (my own
8-spec impact run had missed it); rewritten to "arrives VISIBLE behind the sheet" with the
paint-order oracle. (4) num derivation NOT refuted (dealt order = digit order at both deal
sites; pair dedup by title keeps idx unique per hand; `showNum` gates 0 safely). (5) tooltip
convention violation CONFIRMED — the aria-label still carried the description clause; shrunk
to "EDGE +N".

Mutants M16–M20 (explainer restored · title dropped · digit dropped · hide restored · portal
dropped) all killed by the two rewritten specs.

## v1.135.1 — THE EXPIRY STOPS FLASHING, AND THE COMMIT GETS ITS CAMERA

### THE EXPIRY STOPS FLASHING, AND THE COMMIT GETS ITS CAMERA (v1.135.1)

Owner: *"There's this weird flash where the landcard disappears and a new landcard appears
again."* A MutationObserver probe cleared the DOM (same card element, question block intact
through expiry) — the flash was CSS: `.ng-clock-hot`'s `animation` shorthand replaced the
card's `ngCardInX` entry animation, and Chrome replays the finished entry from zero when the
shorthand changes at class removal. The first fix kept ngCardInX at index 0 of the hot list
(name+position continuation) — and its spec went red anyway, which exposed the ORACLE as the
liar first (pumped advances outrun the wall clock, so the "replaying" check was catching the
genuine mount animation; a 450ms wall wait fixed the spec) and motivated the sturdier
mechanism regardless: the pulse is now FRAME-DRIVEN border/box-shadow writes in
`_tickDecision` (`ng-clock-hot` survives as a marker class with no rule), and the disarm eases
the glow AND the clock bar off through one-shot transitions — the bar sheds the hot red for
the base color it was armed with (`_clockBase`), per the owner: *"It should be fluid. It
shouldn't be abrupt."*

Owner: *"when I pick one of the options, the camera doesn't immediately follow the signal
that's pulsing … only after a few iterations … does the camera follow again."* Root cause is
the §6.5 latch verbatim: `userActiveNow()` — 4 game-seconds since `lastInteract` — is the one
condition that suppresses the follow-cam, and the pick's own click wrote it; the "few
iterations" were the window draining. `enterAttempt` now ages the latch out
(`lastInteract = now − 5`) and releases any focus lease — the camera-ownership doctrine's own
"asking to go somewhere else is a decision" case, applied to the commit.

Mutants M13 (JS pulse dropped — first attempt was a botched no-op mutation, redone cleanly),
M14 (bar snap) and M15 (camera hand-off dropped) killed by the two new specs.

## v1.135.0 — THE ROLE WORD RIDES ITS ORB, AND SPENT MEANS SPENT

### THE ROLE WORD RIDES ITS ORB, AND SPENT MEANS SPENT (v1.135.0)

Owner: *"why does top mount look red like i'm going to lose?"* The investigation cleared every
layer it suspected — the 7-day-old dev server serves from disk per request (current bundle
byte-for-byte); the wire prices Mount `[+0.629, −0.693]`; ingest colors each pair member by its
own side (`sv`); and a pixel probe at three LODs read the top orb blue at roll zoom
`[130,190,255]`, mid, and overview `[70,134,248]` (the red twin fades out before the collapse).
What the probe DID find: the pair label anchored "TOP · Mount" at the pair midline — measured
33px from the blue orb it names and 33px from the red bottom orb below it — so the eye could
bind the label to the red one. Fix: the role word now sits at its own member's drawn y
(`subY = min(nameY − 18, orbY + 4)`, mirrored below), clamped to the block's clearances so an
ordinary ~35px pair is unchanged within 1px and the wide roll-zoom split (66px on Mount) moves
the word 17px to its orb. `_lastPairLabel` gains `subY`; the `strips` bands in dual-pair
widened to reach the orbs (near edge −6 → −8, clear of the word's own ascenders at the orb
line). Probe: TOP at y75 beside the orb at y71, name pinned at 110.

Owner, second report: *"when i click a wrong answer after i run out of time it shouldnt lose me
points as it already did."* Real double-punishment: `_expireLandQ` took the miss (−4%, combo
break, failed review) and set `aria-disabled` + `this._mc = null` — but the MC closure's own
`answered` latch never learned it, and `_mcAnswer` takes `truth || this._mc`, so the buttons
still graded: a late wrong click charged −4% AGAIN (−8% total), broke the combo again, wrote a
second failed SRS review, and emitted `land_q_answered` after `land_q_expired` (a funnel
contradiction). Fix, one seam each way: expiry sets `truth.spent` (the closure door `answer()`
now consults), and `_mountLandQ`'s `done` refuses a spent rec (belt-and-braces, recorded as a
non-kill in the spec header — unreachable while the primary guard stands). The recall and panic
formats were already inert post-expiry (their grade rows live behind the reveal button expiry
hides — `display:none`, out of hit-testing). Probe after fix: expired once at −4%, late wrong
click → zero beats, qMod unchanged, combo unchanged, button unmarked.

**Second wave, same session.** Owner watched the fixes land and pushed four more: (1) *"after
the correct answer is shown, you can't get further deductions … it should appear red when he
clicks it. The previously red answer … should appear non-red"* — post-resolution clicks now
EXPLORE: pure repaint through `explore()` in `_mcBlock`, red rides the last clicked wrong, green
never moves, zero beats (the guard that had made spent blocks fully inert was one message too
strict — silence read as a dead card). (2) The panic drill became MULTIPLE CHOICE — `_mcBlock`
surface `"panic"` with its own rng tags and `data-panic-mc-opt` handle (a new surface that
forgot its tag would eat the sidebar's rigged queue), the reveal/Got-it idiom kept as the
cold-pool fallback with a one-attempt warm upgrade (an MC-incapable deck must not loop
render→warm→render). The first cut crashed on grade: `_mcAnswer`'s button-union selector never
learned the panic handle — an empty NodeList and a TypeError that ate the disarm, caught by the
probe's pageerror line. (3) The "+7 Tilt toward winning" legend row (v1.133.0) deleted — owner:
*"it's over designing — the bar already shows that nicely"*; the EDGE explainer survives in the
option sheet. (4) The Win–Lose bar 210×9 → 165×7 (*"at least 20% smaller"*).

Also fixed en route: the first spent-guard cut keyed on `rec.answered`, which a sheet-open
DECLINE also sets — so backing out of a sheet and answering honestly stopped paying
(keyboard.spec.ts caught it). The guard now keys on `rec.revealed`, set only by expiry: declined
is un-revealed and still answerable; revealed is spent.

Mutants M9 (midline revert), M10 (spent guard dropped), M11 (explore no-op) and M12 (panic MC
dropped — its kill also exposed the warm loop) killed by named specs.

## v1.134.0 — THE TRANSPORT DIES: THE GAME GOES FULLY TURN-BASED

### THE TRANSPORT DIES: THE GAME GOES FULLY TURN-BASED (v1.134.0)

Owner, completing the inversion: *"the play and restart button is now irrelevant … the user can
only choose to answer or close the window to not answer … the pause would pause the elapsing
time to answer a question, and that's our test to the user."* With v1.133.0's hesitation branch
gone, nothing ever advanced without a commit — the transport controlled nothing. Deleted: the
play/pause and restart buttons, Space's pause toggle (and its Shortcuts-tab row), `updateTransport`
and its refs, and the Last-rolls current-row pause/resume toggle (archived rows keep "roll from
here"). `setPaused` survives as internal MOTION
state only (staging pauses, committing unpauses); the question clock ticks on the real frame
delta and cannot be paused by anything.

**Declining is free, one seam.** `_declineLandQ` — the ✕, a background tap, the pane, the option
sheet, entering a defense: all put the question away spent-but-ungraded (`land_q_declined`,
mapped to the funnel's question_ignored side-mark). The penalty exists only for expiry while the
question faces you, and the last three seconds now pulse the card itself (`ng-clock-hot` —
"I don't see time running out pressure", owner; verified live at 2.2s remaining).

**The background ladder** replaces the v1.129.5 stand-down/restore latch pair wholesale: click 1
closes the card (`land_dismissed`), click 2 is FREE ROAM (`_enterRoam` — roll archived if
played, tray cleared, camera pulled back 1.5× centred on the seat, the whole screen available
since no card band remains); any stage ends roam. `_standDown`/`_bgRestore`/`_bgDown` are gone;
`_landHidden()` asks three holders now.

**The staged exchange loses its play-latch.** Attacker side: the technique's own card in the
hand is the go — action accent, commit verb ("Finish it" / "Execute"), glided into view, order
frozen — and committing it executes IN PLACE: the pulse path is `[tech, tech]`, fixing the
owner's "the signal mysteriously goes back to the previous position, travels all the way to the
current node" report, while the travel label yields to the pair label (the v1.132.1 exclusion,
applied to the pulse — the "just 'armbar', tiny" report). Defender side: the rush starts ON
CLICK — `enterDefense` runs straight from the staging landing, with the stale landing card
declined and cleared first (a live-probe catch: with no defender cards the old landing card
survived into the rush and its late-docking question mounted over it). The category eyebrow
tracking dropped .16em → .05em, closing review finding #11 (SUBMISSION never truncates; verified
corpus-wide in the probe). The Win–Lose meter mirrored at the writer: Win (blue) left.

**Fifteen more spec files relearned the shell**, including share-camera's transport-reach test
(rewritten around the band's surviving tenants), keyboard's Space claim inverted, pane-law's
frozen-clock assert inverted into the decline claim, and roll-card's stand-down journey rebuilt
as the background-ladder journey.

## v1.133.0 — THE CLOCK MOVES TO THE QUESTION, AND THE CUE CARD RETIRES

### THE CLOCK MOVES TO THE QUESTION, AND THE CUE CARD RETIRES (v1.133.0)

Owner, inverting the pressure model: *"Pressure should not be on the choices. It should rather be
that the choices are fun to click. … when the clock runs out, the algorithm doesn't choose for
you. You still choose. … What does happen automatically is that the right choice and the wrong
choices are revealed … You get penalized if you don't click the right answer or click 'Show' in
time."* Clarified by four answered forks: the panic DRILL carries the clock and the escapes are
untimed; committing past an open question is a FREE SKIP ("the clock only punishes sitting
there"); expiry counts as a wrong answer (combo break, −4% this exchange, SRS miss — the answer
was shown, so the card is spent); and from blue belt up the timed in-play format is recall Q/A,
not MC.

**THE MECHANIC.** `_decision` still carries pick/opts per landing, but its timer arms only when a
question MOUNTS (`_armLandClock`, from `_mountLandQ` and the panic drill) — a landing that asks
nothing has NO clock. Expiry (`_expireLandQ`) reveals the mounted block as a miss (correct option
lit, keyboard disarmed, recall answer shown) and the HAND STAYS LIVE. Retired with the hand
clock: the v1.123.0 Hick's-law knee (`NG_DECISION_KNEE`/`NG_DECISION_K` deleted — the window is
one flat `decisionSec`), the v1.129.0 hesitation branch (`hesitated`, `HESITATE_HOLD`,
expiry-`opponentDefend`), `refundDecision`/`timer_refund` (three callers and a sound patch went
with it — answering IS what the window was for), and the DEFENSE expiry-tap (`onExpire: finish` —
being slow on the drill no longer loses the round; only a failed escape does). The per-card
`ngbar` drain is gone: option bars are static EDGE colour and the clock lives on the card's own
`[data-land-clock]` top-edge bar, rebound across backfills, per-landing across paging.

**THE DANGER PASS, same sitting.** The panic card was rebuilt in the landing card's recall
anatomy under the danger skin (owner: "should look like a ng-landcard, rn it looks ugly");
"Pick an escape — or drill defense" became "Caught · <name> locked in — drill to loosen it";
the vignette deepened (core 52%→68%, peak .3→.5); `_dangerSet` fogs everything but threat + seat
+ escapes through the existing fogSet seam; `frameNodes` frames the exchange; the brand logo
yields while the vignette burns. The White Challenges cue card is RETIRED (owner: "remove the
learning card") — `renderChallengeCue` survives as a remover, the settings row is gone, the
engine and the pane are untouched, and §6.1's long-standing STILL OPEN phone collision closes by
deletion. EDGE is finally taught: a legend row ("+7 · Tilt toward winning") and a caption under
the sheet's big number, both carrying the mandated by-the-book-opponent caveat. Quick wins from
the design review: "1 very weak spot" pluralized with the tiers named on hover, the familiarity
chip got a real accessible name, Hard/Ultra locked buttons became one honest sentence, the
Challenges tab belt shows its count, the loader says "Loading the graph…" with role=status.

**THREE TRAPS MET.** (1) A deletion bounded by "up to the next `_tickDecision`" swallowed the
three method definitions that had just been inserted before it — pass-ordering matters when an
edit script's landmarks are its own earlier output. (2) `querySelector("[data-panic]")` on the
panic card returned null — the card IS the `[data-panic]` element; root-attribute checks need
`hasAttribute`. (3) The drill armed against the OLD `_decision` because `buildPanicCard` runs
before `enterDefense` creates the fresh window — arming moved to after the window's birth.

**GATES.** Seven mutants, seven kills (expiry-costs-nothing, expiry-clears-the-hand,
skip-breaks-combo, blue-gate-dropped, drill-never-arms, bars-drain-again, never-arms). Sixteen
spec files rewritten to the new law — including stakes-impact's loss leg, which had relied on
the retired defense expiry-tap and now loses the honest way, and coldstart-backfill, whose
"still their turn" read inverted into the sharper claim: no question on the table, no clock over
it. The replay digest moved legitimately (the beat stream lost timer_refund/hesitated and gained
land_q_expired) — the new sha is recorded in the release commit.

## v1.132.2 — RECOGNITION COMES FIRST: EVERY DECK BUILDS A MULTIPLE CHOICE NOW

### RECOGNITION COMES FIRST: EVERY DECK BUILDS A MULTIPLE CHOICE NOW (v1.132.2)

Owner, meeting v1.132.1's recall fallback on the Americana card: *"It should have shown me
multiple choice. Same thing as with positions: I'm matured and I've solved multiple choice …
and then I finally start to show actual Anki flashcards. Instead of multiple choice, we up the
difficulty and start showing flashcards, so the person must know the answer … not recognize it
anymore with MC starting off."* Recall at stage 0 inverts the recognise-first progression — the
fallback treated a content defect as a format choice.

**THE FIX IS ONE LINE IN THE EMITTER, AND IT CLOSES THE WHOLE WORKLIST.** `_qa_cards`'s display
answer fell through to the FULL text when no `answer_line` existed and the first sentence
overran `_mc_clip`'s 160-char cap — **1,707 cards across 532 decks (18%)** shipped paragraph
display answers, and a 411-char `a` starves the app's MC length filters (every candidate fails
the 0.4 ratio floor against it; the app's own `mcClip` nulls the same first sentences, so those
answers contributed nothing as distractors either). `_hard_clip` — word-boundary truncation
≤150 + ellipsis, full text preserved in `d` — makes every display answer one-line-comparable.
Measured: cards over 160 chars **1,707 → 0**; `validate:mc` **96.3% → 100.0% viable, worklist
110 → 0**; the owner's exact page deals a 4-option MC with option lengths 77–161 (no length
tell). Progress is untouched by construction: stage/srs/prep key on `qhash(card.q)`, and the
question text did not move.

**The recall fallback (v1.132.1) survives as a last-resort safety net with NO live trigger in
this corpus** — journey 5b now pins MC specifically (`mcOpts ≥ 3`, `recall === false`), and its
M8 mutant moved from the app to the EMITTER: revert the `_hard_clip` line, re-emit, and the
journey goes red (proven). A truncated line is not beautiful; it is honest and comparable —
authored `answer_line` (Phase B) remains the quality upgrade.

## v1.132.1 — THE TECHNIQUE CARD WAS CHROME-ONLY, AND ALL THREE CAUSES WERE MEASURED

### THE TECHNIQUE CARD WAS CHROME-ONLY, AND ALL THREE CAUSES WERE MEASURED (v1.132.1)

Owner, standing in Kimura Trap and clicking Americana: the card was empty ("the land card has no
content"), the shorts were missing ("there are no YouTube short videos"), and the technique's name
printed twice on the graph. Asked whether the gaps were general: yes — and measured, each one.

**1. THE FILM WAS IN THE CHUNKS ALL ALONG — the card never read past `info.clips`.** Source
coverage: 1,393 of 1,394 technique files carry clips (2,716 authored arrays); emitted chunks carry
them under `perspectives.{attacker,defender}.clips`; the card read only the top level, which
**1 of 1,326** technique entries has. Every position slot (136/136 Top + 136/136 Bottom) has
top-level clips, which is why the gap was invisible until the technique became a card subject.
Fix: `filmClips = info.clips || perspectives[side].clips`, side = the staged side — the escaping
orb shows the defense reels. (The `_landMoreHTML` "blk.clips || rc.clips" comment in
`_neural_content.py` named a reader that lived in the retired `renderDossier`.)

**2. THE MC STARVATION IS CONTENT DEBT, AND THE APP IS RIGHT TO REFUSE.** The failing deck's
first answer is **411 chars** (no `answer_line`; the emitter's `_mc_clip` fallback rejects first
sentences over 160 chars, so `a` fell through to the full paragraph). Against a 411-char correct
answer the 0.4 length-ratio floor rejects 8 of 9 same-deck siblings and essentially the whole
corpus (position one-liners ratio ≈ 0.07) — and an MC where one option is a paragraph and three
are one-liners would be a giveaway anyway. `validate:mc`: 96.3% viable, 110-deck worklist —
but the live app refused `Americana from Kimura Trap|Attacker`, which is NOT in the worklist:
the audit's model is more generous than the live warm loop. The app fix: an attempt-mode card
falls back to the RECALL block (any answer length), the same fallback paging already used — a
deliberately-opened card is never chrome-only. The content fix (Phase B answer_line over
technique decks) is owner-gated and unchanged in scope.

**3. THE DOUBLE NAME WAS THE OPTION-LABEL PASS.** The staged technique is a dealt option AND the
focus — a state no code path could produce before v1.132.0 — so the pair group and the
option-node label both drew at one orb. The focus/hover passes already yield; the option pass
never needed to. Diagnosed through the published `_lastPairLabel`/`_lastRichLabel` (both said
"one label drew" — which is exactly what proved the extra text came from an UNPUBLISHED pass)
plus a 2x crop of the screenshot. The pass now skips the focused pair and **publishes
`_lastOptLabels`** (the v1.129.x renderer-publishes-what-it-drew seam), which is what makes the
exclusion gateable instead of probe-only.

**Gates.** Journey 5 extended (never-empty shape, no-second-label, perspective-film) + journey 5b
(the owner's exact Americana page). **Mutants M8/M9/M10, all killed — with one lesson:** M8
(fallback dropped) SURVIVED the first pass because journey 5's technique builds its MC fine — the
kill needed a genuinely starved deck, so 5b boots the owner's exact page; its mc-OR-recall shape
stays green if Phase B later makes MC viable there. Ten mutants total across the file.

## v1.132.0 — CLICKING A TECHNIQUE LANDS ON IT, AND THE RUNG IS RETIRED

### CLICKING A TECHNIQUE LANDS ON IT, AND THE RUNG IS RETIRED (v1.132.0)

The owner met v1.131.0 the same day it was committed and corrected half of it — the fastest
retirement in this repo, and the correction is a better model than what it replaces.

**RETIRED ON SIGHT: the hide/reveal rung and the visible pager.** *"I don't like that hide
answers part, and I don't like that [the ‹dots› pager] … left right scrolling should still work
to change between flashcards."* The gestures ARE the feature: swipe / trackpad `deltaX` / `←→`
all survive, the chrome and the rung do not. `_landAnsHid`, `_setLandAnswers`, `_applyLandRung`,
the reveal CTA, the Hide button, `_paintLandPager` and every `.ng-land-*` rung/pager CSS class
are deleted; the A–D gate, the `held` list, `expandLandCard` and the More handler revert. The
`landAnswers` settings key never deployed beyond this working tree, so nothing tombstones — it
simply has no reader. Bundle: the deletions PAID for the whole navigation feature below
(475,307 → 471,321 raw · 140,428 → 139,553 gzip: **net −875 gzip**).

**THE UNIFORM MODEL, in the owner's words:** *"It should be uniformized: when you click on a
transition or on a submission, you navigate to it. The URL changes to it, and the landcard is
standard"* — clarified against a proposal: card anatomy **identical to positions**, and *"if I
click Kimura, then the landing should land on Kimura, not Knee on Belly or whatever."* Plus, from
the same sitting: *"when I click a submission and I'm defending … If I click play, I want to see
that rush if someone is attacking you and submitting you, and you need to think fast."*

**WHAT WAS ACTUALLY BROKEN, measured before designing** (`tests/artifacts/_landcard_probe.mjs`,
real server, real clicks):
- A graph tap on a technique left the URL and the roll untouched ("still in the same position,
  which is unrelated") and opened the old `attempt` card — header block, auto-expanded More
  ("automatically shows more instead of showing less"), "Roll from here".
- Arriving on `/Submissions/Belly-Down-Armbar/from-Side-Control` REWROTE the address to
  `/Positions/Side-Control` — you could never stand on the technique's own page.
- Arriving on the family hub `/Submissions/Belly-Down-Armbar` resolved to NOTHING → a random
  weighted start (measured: Electric Chair Top, then Standing Position Top), roll RUNNING, with
  the address bar still naming the family. That is the owner's "I don't see the land card.
  Instead, I see this other smaller card."

**THE MODEL.** One seam, `rollFromPosition` (per §6.5's one-implementation law): when the chosen
node is a technique, the SEAT still resolves to its origin (`techniqueOrigin` — the engine's
states are positions; v1.126.0 measured what staging ON a technique node does to the hand), but
the CHOSEN node keeps `camFocus`/`camTarget`, `_syncUrl`, `focusIdx`, the flare and the card.
`_stagedTech = {idx, side}` arms the exchange — `side` derives from `playerRole` vs the
technique's `fromRole`, so the escaping orb of the pair and a `/Defender` page both seat you
defending with no extra plumbing. `enterLand` renders the technique's card (uniform anatomy) and
keeps the focus on it; `_landBackfill` learned to serve it. The `_played` latch in `_tick`
consumes the latch: **attacker → `_optPick` on that very card** (the ordinary commit path —
`land_q_ignored` cannot fire, `_landPending` is cleared first, and the technique is in its
origin's hand 99.6% by v1.126.0's measure); **defender → `enterDefense(techIdx)`** — the red
vignette, the panic card, the escape hand. `clearOptions` consumes the latch, so picking a
different card while staged simply wins. The tap handler reverts to the two-way rule (own node
reads, everything else stages) — v1.129.1's three-way rule existed only because staging used to
HOP; the hop is gone, so the rule folds back. Family hubs resolve to the family's most-connected
member (`deg` max over `id`-prefix members, reps only).

**THE UNIFORM CARD.** The attempt card's header (`[data-land-id]`) and "Roll from here"
(`[data-land-play]`) are deleted — the graph names the focused node beside it (the v1.101.1 rule,
now applied to techniques since they ARE the focus), and clicking already set the board. Nothing
auto-expands anywhere any more: `openDossier` loses both `_landOpenNext` setters and its trailing
`expandLandCard(true)` ("it automatically shows more instead of showing less"). Probe screenshot
against the ask: question + A–D + `More ▸` folded + chip + star/✕, over the origin's dealt hand,
with the graph reading "Float Passing · ATTEMPTING" beside the focused diamond.

**Two traps met on the way:**
- `clearOptions()` is a ONE-LINE method; inserting a latch-clear line swallowed its whole body
  into the trailing `//` comment — a parse error two methods later. Multi-statement one-liners
  bite exact-match edits too.
- The v1.131.0 rung CTA had silently reused `[data-land-reveal]` — the RECALL block's own
  Show-answer handle (`_recallBlock`'s `p + "-reveal"`). Never collided at runtime only because
  the rung exempted recall blocks; the retirement dissolves it. Naming a new handle: grep the
  prefix first.

**Gates.** `landcard-modes.spec.ts` rewritten (8 journeys, 4 `@curated`: paging economy, swipe,
wheel/branch-order, panic exemption, URL-kept, defender rush, attacker commit, family hub);
roll-card's tap journey rewritten for the navigation model and its journey 5 re-pinned folded.
**Seven mutants, seven kills** (economy farm, dominant-axis, click suppressor, hidden-card gate,
URL-rewritten-to-origin, defender-rush-dropped, attacker-commit-dropped). url-arrival green
UNCHANGED — the seat rules it pins all survive.

## v1.131.0 — THE LANDING CARD GETS RUNGS AND PAGES ITS OWN DECK

### THE LANDING CARD GETS RUNGS AND PAGES ITS OWN DECK (v1.131.0)

Owner, three asks in one message: a card that shows the question but not the choices until the
person clicks "Reveal answers"; "the person can scroll left or right on the land card, and it
should show the previous or the next card" — clarified to **the prev/next flashcard of the SAME
node**; and a density mode that is "not the best copywriting … in the settings, I think" —
resolved, their words: *"actually no settings is needed, the player can activate show/hide and
it'll stay the default preference."* Persistence, verbatim intent: *"fully open is never
remember[ed] … next card show it … just normal, unless user clicked hide prev time … if he left it
hidden keep it hidden next card, but if he left it fully open, keep it only normal open."*

**THE LADDER: hidden ⇄ normal ⇄ open, two flags, never both.** `_landAnsHid` (new) hides the MC
options wrap behind a 44px **"Answer for better odds"** CTA (the owner asked for incentive copy —
"answer and improve odds" — and the reveal genuinely IS the start of answering: a right answer
buys odds + 2.5s); `_landOpen` stays the More fold. ONE settings key `landAnswers` ∈
{"show","hide"}, default "show", **no Settings row** (the `cardNumbers` precedent), written by
exactly three player actions: Reveal→show, Hide→hide, More-pressed-while-hidden→show (it reveals).
More/Less from normal write nothing; programmatic opens (`openDossier`'s read intent, the
`_landOpen` restore) go through `expandLandCard`'s own open-over-hidden invariant, which flips the
flag WITHOUT writing — so exit state ≡ preference on the hidden/normal axis and "open" decays to
normal by construction, which is the owner's rule with zero teardown writes. Recall-format blocks
are exempt (already think→reveal); the panic card never enters `renderLandCard` and is exempt by
`_landMode`.

**ZERO RNG DIVERGENCE IS A DESIGN INPUT, NOT AN OUTCOME.** The hidden rung builds the MC block
byte-for-byte as the shown one — same `land-mc-*` draws, same `_warmMcPool` gate, same `_mc`
truth, same `mc_shown`/`land_q_shown` order — and only the wrap's visibility differs, so
`replay-digest` cannot move and no rigged journey can drift by preference. Pinned by a two-boot
journey (same rigged queues, pref show vs hide → identical `_mc.correct`/`n`/option texts).
`land_q_shown` gains `hidden:` (props are not serialized by the digest; the funnel reads none).
The A–D gate at the keydown handler refuses while answers are hidden — `truth.answer` stays armed
on a hidden block, so the gate is load-bearing, and deliberately extends the gate rather than
`_landHidden()` (that predicate means "the whole card is standing down"; folding the rung in
would kill paging on a hidden-rung card).

**PAGING RE-PARENTS, NEVER REDRAWS.** `_landPageTo(dir)` replaces the `[data-land-q]` block only
— a re-render would replay `ngCardInX` and race `_suppressLand` — clamped at the deck's ends (the
mini-deck's modulo wrap loses a browser's place). `_mountLandQ` is §4 of `renderLandCard`
extracted whole, so a paged sibling mounts through the identical builder; the per-landing
`_landPageCache` re-parents a seen card with its original shuffle and closures (the
backfill-reuse idiom), an answered card returning as its graded, disabled record — "scored once,
never re-asked" extended to paged cards. A cold distractor pool warms through `_landWarmP`
(replace-not-clear, so `landSettled()` still means settled), guarded by a page sequence token.
Inputs: touch swipe on `_landEl` (the drill panel's 40px/700ms thresholds, HORIZONTAL-dominant
only — the drill's vertical actions are deliberately not copied, vertical stays the card's own
scroll), trackpad `deltaX` (accumulated, ~350ms cooldown — "scroll left or right" is the owner's
literal words), a foot-center `‹ dots ›` pager (dots because the famChip beside it already prints
`done/total`), and `←`/`→` below the pane-History and drill arrow branches.

**THE ECONOMY PAYS ONCE PER LANDING, AND THE REASON IS THE EVIDENCE SEAM.** `land_q_answered` is
challenge evidence (`white.answer`) and combo has no cap — paging N cards through the full
`_landAnswered` path would be an objective farm and a ×N momentum machine on one landing. The
FIRST answered card (whichever the player paged to) IS the landing question: refund, combo, qMod,
`land_q_answered`, `_landPending` cleared — so committing afterwards fires no `land_q_ignored`.
Later answers grade as study — stage/srs/prep/`noteCardDone` all still run inside
`_mcAnswer`/`gradeRecall`, so mastery still moves the odds — and emit `land_q_extra`. The latch
is `_landAnswers` (per-landing Set of qhashes), never `_landPending`, because `_breakCombo`
clears that. `mc_correct`/`mc_wrong` were checked and are NOT evidence; `mc_shown` refires per
paged mount, harmlessly.

**THE CANON CAUGHT ITS OWN BUG CLASS ON THE FIRST RUN.** `_applyLandRung` un-hid the options with
`wrap.style.display = ""` — and the wrap's `display:flex` is INLINE (its cssText), so the empty
string DELETED it (the v1.104.2 `NG_LAND_MORE_COL` lesson, verbatim): the buttons fell back to
block layout and shrank to content width, and roll-card's "an answer spans the card's full width"
went red on the first regression pass — 208 of 488. The fix writes `"flex"` back.

**SEVEN MUTANTS, SEVEN KILLS — and the three that resisted are the findings.**
| mutant | result |
|---|---|
| M1 A–D gate ignores `_landAnsHid` | KILLED |
| M2 More writes the pref unconditionally | KILLED — after a spec fix: `_setLandAnswers` guards same-value writes, so the absent-key sentinel alone could not see it; the kill is the BEAT ("More-from-normal is not a reveal" — `land_answers_revealed` means the player revealed something) |
| M3 the hidden rung skips the MC build | KILLED (the two-boot RNG journey) |
| M4 the economy pays every answer | KILLED |
| M5 dominant-axis check deleted | KILLED — after the vertical gesture was moved past the 40px floor (dx 60, dy 140): a small-dx vertical swipe lets the floor alone reject it and the mutant survive |
| M6 capture-phase click suppressor deleted | KILLED |
| M7 the paging branch drops `!_landHidden()` | KILLED — via a background-tap stand-down (`_bgDown`), because BRANCH ORDER alone is unobservable: with the drill open the drill branch catches arrows first, and with the pane open the pane-History branch does; `_bgDown` is the one hidden-card state no earlier branch claims |

Plus one spec lesson: the first suppressor journey dispatched its synthesized click on a button
the swipe itself had DETACHED (the swipe paged, the block was replaced), and a detached node's
click never crosses the card's capture listener — the test failed against a correct build. The
honest case is a clamped-edge swipe, where the block stays live under the finger.

**WHAT IT COST, AND THE CEILING IS NEARLY SPENT.** Bundle vs v1.130.2: JS 468,186 → 475,307 raw
(+7,121) · 138,460 → 140,428 gzip -9 (+1,968); CSS 57,285 → 59,619 (+2,334) · 15,575 → 16,035
gzip (+460). Browser-measured bytes-to-first-hand: **384,661 / 385,000 gzip — 339 B of headroom
left.** The gate passes; the NEXT feature on the boot path pays a ceiling-raise commit, and that
is flagged rather than quietly pre-paid. Offline payload gate: neural eager 305,969 / 330,000
gzip. Gates: `landcard-modes.spec.ts` (7 journeys, 2 `@curated`) new; the 14-spec regression set
76/76; `test:units` 75/75; `triple_replay` 3× byte-identical.

## v1.129.8 — THE CAPTURE STAR

_Originally CLAUDE.md L2968._

### THE CAPTURE STAR (v1.129.8)

Owner: *"should the + rather be a star to add to your lists as in star to favorite it? maybe that
would make it more explicit. trade every place the + to add to lists appears and instead use a star
to trigger the opening of the list of lists menu to add such technique to a list."*

**ONE GLYPH, TWO STATES, ONE SILHOUETTE.** `_starHTML(on, px)` is the single source: hollow = in no
list, **FILLED = in at least one** (`nodeInAnyList`, never "the active one"). The stroke stays on in
BOTH states, so the outer shape never moves and the change reads as *fill arriving* rather than as
the glyph resizing — the same stroke-vs-fill pair `_caretHTML` (stroke, and it rotates) and
`_playButton` (fill) already speak. It is a SHAPE difference, so the state survives WCAG 1.4.1
without leaning on colour, exactly as `✓`-vs-`+` did.
**Behaviour is UNCHANGED**: the click still runs `captureNode → openListPicker`, which since
v1.102.0 ALWAYS opens the chooser. Only the affordance moved.

**AN SVG, NOT `★`/`☆` — measured, not taste.** `helmet.html` loads its four faces through the
Google CSS2 API, which serves latin/latin-ext unicode-range subsets; **U+2605/U+2606 fall outside
every one of them**, so `font-family:inherit` ALWAYS falls back to a system font with per-platform
metrics, baseline and weight. Tolerable for `crownBadge`'s 9.5px decorative `★`; not tolerable for
the primary state indicator on the app's most-repeated control. (`⭐` U+2B50 is worse still — Emoji
presentation, so it would ignore `color` outright.) The path is Feather's star `<polygon>`, matching
`_caretHTML`'s Feather-derived caret, and `currentColor` collapses both states' paint onto the one
property a CSS `:hover`/`:focus-visible` rule could ever animate.

**`font-size` IS INERT UNDER AN SVG, SO THE GLYPH IS A BOX — AND THREE SITES USED TO SIZE IT WITH
TYPE.** The base (13/17px), the sheet corner (16px) and the landing corner (15px) would ALL have
silently rendered at the default. `data-list-glyph` carries the px (an attribute, not a closure, so
`_refreshListSurfaces` can read it back off an element it found in the DOM) and
`_listAddButton(nodeId, surface, glyphPx)` takes the override. Boxes: **24px chip → 12**, **44px
thumb → 17** (17/44 tracks 12/24 within 6%), **sheet corner → 15**, **land corner → 14**. A star
needs +2px over a solid figure at equal box — its ink is centrally concentrated and its five points
taper to nothing — which is why 12 against `_playButton`'s 10 and `_caretHTML`'s 9 in the same chip.
The two corner figures are unboxed (no border competing, so the star reads heavier) and the land one
is a step under the sheet's because v1.104.2 requires that corner's geometry to come from the 24px
`✕`, never the 44px thumb. `landcard-chrome` pins the 14 in both attribute and rendered box.
The `44px` width string `:9644` tests is untouched, and so is the inline `pointer-events:auto`.

**`aria-pressed` IS GONE, AND THAT IS THE HONEST HALF OF THIS CHANGE.** ARIA defines it for a TOGGLE
BUTTON — one that retains state after being activated — and activating this opens a MENU and leaves
membership untouched. A screen-reader user was told "toggle button, not pressed", pressed it, and
the state they had just been told about did not respond to their press. Worse in combination: the
button carried aria-pressed AND aria-expanded, so it announced as roughly *"Add to a list, toggle
button, not pressed, collapsed"* — two state models on one control, only one of which activation
changes. The APG **menu-button** pattern is now stated outright: `aria-haspopup="menu"` +
`aria-expanded`, both set ONCE at construction, with `openListPicker`/`closeListPicker` the only
writers of the live value. **`_styleListAdd` must never rewrite `aria-expanded`** — it repaints on
every list mutation and would claim "collapsed" under an open menu.
`aria-controls` is APG-optional and deliberately NOT added: it needs the picker to carry an id, and
`openListPicker` was out of scope.
- The cost is disclosed rather than hidden: removing it deletes a machine-readable SUMMARY state.
  It is not lost — it is in the accessible NAME (announced on focus) and, per list and precise, on
  the picker's own `role="menuitemcheckbox"` + `aria-checked` rows. A summary ("in ≥1 list") belongs
  at name level, not state level, because it is not the thing activation changes.

**THE LABEL KEEPS THE VERB, AND THE ENUMERATION IS CAPPED.** A star promises a MENTAL MODEL
(favourite: binary, one tap, done); the behaviour is a CHOOSER. The resolution is that the glyph
carries the metaphor VISUALLY and the accessible name carries the behaviour — so it stays
**"Add to a list"**, never "Star", "Favourite" or "Save" ("Save" already means saving PROGRESS on
the pane anchor). No `…` in the name either: an ellipsis is a visual convention and some screen
readers read it literally; `aria-haspopup` is the honest carrier. A filled star must therefore NEVER
be labelled "Saved"/"Favourited" — a second press does not remove; `×` has been the remove path
since v1.99.4.
- ON reads `Add to a list — already in “A”, “B” and 2 more`. **Two named, the rest counted**
  (N = count − 2, so it is always ≥ 1 and can never read "and 0 more"). It used to name every list,
  unbounded — a coach with a list per week got a 200-character button NAME, read out in full on
  every focus. With aria-pressed gone this aside is the ONLY channel by which a screen-reader user
  learns membership without opening the menu, so it has to be there and it has to be bearable.
- **`title` SPLITS.** With an aria-label present, `title` computes as the accessible DESCRIPTION, so
  `el.title = c.label` made NVDA/JAWS read the same sentence twice on the common path. OFF now
  carries **no title at all** (a hollow star already says it); ON carries **status only** —
  `In “A”, “B” and 2 more`, no verb — because with a bare glyph the desktop hover is the only
  channel a sighted mouse user has for WHICH lists a technique is in. WCAG 2.5.3 Label in Name is
  not engaged: that criterion applies to VISIBLE text labels and this control has none.

**BOTH PAINTERS WERE TRADED.** `_styleListAdd` (every `[data-list-add]` BUTTON) and
`_wireDossierListButton`'s `paint` (the `.dsList` row). The second is unreachable from the app
(v1.101.5) but is live code that `_refreshListSurfaces` dispatches to, so leaving it on `+`/`✓`
would let the two diverge. Its static pre-paint markup and its stale *"Add to today's class list"*
went with it. The dead `data-list-label` branch (no writer anywhere in the tree since v1.102.1) was
KEPT and its words traded too — so a revival cannot resurrect "Add to class", the vocabulary
retired in v1.113.5 and pinned by `share-mobile.spec.ts:371`.
**Repaint cost**: an `innerHTML` SVG parse is not the free `textContent` write it replaces, and this
painter runs for every capture on screen on every list mutation (Explore can hold a hundred rows),
so it is keyed on `on:px:labelled` and only reparses on a real change.

**`[data-lists-new]` STAYS A `+`, AND SO DOES THE PICKER'S "New list" ROW.** That `+` **creates a
list** — it calls `newList()`, never `captureNode` — and the picker's `<span class="ng-listpicker-box">+</span>`
is the same create affordance. They are not capture controls. The trade actually SHARPENS them: `+`
now means "make a new list" and nothing else in the whole pane, where before one `+` created lists
and another filed into them. `share-lists.spec.ts:979` is the guard and is untouched.

**A BONUS THE OWNER WILL SEE, AND TWO COLLISIONS THAT ARE DISCLOSED, NOT FIXED.** Moving the trigger
off `✓` disambiguates it from the menu it opens: the picker's rows are `role="menuitemcheckbox"`
with real `✓` boxes, so **★ now opens a menu of ✓** where a ✓ used to open a menu of ✓.
- **`★` IS ALREADY TAKEN, ON THE SAME ROW.** `crownBadge` prints a filled `★` in gold `#f0c05a` at
  deck-mastery level 4, and `challenge-ui.src.js` puts that crown and the capture control on the
  SAME `.ng-challenge-lessonrow`. The colour half is settled (the capture star is never gold — see
  below); the SHAPE overlap ships. Geometry separates them — the crown is 9.5px inside an 18px dark
  disc, the capture is a 12px glyph in a 24px bordered box — but it is a VISUAL call the owner
  should eyeball on a mastered lesson row. **Arguably the CROWN should move off `★`, not the
  capture control.**
- **`★ GitHub` in the Explore FOOT** (`_refreshGhChip`, pinned by `footer-feedback.spec.ts:83`)
  means "stargazers" — a different verb, one scroll from the Lists section. It always carries a
  NUMBER, and it is why the capture control must never be LABELLED "Star": two controls whose
  accessible names are both a bare "Star", doing different things in one scroller, is the worst
  outcome available here.

**THE ON COLOUR IS THE PANE'S SELECTION BLUE, AND GOLD/GREEN WERE REJECTED ON MEASUREMENT.**
`#a9c2ff` ink, `rgba(150,180,255,.5)` border, `rgba(150,180,255,.13)` wash — structurally identical
to the green it replaces (tinted ink + .5 border + ~.13 wash), and the border is an EXISTING token
(`.ng-actchip:hover` / `.ng-lists-new:hover`). The OFF state is byte-identical to before.
- **Gold** carries THREE meanings in this pane already — the due count and the weak-spots count
  (`_exploreStatsRow`, which renders directly above the Lists section), `crownBadge` level 4, and
  the share cue — all of which mean progress-or-attention. List membership is neither.
- **Green** (`#7ee0a8` + `✓`) means completion/correctness in at least eight other places. "In one
  of your lists" is MEMBERSHIP, not completion — which is exactly the muddle the owner reacted to.

**KNOWN, NOT FIXED (owner scope call, deliberately not smuggled in).** The capture control is
styled by inline `cssText` and has **no `:hover` and no `:focus-visible`**, while `.ng-actchip` — the
play button sitting immediately beside it on every Explore row — has both. Tabbing to play shows a
ring; tabbing to capture shows nothing. Adopting `.ng-actchip` + an `[aria-pressed]`-free modifier
would fix it for free but moves the paint seam from JS-inline to CSS, and `_styleListAdd` would have
to stop writing `style.color`/`borderColor`/`background`.

**Cost:** bundle **+791 raw / +274 gzip -9** (467,395 → 468,186 · 138,186 → 138,460). Payload gate
green with NO ceiling raised — neural eager **303,512 / 330,000** gzip, **1,421,164 / 1,600,000**
raw. **No RNG tag, no call order, no persisted shape and no storage path is touched**, so
`replay-digest` cannot see this and was not re-baselined.

**Gated by** `lists-picker.spec.ts` (8 journeys — the fill IS the membership state, the menu-button
aria, and the label/title contract), `lists-disclosure.spec.ts` (the empty-list copy names the star
and the three surfaces that really carry it) and `landcard-chrome.spec.ts` (the corner star's 14px
box, which is what catches the inert-`font-size` slip). **Eight mutants, eight kills**: the fill
never arriving · `aria-haspopup` deleted · `aria-pressed` restored · `aria-expanded` no longer
written on the anchor · the old empty-list copy · the land corner forgetting its `glyphPx` · the
enumeration uncapped · `title` back to duplicating the name.

<a id="v1-103-2-the-picker-no-longer-hides-what-you-were"></a>

## v1.103.2 — THE PICKER NO LONGER HIDES WHAT YOU WERE READING

_Originally CLAUDE.md L3105._

**THE PICKER NO LONGER HIDES WHAT YOU WERE READING (v1.103.2).** `openListPicker` used to suppress
`.ng-landcard` while it was up, on the reasoning that on a phone the picker's band is exactly where
the card sits. Owner (of the `+` it was then): it "should show the list of lists to choose from without hiding
ng-landcard". The z ladder already settles it — the picker portals to the root plane at **90**, the
card is **5** — so it owns the INPUT without taking the view. Hiding the thing you are reading in
order to answer a question about it is the wrong trade. `lists-picker.spec.ts` asserts the card is
still readable behind it AND that `elementFromPoint` at the picker's centre is the picker.

<a id="v1-103-2-one-camera-framing-aimed-at-the-label-in"></a>

## v1.103.2 — ONE CAMERA FRAMING, AIMED AT THE LABEL, IN THE MEASURED BAND

_Originally CLAUDE.md L3113._

**ONE CAMERA FRAMING, AIMED AT THE LABEL, IN THE MEASURED BAND (v1.103.2).** `rollFromPosition`
hard-coded its own `vw: graphW * 0.42` with no offset and no lift, so clicking a node to navigate
landed on a completely different composition from the one the roll settles into — the owner: "on
random / auto roll it works well... almost". `rollCamTarget(f, moving)` is now the single seam both
use.
- **Vertically it centres the node's LABEL in the band that is actually free** — below the announce
  block (`evRef`, when visible), above the film strip (or the card, when there is no film). MEASURED,
  not a constant: the `0.34 * H` it replaces was tuned at 1440x900 and wrong at every other height.
  And it aims at the LABEL, not the node's centre — `draw()` writes a submission's text `rs * 0.24`
  below centre, so a triangle's label sat low by exactly that much. A degenerate band (< 80px)
  falls back to the top band rather than producing nonsense.
- **Horizontally, ~44% of the width**, unchanged from v1.101.1 and for the same reason: every name
  hanging off a node runs left-to-right FROM it, so the room it needs is on its right.

<a id="v1-103-1-the-unfolded-card-two-fixes"></a>

## v1.103.1 — THE UNFOLDED CARD, TWO FIXES

_Originally CLAUDE.md L3127._

**THE UNFOLDED CARD, TWO FIXES (v1.103.1).**
- **The definition was the SEO lead-in, not the definition.** 1144 of the 1598 authored `def`
  strings (72%) open with "Master <thing> in BJJ." — copy for the static page — and `mcClip` clips
  to the FIRST SENTENCE, so the reader got the marketing line and lost the definition behind it. In
  every one of those 1144 there IS content after it. Owner, on "Master the Estima Lock Bottom
  Position in BJJ.": "this is kinda pointless info". It was — but the fix is `definitionOf()`,
  which skips the lead-in and clips what follows, not dropping the field: the useful half was one
  sentence away. A def that is ONLY the lead-in renders nothing.
- **An unfolded card must fit the screen it is on.** `.ng-landcard` is anchored by its BOTTOM
  (236px desktop, 206px phone, `_dockLandCard` overriding again), so the constant
  `max-height:min(620px,74vh)` grew it UPWARD off the top of short viewports: measured at 1440x720
  the expanded top was **-28** with `scrollHeight == clientHeight`, so there was no internal scroll
  to recover it either — "I can't scroll up". `expandLandCard` now derives the ceiling from the
  card's own measured bottom less a 12px inset, so anything that does not fit becomes scrollable
  rather than unreachable (720px: top -28 → +12, scrollH 510 > clientH 470). Pinned at 900 and 720
  by `roll-card.spec.ts`.

<a id="v1-103-0-role-correctness-who-may-perform-a-move"></a>

## v1.103.0 — ROLE CORRECTNESS: WHO MAY PERFORM A MOVE

_Originally CLAUDE.md L3144._

**ROLE CORRECTNESS: WHO MAY PERFORM A MOVE (v1.103.0).** The owner, mid-roll: "I thought our last
position was Bottom Rear Triangle ... you're open to being finished from Triangle, not finishing
anybody, so they shouldn't be available to me right?" Right — and chasing it found three defects.

- **`s` IS TWO DIFFERENT PAIRS.** A POSITION carries `[top, bottom]`; a TECHNIQUE carries
  `[attacker, defender]` and is always antisymmetric (verified: 0 of 1328 asymmetric;
  `scripts/enrich_graph_strength.py:18` states it). `roleIdx()` indexed BOTH with a top/bottom
  index, so every bottom-performed technique was read as its opponent's value. Measured: **a bottom
  player was shown ZERO of the 297 submission nodes** (every submission scores ≈ +0.90 for its
  attacker), and 144 of the 596 bottom-authored techniques — the 60 submissions + 84 sweeps that are
  EV-positive — were exactly what got discarded. `valIdx(node)` now picks the slot by PERFORMER for
  techniques and by side for positions.
- **THE PERFORMER IS READ, NOT INFERRED.** `optionsFor` used `myVal < oppVal - 0.05` ("the
  beneficiary is the performer"). That is a heuristic over a score; the data states the performer
  outright in every technique's `fromRole`. It now reads it — and so does the no-candidates
  fallback, which relaxes ORIGIN but must never relax ROLE. A wrong role is now a content bug, and
  `validate_graph_integrity`'s `from_position_role_mismatch` names all 65.
- **40% OF POSITIONS SHIPPED THEIR PARENT'S STRENGTH.** `enrich_graph_strength.py` globbed
  `content/Positions/*.json` NON-recursively, so the 54 nested files never loaded and inherited
  their hub via the parent fallback — whose own comment said variations "carry only
  name/slug/description, no metrics of their own", **false for all 54 of 54**. Both globs are
  recursive now (`score_graph_nodes.py` too, or `--dump` disagrees with what ships), and a nested
  position resolves by its own leaf slug before the parent fallback is consulted.
  `Triangle Control/Rear Triangle` inherited the closed-guard triangle's opposite polarity:
  `[-0.366, +0.204]` → its own `[+0.645, -0.444]`. 475 nodes moved (95 positions, 380 techniques).
- **`posId` WAS A PATH WHERE `fromPositionId` IS A SLUG.** Nested positions emitted
  `"triangle-control/rear-triangle"` while their own techniques say `"rear-triangle"`, so
  `optionsFor`'s origin filter rejected EVERYTHING: **54 of 136 positions had an empty hand** and ran
  entirely on the fallback. Fixed in `regenerate_neural_data.py` (leaf for positions only — a
  submission id's leaf, `from-mount`, is not a slug). Now 0/136 empty, and 136/136 carry a
  calibrated payload (the same mismatch was starving that join).
- **THE AUTHORED WORD DECIDES DOMINANCE (`score_graph_nodes.position_role_strength`).**
  `state_properties.position_type` sets the SIGN, the weighted formula only the magnitude. In BJJ
  the dominance axis is not top/bottom — the IBJJF ladder scores positions achieved, a sweep FROM
  the bottom scores, and the player holding a triangle is usually underneath; the literature names
  the axis attacking/defending, which is the word already in this field. Positions authoring no
  `position_type` keep the old behaviour exactly. `check_position_type_vs_score` reports any
  disagreement as a warning (currently 0 across all 272 position-roles — the word and the
  arithmetic agree; Rear Triangle was never a conflict, its file simply never loaded).
- **QUALIFIED NAMES WHEN AMBIGUOUS (`displayName`).** "Triangle" is not a technique here, it is
  several — the owner was offered "Triangle", opened it, and read "Harness → rear-triangle". 648 of
  1467 nodes carry a `from <position>` qualifier and 89 short names are shared, so the short name is
  used only when it is unique. Applied at the OPTION CARD and the GRAPH's in-node label; the share
  surfaces, lists and dossier already render full authored names by canon.

---

<a id="v1-145-1-the-collar-choke-that-was-not-a-bug"></a>

## v1.145.1 — THE COLLAR CHOKE THAT WAS NOT A BUG, AND THE PANEL THAT WAS NOT A PANEL

> **Status:** Current. No content value was changed by this entry's commit.

`Cross Collar Choke from Invisible Collar` is dealt no-gi at `{gi:16, nogi:4}`. It was handed
round as an obvious live data error — a collar choke served to a player with no collar — and
scoped as a five-minute content fix. **It is not an error, and the fix that was about to ship
would have been a name regex.**

**The verdict is the calibration's.** `occurrence_calibration.json`, container
`rubber-guardinvisible-collar__top`, 16 rounds, records the disagreement and its resolution:

> Cross Collar no-gi was the largest Round-1 disagreement (0-12). Resolved as a genuine small
> residual (2-5), NOT an availability zero, because a gable-grip / palm-to-palm neck strangle is
> mechanically possible without cloth; the low values reflect that it is rare and borderline a
> re-labeled RNC rather than unavailable.

Ten no-gi ballots `3,5,2,5,3,2,3,3,5,3` → mean 3.4 → final 4. **The control is in the same hand,
on the same run:** `Bow and Arrow Choke from Invisible Collar` and `Clock Choke from Invisible
Collar` both drew `0,0,0,0,0,0,0,0,0,0` and both sit at `nogi: 0`. The machinery zeroes when the
ballots say to. The 4 is what it produced when they did not.

**AND THE SESSION THAT ESTABLISHED THAT OVERSTATED IT, IN THE SAME BREATH.** It reported "10
independent expert ballots" and "a 10-expert Delphi calibration". `scripts/occurrence_moe.py:31`
says otherwise, in its own comment, and had said so all along:

> `effective_n stays small: 10 personas are ONE correlated LLM, not 10 samples`

The ten "legends" are LLM personas. The author knew and applied a correlation discount; the
session quoting them did not. So: **the values are agent output, not testimony.** What survives
is narrower and is enough — the row is the deterministic, documented, reproducible output of a
process that demonstrably zeroes its neighbours, and *the policy* it follows (`floor: 1`, no
removals, per-frame-0 only for genuine unavailability) is labelled `owner policy` in code and
was decided by a human. The argument against overwriting it is not "do not contradict experts";
it is **do not replace one model's auditable output with another model's ad-hoc regex.**

`calibration_overrides.json` carries the same shape: `meta.source` claims "2 black-belt reviewers
+ adjudicator per batch" and all 10 rows carry `reviewer: "review-sweep-2r-adjudicated"`. Treat as
LLM adjudication, as with `position_type_reviewed.json`.

**THE NAME REGEX WAS REFUTED IN ADVANCE, BY THE DATA'S OWN AUTHORS.** On
`collar-sleeve-guard__bottom`:

> Move-name/mechanism mismatch on 'Collar Sleeve to De La Riva': labeled collar-sleeve but ruled
> available no-gi as a positional transition. Consumers keying availability off the move name
> (collar/lapel substring) would wrongly zero it — flag for the apply step.

A `collar|lapel|sleeve|spider|lasso|worm` sweep matches 125 transition rows and finds 70 with a
nonzero no-gi weight — **and flags `Rear Naked Choke from Invisible Collar` at `nogi 37`**, the
canonical no-gi choke, because the *position* name contains "Collar". That 70 is not a defect
count and must not be quoted as one. The app ships this same heuristic as `giAllows`'s fallback
(`neural/src/app.src.jsx`), where it fires on 4 of 1467 wire nodes (0.3%) — only when `cal.avail`
is absent.

**WHAT THE CLASS ACTUALLY IS, derived from the corpus instead of from names**
(`npm run validate:occurrence`):

- **1** role-frame where the calibration zeroes a whole frame and content still carries a 100-sum
  distribution: `lapel-guard__bottom`. This is CORRECT per policy — `occurrence_moe.py:198-214`
  mirrors a collapsed frame deliberately, because `validate_graph_integrity.py` errors on any
  frame not summing to 100. Its own flag reads *"the engine must never route a no-gi session into
  this node."*
- **12** outcome cells that do exactly that routing (`De La Riva to Lapel Guard` at `nogi 58`,
  `Lapel Guard to Piranha Guard` at `nogi 30`, …). **An earlier figure of 78 was name-derived and
  is withdrawn — it is 12.**
- **19 Tier A / 12 Tier B** role-frames whose own `prerequisites` state a garment requirement
  while the no-gi frame is populated. A TRIAGE LIST, not a defect list: Tier A knowingly includes
  `closed-guard__top`, whose prerequisite reads *"hips, biceps, collar, or lapels"*.
- **0 of 1394** `success_rate` cells and **0 of 4160** outcome-probability cells diverge between
  frames. Only `attempt_probability` was ever calibrated per-ruleset, so the "58% gi-only choke"
  figure is one scalar duplicated into both frames on every technique in the corpus.

**A WRONG JOIN PRINTING PLAUSIBLE INTEGERS, CAUGHT BY THE SCRIPT WRITTEN TO CATCH IT.** The first
cut of `validate_occurrence_surface.py` joined calibration containers to content by position
SLUG. Two containers — `crackhead-control__{top,bottom}` — still name
`content/Positions/Crackhead Control.json`, moved under `Rubber Guard/` since the calibration ran
and already covered by `rubber-guardcrackhead-control__*`. The slug join silently routed the
stale pair onto the live file, found a partial move list, renormalized it, and reported
`renorm=47` against `content=22`: **no exception, no blank, 14 unexplained cells where the truth
is 7.** Join on the path, and NAME what fails to resolve — the report now prints the 2
unresolvable containers and the 6 reserved ones, so 266 + 6 + 2 = 274 accounts for every one.

**THE TEST THAT PROVED NOTHING, ALSO CAUGHT IN PASSING.** `tests/occurrence_gate.test.mjs`
asserts the reporter reads the authored requirement rather than the name, using two positions
with identical cloth-sounding names and different prerequisites. Its first fixture named them
"Collar Guard A/B" — which the requirement regex never matches *as a name* — so a mutant that
deliberately turned the script into a name matcher **survived**. Renaming the fixture to "Lapel
Guard A/B" (a substring both the panel warning and the app's own fallback regex fire on) kills
it. A fixture that cannot trigger the failure it forbids is a decoration.

**Gates:** `validate:occurrence` is REPORTING-ONLY and exits 0 whatever it finds — whether any of
these sections is a defect class is the owner's call, and the script exists to size them before
that call. Its `--gate` flag is deliberately wired into no workflow. Zero coverage is fatal in
every mode. `validate:graph` unchanged at 0 errors; no content value was touched.

**NOT DONE, deliberately:** the 2.4 availability layer. The blocker is the validator, not the
data — a frame declared unavailable must be permitted to sum to 0 before an honest zero can be
written, and `_ruleset.py` already documents `null` as "this edge does not exist in that ruleset"
across all 8 schemas while the corpus uses it **0 times**. Estimated 2-4 sessions, and step 4
(the app deals unfiltered today — `giAllows`'s only caller is `buildExplorer`) is a user-visible
behaviour change and the owner's call.


## v1.145.10 — WHAT THE SCORE CANNOT SEE, SIZED

`curriculum.weights` is the only thing `gameScore` sums. One writer, two readers, **zero
validators** — `validate_curriculum.py` cannot cover it (it runs before the weights are built,
against `templates/curriculum.json`, which has no `weights` key). Nothing had counted the score's
own reach.

MEASUREMENT ONLY, the split `validate:occurrence` used. `npm run validate:score-coverage`:
reporting, exit 0, writes `tests/artifacts/score_coverage.json`, derived from the **committed**
`graph.json` — never from the gitignored `source/quartz/static/neural/`. Full reasoning in the
script's own header. It read, at the time: defender 1,326 decks / 6,403 cards · position 272 /
2,668 · orphan 5 / 50, and the score seeing 12,303 of 21,915 cards (56.14%). See v1.145.13 for
what those rows read now.

**The score was blind to 9,121 of 21,915 authored cards (41.6%)**, and until this nothing
said so. **Superseded:** v1.145.13 closed the two unscored classes, v1.146.0 the ruleset row —
`--gate` is armed in `ci-validate.yml`.

**PROVENANCE: "deliberate" was never decided by a human.** This file said the Defender and position
zeros were "on purpose". The `role != "attacker"` filter arrived in **v1.68.0** (`86cf84c16`,
`Co-Authored-By: Claude Fable 5`), whose message claims *"Nothing is cut now"* while cutting 1,598
decks; **v1.138.0** (`1d3a17eaa`, `Co-Authored-By: Claude Opus 5`) observed it and labelled it. Git
authorship is no evidence — every commit carries the owner's name; the trailer is the tell. No
owner quote on the score's scope exists in this archive.

**CORRECTIONS.** "43.9% coverage: 1,655 decks / 9,612 cards" is the **GAP**, not the coverage
(`9612/21915` = 43.86% uncovered by card; coverage is 43.40% by deck / 56.14% by card — and
covered-by-DECK is 43.40%, half a point from the quoted figure and an unrelated quantity). The two
defects **overlap**: the 52/491 gi bucket sits inside that gap. "Scores nothing" is not "is
unreachable" — only 5 attacker decks (50 cards) are orphaned (`aoki-lock`, `buggy-choke`,
`inside-heel-hook-from-inside-sankaku`, `kneebar`, `kneebar-from-carni`).

**MUTANTS, ALL WATCHED RED.** The frame accessor stops reading the `{gi, nogi}` pair → the gi row
reports `1269/1269`, perfectly clean, and the artifact's `unweighted` goes 52/491 → 0/0. The
availability join hollowed → `0/1326 (0.0%)`, **exit 1**: zero coverage is fatal even in reporting
mode (section 6.6), because a per-frame check with an empty denominator prints what a clean run
prints. `--gate` → exit 1 naming the 52.
<a id="v1-146-0-the-score-could-not-see-its-own-ruleset"></a>

## v1.146.0 — THE SCORE COULD NOT SEE ITS OWN RULESET

> **Status:** Current. Closes the ruleset row left open by v1.145.10 and restated as unruled by
> v1.145.13 below, on the owner's ruling ("just ship it, whatever makes sense"). Full measurement
> set, rejected shapes and mutant table are in this commit's message.

`build_technique_weights` read `edge["attemptProbability"]` — the folded **no-gi** scalar — for 77
versions while `attemptProbabilityByRuleset` sat on the same dict on **2,541 of 2,541** edges.
Re-derived from the committed graph before any code: 60 position edges are gi-only and 16
no-gi-only, so **52 techniques are attemptable only in gi**, the app's DEFAULT ruleset — and once
v1.145.13 widened the table to both seats that was **104 decks / 739 authored cards** at weight
zero. Fold direction measured, not assumed: 1,839 edges where the scalar equals `nogi` and differs
from `gi`, **zero** the other way. `optionsFor` applies no ruleset filter, so all 739 cards were
dealt, browsable, drillable and worth nothing.

**"It needs a regeneration, not a code change" was FALSE.** The pair is already on the committed
graph. The only other frame-dependent input is `outcomes[].probability`: across the 1,100 authored
files in `content/Transitions` + `content/Submissions`, **3,264 of 3,264** outcome maps and **1,100
of 1,100** `success_rate` maps have `gi == nogi`, enforced because `reduce_to_scalar(frame=None)`
raises on a divergent map. Unrelated despite the name: `successRateByRuleset` on role-nodes *does*
diverge (292 of 2,662) — calibration is per frame — but it is not an input here.

**What it costs the player, measured on the whole-corpus table.** Coverage 96.29% → **99.66%**
(21,840 of 21,915 cards; only 10 orphan decks remain). gi scores **fall**, by 0.005 to 0.028 — a
top-100 learner crosses blue→white at 0.4005 → 0.3958. Uniform mastery moves exactly zero, as it
must for two normalised tables, and a learner who has drilled the gi-only decks is **+0.0001**:
the loss is entirely "weight moved to material you have not studied". **TV(gi,nogi) = 0.0882 here**
— the 0.1138 quoted from the earlier audit described the *attacker-only* table and is stale.
Ranking moves more than the score does: **98.5% of the 2,778 shared keys** change rank (median 66,
p90 386, max 2,484), while the top-10 is unchanged in set *and order* — the head is stable, the
tail reorders.

**The frame is a required parameter with no default.** A default is how this survived 77 versions:
it lets a caller re-acquire the bug by omission. Every route to the table now runs through one
function that will not compile without saying which ruleset it means. Wire:
`scoreWeightsByRuleset = {div, p:{k,gi,nogi}, t:{k,gi,nogi}}` — keys once, one integer array per
frame, `k` the union, a zero meaning "not attemptable in this ruleset"; a new key rather than a new
shape under `scoreWeights`, which is v1.145.13's own reasoning applied to v1.145.13. Two stale
memos that would have shipped the fix as a lie: `_scoreW` was a single slot (first read pins a
ruleset forever) and `_scoreCache` was keyed on `_stageVer` alone, which only a card grade bumps.
`--gate` is now armed in `ci-validate.yml`.

---



## v1.145.13 — THE SCORE COVERS THE WHOLE CORPUS

v1.145.10 sized it: 1,326 Defender and 272 position decks — **9,071 cards, 41.4%** — weighed zero,
on a v1.68.0 agent decision no human had made. **The owner ruled: score the whole corpus and let
scores fall.** Why NOW: *"Nobody is a fucking blue belt right now... there are no users who will
suffer because of this."* A demotion is a trust event only once people have standing to lose, so
take the correct measure while it is cheap. Re-fitting the belt thresholds was explicitly rejected
as not yet justified — later, not today.

**THE TABLE.** A roll step exercises three kinds of knowledge, each once per step: where you are,
what you do from there, what is done to you. Three blocks — occupancy `pi`, visit-rate `visits`,
those visits mirrored to the defending seat — each summing to 1; the score is their mean. Not a
tuning knob: attempt probabilities sum to 100 on **272 of 272** role-nodes, so `sum(pi)` and
`sum(visits)` are both exactly 1.0 — three readings of ONE unit step, not different units as an
earlier session of mine claimed. `build_technique_weights` had been computing `pi` and discarding
it for 77 versions.

**MEASURED BEFORE SHIPPING.** No user data exists in this repo, so the live distribution was not
checkable — "everybody is white" is the owner's premise, unverified here. Cards of full
recall per belt, best-weight-first: white **231 -> 196** (*sooner*), blue 613 -> 856, black
3,367 -> 5,663 (1.7x). The drop depends on what was studied (2,500 cards): attacks only, i.e. the
old ranking, `0.735 brown -> 0.245 white`; random `0.120 -> 0.135`; positions first
`0.000 -> 0.324`. **Ranking:** 0 of the 1,269 already-scored decks change rank relative to each
other (the attacker block is scaled by exactly 1/3), but 14 of the new top 20 are positions and
USERS reorder.

**RETENTION NOT PRESSURE — no such choice arises here.** A weights table has no clock to punish
with; `deckMastery` moves only on answers. It WILL arise in `_schedule` (SRS intervals — what you
are *shown*). Pinned by a test named for it.

**THE WIRE SHRANK.** Flat, the 2,810-key dict cost +8,339 gzip — first hand 382,197 of 385,000,
inside the band `payload-first-hand` calls unknown until CI speaks. Key strings are the whole cost
and 1,269 of 2,810 were a second spelling. `scoreWeights = {div, p:{k,v}, t:{k,v}}` spells each
once, both seats at one value: **16,711 gzip against 17,417 — 709 bytes SMALLER than the
attacker-only table it replaces.** The emitter round-trips the expansion and refuses if the mirror
stops holding. `weights` is no longer emitted: an old bundle iterating the new shape would render
`Mastered NaN%`; under a new key it scores 0 and recovers on reload.

**A TRAP THE SUITE CAUGHT.** `startPosTraffic` sums a technique's weight through its ONE canonical
origin; I let position/`|Defender` keys fall out of its `fromPositionId` guard instead of filtering
them. That LOOKED equivalent: a position deck key **does** resolve through `nodeForKey`, to a
different index under `?dual=legacy` than under the pair render, so the two built different traffic
tables and `dual-consumers` went red on an otherwise correct build. Filtered now — the draw is
unchanged by construction, not by accident.

**MUTANTS, ALL RED.** Defender seat halved · position block dropped from the expansion · a zero
kept as a key · emitter's defender block emptied (refused) · wire drops the defender seat
(round-trip refused, 1,269 missing).

**Was left open here, closed in v1.146.0 on the owner's ruling:** the 52 gi-only techniques,
which widening the table doubled to both seats — **104 decks / 739 cards**.
---

## v1.147.0 — THE PANE'S TAB BAR IS A PAGER

Owner: *"users try to scroll left and right"* on Explore | Challenges | Last rolls. The open
question was which way, and whether the device could be asked.

**It cannot.** No web API exposes a swipe-direction or "natural scrolling" preference; macOS
natural scrolling inverts *wheel* deltas inside the OS, so the browser is handed an already
flipped number, and a touch gesture is never flipped at all. The one real device signal is
WRITING DIRECTION, read from the computed `direction`. So the direction is a design decision, and
this repo had already made it: `_landPageTo(dx < 0 ? 1 : -1)` (v1.130.0) — content follows the
finger, as in UIPageViewController and ViewPager2. Two pagers in one drawer disagreeing about
forward would have been the defect. Seams: `_paneTabPageTo` · `_paneGestureDir` ·
`_paneSlideBody`, on the pane's existing touch handler; `NG_PANE_TABS` replaces the hand-typed
triple `setViewMode` validated against.

**Mutation table** (built bundle, hardlinked sandbox — another agent held the core port): the
inverted direction, the deleted dominant-axis check, clamp→wrap, the deleted click suppressor,
the deleted `inHScroller` guard and the deleted RTL flip are all KILLED by
`e2e/journeys/pane-tab-swipe.spec.ts`. The seventh — deleting the study branch's `return`, so a
card swipe falls through into the tab pager — **SURVIVED, correctly:** `_paneTabPageTo` guards
`_paneStudyActive()` itself, so only the DOUBLE mutant goes red. Journey 4 gates the behaviour,
not either guard; it says so in its own header. A third spelling of that rule sat in the wheel
handler and was deleted once measured redundant.

---

## v1.148.0 — MULTIPLE CHOICE DROPS TO THREE, AND THE TRAP SURVIVES THE CUT

Owner's ask, in full: *"bring all multiple-choice cards from four options to three. The reason is
that we don't have enough vertical space on the screen to show all four options... Three options is
typically a more readable quantity for humans, not passing the decision threshold and entering into
decision fatigue effects."*

The count itself was a two-line change. `mcDistractors(card, deckKey, n, tag)` defaulted `n = n || 3`
and BOTH call sites passed the literal `3` — `_mcBlock` for the real draw and `_warmMcPool` for the
rolled-back dry pass that decides which deck chunks to hydrate. That pair is the §6.5 shape: one
question answered in two places, and a disagreement between them would have made the dry pass name
the wrong deck set, fired `mc_pool_cold` on a live draw, and desynchronised every rigged journey.
Collapsed to one seam, `get MC_DISTRACTORS() { return 2; }`, with the Python port
(`scripts/audit_mc_viability.py`) carrying the same constant under the MC_LINE ↔ MC_LINE_BUDGET
"keep in sync" contract.

**THE FINDING, AND IT WAS INVISIBLE TO EVERY GATE.** The corpus is uniformly two `plausible` plus
one `trap`: measured over all 1,659 `content/**/*.json`, **23,406 cards carry `distractors` and
23,406 of them are exactly 2+1 — no other shape exists.** `mcDistractors` consulted `d.p` before
`d.t`, and `tryAdd` early-returns at `picked.length >= n`. So at `n = 2` the two plausible lines
filled both slots and **`d.t` would never have been consulted for any authored card in the
corpus** — retiring the trap tier, its 2:1 odds cost (`cost = tier === "trap" ? 0.08 : 0.04`,
`_landAnswered`), its stage demotion (`_bumpStage(key, card.q, -1)`) and the
`mc_wrong{tier:"trap"}` beat, corpus-wide, in one line. **`npm run validate:mc` would have gone on
reporting 100.0% viable throughout**, because it certifies survivor COUNT (`>= 2`) and never asks
which tier they came from. §6.6, exactly: a fallback that produces a plausible value and never says
it fired. Fix: consult the trap FIRST, so it always survives the cut; then ROTATE which of the two
plausible lines takes the last slot (one draw on the same `…-mc-pick` tag, so it rolls back with the
dry pass and replays frame-exact), because taking `p[0]` every time would have permanently retired
23,406 already-authored lines. Display order is untouched — the existing Fisher-Yates on
`…-mc-shuffle` still runs after selection, so the trap is equally likely to be A, B or C.

**A simplification fell out.** The pooler's recall floor is `picked.length < 2 → null`. At
`MC_DISTRACTORS = 2` the ask and the floor are the same number, so a shipped MC block is now
*exactly* three options or it is not an MC block at all — the degraded three-of-four case is gone,
and the audit's `>= 2` certification finally means what it says instead of under-certifying
(before, it passed cards that could only ever have built three of the four the renderer asked for).
The floor is deliberately left as a literal rather than `< n`: it answers a different question.

**THE SECOND FINDING: two unit suites would have gone VACUOUS, not red.** `neural_manifest_boot`'s
synthetic corpus was hand-shaped so that all three pooling tiers run — own deck rejects its one
candidate, two neighbours give one each, "which is not enough for n=3", so the global tier must
walk. At `n = 2` two neighbours are exactly enough, the global tier stops executing, and every test
in the file goes on passing while covering one tier fewer. N2's line is now a deliberate
near-duplicate of N1's (Jaccard 9/11 = 0.82, over the 0.8 sibling guard) so one survivor is short of
two and the walk is forced again — and the test now NAMES the tiers it reached and fails on zero,
rather than inferring coverage. Proven by reverting the line: `the global tier never ran (reached:
Mount|Top,N1|Top,N2|Top)`.

**Mutation table** — all three killed:

| mutant | spec that went red |
|---|---|
| `d.p` consulted before `d.t` | `mc-oneline.spec.ts:66` "golden card: … authored plausible/trap tiers" |
| `MC_DISTRACTORS` back to 3 | `mc-oneline.spec.ts:66` + `landcard-modes.spec.ts:419` |
| dry pass under-asks (`_warmMcPool` → 1) | `neural_manifest_boot.test.mjs` "MC options are identical under warmed partial residency" |

`keyboard.spec.ts`'s shortcut-legend loop is recorded in its own header as a NON-KILL: it greps
single letters out of the whole lowercased modal, so "d" matches incidentally and the loop survives
a mutant that deletes the row. The real gate on the count is `mc-flashcards.spec.ts`.

**What did NOT change, deliberately.** No content regeneration: the wire still ships `mc:{p,t}`
untruncated and the spare plausible becomes guard-rejection headroom, so the authoring scripts keep
their `minItems/maxItems 2` and `1` and their `len(opts) < 3` idempotency predicates — loosening
those would have re-flagged the whole corpus as needing work and bought a paid re-authoring wave for
zero runtime benefit. No `helmet.html` retune: `.ng-landcard` is a flex column under
`max-height:34vh` with `overflow-y:auto`, so it simply gets ~51px shorter (one 44px row + one 7px
gap) and the scroll pressure goes away; §6.1 records twelve collisions from tuning docked chrome
against a constant instead of a measured rect. The trap penalty stays at 0.08/stage −1 even though
traps rise from one-of-three wrong slots to one-of-two — a dial to feel before turning. `decisionSec`
stays at 9s. And `_onKey`'s sidebar digit branch stays `/^[1-4]$/`, not `/^[1-3]$/`: it calls
`preventDefault()` before the lookup, so a `4` is SWALLOWED; narrowing it would let `4` fall through
to the `/^[1-9]$/` option-card openers, which is the Q007 hazard their own comment records.


---

## v1.148.2 — "LAST UPDATED" WAS THE BUILD CLOCK, ON EVERY PAGE, FOR ELEVEN VERSIONS

Owner, on the build console: *"a bunch of files decided they weren't in Git... I always have this
message every time I read this. The outcome is never different?"* It never differed because the
check never succeeded — not for a bunch of files, for **4,618 of 4,618**.

**Mechanism.** `lastmod.ts` asked libgit2 for a date using `file.data.filePath`, which is
`joinSegments(argv.directory, fp)` (`processors/parse.ts:94`); this repo builds
`quartz build -d ../content` from `source/`, so it reads `../content/Positions/Mount.md`. **libgit2
resolves a pathspec against the repo workdir and cannot follow a `..` out of it.** Every lookup
threw, every file warned, every date fell through to `st.mtimeMs` on the next loop iteration.

**Why it survived eleven versions.** §6.6 in its purest form — *a fallback that produces a
plausible value*. An mtime is a real date, in range, different per file by fractions of a second.
The 4,618 warnings were not silence; they were noise, which is the same thing once a reader learns
to scroll past them.

**Measured before the fix (v1.148.0).** `Positions/Mount/Top.html` emitted
`article:modified_time = 2026-08-22T17:54:17.524Z`; `stat` on its source `.md` said `.524000000`;
`git log -1` said `2026-07-16T01:20:13`. Identical to the millisecond to the filesystem, five weeks
off the truth. **In production it is worse:** a fresh checkout stamps every mtime at the checkout
instant, so fetched live from bjjgraph.org, `/Positions/Mount/Top` and
`/Submissions/Rear-Naked-Choke` — last really committed months apart — **both** claimed
`2026-08-26T23:36:12`, 0.2s apart. Head.tsx copies the same value into `datePublished`/
`dateModified`, so Google was told all 4,618 URLs were rewritten at every deploy.

**The bitter part.** This is exactly what v1.37.0 ("Accurate 'Last modified' date") was written to
fix; its own config comment says `"git"` prevents generated `.md` showing *"identical 'Last
updated' everywhere (the bug that got ContentMeta removed in v1.36.1)"*. The comment described the
intent correctly and the code never once did it. It also poisoned a gate:
`check_seo_parity.py` sentinels five date fields as `VOLATILE` after 28 phantom regressions on an
untouched tree, blaming "git/filesystem mtime". Half that reasoning was this bug. The sentinels
stay — the content bot commits daily, so git dates move legitimately — but the reason is now honest.

**Fix.** Derive the pathspec from `repo.workdir()`, not from `argv.directory`: the workdir is where
libgit2 actually rooted the repo, the only frame its pathspecs resolve in, and it stays correct for
the submodule/subtree case `Repository.discover()`'s own comment is about. Verified by driving the
real transformer over real content: `Mount/Top` → `2026-07-16T00:20:13.000Z` and `Game Over.md` →
`2026-08-09T19:10:27.000Z`, both matching `git log -1` exactly, zero warnings. Two repairs in the
same block: the per-file warning is capped at 5 then counted (with the path correct the only
remaining cause is an uncommitted note — normal, and not worth 4,618 lines), and a bare repo now
says so **once**, loudly, instead of silently re-entering the old failure via the `?? fp` fallback.

**Gated by `tests/lastmod_git_path.test.mjs`**, which builds a throwaway repo shaped like this one
and drives the real `getFileLatestModifiedDate` — throwaway because CI checks out at
`fetch-depth: 2`, so asserting real dates would test the clone depth, not the fix. It also pins the
call site, the half that kills the revert mutant (verified red). **Non-kills, recorded in the
spec's header:** a root `node --test` runner cannot import a `.ts` plugin without a transpile step,
so the transformer's own control flow (warning cap, bare-repo warning) is NOT executed here, and a
mutant hard-coding a correct path instead of calling `repo.workdir()` survives both halves.
`ci-validate.yml` gained the file in its `paths:` filter, for the reason the line above it gives.
## v1.149.0 — THE FORMAT LADDER REACHES THE JIT DRILL

The in-sheet micro-drill was the last question surface in the app that only ever asked one way:
reveal → "Got it", whatever the player already knew. It now asks through `askFormat`.

**WHICH LADDER, AND WHY IT MATTERS.** There are two format rules here and they are not
interchangeable. The landing and defend cards ask against a running clock and use the RANK gate
(`_recallInPlayNow` — recall only from blue belt up, v1.133.0, owner's call). The node card uses
`askFormat` — pure stage ladder, no belt. The JIT joins the NODE CARD: `expandOption` pauses
motion and calls `_declineLandQ`, so the sheet has no clock at all. Wiring the rank gate in here
would have asked a white belt to recall in the one place the owner deliberately put no clock —
which is exactly the mistake an abandoned branch (`journey/defend-wt`, v1.91.0) was about to make
by collapsing both rules into "ONE seam". That branch is superseded; this is the one piece of it
dev genuinely lacked.

**TWO N-WAY CHAINS COLLAPSED BEFORE ADDING THE FOURTH CASE (§6.5).** `_mcBlock` picked its rng
scope with `surface === "land" || surface === "node" || surface === "panic"` and its option
handle with a parallel 4-way ternary, while `_mcAnswer` re-stated the same set as a 4-selector
union. A new surface had to be added to all three or it built fine and then graded nothing — and
if it missed the rng branch it silently drew on the bare `mc-*` stream that every sidebar journey
rigs by name. Both are now one rule: **every surface but the sidebar deck is scoped**, and
`_mcOptAttr(surface)` derives the handle. The JIT needed no new branch anywhere.

**THE KEYBOARD IS A SINGLE SLOT.** `this._mc` is what A-D grades against and the newest block
owns it, so the drill takes the keys from a landing question that outlives it. `_clearNodeQ`
already solved this for the dossier; the body is now `_handBackMc(fromSurface)` and the option
sheet's one `_detailCtx` writer calls it on the way out. The landing block is handed back only
while still askable — `_declineLandQ` stamps `answered` when the sheet opens, and a declined
question must never be re-graded.

**CREDIT COUNTS ONCE.** `_mcAnswer` already carries stage, prep, sharpness, the SRS clock and the
daily counter, so the drill's own `banked()` carries the odds pump and the beacon handoff and no
credit at all. The recall rung still grades itself (no `_mcAnswer` ran). A wrong answer pumps
nothing and offers `[data-jit-next]`: the sidebar auto-advances and the panic drill deliberately
does not (there, being wrong costs you the escape window), but this sheet is paused and a read
answer should not strand the drill.

**MUTATION TABLE** (built bundle, `e2e/journeys/jit-format.spec.ts`, all KILLED): always-recall ·
always-MC · the `jit` rng scope dropped · a wrong answer pumps · `banked()` re-credits prep ·
`_handBackMc("jit")` dropped. NON-KILLS recorded in the spec header: the cold-pool fallback is
unreachable under the harness (monolith payload ⇒ `mcPoolWarm` is unconditionally true), so
`_jitWarmTried` ships checked by hand only.

**THE HAND-BACK'S FIRST CUT BROKE THE KEYBOARD, AND ITS OWN SPEC DID NOT NOTICE.** `_handBackMc`
was extracted from `_clearNodeQ` verbatim, guard included: refuse the hand-back when
`_landQ.answered`. That guard is correct for the DOSSIER, which never declines — there `answered`
means the player answered. The option sheet calls `_declineLandQ("sheet")` on the way IN, so
`answered` is true on every close and the guard fired every time, nulling `this._mc` where before
the change it had simply survived. Strictly worse than the do-nothing it replaced: A-D stopped
answering the landing question after Esc. Caught by `keyboard.spec.ts` and `option-edge.spec.ts`,
NOT by the new spec's own journey 5 — which asserts only that the keys stopped pointing at "jit",
and nulling satisfies that too. **An assertion weaker than its claim passes the build that breaks
the claim** (§6.3). The hole and its mutant (M7) are now recorded in that spec's header, and the
guard takes an explicit `declinedOnEntry` because the two callers genuinely differ. Handing back is
safe regardless: the landing block's own `answer()` refuses to re-grade once `answered || spent`.

**THE SIX ECONOMY SPECS WERE NOT REWRITTEN.** `jit-loop`, `guidance-defense`, `stakes-impact` and
four gen specs each clicked `[data-jit-reveal]` then `[data-jit-got]` on a fresh deck — all nine
call sites would have gone red. Not one of them is about the format; they are about the odds pump,
the lesson-done math and the refund budget. So the format moved into the DSL as `jitGrade()`,
which answers whichever rung is on screen and reads the correct option from `__neural._mc` rather
than re-deriving it (a spec-side grader would agree with a broken build by construction, §6.3).

**A STALE WORKTREE PAYLOAD LOOKS EXACTLY LIKE A BROKEN CHANGE.** First run of the three affected
core specs: 12 red, including tests that never touch the JIT. Stashing the change reproduced all
12 on clean `origin/dev` — `source/public` in the worktree had been built on the v1.91.0 branch,
so `graph-data.json` did not match the bundle and node lookups returned undefined
(`TypeError: reading 'ty'`). `npm run dev:neural:app` refreshes only the bundle; the payload needs
`dev:neural`. Baseline before you debug.

---

## v1.149.3 — THE CATALOG'S CHECKPOINT WAS A MODAL PRODUCTION HAS NEVER HAD

**How it surfaced.** A stale feature branch (`journey/catalogx-wt`, v1.88.0, fifty-five versions
behind) was audited before rebasing. Four of its five changes were superseded; the fifth,
"checkpoint un-hard-code", was superseded in *mechanism* — dev had since added the
`options.checkpoint` passthrough — but the branch was **right about production** and dev's
replacement was not. The branch was dropped; this is the finding that survived it.

**Three things disagreed with production at once.**

| | catalog said | production does |
|---|---|---|
| surface | centred `role="dialog"` modal | the ONE left pane, in study takeover |
| header | `BLUE BELT CHECKPOINT · 4/8` | `setDrillHeader("Checkpoint", "<i> of <n> · <unit name>")` |
| selector | `[data-checkpoint]` | **0 matches in `app.src.jsx`** |

`_checkpointShow()` sets `drillEntries`, calls
`setDrillHeader("Checkpoint", (cp.i + 1) + " of " + cp.picks.length + " · " + cp.unit.name)`, then
`renderDrill(); deckOpen = true; applyDeckVisibility()`. `_paneStudyActive()` counts `_checkpoint`
alongside a deck and a session. There is no dialog anywhere in it. A checkpoint also belongs to one
**unit** of one belt and is asked card by card, so a belt-level `4/8` tally is not a rounding of the
truth — it is a different quantity.

**The catalog's own registry already knew.** `sequence-registry.js` has said for versions that
"a live deck, session or checkpoint hides the nav entirely and stamps the pane
`data-pane-study`", and `components-pane.js`'s `studyBody` header says "A live deck/session/**
checkpoint** hides the tab bar". The prose described the pane; the renderer drew a modal.

**The decision, and what settled it.** Owner: */dev is an internal-only surface, never shown or
linked to end users.* That collapses the trade-off — the ceremonial-modal reading only had a case
while somebody might see it, and a dev catalog's one job is fidelity to production. So: match
production, and delete the modal framing outright rather than keeping it beside the truth.

**Two adjacent inaccuracies fell out of doing it properly.** `questionBlock` hard-coded
`data-land-mc-opt` and annotated itself `[data-land-q]` — the LANDING card's handles — while being
reused inside `flashcard`'s multiple-choice mode, i.e. inside the pane. Production is explicit that
this is wrong: `_mcOptAttr(surface)` returns the bare `data-mc-opt` for the sidebar deck (which the
checkpoint rides) and `data-<surface>-mc-opt` for everything else, precisely "because the landing
card and an open sidebar card are on screen at the same time, so a bare `[data-mc-opt]` selector
would silently match both". `questionBlock` now takes a `surface`, defaulting to `landing` so every
existing caller is byte-identical. And that same MC path printed the question **twice** — once as
`.flashcard-question`, once as `questionBlock`'s own `<p>` — where production prints it once;
`showPrompt: false` at the one call site that already has a prompt above it.

**What did NOT change, deliberately.** The in-card `deckIdx + 1 / deck.length` counter stays: it
looks like a duplicate of the header's "2 of 6" and is not. Production shows both, because the
header counts the checkpoint's picks while the card counts position within the full deck the pick
came from — `drillEntries = [e]` is the whole deck, presented at one card. And
`.pane-study-head` gained only `flex-wrap` plus a `.pane-study-sub` rule; the sub-less study states
emit no `<small>` at all, so they render identically.

**Gates.** `validate:forward` 38 use cases / 19 journeys / 114 screens / 60 components, and the
browser half — `e2e/journeys/forward-components.spec.ts` on :8131 — 16/16. Neither is a *parity*
gate: `check_forward_catalog.mjs` only proves every frame renders non-empty without a throw, and
**nothing in the repo reads `data-production-selector` at all** — it is documentary markup for a
human reading the DOM. So this commit makes the annotation true; it does not make it enforced, and
§6.8's standing warning that the Forward catalog is a design mock with no parity gate is unchanged.
Verified by rendering all three states directly: 3 MC options, `data-mc-opt` and zero
`data-land-mc-opt`, the prompt printed once, `modal-layer` absent, and `data-mc-result` reading
`correct` / `trap` / absent across correct, wrong and question.
---

## v1.151.0 — "IN THIS SYSTEM" MEANS FROM THE PLACES THE SYSTEM TEACHES

Owner's report, near verbatim: clicking a system shows "in this system" with one calf slicer
*"being applied from every fucking place"*, omoplata *"from a lot of techniques too. It seems odd
that if a submission is in the system, then we get all variants of it. Maybe it should be more
specific, or this system should be improved."*

**Not `process_systems`.** The first suspect (`scripts/regenerate_graph.py:974`) resolves each
ref to exactly ONE node and expands nothing — graph.json's `systems[].members` totals 1,111,
median 24, **max 30**. The bloat is downstream, in `regenerate_neural_data._node_indexes`, whose
`variant`/`children` layers exist precisely *because* a submission family hub is not a graph node:
**0 of 297 families appear in globalGraphLayout.json**, so `Submissions/Calf-Slicer` cannot be lit
and the emitter expanded the family name to every real `from X` finish instead.

**Measured before the fix:** family expansion contributed **909 of 1,711 member nodes (53%)** from
**109 refs**, and *every one of the 109 was a Submissions ref* — no position-children expansion
occurs anywhere in the corpus. Median members per system 32, **max 114** (Submission Clinic System).
The owner's exact case: the 10th Planet No-Gi Guard System teaches Truck and Twister Control and was
lighting **all eleven** calf slicers — from 50-50, Backside 50-50, Carni, Honey Hole, Inside
Sankaku, Rodeo Ride, Russian Cowboy, Saddle and Twister Side Control as well.

**Three candidate rules, measured against the real corpus.** (a) *reference the family node once* is
**not implementable**: there is no family node to reference — it would light nothing. (c) *explicit
refs only* cuts to 703 (median 15) but throws the signal out with the noise — 10th Planet loses
`Calf Slicer from Truck`, which is exactly what that system teaches. (b) **an instance belongs only
if the system also teaches the position it is thrown from** — 1,711 → **952**, median 32 → **19**,
max 114 → **57**, and on the owner's case it yields precisely `from Truck` + `from Twister Control`.
Rule (b) shipped, in one sentence: *"in this system" means the moves this system teaches, from the
places it teaches them.*

**ONE implementation, two consumers.** `_anchor_family(candidates, taught, byid)` is the only
site; `build_systems` became two passes (resolve every ref, then anchor the families against the
positions pass 1 proved the system teaches) because the rule needs the whole system before it can
judge any part of it. Both surfaces already read the emitted `nodes` through `app.src.jsx
systemNodeIdxs()` — `renderSystemDetail` (the side panel and its "In this system" kicker) and
`openSystem → setFocusIdxSet` (the light-up) — so narrowing the payload narrows both and they
cannot drift. **No app change was needed, and that is the point.** An explicitly authored instance
(`Kimura from Half Guard`) is never narrowed; `_resolve_member` now returns `(nodes, was_family)`
so "the author named a family" is data, not re-inferred from a node count.

**The §6.6 half.** A family ref that anchors nothing is neither expanded nor silently dropped: it
lands in the system's new `unanchored` list, `_meta.unanchored`, and the emitter's every-run print.
**31 refs across the corpus**, and each is a genuine CONTENT gap, not a rule failure — Craig Jones
Leg Lock System names `Inside Heel Hook` while teaching Saddle, but the finishes are authored from
**Honey Hole / Inside Sankaku / Ushiro Ashi Garami**, which are separate position nodes here and the
same position to most readers; Submission Clinic System names `Omoplata` but teaches no guard any
omoplata is authored from. **No system lost its submissions entirely** — 11 systems had zero
submission members before and the same 11 after.

**Gated in `check_systems_payload.py` (check 9), which both deploys already run.** `glue[].fam`
marks an expanded ref and how many instances it offered, so the gate SEES the rule instead of
inferring it — a family narrowed to one node is otherwise indistinguishable from a direct ref.
Coverage floor `FAM_REF_FLOOR = 70` (measured 97), because a matcher that matches nothing reads
exactly like a pass. `MIN_MEMBER_NODES` 1600 → 880, `UNANCHORED_CEILING = 31`, with recompute
commands.

**Mutation-proved, four mutants, all killed:** anchoring disabled (the pre-fix behaviour) → 104
violations naming the calf slicer by node; `fam` dropped → coverage falls to 63 and the floor
fires; anchor predicate always true → red; `taught` widened to every position → red. Control
re-runs green; `validate:seats`, `:occurrence`, `:json`, `:graph`, `:curriculum`, `:mc`,
`:score-coverage` all pass. `e2e/journeys/systems-surface.spec.ts` needed no edit — it picks the
widest system *from the payload* and asserts the lit set equals the published members, so it is
member-count-relative by construction.

**For the owner:** the rule answers "more specific"; the 31 `unanchored` refs are the "this system
should be improved" half, and the highest-value one is that **Saddle and Honey Hole are separate
position nodes** — adding Honey Hole to the leg-lock systems' `related_content` would re-anchor
several heel hooks at once.
