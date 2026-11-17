import test from 'node:test';
import assert from 'node:assert/strict';
import { slotsForDay, presetDate, normalizeText, dayInterval, addDays, toDateTimeInputValue,
  parseDateTimeInput, parseDateInput, toDateInputValue, isSameDay } from '../js/logic.js';

const L = (y, mo, d, h = 0, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s).getTime();
const e = (id, ts) => ({ id, text: id, timestamp: ts });

test('24 slots always, empty hours visible', () => {
  const s = slotsForDay(new Date(2026, 10, 17), []);
  assert.equal(s.length, 24);
  assert.deepEqual(s.map((x) => x.hour), [...Array(24).keys()]);
  assert.ok(s.every((x) => x.isEmpty));
});

test('grouping incl. 00:xx, 23:59:59 and day boundaries', () => {
  const day = new Date(2026, 10, 17, 15);
  const entries = [
    e('prevEnd', L(2026, 11, 16, 23, 59, 59)),
    e('start', L(2026, 11, 17, 0, 0, 0)),
    e('mid', L(2026, 11, 17, 0, 30)),
    e('late', L(2026, 11, 17, 23, 59, 59)),
    e('nextStart', L(2026, 11, 18, 0, 0, 0)),
  ];
  const s = slotsForDay(day, entries);
  assert.deepEqual(s[0].entries.map((x) => x.id), ['start', 'mid']);
  assert.deepEqual(s[23].entries.map((x) => x.id), ['late']);
  assert.equal(s.flatMap((x) => x.entries).length, 3);
});

test('entries sorted ascending within an hour', () => {
  const s = slotsForDay(new Date(2026, 10, 17), [
    e('b', L(2026, 11, 17, 9, 45)), e('a', L(2026, 11, 17, 9, 5)), e('c', L(2026, 11, 17, 9, 59)),
  ]);
  assert.deepEqual(s[9].entries.map((x) => x.id), ['a', 'b', 'c']);
});

test('presetDate gives HH:00 of the day', () => {
  const t = new Date(presetDate(new Date(2026, 10, 17, 18, 33), 7));
  assert.equal([t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds()].join(','), '2026,10,17,7,0,0');
});

test('normalizeText rejects empty/whitespace, trims', () => {
  assert.equal(normalizeText('   \n\t'), null);
  assert.equal(normalizeText(''), null);
  assert.equal(normalizeText(null), null);
  assert.equal(normalizeText('  hi \n'), 'hi');
});

test('day interval and addDays across month/year', () => {
  const { start, end } = dayInterval(new Date(2026, 11, 31, 13));
  assert.equal(start.getTime(), L(2026, 12, 31));
  assert.equal(end.getTime(), L(2027, 1, 1));
  const d = addDays(new Date(2026, 11, 31), 1);
  assert.equal(toDateInputValue(d), '2027-01-01');
  assert.equal(toDateInputValue(addDays(d, -1)), '2026-12-31');
  assert.ok(isSameDay(new Date(2026, 0, 1, 1), new Date(2026, 0, 1, 23)));
});

test('datetime-local roundtrip and validation', () => {
  const ts = L(2026, 11, 17, 8, 5);
  assert.equal(toDateTimeInputValue(ts), '2026-11-17T08:05');
  assert.equal(parseDateTimeInput('2026-11-17T08:05'), ts);
  assert.equal(parseDateTimeInput(''), null);
  assert.equal(parseDateTimeInput('2026-02-31T08:05'), null);
  assert.equal(parseDateInput('2026-11-17').getDate(), 17);
  assert.equal(parseDateInput('nope'), null);
});
