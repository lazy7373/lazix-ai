# LAZIX roadmap

This roadmap describes the direction of the project. It is a plan, not a promise that every item is already implemented. Priorities may change as the project is tested.

## Current foundation

The existing codebase includes a text-first chat interface, streaming model responses, provider routing, conversation and memory features, and optional integrations. Check the main README for setup details and the current implementation notes.

## Planned work

### 1. Make the foundation reliable
- Keep local development and production builds reproducible.
- Improve error handling for provider failures, timeouts, and rate limits.
- Add tests around core server-side logic.
- Document environment variables and deployment.

### 2. Improve the chat experience
- Refine conversation history and search.
- Improve model selection and provider fallback visibility.
- Make the interface work well on phones and Android tablets.
- Finish installable PWA support.

### 3. Build safer GitHub coding workflows
- Improve repository browsing and code context collection.
- Generate proposed changes as reviewable diffs.
- Require approval before writing to a repository.
- Use separate branches for changes and run relevant checks before presenting them.

### 4. Expand agent capabilities
- Improve task planning and progress reporting.
- Add bounded tool execution with clear permissions.
- Improve recovery from failed steps.
- Keep a useful record of actions and results.

### 5. Prepare for wider use
- Improve documentation for contributors.
- Add automated checks and release notes.
- Review performance, privacy, and security before inviting broader use.

## Project principles

- Keep the core experience text-first and lightweight.
- Keep secrets on the server.
- Treat repository content and tool output as untrusted input.
- Ask before taking actions that change a user's files or repositories.
- Be clear about what works, what failed, and what is still planned.
