import { getTool } from '@repo/agent-tools';
import { errorMessage, type CheckRow } from './types';

export interface Microsoft365Credential extends Record<string, string> {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  defaultUser: string;
}

const day = 24 * 60 * 60 * 1000;
const iso = (t: number) => new Date(t).toISOString();

const count = (field: string) => (out: Record<string, unknown>) =>
  `${Array.isArray(out[field]) ? (out[field] as unknown[]).length : '?'} ${field}`;

// Calls the registered Microsoft 365 tools with their input schemas, as the agent runtime
// does. Read-only unless `write` is set, which also writes one file into an
// `itsaplan-verify/<timestamp>` folder of the default user's OneDrive and reads it back.
// The tools cannot delete, so that folder stays.
export async function checkMicrosoft365Tools(
  credential: Microsoft365Credential,
  options: { write?: boolean } = {},
): Promise<CheckRow[]> {
  const rows: CheckRow[] = [];

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

  if (options.write) {
    const path = `itsaplan-verify/${Date.now()}/hello.txt`;
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
      rows.push({
        name: 'cleanup',
        status: 'SKIPPED',
        detail: `left ${path} in the OneDrive of ${credential.defaultUser}; delete the itsaplan-verify folder by hand (the tools cannot delete).`,
      });
    }
  } else {
    rows.push({
      name: 'microsoft365_file_write',
      status: 'SKIPPED',
      detail: 'write checks are off: they run file_write and file_read',
    });
  }
  return rows;
}
