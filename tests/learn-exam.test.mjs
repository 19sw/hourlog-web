import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateExamDate, daysBetween, addDaysISO, dailyPlan, planProgress, chapterScores, questionIndex,
  addToNotebook, redoNotebook, notebookItems, startMock, answerMock, mockRemaining, submitMock, scoreMock, parseISODate, mockOptionOrder,
} from '../js/learn-exam.js';
import { emptyCourseState, applySetup, answerAssessment, completeAssessment, submitQuiz, computePath, replan, studyOrder } from '../js/learn-logic.js';
import exam from '../courses/micro-econ-final.js';

const ids = (n) => Array.from({ length: n }, (_, i) => `c${i + 1}`);

test('exam date validation: real date, today or later', () => {
  assert.equal(validateExamDate('2026-11-22', '2026-11-22'), 'ok');
  assert.equal(validateExamDate('2027-01-10', '2026-11-22'), 'ok');
  assert.equal(validateExamDate('2026-11-21', '2026-11-22'), 'past');
  assert.equal(validateExamDate('2026-02-30', '2026-01-01'), 'invalid');
  assert.equal(validateExamDate('', '2026-01-01'), 'invalid');
  assert.equal(validateExamDate(null, '2026-01-01'), 'invalid');
  assert.equal(parseISODate('2028-02-29').d, 29);
});

test('day arithmetic ignores DST and month/year ends', () => {
  assert.equal(daysBetween('2026-03-01', '2026-03-31'), 30);
  assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3);
  assert.equal(addDaysISO('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-11-22', '2026-11-20'), -2);
});

test('plan: more chapters than days -> several per day, evenly, extras first; last day is the mock', () => {
  const p = dailyPlan(ids(7), '2026-11-22', '2026-11-26'); // 4 days before the exam
  assert.equal(p.status, 'ok');
  assert.deepEqual(p.days.map((d) => d.date), ['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25']);
  assert.deepEqual(p.days.map((d) => d.nodes), [['c1', 'c2', 'c3'], ['c4', 'c5'], ['c6', 'c7'], []]);
  assert.deepEqual(p.days.map((d) => d.mock), [false, false, false, true]);
});

test('plan: fewer chapters than days -> one per day from today, later days free', () => {
  const p = dailyPlan(ids(2), '2026-11-22', '2026-11-28');
  assert.equal(p.days.length, 6);
  assert.deepEqual(p.days.map((d) => d.nodes.length), [1, 1, 0, 0, 0, 0]);
  assert.equal(p.days[5].mock, true);
});

test('plan: exactly 2 days -> everything today, mock tomorrow', () => {
  const p = dailyPlan(ids(5), '2026-11-22', '2026-11-24');
  assert.deepEqual(p.days.map((d) => [d.nodes.length, d.mock]), [[5, false], [0, true]]);
});

test('plan: 1 day left -> all chapters today, no mock day reserved', () => {
  const p = dailyPlan(ids(7), '2026-11-22', '2026-11-23');
  assert.equal(p.days.length, 1);
  assert.deepEqual(p.days[0].nodes, ids(7));
  assert.equal(p.days[0].mock, false);
});

test('plan: exam today and past exam date', () => {
  assert.deepEqual(dailyPlan(ids(3), '2026-11-22', '2026-11-22'), { status: 'examDay', from: '2026-11-22', exam: '2026-11-22', days: [] });
  assert.equal(dailyPlan(ids(3), '2026-11-22', '2026-11-01').status, 'past');
  assert.equal(dailyPlan([], '2026-11-22', '2026-11-25').days.every((d) => d.nodes.length === 0), true);
});

// ---- with the demo pack
const today = new Date(2026, 10, 22, 9);
const wrongIds = ['d-el-calc', 'd-cost'];
function diagnosed(examDate = '2026-11-27') {
  let s = applySetup(emptyCourseState('exam'), { examDate, weeklyTarget: 3 });
  for (const q of exam.assessment.questions) s = answerAssessment(s, q.id, wrongIds.includes(q.id) ? (q.answer + 1) % q.options.length : q.answer);
  return completeAssessment(exam, s, today.getTime()).state;
}

test('exam setup forces every chapter required and stores the date', () => {
  const s = applySetup(emptyCourseState('exam'), { examDate: '2026-12-01', goalLevel: 1 });
  assert.equal(s.setup.examDate, '2026-12-01');
  assert.equal(s.setup.goalLevel, 3);
});

