import { beforeEach, describe, expect, it } from 'bun:test';
import { authedApi, createProject } from '#tests/helpers/app';
import { createAgent } from '#tests/helpers/agents';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { listAgentToolsForRun } from '#modules/agents/tools/service';
import { storedSecretRows } from '../helpers';

const SECRET = 'instance-app-secret-xyz';

beforeEach(resetDb);

async function setup() {
  const god = await signUpTestUser({ name: 'Root', email: 'root@example.com' });
  const asGod = authedApi(god.cookie);
  const project = await createProject(asGod, { key: 'MKT', name: 'Marketing' });
  return { asGod, teamId: project.data!.teamId };
}

const setInstanceApp = (asGod: ReturnType<typeof authedApi>) =>
  asGod.god.microsoft365.put({ tenantId: 'tenant-1', clientId: 'client-1', clientSecret: SECRET });

describe('Microsoft 365 credential on the instance app', () => {
  it('offers the option in the credential form, hiding the app fields behind it', async () => {
    const { asGod, teamId } = await setup();
    const catalog = await asGod.teams({ teamId }).integrations.catalog.get();
    const schema = catalog.data!.find((i) => i.key === 'microsoft365')!.credentialSchema;
    expect(schema.find((f) => f.key === 'useInstanceApp')).toMatchObject({ type: 'boolean' });
    for (const key of ['tenantId', 'clientId', 'clientSecret']) {
      expect(schema.find((f) => f.key === key)).toMatchObject({ hiddenWhen: 'useInstanceApp' });
    }
  });

  it('is refused while the instance app is not set up', async () => {
    const { asGod, teamId } = await setup();
    const res = await asGod.teams({ teamId }).integrations.post({
      integrationKey: 'microsoft365',
      credential: { useInstanceApp: true, defaultUser: 'agent@contoso.com' },
    });
    expect(res.status).toBe(400);
  });

  it('needs only the default user and keeps the secret away from the team', async () => {
    const { asGod, teamId } = await setup();
    await setInstanceApp(asGod);
    const created = await asGod.teams({ teamId }).integrations.post({
      integrationKey: 'microsoft365',
      credential: {
        useInstanceApp: true,
        defaultUser: 'agent@contoso.com',
        tenantId: 'smuggled',
        clientSecret: 'smuggled-secret',
      },
    });
    expect(created.status).toBe(201);
    expect(created.data!.redacted).toEqual({
      useInstanceApp: true,
      defaultUser: 'agent@contoso.com',
    });

    const list = await asGod.teams({ teamId }).integrations.get();
    const body = JSON.stringify([created.data, list.data]);
    expect(body).not.toContain(SECRET);
    expect(body).not.toContain('smuggled');
    expect(await storedSecretRows()).not.toContain(SECRET);
  });

  it('still takes separate app fields when the option is off', async () => {
    const { asGod, teamId } = await setup();
    const missing = await asGod.teams({ teamId }).integrations.post({
      integrationKey: 'microsoft365',
      credential: { defaultUser: 'agent@contoso.com' },
    });
    expect(missing.status).toBe(400);
    const own = await asGod.teams({ teamId }).integrations.post({
      integrationKey: 'microsoft365',
      credential: { tenantId: 't', clientId: 'c', clientSecret: 'own-secret' },
    });
    expect(own.status).toBe(201);
  });

  it('resolves the instance app when a tool runs, and follows a later change', async () => {
    const { asGod, teamId } = await setup();
    await setInstanceApp(asGod);
    const credential = await asGod.teams({ teamId }).integrations.post({
      integrationKey: 'microsoft365',
      credential: { useInstanceApp: true, defaultUser: 'agent@contoso.com' },
    });
    const tool = await asGod.teams({ teamId })['agent-tools'].post({
      toolKey: 'microsoft365_files_list',
      credentialId: credential.data!.id,
    });
    expect(tool.status).toBe(201);
    const agent = await createAgent(asGod, 'MKT', {
      name: 'Bot',
      username: 'bot',
      kind: 'internal',
    });
    const agentId = agent.data!.agent.id;
    await asGod
      .teams({ teamId })
      ['ai-agents']({ agentId })
      ['tool-configs'].put({
        agentToolIds: [tool.data!.id],
      });

    const [run] = await listAgentToolsForRun(agentId);
    expect(run!.credential).toMatchObject({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      clientSecret: SECRET,
      defaultUser: 'agent@contoso.com',
    });

    await asGod.god.microsoft365.put({ tenantId: 'tenant-2', clientId: 'client-2' });
    const [again] = await listAgentToolsForRun(agentId);
    expect(again!.credential).toMatchObject({ tenantId: 'tenant-2', clientSecret: SECRET });
    const view = await asGod.teams({ teamId })['agent-tools'].get();
    expect(JSON.stringify(view.data)).not.toContain(SECRET);
  });
});
