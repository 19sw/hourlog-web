import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearnStore, migrate, LEARN_KEY, LEARN_BACKUP_KEY, LEARN_VERSION } from '../js/learn-store.js';
import { createStore } from '../js/storage.js';
import { emptyCourseState, applySetup } from '../js/learn-logic.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(String(k), String(v)), m }; };

test('save, reload, remove; versioned payload under its own key', () => {
  const b = mem();
  const s = createLearnStore(b); s.load();
  assert.equal(s.getCourse('x'), null);
  const st = applySetup(emptyCourseState(), { goalLevel: 3, weeklyTarget: 5 });
  assert.equal(s.saveCourse('x', st), true);
  const raw = JSON.parse(b.getItem(LEARN_KEY));
  assert.equal(raw.v, LEARN_VERSION);
  assert.deepEqual(raw.courses.x.setup, { goalLevel: 3, weeklyTarget: 5 });
  const s2 = createLearnStore(b); s2.load();
  assert.deepEqual(s2.getCourse('x').setup, { goalLevel: 3, weeklyTarget: 5 });
  // getCourse returns a copy
  s2.getCourse('x').setup.goalLevel = 1;
  assert.equal(s2.getCourse('x').setup.goalLevel, 3);
  s2.removeCourse('x');
  const s3 = createLearnStore(b); s3.load();
  assert.equal(s3.getCourse('x'), null);
});

test('learning store never touches the entries key', () => {
  const b = mem();
  const entries = createStore(b); entries.load();
  entries.add({ text: 'hello', timestamp: 1 });
  const before = b.getItem('hourlog.entries.v1');
  const s = createLearnStore(b); s.load();
  s.saveCourse('x', emptyCourseState());
  s.removeCourse('x');
  assert.equal(b.getItem('hourlog.entries.v1'), before);
  const again = createStore(b); again.load();
  assert.deepEqual(again.list().map((e) => e.text), ['hello']);
});

test('corrupt payload is backed up and replaced on next save', () => {
  const b = mem(); b.setItem(LEARN_KEY, '{oops');
  const s = createLearnStore(b); s.load();
  assert.equal(s.persistent, true);
  assert.equal(b.getItem(LEARN_BACKUP_KEY), '{oops');
  assert.equal(s.getCourse('x'), null);
  s.saveCourse('x', emptyCourseState());
  assert.equal(JSON.parse(b.getItem(LEARN_KEY)).v, 1);
});

test('payload from a newer version is read but never overwritten', () => {
  const b = mem();
  const future = JSON.stringify({ v: 99, courses: { x: { setup: { goalLevel: 1, weeklyTarget: 2 } } } });
  b.setItem(LEARN_KEY, future);
  const s = createLearnStore(b); s.load();
  assert.equal(s.readOnly, true);
  assert.equal(s.persistent, false);
  assert.deepEqual(s.getCourse('x').setup, { goalLevel: 1, weeklyTarget: 2 });
  assert.equal(s.saveCourse('x', emptyCourseState()), false);
  assert.equal(b.getItem(LEARN_KEY), future);
});

test('migrate: v1 is normalized; garbage yields null', () => {
  assert.deepEqual(migrate({ v: 1, courses: { a: { setup: { goalLevel: 2, weeklyTarget: 4 } } } }).data.courses.a.setup, { goalLevel: 2, weeklyTarget: 4 });
  assert.equal(migrate([]).data, null);
  assert.equal(migrate({ courses: {} }).data, null);
  assert.equal(migrate(null).data, null);
});

test('write failure and missing backend degrade to memory', () => {
  const b = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
  const s = createLearnStore(b); s.load();
  assert.equal(s.saveCourse('x', emptyCourseState()), false);
  assert.equal(s.persistent, false);
  assert.notEqual(s.getCourse('x'), null);
  const n = createLearnStore(null); n.load();
  assert.equal(n.persistent, false);
  assert.equal(n.saveCourse('x', emptyCourseState()), false);
  assert.notEqual(n.getCourse('x'), null);
});

