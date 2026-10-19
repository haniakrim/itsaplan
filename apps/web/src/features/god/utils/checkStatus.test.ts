import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isFailing, summarize } from './checkStatus';

describe('checkStatus', () => {
  it('counts rows by outcome', () => {
    const rows = [
      { name: 'a', status: 'PASS' as const, detail: '' },
      { name: 'b', status: 'FAIL' as const, detail: '' },
      { name: 'c', status: 'MISSING-PERMISSION' as const, detail: '' },
      { name: 'd', status: 'SKIPPED' as const, detail: '' },
    ];
    assert.deepEqual(summarize(rows), { passed: 1, failed: 2, skipped: 1 });
    assert.equal(isFailing('MISSING-PERMISSION'), true);
    assert.equal(isFailing('SKIPPED'), false);
  });
});
