// Pure learning-loop logic shared by browser and Node (no DOM, no storage).
// Course packs are validated here; course progress is a plain JSON object
// ("CourseState") and every change goes through a transition function that
// returns a new state plus a flag saying whether something happened, so the
// UI can log timeline entries exactly once per event.

export const PACK_SCHEMA = 1;
/** Pack types this build can run. Release B adds 'exam' and 'role'. */
export const SUPPORTED_TYPES = ['topic'];
export const GOAL_LEVELS = [1, 2, 3];
export const WEEKLY_MIN = 1;
export const WEEKLY_MAX = 7;
export const SELF_RATING = { low: 1, mid: 2, high: 3 };

// ---------------------------------------------------------------- validation

const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isStrList = (v, min = 1) => Array.isArray(v) && v.length >= min && v.every(isStr);
const isId = (v) => typeof v === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(v);

function checkQuestion(q, where, errs, ids) {
  if (!q || typeof q !== 'object') { errs.push(`${where}: not an object`); return; }
  if (!isId(q.id)) errs.push(`${where}: bad id`);
  else if (ids.has(q.id)) errs.push(`${where}: duplicate question id ${q.id}`);
  else ids.add(q.id);
  if (!isStr(q.prompt)) errs.push(`${where}: missing prompt`);
  if (!isStrList(q.options, 2)) errs.push(`${where}: needs >= 2 non-empty options`);
  else if (new Set(q.options.map((o) => o.trim())).size !== q.options.length) errs.push(`${where}: duplicate options`);
  if (!Number.isInteger(q.answer) || !Array.isArray(q.options) || q.answer < 0 || q.answer >= q.options.length) {
    errs.push(`${where}: answer must be the index of exactly one option`);
  }
  if (!isStr(q.explanation)) errs.push(`${where}: missing explanation`);
}

/**
 * Validate a course pack. Returns { ok, errors }. Unknown extra fields are
 * ignored so later schema additions stay backward compatible.
 */
