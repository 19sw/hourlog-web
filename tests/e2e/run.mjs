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
  // ---- 0. a Release A (v1) user upgrades: progress survives, payload becomes v2 on the next write
  const v1 = fs.readFileSync(path.join(WEB, 'tests/fixtures/learning-v1.json'), 'utf8');
  await p.eval(`localStorage.setItem('hourlog.learning', ${JSON.stringify(v1)});`);
  await p.reload();
  await p.eval(`${H} $('#tabLearn').click(); await new Promise(r=>setTimeout(r,400));`);
  const upHome = await p.eval(`return document.querySelector('#learnRoot').innerText`);
  check('B AC11 v1 progress shows after the upgrade', upHome.includes('视频剪辑基础') && upHome.includes(((n) => (zh ? `${n}/12` : `${n} of 12`))(Object.values(JSON.parse(v1).courses['video-editing-basics'].nodes).filter((n) => n.masteredAt).length)), upHome.slice(0, 200));
  await p.eval(`${H} k('open-video-editing-basics').click(); await tick();`);
  check('B AC11 v1 prioritized node is still current', (await p.eval(`return document.querySelector('.ln-node.current [data-key]').dataset.key`)) === 'node-' + JSON.parse(v1).courses['video-editing-basics'].currentOverride);
  await p.eval(`${H} k('seg-progress').click(); await tick(); k('adj-plus').click(); await tick();`);
  const upgraded = JSON.parse(await p.eval(`return localStorage.getItem('hourlog.learning')`));
  check('B AC11 first write stores v2 with v1 progress intact', upgraded.v === 2 && JSON.stringify(upgraded.courses['video-editing-basics'].nodes) === JSON.stringify(JSON.parse(v1).courses['video-editing-basics'].nodes) && upgraded.courses['video-editing-basics'].setup.weeklyTarget === 5);
  await p.eval(`localStorage.removeItem('hourlog.learning');`);
  await p.reload();
  await p.eval(`${H} $('#tabLog').click();`);

  const pack = await p.eval(`return (await import('./courses/video-editing-basics.js')).default;`);
  const node = (id) => pack.nodes.find((n) => n.id === id);
  const entries = () => p.eval(`return JSON.parse(localStorage.getItem('hourlog.entries.v1')||'[]')`);
  const course = () => p.eval(`return (JSON.parse(localStorage.getItem('hourlog.learning')||'{}').courses||{})['video-editing-basics']`);
  const T = (zhText, enText) => (zh ? zhText : enText);

  // ---- 1. Learn tab, setup
  await p.eval(`${H} $('#tabLearn').click(); await new Promise(r=>setTimeout(r,300));`);
  check('AC1 three tabs', (await p.eval(`return document.querySelectorAll('.tabs .tab').length`)) === 3);
  await p.eval(`${H} k('type-topic').click(); await tick();`);
  check('AC1 demo course listed under its type', (await p.eval(`return document.querySelector('#learnRoot').innerText`)).includes('视频剪辑基础'));
  await shot(p, '01-home.png');
  await p.eval(`${H} k('open-video-editing-basics').click(); await tick(); k('wk-minus').click(); await tick(); k('setup-go').click(); await tick();`);
  check('AC1 setup saved', (await course())?.setup?.weeklyTarget === 2);

  // ---- 2. assessment (three wrong), double taps ignored, focus moves forward
  const aqOrder = await p.eval(`return [...document.querySelectorAll('[data-key^="aq-"]')].filter(b => b.tagName === 'BUTTON' && /-\\d+$/.test(b.dataset.key)).map(b => +b.dataset.key.split('-').pop()).join('')`);
  check('assessment options shown in a shuffled order (stored by authored index)', aqOrder.length >= 3 && aqOrder !== [...Array(aqOrder.length).keys()].join(''), aqOrder);
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

  // ================================================================ Release B
  const homeLearn = `${H} $('#tabLearn').click(); await new Promise(r=>setTimeout(r,300)); for (let i=0;i<3;i++){const x=k('back'); if(x){x.click(); await tick();}}`;
  const isoPlus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const examPack = await p.eval(`return (await import('./courses/micro-econ-final.js')).default;`);
  const rolePack = await p.eval(`return (await import('./courses/short-video-editor.js')).default;`);
  const learning = () => p.eval(`return JSON.parse(localStorage.getItem('hourlog.learning')||'{"courses":{}}')`);
  const exam = async () => (await learning()).courses['micro-econ-final'];
  const entryCount = async (needle) => (await entries()).filter((e) => e.text.includes(needle)).length;

  // ---- B1 type chooser and grouped list
  await p.eval(homeLearn);
  check('B AC11 home groups started courses by type and offers a type chooser', await p.eval(`return document.querySelectorAll('.ln-group-title').length >= 2 && ['type-topic','type-exam','type-role'].every(x => document.querySelector('[data-key="'+x+'"]'))`));
  await p.eval(`${H} k('type-exam').click(); await tick();`);
  check('B exam list shows the demo notice', (await p.eval(`return document.querySelector('.ln-demo')?.textContent || ''`)).includes('示范'));
  await p.eval(`${H} k('open-micro-econ-final').click(); await tick();`);

  // ---- B2 exam setup: date validation and countdown
  await p.eval(`${H} const i=k('exam-date'); i.value='${isoPlus(-1)}'; i.dispatchEvent(new Event('input')); k('setup-go').click(); await tick();`);
  check('B AC12 past exam date rejected', (await p.eval(`return document.querySelector('.ln-error').textContent`)).length > 0 && (await p.eval(`return document.querySelector('.ln-assess') === null`)));
  await p.eval(`${H} const i=k('exam-date'); i.value=''; i.dispatchEvent(new Event('input')); k('setup-go').click(); await tick();`);
  check('B AC12 empty exam date rejected', (await p.eval(`return !!document.querySelector('.ln-error:not([hidden])')`)));
  await p.eval(`${H} const i=k('exam-date'); i.value='${isoPlus(5)}'; i.dispatchEvent(new Event('input')); await tick();`);
  check('B AC12 countdown preview', (await p.eval(`return document.querySelector('.ln-countdown-inline').textContent`)).includes(T('5 天', '5 days')));
  await p.eval(`${H} k('setup-go').click(); await tick();`);

  // ---- B3 diagnostic (3 wrong), immediate feedback
  const examWrong = ['d-el-calc', 'd-cost', 'd-wf'];
  for (const [i, q] of examPack.assessment.questions.entries()) {
    await p.eval(`${H} k('aq-${q.id}-${examWrong.includes(q.id) ? (q.answer + 1) % q.options.length : q.answer}').click(); await tick();`);
    if (i === 0) check('B diagnostic keeps immediate feedback with explanation', await p.eval(`return !!document.querySelector('.ln-feedback p')`));
    if (i < examPack.assessment.questions.length - 1) await p.eval(`${H} k('aq-next').click(); await tick();`);
  }
  await p.eval(`${H} const b=k('aq-finish'); b.click(); b.click(); await tick();`);
  check('B diagnostic logs exactly one entry', (await entryCount(T('诊断测验', 'diagnostic'))) === 1);
  await shot(p, 'B01-diag-result.png', true);

  // ---- B4 plan: weak first, mock last, behind + re-plan
  await p.eval(`${H} k('see-plan').click(); await tick();`);
  let ex = await exam();
  check('B AC12 plan: 5 days, mock on the last, weakest chapters first', ex.plan.days.length === 5 && ex.plan.days[4].mock && ex.plan.days[0].nodes[0] === 'ch-welfare', JSON.stringify(ex.plan.days.map((d) => d.nodes)));
  check('B countdown shown', (await p.eval(`return document.querySelector('.ln-count').innerText`)).includes('5'));
  await shot(p, 'B02-plan.png', true);
  // pretend the plan was made 3 days ago and nothing was studied
  await p.eval(`const d=JSON.parse(localStorage.getItem('hourlog.learning')); const pl=d.courses['micro-econ-final'].plan;
    const shift=(iso)=>{const [y,m,dd]=iso.split('-').map(Number); const t=new Date(y,m-1,dd-3); return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');};
    pl.from=shift(pl.from); pl.days.forEach(x=>x.date=shift(x.date)); localStorage.setItem('hourlog.learning', JSON.stringify(d));`);
  await p.eval(`${H} k('seg-chapters').click(); await tick(); k('seg-plan').click(); await tick();`);
  check('B AC12 behind the plan is flagged', (await p.eval(`return document.querySelector('.ln-plan .ln-note.warnish')?.textContent || ''`)).length > 0);
  await p.eval(`${H} k('replan').click(); await tick();`);
  ex = await exam();
  check('B AC12 re-plan starts today with the remaining chapters', ex.plan.from === isoPlus(0) && ex.plan.days.length === 5 && ex.plan.days.flatMap((d) => d.nodes).length === 3, JSON.stringify(ex.plan));

  // ---- B5 chapter quiz: fail hides answers, retry shuffles; wrong answers reach the notebook
  await p.eval(`${H} k('seg-chapters').click(); await tick(); k('node-ch-costs').click(); await tick();`);
  check('B exam lesson has key points, mistakes, example, chapter quiz', await p.eval(`return document.querySelectorAll('.ln-part').length >= 4 && !!document.querySelector('.ln-mistakes') && !!document.querySelector('[data-key=reveal]')`));
  const costQ = examPack.nodes.find((n) => n.id === 'ch-costs').lesson.quiz;
  for (const [i, q] of costQ.entries()) await p.eval(`${H} k('qz-${q.id}-${i === 0 ? q.answer : (q.answer + 1) % q.options.length}').click(); await tick();`);
  await p.eval(`${H} const b=k('quiz-submit'); b.click(); b.click(); await tick();`);
  const leakB = await p.eval(`const q=document.querySelector('#ln-quiz'); return { expl: q.querySelectorAll('.ln-feedback p').length, right: q.querySelectorAll('.ln-opt.right').length }`);
  check('B F3 on chapter quizzes: failed attempt reveals no answers', leakB.expl === 0 && leakB.right === 1, JSON.stringify(leakB));
  await p.eval(`${H} k('quiz-retry').click(); await tick();`);
  const ord = await p.eval(`return [...document.querySelectorAll('input[name="qz-${costQ[1].id}"]')].map(i => +i.dataset.key.split('-').pop()).join()`);
  check('B F3 chapter quiz retry shuffles', ord !== costQ[1].options.map((_, j) => j).join(), ord);
  ex = await exam();
  check('B AC13 notebook: 3 diagnostic + 2 chapter-quiz wrongs', Object.values(ex.notebook).filter((x) => x.source === 'diagnostic').length === 3 && Object.values(ex.notebook).filter((x) => x.source === 'quiz').length === 2);

  // ---- B6 notebook redo: wrong stays (no reveal), right removes
  await p.eval(`${H} k('back').click(); await tick(); k('seg-notebook').click(); await tick(); k('nb-start').click(); await tick();`);
  const firstNb = await p.eval(`return document.querySelector('[data-key^="nb-"][type=radio]').dataset.key.split('-').slice(1, -1).join('-')`);
  const all = new Map([...examPack.assessment.questions, ...examPack.nodes.flatMap((n) => n.lesson.quiz), ...examPack.exam.mock.questions].map((q) => [q.id, q]));
  const nq = all.get(firstNb);
  await p.eval(`${H} k('nb-${nq.id}-${(nq.answer + 1) % nq.options.length}').click(); await tick(); k('nb-check').click(); await tick();`);
  ex = await exam();
  check('B AC13 redo wrong keeps the question, no answer shown', nq.id in ex.notebook && (await p.eval(`return document.querySelectorAll('.ln-redo .ln-feedback p').length`)) === 0);
  await p.eval(`${H} k('nb-retry').click(); await tick(); k('nb-${nq.id}-${nq.answer}').click(); await tick(); k('nb-check').click(); await tick();`);
  ex = await exam();
  check('B AC13 redo right removes it', !(nq.id in ex.notebook) && Object.keys(ex.notebook).length === 4);
  await shot(p, 'B03-notebook.png', true);

  // ---- B7 mock: timer keeps running across reload, auto-submit at zero, one entry per submit
  await p.eval(`${H} k('seg-mock').click(); await tick(); const b=k('mock-start'); b.click(); await tick();`);
  const mq = examPack.exam.mock.questions;
  for (const q of mq.slice(0, 7)) await p.eval(`${H} k('mk-${q.id}-${q.answer}').click(); await tick();`);
  const startedAt = (await exam()).mock.active.startedAt;
  await p.reload();
  await p.eval(`${H} $('#tabLearn').click(); await new Promise(r=>setTimeout(r,300)); k('open-micro-econ-final').click(); await tick(); k('seg-mock').click(); await tick(); await new Promise(r=>setTimeout(r,1200));`);
  check('B AC14 reload keeps the attempt, answers and start time', (await exam()).mock.active?.startedAt === startedAt && Object.keys((await exam()).mock.active.answers).length === 7);
  const t1 = await p.eval(`return document.querySelector('[data-key=mock-timer]').textContent`);
  await p.wait(1500);
  const t2 = await p.eval(`return document.querySelector('[data-key=mock-timer]').textContent`);
  check('B AC14 visible timer counts down', t1 !== t2 && /^\d\d:\d\d$/.test(t2), `${t1} -> ${t2}`);
  await shot(p, 'B04-mock-running.png');
  // the learner "left" for 21 minutes
  await p.eval(`const d=JSON.parse(localStorage.getItem('hourlog.learning')); d.courses['micro-econ-final'].mock.active.startedAt -= 21*60e3; localStorage.setItem('hourlog.learning', JSON.stringify(d));`);
  await p.wait(2300); // the 1 s ticker sees the stored start time... from memory, so also simulate a return to the tab
  await p.eval(`document.dispatchEvent(new Event('visibilitychange')); await new Promise(r=>setTimeout(r,1200));`);
  ex = await exam();
  check('B AC14 auto-submitted at zero with one timeline entry', ex.mock.active === null && ex.mock.history.length === 1 && (await entryCount(T('模拟考', 'mock exam'))) === 1, JSON.stringify(ex.mock.history.map((h) => h.correct)));
  const res = await p.eval(`return document.querySelector('.ln-mock-result').innerText`);
  check('B AC14 result: total, per-chapter, revisit list (< 60%)', res.includes('7') && (await p.eval(`return document.querySelectorAll('.ln-mock-result .ln-chart-text li').length`)) === 7 && (await p.eval(`return document.querySelectorAll('.ln-mock-result .ln-nodes li').length`)) === 4);
  await shot(p, 'B05-mock-result.png', true);
  // retake: options appear in a new order per attempt (stable across reload); hand-in asks first while questions are unanswered
  await p.eval(`${H} k('mock-start').click(); await tick();`);
  const dispOrder = () => p.eval(`return ${JSON.stringify(mq.map((q) => q.id))}.map(id => [...document.querySelectorAll('input[name="mk-' + id + '"]')].map(i => +i.dataset.key.split('-').pop()).join(''))`);
  const o1 = await dispOrder();
  check('B R3 mock options shuffled for this attempt', o1.filter((o) => o !== '0123').length >= 10, o1.join(' '));
  for (const q of mq.slice(0, 3)) await p.eval(`${H} k('mk-${q.id}-${q.answer}').click(); await tick();`);
  await p.reload();
  await p.eval(`${H} $('#tabLearn').click(); await new Promise(r=>setTimeout(r,300)); k('open-micro-econ-final').click(); await tick(); k('seg-mock').click(); await tick();`);
  check('B R3 attempt order stable across reload', (await dispOrder()).join() === o1.join());
  await p.eval(`${H} k('mock-submit').click(); await tick();`);
  const conf = await p.eval(`return { open: document.getElementById('lnConfirm').open, body: document.getElementById('lnConfirmBody').textContent }`);
  check('PM hand-in with unanswered questions asks and says how many', conf.open && conf.body.includes('12'), JSON.stringify(conf));
  await p.eval(`${H} $('#lnConfirmCancel').click(); await tick();`);
  check('PM cancel keeps the attempt running', (await exam()).mock.active !== null);
  for (const q of mq.slice(3)) await p.eval(`${H} k('mk-${q.id}-${q.answer}').click(); await tick();`);
  await p.eval(`${H} const b=k('mock-submit'); b.click(); b.click(); await tick();`);
  check('PM all answered: hands in directly, no confirmation', !(await p.eval(`return document.getElementById('lnConfirm').open`)));
  ex = await exam();
  check('B AC14 retake: 15/15, revisit none, exactly one more entry', ex.mock.history.length === 2 && ex.mock.history[1].correct === 15 && (await entryCount(T('模拟考', 'mock exam'))) === 2 && (await p.eval(`return document.querySelectorAll('.ln-mock-result .ln-nodes li').length`)) === 0);

  // ---- B7b m7 time announcements, m8 back label, m1 exam day, R1 stale ids, render error boundary
  await p.eval(`${H} k('mock-start').click(); await tick();`);
  await p.eval(`const d=JSON.parse(localStorage.getItem('hourlog.learning')); d.courses['micro-econ-final'].mock.active.startedAt = Date.now() - 15*60e3 + 3000; localStorage.setItem('hourlog.learning', JSON.stringify(d));`);
  await p.eval(`document.dispatchEvent(new Event('visibilitychange')); await new Promise(r=>setTimeout(r,500));`);
  check('B m7 no announcement before 5 minutes', (await p.eval(`return document.querySelector('[data-key=mock-announce]').textContent`)) === '');
  await p.wait(4500);
  check('B m7 announces 5 minutes left once', (await p.eval(`return document.querySelector('[data-key=mock-announce]').textContent`)) === T('还剩 5 分钟。', '5 minutes left.'));
  check('B m7 visible clock is not a live region', (await p.eval(`return document.querySelector('[data-key=mock-timer]').getAttribute('aria-live')`)) === 'off');
  await p.eval(`${H} k('mock-submit').click(); await tick(); $('#lnConfirmOk').click(); await tick();`);
  check('B one entry per hand-in (3 attempts)', (await entryCount(T('模拟考', 'mock exam'))) === 3);
  await p.eval(`${H} k('seg-chapters').click(); await tick(); k('node-ch-costs').click(); await tick();`);
  check('B m8 exam lesson back button names Chapters', (await p.eval(`return document.querySelector('[data-key=back]').textContent`)).includes(T('返回章节', 'Back to chapters')));
  // R1: a saved plan pointing at a chapter the pack no longer has
  await p.eval(`const d=JSON.parse(localStorage.getItem('hourlog.learning')); const c=d.courses['micro-econ-final']; c.plan.from='2020-01-01'; c.plan.days[0].date='2020-01-01'; c.plan.days[0].nodes.unshift('ch-sd'); c.notebook['q-gone']={source:'quiz',addedAt:1}; c.currentOverride='ch-sd'; localStorage.setItem('hourlog.learning', JSON.stringify(d));`);
  await p.eval(`${H} k('back').click(); await tick(); k('seg-plan').click(); await tick();`);
  const r1 = await p.eval(`return { plan: !!document.querySelector('.ln-plan'), err: !!document.querySelector('[data-key=view-error]'), text: document.querySelector('#learnRoot').innerText.length }`);
  check('B R1 stale chapter id in the saved plan: plan still renders', r1.plan && !r1.err && r1.text > 100, JSON.stringify(r1));
  await p.eval(`${H} k('seg-notebook').click(); await tick();`);
  check('B R1 stale notebook id ignored', (await p.eval(`return document.querySelectorAll('.ln-nb-list li').length`)) === Object.keys((await exam()).notebook).filter((k) => k !== 'q-gone').length);
  // error boundary: force an unexpected exception while rendering the exam course
  await p.eval(`${H} window.__fmtDesc = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, 'format'); Object.defineProperty(Intl.DateTimeFormat.prototype, 'format', { configurable: true, get() { throw new Error('injected test failure'); } }); k('seg-plan').click(); await tick();`);
  const eb = await p.eval(`return { err: !!document.querySelector('[data-key=view-error]'), home: !!document.querySelector('[data-key=type-exam]'), reset: !!document.querySelector('[data-key=view-error-reset]') }`);
  check('B R1 render error falls back to the course list with a message and a reset option', eb.err && eb.home && eb.reset, JSON.stringify(eb));
  await p.eval(`Object.defineProperty(Intl.DateTimeFormat.prototype, 'format', window.__fmtDesc);`);
  // m1: exam day still offers "change exam date"
  await p.eval(`const d=JSON.parse(localStorage.getItem('hourlog.learning')); d.courses['micro-econ-final'].setup.examDate='${isoPlus(0)}'; localStorage.setItem('hourlog.learning', JSON.stringify(d));`);
  await p.eval(`${homeLearn} k('open-micro-econ-final').click(); await tick(); k('seg-plan').click(); await tick();`);
  check('B m1 exam day: change date available', await p.eval(`return !!document.querySelector('[data-key=change-goal]') && !document.querySelector('[data-key=replan]')`));
  await p.eval(`const d=JSON.parse(localStorage.getItem('hourlog.learning')); d.courses['micro-econ-final'].setup.examDate='${isoPlus(-3)}'; localStorage.setItem('hourlog.learning', JSON.stringify(d));`);
  await p.eval(`${H} k('seg-chapters').click(); await tick(); k('seg-plan').click(); await tick(); k('change-goal').click(); await tick();`);
  await p.eval(`${H} const i=k('exam-date'); i.value='${isoPlus(5)}'; i.dispatchEvent(new Event('input')); k('setup-go').click(); await tick();`);
  check('B m1 after the exam: a new date can be set and the plan is rebuilt', (await exam()).setup.examDate === isoPlus(5) && (await exam()).plan.exam === isoPlus(5));

  // P3: completed diagnostic but no exam date -> date setup, not the error fallback
  await p.eval(`const d=JSON.parse(localStorage.getItem('hourlog.learning')); d.courses['micro-econ-final'].setup.examDate=null; localStorage.setItem('hourlog.learning', JSON.stringify(d));`);
  await p.eval(`${H} document.dispatchEvent(new Event('visibilitychange')); await tick();`); // re-render the open exam course
  check('B P3 missing exam date opens the date setup', await p.eval(`return !!document.querySelector('[data-key=exam-date]') && !document.querySelector('[data-key=view-error]')`));
  await p.eval(`${H} const i=k('exam-date'); i.value='${isoPlus(5)}'; i.dispatchEvent(new Event('input')); k('setup-go').click(); await tick();`);
  check('B P3 after setting a date the plan is back', await p.eval(`return !!document.querySelector('.ln-plan')`));

  // ---- B8 role: self-rating, gap, path, map -> ability -> node, shared node with separate progress
  await p.eval(`${homeLearn} k('type-role').click(); await tick(); k('open-short-video-editor').click(); await tick(); k('setup-go').click(); await tick();`);
  check('B role: continue disabled until every ability is rated', await p.eval(`return document.querySelector('[data-key=self-continue]').disabled === true`));
  const rates = { 'ab-brief': 3, 'ab-material': 2, 'ab-edit': 1, 'ab-story': 3, 'ab-audio': 2, 'ab-visual': 0, 'ab-delivery': 1 };
  for (const [a, v] of Object.entries(rates)) await p.eval(`${H} k('self-${a}-${v}').click(); await tick();`);
  await shot(p, 'B06-selfrate.png', true);
  await p.eval(`${H} k('self-continue').click(); await tick();`);
  for (const [i, q] of rolePack.assessment.questions.entries()) {
    await p.eval(`${H} k('aq-${q.id}-${q.id === 'r-story' ? (q.answer + 1) % q.options.length : q.answer}').click(); await tick();`);
    if (i < rolePack.assessment.questions.length - 1) await p.eval(`${H} k('aq-next').click(); await tick();`);
  }
  await p.eval(`${H} k('aq-finish').click(); await tick();`);
  const gapText = await p.eval(`return document.querySelector('.ln-result').innerText`);
  check('B AC15 gap: self 3 capped at 1 by a wrong answer', gapText.includes(T('镜头与节奏：岗位要求 3 级，你现在 1 级，差距 2', '镜头与节奏: job needs level 3, you are at 1, gap 2')), gapText.slice(0, 400));
  const role = (await learning()).courses['short-video-editor'];
  check('B AC15 gap <= 0 masters nodes (brief, workflow, audio)', ['brief', 'workflow', 'audio'].every((id) => role.nodes[id]?.masteredBy === 'assessment') && !role.nodes.timeline?.masteredAt);
  await p.eval(`${H} k('see-path').click(); await tick();`);
  const rp = await p.eval(`return [...document.querySelectorAll('.ln-node [data-key]')].map(b => b.dataset.key.slice(5))`);
  check('B AC15 path: biggest gap first, prerequisites respected', rp.indexOf('workflow') < rp.indexOf('timeline') && rp.indexOf('timeline') < rp.indexOf('cut-points') && rp.indexOf('timeline') < rp.indexOf('export') && rp[rp.length - 1] === 'brief', rp.join(' '));
  check('B AC15 current is the first eligible gap lesson', (await p.eval(`return document.querySelector('.ln-node.current [data-key]').dataset.key`)) === 'node-timeline');
  await p.eval(`${H} k('seg-map').click(); await tick(); k('task-t-polish').click(); await tick();`);
  check('B AC15 map: task shows outputs and abilities', await p.eval(`return document.querySelectorAll('.ln-task-body .ln-outputs li').length === 3 && !!document.querySelector('[data-key="ab-t-polish-ab-visual"]')`));
  await p.eval(`${H} k('ab-t-polish-ab-visual').click(); await tick();`);
  check('B AC15 ability: what, practice, linked nodes', await p.eval(`return document.querySelectorAll('.ln-ability .ln-part').length === 4 && ['subtitles','color','packaging'].every(x => document.querySelector('[data-key="node-'+x+'"]'))`));
  await shot(p, 'B07-ability.png', true);
  await p.eval(`${H} k('node-subtitles').click(); await tick();`);
  check('B AC16 shared lesson labelled', (await p.eval(`return document.querySelector('.ln-shared')?.textContent || ''`)).includes('视频剪辑基础'));
  const sq = await p.eval(`return (await import('./courses/video-editing-basics.js')).default.nodes.find(n => n.id === 'subtitles').lesson.quiz`);
  const veBefore = JSON.stringify((await learning()).courses['video-editing-basics']?.nodes?.subtitles ?? null);
  for (const q of sq) await p.eval(`${H} k('qz-${q.id}-${q.answer}').click(); await tick();`);
  await p.eval(`${H} k('quiz-submit').click(); await tick();`);
  const L2 = await learning();
  check('B AC16 shared node: role progress separate from the topic course', L2.courses['short-video-editor'].nodes.subtitles?.masteredBy === 'quiz' && JSON.stringify(L2.courses['video-editing-basics']?.nodes?.subtitles ?? null) === veBefore);
  await p.eval(`${H} k('back').click(); await tick(); k('seg-progress').click(); await tick();`);
  check('B AC15 progress: required-vs-current per ability with text', (await p.eval(`return document.querySelectorAll('.ln-progress .ln-panel')[1].querySelectorAll('.ln-chart-text li').length`)) === 7);
  await shot(p, 'B08-role-progress.png', true);

  // ---- B9 widths for the new views
  for (const w of [360, 375]) {
    await p.size(w, 812);
    for (const [name, expr] of [
      ['home', homeLearn],
      ['exam-plan', `${homeLearn} k('open-micro-econ-final').click(); await tick(); k('seg-plan').click(); await tick();`],
      ['exam-notebook', `${homeLearn} k('open-micro-econ-final').click(); await tick(); k('seg-notebook').click(); await tick(); k('nb-start').click(); await tick();`],
      ['exam-mock', `${homeLearn} k('open-micro-econ-final').click(); await tick(); k('seg-mock').click(); await tick();`],
      ['exam-lesson', `${homeLearn} k('open-micro-econ-final').click(); await tick(); k('seg-chapters').click(); await tick(); k('node-ch-welfare').click(); await tick(); const r=k('reveal'); if(r) r.click(); await tick();`],
      ['role-map', `${homeLearn} k('open-short-video-editor').click(); await tick(); k('seg-map').click(); await tick(); k('task-t-deliver').click(); await tick();`],
      ['role-progress', `${homeLearn} k('open-short-video-editor').click(); await tick(); k('seg-progress').click(); await tick();`],
    ]) {
      await p.eval(expr);
      const m = await p.eval(`const mn=document.querySelector('main'); return [document.documentElement.scrollWidth, document.documentElement.clientWidth, mn.scrollWidth, mn.clientWidth]`);
      check(`B AC9 no overflow ${w} ${name}`, m[0] <= m[1] && m[2] <= m[3], m.join('/'));
      const small = await p.eval(`return [...document.querySelectorAll('#learnRoot button, #learnRoot label, #learnRoot summary')].filter(e=>e.offsetParent).map(e=>[e.dataset.key||e.tagName, e.getBoundingClientRect()]).filter(([,r])=>r.height<44||r.width<44).map(([k])=>k)`);
      check(`B tap targets >= 44px ${w} ${name}`, small.length === 0, small.join(' '));
    }
  }
  await p.size(375, 812);
  await p.eval(homeLearn);
  await shot(p, 'B09-home-grouped.png', true);

  // ---- 9. reset with confirmation keeps entries
  const n = (await entries()).length;
  await p.eval(`${H} $('#tabLearn').click(); await tick(); for (let i=0;i<2;i++){const x=k('back'); if(x){x.click(); await tick();}} k('open-video-editing-basics').click(); await tick(); k('seg-progress').click(); await tick(); k('reset').click(); await tick();`);
  check('AC11 reset asks first', await p.eval(`return document.getElementById('lnConfirm').open`));
  await p.eval(`${H} $('#lnConfirmOk').click(); await tick();`);
  check('AC11 reset clears course, keeps entries', !(await course()) && (await entries()).length === n);

  check('AC9 no external requests', p.requests.every((u) => u.startsWith(env.origin) || u.startsWith('data:') || u === 'about:blank'), p.requests.filter((u) => !u.startsWith(env.origin)).join(' '));
  const unexpected = p.consoleMsgs.filter((m) => !m.includes('injected test failure'));
  check('no console errors (other than the injected one)', unexpected.length === 0, unexpected.join(' | '));
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
