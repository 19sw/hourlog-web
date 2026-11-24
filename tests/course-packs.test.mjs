import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPacks, PACK_FILES } from '../courses/index.js';
import { validatePack } from '../js/learn-logic.js';
import demo from '../courses/video-editing-basics.js';
import examPack from '../courses/micro-econ-final.js';
import rolePack from '../courses/short-video-editor.js';
import mysqlPack from '../courses/mysql-for-accounting.js';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseResult } from '../js/learn-logic.js';
import { resolvePack } from '../js/learn-logic.js';

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
  assert.deepEqual(rejected.map((r) => r.file).sort(), ['bad', 'broken', 'dup']);
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

// ---------------------------------------------------------------- Release B packs
const resolvedRole = () => resolvePack(rolePack, new Map([[demo.id, demo]]));
const allQuestions = (p) => [...p.nodes.flatMap((n) => n.lesson.quiz), ...p.assessment.questions, ...(p.exam ? p.exam.mock.questions : [])];

test('demo exam pack: 微观经济学入门 · 期末复习 meets the spec', () => {
  assert.deepEqual(validatePack(examPack), { ok: true, errors: [] });
  assert.equal(examPack.type, 'exam');
  assert.ok(examPack.nodes.length >= 6 && examPack.nodes.length <= 8, '6-8 chapters');
  const dq = examPack.assessment.questions.length;
  assert.ok(dq >= 7 && dq <= 9, 'about 8 diagnostic questions');
  assert.equal(examPack.exam.mock.questions.length, 15);
  assert.equal(examPack.exam.mock.timeLimitMinutes, 20);
  assert.match(examPack.demoNotice, /示范/);
  for (const n of examPack.nodes) {
    assert.ok(examPack.assessment.questions.some((q) => q.node === n.id), `${n.id} has a diagnostic question`);
    assert.ok(examPack.exam.mock.questions.some((q) => q.chapter === n.id), `${n.id} appears in the mock`);
    const L = n.lesson;
    assert.ok(L.keyPoints.length >= 2 && L.mistakes.length >= 2 && L.example.steps.length >= 2, `${n.id}: full chapter lesson`);
    assert.ok(L.quiz.length >= 2 && L.quiz.length <= 3, `${n.id}: 2-3 quiz questions`);
  }
});

test('demo role pack: 短视频剪辑师 meets the spec and its shared nodes resolve', () => {
  const { pack, errors } = resolvedRole();
  assert.deepEqual(errors, []);
  assert.deepEqual(validatePack(pack), { ok: true, errors: [] });
  assert.ok(pack.role.tasks.length >= 5 && pack.role.tasks.length <= 7, '5-7 tasks');
  assert.ok(pack.role.abilities.length >= 6 && pack.role.abilities.length <= 8, '6-8 abilities');
  const own = rolePack.nodes.filter((n) => !('ref' in n));
  assert.ok(own.length >= 2 && own.length <= 4, '2-4 role-specific nodes');
  assert.match(pack.demoNotice, /示范/);
  // shared content is the topic pack's content; progress is keyed by pack, so it stays separate
  const shared = pack.nodes.find((n) => n.id === 'cut-points');
  assert.equal(shared.lesson, demo.nodes.find((n) => n.id === 'cut-points').lesson);
  assert.deepEqual(shared.sharedFrom, { pack: demo.id, title: demo.title });
  // every ability is assessed by a question and reachable from a task
  for (const a of pack.role.abilities) {
    assert.ok(pack.assessment.questions.some((q) => q.ability === a.id), `${a.id} assessed`);
    assert.ok(pack.role.tasks.some((t) => t.abilities.includes(a.id)), `${a.id} used by a task`);
  }
  // every node belongs to some ability
  for (const n of pack.nodes) assert.ok(pack.role.abilities.some((a) => a.nodes.includes(n.id)), `${n.id} linked to an ability`);
});

test('dangling shared-node references are rejected (unknown pack, unknown node, missing source)', async () => {
  const bad = (ref) => ({ ...rolePack, nodes: [...rolePack.nodes, { ref, stage: 'deliver' }] });
  assert.ok(resolvePack(bad('video-editing-basics:no-such-node'), new Map([[demo.id, demo]])).errors.length > 0);
  assert.ok(resolvePack(bad('no-such-pack:cut-points'), new Map([[demo.id, demo]])).errors.length > 0);
  assert.ok(resolvePack(bad('not a ref'), new Map([[demo.id, demo]])).errors.length > 0);
  assert.ok(resolvePack(rolePack, new Map()).errors.length > 0, 'source pack not loaded');
  // an unresolved ref never validates
  assert.equal(validatePack(rolePack).ok, false);
  // and the loader hides the referencing pack when its source failed
  const warns = [];
  const { packs, rejected } = await loadPacks(['role', 'topic'], async (f) => (f === 'role' ? { default: rolePack } : { default: { ...demo, title: '' } }), (...a) => warns.push(a));
  assert.deepEqual(packs, []);
  assert.deepEqual(rejected.map((r) => r.file).sort(), ['role', 'topic']);
});

