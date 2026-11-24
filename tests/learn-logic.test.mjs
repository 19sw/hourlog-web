import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePack, emptyCourseState, normalizeCourseState, applySetup, setWeeklyTarget,
  answerAssessment, completeAssessment, resetAssessment, assessmentMasteredNodes, dimensionScores,
  computePath, groupByStage, missingPrereqs, submitQuiz, gradeQuiz, toggleCheck, rateReflection,
  revealReflection, setLessonStep, startOfWeek, weekInterval, masteredThisWeek, dimensionProgress,
  stuckNodes, prioritizeStuck, courseSummary, mascotKey, isMastered, shuffleOrder, isBodyItem, parseResult,
} from '../js/learn-logic.js';

// ---- a small synthetic pack -------------------------------------------------
const q = (id, answer = 0, extra = {}) => ({ id, prompt: 'p ' + id, options: ['a', 'b', 'c'], answer, explanation: 'because', ...extra });
const lesson = (id) => ({
  sections: [{ heading: 'h', body: ['b'] }],
  askQuestions: ['ask?'],
  task: { prompt: 'do', criteria: ['c1', 'c2'] },
  reflection: { question: 'why?', answer: 'because' },
  quiz: [q(id + '-q1', 0), q(id + '-q2', 1)],
});
const node = (id, stage, level, prereqs = [], dims = ['d1']) => ({ id, stage, title: 'T ' + id, summary: 's', level, dimensions: dims, prereqs, lesson: lesson(id) });

function makePack() {
  return {
    schema: 1, id: 'demo', type: 'topic', title: 'Demo', summary: 'sum',
    levels: [{ id: 1, label: 'L1', desc: 'x' }, { id: 2, label: 'L2', desc: 'x' }, { id: 3, label: 'L3', desc: 'x' }],
    dimensions: [{ id: 'd1', label: 'D1' }, { id: 'd2', label: 'D2' }],
    stages: [{ id: 's1', title: 'S1' }, { id: 's2', title: 'S2' }],
    nodes: [
      node('a', 's1', 1),
      node('b', 's1', 1, ['a'], ['d2']),
      node('c', 's1', 3, ['a']),       // advanced, appears before required d
      node('d', 's2', 2, ['b']),
      node('e', 's2', 1),              // no assessment question
    ],
    assessment: {
      questions: [
        { ...q('qa1', 0), node: 'a', dimension: 'd1' },
        { ...q('qa2', 1), node: 'a', dimension: 'd1' },
        { ...q('qb1', 2), node: 'b', dimension: 'd2' },
        { ...q('qd1', 0), node: 'd', dimension: 'd1' },
      ],
    },
  };
}
const setup = (goalLevel = 2, weeklyTarget = 3) => applySetup(emptyCourseState(), { goalLevel, weeklyTarget });
const statuses = (pack, s) => Object.fromEntries(computePath(pack, s).items.map((i) => [i.node.id, i.status]));
const answerAll = (pack, s, map) => { for (const [k, v] of Object.entries(map)) s = answerAssessment(s, k, v); return completeAssessment(pack, s, 1000).state; };

// ---- validation ---------------------------------------------------------------
test('validator accepts a well-formed pack', () => {
  assert.deepEqual(validatePack(makePack()), { ok: true, errors: [] });
});

test('validator rejects missing fields, bad references and bad answers', () => {
  const cases = [
    (p) => { delete p.title; },
    (p) => { p.type = 'exam'; },                       // not runnable in Release A
    (p) => { p.schema = 2; },
    (p) => { p.levels.pop(); },
    (p) => { p.nodes[1].prereqs = ['zzz']; },          // dangling prereq
    (p) => { p.nodes[0].prereqs = ['b']; },            // forward reference / cycle
    (p) => { p.nodes[0].prereqs = ['a']; },            // self reference
    (p) => { p.nodes[3].prereqs = ['c']; },            // required node depends on a higher-level node
    (p) => { p.nodes[0].stage = 'nope'; },
    (p) => { p.nodes[0].dimensions = ['nope']; },
    (p) => { p.nodes[1].id = 'a'; },                   // duplicate node id
    (p) => { p.nodes[0].lesson.quiz[0].answer = 3; },   // out of range
    (p) => { p.nodes[0].lesson.quiz[0].answer = '0'; }, // not an integer
    (p) => { p.nodes[0].lesson.quiz[0].options = ['a', 'a', 'c']; },
    (p) => { delete p.nodes[0].lesson.quiz[0].explanation; },
    (p) => { p.nodes[0].lesson.quiz[1].id = 'a-q1'; }, // duplicate question id
    (p) => { p.nodes[0].lesson.task.criteria = []; },
    (p) => { delete p.nodes[0].lesson.reflection; },
    (p) => { p.nodes[0].lesson.sections = [{ heading: 'h', body: [''] }]; },
    (p) => { p.assessment.questions[0].node = 'zzz'; },
    (p) => { p.assessment.questions[0].dimension = 'zzz'; },
    (p) => { p.assessment.questions = []; },
  ];
  for (const [i, mutate] of cases.entries()) {
    const p = makePack(); mutate(p);
    const r = validatePack(p);
    assert.equal(r.ok, false, `case ${i} should be rejected`);
    assert.ok(r.errors.length > 0);
  }
  assert.equal(validatePack(null).ok, false);
  assert.equal(validatePack('x').ok, false);
});

