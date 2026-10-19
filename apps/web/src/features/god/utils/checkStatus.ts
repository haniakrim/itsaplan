import type { CheckRow, CheckStatus } from '@/lib/api/endpoints/god';

export function isFailing(status: CheckStatus): boolean {
  return status === 'FAIL' || status === 'MISSING-PERMISSION';
}

export function summarize(rows: CheckRow[]): { passed: number; failed: number; skipped: number } {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of rows) {
    if (row.status === 'PASS') passed += 1;
    else if (row.status === 'SKIPPED') skipped += 1;
    else failed += 1;
  }
  return { passed, failed, skipped };
}
