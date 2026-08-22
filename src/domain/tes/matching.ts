import { MatchSource, TherapyStatus } from "./enums";
import type {
  MatchInput,
  MatchResult,
  MatchTherapyScore,
  TherapyThemeRelation,
  UUID,
} from "./types";

const DEFAULT_THEME_WEIGHT = 10;
const DEFAULT_SUBTHEME_WEIGHT = 14;

export const diagnosticLanguagePatterns = [
  /\bvoce tem\b/i,
  /\bvocê tem\b/i,
  /\bseu diagnostico\b/i,
  /\bseu diagnóstico\b/i,
  /\bdiagnosticad[ao]\b/i,
  /\btranstorno\b/i,
  /\bpatologia\b/i,
];

export function containsDiagnosticLanguage(text: string) {
  return diagnosticLanguagePatterns.some((pattern) => pattern.test(text));
}

export function calculateTherapyMatches(input: MatchInput): MatchResult {
  const selectedThemeIds = toUniqueList(input.selectedThemeIds);
  const selectedSubthemeIds = toUniqueList(input.selectedSubthemeIds ?? []);
  const source = input.source ?? MatchSource.Journey;

  if (
    input.relations.length === 0 ||
    input.therapies.length === 0 ||
    (selectedThemeIds.length === 0 && selectedSubthemeIds.length === 0)
  ) {
    return { source, results: [] };
  }

  const themeSet = new Set(selectedThemeIds);
  const subthemeSet = new Set(selectedSubthemeIds);
  const activeRelations = input.relations.filter(isActiveRelation);
  const activeTherapiesById = new Map(
    input.therapies
      .filter((therapy) => therapy.status === TherapyStatus.Active)
      .map((therapy) => [therapy.id, therapy]),
  );

  if (activeRelations.length === 0 || activeTherapiesById.size === 0) {
    return { source, results: [] };
  }

  const possibleScore = calculatePossibleScore(
    activeRelations,
    selectedThemeIds,
    selectedSubthemeIds,
  );
  const scoreByTherapy = new Map<
    UUID,
    Omit<MatchTherapyScore, "compatibilityPercent" | "explanation">
  >();

  for (const relation of activeRelations) {
    const therapy = activeTherapiesById.get(relation.therapyId);

    if (!therapy) {
      continue;
    }

    const score = calculateRelationScore(relation, themeSet, subthemeSet);

    if (score <= 0) {
      continue;
    }

    const current = scoreByTherapy.get(relation.therapyId) ?? {
      therapy,
      score: 0,
      matchedThemeIds: [],
      matchedSubthemeIds: [],
    };

    current.score += score;
    current.matchedThemeIds = addUniqueIfPresent(
      current.matchedThemeIds,
      relation.themeId,
      themeSet,
    );
    current.matchedSubthemeIds = addUniqueIfPresent(
      current.matchedSubthemeIds,
      relation.subthemeId,
      subthemeSet,
    );

    scoreByTherapy.set(relation.therapyId, current);
  }

  return {
    source,
    results: Array.from(scoreByTherapy.values())
      .map((result) => {
        const compatibilityPercent = calculateCompatibilityPercent(
          result.score,
          possibleScore,
        );

        return {
          ...result,
          compatibilityPercent,
          explanation: buildMatchExplanation(result, compatibilityPercent),
        };
      })
      .sort(sortMatchResults)
      .slice(0, input.maxResults ?? undefined),
  };
}

function isActiveRelation(relation: TherapyThemeRelation) {
  return relation.isActive !== false;
}

function toUniqueList(ids: UUID[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

function getRelationWeight(
  relation: TherapyThemeRelation,
  fallbackWeight: number,
) {
  return Number.isFinite(relation.weight) && relation.weight > 0
    ? relation.weight
    : fallbackWeight;
}

function calculateRelationScore(
  relation: TherapyThemeRelation,
  themeSet: Set<UUID>,
  subthemeSet: Set<UUID>,
) {
  let score = 0;

  if (relation.themeId && themeSet.has(relation.themeId)) {
    score += getRelationWeight(relation, DEFAULT_THEME_WEIGHT);
  }

  if (relation.subthemeId && subthemeSet.has(relation.subthemeId)) {
    score += getRelationWeight(relation, DEFAULT_SUBTHEME_WEIGHT);
  }

  return score;
}

function calculatePossibleScore(
  relations: TherapyThemeRelation[],
  selectedThemeIds: UUID[],
  selectedSubthemeIds: UUID[],
) {
  const themeScore = selectedThemeIds.reduce((total, themeId) => {
    return total + getBestWeightForSelection(relations, "themeId", themeId);
  }, 0);
  const subthemeScore = selectedSubthemeIds.reduce((total, subthemeId) => {
    return (
      total + getBestWeightForSelection(relations, "subthemeId", subthemeId)
    );
  }, 0);

  return Math.max(themeScore + subthemeScore, 1);
}

function getBestWeightForSelection(
  relations: TherapyThemeRelation[],
  key: "themeId" | "subthemeId",
  id: UUID,
) {
  return relations.reduce((bestWeight, relation) => {
    if (relation[key] !== id) {
      return bestWeight;
    }

    const fallbackWeight =
      key === "themeId" ? DEFAULT_THEME_WEIGHT : DEFAULT_SUBTHEME_WEIGHT;

    return Math.max(bestWeight, getRelationWeight(relation, fallbackWeight));
  }, 0);
}

function calculateCompatibilityPercent(score: number, possibleScore: number) {
  return Math.min(100, Math.max(1, Math.round((score / possibleScore) * 100)));
}

function addUniqueIfPresent(
  values: UUID[],
  value: UUID | undefined,
  allowedValues: Set<UUID>,
) {
  if (!value || !allowedValues.has(value) || values.includes(value)) {
    return values;
  }

  return [...values, value];
}

function buildMatchExplanation(
  result: Omit<MatchTherapyScore, "compatibilityPercent" | "explanation">,
  compatibilityPercent: number,
) {
  const hasSubthemes = result.matchedSubthemeIds.length > 0;

  if (compatibilityPercent >= 80 && hasSubthemes) {
    return "Este caminho pode fazer sentido para o momento que você compartilhou.";
  }

  if (hasSubthemes) {
    return "Essa terapia aparece como uma possibilidade alinhada aos interesses relacionados aos temas que você escolheu.";
  }

  return "Essa terapia aparece como uma possibilidade alinhada às suas escolhas.";
}

function sortMatchResults(first: MatchTherapyScore, second: MatchTherapyScore) {
  if (second.score !== first.score) {
    return second.score - first.score;
  }

  if (second.compatibilityPercent !== first.compatibilityPercent) {
    return second.compatibilityPercent - first.compatibilityPercent;
  }

  return first.therapy.name.localeCompare(second.therapy.name, "pt-BR");
}
