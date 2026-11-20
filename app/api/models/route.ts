import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PublicModel = { id: string; label: string; model: string };

export async function GET() {
  const configured = process.env.MODEL_PROVIDERS_JSON;
  if (configured) {
    try {
      const parsed: unknown = JSON.parse(configured);
      if (Array.isArray(parsed)) {
        const models: PublicModel[] = parsed.flatMap((item, index) => {
          if (!item || typeof item !== "object") return [];
          const p = item as Record<string, unknown>;
          if (typeof p.baseUrl !== "string" || typeof p.apiKey !== "string" || typeof p.model !== "string") return [];
          return [{ id: typeof p.id === "string" ? p.id : `provider-${index + 1}`, label: typeof p.label === "string" ? p.label : p.model, model: p.model }];
        });
        if (models.length) return NextResponse.json({ models });
      }
    } catch { /* Legacy provider configuration below. */ }
  }

  const candidates = [
    { id: "primary", label: process.env.MODEL_PRIMARY_LABEL || "Primary model", model: process.env.MODEL_PRIMARY_NAME, baseUrl: process.env.MODEL_PRIMARY_BASE_URL, apiKey: process.env.MODEL_PRIMARY_API_KEY },
    { id: "fallback", label: process.env.MODEL_FALLBACK_LABEL || "Fallback model", model: process.env.MODEL_FALLBACK_NAME, baseUrl: process.env.MODEL_FALLBACK_BASE_URL, apiKey: process.env.MODEL_FALLBACK_API_KEY }
  ];
  const models = candidates.filter((item) => item.model && item.baseUrl && item.apiKey).map(({ id, label, model }) => ({ id, label, model }));
  return NextResponse.json({ models });
}
