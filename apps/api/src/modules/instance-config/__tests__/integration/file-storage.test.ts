import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resolveInstanceStorageConfig } from '@repo/db';
import { putObject, getObjectText, setStorageConfigSource } from '@repo/storage';
import { api } from '#tests/helpers/app';
import { resetDb } from '#tests/helpers/db';
import {
  allowPrivateStorageHost,
  setup,
  startFakeS3,
  storedSecretRows,
  type FakeS3,
} from '../helpers';

const ENV_KEYS = [
  'STORAGE_DRIVER',
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_REGION',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_FORCE_PATH_STYLE',
  'SHAREPOINT_TENANT_ID',
  'SHAREPOINT_CLIENT_ID',
  'SHAREPOINT_CLIENT_SECRET',
  'SHAREPOINT_SITE_ID',
  'SHAREPOINT_DRIVE_ID',
  'SHAREPOINT_ROOT_FOLDER',
  'STORAGE_ALLOWED_PRIVATE_HOSTS',
] as const;

const saved: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
let servers: FakeS3[] = [];
let restoreHosts: (() => void) | null = null;

function fakeS3(): FakeS3 {
  const server = startFakeS3();
  servers.push(server);
  return server;
}

beforeEach(async () => {
  await resetDb();
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  restoreHosts?.();
  restoreHosts = null;
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  globalThis.fetch = realFetch;
  for (const server of servers) server.stop();
  servers = [];
});

function setEnvS3(endpoint = 'http://minio:9000') {
  process.env.S3_ENDPOINT = endpoint;
  process.env.S3_BUCKET = 'env-bucket';
  process.env.S3_ACCESS_KEY_ID = 'env-key';
  process.env.S3_SECRET_ACCESS_KEY = 'env-secret';
}

function errorOf(res: { error: { value: unknown } | null }): string {
  return (res.error!.value as { error: string }).error;
}

