// Pure exam-type logic: dates, daily plan, wrong-answer notebook, mock exam.
// No DOM, no storage. Dates are local calendar dates as "YYYY-MM-DD" strings;
// day arithmetic uses UTC day numbers so DST never shifts a day.

const p2 = (n) => String(n).padStart(2, '0');
const clone = (o) => JSON.parse(JSON.stringify(o));

/** "YYYY-MM-DD" -> { y, m, d } or null when not a real calendar date. */
export function parseISODate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof s === 'string' ? s : '');
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? { y, m: mo, d } : null;
}
/** Local calendar date of a Date as "YYYY-MM-DD". */
export const isoOf = (date) => `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}`;
const dayNum = (iso) => { const p = parseISODate(iso); return Date.UTC(p.y, p.m - 1, p.d) / 864e5; };
export function addDaysISO(iso, n) {
  const t = new Date((dayNum(iso) + n) * 864e5);
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
}
/** Whole calendar days from `fromIso` to `toIso` (negative when toIso is earlier). */
export const daysBetween = (fromIso, toIso) => dayNum(toIso) - dayNum(fromIso);

/** 'ok' | 'invalid' | 'past'. The exam may be today. */
export function validateExamDate(iso, todayIso) {
  if (!parseISODate(iso)) return 'invalid';
  return daysBetween(todayIso, iso) < 0 ? 'past' : 'ok';
}

// ---------------------------------------------------------------- diagnostics

const correct = (q, idx) => Number.isInteger(idx) && idx === q.answer;

/** Diagnostic score per chapter node: { [nodeId]: pct } (nodes without diagnostic questions are absent). */
export function chapterScores(pack, answers) {
  const acc = {};
  for (const q of pack.assessment.questions) {
    const a = (acc[q.node] ||= { c: 0, t: 0 });
    a.t += 1;
    if (correct(q, answers[q.id])) a.c += 1;
  }
  return Object.fromEntries(Object.entries(acc).map(([id, a]) => [id, Math.round((100 * a.c) / a.t)]));
}

/**
 * Weakness priority for ordering chapters: lower diagnostic score = higher
 * priority. Chapters without a diagnostic score count as 0% (unknown is
 * studied early).
 */
export const weakness = (scores, nodeId) => 100 - (scores[nodeId] ?? 0);

// ---------------------------------------------------------------- daily plan

/**
 * Daily plan rule (Required Behavior 13):
 * - study days run from today to the day before the exam;
 * - when >= 2 days remain, the last of them is reserved for the mock exam;
 * - chapters (already ordered weakest first) are spread over the remaining
 *   study days; more chapters than days -> several per day, as evenly as
 *   possible with the extra ones on the earliest days; fewer -> one per day
 *   from today, leaving later days free for review.
 * Returns { status: 'ok' | 'examDay' | 'past', from, exam, days: [{ date, nodes, mock }] }.
 */
export function dailyPlan(orderedNodeIds, todayIso, examIso) {
  const left = daysBetween(todayIso, examIso);
  if (left < 0) return { status: 'past', from: todayIso, exam: examIso, days: [] };
  if (left === 0) return { status: 'examDay', from: todayIso, exam: examIso, days: [] };
  const days = Array.from({ length: left }, (_, i) => ({ date: addDaysISO(todayIso, i), nodes: [], mock: false }));
  if (left >= 2) days[left - 1].mock = true;
  const k = left >= 2 ? left - 1 : left;
  const n = orderedNodeIds.length;
  if (n <= k) orderedNodeIds.forEach((id, i) => days[i].nodes.push(id));
  else {
    const base = Math.floor(n / k), extra = n % k;
    let at = 0;
    for (let i = 0; i < k; i++) {
      const take = base + (i < extra ? 1 : 0);
      days[i].nodes.push(...orderedNodeIds.slice(at, at + take));
      at += take;
    }
  }
  return { status: 'ok', from: todayIso, exam: examIso, days };
}

/**
 * Where the learner stands against a stored plan today.
 * behind: chapters scheduled before today that are still not mastered.
 */
export function planProgress(plan, isMasteredFn, todayIso) {
  if (!plan || !Array.isArray(plan.days)) return { behind: [], today: null, upcoming: [] };
  const behind = [];
  let today = null;
  const upcoming = [];
  for (const d of plan.days) {
    const diff = daysBetween(todayIso, d.date);
    if (diff < 0) behind.push(...d.nodes.filter((id) => !isMasteredFn(id)));
    else if (diff === 0) today = d;
    else upcoming.push(d);
  }
  return { behind, today, upcoming };
}

// ---------------------------------------------------------------- question index

