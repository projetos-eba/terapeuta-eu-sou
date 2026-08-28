import { NextResponse } from "next/server";

import { getPublicHomeFeaturedTherapistsPage } from "@/features/public-home";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

const noStoreHeaders = { "Cache-Control": "no-store" };

function parseOffset(value: string | null) {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export async function GET(request: Request) {
  if (!getSupabasePublicConfig()) {
    return NextResponse.json(
      { error: { code: "UNAVAILABLE" } },
      { headers: noStoreHeaders, status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);

  try {
    const page = await getPublicHomeFeaturedTherapistsPage({
      freeOffset: parseOffset(searchParams.get("freeOffset")),
      paidOffset: parseOffset(searchParams.get("paidOffset")),
    });

    return NextResponse.json(page, { headers: noStoreHeaders });
  } catch {
    return NextResponse.json(
      { error: { code: "UNAVAILABLE" } },
      { headers: noStoreHeaders, status: 503 },
    );
  }
}