export function validatePack(pack) {
  const errs = [];
  if (!pack || typeof pack !== 'object') return { ok: false, errors: ['pack is not an object'] };
  if (pack.schema !== PACK_SCHEMA) errs.push(`schema must be ${PACK_SCHEMA}`);
  if (!isId(pack.id)) errs.push('bad pack id');
  if (!SUPPORTED_TYPES.includes(pack.type)) errs.push(`unsupported type ${JSON.stringify(pack.type)}`);
  if (!isStr(pack.title)) errs.push('missing title');
  if (!isStr(pack.summary)) errs.push('missing summary');

  const levels = pack.levels;
  if (!Array.isArray(levels) || levels.length !== 3 || !levels.every((l, i) => l && l.id === i + 1 && isStr(l.label) && isStr(l.desc))) {
    errs.push('levels must be 3 entries with id 1..3, label, desc');
  }

  const dimIds = new Set();
  if (!Array.isArray(pack.dimensions) || pack.dimensions.length < 1) errs.push('needs >= 1 dimension');
  else for (const d of pack.dimensions) {
    if (!d || !isId(d.id) || !isStr(d.label)) errs.push('dimension needs id and label');
    else if (dimIds.has(d.id)) errs.push(`duplicate dimension ${d.id}`);
    else dimIds.add(d.id);
  }

  const stageIds = new Set();
  if (!Array.isArray(pack.stages) || pack.stages.length < 1) errs.push('needs >= 1 stage');
  else for (const s of pack.stages) {
    if (!s || !isId(s.id) || !isStr(s.title)) errs.push('stage needs id and title');
    else if (stageIds.has(s.id)) errs.push(`duplicate stage ${s.id}`);
    else stageIds.add(s.id);
  }

  const qIds = new Set();
  const nodeLevel = new Map();
  if (!Array.isArray(pack.nodes) || pack.nodes.length < 1) errs.push('needs >= 1 node');
  else pack.nodes.forEach((n, i) => {
    const w = `node[${i}]${n && n.id ? ' ' + n.id : ''}`;
    if (!n || typeof n !== 'object') { errs.push(`${w}: not an object`); return; }
    if (!isId(n.id)) errs.push(`${w}: bad id`);
    else if (nodeLevel.has(n.id)) errs.push(`${w}: duplicate node id`);
    if (!isStr(n.title)) errs.push(`${w}: missing title`);
    if (!isStr(n.summary)) errs.push(`${w}: missing summary`);
    if (!stageIds.has(n.stage)) errs.push(`${w}: unknown stage ${n.stage}`);
    if (!GOAL_LEVELS.includes(n.level)) errs.push(`${w}: level must be 1..3`);
    if (!Array.isArray(n.dimensions) || n.dimensions.length < 1 || !n.dimensions.every((d) => dimIds.has(d))) errs.push(`${w}: dimensions must reference known dimensions`);
    const pre = n.prereqs ?? [];
    if (!Array.isArray(pre)) errs.push(`${w}: prereqs must be an array`);
    else for (const p of pre) {
      // Prereqs must appear earlier in the list: no cycles, and pack order is a valid study order.
      if (!nodeLevel.has(p)) errs.push(`${w}: prereq ${p} must be an earlier node`);
      else if (nodeLevel.get(p) > n.level) errs.push(`${w}: prereq ${p} has a higher level than the node`);
    }
    const L = n.lesson;
    if (!L || typeof L !== 'object') errs.push(`${w}: missing lesson`);
    else {
      if (!Array.isArray(L.sections) || L.sections.length < 1 || !L.sections.every((s) => s && isStr(s.heading) && isStrList(s.body))) errs.push(`${w}: lesson.sections need heading + body[]`);
      if (!isStrList(L.askQuestions)) errs.push(`${w}: lesson.askQuestions needs >= 1 string`);
      if (!L.task || !isStr(L.task.prompt) || !isStrList(L.task.criteria)) errs.push(`${w}: lesson.task needs prompt + criteria[]`);
      if (!L.reflection || !isStr(L.reflection.question) || !isStr(L.reflection.answer)) errs.push(`${w}: lesson.reflection needs question + answer`);
      if (!Array.isArray(L.quiz) || L.quiz.length < 1) errs.push(`${w}: lesson.quiz needs >= 1 question`);
      else L.quiz.forEach((q, j) => checkQuestion(q, `${w} quiz[${j}]`, errs, qIds));
    }
    if (isId(n.id) && !nodeLevel.has(n.id)) nodeLevel.set(n.id, GOAL_LEVELS.includes(n.level) ? n.level : 9);
  });

  const A = pack.assessment;
  if (!A || !Array.isArray(A.questions) || A.questions.length < 1) errs.push('assessment.questions needs >= 1 question');
  else A.questions.forEach((q, j) => {
    const w = `assessment[${j}]`;
    checkQuestion(q, w, errs, qIds);
    if (q && !nodeLevel.has(q.node)) errs.push(`${w}: unknown node ${q && q.node}`);
    if (q && !dimIds.has(q.dimension)) errs.push(`${w}: unknown dimension ${q && q.dimension}`);
  });

  return { ok: errs.length === 0, errors: errs };
}

// ---------------------------------------------------------------- course state

export function emptyCourseState(packType = 'topic') {
  return {
    packType,
    setup: null,                                  // { goalLevel, weeklyTarget }
    assessment: { answers: {}, completedAt: null }, // answers: { [questionId]: optionIndex }
    nodes: {},                                    // { [nodeId]: NodeState }
    currentOverride: null,                        // nodeId chosen by "prioritize stuck"
    completions: [],                              // [{ nodeId, at }] lesson-quiz masteries (weekly count)
  };
}

function emptyNodeState() {
  return { masteredAt: null, masteredBy: null, failedAttempts: 0, checks: [], step: 1, reflectionShown: false, selfRating: null };
}

const clampInt = (v, lo, hi, dflt) => (Number.isInteger(v) && v >= lo && v <= hi ? v : dflt);
const finiteOr = (v, d) => (Number.isFinite(v) ? v : d);

