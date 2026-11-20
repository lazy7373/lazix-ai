import { NextResponse } from "next/server";
import { getModelProviders } from "@/lib/ai/providers";

export const runtime = "nodejs";

export async function GET() {
  const providers = await getModelProviders();
  const models = providers.map(({ id, label, model }) => ({ id, label, model }));
  return NextResponse.json({ models, integrations: { webSearch: Boolean(process.env.TAVILY_API_KEY), githubRead: Boolean(process.env.GITHUB_TOKEN) } }, { headers: { "Cache-Control": "no-store" } });
}