describe('file storage settings', () => {
  it('is owner-only', async () => {
    const { user } = await setup();
    expect((await api.god['file-storage'].get()).status).toBe(401);
    expect((await user.api.god['file-storage'].get()).status).toBe(403);
    expect((await user.api.god['file-storage'].put({ driver: 's3' })).status).toBe(403);
    expect((await user.api.god['file-storage'].test.post({})).status).toBe(403);
  });

  it('shows the environment values and marks them as such', async () => {
    setEnvS3();
    const { god } = await setup();
    const settings = (await god.api.god['file-storage'].get()).data!;
    expect(settings.driver).toEqual({ value: 's3', source: 'default' });
    expect(settings.s3.endpoint).toEqual({ value: 'http://minio:9000', source: 'environment' });
    expect(settings.s3.bucket).toEqual({ value: 'env-bucket', source: 'environment' });
    expect(settings.s3.secretAccessKey).toEqual({ hasValue: true, source: 'environment' });
    expect(JSON.stringify(settings)).not.toContain('env-secret');
  });

  it('lets a saved value win over the environment and falls back when it is cleared', async () => {
    setEnvS3();
    const { god } = await setup();
    const result = await god.api.god['file-storage'].put({
      s3: { bucket: 'db-bucket', secretAccessKey: 'db-secret' },
    });
    expect(result.status).toBe(200);
    expect(result.data!.s3.bucket).toEqual({ value: 'db-bucket', source: 'database' });
    expect(result.data!.s3.endpoint.source).toBe('environment');
    expect(result.data!.s3.secretAccessKey).toEqual({ hasValue: true, source: 'database' });

    expect(await resolveInstanceStorageConfig()).toMatchObject({
      driver: 's3',
      s3: { bucket: 'db-bucket', secretAccessKey: 'db-secret', accessKeyId: 'env-key' },
    });

    const cleared = await god.api.god['file-storage'].put({
      s3: { bucket: null, secretAccessKey: null },
    });
    expect(cleared.data!.s3.bucket).toEqual({ value: 'env-bucket', source: 'environment' });
    expect(cleared.data!.s3.secretAccessKey.source).toBe('environment');
    expect(await resolveInstanceStorageConfig()).toMatchObject({ s3: { bucket: 'env-bucket' } });
  });

  it('stores credentials encrypted and never returns them', async () => {
    setEnvS3();
    const { god } = await setup();
    await god.api.god['file-storage'].put({ s3: { secretAccessKey: 'super-secret-key' } });
    expect(await storedSecretRows()).not.toContain('super-secret-key');
    const again = await god.api.god['file-storage'].get();
    expect(JSON.stringify(again.data)).not.toContain('super-secret-key');
  });

  it('keeps a saved secret when the update leaves it out or sends it empty', async () => {
    setEnvS3();
    const { god } = await setup();
    await god.api.god['file-storage'].put({ s3: { secretAccessKey: 'kept-secret' } });
    await god.api.god['file-storage'].put({ s3: { bucket: 'b2', secretAccessKey: '' } });
    expect(await resolveInstanceStorageConfig()).toMatchObject({
      s3: { bucket: 'b2', secretAccessKey: 'kept-secret' },
    });
  });

  it('refuses a private or metadata S3 endpoint that is not allowed', async () => {
    setEnvS3('http://minio:9000');
    const { god } = await setup();
    for (const endpoint of [
      'http://169.254.169.254',
      'http://127.0.0.1:9000',
      'http://10.0.0.5:9000',
      'ftp://example.com',
    ]) {
      const res = await god.api.god['file-storage'].put({ s3: { endpoint } });
      expect(res.status).toBe(400);
      expect(errorOf(res)).toContain('S3 endpoint');
    }
    const stillEnv = await god.api.god['file-storage'].get();
    expect(stillEnv.data!.s3.endpoint.source).toBe('environment');
  });

  it('accepts a private endpoint equal to the environment endpoint or in the allowlist', async () => {
    setEnvS3('http://minio:9000');
    const { god } = await setup();
    const sameAsEnv = await god.api.god['file-storage'].put({
      s3: { endpoint: 'http://minio:9000' },
    });
    expect(sameAsEnv.status).toBe(200);

    const unlisted = await god.api.god['file-storage'].put({
      s3: { endpoint: 'http://rustfs:9000' },
    });
    expect(unlisted.status).toBe(400);

    process.env.STORAGE_ALLOWED_PRIVATE_HOSTS = 'RustFS:9000, other:9001';
    const listed = await god.api.god['file-storage'].put({
      s3: { endpoint: 'http://rustfs:9000' },
    });
    expect(listed.status).toBe(200);
    expect(listed.data!.s3.endpoint).toEqual({ value: 'http://rustfs:9000', source: 'database' });

    const otherPort = await god.api.god['file-storage'].put({
      s3: { endpoint: 'http://rustfs:9999' },
    });
    expect(otherPort.status).toBe(400);
  });

  it('accepts a public endpoint', async () => {
    const { god } = await setup();
    const res = await god.api.god['file-storage'].put({
      driver: 's3',
      s3: {
        endpoint: 'https://93.184.216.34',
        bucket: 'b',
        accessKeyId: 'k',
        secretAccessKey: 's',
      },
    });
    expect(res.status).toBe(200);
  });

  it('refuses to save a backend that lacks settings', async () => {
    const { god } = await setup();
    const res = await god.api.god['file-storage'].put({ driver: 'sharepoint' });
    expect(res.status).toBe(400);
    expect(errorOf(res)).toContain('SharePoint storage is not configured');
  });

  it('refuses the instance Microsoft 365 app while it is not set up', async () => {
    const { god } = await setup();
    const res = await god.api.god['file-storage'].put({
      driver: 'sharepoint',
      sharepoint: { useInstanceApp: true, siteId: 'site' },
    });
    expect(res.status).toBe(400);
    expect(errorOf(res)).toContain('instance Microsoft 365 app');
  });

  it('runs SharePoint on the instance Microsoft 365 app', async () => {
    const { god } = await setup();
    await god.api.god.microsoft365.put({
      tenantId: 'tenant-x',
      clientId: 'client-x',
      clientSecret: 'secret-x',
    });
    const res = await god.api.god['file-storage'].put({
      driver: 'sharepoint',
      sharepoint: { useInstanceApp: true, siteId: 'site-1', rootFolder: 'docs' },
    });
    expect(res.status).toBe(200);
    expect(res.data!.driver).toEqual({ value: 'sharepoint', source: 'database' });
    expect(res.data!.instanceAppConfigured).toBe(true);
    expect(await resolveInstanceStorageConfig()).toMatchObject({
      driver: 'sharepoint',
      sharepoint: {
        tenantId: 'tenant-x',
        clientId: 'client-x',
        clientSecret: 'secret-x',
        siteId: 'site-1',
        rootFolder: 'docs',
      },
    });
    expect(await storedSecretRows()).not.toContain('secret-x');
  });

  it('applies a change to the running storage without a restart', async () => {
    const first = fakeS3();
    const second = fakeS3();
    restoreHosts = allowPrivateStorageHost(first.endpoint);
    process.env.STORAGE_ALLOWED_PRIVATE_HOSTS += `,${new URL(second.endpoint).host}`;
    setStorageConfigSource(resolveInstanceStorageConfig);
    try {
      const { god } = await setup();
      const base = { bucket: 'b', accessKeyId: 'k', secretAccessKey: 's' };
      await god.api.god['file-storage'].put({ s3: { ...base, endpoint: first.endpoint } });
      await putObject('one.txt', Buffer.from('first'), 'text/plain');
      expect([...first.objects.keys()]).toEqual(['/b/one.txt']);
      expect(await getObjectText('one.txt')).toBe('first');

      await god.api.god['file-storage'].put({ s3: { endpoint: second.endpoint } });
      await putObject('two.txt', Buffer.from('second'), 'text/plain');
      expect([...second.objects.keys()]).toEqual(['/b/two.txt']);
      expect(first.objects.has('/b/two.txt')).toBe(false);
    } finally {
      setStorageConfigSource();
    }
  });
});

