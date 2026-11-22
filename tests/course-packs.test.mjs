import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPacks, PACK_FILES } from '../courses/index.js';
import { validatePack } from '../js/learn-logic.js';
import demo from '../courses/video-editing-basics.js';

test('every registered pack loads and validates', async () => {
  const warns = [];
  const { packs, rejected } = await loadPacks(PACK_FILES, undefined, (...a) => warns.push(a));
  assert.deepEqual(rejected, []);
  assert.equal(warns.length, 0);
  assert.equal(packs.length, PACK_FILES.length);
});

test('invalid, broken and duplicate packs are skipped with a warning; valid ones survive', async () => {
  const good = { default: demo };
  const bad = { default: { ...demo, id: 'bad-one', title: '' } };
  const importer = async (f) => {
    if (f === 'good') return good;
    if (f === 'bad') return bad;
    if (f === 'dup') return good;
    throw new SyntaxError('Unexpected token');
  };
  const warns = [];
  const { packs, rejected } = await loadPacks(['good', 'bad', 'broken', 'dup'], importer, (...a) => warns.push(a));
  assert.deepEqual(packs.map((p) => p.id), ['video-editing-basics']);
  assert.deepEqual(rejected.map((r) => r.file), ['bad', 'broken', 'dup']);
  assert.equal(warns.length, 3);
});

test('demo pack: 视频剪辑基础 meets the size and content spec', () => {
  assert.deepEqual(validatePack(demo), { ok: true, errors: [] });
  assert.equal(demo.type, 'topic');
  assert.equal(demo.title, '视频剪辑基础');
  assert.equal(demo.stages.length, 3);
  assert.ok(demo.nodes.length >= 9 && demo.nodes.length <= 12, 'nodes 9-12');
  assert.ok(demo.dimensions.length >= 3 && demo.dimensions.length <= 4, 'dimensions 3-4');
  const aq = demo.assessment.questions.length;
  assert.ok(aq >= 7 && aq <= 9, 'about 8 assessment questions');
  for (const s of demo.stages) assert.ok(demo.nodes.some((n) => n.stage === s.id), `stage ${s.id} has nodes`);
  for (const d of demo.dimensions) assert.ok(demo.assessment.questions.some((q) => q.dimension === d.id), `dimension ${d.id} is assessed`);
  // all three goal levels are represented so the optional flag is visible
  for (const lv of [1, 2, 3]) assert.ok(demo.nodes.some((n) => n.level === lv), `level ${lv} present`);
  // at least one node without an assessment question (never auto-mastered)
  assert.ok(demo.nodes.some((n) => !demo.assessment.questions.some((q) => q.node === n.id)));
  for (const n of demo.nodes) {
    const L = n.lesson;
    assert.ok(L.sections.length >= 2, `${n.id}: several explanation sections`);
    assert.ok(L.askQuestions.length >= 2, `${n.id}: questions worth asking`);
    assert.ok(L.task.criteria.length >= 2, `${n.id}: acceptance criteria`);
    assert.ok(L.reflection.answer.length >= 40, `${n.id}: genuine reference answer`);
    assert.ok(L.quiz.length >= 2 && L.quiz.length <= 3, `${n.id}: quiz has 2-3 questions`);
  }
});

test('demo pack: every question has exactly one correct option and an explanation', () => {
  const all = [...demo.nodes.flatMap((n) => n.lesson.quiz), ...demo.assessment.questions];
  const ids = new Set();
  for (const q of all) {
    assert.ok(!ids.has(q.id), `unique id ${q.id}`); ids.add(q.id);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `${q.id}: one correct option index`);
    assert.equal(new Set(q.options).size, q.options.length, `${q.id}: options distinct`);
    assert.ok(q.explanation.trim().length >= 15, `${q.id}: explanation`);
  }
  // correct answers are not always in the same position
  assert.ok(new Set(all.map((q) => q.answer)).size >= 3);
});

test('demo pack contains no markup or URLs (rendered as plain text)', () => {
  const text = JSON.stringify(demo);
  assert.ok(!/<[a-z/!]/i.test(text), 'no HTML tags');
  assert.ok(!/https?:\/\//i.test(text), 'no URLs');
});