test('diagnostic: weakest chapters first in study order and plan; correct chapters mastered', () => {
  const s = diagnosed();
  const scores = chapterScores(exam, s.assessment.answers);
  assert.equal(scores['ch-elasticity'], 50);
  assert.equal(scores['ch-costs'], 0);
  // all-correct chapters are mastered by the diagnostic -> not in the plan
  const planned = s.plan.days.flatMap((d) => d.nodes);
  assert.deepEqual(planned, ['ch-costs', 'ch-elasticity']);
  assert.equal(studyOrder(exam, s)[0].id, 'ch-costs');
  assert.equal(computePath(exam, s).currentId, 'ch-costs');
  assert.equal(s.plan.days.length, 5);
  assert.equal(s.plan.days[4].mock, true);
});

test('re-plan recomputes from today for remaining chapters; behind is detected', () => {
  let s = diagnosed();
  // two days later, nothing studied: ch-costs (day 1) and ch-elasticity (day 2) are behind
  const later = '2026-11-24';
  const prog = planProgress(s.plan, (id) => !!(s.nodes[id] && s.nodes[id].masteredAt), later);
  assert.deepEqual(prog.behind, ['ch-costs', 'ch-elasticity']);
  // master costs, re-plan on the 24th
  const costs = exam.nodes.find((n) => n.id === 'ch-costs');
  s = submitQuiz(exam, s, 'ch-costs', costs.lesson.quiz.map((q) => q.answer), today.getTime() + 1).state;
  s = replan(exam, s, new Date(2026, 10, 24, 8));
  assert.equal(s.plan.from, '2026-11-24');
  assert.deepEqual(s.plan.days.map((d) => d.nodes), [['ch-elasticity'], [], []]);
  assert.equal(s.plan.days[2].mock, true);
  // past date: finished state
  s = replan(exam, s, new Date(2026, 11, 2));
  assert.equal(s.plan.status, 'past');
});

test('notebook collects from diagnostic, chapter quiz and mock, once per question; redo removes on correct', () => {
  let s = diagnosed();
  assert.deepEqual(Object.keys(s.notebook).sort(), ['d-cost', 'd-el-calc']);
  assert.equal(s.notebook['d-cost'].source, 'diagnostic');
  // chapter quiz: two wrong, then the same wrong again -> no duplicates
  const el = exam.nodes.find((n) => n.id === 'ch-elasticity');
  const bad = el.lesson.quiz.map((q, i) => (i < 2 ? (q.answer + 1) % q.options.length : q.answer));
  const T = today.getTime();
  s = submitQuiz(exam, s, 'ch-elasticity', bad, T + 1000).state;
  s = submitQuiz(exam, s, 'ch-elasticity', bad, T + 2000).state;
  assert.deepEqual(Object.keys(s.notebook).filter((k) => s.notebook[k].source === 'quiz').sort(), ['el-q1', 'el-q2']);
  assert.equal(s.notebook['el-q1'].addedAt, T + 1000);
  // mock: answer only m01 correctly, submit -> 14 wrong/unanswered added
  s = startMock(s, T + 5000);
  s = answerMock(s, 'm01', exam.exam.mock.questions[0].answer);
  s = submitMock(exam, s, T + 6000).state;
  const mockWrong = Object.keys(s.notebook).filter((k) => s.notebook[k].source === 'mock');
  assert.equal(mockWrong.length, 14);
  assert.ok(!('m01' in s.notebook));
  const before = Object.keys(s.notebook).length;
  assert.equal(addToNotebook(s, ['d-cost', 'el-q1', 'm02'], 'mock', 9).notebook['d-cost'].source, 'diagnostic');
  assert.equal(Object.keys(addToNotebook(s, ['d-cost'], 'mock', 9).notebook).length, before);
  // items resolve to questions, oldest first
  const items = notebookItems(exam, s);
  assert.equal(items.length, before);
  assert.deepEqual(items.slice(0, 2).map((x) => x.source), ['diagnostic', 'diagnostic']);
  assert.equal(items.find((x) => x.id === 'el-q1').chapter, 'ch-elasticity');
  // redo: wrong keeps, correct removes
  assert.equal(redoNotebook(s, 'd-cost', false).removed, false);
  const r = redoNotebook(s, 'd-cost', true);
  assert.equal(r.removed, true);
  assert.ok(!('d-cost' in r.state.notebook));
  assert.equal(redoNotebook(r.state, 'd-cost', true).removed, false);
});

