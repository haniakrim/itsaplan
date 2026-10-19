import {
  hasEmailProvider,
  type EmailConfig,
  type ResendConfig,
  type SmtpConfig,
} from '@repo/mailer';
import { readSecret } from '../secrets';
import { getInstanceMicrosoft365 } from './instance-microsoft365';

// The instance mail provider, stored encrypted in app_secret under 'auth.email'.
// Three processes read it: @repo/auth (authentication mail), the api (the invite
// email, and whether email features are offered at all), and the worker (a team that
// sends its notifications through the instance provider). God mode in the api owns
// the write, so a field added here has to be set there too.

export const INSTANCE_EMAIL_SECRET_KEY = 'auth.email';

// The stored, decrypted config. Secret fields carry the plaintext value; read only
// by the senders, never returned over HTTP.
export interface InstanceEmailConfig extends EmailConfig {
  smtp: SmtpConfig;
  resend: ResendConfig;
  from: string;
  // Let projects send their notifications through this provider instead of
  // configuring one of their own. Off by default: the instance owner pays for the
  // provider, so sharing it is an explicit decision.
  allowProjects: boolean;
}

export function defaultInstanceEmailConfig(): InstanceEmailConfig {
  return {
    smtp: {
      enabled: false,
      host: '',
      port: null,
      encryption: 'none',
      username: '',
      password: '',
      timeout: null,
    },
    resend: { enabled: false, apiKey: '' },
    from: '',
    allowProjects: false,
  };
}

// The config as saved, or null when nothing has been saved. God mode edits this one: a
// provider that uses the instance Microsoft 365 app holds no credentials of its own.
export async function getStoredInstanceEmailConfig(): Promise<InstanceEmailConfig | null> {
  const stored = await readSecret<InstanceEmailConfig>(INSTANCE_EMAIL_SECRET_KEY);
  if (!stored) return null;
  // Merge over the default so a config written before a field was added stays valid.
  return { ...defaultInstanceEmailConfig(), ...stored };
}

// The config with the instance Microsoft 365 app filled in where the provider is set to
// use it.
export async function withInstanceMicrosoftApp(
  config: InstanceEmailConfig,
): Promise<InstanceEmailConfig> {
  if (!config.smtp.oauth?.useInstanceApp) return config;
  const app = await getInstanceMicrosoft365();
  return {
    ...config,
    smtp: {
      ...config.smtp,
      oauth: { ...config.smtp.oauth, tenantId: '', clientId: '', clientSecret: '', ...app },
    },
  };
}

// The config a sender uses.
export async function getInstanceEmailConfig(): Promise<InstanceEmailConfig | null> {
  const config = await getStoredInstanceEmailConfig();
  return config ? withInstanceMicrosoftApp(config) : null;
}

// Whether outbound mail can be sent right now. Everything that mails the user
// (password reset, address confirmation, sign-in links) is unavailable without it,
// so both the god settings and the public sign-in screens ask this first.
export async function hasConfiguredEmailProvider(): Promise<boolean> {
  const config = await getInstanceEmailConfig();
  return config ? hasEmailProvider(config) : false;
}

// The instance provider a project may send its notifications through, or null when
// projects are not allowed to use it or it is not configured.
export async function getProjectEmailConfig(): Promise<InstanceEmailConfig | null> {
  const config = await getInstanceEmailConfig();
  if (!config || !config.allowProjects) return null;
  return hasEmailProvider(config) ? config : null;
}
