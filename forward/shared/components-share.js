/**
 * Share links, class lists, and capture — the acquisition surfaces (v1.81.x → v1.103.x).
 *
 * A share link carries a LIST OF GRAPH NODES in its URL: "these are the techniques we
 * learned in today's class", pasted into the gym WhatsApp group. Two halves live here —
 * the coach who captures and shares a class, and the teammate who opens the link on a
 * phone. Both render the FULL authored technique name (main + the dimmer `from <position>`
 * qualifier), because "Kimura" is 35 different techniques in this graph.
 */
import { classLists, listItems, sharedClass } from "./fixtures.js";
import { icon } from "./icons.js";
import { escapeHtml } from "./utils.js";

function itemName(item) {
  return `<b>${escapeHtml(item.main)}</b>${item.from ? `<small> from ${escapeHtml(item.from)}</small>` : ""}`;
}

// ▶ belongs to a TECHNIQUE, never to a collection (v1.103.6): a position or a technique can
// be made the current state and rolled; a list is a bag, like a System. A list row therefore
// carries share and ×, and every verb that acts on ONE technique lives on the item.
function playGlyph(label) {
  return `<button class="pane-glyph" type="button" data-play-from aria-label="${label}">${icon("play", 12)}</button>`;
}

/**
 * The Lists section, at the TOP of Explore — and built from Explore's own three-rung indent
 * (v1.103.5), not from cards: head at pad 12, each list where a family row sits, its
 * techniques where a leaf sits. `Your lists (2)` has to read as a peer of `Systems (47)`.
 */
export function listsSection({
  lists = classLists,
  expanded = null,
  armed = null,
  lit = null,
  undo = false,
  shared = null,
} = {}) {
  const rows = lists
    .map((list) => {
      const open = expanded === list.id;
      const isArmed = armed === list.id;
      return `<div class="pane-row pane-row--list ${lit === list.id ? "is-lit" : ""}" data-list-row="${list.id}">
        <div class="pane-row-main">
          <button class="list-name" type="button" data-list-name="${list.id}">${escapeHtml(list.name)}</button>
          <button class="list-open" type="button" data-list-open="${list.id}" aria-expanded="${open}" aria-controls="items-${list.id}">${list.items.length} techniques <span class="chev" data-list-chevron>${open ? "▾" : "▸"}</span></button>
        </div>
        <button class="pane-glyph" type="button" data-list-share="${list.id}" aria-label="Share ${escapeHtml(list.name)}">${icon("share", 12)}</button>
        <button class="pane-glyph ${isArmed ? "is-armed" : ""}" type="button" data-list-delete="${list.id}" ${isArmed ? 'data-list-delete-armed="1"' : ""} aria-label="Delete ${escapeHtml(list.name)}">${isArmed ? "Delete?" : "×"}</button>
      </div>
      ${
        open
          ? `<div class="pane-items" id="items-${list.id}" data-list-items="${list.id}">${list.items
              .map(
                (item) =>
                  `<div class="pane-row pane-row--item" data-list-item="${escapeHtml(item.main)}">
                    <span class="pane-item-name">${itemName(item)}</span>
                    ${playGlyph(`Play from ${escapeHtml(item.main)}`)}
                    <button class="pane-glyph" type="button" data-list-item-remove data-list-of="${list.id}" aria-label="Remove ${escapeHtml(item.main)} from ${escapeHtml(list.name)}">✕</button>
                  </div>`,
              )
              .join("")}</div>`
          : ""
      }`;
    })
    .join("");
  return `<section class="pane-section" data-lists-section>
    ${shared ? sharedBlock(shared) : ""}
    ${undo ? '<div class="list-undo" data-list-undo>List deleted · <button type="button">Undo</button></div>' : ""}
    <div class="pane-head" data-lists-head>
      <span>Your lists${lists.length ? ` (${lists.length})` : ""}</span>
      <button class="lists-new" type="button" data-lists-new aria-label="New list"><span class="lists-new-chip">+</span></button>
    </div>
    ${rows}
  </section>`;
}

/**
 * The arrival block. A received class is OFFERED, never adopted — Save is one deliberate
 * click — and read order is arrival first: a first-time recipient must never read
 * "Lists (0)" above "Shared with you · 5 techniques".
 *
 * `kind` is the whole point (v1.81.2): four arrivals, four different sentences.
 *  · offer  — it resolved; here is the class
 *  · stale  — a valid code this build does not know yet ("your app is older, reload in a bit")
 *  · broken — one of ours, cut short in transit by a client that clipped the URL
 *  (a path that is not code-shaped at all gets NOTHING: the app is just an app)
 */
