#!/usr/bin/env bun
// Live check of the Procore import against a real (sandbox) company. Read-only.
//
//   bun --env-file=.env scripts/verify/procore.ts
//
// Needs PROCORE_CLIENT_ID, PROCORE_CLIENT_SECRET and PROCORE_COMPANY_ID; optional
// PROCORE_PROJECT_ID (default: the first project listed) and PROCORE_SANDBOX=1.
// Skips with exit 0 when the required variables are missing. See
// docs/dev/live-verification.md.
import { ProcoreReader, procoreHosts } from '../../apps/worker/src/procore-adapter.ts';
import {
  mapProcoreAttachments,
  mapProcoreIssue,
  mapProcoreRfiReplies,
  type ProcoreItem,
  type ProcoreRfi,
  type ProcoreTool,
} from '../../apps/worker/src/procore-mapping.ts';
import { errorMessage, requireEnv } from './lib.ts';

const env = requireEnv('procore', [
  'PROCORE_CLIENT_ID',
  'PROCORE_CLIENT_SECRET',
  'PROCORE_COMPANY_ID',
]);
const credential = {
  clientId: env.PROCORE_CLIENT_ID!,
  clientSecret: env.PROCORE_CLIENT_SECRET!,
  companyId: env.PROCORE_COMPANY_ID!,
  sandbox: ['1', 'true'].includes(process.env.PROCORE_SANDBOX?.trim() ?? ''),
};
const hosts = procoreHosts(credential.sandbox);

// Fields the mapping reads, per tool. A field absent from every sampled payload is
// either wrong in the mapping or simply empty in the data.
const EXPECTED: Record<ProcoreTool, string[]> = {
  punch_items: [
    'id',
    'position',
    'name',
    'status',
    'description',
    'due_date',
    'priority',
    'created_at',
    'updated_at',
    'assignments',
    'punch_item_manager',
    'attachments',
  ],
  rfis: [
    'id',
    'number',
    'full_number',
    'subject',
    'status',
    'description',
    'due_date',
    'priority',
    'created_at',
    'updated_at',
    'questions',
    'responses',
    'assignees',
    'attachments',
  ],
};
const NESTED: Record<string, string[]> = {
  'attachments[]': ['id', 'name', 'filename', 'url', 'content_type', 'size'],
  'questions[]': ['id', 'body', 'plain_text_body', 'created_at', 'created_by'],
  'responses[]': ['id', 'body', 'plain_text_body', 'created_at', 'created_by'],
  'assignments[]': ['login', 'email', 'email_address', 'name', 'login_information'],
  'assignees[]': ['login', 'email', 'email_address', 'name', 'login_information'],
};

let failed = false;
const step = (name: string, detail: string) => console.log(`[ok]   ${name}: ${detail}`);
const fail = (name: string, e: unknown) => {
  failed = true;
  console.log(`[FAIL] ${name}: ${errorMessage(e)}`);
};

