# LAZIX

**Think less. Achieve more.**

LAZIX is an independent, text-first personal AI workspace designed for Android tablets and phones. It is being built in small, testable phases.

## Current foundation

- Responsive web chat interface.
- Chat history saved in the current browser using local storage.
- Server-side model connection; API keys are never sent to the browser.
- Primary and optional fallback routing for OpenAI-compatible chat-completions APIs.
- Installable-web-app manifest foundation.
- No voice features and no dependency on OmniRoute.

## Run locally

Requirements: Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

To enable AI replies, fill the model environment variables in `.env.local`. Keep real API keys private and never commit them.

## Model configuration

The server supports a primary and optional fallback provider that implements the OpenAI-compatible `/v1/chat/completions` API. Set:

- `MODEL_PRIMARY_BASE_URL`
- `MODEL_PRIMARY_API_KEY`
- `MODEL_PRIMARY_NAME`

Optionally set the equivalent `MODEL_FALLBACK_*` variables. LAZIX tries the primary first, then the fallback if the request fails.

Free provider plans may have usage limits and may require account/API keys. LAZIX does not promise unlimited free inference.

## Roadmap

1. **Foundation:** chat UI, secure model adapter, browser-local chat history.
2. **Memory and routing:** durable user-controlled memory, provider health checks, model selection and smarter failover.
3. **Tools:** web research, file workflows and a permission-based coding agent.
4. **Installability:** complete PWA support and explore Android packaging.

## Safety principles

- Secrets stay in server-side environment variables.
- Tool execution must be permission-based and sandboxed.
- Coding tasks should use reviewable branches and reversible changes.
- LAZIX must report honestly what it did and did not do.

## Project status

Early foundation — not yet a complete autonomous assistant.
