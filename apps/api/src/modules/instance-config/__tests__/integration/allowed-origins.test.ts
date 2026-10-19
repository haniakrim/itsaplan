import { beforeEach, describe, expect, it } from 'bun:test';
import { auth } from '@repo/auth';
import { app, api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { setup } from '../helpers';

beforeEach(resetDb);

const ENV_ORIGIN = 'http://localhost:3001';

async function preflight(origin: string): Promise<string | null> {
  const res = await app.handle(
    new Request('http://localhost/god/allowed-origins', {
      method: 'OPTIONS',
      headers: { origin, 'access-control-request-method': 'GET' },
    }),
  );
  return res.headers.get('access-control-allow-origin');
}

async function signOutFrom(cookie: string, origin: string): Promise<Response> {
  return app.handle(
    new Request('http://localhost/api/auth/sign-out', {
      method: 'POST',
      headers: { cookie, origin, 'content-type': 'application/json' },
      body: '{}',
    }),
  );
}

describe('allowed sign-in addresses', () => {
  it('is owner-only', async () => {
    const { user } = await setup();
    expect((await api.god['allowed-origins'].get()).status).toBe(401);
    expect((await user.api.god['allowed-origins'].get()).status).toBe(403);
    expect((await user.api.god['allowed-origins'].put({ origins: [] })).status).toBe(403);
  });

  it('lists APP_URL as the environment origins and saves extra ones normalized', async () => {
    const { god } = await setup();
    const before = await god.api.god['allowed-origins'].get();
    expect(before.data).toEqual({ origins: [], envOrigins: [ENV_ORIGIN] });

    const saved = await god.api.god['allowed-origins'].put({
      origins: [
        'http://*.orca.localhost:60418/',
        'https://app.example.com',
        'https://app.example.com',
      ],
    });
    expect(saved.status).toBe(200);
    expect(saved.data).toEqual({
      origins: ['http://*.orca.localhost:60418', 'https://app.example.com'],
      envOrigins: [ENV_ORIGIN],
    });
    expect((await god.api.god['allowed-origins'].get()).data!.origins).toHaveLength(2);
  });

  it.each(['*', 'http://*', 'https://*.com', 'ftp://x.example.com', 'https://x.example.com/path'])(
    'refuses %p',
    async (entry) => {
      const { god } = await setup();
      const res = await god.api.god['allowed-origins'].put({
        origins: ['https://ok.example.com', entry],
      });
      expect(res.status).toBe(400);
      expect((await god.api.god['allowed-origins'].get()).data!.origins).toEqual([]);
    },
  );

  it('lets CORS accept a saved origin and refuse the others', async () => {
    const { god } = await setup();
    expect(await preflight('http://one.orca.localhost:60418')).toBeNull();
    expect(await preflight(ENV_ORIGIN)).toBe(ENV_ORIGIN);

    await god.api.god['allowed-origins'].put({
      origins: ['http://*.orca.localhost:60418', 'https://app.example.com'],
    });
    expect(await preflight('http://one.orca.localhost:60418')).toBe(
      'http://one.orca.localhost:60418',
    );
    expect(await preflight('https://app.example.com')).toBe('https://app.example.com');
    expect(await preflight('https://evil.example.com')).toBeNull();
    expect(await preflight('http://one.orca.localhost:1')).toBeNull();
    expect(await preflight('http://orca.localhost.evil.com:60418')).toBeNull();
    expect(await preflight(ENV_ORIGIN)).toBe(ENV_ORIGIN);

    await god.api.god['allowed-origins'].put({ origins: [] });
    expect(await preflight('https://app.example.com')).toBeNull();
  });

  it('hands better-auth the saved origins with APP_URL, and no others', async () => {
    const { god } = await setup();
    const trusted = async () => {
      const context = await auth.$context;
      const list = await context.options.trustedOrigins;
      return typeof list === 'function' ? ((await list()) as string[]) : (list ?? []);
    };
    expect(await trusted()).toEqual([ENV_ORIGIN]);

    await god.api.god['allowed-origins'].put({
      origins: ['http://*.orca.localhost:60418', 'https://app.example.com'],
    });
    expect(await trusted()).toEqual([
      ENV_ORIGIN,
      'http://*.orca.localhost:60418',
      'https://app.example.com',
    ]);

    await god.api.god['allowed-origins'].put({ origins: [] });
    expect(await trusted()).toEqual([ENV_ORIGIN]);
  });

  it('still trusts the APP_URL origin with no extra origin saved', async () => {
    await setup();
    const user = await signUpTestUser();
    expect((await signOutFrom(user.cookie, ENV_ORIGIN)).status).toBe(200);
  });
});
