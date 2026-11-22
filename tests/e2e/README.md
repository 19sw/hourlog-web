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
