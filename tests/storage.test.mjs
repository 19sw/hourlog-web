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
