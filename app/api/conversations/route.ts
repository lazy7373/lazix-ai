import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";

function getClient(request: NextRequest) {
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

export async function GET(request: NextRequest) {
  const client = getClient(request);
  if (!client) return NextResponse.json({ error: "Sign in to sync conversation history." }, { status: 401 });
  const { data: { user }, error: authError } = await client.supabase.auth.getUser(client.token);
  if (authError || !user) return NextResponse.json({ error: "Your session is invalid. Please sign in again." }, { status: 401 });
  const { data: conversations, error } = await client.supabase.from("conversations")
    .select("id, title, created_at, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: "Cloud history is not ready. Run the latest Supabase migrations." }, { status: 503 });
  const ids = (conversations || []).map((item) => item.id);
  if (!ids.length) return NextResponse.json({ conversations: [] });
  const { data: messages, error: messageError } = await client.supabase.from("conversation_messages")
    .select("id, conversation_id, role, content, created_at").eq("user_id", user.id).in("conversation_id", ids).order("created_at", { ascending: true });
  if (messageError) return NextResponse.json({ error: "Could not load cloud messages." }, { status: 500 });
  const result = (conversations || []).map((item) => ({
    ...item,
    messages: (messages || []).filter((message) => message.conversation_id === item.id).map((message) => ({ role: message.role as "user" | "assistant", content: message.content }))
  }));
  return NextResponse.json({ conversations: result });
}

export async function POST(request: NextRequest) {
  const client = getClient(request);
  if (!client) return NextResponse.json({ error: "Sign in to sync conversation history." }, { status: 401 });
  const { data: { user }, error: authError } = await client.supabase.auth.getUser(client.token);
  if (authError || !user) return NextResponse.json({ error: "Your session is invalid. Please sign in again." }, { status: 401 });
  let body: { id?: string; title?: string; messages?: { role: string; content: string }[] };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!Array.isArray(body.messages) || body.messages.length > 100 || body.messages.some((message) =>
    !message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string" || !message.content.trim() || message.content.length > 20000
  )) return NextResponse.json({ error: "Conversation messages are invalid." }, { status: 400 });
  const title = (body.title || body.messages.find((message) => message.role === "user")?.content || "New conversation").trim().slice(0, 160) || "New conversation";
  let conversationId = body.id;
  if (conversationId) {
    const { data: existing, error: lookupError } = await client.supabase.from("conversations").select("id")
      .eq("id", conversationId).eq("user_id", user.id).maybeSingle();
    if (lookupError || !existing) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const { error } = await client.supabase.from("conversations").update({ title, updated_at: new Date().toISOString() })
      .eq("id", conversationId).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "Could not update conversation." }, { status: 500 });
    const { error: deleteError } = await client.supabase.from("conversation_messages").delete().eq("conversation_id", conversationId).eq("user_id", user.id);
    if (deleteError) return NextResponse.json({ error: "Could not replace conversation messages." }, { status: 500 });
  } else {
    const { data, error } = await client.supabase.from("conversations").insert({ user_id: user.id, title }).select("id").single();
    if (error || !data) return NextResponse.json({ error: "Could not create conversation." }, { status: 500 });
    conversationId = data.id;
  }
  if (body.messages.length) {
    const { error } = await client.supabase.from("conversation_messages").insert(body.messages.map((message) => ({
      conversation_id: conversationId as string, user_id: user.id, role: message.role, content: message.content
    })));
    if (error) return NextResponse.json({ error: "Could not save conversation messages." }, { status: 500 });
  }
  return NextResponse.json({ id: conversationId, title }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  const client = getClient(request);
  if (!client) return NextResponse.json({ error: "Sign in to delete conversations." }, { status: 401 });
  const { data: { user }, error: authError } = await client.supabase.auth.getUser(client.token);
  if (authError || !user) return NextResponse.json({ error: "Your session is invalid. Please sign in again." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Conversation id is required." }, { status: 400 });
  const { error } = await client.supabase.from("conversations").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not delete conversation." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
