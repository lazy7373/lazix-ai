import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };
type Provider = { baseUrl: string; apiKey: string; model: string; label: string };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type AgentMessage = { role: string; content?: string | null; tool_calls?: ToolCall[]; tool_call_id?: string; name?: string };
type Completion = { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[] };
type Tool = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

function getProviders(): Provider[] {
  const candidates = [
    { baseUrl: process.env.MODEL_PRIMARY_BASE_URL, apiKey: process.env.MODEL_PRIMARY_API_KEY, model: process.env.MODEL_PRIMARY_NAME, label: "Primary model" },
    { baseUrl: process.env.MODEL_FALLBACK_BASE_URL, apiKey: process.env.MODEL_FALLBACK_API_KEY, model: process.env.MODEL_FALLBACK_NAME, label: "Fallback model" }
  ];
  return candidates.filter((p): p is Provider => Boolean(p.baseUrl && p.apiKey && p.model))
    .map((p) => ({ baseUrl: p.baseUrl!, apiKey: p.apiKey!, model: p.model!, label: p.label }));
}

function getUserClient(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return null;
  const supabase = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
  return { supabase, token };
}

// Safe arithmetic parser: intentionally avoids eval() and dynamic code execution.
function calculate(input: string): number {
  if (input.length > 160 || !/^[\d+\-*/().,%^\s]+$/.test(input)) throw new Error("Only basic arithmetic is supported.");
  const tokens = input.match(/\d+(?:\.\d+)?|[()+\-*/%^]/g) || [];
  if (tokens.join("").length !== input.replace(/\s/g, "").length) throw new Error("Invalid expression.");
  let i = 0;
  const peek = () => tokens[i];
  const take = () => tokens[i++];
  function atom(): number {
    if (peek() === "+") { take(); return atom(); }
    if (peek() === "-") { take(); return -atom(); }
    if (peek() === "(") { take(); const n = sum(); if (take() !== ")") throw new Error("Missing closing parenthesis."); return n; }
    const token = take();
    if (!token || !/^\d+(?:\.\d+)?$/.test(token)) throw new Error("Expected a number.");
    return Number(token);
  }
  function power(): number { const n = atom(); if (peek() === "^") { take(); return n ** power(); } return n; }
  function product(): number {
    let n = power();
    while (["*", "/", "%"].includes(peek() || "")) {
      const op = take(); const rhs = power();
      if ((op === "/" || op === "%") && rhs === 0) throw new Error("Cannot divide by zero.");
      n = op === "*" ? n * rhs : op === "/" ? n / rhs : n % rhs;
    }
    return n;
  }
  function sum(): number {
    let n = product();
    while (peek() === "+" || peek() === "-") { const op = take(); const rhs = product(); n = op === "+" ? n + rhs : n - rhs; }
    return n;
  }
  const result = sum();
  if (i !== tokens.length || !Number.isFinite(result)) throw new Error("Invalid or out-of-range expression.");
  return Number(result.toPrecision(12));
}

const tools: Tool[] = [
  { type: "function", function: { name: "calculator", description: "Calculate arithmetic accurately. Supports +, -, *, /, %, parentheses and powers (^).", parameters: { type: "object", properties: { expression: { type: "string" } }, required: ["expression"], additionalProperties: false } } },
  { type: "function", function: { name: "get_current_datetime", description: "Get the current date and time in UTC.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "search_memory", description: "Search the signed-in user's saved memories for relevant facts.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } } }
];

async function runTool(call: ToolCall, memories: string[]): Promise<string> {
  let args: Record<string, unknown>;
  try { args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>; }
  catch { return "Invalid tool arguments."; }
  try {
    if (call.function.name === "calculator") return typeof args.expression === "string" ? String(calculate(args.expression)) : "Expression must be text.";
    if (call.function.name === "get_current_datetime") return new Date().toISOString();
    if (call.function.name === "search_memory") {
      const query = typeof args.query === "string" ? args.query.toLowerCase().trim() : "";
      const words = query.split(/\s+/).filter((word) => word.length > 2);
      const matches = memories.map((content) => ({ content, score: words.filter((word) => content.toLowerCase().includes(word)).length }))
        .filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
      return matches.length ? matches.map((item) => item.content).join("\n") : "No matching saved memories.";
    }
    return "Tool unavailable.";
  } catch (error) { return error instanceof Error ? error.message : "Tool failed."; }
}

async function askProvider(provider: Provider, messages: AgentMessage[], withTools: boolean): Promise<Completion> {
  const base = provider.baseUrl.replace(/\/+$/, "");
  const endpoint = base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
  const payload: Record<string, unknown> = { model: provider.model, messages, temperature: 0.65 };
  if (withTools) { payload.tools = tools; payload.tool_choice = "auto"; }
  const response = await fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(45000)
  });
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  return await response.json() as Completion;
}

