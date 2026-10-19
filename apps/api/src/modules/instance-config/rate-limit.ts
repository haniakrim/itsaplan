import { HttpError } from '#shared/lib';

export const INTEGRATION_CHECKS_PER_WINDOW = 10;
const WINDOW_MS = 10 * 60 * 1000;

// Per process: with several api replicas each one counts on its own.
const calls = new Map<string, number[]>();

export function takeIntegrationCheck(userId: string, now = Date.now()): void {
  const recent = (calls.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= INTEGRATION_CHECKS_PER_WINDOW) {
    calls.set(userId, recent);
    throw new HttpError(
      429,
      `Integration checks are limited to ${INTEGRATION_CHECKS_PER_WINDOW} runs per 10 minutes. Try again later.`,
    );
  }
  recent.push(now);
  calls.set(userId, recent);
}

export function resetIntegrationCheckLimit(): void {
  calls.clear();
}
