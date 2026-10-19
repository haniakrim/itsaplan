import { describe, expect, it } from 'bun:test';
import { coerceConfig } from '../../../registry';
import { microsoft365 } from '..';

describe('a field hidden behind a boolean', () => {
  it('is required while the boolean is off', () => {
    expect(() => coerceConfig(microsoft365.credentialSchema, { defaultUser: 'a@b.com' })).toThrow(
      'Missing required setting: Tenant ID',
    );
  });

  it('is neither required nor kept while the boolean is on', () => {
    const config = coerceConfig(microsoft365.credentialSchema, {
      useInstanceApp: true,
      defaultUser: 'a@b.com',
      tenantId: 'smuggled',
      clientSecret: 'smuggled',
    });
    expect(config).toEqual({ useInstanceApp: true, defaultUser: 'a@b.com' });
  });
});