async function extractAndSaveMemories(provider: Provider, supabase: SupabaseClient<Database>, userId: string, messages: ChatMessage[], reply: string) {
  try {
    const recent = messages.slice(-10).map((m) => `${m.role}: ${m.content}`).join("\n");
    const base = provider.baseUrl.replace(/\/+$/, "");
    const endpoint = base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({ model: provider.model, temperature: 0, messages: [
        { role: "system", content: "Extract at most 3 concise durable facts explicitly stated by the user: stable preferences, ongoing projects, goals, recurring constraints. Do not infer. Never save secrets, credentials, sensitive personal data or temporary states. Return only JSON: {\"memories\":[\"fact\"]}. Each under 300 characters." },
        { role: "user", content: `Conversation:\n${recent}\n\nAssistant reply:\n${reply}` }
      ] }), signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) return;
    const result = await response.json() as Completion;
    const raw = result.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return;
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as { memories?: unknown[] };
    const candidates = Array.isArray(parsed.memories) ? parsed.memories.filter((item): item is string => typeof item === "string") : [];
    const { data: existing } = await supabase.from("memories").select("content").eq("user_id", userId).limit(60);
    const known = new Set((existing || []).map((row) => row.content.trim().toLowerCase()));
    const fresh = [...new Set(candidates.map((item) => item.trim()).filter((item) => item.length > 0 && item.length <= 300 && !known.has(item.toLowerCase())))].slice(0, 3);
    if (fresh.length) await supabase.from("memories").insert(fresh.map((content) => ({ user_id: userId, content })));
  } catch { /* Memory extraction must never break a chat reply. */ }
}

export async function POST(request: NextRequest) {
  let body: { messages?: ChatMessage[]; autoMemory?: boolean };
  try { body = await request.json() as { messages?: ChatMessage[]; autoMemory?: boolean }; }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!Array.isArray(body.messages) || !body.messages.length) return NextResponse.json({ error: "Add a message first." }, { status: 400 });
  const messages = body.messages.slice(-30);
  if (messages.some((m) => !m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 12000))
    return NextResponse.json({ error: "Message format is not valid." }, { status: 400 });

  const providers = getProviders();
  if (!providers.length) return NextResponse.json({ error: "Connect an AI provider in Render environment settings first." }, { status: 503 });
  const auth = getUserClient(request);
  let userId: string | null = null;
  if (auth) {
    const { data: { user }, error } = await auth.supabase.auth.getUser(auth.token);
    if (!error && user) userId = user.id;
  }
  let memories: string[] = [];
  if (auth && userId) {
    const { data } = await auth.supabase.from("memories").select("content").eq("user_id", userId).order("updated_at", { ascending: false }).limit(60);
    memories = (data || []).map((row) => row.content);
  }
  const system = "You are LAZIX, a capable personal AI assistant. Be direct, warm, and useful. Use tools when they materially improve accuracy, not to appear busy. Never claim external actions you did not perform. You can calculate, check current UTC time, and search saved memory. You do not yet have permission to modify external accounts or repositories. Keep private reasoning private.";
  const memoryContext = memories.length ? "\n\nSaved user memories (use only when relevant; current instructions take precedence):\n" + memories.map((item) => `- ${item}`).join("\n") : "";
  const conversation: AgentMessage[] = [{ role: "system", content: system + memoryContext }, ...messages];

  for (const provider of providers) {
    try {
      let result: Completion;
      try { result = await askProvider(provider, conversation, true); }
      catch { result = await askProvider(provider, conversation, false); }
      let message = result.choices?.[0]?.message;
      let turns = 0;
      while (message?.tool_calls?.length && turns < 4) {
        conversation.push({ role: "assistant", content: message.content || "", tool_calls: message.tool_calls });
        for (const call of message.tool_calls) {
          conversation.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: await runTool(call, memories) });
        }
        result = await askProvider(provider, conversation, true);
        message = result.choices?.[0]?.message;
        turns++;
      }
      const reply = typeof message?.content === "string" ? message.content.trim() : "";
      if (!reply) continue;
      if (body.autoMemory !== false && auth && userId) await extractAndSaveMemories(provider, auth.supabase, userId, messages, reply);
      return NextResponse.json({ reply, model: provider.model, toolsUsed: turns });
    } catch { /* Try configured fallback provider. */ }
  }
  return NextResponse.json({ error: "All configured AI providers are unavailable. Check settings or try again." }, { status: 502 });
}
