type MatchingDenoRuntime = {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};

type MatchingRequest = {
  interestIds?: unknown;
  source?: unknown;
  themeIds?: unknown;
  versionId?: unknown;
};

type MatchingTherapyRow = {
  description: string | null;
  id: string;
  image_url: string | null;
  name: string;
  short_description: string;
  slug: string;
  status: "active" | "archived" | "draft" | "inactive" | "published";
  therapist_count?: number | null;
};

type MatchingTherapySettingRow = {
  is_visible_in_matching: boolean;
  therapy_id: string;
};

type MatchingTherapyCountRow = {
  therapist_count: number | null;
  therapy_id: string;
};

type MatchingWeightRow = {
  interest_id: string | null;
  is_active: boolean;
  theme_id: string | null;
  therapy_id: string;
  weight: number | string;
};

type MatchingTherapy = {
  id: string;
  imageUrl: string | null;
  isVisibleInMatching: boolean;
  name: string;
  slug: string;
  status: MatchingTherapyRow["status"];
  therapistCount: number;
};

const matchingDeno = (
  globalThis as typeof globalThis & { Deno?: MatchingDenoRuntime }
).Deno;
const matchingRuntime = assertDenoRuntime(matchingDeno);
const INTEREST_MULTIPLIER = 1.4;
const DISPLAY_THRESHOLD = 45;
const jsonHeaders = {
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": "*",
  "content-type": "application/json; charset=utf-8",
};

matchingRuntime.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: jsonHeaders, status: 204 });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = matchingRuntime.env.get("SUPABASE_URL");
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "missing_supabase_env" }, 500);
  }

  const payload = await parseJson<MatchingRequest>(request);
  const themeIds = normalizeStringList(payload?.themeIds);
  const interestIds = normalizeStringList(payload?.interestIds);
  const versionId =
    typeof payload?.versionId === "string" ? payload.versionId : null;

  if (!versionId || themeIds.length < 1 || themeIds.length > 3) {
    return jsonResponse({ error: "invalid_selection" }, 422);
  }

  try {
    const [therapyRows, settingRows, countRows, weightRows] = await Promise.all([
      fetchRows<MatchingTherapyRow>(
        supabaseUrl,
        serviceRoleKey,
        "/rest/v1/public_matching_therapies_v?select=id,name,slug,short_description,description,image_url,status,therapist_count,is_visible_in_matching",
      ),
      fetchRows<MatchingTherapySettingRow>(
        supabaseUrl,
        serviceRoleKey,
        "/rest/v1/matching_therapy_settings?select=therapy_id,is_visible_in_matching",
      ),
      fetchRows<MatchingTherapyCountRow>(
        supabaseUrl,
        serviceRoleKey,
        "/rest/v1/public_matching_therapist_counts?select=therapy_id,therapist_count",
      ),
      fetchRows<MatchingWeightRow>(
        supabaseUrl,
        serviceRoleKey,
        `/rest/v1/matching_weights?select=therapy_id,theme_id,interest_id,weight,is_active&version_id=eq.${encodeURIComponent(
          versionId,
        )}&is_active=eq.true`,
      ),
    ]);

    return jsonResponse(
      calculateMatchingResults({
        interestIds,
        source: "supabase",
        therapies: mergeTherapyRows(therapyRows, settingRows, countRows),
        themeIds,
        versionId,
        weights: weightRows,
      }),
    );
  } catch {
    return jsonResponse({ error: "matching_failed" }, 500);
  }
});

