type DenoRuntime = {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};

type MatchSource = "journey" | "therapy_page" | "therapist_search";

type MatchRequest = {
  maxResults?: unknown;
  selectedSubthemeIds?: unknown;
  selectedThemeIds?: unknown;
  source?: unknown;
};

type TherapyRow = {
  id: string;
  name: string;
  short_description: string;
  slug: string;
  status: "draft" | "active" | "inactive" | "archived";
};

type WeightRow = {
  id: string;
  is_active: boolean;
  reason: string | null;
  subtheme_id: string | null;
  theme_id: string | null;
  therapy_id: string;
  weight: number | string;
};

type MatchScore = {
  compatibilityPercent: number;
  explanation: string;
  matchedSubthemeIds: string[];
  matchedThemeIds: string[];
  score: number;
  therapy: {
    id: string;
    name: string;
    shortDescription: string;
    slug: string;
  };
};

type ParsedPayload =
  | {
      ok: true;
      value: {
        maxResults: number;
        selectedSubthemeIds: string[];
        selectedThemeIds: string[];
        source: MatchSource;
      };
    }
  | {
      body: { error: string; message: string };
      ok: false;
    };

const deno = (globalThis as typeof globalThis & { Deno?: DenoRuntime }).Deno;
const allowedSources = new Set<MatchSource>([
  "journey",
  "therapy_page",
  "therapist_search",
]);
const diagnosticLanguagePatterns = [
  /\bvoce tem\b/i,
  /\bvocê tem\b/i,
  /\bseu diagnostico\b/i,
  /\bseu diagnóstico\b/i,
  /\bdiagnosticad[ao]\b/i,
  /\btranstorno\b/i,
  /\bpatologia\b/i,
];
const jsonHeaders = {
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-origin": "*",
  "content-type": "application/json; charset=utf-8",
};

const denoRuntime = assertDenoRuntime(deno);

denoRuntime.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        error: "method_not_allowed",
        message: "Use POST para calcular o match.",
      },
      405,
    );
  }

  const payloadResult = await parsePayload(request);

  if (!payloadResult.ok) {
    return jsonResponse(payloadResult.body, 400);
  }

  const supabaseUrl = denoRuntime.env.get("SUPABASE_URL");
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      {
        error: "missing_supabase_env",
        message: "Ambiente Supabase da função não está configurado.",
      },
      500,
    );
  }

  try {
    const [therapies, weights] = await Promise.all([
      fetchRows<TherapyRow>(
        supabaseUrl,
        serviceRoleKey,
        "/rest/v1/therapies?select=id,name,slug,short_description,status&status=eq.active",
      ),
      fetchRows<WeightRow>(
        supabaseUrl,
        serviceRoleKey,
        "/rest/v1/therapy_theme_weights?select=id,therapy_id,theme_id,subtheme_id,weight,reason,is_active&is_active=eq.true",
      ),
    ]);

    return jsonResponse(
      calculateMatches({
        maxResults: payloadResult.value.maxResults,
        selectedSubthemeIds: payloadResult.value.selectedSubthemeIds,
        selectedThemeIds: payloadResult.value.selectedThemeIds,
        source: payloadResult.value.source,
        therapies,
        weights,
      }),
    );
  } catch (error) {
    return jsonResponse(
      {
        error: "match_failed",
        message: "Não conseguimos calcular as recomendações agora.",
        detail: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      500,
    );
  }
});

async function parsePayload(request: Request): Promise<ParsedPayload> {
  let payload: MatchRequest;

  try {
    payload = (await request.json()) as MatchRequest;
  } catch {
    return {
      ok: false,
      body: {
        error: "invalid_json",
        message: "Envie um JSON válido para calcular o match.",
      },
    };
  }

  const selectedThemeIds = normalizeStringList(payload.selectedThemeIds);
  const selectedSubthemeIds = normalizeStringList(payload.selectedSubthemeIds);

  if (selectedThemeIds.length === 0 && selectedSubthemeIds.length === 0) {
    return {
      ok: false,
      body: {
        error: "empty_selection",
        message:
          "Escolha pelo menos um tema ou interesse para calcular o match.",
      },
    };
  }

  const source =
    typeof payload.source === "string" &&
    allowedSources.has(payload.source as MatchSource)
      ? (payload.source as MatchSource)
      : "journey";

  return {
    ok: true,
    value: {
      maxResults: normalizeMaxResults(payload.maxResults),
      selectedSubthemeIds,
      selectedThemeIds,
      source,
    },
  };
}

