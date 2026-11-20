import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getUserClient(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return null;
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
  return { supabase, token };
}

export async function GET(request: NextRequest) {
  const client = getUserClient(request);
  if (!client) return NextResponse.json({ error: "Sign in to access your LAZIX memory." }, { status: 401 });
  const { data: { user }, error: authError } = await client.supabase.auth.getUser(client.token);
  if (authError || !user) return NextResponse.json({ error: "Your session is invalid. Please sign in again." }, { status: 401 });
  const { data, error } = await client.supabase.from("memories").select("id, content, created_at, updated_at")
    .eq("user_id", user.id).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load memory. Check that the Supabase SQL setup has been run." }, { status: 500 });
  return NextResponse.json({ memories: data });
}

export async function POST(request: NextRequest) {
  const client = getUserClient(request);
  if (!client) return NextResponse.json({ error: "Sign in to save memory." }, { status: 401 });
  const { data: { user }, error: authError } = await client.supabase.auth.getUser(client.token);
  if (authError || !user) return NextResponse.json({ error: "Your session is invalid. Please sign in again." }, { status: 401 });
  let body: { content?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const content = body.content?.trim();
  if (!content || content.length > 2000) return NextResponse.json({ error: "Memory must be between 1 and 2,000 characters." }, { status: 400 });
  const { data, error } = await client.supabase.from("memories").insert({ user_id: user.id, content }).select("id, content, created_at, updated_at").single();
  if (error) return NextResponse.json({ error: "Could not save memory." }, { status: 500 });
  return NextResponse.json({ memory: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const client = getUserClient(request);
  if (!client) return NextResponse.json({ error: "Sign in to delete memory." }, { status: 401 });
  const { data: { user }, error: authError } = await client.supabase.auth.getUser(client.token);
  if (authError || !user) return NextResponse.json({ error: "Your session is invalid. Please sign in again." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Memory id is required." }, { status: 400 });
  const { error } = await client.supabase.from("memories").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not delete memory." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
