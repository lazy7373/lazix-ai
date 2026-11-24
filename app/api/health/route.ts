import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight liveness endpoint for Docker, reverse proxies, and uptime checks.
 * It intentionally reports configuration as booleans only; never expose secrets.
 */
export async function GET() {
  const rawProviders = process.env.MODEL_PROVIDERS_JSON;
  let aiProviderConfigured = Boolean(
    process.env.MODEL_PRIMARY_BASE_URL &&
    process.env.MODEL_PRIMARY_API_KEY &&
    process.env.MODEL_PRIMARY_NAME
  );

  if (rawProviders) {
    try {
      const parsed: unknown = JSON.parse(rawProviders);
      aiProviderConfigured = Array.isArray(parsed) && parsed.some((item) => {
        if (!item || typeof item !== "object") return false;
        const provider = item as Record<string, unknown>;
        return typeof provider.baseUrl === "string" &&
          typeof provider.apiKey === "string" &&
          typeof provider.model === "string" &&
          Boolean(provider.baseUrl && provider.apiKey && provider.model);
      });
    } catch {
      aiProviderConfigured = false;
    }
  }

  return NextResponse.json(
    {
      status: "ok",
      service: "lazix",
      timestamp: new Date().toISOString(),
      configuration: {
        aiProviderConfigured,
        supabaseConfigured: Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
      }
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
