# Headless end-to-end journey

Drives the real app in headless Chrome over the DevTools protocol. It is not part of `node --test`: the files here do not match its test-file patterns, and the journey needs Chrome.

## Run

```
cd web
node tests/e2e/run.mjs
```

Requirements: Node 22 or newer (built-in `WebSocket`), `python3`, and Google Chrome. The script assumes the default macOS Chrome path; set `CHROME=/path/to/chrome` to override it.

The script serves `web/` at `http://127.0.0.1:<random port>/hourlog-web/` (the same subpath as GitHub Pages) and starts Chrome with a throwaway profile. Both are stopped when it finishes. It prints PASS or FAIL per check and exits non-zero on any failure.

Options:
- `LANG_UI=en-US` runs with the English UI (default `zh-CN`).
- `OUT=/some/dir` sets where screenshots go (default: `hourlog-e2e-shots` in the OS temp folder).

## What it covers

It runs at 375×812 on a phone viewport: setup → baseline quiz (feedback, focus, double taps) → path statuses → lesson.

The lesson step checks the copy button, then a failed quiz (no answer reveal, focus on the result), a shuffled retry, and a pass. Each event must add exactly one timeline entry. It then checks progress, adjusting the plan, persistence across a reload, and overflow at 360 and 375 px, plus 44-px tap targets.

It also covers:
- dark mode (screenshot only);
- the read-only state from a newer version;
- a frozen second tab writing over newer progress and entries (F1);
- reset with confirmation;
- that no external requests are made and the console has no errors.

Release B adds checks for:
- a Release A (v1) user upgrading;
- the type chooser;
- the exam journey: date validation, countdown, diagnostic, plan (weakest first, mock on the last day), the behind state and re-plan, a chapter quiz that does not reveal answers, the notebook (redo wrong, then right), and the mock exam (reload mid-exam, visible countdown, auto-submit after time runs out, per-chapter result and revisit list, one timeline entry per hand-in);
- the role journey: self-rating, gap cap, gap-ordered path, map → task → ability → lesson, a shared lesson with separate progress, required-vs-current;
- 360 and 375 px widths and tap targets on the new views.


## 会计人的 MySQL smoke

```
cd web
node tests/e2e/mysql-course.mjs
```

Same requirements and `OUT` option (default `hourlog-e2e-mysql` in the OS temp folder). It checks: the course is listed; setup, assessment (questions with code show it), result, path (assessed early nodes mastered, setup current); a lesson with code blocks and query results rendered verbatim as monospace blocks and tables that scroll inside themselves; no page overflow at 360 and 375 px in light and dark; AA contrast of code text, table header and NULL cells; a quiz with code passes; another course's saved progress is untouched; no external requests or console messages. It then serves a copy of `web/` whose pack carries markup in a code block, a result header and a question's code, and checks that it shows as text and never runs.
