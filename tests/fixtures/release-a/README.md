# Frozen Release A code (do not edit)

Exact copies of files from the published Release A commit (9ecd1a6), used by
`tests/migration.test.mjs`:

- `learn-store.js` + `learn-logic.js`: the v1 store, to prove that a Release A
  tab still open after the upgrade treats v2 data as read-only and never
  overwrites it.
- `video-editing-basics.js`: the published pack. Saved assessment answers are
  option indexes, so the current pack's assessment questions must stay
  identical to these (options and answer index). The test enforces it; bias is
  removed by shuffling the display order per attempt instead.
