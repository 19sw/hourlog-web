// Week boundaries in a timezone with daylight saving time. Set before any Date
// is created; Node re-reads TZ when it changes. node --test runs each test file
// in its own process, so this does not leak into other files.
process.env.TZ = 'America/New_York';

import test from 'node:test';
import assert from 'node:assert/strict';
import { startOfWeek, weekInterval, masteredThisWeek, emptyCourseState } from '../js/learn-logic.js';

const L = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);
const HOUR = 3600e3;

test('TZ override is in effect (DST offsets differ)', () => {
  assert.notEqual(L(2026, 1, 15).getTimezoneOffset(), L(2026, 7, 15).getTimezoneOffset());
  assert.equal(L(2026, 1, 15).getTimezoneOffset(), 300); // EST
});

test('week with DST start (Sun 2026-03-08) is Mon 00:00 to Mon 00:00, 167 hours', () => {
  const { start, end } = weekInterval(L(2026, 3, 8, 12));
  assert.deepEqual([start, end], [L(2026, 3, 2), L(2026, 3, 9)]);
  assert.equal((end - start) / HOUR, 167);
  assert.deepEqual(startOfWeek(L(2026, 3, 9, 0, 0)), L(2026, 3, 9));
  assert.equal(start.getHours(), 0);
  assert.equal(end.getHours(), 0);
});

test('week with DST end (Sun 2026-11-01) is Mon 00:00 to Mon 00:00, 169 hours', () => {
  const { start, end } = weekInterval(L(2026, 11, 1, 1, 30)); // the repeated 01:30
  assert.deepEqual([start, end], [L(2026, 10, 26), L(2026, 11, 2)]);
  assert.equal((end - start) / HOUR, 169);
});

test('weekly count at DST-week edges', () => {
  const s = emptyCourseState();
  s.completions = [
    { nodeId: 'a', at: L(2026, 3, 1, 23, 59).getTime() },  // Sunday before: excluded
    { nodeId: 'b', at: L(2026, 3, 2, 0, 0).getTime() },    // Monday 00:00: included
    { nodeId: 'c', at: L(2026, 3, 8, 3, 30).getTime() },   // just after the spring-forward gap
    { nodeId: 'd', at: L(2026, 3, 8, 23, 59).getTime() },  // Sunday night: included
    { nodeId: 'e', at: L(2026, 3, 9, 0, 0).getTime() },    // next Monday: excluded
  ];
  assert.equal(masteredThisWeek(s, L(2026, 3, 5, 9)), 3);
  s.completions = [
    { nodeId: 'x', at: L(2026, 11, 1, 23, 59).getTime() }, // Sunday night after fall-back: included
    { nodeId: 'y', at: L(2026, 11, 2, 0, 0).getTime() },   // next Monday: excluded
  ];
  assert.equal(masteredThisWeek(s, L(2026, 10, 30, 12)), 1);
});
