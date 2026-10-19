import { describe, expect, test } from 'bun:test';
import { checkProcore, checkSharePointStorage, checksPassed } from '..';

function fakeGraph(options: { failPut?: boolean } = {}) {
  const files = new Map<string, Buffer>();
  const sessions = new Map<string, { path: string; parts: Buffer[] }>();
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = init?.method ?? 'GET';
    if (url.includes('login.microsoftonline.com')) {
      return Response.json({ access_token: 'tok', expires_in: 3600 });
    }
    if (url.startsWith('https://upload.test/')) {
      const session = sessions.get(url)!;
      session.parts.push(Buffer.from(init!.body as Buffer));
      files.set(session.path, Buffer.concat(session.parts));
      return new Response(null, { status: 202 });
    }
    const path = decodeURIComponent(url.split('/root:/')[1]!.split(':')[0]!);
    if (url.endsWith(':/createUploadSession')) {
      const uploadUrl = `https://upload.test/${sessions.size}`;
      sessions.set(uploadUrl, { path, parts: [] });
      return Response.json({ uploadUrl });
    }
    if (method === 'PUT') {
      if (options.failPut) return new Response('denied', { status: 403 });
      files.set(path, Buffer.from(init!.body as Buffer));
      return Response.json({ id: 'item' });
    }
    if (method === 'GET') {
      const body = files.get(path);
      return body ? new Response(body) : new Response('', { status: 404 });
    }
    files.delete(path);
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  return { files, fetcher };
}

const config = { tenantId: 't', clientId: 'c', clientSecret: 's', driveId: 'drive' };

describe('checkSharePointStorage', () => {
  test('passes every step against a working library and leaves nothing behind', async () => {
    const graph = fakeGraph();
    const rows = await checkSharePointStorage(config, { fetch: graph.fetcher });
    expect(checksPassed(rows)).toBe(true);
    expect(rows.every((r) => r.status === 'PASS')).toBe(true);
    expect(rows.some((r) => r.name.includes('large.png'))).toBe(true);
    expect(graph.files.size).toBe(0);
  });

  test('reports a denied upload as a failure', async () => {
    const rows = await checkSharePointStorage(config, {
      fetch: fakeGraph({ failPut: true }).fetcher,
      sleep: async () => {},
    });
    expect(checksPassed(rows)).toBe(false);
    expect(rows.find((r) => r.status === 'FAIL')!.detail).toContain('403');
  });
});

describe('checkProcore', () => {
  const credential = { clientId: 'c', clientSecret: 's', companyId: '1', sandbox: true };

  test('stops at a refused token', async () => {
    const rows = await checkProcore(credential, {
      fetch: (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch,
    });
    expect(rows).toEqual([{ name: 'setup', status: 'FAIL', detail: 'token request: HTTP 401' }]);
  });

  test('maps a forbidden read to a missing permission', async () => {
    const rows = await checkProcore(credential, {
      fetch: (async (input: string | URL | Request) =>
        String(input).includes('/oauth/token')
          ? Response.json({ access_token: 'x' })
          : new Response('{}', { status: 403 })) as unknown as typeof fetch,
    });
    expect(rows.find((r) => r.name === 'projects')!.status).toBe('MISSING-PERMISSION');
  });
});
