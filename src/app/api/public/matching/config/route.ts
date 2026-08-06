import { NextResponse } from "next/server";

import { getPublicMatchingConfig } from "@/features/public-matching";

export async function GET() {
  const result = await getPublicMatchingConfig();

  if (result.status === "unavailable") {
    return NextResponse.json(
      {
        correlationId: result.correlationId,
        error: "matching_unavailable",
        reason: result.reason,
      },
      { status: 503 },
    );
  }

  const { config } = result;

  return NextResponse.json({
    source: config.source,
    status: result.status,
    themes: config.themes,
    version: config.version,
    versionId: config.versionId,
  });
}