test('code blocks: body items may be { code, result?, lang? } and questions may carry code', () => {
  const p = makePack();
  p.nodes[0].lesson.sections = [{ heading: 'h', body: [
    'text',
    { code: 'SELECT 1;' },
    { code: 'SELECT a, b FROM t;', result: 'a\tb\n1\t2\n3\tNULL' },
    { code: 'SELECT a FROM t WHERE 1 = 0;', result: 'a' },   // header only = no rows
    { code: 'brew install mysql', lang: 'shell' },
    { code: 'SELECT 2;', lang: 'sql', result: 'x\n' },     // a row with one empty cell
  ] }];
  p.nodes[0].lesson.quiz[0].code = 'SELECT * FROM t;';
  p.assessment.questions[0].code = 'SELECT 1;';
  assert.deepEqual(validatePack(p), { ok: true, errors: [] });
  assert.deepEqual(parseResult('a\tb\n1\t2'), { head: ['a', 'b'], rows: [['1', '2']] });
  assert.deepEqual(parseResult('a'), { head: ['a'], rows: [] });
});

test('code blocks: malformed body items and question code are rejected', () => {
  const badItems = [
    { code: '' }, { code: '   ' }, { code: 5 }, { text: 'x' }, {}, null, [], ['SELECT 1;'], 7,
    { code: 'x', extra: 1 },                        // unknown key (typo guard)
    { code: 'x', result: 'a\tb\n1' },              // ragged result
    { code: 'x', result: '' },                       // empty result
    { code: 'x', result: '\tb\n1\t2' },            // empty header cell
    { code: 'x', result: 3 },
    { code: 'x', lang: 'python' },
    { code: 'ls', lang: 'shell', result: 'a\n1' },   // shell commands have no query result
  ];
  for (const [i, item] of badItems.entries()) {
    assert.equal(isBodyItem(item), false, `item ${i}`);
    const p = makePack();
    p.nodes[0].lesson.sections = [{ heading: 'h', body: ['ok', item] }];
    assert.equal(validatePack(p).ok, false, `item ${i} rejected by validatePack`);
  }
  for (const code of ['', '  ', 5, null, ['x']]) {
    const p = makePack(); p.nodes[0].lesson.quiz[0].code = code;
    assert.equal(validatePack(p).ok, false, `quiz code ${JSON.stringify(code)}`);
    const a = makePack(); a.assessment.questions[0].code = code;
    assert.equal(validatePack(a).ok, false, `assessment code ${JSON.stringify(code)}`);
  }
});

test('code blocks: exam key points accept code items too; plain-string bodies are unchanged', async () => {
  assert.equal(isBodyItem('paragraph'), true);
  assert.equal(isBodyItem(''), false);
  const { default: exam } = await import('../courses/micro-econ-final.js');
  const p = structuredClone(exam);
  p.nodes[0].lesson.keyPoints[0].body.push({ code: 'SELECT 1;', result: 'x\n1' });
  assert.deepEqual(validatePack(p), { ok: true, errors: [] });
  p.nodes[0].lesson.keyPoints[0].body.push({ code: '' });
  assert.equal(validatePack(p).ok, false);
});

// ---- path rule (Required Behavior 4) -------------------------------------------
test('before assessment: first eligible required node is current, rest todo', () => {
  const p = makePack();
  assert.deepEqual(statuses(p, setup(2)), { a: 'current', b: 'todo', c: 'todo', d: 'todo', e: 'todo' });
});

