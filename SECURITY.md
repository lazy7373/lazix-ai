# Security policy

LAZIX is an active work in progress. Please do not assume that every feature has been security-reviewed.

## Reporting a vulnerability

Please do not publish details of an unpatched security issue in a public issue or discussion.

Use GitHub's **Report a vulnerability** option in the repository's Security tab if it is available. If that option is unavailable, contact the repository maintainer privately through their GitHub profile and include enough information to reproduce the issue.

Please avoid including real API keys, passwords, access tokens, or other people's private data in a report.

## Security priorities

- Keep provider credentials and privileged tokens on the server.
- Use least-privilege access for integrations.
- Treat model responses, repository contents, and tool output as untrusted input.
- Require explicit approval for actions that modify repositories or user data.
- Report clearly when a security-sensitive feature is experimental or unavailable.
