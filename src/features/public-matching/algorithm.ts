import type {
  MatchingCalculationResult,
  MatchingConfig,
  MatchingSelection,
  MatchingTherapy,
  MatchingWeight,
} from "./types";

const INTEREST_MULTIPLIER = 1.4;
const DISPLAY_THRESHOLD = 45;

export function calculateMatchingResults(input: {
  config: MatchingConfig;
  selection: MatchingSelection;
  source: "fallback" | "supabase";
  therapies: MatchingTherapy[];
  versionId: string;
  weights: MatchingWeight[];
}): MatchingCalculationResult {
  const themeIds = unique(input.selection.themeIds);
  const interestIds = unique(input.selection.interestIds);
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
        (weight) => weight.isActive && weight.therapyId === therapy.id,
      );
      const matchedThemeIds: string[] = [];
      const matchedInterestIds: string[] = [];
      const rawScore = therapyWeights.reduce((score, weight) => {
        if (weight.themeId && selectedThemeSet.has(weight.themeId)) {
          matchedThemeIds.push(weight.themeId);
          return score + weight.weight;
        }

        if (weight.interestId && selectedInterestSet.has(weight.interestId)) {
          matchedInterestIds.push(weight.interestId);
          return score + weight.weight * INTEREST_MULTIPLIER;
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
  const results = visibleResults.length
    ? visibleResults.slice(0, 5)
    : scored.slice(0, 3);

  return {
    lowConfidence: visibleResults.length === 0,
    results,
    source: input.source,
    versionId: input.versionId,
  };
}

export function validateMatchingSelection(
  config: MatchingConfig,
  selection: MatchingSelection,
) {
  const themeIds = unique(selection.themeIds);
  const interestIds = unique(selection.interestIds);
  const themeMap = new Map(config.themes.map((theme) => [theme.id, theme]));
  const interestMap = new Map(
    config.themes.flatMap((theme) =>
      theme.interests.map((interest) => [interest.id, interest] as const),
    ),
  );

  if (themeIds.length < 1 || themeIds.length > 3) {
    return "Selecione entre 1 e 3 temas.";
  }

  if (themeIds.some((themeId) => !themeMap.has(themeId))) {
    return "Selecione apenas temas ativos.";
  }

  const interestsByTheme = new Map<string, number>();

  for (const interestId of interestIds) {
    const interest = interestMap.get(interestId);

    if (!interest || !themeIds.includes(interest.themeId)) {
      return "Selecione apenas interesses dos temas escolhidos.";
    }

    interestsByTheme.set(
      interest.themeId,
      (interestsByTheme.get(interest.themeId) ?? 0) + 1,
    );
  }

  if (Array.from(interestsByTheme.values()).some((count) => count > 3)) {
    return "Selecione ate 3 interesses por tema.";
  }

  return null;
}

function getScoreLabel(score: number) {
  if (score >= 85) return "Alta aderência";
  if (score >= 65) return "Boa aderência";
  return "Pode fazer sentido";
}

function buildExplanation(score: number) {
  if (score >= 85) {
    return "Este caminho pode conversar bem com os temas e interesses que você escolheu.";
  }

  if (score >= 65) {
    return "Este caminho aparece como uma possibilidade alinhada ao seu momento.";
  }

  return "Este caminho pode ser explorado com calma como uma possibilidade inicial.";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
