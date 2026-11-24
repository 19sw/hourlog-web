// Course pack registry. Add a pack by dropping `<id>.js` next to this file and
// listing it below (keep the `?v=` release suffix: see tools/asset-version.mjs).
// Each file is imported on its own, so one broken or invalid pack is skipped
// (console warning) without affecting the others or the app.

import { validatePack, resolvePack } from '../js/learn-logic.js?v=20261123c';

export const PACK_FILES = [
  './video-editing-basics.js?v=20261123c',
  './micro-econ-final.js?v=20261123c',
  './short-video-editor.js?v=20261123c',
  './mysql-for-accounting.js?v=20261123c',
];

const defaultImporter = (f) => import(f); // resolved relative to this module

/**
 * Load, resolve shared-node references, validate and de-duplicate packs.
 * Packs without references are validated first; a referencing pack may only
 * point at a pack that loaded and validated, otherwise it is rejected as
 * dangling.
 * @returns {Promise<{packs: object[], rejected: {file:string, errors:string[]}[]}>}
 */
export async function loadPacks(files = PACK_FILES, importer = defaultImporter, warn = (...a) => console.warn(...a)) {
  const settled = await Promise.allSettled(files.map((f) => importer(f)));
  const loaded = [];
  const rejected = [];
  const reject = (file, errors, msg) => { rejected.push({ file, errors }); warn(`[learn] course pack ${file} ${msg}:`, errors); };
  settled.forEach((r, i) => {
    if (r.status === 'rejected') { reject(files[i], [String((r.reason && r.reason.message) || r.reason)], 'failed to load'); return; }
    loaded.push({ file: files[i], pack: r.value && 'default' in r.value ? r.value.default : r.value });
  });
  const hasRefs = (p) => p && Array.isArray(p.nodes) && p.nodes.some((n) => n && 'ref' in n);
  const ok = new Map();
  const accept = ({ file, pack }) => {
    const { ok: valid, errors } = validatePack(pack);
    if (!valid) { reject(file, errors, 'is invalid and was hidden'); return; }
    if (ok.has(pack.id)) { reject(file, [`duplicate pack id ${pack.id}`], 'duplicates another pack id and was hidden'); return; }
    ok.set(pack.id, { file, pack });
  };
  for (const item of loaded.filter((x) => !hasRefs(x.pack))) accept(item);
  for (const item of loaded.filter((x) => hasRefs(x.pack))) {
    const sources = new Map([...ok.values()].map((x) => [x.pack.id, x.pack]));
    const r = resolvePack(item.pack, sources);
    if (r.errors.length) { reject(item.file, r.errors, 'has dangling shared-node references and was hidden'); continue; }
    accept({ file: item.file, pack: r.pack });
  }
  // keep registry order
  const packs = loaded.filter((x) => x.pack && ok.has(x.pack.id) && ok.get(x.pack.id).file === x.file).map((x) => ok.get(x.pack.id).pack);
  return { packs, rejected };
}