test('mock exam: wall-clock timer, single submit, per-chapter score and revisit list', () => {
  let s = diagnosed();
  const t0 = 1_000_000;
  s = startMock(s, t0);
  assert.equal(startMock(s, t0 + 5), s, 'no restart while running');
  assert.equal(mockRemaining(exam, s, t0), 20 * 60e3);
  assert.equal(mockRemaining(exam, s, t0 + 19 * 60e3), 60e3);
  assert.equal(mockRemaining(exam, s, t0 + 25 * 60e3), 0, 'time keeps running while away');
  // answer: all of scarcity, s-d, elasticity correct; equilibrium 1 of 3; rest wrong
  const right = new Set(['m01', 'm02', 'm03', 'm04', 'm07', 'm08', 'm09']);
  for (const q of exam.exam.mock.questions) s = answerMock(s, q.id, right.has(q.id) ? q.answer : (q.answer + 1) % q.options.length);
  const r = submitMock(exam, s, t0 + 25 * 60e3); // auto-submit after time-out
  assert.equal(r.submitted, true);
  assert.equal(r.result.correct, 7);
  assert.equal(r.result.total, 15);
  const by = Object.fromEntries(r.result.byChapter.map((b) => [b.id, `${b.correct}/${b.total}`]));
  assert.deepEqual(by, { 'ch-scarcity': '2/2', 'ch-supply-demand': '2/2', 'ch-equilibrium': '1/3', 'ch-elasticity': '2/2', 'ch-welfare': '0/2', 'ch-costs': '0/2', 'ch-competition': '0/2' });
  assert.deepEqual(r.result.revisit, ['ch-equilibrium', 'ch-welfare', 'ch-costs', 'ch-competition']);
  assert.equal(r.state.mock.active, null);
  assert.equal(r.state.mock.history.length, 1);
  assert.equal(r.state.mock.history[0].submittedAt, t0 + 20 * 60e3, 'capped at the time limit');
  // a second submit (double tap / other tab) does nothing
  assert.equal(submitMock(exam, r.state, t0 + 26 * 60e3).submitted, false);
  // retake
  const s2 = startMock(r.state, t0 + 30 * 60e3);
  assert.deepEqual(s2.mock.active.answers, {});
  assert.equal(s2.mock.history.length, 1);
});

test('revisit uses < 60%: exactly 60% is not listed', () => {
  const fake = { nodes: [{ id: 'a' }], exam: { mock: { questions: Array.from({ length: 5 }, (_, i) => ({ id: 'q' + i, chapter: 'a', answer: 0, options: ['x', 'y'] })) } } };
  const ans = { q0: 0, q1: 0, q2: 0, q3: 1, q4: 1 };
  assert.deepEqual(scoreMock(fake, ans).revisit, []);
  assert.deepEqual(scoreMock(fake, { ...ans, q2: 1 }).revisit, ['a']);
});

test('question index covers all three sources', () => {
  const idx = questionIndex(exam);
  assert.equal(idx.get('d-cost').source, 'diagnostic');
  assert.equal(idx.get('el-q1').source, 'quiz');
  assert.equal(idx.get('m15').source, 'mock');
  assert.equal(idx.size, exam.assessment.questions.length + exam.exam.mock.questions.length + exam.nodes.reduce((a, n) => a + n.lesson.quiz.length, 0));
});

test('m2: remaining time never exceeds the limit when the clock moves backwards', () => {
  const s = startMock(diagnosed(), 1_000_000);
  assert.equal(mockRemaining(exam, s, 1_000_000 - 60 * 60e3), 20 * 60e3);
});

test('m3: answers are refused once time is up (when pack and now are given)', () => {
  let s = startMock(diagnosed(), 1_000_000);
  const late = 1_000_000 + 20 * 60e3;
  assert.equal(answerMock(s, 'm01', 1, exam, late), s);
  s = answerMock(s, 'm01', 1, exam, late - 1);
  assert.equal(s.mock.active.answers.m01, 1);
});

test('R3: mock option order is a stable per-attempt permutation that changes between attempts', () => {
  const qs = exam.exam.mock.questions;
  const a = qs.map((q) => mockOptionOrder(111, q.id, q.options.length));
  const again = qs.map((q) => mockOptionOrder(111, q.id, q.options.length));
  const b = qs.map((q) => mockOptionOrder(222222, q.id, q.options.length));
  assert.deepEqual(a, again, 'stable across re-renders and reloads');
  for (const o of a) assert.deepEqual([...o].sort(), [0, 1, 2, 3]);
  assert.notDeepEqual(a, b, 'differs between attempts');
  // over many attempts the correct option shows up in every display slot
  const slots = new Set();
  for (let t = 0; t < 40; t++) { const o = mockOptionOrder(t * 7919, qs[0].id, 4); slots.add(o.indexOf(qs[0].answer)); }
  assert.equal(slots.size, 4);
  // fixed display slot across attempts cannot be learned: always tapping slot 1 scores like chance
  let score = 0, total = 0;
  for (let t = 1; t <= 20; t++) for (const q of qs) { total++; if (mockOptionOrder(t * 104729, q.id, q.options.length)[1] === q.answer) score++; }
  assert.ok(score / total < 0.4, `${score}/${total}`);
});
