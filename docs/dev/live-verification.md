# Live verification

Three integrations were built without a real account: the Procore import, the SharePoint /
OneDrive storage driver and the Microsoft 365 agent tools. The scripts in `scripts/verify/`
exercise each one against a real account. They are not part of `bun test` or CI. Without their
credentials they print `skipped: set X` and exit 0; with credentials they exit 1 on any failure.
Run them from the repo root; `bun --env-file=.env` loads the variables from `.env`.

The checks themselves live in `packages/live-checks`; the scripts call it. The instance owner
runs the same checks from god mode, **Integration checks**, without a shell: the page has a
card per integration and shows a table of `PASS`, `FAIL`, `MISSING-PERMISSION` and `SKIPPED`
rows with a message each. The routes are owner-only and limited to 10 runs per 10 minutes per
process.

| Card          | What it uses                                                                   |
| ------------- | ------------------------------------------------------------------------------ |
| Procore       | the credentials typed into the form (client ID, secret, company ID, sandbox, optional project ID). They are not kept unless **Remember** is ticked; then they are stored encrypted and **Forget** deletes them |
| SharePoint    | the SharePoint values of **File storage** (or the instance Microsoft 365 app); it writes and deletes test files under `itsaplan-verify/` |
| Microsoft 365 | the instance Microsoft 365 app and the mailbox or OneDrive user named in the form. It only reads, unless **write and read back a test file** is ticked, which runs `file_write` and `file_read` |

After a run, update the "Unverified" notes in the matching dev doc (see the last section).

## Procore (`pnpm verify:procore`)

Script: `scripts/verify/procore.ts`. Read-only. Uses the real `ProcoreReader` and
`procore-mapping.ts`, through `checkProcore` in `packages/live-checks`.

| Variable                | Meaning                                                  |
| ----------------------- | -------------------------------------------------------- |
| `PROCORE_CLIENT_ID`     | Developer Managed Service Account client id (required)   |
| `PROCORE_CLIENT_SECRET` | its secret (required)                                    |
| `PROCORE_COMPANY_ID`    | numeric company id (required)                            |
| `PROCORE_PROJECT_ID`    | project to read; default is the first project listed     |
| `PROCORE_SANDBOX`       | `1` to use the sandbox hosts                             |

It gets a token, lists the company's projects, then for punch items and RFIs reads the first
list page, the detail view of the first item, and `reader.listIssues` / `reader.getIssue`. It maps
one item of each and prints: item counts, pagination headers (`total`, `per-page`,
`X-Rate-Limit-Reset`), the status names seen, the fields the mapping reads that no sampled item
had, the fields present that the mapping ignores, and the same for nested `attachments`,
`questions`, `responses` and assignee objects. Run it against a project that has items with
attachments, RFI answers and assignees, or those fields will show as missing only because they
are empty.

Permissions: the service account needs read access to projects, punch items and RFIs in the
project (docs/dev/procore-import.md).

## SharePoint / OneDrive storage (`pnpm verify:sharepoint`)

Script: `scripts/verify/sharepoint-storage.ts`. Writes, then deletes, under
`itsaplan-verify/<timestamp>/` (inside `SHAREPOINT_ROOT_FOLDER` if set).

Variables, as the driver reads them: `SHAREPOINT_TENANT_ID`, `SHAREPOINT_CLIENT_ID`,
`SHAREPOINT_CLIENT_SECRET`, and `SHAREPOINT_SITE_ID` or `SHAREPOINT_DRIVE_ID`; optional
`SHAREPOINT_ROOT_FOLDER`. `STORAGE_DRIVER` is not needed.

It puts a 1 KiB object (simple upload) and a 5 MiB object (upload session, several chunks),
gets both back and compares bytes and content type, deletes both, deletes both again (a missing
object must not fail), and checks a get after delete fails.

Permissions: Microsoft Graph application permission `Files.ReadWrite.All` (or `Sites.Selected`
with write on the site), with admin consent.

## Microsoft 365 tools (`pnpm verify:m365`)

Script: `scripts/verify/microsoft365-tools.ts`. Calls the registered tools'
`execute`, with their input schemas, as the agent runtime does.

| Variable                                  | Meaning                                               |
| ----------------------------------------- | ----------------------------------------------------- |
| `MS365_TENANT_ID`, `MS365_CLIENT_ID`      | Entra ID app registration (required)                  |
| `MS365_CLIENT_SECRET`                     | its client secret (required)                          |
| `MS365_USER`                              | mailbox / OneDrive to act on, an email (required)     |
| `MS365_WRITE`                             | `1` to also run `file_write` and `file_read`          |

Read-only by default: `files_list`, `files_search`, `mail_search` (limit 1), `calendar_list`
(next 7 days), `teams_list`. With `MS365_WRITE=1` it writes `itsaplan-verify/<timestamp>/hello.txt`
and reads it back. The tools cannot delete, so remove the `itsaplan-verify` folder by hand.
`mail_send`, `calendar_create`, `teams_messages`, `file_read` by id, `mail_read` and
`sites_search` are not covered.

The output is a table, one row per tool: `PASS`, `FAIL`, `MISSING-PERMISSION` (a 403; the detail
names the permission to grant) or `SKIPPED`.

Permissions (application, with admin consent): `Files.Read.All` (`Files.ReadWrite.All` for
writes), `Mail.Read`, `Calendars.Read`, `Team.ReadBasic.All`. Use a mailbox that has mail and
events, or the counts will be zero.

## Recording the results

| Script       | Update                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------- |
| Procore      | the "Unverified" section of `docs/dev/procore-import.md`; fix `procore-mapping.ts` field names the run showed to be wrong |
| SharePoint   | the storage driver notes in the docs that describe `STORAGE_DRIVER=sharepoint`            |
| Microsoft 365 | the permission list in the tool descriptions and `docs` for the agent tools, if a tool needed a permission it does not list |

Remove a point from an "Unverified" list only when a run confirmed it, and say which account type
(sandbox or production) it was confirmed on.