describe('file storage connection test', () => {
  it('puts, gets and deletes a probe object and reports each step', async () => {
    const s3 = fakeS3();
    restoreHosts = allowPrivateStorageHost(s3.endpoint);
    const { god } = await setup();
    const result = await god.api.god['file-storage'].test.post({
      driver: 's3',
      s3: { endpoint: s3.endpoint, bucket: 'b', accessKeyId: 'k', secretAccessKey: 's' },
    });
    expect(result.status).toBe(200);
    expect(result.data!.ok).toBe(true);
    expect(result.data!.steps.map((s) => [s.name, s.status])).toEqual([
      ['put', 'PASS'],
      ['get', 'PASS'],
      ['delete', 'PASS'],
    ]);
    expect(s3.objects.size).toBe(0);
    expect((await god.api.god['file-storage'].get()).data!.s3.endpoint.source).toBe('default');
  });

  it('reports a failed put and skips the rest', async () => {
    const s3 = fakeS3();
    s3.stop();
    restoreHosts = allowPrivateStorageHost(s3.endpoint);
    const { god } = await setup();
    const result = await god.api.god['file-storage'].test.post({
      driver: 's3',
      s3: { endpoint: s3.endpoint, bucket: 'b', accessKeyId: 'k', secretAccessKey: 's' },
    });
    expect(result.data!.ok).toBe(false);
    expect(result.data!.steps.map((s) => s.status)).toEqual(['FAIL', 'SKIPPED', 'SKIPPED']);
  });

  it('reports an incomplete configuration', async () => {
    const { god } = await setup();
    const result = await god.api.god['file-storage'].test.post({});
    expect(result.data!.ok).toBe(false);
    expect(result.data!.steps[0]).toMatchObject({ name: 'config', status: 'FAIL' });
  });

  it('refuses a private endpoint like a save does', async () => {
    const { god } = await setup();
    const result = await god.api.god['file-storage'].test.post({
      s3: { endpoint: 'http://169.254.169.254' },
    });
    expect(result.status).toBe(400);
  });

  it('tests SharePoint through Microsoft Graph', async () => {
    const files = new Map<string, string>();
    const calls: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      const method = init?.method ?? 'GET';
      calls.push(`${method} ${url}`);
      if (url.includes('login.microsoftonline.com')) {
        return Response.json({ access_token: 'tok', expires_in: 3600 });
      }
      if (url.includes('/sites/')) return Response.json({ id: 'drive-1' });
      if (!url.includes('graph.microsoft.com')) return realFetch(input, init);
      const path = url.split('/root:/')[1]!.split(':')[0]!;
      if (method === 'PUT') {
        files.set(path, await new Response(init!.body as Buffer).text());
        return Response.json({ id: 'item' });
      }
      if (method === 'GET') {
        const body = files.get(path);
        return body === undefined ? new Response('', { status: 404 }) : new Response(body);
      }
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    const { god } = await setup();
    const result = await god.api.god['file-storage'].test.post({
      driver: 'sharepoint',
      sharepoint: {
        tenantId: 'tenant',
        clientId: 'client',
        clientSecret: 'secret',
        siteId: 'site-1',
      },
    });
    expect(result.data!.steps.map((s) => [s.name, s.status])).toEqual([
      ['put', 'PASS'],
      ['get', 'PASS'],
      ['delete', 'PASS'],
    ]);
    expect(calls.some((c) => c.startsWith('POST https://login.microsoftonline.com/tenant'))).toBe(
      true,
    );
  });
});
