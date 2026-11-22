// Learn tab UI. Browser-only. All pack content is rendered with textContent
// (never innerHTML). State changes go through the pure transitions in
// learn-logic.js; timeline entries are added only when a transition reports a
// first-time event, so re-renders and double taps cannot log twice.

import {
  emptyCourseState, applySetup, setWeeklyTarget, answerAssessment, completeAssessment, resetAssessment,
  assessmentMasteredNodes, dimensionScores, isCorrect, computePath, groupByStage, missingPrereqs,
  setLessonStep, toggleCheck, revealReflection, rateReflection, submitQuiz, weekInterval, masteredThisWeek,
  dimensionProgress, stuckNodes, prioritizeStuck, courseSummary, mascotKey, isMastered, SELF_RATING,
  WEEKLY_MIN, WEEKLY_MAX, shuffleOrder,
} from './learn-logic.js';
import { loadPacks } from '../courses/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Tiny DOM builder. Strings become text nodes; never parses HTML. */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'key') el.dataset.key = v;
      else if (k.startsWith('aria-') || k === 'role' || k.startsWith('data-') || k === 'for') el.setAttribute(k, v === true ? 'true' : String(v));
      else el[k] = v;
    }
  }
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}
function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined) el.setAttribute(k, String(v));
  for (const c of kids.flat()) if (c) el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return el;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = h('textarea', { value: text, readOnly: true, class: 'ln-copy-buf' });
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

const STATUS_ICON = { mastered: '✓', current: '●', todo: '○' };