/** Every question in an exam pack by id: { q, source: 'diagnostic'|'quiz'|'mock', chapter }. */
export function questionIndex(pack) {
  const m = new Map();
  for (const q of pack.assessment.questions) m.set(q.id, { q, source: 'diagnostic', chapter: q.node });
  for (const n of pack.nodes) for (const q of n.lesson.quiz) m.set(q.id, { q, source: 'quiz', chapter: n.id });
  for (const q of (pack.exam && pack.exam.mock ? pack.exam.mock.questions : [])) m.set(q.id, { q, source: 'mock', chapter: q.chapter });
  return m;
}

// ---------------------------------------------------------------- notebook

/** Add wrongly answered questions; each question is kept once (first source wins). */
export function addToNotebook(state, questionIds, source, now) {
  const fresh = questionIds.filter((id) => !(id in state.notebook));
  if (!fresh.length) return state;
  const n = clone(state);
  for (const id of fresh) n.notebook[id] = { source, addedAt: now };
  return n;
}

/** Redo a notebook question: a correct answer removes it. Returns { state, removed }. */
export function redoNotebook(state, questionId, wasCorrect) {
  if (!(questionId in state.notebook) || !wasCorrect) return { state, removed: false };
  const n = clone(state);
  delete n.notebook[questionId];
  return { state: n, removed: true };
}

/** Notebook entries that still exist in the pack, oldest first. */
export function notebookItems(pack, state) {
  const idx = questionIndex(pack);
  return Object.entries(state.notebook)
    .filter(([id]) => idx.has(id))
    .map(([id, e]) => ({ id, ...idx.get(id), source: e.source, addedAt: e.addedAt }))
    .sort((a, b) => a.addedAt - b.addedAt || (a.id < b.id ? -1 : 1));
}

// ---------------------------------------------------------------- mock exam

export const mockLimitMs = (pack) => pack.exam.mock.timeLimitMinutes * 60e3;

/** Start a new attempt (no-op while one is running). The timer is wall-clock: startedAt is stored. */
export function startMock(state, now) {
  if (state.mock.active) return state;
  const n = clone(state);
  n.mock.active = { startedAt: now, answers: {} };
  return n;
}

/** Record a mock answer. Refused once time is up (pass pack and now to enforce it). */
export function answerMock(state, questionId, optionIndex, pack = null, now = null) {
  if (!state.mock.active) return state;
  if (pack && Number.isFinite(now) && mockRemaining(pack, state, now) === 0) return state;
  const n = clone(state);
  n.mock.active.answers[questionId] = optionIndex;
  return n;
}

/**
 * Milliseconds left in the running attempt (0 when expired, null when none).
 * Never more than the time limit, even if the device clock moved backwards.
 */
export function mockRemaining(pack, state, now) {
  if (!state.mock.active) return null;
  const limit = mockLimitMs(pack);
  return Math.min(limit, Math.max(0, state.mock.active.startedAt + limit - now));
}

/**
 * Display order of a question's options for one attempt: a permutation of
 * original indexes seeded by the attempt (mock: its start time; assessment:
 * its seed) and the question id, so it is stable across re-renders and reloads
 * but differs between attempts. Answers are stored and graded by original index.
 */
export function seededOptionOrder(seed, questionId, n) {
  let h = 2166136261 ^ Math.floor(seed);
  for (const ch of String(questionId)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => { h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order;
}
export const mockOptionOrder = seededOptionOrder;

/** Total, per-chapter score and chapters below 60% ("revisit"). */
export function scoreMock(pack, answers) {
  const qs = pack.exam.mock.questions;
  const by = new Map(pack.nodes.map((n) => [n.id, { id: n.id, correct: 0, total: 0 }]));
  let c = 0;
  for (const q of qs) {
    const b = by.get(q.chapter);
    b.total += 1;
    if (correct(q, answers[q.id])) { b.correct += 1; c += 1; }
  }
  const byChapter = [...by.values()].filter((b) => b.total > 0).map((b) => ({ ...b, pct: Math.round((100 * b.correct) / b.total) }));
  return {
    correct: c, total: qs.length, pct: Math.round((100 * c) / qs.length),
    byChapter,
    revisit: byChapter.filter((b) => b.correct / b.total < 0.6).map((b) => b.id),
  };
}

/**
 * Submit the running attempt (by the learner or on time-out). Returns
 * { state, submitted, result }; submitted is true only for the call that
 * actually ends the attempt, so exactly one timeline entry is logged.
 * Wrong or unanswered questions go to the notebook.
 */
export function submitMock(pack, state, now) {
  const a = state.mock.active;
  if (!a) return { state, submitted: false, result: null };
  const result = scoreMock(pack, a.answers);
  const submittedAt = Math.min(now, a.startedAt + mockLimitMs(pack));
  let n = clone(state);
  n.mock.active = null;
  n.mock.history.push({ startedAt: a.startedAt, submittedAt, answers: a.answers, correct: result.correct, total: result.total });
  const wrong = pack.exam.mock.questions.filter((q) => !correct(q, a.answers[q.id])).map((q) => q.id);
  n = addToNotebook(n, wrong, 'mock', now);
  return { state: n, submitted: true, result };
}
