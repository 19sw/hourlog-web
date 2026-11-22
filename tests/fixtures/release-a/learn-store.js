// Learning-progress store. Separate from the entries store and never touches
// its key. Same failure semantics as storage.js: if the backend is missing or a
// write throws, everything keeps working in memory and `persistent` is false.
//
// Stored payload (key `hourlog.learning`):
//   { v: 1, courses: { [packId]: CourseState } }   (CourseState: see learn-logic.js)
// Future versions bump `v` and add a step to `migrate`.

import { normalizeCourseState } from './learn-logic.js';

export const LEARN_KEY = 'hourlog.learning';
export const LEARN_BACKUP_KEY = 'hourlog.learning.corrupt';
export const LEARN_VERSION = 1;

/**
 * Bring a parsed payload up to LEARN_VERSION. Returns { data, readOnly }.
 * readOnly is true when the payload comes from a newer build; we then never
 * overwrite it so a downgrade cannot destroy newer progress.
 */
export function migrate(parsed) {
  if (!parsed || typeof parsed !== 'object' || !Number.isInteger(parsed.v)) return { data: null, readOnly: false };
  if (parsed.v > LEARN_VERSION) return { data: parsed, readOnly: true };
  // v1 is current. Future: if (parsed.v === 1) parsed = v1ToV2(parsed); ...
  const courses = {};
  const src = parsed.courses && typeof parsed.courses === 'object' ? parsed.courses : {};
  for (const [id, cs] of Object.entries(src)) courses[id] = normalizeCourseState(cs);
  return { data: { v: LEARN_VERSION, courses }, readOnly: false };
}

export function createLearnStore(backend) {
  let data = { v: LEARN_VERSION, courses: {} };
  let persistent = true;
  let readOnly = false;

  function load() {
    try {
      if (!backend) throw new Error('no backend');
      const raw = backend.getItem(LEARN_KEY);
      if (raw) {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
        const m = migrate(parsed);
        if (m.readOnly) {
          readOnly = true; persistent = false;
          data = { v: LEARN_VERSION, courses: {} };
          for (const [id, cs] of Object.entries(m.data.courses || {})) data.courses[id] = normalizeCourseState(cs);
        } else if (m.data) {
          data = m.data;
        } else {
          // Unreadable: keep a copy before it can be overwritten.
          try { backend.setItem(LEARN_BACKUP_KEY, raw); } catch { /* ignore */ }
        }
      }
    } catch {
      persistent = false;
    }
    return data;
  }

  // Re-read before every read-modify-write so another tab's progress is never
  // overwritten by a stale in-memory copy. Skipped while degraded (memory is
  // then the only copy) and when read-only (nothing is written anyway).
  function refresh() {
    if (!persistent || readOnly || !backend) return;
    try {
      const raw = backend.getItem(LEARN_KEY);
      if (!raw) { data = { v: LEARN_VERSION, courses: {} }; return; }
      let parsed;
      try { parsed = JSON.parse(raw); } catch { return; }
      const m = migrate(parsed);
      if (m.readOnly) { readOnly = true; persistent = false; return; } // a newer build wrote meanwhile
      if (m.data) data = m.data;
    } catch { /* keep memory */ }
  }

  function flush() {
    if (readOnly) { persistent = false; return false; }
    try {
      if (!backend) throw new Error('no backend');
      backend.setItem(LEARN_KEY, JSON.stringify(data));
      persistent = true;
      return true;
    } catch {
      persistent = false;
      return false;
    }
  }

  return {
    load,
    get persistent() { return persistent; },
    get readOnly() { return readOnly; },
    /** Pick up changes written by other tabs. */
    refresh,
    /** Copy of a course's state as last loaded, or null if never started. */
    getCourse(id) { return data.courses[id] ? JSON.parse(JSON.stringify(data.courses[id])) : null; },
    /**
     * Atomic read-modify-write of one course: reloads from storage, passes the
     * fresh state (or null) to fn, and saves fn's result unless it returned the
     * same object (no change) or the store is read-only.
     * @returns {{ state, changed: boolean, saved: boolean }}
     */
    update(id, fn) {
      refresh();
      const before = data.courses[id] ? JSON.parse(JSON.stringify(data.courses[id])) : null;
      const after = fn(before);
      if (after === before || after === undefined) return { state: before, changed: false, saved: false };
      if (readOnly) return { state: before, changed: false, saved: false };
      data.courses[id] = normalizeCourseState(after);
      return { state: this.getCourse(id), changed: true, saved: flush() };
    },
    /** @returns {boolean} saved */
    saveCourse(id, state) {
      if (readOnly) return false;
      refresh();
      data.courses[id] = normalizeCourseState(state);
      return flush();
    },
    removeCourse(id) {
      if (readOnly) return false;
      refresh();
      delete data.courses[id];
      return flush();
    },
  };
}
