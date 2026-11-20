import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

function getUserClient(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return null;
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  }) as SupabaseClient<any>;
  return { supabase, token };
}

async function extractAndSaveMemories(
  provider: Provider,
  supabase: SupabaseClient<any>,
  userId: string,
  messages: ChatMessage[],
  reply: string
) {
  try {
    const recent = messages.slice(-10).map((m) => `${m.role}: ${m.content}`).join("\n");
    const base = provider.baseUrl.replace(/\/+$/, "");
    const endpoint = base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0,
        messages: [
          { role: "system", content: "You are a careful memory curator. Extract at most 3 concise, useful, durable facts explicitly stated by the user that would improve future assistance (stable preferences, ongoing projects, goals, recurring constraints). Do not infer facts. Never save passwords, API keys, tokens, financial identifiers, sensitive personal data, one-time tasks, temporary states, or facts only stated by the assistant. If nothing qualifies, return an empty array. Return ONLY valid JSON in this shape: {\"memories\":[\"fact\"]}. Each item must be under 300 characters." },
          { role: "user", content: `Conversation:\n${recent}\n\nAssistant reply:\n${reply}\n\nReturn candidate memories.` }
        ]
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return;
    const result = await response.json();
    const raw = result?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return;
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    const candidates: string[] = Array.isArray(parsed.memories) ? parsed.memories : [];
    const { data: existing } = await supabase.from("memories").select("content")
      .eq("user_id", userId).order("updated_at", { ascending: false }).limit(40);
    const known = new Set((existing || []).map((row) => String(row.content).trim().toLowerCase()));
    const fresh = [...new Set(candidates.map((item) => item.trim()).filter((item) =>
      item.length > 0 && item.length <= 300 && !known.has(item.toLowerCase())
    ))].slice(0, 3);
    if (fresh.length) {
      await supabase.from("memories").insert(fresh.map((content) => ({ user_id: userId, content })));
    }
  } catch {
    // Memory extraction is best-effort; it must never interrupt a successful chat reply.
  }
}

export async function POST(request: NextRequest) {
  let body: { messages?: ChatMessage[]; autoMemory?: boolean };
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

  const auth = getUserClient(request);
  let userId: string | null = null;
  if (auth) {
    const { data: { user }, error } = await auth.supabase.auth.getUser(auth.token);
    if (!error && user) userId = user.id;
  }
  let memories: string[] = [];
  if (auth && userId) {
    const { data } = await auth.supabase.from("memories").select("content")
      .eq("user_id", userId).order("updated_at", { ascending: false }).limit(40);
    memories = (data || []).map((row) => row.content as string);
  }
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
      if (typeof reply === "string" && reply.trim()) {
        if (body.autoMemory !== false && auth && userId) {
          await extractAndSaveMemories(provider, auth.supabase, userId, messages, reply);
        }
        return NextResponse.json({ reply, model: provider.model });
      }
    } catch { /* Try the next configured provider. */ }
  }
  return NextResponse.json({ error: "All configured AI providers are unavailable right now. Check their settings or try again." }, { status: 502 });
}
