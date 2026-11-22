import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { check, findRefs, bump, WEB, releaseRule, gitState } from '../tools/asset-version.mjs';

test('every module import, pack file and asset URL carries the current ?v= release version', () => {
  const r = check();
  assert.ok(r.version, 'index.html loads js/app.js?v=<version>');
  assert.deepEqual(r.bad.map((b) => `${b.file}:${b.line} ${b.ref}`), []);
  assert.ok(r.release.ok, r.release.reason);
  // sanity: the scan actually sees the references that matter
  const refs = findRefs().map((x) => `${x.file} ${x.ref.replace(/\?v=.*/, '')}`);
  for (const must of ['index.html js/app.js', 'index.html styles.css', 'js/app.js ./storage.js', 'js/learn.js ../courses/index.js', 'courses/index.js ./video-editing-basics.js']) {
    assert.ok(refs.includes(must), `scan finds ${must}`);
  }
});

test('check flags a reference without the version, and bump fixes it', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'av-'));
  fs.cpSync(path.join(WEB, 'index.html'), path.join(tmp, 'index.html'));
  for (const d of ['js', 'courses']) fs.cpSync(path.join(WEB, d), path.join(tmp, d), { recursive: true });
  const f = path.join(tmp, 'js', 'app.js');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/'\.\/storage\.js\?v=[a-z0-9]+'/, "'./storage.js'"));
  assert.deepEqual(check(tmp).bad.map((b) => b.ref), ['./storage.js']);
  bump('zz9', tmp);
  const r = check(tmp);
  assert.equal(r.version, 'zz9');
  assert.equal(r.release.ok, true);
  assert.ok(r.release.skipped, 'outside a git checkout the HEAD comparison is skipped, not failed');
  assert.deepEqual(r.bad, []);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('release rule: shipped files changed but version equal to HEAD fails; bumped or unchanged passes', () => {
  assert.equal(releaseRule({ version: 'a1', headVersion: 'a1', changed: ['js/app.js'] }).ok, false);
  assert.equal(releaseRule({ version: 'a2', headVersion: 'a1', changed: ['js/app.js'] }).ok, true);
  assert.equal(releaseRule({ version: 'a1', headVersion: 'a1', changed: [] }).ok, true);
  assert.equal(releaseRule({ version: 'a1', headVersion: null, changed: ['js/app.js'] }).ok, true, 'first versioned release');
  // wired into check(): a fake git state with an unbumped change fails
  const v = check().version;
  assert.equal(check(WEB, { git: { available: true, headVersion: v, changed: ['courses/x.js'] } }).release.ok, false);
});

test('git comparison runs in this checkout (or reports why it was skipped)', () => {
  const g = gitState();
  if (!g.available) { assert.ok(g.reason); return; }
  assert.ok(Array.isArray(g.changed));
});
