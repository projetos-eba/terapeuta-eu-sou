import type {
  MatchingCalculationResult,
  MatchingConfig,
  MatchingSelection,
  MatchingTherapy,
  MatchingWeight,
} from "./types";

export function calculateMatchingResults(input: {
  config: MatchingConfig;
  selection: MatchingSelection;
  source: "demo" | "supabase";
  therapies: MatchingTherapy[];
  versionId: string;
  weights: MatchingWeight[];
}): MatchingCalculationResult {
  const themeIds = unique(input.selection.themeIds);
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
    return "Selecione até 3 interesses por tema.";
  }

  return null;
}

function getThemeCountLabel(matchingThemeCount: number) {
  return matchingThemeCount === 1
    ? "1 tema em comum"
    : `${matchingThemeCount} temas em comum`;
}

function buildExplanation(score: number) {
  if (score >= 100) {
    return "Este caminho reúne os temas principais que você escolheu para explorar.";
  }

  if (score >= 67) {
    return "Este caminho conversa com parte importante dos temas selecionados.";
  }

  return "Este caminho pode ser explorado com calma a partir de um tema em comum.";
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
