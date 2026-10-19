import {
  MICROSOFT365_SECRET_KEY,
  getStoredInstanceMicrosoft365,
  invalidateStorageBackendCache,
  writeSecret,
  type InstanceMicrosoft365,
} from '@repo/db';

// The instance's Microsoft 365 app registration (god mode "Microsoft 365"). The secret is
// encrypted in app_secret and never returned; a response says only whether one is stored.

const TOKEN_TIMEOUT_MS = 15_000;

export interface Microsoft365Settings {
  tenantId: string;
  clientId: string;
  hasClientSecret: boolean;
}

export interface Microsoft365Patch {
  tenantId: string;
  clientId: string;
  clientSecret?: string;
}

function toSettings(app: InstanceMicrosoft365 | null): Microsoft365Settings {
  return {
    tenantId: app?.tenantId ?? '',
    clientId: app?.clientId ?? '',
    hasClientSecret: (app?.clientSecret ?? '').length > 0,
  };
}

function merge(
  current: InstanceMicrosoft365 | null,
  patch: Microsoft365Patch,
): InstanceMicrosoft365 {
  return {
    tenantId: patch.tenantId.trim(),
    clientId: patch.clientId.trim(),
    clientSecret: patch.clientSecret?.trim() || current?.clientSecret || '',
  };
}

export async function getMicrosoft365Settings(): Promise<Microsoft365Settings> {
  return toSettings(await getStoredInstanceMicrosoft365());
}

export async function setMicrosoft365Settings(
  patch: Microsoft365Patch,
): Promise<Microsoft365Settings> {
  const next = merge(await getStoredInstanceMicrosoft365(), patch);
  const settings = toSettings(next);
  await writeSecret(MICROSOFT365_SECRET_KEY, next, settings);
  invalidateStorageBackendCache();
  return settings;
}

// Asks Microsoft for a Graph token with the supplied values (the stored secret when none
// is supplied) and reports whether it was granted.
export async function testMicrosoft365(
  patch: Microsoft365Patch,
): Promise<{ ok: boolean; message: string }> {
  const app = merge(await getStoredInstanceMicrosoft365(), patch);
  if (!app.tenantId || !app.clientId || !app.clientSecret) {
    return {
      ok: false,
      message: 'Enter the tenant ID, the client ID and the client secret first.',
    };
  }
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(app.tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: app.clientId,
          client_secret: app.clientSecret,
          scope: 'https://graph.microsoft.com/.default',
        }),
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      error_description?: string;
    };
    if (res.ok && body.access_token) {
      return { ok: true, message: 'Microsoft Graph granted a token to the app.' };
    }
    const reason = (body.error_description ?? 'no description').split('\r\n')[0]!.slice(0, 300);
    return {
      ok: false,
      message: `Microsoft refused the credentials (HTTP ${res.status}): ${reason}`,
    };
  } catch (err) {
    console.error('[god] microsoft 365 test failed:', err);
    return { ok: false, message: 'Microsoft could not be reached.' };
  }
}
