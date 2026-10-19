import {
  createSharePointDriver,
  type SharePointConfig,
  type SharePointDeps,
  type StorageDriver,
} from '@repo/storage';
import { errorMessage, type CheckRow } from './types';

function bytes(size: number): Buffer {
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i++) buf[i] = (i * 31 + 7) & 0xff;
  return buf;
}

async function read(driver: StorageDriver, key: string) {
  const object = await driver.get(key);
  return {
    data: Buffer.from(await new Response(object.body).arrayBuffer()),
    contentType: object.contentType,
  };
}

// Writes, reads back and deletes files under `itsaplan-verify/<timestamp>/` in the
// configured SharePoint library or OneDrive: a 1 KiB file (simple upload) and a 5 MiB one
// (upload session, several chunks). Everything it writes is deleted.
export async function checkSharePointStorage(
  config: SharePointConfig,
  deps: SharePointDeps = {},
): Promise<CheckRow[]> {
  const driver = createSharePointDriver(config, deps);
  const prefix = `itsaplan-verify/${Date.now()}`;
  const cases = [
    { key: `${prefix}/small.bin`, body: bytes(1024), type: 'application/octet-stream' },
    { key: `${prefix}/large.png`, body: bytes(5 * 1024 * 1024 + 123), type: 'image/png' },
  ];
  const rows: CheckRow[] = [];
  const pass = (name: string, detail = '') => rows.push({ name, status: 'PASS', detail });
  const fail = (name: string, detail: string) => rows.push({ name, status: 'FAIL', detail });
  async function attempt(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (e) {
      fail(name, errorMessage(e));
    }
  }

  try {
    for (const c of cases) {
      await attempt(`put ${c.key} (${c.body.length} bytes)`, async () => {
        await driver.put(c.key, c.body, c.type);
        pass(`put ${c.key} (${c.body.length} bytes)`);
      });
      await attempt(`get ${c.key}`, async () => {
        const got = await read(driver, c.key);
        const same = got.data.equals(c.body);
        (same ? pass : fail)(`get ${c.key}: bytes`, `${got.data.length} bytes back`);
        const typeOk = got.contentType === c.type;
        (typeOk ? pass : fail)(`get ${c.key}: content type`, `got "${got.contentType}"`);
      });
    }
  } finally {
    for (const c of cases) {
      await attempt(`delete ${c.key}`, async () => {
        await driver.delete(c.key);
        pass(`delete ${c.key}`);
        await driver.delete(c.key);
        pass(`delete ${c.key} again (404 is ok)`);
      });
      await attempt(`get after delete ${c.key}`, async () => {
        const gone = await driver.get(c.key).then(
          () => false,
          () => true,
        );
        (gone ? pass : fail)(`get after delete ${c.key} fails`, '');
      });
    }
  }
  return rows;
}
