import { readSecret } from '../secrets';

// The instance's Microsoft 365 app registration (Entra ID), stored encrypted in
// app_secret under 'instance.microsoft365' and set in god mode. The mail provider, the
// SharePoint storage backend and the team Microsoft 365 agent credentials can use it
// instead of an app registration of their own. Only the processes that call Microsoft
// read it; a team manager never sees the secret.

export const MICROSOFT365_SECRET_KEY = 'instance.microsoft365';

export interface InstanceMicrosoft365 {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export async function getStoredInstanceMicrosoft365(): Promise<InstanceMicrosoft365 | null> {
  return readSecret<InstanceMicrosoft365>(MICROSOFT365_SECRET_KEY);
}

// The app when it is complete, otherwise null.
export async function getInstanceMicrosoft365(): Promise<InstanceMicrosoft365 | null> {
  const stored = await getStoredInstanceMicrosoft365();
  return stored?.tenantId && stored.clientId && stored.clientSecret ? stored : null;
}