test('mastered only when ALL of a node\'s assessment questions are correct', () => {
  const p = makePack();
  // a: one of two wrong -> not mastered. b: correct -> mastered. d: correct -> mastered.
  const s = answerAll(p, setup(2), { qa1: 0, qa2: 0, qb1: 2, qd1: 0 });
  const st = statuses(p, s);
  assert.equal(st.a, 'current');
  assert.equal(st.b, 'mastered');
  assert.equal(st.d, 'mastered');
  assert.equal(st.e, 'todo');
  assert.deepEqual([...assessmentMasteredNodes(p, s.assessment.answers)].sort(), ['b', 'd']);
});

test('nodes without assessment questions are never auto-mastered, even with a perfect score', () => {
  const p = makePack();
  const s = answerAll(p, setup(2), { qa1: 0, qa2: 1, qb1: 2, qd1: 0 });
  const st = statuses(p, s);
  assert.deepEqual(st, { a: 'mastered', b: 'mastered', c: 'todo', d: 'mastered', e: 'current' });
});

test('unanswered assessment questions count as wrong', () => {
  const p = makePack();
  const s = answerAll(p, setup(2), { qa1: 0 }); // qa2 unanswered
  assert.equal(isMastered(s, 'a'), false);
});

test('prerequisites gate current; current is the first eligible node in order', () => {
  const p = makePack();
  // a mastered, b not: b's prereq met -> b current (d needs b).
  const s = answerAll(p, setup(2), { qa1: 0, qa2: 1, qb1: 0, qd1: 1 });
  const path = computePath(p, s);
  assert.equal(path.currentId, 'b');
  assert.equal(path.items.find((i) => i.node.id === 'd').eligible, false);
});

test('mastery out of prerequisite order is kept; the missing prereq becomes current', () => {
  const p = makePack();
  // b mastered by assessment but its prereq a is not.
  const s = answerAll(p, setup(2), { qa1: 1, qa2: 1, qb1: 2, qd1: 1 });
  const st = statuses(p, s);
  assert.equal(st.b, 'mastered');
  assert.equal(st.a, 'current');
  assert.deepEqual(missingPrereqs(p, s, p.nodes[3]).map((n) => n.id), []); // d's prereq b is mastered
});

test('optional flag = node level above goal level; required nodes are preferred for current', () => {
  const p = makePack();
  const s = answerAll(p, setup(1), { qa1: 0, qa2: 1, qb1: 2, qd1: 1 });
  const path = computePath(p, s);
  const opt = Object.fromEntries(path.items.map((i) => [i.node.id, i.optional]));
  assert.deepEqual(opt, { a: false, b: false, c: true, d: true, e: false });
  // c (optional, eligible) and d (optional, eligible) come before e in order, but e is required.
  assert.equal(path.currentId, 'e');
  // With goal 3 nothing is optional and the first eligible node in order wins.
  const s3 = applySetup(s, { goalLevel: 3, weeklyTarget: 3 });
  assert.equal(computePath(p, s3).currentId, 'c');
  assert.ok(computePath(p, s3).items.every((i) => !i.optional));
});

test('optional nodes become current once every required node is mastered', () => {
  const p = makePack();
  let s = answerAll(p, setup(1), { qa1: 0, qa2: 1, qb1: 2, qd1: 1 });
  s = submitQuiz(p, s, 'e', [0, 1], 2000).state;
  assert.equal(computePath(p, s).currentId, 'c');
});

test('all mastered: no current node', () => {
  const p = makePack();
  let s = answerAll(p, setup(3), { qa1: 0, qa2: 1, qb1: 2, qd1: 0 });
  for (const id of ['c', 'e']) s = submitQuiz(p, s, id, [0, 1], 3000).state;
  const path = computePath(p, s);
  assert.equal(path.currentId, null);
  assert.ok(path.items.every((i) => i.status === 'mastered'));
  assert.equal(courseSummary(p, s, new Date(3000)).allDone, true);
});

test('groupByStage keeps stage and node order', () => {
  const p = makePack();
  const g = groupByStage(p, computePath(p, setup()).items);
  assert.deepEqual(g.map((x) => [x.stage.id, x.items.map((i) => i.node.id)]), [['s1', ['a', 'b', 'c']], ['s2', ['d', 'e']]]);
});

