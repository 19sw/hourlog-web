// R1: saved progress may point at chapters, questions or abilities that a
// rewritten pack no longer has. sanitizeForPack prunes those references so no
// view ever looks up a missing id; per-node progress and history are kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeForPack, normalizeCourseState, computePath, studyOrder, dimensionScores, stuckNodes, courseSummary, resolvePack,
} from '../js/learn-logic.js';
import { planProgress, notebookItems, scoreMock, chapterScores } from '../js/learn-exam.js';
import { abilityGaps, abilityProgress } from '../js/learn-role.js';
import topic from '../courses/video-editing-basics.js';
import exam from '../courses/micro-econ-final.js';
import roleRaw from '../courses/short-video-editor.js';

const role = resolvePack(roleRaw, new Map([[topic.id, topic]])).pack;
const now = new Date(2026, 10, 22, 9);

test('topic: unknown prioritized node, answers and node progress', () => {
  const raw = normalizeCourseState({
    setup: { goalLevel: 2, weeklyTarget: 3 },
    assessment: { answers: { 'a-specs': 1, 'a-gone': 2 }, completedAt: 5 },
    nodes: { 'removed-node': { masteredAt: 5, masteredBy: 'quiz', failedAttempts: 2 }, specs: { masteredAt: 5, masteredBy: 'assessment' } },
    currentOverride: 'removed-node',
    completions: [{ nodeId: 'removed-node', at: 5 }],
  });
  const s = sanitizeForPack(topic, raw);
  assert.equal(s.currentOverride, null);
  assert.deepEqual(Object.keys(s.assessment.answers), ['a-specs']);
  assert.ok(s.nodes['removed-node'], 'progress for an unknown node is kept, never looked up');
  assert.equal(s.completions.length, 1, 'history kept');
  const path = computePath(topic, s);
  assert.ok(path.currentId && topic.nodes.some((n) => n.id === path.currentId));
  assert.doesNotThrow(() => { dimensionScores(topic, s.assessment.answers); stuckNodes(topic, s); courseSummary(topic, s, now); });
  assert.equal(sanitizeForPack(topic, s), s, 'idempotent: nothing left to prune returns the same object');
});

test("exam: plan, notebook and mock references to a removed chapter or question (the review's ch-sd case)", () => {
  const raw = normalizeCourseState({
    setup: { goalLevel: 3, weeklyTarget: 3, examDate: '2026-11-27' },
    assessment: { answers: { 'd-cost': 0, 'd-removed': 1 }, completedAt: 5 },
    plan: { status: 'ok', from: '2026-11-20', exam: '2026-11-27', days: [
      { date: '2026-11-20', nodes: ['ch-sd', 'ch-costs'], mock: false },
      { date: '2026-11-21', nodes: ['ch-sd'], mock: false },
      { date: '2026-11-26', nodes: [], mock: true },
    ] },
    notebook: { 'q-removed': { source: 'quiz', addedAt: 1 }, 'd-cost': { source: 'diagnostic', addedAt: 2 } },
    mock: { active: { startedAt: 10, answers: { m01: 1, 'm-removed': 0 } }, history: [{ startedAt: 1, submittedAt: 2, answers: { m02: 1, 'm-old': 3 }, correct: 1, total: 15 }] },
    currentOverride: 'ch-sd',
  });
  const s = sanitizeForPack(exam, raw);
  assert.deepEqual(s.plan.days.map((d) => d.nodes), [['ch-costs'], [], []]);
  assert.deepEqual(Object.keys(s.notebook), ['d-cost']);
  assert.deepEqual(Object.keys(s.mock.active.answers), ['m01']);
  assert.deepEqual(Object.keys(s.mock.history[0].answers), ['m02']);
  assert.equal(s.currentOverride, null);
  const prog = planProgress(s.plan, () => false, '2026-11-22');
  const ids = new Set(exam.nodes.map((n) => n.id));
  assert.ok(prog.behind.every((id) => ids.has(id)));
  assert.deepEqual(prog.behind, ['ch-costs']);
  assert.doesNotThrow(() => { notebookItems(exam, s); scoreMock(exam, s.mock.history[0].answers); chapterScores(exam, s.assessment.answers); studyOrder(exam, s); });
  assert.deepEqual(raw.plan.days[0].nodes, ['ch-sd', 'ch-costs'], 'input not mutated');
});

test('role: self-ratings for a removed ability, override to a removed node', () => {
  const raw = normalizeCourseState({
    setup: { goalLevel: 2, weeklyTarget: 3 },
    assessment: { answers: { 'r-brief': 1, 'r-gone': 0 }, completedAt: 5, selfRatings: { 'ab-brief': 2, 'ab-removed': 3 } },
    currentOverride: 'old-lesson',
  });
  const s = sanitizeForPack(role, raw);
  assert.deepEqual(Object.keys(s.assessment.selfRatings), ['ab-brief']);
  assert.deepEqual(Object.keys(s.assessment.answers), ['r-brief']);
  assert.equal(s.currentOverride, null);
  assert.doesNotThrow(() => { abilityGaps(role, s.assessment.selfRatings, s.assessment.answers); abilityProgress(role, s.assessment.selfRatings, s.assessment.answers, () => false); computePath(role, s); });
});
