import { NextResponse } from "next/server";

import {
  getPublicServiceAvailabilityForDay,
  getPublicServiceAvailabilityMonth,
  isDateKey,
  isMonthKey,
} from "@/features/availability/queries/public-service-availability";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStoreHeaders = { "Cache-Control": "no-store" };

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const serviceId = url.searchParams.get("service") ?? "";
  const month = url.searchParams.get("month");
  const date = url.searchParams.get("date");

  if (!UUID.test(serviceId) || Boolean(month) === Boolean(date)) {
    return failure("Disponibilidade indisponível no momento.", 400);
  }

  if (month) {
    if (!isMonthKey(month)) {
      return failure("Disponibilidade indisponível no momento.", 400);
    }

    const result = await getPublicServiceAvailabilityMonth(serviceId, month);
    if (result.status === "error") {
      return failure("Disponibilidade indisponível no momento.", 503);
    }

    return NextResponse.json(
      { availability: result.data, ok: true, type: "month" },
      { headers: noStoreHeaders },
    );
  }

  if (!date || !isDateKey(date)) {
    return failure("Disponibilidade indisponível no momento.", 400);
  }

  const result = await getPublicServiceAvailabilityForDay(serviceId, date);
  if (result.status === "error") {
    return failure("Disponibilidade indisponível no momento.", 503);
  }

  return NextResponse.json(
    { availability: result.data, ok: true, type: "day" },
    { headers: noStoreHeaders },
  );
}

function failure(message: string, status: number) {
  return NextResponse.json(
    { error: { message }, ok: false },
    { headers: noStoreHeaders, status },
  );
}
