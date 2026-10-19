// Shared helpers for the live verification scripts (docs/dev/live-verification.md).

// Prints "skipped: set A, B" and exits 0 when any of the variables is missing.
export function requireEnv(label: string, names: string[]): Record<string, string> {
  const missing = names.filter((n) => !process.env[n]?.trim());
  if (missing.length > 0) {
    console.log(`${label}: skipped: set ${missing.join(', ')}`);
    process.exit(0);
  }
  return Object.fromEntries(names.map((n) => [n, process.env[n]!.trim()]));
}

export interface Row {
  name: string;
  status: 'PASS' | 'FAIL' | 'MISSING-PERMISSION' | 'SKIPPED';
  detail: string;
}

export function printTable(rows: Row[]): void {
  const width = Math.max(4, ...rows.map((r) => r.name.length));
  for (const r of rows) console.log(`${r.name.padEnd(width)}  ${r.status.padEnd(18)}  ${r.detail}`);
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
