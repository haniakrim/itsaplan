export type CheckStatus = 'PASS' | 'FAIL' | 'MISSING-PERMISSION' | 'SKIPPED';

export interface CheckRow {
  name: string;
  status: CheckStatus;
  detail: string;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function checksPassed(rows: CheckRow[]): boolean {
  return !rows.some((row) => row.status === 'FAIL');
}
