import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { getInstanceEmailConfig, getStoredInstanceEmailConfig } from '@repo/db';
import { api } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { setup, storedSecretRows } from '../helpers';

const SECRET = 'ms-secret-value-123';
const realFetch = globalThis.fetch;
let tokenCalls: { url: string; body: URLSearchParams }[];
let tokenResponse: () => Response;

beforeEach(async () => {
  await resetDb();
  tokenCalls = [];
  tokenResponse = () => Response.json({ access_token: 'graph-token', expires_in: 3600 });
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith('https://login.microsoftonline.com/')) return realFetch(input, init);
    tokenCalls.push({ url, body: new URLSearchParams(String(init?.body)) });
    return tokenResponse();
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const body = { tenantId: 'contoso.onmicrosoft.com', clientId: 'client-1', clientSecret: SECRET };

describe('instance Microsoft 365 app', () => {
  it('is owner-only', async () => {
    const { user } = await setup();
    expect((await api.god.microsoft365.get()).status).toBe(401);
    expect((await user.api.god.microsoft365.get()).status).toBe(403);
    expect((await user.api.god.microsoft365.put(body)).status).toBe(403);
    expect((await user.api.god.microsoft365.test.post(body)).status).toBe(403);
  });

  it('stores the secret encrypted and returns only that one is stored', async () => {
    const { god } = await setup();
    expect((await god.api.god.microsoft365.get()).data).toEqual({
      tenantId: '',
      clientId: '',
      hasClientSecret: false,
    });
    const saved = await god.api.god.microsoft365.put(body);
    expect(saved.status).toBe(200);
    expect(saved.data).toEqual({
      tenantId: body.tenantId,
      clientId: body.clientId,
      hasClientSecret: true,
    });
    expect(JSON.stringify((await god.api.god.microsoft365.get()).data)).not.toContain(SECRET);
    expect(await storedSecretRows()).not.toContain(SECRET);
  });

  it('keeps the stored secret when an update leaves it out', async () => {
    const { god } = await setup();
    await god.api.god.microsoft365.put(body);
    await god.api.god.microsoft365.put({ tenantId: body.tenantId, clientId: 'client-2' });
    const test = await god.api.god.microsoft365.test.post({
      tenantId: body.tenantId,
      clientId: 'client-2',
    });
    expect(test.data).toMatchObject({ ok: true });
    expect(tokenCalls[0]!.body.get('client_secret')).toBe(SECRET);
    expect(tokenCalls[0]!.body.get('scope')).toBe('https://graph.microsoft.com/.default');
  });

  it('tests the supplied values without saving them', async () => {
    const { god } = await setup();
    const result = await god.api.god.microsoft365.test.post(body);
    expect(result.data).toMatchObject({ ok: true });
    expect((await god.api.god.microsoft365.get()).data!.hasClientSecret).toBe(false);
  });

  it('reports a refusal from Microsoft', async () => {
    const { god } = await setup();
    tokenResponse = () =>
      Response.json(
        { error_description: 'AADSTS7000215: Invalid client secret provided.\r\nTrace ID: abc' },
        { status: 401 },
      );
    const result = await god.api.god.microsoft365.test.post(body);
    expect(result.status).toBe(200);
    expect(result.data!.ok).toBe(false);
    expect(result.data!.message).toContain('AADSTS7000215');
    expect(result.data!.message).not.toContain('Trace ID');
    expect(result.data!.message).not.toContain(SECRET);
  });

  it('asks for all three values before testing', async () => {
    const { god } = await setup();
    const result = await god.api.god.microsoft365.test.post({ tenantId: 'a', clientId: 'b' });
    expect(result.data!.ok).toBe(false);
    expect(tokenCalls).toHaveLength(0);
  });

  it('rejects a tenant id that is not a plain identifier', async () => {
    const { god } = await setup();
    const res = await god.api.god.microsoft365.put({ ...body, tenantId: '../evil' });
    expect(res.status).toBe(400);
  });

  it('is reused by the email provider without being copied into its config', async () => {
    const { god } = await setup();
    await god.api.god.microsoft365.put(body);
    const saved = await god.api.god['email-settings'].put({
      smtp: {
        enabled: true,
        host: 'smtp.office365.com',
        port: 587,
        encryption: 'tls',
        username: 'noreply@contoso.com',
        timeout: null,
        auth: 'microsoft365',
        oauth: { tenantId: '', clientId: '', useInstanceApp: true },
      },
    });
    expect(saved.status).toBe(200);
    expect(saved.data!.smtp.oauth).toMatchObject({ useInstanceApp: true, hasClientSecret: false });

    const stored = await getStoredInstanceEmailConfig();
    expect(stored!.smtp.oauth).toMatchObject({ useInstanceApp: true, clientSecret: '' });

    const forSending = await getInstanceEmailConfig();
    expect(forSending!.smtp.oauth).toMatchObject({
      tenantId: body.tenantId,
      clientId: body.clientId,
      clientSecret: SECRET,
    });
  });

  it('keeps separate email app fields working', async () => {
    const { god } = await setup();
    await god.api.god['email-settings'].put({
      smtp: {
        enabled: true,
        host: 'smtp.office365.com',
        port: 587,
        encryption: 'tls',
        username: 'noreply@contoso.com',
        timeout: null,
        auth: 'microsoft365',
        oauth: { tenantId: 't-own', clientId: 'c-own', clientSecret: 'own-secret' },
      },
    });
    const sending = await getInstanceEmailConfig();
    expect(sending!.smtp.oauth).toMatchObject({ tenantId: 't-own', clientSecret: 'own-secret' });
  });
});
