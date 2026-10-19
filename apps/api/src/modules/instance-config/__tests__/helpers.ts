import { db, appSecret } from '@repo/db';
import { authedApi, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';

export interface Actor {
  userId: string;
  api: Api;
}

// The first account in a reset database is the instance owner ("god"); the second is a
// plain user.
export async function setup(): Promise<{ god: Actor; user: Actor }> {
  const godUser = await signUpTestUser({ name: 'Root', email: 'root@example.com' });
  const plain = await signUpTestUser({ name: 'Plain', email: 'plain@example.com' });
  return {
    god: { userId: godUser.userId, api: authedApi(godUser.cookie) },
    user: { userId: plain.userId, api: authedApi(plain.cookie) },
  };
}

// Everything stored encrypted, as one string: a secret must not appear anywhere in it.
export async function storedSecretRows(): Promise<string> {
  return JSON.stringify(await db.select().from(appSecret));
}

export interface FakeS3 {
  endpoint: string;
  objects: Map<string, Buffer>;
  stop: () => void;
}

// Just enough path-style S3 for one put, get and delete of an object.
export function startFakeS3(): FakeS3 {
  const objects = new Map<string, Buffer>();
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(req) {
      const key = new URL(req.url).pathname;
      if (req.method === 'PUT') {
        objects.set(key, Buffer.from(await req.arrayBuffer()));
        return new Response(null, { status: 200, headers: { etag: '"x"' } });
      }
      if (req.method === 'GET') {
        const body = objects.get(key);
        return body
          ? new Response(body, { headers: { 'content-type': 'text/plain' } })
          : new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 });
      }
      if (req.method === 'DELETE') {
        objects.delete(key);
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 405 });
    },
  });
  return {
    endpoint: `http://127.0.0.1:${server.port}`,
    objects,
    stop: () => void server.stop(true),
  };
}

export function allowPrivateStorageHost(endpoint: string): () => void {
  const previous = process.env.STORAGE_ALLOWED_PRIVATE_HOSTS;
  process.env.STORAGE_ALLOWED_PRIVATE_HOSTS = new URL(endpoint).host;
  return () => {
    if (previous === undefined) delete process.env.STORAGE_ALLOWED_PRIVATE_HOSTS;
    else process.env.STORAGE_ALLOWED_PRIVATE_HOSTS = previous;
  };
}
