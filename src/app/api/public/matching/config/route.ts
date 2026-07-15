import { NextResponse } from "next/server";

import { getPublicMatchingConfig } from "@/features/public-matching";

export const revalidate = 300;

export async function GET() {
  const config = await getPublicMatchingConfig();

  return NextResponse.json({
    source: config.source,
    themes: config.themes,
    version: config.version,
    versionId: config.versionId,
  });
}
