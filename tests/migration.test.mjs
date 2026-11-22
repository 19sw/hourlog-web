// Release A users must keep all progress after the Release B upgrade, and a
// Release A tab still open after the upgrade must never damage v2 data.
//
// fixtures/learning-v1.json was produced by the published Release A code
// (setup, diagnostic, a failed then passed quiz, a failed quiz on a mastered
// node, checklist, stepped explanation, reflection + low rating, prioritize).
// fixtures/release-a/ holds frozen copies of the published Release A store,
// logic and topic pack (see the README there).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as storeB from '../js/learn-store.js';
const { createLearnStore, migrate, LEARN_KEY, LEARN_VERSION } = storeB;
import { computePath, stuckNodes, masteredThisWeek, dimensionScores, assessmentMasteredNodes } from '../js/learn-logic.js';
import pack from '../courses/video-editing-basics.js';
import { createLearnStore as createStoreA } from './fixtures/release-a/learn-store.js';
import * as logicA from './fixtures/release-a/learn-logic.js';
import packA from './fixtures/release-a/video-editing-basics.js';

const RAW = fs.readFileSync(new URL('./fixtures/learning-v1.json', import.meta.url), 'utf8');
const V1 = JSON.parse(RAW);
const C1 = V1.courses['video-editing-basics'];
const mem = (init) => { const m = new Map(init); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const qById = (p) => new Map([...p.assessment.questions, ...p.nodes.flatMap((n) => n.lesson.quiz)].map((q) => [q.id, q]));

test('fixture is a real v1 payload written by the Release A store', () => {
  assert.equal(V1.v, 1);
  assert.equal(LEARN_VERSION, 2);
  assert.ok(C1.completions.length >= 1);
  // the frozen Release A store reads it as its own current version
  const a = createStoreA(mem([[LEARN_KEY, RAW]])); a.load();
  assert.equal(a.readOnly, false);
  assert.deepEqual(a.getCourse('video-editing-basics').nodes, C1.nodes);
});

test('v1 -> v2 keeps every v1 value unchanged (answer indexes are never rewritten) and adds v2 defaults', () => {
  const { data, readOnly } = migrate(JSON.parse(RAW));
  assert.equal(readOnly, false);
  assert.equal(data.v, 2);
  const after = data.courses['video-editing-basics'];
  const walk = (a, b, path) => {
    if (a && typeof a === 'object') { for (const k of Object.keys(a)) walk(a[k], b && b[k], `${path}.${k}`); return; }
    assert.deepEqual(b, a, `lost or changed ${path}`);
  };
  walk(C1, after, 'course');
  assert.deepEqual(after.assessment.answers, C1.assessment.answers);
  // every saved diagnostic answer still means the same option text in the new build
  const oldQ = qById(packA), newQ = qById(pack);
  for (const [qid, idx] of Object.entries(C1.assessment.answers)) {
    assert.equal(newQ.get(qid).options[after.assessment.answers[qid]], oldQ.get(qid).options[idx], `answer ${qid}`);
  }
  assert.equal(after.setup.examDate, null);
  assert.deepEqual(after.assessment.selfRatings, {});
  assert.equal(after.assessment.seed, null);
  assert.deepEqual(after.notebook, {});
  assert.deepEqual(after.mock, { active: null, history: [] });
  assert.equal(after.plan, null);
  assert.ok(!Object.keys(storeB).some((k) => /remap/i.test(k)), 'no answer remapping in the store');
});

// Saved assessment answers are option INDEXES. A Release A tab can load the
// current topic pack from its unversioned URL and save answers against it, so
// the published pack's assessment questions must keep exactly their published
// option order and answer index forever. Change a question's id instead.
test('topic pack assessment questions are identical to the published Release A ones (options + answer index)', () => {
  const pub = packA.assessment.questions.map((q) => [q.id, q.options, q.answer]);
  const now = pack.assessment.questions.filter((q) => pub.some(([id]) => id === q.id)).map((q) => [q.id, q.options, q.answer]);
  assert.deepEqual(now, pub);
});

test('upgraded progress gives the same results as Release A did (scores, mastery, path, stuck, week)', () => {
  const b = mem([[LEARN_KEY, RAW]]);
  const s = createLearnStore(b); s.load();
  assert.equal(s.persistent, true);
  assert.equal(s.readOnly, false);
  const st = s.getCourse('video-editing-basics');
  const v1st = logicA.normalizeCourseState(C1);
  assert.deepEqual(dimensionScores(pack, st.assessment.answers), logicA.dimensionScores(packA, v1st.assessment.answers));
  assert.deepEqual([...assessmentMasteredNodes(pack, st.assessment.answers)].sort(), [...logicA.assessmentMasteredNodes(packA, v1st.assessment.answers)].sort());
  const p2 = computePath(pack, st), p1 = logicA.computePath(packA, v1st);
  assert.deepEqual(p2.items.map((i) => [i.node.id, i.status, i.optional]), p1.items.map((i) => [i.node.id, i.status, i.optional]));
  assert.equal(p2.currentId, p1.currentId);
  assert.equal(p2.currentId, C1.currentOverride);
  assert.deepEqual(stuckNodes(pack, st).map((x) => x.node.id), logicA.stuckNodes(packA, v1st).map((x) => x.node.id));
  const at = new Date(C1.completions[0].at);
  assert.equal(masteredThisWeek(st, at), logicA.masteredThisWeek(v1st, at));
  // the first write upgrades the payload in place
  s.update('video-editing-basics', (cur) => ({ ...cur, currentOverride: null }));
  const saved = JSON.parse(b.getItem(LEARN_KEY));
  assert.equal(saved.v, 2);
  assert.deepEqual(saved.courses['video-editing-basics'].nodes, C1.nodes);
});

test('a Release A tab still open after the upgrade can no longer write: v2 data stays intact', () => {
  const b = mem([[LEARN_KEY, RAW]]);
  const tabA = createStoreA(b); tabA.load();          // opened before the upgrade
  const tabB = createLearnStore(b); tabB.load();
  tabB.update('video-editing-basics', (cur) => ({ ...cur, currentOverride: null })); // B writes v2
  const v2 = b.getItem(LEARN_KEY);
  assert.equal(JSON.parse(v2).v, 2);
  // Release A's stale tab tries every write path
  const r = tabA.update('video-editing-basics', (cur) => logicA.setWeeklyTarget(cur, 7));
  assert.equal(r.saved, false);
  assert.equal(tabA.readOnly, true);
  assert.equal(tabA.saveCourse('video-editing-basics', logicA.emptyCourseState()), false);
  assert.equal(tabA.removeCourse('video-editing-basics'), false);
  assert.equal(b.getItem(LEARN_KEY), v2);
  // a Release A tab opened after the upgrade is read-only from the start
  const fresh = createStoreA(b); fresh.load();
  assert.equal(fresh.readOnly, true);
  assert.equal(fresh.saveCourse('x', logicA.emptyCourseState()), false);
  assert.equal(b.getItem(LEARN_KEY), v2);
});
