import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { firstInvalidOrigin, isValidOrigin, parseOrigins } from './origins';

describe('isValidOrigin', () => {
  it('accepts scheme, host and optional port', () => {
    assert.equal(isValidOrigin('https://app.example.com'), true);
    assert.equal(isValidOrigin('http://localhost:3001'), true);
    assert.equal(isValidOrigin('http://*.orca.localhost:60418'), true);
    assert.equal(isValidOrigin('https://*.example.com/'), true);
  });

  it('rejects a bare wildcard, a wildcard past the first label and other shapes', () => {
    for (const entry of [
      '*',
      'https://*',
      'https://*.*',
      'https://a.*.example.com',
      'https://exa*mple.com',
      'https://example.com/path',
      'https://example.com?x=1',
      'https://user@example.com',
      'ftp://example.com',
      'example.com',
      'https://example.com:99999',
      'https://',
    ]) {
      assert.equal(isValidOrigin(entry), false, entry);
    }
  });
});

describe('parseOrigins', () => {
  it('trims, drops blanks and duplicates', () => {
    assert.deepEqual(parseOrigins(' https://a.test/ \n\nhttps://a.test\nhttps://b.test'), [
      'https://a.test',
      'https://b.test',
    ]);
  });

  it('names the first invalid entry', () => {
    assert.equal(firstInvalidOrigin(['https://a.test', 'nope']), 'nope');
    assert.equal(firstInvalidOrigin(['https://a.test']), null);
  });
});
