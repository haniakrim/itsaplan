#!/usr/bin/env bun
// Live check of the Procore import against a real (sandbox) company. Read-only.
//
//   bun --env-file=.env scripts/verify/procore.ts
//
// Needs PROCORE_CLIENT_ID, PROCORE_CLIENT_SECRET and PROCORE_COMPANY_ID; optional
// PROCORE_PROJECT_ID (default: the first project listed) and PROCORE_SANDBOX=1.
// Skips with exit 0 when the required variables are missing. The check itself is
// packages/live-checks, which god mode runs too. See docs/dev/live-verification.md.
import { checkProcore, checksPassed } from '../../packages/live-checks/src/index.ts';
import { printTable, requireEnv } from './lib.ts';

const env = requireEnv('procore', [
  'PROCORE_CLIENT_ID',
  'PROCORE_CLIENT_SECRET',
  'PROCORE_COMPANY_ID',
]);
const rows = await checkProcore(
  {
    clientId: env.PROCORE_CLIENT_ID!,
    clientSecret: env.PROCORE_CLIENT_SECRET!,
    companyId: env.PROCORE_COMPANY_ID!,
    sandbox: ['1', 'true'].includes(process.env.PROCORE_SANDBOX?.trim() ?? ''),
  },
  { projectId: process.env.PROCORE_PROJECT_ID },
);
printTable(rows);
const ok = checksPassed(rows);
console.log(ok ? 'procore: done' : 'procore: FAILED');
process.exit(ok ? 0 : 1);
