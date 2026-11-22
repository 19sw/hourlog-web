import { slotsForDay, presetDate, normalizeText, startOfDay, addDays, isSameDay,
  toDateInputValue, toDateTimeInputValue, parseDateInput, parseDateTimeInput } from './logic.js';
import { createStore } from './storage.js';
import { pickLocale, speechLang, t as tr } from './i18n.js';
import { speechSupported, startSpeech } from './speech.js';
import { createLearnStore } from './learn-store.js';
import { initLearn } from './learn.js';

const $ = (id) => document.getElementById(id);
const locale = pickLocale(navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]);
const t = (k, v) => tr(locale, k, v);

function getBackend() {
  try {
    const ls = window.localStorage;
    const k = 'hourlog.probe';
    ls.setItem(k, '1'); ls.removeItem(k);
    return ls;
  } catch { return null; }
}

const store = createStore(getBackend());
store.load();
const learnStore = createLearnStore(getBackend());
learnStore.load();

let currentDay = startOfDay(new Date());
let lastSeenToday = startOfDay(new Date());
let editingId = null;      // null => creating
let editingPreset = null;

const hourFmt = new Intl.DateTimeFormat(locale === 'zh-Hans' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
const hmFmt = hourFmt;

// ---------- static text ----------
function applyStrings() {
  document.documentElement.lang = locale === 'zh-Hans' ? 'zh-Hans' : 'en';
  document.title = t('appName');
  $('appTitle').textContent = t('appName');
  $('helpBtn').setAttribute('aria-label', t('help'));
  $('promptTitle').textContent = t('prompt');
  $('mascotBubble').textContent = t('mascotAsk');
  $('quickText').placeholder = t('placeholder');
  $('quickText').setAttribute('aria-label', t('prompt'));
  $('saveBtn').textContent = t('save');
  $('tabLog').textContent = t('tabLog');
  $('tabTimeline').textContent = t('tabTimeline');
  $('tabLearn').textContent = t('tabLearn');
  $('lnConfirmCancel').textContent = t('cancel');
  $('prevDay').setAttribute('aria-label', t('prevDay'));
  $('nextDay').setAttribute('aria-label', t('nextDay'));
  $('dateLabel').textContent = t('date');
  $('datePicker').setAttribute('aria-label', t('date'));
  $('editEntryLabel').textContent = t('entry');
  $('editTimeLabel').textContent = t('time');
  $('editCancel').textContent = t('cancel');
  $('editSave').textContent = t('save');
  $('editDelete').textContent = t('delete');
  $('confirmTitle').textContent = t('deleteTitle');
  $('confirmBody').textContent = t('deleteBody');
  $('confirmCancel').textContent = t('cancel');
  $('confirmOk').textContent = t('delete');
  $('tipTitle').textContent = t('tipTitle');
  $('tipBody').textContent = t('tipBody');
  $('tipPrivacy').textContent = t('tipPrivacy');
  $('tipOk').textContent = t('gotIt');
  setMicIdle();
}

function updateWarn() {
  const w = $('warn');
  if (!store.persistent) { w.hidden = false; w.textContent = t('storageWarn'); }
  else if (!learnStore.persistent && !learnStore.readOnly) { w.hidden = false; w.textContent = t('storageWarnLearn'); }
  else { w.hidden = true; }
}

// ---------- tabs ----------
function showTab(name) {
  const tl = name === 'timeline';
  const ln = name === 'learn';
  $('viewLog').hidden = name !== 'log';
  $('viewTimeline').hidden = !tl;
  $('viewLearn').hidden = !ln;
  $('tabLog').setAttribute('aria-selected', String(name === 'log'));
  $('tabTimeline').setAttribute('aria-selected', String(tl));
  $('tabLearn').setAttribute('aria-selected', String(ln));
  if (tl) { renderTimeline(); scrollToCurrentHour(); }
  if (ln) { document.querySelector('main').scrollTop = 0; learn.show(); }
}
$('tabLog').onclick = () => showTab('log');
$('tabTimeline').onclick = () => showTab('timeline');
$('tabLearn').onclick = () => showTab('learn');

// ---------- quick entry ----------
let speech = null;
function setMicIdle() {
  $('micBtn').classList.remove('active');
  $('micBtn').setAttribute('aria-pressed', 'false');
  $('micLabel').textContent = t('micStart');
}
function setMicActive() {
  $('micBtn').classList.add('active');
  $('micBtn').setAttribute('aria-pressed', 'true');
  $('micLabel').textContent = t('micStop');
}
function speechMsg(key) {
  const m = $('speechMsg');
  if (!key) { m.hidden = true; m.textContent = ''; return; }
  m.hidden = false; m.textContent = t(key);
}
function stopSpeech() { if (speech) { speech.stop(); } }
function cancelSpeech() { if (speech) { speech.cancel(); speech = null; setMicIdle(); speechMsg(null); } }

$('micBtn').onclick = () => {
  if (speech) { stopSpeech(); return; }
  speechMsg(null);
  if (!speechSupported()) { speechMsg('micUnsupported'); return; }
  const ta = $('quickText');
  speech = startSpeech({
    lang: speechLang(locale),
    baseText: ta.value,
    onText: (full) => { ta.value = full; },
    onEnd: (hadError, c) => { if (c && speech && c !== speech) return; speech = null; setMicIdle(); if (!hadError) { speechMsg(null); ta.focus({ preventScroll: true }); } },
    onError: (kind) => {
      speech = null; setMicIdle();
      speechMsg(kind === 'denied' ? 'micDenied' : kind === 'unsupported' ? 'micUnsupported' : 'micFailed');
    },
  });
  if (speech) { setMicActive(); $('speechMsg').hidden = false; $('speechMsg').textContent = t('listening'); }
};

$('saveBtn').onclick = () => {
  cancelSpeech();
  const text = normalizeText($('quickText').value);
  if (!text) { $('quickText').focus(); return; }
  const ts = Date.now();
  const { saved } = store.add({ text, timestamp: ts });
  $('quickText').value = '';
  speechMsg(null);
  $('savedMsg').textContent = t('savedAt', { time: hmFmt.format(new Date(ts)) });
  updateWarn();
  if (!saved && store.persistent === false) { /* warning banner already shown */ }
  renderTimeline();
  if (saved) celebrate();
};

// ---------- mascot ----------
let celebrateTimer = null;
function celebrate() {
  const m = $('mascot');
  clearTimeout(celebrateTimer);
  m.classList.remove('hop');
  void m.offsetWidth; // restart the hop animation on rapid saves
  m.classList.add('happy', 'hop');
  $('mascotBubble').textContent = t('mascotSaved');
  celebrateTimer = setTimeout(() => {
    m.classList.remove('happy', 'hop');
    $('mascotBubble').textContent = t('mascotAsk');
  }, 2000);
}

// ---------- timeline ----------
function renderTimeline() {
  $('datePicker').value = toDateInputValue(currentDay);
  const now = new Date();
  const isToday = isSameDay(currentDay, now);
  const slots = slotsForDay(currentDay, store.list());
  const dayEmpty = !slots.some((s) => !s.isEmpty);
  $('dayEmpty').hidden = !dayEmpty;
  $('dayEmptyText').textContent = t(isToday ? 'dayEmptyToday' : 'dayEmptyOther');
  const ol = $('hours');
  ol.textContent = '';
  let slipN = 0;
  for (const s of slots) {
    const li = document.createElement('li');
    li.className = 'hour' + (isToday && s.hour === now.getHours() ? ' current' : '');
    li.dataset.hour = String(s.hour);
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = hourFmt.format(new Date(presetDate(currentDay, s.hour)));
    const body = document.createElement('div');
    body.className = 'body';
    if (s.isEmpty) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'empty';
      b.textContent = t('nothing') + ' · ' + t('addEntry');
      b.onclick = () => openEditor(null, presetDate(currentDay, s.hour));
      body.append(b);
    } else {
      for (const e of s.entries) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'item';
        const time = document.createElement('span');
        time.className = 'time slip slip-' + (slipN % 2 ? 'blue' : 'pink') + ' tilt-' + (slipN % 4);
        slipN++;
        time.textContent = hmFmt.format(new Date(e.timestamp));
        b.append(time, document.createTextNode(e.text));
        b.onclick = () => openEditor(e, null);
        body.append(b);
      }
    }
    li.append(label, body);
    ol.append(li);
  }
}