test('getItem throwing (storage blocked) degrades to memory', () => {
  const b = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('SecurityError'); } };
  const s = createLearnStore(b); s.load();
  assert.equal(s.persistent, false);
});

import { submitQuiz, setWeeklyTarget, completeAssessment } from '../js/learn-logic.js';
import demo from '../courses/video-editing-basics.js';

test('two tabs sharing storage: alternating updates from stale copies all survive (F1)', () => {
  const b = mem();
  const A = createLearnStore(b); A.load();
  const B = createLearnStore(b); B.load();
  const id = demo.id;
  const pass = (nodeId, at) => (cur) => submitQuiz(demo, cur, nodeId, demo.nodes.find((n) => n.id === nodeId).lesson.quiz.map((q) => q.answer), at).state;
  A.update(id, () => applySetup(emptyCourseState(), { goalLevel: 2, weeklyTarget: 3 }));
  A.update(id, (cur) => completeAssessment(demo, cur, 5).state);
  // A masters two lessons, then B (whose memory predates all of that) masters a third.
  A.update(id, pass('workflow', 10));
  A.update(id, pass('specs', 11));
  const rB = B.update(id, pass('timeline', 12));
  assert.equal(rB.changed, true);
  // B mastering a node A already mastered is a no-op (no duplicate completion).
  const dup = B.update(id, (cur) => { const x = submitQuiz(demo, cur, 'workflow', demo.nodes[0].lesson.quiz.map((q) => q.answer), 13); return x.state; });
  assert.equal(dup.changed, false);
  A.update(id, (cur) => setWeeklyTarget(cur, 5));
  // A second course written by B survives A's writes.
  B.update('other-course', () => emptyCourseState());
  A.update(id, pass('shots', 14));
  const fresh = createLearnStore(b); fresh.load();
  const st = fresh.getCourse(id);
  assert.deepEqual(['workflow', 'specs', 'timeline', 'shots'].map((n) => st.nodes[n] && st.nodes[n].masteredBy), ['quiz', 'quiz', 'quiz', 'quiz']);
  assert.deepEqual(st.completions.map((c) => c.nodeId), ['workflow', 'specs', 'timeline', 'shots']);
  assert.equal(st.setup.weeklyTarget, 5);
  assert.notEqual(fresh.getCourse('other-course'), null);
});

test('update returns unchanged and writes nothing when fn returns its input or the store is read-only', () => {
  const b = mem();
  const s = createLearnStore(b); s.load();
  assert.equal(s.update('x', (cur) => cur).changed, false);
  assert.equal(b.getItem(LEARN_KEY), null);
  const future = JSON.stringify({ v: 99, courses: {} });
  b.setItem(LEARN_KEY, future);
  const ro = createLearnStore(b); ro.load();
  assert.equal(ro.update('x', () => emptyCourseState()).changed, false);
  assert.equal(ro.removeCourse('x'), false);
  assert.equal(b.getItem(LEARN_KEY), future);
});

test('a newer build writing in another tab turns this store read-only instead of overwriting', () => {
  const b = mem();
  const s = createLearnStore(b); s.load();
  s.update('x', () => emptyCourseState());
  const future = JSON.stringify({ v: 2, courses: {} });
  b.setItem(LEARN_KEY, future);
  assert.equal(s.update('x', (cur) => applySetup(cur, { goalLevel: 1, weeklyTarget: 1 })).changed, false);
  assert.equal(s.readOnly, true);
  assert.equal(b.getItem(LEARN_KEY), future);
});

test('learn refresh never replaces memory while degraded', () => {
  let fail = false;
  const m = new Map();
  const b = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { if (fail) throw new Error('quota'); m.set(k, v); } };
  const s = createLearnStore(b); s.load();
  s.update('x', () => applySetup(emptyCourseState(), { goalLevel: 1, weeklyTarget: 2 }));
  fail = true;
  s.update('x', (cur) => setWeeklyTarget(cur, 6));
  s.refresh();
  assert.equal(s.getCourse('x').setup.weeklyTarget, 6);
});
