# Sidebar build (v1.242.0) — the 145-row capability table

Every capability of the pane, the account menu and the map chrome as the U49 inventory (D-523,
`prompts/sidebar-capability-inventory.md`, recovered from the app source on 27 October) listed it, and
where it lives after the drawer (owner A5 · E1 · T-b). Status: **kept** (same place), **moved** (named),
**retired** (with the owner decision). "Proven by" names the journey (e2e/journeys/ unless a path is
given) or unit test that asserts it; *touches* means a test exercises it without asserting all of it;
UNGUARDED rows were unguarded before this build and are untouched by it.

| # | capability (inventory text, abridged) | status | where now / why | proven by |
|---|---|---|---|---|
| | **1. Side pane: shell and foot (all tabs)** | | | |
| 1 | Opening the pane pauses the roll; closing it resumes only if the pane caused the pause | kept | pane law unchanged: the drawer pauses on open, resumes only its own pause (applyDeckVisibility) | pane-law.spec.ts "opening the pane stops the game; closing it resumes" |
| 2 | "×" (title and aria "Close panel"): closes the pane | moved | to the drawer head's drawer icon (same aria/title "Close panel") | pane-law.spec.ts (✕ closes, game resumes); sidebar.spec.ts "one drawer icon opens the drawer…" |
| 3 | Esc closes the pane (after modal, list picker, account menu, replay) | kept | Esc ladder unchanged; the badge menu closes before the drawer | account-menu.spec.ts "Esc closes the menu first, then the drawer"; pane-chrome.spec.ts "Esc closes the modal first…" |
| 4 | Phone: tapping the exposed strip of graph closes the 88vw drawer | kept | phone 88vw drawer, exposed strip still closes it, and the closing tap now does only that (SIDE-R2 P1: it staged a roll on a node, dismissed the card on the background) | sidebar.spec.ts "on a phone, a left swipe closes the drawer" (the exposed-strip tap, added); "the tap on the exposed strip that closes the drawer does only that" |
| 5 | "Explore" tab, subtitle "Mastered N%" (Game Knowledge score) | moved | "Mastered N%" is the badge menu's detail line "Mastered N · P%" (U46 b: more detail after opening) | belt-meter.spec.ts "a seeded score moves the subtitle…" ([data-menu-mastered]); game-knowledge.spec.ts |
| 6 | "Challenges" tab, subtitle is the worn belt with 0–4 stripes; aria "Challenges: X of Y units proven on the <belt> tra… | moved | the worn belt is drawn under Path row, stripes as its tail; aria "Path: X of Y units …, N stripes" (T-b) | sidebar.spec.ts "Practice, Path and Last rolls open their views…" (stripes, belt); belt-worn.spec.ts; tests/belt_worn.test.mjs |
| 7 | "Last rolls" tab, static subtitle "Your last rolls" | moved | the Last rolls section header on the drawer list (with the roll count) | sidebar.spec.ts "Practice, Path and Last rolls open their views…" (Last rolls header) |
| 8 | Swipe or trackpad horizontal flick moves one tab (off during study) | retired + moved | tab paging retired with the tabs (owner A5/E1, U51 e: one list); a left swipe now closes the drawer; the trackpad flick is retired | sidebar.spec.ts "on a phone, a left swipe closes the drawer"; its guards re-pinned on the new gesture (SIDE-R2 S1): "a left swipe mid-Practice keeps the drawer and the session", "the left swipe's guards…" (scroller, vertical, pinch, swipe-is-not-a-tap) |
| 9 | "‹ Back" in a study takeover: returns to the tab it came from (the tab bar is hidden meanwhile) | kept | ‹ Back returns to the view it came from (list, Path or Last rolls) | pane-chrome.spec.ts "a study takeover owns the drawer body; its ‹ Back hands the list back" |
| 10 | Stat row at the pane foot, shown on all tabs: "Mastered N (P%)" opens a "Mastered" modal ("N techniques", rows "✓ dri… | moved | Mastered → the badge menu's "Mastered N · P%" row, which opens the same Mastered modal | account-menu.spec.ts "rows open the real surfaces" (Mastered modal) and "signed out: a short menu…" |
| 11 | "N due" (amber, tooltip "N cards due · N techniques · N answered today"): opens the plan session on Maintenance | moved | N due → Practice row: amber "N due" pill, same tooltip, opens Practice (the plan session) | sidebar.spec.ts "Practice, Path and Last rolls…" ("2 due"); srs-due.spec.ts (title, card count) |
| 12 | "N new", or fallback text "Study plan" / "Suggestions loading…" / "Suggestions queued" / "Retry suggestions" / "Sugge… | moved | N new and its fallback states → inside Practice (owner U56 e: no Gaps item): the row's tooltip and the session's study panel | tests/gameplan_stats_repaint.test.mjs; tests/gameplan_study_host_app.test.mjs; practice-mix.spec.ts |
| 13 | "Save your progress" caption at the pane foot, hidden during study [G] | moved | the guest's Save pill in the badge (round 4's calmer save offer, after G7 e) | sidebar.spec.ts "a guest's badge offers to save…" |
| 14 | "Create account": opens the sign-up modal [G] | moved | the badge's Save pill and the menu's "Create account" | account-menu.spec.ts "rows open the real surfaces"; sidebar.spec.ts (badge Save) |
| 15 | "Already have one? Log in": opens the login modal [G] | moved | the badge menu's "Log in" | account-menu.spec.ts "rows open the real surfaces" |
| 16 | "Request a technique": feedback modal (textarea, "about: <state>" checkbox, "Send"), sent to PostHog | moved | the badge menu's small line "Request a technique" (a real button now) | feedback-modal.spec.ts; footer-feedback.spec.ts; account-menu.spec.ts |
| 17 | "Help improve it": "Help improve the graph" feedback modal | moved | the badge menu's "Feedback" (a real button now) | account-menu.spec.ts "rows open the real surfaces"; feedback-modal.spec.ts |
| 18 | "GitHub" chip, which becomes "★ N" once star count loads (fetched on first pane open, cached a day); opens github.com… | moved | the badge menu's small line "GitHub" / "★ N" (count fetched on first menu open, cached a day) | footer-feedback.spec.ts "the GitHub chip paints a day-cached star count…" |
| 19 | Gear icon (title "Settings", no text): opens Settings on the Flashcards tab | moved | the badge menu's "Settings" (Flashcards tab) | account-menu.spec.ts "rows open the real surfaces" (Flashcards tab) |
| 20 | "Terms": "Terms of Use" modal | moved | the badge menu's small line "Terms" (a real button now: the keyboard defect is fixed) | account-menu.spec.ts; sidebar.spec.ts "keyboard: … small links work by key" |
| 21 | "Privacy": "Privacy Policy" modal. Note: the feedback links, gear, Terms and Privacy are clickable `<span>`s, so keyb… | moved | the badge menu's small line "Privacy" (a real button now: the keyboard defect is fixed) | account-menu.spec.ts; sidebar.spec.ts "keyboard: …" (real controls) |
| | **1. Explore tab** | | | |
| 22 | Search box, only at the Explore root, placeholder "Search techniques and Systems…". Results: Systems tagged "System",… | moved | the drawer's first row (owner U51 e: Search first) | explore-sections.spec.ts "search reveals a technique…"; explore-search-escape.spec.ts; sidebar.spec.ts (order) |
| 23 | "/" or ⌘/Ctrl+K: opens the pane on Explore and focuses search | kept | unchanged | keyboard.spec.ts "slash opens the explorer and stops the game" |
| 24 | "Loading aliases…" / "Alias search unavailable. Names still work." + "Retry" | kept | unchanged | alias-search.spec.ts |
| 25 | All 7 section headers fold; fold state is a synced setting (`exploreOpenSections`), collapsed by default | kept | the six categories and Your lists fold as before; Explore itself folds too (key "Explore" in exploreOpenSections, open by default) | explore-sections.spec.ts "fresh boot: every Explore section starts collapsed"; sidebar.spec.ts (the Explore fold) |
| 26 | Arriving on /Positions, /Transitions, /Submissions, /Systems, /Principles or /Learning opens the pane with that secti… | kept | the arrival also opens the Explore fold that holds the category | explore-sections.spec.ts "arriving on a category hub URL opens Explore with that section expanded" |
| 27 | "Systems (N)": topic groups (count), then system rows (name + difficulty); a row opens its article and closes the pane | moved | a category under the drawer's Explore fold (E1), in the owner's order; rows unchanged | systems-surface.spec.ts "Systems topics expand as independent subtrees…" |
| 28 | "Loading systems…" / "Systems could not be loaded. Retry systems" | moved | a category under the drawer's Explore fold (E1), in the owner's order; rows unchanged | UNGUARDED (pre-existing; untouched) |
| 29 | "Principles (N)": rows open the article | moved | a category under the drawer's Explore fold (E1), in the owner's order; rows unchanged | concepts-surface.spec.ts "Explore lists every authored principle…" |
| 30 | "Positions (N)" (circle glyph): families, then technique rows, which open the article | moved | a category under the drawer's Explore fold (E1), in the owner's order; rows unchanged | camera-continuity.spec.ts "Explore → Mount by mouse…"; explore-sections.spec.ts |
| 31 | "Transitions (N)" (diamond glyph), same behaviour | moved | a category under the drawer's Explore fold (E1), in the owner's order; rows unchanged | play-from-row.spec.ts "an Explore technique row plays too"; explore-sections.spec.ts (touches) |
| 32 | "Submissions (N)" (triangle glyph), same behaviour | moved | a category under the drawer's Explore fold (E1), in the owner's order; rows unchanged | defending-arrivals.spec.ts "Browse category navigation…"; play-from-row.spec.ts |
| 33 | Family sub-folds (name + count; remembered for the session only) | moved | a category under the drawer's Explore fold (E1), in the owner's order; rows unchanged | defending-arrivals.spec.ts (touches: count and session memory not asserted) |
| 34 | "Learning (N)": rows open the article | moved | a category under the drawer's Explore fold (E1), in the owner's order; rows unchanged | concepts-surface.spec.ts "Explore lists every authored Learning entry…" |
| 35 | ▶ "Play from <name>" on every technique row: confirm dialog "Start a fresh roll" / "Roll from <X>?" with a seat choice | kept | unchanged | play-from-row.spec.ts |
| 36 | ★ save star (aria "Add to a list" or "Add to a list — already in “A”, “B” and N more"): opens the list picker | kept | unchanged | lists-picker.spec.ts |
| | **1. Explore → "Your lists"** | | | |
| 37 | "Your lists (N)" header: folds, opens itself when you create, add, undo, or arrive from a share | moved | Your lists is its own drawer section after Path (U51 e, U60 b); the block is unchanged | lists-section-fold.spec.ts |
| 38 | "+" (aria and title "New list"): creates "Class · <Mon D>" and opens rename | moved | Your lists is its own drawer section after Path (U51 e, U60 b); the block is unchanged | share-lists.spec.ts "the + beside Your lists…"; lists-rename.spec.ts |
| 39 | Empty state "Organize techniques into classes or training lists." (variant: "Save the shared class above to keep it —… | moved | Your lists is its own drawer section after Path (U51 e, U60 b); the block is unchanged | share-lists.spec.ts (empty text) |
| 40 | Clicking a list row lights its techniques on the graph and frames the camera | moved | Your lists is its own drawer section after Path (U51 e, U60 b); the block is unchanged | lists-rename.spec.ts |
| 41 | List name (title "Rename this list"): inline edit, aria "List name", max 60; Enter or blur saves, Esc cancels | moved | Your lists is its own drawer section after Path (U51 e, U60 b); the block is unchanged | lists-rename.spec.ts |
| 42 | Count + chevron ("Show/Hide the techniques in “X”"): expands the items | moved | Your lists is its own drawer section after Path (U51 e, U60 b); the block is unchanged | lists-disclosure.spec.ts |
| 43 | Share icon ("Share “X” as a link"): phone share sheet; otherwise copies the link with toast "Link copied"; if the cli… | moved | Your lists is its own drawer section after Path (U51 e, U60 b); the block is unchanged | share-lists.spec.ts "sharing produces a canonical… link" |
| 44 | Delete "×": first click arms "Delete?" for 8s, second click deletes | moved | Your lists is its own drawer section after Path (U51 e, U60 b); the block is unchanged | share-lists.spec.ts "deleting a list asks first…" |
| 45 | "Deleted “X” · N techniques" + "Undo" (90s) | moved | Your lists is its own drawer section after Path (U51 e, U60 b); the block is unchanged | share-lists.spec.ts (undo) |
| 46 | Item name (full name with qualifier): puts that technique on the map and closes the pane | moved | Your lists is its own drawer section after Path (U51 e, U60 b); the block is unchanged | lists-disclosure.spec.ts "clicking a listed technique opens its dossier" |
| 47 | Item "×" ("Remove from this list"); removing the last item deletes the list, with undo | moved | Your lists is its own drawer section after Path (U51 e, U60 b); the block is unchanged | lists-disclosure.spec.ts; lists-picker.spec.ts |
| 48 | Empty list text "No techniques yet — tap the star on the card you land on, on a move’s detail sheet, or on any Explor… | moved | Your lists is its own drawer section after Path (U51 e, U60 b); the block is unchanged | lists-disclosure.spec.ts |
| 49 | List picker "Add to list" + technique name: one checkbox row per list toggles membership; toasts "Added to “X”…", "Re… | moved | Your lists is its own drawer section after Path (U51 e, U60 b); the block is unchanged | lists-picker.spec.ts; share-lists.spec.ts |
| 50 | Picker "+ New list": inline name (prefilled "Class · <date>") + "Create" makes the list and adds the technique | moved | Your lists is its own drawer section after Path (U51 e, U60 b); the block is unchanged | lists-picker.spec.ts "New list names and files in one action" |
| 51 | Opening a share link (/l/<code> or ?l=): desktop opens the pane with the class lit; phone lights the graph and shows … | kept | unchanged; the shared class renders inside Your lists | share-lists.spec.ts; share-mobile.spec.ts |
| 52 | "Shared with you · N techniques" block: item names, ▶ and ★ per item; note "…in this link aren’t in this version of t… | kept | unchanged; the shared class renders inside Your lists | share-lists.spec.ts; share-mobile.spec.ts |
| 53 | "Show on graph" / "◉ On graph": lights the class again | kept | unchanged; the shared class renders inside Your lists | share-lists.spec.ts "the recipient can re-light the received class…" |
| 54 | "Drill these": study session over the received class | kept | unchanged; the shared class renders inside Your lists | share-lists.spec.ts ([data-shared-drill]) |
| 55 | "Save": saves it as "Shared · <date>" | kept | unchanged; the shared class renders inside Your lists | share-lists.spec.ts |
| 56 | "Not for me": dismisses, and the share id is remembered | kept | unchanged; the shared class renders inside Your lists | share-lists.spec.ts "a saved or dismissed link stops asking…" |
| 57 | Notices "Shared class · not in this version yet" / "· this link is incomplete" / "· this link can’t be read" | kept | unchanged; the shared class renders inside Your lists | share-lists.spec.ts; share-mobile.spec.ts |
| | **1. Explore → in-pane System/Principle/Learning detail ("Study tools")** | | | |
| 58 | "Study tools" button on a reference article (outside the pane) opens the detail view in the pane; /Systems/… URLs and… | kept | unchanged | systems-surface.spec.ts |
| 59 | "‹ Back to systems", title, type/difficulty chips, "N techniques and positions on the graph" | kept | unchanged | systems-surface.spec.ts |
| 60 | Course: cover or intro video, course title link, "By <instructor>", "View course on <vendor> ↗", "Explore the full co… | kept | unchanged | systems-surface.spec.ts |
| 61 | Guide sections: "About this course/guide", "Is this for you?", "Also consider", "Coverage and limits", "Related guide… | kept | unchanged | systems-surface.spec.ts |
| 62 | "Related technique cards N/M recall-proven": rows put the technique on the map; "N variants · N proven" rows expand | kept | unchanged | systems-surface.spec.ts (touches: N/M and variants not asserted) |
| 63 | "Review related technique cards": study session | kept | unchanged | systems-surface.spec.ts "related-card review keeps the existing session behavior" |
| 64 | "Loading guide…" / "Retry guide" / "Open reference page ↗" / "Retry system" | kept | unchanged | systems-surface.spec.ts |
| 65 | Concept detail: "‹ All principles" / "‹ All learning", film clips, sections with "Show N more" / "Show less", "Self-a… | kept | unchanged | concepts-surface.spec.ts |
| 66 | "Related concepts" / "Related reading" links | kept | unchanged | concepts-surface.spec.ts |
| 67 | "Explore techniques (N)" plus "Show more techniques (60 of N)" | kept | unchanged | concepts-surface.spec.ts |
| 68 | "Sources (N)", "Loading article…" / "Retry article" | kept | unchanged | learning-reader.spec.ts |
| | **1. Challenges tab** | | | |
| 69 | Sticky band, only when cards are due: "N cards due" · "keep what you’ve earned" · "Start" opens the due session | kept | in the Path view; "Start" opens Practice (openDueSession → openPlanSession) | srs-due.spec.ts ([data-maintenance]) |
| 70 | Belt headers "White belt" … "Black belt" with "X of Y" and a ✓ stamp; clicking selects and opens the belt | moved | the Path view (Path row, T-b); the corridor is unchanged | challenges-ui.spec.ts |
| 71 | ▾/▸ fold ("Collapse/Expand <Belt> belt"), saved as a setting; the current belt opens by default | moved | the Path view (Path row, T-b); the corridor is unchanged | challenges-ui.spec.ts "belt sections collapse independently…" |
| 72 | Opening the tab scrolls to the current belt and highlights the next lesson | moved | the Path view (Path row, T-b); the corridor is unchanged | challenges-ui.spec.ts "…opening Challenges lands on the frontier's belt section" |
| 73 | Objectives, only for a selected non-white belt: title, why, "N of M" / "Complete", action buttons ("Start a roll here… | moved | the Path view (Path row, T-b); the corridor is unchanged | challenges-ui.spec.ts |
| 74 | Unit groups: name, "N of M lessons", status "Checkpoint cleared" / "Not started" / "All lessons done" / "x/y done" | moved | the Path view (Path row, T-b); the corridor is unchanged | gen/holder-film-look-mints-no-study-credit.spec.ts |
| 75 | Lesson row (crown, deck name, role, ✓ when done): opens the inline deck and puts the technique on the map, pane stays… | moved | the Path view (Path row, T-b); the corridor is unchanged | challenge-curriculum.spec.ts "a lesson row selects its node and URL…" |
| 76 | ▸ ("Show this lesson's cards inline") | moved | the Path view (Path row, T-b); the corridor is unchanged | challenge-curriculum.spec.ts; keyboard.spec.ts |
| 77 | Inline flashcard deck (also used in Last rolls): card dots, "Reveal" (space) / "Hide answer", "Review again", "Got it… | moved | the Path view (Path row, T-b); the corridor is unchanged | keyboard.spec.ts; pane-history.spec.ts |
| 78 | "Start checkpoint" / "Checkpoint available after N lessons" / "Checkpoint cleared": multiple-choice checkpoint quiz t… | moved | the Path view (Path row, T-b); the corridor is unchanged | challenge-curriculum.spec.ts; study-story.spec.ts |
| 79 | "BLACK-BELT REWARD · Recall Mode" row (earned or locked copy) | moved | the Path view (Path row, T-b); the corridor is unchanged | recall-badge.spec.ts |
| 80 | "OPTIONAL CONTENT CAPSTONE · <Track> capstone" + "Start capstone" / "Available after every unit checkpoint" / "Capsto… | moved | the Path view (Path row, T-b); the corridor is unchanged | content-capstone.spec.ts; challenges-ui.spec.ts |
| 81 | "Principles of this level" (only appears if the curriculum data supplies it) | moved | the Path view (Path row, T-b); the corridor is unchanged | challenge-curriculum.spec.ts |
| 82 | "REWARDS N patches · N mat coins" shelf (only once something is earned) | moved | the Path view (Path row, T-b); the corridor is unchanged | challenges-ui.spec.ts "the rewards shelf shows only what is earned" |
| 83 | Keys: ↑/↓ move between lessons, ←/→ cards, Space flips, ⏎ "Got it" | moved | the Path view (Path row, T-b); the corridor is unchanged | keyboard.spec.ts "the Challenges corridor pages, flips and grades…" |
| 84 | "Curriculum is unavailable right now. Action challenges still work." | moved | the Path view (Path row, T-b); the corridor is unchanged | challenge-curriculum.spec.ts "missing curriculum keeps action Challenges usable…" |
| | **1. Last rolls tab** | | | |
| 85 | "Previous rolls" rows: outcome dot, "<start> → <end>", "N states · won/tapped/reset · Xm ago" | moved | the Last rolls view (its section header or any row); the list also shows this roll and the last three | pane-history.spec.ts |
| 86 | ▶ "Roll from <start>, <top/bottom>": confirm "Set the board here", then closes the pane | moved | the Last rolls view (its section header or any row); the list also shows this roll and the last three | history-replay.spec.ts |
| 87 | ⟲ "Replay <label>" / "Stop replaying <label>" | moved | the Last rolls view (its section header or any row); the list also shows this roll and the last three | history-replay.spec.ts |
| 88 | Clicking a past roll expands its states | moved | the Last rolls view (its section header or any row); the list also shows this roll and the last three | UNGUARDED (pre-existing; untouched) |
| 89 | "This roll" rows: actor dot, "you/they aimed for …", value, "<role> · n/m cards" or "mastered"; "LATEST" badge on the… | moved | the Last rolls view (its section header or any row); the list also shows this roll and the last three | pane-history.spec.ts |
| 90 | ▶ "Roll from <name>, <role>" on older states: rolls right away with no confirm, closes the pane | moved | the Last rolls view (its section header or any row); the list also shows this roll and the last three | UNGUARDED (pre-existing; untouched) |
| 91 | Clicking a state row opens its inline flashcard deck | moved | the Last rolls view (its section header or any row); the list also shows this roll and the last three | keyboard.spec.ts; pane-history.spec.ts |
| 92 | "No rolls yet — press play and your roll shows up here, state by state." | moved | the Last rolls view (its section header or any row); the list also shows this roll and the last three | pane-history.spec.ts; sidebar.spec.ts ([data-hist-empty]) |
| 93 | ↑/↓ move through the roll, ←/→ page cards | moved | the Last rolls view (its section header or any row); the list also shows this roll and the last three | keyboard.spec.ts (touches) |
| | **1. Study takeovers opened from the pane** | | | |
| 94 | Plan session: "Maintenance" / "Learn next" sections; headers "N cards due today", "Today's session", "Finish these to… | kept, renamed | the plan session is Practice (U56 e): one interleaved queue under one "Practice" head, rows tagged Review/New; header "Practice · N reviews, M new"; "Today's practice" replaces "Finish these to unlock more" (SIDE-R1); "Reviewed x/y", "Show N more" kept | practice-mix.spec.ts (all three); gameplan-learning-loop.spec.ts "D2…" (Today's practice, Reviewed x/y) |
| 95 | "Open study plan", "Why these decks?", "Refresh plan", "Study comparison coverage", "Retry comparison" | kept | unchanged | gameplan-learning-loop.spec.ts |
| 96 | "Compare practice choices": "Where to compare" dropdown, "Search techniques or roles", "Compare selected" | kept | unchanged | tests/game_study_controls.test.mjs |
| 97 | End screen "All done, come back tomorrow" / "Session complete" / "Reviews still need attention" + "Close" | kept | unchanged | gameplan-learning-loop.spec.ts |
| 98 | Study deck: "Reveal answer", "Got it", "Review again", "‹ Previous", "Next ›", "Next technique →"; swipe gestures on … | kept | unchanged | covered-card.spec.ts; study-story.spec.ts (touches) |
| | **2. Account menu** | | | |
| 99 | Chip text: "Guest" + "G" [G] / user name + initial [S] / "Offline" + "!". aria "Account menu". It's a div with no Ent… | moved | the badge at the drawer's foot: Guest/G, name/initial, Offline/!; now a <button> (the keyboard defect is fixed) and it shows today | sidebar.spec.ts (guest, signed in, keyboard); auth-owner.spec.ts (Offline) |
| 100 | Email row, not clickable [S] | kept | unchanged | account-menu.spec.ts "signed in with legacy progress…" |
| 101 | "Log out" [S] | kept, renamed | "Sign out" (owner U46 b's word) | account-menu.spec.ts ("Sign out" flips the badge) |
| 102 | "Create account" [G] | kept | unchanged | account-menu.spec.ts |
| 103 | "Log in" [G] | kept | unchanged | account-menu.spec.ts |
| 104 | "Review guest progress": "Import saved practice" modal ("Keep separate" / "Import into <email>") [S, only when guest … | kept | unchanged | account-menu.spec.ts; tests/progress_owner.integration.test.mjs |
| 105 | "Progress could not be saved on this device…" (only on storage error) | kept | unchanged | account-menu.spec.ts "signed out: a short menu…" (the storage-error line, added) |
| 106 | "Settings": Settings on Flashcards | kept | unchanged | account-menu.spec.ts |
| 107 | "Keyboard shortcuts": Settings on Shortcuts | moved | Settings → Shortcuts tab (the menu is short, U46 b) | settings-tabs.spec.ts (Shortcuts tab by mouse); account-menu.spec.ts (row gone from the menu) |
| 108 | "Terms" · "Privacy" | moved | the badge menu's small line | account-menu.spec.ts |
| 109 | Sign-in modal: "Create your account" / "Welcome back", email and password, "Continue with Google", "Already have an a… | kept | unchanged | account-menu.spec.ts (both titles) |
| | **3. Settings** | | | |
| 110 | Tab row (←/→/Home/End) and the warning "BJJ Graph is still being actively built — …" | kept | unchanged | settings-tabs.spec.ts |
| 111 | Flashcards: "Daily goal" (5–200 cards, default 30) | kept | default 20, was 30 (owner U56 e: "The goal today is to do 20 flashcards") | practice-mix.spec.ts (default 20); tests/settings_presentation.test.mjs; tests/gameplan.test.mjs |
| 112 | Flashcards: "Answer mode" Classic recall / Auto / Multiple choice | kept | unchanged | tests/settings_presentation.test.mjs; mc-flashcards.spec.ts |
| 113 | Flashcards: "Recall mode (in play)" On/Off, shown "Locked" until black belt | kept | unchanged | recall-badge.spec.ts |
| 114 | Flashcards: "Focus" Antifragile / Converge (nothing in the app reads this setting) | kept | unchanged | UNGUARDED (pre-existing; nothing reads the setting) |
| 115 | Flashcards: "Show flashcards on pages" ✓ (nothing in the repo reads `quizOnPages`) | kept | unchanged | UNGUARDED (pre-existing; nothing reads the setting) |
| 116 | Flashcards: "Turn what you know gold" On/Off (default Off) | kept | unchanged | mastery-gold.spec.ts |
| 117 | Rolling: "Rolling simulation" Off / Normal | kept | unchanged | UNGUARDED (pre-existing; untouched) |
| 118 | Rolling: "Where the roll starts" Standing / Anywhere / My weak spots, with a "Right now: …" line | kept | unchanged | start-from.spec.ts |
| 119 | Rolling: "Uniform" Gi / No-gi (the only gi/no-gi control) | kept | unchanged | pane-chrome.spec.ts "the GI/NO-GI choice lives in Settings → Rolling…" |
| 120 | Rolling: "Answer time" slider 5–15s (Brisk / Default / Relaxed) | kept | unchanged | tests/settings_presentation.test.mjs |
| 121 | Rolling: "Danger animation" On/Off | kept | unchanged | defending-landing.spec.ts |
| 122 | Rolling: "Questions while you roll" ✓ | kept | unchanged | landing-priority.spec.ts |
| 123 | Rolling: "Bottom of the screen": "Videos during play" / "Question card" / "Your moves" ✓ | kept | unchanged | land-layers.spec.ts; tests/settings_presentation.test.mjs |
| 124 | Rolling: "Article sections", 27 checkboxes | kept | unchanged | article-sections.spec.ts |
| 125 | Rolling: "Sound" On/Off | kept | unchanged | sound.spec.ts |
| 126 | Rolling: "Sound volume" Quiet / Normal / Loud | kept | unchanged | sound.spec.ts |
| 127 | Modifiers: "Your modifiers" (N active), "Search modifiers…", All/Submission/Transition/Position filters, on/off dot, … | kept | already a Settings tab ("Modifiers move into Settings" holds) | tests/settings_presentation.test.mjs (touches) |
| 128 | Notifications: "Training-day email" On/Off (Beta) [S]; guests see "…needs a signed-in account…" | kept | unchanged | notifications-tab.spec.ts |
| 129 | Shortcuts: 13-row reference list, no toggles | kept | unchanged | keyboard.spec.ts "the Shortcuts tab documents the keys that exist" |
| 130 | Settings footer "Terms" · "Privacy" | kept | unchanged | pane-chrome.spec.ts "settings carries Terms · Privacy…" |
| 131 | "Loading settings…" / "Settings could not load. Please try again." + "Close" / "Retry" | kept | unchanged | settings-lazy.spec.ts; tests/settings_presentation.test.mjs |
| | **4. Map chrome** | | | |
| 132 | Top-left pane button, aria "Menu — open learning panel". Phone ≤640px: hamburger + "Menu". Desktop: "bjjgraph.org" + … | moved | one drawer icon, no label (A5/U46: "Nothing is labelled Menu"); aria/title "Open the sidebar (/)"; amber dot while reviews are owed; focuses search on desktop, not on a phone | sidebar.spec.ts "one drawer icon opens the drawer, and nothing is labelled Menu"; challenges-ui.spec.ts (phone 44px) |
| 133 | Toast "Save your progress · Open the panel to keep it", once per session after 20 moves or 2 cards. It has no sign-in… | kept, fixed | guests only now (the inventory's defect); copy "Open the sidebar to keep it" | sidebar.spec.ts "a guest's badge offers to save; a signed-in player gets neither…"; pane-law.spec.ts |
| 134 | Top-centre announcer toast (not clickable) | kept | unchanged | announcer-coherence.spec.ts |
| 135 | Top-centre banner "Can’t reach your account. …" + "Try again" (account playing offline) | kept | unchanged | auth-owner.spec.ts "local-only…" |
| 136 | Top-right reward toast "PATCH EARNED" / "MAT COIN MINTED" + "View Collection" (opens the Challenges rewards shelf) + … | kept | unchanged | challenges-ui.spec.ts "a Mat Coin acknowledgement links to its permanent rewards-shelf entry" |
| 137 | Account chip, bottom-right at all widths; fades and stops responding under the phone drawer | moved | the badge inside the drawer (U46 b) | account-menu.spec.ts "the badge sits in the drawer…"; pane-chrome.spec.ts "the drawer anchors LEFT…" |
| 138 | Share cue above the chip, only after a received link, hidden while the pane is open: "◉ N" / "◎ N" + "Class ▸" / "New… | moved | the share cue takes the chip's old bottom-right seat | pane-chrome.spec.ts "…the share cue renders only with a cue"; share-mobile.spec.ts |
| 139 | Bottom-centre restore buttons for hidden layers: "▶" "Show the videos", "?" "Show the question card", "⋯" "Show your … | kept | unchanged | land-layers.spec.ts |
| 140 | ★ on the graph's seat label (hidden while the pane is open) | kept | unchanged | seat-star.spec.ts |
| | **5. Bottom-left legend** | | | |
| 141 | "Position" (circle) | kept | unchanged | sidebar.spec.ts "…the legend never moves" (touches: the label itself is pre-existing UNGUARDED) |
| 142 | "Transition" (diamond) | kept | unchanged | sidebar.spec.ts "…the legend never moves" (touches: the label itself is pre-existing UNGUARDED) |
| 143 | "Submission" (triangle) | kept | unchanged | sidebar.spec.ts "…the legend never moves" (touches: the label itself is pre-existing UNGUARDED) |
| 144 | Key hidden at ≤640px; fades when option cards overlap it | kept | unchanged | sidebar.spec.ts "on a phone, a left swipe closes the drawer" (key hidden at 390, added) |
| 145 | Win/Lose bar: marker shows the current decision's win chance; "Win" becomes "Win NN%", "Lose"; glows on a change of 2… | kept | unchanged | game-value-live.spec.ts; choice-value.spec.ts |

Totals: kept 75, moved 69, retired 1. Unguarded, pre-existing and untouched: rows 28, 88, 90, 114, 115, 117 (and the legend labels 141–143, whose box sidebar.spec.ts measures).

## Owner answers, 29 October (U60 b, U66 a)

The original 145 capabilities remain accounted for above. These rows track the newer sidebar capabilities
explicitly, including the Account preferences destination folded into Settings (U60 b).

| ID | Capability | Status | Destination / authority | Evidence |
|---|---|---|---|---|
| A1 | Account preferences entry | moved | One Settings row in the badge menu (U60 b); duplicate label removed | account-menu.spec.ts "signed in with legacy progress: email, Settings…" |
| A2 | Notifications deep link | moved | Settings → Notifications tab (U60 b); the badge has one Settings entry | account-menu.spec.ts "signed in with legacy progress…" |
| A3 | Train section heading | retired | U60 b: heading removed; Practice then Path retain their order | sidebar.spec.ts "the drawer lists Search, Explore, Practice, Path…" |
| A4 | Account and Settings access during a catch | moved | U16 b + U66 a: reachable drawer icon opens and pauses the catch, then badge → Settings | defending-landing.spec.ts "U16 b / U66 a: the drawer icon stays reachable…" |
| A5 | Feedback | kept | U62: retain the used feedback capability | account-menu.spec.ts "rows open the real surfaces" |
| A6 | Training-day email preference and guest explanation | kept | Settings → Notifications, `emailDigest` unchanged; original row 128 | notifications-tab.spec.ts |
