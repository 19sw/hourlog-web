// Headless end-to-end journey for the Learn tab (and its timeline integration).
// Not part of `node --test`. See README.md in this folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, openPage } from './cdp.mjs';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = process.env.OUT || path.join(os.tmpdir(), 'hourlog-e2e-shots');
const LANG = process.env.LANG_UI || 'zh-CN';
fs.mkdirSync(OUT, { recursive: true });
const zh = LANG.startsWith('zh');

const H = `const k=(x)=>document.querySelector('[data-key="'+x+'"]'); const $=(s)=>document.querySelector(s); const tick=()=>new Promise(r=>setTimeout(r,60));`;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };
const shot = (p, name, tall) => p.shot(path.join(OUT, name), tall);

const env = await launch({ webDir: WEB });
let p;
try {
  p = await openPage(env.cdpPort, { lang: LANG });
  await p.send('Browser.grantPermissions', { origin: env.origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
  await p.size(375, 812);
  await p.goto(env.base);
  await p.eval(`localStorage.clear(); localStorage.setItem('hourlog.tipSeen','1');
    localStorage.setItem('hourlog.entries.v1', JSON.stringify([{id:'pre1',text:'old entry',timestamp:Date.now()-3600e3}]));`);
  await p.reload();
  const pack = await p.eval(`return (await import('./courses/video-editing-basics.js')).default;`);
  const node = (id) => pack.nodes.find((n) => n.id === id);
  const entries = () => p.eval(`return JSON.parse(localStorage.getItem('hourlog.entries.v1')||'[]')`);
  const course = () => p.eval(`return (JSON.parse(localStorage.getItem('hourlog.learning')||'{}').courses||{})['video-editing-basics']`);
  const T = (zhText, enText) => (zh ? zhText : enText);

  // ---- 1. Learn tab, setup
  await p.eval(`${H} $('#tabLearn').click(); await new Promise(r=>setTimeout(r,300));`);
  check('AC1 three tabs', (await p.eval(`return document.querySelectorAll('.tabs .tab').length`)) === 3);
  check('AC1 demo course listed', (await p.eval(`return document.querySelector('#learnRoot').innerText`)).includes('视频剪辑基础'));
  await shot(p, '01-home.png');
  await p.eval(`${H} k('open-video-editing-basics').click(); await tick(); k('wk-minus').click(); await tick(); k('setup-go').click(); await tick();`);
  check('AC1 setup saved', (await course())?.setup?.weeklyTarget === 2);

  // ---- 2. assessment (three wrong), double taps ignored, focus moves forward
  const wrong = ['a-export', 'a-pacing', 'a-subtitles'];
  const qs = pack.assessment.questions;
  for (const [i, q] of qs.entries()) {
    const pick = wrong.includes(q.id) ? (q.answer + 1) % q.options.length : q.answer;
    await p.eval(`${H} k('aq-${q.id}-${pick}').click(); await tick(); const o=k('aq-${q.id}-${(pick + 1) % q.options.length}'); if (o && !o.disabled) o.click(); await tick();`);
    if (i === 0) {
      check('AC2 immediate feedback with explanation', await p.eval(`return !!document.querySelector('.ln-feedback p')`));
      check('F4 focus moves to next-question button', (await p.eval(`return document.activeElement && document.activeElement.dataset.key`)) === 'aq-next');
    }
    if (i < qs.length - 1) await p.eval(`${H} k('aq-next').click(); await tick();`);
    else check('F4 focus on finish after last answer', (await p.eval(`return document.activeElement && document.activeElement.dataset.key`)) === 'aq-finish');
  }
  await p.eval(`${H} const b=k('aq-finish'); b.click(); b.click(); await tick();`);
  await shot(p, '02-result.png', true);
  check('AC5 assessment logs exactly one entry', (await entries()).filter((e) => e.text.includes(T('摸底', 'baseline'))).length === 1);
  const resultText = await p.eval(`return document.querySelector('#learnRoot').innerText`);
  check('AC2 per-dimension result', ['概念理解', '操作熟练', '叙事节奏', '声画打磨'].every((d) => resultText.includes(d)) && (await p.eval(`return document.querySelectorAll('.ln-chart-text li').length`)) === 4);

  // ---- 3. path
  await p.eval(`${H} k('see-path').click(); await tick();`);
  const st = await p.eval(`return Object.fromEntries([...document.querySelectorAll('.ln-node')].map(li => [li.querySelector('[data-key]').dataset.key.slice(5), li.className.replace('ln-node ','')]))`);
  check('AC3 statuses', st.specs === 'mastered' && st.workflow === 'current' && st.export === 'todo' && st.transitions === 'todo' && st.color.includes('optional'), JSON.stringify(st));
  check('F4 Path/Progress are toggle buttons', await p.eval(`return !document.querySelector('.ln-seg [role=tab]') && document.querySelector('[data-key=seg-path]').getAttribute('aria-pressed') === 'true'`));
  await shot(p, '03-path.png', true);

  // ---- 4. lesson: copy, checklist, reflection, failed quiz (no reveal), shuffled retry, pass
  await p.eval(`${H} k('next-open').click(); await tick(); for (let i=0;i<6;i++){const b=k('next-part'); if(b) b.click(); await tick();}`);
  await p.eval(`${H} k('copy-0').click(); await new Promise(r=>setTimeout(r,300));`);
  const clip = await p.eval(`try { return await navigator.clipboard.readText(); } catch (e) { return 'ERR ' + e.message; }`);
  check('AC4 copy button', clip.includes(node('workflow').lesson.askQuestions[0]), clip.slice(0, 60));
  await p.eval(`${H} k('chk-workflow-0').click(); await tick(); k('reveal').click(); await tick(); k('rate-1').click(); await tick();`);
  const wq = node('workflow').lesson.quiz;
  const displayOrder = (q) => p.eval(`return [...document.querySelectorAll('input[name="qz-${q.id}"]')].map(i => +i.dataset.key.split('-').pop())`);
  const order1 = await displayOrder(wq[0]);
  check('F3 first attempt in authored order', order1.join() === wq[0].options.map((_, i) => i).join());
  for (const [i, q] of wq.entries()) await p.eval(`${H} k('qz-${q.id}-${i === 0 ? (q.answer + 1) % q.options.length : q.answer}').click(); await tick();`);
  await p.eval(`${H} const b=k('quiz-submit'); b.click(); b.click(); await tick();`);
  await p.wait(400);
  await shot(p, '04-quiz-fail.png');
  check('AC4 fail counted once', (await course()).nodes.workflow.failedAttempts === 1);
  check('AC4 fail says which question was wrong', (await p.eval(`return document.querySelector('.ln-quiz-result').innerText`)).includes(T('第 1 题', 'question 1')));
  const leaked = await p.eval(`const q=document.querySelector('#ln-quiz'); return { right: q.querySelectorAll('.ln-opt.right').length, expl: [...q.querySelectorAll('.ln-feedback p')].length, wrongMarked: q.querySelectorAll('.ln-opt.wrong').length }`);
  check('F3 failed quiz does not reveal correct option or explanation', leaked.expl === 0 && leaked.wrongMarked === 1 && leaked.right === 1 /* only the correctly answered Q2 */, JSON.stringify(leaked));
  check('F4 focus on quiz result after submit', (await p.eval(`return document.activeElement && document.activeElement.dataset.key`)) === 'quiz-result');
  await p.eval(`${H} k('quiz-retry').click(); await tick();`);
  const order2 = await Promise.all(wq.map(displayOrder));
  check('F3 retry shuffles option order', order2.every((o, i) => o.join() !== wq[i].options.map((_, j) => j).join()), JSON.stringify(order2));
  for (const q of wq) await p.eval(`${H} k('qz-${q.id}-${q.answer}').click(); await tick();`);
  await p.eval(`${H} const b=k('quiz-submit'); b.click(); b.click(); await tick();`);
  await p.wait(400);
  await shot(p, '05-quiz-pass.png');
  const cw = await course();
  check('AC4 pass -> mastered, attempts kept', cw.nodes.workflow.masteredBy === 'quiz' && cw.nodes.workflow.failedAttempts === 1);
  check('F3 pass reveals all explanations', (await p.eval(`return document.querySelectorAll('#ln-quiz .ln-feedback p').length`)) >= wq.length);
  const lessonText = T('学习：完成《剪辑流程与素材整理》', 'Study: finished “剪辑流程与素材整理”');
  check('AC5 lesson logs exactly one entry', (await entries()).filter((e) => e.text === lessonText).length === 1);
  check('AC4 next lesson offered', !!(await p.eval(`return document.querySelector('[data-key=go-next]')?.textContent`)));

  // ---- 5. stuck node + progress + adjust + reload
  await p.eval(`${H} k('back').click(); await tick(); k('node-export').click(); await tick();`);
  for (const q of node('export').lesson.quiz) await p.eval(`${H} k('qz-${q.id}-${(q.answer + 1) % q.options.length}').click(); await tick();`);
  await p.eval(`${H} k('quiz-submit').click(); await tick(); k('back').click(); await tick(); k('seg-progress').click(); await tick();`);
  await p.eval(`${H} k('adj-plus').click(); await tick(); k('adj-plus').click(); await tick(); k('prioritize').click(); await tick();`);
  await shot(p, '06-progress.png', true);
  const prog = await p.eval(`return document.querySelector('#learnRoot').innerText`);
  check('AC6 weekly count vs target', prog.includes(T('本周掌握 1/4 节', '1 of 4 lessons mastered this week')));
  check('AC6 stuck list', prog.includes('导出与发布设置'));
  await p.reload();
  await p.eval(`${H} $('#tabLearn').click(); await new Promise(r=>setTimeout(r,300)); k('open-video-editing-basics').click(); await tick();`);
  check('AC6 prioritized node current after reload', (await p.eval(`return document.querySelector('.ln-node.current [data-key]').dataset.key`)) === 'node-export');

  // ---- 6. widths, tap targets, dark
  const widths = [];
  for (const w of [360, 375]) {
    await p.size(w, 812);
    for (const view of ['path', 'progress', 'lesson', 'log', 'timeline']) {
      await p.eval(`${H} const v='${view}';
        if (v==='log') $('#tabLog').click(); else if (v==='timeline') $('#tabTimeline').click(); else {
          $('#tabLearn').click(); await tick(); for (let i=0;i<2;i++){const b=k('back'); if(b){b.click(); await tick();}}
          k('open-video-editing-basics').click(); await tick();
          if (v==='progress') k('seg-progress').click();
          if (v==='lesson') { k('node-cut-points').click(); await tick(); for (let i=0;i<6;i++){const b=k('next-part'); if(b) b.click(); await tick();} }
        } await tick();`);
      const m = await p.eval(`const mn=document.querySelector('main'); return [document.documentElement.scrollWidth, document.documentElement.clientWidth, mn.scrollWidth, mn.clientWidth]`);
      widths.push(`${w} ${view} ${m.join('/')}`);
      check(`AC9 no overflow ${w} ${view}`, m[0] <= m[1] && m[2] <= m[3], m.join('/'));
    }
  }
  const small = await p.eval(`return [...document.querySelectorAll('#learnRoot button, #learnRoot label, .tabs .tab')].filter(e=>e.offsetParent).map(e=>e.getBoundingClientRect()).filter(r=>r.height<44||r.width<44).length`);
  check('tap targets >= 44px', small === 0, String(small));
  await p.size(375, 812);
  await p.dark(true);
  await p.eval(`${H} $('#tabLearn').click(); await tick();`);
  await shot(p, '07-dark-lesson.png');
  await p.dark(false);

  // ---- 7. F2 read-only (state from a newer version)
  const saved = await p.eval(`return localStorage.getItem('hourlog.learning')`);
  await p.eval(`const d=JSON.parse(localStorage.getItem('hourlog.learning')); d.v=99; localStorage.setItem('hourlog.learning', JSON.stringify(d));`);
  await p.reload();
  const nEntries = (await entries()).length;
  await p.eval(`${H} $('#tabLearn').click(); await new Promise(r=>setTimeout(r,300)); k('open-video-editing-basics').click(); await tick(); k('node-transitions').click(); await tick();
    for (const q of [...document.querySelectorAll('#ln-quiz fieldset')]) { const i=q.querySelector('input'); if (i) i.click(); await tick(); }`);
  const roState = await p.eval(`${H} return { banner: !!document.querySelector('#learnRoot .banner.warn'), submit: k('quiz-submit')?.disabled, check: document.querySelector('.ln-check input')?.disabled }`);
  await p.eval(`${H} const b=k('quiz-submit'); if (b) b.click(); await tick();`);
  check('F2 read-only: banner, progress controls disabled', roState.banner && roState.submit === true && roState.check === true, JSON.stringify(roState));
  check('F2 read-only: no timeline entry, storage untouched', (await entries()).length === nEntries && JSON.parse(await p.eval(`return localStorage.getItem('hourlog.learning')`)).v === 99);
  await p.eval(`localStorage.setItem('hourlog.learning', ${JSON.stringify(saved)});`);

  // ---- 8. F1 two tabs: a stale tab must not overwrite newer progress or entries
  await p.reload();
  const b = await openPage(env.cdpPort, { lang: LANG });
  await b.size(375, 812);
  await b.goto(env.base);
  // Simulate a tab frozen in the background: it gets no storage events.
  await b.eval(`window.addEventListener('storage', (e) => e.stopImmediatePropagation(), true);`);
  await b.eval(`${H} $('#tabLearn').click(); await new Promise(r=>setTimeout(r,300)); k('open-video-editing-basics').click(); await tick(); k('node-transitions').click(); await tick();`);
  const tq = node('transitions').lesson.quiz;
  for (const q of tq) await b.eval(`${H} k('qz-${q.id}-${q.answer}').click(); await tick();`);
  // Meanwhile tab A masters two lessons and writes a Log entry.
  await p.eval(`${H} $('#tabLearn').click(); await new Promise(r=>setTimeout(r,300)); k('open-video-editing-basics').click(); await tick();`);
  for (const id of ['transitions', 'pacing']) {
    await p.eval(`${H} if (document.querySelector('.ln-lesson')) { k('back').click(); await tick(); } k('node-${id}').click(); await tick();`);
    for (const q of node(id).lesson.quiz) await p.eval(`${H} k('qz-${q.id}-${q.answer}').click(); await tick();`);
    await p.eval(`${H} k('quiz-submit').click(); await tick();`);
  }
  await p.eval(`${H} $('#tabLog').click(); await tick(); $('#quickText').value='written in tab A'; $('#saveBtn').click(); await tick();`);
  const before = await entries();
  // Stale tab B now submits 'transitions' (already mastered in A), lowers the weekly target and writes a Log entry.
  await b.eval(`${H} k('quiz-submit').click(); await tick();`);
  await b.eval(`${H} k('back').click(); await tick(); k('seg-progress').click(); await tick(); k('adj-minus').click(); await tick();`);
  await b.eval(`${H} $('#tabLog').click(); await tick(); $('#quickText').value='written in tab B'; $('#saveBtn').click(); await tick();`);
  const after = await entries();
  const c = await course();
  check('F1 progress from tab A survives tab B writes', c.nodes.transitions?.masteredBy === 'quiz' && c.nodes.pacing?.masteredBy === 'quiz' && c.nodes.workflow?.masteredBy === 'quiz', JSON.stringify(Object.keys(c.nodes).filter((k) => c.nodes[k].masteredAt)));
  check('F1 tab B change applied on top (weekly 4 -> 3)', c.setup.weeklyTarget === 3, String(c.setup.weeklyTarget));
  check('F1 no duplicate entry for a lesson already mastered in tab A', after.filter((e) => e.text.includes('转场的用法')).length === 1);
  check('F1 entries from both tabs survive', before.every((e) => after.some((x) => x.id === e.id)) && after.some((e) => e.text === 'written in tab B') && after.some((e) => e.text === 'written in tab A') && after.some((e) => e.id === 'pre1'),
    after.map((e) => e.text).join(' | '));
  b.close();

  // ---- 9. reset with confirmation keeps entries
  const n = (await entries()).length;
  await p.eval(`${H} $('#tabLearn').click(); await tick(); for (let i=0;i<2;i++){const x=k('back'); if(x){x.click(); await tick();}} k('open-video-editing-basics').click(); await tick(); k('seg-progress').click(); await tick(); k('reset').click(); await tick();`);
  check('AC11 reset asks first', await p.eval(`return document.getElementById('lnConfirm').open`));
  await p.eval(`${H} $('#lnConfirmOk').click(); await tick();`);
  check('AC11 reset clears course, keeps entries', !(await course()) && (await entries()).length === n);

  check('AC9 no external requests', p.requests.every((u) => u.startsWith(env.origin) || u.startsWith('data:') || u === 'about:blank'), p.requests.filter((u) => !u.startsWith(env.origin)).join(' '));
  check('no console errors', p.consoleMsgs.length === 0, p.consoleMsgs.join(' | '));
  fs.writeFileSync(path.join(OUT, 'widths.txt'), widths.join('\n'));
} catch (e) {
  check('journey completed', false, e.stack);
} finally {
  if (p) p.close();
  env.stop();
}

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.ok || !r.detail ? '' : ' :: ' + r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed. Screenshots: ${OUT}`);
process.exit(failed ? 1 : 0);
