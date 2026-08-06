type MatchingDenoRuntime = {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};

type MatchingRequest = {
  interestIds?: unknown;
  matchingVersionId?: unknown;
  source?: unknown;
  themeIds?: unknown;
  versionId?: unknown;
};

type MatchingVersionRow = {
  id: string;
  status: "draft" | "published" | "archived";
  version: number;
};

type MatchingTherapyRow = {
  description: string | null;
  id: string;
  image_url: string | null;
  is_visible_in_matching: boolean;
  name: string;
  short_description: string;
  slug: string;
  status: "active" | "archived" | "draft" | "inactive" | "published";
  therapist_count?: number | null;
};

type MatchingTherapyThemeRow = {
  sort_order: number;
  theme_id: string;
  therapy_id: string;
};

type MatchingTherapyCountRow = {
  therapist_count: number | null;
  therapy_id: string;
};

type MatchingTherapy = {
  id: string;
  imageUrl: string | null;
  isVisibleInMatching: boolean;
  name: string;
  slug: string;
  sortOrder: number;
  status: MatchingTherapyRow["status"];
  themeIds: string[];
  therapistCount: number;
};

const matchingDeno = (
  globalThis as typeof globalThis & { Deno?: MatchingDenoRuntime }
).Deno;
const matchingRuntime = assertDenoRuntime(matchingDeno);
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
    typeof payload?.matchingVersionId === "string"
      ? payload.matchingVersionId
      : typeof payload?.versionId === "string"
        ? payload.versionId
        : null;

  if (!versionId || themeIds.length < 1 || themeIds.length > 3) {
    return jsonResponse({ error: "invalid_selection" }, 422);
  }

  try {
    const versionRows = await fetchRows<MatchingVersionRow>(
      supabaseUrl,
      serviceRoleKey,
      `/rest/v1/matching_versions?select=id,version,status&id=eq.${encodeURIComponent(versionId)}&status=eq.published&limit=1`,
    );

    if (!versionRows.length) {
      return jsonResponse({ error: "matching_version_unavailable" }, 409);
    }

    const [therapyRows, themeRows, countRows] = await Promise.all([
      fetchRows<MatchingTherapyRow>(
        supabaseUrl,
        serviceRoleKey,
        "/rest/v1/public_matching_therapies_v?select=id,name,slug,short_description,description,image_url,status,therapist_count,is_visible_in_matching",
      ),
      fetchRows<MatchingTherapyThemeRow>(
        supabaseUrl,
        serviceRoleKey,
        "/rest/v1/public_matching_therapy_themes_v?select=therapy_id,theme_id,sort_order&order=sort_order.asc",
      ),
      fetchRows<MatchingTherapyCountRow>(
        supabaseUrl,
        serviceRoleKey,
        "/rest/v1/public_matching_therapist_counts?select=therapy_id,therapist_count",
      ),
    ]);

    return jsonResponse(
      calculateMatchingResults({
        interestIds,
        source: "supabase",
        therapies: mergeTherapyRows(therapyRows, themeRows, countRows),
        themeIds,
        versionId,
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
  source: "demo" | "supabase";
  therapies: MatchingTherapy[];
  themeIds: string[];
  versionId: string;
}) {
  const themeIds = unique(input.themeIds);
  const selectedThemeSet = new Set(themeIds);
  const possibleScore = Math.max(themeIds.length, 1);
  const activeTherapies = input.therapies.filter(
    (therapy) => therapy.status === "published" && therapy.isVisibleInMatching,
  );
  const scored = activeTherapies
    .map((therapy) => {
      const matchedThemeIds = unique(
        therapy.themeIds.filter((themeId) => selectedThemeSet.has(themeId)),
      );
      const matchingThemeCount = matchedThemeIds.length;
      const scorePercent = Math.round((matchingThemeCount / possibleScore) * 100);

      return {
        explanation: buildExplanation(scorePercent),
        imageUrl: therapy.imageUrl,
        label: getThemeCountLabel(matchingThemeCount),
        matchedInterestIds: [],
        matchedThemeIds,
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

      const firstTherapy = activeTherapies.find(
        (therapy) => therapy.id === first.therapyId,
      );
      const secondTherapy = activeTherapies.find(
        (therapy) => therapy.id === second.therapyId,
      );

      if ((firstTherapy?.sortOrder ?? 0) !== (secondTherapy?.sortOrder ?? 0)) {
        return (firstTherapy?.sortOrder ?? 0) - (secondTherapy?.sortOrder ?? 0);
      }

      return first.title.localeCompare(second.title, "pt-BR");
    });

  return {
    lowConfidence: scored.length === 0,
    results: scored.slice(0, 5),
    source: input.source,
    versionId: input.versionId,
  };
}

function mergeTherapyRows(
  therapies: MatchingTherapyRow[],
  themes: MatchingTherapyThemeRow[],
  counts: MatchingTherapyCountRow[],
): MatchingTherapy[] {
  const themesByTherapyId = new Map<string, string[]>();
  const sortOrderByTherapyId = new Map<string, number>();
  const countsByTherapyId = new Map(
    counts.map((count) => [count.therapy_id, count]),
  );

  for (const theme of themes) {
    themesByTherapyId.set(theme.therapy_id, [
      ...(themesByTherapyId.get(theme.therapy_id) ?? []),
      theme.theme_id,
    ]);
    sortOrderByTherapyId.set(
      theme.therapy_id,
      Math.min(
        sortOrderByTherapyId.get(theme.therapy_id) ?? theme.sort_order,
        theme.sort_order,
      ),
    );
  }

  return therapies.map((therapy) => ({
    id: therapy.id,
    imageUrl: therapy.image_url,
    isVisibleInMatching: therapy.is_visible_in_matching,
    name: therapy.name,
    slug: therapy.slug,
    sortOrder: sortOrderByTherapyId.get(therapy.id) ?? 9999,
    status: therapy.status,
    themeIds: themesByTherapyId.get(therapy.id) ?? [],
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

function getThemeCountLabel(matchingThemeCount: number) {
  return matchingThemeCount === 1
    ? "1 tema em comum"
    : `${matchingThemeCount} temas em comum`;
}

function buildExplanation(score: number) {
  if (score >= 100) {
    return "Este caminho reune os temas principais que voce escolheu para explorar.";
  }

  if (score >= 67) {
    return "Este caminho conversa com parte importante dos temas selecionados.";
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