/** Coerce anything read from storage into a well-formed CourseState (never throws). */
export function normalizeCourseState(raw) {
  const s = emptyCourseState(raw && typeof raw.packType === 'string' ? raw.packType : 'topic');
  if (!raw || typeof raw !== 'object') return s;
  if (raw.setup && typeof raw.setup === 'object') {
    s.setup = {
      goalLevel: clampInt(raw.setup.goalLevel, 1, 3, 2),
      weeklyTarget: clampInt(raw.setup.weeklyTarget, WEEKLY_MIN, WEEKLY_MAX, 3),
    };
  }
  const a = raw.assessment;
  if (a && typeof a === 'object') {
    if (a.answers && typeof a.answers === 'object') {
      for (const [k, v] of Object.entries(a.answers)) if (Number.isInteger(v) && v >= 0) s.assessment.answers[k] = v;
    }
    s.assessment.completedAt = finiteOr(a.completedAt, null);
  }
  if (raw.nodes && typeof raw.nodes === 'object') {
    for (const [id, n] of Object.entries(raw.nodes)) {
      if (!n || typeof n !== 'object') continue;
      const e = emptyNodeState();
      e.masteredAt = finiteOr(n.masteredAt, null);
      e.masteredBy = e.masteredAt === null ? null : (n.masteredBy === 'assessment' ? 'assessment' : 'quiz');
      e.failedAttempts = clampInt(n.failedAttempts, 0, 1e6, 0);
      e.checks = Array.isArray(n.checks) ? n.checks.map(Boolean) : [];
      e.step = clampInt(n.step, 1, 1000, 1);
      e.reflectionShown = n.reflectionShown === true;
      e.selfRating = clampInt(n.selfRating, 1, 3, null);
      s.nodes[id] = e;
    }
  }
  s.currentOverride = typeof raw.currentOverride === 'string' ? raw.currentOverride : null;
  if (Array.isArray(raw.completions)) {
    s.completions = raw.completions.filter((c) => c && typeof c.nodeId === 'string' && Number.isFinite(c.at)).map((c) => ({ nodeId: c.nodeId, at: c.at }));
  }
  return s;
}

const clone = (o) => JSON.parse(JSON.stringify(o));
const nodeOf = (s, id) => s.nodes[id] || emptyNodeState();
const withNode = (s, id, patch) => { const n = clone(s); n.nodes[id] = { ...nodeOf(s, id), ...patch }; return n; };
export const isMastered = (s, id) => !!(s.nodes[id] && s.nodes[id].masteredAt !== null);

// ---------------------------------------------------------------- setup

export function applySetup(state, { goalLevel, weeklyTarget }) {
  const n = clone(state);
  n.setup = {
    goalLevel: clampInt(goalLevel, 1, 3, 2),
    weeklyTarget: clampInt(weeklyTarget, WEEKLY_MIN, WEEKLY_MAX, 3),
  };
  return n;
}

export function setWeeklyTarget(state, weeklyTarget) {
  if (!state.setup) return state;
  const n = clone(state);
  n.setup.weeklyTarget = clampInt(weeklyTarget, WEEKLY_MIN, WEEKLY_MAX, n.setup.weeklyTarget);
  return n;
}

// ---------------------------------------------------------------- assessment

export const isCorrect = (q, idx) => Number.isInteger(idx) && idx === q.answer;

/** Record an assessment answer. First answer per question wins (feedback is immediate). */
export function answerAssessment(state, questionId, optionIndex) {
  if (state.assessment.completedAt !== null || questionId in state.assessment.answers) return state;
  const n = clone(state);
  n.assessment.answers[questionId] = optionIndex;
  return n;
}

/** Nodes whose assessment questions were all answered correctly (nodes without questions never qualify). */
export function assessmentMasteredNodes(pack, answers) {
  const byNode = new Map();
  for (const q of pack.assessment.questions) {
    const ok = isCorrect(q, answers[q.id]);
    byNode.set(q.node, (byNode.get(q.node) ?? true) && ok);
  }
  return new Set([...byNode].filter(([, ok]) => ok).map(([id]) => id));
}

/** Per-dimension assessment score. */
export function dimensionScores(pack, answers) {
  return pack.dimensions.map((d) => {
    const qs = pack.assessment.questions.filter((q) => q.dimension === d.id);
    const correct = qs.filter((q) => isCorrect(q, answers[q.id])).length;
    return { id: d.id, label: d.label, correct, total: qs.length, pct: qs.length ? Math.round((100 * correct) / qs.length) : null };
  });
}

/**
 * Finish the assessment. Returns { state, completed } where completed is true
 * only the first time (the caller logs one timeline entry for it).
 * Unanswered questions count as wrong.
 */
export function completeAssessment(pack, state, now) {
  if (state.assessment.completedAt !== null) return { state, completed: false };
  const n = clone(state);
  n.assessment.completedAt = now;
  for (const id of assessmentMasteredNodes(pack, n.assessment.answers)) {
    if (!isMastered(n, id)) n.nodes[id] = { ...nodeOf(n, id), masteredAt: now, masteredBy: 'assessment' };
  }
  return { state: n, completed: true };
}

/**
 * Retake: clears answers and assessment-derived mastery. Quiz-earned mastery,
 * attempts, ratings and the completion history are kept.
 */
