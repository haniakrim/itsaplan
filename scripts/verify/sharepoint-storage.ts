#!/usr/bin/env bun
// Live check of the SharePoint / OneDrive storage driver against a real library.
//
//   bun --env-file=.env scripts/verify/sharepoint-storage.ts
//
// Reads the same SHAREPOINT_* variables as the driver: SHAREPOINT_TENANT_ID,
// SHAREPOINT_CLIENT_ID, SHAREPOINT_CLIENT_SECRET and SHAREPOINT_SITE_ID or
// SHAREPOINT_DRIVE_ID (optional SHAREPOINT_ROOT_FOLDER). Writes only under the
// `itsaplan-verify/` prefix and deletes what it wrote. Skips with exit 0 when the
// required variables are missing. See docs/dev/live-verification.md.
import {
  createSharePointDriver,
  sharePointConfigFromEnv,
} from '../../packages/storage/src/index.ts';
import { errorMessage, requireEnv } from './lib.ts';

requireEnv('sharepoint-storage', [
  'SHAREPOINT_TENANT_ID',
  'SHAREPOINT_CLIENT_ID',
  'SHAREPOINT_CLIENT_SECRET',
]);
if (!process.env.SHAREPOINT_SITE_ID?.trim() && !process.env.SHAREPOINT_DRIVE_ID?.trim()) {
  console.log('sharepoint-storage: skipped: set SHAREPOINT_SITE_ID or SHAREPOINT_DRIVE_ID');
  process.exit(0);
}

const driver = createSharePointDriver(sharePointConfigFromEnv());
const run = Date.now();
const prefix = `itsaplan-verify/${run}`;

function bytes(size: number): Buffer {
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i++) buf[i] = (i * 31 + 7) & 0xff;
  return buf;
}

async function read(key: string): Promise<{ data: Buffer; contentType: string }> {
  const object = await driver.get(key);
  return {
    data: Buffer.from(await new Response(object.body).arrayBuffer()),
    contentType: object.contentType,
  };
}

const cases = [
  { key: `${prefix}/small.bin`, body: bytes(1024), type: 'application/octet-stream' },
  // Above SIMPLE_UPLOAD_MAX (4 MiB): goes through an upload session, in several chunks.
  { key: `${prefix}/large.png`, body: bytes(5 * 1024 * 1024 + 123), type: 'image/png' },
];

let failed = false;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};
async function attempt(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    check(name, false, errorMessage(e));
  }
}

try {
  for (const c of cases) {
    await attempt(`put ${c.key} (${c.body.length} bytes)`, async () => {
      await driver.put(c.key, c.body, c.type);
      check(`put ${c.key} (${c.body.length} bytes)`, true);
    });
    await attempt(`get ${c.key}`, async () => {
      const got = await read(c.key);
      check(`get ${c.key}: bytes`, got.data.equals(c.body), `${got.data.length} bytes back`);
      check(`get ${c.key}: content type`, got.contentType === c.type, `got "${got.contentType}"`);
    });
  }
} finally {
  for (const c of cases) {
    await attempt(`delete ${c.key}`, async () => {
      await driver.delete(c.key);
      check(`delete ${c.key}`, true);
      await driver.delete(c.key);
      check(`delete ${c.key} again (404 is ok)`, true);
    });
    await attempt(`get after delete ${c.key}`, async () => {
      const gone = await driver.get(c.key).then(
        () => false,
        () => true,
      );
      check(`get after delete ${c.key} fails`, gone);
    });
  }
}
console.log(failed ? 'sharepoint-storage: FAILED' : 'sharepoint-storage: all checks passed');
process.exit(failed ? 1 : 0);
