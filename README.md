# LAZIX — Your Own AI

LAZIX is a clean, text-only chat app that connects to a language model running on infrastructure you control. It does not call OpenAI, Anthropic, Gemini, Groq, OpenRouter, or any hosted AI inference API.

## Architecture

```text
Browser
  │
  ▼
LAZIX web app (Next.js)
  │ private server-to-server connection
  ▼
Your GPU machine (vLLM)
  │
  ▼
Open-weight language model files
```

The web app contains the chat UI and a small streaming bridge. The model performs inference on your GPU machine. vLLM is an inference runtime, not an AI assistant framework; LAZIX does not use LangChain, CrewAI, AutoGPT, or agent modules.

## 1. Start the private model server

You need a Linux machine with an NVIDIA GPU and a working NVIDIA Container Toolkit. A GPU with around 16 GB VRAM is a practical starting point for the configured 4B model, though exact requirements depend on model precision, context length, and concurrent usage.

On that machine:

1. Install Docker Engine and NVIDIA Container Toolkit.
2. Copy `inference/docker-compose.yml` from this repository.
3. Set a long random `LAZIX_INFERENCE_TOKEN` in the machine's environment.
4. Start it with `docker compose -f docker-compose.yml up -d`.
5. Keep port 8000 private. Do not expose it publicly without a firewall and access controls.

The first startup downloads the model weights from Hugging Face. Prompts and inference are then handled by your own GPU server; model inference is not sent to a third-party AI API.

## 2. Configure the web app

Set these environment variables in your Next.js hosting service:

- `LAZIX_INFERENCE_URL`: private or securely reachable base URL of your GPU server, without the `/v1` suffix.
- `LAZIX_MODEL`: must match the model served by vLLM.
- `LAZIX_INFERENCE_TOKEN`: the same secret configured on the GPU server.

Redeploy the web app after setting the variables.

## 3. Run the web app locally

Requirements: Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Current scope

- Original responsive LAZIX chat UI.
- Streaming text conversations.
- Local browser conversation persistence.
- Stop-generation control.
- One private, self-hosted model connection.
- No provider picker, hosted AI API keys, external assistant frameworks, database, account system, or plugin system.

## Limits and costs

LAZIX does not impose a fixed message count or conversation count. Real-world usage is still bounded by GPU memory, server uptime, throughput, hosting quotas, and operating cost. A self-hosted model is not automatically trained by us: this project runs open model weights on infrastructure we control. Training a new foundation model from scratch would require a separate large-scale data and compute project.

## Security

- Never commit inference tokens or other secrets.
- Keep the inference server's port private and restrict network access to the web app.
- Use HTTPS or a private network between the web app and GPU machine.
- Do not put inference credentials in browser code.