function scrollToCurrentHour() {
  if (!isSameDay(currentDay, new Date())) { $('viewTimeline').closest('main').scrollTop = 0; return; }
  const row = document.querySelector(`.hour[data-hour="${new Date().getHours()}"]`);
  if (row) row.scrollIntoView({ block: 'center' });
}

function setDay(d) {
  currentDay = startOfDay(d);
  renderTimeline();
  scrollToCurrentHour();
}
$('prevDay').onclick = () => setDay(addDays(currentDay, -1));
$('nextDay').onclick = () => setDay(addDays(currentDay, 1));
$('datePicker').onchange = (e) => { const d = parseDateInput(e.target.value); if (d) setDay(d); };

// ---------- editor ----------
function editMsg(key) {
  const m = $('editMsg');
  m.hidden = !key; m.textContent = key ? t(key) : '';
}
function openEditor(entry, presetTs) {
  editMsg(null);
  editingId = entry ? entry.id : null;
  $('editTitle').textContent = entry ? t('editEntry') : t('newEntry');
  $('editText').value = entry ? entry.text : '';
  $('editTime').value = toDateTimeInputValue(entry ? entry.timestamp : presetTs);
  $('editDelete').hidden = !entry;
  $('editor').showModal();
}
$('editCancel').onclick = () => $('editor').close();
$('editForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const text = normalizeText($('editText').value);
  const ts = parseDateTimeInput($('editTime').value);
  if (!text) { editMsg('errEmpty'); $('editText').focus(); return; }
  if (ts === null) { editMsg('errTime'); $('editTime').focus(); return; }
  editMsg(null);
  if (editingId) store.update(editingId, { text, timestamp: ts });
  else store.add({ text, timestamp: ts });
  updateWarn();
  $('editor').close();
  // Follow the entry to its day if the time was moved to another day.
  if (!isSameDay(new Date(ts), currentDay)) currentDay = startOfDay(new Date(ts));
  renderTimeline();
});
$('editDelete').onclick = () => $('confirm').showModal();
$('confirmCancel').onclick = () => $('confirm').close();
$('confirmOk').onclick = () => {
  if (editingId) store.remove(editingId);
  updateWarn();
  $('confirm').close();
  $('editor').close();
  renderTimeline();
};

