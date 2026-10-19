import { randomUUID } from 'node:crypto';
import {
  STORAGE_BACKEND_SECRET_KEY,
  getInstanceMicrosoft365,
  getStorageOverrides,
  invalidateStorageBackendCache,
  writeSecret,
} from '@repo/db';
import { assertPublicHttpUrl, UrlNotAllowedError } from '@repo/net';
import {
  createStorageDriver,
  describeStorage,
  resolveStorageConfig,
  type StorageDescription,
  type StorageOverrides,
} from '@repo/storage';
import type { CheckRow } from '@repo/live-checks';
import { HttpError } from '#shared/lib';

// File storage settings (god mode "File storage"): which backend holds the file bytes and
// its credentials, encrypted in app_secret. A field that is not saved falls back to its
// environment variable; the response says which of the two a value comes from.

const STEP_TIMEOUT_MS = 20_000;

export type FileStorageSettings = StorageDescription & { instanceAppConfigured: boolean };

type Text = string | null | undefined;

export interface FileStoragePatch {
  driver?: 's3' | 'sharepoint' | null;
  s3?: {
    endpoint?: Text;
    bucket?: Text;
    region?: Text;
    accessKeyId?: Text;
    secretAccessKey?: Text;
    forcePathStyle?: boolean | null;
  };
  sharepoint?: {
    useInstanceApp?: boolean;
    tenantId?: Text;
    clientId?: Text;
    clientSecret?: Text;
    siteId?: Text;
    driveId?: Text;
    rootFolder?: Text;
  };
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

// The hosts a private S3 endpoint may have: the endpoint the environment configures (the
// Compose stacks point it at the bundled store, http://minio:9000) and the host:port pairs
// named in STORAGE_ALLOWED_PRIVATE_HOSTS.
function allowedPrivateHosts(): string[] {
  const listed = (process.env.STORAGE_ALLOWED_PRIVATE_HOSTS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const fromEnv = process.env.S3_ENDPOINT ? hostOf(process.env.S3_ENDPOINT) : null;
  return fromEnv ? [...listed, fromEnv] : listed;
}

// An S3 endpoint is fetched by the server, so it must be public unless it is one of the
// hosts above.
export async function assertS3Endpoint(endpoint: string): Promise<void> {
  const host = hostOf(endpoint);
  if (!host) throw new HttpError(400, 'S3 endpoint: url must be a valid URL');
  const protocol = new URL(endpoint).protocol;
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new HttpError(400, 'S3 endpoint: url must use http or https');
  }
  if (allowedPrivateHosts().includes(host)) return;
  try {
    await assertPublicHttpUrl(endpoint, { publicOnly: true });
  } catch (err) {
    if (err instanceof UrlNotAllowedError) throw new HttpError(400, `S3 endpoint: ${err.message}`);
    throw err;
  }
}

function applyText<T extends object>(target: T, key: keyof T, value: Text, secret = false): void {
  if (value === undefined) return;
  const trimmed = value === null ? '' : value.trim();
  if (trimmed === '' && secret && value !== null) return;
  if (trimmed === '') delete target[key];
  else (target[key] as unknown) = trimmed;
}

export function applyPatch(current: StorageOverrides, patch: FileStoragePatch): StorageOverrides {
  const next: StorageOverrides = {
    ...current,
    s3: { ...current.s3 },
    sharepoint: { ...current.sharepoint },
  };
  if (patch.driver !== undefined) {
    if (patch.driver === null) delete next.driver;
    else next.driver = patch.driver;
  }
  const s3 = patch.s3;
  if (s3) {
    applyText(next.s3!, 'endpoint', s3.endpoint);
    applyText(next.s3!, 'bucket', s3.bucket);
    applyText(next.s3!, 'region', s3.region);
    applyText(next.s3!, 'accessKeyId', s3.accessKeyId);
    applyText(next.s3!, 'secretAccessKey', s3.secretAccessKey, true);
    if (s3.forcePathStyle === null) delete next.s3!.forcePathStyle;
    else if (s3.forcePathStyle !== undefined) next.s3!.forcePathStyle = s3.forcePathStyle;
  }
  const sp = patch.sharepoint;
  if (sp) {
    if (sp.useInstanceApp !== undefined) next.sharepoint!.useInstanceApp = sp.useInstanceApp;
    applyText(next.sharepoint!, 'tenantId', sp.tenantId);
    applyText(next.sharepoint!, 'clientId', sp.clientId);
    applyText(next.sharepoint!, 'clientSecret', sp.clientSecret, true);
    applyText(next.sharepoint!, 'siteId', sp.siteId);
    applyText(next.sharepoint!, 'driveId', sp.driveId);
    applyText(next.sharepoint!, 'rootFolder', sp.rootFolder);
  }
  if (Object.keys(next.s3!).length === 0) delete next.s3;
  if (!Object.values(next.sharepoint!).some((v) => v !== undefined && v !== false)) {
    delete next.sharepoint;
  }
  return next;
}

async function describe(overrides: StorageOverrides): Promise<FileStorageSettings> {
  return {
    ...describeStorage(overrides),
    instanceAppConfigured: (await getInstanceMicrosoft365()) !== null,
  };
}

export async function getFileStorageSettings(): Promise<FileStorageSettings> {
  return describe(await getStorageOverrides());
}

// The patch applied to what is saved. Refuses what cannot run: a private S3 endpoint
// that is not allowed, the instance app when it is not set up, and a backend that lacks
// settings. Leaving no saved value at all is always allowed.
async function checkedOverrides(patch: FileStoragePatch): Promise<StorageOverrides> {
  const next = applyPatch(await getStorageOverrides(), patch);
  if (patch.s3?.endpoint && next.s3?.endpoint) await assertS3Endpoint(next.s3.endpoint);
  const instanceApp = await getInstanceMicrosoft365();
  if (next.sharepoint?.useInstanceApp && !instanceApp) {
    throw new HttpError(400, 'The instance Microsoft 365 app is not set up');
  }
  return next;
}

export async function setFileStorageSettings(
  patch: FileStoragePatch,
): Promise<FileStorageSettings> {
  const next = await checkedOverrides(patch);
  if (Object.keys(next).length > 0) {
    try {
      resolveStorageConfig(next, process.env, await getInstanceMicrosoft365());
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : 'Storage is not configured');
    }
  }
  const settings = await describe(next);
  await writeSecret(STORAGE_BACKEND_SECRET_KEY, next, describeStorage(next));
  invalidateStorageBackendCache();
  return settings;
}

