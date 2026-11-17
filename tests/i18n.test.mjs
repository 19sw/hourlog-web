import test from 'node:test';
import assert from 'node:assert/strict';
import { pickLocale, STRINGS, t, speechLang } from '../js/i18n.js';

test('pickLocale', () => {
  assert.equal(pickLocale(['zh-CN']), 'zh-Hans');
  assert.equal(pickLocale(['zh-Hant-TW']), 'zh-Hans');
  assert.equal(pickLocale(['en-GB']), 'en');
  assert.equal(pickLocale(['fr-FR', 'zh-CN']), 'zh-Hans');
  assert.equal(pickLocale(['fr-FR']), 'en');
  assert.equal(pickLocale(undefined), 'en');
  assert.equal(speechLang('zh-Hans'), 'zh-CN');
  assert.equal(speechLang('en'), 'en-US');
});

test('zh and en have identical key sets and no empty values', () => {
  assert.deepEqual(Object.keys(STRINGS['zh-Hans']).sort(), Object.keys(STRINGS.en).sort());
  for (const loc of Object.values(STRINGS)) for (const v of Object.values(loc)) assert.ok(v.length > 0);
});

test('interpolation', () => {
  assert.equal(t('en', 'savedAt', { time: '09:00' }), 'Saved at 09:00');
  assert.equal(t('zh-Hans', 'savedAt', { time: '09:00' }), '已保存于 09:00');
});
