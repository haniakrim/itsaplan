import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildFileStoragePatch, EMPTY_DRAFT, isDraftDirty } from './fileStoragePatch';

describe('buildFileStoragePatch', () => {
  it('is empty for an untouched draft', () => {
    assert.deepEqual(buildFileStoragePatch(EMPTY_DRAFT), {});
    assert.equal(isDraftDirty(EMPTY_DRAFT), false);
  });

  it('keeps null (use environment) and blank strings, drops blank secrets', () => {
    const patch = buildFileStoragePatch({
      driver: 'sharepoint',
      s3: { endpoint: null, bucket: '', secretAccessKey: '' },
      sharepoint: { useInstanceApp: true, clientSecret: null, siteId: undefined },
    });
    assert.deepEqual(patch, {
      driver: 'sharepoint',
      s3: { endpoint: null, bucket: '' },
      sharepoint: { useInstanceApp: true, clientSecret: null },
    });
  });
});
