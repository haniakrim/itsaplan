#!/usr/bin/env bun
// Live check of the SharePoint / OneDrive storage driver against a real library.
//
//   bun --env-file=.env scripts/verify/sharepoint-storage.ts
//
// Reads the same SHAREPOINT_* variables as the driver: SHAREPOINT_TENANT_ID,
// SHAREPOINT_CLIENT_ID, SHAREPOINT_CLIENT_SECRET and SHAREPOINT_SITE_ID or
// SHAREPOINT_DRIVE_ID (optional SHAREPOINT_ROOT_FOLDER). Writes only under the
// `itsaplan-verify/` prefix and deletes what it wrote. Skips with exit 0 when the
// required variables are missing. The check itself is packages/live-checks, which god
// mode runs too. See docs/dev/live-verification.md.
import { sharePointConfigFromEnv } from '../../packages/storage/src/index.ts';
import { checkSharePointStorage, checksPassed } from '../../packages/live-checks/src/index.ts';
import { printTable, requireEnv } from './lib.ts';

requireEnv('sharepoint-storage', [
  'SHAREPOINT_TENANT_ID',
  'SHAREPOINT_CLIENT_ID',
  'SHAREPOINT_CLIENT_SECRET',
]);
if (!process.env.SHAREPOINT_SITE_ID?.trim() && !process.env.SHAREPOINT_DRIVE_ID?.trim()) {
  console.log('sharepoint-storage: skipped: set SHAREPOINT_SITE_ID or SHAREPOINT_DRIVE_ID');
  process.exit(0);
}

const rows = await checkSharePointStorage(sharePointConfigFromEnv());
printTable(rows);
const ok = checksPassed(rows);
console.log(ok ? 'sharepoint-storage: all checks passed' : 'sharepoint-storage: FAILED');
process.exit(ok ? 0 : 1);