// ---- assessment ---------------------------------------------------------------
test('assessment: first answer wins, completion happens once', () => {
  const p = makePack();
  let s = setup();
  s = answerAssessment(s, 'qa1', 2);
  s = answerAssessment(s, 'qa1', 0); // ignored
  assert.equal(s.assessment.answers.qa1, 2);
  const r1 = completeAssessment(p, s, 500);
  assert.equal(r1.completed, true);
  const r2 = completeAssessment(p, r1.state, 900);
  assert.equal(r2.completed, false);
  assert.equal(r2.state.assessment.completedAt, 500);
  assert.equal(answerAssessment(r1.state, 'qa2', 1), r1.state); // locked after completion
});

test('dimension scores', () => {
  const p = makePack();
  const d = dimensionScores(p, { qa1: 0, qa2: 0, qb1: 2, qd1: 0 });
  assert.deepEqual(d.map((x) => [x.id, x.correct, x.total, x.pct]), [['d1', 2, 3, 67], ['d2', 1, 1, 100]]);
});

test('retake clears assessment mastery but keeps quiz mastery and history', () => {
  const p = makePack();
  let s = answerAll(p, setup(2), { qa1: 0, qa2: 1, qb1: 2, qd1: 1 }); // a, b mastered by assessment
  s = submitQuiz(p, s, 'd', [0, 1], 2000).state;                        // d mastered by quiz
  s = rateReflection(s, 'e', 1);
  s = resetAssessment(s);
  assert.equal(s.assessment.completedAt, null);
  assert.deepEqual(s.assessment.answers, {});
  assert.equal(isMastered(s, 'a'), false);
  assert.equal(isMastered(s, 'b'), false);
  assert.equal(isMastered(s, 'd'), true);
  assert.equal(s.completions.length, 1);
  assert.equal(s.nodes.e.selfRating, 1);
  assert.ok(s.setup);
});

// ---- lesson / quiz ------------------------------------------------------------
test('quiz pass masters the node once and advances current', () => {
  const p = makePack();
  let s = setup(2);
  const r = submitQuiz(p, s, 'a', [0, 1], 1234);
  assert.equal(r.grade.passed, true);
  assert.equal(r.newlyMastered, true);
  s = r.state;
  assert.equal(s.nodes.a.masteredBy, 'quiz');
  assert.equal(computePath(p, s).currentId, 'b');
  const again = submitQuiz(p, s, 'a', [0, 1], 5678); // review pass
  assert.equal(again.newlyMastered, false);
  assert.equal(again.state.completions.length, 1);
  assert.equal(again.state.nodes.a.masteredAt, 1234);
});

test('quiz fail reports wrong questions and counts attempts; not after mastery', () => {
  const p = makePack();
  let s = setup(2);
  const r = submitQuiz(p, s, 'a', [0, 0], 10);
  assert.equal(r.grade.passed, false);
  assert.deepEqual(r.grade.results.map((x) => x.correct), [true, false]);
  assert.equal(r.newlyMastered, false);
  s = submitQuiz(p, r.state, 'a', [2], 20).state; // missing answer -> wrong
  assert.equal(s.nodes.a.failedAttempts, 2);
  s = submitQuiz(p, s, 'a', [0, 1], 30).state;
  assert.equal(s.nodes.a.failedAttempts, 2);
  assert.equal(submitQuiz(p, s, 'a', [1, 1], 40).state.nodes.a.failedAttempts, 2);
  assert.equal(submitQuiz(p, s, 'zzz', [0], 1).grade, null);
  assert.equal(gradeQuiz(p.nodes[0].lesson.quiz, []).passed, false);
});

test('lesson micro-state: steps only advance, checks, reflection', () => {
  let s = setup();
  s = setLessonStep(s, 'a', 3);
  assert.equal(setLessonStep(s, 'a', 2), s);
  assert.equal(s.nodes.a.step, 3);
  s = toggleCheck(s, 'a', 2, true);
  assert.deepEqual(s.nodes.a.checks, [false, false, true]);
  s = toggleCheck(s, 'a', 2, false);
  assert.deepEqual(s.nodes.a.checks, [false, false, false]);
  s = revealReflection(s, 'a');
  assert.equal(revealReflection(s, 'a'), s);
  assert.equal(rateReflection(s, 'a', 9).nodes.a.selfRating, null);
});

// ---- week math ------------------------------------------------------------------
const L = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);

