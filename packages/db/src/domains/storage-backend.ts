import {
  resolveStorageConfig,
  type InstanceMicrosoftApp,
  type StorageConfig,
  type StorageOverrides,
} from '@repo/storage/config';
import { readSecret } from '../secrets';
import { getInstanceMicrosoft365 } from './instance-microsoft365';

// Where file bytes are stored. The instance owner's choice is encrypted in app_secret
// under 'storage.backend' (the S3 and SharePoint credentials are in it), and each field
// that is not saved there falls back to its environment variable. The api, the worker and
// the bot read it through resolveInstanceStorageConfig; the api writes it in god mode.

export const STORAGE_BACKEND_SECRET_KEY = 'storage.backend';

// A change made in another process is picked up within this time; the process that
// saves it drops the cache at once.
const CACHE_TTL_MS = 5_000;

export async function getStorageOverrides(): Promise<StorageOverrides> {
  return (await readSecret<StorageOverrides>(STORAGE_BACKEND_SECRET_KEY)) ?? {};
}

export async function getInstanceAppForStorage(): Promise<InstanceMicrosoftApp | null> {
  return getInstanceMicrosoft365();
}

let cached: { at: number; config: StorageConfig } | null = null;

export function invalidateStorageBackendCache(): void {
  cached = null;
}

export async function resolveInstanceStorageConfig(): Promise<StorageConfig> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.config;
  const overrides = await getStorageOverrides();
  const instanceApp = overrides.sharepoint?.useInstanceApp ? await getInstanceMicrosoft365() : null;
  const config = resolveStorageConfig(overrides, process.env, instanceApp);
  cached = { at: Date.now(), config };
  return config;
}
