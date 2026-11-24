// Learn tab UI. Browser-only. All pack content is rendered with textContent
// (never innerHTML). State changes go through the pure transitions in
// learn-logic.js; timeline entries are added only when a transition reports a
// first-time event, so re-renders and double taps cannot log twice.

import {
  emptyCourseState, applySetup, sanitizeForPack, setWeeklyTarget, answerAssessment, completeAssessment, resetAssessment,
  assessmentMasteredNodes, dimensionScores, isCorrect, computePath, groupByStage, missingPrereqs,
  setLessonStep, toggleCheck, revealReflection, rateReflection, submitQuiz, weekInterval, masteredThisWeek,
  dimensionProgress, stuckNodes, prioritizeStuck, courseSummary, mascotKey, isMastered, SELF_RATING,
  WEEKLY_MIN, WEEKLY_MAX, shuffleOrder, setSelfRating, replan, parseResult,
} from './learn-logic.js?v=20261123c';
import {
  isoOf, parseISODate, daysBetween, validateExamDate, chapterScores, planProgress, notebookItems, redoNotebook,
  startMock, answerMock, mockRemaining, submitMock, scoreMock, mockOptionOrder, seededOptionOrder,
} from './learn-exam.js?v=20261123c';
import { abilityGaps, abilityProgress, SELF_LEVELS } from './learn-role.js?v=20261123c';
import { loadPacks } from '../courses/index.js?v=20261123c';

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
  let setupDraft = null;     // { packId, goal, weekly, examDate, error } so a background re-render keeps unsaved choices
  let nbDraft = null;        // notebook redo: { packId, qid, q, order, chosen, result: null|'right'|'wrong' }
  let mockTimer = null;      // interval updating the visible mock-exam timer
  let mockAnnounced = { startedAt: null, five: false, one: false }; // screen-reader time announcements already made
  const ratingDone = new Set(); // role packs whose self-rating step was confirmed this session
  const openTasks = new Set();  // expanded task cards on the role map
  let flash = null;          // { key, text } one-shot status message
  let loaded = false;

  const intlLocale = locale === 'zh-Hans' ? 'zh-CN' : 'en-US';
  const dateFmt = new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric' });
  const dayFmt = new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric', weekday: 'short' });
  const stampFmt = new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const isoDate = (iso) => { const p = parseISODate(iso); return new Date(p.y, p.m - 1, p.d); };

  // ---------------------------------------------------------------- state helpers
  const packById = (id) => (packs || []).find((p) => p.id === id);
  /** State as last loaded (render() refreshes from storage first). */
  // Saved state is always pruned to ids the current pack has (see sanitizeForPack).
  const stateOf = (pack) => sanitizeForPack(pack, learnStore.getCourse(pack.id) || emptyCourseState(pack.type));
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
      const base = sanitizeForPack(pack, cur || emptyCourseState(pack.type));
      let out = fn(base);
      if (out && typeof out === 'object' && 'info' in out && 'state' in out) { info = out.info; out = out.state; }
      return out === base ? cur : out; // a no-op transition writes nothing
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
    nbDraft = null;
    flash = null;
    render({ resetScroll: true });
  }
  function enterCourse(pack) {
    learnStore.refresh();
    const st = learnStore.getCourse(pack.id);
    if (!st || !st.setup) go({ name: 'setup', packId: pack.id });
    else if (pack.type === 'exam' && !parseISODate(st.setup.examDate)) go({ name: 'setup', packId: pack.id });
    else if (st.assessment.completedAt === null) go({ name: 'assess', packId: pack.id });
    else go({ name: 'course', packId: pack.id });
  }

  function render({ resetScroll = false, focus = null } = {}) {
    learnStore.refresh();
    const top = scroller.scrollTop;
    const focusKey = focus || (document.activeElement && root.contains(document.activeElement) ? document.activeElement.dataset.key : null);
    root.textContent = '';
    let view;
    try {
      view = buildView();
    } catch (err) {
      // Never leave a blank tab: show the course list with a message, and offer
      // a way out for the course whose page failed.
      console.error('[learn] view failed', err);
      stopMockTimer();
      const failed = route.packId ? packById(route.packId) : null;
      route = { name: 'home' };
      const msg = h('div', { class: 'banner warn ln-view-error', role: 'alert', key: 'view-error' },
        h('p', { text: t('lnViewError') }),
        failed && !ro() ? h('button', {
          type: 'button', class: 'btn danger', key: 'view-error-reset', text: t('lnViewErrorReset', { title: failed.title }),
          onclick: () => confirm({ title: t('lnResetTitle'), body: t('lnResetBody'), ok: t('lnResetOk') }, () => {
            learnStore.removeCourse(failed.id); onStorageChange(); go({ name: 'home' });
          }),
        }) : null);
      try { view = h('div', null, msg, renderHome()); } catch (err2) { console.error('[learn] home failed', err2); view = msg; }
    }
    root.append(view);
    finishRender(resetScroll, top, focusKey);
  }

  function buildView() {
    let view;
    if (!packs) view = h('p', { class: 'muted ln-pad', text: '…' });
    else {
      const pack = route.packId ? packById(route.packId) : null;
      const needsPack = ['setup', 'assess', 'result', 'course', 'lesson', 'ability'].includes(route.name);
      if (needsPack && !pack) route = { name: 'home' };
      // Another tab may have reset this course or a newer one may be in progress.
      const st = pack ? learnStore.getCourse(pack.id) : null;
      if (['course', 'result', 'lesson', 'ability'].includes(route.name) && !(st && st.setup)) route = { name: 'home' };
      // P3: an exam course without a valid exam date goes to the date setup, not to the error fallback.
      else if (pack && pack.type === 'exam' && st && st.setup && !parseISODate(st.setup.examDate) && ['course', 'result', 'lesson'].includes(route.name)) route = { name: 'setup', packId: pack.id };
      for (const p of packs) if (p.type === 'exam') autoSubmitExpiredMock(p); // the timer never pauses
      if (route.name !== 'course' || route.tab !== 'mock') stopMockTimer();
      if (route.name === 'home') view = renderHome();
      else if (route.name === 'type') view = renderTypeList(route.type);
      else if (route.name === 'ability') view = renderAbility(pack, route.abilityId);
      else if (route.name === 'setup') view = renderSetup(pack);
      else if (route.name === 'assess') view = renderAssess(pack);
      else if (route.name === 'result') view = renderResult(pack);
      else if (route.name === 'course') view = renderCourse(pack);
      else if (route.name === 'lesson') view = renderLesson(pack, route.nodeId);
    }
    return view;
  }

  function finishRender(resetScroll, top, focusKey) {
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
  const TYPES = ['topic', 'exam', 'role'];
  const TYPE_KEY = { topic: 'lnTypeTopic', exam: 'lnTypeExam', role: 'lnTypeRole' };
  const pathTab = (pack) => (pack.type === 'exam' ? 'chapters' : 'path');
  const demoNote = (pack) => (pack.demoNotice ? h('p', { class: 'ln-demo', text: pack.demoNotice }) : null);

  function countdownText(examIso) {
    if (!parseISODate(examIso)) return '';
    const left = daysBetween(isoOf(new Date()), examIso);
    return left > 0 ? t('lnDaysLeft', { n: left }) : left === 0 ? t('lnExamToday') : t('lnExamOver');
  }

  function statusLine(pack, st, now) {
    if (!st || !st.setup) return t('lnNotStarted');
    const sm = courseSummary(pack, st, now);
    if (sm.phase === 'assessment') return t(pack.type === 'exam' ? 'lnStatusDiag' : 'lnStatusAssess');
    if (pack.type === 'exam') return countdownText(st.setup.examDate) + t('lnSep') + t('lnChaptersDone', { done: sm.mastered, total: sm.total });
    return t('lnStatusLine', { done: sm.mastered, total: sm.total, n: sm.week, t: sm.weeklyTarget });
  }

  function courseCard(pack, now) {
    const st = learnStore.getCourse(pack.id);
    return h('li', { class: 'ln-course' },
      h('h3', { text: pack.title }),
      h('p', { class: 'ln-course-sum', text: pack.summary }),
      demoNote(pack),
      h('p', { class: 'ln-course-status', text: statusLine(pack, st, now) }),
      locale !== 'zh-Hans' && pack.lang === 'zh-Hans' ? h('p', { class: 'muted', text: t('lnContentLangNote') }) : null,
      h('button', { type: 'button', class: 'btn primary', key: 'open-' + pack.id, onclick: () => enterCourse(pack), text: st && st.setup ? t('lnContinue') : t('lnStart') }));
  }

  /** Home: courses in progress grouped by type, then "new study" starting with the type. */
  function renderHome() {
    const now = new Date();
    const wrap = h('div', { class: 'ln-home' });
    const started = packs.filter((p) => { const st = learnStore.getCourse(p.id); return st && st.setup; });
    const sum = started.length ? courseSummary(started[0], stateOf(started[0]), now) : null;
    wrap.append(h('div', { class: 'ln-hello', 'aria-hidden': 'true' }, bunnyHead(), h('span', { class: 'bubble', text: t(mascotKey(sum)) })));
    if (started.length) {
      wrap.append(h('h2', { class: 'ln-title', text: t('lnMyStudy') }));
      for (const type of TYPES) {
        const list = started.filter((p) => p.type === type);
        if (list.length) wrap.append(h('h3', { class: 'ln-group-title', text: t(TYPE_KEY[type]) }), h('ul', { class: 'ln-courses' }, list.map((p) => courseCard(p, now))));
      }
    }
    wrap.append(h(started.length ? 'h3' : 'h2', { class: started.length ? 'ln-group-title' : 'ln-title', text: t('lnNewStudy') }));
    if (packs.length === 0) { wrap.append(h('p', { class: 'muted', text: t('lnNoCourses') })); return wrap; }
    wrap.append(h('p', { class: 'muted', text: t('lnChooseType') }));
    const ul = h('ul', { class: 'ln-types' });
    for (const type of TYPES) {
      const n = packs.filter((p) => p.type === type).length;
      if (!n) continue;
      ul.append(h('li', null, h('button', { type: 'button', class: 'ln-type', key: 'type-' + type, onclick: () => go({ name: 'type', type }) },
        h('span', { class: 'ln-type-title', text: t(TYPE_KEY[type]) }),
        h('span', { class: 'ln-type-desc', text: t(TYPE_KEY[type] + 'Desc') }),
        h('span', { class: 'ln-type-count', text: t('lnPackCount', { n }) }))));
    }
    wrap.append(ul, h('p', { class: 'muted ln-own', text: t('lnOwnContent') }));
    return wrap;
  }

  function renderTypeList(type) {
    const now = new Date();
    const wrap = h('div', { class: 'ln-typelist' });
    wrap.append(backBar(t('lnCourses'), () => go({ name: 'home' })));
    wrap.append(h('h2', { class: 'ln-title', text: t(TYPE_KEY[type] || 'lnCourses') }), h('p', { class: 'ln-intro', text: t((TYPE_KEY[type] || 'lnTypeTopic') + 'Desc') }));
    wrap.append(h('ul', { class: 'ln-courses' }, packs.filter((p) => p.type === type).map((p) => courseCard(p, now))));
    wrap.append(h('p', { class: 'muted ln-own', text: t('lnOwnContent') }));
    return wrap;
  }

  function bunnyHead() {
    const svg = s('svg', { class: 'bn-avatar', viewBox: '0 0 100 100', focusable: 'false' }, s('use', { href: '#bn-head' }));
    return svg;
  }

  // ---------------------------------------------------------------- setup
  function renderSetup(pack) {
    const st = stateOf(pack);
    const isExam = pack.type === 'exam';
    if (!setupDraft || setupDraft.packId !== pack.id) {
      setupDraft = {
        packId: pack.id,
        goal: st.setup ? st.setup.goalLevel : 2,
        weekly: st.setup ? st.setup.weeklyTarget : 3,
        examDate: (st.setup && st.setup.examDate) || '',
        error: null,
      };
    }
    const draft = setupDraft;
    const done = st.assessment.completedAt !== null;
    const wrap = h('div', { class: 'ln-setup' });
    wrap.append(backBar(done ? t('lnBackToCourse') : t('lnCourses'), () => (done ? go({ name: 'course', packId: pack.id }) : go({ name: 'home' }))));
    wrap.append(h('p', { class: 'ln-kicker', text: pack.title }), h('h2', { class: 'ln-title', text: t(isExam ? 'lnExamSetupTitle' : 'lnSetupTitle') }));
    if (pack.demoNotice) wrap.append(demoNote(pack));

    if (isExam) {
      const todayIso = isoOf(new Date());
      const preview = h('p', { class: 'ln-countdown-inline', 'aria-live': 'polite' });
      const err = h('p', { class: 'ln-error', role: 'alert' });
      const sync = () => {
        preview.textContent = validateExamDate(draft.examDate, isoOf(new Date())) === 'ok' ? countdownText(draft.examDate) : '';
        err.textContent = draft.error ? t(draft.error) : '';
        err.hidden = !draft.error;
      };
      const input = h('input', {
        type: 'date', id: 'exam-date', key: 'exam-date', min: todayIso, value: draft.examDate, required: true,
        'aria-describedby': 'exam-date-err', oninput: (e) => { draft.examDate = e.target.value; draft.error = null; sync(); },
      });
      err.id = 'exam-date-err';
      sync();
      wrap.append(h('div', { class: 'ln-field' }, h('label', { class: 'ln-label', for: 'exam-date', text: t('lnExamDateLabel') }), input, preview, err),
        h('p', { class: 'muted', text: t('lnExamSetupHint') }));
    } else {
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
    }

    const startKey = pack.type === 'exam' ? 'lnStartDiag' : 'lnStartAssessment';
    wrap.append(h('button', {
      type: 'button', class: 'btn primary ln-wide', key: 'setup-go', text: done ? t(isExam ? 'lnSaveExamDate' : 'lnSaveGoal') : t(startKey), disabled: ro(),
      onclick: () => {
        if (isExam) {
          const v = validateExamDate(draft.examDate, isoOf(new Date()));
          if (v !== 'ok') { draft.error = v === 'past' ? 'lnErrExamPast' : 'lnErrExamDate'; render({ focus: 'exam-date' }); return; }
        }
        const r = mutate(pack, (cur) => {
          let n = applySetup(cur, { goalLevel: draft.goal, weeklyTarget: draft.weekly, examDate: isExam ? draft.examDate : null });
          if (isExam && n.assessment.completedAt !== null) n = replan(pack, n, new Date()); // new date -> new plan
          return n;
        });
        if (!r.changed && !learnStore.getCourse(pack.id)) return;
        if (done) go({ name: 'course', packId: pack.id }); else go({ name: 'assess', packId: pack.id });
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
    const isExam = pack.type === 'exam';
    wrap.append(h('p', { class: 'ln-kicker', text: pack.title }), h('h2', { class: 'ln-title', text: t(isExam ? 'lnDiagTitle' : 'lnAssessTitle') }));
    const nAnswered = qs.filter((q) => q.id in answered).length;
    // Role: self-rate every ability first (0-3), then the questions.
    if (pack.type === 'role' && nAnswered === 0 && !assessShowing && !ratingDone.has(pack.id)) {
      wrap.append(renderSelfRating(pack, st));
      return wrap;
    }
    if (nAnswered === 0 && !assessShowing) wrap.append(h('p', { class: 'ln-intro', text: t(isExam ? 'lnDiagIntro' : 'lnAssessIntro', { n: qs.length }) }));

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
      // Display order is shuffled per attempt; answers are stored by authored index (saved data is positional).
      order: seededOptionOrder(st.assessment.seed ?? 0, q.id, q.options.length),
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

  function renderSelfRating(pack, st) {
    const box = h('div', { class: 'ln-selfrate' });
    box.append(h('p', { class: 'ln-intro', text: t('lnSelfRateIntro', { n: pack.role.abilities.length, q: pack.assessment.questions.length }) }));
    const legend = h('ul', { class: 'ln-legend' });
    for (const v of SELF_LEVELS) legend.append(h('li', null, h('strong', { text: String(v) }), t('lnSelf' + v)));
    box.append(legend);
    for (const ab of pack.role.abilities) {
      const cur = st.assessment.selfRatings[ab.id];
      const fs = h('fieldset', { class: 'ln-rate ln-selfrow' }, h('legend', { class: 'ln-selfrow-title', text: ab.title }), h('p', { class: 'muted ln-selfrow-what', text: ab.what }));
      for (const v of SELF_LEVELS) {
        fs.append(h('button', {
          type: 'button', class: 'ln-rate-btn ln-level-btn' + (cur === v ? ' on' : ''), key: `self-${ab.id}-${v}`, disabled: ro(),
          'aria-pressed': cur === v ? 'true' : 'false', 'aria-label': `${ab.title}: ${v} ${t('lnSelf' + v)}`,
          onclick: () => { mutate(pack, (c) => setSelfRating(c, ab.id, v)); render(); },
        }, h('span', { class: 'ln-level-num', text: String(v) }), h('span', { class: 'ln-level-text', text: t('lnSelf' + v) })));
      }
      box.append(fs);
    }
    const missing = pack.role.abilities.filter((ab) => !Number.isInteger(st.assessment.selfRatings[ab.id])).length;
    box.append(h('p', { class: 'muted', 'aria-live': 'polite', text: missing ? t('lnSelfRateMissing', { n: missing }) : t('lnSelfRateReady') }));
    box.append(h('button', {
      type: 'button', class: 'btn primary ln-wide', key: 'self-continue', text: t('lnSelfRateContinue'), disabled: missing > 0 || ro(),
      onclick: () => { ratingDone.add(pack.id); render({ resetScroll: true }); },
    }));
    return box;
  }

  function finishAssessButton(pack) {
    return h('button', {
      type: 'button', class: 'btn primary ln-wide', key: 'aq-finish', text: t('lnSeeResults'),
      disabled: ro(),
      onclick: () => {
        const r = mutate(pack, (cur) => { const x = completeAssessment(pack, cur, Date.now()); return { state: x.state, info: x.completed }; });
        const logged = r.changed && r.info === true; // false if another tab already finished it
        if (logged) logTimeline(t(pack.type === 'exam' ? 'lnTimelineDiag' : 'lnTimelineAssess', { title: pack.title }));
        go({ name: 'result', packId: pack.id, logged });
      },
    });
  }

  /** A lesson body item: a paragraph, or a code block with an optional query result. */
  function bodyItem(item) {
    if (typeof item === 'string') return h('p', { text: item });
    const res = item.result !== undefined ? parseResult(item.result) : null;
    return h('div', { class: 'ln-code-item' }, codeBlock(item.code, item.lang), res ? resultTable(res) : null);
  }

  /** Monospace code, scrolls sideways inside itself (never widens the page). Text only, no highlighting. */
  function codeBlock(code, lang = 'sql') {
    return h('pre', { class: 'ln-code' + (lang === 'shell' ? ' shell' : ''), tabIndex: 0, role: 'region', 'aria-label': t(lang === 'shell' ? 'lnShellLabel' : 'lnCodeLabel') }, h('code', { text: code }));
  }

  /** Query result as a real table (header + rows), also scrolling inside itself. */
  function resultTable({ head, rows }) {
    const numeric = head.map((name, j) => !/(code|_id|_no)$/i.test(name) && rows.length > 0 && rows.every((r) => /^-?[0-9][0-9,]*(\.[0-9]+)?$|^NULL$/.test(r[j])));
    return h('div', { class: 'ln-result-wrap', tabIndex: 0, role: 'region', 'aria-label': t('lnResultCaption') },
      h('table', { class: 'ln-result-table' },
        h('caption', { text: rows.length ? t('lnResultCaption') : t('lnResultNoRows') }),
        h('thead', null, h('tr', null, head.map((c) => h('th', { scope: 'col', text: c })))),
        h('tbody', null, rows.map((r) => h('tr', null, r.map((c, j) => h('td', { class: (numeric[j] ? 'num' : '') + (c === 'NULL' ? ' null' : ''), text: c })))))));
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
    if (q.code) card.append(codeBlock(q.code));
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
    const answers = st.assessment.answers;
    const wrap = h('div', { class: 'ln-result' });
    wrap.append(h('p', { class: 'ln-kicker', text: pack.title }), h('h2', { class: 'ln-title', text: t(pack.type === 'exam' ? 'lnDiagResultTitle' : 'lnResultTitle') }));
    if (route.logged) wrap.append(h('p', { class: 'ln-note', role: 'status', text: t('lnLoggedToTimeline') }));
    if (pack.type === 'exam') {
      const scores = chapterScores(pack, answers);
      const rows = pack.nodes.filter((n) => n.id in scores).map((n) => ({ label: n.title, pct: scores[n.id] }));
      wrap.append(h('h3', { class: 'ln-group-title', text: t('lnByChapter') }), barChart(rows, t('lnByChapter'), rows.map((r) => t('lnPctRow', { label: r.label, pct: r.pct })), { wideLabels: true }));
      const weak = rows.filter((r) => r.pct < 100).sort((x, y) => x.pct - y.pct).map((r) => r.label);
      wrap.append(h('p', { class: 'ln-intro', text: weak.length ? t('lnWeakFirst', { list: weak.join(t('lnSep')) }) : t('lnNoWeak') }));
      wrap.append(h('button', { type: 'button', class: 'btn primary ln-wide', key: 'see-plan', text: t('lnSeePlan'), onclick: () => go({ name: 'course', packId: pack.id, tab: 'plan' }) }));
      return wrap;
    }
    if (pack.type === 'role') {
      const gaps = abilityGaps(pack, st.assessment.selfRatings, answers);
      wrap.append(h('h3', { class: 'ln-group-title', text: t('lnGapTitle') }), levelChart(gaps.map((g) => ({ label: g.ability.title, have: g.assessed, need: g.required })), t('lnGapTitle'),
        gaps.map((g) => t('lnGapRow', { label: g.ability.title, r: g.required, c: g.assessed, g: Math.max(0, g.gap) }) + (g.anyWrong && g.self > 1 ? t('lnGapCapped') : ''))));
      const skipped = pack.nodes.filter((n) => isMastered(st, n.id)).length;
      wrap.append(h('p', { class: 'ln-intro', text: t('lnGapPathNote', { n: skipped }) }));
      wrap.append(h('button', { type: 'button', class: 'btn primary ln-wide', key: 'see-path', text: t('lnSeePath'), onclick: () => go({ name: 'course', packId: pack.id, tab: pathTab(pack) }) }));
      return wrap;
    }
    const scores = dimensionScores(pack, answers);
    const skipped = assessmentMasteredNodes(pack, answers).size;
    wrap.append(barChart(scores.map((d) => ({ label: d.label, pct: d.pct ?? 0, marker: null })), t('lnResultChart'),
      scores.map((d) => t('lnScoreRow', { label: d.label, c: d.correct, t: d.total }))));
    wrap.append(h('p', { class: 'ln-intro', text: skipped ? t('lnResultSkip', { n: skipped }) : t('lnResultNone') }));
    wrap.append(h('button', { type: 'button', class: 'btn primary ln-wide', key: 'see-path', text: t('lnSeePath'), onclick: () => go({ name: 'course', packId: pack.id, tab: pathTab(pack) }) }));
    return wrap;
  }

  /**
   * Required-vs-current levels (0..3) as inline SVG with a text equivalent:
   * filled squares = current level, outlined squares up to the required level.
   * Shape and the visible numbers carry the meaning, not colour alone.
   */
  function levelChart(rows, title, textRows) {
    const rowH = 34, W = 300, labelW = 132, cell = 26, gap = 6;
    const H = rows.length * rowH + 4;
    const svg = s('svg', { class: 'ln-chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title + '. ' + textRows.join('; ') });
    rows.forEach((r, i) => {
      const y = i * rowH + 6;
      svg.append(s('text', { x: 0, y: y + 16, class: 'ln-chart-label' }, r.label.length > 9 ? r.label.slice(0, 8) + '…' : r.label));
      for (let lv = 1; lv <= 3; lv++) {
        const x = labelW + (lv - 1) * (cell + gap);
        const have = lv <= r.have, need = lv <= r.need;
        svg.append(s('rect', { x, y: y + 1, width: cell, height: 22, rx: 4, class: have ? 'ln-lv-have' : need ? 'ln-lv-need' : 'ln-lv-none' }));
      }
      svg.append(s('text', { x: W, y: y + 16, 'text-anchor': 'end', class: 'ln-chart-pct' }, `${r.have}/${r.need}`));
    });
    return h('figure', { class: 'ln-figure' }, svg,
      h('figcaption', null, h('p', { class: 'muted ln-chart-key', text: t('lnLevelKey') }), h('ul', { class: 'ln-chart-text' }, textRows.map((x) => h('li', { text: x })))));
  }

  /**
   * Horizontal bar chart as inline SVG plus a visible text equivalent.
   * rows: [{ label, pct, marker }] where marker is an optional 0..100 tick.
   */
  function barChart(rows, title, textRows, { wideLabels = false } = {}) {
    const rowH = 34, W = 300, labelW = wideLabels ? 132 : 92, barX = labelW, barW = wideLabels ? 120 : 160, H = rows.length * rowH + 4;
    const clip = (txt) => (wideLabels && txt.length > 9 ? txt.slice(0, 8) + '…' : txt);
    const svg = s('svg', { class: 'ln-chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title + '. ' + textRows.join('; ') });
    rows.forEach((r, i) => {
      const y = i * rowH + 6;
      svg.append(
        s('text', { x: 0, y: y + 15, class: 'ln-chart-label' }, clip(r.label)),
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
  const COURSE_TABS = {
    topic: [['path', 'lnTabPath'], ['progress', 'lnTabProgress']],
    exam: [['plan', 'lnTabPlan'], ['chapters', 'lnTabChapters'], ['notebook', 'lnTabNotebook'], ['mock', 'lnTabMock']],
    role: [['map', 'lnTabMap'], ['path', 'lnTabPath'], ['progress', 'lnTabProgress']],
  };

  function renderCourse(pack) {
    const st = stateOf(pack);
    const tabs = COURSE_TABS[pack.type] || COURSE_TABS.topic;
    const tab = tabs.some(([id]) => id === route.tab) ? route.tab : tabs[0][0];
    const wrap = h('div', { class: 'ln-course-view' });
    wrap.append(backBar(t('lnCourses'), () => go({ name: 'home' })));
    const sub = pack.type === 'exam' ? t('lnExamOn', { date: dateFmt.format(isoDate(st.setup.examDate)), left: countdownText(st.setup.examDate) })
      : t('lnGoalNow', { goal: pack.levels.find((l) => l.id === st.setup.goalLevel).label });
    wrap.append(h('h2', { class: 'ln-title', text: pack.title }), h('p', { class: 'ln-kicker', text: sub }));
    if (pack.demoNotice) wrap.append(h('p', { class: 'ln-demo ln-demo-short', text: t('lnDemoShort') }));
    const seg = h('div', { class: 'ln-seg', role: 'group', 'aria-label': pack.title });
    for (const [id, key] of tabs) {
      seg.append(h('button', {
        type: 'button', class: 'ln-seg-btn', key: 'seg-' + id, 'aria-pressed': id === tab ? 'true' : 'false', text: t(key),
        onclick: () => { if (id !== tab) go({ name: 'course', packId: pack.id, tab: id }); },
      }));
    }
    wrap.append(seg);
    const view = { path: renderPath, chapters: renderPath, progress: renderProgress, plan: renderPlan, notebook: renderNotebook, mock: renderMock, map: renderRoleMap }[tab];
    wrap.append(view(pack, st));
    return wrap;
  }

  function statusLabel(status) {
    return t(status === 'mastered' ? 'lnStatusMastered' : status === 'current' ? 'lnStatusCurrent' : 'lnStatusTodo');
  }

  function nodeRow(pack, it, extraTags = []) {
    const n = it.node;
    return h('li', { class: `ln-node ${it.status}` + (it.optional ? ' optional' : '') },
      h('button', { type: 'button', class: 'ln-node-btn', key: 'node-' + n.id, onclick: () => go({ name: 'lesson', packId: pack.id, nodeId: n.id }) },
        h('span', { class: `ln-dot ${it.status}`, 'aria-hidden': 'true', text: STATUS_ICON[it.status] }),
        h('span', { class: 'ln-node-main' },
          h('span', { class: 'ln-node-title', text: n.title }),
          h('span', { class: 'ln-node-meta' },
            h('span', { class: 'ln-status-text', text: statusLabel(it.status) }),
            it.optional ? h('span', { class: 'ln-tag opt', text: t('lnOptional') }) : null,
            ...extraTags))));
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
    if (pack.type !== 'exam') legend.append(h('li', null, h('span', { class: 'ln-tag opt', text: t('lnOptional') }), t('lnOptionalHint')));
    out.append(legend);

    const tags = (n) => {
      const out = [];
      if (stuck.has(n.id)) out.push(h('span', { class: 'ln-tag stuck', text: t('lnStuckTag') }));
      if (pack.type === 'exam' && st.assessment.completedAt !== null) {
        const sc = chapterScores(pack, st.assessment.answers)[n.id];
        if (sc !== undefined) out.push(h('span', { class: 'ln-tag', text: t('lnDiagTag', { pct: sc }) }));
      }
      return out;
    };
    if (pack.type === 'role' && st.assessment.completedAt !== null) {
      // Role: one list in study order (largest ability gap first, prerequisites respected).
      const gaps = abilityGaps(pack, st.assessment.selfRatings, st.assessment.answers);
      const byId = new Map(path.items.map((it) => [it.node.id, it]));
      const sec = h('section', { class: 'ln-stage' }, h('h3', { class: 'ln-stage-title', text: t('lnGapOrderTitle') }), h('p', { class: 'muted ln-stage-sum', text: t('lnGapOrderNote') }));
      const ol = h('ol', { class: 'ln-nodes' });
      for (const id of path.order) {
        const it = byId.get(id);
        const owners = gaps.filter((g) => g.ability.nodes.includes(id));
        const gapTags = owners.map((g) => h('span', { class: 'ln-tag', text: t('lnAbilityGapTag', { title: g.ability.title, g: Math.max(0, g.gap) }) }));
        ol.append(nodeRow(pack, it, [...tags(it.node), ...gapTags]));
      }
      sec.append(ol);
      out.append(sec);
      return out;
    }
    groupByStage(pack, path.items).forEach(({ stage, items }, si) => {
      const sec = h('section', { class: 'ln-stage' });
      sec.append(h('h3', { class: 'ln-stage-title' }, h('span', { class: 'ln-stage-num', text: t('lnStage', { n: si + 1 }) }), h('span', { text: stage.title })));
      if (stage.summary) sec.append(h('p', { class: 'muted ln-stage-sum', text: stage.summary }));
      const ol = h('ol', { class: 'ln-nodes' });
      for (const it of items) ol.append(nodeRow(pack, it, tags(it.node)));
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

    if (pack.type === 'role') {
      // required vs current per ability
      const ab = abilityProgress(pack, st.assessment.selfRatings, st.assessment.answers, (id) => isMastered(st, id), st.assessment.completedAt !== null);
      out.append(h('section', { class: 'ln-panel' },
        h('h3', { text: t('lnAbilityTitle') }),
        h('p', { class: 'muted', text: t('lnAbilityNote') }),
        levelChart(ab.map((a) => ({ label: a.title, have: Math.min(a.current, 3), need: a.required })), t('lnAbilityTitle'),
          ab.map((a) => t('lnAbilityRow', { label: a.title, r: a.required, c: a.current, m: a.mastered, t: a.total }) + (a.met ? t('lnAbilityMet') : '')))));
    }

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
    // N2: another tab may have reset the course; a missing setup is a no-op.
    const setW = (delta) => { mutate(pack, (cur) => (cur.setup ? setWeeklyTarget(cur, cur.setup.weeklyTarget + delta) : cur)); flash = null; render(); };
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

    out.append(dangerZone(pack));
    return out;
  }

  /** Retake the assessment / reset the course, both behind a confirmation. */
  function dangerZone(pack) {
    const exam = pack.type === 'exam';
    return h('section', { class: 'ln-panel ln-danger' },
      h('button', {
        type: 'button', class: 'btn secondary ln-wide', key: 'retake', text: t(exam ? 'lnRetakeDiag' : 'lnRetake'), disabled: ro(),
        onclick: () => confirm({ title: t(exam ? 'lnRetakeDiagTitle' : 'lnRetakeTitle'), body: t(exam ? 'lnRetakeDiagBody' : 'lnRetakeBody'), ok: t('lnRetakeOk') }, () => {
          ratingDone.delete(pack.id);
          mutate(pack, (cur) => resetAssessment(cur));
          go({ name: 'assess', packId: pack.id });
        }),
      }),
      h('button', {
        type: 'button', class: 'btn danger', key: 'reset', text: t('lnReset'), disabled: ro(),
        onclick: () => confirm({ title: t('lnResetTitle'), body: t('lnResetBody'), ok: t('lnResetOk') }, () => {
          if (ro()) return;
          learnStore.removeCourse(pack.id);
          ratingDone.delete(pack.id);
          onStorageChange();
          go({ name: 'home' });
        }),
      }));
  }

  // ---------------------------------------------------------------- exam: plan
  function renderPlan(pack, st) {
    const out = h('div', { class: 'ln-plan' });
    const todayIso = isoOf(new Date());
    const left = daysBetween(todayIso, st.setup.examDate);
    const isM = (id) => isMastered(st, id);
    const nodeById = new Map(pack.nodes.map((n) => [n.id, n]));
    const done = pack.nodes.filter((n) => isM(n.id)).length;

    // the countdown is the one big element of this view
    out.append(h('div', { class: 'ln-count' },
      h('p', { class: 'ln-count-num' }, left > 0 ? h('span', { class: 'ln-count-big', text: String(left) }) : null, h('span', { class: 'ln-count-unit', text: left > 0 ? t('lnDaysUnit') : countdownText(st.setup.examDate) })),
      h('p', { class: 'ln-count-sub', text: t('lnCountSub', { date: dayFmt.format(isoDate(st.setup.examDate)), done, total: pack.nodes.length }) })));

    const changeDate = () => h('section', { class: 'ln-panel' }, h('button', { type: 'button', class: 'btn secondary ln-wide', key: 'change-goal', text: t('lnChangeExamDate'), disabled: ro(), onclick: () => go({ name: 'setup', packId: pack.id }) }));
    // m1: on exam day and afterwards (e.g. a resit) the date can still be changed.
    if (left < 0) { out.append(h('p', { class: 'ln-note', text: t('lnPlanPast') }), changeDate(), dangerZone(pack)); return out; }
    if (left === 0) { out.append(h('p', { class: 'ln-note', text: t('lnPlanExamDay') }), changeDate(), dangerZone(pack)); return out; }

    const doReplan = () => { mutate(pack, (cur) => replan(pack, cur, new Date())); flash = { key: 'replan', text: t('lnReplanned') }; render({ focus: 'replan-msg' }); };
    const plan = st.plan;
    const prog = planProgress(plan, isM, todayIso);
    prog.behind = prog.behind.filter((id) => nodeById.has(id)); // defensive: unknown ids never reach a lookup
    if (!plan || plan.status !== 'ok' || plan.exam !== st.setup.examDate) {
      out.append(h('p', { class: 'ln-note warnish', text: t('lnPlanStale') }));
    } else if (prog.behind.length) {
      out.append(h('p', { class: 'ln-note warnish', role: 'status', text: t('lnPlanBehind', { n: prog.behind.length, list: prog.behind.map((id) => '《' + nodeById.get(id).title + '》').join('') }) }));
    }
    out.append(h('button', { type: 'button', class: `btn ${prog.behind.length || !plan || plan.status !== 'ok' ? 'primary' : 'secondary'} ln-wide`, key: 'replan', text: t('lnReplan'), disabled: ro(), onclick: doReplan }));
    if (flash && flash.key === 'replan') out.append(h('p', { class: 'ln-note', role: 'status', key: 'replan-msg', text: flash.text }));
    out.append(h('p', { class: 'muted', text: t('lnPlanRule') }));

    if (plan && plan.status === 'ok') {
      const ol = h('ol', { class: 'ln-days' });
      for (const d of plan.days) {
        const diff = daysBetween(todayIso, d.date);
        if (diff < 0) continue; // past days: anything unfinished is listed as "behind" above
        const li = h('li', { class: 'ln-day' + (diff === 0 ? ' today' : '') },
          h('h3', { class: 'ln-day-title' }, h('span', { text: dayFmt.format(isoDate(d.date)) }), diff === 0 ? h('span', { class: 'ln-tag today', text: t('lnToday') }) : null));
        const ul = h('ul', { class: 'ln-nodes ln-day-items' });
        for (const id of d.nodes) {
          const n = nodeById.get(id);
          if (!n) continue;
          const status = isM(id) ? 'mastered' : 'todo';
          ul.append(nodeRow(pack, { node: n, status, optional: false }));
        }
        if (d.mock) {
          const hist = st.mock.history.length;
          ul.append(h('li', { class: 'ln-node' + (hist ? ' mastered' : ' todo') }, h('button', { type: 'button', class: 'ln-node-btn', key: 'plan-mock-' + d.date, onclick: () => go({ name: 'course', packId: pack.id, tab: 'mock' }) },
            h('span', { class: 'ln-dot ' + (hist ? 'mastered' : 'todo'), 'aria-hidden': 'true', text: hist ? STATUS_ICON.mastered : '⏱' }),
            h('span', { class: 'ln-node-main' }, h('span', { class: 'ln-node-title', text: t('lnMockTitle') }), h('span', { class: 'ln-node-meta', text: t('lnMockMeta', { n: pack.exam.mock.questions.length, m: pack.exam.mock.timeLimitMinutes }) })))));
        }
        if (!d.nodes.length && !d.mock) ul.append(h('li', { class: 'ln-free muted', text: t('lnFreeDay') }));
        li.append(ul);
        ol.append(li);
      }
      out.append(ol);
    }
    out.append(changeDate());
    out.append(dangerZone(pack));
    return out;
  }

  // ---------------------------------------------------------------- exam: wrong-answer notebook
  const SOURCE_KEY = { diagnostic: 'lnSrcDiag', quiz: 'lnSrcQuiz', mock: 'lnSrcMock' };

  function renderNotebook(pack, st) {
    const out = h('div', { class: 'ln-notebook' });
    const items = notebookItems(pack, st);
    const title = (id) => (pack.nodes.find((n) => n.id === id) || { title: '' }).title;
    const pick = (item) => ({ packId: pack.id, qid: item.id, q: item.q, source: item.source, chapter: item.chapter, order: shuffleOrder(item.q.options.length), chosen: undefined, result: null });
    if (nbDraft && nbDraft.packId !== pack.id) nbDraft = null;

    out.append(h('p', { class: 'ln-intro', text: t('lnNotebookIntro') }));
    out.append(h('p', { class: 'ln-week-count', role: 'status', text: t('lnNotebookCount', { n: items.length }) }));

    if (nbDraft) {
      const d = nbDraft;
      const box = h('section', { class: 'ln-panel ln-redo' }, h('h3', { text: t('lnRedoTitle') }));
      box.append(questionCard(d.q, {
        label: t(SOURCE_KEY[d.source]) + t('lnSep') + title(d.chapter), chosen: d.chosen, locked: !!d.result || ro(), keyPrefix: 'nb', radio: true,
        reveal: d.result === 'right' ? 'full' : d.result === 'wrong' ? 'marks' : false, order: d.order,
        onPick: (i) => { if (d.result) return; d.chosen = i; render(); },
      }));
      const nextItem = () => {
        const fresh = notebookItems(pack, stateOf(pack));
        const at = fresh.findIndex((x) => x.id === d.qid);
        const nxt = fresh.length ? fresh[(at + 1) % fresh.length] : null;
        nbDraft = nxt && (nxt.id !== d.qid || fresh.length === 1) ? pick(nxt) : null;
        render({ focus: nbDraft ? 'nb-title' : 'nb-start' });
      };
      if (!d.result) {
        box.append(h('button', {
          type: 'button', class: 'btn primary ln-wide', key: 'nb-check', text: t('lnSubmit'), disabled: !Number.isInteger(d.chosen) || ro(),
          onclick: () => {
            if (d.result) return;
            const ok = isCorrect(d.q, d.chosen);
            if (ok) mutate(pack, (cur) => redoNotebook(cur, d.qid, true).state);
            d.result = ok ? 'right' : 'wrong';
            render({ focus: 'nb-result' });
          },
        }));
      } else {
        box.append(h('p', { class: 'ln-quiz-result ' + (d.result === 'right' ? 'ok' : 'no'), key: 'nb-result', tabIndex: -1, role: 'status', text: t(d.result === 'right' ? 'lnRedoRight' : 'lnRedoWrong') }));
        if (d.result === 'wrong') {
          box.append(h('button', { type: 'button', class: 'btn primary ln-wide', key: 'nb-retry', text: t('lnRetry'), onclick: () => { d.chosen = undefined; d.result = null; d.order = shuffleOrder(d.q.options.length); render({ focus: 'nb-title' }); } }));
        }
        box.append(h('button', { type: 'button', class: 'btn secondary ln-wide', key: 'nb-next', text: t('lnRedoNext'), onclick: nextItem }));
      }
      box.append(h('button', { type: 'button', class: 'ln-link', key: 'nb-stop', text: t('lnRedoStop'), onclick: () => { nbDraft = null; render({ focus: 'nb-start' }); } }));
      box.querySelector('h3').dataset.key = 'nb-title';
      out.append(box);
    } else if (items.length) {
      out.append(h('button', { type: 'button', class: 'btn primary ln-wide', key: 'nb-start', text: t('lnRedoStart'), disabled: ro(), onclick: () => { nbDraft = pick(items[0]); render({ focus: 'nb-title' }); } }));
    } else {
      out.append(h('p', { class: 'ln-note', key: 'nb-start', text: t('lnNotebookEmpty') }));
    }

    if (items.length) {
      const ul = h('ul', { class: 'ln-nb-list' });
      for (const it of items) {
        ul.append(h('li', null, h('button', {
          type: 'button', class: 'ln-node-btn', key: 'nb-item-' + it.id, disabled: ro(), onclick: () => { nbDraft = pick(it); render({ focus: 'nb-title' }); },
        }, h('span', { class: 'ln-dot stuck', 'aria-hidden': 'true', text: '!' }),
        h('span', { class: 'ln-node-main' }, h('span', { class: 'ln-node-title ln-clamp', text: it.q.prompt }),
          h('span', { class: 'ln-node-meta' }, h('span', { class: 'ln-tag', text: t(SOURCE_KEY[it.source]) }), h('span', { text: title(it.chapter) }))))));
      }
      out.append(ul);
    }
    return out;
  }

  // ---------------------------------------------------------------- exam: mock exam
  const fmtClock = (ms) => { const sec = Math.ceil(ms / 1000); return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; };

  function stopMockTimer() { if (mockTimer) { clearInterval(mockTimer); mockTimer = null; } }

  /** Submit the running attempt once (learner, timer or on return after time-out) and log one entry. */
  function submitMockNow(pack) {
    const r = mutate(pack, (cur) => { const x = submitMock(pack, cur, Date.now()); return { state: x.state, info: x }; });
    const ok = r.changed && r.info && r.info.submitted;
    if (ok) logTimeline(t('lnTimelineMock', { title: pack.title, c: r.info.result.correct, t: r.info.result.total }));
    return ok;
  }

  function autoSubmitExpiredMock(pack) {
    if (ro()) return;
    const st = learnStore.getCourse(pack.id);
    if (st && st.mock.active && mockRemaining(pack, st, Date.now()) === 0) {
      if (submitMockNow(pack)) flash = { key: 'mock-auto', text: t('lnMockAutoSubmitted') };
    }
  }

  /**
   * The visible clock is aria-live=off (no per-second chatter). A polite live
   * region speaks once at 5 minutes and once at 1 minute left. A threshold
   * already passed long ago (e.g. after a reload) is skipped, not announced late.
   */
  function announceMockTime(startedAt, rem) {
    if (mockAnnounced.startedAt !== startedAt) mockAnnounced = { startedAt, five: false, one: false };
    const live = root.querySelector('[data-key="mock-announce"]');
    if (!live) return;
    if (!mockAnnounced.five && rem <= 5 * 60e3) {
      mockAnnounced.five = true;
      if (rem > 4 * 60e3) live.textContent = t('lnMockFiveMin');
    }
    if (!mockAnnounced.one && rem <= 60e3) {
      mockAnnounced.one = true;
      if (rem > 30e3) live.textContent = t('lnMockOneMin');
    }
  }

  function startMockTimer(pack) {
    if (mockTimer) return;
    mockTimer = setInterval(() => {
      const el = root.querySelector('[data-key="mock-timer"]');
      const st = learnStore.getCourse(pack.id);
      if (!el || !st || !st.mock.active || ro()) { stopMockTimer(); return; }
      const rem = mockRemaining(pack, st, Date.now());
      if (rem <= 0) {
        stopMockTimer();
        if (submitMockNow(pack)) flash = { key: 'mock-auto', text: t('lnMockAutoSubmitted') };
        render({ resetScroll: true });
        return;
      }
      el.textContent = fmtClock(rem);
      el.classList.toggle('low', rem <= 60e3);
      announceMockTime(st.mock.active.startedAt, rem);
    }, 1000);
  }

  function renderMock(pack, st) {
    const out = h('div', { class: 'ln-mock' });
    const M = pack.exam.mock;
    const nameOf = (id) => (pack.nodes.find((n) => n.id === id) || { title: id }).title;
    if (st.mock.active) {
      const a = st.mock.active;
      const rem = mockRemaining(pack, st, Date.now());
      const answeredN = M.questions.filter((q) => Number.isInteger(a.answers[q.id])).length;
      out.append(h('div', { class: 'ln-timerbar' },
        h('span', { class: 'ln-timer-label', text: t('lnTimeLeft') }),
        h('span', { class: 'ln-timer' + (rem <= 60e3 ? ' low' : ''), key: 'mock-timer', role: 'timer', 'aria-live': 'off', text: fmtClock(rem) }),
        h('span', { class: 'ln-timer-count', text: t('lnAnsweredCount', { n: answeredN, t: M.questions.length }) })),
      h('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite', 'aria-label': t('lnMockAnnounce'), key: 'mock-announce' }));
      out.append(h('p', { class: 'muted', text: t('lnMockNoPause') }));
      M.questions.forEach((q, i) => {
        out.append(questionCard(q, {
          label: `${i + 1}/${M.questions.length}${t('lnSep')}${nameOf(q.chapter)}`, chosen: a.answers[q.id], locked: ro(), keyPrefix: 'mk', radio: true,
          order: mockOptionOrder(a.startedAt, q.id, q.options.length), // new order every attempt; graded by original index
          onPick: (opt) => { mutate(pack, (cur) => answerMock(cur, q.id, opt, pack, Date.now())); render(); },
        }));
      });
      const submit = () => { stopMockTimer(); submitMockNow(pack); flash = null; render({ resetScroll: true }); };
      out.append(h('button', {
        type: 'button', class: 'btn primary ln-wide', key: 'mock-submit', text: t('lnMockSubmit'), disabled: ro(),
        onclick: () => {
          const fresh = stateOf(pack);
          if (!fresh.mock.active) { render({ resetScroll: true }); return; }
          const missing = M.questions.filter((q) => !Number.isInteger(fresh.mock.active.answers[q.id])).length;
          if (missing) confirm({ title: t('lnMockConfirmTitle'), body: t('lnMockConfirmBody', { n: missing }), ok: t('lnMockSubmit') }, submit);
          else submit();
        },
      }));
      startMockTimer(pack);
      return out;
    }

    const last = st.mock.history[st.mock.history.length - 1];
    if (flash && flash.key === 'mock-auto') out.append(h('p', { class: 'ln-note warnish', role: 'status', text: flash.text }));
    if (last) {
      const res = scoreMock(pack, last.answers);
      const sec = h('section', { class: 'ln-panel ln-mock-result', key: 'mock-result', tabIndex: -1 });
      sec.append(h('h3', { text: t('lnMockResultTitle') }),
        h('p', { class: 'ln-count-num' }, h('span', { class: 'ln-count-big', text: String(res.correct) }), h('span', { class: 'ln-count-unit', text: t('lnMockOutOf', { t: res.total, pct: res.pct }) })),
        h('p', { class: 'muted', text: t('lnMockWhen', { when: stampFmt.format(new Date(last.submittedAt)) }) }));
      const rows = res.byChapter.map((b) => ({ label: nameOf(b.id), pct: b.pct, marker: 60 }));
      sec.append(h('h4', { text: t('lnByChapter') }), barChart(rows, t('lnByChapter'), res.byChapter.map((b) => t('lnMockChapterRow', { label: nameOf(b.id), c: b.correct, t: b.total, pct: b.pct }) + (res.revisit.includes(b.id) ? t('lnRevisitMark') : '')), { wideLabels: true }));
      sec.append(h('p', { class: 'muted', text: t('lnMockLineNote') }));
      sec.append(h('h4', { text: t('lnRevisitTitle') }));
      if (res.revisit.length) {
        const ul = h('ul', { class: 'ln-nodes' });
        for (const id of res.revisit) {
          const n = pack.nodes.find((x) => x.id === id);
          ul.append(nodeRow(pack, { node: n, status: isMastered(st, id) ? 'mastered' : 'todo', optional: false }, [h('span', { class: 'ln-tag stuck', text: t('lnRevisitTag') })]));
        }
        sec.append(ul);
      } else sec.append(h('p', { class: 'ln-note', text: t('lnRevisitNone') }));
      const review = h('details', { class: 'ln-review' }, h('summary', { text: t('lnMockReview') }));
      M.questions.forEach((q, i) => review.append(questionCard(q, { label: `${i + 1}/${M.questions.length}${t('lnSep')}${nameOf(q.chapter)}`, chosen: last.answers[q.id], locked: true, keyPrefix: 'mr', radio: true, reveal: 'full' })));
      sec.append(review);
      out.append(sec);
    }
    out.append(h('section', { class: 'ln-panel' },
      h('h3', { text: last ? t('lnMockAgainTitle') : t('lnMockTitle') }),
      h('p', { class: 'ln-intro', text: t('lnMockIntro', { n: M.questions.length, m: M.timeLimitMinutes }) }),
      h('button', {
        type: 'button', class: 'btn primary ln-wide', key: 'mock-start', text: t(last ? 'lnMockRetake' : 'lnMockStart'), disabled: ro(),
        onclick: () => { mutate(pack, (cur) => startMock(cur, Date.now())); flash = null; render({ resetScroll: true }); },
      })));
    if (st.mock.history.length > 1) {
      out.append(h('section', { class: 'ln-panel' }, h('h3', { text: t('lnMockHistory') }),
        h('ul', { class: 'ln-chart-text' }, st.mock.history.slice().reverse().map((x) => h('li', { text: t('lnMockHistoryRow', { when: stampFmt.format(new Date(x.submittedAt)), c: x.correct, t: x.total }) })))));
    }
    return out;
  }

  // ---------------------------------------------------------------- role: map and abilities
  function abilityLevelsNow(pack, st) {
    return new Map(abilityProgress(pack, st.assessment.selfRatings, st.assessment.answers, (id) => isMastered(st, id), st.assessment.completedAt !== null).map((a) => [a.id, a]));
  }

  function renderRoleMap(pack, st) {
    const out = h('div', { class: 'ln-rolemap' });
    const lv = abilityLevelsNow(pack, st);
    out.append(h('p', { class: 'ln-intro', text: t('lnRoleMapIntro', { n: pack.role.tasks.length }) }));
    const ol = h('ol', { class: 'ln-tasks' });
    pack.role.tasks.forEach((task, i) => {
      const open = openTasks.has(task.id);
      const li = h('li', { class: 'ln-task' + (open ? ' open' : '') });
      const met = task.abilities.filter((id) => lv.get(id) && lv.get(id).met).length;
      li.append(h('button', {
        type: 'button', class: 'ln-task-head', key: 'task-' + task.id, 'aria-expanded': open ? 'true' : 'false', 'aria-controls': 'task-body-' + task.id,
        onclick: () => { if (open) openTasks.delete(task.id); else openTasks.add(task.id); render(); },
      }, h('span', { class: 'ln-task-num', 'aria-hidden': 'true', text: String(i + 1) }),
      h('span', { class: 'ln-task-main' }, h('span', { class: 'ln-task-title', text: task.title }), h('span', { class: 'ln-node-meta', text: t('lnTaskMeta', { o: task.outputs.length, a: task.abilities.length, m: met }) })),
      h('span', { class: 'ln-task-chev', 'aria-hidden': 'true', text: open ? '−' : '+' })));
      if (open) {
        const body = h('div', { class: 'ln-task-body', id: 'task-body-' + task.id },
          h('p', { text: task.desc }),
          h('h4', { text: t('lnTaskOutputs') }), h('ul', { class: 'ln-outputs' }, task.outputs.map((o) => h('li', { text: o }))),
          h('h4', { text: t('lnTaskAbilities') }));
        const ul = h('ul', { class: 'ln-ab-list' });
        for (const id of task.abilities) {
          const ab = pack.role.abilities.find((a) => a.id === id);
          const p = lv.get(id);
          ul.append(h('li', null, h('button', { type: 'button', class: 'ln-node-btn', key: `ab-${task.id}-${id}`, onclick: () => go({ name: 'ability', packId: pack.id, abilityId: id }) },
            h('span', { class: 'ln-dot ' + (p && p.met ? 'mastered' : 'todo'), 'aria-hidden': 'true', text: p && p.met ? STATUS_ICON.mastered : STATUS_ICON.todo }),
            h('span', { class: 'ln-node-main' }, h('span', { class: 'ln-node-title', text: ab.title }),
              h('span', { class: 'ln-node-meta', text: t('lnLevelShort', { r: ab.requiredLevel, c: p ? p.current : 0 }) + (p && p.met ? t('lnSep') + t('lnAbilityMetShort') : '') })))));
        }
        body.append(ul);
        li.append(body);
      }
      ol.append(li);
    });
    out.append(ol);
    return out;
  }

  function renderAbility(pack, abilityId) {
    const ab = pack.role && pack.role.abilities.find((a) => a.id === abilityId);
    if (!ab) { route = { name: 'course', packId: pack.id, tab: 'map' }; return renderCourse(pack); }
    const st = stateOf(pack);
    const p = abilityLevelsNow(pack, st).get(ab.id);
    const path = computePath(pack, st);
    const byId = new Map(path.items.map((it) => [it.node.id, it]));
    const wrap = h('article', { class: 'ln-ability' });
    wrap.append(backBar(t('lnBackToMap'), () => go({ name: 'course', packId: pack.id, tab: 'map' })));
    wrap.append(h('p', { class: 'ln-kicker', text: t('lnAbility') }), h('h2', { class: 'ln-title', text: ab.title }));
    wrap.append(levelChart([{ label: ab.title, have: Math.min(p.current, 3), need: ab.requiredLevel }], ab.title, [t('lnAbilityRow', { label: ab.title, r: ab.requiredLevel, c: p.current, m: p.mastered, t: p.total }) + (p.met ? t('lnAbilityMet') : '')]));
    wrap.append(h('section', { class: 'ln-part' }, h('h3', { class: 'ln-part-title', text: t('lnAbilityWhat') }), h('p', { text: ab.what })));
    wrap.append(h('section', { class: 'ln-part' }, h('h3', { class: 'ln-part-title', text: t('lnAbilityPractice') }), h('ul', { class: 'ln-outputs' }, ab.practice.map((x) => h('li', { text: x })))));
    const ul = h('ol', { class: 'ln-nodes' });
    for (const id of ab.nodes) ul.append(nodeRow(pack, byId.get(id)));
    wrap.append(h('section', { class: 'ln-part' }, h('h3', { class: 'ln-part-title', text: t('lnAbilityLessons') }), ul));
    const used = pack.role.tasks.filter((x) => x.abilities.includes(ab.id));
    wrap.append(h('section', { class: 'ln-part' }, h('h3', { class: 'ln-part-title', text: t('lnAbilityUsedIn') }),
      h('ul', { class: 'ln-outputs' }, used.map((x) => h('li', { text: x.title })))));
    return wrap;
  }

  // ---------------------------------------------------------------- lesson
  function renderLesson(pack, nodeId) {
    const node = pack.nodes.find((n) => n.id === nodeId);
    if (!node) { route = { name: 'course', packId: pack.id, tab: pathTab(pack) }; return renderCourse(pack); }
    const st = stateOf(pack);
    const ns = st.nodes[node.id] || { step: 1, checks: [], reflectionShown: false, selfRating: null, failedAttempts: 0 };
    const path = computePath(pack, st);
    const item = path.items.find((i) => i.node.id === node.id);
    const L = node.lesson;
    const stage = pack.stages.find((x) => x.id === node.stage);
    const update = (fn) => { mutate(pack, fn); render(); };
    const locked = ro(); // read-only: everything stays readable, nothing changes progress

    const wrap = h('article', { class: 'ln-lesson' });
    wrap.append(backBar(t(pack.type === 'exam' ? 'lnBackToChapters' : 'lnBackToPath'), () => go({ name: 'course', packId: pack.id, tab: pathTab(pack) })));
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

    if (node.sharedFrom) wrap.append(h('p', { class: 'muted ln-shared', text: t('lnSharedFrom', { title: node.sharedFrom.title }) }));

    if (pack.type === 'exam') {
      // Exam chapter: key points, common mistakes, worked example, (questions), chapter quiz.
      wrap.append(steppedPart(pack, node, 1, t('lnKeyPoints'), L.keyPoints, ns, locked, update));
      wrap.append(h('section', { class: 'ln-part' }, partHead(2, t('lnMistakes')),
        h('ul', { class: 'ln-mistakes' }, L.mistakes.map((m) => h('li', null, h('span', { class: 'ln-x', 'aria-hidden': 'true', text: '✗' }), h('span', { text: m }))))));
      const ex = h('section', { class: 'ln-part' }, partHead(3, t('lnExample')), h('p', { class: 'ln-reflect-q', text: L.example.problem }));
      if (!ns.reflectionShown && !locked) {
        ex.append(h('p', { class: 'muted', text: t('lnExampleHint') }),
          h('button', { type: 'button', class: 'btn secondary ln-wide', key: 'reveal', text: t('lnExampleReveal'), onclick: () => update((cur) => revealReflection(cur, node.id)) }));
      } else {
        ex.append(h('div', { class: 'ln-answer' }, h('p', { class: 'ln-label', text: t('lnExampleSteps') }),
          h('ol', { class: 'ln-ex-steps' }, L.example.steps.map((x) => h('li', { text: x }))),
          h('p', { class: 'ln-ex-answer' }, h('strong', { text: t('lnExampleAnswer') }), L.example.answer)));
      }
      wrap.append(ex);
      let num = 4;
      if (L.askQuestions && L.askQuestions.length) wrap.append(askPart(pack, node, num++, L.askQuestions));
      wrap.append(renderQuiz(pack, node, item, num, 'lnChapterQuiz'));
      return wrap;
    }

    // 1. explanation, stepped
    wrap.append(steppedPart(pack, node, 1, t('lnLessonSteps'), L.sections, ns, locked, update));

    // 2. questions worth asking
    wrap.append(askPart(pack, node, 2, L.askQuestions));

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
    wrap.append(renderQuiz(pack, node, item, 5, 'lnQuizTitle'));
    return wrap;
  }

  /** Sections revealed one at a time ("next part"); progress is persisted per node. */
  function steppedPart(pack, node, num, title, sections, ns, locked, update) {
    const step = locked ? sections.length : Math.min(ns.step || 1, sections.length);
    const exp = h('section', { class: 'ln-part' }, partHead(num, title));
    const ol = h('ol', { class: 'ln-steps' });
    sections.slice(0, step).forEach((sec, i) => {
      ol.append(h('li', { class: 'ln-step' },
        h('p', { class: 'ln-step-count', text: t('lnStepOf', { i: i + 1, n: sections.length }) }),
        h('h4', { text: sec.heading }), sec.body.map(bodyItem)));
    });
    exp.append(ol);
    if (step < sections.length) {
      exp.append(h('button', { type: 'button', class: 'btn secondary ln-wide', key: 'next-part', text: t('lnNextPart'),
        onclick: () => {
          update((cur) => setLessonStep(cur, node.id, step + 1));
          const steps = root.querySelectorAll('.ln-step');
          if (steps.length) steps[steps.length - 1].scrollIntoView({ block: 'start' });
        } }));
    }
    return exp;
  }

  /** "Questions worth asking", each with a copy button (copied text includes course + lesson context). */
  function askPart(pack, node, num, questions) {
    const ask = h('section', { class: 'ln-part' }, partHead(num, t('lnAskTitle')), h('p', { class: 'muted', text: t('lnAskHint') }));
    const ul = h('ul', { class: 'ln-asks' });
    questions.forEach((qText, i) => {
      const msg = h('span', { class: 'ln-copied', role: 'status' });
      const btn = h('button', { type: 'button', class: 'btn secondary ln-copy', key: 'copy-' + i, text: t('lnCopy'), 'aria-label': t('lnCopy') + '：' + qText });
      btn.onclick = async () => {
        const ok = await copyText(t('lnAskPrefix', { course: pack.title, node: node.title }) + qText);
        msg.textContent = ok ? t('lnCopied') : t('lnCopyFailed');
      };
      ul.append(h('li', { class: 'ln-ask' }, h('p', { text: qText }), h('div', { class: 'ln-ask-row' }, btn, msg)));
    });
    ask.append(ul);
    return ask;
  }

  function partHead(n, title) {
    return h('h3', { class: 'ln-part-title' }, h('span', { class: 'ln-part-num', 'aria-hidden': 'true', text: String(n) }), h('span', { text: title }));
  }

  function renderQuiz(pack, node, item, num = 5, titleKey = 'lnQuizTitle') {
    const quiz = node.lesson.quiz;
    if (!quizDraft || quizDraft.nodeId !== node.id) quizDraft = { nodeId: node.id, answers: [], orders: null, grade: null, newlyMastered: false };
    const d = quizDraft;
    const head = partHead(num, t(titleKey));
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
      res.append(h('button', { type: 'button', class: 'btn secondary ln-wide', key: 'to-path', text: t(pack.type === 'exam' ? 'lnBackToChapters' : 'lnBackToPath'), onclick: () => go({ name: 'course', packId: pack.id, tab: pathTab(pack) }) }));
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
