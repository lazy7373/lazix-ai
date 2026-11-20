# LAZIX

**Think less. Achieve more.**

LAZIX is an independent, text-first personal AI workspace designed for Android tablets and phones. It is being built in small, testable phases.

## Current foundation

- Responsive web chat interface.
- Chat history saved in the current browser using local storage.
- Server-side model connection; API keys are never sent to the browser.
- Multi-provider model routing with in-chat model selection and automatic fallback.
- Automatic memory extraction runs after the chat response, so it does not hold up the reply.
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

The server supports multiple OpenAI-compatible providers. For the existing simple setup, set `MODEL_PRIMARY_BASE_URL`, `MODEL_PRIMARY_API_KEY`, and `MODEL_PRIMARY_NAME`; optionally add the equivalent `MODEL_FALLBACK_*` variables.

For an in-app model picker with several providers, set `MODEL_PROVIDERS_JSON` to a JSON array. Each entry has an `id`, `label`, `baseUrl`, `apiKey`, and `model`. Example (replace the placeholder key and model names with real values):

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

When `MODEL_PROVIDERS_JSON` is set, it takes precedence over the legacy primary/fallback variables. The selected model is tried first; other configured providers are automatic fallbacks. API keys remain server-side and are never returned by the model-list endpoint.

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