async function fetchRows<T>(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase REST returned ${response.status}.`);
  }

  return (await response.json()) as T[];
}

function calculateMatchingResults(input: {
  interestIds: string[];
  source: "fallback" | "supabase";
  therapies: MatchingTherapy[];
  themeIds: string[];
  versionId: string;
  weights: MatchingWeightRow[];
}) {
  const themeIds = unique(input.themeIds);
  const interestIds = unique(input.interestIds);
  const selectedThemeSet = new Set(themeIds);
  const selectedInterestSet = new Set(interestIds);
  const possibleScore = Math.max(
    themeIds.length * 5 + interestIds.length * 5 * INTEREST_MULTIPLIER,
    1,
  );
  const activeTherapies = input.therapies.filter(
    (therapy) => therapy.status === "published" && therapy.isVisibleInMatching,
  );
  const scored = activeTherapies
    .map((therapy) => {
      const therapyWeights = input.weights.filter(
        (weight) => weight.is_active && weight.therapy_id === therapy.id,
      );
      const matchedThemeIds: string[] = [];
      const matchedInterestIds: string[] = [];
      const rawScore = therapyWeights.reduce((score, weight) => {
        if (weight.theme_id && selectedThemeSet.has(weight.theme_id)) {
          matchedThemeIds.push(weight.theme_id);
          return score + normalizeWeight(weight.weight);
        }

        if (weight.interest_id && selectedInterestSet.has(weight.interest_id)) {
          matchedInterestIds.push(weight.interest_id);
          return score + normalizeWeight(weight.weight) * INTEREST_MULTIPLIER;
        }

        return score;
      }, 0);
      const scorePercent = Math.round((rawScore / possibleScore) * 100);

      return {
        explanation: buildExplanation(scorePercent),
        imageUrl: therapy.imageUrl,
        label: getScoreLabel(scorePercent),
        matchedInterestIds: unique(matchedInterestIds),
        matchedThemeIds: unique(matchedThemeIds),
        scorePercent,
        slug: therapy.slug,
        therapistCount: therapy.therapistCount,
        therapyId: therapy.id,
        title: therapy.name,
      };
    })
    .filter((result) => result.scorePercent > 0)
    .sort((first, second) => {
      if (second.scorePercent !== first.scorePercent) {
        return second.scorePercent - first.scorePercent;
      }

      if (second.matchedInterestIds.length !== first.matchedInterestIds.length) {
        return second.matchedInterestIds.length - first.matchedInterestIds.length;
      }

      return first.title.localeCompare(second.title, "pt-BR");
    });
  const visibleResults = scored.filter(
    (result) => result.scorePercent >= DISPLAY_THRESHOLD,
  );

  return {
    lowConfidence: visibleResults.length === 0,
    results: visibleResults.length ? visibleResults.slice(0, 5) : scored.slice(0, 3),
    source: input.source,
    versionId: input.versionId,
  };
}

function mergeTherapyRows(
  therapies: MatchingTherapyRow[],
  settings: MatchingTherapySettingRow[],
  counts: MatchingTherapyCountRow[],
): MatchingTherapy[] {
  const settingsByTherapyId = new Map(
    settings.map((setting) => [setting.therapy_id, setting]),
  );
  const countsByTherapyId = new Map(
    counts.map((count) => [count.therapy_id, count]),
  );

  return therapies.map((therapy) => ({
    id: therapy.id,
    imageUrl: therapy.image_url,
    isVisibleInMatching:
      settingsByTherapyId.get(therapy.id)?.is_visible_in_matching ?? true,
    name: therapy.name,
    slug: therapy.slug,
    status: therapy.status,
    therapistCount:
      countsByTherapyId.get(therapy.id)?.therapist_count ??
      therapy.therapist_count ??
      0,
  }));
}

async function parseJson<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.filter((item): item is string => typeof item === "string")),
  );
}

function normalizeWeight(value: number | string) {
  const parsedWeight = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1;
}

function getScoreLabel(score: number) {
  if (score >= 85) return "Alta aderencia";
  if (score >= 65) return "Boa aderencia";
  return "Pode fazer sentido";
}

function buildExplanation(score: number) {
  if (score >= 85) {
    return "Este caminho pode conversar bem com os temas e interesses que voce escolheu.";
  }

  if (score >= 65) {
    return "Este caminho aparece como uma possibilidade alinhada ao seu momento.";
  }

  return "Este caminho pode ser explorado com calma como uma possibilidade inicial.";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getServiceRoleKey() {
  return (
    getDefaultKey(matchingRuntime.env.get("SUPABASE_SECRET_KEYS")) ??
    matchingRuntime.env.get("SUPABASE_SECRET_KEY") ??
    matchingRuntime.env.get("SUPABASE_SERVICE_ROLE_KEY")
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

function assertDenoRuntime(
  runtime: MatchingDenoRuntime | undefined,
): MatchingDenoRuntime {
  if (!runtime) {
    throw new Error("Deno runtime is required for Supabase Edge Functions.");
  }

  return runtime;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: jsonHeaders,
    status,
  });
}

export {};
