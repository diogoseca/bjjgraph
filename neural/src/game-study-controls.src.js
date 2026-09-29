// Explicit-intent UI only. Root owns lazy loading, host lifetime and result rendering.
const ngStudyControlPanels = new WeakMap();
export function ngGameplanStudyControls(app, { document: doc = globalThis.document, onCompare } = {}) {
  const owner = app._progressOwnerStamp;
  let state = ngStudyControlPanels.get(app);
  if (state && state.owner === owner && state.doc === doc) {
    state.onCompare = onCompare; state.paint(); return state.element;
  }
  state = { owner, doc, mode: '', query: '', page: 0, selected: new Set(), busy: false, message: '', onCompare };
  ngStudyControlPanels.set(app, state);
  const el = (tag, text, parent) => { const node = doc.createElement(tag); if (text != null) node.textContent = text; if (parent) parent.appendChild(node); return node; };
  const displayKey = key => { const at = key.lastIndexOf('|'); return at < 0 ? key : key.slice(0, at) + ' · ' + key.slice(at + 1); };
  const style = node => { node.style.cssText = 'min-height:44px;box-sizing:border-box;width:100%;font:inherit;color:inherit;background:rgba(130,155,200,.09);border:1px solid rgba(150,175,220,.28);border-radius:9px;padding:10px 12px;text-align:left;'; return node; };
  const button = (text, parent, action, name) => { const node = style(el('button', text, parent)); node.type = 'button'; node.style.cursor = 'pointer'; if (name) node.setAttribute('data-study-control', name); node.addEventListener('click', action); return node; };
  const box = state.element = el('section'); box.setAttribute('data-game-study-controls', '1'); box.setAttribute('aria-label', 'Compare practice choices');
  box.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr);gap:12px;min-width:0;padding:16px;border:1px solid rgba(150,175,220,.24);border-radius:12px;color:#dbe2f0;background:rgba(16,25,43,.7);font:inherit;';
  el('h3', 'Compare practice choices', box).style.margin = '0';
  el('p', 'See how restoring each selected technique’s 10% sharpness bonus could affect your simulated win chance. Each is compared separately. This comparison does not change your progress.', box).style.cssText = 'margin:0;line-height:1.5;color:#aebed4;';
  const scopeLabel = el('label', 'Where to compare', box); scopeLabel.style.display = 'grid';
  const scope = style(el('select', null, scopeLabel)); scope.setAttribute('aria-label', 'Where to compare'); scope.setAttribute('data-study-control', 'scope');
  for (const [value, text] of [['', 'Choose a starting point'], ['current-position', 'This position and role'], ['next-roll-current-conditions', 'Next roll, same length and opponent strength']]) {
    const option = el('option', text, scope); option.value = value;
  }
  scope.value = '';
  const scopeNote = el('p', '', box); scopeNote.style.cssText = 'margin:0;line-height:1.5;color:#aebed4;';
  const searchLabel = el('label', 'Find a technique or role', box); searchLabel.style.display = 'grid';
  const search = style(el('input', null, searchLabel)); search.type = 'search'; search.value = ''; search.placeholder = 'Search techniques or roles'; search.setAttribute('aria-label', 'Find a technique or role'); search.setAttribute('data-study-control', 'search');
  const count = el('p', '', box); count.setAttribute('role', 'status'); count.setAttribute('data-study-control', 'count'); count.style.margin = '0';
  const results = el('div', null, box); results.setAttribute('data-study-control', 'results'); results.style.cssText = 'display:grid;gap:8px;min-width:0;';
  const paging = el('div', null, box); paging.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr);gap:8px;';
  const previous = button('Previous page', paging, () => { if (state.page > 0) state.page--; paint(); }, 'previous');
  const next = button('Next page', paging, () => { state.page++; paint(); }, 'next');
  el('h4', 'Your choices', box).style.margin = '0';
  const selected = el('div', null, box); selected.setAttribute('data-study-control', 'selected'); selected.style.cssText = 'display:grid;gap:8px;min-width:0;';
  const message = el('p', '', box); message.setAttribute('role', 'status'); message.setAttribute('data-study-control', 'message'); message.style.cssText = 'margin:0;line-height:1.5;';
  const compare = button('Compare selected', box, () => { void submit(); }, 'compare'); compare.style.background = 'rgba(98,151,227,.22)';
  const current = () => !app.__ngDestroyed && app._progressOwnerStamp === owner && ngStudyControlPanels.get(app) === state;
  const available = () => {
    try {
      const view = Object.create(app); view._keyNode = app._keyNode ? new Map(app._keyNode) : null;
      const entries = Object.entries(app.flashcards?.decks || {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
      return entries.map(([key, deck]) => {
        const role = key.slice(key.lastIndexOf('|') + 1); let reason = '', cards = 0;
        try {
          const index = view.nodeForKey(key); cards = view._deckCardCount(deck);
          if (!['Top', 'Bottom', 'Attacker', 'Defender'].includes(role)) reason = 'This role is not supported';
          else if (!Number.isSafeInteger(cards) || cards <= 0) reason = 'No practice cards available';
          else if (!Number.isInteger(index) || index < 0 || !view.nodes?.[index]) reason = 'Technique unavailable';
          else if (view.giAllows(view.nodes[index]) !== true) reason = 'Unavailable in this ruleset';
        } catch (_) { reason = 'Availability could not be checked'; }
        return { key, role, cards, reason };
      });
    } catch (_) { return []; }
  };
  const scopeReason = () => {
    if (!['current-position','next-roll-current-conditions'].includes(state.mode)) return 'Choose where to compare.';
    if (state.mode === 'current-position' && (!app._decision || app._execution || app._waitingSubmission || app._sweep)) return 'Choose a move in your roll before comparing this position.';
    if (!Number.isSafeInteger(app.maxMoves) || app.maxMoves <= 0 || !Number.isFinite(app.aiSkill)) return 'Start a roll to set its length and opponent strength.';
    return '';
  };
  const reason = rows => {
    if (!current() || app._progressLoaded !== true || (typeof app._progressCurrent === 'function' && !app._progressCurrent())) return 'Your current progress is unavailable. Reopen the plan when ready.';
    if (scopeReason()) return scopeReason();
    if (!state.selected.size) return 'Select at least one technique and role.';
    const by = new Map(rows.map(row => [row.key, row]));
    if ([...state.selected].some(key => !by.has(key) || by.get(key).reason)) return 'Remove unavailable selections before comparing.';
    return '';
  };
  function paint() {
    const rows = available(), by = new Map(rows.map(row => [row.key, row]));
    const matching = rows.filter(row => row.key.toLowerCase().includes(state.query.trim().toLowerCase()));
    const pages = Math.max(1, Math.ceil(matching.length / 12)); state.page = Math.min(state.page, pages - 1);
    const start = state.page * 12, shown = matching.slice(start, start + 12);
    count.textContent = `${matching.length} of ${rows.length} choices match. ${matching.length ? `Showing ${start + 1}–${start + shown.length}. ` : ''}Page ${state.page + 1} of ${pages}. Alphabetical order.`;
    scopeNote.textContent = state.mode === 'next-roll-current-conditions'
      ? 'Uses your next-roll start setting while keeping this roll’s length and opponent strength the same.'
      : state.mode === 'current-position' ? 'Starts from your current position and role, with the time remaining in this roll.' : 'Choose where you want to compare.';
    // ROWS ARE REBUILT ONLY WHEN WHAT THEY SHOW CHANGED (v1.207.8). The app repaints this panel on
    // every study-priority change, including each time Win chance values paint; rebuilding identical
    // rows swapped a button out between the player's pointerdown and pointerup, and that click was
    // lost (found as a detached-element flake in gameplan-study-live.spec.ts). Counts, messages and
    // disabled states below still update on every paint.
    const rowsSig = JSON.stringify([shown.map(row => [row.key, row.reason, row.cards, state.selected.has(row.key)]), rows.length > 0,
      [...state.selected].map(key => [key, by.has(key) ? by.get(key).reason : null])]);
    const rebuild = rowsSig !== state.rowsSig; state.rowsSig = rowsSig;
    const active = doc.activeElement, focusKey = rebuild && box.contains(active) ? active?.getAttribute?.('data-study-key') : null, focusKind = active?.getAttribute?.('data-study-action');
    const focusTargets = new Map();
    if (rebuild) { results.replaceChildren(); selected.replaceChildren(); }
    if (rebuild) for (const row of shown) {
      const item = el('div', null, results); item.style.cssText = 'display:grid;gap:4px;min-width:0;overflow-wrap:anywhere;';
      const choose = button(`${state.selected.has(row.key) ? 'Selected: ' : 'Select: '}${displayKey(row.key)}`, item, () => {
        if (!current()) return;
        if (state.selected.has(row.key)) state.selected.delete(row.key); else state.selected.add(row.key);
        state.message = ''; paint();
      });
      choose.disabled = !!row.reason; choose.setAttribute('aria-pressed', String(state.selected.has(row.key)));
      choose.setAttribute('data-study-key', row.key); choose.setAttribute('data-study-action', 'select'); focusTargets.set('select:'+row.key, choose);
      el('small', row.reason || `${row.cards} cards · ${row.role}`, item);
    }
    if (rebuild && !rows.length) el('p', 'Practice choices are not available yet.', results);
    if (rebuild) for (const key of state.selected) {
      const row = by.get(key), item = el('div', null, selected); item.style.cssText = 'display:grid;gap:4px;overflow-wrap:anywhere;';
      el('span', displayKey(key), item); if (!row || row.reason) el('small', row?.reason || 'No longer available', item);
      const remove = button('Remove '+displayKey(key), item, () => { if (!current()) return; state.selected.delete(key); state.message = ''; paint(); });
      remove.setAttribute('data-study-key', key); remove.setAttribute('data-study-action', 'remove'); focusTargets.set('remove:'+key, remove);
    }
    if (rebuild && !state.selected.size) el('p', 'No techniques selected.', selected);
    previous.disabled = state.page === 0; next.disabled = state.page + 1 >= pages;
    const blocked = reason(rows); compare.disabled = state.busy || !!blocked;
    message.textContent = blocked || state.message || `${state.selected.size} selected. Choices already at full sharpness may have no change to compare.`;
    compare.textContent = state.busy ? 'Requesting comparison…' : 'Compare selected';
    if (focusKey && current()) (focusTargets.get(focusKind+':'+focusKey) || search).focus();
  }
  async function submit() {
    if (state.busy) return;
    const blocked = reason(available()); if (blocked) { state.message = blocked; paint(); return; }
    if (typeof app._gameStudyChanged !== 'function' || typeof app._requestGameplanStudy !== 'function') { state.message = 'Comparison service is unavailable.'; paint(); return; }
    try {
      if (state.mode === 'next-roll-current-conditions' && app.startFrom() === 'weak') {
        if (typeof app.flowScore !== 'function') throw new Error('Your weak-position choices are unavailable.');
        app.flowScore();
      }
      const rechecked = reason(available()); if (rechecked) { state.message = rechecked; paint(); return; }
      const declaration = { mode: state.mode, targets: { kind: 'sharp-refresh', deckKeys: [...state.selected] } };
      state.busy = true; state.message = 'Comparison requested. Your reviews stay in the same order.'; paint();
      app._gameplanStudyDeclaration = { mode: declaration.mode, targets: { kind: 'sharp-refresh', deckKeys: declaration.targets.deckKeys.slice() } };
      app._gameStudyChanged('declaration');
      const pending = app._requestGameplanStudy('suggestions');
      if (typeof state.onCompare === 'function') state.onCompare(declaration);
      await pending;
    } catch (_) { if (current()) state.message = 'Comparison could not be requested. Check availability and try again.'; }
    finally { state.busy = false; if (current()) paint(); }
  }
  scope.addEventListener('change', () => { if (!current()) return; state.mode = scope.value; state.message = ''; paint(); });
  search.addEventListener('input', () => { if (!current()) return; state.query = search.value; state.page = 0; paint(); });
  state.paint = paint; paint(); return box;
}
