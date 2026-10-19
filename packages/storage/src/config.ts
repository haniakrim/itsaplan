export type StorageDriverName = 's3' | 'sharepoint';
export type SettingSource = 'database' | 'environment' | 'default';

export interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export interface SharePointConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteId?: string;
  driveId?: string;
  rootFolder?: string;
}

export type StorageConfig =
  { driver: 's3'; s3: S3Config } | { driver: 'sharepoint'; sharepoint: SharePointConfig };

// What the instance owner has saved in god mode. A missing field falls back to the
// environment variable of the same setting.
export interface StorageOverrides {
  driver?: StorageDriverName;
  s3?: Partial<S3Config>;
  sharepoint?: Partial<SharePointConfig> & { useInstanceApp?: boolean };
}

export interface InstanceMicrosoftApp {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface Sourced<T> {
  value: T;
  source: SettingSource;
}

export interface SourcedSecret {
  hasValue: boolean;
  source: SettingSource;
}

export interface StorageDescription {
  driver: Sourced<StorageDriverName>;
  s3: {
    endpoint: Sourced<string>;
    bucket: Sourced<string>;
    region: Sourced<string>;
    accessKeyId: Sourced<string>;
    secretAccessKey: SourcedSecret;
    forcePathStyle: Sourced<boolean>;
  };
  sharepoint: {
    useInstanceApp: boolean;
    tenantId: Sourced<string>;
    clientId: Sourced<string>;
    clientSecret: SourcedSecret;
    siteId: Sourced<string>;
    driveId: Sourced<string>;
    rootFolder: Sourced<string>;
  };
}

type Env = Record<string, string | undefined>;

const S3_ENV = {
  endpoint: 'S3_ENDPOINT',
  bucket: 'S3_BUCKET',
  region: 'S3_REGION',
  accessKeyId: 'S3_ACCESS_KEY_ID',
  secretAccessKey: 'S3_SECRET_ACCESS_KEY',
} as const;

const SHAREPOINT_ENV = {
  tenantId: 'SHAREPOINT_TENANT_ID',
  clientId: 'SHAREPOINT_CLIENT_ID',
  clientSecret: 'SHAREPOINT_CLIENT_SECRET',
  siteId: 'SHAREPOINT_SITE_ID',
  driveId: 'SHAREPOINT_DRIVE_ID',
  rootFolder: 'SHAREPOINT_ROOT_FOLDER',
} as const;

function text(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function pick(
  saved: string | undefined | null,
  envName: string,
  env: Env,
  fallback = '',
): Sourced<string> {
  const fromDb = text(saved);
  if (fromDb !== undefined) return { value: fromDb, source: 'database' };
  const fromEnv = text(env[envName]);
  if (fromEnv !== undefined) return { value: fromEnv, source: 'environment' };
  return { value: fallback, source: 'default' };
}

function pickSecret(saved: string | undefined | null, envName: string, env: Env): SourcedSecret {
  if (text(saved) !== undefined) return { hasValue: true, source: 'database' };
  if (text(env[envName]) !== undefined) return { hasValue: true, source: 'environment' };
  return { hasValue: false, source: 'default' };
}

export function parseStorageDriver(raw: string | undefined): StorageDriverName {
  const name = (raw || 's3').trim().toLowerCase();
  if (name === 's3' || name === 'sharepoint') return name;
  throw new Error(`Unknown STORAGE_DRIVER '${raw}': use "s3" or "sharepoint".`);
}

function driverOf(
  overrides: StorageOverrides,
  env: Env,
  strict = true,
): Sourced<StorageDriverName> {
  if (overrides.driver) return { value: overrides.driver, source: 'database' };
  const fromEnv = text(env.STORAGE_DRIVER);
  if (fromEnv) {
    try {
      return { value: parseStorageDriver(fromEnv), source: 'environment' };
    } catch (err) {
      if (strict) throw err;
    }
  }
  return { value: 's3', source: 'default' };
}

export function describeStorage(
  overrides: StorageOverrides = {},
  env: Env = process.env,
): StorageDescription {
  const s3 = overrides.s3 ?? {};
  const sp = overrides.sharepoint ?? {};
  const forcePathStyle: Sourced<boolean> =
    s3.forcePathStyle !== undefined
      ? { value: s3.forcePathStyle, source: 'database' }
      : text(env.S3_FORCE_PATH_STYLE) !== undefined
        ? { value: env.S3_FORCE_PATH_STYLE!.trim() !== 'false', source: 'environment' }
        : { value: true, source: 'default' };
  return {
    driver: driverOf(overrides, env, false),
    s3: {
      endpoint: pick(s3.endpoint, S3_ENV.endpoint, env),
      bucket: pick(s3.bucket, S3_ENV.bucket, env),
      region: pick(s3.region, S3_ENV.region, env, 'us-east-1'),
      accessKeyId: pick(s3.accessKeyId, S3_ENV.accessKeyId, env),
      secretAccessKey: pickSecret(s3.secretAccessKey, S3_ENV.secretAccessKey, env),
      forcePathStyle,
    },
    sharepoint: {
      useInstanceApp: sp.useInstanceApp === true,
      tenantId: pick(sp.tenantId, SHAREPOINT_ENV.tenantId, env),
      clientId: pick(sp.clientId, SHAREPOINT_ENV.clientId, env),
      clientSecret: pickSecret(sp.clientSecret, SHAREPOINT_ENV.clientSecret, env),
      siteId: pick(sp.siteId, SHAREPOINT_ENV.siteId, env),
      driveId: pick(sp.driveId, SHAREPOINT_ENV.driveId, env),
      rootFolder: pick(sp.rootFolder, SHAREPOINT_ENV.rootFolder, env),
    },
  };
}

export function resolveS3Config(
  overrides: StorageOverrides = {},
  env: Env = process.env,
): S3Config {
  const s3 = overrides.s3 ?? {};
  const endpoint = pick(s3.endpoint, S3_ENV.endpoint, env).value;
  const bucket = pick(s3.bucket, S3_ENV.bucket, env).value;
  const accessKeyId = pick(s3.accessKeyId, S3_ENV.accessKeyId, env).value;
  const secretAccessKey = text(s3.secretAccessKey) ?? text(env[S3_ENV.secretAccessKey]) ?? '';
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'S3 storage is not configured: set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.',
    );
  }
  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: pick(s3.region, S3_ENV.region, env, 'us-east-1').value,
    forcePathStyle: describeStorage(overrides, env).s3.forcePathStyle.value,
  };
}

