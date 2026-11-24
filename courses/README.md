# Course packs

A course pack is one ES module in this folder that `export default`s a plain object. Register it in `index.js` (`PACK_FILES`). Each pack is imported separately and checked by `validatePack` in `../js/learn-logic.js`. If a pack fails to load or is invalid, it is hidden, a `console.warn` lists the reasons, and the rest of the app keeps working.

Run `node --test` from `web/` after adding or editing a pack. `tests/course-packs.test.mjs` loads every registered pack.

All text is rendered with `textContent`, so markup shows up literally. Write plain text only, with no HTML and no URLs (the app makes no network requests).

## Schema (version 1)

```js
export default {
  schema: 1,                 // required, must be 1
  id: 'video-editing-basics',// required, lowercase a-z 0-9 and '-'; also the progress key, so never rename a published pack
  type: 'topic',             // required. Release A runs 'topic' only; 'exam' and 'role' come in Release B
  lang: 'zh-Hans',           // content language (informational)
  title: '视频剪辑基础',
  summary: '…',              // one or two sentences for the course list

  levels: [                  // exactly 3, ids 1..3, used as goal levels at setup
    { id: 1, label: '入门了解', desc: '…' },
    { id: 2, label: '能独立完成', desc: '…' },
    { id: 3, label: '熟练', desc: '…' },
  ],

  dimensions: [              // skill dimensions for the assessment result and the progress chart (3–4 recommended)
    { id: 'concept', label: '概念理解' },
  ],

  stages: [                  // path groups, in display order
    { id: 'basics', title: '打好基础', summary: '…' },
  ],

  nodes: [                   // lessons, in study order
    {
      id: 'specs',
      stage: 'basics',       // must be a stage id
      title: '…', summary: '…',
      level: 1,              // 1..3. A node above the learner's goal level is shown as "optional"
      dimensions: ['concept'],// 1+ dimension ids. Used for the progress chart
      prereqs: [],           // ids of EARLIER nodes only (no cycles), each with level <= this node's level
      lesson: {
        sections: [ { heading: '…', body: ['paragraph', { code: 'SELECT …;', result: '…' }] } ], // shown one at a time; see "Code blocks"
        askQuestions: ['…'],                                             // "questions worth asking", copyable
        task: { prompt: '…', criteria: ['checkable item', '…'] },        // self-checked acceptance criteria
        reflection: { question: '…', answer: 'reference answer' },
        quiz: [ Question, … ],                                           // 2–3 recommended; pass = all correct
      },
    },
  ],

  assessment: {
    questions: [ { ...Question, node: 'specs', dimension: 'concept' } ], // about 8
  },
};

// Question
{ id: 'specs-q1',            // unique across the whole pack (lesson quizzes and assessment)
  prompt: '…',
  code: 'SELECT …;',         // optional: code shown under the prompt (for "what does this query return?")
  options: ['…', '…', '…'],  // 2+ distinct strings
  answer: 2,                 // index of the ONE correct option
  explanation: '…' }         // why it is right; shown after answering
```

### Code blocks

A lesson body item (topic `sections[].body`, exam `keyPoints[].body`) is either a paragraph string or a code block:

```js
{ code: 'SELECT customer_id, customer_name\nFROM customers;',   // required, non-empty; newlines and indentation are kept
  result: 'customer_id\tcustomer_name\nC001\t北辰科技有限公司',  // optional: query output, tab-separated, header line first
  lang: 'sql' }                                                // optional: 'sql' (default) or 'shell' (terminal commands, no result)
```

- Code is shown in a monospace block that scrolls sideways inside itself, so a long line never widens the page. There is no syntax highlighting. Everything is set with `textContent`.
- `result` is shown as a small table under the code. Every line must have the same number of tab-separated cells; a header line alone means "no rows". `NULL` cells are shown dimmed, numeric columns are right-aligned.
- A Question may have `code` (a non-empty string), shown under the prompt in the same kind of block.
- The validator rejects an empty or non-string `code`, any other key on a code item, an unknown `lang`, a `result` on a shell block and a ragged `result`.
- Packs whose code runs against real data should be checked against that data. `mysql-for-accounting` is: `tools/check-course-sql.mjs` runs every block on MySQL and compares `result` (see `practice/mysql-accounting/README.md`).

