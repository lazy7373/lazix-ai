import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getModelProviders } from "@/lib/ai/providers";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const providers = await getModelProviders();
  const models = providers.map(({ id, label, model }) => ({ id, label, model }));
  let githubRead = false;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.LAZIX_OWNER_USER_ID && process.env.GITHUB_TOKEN) {
    const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: "Bearer " + token } },
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
    });
    const { data: { user } } = await supabase.auth.getUser(token);
    githubRead = Boolean(user && user.id === process.env.LAZIX_OWNER_USER_ID);
  }
  return NextResponse.json({ models, integrations: { webSearch: Boolean(process.env.TAVILY_API_KEY), githubRead } }, { headers: { "Cache-Control": "no-store" } });
}
