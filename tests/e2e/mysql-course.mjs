// Headless smoke for the course 会计人的 MySQL and the code-block rendering.
// Not part of `node --test` (needs Chrome). Run from web/:  node tests/e2e/mysql-course.mjs
//
// Covers: the course is listed under 学一个主题; setup -> assessment -> result
// -> path -> a lesson with code blocks and query results -> its quiz (with
// code) -> pass. Code blocks are text only (an injected pack string with markup
// stays text), they scroll inside themselves and the page never overflows at
// 360/375 px, light and dark. Another course's saved progress is untouched.
// No external requests, no console errors.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openPage } from './cdp.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = process.env.OUT || path.join(os.tmpdir(), 'hourlog-e2e-mysql');
fs.mkdirSync(OUT, { recursive: true });
const H = `const k=(x)=>document.querySelector('[data-key="'+x+'"]'); const $=(s)=>document.querySelector(s); const tick=()=>new Promise(r=>setTimeout(r,60));`;
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
const ID = 'mysql-for-accounting';

const env = await launch({ webDir: WEB });
let p;
try {
  p = await openPage(env.cdpPort, { lang: 'zh-CN' });
  await p.size(375, 812);
  await p.goto(env.base);
  // Existing progress in another course (Release A v1 payload) must survive untouched.
  const v1 = JSON.parse(fs.readFileSync(path.join(WEB, 'tests/fixtures/learning-v1.json'), 'utf8'));
  await p.eval(`localStorage.clear(); localStorage.setItem('hourlog.tipSeen','1'); localStorage.setItem('hourlog.learning', ${JSON.stringify(JSON.stringify(v1))});`);
  await p.reload();
  const pack = await p.eval(`return (await import('./courses/${ID}.js')).default;`);
  const course = (id = ID) => p.eval(`return (JSON.parse(localStorage.getItem('hourlog.learning')||'{}').courses||{})['${id}']`);

  // ---- listed, setup
  await p.eval(`${H} $('#tabLearn').click(); await new Promise(r=>setTimeout(r,400)); k('type-topic').click(); await tick();`);
  check('listed under 学一个主题', (await p.eval(`return document.querySelector('#learnRoot').innerText`)).includes('会计人的 MySQL'));
  await p.eval(`${H} k('open-${ID}').click(); await tick();`);
  await p.shot(path.join(OUT, '01-setup.png'), true);
  const setupText = await p.eval(`return document.querySelector('#learnRoot').innerText`);
  check('setup shows the three goal levels', ['看得懂', '能自己写简单查询', '能指挥 AI 并把关'].every((s) => setupText.includes(s)));
  await p.eval(`${H} k('setup-go').click(); await tick();`);
  check('setup saved', !!(await course())?.setup);

  // ---- assessment: the first six right (db-basics .. joins), the rest wrong
  const right = new Set(['mya-q1', 'mya-q2', 'mya-q3', 'mya-q4', 'mya-q5', 'mya-q6']);
  const qs = pack.assessment.questions;
  for (const [i, q] of qs.entries()) {
    if (q.code) check(`assessment ${q.id} shows its code`, (await p.eval(`return [...document.querySelectorAll('.ln-q .ln-code')].some(e => e.textContent === ${JSON.stringify(q.code)})`)));
    const pick = right.has(q.id) ? q.answer : (q.answer + 1) % q.options.length;
    await p.eval(`${H} k('aq-${q.id}-${pick}').click(); await tick();`);
    if (i < qs.length - 1) await p.eval(`${H} k('aq-next').click(); await tick();`);
  }
  await p.eval(`${H} k('aq-finish').click(); await tick();`);
  await p.shot(path.join(OUT, '02-result.png'), true);
  const res = await p.eval(`return document.querySelector('#learnRoot').innerText`);
  check('result per dimension', ['概念理解', '读懂 SQL', '会计应用', 'AI 协作'].every((d) => res.includes(d)));

  // ---- path: assessed early nodes mastered; first non-mastered required node current
  await p.eval(`${H} k('see-path').click(); await tick();`);
  const st = await p.eval(`return Object.fromEntries([...document.querySelectorAll('.ln-node')].map(li => [li.querySelector('[data-key]').dataset.key.slice(5), li.className.replace('ln-node ','')]))`);
  check('path: skipped nodes mastered, setup current', st['db-basics'] === 'mastered' && st.joins === 'mastered' && st.setup === 'current' && st['vouchers-gl'] === 'todo', JSON.stringify(st));
  check('path: AI stage optional at the default goal', ['read-complex', 'prompt-ai', 'check-ai'].every((id) => String(st[id]).includes('optional')), JSON.stringify(st));
  await p.shot(path.join(OUT, '03-path.png'), true);

  // ---- a lesson with code blocks and results (ar-ap), all parts revealed
  await p.eval(`${H} k('node-ar-ap').click(); await tick(); for (let i=0;i<6;i++){const b=k('next-part'); if(b) b.click(); await tick();}`);
  const node = pack.nodes.find((n) => n.id === 'ar-ap');
  const items = node.lesson.sections.flatMap((s) => s.body.filter((b) => typeof b !== 'string'));
  const dom = await p.eval(`return { pre: [...document.querySelectorAll('.ln-step .ln-code')].map(e => e.textContent), tables: document.querySelectorAll('.ln-step .ln-result-table').length,
    firstRows: document.querySelector('.ln-step .ln-result-table') ? document.querySelector('.ln-step .ln-result-table').tBodies[0].rows.length : -1,
    focusable: [...document.querySelectorAll('.ln-code, .ln-result-wrap')].every(e => e.tabIndex === 0) }`);
  check('lesson: every code block rendered verbatim', dom.pre.length === items.length && items.every((it, i) => dom.pre[i] === it.code), `${dom.pre.length}/${items.length}`);
  check('lesson: every result rendered as a table', dom.tables === items.filter((it) => it.result).length && dom.firstRows === items[0].result.split('\n').length - 1, JSON.stringify(dom));
  check('code and result regions are keyboard-focusable (scrollable)', dom.focusable);
  const style = await p.eval(`const e=document.querySelector('.ln-step .ln-code'); const cs=getComputedStyle(e); return { ws: cs.whiteSpace, ox: cs.overflowX, ff: cs.fontFamily, wide: e.scrollWidth > e.clientWidth }`);
  check('code block: monospace, pre, scrolls sideways inside itself', style.ws === 'pre' && style.ox === 'auto' && /mono|Menlo|SF Mono/i.test(style.ff) && style.wide, JSON.stringify(style));

  // contrast of code text on its background, light and dark
  const contrast = () => p.eval(`
    const lum = (c) => { const [r,g,b] = c.match(/[0-9.]+/g).slice(0,3).map(Number).map(v => { v/=255; return v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4; }); return 0.2126*r + 0.7152*g + 0.0722*b; };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const pre = getComputedStyle(document.querySelector('.ln-code')); const th = getComputedStyle(document.querySelector('.ln-result-table th'));
    const td = document.createElement('td'); td.className = 'null'; td.textContent = 'NULL'; document.querySelector('.ln-result-table tbody tr').append(td);
    const wrap = getComputedStyle(document.querySelector('.ln-result-wrap')); const nul = ratio(getComputedStyle(td).color, wrap.backgroundColor); td.remove();
    return { code: ratio(pre.color, pre.backgroundColor), th: ratio(th.color, th.backgroundColor), nul };`);

  // ---- widths and dark mode
  for (const dark of [false, true]) {
    await p.dark(dark);
    for (const w of [360, 375]) {
      await p.size(w, 812); await p.wait(150);
      const m = await p.eval(`const mn=document.querySelector('main'); return [document.documentElement.scrollWidth, document.documentElement.clientWidth, mn.scrollWidth, mn.clientWidth]`);
      check(`no horizontal page overflow ${w}px ${dark ? 'dark' : 'light'}`, m[0] <= m[1] && m[2] <= m[3], m.join('/'));
    }
    const c = await contrast();
    check(`AA contrast ${dark ? 'dark' : 'light'} (code ${c.code.toFixed(1)}, header ${c.th.toFixed(1)}, NULL ${c.nul.toFixed(1)})`, c.code >= 4.5 && c.th >= 4.5 && c.nul >= 4.5);
    await p.eval(`document.querySelector('.ln-step .ln-code-item').scrollIntoView();`);
    await p.shot(path.join(OUT, `04-lesson-${dark ? 'dark' : 'light'}.png`));
    await p.shot(path.join(OUT, `04-lesson-${dark ? 'dark' : 'light'}-full.png`), true);
  }
  await p.dark(false); await p.size(375, 812);

  // ---- quiz with code: pass
  for (const q of node.lesson.quiz) await p.eval(`${H} k('qz-${q.id}-${q.answer}').click(); await tick();`);
  check('quiz questions show their code', (await p.eval(`return document.querySelectorAll('#ln-quiz .ln-q .ln-code').length`)) === node.lesson.quiz.filter((q) => q.code).length);
  await p.eval(`${H} k('quiz-submit').click(); await tick();`);
  await p.wait(300);
  check('quiz pass masters the node', (await course()).nodes['ar-ap']?.masteredBy === 'quiz');
  await p.shot(path.join(OUT, '05-quiz.png'), true);

  // ---- other course untouched
  const other = await course('video-editing-basics');
  const before = v1.courses['video-editing-basics'];
  check('video-editing-basics progress untouched', JSON.stringify(other.nodes) === JSON.stringify(before.nodes) && JSON.stringify(other.setup) === JSON.stringify({ ...before.setup, examDate: other.setup.examDate }) && other.currentOverride === before.currentOverride);

  check('no external requests', p.requests.every((u) => u.startsWith(env.origin) || u.startsWith('data:') || u === 'about:blank'), p.requests.filter((u) => !u.startsWith(env.origin)).join(' '));
  check('no console errors or warnings', p.consoleMsgs.length === 0, p.consoleMsgs.join(' | '));
} catch (e) {
  check('journey completed', false, e.stack);
} finally {
  if (p) p.close();
  env.stop();
}

