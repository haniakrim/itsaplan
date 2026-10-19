import { t, type TSchema } from 'elysia';

const source = t.UnionEnum(['database', 'environment', 'default']);
const sourced = <T extends TSchema>(value: T) => t.Object({ value, source });
const sourcedSecret = t.Object({ hasValue: t.Boolean(), source });

const checkStatus = t.UnionEnum(['PASS', 'FAIL', 'MISSING-PERMISSION', 'SKIPPED']);
export const CheckRowSchema = t.Object({
  name: t.String(),
  status: checkStatus,
  detail: t.String(),
});
export const ChecksResponse = t.Object({ ok: t.Boolean(), rows: t.Array(CheckRowSchema) });

const DIRECTORY_ID = { maxLength: 128, pattern: '^[A-Za-z0-9._-]*$' };

export const Microsoft365SettingsResponse = t.Object({
  tenantId: t.String(),
  clientId: t.String(),
  hasClientSecret: t.Boolean(),
});

export const Microsoft365SettingsBody = t.Object({
  tenantId: t.String(DIRECTORY_ID),
  clientId: t.String(DIRECTORY_ID),
  clientSecret: t.Optional(t.String({ maxLength: 1024 })),
});

export const Microsoft365TestResponse = t.Object({ ok: t.Boolean(), message: t.String() });

const text = (maxLength = 512) => t.Optional(t.Nullable(t.String({ maxLength })));

export const FileStorageSettingsResponse = t.Object({
  driver: sourced(t.UnionEnum(['s3', 'sharepoint'])),
  s3: t.Object({
    endpoint: sourced(t.String()),
    bucket: sourced(t.String()),
    region: sourced(t.String()),
    accessKeyId: sourced(t.String()),
    secretAccessKey: sourcedSecret,
    forcePathStyle: sourced(t.Boolean()),
  }),
  sharepoint: t.Object({
    useInstanceApp: t.Boolean(),
    tenantId: sourced(t.String()),
    clientId: sourced(t.String()),
    clientSecret: sourcedSecret,
    siteId: sourced(t.String()),
    driveId: sourced(t.String()),
    rootFolder: sourced(t.String()),
  }),
  instanceAppConfigured: t.Boolean(),
});

// A key left out keeps its value; null (or an empty string) removes the saved value so
// the environment's applies again.
export const FileStorageSettingsBody = t.Object({
  driver: t.Optional(t.Nullable(t.UnionEnum(['s3', 'sharepoint']))),
  s3: t.Optional(
    t.Object({
      endpoint: text(2048),
      bucket: text(),
      region: text(),
      accessKeyId: text(),
      secretAccessKey: text(1024),
      forcePathStyle: t.Optional(t.Nullable(t.Boolean())),
    }),
  ),
  sharepoint: t.Optional(
    t.Object({
      useInstanceApp: t.Optional(t.Boolean()),
      tenantId: text(128),
      clientId: text(128),
      clientSecret: text(1024),
      siteId: text(),
      driveId: text(),
      rootFolder: text(),
    }),
  ),
});

export const FileStorageTestResponse = t.Object({
  ok: t.Boolean(),
  steps: t.Array(CheckRowSchema),
});

export const ProcoreChecksSettingsResponse = t.Object({
  remembered: t.Boolean(),
  clientId: t.String(),
  companyId: t.String(),
  sandbox: t.Boolean(),
  hasClientSecret: t.Boolean(),
});

const PROCORE_ID = { maxLength: 128, pattern: '^[A-Za-z0-9._-]*$' };

export const ProcoreChecksBody = t.Object({
  clientId: t.Optional(t.String(PROCORE_ID)),
  clientSecret: t.Optional(t.String({ maxLength: 1024 })),
  companyId: t.Optional(t.String(PROCORE_ID)),
  sandbox: t.Optional(t.Boolean()),
  projectId: t.Optional(t.String(PROCORE_ID)),
  remember: t.Optional(t.Boolean()),
});

export const SharePointChecksBody = t.Optional(t.Object({}));

export const Microsoft365ChecksBody = t.Object({
  user: t.String({ minLength: 3, maxLength: 254, pattern: '^[^\\s@]+@[^\\s@]+$' }),
  write: t.Optional(t.Boolean()),
});

export const AllowedOriginsResponse = t.Object({
  origins: t.Array(t.String()),
  envOrigins: t.Array(t.String()),
});

export const AllowedOriginsBody = t.Object({
  origins: t.Array(t.String({ maxLength: 300 }), { maxItems: 50 }),
});
