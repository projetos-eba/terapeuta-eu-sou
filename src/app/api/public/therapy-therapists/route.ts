import { NextResponse } from "next/server";

import {
  getRelatedTherapists,
  parseRelatedTherapistSort,
} from "@/features/therapies/queries/get-related-therapists";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return failure("Envie os dados em formato valido.", 400);
  }

  const record = isRecord(body) ? body : null;
  const slug = typeof record?.slug === "string" ? record.slug : "";
  const sort = parseRelatedTherapistSort(
    typeof record?.sort === "string" ? record.sort : undefined,
  );
  const themeIds = parseUuidArray(record?.themeIds, 3);
  const interestIds = parseUuidArray(record?.interestIds, 9);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !themeIds.length) {
    return failure("Contexto de Match invalido ou expirado.", 422);
  }

  const result = await getRelatedTherapists({
    interestIds,
    limit: 12,
    slug,
    sort,
    themeIds,
  });

  return NextResponse.json(
    {
      errorMessage: result.errorMessage,
      items: result.items,
      ok: true,
    },
    { headers: noStoreHeaders },
  );
}

function parseUuidArray(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > max) return [];
  const ids = value.filter((item): item is string => UUID.test(String(item)));
  return ids.length === value.length ? ids : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { error: { message }, ok: false },
    { headers: noStoreHeaders, status },
  );
}
