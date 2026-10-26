import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTrustProxy } from '../src/config/trust-proxy';
import { parseDataIsoEstrita } from '../src/validators/iso-date.validator';

test('TRUST_PROXY defaults to disabled and accepts a configured proxy hop count', () => {
  assert.equal(parseTrustProxy(undefined), false);
  assert.equal(parseTrustProxy('false'), false);
  assert.equal(parseTrustProxy('1'), 1);
  assert.equal(parseTrustProxy('true'), 1);
});

test('TRUST_PROXY accepts only IP/CIDR lists, rejecting arbitrary strings', () => {
  assert.deepEqual(parseTrustProxy('127.0.0.1,10.0.0.0/8'), ['127.0.0.1', '10.0.0.0/8']);
  assert.throws(() => parseTrustProxy('internet'), /TRUST_PROXY inválido/);
  assert.throws(() => parseTrustProxy('192.168.1.1/99'), /TRUST_PROXY inválido/);
});

test('strict ISO validator rejects year-only values and invalid calendar dates', () => {
  assert.equal(parseDataIsoEstrita('2030'), null);
  assert.equal(parseDataIsoEstrita('2030-02-30'), null);
  assert.ok(parseDataIsoEstrita('2030-02-28'));
  assert.ok(parseDataIsoEstrita('2030-02-28T12:00:00.000Z'));
});
