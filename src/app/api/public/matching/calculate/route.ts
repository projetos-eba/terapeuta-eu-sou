import { NextResponse } from "next/server";

import {
  calculateMatchingResults,
  calculateMatchingWithFunction,
  getMatchingCalculationData,
  getPublicMatchingConfig,
  validateMatchingSelection,
  type MatchingSelection,
} from "@/features/public-matching";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "invalid_json",
        message: "Envie um JSON valido para calcular o Match.",
      },
      { status: 400 },
    );
  }

  const selection = toSelection(body);
  const configResult = await getPublicMatchingConfig();

  if (configResult.status === "unavailable") {
    return NextResponse.json(
      {
        correlationId: configResult.correlationId,
        error: "matching_unavailable",
        reason: configResult.reason,
      },
      { status: 503 },
    );
  }

  const config = configResult.config;
  const validationError = validateMatchingSelection(config, selection);

  if (validationError) {
    return NextResponse.json(
      {
        error: "invalid_selection",
        message: validationError,
      },
      { status: 422 },
    );
  }

  if (selection.matchingVersionId !== config.versionId) {
    return NextResponse.json(
      {
        currentVersionId: config.versionId,
        error: "matching_version_stale",
        message: "Atualize a jornada para usar a versão publicada mais recente.",
      },
      { status: 409 },
    );
  }

  const functionResult = await calculateMatchingWithFunction(
    selection,
    config.versionId,
  );

  if (functionResult) {
    return NextResponse.json(functionResult);
  }

  const calculationData = await getMatchingCalculationData(config.versionId);
  if (calculationData.status === "unavailable") {
    return NextResponse.json(
      {
        correlationId: calculationData.correlationId,
        error: "matching_unavailable",
        reason: calculationData.reason,
      },
      { status: 503 },
    );
  }

  const result = calculateMatchingResults({
    config,
    selection,
    source: calculationData.source,
    therapies: calculationData.therapies,
    versionId: calculationData.versionId,
    weights: calculationData.weights,
  });

  return NextResponse.json(result);
}

function toSelection(value: unknown): MatchingSelection {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    interestIds: toStringList(record.interestIds),
    matchingVersionId:
      typeof record.matchingVersionId === "string"
        ? record.matchingVersionId
        : typeof record.versionId === "string"
          ? record.versionId
          : "",
    source: "journey",
    themeIds: toStringList(record.themeIds),
  };
}

function toStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.filter((item): item is string => typeof item === "string")),
  );
}
