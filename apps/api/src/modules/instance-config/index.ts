import { Elysia, t } from 'elysia';
import { authContext } from '#shared/auth-context';
import { requireGod } from '#shared/access';
import { noContent } from '#shared/http';
import { errors } from '#shared/responses';
import {
  AllowedOriginsBody,
  AllowedOriginsResponse,
  ChecksResponse,
  FileStorageSettingsBody,
  FileStorageSettingsResponse,
  FileStorageTestResponse,
  Microsoft365ChecksBody,
  Microsoft365SettingsBody,
  Microsoft365SettingsResponse,
  Microsoft365TestResponse,
  ProcoreChecksBody,
  ProcoreChecksSettingsResponse,
  SharePointChecksBody,
} from './model';
import { getMicrosoft365Settings, setMicrosoft365Settings, testMicrosoft365 } from './microsoft365';
import { getFileStorageSettings, setFileStorageSettings, testFileStorage } from './file-storage';
import {
  forgetProcoreChecks,
  getProcoreChecksSettings,
  runMicrosoft365Checks,
  runProcoreChecks,
  runSharePointChecks,
} from './integration-checks';
import { takeIntegrationCheck } from './rate-limit';
import { getAllowedOrigins, setAllowedOrigins } from './service';

// God mode settings that used to be environment variables: the file storage backend, the
// instance Microsoft 365 app, the live integration checks and the extra origins allowed to
// use the app. Owner-only, like the rest of /god. Secrets are never returned.
export const instanceConfigRoutes = new Elysia({
  name: 'instance-config',
  detail: { tags: ['God'] },
})
  .use(authContext)
  .onBeforeHandle(({ user }) => {
    requireGod(user);
  })

  .get('/god/microsoft365', () => getMicrosoft365Settings(), {
    response: { 200: Microsoft365SettingsResponse, ...errors(401, 403) },
    detail: {
      summary: 'Get the instance Microsoft 365 app',
      description:
        'The app registration the mail provider, SharePoint storage and agent tools can share (secret redacted).',
    },
  })

  .put('/god/microsoft365', ({ body }) => setMicrosoft365Settings(body), {
    body: Microsoft365SettingsBody,
    response: { 200: Microsoft365SettingsResponse, ...errors(400, 401, 403) },
    detail: {
      summary: 'Update the instance Microsoft 365 app',
      description:
        'Set the tenant, client ID and client secret. An omitted secret keeps the stored one.',
    },
  })

  .post('/god/microsoft365/test', ({ body }) => testMicrosoft365(body), {
    body: Microsoft365SettingsBody,
    response: { 200: Microsoft365TestResponse, ...errors(400, 401, 403) },
    detail: {
      summary: 'Test the instance Microsoft 365 app',
      description: 'Request a Microsoft Graph token with the supplied values without saving them.',
    },
  })

  .get('/god/file-storage', () => getFileStorageSettings(), {
    response: { 200: FileStorageSettingsResponse, ...errors(401, 403) },
    detail: {
      summary: 'Get the file storage settings',
      description:
        'The storage backend and where each value comes from, the database or the environment (secrets redacted).',
    },
  })

  .put('/god/file-storage', ({ body }) => setFileStorageSettings(body), {
    body: FileStorageSettingsBody,
    response: { 200: FileStorageSettingsResponse, ...errors(400, 401, 403) },
    detail: {
      summary: 'Update the file storage settings',
      description:
        'Save the backend and its credentials. A null value goes back to the environment. Existing files are not moved.',
    },
  })

  .post('/god/file-storage/test', ({ body }) => testFileStorage(body ?? {}), {
    body: FileStorageSettingsBody,
    response: { 200: FileStorageTestResponse, ...errors(400, 401, 403) },
    detail: {
      summary: 'Test the file storage connection',
      description:
        'Put, get and delete a small object with the supplied settings over the saved ones, without saving.',
    },
  })

  .get('/god/integration-checks/procore', () => getProcoreChecksSettings(), {
    response: { 200: ProcoreChecksSettingsResponse, ...errors(401, 403) },
    detail: {
      summary: 'Get the remembered Procore check credentials',
      description: 'Whether credentials are remembered for the Procore check, without the secret.',
    },
  })

  .delete(
    '/god/integration-checks/procore',
    async () => {
      await forgetProcoreChecks();
      return noContent();
    },
    {
      response: { 204: t.Void(), ...errors(401, 403) },
      detail: {
        summary: 'Forget the Procore check credentials',
        description: 'Delete the remembered credentials.',
      },
    },
  )

  .post(
    '/god/integration-checks/procore',
    ({ user, body }) => {
      takeIntegrationCheck(requireGod(user).id);
      return runProcoreChecks(body);
    },
    {
      body: ProcoreChecksBody,
      response: { 200: ChecksResponse, ...errors(400, 401, 403, 429) },
      detail: {
        summary: 'Run the Procore live check',
        description: 'Read-only check of the Procore import against a real company.',
      },
    },
  )

  .post(
    '/god/integration-checks/sharepoint',
    ({ user }) => {
      takeIntegrationCheck(requireGod(user).id);
      return runSharePointChecks();
    },
    {
      body: SharePointChecksBody,
      response: { 200: ChecksResponse, ...errors(400, 401, 403, 429) },
      detail: {
        summary: 'Run the SharePoint storage live check',
        description:
          'Write, read back and delete test files in the configured SharePoint library or OneDrive.',
      },
    },
  )

  .post(
    '/god/integration-checks/microsoft365',
    ({ user, body }) => {
      takeIntegrationCheck(requireGod(user).id);
      return runMicrosoft365Checks(body);
    },
    {
      body: Microsoft365ChecksBody,
      response: { 200: ChecksResponse, ...errors(400, 401, 403, 429) },
      detail: {
        summary: 'Run the Microsoft 365 tools live check',
        description:
          'Call the Microsoft 365 agent tools with the instance app. Writes a file only when asked.',
      },
    },
  )

  .get('/god/allowed-origins', () => getAllowedOrigins(), {
    response: { 200: AllowedOriginsResponse, ...errors(401, 403) },
    detail: {
      summary: 'Get the allowed sign-in origins',
      description: 'The origins from APP_URL and the extra ones saved in god mode.',
    },
  })

  .put('/god/allowed-origins', ({ body }) => setAllowedOrigins(body.origins), {
    body: AllowedOriginsBody,
    response: { 200: AllowedOriginsResponse, ...errors(400, 401, 403) },
    detail: {
      summary: 'Update the allowed sign-in origins',
      description:
        'Replace the extra origins allowed to use the app. A wildcard is allowed as the leftmost host label only.',
    },
  });
