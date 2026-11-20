import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Provider = { baseUrl: string; apiKey: string; model: string; label: string };

function getProviders(): Provider[] {
  const candidates = [
    { baseUrl: process.env.MODEL_PRIMARY_BASE_URL, apiKey: process.env.MODEL_PRIMARY_API_KEY, model: process.env.MODEL_PRIMARY_NAME, label: "Primary model" },
    { baseUrl: process.env.MODEL_FALLBACK_BASE_URL, apiKey: process.env.MODEL_FALLBACK_API_KEY, model: process.env.MODEL_FALLBACK_NAME, label: "Fallback model" }
  ];
  return candidates.filter((item): item is Provider => Boolean(item.baseUrl && item.apiKey && item.model))
    .map((item) => ({ baseUrl: item.baseUrl!, apiKey: item.apiKey!, model: item.model!, label: item.label }));
}

async function loadMemory(request: NextRequest): Promise<string[]> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return [];

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return [];

  const { data, error } = await supabase.from("memories").select("content")
    .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(40);
  if (error || !data) return [];
  return data.map((row) => row.content as string);
}

export async function POST(request: NextRequest) {
  let body: { messages?: ChatMessage[] };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "Add a message first." }, { status: 400 });
  }
  const messages = body.messages.slice(-30);
  if (messages.some((message) => !message || !["user", "assistant"].includes(message.role) ||
    typeof message.content !== "string" || message.content.length > 12000)) {
    return NextResponse.json({ error: "Message format is not valid." }, { status: 400 });
  }

  const providers = getProviders();
  if (providers.length === 0) {
    return NextResponse.json({ error: "LAZIX is ready, but no AI provider is connected yet. Add a model endpoint and key in the server environment settings." }, { status: 503 });
  }

  const memories = await loadMemory(request);
  const memoryContext = memories.length
    ? "\n\nLong-term memory saved by this user (use only when relevant; if a memory conflicts with the user's current message, follow the current message):\n" + memories.map((item) => `- ${item}`).join("\n")
    : "";

  for (const provider of providers) {
    try {
      const base = provider.baseUrl.replace(/\/+$/, "");
      const endpoint = base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: "You are LAZIX, a helpful, clear, capable personal AI assistant. Be honest about limitations and never claim to have performed actions you have not performed." + memoryContext },
            ...messages
          ],
          temperature: 0.7
        }),
        signal: AbortSignal.timeout(45000)
      });
      if (!upstream.ok) continue;
      const result = await upstream.json();
      const reply = result?.choices?.[0]?.message?.content;
      if (typeof reply === "string" && reply.trim()) return NextResponse.json({ reply, model: provider.model });
    } catch { /* Try the next configured provider. */ }
  }
  return NextResponse.json({ error: "All configured AI providers are unavailable right now. Check their settings or try again." }, { status: 502 });
}