// ---- markup in pack code stays text: serve a copy of web/ whose pack has markup in a code block, a result and a question
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hourlog-xss-'));
  const copy = path.join(tmp, 'web');
  fs.cpSync(WEB, copy, { recursive: true, filter: (f) => !f.includes(`${path.sep}.git`) });
  const pf = path.join(copy, 'courses', `${ID}.js`);
  let src = fs.readFileSync(pf, 'utf8');
  const evil = '<img src=x onerror="window.__pwn=1"><script>window.__pwn=2</script>';
  src = src.replace('{ code: `SELECT * FROM departments;`,\n                result: \'', `{ code: \`${evil}\`,\n                result: '<b onmouseover=window.__pwn=3>x</b>\\tcol2\\n`);
  src = src.replace("code: `SELECT * FROM departments;`,\n            options", `code: \`${evil}\`,\n            options`);
  fs.writeFileSync(pf, src);
  const env2 = await launch({ webDir: copy });
  let q;
  try {
    q = await openPage(env2.cdpPort, { lang: 'zh-CN' });
    await q.size(375, 812);
    await q.goto(env2.base);
    const state = { v: 2, courses: { [ID]: { packType: 'topic', setup: { goalLevel: 2, weeklyTarget: 3, examDate: null }, assessment: { answers: {}, completedAt: 1, selfRatings: {}, seed: 1 }, nodes: {}, currentOverride: null, completions: [], notebook: {}, mock: { active: null, history: [] }, plan: null } } };
    await q.eval(`localStorage.clear(); localStorage.setItem('hourlog.tipSeen','1'); localStorage.setItem('hourlog.learning', ${JSON.stringify(JSON.stringify(state))}); window.__pwn = 0;`);
    await q.reload();
    await q.eval(`${H} const until = async (x) => { for (let i = 0; i < 100 && !k(x); i++) await new Promise(r => setTimeout(r, 100)); return k(x); };
      window.__pwn = 0; $('#tabLearn').click(); (await until('type-topic')).click(); await tick(); (await until('open-${ID}')).click(); await tick(); k('see-path')?.click(); await tick(); k('node-db-basics').click(); await tick(); for (let i=0;i<6;i++){const b=k('next-part'); if(b) b.click(); await tick();} await new Promise(r=>setTimeout(r,300));`);
    const r = await q.eval(`return { pwn: window.__pwn, img: document.querySelectorAll('#learnRoot img, #learnRoot script, #learnRoot b').length,
      shown: [...document.querySelectorAll('#learnRoot .ln-code')].filter(e => e.textContent.includes('<img src=x')).length,
      cell: [...document.querySelectorAll('#learnRoot .ln-result-table th')].some(th => th.textContent === '<b onmouseover=window.__pwn=3>x</b>') }`);
    check('markup in pack code, results and question code is shown as text, never run', r.pwn === 0 && r.img === 0 && r.shown === 2 && r.cell, JSON.stringify(r));
    check('xss copy: no console errors', q.consoleMsgs.length === 0, q.consoleMsgs.join(' | '));
  } catch (e) {
    check('xss journey completed', false, e.stack);
  } finally {
    if (q) q.close();
    env2.stop();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.ok || !r.detail ? '' : ' :: ' + r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed. Screenshots: ${OUT}`);
process.exit(failed ? 1 : 0);