test('Release B packs: every question has exactly one correct option and an explanation; no markup or URLs', () => {
  for (const p of [examPack, resolvedRole().pack]) {
    const qs = allQuestions(p);
    const ids = new Set();
    for (const q of qs) {
      assert.ok(!ids.has(q.id), `unique id ${q.id}`); ids.add(q.id);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `${q.id}: one correct option`);
      assert.equal(new Set(q.options).size, q.options.length, `${q.id}: distinct options`);
      assert.ok(q.explanation.trim().length >= 15, `${q.id}: explanation`);
    }
    assert.ok(new Set(qs.map((q) => q.answer)).size >= 3, `${p.id}: correct answers vary in position`);
  }
  for (const p of [examPack, rolePack]) {
    const text = JSON.stringify(p);
    assert.ok(!/<[a-z/!]/i.test(text), `${p.id}: no HTML`);
    assert.ok(!/https?:\/\//i.test(text), `${p.id}: no URLs`);
  }
});

test('answer positions are balanced: no option position holds > 40% of correct answers in any set of 8+', () => {
  const sets = [];
  for (const p of [demo, examPack, rolePack, mysqlPack]) {
    sets.push([`${p.id} assessment`, p.assessment.questions]);
    sets.push([`${p.id} lesson quizzes`, p.nodes.filter((n) => !('ref' in n)).flatMap((n) => n.lesson.quiz)]);
    if (p.exam) sets.push([`${p.id} mock`, p.exam.mock.questions]);
  }
  // Exempt: the published topic pack's assessment. Its saved answers are option
  // indexes, so its authored order must stay exactly as published (see
  // migration.test.mjs); position bias there is removed by shuffling the
  // display order per attempt instead.
  const EXEMPT = new Set(['video-editing-basics assessment']);
  for (const [name, qs] of sets) {
    if (qs.length < 8 || EXEMPT.has(name)) continue;
    const count = {};
    for (const q of qs) count[q.answer] = (count[q.answer] || 0) + 1;
    const worst = Math.max(...Object.values(count));
    assert.ok(worst / qs.length <= 0.4, `${name}: ${JSON.stringify(count)} of ${qs.length}`);
  }
  // the PM's check: always choosing the same position must not pass the mock
  for (let pos = 0; pos < 4; pos++) {
    const score = examPack.exam.mock.questions.filter((q) => q.answer === pos).length;
    assert.ok(score / examPack.exam.mock.questions.length < 0.6, `always option ${pos} scores ${score}/15`);
  }
});

// ---------------------------------------------------------------- 会计人的 MySQL
const WEB = new URL('..', import.meta.url);
const codeItems = (p) => p.nodes.flatMap((n) => n.lesson.sections.flatMap((s) => s.body.filter((b) => typeof b !== 'string').map((b) => ({ node: n.id, ...b }))));

test('mysql pack: 会计人的 MySQL meets the approved outline', () => {
  const p = mysqlPack;
  assert.deepEqual(validatePack(p), { ok: true, errors: [] });
  assert.equal(p.id, 'mysql-for-accounting');
  assert.equal(p.type, 'topic');
  assert.equal(p.title, '会计人的 MySQL');
  assert.deepEqual(p.levels.map((l) => l.label), ['看得懂', '能自己写简单查询', '能指挥 AI 并把关']);
  assert.deepEqual(p.dimensions.map((d) => d.label), ['概念理解', '读懂 SQL', '会计应用', 'AI 协作']);
  assert.deepEqual(p.stages.map((s) => s.title), ['认识数据库', '查询基础', '会计场景', '和 AI 协作']);
  assert.deepEqual(p.nodes.map((n) => n.id), ['db-basics', 'acct-tables', 'setup', 'select-basics', 'aggregate', 'dates', 'joins',
    'vouchers-gl', 'ar-ap', 'expenses', 'statements', 'read-complex', 'prompt-ai', 'check-ai', 'safety']);
  assert.deepEqual(p.stages.map((s) => p.nodes.filter((n) => n.stage === s.id).length), [3, 4, 4, 4]);
  const aq = p.assessment.questions.length;
  assert.ok(aq >= 9 && aq <= 11, 'about 10 assessment questions');
  for (const d of p.dimensions) assert.ok(p.assessment.questions.some((q) => q.dimension === d.id), `dimension ${d.id} is assessed`);
  for (const lv of [1, 2, 3]) assert.ok(p.nodes.some((n) => n.level === lv), `level ${lv} present`);
  // an experienced learner can skip the early query nodes; setup must always be done by hand
  for (const id of ['db-basics', 'acct-tables', 'select-basics', 'aggregate', 'dates', 'joins']) assert.ok(p.assessment.questions.some((q) => q.node === id), `${id} can be skipped by the assessment`);
  assert.ok(!p.assessment.questions.some((q) => q.node === 'setup'));
  for (const n of p.nodes) {
    const L = n.lesson;
    assert.ok(L.sections.length >= 2, `${n.id}: several explanation sections`);
    assert.ok(L.askQuestions.length >= 2, `${n.id}: questions worth asking`);
    assert.ok(L.task.criteria.length >= 2, `${n.id}: acceptance criteria`);
    assert.ok(L.reflection.answer.length >= 40, `${n.id}: genuine reference answer`);
    assert.ok(L.quiz.length >= 2 && L.quiz.length <= 3, `${n.id}: quiz has 2-3 questions`);
  }
});

