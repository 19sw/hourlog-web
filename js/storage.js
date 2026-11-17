// Entry store with an injectable key/value backend (localStorage-compatible:
// getItem/setItem). All operations are synchronous. If the backend is
// unavailable or a write throws (private mode, quota), the store keeps working
// in memory and `persistent` becomes false so the UI can warn.

const KEY = 'hourlog.entries.v1';

export function createStore(backend) {
  let entries = [];
  let persistent = true;

  function load() {
    try {
      if (!backend) throw new Error('no backend');
      const raw = backend.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      entries = Array.isArray(parsed)
        ? parsed.filter((e) => e && typeof e.id === 'string' && typeof e.text === 'string' && Number.isFinite(e.timestamp))
        : [];
    } catch {
      entries = [];
      persistent = false;
    }
    return entries.slice();
  }

  function flush() {
    try {
      if (!backend) throw new Error('no backend');
      backend.setItem(KEY, JSON.stringify(entries));
      persistent = true; // recovered
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
    list: () => entries.slice(),
    get persistent() { return persistent; },
    /** @returns {{entry, saved:boolean}} saved=false when the write failed (entry still in memory). */
    add({ text, timestamp }) {
      const entry = { id: newId(), text, timestamp };
      entries.push(entry);
      return { entry, saved: flush() };
    },
    update(id, patch) {
      const i = entries.findIndex((e) => e.id === id);
      if (i < 0) return { entry: null, saved: false };
      entries[i] = { ...entries[i], ...patch, id };
      return { entry: entries[i], saved: flush() };
    },
    remove(id) {
      const n = entries.length;
      entries = entries.filter((e) => e.id !== id);
      return { removed: entries.length !== n, saved: flush() };
    },
  };
}
