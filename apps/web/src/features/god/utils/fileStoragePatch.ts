import type { FileStoragePatch, StorageDriverName } from '@/lib/api/endpoints/god';

export type FieldDraft = string | boolean | null | undefined;

export interface FileStorageDraft {
  driver: StorageDriverName | null | undefined;
  s3: Record<string, FieldDraft>;
  sharepoint: Record<string, FieldDraft>;
}

export const EMPTY_DRAFT: FileStorageDraft = { driver: undefined, s3: {}, sharepoint: {} };

const SECRETS = new Set(['secretAccessKey', 'clientSecret']);

function compact(fields: Record<string, FieldDraft>): Record<string, string | boolean | null> {
  const out: Record<string, string | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (value === '' && SECRETS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

export function buildFileStoragePatch(draft: FileStorageDraft): FileStoragePatch {
  const patch: FileStoragePatch = {};
  if (draft.driver !== undefined) patch.driver = draft.driver;
  const s3 = compact(draft.s3);
  const sharepoint = compact(draft.sharepoint);
  if (Object.keys(s3).length > 0) patch.s3 = s3 as FileStoragePatch['s3'];
  if (Object.keys(sharepoint).length > 0) {
    patch.sharepoint = sharepoint as FileStoragePatch['sharepoint'];
  }
  return patch;
}

export function isDraftDirty(draft: FileStorageDraft): boolean {
  return Object.keys(buildFileStoragePatch(draft)).length > 0;
}
