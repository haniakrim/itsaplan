const ORIGIN = /^(https?):\/\/([^/?#@\s]+)$/i;
const LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;

export function normalizeOrigin(entry: string): string {
  return entry.trim().replace(/\/+$/, '');
}

export function isValidOrigin(entry: string): boolean {
  const match = ORIGIN.exec(normalizeOrigin(entry));
  if (!match) return false;
  const hostPort = match[2]!;
  const portMatch = /^(.*?)(?::(\d{1,5}))?$/.exec(hostPort);
  const host = portMatch?.[1] ?? '';
  const port = portMatch?.[2];
  if (port !== undefined && Number(port) > 65535) return false;
  if (host === '' || host === '*') return false;
  const labels = host.split('.');
  return labels.every((label, index) => (index === 0 && label === '*') || LABEL.test(label));
}

export function parseOrigins(text: string): string[] {
  const seen = new Set<string>();
  for (const line of text.split('\n')) {
    const entry = normalizeOrigin(line);
    if (entry) seen.add(entry);
  }
  return [...seen];
}

export function firstInvalidOrigin(origins: string[]): string | null {
  return origins.find((entry) => !isValidOrigin(entry)) ?? null;
}
