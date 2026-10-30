import test from 'node:test';
import assert from 'node:assert/strict';
import { computeName, normalizeName, reduceNumber, numberType } from '../public/assets/numerology.mjs';

test('Anna Maria Kowalska: every total and word agrees with the Pythagorean table', () => {
  const result = computeName('Anna Maria Kowalska');
  assert.equal(result.all, 57);
  assert.equal(result.soul, 21);
  assert.equal(result.personality, 36);
  assert.equal(reduceNumber(result.all), 3);
  assert.deepEqual(result.rows.map(row => row.vowelSum + row.consonantSum), [12, 24, 21]);
  assert.equal(result.rows[0].letters.length, 4);
});
test('Polish upper and lower case letters match their plain Latin forms', () => {
  assert.equal(normalizeName('ĄĆĘŁŃÓŚŹŻ'), 'acelnoszz');
  assert.deepEqual(computeName('Żaneta Łucja'), computeName('Zaneta Lucja'));
  assert.deepEqual(computeName('Józef'), computeName('Jo\u0301zef'));
});
test('Y is always a consonant, including a name containing no vowels', () => {
  const result = computeName('Y');
  assert.equal(result.all, 7);
  assert.equal(result.soul, 0);
  assert.equal(result.personality, 7);
  assert.equal(result.rows[0].letters[0].isVowel, false);
});
test('Names containing only vowels have a zero personality sum', () => {
  const result = computeName('AeioU');
  assert.equal(result.soul, 24);
  assert.equal(result.personality, 0);
});
test('Blank and non-Latin-only input produce no result', () => {
  for (const raw of ['', '  \n ', '123!@#', '🙂', '你好']) assert.equal(computeName(raw), null);
});
test('Whitespace, apostrophes and hyphens do not alter name totals', () => {
  assert.deepEqual(computeName('  Anna\tMaria\nKowalska  '), computeName('Anna Maria Kowalska'));
  assert.equal(computeName("Anna-Maria O'Neil").all, computeName('Anna Maria ONeil').all);
});
test('Master and karmic sums retain the original classification and reduce to one digit', () => {
  assert.equal(numberType(computeName('azb').all), 'master'); // 1 + 8 + 2 = 11
  assert.equal(reduceNumber(computeName('azb').all), 2);
  assert.equal(numberType(computeName('abcdc').all), 'karmic'); // 1 + 2 + 3 + 4 + 3 = 13
  assert.equal(reduceNumber(99), 9);
  assert.equal(numberType(31), '');
  assert.equal(reduceNumber(0), 0);
});
test('For a long name, all letter and word subtotals reconcile', () => {
  const result = computeName('W'.repeat(120));
  assert.equal(result.all, 600);
  assert.equal(result.soul + result.personality, result.all);
  assert.equal(result.rows.reduce((sum, row) => sum + row.vowelSum + row.consonantSum, 0), result.all);
  assert.equal(reduceNumber(result.all), 6);
});