async function fetchRows<T>(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase REST retornou ${response.status}.`);
  }

  return (await response.json()) as T[];
}

function getServiceRoleKey() {
  return (
    getDefaultKey(denoRuntime.env.get("SUPABASE_SECRET_KEYS")) ??
    denoRuntime.env.get("SUPABASE_SECRET_KEY") ??
    denoRuntime.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );
}

function getDefaultKey(rawKeys: string | undefined) {
  if (!rawKeys) return null;

  try {
    const keys = JSON.parse(rawKeys) as Record<string, unknown>;
    const defaultKey = keys.default;

    return typeof defaultKey === "string" && defaultKey ? defaultKey : null;
  } catch {
    return null;
  }
}

function assertDenoRuntime(runtime: DenoRuntime | undefined): DenoRuntime {
  if (!runtime) {
    throw new Error(
      "Deno runtime is required for this Supabase Edge Function.",
    );
  }

  return runtime;
}

function calculateMatches(input: {
  maxResults: number;
  selectedSubthemeIds: string[];
  selectedThemeIds: string[];
  source: MatchSource;
  therapies: TherapyRow[];
  weights: WeightRow[];
}) {
  const selectedThemeSet = new Set(input.selectedThemeIds);
  const selectedSubthemeSet = new Set(input.selectedSubthemeIds);
  const therapiesById = new Map(
    input.therapies.map((therapy) => [therapy.id, therapy]),
  );
  const possibleScore = Math.max(
    calculatePossibleScore(
      input.weights,
      input.selectedThemeIds,
      input.selectedSubthemeIds,
    ),
    1,
  );
  const scoreByTherapy = new Map<
    string,
    Omit<MatchScore, "compatibilityPercent" | "explanation">
  >();

  for (const weightRow of input.weights) {
    const therapy = therapiesById.get(weightRow.therapy_id);

    if (!therapy || therapy.status !== "active") {
      continue;
    }

    const score = calculateRowScore(
      weightRow,
      selectedThemeSet,
      selectedSubthemeSet,
    );

    if (score <= 0) {
      continue;
    }

    const current = scoreByTherapy.get(weightRow.therapy_id) ?? {
      matchedSubthemeIds: [],
      matchedThemeIds: [],
      score: 0,
      therapy: {
        id: therapy.id,
        name: therapy.name,
        shortDescription: therapy.short_description,
        slug: therapy.slug,
      },
    };

    current.score += score;
    current.matchedThemeIds = addIfSelected(
      current.matchedThemeIds,
      weightRow.theme_id,
      selectedThemeSet,
    );
    current.matchedSubthemeIds = addIfSelected(
      current.matchedSubthemeIds,
      weightRow.subtheme_id,
      selectedSubthemeSet,
    );

    scoreByTherapy.set(weightRow.therapy_id, current);
  }

  return {
    source: input.source,
    results: Array.from(scoreByTherapy.values())
      .map((score) => {
        const compatibilityPercent = Math.min(
          100,
          Math.max(1, Math.round((score.score / possibleScore) * 100)),
        );
        const explanation = buildExplanation(
          score.matchedSubthemeIds.length > 0,
          compatibilityPercent,
        );

        return {
          ...score,
          compatibilityPercent,
          explanation: sanitizeExplanation(explanation),
        };
      })
      .sort((first, second) => {
        if (second.score !== first.score) {
          return second.score - first.score;
        }

        if (second.compatibilityPercent !== first.compatibilityPercent) {
          return second.compatibilityPercent - first.compatibilityPercent;
        }

        return first.therapy.name.localeCompare(second.therapy.name, "pt-BR");
      })
      .slice(0, input.maxResults),
  };
}

function calculateRowScore(
  row: WeightRow,
  selectedThemeSet: Set<string>,
  selectedSubthemeSet: Set<string>,
) {
  let score = 0;

  if (row.theme_id && selectedThemeSet.has(row.theme_id)) {
    score += normalizeWeight(row.weight);
  }

  if (row.subtheme_id && selectedSubthemeSet.has(row.subtheme_id)) {
    score += normalizeWeight(row.weight);
  }

  return score;
}

function calculatePossibleScore(
  weights: WeightRow[],
  selectedThemeIds: string[],
  selectedSubthemeIds: string[],
) {
  const themeScore = selectedThemeIds.reduce((total, themeId) => {
    return total + getBestWeight(weights, "theme_id", themeId);
  }, 0);
  const subthemeScore = selectedSubthemeIds.reduce((total, subthemeId) => {
    return total + getBestWeight(weights, "subtheme_id", subthemeId);
  }, 0);

  return themeScore + subthemeScore;
}

function getBestWeight(
  weights: WeightRow[],
  key: "theme_id" | "subtheme_id",
  id: string,
) {
  return weights.reduce((bestWeight, row) => {
    if (row[key] !== id) {
      return bestWeight;
    }

    return Math.max(bestWeight, normalizeWeight(row.weight));
  }, 0);
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      ),
    ),
  );
}

function normalizeMaxResults(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 8;
  }

  return Math.min(20, Math.max(1, Math.floor(value)));
}

function normalizeWeight(value: number | string) {
  const parsedWeight = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1;
}

function addIfSelected(
  values: string[],
  value: string | null,
  selectedValues: Set<string>,
) {
  if (!value || !selectedValues.has(value) || values.includes(value)) {
    return values;
  }

  return [...values, value];
}

function buildExplanation(
  hasSubthemeMatch: boolean,
  compatibilityPercent: number,
) {
  if (compatibilityPercent >= 80 && hasSubthemeMatch) {
    return "Este caminho pode fazer sentido para o momento que você compartilhou.";
  }

  if (hasSubthemeMatch) {
    return "Essa terapia aparece como uma possibilidade alinhada aos interesses que você escolheu.";
  }

  return "Essa terapia aparece como uma possibilidade alinhada às suas escolhas.";
}

function sanitizeExplanation(explanation: string) {
  if (diagnosticLanguagePatterns.some((pattern) => pattern.test(explanation))) {
    return "Essa terapia aparece como uma possibilidade alinhada às suas escolhas.";
  }

  return explanation;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: jsonHeaders,
    status,
  });
}
