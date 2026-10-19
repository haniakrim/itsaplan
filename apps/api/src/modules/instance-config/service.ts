import { OriginEntryError, originPolicy } from '@repo/auth';
import { HttpError } from '#shared/lib';

export async function getAllowedOrigins(): Promise<{ origins: string[]; envOrigins: string[] }> {
  originPolicy.invalidate();
  return { origins: await originPolicy.extraOrigins(), envOrigins: originPolicy.envOrigins };
}

export async function setAllowedOrigins(
  origins: string[],
): Promise<{ origins: string[]; envOrigins: string[] }> {
  try {
    return { origins: await originPolicy.save(origins), envOrigins: originPolicy.envOrigins };
  } catch (err) {
    if (err instanceof OriginEntryError) throw new HttpError(400, err.message);
    throw err;
  }
}