test('week is Monday 00:00 to next Monday 00:00 local', () => {
  // 2026-11-22 is a Sunday; 2026-11-16 a Monday.
  assert.deepEqual(startOfWeek(L(2026, 11, 22, 23, 59)), L(2026, 11, 16));
  assert.deepEqual(startOfWeek(L(2026, 11, 16, 0, 0)), L(2026, 11, 16));
  assert.deepEqual(startOfWeek(L(2026, 11, 23, 0, 0)), L(2026, 11, 23));
  // Across month and year boundaries.
  assert.deepEqual(startOfWeek(L(2027, 1, 1, 12)), L(2026, 12, 28));
  const { start, end } = weekInterval(L(2026, 3, 4));
  assert.deepEqual([start, end], [L(2026, 3, 2), L(2026, 3, 9)]);
});

test('mastered-this-week counts distinct quiz completions inside the week only', () => {
  const s = setup();
  s.completions = [
    { nodeId: 'a', at: L(2026, 11, 15, 23, 59).getTime() }, // Sunday before: excluded
    { nodeId: 'b', at: L(2026, 11, 16, 0, 0).getTime() },   // Monday 00:00: included
    { nodeId: 'c', at: L(2026, 11, 22, 23, 59).getTime() }, // Sunday night: included
    { nodeId: 'c', at: L(2026, 11, 20).getTime() },         // duplicate node
    { nodeId: 'd', at: L(2026, 11, 23, 0, 0).getTime() },   // next Monday: excluded
  ];
  assert.equal(masteredThisWeek(s, L(2026, 11, 18, 9)), 2);
  assert.equal(masteredThisWeek(s, L(2026, 11, 23, 0, 1)), 1);
});

// ---- progress / stuck / adjust ----------------------------------------------------
test('dimension progress uses mastered nodes and keeps the baseline score', () => {
  const p = makePack();
  let s = answerAll(p, setup(2), { qa1: 0, qa2: 1, qb1: 0, qd1: 1 });
  const d = dimensionProgress(p, s);
  // d1 nodes: a, c, d, e -> only a mastered.
  assert.deepEqual(d.map((x) => [x.id, x.mastered, x.total, x.pct, x.baselinePct]), [['d1', 1, 4, 25, 67], ['d2', 0, 1, 0, 0]]);
  assert.equal(dimensionProgress(p, setup())[0].baselinePct, null);
});

test('stuck = not mastered and (failed attempt or low self-rating)', () => {
  const p = makePack();
  let s = setup(2);
  s = submitQuiz(p, s, 'b', [0, 0], 1).state;  // fail b
  s = rateReflection(s, 'e', 1);              // low on e
  s = rateReflection(s, 'd', 2);              // mid on d: not stuck
  assert.deepEqual(stuckNodes(p, s).map((x) => x.node.id), ['b', 'e']);
  s = submitQuiz(p, s, 'e', [0, 1], 2).state; // mastering removes it
  assert.deepEqual(stuckNodes(p, s).map((x) => x.node.id), ['b']);
});

test('prioritize stuck picks the first stuck node with met prerequisites and persists until mastered', () => {
  const p = makePack();
  let s = setup(2);
  s = submitQuiz(p, s, 'b', [0, 0], 1).state; // b stuck but prereq a not mastered
  s = rateReflection(s, 'e', 1);              // e stuck, no prereqs
  let r = prioritizeStuck(p, s);
  assert.equal(r.nodeId, 'e');
  s = r.state;
  assert.equal(computePath(p, s).currentId, 'e');
  // survives a storage round trip
  s = normalizeCourseState(JSON.parse(JSON.stringify(s)));
  assert.equal(computePath(p, s).currentId, 'e');
  // mastering the override clears it and the default rule applies again
  s = submitQuiz(p, s, 'e', [0, 1], 5).state;
  assert.equal(s.currentOverride, null);
  assert.equal(computePath(p, s).currentId, 'a');
  // nothing eligible
  assert.equal(prioritizeStuck(p, setup()).nodeId, null);
});

test('override is ignored when it is no longer eligible', () => {
  const p = makePack();
  const s = { ...setup(2), currentOverride: 'd' }; // d's prereq b not mastered
  assert.equal(computePath(p, s).currentId, 'a');
});

test('weekly target is clamped to 1..7', () => {
  assert.equal(setWeeklyTarget(setup(2, 3), 9).setup.weeklyTarget, 3);
  assert.equal(setWeeklyTarget(setup(2, 3), 7).setup.weeklyTarget, 7);
  assert.equal(setWeeklyTarget(setup(2, 3), 0).setup.weeklyTarget, 3);
  assert.equal(applySetup(emptyCourseState(), { goalLevel: 5, weeklyTarget: 2 }).setup.goalLevel, 2);
});

