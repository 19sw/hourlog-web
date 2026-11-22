import test from 'node:test';
import assert from 'node:assert/strict';
import { abilityGaps, gapMasteredNodes, nodeGapPriority, abilityProgress } from '../js/learn-role.js';
import { emptyCourseState, applySetup, answerAssessment, completeAssessment, setSelfRating, computePath, studyOrder, priorityOrder, isMastered, resetAssessment, validatePack } from '../js/learn-logic.js';

const q = (id, ability, node, answer = 0) => ({ id, ability, node, dimension: 'd', prompt: 'p', options: ['a', 'b'], answer, explanation: 'e' });
const lesson = (id) => ({ sections: [{ heading: 'h', body: ['b'] }], askQuestions: ['a?'], task: { prompt: 't', criteria: ['c'] }, reflection: { question: 'q', answer: 'a' }, quiz: [{ id: id + '-q', prompt: 'p', options: ['a', 'b'], answer: 0, explanation: 'e' }] });
const node = (id, prereqs = []) => ({ id, stage: 's', title: id, summary: 's', level: 1, dimensions: ['d'], prereqs, lesson: lesson(id) });
const pack = () => ({
  schema: 1, id: 'r', type: 'role', title: 'R', summary: 's', demoNotice: 'demo',
  levels: [1, 2, 3].map((id) => ({ id, label: 'L' + id, desc: 'x' })),
  dimensions: [{ id: 'd', label: 'd' }], stages: [{ id: 's', title: 'S' }],
  nodes: [node('n1'), node('n2', ['n1']), node('n3'), node('n4'), node('n5')],
  assessment: { questions: [q('qa', 'a', 'n1'), q('qb1', 'b', 'n3'), q('qb2', 'b', 'n3'), q('qc', 'c', 'n4')] },
  role: {
    abilities: [
      { id: 'a', title: 'a', what: 'w', practice: ['p'], requiredLevel: 3, nodes: ['n1', 'n2'] },
      { id: 'b', title: 'b', what: 'w', practice: ['p'], requiredLevel: 2, nodes: ['n3'] },
      { id: 'c', title: 'c', what: 'w', practice: ['p'], requiredLevel: 1, nodes: ['n4', 'n5'] },
      { id: 'd', title: 'd', what: 'w', practice: ['p'], requiredLevel: 3, nodes: ['n5'] },
    ],
    tasks: [{ id: 't', title: 'T', desc: 'd', outputs: ['o'], abilities: ['a', 'b'] }],
  },
});

test('synthetic role pack validates; bad role references are rejected', () => {
  assert.deepEqual(validatePack(pack()), { ok: true, errors: [] });
  for (const mutate of [
    (p) => { p.role.abilities[0].nodes = ['zzz']; },
    (p) => { p.role.tasks[0].abilities = ['zzz']; },
    (p) => { p.role.abilities[0].requiredLevel = 4; },
    (p) => { delete p.assessment.questions[0].ability; },
    (p) => { delete p.demoNotice; },
    (p) => { p.role.tasks[0].outputs = []; },
  ]) { const p = pack(); mutate(p); assert.equal(validatePack(p).ok, false); }
});

test('gap = required - assessed; assessed = self-rating capped at 1 if any of the ability\'s questions is wrong', () => {
  const p = pack();
  const g = Object.fromEntries(abilityGaps(p, { a: 3, b: 3, c: 0, d: 2 }, { qa: 0, qb1: 0, qb2: 1, qc: 0 }).map((x) => [x.id, [x.assessed, x.gap]]));
  assert.deepEqual(g, { a: [3, 0], b: [1, 1], c: [0, 1], d: [2, 1] });
  // unrated = 0; unanswered question counts as wrong
  const g2 = Object.fromEntries(abilityGaps(p, { a: 2 }, {}).map((x) => [x.id, [x.self, x.assessed, x.gap]]));
  assert.deepEqual(g2.a, [2, 1, 2]);
  assert.deepEqual(g2.d, [0, 0, 3]);
});

test('gap <= 0 masters the ability\'s nodes; a node shared with an unmet ability stays', () => {
  const p = pack();
  const m = gapMasteredNodes(p, { a: 3, b: 3, c: 1, d: 0 }, { qa: 0, qb1: 0, qb2: 0, qc: 0 });
  // A met -> n1,n2; B met (self 3 >= 2) -> n3; C met -> n4, but n5 is also D's (gap 3) -> not mastered
  assert.deepEqual([...m].sort(), ['n1', 'n2', 'n3', 'n4']);
});

