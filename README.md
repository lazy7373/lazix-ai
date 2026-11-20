# LAZIX — Your Own AI

LAZIX is a clean, text-only AI chat app designed to run entirely on a cloud machine you control. The web app and the language model run together in Docker. LAZIX does not send prompts to OpenAI, Anthropic, Gemini, Groq, OpenRouter, or another hosted AI inference provider.

## Architecture

```text
Your browser
    │ HTTPS / web
    ▼
LAZIX web app (Next.js)
    │ private Docker network
    ▼
LAZIX model server (vLLM)
    │
    ▼
Open-weight language model running on your GPU
```

The model server is not exposed as a public port. Only the LAZIX website is published. The browser never receives the model-server token.

vLLM is an inference runtime, not an AI assistant framework. LAZIX does not use LangChain, CrewAI, AutoGPT, provider SDKs, plugin systems, or an external AI API.

## Deploy the complete stack on your cloud GPU machine

You need a Linux cloud machine with an NVIDIA GPU, Docker Engine, Docker Compose, and NVIDIA Container Toolkit. Around 16 GB of GPU memory is a practical starting point for the configured 4B model; exact needs vary with precision, context length, and concurrent requests.

1. Create a cloud GPU machine with a public IP.
2. Install Docker Engine and NVIDIA Container Toolkit.
3. Clone this repository onto that machine.
4. Copy `.env.example` to `.env`.
5. Edit `.env` and set two different long random secrets:
   - `LAZIX_INFERENCE_TOKEN`
   - `LAZIX_ACCESS_PASSWORD`
6. Start LAZIX:

```bash
docker compose up -d --build
```

7. Open `http://YOUR_SERVER_IP:3000`. Your browser will ask for the LAZIX username and password configured in `.env`.

The first launch downloads the model weights from Hugging Face and may take several minutes. After that, prompts are processed by the model running on your own GPU server. No third-party AI inference API is involved.

### Network security

- Keep GPU inference port 8000 private; Docker exposes it only inside the app's private network.
- Expose website port 3000 only through a firewall. For a public production URL, put HTTPS in front of it using your cloud provider's TLS proxy or a reverse proxy.
- Never commit `.env` or share either secret.
- The website is protected by Basic Authentication. Use a long unique password.

## Run the web app locally

Requirements: Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

For local development, point `LAZIX_INFERENCE_URL` to your locally running vLLM server and set `LAZIX_INFERENCE_TOKEN` to the same token used by that server. Production Docker Compose configures the private container connection automatically.

## Current scope

- Original responsive LAZIX chat UI.
- Streaming text conversations.
- Browser-local conversation persistence.
- Stop-generation control.
- Self-hosted open-weight language model.
- One private GPU inference service.
- No hosted AI provider API keys, model picker, plugins, database, account system, or assistant frameworks.

## About "unlimited" usage and owning the model

LAZIX does not impose a fixed message count or conversation count. Actual capacity is still limited by GPU memory, processing speed, server uptime, network bandwidth, and cloud-provider billing. This project runs an existing open-weight foundation model on hardware you control; it does not claim that we trained a new foundation model from scratch. Training a competitive model from scratch would require a separate large-scale dataset and compute project.
