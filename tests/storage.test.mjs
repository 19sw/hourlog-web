import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/storage.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m }; };

test('CRUD and persistence across store instances', () => {
  const b = mem();
  const s = createStore(b); s.load();
  const { entry, saved } = s.add({ text: 'a', timestamp: 100 });
  assert.ok(saved && entry.id);
  s.add({ text: 'b', timestamp: 200 });
  s.update(entry.id, { text: 'a2', timestamp: 300 });
  const s2 = createStore(b); s2.load();
  assert.deepEqual(s2.list().map((e) => [e.text, e.timestamp]), [['a2', 300], ['b', 200]]);
  assert.equal(s2.remove(entry.id).removed, true);
  assert.equal(s2.remove('missing').removed, false);
  const s3 = createStore(b); s3.load();
  assert.equal(s3.list().length, 1);
  assert.equal(s.persistent, true);
});

test('update cannot change id; unknown id is a no-op', () => {
  const s = createStore(mem()); s.load();
  const { entry } = s.add({ text: 'x', timestamp: 1 });
  assert.equal(s.update(entry.id, { id: 'evil', text: 'y' }).entry.id, entry.id);
  assert.equal(s.update('nope', { text: 'z' }).entry, null);
});

test('corrupt data is tolerated', () => {
  const b = mem(); b.setItem('hourlog.entries.v1', '{not json');
  const s = createStore(b); assert.deepEqual(s.load(), []);
  b.setItem('hourlog.entries.v1', JSON.stringify([{ id: 'a', text: 't', timestamp: 5 }, { bad: 1 }, null]));
  assert.equal(createStore(b).load().length, 1);
});

test('write failure keeps in-memory data and flags non-persistent', () => {
  const b = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
  const s = createStore(b); s.load();
  const r = s.add({ text: 'x', timestamp: 1 });
  assert.equal(r.saved, false);
  assert.equal(s.persistent, false);
  assert.equal(s.list().length, 1);
});

test('missing backend works in memory', () => {
  const s = createStore(null); s.load();
  assert.equal(s.persistent, false);
  assert.equal(s.add({ text: 'x', timestamp: 1 }).saved, false);
  assert.equal(s.list().length, 1);
});

test('two tabs sharing storage: alternating writes from stale copies all survive', () => {
  const b = mem();
  const tabA = createStore(b); tabA.load();
  const tabB = createStore(b); tabB.load(); // both loaded while storage was empty
  const a1 = tabA.add({ text: 'from A', timestamp: 1 }).entry;
  tabB.add({ text: 'from B', timestamp: 2 });            // B never saw A's entry in memory
  tabA.update(a1.id, { text: 'from A, edited' });         // A never saw B's entry
  const b2 = tabB.add({ text: 'from B again', timestamp: 3 }).entry;
  tabA.remove(b2.id);                                     // A deletes an entry it never loaded
  const fresh = createStore(b); fresh.load();
  assert.deepEqual(fresh.list().map((e) => e.text).sort(), ['from A, edited', 'from B']);
  // in-memory views catch up on the next write or an explicit refresh
  tabB.refresh();
  assert.equal(tabB.list().length, 2);
});

test('refresh never replaces memory while degraded', () => {
  let fail = false;
  const m = new Map();
  const b = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { if (fail) throw new Error('quota'); m.set(k, v); } };
  const s = createStore(b); s.load();
  s.add({ text: 'saved', timestamp: 1 });
  fail = true;
  s.add({ text: 'memory only', timestamp: 2 });
  assert.equal(s.persistent, false);
  s.refresh();
  assert.deepEqual(s.list().map((e) => e.text), ['saved', 'memory only']);
});

test('N3: after a write failure the store stays in memory, so a later working write cannot clobber other tabs', () => {
  let fail = false;
  const m = new Map();
  const b = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { if (fail) throw new Error('quota'); m.set(k, v); } };
  const a = createStore(b); a.load();
  a.add({ text: 'a1', timestamp: 1 });
  fail = true;
  a.add({ text: 'a2 (memory only)', timestamp: 2 });
  fail = false;
  const other = createStore(b); other.load();
  other.add({ text: 'from another tab', timestamp: 3 });
  const r = a.add({ text: 'a3', timestamp: 4 });  // storage works again
  assert.equal(r.saved, false);
  assert.equal(a.persistent, false);
  const fresh = createStore(b); fresh.load();
  assert.deepEqual(fresh.list().map((e) => e.text), ['a1', 'from another tab']);
  assert.deepEqual(a.list().map((e) => e.text), ['a1', 'a2 (memory only)', 'a3']);
});

test('corrupt entries are backed up, then replaced on the next write', () => {
  const b = mem(); b.setItem('hourlog.entries.v1', '{oops');
  const s = createStore(b); s.load();
  assert.equal(b.getItem('hourlog.entries.v1.corrupt'), '{oops');
  assert.equal(s.add({ text: 'x', timestamp: 1 }).saved, true);
});