// ---------- learn ----------
let confirmAction = null;
function learnConfirm({ title, body, ok }, onOk) {
  $('lnConfirmTitle').textContent = title;
  $('lnConfirmBody').textContent = body;
  $('lnConfirmOk').textContent = ok;
  confirmAction = onOk;
  $('lnConfirm').showModal();
}
$('lnConfirmCancel').onclick = () => { confirmAction = null; $('lnConfirm').close(); };
$('lnConfirmOk').onclick = () => {
  const fn = confirmAction; confirmAction = null; // run once even on a double tap
  $('lnConfirm').close();
  if (fn) fn();
};
const learn = initLearn({
  root: $('learnRoot'),
  scroller: document.querySelector('main'),
  entries: store,
  learnStore,
  t,
  locale,
  onTimelineChange: () => { updateWarn(); renderTimeline(); },
  onStorageChange: updateWarn,
  confirm: learnConfirm,
});

// ---------- help tip ----------
$('helpBtn').onclick = () => $('tip').showModal();
$('tipOk').onclick = () => { $('tip').close(); try { localStorage.setItem('hourlog.tipSeen', '1'); } catch { /* ignore */ } };

// ---------- day rollover on return ----------
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  // Another tab may have written while this one was in the background.
  store.refresh();
  learnStore.refresh();
  const today = startOfDay(new Date());
  if (today.getTime() !== lastSeenToday.getTime()) {
    const wasOnOldToday = isSameDay(currentDay, lastSeenToday);
    lastSeenToday = today;
    if (wasOnOldToday) currentDay = today;
  }
  renderTimeline();
  if (!$('viewTimeline').hidden) scrollToCurrentHour();
  if (!$('viewLearn').hidden) learn.show();
});

// ---------- other tabs ----------
// Writes re-read storage first (see storage.js / learn-store.js); this keeps
// what is on screen current too.
window.addEventListener('storage', (e) => {
  if (e.key !== null && !e.key.startsWith('hourlog.')) return;
  store.refresh();
  learnStore.refresh();
  updateWarn();
  renderTimeline();
  if (!$('viewLearn').hidden) learn.show();
});

// ---------- init ----------
applyStrings();
updateWarn();
renderTimeline();
(function maybeShowTip() {
  try {
    if (!localStorage.getItem('hourlog.tipSeen')) $('tip').showModal();
  } catch { /* storage unavailable: don't nag */ }
})();