export function initLearn({ root, scroller, entries, learnStore, t, locale, onTimelineChange, onStorageChange, confirm }) {
  let packs = null;          // null while loading
  let route = { name: 'home' };
  let assessShowing = null;  // question id whose feedback is on screen
  let quizDraft = null;      // { nodeId, answers: [original option index], orders: [[original index per display slot]], grade, newlyMastered }
  let setupDraft = null;     // { packId, goal, weekly } so a background re-render keeps unsaved choices
  let flash = null;          // { key, text } one-shot status message
  let loaded = false;

  const dateFmt = new Intl.DateTimeFormat(locale === 'zh-Hans' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });

  // ---------------------------------------------------------------- state helpers
  const packById = (id) => (packs || []).find((p) => p.id === id);
  /** State as last loaded (render() refreshes from storage first). */
  const stateOf = (pack) => learnStore.getCourse(pack.id) || emptyCourseState(pack.type);
  /**
   * Read-modify-write through the store: always starts from the freshest saved
   * state, so a stale tab cannot overwrite progress made elsewhere. fn returns a
   * new state, the same state (no change), or { state, info } to pass info back.
   * Read-only stores (saved by a newer build) are never changed.
   */
  function mutate(pack, fn) {
    if (learnStore.readOnly) return { changed: false, info: null };
    let info = null;
    const r = learnStore.update(pack.id, (cur) => {
      const base = cur || emptyCourseState(pack.type);
      let out = fn(base);
      if (out && typeof out === 'object' && 'info' in out && 'state' in out) { info = out.info; out = out.state; }
      return out === base ? cur : out;
    });
    if (r.changed) onStorageChange();
    return { changed: r.changed, info: r.changed ? info : null };
  }
  function logTimeline(text) {
    entries.add({ text, timestamp: Date.now() }); // the entries store re-reads before writing
    onTimelineChange();
  }
  const ro = () => learnStore.readOnly;

  // ---------------------------------------------------------------- navigation
  function go(next) {
    route = next;
    assessShowing = null;
    if (next.name !== 'lesson') quizDraft = null;
    setupDraft = null;
    flash = null;
    render({ resetScroll: true });
  }
  function enterCourse(pack) {
    learnStore.refresh();
    const st = learnStore.getCourse(pack.id);
    if (!st || !st.setup) go({ name: 'setup', packId: pack.id });
    else if (st.assessment.completedAt === null) go({ name: 'assess', packId: pack.id });
    else go({ name: 'course', packId: pack.id, tab: 'path' });
  }

  function render({ resetScroll = false, focus = null } = {}) {
    learnStore.refresh();
    const top = scroller.scrollTop;
    const focusKey = focus || (document.activeElement && root.contains(document.activeElement) ? document.activeElement.dataset.key : null);
    root.textContent = '';
    let view;
    if (!packs) view = h('p', { class: 'muted ln-pad', text: '…' });
    else {
      const pack = route.packId ? packById(route.packId) : null;
      if (route.name !== 'home' && !pack) route = { name: 'home' };
      // Another tab may have reset this course or a newer one may be in progress.
      const st = pack ? learnStore.getCourse(pack.id) : null;
      if ((route.name === 'course' || route.name === 'result' || route.name === 'lesson') && !(st && st.setup)) route = { name: 'home' };
      if (route.name === 'home') view = renderHome();
      else if (route.name === 'setup') view = renderSetup(pack);
      else if (route.name === 'assess') view = renderAssess(pack);
      else if (route.name === 'result') view = renderResult(pack);
      else if (route.name === 'course') view = renderCourse(pack);
      else if (route.name === 'lesson') view = renderLesson(pack, route.nodeId);
    }
    root.append(view);
    if (learnStore.readOnly) root.prepend(h('div', { class: 'banner warn', role: 'alert', text: t('lnReadOnly') }));
    // Instant jumps: the page's smooth scrolling would otherwise animate every re-render.
    const prevBehavior = scroller.style.scrollBehavior;
    scroller.style.scrollBehavior = 'auto';
    if (resetScroll) {
      scroller.scrollTop = 0;
      const hd = root.querySelector('h2');
      if (hd) { hd.tabIndex = -1; hd.focus({ preventScroll: true }); }
    } else {
      scroller.scrollTop = top;
      if (focusKey) {
        const el = root.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
        if (el) { if (el.tabIndex < 0 && !el.hasAttribute('tabindex')) el.tabIndex = -1; el.focus({ preventScroll: true }); }
      }
    }
    scroller.style.scrollBehavior = prevBehavior;
  }

  function backBar(label, onClick) {
    return h('div', { class: 'ln-back' },
      h('button', { type: 'button', class: 'ln-link', onclick: onClick, key: 'back' }, h('span', { 'aria-hidden': 'true', text: '‹ ' }), label));
  }

  // ---------------------------------------------------------------- home
  function renderHome() {
    const now = new Date();
    const wrap = h('div', { class: 'ln-home' });
    const first = packs[0];
    const sum = first ? courseSummary(first, stateOf(first), now) : null;
    wrap.append(h('div', { class: 'ln-hello', 'aria-hidden': 'true' },
      bunnyHead(), h('span', { class: 'bubble', text: t(mascotKey(sum && learnStore.getCourse(first.id) ? sum : null)) })));
    wrap.append(h('h2', { class: 'ln-title', text: t('lnCourses') }));
    if (packs.length === 0) { wrap.append(h('p', { class: 'muted', text: t('lnNoCourses') })); return wrap; }
    const list = h('ul', { class: 'ln-courses' });
    for (const pack of packs) {
      const st = learnStore.getCourse(pack.id);
      const sm = courseSummary(pack, st || emptyCourseState(pack.type), now);
      const status = !st || !st.setup ? t('lnNotStarted')
        : sm.phase === 'assessment' ? t('lnStatusAssess')
          : t('lnStatusLine', { done: sm.mastered, total: sm.total, n: sm.week, t: sm.weeklyTarget });
      list.append(h('li', { class: 'ln-course' },
        h('h3', { text: pack.title }),
        h('p', { class: 'ln-course-sum', text: pack.summary }),
        h('p', { class: 'ln-course-status', text: status }),
        locale !== 'zh-Hans' && pack.lang === 'zh-Hans' ? h('p', { class: 'muted', text: t('lnContentLangNote') }) : null,
        h('button', { type: 'button', class: 'btn primary', key: 'open-' + pack.id, onclick: () => enterCourse(pack), text: st && st.setup ? t('lnContinue') : t('lnStart') })));
    }
    wrap.append(list);
    return wrap;
  }

  function bunnyHead() {
    const svg = s('svg', { class: 'bn-avatar', viewBox: '0 0 100 100', focusable: 'false' }, s('use', { href: '#bn-head' }));
    return svg;
  }

  // ---------------------------------------------------------------- setup
  function renderSetup(pack) {
    const st = stateOf(pack);
    if (!setupDraft || setupDraft.packId !== pack.id) {
      setupDraft = { packId: pack.id, goal: st.setup ? st.setup.goalLevel : 2, weekly: st.setup ? st.setup.weeklyTarget : 3 };
    }
    const draft = setupDraft;
    const done = st.assessment.completedAt !== null;
    const wrap = h('div', { class: 'ln-setup' });
    wrap.append(backBar(done ? t('lnBackToPath') : t('lnCourses'), () => (done ? go({ name: 'course', packId: pack.id, tab: 'progress' }) : go({ name: 'home' }))));
    wrap.append(h('p', { class: 'ln-kicker', text: pack.title }), h('h2', { class: 'ln-title', text: t('lnSetupTitle') }));

    const fs = h('fieldset', { class: 'ln-goals' }, h('legend', { text: t('lnGoalLabel') }));
    for (const lv of pack.levels) {
      const id = `goal-${lv.id}`;
      fs.append(h('label', { class: 'ln-choice', for: id },
        h('input', { type: 'radio', name: 'goal', id, value: String(lv.id), checked: lv.id === draft.goal, key: id, onchange: () => { draft.goal = lv.id; } }),
        h('span', { class: 'ln-choice-body' }, h('strong', { text: lv.label }), h('span', { class: 'muted', text: lv.desc }))));
    }
    wrap.append(fs);

    const val = h('output', { class: 'ln-stepper-val', 'aria-live': 'polite', text: t('lnWeeklyValue', { n: draft.weekly }) });
    const minus = h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('lnFewer'), text: '−', key: 'wk-minus' });
    const plus = h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('lnMore'), text: '+', key: 'wk-plus' });
    const sync = () => { val.textContent = t('lnWeeklyValue', { n: draft.weekly }); minus.disabled = draft.weekly <= WEEKLY_MIN; plus.disabled = draft.weekly >= WEEKLY_MAX; };
    minus.onclick = () => { draft.weekly = Math.max(WEEKLY_MIN, draft.weekly - 1); sync(); };
    plus.onclick = () => { draft.weekly = Math.min(WEEKLY_MAX, draft.weekly + 1); sync(); };
    sync();
    wrap.append(h('div', { class: 'ln-field' }, h('p', { class: 'ln-label', text: t('lnWeeklyLabel') }), h('div', { class: 'ln-stepper' }, minus, val, plus)));

    wrap.append(h('button', {
      type: 'button', class: 'btn primary ln-wide', key: 'setup-go', text: done ? t('lnSaveGoal') : t('lnStartAssessment'), disabled: ro(),
      onclick: () => {
        const r = mutate(pack, (cur) => applySetup(cur, { goalLevel: draft.goal, weeklyTarget: draft.weekly }));
        if (!r.changed && !learnStore.getCourse(pack.id)) return;
        if (done) go({ name: 'course', packId: pack.id, tab: 'path' }); else go({ name: 'assess', packId: pack.id });
      },
    }));
    return wrap;
  }

  // ---------------------------------------------------------------- assessment
  function renderAssess(pack) {
    const st = stateOf(pack);
    const qs = pack.assessment.questions;
    const answered = st.assessment.answers;
    const wrap = h('div', { class: 'ln-assess' });
    wrap.append(backBar(t('lnCourses'), () => go({ name: 'home' })));
    wrap.append(h('p', { class: 'ln-kicker', text: pack.title }), h('h2', { class: 'ln-title', text: t('lnAssessTitle') }));
    const nAnswered = qs.filter((q) => q.id in answered).length;
    if (nAnswered === 0 && !assessShowing) wrap.append(h('p', { class: 'ln-intro', text: t('lnAssessIntro', { n: qs.length }) }));

    const showing = assessShowing && qs.find((q) => q.id === assessShowing);
    const q = showing || qs.find((x) => !(x.id in answered));
    if (!q) {
      wrap.append(h('p', { text: t('lnAssessDone') }), finishAssessButton(pack));
      return wrap;
    }
    const idx = qs.indexOf(q);
    wrap.append(h('progress', { class: 'ln-meter', max: qs.length, value: nAnswered, 'aria-label': t('lnQuestionOf', { i: idx + 1, n: qs.length }) }));
    wrap.append(questionCard(q, {
      label: t('lnQuestionOf', { i: idx + 1, n: qs.length }),
      chosen: answered[q.id],
      locked: q.id in answered || ro(),
      reveal: q.id in answered ? 'full' : false,
      keyPrefix: 'aq',
      onPick: (i) => {
        mutate(pack, (cur) => answerAssessment(cur, q.id, i)); // first answer wins, even across tabs
        assessShowing = q.id;
        const all = qs.every((x) => x.id in stateOf(pack).assessment.answers);
        render({ focus: all ? 'aq-finish' : 'aq-next' }); // keep keyboard focus on the way forward
        const fb = root.querySelector('.ln-feedback');
        if (fb) fb.scrollIntoView({ block: 'nearest' });
      },
    }));
    if (q.id in answered) {
      const last = qs.every((x) => x.id in answered);
      wrap.append(last ? finishAssessButton(pack) : h('button', {
        type: 'button', class: 'btn primary ln-wide', key: 'aq-next', text: t('lnNext'),
        onclick: () => { assessShowing = null; render({ resetScroll: true }); },
      }));
    }
    return wrap;
  }

  function finishAssessButton(pack) {
    return h('button', {
      type: 'button', class: 'btn primary ln-wide', key: 'aq-finish', text: t('lnSeeResults'),
      disabled: ro(),
      onclick: () => {
        const r = mutate(pack, (cur) => { const x = completeAssessment(pack, cur, Date.now()); return { state: x.state, info: x.completed }; });
        const logged = r.changed && r.info === true; // false if another tab already finished it
        if (logged) logTimeline(t('lnTimelineAssess', { title: pack.title }));
        go({ name: 'result', packId: pack.id, logged });
      },
    });
  }

  /**
   * One single-choice question. Options are buttons (assessment, immediate) or
   * radios (lesson quiz). Option values are always ORIGINAL option indexes;
   * `order` only changes the display order.
   * reveal: false (unanswered) | 'marks' (failed quiz: mark the learner's choice
   * right/wrong, never show the correct option or the explanation) | 'full'
   * (correct option + explanation).
   */
  function questionCard(q, { label, chosen, locked, keyPrefix, onPick, radio = false, reveal = false, order = null }) {
    const card = h('fieldset', { class: 'ln-q' + (locked ? ' locked' : '') });
    card.append(h('legend', { class: 'ln-q-prompt' }, label ? h('span', { class: 'ln-q-num', text: label }) : null, h('span', { text: q.prompt })));
    const opts = h('div', { class: 'ln-opts' });
    const ok = isCorrect(q, chosen);
    for (const i of order || q.options.map((_, j) => j)) {
      const opt = q.options[i];
      const isChosen = chosen === i;
      const isRight = i === q.answer;
      let mark = null;
      let cls = 'ln-opt';
      if (reveal === 'full' && isRight) { cls += ' right'; mark = h('span', { class: 'ln-opt-mark', text: '✓ ' + t(isChosen ? 'lnYourChoice' : 'lnRightOption') }); }
      else if (reveal && isChosen && !ok) { cls += ' wrong'; mark = h('span', { class: 'ln-opt-mark', text: '✗ ' + t('lnYourChoice') }); }
      else if (reveal === 'marks' && isChosen && ok) { cls += ' right'; mark = h('span', { class: 'ln-opt-mark', text: '✓ ' + t('lnYourChoice') }); }
      else if (isChosen) cls += ' chosen';
      if (radio) {
        const id = `${keyPrefix}-${q.id}-${i}`;
        opts.append(h('label', { class: cls, for: id },
          h('input', { type: 'radio', id, name: `${keyPrefix}-${q.id}`, checked: isChosen, disabled: locked, key: id, onchange: () => onPick(i) }),
          h('span', { class: 'ln-opt-text', text: opt }), mark));
      } else {
        opts.append(h('button', {
          type: 'button', class: cls, disabled: locked, key: `${keyPrefix}-${q.id}-${i}`,
          'aria-pressed': isChosen ? 'true' : 'false', onclick: () => onPick(i),
        }, h('span', { class: 'ln-opt-text', text: opt }), mark));
      }
    }
    card.append(opts);
    if (reveal === 'full') {
      card.append(h('div', { class: 'ln-feedback ' + (ok ? 'ok' : 'no'), role: 'status' },
        h('strong', { text: (ok ? '✓ ' : '✗ ') + t(ok ? 'lnCorrect' : 'lnWrong') }),
        !ok ? h('p', { text: t('lnCorrectAnswer', { a: q.options[q.answer] }) }) : null,
        h('p', { text: q.explanation })));
    } else if (reveal === 'marks') {
      card.append(h('div', { class: 'ln-feedback ' + (ok ? 'ok' : 'no') },
        h('strong', { text: (ok ? '✓ ' : '✗ ') + t(ok ? 'lnCorrect' : 'lnWrongNoReveal') })));
    }
    return card;
  }

  // ---------------------------------------------------------------- result
  function renderResult(pack) {
    const st = stateOf(pack);
    const scores = dimensionScores(pack, st.assessment.answers);
    const skipped = assessmentMasteredNodes(pack, st.assessment.answers).size;
    const wrap = h('div', { class: 'ln-result' });
    wrap.append(h('p', { class: 'ln-kicker', text: pack.title }), h('h2', { class: 'ln-title', text: t('lnResultTitle') }));
    if (route.logged) wrap.append(h('p', { class: 'ln-note', role: 'status', text: t('lnLoggedToTimeline') }));
    wrap.append(barChart(scores.map((d) => ({ label: d.label, pct: d.pct ?? 0, marker: null })), t('lnResultChart'),
      scores.map((d) => t('lnScoreRow', { label: d.label, c: d.correct, t: d.total }))));
    wrap.append(h('p', { class: 'ln-intro', text: skipped ? t('lnResultSkip', { n: skipped }) : t('lnResultNone') }));
    wrap.append(h('button', { type: 'button', class: 'btn primary ln-wide', key: 'see-path', text: t('lnSeePath'), onclick: () => go({ name: 'course', packId: pack.id, tab: 'path' }) }));
    return wrap;
  }

  /**
   * Horizontal bar chart as inline SVG plus a visible text equivalent.
   * rows: [{ label, pct, marker }] where marker is an optional 0..100 tick.
   */
  function barChart(rows, title, textRows) {
    const rowH = 34, W = 300, labelW = 92, barX = labelW, barW = 160, H = rows.length * rowH + 4;
    const svg = s('svg', { class: 'ln-chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title + '. ' + textRows.join('; ') });
    rows.forEach((r, i) => {
      const y = i * rowH + 6;
      svg.append(
        s('text', { x: 0, y: y + 15, class: 'ln-chart-label' }, r.label),
        s('rect', { x: barX, y: y + 3, width: barW, height: 16, rx: 3, class: 'ln-chart-track' }),
        r.pct > 0 ? s('rect', { x: barX, y: y + 3, width: Math.max(3, (barW * r.pct) / 100), height: 16, rx: 3, class: 'ln-chart-bar' }) : null,
        r.marker !== null && r.marker !== undefined
          ? s('line', { x1: barX + (barW * r.marker) / 100, x2: barX + (barW * r.marker) / 100, y1: y - 1, y2: y + 23, class: 'ln-chart-mark' })
          : null,
        s('text', { x: W, y: y + 15, 'text-anchor': 'end', class: 'ln-chart-pct' }, `${r.pct}%`),
      );
    });
    return h('figure', { class: 'ln-figure' },
      svg,
      h('figcaption', null, h('ul', { class: 'ln-chart-text' }, textRows.map((x) => h('li', { text: x })))));
  }

  // ---------------------------------------------------------------- course (path / progress)
  function renderCourse(pack) {
    const st = stateOf(pack);
    const tab = route.tab === 'progress' ? 'progress' : 'path';
    const wrap = h('div', { class: 'ln-course-view' });
    wrap.append(backBar(t('lnCourses'), () => go({ name: 'home' })));
    const goalLabel = pack.levels.find((l) => l.id === st.setup.goalLevel).label;
    wrap.append(h('h2', { class: 'ln-title', text: pack.title }), h('p', { class: 'ln-kicker', text: t('lnGoalNow', { goal: goalLabel }) }));
    const seg = h('div', { class: 'ln-seg', role: 'group', 'aria-label': pack.title });
    for (const [id, key] of [['path', 'lnTabPath'], ['progress', 'lnTabProgress']]) {
      seg.append(h('button', {
        type: 'button', class: 'ln-seg-btn', key: 'seg-' + id, 'aria-pressed': id === tab ? 'true' : 'false', text: t(key),
        onclick: () => { if (id !== tab) go({ name: 'course', packId: pack.id, tab: id }); },
      }));
    }
    wrap.append(seg);
    wrap.append(tab === 'path' ? renderPath(pack, st) : renderProgress(pack, st));
    return wrap;
  }

  function statusLabel(status) {
    return t(status === 'mastered' ? 'lnStatusMastered' : status === 'current' ? 'lnStatusCurrent' : 'lnStatusTodo');
  }

  function renderPath(pack, st) {
    const path = computePath(pack, st);
    const stuck = new Set(stuckNodes(pack, st).map((x) => x.node.id));
    const out = h('div', { class: 'ln-path' });
    const sum = courseSummary(pack, st, new Date());

    // up next
    const cur = path.items.find((i) => i.status === 'current');
    if (cur) {
      out.append(h('div', { class: 'ln-next' },
        h('p', { class: 'ln-label', text: t('lnUpNext') }),
        h('p', { class: 'ln-next-title', text: cur.node.title }),
        h('p', { class: 'muted', text: cur.node.summary }),
        h('button', { type: 'button', class: 'btn primary', key: 'next-open', text: t('lnOpenLesson'), onclick: () => go({ name: 'lesson', packId: pack.id, nodeId: cur.node.id }) })));
    } else {
      out.append(h('p', { class: 'ln-note', text: t('lnAllDone') }));
    }
    if (cur && cur.optional && sum.requiredDone) out.append(h('p', { class: 'ln-note', text: t('lnRequiredDone') }));

    // legend (shape + label, not colour alone)
    const legend = h('ul', { class: 'ln-legend', 'aria-label': t('lnLegend') });
    for (const status of ['mastered', 'current', 'todo']) {
      legend.append(h('li', null, h('span', { class: `ln-dot ${status}`, 'aria-hidden': 'true', text: STATUS_ICON[status] }), statusLabel(status)));
    }
    legend.append(h('li', null, h('span', { class: 'ln-tag opt', text: t('lnOptional') }), t('lnOptionalHint')));
    out.append(legend);

    groupByStage(pack, path.items).forEach(({ stage, items }, si) => {
      const sec = h('section', { class: 'ln-stage' });
      sec.append(h('h3', { class: 'ln-stage-title' }, h('span', { class: 'ln-stage-num', text: t('lnStage', { n: si + 1 }) }), h('span', { text: stage.title })));
      if (stage.summary) sec.append(h('p', { class: 'muted ln-stage-sum', text: stage.summary }));
      const ol = h('ol', { class: 'ln-nodes' });
      for (const it of items) {
        const n = it.node;
        ol.append(h('li', { class: `ln-node ${it.status}` + (it.optional ? ' optional' : '') },
          h('button', { type: 'button', class: 'ln-node-btn', key: 'node-' + n.id, onclick: () => go({ name: 'lesson', packId: pack.id, nodeId: n.id }) },
            h('span', { class: `ln-dot ${it.status}`, 'aria-hidden': 'true', text: STATUS_ICON[it.status] }),
            h('span', { class: 'ln-node-main' },
              h('span', { class: 'ln-node-title', text: n.title }),
              h('span', { class: 'ln-node-meta' },
                h('span', { class: 'ln-status-text', text: statusLabel(it.status) }),
                it.optional ? h('span', { class: 'ln-tag opt', text: t('lnOptional') }) : null,
                stuck.has(n.id) ? h('span', { class: 'ln-tag stuck', text: t('lnStuckTag') }) : null)))));
      }
      sec.append(ol);
      out.append(sec);
    });
    return out;
  }

  function renderProgress(pack, st) {
    const now = new Date();
    const out = h('div', { class: 'ln-progress' });

    // dimension chart
    const dims = dimensionProgress(pack, st);
    out.append(h('section', { class: 'ln-panel' },
      h('h3', { text: t('lnChartTitle') }),
      h('p', { class: 'muted', text: t('lnChartNote') }),
      barChart(dims.map((d) => ({ label: d.label, pct: d.pct, marker: d.baselinePct })), t('lnChartTitle'),
        dims.map((d) => t('lnChartRow', { label: d.label, pct: d.pct, m: d.mastered, t: d.total, b: d.baselinePct === null ? t('lnNoBaseline') : d.baselinePct + '%' })))));

    // this week
    const wk = weekInterval(now);
    const done = masteredThisWeek(st, now);
    const target = st.setup.weeklyTarget;
    const pips = h('div', { class: 'ln-pips', 'aria-hidden': 'true' });
    for (let i = 0; i < Math.max(done, target); i++) pips.append(h('span', { class: 'ln-pip' + (i < done ? ' on' : '') + (i >= target ? ' extra' : '') }));
    const lastDay = new Date(wk.end.getFullYear(), wk.end.getMonth(), wk.end.getDate() - 1);
    out.append(h('section', { class: 'ln-panel' },
      h('h3', { text: t('lnWeekTitle') }),
      h('p', { class: 'muted', text: t('lnWeekRange', { from: dateFmt.format(wk.start), to: dateFmt.format(lastDay) }) }),
      pips,
      h('p', { class: 'ln-week-count', text: t('lnWeekCount', { n: done, t: target }) })));

    // stuck
    const stuck = stuckNodes(pack, st);
    const stuckSec = h('section', { class: 'ln-panel' }, h('h3', { text: t('lnStuckTitle') }));
    if (!stuck.length) stuckSec.append(h('p', { class: 'muted', text: t('lnStuckEmpty') }));
    else {
      const ul = h('ul', { class: 'ln-stuck' });
      for (const x of stuck) {
        const why = [x.failedAttempts ? t('lnStuckFailed', { n: x.failedAttempts }) : null, x.lowRating ? t('lnStuckLow') : null].filter(Boolean).join(t('lnSep'));
        ul.append(h('li', null, h('button', { type: 'button', class: 'ln-node-btn', key: 'stuck-' + x.node.id, onclick: () => go({ name: 'lesson', packId: pack.id, nodeId: x.node.id }) },
          h('span', { class: 'ln-dot stuck', 'aria-hidden': 'true', text: '!' }),
          h('span', { class: 'ln-node-main' }, h('span', { class: 'ln-node-title', text: x.node.title }), h('span', { class: 'ln-node-meta', text: why })))));
      }
      stuckSec.append(ul);
    }
    out.append(stuckSec);

    // adjust
    const adj = h('section', { class: 'ln-panel' }, h('h3', { text: t('lnAdjustTitle') }));
    const weekly = st.setup.weeklyTarget;
    const setW = (delta) => { mutate(pack, (cur) => setWeeklyTarget(cur, cur.setup.weeklyTarget + delta)); flash = null; render(); };
    adj.append(h('div', { class: 'ln-field' }, h('p', { class: 'ln-label', text: t('lnWeeklyLabel') }), h('div', { class: 'ln-stepper' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('lnFewer'), text: '−', key: 'adj-minus', disabled: ro() || weekly <= WEEKLY_MIN, onclick: () => setW(-1) }),
      h('output', { class: 'ln-stepper-val', 'aria-live': 'polite', text: t('lnWeeklyValue', { n: weekly }) }),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('lnMore'), text: '+', key: 'adj-plus', disabled: ro() || weekly >= WEEKLY_MAX, onclick: () => setW(1) }))));
    adj.append(h('button', {
      type: 'button', class: 'btn secondary ln-wide', key: 'prioritize', text: t('lnPrioritize'), disabled: ro() || stuck.length === 0,
      onclick: () => {
        const r = mutate(pack, (cur) => { const x = prioritizeStuck(pack, cur); return { state: x.state, info: x.nodeId }; });
        const node = r.info && pack.nodes.find((n) => n.id === r.info);
        flash = { key: 'prioritize', text: node ? t('lnPrioritized', { title: node.title }) : t('lnPrioritizeNone') };
        render();
      },
    }));
    if (flash && flash.key === 'prioritize') adj.append(h('p', { class: 'ln-note', role: 'status', text: flash.text }));
    adj.append(h('button', { type: 'button', class: 'btn secondary ln-wide', key: 'change-goal', text: t('lnChangeGoal'), disabled: ro(), onclick: () => go({ name: 'setup', packId: pack.id }) }));
    out.append(adj);

    // danger zone
    out.append(h('section', { class: 'ln-panel ln-danger' },
      h('button', {
        type: 'button', class: 'btn secondary ln-wide', key: 'retake', text: t('lnRetake'), disabled: ro(),
        onclick: () => confirm({ title: t('lnRetakeTitle'), body: t('lnRetakeBody'), ok: t('lnRetakeOk') }, () => {
          mutate(pack, (cur) => resetAssessment(cur));
          go({ name: 'assess', packId: pack.id });
        }),
      }),
      h('button', {
        type: 'button', class: 'btn danger', key: 'reset', text: t('lnReset'), disabled: ro(),
        onclick: () => confirm({ title: t('lnResetTitle'), body: t('lnResetBody'), ok: t('lnResetOk') }, () => {
          if (ro()) return;
          learnStore.removeCourse(pack.id);
          onStorageChange();
          go({ name: 'home' });
        }),
      })));
    return out;
  }

  // ---------------------------------------------------------------- lesson
  function renderLesson(pack, nodeId) {
    const node = pack.nodes.find((n) => n.id === nodeId);
    if (!node) { route = { name: 'course', packId: pack.id, tab: 'path' }; return renderCourse(pack); }
    const st = stateOf(pack);
    const ns = st.nodes[node.id] || { step: 1, checks: [], reflectionShown: false, selfRating: null, failedAttempts: 0 };
    const path = computePath(pack, st);
    const item = path.items.find((i) => i.node.id === node.id);
    const L = node.lesson;
    const stage = pack.stages.find((x) => x.id === node.stage);
    const update = (fn) => { mutate(pack, fn); render(); };
    const locked = ro(); // read-only: everything stays readable, nothing changes progress

    const wrap = h('article', { class: 'ln-lesson' });
    wrap.append(backBar(t('lnBackToPath'), () => go({ name: 'course', packId: pack.id, tab: 'path' })));
    wrap.append(h('p', { class: 'ln-kicker', text: stage ? stage.title : pack.title }), h('h2', { class: 'ln-title', text: node.title }));
    wrap.append(h('p', { class: 'ln-node-meta' },
      h('span', { class: `ln-dot ${item.status}`, 'aria-hidden': 'true', text: STATUS_ICON[item.status] }),
      h('span', { class: 'ln-status-text', text: statusLabel(item.status) }),
      item.optional ? h('span', { class: 'ln-tag opt', text: t('lnOptional') }) : null,
      ns.failedAttempts ? h('span', { class: 'ln-tag stuck', text: t('lnAttempts', { n: ns.failedAttempts }) }) : null));
    wrap.append(h('p', { class: 'ln-intro', text: node.summary }));
    if (item.status === 'mastered') wrap.append(h('p', { class: 'ln-note', text: t('lnMasteredNote') }));
    else {
      const miss = missingPrereqs(pack, st, node);
      if (miss.length) wrap.append(h('p', { class: 'ln-note warnish', text: t('lnSuggestFirst', { list: miss.map((m) => '《' + m.title + '》').join('') }) }));
    }

    // 1. explanation, stepped
    const step = locked ? L.sections.length : Math.min(ns.step || 1, L.sections.length);
    const exp = h('section', { class: 'ln-part' }, partHead(1, t('lnLessonSteps')));
    const ol = h('ol', { class: 'ln-steps' });
    L.sections.slice(0, step).forEach((sec, i) => {
      ol.append(h('li', { class: 'ln-step' },
        h('p', { class: 'ln-step-count', text: t('lnStepOf', { i: i + 1, n: L.sections.length }) }),
        h('h4', { text: sec.heading }), sec.body.map((p) => h('p', { text: p }))));
    });
    exp.append(ol);
    if (step < L.sections.length) {
      exp.append(h('button', { type: 'button', class: 'btn secondary ln-wide', key: 'next-part', text: t('lnNextPart'),
        onclick: () => {
          update((cur) => setLessonStep(cur, node.id, step + 1));
          const steps = root.querySelectorAll('.ln-step');
          if (steps.length) steps[steps.length - 1].scrollIntoView({ block: 'start' });
        } }));
    }
    wrap.append(exp);

    // 2. questions worth asking
    const ask = h('section', { class: 'ln-part' }, partHead(2, t('lnAskTitle')), h('p', { class: 'muted', text: t('lnAskHint') }));
    const ul = h('ul', { class: 'ln-asks' });
    L.askQuestions.forEach((qText, i) => {
      const msg = h('span', { class: 'ln-copied', role: 'status' });
      const btn = h('button', { type: 'button', class: 'btn secondary ln-copy', key: 'copy-' + i, text: t('lnCopy'), 'aria-label': t('lnCopy') + '：' + qText });
      btn.onclick = async () => {
        const ok = await copyText(t('lnAskPrefix', { course: pack.title, node: node.title }) + qText);
        msg.textContent = ok ? t('lnCopied') : t('lnCopyFailed');
      };
      ul.append(h('li', { class: 'ln-ask' }, h('p', { text: qText }), h('div', { class: 'ln-ask-row' }, btn, msg)));
    });
    ask.append(ul);
    wrap.append(ask);

    // 3. task + checklist
    const checks = ns.checks || [];
    const nChecked = L.task.criteria.filter((_, i) => checks[i]).length;
    const task = h('section', { class: 'ln-part' }, partHead(3, t('lnTaskTitle')), h('p', { text: L.task.prompt }));
    const cl = h('fieldset', { class: 'ln-checks' }, h('legend', { class: 'ln-label', text: t('lnCriteria') }));
    L.task.criteria.forEach((c, i) => {
      const id = `chk-${node.id}-${i}`;
      cl.append(h('label', { class: 'ln-check', for: id },
        h('input', { type: 'checkbox', id, key: id, checked: !!checks[i], disabled: locked, onchange: (e) => update((cur) => toggleCheck(cur, node.id, i, e.target.checked)) }),
        h('span', { text: c })));
    });
    task.append(cl, h('p', { class: 'muted', text: t('lnCriteriaDone', { n: nChecked, t: L.task.criteria.length }) }));
    wrap.append(task);

    // 4. reflection
    const refl = h('section', { class: 'ln-part' }, partHead(4, t('lnReflectTitle')), h('p', { class: 'ln-reflect-q', text: L.reflection.question }));
    if (!ns.reflectionShown && !locked) {
      refl.append(h('p', { class: 'muted', text: t('lnReflectHint') }),
        h('button', { type: 'button', class: 'btn secondary ln-wide', key: 'reveal', text: t('lnReveal'), onclick: () => update((cur) => revealReflection(cur, node.id)) }));
    } else {
      refl.append(h('div', { class: 'ln-answer' }, h('p', { class: 'ln-label', text: t('lnReference') }), h('p', { text: L.reflection.answer })));
      const rate = h('fieldset', { class: 'ln-rate' }, h('legend', { class: 'ln-label', text: t('lnRateQ') }));
      for (const [k, v] of [['lnRateLow', SELF_RATING.low], ['lnRateMid', SELF_RATING.mid], ['lnRateHigh', SELF_RATING.high]]) {
        rate.append(h('button', {
          type: 'button', class: 'ln-rate-btn' + (ns.selfRating === v ? ' on' : ''), key: 'rate-' + v, 'aria-pressed': ns.selfRating === v ? 'true' : 'false', text: t(k), disabled: locked,
          onclick: () => update((cur) => rateReflection(cur, node.id, v)),
        }));
      }
      refl.append(rate);
    }
    wrap.append(refl);

    // 5. quiz
    wrap.append(renderQuiz(pack, node, item, path));
    return wrap;
  }

  function partHead(n, title) {
    return h('h3', { class: 'ln-part-title' }, h('span', { class: 'ln-part-num', 'aria-hidden': 'true', text: String(n) }), h('span', { text: title }));
  }

  function renderQuiz(pack, node, item) {
    const quiz = node.lesson.quiz;
    if (!quizDraft || quizDraft.nodeId !== node.id) quizDraft = { nodeId: node.id, answers: [], orders: null, grade: null, newlyMastered: false };
    const d = quizDraft;
    const head = partHead(5, t('lnQuizTitle'));
    head.dataset.key = 'quiz-title';
    const sec = h('section', { class: 'ln-part ln-quiz', id: 'ln-quiz' }, head, h('p', { class: 'muted', text: t('lnQuizHint', { n: quiz.length }) }));
    // Failed attempt: only mark right/wrong. Passed: show answers and explanations.
    const reveal = !d.grade ? false : d.grade.passed ? 'full' : 'marks';
    quiz.forEach((q, i) => {
      sec.append(questionCard(q, {
        label: `${i + 1}/${quiz.length}`, chosen: d.answers[i], locked: !!d.grade, keyPrefix: 'qz', radio: true,
        reveal, order: d.orders ? d.orders[i] : null,
        onPick: (opt) => { if (d.grade) return; d.answers[i] = opt; render(); },
      }));
    });
    if (!d.grade) {
      const ready = quiz.every((_, i) => Number.isInteger(d.answers[i]));
      sec.append(h('button', {
        type: 'button', class: 'btn primary ln-wide', key: 'quiz-submit', text: t('lnSubmit'), disabled: !ready || ro(),
        onclick: () => {
          if (d.grade || ro()) return; // double-tap guard; read-only never grades into progress
          // Grade against the freshest saved state: if another tab mastered this
          // node meanwhile, newlyMastered is false and nothing is logged twice.
          const r = mutate(pack, (cur) => {
            const x = submitQuiz(pack, cur, node.id, d.answers.slice(), Date.now());
            return { state: x.state, info: x };
          });
          const x = r.info || submitQuiz(pack, stateOf(pack), node.id, d.answers.slice(), Date.now());
          d.grade = x.grade;
          d.newlyMastered = r.changed && x.newlyMastered;
          if (d.newlyMastered) logTimeline(t('lnTimelineLesson', { title: node.title }));
          render({ focus: 'quiz-result' }); // keyboard focus lands on the result
          const res = root.querySelector('.ln-quiz-result');
          if (res) { res.scrollIntoView({ block: 'center' }); }
        },
      }));
      return sec;
    }
    const g = d.grade;
    const res = h('div', { class: 'ln-quiz-result ' + (g.passed ? 'ok' : 'no'), role: 'status', key: 'quiz-result', tabIndex: -1 });
    if (g.passed) {
      res.append(h('strong', { text: d.newlyMastered ? t('lnQuizPass') : t('lnQuizPassReview') }));
      if (d.newlyMastered) res.append(h('p', { text: t('lnLoggedToTimeline') }));
      const after = computePath(pack, stateOf(pack));
      const next = after.items.find((i) => i.status === 'current');
      if (next && next.node.id !== node.id) {
        res.append(h('button', { type: 'button', class: 'btn primary ln-wide', key: 'go-next', text: t('lnNextLesson', { title: next.node.title }), onclick: () => go({ name: 'lesson', packId: pack.id, nodeId: next.node.id }) }));
      }
      res.append(h('button', { type: 'button', class: 'btn secondary ln-wide', key: 'to-path', text: t('lnBackToPath'), onclick: () => go({ name: 'course', packId: pack.id, tab: 'path' }) }));
    } else {
      const wrongNums = g.results.map((r, i) => (r.correct ? null : i + 1)).filter(Boolean).join(t('lnSep'));
      res.append(h('strong', { text: t('lnQuizFail', { c: g.correct, t: g.total }) }), h('p', { text: t('lnWrongList', { list: wrongNums }) }));
      res.append(h('button', {
        type: 'button', class: 'btn primary ln-wide', key: 'quiz-retry', text: t('lnRetry'),
        onclick: () => {
          // New attempt: options appear in a new order, so position alone gives nothing away.
          quizDraft = { nodeId: node.id, answers: [], orders: quiz.map((q) => shuffleOrder(q.options.length)), grade: null, newlyMastered: false };
          render({ focus: 'quiz-title' });
          const q = root.querySelector('#ln-quiz');
          if (q) q.scrollIntoView({ block: 'start' });
        },
      }));
    }
    sec.append(res);
    return sec;
  }

  // ---------------------------------------------------------------- public
  return {
    /** Called when the Learn tab becomes visible. */
    show() {
      if (!loaded) {
        loaded = true;
        render();
        loadPacks().then(({ packs: p }) => { packs = p; render(); }, (err) => { console.warn('[learn] packs failed', err); packs = []; render(); });
      } else {
        render();
      }
    },
  };
}