test('path orders by largest gap first, respecting prerequisites', () => {
  const p = pack();
  let s = applySetup(emptyCourseState('role'), { goalLevel: 3, weeklyTarget: 3 });
  // gaps: A 3-0=3 (n1,n2), B 2-1=1 (self 3, wrong question), C 1-1=0, D 3-0=3 (n5)
  for (const [a, v] of Object.entries({ a: 0, b: 3, c: 1, d: 0 })) s = setSelfRating(s, a, v);
  for (const [k, v] of Object.entries({ qa: 0, qb1: 1, qb2: 0, qc: 0 })) s = answerAssessment(s, k, v);
  const pr = nodeGapPriority(p, s.assessment.selfRatings, s.assessment.answers);
  assert.deepEqual(pr, { n1: 3, n2: 3, n3: 1, n4: 0, n5: 3 });
  s = completeAssessment(p, s, 100).state;
  assert.deepEqual(['n1', 'n2', 'n3', 'n4', 'n5'].filter((id) => isMastered(s, id)), ['n4']);
  assert.deepEqual(studyOrder(p, s).map((n) => n.id), ['n1', 'n2', 'n5', 'n3', 'n4']);
  assert.equal(computePath(p, s).currentId, 'n1');
});

test('priorityOrder: prerequisites come first and are pulled forward by what needs them', () => {
  const nodes = [{ id: 'a' }, { id: 'b', prereqs: ['a'] }, { id: 'c', prereqs: ['b'] }, { id: 'd' }, { id: 'e' }];
  const pr = { a: 0, b: 1, c: 9, d: 5, e: 0 };
  // c (9) needs b needs a: the chain goes first, then d (5), then e (0)
  assert.deepEqual(priorityOrder(nodes, (n) => pr[n.id]).map((n) => n.id), ['a', 'b', 'c', 'd', 'e']);
  // without the high-priority dependant, plain priority order applies
  const pr2 = { a: 0, b: 1, c: 0, d: 5, e: 0 };
  assert.deepEqual(priorityOrder(nodes, (n) => pr2[n.id]).map((n) => n.id), ['d', 'a', 'b', 'c', 'e']);
});

test('demo role path: a gap-2 lesson is not stuck behind a gap-0 prerequisite', async () => {
  const { default: role } = await import('../courses/short-video-editor.js');
  const { default: ve } = await import('../courses/video-editing-basics.js');
  const { resolvePack } = await import('../js/learn-logic.js');
  const pack = resolvePack(role, new Map([[ve.id, ve]])).pack;
  let s = applySetup(emptyCourseState('role'), { goalLevel: 2, weeklyTarget: 3 });
  for (const [a, v] of Object.entries({ 'ab-brief': 3, 'ab-material': 2, 'ab-edit': 1, 'ab-story': 3, 'ab-audio': 2, 'ab-visual': 0, 'ab-delivery': 1 })) s = setSelfRating(s, a, v);
  for (const q of pack.assessment.questions) s = answerAssessment(s, q.id, q.id === 'r-story' ? (q.answer + 1) % q.options.length : q.answer);
  s = completeAssessment(pack, s, 1).state;
  const order = studyOrder(pack, s).map((n) => n.id);
  assert.ok(order.indexOf('timeline') < order.indexOf('color'), order.join(' '));
  assert.ok(order.indexOf('workflow') < order.indexOf('timeline'));
  assert.equal(order[order.length - 1], 'brief'); // gap -1, nothing depends on it
  assert.equal(computePath(pack, s).currentId, 'timeline');
});

test('self-ratings lock after completion and reset on retake', () => {
  const p = pack();
  let s = setSelfRating(emptyCourseState('role'), 'a', 2);
  assert.equal(setSelfRating(s, 'a', 4), s);
  s = completeAssessment(p, s, 1).state;
  assert.equal(setSelfRating(s, 'a', 3), s);
  assert.deepEqual(resetAssessment(s).assessment.selfRatings, {});
});

test('required-vs-current: assessed level, raised to required once every node is mastered', () => {
  const p = pack();
  const mastered = new Set(['n1', 'n2', 'n4']);
  const r = Object.fromEntries(abilityProgress(p, { a: 1, b: 2, c: 0 }, { qa: 0, qb1: 0, qb2: 0, qc: 1 }, (id) => mastered.has(id)).map((x) => [x.id, [x.required, x.current, `${x.mastered}/${x.total}`, x.met]]));
  assert.deepEqual(r, { a: [3, 3, '2/2', true], b: [2, 2, '0/1', true], c: [1, 0, '1/2', false], d: [3, 0, '0/1', false] });
});