export function resolveSharePointConfig(
  overrides: StorageOverrides = {},
  env: Env = process.env,
  instanceApp: InstanceMicrosoftApp | null = null,
): SharePointConfig {
  const sp = overrides.sharepoint ?? {};
  const siteId = pick(sp.siteId, SHAREPOINT_ENV.siteId, env).value || undefined;
  const driveId = pick(sp.driveId, SHAREPOINT_ENV.driveId, env).value || undefined;
  let tenantId: string;
  let clientId: string;
  let clientSecret: string;
  if (sp.useInstanceApp) {
    if (!instanceApp?.tenantId || !instanceApp.clientId || !instanceApp.clientSecret) {
      throw new Error(
        'SharePoint storage uses the instance Microsoft 365 app, which is not set up: configure it in god mode.',
      );
    }
    ({ tenantId, clientId, clientSecret } = instanceApp);
  } else {
    tenantId = pick(sp.tenantId, SHAREPOINT_ENV.tenantId, env).value;
    clientId = pick(sp.clientId, SHAREPOINT_ENV.clientId, env).value;
    clientSecret = text(sp.clientSecret) ?? text(env[SHAREPOINT_ENV.clientSecret]) ?? '';
  }
  if (!tenantId || !clientId || !clientSecret || (!siteId && !driveId)) {
    throw new Error(
      'SharePoint storage is not configured: set SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, SHAREPOINT_CLIENT_SECRET and SHAREPOINT_SITE_ID (or SHAREPOINT_DRIVE_ID).',
    );
  }
  return {
    tenantId,
    clientId,
    clientSecret,
    siteId,
    driveId,
    rootFolder: pick(sp.rootFolder, SHAREPOINT_ENV.rootFolder, env).value || undefined,
  };
}

// The settings the active driver runs with: the saved value of each field when there is
// one, otherwise the environment's.
export function resolveStorageConfig(
  overrides: StorageOverrides = {},
  env: Env = process.env,
  instanceApp: InstanceMicrosoftApp | null = null,
): StorageConfig {
  const driver = driverOf(overrides, env).value;
  return driver === 'sharepoint'
    ? { driver, sharepoint: resolveSharePointConfig(overrides, env, instanceApp) }
    : { driver, s3: resolveS3Config(overrides, env) };
}
