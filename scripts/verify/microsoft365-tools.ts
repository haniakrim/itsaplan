#!/usr/bin/env bun
// Live check of the Microsoft 365 agent tools against a real tenant.
//
//   bun --env-file=.env scripts/verify/microsoft365-tools.ts
//
// Needs MS365_TENANT_ID, MS365_CLIENT_ID, MS365_CLIENT_SECRET and MS365_USER (the
// mailbox/OneDrive the tools act on). Runs read-only tools; with MS365_WRITE=1 also
// writes and reads back one file in an `itsaplan-verify` folder. Skips with exit 0
// when the required variables are missing. The check itself is packages/live-checks,
// which god mode runs too. See docs/dev/live-verification.md.
import { checkMicrosoft365Tools, checksPassed } from '../../packages/live-checks/src/index.ts';
import { printTable, requireEnv } from './lib.ts';

const env = requireEnv('microsoft365-tools', [
  'MS365_TENANT_ID',
  'MS365_CLIENT_ID',
  'MS365_CLIENT_SECRET',
  'MS365_USER',
]);
const rows = await checkMicrosoft365Tools(
  {
    tenantId: env.MS365_TENANT_ID!,
    clientId: env.MS365_CLIENT_ID!,
    clientSecret: env.MS365_CLIENT_SECRET!,
    defaultUser: env.MS365_USER!,
  },
  { write: process.env.MS365_WRITE === '1' },
);
printTable(rows);
const ok = checksPassed(rows);
console.log(ok ? 'microsoft365-tools: done' : 'microsoft365-tools: FAILED');
process.exit(ok ? 0 : 1);
