import { describe, expect, it } from 'bun:test';
import { matchesOriginEntry, normalizeOriginEntries, normalizeOriginEntry } from '@repo/auth';

describe('normalizeOriginEntry', () => {
  it('accepts scheme, host and optional port', () => {
    expect(normalizeOriginEntry('https://app.example.com')).toBe('https://app.example.com');
    expect(normalizeOriginEntry('http://localhost:3001/')).toBe('http://localhost:3001');
    expect(normalizeOriginEntry('HTTPS://App.Example.COM:8443')).toBe(
      'https://app.example.com:8443',
    );
    expect(normalizeOriginEntry('http://192.168.1.10:3001')).toBe('http://192.168.1.10:3001');
    expect(normalizeOriginEntry('http://[::1]:3001')).toBe('http://[::1]:3001');
  });

  it('drops a default port', () => {
    expect(normalizeOriginEntry('https://app.example.com:443')).toBe('https://app.example.com');
    expect(normalizeOriginEntry('http://app.example.com:80')).toBe('http://app.example.com');
  });

  it('accepts a wildcard as the whole leftmost label', () => {
    expect(normalizeOriginEntry('http://*.orca.localhost:60418')).toBe(
      'http://*.orca.localhost:60418',
    );
    expect(normalizeOriginEntry('https://*.example.com')).toBe('https://*.example.com');
  });

  it.each([
    '*',
    'http://*',
    '*.example.com',
    'https://*.com',
    'https://a*.example.com',
    'https://app.*.example.com',
    'https://*.*.example.com',
    'https://*example.com',
    'http://*.127.0.0.1',
    'ftp://example.com',
    'https://example.com/path',
    'https://example.com?x=1',
    'https://example.com#frag',
    'https://user:pass@example.com',
    'https://exa mple.com',
    'https://example.com:0',
    'https://example.com:70000',
    'https://-bad.example.com',
    'example.com',
    '',
    '   ',
  ])('rejects %p', (entry) => {
    expect(() => normalizeOriginEntry(entry)).toThrow();
  });
});

describe('normalizeOriginEntries', () => {
  it('removes duplicates and rejects the whole list on one bad entry', () => {
    expect(
      normalizeOriginEntries(['https://a.example.com', 'https://A.example.com/', 'http://b.test']),
    ).toEqual(['https://a.example.com', 'http://b.test']);
    expect(() => normalizeOriginEntries(['https://a.example.com', '*'])).toThrow();
  });

  it('caps the list', () => {
    const many = Array.from({ length: 51 }, (_, i) => `https://h${i}.example.com`);
    expect(() => normalizeOriginEntries(many)).toThrow();
  });
});

describe('matchesOriginEntry', () => {
  it('matches an exact origin only', () => {
    expect(matchesOriginEntry('https://a.example.com', 'https://a.example.com')).toBe(true);
    expect(matchesOriginEntry('http://a.example.com', 'https://a.example.com')).toBe(false);
    expect(matchesOriginEntry('https://a.example.com:8443', 'https://a.example.com')).toBe(false);
    expect(matchesOriginEntry('https://b.example.com', 'https://a.example.com')).toBe(false);
  });

  it('matches subdomains of a wildcard with the same scheme and port', () => {
    const entry = 'http://*.orca.localhost:60418';
    expect(matchesOriginEntry('http://one.orca.localhost:60418', entry)).toBe(true);
    expect(matchesOriginEntry('http://a.b.orca.localhost:60418', entry)).toBe(true);
    expect(matchesOriginEntry('http://orca.localhost:60418', entry)).toBe(false);
    expect(matchesOriginEntry('http://one.orca.localhost:60419', entry)).toBe(false);
    expect(matchesOriginEntry('https://one.orca.localhost:60418', entry)).toBe(false);
    expect(matchesOriginEntry('http://one.orca.localhost.evil.com:60418', entry)).toBe(false);
    expect(matchesOriginEntry('http://evilorca.localhost:60418', entry)).toBe(false);
  });
});