async function token(): Promise<string> {
  const res = await fetch(`${hosts.login}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: credential.clientId,
      client_secret: credential.clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`token request: HTTP ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;
  if (typeof body.access_token !== 'string') throw new Error('no access_token in response');
  step(
    'token',
    `keys ${Object.keys(body).sort().join(',')}; expires_in ${String(body.expires_in)}`,
  );
  return body.access_token;
}

async function get(path: string, bearer: string) {
  const res = await fetch(`${hosts.api}${path}`, {
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Procore-Company-Id': credential.companyId,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`GET ${path}: HTTP ${res.status}`);
  return res;
}

function present(sample: Record<string, unknown>[], key: string): boolean {
  return sample.some((o) => o[key] !== undefined && o[key] !== null);
}

function report(tool: ProcoreTool, label: string, sample: Record<string, unknown>[]): void {
  if (sample.length === 0) return;
  const seen = new Set(sample.flatMap((o) => Object.keys(o)));
  const missing = EXPECTED[tool].filter((k) => !present(sample, k));
  const extra = [...seen].filter((k) => !EXPECTED[tool].includes(k)).sort();
  console.log(`       ${tool} ${label} (${sample.length} sampled)`);
  console.log(`         fields the mapping reads but none had: ${missing.join(', ') || 'none'}`);
  console.log(`         fields present the mapping ignores: ${extra.join(', ') || 'none'}`);
  for (const [path, keys] of Object.entries(NESTED)) {
    const parent = path.replace('[]', '');
    const inner = sample.flatMap((o) => (Array.isArray(o[parent]) ? (o[parent] as unknown[]) : []));
    const objs = inner.filter((i): i is Record<string, unknown> => typeof i === 'object' && !!i);
    if (objs.length === 0) continue;
    const gone = keys.filter((k) => !present(objs, k));
    console.log(`         ${path} (${objs.length}) missing: ${gone.join(', ') || 'none'}`);
  }
}

async function verifyTool(tool: ProcoreTool, projectId: string, bearer: string): Promise<void> {
  const reader = new ProcoreReader(credential, projectId, tool);
  const project = encodeURIComponent(projectId);
  const path =
    tool === 'rfis'
      ? `/rest/v1.0/projects/${project}/rfis?page=1&per_page=100`
      : `/rest/v1.0/punch_items?project_id=${project}&page=1&per_page=100`;
  let raw: ProcoreItem[] = [];
  try {
    const res = await get(path, bearer);
    raw = (await res.json()) as ProcoreItem[];
    step(
      `${tool} list`,
      `${raw.length} item(s); pagination headers total=${res.headers.get('total')} per-page=${res.headers.get('per-page')} x-rate-limit-reset=${res.headers.get('x-rate-limit-reset')}`,
    );
    const statuses = [...new Set(raw.map((i) => i.status ?? '(none)'))];
    console.log(`       statuses seen: ${statuses.join(', ') || 'none'}`);
    report(tool, 'list view', raw as unknown as Record<string, unknown>[]);
  } catch (e) {
    fail(`${tool} list`, e);
    return;
  }
  try {
    const page = await reader.listIssues(null);
    step(`${tool} reader.listIssues`, `${page.items.length} mapped, next cursor ${page.cursor}`);
  } catch (e) {
    fail(`${tool} reader.listIssues`, e);
  }
  const first = raw[0];
  if (!first) {
    console.log(`       ${tool}: no items in this project, nothing to map`);
    return;
  }
  const id = String(first.id);
  try {
    const detail = await get(
      tool === 'rfis'
        ? `/rest/v1.0/projects/${project}/rfis/${encodeURIComponent(id)}`
        : `/rest/v1.0/punch_items/${encodeURIComponent(id)}?project_id=${project}`,
      bearer,
    );
    const item = (await detail.json()) as ProcoreItem;
    report(tool, `detail view of ${id}`, [item as unknown as Record<string, unknown>]);
    const issue = mapProcoreIssue(tool, item);
    step(
      `${tool} map`,
      `title "${issue.title}", state ${issue.stateSourceId}, assignee ${issue.assigneeEmail ?? 'none'}, priority ${issue.priority ?? 'none'}`,
    );
    const attachments = mapProcoreAttachments(item.attachments);
    step(`${tool} attachments`, `${attachments.length} with a download URL`);
    if (tool === 'rfis') {
      step('rfis replies', `${mapProcoreRfiReplies(item as ProcoreRfi).length} comment(s)`);
    }
    const viaReader = await reader.getIssue(id);
    if (viaReader.title !== issue.title)
      throw new Error('reader.getIssue differs from the mapping');
  } catch (e) {
    fail(`${tool} detail/map`, e);
  }
}

try {
  const bearer = await token();
  let projectId = process.env.PROCORE_PROJECT_ID?.trim() ?? '';
  try {
    const res = await get(
      `/rest/v1.0/projects?company_id=${encodeURIComponent(credential.companyId)}&page=1&per_page=100`,
      bearer,
    );
    const projects = (await res.json()) as { id: number | string; name?: string }[];
    step(
      'projects',
      `${projects.length} on first page: ${projects
        .slice(0, 5)
        .map((p) => `${p.id} ${p.name ?? ''}`)
        .join('; ')}`,
    );
    if (!projectId && projects[0]) projectId = String(projects[0].id);
  } catch (e) {
    fail('projects', e);
  }
  if (!projectId) {
    console.log('procore: no project to read; set PROCORE_PROJECT_ID');
    failed = true;
  } else {
    console.log(`using project ${projectId} (${credential.sandbox ? 'sandbox' : 'production'})`);
    await verifyTool('punch_items', projectId, bearer);
    await verifyTool('rfis', projectId, bearer);
  }
} catch (e) {
  fail('setup', e);
}
console.log(failed ? 'procore: FAILED' : 'procore: done');
process.exit(failed ? 1 : 0);
