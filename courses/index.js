// Course pack registry. Add a pack by dropping `<id>.js` next to this file and
// listing it below. Each file is imported on its own, so one broken or invalid
// pack is skipped (console warning) without affecting the others or the app.

import { validatePack } from '../js/learn-logic.js';

export const PACK_FILES = [
  './video-editing-basics.js',
];

const defaultImporter = (f) => import(f); // resolved relative to this module

/**
 * Load, validate and de-duplicate packs.
 * @returns {Promise<{packs: object[], rejected: {file:string, errors:string[]}[]}>}
 */
export async function loadPacks(files = PACK_FILES, importer = defaultImporter, warn = (...a) => console.warn(...a)) {
  const packs = [];
  const rejected = [];
  const settled = await Promise.allSettled(files.map((f) => importer(f)));
  settled.forEach((r, i) => {
    const file = files[i];
    if (r.status === 'rejected') {
      rejected.push({ file, errors: [String(r.reason && r.reason.message || r.reason)] });
      warn(`[learn] course pack ${file} failed to load:`, r.reason);
      return;
    }
    const pack = r.value && 'default' in r.value ? r.value.default : r.value;
    const { ok, errors } = validatePack(pack);
    if (!ok) {
      rejected.push({ file, errors });
      warn(`[learn] course pack ${file} is invalid and was hidden:`, errors);
      return;
    }
    if (packs.some((p) => p.id === pack.id)) {
      rejected.push({ file, errors: [`duplicate pack id ${pack.id}`] });
      warn(`[learn] course pack ${file} duplicates id ${pack.id} and was hidden`);
      return;
    }
    packs.push(pack);
  });
  return { packs, rejected };
}
