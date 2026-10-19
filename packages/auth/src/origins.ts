import { getSetting, setSetting } from '@repo/db';

export const ALLOWED_ORIGINS_SETTING_KEY = 'auth.allowedOrigins';

export const MAX_EXTRA_ORIGINS = 50;
const CACHE_TTL_MS = 5_000;

const ORIGIN_PATTERN = /^(https?):\/\/(\[[0-9a-f:.]+\]|[a-z0-9*.-]+)(?::(\d{1,5}))?\/?$/i;
const LABEL_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;
const DEFAULT_PORTS: Record<string, string> = { http: '80', https: '443' };

export class OriginEntryError extends Error {}

interface ParsedOrigin {
  scheme: string;
  host: string;
  port: string;
}

function parse(raw: string): ParsedOrigin | null {
  const match = ORIGIN_PATTERN.exec(raw.trim());
  if (!match) return null;
  const scheme = match[1]!.toLowerCase();
  const port = match[3] && match[3] !== DEFAULT_PORTS[scheme] ? match[3] : '';
  if (port && (Number(port) < 1 || Number(port) > 65535)) return null;
  return { scheme, host: match[2]!.toLowerCase(), port };
}

const format = (p: ParsedOrigin) => `${p.scheme}://${p.host}${p.port ? `:${p.port}` : ''}`;

// A wildcard stands for the whole leftmost label and needs at least two labels after it,
// so "*.example.com" is accepted while "*", "*.com" and "a*.example.com" are not.
function validateHost(host: string): void {
  if (host.startsWith('[')) return;
  if (host.includes('*')) {
    const labels = host.split('.');
    const rest = labels.slice(1);
    if (
      labels[0] !== '*' ||
      labels.length < 3 ||
      rest.some((l) => !LABEL_PATTERN.test(l)) ||
      /^\d+$/.test(rest[rest.length - 1]!)
    ) {
      throw new OriginEntryError(
        `"${host}": a wildcard is only allowed as the whole leftmost label, with at least two labels after it`,
      );
    }
    return;
  }
  if (IPV4_PATTERN.test(host)) return;
  if (host.split('.').some((l) => !LABEL_PATTERN.test(l))) {
    throw new OriginEntryError(`"${host}" is not a valid host name`);
  }
}

export function normalizeOriginEntry(raw: string): string {
  const entry = raw.trim();
  if (!entry) throw new OriginEntryError('An origin is empty');
  const parsed = parse(entry);
  if (!parsed) {
    throw new OriginEntryError(
      `"${entry}" is not an origin: use http(s)://host[:port] without a path`,
    );
  }
  validateHost(parsed.host);
  return format(parsed);
}

export function normalizeOriginEntries(entries: string[]): string[] {
  const unique = [...new Set(entries.map(normalizeOriginEntry))];
  if (unique.length > MAX_EXTRA_ORIGINS) {
    throw new OriginEntryError(`At most ${MAX_EXTRA_ORIGINS} extra origins are allowed`);
  }
  return unique;
}

export function matchesOriginEntry(origin: string, entry: string): boolean {
  const candidate = parse(origin);
  const pattern = parse(entry);
  if (!candidate || !pattern) return false;
  if (candidate.scheme !== pattern.scheme || candidate.port !== pattern.port) return false;
  if (!pattern.host.startsWith('*.')) return candidate.host === pattern.host;
  const suffix = pattern.host.slice(1);
  return candidate.host.length > suffix.length && candidate.host.endsWith(suffix);
}

// The origins allowed to use the app: the ones APP_URL names (the first is the
// canonical one) plus the extra ones the instance owner saved in god mode.
export function createOriginPolicy(envOrigins: string[]) {
  let extra: string[] = [];
  let loadedAt = 0;
  let loading: Promise<void> | null = null;

  async function load(): Promise<void> {
    const stored = await getSetting<string[]>(ALLOWED_ORIGINS_SETTING_KEY);
    extra = Array.isArray(stored) ? stored.filter((e) => typeof e === 'string') : [];
    loadedAt = Date.now();
  }

  return {
    envOrigins,
    async refresh(): Promise<void> {
      if (Date.now() - loadedAt < CACHE_TTL_MS) return;
      loading ??= load().finally(() => {
        loading = null;
      });
      await loading;
    },
    async extraOrigins(): Promise<string[]> {
      await this.refresh();
      return extra;
    },
    async list(): Promise<string[]> {
      return [...envOrigins, ...(await this.extraOrigins())];
    },
    isAllowed(origin: string): boolean {
      return (
        envOrigins.includes(origin) || extra.some((entry) => matchesOriginEntry(origin, entry))
      );
    },
    async save(entries: string[]): Promise<string[]> {
      const normalized = normalizeOriginEntries(entries);
      await setSetting(ALLOWED_ORIGINS_SETTING_KEY, normalized);
      extra = normalized;
      loadedAt = Date.now();
      return normalized;
    },
    invalidate(): void {
      loadedAt = 0;
    },
  };
}

export type OriginPolicy = ReturnType<typeof createOriginPolicy>;