### How the engine uses it

- A node is auto-mastered by the assessment only when it has at least one assessment question and all of them were answered correctly. A node with no assessment question has to be learned through its lesson.
- The current node is the first non-mastered node in pack order whose prereqs are all mastered. Required nodes (level at or below the goal) come first. Optional nodes become current only after every required node is mastered. "Prioritize stuck nodes" can override this.
- Order nodes the way a beginner should study them. The validator rejects forward prerequisites, so pack order is always a valid study order.

### Authoring checklist

- Each node has a full lesson (all five parts). Quiz questions test understanding, not trivia. Every question has exactly one correct option and an explanation.
- Vary which option index is correct.
- Name specific products (for example 剪映 / CapCut) only as examples.
- Keep paragraphs short. They are read on a 360-px-wide phone.

## Types: `topic`, `exam`, `role`

All three use the same engine: assessment, then a path, then lessons with a quiz, then progress. Each type adds the fields below. `demoNotice` (a plain sentence) is required for `exam` and `role` packs and is shown wherever the pack appears.

### `exam`

- `levels` may be left out, because every chapter is required. Nodes are chapters: give each one `level: 1` and `prereqs: []`. The study order comes from diagnostic scores.
- Each assessment question tags its chapter with `node` (and `dimension`). A chapter's diagnostic score drives the plan: weakest chapters come first.
- Chapter lessons use a different shape from topic lessons:

```js
lesson: {
  keyPoints: [ { heading, body: ['…'] } ],                // shown one part at a time
  mistakes: ['…'],                                       // common mistakes
  example: { problem: '…', steps: ['…'], answer: '…' },  // worked example, revealed on demand
  askQuestions: ['…'],                                   // optional
  quiz: [ Question, … ],                                 // chapter quiz, same pass rule
}
```

- `exam: { mock: { timeLimitMinutes, questions: [ { ...Question, chapter: '<node id>' } ] } }`. The demo has 15 questions and 20 minutes.
- Learner state adds a daily plan, a wrong-answer notebook (diagnostic, chapter quiz and mock questions) and mock attempts.

### `role`

```js
role: {
  abilities: [ { id, title, what, practice: ['…'], requiredLevel: 1..3, nodes: ['<node id>', …] } ],
  tasks:     [ { id, title, desc, outputs: ['…'], abilities: ['<ability id>', …] } ],
}
```

- Every assessment question needs `ability` (plus `node` and `dimension`). The learner first rates each ability from 0 to 3. If any of an ability's questions is answered wrongly, that ability counts as level 1 at most.
- Gap = required level minus assessed level. A node is mastered by the assessment only when every ability that lists it has gap 0 or less.
- The path is ordered by the largest gap first. A prerequisite inherits the gap of the node that needs it, so it is pulled forward.

### Shared nodes (any type)

A node entry can reuse another pack's lesson instead of repeating it:

```js
{ ref: 'video-editing-basics:cut-points', stage: 'cut' }        // optional: level, dimensions, prereqs, id
```

- The referenced node's title, summary, level, dimensions and lesson are copied in.
- By default, `prereqs` are the source node's prereqs that appear earlier in this pack.
- Progress is kept per pack, so the same lesson in two packs is tracked separately.
- A reference to a pack or node that doesn't exist (or that failed to load) hides the referencing pack, with a console warning.

## Learner progress

Progress is stored under the `hourlog.learning` key as `{ v, courses }`, currently `v: 2`.

- Release A wrote `v: 1`. The upgrade keeps every v1 field and adds defaults (`tests/migration.test.mjs` runs this against a real v1 payload).
- Any new progress field needs a version bump and a step in `migrate()` in `js/learn-store.js`. Otherwise an older build would strip the field.

## Releasing

Every file under `courses/` is listed in `PACK_FILES` with the same `?v=<version>` query as the rest of the app. Before publishing a release, run `node tools/asset-version.mjs bump` from `web/`. `node --test` fails if any reference lacks the current version.
