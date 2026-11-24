# LAZIX

**Think less. Achieve more.**

LAZIX is an independent, text-first personal AI workspace designed for Android tablets and phones. It is being rebuilt in small, testable phases.

## Current foundation

- Responsive ChatGPT-style chat workspace with recent conversations.
- Streaming responses, Markdown, stop-generation control, and live tool status.
- Browser-local conversation history for guests; private Supabase cloud sync for signed-in users.
- Persistent user memory shared across configured models.
- Multi-provider routing, model picker, free OpenRouter model discovery, and automatic fallback.
- Bounded tool-calling agent with calculator, date/time, memory search, optional web search, and owner-only read-only GitHub file access.
- Server-side API keys; keys are never sent to the browser.
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

For a fresh Supabase project, run the SQL files in `supabase/migrations/` in filename order. Existing LAZIX projects should run `202611200002_create_conversations.sql` once to enable cloud conversation history.

When Supabase is configured, chat requires sign-in and has a lightweight per-user rate limit to protect the shared provider quota.

## Model configuration

The server supports multiple OpenAI-compatible providers. For the simple setup, set:

- `MODEL_PRIMARY_BASE_URL`
- `MODEL_PRIMARY_API_KEY`
- `MODEL_PRIMARY_NAME`

Optionally add the equivalent `MODEL_FALLBACK_*` variables.

When the primary base URL is OpenRouter, LAZIX discovers currently free, tool-compatible text models and adds them to the in-app model picker. The catalog is cached for five minutes. The same OpenRouter key is reused for each model; no separate key is needed per model. Availability can change.

For custom provider/model lists, set `MODEL_PROVIDERS_JSON` to a JSON array. Each entry has an `id`, `label`, `baseUrl`, `apiKey`, and `model`. Example:

```json
[
  {
    "id": "openrouter-free",
    "label": "OpenRouter Free",
    "baseUrl": "https://openrouter.ai/api/v1",
    "apiKey": "YOUR_OPENROUTER_KEY",
    "model": "openrouter/free"
  },
  {
    "id": "groq-fast",
    "label": "Groq",
    "baseUrl": "https://api.groq.com/openai/v1",
    "apiKey": "YOUR_GROQ_KEY",
    "model": "YOUR_GROQ_MODEL"
  }
]
```

When `MODEL_PROVIDERS_JSON` is set, it takes precedence over the legacy primary/fallback variables. The selected model is tried first; other configured providers are automatic fallbacks. API keys remain server-side.

Free provider plans have usage limits and availability constraints. LAZIX does not promise unlimited free inference.

## Optional agent integrations

- `TAVILY_API_KEY`: enables the `web_search` tool for current web research and source URLs.
- `GITHUB_TOKEN` plus `LAZIX_OWNER_USER_ID`: enables read-only file access for the configured LAZIX owner only. Use a fine-grained token with **Contents: Read-only** and only the repositories LAZIX needs. Set the owner ID to the signed-in Supabase user's UUID. Never expose this token in client-side code.

The agent exposes only integrations whose server-side credentials are configured. GitHub write access is not enabled yet; repository edits need an explicit approval and reviewable-branch workflow.

## Roadmap

1. **Foundation:** streaming chat, secure provider adapters, cloud conversations, durable memory, and model selection.
2. **Research:** deeper multi-hop research, better source handling, and citations.
3. **Coding agent:** repository analysis, proposed diffs, approval, branch creation, and tests.
4. **Agent workflows:** task planning, safe execution, and scheduled automation.
5. **Installability:** complete PWA support and explore Android packaging.

## Safety principles

- Secrets stay in server-side environment variables.
- Tool outputs are untrusted data, not instructions.
- Tool execution is bounded and permission-based.
- Coding tasks should use reviewable branches and reversible changes.
- LAZIX must report honestly what it did and did not do.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for the local development and pull request process. GitHub Actions runs linting and a production build on pushes and pull requests to `main`.

See [SECURITY.md](SECURITY.md) for how to report a security issue, and [docs/deployment.md](docs/deployment.md) for deployment notes.

## License

LAZIX is released under the MIT License. See [LICENSE](LICENSE) for details.

## Project status

Active rebuild. The core streaming assistant, provider routing, memory, cloud conversation sync, and optional read-only integrations are being implemented and tested. It is not yet a complete autonomous assistant.