export function resetAssessment(state) {
  const n = clone(state);
  n.assessment = { answers: {}, completedAt: null };
  for (const [id, ns] of Object.entries(n.nodes)) {
    if (ns.masteredBy === 'assessment') n.nodes[id] = { ...ns, masteredAt: null, masteredBy: null };
  }
  n.currentOverride = null;
  return n;
}

// ---------------------------------------------------------------- path

export const isOptional = (node, goalLevel) => node.level > goalLevel;
export const prereqsMet = (node, mastered) => (node.prereqs ?? []).every((p) => mastered.has(p));

/**
 * Status rule (Required Behavior 4):
 *  - mastered: the node is mastered (via assessment or lesson quiz);
 *  - current: the first non-mastered node in pack order whose prerequisites are
 *    all mastered. Required (non-optional) nodes are preferred; optional nodes
 *    become current only when no required node is eligible. A valid
 *    "prioritize stuck" override takes precedence;
 *  - todo: everything else.
 *
 * Returns { items: [{ node, status, optional, eligible }], currentId }.
 */
export function computePath(pack, state) {
  const goal = state.setup ? state.setup.goalLevel : 3;
  const mastered = new Set(pack.nodes.filter((n) => isMastered(state, n.id)).map((n) => n.id));
  const eligible = (n) => !mastered.has(n.id) && prereqsMet(n, mastered);
  let current = null;
  const ov = state.currentOverride && pack.nodes.find((n) => n.id === state.currentOverride);
  if (ov && eligible(ov)) current = ov.id;
  if (!current) current = (pack.nodes.find((n) => eligible(n) && !isOptional(n, goal)) || pack.nodes.find(eligible) || {}).id ?? null;
  const items = pack.nodes.map((node) => ({
    node,
    status: mastered.has(node.id) ? 'mastered' : node.id === current ? 'current' : 'todo',
    optional: isOptional(node, goal),
    eligible: eligible(node),
  }));
  return { items, currentId: current };
}

/** Path items grouped by stage, stage order as in the pack. */
export function groupByStage(pack, items) {
  return pack.stages.map((stage) => ({ stage, items: items.filter((it) => it.node.stage === stage.id) }));
}

export function missingPrereqs(pack, state, node) {
  return (node.prereqs ?? []).filter((p) => !isMastered(state, p)).map((p) => pack.nodes.find((n) => n.id === p)).filter(Boolean);
}

// ---------------------------------------------------------------- lesson

export function setLessonStep(state, nodeId, step) {
  const cur = nodeOf(state, nodeId).step;
  return step > cur ? withNode(state, nodeId, { step }) : state;
}

export function toggleCheck(state, nodeId, index, checked) {
  const checks = nodeOf(state, nodeId).checks.slice();
  while (checks.length <= index) checks.push(false);
  checks[index] = !!checked;
  return withNode(state, nodeId, { checks });
}

export function revealReflection(state, nodeId) {
  return nodeOf(state, nodeId).reflectionShown ? state : withNode(state, nodeId, { reflectionShown: true });
}

export function rateReflection(state, nodeId, rating) {
  return withNode(state, nodeId, { selfRating: clampInt(rating, 1, 3, null) });
}

/**
 * Display order for a question's options on a retry: a permutation of
 * 0..n-1 (original option indexes), never the identity when n > 1. Answers are
 * always recorded as original indexes, so grading does not depend on position.
 */
export function shuffleOrder(n, rand = Math.random) {
  const order = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return order;
  for (let tries = 0; tries < 20; tries++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.some((v, i) => v !== i)) return order;
  }
  // Degenerate random source: rotate by one so the order still changes.
  return order.map((_, i) => (i + 1) % n);
}

/** Grade a quiz: answers is an array of ORIGINAL option indexes aligned with quiz. */
export function gradeQuiz(quiz, answers) {
  const results = quiz.map((q, i) => ({ id: q.id, chosen: answers[i], correct: isCorrect(q, answers[i]) }));
  const correct = results.filter((r) => r.correct).length;
  return { results, correct, total: quiz.length, passed: correct === quiz.length };
}

/**
 * Submit a lesson quiz. Pass (all correct) masters the node; the result's
 * newlyMastered is true only when the node was not mastered before (the caller
 * logs one timeline entry). A fail increments failedAttempts unless the node is
 * already mastered (reviewing does not make a node "stuck").
 */
