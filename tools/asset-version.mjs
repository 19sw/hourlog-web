// Release cache-busting for a no-build static site.
//
// Every relative module import, dynamic import, course pack file and asset URL
// in index.html carries the same `?v=<version>` query. Browsers treat
// `x.js?v=A` and `x.js?v=B` as different URLs, so a new release can never mix
// a freshly fetched module with a stale cached one (e.g. new app.js + old
// storage.js).
//
//   node tools/asset-version.mjs check          # references without the current version, or shipped files
//                                               # changed since git HEAD while the version stayed the same (exit 1)
//   node tools/asset-version.mjs bump [version] # stamp every reference with a new version (default: YYYYMMDD + letter)
//
// tests/asset-version.test.mjs runs `check` as part of `node --test`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_RE = /[a-z0-9]+/;

/** Files shipped to the browser that reference other shipped files. */
export function shippedFiles(root = WEB) {
  const list = ['index.html'];
  for (const dir of ['js', 'courses']) {
    for (const f of fs.readdirSync(path.join(root, dir))) if (f.endsWith('.js')) list.push(`${dir}/${f}`);
  }
  return list;
}

// Relative references: static/dynamic imports, string entries in PACK_FILES,
// and href/src attributes in HTML (fragments, data: and absolute URLs excluded).
const JS_REF = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*)(['"])(\.\.?\/[^'"\s]+)\1/gm;
const HTML_REF = /\b(?:href|src)\s*=\s*(['"])(?!#|data:|https?:|\/\/)([^'"]+)\1/g;

export function findRefs(root = WEB) {
  const refs = [];
  for (const file of shippedFiles(root)) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const re = file.endsWith('.html') ? HTML_REF : JS_REF;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const line = text.slice(0, m.index).split('\n').length;
      refs.push({ file, line, ref: m[2] });
    }
  }
  return refs;
}

export function currentVersion(root = WEB) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const m = /js\/app\.js\?v=([a-z0-9]+)/.exec(html);
  return m ? m[1] : null;
}

/** Files whose change requires a new version (what the browser downloads). */
const SHIPPED_PATHS = ['index.html', 'styles.css', 'manifest.webmanifest', 'js', 'courses', 'icons'];

/**
 * Compare with the last commit: if shipped files changed but index.html still
 * carries the version HEAD had, the release forgot `bump`. Degrades to
 * { available: false } outside a git checkout or without git.
 */
export function gitState(root = WEB) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    if (git('rev-parse', '--show-toplevel').trim() !== fs.realpathSync(root)) return { available: false, reason: 'not the web/ repository root' };
    let headHtml = '';
    try { headHtml = git('show', 'HEAD:index.html'); } catch { return { available: false, reason: 'no commit yet' }; }
    const m = /js\/app\.js\?v=([a-z0-9]+)/.exec(headHtml);
    const changed = [
      ...git('diff', '--name-only', 'HEAD', '--', ...SHIPPED_PATHS).split('\n'),
      ...git('ls-files', '--others', '--exclude-standard', '--', ...SHIPPED_PATHS).split('\n'),
    ].filter(Boolean);
    return { available: true, headVersion: m ? m[1] : null, changed };
  } catch {
    return { available: false, reason: 'git not available' };
  }
}

/** Pure rule used by check(): shipped files changed + same version as HEAD = forgotten bump. */
export function releaseRule({ version, headVersion, changed }) {
  if (!changed.length) return { ok: true };
  if (headVersion && headVersion === version) {
    return { ok: false, reason: `${changed.length} shipped file(s) changed since the last commit but the version is still ?v=${version}: run node tools/asset-version.mjs bump` };
  }
  return { ok: true };
}

export function check(root = WEB, { git = gitState(root) } = {}) {
  const v = currentVersion(root);
  const bad = findRefs(root).filter((r) => !v || !r.ref.endsWith(`?v=${v}`));
  const release = git.available ? releaseRule({ version: v, headVersion: git.headVersion, changed: git.changed }) : { ok: true, skipped: git.reason };
  return { version: v, bad, release };
}

export function bump(version, root = WEB) {
  if (!VERSION_RE.test(version)) throw new Error('version must be [a-z0-9]+');
  let changed = 0;
  for (const file of shippedFiles(root)) {
    const p = path.join(root, file);
    const text = fs.readFileSync(p, 'utf8');
    const re = file.endsWith('.html') ? HTML_REF : JS_REF;
    const out = text.replace(re, (all, q, ref) => {
      const bare = ref.replace(/\?v=[a-z0-9]*$/, '');
      return all.replace(q + ref + q, `${q}${bare}?v=${version}${q}`);
    });
    if (out !== text) { fs.writeFileSync(p, out); changed++; }
  }
  return changed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'bump') {
    const d = new Date();
    const v = arg || `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}a`;
    const n = bump(v);
    console.log(`stamped ?v=${v} in ${n} file(s)`);
    const r = check();
    if (r.bad.length) { console.error(r.bad); process.exit(1); }
  } else {
    const r = check();
    let fail = false;
    if (r.bad.length) {
      console.error(`version ${r.version}: ${r.bad.length} reference(s) without ?v=${r.version}`);
      for (const b of r.bad) console.error(`  ${b.file}:${b.line} ${b.ref}`);
      fail = true;
    }
    if (!r.release.ok) { console.error(r.release.reason); fail = true; }
    if (fail) process.exit(1);
    console.log(`all references carry ?v=${r.version}` + (r.release.skipped ? ` (git comparison skipped: ${r.release.skipped})` : ''));
  }
}
