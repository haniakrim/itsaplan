import { and, eq } from 'drizzle-orm';
import {
  appSecret,
  db,
  getInstanceMicrosoft365,
  getStorageOverrides,
  readSecret,
  writeSecret,
} from '@repo/db';
import { resolveSharePointConfig } from '@repo/storage';
import {
  checkMicrosoft365Tools,
  checkProcore,
  checksPassed,
  checkSharePointStorage,
  type CheckRow,
} from '@repo/live-checks';
import { HttpError } from '#shared/lib';

// The live integration checks of god mode: the same checks as scripts/verify/, run on the
// server. The Procore credentials are asked for in the request; the owner may have them
// remembered, encrypted in app_secret, so they need not be entered again.

const PROCORE_SECRET_KEY = 'integration-checks.procore';

interface ProcoreStored {
  clientId: string;
  clientSecret: string;
  companyId: string;
  sandbox: boolean;
}

export interface ProcoreChecksSettings {
  remembered: boolean;
  clientId: string;
  companyId: string;
  sandbox: boolean;
  hasClientSecret: boolean;
}

export interface ProcoreChecksInput {
  clientId?: string;
  clientSecret?: string;
  companyId?: string;
  sandbox?: boolean;
  projectId?: string;
  remember?: boolean;
}

export interface ChecksResult {
  ok: boolean;
  rows: CheckRow[];
}

const result = (rows: CheckRow[]): ChecksResult => ({ ok: checksPassed(rows), rows });

export async function getProcoreChecksSettings(): Promise<ProcoreChecksSettings> {
  const stored = await readSecret<ProcoreStored>(PROCORE_SECRET_KEY);
  return {
    remembered: stored !== null,
    clientId: stored?.clientId ?? '',
    companyId: stored?.companyId ?? '',
    sandbox: stored?.sandbox ?? false,
    hasClientSecret: Boolean(stored?.clientSecret),
  };
}

export async function forgetProcoreChecks(): Promise<void> {
  await db.delete(appSecret).where(and(eq(appSecret.key, PROCORE_SECRET_KEY)));
}

export async function runProcoreChecks(input: ProcoreChecksInput): Promise<ChecksResult> {
  const stored = await readSecret<ProcoreStored>(PROCORE_SECRET_KEY);
  const credential: ProcoreStored = {
    clientId: input.clientId?.trim() || stored?.clientId || '',
    clientSecret: input.clientSecret?.trim() || stored?.clientSecret || '',
    companyId: input.companyId?.trim() || stored?.companyId || '',
    sandbox: input.sandbox ?? stored?.sandbox ?? false,
  };
  if (!credential.clientId || !credential.clientSecret || !credential.companyId) {
    throw new HttpError(400, 'The Procore client ID, client secret and company ID are required');
  }
  if (input.remember) {
    await writeSecret(PROCORE_SECRET_KEY, credential, {
      clientId: credential.clientId,
      companyId: credential.companyId,
      sandbox: credential.sandbox,
    });
  }
  return result(await checkProcore(credential, { projectId: input.projectId }));
}

export async function runSharePointChecks(): Promise<ChecksResult> {
  let config;
  try {
    config = resolveSharePointConfig(
      await getStorageOverrides(),
      process.env,
      await getInstanceMicrosoft365(),
    );
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : 'SharePoint is not configured');
  }
  return result(await checkSharePointStorage(config));
}

export async function runMicrosoft365Checks(input: {
  user: string;
  write?: boolean;
}): Promise<ChecksResult> {
  const app = await getInstanceMicrosoft365();
  if (!app) throw new HttpError(400, 'The instance Microsoft 365 app is not set up');
  return result(
    await checkMicrosoft365Tools(
      { ...app, defaultUser: input.user.trim() },
      { write: input.write },
    ),
  );
}
