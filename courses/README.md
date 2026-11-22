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
        sections: [ { heading: '…', body: ['paragraph', 'paragraph'] } ], // shown one at a time
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
  options: ['…', '…', '…'],  // 2+ distinct strings
  answer: 2,                 // index of the ONE correct option
  explanation: '…' }         // why it is right; shown after answering
```

### How the engine uses it

- A node is auto-mastered by the assessment only when it has at least one assessment question and all of them were answered correctly. A node with no assessment question has to be learned through its lesson.
- The current node is the first non-mastered node in pack order whose prereqs are all mastered. Required nodes (level at or below the goal) come first. Optional nodes become current only after every required node is mastered. "Prioritize stuck nodes" can override this.
- Order nodes the way a beginner should study them. The validator rejects forward prerequisites, so pack order is always a valid study order.

### Authoring checklist

- Each node has a full lesson (all five parts). Quiz questions test understanding, not trivia. Every question has exactly one correct option and an explanation.
- Vary which option index is correct.
- Name specific products (for example 剪映 / CapCut) only as examples.
- Keep paragraphs short. They are read on a 360-px-wide phone.

## Release B (planned extensions, not implemented)

These additions are backward compatible: version-1 topic packs stay valid.

- `type: 'exam'` adds an `exam` block (mock question set with `chapter` tags, time limit). Nodes act as chapters. Lesson sections can carry `kind` (`keyPoints` / `mistakes` / `example`).
- `type: 'role'` adds a `role` block: `tasks[]` (each with `outputs[]` and `abilities[]`) and `abilities[]` (`requiredLevel` 1–3, `nodes[]`, `what`, `practice`).
- Shared nodes: a node entry `{ ref: '<packId>:<nodeId>' }` reuses another pack's lesson content. Progress stays per pack, and the validator rejects dangling references.
- Learner progress lives under the `hourlog.learning` key (`{ v, courses }`). Release B bumps `v` to 2 and adds a migration step in `js/learn-store.js`, so Release A progress carries over.
