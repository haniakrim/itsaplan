#!/usr/bin/env bun
// Live check of the Microsoft 365 agent tools against a real tenant.
//
//   bun --env-file=.env scripts/verify/microsoft365-tools.ts
//
// Needs MS365_TENANT_ID, MS365_CLIENT_ID, MS365_CLIENT_SECRET and MS365_USER (the
// mailbox/OneDrive the tools act on). Runs read-only tools; with MS365_WRITE=1 also
// writes and reads back one file in an `itsaplan-verify` folder. Skips with exit 0
// when the required variables are missing. See docs/dev/live-verification.md.
import { getTool } from '../../packages/agent-tools/src/index.ts';
import { errorMessage, printTable, requireEnv, type Row } from './lib.ts';

const env = requireEnv('microsoft365-tools', [
  'MS365_TENANT_ID',
  'MS365_CLIENT_ID',
  'MS365_CLIENT_SECRET',
  'MS365_USER',
]);
const credential = {
  tenantId: env.MS365_TENANT_ID!,
  clientId: env.MS365_CLIENT_ID!,
  clientSecret: env.MS365_CLIENT_SECRET!,
  defaultUser: env.MS365_USER!,
};
const write = process.env.MS365_WRITE === '1';

const rows: Row[] = [];

async function run(
  key: string,
  input: Record<string, unknown>,
  summarize: (out: Record<string, unknown>) => string,
): Promise<Record<string, unknown> | null> {
  const tool = getTool(key)?.tool;
  if (!tool) {
    rows.push({ name: key, status: 'FAIL', detail: 'tool is not registered' });
    return null;
  }
  try {
    const parsed = tool.inputSchema.parse(input) as Record<string, unknown>;
    const out = (await tool.execute(credential, parsed)) as Record<string, unknown>;
    rows.push({ name: key, status: 'PASS', detail: summarize(out) });
    return out;
  } catch (e) {
    const message = errorMessage(e);
    const permission = /missing the "([^"]+)" application permission/.exec(message)?.[1];
    rows.push(
      permission
        ? {
            name: key,
            status: 'MISSING-PERMISSION',
            detail: `grant ${permission} (with admin consent)`,
          }
        : { name: key, status: 'FAIL', detail: message.slice(0, 200) },
    );
    return null;
  }
}

const count = (field: string) => (out: Record<string, unknown>) =>
  `${Array.isArray(out[field]) ? (out[field] as unknown[]).length : '?'} ${field}`;

const day = 24 * 60 * 60 * 1000;
const iso = (t: number) => new Date(t).toISOString();

await run('microsoft365_files_list', {}, count('items'));
await run('microsoft365_files_search', { query: 'a', limit: 5 }, count('results'));
await run('microsoft365_mail_search', { limit: 1 }, (o) => {
  const first = (o.messages as { subject?: string }[] | undefined)?.[0];
  return `${Array.isArray(o.messages) ? o.messages.length : '?'} message(s)${first ? `, newest "${first.subject ?? ''}"` : ''}`;
});
await run(
  'microsoft365_calendar_list',
  { from: iso(Date.now()), to: iso(Date.now() + 7 * day) },
  count('events'),
);
await run('microsoft365_teams_list', {}, count('teams'));

if (write) {
  const folder = `itsaplan-verify/${Date.now()}`;
  const path = `${folder}/hello.txt`;
  const content = `itsaplan verify ${new Date().toISOString()}`;
  const written = await run(
    'microsoft365_file_write',
    { path, content },
    (o) => `wrote ${String(o.name)}`,
  );
  if (written) {
    await run('microsoft365_file_read', { path }, (o) =>
      o.text === content ? 'read back identical' : `MISMATCH: got ${JSON.stringify(o.text)}`,
    );
    const last = rows[rows.length - 1]!;
    if (last.status === 'PASS' && last.detail.startsWith('MISMATCH')) last.status = 'FAIL';
    console.log(
      `left ${path} in the OneDrive of ${credential.defaultUser}; delete the itsaplan-verify folder by hand (the tools cannot delete).`,
    );
  }
} else {
  rows.push({
    name: 'microsoft365_file_write',
    status: 'SKIPPED',
    detail: 'set MS365_WRITE=1 to run it and file_read',
  });
}

printTable(rows);
const failed = rows.some((r) => r.status === 'FAIL');
console.log(failed ? 'microsoft365-tools: FAILED' : 'microsoft365-tools: done');
process.exit(failed ? 1 : 0);