test('mysql pack: questions are well formed; code-reading questions are common; no markup or URLs', () => {
  const qs = [...mysqlPack.nodes.flatMap((n) => n.lesson.quiz), ...mysqlPack.assessment.questions];
  const ids = new Set();
  for (const q of qs) {
    assert.ok(!ids.has(q.id), `unique id ${q.id}`); ids.add(q.id);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `${q.id}: one correct option`);
    assert.equal(new Set(q.options).size, q.options.length, `${q.id}: distinct options`);
    assert.ok(q.explanation.trim().length >= 15, `${q.id}: explanation`);
  }
  assert.ok(qs.filter((q) => q.code).length >= 15, 'at least 15 questions show SQL to read');
  const text = JSON.stringify(mysqlPack);
  assert.ok(!/<[a-z/!]/i.test(text), 'no HTML tags');
  assert.ok(!/https?:\/\//i.test(text), 'no URLs');
});

test('mysql pack: code blocks are well formed and their recorded results are complete', () => {
  const items = codeItems(mysqlPack);
  assert.ok(items.length >= 50, 'lessons show plenty of SQL');
  for (const it of items) {
    assert.ok(!it.code.includes('\\') && !it.code.includes('${'), `${it.node}: code is a plain literal (the checker rewrites results by matching it)`);
    if (it.result !== undefined) assert.ok(parseResult(it.result), `${it.node}: result parses`);
  }
  // every SQL block except DDL/DCL statements shows its result
  for (const it of items.filter((x) => x.lang !== 'shell' && x.result === undefined)) {
    assert.match(it.code, /^(CREATE USER|SHOW CREATE TABLE)/, `${it.node}: SQL block without a result: ${it.code.slice(0, 40)}`);
  }
  // the checker's recorded results cover exactly the questions that show code
  const expect = JSON.parse(fs.readFileSync(new URL('tools/course-sql-expect.json', WEB), 'utf8'));
  const withCode = [...mysqlPack.nodes.flatMap((n) => n.lesson.quiz), ...mysqlPack.assessment.questions].filter((q) => q.code).map((q) => q.id).sort();
  assert.deepEqual(Object.keys(expect).sort(), withCode);
});

test('mysql practice data: files exist and schema-and-data.sql is exactly what the generator produces', () => {
  const dir = new URL('practice/mysql-accounting/', WEB);
  for (const f of ['schema-and-data.sql', 'answers.sql', 'README.md']) assert.ok(fs.existsSync(new URL(f, dir)), f);
  const sql = fs.readFileSync(new URL('schema-and-data.sql', dir), 'utf8');
  assert.match(sql, /^DROP DATABASE IF EXISTS acct_practice;$/m, 'idempotent re-import');
  assert.ok(!/\b(RAND|NOW|CURDATE|UUID|SYSDATE)\s*\(/i.test(sql), 'deterministic import');
  const fresh = execFileSync(process.execPath, [fileURLToPath(new URL('tools/build-practice-data.mjs', WEB)), '--stdout'], { encoding: 'utf8' });
  assert.equal(fresh, sql);
});

test('mysql pack: option length gives the answer away in at most 40% of questions (assessment first)', () => {
  // Applies to this pack only: the published packs' assessment questions are frozen.
  const uniqueExtreme = (q, pick) => {
    const len = q.options.map((o) => [...o].length);
    const m = pick(...len);
    return len[q.answer] === m && len.filter((x) => x === m).length === 1;
  };
  for (const [name, qs] of [['assessment', mysqlPack.assessment.questions], ['all questions', [...mysqlPack.assessment.questions, ...mysqlPack.nodes.flatMap((n) => n.lesson.quiz)]]]) {
    const longest = qs.filter((q) => uniqueExtreme(q, Math.max)).map((q) => q.id);
    const shortest = qs.filter((q) => uniqueExtreme(q, Math.min)).map((q) => q.id);
    assert.ok(longest.length / qs.length <= 0.4, `${name}: correct option is the unique longest in ${longest.length}/${qs.length}: ${longest.join(' ')}`);
    assert.ok(shortest.length / qs.length <= 0.4, `${name}: correct option is the unique shortest in ${shortest.length}/${qs.length}: ${shortest.join(' ')}`);
  }
});
