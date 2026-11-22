export type ModelProvider = {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

type OpenRouterCatalogItem = {
  id?: string;
  name?: string;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
  architecture?: { output_modalities?: string[] };
};

function configuredList(): ModelProvider[] {
  const raw = process.env.MODEL_PROVIDERS_JSON;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const providers = parsed.flatMap((value, index) => {
          if (!value || typeof value !== "object") return [];
          const item = value as Record<string, unknown>;
          if (typeof item.baseUrl !== "string" || typeof item.apiKey !== "string" || typeof item.model !== "string") return [];
          return [{
            id: typeof item.id === "string" ? item.id : `provider-${index + 1}`,
            label: typeof item.label === "string" ? item.label : item.model,
            baseUrl: item.baseUrl,
            apiKey: item.apiKey,
            model: item.model
          }];
        });
        if (providers.length) return providers;
      }
    } catch { /* Continue to legacy environment configuration. */ }
  }

  return [
    { id: "primary", label: process.env.MODEL_PRIMARY_LABEL || "Primary", baseUrl: process.env.MODEL_PRIMARY_BASE_URL || "", apiKey: process.env.MODEL_PRIMARY_API_KEY || "", model: process.env.MODEL_PRIMARY_NAME || "" },
    { id: "fallback", label: process.env.MODEL_FALLBACK_LABEL || "Fallback", baseUrl: process.env.MODEL_FALLBACK_BASE_URL || "", apiKey: process.env.MODEL_FALLBACK_API_KEY || "", model: process.env.MODEL_FALLBACK_NAME || "" }
  ].filter((item) => item.baseUrl && item.apiKey && item.model);
}

function apiEndpoint(baseUrl: string, resource: string) {
  const base = baseUrl.replace(/\/+$/, "");
  return base.endsWith("/v1") ? `${base}/${resource}` : `${base}/v1/${resource}`;
}

let cachedCatalog: { expiresAt: number; providers: ModelProvider[] } | null = null;

export async function getModelProviders(discoverCatalog = true): Promise<ModelProvider[]> {
  const configured = configuredList();
  // Chat requests must never wait for the optional OpenRouter catalog request.
  if (!discoverCatalog) {
    if (cachedCatalog && cachedCatalog.expiresAt > Date.now()) return cachedCatalog.providers;
    const primary = configured[0];
    if (!process.env.MODEL_PROVIDERS_JSON && primary?.baseUrl.includes("openrouter.ai")) {
      const backupIds = ["nvidia/nemotron-3.5-lightning:free", "nvidia/nemotron-3.5-super-vl:free", "nvidia/nemotron-3-ultra-550b-a55b:free"];
      const quickFallbacks: ModelProvider[] = [
        { id: "openrouter-auto-free", label: "OpenRouter · Auto Free", baseUrl: primary.baseUrl, apiKey: primary.apiKey, model: "openrouter/free" },
        ...configured,
        ...backupIds.map((model) => ({ id: "openrouter:" + model, label: model, baseUrl: primary.baseUrl, apiKey: primary.apiKey, model }))
      ];
      return quickFallbacks.filter((provider, index, all) => all.findIndex((item) => item.model === provider.model) === index);
    }
    return configured;
  }
  if (cachedCatalog && cachedCatalog.expiresAt > Date.now()) return cachedCatalog.providers;
  if (process.env.MODEL_PROVIDERS_JSON || !configured.length || !configured[0].baseUrl.includes("openrouter.ai")) return configured;

  const primary = configured[0];
  try {
    const response = await fetch(apiEndpoint(primary.baseUrl, "models"), {
      headers: { Authorization: `Bearer ${primary.apiKey}` },
      signal: AbortSignal.timeout(7000),
      cache: "no-store"
    });
    if (!response.ok) return configured;
    const payload = await response.json() as { data?: OpenRouterCatalogItem[] };
    const catalog = Array.isArray(payload.data) ? payload.data : [];
    const freeToolModels = catalog.filter((item) =>
      typeof item.id === "string" &&
      Number(item.pricing?.prompt) === 0 &&
      Number(item.pricing?.completion) === 0 &&
      item.supported_parameters?.includes("tools") &&
      (!item.architecture?.output_modalities || item.architecture.output_modalities.includes("text"))
    );
    const preferred = [
      "nvidia/nemotron-3.5-lightning:free",
      "nvidia/nemotron-3.5-super-vl:free",
      "nvidia/nemotron-3-ultra-550b-a55b:free"
    ];
    freeToolModels.sort((a, b) => {
      const ai = preferred.indexOf(a.id || "");
      const bi = preferred.indexOf(b.id || "");
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
    const discovered: ModelProvider[] = [{
      id: "openrouter-auto-free",
      label: "OpenRouter · Auto Free",
      baseUrl: primary.baseUrl,
      apiKey: primary.apiKey,
      model: "openrouter/free"
    }, ...configured];
    for (const item of freeToolModels.slice(0, 12)) {
      if (!item.id || discovered.some((provider) => provider.model === item.id)) continue;
      discovered.push({
        id: "openrouter:" + item.id,
        label: item.name || item.id,
        baseUrl: primary.baseUrl,
        apiKey: primary.apiKey,
        model: item.id
      });
    }
    const result = discovered.length > 1 ? discovered : configured;
    cachedCatalog = { providers: result, expiresAt: Date.now() + 5 * 60 * 1000 };
    return result;
  } catch {
    cachedCatalog = { providers: configured, expiresAt: Date.now() + 60 * 1000 };
    return configured;
  }
}