test('normalizeCourseState repairs junk without throwing', () => {
  const s = normalizeCourseState({ setup: { goalLevel: 'x', weeklyTarget: 99 }, assessment: { answers: { a: -1, b: 2 }, completedAt: 'no' }, nodes: { a: null, b: { masteredAt: 5, failedAttempts: -3, checks: 'x' } }, completions: [null, { nodeId: 'b', at: 5 }] });
  assert.deepEqual(s.setup, { goalLevel: 2, weeklyTarget: 3, examDate: null });
  assert.deepEqual(s.assessment, { answers: { b: 2 }, completedAt: null, selfRatings: {}, seed: null });
  assert.equal(s.nodes.a, undefined);
  assert.equal(s.nodes.b.masteredBy, 'quiz');
  assert.equal(s.nodes.b.failedAttempts, 0);
  assert.deepEqual(s.completions, [{ nodeId: 'b', at: 5 }]);
  assert.deepEqual(normalizeCourseState(null), emptyCourseState());
});

test('mascot line follows the course phase', () => {
  const p = makePack();
  const now = new Date(5000);
  assert.equal(mascotKey(null), 'lnBunnyStart');
  assert.equal(mascotKey(courseSummary(p, emptyCourseState(), now)), 'lnBunnyStart');
  assert.equal(mascotKey(courseSummary(p, setup(), now)), 'lnBunnyAssess');
  const s = answerAll(p, setup(2, 1), {});
  assert.equal(mascotKey(courseSummary(p, s, now)), 'lnBunnyToday');
  const s2 = submitQuiz(p, s, 'a', [0, 1], 5000).state;
  assert.equal(mascotKey(courseSummary(p, s2, now)), 'lnBunnyWeekDone');
  const s3 = submitQuiz(p, s, 'a', [1, 1], 5000).state;
  assert.equal(mascotKey(courseSummary(p, s3, now)), 'lnBunnyStuck');
});

test('shuffleOrder: a non-identity permutation; grading uses original indexes, not positions', () => {
  for (const n of [2, 3, 4, 5]) {
    for (let k = 0; k < 50; k++) {
      const o = shuffleOrder(n);
      assert.deepEqual([...o].sort(), [...Array(n).keys()]);
      assert.ok(o.some((v, i) => v !== i), `n=${n} must change the order`);
    }
  }
  assert.deepEqual(shuffleOrder(1), [0]);
  assert.deepEqual(shuffleOrder(3, () => 0.999999), [1, 2, 0]); // degenerate RNG still changes order
  const p = makePack();
  const quiz = p.nodes[0].lesson.quiz;               // answers 0 and 1
  const orders = quiz.map((q) => shuffleOrder(q.options.length));
  // learner taps the slot where the right option is displayed; the UI records orders[i][slot]
  const answers = quiz.map((q, i) => orders[i][orders[i].indexOf(q.answer)]);
  assert.equal(gradeQuiz(quiz, answers).passed, true);
  const slot0 = quiz.map((q, i) => orders[i][0]);      // always tapping the first slot
  assert.equal(gradeQuiz(quiz, slot0).passed, slot0.every((a, i) => a === quiz[i].answer));
});

test('assessment display order: seeded per attempt, stable, new on retake; answers stay authored indexes', async () => {
  const { seededOptionOrder } = await import('../js/learn-exam.js');
  let s = applySetup(emptyCourseState(), { goalLevel: 2, weeklyTarget: 3, seed: 1234 });
  assert.equal(s.assessment.seed, 1234);
  assert.equal(applySetup(s, { goalLevel: 3, weeklyTarget: 3, seed: 999 }).assessment.seed, 1234, 'changing the goal keeps the attempt order');
  const qs = ['qa1', 'qa2', 'qb1', 'qd1', 'x5', 'x6'];
  const o1 = qs.map((id) => seededOptionOrder(s.assessment.seed, id, 4).join(''));
  assert.deepEqual(qs.map((id) => seededOptionOrder(1234, id, 4).join('')), o1);
  const r = resetAssessment(s, 98765);
  assert.equal(r.assessment.seed, 98765);
  assert.notDeepEqual(qs.map((id) => seededOptionOrder(r.assessment.seed, id, 4).join('')), o1);
  s = answerAssessment(s, 'qa1', 2);
  assert.equal(s.assessment.answers.qa1, 2, 'stored by authored index regardless of display');
});
