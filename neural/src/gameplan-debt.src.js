// Eager memory evidence. This is the single review/debt implementation used by
// the host before the study planner loads and by the deferred planner itself.
function ngGameplanValidCell(c) {
  return Array.isArray(c) && c.length >= 3 && c.every(Number.isFinite);
}
export function ngGameplanReviewed(srs, day) {
  const seen = new Set();
  for (const cards of Object.values(srs || {})) {
    for (const [qh, c] of Object.entries(cards || {})) {
      if (ngGameplanValidCell(c) && c[2] === day) seen.add(qh);
    }
  }
  return [...seen];
}
export function ngGameplanDebt({ srs = {}, day, decks = {} }) {
  const all = new Set(), candidates = [];
  for (const [key, cards] of Object.entries(srs)) {
    const questions = [], dates = [];
    for (const [qh, c] of Object.entries(cards || {})) {
      if (ngGameplanValidCell(c) && c[0] <= day && c[2] < day) {
        all.add(qh);
        // A removed copy must not hide an available shared copy in another deck.
        if (decks[key] && decks[key].exact && !decks[key].questions.includes(qh)) continue;
        questions.push(qh); dates.push(c[0]);
      }
    }
    if (questions.length && Object.hasOwn(decks, key)) {
      candidates.push({ key, questions: questions.sort(), dueDay: Math.min(...dates) });
    }
  }
  candidates.sort((a, b) => a.dueDay - b.dueDay || b.questions.length - a.questions.length || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const covered = new Set(), rows = [];
  for (const r of candidates) {
    const questions = r.questions.filter((q) => !covered.has(q));
    if (!questions.length) continue;
    questions.forEach((q) => covered.add(q));
    rows.push({ ...r, questions, kind: "due", count: questions.length, pending: 0 });
  }
  return { rows, questions: [...all].sort(), count: all.size, blocked: [...all].filter((q) => !covered.has(q)) };
}
