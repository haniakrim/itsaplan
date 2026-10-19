import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { api } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import { INTEGRATION_CHECKS_PER_WINDOW, resetIntegrationCheckLimit } from '../../rate-limit';
import { setup, storedSecretRows } from '../helpers';

const realFetch = globalThis.fetch;
let calls: { method: string; url: string }[];
let respond: (url: string, method: string) => Response | undefined;

beforeEach(async () => {
  await resetDb();
  resetIntegrationCheckLimit();
  calls = [];
  respond = () => undefined;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = init?.method ?? 'GET';
    if (!/microsoftonline|graph\.microsoft|procore/.test(url)) return realFetch(input, init);
    calls.push({ method, url });
    return respond(url, method) ?? new Response('{}', { status: 500 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const graph = (url: string): Response | undefined => {
  if (url.includes('login.microsoftonline.com')) {
    return Response.json({ access_token: 'tok', expires_in: 3600 });
  }
  if (url.includes('graph.microsoft.com')) return Response.json({ value: [] });
  return undefined;
};

const procore = { clientId: 'cid', clientSecret: 'procore-secret', companyId: '42', sandbox: true };

describe('integration checks access', () => {
  it('is owner-only', async () => {
    const { user } = await setup();
    const checks = user.api.god['integration-checks'];
    expect((await api.god['integration-checks'].procore.get()).status).toBe(401);
    expect((await checks.procore.get()).status).toBe(403);
    expect((await checks.procore.post(procore)).status).toBe(403);
    expect((await checks.sharepoint.post({})).status).toBe(403);
    expect((await checks.microsoft365.post({ user: 'a@b.com' })).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('allows a limited number of runs per window', async () => {
    const { god } = await setup();
    for (let i = 0; i < INTEGRATION_CHECKS_PER_WINDOW; i++) {
      const res = await god.api.god['integration-checks'].sharepoint.post({});
      expect(res.status).toBe(400);
    }
    const limited = await god.api.god['integration-checks'].sharepoint.post({});
    expect(limited.status).toBe(429);
  });
});

describe('Procore check', () => {
  it('needs the credentials', async () => {
    const { god } = await setup();
    const res = await god.api.god['integration-checks'].procore.post({ clientId: 'x' });
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('reports a refused token as a failed step against the sandbox host', async () => {
    const { god } = await setup();
    respond = (url) =>
      url.startsWith('https://login-sandbox.procore.com/oauth/token')
        ? new Response('{}', { status: 401 })
        : undefined;
    const res = await god.api.god['integration-checks'].procore.post(procore);
    expect(res.status).toBe(200);
    expect(res.data!.ok).toBe(false);
    expect(res.data!.rows).toEqual([
      { name: 'setup', status: 'FAIL', detail: 'token request: HTTP 401' },
    ]);
  });

  it('reports a forbidden read as a missing permission', async () => {
    const { god } = await setup();
    respond = (url) => {
      if (url.includes('/oauth/token')) return Response.json({ access_token: 'tok' });
      if (url.includes('/rest/v1.0/projects')) return new Response('{}', { status: 403 });
      return undefined;
    };
    const res = await god.api.god['integration-checks'].procore.post(procore);
    expect(res.data!.rows.map((r) => [r.name, r.status])).toEqual([
      ['token', 'PASS'],
      ['projects', 'MISSING-PERMISSION'],
      ['project', 'FAIL'],
    ]);
  });

  it('does not keep the credentials unless asked, and keeps them encrypted when asked', async () => {
    const { god } = await setup();
    const checks = god.api.god['integration-checks'];
    respond = () => new Response('{}', { status: 401 });
    await checks.procore.post(procore);
    expect((await checks.procore.get()).data).toMatchObject({ remembered: false });

    await checks.procore.post({ ...procore, remember: true });
    expect((await checks.procore.get()).data).toEqual({
      remembered: true,
      clientId: 'cid',
      companyId: '42',
      sandbox: true,
      hasClientSecret: true,
    });
    expect(await storedSecretRows()).not.toContain('procore-secret');

    calls.length = 0;
    await checks.procore.post({});
    expect(calls[0]!.url).toContain('login-sandbox.procore.com');

    expect((await checks.procore.delete()).status).toBe(204);
    expect((await checks.procore.get()).data).toMatchObject({ remembered: false });
  });
});

describe('SharePoint check', () => {
  it('needs a configured library', async () => {
    const { god } = await setup();
    const res = await god.api.god['integration-checks'].sharepoint.post({});
    expect(res.status).toBe(400);
  });
});

describe('Microsoft 365 check', () => {
  it('needs the instance app', async () => {
    const { god } = await setup();
    const res = await god.api.god['integration-checks'].microsoft365.post({ user: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('reads only unless writing is asked for', async () => {
    const { god } = await setup();
    await god.api.god.microsoft365.put({
      tenantId: 't',
      clientId: 'c',
      clientSecret: 'ms-check-secret',
    });
    respond = graph;
    const res = await god.api.god['integration-checks'].microsoft365.post({ user: 'a@b.com' });
    expect(res.status).toBe(200);
    const names = res.data!.rows.map((r) => r.name);
    expect(names).toContain('microsoft365_files_list');
    expect(res.data!.rows.find((r) => r.name === 'microsoft365_file_write')).toMatchObject({
      status: 'SKIPPED',
    });
    expect(calls.some((c) => c.method !== 'GET' && c.method !== 'POST')).toBe(false);
    expect(
      calls.filter((c) => c.url.includes('graph.microsoft.com')).every((c) => c.method === 'GET'),
    ).toBe(true);
    expect(JSON.stringify(res.data)).not.toContain('ms-check-secret');
  });

  it('writes a file only when asked and maps a missing permission', async () => {
    const { god } = await setup();
    await god.api.god.microsoft365.put({ tenantId: 't', clientId: 'c', clientSecret: 's' });
    respond = (url, method) => {
      if (url.includes('login.microsoftonline.com')) {
        return Response.json({ access_token: 'tok', expires_in: 3600 });
      }
      if (method === 'PUT') return new Response('{}', { status: 403 });
      return Response.json({ value: [] });
    };
    const res = await god.api.god['integration-checks'].microsoft365.post({
      user: 'a@b.com',
      write: true,
    });
    expect(calls.some((c) => c.method === 'PUT')).toBe(true);
    const write = res.data!.rows.find((r) => r.name === 'microsoft365_file_write')!;
    expect(['FAIL', 'MISSING-PERMISSION']).toContain(write.status);
  });

  it('rejects a user that is not an address', async () => {
    const { god } = await setup();
    const res = await god.api.god['integration-checks'].microsoft365.post({ user: 'nobody' });
    expect(res.status).toBe(400);
  });
});