export function sharedBlock({
  kind = "offer",
  items = sharedClass.items,
  from = sharedClass.from,
  unresolved = 0,
} = {}) {
  if (kind === "stale") {
    return `<section class="shared-block is-stale" data-shared-stale="3">
      <small>SHARED WITH YOU</small>
      <b>This link is valid — your app is older</b>
      <p>Reload in a bit and the class will open.</p>
    </section>`;
  }
  if (kind === "broken") {
    return `<section class="shared-block is-broken" data-shared-broken="count_mismatch" data-shared-broken-kind="clipped">
      <small>SHARED WITH YOU</small>
      <b>This link is incomplete</b>
      <p>It was cut short on the way here. Ask for it again — the whole class is 5 techniques.</p>
    </section>`;
  }
  return `<section class="shared-block" data-shared-list="${items.length}">
    <small>SHARED WITH YOU</small>
    <b>${items.length} techniques from ${escapeHtml(from)}</b>
    <div class="pane-items">${items
      .map(
        (item) =>
          `<div class="pane-row pane-row--item" data-shared-item><span class="pane-item-name">${itemName(item)}</span>${playGlyph(`Play from ${escapeHtml(item.main)}`)}</div>`,
      )
      .join("")}</div>
    ${unresolved ? `<p class="shared-unresolved" data-shared-unresolved="${unresolved}">${unresolved} technique${unresolved === 1 ? "" : "s"} in this link are not in your build yet — the rest still opens.</p>` : ""}
    <div class="shared-actions">
      <button class="primary-action" type="button" data-shared-save>Save this class</button>
      <button type="button" data-shared-drill>Drill these</button>
      <button type="button" data-shared-relight>Show on graph</button>
      <button class="quiet" type="button" data-shared-dismiss>Not for me</button>
    </div>
  </section>`;
}

/**
 * The phone's terminal state for a share arrival (v1.81.3). On a 390x844 screen the pane IS
 * the screen, so nothing opens: the class is lit, the camera framed on it, and the offer
 * arrives on this standalone band control instead. `◉ N` re-lights without covering the
 * graph; `Class ▸` is the deliberate "let me read it".
 */
export function shareCue({ count = 5, lit = true, broken = false } = {}) {
  if (broken) {
    return `<div class="share-cue is-broken" data-share-band><button type="button" data-share-open>Link incomplete ▸</button></div>`;
  }
  return `<div class="share-cue" data-share-band>
    <button type="button" data-share-cue aria-label="Light this class on the graph again">${lit ? "◉" : "◎"} ${count}</button>
    <button type="button" data-share-open>Class ▸</button>
  </div>`;
}

/**
 * THE CAPTURE PICKER ALWAYS OPENS (v1.102.0, owner: "dont assume"). It used to file
 * straight into `activeListId` whenever there were 0 or 1 lists — but from the second list
 * onward that id is whichever list was last touched, not a destination anyone chose, and the
 * ✓ that followed announced a filing the user never made. It is anchored chrome, not a
 * screen: the clock keeps running, and it closes on pick.
 */
export function listPicker({
  lists = classLists,
  node = listItems[0],
  member = [],
  creating = false,
} = {}) {
  return `<div class="list-picker" data-list-picker="${escapeHtml(node.main)}" role="menu" aria-label="Add ${escapeHtml(node.main)} to a class list">
    <small>ADD ${escapeHtml(node.main).toUpperCase()} TO…</small>
    ${lists
      .map(
        (list, index) =>
          `<button type="button" role="menuitemcheckbox" aria-checked="${member.includes(list.id)}" data-list-pick="${list.id}" ${index === 0 ? 'data-picker-default="1"' : ""}><span>${escapeHtml(list.name)}</span>${member.includes(list.id) ? "<b>✓</b>" : ""}</button>`,
      )
      .join("")}
    ${
      creating
        ? `<div class="picker-new"><input data-list-pick-newname value="Class · Aug 17" aria-label="New list name" /><button class="primary-action" type="button" data-list-pick-create>Create</button></div>`
        : '<button class="picker-new-row" type="button" data-list-pick-new>+ New list…</button>'
    }
  </div>`;
}