export function submitQuiz(pack, state, nodeId, answers, now) {
  const node = pack.nodes.find((n) => n.id === nodeId);
  if (!node) return { state, grade: null, newlyMastered: false };
  const grade = gradeQuiz(node.lesson.quiz, answers);
  const was = isMastered(state, nodeId);
  if (grade.passed) {
    if (was) return { state, grade, newlyMastered: false };
    const n = withNode(state, nodeId, { masteredAt: now, masteredBy: 'quiz' });
    n.completions.push({ nodeId, at: now });
    if (n.currentOverride === nodeId) n.currentOverride = null;
    return { state: n, grade, newlyMastered: true };
  }
  if (was) return { state, grade, newlyMastered: false };
  return { state: withNode(state, nodeId, { failedAttempts: nodeOf(state, nodeId).failedAttempts + 1 }), grade, newlyMastered: false };
}

// ---------------------------------------------------------------- progress

/** Monday 00:00 local of the week containing `date` (calendar arithmetic, DST-safe). */
export function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const back = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
}

/** [start, end) of the Monday–Sunday local week containing `date`. */
export function weekInterval(date) {
  const start = startOfWeek(date);
  return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) };
}

/** Distinct nodes mastered via lesson quiz within the current week. */
export function masteredThisWeek(state, now) {
  const { start, end } = weekInterval(now);
  const ids = new Set(state.completions.filter((c) => c.at >= start.getTime() && c.at < end.getTime()).map((c) => c.nodeId));
  return ids.size;
}

/** Current mastery per dimension (mastered nodes / nodes tagged with it) plus the assessment score. */
export function dimensionProgress(pack, state) {
  const base = dimensionScores(pack, state.assessment.answers);
  return pack.dimensions.map((d, i) => {
    const nodes = pack.nodes.filter((n) => n.dimensions.includes(d.id));
    const m = nodes.filter((n) => isMastered(state, n.id)).length;
    return {
      id: d.id, label: d.label, mastered: m, total: nodes.length,
      pct: nodes.length ? Math.round((100 * m) / nodes.length) : 0,
      baselinePct: state.assessment.completedAt !== null ? base[i].pct : null,
    };
  });
}

/** Stuck: not mastered and (>= 1 failed quiz attempt or self-rated low). Pack order. */
export function stuckNodes(pack, state) {
  return pack.nodes
    .filter((n) => !isMastered(state, n.id))
    .map((n) => ({ node: n, failedAttempts: nodeOf(state, n.id).failedAttempts, lowRating: nodeOf(state, n.id).selfRating === SELF_RATING.low }))
    .filter((x) => x.failedAttempts >= 1 || x.lowRating);
}

/**
 * "Prioritize stuck nodes": make the first stuck node whose prerequisites are
 * met the current node. Returns { state, nodeId } (nodeId null when none qualifies).
 */
export function prioritizeStuck(pack, state) {
  const mastered = new Set(pack.nodes.filter((n) => isMastered(state, n.id)).map((n) => n.id));
  const pick = stuckNodes(pack, state).find((x) => prereqsMet(x.node, mastered));
  if (!pick) return { state, nodeId: null };
  const n = clone(state);
  n.currentOverride = pick.node.id;
  return { state: n, nodeId: pick.node.id };
}

/** Summary used by the course card and the mascot. */
export function courseSummary(pack, state, now) {
  const total = pack.nodes.length;
  const mastered = pack.nodes.filter((n) => isMastered(state, n.id)).length;
  const goal = state.setup ? state.setup.goalLevel : 3;
  const required = pack.nodes.filter((n) => !isOptional(n, goal));
  return {
    phase: !state.setup ? 'setup' : state.assessment.completedAt === null ? 'assessment' : 'learning',
    total, mastered,
    requiredDone: required.every((n) => isMastered(state, n.id)),
    allDone: mastered === total,
    week: masteredThisWeek(state, now),
    weeklyTarget: state.setup ? state.setup.weeklyTarget : null,
    stuck: stuckNodes(pack, state).length,
  };
}

/** Mascot line key for the Learn home, by priority. */
export function mascotKey(summary) {
  if (!summary || summary.phase === 'setup') return 'lnBunnyStart';
  if (summary.phase === 'assessment') return 'lnBunnyAssess';
  if (summary.allDone || summary.requiredDone) return 'lnBunnyAllDone';
  if (summary.weeklyTarget && summary.week >= summary.weeklyTarget) return 'lnBunnyWeekDone';
  if (summary.stuck > 0) return 'lnBunnyStuck';
  if (summary.week > 0) return 'lnBunnyGoing';
  return 'lnBunnyToday';
}
