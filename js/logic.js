// Pure logic shared by browser and Node. Mirrors HourLog/Logic/HourGrouping.swift.

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, n) {
  // Calendar arithmetic (DST-safe): construct from local components.
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n,
    date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
}

/** [start, end) of the local day containing `day`. */
export function dayInterval(day) {
  const start = startOfDay(day);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return { start, end };
}

/** Always 24 slots (0..23). Entries outside `day` are ignored. Each slot sorted ascending by timestamp. */
export function slotsForDay(day, entries) {
  const { start, end } = dayInterval(day);
  const buckets = Array.from({ length: 24 }, () => []);
  for (const e of entries) {
    const t = e.timestamp;
    if (t >= start.getTime() && t < end.getTime()) {
      buckets[new Date(t).getHours()].push(e);
    }
  }
  return buckets.map((list, hour) => ({
    hour,
    entries: list.slice().sort((a, b) => a.timestamp - b.timestamp),
    isEmpty: list.length === 0,
  }));
}

/** HH:00 of `day` as epoch ms. */
export function presetDate(day, hour) {
  const s = startOfDay(day);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate(), hour, 0, 0, 0).getTime();
}

/** Trimmed text, or null if empty/whitespace-only. */
export function normalizeText(raw) {
  const t = String(raw ?? '').trim();
  return t === '' ? null : t;
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const p2 = (n) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" for <input type=date>. */
export function toDateInputValue(date) {
  return `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}`;
}

/** "YYYY-MM-DDTHH:MM" for <input type=datetime-local>. */
export function toDateTimeInputValue(ts) {
  const d = new Date(ts);
  return `${toDateInputValue(d)}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** Parse "YYYY-MM-DD" as local midnight; null if invalid. */
export function parseDateInput(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}

/** Parse "YYYY-MM-DDTHH:MM" (local) to epoch ms; null if invalid. */
export function parseDateTimeInput(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return Number.isNaN(d.getTime()) || d.getMonth() !== +m[2] - 1 ? null : d.getTime();
}
