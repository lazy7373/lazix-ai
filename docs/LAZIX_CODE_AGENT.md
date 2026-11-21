# LAZIX CODE agent — first integration slice

This is a native LAZIX implementation inspired by the useful architectural ideas in OpenCode and OpenHands. It does not vendor or copy either project's source code.

## Current capability

The owner-only `POST /api/agent/code` endpoint supports two actions:

1. `propose`: read one text file from a GitHub repository and ask the selected configured model for a complete replacement. The response includes the original file SHA (`baseSha`) and whether the file existed.
2. `apply`: after the user reviews the proposal, submit the exact proposed content with `approved: true`. LAZIX checks that the target has not changed since the proposal, creates a new `lazix/...` branch from the repository default branch, and commits only that file.

The default branch is never modified directly and no merge is performed.

## Required server configuration

- `GITHUB_TOKEN`: fine-grained token restricted to the intended repositories. Contents read permission is needed for proposals; Contents read/write is needed to apply an approved proposal. Metadata read is normally included.
- `LAZIX_OWNER_USER_ID`: UUID of the only Supabase user allowed to call this endpoint.
- Supabase URL and anon/publishable key.
- At least one configured model provider.

Keep all tokens in server environment settings. Never place them in browser code or commit real credentials.

## Request: propose

Send the signed-in user's Supabase access token in the Authorization header.

```json
{
  "action": "propose",
  "repository": "owner/repository",
  "path": "src/example.ts",
  "task": "Add input validation and preserve existing behavior",
  "modelId": "optional-server-registered-model-id"
}
```

The response contains `summary`, `content`, `baseSha`, and `fileExists`. Display the full proposed content or a diff to the user and require an explicit approval action.

## Request: apply

Only send this after the user has reviewed and approved the exact proposal. Preserve the proposal's `baseSha` and `fileExists` values.

```json
{
  "action": "apply",
  "approved": true,
  "repository": "owner/repository",
  "path": "src/example.ts",
  "content": "complete approved file contents",
  "summary": "Add input validation",
  "baseSha": "original-file-blob-sha-or-null",
  "fileExists": true,
  "branchName": "lazix/add-input-validation"
}
```

For a new file, use `baseSha: null` and `fileExists: false`. The branch name must start with `lazix/` and use lowercase letters, numbers, and hyphens.

## Safety boundaries

- Supabase identity is checked server-side; browser-supplied user IDs are not trusted.
- The model receives one target file and can propose only that file.
- Repository contents are treated as untrusted data, not instructions.
- Apply requires an explicit approval boolean and checks the original blob SHA to reject stale proposals.
- Writes are limited to a new review branch; LAZIX does not merge it.
- The current review UI is available from the LAZIX sidebar. It does not execute repository code, shell commands, package scripts, or tests.

## Next engineering phases

1. Add repository tree browsing and multi-file change plans.
2. Add a dedicated review UI with unified diffs and explicit per-file approval.
3. Add a separate, disposable workspace runner for shell commands and tests. Do not execute untrusted code inside the Next.js web process.
4. Add job/event streaming, cancellation, timeouts, resource limits, and audit history.
5. Add reusable recon, architecture, build, test, and diff workflows (Replica-style skills) as versioned LAZIX instructions.

OpenHands' SDK/Agent Server is a possible future isolated execution backend; its SDK intentionally separates agent behavior, tools, workspaces, and remote execution. OpenCode/ACP can be considered as an optional external runtime adapter rather than copying their whole application into LAZIX.
