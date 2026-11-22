// Pure role-type logic: self-rating, assessed level, gap, gap-based mastery
// and ordering priority. No DOM, no storage.

export const SELF_LEVELS = [0, 1, 2, 3];
const correct = (q, idx) => Number.isInteger(idx) && idx === q.answer;

/**
 * Per ability (Required Behavior 14):
 *   self      self-rating 0..3 (unrated counts as 0)
 *   anyWrong  any of the ability's assessment questions wrong or unanswered
 *   assessed  self, capped at 1 when anyWrong
 *   gap       required - assessed (<= 0 means the ability is already met)
 */
export function abilityGaps(pack, selfRatings, answers) {
  return pack.role.abilities.map((ab) => {
    const self = Number.isInteger(selfRatings[ab.id]) ? selfRatings[ab.id] : 0;
    const qs = pack.assessment.questions.filter((q) => q.ability === ab.id);
    const anyWrong = qs.some((q) => !correct(q, answers[q.id]));
    const assessed = anyWrong ? Math.min(self, 1) : self;
    return { id: ab.id, ability: ab, required: ab.requiredLevel, self, anyWrong, assessed, gap: ab.requiredLevel - assessed };
  });
}

/**
 * Nodes mastered by the role assessment: every ability that lists the node has
 * gap <= 0. (A node shared by a met and an unmet ability stays to be learned.)
 */
export function gapMasteredNodes(pack, selfRatings, answers) {
  const gaps = abilityGaps(pack, selfRatings, answers);
  const out = new Set();
  for (const n of pack.nodes) {
    const owners = gaps.filter((g) => g.ability.nodes.includes(n.id));
    if (owners.length && owners.every((g) => g.gap <= 0)) out.add(n.id);
  }
  return out;
}

/** Ordering priority per node: the largest gap among abilities listing it (0 if none). */
export function nodeGapPriority(pack, selfRatings, answers) {
  const gaps = abilityGaps(pack, selfRatings, answers);
  const m = {};
  for (const n of pack.nodes) {
    const g = gaps.filter((x) => x.ability.nodes.includes(n.id)).map((x) => x.gap);
    m[n.id] = g.length ? Math.max(...g) : 0;
  }
  return m;
}

/**
 * Required-vs-current per ability for the progress view. Current level is the
 * assessed level; once every node of the ability is mastered it is raised to
 * at least the required level.
 */
export function abilityProgress(pack, selfRatings, answers, isMasteredFn, assessed = true) {
  return abilityGaps(pack, selfRatings, answers).map((g) => {
    const mastered = g.ability.nodes.filter(isMasteredFn).length;
    const total = g.ability.nodes.length;
    const base = assessed ? g.assessed : 0;
    const current = mastered === total ? Math.max(base, g.required) : base;
    return { id: g.id, title: g.ability.title, required: g.required, current, mastered, total, met: current >= g.required };
  });
}
