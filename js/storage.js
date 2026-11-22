// Entry store with an injectable key/value backend (localStorage-compatible:
// getItem/setItem). All operations are synchronous. If the backend is
// unavailable or a write throws (private mode, quota), the store keeps working
// in memory and `persistent` becomes false so the UI can warn. Degraded is
// sticky for the session: no later write may push a stale in-memory copy over
// what other tabs saved meanwhile. A corrupt payload is backed up, then
// replaced on the next write.

const KEY = 'hourlog.entries.v1';
const BACKUP_KEY = 'hourlog.entries.v1.corrupt';

const valid = (e) => e && typeof e.id === 'string' && typeof e.text === 'string' && Number.isFinite(e.timestamp);

export function createStore(backend) {
  let entries = [];
  let persistent = true;

  function load() {
    try {
      if (!backend) throw new Error('no backend');
      const raw = backend.getItem(KEY);
      let parsed;
      try { parsed = raw ? JSON.parse(raw) : []; } catch {
        parsed = [];
        try { backend.setItem(BACKUP_KEY, raw); } catch { /* ignore */ }
      }
      entries = Array.isArray(parsed)
        ? parsed.filter(valid)
        : [];
    } catch {
      entries = [];
      persistent = false;
    }
    return entries.slice();
  }

  // Re-read the backend before every write so a second tab (or a stale tab
  // left open for days) cannot overwrite entries it never saw. Skipped while
  // degraded: then memory is the only copy and must not be replaced.
  function refresh() {
    if (!persistent || !backend) return;
    try {
      const raw = backend.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) entries = parsed.filter(valid);
    } catch { /* keep memory */ }
  }

  function flush() {
    if (!persistent) return false; // degraded: stay in memory until reload
    try {
      if (!backend) throw new Error('no backend');
      backend.setItem(KEY, JSON.stringify(entries));
      return true;
    } catch {
      persistent = false;
      return false;
    }
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  return {
    load,
    /** Pick up changes written by other tabs (no-op while degraded). */
    refresh,
    list: () => entries.slice(),
    get persistent() { return persistent; },
    /** @returns {{entry, saved:boolean}} saved=false when the write failed (entry still in memory). */
    add({ text, timestamp }) {
      refresh();
      const entry = { id: newId(), text, timestamp };
      entries.push(entry);
      return { entry, saved: flush() };
    },
    update(id, patch) {
      refresh();
      const i = entries.findIndex((e) => e.id === id);
      if (i < 0) return { entry: null, saved: false };
      entries[i] = { ...entries[i], ...patch, id };
      return { entry: entries[i], saved: flush() };
    },
    remove(id) {
      refresh();
      const n = entries.length;
      entries = entries.filter((e) => e.id !== id);
      return { removed: entries.length !== n, saved: flush() };
    },
  };
}
