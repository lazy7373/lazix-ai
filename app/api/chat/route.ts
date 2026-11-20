import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Provider = { baseUrl: string; apiKey: string; model: string; label: string };

function getProviders(): Provider[] {
  const candidates = [
    {
      baseUrl: process.env.MODEL_PRIMARY_BASE_URL,
      apiKey: process.env.MODEL_PRIMARY_API_KEY,
      model: process.env.MODEL_PRIMARY_NAME,
      label: "Primary model"
    },
    {
      baseUrl: process.env.MODEL_FALLBACK_BASE_URL,
      apiKey: process.env.MODEL_FALLBACK_API_KEY,
      model: process.env.MODEL_FALLBACK_NAME,
      label: "Fallback model"
    }
  ];

  return candidates.filter(
    (item): item is Provider =>
      Boolean(item.baseUrl && item.apiKey && item.model)
  ).map((item) => ({
    baseUrl: item.baseUrl!,
    apiKey: item.apiKey!,
    model: item.model!,
    label: item.label
  }));
}

export async function POST(request: NextRequest) {
  let body: { messages?: ChatMessage[] };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "Add a message first." }, { status: 400 });
  }

  const messages = body.messages.slice(-30);
  if (messages.some((message) =>
    !message || !["user", "assistant"].includes(message.role) ||
    typeof message.content !== "string" || message.content.length > 12000
  )) {
    return NextResponse.json({ error: "Message format is not valid." }, { status: 400 });
  }

  const providers = getProviders();
  if (providers.length === 0) {
    return NextResponse.json({
      error: "LAZIX is ready, but no AI provider is connected yet. Add a model endpoint and key in the server environment settings."
    }, { status: 503 });
  }

  for (const provider of providers) {
    try {
      const base = provider.baseUrl.replace(/\/+$/, "");
      const endpoint = base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: "You are LAZIX, a helpful, clear, capable personal AI assistant. Be honest about limitations and never claim to have performed actions you have not performed." },
            ...messages
          ],
          temperature: 0.7
        }),
        signal: AbortSignal.timeout(45000)
      });

      if (!upstream.ok) continue;
      const result = await upstream.json();
      const reply = result?.choices?.[0]?.message?.content;
      if (typeof reply === "string" && reply.trim()) {
        return NextResponse.json({ reply, model: provider.model });
      }
    } catch {
      // Try the next configured provider.
    }
  }

  return NextResponse.json({
    error: "All configured AI providers are unavailable right now. Check their settings or try again."
  }, { status: 502 });
}