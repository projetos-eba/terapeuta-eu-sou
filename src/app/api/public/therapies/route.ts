import { NextResponse } from "next/server";

import {
  getPublicTherapies,
  parseTherapySearchParams,
} from "@/features/therapies";

export const revalidate = 900;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams.entries());
  const params = parseTherapySearchParams(searchParams);
  const result = await getPublicTherapies(params);

  return NextResponse.json(result);
}