async function step<T>(
  rows: CheckRow[],
  name: string,
  run: () => Promise<T>,
  detail: (value: T) => string,
): Promise<T | undefined> {
  try {
    const value = await Promise.race([
      run(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timed out')), STEP_TIMEOUT_MS),
      ),
    ]);
    rows.push({ name, status: 'PASS', detail: detail(value) });
    return value;
  } catch (err) {
    rows.push({
      name,
      status: 'FAIL',
      detail: (err instanceof Error ? err.message : String(err)).slice(0, 300),
    });
    return undefined;
  }
}

// Puts, gets and deletes one small object with the supplied settings over the saved ones,
// without saving anything.
export async function testFileStorage(
  patch: FileStoragePatch,
): Promise<{ ok: boolean; steps: CheckRow[] }> {
  const overrides = await checkedOverrides(patch);
  const steps: CheckRow[] = [];
  let driver;
  try {
    driver = createStorageDriver(
      resolveStorageConfig(overrides, process.env, await getInstanceMicrosoft365()),
    );
  } catch (err) {
    steps.push({
      name: 'config',
      status: 'FAIL',
      detail: err instanceof Error ? err.message : 'Storage is not configured',
    });
    return { ok: false, steps };
  }
  const key = `itsaplan-verify/test-${randomUUID()}.txt`;
  const body = Buffer.from(`itsaplan storage test ${new Date().toISOString()}`);
  await step(
    steps,
    'put',
    () => driver.put(key, body, 'text/plain'),
    () => `${body.length} bytes written`,
  );
  if (steps[0]!.status === 'FAIL') {
    steps.push({ name: 'get', status: 'SKIPPED', detail: 'the put failed' });
    steps.push({ name: 'delete', status: 'SKIPPED', detail: 'the put failed' });
    return { ok: false, steps };
  }
  await step(
    steps,
    'get',
    async () => {
      const object = await driver.get(key);
      const bytes = Buffer.from(await new Response(object.body).arrayBuffer());
      if (!bytes.equals(body)) throw new Error('the object read back differs from the one written');
      return bytes.length;
    },
    (length) => `${length} bytes read back, identical`,
  );
  await step(
    steps,
    'delete',
    () => driver.delete(key),
    () => 'probe object removed',
  );
  return { ok: steps.every((row) => row.status === 'PASS'), steps };
}
